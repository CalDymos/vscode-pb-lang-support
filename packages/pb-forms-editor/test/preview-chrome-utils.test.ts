import test from "node:test";
import assert from "node:assert/strict";
import {
  getGadgetContentRect,
  getContainerContentRect,
  getContainerChromeHitZone,
  isContainerChromeGadgetKind,
  getRectHandlePoints,
  clampRect,
  applyResize,
  getCanvasMenuBarRect,
  getMenuBarRect,
  getPanelTabLayouts,
  getPanelTabVisibleHitRect,
  getPanelContentRect,
  getPanelHeaderRect,
  clampScrollAreaOffset,
  getScrollAreaHorizontalBarRect,
  getScrollAreaChromeHitZone,
  getScrollAreaHorizontalThumbRect,
  getScrollAreaMaxOffsetX,
  getScrollAreaMaxOffsetY,
  getScrollAreaVerticalBarRect,
  getScrollAreaVerticalThumbRect,
  getSplitterBarRect,
  getSplitterChromeHitZone,
  getSplitterPaneRect,
  getSplitterResolvedPosition,
  getScrollAreaViewportRect,
  getStatusBarRect,
  getStatusBarAlignedX,
  getWindowClientSurfaceRects,
  getWindowPreviewFrameRect,
  getWindowPreviewResizeButtonRect,
  hitWindowPreviewResizeButton,
  hitHandlePoints,
  getToolBarRect,
  getWindowContentRect,
  getWindowChromeLayout,
  intersectRect,
  isPointInTitleBar,
  isPointInWindowRect,
  isPointOnRectBorder,
  rectContainsPoint,
  resolvePanelActiveItem,
  resolvePreviewChromeMetrics,
  resolvePreviewChromeMetricsForOsSkin,
  toWindowGlobalPoint,
  toWindowLocalPoint,
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
  type PreviewChromeMetrics,
  type PreviewRect
} from "../src/core/preview/chrome";

const METRICS: PreviewChromeMetrics = {
  titleBarHeight: 29,
  panelHeight: 22,
  scrollAreaWidth: 20,
  splitterWidth: 9,
  menuHeight: 22,
  toolBarHeight: 24,
  statusBarHeight: 23
};

const RECT: PreviewRect = { x: 10, y: 20, w: 120, h: 80 };

test("detects points on rect border but not in the inner area", () => {
  assert.equal(isPointOnRectBorder(RECT, 10, 40), true);
  assert.equal(isPointOnRectBorder(RECT, 14, 24), true);
  assert.equal(isPointOnRectBorder(RECT, 60, 60), false);
  assert.equal(isPointOnRectBorder(RECT, 200, 200), false);
});

test("computes scrollarea chrome bars inside the original inner frame", () => {
  const vertical = getScrollAreaVerticalBarRect(RECT, METRICS);
  const horizontal = getScrollAreaHorizontalBarRect(RECT, METRICS);
  const overlap = intersectRect(vertical, horizontal);

  assert.deepEqual(vertical, { x: 108, y: 21, w: 20, h: 57 });
  assert.deepEqual(horizontal, { x: 11, y: 78, w: 97, h: 20 });
  assert.equal(overlap.w, 0);
  assert.equal(overlap.h, 0);
});

test("computes panel header and content rects from the same original Panel_Height basis", () => {
  assert.deepEqual(getPanelHeaderRect(RECT, METRICS), { x: 10, y: 20, w: 120, h: 22 });
  assert.deepEqual(getPanelContentRect(RECT, METRICS), { x: 10, y: 42, w: 120, h: 58 });
  assert.deepEqual(getGadgetContentRect("PanelGadget", RECT, METRICS), { x: 10, y: 42, w: 120, h: 58 });
});

test("computes gadget content rects for container-like parents", () => {
  assert.deepEqual(getContainerContentRect("PanelGadget", RECT, METRICS), { x: 10, y: 42, w: 120, h: 58 });
  assert.deepEqual(getContainerContentRect("ScrollAreaGadget", RECT, METRICS), { x: 10, y: 20, w: 100, h: 60 });
  assert.deepEqual(getContainerContentRect("ContainerGadget", RECT, METRICS), RECT);
  assert.deepEqual(getContainerContentRect("FrameGadget", RECT, METRICS), RECT);

  assert.deepEqual(getGadgetContentRect("ScrollAreaGadget", RECT, METRICS), { x: 10, y: 20, w: 100, h: 60 });
  assert.deepEqual(getGadgetContentRect("StringGadget", RECT, METRICS), RECT);
});

