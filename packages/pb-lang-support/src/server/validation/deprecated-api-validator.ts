/**
 * Deprecated API validator
 *
 * Detects usage of PureBasic constants and functions that have been
 * removed in newer versions and emits actionable error diagnostics.
 *
 * Current rules:
 *   - #PB_String_InPlace  removed in PureBasic 6.40
 */

import { DiagnosticSeverity } from 'vscode-languageserver/node';
import { ValidatorFunction } from './types';
import { DIAGNOSTIC_SOURCE } from '../utils/constants';
import { isPositionInString } from '../utils/pb-lexer-utils';

// ---------------------------------------------------------------------------
// Rule definitions
// ---------------------------------------------------------------------------

interface DeprecatedRule {
    /** Human-readable name used in the diagnostic message. */
    name: string;
    /** Case-insensitive regex that matches the deprecated token. */
    pattern: RegExp;
    /** Full diagnostic message shown to the user. */
    message: string;
}

const DEPRECATED_RULES: DeprecatedRule[] = [
    {
        name: '#PB_String_InPlace',
        // Match the constant as a whole word so that e.g.
        // "#PB_String_InPlaceExtra" is not flagged.
        // The `g` flag is required for the multi-match exec() loop below.
        pattern: /#PB_String_InPlace\b/gi,
        message:
            '#PB_String_InPlace was removed in PureBasic 6.40. ' +
            'Replace with: a$ = ReplaceString(a$, find$, replacement$)\n' +
            'See: https://www.purebasic.com/documentation/reference/migration_630_640.html',
    },
];

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Flags usage of deprecated / removed PureBasic API tokens.
 * Runs on every non-comment, non-empty line (after inline-comment stripping).
 */
export const validateDeprecatedApi: ValidatorFunction = (
    line,
    lineNum,
    originalLine,
    _context,
    diagnostics
) => {
    // Leading-whitespace offset: `line` is trimmed, `originalLine` is not.
    // Adding this offset translates a match index in `line` to the correct
    // character position inside `originalLine`.
    const leadingWhitespace = originalLine.length - originalLine.trimStart().length;

    for (const rule of DEPRECATED_RULES) {
        // Reset lastIndex so the global regex restarts from the beginning of
        // each new line (required when reusing /g regex instances).
        rule.pattern.lastIndex = 0;

        let match: RegExpExecArray | null;

        // Iterate over every occurrence of the deprecated token on this line.
        // A single exec() would miss later real usages when the first match
        // happens to be inside a string literal, causing false negatives.
        while ((match = rule.pattern.exec(line)) !== null) {
            // Skip matches inside string literals to avoid false positives:
            //   Debug "#PB_String_InPlace is no longer valid"
            if (isPositionInString(line, match.index)) {
                continue;
            }

            // Translate the match position in the trimmed `line` to the
            // original character offset in `originalLine`.
            const start = match.index + leadingWhitespace;
            const end   = start + match[0].length;

            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: lineNum, character: start },
                    end:   { line: lineNum, character: end },
                },
                message: rule.message,
                source:  DIAGNOSTIC_SOURCE,
            });
        }
    }
};