import { EXT_TO_WEBVIEW_MSG_TYPE, WEBVIEW_TO_EXT_MSG_TYPE, type ExtensionToWebviewMessage, type WebviewToExtensionMessage, type WindowsRegistryColors } from "../shared/messages";
import {
  GRID_MODE_KEY,
  SNAP_MODE_KEY,
  DESIGNER_OS_SKIN_KEY,
  WARNING_PRESENCE_MODE_KEY,
  WARNING_VERSION_UPGRADE_MODE_KEY,
  type DesignerSettings,
  type GridMode
} from "../shared/designer-settings";
import {
  type PreviewRect,
  type PreviewChromeMetrics,
  type PanelTabLayout,
  type WindowChromeLayout,
  type ResizeHandle,
  intersectRect,
  rectContainsPoint,
  isPointOnRectBorder,
  getContainerChromeHitZone,
  getScrollAreaBarSize,
  getScrollAreaVerticalBarRect,
  getScrollAreaHorizontalBarRect,
  getScrollAreaChromeHitZone,
  getScrollAreaViewportRect,
  clampScrollAreaOffset,
  getScrollAreaMaxOffsetX,
  getScrollAreaMaxOffsetY,
  getScrollAreaVerticalThumbRect,
  getScrollAreaHorizontalThumbRect,
  resolvePanelActiveItem,
  getPanelTabLayouts,
  getPanelTabVisibleHitRect,
  getSplitterBarRect,
  getSplitterChromeHitZone,
  getSplitterPaneRect,
  getSplitterResolvedPosition,
  getGadgetContentRect,
  getStatusBarAlignedX,
  getCanvasMenuBarRect,
  getWindowChromeLayout,
  getWindowPreviewFrameRect,
  getWindowPreviewResizeButtonRect,
  hitWindowPreviewResizeButton,
  getWindowClientSurfaceRects,
  resolvePreviewChromeMetricsForOsSkin,
  usesOriginalMacRoundedButtonChrome,
  getPreviewComboArrowLayout,
  getPreviewDateArrowLayout,
  getPreviewComboChromeHeight,
  getPreviewSpinButtonLayout,
  getPreviewTrackBarThumbAssetLayout,
  getPreviewScrollBarArrowAssetLayouts,
  getPreviewScrollBarThumbFillLayout,
  getPreviewTrackBarMacGrooveHighlightLines,
  getPreviewTrackBarNoTicksFillRect,
  getRectHandlePoints,
  hitHandlePoints,
  clampRect,
  applyResize,
  isPointInTitleBar as isPointInWindowTitleBarRect,
  isPointInWindowRect,
  toWindowGlobalPoint,
  toWindowLocalPoint
} from "../core/preview/chrome";
import {
  applyPreviewColumnHeaderTextStyle,
  applyPreviewGadgetTextStyle,
  drawPreviewTextDecorations,
} from "../core/preview/gadget-font";
import { getPreviewButtonTextY, getPreviewCheckableTextY, getPreviewComboTextX, getPreviewComboTextY, getPreviewDateTextY, getPreviewFrameMacBodyOffsetY, getPreviewGadgetText, getPreviewListHeaderTextY, getPreviewListRowAdvance, getPreviewSpinTextY, getPreviewStringLikeTextY, getPreviewTextLikeTextPosition } from "../core/preview/gadget-text";
import {
  STATUSBAR_KNOWN_FLAGS,
  buildStatusBarFlagsRaw,
  getStatusBarFieldDisplaySummary,
  getStatusBarProgressPreviewMetrics,
  parseStatusBarWidth
} from "../core/statusbar/preview";
import {
  getStatusBarProgressInspectorValue,
  normalizeStatusBarProgressRaw,
  parseStatusBarWidthInspectorInput,
  STATUSBAR_WIDTH_IGNORE_LITERAL
} from "../core/statusbar/inspector";
import {
  type MenuEntryMoveTargetLike,
  type LinearTopLevelEntryMoveTargetLike,
  type StatusBarPreviewInsertAction,
  type ToolBarPreviewInsertAction,
  type TopLevelMoveIndicatorRenderMode,
  canEditToolBarTooltip,
  deriveWindows7MenuBarPalette,
  getDefaultMenuItemInsertArgs,
  getMenuEntryMoveTarget,
  getLinearTopLevelEntryMoveTarget,
  getMenuEntryRect,
  getMenuFlyoutAnchorRect,
  getMenuFlyoutPanelRect,
  getOpenSubMenuBalance,
  getDirectMenuChildIndices,
  getMenuAncestorChain,
  getMenuEntryBlockEndIndex,
  getMenuEntryLevel,
  getMenuInsertLevel,
  getMenuEntrySourceLine,
  getMenuEntrySelectedIndexAtDragStart,
  getMenuFlyoutEntryTextLayout,
  getMenuFlyoutFooterOpacity,
  getMenuFlyoutFooterPreviewRect,
  getMenuFlyoutFooterTextPosition,
  getMenuFlyoutSeparatorLineY,
  getMenuFlyoutSeparatorPreviewRect,
  getMenuFlyoutEntryPreviewRect,
  getMenuFlyoutShortcutOpacity,
  getMenuFooterRect,
  getMenuPreviewLabel,
  getMenuVisibleEntries,
  getPredictedLinearMoveIndex,
  getStatusBarAddButtonPreviewLayout,
  getStatusBarFieldImageY,
  getStatusBarFieldPreviewRect,
  getStatusBarFieldMoveTarget,
  getStatusBarFieldTextBaselineY,
  getStatusBarFieldWidths,
  getStatusBarPreviewInsertArgs,
  getStatusBarProgressTrackPreviewRect,
  getSelectedMenuEntryInspectorFieldConfig,
  getSelectedStatusBarInspectorFieldConfig,
  getSelectedToolBarInspectorFieldConfig,
  getTopLevelSelectProcEditState,
  buildOptionalInspectorLiteralRaw,
  buildOptionalInspectorPlainValue,
  buildPendingMenuEntryInsertSelection,
  buildPendingMenuEntrySelection,
  buildPendingMenuRootSelection,
  buildPendingStatusBarFieldInsertSelection,
  buildPendingStatusBarFieldMoveSelection,
  buildPendingStatusBarRootSelection,
  buildPendingToolBarEntryInsertSelection,
  buildPendingToolBarEntryMoveSelection,
  buildPendingToolBarRootSelection,
  resolvePendingMenuEntrySelectionIndex,
  resolvePendingStatusBarFieldSelectionIndex,
  resolvePendingToolBarEntrySelectionIndex,
  getToolBarPreviewInsertArgs,
  getToolBarEntryAdvance,
  getToolBarEntrySelectionFocusRect,
  getToolBarEntryMoveBlockEndIndex,
  getToolBarImageButtonPreviewRect,
  getToolBarSeparatorPreviewRect,
  getToolBarSeparatorSelectedOutlineRect,
  getToolBarSeparatorSlotRect,
  getTopLevelClampedAddIconX,
  getTopLevelMoveIndicatorStrokes,
  hasPbFlag,
  hasStatusBarPreviewAssignedImage,
  resolveMenuFooterHit,
  resolvePreviewRectHit,
  resolveTopLevelChromeHit,
  unquotePbString,
  getVisibleToolBarEntryCount,
  shouldShowToolBarPreviewUnselectedFrame,
  shouldShowToolBarStructureEntry,
  hasToolBarPreviewAssignedImage,
  canMoveWindowInCanvas,
  canResizeWindowHandleInCanvas
} from "../core/toplevel/preview";

import {
  buildGadgetCheckedStateRaw,
  buildGadgetHorizontalLockResizeUpdate,
  buildGadgetVerticalLockResizeUpdate,
  buildGadgetFlagsExpr,
  buildGadgetTextRaw,
  buildGadgetTooltipRaw,
  canInspectCustomGadgetCodeRows,
  canInspectGadgetSplitterPosition,
  getCustomGadgetHelpDisplay,
  getCustomGadgetSelectPresetFieldConfig,
  getGadgetColorRowsFieldConfig,
  getGadgetColumnEditorFieldConfig,
  getGadgetConstantsFieldConfig,
  getGadgetFontFieldConfig,
  getGadgetItemEditorFieldConfig,
  getGadgetParentFieldConfig,
  getGadgetParentInspectorValue,
  getGadgetResizeLockFieldConfig,
  getGadgetSelectProcFieldConfig,
  getGadgetSplitterPositionFieldConfig,
  getGadgetTooltipFieldConfig,
  getGadgetCaptionFieldConfig,
  getGadgetCheckedStateFieldConfig,
  getGadgetCurrentImageDisplay,
  getGadgetImageRowsFieldConfig,
  getGadgetCtorRangeFieldLabels,
  getGadgetCtorRangeInspectorValue,
  getGadgetBooleanInspectorState,
  isGadgetDisabledInDesignerPreview,
  isGadgetHiddenInDesignerPreview,
  isDpiScaledGadgetCtorRange,
  isDpiScaledGadgetState,
  getGadgetKnownFlags,
  getGadgetVariableInspectorValue,
  getGadgetFontDisplaySummary,
  getGadgetTextInspectorValue,
  getGadgetTooltipInspectorValue,
  shouldShowGadgetParentDetail,
  shouldShowGadgetTabDetail
} from "../core/gadget/inspector";

import {
  hasRectChanged,
  retainPanelActiveItems,
  syncPanelActiveItemsForSelection
} from "../core/utils/webview-state";
import {
  buildInsertedGadgetIdentity,
  canHostInsertedGadgets,
  getGadgetInsertLabel,
  isInsertableGadgetKind,
  shouldInsertGadgetAsPbAny,
  type InsertableGadgetKind
} from "../core/gadget/insert";
import { resolvePreviewPlatformFromOsSkin, type PreviewPlatform } from "../core/utils/form-settings-runtime";
import { parseDesignerLayoutRaw, parseUnscaledLayoutRaw, type DesignerLayoutNumericField } from "../core/parser/layout-raw";
import {
  commitDisplayedLayoutPoint,
  commitDisplayedLayoutRect,
  commitDisplayedLayoutValue,
  formatDisplayedLayoutUnscaledValue,
  getDisplayedLayoutValue,
  getLayoutDpiScale,
  getStableDisplayedLayoutValue,
  isLayoutDpiScalingActive,
  unscaleDisplayedLayoutValue,
} from "../core/utils/layout-dpi";
import {
  canOpenGadgetReparentDialog,
  getGadgetReparentParentOptions,
} from "../core/gadget/reparent";
import { getPanelInspectorItemLabel } from "../core/gadget/item-label";
import { resolveGadgetCtorPreviewLocalRect } from "../core/gadget/layout";
import {
  canImmediateInsertFromToolbox,
  getDefaultToolboxPanelKind,
  getImmediateToolboxInsertPosition,
  getToolboxPanelCategories,
  type ToolboxPanelTabId
} from "../core/toolbox/panel";
import { buildOriginalGadgetDeletePlan } from "../core/gadget/delete";
import { quotePbString } from "../core/parser/tokenizer";
import {
  GADGET_KIND,
  type SourceRange,
  type Gadget,
  type GadgetItem,
  type GadgetColumn,
  type FormWindow,
  type FormMenuEntry,
  type FormMenu,
  type FormToolBarEntry,
  type FormToolBar,
  type FormStatusBarField,
  type FormStatusBar,
  type FormImage,
} from "../core/model";
import {
  buildCreatedFormImageReference,
  buildFormImageEditorDraft,
  buildFormImageLineLabel,
  canChooseFileForFormImageEntry,
  canRelativizeFormImageEntry,
  canToggleFormImagePbAny,
  collectFormImageUsages,
  countFormImageUsages,
  findFormImageEntryById,
  getDefaultFormImageReferenceSelection,
  getFormImageCallName,
  getFormImageReferenceHint as getCoreFormImageReferenceHint,
  requiresFormImageAssignedVar,
  type FormImageUsage,
} from "../core/image/model";
import {
  buildWindowFlagsExpr,
  getWindowBaseRowsFieldConfig,
  getWindowBooleanInspectorState,
  getWindowColorFieldConfig,
  getWindowConstantsFieldConfig,
  getWindowGenerateEventProcFieldConfig,
  getWindowGenerateEventProcEditState,
  getWindowHiddenFieldConfig,
  getWindowDisabledFieldConfig,
  getWindowEnumValueFieldConfig,
  getWindowParentAsRawExpressionWithOverride,
  getWindowParentFieldConfig,
  getWindowParentInspectorValue,
  getWindowPositionInspectorValue,
  getWindowPreviewTitleBarHeight,
  getWindowPreviewChromeTopPadding,
  getWindowPreviewClientBottomPadding,
  getWindowPreviewClientSidePadding,
  getWindowPreviewCanvasOrigin,
  getWindowPreviewCanvasCssSize,
  getWindowPreviewFormScrollbarWidth,
  getWindowPreviewScrollContentSize,
  getWindowPreviewTitleButtonAssetKind,
  getWindowPreviewTitleButtonLayout,
  getWindowPreviewTitleBarDecoration,
  getWindowPreviewTitleBarMetrics,
  getWindowPreviewTitleButtonSize,
  getWindowPreviewTitleTextLayout,
  getWindowPreviewTitleIconSize,
  getWindowSelectProcFieldConfig,
  getWindowPreviewToolBarDecoration,
  getWindowPreviewStatusBarDecoration,
  getWindowPreviewStatusBarProgressDecoration,
  getWindowPreviewMenuBarDecoration,
  getWindowPreviewMenuFlyoutDecoration,
  getWindowPreviewAddIconMetrics,
  getWindowPreviewMenuSubmenuIconMetrics,
  getWindowPreviewMenuRootEntryRect,
  getWindowPreviewBodyDecoration,
  usesWindowPreviewExternalMenuBar,
  getWindowPreviewFrameDecoration,
  getWindowPreviewFrameStrokeRect,
  hasWindowPreviewResizeGrip,
  hasWindowPreviewTitleIcon,
  getWindowVariableInspectorValue,
  type WindowPreviewTitleButtonKind,
  parseWindowCustomFlagsInput,
  parseWindowEventProcInspectorInput,
  parseWindowParentInspectorInput,
  parseWindowPositionInspectorInput,
  parseWindowVariableNameInspectorInput,
  WINDOW_POSITION_IGNORE_LITERAL
} from "../core/window/inspector";
import {
  cssHexToPbRgbRaw,
  getWindowColorInspectorDisplay,
  parseWindowColorInspectorInput,
  pbColorNumberToCssHex
} from "../core/window/color-inspector";
import {
  PB_WRONG_VARIABLE_NAME_MESSAGE,
  isValidPbVariableReference
} from "../core/utils/property-validation";
import {
  buildNextGeneratedImageIdRaw,
  getStatusBarCurrentImageEditState,
  resolveStatusBarCurrentImageCreate,
  resolveStatusBarCurrentImageRebind,
  shouldCleanupStatusBarReboundImage
} from "../core/statusbar/image-inspector";
import { getTopLevelSelectedImageInspectorConfig } from "../core/toplevel/image-inspector";
import { resolveTopLevelCanvasContextMenuActions } from "../core/toplevel/context-menu";
import { canCopyPasteGadgetFromContextMenu, resolveGadgetCanvasContextMenuActions, type GadgetCanvasContextMenuAction } from "../core/gadget/context-menu";
import type { DesignerTopLevelSelection, TopLevelCanvasContextMenuSelection } from "../core/toplevel/selection";

import {
  PREVIEW_PLUS_ICON_DATA_URI,
  PREVIEW_SUBMENU_ICON_DATA_URI,
  PREVIEW_WINDOWS_TITLE_ICON_DATA_URI,
  PREVIEW_WINDOWS7_CLOSE_BUTTON_DATA_URI,
  PREVIEW_WINDOWS7_MINIMIZE_BUTTON_DATA_URI,
  PREVIEW_WINDOWS7_MINIMIZE_DISABLED_BUTTON_DATA_URI,
  PREVIEW_WINDOWS7_MAXIMIZE_BUTTON_DATA_URI,
  PREVIEW_WINDOWS7_MAXIMIZE_DISABLED_BUTTON_DATA_URI,
  PREVIEW_WINDOWS8_CLOSE_BUTTON_DATA_URI,
  PREVIEW_WINDOWS8_MINIMIZE_BUTTON_DATA_URI,
  PREVIEW_WINDOWS8_MAXIMIZE_BUTTON_DATA_URI,
  PREVIEW_MAC_CLOSE_BUTTON_DATA_URI,
  PREVIEW_MAC_MINIMIZE_BUTTON_DATA_URI,
  PREVIEW_MAC_MAXIMIZE_BUTTON_DATA_URI,
  PREVIEW_MAC_DISABLED_BUTTON_DATA_URI,
  PREVIEW_LINUX_CLOSE_BUTTON_DATA_URI,
  PREVIEW_LINUX_MINIMIZE_BUTTON_DATA_URI,
  PREVIEW_LINUX_MAXIMIZE_BUTTON_DATA_URI,
  PREVIEW_MAC_CHECKBOX_DATA_URI,
  PREVIEW_MAC_CHECKBOX_CHECKED_DATA_URI,
  PREVIEW_WINDOWS7_CHECKBOX_DATA_URI,
  PREVIEW_WINDOWS7_CHECKBOX_CHECKED_DATA_URI,
  PREVIEW_WINDOWS8_CHECKBOX_DATA_URI,
  PREVIEW_WINDOWS8_CHECKBOX_CHECKED_DATA_URI,
  PREVIEW_MAC_OPTION_DATA_URI,
  PREVIEW_MAC_OPTION_CHECKED_DATA_URI,
  PREVIEW_WINDOWS7_OPTION_DATA_URI,
  PREVIEW_WINDOWS7_OPTION_CHECKED_DATA_URI,
  PREVIEW_WINDOWS8_OPTION_DATA_URI,
  PREVIEW_WINDOWS8_OPTION_CHECKED_DATA_URI,
  PREVIEW_DATE_ICON_DATA_URI,
  PREVIEW_WINDOWS_COMBO_ARROW_DOWN_DATA_URI,
  PREVIEW_WINDOWS8_COMBO_ARROW_DOWN_DATA_URI,
  PREVIEW_MAC_COMBO_DOUBLE_ARROWS_DATA_URI,
  PREVIEW_WINDOWS_SCROLL_UP_DATA_URI,
  PREVIEW_WINDOWS_SCROLL_DOWN_DATA_URI,
  PREVIEW_WINDOWS_SCROLL_LEFT_DATA_URI,
  PREVIEW_WINDOWS_SCROLL_RIGHT_DATA_URI,
  PREVIEW_WINDOWS8_SCROLL_UP_DATA_URI,
  PREVIEW_WINDOWS8_SCROLL_DOWN_DATA_URI,
  PREVIEW_WINDOWS8_SCROLL_LEFT_DATA_URI,
  PREVIEW_WINDOWS8_SCROLL_RIGHT_DATA_URI,
  PREVIEW_MAC_TRACKBAR_DATA_URI,
  PREVIEW_MAC_TRACKBAR_VERTICAL_DATA_URI,
  PREVIEW_MAC_SPIN_DATA_URI,
  PREVIEW_WINDOWS7_TRACKBAR_DATA_URI,
  PREVIEW_WINDOWS7_TRACKBAR_VERTICAL_DATA_URI,
  PREVIEW_WINDOWS8_SPIN_DATA_URI,
} from "../core/preview/assets";


type Model = {
  window?: FormWindow;
  gadgets: Gadget[];
  menus?: FormMenu[];
  toolbars?: FormToolBar[];
  statusbars?: FormStatusBar[];
  images: FormImage[];
  procedureNames?: string[];
  meta?: {
    header?: { version?: string; line: number; hasStrictSyntaxWarning: boolean };
    issues?: Array<{ severity: "error" | "warning" | "info"; message: string; line?: number }>;
  };
};

declare const acquireVsCodeApi: () => { postMessage: (msg: WebviewToExtensionMessage) => void };

const vscode = acquireVsCodeApi();

function post(msg: WebviewToExtensionMessage) {
  vscode.postMessage(msg);
}


const canvas = document.getElementById("designer") as HTMLCanvasElement;
const canvasWrap = canvas.parentElement as HTMLDivElement;
const panelEl = document.querySelector(".panel") as HTMLDivElement | null;
const panelTopSectionEl = document.getElementById("panelTopSection") as HTMLDivElement | null;
const panelSectionResizerEl = document.getElementById("panelSectionResizer") as HTMLDivElement | null;
const panelBodyEl = document.getElementById("panelBody") as HTMLDivElement | null;
const toolboxTabButtonEl = document.getElementById("toolboxTabButton") as HTMLButtonElement | null;
const objectsTabButtonEl = document.getElementById("objectsTabButton") as HTMLButtonElement | null;
const toolboxTabPanelEl = document.getElementById("toolboxTabPanel") as HTMLDivElement | null;
const objectsTabPanelEl = document.getElementById("objectsTabPanel") as HTMLDivElement | null;
const toolboxListEl = document.getElementById("toolboxList") as HTMLDivElement | null;
const propsEl = document.getElementById("props") as HTMLDivElement;
const listEl = document.getElementById("list") as HTMLDivElement;
const parentSelEl = document.getElementById("parentSel") as HTMLSelectElement;
const cancelInsertGadgetButtonEl = document.getElementById("cancelInsertGadgetButton") as HTMLButtonElement;
const errEl = document.getElementById("err") as HTMLDivElement;
const diagEl = document.getElementById("diag") as HTMLDivElement;
const infoHintEl = document.getElementById("infoHint") as HTMLDivElement;
const infoSelectionEl = document.getElementById("infoSelection") as HTMLDivElement;

let model: Model = { gadgets: [], images: [] };

type DesignerSelection =
  | { kind: "gadget"; id: string }
  | { kind: "window" }
  | DesignerTopLevelSelection
  | { kind: "images" }
  | { kind: "image"; id: string }
  | null;
let selection: DesignerSelection = null;
let windowParentAsRawExpressionOverrides = new Map<string, boolean>();

type PendingMenuEntrySelection = {
  menuId: string;
  preferredIndex: number;
  kind: string;
  level?: number;
  idRaw?: string;
  textRaw?: string;
  shortcut?: string;
  iconRaw?: string;
};

type PendingToolBarEntrySelection = {
  toolBarId: string;
  preferredIndex: number;
  kind: string;
  idRaw?: string;
  iconRaw?: string;
  textRaw?: string;
  toggle?: boolean;
};

type PendingStatusBarFieldSelection = {
  statusBarId: string;
  preferredIndex: number;
  widthRaw?: string;
  textRaw?: string;
  imageRaw?: string;
  flagsRaw?: string;
  progressBar?: boolean;
  progressRaw?: string;
};

type PendingGadgetSelection = {
  id: string;
};

type PendingSplitterInsertConfig = {
  gadget1Id: string;
  gadget2Id: string;
};

let pendingMenuEntrySelection: PendingMenuEntrySelection | null = null;
let pendingToolBarEntrySelection: PendingToolBarEntrySelection | null = null;
let pendingStatusBarFieldSelection: PendingStatusBarFieldSelection | null = null;
let pendingGadgetSelection: PendingGadgetSelection | null = null;
let pendingInsertGadgetKind: string | null = null;
let pendingSplitterInsertConfig: PendingSplitterInsertConfig | null = null;
let activeTopPanelTab: ToolboxPanelTabId = "toolbox";
let selectedToolboxKind: InsertableGadgetKind = getDefaultToolboxPanelKind();

function setActiveTopPanelTab(tab: ToolboxPanelTabId): void {
  activeTopPanelTab = tab;
  renderTopPanelTabs();
}

type PendingImageEditor = {
  sourceLine: number;
  inline: boolean;
  idRaw: string;
  imageRaw: string;
  assignedVar: string;
};

type ImageAssignmentTarget =
  | { kind: "menuEntry"; menuId: string; entryIndex: number }
  | { kind: "toolBarEntry"; toolBarId: string; entryIndex: number }
  | { kind: "statusBarField"; statusBarId: string; fieldIndex: number }
  | { kind: "gadget"; gadgetId: string };

type PendingImageReferencePicker = {
  target: ImageAssignmentTarget;
  selectedImageId: string;
};

type PendingImageAssignmentDraft = {
  target: ImageAssignmentTarget;
  mode: "create" | "chooseFile";
  inline: boolean;
  idRaw: string;
  imageRaw: string;
  assignedVar: string;
  resizeToImage: boolean;
};

type PendingImageInsertDraft = {
  inline: boolean;
  idRaw: string;
  imageRaw: string;
  assignedVar: string;
};

type PendingGadgetItemEditor = {
  gadgetId: string;
  sourceLine?: number;
  text: string;
  imageRaw: string;
  flagsRaw: string;
  posRaw: string;
};

type PendingGadgetColumnEditor = {
  gadgetId: string;
  sourceLine?: number;
  title: string;
  widthRaw: string;
  colRaw: string;
};

type PendingDestructiveAction =
  | { kind: "deleteGadget"; gadgetId: string; message: string; confirmLabel: string }
  | { kind: "deleteMenuEntry"; menuId: string; entryIndex: number; sourceLine: number; entryKind: string; message: string; confirmLabel: string }
  | { kind: "deleteMenu"; menuId: string; message: string; confirmLabel: string }
  | { kind: "deleteToolBarEntry"; toolBarId: string; entryIndex: number; sourceLine: number; entryKind: string; message: string; confirmLabel: string }
  | { kind: "deleteToolBar"; toolBarId: string; message: string; confirmLabel: string }
  | { kind: "deleteStatusBarField"; statusBarId: string; fieldIndex: number; sourceLine: number; message: string; confirmLabel: string }
  | { kind: "clearStatusBarField"; statusBarId: string; fieldIndex: number; sourceLine: number; message: string; confirmLabel: string }
  | { kind: "deleteStatusBar"; statusBarId: string; message: string; confirmLabel: string }
  | { kind: "deleteImage"; imageId: string; sourceLine: number; message: string; confirmLabel: string }
  | { kind: "deleteGadgetItem"; gadgetId: string; sourceLine: number; message: string; confirmLabel: string }
  | { kind: "deleteGadgetColumn"; gadgetId: string; sourceLine: number; message: string; confirmLabel: string };

let pendingImageEditor: PendingImageEditor | null = null;
let pendingImageReferencePicker: PendingImageReferencePicker | null = null;
let pendingImageAssignmentDraft: PendingImageAssignmentDraft | null = null;
let pendingImageInsertDraft: PendingImageInsertDraft | null = null;
let pendingGadgetItemEditor: PendingGadgetItemEditor | null = null;
let pendingGadgetColumnEditor: PendingGadgetColumnEditor | null = null;
let pendingDestructiveAction: PendingDestructiveAction | null = null;
let pendingDestructiveDialogAction: PendingDestructiveAction | null = null;
let destructiveDialogBackdropEl: HTMLDivElement | null = null;
let splitterInsertDialogBackdropEl: HTMLDivElement | null = null;
let selectParentDialogBackdropEl: HTMLDivElement | null = null;

type PendingCanvasContextMenuActions = ReturnType<typeof resolveTopLevelCanvasContextMenuActions>;
type CanvasContextMenuAction = NonNullable<PendingCanvasContextMenuActions>[number] | GadgetCanvasContextMenuAction;
type CanvasContextMenuSelection = DesignerTopLevelSelection | { kind: "gadget"; id: string };
type CanvasContextMenuTarget = TopLevelCanvasContextMenuSelection | { kind: "gadget"; id: string };

type PendingCanvasContextMenu = {
  x: number;
  y: number;
  actions: CanvasContextMenuAction[];
  selection: CanvasContextMenuSelection;
};

let pendingCanvasContextMenu: PendingCanvasContextMenu | null = null;
let canvasContextMenuEl: HTMLDivElement | null = null;
let canvasContextMenuIgnoreMouseDownTimeStamp: number | null = null;

const expanded = new Map<string, boolean>();
let copiedGadgetId: string | null = null;
const panelActiveItems = new Map<string, number>();
const scrollAreaOffsets = new Map<string, { x: number; y: number }>();

type PreviewEntryRect = PreviewRect & { ownerId: string; index: number };
type PreviewMenuFooterRect = PreviewRect & { menuId: string; parentIndex: number };
type PreviewMenuAddRect = PreviewRect & { menuId: string };
type PreviewToolBarAddRect = PreviewRect & { toolBarId: string };
type PreviewStatusBarAddRect = PreviewRect & { statusBarId: string };
let menuEntryPreviewRects: PreviewEntryRect[] = [];
let menuFooterPreviewRects: PreviewMenuFooterRect[] = [];
let menuAddPreviewRect: PreviewMenuAddRect | null = null;
let toolBarAddPreviewRect: PreviewToolBarAddRect | null = null;
let statusBarAddPreviewRect: PreviewStatusBarAddRect | null = null;
let toolBarEntryPreviewRects: PreviewEntryRect[] = [];
let statusBarFieldPreviewRects: PreviewEntryRect[] = [];

let previewPlusIconImage: HTMLImageElement | null = null;
let previewSubmenuIconImage: HTMLImageElement | null = null;
let previewWindowsTitleIconImage: HTMLImageElement | null = null;
const previewWindowsTitleButtonImageCache = new Map<string, HTMLImageElement | null>();
const previewMacTitleButtonImageCache = new Map<string, HTMLImageElement | null>();
const previewLinuxTitleButtonImageCache = new Map<string, HTMLImageElement | null>();
const previewCheckableImageCache = new Map<string, HTMLImageElement | null>();
let previewDateIconImage: HTMLImageElement | null = null;
const previewComboArrowImageCache = new Map<string, HTMLImageElement | null>();
let previewMacComboDoubleArrowsImage: HTMLImageElement | null = null;
const previewScrollBarArrowImageCache = new Map<string, HTMLImageElement | null>();
let previewMacTrackBarImage: HTMLImageElement | null = null;
let previewMacTrackBarVerticalImage: HTMLImageElement | null = null;
let previewWindows7TrackBarImage: HTMLImageElement | null = null;
let previewWindows7TrackBarVerticalImage: HTMLImageElement | null = null;
let previewMacSpinImage: HTMLImageElement | null = null;
let previewWindows8SpinImage: HTMLImageElement | null = null;
const previewResolvedGadgetImageCache = new Map<string, HTMLImageElement | null>();


function createPreviewRasterIcon(dataUri: string): HTMLImageElement | null {
  if (typeof Image === "undefined") {
    return null;
  }

  const image = new Image();
  image.decoding = "sync";
  image.addEventListener("load", () => render(), { once: true });
  image.src = dataUri;
  return image;
}

function getPreviewPlusIconImage(): HTMLImageElement | null {
  if (!previewPlusIconImage) {
    previewPlusIconImage = createPreviewRasterIcon(PREVIEW_PLUS_ICON_DATA_URI);
  }

  return previewPlusIconImage;
}

function getPreviewSubmenuIconImage(): HTMLImageElement | null {
  if (!previewSubmenuIconImage) {
    previewSubmenuIconImage = createPreviewRasterIcon(PREVIEW_SUBMENU_ICON_DATA_URI);
  }

  return previewSubmenuIconImage;
}

function getPreviewWindowsTitleIconImage(): HTMLImageElement | null {
  if (!previewWindowsTitleIconImage) {
    previewWindowsTitleIconImage = createPreviewRasterIcon(PREVIEW_WINDOWS_TITLE_ICON_DATA_URI);
  }

  return previewWindowsTitleIconImage;
}

type WindowsPreviewOsSkin = "windows7" | "windows8";

function getPreviewWindowsTitleButtonDataUri(
  osSkin: WindowsPreviewOsSkin,
  kind: WindowPreviewTitleButtonKind,
  enabled: boolean
): string {
  if (osSkin === "windows7") {
    if (kind === "close") {
      return PREVIEW_WINDOWS7_CLOSE_BUTTON_DATA_URI;
    }

    if (kind === "minimize") {
      return enabled
        ? PREVIEW_WINDOWS7_MINIMIZE_BUTTON_DATA_URI
        : PREVIEW_WINDOWS7_MINIMIZE_DISABLED_BUTTON_DATA_URI;
    }

    return enabled
      ? PREVIEW_WINDOWS7_MAXIMIZE_BUTTON_DATA_URI
      : PREVIEW_WINDOWS7_MAXIMIZE_DISABLED_BUTTON_DATA_URI;
  }

  if (kind === "close") {
    return PREVIEW_WINDOWS8_CLOSE_BUTTON_DATA_URI;
  }

  return kind === "minimize"
    ? PREVIEW_WINDOWS8_MINIMIZE_BUTTON_DATA_URI
    : PREVIEW_WINDOWS8_MAXIMIZE_BUTTON_DATA_URI;
}

function getPreviewWindowsTitleButtonImage(
  osSkin: WindowsPreviewOsSkin,
  kind: WindowPreviewTitleButtonKind,
  enabled: boolean
): HTMLImageElement | null {
  const cacheKey = `${osSkin}:${kind}:${enabled ? "enabled" : "disabled"}`;
  const cached = previewWindowsTitleButtonImageCache.get(cacheKey);
  if (typeof cached !== "undefined") {
    return cached;
  }

  const image = createPreviewRasterIcon(getPreviewWindowsTitleButtonDataUri(osSkin, kind, enabled));
  previewWindowsTitleButtonImageCache.set(cacheKey, image);
  return image;
}


function getPreviewMacTitleButtonDataUri(kind: WindowPreviewTitleButtonKind, enabled: boolean): string {
  const assetKind = getWindowPreviewTitleButtonAssetKind("macos", kind, enabled);
  switch (assetKind) {
    case "macClose":
      return PREVIEW_MAC_CLOSE_BUTTON_DATA_URI;
    case "macMinimize":
      return PREVIEW_MAC_MINIMIZE_BUTTON_DATA_URI;
    case "macMaximize":
      return PREVIEW_MAC_MAXIMIZE_BUTTON_DATA_URI;
    case "macDisabled":
      return PREVIEW_MAC_DISABLED_BUTTON_DATA_URI;
    default:
      return PREVIEW_MAC_DISABLED_BUTTON_DATA_URI;
  }
}

function getPreviewMacTitleButtonImage(
  kind: WindowPreviewTitleButtonKind,
  enabled: boolean
): HTMLImageElement | null {
  const cacheKey = `${kind}:${enabled ? "enabled" : "disabled"}`;
  const cached = previewMacTitleButtonImageCache.get(cacheKey);
  if (typeof cached !== "undefined") {
    return cached;
  }

  const image = createPreviewRasterIcon(getPreviewMacTitleButtonDataUri(kind, enabled));
  previewMacTitleButtonImageCache.set(cacheKey, image);
  return image;
}

function getPreviewLinuxTitleButtonDataUri(kind: WindowPreviewTitleButtonKind): string {
  const assetKind = getWindowPreviewTitleButtonAssetKind("linux", kind, true);
  switch (assetKind) {
    case "linuxClose":
      return PREVIEW_LINUX_CLOSE_BUTTON_DATA_URI;
    case "linuxMinimize":
      return PREVIEW_LINUX_MINIMIZE_BUTTON_DATA_URI;
    case "linuxMaximize":
      return PREVIEW_LINUX_MAXIMIZE_BUTTON_DATA_URI;
    default:
      return PREVIEW_LINUX_CLOSE_BUTTON_DATA_URI;
  }
}

function getPreviewLinuxTitleButtonImage(kind: WindowPreviewTitleButtonKind): HTMLImageElement | null {
  const cached = previewLinuxTitleButtonImageCache.get(kind);
  if (typeof cached !== "undefined") {
    return cached;
  }

  const image = createPreviewRasterIcon(getPreviewLinuxTitleButtonDataUri(kind));
  previewLinuxTitleButtonImageCache.set(kind, image);
  return image;
}


function getPreviewCheckableImageDataUri(
  kind: "checkbox" | "option",
  osSkin: DesignerSettings["osSkin"],
  checked: boolean
): string {
  if (kind === "checkbox") {
    switch (osSkin) {
      case "macos":
        return checked ? PREVIEW_MAC_CHECKBOX_CHECKED_DATA_URI : PREVIEW_MAC_CHECKBOX_DATA_URI;
      case "windows8":
        return checked ? PREVIEW_WINDOWS8_CHECKBOX_CHECKED_DATA_URI : PREVIEW_WINDOWS8_CHECKBOX_DATA_URI;
      case "windows7":
      case "linux":
      default:
        return checked ? PREVIEW_WINDOWS7_CHECKBOX_CHECKED_DATA_URI : PREVIEW_WINDOWS7_CHECKBOX_DATA_URI;
    }
  }

  switch (osSkin) {
    case "macos":
      return checked ? PREVIEW_MAC_OPTION_CHECKED_DATA_URI : PREVIEW_MAC_OPTION_DATA_URI;
    case "windows8":
      return checked ? PREVIEW_WINDOWS8_OPTION_CHECKED_DATA_URI : PREVIEW_WINDOWS8_OPTION_DATA_URI;
    case "windows7":
    case "linux":
    default:
      return checked ? PREVIEW_WINDOWS7_OPTION_CHECKED_DATA_URI : PREVIEW_WINDOWS7_OPTION_DATA_URI;
  }
}

function getPreviewCheckableImage(
  kind: "checkbox" | "option",
  osSkin: DesignerSettings["osSkin"],
  checked: boolean
): HTMLImageElement | null {
  const cacheKey = `${kind}:${osSkin}:${checked ? "checked" : "unchecked"}`;
  const cached = previewCheckableImageCache.get(cacheKey);
  if (typeof cached !== "undefined") {
    return cached;
  }

  const image = createPreviewRasterIcon(getPreviewCheckableImageDataUri(kind, osSkin, checked));
  previewCheckableImageCache.set(cacheKey, image);
  return image;
}

function getPreviewDateIconImage(): HTMLImageElement | null {
  if (!previewDateIconImage) {
    previewDateIconImage = createPreviewRasterIcon(PREVIEW_DATE_ICON_DATA_URI);
  }

  return previewDateIconImage;
}

function getPreviewMacComboDoubleArrowsImage(): HTMLImageElement | null {
  if (!previewMacComboDoubleArrowsImage) {
    previewMacComboDoubleArrowsImage = createPreviewRasterIcon(PREVIEW_MAC_COMBO_DOUBLE_ARROWS_DATA_URI);
  }

  return previewMacComboDoubleArrowsImage;
}

function getPreviewComboArrowImage(assetKind: "windowsComboDown" | "windows8ComboDown"): HTMLImageElement | null {
  const cached = previewComboArrowImageCache.get(assetKind);
  if (typeof cached !== "undefined") {
    return cached;
  }

  const dataUri = assetKind === "windows8ComboDown"
    ? PREVIEW_WINDOWS8_COMBO_ARROW_DOWN_DATA_URI
    : PREVIEW_WINDOWS_COMBO_ARROW_DOWN_DATA_URI;
  const image = createPreviewRasterIcon(dataUri);
  previewComboArrowImageCache.set(assetKind, image);
  return image;
}

function getPreviewScrollBarArrowImage(
  assetKind: "windowsUp" | "windowsDown" | "windowsLeft" | "windowsRight" | "windows8Up" | "windows8Down" | "windows8Left" | "windows8Right"
): HTMLImageElement | null {
  const cached = previewScrollBarArrowImageCache.get(assetKind);
  if (typeof cached !== "undefined") {
    return cached;
  }

  let dataUri: string;
  switch (assetKind) {
    case "windowsUp":
      dataUri = PREVIEW_WINDOWS_SCROLL_UP_DATA_URI;
      break;
    case "windowsDown":
      dataUri = PREVIEW_WINDOWS_SCROLL_DOWN_DATA_URI;
      break;
    case "windowsLeft":
      dataUri = PREVIEW_WINDOWS_SCROLL_LEFT_DATA_URI;
      break;
    case "windowsRight":
      dataUri = PREVIEW_WINDOWS_SCROLL_RIGHT_DATA_URI;
      break;
    case "windows8Up":
      dataUri = PREVIEW_WINDOWS8_SCROLL_UP_DATA_URI;
      break;
    case "windows8Down":
      dataUri = PREVIEW_WINDOWS8_SCROLL_DOWN_DATA_URI;
      break;
    case "windows8Left":
      dataUri = PREVIEW_WINDOWS8_SCROLL_LEFT_DATA_URI;
      break;
    case "windows8Right":
      dataUri = PREVIEW_WINDOWS8_SCROLL_RIGHT_DATA_URI;
      break;
  }

  const image = createPreviewRasterIcon(dataUri);
  previewScrollBarArrowImageCache.set(assetKind, image);
  return image;
}

function getPreviewTrackBarThumbImage(
  assetKind: "macHorizontal" | "macVertical" | "windowsHorizontal" | "windowsVertical"
): HTMLImageElement | null {
  switch (assetKind) {
    case "macHorizontal":
      if (!previewMacTrackBarImage) {
        previewMacTrackBarImage = createPreviewRasterIcon(PREVIEW_MAC_TRACKBAR_DATA_URI);
      }
      return previewMacTrackBarImage;
    case "macVertical":
      if (!previewMacTrackBarVerticalImage) {
        previewMacTrackBarVerticalImage = createPreviewRasterIcon(PREVIEW_MAC_TRACKBAR_VERTICAL_DATA_URI);
      }
      return previewMacTrackBarVerticalImage;
    case "windowsHorizontal":
      if (!previewWindows7TrackBarImage) {
        previewWindows7TrackBarImage = createPreviewRasterIcon(PREVIEW_WINDOWS7_TRACKBAR_DATA_URI);
      }
      return previewWindows7TrackBarImage;
    case "windowsVertical":
      if (!previewWindows7TrackBarVerticalImage) {
        previewWindows7TrackBarVerticalImage = createPreviewRasterIcon(PREVIEW_WINDOWS7_TRACKBAR_VERTICAL_DATA_URI);
      }
      return previewWindows7TrackBarVerticalImage;
  }
}

function getPreviewSpinImage(osSkin: DesignerSettings["osSkin"]): HTMLImageElement | null {
  if (osSkin === "windows8") {
    if (!previewWindows8SpinImage) {
      previewWindows8SpinImage = createPreviewRasterIcon(PREVIEW_WINDOWS8_SPIN_DATA_URI);
    }
    return previewWindows8SpinImage;
  }

  if (!previewMacSpinImage) {
    previewMacSpinImage = createPreviewRasterIcon(PREVIEW_MAC_SPIN_DATA_URI);
  }

  return previewMacSpinImage;
}

function createResolvedPreviewImage(src: string): HTMLImageElement | null {
  const trimmed = src.trim();
  if (!trimmed.length) return null;

  const image = new Image();
  image.decoding = "sync";
  image.src = trimmed;
  return image;
}

function getResolvedPreviewImage(src?: string): HTMLImageElement | null {
  const trimmed = src?.trim();
  if (!trimmed?.length) return null;

  const cached = previewResolvedGadgetImageCache.get(trimmed);
  if (typeof cached !== "undefined") {
    return cached;
  }

  const image = createResolvedPreviewImage(trimmed);
  previewResolvedGadgetImageCache.set(trimmed, image);
  return image;
}

function drawPreviewRasterIcon(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  if (!image || !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
    return false;
  }

  ctx.drawImage(image, x, y, width, height);
  return true;
}

function drawPreviewPlusIcon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const metrics = getWindowPreviewAddIconMetrics();
  ctx.save();
  if (drawPreviewRasterIcon(ctx, getPreviewPlusIconImage(), x, y, metrics.width, metrics.height)) {
    ctx.restore();
    return;
  }

  ctx.fillStyle = "rgb(255,255,255)";
  ctx.fillRect(x + 3, y + 3, 9, 9);
  ctx.strokeStyle = "rgb(176,176,176)";
  ctx.strokeRect(x + 3.5, y + 3.5, 8, 8);
  ctx.strokeStyle = "rgb(48,179,48)";
  ctx.beginPath();
  ctx.moveTo(x + 5.5, y + 7.5);
  ctx.lineTo(x + 9.5, y + 7.5);
  ctx.moveTo(x + 7.5, y + 5.5);
  ctx.lineTo(x + 7.5, y + 9.5);
  ctx.stroke();
  ctx.restore();
}

function drawPreviewSubmenuIndicatorIcon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const metrics = getWindowPreviewMenuSubmenuIconMetrics();
  ctx.save();
  if (drawPreviewRasterIcon(ctx, getPreviewSubmenuIconImage(), x, y, metrics.width, metrics.height)) {
    ctx.restore();
    return;
  }

  ctx.fillStyle = "rgb(96,96,96)";
  ctx.beginPath();
  ctx.moveTo(x + 1, y + 1);
  ctx.lineTo(x + metrics.width - 1, y + Math.trunc(metrics.height / 2));
  ctx.lineTo(x + 1, y + metrics.height - 1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPreviewFallbackImageIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const iconSize = Math.max(8, Math.trunc(size));
  const iconX = Math.trunc(x);
  const iconY = Math.trunc(y);

  ctx.save();
  ctx.fillStyle = "rgb(255,255,255)";
  ctx.fillRect(iconX + 1, iconY + 1, iconSize - 2, iconSize - 2);

  ctx.strokeStyle = "rgb(128,128,128)";
  ctx.strokeRect(iconX + 0.5, iconY + 0.5, iconSize - 1, iconSize - 1);

  ctx.fillStyle = "rgb(128,180,255)";
  ctx.fillRect(iconX + 2, iconY + 2, Math.max(2, iconSize - 4), Math.max(2, Math.trunc(iconSize / 3)));

  ctx.fillStyle = "rgb(255,212,80)";
  ctx.fillRect(iconX + iconSize - 5, iconY + 3, 2, 2);

  ctx.strokeStyle = "rgb(90,140,90)";
  ctx.beginPath();
  ctx.moveTo(iconX + 2.5, iconY + iconSize - 3.5);
  ctx.lineTo(iconX + Math.trunc(iconSize / 2) - 0.5, iconY + Math.trunc(iconSize / 2) + 0.5);
  ctx.lineTo(iconX + iconSize - 2.5, iconY + iconSize - 4.5);
  ctx.stroke();
  ctx.restore();
}

function getPreviewTopLevelAssignedImage(imageId?: string): HTMLImageElement | null {
  const imageEntry = findImageEntryById(imageId);
  return getResolvedPreviewImage(resolvePreviewImageSrc(imageEntry));
}

function drawPreviewTopLevelAssignedImage(
  ctx: CanvasRenderingContext2D,
  imageId: string | undefined,
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  return drawPreviewRasterIcon(ctx, getPreviewTopLevelAssignedImage(imageId), x, y, width, height);
}

let settings: DesignerSettings = {
  showGrid: true,
  gridMode: GRID_MODE_KEY.dots,
  gridSize: 10,
  gridOpacity: 0.14,

  snapToGrid: false,
  snapMode: SNAP_MODE_KEY.drop,

  windowFillOpacity: 0.05,
  outsideDimOpacity: 0.12,
  titleBarHeight: 29,
  windowPreviewWindowsCaptionlessTopPadding: 8,
  windowPreviewWindowsClientSidePadding: 8,
  windowPreviewWindowsClientBottomPadding: 8,

  canvasBackground: "",
  canvasReadonlyBackground: "",

  newGadgetsUsePbAnyByDefault: true,
  newGadgetsUseVariableAsCaption: false,
  generateEventProcedure: true,
  osSkin: DESIGNER_OS_SKIN_KEY.windows7,
  warningUnrecognizedFile: WARNING_PRESENCE_MODE_KEY.always,
  warningVersionUpgrade: WARNING_VERSION_UPGRADE_MODE_KEY.ifBackwardCompatibilityIsAffected,
  warningVersionDowngrade: WARNING_PRESENCE_MODE_KEY.always
};

let previewChromeMetrics = resolvePreviewChromeMetricsForOsSkin(settings.osSkin);

// Cache for resolved CSS system color keywords (e.g. "ButtonFace").
// Invalidated whenever osSkin changes via applySettings().
const systemColorCache = new Map<string, string>();

// Windows registry colors received from the extension (win32 only).
// null = not yet received or non-Windows host.
let windowsRegistryColors: WindowsRegistryColors | null = null;
const layoutDisplayOverrides = new Map<string, number>();
let lastLayoutDpiScale = getLayoutDpiScale(typeof window !== "undefined" ? window.devicePixelRatio : 1);


type PbfdSymbols = {
  menuEntryKinds: readonly string[];
  toolBarEntryKinds: readonly string[];
  containerGadgetKinds: readonly string[];
  windowKnownFlags?: readonly string[];
  enumNames?: { windows: string; gadgets: string; menus: string; images: string; fonts: string };
  pbAny?: string;
};

type PbfdWindow = Window & {
  __PBFD_SYMBOLS__?: PbfdSymbols;
  __PBFD_TOOLBOX_ICON_URIS__?: Record<string, string>;
};

const pbfdWindow = window as PbfdWindow;

if (!pbfdWindow.__PBFD_SYMBOLS__) {
  throw new Error("__PBFD_SYMBOLS__ is not defined");
}

const EVENT_UI_HINT = {
  eventGadgetMissing: "Requires an existing Select EventGadget() block. Enable 'Generate Event Loop' first.",
  eventMenuMissing: "No parsed Select EventMenu() block was found. Procedure names remain editable here, but writing them back still requires such a block.",
  menuIdRequired: "Only menu entries with ids can have event procedures.",
  toolBarIdRequired: "Only toolbar entries with ids can have event procedures.",
  generateEventLoopMenuBlock: "Cannot disable while a Select EventMenu() block exists.",
  generateEventLoopGadgetCases: "Cannot disable while Select EventGadget() contains Case branches."
} as const;

function getProcedureSuggestions(): string[] {
  return Array.isArray(model.procedureNames) ? model.procedureNames : [];
}

function getEventMenuEntryHint(hasEventMenuBlock: boolean, idRaw?: string, entryLabel: "menu" | "toolbar" = "menu"): string {
  return getTopLevelSelectProcEditState(hasEventMenuBlock, idRaw, entryLabel).title;
}

const PBFD_SYMBOLS: PbfdSymbols = pbfdWindow.__PBFD_SYMBOLS__;
const PB_ANY: string = PBFD_SYMBOLS.pbAny ?? "#PB_Any";
const TOOLBOX_ICON_URIS: Record<string, string> = pbfdWindow.__PBFD_TOOLBOX_ICON_URIS__ ?? {};

function menuEntryKindHint(): string {
  return `Entry kind (${PBFD_SYMBOLS.menuEntryKinds.join("/")})`;
}

function toolBarEntryKindHint(): string {
  return `Entry kind (${PBFD_SYMBOLS.toolBarEntryKinds.join("/")})`;
}

function buildWindowCaptionRaw(value: string, isVariable: boolean): string {
  return isVariable ? value : toPbString(value);
}

function getActiveLayoutDpiScale(): number {
  return getLayoutDpiScale(typeof window !== "undefined" ? window.devicePixelRatio : 1);
}

function isActiveLayoutDpiScalingEnabled(): boolean {
  return isLayoutDpiScalingActive(getActiveLayoutDpiScale());
}

type LayoutDisplayField = DesignerLayoutNumericField;

function getLayoutDisplayOverrideKey(targetKind: "window" | "gadget", targetId: string, field: LayoutDisplayField, raw: string): string {
  return `${targetKind}:${targetId}:${field}:${raw}`;
}

function storeLayoutDisplayOverride(targetKind: "window" | "gadget", targetId: string, field: LayoutDisplayField, displayValue: number, raw: string | undefined): void {
  const trimmed = raw?.trim();
  if (!trimmed?.length) return;
  layoutDisplayOverrides.set(getLayoutDisplayOverrideKey(targetKind, targetId, field, trimmed), Math.trunc(displayValue));
}

function parseDisplayedLayoutFieldRaw(raw: string | undefined, field: LayoutDisplayField): number | undefined {
  if (field === "x" || field === "y" || field === "w" || field === "h") {
    return parseDesignerLayoutRaw(raw, field);
  }
  return parseUnscaledLayoutRaw(raw);
}

function resolveDisplayedLayoutValue(targetKind: "window" | "gadget", targetId: string, field: LayoutDisplayField, raw: string | undefined, fallbackValue: number): number {
  const trimmed = raw?.trim();
  const scale = getActiveLayoutDpiScale();
  const parsed = parseDisplayedLayoutFieldRaw(trimmed, field);
  if (parsed === undefined) {
    return Math.trunc(fallbackValue);
  }

  if (!trimmed?.length) {
    return getDisplayedLayoutValue(undefined, fallbackValue, scale);
  }

  const overrideKey = getLayoutDisplayOverrideKey(targetKind, targetId, field, trimmed);
  const overrideValue = layoutDisplayOverrides.get(overrideKey);
  if (typeof overrideValue === "number" && unscaleDisplayedLayoutValue(overrideValue, scale) === parsed) {
    return Math.trunc(overrideValue);
  }

  if (typeof overrideValue === "number") {
    layoutDisplayOverrides.delete(overrideKey);
  }

  return getStableDisplayedLayoutValue(parsed, scale);
}

function syncWindowDisplayLayout(win: FormWindow): void {
  win.x = resolveDisplayedLayoutValue("window", win.id, "x", win.xRaw, win.x);
  win.y = resolveDisplayedLayoutValue("window", win.id, "y", win.yRaw, win.y);
  win.w = resolveDisplayedLayoutValue("window", win.id, "w", win.wRaw, win.w);
  win.h = resolveDisplayedLayoutValue("window", win.id, "h", win.hRaw, win.h);
}

function syncGadgetDisplayLayout(g: Gadget): void {
  g.x = resolveDisplayedLayoutValue("gadget", g.id, "x", g.xRaw, g.x);
  g.y = resolveDisplayedLayoutValue("gadget", g.id, "y", g.yRaw, g.y);
  g.w = resolveDisplayedLayoutValue("gadget", g.id, "w", g.wRaw, g.w);
  g.h = resolveDisplayedLayoutValue("gadget", g.id, "h", g.hRaw, g.h);
  syncGadgetDisplayCtorRanges(g);
  syncGadgetDisplayState(g);
}

function resolveDisplayedOptionalLayoutValue(targetKind: "window" | "gadget", targetId: string, field: LayoutDisplayField, raw: string | undefined, fallbackValue: number | undefined): number | undefined {
  const trimmed = raw?.trim();
  const scale = getActiveLayoutDpiScale();
  const parsed = parseDisplayedLayoutFieldRaw(trimmed, field);
  if (parsed === undefined) {
    const fallback = typeof fallbackValue === "number" && Number.isFinite(fallbackValue) ? fallbackValue : undefined;
    return fallback === undefined ? undefined : Math.trunc(fallback);
  }

  if (!trimmed?.length) {
    return getDisplayedLayoutValue(undefined, fallbackValue ?? parsed, scale);
  }

  const overrideKey = getLayoutDisplayOverrideKey(targetKind, targetId, field, trimmed);
  const overrideValue = layoutDisplayOverrides.get(overrideKey);
  if (typeof overrideValue === "number" && unscaleDisplayedLayoutValue(overrideValue, scale) === parsed) {
    return Math.trunc(overrideValue);
  }

  if (typeof overrideValue === "number") {
    layoutDisplayOverrides.delete(overrideKey);
  }

  return getStableDisplayedLayoutValue(parsed, scale);
}

function syncGadgetDisplayCtorRanges(g: Gadget): void {
  if (!isDpiScaledGadgetCtorRange(g.kind)) return;
  g.min = resolveDisplayedOptionalLayoutValue("gadget", g.id, "min", g.minRaw, g.min);
  g.max = resolveDisplayedOptionalLayoutValue("gadget", g.id, "max", g.maxRaw, g.max);
}

function syncGadgetDisplayState(g: Gadget): void {
  if (!isDpiScaledGadgetState(g.kind)) return;
  g.state = resolveDisplayedOptionalLayoutValue("gadget", g.id, "state", g.stateRaw, g.state);
}

function syncModelDisplayLayout(currentModel: Model | undefined): void {
  if (!currentModel) return;
  if (currentModel.window) syncWindowDisplayLayout(currentModel.window);
  for (const gadget of currentModel.gadgets) {
    syncGadgetDisplayLayout(gadget);
  }
}

function ensureLayoutScaleState(): boolean {
  const scale = getActiveLayoutDpiScale();
  if (Math.abs(scale - lastLayoutDpiScale) < 0.001) return false;
  lastLayoutDpiScale = scale;
  layoutDisplayOverrides.clear();
  syncModelDisplayLayout(model);
  return true;
}

function toUnscaledLayoutRaw(displayValue: number): string {
  return commitDisplayedLayoutValue(displayValue, getActiveLayoutDpiScale()).raw;
}

function getInspectorLayoutDisplayValue(raw: string | undefined, displayValue: number): string {
  const trimmed = raw?.trim();
  if (trimmed === WINDOW_POSITION_IGNORE_LITERAL || displayValue === -65535) {
    return WINDOW_POSITION_IGNORE_LITERAL;
  }

  if (isActiveLayoutDpiScalingEnabled()) {
    return String(Math.trunc(displayValue));
  }

  return getWindowPositionInspectorValue(raw, displayValue);
}

function getReadonlyUnscaledLayoutValue(raw: string | undefined, displayValue: number): string {
  return formatDisplayedLayoutUnscaledValue(raw, displayValue, getActiveLayoutDpiScale());
}

function getInspectorGadgetCtorRangeValue(g: Gadget, field: "min" | "max"): string {
  const raw = field === "min" ? g.minRaw : g.maxRaw;
  const fallback = field === "min" ? g.min : g.max;
  if (isActiveLayoutDpiScalingEnabled() && isDpiScaledGadgetCtorRange(g.kind) && Number.isFinite(fallback)) {
    return String(Math.trunc(fallback as number));
  }
  return getGadgetCtorRangeInspectorValue(raw, fallback);
}

function getReadonlyUnscaledGadgetCtorRangeValue(g: Gadget, field: "min" | "max"): string {
  const raw = field === "min" ? g.minRaw : g.maxRaw;
  const displayValue = field === "min" ? g.min : g.max;
  if (!Number.isFinite(displayValue)) {
    return raw?.trim() ?? "";
  }
  return formatDisplayedLayoutUnscaledValue(raw, displayValue as number, getActiveLayoutDpiScale());
}

function shouldShowReadonlyUnscaledGadgetCtorRangeRows(g: Gadget): boolean {
  return isActiveLayoutDpiScalingEnabled() && isDpiScaledGadgetCtorRange(g.kind);
}

function getReadonlyUnscaledGadgetStateValue(g: Gadget): string {
  if (!Number.isFinite(g.state)) {
    return g.stateRaw?.trim() ?? "";
  }
  return formatDisplayedLayoutUnscaledValue(g.stateRaw, g.state as number, getActiveLayoutDpiScale());
}

function shouldShowReadonlyUnscaledGadgetStateRows(g: Gadget): boolean {
  return isActiveLayoutDpiScalingEnabled() && isDpiScaledGadgetState(g.kind);
}

function shouldShowReadonlyUnscaledLayoutRows(): boolean {
  return isActiveLayoutDpiScalingEnabled();
}

function updateWindowDisplayField(win: FormWindow, field: "x" | "y" | "w" | "h", displayValue: number): void {
  const committed = commitDisplayedLayoutValue(displayValue, getActiveLayoutDpiScale());
  storeLayoutDisplayOverride("window", win.id, field, committed.displayValue, committed.raw);
  markPreviewCanvasScrollContentSizeDirty();
  switch (field) {
    case "x":
      win.x = committed.displayValue;
      win.xRaw = committed.raw;
      return;
    case "y":
      win.y = committed.displayValue;
      win.yRaw = committed.raw;
      return;
    case "w":
      win.w = committed.displayValue;
      win.wRaw = committed.raw;
      return;
    case "h":
      win.h = committed.displayValue;
      win.hRaw = committed.raw;
      return;
  }
}

function updateGadgetDisplayField(g: Gadget, field: "x" | "y" | "w" | "h", displayValue: number): void {
  const committed = commitDisplayedLayoutValue(displayValue, getActiveLayoutDpiScale());
  storeLayoutDisplayOverride("gadget", g.id, field, committed.displayValue, committed.raw);
  switch (field) {
    case "x":
      g.x = committed.displayValue;
      g.xRaw = committed.raw;
      return;
    case "y":
      g.y = committed.displayValue;
      g.yRaw = committed.raw;
      return;
    case "w":
      g.w = committed.displayValue;
      g.wRaw = committed.raw;
      return;
    case "h":
      g.h = committed.displayValue;
      g.hRaw = committed.raw;
      return;
  }
}

function getWindowCurrentFlagsExpr(win: FormWindow): string | undefined {
  return buildWindowFlagsExpr(win.knownFlags ?? [], (win.customFlags ?? []).join(" | "));
}

function postWindowOpenArgs(win: FormWindow, updates: { xRaw?: string; yRaw?: string; wRaw?: string; hRaw?: string; captionRaw?: string; flagsExpr?: string; parentRaw?: string }) {
  post({
    type: WEBVIEW_TO_EXT_MSG_TYPE.setWindowOpenArgs,
    windowKey: win.id,
    ...(Object.prototype.hasOwnProperty.call(updates, "xRaw") ? { xRaw: updates.xRaw } : {}),
    ...(Object.prototype.hasOwnProperty.call(updates, "yRaw") ? { yRaw: updates.yRaw } : {}),
    ...(Object.prototype.hasOwnProperty.call(updates, "wRaw") ? { wRaw: updates.wRaw } : {}),
    ...(Object.prototype.hasOwnProperty.call(updates, "hRaw") ? { hRaw: updates.hRaw } : {}),
    captionRaw: Object.prototype.hasOwnProperty.call(updates, "captionRaw") ? updates.captionRaw : (win.captionRaw ?? buildWindowCaptionRaw(win.title ?? "", Boolean(win.captionVariable))),
    flagsExpr: Object.prototype.hasOwnProperty.call(updates, "flagsExpr") ? updates.flagsExpr : getWindowCurrentFlagsExpr(win),
    parentRaw: Object.prototype.hasOwnProperty.call(updates, "parentRaw") ? updates.parentRaw : (win.parentRaw ?? "")
  });
}

function postWindowProperties(win: FormWindow, updates: { hiddenRaw?: string; disabledRaw?: string; colorRaw?: string }) {
  post({
    type: WEBVIEW_TO_EXT_MSG_TYPE.setWindowProperties,
    windowKey: win.id,
    ...(Object.prototype.hasOwnProperty.call(updates, "hiddenRaw") ? { hiddenRaw: updates.hiddenRaw } : {}),
    ...(Object.prototype.hasOwnProperty.call(updates, "disabledRaw") ? { disabledRaw: updates.disabledRaw } : {}),
    ...(Object.prototype.hasOwnProperty.call(updates, "colorRaw") ? { colorRaw: updates.colorRaw } : {})
  });
}

function setInfoError(message: string): void {
  errEl.textContent = message;
  renderInfoPanel();
}

function clearInfoError(): void {
  if (!(errEl.textContent ?? "").trim().length) return;
  errEl.textContent = "";
  renderInfoPanel();
}

function ensureValidPbVariableReference(value: string): boolean {
  if (isValidPbVariableReference(value)) {
    clearInfoError();
    return true;
  }

  setInfoError(PB_WRONG_VARIABLE_NAME_MESSAGE);
  return false;
}

function postWindowPositionRaw(win: FormWindow, axis: "x" | "y", rawValue: string): void {
  const parsed = parseWindowPositionInspectorInput(rawValue);
  if (!parsed.ok) {
    setInfoError(`Window ${axis.toUpperCase()} accepts only an integer or ${WINDOW_POSITION_IGNORE_LITERAL}.`);
    return;
  }

  clearInfoError();

  if (parsed.isIgnore) {
    if (axis === "x") {
      win.xRaw = parsed.raw;
      win.x = parsed.previewValue;
      postWindowOpenArgs(win, { xRaw: parsed.raw });
    } else {
      win.yRaw = parsed.raw;
      win.y = parsed.previewValue;
      postWindowOpenArgs(win, { yRaw: parsed.raw });
    }
    markPreviewCanvasScrollContentSizeDirty();
    render();
    renderProps();
    return;
  }

  if (isActiveLayoutDpiScalingEnabled()) {
    const displayValue = parsed.previewValue;
    const nextRaw = toUnscaledLayoutRaw(displayValue);
    storeLayoutDisplayOverride("window", win.id, axis, displayValue, nextRaw);
    if (axis === "x") {
      win.xRaw = nextRaw;
      win.x = displayValue;
      postWindowOpenArgs(win, { xRaw: nextRaw });
    } else {
      win.yRaw = nextRaw;
      win.y = displayValue;
      postWindowOpenArgs(win, { yRaw: nextRaw });
    }
  } else if (axis === "x") {
    win.xRaw = parsed.raw;
    win.x = parsed.previewValue;
    postWindowOpenArgs(win, { xRaw: parsed.raw });
  } else {
    win.yRaw = parsed.raw;
    win.y = parsed.previewValue;
    postWindowOpenArgs(win, { yRaw: parsed.raw });
  }

  markPreviewCanvasScrollContentSizeDirty();
  render();
  renderProps();
}

type ImageUsage = FormImageUsage;

function getSelectionParentId(sel: DesignerSelection): string | undefined {
  if (!sel) return undefined;
  switch (sel.kind) {
    case "menu": return sel.id;
    case "menuEntry": return sel.menuId;
    case "toolbar": return sel.id;
    case "toolBarEntry": return sel.toolBarId;
    case "statusbar": return sel.id;
    case "statusBarField": return sel.statusBarId;
    default: return undefined;
  }
}

function setSelectionAndRefresh(next: DesignerSelection): void {
  selection = next;
  render();
  renderListAndParentSelector();
  renderProps();
}

function openDestructiveAction(action: PendingDestructiveAction, nextSelection?: DesignerSelection): void {
  pendingDestructiveAction = action;
  if (nextSelection) {
    setSelectionAndRefresh(nextSelection);
    return;
  }
  renderProps();
}

function closeDestructiveAction(): void {
  pendingDestructiveAction = null;
  renderProps();
}

function executeDestructiveAction(action: PendingDestructiveAction): void {
  switch (action.kind) {
    case "deleteGadget":
      post({ type: WEBVIEW_TO_EXT_MSG_TYPE.deleteGadget, id: action.gadgetId });
      return;
    case "deleteMenuEntry":
      post({
        type: WEBVIEW_TO_EXT_MSG_TYPE.deleteMenuEntry,
        menuId: action.menuId,
        sourceLine: action.sourceLine,
        kind: action.entryKind
      });
      return;
    case "deleteMenu":
      post({ type: WEBVIEW_TO_EXT_MSG_TYPE.deleteMenu, menuId: action.menuId });
      return;
    case "deleteToolBarEntry":
      post({
        type: WEBVIEW_TO_EXT_MSG_TYPE.deleteToolBarEntry,
        toolBarId: action.toolBarId,
        sourceLine: action.sourceLine,
        kind: action.entryKind
      });
      return;
    case "deleteToolBar":
      post({ type: WEBVIEW_TO_EXT_MSG_TYPE.deleteToolBar, toolBarId: action.toolBarId });
      return;
    case "deleteStatusBarField":
      post({
        type: WEBVIEW_TO_EXT_MSG_TYPE.deleteStatusBarField,
        statusBarId: action.statusBarId,
        sourceLine: action.sourceLine
      });
      return;
    case "clearStatusBarField": {
      const statusBar = (model.statusbars ?? []).find(entry => entry.id === action.statusBarId);
      const field = statusBar?.fields?.[action.fieldIndex];
      if (!statusBar || !field || typeof field.source?.line !== "number") {
        renderProps();
        return;
      }
      post({
        type: WEBVIEW_TO_EXT_MSG_TYPE.updateStatusBarField,
        statusBarId: statusBar.id,
        sourceLine: field.source.line,
        widthRaw: field.widthRaw,
        textRaw: "",
        imageRaw: "",
        flagsRaw: field.flagsRaw ?? "",
        progressBar: false,
        progressRaw: ""
      });
      return;
    }
    case "deleteStatusBar":
      post({ type: WEBVIEW_TO_EXT_MSG_TYPE.deleteStatusBar, statusBarId: action.statusBarId });
      return;
    case "deleteImage":
      post({ type: WEBVIEW_TO_EXT_MSG_TYPE.deleteImage, sourceLine: action.sourceLine });
      return;
    case "deleteGadgetItem":
      post({ type: WEBVIEW_TO_EXT_MSG_TYPE.deleteGadgetItem, id: action.gadgetId, sourceLine: action.sourceLine });
      return;
    case "deleteGadgetColumn":
      post({ type: WEBVIEW_TO_EXT_MSG_TYPE.deleteGadgetColumn, id: action.gadgetId, sourceLine: action.sourceLine });
      return;
  }
}

function confirmDestructiveAction(): void {
  const action = pendingDestructiveAction;
  if (!action) return;

  pendingDestructiveAction = null;
  executeDestructiveAction(action);
}

function renderDestructiveDialog(): void {
  destructiveDialogBackdropEl?.remove();
  destructiveDialogBackdropEl = null;

  if (!pendingDestructiveDialogAction) return;

  const backdrop = document.createElement("div");
  backdrop.className = "destructiveDialogBackdrop";
  backdrop.onclick = (event) => {
    if (event.target === backdrop) {
      closeDestructiveDialog();
    }
  };

  const dialog = document.createElement("div");
  dialog.className = "destructiveDialog";
  dialog.setAttribute("role", "alertdialog");
  dialog.setAttribute("aria-modal", "true");
  backdrop.appendChild(dialog);

  const title = document.createElement("div");
  title.className = "destructiveDialogTitle";
  title.textContent = "Confirm Delete";
  dialog.appendChild(title);

  dialog.appendChild(mutedNote(pendingDestructiveDialogAction.message));

  const actions = document.createElement("div");
  actions.className = "miniActions";

  const confirmBtn = document.createElement("button");
  confirmBtn.textContent = pendingDestructiveDialogAction.confirmLabel;
  confirmBtn.onclick = () => confirmDestructiveDialogAction();

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.onclick = () => closeDestructiveDialog();

  actions.appendChild(confirmBtn);
  actions.appendChild(cancelBtn);
  dialog.appendChild(actions);

  document.body.appendChild(backdrop);
  destructiveDialogBackdropEl = backdrop;
}

function openDestructiveDialog(action: PendingDestructiveAction, nextSelection?: DesignerSelection): void {
  pendingDestructiveDialogAction = action;
  if (nextSelection) {
    setSelectionAndRefresh(nextSelection);
  } else {
    renderProps();
  }
  renderDestructiveDialog();
}

function closeDestructiveDialog(): void {
  pendingDestructiveDialogAction = null;
  renderDestructiveDialog();
}

function confirmDestructiveDialogAction(): void {
  const action = pendingDestructiveDialogAction;
  if (!action) return;
  pendingDestructiveDialogAction = null;
  renderDestructiveDialog();
  executeDestructiveAction(action);
}

function isMenuEntrySelection(sel: DesignerSelection, menuId: string, entryIndex: number): boolean {
  return Boolean(sel && sel.kind === "menuEntry" && sel.menuId === menuId && sel.entryIndex === entryIndex);
}

function isToolBarEntrySelection(sel: DesignerSelection, toolBarId: string, entryIndex: number): boolean {
  return Boolean(sel && sel.kind === "toolBarEntry" && sel.toolBarId === toolBarId && sel.entryIndex === entryIndex);
}

function isStatusBarFieldSelection(sel: DesignerSelection, statusBarId: string, fieldIndex: number): boolean {
  return Boolean(sel && sel.kind === "statusBarField" && sel.statusBarId === statusBarId && sel.fieldIndex === fieldIndex);
}

function collectImageUsages(imageId: string): ImageUsage[] {
  return collectFormImageUsages(model, imageId);
}

function countImageUsages(imageId: string): number {
  return countFormImageUsages(model, imageId);
}

function findImageEntryById(imageId?: string): FormImage | undefined {
  return findFormImageEntryById(model.images, imageId);
}

function getCleanupSourceLineForImageReference(oldImageId: string | undefined, nextImageId: string | undefined): number | undefined {
  const oldImage = findImageEntryById(oldImageId);
  const oldUsageCount = oldImageId ? countImageUsages(oldImageId) : 0;
  return shouldCleanupStatusBarReboundImage(
    oldImageId,
    oldUsageCount,
    oldImage?.source?.line,
    nextImageId
  ) ? oldImage?.source?.line : undefined;
}

function selectImageById(imageId: string): void {
  setSelectionAndRefresh({ kind: "image", id: imageId });
}

function resolvePreviewImageSrc(entry?: FormImage): string | undefined {
  const resolved = entry?.image?.trim();
  if (!resolved?.length || entry?.inline) return undefined;
  if (/^(?:data:|https?:|vscode-webview-resource:|vscode-resource:|blob:)/i.test(resolved)) {
    return resolved;
  }
  return undefined;
}

function drawResolvedPreviewImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number
): boolean {
  if (!image || !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
    return false;
  }

  const dx = Math.round(x + (w - image.naturalWidth) / 2);
  const dy = Math.round(y + (h - image.naturalHeight) / 2);
  ctx.drawImage(image, dx, dy);
  return true;
}



function canRelativizeImageEntry(entry?: FormImage): boolean {
  return canRelativizeFormImageEntry(entry);
}

function canChooseFileImageEntry(entry?: FormImage): boolean {
  return canChooseFileForFormImageEntry(entry);
}

function canToggleImagePbAny(entry?: FormImage): boolean {
  return canToggleFormImagePbAny(entry);
}

function getImageReferenceHint(imageId?: string, label: "gadget" | "menu" | "toolbar" | "statusbar" = "gadget"): string {
  return getCoreFormImageReferenceHint(model.images, imageId, label);
}

function getDefaultImageReferenceSelection(currentImageId?: string): string {
  return getDefaultFormImageReferenceSelection(model.images, currentImageId);
}

function buildCreatedImageReference(idRaw: string, assignedVar?: string): { imageId: string; imageRaw: string } | undefined {
  return buildCreatedFormImageReference(idRaw, assignedVar);
}

function toPbString(v: string): string {
  return quotePbString(v ?? "");
}

function postCreateMenuRoot(): void {
  const args = { kind: "MenuTitle" as FormMenuEntry["kind"], textRaw: toPbString("MenuTitle") };
  pendingMenuEntrySelection = buildPendingMenuRootSelection(args);
  vscode.postMessage({
    type: WEBVIEW_TO_EXT_MSG_TYPE.createMenu,
    kind: args.kind,
    textRaw: args.textRaw,
  });
}

function postCreateToolBarRoot(action: ToolBarPreviewInsertAction): void {
  const args = getToolBarPreviewInsertArgs({ entries: [] }, action);
  pendingToolBarEntrySelection = buildPendingToolBarRootSelection(args);
  vscode.postMessage({
    type: WEBVIEW_TO_EXT_MSG_TYPE.createToolBar,
    kind: args.kind,
    idRaw: args.idRaw,
    iconRaw: args.iconRaw,
    toggle: args.toggle,
  });
}

function postCreateStatusBarRoot(action: StatusBarPreviewInsertAction): void {
  const args = getStatusBarPreviewInsertArgs(action);
  pendingStatusBarFieldSelection = buildPendingStatusBarRootSelection(args);
  vscode.postMessage({
    type: WEBVIEW_TO_EXT_MSG_TYPE.createStatusBar,
    widthRaw: args.widthRaw,
    textRaw: args.textRaw,
    imageRaw: args.imageRaw,
    flagsRaw: args.flagsRaw,
    progressBar: args.progressBar,
    progressRaw: args.progressRaw,
  });
}

function postInsertMenuEntry(menu: FormMenu, args: { kind: FormMenuEntry["kind"]; idRaw?: string; textRaw?: string }, parentSourceLine?: number): void {
  pendingMenuEntrySelection = buildPendingMenuEntryInsertSelection(menu, args, parentSourceLine);
  vscode.postMessage({
    type: WEBVIEW_TO_EXT_MSG_TYPE.insertMenuEntry,
    menuId: menu.id,
    kind: args.kind,
    idRaw: args.idRaw,
    textRaw: args.textRaw,
    parentSourceLine
  });
}

function postInsertToolBarEntry(toolBar: FormToolBar, args: { kind: FormToolBarEntry["kind"]; idRaw?: string; iconRaw?: string; textRaw?: string; toggle?: boolean }): void {
  pendingToolBarEntrySelection = buildPendingToolBarEntryInsertSelection(toolBar, args);
  vscode.postMessage({
    type: WEBVIEW_TO_EXT_MSG_TYPE.insertToolBarEntry,
    toolBarId: toolBar.id,
    kind: args.kind,
    idRaw: args.idRaw,
    iconRaw: args.iconRaw,
    textRaw: args.textRaw,
  });
}

function postInsertStatusBarField(statusBar: FormStatusBar, args: { widthRaw: string; textRaw?: string; imageRaw?: string; flagsRaw?: string; progressBar?: boolean; progressRaw?: string }): void {
  pendingStatusBarFieldSelection = buildPendingStatusBarFieldInsertSelection(statusBar, args);
  vscode.postMessage({
    type: WEBVIEW_TO_EXT_MSG_TYPE.insertStatusBarField,
    statusBarId: statusBar.id,
    widthRaw: args.widthRaw,
    textRaw: args.textRaw,
    imageRaw: args.imageRaw,
    flagsRaw: args.flagsRaw,
    progressBar: args.progressBar,
    progressRaw: args.progressRaw,
  });
}

function getPredictedInsertedGadgetId(kind: string): string | undefined {
  if (!isInsertableGadgetKind(kind)) return undefined;
  const pbAny = shouldInsertGadgetAsPbAny(model.gadgets, settings.newGadgetsUsePbAnyByDefault);
  return buildInsertedGadgetIdentity(kind, model.gadgets, pbAny).id;
}

function getGadgetDeletePlan(gadget: Gadget | undefined) {
  if (!gadget) return undefined;
  return buildOriginalGadgetDeletePlan(model.gadgets, gadget.id);
}

function getGadgetDeleteBlockedReason(gadget: Gadget | undefined): string | undefined {
  if (!gadget) return "The selected gadget could not be resolved.";
  if (typeof gadget.source?.line !== "number") {
    return "Only parsed gadgets with a source line can be deleted.";
  }

  const deletePlan = getGadgetDeletePlan(gadget);
  if (!deletePlan) return "The selected gadget could not be resolved.";
  if (!deletePlan.deletedIds.size) {
    return "This gadget remains attached to a surviving SplitterGadget in the original delete logic. Delete the splitter instead.";
  }

  return undefined;
}

function buildGadgetDeleteAction(gadget: Gadget | undefined): PendingDestructiveAction | undefined {
  const blockedReason = getGadgetDeleteBlockedReason(gadget);
  if (!gadget || blockedReason) return undefined;

  const deletePlan = getGadgetDeletePlan(gadget);
  if (!deletePlan || !deletePlan.deletedIds.size) return undefined;

  const rootDeleted = deletePlan.deletedIds.has(gadget.id);
  const deletedChildCount = rootDeleted
    ? Math.max(0, deletePlan.deletedIds.size - 1)
    : deletePlan.deletedIds.size;

  let message: string;
  if (!rootDeleted) {
    message = deletedChildCount === 1
      ? `Delete 1 child gadget under '${gadget.id}'? The selected gadget itself remains attached to its SplitterGadget.`
      : `Delete ${deletedChildCount} child gadgets under '${gadget.id}'? The selected gadget itself remains attached to its SplitterGadget.`;
  }
  else if (deletedChildCount > 0) {
    message = `Delete gadget '${gadget.id}' and its ${deletedChildCount} child gadget${deletedChildCount === 1 ? "" : "s"}?`;
  }
  else {
    message = `Delete gadget '${gadget.id}'?`;
  }

  return {
    kind: "deleteGadget",
    gadgetId: gadget.id,
    message,
    confirmLabel: rootDeleted ? "Delete Gadget" : "Delete Child Gadgets"
  };
}

function buildTopLevelWindowGadgetYRaw(unscaledY: number, parentId?: string): string {
  const baseRaw = String(Math.trunc(unscaledY));
  if (parentId) return baseRaw;
  if (resolvePbFormSkinPlatform() !== "windows") return baseRaw;
  const toolbarCount = model.toolbars?.length ?? 0;
  if (toolbarCount <= 0) return baseRaw;
  return `ToolBarHeight(${toolbarCount - 1}) + ${baseRaw}`;
}

function postInsertGadget(kind: string, x: number, y: number, parentId?: string, parentItem?: number): void {
  if (!isInsertableGadgetKind(kind)) return;
  const predictedId = getPredictedInsertedGadgetId(kind);
  const committed = commitDisplayedLayoutPoint(x, y, getActiveLayoutDpiScale());
  const yRaw = buildTopLevelWindowGadgetYRaw(committed.yUnscaled, parentId);
  if (predictedId) {
    pendingGadgetSelection = { id: predictedId };
    storeLayoutDisplayOverride("gadget", predictedId, "x", committed.x, committed.xRaw);
    storeLayoutDisplayOverride("gadget", predictedId, "y", committed.y, yRaw);
  }
  post({
    type: WEBVIEW_TO_EXT_MSG_TYPE.insertGadget,
    kind,
    x: committed.xUnscaled,
    y: committed.yUnscaled,
    yRaw,
    parentId,
    parentItem,
    gadget1Id: pendingSplitterInsertConfig?.gadget1Id,
    gadget2Id: pendingSplitterInsertConfig?.gadget2Id,
  });
}

function setPendingInsertGadgetKind(kind: string | null): void {
  pendingInsertGadgetKind = kind && isInsertableGadgetKind(kind) ? kind : null;
  closeCanvasContextMenu();
  if (!pendingInsertGadgetKind) {
    pendingSplitterInsertConfig = null;
    canvas.style.cursor = drag ? canvas.style.cursor : "default";
  }
  if (pendingInsertGadgetKind !== GADGET_KIND.SplitterGadget) {
    pendingSplitterInsertConfig = null;
  }
  if (pendingInsertGadgetKind) {
    errEl.textContent = "";
  }
  renderInsertGadgetControls();
  renderInfoPanel();
}

function getSplitterInsertCandidateLabel(gadget: Gadget): string {
  return gadget.id;
}

function openSplitterInsertDialog(): void {
  closeSplitterInsertDialog();

  const candidates = model.gadgets.filter(gadget => !gadget.splitterId);
  const backdrop = document.createElement("div");
  backdrop.className = "destructiveDialogBackdrop";
  backdrop.onclick = (event) => {
    if (event.target === backdrop) closeSplitterInsertDialog();
  };

  const dialog = document.createElement("div");
  dialog.className = "destructiveDialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  backdrop.appendChild(dialog);

  const title = document.createElement("div");
  title.className = "destructiveDialogTitle";
  title.textContent = "Create Splitter";
  dialog.appendChild(title);

  dialog.appendChild(mutedNote("Choose two existing gadgets that are not already owned by another splitter. Both gadgets must currently belong to the same parent or panel tab."));

  const validationEl = document.createElement("div");
  validationEl.className = "muted";
  validationEl.style.color = "var(--vscode-errorForeground)";

  const createSelect = () => {
    const sel = document.createElement("select");
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Select gadget...";
    sel.appendChild(empty);
    for (const gadget of candidates) {
      const option = document.createElement("option");
      option.value = gadget.id;
      option.textContent = getSplitterInsertCandidateLabel(gadget);
      sel.appendChild(option);
    }
    return sel;
  };

  const firstSel = createSelect();
  const secondSel = createSelect();

  const selectedGadgetId = selection && selection.kind === "gadget" ? selection.id : undefined;
  const selectedGadget = selectedGadgetId ? model.gadgets.find(gadget => gadget.id === selectedGadgetId && !gadget.splitterId) : undefined;
  if (selectedGadget) {
    firstSel.value = selectedGadget.id;
  }

  dialog.appendChild(row("First Gadget", firstSel));
  dialog.appendChild(row("Second Gadget", secondSel));
  dialog.appendChild(validationEl);

  const actions = document.createElement("div");
  actions.className = "row-actions";
  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.onclick = () => closeSplitterInsertDialog();
  const okBtn = document.createElement("button");
  okBtn.textContent = "Continue";
  okBtn.onclick = () => {
    const gadget1 = model.gadgets.find(gadget => gadget.id === firstSel.value);
    const gadget2 = model.gadgets.find(gadget => gadget.id === secondSel.value);
    if (!gadget1 || !gadget2 || gadget1.id === gadget2.id) {
      validationEl.textContent = "Select two different gadgets.";
      return;
    }
    if (gadget1.splitterId || gadget2.splitterId) {
      validationEl.textContent = "Only gadgets that are not already assigned to a splitter are currently allowed here.";
      return;
    }
    if (gadget1.parentId !== gadget2.parentId || gadget1.parentItem !== gadget2.parentItem) {
      validationEl.textContent = "Both gadgets must currently belong to the same parent and panel tab.";
      return;
    }
    pendingSplitterInsertConfig = {
      gadget1Id: gadget1.id,
      gadget2Id: gadget2.id,
    };
    closeSplitterInsertDialog();
    setPendingInsertGadgetKind(GADGET_KIND.SplitterGadget);
  };
  actions.appendChild(cancelBtn);
  actions.appendChild(okBtn);
  dialog.appendChild(actions);

  document.body.appendChild(backdrop);
  splitterInsertDialogBackdropEl = backdrop;
};

function closeSplitterInsertDialog(): void {
  splitterInsertDialogBackdropEl?.remove();
  splitterInsertDialogBackdropEl = null;
}

function closeSelectParentDialog(): void {
  selectParentDialogBackdropEl?.remove();
  selectParentDialogBackdropEl = null;
}

function openSelectParentDialog(gadget: Gadget): void {
  if (!canOpenGadgetReparentDialog(gadget)) return;

  closeSelectParentDialog();

  const options = getGadgetReparentParentOptions(model.window, model.gadgets, gadget.id);
  const backdrop = document.createElement("div");
  backdrop.className = "destructiveDialogBackdrop";
  backdrop.onclick = (event) => {
    if (event.target === backdrop) closeSelectParentDialog();
  };

  const dialog = document.createElement("div");
  dialog.className = "destructiveDialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  backdrop.appendChild(dialog);

  const title = document.createElement("div");
  title.className = "destructiveDialogTitle";
  title.textContent = `Change Parent — ${gadget.id}`;
  dialog.appendChild(title);
  dialog.appendChild(mutedNote(gadget.kind === GADGET_KIND.SplitterGadget
    ? "This Select Parent flow follows the original splitter special case: gadget1 and gadget2 are moved together with the splitter into the selected parent block, and the splitter itself resets to X/Y = 0,0."
    : "This Select Parent flow follows the original path for normal gadgets. The moved gadget is inserted into the selected parent block and its X/Y position resets to 0,0."));

  const validationEl = document.createElement("div");
  validationEl.className = "muted";
  validationEl.style.color = "var(--vscode-errorForeground)";

  const parentSelect = document.createElement("select");
  const itemSelect = document.createElement("select");
  const currentValue = gadget.parentId ? `gadget:${gadget.parentId}` : "window";

  const renderItemOptions = () => {
    const selectedOption = options.find(option => option.value === parentSelect.value) ?? options[0];
    itemSelect.innerHTML = "";
    const itemLabels = selectedOption?.itemLabels ?? [];

    if (!itemLabels.length) {
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "(none)";
      itemSelect.appendChild(empty);
      itemSelect.disabled = true;
      itemSelect.value = "";
      return;
    }

    itemSelect.disabled = false;
    for (let index = 0; index < itemLabels.length; index += 1) {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = itemLabels[index] || `Item ${index + 1}`;
      itemSelect.appendChild(option);
    }

    const currentItem = selectedOption?.parentId === gadget.parentId && typeof gadget.parentItem === "number"
      ? Math.max(0, Math.min(gadget.parentItem, itemLabels.length - 1))
      : 0;
    itemSelect.value = String(currentItem);
  };

  for (const optionInfo of options) {
    const option = document.createElement("option");
    option.value = optionInfo.value;
    option.textContent = optionInfo.label;
    parentSelect.appendChild(option);
  }

  parentSelect.value = options.some(option => option.value === currentValue) ? currentValue : "window";
  parentSelect.onchange = () => {
    validationEl.textContent = "";
    renderItemOptions();
  };
  renderItemOptions();

  dialog.appendChild(row("Parent", parentSelect));
  dialog.appendChild(row("Parent Item", itemSelect));
  dialog.appendChild(validationEl);

  const actions = document.createElement("div");
  actions.className = "row-actions";
  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.onclick = () => closeSelectParentDialog();
  const okBtn = document.createElement("button");
  okBtn.textContent = "OK";
  okBtn.onclick = () => {
    const selectedOption = options.find(option => option.value === parentSelect.value);
    if (!selectedOption) {
      validationEl.textContent = "Select a valid parent.";
      return;
    }

    const nextParentId = selectedOption.parentId;
    const nextParentItem = selectedOption.itemLabels.length && !itemSelect.disabled
      ? Number.parseInt(itemSelect.value || "0", 10)
      : undefined;

    post({
      type: WEBVIEW_TO_EXT_MSG_TYPE.reparentGadget,
      id: gadget.id,
      parentId: nextParentId,
      parentItem: Number.isFinite(nextParentItem) ? nextParentItem : undefined,
    });
    closeSelectParentDialog();
  };
  actions.appendChild(cancelBtn);
  actions.appendChild(okBtn);
  dialog.appendChild(actions);

  document.body.appendChild(backdrop);
  selectParentDialogBackdropEl = backdrop;
}

function requestInsertGadgetPlacement(kind: string): void {
  if (!isInsertableGadgetKind(kind)) return;
  if (kind === GADGET_KIND.SplitterGadget) {
    openSplitterInsertDialog();
    return;
  }
  setPendingInsertGadgetKind(kind);
}

function requestImmediateToolboxInsert(kind: string): void {
  if (!isInsertableGadgetKind(kind)) return;
  if (!canImmediateInsertFromToolbox(kind)) return;

  const point = getImmediateToolboxInsertPosition();
  if (pendingInsertGadgetKind) {
    setPendingInsertGadgetKind(null);
  }
  postInsertGadget(kind, point.x, point.y);
}

function getSelectedToolboxKind(): InsertableGadgetKind {
  if (pendingInsertGadgetKind && isInsertableGadgetKind(pendingInsertGadgetKind)) {
    return pendingInsertGadgetKind;
  }

  if (!isInsertableGadgetKind(selectedToolboxKind)) {
    selectedToolboxKind = getDefaultToolboxPanelKind();
  }

  return selectedToolboxKind;
}

function renderTopPanelTabs(): void {
  if (!toolboxTabButtonEl || !objectsTabButtonEl || !toolboxTabPanelEl || !objectsTabPanelEl) return;

  const toolboxActive = activeTopPanelTab === "toolbox";
  toolboxTabButtonEl.classList.toggle("active", toolboxActive);
  toolboxTabButtonEl.setAttribute("aria-selected", toolboxActive ? "true" : "false");
  objectsTabButtonEl.classList.toggle("active", !toolboxActive);
  objectsTabButtonEl.setAttribute("aria-selected", toolboxActive ? "false" : "true");
  toolboxTabPanelEl.hidden = !toolboxActive;
  objectsTabPanelEl.hidden = toolboxActive;
}

function renderInsertGadgetControls(): void {
  if (!toolboxListEl || !cancelInsertGadgetButtonEl) return;

  const selectedKind = getSelectedToolboxKind();
  toolboxListEl.innerHTML = "";

  for (const category of getToolboxPanelCategories()) {
    const categoryEl = document.createElement("div");
    categoryEl.className = "toolboxCategory";

    const titleEl = document.createElement("div");
    titleEl.className = "toolboxCategoryTitle";
    titleEl.textContent = category.title;
    categoryEl.appendChild(titleEl);

    for (const entry of category.items) {
      const itemEl = document.createElement("div");
      const isSelected = entry.kind === selectedKind;
      itemEl.className = `toolboxItem${isSelected ? " selected" : ""}${entry.enabled ? "" : " disabled"}${pendingInsertGadgetKind && entry.kind === selectedKind ? " pending" : ""}`;
      if (entry.enabled && entry.kind) {
        itemEl.setAttribute("role", "button");
        itemEl.tabIndex = 0;
      }

      const iconEl = document.createElement("div");
      iconEl.className = "toolboxIcon";
      const iconUri = entry.iconAsset ? TOOLBOX_ICON_URIS[entry.iconAsset] : undefined;
      if (iconUri) {
        const iconImgEl = document.createElement("img");
        iconImgEl.src = iconUri;
        iconImgEl.alt = "";
        iconEl.appendChild(iconImgEl);
      } else {
        iconEl.textContent = entry.iconText;
      }

      const labelEl = document.createElement("div");
      labelEl.textContent = entry.label;

      itemEl.appendChild(iconEl);
      itemEl.appendChild(labelEl);

      const activate = () => {
        if (!entry.enabled || !entry.kind) return;
        selectedToolboxKind = entry.kind;
        renderInsertGadgetControls();
        requestInsertGadgetPlacement(entry.kind);
      };

      const immediateInsert = () => {
        if (!entry.enabled || !entry.kind) return;
        selectedToolboxKind = entry.kind;
        renderInsertGadgetControls();
        requestImmediateToolboxInsert(entry.kind);
      };

      if (entry.enabled && entry.kind) {
        itemEl.title = entry.kind === GADGET_KIND.SplitterGadget
          ? "Click to choose the two splitter gadgets, then place the splitter in the canvas."
          : "Click to place this gadget in the canvas. Double-click inserts it immediately at the default position.";
      }

      itemEl.onclick = () => activate();
      itemEl.ondblclick = event => {
        event.preventDefault();
        immediateInsert();
      };
      itemEl.onkeydown = event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        activate();
      };

      categoryEl.appendChild(itemEl);
    }

    toolboxListEl.appendChild(categoryEl);
  }

  cancelInsertGadgetButtonEl.style.display = pendingInsertGadgetKind ? "block" : "none";
  cancelInsertGadgetButtonEl.onclick = () => setPendingInsertGadgetKind(null);
}

type Handle = ResizeHandle;

const HANDLE_SIZE = 6;
const HANDLE_HIT = 10;

const MIN_GADGET_W = 8;
const MIN_GADGET_H = 8;

// Keep this permissive; PB allows small windows, but avoid 0/negative sizes.
const MIN_WIN_W = 40;
const MIN_WIN_H = 40;

type RectLike = { x: number; y: number; w: number; h: number };

function renderListAndParentSelector() {
  renderList();
  renderParentSelector();
  renderInsertGadgetControls();
  renderTopPanelTabs();
}

function renderSelectionUiWithParentSelector() {
  render();
  renderList();
  renderParentSelector();
  renderTopPanelTabs();
  renderProps();
}

function renderSelectionUiWithoutParentSelector() {
  render();
  renderList();
  renderTopPanelTabs();
  renderProps();
}

function renderAfterInit() {
  render();
  renderParentSelector();
  renderList();
  renderInsertGadgetControls();
  renderTopPanelTabs();
  renderProps();
}

function resolvePendingMenuEntrySelection() {
  const pending = pendingMenuEntrySelection;
  if (!pending) return;

  const menu = (model.menus ?? []).find(entry => entry.id === pending.menuId);
  pendingMenuEntrySelection = null;
  const matchIndex = resolvePendingMenuEntrySelectionIndex(menu, pending);
  if (typeof matchIndex === "number") {
    selection = { kind: "menuEntry", menuId: pending.menuId, entryIndex: matchIndex };
  }
}

function resolvePendingToolBarEntrySelection() {
  const pending = pendingToolBarEntrySelection;
  if (!pending) return;

  const toolBar = (model.toolbars ?? []).find(entry => entry.id === pending.toolBarId);
  pendingToolBarEntrySelection = null;
  const matchIndex = resolvePendingToolBarEntrySelectionIndex(toolBar, pending);
  if (typeof matchIndex === "number") {
    selection = { kind: "toolBarEntry", toolBarId: pending.toolBarId, entryIndex: matchIndex };
  }
}

function resolvePendingStatusBarFieldSelection() {
  const pending = pendingStatusBarFieldSelection;
  if (!pending) return;

  const statusBar = (model.statusbars ?? []).find(entry => entry.id === pending.statusBarId);
  pendingStatusBarFieldSelection = null;
  const matchIndex = resolvePendingStatusBarFieldSelectionIndex(statusBar, pending);
  if (typeof matchIndex === "number") {
    selection = { kind: "statusBarField", statusBarId: pending.statusBarId, fieldIndex: matchIndex };
  }
}

function resolvePendingGadgetSelection() {
  const pending = pendingGadgetSelection;
  if (!pending) return;
  pendingGadgetSelection = null;
  const gadget = model.gadgets.find(entry => entry.id === pending.id);
  if (gadget) {
    selection = { kind: "gadget", id: gadget.id };
  }
}

function sanitizeSelectionAfterModelUpdate() {
  const retainedPanelItems = retainPanelActiveItems(panelActiveItems, model.gadgets);
  panelActiveItems.clear();
  retainedPanelItems.forEach((item, panelId) => panelActiveItems.set(panelId, item));

  const sel = selection;
  if (sel && sel.kind === "gadget") {
    const selId = sel.id;
    if (!model.gadgets.some(g => g.id === selId)) {
      selection = null;
    }
    return;
  }

  if (sel && sel.kind === "window") {
    if (!model.window) selection = null;
    return;
  }

  if (sel && sel.kind === "menu") {
    const menus = model.menus ?? [];
    if (!menus.some(m => m.id === sel.id)) selection = null;
    return;
  }

  if (sel && sel.kind === "menuEntry") {
    const menu = (model.menus ?? []).find(m => m.id === sel.menuId);
    if (!menu || sel.entryIndex < 0 || sel.entryIndex >= (menu.entries?.length ?? 0)) selection = null;
    return;
  }

  if (sel && sel.kind === "toolbar") {
    const toolbars = model.toolbars ?? [];
    if (!toolbars.some(t => t.id === sel.id)) selection = null;
    return;
  }

  if (sel && sel.kind === "toolBarEntry") {
    const toolBar = (model.toolbars ?? []).find(t => t.id === sel.toolBarId);
    if (!toolBar || sel.entryIndex < 0 || sel.entryIndex >= (toolBar.entries?.length ?? 0)) selection = null;
    return;
  }

  if (sel && sel.kind === "statusbar") {
    const statusbars = model.statusbars ?? [];
    if (!statusbars.some(sb => sb.id === sel.id)) selection = null;
    return;
  }

  if (sel && sel.kind === "statusBarField") {
    const statusBar = (model.statusbars ?? []).find(sb => sb.id === sel.statusBarId);
    if (!statusBar || sel.fieldIndex < 0 || sel.fieldIndex >= (statusBar.fields?.length ?? 0)) selection = null;
    return;
  }

  if (sel && sel.kind === "images") {
    if (!model.window) selection = null;
    return;
  }
}

function normalizeRectInPlace(r: RectLike, minW: number, minH: number) {
  const c = clampRect(r, minW, minH);
  r.x = c.x;
  r.y = c.y;
  r.w = c.w;
  r.h = c.h;
}

function shouldSnapLive(): boolean {
  return settings.snapToGrid && settings.snapMode === "live";
}

function shouldSnapDrop(): boolean {
  return settings.snapToGrid && settings.snapMode === SNAP_MODE_KEY.drop;
}

function applyLiveSnapPoint(x: number, y: number): { x: number; y: number } {
  if (!shouldSnapLive()) return { x, y };
  const gs = settings.gridSize;
  return { x: snapValue(x, gs), y: snapValue(y, gs) };
}

function applyLiveSnapRect(
  x: number,
  y: number,
  w: number,
  h: number,
  minW: number,
  minH: number
): { x: number; y: number; w: number; h: number } {
  if (!shouldSnapLive()) return { x, y, w, h };
  const gs = settings.gridSize;
  const nx = snapValue(x, gs);
  const ny = snapValue(y, gs);
  const nw = snapValue(w, gs);
  const nh = snapValue(h, gs);
  return clampRect({ x: nx, y: ny, w: nw, h: nh }, minW, minH);
}

function applyDropSnapRectInPlace(r: RectLike, minW: number, minH: number) {
  if (!shouldSnapDrop()) return;

  const gs = settings.gridSize;
  r.x = snapValue(r.x, gs);
  r.y = snapValue(r.y, gs);
  r.w = snapValue(r.w, gs);
  r.h = snapValue(r.h, gs);

  const c = clampRect(r, minW, minH);
  r.x = c.x;
  r.y = c.y;
  r.w = c.w;
  r.h = c.h;
}

type DragState =
  | { target: "gadget"; mode: "move"; id: string; startMx: number; startMy: number; startX: number; startY: number; startW: number; startH: number }
  | {
      target: "menuEntry";
      menuId: string;
      entryIndex: number;
      sourceLine: number;
      kind: string;
      startMx: number;
      startMy: number;
      moved: boolean;
      moveTarget: MenuEntryMoveTargetLike | null;
      selectedEntryIndexAtDragStart?: number;
    }
  | {
      target: "toolBarEntry";
      toolBarId: string;
      entryIndex: number;
      sourceLine: number;
      kind: string;
      startMx: number;
      startMy: number;
      moved: boolean;
      moveTarget: LinearTopLevelEntryMoveTargetLike | null;
    }
  | {
      target: "statusBarField";
      statusBarId: string;
      fieldIndex: number;
      sourceLine: number;
      startMx: number;
      startMy: number;
      moved: boolean;
      moveTarget: LinearTopLevelEntryMoveTargetLike | null;
    }
  | {
      target: "scrollArea";
      axis: "x" | "y";
      id: string;
      startMx: number;
      startMy: number;
      startOffset: number;
      maxOffset: number;
      trackLength: number;
    }
  | {
      target: "gadget";
      mode: "resize";
      id: string;
      handle: Handle;
      startMx: number;
      startMy: number;
      startX: number;
      startY: number;
      startW: number;
      startH: number;
    }
  | {
      target: "window";
      mode: "resize";
      handle: Handle;
      startMx: number;
      startMy: number;
      startX: number;
      startY: number;
      startW: number;
      startH: number;
    };

let drag: DragState | null = null;

function applySettings(s: DesignerSettings) {
  if (s.osSkin !== settings.osSkin) {
    clearSystemColorCache();
  }
  settings = s;
  previewChromeMetrics = resolvePreviewChromeMetricsForOsSkin(settings.osSkin);

  const bg = (settings.canvasBackground ?? "").trim();
  const bgReadonly = (settings.canvasReadonlyBackground ?? "").trim();
  document.documentElement.style.setProperty(
    "--pbfd-canvas-bg",
    bg.length ? bg : "var(--vscode-editor-background)"
  );

  document.documentElement.style.setProperty(
    "--pbfd-readonly-bg",
    bgReadonly.length ? bgReadonly : "var(--vscode-readonly-input-background)"
  );

  markPreviewCanvasScrollContentSizeDirty();
  render();
  renderProps();
}

type PreviewCanvasCachedSize = { width: number; height: number };

let previewCanvasViewportSizeCache: PreviewCanvasCachedSize | null = null;
let previewCanvasScrollContentSizeCache: PreviewCanvasCachedSize | null = null;
let previewCanvasCssSizeCache: PreviewCanvasCachedSize | null = null;
let previewCanvasViewportSizeDirty = true;
let previewCanvasScrollContentSizeDirty = true;
let previewCanvasElementSizeDirty = true;

function markPreviewCanvasViewportSizeDirty(): void {
  previewCanvasViewportSizeDirty = true;
  previewCanvasScrollContentSizeDirty = true;
  previewCanvasElementSizeDirty = true;
}

function markPreviewCanvasScrollContentSizeDirty(): void {
  previewCanvasScrollContentSizeDirty = true;
  previewCanvasElementSizeDirty = true;
}

function getPreviewCanvasViewportSize(): PreviewCanvasCachedSize {
  const rect = canvasWrap.getBoundingClientRect();
  return {
    width: Math.max(1, Math.floor(rect.width)),
    height: Math.max(1, Math.floor(rect.height)),
  };
}

function getPreviewCanvasScrollContentSize(viewport: PreviewCanvasCachedSize): PreviewCanvasCachedSize {
  const win = model.window;
  if (!win) {
    return viewport;
  }

  const platformSkin = resolvePbFormSkinPlatform();
  const originalContent = getWindowPreviewScrollContentSize({
    platformSkin,
    flagsExpr: win.flagsExpr,
    clientWidth: win.w,
    clientHeight: win.h,
    titleBarHeight: previewChromeMetrics.titleBarHeight,
    captionlessTopPadding: asInt(settings.windowPreviewWindowsCaptionlessTopPadding),
    menuHeight: previewChromeMetrics.menuHeight,
    hasMenu: hasParsedMenuChrome(),
    hasToolbar: hasParsedToolbarChrome(),
  });

  return {
    width: originalContent.width + Math.max(0, asInt(win.x ?? 0)),
    height: originalContent.height + Math.max(0, asInt(win.y ?? 0)),
  };
}

function getCachedPreviewCanvasViewportSize(): PreviewCanvasCachedSize {
  if (previewCanvasViewportSizeDirty || !previewCanvasViewportSizeCache) {
    previewCanvasViewportSizeCache = getPreviewCanvasViewportSize();
    previewCanvasViewportSizeDirty = false;
  }
  return previewCanvasViewportSizeCache;
}

function getCachedPreviewCanvasScrollContentSize(viewport: PreviewCanvasCachedSize): PreviewCanvasCachedSize {
  if (previewCanvasScrollContentSizeDirty || !previewCanvasScrollContentSizeCache) {
    previewCanvasScrollContentSizeCache = getPreviewCanvasScrollContentSize(viewport);
    previewCanvasScrollContentSizeDirty = false;
  }
  return previewCanvasScrollContentSizeCache;
}

function syncPreviewCanvasElementSizeIfNeeded(): PreviewCanvasCachedSize {
  if (!previewCanvasElementSizeDirty && previewCanvasCssSizeCache) {
    return previewCanvasCssSizeCache;
  }

  const viewport = getCachedPreviewCanvasViewportSize();
  const content = getCachedPreviewCanvasScrollContentSize(viewport);
  const scrollbarWidth = getWindowPreviewFormScrollbarWidth(resolvePbFormSkinPlatform());
  const cssSize = getWindowPreviewCanvasCssSize({
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    scrollContentWidth: content.width,
    scrollContentHeight: content.height,
    scrollbarWidth,
  });

  const widthCss = `${cssSize.width}px`;
  const heightCss = `${cssSize.height}px`;
  if (canvas.style.width !== widthCss) {
    canvas.style.width = widthCss;
  }
  if (canvas.style.height !== heightCss) {
    canvas.style.height = heightCss;
  }

  previewCanvasCssSizeCache = cssSize;
  previewCanvasElementSizeDirty = false;
  return cssSize;
}

function ensureCanvasBitmapSizeForRender(): PreviewCanvasCachedSize {
  if (ensureLayoutScaleState()) {
    markPreviewCanvasScrollContentSizeDirty();
  }

  const cssSize = syncPreviewCanvasElementSizeIfNeeded();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(cssSize.width * dpr));
  const height = Math.max(1, Math.floor(cssSize.height * dpr));
  if (canvas.width !== width) {
    canvas.width = width;
  }
  if (canvas.height !== height) {
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return cssSize;
}

function resizeCanvas() {
  markPreviewCanvasViewportSizeDirty();
  render();
}

window.addEventListener("mousedown", event => {
  if (!canvasContextMenuEl) return;
  if (canvasContextMenuIgnoreMouseDownTimeStamp === event.timeStamp) {
    canvasContextMenuIgnoreMouseDownTimeStamp = null;
    return;
  }
  const target = event.target;
  if (target instanceof Node && canvasContextMenuEl.contains(target)) return;
  closeCanvasContextMenu();
});

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  if (pendingDestructiveDialogAction) {
    closeDestructiveDialog();
    return;
  }
  if (splitterInsertDialogBackdropEl) {
    closeSplitterInsertDialog();
    return;
  }
  if (pendingInsertGadgetKind) {
    setPendingInsertGadgetKind(null);
    return;
  }
  closeCanvasContextMenu();
});

window.addEventListener("resize", resizeCanvas);

window.addEventListener("message", (ev: MessageEvent<ExtensionToWebviewMessage<Model>>) => {
  const msg = ev.data;

  if (msg.type === EXT_TO_WEBVIEW_MSG_TYPE.init) {
    errEl.textContent = "";
    ensureLayoutScaleState();
    model = msg.model;
    syncModelDisplayLayout(model);
    markPreviewCanvasScrollContentSizeDirty();
    windowParentAsRawExpressionOverrides.clear();
    const retainedPanelItems = retainPanelActiveItems(panelActiveItems, model.gadgets);
    panelActiveItems.clear();
    retainedPanelItems.forEach((item, panelId) => panelActiveItems.set(panelId, item));
    scrollAreaOffsets.clear();

    if (msg.settings) {
      applySettings(msg.settings);
    }
    resolvePendingMenuEntrySelection();
    resolvePendingToolBarEntrySelection();
    resolvePendingStatusBarFieldSelection();
    resolvePendingGadgetSelection();
    // Validate selection after model refresh
    sanitizeSelectionAfterModelUpdate();

    renderAfterInit();
    return;
  }

  if (msg.type === EXT_TO_WEBVIEW_MSG_TYPE.settings) {
    ensureLayoutScaleState();
    applySettings(msg.settings);
    return;
  }

  if (msg.type === EXT_TO_WEBVIEW_MSG_TYPE.error) {
    errEl.textContent = msg.message;
    renderInfoPanel();
  }

  if (msg.type === EXT_TO_WEBVIEW_MSG_TYPE.windowsSystemColors) {
    windowsRegistryColors = msg.colors;
    render();
  }

  if (msg.type === EXT_TO_WEBVIEW_MSG_TYPE.procedureNames) {
    // Async procedure discovery completed: update names and re-render the
    // inspector (procedure dropdowns) without disturbing any other UI state.
    if (model) {
      model.procedureNames = msg.names;
      renderInfoPanel();
    }
  }
});

function renderDiagnostics() {
  const issues = model.meta?.issues ?? [];
  const header = model.meta?.header;

  if ((!issues || issues.length === 0) && !header?.version) {
    diagEl.style.display = "none";
    diagEl.innerHTML = "";
    return;
  }

  const rows: string[] = [];
  if (header?.version) {
    rows.push(
      `<div class="row"><div class="sev info">ℹ</div><div class="msg">PureBasic header version: <b>${escapeHtml(
        header.version
      )}</b></div></div>`
    );
  }

  for (const it of issues) {
    const sev = it.severity;
    const icon = sev === "error" ? "⛔" : sev === "warning" ? "⚠" : "ℹ";
    const line = typeof it.line === "number" ? ` (line ${it.line + 1})` : "";
    rows.push(
      `<div class="row"><div class="sev ${sev === "warning" ? "warn" : sev === "error" ? "err" : "info"}">${icon}</div><div class="msg">${escapeHtml(
        it.message
      )}${escapeHtml(line)}</div></div>`
    );
  }

  diagEl.innerHTML = rows.join("\n");
  diagEl.style.display = "block";
}

function getSelectionSummary(): string {
  const sel = selection;
  if (!sel) return "No selection";

  if (sel.kind === "window") {
    return `Window ${model.window?.id ?? ""}`.trim();
  }

  if (sel.kind === "gadget") {
    const gadget = model.gadgets.find(it => it.id === sel.id);
    return gadget ? `${gadget.kind} ${gadget.id}` : "No selection";
  }

  if (sel.kind === "menu") {
    return `Menu ${sel.id}`;
  }

  if (sel.kind === "menuEntry") {
    const menu = (model.menus ?? []).find(it => it.id === sel.menuId);
    const entry = menu?.entries?.[sel.entryIndex];
    if (!entry) return "No selection";
    const label = entry.idRaw || entry.textRaw || entry.kind;
    return `${entry.kind} ${label}`.trim();
  }

  if (sel.kind === "toolbar") {
    return `ToolBar ${sel.id}`;
  }

  if (sel.kind === "toolBarEntry") {
    const toolBar = (model.toolbars ?? []).find(it => it.id === sel.toolBarId);
    const entry = toolBar?.entries?.[sel.entryIndex];
    if (!entry) return "No selection";
    const label = entry.idRaw || entry.textRaw || entry.kind;
    return `${entry.kind} ${label}`.trim();
  }

  if (sel.kind === "statusbar") {
    return `StatusBar ${sel.id}`;
  }

  if (sel.kind === "statusBarField") {
    const statusBar = (model.statusbars ?? []).find(it => it.id === sel.statusBarId);
    const field = statusBar?.fields?.[sel.fieldIndex];
    if (!field) return "No selection";
    const label = field.textRaw || field.widthRaw || `Field ${sel.fieldIndex + 1}`;
    return `StatusBarField ${label}`.trim();
  }

  if (sel.kind === "images") {
    return "Images";
  }

  if (sel.kind === "image") {
    return `Image ${sel.id}`;
  }

  return "No selection";
}

function getContextualInfoHint(): string {
  if (pendingInsertGadgetKind && isInsertableGadgetKind(pendingInsertGadgetKind)) {
    if (pendingInsertGadgetKind === GADGET_KIND.SplitterGadget && pendingSplitterInsertConfig) {
      return `Click in the canvas to place a new Splitter for ${pendingSplitterInsertConfig.gadget1Id} and ${pendingSplitterInsertConfig.gadget2Id}. Press Escape to cancel placement mode.`;
    }
    return `Click in the canvas to place a new ${getGadgetInsertLabel(pendingInsertGadgetKind)}. Press Escape to cancel placement mode.`;
  }

  const sel = selection;
  if (!sel) {
    return "Select a window, gadget or top-level entry to view and edit its properties.";
  }

  switch (sel.kind) {
    case "window":
      return "Edit window settings, size and position, event procedure, and window flags here.";
    case "gadget":
      return "Drag or resize gadgets in the canvas. Edit supported items and columns in the inspector.";
    case "menu":
    case "menuEntry":
      return "Menu entries can be inserted, edited or deleted from the current selection.";
    case "toolbar":
    case "toolBarEntry":
      return "Toolbar entries can be inserted, edited or deleted from the current selection.";
    case "statusbar":
    case "statusBarField":
      return "StatusBar fields can be inserted, edited or deleted from the current selection.";
    case "images":
    case "image":
      return "Image references can be added, updated or reassigned from the current selection.";
    default:
      return "Review the current selection and update its available properties.";
  }
}

function renderInfoPanel() {
  renderDiagnostics();
  renderInsertGadgetControls();
  infoHintEl.textContent = getContextualInfoHint();
  infoSelectionEl.textContent = getSelectionSummary();
  const message = (errEl.textContent ?? "").trim();
  errEl.style.display = message ? "block" : "none";
}

function escapeHtml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getWindowPreviewFramePadding(): { top: number; side: number; bottom: number } {
  const platformSkin = resolvePbFormSkinPlatform();
  return {
    top: getWindowPreviewChromeTopPaddingForCurrentSkin(),
    side: getWindowPreviewClientSidePadding(platformSkin, asInt(settings.windowPreviewWindowsClientSidePadding)),
    bottom: getWindowPreviewClientBottomPadding(platformSkin, asInt(settings.windowPreviewWindowsClientBottomPadding)),
  };
}

function getWindowPreviewFrameExtraHeight(): number {
  return resolvePbFormSkinPlatform() === "macos" && hasParsedToolbarChrome()
    ? previewChromeMetrics.toolBarHeight
    : 0;
}

function getWindowPreviewTitleBarHeightForCurrentSkin(): number {
  const platformSkin = resolvePbFormSkinPlatform();
  const titleBarHeight = platformSkin === "windows"
    ? asInt(settings.titleBarHeight)
    : previewChromeMetrics.titleBarHeight;
  return getWindowPreviewTitleBarHeight(model.window?.flagsExpr, titleBarHeight);
}

function getWindowPreviewChromeTopPaddingForCurrentSkin(): number {
  const platformSkin = resolvePbFormSkinPlatform();
  const titleBarHeight = platformSkin === "windows"
    ? asInt(settings.titleBarHeight)
    : previewChromeMetrics.titleBarHeight;
  return getWindowPreviewChromeTopPadding(
    platformSkin,
    model.window?.flagsExpr,
    titleBarHeight,
    asInt(settings.windowPreviewWindowsCaptionlessTopPadding)
  );
}

function getWindowPreviewFrameForStoredSize(origin: { x: number; y: number }, clientWidth: number, clientHeight: number): PreviewRect {
  const framePadding = getWindowPreviewFramePadding();
  return getWindowPreviewFrameRect(
    origin,
    clientWidth,
    clientHeight,
    framePadding.top,
    framePadding.side,
    framePadding.bottom,
    getWindowPreviewFrameExtraHeight()
  );
}

function getWinRect(): { x: number; y: number; w: number; h: number; title: string; id: string; tbH: number } | null {
  const rect = canvas.getBoundingClientRect();
  if (!model.window) return null;

  const storedX = asInt(model.window.x ?? 0);
  const storedY = asInt(model.window.y ?? 0);
  const origin = getWindowPreviewCanvasOrigin(storedX, storedY);
  const w = clampPos(model.window.w ?? rect.width);
  const h = clampPos(model.window.h ?? rect.height);
  const externalMenuBar = usesWindowPreviewExternalMenuBar(settings.osSkin) && hasParsedMenuChrome();
  const frameRect = getWindowPreviewFrameForStoredSize(
    { x: origin.x, y: origin.y + (externalMenuBar ? previewChromeMetrics.menuHeight : 0) },
    w,
    h
  );

  return {
    x: frameRect.x,
    y: frameRect.y,
    w: frameRect.w,
    h: frameRect.h,
    title: model.window.title ?? "",
    id: model.window.id,
    tbH: getWindowPreviewTitleBarHeightForCurrentSkin()
  };
}


function getPrimaryMenu(): FormMenu | undefined {
  return model.menus?.[0];
}

function getPrimaryToolbar(): FormToolBar | undefined {
  return model.toolbars?.[0];
}

function getPrimaryStatusbar(): FormStatusBar | undefined {
  return model.statusbars?.[0];
}

function hasParsedMenuChrome(): boolean {
  return !!getPrimaryMenu();
}

function hasParsedToolbarChrome(): boolean {
  return !!getPrimaryToolbar();
}

function hasParsedStatusbarChrome(): boolean {
  return !!getPrimaryStatusbar();
}

function getWindowLocalRect(): PreviewRect {
  return getWindowPreviewFrameForStoredSize(
    { x: 0, y: 0 },
    Math.max(0, model.window?.w ?? 0),
    Math.max(0, model.window?.h ?? 0)
  );
}

function getWindowContentPreviewRect(metrics: PreviewChromeMetrics): PreviewRect {
  return getWindowLocalChromeLayout(metrics).contentRect;
}

function getWindowLocalChromeLayout(metrics: PreviewChromeMetrics): WindowChromeLayout {
  const platformSkin = resolvePbFormSkinPlatform();
  return getWindowChromeLayout(
    getWindowLocalRect(),
    getWindowPreviewChromeTopPaddingForCurrentSkin(),
    hasParsedMenuChrome(),
    hasParsedToolbarChrome(),
    hasParsedStatusbarChrome(),
    metrics,
    getWindowPreviewClientSidePadding(platformSkin, asInt(settings.windowPreviewWindowsClientSidePadding)),
    getWindowPreviewClientBottomPadding(platformSkin, asInt(settings.windowPreviewWindowsClientBottomPadding)),
    usesWindowPreviewExternalMenuBar(settings.osSkin)
  );
}

function getWindowGlobalChromeLayout(metrics: PreviewChromeMetrics): WindowChromeLayout | null {
  const wr = getWinRect();
  if (!wr) return null;
  const platformSkin = resolvePbFormSkinPlatform();
  const externalMenuBar = usesWindowPreviewExternalMenuBar(settings.osSkin) && hasParsedMenuChrome();
  const layout = getWindowChromeLayout(
    { x: wr.x, y: wr.y, w: wr.w, h: wr.h },
    getWindowPreviewChromeTopPaddingForCurrentSkin(),
    hasParsedMenuChrome(),
    hasParsedToolbarChrome(),
    hasParsedStatusbarChrome(),
    metrics,
    getWindowPreviewClientSidePadding(platformSkin, asInt(settings.windowPreviewWindowsClientSidePadding)),
    getWindowPreviewClientBottomPadding(platformSkin, asInt(settings.windowPreviewWindowsClientBottomPadding)),
    externalMenuBar
  );

  if (!externalMenuBar) {
    return layout;
  }

  return {
    ...layout,
    menuBarRect: getCanvasMenuBarRect(canvas.getBoundingClientRect().width, metrics)
  };
}

function hitWindow(mx: number, my: number): boolean {
  const wr = getWinRect();
  if (!wr) return false;
  return isPointInWindowRect({ x: wr.x, y: wr.y, w: wr.w, h: wr.h }, mx, my);
}

function hitPreviewShell(mx: number, my: number): boolean {
  if (hitWindow(mx, my)) {
    return true;
  }

  const chromeLayout = getWindowGlobalChromeLayout(previewChromeMetrics);
  const menuBarRect = chromeLayout?.menuBarRect ?? null;
  return Boolean(menuBarRect && rectContainsPoint(menuBarRect, mx, my));
}

function toLocal(mx: number, my: number): { lx: number; ly: number } {
  const wr = getWinRect();
  if (!wr) return { lx: mx, ly: my };
  const local = toWindowLocalPoint({ x: wr.x, y: wr.y, w: wr.w, h: wr.h }, mx, my);
  return { lx: local.x, ly: local.y };
}

function toGlobal(lx: number, ly: number): { gx: number; gy: number } {
  const wr = getWinRect();
  if (!wr) return { gx: lx, gy: ly };
  const global = toWindowGlobalPoint({ x: wr.x, y: wr.y, w: wr.w, h: wr.h }, lx, ly);
  return { gx: global.x, gy: global.y };
}

function hitTestGadget(mx: number, my: number): Gadget | null {
  if (!hitWindow(mx, my)) return null;

  const { lx, ly } = toLocal(mx, my);
  const metrics = previewChromeMetrics;
  const cache = new Map<string, GadgetPreviewLayout>();

  for (let i = model.gadgets.length - 1; i >= 0; i--) {
    const g = model.gadgets[i];
    const layout = getGadgetPreviewLayout(g, metrics, cache);
    if (!layout.visible) continue;
    if (!rectContainsPoint(layout.rect, lx, ly)) continue;
    if (!rectContainsPoint(layout.clip, lx, ly)) continue;
    if (canInspectGadgetSplitterPosition(g.kind)) {
      const splitterBarRect = intersectRect(getSplitterBarRect(layout.rect, hasPbFlag(g.flagsExpr, "#PB_Splitter_Vertical"), metrics.splitterWidth, g.state), layout.clip);
      if (!isPointOnRectBorder(layout.rect, lx, ly) && !rectContainsPoint(splitterBarRect, lx, ly)) {
        continue;
      }
    }
    return g;
  }
  return null;
}


function hitHandleGadget(g: Gadget, mx: number, my: number): Handle | null {
  const metrics = previewChromeMetrics;
  const layout = getGadgetPreviewLayout(g, metrics);
  if (!layout.visible) return null;
  const { gx, gy } = toGlobal(layout.rect.x, layout.rect.y);
  const pts = getRectHandlePoints({ x: gx, y: gy, w: layout.rect.w, h: layout.rect.h });
  return hitHandlePoints(pts, mx, my, HANDLE_HIT);
}

function hitHandleWindow(mx: number, my: number): Handle | null {
  const wr = getWinRect();
  if (!wr) return null;

  const resizeButtonHandle = hitWindowPreviewResizeButton({ x: wr.x, y: wr.y, w: wr.w, h: wr.h }, mx, my);
  if (resizeButtonHandle && canResizeWindowHandleInCanvas(resizeButtonHandle)) {
    return resizeButtonHandle;
  }

  // Original Form Designer: top-level windows resize only to the right and bottom.
  const pts = getRectHandlePoints({ x: wr.x, y: wr.y, w: wr.w, h: wr.h }).filter(([handle]) => canResizeWindowHandleInCanvas(handle));
  return hitHandlePoints(pts, mx, my, HANDLE_HIT);
}

function isInTitleBar(mx: number, my: number): boolean {
  const wr = getWinRect();
  if (!wr) return false;
  return isPointInWindowTitleBarRect({ x: wr.x, y: wr.y, w: wr.w, h: wr.h }, wr.tbH, mx, my);
}

function getHandleCursor(h: Handle): string {
  switch (h) {
    case "nw":
    case "se":
      return "nwse-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    case "n":
    case "s":
      return "ns-resize";
    case "w":
    case "e":
      return "ew-resize";
  }
}

function snapValue(v: number, gridSize: number): number {
  if (gridSize <= 1) return Math.trunc(v);
  return Math.round(v / gridSize) * gridSize;
}

function postGadgetRect(g: Gadget) {
  normalizeRectInPlace(g, MIN_GADGET_W, MIN_GADGET_H);
  const committed = commitDisplayedLayoutRect(g.x, g.y, g.w, g.h, getActiveLayoutDpiScale());
  const nextYRaw = buildTopLevelWindowGadgetYRaw(committed.yUnscaled, g.parentId);
  g.x = committed.x;
  g.y = committed.y;
  g.w = committed.w;
  g.h = committed.h;
  g.xRaw = committed.xRaw;
  g.yRaw = nextYRaw;
  g.wRaw = committed.wRaw;
  g.hRaw = committed.hRaw;
  storeLayoutDisplayOverride("gadget", g.id, "x", g.x, g.xRaw);
  storeLayoutDisplayOverride("gadget", g.id, "y", g.y, g.yRaw);
  storeLayoutDisplayOverride("gadget", g.id, "w", g.w, g.wRaw);
  storeLayoutDisplayOverride("gadget", g.id, "h", g.h, g.hRaw);
  vscode.postMessage({ type: WEBVIEW_TO_EXT_MSG_TYPE.setGadgetRect, id: g.id, x: committed.xUnscaled, y: committed.yUnscaled, w: committed.wUnscaled, h: committed.hUnscaled, yRaw: nextYRaw });
}

function postWindowRect() {
  if (!model.window) return;

  normalizeRectInPlace(model.window, MIN_WIN_W, MIN_WIN_H);
  const committed = commitDisplayedLayoutRect(model.window.x, model.window.y, model.window.w, model.window.h, getActiveLayoutDpiScale());
  model.window.x = committed.x;
  model.window.y = committed.y;
  model.window.w = committed.w;
  model.window.h = committed.h;
  model.window.xRaw = committed.xRaw;
  model.window.yRaw = committed.yRaw;
  model.window.wRaw = committed.wRaw;
  model.window.hRaw = committed.hRaw;
  storeLayoutDisplayOverride("window", model.window.id, "x", model.window.x, model.window.xRaw);
  storeLayoutDisplayOverride("window", model.window.id, "y", model.window.y, model.window.yRaw);
  storeLayoutDisplayOverride("window", model.window.id, "w", model.window.w, model.window.wRaw);
  storeLayoutDisplayOverride("window", model.window.id, "h", model.window.h, model.window.hRaw);
  vscode.postMessage({
    type: WEBVIEW_TO_EXT_MSG_TYPE.setWindowRect,
    id: model.window.id,
    x: committed.xUnscaled,
    y: committed.yUnscaled,
    w: committed.wUnscaled,
    h: committed.hUnscaled
  });
}

function postGadgetOpenArgs(id: string, args: { textRaw?: string; textVariable?: boolean; minRaw?: string; maxRaw?: string; flagsExpr?: string }): void {
  post({ type: WEBVIEW_TO_EXT_MSG_TYPE.setGadgetOpenArgs, id, ...args });
}

function postCustomGadgetCode(id: string, args: { customInitRaw?: string; customCreateRaw?: string }): void {
  post({ type: WEBVIEW_TO_EXT_MSG_TYPE.setCustomGadgetCode, id, ...args });
}

function postGadgetProperties(
  id: string,
  args: {
    hiddenRaw?: string;
    disabledRaw?: string;
    tooltipRaw?: string;
    frontColorRaw?: string;
    backColorRaw?: string;
    gadgetFontRaw?: string;
  }
): void {
  post({ type: WEBVIEW_TO_EXT_MSG_TYPE.setGadgetProperties, id, ...args });
}
function postGadgetResizeRaw(
  id: string,
  args: {
    xRaw?: string;
    yRaw?: string;
    wRaw?: string;
    hRaw?: string;
    deleteResize?: boolean;
  }
): void {
  post({ type: WEBVIEW_TO_EXT_MSG_TYPE.setGadgetResizeRaw, id, ...args });
}


function applyLocalGadgetTextUpdate(g: Gadget, value: string, isVariable: boolean): void {
  if (isVariable && !ensureValidPbVariableReference(value)) {
    renderProps();
    return;
  }

  const textRaw = buildGadgetTextRaw(value, isVariable);
  g.textRaw = textRaw;
  g.textVariable = isVariable;
  g.text = value;
  postGadgetOpenArgs(g.id, { textRaw, textVariable: isVariable });
  render();
  renderProps();
}

function applyLocalGadgetTooltipUpdate(g: Gadget, value: string, isVariable: boolean): void {
  if (isVariable && !ensureValidPbVariableReference(value)) {
    renderProps();
    return;
  }

  const tooltipRaw = buildGadgetTooltipRaw(value, isVariable);
  g.tooltipRaw = tooltipRaw;
  g.tooltipVariable = isVariable && tooltipRaw !== undefined;
  g.tooltip = tooltipRaw ? value : undefined;
  postGadgetProperties(g.id, { tooltipRaw });
  renderProps();
}

function resolvePbFormSkinPlatform(): PreviewPlatform {
  return resolvePreviewPlatformFromOsSkin(settings.osSkin);
}

function getWindowResizeLockContext(gadget?: Gadget) {
  if (!model.window) return undefined;
  const parent = gadget?.parentId ? model.gadgets.find(entry => entry.id === gadget.parentId) : undefined;
  return {
    w: model.window.w,
    wRaw: model.window.wRaw,
    h: model.window.h,
    hRaw: model.window.hRaw,
    menuCount: model.menus?.length ?? 0,
    toolbarCount: model.toolbars?.length ?? 0,
    statusBarCount: model.statusbars?.length ?? 0,
    platformSkin: resolvePbFormSkinPlatform(),
    layoutDpiScale: getActiveLayoutDpiScale(),
    parent: parent ? {
      id: parent.id,
      kind: parent.kind,
      pbAny: parent.pbAny,
      variable: parent.variable,
      firstParam: parent.firstParam,
      w: parent.w,
      wRaw: parent.wRaw,
      h: parent.h,
      hRaw: parent.hRaw
    } : undefined
  };
}

function applyLocalGadgetHorizontalLockUpdate(g: Gadget, nextLockLeft: boolean, nextLockRight: boolean): void {
  const resizeCtx = getWindowResizeLockContext(g);
  if (!resizeCtx) return;
  const update = buildGadgetHorizontalLockResizeUpdate(g, resizeCtx, nextLockLeft, nextLockRight);
  if (!update) return;

  g.lockLeft = nextLockLeft;
  g.lockRight = nextLockRight;

  if (update.deleteResize) {
    g.resizeXRaw = undefined;
    g.resizeYRaw = undefined;
    g.resizeWRaw = undefined;
    g.resizeHRaw = undefined;
    g.resizeSource = undefined;
    postGadgetResizeRaw(g.id, { deleteResize: true });
  } else {
    g.resizeXRaw = update.xRaw;
    g.resizeYRaw = update.yRaw;
    g.resizeWRaw = update.wRaw;
    g.resizeHRaw = update.hRaw;
    postGadgetResizeRaw(g.id, update);
  }

  render();
  renderProps();
}

function closeCanvasContextMenu(): void {
  pendingCanvasContextMenu = null;
  canvasContextMenuIgnoreMouseDownTimeStamp = null;
  canvasContextMenuEl?.remove();
  canvasContextMenuEl = null;
}

function renderCanvasContextMenu(): void {
  canvasContextMenuEl?.remove();
  canvasContextMenuEl = null;

  if (!pendingCanvasContextMenu) return;

  const menuEl = document.createElement("div");
  menuEl.className = "canvasContextMenu";
  menuEl.setAttribute("role", "menu");

  for (const action of pendingCanvasContextMenu.actions) {
    const actionBtn = document.createElement("button");
    actionBtn.type = "button";
    actionBtn.className = "canvasContextMenuItem";
    actionBtn.setAttribute("role", "menuitem");
    actionBtn.textContent = action.label;
    actionBtn.disabled = !action.enabled;
    actionBtn.title = action.title;
    actionBtn.onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      const current = pendingCanvasContextMenu;
      closeCanvasContextMenu();
      if (!current || !action.enabled) return;

      switch (action.kind) {
        case "deleteGadget":
          openDestructiveDialog({
            kind: "deleteGadget",
            gadgetId: action.gadgetId,
            message: action.message,
            confirmLabel: action.confirmLabel
          }, current.selection);
          return;
        case "copyGadget":
          copiedGadgetId = action.gadgetId;
          selection = { kind: "gadget", id: action.gadgetId };
          renderSelectionUiWithoutParentSelector();
          return;
        case "pasteGadget":
          post({ type: WEBVIEW_TO_EXT_MSG_TYPE.pasteCopiedGadget, id: action.gadgetId });
          selection = { kind: "gadget", id: action.gadgetId };
          renderSelectionUiWithoutParentSelector();
          return;
        case "duplicateGadget":
          post({ type: WEBVIEW_TO_EXT_MSG_TYPE.duplicateGadget, id: action.gadgetId });
          selection = { kind: "gadget", id: action.gadgetId };
          renderSelectionUiWithoutParentSelector();
          return;
        case "editGadgetItems": {
          const gadget = model.gadgets.find(entry => entry.id === action.gadgetId);
          if (!gadget) return;
          const firstItem = (gadget.items ?? []).find(item => typeof item.source?.line === "number");
          openGadgetItemEditor(gadget, firstItem);
          selection = { kind: "gadget", id: gadget.id };
          renderSelectionUiWithoutParentSelector();
          return;
        }
        case "editGadgetColumns": {
          const gadget = model.gadgets.find(entry => entry.id === action.gadgetId);
          if (!gadget) return;
          const columnIndex = (gadget.columns ?? []).findIndex(column => typeof column.source?.line === "number");
          const firstColumn = columnIndex >= 0 ? gadget.columns?.[columnIndex] : undefined;
          openGadgetColumnEditor(gadget, firstColumn, columnIndex >= 0 ? columnIndex : undefined);
          selection = { kind: "gadget", id: gadget.id };
          renderSelectionUiWithoutParentSelector();
          return;
        }
        case "deleteMenu":
          openDestructiveDialog({
            kind: "deleteMenu",
            menuId: action.menuId,
            message: action.message,
            confirmLabel: action.confirmLabel
          }, current.selection);
          return;
        case "deleteMenuEntry":
          if (typeof action.sourceLine !== "number") return;
          openDestructiveDialog({
            kind: "deleteMenuEntry",
            menuId: action.menuId,
            entryIndex: action.entryIndex,
            sourceLine: action.sourceLine,
            entryKind: action.entryKind,
            message: action.message,
            confirmLabel: action.confirmLabel
          }, current.selection);
          return;
        case "deleteToolBar":
          openDestructiveDialog({
            kind: "deleteToolBar",
            toolBarId: action.toolBarId,
            message: action.message,
            confirmLabel: action.confirmLabel
          }, current.selection);
          return;
        case "deleteToolBarEntry":
          if (typeof action.sourceLine !== "number") return;
          openDestructiveDialog({
            kind: "deleteToolBarEntry",
            toolBarId: action.toolBarId,
            entryIndex: action.entryIndex,
            sourceLine: action.sourceLine,
            entryKind: action.entryKind,
            message: action.message,
            confirmLabel: action.confirmLabel
          }, current.selection);
          return;
        case "deleteStatusBar":
          openDestructiveDialog({
            kind: "deleteStatusBar",
            statusBarId: action.statusBarId,
            message: action.message,
            confirmLabel: action.confirmLabel
          }, current.selection);
          return;
        case "deleteStatusBarField":
          if (typeof action.sourceLine !== "number") return;
          openDestructiveDialog({
            kind: "deleteStatusBarField",
            statusBarId: action.statusBarId,
            fieldIndex: action.fieldIndex,
            sourceLine: action.sourceLine,
            message: action.message,
            confirmLabel: action.confirmLabel
          }, current.selection);
          return;
        case "insertToolBarButton": {
          const toolBar = (model.toolbars ?? []).find(entry => entry.id === action.toolBarId);
          if (!toolBar) return;
          postInsertToolBarEntry(toolBar, getToolBarPreviewInsertArgs(toolBar, "button"));
          setSelectionAndRefresh({ kind: "toolbar", id: toolBar.id });
          return;
        }
        case "insertToolBarToggleButton": {
          const toolBar = (model.toolbars ?? []).find(entry => entry.id === action.toolBarId);
          if (!toolBar) return;
          postInsertToolBarEntry(toolBar, getToolBarPreviewInsertArgs(toolBar, "toggle"));
          setSelectionAndRefresh({ kind: "toolbar", id: toolBar.id });
          return;
        }
        case "insertToolBarSeparator": {
          const toolBar = (model.toolbars ?? []).find(entry => entry.id === action.toolBarId);
          if (!toolBar) return;
          postInsertToolBarEntry(toolBar, getToolBarPreviewInsertArgs(toolBar, "separator"));
          setSelectionAndRefresh({ kind: "toolbar", id: toolBar.id });
          return;
        }
        case "insertStatusBarImage": {
          const statusBar = (model.statusbars ?? []).find(entry => entry.id === action.statusBarId);
          if (!statusBar) return;
          postInsertStatusBarField(statusBar, getStatusBarPreviewInsertArgs("image"));
          setSelectionAndRefresh({ kind: "statusbar", id: statusBar.id });
          return;
        }
        case "insertStatusBarLabel": {
          const statusBar = (model.statusbars ?? []).find(entry => entry.id === action.statusBarId);
          if (!statusBar) return;
          postInsertStatusBarField(statusBar, getStatusBarPreviewInsertArgs("label"));
          setSelectionAndRefresh({ kind: "statusbar", id: statusBar.id });
          return;
        }
        case "insertStatusBarProgressBar": {
          const statusBar = (model.statusbars ?? []).find(entry => entry.id === action.statusBarId);
          if (!statusBar) return;
          postInsertStatusBarField(statusBar, getStatusBarPreviewInsertArgs("progress"));
          setSelectionAndRefresh({ kind: "statusbar", id: statusBar.id });
          return;
        }
      }
    };
    menuEl.appendChild(actionBtn);
  }

  canvasWrap.appendChild(menuEl);

  const wrapRect = canvasWrap.getBoundingClientRect();
  const left = Math.max(4, Math.min(pendingCanvasContextMenu.x + 4, Math.max(4, wrapRect.width - menuEl.offsetWidth - 4)));
  const top = Math.max(4, Math.min(pendingCanvasContextMenu.y + 4, Math.max(4, wrapRect.height - menuEl.offsetHeight - 4)));
  menuEl.style.left = `${left}px`;
  menuEl.style.top = `${top}px`;

  canvasContextMenuEl = menuEl;
}

function resolveCanvasContextMenuActions(
  target: CanvasContextMenuTarget
): CanvasContextMenuAction[] | null {
  if (target.kind === "gadget") {
    const gadget = model.gadgets.find(entry => entry.id === target.id);
    if (!gadget) return null;

    const copiedGadget = copiedGadgetId ? model.gadgets.find(entry => entry.id === copiedGadgetId) : undefined;
    return resolveGadgetCanvasContextMenuActions({
      gadget,
      deleteBlockedReason: getGadgetDeleteBlockedReason(gadget),
      copiedGadgetId: copiedGadget?.id,
      canPasteCopiedGadget: Boolean(copiedGadget && canCopyPasteGadgetFromContextMenu(copiedGadget)),
    });
  }

  return resolveTopLevelCanvasContextMenuActions({
    selection: target,
    menus: model.menus,
    toolbars: model.toolbars,
    statusbars: model.statusbars
  });
}

function openCanvasContextMenu(
  target: CanvasContextMenuTarget,
  x: number,
  y: number,
  triggerMouseDownTimeStamp?: number
): void {
  const actions = resolveCanvasContextMenuActions(target);
  if (!actions?.length) {
    closeCanvasContextMenu();
    return;
  }

  const selection: CanvasContextMenuSelection = target.kind === "toolBarAddButton"
    ? { kind: "toolbar", id: target.toolBarId }
    : target.kind === "statusBarAddButton"
      ? { kind: "statusbar", id: target.statusBarId }
      : target;

  pendingCanvasContextMenu = { x, y, actions, selection };
  canvasContextMenuIgnoreMouseDownTimeStamp = typeof triggerMouseDownTimeStamp === "number"
    ? triggerMouseDownTimeStamp
    : null;
  renderCanvasContextMenu();
}

function applyLocalGadgetVerticalLockUpdate(g: Gadget, nextLockTop: boolean, nextLockBottom: boolean): void {
  const update = buildGadgetVerticalLockResizeUpdate(g, getWindowResizeLockContext(g), nextLockTop, nextLockBottom);
  if (!update) return;

  g.lockTop = nextLockTop;
  g.lockBottom = nextLockBottom;

  if (update.deleteResize) {
    g.resizeXRaw = undefined;
    g.resizeYRaw = undefined;
    g.resizeWRaw = undefined;
    g.resizeHRaw = undefined;
    g.resizeSource = undefined;
    postGadgetResizeRaw(g.id, { deleteResize: true });
  } else {
    g.resizeXRaw = update.xRaw;
    g.resizeYRaw = update.yRaw;
    g.resizeWRaw = update.wRaw;
    g.resizeHRaw = update.hRaw;
    postGadgetResizeRaw(g.id, update);
  }

  render();
  renderProps();
}

function parseOptionalIntegerLiteral(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!/^[-+]?\d+$/.test(trimmed)) return undefined;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function applyLocalGadgetCtorRangeUpdate(g: Gadget, field: "min" | "max", value: string): void {
  const trimmed = value.trim();
  const labels = getGadgetCtorRangeFieldLabels(g.kind);
  const fieldLabel = field === "min" ? labels?.minLabel ?? "Value" : labels?.maxLabel ?? "Value";
  if (!trimmed.length) {
    alert(`${fieldLabel} may not be empty.`);
    renderProps();
    return;
  }
  const parsed = parseOptionalIntegerLiteral(trimmed);
  if (parsed === undefined) {
    alert(`${fieldLabel} accepts only an integer literal.`);
    renderProps();
    return;
  }

  if (isActiveLayoutDpiScalingEnabled() && isDpiScaledGadgetCtorRange(g.kind)) {
    const committed = commitDisplayedLayoutValue(parsed, getActiveLayoutDpiScale());
    storeLayoutDisplayOverride("gadget", g.id, field, committed.displayValue, committed.raw);
    if (field === "min") {
      g.minRaw = committed.raw;
      g.min = committed.displayValue;
      postGadgetOpenArgs(g.id, { minRaw: committed.raw });
    } else {
      g.maxRaw = committed.raw;
      g.max = committed.displayValue;
      postGadgetOpenArgs(g.id, { maxRaw: committed.raw });
    }
  } else if (field === "min") {
    g.minRaw = trimmed;
    g.min = parsed;
    postGadgetOpenArgs(g.id, { minRaw: trimmed });
  } else {
    g.maxRaw = trimmed;
    g.max = parsed;
    postGadgetOpenArgs(g.id, { maxRaw: trimmed });
  }
  render();
  renderProps();
}

canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const chromeLayout = getWindowGlobalChromeLayout(previewChromeMetrics);
  const topLevelChromeHit = resolveTopLevelChromeHit({
    x: mx,
    y: my,
    windowHit: hitPreviewShell(mx, my),
    menuId: getPrimaryMenu()?.id,
    menuRect: chromeLayout?.menuBarRect ?? null,
    menuEntryRects: menuEntryPreviewRects,
    toolBarId: getPrimaryToolbar()?.id,
    toolBarRect: chromeLayout?.toolBarRect ?? null,
    toolBarEntryRects: toolBarEntryPreviewRects,
    statusBarId: getPrimaryStatusbar()?.id,
    statusBarRect: chromeLayout?.statusBarRect ?? null,
    statusBarFieldRects: statusBarFieldPreviewRects
  });

  if (topLevelChromeHit) {
    selection = topLevelChromeHit.selection;
    drag = null;
    canvas.style.cursor = "default";
    renderSelectionUiWithoutParentSelector();
    openCanvasContextMenu(topLevelChromeHit.selection, mx, my);
    return;
  }

  const gadgetHit = hitTestGadget(mx, my);
  if (gadgetHit) {
    selection = { kind: "gadget", id: gadgetHit.id };
    drag = null;
    canvas.style.cursor = "default";
    renderSelectionUiWithoutParentSelector();
    openCanvasContextMenu({ kind: "gadget", id: gadgetHit.id }, mx, my);
    return;
  }

  closeCanvasContextMenu();
});

canvas.addEventListener("mousedown", (e) => {
  closeCanvasContextMenu();
  if (e.button !== 0) return;

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const previousSelection = selection;

  if (pendingInsertGadgetKind) {
    const placement = resolveGadgetInsertPlacement(mx, my);
    if (placement && isInsertableGadgetKind(pendingInsertGadgetKind)) {
      postInsertGadget(pendingInsertGadgetKind, placement.x, placement.y, placement.parentId, placement.parentItem);
      setPendingInsertGadgetKind(null);
    } else if (pendingInsertGadgetKind === GADGET_KIND.SplitterGadget) {
      errEl.textContent = "Choose a valid placement position for the splitter inside the window or a container parent.";
      renderInfoPanel();
    }
    return;
  }

  const panelTabHit = hitTestPanelTab(mx, my, previewChromeMetrics);
  if (panelTabHit) {
    panelActiveItems.set(panelTabHit.panel.id, panelTabHit.index);
    selection = { kind: "gadget", id: panelTabHit.panel.id };
    drag = null;
    canvas.style.cursor = "default";
    renderSelectionUiWithoutParentSelector();
    return;
  }

  const menuAddHit = resolvePreviewRectHit(menuAddPreviewRect, mx, my);
  if (menuAddHit) {
    const menu = (model.menus ?? []).find(entry => entry.id === menuAddHit.menuId);
    if (menu) {
      postInsertMenuEntry(menu, { kind: "MenuTitle", textRaw: toPbString("MenuTitle") });
      selection = { kind: "menu", id: menu.id };
      drag = null;
      canvas.style.cursor = "default";
      renderSelectionUiWithoutParentSelector();
      return;
    }
  }

  const toolBarAddHit = resolvePreviewRectHit(toolBarAddPreviewRect, mx, my);
  if (toolBarAddHit) {
    const toolBar = (model.toolbars ?? []).find(entry => entry.id === toolBarAddHit.toolBarId);
    if (toolBar) {
      selection = { kind: "toolbar", id: toolBar.id };
      drag = null;
      canvas.style.cursor = "default";
      renderSelectionUiWithoutParentSelector();
      openCanvasContextMenu({ kind: "toolBarAddButton", toolBarId: toolBar.id }, mx, my, e.timeStamp);
      return;
    }
  }

  const statusBarAddHit = resolvePreviewRectHit(statusBarAddPreviewRect, mx, my);
  if (statusBarAddHit) {
    const statusBar = (model.statusbars ?? []).find(entry => entry.id === statusBarAddHit.statusBarId);
    if (statusBar) {
      selection = { kind: "statusbar", id: statusBar.id };
      drag = null;
      canvas.style.cursor = "default";
      renderSelectionUiWithoutParentSelector();
      openCanvasContextMenu({ kind: "statusBarAddButton", statusBarId: statusBar.id }, mx, my, e.timeStamp);
      return;
    }
  }

  const footerChromeLayout = getWindowGlobalChromeLayout(previewChromeMetrics);
  const footerHit = resolveMenuFooterHit({
    x: mx,
    y: my,
    windowHit: hitPreviewShell(mx, my),
    menuRect: footerChromeLayout?.menuBarRect ?? null,
    footerRects: menuFooterPreviewRects
  });
  if (footerHit) {
    const menu = (model.menus ?? []).find(entry => entry.id === footerHit.menuId);
    const parentEntry = menu?.entries?.[footerHit.parentIndex];
    const parentSourceLine = parentEntry?.source?.line;
    if (menu && typeof parentSourceLine === "number") {
      const nextArgs = getDefaultMenuItemInsertArgs(menu);
      postInsertMenuEntry(menu, {
        kind: "MenuItem",
        idRaw: nextArgs.idRaw,
        textRaw: nextArgs.textRaw,
      }, parentSourceLine);
      selection = { kind: "menuEntry", menuId: menu.id, entryIndex: footerHit.parentIndex };
      drag = null;
      canvas.style.cursor = "default";
      renderSelectionUiWithoutParentSelector();
      return;
    }
  }

  const chromeLayout = getWindowGlobalChromeLayout(previewChromeMetrics);
  const topLevelChromeHit = resolveTopLevelChromeHit({
    x: mx,
    y: my,
    windowHit: hitPreviewShell(mx, my),
    menuId: getPrimaryMenu()?.id,
    menuRect: chromeLayout?.menuBarRect ?? null,
    menuEntryRects: menuEntryPreviewRects,
    toolBarId: getPrimaryToolbar()?.id,
    toolBarRect: chromeLayout?.toolBarRect ?? null,
    toolBarEntryRects: toolBarEntryPreviewRects,
    statusBarId: getPrimaryStatusbar()?.id,
    statusBarRect: chromeLayout?.statusBarRect ?? null,
    statusBarFieldRects: statusBarFieldPreviewRects
  });
  if (topLevelChromeHit) {
    selection = topLevelChromeHit.selection;
    if (topLevelChromeHit.selection.kind === "menuEntry") {
      const menuSel = topLevelChromeHit.selection;
      const menu = (model.menus ?? []).find(entry => entry.id === menuSel.menuId);
      const entry = menu?.entries?.[menuSel.entryIndex];
      const sourceLine = entry?.source?.line;
      if (menu && entry && typeof sourceLine === "number") {
        drag = {
          target: "menuEntry",
          menuId: menu.id,
          entryIndex: menuSel.entryIndex,
          sourceLine,
          kind: entry.kind,
          startMx: mx,
          startMy: my,
          moved: false,
          moveTarget: null,
          selectedEntryIndexAtDragStart: getMenuEntrySelectedIndexAtDragStart(
            menu.id,
            previousSelection?.kind === "menuEntry" ? previousSelection : null
          )
        };
        canvas.style.cursor = "move";
        renderSelectionUiWithoutParentSelector();
        return;
      }
    }

    if (topLevelChromeHit.selection.kind === "toolBarEntry") {
      const toolBarSel = topLevelChromeHit.selection;
      const toolBar = (model.toolbars ?? []).find(entry => entry.id === toolBarSel.toolBarId);
      const entry = toolBar?.entries?.[toolBarSel.entryIndex];
      const sourceLine = entry?.source?.line;
      if (toolBar && entry && typeof sourceLine === "number") {
        drag = {
          target: "toolBarEntry",
          toolBarId: toolBar.id,
          entryIndex: toolBarSel.entryIndex,
          sourceLine,
          kind: entry.kind,
          startMx: mx,
          startMy: my,
          moved: false,
          moveTarget: null
        };
        canvas.style.cursor = "move";
        renderSelectionUiWithoutParentSelector();
        return;
      }
    }

    if (topLevelChromeHit.selection.kind === "statusBarField") {
      const statusBarSel = topLevelChromeHit.selection;
      const statusBar = (model.statusbars ?? []).find(entry => entry.id === statusBarSel.statusBarId);
      const field = statusBar?.fields?.[statusBarSel.fieldIndex];
      const sourceLine = field?.source?.line;
      if (statusBar && field && typeof sourceLine === "number") {
        drag = {
          target: "statusBarField",
          statusBarId: statusBar.id,
          fieldIndex: statusBarSel.fieldIndex,
          sourceLine,
          startMx: mx,
          startMy: my,
          moved: false,
          moveTarget: null
        };
        canvas.style.cursor = "move";
        renderSelectionUiWithoutParentSelector();
        return;
      }
    }

    drag = null;
    canvas.style.cursor = "default";
    renderSelectionUiWithoutParentSelector();
    return;
  }

  const chromeHit = hitTestPreviewChrome(mx, my, previewChromeMetrics);
  if (chromeHit) {
    const g = chromeHit.gadget;
    selection = { kind: "gadget", id: g.id };

    const h = hitHandleGadget(g, mx, my);
    if (h) {
      drag = {
        target: "gadget",
        mode: "resize",
        id: g.id,
        handle: h,
        startMx: mx,
        startMy: my,
        startX: g.x,
        startY: g.y,
        startW: g.w,
        startH: g.h
      };
      canvas.style.cursor = getHandleCursor(h);
    } else if (chromeHit.zone === "containerBorder" || chromeHit.zone === "panelHeader") {
      drag = {
        target: "gadget",
        mode: "move",
        id: g.id,
        startMx: mx,
        startMy: my,
        startX: g.x,
        startY: g.y,
        startW: g.w,
        startH: g.h
      };
      canvas.style.cursor = "move";
    } else if (chromeHit.zone === "scrollAreaVBar" || chromeHit.zone === "scrollAreaHBar") {
      const metrics = previewChromeMetrics;
      const layout = getGadgetPreviewLayout(g, metrics);
      const axis = chromeHit.zone === "scrollAreaHBar" ? "x" : "y";
      drag = {
        target: "scrollArea",
        axis,
        id: g.id,
        startMx: mx,
        startMy: my,
        startOffset: axis === "x" ? getScrollAreaOffsetX(g, layout.rect, metrics) : getScrollAreaOffsetY(g, layout.rect, metrics),
        maxOffset: axis === "x" ? getScrollAreaMaxOffsetX(layout.rect, metrics, g.min) : getScrollAreaMaxOffsetY(layout.rect, metrics, g.max),
        trackLength: axis === "x"
          ? Math.max(1, getScrollAreaHorizontalBarRect(layout.rect, metrics).w)
          : Math.max(1, getScrollAreaVerticalBarRect(layout.rect, metrics).h)
      };
      canvas.style.cursor = "default";
    } else if (chromeHit.zone === "splitterBar") {
      drag = {
        target: "gadget",
        mode: "move",
        id: g.id,
        startMx: mx,
        startMy: my,
        startX: g.x,
        startY: g.y,
        startW: g.w,
        startH: g.h
      };
      canvas.style.cursor = "move";
    } else {
      drag = null;
      canvas.style.cursor = "default";
    }

    renderSelectionUiWithoutParentSelector();
    return;
  }

  const g = hitTestGadget(mx, my);
  if (g) {
    selection = { kind: "gadget", id: g.id };

    const h = hitHandleGadget(g, mx, my);
    if (h) {
      drag = {
        target: "gadget",
        mode: "resize",
        id: g.id,
        handle: h,
        startMx: mx,
        startMy: my,
        startX: g.x,
        startY: g.y,
        startW: g.w,
        startH: g.h
      };
      canvas.style.cursor = getHandleCursor(h);
    } else {
      drag = {
        target: "gadget",
        mode: "move",
        id: g.id,
        startMx: mx,
        startMy: my,
        startX: g.x,
        startY: g.y,
        startW: g.w,
        startH: g.h
      };
      canvas.style.cursor = "move";
    }

    renderSelectionUiWithoutParentSelector();
    return;
  }

  // Window interaction (no gadget hit)
  const wr = getWinRect();
  const wh = wr ? hitHandleWindow(mx, my) : null;
  if (wr && (hitWindow(mx, my) || wh)) {
    selection = { kind: "window" };

    if (wh) {
      drag = {
        target: "window",
        mode: "resize",
        handle: wh,
        startMx: mx,
        startMy: my,
        startX: asInt(model.window?.x ?? 0),
        startY: asInt(model.window?.y ?? 0),
        startW: asInt(model.window?.w ?? wr.w),
        startH: asInt(model.window?.h ?? wr.h)
      };
      canvas.style.cursor = getHandleCursor(wh);
    } else if (isInTitleBar(mx, my)) {
      drag = null;
      canvas.style.cursor = "default";
    } else {
      drag = null;
      canvas.style.cursor = "default";
    }

    renderSelectionUiWithoutParentSelector();
    return;
  }

  selection = null;
  drag = null;
  canvas.style.cursor = "default";

  renderSelectionUiWithoutParentSelector();
});

window.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  if (pendingInsertGadgetKind) {
    canvas.style.cursor = resolveGadgetInsertPlacement(mx, my) ? "crosshair" : "not-allowed";
    return;
  }

  if (!drag) {
    // Window handles have priority
    const wh = hitHandleWindow(mx, my);
    if (wh) {
      canvas.style.cursor = getHandleCursor(wh);
      return;
    }

    if (isInTitleBar(mx, my) && canMoveWindowInCanvas()) {
      canvas.style.cursor = "move";
      return;
    }

    // Gadget handle only when selected (like typical designers)
    {
      const sel = selection;
      if (sel && sel.kind === "gadget") {
        const selId = sel.id;
        const gSel = model.gadgets.find(it => it.id === selId);
        if (gSel) {
          const gh = hitHandleGadget(gSel, mx, my);
          if (gh) {
            canvas.style.cursor = getHandleCursor(gh);
            return;
          }
        }
      }
    }

    const chromeLayout = getWindowGlobalChromeLayout(previewChromeMetrics);
  const topLevelChromeHit = resolveTopLevelChromeHit({
    x: mx,
    y: my,
    windowHit: hitPreviewShell(mx, my),
    menuId: getPrimaryMenu()?.id,
    menuRect: chromeLayout?.menuBarRect ?? null,
    menuEntryRects: menuEntryPreviewRects,
    toolBarId: getPrimaryToolbar()?.id,
    toolBarRect: chromeLayout?.toolBarRect ?? null,
    toolBarEntryRects: toolBarEntryPreviewRects,
    statusBarId: getPrimaryStatusbar()?.id,
    statusBarRect: chromeLayout?.statusBarRect ?? null,
    statusBarFieldRects: statusBarFieldPreviewRects
  });
    if (topLevelChromeHit) {
      canvas.style.cursor = "default";
      return;
    }

    const chromeHit = hitTestPreviewChrome(mx, my, previewChromeMetrics);
    if (chromeHit) {
      if (chromeHit.zone === "containerBorder" || chromeHit.zone === "panelHeader" || chromeHit.zone === "splitterBar") {
        canvas.style.cursor = "move";
      } else {
        canvas.style.cursor = "default";
      }
      return;
    }

    const g = hitTestGadget(mx, my);
    canvas.style.cursor = g ? "move" : "default";
    return;
  }

  const d = drag;
  const dx = mx - d.startMx;
  const dy = my - d.startMy;

  if (d.target === "scrollArea") {
    const g = model.gadgets.find(it => it.id === d.id);
    if (!g) return;
    const delta = d.axis === "x" ? dx : dy;
    const nextOffset = clamp(d.startOffset + Math.round((delta / d.trackLength) * d.maxOffset), 0, d.maxOffset);
    const metrics = previewChromeMetrics;
    const layout = getGadgetPreviewLayout(g, metrics);
    const current = getScrollAreaPreviewOffset(g.id);
    if (d.axis === "x") {
      setScrollAreaPreviewOffset(g, layout.rect, metrics, nextOffset, current.y);
    } else {
      setScrollAreaPreviewOffset(g, layout.rect, metrics, current.x, nextOffset);
    }
    canvas.style.cursor = "default";
    render();
    renderProps();
    return;
  }

  if (d.target === "menuEntry") {
    const moved = Math.abs(dx) > 3 || Math.abs(dy) > 3;
    d.moved = moved;
    if (moved) {
      const menu = (model.menus ?? []).find(entry => entry.id === d.menuId);
      const chromeLayout = getWindowGlobalChromeLayout(previewChromeMetrics);
      const menuBarRect = chromeLayout?.menuBarRect ?? null;
      const menuBarBottom = menuBarRect ? menuBarRect.y + menuBarRect.h : 0;
      d.moveTarget = menu ? getMenuEntryMoveTarget({
        menu,
        sourceEntryIndex: d.entryIndex,
        x: mx,
        y: my,
        menuBarBottom,
        visibleEntries: getMenuVisibleEntries(menu, menuEntryPreviewRects),
        footerRects: menuFooterPreviewRects,
        selectedEntryIndex: d.selectedEntryIndexAtDragStart
      }) : null;
    } else {
      d.moveTarget = null;
    }
    canvas.style.cursor = moved ? "move" : "default";
    render();
    renderProps();
    return;
  }

  if (d.target === "toolBarEntry") {
    const moved = Math.abs(dx) > 3 || Math.abs(dy) > 3;
    d.moved = moved;
    if (moved) {
      const toolBar = (model.toolbars ?? []).find(entry => entry.id === d.toolBarId);
      const entryRects = toolBarEntryPreviewRects.filter(rect => rect.ownerId === d.toolBarId);
      d.moveTarget = toolBar ? getLinearTopLevelEntryMoveTarget({
        sourceEntryIndex: d.entryIndex,
        x: mx,
        y: my,
        entryRects,
        getSourceLine: index => toolBar.entries?.[index]?.source?.line,
        beforeIndicatorOffsetX: -3,
        afterIndicatorOffsetX: 16,
        isNoopMove: (targetIndex, placement) => {
          const sourceEndIndex = getToolBarEntryMoveBlockEndIndex(toolBar, d.entryIndex);
          const targetEndIndex = getToolBarEntryMoveBlockEndIndex(toolBar, targetIndex);
          return getPredictedLinearMoveIndex(toolBar.entries?.length ?? 0, d.entryIndex, sourceEndIndex, targetIndex, targetEndIndex, placement) === null;
        }
      }) : null;
    } else {
      d.moveTarget = null;
    }
    canvas.style.cursor = moved ? "move" : "default";
    render();
    renderProps();
    return;
  }

  if (d.target === "statusBarField") {
    const moved = Math.abs(dx) > 3 || Math.abs(dy) > 3;
    d.moved = moved;
    if (moved) {
      const statusBar = (model.statusbars ?? []).find(entry => entry.id === d.statusBarId);
      const entryRects = statusBarFieldPreviewRects.filter(rect => rect.ownerId === d.statusBarId);
      d.moveTarget = statusBar ? getStatusBarFieldMoveTarget({
        sourceEntryIndex: d.fieldIndex,
        x: mx,
        y: my,
        entryRects,
        getSourceLine: index => statusBar.fields?.[index]?.source?.line,
        indicatorHeight: 16,
        isNoopMove: (targetIndex, placement) => getPredictedLinearMoveIndex(
          statusBar.fields?.length ?? 0,
          d.fieldIndex,
          d.fieldIndex,
          targetIndex,
          targetIndex,
          placement
        ) === null
      }) : null;
    } else {
      d.moveTarget = null;
    }
    canvas.style.cursor = moved ? "move" : "default";
    render();
    renderProps();
    return;
  }

  if (d.target === "gadget") {
    const g = model.gadgets.find(it => it.id === d.id);
    if (!g) return;

    if (d.mode === "move") {
      let nx = asInt(d.startX + dx);
      let ny = asInt(d.startY + dy);

      const p = applyLiveSnapPoint(nx, ny);
      nx = p.x;
      ny = p.y;

      g.x = nx;
      g.y = ny;
      canvas.style.cursor = "move";
    } else {
      const r0 = applyResize({ x: d.startX, y: d.startY, w: d.startW, h: d.startH }, { dx, dy }, d.handle, MIN_GADGET_W, MIN_GADGET_H);

      let nx = r0.x;
      let ny = r0.y;
      let nw = r0.w;
      let nh = r0.h;
      const r1 = applyLiveSnapRect(nx, ny, nw, nh, MIN_GADGET_W, MIN_GADGET_H);
      nx = r1.x;
      ny = r1.y;
      nw = r1.w;
      nh = r1.h;

      g.x = nx;
      g.y = ny;
      g.w = nw;
      g.h = nh;

      canvas.style.cursor = getHandleCursor(d.handle);
    }

    render();
    renderProps();
    return;
  }

  // Window resize only (original Form Designer behavior keeps window X/Y inspector-only)
  if (!model.window) return;

  const r0 = applyResize({ x: d.startX, y: d.startY, w: d.startW, h: d.startH }, { dx, dy }, d.handle, MIN_WIN_W, MIN_WIN_H);

  let nx = r0.x;
  let ny = r0.y;
  let nw = r0.w;
  let nh = r0.h;
  const r1 = applyLiveSnapRect(nx, ny, nw, nh, MIN_WIN_W, MIN_WIN_H);
  nx = r1.x;
  ny = r1.y;
  nw = r1.w;
  nh = r1.h;

  model.window.x = nx;
  model.window.y = ny;
  model.window.w = nw;
  model.window.h = nh;

  markPreviewCanvasScrollContentSizeDirty();
  canvas.style.cursor = getHandleCursor(d.handle);

  render();
  renderProps();
});

window.addEventListener("mouseup", () => {
  const d = drag;
  if (!d) return;

  if (d.target === "scrollArea") {
    drag = null;
    return;
  }

  if (d.target === "menuEntry") {
    if (d.moved && d.moveTarget) {
      const menu = (model.menus ?? []).find(entry => entry.id === d.menuId);
      pendingMenuEntrySelection = menu
        ? buildPendingMenuEntrySelection(menu, d.entryIndex, d.moveTarget.targetSourceLine, d.moveTarget.placement)
        : null;
      post({
        type: WEBVIEW_TO_EXT_MSG_TYPE.moveMenuEntry,
        menuId: d.menuId,
        sourceLine: d.sourceLine,
        kind: d.kind,
        targetSourceLine: d.moveTarget.targetSourceLine,
        placement: d.moveTarget.placement
      });
    }
    drag = null;
    canvas.style.cursor = "default";
    renderSelectionUiWithoutParentSelector();
    return;
  }

  if (d.target === "toolBarEntry") {
    if (d.moved && d.moveTarget) {
      const toolBar = (model.toolbars ?? []).find(entry => entry.id === d.toolBarId);
      pendingToolBarEntrySelection = toolBar
        ? buildPendingToolBarEntryMoveSelection(toolBar, d.entryIndex, d.moveTarget.targetSourceLine, d.moveTarget.placement)
        : null;
      post({
        type: WEBVIEW_TO_EXT_MSG_TYPE.moveToolBarEntry,
        toolBarId: d.toolBarId,
        sourceLine: d.sourceLine,
        kind: d.kind,
        targetSourceLine: d.moveTarget.targetSourceLine,
        placement: d.moveTarget.placement
      });
    }
    drag = null;
    canvas.style.cursor = "default";
    renderSelectionUiWithoutParentSelector();
    return;
  }

  if (d.target === "statusBarField") {
    if (d.moved && d.moveTarget) {
      const statusBar = (model.statusbars ?? []).find(entry => entry.id === d.statusBarId);
      pendingStatusBarFieldSelection = statusBar
        ? buildPendingStatusBarFieldMoveSelection(statusBar, d.fieldIndex, d.moveTarget.targetSourceLine, d.moveTarget.placement)
        : null;
      post({
        type: WEBVIEW_TO_EXT_MSG_TYPE.moveStatusBarField,
        statusBarId: d.statusBarId,
        sourceLine: d.sourceLine,
        targetSourceLine: d.moveTarget.targetSourceLine,
        placement: d.moveTarget.placement
      });
    }
    drag = null;
    canvas.style.cursor = "default";
    renderSelectionUiWithoutParentSelector();
    return;
  }

  if (d.target === "gadget") {
    const g = model.gadgets.find(it => it.id === d.id);
    if (g) {
      const startRect = { x: d.startX, y: d.startY, w: d.startW, h: d.startH };
      if (hasRectChanged(g, startRect)) {
        applyDropSnapRectInPlace(g, MIN_GADGET_W, MIN_GADGET_H);
        if (hasRectChanged(g, startRect)) {
          postGadgetRect(g);
        }
      }
    }
  } else if (model.window) {
    const startRect = { x: d.startX, y: d.startY, w: d.startW, h: d.startH };
    if (hasRectChanged(model.window, startRect)) {
      applyDropSnapRectInPlace(model.window, MIN_WIN_W, MIN_WIN_H);
      if (hasRectChanged(model.window, startRect)) {
        postWindowRect();
      }
    }
  }

  drag = null;
});

type GadgetPreviewLayout = {
  rect: PreviewRect;
  clip: PreviewRect;
  visible: boolean;
};

type PanelTabRect = PanelTabLayout;

type PreviewChromeHitZone = "containerBorder" | "panelHeader" | "scrollAreaVBar" | "scrollAreaHBar" | "splitterBar";

type PreviewChromeHit = {
  gadget: Gadget;
  zone: PreviewChromeHitZone;
};

function getGadgetById(id: string | undefined): Gadget | undefined {
  if (!id) return undefined;
  return model.gadgets.find((g) => g.id === id);
}

function rectIntersects(a: PreviewRect, b: PreviewRect): boolean {
  const i = intersectRect(a, b);
  return i.w > 0 && i.h > 0;
}

function getPanelActiveItem(panel: Gadget): number {
  return resolvePanelActiveItem(panelActiveItems.get(panel.id), panel.items?.length ?? 0);
}

function getScrollAreaPreviewOffset(gadgetId: string): { x: number; y: number } {
  const stored = scrollAreaOffsets.get(gadgetId);
  if (stored) return stored;
  return { x: 0, y: 0 };
}

function getClampedScrollAreaPreviewOffset(g: Gadget, rect: PreviewRect, metrics: PreviewChromeMetrics): { x: number; y: number } {
  return clampScrollAreaOffset(getScrollAreaPreviewOffset(g.id), rect, metrics, g.min, g.max);
}

function getScrollAreaOffsetX(g: Gadget, rect: PreviewRect, metrics: PreviewChromeMetrics): number {
  return getClampedScrollAreaPreviewOffset(g, rect, metrics).x;
}

function getScrollAreaOffsetY(g: Gadget, rect: PreviewRect, metrics: PreviewChromeMetrics): number {
  return getClampedScrollAreaPreviewOffset(g, rect, metrics).y;
}

function setScrollAreaPreviewOffset(g: Gadget, rect: PreviewRect, metrics: PreviewChromeMetrics, nextX: number, nextY: number) {
  const next = clampScrollAreaOffset({ x: nextX, y: nextY }, rect, metrics, g.min, g.max);
  if (next.x === 0 && next.y === 0) {
    scrollAreaOffsets.delete(g.id);
    return;
  }
  scrollAreaOffsets.set(g.id, next);
}

function drawDisabledGadgetOverlay(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "rgba(140,140,140,0.7)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, width - 1), Math.max(0, height - 1));
  ctx.restore();
}

function getPanelTabRects(
  ctx: CanvasRenderingContext2D,
  g: Gadget,
  rect: PreviewRect,
  metrics: PreviewChromeMetrics
): PanelTabRect[] {
  const labels = (g.items ?? []).map((item, index) => (item.text ?? unquotePbString(item.textRaw)) || `Tab ${index + 1}`);
  return getPanelTabLayouts(labels, rect, metrics, getPanelActiveItem(g), (label) => ctx.measureText(label).width, settings.osSkin);
}

function getGadgetPreviewLayout(
  g: Gadget,
  metrics: PreviewChromeMetrics,
  cache = new Map<string, GadgetPreviewLayout>(),
  visiting = new Set<string>()
): GadgetPreviewLayout {
  const cached = cache.get(g.id);
  if (cached) return cached;

  if (visiting.has(g.id)) {
    const cycle: GadgetPreviewLayout = { rect: { x: g.x, y: g.y, w: g.w, h: g.h }, clip: { x: 0, y: 0, w: 0, h: 0 }, visible: false };
    cache.set(g.id, cycle);
    return cycle;
  }

  visiting.add(g.id);
  const windowRect = getWindowLocalRect();
  const windowContentRect = getWindowContentPreviewRect(metrics);

  let rect: PreviewRect = { x: g.x, y: g.y, w: g.w, h: g.h };
  let clip = windowRect;
  let visible = rect.w > 0 && rect.h > 0 && !isGadgetHiddenInDesignerPreview(g.hidden);

  if (g.splitterId) {
    const splitter = getGadgetById(g.splitterId);
    if (splitter) {
      const splitterLayout = getGadgetPreviewLayout(splitter, metrics, cache, visiting);
      const paneRect = g.id === splitter.gadget1Id
        ? getSplitterPaneRect(splitterLayout.rect, hasPbFlag(splitter.flagsExpr, "#PB_Splitter_Vertical"), metrics.splitterWidth, splitter.state, "first")
        : g.id === splitter.gadget2Id
          ? getSplitterPaneRect(splitterLayout.rect, hasPbFlag(splitter.flagsExpr, "#PB_Splitter_Vertical"), metrics.splitterWidth, splitter.state, "second")
          : splitterLayout.rect;
      rect = paneRect;
      clip = intersectRect(splitterLayout.clip, paneRect);
      visible = splitterLayout.visible && clip.w > 0 && clip.h > 0 && !isGadgetHiddenInDesignerPreview(g.hidden);
    }
  } else if (g.parentId) {
    const parent = getGadgetById(g.parentId);
    if (parent) {
      const parentLayout = getGadgetPreviewLayout(parent, metrics, cache, visiting);
      const parentContentRect = getGadgetContentRect(parent.kind, parentLayout.rect, metrics);
      const localRect = resolveGadgetCtorPreviewLocalRect(g, parentContentRect.w, parentContentRect.h);
      clip = intersectRect(parentLayout.clip, parentContentRect);
      let localX = localRect.x;
      let localY = localRect.y;
      if (parent.kind === GADGET_KIND.ScrollAreaGadget) {
        localX -= getScrollAreaOffsetX(parent, parentLayout.rect, metrics);
        localY -= getScrollAreaOffsetY(parent, parentLayout.rect, metrics);
      }
      rect = { x: parentContentRect.x + localX, y: parentContentRect.y + localY, w: localRect.w, h: localRect.h };
      visible = parentLayout.visible && clip.w > 0 && clip.h > 0 && rectIntersects(rect, clip) && !isGadgetHiddenInDesignerPreview(g.hidden);

      if (parent.kind === GADGET_KIND.PanelGadget && typeof g.parentItem === "number") {
        visible = visible && g.parentItem === getPanelActiveItem(parent);
      }
    }
  } else {
    const localRect = resolveGadgetCtorPreviewLocalRect(g, windowContentRect.w, windowContentRect.h);
    rect = { x: windowContentRect.x + localRect.x, y: windowContentRect.y + localRect.y, w: localRect.w, h: localRect.h };
    clip = intersectRect(windowContentRect, rect);
    visible = clip.w > 0 && clip.h > 0 && !isGadgetHiddenInDesignerPreview(g.hidden);
  }

  const layout: GadgetPreviewLayout = { rect, clip, visible };
  visiting.delete(g.id);
  cache.set(g.id, layout);
  return layout;
}

function hitTestPreviewChrome(mx: number, my: number, metrics: PreviewChromeMetrics): PreviewChromeHit | null {
  if (!hitWindow(mx, my)) return null;

  const { lx, ly } = toLocal(mx, my);
  const cache = new Map<string, GadgetPreviewLayout>();

  for (let i = model.gadgets.length - 1; i >= 0; i--) {
    const g = model.gadgets[i];
    const layout = getGadgetPreviewLayout(g, metrics, cache);
    if (!layout.visible) continue;
    if (!rectContainsPoint(layout.rect, lx, ly)) continue;
    if (!rectContainsPoint(layout.clip, lx, ly)) continue;

    if (g.kind === GADGET_KIND.SplitterGadget) {
      const splitterZone = getSplitterChromeHitZone(
        layout.rect,
        hasPbFlag(g.flagsExpr, "#PB_Splitter_Vertical"),
        metrics,
        g.state,
        lx,
        ly,
        layout.clip
      );
      if (splitterZone) {
        return { gadget: g, zone: splitterZone };
      }
      continue;
    }

    const containerZone = getContainerChromeHitZone(g.kind, layout.rect, metrics, lx, ly);
    if (containerZone) {
      return { gadget: g, zone: containerZone };
    }

    if (g.kind === GADGET_KIND.ScrollAreaGadget) {
      const scrollAreaZone = getScrollAreaChromeHitZone(layout.rect, metrics, lx, ly, layout.clip);
      if (scrollAreaZone) {
        return { gadget: g, zone: scrollAreaZone };
      }
    }
  }

  return null;
}

function hitTestPanelTab(mx: number, my: number, metrics: PreviewChromeMetrics): { panel: Gadget; index: number } | null {
  if (!hitWindow(mx, my)) return null;

  const { lx, ly } = toLocal(mx, my);
  const ctx = canvas.getContext("2d")!;
  ctx.save();
  ctx.font = "12px system-ui, -apple-system, Segoe UI, sans-serif";

  try {
    const cache = new Map<string, GadgetPreviewLayout>();
    for (let i = model.gadgets.length - 1; i >= 0; i--) {
      const g = model.gadgets[i];
      if (g.kind !== GADGET_KIND.PanelGadget) continue;
      const layout = getGadgetPreviewLayout(g, metrics, cache);
      if (!layout.visible) continue;
      if (!rectContainsPoint(layout.rect, lx, ly)) continue;
      if (!rectContainsPoint(layout.clip, lx, ly)) continue;
      const tabs = getPanelTabRects(ctx, g, layout.rect, metrics);
      for (const tab of tabs) {
        const visibleTabRect = getPanelTabVisibleHitRect(tab.rect, layout.clip);
        if (visibleTabRect && rectContainsPoint(visibleTabRect, lx, ly)) {
          return { panel: g, index: tab.index };
        }
      }
    }
  } finally {
    ctx.restore();
  }

  return null;
}

function resolveGadgetInsertPlacement(mx: number, my: number): { x: number; y: number; parentId?: string; parentItem?: number } | null {
  if (!pendingInsertGadgetKind || !isInsertableGadgetKind(pendingInsertGadgetKind)) return null;
  if (pendingInsertGadgetKind === GADGET_KIND.SplitterGadget && !pendingSplitterInsertConfig) return null;
  if (!hitWindow(mx, my)) return null;

  const { lx, ly } = toLocal(mx, my);
  const metrics = previewChromeMetrics;
  const windowContentRect = getWindowContentPreviewRect(metrics);
  const rawLocalX = lx - windowContentRect.x;
  const rawLocalY = ly - windowContentRect.y;
  const snappedLocalX = settings.snapToGrid ? snapValue(rawLocalX, settings.gridSize) : Math.trunc(rawLocalX);
  const snappedLocalY = settings.snapToGrid ? snapValue(rawLocalY, settings.gridSize) : Math.trunc(rawLocalY);
  const alignedX = windowContentRect.x + snappedLocalX;
  const alignedY = windowContentRect.y + snappedLocalY;

  if (!rectContainsPoint(windowContentRect, alignedX, alignedY)) {
    return null;
  }

  const cache = new Map<string, GadgetPreviewLayout>();
  for (let i = model.gadgets.length - 1; i >= 0; i--) {
    const gadget = model.gadgets[i];
    if (!canHostInsertedGadgets(gadget)) continue;

    const layout = getGadgetPreviewLayout(gadget, metrics, cache);
    if (!layout.visible) continue;
    if (!rectContainsPoint(layout.rect, alignedX, alignedY)) continue;
    if (!rectContainsPoint(layout.clip, alignedX, alignedY)) continue;

    const contentRect = getGadgetContentRect(gadget.kind, layout.rect, metrics);
    let x = alignedX - contentRect.x;
    let y = alignedY - contentRect.y;
    if (gadget.kind === GADGET_KIND.ScrollAreaGadget) {
      x += getScrollAreaOffsetX(gadget, layout.rect, metrics);
      y += getScrollAreaOffsetY(gadget, layout.rect, metrics);
    }

    return {
      x,
      y,
      parentId: gadget.id,
      parentItem: gadget.kind === GADGET_KIND.PanelGadget ? getPanelActiveItem(gadget) : undefined,
    };
  }

  return { x: snappedLocalX, y: snappedLocalY };
}

function drawContainerGadgetChrome(
  ctx: CanvasRenderingContext2D,
  g: Gadget,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const fillColor = pbColorNumberToCssHex(g.backColor) ?? "rgb(237, 237, 237)";

  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.fillRect(x, y, Math.max(0, w), Math.max(0, h));

  if (hasPbFlag(g.flagsExpr, "#PB_Container_Single")) {
    ctx.strokeStyle = "rgb(130, 130, 130)";
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
  } else if (hasPbFlag(g.flagsExpr, "#PB_Container_Flat")) {
    ctx.strokeStyle = "rgb(0, 0, 0)";
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
  } else if (hasPbFlag(g.flagsExpr, "#PB_Container_Double")) {
    ctx.strokeStyle = "rgb(130, 130, 130)";
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
    if (w > 2 && h > 2) {
      ctx.strokeStyle = "rgb(194, 194, 194)";
      ctx.strokeRect(x + 1.5, y + 1.5, Math.max(0, w - 3), Math.max(0, h - 3));
    }
  } else if (hasPbFlag(g.flagsExpr, "#PB_Container_Raised")) {
    ctx.strokeStyle = "rgb(194, 194, 194)";
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
    if (w > 2 && h > 2) {
      ctx.strokeStyle = "rgb(130, 130, 130)";
      ctx.strokeRect(x + 1.5, y + 1.5, Math.max(0, w - 3), Math.max(0, h - 3));
    }
  }

  ctx.restore();
}


function getPreviewGadgetDefaultTextColor(windowsSkinColors?: WindowsSkinSystemColors | null): string {
  return windowsSkinColors?.windowText ?? "rgb(0, 0, 0)";
}

function getPreviewGadgetDefaultControlBg(osSkin: DesignerSettings["osSkin"], windowsSkinColors?: WindowsSkinSystemColors | null): string {
  switch (osSkin) {
    case "windows7":
    case "windows8":
      return windowsSkinColors?.buttonFace ?? "rgb(240, 240, 240)";
    case "macos":
      return "rgb(237, 237, 237)";
    case "linux":
      return "rgb(242, 241, 240)";
    default:
      return "rgb(240, 240, 240)";
  }
}

function getPreviewGadgetDefaultClientBg(windowsSkinColors?: WindowsSkinSystemColors | null): string {
  return windowsSkinColors?.window ?? "rgb(255, 255, 255)";
}

function mixCssRgb(colorA: string, colorB: string, ratio: number): string {
  const rgbA = parseCssRgb(colorA);
  const rgbB = parseCssRgb(colorB);
  if (!rgbA || !rgbB) return colorA;

  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const mixChannel = (a: number, b: number) => Math.round(a + ((b - a) * clampedRatio));
  return `rgb(${mixChannel(rgbA[0], rgbB[0])}, ${mixChannel(rgbA[1], rgbB[1])}, ${mixChannel(rgbA[2], rgbB[2])})`;
}

function drawButtonGadgetChrome(
  ctx: CanvasRenderingContext2D,
  g: Gadget,
  x: number,
  y: number,
  w: number,
  h: number,
  osSkin: DesignerSettings["osSkin"],
  windowsSkinColors?: WindowsSkinSystemColors | null
) {
  const label = getPreviewGadgetText(g, GADGET_KIND.ButtonGadget);
  const textColor = pbColorNumberToCssHex(g.frontColor) ?? getPreviewGadgetDefaultTextColor(windowsSkinColors);
  const baseControlColor = getPreviewGadgetDefaultControlBg(osSkin, windowsSkinColors);
  const buttonRadius = Math.max(2, Math.min(4, Math.trunc(Math.min(w, h) / 6)));

  ctx.save();
  ctx.textBaseline = "top";

  switch (osSkin) {
    case "windows7": {
      const topFill = mixCssRgb(baseControlColor, "rgb(0, 0, 0)", 0.02);
      const bottomFill = mixCssRgb(baseControlColor, "rgb(0, 0, 0)", 0.12);
      const innerBorder = mixCssRgb(baseControlColor, "rgb(255, 255, 255)", 0.6);
      const outerBorder = ensurePreviewLineContrast(
        windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? "rgb(111, 111, 111)",
        bottomFill,
        "rgb(111, 111, 111)"
      );
      const gradient = ctx.createLinearGradient(x + 1, y + 1, x + 1, y + Math.max(1, h - 2));
      gradient.addColorStop(0, topFill);
      gradient.addColorStop(0.45, topFill);
      gradient.addColorStop(0.46, bottomFill);
      gradient.addColorStop(1, bottomFill);

      traceRoundedRect(ctx, x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2), buttonRadius);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.strokeStyle = innerBorder;
      ctx.stroke();

      traceRoundedRect(ctx, x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1), buttonRadius);
      ctx.strokeStyle = outerBorder;
      ctx.stroke();
      break;
    }

    case "windows8": {
      const topFill = baseControlColor;
      const bottomFill = mixCssRgb(baseControlColor, "rgb(0, 0, 0)", 0.05);
      const borderColor = ensurePreviewLineContrast(
        windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? "rgb(172, 172, 172)",
        baseControlColor,
        "rgb(172, 172, 172)"
      );
      const gradient = ctx.createLinearGradient(x + 1, y + 1, x + 1, y + Math.max(1, h - 2));
      gradient.addColorStop(0, topFill);
      gradient.addColorStop(1, bottomFill);
      ctx.fillStyle = gradient;
      ctx.fillRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2));
      ctx.strokeStyle = borderColor;
      ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
      break;
    }

    case "macos":
    case "linux":
    default: {
      if (usesOriginalMacRoundedButtonChrome(osSkin, h)) {
        const topBandHeight = Math.max(0, Math.min(10, h - 2));
        const bottomBandY = y + 11;
        const bottomBandHeight = Math.max(0, Math.min(10, (y + h - 1) - bottomBandY));
        const outlineHeight = Math.max(0, Math.min(22, h - 1));
        const gradient = ctx.createLinearGradient(x + 1, y + 1, x + 1, y + 10);
        gradient.addColorStop(0, "rgb(244, 244, 244)");
        gradient.addColorStop(1, "rgb(255, 255, 255)");
        ctx.fillStyle = gradient;
        ctx.fillRect(x + 1, y + 1, Math.max(0, w - 2), topBandHeight);
        ctx.fillStyle = "rgb(236, 236, 236)";
        ctx.fillRect(x + 1, bottomBandY, Math.max(0, w - 2), bottomBandHeight);
        traceRoundedRect(ctx, x + 0.5, y + 0.5, Math.max(0, w - 1), outlineHeight, 3);
        ctx.strokeStyle = "rgb(144, 144, 144)";
        ctx.stroke();
        break;
      }

      traceRoundedRect(ctx, x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1), buttonRadius);
      ctx.strokeStyle = "rgb(220, 220, 220)";
      ctx.stroke();

      traceRoundedRect(ctx, x + 1.5, y + 1.5, Math.max(0, w - 3), Math.max(0, h - 3), buttonRadius);
      ctx.fillStyle = "rgb(241, 241, 241)";
      ctx.fill();
      ctx.strokeStyle = "rgb(174, 174, 174)";
      ctx.stroke();

      ctx.strokeStyle = "rgb(255, 255, 255)";
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 2.5);
      ctx.lineTo(x + Math.max(4, w - 4), y + 2.5);
      ctx.stroke();
      ctx.strokeStyle = "rgb(250, 250, 250)";
      ctx.beginPath();
      ctx.moveTo(x + 3, y + 3.5);
      ctx.lineTo(x + Math.max(3, w - 3), y + 3.5);
      ctx.stroke();
      ctx.strokeStyle = "rgb(246, 246, 246)";
      ctx.beginPath();
      ctx.moveTo(x + 2, y + 4.5);
      ctx.lineTo(x + Math.max(2, w - 2), y + 4.5);
      ctx.stroke();
      break;
    }
  }

  const textStyle = applyPreviewGadgetTextStyle(ctx, g, 12);
  const textWidth = ctx.measureText(label).width;
  const textHeight = measurePreviewTextHeight(ctx, label, textStyle.sizePx);
  const textX = x + Math.max(1, (w - textWidth) / 2);
  const textY = getPreviewButtonTextY(y, h, textHeight);
  ctx.fillStyle = textColor;
  ctx.fillText(label, textX, textY);
  drawPreviewTextDecorations(ctx, label, textX, textY, textStyle, textColor);
  ctx.restore();
}

function drawComboDropArrow(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  color: string
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(centerX - 4, centerY - 2);
  ctx.lineTo(centerX + 4, centerY - 2);
  ctx.lineTo(centerX, centerY + 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMacComboDoubleArrows(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string
): void {
  ctx.save();
  ctx.fillStyle = color;

  ctx.beginPath();
  ctx.moveTo(x, y + 4);
  ctx.lineTo(x + 2.5, y);
  ctx.lineTo(x + 5, y + 4);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x, y + 7);
  ctx.lineTo(x + 2.5, y + 11);
  ctx.lineTo(x + 5, y + 7);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawCheckableGadgetFallbackMark(
  ctx: CanvasRenderingContext2D,
  kind: "checkbox" | "option",
  checked: boolean,
  x: number,
  y: number,
  osSkin: DesignerSettings["osSkin"],
  windowsSkinColors?: WindowsSkinSystemColors | null
): void {
  ctx.save();

  if (kind === "checkbox") {
    const size = 13;
    const borderColor = osSkin === "windows8"
      ? ensurePreviewLineContrast(
        windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? "rgb(142, 142, 142)",
        "rgb(255, 255, 255)",
        "rgb(142, 142, 142)"
      )
      : "rgb(142, 142, 142)";
    ctx.fillStyle = "rgb(255, 255, 255)";
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = borderColor;
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
    if (checked) {
      ctx.strokeStyle = osSkin === "windows8" ? "rgb(49, 106, 197)" : "rgb(0, 0, 0)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 2.5, y + 6.5);
      ctx.lineTo(x + 5.5, y + 9.5);
      ctx.lineTo(x + 10.5, y + 3.5);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  const size = 13;
  ctx.strokeStyle = osSkin === "windows8"
    ? ensurePreviewLineContrast(
      windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? "rgb(142, 142, 142)",
      "rgb(255, 255, 255)",
      "rgb(142, 142, 142)"
    )
    : "rgb(142, 142, 142)";
  ctx.fillStyle = "rgb(255, 255, 255)";
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2 - 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (checked) {
    ctx.fillStyle = osSkin === "windows8" ? "rgb(49, 106, 197)" : "rgb(0, 0, 0)";
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCheckableGadgetChrome(
  ctx: CanvasRenderingContext2D,
  g: Gadget,
  x: number,
  y: number,
  w: number,
  h: number,
  kind: "checkbox" | "option",
  osSkin: DesignerSettings["osSkin"],
  windowsSkinColors?: WindowsSkinSystemColors | null
) {
  const checked = Boolean(g.state);
  const textColor = pbColorNumberToCssHex(g.frontColor) ?? getPreviewGadgetDefaultTextColor(windowsSkinColors);
  const label = getPreviewGadgetText(g);
  const image = getPreviewCheckableImage(kind, osSkin, checked);
  const fallbackWidth = kind === "option" ? 16 : 14;
  const fallbackHeight = kind === "option" ? 17 : 15;
  const imageWidth = image && image.complete && image.naturalWidth > 0 ? image.naturalWidth : fallbackWidth;
  const imageHeight = image && image.complete && image.naturalHeight > 0 ? image.naturalHeight : fallbackHeight;
  const markX = x;
  const markY = y + Math.trunc((h - imageHeight) / 2);
  const textX = x + (kind === "option" ? 19 : 17);
  const textY = getPreviewCheckableTextY(kind, y, h);

  ctx.save();
  ctx.textBaseline = "top";

  if (!drawPreviewRasterIcon(ctx, image, markX, markY, imageWidth, imageHeight)) {
    drawCheckableGadgetFallbackMark(ctx, kind, checked, markX, markY, osSkin, windowsSkinColors);
  }

  if (label.length > 0) {
    const textStyle = applyPreviewGadgetTextStyle(ctx, g, 12);
    ctx.fillStyle = textColor;
    ctx.fillText(label, textX, textY);
    drawPreviewTextDecorations(ctx, label, textX, textY, textStyle, textColor);
  }

  ctx.restore();
}

function drawDateGadgetChrome(
  ctx: CanvasRenderingContext2D,
  g: Gadget,
  x: number,
  y: number,
  w: number,
  h: number,
  osSkin: DesignerSettings["osSkin"],
  windowsSkinColors?: WindowsSkinSystemColors | null
) {
  const fillColor = pbColorNumberToCssHex(g.backColor) ?? getPreviewGadgetDefaultClientBg(windowsSkinColors);
  const textColor = pbColorNumberToCssHex(g.frontColor) ?? getPreviewGadgetDefaultTextColor(windowsSkinColors);
  const label = getPreviewGadgetText(g);

  ctx.save();
  ctx.textBaseline = "top";

  if (osSkin === "windows7" || osSkin === "windows8") {
    const arrowLayout = getPreviewDateArrowLayout({ x, y, width: w, height: h, osSkin });

    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, Math.max(0, w), Math.max(0, h));
    ctx.strokeStyle = ensurePreviewLineContrast(
      windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? "rgb(150, 150, 150)",
      fillColor,
      "rgb(150, 150, 150)"
    );
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
    if (arrowLayout.kind === "rasterDown") {
      const arrowImage = getPreviewComboArrowImage(arrowLayout.assetKind);
      const drewRasterArrow = drawPreviewRasterIcon(
        ctx,
        arrowImage,
        arrowLayout.x,
        arrowLayout.y,
        arrowLayout.width,
        arrowLayout.height
      );
      if (!drewRasterArrow) {
        drawComboDropArrow(ctx, arrowLayout.fallbackCenterX, arrowLayout.fallbackCenterY, textColor);
      }
    } else {
      drawComboDropArrow(ctx, arrowLayout.centerX, arrowLayout.centerY, textColor);
    }
    if (label.length > 0) {
      const textStyle = applyPreviewGadgetTextStyle(ctx, g, 12);
      const textHeight = measurePreviewTextHeight(ctx, label, textStyle.sizePx);
      const textY = getPreviewDateTextY(y, h, textHeight);
      ctx.fillStyle = textColor;
      ctx.fillText(label, x + 3, textY);
      drawPreviewTextDecorations(ctx, label, x + 3, textY, textStyle, textColor);
    }
    ctx.restore();
    return;
  }

  const iconImage = getPreviewDateIconImage();
  const iconWidth = iconImage && iconImage.complete && iconImage.naturalWidth > 0 ? iconImage.naturalWidth : 21;
  const iconHeight = iconImage && iconImage.complete && iconImage.naturalHeight > 0 ? iconImage.naturalHeight : 22;
  const bodyWidth = Math.max(0, w - 27);

  ctx.strokeStyle = "rgb(165, 165, 165)";
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, bodyWidth - 1), Math.max(0, h - 1));
  ctx.strokeStyle = "rgb(227, 227, 227)";
  ctx.beginPath();
  ctx.moveTo(x + 1.5, y + 1.5);
  ctx.lineTo(x + bodyWidth - 1.5, y + 1.5);
  ctx.stroke();
  ctx.strokeStyle = "rgb(245, 245, 245)";
  ctx.beginPath();
  ctx.moveTo(x + 1.5, y + 2.5);
  ctx.lineTo(x + bodyWidth - 1.5, y + 2.5);
  ctx.moveTo(x + 1.5, y + 2.5);
  ctx.lineTo(x + 1.5, y + h - 1.5);
  ctx.moveTo(x + bodyWidth - 1.5, y + 2.5);
  ctx.lineTo(x + bodyWidth - 1.5, y + h - 1.5);
  ctx.stroke();

  ctx.fillStyle = fillColor;
  ctx.fillRect(x + 2, y + 3, Math.max(0, bodyWidth - 4), Math.max(0, h - 4));

  if (label.length > 0) {
    const textStyle = applyPreviewGadgetTextStyle(ctx, g, 12);
    const textHeight = measurePreviewTextHeight(ctx, label, textStyle.sizePx);
    const textY = getPreviewDateTextY(y, h, textHeight);
    ctx.fillStyle = textColor;
    ctx.fillText(label, x + 3, textY);
    drawPreviewTextDecorations(ctx, label, x + 3, textY, textStyle, textColor);
  }

  if (!drawPreviewRasterIcon(ctx, iconImage, x + w - 21, y + Math.trunc((h - iconHeight) / 2), iconWidth, iconHeight)) {
    const fallbackY = y + Math.trunc((h - 18) / 2);
    ctx.strokeStyle = "rgb(128, 128, 128)";
    ctx.strokeRect(x + w - 20.5, fallbackY + 0.5, 17, 17);
    ctx.fillStyle = "rgb(222, 79, 79)";
    ctx.fillRect(x + w - 20, fallbackY + 1, 16, 4);
  }

  ctx.restore();
}

function drawCalendarGadgetChrome(
  ctx: CanvasRenderingContext2D,
  g: Gadget,
  x: number,
  y: number,
  w: number,
  h: number,
  windowsSkinColors?: WindowsSkinSystemColors | null
) {
  const fillColor = pbColorNumberToCssHex(g.backColor) ?? getPreviewGadgetDefaultClientBg(windowsSkinColors);
  const textColor = pbColorNumberToCssHex(g.frontColor) ?? getPreviewGadgetDefaultTextColor(windowsSkinColors);
  const label = "Calendar Gadget";

  ctx.save();
  ctx.textBaseline = "top";
  ctx.fillStyle = fillColor;
  ctx.fillRect(x, y, Math.max(0, w), Math.max(0, h));
  ctx.strokeStyle = "rgb(0, 0, 0)";
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
  const textStyle = applyPreviewGadgetTextStyle(ctx, g, 12);
  ctx.fillStyle = textColor;
  ctx.fillText(label, x + 3, y + 3);
  drawPreviewTextDecorations(ctx, label, x + 3, y + 3, textStyle, textColor);
  ctx.restore();
}

function drawCanvasLikeGadgetChrome(
  ctx: CanvasRenderingContext2D,
  g: Gadget,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string
) {
  ctx.save();
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgb(237, 237, 237)";
  ctx.fillRect(x, y, Math.max(0, w), Math.max(0, h));
  ctx.strokeStyle = "rgb(0, 0, 0)";
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
  const textStyle = applyPreviewGadgetTextStyle(ctx, g, 12);
  ctx.fillStyle = "rgb(0, 0, 0)";
  ctx.fillText(label, x + 3, y + 3);
  drawPreviewTextDecorations(ctx, label, x + 3, y + 3, textStyle, "rgb(0, 0, 0)");
  ctx.restore();
}

function drawWebLikeGadgetChrome(
  ctx: CanvasRenderingContext2D,
  g: Gadget,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string
) {
  ctx.save();
  ctx.textBaseline = "top";
  ctx.strokeStyle = "rgb(194, 194, 194)";
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
  ctx.fillStyle = "rgb(255, 255, 255)";
  ctx.fillRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2));
  const textStyle = applyPreviewGadgetTextStyle(ctx, g, 12);
  ctx.fillStyle = "rgb(0, 0, 0)";
  ctx.fillText(label, x + 3, y + 3);
  drawPreviewTextDecorations(ctx, label, x + 3, y + 3, textStyle, "rgb(0, 0, 0)");
  ctx.restore();
}

function drawImageGadgetChrome(
  ctx: CanvasRenderingContext2D,
  g: Gadget,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.save();
  ctx.textBaseline = "top";
  const imageEntry = findImageEntryById(g.imageId);
  const previewImage = getResolvedPreviewImage(resolvePreviewImageSrc(imageEntry));
  if (!drawResolvedPreviewImage(ctx, previewImage, x, y, w, h)) {
    const textStyle = applyPreviewGadgetTextStyle(ctx, g, 12);
    ctx.fillStyle = "rgb(0, 0, 0)";
    ctx.fillText(GADGET_KIND.ImageGadget, x, y);
    drawPreviewTextDecorations(ctx, GADGET_KIND.ImageGadget, x, y, textStyle, "rgb(0, 0, 0)");
  }
  ctx.restore();
}

function drawButtonImageGadgetChrome(
  ctx: CanvasRenderingContext2D,
  g: Gadget,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.save();
  ctx.strokeStyle = "rgb(165, 165, 165)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
  const gradient = ctx.createLinearGradient(x + 1, y + 1, x + 1, y + h - 1);
  gradient.addColorStop(0, "rgb(250, 250, 250)");
  gradient.addColorStop(1, "rgb(239, 239, 239)");
  ctx.fillStyle = gradient;
  ctx.fillRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2));

  const imageEntry = findImageEntryById(g.imageId);
  const previewImage = getResolvedPreviewImage(resolvePreviewImageSrc(imageEntry));
  drawResolvedPreviewImage(ctx, previewImage, x, y, w, h);
  ctx.restore();
}

function drawCustomGadgetChrome(
  ctx: CanvasRenderingContext2D,
  g: Gadget,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const fillColor = pbColorNumberToCssHex(g.backColor) ?? "rgb(237, 237, 237)";

  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgb(130, 130, 130)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
  ctx.restore();
}

function drawComboLikeGadgetChrome(
  ctx: CanvasRenderingContext2D,
  g: Gadget,
  x: number,
  y: number,
  w: number,
  h: number,
  osSkin: DesignerSettings["osSkin"],
  windowsSkinColors?: WindowsSkinSystemColors | null
) {
  const isEditable = hasPbFlag(g.flagsExpr, "#PB_ComboBox_Editable");
  const fillColor = pbColorNumberToCssHex(g.backColor) ?? getPreviewGadgetDefaultClientBg(windowsSkinColors);
  const textColor = pbColorNumberToCssHex(g.frontColor) ?? getPreviewGadgetDefaultTextColor(windowsSkinColors);
  const itemLabel = (g.items ?? []).map(getPreviewGadgetItemLabel).find((label) => label.length > 0) ?? "Item 1";
  const arrowColor = osSkin === "windows8"
    ? ensurePreviewLineContrast(
      windowsSkinColors?.buttonText ?? textColor,
      windowsSkinColors?.buttonFace ?? fillColor,
      "rgb(0, 0, 0)"
    )
    : textColor;

  ctx.save();
  ctx.textBaseline = "top";

  const comboChromeHeight = getPreviewComboChromeHeight(osSkin, h, isEditable);

  if (isEditable) {
    const borderColor = osSkin === "windows8"
      ? ensurePreviewLineContrast(
        windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? "rgb(150, 150, 150)",
        fillColor,
        "rgb(150, 150, 150)"
      )
      : (osSkin === "windows7"
        ? ensurePreviewLineContrast(
          windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? "rgb(150, 150, 150)",
          fillColor,
          "rgb(150, 150, 150)"
        )
        : "rgb(150, 150, 150)");
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, Math.max(0, w), Math.max(0, h));
    ctx.strokeStyle = borderColor;
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
  } else if (osSkin === "windows7") {
    const baseControlColor = getPreviewGadgetDefaultControlBg(osSkin, windowsSkinColors);
    const topFill = mixCssRgb(baseControlColor, "rgb(255, 255, 255)", 0.18);
    const bottomFill = mixCssRgb(baseControlColor, "rgb(0, 0, 0)", 0.12);
    const outerBorder = ensurePreviewLineContrast(
      windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? "rgb(111, 111, 111)",
      bottomFill,
      "rgb(111, 111, 111)"
    );
    const innerBorder = mixCssRgb(baseControlColor, "rgb(255, 255, 255)", 0.65);
    const gradient = ctx.createLinearGradient(x + 1, y + 1, x + 1, y + Math.max(1, h - 2));
    gradient.addColorStop(0, topFill);
    gradient.addColorStop(0.45, topFill);
    gradient.addColorStop(0.46, bottomFill);
    gradient.addColorStop(1, bottomFill);
    const radius = Math.max(2, Math.min(4, Math.trunc(Math.min(w, h) / 6)));

    traceRoundedRect(ctx, x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2), radius);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = innerBorder;
    ctx.stroke();

    traceRoundedRect(ctx, x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1), radius);
    ctx.strokeStyle = outerBorder;
    ctx.stroke();
  } else if (osSkin === "windows8") {
    const topFill = windowsSkinColors?.buttonFace ?? "rgb(240, 240, 240)";
    const bottomFill = mixCssRgb(topFill, "rgb(0, 0, 0)", 0.05);
    const gradient = ctx.createLinearGradient(x + 1, y + 1, x + 1, y + Math.max(1, h - 2));
    gradient.addColorStop(0, topFill);
    gradient.addColorStop(1, bottomFill);
    ctx.fillStyle = gradient;
    ctx.fillRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2));
    ctx.strokeStyle = ensurePreviewLineContrast(
      windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? "rgb(172, 172, 172)",
      topFill,
      "rgb(172, 172, 172)"
    );
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
  } else if (osSkin === "macos") {
    const radius = 3;
    const chromeHeight = Math.max(0, comboChromeHeight);
    const gradient = ctx.createLinearGradient(x + 1, y + 1, x + 1, y + 10);
    gradient.addColorStop(0, "rgb(244, 244, 244)");
    gradient.addColorStop(1, "rgb(255, 255, 255)");
    ctx.fillStyle = gradient;
    ctx.fillRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, Math.min(10, chromeHeight - 2)));
    ctx.fillStyle = "rgb(236, 236, 236)";
    ctx.fillRect(x + 1, y + 11, Math.max(0, w - 2), Math.max(0, Math.min(9, chromeHeight - 12)));
    traceRoundedRect(ctx, x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, chromeHeight - 1), radius);
    ctx.strokeStyle = "rgb(144, 144, 144)";
    ctx.stroke();
  } else {
    const radius = Math.max(2, Math.min(4, Math.trunc(Math.min(w, h) / 6)));
    const gradient = ctx.createLinearGradient(x + 1, y + 1, x + 1, y + Math.max(1, h - 2));
    gradient.addColorStop(0, "rgb(235, 235, 235)");
    gradient.addColorStop(0.45, "rgb(235, 235, 235)");
    gradient.addColorStop(0.46, "rgb(211, 211, 211)");
    gradient.addColorStop(1, "rgb(211, 211, 211)");

    traceRoundedRect(ctx, x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2), radius);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = "rgb(250, 250, 250)";
    ctx.stroke();

    traceRoundedRect(ctx, x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1), radius);
    ctx.strokeStyle = "rgb(111, 111, 111)";
    ctx.stroke();
  }

  const comboArrowLayout = getPreviewComboArrowLayout({ x, y, width: w, height: h, osSkin, isEditable });
  if (comboArrowLayout.kind === "macDoubleArrows") {
    if (!drawPreviewRasterIcon(
      ctx,
      getPreviewMacComboDoubleArrowsImage(),
      comboArrowLayout.x,
      comboArrowLayout.y,
      comboArrowLayout.width,
      comboArrowLayout.height
    )) {
      drawMacComboDoubleArrows(ctx, comboArrowLayout.x, comboArrowLayout.y, arrowColor);
    }
  } else if (comboArrowLayout.kind === "rasterDown") {
    if (!drawPreviewRasterIcon(
      ctx,
      getPreviewComboArrowImage(comboArrowLayout.assetKind),
      comboArrowLayout.x,
      comboArrowLayout.y,
      comboArrowLayout.width,
      comboArrowLayout.height
    )) {
      drawComboDropArrow(ctx, comboArrowLayout.fallbackCenterX, comboArrowLayout.fallbackCenterY, arrowColor);
    }
  } else {
    drawComboDropArrow(ctx, comboArrowLayout.centerX, comboArrowLayout.centerY, arrowColor);
  }
  const textStyle = applyPreviewGadgetTextStyle(ctx, g, 12);
  const textHeight = measurePreviewTextHeight(ctx, " ", textStyle.sizePx);
  const textX = getPreviewComboTextX({ x, isEditable, osSkin });
  const textY = getPreviewComboTextY({ y, height: h, textHeight, isEditable, osSkin });
  ctx.fillStyle = textColor;
  ctx.fillText(itemLabel, textX, textY);
  drawPreviewTextDecorations(ctx, itemLabel, textX, textY, textStyle, textColor);
  ctx.restore();
}

function measurePreviewTextHeight(ctx: CanvasRenderingContext2D, text: string, fallbackHeight: number): number {
  const metrics = ctx.measureText(text.length > 0 ? text : " ");
  const measuredHeight = Math.ceil((metrics.actualBoundingBoxAscent ?? 0) + (metrics.actualBoundingBoxDescent ?? 0));
  return measuredHeight > 0 ? measuredHeight : fallbackHeight;
}

function drawSpinSpinnerFallback(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  osSkin: DesignerSettings["osSkin"],
  textColor: string,
  fillColor: string,
  windowsSkinColors?: WindowsSkinSystemColors | null
) {
  const spinnerWidth = osSkin === "windows8" ? 18 : 20;
  const bodyWidth = Math.max(0, w - spinnerWidth);
  const dividerX = x + bodyWidth;
  ctx.strokeStyle = osSkin === "windows8"
    ? ensurePreviewLineContrast(
      windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? "rgb(171, 173, 179)",
      fillColor,
      "rgb(171, 173, 179)"
    )
    : "rgb(180, 180, 180)";
  ctx.beginPath();
  ctx.moveTo(dividerX + 0.5, y + 0.5);
  ctx.lineTo(dividerX + 0.5, y + h - 0.5);
  ctx.moveTo(dividerX + 0.5, y + Math.trunc(h / 2) + 0.5);
  ctx.lineTo(x + w - 0.5, y + Math.trunc(h / 2) + 0.5);
  ctx.stroke();

  const arrowColor = osSkin === "windows8"
    ? ensurePreviewLineContrast(
      windowsSkinColors?.buttonText ?? textColor,
      windowsSkinColors?.buttonFace ?? fillColor,
      "rgb(0, 0, 0)"
    )
    : textColor;
  ctx.fillStyle = arrowColor;
  ctx.beginPath();
  ctx.moveTo(x + bodyWidth + spinnerWidth / 2 - 4, y + Math.max(4, Math.trunc(h / 4)) + 2);
  ctx.lineTo(x + bodyWidth + spinnerWidth / 2 + 4, y + Math.max(4, Math.trunc(h / 4)) + 2);
  ctx.lineTo(x + bodyWidth + spinnerWidth / 2, y + Math.max(4, Math.trunc(h / 4)) - 2);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x + bodyWidth + spinnerWidth / 2 - 4, y + Math.trunc((3 * h) / 4) - 2);
  ctx.lineTo(x + bodyWidth + spinnerWidth / 2 + 4, y + Math.trunc((3 * h) / 4) - 2);
  ctx.lineTo(x + bodyWidth + spinnerWidth / 2, y + Math.trunc((3 * h) / 4) + 2);
  ctx.closePath();
  ctx.fill();
}

function drawSpinGadgetChrome(
  ctx: CanvasRenderingContext2D,
  g: Gadget,
  x: number,
  y: number,
  w: number,
  h: number,
  osSkin: DesignerSettings["osSkin"],
  windowsSkinColors?: WindowsSkinSystemColors | null
) {
  const fillColor = pbColorNumberToCssHex(g.backColor) ?? getPreviewGadgetDefaultClientBg(windowsSkinColors);
  const textColor = pbColorNumberToCssHex(g.frontColor) ?? getPreviewGadgetDefaultTextColor(windowsSkinColors);
  const label = getPreviewGadgetText(g, GADGET_KIND.SpinGadget);
  const layout = getPreviewSpinButtonLayout({ x, y, width: w, height: h, osSkin });

  ctx.save();
  ctx.textBaseline = "top";

  if (osSkin === "windows8") {
    const borderColor = ensurePreviewLineContrast(
      windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? "rgb(171, 173, 179)",
      fillColor,
      "rgb(171, 173, 179)"
    );
    ctx.strokeStyle = borderColor;
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, layout.bodyWidth - 0.5), Math.max(0, h - 1));
    ctx.fillStyle = fillColor;
    ctx.fillRect(x + 1, y + 1, Math.max(0, layout.bodyWidth - 2), Math.max(0, h - 2));
  } else {
    const outerBorder = osSkin === "windows7"
      ? ensurePreviewLineContrast(
        windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? "rgb(165, 165, 165)",
        fillColor,
        "rgb(165, 165, 165)"
      )
      : "rgb(165, 165, 165)";
    ctx.strokeStyle = outerBorder;
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, layout.bodyWidth - 0.5), Math.max(0, h - 1));
    ctx.strokeStyle = "rgb(227, 227, 227)";
    ctx.beginPath();
    ctx.moveTo(x + 1.5, y + 1.5);
    ctx.lineTo(x + layout.bodyWidth - 1.5, y + 1.5);
    ctx.stroke();
    ctx.strokeStyle = "rgb(245, 245, 245)";
    ctx.beginPath();
    ctx.moveTo(x + 1.5, y + 2.5);
    ctx.lineTo(x + layout.bodyWidth - 1.5, y + 2.5);
    ctx.moveTo(x + 1.5, y + 2.5);
    ctx.lineTo(x + 1.5, y + h - 2.5);
    ctx.moveTo(x + layout.bodyWidth - 2.5, y + 2.5);
    ctx.lineTo(x + layout.bodyWidth - 2.5, y + h - 2.5);
    ctx.stroke();
    ctx.fillStyle = fillColor;
    ctx.fillRect(x + 2, y + 3, Math.max(0, layout.bodyWidth - 4), Math.max(0, h - 4));
  }

  const spinImage = getPreviewSpinImage(osSkin);
  const spinDrawn = drawPreviewRasterIcon(ctx, spinImage, layout.imageX, layout.imageY, layout.imageWidth, layout.imageHeight);
  if (!spinDrawn) {
    if (osSkin === "windows8") {
      const borderColor = ensurePreviewLineContrast(
        windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? "rgb(171, 173, 179)",
        fillColor,
        "rgb(171, 173, 179)"
      );
      ctx.fillStyle = windowsSkinColors?.buttonFace ?? "rgb(240, 240, 240)";
      ctx.fillRect(layout.imageX, layout.imageY, Math.max(0, layout.imageWidth), Math.max(0, layout.imageHeight));
      ctx.strokeStyle = borderColor;
      ctx.strokeRect(layout.imageX + 0.5, layout.imageY + 0.5, Math.max(0, layout.imageWidth - 1), Math.max(0, layout.imageHeight - 1));
    } else {
      ctx.strokeStyle = osSkin === "windows7"
        ? ensurePreviewLineContrast(
          windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? "rgb(165, 165, 165)",
          fillColor,
          "rgb(165, 165, 165)"
        )
        : "rgb(165, 165, 165)";
      ctx.strokeRect(x + layout.bodyWidth + 0.5, y + 0.5, Math.max(0, w - layout.bodyWidth - 1), Math.max(0, h - 1));
      ctx.fillStyle = osSkin === "macos" ? "rgb(236, 236, 236)" : "rgb(240, 240, 240)";
      ctx.fillRect(x + layout.bodyWidth + 1, y + 1, Math.max(0, w - layout.bodyWidth - 2), Math.max(0, h - 2));
    }
    drawSpinSpinnerFallback(ctx, x, y, w, h, osSkin, textColor, fillColor, windowsSkinColors);
  }

  const textStyle = applyPreviewGadgetTextStyle(ctx, g, 12);
  const textHeight = measurePreviewTextHeight(ctx, label, textStyle.sizePx);
  const textY = getPreviewSpinTextY(y, h, textHeight);
  ctx.fillStyle = textColor;
  ctx.fillText(label, x + 3, textY);
  drawPreviewTextDecorations(ctx, label, x + 3, textY, textStyle, textColor);
  ctx.restore();
}

function drawProgressBarGadgetChrome(
  ctx: CanvasRenderingContext2D,
  g: Gadget,
  x: number,
  y: number,
  w: number,
  h: number,
  osSkin: DesignerSettings["osSkin"],
  windowsSkinColors?: WindowsSkinSystemColors | null
) {
  const defaultTrackColor = osSkin === "windows8" ? "rgb(230, 230, 230)" : "rgb(220, 220, 220)";
  const defaultFillColor = osSkin === "windows8" ? "rgb(6, 176, 37)" : "rgb(134, 206, 244)";
  const trackColor = pbColorNumberToCssHex(g.backColor) ?? defaultTrackColor;
  const fillColor = pbColorNumberToCssHex(g.frontColor) ?? defaultFillColor;
  const isVertical = hasPbFlag(g.flagsExpr, "#PB_ProgressBar_Vertical");

  ctx.save();
  ctx.textBaseline = "top";

  if (osSkin === "windows8") {
    ctx.fillStyle = trackColor;
    ctx.fillRect(x, y, Math.max(0, w), Math.max(0, h));
    ctx.fillStyle = fillColor;
    if (isVertical) {
      ctx.fillRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, Math.trunc(h / 2) - 2));
    } else {
      ctx.fillRect(x + 1, y + 1, Math.max(0, Math.trunc(w / 2) - 2), Math.max(0, h - 2));
    }
    ctx.strokeStyle = ensurePreviewLineContrast(
      windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? "rgb(188, 188, 188)",
      trackColor,
      "rgb(188, 188, 188)"
    );
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
  } else {
    const radius = Math.max(2, Math.min(3, Math.trunc(Math.min(w, h) / 6)));
    traceRoundedRect(ctx, x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1), radius);
    ctx.fillStyle = trackColor;
    ctx.fill();
    ctx.strokeStyle = "rgb(152, 152, 152)";
    ctx.stroke();

    ctx.save();
    traceRoundedRect(ctx, x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1), radius);
    ctx.clip();
    ctx.fillStyle = fillColor;
    if (isVertical) {
      ctx.fillRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, Math.trunc(h / 2) - 2));
    } else {
      ctx.fillRect(x + 1, y + 1, Math.max(0, Math.trunc(w / 2) - 2), Math.max(0, h - 2));
    }
    ctx.restore();
  }

  ctx.restore();
}

function drawFrameGadgetChrome(
  ctx: CanvasRenderingContext2D,
  g: Gadget,
  x: number,
  y: number,
  w: number,
  h: number,
  osSkin: DesignerSettings["osSkin"],
  windowsSkinColors?: WindowsSkinSystemColors | null
) {
  const caption = getPreviewGadgetText(g);
  const captionColor = pbColorNumberToCssHex(g.frontColor) ?? getPreviewGadgetDefaultTextColor(windowsSkinColors);
  const captionBgColor = getPreviewGadgetDefaultControlBg(osSkin, windowsSkinColors);
  const isSingle = hasPbFlag(g.flagsExpr, "#PB_Frame3D_Single");
  const isDouble = hasPbFlag(g.flagsExpr, "#PB_Frame3D_Double");
  const isFlat = hasPbFlag(g.flagsExpr, "#PB_Frame3D_Flat");
  const captionHeight = 12;
  const lineY = y + 9.5;

  ctx.save();
  ctx.textBaseline = "top";
  // const captionTextStyle = applyPreviewColumnHeaderTextStyle(ctx, 12); // The original PureBasic form editor uses a fixed font for the column headers 
  const captionTextStyle = applyPreviewGadgetTextStyle(ctx, g, 12);
  const captionBlankTextHeight = measurePreviewTextHeight(ctx, " ", captionTextStyle.sizePx);

  if (osSkin === "macos") {
    if (isSingle) {
      ctx.strokeStyle = "rgb(130, 130, 130)";
      ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
      ctx.restore();
      return;
    }

    if (isDouble) {
      ctx.strokeStyle = "rgb(130, 130, 130)";
      ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
      ctx.strokeStyle = "rgb(194, 194, 194)";
      ctx.strokeRect(x + 1.5, y + 1.5, Math.max(0, w - 3), Math.max(0, h - 3));
      ctx.restore();
      return;
    }

    if (isFlat) {
      ctx.strokeStyle = "rgb(0, 0, 0)";
      ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
      ctx.restore();
      return;
    }

    if (caption.length > 0) {
      ctx.fillStyle = captionColor;
      ctx.fillText(caption, x + 10, y);
      drawPreviewTextDecorations(ctx, caption, x + 10, y, captionTextStyle, captionColor);
    }

    const frameBodyOffsetY = getPreviewFrameMacBodyOffsetY(captionBlankTextHeight);
    traceRoundedRect(ctx, x + 1.5, y + frameBodyOffsetY + 1.5, Math.max(0, w - 3), Math.max(0, h - frameBodyOffsetY - 2), 3);
    ctx.strokeStyle = "rgb(222, 222, 222)";
    ctx.stroke();
    traceRoundedRect(ctx, x + 0.5, y + frameBodyOffsetY + 0.5, Math.max(0, w - 1), Math.max(0, h - frameBodyOffsetY), 3);
    ctx.strokeStyle = "rgb(200, 200, 200)";
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (isSingle) {
    ctx.strokeStyle = ensurePreviewLineContrast(
      windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? "rgb(160, 160, 160)",
      captionBgColor,
      "rgb(160, 160, 160)"
    );
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
    ctx.strokeStyle = "rgb(255, 255, 255)";
    ctx.beginPath();
    ctx.moveTo(x + 0.5, y + h - 0.5);
    ctx.lineTo(x + w + 0.5, y + h - 0.5);
    ctx.moveTo(x + w - 0.5, y + 0.5);
    ctx.lineTo(x + w - 0.5, y + h + 0.5);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (isDouble) {
    ctx.strokeStyle = ensurePreviewLineContrast(
      windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? "rgb(160, 160, 160)",
      captionBgColor,
      "rgb(160, 160, 160)"
    );
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
    ctx.strokeStyle = "rgb(255, 255, 255)";
    ctx.beginPath();
    ctx.moveTo(x + 0.5, y + h - 0.5);
    ctx.lineTo(x + w + 0.5, y + h - 0.5);
    ctx.moveTo(x + w - 0.5, y + 0.5);
    ctx.lineTo(x + w - 0.5, y + h + 0.5);
    ctx.stroke();

    ctx.strokeStyle = ensurePreviewLineContrast(
      windowsSkinColors?.buttonText ?? "rgb(105, 105, 105)",
      captionBgColor,
      "rgb(105, 105, 105)"
    );
    ctx.strokeRect(x + 1.5, y + 1.5, Math.max(0, w - 3), Math.max(0, h - 3));
    ctx.strokeStyle = "rgb(227, 227, 227)";
    ctx.beginPath();
    ctx.moveTo(x + 1.5, y + h - 1.5);
    ctx.lineTo(x + w - 1.5, y + h - 1.5);
    ctx.moveTo(x + w - 1.5, y + 1.5);
    ctx.lineTo(x + w - 1.5, y + h - 1.5);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (isFlat) {
    ctx.strokeStyle = ensurePreviewLineContrast(
      windowsSkinColors?.buttonText ?? "rgb(100, 100, 100)",
      captionBgColor,
      "rgb(100, 100, 100)"
    );
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
    ctx.restore();
    return;
  }

  const lineColor = ensurePreviewLineContrast(
    windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? "rgb(221, 221, 221)",
    captionBgColor,
    "rgb(221, 221, 221)"
  );
  const captionWidth = caption.length > 0 ? ctx.measureText(caption).width + 2 : 0;

  ctx.strokeStyle = lineColor;
  ctx.beginPath();
  ctx.moveTo(x + 0.5, y + 9.5);
  ctx.lineTo(x + 0.5, y + h - 0.5);
  ctx.moveTo(x + w - 0.5, y + 9.5);
  ctx.lineTo(x + w - 0.5, y + h - 0.5);
  ctx.moveTo(x + 0.5, y + h - 0.5);
  ctx.lineTo(x + w - 0.5, y + h - 0.5);
  if (captionWidth > 0) {
    ctx.moveTo(x + 0.5, lineY);
    ctx.lineTo(x + 8.5, lineY);
    ctx.moveTo(x + 10.5 + captionWidth, lineY);
    ctx.lineTo(x + w - 0.5, lineY);
  } else {
    ctx.moveTo(x + 0.5, lineY);
    ctx.lineTo(x + w - 0.5, lineY);
  }
  ctx.stroke();

  if (captionWidth > 0) {
    ctx.fillStyle = captionBgColor;
    ctx.fillRect(x + 8, y, captionWidth + 4, captionHeight);
    ctx.fillStyle = captionColor;
    ctx.fillText(caption, x + 10, y);
    drawPreviewTextDecorations(ctx, caption, x + 10, y, captionTextStyle, captionColor);
  }

  ctx.restore();
}

function drawTrackBarGadgetChrome(
  ctx: CanvasRenderingContext2D,
  g: Gadget,
  x: number,
  y: number,
  w: number,
  h: number,
  osSkin: DesignerSettings["osSkin"],
  windowsSkinColors?: WindowsSkinSystemColors | null
) {
  const isVertical = hasPbFlag(g.flagsExpr, "#PB_TrackBar_Vertical");
  const showTicks = hasPbFlag(g.flagsExpr, "#PB_TrackBar_Ticks");
  const trackFill = osSkin === "windows8"
    ? (windowsSkinColors?.buttonFace ?? "rgb(231, 231, 231)")
    : (osSkin === "macos" ? null : "rgb(231, 231, 231)");
  const trackBorder = osSkin === "windows8"
    ? ensurePreviewLineContrast(
      windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? "rgb(176, 176, 176)",
      trackFill ?? "rgb(231, 231, 231)",
      "rgb(176, 176, 176)"
    )
    : (osSkin === "macos" ? "rgb(116, 116, 116)" : "rgb(176, 176, 176)");
  const trackContrastBase = trackFill ?? "rgb(231, 231, 231)";
  const tickColor = osSkin === "windows8"
    ? ensurePreviewLineContrast(
      windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? "rgb(154, 154, 154)",
      trackContrastBase,
      "rgb(154, 154, 154)"
    )
    : "rgb(154, 154, 154)";
  const thumbFill = osSkin === "windows8"
    ? mixCssRgb(windowsSkinColors?.buttonFace ?? "rgb(240, 240, 240)", "rgb(0, 0, 0)", 0.04)
    : (osSkin === "macos" ? "rgb(237, 237, 237)" : "rgb(240, 240, 240)");
  const thumbBorder = osSkin === "windows8"
    ? ensurePreviewLineContrast(
      windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? "rgb(161, 161, 161)",
      thumbFill,
      "rgb(161, 161, 161)"
    )
    : "rgb(161, 161, 161)";

  ctx.save();
  const thumbAssetLayout = getPreviewTrackBarThumbAssetLayout({ x, y, osSkin, isVertical });
  const macGrooveHighlightLines = getPreviewTrackBarMacGrooveHighlightLines({ x, y, width: w, height: h, osSkin, isVertical });
  const noTicksFillRect = !showTicks
    ? getPreviewTrackBarNoTicksFillRect({ x, y, width: w, height: h, osSkin, isVertical })
    : null;

  if (isVertical) {
    traceRoundedRect(ctx, x + 3.5, y + 0.5, 5, Math.max(0, h - 1), 1);
    if (trackFill) {
      ctx.fillStyle = trackFill;
      ctx.fill();
    }
    ctx.strokeStyle = trackBorder;
    ctx.stroke();

    for (const line of macGrooveHighlightLines) {
      ctx.fillStyle = line.color;
      ctx.fillRect(line.x, line.y, line.w, line.h);
    }

    const thumbDrawn = thumbAssetLayout
      ? drawPreviewRasterIcon(
        ctx,
        getPreviewTrackBarThumbImage(thumbAssetLayout.assetKind),
        thumbAssetLayout.x,
        thumbAssetLayout.y,
        thumbAssetLayout.width,
        thumbAssetLayout.height
      )
      : false;

    if (!thumbDrawn) {
      const thumbH = Math.min(18, Math.max(12, Math.trunc(h / 5)));
      const thumbY = y + Math.max(0, Math.trunc((h - thumbH) / 2));
      if (osSkin === "windows8") {
        ctx.fillStyle = thumbFill;
        ctx.fillRect(x + 0.5, thumbY + 0.5, 16, thumbH);
        ctx.strokeStyle = thumbBorder;
        ctx.strokeRect(x + 0.5, thumbY + 0.5, 16, thumbH);
      } else {
        traceRoundedRect(ctx, x + 0.5, thumbY + 0.5, 16, thumbH, 2);
        ctx.fillStyle = thumbFill;
        ctx.fill();
        ctx.strokeStyle = thumbBorder;
        ctx.stroke();
      }
    }

    if (showTicks) {
      for (let tickY = y + 9; tickY <= y + h - 9; tickY += 8) {
        ctx.fillStyle = tickColor;
        ctx.fillRect(x + 17, tickY, 4, 1);
      }
    } else if (noTicksFillRect) {
      ctx.fillStyle = "rgb(114, 114, 114)";
      ctx.fillRect(noTicksFillRect.x, noTicksFillRect.y, noTicksFillRect.w, noTicksFillRect.h);
    }
  } else {
    traceRoundedRect(ctx, x + 0.5, y + 3.5, Math.max(0, w - 1), 5, 1);
    if (trackFill) {
      ctx.fillStyle = trackFill;
      ctx.fill();
    }
    ctx.strokeStyle = trackBorder;
    ctx.stroke();

    for (const line of macGrooveHighlightLines) {
      ctx.fillStyle = line.color;
      ctx.fillRect(line.x, line.y, line.w, line.h);
    }

    const thumbDrawn = thumbAssetLayout
      ? drawPreviewRasterIcon(
        ctx,
        getPreviewTrackBarThumbImage(thumbAssetLayout.assetKind),
        thumbAssetLayout.x,
        thumbAssetLayout.y,
        thumbAssetLayout.width,
        thumbAssetLayout.height
      )
      : false;

    if (!thumbDrawn) {
      const thumbW = Math.min(18, Math.max(12, Math.trunc(w / 5)));
      const thumbX = x + Math.max(0, Math.trunc((w - thumbW) / 2));
      if (osSkin === "windows8") {
        ctx.fillStyle = thumbFill;
        ctx.fillRect(thumbX + 0.5, y + 0.5, thumbW, 16);
        ctx.strokeStyle = thumbBorder;
        ctx.strokeRect(thumbX + 0.5, y + 0.5, thumbW, 16);
      } else {
        traceRoundedRect(ctx, thumbX + 0.5, y + 0.5, thumbW, 16, 2);
        ctx.fillStyle = thumbFill;
        ctx.fill();
        ctx.strokeStyle = thumbBorder;
        ctx.stroke();
      }
    }

    if (showTicks) {
      for (let tickX = x + 9; tickX <= x + w - 9; tickX += 8) {
        ctx.fillStyle = tickColor;
        ctx.fillRect(tickX, y + 17, 1, 4);
      }
    } else if (noTicksFillRect) {
      ctx.fillStyle = "rgb(114, 114, 114)";
      ctx.fillRect(noTicksFillRect.x, noTicksFillRect.y, noTicksFillRect.w, noTicksFillRect.h);
    }
  }

  ctx.restore();
}

function drawScrollBarArrowGlyph(
  ctx: CanvasRenderingContext2D,
  direction: "up" | "down" | "left" | "right",
  centerX: number,
  centerY: number,
  color: string
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  if (direction === "up") {
    ctx.moveTo(centerX, centerY - 3);
    ctx.lineTo(centerX - 4, centerY + 2);
    ctx.lineTo(centerX + 4, centerY + 2);
  } else if (direction === "down") {
    ctx.moveTo(centerX, centerY + 3);
    ctx.lineTo(centerX - 4, centerY - 2);
    ctx.lineTo(centerX + 4, centerY - 2);
  } else if (direction === "left") {
    ctx.moveTo(centerX - 3, centerY);
    ctx.lineTo(centerX + 2, centerY - 4);
    ctx.lineTo(centerX + 2, centerY + 4);
  } else {
    ctx.moveTo(centerX + 3, centerY);
    ctx.lineTo(centerX - 2, centerY - 4);
    ctx.lineTo(centerX - 2, centerY + 4);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawScrollBarGadgetChrome(
  ctx: CanvasRenderingContext2D,
  g: Gadget,
  x: number,
  y: number,
  w: number,
  h: number,
  osSkin: DesignerSettings["osSkin"],
  windowsSkinColors?: WindowsSkinSystemColors | null
) {
  const isVertical = hasPbFlag(g.flagsExpr, "#PB_ScrollBar_Vertical");
  const trackColor = osSkin === "windows8"
    ? (windowsSkinColors?.buttonFace ?? "rgb(240, 240, 240)")
    : (osSkin === "macos" ? "rgb(250, 250, 250)" : "rgb(240, 240, 240)");
  const borderColor = osSkin === "windows8"
    ? ensurePreviewLineContrast(
      windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? "rgb(233, 233, 233)",
      trackColor,
      "rgb(233, 233, 233)"
    )
    : "rgb(233, 233, 233)";
  const thumbColor = osSkin === "windows8"
    ? mixCssRgb(trackColor, "rgb(0, 0, 0)", 0.15)
    : (osSkin === "macos" ? "rgb(195, 195, 195)" : "rgb(202, 202, 202)");
  const thumbHighlight = osSkin === "windows8" ? null : "rgb(236, 236, 236)";
  const arrowColor = osSkin === "windows8"
    ? ensurePreviewLineContrast(
      windowsSkinColors?.buttonText ?? windowsSkinColors?.windowText ?? "rgb(0, 0, 0)",
      trackColor,
      "rgb(0, 0, 0)"
    )
    : "rgb(110, 110, 110)";

  ctx.save();

  if (osSkin === "macos") {
    if (isVertical) {
      const bandX = x + 4;
      ctx.fillStyle = "rgb(228, 228, 228)";
      ctx.fillRect(x, y, 1, Math.max(0, h));
      ctx.fillStyle = "rgb(242, 242, 242)";
      ctx.fillRect(x + 1, y, 1, Math.max(0, h));
      ctx.fillStyle = "rgb(244, 244, 244)";
      ctx.fillRect(x + 2, y, 1, Math.max(0, h));
      ctx.fillStyle = "rgb(245, 245, 245)";
      ctx.fillRect(x + 3, y, 1, Math.max(0, h));
      ctx.fillStyle = trackColor;
      ctx.fillRect(bandX, y, 10, Math.max(0, h));
      traceRoundedRect(ctx, bandX + 0.5, y + 1.5, 8, Math.max(0, Math.trunc(h / 3)), 3);
      ctx.fillStyle = thumbColor;
      ctx.fill();
    } else {
      const bandY = y + 4;
      ctx.fillStyle = "rgb(228, 228, 228)";
      ctx.fillRect(x, y, Math.max(0, w), 1);
      ctx.fillStyle = "rgb(242, 242, 242)";
      ctx.fillRect(x, y + 1, Math.max(0, w), 1);
      ctx.fillStyle = "rgb(244, 244, 244)";
      ctx.fillRect(x, y + 2, Math.max(0, w), 1);
      ctx.fillStyle = "rgb(245, 245, 245)";
      ctx.fillRect(x, y + 3, Math.max(0, w), 1);
      ctx.fillStyle = trackColor;
      ctx.fillRect(x, bandY, Math.max(0, w), 10);
      traceRoundedRect(ctx, x + 1.5, bandY + 0.5, Math.max(0, Math.trunc(w / 3)), 8, 3);
      ctx.fillStyle = thumbColor;
      ctx.fill();
    }

    ctx.restore();
    return;
  }

  ctx.fillStyle = trackColor;
  ctx.fillRect(x, y, Math.max(0, w), Math.max(0, h));
  if (osSkin === "windows8") {
    ctx.strokeStyle = "rgb(255, 255, 255)";
    if (isVertical) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, y);
      ctx.lineTo(x + 0.5, y + h);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x, y + 0.5);
      ctx.lineTo(x + w, y + 0.5);
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = borderColor;
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
  }

  const arrowLayouts = getPreviewScrollBarArrowAssetLayouts({ x, y, width: w, height: h, osSkin, isVertical });

  if (isVertical) {
    for (const arrow of arrowLayouts) {
      const drawn = drawPreviewRasterIcon(
        ctx,
        getPreviewScrollBarArrowImage(arrow.assetKind),
        arrow.x,
        arrow.y,
        arrow.width,
        arrow.height
      );
      if (!drawn) {
        drawScrollBarArrowGlyph(ctx, arrow.direction, x + Math.trunc(w / 2), arrow.direction === "up" ? y + 8 : y + h - 8, arrowColor);
      }
    }
    if (osSkin === "windows8") {
      ctx.fillStyle = thumbColor;
      ctx.fillRect(x + 1, y + 17, Math.max(0, w - 1), Math.max(0, Math.trunc((h - 34) / 3)));
    } else {
      const thumbFillLayout = getPreviewScrollBarThumbFillLayout({ x, y, width: w, height: h, osSkin, isVertical: true });
      if (thumbFillLayout) {
        traceRoundedRect(ctx, thumbFillLayout.thumbRect.x + 0.5, thumbFillLayout.thumbRect.y + 0.5, thumbFillLayout.thumbRect.w, thumbFillLayout.thumbRect.h, 1);
        ctx.strokeStyle = "rgb(155, 155, 155)";
        ctx.stroke();
        ctx.save();
        traceRoundedRect(ctx, thumbFillLayout.thumbRect.x + 0.5, thumbFillLayout.thumbRect.y + 0.5, thumbFillLayout.thumbRect.w, thumbFillLayout.thumbRect.h, 1);
        ctx.clip();
        if (thumbHighlight) {
          ctx.fillStyle = thumbHighlight;
          ctx.fillRect(thumbFillLayout.lightRect.x, thumbFillLayout.lightRect.y, thumbFillLayout.lightRect.w, thumbFillLayout.lightRect.h);
        }
        ctx.fillStyle = thumbColor;
        ctx.fillRect(thumbFillLayout.darkRect.x, thumbFillLayout.darkRect.y, thumbFillLayout.darkRect.w, thumbFillLayout.darkRect.h);
        ctx.restore();
      }
    }
  } else {
    for (const arrow of arrowLayouts) {
      const drawn = drawPreviewRasterIcon(
        ctx,
        getPreviewScrollBarArrowImage(arrow.assetKind),
        arrow.x,
        arrow.y,
        arrow.width,
        arrow.height
      );
      if (!drawn) {
        drawScrollBarArrowGlyph(ctx, arrow.direction, arrow.direction === "left" ? x + 8 : x + w - 8, y + Math.trunc(h / 2), arrowColor);
      }
    }
    if (osSkin === "windows8") {
      ctx.fillStyle = thumbColor;
      ctx.fillRect(x + 17, y + 1, Math.max(0, Math.trunc((w - 34) / 3)), Math.max(0, h - 1));
    } else {
      const thumbFillLayout = getPreviewScrollBarThumbFillLayout({ x, y, width: w, height: h, osSkin, isVertical: false });
      if (thumbFillLayout) {
        traceRoundedRect(ctx, thumbFillLayout.thumbRect.x + 0.5, thumbFillLayout.thumbRect.y + 0.5, thumbFillLayout.thumbRect.w, thumbFillLayout.thumbRect.h, 1);
        ctx.strokeStyle = "rgb(155, 155, 155)";
        ctx.stroke();
        ctx.save();
        traceRoundedRect(ctx, thumbFillLayout.thumbRect.x + 0.5, thumbFillLayout.thumbRect.y + 0.5, thumbFillLayout.thumbRect.w, thumbFillLayout.thumbRect.h, 1);
        ctx.clip();
        if (thumbHighlight) {
          ctx.fillStyle = thumbHighlight;
          ctx.fillRect(thumbFillLayout.lightRect.x, thumbFillLayout.lightRect.y, thumbFillLayout.lightRect.w, thumbFillLayout.lightRect.h);
        }
        ctx.fillStyle = thumbColor;
        ctx.fillRect(thumbFillLayout.darkRect.x, thumbFillLayout.darkRect.y, thumbFillLayout.darkRect.w, thumbFillLayout.darkRect.h);
        ctx.restore();
      }
    }
  }

  ctx.restore();
}

function drawStringLikeGadgetChrome(
  ctx: CanvasRenderingContext2D,
  g: Gadget,
  x: number,
  y: number,
  w: number,
  h: number,
  osSkin: DesignerSettings["osSkin"],
  windowsSkinColors?: WindowsSkinSystemColors | null
) {
  const fillColor = pbColorNumberToCssHex(g.backColor) ?? getPreviewGadgetDefaultClientBg(windowsSkinColors);
  const textColor = pbColorNumberToCssHex(g.frontColor) ?? getPreviewGadgetDefaultTextColor(windowsSkinColors);
  const label = getPreviewGadgetText(g, g.kind === GADGET_KIND.IPAddressGadget ? "IPGadget" : GADGET_KIND.StringGadget);

  ctx.save();
  ctx.textBaseline = "top";

  if (osSkin === "windows8") {
    const borderColor = ensurePreviewLineContrast(
      (windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? "rgb(171, 173, 179)"),
      fillColor,
      "rgb(171, 173, 179)"
    );
    ctx.strokeStyle = borderColor;
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
    ctx.fillStyle = fillColor;
    ctx.fillRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2));
  } else {
    const borderColor = osSkin === "windows7"
      ? ensurePreviewLineContrast(
        (windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? "rgb(165, 165, 165)"),
        fillColor,
        "rgb(165, 165, 165)"
      )
      : "rgb(165, 165, 165)";
    ctx.strokeStyle = borderColor;
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
    ctx.strokeStyle = "rgb(227, 227, 227)";
    ctx.beginPath();
    ctx.moveTo(x + 1.5, y + 1.5);
    ctx.lineTo(x + w - 1.5, y + 1.5);
    ctx.stroke();
    ctx.strokeStyle = "rgb(245, 245, 245)";
    ctx.beginPath();
    ctx.moveTo(x + 1.5, y + 2.5);
    ctx.lineTo(x + w - 1.5, y + 2.5);
    ctx.moveTo(x + 1.5, y + 2.5);
    ctx.lineTo(x + 1.5, y + h - 2.5);
    ctx.moveTo(x + w - 2.5, y + 2.5);
    ctx.lineTo(x + w - 2.5, y + h - 2.5);
    ctx.stroke();
    ctx.fillStyle = fillColor;
    ctx.fillRect(x + 2, y + 3, Math.max(0, w - 4), Math.max(0, h - 4));
  }

  const textStyle = applyPreviewGadgetTextStyle(ctx, g, 12);
  const textHeight = measurePreviewTextHeight(ctx, label, textStyle.sizePx);
  const textY = getPreviewStringLikeTextY(y, h, textHeight);
  ctx.fillStyle = textColor;
  ctx.fillText(label, x + 3, textY);
  drawPreviewTextDecorations(ctx, label, x + 3, textY, textStyle, textColor);
  ctx.restore();
}

function drawTextLikeGadgetChrome(
  ctx: CanvasRenderingContext2D,
  g: Gadget,
  x: number,
  y: number,
  w: number,
  h: number,
  osSkin: DesignerSettings["osSkin"],
  windowsSkinColors?: WindowsSkinSystemColors | null
) {
  const isTextGadget = g.kind === GADGET_KIND.TextGadget;
  const label = getPreviewGadgetText(g, isTextGadget ? GADGET_KIND.TextGadget : GADGET_KIND.HyperLinkGadget);
  const textColor = pbColorNumberToCssHex(g.frontColor) ?? getPreviewGadgetDefaultTextColor(windowsSkinColors);
  const bgColor = pbColorNumberToCssHex(g.backColor) ?? getPreviewGadgetDefaultControlBg(osSkin, windowsSkinColors);

  ctx.save();
  ctx.textBaseline = "top";

  if (isTextGadget) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, Math.max(0, w), Math.max(0, h));
  }

  const textStyle = applyPreviewGadgetTextStyle(ctx, g, 12);
  const textWidth = ctx.measureText(label).width;
  const textPos = getPreviewTextLikeTextPosition({
    x,
    y,
    width: w,
    textWidth,
    flagsExpr: g.flagsExpr,
  });
  ctx.fillStyle = textColor;
  ctx.fillText(label, textPos.x, textPos.y);
  drawPreviewTextDecorations(ctx, label, textPos.x, textPos.y, textStyle, textColor);

  if (isTextGadget && hasPbFlag(g.flagsExpr, "#PB_Text_Border")) {
    ctx.strokeStyle = ensurePreviewLineContrast(
      (windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? "rgb(142, 142, 142)"),
      bgColor,
      "rgb(142, 142, 142)"
    );
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
  }

  ctx.restore();
}

function getPreviewGadgetItemLabel(item: GadgetItem): string {
  return item.text ?? unquotePbString(item.textRaw);
}

function drawListLikeGadgetChrome(
  ctx: CanvasRenderingContext2D,
  g: Gadget,
  x: number,
  y: number,
  w: number,
  h: number,
  variant: "tree" | "listview" | "editor" | "scintilla",
  windowsSkinColors?: WindowsSkinSystemColors | null
) {
  const fillColor = pbColorNumberToCssHex(g.backColor) ?? getPreviewGadgetDefaultClientBg(windowsSkinColors);
  const textColor = pbColorNumberToCssHex(g.frontColor) ?? getPreviewGadgetDefaultTextColor(windowsSkinColors);
  const originalBorderColor = (variant === "editor" || variant === "scintilla")
    ? "rgb(194, 194, 194)"
    : "rgb(142, 142, 142)";
  const borderColor = ensurePreviewLineContrast(
    windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? originalBorderColor,
    fillColor,
    originalBorderColor
  );
  const isTree = variant === "tree";
  const fallbackLabel = variant === "tree"
    ? GADGET_KIND.TreeGadget
    : variant === "listview"
      ? GADGET_KIND.ListViewGadget
      : variant === "scintilla"
        ? GADGET_KIND.ScintillaGadget
        : GADGET_KIND.EditorGadget;
  const itemX = x + (isTree ? 30 : 6);
  const placeholderX = x + 30;
  const rows = (g.items ?? []).map(getPreviewGadgetItemLabel);
  let textY = y + 4;
  const lastTextY = y + Math.max(0, h - 14);

  ctx.save();
  ctx.textBaseline = "top";
  ctx.strokeStyle = borderColor;
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
  ctx.fillStyle = fillColor;
  ctx.fillRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2));
  const textStyle = applyPreviewGadgetTextStyle(ctx, g, 12);
  const blankTextHeight = measurePreviewTextHeight(ctx, " ", textStyle.sizePx);
  const lineAdvance = getPreviewListRowAdvance(isTree ? "tree" : "listview", blankTextHeight);
  ctx.fillStyle = textColor;

  if (rows.length === 0) {
    ctx.fillText(fallbackLabel, placeholderX, y + 4);
    drawPreviewTextDecorations(ctx, fallbackLabel, placeholderX, y + 4, textStyle, textColor);
    ctx.restore();
    return;
  }

  for (const row of rows) {
    if (textY > lastTextY) break;
    ctx.fillText(row, itemX, textY);
    drawPreviewTextDecorations(ctx, row, itemX, textY, textStyle, textColor);
    textY += lineAdvance;
  }

  ctx.restore();
}

function parsePreviewInteger(raw?: string): number | null {
  const trimmed = (raw ?? "").trim();
  if (!/^[-+]?\d+$/.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function getPreviewGadgetColumnLabel(column: GadgetColumn): string {
  return column.title ?? unquotePbString(column.titleRaw);
}

function drawListIconLikeGadgetChrome(
  ctx: CanvasRenderingContext2D,
  g: Gadget,
  x: number,
  y: number,
  w: number,
  h: number,
  variant: "listicon" | "explorerlist",
  windowsSkinColors?: WindowsSkinSystemColors | null
) {
  const fillColor = pbColorNumberToCssHex(g.backColor) ?? getPreviewGadgetDefaultClientBg(windowsSkinColors);
  const textColor = pbColorNumberToCssHex(g.frontColor) ?? getPreviewGadgetDefaultTextColor(windowsSkinColors);
  const borderColor = ensurePreviewLineContrast(
    windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? "rgb(142, 142, 142)",
    fillColor,
    "rgb(142, 142, 142)"
  );
  const headerTopColor = windowsSkinColors?.window ?? "rgb(255, 255, 255)";
  const headerBottomColor = windowsSkinColors?.buttonFace ?? "rgb(244, 244, 244)";
  const headerBandColor = windowsSkinColors?.buttonFace ?? "rgb(236, 236, 236)";
  const headerHighlightColor = ensurePreviewLineContrast(
    mixCssRgb(headerTopColor, headerBottomColor, 0.35),
    headerBandColor,
    "rgb(244, 244, 244)",
    10
  );
  const headerShadowColor = ensurePreviewLineContrast(
    windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? "rgb(182, 182, 182)",
    headerBandColor,
    "rgb(182, 182, 182)",
    12
  );
  const headerTextColor = windowsSkinColors?.buttonText ?? "rgb(0, 0, 0)";
  const headerHeight = Math.min(Math.max(17, h), 17);
  const contentStartY = y + 20;
  const rows = variant === "explorerlist"
    ? ["File 1", "File 2"]
    : (g.items ?? []).map(getPreviewGadgetItemLabel);
  const columns = variant === "explorerlist"
    ? [{ label: "Files/Drawers", width: Math.max(0, w - 2) }]
    : (() => {
        const sourceCols = g.columns ?? [];
        if (sourceCols.length === 0) return [] as { label: string; width: number }[];

        const availableWidth = Math.max(0, w - 2);
        const parsedWidths = sourceCols.map((column) => Math.max(0, parsePreviewInteger(column.widthRaw) ?? 0));
        const explicitWidthSum = parsedWidths.reduce((sum, width) => sum + width, 0);
        const unresolvedCount = parsedWidths.filter((width) => width <= 0).length;
        const unresolvedWidth = unresolvedCount > 0
          ? Math.max(24, Math.trunc(Math.max(0, availableWidth - explicitWidthSum) / unresolvedCount))
          : 0;

        return sourceCols.map((column, index) => ({
          label: getPreviewGadgetColumnLabel(column),
          width: parsedWidths[index] > 0 ? parsedWidths[index] : unresolvedWidth
        }));
      })();

  ctx.save();
  ctx.textBaseline = "top";
  ctx.strokeStyle = borderColor;
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
  ctx.fillStyle = fillColor;
  ctx.fillRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2));

  const headerGradient = ctx.createLinearGradient(x + 1, y + 1, x + 1, y + 9);
  headerGradient.addColorStop(0, headerTopColor);
  headerGradient.addColorStop(1, headerBottomColor);
  ctx.fillStyle = headerGradient;
  ctx.fillRect(x + 1, y + 1, Math.max(0, w - 2), Math.min(8, Math.max(0, headerHeight - 1)));
  ctx.fillStyle = headerBandColor;
  ctx.fillRect(x + 1, y + 9, Math.max(0, w - 2), Math.max(0, Math.min(6, headerHeight - 8)));
  ctx.strokeStyle = headerHighlightColor;
  ctx.beginPath();
  ctx.moveTo(x + 1, y + 15.5);
  ctx.lineTo(x + Math.max(1, w - 1), y + 15.5);
  ctx.stroke();
  ctx.strokeStyle = headerShadowColor;
  ctx.beginPath();
  ctx.moveTo(x + 1, y + 16.5);
  ctx.lineTo(x + Math.max(1, w - 1), y + 16.5);
  ctx.stroke();

/*   const headerTextStyle = variant === "explorerlist"
  ? applyPreviewColumnHeaderTextStyle(ctx, 11)
  : applyPreviewGadgetTextStyle(ctx, g, 11); */ // /* The original PureBasic form editor uses a fixed font with 11px for explorerlist
  const headerTextStyle = applyPreviewGadgetTextStyle(ctx, g, 12);
  ctx.fillStyle = headerTextColor;

  if (columns.length > 0) {
    const headerTextY = getPreviewListHeaderTextY(variant, y);
    let xCol = x + 2;
    for (let index = 0; index < columns.length; index += 1) {
      const column = columns[index];
      const label = column.label ?? "";
      ctx.fillText(label, xCol + 2, headerTextY);
      drawPreviewTextDecorations(ctx, label, xCol + 2, headerTextY, headerTextStyle, headerTextColor);
      xCol += column.width;
      if (index < columns.length - 1 && xCol < x + w - 1) {
        ctx.strokeStyle = headerShadowColor;
        ctx.beginPath();
        ctx.moveTo(xCol + 0.5, y + 1);
        ctx.lineTo(xCol + 0.5, y + 16);
        ctx.stroke();
      }
    }
  }

  const textStyle = applyPreviewGadgetTextStyle(ctx, g, 12);
  const blankTextHeight = measurePreviewTextHeight(ctx, " ", textStyle.sizePx);
  const rowAdvance = getPreviewListRowAdvance(variant, blankTextHeight);
  ctx.fillStyle = textColor;

  let rowY = contentStartY;
  const rowBottom = y + Math.max(0, h - 14);
  for (const row of rows) {
    if (rowY > rowBottom) break;

    if (variant === "listicon" && row.includes("|") && columns.length > 0) {
      const fields = row.split("|");
      let xCol = x + 2;
      for (let index = 0; index < fields.length && index < columns.length; index += 1) {
        const fieldText = fields[index] ?? "";
        ctx.fillText(fieldText, xCol, rowY);
        drawPreviewTextDecorations(ctx, fieldText, xCol, rowY, textStyle, textColor);
        xCol += columns[index].width;
      }
    } else {
      ctx.fillText(row, x + 6, rowY);
      drawPreviewTextDecorations(ctx, row, x + 6, rowY, textStyle, textColor);
    }

    rowY += rowAdvance;
  }

  ctx.restore();
}

function drawExplorerTreeGadgetChrome(
  ctx: CanvasRenderingContext2D,
  g: Gadget,
  x: number,
  y: number,
  w: number,
  h: number,
  windowsSkinColors?: WindowsSkinSystemColors | null
) {
  const fillColor = pbColorNumberToCssHex(g.backColor) ?? getPreviewGadgetDefaultClientBg(windowsSkinColors);
  const textColor = pbColorNumberToCssHex(g.frontColor) ?? getPreviewGadgetDefaultTextColor(windowsSkinColors);
  const borderColor = ensurePreviewLineContrast(
    windowsSkinColors?.buttonShadow ?? windowsSkinColors?.threeDShadow ?? "rgb(142, 142, 142)",
    fillColor,
    "rgb(142, 142, 142)"
  );

  ctx.save();
  ctx.textBaseline = "top";
  ctx.strokeStyle = borderColor;
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
  ctx.fillStyle = fillColor;
  ctx.fillRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2));
  const textStyle = applyPreviewGadgetTextStyle(ctx, g, 12);
  ctx.fillStyle = textColor;
  ctx.fillText("Explorer Tree", x + 3, y + 3);
  drawPreviewTextDecorations(ctx, "Explorer Tree", x + 3, y + 3, textStyle, textColor);
  ctx.restore();
}

function drawPanelChrome(
  ctx: CanvasRenderingContext2D,
  g: Gadget,
  x: number,
  y: number,
  w: number,
  h: number,
  osSkin: DesignerSettings["osSkin"],
  metrics: PreviewChromeMetrics
) {
  const labels = (g.items ?? []).map((item, index) => (item.text ?? unquotePbString(item.textRaw)) || `Tab ${index + 1}`);
  const activeIndex = resolvePanelActiveItem(getPanelActiveItem(g), labels.length || 1);

  ctx.save();
  ctx.textBaseline = "top";
  const panelTextStyle = applyPreviewGadgetTextStyle(ctx, g, 12);

  if (osSkin === "macos") {
    const topOffset = 11;
    ctx.fillStyle = "rgb(231, 231, 231)";
    traceRoundedRect(ctx, x + 2, y + topOffset + 2, Math.max(0, w - 4), Math.max(0, h - topOffset - 4), 3);
    ctx.fill();
    ctx.strokeStyle = "rgb(222, 222, 222)";
    traceRoundedRect(ctx, x + 1.5, y + topOffset + 1.5, Math.max(0, w - 3), Math.max(0, h - topOffset - 3), 3);
    ctx.stroke();
    ctx.strokeStyle = "rgb(200, 200, 200)";
    traceRoundedRect(ctx, x + 0.5, y + topOffset + 0.5, Math.max(0, w - 1), Math.max(0, h - topOffset - 1), 3);
    ctx.stroke();

    if (labels.length > 0) {
      const widths = labels.map((label) => Math.ceil(ctx.measureText(label).width) + 24);
      const totalWidth = widths.reduce((sum, value) => sum + value, 0);
      let tabX = x + Math.trunc((w - totalWidth) / 2);

      const gradient = ctx.createLinearGradient(0, y + 1, 0, y + 10);
      gradient.addColorStop(0, "rgb(255, 255, 255)");
      gradient.addColorStop(1, "rgb(244, 244, 244)");
      ctx.fillStyle = gradient;
      ctx.fillRect(tabX + 1, y + 1, Math.max(0, totalWidth - 2), 10);
      ctx.fillStyle = "rgb(236, 236, 236)";
      ctx.fillRect(tabX + 1, y + 11, Math.max(0, totalWidth - 2), 9);
      ctx.strokeStyle = "rgb(144, 144, 144)";
      traceRoundedRect(ctx, tabX + 0.5, y + 0.5, Math.max(0, totalWidth - 1), 21, 3);
      ctx.stroke();

      for (let index = 0; index < labels.length; index += 1) {
        const label = labels[index];
        const tabWidth = widths[index];
        const active = index === activeIndex;
        const textWidth = Math.ceil(ctx.measureText(label).width);

        if (active) {
          ctx.fillStyle = "rgb(140, 140, 140)";
          traceRoundedRect(ctx, tabX - 11.5, y + 0.5, tabWidth - 1, 21, 3);
          ctx.fill();
          if (index > 0) {
            ctx.fillRect(tabX - 12, y, 3, 22);
          }
          if (index < labels.length - 1) {
            ctx.fillRect(tabX + textWidth + 9, y, 3, 22);
          }
          ctx.fillStyle = "rgb(255, 255, 255)";
        } else {
          if (index < labels.length - 1) {
            ctx.fillStyle = "rgb(189, 189, 189)";
            ctx.fillRect(tabX + textWidth + 12, y + 3, 1, 16);
          }
          ctx.fillStyle = "rgb(0, 0, 0)";
        }

        ctx.fillText(label, tabX, y + 3);
        drawPreviewTextDecorations(ctx, label, tabX, y + 3, panelTextStyle, active ? "rgb(255, 255, 255)" : "rgb(0, 0, 0)");
        tabX += tabWidth;
      }
    }

    ctx.restore();
    return;
  }

  if (osSkin === "linux") {
    const bodyTop = y + 28;
    ctx.strokeStyle = "rgb(184, 180, 176)";
    traceRoundedRect(ctx, x + 0.5, bodyTop + 0.5, Math.max(0, w - 1), Math.max(0, h - 29), 3);
    ctx.stroke();
    ctx.fillStyle = "rgb(247, 246, 246)";
    traceRoundedRect(ctx, x + 1.5, bodyTop + 1.5, Math.max(0, w - 3), Math.max(0, h - 31), 3);
    ctx.fill();
    ctx.fillRect(x + 1, bodyTop + 1, 3, 3);
    ctx.fillStyle = "rgb(184, 180, 176)";
    ctx.fillRect(x, bodyTop, 3, 1);

    let tabX = x;
    for (let index = 0; index < labels.length; index += 1) {
      const label = labels[index];
      const textWidth = Math.ceil(ctx.measureText(label).width);
      const tabWidth = textWidth + 14;
      const active = index === activeIndex;

      if (active) {
        ctx.strokeStyle = "rgb(184, 180, 176)";
        traceRoundedRect(ctx, tabX + 0.5, y + 0.5, tabWidth - 1, 30, 3);
        ctx.stroke();
        ctx.fillStyle = "rgb(247, 246, 246)";
        traceRoundedRect(ctx, tabX + 1.5, y + 1.5, tabWidth - 3, 33, 3);
        ctx.fill();
      } else {
        ctx.strokeStyle = "rgb(200, 197, 194)";
        traceRoundedRect(ctx, tabX + 0.5, y + 2.5, tabWidth - 1, 28, 3);
        ctx.stroke();
        ctx.fillStyle = "rgb(232, 232, 232)";
        traceRoundedRect(ctx, tabX + 1.5, y + 3.5, tabWidth - 3, 31, 3);
        ctx.fill();
        ctx.fillStyle = "rgb(247, 246, 246)";
        ctx.fillRect(tabX, y + 29, tabWidth, 6);
        ctx.fillStyle = "rgb(184, 180, 176)";
        ctx.fillRect(tabX, y + 28, tabWidth, 1);
      }

      ctx.fillStyle = "rgb(0, 0, 0)";
      ctx.fillText(label, tabX + 6, y + 6);
      drawPreviewTextDecorations(ctx, label, tabX + 6, y + 6, panelTextStyle, "rgb(0, 0, 0)");
      tabX += tabWidth + 8;
    }

    ctx.fillStyle = "rgb(184, 180, 176)";
    ctx.fillRect(x, bodyTop, 1, 7);
    ctx.restore();
    return;
  }

  ctx.strokeStyle = "rgb(137, 140, 140)";
  ctx.strokeRect(x + 0.5, y + 20.5, Math.max(0, w - 1), Math.max(0, h - 21));
  ctx.fillStyle = "rgb(255, 255, 255)";
  ctx.fillRect(x + 1, y + 21, Math.max(0, w - 2), Math.max(0, h - 22));

  let tabX = x;
  for (let index = 0; index < labels.length; index += 1) {
    const label = labels[index];
    const textWidth = Math.ceil(ctx.measureText(label).width);
    const tabWidth = textWidth + 12;
    const active = index === activeIndex;

    if (active) {
      ctx.strokeStyle = "rgb(137, 140, 140)";
      ctx.strokeRect(tabX + 0.5, y + 0.5, tabWidth - 1, 20);
      ctx.fillStyle = "rgb(255, 255, 255)";
      ctx.fillRect(tabX + 1, y + 1, Math.max(0, tabWidth - 2), 20);
    } else {
      ctx.fillStyle = "rgb(137, 140, 140)";
      ctx.fillRect(tabX, y + 2, tabWidth, 19);
      ctx.fillStyle = "rgb(240, 240, 240)";
      ctx.fillRect(tabX + 1, y + 3, Math.max(0, tabWidth - 2), 17);
    }

    ctx.fillStyle = "rgb(0, 0, 0)";
    ctx.fillText(label, tabX + 6, y + 3);
    drawPreviewTextDecorations(ctx, label, tabX + 6, y + 3, panelTextStyle, "rgb(0, 0, 0)");
    tabX += tabWidth;
  }

  ctx.restore();
}

function drawScrollAreaChrome(
  ctx: CanvasRenderingContext2D,
  g: Gadget,
  x: number,
  y: number,
  w: number,
  h: number,
  osSkin: DesignerSettings["osSkin"],
  metrics: PreviewChromeMetrics
) {
  const rect = { x, y, w, h };
  const bar = getScrollAreaBarSize(rect, metrics);
  const fillColor = pbColorNumberToCssHex(g.backColor) ?? "rgb(237, 237, 237)";
  const viewportRect = getScrollAreaViewportRect(rect, metrics);
  const viewportW = viewportRect.w;
  const viewportH = viewportRect.h;
  const innerW = typeof g.min === "number" && g.min > 0 ? g.min : viewportW;
  const innerH = typeof g.max === "number" && g.max > 0 ? g.max : viewportH;
  const offsetX = getScrollAreaOffsetX(g, rect, metrics);
  const offsetY = getScrollAreaOffsetY(g, rect, metrics);
  const maxScrollX = Math.max(0, innerW - viewportW);
  const maxScrollY = Math.max(0, innerH - viewportH);
  const verticalTrack = getScrollAreaVerticalBarRect(rect, metrics);
  const horizontalTrack = getScrollAreaHorizontalBarRect(rect, metrics);

  ctx.save();
  ctx.strokeStyle = "rgb(130, 130, 130)";
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
  ctx.fillStyle = fillColor;
  ctx.fillRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2));

  if (osSkin === "macos") {
    const verticalLength = Math.max(8, Math.trunc(verticalTrack.h / 3));
    const verticalTravel = Math.max(0, verticalTrack.h - verticalLength);
    const verticalStart = maxScrollY > 0 ? Math.trunc((offsetY / maxScrollY) * verticalTravel) : 0;
    const horizontalLength = Math.max(8, Math.trunc(horizontalTrack.w / 3));
    const horizontalTravel = Math.max(0, horizontalTrack.w - horizontalLength);
    const horizontalStart = maxScrollX > 0 ? Math.trunc((offsetX / maxScrollX) * horizontalTravel) : 0;

    ctx.fillStyle = "rgb(228, 228, 228)";
    ctx.fillRect(verticalTrack.x, verticalTrack.y, 1, Math.max(0, verticalTrack.h));
    ctx.fillStyle = "rgb(242, 242, 242)";
    ctx.fillRect(verticalTrack.x + 1, verticalTrack.y, 1, Math.max(0, verticalTrack.h));
    ctx.fillStyle = "rgb(244, 244, 244)";
    ctx.fillRect(verticalTrack.x + 2, verticalTrack.y, 1, Math.max(0, verticalTrack.h));
    ctx.fillStyle = "rgb(245, 245, 245)";
    ctx.fillRect(verticalTrack.x + 3, verticalTrack.y, 1, Math.max(0, verticalTrack.h));
    ctx.fillStyle = "rgb(250, 250, 250)";
    ctx.fillRect(verticalTrack.x + 4, verticalTrack.y, 10, Math.max(0, verticalTrack.h));
    if (maxScrollY > 0) {
      traceRoundedRect(ctx, verticalTrack.x + 4.5, verticalTrack.y + verticalStart + 0.5, 8, verticalLength, 3);
      ctx.fillStyle = "rgb(195, 195, 195)";
      ctx.fill();
    }

    ctx.fillStyle = "rgb(228, 228, 228)";
    ctx.fillRect(horizontalTrack.x, horizontalTrack.y, Math.max(0, horizontalTrack.w), 1);
    ctx.fillStyle = "rgb(242, 242, 242)";
    ctx.fillRect(horizontalTrack.x, horizontalTrack.y + 1, Math.max(0, horizontalTrack.w), 1);
    ctx.fillStyle = "rgb(244, 244, 244)";
    ctx.fillRect(horizontalTrack.x, horizontalTrack.y + 2, Math.max(0, horizontalTrack.w), 1);
    ctx.fillStyle = "rgb(245, 245, 245)";
    ctx.fillRect(horizontalTrack.x, horizontalTrack.y + 3, Math.max(0, horizontalTrack.w), 1);
    ctx.fillStyle = "rgb(250, 250, 250)";
    ctx.fillRect(horizontalTrack.x, horizontalTrack.y + 4, Math.max(0, horizontalTrack.w), 10);
    if (maxScrollX > 0) {
      traceRoundedRect(ctx, horizontalTrack.x + horizontalStart + 0.5, horizontalTrack.y + 4.5, horizontalLength, 8, 3);
      ctx.fillStyle = "rgb(195, 195, 195)";
      ctx.fill();
    }

    ctx.restore();
    return;
  }

  const isWindows8 = osSkin === "windows8";
  const trackColor = isWindows8 ? "rgb(240, 240, 240)" : "rgb(233, 233, 233)";
  const thumbTopColor = "rgb(236, 236, 236)";
  const thumbBottomColor = "rgb(202, 202, 202)";
  const thumbBorderColor = "rgb(155, 155, 155)";
  const thumbFillColor = "rgb(205, 205, 205)";

  ctx.fillStyle = trackColor;
  ctx.fillRect(verticalTrack.x, verticalTrack.y, Math.max(0, verticalTrack.w), Math.max(0, verticalTrack.h));
  if (isWindows8) {
    ctx.fillStyle = "rgb(255, 255, 255)";
    ctx.fillRect(verticalTrack.x, verticalTrack.y, 1, Math.max(0, verticalTrack.h));
  }
  drawScrollBarArrowGlyph(ctx, "up", verticalTrack.x + Math.trunc(verticalTrack.w / 2), verticalTrack.y + 8, "rgb(110, 110, 110)");
  drawScrollBarArrowGlyph(ctx, "down", verticalTrack.x + Math.trunc(verticalTrack.w / 2), verticalTrack.y + verticalTrack.h - 8, "rgb(110, 110, 110)");
  if (maxScrollY > 0 && verticalTrack.h > 34) {
    const thumbLength = Math.max(8, Math.trunc((verticalTrack.h - 34) / 3));
    const thumbTravel = Math.max(0, verticalTrack.h - 34 - thumbLength);
    const thumbStart = Math.trunc((offsetY / maxScrollY) * thumbTravel);
    if (isWindows8) {
      ctx.fillStyle = thumbFillColor;
      ctx.fillRect(verticalTrack.x + 1, verticalTrack.y + 17 + thumbStart, Math.max(0, verticalTrack.w - 1), thumbLength);
    } else {
      traceRoundedRect(ctx, verticalTrack.x + 1.5, verticalTrack.y + 18.5 + thumbStart, Math.max(0, verticalTrack.w - 3), thumbLength, 1);
      ctx.fillStyle = thumbBottomColor;
      ctx.fill();
      ctx.strokeStyle = thumbBorderColor;
      ctx.stroke();
      ctx.fillStyle = thumbTopColor;
      ctx.fillRect(verticalTrack.x + 2, verticalTrack.y + 19 + thumbStart, Math.max(0, Math.trunc((verticalTrack.w * 3) / 8) - 4), Math.max(0, thumbLength - 2));
      ctx.fillStyle = thumbBottomColor;
      ctx.fillRect(verticalTrack.x + 2 + Math.trunc((verticalTrack.w * 3) / 8), verticalTrack.y + 19 + thumbStart, Math.max(0, Math.trunc((verticalTrack.w * 5) / 8) - 4), Math.max(0, thumbLength - 2));
    }
  }

  ctx.fillStyle = trackColor;
  ctx.fillRect(horizontalTrack.x, horizontalTrack.y, Math.max(0, horizontalTrack.w), Math.max(0, horizontalTrack.h));
  if (isWindows8) {
    ctx.fillStyle = "rgb(255, 255, 255)";
    ctx.fillRect(horizontalTrack.x, horizontalTrack.y, Math.max(0, horizontalTrack.w), 1);
  }
  drawScrollBarArrowGlyph(ctx, "left", horizontalTrack.x + 8, horizontalTrack.y + Math.trunc(horizontalTrack.h / 2), "rgb(110, 110, 110)");
  drawScrollBarArrowGlyph(ctx, "right", horizontalTrack.x + horizontalTrack.w - 8, horizontalTrack.y + Math.trunc(horizontalTrack.h / 2), "rgb(110, 110, 110)");
  if (maxScrollX > 0 && horizontalTrack.w > 34) {
    const thumbLength = Math.max(8, Math.trunc((horizontalTrack.w - 34) / 3));
    const thumbTravel = Math.max(0, horizontalTrack.w - 34 - thumbLength);
    const thumbStart = Math.trunc((offsetX / maxScrollX) * thumbTravel);
    if (isWindows8) {
      ctx.fillStyle = thumbFillColor;
      ctx.fillRect(horizontalTrack.x + 17 + thumbStart, horizontalTrack.y + 1, thumbLength, Math.max(0, horizontalTrack.h - 1));
    } else {
      traceRoundedRect(ctx, horizontalTrack.x + 18.5 + thumbStart, horizontalTrack.y + 1.5, thumbLength, Math.max(0, horizontalTrack.h - 3), 1);
      ctx.fillStyle = thumbBottomColor;
      ctx.fill();
      ctx.strokeStyle = thumbBorderColor;
      ctx.stroke();
      ctx.fillStyle = thumbTopColor;
      ctx.fillRect(horizontalTrack.x + 19 + thumbStart, horizontalTrack.y + 2, Math.max(0, thumbLength - 2), Math.max(0, Math.trunc((horizontalTrack.h * 3) / 8) - 4));
      ctx.fillStyle = thumbBottomColor;
      ctx.fillRect(horizontalTrack.x + 19 + thumbStart, horizontalTrack.y + 2 + Math.trunc((horizontalTrack.h * 3) / 8), Math.max(0, thumbLength - 2), Math.max(0, Math.trunc((horizontalTrack.h * 5) / 8) - 4));
    }
  }

  ctx.restore();
}

function drawSplitterChrome(
  ctx: CanvasRenderingContext2D,
  g: Gadget,
  x: number,
  y: number,
  w: number,
  h: number,
  osSkin: DesignerSettings["osSkin"],
  metrics: PreviewChromeMetrics
) {
  const vertical = hasPbFlag(g.flagsExpr, "#PB_Splitter_Vertical");
  const separator = hasPbFlag(g.flagsExpr, "#PB_Splitter_Separator");
  const bar = metrics.splitterWidth;
  const pos = getSplitterResolvedPosition({ x, y, w, h }, vertical, bar, g.state);
  const fillColor = osSkin === "macos"
    ? "rgb(237, 237, 237)"
    : (osSkin === "linux" ? "rgb(242, 241, 240)" : "rgb(240, 240, 240)");

  ctx.save();
  ctx.fillStyle = fillColor;

  if (vertical) {
    ctx.fillRect(x + pos, y, bar, Math.max(0, h));
  } else {
    ctx.fillRect(x, y + pos, Math.max(0, w), bar);
  }

  if (osSkin === "macos") {
    ctx.fillStyle = "rgb(140, 140, 140)";
    if (vertical) {
      ctx.beginPath();
      ctx.arc(x + pos + (bar - 6), y + Math.trunc(h / 2), 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(x + Math.trunc(w / 2), y + pos + (bar - 6), 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (separator) {
    if (vertical) {
      const lineX = x + pos + 3;
      ctx.fillStyle = "rgb(255, 255, 255)";
      ctx.fillRect(lineX, y, 1, Math.max(0, h));
      ctx.fillRect(lineX + 1, y, 1, Math.max(0, h));
      ctx.fillStyle = "rgb(140, 140, 140)";
      ctx.fillRect(lineX + 2, y, 1, Math.max(0, h));
      ctx.fillRect(lineX, y + h - 1, 3, 1);
    } else {
      const lineY = y + pos + 3;
      ctx.fillStyle = "rgb(255, 255, 255)";
      ctx.fillRect(x, lineY, Math.max(0, w), 1);
      ctx.fillRect(x, lineY + 1, Math.max(0, w), 1);
      ctx.fillStyle = "rgb(140, 140, 140)";
      ctx.fillRect(x, lineY + 2, Math.max(0, w), 1);
      ctx.fillRect(x + w - 1, lineY, 1, 3);
    }
  }

  ctx.restore();
}

function openGadgetItemEditor(gadget: Gadget, item?: GadgetItem) {
  pendingGadgetItemEditor = {
    gadgetId: gadget.id,
    sourceLine: item?.source?.line,
    posRaw: item?.posRaw ?? "-1",
    text: item?.text ?? "",
    imageRaw: item?.imageRaw ?? "",
    flagsRaw: item?.flagsRaw ?? ""
  };
}

function closeGadgetItemEditor(gadgetId?: string, sourceLine?: number) {
  if (!pendingGadgetItemEditor) return;
  if (gadgetId && pendingGadgetItemEditor.gadgetId !== gadgetId) return;
  if (typeof sourceLine === "number" && pendingGadgetItemEditor.sourceLine !== sourceLine) return;
  pendingGadgetItemEditor = null;
}

function isGadgetItemEditorOpen(gadget: Gadget, item?: GadgetItem): boolean {
  if (!pendingGadgetItemEditor || pendingGadgetItemEditor.gadgetId !== gadget.id) return false;
  if (!item) return true;
  return typeof item.source?.line === "number" && pendingGadgetItemEditor.sourceLine === item.source.line;
}

function getGadgetItemDraft(gadget: Gadget): PendingGadgetItemEditor | null {
  if (!pendingGadgetItemEditor || pendingGadgetItemEditor.gadgetId !== gadget.id) return null;
  return pendingGadgetItemEditor;
}

function updateGadgetItemEditorDraft(patch: Partial<PendingGadgetItemEditor>) {
  if (!pendingGadgetItemEditor) return;
  pendingGadgetItemEditor = { ...pendingGadgetItemEditor, ...patch };
  renderProps();
}

function saveGadgetItemEditor(gadget: Gadget) {
  const draft = getGadgetItemDraft(gadget);
  if (!draft) return;

  const payload = {
    id: gadget.id,
    posRaw: draft.posRaw.trim() || "-1",
    textRaw: toPbString(draft.text),
    imageRaw: draft.imageRaw.trim().length ? draft.imageRaw.trim() : undefined,
    flagsRaw: draft.flagsRaw.trim().length ? draft.flagsRaw.trim() : undefined,
  };

  const sourceLine = draft.sourceLine;
  closeGadgetItemEditor(gadget.id, sourceLine);
  if (typeof sourceLine === "number") {
    post({
      type: WEBVIEW_TO_EXT_MSG_TYPE.updateGadgetItem,
      sourceLine,
      ...payload,
    });
    return;
  }

  post({
    type: WEBVIEW_TO_EXT_MSG_TYPE.insertGadgetItem,
    ...payload,
  });
}

function openGadgetColumnEditor(gadget: Gadget, column?: GadgetColumn, index?: number) {
  pendingGadgetColumnEditor = {
    gadgetId: gadget.id,
    sourceLine: column?.source?.line,
    colRaw: column?.colRaw ?? String(index ?? gadget.columns?.length ?? 0),
    title: column?.title ?? "",
    widthRaw: column?.widthRaw ?? "80"
  };
}

function closeGadgetColumnEditor(gadgetId?: string, sourceLine?: number) {
  if (!pendingGadgetColumnEditor) return;
  if (gadgetId && pendingGadgetColumnEditor.gadgetId !== gadgetId) return;
  if (typeof sourceLine === "number" && pendingGadgetColumnEditor.sourceLine !== sourceLine) return;
  pendingGadgetColumnEditor = null;
}

function isGadgetColumnEditorOpen(gadget: Gadget, column?: GadgetColumn): boolean {
  if (!pendingGadgetColumnEditor || pendingGadgetColumnEditor.gadgetId !== gadget.id) return false;
  if (!column) return true;
  return typeof column.source?.line === "number" && pendingGadgetColumnEditor.sourceLine === column.source.line;
}

function getGadgetColumnDraft(gadget: Gadget): PendingGadgetColumnEditor | null {
  if (!pendingGadgetColumnEditor || pendingGadgetColumnEditor.gadgetId !== gadget.id) return null;
  return pendingGadgetColumnEditor;
}

function updateGadgetColumnEditorDraft(patch: Partial<PendingGadgetColumnEditor>) {
  if (!pendingGadgetColumnEditor) return;
  pendingGadgetColumnEditor = { ...pendingGadgetColumnEditor, ...patch };
  renderProps();
}

function saveGadgetColumnEditor(gadget: Gadget) {
  const draft = getGadgetColumnDraft(gadget);
  if (!draft) return;

  const payload = {
    id: gadget.id,
    colRaw: draft.colRaw.trim() || String(gadget.columns?.length ?? 0),
    titleRaw: toPbString(draft.title),
    widthRaw: draft.widthRaw.trim() || "80",
  };

  const sourceLine = draft.sourceLine;
  closeGadgetColumnEditor(gadget.id, sourceLine);
  if (typeof sourceLine === "number") {
    post({
      type: WEBVIEW_TO_EXT_MSG_TYPE.updateGadgetColumn,
      sourceLine,
      ...payload,
    });
    return;
  }

  post({
    type: WEBVIEW_TO_EXT_MSG_TYPE.insertGadgetColumn,
    ...payload,
  });
}

function openImageEditor(entry: FormImage) {
  if (typeof entry.source?.line !== "number") return;
  pendingImageEditor = buildFormImageEditorDraft(entry);
}

function closeImageEditor(sourceLine?: number) {
  if (!pendingImageEditor) return;
  if (typeof sourceLine === "number" && pendingImageEditor.sourceLine !== sourceLine) return;
  pendingImageEditor = null;
}

function isImageEditorOpen(entry: FormImage): boolean {
  return typeof entry.source?.line === "number"
    && pendingImageEditor?.sourceLine === entry.source.line;
}

function getImageEditorDraft(entry: FormImage): PendingImageEditor {
  if (isImageEditorOpen(entry) && pendingImageEditor) {
    return pendingImageEditor;
  }

  return buildFormImageEditorDraft(entry);
}

function updateImageEditorDraft(patch: Partial<PendingImageEditor>) {
  if (!pendingImageEditor) return;
  pendingImageEditor = { ...pendingImageEditor, ...patch };
  renderProps();
}

function saveImageEditor(entry: FormImage) {
  if (typeof entry.source?.line !== "number") return;
  const draft = getImageEditorDraft(entry);
  const idRaw = draft.idRaw.trim();
  const imageRaw = draft.imageRaw.trim();
  if (!idRaw.length || !imageRaw.length) return;

  let assignedVar: string | undefined;
  if (requiresFormImageAssignedVar(idRaw)) {
    const trimmedAssigned = draft.assignedVar.trim();
    if (!trimmedAssigned.length) {
      alert(`${PB_ANY} requires an assigned variable name.`);
      return;
    }
    assignedVar = trimmedAssigned;
  }

  closeImageEditor(entry.source.line);
  post({
    type: WEBVIEW_TO_EXT_MSG_TYPE.updateImage,
    sourceLine: entry.source.line,
    inline: draft.inline,
    idRaw,
    imageRaw,
    assignedVar
  });
  renderProps();
}

function isSameImageTarget(target: ImageAssignmentTarget, other: ImageAssignmentTarget): boolean {
  if (target.kind !== other.kind) return false;
  switch (target.kind) {
    case "menuEntry":
      return target.menuId === (other as Extract<ImageAssignmentTarget, { kind: "menuEntry" }>).menuId
        && target.entryIndex === (other as Extract<ImageAssignmentTarget, { kind: "menuEntry" }>).entryIndex;
    case "toolBarEntry":
      return target.toolBarId === (other as Extract<ImageAssignmentTarget, { kind: "toolBarEntry" }>).toolBarId
        && target.entryIndex === (other as Extract<ImageAssignmentTarget, { kind: "toolBarEntry" }>).entryIndex;
    case "statusBarField":
      return target.statusBarId === (other as Extract<ImageAssignmentTarget, { kind: "statusBarField" }>).statusBarId
        && target.fieldIndex === (other as Extract<ImageAssignmentTarget, { kind: "statusBarField" }>).fieldIndex;
    case "gadget":
      return target.gadgetId === (other as Extract<ImageAssignmentTarget, { kind: "gadget" }>).gadgetId;
  }
}

function getDefaultPendingImageInsertDraft(): PendingImageInsertDraft {
  return {
    inline: false,
    idRaw: "#ImgNew",
    imageRaw: '"image.png"',
    assignedVar: "imgNew"
  };
}

function openImageInsertDraft() {
  pendingImageInsertDraft = getDefaultPendingImageInsertDraft();
  renderProps();
}

function closeImageInsertDraft() {
  pendingImageInsertDraft = null;
  renderProps();
}

function updateImageInsertDraft(patch: Partial<PendingImageInsertDraft>) {
  if (!pendingImageInsertDraft) return;
  pendingImageInsertDraft = { ...pendingImageInsertDraft, ...patch };
  renderProps();
}

function saveImageInsertDraft() {
  if (!pendingImageInsertDraft) return;
  const inline = pendingImageInsertDraft.inline;
  const idRaw = pendingImageInsertDraft.idRaw.trim();
  const imageRaw = pendingImageInsertDraft.imageRaw.trim();
  if (!idRaw.length || !imageRaw.length) return;

  let assignedVar: string | undefined;
  if (requiresFormImageAssignedVar(idRaw)) {
    const trimmedAssigned = pendingImageInsertDraft.assignedVar.trim();
    if (!trimmedAssigned.length) {
      alert(`${PB_ANY} requires an assigned variable name.`);
      return;
    }
    assignedVar = trimmedAssigned;
  }

  pendingImageInsertDraft = null;
  post({
    type: WEBVIEW_TO_EXT_MSG_TYPE.insertImage,
    inline,
    idRaw,
    imageRaw,
    assignedVar
  });
  renderProps();
}

function openImageReferencePicker(target: ImageAssignmentTarget, currentImageId?: string) {
  if (!(model.images?.length)) {
    alert("No image entries are defined in this form.");
    return;
  }
  pendingImageReferencePicker = {
    target,
    selectedImageId: getDefaultImageReferenceSelection(currentImageId)
  };
  renderProps();
}

function closeImageReferencePicker() {
  pendingImageReferencePicker = null;
  renderProps();
}

function updateImageReferencePicker(patch: Partial<PendingImageReferencePicker>) {
  if (!pendingImageReferencePicker) return;
  pendingImageReferencePicker = { ...pendingImageReferencePicker, ...patch };
  renderProps();
}

function isImageReferencePickerOpenFor(target: ImageAssignmentTarget): boolean {
  return Boolean(pendingImageReferencePicker && isSameImageTarget(pendingImageReferencePicker.target, target));
}

function getDefaultPendingImageAssignmentDraft(target: ImageAssignmentTarget, mode: "create" | "chooseFile"): PendingImageAssignmentDraft {
  // For new statusbar field / toolbar entry / menu entry images in create mode,
  // and for gadget image assignment (chooseFile), respect the pbAny setting.
  const usePbAny = (
    (mode === "create" && (target.kind === "statusBarField" || target.kind === "toolBarEntry" || target.kind === "menuEntry"))
    || (mode === "chooseFile" && target.kind === "gadget")
  ) && settings.newGadgetsUsePbAnyByDefault;

  let idRaw = "#ImgNew";
  let assignedVar = "imgNew";
  if (usePbAny) {
    const nextIdRaw = buildNextGeneratedImageIdRaw(
      model.images ?? [],
      model.window?.variable,
      model.window?.id
    );
    idRaw = PB_ANY;
    assignedVar = nextIdRaw.replace(/^#/, "");
  }

  return {
    target,
    mode,
    inline: false,
    idRaw,
    imageRaw: '"image.png"',
    assignedVar,
    resizeToImage: false,
  };
}

function openImageAssignmentDraft(target: ImageAssignmentTarget, mode: "create" | "chooseFile") {
  pendingImageAssignmentDraft = getDefaultPendingImageAssignmentDraft(target, mode);
  renderProps();
}

function closeImageAssignmentDraft() {
  pendingImageAssignmentDraft = null;
  renderProps();
}

function updateImageAssignmentDraft(patch: Partial<PendingImageAssignmentDraft>) {
  if (!pendingImageAssignmentDraft) return;
  pendingImageAssignmentDraft = { ...pendingImageAssignmentDraft, ...patch };
  renderProps();
}

function isImageAssignmentDraftOpenFor(target: ImageAssignmentTarget): boolean {
  return Boolean(pendingImageAssignmentDraft && isSameImageTarget(pendingImageAssignmentDraft.target, target));
}

function saveImageReferencePicker() {
  if (!pendingImageReferencePicker) return;
  const selected = findImageEntryById(pendingImageReferencePicker.selectedImageId);
  if (!selected) return;
  const imageRaw = `ImageID(${selected.id})`;
  const { target } = pendingImageReferencePicker;
  pendingImageReferencePicker = null;

  switch (target.kind) {
    case "menuEntry": {
      const menu = model.menus?.find(candidate => candidate.id === target.menuId);
      const entry = menu?.entries?.[target.entryIndex];
      if (!menu || !entry || typeof entry.source?.line !== "number" || entry.kind !== "MenuItem") return;
      post({
        type: WEBVIEW_TO_EXT_MSG_TYPE.rebindMenuEntryImage,
        menuId: menu.id,
        sourceLine: entry.source.line,
        kind: entry.kind,
        idRaw: entry.idRaw,
        textRaw: entry.textRaw ?? (entry.text !== undefined ? toPbString(entry.text) : undefined),
        shortcut: entry.shortcut,
        iconRaw: imageRaw,
        oldImageId: entry.iconId,
        oldImageSourceLine: getCleanupSourceLineForImageReference(entry.iconId, selected.id)
      });
      break;
    }
    case "toolBarEntry": {
      const toolBar = model.toolbars?.find(candidate => candidate.id === target.toolBarId);
      const entry = toolBar?.entries?.[target.entryIndex];
      if (!toolBar || !entry || typeof entry.source?.line !== "number" || entry.kind !== "ToolBarImageButton") return;
      post({
        type: WEBVIEW_TO_EXT_MSG_TYPE.rebindToolBarEntryImage,
        toolBarId: toolBar.id,
        sourceLine: entry.source.line,
        kind: entry.kind,
        idRaw: entry.idRaw,
        iconRaw: imageRaw,
        toggle: entry.toggle,
        oldImageId: entry.iconId,
        oldImageSourceLine: getCleanupSourceLineForImageReference(entry.iconId, selected.id)
      });
      break;
    }
    case "statusBarField": {
      const statusBar = model.statusbars?.find(candidate => candidate.id === target.statusBarId);
      const field = statusBar?.fields?.[target.fieldIndex];
      if (!statusBar || !field || typeof field.source?.line !== "number") return;
      post({
        type: WEBVIEW_TO_EXT_MSG_TYPE.rebindStatusBarFieldImage,
        statusBarId: statusBar.id,
        sourceLine: field.source.line,
        widthRaw: field.widthRaw,
        imageRaw,
        oldImageId: field.imageId,
        oldImageSourceLine: getCleanupSourceLineForImageReference(field.imageId, selected.id)
      });
      break;
    }
    case "gadget": {
      const gadget = model.gadgets.find(candidate => candidate.id === target.gadgetId);
      if (!gadget) return;
      const oldImageId = gadget.imageId;
      const oldImageSourceLine = getCleanupSourceLineForImageReference(oldImageId, selected.id);
      gadget.imageRaw = imageRaw;
      gadget.imageId = selected.id;
      post({
        type: WEBVIEW_TO_EXT_MSG_TYPE.setGadgetImageRaw,
        id: gadget.id,
        imageRaw,
        oldImageId,
        oldImageSourceLine
      });
      break;
    }
  }

  renderProps();
}

function saveImageAssignmentDraft() {
  if (!pendingImageAssignmentDraft) return;
  const draft = pendingImageAssignmentDraft;
  const idRaw = draft.idRaw.trim();
  if (!idRaw.length) return;

  let assignedVar: string | undefined;
  if (requiresFormImageAssignedVar(idRaw)) {
    const trimmedAssigned = draft.assignedVar.trim();
    if (!trimmedAssigned.length) {
      alert(`${PB_ANY} requires an assigned variable name.`);
      return;
    }
    assignedVar = trimmedAssigned;
  }

  const imageRaw = draft.imageRaw.trim();
  if (draft.mode === "create" && !imageRaw.length) return;

  const reference = buildCreatedImageReference(idRaw, assignedVar);
  if (!reference) {
    alert(`${PB_ANY} requires an assigned variable name.`);
    return;
  }

  pendingImageAssignmentDraft = null;

  const target = draft.target;

  switch (target.kind) {
    case "menuEntry": {
      const menu = model.menus?.find(candidate => candidate.id === target.menuId);
      const entry = menu?.entries?.[target.entryIndex];
      if (!menu || !entry || typeof entry.source?.line !== "number" || entry.kind !== "MenuItem") return;
      const oldImageSourceLine = getCleanupSourceLineForImageReference(entry.iconId, reference.imageId);
      if (draft.mode === "create") {
        post({
          type: WEBVIEW_TO_EXT_MSG_TYPE.createAndAssignMenuEntryImage,
          menuId: menu.id,
          sourceLine: entry.source.line,
          kind: entry.kind,
          idRaw: entry.idRaw,
          textRaw: entry.textRaw ?? (entry.text !== undefined ? toPbString(entry.text) : undefined),
          shortcut: entry.shortcut,
          newInline: draft.inline,
          newImageIdRaw: idRaw,
          newImageRaw: imageRaw,
          newAssignedVar: assignedVar,
          oldImageId: entry.iconId,
          oldImageSourceLine,
        });
      }
      else {
        post({
          type: WEBVIEW_TO_EXT_MSG_TYPE.chooseFileAndAssignMenuEntryImage,
          menuId: menu.id,
          sourceLine: entry.source.line,
          kind: entry.kind,
          idRaw: entry.idRaw,
          textRaw: entry.textRaw ?? (entry.text !== undefined ? toPbString(entry.text) : undefined),
          shortcut: entry.shortcut,
          newImageIdRaw: idRaw,
          newAssignedVar: assignedVar,
          oldImageId: entry.iconId,
          oldImageSourceLine,
        });
      }
      break;
    }
    case "toolBarEntry": {
      const toolBar = model.toolbars?.find(candidate => candidate.id === target.toolBarId);
      const entry = toolBar?.entries?.[target.entryIndex];
      if (!toolBar || !entry || typeof entry.source?.line !== "number" || entry.kind !== "ToolBarImageButton") return;
      const oldImageSourceLine = getCleanupSourceLineForImageReference(entry.iconId, reference.imageId);
      if (draft.mode === "create") {
        post({
          type: WEBVIEW_TO_EXT_MSG_TYPE.createAndAssignToolBarEntryImage,
          toolBarId: toolBar.id,
          sourceLine: entry.source.line,
          kind: entry.kind,
          idRaw: entry.idRaw,
          toggle: entry.toggle,
          newInline: draft.inline,
          newImageIdRaw: idRaw,
          newImageRaw: imageRaw,
          newAssignedVar: assignedVar,
          oldImageId: entry.iconId,
          oldImageSourceLine,
        });
      }
      else {
        post({
          type: WEBVIEW_TO_EXT_MSG_TYPE.chooseFileAndAssignToolBarEntryImage,
          toolBarId: toolBar.id,
          sourceLine: entry.source.line,
          kind: entry.kind,
          idRaw: entry.idRaw,
          toggle: entry.toggle,
          newImageIdRaw: idRaw,
          newAssignedVar: assignedVar,
          oldImageId: entry.iconId,
          oldImageSourceLine,
        });
      }
      break;
    }
    case "statusBarField": {
      const statusBar = model.statusbars?.find(candidate => candidate.id === target.statusBarId);
      const field = statusBar?.fields?.[target.fieldIndex];
      if (!statusBar || !field || typeof field.source?.line !== "number") return;
      const oldImageSourceLine = getCleanupSourceLineForImageReference(field.imageId, reference.imageId);
      if (draft.mode === "create") {
        post({
          type: WEBVIEW_TO_EXT_MSG_TYPE.createAndAssignStatusBarFieldImage,
          statusBarId: statusBar.id,
          sourceLine: field.source.line,
          widthRaw: field.widthRaw,
          newInline: draft.inline,
          newImageIdRaw: idRaw,
          newImageRaw: imageRaw,
          newAssignedVar: assignedVar,
          oldImageId: field.imageId,
          oldImageSourceLine,
        });
      }
      else {
        post({
          type: WEBVIEW_TO_EXT_MSG_TYPE.chooseFileAndAssignStatusBarFieldImage,
          statusBarId: statusBar.id,
          sourceLine: field.source.line,
          widthRaw: field.widthRaw,
          newImageIdRaw: idRaw,
          newAssignedVar: assignedVar,
          oldImageId: field.imageId,
          oldImageSourceLine,
        });
      }
      break;
    }
    case "gadget": {
      const gadget = model.gadgets.find(candidate => candidate.id === target.gadgetId);
      if (!gadget) return;
      const oldImageId = gadget.imageId;
      const oldImageSourceLine = getCleanupSourceLineForImageReference(oldImageId, reference.imageId);
      gadget.imageRaw = reference.imageRaw;
      gadget.imageId = reference.imageId;
      if (draft.mode === "create") {
        post({
          type: WEBVIEW_TO_EXT_MSG_TYPE.createAndAssignGadgetImage,
          id: gadget.id,
          newInline: draft.inline,
          newImageIdRaw: idRaw,
          newImageRaw: imageRaw,
          newAssignedVar: assignedVar,
          oldImageId,
          oldImageSourceLine,
        });
      }
      else {
        post({
          type: WEBVIEW_TO_EXT_MSG_TYPE.chooseFileAndAssignGadgetImage,
          id: gadget.id,
          x: gadget.x,
          y: gadget.y,
          resizeToImage: draft.resizeToImage,
          newImageIdRaw: idRaw,
          newAssignedVar: assignedVar,
          oldImageId,
          oldImageSourceLine,
        });
      }
      break;
    }
  }

  renderProps();
}


function drawTopLevelMoveIndicator(
  ctx: CanvasRenderingContext2D,
  target: { indicatorRect: PreviewRect; indicatorOrientation: "horizontal" | "vertical" },
  mode: TopLevelMoveIndicatorRenderMode = "original"
): void {
  const indicator = target.indicatorRect;
  const strokes = getTopLevelMoveIndicatorStrokes(mode);
  ctx.save();
  ctx.lineCap = "butt";
  for (const stroke of strokes) {
    ctx.strokeStyle = (stroke.cssVariable ? getCssVar(stroke.cssVariable) : "") || stroke.fallbackColor;
    ctx.lineWidth = stroke.lineWidth;
    if (target.indicatorOrientation === "vertical") {
      const x = indicator.x + Math.max(0, Math.trunc(indicator.w / 2));
      ctx.beginPath();
      ctx.moveTo(x + 0.5, indicator.y);
      ctx.lineTo(x + 0.5, indicator.y + indicator.h);
      ctx.stroke();
    } else {
      const y = indicator.y + Math.max(0, Math.trunc(indicator.h / 2));
      ctx.beginPath();
      ctx.moveTo(indicator.x, y + 0.5);
      ctx.lineTo(indicator.x + indicator.w, y + 0.5);
      ctx.stroke();
    }
  }
  ctx.restore();
}


function drawMenuFlyoutPanelPreview(
  ctx: CanvasRenderingContext2D,
  menu: FormMenu,
  parentIndex: number,
  panelRect: PreviewRect,
  fg: string
): void {
  const childIndices = getDirectMenuChildIndices(menu, parentIndex);
  if (panelRect.w <= 0 || panelRect.h <= 0) return;

  const flyoutDecoration = getWindowPreviewMenuFlyoutDecoration();
  const windowsSkinColors = resolveWindowsSkinColors();
  const panelBg = windowsSkinColors
    ? windowsSkinColors.menu
    : (flyoutDecoration.backgroundStyle === "white" ? "rgb(255,255,255)" : "rgb(255,255,255)");
  const panelBorder = windowsSkinColors
    ? ensurePreviewLineContrast(
      windowsSkinColors.buttonShadow ?? windowsSkinColors.scrollbar,
      panelBg,
      "rgb(200,200,200)"
    )
    : (flyoutDecoration.borderStyle === "light" ? "rgb(200,200,200)" : fg);
  const separatorColor = windowsSkinColors
    ? ensurePreviewLineContrast(
      windowsSkinColors.buttonShadow ?? windowsSkinColors.scrollbar,
      panelBg,
      "rgb(200,200,200)"
    )
    : (flyoutDecoration.separatorStyle === "light" ? "rgb(200,200,200)" : panelBorder);
  const menuTextColor = windowsSkinColors
    ? windowsSkinColors.menuText
    : (flyoutDecoration.textColorStyle === "black" ? "rgb(0,0,0)" : fg);
  const selectedOutlineColor = windowsSkinColors
    ? windowsSkinColors.menuText
    : (flyoutDecoration.outlineColorStyle === "black" ? "rgb(0,0,0)" : fg);

  ctx.save();
  ctx.fillStyle = panelBg;
  ctx.fillRect(panelRect.x, panelRect.y, panelRect.w, panelRect.h);
  ctx.strokeStyle = panelBorder;
  ctx.strokeRect(panelRect.x + 0.5, panelRect.y + 0.5, panelRect.w - 1, panelRect.h - 1);
  ctx.restore();

  let posY = panelRect.y;
  ctx.save();
  ctx.textBaseline = "alphabetic";
  for (const childIndex of childIndices) {
    const entry = menu.entries[childIndex];
    if (entry.kind === "MenuBar") {
      const entryRect: PreviewEntryRect = {
        ownerId: menu.id,
        index: childIndex,
        ...getMenuFlyoutSeparatorPreviewRect(panelRect.x, posY, panelRect.w)
      };
      menuEntryPreviewRects.push(entryRect);
      ctx.save();
      ctx.strokeStyle = separatorColor;
      ctx.beginPath();
      ctx.moveTo(entryRect.x + 0.5, getMenuFlyoutSeparatorLineY(entryRect) + 0.5);
      ctx.lineTo(entryRect.x + entryRect.w - 0.5, getMenuFlyoutSeparatorLineY(entryRect) + 0.5);
      ctx.stroke();
      ctx.restore();
      const isSelectedEntry = selection?.kind === "menuEntry"
        && selection.menuId === menu.id
        && selection.entryIndex === childIndex;
      if (flyoutDecoration.useSelectedOutline && isSelectedEntry) {
        ctx.save();
        ctx.strokeStyle = selectedOutlineColor;
        ctx.strokeRect(entryRect.x, entryRect.y, Math.max(0, entryRect.w), Math.max(0, entryRect.h));
        ctx.restore();
      }
      posY += entryRect.h;
      continue;
    }

    const entryRect: PreviewEntryRect = getMenuFlyoutEntryPreviewRect(menu.id, childIndex, panelRect.x, posY, panelRect.w);
    menuEntryPreviewRects.push(entryRect);

    const isSelectedEntry = selection?.kind === "menuEntry"
      && selection.menuId === menu.id
      && selection.entryIndex === childIndex;

    if (flyoutDecoration.showEntryHoverFill) {
      ctx.save();
      ctx.fillStyle = fg;
      ctx.globalAlpha = 0.08;
      ctx.fillRect(entryRect.x + 1, entryRect.y + 1, Math.max(0, entryRect.w - 2), Math.max(0, entryRect.h - 2));
      ctx.restore();
    }

    if (entry.iconId || entry.iconRaw) {
      const iconX = entryRect.x + 3;
      const iconY = entryRect.y + 2;
      if (!drawPreviewTopLevelAssignedImage(ctx, entry.iconId, iconX, iconY, 16, 16)) {
        drawPreviewFallbackImageIcon(ctx, iconX, iconY, 16);
      }
    }

    const label = getMenuPreviewLabel(entry);
    const textLayout = getMenuFlyoutEntryTextLayout(entryRect, entry.shortcut ? ctx.measureText(entry.shortcut).width : 0);
    ctx.fillStyle = menuTextColor;
    ctx.fillText(label, textLayout.labelX, textLayout.labelY);

    if (entry.shortcut) {
      ctx.save();
      ctx.globalAlpha = getMenuFlyoutShortcutOpacity();
      ctx.fillStyle = menuTextColor;
      ctx.fillText(entry.shortcut, textLayout.shortcutX, textLayout.shortcutY);
      ctx.restore();
    }

    if (getDirectMenuChildIndices(menu, childIndex).length) {
      const submenuIconMetrics = getWindowPreviewMenuSubmenuIconMetrics();
      drawPreviewSubmenuIndicatorIcon(
        ctx,
        entryRect.x + entryRect.w - submenuIconMetrics.offsetRight,
        entryRect.y + submenuIconMetrics.offsetY,
      );
    }

    if (flyoutDecoration.useSelectedOutline && isSelectedEntry) {
      ctx.save();
      ctx.strokeStyle = selectedOutlineColor;
      ctx.strokeRect(entryRect.x, entryRect.y, Math.max(0, entryRect.w), Math.max(0, entryRect.h));
      ctx.restore();
    }

    posY += entryRect.h;
  }

  const footerRect: PreviewMenuFooterRect = getMenuFlyoutFooterPreviewRect(menu.id, parentIndex, panelRect.x, posY, panelRect.w);
  menuFooterPreviewRects.push(footerRect);
  const footerTextPosition = getMenuFlyoutFooterTextPosition(footerRect);

  ctx.save();
  ctx.globalAlpha = getMenuFlyoutFooterOpacity();
  ctx.fillStyle = menuTextColor;
  ctx.fillText("Add Item...", footerTextPosition.x, footerTextPosition.y);
  ctx.restore();
  ctx.restore();
}

function drawMenuBarPreview(ctx: CanvasRenderingContext2D, rect: PreviewRect, fg: string, osSkin: DesignerSettings["osSkin"]) {
  const menu = getPrimaryMenu();
  menuEntryPreviewRects = [];
  menuFooterPreviewRects = [];
  menuAddPreviewRect = null;
  if (!menu || rect.h <= 0 || rect.w <= 0) return;

  const border = getCssVar("--vscode-panel-border") || fg;
  const menuBarDecoration = getWindowPreviewMenuBarDecoration(osSkin);
  const windowsSkinColors = resolveWindowsSkinColors();
  const menuTextColor = windowsSkinColors
    ? windowsSkinColors.menuText
    : (menuBarDecoration.textColorStyle === "black" ? "rgb(0,0,0)" : fg);
  const selectedOutlineColor = windowsSkinColors
    ? windowsSkinColors.menuText
    : (menuBarDecoration.outlineColorStyle === "black" ? "rgb(0,0,0)" : fg);

  ctx.save();
  switch (menuBarDecoration.backgroundStyle) {
    case "macos-gradient": {
      const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + Math.max(rect.h, 22));
      gradient.addColorStop(0, "rgb(251, 251, 251)");
      gradient.addColorStop(1, "rgb(218, 218, 218)");
      ctx.fillStyle = gradient;
      ctx.fillRect(rect.x, rect.y + 1, rect.w, Math.max(0, rect.h - 1));
      break;
    }
    case "windows7-layered": {
      const palette = deriveWindows7MenuBarPalette(windowsSkinColors?.menu, windowsSkinColors?.menuBar);
      ctx.fillStyle = palette.topFill;
      ctx.fillRect(rect.x, rect.y, rect.w, Math.min(rect.h, 7));
      if (rect.h > 7) {
        ctx.fillStyle = palette.bottomFill;
        ctx.fillRect(rect.x, rect.y + 7, rect.w, Math.max(0, rect.h - 7));
      }
      break;
    }
    case "windows8-light":
      ctx.fillStyle = windowsSkinColors?.menuBar ?? "rgb(245, 246, 247)";
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      break;
    case "linux-light":
      ctx.fillStyle = "rgb(245, 246, 247)";
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      break;
  }
  ctx.restore();

  if (menuBarDecoration.showTopSeparator) {
    ctx.save();
    ctx.strokeStyle = menuBarDecoration.topSeparatorStyle === "macos-dark" ? "rgb(85, 85, 85)" : border;
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.y + 0.5);
    ctx.lineTo(rect.x + rect.w, rect.y + 0.5);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  switch (menuBarDecoration.bottomSeparatorStyle) {
    case "macos-dark":
      ctx.strokeStyle = "rgb(118, 118, 118)";
      ctx.beginPath();
      ctx.moveTo(rect.x, rect.y + rect.h - 0.5);
      ctx.lineTo(rect.x + rect.w, rect.y + rect.h - 0.5);
      ctx.stroke();
      break;
    case "windows7-triple": {
      const palette = deriveWindows7MenuBarPalette(windowsSkinColors?.menu, windowsSkinColors?.menuBar);
      ctx.strokeStyle = palette.separatorUpper;
      ctx.beginPath();
      ctx.moveTo(rect.x, rect.y + rect.h - 2.5);
      ctx.lineTo(rect.x + rect.w, rect.y + rect.h - 2.5);
      ctx.stroke();
      ctx.strokeStyle = palette.separatorMiddle;
      ctx.beginPath();
      ctx.moveTo(rect.x, rect.y + rect.h - 1.5);
      ctx.lineTo(rect.x + rect.w, rect.y + rect.h - 1.5);
      ctx.stroke();
      ctx.strokeStyle = palette.separatorLower;
      ctx.beginPath();
      ctx.moveTo(rect.x, rect.y + rect.h - 0.5);
      ctx.lineTo(rect.x + rect.w, rect.y + rect.h - 0.5);
      ctx.stroke();
      break;
    }
    case "windows8-light":
      ctx.strokeStyle = windowsSkinColors
        ? ensurePreviewLineContrast(
          windowsSkinColors.scrollbar ?? "rgb(232, 233, 234)",
          windowsSkinColors.menuBar ?? "rgb(245, 246, 247)",
          "rgb(232, 233, 234)"
        )
        : "rgb(232, 233, 234)";
      ctx.beginPath();
      ctx.moveTo(rect.x, rect.y + rect.h - 0.5);
      ctx.lineTo(rect.x + rect.w, rect.y + rect.h - 0.5);
      ctx.stroke();
      break;
    case "linux-light":
      ctx.strokeStyle = "rgb(232, 233, 234)";
      ctx.beginPath();
      ctx.moveTo(rect.x, rect.y + rect.h - 0.5);
      ctx.lineTo(rect.x + rect.w, rect.y + rect.h - 0.5);
      ctx.stroke();
      break;
  }
  ctx.restore();

  const selectedRootEntryIndex = selection && selection.kind === "menuEntry" && selection.menuId === menu.id
    ? getMenuAncestorChain(menu, selection.entryIndex)[0] ?? null
    : null;

  let x = rect.x + menuBarDecoration.itemInsetX;
  const textY = rect.y + menuBarDecoration.itemInsetY;
  const baseline = textY + Math.min(Math.max(12, rect.h - 8), 13);
  ctx.save();
  ctx.textBaseline = "alphabetic";
  for (const [entryIndex, entry] of menu.entries.entries()) {
    if (getMenuEntryLevel(entry) !== 0) continue;
    if (entry.kind === "MenuBar") {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = border;
      ctx.beginPath();
      ctx.moveTo(x + 2.5, rect.y + 4);
      ctx.lineTo(x + 2.5, rect.y + rect.h - 4);
      ctx.stroke();
      ctx.restore();
      x += 9;
      continue;
    }

    const label = getMenuPreviewLabel(entry);
    if (!label.length) continue;
    const metrics = ctx.measureText(label);
    const textWidth = Math.ceil(metrics.width);
    const entryRect = getWindowPreviewMenuRootEntryRect(x, textY, textWidth, rect.h, menuBarDecoration.itemSpacing);

    menuEntryPreviewRects.push({
      ownerId: menu.id, index: entryIndex,
      x: entryRect.x, y: entryRect.y,
      w: entryRect.w,  
      h: entryRect.h
    });

    ctx.fillStyle = menuTextColor;
    ctx.fillText(label, x, baseline);

    if (menuBarDecoration.useSelectedOutline && selectedRootEntryIndex === entryIndex) {
      ctx.save();
      ctx.strokeStyle = selectedOutlineColor;
      ctx.strokeRect(entryRect.x + 0.5, entryRect.y + 0.5, Math.max(0, entryRect.w - 1), Math.max(0, entryRect.h - 1));
      ctx.restore();
    }

    x += entryRect.w;
    if (x >= rect.x + rect.w - 20) break;
  }
  ctx.restore();

  const addIconMetrics = getWindowPreviewAddIconMetrics();
  const addRectX = getTopLevelClampedAddIconX(rect, x);
  const addRect: PreviewMenuAddRect = {
    menuId: menu.id,
    x: addRectX,
    y: rect.y + menuBarDecoration.itemInsetY,
    w: addIconMetrics.width,
    h: addIconMetrics.height
  };
  menuAddPreviewRect = addRect;
  drawPreviewPlusIcon(ctx, addRect.x, addRect.y);

  if (!selection || selection.kind !== "menuEntry" || selection.menuId !== menu.id) {
    return;
  }

  const chain = getMenuAncestorChain(menu, selection.entryIndex);
  if (!chain.length) return;

  let previousPanelRect: PreviewRect | null = null;
  for (const parentIndex of chain) {
    const parentRect = getMenuEntryRect(menuEntryPreviewRects, menu.id, parentIndex);
    if (!parentRect) continue;

    const anchorRect: PreviewRect = getMenuFlyoutAnchorRect(rect, parentRect, previousPanelRect);

    const panelRect = getMenuFlyoutPanelRect(menu, parentIndex, anchorRect, (label) => ctx.measureText(label).width);
    if (!panelRect) continue;
    drawMenuFlyoutPanelPreview(ctx, menu, parentIndex, panelRect, fg);
    previousPanelRect = panelRect;
  }
}

function drawToolBarPreview(ctx: CanvasRenderingContext2D, rect: PreviewRect, fg: string, osSkin: DesignerSettings["osSkin"]) {
  const toolbar = getPrimaryToolbar();
  toolBarEntryPreviewRects = [];
  toolBarAddPreviewRect = null;
  if (!toolbar || rect.h <= 0 || rect.w <= 0) return;

  const border = getCssVar("--vscode-panel-border") || fg;
  const toolBarDecoration = getWindowPreviewToolBarDecoration(osSkin);
  const windowsSkinColors = resolveWindowsSkinColors();
  const toolbarBg = windowsSkinColors?.buttonFace ?? "rgb(240, 240, 240)";
  const toolbarSeparatorColor = windowsSkinColors
    ? ensurePreviewLineContrast(
      windowsSkinColors.buttonShadow ?? windowsSkinColors.threeDShadow,
      toolbarBg,
      "rgb(132,132,132)"
    )
    : (toolBarDecoration.separatorColorStyle === "toolbar-dark"
      ? "rgb(132,132,132)"
      : border);
  const toolbarSelectedOutlineColor = windowsSkinColors
    ? windowsSkinColors.buttonText
    : (toolBarDecoration.selectedOutlineColorStyle === "black"
      ? "rgb(0,0,0)"
      : fg);

  ctx.save();
  if (toolBarDecoration.backgroundStyle === "macos-gradient") {
    const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + Math.max(rect.h, 90));
    gradient.addColorStop(0, "rgb(228, 228, 228)");
    gradient.addColorStop(1, "rgb(175, 175, 175)");
    ctx.fillStyle = gradient;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  } else {
    ctx.fillStyle = windowsSkinColors
      ? toolbarBg
      : (toolBarDecoration.backgroundStyle === "linux-light"
        ? "rgb(242, 241, 240)"
        : "rgb(240, 240, 240)");
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }

  if (toolBarDecoration.showFrameBorder) {
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = border;
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
  }
  ctx.restore();

  if (toolBarDecoration.showBottomSeparator) {
    ctx.save();
    const toolbarBottomSeparatorColor = windowsSkinColors
      ? ensurePreviewLineContrast(
        windowsSkinColors.buttonShadow ?? windowsSkinColors.threeDShadow,
        toolbarBg,
        "rgb(160, 160, 160)"
      )
      : (toolBarDecoration.useDarkBottomSeparator ? "rgb(160, 160, 160)" : border);
    ctx.strokeStyle = toolbarBottomSeparatorColor;
    ctx.globalAlpha = windowsSkinColors ? 1 : (toolBarDecoration.useDarkBottomSeparator ? 1 : 0.28);
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.y + rect.h - 0.5);
    ctx.lineTo(rect.x + rect.w, rect.y + rect.h - 0.5);
    ctx.stroke();
    ctx.restore();
  }

  let x = rect.x + toolBarDecoration.itemInsetX;
  const y = rect.y + toolBarDecoration.itemInsetY;
  for (const [entryIndex, entry] of toolbar.entries.entries()) {
    if (entry.kind === "ToolBarToolTip") continue;
    if (entry.kind === "ToolBarSeparator") {
      const separatorRect = getToolBarSeparatorPreviewRect(x, y);
      const entryRect = { ownerId: toolbar.id, index: entryIndex, ...getToolBarSeparatorSlotRect(x, y) };
      toolBarEntryPreviewRects.push(entryRect);
      const isSelectedEntry = selection?.kind === "toolBarEntry"
        && selection.toolBarId === toolbar.id
        && selection.entryIndex === entryIndex;
      if (toolBarDecoration.separatorColorStyle !== "none") {
        ctx.save();
        ctx.strokeStyle = toolbarSeparatorColor;
        ctx.beginPath();
        ctx.moveTo(x + 2.5, y + 1);
        ctx.lineTo(x + 2.5, y + 15);
        ctx.stroke();
        ctx.restore();
      }
      if (isSelectedEntry) {
        const outlineRect = getToolBarSeparatorSelectedOutlineRect(separatorRect);
        ctx.save();
        ctx.strokeStyle = toolbarSelectedOutlineColor;
        ctx.strokeRect(outlineRect.x + 0.5, outlineRect.y + 0.5, outlineRect.w, outlineRect.h);
        ctx.restore();
      }
      x += getToolBarEntryAdvance(entry.kind);
      continue;
    }

    const entryRect = { ownerId: toolbar.id, index: entryIndex, ...getToolBarImageButtonPreviewRect(x, y) };
    toolBarEntryPreviewRects.push(entryRect);
    const isSelectedEntry = selection?.kind === "toolBarEntry"
      && selection.toolBarId === toolbar.id
      && selection.entryIndex === entryIndex;

    const hasAssignedImage = hasToolBarPreviewAssignedImage(entry);
    const showUnselectedEntryFrame = toolBarDecoration.showUnselectedEntryFrame
      || shouldShowToolBarPreviewUnselectedFrame(entry, isSelectedEntry);

    if (showUnselectedEntryFrame) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = border;
      ctx.strokeRect(x + 0.5, y + 0.5, 15, 15);
      ctx.restore();
    }

    if (hasAssignedImage) {
      if (!drawPreviewTopLevelAssignedImage(ctx, entry.iconId, x, y, 16, 16)) {
        drawPreviewFallbackImageIcon(ctx, x, y, 16);
      }
    } else if (entry.kind === "ToolBarImageButton") {
      drawPreviewFallbackImageIcon(ctx, x, y, 16);
    } else {
      const label = ((entry.text ?? entry.idRaw ?? entry.kind).replace(/^#/, "").trim().slice(0, 1) || "•").toUpperCase();
      ctx.fillStyle = fg;
      ctx.fillText(label, x + 4, y + 12);
    }

    if (isSelectedEntry) {
      ctx.save();
      ctx.strokeStyle = toolbarSelectedOutlineColor;
      ctx.strokeRect(entryRect.x - 0.5, entryRect.y - 0.5, 18, 18);
      ctx.restore();
    }

    x += getToolBarEntryAdvance(entry.kind);
    if (x >= rect.x + rect.w - 18) break;
  }

  const addIconMetrics = getWindowPreviewAddIconMetrics();
  const addRectX = getTopLevelClampedAddIconX(rect, x);
  const addRect: PreviewToolBarAddRect = {
    toolBarId: toolbar.id,
    x: addRectX,
    y,
    w: addIconMetrics.width,
    h: addIconMetrics.height
  };
  toolBarAddPreviewRect = addRect;
  drawPreviewPlusIcon(ctx, addRect.x, addRect.y);
}


function drawStatusBarPreview(ctx: CanvasRenderingContext2D, rect: PreviewRect, fg: string, osSkin: DesignerSettings["osSkin"]) {
  const statusbar = getPrimaryStatusbar();
  statusBarFieldPreviewRects = [];
  statusBarAddPreviewRect = null;
  if (!statusbar || rect.h <= 0 || rect.w <= 0) return;

  const border = getCssVar("--vscode-panel-border") || fg;
  const statusBarDecoration = getWindowPreviewStatusBarDecoration(osSkin);
  const windowsSkinColors = resolveWindowsSkinColors();
  const statusBarBg = windowsSkinColors?.buttonFace ?? "rgb(240, 240, 240)";
  const statusBarTopSeparatorColor = windowsSkinColors
    ? ensurePreviewLineContrast(
      windowsSkinColors.buttonShadow ?? windowsSkinColors.threeDShadow,
      statusBarBg,
      "rgb(145, 145, 145)"
    )
    : "rgb(145, 145, 145)";
  const statusBarFieldSeparatorColor = windowsSkinColors
    ? ensurePreviewLineContrast(
      windowsSkinColors.threeDLightShadow ?? windowsSkinColors.scrollbar,
      statusBarBg,
      "rgb(215, 215, 215)"
    )
    : "rgb(215, 215, 215)";
  const statusBarTextColor = windowsSkinColors
    ? windowsSkinColors.windowText
    : (statusBarDecoration.textColorStyle === "black"
      ? "rgb(0,0,0)"
      : fg);
  const statusBarSelectedOutlineColor = windowsSkinColors
    ? windowsSkinColors.windowText
    : (statusBarDecoration.selectedOutlineColorStyle === "black"
      ? "rgb(0,0,0)"
      : fg);

  if (statusBarDecoration.backgroundStyle === "macos-gradient") {
    ctx.save();
    const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + 23);
    gradient.addColorStop(0, "rgb(211, 211, 211)");
    gradient.addColorStop(1, "rgb(171, 171, 171)");
    ctx.fillStyle = gradient;
    if (statusBarDecoration.showRoundedBackground && typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 3);
      ctx.fill();
    } else {
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    ctx.restore();
  }

  if (statusBarDecoration.showTopSeparator) {
    ctx.save();
    ctx.strokeStyle = statusBarDecoration.topSeparatorStyle === "macos-dark"
      ? "rgb(118, 118, 118)"
      : statusBarTopSeparatorColor;
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.y + 0.5);
    ctx.lineTo(rect.x + rect.w, rect.y + 0.5);
    ctx.stroke();
    ctx.restore();
  }

  const fieldWidths = getStatusBarFieldWidths(statusbar, Math.max(0, rect.w - statusBarDecoration.widthAdjustment));

  let x = rect.x + statusBarDecoration.fieldInsetX;
  for (let i = 0; i < statusbar.fields.length; i++) {
    const field = statusbar.fields[i];
    const fieldW = fieldWidths[i] ?? 18;
    const fieldRect = getStatusBarFieldPreviewRect(statusbar.id, i, x, rect.y, fieldW, rect.h);
    statusBarFieldPreviewRects.push(fieldRect);
    const isSelectedField = selection?.kind === "statusBarField"
      && selection.statusBarId === statusbar.id
      && selection.fieldIndex === i;

    if (statusBarDecoration.showFieldSeparators && i > 0) {
      ctx.save();
      ctx.strokeStyle = statusBarFieldSeparatorColor;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, rect.y + 1);
      ctx.lineTo(x + 0.5, rect.y + rect.h - 1);
      ctx.stroke();
      ctx.restore();
    }

    const textLabel = (field.text ?? unquotePbString(field.textRaw)).trim();
    if (textLabel.length) {
      ctx.fillStyle = statusBarTextColor;
      const textWidth = Math.ceil(ctx.measureText(textLabel).width);
      const textX = getStatusBarAlignedX(x, fieldW, textWidth, hasPbFlag(field.flagsRaw, "#PB_StatusBar_Center"), hasPbFlag(field.flagsRaw, "#PB_StatusBar_Right"));
      ctx.fillText(textLabel, textX, getStatusBarFieldTextBaselineY(fieldRect));
    } else if (field.progressBar) {
      const progressDecoration = getWindowPreviewStatusBarProgressDecoration(osSkin);
      const progressMetrics = getStatusBarProgressPreviewMetrics(fieldW, rect.h, field.progressRaw ?? "0");
      const trackRect = getStatusBarProgressTrackPreviewRect(
        fieldRect,
        progressMetrics.trackWidth,
        progressMetrics.trackHeight,
        progressDecoration.trackInsetX,
        progressDecoration.trackInsetY
      );
      const trackColor = progressDecoration.trackColorStyle === "windows8"
        ? "rgb(230, 230, 230)"
        : "rgb(220, 220, 220)";
      const fillColor = progressDecoration.fillColorStyle === "windows8"
        ? "rgb(6, 176, 37)"
        : "rgb(134, 206, 244)";
      const borderColor = progressDecoration.borderColorStyle === "windows8"
        ? "rgb(188, 188, 188)"
        : "rgb(152, 152, 152)";

      ctx.save();
      ctx.fillStyle = trackColor;
      if (progressDecoration.trackShape === "rounded") {
        traceRoundedRect(ctx, trackRect.x, trackRect.y, trackRect.w, trackRect.h, progressDecoration.trackRadius);
        ctx.fill();
      } else {
        ctx.fillRect(trackRect.x, trackRect.y, trackRect.w, trackRect.h);
      }

      if (progressMetrics.fillWidth > 0) {
        ctx.fillStyle = fillColor;
        ctx.fillRect(trackRect.x + 1, trackRect.y + 1, progressMetrics.fillWidth, Math.max(2, trackRect.h - 2));
      }

      ctx.strokeStyle = borderColor;
      if (progressDecoration.trackShape === "rounded") {
        traceRoundedRect(ctx, trackRect.x + 0.5, trackRect.y + 0.5, trackRect.w - 1, trackRect.h - 1, progressDecoration.trackRadius);
        ctx.stroke();
      } else {
        ctx.strokeRect(trackRect.x + 0.5, trackRect.y + 0.5, trackRect.w - 1, trackRect.h - 1);
      }
      ctx.restore();
    } else {
      const fallbackSize = 16;
      const previewImage = hasStatusBarPreviewAssignedImage(field)
        ? getPreviewTopLevelAssignedImage(field.imageId)
        : null;
      const previewWidth = previewImage && previewImage.complete && previewImage.naturalWidth > 0
        ? previewImage.naturalWidth
        : fallbackSize;
      const previewHeight = previewImage && previewImage.complete && previewImage.naturalHeight > 0
        ? previewImage.naturalHeight
        : fallbackSize;
      const imageX = getStatusBarAlignedX(
        x,
        fieldW,
        previewWidth,
        hasPbFlag(field.flagsRaw, "#PB_StatusBar_Center"),
        hasPbFlag(field.flagsRaw, "#PB_StatusBar_Right")
      );
      const imageY = getStatusBarFieldImageY(fieldRect, statusBarDecoration.fieldInsetY);
      if (!drawPreviewRasterIcon(ctx, previewImage, imageX, imageY, previewWidth, previewHeight)) {
        drawPreviewFallbackImageIcon(ctx, imageX, imageY, fallbackSize);
      }
    }

    if (isSelectedField) {
      ctx.save();
      ctx.strokeStyle = statusBarSelectedOutlineColor;
      ctx.strokeRect(fieldRect.x + 0.5, fieldRect.y + 0.5, Math.max(0, fieldRect.w - 1), Math.max(0, fieldRect.h - 1));
      ctx.restore();
    }

    x += fieldW;
    if (x >= rect.x + rect.w) break;
  }

  const addIconMetrics = getWindowPreviewAddIconMetrics();
  const addButtonLayout = getStatusBarAddButtonPreviewLayout(rect, x, addIconMetrics.width);
  const addRect: PreviewStatusBarAddRect = {
    statusBarId: statusbar.id,
    ...addButtonLayout.hitRect
  };
  statusBarAddPreviewRect = addRect;
  drawPreviewPlusIcon(ctx, addButtonLayout.iconX, addButtonLayout.iconY);
}

function render() {
  const canvasCssSize = ensureCanvasBitmapSizeForRender();

  menuEntryPreviewRects = [];
  menuFooterPreviewRects = [];
  menuAddPreviewRect = null;
  toolBarAddPreviewRect = null;
  statusBarAddPreviewRect = null;
  toolBarEntryPreviewRects = [];
  statusBarFieldPreviewRects = [];

  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvasCssSize.width, canvasCssSize.height);

  const fg = getComputedStyle(document.body).color;
  const focus = getCssVar("--vscode-focusBorder") || fg;

  ctx.font = "12px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.lineWidth = 1;

  const wr = getWinRect();
  if (!wr) return;

  const winX = wr.x;
  const winY = wr.y;
  const winW = wr.w;
  const winH = wr.h;
  const winTitle = wr.title;
  const tbH = wr.tbH;

  // Outside dim (PB-like)
  if (settings.outsideDimOpacity > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(settings.outsideDimOpacity, 0, 1);
    ctx.fillStyle = fg;
    ctx.fillRect(0, 0, canvasCssSize.width, canvasCssSize.height);
    ctx.restore();
  }

  const bodyDecoration = getWindowPreviewBodyDecoration(settings.osSkin, tbH > 0);
  const platformSkin = resolvePbFormSkinPlatform();
  const windowsChromeColors = platformSkin === "windows" ? resolveWindowsSkinColors() : null;

  // Window fill (so the window area is visually separated)
  if (settings.windowFillOpacity > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(settings.windowFillOpacity, 0, 1);
    if (bodyDecoration.backgroundStyle === "linux-light") {
      ctx.fillStyle = pbColorNumberToCssHex(model.window?.color) ?? "rgb(242, 241, 240)";
      if (bodyDecoration.useRoundedTopFill) {
        traceRoundedTopRect(ctx, winX - 1, winY - 1, winW + 2, winH + 1, bodyDecoration.roundedTopRadius);
        ctx.fill();
      } else {
        ctx.fillRect(winX - 1, winY - 1, winW + 2, winH + 1);
      }
    } else if (bodyDecoration.backgroundStyle === "macos-light") {
      ctx.fillStyle = pbColorNumberToCssHex(model.window?.color) ?? "rgb(237, 237, 237)";
      traceRoundedRect(ctx, winX - 1, winY - 1, winW + 2, winH + 2, bodyDecoration.roundedTopRadius);
      ctx.fill();
    } else if (bodyDecoration.backgroundStyle === "windows7-frame") {
      const gradient = ctx.createLinearGradient(winX, winY, winX + winW, winY);
      gradient.addColorStop(0, windowsChromeColors?.activeTitle ?? "rgb(210, 232, 232)");
      gradient.addColorStop(0.5, windowsChromeColors?.gradientActiveTitle ?? "rgb(184, 220, 250)");
      gradient.addColorStop(1, windowsChromeColors?.activeTitle ?? "rgb(210, 232, 232)");
      ctx.fillStyle = gradient;
      traceRoundedRect(ctx, winX, winY - 1, winW, winH + 1, bodyDecoration.roundedTopRadius);
      ctx.fill();
    } else if (bodyDecoration.backgroundStyle === "windows8-frame") {
      ctx.fillStyle = windowsChromeColors?.activeTitle ?? "rgb(107, 173, 246)";
      ctx.fillRect(winX, winY - 1, winW, winH + 1);
    } else {
      ctx.fillStyle = fg;
      ctx.fillRect(winX, winY, winW, winH);
    }
    ctx.restore();
  } else {
    // Ensure window area is not dimmed by outside fill
    if (bodyDecoration.backgroundStyle === "linux-light" || bodyDecoration.backgroundStyle === "macos-light") {
      ctx.clearRect(winX - 1, winY - 1, winW + 2, winH + 2);
    } else if (bodyDecoration.backgroundStyle === "windows7-frame" || bodyDecoration.backgroundStyle === "windows8-frame") {
      ctx.clearRect(winX, winY - 1, winW, winH + 1);
    } else {
      ctx.clearRect(winX, winY, winW, winH);
    }
  }

  if (bodyDecoration.showBodyOutline) {
    ctx.save();
    ctx.strokeStyle = bodyDecoration.bodyOutlineStyle === "macos-light" ? "rgb(184, 184, 184)" : focus;
    traceRoundedRect(ctx, winX - 1.5, winY - 1.5, winW + 3, winH + 3, bodyDecoration.roundedTopRadius);
    ctx.stroke();
    ctx.restore();
  }

  const chromeMetrics = previewChromeMetrics;
  const chromeTopPadding = getWindowPreviewChromeTopPaddingForCurrentSkin();
  const windowClientSidePadding = getWindowPreviewClientSidePadding(platformSkin, asInt(settings.windowPreviewWindowsClientSidePadding));
  const windowClientBottomPadding = getWindowPreviewClientBottomPadding(platformSkin, asInt(settings.windowPreviewWindowsClientBottomPadding));
  const localChromeLayout = getWindowLocalChromeLayout(chromeMetrics);
  const globalChromeLayout = getWindowGlobalChromeLayout(chromeMetrics);
  const windowClientSurface = getWindowClientSurfaceRects({ x: winX, y: winY, w: winW, h: winH }, chromeTopPadding, windowClientSidePadding, windowClientBottomPadding);
  const windowContentRect = localChromeLayout.contentRect;
  const menuBarRect = globalChromeLayout?.menuBarRect ?? null;
  const toolBarRect = globalChromeLayout?.toolBarRect ?? null;
  const statusBarRect = globalChromeLayout?.statusBarRect ?? null;

  // Grid only inside the client/content area.
  if (settings.showGrid) {
    drawGrid(
      ctx,
      winX + windowContentRect.x,
      winY + windowContentRect.y,
      windowContentRect.w,
      windowContentRect.h,
      settings.gridSize,
      settings.gridOpacity,
      settings.gridMode,
      fg
    );
  }

  if (bodyDecoration.showClientBorder) {
    const hasOriginalWindowsBody = bodyDecoration.clientBorderStyle === "windows7-inner" || bodyDecoration.clientBorderStyle === "windows8-inner";
    const clientBorderY = winY + chromeTopPadding;
    const clientBorderH = Math.max(0, winH - chromeTopPadding);
    if (!hasOriginalWindowsBody && clientBorderH > 0) {
      ctx.save();
      ctx.strokeStyle = bodyDecoration.clientBorderStyle === "linux-dark" ? "rgb(70, 70, 70)" : focus;
      ctx.strokeRect(winX + 0.5, clientBorderY + 0.5, Math.max(0, winW - 1), Math.max(0, clientBorderH - 1));
      ctx.restore();
    }
  }

  if (platformSkin === "windows" && windowClientSidePadding > 0 && windowClientSurface.fillRect.w > 0 && windowClientSurface.fillRect.h > 0) {
    const hasOriginalWindowsBody = bodyDecoration.clientBorderStyle === "windows7-inner" || bodyDecoration.clientBorderStyle === "windows8-inner";

    if (hasOriginalWindowsBody) {
      ctx.save();
      ctx.fillStyle = pbColorNumberToCssHex(model.window?.color)
        ?? windowsChromeColors?.buttonFace
        ?? "rgb(240, 240, 240)";
      ctx.fillRect(
        windowClientSurface.fillRect.x,
        windowClientSurface.fillRect.y,
        windowClientSurface.fillRect.w,
        windowClientSurface.fillRect.h
      );
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = bodyDecoration.clientBorderStyle === "windows7-inner"
        ? (windowsChromeColors?.threeDShadow ?? "rgb(93, 108, 122)")
        : (windowsChromeColors?.gradientActiveTitle ?? windowsChromeColors?.activeTitle ?? "rgb(91, 147, 209)");
      ctx.strokeRect(
        windowClientSurface.borderRect.x + 0.5,
        windowClientSurface.borderRect.y + 0.5,
        Math.max(0, windowClientSurface.borderRect.w - 1),
        Math.max(0, windowClientSurface.borderRect.h - 1)
      );
      ctx.restore();
    } else {
      const leftFrameW = Math.max(0, windowClientSurface.fillRect.x - winX);
      const rightFrameX = windowClientSurface.fillRect.x + windowClientSurface.fillRect.w;
      const rightFrameW = Math.max(0, winX + winW - rightFrameX);

      if (leftFrameW > 0) {
        ctx.save();
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = focus;
        ctx.fillRect(winX, windowClientSurface.fillRect.y, leftFrameW, windowClientSurface.fillRect.h);
        ctx.restore();
      }

      if (rightFrameW > 0) {
        ctx.save();
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = focus;
        ctx.fillRect(rightFrameX, windowClientSurface.fillRect.y, rightFrameW, windowClientSurface.fillRect.h);
        ctx.restore();
      }

      const bottomFrameY = windowClientSurface.fillRect.y + windowClientSurface.fillRect.h;
      const bottomFrameH = Math.max(0, winY + winH - bottomFrameY);
      if (bottomFrameH > 0) {
        ctx.save();
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = focus;
        ctx.fillRect(winX, bottomFrameY, winW, bottomFrameH);
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = focus;
      ctx.strokeRect(
        windowClientSurface.borderRect.x + 0.5,
        windowClientSurface.borderRect.y + 0.5,
        Math.max(0, windowClientSurface.borderRect.w - 1),
        Math.max(0, windowClientSurface.borderRect.h - 1)
      );
      ctx.restore();
    }
  }

  // Optional title bar
  if (tbH > 0) {
    const titleButtonLayout = getWindowPreviewTitleButtonLayout(settings.osSkin, model.window?.flagsExpr);
    const titleButtonSlots = titleButtonLayout.slots;
    const titleBarDecoration = getWindowPreviewTitleBarDecoration(settings.osSkin, Boolean(toolBarRect));
    const titleBarMetrics = getWindowPreviewTitleBarMetrics(settings.osSkin);
    const isWindowsTitleBar = titleBarDecoration.backgroundStyle === "default" && Boolean(windowsChromeColors);
    const titleFg = isWindowsTitleBar
      ? (windowsChromeColors!.titleText ?? windowsChromeColors!.menuText ?? windowsChromeColors!.buttonText ?? "rgb(0, 0, 0)")
      : (titleBarDecoration.useLightForeground ? "rgb(255, 255, 255)" : fg);
    const buttonStrokeColor = titleFg;
    const fallbackButtonSize = Math.max(12, Math.min(18, tbH - 8));
    const fallbackButtonDims = { width: fallbackButtonSize, height: fallbackButtonSize };
    const titleButtonSizes = titleButtonSlots.map(slot => getWindowPreviewTitleButtonSize(settings.osSkin, slot.kind, fallbackButtonDims));
    const buttonGap = titleBarMetrics.buttonGap;
    const buttonAreaW = titleButtonSizes.length > 0
      ? titleButtonSizes.reduce((sum, size) => sum + size.width, 0) + Math.max(0, titleButtonSizes.length - 1) * buttonGap
      : 0;
    const showWindowsIcon = hasWindowPreviewTitleIcon(platformSkin, model.window?.flagsExpr);
    const iconSize = showWindowsIcon
      ? getWindowPreviewTitleIconSize(settings.osSkin, { width: 16, height: 16 })
      : { width: 0, height: 0 };
    const iconX = winX + titleBarMetrics.iconInsetX;
    const iconY = winY + titleBarMetrics.iconOffsetY;
    const leftButtonBandEnd = titleButtonLayout.buttonSide === "left"
      ? winX + titleBarMetrics.buttonInsetX + buttonAreaW
      : winX + titleBarMetrics.buttonInsetX;
    const rightButtonBandStart = titleButtonLayout.buttonSide === "right"
      ? winX + winW - titleBarMetrics.buttonInsetX - buttonAreaW
      : winX + winW - titleBarMetrics.buttonInsetX;
    const windowsTitleTextStart = showWindowsIcon
      ? (settings.osSkin === "windows8"
        ? iconX + iconSize.width
        : iconX + iconSize.width + 5)
      : winX + titleBarMetrics.buttonInsetX;
    const titleLeft = Math.max(windowsTitleTextStart, leftButtonBandEnd);
    const titleRight = Math.min(winX + winW - titleBarMetrics.buttonInsetX, rightButtonBandStart);
    const titleTop = winY + titleBarMetrics.titleOffsetY;

    if (titleBarDecoration.backgroundStyle === "default") {
      if (!isWindowsTitleBar) {
        ctx.save();
        ctx.globalAlpha = 0.10;
        ctx.fillStyle = focus;
        ctx.fillRect(winX, winY, winW, tbH);
        ctx.restore();
      }
    } else if (titleBarDecoration.backgroundStyle === "linux-dark") {
      ctx.save();
      traceRoundedTopRect(ctx, winX - 1, winY - 1, winW + 2, tbH + 1, 6);
      ctx.fillStyle = "rgb(70, 70, 70)";
      ctx.fill();
      ctx.restore();
    } else {
      const gradient = ctx.createLinearGradient(winX, winY, winX, winY + tbH);
      if (titleBarDecoration.backgroundStyle === "macos-toolbar") {
        gradient.addColorStop(0, "rgba(228, 228, 228, 0.96)");
        gradient.addColorStop(1, "rgba(175, 175, 175, 0.96)");
      } else {
        gradient.addColorStop(0, "rgba(228, 228, 228, 0.96)");
        gradient.addColorStop(1, "rgba(183, 183, 183, 0.96)");
      }
      ctx.save();
      ctx.fillStyle = gradient;
      ctx.fillRect(winX, winY, winW, tbH);
      ctx.restore();
    }

    if (titleBarDecoration.showFrameBorder && !isWindowsTitleBar) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = focus;
      ctx.strokeRect(winX + 0.5, winY + 0.5, winW - 1, tbH - 1);
      ctx.restore();
    }

    if (titleBarDecoration.showBottomSeparator) {
      ctx.save();
      if (isWindowsTitleBar) {
        ctx.strokeStyle = windowsChromeColors!.threeDShadow;
      } else {
        ctx.strokeStyle = titleBarDecoration.backgroundStyle === "default" ? focus : "rgb(184, 184, 184)";
        ctx.globalAlpha = titleBarDecoration.backgroundStyle === "default" ? 0.2 : 1;
      }
      ctx.beginPath();
      ctx.moveTo(winX + 0.5, winY + tbH - 0.5);
      ctx.lineTo(winX + winW - 0.5, winY + tbH - 0.5);
      ctx.stroke();
      ctx.restore();
    }

    if (titleBarDecoration.showExtraBottomSeparator) {
      ctx.save();
      ctx.strokeStyle = "rgb(105, 105, 105)";
      ctx.beginPath();
      ctx.moveTo(winX + 0.5, winY + tbH - 0.5);
      ctx.lineTo(winX + winW - 0.5, winY + tbH - 0.5);
      ctx.stroke();
      ctx.restore();
    }

    if (showWindowsIcon) {
      const windowsTitleIconImage = isWindowsTitleBar ? getPreviewWindowsTitleIconImage() : null;
      const drewWindowsTitleIcon = isWindowsTitleBar
        ? drawPreviewRasterIcon(ctx, windowsTitleIconImage, iconX, iconY, iconSize.width, iconSize.height)
        : false;

      if (!drewWindowsTitleIcon) {
        ctx.save();
        if (isWindowsTitleBar) {
          ctx.fillStyle = windowsChromeColors!.inactiveTitle;
          ctx.fillRect(iconX, iconY, iconSize.width, iconSize.height);
          ctx.strokeStyle = titleFg;
        } else {
          ctx.globalAlpha = 0.20;
          ctx.fillStyle = focus;
          ctx.fillRect(iconX, iconY, iconSize.width, iconSize.height);
          ctx.globalAlpha = 0.5;
          ctx.strokeStyle = fg;
        }
        ctx.strokeRect(iconX + 0.5, iconY + 0.5, Math.max(0, iconSize.width - 1), Math.max(0, iconSize.height - 1));
        ctx.restore();

        ctx.save();
        if (!isWindowsTitleBar) {
          ctx.globalAlpha = 0.85;
        }
        ctx.fillStyle = titleFg;
        ctx.fillRect(iconX + 3, iconY + 3, Math.max(4, iconSize.width - 6), Math.max(4, iconSize.height - 6));
        ctx.restore();
      }
    }

    if (titleRight > titleLeft) {
      const titleWidth = ctx.measureText(winTitle).width;
      const titleLayout = getWindowPreviewTitleTextLayout({
        osSkin: settings.osSkin,
        titleAlignment: titleButtonLayout.titleAlignment,
        titleLeft,
        titleRight,
        windowX: winX,
        windowWidth: winW,
        titleWidth,
      });
      ctx.save();
      ctx.beginPath();
      ctx.rect(titleLayout.clipLeft, winY + 2, titleLayout.clipRight - titleLayout.clipLeft, Math.max(0, tbH - 4));
      ctx.clip();
      ctx.textBaseline = "top";
      if (titleBarDecoration.drawShadowedTitle) {
        ctx.fillStyle = "rgb(255, 255, 255)";
        ctx.fillText(winTitle, titleLayout.titleX, titleTop + 1);
        ctx.fillStyle = "rgb(54, 54, 54)";
        ctx.fillText(winTitle, titleLayout.titleX, titleTop);
      } else {
        ctx.fillStyle = titleFg;
        ctx.fillText(winTitle, titleLayout.titleX, titleTop);
      }
      ctx.restore();
    }

    if (titleButtonSlots.length > 0) {
      let buttonX = titleButtonLayout.buttonSide === "left"
        ? winX + titleBarMetrics.buttonInsetX
        : rightButtonBandStart;
      const isMacPreview = titleBarDecoration.buttonStyle === "macos-circles";
      const isLinuxPreview = titleBarDecoration.buttonStyle === "linux-glyphs";
      const isWindowsPreview = isWindowsTitleBar;
      for (let index = 0; index < titleButtonSlots.length; index += 1) {
        const slot = titleButtonSlots[index];
        const size = titleButtonSizes[index] ?? fallbackButtonDims;
        const buttonY = winY + titleBarMetrics.buttonOffsetY;
        const buttonW = size.width;
        const buttonH = size.height;
        const kind = slot.kind;
        const isEnabled = slot.enabled;
        let drewRasterTitleButton = false;
        if (isWindowsPreview && (settings.osSkin === "windows7" || settings.osSkin === "windows8")) {
          drewRasterTitleButton = drawPreviewRasterIcon(
            ctx,
            getPreviewWindowsTitleButtonImage(settings.osSkin, kind, isEnabled),
            buttonX,
            buttonY,
            buttonW,
            buttonH
          );
        } else if (isMacPreview) {
          drewRasterTitleButton = drawPreviewRasterIcon(
            ctx,
            getPreviewMacTitleButtonImage(kind, isEnabled),
            buttonX,
            buttonY,
            buttonW,
            buttonH
          );
        } else if (isLinuxPreview && isEnabled) {
          drewRasterTitleButton = drawPreviewRasterIcon(
            ctx,
            getPreviewLinuxTitleButtonImage(kind),
            buttonX,
            buttonY,
            buttonW,
            buttonH
          );
        }

        if (!drewRasterTitleButton) {
          if (isMacPreview) {
            const radius = Math.max(4, Math.trunc(Math.min(buttonW, buttonH) / 2));
            const cx = buttonX + Math.trunc(buttonW / 2);
            const cy = buttonY + Math.trunc(buttonH / 2);
            ctx.save();
            ctx.globalAlpha = isEnabled ? 0.24 : 0.12;
            ctx.fillStyle = focus;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = isEnabled ? 0.35 : 0.18;
            ctx.strokeStyle = buttonStrokeColor;
            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(0, radius - 0.5), 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          } else if (!isLinuxPreview && !isWindowsPreview) {
            ctx.save();
            ctx.globalAlpha = isEnabled
              ? (kind === "close" ? 0.28 : 0.18)
              : 0.08;
            ctx.fillStyle = focus;
            ctx.fillRect(buttonX, buttonY, buttonW, buttonH);
            ctx.globalAlpha = isEnabled ? 0.45 : 0.16;
            ctx.strokeStyle = buttonStrokeColor;
            ctx.strokeRect(buttonX + 0.5, buttonY + 0.5, Math.max(0, buttonW - 1), Math.max(0, buttonH - 1));
            ctx.restore();
          }

          if (isEnabled || !isMacPreview) {
            ctx.save();
            ctx.strokeStyle = buttonStrokeColor;
            ctx.globalAlpha = isLinuxPreview || isWindowsPreview ? 1 : (isEnabled ? 0.85 : 0.22);
            const glyphBoxWidth = isLinuxPreview ? Math.max(8, buttonW - 9) : Math.min(10, Math.max(6, buttonW - 8));
            const glyphBoxHeight = isLinuxPreview ? Math.max(8, buttonH - 9) : Math.min(8, Math.max(6, buttonH - 8));
            const glyphLeft = buttonX + Math.max(4, Math.trunc((buttonW - glyphBoxWidth) / 2));
            const glyphTop = buttonY + Math.max(4, Math.trunc((buttonH - glyphBoxHeight) / 2));
            const glyphRight = glyphLeft + glyphBoxWidth;
            const glyphBottom = glyphTop + glyphBoxHeight;
            ctx.beginPath();
            if (kind === "close") {
              ctx.moveTo(glyphLeft + 0.5, glyphTop + 0.5);
              ctx.lineTo(glyphRight - 0.5, glyphBottom - 0.5);
              ctx.moveTo(glyphRight - 0.5, glyphTop + 0.5);
              ctx.lineTo(glyphLeft + 0.5, glyphBottom - 0.5);
            } else if (kind === "maximize") {
              ctx.strokeRect(glyphLeft + 0.5, glyphTop + 0.5, Math.max(4, glyphBoxWidth - 1), Math.max(4, glyphBoxHeight - 1));
            } else {
              const lineY = glyphBottom - 0.5;
              ctx.moveTo(glyphLeft + 0.5, lineY);
              ctx.lineTo(glyphRight - 0.5, lineY);
            }
            ctx.stroke();
            ctx.restore();
          }
        }

        buttonX += buttonW + buttonGap;
      }
    }
  }

  if (toolBarRect) {
    drawToolBarPreview(ctx, toolBarRect, fg, settings.osSkin);
    if (selection?.kind === "toolbar" && selection.id === getPrimaryToolbar()?.id) {
      ctx.save();
      ctx.strokeStyle = focus;
      ctx.lineWidth = 2;
      ctx.strokeRect(toolBarRect.x + 0.5, toolBarRect.y + 0.5, toolBarRect.w - 1, toolBarRect.h - 1);
      ctx.restore();
    }
    if (selection?.kind === "toolBarEntry") {
      const sel = selection;
      const entryRect = toolBarEntryPreviewRects.find(entry => entry.ownerId === sel.toolBarId && entry.index === sel.entryIndex);
      if (entryRect) {
        const focusRect = getToolBarEntrySelectionFocusRect(getPrimaryToolbar(), entryRect);
        ctx.save();
        ctx.strokeStyle = focus;
        ctx.lineWidth = 2;
        ctx.strokeRect(focusRect.x + 0.5, focusRect.y + 0.5, focusRect.w - 1, focusRect.h - 1);
        ctx.restore();
      }
    }
    if (drag?.target === "toolBarEntry" && drag.moved && drag.moveTarget) {
      drawTopLevelMoveIndicator(ctx, drag.moveTarget);
    }
  }

  if (statusBarRect) {
    drawStatusBarPreview(ctx, statusBarRect, fg, settings.osSkin);
    if (selection?.kind === "statusbar" && selection.id === getPrimaryStatusbar()?.id) {
      ctx.save();
      ctx.strokeStyle = focus;
      ctx.lineWidth = 2;
      ctx.strokeRect(statusBarRect.x + 0.5, statusBarRect.y + 0.5, statusBarRect.w - 1, statusBarRect.h - 1);
      ctx.restore();
    }
    if (selection?.kind === "statusBarField") {
      const sel = selection;
      const fieldRect = statusBarFieldPreviewRects.find(entry => entry.ownerId === sel.statusBarId && entry.index === sel.fieldIndex);
      if (fieldRect) {
        ctx.save();
        ctx.strokeStyle = focus;
        ctx.lineWidth = 2;
        ctx.strokeRect(fieldRect.x + 0.5, fieldRect.y + 0.5, fieldRect.w - 1, fieldRect.h - 1);
        ctx.restore();
      }
    }
    if (drag?.target === "statusBarField" && drag.moved && drag.moveTarget) {
      drawTopLevelMoveIndicator(ctx, drag.moveTarget, "contrast");
    }
  }

  // Window border
  const frameDecoration = getWindowPreviewFrameDecoration(settings.osSkin);
  drawWindowPreviewFrame(ctx, { x: winX, y: winY, w: winW, h: winH }, frameDecoration, focus, windowsChromeColors);

  // Window resize button, matching FD_DrawResizeButton().
  if (hasWindowPreviewResizeGrip(platformSkin)) {
    const resizeButtonRect = getWindowPreviewResizeButtonRect({ x: winX, y: winY, w: winW, h: winH });

    ctx.save();
    ctx.fillStyle = "rgb(0, 0, 0)";
    ctx.fillRect(resizeButtonRect.x, resizeButtonRect.y, resizeButtonRect.w, resizeButtonRect.h);
    ctx.fillStyle = "rgb(255, 255, 255)";
    ctx.fillRect(resizeButtonRect.x + 1, resizeButtonRect.y + 1, resizeButtonRect.w - 2, resizeButtonRect.h - 2);
    ctx.restore();
  }

  // Window selection overlay
  if (selection?.kind === "window") {
    const selectionStrokeRect = getWindowPreviewFrameStrokeRect(settings.osSkin, { x: winX, y: winY, w: winW, h: winH });

    ctx.save();
    ctx.strokeStyle = focus;
    ctx.lineWidth = 2;
    if (frameDecoration.borderStyle === "macos-rounded" || frameDecoration.borderStyle === "windows7-rounded") {
      traceRoundedRect(
        ctx,
        selectionStrokeRect.x,
        selectionStrokeRect.y,
        selectionStrokeRect.w,
        selectionStrokeRect.h,
        frameDecoration.borderRadius
      );
      ctx.stroke();
    } else {
      ctx.strokeRect(selectionStrokeRect.x, selectionStrokeRect.y, selectionStrokeRect.w, selectionStrokeRect.h);
    }
    ctx.restore();

    drawHandles(ctx, winX, winY, winW, winH, focus);
  }

  const layoutCache = new Map<string, GadgetPreviewLayout>();

  // Gadgets (offset by window origin)
  for (const g of model.gadgets) {
    const layout = getGadgetPreviewLayout(g, chromeMetrics, layoutCache);
    const isHiddenSelected = isGadgetHiddenInDesignerPreview(g.hidden)
      && selection?.kind === "gadget" && g.id === selection.id;

    if (!layout.visible && !isHiddenSelected) continue;

    const gx = winX + layout.rect.x;
    const gy = winY + layout.rect.y;
    const gw = layout.rect.w;
    const gh = layout.rect.h;
    const clipX = winX + layout.clip.x;
    const clipY = winY + layout.clip.y;

    if (layout.visible) {
    ctx.strokeStyle = fg;
    ctx.fillStyle = fg;
    ctx.lineWidth = 1;

    ctx.save();
    ctx.beginPath();
    ctx.rect(clipX, clipY, layout.clip.w, layout.clip.h);
    ctx.clip();

    let labelY = gy + 14;
    let drawDefaultLabel = true;

    switch (g.kind) {
      case GADGET_KIND.ContainerGadget:
        drawContainerGadgetChrome(ctx, g, gx, gy, gw, gh);
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.PanelGadget:
        drawPanelChrome(ctx, g, gx, gy, gw, gh, settings.osSkin, chromeMetrics);
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.ScrollAreaGadget:
        drawScrollAreaChrome(ctx, g, gx, gy, gw, gh, settings.osSkin, chromeMetrics);
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.SplitterGadget:
        drawSplitterChrome(ctx, g, gx, gy, gw, gh, settings.osSkin, chromeMetrics);
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.FrameGadget:
        drawFrameGadgetChrome(ctx, g, gx, gy, gw, gh, settings.osSkin, windowsChromeColors);
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.TrackBarGadget:
        drawTrackBarGadgetChrome(ctx, g, gx, gy, gw, gh, settings.osSkin, windowsChromeColors);
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.ScrollBarGadget:
        drawScrollBarGadgetChrome(ctx, g, gx, gy, gw, gh, settings.osSkin, windowsChromeColors);
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.ButtonGadget:
        drawButtonGadgetChrome(ctx, g, gx, gy, gw, gh, settings.osSkin, windowsChromeColors);
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.CheckBoxGadget:
        drawCheckableGadgetChrome(ctx, g, gx, gy, gw, gh, "checkbox", settings.osSkin, windowsChromeColors);
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.OptionGadget:
        drawCheckableGadgetChrome(ctx, g, gx, gy, gw, gh, "option", settings.osSkin, windowsChromeColors);
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.ComboBoxGadget:
      case GADGET_KIND.ExplorerComboGadget:
        drawComboLikeGadgetChrome(ctx, g, gx, gy, gw, gh, settings.osSkin, windowsChromeColors);
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.SpinGadget:
        drawSpinGadgetChrome(ctx, g, gx, gy, gw, gh, settings.osSkin, windowsChromeColors);
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.ProgressBarGadget:
        drawProgressBarGadgetChrome(ctx, g, gx, gy, gw, gh, settings.osSkin, windowsChromeColors);
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.DateGadget:
        drawDateGadgetChrome(ctx, g, gx, gy, gw, gh, settings.osSkin, windowsChromeColors);
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.CalendarGadget:
        drawCalendarGadgetChrome(ctx, g, gx, gy, gw, gh, windowsChromeColors);
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.ImageGadget:
        drawImageGadgetChrome(ctx, g, gx, gy, gw, gh);
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.ButtonImageGadget:
        drawButtonImageGadgetChrome(ctx, g, gx, gy, gw, gh);
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.CustomGadget:
        drawCustomGadgetChrome(ctx, g, gx, gy, gw, gh);
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.CanvasGadget:
        drawCanvasLikeGadgetChrome(ctx, g, gx, gy, gw, gh, "Canvas Gadget");
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.OpenGLGadget:
        drawCanvasLikeGadgetChrome(ctx, g, gx, gy, gw, gh, "OpenGL Gadget");
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.WebGadget:
        drawWebLikeGadgetChrome(ctx, g, gx, gy, gw, gh, "Web");
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.WebViewGadget:
        drawWebLikeGadgetChrome(ctx, g, gx, gy, gw, gh, "WebView");
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.StringGadget:
      case GADGET_KIND.IPAddressGadget:
        drawStringLikeGadgetChrome(ctx, g, gx, gy, gw, gh, settings.osSkin, windowsChromeColors);
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.TextGadget:
      case GADGET_KIND.HyperLinkGadget:
        drawTextLikeGadgetChrome(ctx, g, gx, gy, gw, gh, settings.osSkin, windowsChromeColors);
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.TreeGadget:
        drawListLikeGadgetChrome(ctx, g, gx, gy, gw, gh, "tree", windowsChromeColors);
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.ListViewGadget:
        drawListLikeGadgetChrome(ctx, g, gx, gy, gw, gh, "listview", windowsChromeColors);
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.EditorGadget:
        drawListLikeGadgetChrome(ctx, g, gx, gy, gw, gh, "editor", windowsChromeColors);
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.ScintillaGadget:
        drawListLikeGadgetChrome(ctx, g, gx, gy, gw, gh, "scintilla", windowsChromeColors);
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.ListIconGadget:
        drawListIconLikeGadgetChrome(ctx, g, gx, gy, gw, gh, "listicon", windowsChromeColors);
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.ExplorerTreeGadget:
        drawExplorerTreeGadgetChrome(ctx, g, gx, gy, gw, gh, windowsChromeColors);
        drawDefaultLabel = false;
        break;

      case GADGET_KIND.ExplorerListGadget:
        drawListIconLikeGadgetChrome(ctx, g, gx, gy, gw, gh, "explorerlist", windowsChromeColors);
        drawDefaultLabel = false;
        break;

      default:
        ctx.strokeRect(gx + 0.5, gy + 0.5, gw, gh);
        break;
    }

    if (drawDefaultLabel) {
      ctx.fillText(`${g.kind} ${g.id}`, gx + 4, labelY);
    }

    if (isGadgetDisabledInDesignerPreview(g.disabled)) {
      drawDisabledGadgetOverlay(ctx, gx, gy, gw, gh);
    }

    ctx.restore();
    } // end if (layout.visible)

    const sel = selection;
    if (sel && sel.kind === "gadget" && g.id === sel.id) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(clipX, clipY, layout.clip.w, layout.clip.h);
      ctx.clip();
      ctx.strokeStyle = focus;
      ctx.lineWidth = 2;
      ctx.strokeRect(gx + 0.5, gy + 0.5, gw, gh);
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.rect(clipX, clipY, layout.clip.w, layout.clip.h);
      ctx.clip();
      drawHandles(ctx, gx, gy, gw, gh, focus);
      ctx.restore();
    }
  }

  if (menuBarRect) {
    drawMenuBarPreview(ctx, menuBarRect, fg, settings.osSkin);
    if (selection?.kind === "menu" && selection.id === getPrimaryMenu()?.id) {
      ctx.save();
      ctx.strokeStyle = focus;
      ctx.lineWidth = 2;
      ctx.strokeRect(menuBarRect.x + 0.5, menuBarRect.y + 0.5, menuBarRect.w - 1, menuBarRect.h - 1);
      ctx.restore();
    }
    if (selection?.kind === "menuEntry") {
      const sel = selection;
      const entryRect = menuEntryPreviewRects.find(entry => entry.ownerId === sel.menuId && entry.index === sel.entryIndex);
      if (entryRect) {
        ctx.save();
        ctx.strokeStyle = focus;
        ctx.lineWidth = 2;
        ctx.strokeRect(entryRect.x + 0.5, entryRect.y + 0.5, entryRect.w - 1, entryRect.h - 1);
        ctx.restore();
      }
    }

    if (drag?.target === "menuEntry" && drag.moved && drag.moveTarget) {
      const indicatorMode = drag.moveTarget.indicatorOrientation === "vertical" ? "contrast" : "original";
      drawTopLevelMoveIndicator(ctx, drag.moveTarget, indicatorMode);
    }
  }
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  w: number,
  h: number,
  size: number,
  opacity: number,
  mode: GridMode,
  color: string
) {
  if (size < 2) return;

  ctx.save();
  ctx.globalAlpha = clamp(opacity, 0, 1);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1;

  if (mode === "lines") {
    ctx.beginPath();
    for (let x = 0; x <= w; x += size) {
      ctx.moveTo(ox + x + 0.5, oy);
      ctx.lineTo(ox + x + 0.5, oy + h);
    }
    for (let y = 0; y <= h; y += size) {
      ctx.moveTo(ox, oy + y + 0.5);
      ctx.lineTo(ox + w, oy + y + 0.5);
    }
    ctx.stroke();
  } else {
    const r = 1;
    const maxDots = 350_000;
    let dots = 0;

    for (let y = 0; y <= h; y += size) {
      for (let x = 0; x <= w; x += size) {
        ctx.fillRect(ox + x - r, oy + y - r, r * 2, r * 2);
        dots++;
        if (dots >= maxDots) break;
      }
      if (dots >= maxDots) break;
    }
  }

  ctx.restore();
}

function drawHandles(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, stroke: string) {
  const s = HANDLE_SIZE;
  const hs = s / 2;

  const pts: Array<[number, number]> = [
    [x, y],
    [x + w / 2, y],
    [x + w, y],
    [x, y + h / 2],
    [x + w, y + h / 2],
    [x, y + h],
    [x + w / 2, y + h],
    [x + w, y + h],
  ];

  const fill = getCssVar("--vscode-editor-background") || "transparent";

  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;

  for (const [px, py] of pts) {
    const rx = Math.round(px - hs) + 0.5;
    const ry = Math.round(py - hs) + 0.5;
    ctx.fillRect(rx, ry, s, s);
    ctx.strokeRect(rx, ry, s, s);
  }

  ctx.restore();
}

function traceRoundedTopRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  const clampedRadius = Math.max(0, Math.min(Math.trunc(radius), Math.trunc(w / 2), Math.trunc(h)));
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + clampedRadius);
  ctx.quadraticCurveTo(x, y, x + clampedRadius, y);
  ctx.lineTo(x + w - clampedRadius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + clampedRadius);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

function traceRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  const clampedRadius = Math.max(0, Math.min(Math.trunc(radius), Math.trunc(w / 2), Math.trunc(h / 2)));
  ctx.beginPath();
  ctx.moveTo(x + clampedRadius, y);
  ctx.lineTo(x + w - clampedRadius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + clampedRadius);
  ctx.lineTo(x + w, y + h - clampedRadius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - clampedRadius, y + h);
  ctx.lineTo(x + clampedRadius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - clampedRadius);
  ctx.lineTo(x, y + clampedRadius);
  ctx.quadraticCurveTo(x, y, x + clampedRadius, y);
  ctx.closePath();
}

function drawWindowPreviewFrame(
  ctx: CanvasRenderingContext2D,
  rect: PreviewRect,
  decoration: ReturnType<typeof getWindowPreviewFrameDecoration>,
  focus: string,
  windowsChromeColors?: ReturnType<typeof resolveWindowsSkinColors>
) {
  ctx.save();
  ctx.globalAlpha = decoration.strokeAlpha;
  ctx.strokeStyle = decoration.strokeColorStyle === "macos-dark"
    ? "rgb(118, 118, 118)"
    : decoration.strokeColorStyle === "windows7-dark"
      ? (windowsChromeColors?.buttonText ?? windowsChromeColors?.menuText ?? "rgb(37, 37, 37)")
      : decoration.strokeColorStyle === "windows8-blue"
        ? (windowsChromeColors?.activeTitle ?? windowsChromeColors?.hotTrackingColor ?? "rgb(82, 132, 188)")
        : focus;

  if (decoration.borderStyle === "none") {
    ctx.restore();
    return;
  }

  const strokeRect = getWindowPreviewFrameStrokeRect(settings.osSkin, rect);

  if (decoration.borderStyle === "macos-rounded" || decoration.borderStyle === "windows7-rounded") {
    traceRoundedRect(ctx, strokeRect.x, strokeRect.y, strokeRect.w, strokeRect.h, decoration.borderRadius);
    ctx.stroke();
  } else {
    ctx.strokeRect(strokeRect.x, strokeRect.y, strokeRect.w, strokeRect.h);
  }

  ctx.restore();
}

function renderList() {
  listEl.innerHTML = "";

  type Node = {
    kind: "window" | "gadget" | "menu" | "menuEntry" | "toolbar" | "toolBarEntry" | "statusbar" | "statusBarField" | "images" | "image";
    id: string;
    label: string;
    selectable: boolean;
    children: Node[];
  };

  const keyOf = (n: Node) => `${n.kind}:${n.id}`;

  const isSel = (n: Node): boolean => {
    const sel = selection;
    if (!sel) return false;
    if (n.kind === "window") return sel.kind === "window";
    if (n.kind === "gadget") return sel.kind === "gadget" && sel.id === n.id;
    if (n.kind === "menu") return sel.kind === "menu" && sel.id === n.id;
    if (n.kind === "menuEntry") return sel.kind === "menuEntry" && `${sel.menuId}:${sel.entryIndex}` === n.id;
    if (n.kind === "toolbar") return sel.kind === "toolbar" && sel.id === n.id;
    if (n.kind === "toolBarEntry") return sel.kind === "toolBarEntry" && `${sel.toolBarId}:${sel.entryIndex}` === n.id;
    if (n.kind === "statusbar") return sel.kind === "statusbar" && sel.id === n.id;
    if (n.kind === "statusBarField") return sel.kind === "statusBarField" && `${sel.statusBarId}:${sel.fieldIndex}` === n.id;
    if (n.kind === "images") return sel.kind === "images";
    if (n.kind === "image") return sel.kind === "image" && sel.id === n.id;
    return false;
  };

  const gadgetMap = new Map<string, Gadget>();
  const childrenMap = new Map<string, string[]>();
  for (const g of model.gadgets) {
    gadgetMap.set(g.id, g);
    const p = g.parentId ?? "__root__";
    if (!childrenMap.has(p)) childrenMap.set(p, []);
    childrenMap.get(p)!.push(g.id);
  }

  const gadgetNode = (id: string): Node => {
    const g = gadgetMap.get(id)!;
    const kids = childrenMap.get(id) ?? [];

    const itemsCnt = g.items?.length ?? 0;
    const colsCnt = g.columns?.length ?? 0;
    const tab = typeof g.parentItem === "number" ? `  tab:${g.parentItem}` : "";
    const extra = `${itemsCnt ? `  items:${itemsCnt}` : ""}${colsCnt ? `  cols:${colsCnt}` : ""}${tab}`;

    return {
      kind: "gadget",
      id,
      label: `${g.kind}  ${g.id}${extra}`,
      selectable: true,
      children: kids.map(gadgetNode)
    };
  };

  const menuNodes: Node[] = (model.menus ?? []).map(m => {
    const entries = (m.entries ?? []).map((e, idx) => {
      const prefix = " ".repeat(Math.max(0, (e.level ?? 0)) * 2);
      const text = e.text ?? e.textRaw ?? "";
      const idPart = e.idRaw ? ` ${e.idRaw}` : "";
      return {
        kind: "menuEntry" as const,
        id: `${m.id}:${idx}`,
        label: `${prefix}${e.kind}${idPart}${text ? `  ${text}` : ""}`,
        selectable: true,
        children: []
      };
    });

    return {
      kind: "menu" as const,
      id: m.id,
      label: `Menu  ${m.id}  entries:${m.entries?.length ?? 0}`,
      selectable: true,
      children: entries
    };
  });

  const toolbarNodes: Node[] = (model.toolbars ?? []).map(t => {
    const entries = (t.entries ?? []).flatMap((e, idx) => {
      if (!shouldShowToolBarStructureEntry(t, idx)) return [];
      const text = e.text ?? e.textRaw ?? "";
      const idPart = e.idRaw ? ` ${e.idRaw}` : "";
      return [{
        kind: "toolBarEntry" as const,
        id: `${t.id}:${idx}`,
        label: `${e.kind}${idPart}${text ? `  ${text}` : ""}${e.iconRaw ? `  ${e.iconRaw}` : ""}`,
        selectable: true,
        children: []
      }];
    });

    return {
      kind: "toolbar" as const,
      id: t.id,
      label: `ToolBar  ${t.id}  entries:${getVisibleToolBarEntryCount(t)}`,
      selectable: true,
      children: entries
    };
  });

  const statusbarNodes: Node[] = (model.statusbars ?? []).map(sb => {
    const fields = (sb.fields ?? []).map((f, idx) => ({
      kind: "statusBarField" as const,
      id: `${sb.id}:${idx}`,
      label: `Field  ${idx}  width:${f.widthRaw}`,
      selectable: true,
      children: []
    }));

    return {
      kind: "statusbar" as const,
      id: sb.id,
      label: `StatusBar  ${sb.id}  fields:${sb.fields?.length ?? 0}`,
      selectable: true,
      children: fields
    };
  });

  const imageNodes: Node[] = [{
    kind: "images" as const,
    id: "images",
    label: `Images  entries:${model.images?.length ?? 0}`,
    selectable: true,
    children: (model.images ?? []).map((img) => ({
      kind: "image" as const,
      id: img.id,
      label: `${buildFormImageLineLabel(img)}  refs:${countImageUsages(img.id)}`,
      selectable: true,
      children: []
    }))
  }];

  const roots: Node[] = [];
  if (model.window) {
    roots.push({ kind: "window", id: model.window.id, label: `Window  ${model.window.id}`, selectable: true, children: [] });
  }

  const gadgetRoots = (childrenMap.get("__root__") ?? []).map(gadgetNode);
  roots.push(...gadgetRoots);

  // Attach non-visual structures under the window node (if present)
  if (roots.length > 0 && roots[0].kind === "window") {
    const win = roots[0];
    win.children = [...imageNodes, ...menuNodes, ...toolbarNodes, ...statusbarNodes];
  } else {
    roots.push(...imageNodes, ...menuNodes, ...toolbarNodes, ...statusbarNodes);
  }

  const ensureExpanded = (n: Node) => {
    const k = keyOf(n);
    if (!expanded.has(k)) {
      // Expand container gadgets and the window by default.
      const defaultExpanded = n.kind === "window"
        || n.kind === "menu"
        || n.kind === "toolbar"
        || n.kind === "statusbar"
        || (n.kind === "gadget" && canHostInsertedGadgets(gadgetMap.get(n.id)));
      expanded.set(k, defaultExpanded);
    }
    return expanded.get(k)!;
  };

  const renderNode = (n: Node, depth: number) => {
    const div = document.createElement("div");
    div.className = "treeItem" + (isSel(n) ? " sel" : "");
    div.style.paddingLeft = `${8 + depth * 14}px`;

    const twisty = document.createElement("div");
    twisty.className = "twisty";

    const hasKids = n.children.length > 0;
    const isOpen = hasKids ? ensureExpanded(n) : false;
    twisty.textContent = hasKids ? (isOpen ? "▾" : "▸") : "";

    twisty.onclick = (ev) => {
      ev.stopPropagation();
      if (!hasKids) return;
      expanded.set(keyOf(n), !isOpen);
      renderListAndParentSelector();
    };

    const label = document.createElement("div");
    label.textContent = n.label;

    div.appendChild(twisty);
    div.appendChild(label);

    div.onclick = () => {
      if (!n.selectable) return;
      if (n.kind === "window") selection = { kind: "window" };
      else if (n.kind === "gadget") {
        selection = { kind: "gadget", id: n.id };
        const syncedPanelItems = syncPanelActiveItemsForSelection(panelActiveItems, model.gadgets, n.id);
        panelActiveItems.clear();
        syncedPanelItems.forEach((item, panelId) => panelActiveItems.set(panelId, item));
      }
      else if (n.kind === "menu") selection = { kind: "menu", id: n.id };
      else if (n.kind === "menuEntry") {
        const [menuId, entryIndexRaw] = n.id.split(":");
        selection = { kind: "menuEntry", menuId, entryIndex: Number(entryIndexRaw) };
      }
      else if (n.kind === "toolbar") selection = { kind: "toolbar", id: n.id };
      else if (n.kind === "toolBarEntry") {
        const [toolBarId, entryIndexRaw] = n.id.split(":");
        selection = { kind: "toolBarEntry", toolBarId, entryIndex: Number(entryIndexRaw) };
      }
      else if (n.kind === "statusbar") selection = { kind: "statusbar", id: n.id };
      else if (n.kind === "statusBarField") {
        const [statusBarId, fieldIndexRaw] = n.id.split(":");
        selection = { kind: "statusBarField", statusBarId, fieldIndex: Number(fieldIndexRaw) };
      }
      else if (n.kind === "images") selection = { kind: "images" };
      else if (n.kind === "image") selection = { kind: "image", id: n.id };
      render();
      renderListAndParentSelector();
      renderProps();
    };

    listEl.appendChild(div);

    if (hasKids && isOpen) {
      for (const c of n.children) {
        renderNode(c, depth + 1);
      }
    }
  };

  for (const n of roots) {
    renderNode(n, 0);
  }
}

function renderParentSelector() {
  if (!parentSelEl) return;

  const parentMap = new Map<string, string | undefined>();
  for (const g of model.gadgets) parentMap.set(g.id, g.parentId);

  const depthOf = (id: string): number => {
    let depth = 0;
    let cur = parentMap.get(id);
    const seen = new Set<string>();
    while (cur && !seen.has(cur) && depth < 40) {
      seen.add(cur);
      depth++;
      cur = parentMap.get(cur);
    }
    return depth;
  };

  const opts: Array<{ value: string; label: string }> = [];
  if (model.window) {
    opts.push({ value: "window", label: `Window  ${model.window.id}` });
  }

  const containers = model.gadgets
    .filter(g => canHostInsertedGadgets(g))
    .sort((a, b) => depthOf(a.id) - depthOf(b.id));

  for (const g of containers) {
    const depth = depthOf(g.id);
    const pad = " ".repeat(depth * 2);
    opts.push({ value: `gadget:${g.id}`, label: `${pad}${g.kind}  ${g.id}` });
  }

  const computeCurrent = (): string => {
    const sel = selection;
    if (!sel) return opts[0]?.value ?? "window";
    if (sel.kind === "window") return "window";
    if (sel.kind === "gadget") {
      const g = model.gadgets.find(x => x.id === sel.id);
      if (g?.parentId) return `gadget:${g.parentId}`;
      return "window";
    }
    return "window";
  };

  const current = computeCurrent();

  parentSelEl.onchange = () => {
    const v = parentSelEl.value;
    if (v === "window") {
      selection = { kind: "window" };
    } else if (v.startsWith("gadget:")) {
      const id = v.slice("gadget:".length);
      selection = { kind: "gadget", id };
    }
    renderSelectionUiWithParentSelector();
  };

  parentSelEl.innerHTML = "";
  for (const o of opts) {
    const opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.label;
    parentSelEl.appendChild(opt);
  }

  if (opts.some(o => o.value === current)) {
    parentSelEl.value = current;
  } else if (opts.length) {
    parentSelEl.value = opts[0].value;
  }
}

function getEditableSplitterState(g: Gadget): number {
  if (typeof g.state === "number" && Number.isFinite(g.state)) {
    return Math.trunc(g.state);
  }

  const metrics = previewChromeMetrics;
  const vertical = hasPbFlag(g.flagsExpr, "#PB_Splitter_Vertical");
  const range = Math.max(0, (vertical ? g.w : g.h) - metrics.splitterWidth);
  return Math.trunc(range / 2);
}

function renderProps() {
  propsEl.innerHTML = "";
  renderInfoPanel();

  const section = (title: string) => {
    const h = document.createElement("div");
    h.className = "subHeader";
    h.textContent = title;
    return h;
  };

  const sel = selection;
  if (!sel) {
    return;
  }

  const miniList = () => {
    const d = document.createElement("div");
    d.className = "miniList";
    return d;
  };

  const miniRow = (
    label: string,
    onEdit?: () => void,
    onDelete?: () => void,
    ...extras: { label: string; onClick?: () => void; disabled?: boolean; title?: string }[]
  ) => {
    const r = document.createElement("div");
    r.className = "miniRow";

    const l = document.createElement("div");
    l.textContent = label;
    r.appendChild(l);

    const actions: ({ label: string; onClick?: () => void; disabled?: boolean; title?: string } | undefined)[] = [
      { label: "Edit", onClick: onEdit, disabled: !onEdit },
      { label: "Del", onClick: onDelete, disabled: !onDelete },
      ...extras,
    ];

    for (const action of actions) {
      const button = document.createElement("button");
      button.textContent = action?.label ?? "";
      button.disabled = !action || Boolean(action.disabled) || !action.onClick;
      button.hidden = !action;
      button.title = action?.title ?? "";
      button.onclick = () => action?.onClick?.();
      r.appendChild(button);
    }

    return r;
  };

  const createPendingDestructiveActionEl = () => {
    if (!pendingDestructiveAction) return null;

    const wrap = document.createElement("div");
    wrap.appendChild(section("Confirm Action"));
    wrap.appendChild(mutedNote(pendingDestructiveAction.message));

    const actions = document.createElement("div");
    actions.className = "miniActions";

    const confirmBtn = document.createElement("button");
    confirmBtn.textContent = pendingDestructiveAction.confirmLabel;
    confirmBtn.onclick = () => confirmDestructiveAction();

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.onclick = () => closeDestructiveAction();

    actions.appendChild(confirmBtn);
    actions.appendChild(cancelBtn);
    wrap.appendChild(actions);
    return wrap;
  };

  if (sel.kind === "window") {
    if (!model.window) {
      propsEl.innerHTML = "<div class='muted'>No window</div>";
      return;
    }

    const win = model.window;
    const variableName = (win.variable ?? win.firstParam.replace(/^#/, "")) || "Window_0";
    const enumSymbol = variableName ? `#${variableName.trim()}` : "#Window_0";
    const knownFlags = new Set(win.knownFlags ?? []);
    const customFlagsValue = (win.customFlags ?? []).join(" | ");
    const windowBaseRowsField = getWindowBaseRowsFieldConfig();
    const windowParentField = getWindowParentFieldConfig();
    const windowColorField = getWindowColorFieldConfig();
    const windowGenerateEventProcField = getWindowGenerateEventProcFieldConfig();
    const windowGenerateEventProcEditState = getWindowGenerateEventProcEditState(
      Boolean(win.generateEventLoop),
      Boolean(win.hasEventMenuBlock),
      Boolean(win.hasEventGadgetCaseBranches)
    );
    const windowHiddenField = getWindowHiddenFieldConfig();
    const windowDisabledField = getWindowDisabledFieldConfig();
    const windowEnumValueField = getWindowEnumValueFieldConfig(Boolean(win.pbAny));
    const windowSelectProcField = getWindowSelectProcFieldConfig();
    const windowConstantsField = getWindowConstantsFieldConfig();

    if (windowBaseRowsField.visible) {
      propsEl.appendChild(section("Properties"));
    }
    propsEl.appendChild(row(PB_ANY, checkboxInput(win.pbAny, v => {
      vscode.postMessage({
        type: WEBVIEW_TO_EXT_MSG_TYPE.toggleWindowPbAny,
        windowKey: win.id,
        toPbAny: v,
        variableName,
        enumSymbol,
        enumValueRaw: win.enumValueRaw
      });
    })));

    const windowVariableInputValue = getWindowVariableInspectorValue(win.variable);
    propsEl.appendChild(row("Variable", textInput(windowVariableInputValue, v => {
      const parsed = parseWindowVariableNameInspectorInput(v, windowVariableInputValue);
      if (!parsed.ok) {
        clearInfoError();
        renderProps();
        return;
      }
      vscode.postMessage({
        type: WEBVIEW_TO_EXT_MSG_TYPE.setWindowVariableName,
        windowKey: win.id,
        variableName: parsed.value
      });
    })));

    propsEl.appendChild(row(
      "Caption is a variable?",
      checkboxInput(Boolean(win.captionVariable), checked => {
        if (!model.window) return;
        if (checked && !ensureValidPbVariableReference(win.title ?? "")) {
          renderProps();
          return;
        }
        clearInfoError();
        win.captionVariable = checked;
        const nextCaptionRaw = buildWindowCaptionRaw(win.title ?? "", checked);
        win.captionRaw = nextCaptionRaw;
        postWindowOpenArgs(win, { captionRaw: nextCaptionRaw });
        renderProps();
      })
    ));

    propsEl.appendChild(row(
      "Caption",
      textInput(win.title ?? "", v => {
        if (!model.window) return;
        if (Boolean(win.captionVariable) && !ensureValidPbVariableReference(v)) {
          renderProps();
          return;
        }
        clearInfoError();
        win.title = v;
        const nextCaptionRaw = buildWindowCaptionRaw(v, Boolean(win.captionVariable));
        win.captionRaw = nextCaptionRaw;
        postWindowOpenArgs(win, { captionRaw: nextCaptionRaw });
      })
    ));

    if (windowEnumValueField.visible) {
      const enumValueInput = textInput(win.enumValueRaw ?? "", v => {
        vscode.postMessage({
          type: WEBVIEW_TO_EXT_MSG_TYPE.setWindowEnumValue,
          enumSymbol,
          enumValueRaw: v.trim().length ? v.trim() : undefined
        });
      }, { title: windowEnumValueField.title });
      enumValueInput.disabled = !windowEnumValueField.valueEditable;
      propsEl.appendChild(row("Enum Value", enumValueInput));
    }

    propsEl.appendChild(section("Layout"));
    propsEl.appendChild(row("X", textInput(getInspectorLayoutDisplayValue(win.xRaw, win.x), v => {
      if (!model.window) return;
      postWindowPositionRaw(win, "x", v);
    }, { title: `Enter an integer value or ${WINDOW_POSITION_IGNORE_LITERAL}.` })));
    if (shouldShowReadonlyUnscaledLayoutRows()) {
      propsEl.appendChild(row("X (Unscaled)", readonlyInput(getReadonlyUnscaledLayoutValue(win.xRaw, win.x), "Readonly code value written to OpenWindow(...).")));
    }
    propsEl.appendChild(row("Y", textInput(getInspectorLayoutDisplayValue(win.yRaw, win.y), v => {
      if (!model.window) return;
      postWindowPositionRaw(win, "y", v);
    }, { title: `Enter an integer value or ${WINDOW_POSITION_IGNORE_LITERAL}.` })));
    if (shouldShowReadonlyUnscaledLayoutRows()) {
      propsEl.appendChild(row("Y (Unscaled)", readonlyInput(getReadonlyUnscaledLayoutValue(win.yRaw, win.y), "Readonly code value written to OpenWindow(...).")));
    }
    propsEl.appendChild(row("Width", numberInput(win.w, v => { if (!model.window) return; updateWindowDisplayField(win, "w", asInt(v)); postWindowRect(); render(); renderProps(); })));
    if (shouldShowReadonlyUnscaledLayoutRows()) {
      propsEl.appendChild(row("Width (Unscaled)", readonlyInput(getReadonlyUnscaledLayoutValue(win.wRaw, win.w), "Readonly code value written to OpenWindow(...).")));
    }
    propsEl.appendChild(row("Height", numberInput(win.h, v => { if (!model.window) return; updateWindowDisplayField(win, "h", asInt(v)); postWindowRect(); render(); renderProps(); })));
    if (shouldShowReadonlyUnscaledLayoutRows()) {
      propsEl.appendChild(row("Height (Unscaled)", readonlyInput(getReadonlyUnscaledLayoutValue(win.hRaw, win.h), "Readonly code value written to OpenWindow(...).")));
    }
    if (windowHiddenField.visible) {
      propsEl.appendChild(row("Hidden", checkboxInput(getWindowBooleanInspectorState(win.hiddenRaw, win.hidden), checked => {
        if (!model.window) return;
        win.hidden = checked;
        win.hiddenRaw = checked ? windowHiddenField.checkedValue : windowHiddenField.uncheckedValue;
        postWindowProperties(win, { hiddenRaw: win.hiddenRaw });
        renderProps();
      }, { title: windowHiddenField.title })));
    }
    if (windowDisabledField.visible) {
      propsEl.appendChild(row("Disabled", checkboxInput(getWindowBooleanInspectorState(win.disabledRaw, win.disabled), checked => {
        if (!model.window) return;
        win.disabled = checked;
        win.disabledRaw = checked ? windowDisabledField.checkedValue : windowDisabledField.uncheckedValue;
        postWindowProperties(win, { disabledRaw: win.disabledRaw });
        renderProps();
      }, { title: windowDisabledField.title })));
    }
    const parentAsRawExpression = getWindowParentAsRawExpressionWithOverride(
      win.parentRaw,
      win.parent,
      windowParentAsRawExpressionOverrides.get(win.id)
    );
    const parentInput = textInput(getWindowParentInspectorValue(win.parentRaw, win.parent), v => {
      if (!model.window) return;
      const parsed = parseWindowParentInspectorInput(v, parentAsRawExpressionCheckbox.checked);
      win.parentRaw = parsed.raw || undefined;
      win.parent = parsed.storedValue;
      postWindowOpenArgs(win, { parentRaw: parsed.raw });
    });
    parentInput.disabled = !windowParentField.valueEditable;
    parentInput.title = windowParentField.title;
    const parentAsRawExpressionCheckbox = checkboxInput(parentAsRawExpression, checked => {
      if (!model.window) return;
      windowParentAsRawExpressionOverrides.set(win.id, checked);
      const parsed = parseWindowParentInspectorInput(parentInput.value, checked);
      win.parentRaw = parsed.raw || undefined;
      win.parent = parsed.storedValue;
      if (parsed.raw.length > 0) {
        postWindowOpenArgs(win, { parentRaw: parsed.raw });
      }
      renderProps();
    });
    parentAsRawExpressionCheckbox.disabled = !windowParentField.rawExpressionToggleAvailable;
    parentAsRawExpressionCheckbox.title = windowParentField.rawExpressionTitle;
    if (windowParentField.visible) {
      propsEl.appendChild(row("Parent", parentInput));
      propsEl.appendChild(row("Parent as raw expression", parentAsRawExpressionCheckbox));
    }
    const windowColorInput = readonlyInput(getWindowColorInspectorDisplay(win.colorRaw));
    windowColorInput.title = windowColorField.title;
    const windowColorPicker = document.createElement("input");
    windowColorPicker.type = "color";
    windowColorPicker.value = pbColorNumberToCssHex(win.color) ?? "#000000";
    windowColorPicker.title = "Choose a window color. The value is saved as RGB(...).";
    windowColorPicker.style.width = "40px";
    windowColorPicker.style.minWidth = "40px";
    windowColorPicker.style.padding = "0";
    windowColorPicker.onchange = () => {
      if (!model.window) return;
      const nextColorRaw = cssHexToPbRgbRaw(windowColorPicker.value);
      if (!nextColorRaw) return;
      const parsedColor = parseWindowColorInspectorInput(nextColorRaw);
      clearInfoError();
      win.colorRaw = nextColorRaw;
      if (parsedColor.ok) {
        win.color = parsedColor.previewColor;
      }
      postWindowProperties(win, { colorRaw: nextColorRaw });
      renderProps();
    };
    const clearWindowColorBtn = document.createElement("button");
    clearWindowColorBtn.textContent = "Remove";
    clearWindowColorBtn.disabled = !(win.colorRaw?.trim() || typeof win.color === "number");
    clearWindowColorBtn.title = clearWindowColorBtn.disabled
      ? "No window color is set."
      : "Remove the current window color.";
    clearWindowColorBtn.onclick = () => {
      if (!model.window) return;
      clearInfoError();
      win.colorRaw = undefined;
      win.color = undefined;
      postWindowProperties(win, { colorRaw: "" });
      renderProps();
    };
    if (windowColorField.visible) {
      propsEl.appendChild(row("Color", inputWithActions(windowColorInput, windowColorPicker, clearWindowColorBtn)));
      propsEl.appendChild(mutedNote("Use the picker to set the window color. Remove clears the current color."));
    }
    if (windowGenerateEventProcField.visible) {
      propsEl.appendChild(row(
        "Generate events procedure?",
        checkboxInput(Boolean(win.generateEventLoop), v => {
        if (!model.window) return;
        win.generateEventLoop = v;
        post({ type: WEBVIEW_TO_EXT_MSG_TYPE.setWindowGenerateEventLoop, windowKey: win.id, enabled: v });
        renderProps();
      }, {
        title: windowGenerateEventProcEditState.title,
        disabled: !windowGenerateEventProcField.valueEditable || !windowGenerateEventProcEditState.valueEditable
      })
      ));
    }
    if (windowSelectProcField.visible) {
      propsEl.appendChild(row(
        "SelectProc",
      editableComboInput(
        win.eventProc ?? "",
        getProcedureSuggestions(),
        v => {
          if (!model.window) return;
          const parsed = parseWindowEventProcInspectorInput(v);
          win.eventProc = parsed.storedValue;
          post({ type: WEBVIEW_TO_EXT_MSG_TYPE.setWindowEventProc, windowKey: win.id, eventProc: parsed.storedValue });
          renderProps();
        },
        {
          disabled: !windowSelectProcField.valueEditable,
          title: windowSelectProcField.title,
          placeholder: windowSelectProcField.placeholder
        }
      )
      ));
    }
    propsEl.appendChild(createSubSection("Event File"));
    const eventFileInput = textInput(
      win.eventFile ?? "",
      v => {
        if (!model.window) return;
        const trimmed = v.trim();
        win.eventFile = trimmed || undefined;
        post({ type: WEBVIEW_TO_EXT_MSG_TYPE.setWindowEventFile, windowKey: win.id, eventFile: trimmed.length ? toPbString(trimmed) : undefined });
        renderProps();
      },
      {
        title: "Path to the event include file for this window.",
        placeholder: "events/form-events.pbi"
      }
    );
    const removeEventFileBtn = document.createElement("button");
    removeEventFileBtn.textContent = "Remove";
    removeEventFileBtn.disabled = !Boolean(win.eventFile?.trim());
    removeEventFileBtn.title = removeEventFileBtn.disabled
      ? "No event file is set."
      : "Remove the current event file include.";
    removeEventFileBtn.onclick = () => {
      if (!model.window || !win.eventFile?.trim()) return;
      win.eventFile = undefined;
      post({ type: WEBVIEW_TO_EXT_MSG_TYPE.setWindowEventFile, windowKey: win.id, eventFile: undefined });
      renderProps();
    };
    propsEl.appendChild(row("File", inputWithActions(eventFileInput, removeEventFileBtn)));
    propsEl.appendChild(mutedNote("Use this field to keep an event include file linked to the window. Remove clears it."));

    propsEl.appendChild(createSubSection("Top-Level Structures"));
    const topLevelActions = document.createElement("div");
    topLevelActions.className = "miniActions";

    const createMenuBtn = document.createElement("button");
    createMenuBtn.textContent = "Create Menu";
    createMenuBtn.disabled = (model.menus?.length ?? 0) > 0;
    createMenuBtn.title = createMenuBtn.disabled
      ? "This form already contains a parsed menu root."
      : "Create a menu root with the original default MenuTitle entry.";
    createMenuBtn.onclick = () => {
      if (createMenuBtn.disabled) return;
      postCreateMenuRoot();
    };
    topLevelActions.appendChild(createMenuBtn);

    const createToolBarButtonBtn = document.createElement("button");
    createToolBarButtonBtn.textContent = "Create Toolbar Button";
    createToolBarButtonBtn.disabled = (model.toolbars?.length ?? 0) > 0;
    createToolBarButtonBtn.title = createToolBarButtonBtn.disabled
      ? "This form already contains a parsed toolbar root."
      : "Create a toolbar root with the original default button entry.";
    createToolBarButtonBtn.onclick = () => {
      if (createToolBarButtonBtn.disabled) return;
      postCreateToolBarRoot("button");
    };
    topLevelActions.appendChild(createToolBarButtonBtn);

    const createStatusBarLabelBtn = document.createElement("button");
    createStatusBarLabelBtn.textContent = "Create StatusBar Label";
    createStatusBarLabelBtn.disabled = (model.statusbars?.length ?? 0) > 0;
    createStatusBarLabelBtn.title = createStatusBarLabelBtn.disabled
      ? "This form already contains a parsed statusbar root."
      : "Create a statusbar root with the original default label field.";
    createStatusBarLabelBtn.onclick = () => {
      if (createStatusBarLabelBtn.disabled) return;
      postCreateStatusBarRoot("label");
    };
    topLevelActions.appendChild(createStatusBarLabelBtn);

    propsEl.appendChild(topLevelActions);

    if (windowConstantsField.visible) {
      propsEl.appendChild(section("Constants"));
    }
    for (const flag of windowConstantsField.knownFlags) {
      propsEl.appendChild(row(
        flag,
        checkboxInput(knownFlags.has(flag), checked => {
          if (!model.window) return;
          const nextKnown = new Set(model.window.knownFlags ?? []);
          if (checked) nextKnown.add(flag);
          else nextKnown.delete(flag);
          model.window.knownFlags = windowConstantsField.knownFlags.filter(entry => nextKnown.has(entry));
          const nextExpr = buildWindowFlagsExpr(model.window.knownFlags, (model.window.customFlags ?? []).join(" | "));
          model.window.flagsExpr = nextExpr;
          postWindowOpenArgs(model.window, { flagsExpr: nextExpr ?? "" });
          markPreviewCanvasScrollContentSizeDirty();
          render();
          renderProps();
        })
      ));
    }
    if (windowConstantsField.customFlagsEditable) {
      propsEl.appendChild(row(
        "Custom Flags",
        textInput(customFlagsValue, v => {
        if (!model.window) return;
        model.window.customFlags = parseWindowCustomFlagsInput(v);
        const nextExpr = buildWindowFlagsExpr(model.window.knownFlags ?? [], v);
        model.window.flagsExpr = nextExpr;
        postWindowOpenArgs(model.window, { flagsExpr: nextExpr ?? "" });
        markPreviewCanvasScrollContentSizeDirty();
        render();
      }, { placeholder: "#PB_Window_CustomFlagA | #PB_Window_CustomFlagB", title: windowConstantsField.title })
      ));
    }
    return;
  }

  if (sel.kind === "menu" || sel.kind === "menuEntry") {
    const menuId = sel.kind === "menu" ? sel.id : sel.menuId;
    const selectedEntryIndex = sel.kind === "menuEntry" ? sel.entryIndex : undefined;
    const m = (model.menus ?? []).find(x => x.id === menuId);
    if (!m) {
      propsEl.innerHTML = "<div class='muted'>Menu not found</div>";
      return;
    }

    const showMenuRootInspector = sel.kind === "menu";
    const hasEventMenuBlock = Boolean(model.window?.hasEventMenuBlock);
    const hasEntriesWithoutEventIds = (m.entries ?? []).some(e => !e.idRaw);
    if (showMenuRootInspector) {
      propsEl.appendChild(row("Id", readonlyInput(m.id)));
      propsEl.appendChild(row("Entries", readonlyInput(String(m.entries?.length ?? 0))));
      if (!hasEventMenuBlock) {
        propsEl.appendChild(mutedNote(EVENT_UI_HINT.eventMenuMissing));
      }
      if (hasEntriesWithoutEventIds) {
        propsEl.appendChild(mutedNote(EVENT_UI_HINT.menuIdRequired));
      }
    }

    const selectedEntry = sel.kind === "menuEntry" && typeof selectedEntryIndex === "number"
      ? m.entries?.[selectedEntryIndex]
      : undefined;
    if (selectedEntry) {
      const selectedCanPatch = typeof selectedEntry.source?.line === "number";
      const selectedFieldConfig = getSelectedMenuEntryInspectorFieldConfig(selectedEntry, selectedCanPatch);
      const selectedCanEditId = selectedFieldConfig.constantEditable;
      const selectedCanEditName = selectedFieldConfig.nameEditable;
      const selectedCanEditShortcut = selectedFieldConfig.shortcutEditable;
      const selectedCanEditImage = selectedFieldConfig.imageEditable;
      const selectedEventEditState = getTopLevelSelectProcEditState(hasEventMenuBlock, selectedEntry.idRaw, "menu");
      const selectedCanEditEvent = selectedEventEditState.canEdit;
      const selectedImage = findImageEntryById(selectedEntry.iconId);
      const selectedImageInspectorConfig = getTopLevelSelectedImageInspectorConfig("menuEntry");
      const hasOwn = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);
      const postSelectedMenuUpdate = (updates: { idRaw?: string; textRaw?: string; shortcut?: string; iconRaw?: string }) => {
        if (!selectedCanPatch || typeof selectedEntry.source?.line !== "number") return;
        if (selectedEntry.kind === "MenuItem") {
          const nextIdRaw = hasOwn(updates, "idRaw") ? updates.idRaw : (selectedEntry.idRaw ?? "");
          const nextTextRaw = hasOwn(updates, "textRaw") ? updates.textRaw : (selectedEntry.textRaw ?? (selectedEntry.text !== undefined ? toPbString(selectedEntry.text) : '""'));
          const nextShortcut = hasOwn(updates, "shortcut") ? updates.shortcut : selectedEntry.shortcut;
          const nextIconRaw = hasOwn(updates, "iconRaw") ? updates.iconRaw : selectedEntry.iconRaw;
          post({
            type: WEBVIEW_TO_EXT_MSG_TYPE.updateMenuEntry,
            menuId: m.id,
            sourceLine: selectedEntry.source.line,
            kind: selectedEntry.kind,
            idRaw: nextIdRaw,
            textRaw: nextTextRaw,
            shortcut: nextShortcut,
            iconRaw: nextIconRaw,
          });
          return;
        }

        if (selectedEntry.kind === "MenuTitle" || selectedEntry.kind === "OpenSubMenu") {
          const nextTextRaw = hasOwn(updates, "textRaw") ? updates.textRaw : (selectedEntry.textRaw ?? (selectedEntry.text !== undefined ? toPbString(selectedEntry.text) : '""'));
          post({
            type: WEBVIEW_TO_EXT_MSG_TYPE.updateMenuEntry,
            menuId: m.id,
            sourceLine: selectedEntry.source.line,
            kind: selectedEntry.kind,
            textRaw: nextTextRaw,
          });
        }
      };
      const selectedImageActions = document.createElement("div");
      selectedImageActions.className = "row-actions";
      const selectedChooseFileBtn = document.createElement("button");
      selectedChooseFileBtn.textContent = selectedImageInspectorConfig.changeImageButtonLabel;
      selectedChooseFileBtn.disabled = !selectedCanEditImage;
      selectedChooseFileBtn.title = selectedCanEditImage
        ? selectedImageInspectorConfig.changeImageButtonTitle
        : "Only MenuItem supports a parsed image argument.";
      selectedChooseFileBtn.onclick = () => {
        if (!selectedCanEditImage || typeof selectedEntry.source?.line !== "number") return;
        openImageAssignmentDraft({ kind: "menuEntry", menuId: m.id, entryIndex: selectedEntryIndex! }, "chooseFile");
      };
      selectedImageActions.appendChild(selectedChooseFileBtn);

      propsEl.appendChild(section("Selected Entry"));
      propsEl.appendChild(row(
        "Constant",
        textInput(
          selectedEntry.idRaw ?? "",
          v => {
            if (!selectedCanEditId) return;
            const trimmed = v.trim();
            postSelectedMenuUpdate({ idRaw: trimmed.length ? trimmed : (selectedEntry.idRaw ?? "") });
          },
          {
            disabled: !selectedCanEditId,
            title: selectedEntry.kind === "MenuItem"
              ? "Edit the id used by the selected menu entry."
              : "Only MenuItem exposes an editable constant in the current parsed model."
          }
        )
      ));
      propsEl.appendChild(row(
        "Name",
        textInput(
          selectedEntry.text ?? "",
          v => {
            if (!selectedCanEditName) return;
            postSelectedMenuUpdate({ textRaw: toPbString(v) });
          },
          {
            disabled: !selectedCanEditName,
            title: selectedCanEditName
              ? "Edit the text shown for the selected menu entry."
              : "MenuBar and CloseSubMenu are structural entries without an editable name field."
          }
        )
      ));
      propsEl.appendChild(row(
        "Shortcut",
        textInput(
          selectedEntry.shortcut ?? "",
          v => {
            if (!selectedCanEditShortcut) return;
            postSelectedMenuUpdate({ shortcut: buildOptionalInspectorPlainValue(v) });
          },
          {
            disabled: !selectedCanEditShortcut,
            title: selectedEntry.kind === "MenuItem"
              ? "Edit the shortcut text shown for the selected menu entry."
              : "Only MenuItem supports the parsed shortcut field."
          }
        )
      ));
      propsEl.appendChild(row(
        "Separator",
        checkboxInput(
          selectedFieldConfig.separatorChecked,
          () => {},
          { disabled: !selectedFieldConfig.separatorEditable, title: "Menu separators are represented structurally as MenuBar entries in the parsed model." }
        )
      ));
      propsEl.appendChild(row(
        "CurrentImage",
        readonlyInput(
          selectedImage?.image ?? selectedImage?.imageRaw ?? selectedEntry.iconRaw ?? "",
          selectedImageInspectorConfig.currentImageTitle
        )
      ));
      if (selectedImageInspectorConfig.currentImageHint) {
        propsEl.appendChild(mutedNote(selectedImageInspectorConfig.currentImageHint));
      }
      if (selectedImage && typeof selectedImage.source?.line === "number") {
        const canToggle = selectedCanEditImage && canToggleImagePbAny(selectedImage);
        propsEl.appendChild(row(PB_ANY, checkboxInput(
          Boolean(selectedImage.pbAny),
          () => {
            if (!canToggle) return;
            post({
              type: WEBVIEW_TO_EXT_MSG_TYPE.toggleImagePbAny,
              sourceLine: selectedImage!.source!.line,
              toPbAny: !selectedImage!.pbAny,
            });
          },
          {
            disabled: !canToggle,
            title: selectedImage.pbAny
              ? `Switch this image entry from ${PB_ANY} to a regular enum id and update all references.`
              : `Switch this image entry to ${PB_ANY} variable mode and update all references.`
          }
        )));
      }
      propsEl.appendChild(row("ChangeImage", selectedImageActions));
      if (isImageReferencePickerOpenFor({ kind: "menuEntry", menuId: m.id, entryIndex: selectedEntryIndex! })) {
        const pendingEl = createPendingImageReferencePickerEl();
        if (pendingEl) propsEl.appendChild(pendingEl);
      }
      if (isImageAssignmentDraftOpenFor({ kind: "menuEntry", menuId: m.id, entryIndex: selectedEntryIndex! })) {
        const pendingEl = createPendingImageAssignmentDraftEl();
        if (pendingEl) propsEl.appendChild(pendingEl);
      }
      propsEl.appendChild(row(
        "SelectProc",
        editableComboInput(
          selectedEntry.event ?? "",
          getProcedureSuggestions(),
          v => {
            if (!selectedEntry.idRaw) return;
            post({
              type: WEBVIEW_TO_EXT_MSG_TYPE.setMenuEntryEvent,
              entryIdRaw: selectedEntry.idRaw,
              eventProc: v.trim().length ? v.trim() : undefined
            });
          },
          {
            disabled: !selectedCanEditEvent,
            title: selectedEventEditState.title
          }
        )
      ));

      const selectedDeleteMenuEntryBtn = document.createElement("button");
      selectedDeleteMenuEntryBtn.textContent = "Delete Entry";
      selectedDeleteMenuEntryBtn.disabled = typeof selectedEntry.source?.line !== "number";
      selectedDeleteMenuEntryBtn.title = selectedDeleteMenuEntryBtn.disabled
        ? "Only parsed menu entries with a source line can be deleted."
        : "Delete the currently selected menu entry.";
      selectedDeleteMenuEntryBtn.onclick = () => {
        if (typeof selectedEntry.source?.line !== "number") return;
        openDestructiveAction(
          {
            kind: "deleteMenuEntry",
            menuId: m.id,
            entryIndex: selectedEntryIndex!,
            sourceLine: selectedEntry.source.line,
            entryKind: selectedEntry.kind,
            message: `Delete the selected ${selectedEntry.kind} entry from menu '${m.id}'?`,
            confirmLabel: "Delete Entry"
          },
          { kind: "menuEntry", menuId: m.id, entryIndex: selectedEntryIndex! }
        );
      };
      propsEl.appendChild(row("Delete", selectedDeleteMenuEntryBtn));
    }

    const box = miniList();
    for (const [entryIndex, e] of (m.entries ?? []).entries()) {
      const prefix = " ".repeat(Math.max(0, (e.level ?? 0)) * 2);
      const text = e.text ?? e.textRaw ?? "";
      const idPart = e.idRaw ? ` ${e.idRaw}` : "";
      const eventPart = e.event ? `  -> ${e.event}` : "";
      const line = `${prefix}${e.kind}${idPart}${text ? `  ${text}` : ""}${eventPart}`;

      const canPatch = typeof e.source?.line === "number";
      const editFn = canPatch
        ? () => {
            setSelectionAndRefresh({ kind: "menuEntry", menuId: m.id, entryIndex });
          }
        : undefined;

      const delFn = canPatch
        ? () => {
            openDestructiveAction(
              {
                kind: "deleteMenuEntry",
                menuId: m.id,
                entryIndex,
                sourceLine: e.source!.line,
                entryKind: e.kind,
                message: `Delete the selected ${e.kind} entry from menu '${m.id}'?`,
                confirmLabel: "Delete Entry"
              },
              { kind: "menuEntry", menuId: m.id, entryIndex }
            );
          }
        : undefined;

      const eventEditState = getTopLevelSelectProcEditState(hasEventMenuBlock, e.idRaw, "menu");
      const eventFn = eventEditState.canEdit
        ? () => {
            setSelectionAndRefresh({ kind: "menuEntry", menuId: m.id, entryIndex });
          }
        : undefined;
      const menuEventTitle = eventEditState.title;
      const menuImage = findImageEntryById(e.iconId);
      const menuImageTitle = getImageReferenceHint(e.iconId, "menu");

      const menuSetImageFn = e.kind === "MenuItem" && canPatch
        ? () => {
            setSelectionAndRefresh({ kind: "menuEntry", menuId: m.id, entryIndex });
          }
        : undefined;
      const menuPickImageFn = e.kind === "MenuItem" && canPatch
        ? () => {
            openImageReferencePicker({ kind: "menuEntry", menuId: m.id, entryIndex }, e.iconId);
          }
        : undefined;
      const menuChooseFileImageFn = e.kind === "MenuItem" && canPatch
        ? () => {
            openImageAssignmentDraft({ kind: "menuEntry", menuId: m.id, entryIndex }, "chooseFile");
          }
        : undefined;
      const menuCreateImageFn = e.kind === "MenuItem" && canPatch
        ? () => {
            openImageAssignmentDraft({ kind: "menuEntry", menuId: m.id, entryIndex }, "create");
          }
        : undefined;

      const rowEl = miniRow(
        line,
        editFn,
        delFn,
        { label: "Event", onClick: eventFn, disabled: !eventFn, title: menuEventTitle },
        { label: "Set Image", onClick: menuSetImageFn, disabled: !menuSetImageFn, title: e.kind === "MenuItem" ? "Edit the image reference used by this menu entry." : "Only MenuItem supports a parsed image argument." },
        { label: "Use Existing", onClick: menuPickImageFn, disabled: !menuPickImageFn, title: e.kind === "MenuItem" ? "Select an image from the form image list." : "Only MenuItem supports a parsed image argument." },
        { label: "Choose File", onClick: menuChooseFileImageFn, disabled: !menuChooseFileImageFn, title: e.kind === "MenuItem" ? "Select a file, create a new LoadImage entry and assign it to this menu item." : "Only MenuItem supports a parsed image argument." },
        { label: "Create New", onClick: menuCreateImageFn, disabled: !menuCreateImageFn, title: e.kind === "MenuItem" ? "Create a new form image entry and assign it to this menu item." : "Only MenuItem supports a parsed image argument." },
        { label: "Image", onClick: menuImage ? () => selectImageById(menuImage.id) : undefined, disabled: !menuImage, title: menuImageTitle }
      );
      if (selectedEntryIndex === entryIndex) rowEl.classList.add("selected");
      rowEl.onclick = (ev) => {
        if (ev.target instanceof HTMLButtonElement) return;
        setSelectionAndRefresh({ kind: "menuEntry", menuId: m.id, entryIndex });
      };
      box.appendChild(rowEl);
    }
    if (showMenuRootInspector) {
      propsEl.appendChild(section("Structure"));
      propsEl.appendChild(box);

      const addItemBtn = document.createElement("button");
      addItemBtn.textContent = "Add Item";
      addItemBtn.title = "Insert a new MenuItem with default id/text values and continue editing it in the inspector.";
      addItemBtn.onclick = () => {
        postInsertMenuEntry(m, { kind: "MenuItem", idRaw: "#MenuItemNew", textRaw: toPbString("Menu Item") });
      };

      const addTitleBtn = document.createElement("button");
      addTitleBtn.textContent = "Add Title";
      addTitleBtn.title = "Insert a new MenuTitle with a default caption and continue editing it in the inspector.";
      addTitleBtn.onclick = () => {
        postInsertMenuEntry(m, { kind: "MenuTitle", textRaw: toPbString("MenuTitle") });
      };

      const addSubMenuBtn = document.createElement("button");
      addSubMenuBtn.textContent = "Add SubMenu";
      addSubMenuBtn.title = "Insert a new OpenSubMenu entry with a default title and continue editing it in the inspector.";
      addSubMenuBtn.onclick = () => {
        postInsertMenuEntry(m, { kind: "OpenSubMenu", textRaw: toPbString("SubMenu") });
      };

      const addSeparatorBtn = document.createElement("button");
      addSeparatorBtn.textContent = "Add Separator";
      addSeparatorBtn.title = "Insert a new MenuBar separator entry.";
      addSeparatorBtn.onclick = () => {
        postInsertMenuEntry(m, { kind: "MenuBar" });
      };

      const closeBalance = getOpenSubMenuBalance(m);
      const canInsertRootClose = closeBalance > 0;

      const addCloseBtn = document.createElement("button");
      addCloseBtn.textContent = "Add Close";
      addCloseBtn.disabled = !canInsertRootClose;
      addCloseBtn.title = canInsertRootClose
        ? "Insert a new CloseSubMenu entry for the last still-open submenu."
        : "Disabled because the parsed menu currently has no unmatched OpenSubMenu entry.";
      addCloseBtn.onclick = () => {
        if (!canInsertRootClose) return;
        postInsertMenuEntry(m, { kind: "CloseSubMenu" });
      };

      const actions = document.createElement("div");
      actions.className = "miniActions";
      actions.appendChild(addItemBtn);
      actions.appendChild(addTitleBtn);
      actions.appendChild(addSubMenuBtn);
      actions.appendChild(addSeparatorBtn);
      actions.appendChild(addCloseBtn);
      if (sel.kind === "menu") {
        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete Menu";
        deleteBtn.onclick = () => {
          openDestructiveAction({
            kind: "deleteMenu",
            menuId: m.id,
            message: `Delete menu '${m.id}'?`,
            confirmLabel: "Delete Menu"
          });
        };
        actions.appendChild(deleteBtn);
      }
      propsEl.appendChild(actions);
      if (pendingDestructiveAction?.kind === "deleteMenu" && pendingDestructiveAction.menuId === m.id) {
        const pendingEl = createPendingDestructiveActionEl();
        if (pendingEl) propsEl.appendChild(pendingEl);
      }
    }
    if (selectedEntry
      && pendingDestructiveAction?.kind === "deleteMenuEntry"
      && pendingDestructiveAction.menuId === m.id
      && pendingDestructiveAction.entryIndex === selectedEntryIndex) {
      const pendingEl = createPendingDestructiveActionEl();
      if (pendingEl) propsEl.appendChild(pendingEl);
    }
    return;
  }

  if (sel.kind === "toolbar" || sel.kind === "toolBarEntry") {
    const toolBarId = sel.kind === "toolbar" ? sel.id : sel.toolBarId;
    const selectedEntryIndex = sel.kind === "toolBarEntry" ? sel.entryIndex : undefined;
    const t = (model.toolbars ?? []).find(x => x.id === toolBarId);
    if (!t) {
      propsEl.innerHTML = "<div class='muted'>ToolBar not found</div>";
      return;
    }

    const showToolBarRootInspector = sel.kind === "toolbar";
    const hasEventMenuBlock = Boolean(model.window?.hasEventMenuBlock);
    const hasEntriesWithoutEventIds = (t.entries ?? []).some(e => !e.idRaw);
    if (showToolBarRootInspector) {
      propsEl.appendChild(row("Id", readonlyInput(t.id)));
      propsEl.appendChild(row("Entries", readonlyInput(String(getVisibleToolBarEntryCount(t)))));
      if (!hasEventMenuBlock) {
        propsEl.appendChild(mutedNote(EVENT_UI_HINT.eventMenuMissing));
      }
      if (hasEntriesWithoutEventIds) {
        propsEl.appendChild(mutedNote(EVENT_UI_HINT.toolBarIdRequired));
      }
    }

    const selectedEntry = sel.kind === "toolBarEntry" && typeof selectedEntryIndex === "number"
      ? t.entries?.[selectedEntryIndex]
      : undefined;
    if (selectedEntry) {
      const selectedCanPatch = typeof selectedEntry.source?.line === "number";
      const selectedImage = findImageEntryById(selectedEntry.iconId);
      const selectedImageInspectorConfig = getTopLevelSelectedImageInspectorConfig("toolBarEntry");
      const selectedFieldConfig = getSelectedToolBarInspectorFieldConfig(selectedEntry, selectedCanPatch);
      const canEditSelectedTooltip = selectedFieldConfig.captionEditable;
      const canEditSelectedToggle = selectedFieldConfig.toggleEditable;
      const selectedEventEditState = selectedFieldConfig.selectProcParticipates
        ? getTopLevelSelectProcEditState(hasEventMenuBlock, selectedEntry.idRaw, "toolbar")
        : { canEdit: false, title: selectedFieldConfig.selectProcDisabledTitle };
      const canEditSelectedEvent = selectedEventEditState.canEdit;

      const canEditSelectedImage = selectedFieldConfig.imageEditable;
      const selectedImagePath = selectedImage?.image ?? selectedImage?.imageRaw ?? ((selectedEntry.iconRaw ?? "") === "0" ? "" : (selectedEntry.iconRaw ?? ""));
      const selectedImageUsageCount = selectedEntry.iconId ? countImageUsages(selectedEntry.iconId) : 0;
      const selectedImageEditState = getStatusBarCurrentImageEditState(selectedImage, selectedImageUsageCount);
      const selectedImageActions = document.createElement("div");
      selectedImageActions.className = "row-actions";
      const selectedChooseFileBtn = document.createElement("button");
      selectedChooseFileBtn.textContent = selectedImageInspectorConfig.changeImageButtonLabel;
      selectedChooseFileBtn.disabled = !canEditSelectedImage;
      selectedChooseFileBtn.title = canEditSelectedImage
        ? selectedImageInspectorConfig.changeImageButtonTitle
        : "Only ToolBarImageButton supports a parsed image reference.";
      selectedChooseFileBtn.onclick = () => {
        if (!canEditSelectedImage || typeof selectedEntry.source?.line !== "number") return;
        openImageAssignmentDraft({ kind: "toolBarEntry", toolBarId: t.id, entryIndex: selectedEntryIndex! }, "chooseFile");
      };
      selectedImageActions.appendChild(selectedChooseFileBtn);

      const postSelectedToolBarEntryUpdate = (patch: {
        idRaw?: string;
        iconRaw?: string;
        textRaw?: string;
        toggle?: boolean;
      }) => {
        if (!selectedCanPatch || typeof selectedEntry.source?.line !== "number") return;
        post({
          type: WEBVIEW_TO_EXT_MSG_TYPE.updateToolBarEntry,
          toolBarId: t.id,
          sourceLine: selectedEntry.source.line,
          kind: selectedEntry.kind,
          idRaw: patch.idRaw ?? selectedEntry.idRaw,
          iconRaw: patch.iconRaw ?? selectedEntry.iconRaw,
          textRaw: patch.textRaw ?? selectedEntry.textRaw,
          toggle: patch.toggle ?? selectedEntry.toggle,
        });
      };
      const canEditSelectedId = selectedFieldConfig.variableEditable;

      propsEl.appendChild(section("Selected Entry"));
      propsEl.appendChild(row(
        "Variable",
        textInput(
          selectedEntry.idRaw ?? "",
          v => {
            if (!canEditSelectedId) return;
            const trimmed = v.trim();
            postSelectedToolBarEntryUpdate({ idRaw: trimmed.length ? trimmed : (selectedEntry.idRaw ?? "") });
          },
          {
            disabled: !canEditSelectedId,
            title: canEditSelectedId
              ? "Edit the toolbar entry id."
              : "Toolbar separators do not expose an editable id field."
          }
        )
      ));
      if (selectedFieldConfig.showTextField) {
        propsEl.appendChild(row(
          "Text",
          textInput(
            selectedEntry.text ?? "",
            v => {
              postSelectedToolBarEntryUpdate({ textRaw: buildOptionalInspectorLiteralRaw(v) });
            },
            {
              title: "Edit the text shown for this toolbar entry."
            }
          )
        ));
      }
      if (selectedFieldConfig.showIconRawField) {
        propsEl.appendChild(row(
          "IconRaw",
          textInput(
            selectedEntry.iconRaw ?? "",
            v => {
              postSelectedToolBarEntryUpdate({ iconRaw: v.trim() });
            },
            {
              title: "Edit the image reference used by this toolbar entry."
            }
          )
        ));
      }
      propsEl.appendChild(row(
        selectedFieldConfig.captionLabel,
        textInput(
          selectedEntry.tooltip ?? "",
          v => {
            if (!selectedEntry.idRaw || typeof selectedEntry.source?.line !== "number") return;
            post({
              type: WEBVIEW_TO_EXT_MSG_TYPE.setToolBarEntryTooltip,
              toolBarId: t.id,
              sourceLine: selectedEntry.source.line,
              entryIdRaw: selectedEntry.idRaw,
              textRaw: buildOptionalInspectorLiteralRaw(v)
            });
          },
          {
            disabled: !canEditSelectedTooltip,
            title: canEditToolBarTooltip(selectedEntry)
              ? "Edit the caption stored for this toolbar entry."
              : "This entry type does not expose an editable caption field."
          }
        )
      ));
      const currentImageControl = textInput(
        selectedImagePath,
        value => {
          if (!canEditSelectedImage || typeof selectedEntry.source?.line !== "number") return;

          if (selectedImageEditState.canDirectEdit && selectedImage && typeof selectedImage.source?.line === "number") {
            clearInfoError();
            post({
              type: WEBVIEW_TO_EXT_MSG_TYPE.updateImage,
              sourceLine: selectedImage.source.line,
              inline: false,
              idRaw: selectedImage.firstParam,
              imageRaw: toPbString(value),
              assignedVar: selectedImage.pbAny ? selectedImage.variable : undefined
            });
            return;
          }

          const rebind = resolveStatusBarCurrentImageRebind(model.images ?? [], value, selectedEntry.iconId);
          if (rebind.matchedImage) {
            if (rebind.matchedImage.id === selectedEntry.iconId) {
              clearInfoError();
              renderProps();
              return;
            }

            clearInfoError();
            post({
              type: WEBVIEW_TO_EXT_MSG_TYPE.rebindToolBarEntryImage,
              toolBarId: t.id,
              sourceLine: selectedEntry.source.line,
              kind: selectedEntry.kind,
              idRaw: selectedEntry.idRaw,
              toggle: selectedEntry.toggle,
              iconRaw: `ImageID(${rebind.matchedImage.id})`,
              oldImageId: selectedEntry.iconId,
              oldImageSourceLine: shouldCleanupStatusBarReboundImage(
                selectedEntry.iconId,
                selectedImageUsageCount,
                selectedImage?.source?.line,
                rebind.matchedImage.id
              ) ? selectedImage?.source?.line : undefined
            });
            return;
          }

          const createResolution = resolveStatusBarCurrentImageCreate(
            model.images ?? [],
            value,
            model.window?.id,
            model.window?.variable
          );
          if (!createResolution.imageIdRaw || !createResolution.imageRaw) {
            setInfoError(createResolution.reason ?? rebind.reason ?? (selectedImageEditState.reason ?? "This image reference cannot be edited directly here."));
            renderProps();
            return;
          }

          clearInfoError();
          post({
            type: WEBVIEW_TO_EXT_MSG_TYPE.createAndAssignToolBarEntryImage,
            toolBarId: t.id,
            sourceLine: selectedEntry.source.line,
            kind: selectedEntry.kind,
            idRaw: selectedEntry.idRaw,
            toggle: selectedEntry.toggle,
            newInline: false,
            newImageIdRaw: createResolution.imageIdRaw,
            newImageRaw: createResolution.imageRaw,
            oldImageId: selectedEntry.iconId,
            oldImageSourceLine: shouldCleanupStatusBarReboundImage(
              selectedEntry.iconId,
              selectedImageUsageCount,
              selectedImage?.source?.line,
              createResolution.imageIdRaw
            ) ? selectedImage?.source?.line : undefined
          });
        },
        {
          disabled: !canEditSelectedImage,
          title: selectedImageEditState.canDirectEdit
            ? selectedImageEditState.reason
            : "Enter an existing parsed image path to rebind this toolbar entry, or a quoted/path-like file string to auto-create a new LoadImage entry.",
          placeholder: selectedImage?.inline ? "ImgInlineLabel" : "image.png"
        }
      );
      currentImageControl.title = selectedImageEditState.canDirectEdit
        ? (selectedImageEditState.reason ?? "")
        : "Enter an existing parsed image path to rebind this toolbar entry, or a quoted/path-like file string to auto-create a new LoadImage entry.";
      propsEl.appendChild(row("CurrentImage", currentImageControl));
      if (selectedImage && typeof selectedImage.source?.line === "number") {
        const canToggle = canEditSelectedImage && canToggleImagePbAny(selectedImage);
        propsEl.appendChild(row(PB_ANY, checkboxInput(
          Boolean(selectedImage.pbAny),
          () => {
            if (!canToggle) return;
            post({
              type: WEBVIEW_TO_EXT_MSG_TYPE.toggleImagePbAny,
              sourceLine: selectedImage!.source!.line,
              toPbAny: !selectedImage!.pbAny,
            });
          },
          {
            disabled: !canToggle,
            title: selectedImage.pbAny
              ? `Switch this image entry from ${PB_ANY} to a regular enum id and update all references.`
              : `Switch this image entry to ${PB_ANY} variable mode and update all references.`
          }
        )));
      }
      propsEl.appendChild(row("ChangeImage", selectedImageActions));
      if (isImageReferencePickerOpenFor({ kind: "toolBarEntry", toolBarId: t.id, entryIndex: selectedEntryIndex! })) {
        const pendingEl = createPendingImageReferencePickerEl();
        if (pendingEl) propsEl.appendChild(pendingEl);
      }
      if (isImageAssignmentDraftOpenFor({ kind: "toolBarEntry", toolBarId: t.id, entryIndex: selectedEntryIndex! })) {
        const pendingEl = createPendingImageAssignmentDraftEl();
        if (pendingEl) propsEl.appendChild(pendingEl);
      }
      propsEl.appendChild(row(
        "ToggleButton",
        checkboxInput(
          selectedFieldConfig.toggleChecked,
          v => {
            if (selectedEntry.kind !== "ToolBarImageButton" || typeof selectedEntry.source?.line !== "number") return;
            post({
              type: WEBVIEW_TO_EXT_MSG_TYPE.updateToolBarEntry,
              toolBarId: t.id,
              sourceLine: selectedEntry.source.line,
              kind: selectedEntry.kind,
              idRaw: selectedEntry.idRaw,
              iconRaw: selectedEntry.iconRaw,
              toggle: v,
            });
          },
          {
            disabled: !canEditSelectedToggle,
            title: selectedEntry.kind === "ToolBarImageButton"
              ? "Toggle the #PB_ToolBar_Toggle flag for this toolbar image button."
              : "Only ToolBarImageButton supports the toggle flag."
          }
        )
      ));
      propsEl.appendChild(row(
        "Separator",
        checkboxInput(
          selectedFieldConfig.separatorChecked,
          () => {},
          { disabled: !selectedFieldConfig.separatorEditable, title: "Separators are structural entries and cannot be edited here." }
        )
      ));
      propsEl.appendChild(row(
        "SelectProc",
        editableComboInput(
          selectedEntry.event ?? "",
          getProcedureSuggestions(),
          v => {
            if (!selectedEntry.idRaw) return;
            post({
              type: WEBVIEW_TO_EXT_MSG_TYPE.setToolBarEntryEvent,
              entryIdRaw: selectedEntry.idRaw,
              eventProc: v.trim().length ? v.trim() : undefined
            });
          },
          {
            disabled: !canEditSelectedEvent,
            title: selectedEventEditState.title
          }
        )
      ));

      const selectedDeleteToolBarEntryBtn = document.createElement("button");
      selectedDeleteToolBarEntryBtn.textContent = "Delete Entry";
      selectedDeleteToolBarEntryBtn.disabled = typeof selectedEntry.source?.line !== "number";
      selectedDeleteToolBarEntryBtn.title = selectedDeleteToolBarEntryBtn.disabled
        ? "Only parsed toolbar entries with a source line can be deleted."
        : "Delete the currently selected toolbar entry.";
      selectedDeleteToolBarEntryBtn.onclick = () => {
        if (typeof selectedEntry.source?.line !== "number") return;
        openDestructiveAction(
          {
            kind: "deleteToolBarEntry",
            toolBarId: t.id,
            entryIndex: selectedEntryIndex!,
            sourceLine: selectedEntry.source.line,
            entryKind: selectedEntry.kind,
            message: `Delete the selected ${selectedEntry.kind} entry from toolbar '${t.id}'?`,
            confirmLabel: "Delete Entry"
          },
          { kind: "toolBarEntry", toolBarId: t.id, entryIndex: selectedEntryIndex! }
        );
      };
      propsEl.appendChild(row("Delete", selectedDeleteToolBarEntryBtn));
    }

    const box = miniList();
    for (const [entryIndex, e] of (t.entries ?? []).entries()) {
      if (!shouldShowToolBarStructureEntry(t, entryIndex)) continue;
      const text = e.text ?? e.textRaw ?? "";
      const idPart = e.idRaw ? ` ${e.idRaw}` : "";
      const extra = e.iconRaw ? `  ${e.iconRaw}` : "";
      const tooltipPart = e.kind !== "ToolBarToolTip" && e.tooltip ? `  tooltip:${e.tooltip}` : "";
      const eventPart = e.event ? `  -> ${e.event}` : "";
      const line = `${e.kind}${idPart}${text ? `  ${text}` : ""}${extra}${tooltipPart}${eventPart}`;

      const canPatch = typeof e.source?.line === "number";
      const editFn = canPatch
        ? () => {
            setSelectionAndRefresh({ kind: "toolBarEntry", toolBarId: t.id, entryIndex });
          }
        : undefined;

      const delFn = canPatch
        ? () => {
            openDestructiveAction(
              {
                kind: "deleteToolBarEntry",
                toolBarId: t.id,
                entryIndex,
                sourceLine: e.source!.line,
                entryKind: e.kind,
                message: `Delete the selected ${e.kind} entry from toolbar '${t.id}'?`,
                confirmLabel: "Delete Entry"
              },
              { kind: "toolBarEntry", toolBarId: t.id, entryIndex }
            );
          }
        : undefined;

      const eventEditState = e.kind === "ToolBarToolTip"
        ? { canEdit: false, title: "This entry type does not participate in Select EventMenu() cases." }
        : getTopLevelSelectProcEditState(hasEventMenuBlock, e.idRaw, "toolbar");
      const eventFn = eventEditState.canEdit
        ? () => {
            setSelectionAndRefresh({ kind: "toolBarEntry", toolBarId: t.id, entryIndex });
          }
        : undefined;
      const toolBarTooltipFn = canPatch && canEditToolBarTooltip(e)
        ? () => {
            setSelectionAndRefresh({ kind: "toolBarEntry", toolBarId: t.id, entryIndex });
          }
        : undefined;
      const toolBarEventTitle = eventEditState.title;
      const toolBarImage = findImageEntryById(e.iconId);
      const toolBarImageTitle = getImageReferenceHint(e.iconId, "toolbar");

      const toolBarSetImageFn = e.kind === "ToolBarImageButton" && canPatch
        ? () => {
            setSelectionAndRefresh({ kind: "toolBarEntry", toolBarId: t.id, entryIndex });
          }
        : undefined;
      const toolBarPickImageFn = e.kind === "ToolBarImageButton" && canPatch
        ? () => {
            openImageReferencePicker({ kind: "toolBarEntry", toolBarId: t.id, entryIndex }, e.iconId);
          }
        : undefined;
      const toolBarChooseFileImageFn = e.kind === "ToolBarImageButton" && canPatch
        ? () => {
            openImageAssignmentDraft({ kind: "toolBarEntry", toolBarId: t.id, entryIndex }, "chooseFile");
          }
        : undefined;
      const toolBarCreateImageFn = e.kind === "ToolBarImageButton" && canPatch
        ? () => {
            openImageAssignmentDraft({ kind: "toolBarEntry", toolBarId: t.id, entryIndex }, "create");
          }
        : undefined;

      const rowEl = miniRow(
        line,
        editFn,
        delFn,
        { label: "Event", onClick: eventFn, disabled: !eventFn, title: toolBarEventTitle },
        { label: "Tooltip", onClick: toolBarTooltipFn, disabled: !toolBarTooltipFn, title: canEditToolBarTooltip(e) ? "Edit the tooltip shown for this toolbar entry." : "This entry type does not have a separate tooltip field." },
        { label: "Set Image", onClick: toolBarSetImageFn, disabled: !toolBarSetImageFn, title: e.kind === "ToolBarImageButton" ? "Edit the image reference used by this toolbar button." : "Only ToolBarImageButton supports a parsed image reference." },
        { label: "Use Existing", onClick: toolBarPickImageFn, disabled: !toolBarPickImageFn, title: e.kind === "ToolBarImageButton" ? "Select an image from the form image list." : "Only ToolBarImageButton supports a parsed image reference." },
        { label: "Choose File", onClick: toolBarChooseFileImageFn, disabled: !toolBarChooseFileImageFn, title: e.kind === "ToolBarImageButton" ? "Select a file, create a new LoadImage entry and assign it to this toolbar button." : "Only ToolBarImageButton supports a parsed image reference." },
        { label: "Create New", onClick: toolBarCreateImageFn, disabled: !toolBarCreateImageFn, title: e.kind === "ToolBarImageButton" ? "Create a new form image entry and assign it to this toolbar button." : "Only ToolBarImageButton supports a parsed image reference." },
        { label: "Image", onClick: toolBarImage ? () => selectImageById(toolBarImage.id) : undefined, disabled: !toolBarImage, title: toolBarImageTitle }
      );
      if (selectedEntryIndex === entryIndex) rowEl.classList.add("selected");
      rowEl.onclick = (ev) => {
        if (ev.target instanceof HTMLButtonElement) return;
        setSelectionAndRefresh({ kind: "toolBarEntry", toolBarId: t.id, entryIndex });
      };
      box.appendChild(rowEl);
    }
    if (showToolBarRootInspector) {
      propsEl.appendChild(section("Structure"));
      propsEl.appendChild(box);

      const addButtonBtn = document.createElement("button");
      addButtonBtn.textContent = "Add Button";
      addButtonBtn.title = "Insert a new ToolBarImageButton with the default image argument 0.";
      addButtonBtn.onclick = () => {
        postInsertToolBarEntry(t, getToolBarPreviewInsertArgs(t, "button"));
      };

      const addToggleBtn = document.createElement("button");
      addToggleBtn.textContent = "Add Toggle";
      addToggleBtn.title = "Insert a new ToolBarImageButton with #PB_ToolBar_Toggle enabled.";
      addToggleBtn.onclick = () => {
        postInsertToolBarEntry(t, getToolBarPreviewInsertArgs(t, "toggle"));
      };

      const addSeparatorBtn = document.createElement("button");
      addSeparatorBtn.textContent = "Add Separator";
      addSeparatorBtn.title = "Insert a new ToolBarSeparator entry.";
      addSeparatorBtn.onclick = () => {
        postInsertToolBarEntry(t, getToolBarPreviewInsertArgs(t, "separator"));
      };

      const actions = document.createElement("div");
      actions.className = "miniActions";
      actions.appendChild(addButtonBtn);
      actions.appendChild(addToggleBtn);
      actions.appendChild(addSeparatorBtn);
      if (sel.kind === "toolbar") {
        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete Toolbar";
        deleteBtn.onclick = () => {
          openDestructiveAction({
            kind: "deleteToolBar",
            toolBarId: t.id,
            message: `Delete toolbar '${t.id}'?`,
            confirmLabel: "Delete Toolbar"
          });
        };
        actions.appendChild(deleteBtn);
      }
      propsEl.appendChild(actions);
      if (pendingDestructiveAction?.kind === "deleteToolBar" && pendingDestructiveAction.toolBarId === t.id) {
        const pendingEl = createPendingDestructiveActionEl();
        if (pendingEl) propsEl.appendChild(pendingEl);
      }
    }
    if (selectedEntry
      && pendingDestructiveAction?.kind === "deleteToolBarEntry"
      && pendingDestructiveAction.toolBarId === t.id
      && pendingDestructiveAction.entryIndex === selectedEntryIndex) {
      const pendingEl = createPendingDestructiveActionEl();
      if (pendingEl) propsEl.appendChild(pendingEl);
    }
    return;
  }

  if (sel.kind === "statusbar" || sel.kind === "statusBarField") {
    const statusBarId = sel.kind === "statusbar" ? sel.id : sel.statusBarId;
    const selectedFieldIndex = sel.kind === "statusBarField" ? sel.fieldIndex : undefined;
    const sb = (model.statusbars ?? []).find(x => x.id === statusBarId);
    if (!sb) {
      propsEl.innerHTML = "<div class='muted'>StatusBar not found</div>";
      return;
    }

    const getStatusBarFieldUi = (field: FormStatusBarField) => {
      const fieldIndex = (sb.fields ?? []).findIndex(candidate => candidate === field);
      const canPatch = typeof field.source?.line === "number";
      const statusImage = findImageEntryById(field.imageId);
      const statusImageTitle = getImageReferenceHint(field.imageId, "statusbar");
      const postFieldUpdate = (patch: {
        widthRaw?: string;
        textRaw?: string;
        imageRaw?: string;
        flagsRaw?: string;
        progressBar?: boolean;
        progressRaw?: string;
      }) => {
        if (!canPatch) return;
        const nextProgressBar = patch.progressBar ?? Boolean(field.progressBar);
        post({
          type: WEBVIEW_TO_EXT_MSG_TYPE.updateStatusBarField,
          statusBarId: sb.id,
          sourceLine: field.source!.line,
          widthRaw: patch.widthRaw ?? field.widthRaw,
          textRaw: patch.textRaw ?? field.textRaw ?? "",
          imageRaw: patch.imageRaw ?? field.imageRaw ?? "",
          flagsRaw: patch.flagsRaw ?? field.flagsRaw ?? "",
          progressBar: nextProgressBar,
          progressRaw: normalizeStatusBarProgressRaw(nextProgressBar, patch.progressRaw ?? field.progressRaw ?? "")
        });
      };

      const editFn = canPatch
        ? () => {
            if (fieldIndex < 0) return;
            setSelectionAndRefresh({ kind: "statusBarField", statusBarId: sb.id, fieldIndex });
          }
        : undefined;

      const delFn = canPatch
        ? () => {
            openDestructiveAction(
              {
                kind: "deleteStatusBarField",
                statusBarId: sb.id,
                fieldIndex,
                sourceLine: field.source!.line,
                message: `Delete field ${fieldIndex} from statusbar '${sb.id}'?`,
                confirmLabel: "Delete Field"
              },
              { kind: "statusBarField", statusBarId: sb.id, fieldIndex }
            );
          }
        : undefined;

      const statusSetImageFn = canPatch
        ? () => {
            if (fieldIndex < 0) return;
            setSelectionAndRefresh({ kind: "statusBarField", statusBarId: sb.id, fieldIndex });
          }
        : undefined;

      const statusPickImageFn = canPatch
        ? () => {
            openImageReferencePicker({ kind: "statusBarField", statusBarId: sb.id, fieldIndex }, field.imageId);
          }
        : undefined;

      const statusTextFn = canPatch
        ? () => {
            if (fieldIndex < 0) return;
            setSelectionAndRefresh({ kind: "statusBarField", statusBarId: sb.id, fieldIndex });
          }
        : undefined;

      const statusProgressFn = canPatch
        ? () => {
            if (fieldIndex < 0) return;
            setSelectionAndRefresh({ kind: "statusBarField", statusBarId: sb.id, fieldIndex });
          }
        : undefined;

      const statusClearFn = canPatch
        ? () => {
            openDestructiveAction(
              {
                kind: "clearStatusBarField",
                statusBarId: sb.id,
                fieldIndex,
                sourceLine: field.source!.line,
                message: `Clear text, image and progress decoration for field ${fieldIndex}?`,
                confirmLabel: "Clear Decoration"
              },
              { kind: "statusBarField", statusBarId: sb.id, fieldIndex }
            );
          }
        : undefined;

      const statusChooseFileImageFn = canPatch
        ? () => {
            openImageAssignmentDraft({ kind: "statusBarField", statusBarId: sb.id, fieldIndex }, "chooseFile");
          }
        : undefined;

      const statusCreateImageFn = canPatch
        ? () => {
            openImageAssignmentDraft({ kind: "statusBarField", statusBarId: sb.id, fieldIndex }, "create");
          }
        : undefined;

      return {
        canPatch,
        statusImage,
        statusImageTitle,
        editFn,
        delFn,
        statusSetImageFn,
        statusPickImageFn,
        statusTextFn,
        statusProgressFn,
        statusClearFn,
        statusChooseFileImageFn,
        statusCreateImageFn,
        postFieldUpdate,
      };
    };

    const showStatusBarRootInspector = sel.kind === "statusbar";
    if (showStatusBarRootInspector) {
      propsEl.appendChild(row("Id", readonlyInput(sb.id)));
      propsEl.appendChild(row("Fields", readonlyInput(String(sb.fields?.length ?? 0))));
    }

    const selectedField = sel.kind === "statusBarField" && typeof selectedFieldIndex === "number"
      ? sb.fields?.[selectedFieldIndex]
      : undefined;
    if (selectedField) {
      const selectedUi = getStatusBarFieldUi(selectedField);
      const selectedImageInspectorConfig = getTopLevelSelectedImageInspectorConfig("statusBarField");
      const selectedFieldConfig = getSelectedStatusBarInspectorFieldConfig(selectedUi.canPatch);
      const selectedImagePath = selectedUi.statusImage?.image ?? selectedUi.statusImage?.imageRaw ?? selectedField.imageRaw ?? "";
      const selectedImageUsageCount = selectedField.imageId ? countImageUsages(selectedField.imageId) : 0;
      const selectedImageEditState = getStatusBarCurrentImageEditState(selectedUi.statusImage, selectedImageUsageCount);

      propsEl.appendChild(section("Selected Field"));
      propsEl.appendChild(row(
        "Width",
        textInput(
          selectedField.widthRaw ?? "",
          v => {
            if (!selectedFieldConfig.widthEditable) return;
            selectedUi.postFieldUpdate({ widthRaw: v.trim() || selectedField.widthRaw });
          },
          {
            disabled: !selectedFieldConfig.widthEditable,
            title: "Width of the selected status bar field. Use #PB_Ignore to let the size adjust automatically."
          }
        )
      ));
      propsEl.appendChild(row(
        "Text",
        textInput(
          selectedField.text ?? "",
          v => {
            if (!selectedFieldConfig.textEditable) return;
            selectedUi.postFieldUpdate({
              textRaw: buildOptionalInspectorLiteralRaw(v)
            });
          },
          {
            disabled: !selectedFieldConfig.textEditable,
            title: "Text shown in the selected status bar field."
          }
        )
      ));
      if (selectedFieldConfig.showProgressValueField) {
        propsEl.appendChild(row(
          "ProgressValue",
          readonlyInput(getStatusBarProgressInspectorValue(selectedField.progressBar, selectedField.progressRaw))
        ));
      }
      const currentImageControl = textInput(
        selectedImagePath,
        value => {
          if (!selectedFieldConfig.currentImageEditable) return;

          if (selectedImageEditState.canDirectEdit && selectedUi.statusImage && typeof selectedUi.statusImage.source?.line === "number") {
            clearInfoError();
            post({
              type: WEBVIEW_TO_EXT_MSG_TYPE.updateImage,
              sourceLine: selectedUi.statusImage.source.line,
              inline: false,
              idRaw: selectedUi.statusImage.firstParam,
              imageRaw: toPbString(value),
              assignedVar: selectedUi.statusImage.pbAny
                ? selectedUi.statusImage.variable
                : undefined,
            });
            return;
          }

          const rebind = resolveStatusBarCurrentImageRebind(model.images ?? [], value, selectedField.imageId);
          if (rebind.matchedImage) {
            if (rebind.matchedImage.id === selectedField.imageId) {
              clearInfoError();
              renderProps();
              return;
            }

            clearInfoError();
            post({
              type: WEBVIEW_TO_EXT_MSG_TYPE.rebindStatusBarFieldImage,
              statusBarId: sb.id,
              sourceLine: selectedField.source!.line,
              widthRaw: selectedField.widthRaw,
              imageRaw: `ImageID(${rebind.matchedImage.id})`,
              oldImageId: selectedField.imageId,
              oldImageSourceLine: shouldCleanupStatusBarReboundImage(
                selectedField.imageId,
                selectedImageUsageCount,
                selectedUi.statusImage?.source?.line,
                rebind.matchedImage.id
              ) ? selectedUi.statusImage?.source?.line : undefined
            });
            return;
          }

          const createResolution = resolveStatusBarCurrentImageCreate(
            model.images ?? [],
            value,
            model.window?.id,
            model.window?.variable
          );
          if (!createResolution.imageIdRaw || !createResolution.imageRaw) {
            setInfoError(createResolution.reason ?? rebind.reason ?? (selectedImageEditState.reason ?? "This image reference cannot be edited directly here."));
            renderProps();
            return;
          }

          clearInfoError();
          post({
            type: WEBVIEW_TO_EXT_MSG_TYPE.createAndAssignStatusBarFieldImage,
            statusBarId: sb.id,
            sourceLine: selectedField.source!.line,
            widthRaw: selectedField.widthRaw,
            newInline: false,
            newImageIdRaw: createResolution.imageIdRaw,
            newImageRaw: createResolution.imageRaw,
            oldImageId: selectedField.imageId,
            oldImageSourceLine: shouldCleanupStatusBarReboundImage(
              selectedField.imageId,
              selectedImageUsageCount,
              selectedUi.statusImage?.source?.line,
              createResolution.imageIdRaw
            ) ? selectedUi.statusImage?.source?.line : undefined
          });
        },
        {
          title: selectedImageEditState.canDirectEdit
            ? selectedImageEditState.reason
            : "Enter an existing parsed image path or data label to rebind this field, or a quoted/path-like file string to auto-create a new LoadImage entry. Use Create New for inline labels or custom image ids.",
          placeholder: selectedUi.statusImage?.inline ? "ImgInlineLabel" : "image.png",
          disabled: !selectedFieldConfig.currentImageEditable
        }
      );
      currentImageControl.title = selectedImageEditState.canDirectEdit
        ? (selectedImageEditState.reason ?? "")
        : "Enter an existing parsed image path or data label to rebind this field, or a quoted/path-like file string to auto-create a new LoadImage entry. Use Create New for inline labels or custom image ids.";
      propsEl.appendChild(row("CurrentImage", currentImageControl));
      if (!selectedImageEditState.canDirectEdit) {
        propsEl.appendChild(mutedNote("For shared or CatchImage references, you can rebind to an existing image here. For file paths, a new LoadImage entry can be created automatically. Use Create New for inline labels or custom image ids."));
      }
      if (selectedUi.statusImage && typeof selectedUi.statusImage.source?.line === "number") {
        const canToggle = selectedFieldConfig.currentImageEditable && canToggleImagePbAny(selectedUi.statusImage);
        propsEl.appendChild(row(PB_ANY, checkboxInput(
          Boolean(selectedUi.statusImage.pbAny),
          () => {
            if (!canToggle) return;
            post({
              type: WEBVIEW_TO_EXT_MSG_TYPE.toggleImagePbAny,
              sourceLine: selectedUi.statusImage!.source!.line,
              toPbAny: !selectedUi.statusImage!.pbAny,
            });
          },
          {
            disabled: !canToggle,
            title: selectedUi.statusImage.pbAny
              ? `Switch this image entry from ${PB_ANY} to a regular enum id and update all references.`
              : `Switch this image entry to ${PB_ANY} variable mode and update all references.`
          }
        )));
      }
      const selectedImageActions = document.createElement("div");
      selectedImageActions.className = "row-actions";
      const chooseFileBtn = document.createElement("button");
      chooseFileBtn.textContent = selectedImageInspectorConfig.changeImageButtonLabel;
      chooseFileBtn.disabled = !selectedFieldConfig.changeImageEditable || !selectedUi.statusChooseFileImageFn;
      chooseFileBtn.title = selectedImageInspectorConfig.changeImageButtonTitle;
      chooseFileBtn.onclick = () => {
        if (!selectedFieldConfig.changeImageEditable) return;
        selectedUi.statusChooseFileImageFn?.();
      };
      selectedImageActions.appendChild(chooseFileBtn);
      propsEl.appendChild(row("ChangeImage", selectedImageActions));
      if (isImageReferencePickerOpenFor({ kind: "statusBarField", statusBarId: sb.id, fieldIndex: selectedFieldIndex! })) {
        const pendingEl = createPendingImageReferencePickerEl();
        if (pendingEl) propsEl.appendChild(pendingEl);
      }
      if (isImageAssignmentDraftOpenFor({ kind: "statusBarField", statusBarId: sb.id, fieldIndex: selectedFieldIndex! })) {
        const pendingEl = createPendingImageAssignmentDraftEl();
        if (pendingEl) propsEl.appendChild(pendingEl);
      }
      propsEl.appendChild(row(
        "ProgressBar",
        checkboxInput(
          Boolean(selectedField.progressBar),
          checked => {
            if (!selectedFieldConfig.progressBarEditable) return;
            selectedUi.postFieldUpdate({
              progressBar: checked,
              progressRaw: checked ? (selectedField.progressRaw?.trim() || "0") : ""
            });
          },
          {
            disabled: !selectedFieldConfig.progressBarEditable,
            title: "Show this field as a progress bar. The preview value stays at 0 here."
          }
        )
      ));
      const statusBarFlagActions = document.createElement("div");
      statusBarFlagActions.className = "row-actions";
      for (const flag of STATUSBAR_KNOWN_FLAGS) {
        const wrap = document.createElement("label");
        wrap.className = "check";
        const boxInput = document.createElement("input");
        boxInput.type = "checkbox";
        boxInput.checked = hasPbFlag(selectedField.flagsRaw, flag);
        boxInput.disabled = !selectedFieldConfig.flagsEditable;
        boxInput.onchange = () => {
          if (!selectedFieldConfig.flagsEditable) return;
          selectedUi.postFieldUpdate({ flagsRaw: buildStatusBarFlagsRaw(selectedField.flagsRaw, { [flag]: boxInput.checked }) ?? "" });
        };
        const caption = document.createElement("span");
        caption.textContent = flag.replace("#PB_StatusBar_", "");
        wrap.appendChild(boxInput);
        wrap.appendChild(caption);
        statusBarFlagActions.appendChild(wrap);
      }
      propsEl.appendChild(row("Flags", statusBarFlagActions));

      const selectedDeleteStatusFieldBtn = document.createElement("button");
      selectedDeleteStatusFieldBtn.textContent = "Delete Field";
      selectedDeleteStatusFieldBtn.disabled = !selectedFieldConfig.deleteEditable || !selectedUi.delFn;
      selectedDeleteStatusFieldBtn.title = selectedDeleteStatusFieldBtn.disabled
        ? "Only parsed statusbar fields with a source line can be deleted."
        : "Delete the currently selected statusbar field.";
      selectedDeleteStatusFieldBtn.onclick = () => {
        if (!selectedFieldConfig.deleteEditable) return;
        selectedUi.delFn?.();
      };
      propsEl.appendChild(row("Delete", selectedDeleteStatusFieldBtn));
    }

    const box = miniList();
    (sb.fields ?? []).forEach((f, idx) => {
      const fieldUi = getStatusBarFieldUi(f);
      const label = `Field ${idx}  ${getStatusBarFieldDisplaySummary(f)}  width:${f.widthRaw}`;

      const rowEl = miniRow(
        label,
        fieldUi.editFn,
        fieldUi.delFn,
        { label: "Label", onClick: fieldUi.statusTextFn, disabled: !fieldUi.statusTextFn, title: "Edit the stored StatusBarText value for this field without clearing the other statusbar cells." },
        { label: "Progress", onClick: fieldUi.statusProgressFn, disabled: !fieldUi.statusProgressFn, title: "Toggle the stored StatusBarProgress state for this field without clearing the other statusbar cells." },
        { label: "Clear", onClick: fieldUi.statusClearFn, disabled: !fieldUi.statusClearFn, title: "Remove text/image/progress decoration from this field." },
        { label: "Set Image", onClick: fieldUi.statusSetImageFn, disabled: !fieldUi.statusSetImageFn, title: "Assign or update the stored StatusBarImage reference while preserving the other statusbar cells." },
        { label: "Use Existing", onClick: fieldUi.statusPickImageFn, disabled: !fieldUi.statusPickImageFn, title: "Select an image from the form image list and assign it to this field." },
        { label: "Choose File", onClick: fieldUi.statusChooseFileImageFn, disabled: !fieldUi.statusChooseFileImageFn, title: "Select a file, create a new LoadImage entry and assign it to this statusbar field." },
        { label: "Create New", onClick: fieldUi.statusCreateImageFn, disabled: !fieldUi.statusCreateImageFn, title: "Create a new form image entry and assign it to this statusbar field." },
        { label: "Image", onClick: fieldUi.statusImage ? () => selectImageById(fieldUi.statusImage!.id) : undefined, disabled: !fieldUi.statusImage, title: fieldUi.statusImageTitle }
      );
      if (selectedFieldIndex === idx) rowEl.classList.add("selected");
      rowEl.onclick = (ev) => {
        if (ev.target instanceof HTMLButtonElement) return;
        setSelectionAndRefresh({ kind: "statusBarField", statusBarId: sb.id, fieldIndex: idx });
      };
      box.appendChild(rowEl);
    });
    if (showStatusBarRootInspector) {
      propsEl.appendChild(section("Fields"));
      propsEl.appendChild(box);

      const addImageBtn = document.createElement("button");
      addImageBtn.textContent = "Add Image";
      addImageBtn.title = "Insert a new statusbar field with image decoration defaults.";
      addImageBtn.onclick = () => {
        postInsertStatusBarField(sb, getStatusBarPreviewInsertArgs("image"));
      };

      const addLabelBtn = document.createElement("button");
      addLabelBtn.textContent = "Add Label";
      addLabelBtn.title = "Insert a new statusbar field with the default label text.";
      addLabelBtn.onclick = () => {
        postInsertStatusBarField(sb, getStatusBarPreviewInsertArgs("label"));
      };

      const addProgressBtn = document.createElement("button");
      addProgressBtn.textContent = "Add Progress";
      addProgressBtn.title = "Insert a new statusbar field with progress decoration defaults.";
      addProgressBtn.onclick = () => {
        postInsertStatusBarField(sb, getStatusBarPreviewInsertArgs("progress"));
      };

      const actions = document.createElement("div");
      actions.className = "miniActions";
      actions.appendChild(addImageBtn);
      actions.appendChild(addLabelBtn);
      actions.appendChild(addProgressBtn);
      if (sel.kind === "statusbar") {
        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete StatusBar";
        deleteBtn.onclick = () => {
          openDestructiveAction({
            kind: "deleteStatusBar",
            statusBarId: sb.id,
            message: `Delete statusbar '${sb.id}'?`,
            confirmLabel: "Delete StatusBar"
          });
        };
        actions.appendChild(deleteBtn);
      }
      propsEl.appendChild(actions);
      if (pendingDestructiveAction?.kind === "deleteStatusBar" && pendingDestructiveAction.statusBarId === sb.id) {
        const pendingEl = createPendingDestructiveActionEl();
        if (pendingEl) propsEl.appendChild(pendingEl);
      }
    }
    if (selectedField
      && pendingDestructiveAction
      && ((pendingDestructiveAction.kind === "deleteStatusBarField"
        || pendingDestructiveAction.kind === "clearStatusBarField")
        && pendingDestructiveAction.statusBarId === sb.id
        && pendingDestructiveAction.fieldIndex === selectedFieldIndex)) {
      const pendingEl = createPendingDestructiveActionEl();
      if (pendingEl) propsEl.appendChild(pendingEl);
    }
    return;
  }

  if (sel.kind === "image") {
    const img = (model.images ?? []).find(entry => entry.id === sel.id);
    if (!img) {
      propsEl.innerHTML = "<div class='muted'>Image not found</div>";
      return;
    }

    const usages = collectImageUsages(img.id);
    const canPatch = typeof img.source?.line === "number";
    const imageEditorOpen = canPatch && isImageEditorOpen(img);
    const imageDraft = getImageEditorDraft(img);

    propsEl.appendChild(row("Id", readonlyInput(img.id)));
    propsEl.appendChild(row("Kind", readonlyInput(imageEditorOpen ? getFormImageCallName(imageDraft) : getFormImageCallName(img))));
    propsEl.appendChild(row(
      "First Param",
      imageEditorOpen
        ? textInput(imageDraft.idRaw, v => updateImageEditorDraft({ idRaw: v }), {
            title: `Edit the first image argument (#ImgName or ${PB_ANY}).`
          })
        : readonlyInput(img.firstParam)
    ));
    if (imageEditorOpen && imageDraft.idRaw.trim().toLowerCase() === "#pb_any") {
      propsEl.appendChild(row(
        "Assigned Var",
        textInput(imageDraft.assignedVar, v => updateImageEditorDraft({ assignedVar: v }), {
          title: `Provide the assigned variable name for ${PB_ANY} image entries.`
        })
      ));
    }
    propsEl.appendChild(row(
      "Image Raw",
      imageEditorOpen
        ? textInput(imageDraft.imageRaw, v => updateImageEditorDraft({ imageRaw: v }), {
            title: "Edit the image source used by this entry."
          })
        : readonlyInput(img.imageRaw)
    ));
    propsEl.appendChild(row("References", readonlyInput(String(usages.length))));

    propsEl.appendChild(section("References"));
    if (!usages.length) {
      propsEl.appendChild(mutedNote("This image is currently not referenced by any parsed gadget, menu, toolbar or statusbar field."));
    } else {
      const refsBox = miniList();
      for (const usage of usages) {
        refsBox.appendChild(miniRow(usage.label, undefined, undefined, {
          label: "Go",
          onClick: () => {
            setSelectionAndRefresh(usage.select);
          }
        }));
      }
      propsEl.appendChild(refsBox);
    }

    const actions = document.createElement("div");
    actions.className = "miniActions";

    const editBtn = document.createElement("button");
    editBtn.textContent = imageEditorOpen ? "Save Image" : "Edit Image";
    editBtn.disabled = !canPatch;
    editBtn.onclick = () => {
      if (!canPatch) return;
      if (imageEditorOpen) {
        saveImageEditor(img);
        return;
      }
      openImageEditor(img);
      renderProps();
    };

    const cancelEditBtn = document.createElement("button");
    cancelEditBtn.textContent = "Cancel Edit";
    cancelEditBtn.hidden = !imageEditorOpen;
    cancelEditBtn.disabled = !imageEditorOpen;
    cancelEditBtn.onclick = () => {
      if (!canPatch || !imageEditorOpen) return;
      closeImageEditor(img.source?.line);
      renderProps();
    };

    const chooseFileBtn = document.createElement("button");
    chooseFileBtn.textContent = "Choose File";
    chooseFileBtn.disabled = imageEditorOpen || !(canPatch && canChooseFileImageEntry(img));
    chooseFileBtn.title = canChooseFileImageEntry(img)
      ? "Select a file for this LoadImage entry."
      : "Only LoadImage entries can select a file path.";
    chooseFileBtn.onclick = () => {
      if (!(canPatch && canChooseFileImageEntry(img))) return;
      post({
        type: WEBVIEW_TO_EXT_MSG_TYPE.chooseImageFileForEntry,
        sourceLine: img.source!.line,
        inline: img.inline,
        idRaw: img.firstParam,
        assignedVar: img.variable
      });
    };

    const toggleInlineBtn = document.createElement("button");
    toggleInlineBtn.textContent = img.inline ? "Use LoadImage" : "Use CatchImage";
    toggleInlineBtn.disabled = imageEditorOpen || !canPatch;
    toggleInlineBtn.title = img.inline
      ? "Switch this image entry from CatchImage to LoadImage without changing its raw value."
      : "Switch this image entry from LoadImage to CatchImage without changing its raw value.";
    toggleInlineBtn.onclick = () => {
      if (!canPatch) return;
      post({
        type: WEBVIEW_TO_EXT_MSG_TYPE.updateImage,
        sourceLine: img.source!.line,
        inline: !img.inline,
        idRaw: img.firstParam,
        imageRaw: img.imageRaw,
        assignedVar: img.pbAny ? img.variable : undefined
      });
    };

    const togglePbAnyBtn = document.createElement("button");
    togglePbAnyBtn.textContent = img.pbAny ? "Use Enum Id" : "Use PB_Any";
    togglePbAnyBtn.disabled = imageEditorOpen || !(canPatch && canToggleImagePbAny(img));
    togglePbAnyBtn.title = img.pbAny
      ? `Switch this image entry from ${PB_ANY} assignment to a regular image id and update parsed references.`
      : `Switch this image entry to ${PB_ANY} assignment and update parsed references.`;
    togglePbAnyBtn.onclick = () => {
      if (!(canPatch && canToggleImagePbAny(img))) return;
      post({
        type: WEBVIEW_TO_EXT_MSG_TYPE.toggleImagePbAny,
        sourceLine: img.source!.line,
        toPbAny: !img.pbAny,
      });
    };

    const relativeBtn = document.createElement("button");
    relativeBtn.textContent = "Make Relative";
    relativeBtn.disabled = imageEditorOpen || !(canPatch && canRelativizeImageEntry(img));
    relativeBtn.title = canRelativizeImageEntry(img)
      ? "Rewrite the LoadImage file path relative to the current form file."
      : "Only quoted LoadImage file paths can be made relative.";
    relativeBtn.onclick = () => {
      if (!(canPatch && canRelativizeImageEntry(img))) return;
      post({
        type: WEBVIEW_TO_EXT_MSG_TYPE.relativizeImagePath,
        sourceLine: img.source!.line,
        inline: img.inline,
        idRaw: img.firstParam,
        imageRaw: img.imageRaw,
        assignedVar: img.variable
      });
    };

    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete Image";
    delBtn.disabled = imageEditorOpen || !canPatch;
    delBtn.onclick = () => {
      if (!canPatch) return;
      openDestructiveAction({
        kind: "deleteImage",
        imageId: img.id,
        sourceLine: img.source!.line,
        message: `Delete image '${img.id}'?`,
        confirmLabel: "Delete Image"
      });
    };

    actions.appendChild(editBtn);
    actions.appendChild(cancelEditBtn);
    actions.appendChild(chooseFileBtn);
    actions.appendChild(toggleInlineBtn);
    actions.appendChild(togglePbAnyBtn);
    actions.appendChild(relativeBtn);
    actions.appendChild(delBtn);
    propsEl.appendChild(actions);
    if (pendingDestructiveAction?.kind === "deleteImage" && pendingDestructiveAction.imageId === img.id) {
      const pendingEl = createPendingDestructiveActionEl();
      if (pendingEl) propsEl.appendChild(pendingEl);
    }
    return;
  }

  if (sel.kind === "images") {
    propsEl.appendChild(row("Entries", readonlyInput(String(model.images?.length ?? 0))));

    const box = miniList();
    for (const img of model.images ?? []) {
      const label = buildFormImageLineLabel(img);
      const canPatch = typeof img.source?.line === "number";

      const rowEl = miniRow(
        label,
        canPatch
          ? () => {
              setSelectionAndRefresh({ kind: "image", id: img.id });
            }
          : undefined,
          canPatch
            ? () => {
                openDestructiveAction(
                  {
                    kind: "deleteImage",
                    imageId: img.id,
                    sourceLine: img.source!.line,
                    message: `Delete image '${img.id}'?`,
                    confirmLabel: "Delete Image"
                  },
                  { kind: "image", id: img.id }
                );
              }
            : undefined,
          {
            label: "Choose",
            onClick: canPatch && canChooseFileImageEntry(img)
              ? () => {
                  post({
                    type: WEBVIEW_TO_EXT_MSG_TYPE.chooseImageFileForEntry,
                    sourceLine: img.source!.line,
                    inline: img.inline,
                    idRaw: img.firstParam,
                    assignedVar: img.variable
                  });
                }
              : undefined,
            disabled: !(canPatch && canChooseFileImageEntry(img)),
            title: canChooseFileImageEntry(img)
              ? "Select a file for this LoadImage entry."
              : "Only LoadImage entries can select a file path."
          },
          {
            label: img.inline ? "Load" : "Catch",
            onClick: canPatch
              ? () => {
                  post({
                    type: WEBVIEW_TO_EXT_MSG_TYPE.updateImage,
                    sourceLine: img.source!.line,
                    inline: !img.inline,
                    idRaw: img.firstParam,
                    imageRaw: img.imageRaw,
                    assignedVar: img.pbAny ? img.variable : undefined
                  });
                }
              : undefined,
            disabled: !canPatch,
            title: img.inline
              ? "Switch this image entry from CatchImage to LoadImage without changing its raw value."
              : "Switch this image entry from LoadImage to CatchImage without changing its raw value."
          },
          {
            label: img.pbAny ? "Enum" : "PB_Any",
            onClick: canPatch && canToggleImagePbAny(img)
              ? () => {
                  post({
                    type: WEBVIEW_TO_EXT_MSG_TYPE.toggleImagePbAny,
                    sourceLine: img.source!.line,
                    toPbAny: !img.pbAny
                  });
                }
              : undefined,
            disabled: !(canPatch && canToggleImagePbAny(img)),
            title: img.pbAny
              ? `Switch this image entry from ${PB_ANY} assignment to a regular image id and update parsed references.`
              : `Switch this image entry to ${PB_ANY} assignment and update parsed references.`
          },
          {
            label: "Relative",
            onClick: canPatch && canRelativizeImageEntry(img)
              ? () => {
                  post({
                    type: WEBVIEW_TO_EXT_MSG_TYPE.relativizeImagePath,
                    sourceLine: img.source!.line,
                    inline: img.inline,
                    idRaw: img.firstParam,
                    imageRaw: img.imageRaw,
                    assignedVar: img.variable
                  });
                }
              : undefined,
            disabled: !(canPatch && canRelativizeImageEntry(img)),
            title: canRelativizeImageEntry(img)
              ? "Rewrite the LoadImage file path relative to the current form file."
              : "Only quoted LoadImage file paths can be made relative."
          }
        );
      rowEl.onclick = (ev) => {
        if (ev.target instanceof HTMLButtonElement) return;
        setSelectionAndRefresh({ kind: "image", id: img.id });
      };
      box.appendChild(rowEl);
    }
    propsEl.appendChild(section("Images"));
    propsEl.appendChild(box);

    const addBtn = document.createElement("button");
    addBtn.textContent = "Add Image";
    addBtn.onclick = () => {
      openImageInsertDraft();
    };

    const actions = document.createElement("div");
    actions.className = "miniActions";
    actions.appendChild(addBtn);
    propsEl.appendChild(actions);
    if (pendingImageInsertDraft) {
      const pendingEl = createPendingImageInsertDraftEl();
      if (pendingEl) propsEl.appendChild(pendingEl);
    }
    return;
  }

  if (sel.kind !== "gadget") {
    propsEl.innerHTML = "";
    return;
  }

  const selId = sel.id;
  const g: Gadget | undefined = model.gadgets.find(it => it.id === selId);
  if (!g) {
    propsEl.innerHTML = "";
    return;
  }

  propsEl.appendChild(section("Details"));
  propsEl.appendChild(row("Id", readonlyInput(g.id)));
  propsEl.appendChild(row("Kind", readonlyInput(g.kind)));
  if (shouldShowGadgetParentDetail(g)) {
    propsEl.appendChild(row("Parent", readonlyInput(g.parentId!.toString())));
  }
  if (shouldShowGadgetTabDetail(g)) {
    propsEl.appendChild(row("Tab", readonlyInput(String(g.parentItem))));
  }
  const itemEditorField = getGadgetItemEditorFieldConfig(g.kind, Boolean(g.items?.length));
  const columnEditorField = getGadgetColumnEditorFieldConfig(g.kind, Boolean(g.columns?.length));
  const showsItemsInspector = Boolean(itemEditorField);
  const showsColumnsInspector = Boolean(columnEditorField);
  if (itemEditorField) {
    propsEl.appendChild(row("Items", readonlyInput(String(g.items?.length ?? 0))));
  }
  if (columnEditorField) {
    propsEl.appendChild(row("Columns", readonlyInput(String(g.columns?.length ?? 0))));
  }
  const imageRowsField = getGadgetImageRowsFieldConfig(g.kind);
  const parentGadget = g.parentId ? model.gadgets.find(it => it.id === g.parentId) : undefined;
  const gadgetImage = findImageEntryById(g.imageId);

  const deleteGadgetBtn = document.createElement("button");
  const deleteGadgetBlockedReason = getGadgetDeleteBlockedReason(g);
  deleteGadgetBtn.textContent = "Delete Gadget";
  deleteGadgetBtn.disabled = Boolean(deleteGadgetBlockedReason);
  deleteGadgetBtn.title = deleteGadgetBlockedReason ?? "Delete the currently selected gadget.";
  deleteGadgetBtn.onclick = () => {
    const action = buildGadgetDeleteAction(g);
    if (!action) return;
    openDestructiveAction(action);
  };

  propsEl.appendChild(section("Actions"));
  propsEl.appendChild(row("Delete", deleteGadgetBtn));
  if (pendingDestructiveAction?.kind === "deleteGadget" && pendingDestructiveAction.gadgetId === g.id) {
    const pendingEl = createPendingDestructiveActionEl();
    if (pendingEl) propsEl.appendChild(pendingEl);
  }

  propsEl.appendChild(section("Properties"));

  const gadgetVariableName = getGadgetVariableInspectorValue(g) || "Gadget_0";
  const gadgetEnumSymbol = `#${gadgetVariableName.trim()}`;

  propsEl.appendChild(
    row(
      PB_ANY,
      checkboxInput(Boolean(g.pbAny), v => {
        // Pre-update selection to the new id so sanitizeSelectionAfterModelUpdate
        // can still find this gadget after the stable key changes.
        const newId = v ? gadgetVariableName : gadgetEnumSymbol;
        selection = { kind: "gadget", id: newId };
        vscode.postMessage({
          type: WEBVIEW_TO_EXT_MSG_TYPE.toggleGadgetPbAny,
          gadgetId: g.id,
          toPbAny: v,
          variableName: gadgetVariableName,
          enumSymbol: gadgetEnumSymbol,
          enumValueRaw: g.enumValueRaw
        });
      })
    )
  );

  const gadgetVariableInputValue = getGadgetVariableInspectorValue(g);
  propsEl.appendChild(
    row(
      "Variable",
      textInput(gadgetVariableInputValue, v => {
        const parsed = parseWindowVariableNameInspectorInput(v, gadgetVariableInputValue);
        if (!parsed.ok) {
          clearInfoError();
          renderProps();
          return;
        }
        // Pre-update selection to the new id so sanitizeSelectionAfterModelUpdate
        // can still find this gadget after the stable key changes.
        const newId = g.pbAny ? parsed.value : `#${parsed.value}`;
        selection = { kind: "gadget", id: newId };
        vscode.postMessage({
          type: WEBVIEW_TO_EXT_MSG_TYPE.setGadgetVariableName,
          gadgetId: g.id,
          variableName: parsed.value
        });
      })
    )
  );

  if (!g.pbAny) {
    propsEl.appendChild(row("Enum Value", textInput(g.enumValueRaw ?? "", v => {
      vscode.postMessage({
        type: WEBVIEW_TO_EXT_MSG_TYPE.setGadgetEnumValue,
        enumSymbol: gadgetEnumSymbol,
        enumValueRaw: v.trim().length ? v.trim() : undefined
      });
    })));
  }

  const captionField = getGadgetCaptionFieldConfig(g.kind);
  const colorRowsField = getGadgetColorRowsFieldConfig(g.kind);
  const checkedStateField = getGadgetCheckedStateFieldConfig(g.kind);
  const parentField = getGadgetParentFieldConfig(g.kind, Boolean(g.parentId));
  const resizeLockField = getGadgetResizeLockFieldConfig(g.kind);
  const fontField = getGadgetFontFieldConfig(g.kind);
  const constantsField = getGadgetConstantsFieldConfig(g.kind);
  const hasExpressionVisibility = (Boolean(g.hiddenRaw) && g.hidden === undefined) || (Boolean(g.disabledRaw) && g.disabled === undefined);
  const hasExpressionChecked = Boolean(checkedStateField) && Boolean(g.stateRaw) && g.state === undefined;

  if (captionField) {
    propsEl.appendChild(
      row(
        "Caption Is Variable",
        checkboxInput(Boolean(g.textVariable), v => {
          applyLocalGadgetTextUpdate(g, getGadgetTextInspectorValue(g), v);
        }, {
          disabled: !captionField.variableToggleEditable,
          title: captionField.variableToggleEditable
            ? "Treat this value as a variable or expression instead of a string literal."
            : "This gadget keeps the original callback field behavior and does not expose a variable toggle here."
        })
      )
    );
    propsEl.appendChild(
      row(
        captionField.label,
        textInput(
          getGadgetTextInspectorValue(g),
          v => {
            applyLocalGadgetTextUpdate(g, v, Boolean(g.textVariable));
          },
          {
            disabled: !captionField.textEditable,
            title: captionField.label === "Mask"
              ? "Mask text passed to this DateGadget."
              : captionField.label === "Callback"
                ? "Callback procedure passed to this Scintilla gadget."
                : captionField.textEditable
                  ? "Text shown for this gadget. Enable 'Caption Is Variable' if this value is a variable name or expression."
                  : "This gadget keeps the original readonly caption field behavior."
          }
        )
      )
    );
  }

  const tooltipField = getGadgetTooltipFieldConfig(g.kind);
  if (tooltipField) {
    propsEl.appendChild(
      row(
        "Tooltip Is Variable",
        checkboxInput(Boolean(g.tooltipVariable), v => {
          applyLocalGadgetTooltipUpdate(g, getGadgetTooltipInspectorValue(g), v);
        }, {
          disabled: !tooltipField.variableToggleEditable,
          title: tooltipField.variableToggleEditable
            ? "Treat this tooltip as a variable or expression instead of a string literal."
            : "This gadget keeps the original readonly tooltip-variable field behavior."
        })
      )
    );
    propsEl.appendChild(
      row(
        "Tooltip",
        textInput(
          getGadgetTooltipInspectorValue(g),
          v => {
            applyLocalGadgetTooltipUpdate(g, v, Boolean(g.tooltipVariable));
          },
          {
            disabled: !tooltipField.valueEditable,
            title: tooltipField.valueEditable
              ? "Tooltip shown for this gadget. Enable 'Tooltip Is Variable' if this value is a variable name or expression."
              : "This gadget keeps the original readonly tooltip field behavior."
          }
        )
      )
    );
  }

  propsEl.appendChild(section("Layout"));
  propsEl.appendChild(row("X", numberInput(g.x, v => { updateGadgetDisplayField(g, "x", asInt(v)); postGadgetRect(g); render(); renderProps(); })));
  if (shouldShowReadonlyUnscaledLayoutRows()) {
    propsEl.appendChild(row("X (Unscaled)", readonlyInput(getReadonlyUnscaledLayoutValue(g.xRaw, g.x), "Readonly code value written to the gadget constructor.")));
  }
  propsEl.appendChild(row("Y", numberInput(g.y, v => { updateGadgetDisplayField(g, "y", asInt(v)); postGadgetRect(g); render(); renderProps(); })));
  if (shouldShowReadonlyUnscaledLayoutRows()) {
    propsEl.appendChild(row("Y (Unscaled)", readonlyInput(getReadonlyUnscaledLayoutValue(g.yRaw, g.y), "Readonly code value written to the gadget constructor.")));
  }
  propsEl.appendChild(row("Width", numberInput(g.w, v => { updateGadgetDisplayField(g, "w", asInt(v)); postGadgetRect(g); render(); renderProps(); })));
  if (shouldShowReadonlyUnscaledLayoutRows()) {
    propsEl.appendChild(row("Width (Unscaled)", readonlyInput(getReadonlyUnscaledLayoutValue(g.wRaw, g.w), "Readonly code value written to the gadget constructor.")));
  }
  propsEl.appendChild(row("Height", numberInput(g.h, v => { updateGadgetDisplayField(g, "h", asInt(v)); postGadgetRect(g); render(); renderProps(); })));
  if (shouldShowReadonlyUnscaledLayoutRows()) {
    propsEl.appendChild(row("Height (Unscaled)", readonlyInput(getReadonlyUnscaledLayoutValue(g.hRaw, g.h), "Readonly code value written to the gadget constructor.")));
  }

  propsEl.appendChild(
    row(
      "Hidden",
      checkboxInput(getGadgetBooleanInspectorState(g.hiddenRaw, g.hidden), v => {
        g.hidden = v;
        g.hiddenRaw = v ? "1" : "0";
        postGadgetProperties(g.id, { hiddenRaw: g.hiddenRaw });
        render();
        renderProps();
      }, {
        title: g.hiddenRaw && g.hidden === undefined ? "This gadget currently uses a custom hide expression. Changing it here replaces it with 1 or 0." : "Show or hide this gadget."
      })
    )
  );
  propsEl.appendChild(
    row(
      "Disabled",
      checkboxInput(getGadgetBooleanInspectorState(g.disabledRaw, g.disabled), v => {
        g.disabled = v;
        g.disabledRaw = v ? "1" : "0";
        postGadgetProperties(g.id, { disabledRaw: g.disabledRaw });
        render();
        renderProps();
      }, {
        title: g.disabledRaw && g.disabled === undefined ? "This gadget currently uses a custom disable expression. Changing it here replaces it with 1 or 0." : "Enable or disable this gadget."
      })
    )
  );
  if (resizeLockField) {
    const resizeCtx = getWindowResizeLockContext(g);
    const currentLockLeft = g.lockLeft !== false;
  const currentLockRight = g.lockRight === true;
  const currentLockTop = g.lockTop !== false;
  const currentLockBottom = g.lockBottom === true;
  const horizontalLockLeftToggle = resizeCtx
    ? buildGadgetHorizontalLockResizeUpdate(g, resizeCtx, !currentLockLeft, currentLockRight)
    : undefined;
  const horizontalLockRightToggle = resizeCtx
    ? buildGadgetHorizontalLockResizeUpdate(g, resizeCtx, currentLockLeft, !currentLockRight)
    : undefined;
  const verticalLockTopToggle = buildGadgetVerticalLockResizeUpdate(g, resizeCtx, !currentLockTop, currentLockBottom);
  const verticalLockBottomToggle = buildGadgetVerticalLockResizeUpdate(g, resizeCtx, currentLockTop, !currentLockBottom);
  const impossibleHorizontalUnlockTitle = "This transition cannot be persisted safely: when the other axis still needs ResizeGadget(...), the source code cannot store a state with neither LockLeft nor LockRight.";
  const impossibleVerticalUnlockTitle = "This transition cannot be persisted safely: when the other axis still needs ResizeGadget(...), the source code cannot store a state with neither LockTop nor LockBottom.";
  propsEl.appendChild(row("LockLeft", checkboxInput(currentLockLeft, v => {
    applyLocalGadgetHorizontalLockUpdate(g, v, currentLockRight);
  }, {
    disabled: !horizontalLockLeftToggle,
    title: horizontalLockLeftToggle
      ? "Keep the gadget anchored to the left when the window is resized."
      : (currentLockLeft && !currentLockRight ? impossibleHorizontalUnlockTitle : "This lock can be edited only when the current layout can be converted to a safe ResizeGadget(...) update.")
  })));
  propsEl.appendChild(row("LockRight", checkboxInput(currentLockRight, v => {
    applyLocalGadgetHorizontalLockUpdate(g, currentLockLeft, v);
  }, {
    disabled: !horizontalLockRightToggle,
    title: horizontalLockRightToggle
      ? "Keep the gadget anchored to the right when the window is resized."
      : (!currentLockLeft && currentLockRight ? impossibleHorizontalUnlockTitle : "This lock can be edited only when the current layout can be converted to a safe ResizeGadget(...) update.")
  })));
  propsEl.appendChild(row("LockTop", checkboxInput(currentLockTop, v => {
    applyLocalGadgetVerticalLockUpdate(g, v, currentLockBottom);
  }, {
    disabled: !verticalLockTopToggle,
    title: verticalLockTopToggle
      ? "Keep the gadget anchored to the top when the window is resized."
      : (currentLockTop && !currentLockBottom ? impossibleVerticalUnlockTitle : "This lock can be edited only when the current layout can be converted to a safe ResizeGadget(...) update.")
  })));
  propsEl.appendChild(row("LockBottom", checkboxInput(currentLockBottom, v => {
    applyLocalGadgetVerticalLockUpdate(g, currentLockTop, v);
  }, {
    disabled: !verticalLockBottomToggle,
    title: verticalLockBottomToggle
      ? "Keep the gadget anchored to the bottom when the window is resized."
      : (!currentLockTop && currentLockBottom ? impossibleVerticalUnlockTitle : "This lock can be edited only when the current layout can be converted to a safe ResizeGadget(...) update.")
  })));
  propsEl.appendChild(mutedNote(horizontalLockLeftToggle || horizontalLockRightToggle || verticalLockTopToggle || verticalLockBottomToggle
    ? "These lock options create, update or remove the gadget's ResizeGadget(...) line as needed."
    : "Lock editing is available only when the current layout can be converted to a safe ResizeGadget(...) update."
  ));
  }
  if (hasExpressionVisibility) {
    propsEl.appendChild(mutedNote("Custom Hidden/Disabled expressions stay unchanged until you edit them here. Editing replaces them with 1 or 0."));
  }

  if (fontField) {
    propsEl.appendChild(
      row(
        "Font Raw",
        textInput(
          g.gadgetFontRaw ?? "",
          v => {
            const trimmed = v.trim();
            g.gadgetFontRaw = trimmed || undefined;
            postGadgetProperties(g.id, { gadgetFontRaw: trimmed || undefined });
            renderProps();
          },
          { disabled: !fontField.rawEditable, title: fontField.title }
        )
      )
    );
    const gadgetFontSummary = getGadgetFontDisplaySummary(g);
    if (gadgetFontSummary) {
      propsEl.appendChild(mutedNote(`Current font: ${gadgetFontSummary}`));
    }
  }

  if (colorRowsField?.visible) {
    const frontColorInput = readonlyInput((g.frontColorRaw ?? "").trim());
    frontColorInput.title = colorRowsField.frontColorTitle;
    const frontColorPicker = document.createElement("input");
    frontColorPicker.type = "color";
    frontColorPicker.value = pbColorNumberToCssHex(g.frontColor) ?? "#000000";
    frontColorPicker.disabled = !colorRowsField.valueEditable;
    frontColorPicker.title = "Choose the gadget front color. The value is saved as RGB(...).";
    frontColorPicker.style.width = "40px";
    frontColorPicker.style.minWidth = "40px";
    frontColorPicker.style.padding = "0";
    frontColorPicker.onchange = () => {
      const nextColorRaw = cssHexToPbRgbRaw(frontColorPicker.value);
      if (!nextColorRaw) return;
      const parsedColor = parseWindowColorInspectorInput(nextColorRaw);
      clearInfoError();
      g.frontColorRaw = nextColorRaw;
      if (parsedColor.ok) {
        g.frontColor = parsedColor.previewColor;
      }
      postGadgetProperties(g.id, { frontColorRaw: nextColorRaw });
      render();
      renderProps();
    };
    const clearFrontColorBtn = document.createElement("button");
    clearFrontColorBtn.textContent = "Remove";
    clearFrontColorBtn.disabled = !colorRowsField.valueEditable || !(g.frontColorRaw?.trim() || typeof g.frontColor === "number");
    clearFrontColorBtn.title = clearFrontColorBtn.disabled
      ? "No gadget front color is set."
      : "Remove the current gadget front color.";
    clearFrontColorBtn.onclick = () => {
      clearInfoError();
      g.frontColorRaw = undefined;
      g.frontColor = undefined;
      postGadgetProperties(g.id, { frontColorRaw: "" });
      render();
      renderProps();
    };
    if (colorRowsField.frontColorVisible) {
      propsEl.appendChild(row(colorRowsField.frontColorLabel, inputWithActions(frontColorInput, frontColorPicker, clearFrontColorBtn)));
    }

    const backColorInput = readonlyInput((g.backColorRaw ?? "").trim());
    backColorInput.title = colorRowsField.backColorTitle;
    const backColorPicker = document.createElement("input");
    backColorPicker.type = "color";
    backColorPicker.value = pbColorNumberToCssHex(g.backColor) ?? "#000000";
    backColorPicker.disabled = !colorRowsField.valueEditable;
    backColorPicker.title = "Choose the gadget background color. The value is saved as RGB(...).";
    backColorPicker.style.width = "40px";
    backColorPicker.style.minWidth = "40px";
    backColorPicker.style.padding = "0";
    backColorPicker.onchange = () => {
      const nextColorRaw = cssHexToPbRgbRaw(backColorPicker.value);
      if (!nextColorRaw) return;
      const parsedColor = parseWindowColorInspectorInput(nextColorRaw);
      clearInfoError();
      g.backColorRaw = nextColorRaw;
      if (parsedColor.ok) {
        g.backColor = parsedColor.previewColor;
      }
      postGadgetProperties(g.id, { backColorRaw: nextColorRaw });
      render();
      renderProps();
    };
    const clearBackColorBtn = document.createElement("button");
    clearBackColorBtn.textContent = "Remove";
    clearBackColorBtn.disabled = !colorRowsField.valueEditable || !(g.backColorRaw?.trim() || typeof g.backColor === "number");
    clearBackColorBtn.title = clearBackColorBtn.disabled
      ? "No gadget background color is set."
      : "Remove the current gadget background color.";
    clearBackColorBtn.onclick = () => {
      clearInfoError();
      g.backColorRaw = undefined;
      g.backColor = undefined;
      postGadgetProperties(g.id, { backColorRaw: "" });
      render();
      renderProps();
    };
    if (colorRowsField.backColorVisible) {
      propsEl.appendChild(row(colorRowsField.backColorLabel, inputWithActions(backColorInput, backColorPicker, clearBackColorBtn)));
    }
    propsEl.appendChild(mutedNote("Use the pickers to set gadget front/background colors. Remove clears the current color."));
  }

  const gadgetCtorRangeLabels = getGadgetCtorRangeFieldLabels(g.kind);
  if (gadgetCtorRangeLabels) {
    propsEl.appendChild(
      row(
        gadgetCtorRangeLabels.minLabel,
        textInput(
          getInspectorGadgetCtorRangeValue(g, "min"),
          v => {
            applyLocalGadgetCtorRangeUpdate(g, "min", v);
          },
          { title: gadgetCtorRangeLabels.title }
        )
      )
    );
    if (shouldShowReadonlyUnscaledGadgetCtorRangeRows(g)) {
      propsEl.appendChild(row(`${gadgetCtorRangeLabels.minLabel} (Unscaled)`, readonlyInput(getReadonlyUnscaledGadgetCtorRangeValue(g, "min"), "Readonly code value written to the gadget constructor.")));
    }
    propsEl.appendChild(
      row(
        gadgetCtorRangeLabels.maxLabel,
        textInput(
          getInspectorGadgetCtorRangeValue(g, "max"),
          v => {
            applyLocalGadgetCtorRangeUpdate(g, "max", v);
          },
          { title: gadgetCtorRangeLabels.title }
        )
      )
    );
    if (shouldShowReadonlyUnscaledGadgetCtorRangeRows(g)) {
      propsEl.appendChild(row(`${gadgetCtorRangeLabels.maxLabel} (Unscaled)`, readonlyInput(getReadonlyUnscaledGadgetCtorRangeValue(g, "max"), "Readonly code value written to the gadget constructor.")));
    }
  }

  if (checkedStateField?.visible) {
    propsEl.appendChild(
      row(
        checkedStateField.label,
        checkboxInput(Boolean(g.state), v => {
          g.state = v ? 1 : 0;
          g.stateRaw = buildGadgetCheckedStateRaw(g.kind, v);
          post({ type: WEBVIEW_TO_EXT_MSG_TYPE.setGadgetStateRaw, id: g.id, stateRaw: g.stateRaw });
          render();
          renderProps();
        }, {
          title: hasExpressionChecked
            ? "This gadget currently uses a custom checked expression. Changing it here replaces it with a simple checked/unchecked value."
            : checkedStateField.title,
          disabled: !checkedStateField.valueEditable
        })
      )
    );
    if (hasExpressionChecked) {
      propsEl.appendChild(mutedNote("Custom checked expressions stay unchanged until you edit them here. Editing replaces them with a simple checked/unchecked value or removes the line."));
    }
  }

  if (canInspectCustomGadgetCodeRows(g.kind)) {
    const customSelectPresetField = getCustomGadgetSelectPresetFieldConfig(g.kind);
    propsEl.appendChild(
      row(
        "SelectGadget",
        editableComboInput(
          g.customSelectName ?? "",
          [],
          v => {
            g.customSelectName = v.length ? v : undefined;
            renderProps();
          },
          {
            disabled: !customSelectPresetField?.valueEditable,
            title: customSelectPresetField?.title ?? "Select a CustomGadget preset."
          }
        )
      )
    );
    propsEl.appendChild(
      row(
        "InitCode",
        textInput(
          g.customInitRaw ?? "",
          v => {
            g.customInitRaw = v.length ? v : undefined;
            postCustomGadgetCode(g.id, { customInitRaw: v });
            renderProps();
          },
          { title: "Initialization code written before the custom gadget is created." }
        )
      )
    );
    propsEl.appendChild(
      row(
        "CreateCode",
        textInput(
          g.customCreateRaw ?? "",
          v => {
            if (!v.length) {
              renderProps();
              return;
            }
            g.customCreateRaw = v;
            postCustomGadgetCode(g.id, { customCreateRaw: v });
            renderProps();
          },
          { title: "Creation code used to build this custom gadget." }
        )
      )
    );
    propsEl.appendChild(
      row(
        "Help",
        textInput(
          getCustomGadgetHelpDisplay(),
          () => {},
          {
            disabled: true,
            title: "Reference placeholders that can be used in custom gadget code."
          }
        )
      )
    );
    propsEl.appendChild(mutedNote("SelectGadget chooses the preset shown here. InitCode and CreateCode remain the effective saved creation code."));
  }

  if (parentField) {
    propsEl.appendChild(row("Parent", readonlyInput(getGadgetParentInspectorValue(parentGadget), parentField.title)));
  }

  if (parentField?.selectTargetAvailable && g.parentId) {
    const btn = document.createElement("button");
    btn.textContent = "Select Parent";
    btn.title = parentField.title;
    btn.onclick = () => {
      selection = { kind: "gadget", id: g.parentId! };
      render();
      renderListAndParentSelector();
      renderProps();
    };
    propsEl.appendChild(row("", btn));
  }

  if (parentField) {
    const changeParentBtn = document.createElement("button");
    const canChangeParent = parentField.changeDialogAvailable && canOpenGadgetReparentDialog(g);
    changeParentBtn.textContent = "Change Parent";
    changeParentBtn.disabled = !canChangeParent;
    changeParentBtn.title = canChangeParent
      ? "Open the Select Parent dialog for this gadget."
      : "Changing the parent is not available for this gadget type.";
    changeParentBtn.onclick = () => {
      if (!canChangeParent) return;
      openSelectParentDialog(g);
    };
    propsEl.appendChild(row("", changeParentBtn));
  }

  const splitterPositionField = getGadgetSplitterPositionFieldConfig(g.kind);
  if (splitterPositionField?.visible) {
    const splitterPositionInput = numberInput(getEditableSplitterState(g), v => {
      const next = Math.trunc(v);
      const vertical = hasPbFlag(g.flagsExpr, "#PB_Splitter_Vertical");
      const limit = vertical ? g.w : g.h;
      if (!Number.isFinite(next) || next <= 0 || next >= limit) {
        alert(`Splitter position must be between 1 and ${Math.max(1, limit - 1)}.`);
        renderProps();
        return;
      }
      if (isActiveLayoutDpiScalingEnabled() && isDpiScaledGadgetState(g.kind)) {
        const nextRaw = toUnscaledLayoutRaw(next);
        storeLayoutDisplayOverride("gadget", g.id, "state", next, nextRaw);
        g.state = next;
        g.stateRaw = nextRaw;
        post({ type: WEBVIEW_TO_EXT_MSG_TYPE.setGadgetStateRaw, id: g.id, stateRaw: nextRaw });
      } else {
        g.state = next;
        g.stateRaw = String(next);
        post({ type: WEBVIEW_TO_EXT_MSG_TYPE.setGadgetStateRaw, id: g.id, stateRaw: String(next) });
      }
      render();
      renderProps();
    });
    splitterPositionInput.disabled = !splitterPositionField.valueEditable;
    splitterPositionInput.title = splitterPositionField.title;
    propsEl.appendChild(row(splitterPositionField.label, splitterPositionInput));
    if (shouldShowReadonlyUnscaledGadgetStateRows(g)) {
      propsEl.appendChild(row("Splitter Position (Unscaled)", readonlyInput(getReadonlyUnscaledGadgetStateValue(g), "Readonly code value written to SetGadgetState(...).")));
    }
    propsEl.appendChild(mutedNote("Set the splitter position between the two child gadgets."));
  }

  if (imageRowsField) {
    propsEl.appendChild(
      row(
        "CurrentImage",
        readonlyInput(getGadgetCurrentImageDisplay(g, gadgetImage), imageRowsField.currentImageTitle)
      )
    );
    if (gadgetImage && typeof gadgetImage.source?.line === "number") {
      const canToggle = canToggleImagePbAny(gadgetImage);
      propsEl.appendChild(row(
        `Image ${PB_ANY}`,
        checkboxInput(
          Boolean(gadgetImage.pbAny),
          () => {
            if (!canToggle) return;
            post({
              type: WEBVIEW_TO_EXT_MSG_TYPE.toggleImagePbAny,
              sourceLine: gadgetImage!.source!.line,
              toPbAny: !gadgetImage!.pbAny,
            });
          },
          {
            disabled: !canToggle,
            title: gadgetImage.pbAny
              ? `Switch the assigned image entry from ${PB_ANY} to a regular enum id and update all references. (This is separate from the gadget's own ${PB_ANY} toggle.)`
              : `Switch the assigned image entry to ${PB_ANY} variable mode and update all references. (This is separate from the gadget's own ${PB_ANY} toggle.)`
          }
        )
      ));
    }

    const gadgetImageActions = document.createElement("div");
    gadgetImageActions.className = "row-actions";
    const gadgetChooseFileBtn = document.createElement("button");
    gadgetChooseFileBtn.textContent = "Select";
    gadgetChooseFileBtn.disabled = !imageRowsField.changeImageAvailable;
    gadgetChooseFileBtn.title = imageRowsField.changeImageTitle;
    gadgetChooseFileBtn.onclick = () => {
      if (!imageRowsField.changeImageAvailable) return;
      openImageAssignmentDraft({ kind: "gadget", gadgetId: g.id }, "chooseFile");
    };
    gadgetImageActions.appendChild(gadgetChooseFileBtn);
    propsEl.appendChild(row("ChangeImage", gadgetImageActions));
  }

  if (isImageAssignmentDraftOpenFor({ kind: "gadget", gadgetId: g.id })) {
    const pendingEl = createPendingImageAssignmentDraftEl();
    if (pendingEl) propsEl.appendChild(pendingEl);
  }

  const gadgetSelectProcField = getGadgetSelectProcFieldConfig(g.kind);
  if (gadgetSelectProcField) {
    propsEl.appendChild(
      row(
        "SelectProc",
        editableComboInput(
          g.eventProc ?? "",
          getProcedureSuggestions(),
          v => {
            g.eventProc = v.length ? v : undefined;
            post({
              type: WEBVIEW_TO_EXT_MSG_TYPE.setGadgetEventProc,
              id: g.id,
              eventProc: v.length ? v : undefined
            });
            renderProps();
          },
          {
            disabled: !gadgetSelectProcField.valueEditable,
            title: gadgetSelectProcField.title,
            placeholder: gadgetSelectProcField.placeholder
          }
        )
      )
    );
  }

  if (constantsField) {
    const gadgetKnownFlags = constantsField.knownFlags;
    const enabledGadgetFlags = new Set(
      (g.flagsExpr ?? "")
        .split("|")
        .map(part => part.trim())
        .filter(Boolean)
    );

    propsEl.appendChild(section("Constants"));
    for (const flag of gadgetKnownFlags) {
      propsEl.appendChild(row(
        flag,
        checkboxInput(enabledGadgetFlags.has(flag), checked => {
          const nextEnabled = new Set(
            (g.flagsExpr ?? "")
              .split("|")
              .map(part => part.trim())
              .filter(Boolean)
              .filter(part => gadgetKnownFlags.includes(part))
          );
          if (checked) nextEnabled.add(flag);
          else nextEnabled.delete(flag);
          const nextKnown = gadgetKnownFlags.filter(entry => nextEnabled.has(entry));
          const nextExpr = buildGadgetFlagsExpr(g.kind, nextKnown, g.flagsExpr);
          g.flagsExpr = nextExpr;
          postGadgetOpenArgs(g.id, { flagsExpr: nextExpr ?? "" });
          render();
          renderProps();
        }, { title: constantsField.title })
      ));
    }
  }

  // Items editor (minimal UI)
  if (itemEditorField) {
    propsEl.appendChild(section("Items"));
    const itemDraft = getGadgetItemDraft(g);
    const itemEditorOpen = isGadgetItemEditorOpen(g);
  if (itemDraft && itemEditorOpen) {
    propsEl.appendChild(row(
      "Item Text",
      textInput(itemDraft.text, v => updateGadgetItemEditorDraft({ text: v }), {
        title: itemEditorField.itemTextTitle
      })
    ));
    propsEl.appendChild(row(
      "Position",
      textInput(itemDraft.posRaw, v => updateGadgetItemEditorDraft({ posRaw: v }), {
        title: itemEditorField.positionRawTitle
      })
    ));
    propsEl.appendChild(row(
      "Image Raw",
      textInput(itemDraft.imageRaw, v => updateGadgetItemEditorDraft({ imageRaw: v }), {
        title: itemEditorField.imageRawTitle
      })
    ));
    propsEl.appendChild(row(
      "Flags Raw",
      textInput(itemDraft.flagsRaw, v => updateGadgetItemEditorDraft({ flagsRaw: v }), {
        title: itemEditorField.flagsRawTitle
      })
    ));

    const itemEditorActions = document.createElement("div");
    itemEditorActions.className = "miniActions";
    const saveItemBtn = document.createElement("button");
    saveItemBtn.textContent = itemDraft.sourceLine ? "Save Item" : "Insert Item";
    saveItemBtn.onclick = () => saveGadgetItemEditor(g);
    const cancelItemBtn = document.createElement("button");
    cancelItemBtn.textContent = "Cancel Item";
    cancelItemBtn.onclick = () => {
      closeGadgetItemEditor(g.id);
      renderProps();
    };
    itemEditorActions.appendChild(saveItemBtn);
    itemEditorActions.appendChild(cancelItemBtn);
    propsEl.appendChild(itemEditorActions);
  }

  const itemsBox = miniList();
  (g.items ?? []).forEach((it, idx) => {
    const label = g.kind === GADGET_KIND.PanelGadget
      ? getPanelInspectorItemLabel(it, idx)
      : `${idx}  ${it.text ?? it.textRaw ?? ""}`;
    const canPatch = typeof it.source?.line === "number";

    const itemImage = findImageEntryById(it.imageId);
    const itemImageHint = getImageReferenceHint(it.imageId, "gadget");

    itemsBox.appendChild(
      miniRow(
        label,
        canPatch
          ? () => {
              openGadgetItemEditor(g, it);
              renderProps();
            }
          : undefined,
        canPatch
          ? () => {
              openDestructiveAction({
                kind: "deleteGadgetItem",
                gadgetId: g.id,
                sourceLine: it.source!.line,
                message: `Delete item ${idx} from gadget '${g.id}'?`,
                confirmLabel: "Delete Item"
              });
            }
          : undefined,
        {
          label: "Image",
          onClick: itemImage ? () => selectImageById(itemImage.id) : undefined,
          disabled: !itemImage,
          title: itemImage ? "" : itemImageHint
        }
      )
    );
  });

  const addItemBtn = document.createElement("button");
  addItemBtn.textContent = "Add Item";
  addItemBtn.title = itemEditorField.addButtonTitle;
  addItemBtn.onclick = () => {
    openGadgetItemEditor(g);
    renderProps();
  };

  const itemActions = document.createElement("div");
  itemActions.className = "miniActions";
  itemActions.appendChild(addItemBtn);

  propsEl.appendChild(itemsBox);
  propsEl.appendChild(itemActions);
    if (pendingDestructiveAction?.kind === "deleteGadgetItem" && pendingDestructiveAction.gadgetId === g.id) {
      const pendingEl = createPendingDestructiveActionEl();
      if (pendingEl) propsEl.appendChild(pendingEl);
    }
  }

  // Columns editor (minimal UI)
  if (columnEditorField) {
    propsEl.appendChild(section("Columns"));
    const columnDraft = getGadgetColumnDraft(g);
    const columnEditorOpen = isGadgetColumnEditorOpen(g);
  if (columnDraft && columnEditorOpen) {
    propsEl.appendChild(row(
      "Column Title",
      textInput(columnDraft.title, v => updateGadgetColumnEditorDraft({ title: v }), {
        title: columnEditorField.columnTitleTitle
      })
    ));
    propsEl.appendChild(row(
      "Column Index",
      textInput(columnDraft.colRaw, v => updateGadgetColumnEditorDraft({ colRaw: v }), {
        title: columnEditorField.indexRawTitle
      })
    ));
    propsEl.appendChild(row(
      "Width",
      textInput(columnDraft.widthRaw, v => updateGadgetColumnEditorDraft({ widthRaw: v }), {
        title: columnEditorField.widthRawTitle
      })
    ));

    const columnEditorActions = document.createElement("div");
    columnEditorActions.className = "miniActions";
    const saveColumnBtn = document.createElement("button");
    saveColumnBtn.textContent = columnDraft.sourceLine ? "Save Column" : "Insert Column";
    saveColumnBtn.onclick = () => saveGadgetColumnEditor(g);
    const cancelColumnBtn = document.createElement("button");
    cancelColumnBtn.textContent = "Cancel Column";
    cancelColumnBtn.onclick = () => {
      closeGadgetColumnEditor(g.id);
      renderProps();
    };
    columnEditorActions.appendChild(saveColumnBtn);
    columnEditorActions.appendChild(cancelColumnBtn);
    propsEl.appendChild(columnEditorActions);
  }

  const colsBox = miniList();
  (g.columns ?? []).forEach((c, idx) => {
    const label = `${idx}  ${c.title ?? c.titleRaw ?? ""}  w:${c.widthRaw ?? ""}`;
    const canPatch = typeof c.source?.line === "number";

    colsBox.appendChild(
      miniRow(
        label,
        canPatch
          ? () => {
              openGadgetColumnEditor(g, c, idx);
              renderProps();
            }
          : undefined,
        canPatch
          ? () => {
              openDestructiveAction({
                kind: "deleteGadgetColumn",
                gadgetId: g.id,
                sourceLine: c.source!.line,
                message: `Delete column ${idx} from gadget '${g.id}'?`,
                confirmLabel: "Delete Column"
              });
            }
          : undefined
      )
    );
  });

  const addColBtn = document.createElement("button");
  addColBtn.textContent = "Add Column";
  addColBtn.onclick = () => {
    openGadgetColumnEditor(g);
    renderProps();
  };

  const colActions = document.createElement("div");
  colActions.className = "miniActions";
  colActions.appendChild(addColBtn);

  propsEl.appendChild(colsBox);
  propsEl.appendChild(colActions);
    if (pendingDestructiveAction?.kind === "deleteGadgetColumn" && pendingDestructiveAction.gadgetId === g.id) {
      const pendingEl = createPendingDestructiveActionEl();
      if (pendingEl) propsEl.appendChild(pendingEl);
    }
  }
}

function createPendingImageReferencePickerEl() {
  if (!pendingImageReferencePicker) return null;
  const wrap = document.createElement("div");
  wrap.appendChild(createSubSection("Select Existing Image"));
  wrap.appendChild(row(
    "Image",
    selectInput(
      pendingImageReferencePicker.selectedImageId,
      (model.images ?? []).map(img => ({
        value: img.id,
        label: `${img.id} — ${buildFormImageLineLabel(img)}`
      })),
      value => updateImageReferencePicker({ selectedImageId: value })
    )
  ));
  const selected = findImageEntryById(pendingImageReferencePicker.selectedImageId);
  wrap.appendChild(row("Current", readonlyInput(selected?.imageRaw ?? selected?.image ?? "")));
  const actions = document.createElement("div");
  actions.className = "miniActions";
  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Assign";
  saveBtn.onclick = () => saveImageReferencePicker();
  actions.appendChild(saveBtn);
  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.onclick = () => closeImageReferencePicker();
  actions.appendChild(cancelBtn);
  wrap.appendChild(actions);
  return wrap;
}

function createPendingImageAssignmentDraftEl() {
  if (!pendingImageAssignmentDraft) return null;
  const wrap = document.createElement("div");
  const isGadgetChooseFile = pendingImageAssignmentDraft.mode === "chooseFile" && pendingImageAssignmentDraft.target.kind === "gadget";
  wrap.appendChild(createSubSection(
    pendingImageAssignmentDraft.mode === "create"
      ? "Create and Assign Image"
      : isGadgetChooseFile
        ? "Change Image"
        : "Choose File and Assign Image"
  ));
  if (pendingImageAssignmentDraft.mode === "create") {
    wrap.appendChild(row(
      "Kind",
      selectInput(
        pendingImageAssignmentDraft.inline ? "CatchImage" : "LoadImage",
        [
          { value: "LoadImage", label: "LoadImage" },
          { value: "CatchImage", label: "CatchImage" }
        ],
        value => updateImageAssignmentDraft({ inline: value === "CatchImage" })
      )
    ));
  }
  else if (!isGadgetChooseFile) {
    wrap.appendChild(row("Kind", readonlyInput("LoadImage")));
  }
  if (!isGadgetChooseFile) {
    wrap.appendChild(row(
      "First Param",
      textInput(pendingImageAssignmentDraft.idRaw, value => updateImageAssignmentDraft({ idRaw: value }), {
        title: `Use either a fixed image id like #ImgOpen or ${PB_ANY}.`
      })
    ));
    if (pendingImageAssignmentDraft.idRaw.trim().toLowerCase() === "#pb_any") {
      wrap.appendChild(row(
        "Assigned Var",
        textInput(pendingImageAssignmentDraft.assignedVar, value => updateImageAssignmentDraft({ assignedVar: value }), {
          title: `Variable name receiving the ${PB_ANY} image handle.`
        })
      ));
    }
  }
  if (pendingImageAssignmentDraft.mode === "create") {
    wrap.appendChild(row(
      "Image Raw",
      textInput(pendingImageAssignmentDraft.imageRaw, value => updateImageAssignmentDraft({ imageRaw: value }), {
        title: 'Raw second argument for LoadImage/CatchImage, for example "icons/open.png" or ?Label.'
      })
    ));
  }
  if (pendingImageAssignmentDraft.mode === "chooseFile" && pendingImageAssignmentDraft.target.kind === "gadget") {
    wrap.appendChild(row(
      "Resize",
      checkboxInput(
        pendingImageAssignmentDraft.resizeToImage,
        value => updateImageAssignmentDraft({ resizeToImage: value }),
        { title: "Resize the gadget to the selected image dimensions after creating the new LoadImage entry." }
      )
    ));
  }
  const actions = document.createElement("div");
  actions.className = "miniActions";
  const saveBtn = document.createElement("button");
  saveBtn.textContent = pendingImageAssignmentDraft.mode === "create" ? "Create" : (isGadgetChooseFile ? "Choose File" : "Continue");
  saveBtn.onclick = () => saveImageAssignmentDraft();
  actions.appendChild(saveBtn);
  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.onclick = () => closeImageAssignmentDraft();
  actions.appendChild(cancelBtn);
  wrap.appendChild(actions);
  return wrap;
}

function createPendingImageInsertDraftEl() {
  if (!pendingImageInsertDraft) return null;
  const wrap = document.createElement("div");
  wrap.appendChild(createSubSection("New Image"));
  wrap.appendChild(row(
    "Kind",
    selectInput(
      pendingImageInsertDraft.inline ? "CatchImage" : "LoadImage",
      [
        { value: "LoadImage", label: "LoadImage" },
        { value: "CatchImage", label: "CatchImage" }
      ],
      value => updateImageInsertDraft({ inline: value === "CatchImage" })
    )
  ));
  wrap.appendChild(row(
    "First Param",
    textInput(pendingImageInsertDraft.idRaw, value => updateImageInsertDraft({ idRaw: value }), {
      title: `Use either a fixed image id like #ImgOpen or ${PB_ANY}.`
    })
  ));
  if (pendingImageInsertDraft.idRaw.trim().toLowerCase() === "#pb_any") {
    wrap.appendChild(row(
      "Assigned Var",
      textInput(pendingImageInsertDraft.assignedVar, value => updateImageInsertDraft({ assignedVar: value }), {
        title: `Variable name receiving the ${PB_ANY} image handle.`
      })
    ));
  }
  wrap.appendChild(row(
    "Image Raw",
    textInput(pendingImageInsertDraft.imageRaw, value => updateImageInsertDraft({ imageRaw: value }), {
      title: 'Raw second argument for LoadImage/CatchImage, for example "icons/open.png" or ?Label.'
    })
  ));
  const actions = document.createElement("div");
  actions.className = "miniActions";
  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Add Image";
  saveBtn.onclick = () => saveImageInsertDraft();
  actions.appendChild(saveBtn);
  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.onclick = () => closeImageInsertDraft();
  actions.appendChild(cancelBtn);
  wrap.appendChild(actions);
  return wrap;
}

function createSubSection(title: string) {
  const h = document.createElement("div");
  h.className = "subHeader";
  h.textContent = title;
  return h;
}

function row(label: string, input: HTMLElement) {
  const wrap = document.createElement("div");
  wrap.className = "row";
  const l = document.createElement("div");
  l.textContent = label;
  wrap.appendChild(l);
  wrap.appendChild(input);
  return wrap;
}

function inputWithActions(input: HTMLElement, ...actions: HTMLElement[]) {
  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.alignItems = "center";
  wrap.style.gap = "6px";
  wrap.style.width = "100%";
  wrap.style.minWidth = "0";
  input.style.flex = "1 1 0";
  input.style.minWidth = "0";
  input.style.width = "auto";
  wrap.appendChild(input);
  for (const action of actions) {
    action.style.flex = "0 0 auto";
    if (!action.style.width) action.style.width = "auto";           // ← Set to "auto" if not already set
    if (!action.style.minWidth) action.style.minWidth = "fit-content"; // ← Set to "auto" if not already set
    wrap.appendChild(action);
  }
  return wrap;
}

function readonlyInput(value: string, title = "") {
  const i = document.createElement("input");
  i.value = value;
  i.readOnly = true;
  i.title = title;
  return i;
}


function mutedNote(message: string) {
  const d = document.createElement("div");
  d.className = "muted";
  d.textContent = message;
  return d;
}

function textInput(
  value: string,
  onChange: (v: string) => void,
  options?: { disabled?: boolean; title?: string; placeholder?: string }
) {
  const i = document.createElement("input");
  i.value = value;
  i.disabled = Boolean(options?.disabled);
  i.title = options?.title ?? "";
  i.placeholder = options?.placeholder ?? "";
  i.onchange = () => onChange(i.value);
  return i;
}

function editableComboInput(
  value: string,
  suggestions: string[],
  onChange: (v: string) => void,
  options?: { disabled?: boolean; title?: string; placeholder?: string }
) {
  const wrap = document.createElement("div");
  wrap.className = "comboInputWrap";

  const input = document.createElement("input");
  const listId = `pbfd-proc-list-${Math.random().toString(36).slice(2)}`;
  input.value = value;
  input.disabled = Boolean(options?.disabled);
  input.title = options?.title ?? "";
  input.placeholder = options?.placeholder ?? "";
  input.setAttribute("list", listId);
  input.onchange = () => onChange(input.value);

  const datalist = document.createElement("datalist");
  datalist.id = listId;
  for (const suggestion of suggestions) {
    const opt = document.createElement("option");
    opt.value = suggestion;
    datalist.appendChild(opt);
  }

  wrap.appendChild(input);
  wrap.appendChild(datalist);
  return wrap;
}

function selectInput(
  value: string,
  options: { value: string; label: string }[],
  onChange: (v: string) => void,
  config?: { disabled?: boolean; title?: string }
) {
  const select = document.createElement("select");
  select.disabled = Boolean(config?.disabled);
  select.title = config?.title ?? "";
  for (const option of options) {
    const opt = document.createElement("option");
    opt.value = option.value;
    opt.textContent = option.label;
    select.appendChild(opt);
  }
  select.value = value;
  select.onchange = () => onChange(select.value);
  return select;
}

function checkboxInput(
  value: boolean,
  onChange: (v: boolean) => void,
  options?: { disabled?: boolean; title?: string }
) {
  const i = document.createElement("input");
  i.type = "checkbox";
  i.checked = Boolean(value);
  i.disabled = Boolean(options?.disabled);
  i.title = options?.title ?? "";
  i.onchange = () => onChange(i.checked);
  return i;
}

function numberInput(value: number, onChange: (v: number) => void) {
  const i = document.createElement("input");
  i.type = "number";
  i.value = String(value);
  i.onchange = () => onChange(Number(i.value));
  return i;
}

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Resolves a CSS system color keyword (e.g. "ButtonFace", "Window") to an
 * "rgb(r, g, b)" string using the browser's own color resolution.
 * Results are cached in `systemColorCache`; call `clearSystemColorCache()`
 * when the skin changes so the next draw picks up fresh values.
 */
function getSystemColor(keyword: string): string {
  const cached = systemColorCache.get(keyword);
  if (cached !== undefined) return cached;

  const el = document.createElement("span");
  el.style.cssText = `color:${keyword};display:none`;
  document.body.appendChild(el);
  const resolved = getComputedStyle(el).color; // always "rgb(r, g, b)"
  document.body.removeChild(el);

  const value = resolved || keyword;
  systemColorCache.set(keyword, value);
  return value;
}

function parseCssRgb(color: string): [number, number, number] | null {
  const match = color.match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (match) {
    return [Number(match[1]), Number(match[2]), Number(match[3])];
  }

  const hexMatch = color.match(/^#([\da-f]{6})$/i);
  if (!hexMatch) return null;

  const value = hexMatch[1];
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function getRgbDistance(colorA: string, colorB: string): number | null {
  const rgbA = parseCssRgb(colorA);
  const rgbB = parseCssRgb(colorB);
  if (!rgbA || !rgbB) return null;

  const r = rgbA[0] - rgbB[0];
  const g = rgbA[1] - rgbB[1];
  const b = rgbA[2] - rgbB[2];
  return Math.sqrt((r * r) + (g * g) + (b * b));
}

function ensurePreviewLineContrast(candidate: string, background: string, fallback: string, minDistance = 28): string {
  const distance = getRgbDistance(candidate, background);
  if (distance === null || distance >= minDistance) return candidate;
  return fallback;
}

function clearSystemColorCache(): void {
  systemColorCache.clear();
}

type WindowsSkinSystemColors = {
  /** Control / button background (≈ rgb(240,240,240) on default Windows) */
  buttonFace: string;
  /** Text on controls */
  buttonText: string;
  /** Window client-area background (≈ white) */
  window: string;
  /** Text in window client area */
  windowText: string;
  /** Selection / accent background */
  highlight: string;
  /** Text on selected items */
  highlightText: string;
  /** Disabled control text */
  grayText: string;
  /** Border / 3-D shadow edge */
  threeDShadow: string;
  /** Medium control shadow, closer to classic separator lines */
  buttonShadow: string;
  /** Light 3-D edge, closer to pale separator lines */
  threeDLightShadow: string;
  // --- Registry colors (HKCU\Control Panel\Colors) ---
  /** Menu popup background */
  menu: string;
  /** Menu bar background */
  menuBar: string;
  /** Menu text */
  menuText: string;
  /** Selected menu item background */
  menuHilight: string;
  /** Active title bar (solid) */
  activeTitle: string;
  /** Active title bar gradient end */
  gradientActiveTitle: string;
  /** Inactive title bar */
  inactiveTitle: string;
  /** Title bar text */
  titleText: string;
  /** Hover / hot-track color */
  hotTrackingColor: string;
  /** Scrollbar track background */
  scrollbar: string;
};

/**
 * Returns the real Windows system colors for the canvas preview.
 * Combines CSS system colors (via getSystemColor) with registry colors
 * received from the extension (windowsRegistryColors).
 * Only meaningful when `osSkin` is "windows7" or "windows8".
 * Returns `null` for non-Windows skins so callers can fall back gracefully.
 */
function resolveWindowsSkinColors(): WindowsSkinSystemColors | null {
  const skin = settings.osSkin;
  if (skin !== "windows7" && skin !== "windows8") return null;

  const reg = windowsRegistryColors;

  return {
    // CSS system colors — always available on Windows Chromium
    buttonFace:    getSystemColor("ButtonFace"),
    buttonText:    getSystemColor("ButtonText"),
    window:        getSystemColor("Window"),
    windowText:    getSystemColor("WindowText"),
    highlight:     getSystemColor("Highlight"),
    highlightText: getSystemColor("HighlightText"),
    grayText:      getSystemColor("GrayText"),
    threeDShadow:      getSystemColor("ThreeDShadow"),
    buttonShadow:      getSystemColor("ButtonShadow"),
    threeDLightShadow: getSystemColor("ThreeDLightShadow"),
    // Registry colors — only available after the extension sent them
    menu:                reg?.menu                 ?? "rgb(240, 240, 240)",
    menuBar:             reg?.menuBar              ?? "rgb(240, 240, 240)",
    menuText:            reg?.menuText             ?? "rgb(0, 0, 0)",
    menuHilight:         reg?.menuHilight          ?? "rgb(0, 120, 215)",
    activeTitle:         reg?.activeTitle          ?? "rgb(0, 120, 215)",
    gradientActiveTitle: reg?.gradientActiveTitle  ?? "rgb(16, 135, 228)",
    inactiveTitle:       reg?.inactiveTitle        ?? "rgb(191, 205, 219)",
    titleText:           reg?.titleText            ?? "rgb(255, 255, 255)",
    hotTrackingColor:    reg?.hotTrackingColor     ?? "rgb(0, 102, 204)",
    scrollbar:           reg?.scrollbar            ?? "rgb(200, 200, 200)",
  };
}

function clampPos(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.max(1, Math.trunc(v));
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function setupPanelResize() {
  const resizer = document.getElementById("panelResizer") as HTMLElement | null;
  if (!resizer) return;
  let dragging = false;
  let activePointerId: number | null = null;
  const applyWidth = (clientX: number) => {
    const nextWidth = clamp(window.innerWidth - clientX - 3, 300, Math.max(300, Math.min(900, window.innerWidth - 220)));
    document.documentElement.style.setProperty("--pbfd-panel-width", `${Math.trunc(nextWidth)}px`);
  };
  const onMove = (ev: PointerEvent) => {
    if (!dragging) return;
    applyWidth(ev.clientX);
  };
  const stop = () => {
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove("dragging");
    document.body.style.cursor = "";
    if (activePointerId !== null) {
      resizer.releasePointerCapture?.(activePointerId);
      activePointerId = null;
    }
  };
  resizer.addEventListener("pointerdown", ev => {
    ev.preventDefault();
    dragging = true;
    activePointerId = ev.pointerId;
    resizer.classList.add("dragging");
    document.body.style.cursor = "col-resize";
    resizer.setPointerCapture?.(ev.pointerId);
    applyWidth(ev.clientX);
  });
  resizer.addEventListener("pointermove", onMove);
  resizer.addEventListener("pointerup", stop);
  resizer.addEventListener("pointercancel", stop);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", stop);
  window.addEventListener("pointercancel", stop);
}

function setupTopPanelResize(): void {
  if (!panelEl || !panelTopSectionEl || !panelSectionResizerEl || !panelBodyEl) return;

  let dragging = false;
  let activePointerId: number | null = null;

  const applyHeight = (clientY: number) => {
    const resizerHeight = panelSectionResizerEl.getBoundingClientRect().height || 6;
    const panelGap = Number.parseFloat(getComputedStyle(panelEl).gap || "0") || 0;
    const maxHeight = Math.max(100, panelEl.clientHeight - resizerHeight - panelGap * 2 - 100);
    const topStart = panelTopSectionEl.getBoundingClientRect().top;
    const nextHeight = clamp(clientY - topStart, 100, maxHeight);
    document.documentElement.style.setProperty("--pbfd-panel-top-height", `${Math.trunc(nextHeight)}px`);
  };

  const clampCurrentHeight = () => {
    const currentHeight = panelTopSectionEl.getBoundingClientRect().height;
    const resizerHeight = panelSectionResizerEl.getBoundingClientRect().height || 6;
    const panelGap = Number.parseFloat(getComputedStyle(panelEl).gap || "0") || 0;
    const maxHeight = Math.max(100, panelEl.clientHeight - resizerHeight - panelGap * 2 - 100);
    const nextHeight = clamp(currentHeight, 100, maxHeight);
    document.documentElement.style.setProperty("--pbfd-panel-top-height", `${Math.trunc(nextHeight)}px`);
  };

  const onMove = (ev: PointerEvent) => {
    if (!dragging) return;
    applyHeight(ev.clientY);
  };

  const stop = () => {
    if (!dragging) return;
    dragging = false;
    panelSectionResizerEl.classList.remove("dragging");
    document.body.style.cursor = "";
    if (activePointerId !== null) {
      panelSectionResizerEl.releasePointerCapture?.(activePointerId);
      activePointerId = null;
    }
  };

  panelSectionResizerEl.addEventListener("pointerdown", ev => {
    ev.preventDefault();
    dragging = true;
    activePointerId = ev.pointerId;
    panelSectionResizerEl.classList.add("dragging");
    document.body.style.cursor = "row-resize";
    panelSectionResizerEl.setPointerCapture?.(ev.pointerId);
    applyHeight(ev.clientY);
  });
  panelSectionResizerEl.addEventListener("pointermove", onMove);
  panelSectionResizerEl.addEventListener("pointerup", stop);
  panelSectionResizerEl.addEventListener("pointercancel", stop);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", stop);
  window.addEventListener("pointercancel", stop);
  window.addEventListener("resize", clampCurrentHeight);
  clampCurrentHeight();
}

function asInt(v: any): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

resizeCanvas();
setupPanelResize();
setupTopPanelResize();
toolboxTabButtonEl?.addEventListener("click", () => setActiveTopPanelTab("toolbox"));
objectsTabButtonEl?.addEventListener("click", () => setActiveTopPanelTab("objects"));
vscode.postMessage({ type: WEBVIEW_TO_EXT_MSG_TYPE.ready });