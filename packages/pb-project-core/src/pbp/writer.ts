/*
 * @caldymos/pb-project-core
 *
 * PureBasic Project (.pbp) XML writer.
 *
 * This module focuses on reliable and consistent output.
 * Generated files are structured in a stable way and can be
 * parsed again using parsePbpProjectText.
 *
 * The implementation is dependency-free.
 */

import type {
    PbpData,
    PbpFileConfig,
    PbpFileEntry,
    PbpProject,
    PbpTarget,
} from './model';

export interface WritePbpOptions {
    /** Line break used in the output (default: "\n"). */
    newline?: '\n' | '\r\n';
    /** Indentation used per nesting level (default: two spaces). */
    indent?: string;
    /** If false, omits the XML declaration header (default: true). */
    includeXmlDeclaration?: boolean;
}

const MODELED_SECTIONS = ['config', 'data', 'files', 'targets', 'libraries'] as const;

/**
 * Serialize a parsed/edited .pbp project back into XML.
 */
export function writePbpProjectText(
    project: Pick<PbpProject, 'config' | 'data' | 'files' | 'targets' | 'libraries' | 'meta'>,
    options: WritePbpOptions = {}
): string {
    const newline = options.newline ?? '\n';
    const indent = options.indent ?? '  ';
    const includeXmlDeclaration = options.includeXmlDeclaration !== false;

    const lines: string[] = [];
    if (includeXmlDeclaration) {
        lines.push('<?xml version="1.0" encoding="UTF-8"?>');
        lines.push('');
    }

    const projectAttrs = project.meta?.projectAttrs ?? {};
    const projectAttrText = renderAttrsFromMap(projectAttrs, ['xmlns', 'version', 'creator']);
    lines.push(`<project${projectAttrText}>`);

    const order = buildSectionOrder(project);
    for (const sec of order) {
        if (sec === 'config') {
            writeConfigSection(lines, indent, project.config);
        } else if (sec === 'data') {
            if (shouldWriteDataSection(project)) {
                writeDataSection(lines, indent, project.data);
            }
        } else if (sec === 'files') {
            if (shouldWriteFilesSection(project)) {
                writeFilesSection(lines, indent, project.files ?? []);
            }
        } else if (sec === 'targets') {
            if (shouldWriteTargetsSection(project)) {
                writeTargetsSection(lines, indent, project.targets ?? []);
            }
        } else if (sec === 'libraries') {
            if (shouldWriteLibrariesSection(project)) {
                writeLibrariesSection(lines, indent, project.libraries ?? []);
            }
        } else {
            const raw = project.meta?.unknownSections?.[sec];
            if (raw) {
                pushRawBlock(lines, normalizeNewlines(raw));
            }
        }
    }

    lines.push('</project>');

    return lines.join(newline) + newline;
}

// --------------------------------------------------------------------------------------
// Section order
// --------------------------------------------------------------------------------------

function buildSectionOrder(project: Pick<PbpProject, 'meta' | 'data' | 'files' | 'targets' | 'libraries'>): string[] {
    const original = project.meta?.sectionOrder ?? [];
    const order: string[] = [];

    // Start with original order to keep diffs small.
    for (const sec of original) {
        if (!sec) continue;
        if (order.includes(sec)) continue;
        order.push(sec);
    }

    // Ensure modeled sections exist in a deterministic order.
    for (const sec of MODELED_SECTIONS) {
        if (!order.includes(sec)) {
            order.push(sec);
        }
    }

    return order;
}

function wasSectionPresent(project: Pick<PbpProject, 'meta'>, name: string): boolean {
    return !!project.meta?.presentSections?.[name];
}

function shouldWriteDataSection(project: Pick<PbpProject, 'data' | 'meta'>): boolean {
    if (wasSectionPresent(project, 'data')) return true;
    const d = project.data;
    return !!(d?.explorer || d?.log || d?.lastopen || d?.meta?.extraXml);
}

