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

/**
 * Handle hover requests
 */
export function handleHover(
    params: HoverParams,
    document: TextDocument,
    documentCache: Map<string, TextDocument>
): Hover | null {
    const position = params.position;
    const text = document.getText();
    const lines = text.split('\n');

    if (position.line >= lines.length) {
        return null;
    }

    const line = lines[position.line];
    const word = getWordAtPosition(line, position.character);

    if (!word) {
        return null;
    }

    // Check if it's a module call
    const moduleMatch = getModuleCallFromPosition(line, position.character);
    if (moduleMatch) {
        const moduleHover = getModuleFunctionHover(
            moduleMatch.moduleName,
            moduleMatch.functionName,
            document,
            documentCache
        );
        if (moduleHover) {
            return moduleHover;
        }
        const exportHover = getModuleExportHover(
            moduleMatch.moduleName,
            moduleMatch.functionName,
            document,
            documentCache
        );
        if (exportHover) {
            return exportHover;
        }
    }

    // Struct member hover: var\\member
    const structAccess = getStructAccessFromPosition(line, position.character);
    if (structAccess) {
        const scope = analyzeScopesAndVariables(text, position.line);
        const baseVar = scope.availableVariables.find(v => v.name.toLowerCase() === structAccess.varName.toLowerCase());
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

function normalizeConstantName(name: string): string {
    return name.replace(/\$$/, '').toLowerCase();
}


function getStructAccessFromPosition(line: string, character: number): { varName: string; memberName: string } | null {
    const re = /(\w+)\\(\w+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
        const start = m.index;
        const end = start + m[0].length;
        if (character >= start && character <= end) {
            return { varName: m[1], memberName: m[2] };
        }
    }
    return null;
}

function getBaseType(typeStr: string): string {
    if (!typeStr) return '';
    const cleaned = typeStr.split(' ')[0];
    const noPtr = cleaned.startsWith('*') ? cleaned.substring(1) : cleaned;
    const arrIdx = noPtr.indexOf('[');
    return arrIdx > -1 ? noPtr.substring(0, arrIdx) : noPtr;
}

/**
 * Get word at a given position
 */
function getWordAtPosition(line: string, character: number): string | null {
    let start = character;
    let end = character;

    // Search backward for word start
    while (start > 0 && /[a-zA-Z0-9_]/.test(line[start - 1])) {
        start--;
    }

    // Search forward for word end
    while (end < line.length && /[a-zA-Z0-9_]/.test(line[end])) {
        end++;
    }

    if (start === end) {
        return null;
    }

    return line.substring(start, end);
}

/**
 * Get module call information
 */
function getModuleCallFromPosition(line: string, character: number): {
    moduleName: string;
    functionName: string;
} | null {
    const beforeCursor = line.substring(0, character);
    const afterCursor = line.substring(character);
    const fullContext = beforeCursor + afterCursor;

    // Prefer matching constants (#) first
    let moduleMatch = fullContext.match(/(\w+)::#(\w+)/);
    if (!moduleMatch) {
        moduleMatch = fullContext.match(/(\w+)::(\w+)/);
    }
    if (moduleMatch) {
        const matchStart = line.indexOf(moduleMatch[0]);
        const matchEnd = matchStart + moduleMatch[0].length;

        if (character >= matchStart && character <= matchEnd) {
            return {
                moduleName: moduleMatch[1],
                functionName: moduleMatch[2]
            };
        }
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

    for (const doc of searchDocuments) {
        const text = doc.getText();
        const lines = text.split('\n');
        let inModule = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Check module start
            const moduleStartMatch = line.match(new RegExp(`^Module\\s+${moduleName}\\b`, 'i'));
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
            if (inModule) {
                const procMatch = line.match(new RegExp(`^Procedure(?:\\.(\\w+))?\\s+(${functionName})\\s*\\(([^)]*)\\)`, 'i'));
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

    for (const doc of searchDocuments) {
        const text = doc.getText();
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Look for procedure definition
            const procMatch = line.match(new RegExp(`^Procedure(?:\\.(\\w+))?\\s+(${word})\\s*\\(([^)]*)\\)`, 'i'));
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

            // Look for variable definition
            const varMatch = line.match(new RegExp(`^(Global|Protected|Static|Define|Dim)\\s+(?:\\w+\\s+)?(\\*?${word})(?:\\.(\\w+))?`, 'i'));
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
                const value = constMatch.value ?? '';

                return {
                    type: 'constant',
                    name: constMatch.name,
                    value,
                    documentation: value ? `Constant with value: ${value}` : 'Constant definition'
                };
            }

            // Find structure definitions
            const structMatch = line.match(new RegExp(`^Structure\\s+(${word})\\b`, 'i'));
            if (structMatch) {
                return {
                    type: 'structure',
                    name: word,
                    documentation: 'User-defined structure'
                };
            }

            // Look for interface definition
            const ifaceMatch = line.match(new RegExp(`^Interface\\s+(${word})\\b`, 'i'));
            if (ifaceMatch) {
                return {
                    type: 'interface',
                    name: word,
                    documentation: 'User-defined interface'
                };
            }

            // Look for enumeration definition
            const enumMatch = line.match(new RegExp(`^Enumeration\\s+(${word})\\b`, 'i'));
            if (enumMatch) {
                return {
                    type: 'enumeration',
                    name: word,
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
        case 'procedure':
            const signature = symbolInfo.returnType !== 'void'
                ? `Procedure.${symbolInfo.returnType} ${symbolInfo.name}(${symbolInfo.parameters})`
                : `Procedure ${symbolInfo.name}(${symbolInfo.parameters})`;
            content = `\`\`\`purebasic\n${signature}\n\`\`\`\n\n${symbolInfo.documentation}`;
            break;

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

        case 'enumeration':
            content = `\`\`\`purebasic\nEnumeration ${symbolInfo.name}\n\`\`\`\n\n${symbolInfo.documentation}`;
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

/**
 * Get built-in function information
 */
function getBuiltinFunctionInfo(functionName: string): Hover | null {
    const builtinFunctions: { [key: string]: any } = {
        'Debug': {
            signature: 'Debug(Text$)',
            description: 'Display debug information in the debug output window',
            parameters: ['Text$ - String to display']
        },
        'OpenWindow': {
            signature: 'OpenWindow(#Window, X, Y, Width, Height, Title$, Flags)',
            description: 'Open a new window',
            parameters: [
                '#Window - Window identifier',
                'X - X position of the window',
                'Y - Y position of the window',
                'Width - Window width',
                'Height - Window height',
                'Title$ - Window title',
                'Flags - Window creation flags'
            ]
        },
        'MessageRequester': {
            signature: 'MessageRequester(Title$, Text$, Flags)',
            description: 'Display a message dialog box',
            parameters: [
                'Title$ - Dialog title',
                'Text$ - Message text',
                'Flags - Dialog flags'
            ]
        },
        'CloseWindow': {
            signature: 'CloseWindow(#Window)',
            description: 'Close the specified window',
            parameters: ['#Window - Window identifier to close']
        },
        'ReadFile': {
            signature: 'ReadFile(#File, Filename$)',
            description: 'Open a file for reading',
            parameters: [
                '#File - File identifier',
                'Filename$ - Path to the file'
            ]
        },
        'WriteFile': {
            signature: 'WriteFile(#File, Filename$)',
            description: 'Open a file for writing',
            parameters: [
                '#File - File identifier',
                'Filename$ - Path to the file'
            ]
        }
    };

    const lowerFunctionName = functionName.toLowerCase();
    for (const [key, value] of Object.entries(builtinFunctions)) {
        if (key.toLowerCase() === lowerFunctionName) {
            const paramInfo = value.parameters.length > 0
                ? '\n\n**Parameters:**\n' + value.parameters.map((p: string) => `- ${p}`).join('\n')
                : '';

            const content = `\`\`\`purebasic\n${value.signature}\n\`\`\`\n\n${value.description}${paramInfo}`;

            return {
                contents: {
                    kind: MarkupKind.Markdown,
                    value: content
                }
            };
        }
    }

    return null;
}
