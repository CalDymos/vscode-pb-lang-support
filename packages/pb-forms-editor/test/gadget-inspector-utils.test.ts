import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGadgetCheckedStateRaw,
  buildGadgetHorizontalLockResizeUpdate,
  buildGadgetVerticalLockResizeUpdate,
  buildGadgetTextRaw,
  buildGadgetTooltipRaw,
  canEditGadgetCheckedState,
  canEditGadgetColors,
  canEditGadgetHorizontalLocks,
  canEditGadgetText,
  canInspectCustomGadgetCodeRows,
  canInspectGadgetColumns,
  canInspectGadgetBaseRows,
  canInspectGadgetImageRows,
  canInspectGadgetItems,
  canInspectGadgetSelectProc,
  canInspectGadgetSplitterPosition,
  canInspectGadgetTooltipRows,
  getGadgetCtorRangeFieldLabels,
  getCustomGadgetHelpDisplay,
  getGadgetBooleanInspectorState,
  getGadgetCaptionFieldConfig,
  isGadgetDisabledInDesignerPreview,
  isGadgetHiddenInDesignerPreview,
  getGadgetCurrentImageDisplay,
  getGadgetCheckedStateFieldConfig,
  getGadgetImageRowsFieldConfig,
  getGadgetConstantsFieldConfig,
  getGadgetFontFieldConfig,
  getGadgetKnownFlags,
  getGadgetParentFieldConfig,
  getGadgetParentInspectorValue,
  getGadgetResizeLockFieldConfig,
  getGadgetCtorRangeInspectorValue,
  isDpiScaledGadgetCtorRange,
  isDpiScaledGadgetState,
  getGadgetVariableInspectorValue,
  getGadgetFontDisplaySummary,
  getGadgetTextInspectorValue,
  getCustomGadgetSelectPresetFieldConfig,
  getGadgetSelectProcFieldConfig,
  getGadgetSplitterPositionFieldConfig,
  getGadgetTooltipFieldConfig,
  getGadgetTooltipInspectorValue,
  buildGadgetFlagsExpr,
  shouldShowGadgetParentDetail,
  shouldShowGadgetTabDetail
} from "../src/core/gadget/inspector";
import { GADGET_KIND, GADGET_KIND_SET } from "../src/core/model";

const ORIGINAL_FD_SELECT_GADGET_BASE_ROW_KINDS = [
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
  GADGET_KIND.WebViewGadget
].sort();

test("marks only persistent caption/callback constructor paths as caption-editable", () => {
  assert.equal(canEditGadgetText("StringGadget"), true);
  assert.equal(canEditGadgetText("ButtonGadget"), true);
  assert.equal(canEditGadgetText("OptionGadget"), true);
  assert.equal(canEditGadgetText("CustomGadget"), true);
  assert.equal(canEditGadgetText("ScintillaGadget"), true);
  assert.equal(canEditGadgetText("ButtonImageGadget"), false);
  assert.equal(canEditGadgetText("CalendarGadget"), false);
  assert.equal(canEditGadgetText("ComboBoxGadget"), false);
  assert.equal(canEditGadgetText("ImageGadget"), false);
  assert.equal(canEditGadgetText("ProgressBarGadget"), false);
});

test("marks original color-capable gadget kinds for front/back color editing", () => {
  assert.equal(canEditGadgetColors("TextGadget"), true);
  assert.equal(canEditGadgetColors("ScrollAreaGadget"), true);
  assert.equal(canEditGadgetColors("ProgressBarGadget"), true);
  assert.equal(canEditGadgetColors("ButtonGadget"), false);
  assert.equal(canEditGadgetColors("ImageGadget"), false);
});

test("keeps the gadget color inspector matrix aligned with FD_SelectGadget", () => {
  const expectedColorKinds = [
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
    GADGET_KIND.TreeGadget
  ].sort();

  const actualColorKinds = [...GADGET_KIND_SET]
    .filter(kind => canEditGadgetColors(kind))
    .sort();

  assert.deepEqual(actualColorKinds, expectedColorKinds);
});

test("keeps the original constructor-range inspector matrix exact", () => {
  const actualRangeLabels = [...GADGET_KIND_SET]
    .filter(kind => getGadgetCtorRangeFieldLabels(kind) !== undefined)
    .map(kind => [kind, getGadgetCtorRangeFieldLabels(kind)] as const);

  assert.deepEqual(actualRangeLabels, [
    [GADGET_KIND.SpinGadget, { minLabel: "Min", maxLabel: "Max", title: "Matches the original Min / Max constructor arguments." }],
    [GADGET_KIND.TrackBarGadget, { minLabel: "Min", maxLabel: "Max", title: "Matches the original Min / Max constructor arguments." }],
    [GADGET_KIND.ProgressBarGadget, { minLabel: "Min", maxLabel: "Max", title: "Matches the original Min / Max constructor arguments." }],
    [GADGET_KIND.ScrollAreaGadget, { minLabel: "InnerWidth", maxLabel: "InnerHeight", title: "Matches the original InnerWidth / InnerHeight constructor arguments." }],
    [GADGET_KIND.ScrollBarGadget, { minLabel: "Min", maxLabel: "Max", title: "Matches the original Min / Max constructor arguments." }]
  ]);
});



test("documents original image gadget rows without replacing the safer assignment draft", () => {
  assert.deepEqual(getGadgetImageRowsFieldConfig(GADGET_KIND.ImageGadget), {
    currentImageVisible: true,
    currentImageEditable: false,
    changeImageVisible: true,
    changeImageAvailable: true,
    currentImageTitle: "Original CurrentImage row. The displayed value is resolved from the assigned form image entry and is not persisted by direct text editing.",
    changeImageTitle: "Original ChangeImage button row. The port keeps the safer image-assignment draft flow for file selection, reuse and optional resize."
  });
  assert.deepEqual(getGadgetImageRowsFieldConfig(GADGET_KIND.ButtonImageGadget), getGadgetImageRowsFieldConfig(GADGET_KIND.ImageGadget));
  assert.equal(getGadgetImageRowsFieldConfig(GADGET_KIND.ButtonGadget), undefined);
  assert.equal(getGadgetImageRowsFieldConfig(undefined), undefined);
});

test("keeps the original gadget image row matrix exact", () => {
  const actualImageRowsKinds = [...GADGET_KIND_SET]
    .filter(kind => canInspectGadgetImageRows(kind))
    .sort();

  assert.deepEqual(actualImageRowsKinds, [
    GADGET_KIND.ButtonImageGadget,
    GADGET_KIND.ImageGadget
  ].sort());
});

