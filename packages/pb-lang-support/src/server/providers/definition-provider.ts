/**
 * Definition provider
 * Provides go-to-definition functionality for PureBasic
 */

import {
    DefinitionParams,
    Location,
    Position,
    Range
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ProjectManager } from '../managers/project-manager';
import { collectSearchDocuments } from '../utils/document-collector';
import { analyzeScopesAndVariables } from '../utils/scope-manager';
import { parsePureBasicConstantDefinition, parsePureBasicConstantDeclaration } from '../utils/constants';
import { escapeRegExp, getWordAtPosition, normalizeConstantName, getModuleSymbolAtPosition, getBaseType, getStructAccessFromLine, normalizeVarName } from '../utils/pb-lexer-utils';

/**
 * Handle definition requests
 */
export function handleDefinition(
    params: DefinitionParams,
    document: TextDocument,
    allDocuments: Map<string, TextDocument>,
    projectManager: ProjectManager
): Location[] {
    const text = document.getText();
    const position = params.position;

    // Get the word at the current position
    const lines = text.split('\n');
    if (position.line >= lines.length) return [];
    const word = getWordAtPosition(lines[position.line], position.character);
    if (!word) {
        return [];
    }

    // Collect searchable documents: current + opened + recursively included
    const searchDocs = collectSearchDocuments(document, allDocuments, projectManager);

    // Find definitions
    const definitions: Location[] = [];

    // Struct member access: var\\member → jump to structure member definition
    const structAccess = getStructAccessFromLine(lines[position.line], position.character);
    if (structAccess) {
        const scopeInfo = analyzeScopesAndVariables(text, position.line);
        const varInfo = scopeInfo.availableVariables.find(v => v.name.toLowerCase() === normalizeVarName(structAccess.varName).toLowerCase());
        if (varInfo) {
            const typeName = getBaseType(varInfo.type);
            if (typeName) {
                const structDefs = findStructureMemberDefinition(typeName, structAccess.memberName, searchDocs);
                definitions.push(...structDefs);
                if (definitions.length > 0) {
                    return definitions;
                }
            }
        }
    }

    // Handle module syntax: Module::#Const / Module::Type / Module::Function
    const moduleMatch = getModuleSymbolAtPosition(lines[position.line], position.character);
    if (moduleMatch) {
        if (moduleMatch.kind === 'function') {
            // Module::Func( – look for procedure definition only
            definitions.push(...findModuleFunctionDefinition(
                moduleMatch.moduleName,
                moduleMatch.symbolName,
                searchDocs
            ));
        } else {
            // 'constant' (Module::#Const) or 'type' (Module::Struct/Enum/Interface)
            definitions.push(...findModuleSymbolDefinition(
                moduleMatch.moduleName,
                moduleMatch.symbolName,
                searchDocs
            ));
        }
        return definitions;
    }

    // First search in project symbols
    if (projectManager) {
        const projectSymbol = projectManager.findSymbolDefinition(word, document.uri);
        if (projectSymbol) {
            definitions.push({
                uri: projectSymbol.uri,
                range: projectSymbol.symbol.range
            });
        }
    }

    // Regular search: traverse all search documents
    for (const doc of searchDocs.values()) {
        const docDefinitions = findDefinitionsInDocument(doc, word);
        definitions.push(...docDefinitions);
    }

    return definitions;
}

/**
 * Find function definition inside a module.
 *
 * Searches two block types for the named module:
 *   - DeclareModule ... EndDeclareModule  ->  Declare / DeclareC signature
 *   - Module ... EndModule                ->  Procedure / ProcedureC / ProcedureDLL / ProcedureCDLL
 */
