/**
 * Language Server settings configuration
 */

export interface PureBasicSettings {
    maxNumberOfProblems: number;
    enableValidation: boolean;
    enableCompletion: boolean;
    validationDelay: number;
    formatting?: FormattingSettings;
    completion?: CompletionSettings;
    linting?: LintingSettings;
    symbols?: SymbolsSettings;
    performance?: PerformanceSettings;
}

export interface FormattingSettings {
    /** Whether to enable formatting */
    enabled: boolean;
    /** Indentation size */
    indentSize: number;
    /** Tab size */
    tabSize: number;
    /** Whether to insert spaces */
    insertSpaces: boolean;
    /** Whether to remove trailing whitespace */
    trimTrailingWhitespace: boolean;
    /** Whether to remove final newlines */
    trimFinalNewlines: boolean;
}

export interface CompletionSettings {
    /** Trigger characters */
    triggerCharacters: string[];
    /** Whether to enable auto-closing */
    autoClosingPairs: boolean;
    /** Whether to suggest on input */
    suggestOnType: boolean;
}

export interface LintingSettings {
    /** Whether to enable semantic validation */
    enableSemanticValidation: boolean;
    /** Whether to check unused variables */
    checkUnusedVariables: boolean;
    /** Whether to check undefined symbols */
    checkUndefinedSymbols: boolean;
    /** Whether to enable code actions */
    enableCodeActions: boolean;
}

export interface SymbolsSettings {
    /** Whether to enable workspace symbols */
    enableWorkspaceSymbols: boolean;
    /** Whether to enable symbol caching */
    cacheEnabled: boolean;
    /** Cache size */
    cacheSize: number;
}

export interface PerformanceSettings {
    /** Whether to enable incremental parsing */
    enableIncrementalParsing: boolean;
    /** Maximum file size */
    maxFileSize: number;
}

/**
 * Default settings
 */
export const defaultSettings: PureBasicSettings = {
    maxNumberOfProblems: 100,
    enableValidation: true,
    enableCompletion: true,
    validationDelay: 500,
    formatting: {
        enabled: true,
        indentSize: 4,
        tabSize: 4,
        insertSpaces: true,
        trimTrailingWhitespace: true,
        trimFinalNewlines: true
    },
    completion: {
        triggerCharacters: ['.', '(', '['],
        autoClosingPairs: true,
        suggestOnType: true
    },
    linting: {
        enableSemanticValidation: true,
        checkUnusedVariables: true,
        checkUndefinedSymbols: true,
        enableCodeActions: true
    },
    symbols: {
        enableWorkspaceSymbols: true,
        cacheEnabled: true,
        cacheSize: 1000
    },
    performance: {
        enableIncrementalParsing: true,
        maxFileSize: 1048576 // 1MB
    }
};

/**
 * Global settings (used when there is no workspace configuration)
 */
export let globalSettings: PureBasicSettings = defaultSettings;
