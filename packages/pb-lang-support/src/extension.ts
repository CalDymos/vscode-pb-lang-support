import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import { PureBasicDebugAdapterDescriptorFactory } from './debug/debugAdapterDescriptorFactory';
import type { PbpProject, PbpTarget } from '@caldymos/pb-project-core';
import { FallbackResolver } from './host/fallback-resolver';
import { resolveUnifiedContext, type PbProjectFilesApi } from './host/unified-context';
import { buildActiveTarget } from './host/pbcompiler/build-active-target';
import { runActiveTarget } from './host/pbcompiler/run-active-target';
import { buildPbCompilerArgs } from './host/pbcompiler/pbcompiler-args';
import {splitPbFile, PbFileSplit} from './host/utils/pb-metadata';


let client: LanguageClient;
let debugChannel: vscode.OutputChannel;
let buildChannel: vscode.OutputChannel;
let fileWatcher: vscode.FileSystemWatcher;

let projectFilesApi: PbProjectFilesApi | undefined;

// ---------------------------------------------------------------------------

async function tryActivateProjectFilesApi(): Promise<PbProjectFilesApi | undefined> {
    if (projectFilesApi) return projectFilesApi;

    const ext = vscode.extensions.getExtension('CalDymos.pb-project-files');
    if (!ext) return undefined;

    try {
        const api = (await ext.activate()) as PbProjectFilesApi | undefined;
        if (api && api.version === 3) {
            projectFilesApi = api;
            return api;
        } else {
            debugChannel.appendLine(
                `[pb-project-files] Unexpected API version (got ${(api as any)?.version}, expected 3). ` +
                'Running without project integration.'
            );
        }
    } catch {
        // ignore (optional integration)
    }
    return undefined;
}