function shouldWriteFilesSection(project: Pick<PbpProject, 'files' | 'meta'>): boolean {
    if (wasSectionPresent(project, 'files')) return true;
    return (project.files ?? []).length > 0;
}

function shouldWriteTargetsSection(project: Pick<PbpProject, 'targets' | 'meta'>): boolean {
    if (wasSectionPresent(project, 'targets')) return true;
    return (project.targets ?? []).length > 0;
}

function shouldWriteLibrariesSection(project: Pick<PbpProject, 'libraries' | 'meta'>): boolean {
    if (wasSectionPresent(project, 'libraries')) return true;
    return stableUnique(project.libraries ?? []).length > 0;
}

// --------------------------------------------------------------------------------------
// Sections
// --------------------------------------------------------------------------------------

function writeConfigSection(lines: string[], indent: string, cfg: PbpProject['config']): void {
    lines.push(`${indent}<section name="config">`);

    const opt: Record<string, string> = { ...(cfg?.meta?.optionsAttrs ?? {}) };
    opt['closefiles'] = boolTo01String(!!cfg?.closefiles);
    opt['openmode'] = String(cfg?.openmode ?? 0);
    opt['name'] = cfg?.name ?? '';

    lines.push(`${indent}${indent}<options${renderAttrsFromMap(opt, ['closefiles', 'openmode', 'name'])}/>`);

    const hasComment = !!cfg?.meta?.hasComment || !!(cfg?.comment ?? '').trim();
    if (hasComment) {
        lines.push(`${indent}${indent}<comment>${escapeXmlText(cfg?.comment ?? '')}</comment>`);
    }

    if (cfg?.meta?.extraXml) {
        pushRawBlock(lines, normalizeNewlines(cfg.meta.extraXml));
    }

    lines.push(`${indent}</section>`);
}

function writeDataSection(lines: string[], indent: string, data: PbpData | undefined): void {
    lines.push(`${indent}<section name="data">`);

    const d = data ?? {};
    if (d.explorer) {
        const attrs: Record<string, string> = {};
        if (d.explorer.view !== undefined) attrs['view'] = d.explorer.view;
        if (d.explorer.pattern !== undefined) attrs['pattern'] = String(d.explorer.pattern);
        lines.push(`${indent}${indent}<explorer${renderAttrsFromMap(attrs, ['view', 'pattern'])}/>`);
    }

    if (d.log) {
        const attrs: Record<string, string> = {};
        if (d.log.show !== undefined) attrs['show'] = boolTo01String(d.log.show);
        lines.push(`${indent}${indent}<log${renderAttrsFromMap(attrs, ['show'])}/>`);
    }

    if (d.lastopen) {
        const attrs: Record<string, string> = {};
        if (d.lastopen.date !== undefined) attrs['date'] = d.lastopen.date;
        if (d.lastopen.user !== undefined) attrs['user'] = d.lastopen.user;
        if (d.lastopen.host !== undefined) attrs['host'] = d.lastopen.host;
        lines.push(`${indent}${indent}<lastopen${renderAttrsFromMap(attrs, ['date', 'user', 'host'])}/>`);
    }

    if (d.meta?.extraXml) {
        pushRawBlock(lines, normalizeNewlines(d.meta.extraXml));
    }

    lines.push(`${indent}</section>`);
}

