/**
 * Symbol extractors for the PureBasic completion provider.
 * Extracts user-defined symbols and built-in function / keyword completions.
 */

import { TextDocument } from 'vscode-languageserver-textdocument';
import { PureBasicSymbol, SymbolKind } from '../../../symbols/types';
import { CompletionExtractor, CompletionContext } from '../completion-types';
import { symbolCache } from '../../../symbols/symbol-cache';
import { allBuiltinNames, findBuiltin } from '../../../utils/builtin-functions';
import { pbKeywordDefinitions } from '../../../utils/constants'

/**
 * Extracts user-defined symbols (procedures, variables, constants, etc.)
 * from the current document via the symbol cache.
 */
export class DocumentSymbolExtractor implements CompletionExtractor {
    name = 'document-symbol';

    supports(context: CompletionContext): boolean {
        // Only support completions outside comments and string literals
        return !context.isInComment && !context.isInQuotes;
    }

    async extract(context: CompletionContext): Promise<PureBasicSymbol[]> {
        // Retrieve symbols from cache
        const cachedSymbols = symbolCache.getSymbols(context.document.uri);
        if (cachedSymbols && cachedSymbols.length > 0) {
            return this.filterSymbols(cachedSymbols, context);
        }

        // Cache miss – symbols will be populated in the background.
        return [];
    }

    /**
     * Filters completion symbols based on the current editor context
     * (typed prefix, previous keyword, and symbol visibility rules).
     */
    private filterSymbols(symbols: PureBasicSymbol[], context: CompletionContext): PureBasicSymbol[] {
        const { currentWord, linePrefix } = context;

        return symbols.filter(symbol => {
            // Match symbols against the currently typed prefix
            if (currentWord && !symbol.name.toLowerCase().includes(currentWord.toLowerCase())) {
                return false;
            }

            // After "UseModule" only module symbols are valid
            if (context.previousWord === 'UseModule' && symbol.kind !== SymbolKind.Module) {
                return false;
            }

            // Apply additional context-specific filtering rules
            return !this.shouldFilterSymbol(symbol, context);
        });
    }

    /**
     * Determine whether a symbol should be filtered out
     */
    private shouldFilterSymbol(symbol: PureBasicSymbol, context: CompletionContext): boolean {
        const { linePrefix } = context;

        // Inside a UseModule statement show only module symbols.
        if (linePrefix.trim().toLowerCase().startsWith('usemodule')) {
            return symbol.kind !== SymbolKind.Module;
        }

        return false;
    }
}

/**
 * Provides completion items for PureBasic built-in functions (from
 * pb-builtin-functions.json) and language keywords.
 *
 * FIX: The previous implementation used a small hardcoded list with
 *      Chinese documentation strings.  Built-in functions now come
 *      from the shared builtin-functions module (same JSON source used
 *      by hover-provider and signature-provider).
 */
export class BuiltinSymbolExtractor implements CompletionExtractor {
    name = 'builtin-symbol';

    supports(context: CompletionContext): boolean {
        // Only support completions outside comments and string literals
        return !context.isInComment && !context.isInQuotes;
    }

    async extract(context: CompletionContext): Promise<PureBasicSymbol[]> {
        const { currentWord } = context;
        const matchesWord = (name: string): boolean =>
            !currentWord || name.toLowerCase().includes(currentWord.toLowerCase());

        const dummyRange = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };

        // 1) Language keywords (hardcoded – these are constructs, not functions)
        const keywordSymbols: PureBasicSymbol[] = pbKeywordDefinitions
            .filter(kw => matchesWord(kw.name))
            .map(kw => ({
                name: kw.name,
                kind: SymbolKind.Keyword,
                documentation: kw.documentation,
                range: { ...dummyRange, end: { line: 0, character: kw.name.length } }
            }));

        // 2) Built-in functions from pb-builtin-functions.json
        const functionSymbols: PureBasicSymbol[] = allBuiltinNames()
            .filter(name => matchesWord(name))
            .map(name => {
                const entry = findBuiltin(name)!;
                return {
                    name,
                    kind: SymbolKind.Function,
                    documentation: entry.description,
                    range: { ...dummyRange, end: { line: 0, character: name.length } }
                };
            });

        return [...keywordSymbols, ...functionSymbols];
    }
}