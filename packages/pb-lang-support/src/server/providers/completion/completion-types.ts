/**
 * Type definitions for the code completion subsystem
 */
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionItem, CompletionItemKind, Position } from 'vscode-languageserver';
import { PureBasicSymbol, SymbolKind } from '../../symbols/types';

/** Completion context — all information available at the cursor position */
export interface CompletionContext {
    /** Source document */
    document: TextDocument;
    /** Cursor position */
    position: Position;
    /** Full text of the current line */
    lineText: string;
    /** Word (identifier fragment) under the cursor */
    currentWord: string;
    /** First word preceding the cursor on the same line */
    previousWord: string;
    /** Line text from the start up to the cursor */
    linePrefix: string;
    /** True when the cursor is inside a string literal */
    isInQuotes: boolean;
    /** True when the cursor is inside a comment */
    isInComment: boolean;
    /** 0-based line number of the cursor */
    lineNumber: number;
}

/** Extractor — retrieves PureBasicSymbol candidates for a given context */
export interface CompletionExtractor {
    /** Unique name identifying this extractor */
    name: string;
    /** Returns true when this extractor can provide candidates for the given context */
    supports(context: CompletionContext): boolean;
    /** Returns matching symbols for the given context */
    extract(context: CompletionContext): Promise<PureBasicSymbol[]>;
}

/** Handler — converts PureBasicSymbol candidates into LSP CompletionItems */
export interface CompletionHandler {
    /** Unique name identifying this handler */
    name: string;
    /** Symbol kinds this handler is responsible for */
    symbolTypes: SymbolKind[];
    /** Converts the given symbols into LSP CompletionItem objects */
    handle(context: CompletionContext, symbols: PureBasicSymbol[]): Promise<CompletionItem[]>;
}

/** Configuration options for the completion provider */
export interface CompletionConfig {
    /** Maximum number of items returned in a single completion response */
    maxItems: number;
    /** Enable context-aware filtering of candidates */
    enableSmartFilter: boolean;
    /** Include PureBasic built-in functions in the completion list */
    includeBuiltins: boolean;
    /** Include symbols extracted from the current document */
    includeDocumentSymbols: boolean;
    /** Include symbols exported from modules */
    includeModuleSymbols: boolean;
}

/** Runtime statistics collected by the completion provider */
export interface CompletionStats {
    /** Total number of completion requests handled */
    totalRequests: number;
    /** Number of requests served from cache */
    cacheHits: number;
    /** Average response time in milliseconds */
    averageResponseTime: number;
    /** Total number of completion items generated */
    itemsGenerated: number;
    /** Number of errors encountered during completion */
    errors: number;
}

/** Aggregated result from all registered extractors */
export interface SymbolExtractResult {
    /** Symbols extracted from the current document */
    documentSymbols: PureBasicSymbol[];
    /** Symbols exported from modules */
    moduleSymbols: PureBasicSymbol[];
    /** Structure-type symbols */
    structureSymbols: PureBasicSymbol[];
    /** Built-in function and keyword symbols */
    builtinSymbols: PureBasicSymbol[];
}

/** Configuration for CompletionFactory — controls detail level of generated items */
export interface CompletionFactoryConfig {
    /** Attach documentation strings to generated items */
    includeDocumentation: boolean;
    /** Attach type information (detail field) to generated items */
    includeTypeInfo: boolean;
    /** Attach module origin to generated items */
    includeModuleInfo: boolean;
    /** Sort weights controlling item ordering by origin */
    sortWeights: {
        local: number;
        module: number;
        builtin: number;
        structure: number;
    };
}