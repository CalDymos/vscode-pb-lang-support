import * as vscode from 'vscode';
import * as path from 'path';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import { PureBasicDebugAdapterDescriptorFactory } from './debug/debugAdapterDescriptorFactory';
import type { PbpProject, PbpTarget } from '@caldymos/pb-project-core';
import { FallbackResolver } from './host/fallback-resolver';
import {splitPbFile, joinPbFile} from './host/utils/pb-metadata';


let client: LanguageClient;
let debugChannel: vscode.OutputChannel;
let fileWatcher: vscode.FileSystemWatcher;

// ---------------------------------------------------------------------------
// pb-project-files API (v3)
// Mirrors PbProjectFilesApi from pb-project-files/src/api.ts.
// Only the subset used by this bridge is declared here – unknown fields are
// ignored at runtime, so the declaration stays lean.
// ---------------------------------------------------------------------------
interface PbProjectContextPayload {
    noProject?: boolean;
    projectFile?: string;
    projectDir?: string;
    projectName?: string;
    targetName?: string;
    projectFiles?: string[];
    /** Full parsed project model. */
    project?: PbpProject;
    /** Active target model. */
    target?: PbpTarget;
}

interface PbpProjectMinimal {
    projectFile: string;
    projectDir: string;
}

interface PbProjectFilesApi {
    readonly version: 3;
    getActiveContextPayload(): PbProjectContextPayload;
    getProjectForFile(fileUri: vscode.Uri): PbpProjectMinimal | undefined;
    readonly onDidChangeActiveContext: vscode.Event<PbProjectContextPayload>;
}

// ---------------------------------------------------------------------------

function formatInternalError(err: unknown): string {
    if (err instanceof Error) {
        return err.stack ?? err.message;
    }
    if (typeof err === 'string') {
        return err;
    }
    try {
        return JSON.stringify(err);
    } catch {
        return String(err);
    }
}

