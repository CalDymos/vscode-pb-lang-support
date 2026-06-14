/**
 * Parser and writer for PureBasic IDE metadata at file end.
 *
 * Format: Comment block starting with "; IDE Options = PureBasic ..."
 */

import type { PbpTarget } from '@caldymos/pb-project-core';

export interface PbMetadataEntry {
    key: string;
    value: string | true;
}

export interface PbFileMetadata {
    /** Raw key-value pairs (Key → Value or Key → true for flags). Duplicate keys keep the last value here. */
    entries: Map<string, string | true>;
    /** Ordered raw entries. This preserves duplicate IDE options such as Constant and AddResource. */
    items?: PbMetadataEntry[];
    /** Version string from the IDE-Options line, e.g. "PureBasic 6.30 (Windows - x86)" */
    ideVersion: string;
}

export interface PbFileSplit {
    /** Source code without metadata block */
    source: string;
    /** Parsed metadata, or null if no block is present */
    metadata: PbFileMetadata | null;
    /** Line number (0-based) where the metadata block starts, or -1 */
    metaStartLine: number;
    /** End of line in the original document ('\r\n' or'\n'). */
    eol: '\r\n' | '\n';
}

export interface MetadataTargetBuildOptions {
    /** Overrides the debugger state. This mirrors the IDE MainFile path, where the active file owns this option. */
    debuggerEnabled?: boolean;
}

