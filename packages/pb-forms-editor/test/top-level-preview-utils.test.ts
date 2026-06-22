import test from "node:test";
import assert from "node:assert/strict";
import {
  canEditToolBarTooltip,
  deriveWindows7MenuBarPalette,
  buildOptionalInspectorLiteralRaw,
  buildOptionalInspectorPlainValue,
  canMoveWindowInCanvas,
  canResizeWindowTopInCanvas,
  canResizeWindowLeftInCanvas,
  canResizeWindowRightInCanvas,
  canResizeWindowBottomInCanvas,
  canResizeWindowHandleInCanvas,
  getDefaultMenuItemInsertArgs,
  getDefaultToolBarInsertId,
  getOpenSubMenuBalance,
  getDirectMenuChildIndices,
  getMenuAncestorChain,
  getMenuEntryBlockEndIndex,
  getMenuEntryLevel,
  getMenuFlyoutAnchorRect,
  getMenuFlyoutEntryTextLayout,
  getMenuFlyoutFooterOpacity,
  getMenuFlyoutFooterPreviewRect,
  getMenuFlyoutFooterTextPosition,
  getMenuFlyoutSeparatorLineY,
  getMenuFlyoutSeparatorPreviewRect,
  getMenuFlyoutEntryPreviewRect,
  getMenuFlyoutShortcutOpacity,
  getMenuEntrySourceLine,
  getMenuEntrySelectedIndexAtDragStart,
  getMenuEntryMoveTarget,
  getLinearTopLevelEntryMoveTarget,
  getMenuEntryRect,
  getMenuFlyoutPanelRect,
  getMenuFooterRect,
  getMenuPreviewLabel,
  getPredictedMenuEntryMoveIndex,
  getMenuVisibleEntries,
  getStatusBarAddButtonPreviewLayout,
  getStatusBarFieldImageY,
  getStatusBarFieldPreviewRect,
  getStatusBarFieldMoveTarget,
  getStatusBarFieldTextBaselineY,
  getStatusBarFieldWidths,
  getStatusBarProgressTrackPreviewRect,
  getStatusBarPreviewInsertArgs,
  getSelectedMenuEntryInspectorFieldConfig,
  getSelectedStatusBarInspectorFieldConfig,
  getTopLevelSelectProcEditState,
  resolveMenuFooterHit,
  resolvePreviewRectHit,
  resolvePreviewRectListHit,
  resolveTopLevelChromeHit,
  getSelectedToolBarInspectorFieldConfig,
  getToolBarPreviewInsertArgs,
  getToolBarEntryAdvance,
  getToolBarImageButtonPreviewRect,
  getToolBarSeparatorPreviewRect,
  getToolBarSeparatorSelectedOutlineRect,
  getToolBarSeparatorSlotRect,
  getTopLevelClampedAddIconX,
  getTopLevelMoveIndicatorStrokes,
  hasPbFlag,
  unquotePbString,
  getVisibleToolBarEntryCount,
  hasStatusBarPreviewAssignedImage,
  hasToolBarPreviewAssignedImage,
  isBoundToolBarTooltipEntry,
  shouldShowToolBarPreviewUnselectedFrame,
  shouldShowToolBarStructureEntry
} from "../src/core/toplevel/preview";

test("binds toolbar tooltips to the previous matching toolbar entry", () => {
  const toolBar = {
    entries: [
      { kind: "ToolBarImageButton", idRaw: "#TbOpen" },
      { kind: "ToolBarToolTip", idRaw: "#TbOpen" },
      { kind: "ToolBarSeparator" },
      { kind: "ToolBarToolTip", idRaw: "#TbOther" }
    ]
  };

  assert.equal(isBoundToolBarTooltipEntry(toolBar, 1), true);
  assert.equal(isBoundToolBarTooltipEntry(toolBar, 3), false);
});

test("filters bound toolbar tooltip rows from the visible structure count", () => {
  const toolBar = {
    entries: [
      { kind: "ToolBarImageButton", idRaw: "#TbOpen" },
      { kind: "ToolBarToolTip", idRaw: "#TbOpen" },
      { kind: "ToolBarSeparator" },
      { kind: "ToolBarToolTip", idRaw: "#TbOther" }
    ]
  };

  assert.equal(shouldShowToolBarStructureEntry(toolBar, 0), true);
  assert.equal(shouldShowToolBarStructureEntry(toolBar, 1), false);
  assert.equal(shouldShowToolBarStructureEntry(toolBar, 2), true);
  assert.equal(shouldShowToolBarStructureEntry(toolBar, 3), true);
  assert.equal(getVisibleToolBarEntryCount(toolBar), 3);
});

test("preserves whitespace-only inspector text values when converting to raw payloads", () => {
  assert.equal(buildOptionalInspectorLiteralRaw(""), "");
  assert.equal(buildOptionalInspectorLiteralRaw("   "), '"   "');
  assert.equal(buildOptionalInspectorLiteralRaw(' A "quoted" value '), '" A ""quoted"" value "');
  assert.equal(buildOptionalInspectorPlainValue(""), undefined);
  assert.equal(buildOptionalInspectorPlainValue("   "), "   ");
});

test("keeps top-level window canvas movement disabled to match the original designer", () => {
  assert.equal(canMoveWindowInCanvas(), false);
});

test("limits top-level window canvas resize handles to the original right and bottom edges", () => {
  assert.equal(canResizeWindowTopInCanvas(), false);
  assert.equal(canResizeWindowLeftInCanvas(), false);
  assert.equal(canResizeWindowRightInCanvas(), true);
  assert.equal(canResizeWindowBottomInCanvas(), true);

  assert.equal(canResizeWindowHandleInCanvas("nw"), false);
  assert.equal(canResizeWindowHandleInCanvas("n"), false);
  assert.equal(canResizeWindowHandleInCanvas("ne"), false);
  assert.equal(canResizeWindowHandleInCanvas("w"), false);
  assert.equal(canResizeWindowHandleInCanvas("e"), true);
  assert.equal(canResizeWindowHandleInCanvas("sw"), false);
  assert.equal(canResizeWindowHandleInCanvas("s"), true);
  assert.equal(canResizeWindowHandleInCanvas("se"), true);
});

