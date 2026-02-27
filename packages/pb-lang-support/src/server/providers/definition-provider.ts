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
import { readFileIfExistsSync, resolveIncludePath, fsPathToUri, normalizeDirPath } from '../utils/fs-utils';
import { getWorkspaceFiles } from '../indexer/workspace-index';
import { analyzeScopesAndVariables } from '../utils/scope-manager';
import { parsePureBasicConstantDefinition, parsePureBasicConstantDeclaration } from '../utils/constants';

/**
 * Handle definition requests
 */
export function handleDefinition(
    params: DefinitionParams,
    document: TextDocument,
    allDocuments: Map<string, TextDocument>,
    projectManager: any
): Location[] {
    const text = document.getText();
    const position = params.position;

    // Get the word at the current position
    const word = getWordAtPosition(text, position);
    if (!word) {
        return [];
    }

    // Collect searchable documents: current + opened + recursively included
    const searchDocs = collectSearchDocuments(document, allDocuments, projectManager);

    // Find definitions
    const definitions: Location[] = [];

    // Struct member access: var\\member → jump to structure member definition
    const structAccess = getStructAccessFromPosition(text, position);
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

    // First check module constants/structures etc: Module::#CONST / Module::Type
    const moduleSymbol = getModuleSymbolFromPosition(document.getText(), position);
    if (moduleSymbol) {
        const moduleSymbolDefs = findModuleSymbolDefinition(
            moduleSymbol.moduleName,
            moduleSymbol.ident,
            searchDocs
        );
        definitions.push(...moduleSymbolDefs);
        if (definitions.length > 0) return definitions;
    }

    // Handle module function call syntax
    const moduleMatch = getModuleFunctionFromPosition(document.getText(), position);
    if (moduleMatch) {
        // Look for function definition inside module
        const moduleDefinitions = findModuleFunctionDefinition(
            moduleMatch.moduleName,
            moduleMatch.functionName,
            searchDocs
        );
        definitions.push(...moduleDefinitions);
        // Look for module constants/structures definitions
        const moduleSymbolDefs = findModuleSymbolDefinition(
            moduleMatch.moduleName,
            moduleMatch.functionName,
            searchDocs
        );
        definitions.push(...moduleSymbolDefs);
    } else {
        // First search in project symbols
        if (projectManager) {
            const projectSymbol = projectManager.findSymbolDefinition(word, document.uri);
            if (projectSymbol) {
                // Convert project symbol to Location
                try {
                    const lines = projectSymbol.file.split('\n');
                    const definitionLine = lines[projectSymbol.line] || '';
                    const startPos = definitionLine.indexOf(word);
                    if (startPos !== -1) {
                        definitions.push({
                            uri: projectSymbol.file,
                            range: {
                                start: { line: projectSymbol.line, character: startPos },
                                end: { line: projectSymbol.line, character: startPos + word.length }
                            }
                        });
                    }
                } catch (error) {
                    // Ignore conversion errors
                }
            }
        }

        // Regular search: traverse all search documents
        for (const doc of searchDocs.values()) {
            const docDefinitions = findDefinitionsInDocument(doc, word);
            definitions.push(...docDefinitions);
        }
    }

    return definitions;
}

/**
 * Get module function call information at a position
 */
function getModuleFunctionFromPosition(text: string, position: Position): {
    moduleName: string;
    functionName: string;
} | null {
    const lines = text.split('\n');
    if (position.line >= lines.length) {
        return null;
    }

    const line = lines[position.line];
    const char = position.character;

    // Find module call syntax Module::Function
    const beforeCursor = line.substring(0, char);
    const afterCursor = line.substring(char);

    const fullContext = beforeCursor + afterCursor;
    const moduleMatch = fullContext.match(/(\w+)::(\w+)/);

    if (moduleMatch) {
        // Check if cursor is on this module call
        const matchStart = line.indexOf(moduleMatch[0]);
        const matchEnd = matchStart + moduleMatch[0].length;

        if (char >= matchStart && char <= matchEnd) {
            return {
                moduleName: moduleMatch[1],
                functionName: moduleMatch[2]
            };
        }
    }

    return null;
}