function logInternalError(label: string, err: unknown): void {
    console.error(label, err);
    if (debugChannel) {
        debugChannel.appendLine(`[${new Date().toISOString()}] ${label}`);
        debugChannel.appendLine(formatInternalError(err));
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('PureBasic extension is now active!');

    debugChannel = vscode.window.createOutputChannel('PureBasic (Language Server)');
    context.subscriptions.push(debugChannel);
    debugChannel.appendLine('Activating PureBasic Language Server...');

    try {
        const serverRelPath = path.join('out', 'server', 'server.js');
        const serverPath = context.asAbsolutePath(serverRelPath);
        console.log('Server path (relative):', serverRelPath);

        // Check if server file exists
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const fs = require('fs');
        if (!fs.existsSync(serverPath)) {
            console.error('Server file does not exist at expected relative path:', serverRelPath);
            vscode.window.showErrorMessage('PureBasic Language Server file not found!');
            return;
        }

        const serverOptions: ServerOptions = {
            run: {
                module: serverPath,
                transport: TransportKind.stdio
            },
            debug: {
                module: serverPath,
                transport: TransportKind.stdio,
                options: { execArgv: ['--nolazy', '--inspect=6009'] }
            }
        };

        // Create file watcher and store reference for cleanup
        fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{pb,pbi}');
        context.subscriptions.push(fileWatcher);

        const clientOptions: LanguageClientOptions = {
            documentSelector: [
                { scheme: 'file', language: 'purebasic' }
            ],
            synchronize: {
                configurationSection: 'purebasic',
                // Only PureBasic source files are relevant for the language server.
                fileEvents: fileWatcher
            }
        };

        client = new LanguageClient(
            'purebasic',
            'PureBasic Language Server',
            serverOptions,
            clientOptions
        );

        // Register commands
        registerCommands(context);

        // Register debug configuration provider
        registerDebugProvider(context);

        // Register folding provider for PureBasic meta section
        registerFoldingProvider(context);

        // Start the language server.
        console.log('Starting Language Server...');
        try {
            client.start();
        } catch (error) {
            logInternalError('Language Server failed to start', error);
            vscode.window.showErrorMessage(
                'PureBasic Language Server failed to start. See Output: PureBasic (Language Server) for details.'
            );
            return;
        }

        // Some vscode-languageclient type declarations (depending on the build setup) may not expose onReady().
        // Use a runtime check to stay compatible.
        const onReadyFn = (client as any).onReady as undefined | (() => Promise<void>);
        const readyPromise = typeof onReadyFn === 'function' ? onReadyFn.call(client) : Promise.resolve();

        void readyPromise
            .then(() => {
                console.log('PureBasic Language Server is ready!');
                vscode.window.showInformationMessage('PureBasic Language Server is ready!');

                debugChannel.appendLine('PureBasic Language Server is ready.');

                // Setup pb-project-files bridge (optional extension).
                void setupProjectFilesBridge(context);
            })
            .catch((error: unknown) => {
                logInternalError('Language Server failed to become ready', error);
                vscode.window.showErrorMessage(
                    'PureBasic Language Server failed to start. See Output: PureBasic (Language Server) for details.'
                );
            });
    } catch (error) {
        logInternalError('Error activating extension', error);
        vscode.window.showErrorMessage(
            'Failed to activate PureBasic extension. See Output: PureBasic (Language Server) for details.'
        );
    }
}

// ---------------------------------------------------------------------------
// LSP payload helpers – strip heavy/roundtrip-only fields before sending
// over JSON-RPC. Fields needed for compile/debug are kept.
// ---------------------------------------------------------------------------

/**
 * Returns a copy of PbpProject with fields that are only needed for
 * roundtrip-writing or IDE-UI state removed:
 *  - meta (raw XML, roundtrip only)
 *  - data (explorer state, lastopen, log flags)
 *  - files[].fingerprint (MD5 hashes)
 *  - files[].meta (raw XML per file entry)
 */
function stripProjectForLsp(project: PbpProject): PbpProject {
    return {
        ...project,
        meta: undefined,
        data: {},
        files: project.files.map(f => ({
            rawPath: f.rawPath,
            fsPath: f.fsPath,
            config: f.config,
            // fingerprint and meta intentionally omitted
        })),
    };
}

/**
 * Returns a copy of PbpTarget with fields that are only needed for
 * IDE-UI state removed:
 *  - meta (raw XML, roundtrip only)
 *  - watchList (IDE-internal watch list)
 */
function stripTargetForLsp(target: PbpTarget): PbpTarget {
    const { meta: _meta, watchList: _watchList, ...rest } = target;
    return rest;
}

async function setupProjectFilesBridge(context: vscode.ExtensionContext): Promise<void> {
    const ext = vscode.extensions.getExtension('CalDymos.pb-project-files');
    if (!ext) {
        debugChannel.appendLine(
            '[pb-project-files] Not installed – activating standalone fallback mode.'
        );
        await activateFallbackMode(context);
        return;
    }

    let api: PbProjectFilesApi | undefined;
    try {
        api = (await ext.activate()) as PbProjectFilesApi | undefined;
    } catch (err) {
        logInternalError('pb-project-files activation failed (optional integration, continuing without it)', err);
        return;
    }

    // Guard: require exact v2 API. Older or unknown versions are skipped
    // so that pb-lang-support keeps running standalone without breaking.
    if (!api || api.version !== 3) {
        debugChannel.appendLine(
            `[pb-project-files] Unexpected API version (got ${(api as any)?.version}, expected 3). ` +
            'Running without project integration.'
        );
        return;
    }

    debugChannel.appendLine('[pb-project-files] v2 API connected – project bridge active.');

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    const fallbackResolver = new FallbackResolver();

    const sendProjectContext = async () => {
        const ctx = api!.getActiveContextPayload();

        if (ctx.noProject) {
            const ed       = vscode.window.activeTextEditor;
            const fallback = ed ? await fallbackResolver.resolve(ed.document.uri) : null;
            client.sendNotification('purebasic/projectContext', {
                version:      3,
                noProject:    true,
                projectFiles: fallback?.projectFiles ?? [],
            });
            return;
        }

        client.sendNotification('purebasic/projectContext', {
            version:        3,
            projectFileUri: ctx.projectFile ? vscode.Uri.file(ctx.projectFile).toString() : undefined,
            projectDir:     ctx.projectDir,
            projectName:    ctx.projectName,
            targetName:     ctx.targetName,
            projectFiles:   ctx.projectFiles ?? [],
            project: ctx.project ? stripProjectForLsp(ctx.project) : null,
            target: ctx.target ? stripTargetForLsp(ctx.target) : null,
        });
    };

    const computeScope = (projectDir: string, filePath: string): 'internal' | 'external' => {
        const rel = path.relative(projectDir, filePath);
        return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? 'internal' : 'external';
    };

    const sendFileProject = (doc: vscode.TextDocument, isClosed = false) => {
        if (doc.uri.scheme !== 'file') return;
        const proj = isClosed ? undefined : api!.getProjectForFile(doc.uri);
        client.sendNotification('purebasic/fileProject', {
            version: 3,
            documentUri: doc.uri.toString(),
            projectFileUri: proj?.projectFile ? vscode.Uri.file(proj.projectFile).toString() : undefined,
            scope: proj?.projectDir ? computeScope(proj.projectDir, doc.uri.fsPath) : 'external',
        });
    };

    // ------------------------------------------------------------------
    // Initial sync
    // ------------------------------------------------------------------
    void sendProjectContext();
    for (const doc of vscode.workspace.textDocuments) {
        sendFileProject(doc);
    }

    // ------------------------------------------------------------------
    // Ongoing sync
    // ------------------------------------------------------------------
    const subs: vscode.Disposable[] = [
        api.onDidChangeActiveContext(() => {
            void sendProjectContext();
            const ed = vscode.window.activeTextEditor;
            if (ed) sendFileProject(ed.document);
        }),
        vscode.workspace.onDidOpenTextDocument(doc => sendFileProject(doc)),
        vscode.workspace.onDidCloseTextDocument(doc => sendFileProject(doc, true)),
        vscode.window.onDidChangeActiveTextEditor(ed => {
            if (ed) sendFileProject(ed.document);
        }),
    ];

    context.subscriptions.push(...subs);
}

async function activateFallbackMode(context: vscode.ExtensionContext): Promise<void> {
    const resolver = new FallbackResolver();

    const send = async (doc: vscode.TextDocument | undefined) => {
        if (!doc || doc.uri.scheme !== 'file') return;
        const fallback = await resolver.resolve(doc.uri);
        client.sendNotification('purebasic/projectContext', {
            version:      2,
            noProject:    true,
            projectFiles: fallback?.projectFiles ?? [],
        });
    };

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(ed => { void send(ed?.document); }),
        vscode.workspace.onDidSaveTextDocument(doc  => {
            if (vscode.window.activeTextEditor?.document === doc) void send(doc);
        }),
    );

    // Metadaten beim Speichern aktualisieren (nur im Fallback-Modus)
    context.subscriptions.push(
        vscode.workspace.onWillSaveTextDocument(e => {
            if (e.document.languageId !== 'purebasic') return;

            const text  = e.document.getText();
            const split = splitPbFile(text);
            if (!split.metadata) return; // kein Block → nichts aktualisieren

            // Einzige "lebende" Daten die wir im Fallback kennen und
            // in die Metadaten zurückschreiben: CursorPosition
            const editor = vscode.window.activeTextEditor;
            if (editor?.document === e.document) {
                const line = editor.selection.active.line + 1;
                split.metadata.entries.set('CursorPosition', String(line));
            }

            const newText = joinPbFile(split.source, split.metadata);
            if (newText === text) return; // keine Änderung → kein Edit

            const fullRange = new vscode.Range(
                e.document.positionAt(0),
                e.document.positionAt(text.length),
            );
            e.waitUntil(
                Promise.resolve([new vscode.TextEdit(fullRange, newText)])
            );
        })
    );

    void send(vscode.window.activeTextEditor?.document);
}