function writeFilesSection(lines: string[], indent: string, files: PbpFileEntry[]): void {
    lines.push(`${indent}<section name="files">`);

    for (const f of files) {
        const rawPath = f?.rawPath ?? '';
        const fileNameAttr = escapeXmlAttr(rawPath);

        const hasCfg = !!f?.config?.attrs || hasAnyFileConfigValue(f?.config);
        const hasFp = !!f?.fingerprint && Object.keys(f.fingerprint).length > 0;
        const hasExtra = !!f?.meta?.extraXml;

        if (!hasCfg && !hasFp && !hasExtra) {
            lines.push(`${indent}${indent}<file name="${fileNameAttr}"/>`);
            continue;
        }

        lines.push(`${indent}${indent}<file name="${fileNameAttr}">`);

        const inner = `${indent}${indent}${indent}`;

        if (hasCfg) {
            const cfgAttrs = buildFileConfigAttrs(f.config);
            lines.push(`${inner}<config${renderAttrsFromMap(cfgAttrs, ['load', 'scan', 'panel', 'warn', 'lastopen', 'sortindex', 'panelstate'])}/>`);
        }

        if (hasFp) {
            lines.push(`${inner}<fingerprint${renderAttrsFromMap(f.fingerprint ?? {}, ['md5'])}/>`);
        }

        if (hasExtra) {
            pushRawBlock(lines, normalizeNewlines(f.meta!.extraXml!));
        }

        lines.push(`${indent}${indent}</file>`);
    }

    lines.push(`${indent}</section>`);
}

function buildFileConfigAttrs(cfg: PbpFileConfig | undefined): Record<string, string> {
    const out: Record<string, string> = { ...(cfg?.attrs ?? {}) };

    // Apply known fields back into raw attrs to keep them consistent.
    if (cfg?.load !== undefined) out['load'] = boolTo01String(cfg.load);
    if (cfg?.scan !== undefined) out['scan'] = boolTo01String(cfg.scan);
    if (cfg?.panel !== undefined) out['panel'] = boolTo01String(cfg.panel);
    if (cfg?.warn !== undefined) out['warn'] = boolTo01String(cfg.warn);
    if (cfg?.lastopen !== undefined) out['lastopen'] = boolTo01String(cfg.lastopen);
    if (cfg?.sortindex !== undefined) out['sortindex'] = String(cfg.sortindex);
    if (cfg?.panelstate !== undefined) out['panelstate'] = cfg.panelstate;

    return out;
}

function hasAnyFileConfigValue(cfg: PbpFileConfig | undefined): boolean {
    if (!cfg) return false;
    return (
        cfg.load !== undefined ||
        cfg.scan !== undefined ||
        cfg.panel !== undefined ||
        cfg.warn !== undefined ||
        cfg.lastopen !== undefined ||
        cfg.sortindex !== undefined ||
        cfg.panelstate !== undefined
    );
}

function writeTargetsSection(lines: string[], indent: string, targets: PbpTarget[]): void {
    lines.push(`${indent}<section name="targets">`);

    for (const t of targets) {
        writeTarget(lines, indent, t);
    }

    lines.push(`${indent}</section>`);
}

