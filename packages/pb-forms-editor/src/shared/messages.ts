/**
 * Shared message contract between the VS Code extension host and the webview.
 * Both sides import from this module — never define message types locally.
 *
 * Naming convention:
 *   EXT_TO_WEBVIEW_MSG_TYPE  — messages sent by the extension → webview
 *   WEBVIEW_TO_EXT_MSG_TYPE  — messages sent by the webview → extension
 */
import type { MenuEntryMovePlacement } from "./menu";
import type { DesignerSettings } from "./designer-settings";

export const EXT_TO_WEBVIEW_MSG_TYPE = {
  init: "init",
  settings: "settings",
  error: "error",
  windowsSystemColors: "windowsSystemColors",
  procedureNames: "procedureNames"
} as const;

export const WEBVIEW_TO_EXT_MSG_TYPE = {
  ready: "ready",

  moveGadget: "moveGadget",
  setGadgetRect: "setGadgetRect",
  setGadgetOpenArgs: "setGadgetOpenArgs",
  setCustomGadgetCode: "setCustomGadgetCode",
  setGadgetProperties: "setGadgetProperties",
  setGadgetEventProc: "setGadgetEventProc",
  setGadgetImageRaw: "setGadgetImageRaw",
  setGadgetStateRaw: "setGadgetStateRaw",
  setGadgetResizeRaw: "setGadgetResizeRaw",
  toggleGadgetPbAny: "toggleGadgetPbAny",
  setGadgetEnumValue: "setGadgetEnumValue",
  setGadgetVariableName: "setGadgetVariableName",
  setWindowRect: "setWindowRect",
  setWindowOpenArgs: "setWindowOpenArgs",
  setWindowProperties: "setWindowProperties",
  toggleWindowPbAny: "toggleWindowPbAny",
  setWindowEnumValue: "setWindowEnumValue",
  setWindowVariableName: "setWindowVariableName",
  setWindowEventFile: "setWindowEventFile",
  setWindowEventProc: "setWindowEventProc",
  setWindowGenerateEventLoop: "setWindowGenerateEventLoop",

  insertGadget: "insertGadget",
  reparentGadget: "reparentGadget",
  deleteGadget: "deleteGadget",
  insertGadgetItem: "insertGadgetItem",
  updateGadgetItem: "updateGadgetItem",
  deleteGadgetItem: "deleteGadgetItem",

  insertGadgetColumn: "insertGadgetColumn",
  updateGadgetColumn: "updateGadgetColumn",
  deleteGadgetColumn: "deleteGadgetColumn",

  insertMenuEntry: "insertMenuEntry",
  moveMenuEntry: "moveMenuEntry",
  updateMenuEntry: "updateMenuEntry",
  deleteMenuEntry: "deleteMenuEntry",
  deleteMenu: "deleteMenu",
  setMenuEntryEvent: "setMenuEntryEvent",

  insertToolBarEntry: "insertToolBarEntry",
  updateToolBarEntry: "updateToolBarEntry",
  deleteToolBarEntry: "deleteToolBarEntry",
  deleteToolBar: "deleteToolBar",
  setToolBarEntryEvent: "setToolBarEntryEvent",
  setToolBarEntryTooltip: "setToolBarEntryTooltip",

  insertStatusBarField: "insertStatusBarField",
  updateStatusBarField: "updateStatusBarField",
  deleteStatusBarField: "deleteStatusBarField",
  deleteStatusBar: "deleteStatusBar",

  insertImage: "insertImage",
  updateImage: "updateImage",
  deleteImage: "deleteImage",
  relativizeImagePath: "relativizeImagePath",
  chooseImageFileForEntry: "chooseImageFileForEntry",
  toggleImagePbAny: "toggleImagePbAny",

  createAndAssignGadgetImage: "createAndAssignGadgetImage",
  chooseFileAndAssignGadgetImage: "chooseFileAndAssignGadgetImage",
  createAndAssignMenuEntryImage: "createAndAssignMenuEntryImage",
  createAndAssignToolBarEntryImage: "createAndAssignToolBarEntryImage",
  createAndAssignStatusBarFieldImage: "createAndAssignStatusBarFieldImage",
  chooseFileAndAssignMenuEntryImage: "chooseFileAndAssignMenuEntryImage",
  chooseFileAndAssignToolBarEntryImage: "chooseFileAndAssignToolBarEntryImage",
  chooseFileAndAssignStatusBarFieldImage: "chooseFileAndAssignStatusBarFieldImage",
  rebindMenuEntryImage: "rebindMenuEntryImage",
  rebindToolBarEntryImage: "rebindToolBarEntryImage",
  rebindStatusBarFieldImage: "rebindStatusBarFieldImage"
} as const;

