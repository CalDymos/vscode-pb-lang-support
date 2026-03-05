/**
 * Parser and writer for PureBasic IDE metadata at file end.
 *
 * Format: Comment block starting with "; IDE Options = PureBasic ..."
 */

export interface PbFileMetadata {
    /** Raw key-value pairs (Key → Value or Key → true for flags) */
    entries: Map<string, string | true>;
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
}

const ANCHOR_RE = /^; IDE Options = PureBasic (.+)$/;
const KV_RE     = /^; ([A-Za-z][A-Za-z0-9_]*) = (.*)$/;
const FLAG_RE   = /^; ([A-Za-z][A-Za-z0-9_]*)$/;

// Variants without the ";" prefix (fileCfg / projectCfg)
const ANCHOR_BARE_RE = /^IDE Options = PureBasic (.+)$/;
const KV_BARE_RE     = /^([A-Za-z][A-Za-z0-9_]*) = (.*)$/;
const FLAG_BARE_RE   = /^([A-Za-z][A-Za-z0-9_]*)$/;
const SECTION_RE     = /^\[(.+)\]$/;

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

export function splitPbFile(text: string): PbFileSplit {
    const lines = text.split(/\r?\n/);

    let metaStartLine = -1;
    for (let i = 0; i < lines.length; i++) {
        if (ANCHOR_RE.test(lines[i])) {
            metaStartLine = i;
            break;
        }
    }

    if (metaStartLine < 0) {
        return { source: text, metadata: null, metaStartLine: -1 };
    }

    // Source code: everything up to the block, trim trailing whitespace
    const sourceLines = lines.slice(0, metaStartLine);
    // Remove empty lines at the end of the source code (IDE writes 2 empty lines itself)
    while (sourceLines.length > 0 && sourceLines[sourceLines.length - 1].trim() === '') {
        sourceLines.pop();
    }
    const source = sourceLines.join('\n');

    // Parse metadata
    const metaLines = lines.slice(metaStartLine);
    const entries   = new Map<string, string | true>();
    const anchorMatch = ANCHOR_RE.exec(metaLines[0])!;
    const ideVersion  = anchorMatch[1];

    for (const line of metaLines.slice(1)) {
        const kv   = KV_RE.exec(line);
        if (kv)   { entries.set(kv[1], kv[2]); continue; }
        const flag = FLAG_RE.exec(line);
        if (flag) { entries.set(flag[1], true); }
    }

    return {
        source,
        metadata: { entries, ideVersion },
        metaStartLine,
    };
}

// ---------------------------------------------------------------------------
// Serialize
// ---------------------------------------------------------------------------

export function serializeMetadata(meta: PbFileMetadata): string {
    const lines: string[] = [];
    lines.push(`; IDE Options = PureBasic ${meta.ideVersion}`);
    for (const [key, val] of meta.entries) {
        lines.push(val === true ? `; ${key}` : `; ${key} = ${val}`);
    }
    return lines.join('\n');
}

/**
 * Writes source code + (new/updated) metadata block together.
 * Preserves the original line ending convention of the document.
 */
export function joinPbFile(source: string, metadata: PbFileMetadata): string {
    return `${source}\n\n\n${serializeMetadata(metadata)}\n`;
}

// ---------------------------------------------------------------------------
// Helper functions for FallbackResolver
// ---------------------------------------------------------------------------

export function extractExecutable(meta: PbFileMetadata, baseDir: string): string | undefined {
    const val = meta.entries.get('Executable');
    return val && val !== true ? resolve(baseDir, val) : undefined;
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
    for (const line of lines.slice(1)) {
        const stripped = line.trim();
        if (!stripped) continue;
        const kv   = KV_BARE_RE.exec(stripped);
        if (kv)   { entries.set(kv[1], kv[2]); continue; }
        const flag = FLAG_BARE_RE.exec(stripped);
        if (flag) { entries.set(flag[1], true); }
    }

    return { entries, ideVersion: anchorMatch[1] };
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

    for (const line of lines) {
        const trimmed = line.trim();

        // Section-Header
        const sectionMatch = SECTION_RE.exec(trimmed);
        if (sectionMatch) {
            inSection = sectionMatch[1].toLowerCase() === targetSection;
            continue;
        }

        if (!inSection || !trimmed) continue;

        // Anchor line
        const anchorMatch = ANCHOR_BARE_RE.exec(trimmed);
        if (anchorMatch) { ideVersion = anchorMatch[1]; continue; }

        // Key-Value
        const kv = KV_BARE_RE.exec(trimmed);
        if (kv)   { entries.set(kv[1], kv[2]); continue; }
        // Flag
        const flag = FLAG_BARE_RE.exec(trimmed);
        if (flag) { entries.set(flag[1], true); }
    }

    if (!ideVersion) return null;
    return { entries, ideVersion };
}

function resolve(base: string, p: string): string {
    const path = require('path') as typeof import('path');
    return path.isAbsolute(p) ? p : path.resolve(base, p);
}

