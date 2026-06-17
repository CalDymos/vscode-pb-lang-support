import { GADGET_KIND } from "../model";

export type PreviewRect = { x: number; y: number; w: number; h: number };
export type PreviewOffset = { x: number; y: number };

export type PreviewChromeMetrics = {
  titleBarHeight: number;
  panelHeight: number;
  scrollAreaWidth: number;
  splitterWidth: number;
  menuHeight: number;
  toolBarHeight: number;
  statusBarHeight: number;
};

export type WindowChromeLayout = {
  contentRect: PreviewRect;
  menuBarRect: PreviewRect | null;
  toolBarRect: PreviewRect | null;
  statusBarRect: PreviewRect | null;
};

export type WindowClientSurfaceRects = {
  fillRect: PreviewRect;
  borderRect: PreviewRect;
};

export type ResizeHandle = "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se";


export function usesOriginalMacRoundedButtonChrome(osSkin: "windows7" | "windows8" | "macos" | "linux", height: number): boolean {
  return osSkin === "macos" && Math.trunc(height) === 25;
}

export function getPreviewComboChromeHeight(
  osSkin: "windows7" | "windows8" | "macos" | "linux",
  height: number,
  isEditable: boolean
): number {
  return !isEditable && osSkin === "macos" ? 22 : height;
}

export type PreviewComboArrowAssetKind = "windowsComboDown" | "windows8ComboDown";

export type PreviewDateArrowLayout =
  | {
    kind: "rasterDown";
    assetKind: PreviewComboArrowAssetKind;
    x: number;
    y: number;
    width: number;
    height: number;
    fallbackCenterX: number;
    fallbackCenterY: number;
  }
  | {
    kind: "singleDown";
    centerX: number;
    centerY: number;
  };

export type PreviewComboArrowLayout =
  | {
    kind: "macDoubleArrows";
    x: number;
    y: number;
    width: number;
    height: number;
  }
  | {
    kind: "rasterDown";
    assetKind: PreviewComboArrowAssetKind;
    x: number;
    y: number;
    width: number;
    height: number;
    fallbackCenterX: number;
    fallbackCenterY: number;
  }
  | {
    kind: "singleDown";
    centerX: number;
    centerY: number;
  };

export function getPreviewDateArrowLayout(args: {
  x: number;
  y: number;
  width: number;
  height: number;
  osSkin: "windows7" | "windows8" | "macos" | "linux";
}): PreviewDateArrowLayout {
  const { x, y, width, height, osSkin } = args;
  const centerX = x + width - 12;
  const centerY = y + Math.trunc(height / 2);

  if (osSkin === "windows8") {
    return {
      kind: "rasterDown",
      assetKind: "windows8ComboDown",
      x: x + width - 12,
      y: y + Math.trunc((height - 6) / 2),
      width: 7,
      height: 6,
      fallbackCenterX: centerX,
      fallbackCenterY: centerY
    };
  }

  if (osSkin === "windows7") {
    return {
      kind: "rasterDown",
      assetKind: "windowsComboDown",
      x: x + width - 12,
      y: y + Math.trunc((height - 4) / 2),
      width: 7,
      height: 4,
      fallbackCenterX: centerX,
      fallbackCenterY: centerY
    };
  }

  return {
    kind: "singleDown",
    centerX,
    centerY
  };
}

export function getPreviewComboArrowLayout(args: {
  x: number;
  y: number;
  width: number;
  height: number;
  osSkin: "windows7" | "windows8" | "macos" | "linux";
  isEditable: boolean;
}): PreviewComboArrowLayout {
  const { x, y, width, height, osSkin, isEditable } = args;
  const centerX = x + width - 12;
  const centerY = y + Math.trunc(getPreviewComboChromeHeight(osSkin, height, isEditable) / 2);

  if (!isEditable && osSkin === "macos") {
    return {
      kind: "macDoubleArrows",
      x: x + width - 12,
      y: y + 5,
      width: 5,
      height: 11
    };
  }

  if (osSkin === "windows8") {
    return {
      kind: "rasterDown",
      assetKind: "windows8ComboDown",
      x: x + width - 12,
      y: y + Math.trunc((getPreviewComboChromeHeight(osSkin, height, isEditable) - 6) / 2),
      width: 7,
      height: 6,
      fallbackCenterX: centerX,
      fallbackCenterY: centerY
    };
  }

  if (osSkin === "windows7" || osSkin === "linux") {
    return {
      kind: "rasterDown",
      assetKind: "windowsComboDown",
      x: x + width - 12,
      y: y + Math.trunc((getPreviewComboChromeHeight(osSkin, height, isEditable) - 4) / 2),
      width: 7,
      height: 4,
      fallbackCenterX: centerX,
      fallbackCenterY: centerY
    };
  }

  return {
    kind: "singleDown",
    centerX,
    centerY
  };
}

