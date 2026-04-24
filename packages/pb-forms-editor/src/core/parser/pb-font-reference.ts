export type ParsedPbFontReference = {
  fontRaw?: string;
  fontId?: string;
};

export function parsePbFontReference(raw: string | undefined): ParsedPbFontReference {
  const fontRaw = raw?.trim();
  if (!fontRaw) return {};

  const fontIdMatch = /^FontID\((.+)\)$/i.exec(fontRaw);
  const fontId = fontIdMatch?.[1]?.trim() || fontRaw;

  return {
    fontRaw,
    fontId: fontId.length ? fontId : undefined,
  };
}
