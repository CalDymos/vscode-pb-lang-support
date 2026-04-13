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
 *   3. No PeekS(@<varname>) assignment is found between the API call and the
 *      next API call / Space() re-assignment / end of document.
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
 *
 * Complexity:
 *   O(n · k) where n = line count and k = number of distinct Space()-assigned
 *   variables visible at any one time.  In practice k ≪ n, so the algorithm
 *   is effectively linear.  The previous three-pass approach was O(n²) in the
 *   worst case because Pass 3 re-scanned the document for each API call site.
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
 * Describes a detected Win32 API call site within a line.
 *
 * Returned by `findApiCallWithAddr` and stored in `VarState` so that
 * `buildDiagnostic` can produce an accurate character range.
 */
interface ApiCallMatch {
    /** Index of the first character of the function name in the line. */
    index: number;
    /** Index one past the closing ')' of the call. */
    end: number;
}

/**
 * Searches `line` for a Win32 API call (identifier ending with `_`) whose
 * argument list contains `@varNameLower$` at any nesting depth, outside a
 * string literal.
 *
 * Unlike the previous `[^)]*`-based regex this handles nested calls such as
 *   SomeApi_(Len(buf$), @buf$)
 * by maintaining paren-depth state while honouring PureBasic string rules.
 *
 * @param line          The stripped source line (no trailing comment).
 * @param varNameLower  The lowercase variable name (without `$` sigil).
 * @returns             The outermost matching call's span, or `null`.
 */
