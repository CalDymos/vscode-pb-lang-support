/**
 * Strips BOM and normalizes CRLF → LF.
 * Use in test assertions whenever fixture content is compared as a string.
 */
export function stripBomAndToLf(text: string): string {
  return text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
}