test("builds default menu labels, levels and insert args", () => {
  const menu = {
    entries: [
      { kind: "MenuTitle", textRaw: '"File"', level: 0 },
      { kind: "OpenSubMenu", textRaw: '"Export"', level: 1 },
      { kind: "MenuItem", text: "PNG", level: 2 },
      { kind: "CloseSubMenu", level: 1 }
    ]
  };

  assert.equal(getMenuPreviewLabel(menu.entries[0]), "File");
  assert.equal(getMenuPreviewLabel(menu.entries[2]), "PNG");
  assert.equal(getMenuPreviewLabel(menu.entries[3]), "");
  assert.equal(getMenuEntryLevel(menu.entries[1]), 1);
  assert.equal(getMenuEntryLevel(undefined), 0);
  assert.equal(getOpenSubMenuBalance(menu), 0);
  assert.deepEqual(getDefaultMenuItemInsertArgs(menu), {
    idRaw: "#MenuItem_4",
    textRaw: '"MenuItem4"'
  });
});

test("tracks unmatched open submenu balance for root close guards", () => {
  assert.equal(getOpenSubMenuBalance({
    entries: [
      { kind: "MenuTitle", textRaw: '"File"', level: 0 },
      { kind: "OpenSubMenu", textRaw: '"Recent"', level: 1 },
      { kind: "MenuItem", textRaw: '"Last"', level: 2 }
    ]
  }), 1);

  assert.equal(getOpenSubMenuBalance({
    entries: [
      { kind: "CloseSubMenu", level: 0 },
      { kind: "OpenSubMenu", textRaw: '"Recent"', level: 0 },
      { kind: "CloseSubMenu", level: 0 }
    ]
  }), 0);
});

test("resolves direct menu children and ancestor chains from entry levels", () => {
  const menu = {
    entries: [
      { kind: "MenuTitle", textRaw: '"File"', level: 0, source: { line: 10 } },
      { kind: "OpenSubMenu", textRaw: '"Export"', level: 1, source: { line: 11 } },
      { kind: "MenuItem", textRaw: '"PNG"', level: 2, source: { line: 12 } },
      { kind: "MenuItem", textRaw: '"JPG"', level: 2, source: { line: 13 } },
      { kind: "CloseSubMenu", level: 1, source: { line: 14 } },
      { kind: "MenuItem", textRaw: '"Quit"', level: 1, source: { line: 15 } }
    ]
  };

  assert.deepEqual(getDirectMenuChildIndices(menu, 1), [2, 3]);
  assert.deepEqual(getMenuAncestorChain(menu, 3), [0, 1, 3]);
  assert.equal(getMenuEntrySourceLine(menu, 5), 15);
  assert.equal(getMenuEntrySourceLine(menu, 99), undefined);
});

test("derives the windows7 menu-bar palette from Menu/MenuBar colors with original fallbacks", () => {
  assert.deepEqual(deriveWindows7MenuBarPalette(undefined, undefined), {
    topFill: "rgb(245, 245, 245)",
    bottomFill: "rgb(218, 224, 241)",
    separatorUpper: "rgb(182, 188, 204)",
    separatorMiddle: "rgb(240, 240, 240)",
    separatorLower: "rgb(160, 160, 160)",
  });

  assert.deepEqual(deriveWindows7MenuBarPalette("rgb(240, 240, 240)", "rgb(240, 240, 240)"), {
    topFill: "rgb(244, 244, 244)",
    bottomFill: "rgb(224, 228, 241)",
    separatorUpper: "rgb(197, 201, 213)",
    separatorMiddle: "rgb(240, 240, 240)",
    separatorLower: "rgb(180, 180, 180)",
  });
});

test("keeps flyout shortcut and footer text at full original opacity", () => {
  assert.equal(getMenuFlyoutShortcutOpacity(), 1);
  assert.equal(getMenuFlyoutFooterOpacity(), 1);
});

test("uses the original flyout separator hit rectangle and separator line offset", () => {
  const entryRect = getMenuFlyoutSeparatorPreviewRect(120, 48, 160);
  assert.deepEqual(entryRect, { x: 120, y: 48, w: 160, h: 12 });
  assert.equal(getMenuFlyoutSeparatorLineY(entryRect), 54);
});


test("uses original menu flyout entry and footer registered heights", () => {
  assert.deepEqual(getMenuFlyoutEntryPreviewRect("#Menu", 3, 120, 48, 160), {
    ownerId: "#Menu",
    index: 3,
    x: 120,
    y: 48,
    w: 160,
    h: 20,
  });

  assert.deepEqual(getMenuFlyoutFooterPreviewRect("#Menu", 0, 120, 108, 160), {
    menuId: "#Menu",
    parentIndex: 0,
    x: 120,
    y: 108,
    w: 160,
    h: 20,
  });
});

test("uses the restored flyout text baseline and menu-bar anchored flyout positions", () => {
  assert.deepEqual(getMenuFlyoutEntryTextLayout({ x: 120, y: 48, w: 160, h: 20 }, 37.2), {
    labelX: 144,
    labelY: 62,
    shortcutX: 232,
    shortcutY: 62,
  });

  assert.deepEqual(getMenuFlyoutFooterTextPosition({ x: 120, y: 108, w: 160, h: 20 }), {
    x: 125,
    y: 122,
  });

  assert.deepEqual(
    getMenuFlyoutAnchorRect(
      { x: 10, y: 30, w: 240, h: 22 },
      { x: 25, y: 32, w: 40, h: 14 },
      null,
    ),
    {
      x: 25,
      y: 52,
      w: 0,
      h: 0,
    }
  );

  assert.deepEqual(
    getMenuFlyoutAnchorRect(
      { x: 10, y: 30, w: 240, h: 22 },
      { x: 140, y: 76, w: 100, h: 20 },
      { x: 65, y: 52, w: 140, h: 80 },
    ),
    {
      x: 205,
      y: 76,
      w: 0,
      h: 0,
    }
  );
});

