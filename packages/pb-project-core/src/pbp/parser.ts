/*
 * @caldymos/pb-project-core
 *
 * PureBasic Project (.pbp) parser library.
 *
 * - Parses XML-based .pbp files (PureBasic >= 6.21)
 * - Extracts source file references
 * - Extracts project configuration metadata
 * - No runtime or editor dependencies
 *
 * Intended for shared use between extension hosts,
 * language servers, CLI tools, and build systems.
 */

import * as path from 'path';

import type {
    ParsePbpOptions,
    PbpConfig,
    PbpData,
    PbpFileEntry,
    PbpProject,
    PbpTarget,
    PbpTargetValue,
} from './model';

export type {
    ParsePbpOptions,
    PbpConfig,
    PbpData,
    PbpFileEntry,
    PbpProject,
    PbpTarget,
    PbpTargetValue,
} from './model';

import { resolveProjectPath } from './resolve';

// --------------------------------------------------------------------------------------
// Regex constants
//
// Note: Any regex used with .exec() in a loop must be cloned per use because RegExp objects
// with the global flag keep state via lastIndex.
// --------------------------------------------------------------------------------------

const RX_XML_PROJECT_HEADER = /<\?xml\b[\s\S]*?<project\b/i;

const RX_CONFIG_OPTIONS_NAME = /<options\b[^>]*\bname="([^"]*)"[^>]*\/>/i;
const RX_CONFIG_COMMENT = /<comment\b[^>]*>([\s\S]*?)<\/comment>/i;

const RX_DATA_EXPLORER = /<explorer\b([^>]*)\/?>/i;
const RX_DATA_LOG = /<log\b([^>]*)\/?>/i;
const RX_DATA_LASTOPEN = /<lastopen\b([^>]*)\/?>/i;

const RX_FILE_ENTRY = /<file\b[^>]*\bname="([^"]+)"[^>]*>([\s\S]*?)<\/file>/gi;
const RX_FILE_ENTRY_SELF_CLOSED = /<file\b[^>]*\bname="([^"]+)"[^>]*\/>/gi;
const RX_FILE_CONFIG = /<config\b([^>]*)\/>/i;

const RX_LIB_VALUE = /<library\b[^>]*\bvalue="([^"]*)"[^>]*\/>/gi;
const RX_LIB_KEY = /<key\b[^>]*\bname="Library\d+"[^>]*>\s*([\s\S]*?)\s*<\/key>/gi;

const RX_TARGET = /<target\b([^>]*)>([\s\S]*?)<\/target>/gi;
const RX_TARGET_COMPILER = /<compiler\b([^>]*)\/>/i;
const RX_TARGET_COMMANDLINE_TEXT = /<commandline\b[^>]*>([\s\S]*?)<\/commandline>/i;
const RX_TARGET_PURIFIER = /<purifier\b([^>]*)\/>/i;
const RX_TARGET_OPTIONS = /<options\b([^>]*)\/>/i;
const RX_TARGET_FORMAT = /<format\b([^>]*)\/>/i;
const RX_TARGET_ICON = /<icon\b([^>]*)>([\s\S]*?)<\/icon>/i;

const RX_TARGET_CONSTANTS_SECTION = /<constants\b[^>]*>([\s\S]*?)<\/constants>/i;
const RX_TARGET_CONSTANT = /<constant\b([^>]*)\/>/gi;

const RX_VALUE_ATTR_TEMPLATE = `<__TAG__\\b[^>]*\\bvalue="([^"]*)"[^>]*\\/>`; // Usage: new RegExp(RX_VALUE_ATTR_TEMPLATE.replace('__TAG__', escapeRegExp(tagName)), 'i');
const RX_VALUE_ATTR_FLAGS = 'i';
const RX_SECTION_TEMPLATE = `<section\\b[^>]*\\bname="__NAME__"[^>]*>([\\s\\S]*?)<\\/section>`; // Usage: new RegExp(RX_SECTION_TEMPLATE.replace('__NAME__', escapeRegExp(sectionName)), 'i');
const RX_SECTION_FLAGS = 'i';