/** Colors read from HKCU\Control Panel\Colors (win32 only).
 *  Sent once on startup via windowsSystemColors; fields not covered
 *  by CSS system-color keywords. All values are "R G B" space-separated. */
export type WindowsRegistryColors = {
  menu: string;
  menuBar: string;
  menuText: string;
  menuHilight: string;
  activeTitle: string;
  gradientActiveTitle: string;
  inactiveTitle: string;
  titleText: string;
  hotTrackingColor: string;
  scrollbar: string;
};

/** Messages from the extension host to the webview.
 *  ModelT is FormDocument on the extension side, Model on the webview side. */
export type ExtensionToWebviewMessage<ModelT = unknown> =
  | { type: typeof EXT_TO_WEBVIEW_MSG_TYPE.init; model: ModelT; settings?: DesignerSettings }
  | { type: typeof EXT_TO_WEBVIEW_MSG_TYPE.settings; settings: DesignerSettings }
  | { type: typeof EXT_TO_WEBVIEW_MSG_TYPE.error; message: string }
  | { type: typeof EXT_TO_WEBVIEW_MSG_TYPE.windowsSystemColors; colors: WindowsRegistryColors }
  | { type: typeof EXT_TO_WEBVIEW_MSG_TYPE.procedureNames; names: string[] };

  /** Messages from the webview to the extension host. */
