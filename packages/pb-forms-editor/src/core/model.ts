export const GADGET_KIND = {
  ButtonGadget: "ButtonGadget",
  ButtonImageGadget: "ButtonImageGadget",
  StringGadget: "StringGadget",
  TextGadget: "TextGadget",
  CheckBoxGadget: "CheckBoxGadget",
  OptionGadget: "OptionGadget",
  FrameGadget: "FrameGadget",
  ComboBoxGadget: "ComboBoxGadget",
  ListViewGadget: "ListViewGadget",
  ListIconGadget: "ListIconGadget",
  TreeGadget: "TreeGadget",
  EditorGadget: "EditorGadget",
  SpinGadget: "SpinGadget",
  TrackBarGadget: "TrackBarGadget",
  ProgressBarGadget: "ProgressBarGadget",
  ImageGadget: "ImageGadget",
  HyperLinkGadget: "HyperLinkGadget",
  CalendarGadget: "CalendarGadget",
  DateGadget: "DateGadget",
  ContainerGadget: "ContainerGadget",
  PanelGadget: "PanelGadget",
  ScrollAreaGadget: "ScrollAreaGadget",
  SplitterGadget: "SplitterGadget",
  WebViewGadget: "WebViewGadget",
  WebGadget: "WebGadget",
  OpenGLGadget: "OpenGLGadget",
  CanvasGadget: "CanvasGadget",
  ExplorerTreeGadget: "ExplorerTreeGadget",
  ExplorerListGadget: "ExplorerListGadget",
  ExplorerComboGadget: "ExplorerComboGadget",
  IPAddressGadget: "IPAddressGadget",
  ScrollBarGadget: "ScrollBarGadget",
  ScintillaGadget: "ScintillaGadget",
  Unknown: "Unknown",
} as const;

export type GadgetKind =  typeof GADGET_KIND[keyof typeof GADGET_KIND]
export const GADGET_KIND_SET: ReadonlySet<GadgetKind> = new Set(Object.values(GADGET_KIND));

export interface SourceRange {
  start: number;
  end: number;
  line: number;
  lineStart: number;
}

export interface Gadget {
  id: string;            // stable key for patching (assigned var for #PB_Any, else first param)
  kind: GadgetKind;
  pbAny: boolean;
  variable?: string;     // e.g. "Gadget_1" (used when pbAny is true)
  firstParam: string;    // raw first param token
  parentId?: string;     // parent gadget id (Container/Panel/ScrollArea/OpenGadgetList)
  parentItem?: number;   // for PanelGadget children: active tab index (best-effort)
  x: number;
  y: number;
  w: number;
  h: number;
  textRaw?: string;      // raw caption/text expression from the gadget constructor
  text?: string;
  textVariable?: boolean;
  imageRaw?: string;     // raw image expression from the gadget constructor
  imageId?: string;      // normalized image identifier extracted from ImageID(...)
  minRaw?: string;       // raw minimum/range start expression from the gadget constructor
  min?: number;
  maxRaw?: string;       // raw maximum/range end expression from the gadget constructor
  max?: number;
  gadget1Raw?: string;   // raw first child gadget reference for SplitterGadget(...)
  gadget1Id?: string;    // normalized first child gadget id/reference
  gadget2Raw?: string;   // raw second child gadget reference for SplitterGadget(...)
  gadget2Id?: string;    // normalized second child gadget id/reference
  splitterId?: string;   // normalized owning splitter gadget id for gadgets inside a splitter
  flagsExpr?: string;
  tooltipRaw?: string;   // raw tooltip expression from GadgetToolTip(...)
  tooltip?: string;
  tooltipVariable?: boolean;
  stateRaw?: string;     // raw state expression from SetGadgetState(...)
  state?: number;
  frontColorRaw?: string;
  frontColor?: number;
  backColorRaw?: string;
  backColor?: number;
  gadgetFontRaw?: string;   // raw FontID(...) expression from SetGadgetFont(...)
  gadgetFont?: string;
  gadgetFontSize?: number;
  gadgetFontFlagsRaw?: string;
  hiddenRaw?: string;
  hidden?: boolean;
  disabledRaw?: string;
  disabled?: boolean;
  items?: GadgetItem[];
  columns?: GadgetColumn[];
  source?: SourceRange;
}

