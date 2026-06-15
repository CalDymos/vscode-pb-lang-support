/**
 * Helpers for PureBasic compiler standby protocol command serialization.
 */

import { COMPILER_STANDBY_TAB, type CompilerStandbyCommand } from './compiler-standby-types';

/**
 * Serializes a standby command into the tab-separated line format expected by
 * pbcompiler. The returned string intentionally has no trailing newline.
 */
export function serializeCompilerStandbyCommand(command: CompilerStandbyCommand): string {
    const args = command.args ?? [];
    if (args.length === 0) {
        return command.name;
    }
    return [command.name, ...args].join(COMPILER_STANDBY_TAB);
}

/**
 * Normalizes compiler output into logical protocol lines.
 */
export function splitCompilerStandbyOutput(output: string): string[] {
    return output
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .filter((line, index, lines) => line.length > 0 || index < lines.length - 1);
}

/**
 * Returns true when the collected response lines contain a complete compiler
 * result for one COMPILE command. Warning blocks are not terminal and must be
 * followed by SUCCESS or an error block.
 */
export function isCompilerStandbyResponseComplete(lines: readonly string[]): boolean {
    if (lines.some((line) => line === 'SUCCESS')) {
        return true;
    }

    const firstErrorIndex = lines.findIndex((line) => line.startsWith('ERROR\t'));
    if (firstErrorIndex < 0) {
        return false;
    }

    return lines.slice(firstErrorIndex + 1).some((line) => line === 'OUTPUT\tCOMPLETE');
}
