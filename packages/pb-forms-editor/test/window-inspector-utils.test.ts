import test from 'node:test';
import assert from 'node:assert/strict';

import { WINDOW_KNOWN_FLAGS, WINDOW_POSITION_IGNORE_LITERAL, WINDOW_PREVIEW_PAGE_PADDING, buildWindowFlagsExpr, getWindowBaseRowsFieldConfig, getWindowBooleanInspectorState, getWindowColorFieldConfig, getWindowConstantsFieldConfig, getWindowGenerateEventProcFieldConfig, getWindowGenerateEventProcEditState, getWindowHiddenFieldConfig, getWindowDisabledFieldConfig, getWindowEnumValueFieldConfig, getWindowParentAsRawExpression, getWindowParentAsRawExpressionWithOverride, getWindowParentFieldConfig, getWindowParentInspectorValue, getWindowPositionInspectorValue, getWindowPreviewAddIconMetrics, getWindowPreviewBodyDecoration, getWindowPreviewCanvasOrigin, getWindowPreviewCanvasCssSize, getWindowPreviewChromeTopPadding, getWindowPreviewClientBottomPadding, getWindowPreviewClientSidePadding, getWindowPreviewFormScrollbarWidth, getWindowPreviewFrameDecoration, getWindowPreviewFrameStrokeRect, getWindowPreviewMenuBarDecoration, getWindowPreviewMenuFlyoutDecoration, getWindowPreviewMenuRootEntryRect, getWindowPreviewMenuSubmenuIconMetrics, getWindowPreviewStatusBarDecoration, getWindowPreviewScrollContentSize, getWindowPreviewStatusBarProgressDecoration, getWindowPreviewTitleBarDecoration, getWindowPreviewTitleBarHeight, getWindowPreviewTitleBarMetrics, getWindowPreviewTitleButtonAssetKind, getWindowPreviewTitleButtonLayout, getWindowPreviewTitleButtonSize, getWindowPreviewTitleButtons, getWindowPreviewTitleButtonSlots, getWindowPreviewTitleIconSize, getWindowPreviewTitleTextLayout, getWindowPreviewToolBarDecoration, usesWindowPreviewExternalMenuBar, getWindowSelectProcFieldConfig, getWindowVariableInspectorValue, hasWindowPreviewResizeGrip, hasWindowPreviewTitleBar, hasWindowPreviewTitleIcon, parseWindowCustomFlagsInput, parseWindowEventProcInspectorInput, parseWindowParentInspectorInput, parseWindowPositionInspectorInput, parseWindowVariableNameInspectorInput } from '../src/core/window/inspector';
import { parsePbWindowReference } from '../src/core/parser/pb-window-reference';

test('buildWindowFlagsExpr keeps original known window flag order and appends custom flags', () => {
  const expr = buildWindowFlagsExpr([
    '#PB_Window_NoActivate',
    '#PB_Window_SystemMenu',
    '#PB_Window_SizeGadget'
  ], '#PB_Window_CustomBeta | #PB_Window_CustomAlpha');

  assert.equal(
    expr,
    '#PB_Window_SystemMenu | #PB_Window_SizeGadget | #PB_Window_NoActivate | #PB_Window_CustomBeta | #PB_Window_CustomAlpha'
  );
});

test('parseWindowCustomFlagsInput removes known flags and duplicates', () => {
  const flags = parseWindowCustomFlagsInput('#PB_Window_SystemMenu | #PB_Window_CustomA | #PB_Window_CustomA | #PB_Window_CustomB');
  assert.deepEqual(flags, ['#PB_Window_CustomA', '#PB_Window_CustomB']);
});

test('window known flags list matches original PureBasic declaration order', () => {
  assert.deepEqual(WINDOW_KNOWN_FLAGS, [
    '#PB_Window_SystemMenu',
    '#PB_Window_MinimizeGadget',
    '#PB_Window_MaximizeGadget',
    '#PB_Window_SizeGadget',
    '#PB_Window_Invisible',
    '#PB_Window_TitleBar',
    '#PB_Window_Tool',
    '#PB_Window_BorderLess',
    '#PB_Window_ScreenCentered',
    '#PB_Window_WindowCentered',
    '#PB_Window_Maximize',
    '#PB_Window_Minimize',
    '#PB_Window_NoGadgets',
    '#PB_Window_NoActivate'
  ]);
});


