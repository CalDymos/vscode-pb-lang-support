import { parsePbStringLiteral } from "../parser/pb-string";
import { quotePbString } from "../parser/tokenizer";

export interface StatusBarCurrentImageEditCandidate {
  id?: string;
  imageRaw?: string;
  image?: string;
  inline?: boolean;
  source?: { line: number };
}

export interface StatusBarCurrentImageEditState {
  canDirectEdit: boolean;
  reason?: string;
}

export interface StatusBarCurrentImageRebindCandidate {
  id: string;
  imageRaw: string;
  image?: string;
  inline?: boolean;
  source?: { line: number };
}

export interface StatusBarCurrentImageRebindResolution {
  matchedImage?: StatusBarCurrentImageRebindCandidate;
  reason?: string;
}

export interface StatusBarCurrentImageCreateResolution {
  imageIdRaw?: string;
  imageRaw?: string;
  reason?: string;
}

function parseCurrentImageLoadPath(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed.length) return undefined;

  const literal = parsePbStringLiteral(trimmed);
  if (literal !== undefined) {
    return literal;
  }

  if (/[.\/]/.test(trimmed)) {
    return trimmed;
  }

  return undefined;
}

function sanitizeImageWindowBase(windowVariable: string | undefined, windowId: string | undefined): string {
  const rawBase = (windowVariable?.trim() || windowId?.trim().replace(/^#/, '') || 'FormWindow')
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/^_+/, '');

  const safeBase = rawBase.length ? rawBase : 'FormWindow';
  return /^\d/.test(safeBase) ? `FormWindow_${safeBase}` : safeBase;
}

export function buildNextGeneratedImageIdRaw(
  images: StatusBarCurrentImageRebindCandidate[],
  windowVariable: string | undefined,
  windowId: string | undefined
): string {
  const base = sanitizeImageWindowBase(windowVariable, windowId);
  const usedIds = new Set(images.map((candidate) => candidate.id.toLowerCase()));

  let index = 0;
  while (usedIds.has(`#img_${base}_${index}`.toLowerCase())) {
    index += 1;
  }

  return `#Img_${base}_${index}`;
}

/**
 * Normalizes user-visible CurrentImage values only for the statusbar rebind flow.
 *
 * This intentionally stays local instead of becoming a generic PB-string helper:
 * inline `CatchImage` labels strip leading `?`, while `LoadImage` values only
 * remove one outer quote pair so the rebind matcher can compare inspector input,
 * parsed `image`, and raw `imageRaw` consistently.
 */
function normalizeCurrentImageInput(raw: string, inline: boolean): string {
  const trimmed = raw.trim();
  if (!trimmed.length) return "";

  if (inline) {
    return trimmed.replace(/^\?+/, "").trim();
  }

  const quoted = /^"([\s\S]*)"$/.exec(trimmed);
  return quoted?.[1] ?? trimmed;
}

export function getStatusBarCurrentImageEditState(
  image: StatusBarCurrentImageEditCandidate | undefined,
  usageCount: number
): StatusBarCurrentImageEditState {
  if (!image) {
    return {
      canDirectEdit: false,
      reason: "This field has no parsed image entry. Use the image actions to assign one first."
    };
  }

  if (image.inline) {
    return {
      canDirectEdit: false,
      reason: "CurrentImage stays readonly for CatchImage entries. Use the image actions to rebind the field instead."
    };
  }

  if (typeof image.source?.line !== "number") {
    return {
      canDirectEdit: false,
      reason: "CurrentImage can only patch parsed LoadImage entries with a source line."
    };
  }

  if (usageCount > 1) {
    return {
      canDirectEdit: false,
      reason: "CurrentImage stays readonly while the referenced image is shared. Use the image actions to rebind only this field."
    };
  }

  return {
    canDirectEdit: true,
    reason: "Patch the referenced LoadImage path directly for this statusbar field."
  };
}

export function resolveStatusBarCurrentImageRebind(
  images: StatusBarCurrentImageRebindCandidate[],
  nextValue: string,
  currentImageId?: string
): StatusBarCurrentImageRebindResolution {
  const trimmed = nextValue.trim();
  if (!trimmed.length) {
    return {
      reason: "CurrentImage rebind requires a non-empty value."
    };
  }

  const matches = images.filter((candidate) => {
    const normalizedImage = normalizeCurrentImageInput(candidate.image ?? candidate.imageRaw, Boolean(candidate.inline));
    const normalizedRaw = normalizeCurrentImageInput(candidate.imageRaw, Boolean(candidate.inline));
    const normalizedInput = normalizeCurrentImageInput(trimmed, Boolean(candidate.inline));
    return normalizedInput === normalizedImage || normalizedInput === normalizedRaw;
  });

  if (!matches.length) {
    return {
      reason: "CurrentImage can only rebind to an existing parsed image entry here. Use Choose File or Create New for a new image path."
    };
  }

  const distinctIds = new Set(matches.map((candidate) => candidate.id));
  if (distinctIds.size > 1) {
    return {
      reason: "CurrentImage matches multiple parsed image entries. Use Use Existing to pick the intended target explicitly."
    };
  }

  const matchedImage = matches[0];
  if (matchedImage.id === currentImageId) {
    return {
      matchedImage,
      reason: "CurrentImage already points to this parsed image entry."
    };
  }

  return { matchedImage };
}


export function resolveStatusBarCurrentImageCreate(
  images: StatusBarCurrentImageRebindCandidate[],
  nextValue: string,
  windowId: string | undefined,
  windowVariable?: string
): StatusBarCurrentImageCreateResolution {
  const loadPath = parseCurrentImageLoadPath(nextValue);
  if (!loadPath) {
    return {
      reason: "CurrentImage can auto-create a new LoadImage entry here only for quoted or path-like file strings. Use Create New for inline labels or custom image ids."
    };
  }

  return {
    imageIdRaw: buildNextGeneratedImageIdRaw(images, windowVariable, windowId),
    imageRaw: quotePbString(loadPath),
  };
}

export function shouldCleanupStatusBarReboundImage(
  oldImageId: string | undefined,
  oldUsageCount: number,
  oldSourceLine: number | undefined,
  nextImageId: string | undefined,
): boolean {
  if (!oldImageId || !nextImageId) return false;
  if (oldImageId === nextImageId) return false;
  if (oldUsageCount !== 1) return false;
  return typeof oldSourceLine === "number";
}