function findModuleFunctionDefinition(
    moduleName: string,
    functionName: string,
    searchDocs: Map<string, TextDocument>
): Location[] {
    const definitions: Location[] = [];
    const safeModuleName = escapeRegExp(moduleName);
    const safeFunctionName = escapeRegExp(functionName);
    const declareRe = new RegExp(`^DeclareModule\\s+${safeModuleName}\\b`, 'i');
    const moduleRe  = new RegExp(`^Module\\s+${safeModuleName}\\b`, 'i');
    const procRe    = new RegExp(`^Procedure(?:C|DLL|CDLL)?(?:\\.\\w+)?\\s+(${safeFunctionName})\\s*\\(`, 'i');
    const declFnRe  = new RegExp(`^Declare(?:C)?(?:\\.\\w+)?\\s+(${safeFunctionName})\\s*\\(`, 'i');

    for (const doc of searchDocs.values()) {
        const text = doc.getText();
        const lines = text.split('\n');
        let inDeclare = false;
        let inModule  = false;

        for (let i = 0; i < lines.length; i++) {
            const raw  = lines[i];
            const line = raw.trim();

            // Block boundary detection
            if (declareRe.test(line))               { inDeclare = true;  continue; }
            if (line.match(/^EndDeclareModule\b/i)) { inDeclare = false; continue; }
            if (moduleRe.test(line))                { inModule  = true;  continue; }
            if (line.match(/^EndModule\b/i))        { inModule  = false; continue; }

            // Declare / DeclareC signature inside DeclareModule
            if (inDeclare) {
                const m = line.match(declFnRe);
                if (m) {
                    const indent = raw.length - raw.trimStart().length;
                    const startChar = indent + m[0].indexOf(m[1]);
                    definitions.push({
                        uri: doc.uri,
                        range: {
                            start: { line: i, character: startChar },
                            end:   { line: i, character: startChar + functionName.length }
                        }
                    });
                }
            }

            // Procedure* implementation inside Module
            if (inModule) {
                const m = line.match(procRe);
                if (m) {
                    const indent = raw.length - raw.trimStart().length;
                    const startChar = indent + m[0].indexOf(m[1]);
                    definitions.push({
                        uri: doc.uri,
                        range: {
                            start: { line: i, character: startChar },
                            end:   { line: i, character: startChar + functionName.length }
                        }
                    });
                }
            }
        }
    }

    return definitions;
}

/**
 * Find definitions in included files
 */
function findDefinitionsInIncludes(
    document: any,
    word: string,
    allDocuments: Map<string, any>
): Location[] {
    const definitions: Location[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    // Find IncludeFile / XIncludeFile statements
    for (const line of lines) {
        const includeMatch = line.match(/^\s*(?:X?IncludeFile)\s+"([^"]+)"/i);
        if (includeMatch) {
            const includePath = includeMatch[1];

            // Find corresponding included file in loaded documents
            for (const [uri, doc] of allDocuments) {
                if (uri.includes(includePath.replace(/\\/g, '/')) ||
                    uri.endsWith(includePath.split(/[\\\/]/).pop() || '')) {
                    const includeDefinitions = findDefinitionsInDocument(doc, word);
                    definitions.push(...includeDefinitions);
                }
            }
        }
    }

    return definitions;
}

/**
 * Search for definitions within a document
 */
