/**
 * Module Parsing Tool
 * Responsible for parsing PureBasic modules and IncludeFile references
 */

import * as path from 'path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { resolveIncludePath, readFileIfExistsSync, normalizeDirPath, tryRealpath } from './fs-utils';
import { getWorkspaceRootForUri } from '../indexer/workspace-index';
import { readFileCached } from './file-cache';
import { generateHash } from './hash-utils';
import { parsePureBasicConstantDeclaration } from './constants';
import { escapeRegExp} from '../utils/string-utils';

type LogFn = (message: string, err?: unknown) => void;

/** No-op until initModuleResolver() is called. */
let internalLog: LogFn = () => { /* uninitialized */ };

/**
 * Must be called once during server startup to wire up LSP logging.
 * Until called, errors are silently swallowed.
 */
export function initModuleResolver(logFn: LogFn): void {
    internalLog = logFn;
}

export interface ModuleFunction {
    name: string;
    returnType: string;
    parameters: string;
    signature: string;
    insertText: string;
    documentation: string;
}

export interface ModuleInfo {
    name: string;
    functions: ModuleFunction[];
    constants: Array<{name: string, value?: string}>;
    structures: Array<{name: string}>;
    interfaces?: Array<{name: string}>;
    enumerations?: Array<{name: string}>;
}

/**
 * Parses IncludeFile references from the given document.
 */
const includeCache = new WeakMap<TextDocument, { hash: string; files: string[] }>();

