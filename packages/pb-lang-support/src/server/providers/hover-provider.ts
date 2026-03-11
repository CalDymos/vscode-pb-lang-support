/**
 * Hover information provider
 * Provides informational display when hovering over code in PureBasic
 */

import {
    Hover,
    MarkupContent,
    MarkupKind,
    HoverParams
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { analyzeScopesAndVariables } from '../utils/scope-manager';
import { getModuleExports } from '../utils/module-resolver';
import { parsePureBasicConstantDefinition} from '../utils/constants';
import { stripInlineComment, escapeRegExp, getWordAtPosition, normalizeConstantName, getModuleSymbolAtPosition, getBaseType, getStructAccessFromLine, normalizeVarName } from '../utils/pb-lexer-utils';
import type { ApiFunctionListing } from '../utils/api-function-listing';
import { findBuiltin } from '../utils/builtin-functions';

/** Single entry in the built-in function data file. */

/**
 * Handle hover requests
 */
export function handleHover(
    params: HoverParams,
    document: TextDocument,
    documentCache: Map<string, TextDocument>,
    apiListing?: ApiFunctionListing
): Hover | null {
    const position = params.position;
    const text = document.getText();
    const lines = text.split('\n');

    if (position.line < 0 || position.line >= lines.length) {
        return null;
    }

    const line = lines[position.line];
    const word = getWordAtPosition(line, position.character);

    if (!word) {
        return null;
    }

    // Check if it's a module call
    const moduleMatch = getModuleSymbolAtPosition(line, position.character);
    if (moduleMatch) {
        const moduleHover = getModuleFunctionHover(
            moduleMatch.moduleName,
            moduleMatch.symbolName,
            document,
            documentCache
        );
        if (moduleHover) {
            return moduleHover;
        }
        const exportHover = getModuleExportHover(
            moduleMatch.moduleName,
            moduleMatch.symbolName,
            document,
            documentCache
        );
        if (exportHover) {
            return exportHover;
        }
    }

    // Struct member hover: var\\member
    const structAccess = getStructAccessFromLine(line, position.character);
    if (structAccess) {
        const scope = analyzeScopesAndVariables(text, position.line);
        const baseVar = scope.availableVariables.find(v => v.name.toLowerCase() === normalizeVarName(structAccess.varName).toLowerCase());
        if (baseVar) {
            const structName = getBaseType(baseVar.type);
            const memberName = structAccess.memberName;
            const content = `\`\`\`purebasic\nStructure ${structName}\\${memberName}\n\`\`\``;
            return { contents: { kind: MarkupKind.Markdown, value: content } };
        }
    }

    // Look up symbol information
    const symbolInfo = findSymbolInfo(word, document, documentCache);
    if (symbolInfo) {
        return createHoverFromSymbol(symbolInfo);
    }

    // OS/native API functions (from APIFunctionListing.txt)
    if (apiListing) {
        const apiHover = getApiFunctionHover(word, apiListing);
        if (apiHover) {
            return apiHover;
       }
    }

    // Check built-in functions
    const builtinInfo = getBuiltinFunctionInfo(word);
    if (builtinInfo) {
        return builtinInfo;
    }

    return null;
}

function getModuleExportHover(
    moduleName: string,
    ident: string,
    document: TextDocument,
    documentCache: Map<string, TextDocument>
): Hover | null {
    const ex = getModuleExports(moduleName, document, documentCache);
    const c = ex.constants.find(x => x.name.toLowerCase() === ident.toLowerCase());
    if (c) {
        const content = '```purebasic\n#' + c.name + (c.value ? ' = ' + c.value : '') + '\n```';
        return { contents: { kind: MarkupKind.Markdown, value: content } };
    }
    const s = ex.structures.find(x => x.name.toLowerCase() === ident.toLowerCase());
    if (s) {
        const content = '```purebasic\nStructure ' + s.name + '\n```\n\nModule ' + moduleName;
        return { contents: { kind: MarkupKind.Markdown, value: content } };
    }
    return null;
}

/**
 * Get hover information for a module function
 */
function getModuleFunctionHover(
    moduleName: string,
    functionName: string,
    document: TextDocument,
    documentCache: Map<string, TextDocument>
): Hover | null {
    const searchDocuments = [document, ...Array.from(documentCache.values())];
    const safeModuleName = escapeRegExp(moduleName);
    const safeFunctionName = escapeRegExp(functionName);

    for (const doc of searchDocuments) {
        const text = doc.getText();
        const lines = text.split('\n');
        let inModule = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Check module start
            const moduleStartMatch = line.match(new RegExp(`^Module\\s+${safeModuleName}\\b`, 'i'));
            if (moduleStartMatch) {
                inModule = true;
                continue;
            }

            // Check module end
            if (line.match(/^EndModule\b/i)) {
                inModule = false;
                continue;
            }

            // Look for function definition inside module
            // ProcedureC / ProcedureDLL / ProcedureCDLL
            if (inModule) {
                const procMatch = line.match(new RegExp(`^Procedure(?:C|DLL|CDLL)?(?:\\.(\\w+))?\\s+(${safeFunctionName})\\s*\\(([^)]*)\\)`, 'i'));
                if (procMatch) {
                    const returnType = procMatch[1] || 'void';
                    const params = procMatch[3] || '';

                    // Look up documentation comments for the function
                    let documentation = '';
                    for (let j = i - 1; j >= 0; j--) {
                        const prevLine = lines[j].trim();
                        if (prevLine.startsWith(';')) {
                            documentation = prevLine.substring(1).trim() + '\n' + documentation;
                        } else if (prevLine === '') {
                            continue;
                        } else {
                            break;
                        }
                    }

                    const signature = returnType !== 'void'
                        ? `Procedure.${returnType} ${moduleName}::${functionName}(${params})`
                        : `Procedure ${moduleName}::${functionName}(${params})`;

                    const content = documentation
                        ? `\`\`\`purebasic\n${signature}\n\`\`\`\n\n${documentation}`
                        : `\`\`\`purebasic\n${signature}\n\`\`\`\n\nModule function in ${moduleName}`;

                    return {
                        contents: {
                            kind: MarkupKind.Markdown,
                            value: content
                        }
                    };
                }
            }
        }
    }

    return null;
}

