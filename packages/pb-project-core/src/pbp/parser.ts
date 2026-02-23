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
type integer = number;

export interface PbpProject {
    /** Absolute filesystem path to the .pbp file */
    projectFile: string;
    /** Absolute filesystem path to the project directory */
    projectDir: string;
    config: PbpConfig;
    data: PbpData;
    files: PbpFileEntry[];
    /** Project libraries (best-effort; may be empty if not specified in the .pbp) */
    libraries: string[];
    targets: PbpTarget[];
}

export interface PbpConfig {
    closefiles: boolean;
    openmode: integer;
    /** Project name (from <section name="config"><options name="..."/>) */
    name: string;
    /** Project comment (from <section name="config"><comment>...</comment>) */
    comment: string;
}

export interface PbpData {
    explorer?: {
        view?: string;
        pattern?: integer;
    };
    log?: {
        show?: boolean;
    };
    lastopen?: {
        date?: string;
        user?: string;
        host?: string;
    };
}

export interface PbpFileEntry {
    /** File name/path as stored in the .pbp (usually relative to the project file) */
    rawPath: string;
    /** Resolved absolute filesystem path */
    fsPath: string;
    /** Optional file flags as stored in the project */
    config?: {
        load?: boolean;
        scan?: boolean;
        panel?: boolean;
        warn?: boolean;
    };
}

export interface PbpTarget {
    name: string;
    enabled: boolean;
    isDefault: boolean;
    inputFile: PbpTargetValue;
    outputFile: PbpTargetValue;
    executable: PbpTargetValue;
    directory: string;
    options: Record<string, boolean>;
    /** Compiler version string as stored in <compiler version="..."/> */
    compilerVersion?: string;
    /** Optional additional command line args as stored in the project file (best-effort). */
    commandLine?: string;
    /** Subsystem name as stored in <subsystem value="..."/> */
    subsystem?: string;
    purifier?: {
        enabled: boolean;
        granularity?: string;
    };
    format?: Record<string, string>;
    icon?: {
        enabled: boolean;
        rawPath: string;
        fsPath: string;
    };
    constants: Array<{
        enabled: boolean;
        value: string;
    }>;
}

export interface PbpTargetValue {
    rawPath: string;
    fsPath: string;
}

export interface ParsePbpOptions {
    /** If true, attempt to parse legacy INI format as fallback. Default: true */
    isSpiderBasic?: boolean;
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
    if (/<\?xml\b[\s\S]*?<project\b/i.test(normalized)) {
        return parseXmlProject(normalized, projectFileFsPath, projectDir);
    }

    return null;
}

export function selectDefaultTarget(project: PbpProject): PbpTarget | null {
    const explicitDefault = project.targets.find(t => t.enabled && t.isDefault);
    if (explicitDefault) return explicitDefault;
    const firstEnabled = project.targets.find(t => t.enabled);
    return firstEnabled ?? null;
}

export function getProjectSourceFiles(project: PbpProject): string[] {
    return project.files
        .map(f => f.fsPath)
        .filter(p => p.toLowerCase().endsWith('.pb'));
}

export function getProjectIncludeFiles(project: PbpProject): string[] {
    return project.files
        .map(f => f.fsPath)
        .filter(p => p.toLowerCase().endsWith('.pbi'));
}

