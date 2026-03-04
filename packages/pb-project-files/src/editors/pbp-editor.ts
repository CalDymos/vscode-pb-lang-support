/*
    Provides an editable custom editor for PureBasic .pbp project files.

    The editor offers structured tabs similar to PureBasic's project dialog,
    plus a Raw XML tab to cover settings not (yet) modeled.
*/

import * as vscode from 'vscode';
import * as path from 'path';
import { readProjectEditorSettings, SETTINGS_SECTION, ProjectEditorSettings } from '../config/settings'
import { parsePbpProjectText, writePbpProjectText, type PbpProject } from '@caldymos/pb-project-core';

export const PBP_EDITOR_VIEW_TYPE = 'pbProjectFiles.pbpEditor';

function getNonce(): string {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let text = '';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

// scriptUri: webview-safe URI to out/webview/pbp-editor-view.js
function renderHtml(webview: vscode.Webview, document: vscode.TextDocument, project: PbpProject | null, xml: string, scriptUri: vscode.Uri, settings: ProjectEditorSettings, errorText?: string): string {
    const nonce = getNonce();

    // Inline script (bootstrap) is covered by nonce.
    // External bundle is covered by webview.cspSource (served from extension dir).
    const csp = `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource};`;

    const initial = {
        uri: document.uri.toString(),
        fsPath: document.uri.fsPath,
        xml,
        project,
        errorText: errorText ?? null,
    };

    const initialJson = JSON.stringify(initial).replace(/</g, '\\u003c');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PureBasic Project</title>
  <style>
    body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 0; margin: 0; }
    :root { --pbp-inactive-tab-fg: ${settings.inactiveTabForeground || 'var(--vscode-foreground)'}; }
    .toolbar { display: flex; gap: 8px; align-items: center; padding: 8px 10px; border-bottom: 1px solid var(--vscode-editorWidget-border); position: sticky; top: 0; background: var(--vscode-editor-background); z-index: 2; }
    .toolbar button { padding: 4px 10px; }
    .status { opacity: 0.8; }

    .tabs { display: flex; gap: 6px; padding: 8px 10px; border-bottom: 1px solid var(--vscode-editorWidget-border); }
    .tabbtn { padding: 6px 10px; border: 1px solid var(--vscode-editorWidget-border); border-radius: 4px; background: var(--vscode-editorWidget-background); cursor: pointer; }
    .tabbtn.active { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border-color: var(--vscode-button-background); }

    .page { display: none; padding: 10px; }
    .page.active { display: block; }

    .grid2 { display: grid; grid-template-columns: 240px 1fr; gap: 10px 14px; align-items: center; max-width: 1100px; }
    .grid2 label { opacity: 0.95; }
    input[type="text"], input[type="number"], textarea, select { width: 100%; box-sizing: border-box; padding: 4px 6px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border-radius: 3px; }
    textarea { min-height: 90px; resize: vertical; }

    .row { display: grid; grid-template-columns: 280px 1fr; gap: 10px; }
    .panel { border: 1px solid var(--vscode-editorWidget-border); border-radius: 6px; padding: 10px; background: var(--vscode-editorWidget-background); }

    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid var(--vscode-editorWidget-border); padding: 6px 8px; text-align: left; }
    th { background: var(--vscode-editorWidget-background); }

    .subtabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }

    .muted { opacity: 0.75; }
    .error { margin: 10px 0; padding: 8px 10px; border: 1px solid var(--vscode-inputValidation-errorBorder); background: var(--vscode-inputValidation-errorBackground); color: var(--vscode-inputValidation-errorForeground); border-radius: 4px; }

    .btnrow { display:flex; gap:8px; flex-wrap:wrap; }
    .btn { padding: 4px 10px; }
  </style>
</head>
<body>
  <div class="toolbar">
    <button id="btnSave" disabled>Save</button>
    <button id="btnSaveXml" disabled>Save XML</button>
    <span id="status" class="status muted"></span>
  </div>

  <div class="tabs">
    <button class="tabbtn active" data-tab="project">Project Options</button>
    <button class="tabbtn" data-tab="files">Project Files</button>
    <button class="tabbtn" data-tab="targets">Targets</button>
    <button class="tabbtn" data-tab="libraries">Libraries</button>
    <button class="tabbtn" data-tab="xml">Raw XML</button>
  </div>

  <div id="page-project" class="page active"></div>
  <div id="page-files" class="page"></div>
  <div id="page-targets" class="page"></div>
  <div id="page-libraries" class="page"></div>
  <div id="page-xml" class="page"></div>

  <!-- Bootstrap: inject initial state before the external bundle loads. -->
  <script nonce="${nonce}">window.__PBPEDITOR_INITIAL__ = ${initialJson};</script>
  <!-- External webview bundle (built by webviewConfig in webpack.config.js). -->
  <script src="${scriptUri}"></script>
