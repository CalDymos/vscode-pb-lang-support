/**
 * Variable Validator
 * Validate the syntax correctness of PureBasic variable declarations
 */

import { DiagnosticSeverity, Diagnostic } from 'vscode-languageserver/node';
import { ValidatorFunction } from './types';
import { isValidType } from '../utils/constants';
import { isPositionInString } from '../utils/pb-lexer-utils';

/**
 * Validate variable declaration syntax
 */
export const validateVariables: ValidatorFunction = (
    line: string,
    lineNum: number,
    originalLine: string,
    context,
    diagnostics
) => {
    // Check variable declarations with scope keywords
    if (/^(?:Global|Protected|Static|Shared|Threaded)\s+/.test(line)) {
        validateVariableDeclaration(line, lineNum, originalLine, diagnostics);
    }

    // Check general typed variable references (e.g. variable.type)
    // isPositionInString guards each individual match — no need for a whole-line guard.
    const varRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
    let match;
    while ((match = varRegex.exec(line)) !== null) {
        const [, varName, typePart] = match;
        const matchIndex = match.index;

        if (!isPositionInString(line, matchIndex)) {
            if (!isValidType(typePart)) {
                const typeStart = matchIndex + varName.length + 1;
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: {
                        start: { line: lineNum, character: typeStart },
                        end: { line: lineNum, character: typeStart + typePart.length }
                    },
                    message: `Unknown variable type: ${typePart}`,
                    source: 'purebasic'
                });
            }
        }
    }
};

function validateVariableDeclaration(
    line: string,
    lineNum: number,
    originalLine: string,
    diagnostics: Diagnostic[]
): void {
    const varMatch = line.match(/^(?:Global|Protected|Static|Shared|Threaded)\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)/);
    if (varMatch) {
        const [, varDecl] = varMatch;
        const typePart = varDecl.split('.')[1];

        if (typePart && !isValidType(typePart)) {
            const typeStart = line.indexOf('.' + typePart);
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: {
                    start: { line: lineNum, character: typeStart },
                    end: { line: lineNum, character: typeStart + typePart.length + 1 }
                },
                message: `Unknown variable type: ${typePart}`,
                source: 'purebasic'
            });
        }
    }
}