export type WebviewToExtensionMessage =
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.ready }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.moveGadget; id: string; x: number; y: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setGadgetRect; id: string; x: number; y: number; w: number; h: number; yRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setGadgetOpenArgs; id: string; textRaw?: string; textVariable?: boolean; minRaw?: string; maxRaw?: string; flagsExpr?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setCustomGadgetCode; id: string; customInitRaw?: string; customCreateRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setGadgetProperties; id: string; hiddenRaw?: string; disabledRaw?: string; tooltipRaw?: string; frontColorRaw?: string; backColorRaw?: string; gadgetFontRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setGadgetEventProc; id: string; eventProc?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setGadgetImageRaw; id: string; imageRaw: string; oldImageId?: string; oldImageSourceLine?: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setGadgetStateRaw; id: string; stateRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setGadgetResizeRaw; id: string; xRaw?: string; yRaw?: string; wRaw?: string; hRaw?: string; deleteResize?: boolean }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.toggleGadgetPbAny; gadgetId: string; toPbAny: boolean; variableName: string; enumSymbol: string; enumValueRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setGadgetEnumValue; enumSymbol: string; enumValueRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setGadgetVariableName; gadgetId: string; variableName: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setWindowRect; id: string; x: number; y: number; w: number; h: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setWindowOpenArgs; windowKey: string; xRaw?: string; yRaw?: string; wRaw?: string; hRaw?: string; captionRaw?: string; flagsExpr?: string; parentRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setWindowProperties; windowKey: string; hiddenRaw?: string; disabledRaw?: string; colorRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.toggleWindowPbAny; windowKey: string; toPbAny: boolean; variableName: string; enumSymbol: string; enumValueRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setWindowEnumValue; enumSymbol: string; enumValueRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setWindowVariableName; windowKey: string; variableName?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setWindowEventFile; windowKey: string; eventFile?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setWindowEventProc; windowKey: string; eventProc?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setWindowGenerateEventLoop; windowKey: string; enabled: boolean }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.insertGadget; kind: string; x: number; y: number; yRaw?: string; parentId?: string; parentItem?: number; gadget1Id?: string; gadget2Id?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.reparentGadget; id: string; parentId?: string; parentItem?: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.deleteGadget; id: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.insertGadgetItem; id: string; posRaw: string; textRaw: string; imageRaw?: string; flagsRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.updateGadgetItem; id: string; sourceLine: number; posRaw: string; textRaw: string; imageRaw?: string; flagsRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.deleteGadgetItem; id: string; sourceLine: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.insertGadgetColumn; id: string; colRaw: string; titleRaw: string; widthRaw: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.updateGadgetColumn; id: string; sourceLine: number; colRaw: string; titleRaw: string; widthRaw: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.deleteGadgetColumn; id: string; sourceLine: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.insertMenuEntry; menuId: string; kind: string; idRaw?: string; textRaw?: string; parentSourceLine?: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.moveMenuEntry; menuId: string; sourceLine: number; kind: string; targetSourceLine: number; placement: MenuEntryMovePlacement }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.updateMenuEntry; menuId: string; sourceLine: number; kind: string; idRaw?: string; textRaw?: string; shortcut?: string; iconRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.deleteMenuEntry; menuId: string; sourceLine: number; kind: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.deleteMenu; menuId: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setMenuEntryEvent; entryIdRaw: string; eventProc?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.insertToolBarEntry; toolBarId: string; kind: string; idRaw?: string; iconRaw?: string; textRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.updateToolBarEntry; toolBarId: string; sourceLine: number; kind: string; idRaw?: string; iconRaw?: string; textRaw?: string; toggle?: boolean }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.deleteToolBarEntry; toolBarId: string; sourceLine: number; kind: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.deleteToolBar; toolBarId: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setToolBarEntryEvent; entryIdRaw: string; eventProc?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setToolBarEntryTooltip; toolBarId: string; sourceLine: number; entryIdRaw: string; textRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.insertStatusBarField; statusBarId: string; widthRaw: string; textRaw?: string; imageRaw?: string; flagsRaw?: string; progressBar?: boolean; progressRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.updateStatusBarField; statusBarId: string; sourceLine: number; widthRaw: string; textRaw?: string; imageRaw?: string; flagsRaw?: string; progressBar?: boolean; progressRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.deleteStatusBarField; statusBarId: string; sourceLine: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.deleteStatusBar; statusBarId: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.insertImage; inline: boolean; idRaw: string; imageRaw: string; assignedVar?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.updateImage; sourceLine: number; inline: boolean; idRaw: string; imageRaw: string; assignedVar?: string; pbAny?: boolean }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.deleteImage; sourceLine: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.relativizeImagePath; sourceLine: number; inline: boolean; idRaw: string; imageRaw: string; assignedVar?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.chooseImageFileForEntry; sourceLine: number; inline: boolean; idRaw: string; assignedVar?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.toggleImagePbAny; sourceLine: number; toPbAny: boolean }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.createAndAssignGadgetImage; id: string; newInline: boolean; newImageIdRaw: string; newImageRaw: string; newAssignedVar?: string; oldImageId?: string; oldImageSourceLine?: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.chooseFileAndAssignGadgetImage; id: string; x: number; y: number; resizeToImage: boolean; newImageIdRaw: string; newAssignedVar?: string; oldImageId?: string; oldImageSourceLine?: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.createAndAssignMenuEntryImage; menuId: string; sourceLine: number; kind: string; idRaw?: string; textRaw?: string; shortcut?: string; newInline: boolean; newImageIdRaw: string; newImageRaw: string; newAssignedVar?: string; oldImageId?: string; oldImageSourceLine?: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.createAndAssignToolBarEntryImage; toolBarId: string; sourceLine: number; kind: string; idRaw?: string; toggle?: boolean; newInline: boolean; newImageIdRaw: string; newImageRaw: string; newAssignedVar?: string; oldImageId?: string; oldImageSourceLine?: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.createAndAssignStatusBarFieldImage; statusBarId: string; sourceLine: number; widthRaw: string; newInline: boolean; newImageIdRaw: string; newImageRaw: string; newAssignedVar?: string; oldImageId?: string; oldImageSourceLine?: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.chooseFileAndAssignMenuEntryImage; menuId: string; sourceLine: number; kind: string; idRaw?: string; textRaw?: string; shortcut?: string; newImageIdRaw: string; newAssignedVar?: string; oldImageId?: string; oldImageSourceLine?: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.chooseFileAndAssignToolBarEntryImage; toolBarId: string; sourceLine: number; kind: string; idRaw?: string; toggle?: boolean; newImageIdRaw: string; newAssignedVar?: string; oldImageId?: string; oldImageSourceLine?: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.chooseFileAndAssignStatusBarFieldImage; statusBarId: string; sourceLine: number; widthRaw: string; newImageIdRaw: string; newAssignedVar?: string; oldImageId?: string; oldImageSourceLine?: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.rebindMenuEntryImage; menuId: string; sourceLine: number; kind: string; idRaw?: string; textRaw?: string; shortcut?: string; iconRaw: string; oldImageId?: string; oldImageSourceLine?: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.rebindToolBarEntryImage; toolBarId: string; sourceLine: number; kind: string; idRaw?: string; toggle?: boolean; iconRaw: string; oldImageId?: string; oldImageSourceLine?: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.rebindStatusBarFieldImage; statusBarId: string; sourceLine: number; widthRaw: string; imageRaw: string; oldImageId?: string; oldImageSourceLine?: number };
