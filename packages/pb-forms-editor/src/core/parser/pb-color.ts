import { asNumber, splitParams } from "./tokenizer";

export type ParsedPbColorLiteral = {
  format: "hex" | "rgb";
  raw: string;
  previewColor: number;
  red?: number;
  green?: number;
  blue?: number;
};

export function parsePbColorLiteral(raw?: string): ParsedPbColorLiteral | undefined {
  const colorRaw = raw?.trim();
  if (!colorRaw) return undefined;

  if (/^\$[0-9a-f]+$/i.test(colorRaw)) {
    const n = Number.parseInt(colorRaw.slice(1), 16);
    if (!Number.isFinite(n)) return undefined;
    return {
      format: "hex",
      raw: colorRaw,
      previewColor: n & 0xffffff
    };
  }

  const rgbMatch = /^RGB\((.+)\)$/i.exec(colorRaw);
  if (!rgbMatch) return undefined;

  const parts = splitParams(rgbMatch[1] ?? "");
  if (parts.length !== 3) return undefined;

  const red = asNumber(parts[0] ?? "");
  const green = asNumber(parts[1] ?? "");
  const blue = asNumber(parts[2] ?? "");
  if ([red, green, blue].some((channel) => !Number.isInteger(channel) || (channel as number) < 0 || (channel as number) > 255)) {
    return undefined;
  }

  return {
    format: "rgb",
    raw: colorRaw,
    previewColor: ((blue as number) << 16) | ((green as number) << 8) | (red as number),
    red: red as number,
    green: green as number,
    blue: blue as number
  };
}
