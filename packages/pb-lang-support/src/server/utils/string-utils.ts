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

/**
 * Returns the PureBasic identifier at `character` within `line`.
 *
 * Rules:
 *  - Word characters: `[a-zA-Z0-9_]`
 *  - A leading `#` is included so that constants such as `#MyConst` are
 *    returned as a whole.
 *  - `::` is NOT part of the word — module context is resolved separately
 *    by the caller (e.g. via getModuleCallFromPosition).
 *
 * @returns The identifier string, or `null` when the cursor is not on an
 *          identifier character.
 */
export function getWordAtPosition(line: string, character: number): string | null {
    let start = character;
    let end = character;

    // Scan backward over identifier characters
    while (start > 0 && /[a-zA-Z0-9_]/.test(line[start - 1])) {
        start--;
    }

    // Include leading '#' for PureBasic constants (e.g. #MyConst)
    if (start > 0 && line[start - 1] === '#') {
        start--;
    }

    // Scan forward over identifier characters
    while (end < line.length && /[a-zA-Z0-9_]/.test(line[end])) {
        end++;
    }

    if (start === end) return null;

    return line.substring(start, end);
}

/**
 * Normalizes a constant name.
 *
 * Removes an optional trailing `$` character
 * and converts the entire string to lowercase.
 *
 * @param name - The constant name to normalize.
 * @returns The cleaned and lowercased name.
 *
 * @example
 * normalizeConstantName("VALUE$") // "value"
 * normalizeConstantName("TEST")   // "test"
 */
export function normalizeConstantName(name: string): string {
    return name.replace(/\$$/, '').toLowerCase();
}

/** Result of resolving a Module::Symbol or Module::#Const reference at a cursor position. */
export interface ModuleSymbolMatch {
    moduleName: string;
    symbolName: string;
    /** true when the matched form was Module::#Const, false for Module::Symbol */
    isConstant: boolean;
}

/**
 * Resolves a `Module::Symbol` or `Module::#Const` reference at the cursor position.
 *
 * Two-pass strategy: constant form (`Module::#Ident`) is preferred so the
 * `#`-prefix is never swallowed by the plain-identifier pattern.
 *
 * @param line      The source line text.
 * @param character 0-based cursor column.
 */
export function getModuleSymbolAtPosition(
    line: string,
    character: number
): ModuleSymbolMatch | null {
    let m: RegExpExecArray | null;

    // Pass 1 – prefer constant form  Module::#Const
    const constRe = /(\w+)::#(\w+)/g;
    while ((m = constRe.exec(line)) !== null) {
        const start = m.index;
        const end   = start + m[0].length;
        if (character >= start && character <= end) {
            return { moduleName: m[1], symbolName: m[2], isConstant: true };
        }
    }

    // Pass 2 – plain form  Module::Ident
    const identRe = /(\w+)::(\w+)/g;
    while ((m = identRe.exec(line)) !== null) {
        const start = m.index;
        const end   = start + m[0].length;
        if (character >= start && character <= end) {
            return { moduleName: m[1], symbolName: m[2], isConstant: false };
        }
    }

    return null;
}