test("predicts menu block end indices and move targets for subtree moves", () => {
  const menu = {
    entries: [
      { kind: "MenuTitle", textRaw: '"File"', level: 0 },
      { kind: "OpenSubMenu", textRaw: '"Export"', level: 1 },
      { kind: "MenuItem", textRaw: '"PNG"', level: 2 },
      { kind: "MenuItem", textRaw: '"JPG"', level: 2 },
      { kind: "CloseSubMenu", level: 1 },
      { kind: "MenuItem", textRaw: '"Quit"', level: 1 },
      { kind: "MenuTitle", textRaw: '"Edit"', level: 0 }
    ]
  };

  assert.equal(getMenuEntryBlockEndIndex(menu.entries, 1), 3);
  assert.equal(getPredictedMenuEntryMoveIndex(menu, 1, 6, "after"), 4);
  assert.equal(getPredictedMenuEntryMoveIndex(menu, 5, 0, "before"), 0);
  assert.equal(getPredictedMenuEntryMoveIndex(menu, 1, 2, "before"), null);
});


test("separates toolbar separator visible geometry from the original hit slot", () => {
  const separatorRect = getToolBarSeparatorPreviewRect(42, 17);
  assert.deepEqual(separatorRect, { x: 42, y: 17, w: 6, h: 16 });
  assert.deepEqual(getToolBarSeparatorSlotRect(42, 17), { x: 42, y: 17, w: 10, h: 16 });
  assert.deepEqual(getToolBarImageButtonPreviewRect(60, 17), { x: 60, y: 17, w: 16, h: 16 });
  assert.equal(getToolBarEntryAdvance("ToolBarSeparator"), 10);
  assert.equal(getToolBarEntryAdvance("ToolBarImageButton"), 22);
  assert.deepEqual(getToolBarSeparatorSelectedOutlineRect(separatorRect), {
    x: 41,
    y: 16,
    w: 8,
    h: 18,
  });
});

test("keeps top-level menu and toolbar add icons clamped inside their preview band", () => {
  const band = { x: 20, y: 10, w: 80, h: 22 };

  assert.equal(getTopLevelClampedAddIconX(band, 12), 26);
  assert.equal(getTopLevelClampedAddIconX(band, 50), 50);
  assert.equal(getTopLevelClampedAddIconX(band, 120), 80);
});



test("exposes contrast move-indicator strokes without changing original geometry helpers", () => {
  assert.deepEqual(
    getTopLevelMoveIndicatorStrokes("original"),
    [
      { role: "core", lineWidth: 2, fallbackColor: "#0000ff", cssVariable: "--vscode-editorInfo-foreground" },
    ]
  );

  assert.deepEqual(
    getTopLevelMoveIndicatorStrokes("contrast"),
    [
      { role: "halo", lineWidth: 6, fallbackColor: "rgba(255, 255, 255, 0.95)" },
      { role: "core", lineWidth: 2, fallbackColor: "rgb(255, 149, 0)", cssVariable: "--vscode-editorWarning-foreground" },
    ]
  );

  const contrastStrokes = getTopLevelMoveIndicatorStrokes("contrast");
  contrastStrokes[0].lineWidth = 99;
  assert.equal(getTopLevelMoveIndicatorStrokes("contrast")[0].lineWidth, 6);
});

test("uses the original statusbar field hit and selection geometry", () => {
  assert.deepEqual(
    getStatusBarFieldPreviewRect("StatusBar_0", 2, 42.8, 180.2, 64.9, 23.9),
    { ownerId: "StatusBar_0", index: 2, x: 42, y: 180, w: 64, h: 23 }
  );
});


test("keeps statusbar content offsets aligned with FD_Redraw", () => {
  const fieldRect = { ownerId: "StatusBar_0", index: 1, x: 42, y: 180, w: 64, h: 23 };

  assert.equal(getStatusBarFieldTextBaselineY(fieldRect), 195);
  assert.equal(getStatusBarFieldImageY(fieldRect), 184);
  assert.deepEqual(
    getStatusBarProgressTrackPreviewRect(fieldRect, 60.8, 13.2),
    { x: 44, y: 185, w: 60, h: 13 }
  );
});

test("keeps the statusbar add hit rectangle full-height while drawing the plus icon at the original image offset", () => {
  assert.deepEqual(
    getStatusBarAddButtonPreviewLayout({ x: 20, y: 180, w: 240, h: 23 }, 206),
    {
      hitRect: { x: 206, y: 180, w: 16, h: 23 },
      iconX: 206,
      iconY: 184,
    }
  );
});

test("builds default toolbar insert ids and preview insert args", () => {
  const toolBar = {
    entries: [
      { kind: "ToolBarImageButton", idRaw: "#TbOpen" },
      { kind: "ToolBarToolTip", idRaw: "#TbOpen" },
      { kind: "ToolBarSeparator" }
    ]
  };

  assert.equal(getDefaultToolBarInsertId(toolBar), "#Toolbar_2");
  assert.deepEqual(getToolBarPreviewInsertArgs(toolBar, "button"), {
    kind: "ToolBarImageButton",
    idRaw: "#Toolbar_2",
    iconRaw: "0"
  });
  assert.deepEqual(getToolBarPreviewInsertArgs(toolBar, "toggle"), {
    kind: "ToolBarImageButton",
    idRaw: "#Toolbar_2",
    iconRaw: "0",
    toggle: true
  });
  assert.deepEqual(getToolBarPreviewInsertArgs(toolBar, "separator"), {
    kind: "ToolBarSeparator"
  });
});

test("selected menu inspector follows the original row set with parser-safe editability", () => {
  assert.deepEqual(getSelectedMenuEntryInspectorFieldConfig({ kind: "MenuItem", idRaw: "#Menu_Open" }, true), {
    constantEditable: true,
    nameEditable: true,
    shortcutEditable: true,
    imageEditable: true,
    separatorChecked: false,
    separatorEditable: false,
  });
  assert.deepEqual(getSelectedMenuEntryInspectorFieldConfig({ kind: "MenuTitle" }, true), {
    constantEditable: false,
    nameEditable: true,
    shortcutEditable: false,
    imageEditable: false,
    separatorChecked: false,
    separatorEditable: false,
  });
  assert.deepEqual(getSelectedMenuEntryInspectorFieldConfig({ kind: "OpenSubMenu" }, true), {
    constantEditable: false,
    nameEditable: true,
    shortcutEditable: false,
    imageEditable: false,
    separatorChecked: false,
    separatorEditable: false,
  });
  assert.deepEqual(getSelectedMenuEntryInspectorFieldConfig({ kind: "MenuBar" }, true), {
    constantEditable: false,
    nameEditable: false,
    shortcutEditable: false,
    imageEditable: false,
    separatorChecked: true,
    separatorEditable: false,
  });
  assert.deepEqual(getSelectedMenuEntryInspectorFieldConfig({ kind: "MenuItem", idRaw: "#Menu_Open" }, false), {
    constantEditable: false,
    nameEditable: false,
    shortcutEditable: false,
    imageEditable: false,
    separatorChecked: false,
    separatorEditable: false,
  });
});