test('window inspector field policies match the original FD_SelectWindow row groups', () => {
  assert.deepEqual(getWindowBaseRowsFieldConfig(), {
    visible: true,
    valueEditable: true,
    title: 'Original FD_InitBasicPropGridRows() window rows are always visible for windows.',
  });

  assert.deepEqual(getWindowParentFieldConfig(), {
    visible: true,
    valueEditable: true,
    rawExpressionToggleAvailable: true,
    title: 'Enter the parent window expression. Disable the checkbox to emit WindowID(...); enable it to write the expression raw.',
    rawExpressionTitle: 'When enabled, the parent is written directly as the last OpenWindow(...) argument. When disabled, the editor emits WindowID(...), matching the original default path.',
  });

  assert.deepEqual(getWindowColorFieldConfig(), {
    visible: true,
    valueEditablePolicy: 'color-picker-with-remove',
    rawDisplayEditable: false,
    rawExpressionPolicy: 'preserve-readonly',
    pickerRawFormat: 'RGB_LITERAL',
    title: 'Use the color picker to choose a window color, or Remove to clear it.',
  });

  assert.deepEqual(getWindowEnumValueFieldConfig(false), {
    visible: true,
    valueEditable: true,
    originalStoragePolicy: 'split-explicit-id-from-variable-cell',
    title: 'Edits the explicit numeric ID that the original inspector stores in the Variable row as Name=ID.',
  });

  assert.deepEqual(getWindowEnumValueFieldConfig(true), {
    visible: false,
    valueEditable: true,
    originalStoragePolicy: 'split-explicit-id-from-variable-cell',
    title: 'Edits the explicit numeric ID that the original inspector stores in the Variable row as Name=ID.',
  });

  assert.deepEqual(getWindowGenerateEventProcFieldConfig(), {
    visible: true,
    valueEditable: true,
    title: 'Controls whether the generated window event procedure is emitted for this window.',
  });

  assert.deepEqual(getWindowHiddenFieldConfig(), {
    visible: true,
    checkedValue: '1',
    uncheckedValue: '',
    zeroLinePolicy: 'remove-managed-line',
    title: 'HideWindow(...) is emitted only when checked; unchecked removes the managed line.',
  });

  assert.deepEqual(getWindowDisabledFieldConfig(), {
    visible: true,
    checkedValue: '1',
    uncheckedValue: '',
    zeroLinePolicy: 'remove-managed-line',
    title: 'DisableWindow(...) is emitted only when checked; unchecked removes the managed line.',
  });

  assert.deepEqual(getWindowSelectProcFieldConfig(), {
    visible: true,
    valueEditable: true,
    preservesGridString: true,
    title: 'Choose an existing procedure or type a procedure name.',
    placeholder: 'Type or pick a procedure',
  });

  assert.deepEqual(getWindowConstantsFieldConfig(), {
    visible: true,
    knownFlags: WINDOW_KNOWN_FLAGS,
    customFlagsEditable: true,
    customFlagsKnownFlagPolicy: 'drop-known-flags',
    customFlagsDuplicatePolicy: 'drop-duplicates',
    customFlagsSeparator: ' | ',
    title: 'Window flags are written through the OpenWindow(...) flags argument in original declaration order.',
  });
});

test('window X/Y inspector values prefer #PB_Ignore over the internal sentinel', () => {
  assert.equal(getWindowPositionInspectorValue('#PB_Ignore', 0), WINDOW_POSITION_IGNORE_LITERAL);
  assert.equal(getWindowPositionInspectorValue(undefined, -65535), WINDOW_POSITION_IGNORE_LITERAL);
  assert.equal(getWindowPositionInspectorValue('12', 12), '12');
});

test('window X/Y inspector input accepts integers and #PB_Ignore only', () => {
  assert.deepEqual(parseWindowPositionInspectorInput('#PB_Ignore'), {
    ok: true,
    raw: '#PB_Ignore',
    previewValue: 0,
    isIgnore: true,
  });

  assert.deepEqual(parseWindowPositionInspectorInput('-24'), {
    ok: true,
    raw: '-24',
    previewValue: -24,
    isIgnore: false,
  });

  assert.deepEqual(parseWindowPositionInspectorInput('ScreenCentered'), {
    ok: false,
    error: 'Only integer values or #PB_Ignore are supported.'
  });
});

test('window variable inspector display uses the exact parsed variable without fallback synthesis', () => {
  assert.equal(getWindowVariableInspectorValue('Window_Main'), 'Window_Main');
  assert.equal(getWindowVariableInspectorValue('  Window_Main  '), '  Window_Main  ');
  assert.equal(getWindowVariableInspectorValue(undefined), '');
});

test('window variable inspector input restores the current value when cleared', () => {
  assert.deepEqual(parseWindowVariableNameInspectorInput('', 'Window_0'), {
    ok: false,
    fallbackValue: 'Window_0'
  });

  assert.deepEqual(parseWindowVariableNameInspectorInput('  winMain  ', 'Window_0'), {
    ok: true,
    value: '  winMain  '
  });

  assert.deepEqual(parseWindowVariableNameInspectorInput('', '  Window_0  '), {
    ok: false,
    fallbackValue: '  Window_0  '
  });
});


test('window generate event proc edit state keeps the safe patch boundary visible', () => {
  assert.deepEqual(getWindowGenerateEventProcEditState(false, false, false), {
    valueEditable: true,
    title: 'Controls whether the generated window event procedure is emitted for this window.',
  });

  assert.deepEqual(getWindowGenerateEventProcEditState(true, false, false), {
    valueEditable: true,
    title: 'Controls whether the generated window event procedure is emitted for this window.',
  });

  assert.deepEqual(getWindowGenerateEventProcEditState(true, true, false), {
    valueEditable: false,
    title: 'Cannot disable while a parsed Select EventMenu() block exists. Remove menu/toolbar event bindings first.',
  });

  assert.deepEqual(getWindowGenerateEventProcEditState(true, false, true), {
    valueEditable: false,
    title: 'Cannot disable while Select EventGadget() contains Case branches.',
  });
});

