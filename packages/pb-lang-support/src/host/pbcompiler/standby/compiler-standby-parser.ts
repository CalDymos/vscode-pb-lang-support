/**
 * Parser for PureBasic compiler standby protocol responses.
 *
 * The parser follows the response grouping used by the PureBasic IDE:
 * warnings, syntax errors and non-syntax compiler errors are block responses
 * terminated by OUTPUT<TAB>COMPLETE.
 */

import {
    COMPILER_STANDBY_OUTPUT_COMPLETE,
    COMPILER_STANDBY_TAB,
    type CompilerStandbyCompilerError,
    type CompilerStandbyEvent,
    type CompilerStandbyMacroInfo,
    type CompilerStandbyParseResult,
    type CompilerStandbyProgressEvent,
    type CompilerStandbySourceLocation,
    type CompilerStandbySyntaxError,
    type CompilerStandbyTerminalResult,
    type CompilerStandbyWarning,
} from './compiler-standby-types';

const MESSAGE_PREFIX = `MESSAGE${COMPILER_STANDBY_TAB}`;
const INCLUDEFILE_PREFIX = `INCLUDEFILE${COMPILER_STANDBY_TAB}`;
const MACRO_PREFIX = `MACRO${COMPILER_STANDBY_TAB}`;
const PROGRESS_PREFIX = `PROGRESS${COMPILER_STANDBY_TAB}`;
const WARNING_PREFIX = `WARNING${COMPILER_STANDBY_TAB}`;
const ERROR_PREFIX = `ERROR${COMPILER_STANDBY_TAB}`;
const SYNTAX_ERROR_PREFIX = `ERROR${COMPILER_STANDBY_TAB}SYNTAX${COMPILER_STANDBY_TAB}`;

export function parseCompilerStandbyLines(lines: readonly string[]): CompilerStandbyParseResult {
    const events: CompilerStandbyEvent[] = [];
    const warnings: CompilerStandbyWarning[] = [];
    let terminal: CompilerStandbyTerminalResult | undefined;
    let index = 0;

    while (index < lines.length) {
        const line = lines[index] ?? '';

        if (line.startsWith(PROGRESS_PREFIX)) {
            events.push(parseProgressLine(line));
            index += 1;
            continue;
        }

        if (line.startsWith(WARNING_PREFIX)) {
            const parsed = parseWarningBlock(lines, index);
            warnings.push(parsed.warning);
            events.push(parsed.warning);
            index = parsed.nextIndex;
            continue;
        }

        if (line === 'SUCCESS') {
            terminal = { kind: 'success', rawLine: line };
            index += 1;
            continue;
        }

        if (line.startsWith(SYNTAX_ERROR_PREFIX)) {
            const parsed = parseSyntaxErrorBlock(lines, index);
            terminal = parsed.error;
            index = parsed.nextIndex;
            continue;
        }

        if (line.startsWith(ERROR_PREFIX)) {
            const parsed = parseCompilerErrorBlock(lines, index);
            terminal = parsed.error;
            index = parsed.nextIndex;
            continue;
        }

        if (line === COMPILER_STANDBY_OUTPUT_COMPLETE) {
            index += 1;
            continue;
        }

        events.push({ kind: 'unknown', rawLine: line });
        index += 1;
    }

    return {
        events,
        warnings,
        terminal,
        rawLines: [...lines],
    };
}

function parseProgressLine(line: string): CompilerStandbyProgressEvent {
    const fields = splitFields(line);
    return {
        kind: 'progress',
        progressKind: fields[1] ?? '',
        fields: fields.slice(2),
        rawLine: line,
    };
}

function parseWarningBlock(lines: readonly string[], startIndex: number): { warning: CompilerStandbyWarning; nextIndex: number } {
    const rawLines: string[] = [];
    const firstLine = lines[startIndex] ?? '';
    rawLines.push(firstLine);

    const firstFields = splitFields(firstLine);
    const location: CompilerStandbySourceLocation = {
        line: parseCompilerLineNumber(firstFields[1]),
    };
    let message = '';
    let index = startIndex + 1;

    while (index < lines.length) {
        const line = lines[index] ?? '';
        rawLines.push(line);
        index += 1;

        if (line === COMPILER_STANDBY_OUTPUT_COMPLETE) {
            break;
        }

        if (line.startsWith(MESSAGE_PREFIX)) {
            message = readPayload(line, MESSAGE_PREFIX);
            continue;
        }

        if (line.startsWith(INCLUDEFILE_PREFIX)) {
            const includeLocation = parseIncludeFileLine(line);
            location.file = includeLocation.file;
            location.line = includeLocation.line;
        }
    }

    return {
        warning: {
            kind: 'warning',
            location,
            message,
            rawLines,
        },
        nextIndex: index,
    };
}