test("keeps the original checked-state special row matrix exact", () => {
  const actualCheckedKinds = [...GADGET_KIND_SET]
    .filter(kind => canEditGadgetCheckedState(kind))
    .sort();

  assert.deepEqual(actualCheckedKinds, [
    GADGET_KIND.CheckBoxGadget,
    GADGET_KIND.OptionGadget
  ].sort());
});

test("documents the original checked-state inspector row without broadening its scope", () => {
  assert.deepEqual(getGadgetCheckedStateFieldConfig(GADGET_KIND.CheckBoxGadget), {
    visible: true,
    valueEditable: true,
    label: "Checked",
    title: "Original Checked row for CheckBoxGadget and OptionGadget. Editing writes the SetGadgetState(...) checked value."
  });
  assert.deepEqual(getGadgetCheckedStateFieldConfig(GADGET_KIND.OptionGadget), getGadgetCheckedStateFieldConfig(GADGET_KIND.CheckBoxGadget));
  assert.equal(getGadgetCheckedStateFieldConfig(GADGET_KIND.ButtonGadget), undefined);
  assert.equal(getGadgetCheckedStateFieldConfig(undefined), undefined);
});

test("keeps the original splitter-position special row limited to SplitterGadget", () => {
  const actualSplitterKinds = [...GADGET_KIND_SET]
    .filter(kind => canInspectGadgetSplitterPosition(kind));

  assert.deepEqual(actualSplitterKinds, [GADGET_KIND.SplitterGadget]);
});

test("documents the original splitter-position row while preserving bounded port editing", () => {
  assert.deepEqual(getGadgetSplitterPositionFieldConfig(GADGET_KIND.SplitterGadget), {
    visible: true,
    valueEditable: true,
    label: "SplitterPosition",
    title: "Original SplitterPosition row for SplitterGadget. Editing keeps the current port safety check that bounds the position to the active splitter orientation size.",
    valuePolicy: "bounded-by-current-orientation-size"
  });
  assert.equal(getGadgetSplitterPositionFieldConfig(GADGET_KIND.ButtonGadget), undefined);
  assert.equal(getGadgetSplitterPositionFieldConfig(undefined), undefined);
});

test("keeps original custom-gadget code rows limited to CustomGadget", () => {
  const actualCustomCodeKinds = [...GADGET_KIND_SET]
    .filter(kind => canInspectCustomGadgetCodeRows(kind));

  assert.deepEqual(actualCustomCodeKinds, [GADGET_KIND.CustomGadget]);
});

test("keeps gadget SelectProc visible for original FD_SelectGadget-visible gadget kinds", () => {
  assert.equal(canInspectGadgetSelectProc(GADGET_KIND.ButtonGadget), true);
  assert.equal(canInspectGadgetSelectProc(GADGET_KIND.CustomGadget), true);
  assert.equal(canInspectGadgetSelectProc(GADGET_KIND.MDIGadget), false);
  assert.equal(canInspectGadgetSelectProc(GADGET_KIND.Unknown), false);
  assert.equal(canInspectGadgetSelectProc(undefined), false);
});

test("keeps gadget SelectProc field editable and preserves the original grid string semantics", () => {
  const buttonConfig = getGadgetSelectProcFieldConfig(GADGET_KIND.ButtonGadget);
  const customConfig = getGadgetSelectProcFieldConfig(GADGET_KIND.CustomGadget);

  assert.equal(buttonConfig?.valueEditable, true);
  assert.equal(buttonConfig?.preservesGridString, true);
  assert.equal(customConfig?.valueEditable, true);
  assert.equal(customConfig?.preservesGridString, true);
  assert.equal(getGadgetSelectProcFieldConfig(GADGET_KIND.MDIGadget), undefined);
  assert.equal(getGadgetSelectProcFieldConfig(GADGET_KIND.Unknown), undefined);
});

test("documents CustomGadget SelectGadget as visible but not persisted by the original event grid path", () => {
  assert.deepEqual(getCustomGadgetSelectPresetFieldConfig(GADGET_KIND.CustomGadget), {
    valueEditable: true,
    persisted: false,
    title: "Shows the original CustomGadget preset combobox row. In the available PureBasic source, changing this row does not rewrite InitCode or CreateCode automatically."
  });
  assert.equal(getCustomGadgetSelectPresetFieldConfig(GADGET_KIND.ButtonGadget), undefined);
  assert.equal(getCustomGadgetSelectPresetFieldConfig(undefined), undefined);
});

test("keeps gadget tooltip rows visible for the original FD_SelectGadget gadget matrix", () => {
  const expectedTooltipKinds = [
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
    GADGET_KIND.WebViewGadget
  ].sort();

  const actualTooltipKinds = [...GADGET_KIND_SET]
    .filter(kind => canInspectGadgetTooltipRows(kind))
    .sort();

  assert.deepEqual(actualTooltipKinds, expectedTooltipKinds);
  assert.equal(canInspectGadgetTooltipRows(GADGET_KIND.MDIGadget), false);
  assert.equal(canInspectGadgetTooltipRows(GADGET_KIND.Unknown), false);
  assert.equal(canInspectGadgetTooltipRows(undefined), false);
});

test("keeps gadget tooltip fields editable for all original tooltip rows", () => {
  const actualEditableTooltipKinds = [...GADGET_KIND_SET]
    .filter(kind => getGadgetTooltipFieldConfig(kind)?.valueEditable === true)
    .sort();
  const actualVariableTooltipKinds = [...GADGET_KIND_SET]
    .filter(kind => getGadgetTooltipFieldConfig(kind)?.variableToggleEditable === true)
    .sort();

  assert.deepEqual(actualEditableTooltipKinds, actualVariableTooltipKinds);
  assert.equal(getGadgetTooltipFieldConfig(GADGET_KIND.ButtonGadget)?.valueEditable, true);
  assert.equal(getGadgetTooltipFieldConfig(GADGET_KIND.CustomGadget)?.variableToggleEditable, true);
  assert.equal(getGadgetTooltipFieldConfig(GADGET_KIND.Unknown), undefined);
});


test("keeps original FD_SelectGadget base rows visible for all regular gadget kinds", () => {
  const actualBaseRowKinds = [...GADGET_KIND_SET]
    .filter(kind => canInspectGadgetBaseRows(kind))
    .sort();

  assert.deepEqual(actualBaseRowKinds, ORIGINAL_FD_SELECT_GADGET_BASE_ROW_KINDS);
  assert.equal(canInspectGadgetBaseRows(GADGET_KIND.MDIGadget), false);
  assert.equal(canInspectGadgetBaseRows(GADGET_KIND.Unknown), false);
  assert.equal(canInspectGadgetBaseRows(undefined), false);
});

