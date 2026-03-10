/**
 * PureBasic Include File Parser
 * Parse XIncludeFile directives and include files
 */
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { parsePureBasicConstantDefinition } from '../utils/constants';
import { resolveIncludePath as fsResolveIncludePath, normalizeDirPath } from '../utils/fs-utils';

export interface IncludeFile {
    filePath: string;
    resolvedPath: string;
    lineNumber: number;
    isConditional: boolean;
    /** True for IncludeBinary directives (binary data embed). */
    isBinary: boolean;
    /**
     * True when the directive appears inside a DataSection…EndDataSection
     * block. Only meaningful when isBinary is true.
     */
    insideDataSection: boolean;
}

export interface IncludeAnalysis {
    includeFiles: IncludeFile[];
    dependencies: Map<string, string[]>;
    circularDependencies: string[];
    missingFiles: string[];
}

/**
 * Parse XIncludeFile directives in document
 */
export function parseIncludeFiles(document: TextDocument, workspaceRoot: string = ''): IncludeAnalysis {
    const content = document.getText();
    const lines = content.split('\n');

    const includeFiles: IncludeFile[] = [];
    const dependencies = new Map<string, string[]>();
    const circularDependencies: string[] = [];
    const missingFiles: string[] = [];

    const currentFile = URI.parse(document.uri).fsPath;
    dependencies.set(currentFile, []);

    // Collect IncludePath directives so that relative paths
    // are resolved correctly – analogous to collectSearchDocuments in definition-provider.
    // Latest entries first (unshift), as later IncludePath specifications may take precedence.
    const includeDirs: string[] = [];

    // Track whether the current line is inside a DataSection…EndDataSection block.
    let insideDataSection = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip comment lines
        if (line.startsWith(';')) {
            continue;
        }

        // Track DataSection / EndDataSection boundaries.
        if (/^DataSection\b/i.test(line)) {
            insideDataSection = true;
            continue;
        }
        if (/^EndDataSection\b/i.test(line)) {
            insideDataSection = false;
            continue;
        }

        // Process IncludePath directives.
        // PureBasic syntax is `IncludePath "directory"` – only double quotation marks.
        const includePathMatch = line.match(/^IncludePath\s+"([^"]+)"/i);
        if (includePathMatch) {
            const dir = normalizeDirPath(document.uri, includePathMatch[1]);
            if (!includeDirs.includes(dir)) {
                includeDirs.unshift(dir);
            }
            continue;
        }

        // Parse XIncludeFile / IncludeFile / conditional XIncludeFile directives.
        // resolveInc() uses the document URI as base so relative paths without an
        // explicit IncludePath directive are resolved against the document directory.
        const includeMatch     = line.match(/^XIncludeFile\s+"([^"]+)"/i);
        const oldIncludeMatch  = line.match(/^IncludeFile\s+"([^"]+)"/i);
        const conditionalMatch = line.match(/^(?:Compiler)?If\s+\w+\s*:\s*XIncludeFile\s+"([^"]+)"/i);

        const rawIncludePath =
            includeMatch?.[1] ?? oldIncludeMatch?.[1] ?? conditionalMatch?.[1];

        if (rawIncludePath !== undefined) {
            const isConditional = conditionalMatch !== null || isConditionalInclude(line);
            const resolved = fsResolveIncludePath(
                document.uri,
                rawIncludePath,
                includeDirs,
                workspaceRoot || undefined
            );

            // resolved === null means the file could not be found on disk.
            // Store the raw path so callers can generate "file not found" diagnostics.
            const resolvedPath = resolved ?? rawIncludePath;
            if (resolved === null) {
                missingFiles.push(rawIncludePath);
            }

            includeFiles.push({
                filePath: rawIncludePath,
                resolvedPath,
                lineNumber: i,
                isConditional,
                isBinary: false,
                insideDataSection
            });
            dependencies.get(currentFile)!.push(resolvedPath);
            continue;
        }

        // Parse IncludeBinary directive.
        // IncludeBinary resolves relative to the document directory (same rules as
        // IncludeFile). It should always appear inside a DataSection block.
        const binaryMatch = line.match(/^IncludeBinary\s+"([^"]+)"/i);
        if (binaryMatch) {
            const rawBinaryPath = binaryMatch[1];
            const resolved = fsResolveIncludePath(
                document.uri,
                rawBinaryPath,
                includeDirs,
                workspaceRoot || undefined
            );

            const resolvedPath = resolved ?? rawBinaryPath;
            if (resolved === null) {
                missingFiles.push(rawBinaryPath);
            }

            includeFiles.push({
                filePath: rawBinaryPath,
                resolvedPath,
                lineNumber: i,
                isConditional: false,
                isBinary: true,
                insideDataSection
            });
            dependencies.get(currentFile)!.push(resolvedPath);
        }
    }

    // Detect circular dependencies
    detectCircularDependencies(dependencies, circularDependencies);

    return {
        includeFiles,
        dependencies,
        circularDependencies,
        missingFiles
    };
}

/**
 * Parse content of included files and extract symbols
 */
