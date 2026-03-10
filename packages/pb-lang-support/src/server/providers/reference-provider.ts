/**
 * Reference provider
 * Provides find references functionality for PureBasic
 */

import {
    ReferenceParams,
    Location,
    Position
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ProjectManager } from '../managers/project-manager';
import { readFileIfExistsSync, resolveIncludePath, fsPathToUri, normalizeDirPath } from '../utils/fs-utils';
import * as path from 'path';
import { getWorkspaceRootForUri  } from '../indexer/workspace-index';
import { parsePureBasicConstantDefinition} from '../utils/constants';
import { escapeRegExp, getWordAtPosition, normalizeConstantName, getModuleSymbolAtPosition } from '../utils/pb-lexer-utils';

/**
 * Handle references request
 */
export function handleReferences(
    params: ReferenceParams,
    document: TextDocument,
    allDocuments: Map<string, TextDocument>,
    projectManager?: ProjectManager
): Location[] {
    const text = document.getText();
    const position = params.position;

    // Get word at current position
    const lines = text.split('\n');
    if (position.line >= lines.length) return [];
    const word = getWordAtPosition(lines[position.line], position.character);
    if (!word) {
        return [];
    }

    // Collect searchable documents: current + opened + recursive includes
    const searchDocs = collectSearchDocuments(document, allDocuments, projectManager);

    // Find references
    const references: Location[] = [];

    // Handle module syntax: Module::#Const / Module::Type / Module::Function
    const moduleMatch = getModuleSymbolAtPosition(lines[position.line], position.character);
    if (moduleMatch) {
        if (moduleMatch.kind === 'function') {
            // Module::Func( – search for procedure references
            const moduleReferences = findModuleFunctionReferences(
                moduleMatch.moduleName,
                moduleMatch.symbolName,
                searchDocs,
                params.context.includeDeclaration
            );
            references.push(...moduleReferences);
        } else {
            // 'constant' (Module::#Const) or 'type' (Module::Struct/Enum/Interface)
            const modSymRefs = findModuleSymbolReferences(
                moduleMatch.moduleName,
                moduleMatch.symbolName,
                searchDocs,
                params.context.includeDeclaration
            );
            references.push(...modSymRefs);
        }
        return references;
    }

    // Regular reference finding: traverse all search documents
    for (const doc of searchDocs.values()) {
        const docReferences = findReferencesInDocument(doc, word, params.context.includeDeclaration);
        references.push(...docReferences);
    }

    return references;
}

/**
 * Find all references for module function
 */