test("exposes editable tooltip rows only for real toolbar command entries", () => {
  assert.equal(canEditToolBarTooltip({ kind: "ToolBarImageButton", idRaw: "#TbOpen" }), true);
  assert.equal(canEditToolBarTooltip({ kind: "ToolBarSeparator", idRaw: "#TbSep" }), false);
  assert.equal(canEditToolBarTooltip({ kind: "ToolBarToolTip", idRaw: "#TbOpen" }), false);
  assert.equal(canEditToolBarTooltip({ kind: "ToolBarImageButton", idRaw: "   " }), false);
});

test("selected toolbar inspector follows the original row set with parser-safe editability", () => {
  assert.deepEqual(getSelectedToolBarInspectorFieldConfig({ kind: "ToolBarImageButton", idRaw: "#TbOpen", toggle: true }, true), {
    variableEditable: true,
    captionLabel: "Caption",
    captionEditable: true,
    imageEditable: true,
    toggleChecked: true,
    toggleEditable: true,
    separatorChecked: false,
    separatorEditable: false,
    selectProcParticipates: true,
    selectProcDisabledTitle: "Toolbar separators are structural entries and do not participate in Select EventMenu() cases.",
    showTextField: false,
    showIconRawField: false,
  });
  assert.deepEqual(getSelectedToolBarInspectorFieldConfig({ kind: "ToolBarSeparator" }, true), {
    variableEditable: false,
    captionLabel: "Caption",
    captionEditable: false,
    imageEditable: false,
    toggleChecked: false,
    toggleEditable: false,
    separatorChecked: true,
    separatorEditable: false,
    selectProcParticipates: false,
    selectProcDisabledTitle: "Toolbar separators are structural entries and do not participate in Select EventMenu() cases.",
    showTextField: false,
    showIconRawField: false,
  });
  assert.deepEqual(getSelectedToolBarInspectorFieldConfig({ kind: "ToolBarToolTip", idRaw: "#TbOpen" }, true), {
    variableEditable: true,
    captionLabel: "Caption",
    captionEditable: false,
    imageEditable: false,
    toggleChecked: false,
    toggleEditable: false,
    separatorChecked: false,
    separatorEditable: false,
    selectProcParticipates: false,
    selectProcDisabledTitle: "This entry type does not participate in Select EventMenu() cases.",
    showTextField: false,
    showIconRawField: false,
  });
  assert.equal(getSelectedToolBarInspectorFieldConfig({ kind: "ToolBarImageButton", idRaw: "#TbOpen" }, false).variableEditable, false);
  assert.equal(getSelectedToolBarInspectorFieldConfig({ kind: "ToolBarImageButton", idRaw: "#TbOpen" }, false).imageEditable, false);
});

test("selected statusbar inspector follows the original row set with parser-safe editability", () => {
  assert.deepEqual(getSelectedStatusBarInspectorFieldConfig(true), {
    widthEditable: true,
    textEditable: true,
    currentImageEditable: true,
    changeImageEditable: true,
    progressBarEditable: true,
    flagsEditable: true,
    deleteEditable: true,
    showProgressValueField: false,
  });

  assert.deepEqual(getSelectedStatusBarInspectorFieldConfig(false), {
    widthEditable: false,
    textEditable: false,
    currentImageEditable: false,
    changeImageEditable: false,
    progressBarEditable: false,
    flagsEditable: false,
    deleteEditable: false,
    showProgressValueField: false,
  });
});

test("selected top-level inspector policies cover the original menu toolbar and statusbar row matrices", () => {
  const menuItem = getSelectedMenuEntryInspectorFieldConfig({ kind: "MenuItem", idRaw: "#Menu_Open" }, true);
  assert.deepEqual(Object.keys(menuItem), [
    "constantEditable",
    "nameEditable",
    "shortcutEditable",
    "imageEditable",
    "separatorChecked",
    "separatorEditable"
  ]);

  const toolBarButton = getSelectedToolBarInspectorFieldConfig({ kind: "ToolBarImageButton", idRaw: "#TbOpen" }, true);
  assert.deepEqual(Object.keys(toolBarButton), [
    "variableEditable",
    "captionLabel",
    "captionEditable",
    "imageEditable",
    "toggleChecked",
    "toggleEditable",
    "separatorChecked",
    "separatorEditable",
    "selectProcParticipates",
    "selectProcDisabledTitle",
    "showTextField",
    "showIconRawField"
  ]);

  const statusBarField = getSelectedStatusBarInspectorFieldConfig(true);
  assert.deepEqual(Object.keys(statusBarField), [
    "widthEditable",
    "textEditable",
    "currentImageEditable",
    "changeImageEditable",
    "progressBarEditable",
    "flagsEditable",
    "deleteEditable",
    "showProgressValueField"
  ]);
});

test("top-level SelectProc remains editable without an EventMenu block when an id exists", () => {
  assert.deepEqual(getTopLevelSelectProcEditState(false, "#MenuItem_Open", "menu"), {
    canEdit: true,
    title: "Choose an existing procedure or type a procedure name. Writing it back still requires a parsed Select EventMenu() block in the source."
  });
  assert.deepEqual(getTopLevelSelectProcEditState(true, "#MenuItem_Open", "menu"), {
    canEdit: true,
    title: "Choose an existing procedure or type a procedure name."
  });
  assert.deepEqual(getTopLevelSelectProcEditState(false, "   ", "toolbar"), {
    canEdit: false,
    title: "Only toolbar entries with a parsed id can be patched safely."
  });
});

