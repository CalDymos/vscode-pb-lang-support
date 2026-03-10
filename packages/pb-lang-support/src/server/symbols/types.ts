/**
 * Symbol-related type definitions
 */

export interface PureBasicSymbol {
    name: string;
    kind: SymbolKind;
    range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
    detail?: string;
    documentation?: string;
    module?: string; // Associated module name
    isPublic?: boolean; // Whether it is a public symbol
    parameters?: string[]; // Parameter list
    returnType?: string; // Return type
}

export enum SymbolKind {
    Procedure = 'procedure',
    Variable = 'variable',
    Constant = 'constant',
    Structure = 'structure',
    Module = 'module',
    Interface = 'interface',
    Enumeration = 'enumeration',
    Function = 'function',
    Keyword = 'keyword',
    Operator = 'operator',
    Parameter = 'parameter'
}