function registerFoldingProvider(context: vscode.ExtensionContext) : void {
    context.subscriptions.push(
        vscode.languages.registerFoldingRangeProvider(
            { language: 'purebasic' },
            {
                provideFoldingRanges(document) {
                    const text  = document.getText();
                    const split = splitPbFile(text);
                    if (split.metaStartLine < 0) return [];

                    return [
                        new vscode.FoldingRange(
                            split.metaStartLine,
                            document.lineCount - 1,
                            vscode.FoldingRangeKind.Comment,
                        ),
                    ];
                },
            },
        )
    );
}


function registerDebugProvider(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.debug.registerDebugConfigurationProvider('purebasic', {
            resolveDebugConfiguration(
                _folder: vscode.WorkspaceFolder | undefined,
                config: vscode.DebugConfiguration,
            ): vscode.ProviderResult<vscode.DebugConfiguration> {
                // If launched via F5 with no launch.json, supply defaults
                if (!config.type && !config.request && !config.name) {
                    const editor = vscode.window.activeTextEditor;
                    if (editor && editor.document.languageId === 'purebasic') {
                        config.type = 'purebasic';
                        config.name = 'Debug PureBasic';
                        config.request = 'launch';
                        config.program = editor.document.fileName;
                        config.stopOnEntry = false;
                    }
                }
                if (!config.program) {
                    return vscode.window.showInformationMessage(
                        'Cannot find a PureBasic file to debug. Open a .pb file first.',
                    ).then(() => undefined);
                }
                return config;
            },
        }),
    );

    context.subscriptions.push(
        vscode.debug.registerDebugAdapterDescriptorFactory(
            'purebasic',
            new PureBasicDebugAdapterDescriptorFactory(context),
        ),
    );
}