test('window hidden/disabled inspector state prefers parsed booleans and treats raw 0 as unchecked', () => {
  assert.equal(getWindowBooleanInspectorState('0', undefined), false);
  assert.equal(getWindowBooleanInspectorState('1', undefined), true);
  assert.equal(getWindowBooleanInspectorState('HiddenExpr()', undefined), true);
  assert.equal(getWindowBooleanInspectorState('1', false), false);
  assert.equal(getWindowBooleanInspectorState(undefined, true), true);
});


test('window parent inspector displays wrapped and raw parent expressions without the internal marker syntax', () => {
  assert.equal(getWindowParentInspectorValue('WindowID(#FrmParent)', '#FrmParent'), '#FrmParent');
  assert.equal(getWindowParentInspectorValue('ParentWindow', '=ParentWindow'), 'ParentWindow');
  assert.equal(getWindowParentInspectorValue(undefined, '=ParentWindow'), 'ParentWindow');
  assert.equal(getWindowParentInspectorValue(undefined, '#FrmParent'), '#FrmParent');
  assert.equal(getWindowParentInspectorValue(undefined, undefined), '');
});

test('window parent inspector derives the raw-expression toggle from the parsed parent form', () => {
  assert.equal(getWindowParentAsRawExpression('WindowID(#FrmParent)', '#FrmParent'), false);
  assert.equal(getWindowParentAsRawExpression('ParentWindow', '=ParentWindow'), true);
  assert.equal(getWindowParentAsRawExpression(undefined, '=ParentWindow'), true);
  assert.equal(getWindowParentAsRawExpression(undefined, '#FrmParent'), false);
});

test('window parent inspector override keeps the checkbox state even before a parent expression exists', () => {
  assert.equal(getWindowParentAsRawExpressionWithOverride(undefined, undefined, true), true);
  assert.equal(getWindowParentAsRawExpressionWithOverride(undefined, undefined, false), false);
  assert.equal(getWindowParentAsRawExpressionWithOverride('WindowID(#FrmParent)', '#FrmParent', undefined), false);
  assert.equal(getWindowParentAsRawExpressionWithOverride('ParentWindow', '=ParentWindow', undefined), true);
});

test('window parent inspector input preserves the user expression and only toggles WindowID(...) wrapping', () => {
  assert.deepEqual(parseWindowParentInspectorInput('#FrmParent', false), {
    raw: 'WindowID(#FrmParent)',
    storedValue: '#FrmParent'
  });

  assert.deepEqual(parseWindowParentInspectorInput('  #FrmParent  ', false), {
    raw: 'WindowID(  #FrmParent  )',
    storedValue: '  #FrmParent  '
  });

  assert.deepEqual(parseWindowParentInspectorInput('ParentWindow', true), {
    raw: 'ParentWindow',
    storedValue: '=ParentWindow'
  });

  assert.deepEqual(parseWindowParentInspectorInput('', true), {
    raw: '',
    storedValue: undefined
  });
});





test('parseWindowEventProcInspectorInput preserves surrounding whitespace', () => {
  assert.deepEqual(parseWindowEventProcInspectorInput('  HandleMain  '), {
    raw: '  HandleMain  ',
    storedValue: '  HandleMain  ' 
  });

  assert.deepEqual(parseWindowEventProcInspectorInput(''), {
    raw: '',
    storedValue: undefined
  });
});


test('window preview title bar follows the original SystemMenu/TitleBar flag gate', () => {
  assert.equal(hasWindowPreviewTitleBar('#PB_Window_SystemMenu | #PB_Window_SizeGadget'), true);
  assert.equal(hasWindowPreviewTitleBar('#PB_Window_TitleBar'), true);
  assert.equal(hasWindowPreviewTitleBar('#PB_Window_SizeGadget | #PB_Window_BorderLess'), false);
  assert.equal(hasWindowPreviewTitleBar(undefined), false);
});

test('window preview title bar height collapses to zero without SystemMenu or TitleBar', () => {
  assert.equal(getWindowPreviewTitleBarHeight('#PB_Window_SystemMenu', 26), 26);
  assert.equal(getWindowPreviewTitleBarHeight('#PB_Window_TitleBar', 26), 26);
  assert.equal(getWindowPreviewTitleBarHeight('#PB_Window_SizeGadget', 26), 0);
  assert.equal(getWindowPreviewTitleBarHeight(undefined, 26), 0);
});


test('window preview canvas origin keeps the original #Page_Padding base offset', () => {
  assert.equal(WINDOW_PREVIEW_PAGE_PADDING, 10);
  assert.deepEqual(getWindowPreviewCanvasOrigin(0, 0), { x: 10, y: 10 });
  assert.deepEqual(getWindowPreviewCanvasOrigin(12, -3), { x: 22, y: 7 });
});


test('window preview form scrollbar width follows the original grid scrollbar width per platform', () => {
  assert.equal(getWindowPreviewFormScrollbarWidth('macos'), 16);
  assert.equal(getWindowPreviewFormScrollbarWidth('windows'), 18);
  assert.equal(getWindowPreviewFormScrollbarWidth('linux'), 18);
});

