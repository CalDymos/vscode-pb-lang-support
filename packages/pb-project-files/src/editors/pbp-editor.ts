/*
    Provides a read-only custom editor for PureBasic .pbp project files.
*/

import * as vscode from 'vscode';

import { parsePbpProjectText, type PbpProject } from '@caldymos/pb-project-core';

export const PBP_EDITOR_VIEW_TYPE = 'pbProjectFiles.pbpEditor';

class PbpDocument implements vscode.CustomDocument {
    public constructor(public readonly uri: vscode.Uri) {}

    public dispose(): void {
        // No resources to release.
    }
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderProjectHtml(project: PbpProject | null, errorText?: string): string {
    const title = project?.config?.name?.trim() ? project.config.name : (project ? project.projectFile : 'PureBasic Project');
    const projFile = project?.projectFile ?? '';
    const projDir = project?.projectDir ?? '';
    const targets = project?.targets ?? [];
    const files = project?.files ?? [];
    const libs = project?.libraries ?? [];

    const targetRows = targets.length
        ? targets.map(t => `<tr><td>${escapeHtml(t.name)}</td><td>${t.enabled ? 'Yes' : 'No'}</td><td>${t.isDefault ? 'Yes' : 'No'}</td></tr>`).join('')
        : `<tr><td colspan="3"><em>No targets found.</em></td></tr>`;

    const fileRows = files.length
        ? files.slice(0, 200).map(f => `<li title="${escapeHtml(f.fsPath)}">${escapeHtml(f.rawPath)}</li>`).join('')
        : `<li><em>No files listed.</em></li>`;

    const libRows = libs.length
        ? libs.map(l => `<li>${escapeHtml(l)}</li>`).join('')
        : `<li><em>No libraries listed.</em></li>`;

    const errorBlock = errorText
        ? `<div class="error"><strong>Parse error:</strong> ${escapeHtml(errorText)}</div>`
        : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background: var(--vscode-editor-background); }
    h1 { font-size: 18px; margin: 0 0 12px; }
    h2 { font-size: 14px; margin: 18px 0 8px; }
    .muted { opacity: 0.8; }
    .grid { display: grid; grid-template-columns: 140px 1fr; gap: 6px 12px; }
    code { background: var(--vscode-textCodeBlock-background); padding: 1px 4px; border-radius: 3px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid var(--vscode-editorWidget-border); padding: 6px 8px; text-align: left; }
    th { background: var(--vscode-editorWidget-background); }
    ul { margin: 6px 0 0; padding-left: 18px; }
    .error { margin: 10px 0; padding: 8px 10px; border: 1px solid var(--vscode-inputValidation-errorBorder); background: var(--vscode-inputValidation-errorBackground); color: var(--vscode-inputValidation-errorForeground); border-radius: 4px; }
    .hint { margin-top: 10px; padding: 8px 10px; border: 1px dashed var(--vscode-editorWidget-border); border-radius: 4px; }
  </style>
</head>
<body>
  <h1>PureBasic Project <span class="muted">(Preview)</span></h1>
  ${errorBlock}
  <div class="grid">
    <div>Project:</div><div><code>${escapeHtml(title)}</code></div>
    <div>File:</div><div class="muted">${escapeHtml(projFile)}</div>
    <div>Directory:</div><div class="muted">${escapeHtml(projDir)}</div>
    <div>Targets:</div><div class="muted">${targets.length}</div>
    <div>Files:</div><div class="muted">${files.length}</div>
  </div>

  <h2>Targets</h2>
  <table>
    <thead>
      <tr><th>Name</th><th>Enabled</th><th>Default</th></tr>
    </thead>
    <tbody>
      ${targetRows}
    </tbody>
  </table>

  <h2>Files (first 200)</h2>
  <ul>
    ${fileRows}
  </ul>

  <h2>Libraries</h2>
  <ul>
    ${libRows}
  </ul>

  <div class="hint">
    <strong>Tip:</strong> Use <em>Reopen Editor With...</em> → <em>Text Editor</em> to edit the raw .pbp XML.
  </div>
</body>
</html>`;
}

export class PbpReadonlyEditorProvider implements vscode.CustomReadonlyEditorProvider<PbpDocument> {
    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new PbpReadonlyEditorProvider(context);
        return vscode.window.registerCustomEditorProvider(PBP_EDITOR_VIEW_TYPE, provider, {
            webviewOptions: { retainContextWhenHidden: true },
            supportsMultipleEditorsPerDocument: false,
        });
    }

    public constructor(private readonly context: vscode.ExtensionContext) {}

    public async openCustomDocument(uri: vscode.Uri): Promise<PbpDocument> {
        return new PbpDocument(uri);
    }

    public async resolveCustomEditor(document: PbpDocument, webviewPanel: vscode.WebviewPanel): Promise<void> {
        webviewPanel.webview.options = {
            enableScripts: false,
            localResourceRoots: [this.context.extensionUri],
        };

        let project: PbpProject | null = null;
        let errorText: string | undefined;

        try {
            const bytes = await vscode.workspace.fs.readFile(document.uri);
            const content = Buffer.from(bytes).toString('utf8');
            project = parsePbpProjectText(content, document.uri.fsPath);
        } catch (err: any) {
            errorText = err?.message ?? String(err);
        }

        webviewPanel.webview.html = renderProjectHtml(project, errorText);
    }
}
