import { parsePbColorLiteral } from "../parser/pb-color";

export const WINDOW_COLOR_LITERAL_ERROR_MESSAGE = "Window Color accepts only RGB(r,g,b) or a $hex literal.";

export function pbColorNumberToCssHex(value: number | undefined): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const color = value & 0xffffff;
  const red = color & 0xff;
  const green = (color >> 8) & 0xff;
  const blue = (color >> 16) & 0xff;
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

export function cssHexToPbRgbRaw(value: string): string | undefined {
  const normalized = normalizeCssHexColor(value);
  if (!normalized) return undefined;
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  if ([red, green, blue].some((channel) => !Number.isFinite(channel))) return undefined;
  return `RGB(${red},${green},${blue})`;
}

export function normalizeCssHexColor(value: string | undefined): string | undefined {
  const raw = (value ?? "").trim();
  if (!/^#[0-9a-f]{6}$/i.test(raw)) return undefined;
  return raw.toLowerCase();
}

export function parseWindowColorInspectorInput(value: string | undefined):
  | { ok: true; raw?: string; previewColor?: number }
  | { ok: false } {
  const raw = (value ?? "").trim();
  if (!raw.length) return { ok: true, raw: undefined, previewColor: undefined };

  const parsed = parsePbColorLiteral(raw);
  if (!parsed) return { ok: false };
  if (parsed.format === "hex") return { ok: true, raw: parsed.raw, previewColor: parsed.previewColor };

  return {
    ok: true,
    raw: `RGB(${parsed.red},${parsed.green},${parsed.blue})`,
    previewColor: parsed.previewColor
  };
}

function toHex(value: number): string {
  return value.toString(16).padStart(2, "0");
}

export function getWindowColorInspectorDisplay(raw: string | undefined): string {
  return (raw ?? "").trim();
}
