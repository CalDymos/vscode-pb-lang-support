/**
 * Control Structure Validator
 * Verifies the matching of PureBasic control structures
 */

import { DiagnosticSeverity } from 'vscode-languageserver/node';
import { DIAGNOSTIC_SOURCE } from '../utils/constants';
import { ValidationContext, ValidatorFunction } from './types';

// Split a line into statements at ':' while respecting string literals.
// PureBasic escapes quotes inside strings with "" (double quote).
const splitStatements = (srcLine: string): string[] => {
    const parts: string[] = [];
    let cur = '';
    let inStr = false;

    for (let i = 0; i < srcLine.length; i++) {
        const ch = srcLine[i];

        if (ch === '"') {
            if (inStr && srcLine[i + 1] === '"') {
                cur += '""';
                i++;
                continue;
            }
            inStr = !inStr;
            cur += ch;
            continue;
        }

        // Stop at inline comments (caller already strips them, but guard anyway).
        if (!inStr && ch === ';') {
            break;
        }

        if (!inStr && ch === ':') {
            const trimmed = cur.trim();
            if (trimmed.length > 0) parts.push(trimmed);
            cur = '';
            continue;
        }

        cur += ch;
    }

    const trimmed = cur.trim();
    if (trimmed.length > 0) parts.push(trimmed);

    return parts;
};

/**
 * Verify matching of control structures
 * (If-EndIf, For-Next, While-Wend, Repeat-Until/ForEver, Select-EndSelect, With-EndWith)
 */
export const validateControlStructures: ValidatorFunction = (
    line: string,
    lineNum: number,
    originalLine: string,
    context: ValidationContext,
    diagnostics
) => {

    const validateStatement = (stmt: string) => {
        const s = stmt.trimStart();

        // If-EndIf structure
        if (/^If\b/i.test(s) && !/^IfElse\b/i.test(s)) {
            if (!/\bEndIf\b/i.test(s)) {
                context.ifStack.push(lineNum);
            }
        } else if (/^EndIf\b/i.test(s)) {
            if (context.ifStack.length === 0) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: {
                        start: { line: lineNum, character: 0 },
                        end: { line: lineNum, character: originalLine.length }
                    },
                    message: 'EndIf without matching If',
                    source: DIAGNOSTIC_SOURCE
                });
            } else {
                context.ifStack.pop();
            }
        }

        // For-Next structure (including ForEach)
        else if (/^For(?:Each)?\b/i.test(s)) {
            if (!/\bNext\b/i.test(s)) {
                context.forStack.push(lineNum);
            }
        } else if (/^Next\b/i.test(s)) {
            if (context.forStack.length === 0) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: {
                        start: { line: lineNum, character: 0 },
                        end: { line: lineNum, character: originalLine.length }
                    },
                    message: 'Next without matching For/ForEach',
                    source: DIAGNOSTIC_SOURCE
                });
            } else {
                context.forStack.pop();
            }
        }

        // While-Wend structure
        else if (/^While\b/i.test(s)) {
            if (!/\bWend\b/i.test(s)) {
                context.whileStack.push(lineNum);
            }
        } else if (/^Wend\b/i.test(s)) {
            if (context.whileStack.length === 0) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: {
                        start: { line: lineNum, character: 0 },
                        end: { line: lineNum, character: originalLine.length }
                    },
                    message: 'Wend without matching While',
                    source: DIAGNOSTIC_SOURCE
                });
            } else {
                context.whileStack.pop();
            }
        }

        // Repeat-Until / Repeat-ForEver structure
        else if (/^Repeat\b/i.test(s)) {
            if (!/\b(?:ForEver|Until)\b/i.test(s)) {
                context.repeatStack.push(lineNum);
            }
        } else if (/^ForEver\b/i.test(s)) {
            if (context.repeatStack.length === 0) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: {
                        start: { line: lineNum, character: 0 },
                        end: { line: lineNum, character: originalLine.length }
                    },
                    message: 'ForEver without matching Repeat',
                    source: DIAGNOSTIC_SOURCE
                });
            } else {
                context.repeatStack.pop();
            }
        } else if (/^Until\b/i.test(s)) {
            if (context.repeatStack.length === 0) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: {
                        start: { line: lineNum, character: 0 },
                        end: { line: lineNum, character: originalLine.length }
                    },
                    message: 'Until without matching Repeat',
                    source: DIAGNOSTIC_SOURCE
                });
            } else {
                context.repeatStack.pop();
            }
        }

        // Select-EndSelect structure
        else if (/^Select\b/i.test(s)) {
            if (!/\bEndSelect\b/i.test(s)) {
                context.selectStack.push(lineNum);
            }
        } else if (/^EndSelect\b/i.test(s)) {
            if (context.selectStack.length === 0) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: {
                        start: { line: lineNum, character: 0 },
                        end: { line: lineNum, character: originalLine.length }
                    },
                    message: 'EndSelect without matching Select',
                    source: DIAGNOSTIC_SOURCE
                });
            } else {
                context.selectStack.pop();
            }
        }

        // With-EndWith structure
        else if (/^With\b/i.test(s)) {
            if (!/\bEndWith\b/i.test(s)) {
                context.withStack.push(lineNum);
            }
        } else if (/^EndWith\b/i.test(s)) {
            if (context.withStack.length === 0) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: {
                        start: { line: lineNum, character: 0 },
                        end: { line: lineNum, character: originalLine.length }
                    },
                    message: 'EndWith without matching With',
                    source: DIAGNOSTIC_SOURCE
                });
            } else {
                context.withStack.pop();
            }
        }
    };

    // `line` is already comment-stripped; split into colon-separated statements.
    for (const stmt of splitStatements(line)) {
        validateStatement(stmt);
    }
};