test("documents original parent row visibility without replacing the reparent dialog policy", () => {
  assert.deepEqual(getGadgetParentFieldConfig(GADGET_KIND.ButtonGadget, false), {
    visible: true,
    valueEditable: false,
    selectTargetAvailable: false,
    changeDialogAvailable: true,
    title: "Original FD_SelectGadget parent row. The value is selected through the reparent dialog, not edited as free text."
  });
  assert.equal(getGadgetParentFieldConfig(GADGET_KIND.ButtonGadget, true)?.selectTargetAvailable, true);
  assert.equal(getGadgetParentFieldConfig(GADGET_KIND.MDIGadget, false), undefined);
});

test("documents original lock rows while preserving safe ResizeGadget patch policy", () => {
  const actualLockKinds = [...GADGET_KIND_SET]
    .filter(kind => getGadgetResizeLockFieldConfig(kind)?.visible === true)
    .sort();

  assert.deepEqual(actualLockKinds, ORIGINAL_FD_SELECT_GADGET_BASE_ROW_KINDS);
  assert.equal(getGadgetResizeLockFieldConfig(GADGET_KIND.ButtonGadget)?.valueEditablePolicy, "safe-resize-patch-only");
  assert.equal(getGadgetResizeLockFieldConfig(GADGET_KIND.Unknown), undefined);
});

test("keeps original font row visible and records current raw-font editing policy", () => {
  const actualFontKinds = [...GADGET_KIND_SET]
    .filter(kind => getGadgetFontFieldConfig(kind)?.visible === true)
    .sort();

  assert.deepEqual(actualFontKinds, ORIGINAL_FD_SELECT_GADGET_BASE_ROW_KINDS);
  assert.equal(getGadgetFontFieldConfig(GADGET_KIND.StringGadget)?.rawEditable, true);
  assert.equal(getGadgetFontFieldConfig(GADGET_KIND.Unknown), undefined);
});

test("keeps original constants node visible while known flags stay in declare.pb order", () => {
  const actualConstantsKinds = [...GADGET_KIND_SET]
    .filter(kind => getGadgetConstantsFieldConfig(kind)?.visible === true)
    .sort();

  assert.deepEqual(actualConstantsKinds, ORIGINAL_FD_SELECT_GADGET_BASE_ROW_KINDS);
  assert.deepEqual(getGadgetConstantsFieldConfig(GADGET_KIND.ImageGadget)?.knownFlags, ["#PB_Image_Border", "#PB_Image_Raised"]);
  assert.deepEqual(getGadgetConstantsFieldConfig(GADGET_KIND.OptionGadget)?.knownFlags, []);
  assert.equal(getGadgetConstantsFieldConfig(GADGET_KIND.Unknown), undefined);
});


test("documents complete FD_SelectGadget row coverage after the FD-011 audit", () => {
  const baseKind = GADGET_KIND.ButtonGadget;

  assert.deepEqual([
    "#PB_Any",
    "Variable",
    "X",
    "Y",
    "Width",
    "Height",
    "Hidden",
    "Disabled"
  ], [
    "#PB_Any",
    "Variable",
    "X",
    "Y",
    "Width",
    "Height",
    "Hidden",
    "Disabled"
  ]);

  assert.deepEqual(getGadgetCaptionFieldConfig(baseKind), {
    label: "Caption",
    textEditable: true,
    variableToggleEditable: true
  });
  assert.deepEqual(getGadgetTooltipFieldConfig(baseKind), {
    valueEditable: true,
    variableToggleEditable: true
  });
  assert.equal(getGadgetParentFieldConfig(baseKind, false)?.visible, true);
  assert.equal(getGadgetResizeLockFieldConfig(baseKind)?.visible, true);
  assert.equal(getGadgetFontFieldConfig(baseKind)?.visible, true);
  assert.equal(getGadgetSelectProcFieldConfig(baseKind)?.valueEditable, true);
  assert.equal(getGadgetConstantsFieldConfig(baseKind)?.visible, true);

  assert.equal(getGadgetCtorRangeFieldLabels(GADGET_KIND.ProgressBarGadget)?.minLabel, "Min");
  assert.equal(canInspectGadgetImageRows(GADGET_KIND.ImageGadget), true);
  assert.equal(canEditGadgetCheckedState(GADGET_KIND.CheckBoxGadget), true);
  assert.equal(canInspectGadgetSplitterPosition(GADGET_KIND.SplitterGadget), true);
  assert.equal(getGadgetSplitterPositionFieldConfig(GADGET_KIND.SplitterGadget)?.label, "SplitterPosition");
  assert.equal(canInspectCustomGadgetCodeRows(GADGET_KIND.CustomGadget), true);
});
test("marks only original item-editor gadget kinds for inspector item sections", () => {
  assert.equal(canInspectGadgetItems("PanelGadget"), true);
  assert.equal(canInspectGadgetItems("ListIconGadget"), true);
  assert.equal(canInspectGadgetItems("ComboBoxGadget"), true);
  assert.equal(canInspectGadgetItems("ButtonGadget"), false);
  assert.equal(canInspectGadgetItems("ProgressBarGadget"), false);
});

test("marks only original listicon gadgets for inspector column sections", () => {
  assert.equal(canInspectGadgetColumns("ListIconGadget"), true);
  assert.equal(canInspectGadgetColumns("PanelGadget"), false);
  assert.equal(canInspectGadgetColumns("TreeGadget"), false);
});

test("returns original gadget constant lists from declare.pb order", () => {
  assert.deepEqual(getGadgetKnownFlags("ImageGadget"), ["#PB_Image_Border", "#PB_Image_Raised"]);
  assert.deepEqual(getGadgetKnownFlags("SplitterGadget"), ["#PB_Splitter_Vertical", "#PB_Splitter_Separator", "#PB_Splitter_FirstFixed", "#PB_Splitter_SecondFixed"]);
  assert.deepEqual(getGadgetKnownFlags("OptionGadget"), []);
});

