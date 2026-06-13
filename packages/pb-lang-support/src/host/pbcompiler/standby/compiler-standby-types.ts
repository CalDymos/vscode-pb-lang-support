/**
 * Shared types for the PureBasic compiler standby protocol.
 *
 * The standby compiler uses line-based tab-separated text messages. These
 * types intentionally do not depend on VS Code so the parser can be tested
 * without the extension host.
 */

export const COMPILER_STANDBY_TAB = '\t';
export const COMPILER_STANDBY_OUTPUT_COMPLETE = 'OUTPUT\tCOMPLETE';

export type CompilerStandbyProgressKind =
    | 'CREATINGAPP'
    | 'DOWNLOADINGTEMPLATE'
    | 'DEPLOYINGAPP'
    | 'CORDOVALINE'
    | 'LINES'
    | 'INCLUDES'
    | 'ASSEMBLING'
    | 'LINKING'
    | string;

export type CompilerStandbyDiagnosticKind = 'warning' | 'syntaxError';

export interface CompilerStandbySourceLocation {
    /** File path as reported by the compiler. It may be relative to the compile source. */
    file?: string;
    /** Compiler line number. PureBasic reports 1-based lines and may use -1 for no line. */
    line?: number;
}

export interface CompilerStandbyProgressEvent {
    kind: 'progress';
    progressKind: CompilerStandbyProgressKind;
    fields: string[];
    rawLine: string;
}

export interface CompilerStandbyWarning {
    kind: 'warning';
    location: CompilerStandbySourceLocation;
    message: string;
    rawLines: string[];
}

export interface CompilerStandbyMacroInfo {
    /** Line in the expanded macro block as reported by the compiler. */
    line?: number;
    /** Number of following macro source lines announced by the compiler. */
    expectedLineCount?: number;
    /** Macro source lines returned by the compiler. */
    lines: string[];
    rawLines: string[];
}

export interface CompilerStandbySyntaxError {
    kind: 'syntaxError';
    /** Main source line from ERROR<TAB>SYNTAX<TAB>line. */
    line?: number;
    /** Include location, if the compiler reports an INCLUDEFILE block. */
    includeLocation?: CompilerStandbySourceLocation;
    message: string;
    macro?: CompilerStandbyMacroInfo;
    rawLines: string[];
}

export type CompilerStandbyCompilerErrorType =
    | 'ASSEMBLER'
    | 'LINKER'
    | 'RESOURCE'
    | 'SUBSYSTEM'
    | string;

export interface CompilerStandbyCompilerError {
    kind: 'compilerError';
    errorType: CompilerStandbyCompilerErrorType;
    message: string;
    details: string[];
    rawLines: string[];
}

export interface CompilerStandbyUnknownLineEvent {
    kind: 'unknown';
    rawLine: string;
}

export interface CompilerStandbySuccess {
    kind: 'success';
    rawLine: string;
}

export type CompilerStandbyTerminalResult =
    | CompilerStandbySuccess
    | CompilerStandbySyntaxError
    | CompilerStandbyCompilerError;

export type CompilerStandbyEvent =
    | CompilerStandbyProgressEvent
    | CompilerStandbyWarning
    | CompilerStandbyUnknownLineEvent;

export interface CompilerStandbyParseResult {
    events: CompilerStandbyEvent[];
    warnings: CompilerStandbyWarning[];
    terminal?: CompilerStandbyTerminalResult;
    rawLines: string[];
}

export type CompilerStandbyCommandName =
    | 'SOURCE'
    | 'TARGET'
    | 'INCLUDEPATH'
    | 'SOURCEALIAS'
    | 'CONSTANT'
    | 'RESOURCE'
    | 'ICON'
    | 'LINKER'
    | 'COMPILE'
    | 'END'
    | string;

export interface CompilerStandbyCommand {
    name: CompilerStandbyCommandName;
    args?: string[];
}
