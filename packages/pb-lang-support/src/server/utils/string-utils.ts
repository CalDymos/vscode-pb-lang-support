/**
 * String processing utility functions for PureBasic source code.
 *
 * PureBasic string literal rules (verified against PureBasic reference):
 *
 *  1. Regular strings  "..."
 *     - Delimiter: double-quote '"' only.
 *     - The backslash '\' has NO special meaning. Every '"' terminates the string,
 *       even if a '\' immediately precedes it (e.g. "C:\folder\" ends at the last '"').
 *     - Single-quotes are NOT string delimiters. 'A' is an integer (ASCII) literal.
 *
 *  2. Escape strings   ~"..."
 *     - Introduced by a tilde '~' immediately before the opening '"'.
 *     - Supports escape sequences (\n, \t, \", \\, etc.).
 *     - Inside ~"...", '\"' does NOT terminate the string.
 *     - '\\' inside ~"..." is an escaped backslash, so '\\' followed by '"'
 *       DOES terminate the string (the backslash is consumed by '\\').
 */

/**
 * Returns true if the scanner is still inside an open string literal
 * at the end of `line`.
 *
 * Handles both regular "..." strings and escape ~"..." strings.
 * Single-quote characters are NOT treated as string delimiters.
 */
export function isInStringLiteral(line: string): boolean {
    return scanStringState(line, line.length).inString;
}

/**
 * Returns true if `position` (exclusive upper bound, i.e. the scanner runs
 * while i < position) lies inside a string literal on `line`.
 *
 * Handles both regular "..." strings and escape ~"..." strings.
 * Single-quote characters are NOT treated as string delimiters.
 */
export function isPositionInString(line: string, position: number): boolean {
    return scanStringState(line, position).inString;
}

/**
 * Shared scanner used by isInStringLiteral and isPositionInString.
 *
 * Tracks whether the character just before `limit` is inside a string literal.
 *
 * Algorithm:
 *  - A '"' that is NOT preceded by '~' starts a regular string.
 *    Inside a regular string every '"' terminates it (backslash has no meaning).
 *  - A '"' that IS preceded by '~' starts an escape string.
 *    Inside an escape string, '\"' is an escaped quote and does NOT terminate.
 *    To avoid mis-handling '\\\"' (escaped backslash + escaped quote) we count
 *    the number of consecutive backslashes immediately before '"':
 *    an even count means the backslashes are all paired → '"' terminates.
 *    an odd count means the last '\' escapes '"' → '"' does NOT terminate.
 */
function scanStringState(line: string, limit: number): { inString: boolean } {
    let inString = false;
    let isEscape = false;   // true when we are inside a ~"..." escape string

    for (let i = 0; i < line.length && i < limit; i++) {
        const char = line[i];

        if (!inString) {
            if (char === '"') {
                inString = true;
                // Escape string starts when '~' immediately precedes '"'
                isEscape = i > 0 && line[i - 1] === '~';
            }
        } else {
            if (char === '"') {
                if (isEscape) {
                    // Count consecutive backslashes immediately before this '"'
                    let bsCount = 0;
                    let k = i - 1;
                    while (k >= 0 && line[k] === '\\') { bsCount++; k--; }
                    // Odd count → this '"' is escaped → stay in string
                    if (bsCount % 2 !== 0) continue;
                }
                // Regular string: every '"' terminates. Escape string: unescaped '"' terminates.
                inString = false;
                isEscape = false;
            }
        }
    }

    return { inString };
}

/**
 * Strips the inline comment (;...) that lies outside of string literals.
 *
 * Handles both regular "..." strings and escape ~"..." strings.
 * Single-quote characters are NOT treated as string delimiters
 * (in PureBasic 'A' is an integer / ASCII literal, not a string).
 */
export function stripInlineComment(value: string): string {
    let inString = false;
    let isEscape = false;   // true when inside a ~"..." escape string

    for (let i = 0; i < value.length; i++) {
        const char = value[i];

        if (!inString) {
            if (char === '"') {
                inString = true;
                isEscape = i > 0 && value[i - 1] === '~';
            } else if (char === ';') {
                return value.substring(0, i);
            }
        } else {
            if (char === '"') {
                if (isEscape) {
                    // Count consecutive backslashes immediately before this '"'
                    let bsCount = 0;
                    let k = i - 1;
                    while (k >= 0 && value[k] === '\\') { bsCount++; k--; }
                    if (bsCount % 2 !== 0) continue; // escaped '"', stay in string
                }
                inString = false;
                isEscape = false;
            }
        }
    }
    return value;
}

/**
 * Returns a safe index for range calculations.
 * Falls back to 0 if the substring cannot be found.
 */
export function safeIndexOf(haystack: string, needle: string): number {
    const idx = haystack.indexOf(needle);
    return idx >= 0 ? idx : 0;
}

/**
 * Escape special characters in regular expressions
 */
export function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}