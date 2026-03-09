/**
 * PureBasic language constants definition
 * Contains keywords, built-in types, built-in functions, etc.
 */

/**
 * PureBasic keyword list (structural / flow-control keywords that are not
 * in pb-builtin-functions.json because they are language constructs, not
 * callable functions).
 * 
 * Single source of truth for keyword names and documentation.
 *
 * Consumers that only need names use the derived `keywords` array below.
 * Consumers that need descriptions (e.g. symbol-extractor) import 'pbKeywordDefinitions' directly.
 */
export const pbKeywordDefinitions: ReadonlyArray<{ name: string; documentation: string }> = [
    { name: 'If',                documentation: 'Conditional statement' },
    { name: 'Else',              documentation: 'Else branch' },
    { name: 'ElseIf',            documentation: 'Else-if branch' },
    { name: 'EndIf',             documentation: 'End of If block' },
    { name: 'For',               documentation: 'For … Next loop' },
    { name: 'ForEach',           documentation: 'ForEach … Next loop (linked list / map)' },
    { name: 'Next',              documentation: 'End of For / ForEach loop' },
    { name: 'While',             documentation: 'While … Wend loop' },
    { name: 'Wend',              documentation: 'End of While loop' },
    { name: 'Repeat',            documentation: 'Repeat … Until loop' },
    { name: 'Until',             documentation: 'Condition that ends Repeat loop' },
    { name: 'ForEver',           documentation: 'Infinite loop (use Break to exit)' },
    { name: 'Break',             documentation: 'Exit the innermost loop' },
    { name: 'Continue',          documentation: 'Skip to next loop iteration' },
    { name: 'Select',            documentation: 'Select … EndSelect multi-branch' },
    { name: 'Case',              documentation: 'Case branch inside Select' },
    { name: 'Default',           documentation: 'Default branch inside Select' },
    { name: 'EndSelect',         documentation: 'End of Select block' },
    { name: 'With',              documentation: 'With … EndWith shorthand for structure access' },
    { name: 'EndWith',           documentation: 'End of With block' },
    { name: 'Procedure',         documentation: 'Define a procedure' },
    { name: 'ProcedureC',        documentation: 'Define a C-calling-convention procedure' },
    { name: 'ProcedureDLL',      documentation: 'Define a DLL-exported procedure' },
    { name: 'ProcedureCDLL',     documentation: 'Define a C-calling-convention DLL procedure' },
    { name: 'EndProcedure',      documentation: 'End of Procedure block' },
    { name: 'ProcedureReturn',   documentation: 'Return a value from a procedure' },
    { name: 'Declare',           documentation: 'Forward-declare a procedure' },
    { name: 'DeclareC',          documentation: 'Forward-declare a C-convention procedure' },
    { name: 'DeclareDLL',        documentation: 'Forward-declare a DLL procedure' },
    { name: 'DeclareCDLL',       documentation: 'Forward-declare a C-convention DLL procedure' },
    { name: 'Macro',             documentation: 'Define a macro' },
    { name: 'EndMacro',          documentation: 'End of Macro block' },
    { name: 'Prototype',         documentation: 'Define a function pointer prototype' },
    { name: 'PrototypeC',        documentation: 'Define a C-convention function pointer prototype' },
    { name: 'Structure',         documentation: 'Define a structure' },
    { name: 'EndStructure',      documentation: 'End of Structure block' },
    { name: 'StructureUnion',    documentation: 'Union inside a Structure' },
    { name: 'EndStructureUnion', documentation: 'End of StructureUnion block' },
    { name: 'Interface',         documentation: 'Define an OOP interface' },
    { name: 'EndInterface',      documentation: 'End of Interface block' },
    { name: 'Enumeration',       documentation: 'Define an enumeration' },
    { name: 'EnumerationBinary', documentation: 'Define a binary (power-of-two) enumeration' },
    { name: 'EndEnumeration',    documentation: 'End of Enumeration block' },
    { name: 'DeclareModule',     documentation: 'Declare the public interface of a module' },
    { name: 'EndDeclareModule',  documentation: 'End of DeclareModule block' },
    { name: 'Module',            documentation: 'Define a module implementation' },
    { name: 'EndModule',         documentation: 'End of Module block' },
    { name: 'UseModule',         documentation: 'Import module symbols into the current scope' },
    { name: 'UnuseModule',       documentation: 'Remove module symbols from the current scope' },
    { name: 'Global',            documentation: 'Declare a global variable' },
    { name: 'Protected',         documentation: 'Declare a procedure-local variable' },
    { name: 'Static',            documentation: 'Declare a static (persistent) local variable' },
    { name: 'Shared',            documentation: 'Share a global variable inside a procedure' },
    { name: 'Threaded',          documentation: 'Declare a thread-local variable' },
    { name: 'Define',            documentation: 'Define the default type for untyped variables' },
    { name: 'Dim',               documentation: 'Declare an array' },
    { name: 'ReDim',             documentation: 'Resize an existing array' },
    { name: 'NewList',           documentation: 'Declare a linked list' },
    { name: 'NewMap',            documentation: 'Declare a map (hash table)' },
    { name: 'DataSection',       documentation: 'Start a data section' },
    { name: 'EndDataSection',    documentation: 'End of DataSection block' },
    { name: 'Data',              documentation: 'Inline data values' },
    { name: 'Read',              documentation: 'Read the next Data value into a variable' },
    { name: 'Restore',           documentation: 'Reset the Data read pointer to a label' },
    { name: 'Goto',              documentation: 'Unconditional jump to a label' },
    { name: 'Gosub',             documentation: 'Call a subroutine label' },
    { name: 'Return',            documentation: 'Return from a Gosub subroutine' },
    { name: 'End',               documentation: 'Terminate the program' },
    { name: 'Import',            documentation: 'Import symbols from an external library' },
    { name: 'EndImport',         documentation: 'End of Import block' },
    { name: 'ImportC',           documentation: 'Import C-convention symbols from an external library' },
    { name: 'IncludeFile',       documentation: 'Include a source file at compile time' },
    { name: 'XIncludeFile',      documentation: 'Include a source file only once' },
    { name: 'IncludePath',       documentation: 'Add a directory to the include search path' },
    { name: 'CompilerIf',        documentation: 'Conditional compilation – if' },
    { name: 'CompilerElse',      documentation: 'Conditional compilation – else' },
    { name: 'CompilerElseIf',    documentation: 'Conditional compilation – else if' },
    { name: 'CompilerEndIf',     documentation: 'End of CompilerIf block' },
    { name: 'CompilerSelect',    documentation: 'Conditional compilation – select' },
    { name: 'CompilerCase',      documentation: 'Conditional compilation – case' },
    { name: 'CompilerDefault',   documentation: 'Conditional compilation – default' },
    { name: 'CompilerEndSelect', documentation: 'End of CompilerSelect block' },
    { name: 'CompilerError',     documentation: 'Emit a compile-time error message' },
    { name: 'CompilerWarning',   documentation: 'Emit a compile-time warning message' },
    { name: 'Debug',             documentation: 'Output a debug message (statement, not a function)' },
    { name: 'EnableExplicit',    documentation: 'Require all variables to be declared before use' },
    { name: 'DisableExplicit',   documentation: 'Allow implicit variable declarations' },
    { name: 'EnableASM',         documentation: 'Allow inline assembler' },
    { name: 'DisableASM',        documentation: 'Disallow inline assembler' },
    { name: 'Align',             documentation: 'Structure alignment modifier' },
    { name: 'And',               documentation: 'Logical/bitwise AND keyword' },
    { name: 'Array',             documentation: 'Array keyword for parameters / structure fields' },
    { name: 'As',                documentation: 'Rename imported symbol / alias in declarations' },
    { name: 'CallDebugger',      documentation: 'Invoke the debugger immediately' },
    { name: 'DebugLevel',        documentation: 'Set the current debug output level' },
    { name: 'DisableDebugger',   documentation: 'Disable debugger checks for following code' },
    { name: 'DisablePureLibrary',documentation: 'Disable a PureLibrary for this program' },
    { name: 'EnableDebugger',    documentation: 'Enable debugger checks for following code' },
    { name: 'EndHeaderSection',  documentation: 'End of HeaderSection block' },
    { name: 'Extends',           documentation: 'Extend a structure or interface' },
    { name: 'FakeReturn',        documentation: 'Simulate Return when leaving a Gosub via Goto' },
    { name: 'HeaderSection',     documentation: 'Insert C/ASM code outside main()' },
    { name: 'IncludeBinary',     documentation: 'Include binary data at compile time' },
    { name: 'List',              documentation: 'List keyword for parameters / structure fields' },
    { name: 'MacroExpandedCount',documentation: 'Macro expansion counter' },
    { name: 'Map',               documentation: 'Map keyword for parameters / structure fields' },
    { name: 'Not',               documentation: 'Logical/bitwise NOT keyword' },
    { name: 'Or',                documentation: 'Logical/bitwise OR keyword' },
    { name: 'Runtime',           documentation: 'Expose objects to runtime lookup' },
    { name: 'Step',              documentation: 'Step value in For / Enumeration' },
    { name: 'Swap',              documentation: 'Swap two variables or elements' },
    { name: 'To',                documentation: 'Upper bound / range keyword' },
    { name: 'UndefineMacro',     documentation: 'Remove a previously defined macro' },
    { name: 'XOr',               documentation: 'Logical/bitwise XOR keyword' },
];