test("classifies original container chrome hit zones without changing content hits", () => {
  assert.equal(isContainerChromeGadgetKind("ContainerGadget"), true);
  assert.equal(isContainerChromeGadgetKind("PanelGadget"), true);
  assert.equal(isContainerChromeGadgetKind("ScrollAreaGadget"), true);
  assert.equal(isContainerChromeGadgetKind("FrameGadget"), true);
  assert.equal(isContainerChromeGadgetKind("ButtonGadget"), false);

  assert.equal(getContainerChromeHitZone("PanelGadget", RECT, METRICS, 60, 30), "panelHeader");
  assert.equal(getContainerChromeHitZone("PanelGadget", RECT, METRICS, 10, 60), "containerBorder");
  assert.equal(getContainerChromeHitZone("PanelGadget", RECT, METRICS, 60, 60), null);
  assert.equal(getContainerChromeHitZone("ScrollAreaGadget", RECT, METRICS, 10, 60), "containerBorder");
  assert.equal(getContainerChromeHitZone("FrameGadget", RECT, METRICS, 60, 60), null);
  assert.equal(getContainerChromeHitZone("ButtonGadget", RECT, METRICS, 10, 60), null);
});


test("classifies scrollarea drag chrome using the drawn scrollbar tracks", () => {
  assert.equal(getScrollAreaChromeHitZone(RECT, METRICS, 110, 40), "scrollAreaVBar");
  assert.equal(getScrollAreaChromeHitZone(RECT, METRICS, 40, 80), "scrollAreaHBar");

  // FD_LeftDown() uses broader ScrollAreaW thresholds, but the preview keeps
  // the existing precise visual-track hit zones to avoid grabbing content area.
  assert.equal(getScrollAreaChromeHitZone(RECT, METRICS, 109, 80), null);
  assert.equal(getScrollAreaChromeHitZone(RECT, METRICS, 110, 79), null);

  const clipped: PreviewRect = { x: 10, y: 20, w: 97, h: 58 };
  assert.equal(getScrollAreaChromeHitZone(RECT, METRICS, 110, 40, clipped), null);
});

test("computes scrollarea viewport rect from chrome metrics", () => {
  assert.deepEqual(getScrollAreaViewportRect(RECT, METRICS), { x: 10, y: 20, w: 100, h: 60 });
});

test("clamps scrollarea offsets against the available viewport range", () => {
  assert.deepEqual(clampScrollAreaOffset({ x: 999, y: 999 }, RECT, METRICS, 240, 180), { x: 140, y: 120 });
  assert.deepEqual(clampScrollAreaOffset({ x: -5, y: -10 }, RECT, METRICS, 240, 180), { x: 0, y: 0 });
});

test("computes a vertical splitter bar from state and width", () => {
  const bar = getSplitterBarRect(RECT, true, METRICS.splitterWidth, 30);
  assert.deepEqual(bar, { x: 40, y: 20, w: 9, h: 80 });
  assert.equal(rectContainsPoint(bar, 44, 50), true);
  assert.equal(rectContainsPoint(bar, 70, 50), false);
});

test("computes a horizontal splitter bar and clamps oversized state", () => {
  const bar = getSplitterBarRect(RECT, false, METRICS.splitterWidth, 999);
  assert.deepEqual(bar, { x: 10, y: 91, w: 120, h: 9 });
  assert.equal(rectContainsPoint(bar, 60, 95), true);
  assert.equal(rectContainsPoint(bar, 60, 70), false);
});


test("detects splitter chrome hits with border precedence over the bar", () => {
  assert.equal(getSplitterChromeHitZone(RECT, true, METRICS, 30, 10, 50), "containerBorder");
  assert.equal(getSplitterChromeHitZone(RECT, true, METRICS, 30, 44, 21), "containerBorder");
  assert.equal(getSplitterChromeHitZone(RECT, true, METRICS, 30, 44, 50), "splitterBar");
  assert.equal(getSplitterChromeHitZone(RECT, true, METRICS, 30, 70, 50), null);

  const clippedBeforeBar: PreviewRect = { x: 10, y: 20, w: 29, h: 80 };
  assert.equal(getSplitterChromeHitZone(RECT, true, METRICS, 30, 44, 50, clippedBeforeBar), null);
});


