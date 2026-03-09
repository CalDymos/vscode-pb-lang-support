/**
 * Rename provider
 * Provides symbol renaming functionality for PureBasic
 */

import {
    RenameParams,
    WorkspaceEdit,
    TextEdit,
    PrepareRenameParams,
    Range,
    Position
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { analyzeScopesAndVariables } from '../utils/scope-manager';
import { parsePureBasicConstantDefinition, parsePureBasicConstantDeclaration, keywords, types } from '../utils/constants';
import { escapeRegExp } from '../utils/string-utils';
import { readFileIfExistsSync, resolveIncludePath, fsPathToUri, normalizeDirPath } from '../utils/fs-utils';
import { getWorkspaceFiles, getWorkspaceRootForUri } from '../indexer/workspace-index';

/**
 * Normalizes a constant name.
 *
 * Removes an optional trailing `$` character
 * and converts the entire string to lowercase.
 *
 * @param name - The constant name to normalize.
 * @returns The cleaned and lowercased name.
 *
 * @example
 * normalizeConstantName("VALUE$") // "value"
 * normalizeConstantName("TEST")   // "test"
 */
function normalizeConstantName(name: string): string {
    return name.replace(/\$$/, '').toLowerCase();
}

/**
 * Preparing to rename - Checking if renaming is possible
 */
export function handlePrepareRename(
    params: PrepareRenameParams,
    document: TextDocument,
    documentCache: Map<string, TextDocument>
): Range | { range: Range; placeholder: string } | null {
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

    // Build the full search scope once – used for symbol existence check
    const searchDocs = collectSearchDocuments(document, documentCache);

    // Check if it is a renameable symbol
    if (isRenameableSymbol(word, searchDocs, position)) {
        const range = getWordRange(line, position.line, position.character);
        return {
            range,
            placeholder: word
        };
    }

    // Structure member: Renaming the member name of var\\member
    const structLoc = getStructAccessFromLine(line, position.character);
    if (structLoc) {
        const structName = getVariableStructureAt(document, position.line, structLoc.varName);
        if (structName) {
            const range = getMemberRange(line, position.character, structLoc.memberName, position.line);
            if (range) {
                return { range, placeholder: structLoc.memberName };
            }
        }
    }

    return null;
}

/**
 * Execute rename
 */
export function handleRename(
    params: RenameParams,
    document: TextDocument,
    documentCache: Map<string, TextDocument>
): WorkspaceEdit | null {
    const position = params.position;
    const newName = params.newName;
    const text = document.getText();
    const lines = text.split('\n');

    if (position.line >= lines.length) {
        return null;
    }

    const line = lines[position.line];
    const oldName = getWordAtPosition(line, position.character);

    if (!oldName || !isValidIdentifier(newName)) {
        return null;
    }

    // Build the full search scope once – all helpers below receive it directly
    const searchDocs = collectSearchDocuments(document, documentCache);

    // Check whether this is a module call
    const moduleMatch = getModuleCallFromPosition(line, position.character);
    if (moduleMatch) {
        return handleModuleFunctionRename(
            moduleMatch.moduleName,
            moduleMatch.functionName,
            newName,
            searchDocs
        );
    }

    // Structure member rename
    const structLoc2 = getStructAccessFromLine(line, position.character);
    if (structLoc2) {
        const structName = getVariableStructureAt(document, position.line, structLoc2.varName);
        if (structName) {
            return handleStructMemberRename(structName, structLoc2.memberName, newName, searchDocs);
        }
    }

    // Module symbol (non-function) rename: Module::Name / Module::#CONST
    const modSym = getModuleSymbolFromLine(line, position.character);
    if (modSym) {
        return handleModuleSymbolRename(
            modSym.moduleName,
            modSym.ident,
            newName,
            searchDocs
        );
    }

    // Regular symbol rename
    const edits = findAllOccurrences(oldName, searchDocs);

    if (edits.length === 0) {
        return null;
    }

    // Group edits by document URI
    const changes: { [uri: string]: TextEdit[] } = {};
    for (const edit of edits) {
        if (!changes[edit.uri]) {
            changes[edit.uri] = [];
        }
        changes[edit.uri].push({
            range: edit.range,
            newText: newName
        });
    }

    return { changes };
}

/**
 * Get the word at the specified position
 */
function getWordAtPosition(line: string, character: number): string | null {
    let start = character;
    let end = character;

    // Search backward to find word start
    while (start > 0 && /[a-zA-Z0-9_:]/.test(line[start - 1])) {
        start--;
    }

    // Include leading '#' if present (PureBasic constant prefix)
    if (start > 0 && line[start - 1] === '#') {
        start--;
    }

    // Search forward to find word end
    while (end < line.length && /[a-zA-Z0-9_]/.test(line[end])) {
        end++;
    }

    if (start === end) {
        return null;
    }

    return line.substring(start, end);
}

/**
 * Determines the word range at a given character position within a line.
 *
 * @param line - The full text content of the line.
 * @param lineNum - The zero-based line number.
 * @param character - The zero-based character index within the line.
 * @returns A {@link Range} object representing the start and end
 *          positions of the detected word.
 *
 * @example
 * // line = "const myVariable = 1;"
 * // character at index inside "myVariable"
 * getWordRange(line, 0, 8)
 * // returns range covering "myVariable"
 */
function getWordRange(line: string, lineNum: number, character: number): Range {
    let start = character;
    let end = character;

    while (start > 0 && /[a-zA-Z0-9_]/.test(line[start - 1])) {
        start--;
    }

    while (end < line.length && /[a-zA-Z0-9_]/.test(line[end])) {
        end++;
    }

    return {
        start: { line: lineNum, character: start },
        end: { line: lineNum, character: end }
    };
}

/**
 * Check whether it is a valid identifier
 */
function isValidIdentifier(name: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*\$?$/.test(name);
}

/**
 * Check whether it is a renameable symbol
 */
function isRenameableSymbol(
    word: string,
    searchDocs: Map<string, TextDocument>,
    position: Position
): boolean {
    // Do not allow renaming of PureBasic keywords.
    // Info: PureBasic types are expressed as dot-suffixes (.i/.s/.f/.d).

    if (keywords.some(kw => kw.toLowerCase() === word.toLowerCase())) {
        return false;
    }
    if (types.some(kw => kw.toLowerCase() == word.toLocaleLowerCase())) {
        return false;
    }

    // Check whether it is a user-defined symbol
    return isUserDefinedSymbol(word, searchDocs);
}

/**
 * Check whether a word resolves to a user-defined symbol
 */
function isUserDefinedSymbol(
    word: string,
    searchDocs: Map<string, TextDocument>
): boolean {
    const safeWord = escapeRegExp(word);

    for (const doc of searchDocs.values()) {
        const text = doc.getText();
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Procedure definition (all calling conventions)
            if (line.match(new RegExp(`^Procedure(?:C|DLL|CDLL)?(?:\\.\\w+)?\\s+(${safeWord})\\s*\\(`, 'i'))) return true;

            // Macro definition
            if (line.match(new RegExp(`^Macro\\s+(${safeWord})\\b`, 'i'))) return true;

            // Prototype / PrototypeC
            if (line.match(new RegExp(`^Prototype(?:C)?(?:\\.\\w+)?\\s+(${safeWord})\\s*\\(`, 'i'))) return true;

            // Variable declarations (all scope keywords)
            if (line.match(new RegExp(`^(?:Global|Protected|Static|Define|Dim|Shared|Threaded)\\s+(?:\\w+\\s+)?(\\*?${safeWord})(?:\\.\\w+)?`, 'i'))) return true;

            // Constant definitions
            const constMatch = parsePureBasicConstantDefinition(line) || parsePureBasicConstantDeclaration(line);
            if (constMatch && normalizeConstantName(constMatch.name) === normalizeConstantName(word)) return true;

            // Structure definition
            if (line.match(new RegExp(`^Structure\\s+(${safeWord})\\b`, 'i'))) return true;

            // Interface definition
            if (line.match(new RegExp(`^Interface\\s+(${safeWord})\\b`, 'i'))) return true;

            // Enumeration / EnumerationBinary
            if (line.match(new RegExp(`^Enumeration(?:Binary)?\\s+(${safeWord})\\b`, 'i'))) return true;

            // Module / DeclareModule definition
            if (line.match(new RegExp(`^(?:Module|DeclareModule)\\s+(${safeWord})\\b`, 'i'))) return true;
        }
    }

    return false;
}