/** Flat name-only list derived from PB_KEYWORDS – for consumers that only need names. */
export const keywords: readonly string[] = pbKeywordDefinitions.map(keyword => keyword.name);

export const builtInFunctions = [
    'OpenWindow', 'CreateGadgetList', 'EventWindow', 'EventGadget', 'EventMenu',
    'WaitWindowEvent', 'WindowEvent', 'SetActiveWindow', 'CloseWindow', 'WindowID',
    'WindowOutput', 'WindowX', 'WindowY', 'WindowWidth', 'WindowHeight',
    'DesktopWidth', 'DesktopHeight', 'DesktopDepth', 'DesktopFrequency', 'Delay',
    'CountProgramParameters', 'ProgramParameter', 'RunProgram', 'OpenFile',
    'ReadFile', 'WriteFile', 'CloseFile', 'FileSeek', 'FileSize', 'Eof',
    'ReadString', 'WriteString', 'ReadCharacter', 'WriteCharacter', 'ReadByte',
    'WriteByte', 'ReadWord', 'WriteWord', 'ReadLong', 'WriteLong', 'ReadQuad',
    'WriteQuad', 'ReadFloat', 'WriteFloat', 'ReadDouble', 'WriteDouble',
    'CreateDirectory', 'DeleteFile', 'CopyFile', 'RenameFile', 'DirectoryEntry',
    'DirectoryEntryType', 'DirectoryEntryName', 'DirectoryEntrySize',
    'DirectoryEntryDate', 'DirectoryEntryAttributes', 'NextDirectoryEntry',
    'FinishDirectory', 'ExamineDirectory', 'SetCurrentDirectory',
    'GetCurrentDirectory', 'CreateFile', 'FileBuffers', 'FileID', 'FileError',
    'MessageRequester', 'InputRequester', 'OpenFileRequester', 'SaveFileRequester',
    'PathRequester', 'ColorRequester', 'FontRequester'
];

