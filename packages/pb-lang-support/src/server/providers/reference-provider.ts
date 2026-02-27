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
import { readFileIfExistsSync, resolveIncludePath, fsPathToUri, normalizeDirPath } from '../utils/fs-utils';
import { getWorkspaceFiles } from '../indexer/workspace-index';
import { parsePureBasicConstantDefinition} from '../utils/constants';

/**
 * Handle references request
 */
export function handleReferences(
    params: ReferenceParams,
    document: TextDocument,
    allDocuments: Map<string, TextDocument>
): Location[] {
    const text = document.getText();
    const position = params.position;

    // Get word at current position
    const word = getWordAtPosition(text, position);
    if (!word) {
        return [];
    }

    // Collect searchable documents: current + opened + recursive includes
    const searchDocs = collectSearchDocuments(document, allDocuments);

    // Find references
    const references: Location[] = [];

    // Handle module call syntax (functions)
    const moduleMatch = getModuleFunctionFromPosition(text, position);
    if (moduleMatch) {
        // Find all references for module function
        const moduleReferences = findModuleFunctionReferences(
            moduleMatch.moduleName,
            moduleMatch.functionName,
            searchDocs,
            params.context.includeDeclaration
        );
        references.push(...moduleReferences);
    } else {
        // Handle module symbols (constants/structures/interfaces/enumerations): Module::Name or Module::#CONST
        const modSym = getModuleSymbolFromPosition(text, position);
        if (modSym) {
            const modSymRefs = findModuleSymbolReferences(
                modSym.moduleName,
                modSym.ident,
                searchDocs,
                params.context.includeDeclaration
            );
            references.push(...modSymRefs);
            return references;
        }
        // Regular reference finding: traverse all search documents
        for (const doc of searchDocs.values()) {
            const docReferences = findReferencesInDocument(doc, word, params.context.includeDeclaration);
            references.push(...docReferences);
        }
    }

    return references;
}

/**
 * Get word at position (support module syntax Module::Function)
 */