function writeTarget(lines: string[], indent: string, t: PbpTarget): void {
    const openAttrs: Record<string, string> = { ...(t?.meta?.targetAttrs ?? {}) };
    openAttrs['name'] = t?.name ?? '';
    openAttrs['enabled'] = boolTo01String(!!t?.enabled);
    openAttrs['default'] = boolTo01String(!!t?.isDefault);

    // Do not add "directory" attribute unless it existed (directory is usually stored as its own tag).
    const dirKey = 'directory';
    if (openAttrs[dirKey] !== undefined && (t?.directory ?? '') !== '') {
        openAttrs[dirKey] = t.directory;
    }

    const tAttrText = renderAttrsFromMap(openAttrs, ['name', 'enabled', 'default']);
    lines.push(`${indent}${indent}<target${tAttrText}>`);

    const inner = `${indent}${indent}${indent}`;

    // input/output are always present in PB-generated projects.
    lines.push(`${inner}<inputfile${renderAttrsFromMap({ value: t?.inputFile?.rawPath ?? '' }, ['value'])}/>`);
    lines.push(`${inner}<outputfile${renderAttrsFromMap({ value: t?.outputFile?.rawPath ?? '' }, ['value'])}/>`);

    const present = t?.meta?.presentNodes ?? {};

    const exeRaw = t?.executable?.rawPath ?? '';
    if (exeRaw || present['executable']) {
        lines.push(`${inner}<executable${renderAttrsFromMap({ value: exeRaw }, ['value'])}/>`);
    }

    if (t?.compilerVersion) {
        lines.push(`${inner}<compiler${renderAttrsFromMap({ version: t.compilerVersion }, ['version'])}/>`);
    } else if (present['compiler']) {
        // Preserve tag presence even if version is empty.
        lines.push(`${inner}<compiler${renderAttrsFromMap({ version: '' }, ['version'])}/>`);
    }

    if (t?.commandLine) {
        lines.push(`${inner}<commandline${renderAttrsFromMap({ value: t.commandLine }, ['value'])}/>`);
    } else if (present['commandline']) {
        lines.push(`${inner}<commandline${renderAttrsFromMap({ value: '' }, ['value'])}/>`);
    }

    if (t?.directory || present['directory']) {
        lines.push(`${inner}<directory${renderAttrsFromMap({ value: t?.directory ?? '' }, ['value'])}/>`);
    }

    if (t?.subsystem) {
        lines.push(`${inner}<subsystem${renderAttrsFromMap({ value: t.subsystem }, ['value'])}/>`);
    } else if (present['subsystem']) {
        lines.push(`${inner}<subsystem${renderAttrsFromMap({ value: '' }, ['value'])}/>`);
    }

    if (t?.linker?.rawPath) {
        lines.push(`${inner}<linker${renderAttrsFromMap({ value: t.linker.rawPath }, ['value'])}/>`);
    } else if (present['linker']) {
        lines.push(`${inner}<linker${renderAttrsFromMap({ value: '' }, ['value'])}/>`);
    }

    if (t?.purifier) {
        const attrs: Record<string, string> = { ...(t.purifier.attrs ?? {}) };
        attrs['enable'] = boolTo01String(!!t.purifier.enabled);
        if (t.purifier.granularity !== undefined) attrs['granularity'] = t.purifier.granularity;
        lines.push(`${inner}<purifier${renderAttrsFromMap(attrs, ['enable', 'granularity'])}/>`);
    } else if (present['purifier']) {
        lines.push(`${inner}<purifier${renderAttrsFromMap({ enable: '0' }, ['enable'])}/>`);
    }

    if (t?.temporaryExe) {
        lines.push(`${inner}<temporaryexe${renderAttrsFromMap({ value: t.temporaryExe }, ['value'])}/>`);
    } else if (present['temporaryexe']) {
        lines.push(`${inner}<temporaryexe${renderAttrsFromMap({ value: '' }, ['value'])}/>`);
    }

    // options
    const optAttrs = buildTargetOptionsAttrs(t);
    if (Object.keys(optAttrs).length > 0) {
        lines.push(`${inner}<options${renderAttrsFromMap(optAttrs, targetOptionsFixedOrder())}/>`);
    } else if (present['options']) {
        lines.push(`${inner}<options/>`);
    }

    if (t?.format && Object.keys(t.format).length > 0) {
        lines.push(`${inner}<format${renderAttrsFromMap(t.format, ['exe', 'cpu'])}/>`);
    } else if (present['format']) {
        lines.push(`${inner}<format/>`);
    }

    if (t?.icon && t.icon.rawPath) {
        const attrs: Record<string, string> = { ...(t.icon.attrs ?? {}) };
        attrs['enable'] = boolTo01String(!!t.icon.enabled);
        lines.push(`${inner}<icon${renderAttrsFromMap(attrs, ['enable'])}>${escapeXmlText(t.icon.rawPath)}</icon>`);
    } else if (present['icon']) {
        lines.push(`${inner}<icon${renderAttrsFromMap({ enable: '0' }, ['enable'])}></icon>`);
    }

    if (t?.debugger) {
        const attrs: Record<string, string> = { ...(t.debugger.attrs ?? {}) };
        if (t.debugger.custom !== undefined) attrs['custom'] = boolTo01String(t.debugger.custom);
        if (t.debugger.type !== undefined) attrs['type'] = t.debugger.type;
        lines.push(`${inner}<debugger${renderAttrsFromMap(attrs, ['custom', 'type'])}/>`);
    } else if (present['debugger']) {
        lines.push(`${inner}<debugger/>`);
    }

    if (t?.warnings) {
        const attrs: Record<string, string> = { ...(t.warnings.attrs ?? {}) };
        if (t.warnings.custom !== undefined) attrs['custom'] = boolTo01String(t.warnings.custom);
        if (t.warnings.type !== undefined) attrs['type'] = t.warnings.type;
        lines.push(`${inner}<warnings${renderAttrsFromMap(attrs, ['custom', 'type'])}/>`);
    } else if (present['warnings']) {
        lines.push(`${inner}<warnings/>`);
    }

    if (t?.compileCount) {
        const attrs: Record<string, string> = { ...(t.compileCount.attrs ?? {}) };
        attrs['enable'] = boolTo01String(!!t.compileCount.enabled);
        if (t.compileCount.value !== undefined) attrs['value'] = String(t.compileCount.value);
        lines.push(`${inner}<compilecount${renderAttrsFromMap(attrs, ['enable', 'value'])}/>`);
    } else if (present['compilecount']) {
        lines.push(`${inner}<compilecount${renderAttrsFromMap({ enable: '0', value: '0' }, ['enable', 'value'])}/>`);
    }

    if (t?.buildCount) {
        const attrs: Record<string, string> = { ...(t.buildCount.attrs ?? {}) };
        attrs['enable'] = boolTo01String(!!t.buildCount.enabled);
        if (t.buildCount.value !== undefined) attrs['value'] = String(t.buildCount.value);
        lines.push(`${inner}<buildcount${renderAttrsFromMap(attrs, ['enable', 'value'])}/>`);
    } else if (present['buildcount']) {
        lines.push(`${inner}<buildcount${renderAttrsFromMap({ enable: '0', value: '0' }, ['enable', 'value'])}/>`);
    }

    if (t?.exeConstant) {
        const attrs: Record<string, string> = { ...(t.exeConstant.attrs ?? {}) };
        attrs['enable'] = boolTo01String(!!t.exeConstant.enabled);
        lines.push(`${inner}<execonstant${renderAttrsFromMap(attrs, ['enable'])}/>`);
    } else if (present['execonstant']) {
        lines.push(`${inner}<execonstant${renderAttrsFromMap({ enable: '0' }, ['enable'])}/>`);
    }

    if (t?.constants && t.constants.length > 0) {
        lines.push(`${inner}<constants>`);
        for (const c of t.constants) {
            const cAttrs: Record<string, string> = {
                enable: boolTo01String(!!c.enabled),
                value: c.value ?? '',
            };
            lines.push(`${inner}${indent}<constant${renderAttrsFromMap(cAttrs, ['enable', 'value'])}/>`);
        }
        lines.push(`${inner}</constants>`);
    } else if (present['constants']) {
        lines.push(`${inner}<constants></constants>`);
    }

    if (t?.versionInfo) {
        const viAttrs: Record<string, string> = { ...(t.versionInfo.attrs ?? {}) };
        viAttrs['enable'] = boolTo01String(!!t.versionInfo.enabled);
        lines.push(`${inner}<versioninfo${renderAttrsFromMap(viAttrs, ['enable'])}>`);
        for (const f of t.versionInfo.fields ?? []) {
            if (!(f.value ?? '').trim()) continue; // skip empty fields (PB IDE behaviour)
            lines.push(`${inner}${indent}<${f.id}${renderAttrsFromMap({ value: f.value }, ['value'])}/>`);
        }
        lines.push(`${inner}</versioninfo>`);
    } else if (present['versioninfo']) {
        lines.push(`${inner}<versioninfo${renderAttrsFromMap({ enable: '0' }, ['enable'])}></versioninfo>`);
    }

    if (t?.resources && t.resources.length > 0) {
        lines.push(`${inner}<resources>`);
        for (const r of t.resources) {
            lines.push(`${inner}${indent}<resource${renderAttrsFromMap({ value: r }, ['value'])}/>`);
        }
        lines.push(`${inner}</resources>`);
    } else if (present['resources']) {
        lines.push(`${inner}<resources></resources>`);
    }

    if (t?.watchList !== undefined) {
        lines.push(`${inner}<watchlist>${escapeXmlText(t.watchList ?? '')}</watchlist>`);
    } else if (present['watchlist']) {
        lines.push(`${inner}<watchlist></watchlist>`);
    }

    if (t?.meta?.extraXml) {
        pushRawBlock(lines, normalizeNewlines(t.meta.extraXml));
    }

    lines.push(`${indent}${indent}</target>`);
}

