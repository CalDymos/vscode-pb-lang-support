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
    PbpProjectMeta,
    PbpTarget,
    PbpTargetValue,
} from './model';

export type {
    ParsePbpOptions,
    PbpConfig,
    PbpData,
    PbpFileEntry,
    PbpProject,
    PbpProjectMeta,
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
const RX_PROJECT_TAG = /<project\b([^>]*)>/i;

const RX_CONFIG_OPTIONS = /<options\b([^>]*)\/>/i;
const RX_CONFIG_COMMENT = /<comment\b[^>]*>([\s\S]*?)<\/comment>/i;

const RX_DATA_EXPLORER = /<explorer\b([^>]*)\/?>/i;
const RX_DATA_LOG = /<log\b([^>]*)\/?>/i;
const RX_DATA_LASTOPEN = /<lastopen\b([^>]*)\/?>/i;

const RX_FILE_ENTRY = /<file\b[^>]*\bname="([^"]+)"[^>]*>([\s\S]*?)<\/file>/gi;
const RX_FILE_ENTRY_SELF_CLOSED = /<file\b[^>]*\bname="([^"]+)"[^>]*\/>/gi;
const RX_FILE_CONFIG = /<config\b([^>]*)\/>/i;
const RX_FILE_FINGERPRINT = /<fingerprint\b([^>]*)\/>/i;

const RX_LIB_VALUE = /<library\b[^>]*\bvalue="([^"]*)"[^>]*\/>/gi;
const RX_LIB_KEY = /<key\b[^>]*\bname="Library\d+"[^>]*>\s*([\s\S]*?)\s*<\/key>/gi;

const RX_TARGET = /<target\b([^>]*)>([\s\S]*?)<\/target>/gi;
const RX_TARGET_COMPILER = /<compiler\b([^>]*)\/>/i;
const RX_TARGET_COMMANDLINE_TEXT = /<commandline\b[^>]*>([\s\S]*?)<\/commandline>/i;
const RX_TARGET_PURIFIER = /<purifier\b([^>]*)\/>/i;
const RX_TARGET_OPTIONS = /<options\b([^>]*)\/>/i;
const RX_TARGET_FORMAT = /<format\b([^>]*)\/>/i;
const RX_TARGET_ICON = /<icon\b([^>]*)>([\s\S]*?)<\/icon>/i;

const RX_TARGET_WARNINGS = /<warnings\b([^>]*)\/>/i;

const RX_TARGET_VERSIONINFO_SECTION = /<versioninfo\b([^>]*)>([\s\S]*?)<\/versioninfo>/i;
const RX_TARGET_VERSIONINFO_FIELD = /<(field\d+)\b([^>]*)\/>/gi;

const RX_TARGET_RESOURCES_SECTION = /<resources\b[^>]*>([\s\S]*?)<\/resources>/i;
const RX_TARGET_RESOURCE = /<resource\b([^>]*)\/>/gi;

const RX_TARGET_WATCHLIST = /<watchlist\b[^>]*>([\s\S]*?)<\/watchlist>/i;

const RX_TARGET_TEMPORARYEXE = /<temporaryexe\b([^>]*)\/>/i;
const RX_TARGET_COMPILECOUNT = /<compilecount\b([^>]*)\/>/i;
const RX_TARGET_BUILDCOUNT = /<buildcount\b([^>]*)\/>/i;

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
    const meta = parseProjectMeta(content);
    const config = parseProjectConfig(content);
    const data = parseProjectData(content);
    const files = parseProjectFiles(content, projectDir);
    const targets = parseProjectTargets(content, projectDir);
    const libraries = parseProjectLibraries(content);

    if (meta) {
        meta.presentSections = {
            config: extractSection(content, 'config') !== null,
            data: extractSection(content, 'data') !== null,
            files: extractSection(content, 'files') !== null,
            targets: extractSection(content, 'targets') !== null,
            libraries: extractSection(content, 'libraries') !== null,
        };
    }

    return {
        projectFile: projectFileFsPath,
        projectDir,
        meta,
        config,
        data,
        files,
        libraries,
        targets,
    };
}