test("rebuilds gadget flag expressions in original constant order while preserving custom tails", () => {
  assert.equal(
    buildGadgetFlagsExpr("StringGadget", ["#PB_String_ReadOnly", "#PB_String_Numeric"], "#PB_String_UpperCase | MyCustomFlag"),
    "#PB_String_Numeric | #PB_String_ReadOnly | MyCustomFlag"
  );
  assert.equal(
    buildGadgetFlagsExpr("ImageGadget", ["#PB_Image_Raised"], undefined),
    "#PB_Image_Raised"
  );
  assert.equal(buildGadgetFlagsExpr("OptionGadget", [], undefined), undefined);
});

test("marks original checkbox/option gadget kinds as checked-state editable", () => {
  assert.equal(canEditGadgetCheckedState("CheckBoxGadget"), true);
  assert.equal(canEditGadgetCheckedState("OptionGadget"), true);
  assert.equal(canEditGadgetCheckedState("SplitterGadget"), false);
});

test("builds original saved checked-state raw values for checkbox and option gadgets", () => {
  assert.equal(buildGadgetCheckedStateRaw("CheckBoxGadget", true), "#PB_Checkbox_Checked");
  assert.equal(buildGadgetCheckedStateRaw("OptionGadget", true), "1");
  assert.equal(buildGadgetCheckedStateRaw("CheckBoxGadget", false), undefined);
  assert.equal(buildGadgetCheckedStateRaw("ImageGadget", true), undefined);
});

test("builds gadget caption raw values for literal and variable modes without trimming variable input", () => {
  assert.equal(buildGadgetTextRaw("Hello", false), '"Hello"');
  assert.equal(buildGadgetTextRaw("VarCaption$", true), "VarCaption$");
  assert.equal(buildGadgetTextRaw("", false), '""');
  assert.equal(buildGadgetTextRaw("  VarCaption$  ", true), "  VarCaption$  ");
});

test("builds gadget tooltip raw values for literal, variable and cleared modes without trimming variable input", () => {
  assert.equal(buildGadgetTooltipRaw("Tooltip text", false), '"Tooltip text"');
  assert.equal(buildGadgetTooltipRaw("Tooltip$", true), "Tooltip$");
  assert.equal(buildGadgetTooltipRaw("", false), undefined);
  assert.equal(buildGadgetTooltipRaw("  Tooltip$  ", true), "  Tooltip$  ");
});

test("prefers parsed gadget hidden/disabled booleans and treats raw 0 as unchecked", () => {
  assert.equal(getGadgetBooleanInspectorState(undefined, true), true);
  assert.equal(getGadgetBooleanInspectorState("0", undefined), false);
  assert.equal(getGadgetBooleanInspectorState("HideExpr()", undefined), true);
  assert.equal(getGadgetBooleanInspectorState("DisableExpr()", undefined), true);
  assert.equal(getGadgetBooleanInspectorState(undefined, false), false);
});

test("uses only parsed boolean gadget hidden state for the designer preview visibility path", () => {
  assert.equal(isGadgetHiddenInDesignerPreview(true), true);
  assert.equal(isGadgetHiddenInDesignerPreview(false), false);
  assert.equal(isGadgetHiddenInDesignerPreview(undefined), false);
});

test("uses only parsed boolean gadget disabled state for the designer preview overlay path", () => {
  assert.equal(isGadgetDisabledInDesignerPreview(true), true);
  assert.equal(isGadgetDisabledInDesignerPreview(false), false);
  assert.equal(isGadgetDisabledInDesignerPreview(undefined), false);
});

test("keeps the original caption row visibility matrix aligned with FD_SelectGadget", () => {
  const expectedCaptionVisibleKinds = [
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
    GADGET_KIND.WebViewGadget
  ].sort();

  const actualCaptionVisibleKinds = [...GADGET_KIND_SET]
    .filter(kind => getGadgetCaptionFieldConfig(kind) !== undefined)
    .sort();

  assert.deepEqual(actualCaptionVisibleKinds, expectedCaptionVisibleKinds);
});

test("keeps caption editability limited to persistent constructor or custom-gadget creation paths", () => {
  const actualTextEditableKinds = [...GADGET_KIND_SET]
    .filter(kind => getGadgetCaptionFieldConfig(kind)?.textEditable === true)
    .sort();

  assert.deepEqual(actualTextEditableKinds, [
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
    GADGET_KIND.WebGadget
  ].sort());
});

test("keeps caption variable toggles limited to original captionvariable emitter paths", () => {
  const actualVariableEditableKinds = [...GADGET_KIND_SET]
    .filter(kind => getGadgetCaptionFieldConfig(kind)?.variableToggleEditable === true)
    .sort();

  assert.deepEqual(actualVariableEditableKinds, [
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
    GADGET_KIND.WebGadget
  ].sort());
});

test("returns the original caption field behavior for Date, Scintilla, Editor and Canvas gadgets", () => {
  assert.deepEqual(getGadgetCaptionFieldConfig("DateGadget"), {
    label: "Mask",
    textEditable: true,
    variableToggleEditable: true
  });
  assert.deepEqual(getGadgetCaptionFieldConfig("ScintillaGadget"), {
    label: "Callback",
    textEditable: true,
    variableToggleEditable: false
  });
  assert.deepEqual(getGadgetCaptionFieldConfig("EditorGadget"), {
    label: "Caption",
    textEditable: false,
    variableToggleEditable: false
  });
  assert.deepEqual(getGadgetCaptionFieldConfig("CanvasGadget"), {
    label: "Caption",
    textEditable: false,
    variableToggleEditable: false
  });
  assert.deepEqual(getGadgetCaptionFieldConfig("ImageGadget"), {
    label: "Caption",
    textEditable: false,
    variableToggleEditable: false
  });
  assert.equal(getGadgetCaptionFieldConfig("Unknown"), undefined);
});


test("returns the original range/scrollarea field labels for constructor-bound gadget fields", () => {
  assert.deepEqual(getGadgetCtorRangeFieldLabels("ProgressBarGadget"), {
    minLabel: "Min",
    maxLabel: "Max",
    title: "Matches the original Min / Max constructor arguments."
  });
  assert.deepEqual(getGadgetCtorRangeFieldLabels("ScrollAreaGadget"), {
    minLabel: "InnerWidth",
    maxLabel: "InnerHeight",
    title: "Matches the original InnerWidth / InnerHeight constructor arguments."
  });
  assert.equal(getGadgetCtorRangeFieldLabels("ButtonGadget"), undefined);
});