/**
 * Escape special characters in regular expressions
 */
function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cloneGlobalRegex(re: RegExp): RegExp {
    return new RegExp(re.source, re.flags);
}

function parseOptionalInt(v: string | undefined): number | undefined {
    if (!v) return undefined;
    const t = v.trim();
    if (!t) return undefined;
    const n = parseInt(t, 10);
    return Number.isFinite(n) ? n : undefined;
}

/**
 * Parse a PureBasic project file (.pbp).
 *
 * The .pbp format is an XML document with sections like "config", "files", and "targets".
 * All paths inside the project are stored relative to the project file.
 */
export function parsePbpProjectText(content: string, projectFileFsPath: string, options: ParsePbpOptions = {}): PbpProject | null {
    const normalized = normalizeNewlines(content);
    const projectDir = path.dirname(projectFileFsPath);

    // Fast path: XML format
    if (RX_XML_PROJECT_HEADER.test(normalized)) {
        return parseXmlProject(normalized, projectFileFsPath, projectDir);
    }

    return null;
}

/**
 * Parses .pbp project files (XML format)
 */
function parseXmlProject(content: string, projectFileFsPath: string, projectDir: string): PbpProject | null {
    const config = parseProjectConfig(content);
    const data = parseProjectData(content);
    const files = parseProjectFiles(content, projectDir);
    const targets = parseProjectTargets(content, projectDir);
    const libraries = parseProjectLibraries(content);

    return {
        projectFile: projectFileFsPath,
        projectDir,
        config,
        data,
        files,
        libraries,
        targets,
    };
}

function parseProjectConfig(content: string): PbpConfig {
    const configSection = extractSection(content, 'config');
        if (!configSection) {
        return {
            name: '',
            comment: '',
            closefiles: false,
            openmode: 0,
        };
    }

    const name = configSection.match(RX_CONFIG_OPTIONS_NAME);
    const comment = configSection.match(RX_CONFIG_COMMENT);

    return {
        name: (name?.[1] ?? '').trim(),
        comment: decodeXmlEntities((comment?.[1] ?? '').trim()),
        closefiles: configSection.includes('closefiles="1"') || configSection.includes('closefiles="true"'),
        openmode: (configSection.includes('openmode="1"') || configSection.includes('openmode="true"')) ? 1 : 0,
    };
}

function parseProjectData(content: string): PbpData {
    const dataSection = extractSection(content, 'data');
    if (!dataSection) return {};

    const explorerMatch = dataSection.match(RX_DATA_EXPLORER);
    const explorerAttrs = explorerMatch ? parseAttributes(explorerMatch[1] ?? '') : undefined;

    const logMatch = dataSection.match(RX_DATA_LOG);
    const logAttrs = logMatch ? parseAttributes(logMatch[1] ?? '') : undefined;

    const lastOpenMatch = dataSection.match(RX_DATA_LASTOPEN);
    const lastopenAttrs = lastOpenMatch ? parseAttributes(lastOpenMatch[1] ?? '') : undefined;

    const explorer = explorerAttrs ? {
        view: explorerAttrs['view'] ?? undefined,
        pattern: parseOptionalInt(explorerAttrs['pattern']),
    } : undefined;

    const log = logAttrs ? {
        show: logAttrs['show'] !== undefined ? parseBool(logAttrs['show']) : undefined,
    } : undefined;

    const lastopen = lastopenAttrs ? {
        date: (lastopenAttrs['date'] ?? '').trim() || undefined,
        user: (lastopenAttrs['user'] ?? '').trim() || undefined,
        host: (lastopenAttrs['host'] ?? '').trim() || undefined,
    } : undefined;

    return { explorer, log, lastopen };
}

