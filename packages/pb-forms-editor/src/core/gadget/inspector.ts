import { GADGET_KIND } from "../model";
import { parsePbStringLiteral } from "../parser/pb-string";
import { quotePbString } from "../parser/tokenizer";
import {
  parseDesignerLayoutRaw,
  parseUnscaledLayoutRaw,
  type DesignerLayoutNumericField,
} from "../parser/layout-raw";
import { unscaleDisplayedLayoutValue } from "../utils/layout-dpi";
import type { PreviewPlatform } from "../utils/form-settings-runtime";

export type GadgetTextLike = {
  textRaw?: string;
  text?: string;
  textVariable?: boolean;
};

export type GadgetTooltipLike = {
  tooltipRaw?: string;
  tooltip?: string;
  tooltipVariable?: boolean;
};

export type GadgetFontLike = {
  gadgetFontRaw?: string;
  gadgetFont?: string;
  gadgetFontSize?: number;
  gadgetFontFlagsRaw?: string;
};

export type GadgetParentDisplayLike = {
  variable?: string;
  firstParam: string;
};

export type GadgetCtorRangeLike = {
  minRaw?: string;
  min?: number;
  maxRaw?: string;
  max?: number;
};

export type GadgetCurrentImageLike = {
  imageRaw?: string;
};

export type GadgetImageRowsFieldConfig = {
  currentImageVisible: boolean;
  currentImageEditable: boolean;
  changeImageVisible: boolean;
  changeImageAvailable: boolean;
  currentImageTitle: string;
  changeImageTitle: string;
};

export type GadgetCheckedStateFieldConfig = {
  visible: boolean;
  valueEditable: boolean;
  label: string;
  title: string;
};

export type GadgetVisibilityStateFieldConfig = {
  visible: boolean;
  valueEditable: boolean;
  hiddenLabel: string;
  disabledLabel: string;
  hiddenTitle: string;
  hiddenCustomExpressionTitle: string;
  disabledTitle: string;
  disabledCustomExpressionTitle: string;
};

export type GadgetLayoutFieldConfig = {
  visible: boolean;
  valueEditable: boolean;
  xLabel: string;
  yLabel: string;
  widthLabel: string;
  heightLabel: string;
  xTitle: string;
  yTitle: string;
  widthTitle: string;
  heightTitle: string;
  xUnscaledLabel: string;
  yUnscaledLabel: string;
  widthUnscaledLabel: string;
  heightUnscaledLabel: string;
  xUnscaledTitle: string;
  yUnscaledTitle: string;
  widthUnscaledTitle: string;
  heightUnscaledTitle: string;
};

export type GadgetSplitterPositionFieldConfig = {
  visible: boolean;
  valueEditable: boolean;
  label: string;
  title: string;
  valuePolicy: "bounded-by-current-orientation-size";
};

export type GadgetColorRowsFieldConfig = {
  visible: boolean;
  frontColorVisible: boolean;
  backColorVisible: boolean;
  valueEditable: boolean;
  frontColorLabel: string;
  backColorLabel: string;
  frontColorTitle: string;
  backColorTitle: string;
};

export type GadgetImageEntryLike = {
  image?: string;
  imageRaw?: string;
};

export type GadgetCtorRangeFieldLabels = {
  minLabel: string;
  maxLabel: string;
  minTitle: string;
  maxTitle: string;
};

export type GadgetItemEditorFieldConfig = {
  visible: boolean;
  itemTextTitle: string;
  positionRawTitle: string;
  imageRawTitle: string;
  flagsRawTitle: string;
  addButtonTitle: string;
};

export type GadgetColumnEditorFieldConfig = {
  visible: boolean;
  columnTitleTitle: string;
  indexRawTitle: string;
  widthRawTitle: string;
  addButtonTitle: string;
};

export type GadgetCaptionFieldConfig = {
  label: string;
  textEditable: boolean;
  variableToggleEditable: boolean;
  variableToggleTitle: string;
  variableToggleUnavailableTitle: string;
  textTitle: string;
  textUnavailableTitle: string;
};

export type GadgetTooltipFieldConfig = {
  valueEditable: boolean;
  variableToggleEditable: boolean;
  variableToggleTitle: string;
  variableToggleUnavailableTitle: string;
  valueTitle: string;
  valueUnavailableTitle: string;
};

export type GadgetSelectProcFieldConfig = {
  valueEditable: boolean;
  preservesGridString: boolean;
  title: string;
  placeholder: string;
};

export type GadgetParentFieldConfig = {
  visible: boolean;
  valueEditable: boolean;
  selectTargetAvailable: boolean;
  changeDialogAvailable: boolean;
  title: string;
};

export type GadgetResizeLockFieldConfig = {
  visible: boolean;
  valueEditablePolicy: "safe-resize-patch-only";
  title: string;
};

export type GadgetFontFieldConfig = {
  visible: boolean;
  rawEditable: boolean;
  title: string;
};

export type GadgetConstantsFieldConfig = {
  visible: boolean;
  knownFlags: readonly string[];
  title: string;
};

export type CustomGadgetSelectPresetFieldConfig = {
  valueEditable: boolean;
  persisted: boolean;
  title: string;
};

export type CustomGadgetCodeRowsFieldConfig = {
  visible: boolean;
  selectGadgetLabel: string;
  initCodeLabel: string;
  createCodeLabel: string;
  helpLabel: string;
  initCodeTitle: string;
  createCodeTitle: string;
  helpTitle: string;
  note: string;
};

export type GadgetResizeLockLike = {
  parentId?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  xRaw?: string;
  yRaw?: string;
  wRaw?: string;
  hRaw?: string;
  resizeXRaw?: string;
  resizeYRaw?: string;
  resizeWRaw?: string;
  resizeHRaw?: string;
  resizeSource?: { line: number };
  lockLeft?: boolean;
  lockRight?: boolean;
  lockTop?: boolean;
  lockBottom?: boolean;
};

export type PbFormSkinLike = PreviewPlatform;

export type WindowResizeLockLike = {
  w: number;
  wRaw?: string;
  h?: number;
  hRaw?: string;
  menuCount?: number;
  toolbarCount?: number;
  statusBarCount?: number;
  platformSkin?: PbFormSkinLike;
  layoutDpiScale?: number;
  parent?: ParentResizeLockLike;
};

export type ParentResizeLockLike = {
  id: string;
  kind: string;
  pbAny?: boolean;
  variable?: string;
  firstParam?: string;
  w: number;
  wRaw?: string;
  h: number;
  hRaw?: string;
};

export type GadgetResizeRawUpdate = {
  deleteResize?: boolean;
  xRaw?: string;
  yRaw?: string;
  wRaw?: string;
  hRaw?: string;
};

export type GadgetInspectorDetailsLike = {
  parentId?: string;
  parentItem?: number;
};

const GADGET_CAPTION_VISIBLE_KINDS: ReadonlySet<string> = new Set([
  GADGET_KIND.ButtonGadget,
  GADGET_KIND.ButtonImageGadget,
  GADGET_KIND.CalendarGadget,
  GADGET_KIND.CanvasGadget,
  GADGET_KIND.CheckBoxGadget,
  GADGET_KIND.ComboBoxGadget,
  GADGET_KIND.ContainerGadget,
  GADGET_KIND.CustomGadget,
  GADGET_KIND.DateGadget,
  GADGET_KIND.EditorGadget,
  GADGET_KIND.ExplorerComboGadget,
  GADGET_KIND.ExplorerListGadget,
  GADGET_KIND.ExplorerTreeGadget,
  GADGET_KIND.FrameGadget,
  GADGET_KIND.HyperLinkGadget,
  GADGET_KIND.ImageGadget,
  GADGET_KIND.IPAddressGadget,
  GADGET_KIND.ListIconGadget,
  GADGET_KIND.ListViewGadget,
  GADGET_KIND.OpenGLGadget,
  GADGET_KIND.OptionGadget,
  GADGET_KIND.PanelGadget,
  GADGET_KIND.ProgressBarGadget,
  GADGET_KIND.ScintillaGadget,
  GADGET_KIND.ScrollAreaGadget,
  GADGET_KIND.ScrollBarGadget,
  GADGET_KIND.SpinGadget,
  GADGET_KIND.SplitterGadget,
  GADGET_KIND.StringGadget,
  GADGET_KIND.TextGadget,
  GADGET_KIND.TrackBarGadget,
  GADGET_KIND.TreeGadget,
  GADGET_KIND.WebGadget,
  GADGET_KIND.WebViewGadget,
]);