test('window preview scroll content size mirrors FD_UpdateScrollbars platform formulas', () => {
  assert.deepEqual(
    getWindowPreviewScrollContentSize({
      platformSkin: 'macos',
      flagsExpr: '#PB_Window_SystemMenu',
      clientWidth: 304,
      clientHeight: 372,
      titleBarHeight: 22,
      menuHeight: 23,
      hasMenu: true,
      hasToolbar: true,
    }),
    { width: 324, height: 461 }
  );

  assert.deepEqual(
    getWindowPreviewScrollContentSize({
      platformSkin: 'windows',
      flagsExpr: '#PB_Window_SystemMenu',
      clientWidth: 304,
      clientHeight: 372,
      titleBarHeight: 29,
      menuHeight: 22,
      hasMenu: true,
      hasToolbar: true,
    }),
    { width: 340, height: 429 }
  );

  assert.deepEqual(
    getWindowPreviewScrollContentSize({
      platformSkin: 'linux',
      flagsExpr: '#PB_Window_TitleBar',
      clientWidth: 304,
      clientHeight: 372,
      titleBarHeight: 28,
      menuHeight: 28,
      hasMenu: true,
      hasToolbar: true,
    }),
    { width: 324, height: 392 }
  );
});

test('window preview canvas css size uses the original scrollbar visibility threshold', () => {
  assert.deepEqual(
    getWindowPreviewCanvasCssSize({
      viewportWidth: 320,
      viewportHeight: 240,
      scrollContentWidth: 303,
      scrollContentHeight: 222,
      scrollbarWidth: 18,
    }),
    {
      width: 321,
      height: 240,
      scrollContentWidth: 303,
      scrollContentHeight: 222,
      showHorizontalScrollbar: true,
      showVerticalScrollbar: false,
    }
  );

  assert.deepEqual(
    getWindowPreviewCanvasCssSize({
      viewportWidth: 320,
      viewportHeight: 240,
      scrollContentWidth: 302,
      scrollContentHeight: 222,
      scrollbarWidth: 18,
    }),
    {
      width: 320,
      height: 240,
      scrollContentWidth: 302,
      scrollContentHeight: 222,
      showHorizontalScrollbar: false,
      showVerticalScrollbar: false,
    }
  );
});


test('window preview title buttons follow the original close/minimize/maximize flag visibility', () => {
  assert.deepEqual(getWindowPreviewTitleButtons('#PB_Window_SystemMenu'), {
    showClose: true,
    showMinimize: false,
    showMaximize: false,
  });

  assert.deepEqual(getWindowPreviewTitleButtons('#PB_Window_TitleBar | #PB_Window_MinimizeGadget'), {
    showClose: true,
    showMinimize: true,
    showMaximize: false,
  });

  assert.deepEqual(getWindowPreviewTitleButtons('#PB_Window_SystemMenu | #PB_Window_MinimizeGadget | #PB_Window_MaximizeGadget'), {
    showClose: true,
    showMinimize: true,
    showMaximize: true,
  });

  assert.deepEqual(getWindowPreviewTitleButtons('#PB_Window_SizeGadget'), {
    showClose: false,
    showMinimize: false,
    showMaximize: false,
  });
});


test('window preview title button slots follow the original per-skin placeholder behavior', () => {
  assert.deepEqual(getWindowPreviewTitleButtonSlots('macos', '#PB_Window_SystemMenu'), [
    { kind: 'close', enabled: true },
    { kind: 'minimize', enabled: false },
    { kind: 'maximize', enabled: false },
  ]);

  assert.deepEqual(getWindowPreviewTitleButtonSlots('windows7', '#PB_Window_SystemMenu | #PB_Window_MinimizeGadget'), [
    { kind: 'minimize', enabled: true },
    { kind: 'maximize', enabled: false },
    { kind: 'close', enabled: true },
  ]);

  assert.deepEqual(getWindowPreviewTitleButtonSlots('windows8', '#PB_Window_SystemMenu | #PB_Window_MaximizeGadget'), [
    { kind: 'maximize', enabled: true },
    { kind: 'close', enabled: true },
  ]);

  assert.deepEqual(getWindowPreviewTitleButtonSlots('linux', '#PB_Window_SystemMenu | #PB_Window_MinimizeGadget | #PB_Window_MaximizeGadget'), [
    { kind: 'minimize', enabled: true },
    { kind: 'maximize', enabled: true },
    { kind: 'close', enabled: true },
  ]);
});


test('window preview menu flyout decoration follows the original fixed white panel style', () => {
  assert.deepEqual(getWindowPreviewMenuFlyoutDecoration(), {
    backgroundStyle: 'white',
    borderStyle: 'light',
    separatorStyle: 'light',
    useSelectedOutline: true,
    showEntryHoverFill: false,
    textColorStyle: 'black',
    outlineColorStyle: 'black',
  });
});

