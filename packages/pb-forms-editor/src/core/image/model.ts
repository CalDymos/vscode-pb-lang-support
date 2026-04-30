import { PB_ANY, type FormImage, type FormMenu, type FormStatusBar, type FormToolBar, type Gadget } from "../model";
import { isPbStringLiteral } from "../parser/pb-string";

export const FORM_IMAGE_CALL = {
  LoadImage: "LoadImage",
  CatchImage: "CatchImage",
} as const;

export type FormImageCall = typeof FORM_IMAGE_CALL[keyof typeof FORM_IMAGE_CALL];

export interface FormImageInlineLike {
  inline: boolean;
}

export interface FormImagePathLike extends FormImageInlineLike {
  imageRaw?: string;
}

export interface FormImageIdentityLike {
  pbAny?: boolean;
  id?: string;
  variable?: string;
  firstParam?: string;
}

export interface FormImageAssignedVarLike {
  id?: string;
  variable?: string;
}

export interface FormImageEditorDraft {
  sourceLine: number;
  inline: boolean;
  idRaw: string;
  imageRaw: string;
  assignedVar: string;
}

export function getFormImageCallName(entry: FormImageInlineLike): FormImageCall {
  return entry.inline ? FORM_IMAGE_CALL.CatchImage : FORM_IMAGE_CALL.LoadImage;
}

export function isCatchImageEntry(entry: FormImageInlineLike | undefined): boolean {
  return Boolean(entry?.inline);
}

export function isLoadImageEntry(entry: FormImageInlineLike | undefined): boolean {
  return Boolean(entry && !entry.inline);
}

export function canChooseFileForFormImageEntry(entry: FormImageInlineLike | undefined): boolean {
  return isLoadImageEntry(entry);
}

export function canRelativizeFormImageEntry(entry: FormImagePathLike | undefined): boolean {
  return Boolean(entry && !entry.inline && isPbStringLiteral(entry.imageRaw));
}

export function canToggleFormImagePbAny(entry: FormImageIdentityLike | undefined): boolean {
  if (!entry) return false;

  if (entry.pbAny) {
    return Boolean((entry.variable ?? entry.id ?? "").trim().length);
  }

  return Boolean(entry.firstParam?.trim().length);
}

export function getFormImageAssignedVarFallback(entry: FormImageAssignedVarLike | undefined, fallback = "imgNew"): string {
  return entry?.variable ?? entry?.id ?? fallback;
}

export function buildFormImageEditorDraft(entry: FormImage, fallbackAssignedVar = "imgNew"): FormImageEditorDraft {
  return {
    sourceLine: entry.source?.line ?? -1,
    inline: entry.inline,
    idRaw: entry.firstParam,
    imageRaw: entry.imageRaw,
    assignedVar: getFormImageAssignedVarFallback(entry, fallbackAssignedVar),
  };
}

export function buildFormImageLineLabel(entry: FormImage): string {
  const assignedPrefix = entry.pbAny && entry.variable ? `${entry.variable} = ` : "";
  return `${assignedPrefix}${getFormImageCallName(entry)}(${entry.firstParam}, ${entry.imageRaw})`;
}

export function requiresFormImageAssignedVar(idRaw: string): boolean {
  return idRaw.trim().toLowerCase() === PB_ANY.toLowerCase();
}


export type FormImageReferenceScope = "gadget" | "menu" | "toolbar" | "statusbar";

export type FormImageUsageSelection =
  | { kind: "gadget"; id: string }
  | { kind: "menuEntry"; menuId: string; entryIndex: number }
  | { kind: "toolBarEntry"; toolBarId: string; entryIndex: number }
  | { kind: "statusBarField"; statusBarId: string; fieldIndex: number };

export interface FormImageUsage {
  label: string;
  select: FormImageUsageSelection;
}

export interface FormImageReference {
  imageId: string;
  imageRaw: string;
}


export interface FormImageUsageDocumentLike {
  gadgets?: readonly Gadget[];
  menus?: readonly FormMenu[];
  toolbars?: readonly FormToolBar[];
  statusbars?: readonly FormStatusBar[];
}

export function buildFormImageIdReference(imageId: string): string | undefined {
  const trimmedId = imageId.trim();
  return trimmedId.length ? `ImageID(${trimmedId})` : undefined;
}