// Minimal fallback list of common Windows API functions.
// Used for completions when APIFunctionListing.txt is not configured or unavailable.
export const windowsApiFunctions = [
    'MessageBox_', 'GetWindowText_', 'SetWindowText_', 'FindWindow_',
    'GetDesktopWindow_', 'GetForegroundWindow_', 'SetForegroundWindow_',
    'ShowWindow_', 'MoveWindow_', 'GetWindowRect_', 'SetWindowPos_',
    'CreateFile_', 'ReadFile_', 'WriteFile_', 'CloseHandle_',
    'GetCurrentDirectory_', 'SetCurrentDirectory_', 'CreateDirectory_',
    'DeleteFile_', 'CopyFile_', 'MoveFile_', 'FindFirstFile_', 'FindNextFile_',
    'RegOpenKeyEx_', 'RegQueryValueEx_', 'RegSetValueEx_', 'RegCloseKey_'
];

export const types = [
    'Integer', 'Long', 'Word', 'Byte', 'Character', 'String', 
    'Float', 'Double', 'Quad', 'Ascii', 'Unicode'
];

/**
 * PureBasic type suffixes with documentation.
 * Single source of truth — consumers that only need names use the derived
 * `typeSuffixes` array below.
 */
export const typeSuffixDefinitions: ReadonlyArray<{ name: string; documentation: string }> = [
    { name: 'i', documentation: 'Integer – platform-native integer (4 or 8 bytes)' },
    { name: 'l', documentation: 'Long – 32-bit signed integer' },
    { name: 'w', documentation: 'Word – 16-bit signed integer' },
    { name: 'b', documentation: 'Byte – 8-bit signed integer' },
    { name: 'c', documentation: 'Character – Unicode character (2 bytes)' },
    { name: 's', documentation: 'String – string reference' },
    { name: 'f', documentation: 'Float – 32-bit floating-point' },
    { name: 'd', documentation: 'Double – 64-bit floating-point' },
    { name: 'q', documentation: 'Quad – 64-bit signed integer' },
    { name: 'a', documentation: 'Ascii – 8-bit ASCII character' },
    { name: 'u', documentation: 'Unicode – 16-bit Unicode character' },
];