test('window preview body decoration follows the original per-skin draw-window paths', () => {
  assert.deepEqual(getWindowPreviewBodyDecoration('macos', true), {
    backgroundStyle: 'macos-light',
    useRoundedTopFill: false,
    roundedTopRadius: 4,
    showClientBorder: false,
    clientBorderStyle: 'none',
    showBodyOutline: true,
    bodyOutlineStyle: 'macos-light',
  });

  assert.deepEqual(getWindowPreviewBodyDecoration('linux', true), {
    backgroundStyle: 'linux-light',
    useRoundedTopFill: true,
    roundedTopRadius: 6,
    showClientBorder: true,
    clientBorderStyle: 'linux-dark',
    showBodyOutline: false,
    bodyOutlineStyle: 'none',
  });

  assert.deepEqual(getWindowPreviewBodyDecoration('linux', false), {
    backgroundStyle: 'linux-light',
    useRoundedTopFill: false,
    roundedTopRadius: 6,
    showClientBorder: true,
    clientBorderStyle: 'linux-dark',
    showBodyOutline: false,
    bodyOutlineStyle: 'none',
  });

  assert.deepEqual(getWindowPreviewBodyDecoration('windows7', true), {
    backgroundStyle: 'windows7-frame',
    useRoundedTopFill: false,
    roundedTopRadius: 4,
    showClientBorder: true,
    clientBorderStyle: 'windows7-inner',
    showBodyOutline: false,
    bodyOutlineStyle: 'none',
  });

  assert.deepEqual(getWindowPreviewBodyDecoration('windows8', true), {
    backgroundStyle: 'windows8-frame',
    useRoundedTopFill: false,
    roundedTopRadius: 0,
    showClientBorder: true,
    clientBorderStyle: 'windows8-inner',
    showBodyOutline: false,
    bodyOutlineStyle: 'none',
  });
});

test('window preview frame decoration follows the original per-skin outer border path', () => {
  assert.deepEqual(getWindowPreviewFrameDecoration('macos'), {
    borderStyle: 'macos-rounded',
    borderRadius: 4,
    strokeColorStyle: 'macos-dark',
    strokeAlpha: 1,
  });

  assert.deepEqual(getWindowPreviewFrameDecoration('linux'), {
    borderStyle: 'none',
    borderRadius: 0,
    strokeColorStyle: 'focus',
    strokeAlpha: 0,
  });

  assert.deepEqual(getWindowPreviewFrameDecoration('windows7'), {
    borderStyle: 'windows7-rounded',
    borderRadius: 4,
    strokeColorStyle: 'windows7-dark',
    strokeAlpha: 1,
  });

  assert.deepEqual(getWindowPreviewFrameDecoration('windows8'), {
    borderStyle: 'default',
    borderRadius: 0,
    strokeColorStyle: 'windows8-blue',
    strokeAlpha: 1,
  });
});

test('window selection overlay uses the same stroke rect as the rendered outer frame on rounded skins', () => {
  assert.deepEqual(getWindowPreviewFrameStrokeRect('macos', { x: 10, y: 20, w: 100, h: 80 }), {
    x: 9.5,
    y: 19.5,
    w: 101,
    h: 81,
  });

  assert.deepEqual(getWindowPreviewFrameStrokeRect('windows7', { x: 10, y: 20, w: 100, h: 80 }), {
    x: 9.5,
    y: 19.5,
    w: 101,
    h: 81,
  });

  assert.deepEqual(getWindowPreviewFrameStrokeRect('windows8', { x: 10, y: 20, w: 100, h: 80 }), {
    x: 10.5,
    y: 20.5,
    w: 99,
    h: 79,
  });
});


test('window preview title buttons use the original macOS and Linux raster assets only on those skins', () => {
  assert.equal(getWindowPreviewTitleButtonAssetKind('macos', 'close', true), 'macClose');
  assert.equal(getWindowPreviewTitleButtonAssetKind('macos', 'minimize', true), 'macMinimize');
  assert.equal(getWindowPreviewTitleButtonAssetKind('macos', 'maximize', true), 'macMaximize');
  assert.equal(getWindowPreviewTitleButtonAssetKind('macos', 'minimize', false), 'macDisabled');
  assert.equal(getWindowPreviewTitleButtonAssetKind('macos', 'maximize', false), 'macDisabled');
  assert.equal(getWindowPreviewTitleButtonAssetKind('linux', 'close', true), 'linuxClose');
  assert.equal(getWindowPreviewTitleButtonAssetKind('linux', 'minimize', true), 'linuxMinimize');
  assert.equal(getWindowPreviewTitleButtonAssetKind('linux', 'maximize', true), 'linuxMaximize');
  assert.equal(getWindowPreviewTitleButtonAssetKind('linux', 'minimize', false), null);
  assert.equal(getWindowPreviewTitleButtonAssetKind('windows7', 'close', true), null);
});

test('window preview title button layout follows the original per-skin alignment', () => {
  assert.deepEqual(getWindowPreviewTitleButtonLayout('macos', '#PB_Window_SystemMenu'), {
    buttonSide: 'left',
    titleAlignment: 'center',
    slots: [
      { kind: 'close', enabled: true },
      { kind: 'minimize', enabled: false },
      { kind: 'maximize', enabled: false },
    ],
  });

  assert.deepEqual(getWindowPreviewTitleButtonLayout('windows7', '#PB_Window_SystemMenu | #PB_Window_MinimizeGadget'), {
    buttonSide: 'right',
    titleAlignment: 'left',
    slots: [
      { kind: 'minimize', enabled: true },
      { kind: 'maximize', enabled: false },
      { kind: 'close', enabled: true },
    ],
  });

  assert.deepEqual(getWindowPreviewTitleButtonLayout('windows8', '#PB_Window_SystemMenu | #PB_Window_MinimizeGadget'), {
    buttonSide: 'right',
    titleAlignment: 'center',
    slots: [
      { kind: 'minimize', enabled: true },
      { kind: 'close', enabled: true },
    ],
  });

  assert.deepEqual(getWindowPreviewTitleButtonLayout('linux', '#PB_Window_SystemMenu | #PB_Window_MaximizeGadget'), {
    buttonSide: 'left',
    titleAlignment: 'left',
    slots: [
      { kind: 'maximize', enabled: true },
      { kind: 'close', enabled: true },
    ],
  });
});


