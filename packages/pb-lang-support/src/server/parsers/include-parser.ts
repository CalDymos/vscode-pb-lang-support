/**
 * PureBasic Include File Parser
 * Parse XIncludeFile directives and include files
 */

import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { parsePureBasicConstantDefinition } from '../utils/constants';

export interface IncludeFile {
    filePath: string;
    resolvedPath: string;
    lineNumber: number;
    isConditional: boolean;
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
export function parseIncludeFiles(document: TextDocument, baseDirectory: string = ''): IncludeAnalysis {
    const content = document.getText();
    const lines = content.split('\n');

    const includeFiles: IncludeFile[] = [];
    const dependencies = new Map<string, string[]>();
    const circularDependencies: string[] = [];
    const missingFiles: string[] = [];

    const currentFile = URI.parse(document.uri).fsPath;
    dependencies.set(currentFile, []);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Parse XIncludeFile directive
        const includeMatch = line.match(/XIncludeFile\s+["']([^"']+)["']/);
        if (includeMatch) {
            const includePath = includeMatch[1];
            const resolvedPath = resolveIncludePath(includePath, baseDirectory);

            const includeFile: IncludeFile = {
                filePath: includePath,
                resolvedPath,
                lineNumber: i,
                isConditional: isConditionalInclude(line)
            };

            includeFiles.push(includeFile);
            dependencies.get(currentFile)!.push(resolvedPath);
        }

        // Parse IncludeFile directive (compatible with old syntax)
        const oldIncludeMatch = line.match(/IncludeFile\s+["']([^"']+)["']/);
        if (oldIncludeMatch) {
            const includePath = oldIncludeMatch[1];
            const resolvedPath = resolveIncludePath(includePath, baseDirectory);

            const includeFile: IncludeFile = {
                filePath: includePath,
                resolvedPath,
                lineNumber: i,
                isConditional: isConditionalInclude(line)
            };

            includeFiles.push(includeFile);
            dependencies.get(currentFile)!.push(resolvedPath);
        }

        // Parse conditional includes
        const conditionalMatch = line.match(/If\s+\w+\s*:\s*XIncludeFile\s+["']([^"']+)["']/);
        if (conditionalMatch) {
            const includePath = conditionalMatch[1];
            const resolvedPath = resolveIncludePath(includePath, baseDirectory);

            const includeFile: IncludeFile = {
                filePath: includePath,
                resolvedPath,
                lineNumber: i,
                isConditional: true
            };

            includeFiles.push(includeFile);
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

        // Parse procedure definition
        if (line.startsWith('Procedure') || line.startsWith('Procedure.')) {
            const procMatch = line.match(/(?:Procedure|Procedure\.\w+)\s+(\w+)\s*\(/);
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

        // Parse variable declaration (usually global in include files)
        if (line.startsWith('Global') || line.startsWith('Define')) {
            const varMatch = line.match(/(?:Global|Define)\s+(\w+)/);
            if (varMatch) {
                const varName = varMatch[1];
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
        if (line.startsWith('Structure')) {
            const structMatch = line.match(/Structure\s+(\w+)/);
            if (structMatch) {
                const structName = structMatch[1];
                symbols.set(structName, {
                    type: 'structure',
                    file: document.uri,
                    line: i,
                    definition: line,
                    exported: true
                });

                // Parse structure members
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
        if (line.startsWith('Interface')) {
            const interfaceMatch = line.match(/Interface\s+(\w+)/);
            if (interfaceMatch) {
                const interfaceName = interfaceMatch[1];
                symbols.set(interfaceName, {
                    type: 'interface',
                    file: document.uri,
                    line: i,
                    definition: line,
                    exported: true
                });

                // Parse interface methods
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

        // Parse enumeration definition
        if (line.startsWith('Enumeration')) {
            const enumMatch = line.match(/Enumeration\s+(\w+)/);
            if (enumMatch) {
                const enumName = enumMatch[1];
                symbols.set(enumName, {
                    type: 'enumeration',
                    file: document.uri,
                    line: i,
                    definition: line,
                    exported: true
                });

                // Parse enumeration values
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

        // Parse macro definition
        if (line.startsWith('Macro')) {
            const macroMatch = line.match(/Macro\s+(\w+)\s*\(/);
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

        if (line === 'EndStructure') {
            break;
        }

        // Parse member definition
        const memberMatch = line.match(/(\w+)\s*[.:].+/);
        if (memberMatch) {
            members.push({
                name: memberMatch[1],
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

        if (line === 'EndInterface') {
            break;
        }

        // Parse method definition
        const methodMatch = line.match(/(\w+)\s*\(/);
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

        if (line === 'EndEnumeration') {
            break;
        }

        // Parse enumeration value definition
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
 * Parse include file path
 */
function resolveIncludePath(includePath: string, baseDirectory: string): string {
    if (includePath.startsWith('./') || includePath.startsWith('.\\')) {
        includePath = includePath.substring(2);
    }

    if (baseDirectory && !includePath.includes('/') && !includePath.includes('\\')) {
        // Simple file name, add to base directory
        return `${baseDirectory}${includePath}`;
    }

    return includePath;
}

/**
 * Check if it is conditional include
 */
function isConditionalInclude(line: string): boolean {
    return line.startsWith('If') || line.includes('CompilerIf');
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

    function dfs(node: string): boolean {
        if (recursionStack.has(node)) {
            // Found circular dependency
            const cycle = Array.from(recursionStack).slice(recursionStack.has(node) ? Array.from(recursionStack).indexOf(node) : 0);
            cycle.push(node);
            circularDependencies.push(cycle.join(' -> '));
            return true;
        }

        if (visited.has(node)) {
            return false;
        }

        visited.add(node);
        recursionStack.add(node);

        const neighbors = dependencies.get(node) || [];
        for (const neighbor of neighbors) {
            dfs(neighbor);
        }

        recursionStack.delete(node);
        return false;
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
export function getAllIncludeDependencies(document: TextDocument, baseDirectory: string = ''): string[] {
    const analysis = parseIncludeFiles(document, baseDirectory);
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