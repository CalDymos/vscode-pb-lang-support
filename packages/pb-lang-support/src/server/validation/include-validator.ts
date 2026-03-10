/**
 * Include File Validator
 * Generates diagnostics for missing IncludeFile / XIncludeFile / IncludeBinary
 * targets and for IncludeBinary directives placed outside a DataSection block.
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { parseIncludeFiles } from '../parsers/include-parser';

/**
 * Validates that all IncludeFile / XIncludeFile / IncludeBinary targets exist
 * on disk, and that every IncludeBinary directive appears inside a
 * DataSection…EndDataSection block.
 *
 * Severity rules:
 * - Non-conditional source include not found        → Error
 * - Conditional source include not found            → Warning
 *   (file may legitimately be platform-specific)
 * - IncludeBinary file not found                    → Error
 * - IncludeBinary outside DataSection               → Warning
 *
 * @param document      The document being validated.
 * @param workspaceRoot Optional workspace root passed to the path resolver.
 */
export function validateIncludes(
    document: TextDocument,
    workspaceRoot?: string
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const analysis = parseIncludeFiles(document, workspaceRoot ?? '');

    const lines = document.getText().split(/\r?\n/);

    // missingFiles contains the raw (unresolved) paths.
    const missingSet = new Set(analysis.missingFiles);

    for (const include of analysis.includeFiles) {
        const lineNum = include.lineNumber;
        const rawLine = lines[lineNum] ?? '';

        // Highlight the quoted filename inside the directive.
        const quoteStart = rawLine.indexOf('"');
        const quoteEnd   = rawLine.lastIndexOf('"');

        const range =
            quoteStart !== -1 && quoteEnd > quoteStart
                ? {
                      start: { line: lineNum, character: quoteStart },
                      end:   { line: lineNum, character: quoteEnd + 1 }
                  }
                : {
                      start: { line: lineNum, character: 0 },
                      end:   { line: lineNum, character: rawLine.length }
                  };

        // --- "File not found" diagnostic (applies to all include types) ------
        if (missingSet.has(include.filePath)) {
            const severity = include.isConditional
                ? DiagnosticSeverity.Warning
                : DiagnosticSeverity.Error;

            const hint = include.isConditional
                ? ' (conditional include – may be platform-specific)'
                : '';

            const label = include.isBinary ? 'Binary include' : 'Include file';

            diagnostics.push({
                severity,
                range,
                message: `${label} not found: "${include.filePath}"${hint}`,
                source: 'purebasic'
            });
        }

        // --- IncludeBinary outside DataSection diagnostic --------------------
        if (include.isBinary && !include.insideDataSection) {
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range,
                message:
                    `'IncludeBinary' should be placed inside a DataSection…EndDataSection block.`,
                source: 'purebasic'
            });
        }
    }

    return diagnostics;
}