test('window preview title bar decoration follows the original macOS toolbar split', () => {
  assert.deepEqual(getWindowPreviewTitleBarDecoration('macos', false), {
    backgroundStyle: 'macos-compact',
    buttonStyle: 'macos-circles',
    showFrameBorder: false,
    showBottomSeparator: true,
    showExtraBottomSeparator: true,
    drawShadowedTitle: true,
    useLightForeground: false,
  });

  assert.deepEqual(getWindowPreviewTitleBarDecoration('macos', true), {
    backgroundStyle: 'macos-toolbar',
    buttonStyle: 'macos-circles',
    showFrameBorder: false,
    showBottomSeparator: true,
    showExtraBottomSeparator: false,
    drawShadowedTitle: true,
    useLightForeground: false,
  });

  assert.deepEqual(getWindowPreviewTitleBarDecoration('linux', false), {
    backgroundStyle: 'linux-dark',
    buttonStyle: 'linux-glyphs',
    showFrameBorder: false,
    showBottomSeparator: false,
    showExtraBottomSeparator: false,
    drawShadowedTitle: false,
    useLightForeground: true,
  });

  assert.deepEqual(getWindowPreviewTitleBarDecoration('windows8', true), {
    backgroundStyle: 'default',
    buttonStyle: 'default',
    showFrameBorder: true,
    showBottomSeparator: false,
    showExtraBottomSeparator: false,
    drawShadowedTitle: false,
    useLightForeground: false,
  });
});

test('window preview title bar metrics follow the original per-skin image offsets and sizes', () => {
  assert.deepEqual(getWindowPreviewTitleBarMetrics('macos'), {
    buttonInsetX: 9,
    buttonOffsetY: 5,
    buttonGap: 9,
    titleOffsetY: 4,
    iconInsetX: 8,
    iconOffsetY: 8,
  });

  assert.deepEqual(getWindowPreviewTitleButtonSize('macos', 'close', { width: 18, height: 18 }), {
    width: 12,
    height: 14,
  });

  assert.deepEqual(getWindowPreviewTitleBarMetrics('linux'), {
    buttonInsetX: 11,
    buttonOffsetY: 4,
    buttonGap: 0,
    titleOffsetY: 6,
    iconInsetX: 8,
    iconOffsetY: 8,
  });

  assert.deepEqual(getWindowPreviewTitleButtonSize('linux', 'maximize', { width: 18, height: 18 }), {
    width: 17,
    height: 19,
  });

  assert.deepEqual(getWindowPreviewTitleBarMetrics('windows7'), {
    buttonInsetX: 8,
    buttonOffsetY: -1,
    buttonGap: 0,
    titleOffsetY: 8,
    iconInsetX: 8,
    iconOffsetY: 8,
  });

  assert.deepEqual(getWindowPreviewTitleButtonSize('windows7', 'close', { width: 18, height: 18 }), {
    width: 47,
    height: 20,
  });

  assert.deepEqual(getWindowPreviewTitleButtonSize('windows7', 'minimize', { width: 18, height: 18 }), {
    width: 29,
    height: 20,
  });

  assert.deepEqual(getWindowPreviewTitleButtonSize('windows8', 'maximize', { width: 18, height: 18 }), {
    width: 27,
    height: 20,
  });

  assert.deepEqual(getWindowPreviewTitleButtonSize('windows8', 'close', { width: 18, height: 18 }), {
    width: 45,
    height: 20,
  });

  assert.deepEqual(getWindowPreviewTitleIconSize('windows8', { width: 16, height: 16 }), {
    width: 16,
    height: 14,
  });
});

test('window preview toolbar decoration follows the original per-skin toolbar block', () => {
  assert.deepEqual(getWindowPreviewToolBarDecoration('macos'), {
    backgroundStyle: 'macos-gradient',
    showFrameBorder: false,
    showBottomSeparator: true,
    useDarkBottomSeparator: true,
    separatorColorStyle: 'none',
    showUnselectedEntryFrame: false,
    selectedOutlineColorStyle: 'black',
    itemInsetX: 7,
    itemInsetY: 3,
  });

  assert.deepEqual(getWindowPreviewToolBarDecoration('windows8'), {
    backgroundStyle: 'windows-light',
    showFrameBorder: false,
    showBottomSeparator: false,
    useDarkBottomSeparator: false,
    separatorColorStyle: 'toolbar-dark',
    showUnselectedEntryFrame: false,
    selectedOutlineColorStyle: 'black',
    itemInsetX: 5,
    itemInsetY: 3,
  });

  assert.deepEqual(getWindowPreviewToolBarDecoration('linux'), {
    backgroundStyle: 'linux-light',
    showFrameBorder: false,
    showBottomSeparator: false,
    useDarkBottomSeparator: false,
    separatorColorStyle: 'toolbar-dark',
    showUnselectedEntryFrame: false,
    selectedOutlineColorStyle: 'black',
    itemInsetX: 13,
    itemInsetY: 3,
  });
});