export function buildCreatedFormImageReference(idRaw: string, assignedVar?: string): FormImageReference | undefined {
  const trimmedId = idRaw.trim();
  if (!trimmedId.length) return undefined;

  if (requiresFormImageAssignedVar(trimmedId)) {
    const variableName = assignedVar?.trim();
    if (!variableName) return undefined;
    return {
      imageId: variableName,
      imageRaw: `ImageID(${variableName})`
    };
  }

  return {
    imageId: trimmedId,
    imageRaw: `ImageID(${trimmedId})`
  };
}

export function findFormImageEntryById(
  images: readonly FormImage[] | undefined,
  imageId: string | undefined
): FormImage | undefined {
  const trimmedId = imageId?.trim();
  if (!trimmedId) return undefined;
  return (images ?? []).find(entry => entry.id === trimmedId);
}

export function getDefaultFormImageReferenceSelection(
  images: readonly FormImage[] | undefined,
  currentImageId?: string
): string {
  const imageEntries = images ?? [];
  if (!imageEntries.length) return "";
  const trimmedCurrent = currentImageId?.trim();
  return trimmedCurrent && findFormImageEntryById(imageEntries, trimmedCurrent)
    ? trimmedCurrent
    : (imageEntries[0]?.id ?? "");
}

export function getFormImageReferenceHint(
  images: readonly FormImage[] | undefined,
  imageId?: string,
  scope: FormImageReferenceScope = "gadget"
): string {
  if (!imageId) {
    switch (scope) {
      case "menu":
      case "toolbar":
        return "This entry has no parsed image reference.";
      case "statusbar":
        return "This field has no parsed image reference.";
      default:
        return "This gadget has no parsed image reference.";
    }
  }

  if (!findFormImageEntryById(images, imageId)) {
    return `Referenced image '${imageId}' is not loaded in this form.`;
  }

  return "";
}

export function collectFormImageUsages(document: FormImageUsageDocumentLike, imageId: string): FormImageUsage[] {
  const trimmedId = imageId.trim();
  if (!trimmedId.length) return [];

  const usages: FormImageUsage[] = [];

  for (const g of document.gadgets ?? []) {
    if (g.imageId === trimmedId) {
      usages.push({
        label: `Gadget ${g.id} (${g.kind})`,
        select: { kind: "gadget", id: g.id }
      });
    }

    (g.items ?? []).forEach((it, idx) => {
      if (it.imageId === trimmedId) {
        const itemName = it.text ?? it.textRaw ?? `item ${idx}`;
        usages.push({
          label: `Gadget ${g.id} (${g.kind}) :: Item ${idx} ${itemName}`,
          select: { kind: "gadget", id: g.id }
        });
      }
    });
  }

  for (const m of document.menus ?? []) {
    (m.entries ?? []).forEach((entry, idx) => {
      if (entry.iconId === trimmedId) {
        const entryName = entry.idRaw ?? entry.text ?? entry.textRaw ?? `entry ${idx}`;
        usages.push({
          label: `Menu ${m.id} :: ${entry.kind} ${entryName}`,
          select: { kind: "menuEntry", menuId: m.id, entryIndex: idx }
        });
      }
    });
  }

  for (const t of document.toolbars ?? []) {
    (t.entries ?? []).forEach((entry, idx) => {
      if (entry.iconId === trimmedId) {
        const entryName = entry.idRaw ?? entry.text ?? entry.textRaw ?? `entry ${idx}`;
        usages.push({
          label: `ToolBar ${t.id} :: ${entry.kind} ${entryName}`,
          select: { kind: "toolBarEntry", toolBarId: t.id, entryIndex: idx }
        });
      }
    });
  }

  for (const sb of document.statusbars ?? []) {
    (sb.fields ?? []).forEach((field, idx) => {
      if (field.imageId === trimmedId) {
        usages.push({
          label: `StatusBar ${sb.id} :: Field ${idx}`,
          select: { kind: "statusBarField", statusBarId: sb.id, fieldIndex: idx }
        });
      }
    });
  }

  return usages;
}

export function countFormImageUsages(document: FormImageUsageDocumentLike, imageId: string): number {
  return collectFormImageUsages(document, imageId).length;
}