test("builds default statusbar preview insert args", () => {
  assert.deepEqual(getStatusBarPreviewInsertArgs("image"), {
    widthRaw: "50"
  });
  assert.deepEqual(getStatusBarPreviewInsertArgs("label"), {
    widthRaw: "50",
    textRaw: '"Label"'
  });
  assert.deepEqual(getStatusBarPreviewInsertArgs("progress"), {
    widthRaw: "50",
    progressBar: true,
    progressRaw: "0"
  });
});


test("exposes pb-style flags, string unquoting and top-level preview widths", () => {
  assert.equal(hasPbFlag("#PB_StatusBar_Center | #PB_StatusBar_Raised", "#PB_StatusBar_Center"), true);
  assert.equal(hasPbFlag("#PB_StatusBar_Raised", "#PB_StatusBar_Center"), false);
  assert.equal(unquotePbString('  "Status"  '), "Status");
  assert.equal(unquotePbString(' ~"Escaped ""Status""" '), 'Escaped "Status"');
  assert.equal(unquotePbString("Status"), "Status");

  assert.deepEqual(getStatusBarFieldWidths({
    fields: [
      { widthRaw: "60" },
      { widthRaw: "#PB_Ignore" },
      { widthRaw: "120" },
      { widthRaw: "VariableWidth" }
    ]
  }, 320), [60, 70, 120, 70]);
});

test("computes flyout menu panel rectangles from visible child content", () => {
  const menu = {
    entries: [
      { kind: "MenuTitle", textRaw: '"File"', level: 0 },
      { kind: "OpenSubMenu", textRaw: '"Export"', level: 1 },
      { kind: "MenuItem", textRaw: '"PNG"', shortcut: "Ctrl+P", level: 2 },
      { kind: "MenuBar", level: 2 },
      { kind: "MenuItem", textRaw: '"JPG"', level: 2 },
      { kind: "CloseSubMenu", level: 1 }
    ]
  };

  assert.deepEqual(
    getMenuFlyoutPanelRect(menu, 1, { x: 100, y: 50, w: 0, h: 0 }, (text) => text.length * 6),
    { x: 100, y: 50, w: 118, h: 72 }
  );
});


test("resolves generic preview rect hits for add buttons and footers", () => {
  assert.deepEqual(
    resolvePreviewRectHit({ menuId: "m1", x: 10, y: 20, w: 16, h: 16 }, 18, 28),
    { menuId: "m1", x: 10, y: 20, w: 16, h: 16 }
  );
  assert.equal(resolvePreviewRectHit({ menuId: "m1", x: 10, y: 20, w: 16, h: 16 }, 40, 40), null);
  assert.deepEqual(
    resolvePreviewRectListHit([{ ownerId: "m1", index: 2, x: 30, y: 40, w: 20, h: 12 }], 35, 45),
    { ownerId: "m1", index: 2, x: 30, y: 40, w: 20, h: 12 }
  );
});

test("resolves flyout menu entry hits outside the menu bar rectangle", () => {
  assert.deepEqual(
    resolveTopLevelChromeHit({
      x: 92,
      y: 132,
      windowHit: true,
      menuId: "menu-1",
      menuRect: { x: 20, y: 80, w: 120, h: 22 },
      menuEntryRects: [
        { ownerId: "menu-1", index: 0, x: 20, y: 80, w: 40, h: 18 },
        { ownerId: "menu-1", index: 2, x: 80, y: 120, w: 110, h: 20 }
      ]
    }),
    {
      selection: { kind: "menuEntry", menuId: "menu-1", entryIndex: 2 },
      rect: { ownerId: "menu-1", index: 2, x: 80, y: 120, w: 110, h: 20 }
    }
  );
});

test("resolves flyout menu entry hits outside the window rectangle", () => {
  assert.deepEqual(
    resolveTopLevelChromeHit({
      x: 212,
      y: 132,
      windowHit: false,
      menuId: "menu-1",
      menuRect: { x: 20, y: 80, w: 120, h: 22 },
      menuEntryRects: [
        { ownerId: "menu-1", index: 0, x: 20, y: 80, w: 40, h: 18 },
        { ownerId: "menu-1", index: 4, x: 180, y: 120, w: 110, h: 20 }
      ]
    }),
    {
      selection: { kind: "menuEntry", menuId: "menu-1", entryIndex: 4 },
      rect: { ownerId: "menu-1", index: 4, x: 180, y: 120, w: 110, h: 20 }
    }
  );
});

test("resolves top-level chrome hits from menu, toolbar and statusbar rectangles", () => {
  assert.deepEqual(
    resolveTopLevelChromeHit({
      x: 32,
      y: 88,
      windowHit: true,
      menuId: "menu-1",
      menuRect: { x: 20, y: 80, w: 120, h: 22 },
      menuEntryRects: [{ ownerId: "menu-1", index: 3, x: 30, y: 82, w: 40, h: 18 }]
    }),
    {
      selection: { kind: "menuEntry", menuId: "menu-1", entryIndex: 3 },
      rect: { ownerId: "menu-1", index: 3, x: 30, y: 82, w: 40, h: 18 }
    }
  );

  assert.deepEqual(
    resolveTopLevelChromeHit({
      x: 55,
      y: 145,
      windowHit: true,
      toolBarId: "tb-1",
      toolBarRect: { x: 20, y: 140, w: 120, h: 24 },
      toolBarEntryRects: [{ ownerId: "tb-1", index: 1, x: 50, y: 144, w: 16, h: 16 }]
    }),
    {
      selection: { kind: "toolBarEntry", toolBarId: "tb-1", entryIndex: 1 },
      rect: { ownerId: "tb-1", index: 1, x: 50, y: 144, w: 16, h: 16 }
    }
  );

  assert.deepEqual(
    resolveTopLevelChromeHit({
      x: 70,
      y: 224,
      windowHit: true,
      statusBarId: "sb-1",
      statusBarRect: { x: 20, y: 220, w: 120, h: 22 },
      statusBarFieldRects: [{ ownerId: "sb-1", index: 0, x: 60, y: 221, w: 30, h: 18 }]
    }),
    {
      selection: { kind: "statusBarField", statusBarId: "sb-1", fieldIndex: 0 },
      rect: { ownerId: "sb-1", index: 0, x: 60, y: 221, w: 30, h: 18 }
    }
  );

  assert.equal(resolveTopLevelChromeHit({ x: 0, y: 0, windowHit: false }), null);
});