test('window preview status bar decoration follows the original per-skin status bar block', () => {
  assert.deepEqual(getWindowPreviewStatusBarDecoration('macos'), {
    backgroundStyle: 'macos-gradient',
    showRoundedBackground: true,
    showTopSeparator: true,
    topSeparatorStyle: 'macos-dark',
    showFieldSeparators: false,
    textColorStyle: 'black',
    selectedOutlineColorStyle: 'black',
    fieldInsetX: 7,
    fieldInsetY: 4,
    widthAdjustment: 14,
  });

  assert.deepEqual(getWindowPreviewStatusBarDecoration('windows8'), {
    backgroundStyle: 'transparent',
    showRoundedBackground: false,
    showTopSeparator: true,
    topSeparatorStyle: 'light',
    showFieldSeparators: true,
    textColorStyle: 'black',
    selectedOutlineColorStyle: 'black',
    fieldInsetX: 7,
    fieldInsetY: 4,
    widthAdjustment: 14,
  });

  assert.deepEqual(getWindowPreviewStatusBarDecoration('linux'), {
    backgroundStyle: 'transparent',
    showRoundedBackground: false,
    showTopSeparator: true,
    topSeparatorStyle: 'light',
    showFieldSeparators: true,
    textColorStyle: 'black',
    selectedOutlineColorStyle: 'black',
    fieldInsetX: 15,
    fieldInsetY: 4,
    widthAdjustment: 14,
  });
});

test('window preview status bar progress decoration keeps the local 2px side padding per skin', () => {
  assert.deepEqual(getWindowPreviewStatusBarProgressDecoration('windows8'), {
    trackShape: 'rect',
    trackRadius: 0,
    trackInsetX: 2,
    trackInsetY: 5,
    trackColorStyle: 'windows8',
    fillColorStyle: 'windows8',
    borderColorStyle: 'windows8',
  });

  assert.deepEqual(getWindowPreviewStatusBarProgressDecoration('windows7'), {
    trackShape: 'rounded',
    trackRadius: 3,
    trackInsetX: 2,
    trackInsetY: 5,
    trackColorStyle: 'default',
    fillColorStyle: 'default',
    borderColorStyle: 'default',
  });

  assert.deepEqual(getWindowPreviewStatusBarProgressDecoration('macos'), {
    trackShape: 'rounded',
    trackRadius: 3,
    trackInsetX: 2,
    trackInsetY: 5,
    trackColorStyle: 'default',
    fillColorStyle: 'default',
    borderColorStyle: 'default',
  });
});

test('window preview title icon follows the original Windows title-bar path only', () => {
  assert.equal(hasWindowPreviewTitleIcon('windows', '#PB_Window_SystemMenu'), true);
  assert.equal(hasWindowPreviewTitleIcon('windows', '#PB_Window_TitleBar'), true);
  assert.equal(hasWindowPreviewTitleIcon('linux', '#PB_Window_SystemMenu'), false);
  assert.equal(hasWindowPreviewTitleIcon('macos', '#PB_Window_SystemMenu'), false);
  assert.equal(hasWindowPreviewTitleIcon('windows', '#PB_Window_SizeGadget'), false);
  assert.equal(hasWindowPreviewTitleIcon(undefined, '#PB_Window_SystemMenu'), false);
});

test('window preview resize grip follows the original always-drawn platform path', () => {
  assert.equal(hasWindowPreviewResizeGrip('windows'), true);
  assert.equal(hasWindowPreviewResizeGrip('linux'), true);
  assert.equal(hasWindowPreviewResizeGrip('macos'), true);
  assert.equal(hasWindowPreviewResizeGrip(undefined), false);
});

test('window preview client side padding follows the original Windows border width only', () => {
  assert.equal(getWindowPreviewClientSidePadding('windows', 8), 8);
  assert.equal(getWindowPreviewClientSidePadding('linux', 8), 0);
  assert.equal(getWindowPreviewClientSidePadding('macos', 8), 0);
  assert.equal(getWindowPreviewClientSidePadding(undefined, 8), 0);
});


test('window preview chrome top padding keeps the original 8px Windows inset when no title bar is present', () => {
  assert.equal(getWindowPreviewChromeTopPadding('windows', '#PB_Window_SystemMenu', 26, 8), 26);
  assert.equal(getWindowPreviewChromeTopPadding('windows', '#PB_Window_SizeGadget', 26, 8), 8);
  assert.equal(getWindowPreviewChromeTopPadding('windows', undefined, 26, 8), 8);
  assert.equal(getWindowPreviewChromeTopPadding('linux', '#PB_Window_SizeGadget', 26, 8), 0);
  assert.equal(getWindowPreviewChromeTopPadding('macos', undefined, 26, 8), 0);
});


test('window preview configurable paddings clamp negative values and keep caller-provided Windows metrics', () => {
  assert.equal(getWindowPreviewClientSidePadding('windows', 12.9), 12);
  assert.equal(getWindowPreviewClientBottomPadding('windows', 6.2), 6);
  assert.equal(getWindowPreviewChromeTopPadding('windows', '#PB_Window_SizeGadget', 26, -4), 0);
});

