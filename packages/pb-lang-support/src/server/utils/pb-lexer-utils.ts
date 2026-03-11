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

/* ========================================================================== */
/* PureBasic line string and comment scanning                                 */
/* ========================================================================== */

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

/* ========================================================================== */
/* Identifier and symbol extraction                                           */
/* ========================================================================== */

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

/**
 * Discriminated kind for a resolved Module::Symbol reference.
 *
 * - 'constant' – Module::#Const  (leading '#')
 * - 'function' – Module::Ident(  (opening parenthesis immediately follows)
 * - 'type'     – Module::Ident   (no '#', no '(' – Structure/Enum/Interface/…)
 */
export type ModuleSymbolKind = 'constant' | 'function' | 'type';

/** Result of resolving a Module::Symbol or Module::#Const reference at a cursor position. */
export interface ModuleSymbolMatch {
    moduleName: string;
    symbolName: string;
    kind: ModuleSymbolKind;
}

/**
 * Resolves a `Module::Symbol` or `Module::#Const` reference at the cursor position.
 *
 * Three-pass strategy (highest priority first):
 *   1. `Module::#Const`  → kind 'constant'
 *   2. `Module::Ident(`  → kind 'function'  (opening paren immediately follows)
 *   3. `Module::Ident`   → kind 'type'      (Structure / Enum / Interface / …)
 *
 * @param line      The source line text.
 * @param character 0-based cursor column.
 */
export function getModuleSymbolAtPosition(
    line: string,
    character: number
): ModuleSymbolMatch | null {
    let m: RegExpExecArray | null;

    // Pass 1 – constant form  Module::#Const
    const constRe = /(\w+)::#(\w+)/g;
    while ((m = constRe.exec(line)) !== null) {
        const start = m.index;
        const end   = start + m[0].length;
        if (character >= start && character <= end) {
            return { moduleName: m[1], symbolName: m[2], kind: 'constant' };
        }
    }

    // Pass 2 – plain form  Module::Ident  (function or type)
    const identRe = /(\w+)::(\w+)/g;
    while ((m = identRe.exec(line)) !== null) {
        const start = m.index;
        const end   = start + m[0].length;
        if (character >= start && character <= end) {
            // Classify as function when an opening parenthesis immediately follows
            // (skipping optional whitespace to be robust against `Func (` style).
            const tail = line.substring(end).trimStart();
            const kind: ModuleSymbolKind = tail.startsWith('(') ? 'function' : 'type';
            return { moduleName: m[1], symbolName: m[2], kind };
        }
    }

    return null;
}

/**
 * Strips the pointer prefix (`*`) and any function-call suffix (`(...)`) from
 * a variable name so it can be looked up in the scope-manager's variable list.
 *
 * @example
 * normalizeVarName('*myPtr')      // 'myPtr'
 * normalizeVarName('getVar()')    // 'getVar'
 * normalizeVarName('myVar')       // 'myVar'
 */
export function normalizeVarName(n: string): string {
    return n.replace(/^\*/, '').replace(/\([^)]*\)$/, '');
}

/**
 * Detects a `varName\memberName` struct-member access at the given cursor column.
 *
 * Recognised forms:
 * - `myVar\member`          – plain variable
 * - `*myPtr\member`         – pointer variable
 * - `getResult()\member`    – function-call return value
 * - `*getPtr()\member`      – pointer returned from function
 *
 * @param line      The full source line text.
 * @param character 0-based cursor column.
 */
export function getStructAccessFromLine(
    line: string,
    character: number
): { varName: string; memberName: string } | null {
    const re = /([A-Za-z_][A-Za-z0-9_]*|\*[A-Za-z_][A-Za-z0-9_]*)(?:\([^)]*\))?\\(\w+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
        const start = m.index;
        const end   = start + m[0].length;
        if (character >= start && character <= end) {
            return { varName: m[1], memberName: m[2] };
        }
    }
    return null;
}

/* ========================================================================== */
/* Generic text helpers                                                       */
/* ========================================================================== */

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
 * Extracts the base structure type name from a `v.type` string produced by the
 * scope-manager's variable parser.
 *
 * The scope-manager stores type strings in the following forms:
 * - `"MyStruct"`             – plain type
 * - `"*MyStruct (pointer)"`  – pointer variable  (`Define *myVar.MyStruct`)
 * - `"MyStruct[] (array)"`   – Dim array         (`Dim myVar.MyStruct(10)`)
 *
 * Note: the `[]` suffix is added by the parser itself, NOT PureBasic syntax.
 * PureBasic arrays are declared with `()`. The `[` check here strips that
 * parser-internal suffix and must NOT be removed as dead code.
 *
 * @example
 * getBaseType('MyStruct')            // 'MyStruct'
 * getBaseType('*MyStruct (pointer)') // 'MyStruct'
 * getBaseType('MyStruct[] (array)')  // 'MyStruct'
 * getBaseType('')                    // ''
 */
export function getBaseType(typeStr: string): string {
    if (!typeStr) return '';
    const cleaned = typeStr.split(' ')[0];
    const noPtr = cleaned.startsWith('*') ? cleaned.substring(1) : cleaned;
    const arrIdx = noPtr.indexOf('[');
    return arrIdx > -1 ? noPtr.substring(0, arrIdx) : noPtr;
}