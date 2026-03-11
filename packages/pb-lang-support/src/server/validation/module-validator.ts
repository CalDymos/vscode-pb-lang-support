/**
 * Module Validator
 * Validate PureBasic module related syntax
 */

import { DiagnosticSeverity } from 'vscode-languageserver/node';
import { DIAGNOSTIC_SOURCE } from '../utils/constants';
import { ValidationContext, ValidatorFunction } from './types';

/**
 * Validate module related syntax
 */
export const validateModules: ValidatorFunction = (
    line: string,
    lineNum: number,
    originalLine: string,
    context: ValidationContext,
    diagnostics
) => {
    // Module validation
    if (/^Module\s/i.test(line)) {
        const moduleMatch = line.match(/^Module\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
        if (!moduleMatch) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: lineNum, character: 0 },
                    end: { line: lineNum, character: originalLine.length }
                },
                message: 'Invalid Module syntax. Expected: Module Name',
                source: DIAGNOSTIC_SOURCE
            });
        } else if (!/\bEndModule\b/i.test(line)) {
            context.moduleStack.push({ name: moduleMatch[1], line: lineNum });
        }
    } else if (/^EndModule\b/i.test(line)) {
        if (context.moduleStack.length === 0) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: lineNum, character: 0 },
                    end: { line: lineNum, character: originalLine.length }
                },
                message: 'EndModule without matching Module',
                source: DIAGNOSTIC_SOURCE
            });
        } else {
            context.moduleStack.pop();
        }
    }

    // DeclareModule validation
    else if (/^DeclareModule\s/i.test(line)) {
        const declModMatch = line.match(/^DeclareModule\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
        if (!declModMatch) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: lineNum, character: 0 },
                    end: { line: lineNum, character: originalLine.length }
                },
                message: 'Invalid DeclareModule syntax. Expected: DeclareModule Name',
                source: DIAGNOSTIC_SOURCE
            });
        } else if (!/\bEndDeclareModule\b/i.test(line)) {
            context.declareModuleStack.push({ name: declModMatch[1], line: lineNum });
        }
    } else if (/^EndDeclareModule\b/i.test(line)) {
        if (context.declareModuleStack.length === 0) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: lineNum, character: 0 },
                    end: { line: lineNum, character: originalLine.length }
                },
                message: 'EndDeclareModule without matching DeclareModule',
                source: DIAGNOSTIC_SOURCE
            });
        } else {
            context.declareModuleStack.pop();
        }
    }

    // UseModule validation
    else if (/^UseModule\s/i.test(line)) {
        const useModMatch = line.match(/^UseModule\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
        if (!useModMatch) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: lineNum, character: 0 },
                    end: { line: lineNum, character: originalLine.length }
                },
                message: 'Invalid UseModule syntax. Expected: UseModule Name',
                source: DIAGNOSTIC_SOURCE
            });
        }
    }

    // UnuseModule validation
    else if (/^UnuseModule\s/i.test(line)) {
        const unuseModMatch = line.match(/^UnuseModule\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
        if (!unuseModMatch) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: lineNum, character: 0 },
                    end: { line: lineNum, character: originalLine.length }
                },
                message: 'Invalid UnuseModule syntax. Expected: UnuseModule Name',
                source: DIAGNOSTIC_SOURCE
            });
        }
    }
};