test('window preview client bottom padding follows the original Windows bottom frame only', () => {
  assert.equal(getWindowPreviewClientBottomPadding('windows', 8), 8);
  assert.equal(getWindowPreviewClientBottomPadding('linux', 8), 0);
  assert.equal(getWindowPreviewClientBottomPadding('macos', 8), 0);
  assert.equal(getWindowPreviewClientBottomPadding(undefined, 8), 0);
});


test('macOS window preview title text layout centers across the full window width like the original DrawText path', () => {
  assert.deepEqual(getWindowPreviewTitleTextLayout({
    osSkin: 'macos',
    titleAlignment: 'center',
    titleLeft: 70,
    titleRight: 290,
    windowX: 40,
    windowWidth: 320,
    titleWidth: 80,
  }), {
    clipLeft: 40,
    clipRight: 360,
    titleX: 160,
  });

  assert.deepEqual(getWindowPreviewTitleTextLayout({
    osSkin: 'windows8',
    titleAlignment: 'center',
    titleLeft: 70,
    titleRight: 290,
    windowX: 40,
    windowWidth: 320,
    titleWidth: 80,
  }), {
    clipLeft: 70,
    clipRight: 290,
    titleX: 140,
  });
});

test('macOS preview uses an external menu bar band while other skins keep it inside the window chrome', () => {
  assert.equal(usesWindowPreviewExternalMenuBar('macos'), true);
  assert.equal(usesWindowPreviewExternalMenuBar('windows7'), false);
  assert.equal(usesWindowPreviewExternalMenuBar('windows8'), false);
  assert.equal(usesWindowPreviewExternalMenuBar('linux'), false);
});

test('window preview menu bar decoration follows the original per-skin menu block', () => {
  assert.deepEqual(getWindowPreviewMenuBarDecoration('macos'), {
    backgroundStyle: 'macos-gradient',
    showTopSeparator: true,
    topSeparatorStyle: 'macos-dark',
    bottomSeparatorStyle: 'macos-dark',
    itemInsetX: 20,
    itemInsetY: 4,
    itemSpacing: 20,
    useSelectedOutline: true,
    textColorStyle: 'black',
    outlineColorStyle: 'black',
  });

  assert.deepEqual(getWindowPreviewMenuBarDecoration('windows7'), {
    backgroundStyle: 'windows7-layered',
    showTopSeparator: false,
    topSeparatorStyle: 'none',
    bottomSeparatorStyle: 'windows7-triple',
    itemInsetX: 7,
    itemInsetY: 2,
    itemSpacing: 7,
    useSelectedOutline: true,
    textColorStyle: 'black',
    outlineColorStyle: 'black',
  });

  assert.deepEqual(getWindowPreviewMenuBarDecoration('windows8'), {
    backgroundStyle: 'windows8-light',
    showTopSeparator: false,
    topSeparatorStyle: 'none',
    bottomSeparatorStyle: 'windows8-light',
    itemInsetX: 7,
    itemInsetY: 2,
    itemSpacing: 7,
    useSelectedOutline: true,
    textColorStyle: 'black',
    outlineColorStyle: 'black',
  });

  assert.deepEqual(getWindowPreviewMenuBarDecoration('linux'), {
    backgroundStyle: 'linux-light',
    showTopSeparator: false,
    topSeparatorStyle: 'none',
    bottomSeparatorStyle: 'linux-light',
    itemInsetX: 15,
    itemInsetY: 2,
    itemSpacing: 7,
    useSelectedOutline: true,
    textColorStyle: 'black',
    outlineColorStyle: 'black',
  });
});


test('window preview add and submenu icon metrics follow the original image assets', () => {
  assert.deepEqual(getWindowPreviewAddIconMetrics(), {
    width: 16,
    height: 16,
  });

  assert.deepEqual(getWindowPreviewMenuSubmenuIconMetrics(), {
    width: 9,
    height: 10,
    offsetRight: 20,
    offsetY: 4,
  });
});


test('window preview root menu entry rect keeps the conscious menu-bar-height selection geometry and original trailing menu spacing', () => {
  assert.deepEqual(getWindowPreviewMenuRootEntryRect(15, 2, 54, 22), {
    x: 14,
    y: 1,
    w: 61,
    h: 18,
  });

  assert.deepEqual(getWindowPreviewMenuRootEntryRect(20, 4, 32.2, 23), {
    x: 19,
    y: 3,
    w: 40,
    h: 19,
  });

  assert.deepEqual(getWindowPreviewMenuRootEntryRect(20, 4, 32.2, 23, 20), {
    x: 19,
    y: 3,
    w: 53,
    h: 19,
  });
});


test('parsePbWindowReference preserves the raw inner expression and offers a normalized inner reference', () => {
  assert.deepEqual(parsePbWindowReference('WindowID(#FrmParent)'), {
    innerRaw: '#FrmParent',
    normalizedInner: '#FrmParent'
  });

  assert.deepEqual(parsePbWindowReference('WindowID(  #FrmParent  )'), {
    innerRaw: '  #FrmParent  ',
    normalizedInner: '#FrmParent'
  });

  assert.equal(parsePbWindowReference('ParentWindow'), undefined);
});
