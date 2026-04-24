import * as cp from "child_process";
import * as vscode from "vscode";
import { EXT_TO_WEBVIEW_MSG_TYPE, WEBVIEW_TO_EXT_MSG_TYPE, type ExtensionToWebviewMessage, type WebviewToExtensionMessage, type WindowsRegistryColors } from "./shared/messages";
import { parseFormDocument } from "./core/parser/form-parser";
import { extractProcedureNamesFromText } from "./core/parser/procedure-scanner";
import {
  applyGadgetColumnDelete,
  applyGadgetColumnInsert,
  applyGadgetColumnUpdate,
  applyGadgetDelete,
  applyGadgetInsert,
  applyGadgetReparent,
  applyGadgetOpenArgsUpdate,
  applyCustomGadgetCodeUpdate,
  applyGadgetPropertyUpdate,
  applyImageDelete,
  applyImageInsert,
  applyImageUpdate,
  applyGadgetEventProcUpdate,
  applyGadgetItemDelete,
  applyGadgetItemInsert,
  applyGadgetItemUpdate,
  applyMenuDelete,
  applyMenuEntryDelete,
  applyMenuEntryEventUpdate,
  applyMenuEntryInsert,
  applyMenuEntryMove,
  applyMenuEntryUpdate,
  applyMovePatch,
  applyRectPatch,
  applyResizeGadgetMutation,
  applyStatusBarDelete,
  applyStatusBarFieldDelete,
  applyStatusBarFieldInsert,
  applyStatusBarFieldUpdate,
  applyToolBarDelete,
  applyToolBarEntryDelete,
  applyToolBarEntryEventUpdate,
  applyToolBarEntryInsert,
  applyToolBarEntryTooltipSet,
  applyToolBarEntryUpdate,
  applyWindowEnumValuePatch,
  applyWindowEventProcUpdate,
  applyWindowEventUpdate,
  applyWindowGenerateEventLoopUpdate,
  applyWindowOpenArgsUpdate,
  applyWindowPropertyUpdate,
  applyWindowVariableNamePatch,
  applyWindowPbAnyToggle,
  applyWindowRectPatch,
  applyGadgetPbAnyToggle,
  applyGadgetEnumValuePatch,
  applyGadgetVariableNamePatch,
  buildImageIdReference,
  toPbAnyAssignedVar,
  toEnumImageId,
  GadgetPropertyArgs,
  WindowPropertyArgs
} from "./core/emitter/patch-emitter";
import { readDesignerSettings, SETTINGS_SECTION } from "./config/settings";
import { FormDocument, PBFD_SYMBOLS, PB_ANY, GADGET_KIND } from "./core/model";
import { buildInsertedGadgetIdentity, insertedGadgetHasAmbiguousEmptyTextDefault, isInsertableGadgetKind, shouldInsertGadgetAsPbAny } from "./core/gadget/insert";
import { applyConfiguredFormVersionWarnings, applyGadgetCaptionVariableSessionOverrides, isAmbiguousEmptyTextLiteral } from "./core/utils/form-settings-runtime";
import { getToolboxPanelCategories } from "./core/toolbox/panel";
import { relativizeImagePath, toPbFilePathLiteral } from "./core/image/path";
import { buildImageReferenceFromEntry, resolveExistingLoadImageByFilePath } from "./core/image/assignment";
import { readImageDimensions } from "./core/image/dimension";
import {
  resolveFixedProcedureSourcePaths,
  readProcedureSourceTextAsync,
  MAX_PROCEDURE_FILE_BYTES,
  isProcedureSourceFilePath,
  resolveProcedureEventFilePath,
  sortUniqueProcedureNames
} from "./core/procedures/list";
import {
  PB_WRONG_VARIABLE_NAME_MESSAGE,
  isValidPbVariableReference,
  requiresPbVariableValidation
} from "./core/utils/property-validation";
import {
  parseWindowColorInspectorInput,
  WINDOW_COLOR_LITERAL_ERROR_MESSAGE
} from "./core/window/color-inspector";
import {
  normalizeStatusBarProgressRaw,
  parseStatusBarWidthInspectorInput,
  STATUSBAR_WIDTH_IGNORE_LITERAL
} from "./core/statusbar/inspector";

const CONFIG_KEYS = {
  expectedPbVersion: "expectedPbVersion"
} as const;

const ALLOWED_MENU_ENTRY_KINDS: ReadonlySet<string> = new Set(PBFD_SYMBOLS.menuEntryKinds);
const ALLOWED_TOOLBAR_ENTRY_KINDS: ReadonlySet<string> = new Set(PBFD_SYMBOLS.toolBarEntryKinds);

function normalizeStatusBarFieldMessageArgs(args: { widthRaw: string; progressBar?: boolean; progressRaw?: string; textRaw?: string; imageRaw?: string; flagsRaw?: string }) {
  const parsedWidth = parseStatusBarWidthInspectorInput(args.widthRaw);
  if (!parsedWidth.ok) {
    return { ok: false as const, error: `StatusBar width accepts only a non-negative integer or ${STATUSBAR_WIDTH_IGNORE_LITERAL}.` };
  }

  const normalizedArgs: {
    widthRaw: string;
    progressBar?: boolean;
    progressRaw?: string;
    textRaw?: string;
    imageRaw?: string;
    flagsRaw?: string;
  } = {
    ...args,
    widthRaw: parsedWidth.raw,
  };

  if (args.progressBar !== undefined || args.progressRaw !== undefined) {
    const progressBar = Boolean(args.progressBar);
    normalizedArgs.progressBar = progressBar;
    normalizedArgs.progressRaw = normalizeStatusBarProgressRaw(progressBar, args.progressRaw);
  }

  return {
    ok: true as const,
    args: normalizedArgs
  };
}

function normalizeFsPathForCompare(filePath: string): string {
  const normalized = vscode.Uri.file(filePath).fsPath;
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function isSameFsPath(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) return false;
  return normalizeFsPathForCompare(left) === normalizeFsPathForCompare(right);
}

/** Glob exclude pattern for vscode.workspace.findFiles during procedure discovery. */
const PROCEDURE_FIND_EXCLUDE =
  "{**/.git/**,**/.hg/**,**/.svn/**,**/coverage/**,**/dist/**,**/node_modules/**,**/out/**,**/out-test/**}";

/** Safety cap: do not scan more than this many .pb/.pbi files per workspace. */
const PROCEDURE_FIND_MAX_RESULTS = 5_000;

/**
 * Asynchronously collects all procedure names visible from a form document.
 * Uses vscode.workspace.findFiles for non-blocking workspace traversal and
 * fs.promises for non-blocking file reads. Respects the cancellation token so
 * that a superseded refresh can be aborted early.
 */
async function collectProcedureNamesAsync(
  documentPath: string,
  documentText: string,
  eventFile: string | undefined,
  workspaceRoot: string | undefined,
  token: vscode.CancellationToken
): Promise<string[]> {
  const names: string[] = [];

  // 1. Fixed paths: documentPath itself + the eventFile (always scanned first).
  const fixedPaths = resolveFixedProcedureSourcePaths(documentPath, eventFile);
  for (const filePath of fixedPaths) {
    if (token.isCancellationRequested) return [];
    let text: string | undefined;
    if (isSameFsPath(filePath, documentPath)) {
      text = documentText;
    } else {
      const openDoc = vscode.workspace.textDocuments.find(
        d => d.uri.scheme === "file" && isSameFsPath(d.uri.fsPath, filePath)
      );
      text = openDoc ? openDoc.getText() : await readProcedureSourceTextAsync(filePath);
    }
    if (text) names.push(...extractProcedureNamesFromText(text));
  }

  // 2. Workspace-wide scan via vscode.workspace.findFiles (non-blocking).
  if (workspaceRoot) {
    const uris = await vscode.workspace.findFiles(
      "**/*.{pb,pbi}",
      PROCEDURE_FIND_EXCLUDE,
      PROCEDURE_FIND_MAX_RESULTS,
      token
    );
    if (token.isCancellationRequested) return [];

    for (const uri of uris) {
      if (token.isCancellationRequested) return [];
      const filePath = uri.fsPath;

      // Skip paths already processed in the fixed-path pass above.
      if (fixedPaths.some(p => isSameFsPath(p, filePath))) continue;

      // Only include files that belong to the same workspace folder.
      const fileWorkspace = vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath;
      if (!fileWorkspace || !isSameFsPath(fileWorkspace, workspaceRoot)) continue;

      const openDoc = vscode.workspace.textDocuments.find(
        d => d.uri.scheme === "file" && isSameFsPath(d.uri.fsPath, filePath)
      );
      const text = openDoc
        ? openDoc.getText()
        : await readProcedureSourceTextAsync(filePath, MAX_PROCEDURE_FILE_BYTES);
      if (text) names.push(...extractProcedureNamesFromText(text));
    }
  }

  return sortUniqueProcedureNames(names);
}

function buildToolboxIconUriMap(webview: vscode.Webview, extensionUri: vscode.Uri): Record<string, string> {
  const iconUris: Record<string, string> = {};

  for (const category of getToolboxPanelCategories()) {
    for (const item of category.items) {
      if (!item.iconAsset || iconUris[item.iconAsset]) continue;
      iconUris[item.iconAsset] = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, "icons", item.iconAsset)
      ).toString();
    }
  }

  return iconUris;
}

