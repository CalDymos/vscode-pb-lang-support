import * as vscode from 'vscode';
import * as path from 'path';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';

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

export function activate(context: vscode.ExtensionContext) {
    console.log('PureBasic extension is now active!');

    try {
        const serverPath = context.asAbsolutePath(path.join('out', 'server', 'server.js'));
        console.log('Server path:', serverPath);

        // Check if server file exists
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const fs = require('fs');
        if (!fs.existsSync(serverPath)) {
            console.error('Server file does not exist:', serverPath);
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

        // Start the language server.
        console.log('Starting Language Server...');
        try {
            client.start();
        } catch (error) {
            console.error('Language Server failed to start:', error);
            const msg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage('PureBasic Language Server failed to start: ' + msg);
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

                // Setup debug output channel
                debugChannel = vscode.window.createOutputChannel('PureBasic (Debug)');
                debugChannel.appendLine('PureBasic debug channel initialized.');

                // Setup pb-project-files bridge (optional extension).
                void setupProjectFilesBridge(context);
            })
            .catch((error: any) => {
                console.error('Language Server failed to become ready:', error);
                vscode.window.showErrorMessage(
                    'PureBasic Language Server failed to start: ' + (error?.message ?? String(error))
                );
            });
    } catch (error) {
        console.error('Error activating extension:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage('Failed to activate PureBasic extension: ' + errorMessage);
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
    } catch {
        // Optional integration: ignore activation failures to keep pb-lang-support fully functional.
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
            scope: proj?.projectDir ? computeScope(proj.projectDir, doc.uri.fsPath) : undefined,
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
                vscode.window.showErrorMessage(
                    'Failed to restart PureBasic Language Server: ' +
                        (error instanceof Error ? error.message : String(error))
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
            vscode.window.showErrorMessage(
                'Failed to clear symbol cache: ' + (error instanceof Error ? error.message : String(error))
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
                vscode.window.showErrorMessage(
                    'Failed to format document: ' + (error instanceof Error ? error.message : String(error))
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
            vscode.window.showErrorMessage(
                'Failed to show symbols: ' + (error instanceof Error ? error.message : String(error))
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