function makeTempDebugOutputPath(sourceFile: string): string {
  const base = path.basename(sourceFile, path.extname(sourceFile));
  const suffix = process.platform === 'win32' ? '.exe' : '';
  return path.join(os.tmpdir(), `pb_debug_${base}_${Date.now()}${suffix}`);
}

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

    buildChannel = vscode.window.createOutputChannel('PureBasic (Build)');
    context.subscriptions.push(buildChannel);

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
        projectFilesApi = undefined;
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

    // Guard: require exact v3 API. Older or unknown versions are skipped
    // so that pb-lang-support keeps running standalone without breaking.
    if (!api || api.version !== 3) {
        debugChannel.appendLine(
            `[pb-project-files] Unexpected API version (got ${(api as any)?.version}, expected 3). ` +
            'Running without project integration.'
        );
        projectFilesApi = undefined;
        return;
    }

    projectFilesApi = api;

    debugChannel.appendLine(`[pb-project-files] v${(api as any)?.version} API connected – project bridge active.`);

    const fallbackResolver = new FallbackResolver();

    const sendProjectContext = async () => {
        const ed = vscode.window.activeTextEditor;
        const uctx = await resolveUnifiedContext({
            api: api!,
            fallbackResolver,
            activeDocument: ed?.document,
        });

        if (!uctx) return;

        if (uctx.mode === 'fallback') {
            client.sendNotification('purebasic/projectContext', {
                version: 3,
                noProject: true,
                projectFiles: uctx.projectFiles.map(fsPath => ({ fsPath, scan: true })),
            });
            return;
        }

        // Build a { fsPath, scan } list so the language server can filter
        // per operation (e.g. scan-only for indexing, all files for Go to Definition).
        const projectFilesWithFlags: { fsPath: string; scan: boolean }[] = uctx.project
            ? uctx.project.files
                .filter(f => Boolean(f.fsPath))
                .map(f => ({ fsPath: f.fsPath!, scan: f.config?.scan !== false }))
            : uctx.projectFiles.map(fsPath => ({ fsPath, scan: true }));

        client.sendNotification('purebasic/projectContext', {
            version: 3,
            projectFileUri: uctx.projectFileUri,
            projectDir: uctx.projectDir,
            projectName: uctx.projectName,
            targetName: uctx.targetName,
            projectFiles: projectFilesWithFlags,
            project: uctx.project ? stripProjectForLsp(uctx.project) : null,
            target: uctx.target ? stripTargetForLsp(uctx.target) : null,
        });
    };

    const computeScope = (projectDir: string, filePath: string): 'internal' | 'external' => {
        const rel = path.relative(projectDir, filePath);
        return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? 'internal' : 'external';
    };

    const sendFileProject = (doc: vscode.TextDocument, isClosed = false) => {
        if (doc.uri.scheme !== 'file') return;
        // In "No Project" mode, suppress file-project mappings so the server
        // does not override the fallback context with stale project associations.
        if (api!.getActiveContextPayload().noProject) return;
        const proj = isClosed ? undefined : api!.getProjectForFile(doc.uri);
        client.sendNotification('purebasic/fileProject', {
            version: 3,
            documentUri: doc.uri.toString(),
            projectFileUri: proj?.projectFile ? vscode.Uri.file(proj.projectFile).toString() : undefined,
            scope: proj?.projectDir ? computeScope(proj.projectDir, doc.uri.fsPath) : 'external',
        });
    };

    // ------------------------------------------------------------------
    // Initial pbp ctx sync
    // ------------------------------------------------------------------
    void sendProjectContext();
    for (const doc of vscode.workspace.textDocuments) {
        sendFileProject(doc);
    }

    // ------------------------------------------------------------------
    // Ongoing pbp ctx sync
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

    projectFilesApi = undefined;

    const send = async (doc: vscode.TextDocument | undefined) => {
        if (!doc || doc.uri.scheme !== 'file') return;
        const fallback = await resolver.resolve(doc.uri);
        client.sendNotification('purebasic/projectContext', {
            version:      3,
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

    // Update metadata when saving (only in fallback mode)
    context.subscriptions.push(
        vscode.workspace.onWillSaveTextDocument(e => {
            if (e.document.languageId !== 'purebasic') return;

            const editor = vscode.window.activeTextEditor;
            if (editor?.document !== e.document) return;

            const text = e.document.getText();
            const split = splitPbFile(text);
            if (!split.metadata) return; // no block → do not update anything

            const cursorLine = editor.selection.active.line + 1;
            const newValue = String(cursorLine);

            // Narrow Edit: only adjust the cursor position line,
            // never touch the rest of the document.
            const edit = findOrBuildCursorPositionEdit(
                e.document, split, newValue,
            );
            if (edit) e.waitUntil(Promise.resolve([edit]));
        })
    );

    void send(vscode.window.activeTextEditor?.document);
}

function findOrBuildCursorPositionEdit(
    document: vscode.TextDocument,
    split:    PbFileSplit,
    newValue: string,
): vscode.TextEdit | null {
    if (split.metaStartLine < 0) return null;

    const KEY = 'CursorPosition';

    // Search for existing CursorPosition line in metadata block
    for (let i = split.metaStartLine; i < document.lineCount; i++) {
        const lineText = document.lineAt(i).text;
        // Matches "; CursorPosition = <number>"
        if (/^; CursorPosition = \d+$/.test(lineText)) {
            const oldValue = lineText.replace(/^; CursorPosition = /, '');
            if (oldValue === newValue) return null; // no changes needed

            const range = document.lineAt(i).range;
            return vscode.TextEdit.replace(
                range,
                `; ${KEY} = ${newValue}`,
            );
        }
    }

    // No entry found → insert after anchor (line metaStartLine + 1)
    const insertPos = new vscode.Position(split.metaStartLine + 1, 0);
    const eol       = split.eol;
    return vscode.TextEdit.insert(
        insertPos,
        `; ${KEY} = ${newValue}${eol}`,
    );
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
      async resolveDebugConfiguration(
        _folder: vscode.WorkspaceFolder | undefined,
        config: vscode.DebugConfiguration,
      ): Promise<vscode.DebugConfiguration | undefined> {

        // F5 without launch.json: defaults
        if (!config.type && !config.request && !config.name) {
          const editor = vscode.window.activeTextEditor;
          if (editor && editor.document.languageId === 'purebasic') {
            config.type = 'purebasic';
            config.name = 'Debug PureBasic';
            config.request = 'launch';
            config.program = editor.document.fileName;
            config.stopOnEntry = true;
          }
        }

        const editor = vscode.window.activeTextEditor;
        const activeDoc = editor?.document?.languageId === 'purebasic' ? editor.document : undefined;

        // Determine a "seed" URI even when file isn't opened
        const seedUri =
          activeDoc?.uri ??
          (typeof config.program === 'string' && config.program ? vscode.Uri.file(config.program) : undefined);

        if (!seedUri || seedUri.scheme !== 'file') {
          await vscode.window.showInformationMessage('Cannot find a PureBasic file to debug. Open a .pb file first.');
          return undefined;
        }

        const api = await tryActivateProjectFilesApi();
        const fallbackResolver = new FallbackResolver();

        const uctx = await resolveUnifiedContext({
          api,
          fallbackResolver,
          activeDocument: activeDoc,
          activeUri: seedUri,
        });

        // Decide program: if the user didn't explicitly set a different program, prefer target input file
        const seedProgram = seedUri.fsPath;
        const ctxProgram = uctx?.inputFile ?? seedProgram;

        if (!config.program || config.program === seedProgram) {
          config.program = ctxProgram;
        }

        const programPath = String(config.program);
        if (!programPath) {
          await vscode.window.showInformationMessage('Missing "program" for PureBasic debug configuration.');
          return undefined;
        }

        // Compiler path: prefer user config setting, then keep launch.json compiler, else let adapter auto-detect
        const compilerSetting = (vscode.workspace.getConfiguration('purebasic.build').get<string>('compiler') ?? '').trim();
        if (compilerSetting && !config.compiler) {
          config.compiler = compilerSetting;
        }

        // Compile cwd: projectDir preferred, else source dir
        const compileCwd = uctx?.projectDir ?? path.dirname(programPath);
        config.cwd = compileCwd;

        // Run cwd: target workingDir preferred, else compile cwd
        config.runCwd = uctx?.workingDir ?? compileCwd;

        // Temp output for debug build
        const tempOutput = makeTempDebugOutputPath(programPath);
        config.output = tempOutput;

        // pbcompiler args (full argv including source file)
        if (uctx) {
          const mapped = buildPbCompilerArgs(uctx, {
            platform: process.platform,
            purpose: 'debug',
            outputOverride: tempOutput,
          });

          if (mapped.args.length > 0) {
            config.compilerArgs = mapped.args;
          }
        } else {
          // Very defensive fallback (should rarely happen due to resolveUnifiedContext using seedUri)
          config.compilerArgs = [programPath, '--debugger', '--linenumbering', '--output', tempOutput];
        }

        // Default stopOnEntry
        if (typeof config.stopOnEntry !== 'boolean') {
          config.stopOnEntry = true;
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

    const buildTarget = vscode.commands.registerCommand('purebasic.buildActiveTarget', async () => {
        await buildActiveTarget({
            projectFilesApi,
            outputChannel: buildChannel,
        });
    });
    const runTarget = vscode.commands.registerCommand('purebasic.runActiveTarget', async () => {
        await runActiveTarget({
            projectFilesApi,
            outputChannel: buildChannel,
        });
    });

    const buildAndRunTarget = vscode.commands.registerCommand('purebasic.buildAndRunActiveTarget', async () => {
        const ok = await buildActiveTarget({
            projectFilesApi,
            outputChannel: buildChannel,
        });
        if (ok) {
            await runActiveTarget({
                projectFilesApi,
                outputChannel: buildChannel,
            });
        }
    });


    // Register all commands
    context.subscriptions.push(
        showDiagnostics,
        restartLanguageServer,
        clearSymbolCache,
        formatDocument,
        findSymbols,
        buildTarget, 
        runTarget,
        buildAndRunTarget
    );
}

export function deactivate(): Thenable<void> | undefined {
    // fileWatcher is disposed automatically via context.subscriptions

    if (!client) {
        return undefined;
    }
    return client.stop();
}