test("resolves visible menu entry and footer rectangles from preview caches", () => {
  const menu = {
    id: "menu-1",
    entries: [
      { kind: "MenuTitle", textRaw: '"File"', level: 0 },
      { kind: "MenuItem", textRaw: '"Open"', level: 1 }
    ]
  };
  const entryRects = [
    { ownerId: "menu-1", index: 0, x: 10, y: 20, w: 40, h: 18 },
    { ownerId: "menu-1", index: 1, x: 20, y: 40, w: 60, h: 18 }
  ];
  const footerRects = [{ menuId: "menu-1", parentIndex: 0, x: 20, y: 58, w: 60, h: 20 }];

  assert.deepEqual(getMenuEntryRect(entryRects, "menu-1", 1), entryRects[1]);
  assert.deepEqual(getMenuFooterRect(footerRects, "menu-1", 0), footerRects[0]);
  assert.deepEqual(getMenuVisibleEntries(menu, entryRects), [
    { index: 0, entry: menu.entries[0], rect: entryRects[0] },
    { index: 1, entry: menu.entries[1], rect: entryRects[1] }
  ]);
  assert.deepEqual(
    resolveMenuFooterHit({ x: 30, y: 65, windowHit: true, menuRect: { x: 0, y: 0, w: 100, h: 20 }, footerRects }),
    footerRects[0]
  );
  assert.deepEqual(
    resolveMenuFooterHit({ x: 30, y: 65, windowHit: false, footerRects }),
    footerRects[0]
  );
});


test("captures the original propgrid-menu selection target before menu drag selection changes", () => {
  assert.equal(
    getMenuEntrySelectedIndexAtDragStart("menu-1", { kind: "menuEntry", menuId: "menu-1", entryIndex: 1 }),
    1
  );
  assert.equal(
    getMenuEntrySelectedIndexAtDragStart("menu-1", { kind: "menuEntry", menuId: "other-menu", entryIndex: 1 }),
    undefined
  );
  assert.equal(
    getMenuEntrySelectedIndexAtDragStart("menu-1", { kind: "toolbar", id: "tb-1" }),
    undefined
  );
});

test("resolves menu move targets from visible flyout entries", () => {
  const menu = {
    id: "menu-1",
    entries: [
      { kind: "MenuTitle", textRaw: '"File"', level: 0, source: { line: 10 } },
      { kind: "OpenSubMenu", textRaw: '"Export"', level: 1, source: { line: 11 } },
      { kind: "MenuItem", textRaw: '"PNG"', level: 2, source: { line: 12 } },
      { kind: "CloseSubMenu", level: 1, source: { line: 13 } },
      { kind: "MenuItem", textRaw: '"Quit"', level: 1, source: { line: 14 } }
    ]
  };
  const visibleEntries = [
    { index: 0, entry: menu.entries[0], rect: { ownerId: "menu-1", index: 0, x: 10, y: 20, w: 40, h: 18 } },
    { index: 1, entry: menu.entries[1], rect: { ownerId: "menu-1", index: 1, x: 20, y: 40, w: 70, h: 20 } },
    { index: 2, entry: menu.entries[2], rect: { ownerId: "menu-1", index: 2, x: 30, y: 60, w: 80, h: 20 } },
    { index: 4, entry: menu.entries[4], rect: { ownerId: "menu-1", index: 4, x: 20, y: 80, w: 70, h: 20 } }
  ];
  const footerRects = [{ menuId: "menu-1", parentIndex: 1, x: 30, y: 80, w: 80, h: 20 }];

  assert.deepEqual(
    getMenuEntryMoveTarget({
      menu,
      sourceEntryIndex: 4,
      x: 8,
      y: 25,
      menuBarBottom: 38,
      visibleEntries,
      footerRects
    }),
    {
      targetSourceLine: 10,
      placement: "before",
      indicatorRect: { x: 9, y: 20, w: 2, h: 16 },
      indicatorOrientation: "vertical"
    }
  );

  const emptySubMenu = {
    id: "menu-1",
    entries: [
      { kind: "MenuTitle", textRaw: '"File"', level: 0, source: { line: 10 } },
      { kind: "OpenSubMenu", textRaw: '"Export"', level: 1, source: { line: 11 } },
      { kind: "CloseSubMenu", level: 1, source: { line: 13 } },
      { kind: "MenuItem", textRaw: '"Quit"', level: 1, source: { line: 14 } }
    ]
  };
  const emptyVisibleEntries = [
    { index: 0, entry: emptySubMenu.entries[0], rect: { ownerId: "menu-1", index: 0, x: 10, y: 20, w: 40, h: 18 } },
    { index: 1, entry: emptySubMenu.entries[1], rect: { ownerId: "menu-1", index: 1, x: 20, y: 40, w: 70, h: 20 } },
    { index: 3, entry: emptySubMenu.entries[3], rect: { ownerId: "menu-1", index: 3, x: 20, y: 80, w: 70, h: 20 } }
  ];

  assert.deepEqual(
    getMenuEntryMoveTarget({
      menu,
      sourceEntryIndex: 1,
      x: 49,
      y: 25,
      menuBarBottom: 38,
      visibleEntries,
      footerRects
    }),
    {
      targetSourceLine: 10,
      placement: "after",
      indicatorRect: { x: 50, y: 20, w: 2, h: 16 },
      indicatorOrientation: "vertical"
    }
  );

  assert.deepEqual(
    getMenuEntryMoveTarget({
      menu: emptySubMenu,
      sourceEntryIndex: 3,
      x: 95,
      y: 45,
      menuBarBottom: 80,
      visibleEntries: emptyVisibleEntries,
      footerRects,
      selectedEntryIndex: 1
    }),
    {
      targetSourceLine: 11,
      placement: "appendChild",
      indicatorRect: { x: 90, y: 40, w: 80, h: 2 },
      indicatorOrientation: "horizontal"
    }
  );

  assert.equal(
    getMenuEntryMoveTarget({
      menu: emptySubMenu,
      sourceEntryIndex: 3,
      x: 95,
      y: 45,
      menuBarBottom: 80,
      visibleEntries: emptyVisibleEntries,
      footerRects
    }),
    null
  );

  assert.equal(
    getMenuEntryMoveTarget({
      menu: emptySubMenu,
      sourceEntryIndex: 3,
      x: 95,
      y: 45,
      menuBarBottom: 80,
      visibleEntries: emptyVisibleEntries,
      footerRects,
      selectedEntryIndex: 0
    }),
    null
  );
});


