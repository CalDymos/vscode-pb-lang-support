/**
 * Symbol extractors for the PureBasic completion provider.
 * Extracts user-defined symbols and built-in function / keyword completions.
 */

import { TextDocument } from 'vscode-languageserver-textdocument';
import { PureBasicSymbol, SymbolKind } from '../../../symbols/types';
import { CompletionExtractor, CompletionContext } from '../completion-types';
import { symbolCache } from '../../../symbols/symbol-cache';
import { allBuiltinNames, findBuiltin } from '../../../utils/builtin-functions';

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
 * PureBasic keyword list (structural / flow-control keywords that are not
 * in pb-builtin-functions.json because they are language constructs, not
 * callable functions).
 */
const PB_KEYWORDS: ReadonlyArray<{ name: string; documentation: string }> = [
    { name: 'If',                documentation: 'Conditional statement' },
    { name: 'Else',              documentation: 'Else branch' },
    { name: 'ElseIf',            documentation: 'Else-if branch' },
    { name: 'EndIf',             documentation: 'End of If block' },
    { name: 'For',               documentation: 'For … Next loop' },
    { name: 'ForEach',           documentation: 'ForEach … Next loop (linked list / map)' },
    { name: 'Next',              documentation: 'End of For / ForEach loop' },
    { name: 'While',             documentation: 'While … Wend loop' },
    { name: 'Wend',              documentation: 'End of While loop' },
    { name: 'Repeat',            documentation: 'Repeat … Until loop' },
    { name: 'Until',             documentation: 'Condition that ends Repeat loop' },
    { name: 'ForEver',           documentation: 'Infinite loop (use Break to exit)' },
    { name: 'Break',             documentation: 'Exit the innermost loop' },
    { name: 'Continue',          documentation: 'Skip to next loop iteration' },
    { name: 'Select',            documentation: 'Select … EndSelect multi-branch' },
    { name: 'Case',              documentation: 'Case branch inside Select' },
    { name: 'Default',           documentation: 'Default branch inside Select' },
    { name: 'EndSelect',         documentation: 'End of Select block' },
    { name: 'With',              documentation: 'With … EndWith shorthand for structure access' },
    { name: 'EndWith',           documentation: 'End of With block' },
    { name: 'Procedure',         documentation: 'Define a procedure' },
    { name: 'ProcedureC',        documentation: 'Define a C-calling-convention procedure' },
    { name: 'ProcedureDLL',      documentation: 'Define a DLL-exported procedure' },
    { name: 'ProcedureCDLL',     documentation: 'Define a C-calling-convention DLL procedure' },
    { name: 'EndProcedure',      documentation: 'End of Procedure block' },
    { name: 'ProcedureReturn',   documentation: 'Return a value from a procedure' },
    { name: 'Declare',           documentation: 'Forward-declare a procedure' },
    { name: 'DeclareC',          documentation: 'Forward-declare a C-convention procedure' },
    { name: 'DeclareDLL',        documentation: 'Forward-declare a DLL procedure' },
    { name: 'DeclareCDLL',       documentation: 'Forward-declare a C-convention DLL procedure' },
    { name: 'Macro',             documentation: 'Define a macro' },
    { name: 'EndMacro',          documentation: 'End of Macro block' },
    { name: 'Prototype',         documentation: 'Define a function pointer prototype' },
    { name: 'PrototypeC',        documentation: 'Define a C-convention function pointer prototype' },
    { name: 'Structure',         documentation: 'Define a structure' },
    { name: 'EndStructure',      documentation: 'End of Structure block' },
    { name: 'StructureUnion',    documentation: 'Union inside a Structure' },
    { name: 'EndStructureUnion', documentation: 'End of StructureUnion block' },
    { name: 'Interface',         documentation: 'Define an OOP interface' },
    { name: 'EndInterface',      documentation: 'End of Interface block' },
    { name: 'Enumeration',       documentation: 'Define an enumeration' },
    { name: 'EnumerationBinary', documentation: 'Define a binary (power-of-two) enumeration' },
    { name: 'EndEnumeration',    documentation: 'End of Enumeration block' },
    { name: 'DeclareModule',     documentation: 'Declare the public interface of a module' },
    { name: 'EndDeclareModule',  documentation: 'End of DeclareModule block' },
    { name: 'Module',            documentation: 'Define a module implementation' },
    { name: 'EndModule',         documentation: 'End of Module block' },
    { name: 'UseModule',         documentation: 'Import module symbols into the current scope' },
    { name: 'UnuseModule',       documentation: 'Remove module symbols from the current scope' },
    { name: 'Global',            documentation: 'Declare a global variable' },
    { name: 'Protected',         documentation: 'Declare a procedure-local variable' },
    { name: 'Static',            documentation: 'Declare a static (persistent) local variable' },
    { name: 'Shared',            documentation: 'Share a global variable inside a procedure' },
    { name: 'Threaded',          documentation: 'Declare a thread-local variable' },
    { name: 'Define',            documentation: 'Define the default type for untyped variables' },
    { name: 'Dim',               documentation: 'Declare an array' },
    { name: 'ReDim',             documentation: 'Resize an existing array' },
    { name: 'NewList',           documentation: 'Declare a linked list' },
    { name: 'NewMap',            documentation: 'Declare a map (hash table)' },
    { name: 'DataSection',       documentation: 'Start a data section' },
    { name: 'EndDataSection',    documentation: 'End of DataSection block' },
    { name: 'Data',              documentation: 'Inline data values' },
    { name: 'Read',              documentation: 'Read the next Data value into a variable' },
    { name: 'Restore',           documentation: 'Reset the Data read pointer to a label' },
    { name: 'Goto',              documentation: 'Unconditional jump to a label' },
    { name: 'Gosub',             documentation: 'Call a subroutine label' },
    { name: 'Return',            documentation: 'Return from a Gosub subroutine' },
    { name: 'End',               documentation: 'Terminate the program' },
    { name: 'Import',            documentation: 'Import symbols from an external library' },
    { name: 'EndImport',         documentation: 'End of Import block' },
    { name: 'ImportC',           documentation: 'Import C-convention symbols from an external library' },
    { name: 'IncludeFile',       documentation: 'Include a source file at compile time' },
    { name: 'XIncludeFile',      documentation: 'Include a source file only once' },
    { name: 'IncludePath',       documentation: 'Add a directory to the include search path' },
    { name: 'CompilerIf',        documentation: 'Conditional compilation – if' },
    { name: 'CompilerElse',      documentation: 'Conditional compilation – else' },
    { name: 'CompilerElseIf',    documentation: 'Conditional compilation – else if' },
    { name: 'CompilerEndIf',     documentation: 'End of CompilerIf block' },
    { name: 'CompilerSelect',    documentation: 'Conditional compilation – select' },
    { name: 'CompilerCase',      documentation: 'Conditional compilation – case' },
    { name: 'CompilerDefault',   documentation: 'Conditional compilation – default' },
    { name: 'CompilerEndSelect', documentation: 'End of CompilerSelect block' },
    { name: 'CompilerError',     documentation: 'Emit a compile-time error message' },
    { name: 'CompilerWarning',   documentation: 'Emit a compile-time warning message' },
    { name: 'Debug',             documentation: 'Output a debug message (statement, not a function)' },
    { name: 'EnableExplicit',    documentation: 'Require all variables to be declared before use' },
    { name: 'DisableExplicit',   documentation: 'Allow implicit variable declarations' },
    { name: 'EnableASM',         documentation: 'Allow inline assembler' },
    { name: 'DisableASM',        documentation: 'Disallow inline assembler' },
    { name: 'Align',             documentation: 'Structure alignment modifier' },
    { name: 'And',               documentation: 'Logical/bitwise AND keyword' },
    { name: 'Array',             documentation: 'Array keyword for parameters / structure fields' },
    { name: 'As',                documentation: 'Rename imported symbol / alias in declarations' },
    { name: 'CallDebugger',      documentation: 'Invoke the debugger immediately' },
    { name: 'DebugLevel',        documentation: 'Set the current debug output level' },
    { name: 'DisableDebugger',   documentation: 'Disable debugger checks for following code' },
    { name: 'DisablePureLibrary',documentation: 'Disable a PureLibrary for this program' },
    { name: 'EnableDebugger',    documentation: 'Enable debugger checks for following code' },
    { name: 'EndHeaderSection',  documentation: 'End of HeaderSection block' },
    { name: 'Extends',           documentation: 'Extend a structure or interface' },
    { name: 'FakeReturn',        documentation: 'Simulate Return when leaving a Gosub via Goto' },
    { name: 'HeaderSection',     documentation: 'Insert C/ASM code outside main()' },
    { name: 'IncludeBinary',     documentation: 'Include binary data at compile time' },
    { name: 'List',              documentation: 'List keyword for parameters / structure fields' },
    { name: 'MacroExpandedCount',documentation: 'Macro expansion counter' },
    { name: 'Map',               documentation: 'Map keyword for parameters / structure fields' },
    { name: 'Not',               documentation: 'Logical/bitwise NOT keyword' },
    { name: 'Or',                documentation: 'Logical/bitwise OR keyword' },
    { name: 'Runtime',           documentation: 'Expose objects to runtime lookup' },
    { name: 'Step',              documentation: 'Step value in For / Enumeration' },
    { name: 'Swap',              documentation: 'Swap two variables or elements' },
    { name: 'To',                documentation: 'Upper bound / range keyword' },
    { name: 'UndefineMacro',     documentation: 'Remove a previously defined macro' },
    { name: 'XOr',               documentation: 'Logical/bitwise XOR keyword' },
];

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
        const keywordSymbols: PureBasicSymbol[] = PB_KEYWORDS
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