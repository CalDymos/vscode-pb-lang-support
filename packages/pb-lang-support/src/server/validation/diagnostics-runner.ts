/**
 * Diagnostics Runner
 * Central entry point for all document validation.
 * Add new validators here — server.ts stays untouched.
 *
 * Pipeline:
 *   1. Text-only validators  (no URI / disk access needed)
 *   2. Document validators   (require TextDocument URI, workspace root, etc.)
 *   3. Apply maxNumberOfProblems limit
 */

import { Diagnostic } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { PureBasicSettings } from '../config/settings';
import { validateDocument } from './validator';
import { validateIncludes } from './include-validator';

/**
 * Run all diagnostics for the given document and return the result.
 *
 * @param document      The document to validate.
 * @param settings      Document settings (controls limits and feature flags).
 * @param workspaceRoot Optional workspace root for path resolution.
 */
export function runDiagnostics(
    document: TextDocument,
    settings: PureBasicSettings,
    workspaceRoot?: string
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // --- 1. Text-only validators ----------------------------------------
    // These receive only the raw text string and a ValidationContext.
    // They are fast (no I/O) and run on every keystroke (after debounce).
    diagnostics.push(...validateDocument(document.getText()));

    // --- 2. Document validators -----------------------------------------
    // These require the TextDocument (URI) and may perform disk I/O.
    // Add new document-level validators here.
    diagnostics.push(...validateIncludes(document, workspaceRoot));

    // --- 3. Apply problem limit -----------------------------------------
    const limit = settings.maxNumberOfProblems;
    return diagnostics.length > limit
        ? diagnostics.slice(0, limit)
        : diagnostics;
}