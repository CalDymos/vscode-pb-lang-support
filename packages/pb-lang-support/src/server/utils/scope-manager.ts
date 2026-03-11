/**
 * Scope Manager
 * Handle scope analysis of PureBasic variables and symbols
 */

export enum ScopeType {
    Global = 'global',
    Procedure = 'procedure',
    Module = 'module',
    Structure = 'structure',
    If = 'if',
    For = 'for',
    While = 'while',
    Repeat = 'repeat',
    Select = 'select'
}

export interface ScopeInfo {
    type: ScopeType;
    name?: string;
    startLine: number;
    endLine?: number;
    parentScope?: ScopeInfo;
}

export interface VariableInfo {
    name: string;
    type: string;
    scope: ScopeInfo;
    definitionLine: number;
    isGlobal: boolean;
    isProtected: boolean;
    isStatic: boolean;
    isParameter: boolean;
}

/**
 * Parse scopes and variables in document
 */
export function analyzeScopesAndVariables(text: string, currentLine: number): {
    currentScope: ScopeInfo;
    availableVariables: VariableInfo[];
    allScopes: ScopeInfo[];
} {
    const lines = text.split(/\r?\n/);
    const scopes: ScopeInfo[] = [];
    const variables: VariableInfo[] = [];
    const scopeStack: ScopeInfo[] = [];

    // Global scope
    const globalScope: ScopeInfo = {
        type: ScopeType.Global,
        startLine: 0,
        endLine: lines.length - 1
    };
    scopes.push(globalScope);
    scopeStack.push(globalScope);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const originalLine = lines[i];

        // Skip comment lines
        if (line.startsWith(';')) {
            continue;
        }

        // Check scope start
        const scopeStart = detectScopeStart(line, i);
        if (scopeStart) {
            scopeStart.parentScope = scopeStack[scopeStack.length - 1];
            scopes.push(scopeStart);
            scopeStack.push(scopeStart);
        }

        // Check scope end
        if (detectScopeEnd(line, scopeStack)) {
            const endedScope = scopeStack.pop();
            if (endedScope) {
                endedScope.endLine = i;
            }
        }

        // Parsing variable definitions 
        const currentScope = scopeStack[scopeStack.length - 1];
        if (!currentScope) continue; // skip processing if no scope is available
        const variablesInLine = parseVariablesInLine(line, i, currentScope);
        variables.push(...variablesInLine);

        // If it is a procedure definition, parse parameters
        // ProcedureC / ProcedureDLL / ProcedureCDLL added to match detectScopeStart.
        const procMatch = line.match(/^Procedure(?:C|DLL|CDLL)?(?:\.(\w+))?\s+(\w+)\s*\(([^)]*)\)/i);
        if (procMatch && currentScope.type === ScopeType.Procedure) {
            const params = procMatch[3] || '';
            const paramVariables = parseParameters(params, i, currentScope);
            variables.push(...paramVariables);
        }
    }

    // Find the scope at current line
    const currentScope = findScopeAtLine(scopes, currentLine);

    // Get available variables visible in current scope
    const availableVariables = getAvailableVariables(variables, currentScope, currentLine);

    return {
        currentScope,
        availableVariables,
        allScopes: scopes
    };
}

/**
 * Detect scope start
 */
function detectScopeStart(line: string, lineNumber: number): ScopeInfo | null {
    // Procedure start
    // ProcedureC / ProcedureDLL / ProcedureCDLL added.
    // Without this, those variants don't open a Procedure scope → their
    // parameters are never parsed → varInfo lookup for struct params fails.
    const procMatch = line.match(/^Procedure(?:C|DLL|CDLL)?(?:\.(\w+))?\s+(\w+)/i);
    if (procMatch) {
        return {
            type: ScopeType.Procedure,
            name: procMatch[2],
            startLine: lineNumber
        };
    }

    // Module start
    const moduleMatch = line.match(/^Module\s+(\w+)/i);
    if (moduleMatch) {
        return {
            type: ScopeType.Module,
            name: moduleMatch[1],
            startLine: lineNumber
        };
    }

    // Structure start
    const structMatch = line.match(/^Structure\s+(\w+)/i);
    if (structMatch) {
        return {
            type: ScopeType.Structure,
            name: structMatch[1],
            startLine: lineNumber
        };
    }

    // If start
    if (line.match(/^If\b/i)) {
        return {
            type: ScopeType.If,
            startLine: lineNumber
        };
    }

    // For start
    const forMatch = line.match(/^For\s+/i);
    if (forMatch) {
        return {
            type: ScopeType.For,
            startLine: lineNumber
        };
    }

    // While start
    if (line.match(/^While\b/i)) {
        return {
            type: ScopeType.While,
            startLine: lineNumber
        };
    }

    // Repeat start
    if (line.match(/^Repeat\b/i)) {
        return {
            type: ScopeType.Repeat,
            startLine: lineNumber
        };
    }

    // Select start
    if (line.match(/^Select\b/i)) {
        return {
            type: ScopeType.Select,
            startLine: lineNumber
        };
    }

    return null;
}

