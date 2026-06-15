export interface ParsedFormImageReference {
  imageRaw?: string;
  imageId?: string;
}

export function parseFormImageReference(raw: string | undefined): ParsedFormImageReference {
  const imageRaw = raw?.trim();
  if (!imageRaw) return {};

  const imageIdMatch = /^ImageID\((.+)\)$/i.exec(imageRaw);
  const imageId = imageIdMatch?.[1]?.trim() || imageRaw;

  return {
    imageRaw,
    imageId: imageId.length ? imageId : undefined
  };
}

export function parseFormImageIdReference(raw: string | undefined): ParsedFormImageReference {
  const imageRaw = raw?.trim();
  if (!imageRaw) return {};

  const imageIdMatch = /^ImageID\((.+)\)$/i.exec(imageRaw);
  const imageId = imageIdMatch?.[1]?.trim();

  return {
    imageRaw,
    imageId: imageId?.length ? imageId : undefined
  };
}

export function isFormImageIdReference(raw: string | undefined): boolean {
  return Boolean(parseFormImageIdReference(raw).imageId);
}

export function isEmptyFormImageReference(raw: string | undefined): boolean {
  const imageRaw = raw?.trim();
  return !imageRaw || imageRaw === "0";
}