function parseProjectFiles(content: string, projectDir: string): PbpFileEntry[] {
    const filesSection = extractSection(content, 'files');
    if (!filesSection) return [];

    const result: PbpFileEntry[] = [];

    // Normal <file name="..."><...></file>
    const fileRe = cloneGlobalRegex(RX_FILE_ENTRY);
    let m: RegExpExecArray | null;
    while ((m = fileRe.exec(filesSection)) !== null) {
        const rawPath = (m[1] ?? '').trim();
        const body = m[2] ?? '';

        const configMatch = body.match(RX_FILE_CONFIG);
        const cfg = configMatch ? parseBooleanAttributes(configMatch[1] ?? '') : undefined;

        result.push({
            rawPath,
            fsPath: resolveProjectPath(projectDir, rawPath),
            config: cfg,
        });
    }

    // Self-closed <file name="..."/>
    const fileSelfRe = cloneGlobalRegex(RX_FILE_ENTRY_SELF_CLOSED);
    while ((m = fileSelfRe.exec(filesSection)) !== null) {
        const rawPath = (m[1] ?? '').trim();
        // Avoid duplicates when both regex hit the same entry (shouldn't happen, but be defensive)
        if (result.some(r => r.rawPath === rawPath)) continue;
        result.push({
            rawPath,
            fsPath: resolveProjectPath(projectDir, rawPath),
        });
    }

    return result;
}

function parseProjectLibraries(content: string): string[] {
    // Best-effort parsing: PureBasic stores libraries inconsistently across versions.
    // Common patterns observed:
    //  - <section name="libraries"> ... <library value="..."/> ... </section>
    //  - <section name="libraries"> ... <key name="Library0">...</key> ... </section>
    const section = extractSection(content, 'libraries');
    if (!section) return [];

    const libs: string[] = [];

    const valueRe = cloneGlobalRegex(RX_LIB_VALUE);
    let m: RegExpExecArray | null;
    while ((m = valueRe.exec(section)) !== null) {
        const v = decodeXmlEntities((m[1] ?? '').trim());
        if (v) libs.push(v);
    }

    const keyRe = cloneGlobalRegex(RX_LIB_KEY);
    while ((m = keyRe.exec(section)) !== null) {
        const v = decodeXmlEntities((m[1] ?? '').trim());
        if (v) libs.push(v);
    }

    // Deduplicate while keeping order
    const seen = new Set<string>();
    const result: string[] = [];
    for (const lib of libs) {
        if (!lib) continue;
        if (seen.has(lib)) continue;
        seen.add(lib);
        result.push(lib);
    }
    return result;
}

function parseProjectTargets(content: string, projectDir: string): PbpTarget[] {
    const targetsSection = extractSection(content, 'targets');
    if (!targetsSection) return [];

    const result: PbpTarget[] = [];

    const targetRe = cloneGlobalRegex(RX_TARGET);
    let m: RegExpExecArray | null;
    while ((m = targetRe.exec(targetsSection)) !== null) {
        const attrs = parseAttributes(m[1] ?? '');
        const body = m[2] ?? '';

        const name = (attrs['name'] ?? '').trim();
        const enabled = parseBool(attrs['enabled']);
        const isDefault = parseBool(attrs['default']);

        const directory = (attrs['directory'] ?? '').trim();

        const inputRaw = extractValueAttr(body, 'inputfile');
        const outputRaw = extractValueAttr(body, 'outputfile');
        const exeRaw = extractValueAttr(body, 'executable');

        const compilerMatch = body.match(RX_TARGET_COMPILER);
        const compilerAttrs = compilerMatch ? parseAttributes(compilerMatch[1] ?? '') : undefined;
        const compilerVersion = (compilerAttrs?.['version'] ?? '').trim() || undefined;

        const commandLineRaw = extractValueAttr(body, 'commandline');
        const commandLineTextMatch = !commandLineRaw ? body.match(RX_TARGET_COMMANDLINE_TEXT) : null;
        const commandLine = (commandLineRaw || decodeXmlEntities((commandLineTextMatch?.[1] ?? '').trim())) || undefined;

        const subsystemRaw = extractValueAttr(body, 'subsystem');
        const subsystem = subsystemRaw ? subsystemRaw : undefined;

        const purifierMatch = body.match(RX_TARGET_PURIFIER);
        const purifierAttrs = purifierMatch ? parseAttributes(purifierMatch[1] ?? '') : undefined;
        const purifierEnabled = purifierAttrs ? parseBool(purifierAttrs['enable']) : false;
        const purifierGranularity = purifierAttrs?.['granularity'];

        const optMatch = body.match(RX_TARGET_OPTIONS);
        const options = optMatch ? parseBooleanAttributes(optMatch[1] ?? '') : {};

        const fmtMatch = body.match(RX_TARGET_FORMAT);
        const format = fmtMatch ? parseAttributes(fmtMatch[1] ?? '') : undefined;

        const iconMatch = body.match(RX_TARGET_ICON);
        const iconAttrs = iconMatch ? parseAttributes(iconMatch[1] ?? '') : undefined;
        const iconText = iconMatch ? decodeXmlEntities((iconMatch[2] ?? '').trim()) : '';

        const constants = parseTargetConstants(body);

        result.push({
            name,
            enabled,
            isDefault,
            directory,
            inputFile: {
                rawPath: inputRaw,
                fsPath: resolveProjectPath(projectDir, inputRaw),
            },
            outputFile: {
                rawPath: outputRaw,
                fsPath: resolveProjectPath(projectDir, outputRaw),
            },
            executable: {
                rawPath: exeRaw,
                fsPath: resolveProjectPath(projectDir, exeRaw),
            },
            options,
            compilerVersion,
            commandLine,
            subsystem,
            purifier: purifierMatch ? { enabled: purifierEnabled, granularity: purifierGranularity } : undefined,
            format,
            icon: iconText
                ? {
                    enabled: parseBool(iconAttrs?.['enable']),
                    rawPath: iconText,
                    fsPath: resolveProjectPath(projectDir, iconText),
                }
                : undefined,
            constants,
        });
    }

    return result;
}

