import { PB_ANY, type FormImage } from "../model";
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
