import { parseUnscaledLayoutRaw } from "../parser/layout-raw";

function roundScale(scale: number): number {
  return Math.round(scale * 100) / 100;
}

export function getLayoutDpiScale(devicePixelRatio: number | undefined): number {
  if (typeof devicePixelRatio !== "number" || !Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) {
    return 1;
  }

  const rounded = roundScale(devicePixelRatio);
  return Math.abs(rounded - 1) < 0.001 ? 1 : rounded;
}

export function isLayoutDpiScalingActive(scale: number): boolean {
  return Number.isFinite(scale) && Math.abs(scale - 1) >= 0.001;
}

export type DisplayedLayoutValueCommit = {
  displayValue: number;
  unscaledValue: number;
  raw: string;
};

export type DisplayedLayoutPointCommit = {
  x: number;
  y: number;
  xUnscaled: number;
  yUnscaled: number;
  xRaw: string;
  yRaw: string;
};

export type DisplayedLayoutRectCommit = DisplayedLayoutPointCommit & {
  w: number;
  h: number;
  wUnscaled: number;
  hUnscaled: number;
  wRaw: string;
  hRaw: string;
};

export function unscaleDisplayedLayoutValue(displayValue: number, scale: number): number {
  if (!Number.isFinite(displayValue)) return 0;
  if (!isLayoutDpiScalingActive(scale)) return Math.trunc(displayValue);
  return Math.round(displayValue / scale);
}

export function getStableDisplayedLayoutValue(unscaledValue: number, scale: number): number {
  if (!Number.isFinite(unscaledValue)) return 0;

  const truncated = Math.trunc(unscaledValue);
  if (!isLayoutDpiScalingActive(scale)) return truncated;

  const estimate = truncated * scale;
  const start = Math.floor(estimate) - 8;
  const end = Math.ceil(estimate) + 8;
  for (let candidate = start; candidate <= end; candidate += 1) {
    if (unscaleDisplayedLayoutValue(candidate, scale) === truncated) {
      return candidate;
    }
  }

  return Math.round(estimate);
}

export function getDisplayedLayoutValue(raw: string | undefined, fallbackValue: number, scale: number): number {
  const parsed = parseUnscaledLayoutRaw(raw);
  if (parsed === undefined) return Math.trunc(fallbackValue);
  return getStableDisplayedLayoutValue(parsed, scale);
}

export function formatDisplayedLayoutUnscaledValue(raw: string | undefined, displayValue: number, scale: number): string {
  const trimmed = raw?.trim();
  if (trimmed && parseUnscaledLayoutRaw(trimmed) === undefined) {
    return trimmed;
  }
  return String(unscaleDisplayedLayoutValue(displayValue, scale));
}

export function commitDisplayedLayoutValue(displayValue: number, scale: number): DisplayedLayoutValueCommit {
  const nextDisplayValue = Math.trunc(displayValue);
  const unscaledValue = unscaleDisplayedLayoutValue(nextDisplayValue, scale);
  return {
    displayValue: nextDisplayValue,
    unscaledValue,
    raw: String(unscaledValue),
  };
}

export function commitDisplayedLayoutPoint(x: number, y: number, scale: number): DisplayedLayoutPointCommit {
  const xCommit = commitDisplayedLayoutValue(x, scale);
  const yCommit = commitDisplayedLayoutValue(y, scale);
  return {
    x: xCommit.displayValue,
    y: yCommit.displayValue,
    xUnscaled: xCommit.unscaledValue,
    yUnscaled: yCommit.unscaledValue,
    xRaw: xCommit.raw,
    yRaw: yCommit.raw,
  };
}

export function commitDisplayedLayoutRect(x: number, y: number, w: number, h: number, scale: number): DisplayedLayoutRectCommit {
  const point = commitDisplayedLayoutPoint(x, y, scale);
  const wCommit = commitDisplayedLayoutValue(w, scale);
  const hCommit = commitDisplayedLayoutValue(h, scale);
  return {
    ...point,
    w: wCommit.displayValue,
    h: hCommit.displayValue,
    wUnscaled: wCommit.unscaledValue,
    hUnscaled: hCommit.unscaledValue,
    wRaw: wCommit.raw,
    hRaw: hCommit.raw,
  };
}
