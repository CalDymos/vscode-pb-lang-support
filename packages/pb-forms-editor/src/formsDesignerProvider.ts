import * as vscode from "vscode";
import { parseFormDocument } from "./core/parser/formParser";
import {
  applyGadgetColumnDelete,
  applyGadgetColumnInsert,
  applyGadgetColumnUpdate,
  applyGadgetItemDelete,
  applyGadgetItemInsert,
  applyGadgetItemUpdate,
  applyMenuEntryDelete,
  applyMenuEntryInsert,
  applyMenuEntryUpdate,
  applyMovePatch,
  applyRectPatch,
  applyStatusBarFieldDelete,
  applyStatusBarFieldInsert,
  applyStatusBarFieldUpdate,
  applyToolBarEntryDelete,
  applyToolBarEntryInsert,
  applyToolBarEntryUpdate,
  applyWindowEnumValuePatch,
  applyWindowVariableNamePatch,
  applyWindowPbAnyToggle,
  applyWindowRectPatch
} from "./core/emitter/patchEmitter";
import { readDesignerSettings, SETTINGS_SECTION, DesignerSettings } from "./settings";
import { FormDocument } from "./core/model";

type WebviewToExtensionMessage =
  | { type: "ready" }
  | { type: "moveGadget"; id: string; x: number; y: number }
  | { type: "setGadgetRect"; id: string; x: number; y: number; w: number; h: number }
  | { type: "setWindowRect"; id: string; x: number; y: number; w: number; h: number }
  | { type: "toggleWindowPbAny"; windowKey: string; toPbAny: boolean; variableName: string; enumSymbol: string; enumValueRaw?: string }
  | { type: "setWindowEnumValue"; enumSymbol: string; enumValueRaw?: string }
  | { type: "setWindowVariableName"; variableName?: string }
  | { type: "insertGadgetItem"; id: string; posRaw: string; textRaw: string; imageRaw?: string; flagsRaw?: string }
  | { type: "updateGadgetItem"; id: string; sourceLine: number; posRaw: string; textRaw: string; imageRaw?: string; flagsRaw?: string }
  | { type: "deleteGadgetItem"; id: string; sourceLine: number }
  | { type: "insertGadgetColumn"; id: string; colRaw: string; titleRaw: string; widthRaw: string }
  | { type: "updateGadgetColumn"; id: string; sourceLine: number; colRaw: string; titleRaw: string; widthRaw: string }
  | { type: "deleteGadgetColumn"; id: string; sourceLine: number }
  | { type: "insertMenuEntry"; menuId: string; kind: string; idRaw?: string; textRaw?: string }
  | { type: "updateMenuEntry"; menuId: string; sourceLine: number; kind: string; idRaw?: string; textRaw?: string }
  | { type: "deleteMenuEntry"; menuId: string; sourceLine: number; kind: string }
  | { type: "insertToolBarEntry"; toolBarId: string; kind: string; idRaw?: string; iconRaw?: string; textRaw?: string }
  | { type: "updateToolBarEntry"; toolBarId: string; sourceLine: number; kind: string; idRaw?: string; iconRaw?: string; textRaw?: string }
  | { type: "deleteToolBarEntry"; toolBarId: string; sourceLine: number; kind: string }
  | { type: "insertStatusBarField"; statusBarId: string; widthRaw: string }
  | { type: "updateStatusBarField"; statusBarId: string; sourceLine: number; widthRaw: string }
  | { type: "deleteStatusBarField"; statusBarId: string; sourceLine: number };

type ExtensionToWebviewMessage =
  | { type: "init"; model: any; settings: DesignerSettings }
  | { type: "settings"; settings: DesignerSettings }
  | { type: "error"; message: string };