export interface GadgetItem {
  index?: number;        // resolved index (best-effort)
  posRaw: string;        // raw position expression
  textRaw?: string;      // raw text expression
  text?: string;         // unquoted text (when possible)
  imageRaw?: string;     // optional image expression
  flagsRaw?: string;     // optional flags expression
  source?: SourceRange;
}

export interface GadgetColumn {
  index?: number;        // resolved index (best-effort)
  colRaw: string;        // raw column index expression
  titleRaw?: string;     // raw title expression
  title?: string;        // unquoted title (when possible)
  widthRaw?: string;     // raw width expression
  source?: SourceRange;
}

export interface FormWindow {
  id: string;            // stable key for window (assigned var for #PB_Any, else enum symbol)
  pbAny: boolean;
  variable?: string;     // e.g. "Dlg" (used when pbAny is true)
  enumValueRaw?: string; // e.g. "500" or undefined if assigned var is used
  firstParam: string;
  x: number;
  y: number;
  w: number;
  h: number;
  captionRaw?: string;       // raw caption expression from OpenWindow(...)
  caption?: string;          // canonical field matching original FormWindow\caption
  captionVariable?: boolean; // matches original FormWindow\captionvariable
  title?: string;            // temporary compatibility alias for current extension code
  flagsExpr?: string;
  knownFlags?: string[];
  colorRaw?: string;         // raw color expression from SetWindowColor(...)
  color?: number;
  generateEventLoop?: boolean;
  disabledRaw?: string;      // raw disabled expression from DisableWindow(...)
  disabled?: boolean;
  hiddenRaw?: string;        // raw hidden expression from HideWindow(...)
  hidden?: boolean;
  parentRaw?: string;        // raw parent expression from OpenWindow(..., parent)
  parent?: string;
  eventFile?: string;
  eventProc?: string;
  customFlags?: string[];
  source?: SourceRange;
}

export type FormIssueSeverity = "error" | "warning" | "info";

export interface FormIssue {
  severity: FormIssueSeverity;
  message: string;
  line?: number;
}

export interface FormHeaderInfo {
  version?: string;
  line: number;
  hasStrictSyntaxWarning: boolean;
}

export interface ScanRange {
  start: number;
  end: number;
}

export interface FormMeta {
  header?: FormHeaderInfo;
  scanRange: ScanRange;
  issues: FormIssue[];
  enums?: FormEnumerations;
}

export interface FormEnumerations {
  windows: string[];
  gadgets: string[];
}


export const MENU_ENTRY_KIND = {
  MenuTitle: "MenuTitle",
  MenuItem: "MenuItem",
  MenuBar: "MenuBar",
  OpenSubMenu: "OpenSubMenu",
  CloseSubMenu: "CloseSubMenu",
  Unknown: "Unknown",
} as const;

export type MenuEntryKind = typeof MENU_ENTRY_KIND[keyof typeof MENU_ENTRY_KIND];
export const MENU_ENTRY_KIND_SET: ReadonlySet<MenuEntryKind> = new Set(Object.values(MENU_ENTRY_KIND));

export interface FormMenuEntry {
  kind: MenuEntryKind;
  level?: number;        // nesting level (OpenSubMenu / CloseSubMenu)
  idRaw?: string;        // raw id token (MenuItem)
  textRaw?: string;      // raw title/text token
  text?: string;         // unquoted (when possible)
  shortcut?: string;     // parsed shortcut suffix from MenuItem(...)
  iconRaw?: string;      // raw ImageID(...) expression for menu icons
  iconId?: string;       // normalized image identifier for menu icons
  widthRaw?: string;     // for StatusBar fields (optional)
  source?: SourceRange;
}

export interface FormMenu {
  id: string;
  entries: FormMenuEntry[];
  source?: SourceRange;
}

