import * as vscode from 'vscode';
import * as path from 'path';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import { PureBasicDebugAdapterDescriptorFactory } from './debug/debugAdapterDescriptorFactory';


let client: LanguageClient;
let debugChannel: vscode.OutputChannel;

interface PbProjectFilesApi {
    version: 1;
    getActiveContextPayload(): {
        projectFile?: string;
        projectDir?: string;
        projectName?: string;
        targetName?: string;
        includeDirs?: string[];
        projectFiles?: string[];
    };
    getProjectForFile(fileUri: vscode.Uri): { projectFile: string; projectDir: string } | undefined;
    onDidChangeActiveContext: vscode.Event<any>;
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

        const clientOptions: LanguageClientOptions = {
            documentSelector: [
                { scheme: 'file', language: 'purebasic' }
            ],
            synchronize: {
                configurationSection: 'purebasic',
                // Only PureBasic source files are relevant for the language server.
                fileEvents: vscode.workspace.createFileSystemWatcher('**/*.{pb,pbi}')
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

async function setupProjectFilesBridge(context: vscode.ExtensionContext): Promise<void> {
    const ext = vscode.extensions.getExtension('CalDymos.pb-project-files');
    if (!ext) {
        return;
    }

    let api: PbProjectFilesApi | undefined;
    try {
        api = (await ext.activate()) as PbProjectFilesApi | undefined;
    } catch (err) {
        logInternalError('pb-project-files activation failed (optional integration, continuing without it)', err);
        return;
    }
    if (!api || api.version !== 1) {
        return;
    }

    const sendProjectContext = () => {
        const ctx = api.getActiveContextPayload();
        client.sendNotification('purebasic/projectContext', {
            version: 1,
            projectFileUri: ctx.projectFile ? vscode.Uri.file(ctx.projectFile).toString() : undefined,
            projectDir: ctx.projectDir,
            projectName: ctx.projectName,
            targetName: ctx.targetName,
            includeDirs: ctx.includeDirs ?? [],
            projectFiles: ctx.projectFiles ?? [],
        });
    };

    const computeScope = (projectDir: string, filePath: string): 'internal' | 'external' => {
        const rel = path.relative(projectDir, filePath);
        return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? 'internal' : 'external';
    };

    const sendFileProject = (doc: vscode.TextDocument, isClosed = false) => {
        if (doc.uri.scheme !== 'file') return;
        const proj = isClosed ? undefined : api.getProjectForFile(doc.uri);
        client.sendNotification('purebasic/fileProject', {
            version: 1,
            documentUri: doc.uri.toString(),
            projectFileUri: proj?.projectFile ? vscode.Uri.file(proj.projectFile).toString() : undefined,
            scope: proj?.projectDir ? computeScope(proj.projectDir, doc.uri.fsPath) : 'external',
        });
    };

    // Initial sync.
    sendProjectContext();
    for (const doc of vscode.workspace.textDocuments) {
        sendFileProject(doc);
    }

    const subs: vscode.Disposable[] = [];

    subs.push(
        api.onDidChangeActiveContext(() => {
            sendProjectContext();
            const ed = vscode.window.activeTextEditor;
            if (ed) sendFileProject(ed.document);
        }),
        vscode.workspace.onDidOpenTextDocument(doc => sendFileProject(doc)),
        vscode.workspace.onDidCloseTextDocument(doc => sendFileProject(doc, true)),
        vscode.window.onDidChangeActiveTextEditor(ed => {
            if (ed) sendFileProject(ed.document);
        })
    );

    context.subscriptions.push(...subs);
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
    if (!client) {
        return undefined;
    }
    return client.stop();
}