test("computes splitter panes from the original FD_UpdateSplitter geometry", () => {
  assert.equal(getSplitterResolvedPosition(RECT, true, METRICS.splitterWidth, 30), 30);
  assert.deepEqual(
    getSplitterPaneRect(RECT, true, METRICS.splitterWidth, 30, "first"),
    { x: 10, y: 20, w: 30, h: 80 }
  );
  assert.deepEqual(
    getSplitterPaneRect(RECT, true, METRICS.splitterWidth, 30, "second"),
    { x: 49, y: 20, w: 81, h: 80 }
  );

  assert.deepEqual(
    getSplitterPaneRect(RECT, false, METRICS.splitterWidth, 35, "first"),
    { x: 10, y: 20, w: 120, h: 35 }
  );
  assert.deepEqual(
    getSplitterPaneRect(RECT, false, METRICS.splitterWidth, 35, "second"),
    { x: 10, y: 64, w: 120, h: 36 }
  );
});

test("keeps the safer preview clamp around invalid splitter states", () => {
  assert.equal(getSplitterResolvedPosition(RECT, true, METRICS.splitterWidth, -25), 0);
  assert.equal(getSplitterResolvedPosition(RECT, true, METRICS.splitterWidth, 999), 111);

  assert.deepEqual(
    getSplitterPaneRect(RECT, true, METRICS.splitterWidth, 999, "second"),
    { x: 130, y: 20, w: 0, h: 80 }
  );
});


test("computes scrollarea thumb rects from inner size and offset", () => {
  assert.equal(getScrollAreaMaxOffsetX(RECT, METRICS, 240), 140);
  assert.equal(getScrollAreaMaxOffsetY(RECT, METRICS, 180), 120);

  const verticalThumb = getScrollAreaVerticalThumbRect(RECT, METRICS, 180, 60);
  const horizontalThumb = getScrollAreaHorizontalThumbRect(RECT, METRICS, 240, 70);

  assert.deepEqual(verticalThumb, { x: 108, y: 40, w: 20, h: 19 });
  assert.deepEqual(horizontalThumb, { x: 40, y: 78, w: 40, h: 20 });
});

test("computes top-level menu, toolbar and statusbar rects from window chrome", () => {
  const windowRect: PreviewRect = { x: 40, y: 50, w: 320, h: 220 };

  assert.deepEqual(getMenuBarRect(windowRect, METRICS.titleBarHeight, METRICS), { x: 40, y: 79, w: 320, h: 22 });
  assert.deepEqual(getToolBarRect(windowRect, METRICS.titleBarHeight, true, METRICS), { x: 40, y: 101, w: 320, h: 24 });
  assert.deepEqual(getStatusBarRect(windowRect, METRICS), { x: 40, y: 247, w: 320, h: 23 });
});

test("computes the window content rect below title, menu and toolbar and above statusbar", () => {
  const windowRect: PreviewRect = { x: 0, y: 0, w: 320, h: 220 };
  const content = getWindowContentRect(windowRect, METRICS.titleBarHeight, true, true, true, METRICS);

  assert.deepEqual(content, { x: 0, y: 75, w: 320, h: 122 });
});

test("computes combined window chrome layout from title and top-level bands", () => {
  const windowRect: PreviewRect = { x: 40, y: 50, w: 320, h: 220 };
  const layout = getWindowChromeLayout(windowRect, METRICS.titleBarHeight, true, true, true, METRICS);

  assert.deepEqual(layout, {
    menuBarRect: { x: 40, y: 79, w: 320, h: 22 },
    toolBarRect: { x: 40, y: 101, w: 320, h: 24 },
    statusBarRect: { x: 40, y: 247, w: 320, h: 23 },
    contentRect: { x: 40, y: 125, w: 320, h: 122 }
  });
});

test("computes macOS menu bar chrome outside the rounded window body", () => {
  const macMetrics = resolvePreviewChromeMetricsForOsSkin("macos");
  const windowRect: PreviewRect = { x: 40, y: 73, w: 320, h: 220 };

  assert.deepEqual(getMenuBarRect(windowRect, macMetrics.titleBarHeight, macMetrics, 0, true), { x: 40, y: 50, w: 320, h: 23 });
  assert.deepEqual(getToolBarRect(windowRect, macMetrics.titleBarHeight, true, macMetrics, 0, true), { x: 40, y: 95, w: 320, h: 36 });
  assert.deepEqual(getWindowContentRect(windowRect, macMetrics.titleBarHeight, true, true, true, macMetrics, 0, 0, true), { x: 40, y: 131, w: 320, h: 138 });
  assert.deepEqual(getWindowChromeLayout(windowRect, macMetrics.titleBarHeight, true, true, true, macMetrics, 0, 0, true), {
    menuBarRect: { x: 40, y: 50, w: 320, h: 23 },
    toolBarRect: { x: 40, y: 95, w: 320, h: 36 },
    statusBarRect: { x: 40, y: 269, w: 320, h: 24 },
    contentRect: { x: 40, y: 131, w: 320, h: 138 }
  });
});