const GADGET_TEXT_CAPABLE_KINDS: ReadonlySet<string> = new Set([
  GADGET_KIND.ButtonGadget,
  GADGET_KIND.CheckBoxGadget,
  GADGET_KIND.CustomGadget,
  GADGET_KIND.DateGadget,
  GADGET_KIND.ExplorerComboGadget,
  GADGET_KIND.ExplorerListGadget,
  GADGET_KIND.ExplorerTreeGadget,
  GADGET_KIND.FrameGadget,
  GADGET_KIND.HyperLinkGadget,
  GADGET_KIND.ListIconGadget,
  GADGET_KIND.OptionGadget,
  GADGET_KIND.ScintillaGadget,
  GADGET_KIND.StringGadget,
  GADGET_KIND.TextGadget,
  GADGET_KIND.WebGadget,
]);

const GADGET_CAPTION_VARIABLE_CAPABLE_KINDS: ReadonlySet<string> = new Set([
  GADGET_KIND.ButtonGadget,
  GADGET_KIND.CheckBoxGadget,
  GADGET_KIND.CustomGadget,
  GADGET_KIND.DateGadget,
  GADGET_KIND.ExplorerComboGadget,
  GADGET_KIND.ExplorerListGadget,
  GADGET_KIND.ExplorerTreeGadget,
  GADGET_KIND.FrameGadget,
  GADGET_KIND.HyperLinkGadget,
  GADGET_KIND.OptionGadget,
  GADGET_KIND.StringGadget,
  GADGET_KIND.TextGadget,
  GADGET_KIND.WebGadget,
]);

const GADGET_CHECKED_STATE_CAPABLE_KINDS: ReadonlySet<string> = new Set([
  GADGET_KIND.CheckBoxGadget,
  GADGET_KIND.OptionGadget,
]);

const GADGET_IMAGE_ROW_CAPABLE_KINDS: ReadonlySet<string> = new Set([
  GADGET_KIND.ImageGadget,
  GADGET_KIND.ButtonImageGadget,
]);

const GADGET_CTOR_RANGE_FIELD_LABELS: ReadonlyMap<
  string,
  GadgetCtorRangeFieldLabels
> = new Map([
  [
    GADGET_KIND.ProgressBarGadget,
    {
      minLabel: "Min",
      maxLabel: "Max",
      minTitle: "Edit the raw minimum value expression for this gadget.",
      maxTitle: "Edit the raw maximum value expression for this gadget.",
    },
  ],
  [
    GADGET_KIND.ScrollBarGadget,
    {
      minLabel: "Min",
      maxLabel: "Max",
      minTitle: "Edit the raw minimum value expression for this gadget.",
      maxTitle: "Edit the raw maximum value expression for this gadget.",
    },
  ],
  [
    GADGET_KIND.SpinGadget,
    {
      minLabel: "Min",
      maxLabel: "Max",
      minTitle: "Edit the raw minimum value expression for this gadget.",
      maxTitle: "Edit the raw maximum value expression for this gadget.",
    },
  ],
  [
    GADGET_KIND.TrackBarGadget,
    {
      minLabel: "Min",
      maxLabel: "Max",
      minTitle: "Edit the raw minimum value expression for this gadget.",
      maxTitle: "Edit the raw maximum value expression for this gadget.",
    },
  ],
  [
    GADGET_KIND.ScrollAreaGadget,
    {
      minLabel: "InnerWidth",
      maxLabel: "InnerHeight",
      minTitle: "Edit the raw inner width expression for this scroll area.",
      maxTitle: "Edit the raw inner height expression for this scroll area.",
    },
  ],
]);

const GADGET_COLOR_CAPABLE_KINDS: ReadonlySet<string> = new Set([
  GADGET_KIND.CalendarGadget,
  GADGET_KIND.ContainerGadget,
  GADGET_KIND.EditorGadget,
  GADGET_KIND.ExplorerListGadget,
  GADGET_KIND.ExplorerTreeGadget,
  GADGET_KIND.HyperLinkGadget,
  GADGET_KIND.ListIconGadget,
  GADGET_KIND.ListViewGadget,
  GADGET_KIND.ProgressBarGadget,
  GADGET_KIND.ScrollAreaGadget,
  GADGET_KIND.SpinGadget,
  GADGET_KIND.StringGadget,
  GADGET_KIND.TextGadget,
  GADGET_KIND.TreeGadget,
]);

const GADGET_ITEM_EDITOR_CAPABLE_KINDS: ReadonlySet<string> = new Set([
  GADGET_KIND.ComboBoxGadget,
  GADGET_KIND.EditorGadget,
  GADGET_KIND.ListIconGadget,
  GADGET_KIND.ListViewGadget,
  GADGET_KIND.PanelGadget,
  GADGET_KIND.TreeGadget,
]);

const GADGET_COLUMN_EDITOR_CAPABLE_KINDS: ReadonlySet<string> = new Set([
  GADGET_KIND.ListIconGadget,
]);

