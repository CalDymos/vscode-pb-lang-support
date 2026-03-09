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
import { TextDocument } from 'vscode-languageserver-textdocument';
import { keywords, types, typeSuffixDefinitions, windowsApiFunctions, parsePureBasicConstantDefinition } from '../utils/constants';
import { allBuiltinNames, findBuiltin } from '../utils/builtin-functions';
import { stripInlineComment, isPositionInString } from '../utils/pb-lexer-utils';
import { ApiFunctionListing } from '../utils/api-function-listing';
import { getAvailableModules, getModuleExports } from '../utils/module-resolver';
import { analyzeScopesAndVariables, getActiveUsedModules, VariableInfo } from '../utils/scope-manager';
import { parseIncludeFiles } from '../utils/module-resolver';
import * as fs from 'fs';

type LogFn = (message: string, err?: unknown) => void;

/** No-op until initCompletionProvider() is called. */
let internalLog: LogFn = () => { /* uninitialized */ };

/**
 * Must be called once during server startup to wire up LSP logging.
 * Until called, errors are silently swallowed.
 */
export function initCompletionProvider(logFn: LogFn): void {
    internalLog = logFn;
}

/**
 * Handle code completion requests
 */
export function handleCompletion(
    params: CompletionParams,
    document: TextDocument,
    documentCache: Map<string, TextDocument>,
    apiListing?: ApiFunctionListing
): CompletionList {
    try {
        return handleCompletionInternal(params, document, documentCache, apiListing);
    } catch (error) {
        internalLog('Completion provider error:', error);
        return { isIncomplete: false, items: [] };
    }
}

