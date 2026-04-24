import { parsePbStringLiteral } from "./pb-string";

export function normalizePbImageValue(raw: string | undefined, inline: boolean): string | undefined {
  const valueRaw = raw?.trim();
  if (!valueRaw) return undefined;

  if (inline) {
    const label = valueRaw.replace(/^\?+/, "").trim();
    return label.length ? label : undefined;
  }

  return parsePbStringLiteral(valueRaw) ?? valueRaw;
}