export function parseIncludedSymbols(document: TextDocument): Map<string, any> {
    const symbols = new Map<string, any>();
    const content = document.getText();
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip comment lines
        if (line.startsWith(';')) {
            continue;
        }

        // Parse procedure definition
        if (/^Procedure(?:C|DLL|CDLL)?(?:\.\w+)?\s+\w+\s*\(/i.test(line)) {
            const procMatch = line.match(/^Procedure(?:C|DLL|CDLL)?(?:\.\w+)?\s+(\w+)\s*\(/i);
            if (procMatch) {
                const procName = procMatch[1];
                symbols.set(procName, {
                    type: 'procedure',
                    file: document.uri,
                    line: i,
                    definition: line,
                    exported: isExportedSymbol(line)
                });
            }
        }

        // Parse Prototype and PrototypeC
        if (/^Prototype(?:C)?(?:\.\w+)?\s+\w+\s*\(/i.test(line)) {
            const protoMatch = line.match(/^Prototype(?:C)?(?:\.\w+)?\s+(\w+)\s*\(/i);
            if (protoMatch) {
                const protoName = protoMatch[1];
                symbols.set(protoName, {
                    type: 'prototype',
                    file: document.uri,
                    line: i,
                    definition: line,
                    exported: isExportedSymbol(line)
                });
            }
        }

        // Parse variable declaration (usually global in include files)
        const scopeHeadMatch = line.match(/^(Global|Protected|Static|Define|Dim|Shared)\s+(?:(?:NewList|NewMap|NewArray)\s+)?/i);
        if (scopeHeadMatch) {
            const keywordEnd = scopeHeadMatch[0].length;
            const remaining = line.substring(keywordEnd);
            const nameRe = /(?:^|,)\s*\*?(\w+)(?=\.|[\[(\s,]|$)/g;
            let nm: RegExpExecArray | null;
            while ((nm = nameRe.exec(remaining)) !== null) {
                const varName = nm[1];
                symbols.set(varName, {
                    type: 'variable',
                    file: document.uri,
                    line: i,
                    definition: line,
                    exported: true
                });
            }
        }

        // Parsing constant definitions
        if (line.startsWith('#')) {
            const constMatch = parsePureBasicConstantDefinition(line);
            if (constMatch) {
                const constName = constMatch.name;
                symbols.set(constName, {
                    type: 'constant',
                    file: document.uri,
                    line: i,
                    definition: line,
                    exported: true
                });
            }
        }

        // Parse structure definition
        if (line.match(/^Structure\s+\w+/i)) {
            const structMatch = line.match(/^Structure\s+(\w+)/i);
            if (structMatch) {
                const structName = structMatch[1];
                symbols.set(structName, {
                    type: 'structure',
                    file: document.uri,
                    line: i,
                    definition: line,
                    exported: true
                });

                const members = parseStructureMembers(lines, i + 1);
                for (const member of members) {
                    const memberKey = `${structName}.${member.name}`;
                    symbols.set(memberKey, {
                        type: 'structure-member',
                        file: document.uri,
                        line: member.line,
                        definition: member.definition,
                        exported: true,
                        parent: structName
                    });
                }
            }
        }

        // Parse interface definition
        if (line.match(/^Interface\s+\w+/i)) {
            const interfaceMatch = line.match(/^Interface\s+(\w+)/i);
            if (interfaceMatch) {
                const interfaceName = interfaceMatch[1];
                symbols.set(interfaceName, {
                    type: 'interface',
                    file: document.uri,
                    line: i,
                    definition: line,
                    exported: true
                });

                const methods = parseInterfaceMethods(lines, i + 1);
                for (const method of methods) {
                    const methodKey = `${interfaceName}::${method.name}`;
                    symbols.set(methodKey, {
                        type: 'interface-method',
                        file: document.uri,
                        line: method.line,
                        definition: method.definition,
                        exported: true,
                        parent: interfaceName
                    });
                }
            }
        }

        /// Parse Enumeration / EnumerationBinary definition
        if (line.match(/^Enumeration(?:Binary)?\b/i)) {
            const enumMatch = line.match(/^Enumeration(?:Binary)?\s+(\w+)/i);
            if (enumMatch) {
                const enumName = enumMatch[1];
                symbols.set(enumName, {
                    type: 'enumeration',
                    file: document.uri,
                    line: i,
                    definition: line,
                    exported: true
                });

                const values = parseEnumerationValues(lines, i + 1);
                for (const value of values) {
                    const valueKey = `${enumName}.${value.name}`;
                    symbols.set(valueKey, {
                        type: 'enumeration-value',
                        file: document.uri,
                        line: value.line,
                        definition: value.definition,
                        exported: true,
                        parent: enumName
                    });
                }
            }
        }

        // Parse Macro definition
        if (line.match(/^Macro\s+\w+/i)) {
            const macroMatch = line.match(/^Macro\s+(\w+)/i);
            if (macroMatch) {
                const macroName = macroMatch[1];
                symbols.set(macroName, {
                    type: 'macro',
                    file: document.uri,
                    line: i,
                    definition: line,
                    exported: true
                });
            }
        }
    }

    return symbols;
}

/**
 * Parse structure members
 */
function parseStructureMembers(lines: string[], startLine: number): Array<{name: string, line: number, definition: string}> {
    const members: Array<{name: string, line: number, definition: string}> = [];

    for (let i = startLine; i < lines.length; i++) {
        const line = lines[i].trim();

        if (/^EndStructure\b/i.test(line)) {
            break;
        }

        // Skip comment lines inside structure
        if (line.startsWith(';')) {
            continue;
        }

        // [Pointer-Member + Anker]:
        const memberMatch = line.match(/^\*?(\w+)(?:\s*[.:].+|\s*\[)/);
        if (memberMatch && !/^(?:Array|List|Map)\s/i.test(line)) {
            members.push({
                name: memberMatch[1],
                line: i,
                definition: line
            });
        }

        // Array/List/Map-Member in Structures
        const collectionMemberMatch = line.match(/^(?:Array|List|Map)\s+\*?(\w+)\s*[.:]/i);
        if (collectionMemberMatch) {
            members.push({
                name: collectionMemberMatch[1],
                line: i,
                definition: line
            });
        }
    }

    return members;
}

/**
 * Parse interface methods
 */
function parseInterfaceMethods(lines: string[], startLine: number): Array<{name: string, line: number, definition: string}> {
    const methods: Array<{name: string, line: number, definition: string}> = [];

    for (let i = startLine; i < lines.length; i++) {
        const line = lines[i].trim();

        if (/^EndInterface\b/i.test(line)) {
            break;
        }

        // Skip comment lines inside interface
        if (line.startsWith(';')) {
            continue;
        }

        // Interface methods always have a parameter list (even if it is empty).
        const methodMatch = line.match(/^(\w+)\s*\(/);
        if (methodMatch) {
            methods.push({
                name: methodMatch[1],
                line: i,
                definition: line
            });
        }
    }

    return methods;
}

/**
 * Parse enumeration values
 */
function parseEnumerationValues(lines: string[], startLine: number): Array<{name: string, line: number, definition: string}> {
    const values: Array<{name: string, line: number, definition: string}> = [];

    for (let i = startLine; i < lines.length; i++) {
        const line = lines[i].trim();

        if (/^EndEnumeration\b/i.test(line)) {
            break;
        }

        // Skip comment lines inside enumeration
        if (line.startsWith(';')) {
            continue;
        }

        // Enumeration values are constants of the form #Name or #Name = Value.
        // parsePureBasicConstantDefinition expects a line beginning with ‘#’.
        const valueMatch = parsePureBasicConstantDefinition(line);
        if (valueMatch) {
            values.push({
                name: valueMatch.name,
                line: i,
                definition: line
            });
        }
    }

    return values;
}


/**
 * Check if it is conditional include.
 * Handles both runtime conditionals (If) and
 * compiler-time conditionals (CompilerIf).
 * The input line is already trimmed by the caller.
 */
function isConditionalInclude(line: string): boolean {
    const t = line.toLowerCase();
    return t.startsWith('if ') || t.startsWith('compilerif ');
}

/**
 * Check if it is exported symbol
 */
function isExportedSymbol(line: string): boolean {
    return line.includes('Export') || line.includes('Public');
}

/**
 * Detect circular dependencies
 */
function detectCircularDependencies(dependencies: Map<string, string[]>, circularDependencies: string[]): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    function dfs(node: string): void {
        if (recursionStack.has(node)) {
            // Cycle found: reconstruct path from first occurrence to current node
            const stackArr = Array.from(recursionStack);
            const cycleStart = stackArr.indexOf(node);
            const cycle = stackArr.slice(cycleStart);
            cycle.push(node);
            circularDependencies.push(cycle.join(' -> '));
            return;
        }

        if (visited.has(node)) {
            return;
        }

        visited.add(node);
        recursionStack.add(node);

        const neighbors = dependencies.get(node) || [];
        for (const neighbor of neighbors) {
            dfs(neighbor);
        }

        recursionStack.delete(node);
    }

    for (const [node] of dependencies) {
        if (!visited.has(node)) {
            dfs(node);
        }
    }
}

/**
 * Get all dependencies of include files (recursively)
 */
export function getAllIncludeDependencies(document: TextDocument, workspaceRoot: string = ''): string[] {
    const analysis = parseIncludeFiles(document, workspaceRoot);
    const allDependencies = new Set<string>();

    function collectDeps(filePath: string) {
        const deps = analysis.dependencies.get(filePath) || [];
        for (const dep of deps) {
            if (!allDependencies.has(dep)) {
                allDependencies.add(dep);
                collectDeps(dep);
            }
        }
    }

    const currentFile = URI.parse(document.uri).fsPath;
    collectDeps(currentFile);

    return Array.from(allDependencies);
}

/**
 * Validate if include files exist
 */
export function validateIncludeFiles(document: TextDocument, baseDirectory: string = '', existingFiles: Set<string>): string[] {
    const analysis = parseIncludeFiles(document, baseDirectory);
    const missingFiles: string[] = [];

    for (const include of analysis.includeFiles) {
        if (!existingFiles.has(include.resolvedPath)) {
            missingFiles.push(include.resolvedPath);
        }
    }

    return missingFiles;
}