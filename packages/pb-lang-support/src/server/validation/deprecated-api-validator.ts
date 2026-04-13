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
        pattern: /#PB_String_InPlace\b/i,
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
    for (const rule of DEPRECATED_RULES) {
        const match = rule.pattern.exec(line);
        if (!match) {
            continue;
        }

        // Locate the token inside originalLine for an accurate highlight range.
        // Use a case-insensitive search on the original (un-stripped) line so
        // that the character offset is correct even when leading whitespace differs.
        const tokenStart = originalLine.toLowerCase().indexOf(match[0].toLowerCase());
        const start = tokenStart >= 0 ? tokenStart : 0;
        const end   = tokenStart >= 0 ? tokenStart + match[0].length : originalLine.length;

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
};