function buildTargetOptionsAttrs(t: PbpTarget): Record<string, string> {
    const attrs: Record<string, string> = { ...(t.optionsAttrs ?? {}) };

    // If there is no raw map, fall back to boolean options.
    if (!t.optionsAttrs) {
        for (const [k, v] of Object.entries(t.options ?? {})) {
            if (v) attrs[k] = '1';
        }
        return attrs;
    }

    // Keep raw attributes as-is but ensure known booleans are normalized when toggled.
    for (const [k, v] of Object.entries(t.options ?? {})) {
        if (v) {
            attrs[k] = '1';
        } else if (attrs[k] !== undefined && isTruthyString(attrs[k])) {
            // If it was enabled before, remove it unless the caller explicitly set a different value.
            delete attrs[k];
        }
    }

    return attrs;
}

function targetOptionsFixedOrder(): string[] {
    // Derived from the user-provided mapping (PureBasic_CompilerOptions_CompileRun.xlsx).
    return [
        'debug',
        'optimizer',
        'asm',
        'thread',
        'onerror',
        'dpiaware',
        'xpskin',
        'admin',
        'user',
        'dllprotection',
        'shareducrt',
        'wayland',
    ];
}

function writeLibrariesSection(lines: string[], indent: string, libs: string[]): void {
    lines.push(`${indent}<section name="libraries">`);

    for (const lib of stableUnique(libs)) {
        lines.push(`${indent}${indent}<library${renderAttrsFromMap({ value: lib }, ['value'])}/>`);
    }

    lines.push(`${indent}</section>`);
}