/**
 * Find function definition inside a module
 */
function findModuleFunctionDefinition(
    moduleName: string,
    functionName: string,
    searchDocs: Map<string, TextDocument>
): Location[] {
    const definitions: Location[] = [];

    for (const doc of searchDocs.values()) {
        const text = doc.getText();
        const lines = text.split('\n');
        let inModule = false;
        let moduleStartLine = -1;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Check module start
            const moduleMatch = line.match(new RegExp(`^Module\\s+${moduleName}\\b`, 'i'));
            if (moduleMatch) {
                inModule = true;
                moduleStartLine = i;
                continue;
            }

            // Check module end
            if (line.match(/^EndModule\b/i)) {
                inModule = false;
                continue;
            }

            // Find function definition inside module
            if (inModule) {
                const procMatch = line.match(new RegExp(`^Procedure(?:C|DLL|CDLL)?(?:\\.\\w+)?\\s+(${functionName})\\s*\\(`, 'i'));
                if (procMatch) {
                    const startChar = lines[i].indexOf(procMatch[1]);
                    definitions.push({
                        uri: doc.uri,
                        range: {
                            start: { line: i, character: startChar },
                            end: { line: i, character: startChar + functionName.length }
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

    // Find IncludeFile statements
    for (const line of lines) {
        const includeMatch = line.match(/IncludeFile\s+"([^"]+)"/i);
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
 * Get the word at a position (supports module syntax Module::Function)
 */
function getWordAtPosition(text: string, position: Position): string | null {
    const lines = text.split('\n');
    if (position.line >= lines.length) {
        return null;
    }

    const line = lines[position.line];
    const char = position.character;

    // Find word boundaries (support :: syntax)
    let start = char;
    let end = char;

    // Search forward for word start
    while (start > 0 && /[a-zA-Z0-9_:]/.test(line[start - 1])) {
        start--;
    }

    // Search backward for word end
    while (end < line.length && /[a-zA-Z0-9_:]/.test(line[end])) {
        end++;
    }

    if (start === end) {
        return null;
    }

    const fullWord = line.substring(start, end);

    // Handle module call syntax Module::Function
    if (fullWord.includes('::')) {
        const parts = fullWord.split('::');
        if (parts.length === 2) {
            // Check if cursor is on module name or function name
            const moduleEnd = start + parts[0].length;
            if (char <= moduleEnd) {
                return parts[0]; // Return module name
            } else {
                return parts[1]; // Return function name
            }
        }
    }

    return fullWord;
}

/**
 * Search for definitions within a document
 */
function findDefinitionsInDocument(document: TextDocument, word: string): Location[] {
    const text = document.getText();
    const lines = text.split('\n');
    const definitions: Location[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Find procedure definition
        const procMatch = line.match(new RegExp(`^Procedure(?:C|DLL|CDLL)?(?:\\.\\w+)?\\s+(${word})\\s*\\(`, 'i'));
        if (procMatch) {
            const startChar = lines[i].indexOf(procMatch[1]);
            definitions.push({
                uri: document.uri,
                range: {
                    start: { line: i, character: startChar },
                    end: { line: i, character: startChar + word.length }
                }
            });
        }

        // Find structure definition
        const structMatch = line.match(new RegExp(`^Structure\\s+(${word})\\b`, 'i'));
        if (structMatch) {
            const startChar = lines[i].indexOf(structMatch[1]);
            definitions.push({
                uri: document.uri,
                range: {
                    start: { line: i, character: startChar },
                    end: { line: i, character: startChar + word.length }
                }
            });
        }

        // Find interface definition
        const interfaceMatch = line.match(new RegExp(`^Interface\\s+(${word})\\b`, 'i'));
        if (interfaceMatch) {
            const startChar = lines[i].indexOf(interfaceMatch[1]);
            definitions.push({
                uri: document.uri,
                range: {
                    start: { line: i, character: startChar },
                    end: { line: i, character: startChar + word.length }
                }
            });
        }

        // Find enumeration definition
        const enumMatch = line.match(new RegExp(`^Enumeration\\s+(${word})\\b`, 'i'));
        if (enumMatch) {
            const startChar = lines[i].indexOf(enumMatch[1]);
            definitions.push({
                uri: document.uri,
                range: {
                    start: { line: i, character: startChar },
                    end: { line: i, character: startChar + word.length }
                }
            });
        }

        // Find module definition
        const moduleMatch = line.match(new RegExp(`^Module\\s+(${word})\\b`, 'i'));
        if (moduleMatch) {
            const startChar = lines[i].indexOf(moduleMatch[1]);
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
            const startChar = lines[i].indexOf('#') + 1;
            definitions.push({
                uri: document.uri,
                range: {
                    start: { line: i, character: startChar },
                    end: { line: i, character: startChar + constMatch.name.length }
                }
            });
        }

        // Find variable definitions (Global, Protected, Static, etc.)
        const varMatch = line.match(new RegExp(`^(Global|Protected|Static|Define|Dim)\\s+([^\\s,]+\\s+)?\\*?(${word})(?:\\.\\w+|\\[|\\s|$)`, 'i'));
        if (varMatch) {
            const fullLine = lines[i];
            const varName = varMatch[3];
            const startChar = fullLine.indexOf(varName, fullLine.indexOf(varMatch[1]));
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
 * Get module symbol (function or constant/structure) call location: supports Module::Name and Module::#CONST
 */
function getModuleSymbolFromPosition(text: string, position: Position): { moduleName: string; ident: string } | null {
    const lines = text.split('\n');
    if (position.line >= lines.length) return null;
    const line = lines[position.line];
    const char = position.character;
    const beforeCursor = line.substring(0, char);
    const afterCursor = line.substring(char);
    const full = beforeCursor + afterCursor;
    // Prefer matching constant form
    let m = full.match(/(\w+)::#(\w+)/);
    if (m) {
        const start = line.indexOf(m[0]);
        const end = start + m[0].length;
        if (char >= start && char <= end) return { moduleName: m[1], ident: m[2] };
    }
    m = full.match(/(\w+)::(\w+)/);
    if (m) {
        const start = line.indexOf(m[0]);
        const end = start + m[0].length;
        if (char >= start && char <= end) return { moduleName: m[1], ident: m[2] };
    }
    return null;
}

/**
 * Find non-function symbols (constant/structure/interface/enumeration) in a module
 */
function findModuleSymbolDefinition(
    moduleName: string,
    ident: string,
    searchDocs: Map<string, TextDocument>
): Location[] {
    const defs: Location[] = [];
    for (const doc of searchDocs.values()) {
        const text = doc.getText();
        const lines = text.split('\n');
        let inDeclare = false;
        let inModule = false;
        for (let i = 0; i < lines.length; i++) {
            const raw = lines[i];
            const line = raw.trim();
            const dStart = line.match(new RegExp(`^DeclareModule\\s+${moduleName}\\b`, 'i'));
            if (dStart) { inDeclare = true; continue; }
            if (line.match(/^EndDeclareModule\b/i)) { inDeclare = false; continue; }
            const mStart = line.match(new RegExp(`^Module\\s+${moduleName}\\b`, 'i'));
            if (mStart) { inModule = true; continue; }
            if (line.match(/^EndModule\b/i)) { inModule = false; continue; }

            // Search for constant, structure, interface, and enumeration names in DeclareModule
            if (inDeclare) {
                const constMatch = parsePureBasicConstantDefinition(line) || parsePureBasicConstantDeclaration(line);
                if (constMatch && normalizeConstantName(constMatch.name) === normalizeConstantName(ident)) {
                    const startChar = raw.indexOf('#' + constMatch.name) + 1;
                    defs.push({ uri: doc.uri, range: { start: { line: i, character: startChar }, end: { line: i, character: startChar + constMatch.name.length } } });
                }
                const structMatch = line.match(new RegExp(`^Structure\\s+(${ident})\\b`, 'i'));
                if (structMatch) {
                    const startChar = raw.indexOf(structMatch[1]);
                    defs.push({ uri: doc.uri, range: { start: { line: i, character: startChar }, end: { line: i, character: startChar + ident.length } } });
                }
                const ifaceMatch = line.match(new RegExp(`^Interface\\s+(${ident})\\b`, 'i'));
                if (ifaceMatch) {
                    const startChar = raw.indexOf(ifaceMatch[1]);
                    defs.push({ uri: doc.uri, range: { start: { line: i, character: startChar }, end: { line: i, character: startChar + ident.length } } });
                }
                const enumMatch = line.match(new RegExp(`^Enumeration\\s+(${ident})\\b`, 'i'));
                if (enumMatch) {
                    const startChar = raw.indexOf(enumMatch[1]);
                    defs.push({ uri: doc.uri, range: { start: { line: i, character: startChar }, end: { line: i, character: startChar + ident.length } } });
                }
            }

            // Constants/structures are also permitted in modules (less common, but for error tolerance)
            if (inModule) {
                const constMatch = parsePureBasicConstantDefinition(line) || parsePureBasicConstantDeclaration(line);
                if (constMatch && normalizeConstantName(constMatch.name) === normalizeConstantName(ident)) {
                    const startChar = raw.indexOf('#' + constMatch.name) + 1;
                    defs.push({ uri: doc.uri, range: { start: { line: i, character: startChar }, end: { line: i, character: startChar + constMatch.name.length } } });
                }
                const structMatch = line.match(new RegExp(`^Structure\\s+(${ident})\\b`, 'i'));
                if (structMatch) {
                    const startChar = raw.indexOf(structMatch[1]);
                    defs.push({ uri: doc.uri, range: { start: { line: i, character: startChar }, end: { line: i, character: startChar + ident.length } } });
                }
            }
        }
    }
    return defs;
}

function normalizeConstantName(name: string): string {
    return name.replace(/\$$/, '').toLowerCase();
}

/**
 * Struct member access match: var\\member (cursor on that segment)
 */
function getStructAccessFromPosition(text: string, position: Position): { varName: string; memberName: string } | null {
    const lines = text.split('\n');
    if (position.line >= lines.length) return null;
    const line = lines[position.line];
    const char = position.character;

    const re = /([A-Za-z_][A-Za-z0-9_]*|\*[A-Za-z_][A-Za-z0-9_]*)(?:\([^)]*\))?\\(\w+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
        const start = m.index;
        const end = start + m[0].length;
        if (char >= start && char <= end) {
            return { varName: m[1], memberName: m[2] };
        }
    }
    return null;
}

function normalizeVarName(n: string): string {
    return n.replace(/^\*/, '').replace(/\([^)]*\)$/, '');
}

function getBaseType(typeStr: string): string {
    if (!typeStr) return '';
    const cleaned = typeStr.split(' ')[0];
    const noPtr = cleaned.startsWith('*') ? cleaned.substring(1) : cleaned;
    const arrIdx = noPtr.indexOf('[');
    return arrIdx > -1 ? noPtr.substring(0, arrIdx) : noPtr;
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
    for (const doc of searchDocs.values()) {
        const text = doc.getText();
        const lines = text.split('\n');
        let inStruct = false;
        for (let i = 0; i < lines.length; i++) {
            const raw = lines[i];
            const line = raw.trim();
            if (line.match(new RegExp(`^Structure\\s+${typeName}\\b`, 'i'))) { inStruct = true; continue; }
            if (inStruct && line.match(/^EndStructure\b/i)) { inStruct = false; continue; }
            if (inStruct) {
                const mm = line.match(new RegExp(`^(?:\\*?)(${memberName})\\b`));
                if (mm) {
                    const startChar = raw.indexOf(mm[1]);
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

/**
 * Collect search documents: current + open + recursively included
 */
function collectSearchDocuments(
    document: TextDocument,
    allDocuments: Map<string, TextDocument>,
    projectManager?: any,
    maxDepth = 3
): Map<string, TextDocument> {
    const result = new Map<string, TextDocument>();
    const visited = new Set<string>();

    const addDoc = (doc: TextDocument) => {
        if (!result.has(doc.uri)) {
            result.set(doc.uri, doc);
        }
    };

    addDoc(document);
    for (const [, doc] of allDocuments) addDoc(doc);

    const rootDocUri = document.uri;
    const queue: Array<{ uri: string; depth: number }> = [{ uri: rootDocUri, depth: 0 }];

    while (queue.length) {
        const { uri, depth } = queue.shift()!;
        if (visited.has(uri) || depth > maxDepth) continue;
        visited.add(uri);

        const baseDoc = result.get(uri);
        if (!baseDoc) continue;
        const text = baseDoc.getText();
        const lines = text.split('\n');

        // Maintain current IncludePath search directories (newest first)
        // Seed with project include directories from pb-project-files if available.
        const includeDirs: string[] = typeof projectManager?.getIncludeDirsForDocument === 'function'
            ? (projectManager.getIncludeDirsForDocument(uri) ?? []).slice()
            : [];

        for (const line of lines) {
            // IncludePath directive
            const ip = line.match(/^\s*IncludePath\s+\"([^\"]+)\"/i);
            if (ip) {
                const dir = normalizeDirPath(uri, ip[1]);
                // Newest first
                if (!includeDirs.includes(dir)) includeDirs.unshift(dir);
                continue;
            }

            // IncludeFile / XIncludeFile directives
            const m = line.match(/^\s*(?:X?IncludeFile)\s+\"([^\"]+)\"/i);
            if (!m) continue;
            const inc = m[1];
            const fsPath = resolveIncludePath(uri, inc, includeDirs);
            if (!fsPath) continue;
            const incUri = fsPathToUri(fsPath);
            if (result.has(incUri)) {
                if (!visited.has(incUri)) queue.push({ uri: incUri, depth: depth + 1 });
                continue;
            }
            const opened = allDocuments.get(incUri);
            if (opened) {
                addDoc(opened);
                queue.push({ uri: incUri, depth: depth + 1 });
                continue;
            }
            const content = readFileIfExistsSync(fsPath);
            if (content != null) {
                const tempDoc = TextDocument.create(incUri, 'purebasic', 0, content);
                addDoc(tempDoc);
                queue.push({ uri: incUri, depth: depth + 1 });
            }
        }
    }
    // Add workspace files (with limit) to avoid missing unopened files
    try {
        // Prefer project file list (pbp-derived) over a full workspace scan
        let files: string[] | undefined;
        if (typeof projectManager?.getProjectFilesForDocument === 'function') {
            const projectFiles = projectManager.getProjectFilesForDocument(rootDocUri);
            files = Array.isArray(projectFiles) && projectFiles.length > 0 ? projectFiles : undefined;
        }

        const filesToScan = files ?? getWorkspaceFiles();
        for (const fsPath of filesToScan) {
            const incUri = fsPathToUri(fsPath);
            if (result.has(incUri)) continue;
            const content = readFileIfExistsSync(fsPath);
            if (content != null) {
                const tempDoc = TextDocument.create(incUri, 'purebasic', 0, content);
                result.set(incUri, tempDoc);
            }
        }
    } catch (error) {
        // Ignore errors during workspace scanning
    }

    return result;
}
