import type { PreviewRect } from "../preview/chrome";
import type { Gadget } from "../model";
import { parseDesignerLayoutRaw } from "../parser/layout-raw";

const HEIGHT_REFERENCE_RE = /FormWindowHeight|WindowHeight|GadgetHeight|GetGadgetAttribute/i;
const WIDTH_REFERENCE_RE = /FormWindowWidth|WindowWidth|GadgetWidth|GetGadgetAttribute/i;

export type GadgetCtorLocks = {
  lockLeft: boolean;
  lockRight: boolean;
  lockTop: boolean;
  lockBottom: boolean;
};

export function usesWidthLayoutReference(raw: string | undefined): boolean {
  const trimmed = raw?.trim();
  if (!trimmed?.length) return false;
  return WIDTH_REFERENCE_RE.test(trimmed);
}

export function usesHeightLayoutReference(raw: string | undefined): boolean {
  const trimmed = raw?.trim();
  if (!trimmed?.length) return false;
  return HEIGHT_REFERENCE_RE.test(trimmed);
}

export function inferGadgetCtorLocks(raws: {
  xRaw?: string;
  yRaw?: string;
  wRaw?: string;
  hRaw?: string;
}): GadgetCtorLocks {
  let lockLeft = true;
  let lockRight = false;
  let lockTop = true;
  let lockBottom = false;

  if (usesWidthLayoutReference(raws.xRaw)) {
    lockLeft = false;
    lockRight = true;
  }

  if (usesHeightLayoutReference(raws.yRaw)) {
    lockTop = false;
    lockBottom = true;
  }

  if (usesWidthLayoutReference(raws.wRaw)) {
    lockLeft = true;
    lockRight = true;
  }

  if (usesHeightLayoutReference(raws.hRaw)) {
    lockTop = true;
    lockBottom = true;
  }

  return {
    lockLeft,
    lockRight,
    lockTop,
    lockBottom,
  };
}

function resolveDesignerCtorAxis(
  raw: string | undefined,
  field: "x" | "y" | "w" | "h",
  storedValue: number,
  extent: number
): number {
  const parsed = parseDesignerLayoutRaw(raw, field);
  if (typeof parsed !== "number") {
    return storedValue;
  }

  if (field === "x" || field === "w") {
    if (!usesWidthLayoutReference(raw)) {
      return storedValue;
    }
    return extent - parsed;
  }

  if (!usesHeightLayoutReference(raw)) {
    return storedValue;
  }
  return extent - parsed;
}

export function resolveGadgetCtorPreviewLocalRect(
  gadget: Pick<Gadget, "x" | "y" | "w" | "h" | "xRaw" | "yRaw" | "wRaw" | "hRaw">,
  extentWidth: number,
  extentHeight: number
): PreviewRect {
  const x = resolveDesignerCtorAxis(gadget.xRaw, "x", gadget.x, extentWidth);
  const y = resolveDesignerCtorAxis(gadget.yRaw, "y", gadget.y, extentHeight);
  const w = Math.max(0, resolveDesignerCtorAxis(gadget.wRaw, "w", gadget.w, extentWidth));
  const h = Math.max(0, resolveDesignerCtorAxis(gadget.hRaw, "h", gadget.h, extentHeight));

  return { x, y, w, h };
}
