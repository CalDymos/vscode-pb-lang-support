/**
 * Main Validator
 * Integrates all validation modules, provides a unified validation interface
 */

import { Diagnostic } from 'vscode-languageserver/node';
import { ValidationContext } from './types';
import { validateProcedure } from './procedure-validator';
import { validateVariables } from './variable-validator';
import { validateControlStructures } from './control-structure-validator';
import { validateDataStructures } from './data-structure-validator';
import { validateModules } from './module-validator';
import { validateGeneric } from './generic-validator';
import { validateUnclosedStructures } from './unclosed-structure-validator';
import { withErrorHandling, getErrorHandler } from '../utils/error-handler';
import { stripInlineComment } from '../utils/string-utils';

type LogFn = (message: string, err?: unknown) => void;

/** No-op until initValidator() is called. */
let internalLog: LogFn = () => { /* uninitialized */ };

/**
 * Must be called once during server startup to wire up LSP logging.
 * Until called, errors are silently swallowed.
 */
export function initValidator(logFn: LogFn): void {
    internalLog = logFn;
}

/**
 * Create a new validation context
 */
export function createValidationContext(): ValidationContext {
    return {
        procedureStack: [],
        structureStack: [],
        ifStack: [],
        forStack: [],
        whileStack: [],
        repeatStack: [],
        selectStack: [],
        withStack: [],
        moduleStack: [],
        declareModuleStack: [],
        interfaceStack: []
    };
}

/**
 * Validate PureBasic code
 */
export function validateDocument(text: string): Diagnostic[] {
    try {
        return validateDocumentInternal(text);
    } catch (error) {
        internalLog('Document validation error:', error);
        return [];
    }
}

function validateDocumentInternal(text: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const context = createValidationContext();
    const lines = text.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
        const originalLine = lines[i];
        const trimmedLine = originalLine.trim();

        // Skip empty lines and comments
        if (trimmedLine === '' || trimmedLine.startsWith(';')) {
            continue;
        }

        // Apply all validators
        // Strip inline comments for validation, but keep originalLine for ranges
        const line = stripInlineComment(trimmedLine).trimEnd();
        validateProcedure(line, i, originalLine, context, diagnostics);
        validateVariables(line, i, originalLine, context, diagnostics);
        validateControlStructures(line, i, originalLine, context, diagnostics);
        validateDataStructures(line, i, originalLine, context, diagnostics);
        validateModules(line, i, originalLine, context, diagnostics);
        validateGeneric(line, i, originalLine, context, diagnostics);
    }

    // Check unclosed structures
    validateUnclosedStructures(context, lines, diagnostics);

    return diagnostics;
}