</body>
</html>`;
}

export class PbpEditorProvider implements vscode.CustomTextEditorProvider {
    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new PbpEditorProvider(context);
        return vscode.window.registerCustomEditorProvider(PBP_EDITOR_VIEW_TYPE, provider, {
            webviewOptions: { retainContextWhenHidden: true },
            supportsMultipleEditorsPerDocument: false,
        });
    }

    public constructor(private readonly context: vscode.ExtensionContext) {
        void context;
    }

    public async resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): Promise<void> {
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri],
        };

        // Resolve the external webview bundle URI once per editor instance.
        const scriptUri = webviewPanel.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'pbp-editor-view.js')
        );

        const update = () => {
            const xml = document.getText();
            const settings = readProjectEditorSettings();
            let project: PbpProject | null = null;
            let errorText: string | undefined;
            try {
                project = parsePbpProjectText(xml, document.uri.fsPath);
            } catch (err: any) {
                errorText = err?.message ?? String(err);
            }
            
            webviewPanel.webview.html = renderHtml(webviewPanel.webview, document, project, xml, scriptUri, settings, errorText);
        };

        update();

        // Keep webview in sync if the user edits the text directly.
        const docChangeSub = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() !== document.uri.toString()) return;
            const xml = document.getText();
            let project: PbpProject | null = null;
            let errorText: string | undefined;
            try {
                project = parsePbpProjectText(xml, document.uri.fsPath);
            } catch (err: any) {
                errorText = err?.message ?? String(err);
            }
            void webviewPanel.webview.postMessage({ type: 'state', xml, project, errorText: errorText ?? null });
        });

        const cfgChangeSub = vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(SETTINGS_SECTION)) update();
        });

        webviewPanel.onDidDispose(() => { docChangeSub.dispose(); cfgChangeSub.dispose(); });

        webviewPanel.webview.onDidReceiveMessage(async (msg: any) => {
            if (!msg || typeof msg.type !== 'string') return;

            if (msg.type === 'saveModel') {
                let errorText: string | null = null;
                try {
                    const model = msg.project as PbpProject;
                    const xml = writePbpProjectText(model);
                    await replaceDocumentText(document, xml);
                    await document.save();
                } catch (err: any) {
                    errorText = err?.message ?? 'Unknown error';
                }
                void webviewPanel.webview.postMessage({ type: 'saved', errorText });
                return;
            }

            if (msg.type === 'saveXml') {
                const xml = String(msg.xml ?? '');
                let errorText: string | null = null;
                try {
                    parsePbpProjectText(xml, document.uri.fsPath);
                } catch (err: any) {
                    errorText = err?.message ?? String(err);
                }

                if (errorText) {
                    void webviewPanel.webview.postMessage({ type: 'saved', errorText });
                    return;
                }

                try {
                    await replaceDocumentText(document, xml);
                    await document.save();
                } catch (err: any) {
                    errorText = err?.message ?? 'Unknown error';
                }
                void webviewPanel.webview.postMessage({ type: 'saved', errorText });
                return;
            }

            if (msg.type === 'pickFile') {
                try {
                    const projectDir = path.dirname(document.uri.fsPath);
                    const uris = await vscode.window.showOpenDialog({
                        canSelectMany: false,
                        defaultUri: vscode.Uri.file(projectDir),
                        filters: { 'PureBasic Files': ['pb', 'pbi', 'pbf', 'pbh'] },
                    });
                    if (!uris || uris.length === 0) return;
                    const picked = uris[0];
                    const rel = path.relative(projectDir, picked.fsPath);
                    const isExternal = rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel);
                    const rawPath = isExternal ? picked.fsPath : rel;
                    void webviewPanel.webview.postMessage({ type: 'filePicked', rawPath, fsPath: picked.fsPath });
                } catch (err: any) {
                    void vscode.window.showErrorMessage(`File pick failed: ${err?.message ?? 'Unknown error'}`);
                }
                return;
            }
        });
    }
}

async function replaceDocumentText(document: vscode.TextDocument, text: string): Promise<void> {
    const edit = new vscode.WorkspaceEdit();
    const lastLine = document.lineAt(document.lineCount - 1);
    const fullRange = new vscode.Range(0, 0, document.lineCount - 1, lastLine.text.length);
    edit.replace(document.uri, fullRange, text);
    await vscode.workspace.applyEdit(edit);
}