export const TOOLBAR_ENTRY_KIND = {
  ToolBarStandardButton: "ToolBarStandardButton",
  ToolBarButton: "ToolBarButton",
  ToolBarImageButton: "ToolBarImageButton",
  ToolBarSeparator: "ToolBarSeparator",
  ToolBarToolTip: "ToolBarToolTip",
  Unknown: "Unknown",
} as const;

export type ToolBarEntryKind = typeof TOOLBAR_ENTRY_KIND[keyof typeof TOOLBAR_ENTRY_KIND];
export const TOOLBAR_ENTRY_KIND_SET: ReadonlySet<ToolBarEntryKind> = new Set(Object.values(TOOLBAR_ENTRY_KIND));

export interface FormToolBarEntry {
  kind: ToolBarEntryKind;
  idRaw?: string;
  iconRaw?: string;
  iconId?: string;
  textRaw?: string;
  text?: string;
  tooltip?: string;
  toggle?: boolean;
  source?: SourceRange;
}

export interface FormToolBar {
  id: string;
  entries: FormToolBarEntry[];
  source?: SourceRange;
}

export interface FormStatusBarField {
  widthRaw: string;
  textRaw?: string;
  text?: string;
  imageRaw?: string;
  imageId?: string;
  flagsRaw?: string;
  progressBar?: boolean;
  progressRaw?: string;
  source?: SourceRange;
}

export interface FormStatusBar {
  id: string;
  fields: FormStatusBarField[];
  source?: SourceRange;
}

export interface FormImage {
  id: string;            // stable key for patching/references (assigned var for #PB_Any, else first param)
  pbAny: boolean;
  variable?: string;     // e.g. "imgSave" when #PB_Any is used with an assigned variable
  firstParam: string;    // raw first param token
  imageRaw: string;      // raw file or data-label expression from LoadImage/CatchImage
  image?: string;        // normalized file path or data label (without leading '?')
  inline: boolean;       // CatchImage(...) stores inline image data labels
  source?: SourceRange;
}

export interface FormDocument {
  window?: FormWindow;
  images: FormImage[];
  gadgets: Gadget[];
  menus: FormMenu[];
  toolbars: FormToolBar[];
  statusbars: FormStatusBar[];
  meta: FormMeta;
}

export const ENUM_NAMES = {
  windows: "FormWindow", 
  gadgets: "FormGadget"
} as const;

// PBFD_* constants: shared symbol sets from the PureBasic Form Designer.
// These are used by the parser/emitter and injected into the webview
// to ensure consistency of identifiers (menu entries, toolbar buttons, container gadgets, etc.)
// and to avoid magic strings or mismatches between extension and webview.
export const PBFD_MENU_ENTRY_KINDS = [MENU_ENTRY_KIND.MenuTitle, MENU_ENTRY_KIND.MenuItem, MENU_ENTRY_KIND.MenuBar, MENU_ENTRY_KIND.OpenSubMenu, MENU_ENTRY_KIND.CloseSubMenu] as const;
export const PBFD_TOOLBAR_ENTRY_KINDS = [TOOLBAR_ENTRY_KIND.ToolBarButton, TOOLBAR_ENTRY_KIND.ToolBarImageButton, TOOLBAR_ENTRY_KIND.ToolBarStandardButton, TOOLBAR_ENTRY_KIND.ToolBarSeparator, TOOLBAR_ENTRY_KIND.ToolBarToolTip] as const;
export const PBFD_CONTAINER_GADGET_KINDS = [GADGET_KIND.ContainerGadget, GADGET_KIND.PanelGadget, GADGET_KIND.ScrollAreaGadget] as const;
export const PBFD_ENUM_NAMES = ENUM_NAMES;

export const PBFD_SYMBOLS = {
  menuEntryKinds: PBFD_MENU_ENTRY_KINDS,
  toolBarEntryKinds: PBFD_TOOLBAR_ENTRY_KINDS,
  containerGadgetKinds: PBFD_CONTAINER_GADGET_KINDS,
  enumNames: PBFD_ENUM_NAMES
} as const;
