import { quotePbString, unquoteString } from "./tokenizer";

const PB_STRING_LITERAL_RE = /^~?"(?:[^"]|"")*"$/;

export function isPbStringLiteral(raw?: string): boolean {
  return PB_STRING_LITERAL_RE.test(raw?.trim() ?? "");
}

export function parsePbStringLiteral(raw?: string): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed || !isPbStringLiteral(trimmed)) return undefined;
  return unquoteString(trimmed);
}

export function toPbStringLiteral(value: string): string {
  return quotePbString(value);
}