const GADGET_KNOWN_FLAGS: ReadonlyMap<string, readonly string[]> = new Map([
  [
    GADGET_KIND.ButtonGadget,
    [
      "#PB_Button_Right",
      "#PB_Button_Left",
      "#PB_Button_Default",
      "#PB_Button_MultiLine",
      "#PB_Button_Toggle",
    ],
  ],
  [GADGET_KIND.ButtonImageGadget, ["#PB_Button_Toggle"]],
  [GADGET_KIND.CalendarGadget, ["#PB_Calendar_Borderless"]],
  [
    GADGET_KIND.CanvasGadget,
    [
      "#PB_Canvas_Border",
      "#PB_Canvas_ClipMouse",
      "#PB_Canvas_Keyboard",
      "#PB_Canvas_DrawFocus",
    ],
  ],
  [
    GADGET_KIND.CheckBoxGadget,
    ["#PB_CheckBox_Right", "#PB_CheckBox_Center", "#PB_CheckBox_ThreeState"],
  ],
  [
    GADGET_KIND.ComboBoxGadget,
    [
      "#PB_ComboBox_Editable",
      "#PB_ComboBox_LowerCase",
      "#PB_ComboBox_UpperCase",
      "#PB_ComboBox_Image",
    ],
  ],
  [
    GADGET_KIND.ContainerGadget,
    [
      "#PB_Container_BorderLess",
      "#PB_Container_Flat",
      "#PB_Container_Raised",
      "#PB_Container_Single",
      "#PB_Container_Double",
    ],
  ],
  [GADGET_KIND.DateGadget, ["#PB_Date_UpDown", "#PB_Date_CheckBox"]],
  [
    GADGET_KIND.EditorGadget,
    ["#PB_Editor_ReadOnly", "#PB_Editor_WordWrap", "#PB_Editor_TabNavigation"],
  ],
  [
    GADGET_KIND.ExplorerComboGadget,
    [
      "#PB_Explorer_DrivesOnly",
      "#PB_Explorer_Editable",
      "#PB_Explorer_NoMyDocuments",
    ],
  ],
  [
    GADGET_KIND.ExplorerListGadget,
    [
      "#PB_Explorer_NoMyDocuments",
      "#PB_Explorer_BorderLess",
      "#PB_Explorer_AlwaysShowSelection",
      "#PB_Explorer_MultiSelect",
      "#PB_Explorer_GridLines",
      "#PB_Explorer_HeaderDragDrop",
      "#PB_Explorer_FullRowSelect",
      "#PB_Explorer_NoFiles",
      "#PB_Explorer_NoFolders",
      "#PB_Explorer_NoParentFolder",
      "#PB_Explorer_NoDirectoryChange",
      "#PB_Explorer_NoDriveRequester",
      "#PB_Explorer_NoSort",
      "#PB_Explorer_AutoSort",
      "#PB_Explorer_HiddenFiles",
    ],
  ],
  [
    GADGET_KIND.ExplorerTreeGadget,
    [
      "#PB_Explorer_BorderLess",
      "#PB_Explorer_AlwaysShowSelection",
      "#PB_Explorer_NoLines",
      "#PB_Explorer_NoButtons",
      "#PB_Explorer_NoFiles",
      "#PB_Explorer_NoDriveRequester",
      "#PB_Explorer_NoMyDocuments",
      "#PB_Explorer_AutoSort",
    ],
  ],
  [
    GADGET_KIND.FrameGadget,
    [
      "#PB_Frame_Single",
      "#PB_Frame_Double",
      "#PB_Frame_Flat",
      "#PB_Frame_Container",
    ],
  ],
  [GADGET_KIND.HyperLinkGadget, ["#PB_HyperLink_Underline"]],
  [GADGET_KIND.ImageGadget, ["#PB_Image_Border", "#PB_Image_Raised"]],
  [
    GADGET_KIND.ListIconGadget,
    [
      "#PB_ListIcon_CheckBoxes",
      "#PB_ListIcon_ThreeState",
      "#PB_ListIcon_MultiSelect",
      "#PB_ListIcon_GridLines",
      "#PB_ListIcon_FullRowSelect",
      "#PB_ListIcon_HeaderDragDrop",
      "#PB_ListIcon_AlwaysShowSelection",
      "#PB_ListIcon_LargeIcon",
      "#PB_ListIcon_SmallIcon",
      "#PB_ListIcon_List",
      "#PB_ListIcon_Report",
    ],
  ],
  [
    GADGET_KIND.ListViewGadget,
    ["#PB_ListView_MultiSelect", "#PB_ListView_ClickSelect"],
  ],
  [
    GADGET_KIND.OpenGLGadget,
    [
      "#PB_OpenGL_Keyboard",
      "#PB_OpenGL_NoFlipSynchronization",
      "#PB_OpenGL_FlipSynchronization",
      "#PB_OpenGL_NoDepthBuffer",
      "#PB_OpenGL_16BitDepthBuffer",
      "#PB_OpenGL_24BitDepthBuffer",
      "#PB_OpenGL_NoStencilBuffer",
      "#PB_OpenGL_8BitStencilBuffer",
      "#PB_OpenGL_NoAccumulationBuffer",
      "#PB_OpenGL_32BitAccumulationBuffer",
      "#PB_OpenGL_64BitAccumulationBuffer",
    ],
  ],
  [
    GADGET_KIND.ProgressBarGadget,
    ["#PB_ProgressBar_Smooth", "#PB_ProgressBar_Vertical"],
  ],
  [
    GADGET_KIND.ScrollAreaGadget,
    [
      "#PB_ScrollArea_Flat",
      "#PB_ScrollArea_Raised",
      "#PB_ScrollArea_Single",
      "#PB_ScrollArea_BorderLess",
      "#PB_ScrollArea_Center",
    ],
  ],
  [GADGET_KIND.ScrollBarGadget, ["#PB_ScrollBar_Vertical"]],
  [GADGET_KIND.SpinGadget, ["#PB_Spin_ReadOnly", "#PB_Spin_Numeric"]],
  [
    GADGET_KIND.SplitterGadget,
    [
      "#PB_Splitter_Vertical",
      "#PB_Splitter_Separator",
      "#PB_Splitter_FirstFixed",
      "#PB_Splitter_SecondFixed",
    ],
  ],
  [
    GADGET_KIND.StringGadget,
    [
      "#PB_String_Numeric",
      "#PB_String_Password",
      "#PB_String_ReadOnly",
      "#PB_String_LowerCase",
      "#PB_String_UpperCase",
      "#PB_String_BorderLess",
    ],
  ],
  [
    GADGET_KIND.TextGadget,
    ["#PB_Text_Center", "#PB_Text_Right", "#PB_Text_Border"],
  ],
  [GADGET_KIND.TrackBarGadget, ["#PB_TrackBar_Ticks", "#PB_TrackBar_Vertical"]],
  [
    GADGET_KIND.TreeGadget,
    [
      "#PB_Tree_AlwaysShowSelection",
      "#PB_Tree_NoLines",
      "#PB_Tree_NoButtons",
      "#PB_Tree_CheckBoxes",
      "#PB_Tree_ThreeState",
    ],
  ],
  [GADGET_KIND.WebGadget, ["#PB_Web_Edge"]],
  [GADGET_KIND.WebViewGadget, ["#PB_WebView_Debug"]],
]);

function splitGadgetFlags(flagsExpr: string | undefined): string[] {
  if (!flagsExpr) return [];
  return flagsExpr
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

function uniqueFlags(flags: readonly string[]): string[] {
  const out: string[] = [];
  for (const flag of flags) {
    if (out.includes(flag)) continue;
    out.push(flag);
  }
  return out;
}

const GADGET_FONT_FLAG_SUMMARY_MARKS: readonly {
  flag: string;
  mark: string;
}[] = [
  { flag: "#PB_Font_Bold", mark: "B" },
  { flag: "#PB_Font_Italic", mark: "I" },
  { flag: "#PB_Font_Underline", mark: "U" },
  { flag: "#PB_Font_StrikeOut", mark: "S" },
];

function getGadgetFontFlagSummary(flagsRaw: string | undefined): string {
  const flags = new Set(splitGadgetFlags(flagsRaw));
  return GADGET_FONT_FLAG_SUMMARY_MARKS
    .filter(({ flag }) => flags.has(flag))
    .map(({ mark }) => mark)
    .join("");
}

function buildInspectorValue(
  raw: string | undefined,
  fallback: string | undefined,
): string {
  const literal = raw ? parsePbStringLiteral(raw) : undefined;
  if (literal !== undefined) return literal;
  if (typeof fallback === "string") return fallback;
  return raw?.trim() ?? "";
}

export function getGadgetBooleanInspectorState(
  raw: string | undefined,
  value: boolean | undefined,
): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed === "0") {
    return false;
  }

  return true;
}

export function isGadgetHiddenInDesignerPreview(
  value: boolean | undefined,
): boolean {
  return value === true;
}

export function isGadgetDisabledInDesignerPreview(
  value: boolean | undefined,
): boolean {
  return value === true;
}

export function canEditGadgetText(kind: string | undefined): boolean {
  return typeof kind === "string" && GADGET_TEXT_CAPABLE_KINDS.has(kind);
}

export function canEditGadgetColors(kind: string | undefined): boolean {
  return typeof kind === "string" && GADGET_COLOR_CAPABLE_KINDS.has(kind);
}

export function getGadgetColorRowsFieldConfig(
  kind: string | undefined,
): GadgetColorRowsFieldConfig | undefined {
  if (!canEditGadgetColors(kind)) return undefined;
  return {
    visible: true,
    frontColorVisible: true,
    backColorVisible: true,
    valueEditable: true,
    frontColorLabel: "FrontColor",
    backColorLabel: "BackColor",
    frontColorTitle:
      "Displays the raw front color expression. Use the picker to change it or Remove to clear it.",
    backColorTitle:
      "Displays the raw background color expression. Use the picker to change it or Remove to clear it.",
  };
}

export function canEditGadgetCheckedState(kind: string | undefined): boolean {
  return (
    typeof kind === "string" && GADGET_CHECKED_STATE_CAPABLE_KINDS.has(kind)
  );
}

export function getGadgetCheckedStateFieldConfig(
  kind: string | undefined,
): GadgetCheckedStateFieldConfig | undefined {
  if (!canEditGadgetCheckedState(kind)) return undefined;
  return {
    visible: true,
    valueEditable: true,
    label: "Checked",
    title:
      "Toggle whether this gadget is checked. Custom expressions stay unchanged until you change this value.",
  };
}

export function canInspectGadgetImageRows(kind: string | undefined): boolean {
  return typeof kind === "string" && GADGET_IMAGE_ROW_CAPABLE_KINDS.has(kind);
}