/**
 * Find symbol information
 */
function findSymbolInfo(
    word: string,
    document: TextDocument,
    documentCache: Map<string, TextDocument>
): any | null {
    const searchDocuments = [document, ...Array.from(documentCache.values())];
    const safeWord = escapeRegExp(word);

    for (const doc of searchDocuments) {
        const text = doc.getText();
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Look for procedure definition
            // ProcedureC / ProcedureDLL / ProcedureCDLL
            const procMatch = line.match(new RegExp(`^Procedure(?:C|DLL|CDLL)?(?:\\.(\\w+))?\\s+(${safeWord})\\s*\\(([^)]*)\\)`, 'i'));
            if (procMatch) {
                const returnType = procMatch[1] || 'void';
                const params = procMatch[3] || '';

                // Look for comments
                let documentation = '';
                for (let j = i - 1; j >= 0; j--) {
                    const prevLine = lines[j].trim();
                    if (prevLine.startsWith(';')) {
                        documentation = prevLine.substring(1).trim() + '\n' + documentation;
                    } else if (prevLine === '') {
                        continue;
                    } else {
                        break;
                    }
                }

                return {
                    type: 'procedure',
                    name: word,
                    returnType,
                    parameters: params,
                    documentation: documentation || 'User-defined procedure'
                };
            }

            // Macro
            // Macro name hover – parameterless macros have no '(' after the name.
            const macroMatch = line.match(new RegExp(`^Macro\\s+(${safeWord})\\b`, 'i'));
            if (macroMatch) {
                return {
                    type: 'macro',
                    name: word,
                    documentation: 'User-defined macro'
                };
            }

            // Prototype / PrototypeC
            const protoMatch = line.match(new RegExp(`^Prototype(?:C)?(?:\\.(\\w+))?\\s+(${safeWord})\\s*\\(([^)]*)\\)`, 'i'));
            if (protoMatch) {
                const returnType = protoMatch[1] || 'void';
                const params = protoMatch[3] || '';
                return {
                    type: 'prototype',
                    name: word,
                    returnType,
                    parameters: params,
                    documentation: 'Function pointer type (Prototype)'
                };
            }

            // Look for variable definition
            // Shared and Threaded added as scope keywords.
            const varMatch = line.match(new RegExp(`^(Global|Protected|Static|Define|Dim|Shared|Threaded)\\s+(?:\\w+\\s+)?(\\*?${safeWord})(?:\\.(\\w+))?`, 'i'));
            if (varMatch) {
                const scope = varMatch[1];
                const varName = varMatch[2];
                const varType = varMatch[3] || 'unknown';

                return {
                    type: 'variable',
                    name: word,
                    varType,
                    scope,
                    documentation: `${scope} variable of type ${varType}`
                };
            }

            // Look up only constant definitions (#NAME = ... or #NAME$ = ...)
            const constMatch = parsePureBasicConstantDefinition(line);
            if (constMatch && normalizeConstantName(constMatch.name) === normalizeConstantName(word)) {
                const value = stripInlineComment(constMatch.value?.trim() ?? '').trim();

                return {
                    type: 'constant',
                    name: constMatch.name,
                    value,
                    documentation: value ? `Constant with value: ${value}` : 'Constant definition'
                };
            }

            // Find structure definitions
            const structMatch = line.match(new RegExp(`^Structure\\s+(${safeWord})\\b`, 'i'));
            if (structMatch) {
                return {
                    type: 'structure',
                    name: word,
                    documentation: 'User-defined structure'
                };
            }

            // Look for interface definition
            const ifaceMatch = line.match(new RegExp(`^Interface\\s+(${safeWord})\\b`, 'i'));
            if (ifaceMatch) {
                return {
                    type: 'interface',
                    name: word,
                    documentation: 'User-defined interface'
                };
            }

            // Look for enumeration definition
            // EnumerationBinary added; subType stored for correct hover rendering.
            const enumMatch = line.match(new RegExp(`^(Enumeration(?:Binary)?)\\s+(${safeWord})\\b`, 'i'));
            if (enumMatch) {
                return {
                    type: 'enumeration',
                    name: word,
                    enumKeyword: enumMatch[1],   // 'Enumeration' or 'EnumerationBinary'
                    documentation: 'Enumeration block'
                };
            }
        }
    }

    return null;
}