export type PreviewSpinButtonLayout = {
  bodyWidth: number;
  imageX: number;
  imageY: number;
  imageWidth: number;
  imageHeight: number;
};

export function getPreviewSpinButtonLayout(args: {
  x: number;
  y: number;
  width: number;
  height: number;
  osSkin: "windows7" | "windows8" | "macos" | "linux";
}): PreviewSpinButtonLayout {
  const { x, y, width, height, osSkin } = args;

  if (osSkin === "windows8") {
    const imageWidth = 8;
    const imageHeight = 18;
    const bodyWidth = Math.max(0, width - imageWidth - 1);
    return {
      bodyWidth,
      imageX: x + bodyWidth + 1,
      imageY: y + Math.trunc((height - imageHeight) / 2),
      imageWidth,
      imageHeight
    };
  }

  const imageWidth = 13;
  const imageHeight = 23;
  const bodyWidth = Math.max(0, width - 20);
  return {
    bodyWidth,
    imageX: x + bodyWidth + 7,
    imageY: y + Math.trunc((height - imageHeight) / 2),
    imageWidth,
    imageHeight
  };
}

export type PreviewScrollBarArrowAssetKind =
  | "windowsUp"
  | "windowsDown"
  | "windowsLeft"
  | "windowsRight"
  | "windows8Up"
  | "windows8Down"
  | "windows8Left"
  | "windows8Right";