test("computes the macOS external menu band across the full preview canvas width", () => {
  assert.deepEqual(getCanvasMenuBarRect(480, METRICS), { x: 0, y: 0, w: 480, h: 22 });
});

test("computes combined window chrome layout with Windows client-side and bottom insets", () => {
  const windowRect: PreviewRect = { x: 40, y: 50, w: 320, h: 220 };
  const layout = getWindowChromeLayout(windowRect, METRICS.titleBarHeight, true, true, true, METRICS, 8, 8);

  assert.deepEqual(layout, {
    menuBarRect: { x: 48, y: 79, w: 304, h: 22 },
    toolBarRect: { x: 48, y: 101, w: 304, h: 24 },
    statusBarRect: { x: 48, y: 239, w: 304, h: 23 },
    contentRect: { x: 48, y: 125, w: 304, h: 114 }
  });
});

test("computes the Windows client surface fill and border rects from chrome and bottom padding", () => {
  const windowRect: PreviewRect = { x: 40, y: 50, w: 320, h: 220 };
  const rects = getWindowClientSurfaceRects(windowRect, METRICS.titleBarHeight, 8, 8);

  assert.deepEqual(rects, {
    fillRect: { x: 48, y: 79, w: 304, h: 183 },
    borderRect: { x: 47, y: 78, w: 306, h: 185 }
  });
});

test("computes the Windows preview frame from the stored client size", () => {
  const frameRect = getWindowPreviewFrameRect({ x: 10, y: 10 }, 304, 372, 8, 8, 8);
  const layout = getWindowChromeLayout(frameRect, 8, false, false, false, METRICS, 8, 8);

  assert.deepEqual(frameRect, { x: 10, y: 10, w: 320, h: 388 });
  assert.deepEqual(layout.contentRect, { x: 18, y: 18, w: 304, h: 372 });
});


test("computes the original window resize button rect outside the preview frame", () => {
  const frameRect = getWindowPreviewFrameRect({ x: 10, y: 10 }, 304, 372, 8, 8, 8);

  assert.deepEqual(getWindowPreviewResizeButtonRect(frameRect), { x: 328, y: 396, w: 8, h: 8 });
});


test("computes the macOS preview frame with toolbar height outside the stored client height", () => {
  const macMetrics = resolvePreviewChromeMetricsForOsSkin("macos");
  const frameRect = getWindowPreviewFrameRect({ x: 10, y: 33 }, 304, 372, macMetrics.titleBarHeight, 0, 0, macMetrics.toolBarHeight);
  const layout = getWindowChromeLayout(frameRect, macMetrics.titleBarHeight, true, true, true, macMetrics, 0, 0, true);

  assert.deepEqual(frameRect, { x: 10, y: 33, w: 304, h: 430 });
  assert.deepEqual(layout.toolBarRect, { x: 10, y: 55, w: 304, h: 36 });
  assert.deepEqual(layout.contentRect, { x: 10, y: 91, w: 304, h: 348 });
});


test("keeps the Windows toolbar inside the stored client height", () => {
  const frameRect = getWindowPreviewFrameRect({ x: 10, y: 10 }, 304, 372, 8, 8, 8);
  const layout = getWindowChromeLayout(frameRect, 8, false, true, false, METRICS, 8, 8);

  assert.deepEqual(frameRect, { x: 10, y: 10, w: 320, h: 388 });
  assert.deepEqual(layout.toolBarRect, { x: 18, y: 18, w: 304, h: 24 });
  assert.deepEqual(layout.contentRect, { x: 18, y: 42, w: 304, h: 348 });
});


test("keeps the Linux toolbar inside the stored client height", () => {
  const linuxMetrics = resolvePreviewChromeMetricsForOsSkin("linux");
  const frameRect = getWindowPreviewFrameRect({ x: 10, y: 10 }, 304, 372, linuxMetrics.titleBarHeight);
  const layout = getWindowChromeLayout(frameRect, linuxMetrics.titleBarHeight, false, true, false, linuxMetrics);

  assert.deepEqual(frameRect, { x: 10, y: 10, w: 304, h: 400 });
  assert.deepEqual(layout.toolBarRect, { x: 10, y: 38, w: 304, h: 38 });
  assert.deepEqual(layout.contentRect, { x: 10, y: 76, w: 304, h: 334 });
});


test("hits the original outside window resize button as the bottom-right handle", () => {
  const frameRect = getWindowPreviewFrameRect({ x: 10, y: 10 }, 304, 372, 8, 8, 8);

  assert.equal(hitWindowPreviewResizeButton(frameRect, 332, 400), "se");
  assert.equal(hitWindowPreviewResizeButton(frameRect, 326, 400), null);
});


