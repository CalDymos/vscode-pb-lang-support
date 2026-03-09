/**
 * Include File Validator
 * Generates diagnostics for missing IncludeFile / XIncludeFile targets.
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { parseIncludeFiles } from '../parsers/include-parser';

/**
 * Validates that all IncludeFile / XIncludeFile targets exist on disk.
 *
 * - Non-conditional includes that cannot be resolved → Error
 * - Conditional includes (CompilerIf ... : XIncludeFile) → Warning,
 *   because the file may legitimately be platform-specific.
 *
 * @param document     The document being validated.
 * @param workspaceRoot  Optional workspace root passed to the path resolver.
 */
export function validateIncludes(
    document: TextDocument,
    workspaceRoot?: string
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const analysis = parseIncludeFiles(document, workspaceRoot ?? '');

    // missingFiles contains the raw (unresolved) paths.
    // Build a lookup Set for O(1) checks against includeFiles entries.
    const missingSet = new Set(analysis.missingFiles);
    if (missingSet.size === 0) {
        return diagnostics;
    }

    const lines = document.getText().split(/\r?\n/);

    for (const include of analysis.includeFiles) {
        if (!missingSet.has(include.filePath)) {
            continue;
        }

        const lineNum  = include.lineNumber;
        const rawLine  = lines[lineNum] ?? '';

        // Highlight the quoted filename inside the directive, e.g.:
        //   IncludeFile "utils/helpers.pbi"
        //                ^^^^^^^^^^^^^^^^^
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

        const severity = include.isConditional
            ? DiagnosticSeverity.Warning
            : DiagnosticSeverity.Error;

        const hint = include.isConditional
            ? ' (conditional include – may be platform-specific)'
            : '';

        diagnostics.push({
            severity,
            range,
            message: `Include file not found: "${include.filePath}"${hint}`,
            source: 'purebasic'
        });
    }

    return diagnostics;
}