test("suppresses menu move targets that would be no-op structural moves", () => {
  const menu = {
    id: "menu-1",
    entries: [
      { kind: "MenuTitle", textRaw: '"File"', level: 0, source: { line: 10 } },
      { kind: "OpenSubMenu", textRaw: '"Export"', level: 1, source: { line: 11 } },
      { kind: "MenuItem", textRaw: '"PNG"', level: 2, source: { line: 12 } },
      { kind: "CloseSubMenu", level: 1, source: { line: 13 } },
      { kind: "MenuItem", textRaw: '"Quit"', level: 1, source: { line: 14 } }
    ]
  };
  const visibleEntries = [
    { index: 0, entry: menu.entries[0], rect: { ownerId: "menu-1", index: 0, x: 10, y: 20, w: 40, h: 18 } },
    { index: 1, entry: menu.entries[1], rect: { ownerId: "menu-1", index: 1, x: 20, y: 40, w: 70, h: 20 } },
    { index: 2, entry: menu.entries[2], rect: { ownerId: "menu-1", index: 2, x: 30, y: 60, w: 80, h: 20 } },
    { index: 4, entry: menu.entries[4], rect: { ownerId: "menu-1", index: 4, x: 20, y: 80, w: 70, h: 20 } }
  ];

  assert.equal(
    getMenuEntryMoveTarget({
      menu,
      sourceEntryIndex: 0,
      x: 49,
      y: 25,
      menuBarBottom: 38,
      visibleEntries,
      footerRects: []
    }),
    null
  );

  assert.equal(
    getMenuEntryMoveTarget({
      menu,
      sourceEntryIndex: 1,
      x: 100,
      y: 79,
      menuBarBottom: 38,
      visibleEntries,
      footerRects: []
    }),
    null
  );
});



test("keeps statusbar move indicators at the original 16px line height", () => {
  const rects = [
    { ownerId: "sb-1", index: 0, x: 10, y: 180, w: 80, h: 23 },
    { ownerId: "sb-1", index: 1, x: 90, y: 180, w: 120, h: 23 },
  ];

  assert.deepEqual(
    getLinearTopLevelEntryMoveTarget({
      sourceEntryIndex: 1,
      x: 11,
      y: 190,
      entryRects: rects,
      getSourceLine: index => 300 + index,
      indicatorHeight: 16
    }),
    {
      targetSourceLine: 300,
      placement: "before",
      indicatorRect: { x: 9, y: 180, w: 2, h: 16 },
      indicatorOrientation: "vertical"
    }
  );

  assert.deepEqual(
    getLinearTopLevelEntryMoveTarget({
      sourceEntryIndex: 0,
      x: 216,
      y: 190,
      entryRects: rects,
      getSourceLine: index => 300 + index,
      indicatorHeight: 16
    }),
    {
      targetSourceLine: 301,
      placement: "after",
      indicatorRect: { x: 210, y: 180, w: 2, h: 16 },
      indicatorOrientation: "vertical"
    }
  );
});


test("keeps statusbar move targets inside the visible statusbar band", () => {
  const rects = [
    { ownerId: "sb-1", index: 0, x: 10, y: 180, w: 80, h: 23 },
    { ownerId: "sb-1", index: 1, x: 90, y: 180, w: 120, h: 23 },
  ];

  assert.equal(
    getStatusBarFieldMoveTarget({
      sourceEntryIndex: 1,
      x: 70,
      y: 179,
      entryRects: rects,
      getSourceLine: index => 300 + index,
      indicatorHeight: 16
    }),
    null
  );

  assert.equal(
    getStatusBarFieldMoveTarget({
      sourceEntryIndex: 1,
      x: 70,
      y: 204,
      entryRects: rects,
      getSourceLine: index => 300 + index,
      indicatorHeight: 16
    }),
    null
  );
});

test("uses the original statusbar field body zones for move targets", () => {
  const rects = [
    { ownerId: "sb-1", index: 0, x: 10, y: 180, w: 80, h: 23 },
    { ownerId: "sb-1", index: 1, x: 90, y: 180, w: 120, h: 23 },
    { ownerId: "sb-1", index: 2, x: 210, y: 180, w: 70, h: 23 },
  ];

  assert.deepEqual(
    getStatusBarFieldMoveTarget({
      sourceEntryIndex: 2,
      x: 70,
      y: 190,
      entryRects: rects,
      getSourceLine: index => 300 + index,
      indicatorHeight: 16
    }),
    {
      targetSourceLine: 300,
      placement: "before",
      indicatorRect: { x: 9, y: 180, w: 2, h: 16 },
      indicatorOrientation: "vertical"
    }
  );

  assert.equal(
    getStatusBarFieldMoveTarget({
      sourceEntryIndex: 2,
      x: 70,
      y: 210,
      entryRects: rects,
      getSourceLine: index => 300 + index,
      indicatorHeight: 16
    }),
    null
  );

  assert.deepEqual(
    getStatusBarFieldMoveTarget({
      sourceEntryIndex: 0,
      x: 276,
      y: 190,
      entryRects: rects,
      getSourceLine: index => 300 + index,
      indicatorHeight: 16
    }),
    {
      targetSourceLine: 302,
      placement: "after",
      indicatorRect: { x: 280, y: 180, w: 2, h: 16 },
      indicatorOrientation: "vertical"
    }
  );
});