export type PreviewScrollBarArrowAssetLayout = {
  direction: "up" | "down" | "left" | "right";
  assetKind: PreviewScrollBarArrowAssetKind;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PreviewScrollBarThumbFillLayout = {
  thumbRect: PreviewRect;
  lightRect: PreviewRect;
  darkRect: PreviewRect;
};

export function getPreviewScrollBarThumbFillLayout(args: {
  x: number;
  y: number;
  width: number;
  height: number;
  osSkin: "windows7" | "windows8" | "macos" | "linux";
  isVertical: boolean;
}): PreviewScrollBarThumbFillLayout | null {
  const { x, y, width, height, osSkin, isVertical } = args;

  if (osSkin === "windows8" || osSkin === "macos") {
    return null;
  }

  if (isVertical) {
    const thumbHeight = Math.max(0, Math.trunc((height - 34) / 3));
    return {
      thumbRect: { x: x + 1, y: y + 18, w: Math.max(0, width - 3), h: thumbHeight },
      lightRect: {
        x: x + 2,
        y: y + 19,
        w: Math.max(0, Math.trunc((width * 3) / 8) - 4),
        h: Math.max(0, thumbHeight - 2)
      },
      darkRect: {
        x: x + 2 + Math.trunc((width * 3) / 8),
        y: y + 19,
        w: Math.max(0, Math.trunc((width * 5) / 8) - 4),
        h: Math.max(0, thumbHeight - 2)
      }
    };
  }

  const thumbWidth = Math.max(0, Math.trunc((width - 34) / 3));
  return {
    thumbRect: { x: x + 18, y: y + 1, w: thumbWidth, h: Math.max(0, height - 3) },
    lightRect: {
      x: x + 19,
      y: y + 2,
      w: Math.max(0, thumbWidth - 2),
      h: Math.max(0, Math.trunc((height * 3) / 8) - 4)
    },
    darkRect: {
      x: x + 19,
      y: y + 2 + Math.trunc((height * 3) / 8),
      w: Math.max(0, thumbWidth - 2),
      h: Math.max(0, Math.trunc((height * 5) / 8) - 4)
    }
  };
}

export function getPreviewScrollBarArrowAssetLayouts(args: {
  x: number;
  y: number;
  width: number;
  height: number;
  osSkin: "windows7" | "windows8" | "macos" | "linux";
  isVertical: boolean;
}): PreviewScrollBarArrowAssetLayout[] {
  const { x, y, width, height, osSkin, isVertical } = args;

  if (osSkin === "macos") {
    return [];
  }

  if (osSkin === "windows8") {
    if (isVertical) {
      return [
        {
          direction: "up",
          assetKind: "windows8Up",
          x: x + Math.trunc((width - 7) / 2),
          y: y + 5,
          width: 7,
          height: 6
        },
        {
          direction: "down",
          assetKind: "windows8Down",
          x: x + Math.trunc((width - 7) / 2),
          y: y + height - 11,
          width: 7,
          height: 6
        }
      ];
    }

    return [
      {
        direction: "left",
        assetKind: "windows8Left",
        x: x + 5,
        y: y + Math.trunc((height - 7) / 2),
        width: 6,
        height: 7
      },
      {
        direction: "right",
        assetKind: "windows8Right",
        x: x + width - 11,
        y: y + Math.trunc((height - 7) / 2),
        width: 6,
        height: 7
      }
    ];
  }

  if (isVertical) {
    return [
      {
        direction: "up",
        assetKind: "windowsUp",
        x: x + Math.trunc((width - 6) / 2),
        y: y + 6,
        width: 7,
        height: 4
      },
      {
        direction: "down",
        assetKind: "windowsDown",
        x: x + Math.trunc((width - 6) / 2),
        y: y + height - 10,
        width: 7,
        height: 4
      }
    ];
  }

  return [
    {
      direction: "left",
      assetKind: "windowsLeft",
      x: x + 6,
      y: y + Math.trunc((height - 6) / 2),
      width: 4,
      height: 7
    },
    {
      direction: "right",
      assetKind: "windowsRight",
      x: x + width - 10,
      y: y + Math.trunc((height - 6) / 2),
      width: 4,
      height: 7
    }
  ];
}

export type PreviewTrackBarThumbAssetLayout = {
  assetKind: "macHorizontal" | "macVertical" | "windowsHorizontal" | "windowsVertical";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PreviewTrackBarGrooveHighlightLine = PreviewRect & {
  color: string;
};

export function getPreviewTrackBarMacGrooveHighlightLines(args: {
  x: number;
  y: number;
  width: number;
  height: number;
  osSkin: "windows7" | "windows8" | "macos" | "linux";
  isVertical: boolean;
}): PreviewTrackBarGrooveHighlightLine[] {
  const { x, y, width, height, osSkin, isVertical } = args;

  if (osSkin !== "macos") {
    return [];
  }

  return isVertical
    ? [
      { x: x + 4, y: y + 1, w: 1, h: Math.max(0, height - 2), color: "rgb(170, 170, 170)" },
      { x: x + 5, y: y + 1, w: 1, h: Math.max(0, height - 2), color: "rgb(193, 193, 193)" },
      { x: x + 6, y: y + 1, w: 1, h: Math.max(0, height - 2), color: "rgb(205, 205, 205)" }
    ]
    : [
      { x: x + 1, y: y + 4, w: Math.max(0, width - 2), h: 1, color: "rgb(170, 170, 170)" },
      { x: x + 1, y: y + 5, w: Math.max(0, width - 2), h: 1, color: "rgb(193, 193, 193)" },
      { x: x + 1, y: y + 6, w: Math.max(0, width - 2), h: 1, color: "rgb(205, 205, 205)" }
    ];
}

export function getPreviewTrackBarNoTicksFillRect(args: {
  x: number;
  y: number;
  width: number;
  height: number;
  osSkin: "windows7" | "windows8" | "macos" | "linux";
  isVertical: boolean;
}): PreviewRect | null {
  const { x, y, width, height, osSkin, isVertical } = args;

  if (osSkin !== "macos") {
    return null;
  }

  return isVertical
    ? { x: x + 17, y: y + 9, w: 4, h: Math.max(0, height - 18) }
    : { x: x + 9, y: y + 17, w: Math.max(0, width - 18), h: 4 };
}

export function getPreviewTrackBarThumbAssetLayout(args: {
  x: number;
  y: number;
  osSkin: "windows7" | "windows8" | "macos" | "linux";
  isVertical: boolean;
}): PreviewTrackBarThumbAssetLayout | null {
  const { x, y, osSkin, isVertical } = args;

  if (osSkin === "windows8") {
    return null;
  }

  if (osSkin === "macos") {
    return isVertical
      ? { assetKind: "macVertical", x, y, width: 19, height: 17 }
      : { assetKind: "macHorizontal", x, y, width: 17, height: 19 };
  }

  return isVertical
    ? { assetKind: "windowsVertical", x, y, width: 18, height: 10 }
    : { assetKind: "windowsHorizontal", x, y, width: 10, height: 18 };
}

export type PreviewChromeMetricsOsSkin = "windows7" | "windows8" | "macos" | "linux";

export function resolvePreviewChromeMetricsForOsSkin(osSkin: PreviewChromeMetricsOsSkin): PreviewChromeMetrics {
  if (osSkin === "macos") {
    return {
      titleBarHeight: 22,
      panelHeight: 31,
      scrollAreaWidth: 14,
      splitterWidth: 12,
      menuHeight: 23,
      toolBarHeight: 36,
      statusBarHeight: 24
    };
  }

  if (osSkin === "linux") {
    return {
      titleBarHeight: 28,
      panelHeight: 29,
      scrollAreaWidth: 20,
      splitterWidth: 9,
      menuHeight: 28,
      toolBarHeight: 38,
      statusBarHeight: 26
    };
  }

  return {
    titleBarHeight: 29,
    panelHeight: 22,
    scrollAreaWidth: 20,
    splitterWidth: 9,
    menuHeight: 22,
    toolBarHeight: 24,
    statusBarHeight: 23
  };
}

export function resolvePreviewChromeMetrics(userAgent = ""): PreviewChromeMetrics {
  const ua = userAgent.toLowerCase();

  if (ua.includes("mac")) {
    return resolvePreviewChromeMetricsForOsSkin("macos");
  }

  if (ua.includes("linux")) {
    return resolvePreviewChromeMetricsForOsSkin("linux");
  }

  return resolvePreviewChromeMetricsForOsSkin("windows7");
}

export function clampRect(
  rect: PreviewRect,
  minW: number,
  minH: number
): PreviewRect {
  const nx = Math.trunc(rect.x);
  const ny = Math.trunc(rect.y);
  let nw = Math.trunc(rect.w);
  let nh = Math.trunc(rect.h);

  if (nw < minW) nw = minW;
  if (nh < minH) nh = minH;

  return { x: nx, y: ny, w: nw, h: nh };
}

export function applyResize(
  rect: PreviewRect,
  delta: { dx: number; dy: number },
  handle: ResizeHandle,
  minW: number,
  minH: number
): PreviewRect {
  let nx = rect.x;
  let ny = rect.y;
  let nw = rect.w;
  let nh = rect.h;

  const west = handle === "nw" || handle === "w" || handle === "sw";
  const east = handle === "ne" || handle === "e" || handle === "se";
  const north = handle === "nw" || handle === "n" || handle === "ne";
  const south = handle === "sw" || handle === "s" || handle === "se";

  if (east) nw = rect.w + delta.dx;
  if (south) nh = rect.h + delta.dy;

  if (west) {
    nx = rect.x + delta.dx;
    nw = rect.w - delta.dx;
  }

  if (north) {
    ny = rect.y + delta.dy;
    nh = rect.h - delta.dy;
  }

  if (nw < minW) {
    if (west) nx = rect.x + (rect.w - minW);
    nw = minW;
  }

  if (nh < minH) {
    if (north) ny = rect.y + (rect.h - minH);
    nh = minH;
  }

  return clampRect({ x: nx, y: ny, w: nw, h: nh }, minW, minH);
}

export type PanelTabLayout = {
  index: number;
  label: string;
  rect: PreviewRect;
  active: boolean;
};

export function resolvePanelActiveItem(storedIndex: number | undefined, tabCount: number): number {
  if (typeof storedIndex === "number" && storedIndex >= 0 && storedIndex < Math.max(1, tabCount)) {
    return storedIndex;
  }
  return 0;
}

export function getPanelTabLayouts(
  labels: string[],
  rect: PreviewRect,
  metrics: PreviewChromeMetrics,
  activeIndex: number,
  measureText: (label: string) => number,
  osSkin: PreviewChromeMetricsOsSkin = "windows7"
): PanelTabLayout[] {
  const panelHeight = metrics.panelHeight;
  const tabRects: PanelTabLayout[] = [];

  if (labels.length === 0) {
    return tabRects;
  }

  const resolvedLabels = labels.map((label, index) => label || `Tab ${index + 1}`);
  const resolvedActiveIndex = resolvePanelActiveItem(activeIndex, resolvedLabels.length);

  if (osSkin === "macos") {
    const widths = resolvedLabels.map((label) => Math.ceil(measureText(label)) + 24);
    const totalWidth = widths.reduce((sum, width) => sum + width, 0);
    let tabX = rect.x + Math.trunc((rect.w - totalWidth) / 2);

    for (let i = 0; i < resolvedLabels.length; i++) {
      const label = resolvedLabels[i];
      const tabW = widths[i];
      tabRects.push({
        index: i,
        label,
        active: i === resolvedActiveIndex,
        rect: { x: tabX, y: rect.y, w: tabW, h: panelHeight }
      });
      tabX += tabW;
    }

    return tabRects;
  }

  let tabX = rect.x;
  for (let i = 0; i < resolvedLabels.length; i++) {
    const label = resolvedLabels[i];
    const tabW = Math.ceil(measureText(label)) + 12;
    tabRects.push({
      index: i,
      label,
      active: i === resolvedActiveIndex,
      rect: { x: tabX, y: rect.y, w: tabW, h: panelHeight }
    });
    tabX += tabW;
  }

  return tabRects;
}


export function intersectRect(a: PreviewRect, b: PreviewRect): PreviewRect {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  return {
    x,
    y,
    w: Math.max(0, right - x),
    h: Math.max(0, bottom - y)
  };
}

export function rectContainsPoint(rect: PreviewRect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export function isPointOnRectBorder(rect: PreviewRect, x: number, y: number, margin = 4): boolean {
  if (!rectContainsPoint(rect, x, y)) return false;
  return x <= rect.x + margin
    || x >= rect.x + rect.w - margin
    || y <= rect.y + margin
    || y >= rect.y + rect.h - margin;
}

export function getScrollAreaBarSize(rect: PreviewRect, metrics: PreviewChromeMetrics): number {
  return Math.min(metrics.scrollAreaWidth, Math.max(12, Math.min(rect.w, rect.h) - 4));
}

export function getScrollAreaVerticalBarRect(rect: PreviewRect, metrics: PreviewChromeMetrics): PreviewRect {
  const bar = getScrollAreaBarSize(rect, metrics);
  return {
    x: rect.x + Math.max(0, rect.w - bar - 2),
    y: rect.y + 1,
    w: bar,
    h: Math.max(0, rect.h - bar - 3)
  };
}

export function getScrollAreaHorizontalBarRect(rect: PreviewRect, metrics: PreviewChromeMetrics): PreviewRect {
  const bar = getScrollAreaBarSize(rect, metrics);
  return {
    x: rect.x + 1,
    y: rect.y + Math.max(0, rect.h - bar - 2),
    w: Math.max(0, rect.w - bar - 3),
    h: bar
  };
}

export function getScrollAreaViewportRect(rect: PreviewRect, metrics: PreviewChromeMetrics): PreviewRect {
  const bar = getScrollAreaBarSize(rect, metrics);
  return {
    x: rect.x,
    y: rect.y,
    w: Math.max(0, rect.w - bar),
    h: Math.max(0, rect.h - bar)
  };
}

export function clampScrollAreaOffset(
  offset: PreviewOffset,
  rect: PreviewRect,
  metrics: PreviewChromeMetrics,
  innerWidth?: number,
  innerHeight?: number
): PreviewOffset {
  return {
    x: Math.max(0, Math.min(offset.x, getScrollAreaMaxOffsetX(rect, metrics, innerWidth))),
    y: Math.max(0, Math.min(offset.y, getScrollAreaMaxOffsetY(rect, metrics, innerHeight)))
  };
}

export function getScrollAreaMaxOffsetX(
  rect: PreviewRect,
  metrics: PreviewChromeMetrics,
  innerWidth?: number
): number {
  const bar = getScrollAreaBarSize(rect, metrics);
  const viewportWidth = Math.max(0, rect.w - bar);
  const contentWidth = typeof innerWidth === "number" && innerWidth > 0 ? innerWidth : viewportWidth;
  return Math.max(0, contentWidth - viewportWidth);
}

export function getScrollAreaMaxOffsetY(
  rect: PreviewRect,
  metrics: PreviewChromeMetrics,
  innerHeight?: number
): number {
  const bar = getScrollAreaBarSize(rect, metrics);
  const viewportHeight = Math.max(0, rect.h - bar);
  const contentHeight = typeof innerHeight === "number" && innerHeight > 0 ? innerHeight : viewportHeight;
  return Math.max(0, contentHeight - viewportHeight);
}

export function getScrollAreaVerticalThumbRect(
  rect: PreviewRect,
  metrics: PreviewChromeMetrics,
  innerHeight?: number,
  offsetY = 0
): PreviewRect {
  const track = getScrollAreaVerticalBarRect(rect, metrics);
  const maxOffset = getScrollAreaMaxOffsetY(rect, metrics, innerHeight);
  if (track.w <= 0 || track.h <= 0) return { x: track.x, y: track.y, w: 0, h: 0 };

  if (maxOffset <= 0) {
    return { x: track.x, y: track.y, w: track.w, h: track.h };
  }

  const bar = getScrollAreaBarSize(rect, metrics);
  const viewportHeight = Math.max(0, rect.h - bar);
  const contentHeight = typeof innerHeight === "number" && innerHeight > 0 ? innerHeight : viewportHeight;
  const trackHeight = Math.max(1, track.h);
  const thumbHeight = Math.max(14, Math.min(trackHeight, Math.round((viewportHeight / contentHeight) * trackHeight)));
  const travel = Math.max(0, trackHeight - thumbHeight);
  const clampedOffset = Math.max(0, Math.min(offsetY, maxOffset));
  const thumbY = track.y + Math.round((clampedOffset / maxOffset) * travel);
  return { x: track.x, y: thumbY, w: track.w, h: thumbHeight };
}

export function getScrollAreaHorizontalThumbRect(
  rect: PreviewRect,
  metrics: PreviewChromeMetrics,
  innerWidth?: number,
  offsetX = 0
): PreviewRect {
  const track = getScrollAreaHorizontalBarRect(rect, metrics);
  const maxOffset = getScrollAreaMaxOffsetX(rect, metrics, innerWidth);
  if (track.w <= 0 || track.h <= 0) return { x: track.x, y: track.y, w: 0, h: 0 };

  if (maxOffset <= 0) {
    return { x: track.x, y: track.y, w: track.w, h: track.h };
  }

  const bar = getScrollAreaBarSize(rect, metrics);
  const viewportWidth = Math.max(0, rect.w - bar);
  const contentWidth = typeof innerWidth === "number" && innerWidth > 0 ? innerWidth : viewportWidth;
  const trackWidth = Math.max(1, track.w);
  const thumbWidth = Math.max(14, Math.min(trackWidth, Math.round((viewportWidth / contentWidth) * trackWidth)));
  const travel = Math.max(0, trackWidth - thumbWidth);
  const clampedOffset = Math.max(0, Math.min(offsetX, maxOffset));
  const thumbX = track.x + Math.round((clampedOffset / maxOffset) * travel);
  return { x: thumbX, y: track.y, w: thumbWidth, h: track.h };
}


export function getPanelHeaderRect(rect: PreviewRect, metrics: PreviewChromeMetrics): PreviewRect {
  const panelHeight = Math.min(metrics.panelHeight, Math.max(18, rect.h));
  return {
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: panelHeight
  };
}

export function getPanelContentRect(rect: PreviewRect, metrics: PreviewChromeMetrics): PreviewRect {
  const headerRect = getPanelHeaderRect(rect, metrics);
  return {
    x: rect.x,
    y: rect.y + headerRect.h,
    w: rect.w,
    h: Math.max(0, rect.h - headerRect.h)
  };
}

export function getContainerContentRect(
  kind: string,
  rect: PreviewRect,
  metrics: PreviewChromeMetrics
): PreviewRect {
  switch (kind) {
    case GADGET_KIND.PanelGadget:
      return getPanelContentRect(rect, metrics);

    case GADGET_KIND.ScrollAreaGadget:
      return getScrollAreaViewportRect(rect, metrics);

    case GADGET_KIND.ContainerGadget:
    case GADGET_KIND.FrameGadget:
      // FD_Redraw() applies no additional child-origin inset for ContainerGadget or Frame3DGadget.
      return rect;

    default:
      return rect;
  }
}

export function getGadgetContentRect(
  kind: string,
  rect: PreviewRect,
  metrics: PreviewChromeMetrics
): PreviewRect {
  return getContainerContentRect(kind, rect, metrics);
}

export type ContainerChromeHitZone = "panelHeader" | "containerBorder";

export function isContainerChromeGadgetKind(kind: string): boolean {
  return kind === GADGET_KIND.ContainerGadget
    || kind === GADGET_KIND.PanelGadget
    || kind === GADGET_KIND.ScrollAreaGadget
    || kind === GADGET_KIND.FrameGadget;
}

export function getContainerChromeHitZone(
  kind: string,
  rect: PreviewRect,
  metrics: PreviewChromeMetrics,
  x: number,
  y: number,
  borderMargin = 4
): ContainerChromeHitZone | null {
  if (kind === GADGET_KIND.PanelGadget && rectContainsPoint(getPanelHeaderRect(rect, metrics), x, y)) {
    return "panelHeader";
  }

  if (isContainerChromeGadgetKind(kind) && isPointOnRectBorder(rect, x, y, borderMargin)) {
    return "containerBorder";
  }

  return null;
}

export function getSplitterResolvedPosition(
  splitterRect: PreviewRect,
  vertical: boolean,
  splitterWidth: number,
  state: number | undefined
): number {
  const bar = Math.max(0, Math.trunc(splitterWidth));
  const range = Math.max(0, (vertical ? splitterRect.w : splitterRect.h) - bar);
  const rawPos = typeof state === "number" ? Math.trunc(state) : Math.trunc(range / 2);

  // The original FD_UpdateSplitter() writes the pane coordinates directly from state.
  // The preview keeps its existing clamp so malformed or externally edited states cannot
  // produce negative pane sizes while still matching the original for valid states.
  return Math.max(0, Math.min(rawPos, range));
}

export function getSplitterPaneRect(
  splitterRect: PreviewRect,
  vertical: boolean,
  splitterWidth: number,
  state: number | undefined,
  pane: "first" | "second"
): PreviewRect {
  const bar = Math.max(0, Math.trunc(splitterWidth));
  const pos = getSplitterResolvedPosition(splitterRect, vertical, bar, state);

  if (pane === "first") {
    return vertical
      ? { x: splitterRect.x, y: splitterRect.y, w: pos, h: splitterRect.h }
      : { x: splitterRect.x, y: splitterRect.y, w: splitterRect.w, h: pos };
  }

  return vertical
    ? {
      x: splitterRect.x + pos + bar,
      y: splitterRect.y,
      w: Math.max(0, splitterRect.w - pos - bar),
      h: splitterRect.h
    }
    : {
      x: splitterRect.x,
      y: splitterRect.y + pos + bar,
      w: splitterRect.w,
      h: Math.max(0, splitterRect.h - pos - bar)
    };
}

export function getSplitterBarRect(
  splitterRect: PreviewRect,
  vertical: boolean,
  splitterWidth: number,
  state?: number
): PreviewRect {
  const bar = Math.max(0, Math.trunc(splitterWidth));
  const pos = getSplitterResolvedPosition(splitterRect, vertical, bar, state);
  return vertical
    ? { x: splitterRect.x + pos, y: splitterRect.y, w: bar, h: splitterRect.h }
    : { x: splitterRect.x, y: splitterRect.y + pos, w: splitterRect.w, h: bar };
}

export function getMenuBarRect(
  windowRect: PreviewRect,
  titleBarHeight: number,
  metrics: PreviewChromeMetrics,
  clientSidePadding = 0,
  menuOutsideWindow = false
): PreviewRect {
  return {
    x: windowRect.x + clientSidePadding,
    y: menuOutsideWindow
      ? windowRect.y - metrics.menuHeight
      : windowRect.y + Math.max(0, titleBarHeight),
    w: Math.max(0, windowRect.w - clientSidePadding * 2),
    h: metrics.menuHeight
  };
}

export function getCanvasMenuBarRect(
  canvasWidth: number,
  metrics: PreviewChromeMetrics
): PreviewRect {
  return {
    x: 0,
    y: 0,
    w: Math.max(0, Math.trunc(canvasWidth)),
    h: metrics.menuHeight
  };
}

export function getToolBarRect(
  windowRect: PreviewRect,
  titleBarHeight: number,
  hasMenu: boolean,
  metrics: PreviewChromeMetrics,
  clientSidePadding = 0,
  menuOutsideWindow = false
): PreviewRect {
  return {
    x: windowRect.x + clientSidePadding,
    y: windowRect.y + Math.max(0, titleBarHeight) + (hasMenu && !menuOutsideWindow ? metrics.menuHeight : 0),
    w: Math.max(0, windowRect.w - clientSidePadding * 2),
    h: metrics.toolBarHeight
  };
}

export function getStatusBarRect(
  windowRect: PreviewRect,
  metrics: PreviewChromeMetrics,
  clientSidePadding = 0,
  clientBottomPadding = 0
): PreviewRect {
  return {
    x: windowRect.x + clientSidePadding,
    y: windowRect.y + Math.max(0, windowRect.h - clientBottomPadding - metrics.statusBarHeight),
    w: Math.max(0, windowRect.w - clientSidePadding * 2),
    h: Math.min(metrics.statusBarHeight, Math.max(0, windowRect.h - clientBottomPadding))
  };
}


export function getWindowPreviewResizeButtonRect(windowRect: PreviewRect): PreviewRect {
  const anchorX = Math.trunc(windowRect.x + windowRect.w + 2);
  const anchorY = Math.trunc(windowRect.y + windowRect.h + 2);

  return {
    x: anchorX - 4,
    y: anchorY - 4,
    w: 8,
    h: 8,
  };
}

export function hitWindowPreviewResizeButton(windowRect: PreviewRect, x: number, y: number): ResizeHandle | null {
  return rectContainsPoint(getWindowPreviewResizeButtonRect(windowRect), x, y) ? "se" : null;
}

export function getWindowPreviewFrameRect(
  origin: PreviewOffset,
  clientWidth: number,
  clientHeight: number,
  chromeTopPadding: number,
  clientSidePadding = 0,
  clientBottomPadding = 0,
  extraFrameHeight = 0
): PreviewRect {
  const insetX = Math.max(0, Math.trunc(clientSidePadding));
  const insetTop = Math.max(0, Math.trunc(chromeTopPadding));
  const insetBottom = Math.max(0, Math.trunc(clientBottomPadding));
  const extraHeight = Math.max(0, Math.trunc(extraFrameHeight));

  return {
    x: Math.trunc(origin.x),
    y: Math.trunc(origin.y),
    w: Math.max(0, Math.trunc(clientWidth) + insetX * 2),
    h: Math.max(0, Math.trunc(clientHeight) + insetTop + insetBottom + extraHeight),
  };
}

export function getWindowClientSurfaceRects(
  windowRect: PreviewRect,
  chromeTopPadding: number,
  clientSidePadding = 0,
  clientBottomPadding = 0
): WindowClientSurfaceRects {
  const insetX = Math.max(0, Math.trunc(clientSidePadding));
  const insetY = Math.max(0, Math.trunc(chromeTopPadding));
  const insetBottom = Math.max(0, Math.trunc(clientBottomPadding));
  const fillRect: PreviewRect = {
    x: windowRect.x + insetX,
    y: windowRect.y + insetY,
    w: Math.max(0, windowRect.w - insetX * 2),
    h: Math.max(0, windowRect.h - insetY - insetBottom),
  };

  return {
    fillRect,
    borderRect: {
      x: fillRect.x - 1,
      y: fillRect.y - 1,
      w: fillRect.w + 2,
      h: fillRect.h + 2,
    },
  };
}

export function getStatusBarAlignedX(
  fieldX: number,
  fieldW: number,
  contentW: number,
  isCentered: boolean,
  isRightAligned: boolean
): number {
  if (isCentered) {
    return fieldX + Math.max(0, Math.trunc((fieldW - contentW) / 2));
  }
  if (isRightAligned) {
    return fieldX + Math.max(0, fieldW - contentW);
  }
  return fieldX;
}


export function getRectHandlePoints(rect: PreviewRect): Array<[ResizeHandle, number, number]> {
  const { x, y, w, h } = rect;
  return [
    ["nw", x, y],
    ["n", x + w / 2, y],
    ["ne", x + w, y],
    ["w", x, y + h / 2],
    ["e", x + w, y + h / 2],
    ["sw", x, y + h],
    ["s", x + w / 2, y + h],
    ["se", x + w, y + h]
  ];
}

export function hitHandlePoints(
  points: Array<[ResizeHandle, number, number]>,
  x: number,
  y: number,
  hitSize: number
): ResizeHandle | null {
  const half = hitSize / 2;
  for (const [handle, px, py] of points) {
    if (x >= px - half && x <= px + half && y >= py - half && y <= py + half) {
      return handle;
    }
  }
  return null;
}



export function isPointInWindowRect(windowRect: PreviewRect, x: number, y: number): boolean {
  return rectContainsPoint(windowRect, x, y);
}

export function toWindowLocalPoint(windowRect: PreviewRect, x: number, y: number): PreviewOffset {
  return { x: x - windowRect.x, y: y - windowRect.y };
}

export function toWindowGlobalPoint(windowRect: PreviewRect, x: number, y: number): PreviewOffset {
  return { x: x + windowRect.x, y: y + windowRect.y };
}

export function isPointInTitleBar(windowRect: PreviewRect, titleBarHeight: number, x: number, y: number): boolean {
  if (titleBarHeight <= 0) return false;
  return x >= windowRect.x && x <= windowRect.x + windowRect.w
    && y >= windowRect.y && y <= windowRect.y + titleBarHeight;
}
export function getWindowContentRect(
  windowRect: PreviewRect,
  titleBarHeight: number,
  hasMenu: boolean,
  hasToolbar: boolean,
  hasStatusbar: boolean,
  metrics: PreviewChromeMetrics,
  clientSidePadding = 0,
  clientBottomPadding = 0,
  menuOutsideWindow = false
): PreviewRect {
  const top = Math.max(0, titleBarHeight)
    + (hasMenu && !menuOutsideWindow ? metrics.menuHeight : 0)
    + (hasToolbar ? metrics.toolBarHeight : 0);
  const bottom = (hasStatusbar ? metrics.statusBarHeight : 0) + Math.max(0, clientBottomPadding);
  return {
    x: windowRect.x + clientSidePadding,
    y: windowRect.y + top,
    w: Math.max(0, windowRect.w - clientSidePadding * 2),
    h: Math.max(0, windowRect.h - top - bottom)
  };
}

export function getWindowChromeLayout(
  windowRect: PreviewRect,
  titleBarHeight: number,
  hasMenu: boolean,
  hasToolbar: boolean,
  hasStatusbar: boolean,
  metrics: PreviewChromeMetrics,
  clientSidePadding = 0,
  clientBottomPadding = 0,
  menuOutsideWindow = false
): WindowChromeLayout {
  return {
    contentRect: getWindowContentRect(
      windowRect,
      titleBarHeight,
      hasMenu,
      hasToolbar,
      hasStatusbar,
      metrics,
      clientSidePadding,
      clientBottomPadding,
      menuOutsideWindow
    ),
    menuBarRect: hasMenu ? getMenuBarRect(windowRect, titleBarHeight, metrics, clientSidePadding, menuOutsideWindow) : null,
    toolBarRect: hasToolbar ? getToolBarRect(windowRect, titleBarHeight, hasMenu, metrics, clientSidePadding, menuOutsideWindow) : null,
    statusBarRect: hasStatusbar ? getStatusBarRect(windowRect, metrics, clientSidePadding, clientBottomPadding) : null
  };
}