// --------------------------------------------------------------------------------------
// Raw blocks
// --------------------------------------------------------------------------------------

function pushRawBlock(lines: string[], raw: string): void {
    const block = normalizeNewlines(raw);
    const split = block.split('\n');
    for (const line of split) {
        const v = line.replace(/\s+$/g, '');
        if (v.length === 0) continue;
        lines.push(v);
    }
}

// --------------------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------------------

function boolTo01String(v: boolean | undefined): string {
    return v ? '1' : '0';
}

/** Mirrors the parser's parseBool() semantics: '1', 'true', 'yes' are truthy. */
function isTruthyString(v: string | undefined): boolean {
    if (v === undefined) return false;
    const t = v.trim().toLowerCase();
    return t === '1' || t === 'true' || t === 'yes';
}

function stableUnique(values: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of values) {
        const s = (v ?? '').trim();
        if (!s) continue;
        if (seen.has(s)) continue;
        seen.add(s);
        out.push(s);
    }
    return out;
}

function normalizeNewlines(content: string): string {
    return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function escapeXmlText(text: string): string {
    // Keep in sync with the decoder in parser.ts (decodeXmlEntities)
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function escapeXmlAttr(text: string): string {
    return escapeXmlText(text);
}

function renderAttrsFromMap(attrs: Record<string, string>, fixedOrder: string[] = []): string {
    const keys = Object.keys(attrs);
    if (keys.length === 0) return '';

    const fixed = fixedOrder.filter(k => attrs[k] !== undefined);
    const rest = keys.filter(k => !fixed.includes(k)).sort(compareAscii);

    let out = '';
    for (const k of [...fixed, ...rest]) {
        out += ` ${k}="${escapeXmlAttr(attrs[k] ?? '')}"`;
    }
    return out;
}

function compareAscii(a: string, b: string): number {
    if (a === b) return 0;
    return a < b ? -1 : 1;
}