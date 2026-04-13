/**
 * Space() API-buffer validator (PureBasic 6.40+)
 *
 * Background:
 *   PureBasic 6.40 reworked the internal string manager. Strings now carry a
 *   cached length prefix, so the runtime no longer stops at the first null
 *   character. A common Win32 idiom was:
 *
 *     buf$ = Space(MAX_PATH)
 *     GetCurrentDirectory_(MAX_PATH, @buf$)
 *     ; use buf$  ← length is still MAX_PATH, not the actual API result!
 *
 *   After 6.40 the returned string must be re-read with PeekS() so the cached
 *   length is updated:
 *
 *     buf$ = Space(MAX_PATH)
 *     GetCurrentDirectory_(MAX_PATH, @buf$)
 *     buf$ = PeekS(@buf$)   ; ← fixes the cached length
 *
 * Detection heuristic (document-level, single pass):
 *   1. A string variable is assigned via Space():
 *        <varname>$ = Space(...)
 *   2. The same variable's address (@<varname>$) appears as an argument
 *      in a Win32 API call (identifier ending with _):
 *        SomeApiFunction_(<args>, @<varname>$, <more-args>)
 *   3. No PeekS(@<varname>) assignment is found anywhere after the API call
 *      in the same document.
 *
 * Severity: Warning  (the code may still work in many cases; this is
 *                     a migration hint, not a hard error).
 *
 * False-positive guard:
 *   - Matches inside string literals are ignored.
 *   - Space() used for display/padding (not passed as @addr to an API) is
 *     never flagged.
 *   - The check is only done when @<var> appears in a call whose name ends
 *     with the underscore that marks Win32 API wrappers in PureBasic.
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { isPositionInString, stripInlineComment } from '../utils/pb-lexer-utils';
import { DIAGNOSTIC_SOURCE } from '../utils/constants';

// ---------------------------------------------------------------------------
// Regex constants (all case-insensitive)
// ---------------------------------------------------------------------------

/**
 * Matches:  <varname>$ = Space(...)
 * Groups:   [1] varname (without the $ sigil)
 *
 * Deliberately simple: just needs the sigil to confirm it is a string variable.
 * The leading \b avoids matching things like "SomePrefix_Var$ = Space(...)".
 */
const SPACE_ASSIGN_RE =
    /\b([A-Za-z_][A-Za-z0-9_]*)\$\s*=\s*Space\s*\(/i;

/**
 * Matches an API call that contains @<varname>$ as an argument.
 *   [1] API function name (must end with _)
 *   [2] varname (without $ sigil)  — captured inside the argument list
 *
 * The pattern looks for:
 *   <Word>_(   ...   @<varname>$   ...   )
 *
 * A trailing \$ on the address operand is mandatory to avoid matching
 * integer-variable addresses such as @count.
 */
function makeApiCallRe(varName: string): RegExp {
    const v = escapeRegExp(varName);
    // \b[A-Za-z]\w*_ : API function name ending with underscore
    // [^)]*           : any arguments before/after our variable
    // @<varname>\$    : address-of the string variable
    return new RegExp(
        `\\b[A-Za-z_]\\w*_\\s*\\([^)]*@${v}\\$[^)]*\\)`,
        'i'
    );
}

/**
 * Matches:  <varname>$ = PeekS(@<varname>...)
 * Used to detect the fix pattern after an API call.
 */
function makePeekSRe(varName: string): RegExp {
    const v = escapeRegExp(varName);
    return new RegExp(
        `\\b${v}\\$\\s*=\\s*PeekS\\s*\\(\\s*@${v}\\$`,
        'i'
    );
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Validator entry point
// ---------------------------------------------------------------------------

/**
 * Analyses the full document text for Space()-as-API-buffer patterns that
 * are missing the required PeekS() length fixup (mandatory since PB 6.40).
 *
 * Returns zero or more Warning diagnostics, one per unguarded API call site.
 */
export function validateSpaceApiBuffers(text: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = text.split(/\r?\n/);

    // ── Pass 1: collect variables assigned via Space() ──────────────────────

    interface SpaceVar {
        varName: string;        // canonical lower-case name
        varNameOriginal: string;
        assignLine: number;
    }

    const spaceVars: SpaceVar[] = [];

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const stripped = stripInlineComment(raw).trimEnd();

        const m = SPACE_ASSIGN_RE.exec(stripped);
        if (!m) continue;

        const matchIdx = m.index;
        if (isPositionInString(stripped, matchIdx)) continue;

        spaceVars.push({
            varName: m[1].toLowerCase(),
            varNameOriginal: m[1],
            assignLine: i,
        });
    }

    if (spaceVars.length === 0) return diagnostics;

    // ── Pass 2: for each Space() variable, find API call sites ──────────────

    for (const sv of spaceVars) {
        const apiRe    = makeApiCallRe(sv.varName);
        const peekSRe  = makePeekSRe(sv.varName);

        // Collect all API call lines after the Space() assignment
        const apiCallLines: number[] = [];

        for (let i = sv.assignLine + 1; i < lines.length; i++) {
            const raw = lines[i];
            const stripped = stripInlineComment(raw).trimEnd();

            const m = apiRe.exec(stripped);
            if (!m) continue;
            if (isPositionInString(stripped, m.index)) continue;

            apiCallLines.push(i);
        }

        if (apiCallLines.length === 0) continue;

        // ── Pass 3: for each API call, check for PeekS after it ─────────────

        for (const apiLine of apiCallLines) {
            let hasPeekS = false;

            for (let j = apiLine + 1; j < lines.length; j++) {
                const raw = lines[j];
                const stripped = stripInlineComment(raw).trimEnd();

                if (peekSRe.test(stripped)) {
                    hasPeekS = true;
                    break;
                }

                // Stop at a new Space() assignment to the same variable
                // (re-assignment resets the buffer; no need to look further).
                if (SPACE_ASSIGN_RE.exec(stripped)?.[1]?.toLowerCase() === sv.varName) {
                    break;
                }
            }

            if (hasPeekS) continue;

            // ── Emit warning at the API call line ────────────────────────────

            const originalLine = lines[apiLine];
            const m = apiRe.exec(stripInlineComment(originalLine).trimEnd())!;
            const charStart = m ? m.index : 0;
            const charEnd   = m ? m.index + m[0].length : originalLine.length;

            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: {
                    start: { line: apiLine, character: charStart },
                    end:   { line: apiLine, character: charEnd },
                },
                message:
                    `'${sv.varNameOriginal}$' was allocated with Space() and its address is ` +
                    `passed to a Win32 API. Since PureBasic 6.40 the string length cache is not ` +
                    `updated by the API write. Add:\n` +
                    `  ${sv.varNameOriginal}$ = PeekS(@${sv.varNameOriginal}$)\n` +
                    `after the API call to fix the cached length.\n` +
                    `See: https://www.purebasic.com/documentation/reference/migration_630_640.html`,
                source: DIAGNOSTIC_SOURCE,
            });
        }
    }

    return diagnostics;
}
