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