export class PureBasicFormDesignerProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = "purebasic.formDesigner";

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    webviewPanel.webview.html = this.getWebviewHtml(webviewPanel.webview);

    const post = (msg: ExtensionToWebviewMessage) => webviewPanel.webview.postMessage(msg);

    let lastModel: FormDocument | undefined;
    let initTimer: ReturnType<typeof setTimeout> | undefined;

    function safeParse(text: string): FormDocument {
      try {
        return parseFormDocument(text);
      } catch (e: any) {
        return {
          window: undefined,
          gadgets: [],
          menus: [],
          toolbars: [],
          statusbars: [],
          meta: {
            scanRange: { start: 0, end: text.length },
            issues: [{ severity: "error", message: e?.message ?? String(e) }]
          }
        };
      }
    }

    const scheduleInit = () => {
      if (initTimer) clearTimeout(initTimer);
      initTimer = setTimeout(() => sendInit(), 200);
    };

    const sendInit = () => {
      try {
        const model = safeParse(document.getText());
        lastModel = model;

        // Optional: warn if the header PB version differs from the configured expectation.
        const expectedPbVersion = vscode.workspace
          .getConfiguration(SETTINGS_SECTION)
          .get<string>("expectedPbVersion", "")
          .trim();

        if (expectedPbVersion.length) {
          const actual = model.meta.header?.version;
          if (!actual) {
            model.meta.issues.push({
              severity: "warning",
              message: `Expected PureBasic version '${expectedPbVersion}', but the Form Designer header has no version.`
            });
          } else if (actual !== expectedPbVersion) {
            model.meta.issues.push({
              severity: "warning",
              message: `Form header version is '${actual}', but 'purebasicFormsDesigner.expectedPbVersion' is set to '${expectedPbVersion}'.`,
              line: model.meta.header?.line
            });
          }
        }

        const settings = readDesignerSettings();
        post({ type: "init", model, settings });
      } catch (e: any) {
        // Keep the webview alive with a minimal model and a structured error.
        const model: FormDocument = {
          window: undefined,
          gadgets: [],
          menus: [],
          toolbars: [],
          statusbars: [],
          meta: {
            scanRange: { start: 0, end: document.getText().length },
            issues: [{ severity: "error", message: e?.message ?? String(e) }]
          }
        };
        lastModel = model;
        post({ type: "init", model, settings: readDesignerSettings() });
      }
    };

    sendInit();

    const cfgSub = vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
      if (e.affectsConfiguration(SETTINGS_SECTION)) {
        post({ type: "settings", settings: readDesignerSettings() });
      }
    });

    const docSub = vscode.workspace.onDidChangeTextDocument((e: any) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        scheduleInit();
      }
    });

    webviewPanel.onDidDispose(() => {
      cfgSub.dispose();
      docSub.dispose();
      if (initTimer) clearTimeout(initTimer);
    });

    webviewPanel.webview.onDidReceiveMessage(async (msg: WebviewToExtensionMessage) => {
      const sr = lastModel?.meta.scanRange;
      const rangeInfo = sr ? ` (scanRange: ${sr.start}-${sr.end})` : "";

      if (msg.type === "ready") {
        sendInit();
        return;
      }

      if (msg.type === "moveGadget") {
        const edit = applyMovePatch(document, msg.id, msg.x, msg.y, sr);
        if (!edit) {
          post({ type: "error", message: `Could not patch gadget '${msg.id}'. No matching call found${rangeInfo}.` });
          return;
        }
        await vscode.workspace.applyEdit(edit);
        return;
      }

      if (msg.type === "setGadgetRect") {
        const edit = applyRectPatch(document, msg.id, msg.x, msg.y, msg.w, msg.h, sr);
        if (!edit) {
          post({ type: "error", message: `Could not patch gadget '${msg.id}'. No matching call found${rangeInfo}.` });
          return;
        }
        await vscode.workspace.applyEdit(edit);
        return;
      }

      if (msg.type === "setWindowRect") {
        const edit = applyWindowRectPatch(document, msg.id, msg.x, msg.y, msg.w, msg.h, sr);
        if (!edit) {
          post({ type: "error", message: `Could not patch window '${msg.id}'. No matching OpenWindow call found${rangeInfo}.` });
          return;
        }
        await vscode.workspace.applyEdit(edit);
        return;
      }

      if (msg.type === "toggleWindowPbAny") {
        const edit = applyWindowPbAnyToggle(
          document,
          msg.windowKey,
          msg.toPbAny,
          msg.variableName,
          msg.enumSymbol,
          msg.enumValueRaw,
          sr
        );
        if (!edit) {
          post({ type: "error", message: `Could not toggle window pbAny. No matching OpenWindow call found${rangeInfo}.` });
          return;
        }
        await vscode.workspace.applyEdit(edit);
        return;
      }

      if (msg.type === "setWindowEnumValue") {
        const edit = applyWindowEnumValuePatch(document, msg.enumSymbol, msg.enumValueRaw, sr);
        if (!edit) {
          post({ type: "error", message: `Could not patch FormWindow enumeration entry '${msg.enumSymbol}'. No Enumeration FormWindow block found${rangeInfo}.` });
          return;
        }
        await vscode.workspace.applyEdit(edit);
        return;
      }

      if (msg.type === "setWindowVariableName") {
        if (msg.variableName === undefined || !msg.variableName.trim().length) {
          post({ type: "error", message: `Could not patch FormWindow variable name. Empty variable name is not allowed${rangeInfo}.` });
          return;
        }
        const edit = applyWindowVariableNamePatch(document, msg.variableName);
        if (!edit) {
          post({ type: "error", message: `Could not patch FormWindow variable name '${msg.variableName}'. No matching OpenWindow call found${rangeInfo}.` });
          return;
        }
        await vscode.workspace.applyEdit(edit);
        return;
      }

      if (msg.type === "insertGadgetItem") {
        const edit = applyGadgetItemInsert(
          document,
          msg.id,
          { posRaw: msg.posRaw, textRaw: msg.textRaw, imageRaw: msg.imageRaw, flagsRaw: msg.flagsRaw },
          sr
        );
        if (!edit) {
          post({ type: "error", message: `Could not insert item for gadget '${msg.id}'. No suitable insertion point found${rangeInfo}.` });
          return;
        }
        await vscode.workspace.applyEdit(edit);
        return;
      }

      if (msg.type === "updateGadgetItem") {
        const edit = applyGadgetItemUpdate(
          document,
          msg.id,
          msg.sourceLine,
          { posRaw: msg.posRaw, textRaw: msg.textRaw, imageRaw: msg.imageRaw, flagsRaw: msg.flagsRaw },
          sr
        );
        if (!edit) {
          post({ type: "error", message: `Could not update item for gadget '${msg.id}'. No matching AddGadgetItem call found${rangeInfo}.` });
          return;
        }
        await vscode.workspace.applyEdit(edit);
        return;
      }

      if (msg.type === "deleteGadgetItem") {
        const edit = applyGadgetItemDelete(document, msg.id, msg.sourceLine, sr);
        if (!edit) {
          post({ type: "error", message: `Could not delete item for gadget '${msg.id}'. No matching AddGadgetItem call found${rangeInfo}.` });
          return;
        }
        await vscode.workspace.applyEdit(edit);
        return;
      }

      if (msg.type === "insertGadgetColumn") {
        const edit = applyGadgetColumnInsert(
          document,
          msg.id,
          { colRaw: msg.colRaw, titleRaw: msg.titleRaw, widthRaw: msg.widthRaw },
          sr
        );
        if (!edit) {
          post({ type: "error", message: `Could not insert column for gadget '${msg.id}'. No suitable insertion point found${rangeInfo}.` });
          return;
        }
        await vscode.workspace.applyEdit(edit);
        return;
      }

      if (msg.type === "updateGadgetColumn") {
        const edit = applyGadgetColumnUpdate(
          document,
          msg.id,
          msg.sourceLine,
          { colRaw: msg.colRaw, titleRaw: msg.titleRaw, widthRaw: msg.widthRaw },
          sr
        );
        if (!edit) {
          post({ type: "error", message: `Could not update column for gadget '${msg.id}'. No matching AddGadgetColumn call found${rangeInfo}.` });
          return;
        }
        await vscode.workspace.applyEdit(edit);
        return;
      }

      if (msg.type === "deleteGadgetColumn") {
        const edit = applyGadgetColumnDelete(document, msg.id, msg.sourceLine, sr);
        if (!edit) {
          post({ type: "error", message: `Could not delete column for gadget '${msg.id}'. No matching AddGadgetColumn call found${rangeInfo}.` });
          return;
        }
        await vscode.workspace.applyEdit(edit);
        return;
      }

      if (msg.type === "insertMenuEntry") {
        const allowed = new Set(["MenuTitle", "MenuItem", "MenuBar", "OpenSubMenu", "CloseSubMenu"]);
        if (!allowed.has(msg.kind)) {
          post({ type: "error", message: `Unsupported menu entry kind '${msg.kind}'.` });
          return;
        }
        const edit = applyMenuEntryInsert(
          document,
          msg.menuId,
          { kind: msg.kind as any, idRaw: msg.idRaw, textRaw: msg.textRaw },
          sr
        );
        if (!edit) {
          post({ type: "error", message: `Could not insert menu entry for menu '${msg.menuId}'. No suitable insertion point found${rangeInfo}.` });
          return;
        }
        await vscode.workspace.applyEdit(edit);
        return;
      }

      if (msg.type === "updateMenuEntry") {
        const allowed = new Set(["MenuTitle", "MenuItem", "MenuBar", "OpenSubMenu", "CloseSubMenu"]);
        if (!allowed.has(msg.kind)) {
          post({ type: "error", message: `Unsupported menu entry kind '${msg.kind}'.` });
          return;
        }
        const edit = applyMenuEntryUpdate(
          document,
          msg.menuId,
          msg.sourceLine,
          { kind: msg.kind as any, idRaw: msg.idRaw, textRaw: msg.textRaw },
          sr
        );
        if (!edit) {
          post({ type: "error", message: `Could not update menu entry for menu '${msg.menuId}'. No matching call found${rangeInfo}.` });
          return;
        }
        await vscode.workspace.applyEdit(edit);
        return;
      }

      if (msg.type === "deleteMenuEntry") {
        const allowed = new Set(["MenuTitle", "MenuItem", "MenuBar", "OpenSubMenu", "CloseSubMenu"]);
        if (!allowed.has(msg.kind)) {
          post({ type: "error", message: `Unsupported menu entry kind '${msg.kind}'.` });
          return;
        }
        const edit = applyMenuEntryDelete(document, msg.menuId, msg.sourceLine, msg.kind as any, sr);
        if (!edit) {
          post({ type: "error", message: `Could not delete menu entry for menu '${msg.menuId}'. No matching call found${rangeInfo}.` });
          return;
        }
        await vscode.workspace.applyEdit(edit);
        return;
      }

      if (msg.type === "insertToolBarEntry") {
        const allowed = new Set(["ToolBarStandardButton", "ToolBarButton", "ToolBarSeparator", "ToolBarToolTip"]);
        if (!allowed.has(msg.kind)) {
          post({ type: "error", message: `Unsupported toolbar entry kind '${msg.kind}'.` });
          return;
        }
        const edit = applyToolBarEntryInsert(
          document,
          msg.toolBarId,
          { kind: msg.kind as any, idRaw: msg.idRaw, iconRaw: msg.iconRaw, textRaw: msg.textRaw },
          sr
        );
        if (!edit) {
          post({ type: "error", message: `Could not insert toolbar entry for toolbar '${msg.toolBarId}'. No suitable insertion point found${rangeInfo}.` });
          return;
        }
        await vscode.workspace.applyEdit(edit);
        return;
      }

      if (msg.type === "updateToolBarEntry") {
        const allowed = new Set(["ToolBarStandardButton", "ToolBarButton", "ToolBarSeparator", "ToolBarToolTip"]);
        if (!allowed.has(msg.kind)) {
          post({ type: "error", message: `Unsupported toolbar entry kind '${msg.kind}'.` });
          return;
        }
        const edit = applyToolBarEntryUpdate(
          document,
          msg.toolBarId,
          msg.sourceLine,
          { kind: msg.kind as any, idRaw: msg.idRaw, iconRaw: msg.iconRaw, textRaw: msg.textRaw },
          sr
        );
        if (!edit) {
          post({ type: "error", message: `Could not update toolbar entry for toolbar '${msg.toolBarId}'. No matching call found${rangeInfo}.` });
          return;
        }
        await vscode.workspace.applyEdit(edit);
        return;
      }

      if (msg.type === "deleteToolBarEntry") {
        const allowed = new Set(["ToolBarStandardButton", "ToolBarButton", "ToolBarSeparator", "ToolBarToolTip"]);
        if (!allowed.has(msg.kind)) {
          post({ type: "error", message: `Unsupported toolbar entry kind '${msg.kind}'.` });
          return;
        }
        const edit = applyToolBarEntryDelete(document, msg.toolBarId, msg.sourceLine, msg.kind as any, sr);
        if (!edit) {
          post({ type: "error", message: `Could not delete toolbar entry for toolbar '${msg.toolBarId}'. No matching call found${rangeInfo}.` });
          return;
        }
        await vscode.workspace.applyEdit(edit);
        return;
      }

      if (msg.type === "insertStatusBarField") {
        const edit = applyStatusBarFieldInsert(document, msg.statusBarId, { widthRaw: msg.widthRaw }, sr);
        if (!edit) {
          post({ type: "error", message: `Could not insert statusbar field for statusbar '${msg.statusBarId}'. No suitable insertion point found${rangeInfo}.` });
          return;
        }
        await vscode.workspace.applyEdit(edit);
        return;
      }

      if (msg.type === "updateStatusBarField") {
        const edit = applyStatusBarFieldUpdate(document, msg.statusBarId, msg.sourceLine, { widthRaw: msg.widthRaw }, sr);
        if (!edit) {
          post({ type: "error", message: `Could not update statusbar field for statusbar '${msg.statusBarId}'. No matching AddStatusBarField call found${rangeInfo}.` });
          return;
        }
        await vscode.workspace.applyEdit(edit);
        return;
      }

      if (msg.type === "deleteStatusBarField") {
        const edit = applyStatusBarFieldDelete(document, msg.statusBarId, msg.sourceLine, sr);
        if (!edit) {
          post({ type: "error", message: `Could not delete statusbar field for statusbar '${msg.statusBarId}'. No matching AddStatusBarField call found${rangeInfo}.` });
          return;
        }
        await vscode.workspace.applyEdit(edit);
        return;
      }
    });
  }

  private getWebviewHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "out", "webview", "main.js")
    );
    const nonce = getNonce();

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy"
      content="default-src 'none';
               img-src ${webview.cspSource} data:;
               style-src ${webview.cspSource} 'unsafe-inline';
               script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PureBasic Form Designer</title>
    <style>
      :root {
        color-scheme: light dark;
        --pbfd-canvas-bg: var(--vscode-editor-background);
        --pbfd-readonly-bg: var(--vscode-readonly-input-background);
      }

      body {
        margin: 0;
        padding: 0;
        font-family: system-ui, -apple-system, Segoe UI, sans-serif;
        background: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
      }

      .root {
        display: grid;
        grid-template-columns: 1fr 360px;
        height: 100vh;
      }

      .canvasWrap {
        position: relative;
        overflow: hidden;
        background: var(--pbfd-canvas-bg);
      }

      canvas {
        width: 100%;
        height: 100%;
        display: block;
      }

      .panel {
        border-left: 1px solid var(--vscode-panel-border);
        background: var(--vscode-sideBar-background);
        color: var(--vscode-sideBar-foreground);
        padding: 10px;
        overflow: auto;
      }

      .row {
        display: grid;
        grid-template-columns: 110px 1fr;
        gap: 8px;
        margin-bottom: 8px;
        align-items: center;
      }

      input, select, button {
        width: 100%;
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        padding: 2px 6px;
      }

      input[readonly] {
        background: var(--pbfd-readonly-bg);
      }        

      button {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: 1px solid var(--vscode-button-border);
        cursor: pointer;
        padding: 6px 8px;
      }

      button:hover {
        background: var(--vscode-button-hoverBackground);
      }

      .list { margin-top: 12px; }

      .treeItem {
        display: grid;
        grid-template-columns: 18px 1fr;
        align-items: center;
        padding: 6px 8px;
        border-radius: 8px;
        cursor: pointer;
        user-select: none;
      }

      .treeItem:hover {
        background: var(--vscode-list-hoverBackground);
      }

      .treeItem.sel {
        background: var(--vscode-list-activeSelectionBackground);
        color: var(--vscode-list-activeSelectionForeground);
      }

      .twisty {
        text-align: center;
        opacity: .9;
      }

      .muted { opacity: .75; font-size: 12px; }

      .diag {
        margin: 10px 0 8px;
        padding: 8px;
        border-radius: 8px;
        border: 1px solid var(--vscode-panel-border);
        background: var(--vscode-editorWidget-background);
        color: var(--vscode-editorWidget-foreground);
      }

      .diag .row { display: flex; gap: 8px; align-items: flex-start; margin: 4px 0; }
      .diag .sev { width: 18px; text-align: center; }
      .diag .msg { flex: 1; }

      .sev.warn { color: var(--vscode-notificationsWarningIcon-foreground); }
      .sev.err { color: var(--vscode-notificationsErrorIcon-foreground); }
      .sev.info { color: var(--vscode-notificationsInfoIcon-foreground); }

      .err {
        color: #b00020;
        font-size: 12px;
        white-space: pre-wrap;
      }

      .subHeader { margin-top: 10px; font-weight: 600; }

      .miniList {
        border: 1px solid var(--vscode-panel-border);
        border-radius: 8px;
        padding: 8px;
        margin: 8px 0;
        background: var(--vscode-editorWidget-background);
      }

      .miniRow {
        display: grid;
        grid-template-columns: 1fr 56px 56px;
        gap: 6px;
        align-items: center;
        margin: 4px 0;
        font-size: 12px;
      }

      .miniRow button {
        width: 100%;
        padding: 2px 6px;
        font-size: 12px;
      }

      .miniActions {
        display: flex;
        gap: 6px;
        margin-top: 6px;
      }

      .miniActions button {
        flex: 1;
      }
    </style>
  </head>
  <body>
    <div class="root">
      <div class="canvasWrap"><canvas id="designer"></canvas></div>
      <div class="panel">
        <div id="diag" class="diag" style="display:none"></div>

        <div><b>Properties</b></div>
        <div class="muted">Drag/resize gadgets. Items/Columns patching is supported for AddGadgetItem/AddGadgetColumn.</div>
        <div id="props"></div>

        <div class="list">
          <div><b>Hierarchy</b></div>
          <div class="muted" style="margin:6px 0 8px">Select Parent lets you quickly navigate to a container/root.</div>
          <div class="row" style="grid-template-columns: 110px 1fr;">
            <div>Select Parent</div>
            <select id="parentSel"></select>
          </div>
          <div id="list"></div>
        </div>

        <div id="err" class="err"></div>
      </div>
    </div>

    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