test("covers the full original constructor-range gadget matrix after the FD-042c audit", () => {
  assert.deepEqual(getGadgetCtorRangeFieldLabels("SpinGadget"), {
    minLabel: "Min",
    maxLabel: "Max",
    title: "Matches the original Min / Max constructor arguments."
  });
  assert.deepEqual(getGadgetCtorRangeFieldLabels("TrackBarGadget"), {
    minLabel: "Min",
    maxLabel: "Max",
    title: "Matches the original Min / Max constructor arguments."
  });
  assert.deepEqual(getGadgetCtorRangeFieldLabels("ScrollBarGadget"), {
    minLabel: "Min",
    maxLabel: "Max",
    title: "Matches the original Min / Max constructor arguments."
  });
  assert.deepEqual(getGadgetCtorRangeFieldLabels("ProgressBarGadget"), {
    minLabel: "Min",
    maxLabel: "Max",
    title: "Matches the original Min / Max constructor arguments."
  });
  assert.deepEqual(getGadgetCtorRangeFieldLabels("ScrollAreaGadget"), {
    minLabel: "InnerWidth",
    maxLabel: "InnerHeight",
    title: "Matches the original InnerWidth / InnerHeight constructor arguments."
  });
});

test("keeps the checked-state matrix limited to the original checkbox and option gadgets", () => {
  assert.equal(canEditGadgetCheckedState("CheckBoxGadget"), true);
  assert.equal(canEditGadgetCheckedState("OptionGadget"), true);
  assert.equal(canEditGadgetCheckedState("CustomGadget"), false);
  assert.equal(canEditGadgetCheckedState("ButtonGadget"), false);
});

test("resolves constructor-bound gadget field inspector values from raw or parsed numbers", () => {
  assert.equal(getGadgetCtorRangeInspectorValue("MinValue", 5), "MinValue");
  assert.equal(getGadgetCtorRangeInspectorValue(undefined, 95), "95");
  assert.equal(getGadgetCtorRangeInspectorValue(undefined, undefined), "");
});
test("limits DPI-scaled constructor-range handling to ScrollArea inner dimensions", () => {
  assert.equal(isDpiScaledGadgetCtorRange("ScrollAreaGadget"), true);
  assert.equal(isDpiScaledGadgetCtorRange("ScrollBarGadget"), false);
  assert.equal(isDpiScaledGadgetCtorRange("ProgressBarGadget"), false);
  assert.equal(isDpiScaledGadgetCtorRange(undefined), false);
});

test("limits DPI-scaled gadget state handling to Splitter position values", () => {
  assert.equal(isDpiScaledGadgetState("SplitterGadget"), true);
  assert.equal(isDpiScaledGadgetState("ScrollAreaGadget"), false);
  assert.equal(isDpiScaledGadgetState("CheckBoxGadget"), false);
  assert.equal(isDpiScaledGadgetState(undefined), false);
});


test("prefers the parsed form image path for gadget CurrentImage display", () => {
  assert.equal(getGadgetCurrentImageDisplay({ imageRaw: "ImageID(#ImgOpen)" }, { image: "images/open.png" }), "images/open.png");
  assert.equal(getGadgetCurrentImageDisplay({ imageRaw: "ImageID(#ImgInline)" }, { imageRaw: "?toolbar_open" }), "?toolbar_open");
  assert.equal(getGadgetCurrentImageDisplay({ imageRaw: "0" }), "0");
});

test("uses the assigned gadget variable or enum symbol tail for the inspector Variable field", () => {
  assert.equal(getGadgetVariableInspectorValue({ variable: "Button_0", firstParam: "#PB_Any" }), "Button_0");
  assert.equal(getGadgetVariableInspectorValue({ firstParam: "#Button_1" }), "Button_1");
});

test("uses the parent gadget variable for the original Parent row display", () => {
  assert.equal(getGadgetParentInspectorValue({ variable: "Container_0", firstParam: "#PB_Any" }), "Container_0");
  assert.equal(getGadgetParentInspectorValue({ firstParam: "#Panel_0" }), "Panel_0");
  assert.equal(getGadgetParentInspectorValue(undefined), "");
});
test("resolves inspector display values from raw gadget caption and tooltip expressions", () => {
  assert.equal(getGadgetTextInspectorValue({ textRaw: '"Caption"', text: "Caption" }), "Caption");
  assert.equal(getGadgetTextInspectorValue({ textRaw: '~"Escaped ""Caption"""', text: 'Escaped "Caption"' }), 'Escaped "Caption"');
  assert.equal(getGadgetTextInspectorValue({ textRaw: "Caption$", text: "Caption$", textVariable: true }), "Caption$");
  assert.equal(getGadgetTooltipInspectorValue({ tooltipRaw: '"Hint"', tooltip: "Hint" }), "Hint");
  assert.equal(getGadgetTooltipInspectorValue({ tooltipRaw: '~"Escaped ""Hint"""', tooltip: 'Escaped "Hint"' }), 'Escaped "Hint"');
  assert.equal(getGadgetTooltipInspectorValue({ tooltipRaw: "ToolTip$", tooltip: "ToolTip$", tooltipVariable: true }), "ToolTip$");
});

test("formats parsed gadget font metadata into a compact display summary", () => {
  assert.equal(
    getGadgetFontDisplaySummary({
      gadgetFontRaw: "FontID(#FontBody)",
      gadgetFont: "Segoe UI",
      gadgetFontSize: 9,
      gadgetFontFlagsRaw: "#PB_Font_Bold"
    }),
    "Segoe UI 9 B (#PB_Font_Bold)"
  );
  assert.equal(
    getGadgetFontDisplaySummary({
      gadgetFontRaw: "FontID(#FontBody)",
      gadgetFont: "Segoe UI",
      gadgetFontSize: 9,
      gadgetFontFlagsRaw: "#PB_Font_Bold | #PB_Font_Italic | #PB_Font_Underline | #PB_Font_StrikeOut"
    }),
    "Segoe UI 9 BIUS (#PB_Font_Bold | #PB_Font_Italic | #PB_Font_Underline | #PB_Font_StrikeOut)"
  );
  assert.equal(
    getGadgetFontDisplaySummary({
      gadgetFontRaw: "FontID(#FontBody)",
      gadgetFont: "Segoe UI",
      gadgetFontSize: 9,
      gadgetFontFlagsRaw: "CustomFontFlag"
    }),
    "Segoe UI 9 (CustomFontFlag)"
  );
  assert.equal(
    getGadgetFontDisplaySummary({
      gadgetFont: "Segoe UI",
      gadgetFontSize: 9,
      gadgetFontFlagsRaw: "#PB_Font_Italic"
    }),
    "Segoe UI 9 I (#PB_Font_Italic)"
  );
  assert.equal(getGadgetFontDisplaySummary({ gadgetFontRaw: "FontID(#FontBody)" }), "FontID(#FontBody)");
  assert.equal(getGadgetFontDisplaySummary({}), "");
});


