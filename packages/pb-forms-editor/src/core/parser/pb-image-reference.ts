export type ParsedPbImageReference = {
  imageRaw?: string;
  imageId?: string;
};

export function parsePbImageReference(raw: string | undefined): ParsedPbImageReference {
  const imageRaw = raw?.trim();
  if (!imageRaw) return {};

  const imageIdMatch = /^ImageID\((.+)\)$/i.exec(imageRaw);
  const imageId = imageIdMatch?.[1]?.trim() || imageRaw;

  return {
    imageRaw,
    imageId: imageId.length ? imageId : undefined
  };
}
