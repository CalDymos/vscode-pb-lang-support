/**
 * Shared access layer for pb-builtin-functions.json.
 *
 * Three consumers currently use this data:
 *   - hover-provider     (Hover / Markdown display)
 *   - signature-provider (SignatureHelp / ParameterInformation)
 *   - symbol-extractor   (Completion / PureBasicSymbol)
 *
 * This module is the single source of truth so that all providers
 * stay in sync with the JSON without duplicating import boilerplate
 * or maintaining separate hardcoded lists.
 */

import builtinFunctions from '../../data/pb-builtin-functions.json';

// ── Types ────────────────────────────────────────────────────────────────────

export interface BuiltinFunctionEntry {
    /** Full PureBasic signature, e.g. "OpenWindow(#Window, x, y, ...)" */
    signature: string;
    /** Human-readable description of what the function does. */
    description: string;
    /**
     * Parameter labels in declaration order,
     * e.g. ["#Window", "x", "y", "InnerWidth", ...].
     * Optional parameters are enclosed in brackets, e.g. "[Flags]".
     */
    parameters: string[];
    /** Optional link to the official PureBasic documentation page. */
    docUrl?: string;
}

// ── Lookup map ───────────────────────────────────────────────────────────────

/**
 * Case-insensitive map: lowercase function name → entry.
 * Built once at module load time to avoid repeated Object.entries() calls.
 */
export const builtinFunctionMap = new Map<string, BuiltinFunctionEntry>(
    Object.entries(builtinFunctions as Record<string, BuiltinFunctionEntry>)
        .map(([name, entry]) => [name.toLowerCase(), entry])
);

// ── Canonical name lookup ────────────────────────────────────────────────────

/**
 * Canonical (correctly cased) name map: lowercase → original name.
 * Useful when the display name must match the JSON key exactly.
 */
export const builtinFunctionNames = new Map<string, string>(
    Object.keys(builtinFunctions as Record<string, BuiltinFunctionEntry>)
        .map(name => [name.toLowerCase(), name])
);

// ── Helper ───────────────────────────────────────────────────────────────────

/**
 * Look up a built-in function entry by name (case-insensitive).
 * Returns `undefined` when the name is not found.
 */
export function findBuiltin(functionName: string): BuiltinFunctionEntry | undefined {
    return builtinFunctionMap.get(functionName.toLowerCase());
}

/**
 * Returns an array of all built-in function names in their canonical casing.
 */
export function allBuiltinNames(): string[] {
    return Array.from(builtinFunctionNames.values());
}