test("computes splitter pane rects for both child slots", () => {
  assert.deepEqual(getSplitterPaneRect(RECT, true, METRICS.splitterWidth, 30, "first"), { x: 10, y: 20, w: 30, h: 80 });
  assert.deepEqual(getSplitterPaneRect(RECT, true, METRICS.splitterWidth, 30, "second"), { x: 49, y: 20, w: 81, h: 80 });
  assert.deepEqual(getSplitterPaneRect(RECT, false, METRICS.splitterWidth, 25, "first"), { x: 10, y: 20, w: 120, h: 25 });
  assert.deepEqual(getSplitterPaneRect(RECT, false, METRICS.splitterWidth, 25, "second"), { x: 10, y: 54, w: 120, h: 46 });
});


test("resolves active panel item from stored preview state", () => {
  assert.equal(resolvePanelActiveItem(undefined, 0), 0);
  assert.equal(resolvePanelActiveItem(1, 3), 1);
  assert.equal(resolvePanelActiveItem(8, 2), 0);
});

test("computes Windows panel tab hit layouts from the original FD_LeftDown path", () => {
  const tabs = getPanelTabLayouts(["General", "Advanced", "Overflow"], RECT, METRICS, 1, (label) => label.length * 6, "windows7");

  assert.deepEqual(tabs, [
    { index: 0, label: "General", active: false, rect: { x: 10, y: 20, w: 54, h: 22 } },
    { index: 1, label: "Advanced", active: true, rect: { x: 64, y: 20, w: 60, h: 22 } },
    { index: 2, label: "Overflow", active: false, rect: { x: 124, y: 20, w: 60, h: 22 } }
  ]);
});

test("computes macOS panel tab hit layouts from the centered original path", () => {
  const macMetrics = resolvePreviewChromeMetricsForOsSkin("macos");
  const tabs = getPanelTabLayouts(["One", "Two"], RECT, macMetrics, 0, (label) => label.length * 6, "macos");

  assert.deepEqual(tabs, [
    { index: 0, label: "One", active: true, rect: { x: 28, y: 20, w: 42, h: 31 } },
    { index: 1, label: "Two", active: false, rect: { x: 70, y: 20, w: 42, h: 31 } }
  ]);
});

test("computes Linux panel tab hit layouts from the visible FD_DrawGadget tab geometry", () => {
  const linuxMetrics = resolvePreviewChromeMetricsForOsSkin("linux");
  const tabs = getPanelTabLayouts(["One", "Two"], RECT, linuxMetrics, 1, (label) => label.length * 6, "linux");

  assert.deepEqual(tabs, [
    { index: 0, label: "One", active: false, rect: { x: 10, y: 20, w: 32, h: 29 } },
    { index: 1, label: "Two", active: true, rect: { x: 50, y: 20, w: 32, h: 29 } }
  ]);
});

test("rejects zero-area clipped panel tab hit rects", () => {
  assert.deepEqual(
    getPanelTabVisibleHitRect({ x: 124, y: 20, w: 60, h: 22 }, { x: 10, y: 20, w: 120, h: 80 }),
    { x: 124, y: 20, w: 6, h: 22 }
  );
  assert.equal(
    getPanelTabVisibleHitRect({ x: 130, y: 20, w: 60, h: 22 }, { x: 10, y: 20, w: 120, h: 80 }),
    null
  );
});




test("computes window/gadget resize handles and resolves pointer hits", () => {
  const points = getRectHandlePoints(RECT);

  assert.deepEqual(points, [
    ["nw", 10, 20],
    ["n", 70, 20],
    ["ne", 130, 20],
    ["w", 10, 60],
    ["e", 130, 60],
    ["sw", 10, 100],
    ["s", 70, 100],
    ["se", 130, 100]
  ]);

  assert.equal(hitHandlePoints(points, 10, 20, 10), "nw");
  assert.equal(hitHandlePoints(points, 130, 100, 10), "se");
  assert.equal(hitHandlePoints(points, 80, 70, 10), null);
});

test("computes statusbar content alignment for left, center and right flags", () => {
  assert.equal(getStatusBarAlignedX(10, 90, 30, false, false), 10);
  assert.equal(getStatusBarAlignedX(10, 90, 30, true, false), 40);
  assert.equal(getStatusBarAlignedX(10, 90, 30, false, true), 70);
});