function parseProjectMeta(content: string): PbpProjectMeta | undefined {
    const m = content.match(RX_PROJECT_TAG);
    if (!m) return undefined;
    const attrs = parseAttributes(m[1] ?? '');
    return { projectAttrs: attrs };
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

    const optionsMatch = configSection.match(RX_CONFIG_OPTIONS);
    const optionsAttrs = optionsMatch ? parseAttributes(optionsMatch[1] ?? '') : {};

    const commentMatch = configSection.match(RX_CONFIG_COMMENT);
    const commentPresent = !!commentMatch;

    return {
        name: (optionsAttrs['name'] ?? '').trim(),
        comment: decodeXmlEntities((commentMatch?.[1] ?? '').trim()),
        closefiles: parseBool(optionsAttrs['closefiles']),
        openmode: parseOptionalInt(optionsAttrs['openmode']) ?? 0,
        optionsAttrs: optionsAttrs,
        commentPresent,
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

    // Normal <file name="...">...</file>
    const fileRe = cloneGlobalRegex(RX_FILE_ENTRY);
    let m: RegExpExecArray | null;
    while ((m = fileRe.exec(filesSection)) !== null) {
        const rawPath = (m[1] ?? '').trim();
        const body = m[2] ?? '';

        const configMatch = body.match(RX_FILE_CONFIG);
        const configAttrs = configMatch ? parseAttributes(configMatch[1] ?? '') : undefined;

        const cfg = configAttrs ? {
            load: configAttrs['load'] !== undefined ? parseBool(configAttrs['load']) : undefined,
            scan: configAttrs['scan'] !== undefined ? parseBool(configAttrs['scan']) : undefined,
            panel: configAttrs['panel'] !== undefined ? parseBool(configAttrs['panel']) : undefined,
            warn: configAttrs['warn'] !== undefined ? parseBool(configAttrs['warn']) : undefined,
        } : undefined;

        const fingerprintMatch = body.match(RX_FILE_FINGERPRINT);
        const fingerprintAttrs = fingerprintMatch ? parseAttributes(fingerprintMatch[1] ?? '') : undefined;

        const meta = (configAttrs || fingerprintAttrs) ? {
            configAttrs,
            fingerprintAttrs,
        } : undefined;

        result.push({
            rawPath,
            fsPath: resolveProjectPath(projectDir, rawPath),
            config: cfg,
            meta,
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

        const directory = (attrs['directory'] ?? '').trim() || undefined;

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
        const optionAttrs = optMatch ? parseAttributes(optMatch[1] ?? '') : undefined;
        const options = optionAttrs ? parseBooleanLikeAttributes(optionAttrs) : {};

        const warningsMatch = body.match(RX_TARGET_WARNINGS);
        const warningsAttrs = warningsMatch ? parseAttributes(warningsMatch[1] ?? '') : undefined;
        const warnings = warningsAttrs
            ? {
                custom: warningsAttrs['custom'] !== undefined ? parseBool(warningsAttrs['custom']) : undefined,
                type: (warningsAttrs['type'] ?? '').trim() || undefined,
                attrs: warningsAttrs,
            }
            : undefined;

        const tempExeMatch = body.match(RX_TARGET_TEMPORARYEXE);
        const tempExeAttrs = tempExeMatch ? parseAttributes(tempExeMatch[1] ?? '') : undefined;
        const temporaryExe = (tempExeAttrs?.['value'] ?? '').trim() || undefined;

        const compileCountMatch = body.match(RX_TARGET_COMPILECOUNT);
        const compileCountAttrs = compileCountMatch ? parseAttributes(compileCountMatch[1] ?? '') : undefined;
        const compileCount = compileCountAttrs ? {
            enabled: parseBool(compileCountAttrs['enable']),
            value: parseOptionalInt(compileCountAttrs['value']),
        } : undefined;

        const buildCountMatch = body.match(RX_TARGET_BUILDCOUNT);
        const buildCountAttrs = buildCountMatch ? parseAttributes(buildCountMatch[1] ?? '') : undefined;
        const buildCount = buildCountAttrs ? {
            enabled: parseBool(buildCountAttrs['enable']),
            value: parseOptionalInt(buildCountAttrs['value']),
        } : undefined;

        const fmtMatch = body.match(RX_TARGET_FORMAT);
        const format = fmtMatch ? parseAttributes(fmtMatch[1] ?? '') : undefined;

        const iconMatch = body.match(RX_TARGET_ICON);
        const iconAttrs = iconMatch ? parseAttributes(iconMatch[1] ?? '') : undefined;
        const iconText = iconMatch ? decodeXmlEntities((iconMatch[2] ?? '').trim()) : '';

        const constants = parseTargetConstants(body);

        const versionInfo = parseTargetVersionInfo(body);
        const resources = parseTargetResources(body);

        const watchListMatch = body.match(RX_TARGET_WATCHLIST);
        const watchList = watchListMatch ? decodeXmlEntities((watchListMatch[1] ?? '').trim()) : undefined;

        result.push({
            name,
            enabled,
            isDefault,
            directory,
            targetAttrs: attrs,
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
            optionAttrs,
            temporaryExe: temporaryExe,
            compileCount,
            buildCount,
            compilerVersion,
            commandLine,
            subsystem,
            purifier: purifierMatch ? { enabled: purifierEnabled, granularity: purifierGranularity } : undefined,
            warnings,
            format,
            icon: iconText
                ? {
                    enabled: parseBool(iconAttrs?.['enable']),
                    rawPath: iconText,
                    fsPath: resolveProjectPath(projectDir, iconText),
                }
                : undefined,
            versionInfo,
            resources,
            watchList,
            constants,
        });
    }

    return result;
}

function parseTargetVersionInfo(targetBody: string): PbpTarget['versionInfo'] {
    const m = targetBody.match(RX_TARGET_VERSIONINFO_SECTION);
    if (!m) return undefined;

    const attrs = parseAttributes(m[1] ?? '');
    const enabled = parseBool(attrs['enable']);
    const body = m[2] ?? '';

    const fields: Array<{ id: string; value: string }> = [];
    const re = cloneGlobalRegex(RX_TARGET_VERSIONINFO_FIELD);
    let fm: RegExpExecArray | null;
    while ((fm = re.exec(body)) !== null) {
        const id = (fm[1] ?? '').trim();
        const fAttrs = parseAttributes(fm[2] ?? '');
        const value = decodeXmlEntities((fAttrs['value'] ?? '').trim());
        fields.push({ id, value });
    }

    // Deterministic, but keep semantic ordering by numeric suffix.
    fields.sort((a, b) => {
        const an = parseOptionalInt(a.id.replace(/^field/i, '')) ?? 0;
        const bn = parseOptionalInt(b.id.replace(/^field/i, '')) ?? 0;
        if (an !== bn) return an - bn;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    return { enabled, fields };
}

function parseTargetResources(targetBody: string): PbpTarget['resources'] {
    const m = targetBody.match(RX_TARGET_RESOURCES_SECTION);
    if (!m) return undefined;

    const body = m[1] ?? '';
    const items: string[] = [];

    const re = cloneGlobalRegex(RX_TARGET_RESOURCE);
    let rm: RegExpExecArray | null;
    while ((rm = re.exec(body)) !== null) {
        const attrs = parseAttributes(rm[1] ?? '');
        const v = decodeXmlEntities((attrs['value'] ?? '').trim());
        if (v) items.push(v);
    }

    return { items };
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

function parseMaybeBool(v: string | undefined): boolean | undefined {
    if (v === undefined) return undefined;
    const t = v.trim().toLowerCase();
    if (!t) return undefined;
    if (t === '1' || t === 'true' || t === 'yes') return true;
    if (t === '0' || t === 'false' || t === 'no') return false;
    return undefined;
}

function parseBooleanLikeAttributes(raw: Record<string, string>): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(raw)) {
        const b = parseMaybeBool(v);
        if (b !== undefined) out[k] = b;
    }
    return out;
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

function decodeXmlEntities(s: string): string {
    // Keep it small and dependency-free; .pbp usually doesn't encode much beyond these.
    return s
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}