/**
 * Create hover content from symbol information
 */
function createHoverFromSymbol(symbolInfo: any): Hover {
    let content = '';

    switch (symbolInfo.type) {
        case 'procedure': {
            const signature = symbolInfo.returnType !== 'void'
                ? `Procedure.${symbolInfo.returnType} ${symbolInfo.name}(${symbolInfo.parameters})`
                : `Procedure ${symbolInfo.name}(${symbolInfo.parameters})`;
            content = `\`\`\`purebasic\n${signature}\n\`\`\`\n\n${symbolInfo.documentation}`;
            break;
        }

        // Macro hover
        case 'macro':
            content = `\`\`\`purebasic\nMacro ${symbolInfo.name}\n\`\`\`\n\n${symbolInfo.documentation}`;
            break;

        // Prototype hover
        case 'prototype': {
            const sig = symbolInfo.returnType !== 'void'
                ? `Prototype.${symbolInfo.returnType} ${symbolInfo.name}(${symbolInfo.parameters})`
                : `Prototype ${symbolInfo.name}(${symbolInfo.parameters})`;
            content = `\`\`\`purebasic\n${sig}\n\`\`\`\n\n${symbolInfo.documentation}`;
            break;
        }

        case 'variable':
            content = `\`\`\`purebasic\n${symbolInfo.scope} ${symbolInfo.name}.${symbolInfo.varType}\n\`\`\`\n\n${symbolInfo.documentation}`;
            break;

        case 'constant':
            content = `\`\`\`purebasic\n#${symbolInfo.name} = ${symbolInfo.value}\n\`\`\`\n\n${symbolInfo.documentation}`;
            break;

        case 'structure':
            content = `\`\`\`purebasic\nStructure ${symbolInfo.name}\n\`\`\`\n\n${symbolInfo.documentation}`;
            break;

        case 'interface':
            content = `\`\`\`purebasic\nInterface ${symbolInfo.name}\n\`\`\`\n\n${symbolInfo.documentation}`;
            break;

        // Use stored enumKeyword so EnumerationBinary renders correctly.
        case 'enumeration':
            content = `\`\`\`purebasic\n${symbolInfo.enumKeyword || 'Enumeration'} ${symbolInfo.name}\n\`\`\`\n\n${symbolInfo.documentation}`;
            break;

        default:
            content = `**${symbolInfo.name}**\n\n${symbolInfo.documentation || 'PureBasic symbol'}`;
    }

    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: content
        }
    };
}

function getApiFunctionHover(word: string, apiListing: ApiFunctionListing): Hover | null {
    const entry = apiListing.find(word);
    if (!entry) return null;

    const signature = entry.rawParams
        ? `${entry.pbName}(${entry.rawParams})`
        : `${entry.pbName}()`;

    const description = entry.comment ? `\n\n${escapeMarkdown(entry.comment)}` : '';
    const content = `\`\`\`purebasic\n${signature}\n\`\`\`${description}`;

    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: content
        }
    };
}

function escapeMarkdown(text: string): string {
    // Keep this minimal; the hover content is Markdown.
    return text.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
}

/**
 * Get built-in function hover information from pb-builtin-functions.json
 * via the shared builtin-functions utility.
 */
function getBuiltinFunctionInfo(functionName: string): Hover | null {
    const entry = findBuiltin(functionName);
    if (!entry) return null;

    const paramInfo = entry.parameters.length > 0
        ? '\n\n**Parameters:**\n' + entry.parameters.map(p => `- ${p}`).join('\n')
        : '';
    const docLink = entry.docUrl
        ? `\n\n[Documentation](${entry.docUrl})`
        : '';
    const content = `\`\`\`purebasic\n${entry.signature}\n\`\`\`\n\n${entry.description}${paramInfo}${docLink}`;

    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: content
        }
    };
}