export function getProjectIncludeDirectories(project: PbpProject): string[] {
    const dirs = new Set<string>();
    dirs.add(project.projectDir);

    for (const inc of getProjectIncludeFiles(project)) {
        dirs.add(path.dirname(inc));
    }

    return Array.from(dirs);
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

    const name = configSection.match(/<options\b[^>]*\bname="([^"]*)"[^>]*\/>/i);
    const comment = configSection.match(/<comment\b[^>]*>([\s\S]*?)<\/comment>/i);

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

    const explorerMatch = dataSection.match(/<explorer\b([^>]*)\/?>/i);
    const explorerAttrs = explorerMatch ? parseAttributes(explorerMatch[1] ?? '') : undefined;

    const logMatch = dataSection.match(/<log\b([^>]*)\/?>/i);
    const logAttrs = logMatch ? parseAttributes(logMatch[1] ?? '') : undefined;

    const lastOpenMatch = dataSection.match(/<lastopen\b([^>]*)\/?>/i);
    const lastopenAttrs = lastOpenMatch ? parseAttributes(lastOpenMatch[1] ?? '') : undefined;

    const explorer = explorerAttrs ? {
        view: explorerAttrs['view'] ?? undefined,
        pattern: (explorerAttrs['pattern'] ?? '') !== ''
            ? parseInt(explorerAttrs['pattern']!, 10)
            : undefined,
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
    const fileRe = /<file\b[^>]*\bname="([^"]+)"[^>]*>([\s\S]*?)<\/file>/gi;
    let m: RegExpExecArray | null;
    while ((m = fileRe.exec(filesSection)) !== null) {
        const rawPath = (m[1] ?? '').trim();
        const body = m[2] ?? '';

        const configMatch = body.match(/<config\b([^>]*)\/>/i);
        const cfg = configMatch ? parseBooleanAttributes(configMatch[1] ?? '') : undefined;

        result.push({
            rawPath,
            fsPath: resolveProjectPath(projectDir, rawPath),
            config: cfg,
        });
    }

    // Self-closed <file name="..."/>
    const fileSelfRe = /<file\b[^>]*\bname="([^"]+)"[^>]*\/>/gi;
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

    const valueRe = /<library\b[^>]*\bvalue="([^"]*)"[^>]*\/>/gi;
    let m: RegExpExecArray | null;
    while ((m = valueRe.exec(section)) !== null) {
        const v = decodeXmlEntities((m[1] ?? '').trim());
        if (v) libs.push(v);
    }

    const keyRe = /<key\b[^>]*\bname="Library\d+"[^>]*>\s*([\s\S]*?)\s*<\/key>/gi;
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

    const targetRe = /<target\b([^>]*)>([\s\S]*?)<\/target>/gi;
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

        const compilerMatch = body.match(/<compiler\b([^>]*)\/>/i);
        const compilerAttrs = compilerMatch ? parseAttributes(compilerMatch[1] ?? '') : undefined;
        const compilerVersion = (compilerAttrs?.['version'] ?? '').trim() || undefined;

        const commandLineRaw = extractValueAttr(body, 'commandline');
        const commandLineTextMatch = !commandLineRaw ? body.match(/<commandline\b[^>]*>([\s\S]*?)<\/commandline>/i) : null;
        const commandLine = (commandLineRaw || decodeXmlEntities((commandLineTextMatch?.[1] ?? '').trim())) || undefined;

        const subsystemRaw = extractValueAttr(body, 'subsystem');
        const subsystem = subsystemRaw ? subsystemRaw : undefined;

        const purifierMatch = body.match(/<purifier\b([^>]*)\/>/i);
        const purifierAttrs = purifierMatch ? parseAttributes(purifierMatch[1] ?? '') : undefined;
        const purifierEnabled = purifierAttrs ? parseBool(purifierAttrs['enable']) : false;
        const purifierGranularity = purifierAttrs?.['granularity'];

        const optMatch = body.match(/<options\b([^>]*)\/>/i);
        const options = optMatch ? parseBooleanAttributes(optMatch[1] ?? '') : {};

        const fmtMatch = body.match(/<format\b([^>]*)\/>/i);
        const format = fmtMatch ? parseAttributes(fmtMatch[1] ?? '') : undefined;

        const iconMatch = body.match(/<icon\b([^>]*)>([\s\S]*?)<\/icon>/i);
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
    const constantsSectionMatch = targetBody.match(/<constants\b[^>]*>([\s\S]*?)<\/constants>/i);
    if (!constantsSectionMatch) return [];

    const constantsBody = constantsSectionMatch[1] ?? '';
    const result: Array<{ enabled: boolean; value: string }> = [];

    const constRe = /<constant\b([^>]*)\/>/gi;
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
    const re = new RegExp(`<${tagName}\\b[^>]*\\bvalue="([^"]*)"[^>]*\\/>`, 'i');
    const m = targetBody.match(re);
    return decodeXmlEntities((m?.[1] ?? '').trim());
}

function extractSection(content: string, sectionName: string): string | null {
    const re = new RegExp(`<section\\b[^>]*\\bname="${escapeRegExp(sectionName)}"[^>]*>([\\s\\S]*?)<\\/section>`, 'i');
    const m = content.match(re);
    return m ? (m[1] ?? '') : null;
}

function normalizeNewlines(content: string): string {
    return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function resolveProjectPath(projectDir: string, rawPath: string): string {
    const p = normalizeRawProjectPath(rawPath);
    if (!p) return '';

    if (isAbsoluteCrossPlatform(p)) {
        return p;
    }

    return path.normalize(path.join(projectDir, p));
}

function normalizeRawProjectPath(rawPath: string): string {
    let p = rawPath.trim();
    if (!p) return '';

    // Strip leading ./ or .\\
    p = p.replace(/^\.\/[\\/]/, '');
    p = p.replace(/^\.\\/, '');

    // Keep the original separator style but normalize for path.join()
    p = p.replace(/[\\/]+/g, path.sep);
    return p;
}

function isAbsoluteCrossPlatform(p: string): boolean {
    // POSIX absolute
    if (p.startsWith('/')) return true;
    // UNC path
    if (p.startsWith('\\\\')) return true;
    // Windows drive path
    if (/^[a-zA-Z]:[\\/]/.test(p)) return true;
    return path.isAbsolute(p);
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

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
