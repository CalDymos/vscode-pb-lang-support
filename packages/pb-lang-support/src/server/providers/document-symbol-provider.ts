/**
 * Documentation Symbol Provider
 * Provides documentation outline and symbol navigation functionality for PureBasic
 */

import {
    DocumentSymbolParams,
    DocumentSymbol,
    SymbolKind,
    Range
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

/**
 * Handle document symbol requests
 */
export function handleDocumentSymbol(
    params: DocumentSymbolParams,
    document: TextDocument
): DocumentSymbol[] {
    const text = document.getText();
    const lines = text.split('\n');
    const symbols: DocumentSymbol[] = [];
    const nonExpandableSymbols = new WeakSet<DocumentSymbol>(); // Track symbols that should not be expanded (e.g., Declare)

    let currentModule: DocumentSymbol | null = null;
    let currentStructure: DocumentSymbol | null = null;
    let currentProcedure: DocumentSymbol | null = null;
    let currentEnumeration: DocumentSymbol | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        if (trimmedLine === '' || trimmedLine.startsWith(';')) {
            continue;
        }

        // Module Definition
        const moduleMatch = trimmedLine.match(/^Module\s+(\w+)\b/i);
        if (moduleMatch) {
            const name = moduleMatch[1];
            const nameStart = safeIndexOf(line, name);
            const selectionRange = createSafeRange(i, nameStart, name.length, line.length);
            const blockRange: Range = {
                start: { line: i, character: 0 },
                end: { line: i, character: line.length }
            };

            // Check if it is a single-line module (Module ... : EndModule)
            const isSingleLine = trimmedLine.includes(':') && trimmedLine.includes('EndModule');

            if (isSingleLine) {
                //Single-line modules are added directly to the symbol list without setting the currentModule.
                const singleLineModule: DocumentSymbol = {
                    name,
                    kind: SymbolKind.Module,
                    range: blockRange,
                    selectionRange,
                    children: []
                };
                symbols.push(singleLineModule);
            } else {
                // Multi-line module configuration for currentModule to allow nested symbols until EndModule is found.
                currentModule = {
                    name,
                    kind: SymbolKind.Module,
                    range: blockRange,
                    selectionRange,
                    children: []
                };
                symbols.push(currentModule);
            }
            continue;
        }

        // Module end
        if (trimmedLine.match(/^EndModule\b/i)) {
            currentModule = null;
            continue;
        }

        // Structure definition
        const structMatch = trimmedLine.match(/^Structure\s+(\w+)\b/i);
        if (structMatch) {
            const name = structMatch[1];
            const nameStart = safeIndexOf(line, name);
            const selectionRange = createSafeRange(i, nameStart, name.length, line.length);
            const blockRange: Range = {
                start: { line: i, character: 0 },
                end: { line: i, character: line.length }
            };

            const structSymbol: DocumentSymbol = {
                name,
                kind: SymbolKind.Struct,
                range: blockRange,
                selectionRange,
                children: []
            };

            if (currentModule) {
                currentModule.children!.push(structSymbol);
            } else {
                symbols.push(structSymbol);
            }
            currentStructure = structSymbol;
            continue;
        }

        // End of struct
        if (trimmedLine.match(/^EndStructure\b/i)) {
            currentStructure = null;
            continue;
        }

        // Interface definition
        const interfaceMatch = trimmedLine.match(/^Interface\s+(\w+)\b/i);
        if (interfaceMatch) {
            const name = interfaceMatch[1];
            const nameStart = safeIndexOf(line, name);
            const selectionRange = createSafeRange(i, nameStart, name.length, line.length);
            const blockRange: Range = {
                start: { line: i, character: 0 },
                end: { line: i, character: line.length }
            };

            const interfaceSymbol: DocumentSymbol = {
                name,
                kind: SymbolKind.Interface,
                range: blockRange,
                selectionRange,
                children: []
            };

            if (currentModule) {
                currentModule.children!.push(interfaceSymbol);
            } else {
                symbols.push(interfaceSymbol);
            }
            continue;
        }

        // Enumeration definition
        const enumMatch = trimmedLine.match(/^Enumeration\s+(\w+)?\b/i);
        if (enumMatch) {
            const name = enumMatch[1] || 'Anonymous';
            const nameStart = enumMatch[1] ? safeIndexOf(line, enumMatch[1]) : 0;
            const selectionRange = createSafeRange(i, nameStart, (enumMatch[1] || '').length || line.trim().length, line.length);
            const blockRange: Range = {
                start: { line: i, character: 0 },
                end: { line: i, character: line.length }
            };

            currentEnumeration = {
                name,
                kind: SymbolKind.Enum,
                range: blockRange,
                selectionRange,
                children: []
            };

            if (currentModule) {
                currentModule.children!.push(currentEnumeration);
            } else {
                symbols.push(currentEnumeration);
            }
            continue;
        }

        // End of enumeration
        if (trimmedLine.match(/^EndEnumeration\b/i)) {
            currentEnumeration = null;
            continue;
        }

        // Procedure definition
        const procMatch = trimmedLine.match(/^Procedure(?:C|DLL|CDLL)?(?:\.(\w+))?\s+(\w+)\s*\(/i);
        if (procMatch) {
            const returnType = procMatch[1];
            const name = procMatch[2];
            const displayName = returnType ? `${name}() : ${returnType}` : `${name}()`;
            const nameStart = safeIndexOf(line, name);
            const selectionRange = createSafeRange(i, nameStart, name.length, line.length);
            const blockRange = createLineRange(i, line.length);

            currentProcedure = {
                name: displayName,
                kind: SymbolKind.Function,
                range: blockRange,
                selectionRange,
                children: [],
                detail: 'Procedure'
            };

            if (currentModule) {
                currentModule.children!.push(currentProcedure);
            } else {
                symbols.push(currentProcedure);
            }
            continue;
        }

        // Procedure complete
        if (trimmedLine.match(/^EndProcedure\b/i)) {
            currentProcedure = null;
            continue;
        }

        // Procedure declaration
        const declareMatch = trimmedLine.match(/^Declare(?:C|DLL|CDLL)?(?:\.(\w+))?\s+(\w+)\s*\(/i);
        if (declareMatch) {
            const returnType = declareMatch[1];
            const name = declareMatch[2];
            const displayName = returnType ? `${name}() : ${returnType}` : `${name}()`;
            const nameStart = safeIndexOf(line, name);
            const selectionRange = createSafeRange(i, nameStart, name.length, line.length);
            const declarationRange = createLineRange(i, line.length);

            const declareSymbol: DocumentSymbol = {
                name: displayName,
                kind: SymbolKind.Function,
                range: declarationRange,
                selectionRange,
                detail: 'Declare'
            };
            nonExpandableSymbols.add(declareSymbol);

            if (currentModule) {
                currentModule.children!.push(declareSymbol);
            } else {
                symbols.push(declareSymbol);
            }
            continue;
        }

        // Constant definitions
        const constMatch = trimmedLine.match(/^#([a-zA-Z_][a-zA-Z0-9_]*\$?)\s*=/); // only NAME / NAME$ allowed as constant names
        if (constMatch) {
            const name = constMatch[1];
            const hashStart = safeIndexOf(line, `#${name}`);
            const selectionRange = createSafeRange(i, hashStart + 1, name.length, line.length); 
            const declarationRange = createLineRange(i, line.length);

            const constSymbol: DocumentSymbol = {
                name: `#${name}`,
                kind: SymbolKind.Constant,
                range: declarationRange,
                selectionRange,
                detail: 'Constant'
            };

            if (currentEnumeration) {
                currentEnumeration.children!.push(constSymbol);
            } else if (currentModule) {
                currentModule.children!.push(constSymbol);
            } else {
                symbols.push(constSymbol);
            }
            continue;
        }

        // Global variables
        const globalMatch = trimmedLine.match(/^(Global|Protected|Static)\s+(?:\w+\s+)?(\*?\w+)(?:\.(\w+))?/i);
        if (globalMatch) {
            const scope = globalMatch[1];
            const name = globalMatch[2];
            const type = globalMatch[3] || 'unknown';
            const displayName = `${name} : ${type}`;
            const nameStart = safeIndexOf(line, name);
            const selectionRange = createSafeRange(i, nameStart, name.length, line.length);

            const blockRange: Range = {
                start: { line: i, character: 0 },
                end: { line: i, character: line.length }
            };

            const varSymbol: DocumentSymbol = {
                name: displayName,
                kind: SymbolKind.Variable,
                range: blockRange,
                selectionRange,
                detail: scope
            };

            if (currentModule) {
                currentModule.children!.push(varSymbol);
            } else {
                symbols.push(varSymbol);
            }
            continue;
        }

        // Structure members
        if (currentStructure) {
            const memberMatch = trimmedLine.match(/^(\*?\w+)(?:\.(\w+))?/);
            if (memberMatch && !trimmedLine.match(/^(Global|Protected|Static|Procedure|EndStructure|;)/i)) {
                const name = memberMatch[1];
                const type = memberMatch[2] || 'unknown';
                const displayName = `${name} : ${type}`;
                const nameStart = safeIndexOf(line, name);
                const selectionRange = createSafeRange(i, nameStart, name.length, line.length);

                const blockRange: Range = {
                    start: { line: i, character: 0 },
                    end: { line: i, character: line.length }
                };

                const memberSymbol: DocumentSymbol = {
                    name: displayName,
                    kind: SymbolKind.Field,
                    range: blockRange,
                    selectionRange
                };

                currentStructure.children!.push(memberSymbol);
            }
        }

        // Local variables (within a procedure)
        if (currentProcedure) {
            const localVarMatch = trimmedLine.match(/^(Protected|Static|Define|Dim)\s+(?:\w+\s+)?(\*?\w+)(?:\.(\w+))?/i);
            if (localVarMatch) {
                const scope = localVarMatch[1];
                const name = localVarMatch[2];
                const type = localVarMatch[3] || 'unknown';
                const displayName = `${name} : ${type}`;
                const nameStart = safeIndexOf(line, name);
                const selectionRange = createSafeRange(i, nameStart, name.length, line.length);

                const blockRange: Range = {
                    start: { line: i, character: 0 },
                    end: { line: i, character: line.length }
                };

                const varSymbol: DocumentSymbol = {
                    name: displayName,
                    kind: SymbolKind.Variable,
                    range: blockRange,
                    selectionRange,
                    detail: scope
                };

                currentProcedure.children!.push(varSymbol);
            }
        }
    }

    // Update the scope to include the entire definition
    updateSymbolRanges(symbols, lines, nonExpandableSymbols);
    sortSymbolsStable(symbols);
    
    return symbols;
}

/**
 * Creates a range object
 */
function createSafeRange(line: number, startChar: number, length: number, lineLength: number): Range {
    const safeStart = Math.max(0, Math.min(startChar, lineLength));
    const safeEnd = Math.max(safeStart, Math.min(safeStart + Math.max(0, length), lineLength));

    return {
        start: { line, character: safeStart },
        end: { line, character: safeEnd }
    };
}

function createLineRange(line: number, lineLength: number): Range {
    return {
        start: { line, character: 0 },
        end: { line, character: Math.max(0, lineLength) }
    };
}

/**
 * Updates symbol ranges to include the full definition block
 */
function updateSymbolRanges(symbols: DocumentSymbol[], lines: string[], nonExpandableSymbols: WeakSet<DocumentSymbol>) {
    for (const symbol of symbols) {
        if (symbol.kind === SymbolKind.Module) {
            updateSymbolEnd(symbol, lines, /^EndModule\b/i);
        } else if (symbol.kind === SymbolKind.Struct) {
            updateSymbolEnd(symbol, lines, /^EndStructure\b/i);
        } else if (symbol.kind === SymbolKind.Interface) {
            updateSymbolEnd(symbol, lines, /^EndInterface\b/i);
        } else if (symbol.kind === SymbolKind.Enum) {
            updateSymbolEnd(symbol, lines, /^EndEnumeration\b/i);
        } else if (symbol.kind === SymbolKind.Function && !nonExpandableSymbols.has(symbol)) {
            updateSymbolEnd(symbol, lines, /^EndProcedure\b/i);
        }

        // Recursively update sub-symbols
        if (symbol.children && symbol.children.length > 0) {
            updateSymbolRanges(symbol.children, lines, nonExpandableSymbols);
        }
    }
}

function updateSymbolEnd(symbol: DocumentSymbol, lines: string[], endPattern: RegExp) {
    const startLine = symbol.range.start.line;
    for (let i = startLine + 1; i < lines.length; i++) {
        if (lines[i].trim().match(endPattern)) {
            symbol.range.end = { line: i, character: lines[i].length };
            return;
        }
    }
}

function sortSymbolsStable(list: DocumentSymbol[]) {
    list.sort((a, b) => {
        const la = a.range.start.line - b.range.start.line;
        if (la !== 0) return la;
        const ca = a.range.start.character - b.range.start.character;
        if (ca !== 0) return ca;
        return a.name.localeCompare(b.name);
    });
    for (const s of list) {
        if (s.children?.length) sortSymbolsStable(s.children);
    }
}

/**
 * Returns a safe index for range calculations.
 * Falls back to 0 if the substring cannot be found.
 */
function safeIndexOf(haystack: string, needle: string): number {
    const idx = haystack.indexOf(needle);
    return idx >= 0 ? idx : 0;
}