test("returns the original custom-gadget help placeholder line", () => {
  assert.equal(getCustomGadgetHelpDisplay(), "%id% %x% %y% %w% %h% %txt% %hwnd% %wndid% ");
});


test("enables horizontal lock editing whenever the current layout can be converted into original ResizeGadget formulas", () => {
  assert.equal(canEditGadgetHorizontalLocks({
    x: 10,
    y: 20,
    w: 80,
    h: 24,
    xRaw: "10",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24",
    lockLeft: true,
    lockRight: true,
    lockTop: true,
    lockBottom: false
  }, { w: 320 }), true);

  assert.equal(canEditGadgetHorizontalLocks({
    parentId: "#Container",
    x: 10,
    y: 20,
    w: 80,
    h: 24,
    xRaw: "10",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24",
    lockLeft: true,
    lockRight: true,
    lockTop: true,
    lockBottom: false
  }, { w: 320 }), false);

  assert.equal(canEditGadgetHorizontalLocks({
    parentId: "Container_0",
    x: 10,
    y: 20,
    w: 80,
    h: 24,
    xRaw: "10",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24",
    lockLeft: true,
    lockRight: true,
    lockTop: true,
    lockBottom: false
  }, {
    w: 320,
    parent: {
      id: "Container_0",
      kind: "ContainerGadget",
      firstParam: "#Container_0",
      w: 220,
      wRaw: "220",
      h: 160,
      hRaw: "160"
    }
  }), true);

  assert.equal(canEditGadgetHorizontalLocks({
    parentId: "Panel_0",
    x: 10,
    y: 20,
    w: 80,
    h: 24,
    xRaw: "10",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24",
    lockLeft: true,
    lockRight: true,
    lockTop: true,
    lockBottom: false
  }, {
    w: 320,
    parent: {
      id: "Panel_0",
      kind: "PanelGadget",
      firstParam: "#Panel_0",
      w: 220,
      wRaw: "220",
      h: 160,
      hRaw: "160"
    }
  }), true);
});

test("preserves existing constructor right-anchor formulas when a gadget has no ResizeGadget line yet", () => {
  const update = buildGadgetVerticalLockResizeUpdate({
    x: 10,
    y: 20,
    w: 80,
    h: 24,
    xRaw: "FormWindowWidth - 310",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24",
    lockLeft: false,
    lockRight: true,
    lockTop: true,
    lockBottom: false
  }, { w: 320, h: 220, platformSkin: "windows" }, true, true);

  assert.deepEqual(update, {
    xRaw: "FormWindowWidth - 310",
    yRaw: "20",
    wRaw: "80",
    hRaw: "FormWindowHeight - 196"
  });
});

test("preserves existing constructor stretch-width formulas when a gadget has no ResizeGadget line yet", () => {
  const update = buildGadgetVerticalLockResizeUpdate({
    x: 10,
    y: 20,
    w: 280,
    h: 24,
    xRaw: "10",
    yRaw: "20",
    wRaw: "FormWindowWidth - 40",
    hRaw: "24",
    lockLeft: true,
    lockRight: true,
    lockTop: true,
    lockBottom: false
  }, { w: 320, h: 220, platformSkin: "windows" }, true, true);

  assert.deepEqual(update, {
    xRaw: "10",
    yRaw: "20",
    wRaw: "FormWindowWidth - 40",
    hRaw: "FormWindowHeight - 196"
  });
});

test("builds a horizontal resize update that matches the original right-anchor formulas", () => {
  const update = buildGadgetHorizontalLockResizeUpdate({
    x: 10,
    y: 20,
    w: 80,
    h: 24,
    xRaw: "10",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24",
    resizeSource: { line: 12 },
    lockLeft: true,
    lockRight: false,
    lockTop: true,
    lockBottom: false
  }, { w: 320 }, false, true);

  assert.deepEqual(update, {
    xRaw: "FormWindowWidth - 310",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24"
  });
});

test("builds parent-relative horizontal resize updates from original GadgetWidth parent formulas", () => {
  const update = buildGadgetHorizontalLockResizeUpdate({
    parentId: "Container_0",
    x: 10,
    y: 20,
    w: 80,
    h: 24,
    xRaw: "10",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24",
    resizeSource: { line: 12 },
    lockLeft: true,
    lockRight: false,
    lockTop: true,
    lockBottom: false
  }, {
    w: 320,
    parent: {
      id: "Container_0",
      kind: "ContainerGadget",
      firstParam: "#Container_0",
      w: 220,
      wRaw: "220",
      h: 160,
      hRaw: "160"
    }
  }, false, true);

  assert.deepEqual(update, {
    xRaw: "GadgetWidth(#Container_0) - 210",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24"
  });
});


test("builds panel-parent horizontal resize updates from original panel item width formulas", () => {
  const update = buildGadgetHorizontalLockResizeUpdate({
    parentId: "Panel_0",
    x: 10,
    y: 20,
    w: 80,
    h: 24,
    xRaw: "10",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24",
    resizeSource: { line: 12 },
    lockLeft: true,
    lockRight: false,
    lockTop: true,
    lockBottom: false
  }, {
    w: 320,
    parent: {
      id: "Panel_0",
      kind: "PanelGadget",
      firstParam: "#Panel_0",
      w: 220,
      wRaw: "220",
      h: 160,
      hRaw: "160"
    }
  }, false, true);

  assert.deepEqual(update, {
    xRaw: "GetGadgetAttribute(#Panel_0,#PB_Panel_ItemWidth) - 210",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24"
  });
});


test("keeps horizontal right-anchor formulas unscaled when layout values are displayed with DPI scaling", () => {
  const update = buildGadgetHorizontalLockResizeUpdate({
    x: 13,
    y: 27,
    w: 106,
    h: 32,
    xRaw: "10",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24",
    resizeSource: { line: 12 },
    lockLeft: true,
    lockRight: false,
    lockTop: true,
    lockBottom: false
  }, { w: 426, layoutDpiScale: 1.33 }, false, true);

  assert.deepEqual(update, {
    xRaw: "FormWindowWidth - 310",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24"
  });
});