test("resolves linear top-level entry move targets at item edges", () => {
  const rects = [
    { ownerId: "tb-1", index: 0, x: 10, y: 20, w: 16, h: 16 },
    { ownerId: "tb-1", index: 1, x: 32, y: 20, w: 16, h: 16 },
    { ownerId: "tb-1", index: 2, x: 54, y: 20, w: 10, h: 16 },
  ];
  const sourceLines = [100, 101, 102];

  assert.deepEqual(
    getLinearTopLevelEntryMoveTarget({
      sourceEntryIndex: 2,
      x: 11,
      y: 25,
      entryRects: rects,
      getSourceLine: index => sourceLines[index]
    }),
    {
      targetSourceLine: 100,
      placement: "before",
      indicatorRect: { x: 9, y: 20, w: 2, h: 16 },
      indicatorOrientation: "vertical"
    }
  );

  assert.deepEqual(
    getLinearTopLevelEntryMoveTarget({
      sourceEntryIndex: 0,
      x: 66,
      y: 25,
      entryRects: rects,
      getSourceLine: index => sourceLines[index]
    }),
    {
      targetSourceLine: 102,
      placement: "after",
      indicatorRect: { x: 64, y: 20, w: 2, h: 16 },
      indicatorOrientation: "vertical"
    }
  );
});


test("supports the original toolbar before-indicator offset", () => {
  const rects = [
    { ownerId: "tb-1", index: 0, x: 10, y: 20, w: 16, h: 16 },
    { ownerId: "tb-1", index: 1, x: 32, y: 20, w: 16, h: 16 },
  ];

  assert.deepEqual(
    getLinearTopLevelEntryMoveTarget({
      sourceEntryIndex: 1,
      x: 11,
      y: 25,
      entryRects: rects,
      getSourceLine: index => 100 + index,
      beforeIndicatorOffsetX: -3
    }),
    {
      targetSourceLine: 100,
      placement: "before",
      indicatorRect: { x: 7, y: 20, w: 2, h: 16 },
      indicatorOrientation: "vertical"
    }
  );
});

test("supports the original toolbar after-indicator offset for narrow separator rects", () => {
  const rects = [
    { ownerId: "tb-1", index: 0, x: 10, y: 20, w: 16, h: 16 },
    { ownerId: "tb-1", index: 1, x: 32, y: 20, w: 6, h: 16 },
  ];

  assert.deepEqual(
    getLinearTopLevelEntryMoveTarget({
      sourceEntryIndex: 0,
      x: 40,
      y: 25,
      entryRects: rects,
      getSourceLine: index => 100 + index,
      afterIndicatorOffsetX: 16
    }),
    {
      targetSourceLine: 101,
      placement: "after",
      indicatorRect: { x: 48, y: 20, w: 2, h: 16 },
      indicatorOrientation: "vertical"
    }
  );
});

test("keeps toolbar move targets inside the visible toolbar band", () => {
  const rects = [
    { ownerId: "tb-1", index: 0, x: 10, y: 20, w: 16, h: 16 },
    { ownerId: "tb-1", index: 1, x: 32, y: 20, w: 16, h: 16 },
  ];

  assert.equal(
    getLinearTopLevelEntryMoveTarget({
      sourceEntryIndex: 1,
      x: 11,
      y: 19,
      entryRects: rects,
      getSourceLine: index => 100 + index,
      beforeIndicatorOffsetX: -3,
      afterIndicatorOffsetX: 16
    }),
    null
  );

  assert.equal(
    getLinearTopLevelEntryMoveTarget({
      sourceEntryIndex: 1,
      x: 11,
      y: 37,
      entryRects: rects,
      getSourceLine: index => 100 + index,
      beforeIndicatorOffsetX: -3,
      afterIndicatorOffsetX: 16
    }),
    null
  );
});

test("ignores linear top-level moves onto the source edge", () => {
  const rects = [
    { ownerId: "sb-1", index: 0, x: 10, y: 50, w: 80, h: 18 },
    { ownerId: "sb-1", index: 1, x: 90, y: 50, w: 120, h: 18 },
  ];

  assert.equal(
    getLinearTopLevelEntryMoveTarget({
      sourceEntryIndex: 0,
      x: 11,
      y: 55,
      entryRects: rects,
      getSourceLine: index => 200 + index
    }),
    null
  );

  assert.equal(
    getLinearTopLevelEntryMoveTarget({
      sourceEntryIndex: 0,
      x: 91,
      y: 55,
      entryRects: rects,
      getSourceLine: index => 200 + index,
      isNoopMove: (targetIndex, placement) => targetIndex === 1 && placement === "before"
    }),
    null
  );
});

test("treats toolbar image buttons with iconRaw 0 as empty preview buttons", () => {
  assert.equal(hasToolBarPreviewAssignedImage({ kind: "ToolBarImageButton", iconRaw: "0" }), false);
  assert.equal(hasToolBarPreviewAssignedImage({ kind: "ToolBarImageButton", iconRaw: " ImageID(#Img_Open) " }), true);
  assert.equal(hasToolBarPreviewAssignedImage({ kind: "ToolBarImageButton", iconId: "#Img_Open", iconRaw: "0" }), true);
});

test("shows the generic unselected toolbar frame only for empty command buttons", () => {
  assert.equal(shouldShowToolBarPreviewUnselectedFrame({ kind: "ToolBarImageButton", iconRaw: "0" }, false), true);
  assert.equal(shouldShowToolBarPreviewUnselectedFrame({ kind: "ToolBarImageButton", iconRaw: "ImageID(#Img_Open)" }, false), false);
  assert.equal(shouldShowToolBarPreviewUnselectedFrame({ kind: "ToolBarImageButton", iconRaw: "0" }, true), false);
  assert.equal(shouldShowToolBarPreviewUnselectedFrame({ kind: "ToolBarSeparator" }, false), false);
});


test("treats statusbar imageRaw 0 as the empty fallback-image case", () => {
  assert.equal(hasStatusBarPreviewAssignedImage({ widthRaw: "96", imageRaw: "0" }), false);
  assert.equal(hasStatusBarPreviewAssignedImage({ widthRaw: "96", imageRaw: " #Img_Open " }), true);
  assert.equal(hasStatusBarPreviewAssignedImage({ widthRaw: "96", imageId: "#Img_Open", imageRaw: "0" }), true);
});
