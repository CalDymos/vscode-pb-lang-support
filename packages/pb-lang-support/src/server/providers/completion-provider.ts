/**
 * Code completion provider
 * Provides intelligent code completion functionality for PureBasic
 */

import {
    CompletionItem,
    CompletionItemKind,
    CompletionParams,
    CompletionList,
    InsertTextFormat
} from 'vscode-languageserver/node';
import {
    keywords, types, allBuiltInFunctions, arrayFunctions, listFunctions, mapFunctions,
    windowsApiFunctions, graphicsFunctions, networkFunctions, databaseFunctions, threadFunctions,
    zeroParamBuiltInFunctions, parsePureBasicConstantDefinition
} from '../utils/constants';
import { getModuleFunctionCompletions as getModuleFunctions, getAvailableModules, getModuleExports } from '../utils/module-resolver';
import { analyzeScopesAndVariables, getActiveUsedModules } from '../utils/scope-manager';
import { parseIncludeFiles } from '../utils/module-resolver';
import * as fs from 'fs';
import { withErrorHandling, withAsyncErrorHandling, getErrorHandler } from '../utils/error-handler';

/**
 * Handle code completion requests
 */
export function handleCompletion(
    params: CompletionParams,
    document: any,
    documentCache: Map<string, any>
): CompletionList {
    try {
        return handleCompletionInternal(params, document, documentCache);
    } catch (error) {
        console.error('Completion provider error:', error);
        return { isIncomplete: false, items: [] };
    }
}