function getWorkspaceRootForDocument(documentUri: vscode.Uri): string | undefined {
  return vscode.workspace.getWorkspaceFolder(documentUri)?.uri.fsPath;
}

function shouldRefreshProcedureListFromFileChanges(changedUris: readonly vscode.Uri[], formDocumentUri: vscode.Uri, currentEventFilePath?: string): boolean {
  const workspaceRoot = getWorkspaceRootForDocument(formDocumentUri);

  return changedUris.some(uri => {
    if (uri.scheme !== "file") return false;
    if (isSameFsPath(uri.fsPath, currentEventFilePath)) return true;
    if (!workspaceRoot) return false;

    const changedWorkspace = vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath;
    if (!changedWorkspace || !isSameFsPath(changedWorkspace, workspaceRoot)) return false;

    return isProcedureSourceFilePath(uri.fsPath);
  });
}

/**
 * Reads Windows UI colors from HKCU\Control Panel\Colors asynchronously.
 * Uses `execFile('reg', ['query', ...])` to avoid shell parsing and to keep
 * the extension host thread unblocked during editor initialization.
 * Values are stored as "R G B" strings (e.g. "240 240 240").
 * Resolves to null on non-Windows or when the key cannot be read.
 */
function readWindowsRegistryColorsAsync(): Promise<WindowsRegistryColors | null> {
  if (process.platform !== "win32") return Promise.resolve(null);

  const REG_KEY = "HKCU\\Control Panel\\Colors";
  const FIELDS: (keyof WindowsRegistryColors)[] = [
    "menu", "menuBar", "menuText", "menuHilight",
    "activeTitle", "gradientActiveTitle", "inactiveTitle", "titleText",
    "hotTrackingColor", "scrollbar"
  ];
  // Registry names differ from our camelCase keys in a few cases
  const REGISTRY_NAME: Record<keyof WindowsRegistryColors, string> = {
    menu:                "Menu",
    menuBar:             "MenuBar",
    menuText:            "MenuText",
    menuHilight:         "MenuHilight",
    activeTitle:         "ActiveTitle",
    gradientActiveTitle: "GradientActiveTitle",
    inactiveTitle:       "InactiveTitle",
    titleText:           "TitleText",
    hotTrackingColor:    "HotTrackingColor",
    scrollbar:           "Scrollbar"
  };

  // Parses "R G B" registry value into a validated rgb() CSS string.
  // Each channel is clamped to [0, 255]; returns black on malformed input.
  const toRgb = (rgbStr: string | undefined): string => {
    if (!rgbStr) return "rgb(0, 0, 0)";
    const parts = rgbStr.split(/\s+/).map(Number);
    if (parts.length < 3 || parts.some(v => !isFinite(v))) return "rgb(0, 0, 0)";
    const [r, g, b] = parts.map(v => Math.min(255, Math.max(0, Math.round(v))));
    return `rgb(${r}, ${g}, ${b})`;
  };

  return new Promise<WindowsRegistryColors | null>(resolve => {
    cp.execFile(
      "reg",
      ["query", REG_KEY],
      { encoding: "utf8", timeout: 2000, windowsHide: true },
      (err, stdout) => {
        if (err) { resolve(null); return; }
        try {
          // Each line looks like:
          //   "    ButtonFace    REG_SZ    240 240 240"
          const lineRe = /^\s+(\S+)\s+REG_SZ\s+(.+)$/;
          const valueMap = new Map<string, string>();
          for (const line of stdout.split(/\r?\n/)) {
            const m = lineRe.exec(line);
            if (m) valueMap.set(m[1].trim(), m[2].trim());
          }

          const result = {} as WindowsRegistryColors;
          for (const key of FIELDS) {
            result[key] = toRgb(valueMap.get(REGISTRY_NAME[key]));
          }
          resolve(result);
        } catch {
          resolve(null);
        }
      }
    );
  });
}

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

    const post = (msg: ExtensionToWebviewMessage<FormDocument>) => webviewPanel.webview.postMessage(msg);

    let lastModel: FormDocument | undefined;
    let initTimer: ReturnType<typeof setTimeout> | undefined;
    let lastProcedureNames: string[] = [];
    let procedureRefreshCts: vscode.CancellationTokenSource | null = null;
    let procedureRefreshTimer: ReturnType<typeof setTimeout> | undefined;
    const gadgetTextVariableSessionOverrides = new Map<string, boolean>();

    function createErrorModel(textLen: number, message: string): FormDocument {
      return {
        window: undefined,
        fonts: [],
        gadgets: [],
        menus: [],
        toolbars: [],
        statusbars: [],
        images: [],
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

    /**
     * Cancels any in-flight async procedure refresh and starts a new one.
     * On completion the webview receives a lightweight `procedureNames` message
     * instead of a full `init`, so no UI state (scroll, selection) is disturbed.
     */
    const triggerProcedureRefresh = (documentText: string, eventFile: string | undefined) => {
      procedureRefreshCts?.cancel();
      procedureRefreshCts?.dispose();
      procedureRefreshCts = new vscode.CancellationTokenSource();
      const token = procedureRefreshCts.token;
      const workspaceRoot = getWorkspaceRootForDocument(document.uri);

      collectProcedureNamesAsync(
        document.uri.fsPath,
        documentText,
        eventFile,
        workspaceRoot,
        token
      ).then(names => {
        if (token.isCancellationRequested) return;
        lastProcedureNames = names;
        if (lastModel) {
          lastModel.procedureNames = names;
          post({ type: EXT_TO_WEBVIEW_MSG_TYPE.procedureNames, names });
        }
      }).catch(() => {
        // Procedure names are best-effort; silently ignore errors.
      });
    };

    /** Debounced wrapper around triggerProcedureRefresh for file-system events. */
    const scheduleProcedureRefresh = () => {
      if (procedureRefreshTimer) clearTimeout(procedureRefreshTimer);
      procedureRefreshTimer = setTimeout(() => {
        triggerProcedureRefresh(document.getText(), lastModel?.window?.eventFile);
      }, 200);
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

        // Use the cached procedure names for an instant render; the async
        // refresh below will push an update once discovery completes.
        model.procedureNames = lastProcedureNames;

        const settings = readDesignerSettings();
        model.meta.issues = applyConfiguredFormVersionWarnings(model.meta.issues, model.meta.header, settings);
        const staleGadgetTextVariableIds = applyGadgetCaptionVariableSessionOverrides(model.gadgets, gadgetTextVariableSessionOverrides);
        for (const id of staleGadgetTextVariableIds) {
          gadgetTextVariableSessionOverrides.delete(id);
        }
        post({ type: EXT_TO_WEBVIEW_MSG_TYPE.init, model, settings });

        // Kick off non-blocking procedure discovery; the eventFile may have
        // changed after re-parsing, so always pass the freshly parsed value.
        triggerProcedureRefresh(text, model.window?.eventFile);
      } catch (e: any) {
        // Keep the webview alive with a minimal model and a structured error.
        const model = createErrorModel(text.length, e?.message ?? String(e));
        lastModel = model;
        post({ type: EXT_TO_WEBVIEW_MSG_TYPE.init, model, settings: readDesignerSettings() });
      }
    };

    sendInit();

    // Send Windows registry colors once on startup (async, win32 only).
    // Intentionally not awaited so that registry I/O never delays sendInit().
    readWindowsRegistryColorsAsync().then(winColors => {
      if (winColors) {
        post({ type: EXT_TO_WEBVIEW_MSG_TYPE.windowsSystemColors, colors: winColors });
      }
    }).catch(() => { /* best-effort; silently ignore */ });

    const cfgSub = vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
      if (e.affectsConfiguration(SETTINGS_SECTION)) {
        post({ type: EXT_TO_WEBVIEW_MSG_TYPE.settings, settings: readDesignerSettings() });
      }
    });

    const docSub = vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
      if (e.document.uri.scheme !== "file") return;

      if (e.document.uri.toString() === document.uri.toString()) {
        // The form document itself changed: re-parse and refresh everything.
        scheduleInit();
        return;
      }

      const currentEventFilePath = resolveProcedureEventFilePath(document.uri.fsPath, lastModel?.window?.eventFile);
      if (
        isSameFsPath(e.document.uri.fsPath, currentEventFilePath) ||
        isProcedureSourceFilePath(e.document.uri.fsPath)
      ) {
        // A procedure source file changed: only procedure names need updating.
        scheduleProcedureRefresh();
      }
    });

    const createSub = vscode.workspace.onDidCreateFiles((e: vscode.FileCreateEvent) => {
      const currentEventFilePath = resolveProcedureEventFilePath(document.uri.fsPath, lastModel?.window?.eventFile);
      if (shouldRefreshProcedureListFromFileChanges(e.files, document.uri, currentEventFilePath)) {
        scheduleProcedureRefresh();
      }
    });

    const deleteSub = vscode.workspace.onDidDeleteFiles((e: vscode.FileDeleteEvent) => {
      const currentEventFilePath = resolveProcedureEventFilePath(document.uri.fsPath, lastModel?.window?.eventFile);
      if (shouldRefreshProcedureListFromFileChanges(e.files, document.uri, currentEventFilePath)) {
        scheduleProcedureRefresh();
      }
    });

    const renameSub = vscode.workspace.onDidRenameFiles((e: vscode.FileRenameEvent) => {
      const currentEventFilePath = resolveProcedureEventFilePath(document.uri.fsPath, lastModel?.window?.eventFile);
      const renamedUris = e.files.flatMap(file => [file.oldUri, file.newUri]);
      if (shouldRefreshProcedureListFromFileChanges(renamedUris, document.uri, currentEventFilePath)) {
        scheduleProcedureRefresh();
      }
    });

    webviewPanel.onDidDispose(() => {
      cfgSub.dispose();
      docSub.dispose();
      createSub.dispose();
      deleteSub.dispose();
      renameSub.dispose();
      if (initTimer) clearTimeout(initTimer);
      if (procedureRefreshTimer) clearTimeout(procedureRefreshTimer);
      procedureRefreshCts?.cancel();
      procedureRefreshCts?.dispose();
    });

    webviewPanel.webview.onDidReceiveMessage(async (msg: WebviewToExtensionMessage) => {
      const sr = lastModel?.meta.scanRange;
      const rangeInfo = sr ? ` (scanRange: ${sr.start}-${sr.end})` : "";
      const postError = (message: string) => post({ type: EXT_TO_WEBVIEW_MSG_TYPE.error, message });

      const applyEditOrError = async (edit: vscode.WorkspaceEdit | undefined, errorMessage: string) => {
        if (!edit) {
          postError(errorMessage);
          return false;
        }
        const ok = await vscode.workspace.applyEdit(edit);
        if (!ok) {
          postError(errorMessage);
          return false;
        }
        return true;
      };

      // Merges two WorkspaceEdits into one so they can be applied atomically in a single
      // applyEdit() call. WorkspaceEdit has no built-in merge API; we accumulate via get/set.
      const mergeWorkspaceEdits = (a: vscode.WorkspaceEdit, b: vscode.WorkspaceEdit): vscode.WorkspaceEdit => {
        const merged = new vscode.WorkspaceEdit();
        for (const edit of [a, b]) {
          for (const [uri, textEdits] of edit.entries()) {
            merged.set(uri, [...merged.get(uri), ...textEdits]);
          }
        }
        return merged;
      };

      // Validates that both edits could be built, merges them into one WorkspaceEdit, and
      // applies it atomically. Returns false (with error) if either edit is undefined or
      // applyEdit() fails — without having partially modified the document.
      const applyPairedEditsOrError = async (
        assignEdit: vscode.WorkspaceEdit | undefined,
        assignErrorMessage: string,
        insertEdit: vscode.WorkspaceEdit | undefined,
        insertErrorMessage: string,
      ): Promise<boolean> => {
        if (!assignEdit) { postError(assignErrorMessage); return false; }
        if (!insertEdit) { postError(insertErrorMessage); return false; }
        const ok = await vscode.workspace.applyEdit(mergeWorkspaceEdits(assignEdit, insertEdit));
        if (!ok) { postError(assignErrorMessage); return false; }
        return true;
      };


      const applyTripleEditsOrError = async (
        firstEdit: vscode.WorkspaceEdit | undefined,
        firstErrorMessage: string,
        secondEdit: vscode.WorkspaceEdit | undefined,
        secondErrorMessage: string,
        thirdEdit: vscode.WorkspaceEdit | undefined,
        thirdErrorMessage: string,
      ): Promise<boolean> => {
        if (!firstEdit) { postError(firstErrorMessage); return false; }
        if (!secondEdit) { postError(secondErrorMessage); return false; }
        if (!thirdEdit) { postError(thirdErrorMessage); return false; }
        const ok = await vscode.workspace.applyEdit(mergeWorkspaceEdits(mergeWorkspaceEdits(firstEdit, secondEdit), thirdEdit));
        if (!ok) { postError(firstErrorMessage); return false; }
        return true;
      };

      const pickImageFile = async (): Promise<{ fsPath: string; imageRaw: string } | undefined> => {
        const picked = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          openLabel: "Select Image"
        });

        const fileUri = picked?.[0];
        if (!fileUri) return undefined;

        return {
          fsPath: fileUri.fsPath,
          imageRaw: toPbFilePathLiteral(fileUri.fsPath)
        };
      };

      const pickImageFileRaw = async (): Promise<string | undefined> => {
        const picked = await pickImageFile();
        return picked?.imageRaw;
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

      const validateVariableRaw = (raw: string | undefined, fieldLabel: string): boolean => {
        if (!requiresPbVariableValidation(raw)) return true;
        if (isValidPbVariableReference(raw!)) return true;
        postError(`${fieldLabel}: ${PB_WRONG_VARIABLE_NAME_MESSAGE}`);
        return false;
      };

      const validateWindowColorRaw = (raw: string | undefined): boolean => {
        const parsed = parseWindowColorInspectorInput(raw);
        if (parsed.ok) return true;
        postError(WINDOW_COLOR_LITERAL_ERROR_MESSAGE);
        return false;
      };

      const validateGadgetColorRaw = (raw: string | undefined, label: "FrontColor" | "BackColor"): boolean => {
        const parsed = parseWindowColorInspectorInput(raw);
        if (parsed.ok) return true;
        postError(`${label} accepts only RGB(r,g,b) or a $hex literal.`);
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
          const edit = applyRectPatch(document, msg.id, msg.x, msg.y, msg.w, msg.h, sr, { yRaw: msg.yRaw });
          await applyEditOrError(edit, `Could not patch gadget '${msg.id}'. No matching call found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.setWindowRect: {
          const edit = applyWindowRectPatch(document, msg.id, msg.x, msg.y, msg.w, msg.h, sr);
          await applyEditOrError(edit, `Could not patch window '${msg.id}'. No matching OpenWindow call found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.setWindowOpenArgs: {
          if (Object.prototype.hasOwnProperty.call(msg, "captionRaw") && !validateVariableRaw(msg.captionRaw, "Caption")) {
            return;
          }
          const edit = applyWindowOpenArgsUpdate(document, msg.windowKey, {
            xRaw: msg.xRaw,
            yRaw: msg.yRaw,
            wRaw: msg.wRaw,
            hRaw: msg.hRaw,
            captionRaw: msg.captionRaw,
            flagsExpr: msg.flagsExpr,
            parentRaw: msg.parentRaw
          }, sr);
          await applyEditOrError(edit, `Could not patch OpenWindow arguments for window '${msg.windowKey}'. No matching OpenWindow call found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.setWindowProperties: {
          if (Object.prototype.hasOwnProperty.call(msg, "colorRaw") && !validateWindowColorRaw(msg.colorRaw)) {
            return;
          }
          const windowPropArgs: WindowPropertyArgs = {};
          if (Object.prototype.hasOwnProperty.call(msg, "hiddenRaw"))   { windowPropArgs.hiddenRaw   = msg.hiddenRaw; }
          if (Object.prototype.hasOwnProperty.call(msg, "disabledRaw")) { windowPropArgs.disabledRaw = msg.disabledRaw; }
          if (Object.prototype.hasOwnProperty.call(msg, "colorRaw"))    { windowPropArgs.colorRaw    = msg.colorRaw; }
          const edit = applyWindowPropertyUpdate(document, msg.windowKey, windowPropArgs, sr);
          await applyEditOrError(edit, `Could not patch window property lines for '${msg.windowKey}'. No matching OpenWindow call found${rangeInfo}.`);
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
          if (msg.variableName === undefined || !msg.variableName.length) {
            postError(`Could not patch FormWindow variable name. Empty variable name is not allowed${rangeInfo}.`);
            return;
          }
          const edit = applyWindowVariableNamePatch(document, msg.variableName, msg.windowKey, sr);
          await applyEditOrError(
            edit,
            `Could not patch FormWindow variable name '${msg.variableName}'. No matching OpenWindow call found${rangeInfo}.`
          );
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.toggleGadgetPbAny: {
          const edit = applyGadgetPbAnyToggle(
            document,
            msg.gadgetId,
            msg.toPbAny,
            msg.variableName,
            msg.enumSymbol,
            msg.enumValueRaw,
            sr
          );
          await applyEditOrError(edit, `Could not toggle gadget pbAny. No matching gadget constructor found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.setGadgetEnumValue: {
          const edit = applyGadgetEnumValuePatch(document, msg.enumSymbol, msg.enumValueRaw, sr);
          await applyEditOrError(
            edit,
            `Could not patch FormGadget enumeration entry '${msg.enumSymbol}'. No Enumeration FormGadget block found${rangeInfo}.`
          );
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.setGadgetVariableName: {
          if (!msg.variableName.length) {
            postError(`Could not patch gadget variable name. Empty variable name is not allowed${rangeInfo}.`);
            return;
          }
          const edit = applyGadgetVariableNamePatch(document, msg.gadgetId, msg.variableName, sr);
          await applyEditOrError(
            edit,
            `Could not patch gadget variable name '${msg.variableName}'. No matching gadget constructor found${rangeInfo}.`
          );
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.setGadgetOpenArgs: {
          if (Object.prototype.hasOwnProperty.call(msg, "textRaw") && !validateVariableRaw(msg.textRaw, "Caption")) {
            return;
          }
          const edit = applyGadgetOpenArgsUpdate(document, msg.id, {
            textRaw: msg.textRaw,
            minRaw: msg.minRaw,
            maxRaw: msg.maxRaw,
            flagsExpr: msg.flagsExpr
          }, sr);
          if (!await applyEditOrError(edit, `Could not patch constructor arguments for gadget '${msg.id}'. No matching gadget constructor found${rangeInfo}.`)) {
            return;
          }
          if (Object.prototype.hasOwnProperty.call(msg, "textVariable")) {
            if (isAmbiguousEmptyTextLiteral(msg.textRaw)) {
              gadgetTextVariableSessionOverrides.set(msg.id, Boolean(msg.textVariable));
            } else {
              gadgetTextVariableSessionOverrides.delete(msg.id);
            }
          } else if (!isAmbiguousEmptyTextLiteral(msg.textRaw)) {
            gadgetTextVariableSessionOverrides.delete(msg.id);
          }
          return;
        }
        case WEBVIEW_TO_EXT_MSG_TYPE.setCustomGadgetCode: {
          const gadget = lastModel?.gadgets.find(entry => entry.id === msg.id);
          if (!gadget || gadget.kind !== GADGET_KIND.CustomGadget) {
            postError(`Could not patch custom gadget code for '${msg.id}'. The current selection is not a parsed CustomGadget${rangeInfo}.`);
            return;
          }
          if (msg.customCreateRaw !== undefined && !msg.customCreateRaw.length) {
            postError(`Custom gadget CreateCode must not be empty.`);
            return;
          }
          const edit = applyCustomGadgetCodeUpdate(document, msg.id, {
            customInitRaw: msg.customInitRaw,
            customCreateRaw: msg.customCreateRaw
          }, sr);
          await applyEditOrError(edit, `Could not patch custom gadget code for '${msg.id}'. No matching custom gadget marker block found${rangeInfo}.`);
          return;
        }
        case WEBVIEW_TO_EXT_MSG_TYPE.setGadgetProperties: {
          if (Object.prototype.hasOwnProperty.call(msg, "tooltipRaw") && !validateVariableRaw(msg.tooltipRaw, "Tooltip")) {
            return;
          }
          if (Object.prototype.hasOwnProperty.call(msg, "frontColorRaw") && !validateGadgetColorRaw(msg.frontColorRaw, "FrontColor")) {
            return;
          }
          if (Object.prototype.hasOwnProperty.call(msg, "backColorRaw") && !validateGadgetColorRaw(msg.backColorRaw, "BackColor")) {
            return;
          }
          const gadgetPropArgs: GadgetPropertyArgs = {};
          if (Object.prototype.hasOwnProperty.call(msg, "hiddenRaw"))     { gadgetPropArgs.hiddenRaw     = msg.hiddenRaw; }
          if (Object.prototype.hasOwnProperty.call(msg, "disabledRaw"))   { gadgetPropArgs.disabledRaw   = msg.disabledRaw; }
          if (Object.prototype.hasOwnProperty.call(msg, "tooltipRaw"))    { gadgetPropArgs.tooltipRaw    = msg.tooltipRaw; }
          if (Object.prototype.hasOwnProperty.call(msg, "frontColorRaw")) { gadgetPropArgs.frontColorRaw = msg.frontColorRaw; }
          if (Object.prototype.hasOwnProperty.call(msg, "backColorRaw"))  { gadgetPropArgs.backColorRaw  = msg.backColorRaw; }
          if (Object.prototype.hasOwnProperty.call(msg, "gadgetFontRaw")) { gadgetPropArgs.gadgetFontRaw = msg.gadgetFontRaw; }
          const edit = applyGadgetPropertyUpdate(document, msg.id, gadgetPropArgs, sr);
          await applyEditOrError(edit, `Could not patch properties for gadget '${msg.id}'. No matching gadget property block found${rangeInfo}.`);
          return;
        }
        case WEBVIEW_TO_EXT_MSG_TYPE.setGadgetEventProc: {
          const edit = applyGadgetEventProcUpdate(document, msg.id, msg.eventProc, sr);
          await applyEditOrError(edit, `Could not patch event proc for gadget '${msg.id}'. No matching EventGadget block found${rangeInfo}.`);
          return;
        }
        case WEBVIEW_TO_EXT_MSG_TYPE.setGadgetImageRaw: {
          const edit = applyGadgetOpenArgsUpdate(document, msg.id, { imageRaw: msg.imageRaw }, sr);
          await applyEditOrError(edit, `Could not patch image argument for gadget '${msg.id}'. No matching image-capable gadget constructor found${rangeInfo}.`);
          return;
        }
        case WEBVIEW_TO_EXT_MSG_TYPE.setGadgetStateRaw: {
          const gadget = lastModel?.gadgets.find(entry => entry.id === msg.id);
          if (!gadget) {
            postError(`Could not find gadget '${msg.id}' for state update${rangeInfo}.`);
            return;
          }

          const trimmed = msg.stateRaw?.trim() ?? "";
          if (gadget.kind === GADGET_KIND.SplitterGadget) {
            const nextState = Number(trimmed);
            if (!trimmed.length || !Number.isFinite(nextState)) {
              postError(`Splitter position must be a finite number.`);
              return;
            }

            const vertical = (gadget.flagsExpr ?? "").split("|").map(part => part.trim()).includes("#PB_Splitter_Vertical");
            const limit = vertical ? gadget.w : gadget.h;
            const stateInt = Math.trunc(nextState);
            if (stateInt <= 0 || stateInt >= limit) {
              postError(`Splitter position must be greater than 0 and smaller than the splitter ${vertical ? "width" : "height"}.`);
              return;
            }

            const edit = applyGadgetPropertyUpdate(document, msg.id, { stateRaw: String(stateInt) }, sr);
            await applyEditOrError(edit, `Could not update splitter state for '${msg.id}'${rangeInfo}.`);
            return;
          }

          if (gadget.kind === GADGET_KIND.CheckBoxGadget || gadget.kind === GADGET_KIND.OptionGadget) {
            const edit = applyGadgetPropertyUpdate(document, msg.id, { stateRaw: trimmed || undefined }, sr);
            await applyEditOrError(edit, `Could not update checked state for '${msg.id}'${rangeInfo}.`);
            return;
          }

          postError(`State editing is currently only enabled for SplitterGadget, CheckBoxGadget and OptionGadget entries.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.setGadgetResizeRaw: {
          const gadget = lastModel?.gadgets.find(entry => entry.id === msg.id);
          if (!gadget) {
            postError(`Could not find gadget '${msg.id}' for ResizeGadget update${rangeInfo}.`);
            return;
          }
          const edit = applyResizeGadgetMutation(document, msg.id, {
            xRaw: msg.xRaw ?? "",
            yRaw: msg.yRaw ?? "",
            wRaw: msg.wRaw ?? "",
            hRaw: msg.hRaw ?? "",
            deleteResize: msg.deleteResize === true
          }, sr);
          await applyEditOrError(edit, `Could not patch ResizeGadget(...) for gadget '${msg.id}'${rangeInfo}.`);
          return;
        }
        case WEBVIEW_TO_EXT_MSG_TYPE.setMenuEntryEvent: {
          const edit = applyMenuEntryEventUpdate(document, msg.entryIdRaw, msg.eventProc, sr);
          await applyEditOrError(edit, `Could not patch event proc for menu entry '${msg.entryIdRaw}'. No matching EventMenu block found${rangeInfo}.`);
          return;
        }
        case WEBVIEW_TO_EXT_MSG_TYPE.setToolBarEntryEvent: {
          const edit = applyToolBarEntryEventUpdate(document, msg.entryIdRaw, msg.eventProc, sr);
          await applyEditOrError(edit, `Could not patch event proc for toolbar entry '${msg.entryIdRaw}'. No matching EventMenu block found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.setToolBarEntryTooltip: {
          const edit = applyToolBarEntryTooltipSet(document, msg.toolBarId, msg.sourceLine, msg.entryIdRaw, msg.textRaw, sr);
          await applyEditOrError(edit, `Could not patch toolbar tooltip for entry '${msg.entryIdRaw}'. No matching toolbar entry found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.setWindowEventFile: {
          const edit = applyWindowEventUpdate(document, msg.windowKey, { eventFileRaw: msg.eventFile }, sr);
          await applyEditOrError(edit, `Could not patch event include for window '${msg.windowKey}'. No matching procedure block found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.setWindowEventProc: {
          const edit = applyWindowEventProcUpdate(document, msg.windowKey, msg.eventProc, sr);
          await applyEditOrError(edit, `Could not patch event proc for window '${msg.windowKey}'. No matching EventGadget block found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.setWindowGenerateEventLoop: {
          const edit = applyWindowGenerateEventLoopUpdate(document, msg.windowKey, msg.enabled, sr);
          await applyEditOrError(edit, `Could not patch generate-event-loop flag for window '${msg.windowKey}'. No safe EventGadget patch path found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.insertGadget: {
          if (!isInsertableGadgetKind(msg.kind)) {
            postError(`Unsupported gadget kind '${msg.kind}'${rangeInfo}.`);
            return;
          }
          const designerSettings = readDesignerSettings();
          const parsed = lastModel ?? parseFormDocument(document.getText());
          const insertAsPbAny = shouldInsertGadgetAsPbAny(parsed.gadgets, designerSettings.newGadgetsUsePbAnyByDefault);
          const insertedIdentity = buildInsertedGadgetIdentity(msg.kind, parsed.gadgets, insertAsPbAny);
          const edit = applyGadgetInsert(
            document,
            msg.kind,
            msg.x,
            msg.y,
            msg.parentId,
            msg.parentItem,
            sr,
            { gadget1Id: msg.gadget1Id, gadget2Id: msg.gadget2Id },
            { pbAny: designerSettings.newGadgetsUsePbAnyByDefault },
            msg.yRaw,
          );
          if (!await applyEditOrError(edit, `Could not insert gadget '${msg.kind}'. No suitable insertion point found${rangeInfo}.`)) {
            return;
          }
          if (designerSettings.newGadgetsUseVariableAsCaption && insertedGadgetHasAmbiguousEmptyTextDefault(msg.kind)) {
            gadgetTextVariableSessionOverrides.set(insertedIdentity.id, true);
          }
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.reparentGadget: {
          const edit = applyGadgetReparent(document, msg.id, msg.parentId, msg.parentItem, sr);
          await applyEditOrError(edit, `Could not change parent for gadget '${msg.id}'. No safe Select Parent patch path found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.deleteGadget: {
          const edit = applyGadgetDelete(document, msg.id, sr);
          await applyEditOrError(edit, `Could not delete gadget '${msg.id}'. No safe delete path found${rangeInfo}.`);
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
          const edit = applyMenuEntryInsert(
            document,
            msg.menuId,
            { kind: msg.kind as any, idRaw: msg.idRaw, textRaw: msg.textRaw },
            sr,
            { parentSourceLine: msg.parentSourceLine }
          );
          await applyEditOrError(edit, `Could not insert menu entry for menu '${msg.menuId}'. No suitable insertion point found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.moveMenuEntry: {
          if (!ensureMenuEntryKind(msg.kind)) return;
          const edit = applyMenuEntryMove(
            document,
            msg.menuId,
            msg.sourceLine,
            msg.kind as any,
            { targetSourceLine: msg.targetSourceLine, placement: msg.placement },
            sr
          );
          await applyEditOrError(edit, `Could not move menu entry for menu '${msg.menuId}'. No matching structural move target found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.updateMenuEntry: {
          if (!ensureMenuEntryKind(msg.kind)) return;
          const edit = applyMenuEntryUpdate(
            document,
            msg.menuId,
            msg.sourceLine,
            { kind: msg.kind as any, idRaw: msg.idRaw, textRaw: msg.textRaw, shortcut: msg.shortcut, iconRaw: msg.iconRaw },
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

        case WEBVIEW_TO_EXT_MSG_TYPE.deleteMenu: {
          const edit = applyMenuDelete(document, msg.menuId, sr);
          await applyEditOrError(edit, `Could not delete menu '${msg.menuId}'. No matching CreateMenu section found${rangeInfo}.`);
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
            { kind: msg.kind as any, idRaw: msg.idRaw, iconRaw: msg.iconRaw, textRaw: msg.textRaw, toggle: msg.toggle },
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

        case WEBVIEW_TO_EXT_MSG_TYPE.deleteToolBar: {
          const edit = applyToolBarDelete(document, msg.toolBarId, sr);
          await applyEditOrError(edit, `Could not delete toolbar '${msg.toolBarId}'. No matching CreateToolBar section found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.insertStatusBarField: {
          const normalized = normalizeStatusBarFieldMessageArgs({
            widthRaw: msg.widthRaw,
            textRaw: msg.textRaw,
            imageRaw: msg.imageRaw,
            flagsRaw: msg.flagsRaw,
            progressBar: msg.progressBar,
            progressRaw: msg.progressRaw,
          });
          if (!normalized.ok) {
            postError(normalized.error);
            return;
          }
          const edit = applyStatusBarFieldInsert(document, msg.statusBarId, normalized.args, sr);
          await applyEditOrError(edit, `Could not insert statusbar field for statusbar '${msg.statusBarId}'. No suitable insertion point found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.updateStatusBarField: {
          const normalized = normalizeStatusBarFieldMessageArgs({
            widthRaw: msg.widthRaw,
            textRaw: msg.textRaw,
            imageRaw: msg.imageRaw,
            flagsRaw: msg.flagsRaw,
            progressBar: msg.progressBar,
            progressRaw: msg.progressRaw,
          });
          if (!normalized.ok) {
            postError(normalized.error);
            return;
          }
          const edit = applyStatusBarFieldUpdate(document, msg.statusBarId, msg.sourceLine, normalized.args, sr);
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

        case WEBVIEW_TO_EXT_MSG_TYPE.deleteStatusBar: {
          const edit = applyStatusBarDelete(document, msg.statusBarId, sr);
          await applyEditOrError(
            edit,
            `Could not delete statusbar '${msg.statusBarId}'. No matching CreateStatusBar section found${rangeInfo}.`
          );
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.insertImage: {
          const edit = applyImageInsert(document, { inline: msg.inline, idRaw: msg.idRaw, imageRaw: msg.imageRaw, assignedVar: msg.assignedVar }, sr);
          await applyEditOrError(edit, `Could not insert image entry. No suitable insertion point found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.updateImage: {
          const edit = applyImageUpdate(document, msg.sourceLine, { inline: msg.inline, idRaw: msg.idRaw, imageRaw: msg.imageRaw, assignedVar: msg.assignedVar, pbAny: msg.pbAny }, sr);
          await applyEditOrError(edit, `Could not update image entry. No matching LoadImage/CatchImage call found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.deleteImage: {
          const edit = applyImageDelete(document, msg.sourceLine, sr);
          await applyEditOrError(edit, `Could not delete image entry. No matching LoadImage/CatchImage call found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.relativizeImagePath: {
          if (msg.inline) {
            postError(`Could not make image path relative. CatchImage entries do not use a file path${rangeInfo}.`);
            return;
          }

          const relativeImageRaw = relativizeImagePath(document.uri.fsPath, msg.imageRaw);
          if (!relativeImageRaw) {
            postError(`Could not make image path relative. Save the form first and use a quoted LoadImage file path${rangeInfo}.`);
            return;
          }

          const edit = applyImageUpdate(document, msg.sourceLine, {
            inline: msg.inline,
            idRaw: msg.idRaw,
            imageRaw: relativeImageRaw,
            assignedVar: msg.assignedVar
          }, sr);
          await applyEditOrError(edit, `Could not update image entry. No matching LoadImage/CatchImage call found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.chooseImageFileForEntry: {
          if (msg.inline) {
            postError(`Could not choose a file for this image entry. CatchImage entries do not use a file path${rangeInfo}.`);
            return;
          }

          const pickedImageRaw = await pickImageFileRaw();
          if (!pickedImageRaw) {
            return;
          }

          const edit = applyImageUpdate(document, msg.sourceLine, {
            inline: false,
            idRaw: msg.idRaw,
            imageRaw: pickedImageRaw,
            assignedVar: msg.assignedVar
          }, sr);
          await applyEditOrError(edit, `Could not update image entry. No matching LoadImage/CatchImage call found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.toggleImagePbAny: {
          const model = lastModel;
          const image = model?.images.find((entry) => entry.source?.line === msg.sourceLine);
          if (!image) {
            postError(`Could not toggle image pbAny. No matching image entry found${rangeInfo}.`);
            return;
          }

          const oldImageId = image.id;
          const toggledAssignedVar = msg.toPbAny
            ? toPbAnyAssignedVar(image.firstParam)
            : undefined;
          const toggledIdRaw = msg.toPbAny
            ? PB_ANY
            : toEnumImageId(image.variable ?? image.id ?? "");

          if (!toggledIdRaw || (msg.toPbAny && !toggledAssignedVar)) {
            postError(`Could not derive the target image identifier for '${image.id}'${rangeInfo}.`);
            return;
          }

          const nextImageRef = buildImageIdReference(toggledIdRaw, toggledAssignedVar);
          if (!nextImageRef) {
            postError(`Could not build the updated image reference for '${image.id}'${rangeInfo}.`);
            return;
          }

          const applyOrAbort = async (edit: vscode.WorkspaceEdit | undefined, errorMessage: string) => {
            if (!edit) {
              postError(errorMessage);
              return false;
            }
            const ok = await vscode.workspace.applyEdit(edit);
            if (!ok) {
              postError(errorMessage);
              return false;
            }
            return true;
          };

          if (msg.toPbAny) {
            // Convert enum → #PB_Any: move entry to list end, re-index all IDs,
            // and patch every ImageID(...) reference via applyImageIdRenames.
            // applyImageUpdate(pbAny:true) handles all of this atomically —
            // no separate usage-patching loops needed.
            const declarationEdit = applyImageUpdate(document, msg.sourceLine, {
              inline: image.inline,
              idRaw: toggledIdRaw,
              imageRaw: image.imageRaw,
              assignedVar: toggledAssignedVar,
              pbAny: true,
            }, sr);
            await applyEditOrError(declarationEdit, `Could not toggle image entry '${image.id}'${rangeInfo}.`);
            return;
          }

          // toPbAny=false: simple variable → enum toggle, no re-index.
          // Patch all usages first, then rewrite the declaration.
          const gadgetUsages = (model?.gadgets ?? []).filter((entry) => entry.imageId === oldImageId);
          const menuUsages = (model?.menus ?? []).flatMap((menu) =>
            menu.entries
              .filter((entry) => entry.iconId === oldImageId)
              .map((entry) => ({ menuId: menu.id, entry }))
          );
          const toolBarUsages = (model?.toolbars ?? []).flatMap((toolBar) =>
            toolBar.entries
              .filter((entry) => entry.iconId === oldImageId)
              .map((entry) => ({ toolBarId: toolBar.id, entry }))
          );
          const statusBarUsages = (model?.statusbars ?? []).flatMap((statusBar) =>
            statusBar.fields
              .filter((field) => field.imageId === oldImageId)
              .map((field) => ({ statusBarId: statusBar.id, field }))
          );

          for (const gadget of gadgetUsages) {
            const edit = applyGadgetOpenArgsUpdate(document, gadget.id, { imageRaw: nextImageRef }, sr);
            if (!await applyOrAbort(edit, `Could not update image reference in gadget '${gadget.id}'${rangeInfo}.`)) {
              return;
            }
          }

          for (const { menuId, entry } of menuUsages) {
            const sourceLine = entry.source?.line;
            if (typeof sourceLine !== "number") continue;
            const edit = applyMenuEntryUpdate(document, menuId, sourceLine, {
              kind: entry.kind as any,
              idRaw: entry.idRaw,
              textRaw: entry.textRaw,
              shortcut: entry.shortcut,
              iconRaw: nextImageRef,
            }, sr);
            if (!await applyOrAbort(edit, `Could not update image reference in menu '${menuId}'${rangeInfo}.`)) {
              return;
            }
          }

          for (const { toolBarId, entry } of toolBarUsages) {
            const sourceLine = entry.source?.line;
            if (typeof sourceLine !== "number") continue;
            const edit = applyToolBarEntryUpdate(document, toolBarId, sourceLine, {
              kind: entry.kind as any,
              idRaw: entry.idRaw,
              iconRaw: nextImageRef,
              toggle: entry.toggle,
            }, sr);
            if (!await applyOrAbort(edit, `Could not update image reference in toolbar '${toolBarId}'${rangeInfo}.`)) {
              return;
            }
          }

          for (const { statusBarId, field } of statusBarUsages) {
            const sourceLine = field.source?.line;
            if (typeof sourceLine !== "number") continue;
            const edit = applyStatusBarFieldUpdate(document, statusBarId, sourceLine, {
              widthRaw: field.widthRaw,
              imageRaw: nextImageRef,
            }, sr);
            if (!await applyOrAbort(edit, `Could not update image reference in statusbar '${statusBarId}'${rangeInfo}.`)) {
              return;
            }
          }

          const declarationEdit = applyImageUpdate(document, msg.sourceLine, {
            inline: image.inline,
            idRaw: toggledIdRaw,
            imageRaw: image.imageRaw,
            assignedVar: toggledAssignedVar,
          }, sr);
          await applyEditOrError(declarationEdit, `Could not toggle image entry '${image.id}'${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.createAndAssignGadgetImage: {
          const imageRef = buildImageIdReference(msg.newImageIdRaw, msg.newAssignedVar);
          if (!imageRef) {
            postError(`Could not create image entry for gadget '${msg.id}'. ${PB_ANY} requires an assigned variable name${rangeInfo}.`);
            return;
          }

          const assignEdit = applyGadgetOpenArgsUpdate(document, msg.id, { imageRaw: imageRef }, sr);
          const insertEdit = applyImageInsert(document, { inline: msg.newInline, idRaw: msg.newImageIdRaw, imageRaw: msg.newImageRaw, assignedVar: msg.newAssignedVar }, sr);
          await applyPairedEditsOrError(
            assignEdit, `Could not patch image argument for gadget '${msg.id}'. No matching image-capable gadget constructor found${rangeInfo}.`,
            insertEdit, `Could not insert image entry for gadget '${msg.id}'. No suitable insertion point found${rangeInfo}.`,
          );
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.chooseFileAndAssignGadgetImage: {
          const picked = await pickImageFile();
          if (!picked) {
            return;
          }

          const existingImage = resolveExistingLoadImageByFilePath(lastModel?.images, picked.fsPath);
          const imageRef = buildImageReferenceFromEntry(existingImage)
            ?? buildImageIdReference(msg.newImageIdRaw, msg.newAssignedVar);
          if (!imageRef) {
            postError(`Could not create image entry for gadget '${msg.id}'. ${PB_ANY} requires an assigned variable name${rangeInfo}.`);
            return;
          }

          const assignEdit = applyGadgetOpenArgsUpdate(document, msg.id, { imageRaw: imageRef }, sr);
          if (existingImage) {
            if (!await applyEditOrError(assignEdit, `Could not patch image argument for gadget '${msg.id}'. No matching image-capable gadget constructor found${rangeInfo}.`)) {
              return;
            }
          } else {
            const insertEdit = applyImageInsert(document, { inline: false, idRaw: msg.newImageIdRaw, imageRaw: picked.imageRaw, assignedVar: msg.newAssignedVar }, sr);
            if (!await applyPairedEditsOrError(
              assignEdit, `Could not patch image argument for gadget '${msg.id}'. No matching image-capable gadget constructor found${rangeInfo}.`,
              insertEdit, `Could not insert image entry for gadget '${msg.id}'. No suitable insertion point found${rangeInfo}.`,
            )) {
              return;
            }
          }

          // Resize is non-fatal and applied separately after the assign path.
          if (msg.resizeToImage) {
            try {
              const dims = await readImageDimensions(picked.fsPath);
              if (dims) {
                const resizeEdit = applyRectPatch(document, msg.id, msg.x, msg.y, dims.width, dims.height, sr);
                await applyEditOrError(resizeEdit, `Could not resize gadget '${msg.id}' to the selected image size${rangeInfo}.`);
              } else {
                postError(`Assigned image to gadget '${msg.id}', but could not determine the selected image size for auto-resize${rangeInfo}.`);
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              postError(`Assigned image to gadget '${msg.id}', but could not read the selected image size: ${message}${rangeInfo}.`);
            }
          }
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.createAndAssignMenuEntryImage: {
          if (!ensureMenuEntryKind(msg.kind)) return;

          const imageRef = buildImageIdReference(msg.newImageIdRaw, msg.newAssignedVar);
          if (!imageRef) {
            postError(`Could not create image entry for menu '${msg.menuId}'. ${PB_ANY} requires an assigned variable name${rangeInfo}.`);
            return;
          }

          const assignEdit = applyMenuEntryUpdate(
            document,
            msg.menuId,
            msg.sourceLine,
            { kind: msg.kind as any, idRaw: msg.idRaw, textRaw: msg.textRaw, shortcut: msg.shortcut, iconRaw: imageRef },
            sr
          );
          const insertEdit = applyImageInsert(document, { inline: msg.newInline, idRaw: msg.newImageIdRaw, imageRaw: msg.newImageRaw, assignedVar: msg.newAssignedVar }, sr);
          await applyPairedEditsOrError(
            assignEdit, `Could not patch image argument for menu entry in menu '${msg.menuId}'. No matching call found${rangeInfo}.`,
            insertEdit, `Could not insert image entry for menu '${msg.menuId}'. No suitable insertion point found${rangeInfo}.`,
          );
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.createAndAssignToolBarEntryImage: {
          if (!ensureToolBarEntryKind(msg.kind)) return;

          const imageRef = buildImageIdReference(msg.newImageIdRaw, msg.newAssignedVar);
          if (!imageRef) {
            postError(`Could not create image entry for toolbar '${msg.toolBarId}'. ${PB_ANY} requires an assigned variable name${rangeInfo}.`);
            return;
          }

          const model = lastModel;
          const assignEdit = applyToolBarEntryUpdate(
            document,
            msg.toolBarId,
            msg.sourceLine,
            { kind: msg.kind as any, idRaw: msg.idRaw, iconRaw: imageRef, toggle: msg.toggle },
            sr
          );
          const insertEdit = applyImageInsert(document, { inline: msg.newInline, idRaw: msg.newImageIdRaw, imageRaw: msg.newImageRaw, assignedVar: msg.newAssignedVar }, sr);
          const oldImageUsageCount = msg.oldImageId
            ? [
                ...(model?.gadgets ?? []).filter((entry) => entry.imageId === msg.oldImageId),
                ...((model?.menus ?? []).flatMap((menu) => menu.entries.filter((entry) => entry.iconId === msg.oldImageId))),
                ...((model?.toolbars ?? []).flatMap((toolBar) => toolBar.entries.filter((entry) => entry.iconId === msg.oldImageId))),
                ...((model?.statusbars ?? []).flatMap((statusBar) => statusBar.fields.filter((field) => field.imageId === msg.oldImageId))),
              ].length
            : 0;
          const cleanupEdit = msg.oldImageId && oldImageUsageCount === 1 && typeof msg.oldImageSourceLine === "number"
            ? applyImageDelete(document, msg.oldImageSourceLine, sr)
            : undefined;

          if (cleanupEdit) {
            await applyTripleEditsOrError(
              assignEdit, `Could not patch image argument for toolbar entry in toolbar '${msg.toolBarId}'. No matching call found${rangeInfo}.`,
              insertEdit, `Could not insert image entry for toolbar '${msg.toolBarId}'. No suitable insertion point found${rangeInfo}.`,
              cleanupEdit, `Could not clean the previous image entry for toolbar '${msg.toolBarId}'. No matching LoadImage/CatchImage call found${rangeInfo}.`,
            );
            return;
          }

          await applyPairedEditsOrError(
            assignEdit, `Could not patch image argument for toolbar entry in toolbar '${msg.toolBarId}'. No matching call found${rangeInfo}.`,
            insertEdit, `Could not insert image entry for toolbar '${msg.toolBarId}'. No suitable insertion point found${rangeInfo}.`,
          );
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.createAndAssignStatusBarFieldImage: {
          const imageRef = buildImageIdReference(msg.newImageIdRaw, msg.newAssignedVar);
          if (!imageRef) {
            postError(`Could not create image entry for statusbar '${msg.statusBarId}'. ${PB_ANY} requires an assigned variable name${rangeInfo}.`);
            return;
          }

          const model = lastModel;
          const assignEdit = applyStatusBarFieldUpdate(document, msg.statusBarId, msg.sourceLine, { widthRaw: msg.widthRaw, imageRaw: imageRef }, sr);
          const insertEdit = applyImageInsert(document, { inline: msg.newInline, idRaw: msg.newImageIdRaw, imageRaw: msg.newImageRaw, assignedVar: msg.newAssignedVar }, sr);
          const oldImageUsageCount = msg.oldImageId
            ? [
                ...(model?.gadgets ?? []).filter((entry) => entry.imageId === msg.oldImageId),
                ...((model?.menus ?? []).flatMap((menu) => menu.entries.filter((entry) => entry.iconId === msg.oldImageId))),
                ...((model?.toolbars ?? []).flatMap((toolBar) => toolBar.entries.filter((entry) => entry.iconId === msg.oldImageId))),
                ...((model?.statusbars ?? []).flatMap((statusBar) => statusBar.fields.filter((field) => field.imageId === msg.oldImageId))),
              ].length
            : 0;
          const cleanupEdit = msg.oldImageId && oldImageUsageCount === 1 && typeof msg.oldImageSourceLine === "number"
            ? applyImageDelete(document, msg.oldImageSourceLine, sr)
            : undefined;

          if (cleanupEdit) {
            await applyTripleEditsOrError(
              assignEdit, `Could not patch image argument for statusbar '${msg.statusBarId}'. No matching AddStatusBarField call found${rangeInfo}.`,
              insertEdit, `Could not insert image entry for statusbar '${msg.statusBarId}'. No suitable insertion point found${rangeInfo}.`,
              cleanupEdit, `Could not clean the previous image entry for statusbar '${msg.statusBarId}'. No matching LoadImage/CatchImage call found${rangeInfo}.`,
            );
            return;
          }

          await applyPairedEditsOrError(
            assignEdit, `Could not patch image argument for statusbar '${msg.statusBarId}'. No matching AddStatusBarField call found${rangeInfo}.`,
            insertEdit, `Could not insert image entry for statusbar '${msg.statusBarId}'. No suitable insertion point found${rangeInfo}.`,
          );
          return;
        }
        case WEBVIEW_TO_EXT_MSG_TYPE.rebindStatusBarFieldImage: {
          const model = lastModel;
          const assignEdit = applyStatusBarFieldUpdate(document, msg.statusBarId, msg.sourceLine, { widthRaw: msg.widthRaw, imageRaw: msg.imageRaw }, sr);
          const oldImageUsageCount = msg.oldImageId
            ? [
                ...(model?.gadgets ?? []).filter((entry) => entry.imageId === msg.oldImageId),
                ...((model?.menus ?? []).flatMap((menu) => menu.entries.filter((entry) => entry.iconId === msg.oldImageId))),
                ...((model?.toolbars ?? []).flatMap((toolBar) => toolBar.entries.filter((entry) => entry.iconId === msg.oldImageId))),
                ...((model?.statusbars ?? []).flatMap((statusBar) => statusBar.fields.filter((field) => field.imageId === msg.oldImageId))),
              ].length
            : 0;
          const cleanupEdit = msg.oldImageId && oldImageUsageCount === 1 && typeof msg.oldImageSourceLine === "number"
            ? applyImageDelete(document, msg.oldImageSourceLine, sr)
            : undefined;

          if (cleanupEdit) {
            await applyPairedEditsOrError(
              assignEdit, `Could not rebind image argument for statusbar '${msg.statusBarId}'. No matching AddStatusBarField call found${rangeInfo}.`,
              cleanupEdit, `Could not clean the previous image entry for statusbar '${msg.statusBarId}'. No matching LoadImage/CatchImage call found${rangeInfo}.`,
            );
            return;
          }

          await applyEditOrError(assignEdit, `Could not rebind image argument for statusbar '${msg.statusBarId}'. No matching AddStatusBarField call found${rangeInfo}.`);
          return;
        }


        case WEBVIEW_TO_EXT_MSG_TYPE.chooseFileAndAssignMenuEntryImage: {
          if (!ensureMenuEntryKind(msg.kind)) return;

          const pickedImageRaw = await pickImageFileRaw();
          if (!pickedImageRaw) {
            return;
          }

          const imageRef = buildImageIdReference(msg.newImageIdRaw, msg.newAssignedVar);
          if (!imageRef) {
            postError(`Could not create image entry for menu '${msg.menuId}'. ${PB_ANY} requires an assigned variable name${rangeInfo}.`);
            return;
          }

          const assignEdit = applyMenuEntryUpdate(
            document,
            msg.menuId,
            msg.sourceLine,
            { kind: msg.kind as any, idRaw: msg.idRaw, textRaw: msg.textRaw, shortcut: msg.shortcut, iconRaw: imageRef },
            sr
          );
          const insertEdit = applyImageInsert(document, { inline: false, idRaw: msg.newImageIdRaw, imageRaw: pickedImageRaw, assignedVar: msg.newAssignedVar }, sr);
          await applyPairedEditsOrError(
            assignEdit, `Could not patch image argument for menu entry in menu '${msg.menuId}'. No matching call found${rangeInfo}.`,
            insertEdit, `Could not insert image entry for menu '${msg.menuId}'. No suitable insertion point found${rangeInfo}.`,
          );
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.chooseFileAndAssignToolBarEntryImage: {
          if (!ensureToolBarEntryKind(msg.kind)) return;

          const pickedImageRaw = await pickImageFileRaw();
          if (!pickedImageRaw) {
            return;
          }

          const imageRef = buildImageIdReference(msg.newImageIdRaw, msg.newAssignedVar);
          if (!imageRef) {
            postError(`Could not create image entry for toolbar '${msg.toolBarId}'. ${PB_ANY} requires an assigned variable name${rangeInfo}.`);
            return;
          }

          const assignEdit = applyToolBarEntryUpdate(
            document,
            msg.toolBarId,
            msg.sourceLine,
            { kind: msg.kind as any, idRaw: msg.idRaw, iconRaw: imageRef, toggle: msg.toggle },
            sr
          );
          const insertEdit = applyImageInsert(document, { inline: false, idRaw: msg.newImageIdRaw, imageRaw: pickedImageRaw, assignedVar: msg.newAssignedVar }, sr);
          await applyPairedEditsOrError(
            assignEdit, `Could not patch image argument for toolbar entry in toolbar '${msg.toolBarId}'. No matching call found${rangeInfo}.`,
            insertEdit, `Could not insert image entry for toolbar '${msg.toolBarId}'. No suitable insertion point found${rangeInfo}.`,
          );
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.rebindToolBarEntryImage: {
          if (!ensureToolBarEntryKind(msg.kind)) return;
          const model = lastModel;
          const assignEdit = applyToolBarEntryUpdate(
            document,
            msg.toolBarId,
            msg.sourceLine,
            { kind: msg.kind as any, idRaw: msg.idRaw, iconRaw: msg.iconRaw, toggle: msg.toggle },
            sr
          );
          const oldImageUsageCount = msg.oldImageId
            ? [
                ...(model?.gadgets ?? []).filter((entry) => entry.imageId === msg.oldImageId),
                ...((model?.menus ?? []).flatMap((menu) => menu.entries.filter((entry) => entry.iconId === msg.oldImageId))),
                ...((model?.toolbars ?? []).flatMap((toolBar) => toolBar.entries.filter((entry) => entry.iconId === msg.oldImageId))),
                ...((model?.statusbars ?? []).flatMap((statusBar) => statusBar.fields.filter((field) => field.imageId === msg.oldImageId))),
              ].length
            : 0;
          const cleanupEdit = msg.oldImageId && oldImageUsageCount === 1 && typeof msg.oldImageSourceLine === "number"
            ? applyImageDelete(document, msg.oldImageSourceLine, sr)
            : undefined;

          if (cleanupEdit) {
            await applyPairedEditsOrError(
              assignEdit, `Could not rebind image argument for toolbar '${msg.toolBarId}'. No matching toolbar image button call found${rangeInfo}.`,
              cleanupEdit, `Could not clean the previous image entry for toolbar '${msg.toolBarId}'. No matching LoadImage/CatchImage call found${rangeInfo}.`,
            );
            return;
          }

          await applyEditOrError(assignEdit, `Could not rebind image argument for toolbar '${msg.toolBarId}'. No matching toolbar image button call found${rangeInfo}.`);
          return;
        }

        case WEBVIEW_TO_EXT_MSG_TYPE.chooseFileAndAssignStatusBarFieldImage: {
          const pickedImageRaw = await pickImageFileRaw();
          if (!pickedImageRaw) {
            return;
          }

          const imageRef = buildImageIdReference(msg.newImageIdRaw, msg.newAssignedVar);
          if (!imageRef) {
            postError(`Could not create image entry for statusbar '${msg.statusBarId}'. ${PB_ANY} requires an assigned variable name${rangeInfo}.`);
            return;
          }

          const assignEdit = applyStatusBarFieldUpdate(document, msg.statusBarId, msg.sourceLine, { widthRaw: msg.widthRaw, imageRaw: imageRef }, sr);
          const insertEdit = applyImageInsert(document, { inline: false, idRaw: msg.newImageIdRaw, imageRaw: pickedImageRaw, assignedVar: msg.newAssignedVar }, sr);
          await applyPairedEditsOrError(
            assignEdit, `Could not patch image argument for statusbar '${msg.statusBarId}'. No matching AddStatusBarField call found${rangeInfo}.`,
            insertEdit, `Could not insert image entry for statusbar '${msg.statusBarId}'. No suitable insertion point found${rangeInfo}.`,
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
    const toolboxIconUrisJson = JSON.stringify(buildToolboxIconUriMap(webview, this.context.extensionUri));

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy"
      content="default-src 'none';
               img-src ${webview.cspSource} data:;
               style-src ${webview.cspSource} 'unsafe-inline';
               script-src 'nonce-${nonce}' ${webview.cspSource};">
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
        grid-template-columns: minmax(0, 1fr) 6px minmax(300px, var(--pbfd-panel-width, 360px));
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

      .panelResizer {
        cursor: col-resize;
        background: var(--vscode-panel-border);
        opacity: 0.35;
        touch-action: none;
        user-select: none;
      }

      .panelResizer:hover,
      .panelResizer.dragging {
        opacity: 1;
        background: var(--vscode-focusBorder);
      }

      .panel {
        border-left: 1px solid var(--vscode-panel-border);
        background: var(--vscode-sideBar-background);
        color: var(--vscode-sideBar-foreground);
        padding: 10px;
        min-width: 300px;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
        overflow: hidden;
      }

      .panelTopSection {
        min-height: 100px;
        height: var(--pbfd-panel-top-height, 230px);
        display: flex;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
      }

      .panelTopTabs {
        display: flex;
        gap: 4px;
      }

      .panelTopTab {
        width: auto;
        padding: 4px 10px;
        border-radius: 6px 6px 0 0;
        border-bottom: 0;
        background: var(--vscode-editorWidget-background);
        color: var(--vscode-sideBar-foreground);
      }

      .panelTopTab.active {
        background: var(--vscode-list-activeSelectionBackground);
        color: var(--vscode-list-activeSelectionForeground);
      }

      .panelTopBody {
        flex: 1;
        min-height: 0;
        border: 1px solid var(--vscode-panel-border);
        background: var(--vscode-editorWidget-background);
        overflow: hidden;
      }

      .panelTopTabPanel {
        box-sizing: border-box;
        height: 100%;
        display: flex;
        flex-direction: column;
        min-height: 0;
        padding: 8px;
        overflow: hidden;
      }

      .panelTopTabPanel[hidden] {
        display: none;
      }

      .panelSectionResizer {
        flex: 0 0 6px;
        border-radius: 999px;
        background: transparent;
        cursor: row-resize;
        touch-action: none;
        user-select: none;
        opacity: 0.65;
      }

      .panelSectionResizer:hover,
      .panelSectionResizer.dragging {
        opacity: 1;
        background: var(--vscode-focusBorder);
      }

      .panelBody {
        flex: 1;
        min-height: 0;
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

      .panelInlineHint {
        margin: 0 0 8px;
      }

      .toolboxTree,
      .objectsTree {
        flex: 1;
        min-height: 0;
        overflow: auto;
      }

      .toolboxCategory {
        margin-bottom: 10px;
      }

      .toolboxCategoryTitle {
        font-weight: 700;
        margin-bottom: 4px;
      }

      .toolboxItem {
        display: grid;
        grid-template-columns: 18px 1fr;
        gap: 8px;
        align-items: center;
        padding: 4px 6px;
        border-radius: 6px;
        cursor: pointer;
        user-select: none;
      }

      .toolboxItem:hover {
        background: var(--vscode-list-hoverBackground);
      }

      .toolboxItem.selected {
        background: var(--vscode-list-activeSelectionBackground);
        color: var(--vscode-list-activeSelectionForeground);
      }

      .toolboxItem.pending {
        outline: 1px solid var(--vscode-focusBorder);
        outline-offset: -1px;
      }

      .toolboxItem.disabled {
        cursor: default;
        opacity: 0.75;
      }

      .toolboxItem.disabled:hover {
        background: transparent;
      }

      .toolboxIcon {
        width: 16px;
        height: 16px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 3px;
        border: 1px solid var(--vscode-panel-border);
        background: var(--vscode-sideBar-background);
        font-size: 10px;
        font-weight: 700;
        line-height: 1;
        overflow: hidden;
      }

      .toolboxIcon img {
        width: 16px;
        height: 16px;
        display: block;
      }

      .toolboxActions {
        margin-top: 8px;
        flex: 0 0 auto;
        align-items: stretch;
      }

      .toolboxActions button {
        min-height: 32px;
      }

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
        display: none;
        margin: 10px 0 8px;
        padding: 8px;
        border-radius: 8px;
        border: 1px solid var(--vscode-notificationsErrorIcon-foreground);
        background: var(--vscode-editorWidget-background);
        color: var(--vscode-editorWidget-foreground);
        font-size: 12px;
        white-space: pre-wrap;
      }

      .subHeader { margin-top: 14px; font-weight: 700; padding: 4px 6px; border: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); }

      .infoSubHeader {
        margin-top: 10px;
        font-weight: 600;
        font-size: 12px;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        opacity: .85;
      }

      .infoSubBody {
        margin: 6px 0 0;
      }

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
        border-radius: 6px;
        padding: 4px 6px;
      }

      .miniRow.selected {
        background: var(--vscode-list-activeSelectionBackground);
        color: var(--vscode-list-activeSelectionForeground);
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

      .canvasContextMenu {
        position: absolute;
        z-index: 20;
        min-width: 200px;
        padding: 6px;
        border-radius: 8px;
        border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border));
        background: var(--vscode-menu-background, var(--vscode-editorWidget-background));
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
      }

      .canvasContextMenuItem {
        width: 100%;
        text-align: left;
        border-radius: 6px;
        background: transparent;
        color: var(--vscode-menu-foreground, var(--vscode-editorWidget-foreground));
        border: 1px solid transparent;
      }

      .canvasContextMenuItem:hover:not(:disabled) {
        background: var(--vscode-list-hoverBackground);
      }

      .canvasContextMenuItem:disabled {
        cursor: default;
        opacity: 0.6;
      }

      .destructiveDialogBackdrop {
        position: fixed;
        inset: 0;
        z-index: 40;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.32);
      }

      .destructiveDialog {
        min-width: 320px;
        max-width: min(420px, calc(100vw - 32px));
        padding: 14px;
        border-radius: 10px;
        border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border));
        background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.32);
      }

      .destructiveDialogTitle {
        font-weight: 600;
        margin-bottom: 8px;
      }

      .row-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }

      .check {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .check input[type="checkbox"] {
        width: auto;
        margin: 0;
        vertical-align: middle;
      }
    </style>
  </head>
  <body>
    <div class="root">
      <div class="canvasWrap"><canvas id="designer"></canvas></div>
      <div id="panelResizer" class="panelResizer" aria-hidden="true"></div>
      <div class="panel">
        <div id="panelTopSection" class="panelTopSection">
          <div class="panelTopTabs" role="tablist" aria-label="Inspector top panel">
            <button id="toolboxTabButton" class="panelTopTab active" type="button" role="tab" aria-selected="true">Toolbox</button>
            <button id="objectsTabButton" class="panelTopTab" type="button" role="tab" aria-selected="false">Objects</button>
          </div>
          <div class="panelTopBody">
            <div id="toolboxTabPanel" class="panelTopTabPanel" role="tabpanel">
              <div class="muted panelInlineHint">Click a gadget to place it on the canvas. Double-click inserts it immediately at the original default position.</div>
              <div id="toolboxList" class="toolboxTree"></div>
              <div class="toolboxActions row-actions">
                <button id="cancelInsertGadgetButton" type="button" style="display:none">Cancel</button>
              </div>
            </div>
            <div id="objectsTabPanel" class="panelTopTabPanel" role="tabpanel" hidden>
              <div class="muted panelInlineHint">Select Parent lets you quickly navigate to a container/root.</div>
              <div class="row" style="grid-template-columns: 110px 1fr;">
                <div>Select Parent</div>
                <select id="parentSel"></select>
              </div>
              <div id="list" class="objectsTree"></div>
            </div>
          </div>
        </div>
        <div id="panelSectionResizer" class="panelSectionResizer" aria-hidden="true"></div>
        <div id="panelBody" class="panelBody">
          <div class="subHeader">Info</div>
          <div id="diag" class="diag" style="display:none"></div>
          <div id="err" class="err"></div>
          <div id="infoHint" class="muted" style="margin:8px 0 10px"></div>
          <div class="infoSubHeader">Selection</div>
          <div id="infoSelection" class="muted infoSubBody"></div>
          <div id="props"></div>
        </div>
      </div>
    </div>

    <script nonce="${nonce}">window.__PBFD_SYMBOLS__ = ${symbolsJson}; window.__PBFD_TOOLBOX_ICON_URIS__ = ${toolboxIconUrisJson};</script>
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