const ANCHOR_RE = /^; IDE Options = PureBasic (.+)$/;
const KV_RE     = /^; ([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.*)$/;
const FLAG_RE   = /^; ([A-Za-z][A-Za-z0-9_]*)$/;

// Variants without the ";" prefix (fileCfg / projectCfg)
const ANCHOR_BARE_RE = /^IDE Options = PureBasic (.+)$/;
const KV_BARE_RE     = /^([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.*)$/;
const FLAG_BARE_RE   = /^([A-Za-z][A-Za-z0-9_]*)$/;
const SECTION_RE     = /^\[(.+)\]$/;

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

export function splitPbFile(text: string): PbFileSplit {
    const eol: '\r\n' | '\n' = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = text.split(/\r?\n/);

    let metaStartLine = -1;
    for (let i = 0; i < lines.length; i++) {
        if (ANCHOR_RE.test(lines[i])) {
            metaStartLine = i;
            break;
        }
    }

    if (metaStartLine < 0) {
        return { source: text, metadata: null, metaStartLine: -1, eol };
    }

    // Source code: everything up to the block, trim trailing whitespace.
    const sourceLines = lines.slice(0, metaStartLine);
    // Remove empty lines at the end of the source code. The IDE writes these itself.
    while (sourceLines.length > 0 && sourceLines[sourceLines.length - 1].trim() === '') {
        sourceLines.pop();
    }
    const source = sourceLines.join('\n');

    // Parse metadata.
    const metaLines = lines.slice(metaStartLine);
    const entries   = new Map<string, string | true>();
    const items: PbMetadataEntry[] = [];
    const anchorMatch = ANCHOR_RE.exec(metaLines[0])!;
    const ideVersion  = anchorMatch[1];

    for (const line of metaLines.slice(1)) {
        const kv = KV_RE.exec(line);
        if (kv) {
            addMetadataEntry(entries, items, kv[1], kv[2]);
            continue;
        }

        const flag = FLAG_RE.exec(line);
        if (flag) {
            addMetadataEntry(entries, items, flag[1], true);
        }
    }

    return {
        source,
        metadata: { entries, items, ideVersion },
        metaStartLine, eol
    };
}

// ---------------------------------------------------------------------------
// Serialize
// ---------------------------------------------------------------------------

export function serializeMetadata(meta: PbFileMetadata, eol: '\r\n' | '\n' = '\n'): string {
    const lines: string[] = [];
    lines.push(`; IDE Options = PureBasic ${meta.ideVersion}`);
    for (const [key, val] of meta.entries) {
        lines.push(val === true ? `; ${key}` : `; ${key} = ${val}`);
    }
    return lines.join(eol);
}

/**
 * Writes source code + (new/updated) metadata block together.
 * Preserves the original line ending convention of the document.
 */
export function joinPbFile(source: string, metadata: PbFileMetadata, eol: '\r\n' | '\n' = '\n'): string {
    const sep = eol;
    return `${source}${sep}${sep}${sep}${serializeMetadata(metadata, eol)}${sep}`;
}

// ---------------------------------------------------------------------------
// Helper functions for FallbackResolver
// ---------------------------------------------------------------------------

export function extractExecutable(meta: PbFileMetadata, baseDir: string): string | undefined {
    const val = getMetadataString(meta, 'Executable');
    return val ? resolve(baseDir, val) : undefined;
}

export function extractUseMainFile(meta: PbFileMetadata, baseDir: string): string | undefined {
    const val = getMetadataString(meta, 'UseMainFile');
    return val ? resolve(baseDir, val) : undefined;
}

export function isMetadataDebuggerEnabled(meta: PbFileMetadata): boolean {
    return !hasMetadataEntry(meta, 'DisableDebugger');
}

/**
 * Converts PureBasic IDE metadata into the PbpTarget shape consumed by the
 * existing compiler command builders. The function maps only options that are
 * actually written and read by the PureBasic IDE source metadata code.
 */
export function metadataToFallbackTarget(
    meta: PbFileMetadata,
    sourceFile: string,
    baseDir: string,
    options: MetadataTargetBuildOptions = {},
): PbpTarget {
    const outputFile = extractExecutable(meta, baseDir) ?? '';
    const format = buildMetadataFormat(meta);
    const targetOptions = buildMetadataOptions(meta, options);
    const linkerValue = getMetadataString(meta, 'LinkerOptions');
    const iconValue = getMetadataString(meta, 'UseIcon');
    const purifierValue = getMetadataEntry(meta, 'EnablePurifier');
    const compileCountValue = getMetadataString(meta, 'EnableCompileCount');
    const buildCountValue = getMetadataString(meta, 'EnableBuildCount');
    const constants = metadataEntries(meta, 'Constant')
        .map((entry) => metadataValueToString(entry.value).trim())
        .filter((value) => value.length > 0)
        .map((value) => ({ enabled: true, value }));
    const resources = metadataEntries(meta, 'AddResource')
        .map((entry) => metadataValueToString(entry.value).trim())
        .filter((value) => value.length > 0)
        .map((value) => resolve(baseDir, value));

    return {
        name: 'Fallback',
        enabled: true,
        isDefault: true,
        inputFile: { rawPath: sourceFile, fsPath: sourceFile },
        outputFile: { rawPath: outputFile, fsPath: outputFile },
        executable: { rawPath: outputFile, fsPath: outputFile },
        directory: getMetadataString(meta, 'CurrentDirectory') ?? '',
        options: targetOptions,
        constants,
        compilerVersion: meta.ideVersion,
        commandLine: getMetadataString(meta, 'CommandLine'),
        subsystem: getMetadataString(meta, 'SubSystem'),
        format,
        linker: linkerValue
            ? { rawPath: linkerValue, fsPath: resolve(baseDir, linkerValue) }
            : undefined,
        icon: iconValue
            ? { enabled: true, rawPath: iconValue, fsPath: resolve(baseDir, iconValue) }
            : undefined,
        purifier: purifierValue
            ? {
                enabled: hasMetadataEntry(meta, 'EnablePurifier'),
                granularity: metadataValueToString(purifierValue.value),
            }
            : undefined,
        compileCount: compileCountValue
            ? { enabled: true, value: numberFromString(compileCountValue) }
            : undefined,
        buildCount: buildCountValue
            ? { enabled: true, value: numberFromString(buildCountValue) }
            : undefined,
        exeConstant: hasMetadataEntry(meta, 'EnableExeConstant') ? { enabled: true } : undefined,
        resources,
        versionInfo: buildMetadataVersionInfo(meta),
    };
}

export function getMetadataEntry(meta: PbFileMetadata, key: string): PbMetadataEntry | undefined {
    const wanted = key.toUpperCase();
    const items = getMetadataItems(meta);

    for (let index = items.length - 1; index >= 0; index--) {
        const item = items[index];
        if (item.key.toUpperCase() === wanted) {
            return item;
        }
    }

    return undefined;
}

export function getMetadataString(meta: PbFileMetadata, key: string): string | undefined {
    const entry = getMetadataEntry(meta, key);
    if (!entry || entry.value === true) return undefined;

    const value = entry.value.trim();
    return value.length > 0 ? value : undefined;
}

export function hasMetadataEntry(meta: PbFileMetadata, key: string): boolean {
    return !!getMetadataEntry(meta, key);
}

export function metadataEntries(meta: PbFileMetadata, key: string): PbMetadataEntry[] {
    const wanted = key.toUpperCase();
    return getMetadataItems(meta).filter((item) => item.key.toUpperCase() === wanted);
}

// ---------------------------------------------------------------------------
// fileCfg  (<file>.pb.cfg)
// Identical to the sourceMetadata structure, but without the “; ” prefix.
// ---------------------------------------------------------------------------
export function parseCfgFile(text: string): PbFileMetadata | null {
    const lines = text.split(/\r?\n/);
    const anchorMatch = ANCHOR_BARE_RE.exec(lines[0]?.trim() ?? '');
    if (!anchorMatch) return null;

    const entries = new Map<string, string | true>();
    const items: PbMetadataEntry[] = [];
    for (const line of lines.slice(1)) {
        const stripped = line.trim();
        if (!stripped) continue;
        const kv = KV_BARE_RE.exec(stripped);
        if (kv) {
            addMetadataEntry(entries, items, kv[1], kv[2]);
            continue;
        }
        const flag = FLAG_BARE_RE.exec(stripped);
        if (flag) {
            addMetadataEntry(entries, items, flag[1], true);
        }
    }

    return { entries, items, ideVersion: anchorMatch[1] };
}

// ---------------------------------------------------------------------------
// projectCfg  (project.cfg)
// INI-like: [filename.pb] sections, content indented.
//
// [MyFile.pb]
//   IDE Options = PureBasic 6.30 (Windows - x86)
//   EnableThread
//   Executable = out\myapp.exe
// ---------------------------------------------------------------------------
export function parseProjectCfg(
    text:     string,
    fileName: string,   // Only the file name, e.g., “test.pb”
): PbFileMetadata | null {
    const lines    = text.split(/\r?\n/);
    const targetSection = fileName.toLowerCase();

    let inSection = false;
    let ideVersion: string | null = null;
    const entries = new Map<string, string | true>();
    const items: PbMetadataEntry[] = [];

    for (const line of lines) {
        const trimmed = line.trim();

        // Section header.
        const sectionMatch = SECTION_RE.exec(trimmed);
        if (sectionMatch) {
            inSection = sectionMatch[1].toLowerCase() === targetSection;
            continue;
        }

        if (!inSection || !trimmed) continue;

        // Anchor line.
        const anchorMatch = ANCHOR_BARE_RE.exec(trimmed);
        if (anchorMatch) { ideVersion = anchorMatch[1]; continue; }

        // Key-value.
        const kv = KV_BARE_RE.exec(trimmed);
        if (kv) {
            addMetadataEntry(entries, items, kv[1], kv[2]);
            continue;
        }
        // Flag.
        const flag = FLAG_BARE_RE.exec(trimmed);
        if (flag) {
            addMetadataEntry(entries, items, flag[1], true);
        }
    }

    if (!ideVersion) return null;
    return { entries, items, ideVersion };
}

function buildMetadataOptions(meta: PbFileMetadata, options: MetadataTargetBuildOptions): Record<string, boolean> {
    return {
        debug: options.debuggerEnabled ?? isMetadataDebuggerEnabled(meta),
        optimizer: hasMetadataEntry(meta, 'Optimizer'),
        asm: hasMetadataEntry(meta, 'EnableAsm'),
        thread: hasMetadataEntry(meta, 'EnableThread'),
        xpskin: hasMetadataEntry(meta, 'EnableXP'),
        wayland: hasMetadataEntry(meta, 'EnableWayland'),
        admin: hasMetadataEntry(meta, 'EnableAdmin'),
        user: hasMetadataEntry(meta, 'EnableUser'),
        dpiaware: hasMetadataEntry(meta, 'DPIAware'),
        dllprotection: hasMetadataEntry(meta, 'DllProtection'),
        shareducrt: hasMetadataEntry(meta, 'SharedUCRT'),
        onerror: hasMetadataEntry(meta, 'EnableOnError'),
    };
}

function buildMetadataFormat(meta: PbFileMetadata): Record<string, string> | undefined {
    const exe = normalizeExecutableFormat(getMetadataString(meta, 'ExecutableFormat'));
    const cpu = getMetadataString(meta, 'CPU');

    if (!exe && !cpu) return undefined;

    return {
        ...(exe ? { exe } : {}),
        ...(cpu ? { cpu } : {}),
    };
}

function normalizeExecutableFormat(value: string | undefined): string {
    const normalized = (value ?? '').trim().toLowerCase();
    if (!normalized) return '';

    if (normalized.includes('console')) return 'console';
    if (normalized.includes('shared') || normalized.includes('dll') || normalized.includes('.so') || normalized.includes('.dylib')) {
        return 'dll';
    }

    return '';
}

function buildMetadataVersionInfo(meta: PbFileMetadata): PbpTarget['versionInfo'] | undefined {
    const fields = getMetadataItems(meta)
        .map((item) => ({ item, match: /^VersionField(\d+)$/i.exec(item.key) }))
        .filter((entry): entry is { item: PbMetadataEntry; match: RegExpExecArray } => !!entry.match)
        .map(({ item, match }) => ({ id: `field${match[1]}`, value: metadataValueToString(item.value) }));

    if (!hasMetadataEntry(meta, 'IncludeVersionInfo') && fields.length === 0) return undefined;

    return {
        enabled: hasMetadataEntry(meta, 'IncludeVersionInfo'),
        fields,
    };
}

function getMetadataItems(meta: PbFileMetadata): PbMetadataEntry[] {
    if (Array.isArray(meta.items)) return [...meta.items];
    return Array.from(meta.entries, ([key, value]) => ({ key, value }));
}

function addMetadataEntry(
    entries: Map<string, string | true>,
    items: PbMetadataEntry[],
    key: string,
    value: string | true,
): void {
    entries.set(key, value);
    items.push({ key, value });
}

function metadataValueToString(value: string | true): string {
    return value === true ? '' : value;
}

function numberFromString(value: string): number | undefined {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function resolve(base: string, p: string): string {
    const path = require('path') as typeof import('path');

    if (looksLikeWindowsAbs(p)) {
        return path.win32.normalize(p);
    }
    if (looksLikeWindowsAbs(base)) {
        return path.win32.normalize(path.win32.resolve(base, p));
    }

    if (isRootedPath(p)) {
        return path.normalize(p);
    }
    if (isRootedPath(base)) {
        return path.normalize(joinRootedPath(base, p));
    }

    return path.resolve(base, p);
}

function joinRootedPath(base: string, p: string): string {
    const separator = base.includes('\\') && !base.includes('/') ? '\\' : '/';
    const trimmedBase = base.replace(/[\\/]+$/, '');
    const trimmedPath = p.replace(/^[\\/]+/, '');

    return `${trimmedBase}${separator}${trimmedPath}`;
}

function isRootedPath(value: string): boolean {
    return value.startsWith('/') || value.startsWith('\\');
}

function looksLikeWindowsAbs(value: string): boolean {
    return value.startsWith('\\\\') || /^[a-zA-Z]:[\\/]/.test(value);
}