test("converts between global and window-local preview coordinates", () => {
  const windowRect: PreviewRect = { x: 40, y: 50, w: 320, h: 220 };

  assert.deepEqual(toWindowLocalPoint(windowRect, 100, 90), { x: 60, y: 40 });
  assert.deepEqual(toWindowGlobalPoint(windowRect, 60, 40), { x: 100, y: 90 });
});

test("detects window and titlebar hits from preview geometry", () => {
  const windowRect: PreviewRect = { x: 40, y: 50, w: 320, h: 220 };

  assert.equal(isPointInWindowRect(windowRect, 60, 70), true);
  assert.equal(isPointInWindowRect(windowRect, 10, 10), false);
  assert.equal(isPointInTitleBar(windowRect, 26, 60, 70), true);
  assert.equal(isPointInTitleBar(windowRect, 26, 60, 90), false);
});


test("clamps preview rect size against minimum width and height", () => {
  assert.deepEqual(clampRect({ x: 10.8, y: 20.2, w: 5, h: 7 }, 18, 16), { x: 10, y: 20, w: 18, h: 16 });
});

test("applies resize deltas for east and north-west handles", () => {
  assert.deepEqual(
    applyResize(RECT, { dx: 15, dy: 12 }, "e", 24, 18),
    { x: 10, y: 20, w: 135, h: 80 }
  );

  assert.deepEqual(
    applyResize(RECT, { dx: 40, dy: 50 }, "nw", 60, 40),
    { x: 50, y: 60, w: 80, h: 40 }
  );
});



test("resolves preview chrome metrics directly from the selected FormSkin mode", () => {
  assert.deepEqual(resolvePreviewChromeMetricsForOsSkin("windows7"), METRICS);
  assert.deepEqual(resolvePreviewChromeMetricsForOsSkin("windows8"), METRICS);
  assert.deepEqual(resolvePreviewChromeMetricsForOsSkin("macos"), {
    titleBarHeight: 22,
    panelHeight: 31,
    scrollAreaWidth: 14,
    splitterWidth: 12,
    menuHeight: 23,
    toolBarHeight: 36,
    statusBarHeight: 24
  });
  assert.deepEqual(resolvePreviewChromeMetricsForOsSkin("linux"), {
    titleBarHeight: 28,
    panelHeight: 29,
    scrollAreaWidth: 20,
    splitterWidth: 9,
    menuHeight: 28,
    toolBarHeight: 38,
    statusBarHeight: 26
  });
});