function handleCompletionInternal(
    params: CompletionParams,
    document: any,
    documentCache: Map<string, any>
): CompletionList {
    const completionItems: CompletionItem[] = [];
    const position = params.position;
    const text = document.getText();
    const lines = text.split('\n');
    const currentLine = lines[position.line] || '';
    const linePrefix = currentLine.substring(0, position.character);

    // Get the context that triggers completion
    const context = getTriggerContext(linePrefix);

    // Structure member access completion var\member
    if (context.isAfterStructAccess) {
        const documentText = document.getText();
        const scopeAnalysis = analyzeScopesAndVariables(documentText, position.line);
        const normalizeVar = (n: string) => n.replace(/^\*/, '').replace(/\([^)]*\)$/, '');
        const targetVar = normalizeVar(context.structVarName);
        const varInfo = scopeAnalysis.availableVariables.find(v => v.name.toLowerCase() === targetVar.toLowerCase());
        if (!varInfo) {
            return { isIncomplete: false, items: [] };
        }

        const baseType = getBaseType(varInfo.type);
        if (!baseType) {
            return { isIncomplete: false, items: [] };
        }

        const structIndex = buildStructureIndex(document, documentCache);
        const members = structIndex.get(baseType) || [];
        const items = members
            .filter(m => m.name.toLowerCase().startsWith(context.structMemberPrefix.toLowerCase()))
            .map((m, idx) => ({
                label: m.name,
                kind: CompletionItemKind.Field,
                data: `struct_${baseType}_${m.name}_${idx}`,
                detail: `${baseType}::${m.name}${m.type ? ' : ' + m.type : ''}`,
                documentation: `Structure ${baseType} member ${m.name}${m.type ? ' of type ' + m.type : ''}`
            }));

        return { isIncomplete: false, items };
    }

    // Constant context (starting with #): only complete constants
    if (context.isConstantContext) {
        const items: CompletionItem[] = [];
        const docSymbols = extractDocumentSymbols(document, documentCache);
        docSymbols.constants.forEach((c, idx) => {
            if (c.name.toLowerCase().startsWith(context.constPrefix.toLowerCase())) {
                items.push({
                    label: `#${c.name}`,
                    kind: CompletionItemKind.Constant,
                    data: `const_${idx}`,
                    detail: `Constant #${c.name}`,
                    documentation: c.value ? `#${c.name} = ${c.value}` : `Constant ${c.name}`,
                    insertText: `#${c.name}`,
                    insertTextFormat: InsertTextFormat.PlainText
                });
            }
        });
        // UseModule exported constants
        const usedModules2 = getActiveUsedModules(document.getText(), position.line);
        usedModules2.forEach(mod => {
            const ex = getModuleExports(mod, document, documentCache);
            ex.constants.forEach((c, i2) => {
                if (c.name.toLowerCase().startsWith(context.constPrefix.toLowerCase())) {
                    items.push({
                        label: `#${c.name}`,
                        kind: CompletionItemKind.Constant,
                        data: `usemodule_const_${mod}_${i2}`,
                        detail: `UseModule ${mod} → #${c.name}`,
                        documentation: c.value ? `#${c.name} = ${c.value}` : `Constant ${c.name}`,
                        insertText: `#${c.name}`,
                        insertTextFormat: InsertTextFormat.PlainText
                    });
                }
            });
        });

        return { isIncomplete: false, items };
    }

    // Check if it's a module call Module::
    if (context.isAfterModuleOperator) {
        const exports = getModuleExports(context.moduleName, document, documentCache);
        const funcFiltered = context.isModuleConstantContext ? [] : (context.moduleMemberPrefix
            ? exports.functions.filter(f => f.name.toLowerCase().startsWith(context.moduleMemberPrefix.toLowerCase()))
            : exports.functions);
        const constFiltered = context.isModuleConstantContext
            ? exports.constants.filter(c => c.name.toLowerCase().startsWith(context.moduleConstPrefix.toLowerCase()))
            : (context.moduleMemberPrefix ? exports.constants.filter(c => c.name.toLowerCase().startsWith(context.moduleMemberPrefix.toLowerCase())) : exports.constants);
        const structFiltered = context.isModuleConstantContext ? [] : (context.moduleMemberPrefix
            ? exports.structures.filter(s => s.name.toLowerCase().startsWith(context.moduleMemberPrefix.toLowerCase()))
            : exports.structures);

        const items: CompletionItem[] = [];
        // Functions
        items.push(...funcFiltered.map((func, index) => ({
            label: func.name,
            kind: CompletionItemKind.Function,
            data: `module_${context.moduleName}_${func.name}_${index}`,
            detail: `${context.moduleName}::${func.name}`,
            documentation: func.documentation,
            insertText: func.insertText,
            insertTextFormat: InsertTextFormat.PlainText,
            command: func.insertText.endsWith('(')
                ? { command: 'editor.action.triggerParameterHints', title: 'Trigger Parameter Hints' }
                : undefined
        })));
        // Constants (using #Name format)
        items.push(...constFiltered.map((c, index) => ({
            label: `#${c.name}`,
            kind: CompletionItemKind.Constant,
            data: `module_const_${context.moduleName}_${c.name}_${index}`,
            detail: `Constant ${context.moduleName}::#${c.name}`,
            documentation: c.value ? `#${c.name} = ${c.value}` : `Constant ${c.name}`,
            insertText: `#${c.name}`,
            insertTextFormat: InsertTextFormat.PlainText
        })));
        // Structures/Types
        items.push(...structFiltered.map((s, index) => ({
            label: s.name,
            kind: CompletionItemKind.Class,
            data: `module_struct_${context.moduleName}_${s.name}_${index}`,
            detail: `Structure ${context.moduleName}::${s.name}`,
            documentation: `Structure ${s.name}`,
            insertText: s.name,
            insertTextFormat: InsertTextFormat.PlainText
        })));
        // Interfaces
        const ifaceFiltered = (exports.interfaces || []).filter(ifc =>
            context.isModuleConstantContext ? false : (!context.moduleMemberPrefix || ifc.name.toLowerCase().startsWith(context.moduleMemberPrefix.toLowerCase()))
        );
        items.push(...ifaceFiltered.map((it, index) => ({
            label: it.name,
            kind: CompletionItemKind.Interface,
            data: `module_interface_${context.moduleName}_${it.name}_${index}`,
            detail: `Interface ${context.moduleName}::${it.name}`,
            documentation: `Interface ${it.name}`,
            insertText: it.name,
            insertTextFormat: InsertTextFormat.PlainText
        })));
        // Enumeration names (as types/group names)
        const enumFiltered = (exports.enumerations || []).filter(en =>
            context.isModuleConstantContext ? false : (!context.moduleMemberPrefix || en.name.toLowerCase().startsWith(context.moduleMemberPrefix.toLowerCase()))
        );
        items.push(...enumFiltered.map((en, index) => ({
            label: en.name,
            kind: CompletionItemKind.Enum,
            data: `module_enum_${context.moduleName}_${en.name}_${index}`,
            detail: `Enumeration ${context.moduleName}::${en.name}`,
            documentation: `Enumeration ${en.name}`,
            insertText: en.name,
            insertTextFormat: InsertTextFormat.PlainText
        })));

        return { isIncomplete: false, items };
    }

    // Use scope manager to get currently visible variables
    const documentText = document.getText();
    const scopeAnalysis = analyzeScopesAndVariables(documentText, position.line);

    // Add visible variables in the current scope
    scopeAnalysis.availableVariables.forEach((variable, index) => {
        if (variable.name.toLowerCase().startsWith(context.prefix.toLowerCase())) {
            let detail = variable.type;
            if (variable.isGlobal) detail += ' (global)';
            if (variable.isProtected) detail += ' (protected)';
            if (variable.isStatic) detail += ' (static)';
            if (variable.isParameter) detail += ' (parameter)';

            completionItems.push({
                label: variable.name,
                kind: variable.isParameter ? CompletionItemKind.Value : CompletionItemKind.Variable,
                data: 'var_' + index,
                detail: `${detail} ${variable.name}`,
                documentation: `Variable: ${variable.name} (defined at line ${variable.definitionLine + 1})`
            });
        }
    });

    // Extract procedures and constants from current and all documents (not scope-restricted)
    const documentSymbols = extractDocumentSymbols(document, documentCache);

    // Add procedures/functions defined in document
    documentSymbols.procedures.forEach((proc, index) => {
        if (proc.name.toLowerCase().startsWith(context.prefix.toLowerCase())) {
            completionItems.push({
                label: proc.name,
                kind: CompletionItemKind.Function,
                data: 'proc_' + index,
                detail: `Procedure ${proc.signature}`,
                documentation: `User-defined procedure: ${proc.name}`,
                insertText: proc.insertText,
                insertTextFormat: InsertTextFormat.PlainText,
                command: proc.insertText.endsWith('(')
                    ? { command: 'editor.action.triggerParameterHints', title: 'Trigger Parameter Hints' }
                    : undefined
            });
        }
    });

    // Add constants (constants are usually global)
    documentSymbols.constants.forEach((constant, index) => {
        if (constant.name.toLowerCase().startsWith(context.prefix.toLowerCase())) {
            completionItems.push({
                label: constant.name,
                kind: CompletionItemKind.Constant,
                data: 'const_' + index,
                detail: `Constant ${constant.name}`,
                documentation: `Constant: ${constant.name} = ${constant.value || 'unknown'}`
            });
        }
    });

    // Add keyword completion
    keywords.forEach((keyword, index) => {
        if (keyword.toLowerCase().startsWith(context.prefix.toLowerCase())) {
            completionItems.push({
                label: keyword,
                kind: CompletionItemKind.Keyword,
                data: 'kw_' + index,
                detail: 'PureBasic Keyword',
                documentation: `PureBasic keyword: ${keyword}`
            });
        }
    });

    // Add type completion
    types.forEach((type, index) => {
        if (type.toLowerCase().startsWith(context.prefix.toLowerCase())) {
            completionItems.push({
                label: type,
                kind: CompletionItemKind.Class,
                data: 'type_' + index,
                detail: 'PureBasic Type',
                documentation: `PureBasic built-in type: ${type}`
            });
        }
    });

    // Add structures/interfaces/enumeration names (definition names parsed from documents/includes)
    documentSymbols.structures.forEach((s, index) => {
        if (s.name.toLowerCase().startsWith(context.prefix.toLowerCase())) {
            completionItems.push({
                label: s.name,
                kind: CompletionItemKind.Class,
                data: 'struct_' + index,
                detail: 'Structure',
                documentation: `Structure ${s.name}`
            });
        }
    });
    documentSymbols.interfaces.forEach((it, index) => {
        if (it.name.toLowerCase().startsWith(context.prefix.toLowerCase())) {
            completionItems.push({
                label: it.name,
                kind: CompletionItemKind.Interface,
                data: 'iface_' + index,
                detail: 'Interface',
                documentation: `Interface ${it.name}`
            });
        }
    });
    documentSymbols.enumerations.forEach((en, index) => {
        if (en.name.toLowerCase().startsWith(context.prefix.toLowerCase())) {
            completionItems.push({
                label: en.name,
                kind: CompletionItemKind.Enum,
                data: 'enum_' + index,
                detail: 'Enumeration',
                documentation: `Enumeration ${en.name}`
            });
        }
    });

    // UseModule aware: provide completion for functions of imported modules (no Module:: needed)
    const usedModules = getActiveUsedModules(documentText, position.line);
    const pushedLabels = new Set<string>(completionItems.map(i => i.label));
    usedModules.forEach((mod) => {
        const ex = getModuleExports(mod, document, documentCache);
        // Functions
        ex.functions.forEach((func, idx) => {
            if (func.name.toLowerCase().startsWith(context.prefix.toLowerCase())) {
                const key = `${func.name}`;
                if (pushedLabels.has(key)) return;
                pushedLabels.add(key);
                completionItems.push({
                    label: func.name,
                    kind: CompletionItemKind.Function,
                    data: `usemodule_${mod}_${func.name}_${idx}`,
                    detail: `UseModule ${mod} → ${func.name}`,
                    documentation: func.documentation,
                    insertText: func.insertText,
                    insertTextFormat: InsertTextFormat.PlainText,
                    command: func.insertText.endsWith('(')
                        ? { command: 'editor.action.triggerParameterHints', title: 'Trigger Parameter Hints' }
                        : undefined
                });
            }
        });
        // Structure names (types)
        ex.structures.forEach((s, idx) => {
            if (s.name.toLowerCase().startsWith(context.prefix.toLowerCase())) {
                const key = `${s.name}`;
                if (pushedLabels.has(key)) return;
                pushedLabels.add(key);
                completionItems.push({
                    label: s.name,
                    kind: CompletionItemKind.Class,
                    data: `usemodule_struct_${mod}_${s.name}_${idx}`,
                    detail: `UseModule ${mod} → Structure ${s.name}`,
                    documentation: `Structure ${s.name}`,
                    insertText: s.name,
                    insertTextFormat: InsertTextFormat.PlainText
                });
            }
        });
        // Interfaces
        (ex.interfaces || []).forEach((it, idx) => {
            if (it.name.toLowerCase().startsWith(context.prefix.toLowerCase())) {
                const key = `${it.name}`;
                if (pushedLabels.has(key)) return;
                pushedLabels.add(key);
                completionItems.push({
                    label: it.name,
                    kind: CompletionItemKind.Interface,
                    data: `usemodule_interface_${mod}_${it.name}_${idx}`,
                    detail: `UseModule ${mod} → Interface ${it.name}`,
                    documentation: `Interface ${it.name}`,
                    insertText: it.name,
                    insertTextFormat: InsertTextFormat.PlainText
                });
            }
        });
        // Enumeration names
        (ex.enumerations || []).forEach((en, idx) => {
            if (en.name.toLowerCase().startsWith(context.prefix.toLowerCase())) {
                const key = `${en.name}`;
                if (pushedLabels.has(key)) return;
                pushedLabels.add(key);
                completionItems.push({
                    label: en.name,
                    kind: CompletionItemKind.Enum,
                    data: `usemodule_enum_${mod}_${en.name}_${idx}`,
                    detail: `UseModule ${mod} → Enumeration ${en.name}`,
                    documentation: `Enumeration ${en.name}`,
                    insertText: en.name,
                    insertTextFormat: InsertTextFormat.PlainText
                });
            }
        });
    });

    // Add module name completion
    const availableModules = getAvailableModules(document, documentCache);
    availableModules.forEach((module, index) => {
        if (module.toLowerCase().startsWith(context.prefix.toLowerCase())) {
            completionItems.push({
                label: module,
                kind: CompletionItemKind.Module,
                data: 'module_' + index,
                detail: `Module ${module}`,
                documentation: `Module: ${module} - Available for use with :: operator`,
                insertText: `${module}::`,
                insertTextFormat: InsertTextFormat.PlainText
            });
        }
    });

    // Add built-in function completion
    allBuiltInFunctions.forEach((func, index) => {
        if (func.toLowerCase().startsWith(context.prefix.toLowerCase())) {
            // Most built-in functions have parameters, so only insert function name and left parenthesis
            // Let VS Code automatically show parameter hints
            const hasZeroParams = zeroParamBuiltInFunctions.includes(func);
            const insertText = hasZeroParams ? `${func}()` : `${func}(`;

            // Determine function type
            let functionType = 'PureBasic Built-in Function';
            let documentation = `PureBasic built-in function: ${func}()`;

            if (arrayFunctions.includes(func)) {
                functionType = 'Array Function';
                documentation = `Array function: ${func}() - Operations on arrays`;
            } else if (listFunctions.includes(func)) {
                functionType = 'List Function';
                documentation = `List function: ${func}() - Operations on linked lists`;
            } else if (mapFunctions.includes(func)) {
                functionType = 'Map Function';
                documentation = `Map function: ${func}() - Operations on associative arrays`;
            } else if (windowsApiFunctions.includes(func)) {
                functionType = 'Windows API Function';
                documentation = `Windows API function: ${func}() - Direct system calls`;
            } else if (graphicsFunctions.includes(func)) {
                functionType = 'Graphics/Game Function';
                documentation = `Graphics function: ${func}() - 2D graphics, sprites, sounds`;
            } else if (networkFunctions.includes(func)) {
                functionType = 'Network Function';
                documentation = `Network function: ${func}() - Network communication`;
            } else if (databaseFunctions.includes(func)) {
                functionType = 'Database Function';
                documentation = `Database function: ${func}() - Database operations`;
            } else if (threadFunctions.includes(func)) {
                functionType = 'Threading Function';
                documentation = `Threading function: ${func}() - Multi-threading and synchronization`;
            }

            completionItems.push({
                label: func,
                kind: CompletionItemKind.Function,
                data: 'builtin_' + index,
                detail: functionType,
                documentation: documentation,
                insertText: insertText,
                insertTextFormat: InsertTextFormat.PlainText,
                command: hasZeroParams ? undefined : { command: 'editor.action.triggerParameterHints', title: 'Trigger Parameter Hints' }
            });
        }
    });

    // Add code snippets
    const snippets = [
        {
            label: 'if',
            kind: CompletionItemKind.Snippet,
            insertText: 'If ${1:condition}\n\t${2:// code}\nEndIf',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'If statement',
            documentation: 'If-EndIf control structure'
        },
        {
            label: 'for',
            kind: CompletionItemKind.Snippet,
            insertText: 'For ${1:i} = ${2:0} To ${3:10}\n\t${4:// code}\nNext',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'For loop',
            documentation: 'For-Next loop structure'
        },
        {
            label: 'while',
            kind: CompletionItemKind.Snippet,
            insertText: 'While ${1:condition}\n\t${2:// code}\nWend',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'While loop',
            documentation: 'While-Wend loop structure'
        },
        {
            label: 'procedure',
            kind: CompletionItemKind.Snippet,
            insertText: 'Procedure ${1:Name}(${2:parameters})\n\t${3:// code}\nEndProcedure',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'Procedure',
            documentation: 'Procedure definition'
        },
        {
            label: 'structure',
            kind: CompletionItemKind.Snippet,
            insertText: 'Structure ${1:Name}\n\t${2:// fields}\nEndStructure',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'Structure',
            documentation: 'Structure definition'
        },
        {
            label: 'array',
            kind: CompletionItemKind.Snippet,
            insertText: 'Dim ${1:ArrayName}.${2:i}(${3:size})',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'Array Declaration',
            documentation: 'Declare an array with specified size and type'
        },
        {
            label: 'newlist',
            kind: CompletionItemKind.Snippet,
            insertText: 'NewList ${1:ListName}.${2:i}()',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'List Declaration',
            documentation: 'Create a new linked list'
        },
        {
            label: 'newmap',
            kind: CompletionItemKind.Snippet,
            insertText: 'NewMap ${1:MapName}.${2:i}()',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'Map Declaration',
            documentation: 'Create a new associative array (map)'
        },
        {
            label: 'foreach',
            kind: CompletionItemKind.Snippet,
            insertText: 'ForEach ${1:ListName}()\n\t${2:// code}\nNext',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'ForEach Loop',
            documentation: 'Iterate through all elements in a list'
        }
    ];

    completionItems.push(...snippets);

    return {
        isIncomplete: false,
        items: completionItems
    };
}

