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

/** Maximum number of resident files to index (safety cap). */
const MAX_RESIDENT_FILES = 200;

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

    const residentsDir = residentsPath;
    try {
        if (!fs.existsSync(residentsDir)) return;
    } catch {
        return;
    }

    const files = _collectPbFiles(residentsDir);
    for (const filePath of files) {
        const uri = fsPathToUri(filePath);
        try {
            const text    = fs.readFileSync(filePath, 'utf8');
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

function _collectPbFiles(dir: string): string[] {
    const out:  string[]      = [];
    const seen: Set<string>   = new Set();
    _walk(dir, out, seen);
    return out.slice(0, MAX_RESIDENT_FILES);
}

function _walk(dir: string, out: string[], seen: Set<string>): void {
    if (!dir || seen.has(dir) || out.length >= MAX_RESIDENT_FILES) return;
    seen.add(dir);

    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }

    for (const e of entries) {
        if (out.length >= MAX_RESIDENT_FILES) return;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (!e.name.startsWith('.')) _walk(p, out, seen);
        } else if (e.isFile() && p.endsWith('.pb')) {
            out.push(p);
        }
    }
}