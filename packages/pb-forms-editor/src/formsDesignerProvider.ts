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
import { FormDocument, PBFD_SYMBOLS } from "./core/model";

const CONFIG_KEYS = {
  expectedPbVersion: "expectedPbVersion"
} as const;

const ALLOWED_MENU_ENTRY_KINDS: ReadonlySet<string> = new Set(PBFD_SYMBOLS.menuEntryKinds);
const ALLOWED_TOOLBAR_ENTRY_KINDS: ReadonlySet<string> = new Set(PBFD_SYMBOLS.toolBarEntryKinds);

const EXT_TO_WEBVIEW_MSG_TYPE = {
  init: "init",
  settings: "settings",
  error: "error"
} as const;

const WEBVIEW_TO_EXT_MSG_TYPE = {
  ready: "ready",

  moveGadget: "moveGadget",
  setGadgetRect: "setGadgetRect",
  setWindowRect: "setWindowRect",
  toggleWindowPbAny: "toggleWindowPbAny",
  setWindowEnumValue: "setWindowEnumValue",
  setWindowVariableName: "setWindowVariableName",

  insertGadgetItem: "insertGadgetItem",
  updateGadgetItem: "updateGadgetItem",
  deleteGadgetItem: "deleteGadgetItem",

  insertGadgetColumn: "insertGadgetColumn",
  updateGadgetColumn: "updateGadgetColumn",
  deleteGadgetColumn: "deleteGadgetColumn",

  insertMenuEntry: "insertMenuEntry",
  updateMenuEntry: "updateMenuEntry",
  deleteMenuEntry: "deleteMenuEntry",

  insertToolBarEntry: "insertToolBarEntry",
  updateToolBarEntry: "updateToolBarEntry",
  deleteToolBarEntry: "deleteToolBarEntry",

  insertStatusBarField: "insertStatusBarField",
  updateStatusBarField: "updateStatusBarField",
  deleteStatusBarField: "deleteStatusBarField"
} as const;

type WebviewToExtensionMessage =
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.ready }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.moveGadget; id: string; x: number; y: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setGadgetRect; id: string; x: number; y: number; w: number; h: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setWindowRect; id: string; x: number; y: number; w: number; h: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.toggleWindowPbAny; windowKey: string; toPbAny: boolean; variableName: string; enumSymbol: string; enumValueRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setWindowEnumValue; enumSymbol: string; enumValueRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setWindowVariableName; variableName?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.insertGadgetItem; id: string; posRaw: string; textRaw: string; imageRaw?: string; flagsRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.updateGadgetItem; id: string; sourceLine: number; posRaw: string; textRaw: string; imageRaw?: string; flagsRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.deleteGadgetItem; id: string; sourceLine: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.insertGadgetColumn; id: string; colRaw: string; titleRaw: string; widthRaw: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.updateGadgetColumn; id: string; sourceLine: number; colRaw: string; titleRaw: string; widthRaw: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.deleteGadgetColumn; id: string; sourceLine: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.insertMenuEntry; menuId: string; kind: string; idRaw?: string; textRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.updateMenuEntry; menuId: string; sourceLine: number; kind: string; idRaw?: string; textRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.deleteMenuEntry; menuId: string; sourceLine: number; kind: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.insertToolBarEntry; toolBarId: string; kind: string; idRaw?: string; iconRaw?: string; textRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.updateToolBarEntry; toolBarId: string; sourceLine: number; kind: string; idRaw?: string; iconRaw?: string; textRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.deleteToolBarEntry; toolBarId: string; sourceLine: number; kind: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.insertStatusBarField; statusBarId: string; widthRaw: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.updateStatusBarField; statusBarId: string; sourceLine: number; widthRaw: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.deleteStatusBarField; statusBarId: string; sourceLine: number };