export function getGadgetImageRowsFieldConfig(
  kind: string | undefined,
): GadgetImageRowsFieldConfig | undefined {
  if (!canInspectGadgetImageRows(kind)) return undefined;
  return {
    currentImageVisible: true,
    currentImageEditable: false,
    changeImageVisible: true,
    changeImageAvailable: true,
    currentImageTitle:
      "Displays the image currently assigned to this gadget. Use Select to choose or create another image.",
    changeImageTitle:
      "Choose, create or assign an image for this gadget.",
  };
}

export function canInspectGadgetSplitterPosition(
  kind: string | undefined,
): boolean {
  return kind === GADGET_KIND.SplitterGadget;
}

export function getGadgetSplitterPositionFieldConfig(
  kind: string | undefined,
): GadgetSplitterPositionFieldConfig | undefined {
  if (!canInspectGadgetSplitterPosition(kind)) return undefined;
  return {
    visible: true,
    valueEditable: true,
    label: "SplitterPosition",
    title:
      "Edit the splitter position between the two child gadgets. The value must stay within the current splitter size.",
    valuePolicy: "bounded-by-current-orientation-size",
  };
}

export function canInspectCustomGadgetCodeRows(
  kind: string | undefined,
): boolean {
  return kind === GADGET_KIND.CustomGadget;
}

export function getCustomGadgetCodeRowsFieldConfig(
  kind: string | undefined,
): CustomGadgetCodeRowsFieldConfig | undefined {
  if (!canInspectCustomGadgetCodeRows(kind)) return undefined;
  return {
    visible: true,
    selectGadgetLabel: "SelectGadget",
    initCodeLabel: "InitCode",
    createCodeLabel: "CreateCode",
    helpLabel: "Help",
    initCodeTitle:
      "Edit the code that runs before this custom gadget is created.",
    createCodeTitle:
      "Edit the code that creates this custom gadget. Leave it filled so the gadget can be recreated.",
    helpTitle:
      "Shows the placeholders available in InitCode and CreateCode.",
    note:
      "SelectGadget chooses the preset shown here. InitCode and CreateCode contain the code used for this custom gadget.",
  };
}

export function canInspectGadgetTooltipRows(kind: string | undefined): boolean {
  return typeof kind === "string" && GADGET_CAPTION_VISIBLE_KINDS.has(kind);
}

export function canInspectGadgetSelectProc(kind: string | undefined): boolean {
  return typeof kind === "string" && GADGET_CAPTION_VISIBLE_KINDS.has(kind);
}

export function canInspectGadgetBaseRows(kind: string | undefined): boolean {
  return typeof kind === "string" && GADGET_CAPTION_VISIBLE_KINDS.has(kind);
}

export function canInspectGadgetLayoutRows(kind: string | undefined): boolean {
  return canInspectGadgetBaseRows(kind);
}

export function getGadgetLayoutFieldConfig(
  kind: string | undefined,
): GadgetLayoutFieldConfig | undefined {
  if (!canInspectGadgetLayoutRows(kind)) return undefined;
  return {
    visible: true,
    valueEditable: true,
    xLabel: "X",
    yLabel: "Y",
    widthLabel: "Width",
    heightLabel: "Height",
    xTitle: "Edit the displayed X position of this gadget.",
    yTitle: "Edit the displayed Y position of this gadget.",
    widthTitle: "Edit the displayed width of this gadget.",
    heightTitle: "Edit the displayed height of this gadget.",
    xUnscaledLabel: "X (Unscaled)",
    yUnscaledLabel: "Y (Unscaled)",
    widthUnscaledLabel: "Width (Unscaled)",
    heightUnscaledLabel: "Height (Unscaled)",
    xUnscaledTitle: "Displays the raw X value saved in the form code. Edit X to update it.",
    yUnscaledTitle: "Displays the raw Y value saved in the form code. Edit Y to update it.",
    widthUnscaledTitle: "Displays the raw width value saved in the form code. Edit Width to update it.",
    heightUnscaledTitle: "Displays the raw height value saved in the form code. Edit Height to update it.",
  };
}

export function getGadgetVisibilityStateFieldConfig(
  kind: string | undefined,
): GadgetVisibilityStateFieldConfig | undefined {
  if (!canInspectGadgetBaseRows(kind)) return undefined;
  return {
    visible: true,
    valueEditable: true,
    hiddenLabel: "Hidden",
    disabledLabel: "Disabled",
    hiddenTitle: "Show or hide this gadget.",
    hiddenCustomExpressionTitle:
      "This gadget uses a custom hide expression. Changing this checkbox replaces it with 1 or 0.",
    disabledTitle: "Enable or disable this gadget.",
    disabledCustomExpressionTitle:
      "This gadget uses a custom disable expression. Changing this checkbox replaces it with 1 or 0.",
  };
}

export function getGadgetParentFieldConfig(
  kind: string | undefined,
  hasParent: boolean,
): GadgetParentFieldConfig | undefined {
  if (!canInspectGadgetBaseRows(kind)) return undefined;
  return {
    visible: true,
    valueEditable: false,
    selectTargetAvailable: hasParent,
    changeDialogAvailable: true,
    title:
      "Displays the current parent gadget. Use Select Parent to jump to it or Change Parent to choose another parent.",
  };
}

export function getGadgetResizeLockFieldConfig(
  kind: string | undefined,
): GadgetResizeLockFieldConfig | undefined {
  if (!canInspectGadgetBaseRows(kind)) return undefined;
  return {
    visible: true,
    valueEditablePolicy: "safe-resize-patch-only",
    title:
      "Controls how the gadget stays attached to parent edges when the parent is resized. Editable only when the current layout can be saved safely.",
  };
}

export function getGadgetFontFieldConfig(
  kind: string | undefined,
): GadgetFontFieldConfig | undefined {
  if (!canInspectGadgetBaseRows(kind)) return undefined;
  return {
    visible: true,
    rawEditable: true,
    title:
      "Displays and edits the raw SetGadgetFont(...) expression. Leave empty to clear the gadget font.",
  };
}

export function getGadgetConstantsFieldConfig(
  kind: string | undefined,
): GadgetConstantsFieldConfig | undefined {
  if (!canInspectGadgetBaseRows(kind)) return undefined;
  return {
    visible: true,
    knownFlags: getGadgetKnownFlags(kind),
    title:
      "Toggle known PureBasic constants for this gadget. Custom constants in the raw flags expression are kept.",
  };
}

export function getGadgetSelectProcFieldConfig(
  kind: string | undefined,
): GadgetSelectProcFieldConfig | undefined {
  if (!canInspectGadgetSelectProc(kind)) return undefined;
  return {
    valueEditable: true,
    preservesGridString: true,
    title:
      "Choose an existing procedure or type the procedure called by gadget events.",
    placeholder: "Type or pick a procedure",
  };
}

export function getCustomGadgetSelectPresetFieldConfig(
  kind: string | undefined,
): CustomGadgetSelectPresetFieldConfig | undefined {
  if (kind !== GADGET_KIND.CustomGadget) return undefined;
  return {
    valueEditable: true,
    persisted: false,
    title:
      "Select a CustomGadget preset. InitCode and CreateCode remain the saved creation code.",
  };
}

export function canInspectGadgetItems(kind: string | undefined): boolean {
  return typeof kind === "string" && GADGET_ITEM_EDITOR_CAPABLE_KINDS.has(kind);
}

export function getGadgetItemEditorFieldConfig(
  kind: string | undefined,
  hasExistingItems = false,
): GadgetItemEditorFieldConfig | undefined {
  if (!canInspectGadgetItems(kind) && !hasExistingItems) return undefined;
  return {
    visible: true,
    itemTextTitle: "Edit the item text shown by this gadget.",
    positionRawTitle:
      "Edit the raw item position expression. Use -1 to append the item.",
    imageRawTitle: "Edit the optional raw image expression for this item.",
    flagsRawTitle: "Edit the optional raw flags expression for this item.",
    addButtonTitle: "Add a new item to this gadget.",
  };
}

export function canInspectGadgetColumns(kind: string | undefined): boolean {
  return (
    typeof kind === "string" && GADGET_COLUMN_EDITOR_CAPABLE_KINDS.has(kind)
  );
}