function findDefinitionsInDocument(document: TextDocument, word: string): Location[] {
    const text = document.getText();
    const lines = text.split('\n');
    const definitions: Location[] = [];
    const safeWord = escapeRegExp(word);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Find procedure definition
        const procMatch = line.match(new RegExp(`^Procedure(?:C|DLL|CDLL)?(?:\\.\\w+)?\\s+(${safeWord})\\s*\\(`, 'i'));
        if (procMatch) {
            const indent = lines[i].length - lines[i].trimStart().length;
            const startChar = indent + procMatch[0].indexOf(procMatch[1]);
            definitions.push({
                uri: document.uri,
                range: {
                    start: { line: i, character: startChar },
                    end: { line: i, character: startChar + word.length }
                }
            });
        }

        // Find structure definition
        const structMatch = line.match(new RegExp(`^Structure\\s+(${safeWord})\\b`, 'i'));
        if (structMatch) {
            const indent = lines[i].length - lines[i].trimStart().length;
            const startChar = indent + structMatch[0].indexOf(structMatch[1]);
            definitions.push({
                uri: document.uri,
                range: {
                    start: { line: i, character: startChar },
                    end: { line: i, character: startChar + word.length }
                }
            });
        }

        // Find interface definition
        const interfaceMatch = line.match(new RegExp(`^Interface\\s+(${safeWord})\\b`, 'i'));
        if (interfaceMatch) {
            const indent = lines[i].length - lines[i].trimStart().length;
            const startChar = indent + interfaceMatch[0].indexOf(interfaceMatch[1]);
            definitions.push({
                uri: document.uri,
                range: {
                    start: { line: i, character: startChar },
                    end: { line: i, character: startChar + word.length }
                }
            });
        }

        // Find enumeration / EnumerationBinary definition
        const enumMatch = line.match(new RegExp(`^Enumeration(?:Binary)?\\s+(${safeWord})\\b`, 'i'));
        if (enumMatch) {
            const indent = lines[i].length - lines[i].trimStart().length;
            const startChar = indent + enumMatch[0].indexOf(enumMatch[1]);
            definitions.push({
                uri: document.uri,
                range: {
                    start: { line: i, character: startChar },
                    end: { line: i, character: startChar + word.length }
                }
            });
        }

        // Find Macro definition
        const macroMatch = line.match(new RegExp(`^Macro\\s+(${safeWord})\\b`, 'i'));
        if (macroMatch) {
            const indent = lines[i].length - lines[i].trimStart().length;
            const startChar = indent + macroMatch[0].indexOf(macroMatch[1]);
            definitions.push({
                uri: document.uri,
                range: {
                    start: { line: i, character: startChar },
                    end: { line: i, character: startChar + word.length }
                }
            });
        }

        // Find Prototype definition
        const protoMatch = line.match(new RegExp(`^Prototype(?:C)?(?:\\.\\w+)?\\s+(${safeWord})\\s*\\(`, 'i'));
        if (protoMatch) {
            const indent = lines[i].length - lines[i].trimStart().length;
            const startChar = indent + protoMatch[0].indexOf(protoMatch[1]);
            definitions.push({
                uri: document.uri,
                range: {
                    start: { line: i, character: startChar },
                    end: { line: i, character: startChar + word.length }
                }
            });
        }

        // Find module definition
        const moduleMatch = line.match(new RegExp(`^Module\\s+(${safeWord})\\b`, 'i'));
        if (moduleMatch) {
            const indent = lines[i].length - lines[i].trimStart().length;
            const startChar = indent + moduleMatch[0].indexOf(moduleMatch[1]);
            definitions.push({
                uri: document.uri,
                range: {
                    start: { line: i, character: startChar },
                    end: { line: i, character: startChar + word.length }
                }
            });
        }

        // Look up only constant definitions (#NAME = ... or #NAME$ = ...)
        const constMatch = parsePureBasicConstantDefinition(line);
        if (constMatch && normalizeConstantName(constMatch.name) === normalizeConstantName(word)) {
            const hashIndex = lines[i].indexOf('#');
            if (hashIndex === -1) continue;
            const startChar = hashIndex + 1;
            definitions.push({
                uri: document.uri,
                range: {
                    start: { line: i, character: startChar },
                    end: { line: i, character: startChar + constMatch.name.length }
                }
            });
        }

        // Find variable definitions (Global, Protected, Static, etc.)
        const scopePattern = /^(Global|Protected|Static|Define|Dim|Shared)\s+(?:(NewList|NewMap|NewArray)\s+)?/i;
        const scopeHeadMatch = lines[i].match(scopePattern);
        if (scopeHeadMatch) {
            const keywordEnd = scopeHeadMatch[0].length;
            const remaining = lines[i].substring(keywordEnd);
            // Alle deklarierten Namen in der Zeile finden
            const nameRe = new RegExp(`(?:^|,)\\s*\\*?(${safeWord})(?=\\.|\\[|\\s*,|\\s*$|\\s*\\()`, 'gi');
            let nm: RegExpExecArray | null;
            while ((nm = nameRe.exec(remaining)) !== null) {
                const posInRemaining = nm.index + nm[0].indexOf(nm[1]);
                const startChar = keywordEnd + posInRemaining;
                definitions.push({
                    uri: document.uri,
                    range: {
                        start: { line: i, character: startChar },
                        end: { line: i, character: startChar + word.length }
                    }
                });
            }
        }

        const newCollMatch = line.match(
            new RegExp(`^(NewList|NewMap|NewArray)\\s+(${safeWord})(?=\\.|\\[|\\s*\\(|\\s*$)`, 'i')
        );
        if (newCollMatch) {
            const indent = lines[i].length - lines[i].trimStart().length;
            const startChar = indent + newCollMatch[0].indexOf(newCollMatch[2]);
            definitions.push({
                uri: document.uri,
                range: {
                    start: { line: i, character: startChar },
                    end: { line: i, character: startChar + word.length }
                }
            });
        }
    }

    return definitions;
}

/**
 * Find non-function symbols (constant/structure/interface/enumeration) in a module
 */