function parseTargetConstants(targetBody: string): Array<{ enabled: boolean; value: string }> {
    const constantsSectionMatch = targetBody.match(RX_TARGET_CONSTANTS_SECTION);
    if (!constantsSectionMatch) return [];

    const constantsBody = constantsSectionMatch[1] ?? '';
    const result: Array<{ enabled: boolean; value: string }> = [];

    const constRe = cloneGlobalRegex(RX_TARGET_CONSTANT);
    let m: RegExpExecArray | null;
    while ((m = constRe.exec(constantsBody)) !== null) {
        const attrs = parseAttributes(m[1] ?? '');
        const enabled = parseBool(attrs['enable']);
        const value = decodeXmlEntities((attrs['value'] ?? '').trim());
        if (value) {
            result.push({ enabled, value });
        }
    }

    return result;
}

function extractValueAttr(targetBody: string, tagName: string): string {
    const re = new RegExp(RX_VALUE_ATTR_TEMPLATE.replace('__TAG__', escapeRegExp(tagName)), RX_VALUE_ATTR_FLAGS);
    const m = targetBody.match(re);
    return decodeXmlEntities((m?.[1] ?? '').trim());
}

function extractSection(content: string, sectionName: string): string | null {
    const re = new RegExp(RX_SECTION_TEMPLATE.replace('__NAME__', escapeRegExp(sectionName)), RX_SECTION_FLAGS);
    const m = content.match(re);
    return m ? (m[1] ?? '') : null;
}

function normalizeNewlines(content: string): string {
    return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function parseBool(v: string | undefined): boolean {
    if (!v) return false;
    const t = v.trim().toLowerCase();
    return t === '1' || t === 'true' || t === 'yes';
}

function parseAttributes(attrText: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const re = /(\w+)\s*=\s*"([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(attrText)) !== null) {
        attrs[m[1]] = decodeXmlEntities(m[2]);
    }
    return attrs;
}

function parseBooleanAttributes(attrText: string): Record<string, boolean> {
    const raw = parseAttributes(attrText);
    const out: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(raw)) {
        out[k] = parseBool(v);
    }
    return out;
}

function decodeXmlEntities(s: string): string {
    // Keep it small and dependency-free; .pbp usually doesn't encode much beyond these.
    return s
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}