export function parseIncludeFiles(document: TextDocument, documentCache: Map<string, TextDocument>): string[] {
    const includeFiles: string[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    // Cache lookup based on document content hash
    try {
        const h = generateHash(text);
        const cached = includeCache.get(document);
        if (cached && cached.hash === h) {
            return cached.files.slice();
        }
        // Continue parsing; cache will be written before returning below
    } catch {}

    // Current IncludePath list (most recently seen first)
    const includeDirs: string[] = [];
    const workspaceRoot = getWorkspaceRootForUri(document.uri);

    for (const raw of lines) {
        const line = raw.trim();

        // Handle IncludePath directive
        const ip = line.match(/^IncludePath\s+\"([^\"]+)\"/i);
        if (ip) {
            const dir = normalizeDirPath(document.uri, ip[1]);
            if (!includeDirs.includes(dir)) includeDirs.unshift(dir);
            continue;
        }

        // Matches IncludeFile/XIncludeFile (supports "..." or <...> syntax)
        const m = line.match(/^\s*(?:X?IncludeFile)\s+[\"<]([^\"<>]+)[\">]/i);
        if (!m) continue;

        const inc = m[1];
        // (Parsed as-is for now)
        let fullPath = resolveIncludePath(document.uri, inc, includeDirs, workspaceRoot);
        // If no extension was specified, retry with .pbi appended
        if (!fullPath && !path.extname(inc)) {
            fullPath = resolveIncludePath(document.uri, `${inc}.pbi`, includeDirs, workspaceRoot);
        }
        if (fullPath) includeFiles.push(fullPath);
    }

    try {
        const h = generateHash(text);
        includeCache.set(document, { hash: h, files: includeFiles.slice() });
    } catch {}
    return includeFiles;
}

/**
 * Reads document content from a filesystem path.
 */
function readDocumentFromPath(filePath: string): string | null {
    try {
        // Resolve symlinks before reading: resolveIncludePath() already returns a
        // real path, but we re-resolve here as defense-in-depth against any future
        // call sites that may pass a non-resolved path. This also ensures the cache
        // is always keyed on the real path, preventing stale cache entries for
        // symlinks whose targets change.
        const realPath = tryRealpath(filePath);
        const cached = readFileCached(realPath);
        if (cached != null) return cached;
        return readFileIfExistsSync(realPath);
    } catch (error) {
        internalLog(`Error reading file ${filePath}:`, error);
        return null;
    }
}

/**
 * Returns function completions exported by the given module.
 */
export function getModuleFunctionCompletions(
    moduleName: string,
    document: TextDocument,
    documentCache: Map<string, TextDocument>
): ModuleFunction[] {
    const functions: ModuleFunction[] = [];

    // Collect all documents to search
    const searchDocuments: Array<{text: string, uri?: string}> = [];

    // Add the current document
    searchDocuments.push({ text: document.getText(), uri: document.uri });

    // Add documents from the cache
    for (const [uri, doc] of documentCache) {
        if (uri !== document.uri) {
            searchDocuments.push({ text: doc.getText(), uri });
        }
    }

    // Parse IncludeFile references and add their content to the search set
    const includeFiles = parseIncludeFiles(document, documentCache);
    for (const includeFile of includeFiles) {
        const content = readDocumentFromPath(includeFile);
        if (content) {
            searchDocuments.push({ text: content, uri: includeFile });
        }
    }

    // Search all collected documents for the module
    for (const doc of searchDocuments) {
        const moduleFunctions = extractModuleFunctions(doc.text, moduleName);
        functions.push(...moduleFunctions);
    }

    // Deduping (by function name) - Implemented using Map for O(n) complexity
    const uniqueFunctionsMap = new Map<string, ModuleFunction>();
    for (const func of functions) {
        if (!uniqueFunctionsMap.has(func.name)) {
            uniqueFunctionsMap.set(func.name, func);
        }
    }
    return Array.from(uniqueFunctionsMap.values());
}

/**
 * Returns all exports (functions, constants, structures) of the given module.
 */
export function getModuleExports(
    moduleName: string,
    document: TextDocument,
    documentCache: Map<string, TextDocument>
): ModuleInfo {
    const info: ModuleInfo = {
        name: moduleName,
        functions: [],
        constants: [],
        structures: [],
        interfaces: [],
        enumerations: []
    };

    // Collect documents to search
    const searchDocuments: Array<{text: string, uri?: string}> = [];
    searchDocuments.push({ text: document.getText(), uri: document.uri });
    for (const [uri, doc] of documentCache) {
        if (uri !== document.uri) {
            searchDocuments.push({ text: doc.getText(), uri });
        }
    }

    const includeFiles = parseIncludeFiles(document, documentCache);
    for (const includeFile of includeFiles) {
        const content = readDocumentFromPath(includeFile);
        if (content) {
            searchDocuments.push({ text: content, uri: includeFile });
        }
    }

    for (const doc of searchDocuments) {
        const mod = extractModuleExports(doc.text, moduleName);
        // Merge results, deduplicating by name
        for (const f of mod.functions) {
            if (!info.functions.some(x => x.name === f.name)) info.functions.push(f);
        }
        for (const c of mod.constants) {
            if (!info.constants.some(x => x.name === c.name)) info.constants.push(c);
        }
        for (const s of mod.structures) {
            if (!info.structures.some(x => x.name === s.name)) info.structures.push(s);
        }
        for (const s of (mod.interfaces || [])) {
            if (!info.interfaces!.some(x => x.name === s.name)) info.interfaces!.push(s);
        }
        for (const e of (mod.enumerations || [])) {
            if (!info.enumerations!.some(x => x.name === e.name)) info.enumerations!.push(e);
        }
    }

    return info;
}

/**
 * Extracts functions of the given module from document text.
 */
function extractModuleFunctions(text: string, moduleName: string): ModuleFunction[] {
    const functions: ModuleFunction[] = [];
    const lines = text.split('\n');
    const safeModuleName = escapeRegExp(moduleName);

    let inDeclareModule = false;
    let inModule = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip comment lines
        if (line.startsWith(';')) {
            continue;
        }

        // Check for DeclareModule start
        const declareModuleMatch = line.match(new RegExp(`^DeclareModule\\s+${safeModuleName}\\b`, 'i'));
        if (declareModuleMatch) {
            inDeclareModule = true;
            continue;
        }

        // Check for Module start
        const moduleStartMatch = line.match(new RegExp(`^Module\\s+${safeModuleName}\\b`, 'i'));
        if (moduleStartMatch) {
            inModule = true;
            continue;
        }

        // Check for module end
        if (line.match(/^EndDeclareModule\b/i)) {
            inDeclareModule = false;
            continue;
        }

        if (line.match(/^EndModule\b/i)) {
            inModule = false;
            continue;
        }

        // Search for Declare statements inside DeclareModule
        if (inDeclareModule) {
            const declareMatch = line.match(/^Declare(?:\.(\w+))?\s+(\w+)\s*\(([^)]*)\)/i);
            if (declareMatch) {
                const returnType = declareMatch[1] || '';
                const functionName = declareMatch[2];
                const params = declareMatch[3] || '';

                const signature = returnType
                    ? `Declare.${returnType} ${functionName}(${params})`
                    : `Declare ${functionName}(${params})`;

                const insertText = params.trim() ? `${functionName}(` : `${functionName}()`;

                functions.push({
                    name: functionName,
                    returnType,
                    parameters: params,
                    signature,
                    insertText,
                    documentation: `Module function declaration: ${signature}`
                });
            }
        }

        // Search for Procedure definitions inside Module
        if (inModule) {
            const procMatch = line.match(/^Procedure(?:\.(\w+))?\s+(\w+)\s*\(([^)]*)\)/i);
            if (procMatch) {
                const returnType = procMatch[1] || '';
                const functionName = procMatch[2];
                const params = procMatch[3] || '';

                const signature = returnType
                    ? `Procedure.${returnType} ${functionName}(${params})`
                    : `Procedure ${functionName}(${params})`;

                const insertText = params.trim() ? `${functionName}(` : `${functionName}()`;

                functions.push({
                    name: functionName,
                    returnType,
                    parameters: params,
                    signature,
                    insertText,
                    documentation: `Module function implementation: ${signature}`
                });
            }
        }
    }

    return functions;
}

/**
 * Extracts module exports from document text (both DeclareModule and Module sections).
 */
function extractModuleExports(text: string, moduleName: string): {
    functions: ModuleFunction[];
    constants: Array<{name: string, value?: string}>;
    structures: Array<{name: string}>;
    interfaces?: Array<{name: string}>;
    enumerations?: Array<{name: string}>;
} {
    const functions: ModuleFunction[] = [];
    const constants: Array<{name: string, value?: string}> = [];
    const structures: Array<{name: string}> = [];
    const interfaces: Array<{name: string}> = [];
    const enumerations: Array<{name: string}> = [];
    const safeModuleName = escapeRegExp(moduleName);

    const lines = text.split('\n');
    let inDeclareModule = false;
    let inModule = false;

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const line = raw.trim();

        // Skip comment lines
        if (line.startsWith(';')) {
            continue;
        }

        // Track DeclareModule and Module scope boundaries
        const declStart = line.match(new RegExp(`^DeclareModule\\s+${safeModuleName}\\b`, 'i'));
        if (declStart) { inDeclareModule = true; continue; }
        if (line.match(/^EndDeclareModule\b/i)) { inDeclareModule = false; continue; }

        const modStart = line.match(new RegExp(`^Module\\s+${safeModuleName}\\b`, 'i'));
        if (modStart) { inModule = true; continue; }
        if (line.match(/^EndModule\b/i)) { inModule = false; continue; }

        // DeclareModule section: collect exported function declarations, constants, and structures
        if (inDeclareModule) {
            const declareMatch = line.match(/^Declare(?:\.(\w+))?\s+(\w+)\s*\(([^)]*)\)/i);
            if (declareMatch) {
                const returnType = declareMatch[1] || '';
                const functionName = declareMatch[2];
                const params = declareMatch[3] || '';
                const signature = returnType
                    ? `Declare.${returnType} ${functionName}(${params})`
                    : `Declare ${functionName}(${params})`;
                const insertText = params.trim() ? `${functionName}(` : `${functionName}()`;
                functions.push({
                    name: functionName,
                    returnType,
                    parameters: params,
                    signature,
                    insertText,
                    documentation: `Module function declaration: ${signature}`
                });
                continue;
            }

            const constMatch = parsePureBasicConstantDeclaration(line);
            if (constMatch) {
                constants.push({ name: constMatch.name, value: constMatch.value });
                continue;
            }

            const structMatch = line.match(/^Structure\s+(\w+)/i);
            if (structMatch) {
                structures.push({ name: structMatch[1] });
                continue;
            }

            const interfaceMatch = line.match(/^Interface\s+(\w+)/i);
            if (interfaceMatch) {
                interfaces.push({ name: interfaceMatch[1] });
                continue;
            }

            const enumMatch = line.match(/^Enumeration\s+(\w+)/i);
            if (enumMatch) {
                enumerations.push({ name: enumMatch[1] });
                continue;
            }
        }

        // Module section: collect implementations (override/supplement matching declarations)
        if (inModule) {
            const procMatch = line.match(/^Procedure(?:\.(\w+))?\s+(\w+)\s*\(([^)]*)\)/i);
            if (procMatch) {
                const returnType = procMatch[1] || '';
                const functionName = procMatch[2];
                const params = procMatch[3] || '';
                const signature = returnType
                    ? `Procedure.${returnType} ${functionName}(${params})`
                    : `Procedure ${functionName}(${params})`;
                const insertText = params.trim() ? `${functionName}(` : `${functionName}()`;
                // Override or supplement a matching declaration with the full implementation
                const idx = functions.findIndex(f => f.name === functionName);
                const item = {
                    name: functionName,
                    returnType,
                    parameters: params,
                    signature,
                    insertText,
                    documentation: `Module function implementation: ${signature}`
                } as ModuleFunction;
                if (idx >= 0) functions[idx] = item; else functions.push(item);
            }
        }
    }

    return { functions, constants, structures, interfaces, enumerations };
}