function getWordAtPosition(text: string, position: Position): string | null {
    const lines = text.split('\n');
    if (position.line >= lines.length) {
        return null;
    }

    const line = lines[position.line];
    const char = position.character;

    // Find word boundary (support :: syntax)
    let start = char;
    let end = char;

    // Search forward to find word start
    while (start > 0 && /[a-zA-Z0-9_:]/.test(line[start - 1])) {
        start--;
    }

    // Search backward to find word end
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
 * Get module function call information
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
            }
            if (line.match(/^\s*EndModule\b/i)) {
                inModule = false;
            }

            // Find Procedure definition inside module
            if (includeDeclaration && inModule) {
                const procMatch = line.match(new RegExp(`^\\s*Procedure(?:\\.\\w+)?\\s+(${safeFn})\\s*\\(`, 'i'));
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
            const ref = findConstantReference(line, i, baseName, document.uri);
            if (ref) {
                const isDef = parsePureBasicConstantDefinition(trimmedLine) !== null;
                if (!isDef || includeDeclaration) {
                    references.push(ref);
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
 * Find a constant reference (#NAME or #NAME$) in a line.
 */
function findConstantReference(
    line: string,
    lineIndex: number,
    baseName: string,
    uri: string
): Location | null {
    const searchName = '#' + baseName;
    const lowerLine = line.toLowerCase();
    const idx = lowerLine.indexOf(searchName);
    if (idx === -1) { return null; }

    // Skip if match is inside an inline comment
    if (line.substring(0, idx).includes(';')) { return null; }

    // Skip if match is inside a string literal
    const quoteCount = (line.substring(0, idx).match(/"/g) || []).length;
    if (quoteCount % 2 === 1) { return null; }

    const afterIdx = idx + searchName.length;
    const hasDollar = lowerLine[afterIdx] === '$';
    const nextChar = lowerLine[afterIdx + (hasDollar ? 1 : 0)];
    if (nextChar && /[a-z0-9_$]/.test(nextChar)) { return null; } // not a word boundary

    const startChar = idx + 1; // skip #
    const matchLength = baseName.length + (hasDollar ? 1 : 0);
    return {
        uri,
        range: {
            start: { line: lineIndex, character: startChar },
            end: { line: lineIndex, character: startChar + matchLength }
        }
    };
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
        new RegExp(`^Procedure(?:\\.\\w+)?\\s+(${safeWord})\\s*\\(`, 'i'),
        new RegExp(`^Structure\\s+(${safeWord})\\b`, 'i'),
        new RegExp(`^Interface\\s+(${safeWord})\\b`, 'i'),
        new RegExp(`^Enumeration\\s+(${safeWord})\\b`, 'i'),
        new RegExp(`^(?:Global|Protected|Static|Define|Dim)\\s+(?:\\w+\\s+)?\\*?(${safeWord})(?:\\.\\w+|\\[|\\s|$)`, 'i'),
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
 * Get module symbol (other than functions, such as constants/structures/interfaces/enumerations) call position
 */
function getModuleSymbolFromPosition(text: string, position: Position): { moduleName: string; ident: string } | null {
    const lines = text.split('\n');
    if (position.line >= lines.length) return null;
    const line = lines[position.line];
    const char = position.character;
    const before = line.substring(0, char);
    const after = line.substring(char);
    const full = before + after;
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
            const raw = lines[i];

            // Find usages: Module::ident or Module::#ident
            const re = new RegExp(`\\b${safeModule}::#?${safeIdent}\\b`, 'gi');
            let m: RegExpExecArray | null;
            while ((m = re.exec(raw)) !== null) {
                // Skip comments
                const before = raw.substring(0, m.index);
                if (before.includes(';')) { continue; }
                // Skip strings
                const quoteCount = (before.match(/"/g) || []).length;
                if (quoteCount % 2 === 1) { continue; }

                // startChar points to the ident, skipping 'Module::' and optional '#'
                const prefixLen = moduleName.length + 2; // 'Module::'
                const hasHash = raw[m.index + prefixLen] === '#';
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
            const trimmed = raw.trim();

            // Constant definition
            const constMatch = parsePureBasicConstantDefinition(trimmed);
            if (constMatch && normalizeConstantName(constMatch.name) === normalizeConstantName(ident)) {
                const startChar = raw.indexOf('#' + constMatch.name) + 1;
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
                new RegExp(`^Enumeration\\s+(${safeIdent})\\b`, 'i'),
            ];
            for (const r of defMatchers) {
                const mm = trimmed.match(r);
                if (mm) {
                    const startChar = raw.indexOf(mm[1]);
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

function normalizeConstantName(name: string): string {
    return name.replace(/\$$/, '').toLowerCase();
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Collect search documents: current + open + recursive includes
 */
function collectSearchDocuments(
    document: TextDocument,
    allDocuments: Map<string, TextDocument>,
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

    const queue: Array<{ uri: string; depth: number }> = [{ uri: document.uri, depth: 0 }];

    while (queue.length) {
        const { uri, depth } = queue.shift()!;
        if (visited.has(uri) || depth > maxDepth) continue;
        visited.add(uri);

        const baseDoc = result.get(uri);
        if (!baseDoc) continue;
        const text = baseDoc.getText();
        const lines = text.split('\n');

        // Maintain current IncludePath search directory (latest first)
        const includeDirs: string[] = [];

        for (const line of lines) {
            // IncludePath directive
            const ip = line.match(/^\s*IncludePath\s+\"([^\"]+)\"/i);
            if (ip) {
                const dir = normalizeDirPath(uri, ip[1]);
                if (!includeDirs.includes(dir)) includeDirs.unshift(dir);
                continue;
            }

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
    // Include workspace files (limited), for more complete reference searching
    try {
        const files = getWorkspaceFiles();
        for (const fsPath of files) {
            const incUri = fsPathToUri(fsPath);
            if (result.has(incUri)) continue;
            const content = readFileIfExistsSync(fsPath);
            if (content != null) {
                const tempDoc = TextDocument.create(incUri, 'purebasic', 0, content);
                result.set(incUri, tempDoc);
            }
        }
    } catch {}

    return result;
}