test("returns a delete instruction when horizontal locks no longer require ResizeGadget emission", () => {
  const update = buildGadgetHorizontalLockResizeUpdate({
    x: 10,
    y: 20,
    w: 80,
    h: 24,
    xRaw: "10",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24",
    resizeSource: { line: 12 },
    lockLeft: false,
    lockRight: true,
    lockTop: true,
    lockBottom: false,
    resizeXRaw: "FormWindowWidth - 310",
    resizeYRaw: "20",
    resizeWRaw: "80",
    resizeHRaw: "24"
  }, { w: 320 }, true, false);

  assert.deepEqual(update, { deleteResize: true });
});


test("builds a vertical resize update that safely drops stretch-height back to the base gadget height", () => {
  const update = buildGadgetVerticalLockResizeUpdate({
    x: 10,
    y: 20,
    w: 80,
    h: 24,
    xRaw: "10",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24",
    resizeSource: { line: 12 },
    lockLeft: true,
    lockRight: false,
    lockTop: true,
    lockBottom: true,
    resizeXRaw: "10",
    resizeYRaw: "20",
    resizeWRaw: "80",
    resizeHRaw: "FormWindowHeight - 120"
  }, { w: 320, h: 220 }, true, false);

  assert.deepEqual(update, { deleteResize: true });
});

test("preserves current horizontal resize formulas when a verified vertical lock transition is patched", () => {
  const update = buildGadgetVerticalLockResizeUpdate({
    x: 10,
    y: 20,
    w: 80,
    h: 24,
    xRaw: "10",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24",
    resizeSource: { line: 12 },
    lockLeft: false,
    lockRight: true,
    lockTop: true,
    lockBottom: true,
    resizeXRaw: "FormWindowWidth - 310",
    resizeYRaw: "20",
    resizeWRaw: "80",
    resizeHRaw: "FormWindowHeight - 120"
  }, { w: 320, h: 220 }, true, false);

  assert.deepEqual(update, {
    xRaw: "FormWindowWidth - 310",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24"
  });
});



test("blocks turning off both vertical locks while horizontal ResizeGadget emission must stay persisted", () => {
  const update = buildGadgetVerticalLockResizeUpdate({
    x: 10,
    y: 20,
    w: 80,
    h: 24,
    xRaw: "10",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24",
    resizeSource: { line: 12 },
    lockLeft: false,
    lockRight: true,
    lockTop: true,
    lockBottom: false,
    resizeXRaw: "FormWindowWidth - 310",
    resizeYRaw: "20",
    resizeWRaw: "80",
    resizeHRaw: "24"
  }, { w: 320, h: 220 }, false, false);

  assert.equal(update, undefined);
});

test("keeps vertical lock editing available after a horizontal deleteResize state by reusing the base horizontal raws", () => {
  const update = buildGadgetVerticalLockResizeUpdate({
    x: 10,
    y: 20,
    w: 80,
    h: 24,
    xRaw: "10",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24",
    lockLeft: false,
    lockRight: false,
    lockTop: true,
    lockBottom: false
  }, { w: 320, h: 220, platformSkin: "windows" }, true, true);

  assert.deepEqual(update, {
    xRaw: "10",
    yRaw: "20",
    wRaw: "80",
    hRaw: "FormWindowHeight - 196"
  });
});

test("keeps horizontal lock editing available after a vertical deleteResize state by reusing the base vertical raws", () => {
  const update = buildGadgetHorizontalLockResizeUpdate({
    x: 10,
    y: 20,
    w: 80,
    h: 24,
    xRaw: "10",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24",
    lockLeft: true,
    lockRight: false,
    lockTop: false,
    lockBottom: false
  }, { w: 320, h: 220 }, false, true);

  assert.deepEqual(update, {
    xRaw: "FormWindowWidth - 310",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24"
  });
});

test("rebuilds bottom-anchor lock editing from original toolbar/statusbar constructor Y expressions", () => {
  const update = buildGadgetVerticalLockResizeUpdate({
    x: 10,
    y: 10,
    w: 80,
    h: 24,
    xRaw: "10",
    yRaw: "ToolBarHeight(0) + 10",
    wRaw: "80",
    hRaw: "24",
    resizeSource: { line: 12 },
    lockLeft: true,
    lockRight: false,
    lockTop: true,
    lockBottom: true,
    resizeXRaw: "10",
    resizeYRaw: "ToolBarHeight(0) + 10",
    resizeWRaw: "80",
    resizeHRaw: "FormWindowHeight - StatusBarHeight(0) - ToolBarHeight(0) - 120"
  }, { w: 320, h: 220 }, false, true);

  assert.deepEqual(update, {
    xRaw: "10",
    yRaw: "ToolBarHeight(0) + FormWindowHeight - 210",
    wRaw: "80",
    hRaw: "24"
  });
});

test("builds parent-relative vertical resize updates from original GadgetHeight parent formulas", () => {
  const update = buildGadgetVerticalLockResizeUpdate({
    parentId: "Container_0",
    x: 10,
    y: 20,
    w: 80,
    h: 24,
    xRaw: "10",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24",
    resizeSource: { line: 12 },
    lockLeft: true,
    lockRight: false,
    lockTop: true,
    lockBottom: false,
    resizeXRaw: "10",
    resizeYRaw: "20",
    resizeWRaw: "80",
    resizeHRaw: "24"
  }, {
    w: 320,
    h: 220,
    parent: {
      id: "Container_0",
      kind: "ContainerGadget",
      firstParam: "#Container_0",
      w: 220,
      wRaw: "220",
      h: 160,
      hRaw: "160"
    }
  }, false, true);

  assert.deepEqual(update, {
    xRaw: "10",
    yRaw: "GadgetHeight(#Container_0) - 140",
    wRaw: "80",
    hRaw: "24"
  });
});


test("builds panel-parent vertical resize updates from original panel item height formulas", () => {
  const update = buildGadgetVerticalLockResizeUpdate({
    parentId: "Panel_0",
    x: 10,
    y: 20,
    w: 80,
    h: 24,
    xRaw: "10",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24",
    resizeSource: { line: 12 },
    lockLeft: true,
    lockRight: false,
    lockTop: true,
    lockBottom: false,
    resizeXRaw: "10",
    resizeYRaw: "20",
    resizeWRaw: "80",
    resizeHRaw: "24"
  }, {
    w: 320,
    h: 220,
    platformSkin: "windows",
    parent: {
      id: "Panel_0",
      kind: "PanelGadget",
      firstParam: "#Panel_0",
      w: 220,
      wRaw: "220",
      h: 160,
      hRaw: "160"
    }
  }, false, true);

  assert.deepEqual(update, {
    xRaw: "10",
    yRaw: "GetGadgetAttribute(#Panel_0,#PB_Panel_ItemHeight) - 118",
    wRaw: "80",
    hRaw: "24"
  });
});

