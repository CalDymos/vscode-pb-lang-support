/*
 * @caldymos/pb-project-core
 *
 * PureBasic Project (.pbp) parser library.
 *
 * - Parses XML-based .pbp files (PureBasic >= 6.21)
 * - Extracts source file references
 * - Extracts project configuration metadata
 * - Best-effort parsing for additional target compiler options
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
    PbpFileConfig,
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
    PbpFileConfig,
    PbpProject,
    PbpProjectMeta,
    PbpTarget,
    PbpTargetValue,
} from './model';

import { resolveProjectPath, resolveTargetPath } from './resolve';

// --------------------------------------------------------------------------------------
// Regex constants
//
// Note: Any regex used with .exec() in a loop must be cloned per use because RegExp objects
// with the global flag keep state via lastIndex.
// --------------------------------------------------------------------------------------

const RX_XML_PROJECT_HEADER = /<\?xml\b[\s\S]*?<project\b/i;
const RX_PROJECT_OPEN = /<project\b([^>]*)>/i;

const RX_SECTION_BLOCK = /<section\b([^>]*)\bname="([^"]+)"([^>]*)>([\s\S]*?)<\/section>/gi;

const RX_CONFIG_OPTIONS = /<options\b([^>]*)\/>/i;
const RX_CONFIG_COMMENT = /<comment\b[^>]*>([\s\S]*?)<\/comment>/i;

const RX_DATA_EXPLORER = /<explorer\b([^>]*)\/>/i;
const RX_DATA_LOG = /<log\b([^>]*)\/>/i;
const RX_DATA_LASTOPEN = /<lastopen\b([^>]*)\/>/i;

const RX_FILE_ENTRY = /<file\b[^>]*\bname="([^"]+)"[^>]*>([\s\S]*?)<\/file>/gi;
const RX_FILE_ENTRY_SELF_CLOSED = /<file\b[^>]*\bname="([^"]+)"[^>]*\/>/gi;
const RX_FILE_CONFIG = /<config\b([^>]*)\/>/i;
const RX_FILE_FINGERPRINT = /<fingerprint\b([^>]*)\/>/i;

const RX_LIB_VALUE = /<library\b[^>]*\bvalue="([^"]*)"[^>]*\/>/gi;
const RX_LIB_KEY = /<key\b[^>]*\bname="Library\d+"[^>]*>\s*([\s\S]*?)\s*<\/key>/gi;

const RX_TARGET = /<target\b([^>]*)>([\s\S]*?)<\/target>/gi;
const RX_TARGET_COMPILER = /<compiler\b([^>]*)\/>/i;
const RX_TARGET_COMMANDLINE = /<commandline\b[^>]*\/>/gi;
const RX_TARGET_PURIFIER = /<purifier\b([^>]*)\/>/i;
const RX_TARGET_OPTIONS = /<options\b([^>]*)\/>/i;
const RX_TARGET_FORMAT = /<format\b([^>]*)\/>/i;
const RX_TARGET_ICON = /<icon\b([^>]*)>([\s\S]*?)<\/icon>/i;

const RX_TARGET_DEBUGGER = /<debugger\b([^>]*)\/>/i;
const RX_TARGET_WARNINGS = /<warnings\b([^>]*)\/>/i;
const RX_TARGET_COMPILECOUNT = /<compilecount\b([^>]*)\/>/i;
const RX_TARGET_BUILDCOUNT = /<buildcount\b([^>]*)\/>/i;
const RX_TARGET_EXECONSTANT = /<execonstant\b([^>]*)\/>/i;

const RX_TARGET_VERSIONINFO = /<versioninfo\b([^>]*)>([\s\S]*?)<\/versioninfo>/i;
const RX_TARGET_VERSIONINFO_FIELD = /<(field\d+)\b([^>]*)\/>/gi;

const RX_TARGET_RESOURCES = /<resources\b[^>]*>([\s\S]*?)<\/resources>/i;
const RX_TARGET_RESOURCE = /<resource\b[^>]*\bvalue="([^"]*)"[^>]*\/>/gi;

const RX_TARGET_WATCHLIST = /<watchlist\b[^>]*>([\s\S]*?)<\/watchlist>/i;

const RX_TARGET_CONSTANTS_SECTION = /<constants\b[^>]*>([\s\S]*?)<\/constants>/i;
const RX_TARGET_CONSTANT = /<constant\b([^>]*)\/>/gi;

const RX_VALUE_ATTR_TEMPLATE = `<__TAG__\\b[^>]*\\bvalue="([^"]*)"[^>]*\\/>`; // Usage: new RegExp(RX_VALUE_ATTR_TEMPLATE.replace('__TAG__', escapeRegExp(tagName)), 'i');
const RX_VALUE_ATTR_FLAGS = 'i';

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
    if (v === undefined) return undefined;
    const t = String(v).trim();
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
    void options;

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
    const { sections, sectionOrder } = extractSections(content);
    const projectAttrs = parseProjectAttrs(content);

    const presentSections: Record<string, boolean> = {};
    for (const name of sectionOrder) {
        presentSections[name] = true;
    }

    const unknownSections: Record<string, string> = {};
    for (const name of sectionOrder) {
        if (!isModeledSection(name)) {
            const raw = sections.get(name)?.raw;
            if (raw) unknownSections[name] = raw;
        }
    }

    const config = parseProjectConfig(sections.get('config')?.body ?? null);
    const data = parseProjectData(sections.get('data')?.body ?? null);
    const files = parseProjectFiles(sections.get('files')?.body ?? null, projectDir);
    const targets = parseProjectTargets(sections.get('targets')?.body ?? null, projectDir);
    const libraries = parseProjectLibraries(sections.get('libraries')?.body ?? null);

    const meta: PbpProjectMeta = {
        projectAttrs,
        sectionOrder,
        presentSections,
        unknownSections: Object.keys(unknownSections).length > 0 ? unknownSections : undefined,
    };

    return {
        projectFile: projectFileFsPath,
        projectDir,
        config,
        data,
        files,
        libraries,
        targets,
        meta,
    };
}

function isModeledSection(name: string): boolean {
    return name === 'config' || name === 'data' || name === 'files' || name === 'targets' || name === 'libraries';
}

function parseProjectAttrs(content: string): Record<string, string> {
    const m = content.match(RX_PROJECT_OPEN);
    return m ? parseAttributes(m[1] ?? '') : {};
}

function extractSections(content: string): { sections: Map<string, { attrsText: string; body: string; raw: string }>; sectionOrder: string[] } {
    const sections = new Map<string, { attrsText: string; body: string; raw: string }>();
    const sectionOrder: string[] = [];

    const re = cloneGlobalRegex(RX_SECTION_BLOCK);
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
        const attrsText = `${m[1] ?? ''}${m[3] ?? ''}`;
        const name = (m[2] ?? '').trim();
        const body = m[4] ?? '';
        const raw = m[0] ?? '';

        if (!name) continue;
        sections.set(name, { attrsText, body, raw });
        sectionOrder.push(name);
    }

    return { sections, sectionOrder };
}

function parseProjectConfig(configSection: string | null): PbpConfig {
    if (!configSection) {
        return {
            name: '',
            comment: '',
            closefiles: false,
            openmode: 0,
        };
    }

    const optMatch = configSection.match(RX_CONFIG_OPTIONS);
    const optAttrs = optMatch ? parseAttributes(optMatch[1] ?? '') : {};

    const commentMatch = configSection.match(RX_CONFIG_COMMENT);
    const commentText = decodeXmlEntities((commentMatch?.[1] ?? '').trim());

    // Preserve unmodeled XML inside config section.
    let extra = configSection;
    extra = extra.replace(RX_CONFIG_OPTIONS, '');
    extra = extra.replace(RX_CONFIG_COMMENT, '');
    extra = extra.trim();

    return {
        name: (optAttrs['name'] ?? '').trim(),
        comment: commentText,
        closefiles: parseBool(optAttrs['closefiles']),
        openmode: parseOptionalInt(optAttrs['openmode']) ?? 0,
        meta: {
            optionsAttrs: optMatch ? optAttrs : undefined,
            hasComment: !!commentMatch,
            extraXml: extra || undefined,
        },
    };
}

function parseProjectData(dataSection: string | null): PbpData {
    if (!dataSection) return {};

    const explorerMatch = dataSection.match(RX_DATA_EXPLORER);
    const explorerAttrs = explorerMatch ? parseAttributes(explorerMatch[1] ?? '') : undefined;

    const logMatch = dataSection.match(RX_DATA_LOG);
    const logAttrs = logMatch ? parseAttributes(logMatch[1] ?? '') : undefined;

    const lastOpenMatch = dataSection.match(RX_DATA_LASTOPEN);
    const lastopenAttrs = lastOpenMatch ? parseAttributes(lastOpenMatch[1] ?? '') : undefined;

    const explorer = explorerAttrs
        ? {
              view: explorerAttrs['view'] ?? undefined,
              pattern: parseOptionalInt(explorerAttrs['pattern']),
          }
        : undefined;

    const log = logAttrs
        ? {
              show: logAttrs['show'] !== undefined ? parseBool(logAttrs['show']) : undefined,
          }
        : undefined;

    const lastopen = lastopenAttrs
        ? {
              date: (lastopenAttrs['date'] ?? '').trim() || undefined,
              user: (lastopenAttrs['user'] ?? '').trim() || undefined,
              host: (lastopenAttrs['host'] ?? '').trim() || undefined,
          }
        : undefined;

    let extra = dataSection;
    extra = extra.replace(RX_DATA_EXPLORER, '');
    extra = extra.replace(RX_DATA_LOG, '');
    extra = extra.replace(RX_DATA_LASTOPEN, '');
    extra = extra.trim();

    return {
        explorer,
        log,
        lastopen,
        meta: {
            extraXml: extra || undefined,
        },
    };
}

function parseProjectFiles(filesSection: string | null, projectDir: string): PbpFileEntry[] {
    if (!filesSection) return [];

    const result: PbpFileEntry[] = [];

    // Normal <file name="..."> ... </file>
    const fileRe = cloneGlobalRegex(RX_FILE_ENTRY);
    let m: RegExpExecArray | null;
    while ((m = fileRe.exec(filesSection)) !== null) {
        const rawPath = (m[1] ?? '').trim();
        const body = m[2] ?? '';

        const configMatch = body.match(RX_FILE_CONFIG);
        const configAttrs = configMatch ? parseAttributes(configMatch[1] ?? '') : undefined;

        const cfg: PbpFileConfig | undefined = configAttrs
            ? {
                  load: configAttrs['load'] !== undefined ? parseBool(configAttrs['load']) : undefined,
                  scan: configAttrs['scan'] !== undefined ? parseBool(configAttrs['scan']) : undefined,
                  panel: configAttrs['panel'] !== undefined ? parseBool(configAttrs['panel']) : undefined,
                  warn: configAttrs['warn'] !== undefined ? parseBool(configAttrs['warn']) : undefined,
                  lastopen: configAttrs['lastopen'] !== undefined ? parseBool(configAttrs['lastopen']) : undefined,
                  sortindex: parseOptionalInt(configAttrs['sortindex']),
                  panelstate: (configAttrs['panelstate'] ?? '').trim() || undefined,
                  attrs: configAttrs,
              }
            : undefined;

        const fpMatch = body.match(RX_FILE_FINGERPRINT);
        const fingerprint = fpMatch ? parseAttributes(fpMatch[1] ?? '') : undefined;

        let extra = body;
        extra = extra.replace(RX_FILE_CONFIG, '');
        extra = extra.replace(RX_FILE_FINGERPRINT, '');
        extra = extra.trim();

        result.push({
            rawPath,
            fsPath: resolveProjectPath(projectDir, rawPath),
            config: cfg,
            fingerprint,
            meta: {
                extraXml: extra || undefined,
            },
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

function parseProjectLibraries(librariesSection: string | null): string[] {
    // Best-effort parsing: PureBasic stores libraries inconsistently across versions.
    // Common patterns observed:
    //  - <section name="libraries"> ... <library value="..."/> ... </section>
    //  - <section name="libraries"> ... <key name="Library0">...</key> ... </section>
    if (!librariesSection) return [];

    const libs: string[] = [];

    const valueRe = cloneGlobalRegex(RX_LIB_VALUE);
    let m: RegExpExecArray | null;
    while ((m = valueRe.exec(librariesSection)) !== null) {
        const v = decodeXmlEntities((m[1] ?? '').trim());
        if (v) libs.push(v);
    }

    const keyRe = cloneGlobalRegex(RX_LIB_KEY);
    while ((m = keyRe.exec(librariesSection)) !== null) {
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

function parseProjectTargets(targetsSection: string | null, projectDir: string): PbpTarget[] {
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

        const targetAttrs: Record<string, string> = { ...attrs };
        delete targetAttrs['name'];
        delete targetAttrs['enabled'];
        delete targetAttrs['default'];

        const presentNodes: Record<string, boolean> = {
            inputfile: containsTag(body, 'inputfile'),
            outputfile: containsTag(body, 'outputfile'),
            executable: containsTag(body, 'executable'),
            directory: containsTag(body, 'directory') || attrs['directory'] !== undefined,
            compiler: containsTag(body, 'compiler'),
            commandline: containsTag(body, 'commandline'),
            options: containsTag(body, 'options'),
            purifier: containsTag(body, 'purifier'),
            temporaryexe: containsTag(body, 'temporaryexe'),
            subsystem: containsTag(body, 'subsystem'),
            linker: containsTag(body, 'linker'),
            icon: containsTag(body, 'icon'),
            format: containsTag(body, 'format'),
            debugger: containsTag(body, 'debugger'),
            warnings: containsTag(body, 'warnings'),
            compilecount: containsTag(body, 'compilecount'),
            buildcount: containsTag(body, 'buildcount'),
            execonstant: containsTag(body, 'execonstant'),
            constants: containsTag(body, 'constants'),
            versioninfo: containsTag(body, 'versioninfo'),
            resources: containsTag(body, 'resources'),
            watchlist: containsTag(body, 'watchlist'),
        };

        const inputRaw = extractValueAttr(body, 'inputfile');
        const outputRaw = extractValueAttr(body, 'outputfile');
        const exeRaw = extractValueAttr(body, 'executable');

        // Directory may be stored as target attribute or as a nested tag.
        const dirTagRaw = extractValueAttr(body, 'directory');
        const directory = (dirTagRaw || (attrs['directory'] ?? '')).trim();

        const compilerMatch = body.match(RX_TARGET_COMPILER);
        const compilerAttrs = compilerMatch ? parseAttributes(compilerMatch[1] ?? '') : undefined;
        const compilerVersion = (compilerAttrs?.['version'] ?? '').trim() || undefined;

        const commandLine = extractValueAttr(body, 'commandline');

        const subsystemRaw = extractValueAttr(body, 'subsystem');
        const subsystem = subsystemRaw ? subsystemRaw : undefined;

        const tempExeRaw = extractValueAttr(body, 'temporaryexe');
        const temporaryExe = tempExeRaw ? tempExeRaw : undefined;

        const linkerRaw = extractValueAttr(body, 'linker');
        const linker: PbpTargetValue | undefined = linkerRaw
            ? {
                  rawPath: linkerRaw,
                  fsPath: resolveTargetPath(projectDir, linkerRaw),
              }
            : undefined;

        const purifierMatch = body.match(RX_TARGET_PURIFIER);
        const purifierAttrs = purifierMatch ? parseAttributes(purifierMatch[1] ?? '') : undefined;
        const purifierEnabled = purifierAttrs ? parseBool(purifierAttrs['enable']) : false;
        const purifierGranularity = purifierAttrs?.['granularity'];

        const optMatch = body.match(RX_TARGET_OPTIONS);
        const optionsAttrs = optMatch ? parseAttributes(optMatch[1] ?? '') : undefined;
        const options = optionsAttrs ? parseBooleanMap(optionsAttrs) : {};

        const fmtMatch = body.match(RX_TARGET_FORMAT);
        const format = fmtMatch ? parseAttributes(fmtMatch[1] ?? '') : undefined;

        const iconMatch = body.match(RX_TARGET_ICON);
        const iconAttrs = iconMatch ? parseAttributes(iconMatch[1] ?? '') : undefined;
        const iconText = iconMatch ? decodeXmlEntities((iconMatch[2] ?? '').trim()) : '';

        const debuggerMatch = body.match(RX_TARGET_DEBUGGER);
        const debuggerAttrs = debuggerMatch ? parseAttributes(debuggerMatch[1] ?? '') : undefined;

        const warningsMatch = body.match(RX_TARGET_WARNINGS);
        const warningsAttrs = warningsMatch ? parseAttributes(warningsMatch[1] ?? '') : undefined;

        const compileCountMatch = body.match(RX_TARGET_COMPILECOUNT);
        const compileCountAttrs = compileCountMatch ? parseAttributes(compileCountMatch[1] ?? '') : undefined;

        const buildCountMatch = body.match(RX_TARGET_BUILDCOUNT);
        const buildCountAttrs = buildCountMatch ? parseAttributes(buildCountMatch[1] ?? '') : undefined;

        const exeConstantMatch = body.match(RX_TARGET_EXECONSTANT);
        const exeConstantAttrs = exeConstantMatch ? parseAttributes(exeConstantMatch[1] ?? '') : undefined;

        const constants = parseTargetConstants(body);

        const versionInfo = parseTargetVersionInfo(body);
        const resources = parseTargetResources(body);
        const watchList = parseTargetWatchList(body);

        let extra = body;
        // Remove known tags (best-effort, non-destructive for nested data).
        extra = extra.replace(/<inputfile\b[\s\S]*?\/>/gi, '');
        extra = extra.replace(/<outputfile\b[\s\S]*?\/>/gi, '');
        extra = extra.replace(/<executable\b[\s\S]*?\/>/gi, '');
        extra = extra.replace(/<directory\b[\s\S]*?\/>/gi, '');
        extra = extra.replace(RX_TARGET_COMPILER, '');
        extra = extra.replace(cloneGlobalRegex(RX_TARGET_COMMANDLINE), '');
        extra = extra.replace(RX_TARGET_PURIFIER, '');
        extra = extra.replace(RX_TARGET_OPTIONS, '');
        extra = extra.replace(RX_TARGET_FORMAT, '');
        extra = extra.replace(/<icon\b[\s\S]*?<\/icon>/gi, '');
        extra = extra.replace(/<temporaryexe\b[\s\S]*?\/>/gi, '');
        extra = extra.replace(/<subsystem\b[\s\S]*?\/>/gi, '');
        extra = extra.replace(/<linker\b[\s\S]*?\/>/gi, '');
        extra = extra.replace(RX_TARGET_DEBUGGER, '');
        extra = extra.replace(RX_TARGET_WARNINGS, '');
        extra = extra.replace(RX_TARGET_COMPILECOUNT, '');
        extra = extra.replace(RX_TARGET_BUILDCOUNT, '');
        extra = extra.replace(RX_TARGET_EXECONSTANT, '');
        extra = extra.replace(/<constants\b[\s\S]*?<\/constants>/gi, '');
        extra = extra.replace(/<versioninfo\b[\s\S]*?<\/versioninfo>/gi, '');
        extra = extra.replace(/<resources\b[\s\S]*?<\/resources>/gi, '');
        extra = extra.replace(/<watchlist\b[\s\S]*?<\/watchlist>/gi, '');
        extra = extra.trim();

        result.push({
            name,
            enabled,
            isDefault,
            directory,
            inputFile: {
                rawPath: inputRaw,
                fsPath: resolveTargetPath(projectDir, inputRaw),
            },
            outputFile: {
                rawPath: outputRaw,
                fsPath: resolveTargetPath(projectDir, outputRaw),
            },
            executable: {
                rawPath: exeRaw,
                fsPath: resolveTargetPath(projectDir, exeRaw),
            },
            options,
            optionsAttrs,
            compilerVersion,
            commandLine,
            subsystem,
            temporaryExe,
            linker,
            purifier: purifierMatch
                ? {
                      enabled: purifierEnabled,
                      granularity: purifierGranularity,
                      attrs: purifierAttrs,
                  }
                : undefined,
            format,
            icon: iconText
                ? {
                      enabled: parseBool(iconAttrs?.['enable']),
                      rawPath: iconText,
                      fsPath: resolveTargetPath(projectDir, iconText),
                      attrs: iconAttrs,
                  }
                : undefined,
            debugger: debuggerAttrs
                ? {
                      custom: debuggerAttrs['custom'] !== undefined ? parseBool(debuggerAttrs['custom']) : undefined,
                      type: (debuggerAttrs['type'] ?? '').trim() || undefined,
                      attrs: debuggerAttrs,
                  }
                : undefined,
            warnings: warningsAttrs
                ? {
                      custom: warningsAttrs['custom'] !== undefined ? parseBool(warningsAttrs['custom']) : undefined,
                      type: (warningsAttrs['type'] ?? '').trim() || undefined,
                      attrs: warningsAttrs,
                  }
                : undefined,
            compileCount: compileCountAttrs
                ? {
                      enabled: parseBool(compileCountAttrs['enable']),
                      value: parseOptionalInt(compileCountAttrs['value']),
                      attrs: compileCountAttrs,
                  }
                : undefined,
            buildCount: buildCountAttrs
                ? {
                      enabled: parseBool(buildCountAttrs['enable']),
                      value: parseOptionalInt(buildCountAttrs['value']),
                      attrs: buildCountAttrs,
                  }
                : undefined,
            exeConstant: exeConstantAttrs
                ? {
                      enabled: parseBool(exeConstantAttrs['enable']),
                      attrs: exeConstantAttrs,
                  }
                : undefined,
            constants,
            versionInfo,
            resources,
            watchList,
            meta: {
                targetAttrs: Object.keys(targetAttrs).length > 0 ? targetAttrs : undefined,
                presentNodes,
                extraXml: extra || undefined,
            },
        });
    }

    return result;
}

function parseTargetVersionInfo(targetBody: string): PbpTarget['versionInfo'] | undefined {
    const m = targetBody.match(RX_TARGET_VERSIONINFO);
    if (!m) return undefined;

    const attrs = parseAttributes(m[1] ?? '');
    const body = m[2] ?? '';

    const fields: Array<{ id: string; value: string }> = [];
    const re = cloneGlobalRegex(RX_TARGET_VERSIONINFO_FIELD);
    let fm: RegExpExecArray | null;
    while ((fm = re.exec(body)) !== null) {
        const id = (fm[1] ?? '').trim();
        const fAttrs = parseAttributes(fm[2] ?? '');
        const value = decodeXmlEntities((fAttrs['value'] ?? '').trim());
        if (id) {
            fields.push({ id, value });
        }
    }

    fields.sort((a, b) => {
        const ai = parseInt(a.id.replace(/^field/i, ''), 10);
        const bi = parseInt(b.id.replace(/^field/i, ''), 10);
        if (Number.isFinite(ai) && Number.isFinite(bi)) return ai - bi;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    return {
        enabled: parseBool(attrs['enable']),
        attrs,
        fields,
    };
}

function parseTargetResources(targetBody: string): string[] | undefined {
    const m = targetBody.match(RX_TARGET_RESOURCES);
    if (!m) return undefined;

    const body = m[1] ?? '';
    const out: string[] = [];
    const re = cloneGlobalRegex(RX_TARGET_RESOURCE);
    let rm: RegExpExecArray | null;
    while ((rm = re.exec(body)) !== null) {
        const v = decodeXmlEntities((rm[1] ?? '').trim());
        if (v) out.push(v);
    }
    return out;
}

function parseTargetWatchList(targetBody: string): string | undefined {
    const m = targetBody.match(RX_TARGET_WATCHLIST);
    if (!m) return undefined;
    const txt = decodeXmlEntities((m[1] ?? '').trim());
    return txt || undefined;
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
            result.push({ enabled, value }); //push also empty values to preserve round-trip consistency
    }

    return result;
}

function extractValueAttr(targetBody: string, tagName: string): string {
    const re = new RegExp(RX_VALUE_ATTR_TEMPLATE.replace('__TAG__', escapeRegExp(tagName)), RX_VALUE_ATTR_FLAGS);
    const m = targetBody.match(re);
    return decodeXmlEntities((m?.[1] ?? '').trim());
}

function containsTag(body: string, tagName: string): boolean {
    const re = new RegExp(`<${escapeRegExp(tagName)}\\b`, 'i');
    return re.test(body);
}

function normalizeNewlines(content: string): string {
    return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function parseBool(v: string | undefined): boolean {
    if (v === undefined) return false;
    const t = String(v).trim().toLowerCase();
    return t === '1' || t === 'true' || t === 'yes';
}

function parseAttributes(attrText: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const re = /([:\w-]+)\s*=\s*"([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(attrText)) !== null) {
        attrs[m[1]] = decodeXmlEntities(m[2]);
    }
    return attrs;
}

function parseBooleanMap(attrs: Record<string, string>): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(attrs)) {
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
