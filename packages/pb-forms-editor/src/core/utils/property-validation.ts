import { isPbStringLiteral } from "../parser/pb-string";

export const PB_VARIABLE_INVALID_CHARS = [" ", ".", "-", "/", "\\", "|", "?", "!", "@", "£", "$", "="] as const;

const PB_VARIABLE_INVALID_CHAR_SET = new Set<string>(PB_VARIABLE_INVALID_CHARS);

export const PB_WRONG_VARIABLE_NAME_MESSAGE = "Wrong variable name. Spaces and . - / \\ | ? ! @ £ $ = are not allowed.";

export function findFirstInvalidPbVariableChar(value: string): string | undefined {
  for (const chr of value) {
    if (PB_VARIABLE_INVALID_CHAR_SET.has(chr)) {
      return chr;
    }
  }

  return undefined;
}

export function isValidPbVariableReference(value: string): boolean {
  return findFirstInvalidPbVariableChar(value) === undefined;
}

export function isPbStringLiteralRaw(raw: string | undefined): boolean {
  return isPbStringLiteral(raw);
}

export function requiresPbVariableValidation(raw: string | undefined): boolean {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed.length) return false;
  return !isPbStringLiteralRaw(trimmed);
}
