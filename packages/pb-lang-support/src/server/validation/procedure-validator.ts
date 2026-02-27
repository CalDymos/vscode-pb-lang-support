/**
 * Procedure Validator
 * Validate the syntax correctness of PureBasic procedure definitions
 */

import { DiagnosticSeverity } from 'vscode-languageserver/node';
import { ValidationContext, ValidatorFunction } from './types';
import { isValidType } from '../utils/constants';
import { validateParameters } from './parameter-validator';
import { stripInlineComment } from '../utils/string-utils';

/**
 * Validate procedure related syntax
 */
export const validateProcedure: ValidatorFunction = (
    line: string,
    lineNum: number,
    originalLine: string,
    context: ValidationContext,
    diagnostics
) => {
    if (/^Procedure(?:C|DLL|CDLL)?\b/i.test(line) && !/^ProcedureReturn\b/i.test(line)) {
        // Single-line Procedure/ProcedureC/ProcedureDLL/ProcedureCDLL ... : EndProcedure -> not pushed to stack
        const hasInlineEnd = /\bEndProcedure\b/i.test(line);
        if (hasInlineEnd) {
            return;
        }
        // Validate procedure definition syntax (support calling conventions; get return type and procedure name first)
        const headerMatch = line.match(/^Procedure(?:C|DLL|CDLL)?\s*(?:\.(\w+))?\s*([a-zA-Z_][a-zA-Z0-9_]*)/i);
        if (!headerMatch) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: lineNum, character: 0 },
                    end: { line: lineNum, character: originalLine.length }
                },
                message: 'Invalid Procedure syntax. Expected: Procedure[.Type] Name([parameters])',
                source: 'purebasic'
            });
        } else {
            const [, returnType, procName] = headerMatch;
            const codeLine = stripInlineComment(line);
            context.procedureStack.push({ name: procName, line: lineNum });

            // Validate return type
            if (returnType && !isValidType(returnType)) {
                const typeStart = line.indexOf('.' + returnType);
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: {
                        start: { line: lineNum, character: typeStart },
                        end: { line: lineNum, character: typeStart + returnType.length + 1 }
                    },
                    message: `Unknown return type: ${returnType}`,
                    source: 'purebasic'
                });
            }

            // Parameter syntax validation: Supports nested parentheses such as "()"" within parameters like List/Array/Map
            // First remove inline comments to prevent parentheses within comments from interfering with parameter parsing
            const lineWithoutComment = stripInlineComment(codeLine);
            const openIdx = lineWithoutComment.indexOf('(');
            const closeIdx = lineWithoutComment.lastIndexOf(')');
            if (openIdx !== -1 && closeIdx !== -1 && closeIdx > openIdx) {
                const params = lineWithoutComment.substring(openIdx + 1, closeIdx);
                if (params.trim().length > 0) {
                    validateParameters(params, lineNum, originalLine, diagnostics);
                }
            }
        }
    } else if (/^EndProcedure\b/i.test(line)) {
        // Validate EndProcedure
        if (context.procedureStack.length === 0) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: lineNum, character: 0 },
                    end: { line: lineNum, character: originalLine.length }
                },
                message: 'EndProcedure without matching Procedure',
                source: 'purebasic'
            });
        } else {
            context.procedureStack.pop();
        }
    } else if (/^ProcedureReturn\b/i.test(line)) {
        // Validate ProcedureReturn
        if (context.procedureStack.length === 0) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: lineNum, character: 0 },
                    end: { line: lineNum, character: 12 }
                },
                message: 'ProcedureReturn used outside of procedure',
                source: 'purebasic'
            });
        }
    }
};