/**
 * Detect scope end
 */
function detectScopeEnd(line: string, scopeStack: ScopeInfo[]): boolean {
    const currentScope = scopeStack[scopeStack.length - 1];
    if (!currentScope) return false;

    switch (currentScope.type) {
        case ScopeType.Procedure:
            return line.match(/^EndProcedure\b/i) !== null;
        case ScopeType.Module:
            return line.match(/^EndModule\b/i) !== null;
        case ScopeType.Structure:
            return line.match(/^EndStructure\b/i) !== null;
        case ScopeType.If:
            return line.match(/^EndIf\b/i) !== null;
        case ScopeType.For:
            return line.match(/^Next\b/i) !== null;
        case ScopeType.While:
            return line.match(/^Wend\b/i) !== null;
        case ScopeType.Repeat:
            return line.match(/^Until\b/i) !== null;
        case ScopeType.Select:
            return line.match(/^EndSelect\b/i) !== null;
        default:
            return false;
    }
}

/**
 * Parse variable definitions in a line
 */
function parseVariablesInLine(line: string, lineNumber: number, currentScope: ScopeInfo): VariableInfo[] {
    const variables: VariableInfo[] = [];

    // Match variable definition patterns
    const patterns = [
        // Global, Protected, Static, Define, Shared, Threaded variables
        /^(Global|Protected|Static|Define|Shared|Threaded)\s+(\*?)(\w+)(?:\.(\w+))?(?:\(([^)]*)\))?/i,
        // Dim array
        /^Dim\s+(\w+)(?:\.(\w+))?(?:\(([^)]*)\))?/i,
        // NewList declaration
        /^(Global|Protected|Static|Define)?\s*NewList\s+(\w+)(?:\.(\w+))?/i,
        // NewMap declaration
        /^(Global|Protected|Static|Define)?\s*NewMap\s+(\w+)(?:\.(\w+))?/i,
        // Local variable (simple variable declaration in procedure)
        /^(\w+)(?:\.(\w+))?\s*=/i
    ];

    for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
            let variableName: string;
            let variableType: string = 'unknown';
            let isGlobal = false;
            let isProtected = false;
            let isStatic = false;

            if (pattern === patterns[0]) { // Global/Protected/Static等
                const modifier = match[1];
                const isPointer = match[2] === '*';
                variableName = match[3];
                variableType = match[4] || 'i';
                const arraySize = match[5];

                isGlobal = modifier?.toLowerCase() === 'global';
                isProtected = modifier?.toLowerCase() === 'protected';
                isStatic = modifier?.toLowerCase() === 'static';

                if (arraySize) {
                    variableType = `${variableType}[] (array)`;
                } else if (isPointer) {
                    variableType = `*${variableType} (pointer)`;
                }
            } else if (pattern === patterns[1]) { // Dim
                variableName = match[1];
                variableType = match[2] || 'i';
                const arraySize = match[3];
                if (arraySize) {
                    variableType = `${variableType}[] (array)`;
                }
            } else if (pattern === patterns[2]) { // NewList
                const modifier = match[1];
                variableName = match[2];
                variableType = `${match[3] || 'unknown'} (list)`;
                isGlobal = modifier?.toLowerCase() === 'global';
                isProtected = modifier?.toLowerCase() === 'protected';
                isStatic = modifier?.toLowerCase() === 'static';
            } else if (pattern === patterns[3]) { // NewMap
                const modifier = match[1];
                variableName = match[2];
                variableType = `${match[3] || 'unknown'} (map)`;
                isGlobal = modifier?.toLowerCase() === 'global';
                isProtected = modifier?.toLowerCase() === 'protected';
                isStatic = modifier?.toLowerCase() === 'static';
            } else if (pattern === patterns[4]) { // 局部变量赋值
                variableName = match[1];
                variableType = match[2] || 'i';
                // 只有在过程作用域内才考虑局部变量
                if (currentScope.type !== ScopeType.Procedure) {
                    continue;
                }
            } else {
                continue;
            }

            variables.push({
                name: variableName,
                type: variableType,
                scope: currentScope,
                definitionLine: lineNumber,
                isGlobal,
                isProtected,
                isStatic,
                isParameter: false
            });
        }
    }

    return variables;
}

