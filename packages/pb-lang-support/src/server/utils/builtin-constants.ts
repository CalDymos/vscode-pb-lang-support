/**
 * Shared access layer for pb-builtin-constants.json.
 *
 * Two consumers are anticipated:
 *   - completion-provider  (general #PB_* completion + context-sensitive
 *                           parameter completion inside function calls)
 *   - hover-provider       (show constant group on hover, future extension)
 *
 * Data originates from PureBasicIDE/ConstantsData.pbi and was converted to
 * JSON at build time.  No runtime values are available; the file only
 * describes which constants are valid for a given function parameter.
 *
 * Wildcard prefixes (e.g. #PB_Event_*, #PB_Shortcut_*) are stored
 * separately so callers can do prefix-based expansion against the
 * allConstants list when needed.
 */

import constantsData from '../../data/pb-builtin-constants.json';

// ── Types ────────────────────────────────────────────────────────────────────

/** One entry from functionParamConstants. */
export interface FunctionParamEntry {
    /** Canonical (correctly-cased) function name, e.g. "OpenWindow". */
    name: string;
    /**
     * Map of 1-based parameter index (as string) → array of constant names
     * that are valid for that parameter position.
     *
     * Example: { "1": ["#PB_Any"], "7": ["#PB_Window_SystemMenu", ...] }
     */
    params: Record<string, string[]>;
}

// ── Raw data ─────────────────────────────────────────────────────────────────

interface ConstantsJson {
    /** key: lowercase function name */
    functionParamConstants: Record<string, FunctionParamEntry>;
    /** All concrete #PB_* and #True/#False constant names, sorted. */
    allConstants: string[];
    /**
     * Prefix strings for wildcard entries (trailing '*' already stripped).
     * e.g. ["#PB_EventType_", "#PB_Event_", "#PB_Key_", "#PB_Shortcut_"]
     */
    wildcardPrefixes: string[];
}

const data = constantsData as ConstantsJson;

// ── Lookup maps ───────────────────────────────────────────────────────────────

/**
 * Case-insensitive map: lowercase function name → FunctionParamEntry.
 * Built once at module load time.
 */
export const functionParamMap = new Map<string, FunctionParamEntry>(
    Object.entries(data.functionParamConstants)
);

/**
 * All concrete builtin constant names (no wildcards), sorted ascending.
 * Use for general #PB_* completion when no function context is available.
 */
export const allBuiltinConstants: readonly string[] = data.allConstants;

/**
 * Wildcard prefixes (e.g. "#PB_Event_", "#PB_Shortcut_").
 * A constant name matches a wildcard if it starts with one of these prefixes.
 */
export const wildcardPrefixes: readonly string[] = data.wildcardPrefixes;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the context-sensitive constants for a specific function parameter.
 *
 * @param functionName  The called function name (case-insensitive).
 * @param paramIndex    The 1-based index of the parameter being typed.
 * @returns             Array of constant names, or `undefined` if no mapping
 *                      exists for this function/parameter combination.
 *
 * @example
 *   getParamConstants('OpenWindow', 7)
 *   // → ["#PB_Window_SystemMenu", "#PB_Window_MinimizeGadget", ...]
 */
export function getParamConstants(
    functionName: string,
    paramIndex: number
): string[] | undefined {
    const entry = functionParamMap.get(functionName.toLowerCase());
    if (!entry) { return undefined; }
    return entry.params[String(paramIndex)];
}

/**
 * Returns whether a given function has any parameter constant mappings.
 */
export function hasFunctionMapping(functionName: string): boolean {
    return functionParamMap.has(functionName.toLowerCase());
}

/**
 * Expands wildcard prefixes against allBuiltinConstants.
 * Returns all constants that start with at least one of the wildcard prefixes.
 *
 * Useful when ConstantsData.pbi references e.g. "#PB_Shortcut_*" — callers
 * can resolve the full set of matching constants from the flat list.
 *
 * @param prefixes  Subset of wildcardPrefixes to expand (defaults to all).
 */
export function expandWildcards(
    prefixes: readonly string[] = wildcardPrefixes
): string[] {
    return allBuiltinConstants.filter(c =>
        prefixes.some(p => c.startsWith(p))
    );
}

/**
 * Returns constants for a parameter, with wildcards fully resolved.
 *
 * @param functionName  Function name (case-insensitive).
 * @param paramIndex    1-based parameter index.
 * @returns             Resolved constant array, or `undefined` if no mapping.
 */
export function getParamConstantsResolved(
    functionName: string,
    paramIndex: number
): string[] | undefined {
    const raw = getParamConstants(functionName, paramIndex);
    if (!raw) { return undefined; }

    const result: string[] = [];
    for (const entry of raw) {
        // Check whether this entry is a known wildcard (stored as plain prefix
        // in wildcardPrefixes after stripping the trailing '*')
        const matchedPrefix = wildcardPrefixes.find(p => entry === p || entry === p + '*');
        if (matchedPrefix) {
            // Expand: all constants starting with this prefix
            allBuiltinConstants.forEach(c => {
                if (c.startsWith(matchedPrefix)) { result.push(c); }
            });
        } else {
            result.push(entry);
        }
    }
    return result;
}