type ExtensionToWebviewMessage =
  | { type: typeof EXT_TO_WEBVIEW_MSG_TYPE.init; model: any; settings: DesignerSettings }
  | { type: typeof EXT_TO_WEBVIEW_MSG_TYPE.settings; settings: DesignerSettings }
  | { type: typeof EXT_TO_WEBVIEW_MSG_TYPE.error; message: string };

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

    function createErrorModel(textLen: number, message: string): FormDocument {
      return {
        window: undefined,
        gadgets: [],
        menus: [],
        toolbars: [],
        statusbars: [],
        meta: {
          scanRange: { start: 0, end: textLen },
          issues: [{ severity: "error", message }]
        }
      };
    }

    function safeParse(text: string): FormDocument {
      try {
        return parseFormDocument(text);
      } catch (e: any) {
        return createErrorModel(text.length, e?.message ?? String(e));
      }
    }

    const scheduleInit = () => {
      if (initTimer) clearTimeout(initTimer);
      initTimer = setTimeout(() => sendInit(), 200);
    };

    const sendInit = () => {
      const text = document.getText();

      try {
        const model = safeParse(text);
        lastModel = model;

        // Optional: warn if the header PB version differs from the configured expectation.
        const expectedPbVersion = vscode.workspace
          .getConfiguration(SETTINGS_SECTION)
          .get<string>(CONFIG_KEYS.expectedPbVersion, "")
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
        const model = createErrorModel(text.length, e?.message ?? String(e));
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

    const docSub = vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
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
      const postError = (message: string) => post({ type: "error", message });

      const applyEditOrError = async (edit: vscode.WorkspaceEdit | undefined, errorMessage: string) => {
        if (!edit) {
          postError(errorMessage);
          return false;
        }
        await vscode.workspace.applyEdit(edit);
        return true;
      };

      const ensureMenuEntryKind = (kind: string): boolean => {
        if (ALLOWED_MENU_ENTRY_KINDS.has(kind)) return true;
        postError(`Unsupported menu entry kind '${kind}'.`);
        return false;
      };

      const ensureToolBarEntryKind = (kind: string): boolean => {
        if (ALLOWED_TOOLBAR_ENTRY_KINDS.has(kind)) return true;
        postError(`Unsupported toolbar entry kind '${kind}'.`);
        return false;
      };

      switch (msg.type) {
        case WEBVIEW_TO_EXT_MSG_TYPE.ready:
          sendInit();
          return;

        case WEBVIEW_TO_EXT_MSG_TYPE.moveGadget: {
          const edit = applyMovePatch(document, msg.id, msg.x, msg.y, sr);
          await applyEditOrError(edit, `Could not patch gadget '${msg.id}'. No matching call found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.setGadgetRect: {
          const edit = applyRectPatch(document, msg.id, msg.x, msg.y, msg.w, msg.h, sr);
          await applyEditOrError(edit, `Could not patch gadget '${msg.id}'. No matching call found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.setWindowRect: {
          const edit = applyWindowRectPatch(document, msg.id, msg.x, msg.y, msg.w, msg.h, sr);
          await applyEditOrError(edit, `Could not patch window '${msg.id}'. No matching OpenWindow call found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.toggleWindowPbAny: {
          const edit = applyWindowPbAnyToggle(
            document,
            msg.windowKey,
            msg.toPbAny,
            msg.variableName,
            msg.enumSymbol,
            msg.enumValueRaw,
            sr
          );
          await applyEditOrError(edit, `Could not toggle window pbAny. No matching OpenWindow call found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.setWindowEnumValue: {
          const edit = applyWindowEnumValuePatch(document, msg.enumSymbol, msg.enumValueRaw, sr);
          await applyEditOrError(
            edit,
            `Could not patch FormWindow enumeration entry '${msg.enumSymbol}'. No Enumeration FormWindow block found${rangeInfo}.`
          );
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.setWindowVariableName: {
          if (msg.variableName === undefined || !msg.variableName.trim().length) {
            postError(`Could not patch FormWindow variable name. Empty variable name is not allowed${rangeInfo}.`);
            return;
          }
          const edit = applyWindowVariableNamePatch(document, msg.variableName);
          await applyEditOrError(
            edit,
            `Could not patch FormWindow variable name '${msg.variableName}'. No matching OpenWindow call found${rangeInfo}.`
          );
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.insertGadgetItem: {
          const edit = applyGadgetItemInsert(
            document,
            msg.id,
            { posRaw: msg.posRaw, textRaw: msg.textRaw, imageRaw: msg.imageRaw, flagsRaw: msg.flagsRaw },
            sr
          );
          await applyEditOrError(edit, `Could not insert item for gadget '${msg.id}'. No suitable insertion point found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.updateGadgetItem: {
          const edit = applyGadgetItemUpdate(
            document,
            msg.id,
            msg.sourceLine,
            { posRaw: msg.posRaw, textRaw: msg.textRaw, imageRaw: msg.imageRaw, flagsRaw: msg.flagsRaw },
            sr
          );
          await applyEditOrError(edit, `Could not update item for gadget '${msg.id}'. No matching AddGadgetItem call found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.deleteGadgetItem: {
          const edit = applyGadgetItemDelete(document, msg.id, msg.sourceLine, sr);
          await applyEditOrError(edit, `Could not delete item for gadget '${msg.id}'. No matching AddGadgetItem call found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.insertGadgetColumn: {
          const edit = applyGadgetColumnInsert(document, msg.id, { colRaw: msg.colRaw, titleRaw: msg.titleRaw, widthRaw: msg.widthRaw }, sr);
          await applyEditOrError(edit, `Could not insert column for gadget '${msg.id}'. No suitable insertion point found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.updateGadgetColumn: {
          const edit = applyGadgetColumnUpdate(
            document,
            msg.id,
            msg.sourceLine,
            { colRaw: msg.colRaw, titleRaw: msg.titleRaw, widthRaw: msg.widthRaw },
            sr
          );
          await applyEditOrError(edit, `Could not update column for gadget '${msg.id}'. No matching AddGadgetColumn call found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.deleteGadgetColumn: {
          const edit = applyGadgetColumnDelete(document, msg.id, msg.sourceLine, sr);
          await applyEditOrError(edit, `Could not delete column for gadget '${msg.id}'. No matching AddGadgetColumn call found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.insertMenuEntry: {
          if (!ensureMenuEntryKind(msg.kind)) return;
          const edit = applyMenuEntryInsert(document, msg.menuId, { kind: msg.kind as any, idRaw: msg.idRaw, textRaw: msg.textRaw }, sr);
          await applyEditOrError(edit, `Could not insert menu entry for menu '${msg.menuId}'. No suitable insertion point found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.updateMenuEntry: {
          if (!ensureMenuEntryKind(msg.kind)) return;
          const edit = applyMenuEntryUpdate(
            document,
            msg.menuId,
            msg.sourceLine,
            { kind: msg.kind as any, idRaw: msg.idRaw, textRaw: msg.textRaw },
            sr
          );
          await applyEditOrError(edit, `Could not update menu entry for menu '${msg.menuId}'. No matching call found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.deleteMenuEntry: {
          if (!ensureMenuEntryKind(msg.kind)) return;
          const edit = applyMenuEntryDelete(document, msg.menuId, msg.sourceLine, msg.kind as any, sr);
          await applyEditOrError(edit, `Could not delete menu entry for menu '${msg.menuId}'. No matching call found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.insertToolBarEntry: {
          if (!ensureToolBarEntryKind(msg.kind)) return;
          const edit = applyToolBarEntryInsert(
            document,
            msg.toolBarId,
            { kind: msg.kind as any, idRaw: msg.idRaw, iconRaw: msg.iconRaw, textRaw: msg.textRaw },
            sr
          );
          await applyEditOrError(edit, `Could not insert toolbar entry for toolbar '${msg.toolBarId}'. No suitable insertion point found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.updateToolBarEntry: {
          if (!ensureToolBarEntryKind(msg.kind)) return;
          const edit = applyToolBarEntryUpdate(
            document,
            msg.toolBarId,
            msg.sourceLine,
            { kind: msg.kind as any, idRaw: msg.idRaw, iconRaw: msg.iconRaw, textRaw: msg.textRaw },
            sr
          );
          await applyEditOrError(edit, `Could not update toolbar entry for toolbar '${msg.toolBarId}'. No matching call found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.deleteToolBarEntry: {
          if (!ensureToolBarEntryKind(msg.kind)) return;
          const edit = applyToolBarEntryDelete(document, msg.toolBarId, msg.sourceLine, msg.kind as any, sr);
          await applyEditOrError(edit, `Could not delete toolbar entry for toolbar '${msg.toolBarId}'. No matching call found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.insertStatusBarField: {
          const edit = applyStatusBarFieldInsert(document, msg.statusBarId, { widthRaw: msg.widthRaw }, sr);
          await applyEditOrError(edit, `Could not insert statusbar field for statusbar '${msg.statusBarId}'. No suitable insertion point found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.updateStatusBarField: {
          const edit = applyStatusBarFieldUpdate(document, msg.statusBarId, msg.sourceLine, { widthRaw: msg.widthRaw }, sr);
          await applyEditOrError(
            edit,
            `Could not update statusbar field for statusbar '${msg.statusBarId}'. No matching AddStatusBarField call found${rangeInfo}.`
          );
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.deleteStatusBarField: {
          const edit = applyStatusBarFieldDelete(document, msg.statusBarId, msg.sourceLine, sr);
          await applyEditOrError(
            edit,
            `Could not delete statusbar field for statusbar '${msg.statusBarId}'. No matching AddStatusBarField call found${rangeInfo}.`
          );
          return;
        }

        default:
          return;
      }
    });
  }

  private getWebviewHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "out", "webview", "main.js")
    );
    const nonce = getNonce();
    const symbolsJson = JSON.stringify(PBFD_SYMBOLS);

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

    <script nonce="${nonce}">window.__PBFD_SYMBOLS__ = ${symbolsJson};</script>
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