function handleCompletionInternal(
    params: CompletionParams,
    document: TextDocument,
    documentCache: Map<string, TextDocument>,
    apiListing?: ApiFunctionListing
): CompletionList {
    const completionItems: CompletionItem[] = [];
    const position = params.position;
    const text = document.getText();
    const lines = text.split('\n');

    // Ensure the requested line is within document bounds to prevent out-of-range access
    if (position.line < 0 || position.line >= lines.length) {
        return { isIncomplete: false, items: [] };
    }

    const currentLine = lines[position.line];
    const linePrefix = currentLine.substring(0, position.character);

    // Get the context that triggers completion
    const context = getTriggerContext(linePrefix);

    // No completions inside string literals.
    // isInString is correctly calculated in getTriggerContext (with comment-strip).
    if (context.isInString) {
        return { isIncomplete: false, items: [] };
    }

    // Structure member access completion var\member  (also handles chained var\a\b\prefix)
    if (context.isAfterStructAccess) {
        const documentText = document.getText();
        const scopeAnalysis = analyzeScopesAndVariables(documentText, position.line);
        const structIndex = buildStructureIndex(document, documentCache);

        // Resolve the struct type – either direct variable or chained member access.
        const resolvedType = resolveStructAccessType(
            linePrefix,
            scopeAnalysis.availableVariables,
            structIndex
        );
        if (!resolvedType) {
            return { isIncomplete: false, items: [] };
        }

        const members = structIndex.get(resolvedType) || [];
        const items = members
            .filter(m => m.name.toLowerCase().startsWith(context.structMemberPrefix.toLowerCase()))
            .map((m, idx) => {
                const ptrPrefix = m.isPointer ? '*' : '';
                const typeStr = m.type ? ` : ${ptrPrefix}${m.type}` : (m.isPointer ? ' : *' : '');
                return {
                    label: m.name,
                    kind: CompletionItemKind.Field,
                    data: `struct_${resolvedType}_${m.name}_${idx}`,
                    detail: `${resolvedType}\\${ptrPrefix}${m.name}${typeStr}`,
                    documentation: `Structure ${resolvedType} member ${ptrPrefix}${m.name}${typeStr}`
                };
            });

        return { isIncomplete: false, items };
    }

    // With-block member access: \member (no variable prefix)
    if (context.isAfterWithAccess) {
        const documentText = document.getText();
        const docLines = documentText.split('\n');

        // Find the variable bound by the innermost active With block
        const withVarName = findActiveWithVariable(docLines, position.line);
        if (!withVarName) {
            return { isIncomplete: false, items: [] };
        }

        const scopeAnalysis = analyzeScopesAndVariables(documentText, position.line);
        const normalizeVar = (n: string) => n.replace(/^\*/, '');
        const varInfo = scopeAnalysis.availableVariables.find(
            v => v.name.toLowerCase() === normalizeVar(withVarName).toLowerCase()
        );
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
            .filter(m => m.name.toLowerCase().startsWith(context.withMemberPrefix.toLowerCase()))
            .map((m, idx) => {
                const ptrPrefix = m.isPointer ? '*' : '';
                const typeStr = m.type ? ` : ${ptrPrefix}${m.type}` : (m.isPointer ? ' : *' : '');
                return {
                    label: m.name,
                    kind: CompletionItemKind.Field,
                    data: `with_${baseType}_${m.name}_${idx}`,
                    detail: `${baseType}\\${ptrPrefix}${m.name}${typeStr}`,
                    documentation: `With ${withVarName}: Structure ${baseType} member ${ptrPrefix}${m.name}${typeStr}`
                };
            });

        return { isIncomplete: false, items };
    }

    // Type annotation context: identifier. — offer type suffixes, long-form types, structures
    if (context.isAfterTypeAnnotation) {
        const docSymbols = extractDocumentSymbols(document, documentCache);
        const p = context.typeAnnotationPrefix.toLowerCase();
        const items: CompletionItem[] = [];

        // 1) Single-letter type suffixes
        typeSuffixDefinitions
            .filter(def => !p || def.name.startsWith(p))
            .forEach((def, idx) => {
                items.push({
                    label: def.name,
                    kind: CompletionItemKind.TypeParameter,
                    data: 'tsuffix_' + idx,
                    detail: `Type suffix .${def.name}`,
                    documentation: def.documentation,
                    insertText: def.name,
                    insertTextFormat: InsertTextFormat.PlainText,
                    sortText: '0_' + def.name,
                });
            });

        // 2) Long-form built-in types (Integer, Long, …)
        types
            .filter(t => !p || t.toLowerCase().startsWith(p))
            .forEach((t, idx) => {
                items.push({
                    label: t,
                    kind: CompletionItemKind.Class,
                    data: 'tlong_' + idx,
                    detail: `Built-in type ${t}`,
                    documentation: `PureBasic built-in type: ${t}`,
                    insertText: t,
                    insertTextFormat: InsertTextFormat.PlainText,
                    sortText: '1_' + t,
                });
            });

        // 3) User-defined structure names
        docSymbols.structures
            .filter(s => !p || s.name.toLowerCase().startsWith(p))
            .forEach((s, idx) => {
                items.push({
                    label: s.name,
                    kind: CompletionItemKind.Struct,
                    data: 'tstruct_' + idx,
                    detail: `Structure ${s.name}`,
                    documentation: `User-defined structure: ${s.name}`,
                    insertText: s.name,
                    insertTextFormat: InsertTextFormat.PlainText,
                    sortText: '2_' + s.name,
                });
            });

        // 4) Interface names (usable as pointer types)
        docSymbols.interfaces
            .filter(it => !p || it.name.toLowerCase().startsWith(p))
            .forEach((it, idx) => {
                items.push({
                    label: it.name,
                    kind: CompletionItemKind.Interface,
                    data: 'tiface_' + idx,
                    detail: `Interface ${it.name}`,
                    documentation: `User-defined interface: ${it.name}`,
                    insertText: it.name,
                    insertTextFormat: InsertTextFormat.PlainText,
                    sortText: '3_' + it.name,
                });
            });

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

    // Add constants
    // label and insertText must include '#' – PureBasic constants are always
    // referenced as #Name. Without this, the inserted text would be invalid PureBasic.
    // The isConstantContext branch (line ~116) is already correct; this branch was not.
    documentSymbols.constants.forEach((constant, index) => {
        if (constant.name.toLowerCase().startsWith(context.prefix.toLowerCase())) {
            completionItems.push({
                label: `#${constant.name}`,
                kind: CompletionItemKind.Constant,
                data: 'const_' + index,
                detail: `Constant #${constant.name}`,
                documentation: `Constant: #${constant.name} = ${constant.value || 'unknown'}`,
                insertText: `#${constant.name}`,
                insertTextFormat: InsertTextFormat.PlainText
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

    // Add built-in function completion from pb-builtin-functions.json.
    // hasZeroParams is derived from the JSON parameter list.
    allBuiltinNames().forEach((func, index) => {
        if (!func.toLowerCase().startsWith(context.prefix.toLowerCase())) return;

        const entry = findBuiltin(func)!;
        const hasZeroParams = entry.parameters.length === 0;
        const insertText = hasZeroParams ? `${func}()` : `${func}(`;

        completionItems.push({
            label: func,
            kind: CompletionItemKind.Function,
            data: 'builtin_' + index,
            detail: 'PureBasic Built-in Function',
            documentation: entry.description,
            insertText,
            insertTextFormat: InsertTextFormat.PlainText,
            command: hasZeroParams ? undefined : { command: 'editor.action.triggerParameterHints', title: 'Trigger Parameter Hints' }
        });
    });

    // Add OS API function completion from PureBasic APIFunctionListing.txt (native API calls)
    // Note: keep this separate from PureBasic built-ins because the listing is OS-specific.
    if (apiListing && context.prefix.length >= 2) {
        const apiMatches = apiListing.matchPrefix(context.prefix, 200);
        apiMatches.forEach((entry, idx) => {
            const label = entry.pbName;
            if (pushedLabels.has(label)) return;
            pushedLabels.add(label);

            const hasZeroParams = entry.params.length === 0;
            const insertText = hasZeroParams ? `${label}()` : `${label}(`;

            let apiDoc = entry.signature;
            if (entry.comment) {
                apiDoc += `\n${entry.comment}`;
            }

            completionItems.push({
                label,
                kind: CompletionItemKind.Function,
                data: `api_${idx}`,
                detail: 'OS API Function',
                documentation: apiDoc,
                insertText,
                insertTextFormat: InsertTextFormat.PlainText,
                command: hasZeroParams ? undefined : { command: 'editor.action.triggerParameterHints', title: 'Trigger Parameter Hints' }
            });
        });
    }

    // Minimal Windows-only fallback: keep a few common API functions available even when
    // APIFunctionListing.txt is not configured, only enabled on win32.
    if ((!apiListing || apiListing.getEntryCount() === 0) && process.platform === 'win32' && context.prefix.length >= 2) {
        const prefix = context.prefix.toLowerCase().replace(/_$/, '');
        windowsApiFunctions.forEach((func, idx) => {
            const baseName = func.toLowerCase().replace(/_$/, '');
            if (!baseName.startsWith(prefix)) return;

            if (pushedLabels.has(func)) return;
            pushedLabels.add(func);

            completionItems.push({
                label: func,
                kind: CompletionItemKind.Function,
                data: `api_fallback_${idx}`,
                detail: 'Windows API Function',
                documentation: `Windows API function: ${func}() - Direct system calls (fallback listing)`,
                insertText: `${func}(`,
                insertTextFormat: InsertTextFormat.PlainText,
                command: { command: 'editor.action.triggerParameterHints', title: 'Trigger Parameter Hints' }
            });
        });
    }


    // Add code snippets
    // All inline comments changed from // to ; (PureBasic comment syntax).
    // Added: Select/Case, Repeat/Until, With/EndWith, Macro/EndMacro,
    //        CompilerIf/CompilerEndIf, Declare, repeat-forever (ForEver),
    //        DisableExplicit/EnableExplicit, Data/Read/Restore.
    const snippets = [
        {
            label: 'if',
            kind: CompletionItemKind.Snippet,
            insertText: 'If ${1:condition}\n\t${2:; code}\nEndIf',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'If statement',
            documentation: 'If-EndIf control structure'
        },
        {
            label: 'ifel',
            kind: CompletionItemKind.Snippet,
            insertText: 'If ${1:condition}\n\t${2:; code}\nElse\n\t${3:; code}\nEndIf',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'If-Else statement',
            documentation: 'If-Else-EndIf control structure'
        },
        {
            label: 'ifelseif',
            kind: CompletionItemKind.Snippet,
            insertText: 'If ${1:condition}\n\t${2:; code}\nElseIf ${3:condition}\n\t${4:; code}\nElse\n\t${5:; code}\nEndIf',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'If-ElseIf-Else statement',
            documentation: 'If-ElseIf-Else-EndIf control structure'
        },
        {
            label: 'for',
            kind: CompletionItemKind.Snippet,
            insertText: 'For ${1:i} = ${2:0} To ${3:10}\n\t${4:; code}\nNext ${1:i}',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'For loop',
            documentation: 'For-Next loop structure'
        },
        {
            label: 'forstep',
            kind: CompletionItemKind.Snippet,
            insertText: 'For ${1:i} = ${2:0} To ${3:10} Step ${4:2}\n\t${5:; code}\nNext ${1:i}',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'For loop with Step',
            documentation: 'For-Next loop with custom step value'
        },
        {
            label: 'foreach',
            kind: CompletionItemKind.Snippet,
            insertText: 'ForEach ${1:ListName}()\n\t${2:; code}\nNext',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'ForEach Loop',
            documentation: 'Iterate through all elements in a list or map'
        },
        {
            label: 'while',
            kind: CompletionItemKind.Snippet,
            insertText: 'While ${1:condition}\n\t${2:; code}\nWend',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'While loop',
            documentation: 'While-Wend loop structure'
        },
        {
            label: 'repeat',
            kind: CompletionItemKind.Snippet,
            insertText: 'Repeat\n\t${1:; code}\nUntil ${2:condition}',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'Repeat-Until loop',
            documentation: 'Repeat-Until loop – executes at least once, then checks condition'
        },
        {
            label: 'forever',
            kind: CompletionItemKind.Snippet,
            insertText: 'Repeat\n\t${1:; code}\n\tIf ${2:exitCondition} : Break : EndIf\nForEver',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'Infinite loop (ForEver)',
            documentation: 'Repeat-ForEver infinite loop with Break exit'
        },
        {
            label: 'select',
            kind: CompletionItemKind.Snippet,
            insertText: 'Select ${1:variable}\n\tCase ${2:value1}\n\t\t${3:; code}\n\tCase ${4:value2}\n\t\t${5:; code}\n\tDefault\n\t\t${6:; code}\nEndSelect',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'Select-Case statement',
            documentation: 'Select-Case-EndSelect multi-branch structure'
        },
        {
            label: 'procedure',
            kind: CompletionItemKind.Snippet,
            insertText: 'Procedure ${1:Name}(${2:parameters})\n\t${3:; code}\nEndProcedure',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'Procedure',
            documentation: 'Procedure definition'
        },
        {
            label: 'procedurer',
            kind: CompletionItemKind.Snippet,
            insertText: 'Procedure.${1:i} ${2:Name}(${3:parameters})\n\t${4:; code}\n\tProcedureReturn ${5:result}\nEndProcedure',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'Procedure with return value',
            documentation: 'Procedure with typed return value and ProcedureReturn'
        },
        {
            label: 'declare',
            kind: CompletionItemKind.Snippet,
            insertText: 'Declare${1|,C,DLL,CDLL|} ${2:Name}(${3:parameters})',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'Declare (forward declaration)',
            documentation: 'Forward declaration for a procedure'
        },
        {
            label: 'structure',
            kind: CompletionItemKind.Snippet,
            insertText: 'Structure ${1:Name}\n\t${2:field}.${3:i}\nEndStructure',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'Structure',
            documentation: 'Structure definition'
        },
        {
            label: 'interface',
            kind: CompletionItemKind.Snippet,
            insertText: 'Interface ${1:Name}\n\t${2:Method}(${3:parameters})\nEndInterface',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'Interface',
            documentation: 'Interface definition (COM/object interface)'
        },
        {
            label: 'enumeration',
            kind: CompletionItemKind.Snippet,
            insertText: 'Enumeration ${1:Name}\n\t#${2:Value1}\n\t#${3:Value2}\nEndEnumeration',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'Enumeration',
            documentation: 'Enumeration definition'
        },
        {
            label: 'enumerationbinary',
            kind: CompletionItemKind.Snippet,
            insertText: 'EnumerationBinary ${1:Name}\n\t#${2:Flag1}\n\t#${3:Flag2}\nEndEnumeration',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'EnumerationBinary',
            documentation: 'Binary (power-of-two) enumeration for flags/bitmasks'
        },
        {
            label: 'macro',
            kind: CompletionItemKind.Snippet,
            insertText: 'Macro ${1:Name}(${2:param})\n\t${3:; code}\nEndMacro',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'Macro',
            documentation: 'Macro definition – inlined at compile time'
        },
        {
            label: 'module',
            kind: CompletionItemKind.Snippet,
            insertText: 'DeclareModule ${1:Name}\n\t${2:; public declarations}\nEndDeclareModule\n\nModule ${1:Name}\n\t${3:; implementation}\nEndModule',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'Module',
            documentation: 'DeclareModule / Module pair – PureBasic namespace/module'
        },
        {
            label: 'compilerif',
            kind: CompletionItemKind.Snippet,
            insertText: 'CompilerIf ${1:#PB_Compiler_OS} = ${2:#PB_OS_Windows}\n\t${3:; code}\nCompilerEndIf',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'CompilerIf',
            documentation: 'Compile-time conditional compilation block'
        },
        {
            label: 'with',
            kind: CompletionItemKind.Snippet,
            insertText: 'With ${1:variable}\n\t${2:\\field} = ${3:value}\nEndWith',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'With-EndWith',
            documentation: 'With-EndWith – shorthand for structure member access'
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
            label: 'data',
            kind: CompletionItemKind.Snippet,
            insertText: 'DataSection\n\t${1:MyLabel}:\n\tData.${2:i} ${3:1, 2, 3}\nEndDataSection\n\nRestore ${1:MyLabel}\nRead.${2:i} ${4:variable}',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'DataSection / Read',
            documentation: 'DataSection with Data/Restore/Read pattern'
        },
        {
            label: 'prototype',
            kind: CompletionItemKind.Snippet,
            insertText: 'Prototype${1|,C|}.${2:i} ${3:Name}(${4:parameters})',
            insertTextFormat: InsertTextFormat.Snippet,
            detail: 'Prototype',
            documentation: 'Prototype – defines a function pointer type'
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
    isAfterWithAccess: boolean;
    withMemberPrefix: string;
    isAfterTypeAnnotation: boolean;
    typeAnnotationPrefix: string;
} {
    // isInString – use the lexer-aware scanner that correctly handles both
    // regular "..." strings and escape ~"..." strings (where \" does not
    // terminate the string).  Simple quote-count parity would mis-classify
    // escape strings that contain \" sequences.
    const isInString = isPositionInString(linePrefix, linePrefix.length);

    // isAfterDot removed. In PureBasic '.' is the type-annotation separator
    // (e.g. var.i, Procedure.s), NOT a member-access operator. Member access uses '\'.
    // isAfterDot was also never read anywhere in handleCompletionInternal → dead code.

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

    // With-block access – \member without a preceding variable name.
    // In PureBasic, inside a With/EndWith block, members are accessed as \Name
    // without repeating the variable. The regex matches a \ that is preceded only
    // by whitespace, an operator, or start-of-line (but NOT by an identifier, which
    // is already handled by isAfterStructAccess above).
    // Examples:
    //   "  \na"          → isAfterWithAccess=true,  withMemberPrefix="na" 
    //   "  myVar\na"     → isAfterStructAccess=true, isAfterWithAccess=false 
    //   "x = \field"     → isAfterWithAccess=true,  withMemberPrefix="field" 
    const withAccessMatch = !isAfterStructAccess
        ? linePrefix.match(/(?:^|[\s=+\-*/(<,;])\\(\w*)$/)
        : null;
    const isAfterWithAccess = !!withAccessMatch;
    const withMemberPrefix = withAccessMatch ? (withAccessMatch[1] ?? '') : '';

    // Type annotation context: identifier. or *identifier. (type suffix after variable/Procedure)
    // In PureBasic '.' is the type-annotation separator (var.i, Procedure.s, param.MyStruct).
    // Member access uses '\' and is already handled by isAfterStructAccess.
    // Module access uses '::' and is already handled by isAfterModuleOperator.
    const typeAnnotationMatch = !isAfterStructAccess && !isAfterModuleOperator && !isInString
        ? linePrefix.match(/\*?[a-zA-Z_]\w*\.([a-zA-Z_]\w*)$|\*?[a-zA-Z_]\w*\.()$/)
        : null;
    const isAfterTypeAnnotation = !!typeAnnotationMatch;
    const typeAnnotationPrefix = typeAnnotationMatch ? (typeAnnotationMatch[1] ?? typeAnnotationMatch[2] ?? '') : '';

    // Get current word prefix
    const match = linePrefix.match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
    const prefix = match ? match[1] : '';

    return {
        prefix,
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
        structMemberPrefix,
        isAfterWithAccess,
        withMemberPrefix,
        isAfterTypeAnnotation,
        typeAnnotationPrefix
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
function buildStructureIndex(document: TextDocument, documentCache: Map<string, TextDocument>): Map<string, Array<{name: string; type?: string; isPointer?: boolean}>> {
    const map = new Map<string, Array<{name: string; type?: string; isPointer?: boolean}>>();

    const pushMember = (structName: string, member: {name: string; type?: string; isPointer?: boolean}) => {
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
                // Collection members (Array/List/Map) inside a Structure have the form:
                //   Array images.i(10)
                //   List  items.s()
                //   Map   lookup.s()
                // Without a guard, /^(\*?)(\w+)/ would capture "Array"/"List"/"Map"
                // as the member name instead of the actual name after the keyword.
                if (/^(?:Array|List|Map)\s+/i.test(line)) {
                    const cm = line.match(/^(?:Array|List|Map)\s+(\*?)(\w+)(?:\.(\w+))?/i);
                    if (cm) pushMember(current, { name: cm[2], type: cm[3], isPointer: cm[1] === '*' });
                    continue;
                }
                const m = line.match(/^(\*?)(\w+)(?:\.(\w+))?/);
                if (m) {
                    pushMember(current, { name: m[2], type: m[3], isPointer: m[1] === '*' });
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
            try {
                const content = fs.readFileSync(file, 'utf8');
                addFromText(content);
            } catch (error) {
                console.error(`Failed to read include file(s)`);
                internalLog(`Failed to read include file ${file}:`, error);
            }
        }
    } catch (error) {
        console.error('Failed to parse include files:', error);
        internalLog('Failed to parse include files:', error);
    }

    return map;
}


/**
 * Extract symbol information from document
 */
function extractDocumentSymbols(document: TextDocument, documentCache: Map<string, TextDocument>) {
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

interface SymbolCollection {
    procedures: Array<{name: string, signature: string, insertText: string}>;
    constants: Array<{name: string, value?: string}>;
    structures: Array<{name: string}>;
    interfaces: Array<{name: string}>;
    enumerations: Array<{name: string}>;
}

/**
 * Analyze symbols in document
 */
function analyzeDocumentSymbols(document: TextDocument, symbols: SymbolCollection) {
    const text = document.getText();
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Look for procedure definition
        // ProcedureC / ProcedureDLL / ProcedureCDLL variants added.
        // Regex breakdown: ^Procedure(?:C|DLL|CDLL)?  → all calling conventions
        //                  (?:\.(\w+))?               → optional return type (.i, .s, …)
        //                  \s+(\w+)\s*\(([^)]*)\)     → name + parameter list
        // Examples:
        //   Procedure.i MyFunc(a.i)   → name=MyFunc, ret=i 
        //   ProcedureC MyExport()     → name=MyExport     
        //   ProcedureDLL MyDll(x.l)  → name=MyDll        
        //   ProcedureCDLL.s Fn(a)    → name=Fn, ret=s    
        const procMatch = line.match(/^Procedure(?:C|DLL|CDLL)?(?:\.(\w+))?\s+(\w+)\s*\(([^)]*)\)/i);
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
            const value = stripInlineComment(constMatch.value?.trim() ?? '').trim();
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
        // EnumerationBinary added.
        const enumMatch = line.match(/^Enumeration(?:Binary)?\s+(\w+)\b/i);
        if (enumMatch) {
            symbols.enumerations.push({ name: enumMatch[1] });
        }

        // Macro added
        // PureBasic macros are usable like procedures.
        // Parameterless macros are also valid: `Macro SimpleTag`
        const macroMatch = line.match(/^Macro\s+(\w+)/i);
        if (macroMatch) {
            const name = macroMatch[1];
            symbols.procedures.push({
                name,
                signature: name,
                insertText: `${name}(`
            });
        }

        // Prototype / PrototypeC added
        // Prototype defines a callable function-pointer type.
        const protoMatch = line.match(/^Prototype(?:C)?(?:\.(\w+))?\s+(\w+)\s*\(/i);
        if (protoMatch) {
            const name = protoMatch[2];
            symbols.procedures.push({
                name,
                signature: name,
                insertText: `${name}(`
            });
        }
    }
}

/**
 * Resolve the struct type at the end of a member-access chain.
 *
 * Handles both simple  (myVar\prefix)  and chained  (myVar\a\b\prefix)  access.
 *
 * Algorithm:
 *  1. Extract the full chain before the final partial member name.
 *     e.g.  "foo()\address\str"  → chain = ["foo()", "address"], prefix = "str"
 *  2. Look up the root name (chain[0]) in availableVariables to get its type.
 *  3. For each subsequent segment, look up the member in the struct index and
 *     advance the current type to that member's type.
 *  4. Return the type of the last fully-resolved segment, or null on any failure.
 */
function resolveStructAccessType(
    linePrefix: string,
    variables: VariableInfo[],
    structIndex: Map<string, Array<{name: string; type?: string}>>
): string | null {
    // Split at every backslash to get the access chain.
    // The last segment is the (possibly partial) member being typed → drop it.
    const backslashIdx = linePrefix.lastIndexOf('\\');
    if (backslashIdx === -1) return null;

    const chainPart = linePrefix.substring(0, backslashIdx);

    // Extract segments – split by \, take only the identifier part of each segment
    // (strip leading * and trailing call-parens, e.g. "GetPtr()").
    const rawSegments = chainPart.split('\\');
    if (rawSegments.length === 0) return null;

    // Normalize: strip pointer prefix and trailing () from each segment
    const normalize = (s: string) => s.replace(/^\*/, '').replace(/\([^)]*\)$/, '').trim();

    const rootName = normalize(rawSegments[0]);
    if (!rootName) return null;

    // Step 1 – root must be a known scope variable
    const rootVar = variables.find(v => v.name.toLowerCase() === rootName.toLowerCase());
    if (!rootVar) return null;

    let currentType = getBaseType(rootVar.type);
    if (!currentType) return null;

    // Step 2 – walk down each intermediate member
    for (let i = 1; i < rawSegments.length; i++) {
        const memberName = normalize(rawSegments[i]);
        if (!memberName) return null;

        const members = structIndex.get(currentType) || [];
        const member = members.find(m => m.name.toLowerCase() === memberName.toLowerCase());
        if (!member || !member.type) return null;

        currentType = member.type;
    }

    return currentType || null;
}

/**
 * Find the variable bound by the innermost active With block at the given line.
 *
 * Scans backwards from (currentLine - 1), counting EndWith/With pairs to find
 * the With that is still open at currentLine.
 *
 * Returns the raw variable name (may include leading *) or null if not in a With block.
 */
function findActiveWithVariable(lines: string[], currentLine: number): string | null {
    let depth = 0;
    for (let i = currentLine - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.startsWith(';') || line === '') continue;

        // EndWith closes a With → increase nesting depth
        if (/^EndWith\b/i.test(line)) {
            depth++;
            continue;
        }

        // With opens a block
        const withMatch = line.match(/^With\s+(\*?[A-Za-z_][A-Za-z0-9_]*(?:\([^)]*\))?)/i);
        if (withMatch) {
            if (depth > 0) {
                // This With is closed by a later EndWith we already counted
                depth--;
                continue;
            }
            // This With is the one active at currentLine
            return withMatch[1];
        }
    }
    return null;
}

/**
 * Resolve additional information for completion items
 */
export function handleCompletionResolve(item: CompletionItem): CompletionItem {
    // Can add more detailed documentation or insert text here
    return item;
}