export function getGadgetColumnEditorFieldConfig(
  kind: string | undefined,
  hasExistingColumns = false,
): GadgetColumnEditorFieldConfig | undefined {
  if (!canInspectGadgetColumns(kind) && !hasExistingColumns) return undefined;
  return {
    visible: true,
    columnTitleTitle: "Edit the column title shown by this gadget.",
    indexRawTitle:
      "Edit the raw column index expression. Use the next index to append the column.",
    widthRawTitle: "Edit the raw column width expression.",
    addButtonTitle: "Add a new column to this gadget.",
  };
}

export function getGadgetKnownFlags(
  kind: string | undefined,
): readonly string[] {
  if (typeof kind !== "string") return [];
  return GADGET_KNOWN_FLAGS.get(kind) ?? [];
}

export function buildGadgetFlagsExpr(
  kind: string | undefined,
  enabledKnownFlags: readonly string[],
  currentFlagsExpr?: string,
): string | undefined {
  const knownFlags = getGadgetKnownFlags(kind);
  const knownFlagSet = new Set(knownFlags);
  const orderedKnown = uniqueFlags(knownFlags).filter((flag) =>
    enabledKnownFlags.includes(flag),
  );
  const customFlags = uniqueFlags(
    splitGadgetFlags(currentFlagsExpr).filter(
      (flag) => !knownFlagSet.has(flag),
    ),
  );
  const parts = [...orderedKnown, ...customFlags];
  return parts.length ? parts.join(" | ") : undefined;
}

export function shouldShowGadgetParentDetail(
  gadget: GadgetInspectorDetailsLike,
): boolean {
  return (
    typeof gadget.parentId === "string" && gadget.parentId.trim().length > 0
  );
}

export function shouldShowGadgetTabDetail(
  gadget: GadgetInspectorDetailsLike,
): boolean {
  return (
    typeof gadget.parentItem === "number" && Number.isFinite(gadget.parentItem)
  );
}

export function buildGadgetCheckedStateRaw(
  kind: string | undefined,
  checked: boolean,
): string | undefined {
  if (!checked) return undefined;
  if (kind === GADGET_KIND.CheckBoxGadget) return "#PB_Checkbox_Checked";
  if (kind === GADGET_KIND.OptionGadget) return "1";
  return undefined;
}

export function getGadgetCtorRangeFieldLabels(
  kind: string | undefined,
): GadgetCtorRangeFieldLabels | undefined {
  if (typeof kind !== "string") return undefined;
  return GADGET_CTOR_RANGE_FIELD_LABELS.get(kind);
}
export function isDpiScaledGadgetCtorRange(kind: string | undefined): boolean {
  return kind === GADGET_KIND.ScrollAreaGadget;
}

export function isDpiScaledGadgetState(kind: string | undefined): boolean {
  return kind === GADGET_KIND.SplitterGadget;
}

export function getGadgetTextInspectorValue(gadget: GadgetTextLike): string {
  return buildInspectorValue(gadget.textRaw, gadget.text);
}

export function getGadgetTooltipInspectorValue(
  gadget: GadgetTooltipLike,
): string {
  return buildInspectorValue(gadget.tooltipRaw, gadget.tooltip);
}

export function getGadgetCtorRangeInspectorValue(
  raw: string | undefined,
  fallback: number | undefined,
): string {
  const trimmed = raw?.trim();
  if (trimmed?.length) return trimmed;
  return Number.isFinite(fallback) ? String(fallback) : "";
}

export function getGadgetCurrentImageDisplay(
  gadget: GadgetCurrentImageLike,
  imageEntry?: GadgetImageEntryLike,
): string {
  const resolved = imageEntry?.image ?? imageEntry?.imageRaw;
  if (typeof resolved === "string" && resolved.trim().length) return resolved;
  return gadget.imageRaw?.trim() ?? "";
}