test("resolves default preview chrome metrics from user-agent hints", () => {
  assert.deepEqual(resolvePreviewChromeMetrics("Mozilla/5.0 (Macintosh; Intel Mac OS X)"), {
    titleBarHeight: 22,
    panelHeight: 31,
    scrollAreaWidth: 14,
    splitterWidth: 12,
    menuHeight: 23,
    toolBarHeight: 36,
    statusBarHeight: 24
  });
  assert.deepEqual(resolvePreviewChromeMetrics("Mozilla/5.0 (X11; Linux x86_64)"), {
    titleBarHeight: 28,
    panelHeight: 29,
    scrollAreaWidth: 20,
    splitterWidth: 9,
    menuHeight: 28,
    toolBarHeight: 38,
    statusBarHeight: 26
  });
  assert.deepEqual(resolvePreviewChromeMetrics("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), METRICS);
});


test("uses the original rounded macOS button chrome only for 25px button heights", () => {
  assert.equal(usesOriginalMacRoundedButtonChrome("macos", 25), true);
  assert.equal(usesOriginalMacRoundedButtonChrome("macos", 24), false);
  assert.equal(usesOriginalMacRoundedButtonChrome("linux", 25), false);
});


test("uses the original fixed 22px macOS combo chrome only for non-editable combos", () => {
  assert.equal(getPreviewComboChromeHeight("macos", 25, false), 22);
  assert.equal(getPreviewComboChromeHeight("macos", 25, true), 25);
  assert.equal(getPreviewComboChromeHeight("windows7", 25, false), 25);
});


test("uses the original Windows date arrow assets only for Windows skins", () => {
  assert.deepEqual(
    getPreviewDateArrowLayout({ x: 10, y: 20, width: 120, height: 25, osSkin: "windows7" }),
    {
      kind: "rasterDown",
      assetKind: "windowsComboDown",
      x: 118,
      y: 30,
      width: 7,
      height: 4,
      fallbackCenterX: 118,
      fallbackCenterY: 32
    }
  );

  assert.deepEqual(
    getPreviewDateArrowLayout({ x: 10, y: 20, width: 120, height: 25, osSkin: "windows8" }),
    {
      kind: "rasterDown",
      assetKind: "windows8ComboDown",
      x: 118,
      y: 29,
      width: 7,
      height: 6,
      fallbackCenterX: 118,
      fallbackCenterY: 32
    }
  );

  assert.deepEqual(
    getPreviewDateArrowLayout({ x: 10, y: 20, width: 120, height: 25, osSkin: "macos" }),
    { kind: "singleDown", centerX: 118, centerY: 32 }
  );
});

test("uses the original macOS combo double-arrows asset placement only for non-editable combos", () => {
  assert.deepEqual(
    getPreviewComboArrowLayout({ x: 10, y: 20, width: 120, height: 25, osSkin: "macos", isEditable: false }),
    { kind: "macDoubleArrows", x: 118, y: 25, width: 5, height: 11 }
  );

  assert.deepEqual(
    getPreviewComboArrowLayout({ x: 10, y: 20, width: 120, height: 25, osSkin: "macos", isEditable: true }),
    { kind: "singleDown", centerX: 118, centerY: 32 }
  );

  assert.deepEqual(
    getPreviewComboArrowLayout({ x: 10, y: 20, width: 120, height: 25, osSkin: "windows7", isEditable: false }),
    {
      kind: "rasterDown",
      assetKind: "windowsComboDown",
      x: 118,
      y: 30,
      width: 7,
      height: 4,
      fallbackCenterX: 118,
      fallbackCenterY: 32
    }
  );

  assert.deepEqual(
    getPreviewComboArrowLayout({ x: 10, y: 20, width: 120, height: 25, osSkin: "windows8", isEditable: false }),
    {
      kind: "rasterDown",
      assetKind: "windows8ComboDown",
      x: 118,
      y: 29,
      width: 7,
      height: 6,
      fallbackCenterX: 118,
      fallbackCenterY: 32
    }
  );

  assert.deepEqual(
    getPreviewComboArrowLayout({ x: 10, y: 20, width: 120, height: 25, osSkin: "linux", isEditable: true }),
    {
      kind: "rasterDown",
      assetKind: "windowsComboDown",
      x: 118,
      y: 30,
      width: 7,
      height: 4,
      fallbackCenterX: 118,
      fallbackCenterY: 32
    }
  );
});

test("uses the original scrollbar arrow assets for Windows, Windows 8 and Linux only", () => {
  assert.deepEqual(
    getPreviewScrollBarArrowAssetLayouts({ x: 10, y: 20, width: 18, height: 120, osSkin: "windows7", isVertical: true }),
    [
      { direction: "up", assetKind: "windowsUp", x: 16, y: 26, width: 7, height: 4 },
      { direction: "down", assetKind: "windowsDown", x: 16, y: 130, width: 7, height: 4 }
    ]
  );

  assert.deepEqual(
    getPreviewScrollBarArrowAssetLayouts({ x: 10, y: 20, width: 120, height: 18, osSkin: "linux", isVertical: false }),
    [
      { direction: "left", assetKind: "windowsLeft", x: 16, y: 26, width: 4, height: 7 },
      { direction: "right", assetKind: "windowsRight", x: 120, y: 26, width: 4, height: 7 }
    ]
  );

  assert.deepEqual(
    getPreviewScrollBarArrowAssetLayouts({ x: 10, y: 20, width: 18, height: 120, osSkin: "windows8", isVertical: true }),
    [
      { direction: "up", assetKind: "windows8Up", x: 15, y: 25, width: 7, height: 6 },
      { direction: "down", assetKind: "windows8Down", x: 15, y: 129, width: 7, height: 6 }
    ]
  );

  assert.equal(
    getPreviewScrollBarArrowAssetLayouts({ x: 10, y: 20, width: 120, height: 18, osSkin: "macos", isVertical: false }).length,
    0
  );
});

test("uses the original split scrollbar thumb fills for Windows 7 and Linux only", () => {
  assert.deepEqual(
    getPreviewScrollBarThumbFillLayout({ x: 10, y: 20, width: 18, height: 120, osSkin: "windows7", isVertical: true }),
    {
      thumbRect: { x: 11, y: 38, w: 15, h: 28 },
      lightRect: { x: 12, y: 39, w: 2, h: 26 },
      darkRect: { x: 18, y: 39, w: 7, h: 26 }
    }
  );

  assert.deepEqual(
    getPreviewScrollBarThumbFillLayout({ x: 10, y: 20, width: 120, height: 18, osSkin: "linux", isVertical: false }),
    {
      thumbRect: { x: 28, y: 21, w: 28, h: 15 },
      lightRect: { x: 29, y: 22, w: 26, h: 2 },
      darkRect: { x: 29, y: 28, w: 26, h: 7 }
    }
  );

  assert.equal(getPreviewScrollBarThumbFillLayout({ x: 10, y: 20, width: 18, height: 120, osSkin: "windows8", isVertical: true }), null);
  assert.equal(getPreviewScrollBarThumbFillLayout({ x: 10, y: 20, width: 120, height: 18, osSkin: "macos", isVertical: false }), null);
});

test("uses the original trackbar thumb assets for macOS, Windows 7 and Linux only", () => {
  assert.deepEqual(
    getPreviewTrackBarThumbAssetLayout({ x: 10, y: 20, osSkin: "macos", isVertical: false }),
    { assetKind: "macHorizontal", x: 10, y: 20, width: 17, height: 19 }
  );

  assert.deepEqual(
    getPreviewTrackBarThumbAssetLayout({ x: 10, y: 20, osSkin: "macos", isVertical: true }),
    { assetKind: "macVertical", x: 10, y: 20, width: 19, height: 17 }
  );

  assert.deepEqual(
    getPreviewTrackBarThumbAssetLayout({ x: 10, y: 20, osSkin: "windows7", isVertical: false }),
    { assetKind: "windowsHorizontal", x: 10, y: 20, width: 10, height: 18 }
  );

  assert.deepEqual(
    getPreviewTrackBarThumbAssetLayout({ x: 10, y: 20, osSkin: "linux", isVertical: true }),
    { assetKind: "windowsVertical", x: 10, y: 20, width: 18, height: 10 }
  );

  assert.equal(getPreviewTrackBarThumbAssetLayout({ x: 10, y: 20, osSkin: "windows8", isVertical: false }), null);
});

test("uses the original spin button image layout from FD_DrawGadget for each preview skin", () => {
  assert.deepEqual(
    getPreviewSpinButtonLayout({ x: 20, y: 30, width: 120, height: 40, osSkin: "macos" }),
    { bodyWidth: 100, imageX: 127, imageY: 38, imageWidth: 13, imageHeight: 23 }
  );

  assert.deepEqual(
    getPreviewSpinButtonLayout({ x: 20, y: 30, width: 120, height: 40, osSkin: "windows7" }),
    { bodyWidth: 100, imageX: 127, imageY: 38, imageWidth: 13, imageHeight: 23 }
  );

  assert.deepEqual(
    getPreviewSpinButtonLayout({ x: 20, y: 30, width: 120, height: 40, osSkin: "windows8" }),
    { bodyWidth: 111, imageX: 132, imageY: 41, imageWidth: 8, imageHeight: 18 }
  );
});


test("uses the original macOS no-ticks guide fill rect only for trackbars without ticks", () => {
  assert.deepEqual(
    getPreviewTrackBarNoTicksFillRect({ x: 10, y: 20, width: 120, height: 25, osSkin: "macos", isVertical: false }),
    { x: 19, y: 37, w: 102, h: 4 }
  );

  assert.deepEqual(
    getPreviewTrackBarNoTicksFillRect({ x: 10, y: 20, width: 25, height: 120, osSkin: "macos", isVertical: true }),
    { x: 27, y: 29, w: 4, h: 102 }
  );

  assert.equal(
    getPreviewTrackBarNoTicksFillRect({ x: 10, y: 20, width: 120, height: 25, osSkin: "windows7", isVertical: false }),
    null
  );
});

test("uses the original macOS trackbar groove highlight lines only for the macOS skin", () => {
  assert.deepEqual(
    getPreviewTrackBarMacGrooveHighlightLines({ x: 10, y: 20, width: 120, height: 25, osSkin: "macos", isVertical: false }),
    [
      { x: 11, y: 24, w: 118, h: 1, color: "rgb(170, 170, 170)" },
      { x: 11, y: 25, w: 118, h: 1, color: "rgb(193, 193, 193)" },
      { x: 11, y: 26, w: 118, h: 1, color: "rgb(205, 205, 205)" }
    ]
  );

  assert.deepEqual(
    getPreviewTrackBarMacGrooveHighlightLines({ x: 10, y: 20, width: 25, height: 120, osSkin: "macos", isVertical: true }),
    [
      { x: 14, y: 21, w: 1, h: 118, color: "rgb(170, 170, 170)" },
      { x: 15, y: 21, w: 1, h: 118, color: "rgb(193, 193, 193)" },
      { x: 16, y: 21, w: 1, h: 118, color: "rgb(205, 205, 205)" }
    ]
  );

  assert.deepEqual(
    getPreviewTrackBarMacGrooveHighlightLines({ x: 10, y: 20, width: 120, height: 25, osSkin: "windows7", isVertical: false }),
    []
  );
});