function registerCommands(context: vscode.ExtensionContext) {
    // Show diagnostics command
    const showDiagnostics = vscode.commands.registerCommand('purebasic.showDiagnostics', () => {
        vscode.commands.executeCommand('workbench.action.problems.focus');
    });

    // Restart language server command
    const restartLanguageServer = vscode.commands.registerCommand('purebasic.restartLanguageServer', async () => {
        if (client) {
            try {
                await client.stop();
                await client.start();
                vscode.window.showInformationMessage('PureBasic Language Server restarted successfully!');
            } catch (error) {
                logInternalError('Failed to restart PureBasic Language Server', error);
                vscode.window.showErrorMessage(
                    'Failed to restart PureBasic Language Server. See Output: PureBasic (Language Server) for details.'
                );
            }
        }
    });

    // Clear symbol cache command
    const clearSymbolCache = vscode.commands.registerCommand('purebasic.clearSymbolCache', async () => {
        try {
            if (client) {
                await client.sendRequest('purebasic/clearSymbolCache');
                vscode.window.showInformationMessage('Symbol cache cleared successfully!');
            }
        } catch (error) {
            logInternalError('Failed to clear symbol cache', error);
            vscode.window.showErrorMessage(
                'Failed to clear symbol cache. See Output: PureBasic (Language Server) for details.'
            );
        }
    });

    // Format document command
    const formatDocument = vscode.commands.registerCommand('purebasic.formatDocument', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'purebasic') {
            try {
                await vscode.commands.executeCommand('editor.action.formatDocument');
            } catch (error) {
                logInternalError('Failed to format document', error);
                vscode.window.showErrorMessage(
                    'Failed to format document. See Output: PureBasic (Language Server) for details.'
                );
            }
        } else {
            vscode.window.showWarningMessage('No PureBasic document active');
        }
    });

    // Find symbols command
    const findSymbols = vscode.commands.registerCommand('purebasic.findSymbols', async () => {
        try {
            await vscode.commands.executeCommand('workbench.action.showAllSymbols');
        } catch (error) {
            logInternalError('Failed to show symbols', error);
            vscode.window.showErrorMessage(
                'Failed to show symbols. See Output: PureBasic (Language Server) for details.'
            );
        }
    });

    // Register all commands
    context.subscriptions.push(
        showDiagnostics,
        restartLanguageServer,
        clearSymbolCache,
        formatDocument,
        findSymbols
    );
}

export function deactivate(): Thenable<void> | undefined {
    // fileWatcher is disposed automatically via context.subscriptions

    if (!client) {
        return undefined;
    }
    return client.stop();
}