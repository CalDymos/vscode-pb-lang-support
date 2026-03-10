/**
 * Generic validator
 * Validates basic PureBasic syntax rules
 */

import { DiagnosticSeverity } from 'vscode-languageserver/node';
import { ValidatorFunction } from './types';
import { keywords, parsePureBasicConstantDefinition } from '../utils/constants';
import { builtinFunctionMap } from '../utils/builtin-functions';

/**
 * Validates generic syntax rules
 */
export const validateGeneric: ValidatorFunction = (
    line: string,
    lineNum: number,
    originalLine: string,
    context,
    diagnostics
) => {
    // Validate constant definition syntax (e.g., #NAME = value)
    if (line.startsWith('#') && !line.includes('::')) {
        const constMatch = parsePureBasicConstantDefinition(line);
        if (line.includes('=') && !constMatch) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: lineNum, character: 0 },
                    end: { line: lineNum, character: originalLine.length }
                },
                message: 'Invalid constant definition syntax. Expected: #NAME = value',
                source: 'purebasic'
            });
        }
    }

    // Lines containing string literals are excluded from the pattern check below
    // to avoid false positives on arbitrary string content.
    if (line.includes('"') || line.includes("'")) {
        return;
    }

    // Flag lines that start with an invalid character (not a keyword, identifier,
    // constant, comment, pointer, or address-of operator).
    const invalidStartPattern = /^\s*[^a-zA-Z_#;*\\@]/;

    // Only report on genuinely invalid lines
    if (invalidStartPattern.test(line)) {
        // Whitelist: allowed special cases
        const isValidSpecialCase =
            line.includes('=') ||           // assignment
            line.includes('(') ||           // function call
            line.includes('[') ||           // array access
            line.includes('.') ||           // member access
            line.includes('\\') ||          // file path
            line.startsWith('*') ||         // pointer variable
            line.startsWith('@') ||         // address operator
            keywords.some(kw => line.startsWith(kw)) ||
            [...line.matchAll(/\b\w+\b/g)].some(m => builtinFunctionMap.has(m[0].toLowerCase()));

        if (!isValidSpecialCase) {
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: {
                    start: { line: lineNum, character: 0 },
                    end: { line: lineNum, character: originalLine.length }
                },
                message: 'Potentially invalid statement syntax',
                source: 'purebasic'
            });
        }
    }
};