function parseSyntaxErrorBlock(lines: readonly string[], startIndex: number): { error: CompilerStandbySyntaxError; nextIndex: number } {
    const rawLines: string[] = [];
    const firstLine = lines[startIndex] ?? '';
    rawLines.push(firstLine);

    const firstFields = splitFields(firstLine);
    let message = '';
    let includeLocation: CompilerStandbySourceLocation | undefined;
    let macro: CompilerStandbyMacroInfo | undefined;
    let index = startIndex + 1;

    while (index < lines.length) {
        const line = lines[index] ?? '';
        rawLines.push(line);
        index += 1;

        if (line === COMPILER_STANDBY_OUTPUT_COMPLETE) {
            break;
        }

        if (line.startsWith(MESSAGE_PREFIX)) {
            message = readPayload(line, MESSAGE_PREFIX);
            continue;
        }

        if (line.startsWith(INCLUDEFILE_PREFIX)) {
            includeLocation = parseIncludeFileLine(line);
            continue;
        }

        if (line.startsWith(MACRO_PREFIX)) {
            const parsed = parseMacroBlock(lines, index - 1);
            macro = parsed.macro;
            for (const rawLine of parsed.macro.rawLines.slice(1)) {
                rawLines.push(rawLine);
            }
            index = parsed.nextIndex;
        }
    }

    const error: CompilerStandbySyntaxError = {
        kind: 'syntaxError',
        line: parseCompilerLineNumber(firstFields[2]),
        includeLocation,
        message,
        macro,
        rawLines,
    };

    return { error, nextIndex: index };
}

function parseMacroBlock(lines: readonly string[], startIndex: number): { macro: CompilerStandbyMacroInfo; nextIndex: number } {
    const rawLines: string[] = [];
    const macroLines: string[] = [];
    const firstLine = lines[startIndex] ?? '';
    rawLines.push(firstLine);

    const firstFields = splitFields(firstLine);
    const line = parseCompilerLineNumber(firstFields[1]);
    const expectedLineCount = parseCompilerLineNumber(firstFields[2]);
    let index = startIndex + 1;

    while (index < lines.length) {
        const currentLine = lines[index] ?? '';
        rawLines.push(currentLine);
        index += 1;

        if (currentLine === COMPILER_STANDBY_OUTPUT_COMPLETE) {
            break;
        }

        if (currentLine === `MACRO${COMPILER_STANDBY_TAB}COMPLETE`) {
            break;
        }

        macroLines.push(currentLine);
        if (expectedLineCount !== undefined && macroLines.length >= expectedLineCount) {
            const possibleComplete = lines[index] ?? '';
            if (possibleComplete === `MACRO${COMPILER_STANDBY_TAB}COMPLETE`) {
                rawLines.push(possibleComplete);
                index += 1;
            }
            break;
        }
    }

    return {
        macro: {
            line,
            expectedLineCount,
            lines: macroLines,
            rawLines,
        },
        nextIndex: index,
    };
}

function parseCompilerErrorBlock(lines: readonly string[], startIndex: number): { error: CompilerStandbyCompilerError; nextIndex: number } {
    const rawLines: string[] = [];
    const firstLine = lines[startIndex] ?? '';
    rawLines.push(firstLine);

    const firstFields = splitFields(firstLine);
    const details: string[] = [];
    let message = '';
    let index = startIndex + 1;

    while (index < lines.length) {
        const line = lines[index] ?? '';
        rawLines.push(line);
        index += 1;

        if (line === COMPILER_STANDBY_OUTPUT_COMPLETE) {
            break;
        }

        if (line.startsWith(MESSAGE_PREFIX)) {
            message = readPayload(line, MESSAGE_PREFIX);
        } else {
            details.push(line);
        }
    }

    const detailMessage = details.join('\n');
    const error: CompilerStandbyCompilerError = {
        kind: 'compilerError',
        errorType: firstFields[1] ?? '',
        message: message || detailMessage,
        details,
        rawLines,
    };

    return { error, nextIndex: index };
}

function parseIncludeFileLine(line: string): CompilerStandbySourceLocation {
    const fields = splitFields(line);
    return {
        file: fields[1],
        line: parseCompilerLineNumber(fields[2]),
    };
}

function parseCompilerLineNumber(value: string | undefined): number | undefined {
    if (value === undefined || value.trim() === '') {
        return undefined;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function splitFields(line: string): string[] {
    return line.split(COMPILER_STANDBY_TAB);
}

function readPayload(line: string, prefix: string): string {
    return line.slice(prefix.length);
}
