/**
 * Data Structure Validator
 * Validate the syntax correctness of PureBasic data structures
 */

import { DiagnosticSeverity } from 'vscode-languageserver/node';
import { ValidationContext, ValidatorFunction } from './types';
import { DIAGNOSTIC_SOURCE } from '../utils/constants';

/**
 * Validate data structure related syntax
 */
export const validateDataStructures: ValidatorFunction = (
    line: string,
    lineNum: number,
    originalLine: string,
    context: ValidationContext,
    diagnostics
) => {
    // Structure validation
    if (/^Structure\s/i.test(line)) {
        const structMatch = line.match(/^Structure\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
        if (!structMatch) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: lineNum, character: 0 },
                    end: { line: lineNum, character: originalLine.length }
                },
                message: 'Invalid Structure syntax. Expected: Structure Name',
                source: DIAGNOSTIC_SOURCE
            });
        } else if (!/\bEndStructure\b/i.test(line)) {
            context.structureStack.push({ name: structMatch[1], line: lineNum });
        }
    } else if (/^EndStructure\b/i.test(line)) {
        if (context.structureStack.length === 0) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: lineNum, character: 0 },
                    end: { line: lineNum, character: originalLine.length }
                },
                message: 'EndStructure without matching Structure',
                source: DIAGNOSTIC_SOURCE
            });
        } else {
            context.structureStack.pop();
        }
    }

    // Enumeration / EnumerationBinary validation
    // Must check EnumerationBinary before Enumeration to avoid prefix-match confusion.
    else if (/^EnumerationBinary\b/i.test(line)) {
        const enumMatch = line.match(/^EnumerationBinary(?:\s+([a-zA-Z_][a-zA-Z0-9_]*))?(?:\s+#([a-zA-Z_][a-zA-Z0-9_]*))?(?:\s+Step\s+(\d+))?/i);
        if (!enumMatch) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: lineNum, character: 0 },
                    end: { line: lineNum, character: originalLine.length }
                },
                message: 'Invalid EnumerationBinary syntax. Expected: EnumerationBinary [Name] [#Start] [Step n]',
                source: DIAGNOSTIC_SOURCE
            });
        }
        // EndEnumeration is shared; no stack tracking needed (Enumerations can be nested).
    } else if (/^Enumeration\b/i.test(line)) {
        const enumMatch = line.match(/^Enumeration(?:\s+([a-zA-Z_][a-zA-Z0-9_]*))?(?:\s+#([a-zA-Z_][a-zA-Z0-9_]*))?(?:\s+Step\s+(\d+))?/i);
        if (line.trim() !== 'Enumeration' && !enumMatch) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: lineNum, character: 0 },
                    end: { line: lineNum, character: originalLine.length }
                },
                message: 'Invalid Enumeration syntax. Expected: Enumeration [Name] [#Start] [Step n]',
                source: DIAGNOSTIC_SOURCE
            });
        }
        // EndEnumeration is shared; no stack tracking needed (Enumerations can be nested).
    }

    // Interface validation
    else if (/^Interface\s/i.test(line)) {
        const intfMatch = line.match(/^Interface\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
        if (!intfMatch) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: lineNum, character: 0 },
                    end: { line: lineNum, character: originalLine.length }
                },
                message: 'Invalid Interface syntax. Expected: Interface Name',
                source: DIAGNOSTIC_SOURCE
            });
        } else if (!/\bEndInterface\b/i.test(line)) {
            context.interfaceStack.push(lineNum);
        }
    } else if (/^EndInterface\b/i.test(line)) {
        if (context.interfaceStack.length === 0) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: lineNum, character: 0 },
                    end: { line: lineNum, character: originalLine.length }
                },
                message: 'EndInterface without matching Interface',
                source: DIAGNOSTIC_SOURCE
            });
        } else {
            context.interfaceStack.pop();
        }
    }
};