function findModuleFunctionReferences(
    moduleName: string,
    functionName: string,
    searchDocs: Map<string, TextDocument>,
    includeDeclaration: boolean
): Location[] {
    const references: Location[] = [];
    const safeModule = escapeRegExp(moduleName);
    const safeFn = escapeRegExp(functionName);

    for (const doc of searchDocs.values()) {
        const text = doc.getText();
        const lines = text.split('\n');
        let inModule = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Find module call Module::Function
            const moduleCallRegex = new RegExp(`\\b${safeModule}::${safeFn}\\b`, 'gi');
            let match;
            while ((match = moduleCallRegex.exec(line)) !== null) {
                const before = line.substring(0, match.index);
                if (before.includes(';')) { continue; }
                const quoteCount = (before.match(/"/g) || []).length;
                if (quoteCount % 2 === 1) { continue; }
                references.push({
                    uri: doc.uri,
                    range: {
                        start: { line: i, character: match.index },
                        end: { line: i, character: match.index + match[0].length }
                    }
                });
            }

            // Track module scope for definition search
            if (line.match(new RegExp(`^\\s*Module\\s+${safeModule}\\b`, 'i'))) {
                inModule = true;
                continue;
            }
            if (line.match(/^\s*EndModule\b/i)) {
                inModule = false;
                continue;
            }

            // Find Procedure definition inside module
            if (includeDeclaration && inModule) {
                const procMatch = line.match(new RegExp(`^\\s*Procedure(?:C|DLL|CDLL)?(?:\\.\\w+)?\\s+(${safeFn})\\s*\\(`, 'i'));
                if (procMatch) {
                    const startChar = line.indexOf(procMatch[1]);
                    references.push({
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

    return references;
}

/**
 * Search for references in the document
 */
function findReferencesInDocument(
    document: TextDocument,
    word: string,
    includeDeclaration: boolean
): Location[] {
    const text = document.getText();
    const lines = text.split('\n');
    const references: Location[] = [];
    const isConstant = word.startsWith('#');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Skip comment lines
        if (trimmedLine.startsWith(';')) {
            continue;
        }

        if (isConstant) {
            // Constants: search all occurrences (definition + usage)
            const baseName = normalizeConstantName(word.replace(/^#/, ''));
            const refs = findConstantReference(line, i, baseName, document.uri);
            if (refs.length > 0) {
                const isDef = parsePureBasicConstantDefinition(trimmedLine) !== null;
                if (!isDef || includeDeclaration) {
                    references.push(...refs);
                }
            }
            continue;
        }

        // Non-constants: find definitions if requested
        if (includeDeclaration) {
            const defRef = findDefinitionReference(line, trimmedLine, i, word, document.uri);
            if (defRef) {
                references.push(defRef);
                continue; // Definition found, skip usage search for this line
            }
        }

        // Find usages (non-constants)
        references.push(...findUsageReference(line, i, word, document.uri));
    }

    return references;
}

/**
 * Find all constant references (#NAME or #NAME$) in a line.
 * Returns all occurrences, not just the first (analogous to findUsageReference).
 */
function findConstantReference(
    line: string,
    lineIndex: number,
    baseName: string,
    uri: string
): Location[] {
    const results: Location[] = [];
    const re = new RegExp('#' + escapeRegExp(baseName) + '(?:\\$)?\\b', 'gi');
    const commentStart = getCommentStart(line);

    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
        // Skip if inside or after a comment
        if (commentStart !== -1 && m.index >= commentStart) { break; }

        // Skip if inside a string literal
        const quoteCount = (line.substring(0, m.index).match(/"/g) || []).length;
        if (quoteCount % 2 === 1) { continue; }

        const startChar = m.index + 1; // skip leading #
        const matchLength = m[0].length - 1; // exclude #
        results.push({
            uri,
            range: {
                start: { line: lineIndex, character: startChar },
                end:   { line: lineIndex, character: startChar + matchLength }
            }
        });
    }
    return results;
}

/**
 * Find a symbol definition (Procedure, Structure, Interface, Enumeration, Variable) in a line.
 */
function findDefinitionReference(
    line: string,
    trimmedLine: string,
    lineIndex: number,
    word: string,
    uri: string
): Location | null {
    const safeWord = escapeRegExp(word);
    const patterns = [
        new RegExp(`^Procedure(?:C|DLL|CDLL)?(?:\\.\\w+)?\\s+(${safeWord})\\s*\\(`, 'i'),
        new RegExp(`^Macro\\s+(${safeWord})\\b`, 'i'),
        new RegExp(`^Prototype(?:C)?(?:\\.\\w+)?\\s+(${safeWord})\\s*\\(`, 'i'),
        new RegExp(`^Structure\\s+(${safeWord})\\b`, 'i'),
        new RegExp(`^Interface\\s+(${safeWord})\\b`, 'i'),
        new RegExp(`^Enumeration(?:Binary)?\\s+(${safeWord})\\b`, 'i'),
        new RegExp(`^(?:Global|Protected|Static|Define|Dim|Shared|Threaded)\\s+(?:\\w+\\s+)?\\*?(${safeWord})(?:\\.\\w+|\\[|\\s|$)`, 'i'),
    ];

    for (const pattern of patterns) {
        const match = trimmedLine.match(pattern);
        if (match) {
            const startChar = line.indexOf(match[1]);
            return {
                uri,
                range: {
                    start: { line: lineIndex, character: startChar },
                    end: { line: lineIndex, character: startChar + word.length }
                }
            };
        }
    }
    return null;
}

/**
 * Returns the index of the first ';' that is not inside a string literal,
 * or -1 if the line has no effective comment.
 */
function getCommentStart(line: string): number {
    let inString = false;
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') { inString = !inString; }
        if (!inString && line[i] === ';') { return i; }
    }
    return -1;
}


/**
 * Find a word usage in a line, skipping comments and strings.
 */
function findUsageReference(
    line: string,
    lineIndex: number,
    word: string,
    uri: string
): Location [] {
    const results: Location[] = [];
    const safeWord = escapeRegExp(word);
    const wordRegex = new RegExp(`\\b${safeWord}\\b`, 'gi');
    const commentStart = getCommentStart(line);

    let match: RegExpExecArray | null;
    while ((match = wordRegex.exec(line)) !== null) {
        // Skip if inside or after a comment
        if (commentStart !== -1 && match.index >= commentStart) { break; }

        // Skip if inside a string literal
        const quoteCount = (line.substring(0, match.index).match(/"/g) || []).length;
        if (quoteCount % 2 === 1) { continue; }

        results.push({
            uri,
            range: {
                start: { line: lineIndex, character: match.index },
                end: { line: lineIndex, character: match.index + word.length }
            }
        });
    }
    return results;
}

/**
 * Find constants/structures/interfaces/enumerations references in module
 */
function findModuleSymbolReferences(
    moduleName: string,
    ident: string,
    searchDocs: Map<string, TextDocument>,
    includeDeclaration: boolean
): Location[] {
    const refs: Location[] = [];
    const safeModule = escapeRegExp(moduleName);
    const safeIdent = escapeRegExp(ident);

    for (const doc of searchDocs.values()) {
        const text = doc.getText();
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Find usages: Module::ident or Module::#ident
            const re = new RegExp(`\\b${safeModule}::#?${safeIdent}\\b`, 'gi');
            let m: RegExpExecArray | null;
            while ((m = re.exec(line)) !== null) {
                // Skip comments
                const before = line.substring(0, m.index);
                if (before.includes(';')) { continue; }
                // Skip strings
                const quoteCount = (before.match(/"/g) || []).length;
                if (quoteCount % 2 === 1) { continue; }

                // startChar points to the ident, skipping 'Module::' and optional '#'
                const prefixLen = moduleName.length + 2; // 'Module::'
                const hasHash = line[m.index + prefixLen] === '#';
                const startChar = m.index + prefixLen + (hasHash ? 1 : 0);

                refs.push({
                    uri: doc.uri,
                    range: {
                        start: { line: i, character: startChar },
                        end: { line: i, character: m.index + m[0].length }
                    }
                });
            }

            if (!includeDeclaration) { continue; }

            // Find definitions (within DeclareModule / Module block)
            const trimmed = line.trim();

            // Constant definition
            const constMatch = parsePureBasicConstantDefinition(trimmed);
            if (constMatch && normalizeConstantName(constMatch.name) === normalizeConstantName(ident)) {
                const constIndex = line.indexOf('#' + constMatch.name);
                if (constIndex === -1) continue;
                const startChar = constIndex + 1
                refs.push({
                    uri: doc.uri,
                    range: {
                        start: { line: i, character: startChar },
                        end: { line: i, character: startChar + constMatch.name.length }
                    }
                });
                continue;
            }

            // Structure, Interface, Enumeration definitions
            const defMatchers = [
                new RegExp(`^Structure\\s+(${safeIdent})\\b`, 'i'),
                new RegExp(`^Interface\\s+(${safeIdent})\\b`, 'i'),
                new RegExp(`^Enumeration(?:Binary)?\\s+(${safeIdent})\\b`, 'i'),
            ];
            for (const r of defMatchers) {
                const mm = trimmed.match(r);
                if (mm) {
                    const startChar = line.indexOf(mm[1]);
                    refs.push({
                        uri: doc.uri,
                        range: {
                            start: { line: i, character: startChar },
                            end: { line: i, character: startChar + ident.length }
                        }
                    });
                    break;
                }
            }
        }
    }
    return refs;
}

/**
 * Collect search documents: current + open + recursive includes
 */
function collectSearchDocuments(
    document: TextDocument,
    allDocuments: Map<string, TextDocument>,
    projectManager?: ProjectManager,
    maxDepth = 3
): Map<string, TextDocument> {
    const workspaceRoot = getWorkspaceRootForUri(document.uri);
    const result = new Map<string, TextDocument>();
    const visited = new Set<string>();

    const addDoc = (doc: TextDocument) => {
        if (!result.has(doc.uri)) {
            result.set(doc.uri, doc);
        }
    };

    addDoc(document);

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

        const target = projectManager?.getActiveTarget(uri);
        const inputFileDir = target?.inputFile?.fsPath
            ? path.dirname(target.inputFile.fsPath)
            : undefined;
        // Maintain current IncludePath search directories (newest first)
        const includeDirs: string[] = [];

        for (const line of lines) {
            // IncludePath directive
            const ip = line.match(/^\s*IncludePath\s+\"([^\"]+)\"/i);
            if (ip) {
                const dir = normalizeDirPath(uri, ip[1]);
                if (!includeDirs.includes(dir)) includeDirs.unshift(dir);
                continue;
            }

            // IncludeFile / XIncludeFile directives
            const m = line.match(/^\s*(?:X?IncludeFile)\s+\"([^\"]+)\"/i);
            if (!m) continue;
            const inc = m[1];
            const fsPath = resolveIncludePath(uri, inc, includeDirs, workspaceRoot, inputFileDir);
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
    // Add project files (pbp-derived) if available
    try {
        if (typeof projectManager?.getProjectFilesForDocument === 'function') {
            const projectFiles = projectManager.getProjectFilesForDocument(rootDocUri);
            if (Array.isArray(projectFiles) && projectFiles.length > 0) {
                for (const fsPath of projectFiles) {
                    const incUri = fsPathToUri(fsPath);
                    if (result.has(incUri)) continue;
                    const content = readFileIfExistsSync(fsPath);
                    if (content != null) {
                        const tempDoc = TextDocument.create(incUri, 'purebasic', 0, content);
                        result.set(incUri, tempDoc);
                    }
                }
            }
        }
    } catch (error) {
        // Ignore errors during project file scanning
    }

    return result;
}