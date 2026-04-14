/**
 * Residents index — analogous to builtin-constants.ts
 *
 * Scans <residentsPath>/**\/*.pb at startup, parses symbols
 * into in-memory lookup structures, and exposes query functions for
 * hover and completion providers.
 *
 * Design contract:
 *   - Residents are read-only: no definition jumps, no rename.
 *   - Symbols do NOT enter the symbol cache (immune to cache-clear).
 *   - Naming mirrors builtin-constants.ts / builtin-functions.ts so
 *     providers can query them the same way.
 */

import * as fs   from 'fs';
import * as path from 'path';
import { PureBasicSymbol, SymbolKind } from '../symbols/types';
import { optimizedSymbolParser }       from '../symbols/optimized-symbol-parser';
import { fsPathToUri }                 from '../utils/fs-utils';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum number of resident .pb files to index. */
const MAX_RESIDENT_FILES = 200;

/**
 * Maximum number of directories visited during traversal.
 * Prevents excessive scanning of deep/large trees with few .pb files.
 */
const MAX_DIRS_VISITED = 1000;

/**
 * Lowercase directory names that are unconditionally skipped during traversal.
 *
 * - `javascript`: SpiderBasic-only residents — excluded until SB support.
 * - Platform dirs (`windows`, `linux`, `macos`): only the dir matching the
 *   current OS is kept; the others are excluded.  Comparison is case-insensitive
 *   so `MacOS`, `macos`, `MACOS` are all handled correctly.
 */
const EXCLUDED_DIRS: ReadonlySet<string> = (() => {
    const excluded = new Set<string>(['javascript']);
    if (process.platform !== 'win32')  excluded.add('windows');
    if (process.platform !== 'darwin') excluded.add('macos');
    if (process.platform !== 'linux')  excluded.add('linux');
    return excluded;
})();

// ── In-memory stores ──────────────────────────────────────────────────────────

/**
 * Case-insensitive name → symbol for every parsed resident symbol.
 * Constants are keyed without the leading '#'.
 */
const residentSymbolMap = new Map<string, PureBasicSymbol>();

/** Set of file URIs that originate from the Residents directory. */
const residentUris = new Set<string>();

// Derived, sorted name arrays – rebuilt after each loadResidents() call.
let _residentConstantNames:  readonly string[] = [];
let _residentStructureNames: readonly string[] = [];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns `true` when the URI belongs to a PureBasic Residents file.
 * Use this to block Go-to-Definition and Rename for resident symbols.
 */
export function isResidentUri(uri: string): boolean {
    return residentUris.has(uri);
}

/**
 * Case-insensitive lookup for a resident symbol by name.
 * Accepts both `#ConstantName` and `ConstantName` forms.
 */
export function findResidentSymbol(name: string): PureBasicSymbol | undefined {
    const key = name.startsWith('#')
        ? name.slice(1).toLowerCase()
        : name.toLowerCase();
    return residentSymbolMap.get(key);
}

/**
 * Sorted list of all resident constant names **without** the '#' prefix.
 * For use in the completion-provider constant context (isConstantContext branch).
 */
export function allResidentConstantNames(): readonly string[] {
    return _residentConstantNames;
}

/**
 * Sorted list of all resident structure names.
 * For use in completion-provider type-annotation and struct-access contexts.
 */
export function allResidentStructureNames(): readonly string[] {
    return _residentStructureNames;
}

/**
 * (Re-)loads all Residents symbols from `<residentsPath>` (used directly as scan root).
 *
 * Uses async FS operations so the Node event loop is never blocked.
 * Traversal is bounded by MAX_RESIDENT_FILES and MAX_DIRS_VISITED; a warning is
 * emitted via `logError` when either cap is reached.
 *
 * Clears any previously loaded entries first, so calling this again after a
 * configuration change always starts with a clean slate.
 * Safe to call with an empty string (becomes a no-op that resets state).
 */
export async function loadResidents(
    residentsPath: string,
    logError?: (msg: string, err?: unknown) => void
): Promise<void> {
    _reset();

    if (!residentsPath) return;

    try {
        await fs.promises.access(residentsPath);
    } catch {
        return;
    }

    const files = await _collectPbFiles(residentsPath, logError);

    for (const filePath of files) {
        const uri = fsPathToUri(filePath);
        try {
            const text    = await fs.promises.readFile(filePath, 'utf8');
            // parseTextOnly does not touch the symbol cache (no cache pollution).
            const symbols = optimizedSymbolParser.parseTextOnly(text);
            for (const sym of symbols) {
                residentSymbolMap.set(sym.name.toLowerCase(), sym);
            }
            residentUris.add(uri);
        } catch (err) {
            logError?.(`Residents: skipped ${path.basename(filePath)}`, err);
        }
    }

    // Rebuild derived arrays once after the full scan.
    const constants:  string[] = [];
    const structures: string[] = [];
    for (const [, sym] of residentSymbolMap) {
        if (sym.kind === SymbolKind.Constant)  constants.push(sym.name);
        if (sym.kind === SymbolKind.Structure) structures.push(sym.name);
    }
    _residentConstantNames  = Object.freeze(constants.sort());
    _residentStructureNames = Object.freeze(structures.sort());
}

/** Resets all resident data (e.g. on deactivate or before re-scan). */
export function clearResidents(): void {
    _reset();
}

// ── Internals ─────────────────────────────────────────────────────────────────

function _reset(): void {
    residentSymbolMap.clear();
    residentUris.clear();
    _residentConstantNames  = [];
    _residentStructureNames = [];
}

async function _collectPbFiles(
    dir: string,
    logError?: (msg: string) => void
): Promise<string[]> {
    const out:   string[]          = [];
    const seen:  Set<string>       = new Set();
    const stats: { dirs: number }  = { dirs: 0 };
    await _walk(dir, out, seen, stats, logError);
    return out;
}

async function _walk(
    dir:      string,
    out:      string[],
    seen:     Set<string>,
    stats:    { dirs: number },
    logError?: (msg: string) => void
): Promise<void> {
    if (!dir || seen.has(dir)) return;

    if (out.length >= MAX_RESIDENT_FILES) {
        logError?.(
            `Residents: file cap (${MAX_RESIDENT_FILES}) reached – indexing stopped.`
        );
        return;
    }
    if (stats.dirs >= MAX_DIRS_VISITED) {
        logError?.(
            `Residents: directory cap (${MAX_DIRS_VISITED}) reached – indexing stopped.`
        );
        return;
    }

    seen.add(dir);
    stats.dirs++;

    let entries: fs.Dirent[];
    try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
        return;
    }

    const subdirs: string[] = [];
    for (const e of entries) {
        if (out.length >= MAX_RESIDENT_FILES) break;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            const nameLower = e.name.toLowerCase();
            if (!e.name.startsWith('.') && !EXCLUDED_DIRS.has(nameLower)) {
                subdirs.push(p);
            }
        } else if (e.isFile() && p.endsWith('.pb')) {
            out.push(p);
        }
    }

    // Recurse sequentially – avoids spawning hundreds of parallel readdir calls.
    for (const sub of subdirs) {
        if (out.length >= MAX_RESIDENT_FILES || stats.dirs >= MAX_DIRS_VISITED) break;
        await _walk(sub, out, seen, stats, logError);
    }
}