/**
 * Get the context that triggers completion
 */
function getTriggerContext(linePrefix: string): {
    prefix: string;
    isAfterDot: boolean;
    isInString: boolean;
    isAfterModuleOperator: boolean;
    moduleName: string;
    moduleMemberPrefix: string;
    isConstantContext: boolean;
    constPrefix: string;
    isModuleConstantContext: boolean;
    moduleConstPrefix: string;
    isAfterStructAccess: boolean;
    structVarName: string;
    structMemberPrefix: string;
} {
    // Check if in string
    const quoteCount = (linePrefix.match(/"/g) || []).length;
    const isInString = quoteCount % 2 === 1;

    // Check if after period (member access)
    const isAfterDot = linePrefix.trim().endsWith('.');

    // Check if it follows the module operator: Module:: or Module::# or Module:: prefix
    const moduleConstMatch = linePrefix.match(/([a-zA-Z_]\w*)::#([a-zA-Z_]\w*\$?)?$/);
    const moduleMatch = moduleConstMatch || linePrefix.match(/([a-zA-Z_]\w*)::(\w*)$/);
    const isAfterModuleOperator = !!moduleMatch;
    const moduleName = moduleMatch ? moduleMatch[1] : '';
    const moduleMemberPrefix = moduleConstMatch ? '' : (moduleMatch ? moduleMatch[2] : '');
    const isModuleConstantContext = !!moduleConstMatch;
    const moduleConstPrefix = moduleConstMatch ? (moduleConstMatch[2] ?? '') : '';

    // Check if in constant context: #Name... (but not after Module::)
    const constMatch = linePrefix.match(/#([a-zA-Z_]\w*\$?)?$/);
    const isConstantContext = !!constMatch && !isAfterModuleOperator; // Non-module #
    const constPrefix = constMatch ? constMatch[1] : '';

    // Check if for structure member access var\member
    const structMatch = linePrefix.match(/([A-Za-z_][A-Za-z0-9_]*|\*[A-Za-z_][A-Za-z0-9_]*)(?:\([^)]*\))?\\(\w*)$/);
    const isAfterStructAccess = !!structMatch;
    const structVarName = structMatch ? structMatch[1] : '';
    const structMemberPrefix = structMatch ? structMatch[2] : '';

    // Get current word prefix
    const match = linePrefix.match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
    const prefix = match ? match[1] : '';

    return {
        prefix,
        isAfterDot,
        isInString,
        isAfterModuleOperator,
        moduleName,
        moduleMemberPrefix,
        isConstantContext,
        constPrefix,
        isModuleConstantContext,
        moduleConstPrefix,
        isAfterStructAccess,
        structVarName,
        structMemberPrefix
    };
}

// Get base type name (remove pointers/arrays/annotations)
function getBaseType(typeStr: string): string {
    if (!typeStr) return '';
    // Remove suffix comments, e.g. " (array)", " (pointer)"
    const cleaned = typeStr.split(' ')[0];
    // Handle *Type
    const noPtr = cleaned.startsWith('*') ? cleaned.substring(1) : cleaned;
    // Handle Type[]
    const arrIdx = noPtr.indexOf('[');
    const base = arrIdx > -1 ? noPtr.substring(0, arrIdx) : noPtr;
    // Filter built-in short types (i,s,f, etc.), only meaningful for structure names (usually camelCase)
    return base;
}

// Build structure index: structure name -> member list
function buildStructureIndex(document: any, documentCache: Map<string, any>): Map<string, Array<{name: string; type?: string}>> {
    const map = new Map<string, Array<{name: string; type?: string}>>();

    const pushMember = (structName: string, member: {name: string; type?: string}) => {
        const list = map.get(structName) || [];
        // Deduplicate by name
        if (!list.some(m => m.name === member.name)) list.push(member);
        map.set(structName, list);
    };

    const addFromText = (text: string) => {
        const lines = text.split('\n');
        let current: string | null = null;
        for (let i = 0; i < lines.length; i++) {
            const raw = lines[i];
            const line = raw.trim();
            if (line === '' || line.startsWith(';')) continue;
            const start = line.match(/^Structure\s+(\w+)/i);
            if (start) { current = start[1]; continue; }
            if (line.match(/^EndStructure\b/i)) { current = null; continue; }
            if (current) {
                const m = line.match(/^(\*?)(\w+)(?:\.(\w+))?/);
                if (m) {
                    const name = m[2];
                    const type = m[3];
                    pushMember(current, { name, type });
                }
            }
        }
    };

    // Current document
    addFromText(document.getText());
    // Open documents
    for (const [uri, doc] of documentCache) {
        if (uri !== document.uri) addFromText(doc.getText());
    }
    // Include files
    try {
        const includes = parseIncludeFiles(document, documentCache);
        for (const file of includes) {
            try { const content = fs.readFileSync(file, 'utf8'); addFromText(content); } catch {}
        }
    } catch {}

    return map;
}


/**
 * Extract symbol information from document
 */
function extractDocumentSymbols(document: any, documentCache: Map<string, any>) {
    const symbols = {
        procedures: [] as Array<{name: string, signature: string, insertText: string}>,
        constants: [] as Array<{name: string, value?: string}>,
        structures: [] as Array<{name: string}>,
        interfaces: [] as Array<{name: string}>,
        enumerations: [] as Array<{name: string}>
    };

    // Analyze current document
    analyzeDocumentSymbols(document, symbols);

    // Analyze other documents in cache
    for (const [uri, doc] of documentCache) {
        if (uri !== document.uri) {
            analyzeDocumentSymbols(doc, symbols);
        }
    }

    return symbols;
}

/**
 * Analyze symbols in document
 */
function analyzeDocumentSymbols(document: any, symbols: any) {
    const text = document.getText();
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Look for procedure definition
        const procMatch = line.match(/^Procedure(?:\.(\w+))?\s+(\w+)\s*\(([^)]*)\)/i);
        if (procMatch) {
            const returnType = procMatch[1] || '';
            const name = procMatch[2];
            const params = procMatch[3] || '';
            const signature = returnType ? `.${returnType} ${name}(${params})` : `${name}(${params})`;
            // For functions with parameters, only insert function name and left parenthesis, let VS Code trigger parameter hints
            // For functions without parameters, insert the complete function call
            const insertText = params ? `${name}(` : `${name}()`;

            symbols.procedures.push({
                name,
                signature,
                insertText
            });
        }

        // Look up constant definitions
        const constMatch = parsePureBasicConstantDefinition(line);
        if (constMatch) {
            const name = constMatch.name;
            const value = constMatch.value;
            symbols.constants.push({ name, value });
        }

        // Look for structure definition
        const structMatch = line.match(/^Structure\s+(\w+)\b/i);
        if (structMatch) {
            symbols.structures.push({ name: structMatch[1] });
        }

        // Look for interface definition
        const ifaceMatch = line.match(/^Interface\s+(\w+)\b/i);
        if (ifaceMatch) {
            symbols.interfaces.push({ name: ifaceMatch[1] });
        }

        // Look for enumeration definition
        const enumMatch = line.match(/^Enumeration\s+(\w+)\b/i);
        if (enumMatch) {
            symbols.enumerations.push({ name: enumMatch[1] });
        }
    }
}

/**
 * Resolve additional information for completion items
 */
export function handleCompletionResolve(item: CompletionItem): CompletionItem {
    // Can add more detailed documentation or insert text here
    return item;
}
