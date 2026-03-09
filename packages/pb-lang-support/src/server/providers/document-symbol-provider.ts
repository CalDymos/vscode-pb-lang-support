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
import { parsePureBasicConstantDefinition } from '../utils/constants';
import { safeIndexOf } from '../utils/pb-lexer-utils';

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
    let currentInterface: DocumentSymbol | null = null;   // track Interface body
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
            currentInterface = interfaceSymbol;   // FIX: was missing
            continue;
        }

        // End of Interface
        // EndInterface resetting currentInterface
        if (trimmedLine.match(/^EndInterface\b/i)) {
            currentInterface = null;
            continue;
        }

        // Enumeration / EnumerationBinary definition
        // “Enumeration” (without names) are
        // matched using \s*; "Step" lookahead prevents it from
        // being incorrectly identified as an enumeration name.
        const enumMatch = trimmedLine.match(/^(Enumeration(?:Binary)?)\s*(?!Step\b)(\w+)?/i);
        if (enumMatch) {
            const enumKeyword = enumMatch[1];                // 'Enumeration' or 'EnumerationBinary'
            const enumName    = enumMatch[2];                // may be undefined for anonymous blocks
            const name        = enumName || 'Anonymous';
            const displayName = `${name} [${enumKeyword}]`;
            const nameStart   = enumName ? safeIndexOf(line, enumName) : 0;
            const nameLen     = enumName ? enumName.length : line.trim().length;
            const selectionRange = createSafeRange(i, nameStart, nameLen, line.length);
            const blockRange: Range = {
                start: { line: i, character: 0 },
                end: { line: i, character: line.length }
            };

            currentEnumeration = {
                name: displayName,
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

        // Macro definition
        // Parameterless macros (no '(' after name)
        // are also valid in PureBasic.
        const macroMatch = trimmedLine.match(/^Macro\s+(\w+)/i);
        if (macroMatch) {
            const name = macroMatch[1];
            const nameStart = safeIndexOf(line, name);
            const selectionRange = createSafeRange(i, nameStart, name.length, line.length);
            const blockRange: Range = {
                start: { line: i, character: 0 },
                end: { line: i, character: line.length }
            };

            const macroSymbol: DocumentSymbol = {
                name: `${name} [Macro]`,
                kind: SymbolKind.Function,
                range: blockRange,
                selectionRange,
                children: [],
                detail: 'Macro'
            };

            if (currentModule) {
                currentModule.children!.push(macroSymbol);
            } else {
                symbols.push(macroSymbol);
            }
            continue;
        }

        // End of Macro
        if (trimmedLine.match(/^EndMacro\b/i)) {
            continue;
        }

        // Prototype / PrototypeC definition
        const protoMatch = trimmedLine.match(/^Prototype(?:C)?(?:\.(\w+))?\s+(\w+)\s*\(/i);
        if (protoMatch) {
            const returnType = protoMatch[1];
            const name       = protoMatch[2];
            const displayName = returnType ? `${name}() : ${returnType}` : `${name}()`;
            const nameStart = safeIndexOf(line, name);
            const selectionRange = createSafeRange(i, nameStart, name.length, line.length);
            const declarationRange = createLineRange(i, line.length);

            const protoSymbol: DocumentSymbol = {
                name: displayName,
                kind: SymbolKind.Function,
                range: declarationRange,
                selectionRange,
                detail: 'Prototype'
            };
            nonExpandableSymbols.add(protoSymbol);

            if (currentModule) {
                currentModule.children!.push(protoSymbol);
            } else {
                symbols.push(protoSymbol);
            }
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
        // Constant definitions (#NAME = value or #NAME$ = value)
        const constMatch = parsePureBasicConstantDefinition(trimmedLine);
        if (constMatch) {
            const name = constMatch.name;
            //const value = stripInlineComment(constMatch.value?.trim() ?? '').trim();
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

        // Global variables — multi-variable declaration support
        // e.g. "Global a.i, *b.MyType, c" → three symbols
        const globalScopeRe = /^(Global|Protected|Static|Threaded|Define|Dim)\s+(?:(?:NewList|NewMap|NewArray)\s+)?/i;
        const globalHeadMatch = trimmedLine.match(globalScopeRe);
        if (globalHeadMatch) {
            const scope      = globalHeadMatch[1];
            const keywordEnd = globalHeadMatch[0].length;          // offset within trimmedLine
            const remaining  = trimmedLine.substring(keywordEnd);
            const lineIndent = line.length - line.trimStart().length;
            const blockRange: Range = {
                start: { line: i, character: 0 },
                end:   { line: i, character: line.length }
            };

            const nameRe = /(?:^|,)\s*\*?(\w+)(?:\.(\w+))?/g;
            let nm: RegExpExecArray | null;
            while ((nm = nameRe.exec(remaining)) !== null) {
                const name = nm[1];
                const type = nm[2] || 'unknown';
                const displayName = `${name} : ${type}`;
                const posInRemaining = nm.index + nm[0].indexOf(name);
                const startChar      = lineIndent + keywordEnd + posInRemaining;
                const selectionRange = createSafeRange(i, startChar, name.length, line.length);

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
            }
            continue;
        }

        // Structure members
        if (currentStructure) {
            // Array/List/Map collection members have a leading keyword;
            // extract the actual member name from the second word.
            const collectionMember = trimmedLine.match(/^(?:Array|List|Map)\s+\*?(\w+)(?:\.(\w+))?/i);
            if (collectionMember) {
                const name = collectionMember[1];
                const type = collectionMember[2] || 'unknown';
                const displayName = `${name} : ${type}`;
                const nameStart = safeIndexOf(line, name);
                const selectionRange = createSafeRange(i, nameStart, name.length, line.length);
                const blockRange: Range = { start: { line: i, character: 0 }, end: { line: i, character: line.length } };
                currentStructure.children!.push({ name: displayName, kind: SymbolKind.Field, range: blockRange, selectionRange });
            } else {
                // Exclusion list 
                const memberMatch = trimmedLine.match(/^(\*?\w+)(?:\.(\w+))?/);
                if (memberMatch && !trimmedLine.match(/^(Global|Protected|Static|Procedure|EndStructure|Array|List|Map|Enumeration|Interface|Declare|Structure|Macro|Prototype|;)/i)) {
                    const name = memberMatch[1];
                    const type = memberMatch[2] || 'unknown';
                    const displayName = `${name} : ${type}`;
                    const nameStart = safeIndexOf(line, name);
                    const selectionRange = createSafeRange(i, nameStart, name.length, line.length);
                    const blockRange: Range = { start: { line: i, character: 0 }, end: { line: i, character: line.length } };
                    currentStructure.children!.push({ name: displayName, kind: SymbolKind.Field, range: blockRange, selectionRange });
                }
            }
        }

        // Interface methods as children
        // tracked with SymbolKind.Method.
        // PureBasic interface method syntax: MethodName[.ReturnType]([params])
        if (currentInterface) {
            const methodMatch = trimmedLine.match(/^(\w+)(?:\.(\w+))?\s*\(/);
            if (methodMatch && !trimmedLine.match(/^(EndInterface|;)/i)) {
                const name = methodMatch[1];
                const returnType = methodMatch[2];
                const displayName = returnType ? `${name}() : ${returnType}` : `${name}()`;
                const nameStart = safeIndexOf(line, name);
                const selectionRange = createSafeRange(i, nameStart, name.length, line.length);
                const blockRange: Range = { start: { line: i, character: 0 }, end: { line: i, character: line.length } };
                currentInterface.children!.push({ name: displayName, kind: SymbolKind.Method, range: blockRange, selectionRange });
            }
        }

        // Local variables (within a procedure) — multi-variable declaration support
        // e.g. "Protected a.i, *b.MyType, c" → three child symbols
        if (currentProcedure) {
            const localScopeRe = /^(Protected|Static|Define|Dim|Shared)\s+(?:(?:NewList|NewMap|NewArray)\s+)?/i;
            const localHeadMatch = trimmedLine.match(localScopeRe);
            if (localHeadMatch) {
                const scope      = localHeadMatch[1];
                const keywordEnd = localHeadMatch[0].length;
                const remaining  = trimmedLine.substring(keywordEnd);
                const lineIndent = line.length - line.trimStart().length;
                const blockRange: Range = {
                    start: { line: i, character: 0 },
                    end:   { line: i, character: line.length }
                };

                const nameRe = /(?:^|,)\s*\*?(\w+)(?:\.(\w+))?/g;
                let nm: RegExpExecArray | null;
                while ((nm = nameRe.exec(remaining)) !== null) {
                    const name = nm[1];
                    const type = nm[2] || 'unknown';
                    const displayName = `${name} : ${type}`;
                    const posInRemaining = nm.index + nm[0].indexOf(name);
                    const startChar      = lineIndent + keywordEnd + posInRemaining;
                    const selectionRange = createSafeRange(i, startChar, name.length, line.length);

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
            // Macro symbols use EndMacro; Procedure symbols use EndProcedure.
            if (symbol.detail === 'Macro') {
                updateSymbolEnd(symbol, lines, /^EndMacro\b/i);
            } else {
                updateSymbolEnd(symbol, lines, /^EndProcedure\b/i);
            }
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
    // If no end marker is found, default to the end of the file or the first line
    const endLine = Math.max(startLine, lines.length - 1);
    symbol.range.end = { line: endLine, character: lines[endLine]?.length || 0 };
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