function findApiCallWithAddr(line: string, varNameLower: string): ApiCallMatch | null {
    const target = ('@' + varNameLower + '$').toLowerCase();
    const lline  = line.toLowerCase();
    const n      = line.length;

    // ── Forward scanner state ────────────────────────────────────────────────
    let inString = false;
    let isEscape = false;
    let depth    = 0;

    // Stack of open API calls.  Each entry records where the call name starts
    // and the paren depth at which the '(' was found (= depth after increment).
    const stack: Array<{ nameStart: number; openDepth: number }> = [];

    for (let i = 0; i < n; i++) {
        const ch = line[i];

        if (inString) {
            if (ch === '"') {
                if (isEscape) {
                    // Count consecutive backslashes before this '"'.
                    let bs = 0;
                    let k  = i - 1;
                    while (k >= 0 && line[k] === '\\') { bs++; k--; }
                    if (bs % 2 !== 0) { continue; } // escaped '"' stays in string
                }
                inString = false;
                isEscape = false;
            }
            continue; // parens inside strings do not affect depth
        }

        if (ch === '"') {
            inString = true;
            isEscape = i > 0 && line[i - 1] === '~';
            continue;
        }

        if (ch === '(') {
            depth++;

            // Check whether this '(' belongs to a Win32 API call:
            //   identifier ending with '_', optionally preceded by whitespace.
            let j = i - 1;
            while (j >= 0 && (line[j] === ' ' || line[j] === '\t')) { j--; }

            if (j >= 0 && line[j] === '_') {
                // Walk back over the full identifier.
                let k = j - 1;
                while (k >= 0 && /\w/.test(line[k])) { k--; }
                const nameStart = k + 1;
                // Identifier must start with a letter or underscore.
                if (/[A-Za-z_]/.test(line[nameStart])) {
                    stack.push({ nameStart, openDepth: depth });
                }
            }
            continue;
        }

        if (ch === ')') {
            // Check whether the top of the stack opened at the current depth.
            if (stack.length > 0 && stack[stack.length - 1].openDepth === depth) {
                const call      = stack.pop()!;
                const spanStart = call.nameStart;
                const spanEnd   = i + 1;          // inclusive of ')'
                const span      = lline.slice(spanStart, spanEnd);
                let   searchPos = 0;

                // Walk every occurrence of @varNameLower$ in this span.
                // The first one not inside a string literal is a real match.
                while (true) {
                    const tPos = span.indexOf(target, searchPos);
                    if (tPos === -1) { break; }
                    const absPos = spanStart + tPos;
                    if (!isPositionInString(line, absPos)) {
                        return { index: spanStart, end: spanEnd };
                    }
                    searchPos = tPos + 1;
                }
            }
            depth--;
        }
    }

    return null;
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
// State tracked per Space()-assigned variable during the single pass
// ---------------------------------------------------------------------------

interface VarState {
    /** Original casing for diagnostic messages. */
    varNameOriginal: string;
    /** Lowercase variable name — passed to findApiCallWithAddr(). */
    varNameLower: string;
    /** Line on which the most recent Space() assignment was seen. */
    assignLine: number;
    /**
     * Line of the most recent API call that has not yet been followed by a
     * PeekS() fix.  `null` means no open API call is pending.
     */
    pendingApiLine: number | null;
    /** Span of the call at pendingApiLine — used to compute the diagnostic range. */
    pendingApiMatch: ApiCallMatch | null;
    /** Compiled per-variable regex for PeekS() fix detection. */
    peekSRe: RegExp;
}

// ---------------------------------------------------------------------------
// Diagnostic factory
// ---------------------------------------------------------------------------

function buildDiagnostic(
    sv: VarState,
    apiLine: number,
    rawLine: string,
    apiMatch: ApiCallMatch | null,
): Diagnostic {
    const charStart = apiMatch ? apiMatch.index : 0;
    const charEnd   = apiMatch ? apiMatch.end   : rawLine.length;
    return {
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
    };
}

// ---------------------------------------------------------------------------
// Validator entry point
// ---------------------------------------------------------------------------

/**
 * Analyses the full document text for Space()-as-API-buffer patterns that
 * are missing the required PeekS() length fixup (mandatory since PB 6.40).
 *
 * Returns zero or more Warning diagnostics, one per unguarded API call site.
 *
 * The implementation uses a single forward pass with a per-variable state
 * machine instead of the previous nested multi-pass approach, keeping runtime
 * proportional to O(n · k) rather than O(n²).
 */
export function validateSpaceApiBuffers(text: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = text.split(/\r?\n/);

    /**
     * Live tracking map: lowercase variable name → state.
     * Entries are created on first Space() assignment and updated in-place
     * on subsequent re-assignments, API calls, or PeekS fixes.
     */
    const tracked = new Map<string, VarState>();

    for (let i = 0; i < lines.length; i++) {
        const raw      = lines[i];
        const stripped = stripInlineComment(raw).trimEnd();

        // ── Space() assignment? ────────────────────────────────────────────
        // Check this before the per-variable loop: a re-assignment to a
        // tracked variable must flush any pending diagnostic and reset state
        // before we process the same line for other tracked variables.
        const spaceM = SPACE_ASSIGN_RE.exec(stripped);
        if (spaceM && !isPositionInString(stripped, spaceM.index)) {
            const key      = spaceM[1].toLowerCase();
            const existing = tracked.get(key);

            if (existing?.pendingApiLine != null) {
                // The previous API call was never followed by PeekS().
                // The re-assignment stops the buffer's lifetime here, but the
                // API call was still unguarded → emit the warning.
                diagnostics.push(buildDiagnostic(
                    existing,
                    existing.pendingApiLine,
                    lines[existing.pendingApiLine],
                    existing.pendingApiMatch,
                ));
            }

            // Create or reset state for this variable.  assignLine = i means
            // the inner loop below skips this var for the current line
            // (i <= sv.assignLine → true), avoiding self-interference.
            tracked.set(key, {
                varNameOriginal: spaceM[1],
                varNameLower:    key,
                assignLine:      i,
                pendingApiLine:  null,
                pendingApiMatch: null,
                peekSRe:         makePeekSRe(key),
            });

            // Do not skip the rest of the loop iteration: other tracked
            // variables may have API calls or PeekS fixes on the same line.
        }

        // ── Per-variable state transitions ────────────────────────────────
        for (const sv of tracked.values()) {
            // Only examine lines that come after this variable's assignment.
            if (i <= sv.assignLine) { continue; }

            // Priority 1 — PeekS fix clears a pending API call.
            if (sv.pendingApiLine != null && sv.peekSRe.test(stripped)) {
                sv.pendingApiLine  = null;
                sv.pendingApiMatch = null;
                continue; // nothing else to check for this var on this line
            }

            // Priority 2 — API call site.
            const apiM = findApiCallWithAddr(stripped, sv.varNameLower);
            if (apiM) {
                if (sv.pendingApiLine != null) {
                    // A previous API call was not fixed before this one → warn.
                    diagnostics.push(buildDiagnostic(
                        sv,
                        sv.pendingApiLine,
                        lines[sv.pendingApiLine],
                        sv.pendingApiMatch,
                    ));
                }
                sv.pendingApiLine  = i;
                sv.pendingApiMatch = apiM;
            }
        }
    }

    // ── End of document: flush any still-pending API calls ─────────────────
    for (const sv of tracked.values()) {
        if (sv.pendingApiLine != null) {
            diagnostics.push(buildDiagnostic(
                sv,
                sv.pendingApiLine,
                lines[sv.pendingApiLine],
                sv.pendingApiMatch,
            ));
        }
    }

    return diagnostics;
}