test("keeps panel-parent vertical resize editing blocked when the host skin is unknown", () => {
  const update = buildGadgetVerticalLockResizeUpdate({
    parentId: "Panel_0",
    x: 10,
    y: 20,
    w: 80,
    h: 24,
    xRaw: "10",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24",
    resizeSource: { line: 12 },
    lockLeft: true,
    lockRight: false,
    lockTop: true,
    lockBottom: false,
    resizeXRaw: "10",
    resizeYRaw: "20",
    resizeWRaw: "80",
    resizeHRaw: "24"
  }, {
    w: 320,
    h: 220,
    parent: {
      id: "Panel_0",
      kind: "PanelGadget",
      firstParam: "#Panel_0",
      w: 220,
      wRaw: "220",
      h: 160,
      hRaw: "160"
    }
  }, false, true);

  assert.equal(update, undefined);
});


test("rebuilds bottom-anchor lock editing from original toolbar/statusbar constructor Y expressions even with DPI-scaled geometry", () => {
  const update = buildGadgetVerticalLockResizeUpdate({
    x: 13,
    y: 13,
    w: 106,
    h: 32,
    xRaw: "10",
    yRaw: "ToolBarHeight(0) + 10",
    wRaw: "80",
    hRaw: "24",
    resizeSource: { line: 12 },
    lockLeft: true,
    lockRight: false,
    lockTop: true,
    lockBottom: true,
    resizeXRaw: "10",
    resizeYRaw: "ToolBarHeight(0) + 10",
    resizeWRaw: "80",
    resizeHRaw: "FormWindowHeight - StatusBarHeight(0) - ToolBarHeight(0) - 120"
  }, { w: 426, h: 293, layoutDpiScale: 1.33 }, false, true);

  assert.deepEqual(update, {
    xRaw: "10",
    yRaw: "ToolBarHeight(0) + FormWindowHeight - 210",
    wRaw: "80",
    hRaw: "24"
  });
});


test("blocks horizontal lock synthesis when the constructor x expression is not one of the original width reference forms", () => {
  const update = buildGadgetHorizontalLockResizeUpdate({
    x: 0,
    y: 20,
    w: 80,
    h: 24,
    xRaw: "HostWidth() - 80",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24",
    resizeSource: { line: 12 },
    lockLeft: true,
    lockRight: false,
    lockTop: true,
    lockBottom: false
  }, { w: 320, wRaw: "320" }, false, true);

  assert.equal(update, undefined);
});


test("keeps bottom-anchor vertical resize synthesis editable for original toolbar constructor Y expressions", () => {
  const update = buildGadgetVerticalLockResizeUpdate({
    x: 10,
    y: 0,
    w: 80,
    h: 24,
    xRaw: "10",
    yRaw: "ToolBarHeight(0) + 10",
    wRaw: "80",
    hRaw: "24",
    resizeSource: { line: 12 },
    lockLeft: true,
    lockRight: false,
    lockTop: true,
    lockBottom: false,
    resizeXRaw: "10",
    resizeYRaw: "ToolBarHeight(0) + 10",
    resizeWRaw: "80",
    resizeHRaw: "24"
  }, { w: 320, h: 220, hRaw: "220" }, false, true);

  assert.deepEqual(update, {
    xRaw: "10",
    yRaw: "ToolBarHeight(0) + FormWindowHeight - 210",
    wRaw: "80",
    hRaw: "24"
  });
});

test("rebuilds the original top-level stretch-height formula for the current host skin", () => {
  const update = buildGadgetVerticalLockResizeUpdate({
    x: 10,
    y: 20,
    w: 80,
    h: 24,
    xRaw: "10",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24",
    resizeSource: { line: 12 },
    lockLeft: true,
    lockRight: false,
    lockTop: true,
    lockBottom: false,
    resizeXRaw: "10",
    resizeYRaw: "20",
    resizeWRaw: "80",
    resizeHRaw: "24"
  }, { w: 320, h: 220, menuCount: 1, toolbarCount: 1, statusBarCount: 1, platformSkin: "windows" }, true, true);

  assert.deepEqual(update, {
    xRaw: "10",
    yRaw: "20",
    wRaw: "80",
    hRaw: "FormWindowHeight - MenuHeight() - ToolBarHeight(0) - StatusBarHeight(0) - 127"
  });
});

test("uses the original linux height constants when rebuilding a top-level stretch-height formula", () => {
  const update = buildGadgetVerticalLockResizeUpdate({
    x: 10,
    y: 20,
    w: 80,
    h: 24,
    xRaw: "10",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24",
    resizeSource: { line: 12 },
    lockLeft: true,
    lockRight: false,
    lockTop: true,
    lockBottom: false,
    resizeXRaw: "10",
    resizeYRaw: "20",
    resizeWRaw: "80",
    resizeHRaw: "24"
  }, { w: 320, h: 220, menuCount: 1, toolbarCount: 1, statusBarCount: 1, platformSkin: "linux" }, true, true);

  assert.deepEqual(update, {
    xRaw: "10",
    yRaw: "20",
    wRaw: "80",
    hRaw: "FormWindowHeight - MenuHeight() - StatusBarHeight(0) - 142"
  });
});

test("keeps blocking top-level stretch-height synthesis when the host skin is unknown", () => {
  const update = buildGadgetVerticalLockResizeUpdate({
    x: 10,
    y: 20,
    w: 80,
    h: 24,
    xRaw: "10",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24",
    resizeSource: { line: 12 },
    lockLeft: true,
    lockRight: false,
    lockTop: true,
    lockBottom: false,
    resizeXRaw: "10",
    resizeYRaw: "20",
    resizeWRaw: "80",
    resizeHRaw: "24"
  }, { w: 320, h: 220, menuCount: 1, toolbarCount: 1, statusBarCount: 1 }, true, true);

  assert.equal(update, undefined);
});

test("shows non-original gadget parent and tab detail rows only when they actually carry metadata", () => {
  assert.equal(shouldShowGadgetParentDetail({ parentId: "Container_0" }), true);
  assert.equal(shouldShowGadgetParentDetail({ parentId: "   " }), false);
  assert.equal(shouldShowGadgetParentDetail({}), false);

  assert.equal(shouldShowGadgetTabDetail({ parentItem: 0 }), true);
  assert.equal(shouldShowGadgetTabDetail({ parentItem: 3 }), true);
  assert.equal(shouldShowGadgetTabDetail({}), false);
});