/**
 * Returns all module names referenced in the document and its includes.
 */
export function getAvailableModules(
    document: TextDocument,
    documentCache: Map<string, TextDocument>
): string[] {
    const modules: Set<string> = new Set();
    const searchDocuments: Array<{text: string}> = [];

    // Add the current document
    searchDocuments.push({ text: document.getText() });

    // Add documents from the cache
    for (const [uri, doc] of documentCache) {
        if (uri !== document.uri) {
            searchDocuments.push({ text: doc.getText() });
        }
    }

    // Parse IncludeFile references and add their content to the search set
    const includeFiles = parseIncludeFiles(document, documentCache);
    for (const includeFile of includeFiles) {
        const content = readDocumentFromPath(includeFile);
        if (content) {
            searchDocuments.push({ text: content });
        }
    }

    // Search all collected documents for module names
    for (const doc of searchDocuments) {
        const foundModules = extractModuleNames(doc.text);
        foundModules.forEach(m => modules.add(m));
    }

    return Array.from(modules);
}

/**
 * Extracts all module names (DeclareModule and Module) from document text.
 */
function extractModuleNames(text: string): string[] {
    const modules: string[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
        const trimmedLine = line.trim();

        // Skip comment lines
        if (trimmedLine.startsWith(';')) {
            continue;
        }

        // Match DeclareModule ModuleName
        const declareMatch = trimmedLine.match(/^DeclareModule\s+(\w+)/i);
        if (declareMatch) {
            modules.push(declareMatch[1]);
        }

        // Match Module ModuleName
        const moduleMatch = trimmedLine.match(/^Module\s+(\w+)/i);
        if (moduleMatch) {
            modules.push(moduleMatch[1]);
        }
    }

    return modules;
}