export function getGadgetVariableInspectorValue(gadget: {
  variable?: string;
  firstParam: string;
}): string {
  if (typeof gadget.variable === "string" && gadget.variable.trim().length) {
    return gadget.variable;
  }
  return gadget.firstParam.replace(/^#/, "");
}

export function getGadgetParentInspectorValue(
  parent: GadgetParentDisplayLike | undefined,
): string {
  if (!parent) return "";
  return getGadgetVariableInspectorValue(parent);
}

export function getGadgetTooltipFieldConfig(
  kind: string | undefined,
): GadgetTooltipFieldConfig | undefined {
  if (!canInspectGadgetTooltipRows(kind)) return undefined;
  return {
    valueEditable: true,
    variableToggleEditable: true,
    variableToggleTitle:
      "Treat the tooltip as a variable or expression instead of a string literal.",
    variableToggleUnavailableTitle:
      "This gadget cannot switch its tooltip to variable mode.",
    valueTitle:
      "Edit the tooltip shown when the user hovers over this gadget. Enable 'Tooltip Is Variable' for a variable name or expression.",
    valueUnavailableTitle: "Displays the tooltip stored for this gadget.",
  };
}

export function getGadgetCaptionFieldConfig(
  kind: string | undefined,
): GadgetCaptionFieldConfig | undefined {
  if (typeof kind !== "string" || !GADGET_CAPTION_VISIBLE_KINDS.has(kind))
    return undefined;

  if (kind === GADGET_KIND.DateGadget) {
    return {
      label: "Mask",
      textEditable: canEditGadgetText(kind),
      variableToggleEditable: GADGET_CAPTION_VARIABLE_CAPABLE_KINDS.has(kind),
      variableToggleTitle:
        "Treat the mask as a variable or expression instead of a string literal.",
      variableToggleUnavailableTitle:
        "This gadget cannot switch its mask to variable mode.",
      textTitle:
        "Edit the date mask used by this gadget. Enable 'Caption Is Variable' for a variable name or expression.",
      textUnavailableTitle: "Displays the date mask stored for this gadget.",
    };
  }

  if (kind === GADGET_KIND.ScintillaGadget) {
    return {
      label: "Callback",
      textEditable: true,
      variableToggleEditable: false,
      variableToggleTitle:
        "Treat this value as a variable or expression instead of a string literal.",
      variableToggleUnavailableTitle:
        "This callback field is edited directly and cannot be switched to variable mode.",
      textTitle: "Edit the callback procedure passed to this Scintilla gadget.",
      textUnavailableTitle:
        "Displays the callback procedure stored for this Scintilla gadget.",
    };
  }

  return {
    label: "Caption",
    textEditable: canEditGadgetText(kind),
    variableToggleEditable: GADGET_CAPTION_VARIABLE_CAPABLE_KINDS.has(kind),
    variableToggleTitle:
      "Treat the caption as a variable or expression instead of a string literal.",
    variableToggleUnavailableTitle:
      "This gadget cannot switch its caption to variable mode.",
    textTitle:
      "Edit the text shown by this gadget. Enable 'Caption Is Variable' for a variable name or expression.",
    textUnavailableTitle: "Displays the caption stored for this gadget.",
  };
}

export function buildGadgetTextRaw(value: string, isVariable: boolean): string {
  if (isVariable) {
    return value;
  }
  return quotePbString(value);
}

export function buildGadgetTooltipRaw(
  value: string,
  isVariable: boolean,
): string | undefined {
  if (isVariable) {
    return value.length ? value : undefined;
  }
  return value.length ? quotePbString(value) : undefined;
}

export function getCustomGadgetHelpDisplay(): string {
  return "%id% %x% %y% %w% %h% %txt% %hwnd% %wndid% ";
}

export function getGadgetFontDisplaySummary(gadget: GadgetFontLike): string {
  if (gadget.gadgetFont && Number.isFinite(gadget.gadgetFontSize)) {
    const flags = gadget.gadgetFontFlagsRaw?.trim();
    const flagSummary = getGadgetFontFlagSummary(flags);
    const originalSummary = flagSummary.length
      ? `${gadget.gadgetFont} ${gadget.gadgetFontSize} ${flagSummary}`
      : `${gadget.gadgetFont} ${gadget.gadgetFontSize}`;
    return flags?.length ? `${originalSummary} (${flags})` : originalSummary;
  }
  return gadget.gadgetFontRaw?.trim() ?? "";
}

const PB_FORM_SKIN_CONSTANTS: Readonly<
  Record<
    PbFormSkinLike,
    { statusHeight: number; menuHeight: number; toolBarPaddingHeight: number }
  >
> = {
  windows: { statusHeight: 23, menuHeight: 22, toolBarPaddingHeight: 24 },
  linux: { statusHeight: 26, menuHeight: 28, toolBarPaddingHeight: 38 },
  macos: { statusHeight: 24, menuHeight: 23, toolBarPaddingHeight: 36 },
};

function getTopLevelStretchHeightDynamicParts(
  win: WindowResizeLockLike,
): string[] {
  const parts: string[] = [];
  const menuCount = win.menuCount ?? 0;
  const toolbarCount = win.toolbarCount ?? 0;
  const statusBarCount = win.statusBarCount ?? 0;
  const skin = win.platformSkin;

  if (menuCount > 0) {
    parts.push("MenuHeight()");
  }
  if (toolbarCount > 0 && skin === "windows") {
    parts.push(`ToolBarHeight(${toolbarCount - 1})`);
  }
  if (statusBarCount > 0) {
    parts.push(`StatusBarHeight(${statusBarCount - 1})`);
  }

  return parts;
}

function buildTopLevelStretchHeightRaw(
  gadget: GadgetResizeLockLike,
  win: WindowResizeLockLike,
): string | undefined {
  const skin = win.platformSkin;
  const scale = getResizeLockLayoutScale(win);
  const winH = resolveUnscaledLayoutNumber(win.hRaw, win.h, scale, "h", {
    allowExpressionFallback: false,
  });
  const gadgetH = resolveUnscaledLayoutNumber(
    gadget.hRaw,
    gadget.h,
    scale,
    "h",
    { allowExpressionFallback: false },
  );
  if (
    !skin ||
    typeof winH !== "number" ||
    !Number.isFinite(winH) ||
    winH <= 0 ||
    typeof gadgetH !== "number" ||
    !Number.isFinite(gadgetH)
  ) {
    return undefined;
  }

  const constants = PB_FORM_SKIN_CONSTANTS[skin];
  const menuCount = win.menuCount ?? 0;
  const toolbarCount = win.toolbarCount ?? 0;
  const statusBarCount = win.statusBarCount ?? 0;
  const dynamicParts = getTopLevelStretchHeightDynamicParts(win);

  let value = Math.trunc(winH - gadgetH);
  if (statusBarCount > 0) {
    value -= constants.statusHeight;
  }

  if (skin === "windows") {
    if (toolbarCount > 0) {
      value -= constants.toolBarPaddingHeight;
    }
    if (menuCount > 0) {
      value -= constants.menuHeight;
    }
  } else if (skin === "linux") {
    if (menuCount > 0) {
      value -= constants.menuHeight;
    }
  }

  const suffix = dynamicParts.length ? ` - ${dynamicParts.join(" - ")}` : "";
  return `FormWindowHeight${suffix} - ${value}`;
}

function usesWidthResizeReference(raw: string | undefined): boolean {
  const trimmed = raw?.trim();
  if (!trimmed?.length) return false;
  return /FormWindowWidth|WindowWidth|GadgetWidth|GetGadgetAttribute/i.test(
    trimmed,
  );
}

function usesHeightResizeReference(raw: string | undefined): boolean {
  const trimmed = raw?.trim();
  if (!trimmed?.length) return false;
  return /FormWindowHeight|WindowHeight|GadgetHeight|GetGadgetAttribute/i.test(
    trimmed,
  );
}

function getResizeLockLayoutScale(
  win: WindowResizeLockLike | undefined,
): number {
  const scale = win?.layoutDpiScale;
  return typeof scale === "number" && Number.isFinite(scale) && scale > 0
    ? scale
    : 1;
}

function getParentResizeReferenceRaw(
  parent: ParentResizeLockLike | undefined,
): string | undefined {
  if (!parent) return undefined;
  if (parent.pbAny) {
    return parent.variable?.trim() || parent.id.trim();
  }

  const firstParam = parent.firstParam?.trim();
  if (firstParam?.length) return firstParam;
  const trimmedId = parent.id.trim();
  if (!trimmedId.length) return undefined;
  return trimmedId.startsWith("#") ? trimmedId : `#${trimmedId}`;
}

function resolvePanelHeaderHeight(
  skin: PbFormSkinLike | undefined,
): number | undefined {
  switch (skin) {
    case "macos":
      return 31;
    case "linux":
      return 29;
    case "windows":
      return 22;
    default:
      return undefined;
  }
}

function getParentWidthResizeReferenceRaw(
  parent: ParentResizeLockLike | undefined,
): string | undefined {
  const parentRef = getParentResizeReferenceRaw(parent);
  if (!parentRef) return undefined;
  if (parent?.kind === GADGET_KIND.PanelGadget) {
    return `GetGadgetAttribute(${parentRef},#PB_Panel_ItemWidth)`;
  }
  return `GadgetWidth(${parentRef})`;
}

function getParentHeightResizeReferenceRaw(
  parent: ParentResizeLockLike | undefined,
): string | undefined {
  const parentRef = getParentResizeReferenceRaw(parent);
  if (!parentRef) return undefined;
  if (parent?.kind === GADGET_KIND.PanelGadget) {
    return `GetGadgetAttribute(${parentRef},#PB_Panel_ItemHeight)`;
  }
  return `GadgetHeight(${parentRef})`;
}

function isSupportedParentResizeContext(
  parent: ParentResizeLockLike | undefined,
): boolean {
  return Boolean(parent);
}

function resolveParentUnscaledLayoutNumber(
  parent: ParentResizeLockLike | undefined,
  field: "w" | "h",
  scale: number,
  skin?: PbFormSkinLike,
): number | undefined {
  if (!parent) return undefined;
  const resolved =
    field === "w"
      ? resolveUnscaledLayoutNumber(parent.wRaw, parent.w, scale, "w", {
          allowExpressionFallback: false,
        })
      : resolveUnscaledLayoutNumber(parent.hRaw, parent.h, scale, "h", {
          allowExpressionFallback: false,
        });
  if (typeof resolved !== "number") return undefined;
  if (field === "h" && parent.kind === GADGET_KIND.PanelGadget) {
    const panelHeader = resolvePanelHeaderHeight(skin);
    if (typeof panelHeader !== "number") return undefined;
    return Math.max(0, Math.trunc(resolved - panelHeader));
  }
  return resolved;
}

function buildParentRightAnchorXRaw(
  gadget: GadgetResizeLockLike,
  parent: ParentResizeLockLike,
  scale: number,
): string | undefined {
  const gadgetX = resolveUnscaledLayoutNumber(
    gadget.xRaw,
    gadget.x,
    scale,
    "x",
    { allowExpressionFallback: false },
  );
  const parentW = resolveParentUnscaledLayoutNumber(parent, "w", scale);
  const parentRef = getParentWidthResizeReferenceRaw(parent);
  if (typeof gadgetX !== "number" || typeof parentW !== "number" || !parentRef)
    return undefined;
  return `${parentRef} - ${Math.trunc(parentW - gadgetX)}`;
}

function buildParentStretchWidthRaw(
  gadget: GadgetResizeLockLike,
  parent: ParentResizeLockLike,
  scale: number,
): string | undefined {
  const gadgetW = resolveUnscaledLayoutNumber(
    gadget.wRaw,
    gadget.w,
    scale,
    "w",
    { allowExpressionFallback: false },
  );
  const parentW = resolveParentUnscaledLayoutNumber(parent, "w", scale);
  const parentRef = getParentWidthResizeReferenceRaw(parent);
  if (typeof gadgetW !== "number" || typeof parentW !== "number" || !parentRef)
    return undefined;
  return `${parentRef} - ${Math.trunc(parentW - gadgetW)}`;
}

function buildParentBottomAnchorYRaw(
  gadget: GadgetResizeLockLike,
  parent: ParentResizeLockLike,
  scale: number,
  skin?: PbFormSkinLike,
): string | undefined {
  const gadgetY = resolveUnscaledLayoutNumber(
    gadget.yRaw,
    gadget.y,
    scale,
    "y",
    { allowExpressionFallback: false },
  );
  const parentH = resolveParentUnscaledLayoutNumber(parent, "h", scale, skin);
  const parentRef = getParentHeightResizeReferenceRaw(parent);
  if (typeof gadgetY !== "number" || typeof parentH !== "number" || !parentRef)
    return undefined;
  return `${parentRef} - ${Math.trunc(parentH - gadgetY)}`;
}

function buildParentStretchHeightRaw(
  gadget: GadgetResizeLockLike,
  parent: ParentResizeLockLike,
  scale: number,
  skin?: PbFormSkinLike,
): string | undefined {
  const gadgetH = resolveUnscaledLayoutNumber(
    gadget.hRaw,
    gadget.h,
    scale,
    "h",
    { allowExpressionFallback: false },
  );
  const parentH = resolveParentUnscaledLayoutNumber(parent, "h", scale, skin);
  const parentRef = getParentHeightResizeReferenceRaw(parent);
  if (typeof gadgetH !== "number" || typeof parentH !== "number" || !parentRef)
    return undefined;
  return `${parentRef} - ${Math.trunc(parentH - gadgetH)}`;
}

function hasExplicitNonNumericLayoutRaw(raw: string | undefined): boolean {
  const trimmed = raw?.trim();
  return (
    Boolean(trimmed?.length) && parseUnscaledLayoutRaw(trimmed) === undefined
  );
}

function resolveUnscaledLayoutNumber(
  raw: string | undefined,
  displayValue: number | undefined,
  scale: number,
  field: DesignerLayoutNumericField,
  options?: { allowExpressionFallback?: boolean },
): number | undefined {
  const parsed = parseDesignerLayoutRaw(raw, field);
  if (typeof parsed === "number" && Number.isFinite(parsed)) return parsed;
  if (
    options?.allowExpressionFallback === false &&
    hasExplicitNonNumericLayoutRaw(raw)
  )
    return undefined;
  if (typeof displayValue !== "number" || !Number.isFinite(displayValue))
    return undefined;
  return unscaleDisplayedLayoutValue(displayValue, scale);
}

function getBaseRectRaw(
  raw: string | undefined,
  fallback: number,
  field: DesignerLayoutNumericField,
  scale = 1,
): string | undefined {
  const trimmed = raw?.trim();
  if (trimmed?.length) return trimmed;
  const unscaled = resolveUnscaledLayoutNumber(
    undefined,
    fallback,
    scale,
    field,
  );
  return typeof unscaled === "number" && Number.isFinite(unscaled)
    ? String(Math.trunc(unscaled))
    : undefined;
}

function buildTopLevelRightAnchorXRaw(
  gadget: GadgetResizeLockLike,
  win: WindowResizeLockLike,
): string | undefined {
  const scale = getResizeLockLayoutScale(win);
  const gadgetX = resolveUnscaledLayoutNumber(
    gadget.xRaw,
    gadget.x,
    scale,
    "x",
    { allowExpressionFallback: false },
  );
  const winW = resolveUnscaledLayoutNumber(win.wRaw, win.w, scale, "w", {
    allowExpressionFallback: false,
  });
  if (typeof gadgetX !== "number" || typeof winW !== "number") return undefined;
  return `FormWindowWidth - ${Math.trunc(winW - gadgetX)}`;
}

function buildTopLevelStretchWidthRaw(
  gadget: GadgetResizeLockLike,
  win: WindowResizeLockLike,
): string | undefined {
  const scale = getResizeLockLayoutScale(win);
  const gadgetW = resolveUnscaledLayoutNumber(
    gadget.wRaw,
    gadget.w,
    scale,
    "w",
    { allowExpressionFallback: false },
  );
  const winW = resolveUnscaledLayoutNumber(win.wRaw, win.w, scale, "w", {
    allowExpressionFallback: false,
  });
  if (typeof gadgetW !== "number" || typeof winW !== "number") return undefined;
  return `FormWindowWidth - ${Math.trunc(winW - gadgetW)}`;
}

function buildCurrentVerticalResizeArgs(
  gadget: GadgetResizeLockLike,
  scale = 1,
): { yRaw?: string; hRaw?: string } | undefined {
  const lockTop = gadget.lockTop !== false;
  const lockBottom = gadget.lockBottom === true;
  const baseYRaw = getBaseRectRaw(gadget.yRaw, gadget.y, "y", scale);
  const baseHRaw = getBaseRectRaw(gadget.hRaw, gadget.h, "h", scale);
  const existingBottomAnchorRaw = usesHeightResizeReference(gadget.resizeYRaw)
    ? gadget.resizeYRaw?.trim()
    : usesHeightResizeReference(gadget.yRaw)
      ? gadget.yRaw?.trim()
      : undefined;
  const existingStretchHeightRaw = usesHeightResizeReference(gadget.resizeHRaw)
    ? gadget.resizeHRaw?.trim()
    : usesHeightResizeReference(gadget.hRaw)
      ? gadget.hRaw?.trim()
      : undefined;

  if (lockTop && lockBottom) {
    if (!baseYRaw || !existingStretchHeightRaw) return undefined;
    return { yRaw: baseYRaw, hRaw: existingStretchHeightRaw };
  }

  if (!lockTop && lockBottom) {
    if (!existingBottomAnchorRaw || !baseHRaw) return undefined;
    return { yRaw: existingBottomAnchorRaw, hRaw: baseHRaw };
  }

  if (!baseYRaw || !baseHRaw) return undefined;
  return { yRaw: baseYRaw, hRaw: baseHRaw };
}

function buildCurrentHorizontalResizeArgs(
  gadget: GadgetResizeLockLike,
  scale = 1,
): { xRaw?: string; wRaw?: string } | undefined {
  const lockLeft = gadget.lockLeft !== false;
  const lockRight = gadget.lockRight === true;
  const baseXRaw = getBaseRectRaw(gadget.xRaw, gadget.x, "x", scale);
  const baseWRaw = getBaseRectRaw(gadget.wRaw, gadget.w, "w", scale);
  const existingRightAnchorRaw = usesWidthResizeReference(gadget.resizeXRaw)
    ? gadget.resizeXRaw?.trim()
    : usesWidthResizeReference(gadget.xRaw)
      ? gadget.xRaw?.trim()
      : undefined;
  const existingStretchWidthRaw = usesWidthResizeReference(gadget.resizeWRaw)
    ? gadget.resizeWRaw?.trim()
    : usesWidthResizeReference(gadget.wRaw)
      ? gadget.wRaw?.trim()
      : undefined;

  if (lockLeft && lockRight) {
    if (!baseXRaw || !existingStretchWidthRaw) return undefined;
    return { xRaw: baseXRaw, wRaw: existingStretchWidthRaw };
  }

  if (!lockLeft && lockRight) {
    if (!existingRightAnchorRaw || !baseWRaw) return undefined;
    return { xRaw: existingRightAnchorRaw, wRaw: baseWRaw };
  }

  if (!baseXRaw || !baseWRaw) return undefined;
  return { xRaw: baseXRaw, wRaw: baseWRaw };
}

function buildTopLevelBottomAnchorYRaw(
  gadget: GadgetResizeLockLike,
  win: WindowResizeLockLike,
): string | undefined {
  const scale = getResizeLockLayoutScale(win);
  const winH = resolveUnscaledLayoutNumber(win.hRaw, win.h, scale, "h", {
    allowExpressionFallback: false,
  });
  const gadgetY = resolveUnscaledLayoutNumber(
    gadget.yRaw,
    gadget.y,
    scale,
    "y",
    { allowExpressionFallback: false },
  );
  if (
    typeof gadgetY !== "number" ||
    typeof winH !== "number" ||
    !Number.isFinite(winH) ||
    winH <= 0
  )
    return undefined;
  const baseYRaw = getBaseRectRaw(gadget.yRaw, gadget.y, "y", scale);
  if (!baseYRaw) return undefined;

  const trimmed = baseYRaw.trim();
  const baseOffset = Math.trunc(winH - gadgetY);
  if (/^-?\d+$/.test(trimmed)) {
    return `FormWindowHeight - ${baseOffset}`;
  }

  const toolbarMatch = trimmed.match(/^ToolBarHeight\((\d+)\)\s*\+\s*-?\d+$/);
  if (toolbarMatch) {
    return `ToolBarHeight(${toolbarMatch[1]}) + FormWindowHeight - ${baseOffset}`;
  }

  return undefined;
}

function shouldEmitResizeGadget(
  lockLeft: boolean,
  lockRight: boolean,
  lockTop: boolean,
  lockBottom: boolean,
): boolean {
  return (
    (lockRight && lockLeft) ||
    (lockTop && lockBottom) ||
    (!lockTop && lockBottom) ||
    (lockRight && !lockLeft)
  );
}

export function canEditGadgetHorizontalLocks(
  gadget: GadgetResizeLockLike,
  win: WindowResizeLockLike | undefined,
): boolean {
  if (!win) return false;
  const scale = getResizeLockLayoutScale(win);
  const parent = isSupportedParentResizeContext(win.parent)
    ? win.parent
    : undefined;
  if (gadget.parentId) {
    if (!parent) return false;
    const parentW = resolveParentUnscaledLayoutNumber(parent, "w", scale);
    if (
      typeof parentW !== "number" ||
      !Number.isFinite(parentW) ||
      parentW <= 0
    )
      return false;
  } else if (!Number.isFinite(win.w) || win.w <= 0) {
    return false;
  }
  if (!Number.isFinite(gadget.x) || !Number.isFinite(gadget.w)) return false;
  const baseXRaw = getBaseRectRaw(gadget.xRaw, gadget.x, "x", scale);
  const baseWRaw = getBaseRectRaw(gadget.wRaw, gadget.w, "w", scale);
  if (!baseXRaw || !baseWRaw) return false;
  const verticalArgs = buildCurrentVerticalResizeArgs(gadget, scale);
  if (!verticalArgs) return false;
  return true;
}

export function buildGadgetHorizontalLockResizeUpdate(
  gadget: GadgetResizeLockLike,
  win: WindowResizeLockLike,
  nextLockLeft: boolean,
  nextLockRight: boolean,
): GadgetResizeRawUpdate | undefined {
  if (!canEditGadgetHorizontalLocks(gadget, win)) return undefined;

  const lockTop = gadget.lockTop !== false;
  const lockBottom = gadget.lockBottom === true;
  const keepsVerticalResize = shouldEmitResizeGadget(
    false,
    false,
    lockTop,
    lockBottom,
  );
  if (!nextLockLeft && !nextLockRight && keepsVerticalResize) {
    return undefined;
  }
  if (
    !shouldEmitResizeGadget(nextLockLeft, nextLockRight, lockTop, lockBottom)
  ) {
    return { deleteResize: true };
  }

  const scale = getResizeLockLayoutScale(win);
  const parent =
    gadget.parentId && isSupportedParentResizeContext(win.parent)
      ? win.parent
      : undefined;
  const baseXRaw = getBaseRectRaw(gadget.xRaw, gadget.x, "x", scale);
  const baseWRaw = getBaseRectRaw(gadget.wRaw, gadget.w, "w", scale);
  const verticalArgs = buildCurrentVerticalResizeArgs(gadget, scale);
  if (!baseXRaw || !baseWRaw || !verticalArgs?.yRaw || !verticalArgs.hRaw)
    return undefined;

  const existingRightAnchorXRaw = usesWidthResizeReference(gadget.resizeXRaw)
    ? gadget.resizeXRaw?.trim()
    : usesWidthResizeReference(gadget.xRaw)
      ? gadget.xRaw?.trim()
      : undefined;
  const existingStretchWidthRaw = usesWidthResizeReference(gadget.resizeWRaw)
    ? gadget.resizeWRaw?.trim()
    : usesWidthResizeReference(gadget.wRaw)
      ? gadget.wRaw?.trim()
      : undefined;

  const rightAnchorXRaw =
    existingRightAnchorXRaw ??
    (parent
      ? buildParentRightAnchorXRaw(gadget, parent, scale)
      : buildTopLevelRightAnchorXRaw(gadget, win));
  const stretchWidthRaw =
    existingStretchWidthRaw ??
    (parent
      ? buildParentStretchWidthRaw(gadget, parent, scale)
      : buildTopLevelStretchWidthRaw(gadget, win));

  const xRaw = nextLockLeft ? baseXRaw : rightAnchorXRaw;
  const wRaw = nextLockLeft && nextLockRight ? stretchWidthRaw : baseWRaw;
  if (!xRaw || !wRaw) return undefined;

  return {
    xRaw,
    yRaw: verticalArgs.yRaw,
    wRaw,
    hRaw: verticalArgs.hRaw,
  };
}

export function buildGadgetVerticalLockResizeUpdate(
  gadget: GadgetResizeLockLike,
  win: WindowResizeLockLike | undefined,
  nextLockTop: boolean,
  nextLockBottom: boolean,
): GadgetResizeRawUpdate | undefined {
  const lockLeft = gadget.lockLeft !== false;
  const lockRight = gadget.lockRight === true;
  const keepsHorizontalResize = shouldEmitResizeGadget(
    lockLeft,
    lockRight,
    false,
    false,
  );
  if (!nextLockTop && !nextLockBottom && keepsHorizontalResize) {
    return undefined;
  }
  if (
    !shouldEmitResizeGadget(lockLeft, lockRight, nextLockTop, nextLockBottom)
  ) {
    return { deleteResize: true };
  }

  const scale = getResizeLockLayoutScale(win);
  const parent =
    gadget.parentId && isSupportedParentResizeContext(win?.parent)
      ? win?.parent
      : undefined;
  const skin = win?.platformSkin;
  if (gadget.parentId && !parent) return undefined;
  const horizontalArgs = buildCurrentHorizontalResizeArgs(gadget, scale);
  const baseYRaw = getBaseRectRaw(gadget.yRaw, gadget.y, "y", scale);
  const baseHRaw = getBaseRectRaw(gadget.hRaw, gadget.h, "h", scale);
  if (!horizontalArgs?.xRaw || !horizontalArgs.wRaw || !baseYRaw || !baseHRaw)
    return undefined;

  const existingBottomAnchorYRaw = usesHeightResizeReference(gadget.resizeYRaw)
    ? gadget.resizeYRaw?.trim()
    : usesHeightResizeReference(gadget.yRaw)
      ? gadget.yRaw?.trim()
      : undefined;
  const existingStretchHeightRaw = usesHeightResizeReference(gadget.resizeHRaw)
    ? gadget.resizeHRaw?.trim()
    : usesHeightResizeReference(gadget.hRaw)
      ? gadget.hRaw?.trim()
      : undefined;

  const bottomAnchorYRaw =
    existingBottomAnchorYRaw ??
    (parent
      ? buildParentBottomAnchorYRaw(gadget, parent, scale, skin)
      : win
        ? buildTopLevelBottomAnchorYRaw(gadget, win)
        : undefined);
  const stretchHeightRaw =
    existingStretchHeightRaw ??
    (parent
      ? buildParentStretchHeightRaw(gadget, parent, scale, skin)
      : win
        ? buildTopLevelStretchHeightRaw(gadget, win)
        : undefined);

  if (!nextLockBottom) {
    return {
      xRaw: horizontalArgs.xRaw,
      yRaw: baseYRaw,
      wRaw: horizontalArgs.wRaw,
      hRaw: baseHRaw,
    };
  }

  if (!nextLockTop) {
    if (!bottomAnchorYRaw) return undefined;
    return {
      xRaw: horizontalArgs.xRaw,
      yRaw: bottomAnchorYRaw,
      wRaw: horizontalArgs.wRaw,
      hRaw: baseHRaw,
    };
  }

  if (!stretchHeightRaw) return undefined;
  return {
    xRaw: horizontalArgs.xRaw,
    yRaw: baseYRaw,
    wRaw: horizontalArgs.wRaw,
    hRaw: stretchHeightRaw,
  };
}