function findModuleSymbolDefinition(
    moduleName: string,
    ident: string,
    searchDocs: Map<string, TextDocument>
): Location[] {
    const safeModuleName = escapeRegExp(moduleName);
    const safeIdent = escapeRegExp(ident);
    const defs: Location[] = [];
    for (const doc of searchDocs.values()) {
        const text = doc.getText();
        const lines = text.split('\n');
        let inDeclare = false;
        let inModule = false;
        for (let i = 0; i < lines.length; i++) {
            const raw = lines[i];
            const line = raw.trim();
            const dStart = line.match(new RegExp(`^DeclareModule\\s+${safeModuleName}\\b`, 'i'));
            if (dStart) { inDeclare = true; continue; }
            if (line.match(/^EndDeclareModule\b/i)) { inDeclare = false; continue; }
            const mStart = line.match(new RegExp(`^Module\\s+${safeModuleName}\\b`, 'i'));
            if (mStart) { inModule = true; continue; }
            if (line.match(/^EndModule\b/i)) { inModule = false; continue; }

            // Search for constant, structure, interface, and enumeration names in DeclareModule
            if (inDeclare) {
                const constMatch = parsePureBasicConstantDefinition(line) || parsePureBasicConstantDeclaration(line);
                if (constMatch && normalizeConstantName(constMatch.name) === normalizeConstantName(ident)) {
                    const constIndex = raw.indexOf('#' + constMatch.name);
                    if (constIndex === -1) continue;
                    const startChar = constIndex + 1;
                    defs.push({ uri: doc.uri, range: { start: { line: i, character: startChar }, end: { line: i, character: startChar + constMatch.name.length } } });
                }
                const structMatch = line.match(new RegExp(`^Structure\\s+(${safeIdent})\\b`, 'i'));
                if (structMatch) {
                    const indent = raw.length - raw.trimStart().length;
                    const startChar = indent + structMatch[0].indexOf(structMatch[1]);
                    defs.push({ uri: doc.uri, range: { start: { line: i, character: startChar }, end: { line: i, character: startChar + ident.length } } });
                }
                const ifaceMatch = line.match(new RegExp(`^Interface\\s+(${safeIdent})\\b`, 'i'));
                if (ifaceMatch) {
                    const indent = raw.length - raw.trimStart().length;
                    const startChar = indent + ifaceMatch[0].indexOf(ifaceMatch[1]);
                    defs.push({ uri: doc.uri, range: { start: { line: i, character: startChar }, end: { line: i, character: startChar + ident.length } } });
                }
                const enumMatch = line.match(new RegExp(`^Enumeration(?:Binary)?\\s+(${safeIdent})\\b`, 'i'));
                if (enumMatch) {
                    const indent = raw.length - raw.trimStart().length;
                    const startChar = indent + enumMatch[0].indexOf(enumMatch[1]);
                    defs.push({ uri: doc.uri, range: { start: { line: i, character: startChar }, end: { line: i, character: startChar + ident.length } } });
                }
            }

            // Constants/structures are also permitted in modules (less common, but for error tolerance)
            if (inModule) {
                const constMatch = parsePureBasicConstantDefinition(line) || parsePureBasicConstantDeclaration(line);
                if (constMatch && normalizeConstantName(constMatch.name) === normalizeConstantName(ident)) {
                    const constIndex = raw.indexOf('#' + constMatch.name);
                    if (constIndex === -1) continue;
                    const startChar = constIndex + 1;
                    defs.push({ uri: doc.uri, range: { start: { line: i, character: startChar }, end: { line: i, character: startChar + constMatch.name.length } } });
                }
                const structMatch = line.match(new RegExp(`^Structure\\s+(${safeIdent})\\b`, 'i'));
                if (structMatch) {
                    const indent = raw.length - raw.trimStart().length;
                    const startChar = indent + structMatch[0].indexOf(structMatch[1]);
                    defs.push({ uri: doc.uri, range: { start: { line: i, character: startChar }, end: { line: i, character: startChar + ident.length } } });
                }
            }
        }
    }
    return defs;
}

/**
 * Find definition position of member memberName inside Structure typeName
 */
function findStructureMemberDefinition(
    typeName: string,
    memberName: string,
    searchDocs: Map<string, TextDocument>
): Location[] {
    const matches: Location[] = [];
    const safeTypeName = escapeRegExp(typeName);
    const safeMemberName = escapeRegExp(memberName);
    for (const doc of searchDocs.values()) {
        const text = doc.getText();
        const lines = text.split('\n');
        let inStruct = false;
        for (let i = 0; i < lines.length; i++) {
            const raw = lines[i];
            const line = raw.trim();
            if (line.match(new RegExp(`^Structure\\s+${safeTypeName}\\b`, 'i'))) { inStruct = true; continue; }
            if (inStruct && line.match(/^EndStructure\b/i)) { inStruct = false; continue; }
            if (inStruct) {
                const mm = line.match(new RegExp(`^(?:\\*?)(${safeMemberName})\\b`));
                if (mm) {
                    const indent = raw.length - raw.trimStart().length;
                    // Returns the position of the capture group within the entire match string.
                    const startChar = indent + mm[0].indexOf(mm[1]);

                    // Skip matches within comments
                    if (raw.substring(0, startChar).includes(';')) {
                        continue;
                    }

                    // Skip matches within the string
                    const beforeMatch = raw.substring(0, startChar);
                    const quoteCount = (beforeMatch.match(/"/g) || []).length;
                    if (quoteCount % 2 === 1) {
                        continue;
                    }
                    matches.push({
                        uri: doc.uri,
                        range: {
                            start: { line: i, character: startChar },
                            end: { line: i, character: startChar + mm[1].length }
                        }
                    });
                }
            }
        }
    }
    return matches;
}