/** Flat name-only list derived from typeSuffixDefinitions. */
export const typeSuffixes: readonly string[] = typeSuffixDefinitions.map(s => s.name);

const pureBasicConstantNamePattern = '[a-zA-Z_][a-zA-Z0-9_]*\\$?';
// NOTE: This regex captures the full value including inline comments e.g. (42 ; comment).
// Use stripInlineComment() from utils/string-utils.ts to strip comments from the returned value.
const pureBasicConstantDefinitionRegex = new RegExp(`^#(${pureBasicConstantNamePattern})\\s*=\\s*(.*)$`, 'i');
const pureBasicConstantDeclarationRegex = new RegExp(`^#(${pureBasicConstantNamePattern})(?:\\s*=\\s*(.*))?$`, 'i');

export interface ParsedPureBasicConstant {
    name: string;
    value?: string;
}

export function parsePureBasicConstantDefinition(line: string): ParsedPureBasicConstant | null {
    const match = line.trim().match(pureBasicConstantDefinitionRegex);
    if (!match) {
        return null;
    }

    return {
        name: match[1],
        value: match[2]?.trim()
    };
}

export function parsePureBasicConstantDeclaration(line: string): ParsedPureBasicConstant | null {
    const match = line.trim().match(pureBasicConstantDeclarationRegex);
    if (!match) {
        return null;
    }

    return {
        name: match[1],
        value: match[2]
    };
}

/**
 * Check if a valid PureBasic type
 */
export function isValidType(type: string): boolean {
    const lowerType = type.toLowerCase();

    // Check basic types
    if (types.some(t => t.toLowerCase() === lowerType)) {
        return true;
    }

    // Check type suffixes (such as .i, .s, etc.)
    if (typeSuffixes.includes(lowerType)) {
        return true;
    }

    // Check custom type pattern (start with letters or underscores, contain letters, numbers, and underscores)
    // Support: MyType, _PrivateType, CONSTANT_TYPE, camelCase, snake_case, etc.
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(type)) {
        return true;
    }

    return false;
}