/**
 * Parse procedure parameters
 */
function parseParameters(paramString: string, lineNumber: number, currentScope: ScopeInfo): VariableInfo[] {
    const parameters: VariableInfo[] = [];

    if (!paramString.trim()) {
        return parameters;
    }

    const params = paramString.split(',');
    for (const param of params) {
        const trimmedParam = param.trim();
        const paramMatch = trimmedParam.match(/^(\*?)(\w+)(?:\.(\w+))?/);

        if (paramMatch) {
            const isPointer = paramMatch[1] === '*';
            const paramName = paramMatch[2];
            const paramType = paramMatch[3] || 'unknown';

            let finalType = paramType;
            if (isPointer) {
                finalType = `*${paramType} (pointer)`;
            }

            parameters.push({
                name: paramName,
                type: finalType,
                scope: currentScope,
                definitionLine: lineNumber,
                isGlobal: false,
                isProtected: false,
                isStatic: false,
                isParameter: true
            });
        }
    }

    return parameters;
}

/**
 * Find scope at specified line
 */
function findScopeAtLine(scopes: ScopeInfo[], lineNumber: number): ScopeInfo {
    let currentScope = scopes[0]; // Default to global scope

    for (const scope of scopes) {
        if (scope.startLine <= lineNumber &&
            (scope.endLine === undefined || scope.endLine >= lineNumber)) {
            // Select the most specific scope (deepest nested)
            if (scope.startLine >= currentScope.startLine) {
                currentScope = scope;
            }
        }
    }

    return currentScope;
}

/**
 * Get available variables visible in current scope
 */
function getAvailableVariables(allVariables: VariableInfo[], currentScope: ScopeInfo, currentLine: number): VariableInfo[] {
    const availableVariables: VariableInfo[] = [];

    for (const variable of allVariables) {
        // Variable must be defined before current line
        if (variable.definitionLine >= currentLine) {
            continue;
        }

        // Global variables are always visible
        if (variable.isGlobal) {
            availableVariables.push(variable);
            continue;
        }

        // Check if variable is visible in current scope or parent scope
        if (isVariableVisibleInScope(variable, currentScope)) {
            availableVariables.push(variable);
        }
    }

    return availableVariables;
}

/**
 * Check if variable is visible in specified scope
 */
function isVariableVisibleInScope(variable: VariableInfo, targetScope: ScopeInfo): boolean {
    // Global variables are always visible
    if (variable.isGlobal) {
        return true;
    }

    // Protected variables are visible within module
    if (variable.isProtected && variable.scope.type === ScopeType.Module) {
        // Check if target scope is within the same module
        let checkScope: ScopeInfo | undefined = targetScope;
        while (checkScope) {
            if (checkScope.type === ScopeType.Module &&
                checkScope.name === variable.scope.name) {
                return true;
            }
            checkScope = checkScope.parentScope;
        }
        return false;
    }

    // Static variables are visible within the procedure they are declared
    if (variable.isStatic && variable.scope.type === ScopeType.Procedure) {
        // Check if target scope is the same procedure or its sub-scope
        let checkScope: ScopeInfo | undefined = targetScope;
        while (checkScope) {
            if (checkScope.type === ScopeType.Procedure &&
                checkScope.name === variable.scope.name) {
                return true;
            }
            checkScope = checkScope.parentScope;
        }
        return false;
    }

    // Regular local variables are only visible in their declared scope or sub-scopes
    let checkScope: ScopeInfo | undefined = targetScope;
    while (checkScope) {
        if (checkScope === variable.scope) {
            return true;
        }
        checkScope = checkScope.parentScope;
    }

    return false;
}

/**
 * Scan to current line, return list of currently active UseModule modules
 * - UseModule X makes X's exports visible in subsequent code until canceled by UnuseModule X or file end
 * - Simplified processing: does not consider conditional compilation and macros, only processes UseModule/UnuseModule in line order
 */
export function getActiveUsedModules(text: string, currentLine: number): string[] {
    const lines = text.split(/\r?\n/);
    const used = new Set<string>();

    const max = Math.min(currentLine, lines.length - 1);
    for (let i = 0; i <= max; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith(';') || trimmed === '') continue;

        const useMatch = trimmed.match(/^UseModule\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
        if (useMatch) {
            used.add(useMatch[1]);
            continue;
        }

        const unuseMatch = trimmed.match(/^UnuseModule\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
        if (unuseMatch) {
            used.delete(unuseMatch[1]);
            continue;
        }
    }

    return Array.from(used);
}