/**
 * Get module call information from cursor position.
 * Uses a /g exec-loop so every occurrence is checked against the cursor.
 */
function getModuleCallFromPosition(line: string, character: number): {
    moduleName: string;
    functionName: string;
} | null {
    const re = /(\w+)::(\w+)/g;
    let moduleMatch: RegExpExecArray | null;
    while ((moduleMatch = re.exec(line)) !== null) {
        const matchStart = moduleMatch.index;
        const matchEnd   = matchStart + moduleMatch[0].length;
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
 * Handling Module Function Renaming
 */
function handleModuleFunctionRename(
    moduleName: string,
    functionName: string,
    newName: string,
    searchDocs: Map<string, TextDocument>
): WorkspaceEdit | null {
    const edits: Array<{ uri: string; range: Range }> = [];
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
                // Skip matches within comments
                if (line.substring(0, match.index).includes(';')) {
                    continue;
                }

                // Skip matches within strings
                const beforeMatch = line.substring(0, match.index);
                const quoteCount = (beforeMatch.match(/"/g) || []).length;
                if (quoteCount % 2 === 1) {
                    continue;
                }

                const functionStart = match.index + moduleName.length + 2; // +2 for '::'
                edits.push({
                    uri: doc.uri,
                    range: {
                        start: { line: i, character: functionStart },
                        end: { line: i, character: functionStart + functionName.length }
                    }
                });
            }

            // Track module scope to find procedure definitions inside the module
            const moduleStartMatch = line.match(new RegExp(`^\\s*Module\\s+${safeModule}\\b`, 'i'));
            if (moduleStartMatch) {
                inModule = true;
                continue;
            }

            if (line.match(/^\s*EndModule\b/i)) {
                inModule = false;
                continue;
            }

            // Find Procedure definition inside module.
            // ProcedureC / ProcedureDLL / ProcedureCDLL added.
            if (inModule) {
                const procMatch = line.match(new RegExp(`^\\s*Procedure(?:C|DLL|CDLL)?(?:\\.\\w+)?\\s+(${safeFn})\\s*\\(`, 'i'));
                if (procMatch) {
                    const startChar = line.indexOf(procMatch[1]);
                    edits.push({
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

    if (edits.length === 0) {
        return null;
    }

    // Group edits by document URI
    const changes: { [uri: string]: TextEdit[] } = {};
    for (const edit of edits) {
        if (!changes[edit.uri]) {
            changes[edit.uri] = [];
        }
        changes[edit.uri].push({
            range: edit.range,
            newText: newName
        });
    }

    return { changes };
}

/**
 * Find all occurrences of a word across all search documents.
 * For constants a negative lookbehind (?<!\w) is used at the start.
 */
function findAllOccurrences(
    word: string,
    searchDocs: Map<string, TextDocument>
): Array<{ uri: string; range: Range }> {
    const occurrences: Array<{ uri: string; range: Range }> = [];
    const safe = escapeRegExp(word);
    const isConstant = word.startsWith('#');
    // For #constants : (?<!\w)#Name\b  – no leading \b because '#' is not a word char
    // For identifiers: \bName\b        – standard word boundaries
    const pattern = isConstant
        ? new RegExp(`(?<!\\w)${safe}\\b`, 'gi')
        : new RegExp(`\\b${safe}\\b`, 'gi');

    for (const doc of searchDocs.values()) {
        const text = doc.getText();
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(line)) !== null) {
                // Skip matches within comments
                if (line.substring(0, match.index).includes(';')) {
                    continue;
                }

                // Skip matches within strings
                const beforeMatch = line.substring(0, match.index);
                const quoteCount = (beforeMatch.match(/"/g) || []).length;
                if (quoteCount % 2 === 1) {
                    continue;
                }

                occurrences.push({
                    uri: doc.uri,
                    range: {
                        start: { line: i, character: match.index },
                        end: { line: i, character: match.index + word.length }
                    }
                });
            }
        }
    }

    return occurrences;
}

/**
 * Handle module symbol (constant/structure/interface/enumeration) rename
 */
function handleModuleSymbolRename(
    moduleName: string,
    ident: string,
    newName: string,
    searchDocs: Map<string, TextDocument>
): WorkspaceEdit | null {
    const changes: { [uri: string]: TextEdit[] } = {};
    const safeModule = escapeRegExp(moduleName);
    const safeIdent = escapeRegExp(ident);

    for (const doc of searchDocs.values()) {
        const text = doc.getText();
        const lines = text.split('\n');
        const edits: TextEdit[] = [];

        for (let i = 0; i < lines.length; i++) {
            const raw = lines[i];
            const trimmed = raw.trim();

            // Usages: Module::ident / Module::#ident
            const re = new RegExp(`\\b${safeModule}::#?${safeIdent}\\b`, 'g');
            let m: RegExpExecArray | null;
            while ((m = re.exec(raw)) !== null) {
                // Skip matches within comments
                if (raw.substring(0, m.index).includes(';')) {
                    continue;
                }

                // Skip matches within strings
                const beforeMatch = raw.substring(0, m.index);
                const quoteCount = (beforeMatch.match(/"/g) || []).length;
                if (quoteCount % 2 === 1) {
                    continue;
                }

                const identStart = m.index + moduleName.length + 2 + (raw[m.index + moduleName.length + 2] === '#' ? 1 : 0);
                edits.push({ range: { start: { line: i, character: identStart }, end: { line: i, character: identStart + ident.length } }, newText: newName });
            }

            // Declarations: Structure/Interface/Enumeration/constant name
            const constMatch = parsePureBasicConstantDefinition(trimmed) || parsePureBasicConstantDeclaration(trimmed);
            if (constMatch && normalizeConstantName(constMatch.name) === normalizeConstantName(ident)) {
                const constIndex = raw.indexOf('#' + constMatch.name);
                if (constIndex === -1) continue;
                const startChar = constIndex + 1;
                edits.push({ range: { start: { line: i, character: startChar }, end: { line: i, character: startChar + constMatch.name.length } }, newText: newName });
                continue;
            }
            const defMatchers = [
                new RegExp(`^Structure\\s+(${safeIdent})\\b`, 'i'),
                new RegExp(`^Interface\\s+(${safeIdent})\\b`, 'i'),
                new RegExp(`^Enumeration(?:Binary)?\\s+(${safeIdent})\\b`, 'i'),
            ];
            for (const r of defMatchers) {
                const mm = trimmed.match(r);
                if (mm) {
                    const startChar = raw.indexOf(mm[1]);
                    edits.push({ range: { start: { line: i, character: startChar }, end: { line: i, character: startChar + ident.length } }, newText: newName });
                    break;
                }
            }
        }

        if (edits.length) {
            changes[doc.uri] = (changes[doc.uri] || []).concat(edits);
        }
    }

    return Object.keys(changes).length ? { changes } : null;
}

/**
 * Get module symbol position (constant/structure/interface/enumeration).
 * Uses a /g exec-loop; constants (Module::#Ident) are checked first.
 */
function getModuleSymbolFromLine(line: string, character: number): { moduleName: string; ident: string } | null {
    // Pass 1: prefer constant form  Module::#Ident
    const constRe = /(\w+)::#(\w+)/g;
    let m: RegExpExecArray | null;
    while ((m = constRe.exec(line)) !== null) {
        const start = m.index, end = start + m[0].length;
        if (character >= start && character <= end) return { moduleName: m[1], ident: m[2] };
    }
    // Pass 2: plain symbol form  Module::Ident
    const symRe = /(\w+)::(\w+)/g;
    while ((m = symRe.exec(line)) !== null) {
        const start = m.index, end = start + m[0].length;
        if (character >= start && character <= end) return { moduleName: m[1], ident: m[2] };
    }
    return null;
}

/**
 * Structure member position: var\\member
 */
function getStructAccessFromLine(line: string, character: number): { varName: string; memberName: string } | null {
    const re = /([A-Za-z_][A-Za-z0-9_]*|\*[A-Za-z_][A-Za-z0-9_]*)(?:\([^)]*\))?\\(\w+)/g;
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

function getVariableStructureAt(document: TextDocument, lineNumber: number, varName: string): string | null {
    const text = document.getText();
    const analysis = analyzeScopesAndVariables(text, lineNumber);
    const normalized = varName.replace(/^\*/, '').replace(/\([^)]*\)$/, '');
    const v = analysis.availableVariables.find(x => x.name.toLowerCase() === normalized.toLowerCase());
    if (!v) return null;
    const t = v.type || '';
    const cleaned = t.split(' ')[0];
    const noPtr = cleaned.startsWith('*') ? cleaned.substring(1) : cleaned;
    const arrIdx = noPtr.indexOf('[');
    return (arrIdx > -1 ? noPtr.substring(0, arrIdx) : noPtr) || null;
}

function getMemberRange(line: string, character: number, memberName: string, lineNo: number): Range | null {
    const safeMemberName = escapeRegExp(memberName);
    const re = new RegExp(`\\\\(${safeMemberName})\\b`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
        const start = m.index + 1; // skip '\\'
        const end = start + m[1].length;
        if (character >= start && character <= end) {
            return {
                start: { line: lineNo, character: start },
                end: { line: lineNo, character: end }
            };
        }
    }
    return null;
}

/**
 * Handle structure member rename
 */
function handleStructMemberRename(
    structName: string,
    memberName: string,
    newName: string,
    searchDocs: Map<string, TextDocument>
): WorkspaceEdit | null {
    const changes: { [uri: string]: TextEdit[] } = {};
    const safeStructName = escapeRegExp(structName);
    const safeMemberName = escapeRegExp(memberName);

    // Collect variable names of the struct type per document
    const structVarsPerDoc = new Map<string, string[]>();
    for (const doc of searchDocs.values()) {
        const analysis = analyzeScopesAndVariables(doc.getText(), Number.MAX_SAFE_INTEGER);
        const vars = analysis.availableVariables
            .filter(v => {
                const t = v.type || '';
                const cleaned = t.split(' ')[0];
                const noPtr = cleaned.startsWith('*') ? cleaned.substring(1) : cleaned;
                const arrIdx = noPtr.indexOf('[');
                const base = arrIdx > -1 ? noPtr.substring(0, arrIdx) : noPtr;
                return base.toLowerCase() === structName.toLowerCase();
            })
            .map(v => v.name);
        structVarsPerDoc.set(doc.uri, vars);
    }

    for (const doc of searchDocs.values()) {
        const text = doc.getText();
        const lines = text.split('\n');
        const edits: TextEdit[] = [];

        // 1) Rename the member inside the Structure definition
        let inStruct = false;
        for (let i = 0; i < lines.length; i++) {
            const raw = lines[i];
            const line = raw.trim();
            if (line.match(new RegExp(`^Structure\\s+${safeStructName}\\b`, 'i'))) { inStruct = true; continue; }
            if (inStruct && line.match(/^EndStructure\b/i)) { inStruct = false; continue; }
            if (inStruct) {
                // Structure members can be prefixed with Array/List/Map keywords, e.g. "Array arrField.i(5)".
                const collectionMatch = line.match(
                    new RegExp(`^(?:Array|List|Map)\\s+\\*?(${safeMemberName})(?:\\.|\\s|\\[|$)`, 'i')
                );
                const directMatch = !collectionMatch && line.match(
                    new RegExp(`^\\*?(${safeMemberName})(?:\\.|\\s|$)`)
                );
                const mm = collectionMatch || directMatch;
                if (mm) {
                    const capturedName = mm[1];
                    const startChar = raw.indexOf(capturedName);
                    if (startChar === -1) continue;
                    // Skip matches in comments
                    if (raw.substring(0, startChar).includes(';')) continue;
                    // Skip matches in strings
                    if ((raw.substring(0, startChar).match(/"/g) || []).length % 2 === 1) continue;
                    edits.push({ range: { start: { line: i, character: startChar }, end: { line: i, character: startChar + memberName.length } }, newText: newName });
                }
            }
        }

        // 2) Rename usages: var\\memberName, *var, and var(...) forms
        const vars = structVarsPerDoc.get(doc.uri) || [];
        if (vars.length > 0) {
            for (let i = 0; i < lines.length; i++) {
                const raw = lines[i];
                for (const v of vars) {
                    const re = new RegExp(`\\b\\*?${v}(?:\\([^)]*\\))?\\\\${safeMemberName}\\b`, 'g');
                    let m: RegExpExecArray | null;
                    while ((m = re.exec(raw)) !== null) {
                        // Skip matches within comments
                        if (raw.substring(0, m.index).includes(';')) {
                            continue;
                        }

                        // Skip matches within strings
                        const beforeMatch = raw.substring(0, m.index);
                        const quoteCount = (beforeMatch.match(/"/g) || []).length;
                        if (quoteCount % 2 === 1) {
                            continue;
                        }

                        // Calculate member name start: Find the first backslash position within the matched segment
                        const matchStart = m.index;
                        const matchedText = raw.substring(matchStart, matchStart + m[0].length);
                        const slashRel = matchedText.indexOf('\\');
                        const startChar = matchStart + slashRel + 1;
                        edits.push({ range: { start: { line: i, character: startChar }, end: { line: i, character: startChar + memberName.length } }, newText: newName });
                    }
                }
            }
        }

        if (edits.length > 0) {
            changes[doc.uri] = (changes[doc.uri] || []).concat(edits);
        }
    }

    return Object.keys(changes).length ? { changes } : null;
}

/**
 * Collect search documents: current document + all open documents +
 * recursively resolved IncludeFile / XIncludeFile chains + workspace files.
 *
 * This ensures that Rename operates on the same document set as
 * Go-to-Definition, so symbols in non-open included files are also renamed.
 */
function collectSearchDocuments(
    document: TextDocument,
    allDocuments: Map<string, TextDocument>,
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

        // Maintain current IncludePath search directories (newest first)
        const includeDirs: string[] = [];

        for (const line of lines) {
            // IncludePath directive
            const ip = line.match(/^\s*IncludePath\s+"([^"]+)"/i);
            if (ip) {
                const dir = normalizeDirPath(uri, ip[1]);
                if (!includeDirs.includes(dir)) includeDirs.unshift(dir);
                continue;
            }

            const m = line.match(/^\s*(?:X?IncludeFile)\s+"([^"]+)"/i);
            if (!m) continue;
            const inc = m[1];
            const fsPath = resolveIncludePath(uri, inc, includeDirs, workspaceRoot);
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

    // Include workspace files for completeness
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