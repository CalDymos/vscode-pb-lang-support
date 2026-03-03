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

/**
 * Serialize a parsed/edited .pbp project back into XML.
 *
 * The output is intentionally minimal and focuses on the sections currently
 * modeled by this library: config, data, files, targets, libraries.
 */
export function writePbpProjectText(
    project: Pick<PbpProject, 'meta' | 'config' | 'data' | 'files' | 'targets' | 'libraries'>,
    options: WritePbpOptions = {}
): string {
    const newline = options.newline ?? '\n';
    const indent = options.indent ?? '  ';
    const includeXmlDeclaration = options.includeXmlDeclaration !== false;

    const lines: string[] = [];
    if (includeXmlDeclaration) {
        lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    }

    const rootAttrs = project.meta?.projectAttrs;
    const rootPairs = rootAttrs && Object.keys(rootAttrs).length > 0 ? sortProjectAttrs(rootAttrs) : undefined;
    lines.push(`<project${rootPairs ? renderAttrs(rootPairs) : ''}>`);

    const present = project.meta?.presentSections;
    if (present?.config !== false) writeConfigSection(lines, indent, project.config);
    if (present?.data !== false) writeDataSection(lines, indent, project.data);
    if (present?.files !== false) writeFilesSection(lines, indent, project.files ?? []);
    if (present?.targets !== false) writeTargetsSection(lines, indent, project.targets ?? []);

    const shouldWriteLibraries = (project.libraries ?? []).length > 0 || present?.libraries !== false;
    if (shouldWriteLibraries) writeLibrariesSection(lines, indent, project.libraries ?? []);
    lines.push('</project>');

    return lines.join(newline) + newline;
}

// --------------------------------------------------------------------------------------
// Sections
// --------------------------------------------------------------------------------------

function writeConfigSection(lines: string[], indent: string, cfg: PbpProject['config']): void {
    lines.push(`${indent}<section name="config">`);

    const merged: Record<string, string> = { ...(cfg?.optionsAttrs ?? {}) };
    merged['name'] = cfg?.name ?? '';
    merged['closefiles'] = bool01(!!cfg?.closefiles);
    merged['openmode'] = String(cfg?.openmode ?? 0);

    const optionAttrs = sortStableStringAttrs(merged, ['name', 'closefiles', 'openmode']);
    lines.push(`${indent}${indent}<options${renderAttrs(optionAttrs)}/>`);

    const comment = cfg?.comment ?? '';
    const shouldWriteComment = !!cfg?.commentPresent || comment.length > 0;
    if (shouldWriteComment) {
        lines.push(`${indent}${indent}<comment>${escapeXmlText(comment)}</comment>`);
    }
    lines.push(`${indent}</section>`);
}

function writeDataSection(lines: string[], indent: string, data: PbpData | undefined): void {
    lines.push(`${indent}<section name="data">`);

    const d = data ?? {};
    if (d.explorer) {
        const attrs: Array<[string, string]> = [];
        if (d.explorer.view !== undefined) attrs.push(['view', d.explorer.view]);
        if (d.explorer.pattern !== undefined) attrs.push(['pattern', String(d.explorer.pattern)]);
        lines.push(`${indent}${indent}<explorer${renderAttrs(attrs)}/>`);
    }

    if (d.log) {
        const attrs: Array<[string, string]> = [];
        if (d.log.show !== undefined) attrs.push(['show', bool01(d.log.show)]);
        lines.push(`${indent}${indent}<log${renderAttrs(attrs)}/>`);
    }

    if (d.lastopen) {
        const attrs: Array<[string, string]> = [];
        if (d.lastopen.date !== undefined) attrs.push(['date', d.lastopen.date]);
        if (d.lastopen.user !== undefined) attrs.push(['user', d.lastopen.user]);
        if (d.lastopen.host !== undefined) attrs.push(['host', d.lastopen.host]);
        lines.push(`${indent}${indent}<lastopen${renderAttrs(attrs)}/>`);
    }

    lines.push(`${indent}</section>`);
}

function writeFilesSection(lines: string[], indent: string, files: PbpFileEntry[]): void {
    lines.push(`${indent}<section name="files">`);

    for (const f of files) {
        const rawPath = f?.rawPath ?? '';
        const fileNameAttr = escapeXmlAttr(rawPath);

        const cfg = f?.config;
        const cfgMetaAttrs = f?.meta?.configAttrs;
        const fingerprintAttrs = f?.meta?.fingerprintAttrs;

        // Merge raw config attributes (if present) with the modeled boolean flags.
        // Boolean flags always win to keep edits consistent.
        const mergedCfg: Record<string, string> = {};
        if (cfgMetaAttrs) {
            for (const [k, v] of Object.entries(cfgMetaAttrs)) {
                mergedCfg[k] = v ?? '';
            }
        }

        if (cfg) {
            if (cfg.load !== undefined) mergedCfg['load'] = bool01(!!cfg.load);
            if (cfg.scan !== undefined) mergedCfg['scan'] = bool01(!!cfg.scan);
            if (cfg.panel !== undefined) mergedCfg['panel'] = bool01(!!cfg.panel);
            if (cfg.warn !== undefined) mergedCfg['warn'] = bool01(!!cfg.warn);
        }

        const hasCfg = Object.keys(mergedCfg).length > 0;
        const hasFp = !!fingerprintAttrs && Object.keys(fingerprintAttrs).length > 0;

        if (!hasCfg && !hasFp) {
            lines.push(`${indent}${indent}<file name="${fileNameAttr}"/>`);
            continue;
        }

        lines.push(`${indent}${indent}<file name="${fileNameAttr}">`);

        if (hasCfg) {
            const attrs = sortStableStringAttrs(mergedCfg, ['load', 'scan', 'panel', 'warn', 'lastopen', 'sortindex', 'panelstate']);
            lines.push(`${indent}${indent}${indent}<config${renderAttrs(attrs)}/>`);
        }

        if (hasFp && fingerprintAttrs) {
            const attrs = sortStableStringAttrs(fingerprintAttrs);
            lines.push(`${indent}${indent}${indent}<fingerprint${renderAttrs(attrs)}/>`);
        }

        lines.push(`${indent}${indent}</file>`);
    }

    lines.push(`${indent}</section>`);
}

function writeTargetsSection(lines: string[], indent: string, targets: PbpTarget[]): void {
    lines.push(`${indent}<section name="targets">`);

    for (const t of targets) {
        writeTarget(lines, indent, t);
    }

    lines.push(`${indent}</section>`);
}

function writeTarget(lines: string[], indent: string, t: PbpTarget): void {
    const mergedAttrs: Record<string, string> = { ...(t?.targetAttrs ?? {}) };
    mergedAttrs['name'] = t?.name ?? '';
    mergedAttrs['enabled'] = bool01(!!t?.enabled);
    mergedAttrs['default'] = bool01(!!t?.isDefault);

    const dir = (t?.directory ?? '').trim();
    if (dir) mergedAttrs['directory'] = dir;
    else delete mergedAttrs['directory'];

    const tAttrs = sortStableStringAttrs(mergedAttrs, ['name', 'enabled', 'default', 'directory']);
    lines.push(`${indent}${indent}<target${renderAttrs(tAttrs)}>`);

    const inner = `${indent}${indent}${indent}`;
    lines.push(`${inner}<inputfile${renderAttrs([['value', t?.inputFile?.rawPath ?? '']])}/>`);
    lines.push(`${inner}<outputfile${renderAttrs([['value', t?.outputFile?.rawPath ?? '']])}/>`);
    if (t.compilerVersion) lines.push(`${inner}<compiler${renderAttrs([['version', t.compilerVersion]])}/>`);
    lines.push(`${inner}<executable${renderAttrs([['value', t?.executable?.rawPath ?? '']])}/>`);

    if (t.commandLine) lines.push(`${inner}<commandline${renderAttrs([['value', t.commandLine]])}/>`);
    if (t.subsystem) lines.push(`${inner}<subsystem${renderAttrs([['value', t.subsystem]])}/>`);

    const optAttrs = (t.optionAttrs && Object.keys(t.optionAttrs).length > 0)
        ? sortStableStringAttrs(t.optionAttrs)
        : (t.options && Object.keys(t.options).length > 0)
            ? sortStableStringAttrs(Object.fromEntries(Object.entries(t.options).map(([k, v]) => [k, bool01(!!v)])))
            : undefined;
    if (optAttrs && optAttrs.length > 0) lines.push(`${inner}<options${renderAttrs(optAttrs)}/>`);

    if (t.purifier) {
        const attrs: Array<[string, string]> = [['enable', bool01(!!t.purifier.enabled)]];
        if (t.purifier.granularity) attrs.push(['granularity', t.purifier.granularity]);
        lines.push(`${inner}<purifier${renderAttrs(attrs)}/>`);
    }

    if (t.temporaryExe) lines.push(`${inner}<temporaryexe${renderAttrs([['value', t.temporaryExe]])}/>`);

    if (t.icon && t.icon.rawPath) {
        const attrs: Array<[string, string]> = [['enable', bool01(!!t.icon.enabled)]];
        lines.push(`${inner}<icon${renderAttrs(attrs)}>${escapeXmlText(t.icon.rawPath)}</icon>`);
    }

    if (t.warnings) {
        const merged: Record<string, string> = { ...(t.warnings.attrs ?? {}) };
        if (t.warnings.custom !== undefined) merged['custom'] = bool01(!!t.warnings.custom);
        if (t.warnings.type !== undefined) merged['type'] = t.warnings.type;
        const attrs = sortStableStringAttrs(merged, ['custom', 'type']);
        lines.push(`${inner}<warnings${renderAttrs(attrs)}/>`);
    }

    if (t.compileCount) {
        const attrs: Array<[string, string]> = [['enable', bool01(!!t.compileCount.enabled)]];
        if (t.compileCount.value !== undefined) attrs.push(['value', String(t.compileCount.value)]);
        lines.push(`${inner}<compilecount${renderAttrs(attrs)}/>`);
    }

    if (t.buildCount) {
        const attrs: Array<[string, string]> = [['enable', bool01(!!t.buildCount.enabled)]];
        if (t.buildCount.value !== undefined) attrs.push(['value', String(t.buildCount.value)]);
        lines.push(`${inner}<buildcount${renderAttrs(attrs)}/>`);
    }

    if (t.versionInfo) {
        lines.push(`${inner}<versioninfo${renderAttrs([['enable', bool01(!!t.versionInfo.enabled)]])}>`);
        const fields = [...(t.versionInfo.fields ?? [])].sort((a, b) => compareVersionFieldId(a.id, b.id));
        for (const f of fields) {
            const id = (f.id ?? '').trim();
            if (!id) continue;
            lines.push(`${inner}${indent}<${id}${renderAttrs([['value', f.value ?? '']])}/>`);
        }
        lines.push(`${inner}</versioninfo>`);
    }

    if (t.resources && (t.resources.items?.length ?? 0) > 0) {
        lines.push(`${inner}<resources>`);
        for (const r of t.resources.items) {
            lines.push(`${inner}${indent}<resource${renderAttrs([['value', r ?? '']])}/>`);
        }
        lines.push(`${inner}</resources>`);
    }

    if (t.watchList !== undefined) {
        lines.push(`${inner}<watchlist>${escapeXmlText(t.watchList ?? '')}</watchlist>`);
    }

    if (t.constants && t.constants.length > 0) {
        lines.push(`${inner}<constants>`);
        for (const c of t.constants) {
            const cAttrs: Array<[string, string]> = [
                ['enable', bool01(!!c.enabled)],
                ['value', c.value ?? ''],
            ];
            lines.push(`${inner}${indent}<constant${renderAttrs(cAttrs)}/>`);
        }
        lines.push(`${inner}</constants>`);
    }

    if (t.format && Object.keys(t.format).length > 0) {
        const attrs: Array<[string, string]> = sortKeyedAttrs(t.format);
        lines.push(`${inner}<format${renderAttrs(attrs)}/>`);
    }

    lines.push(`${indent}${indent}</target>`);
}

function writeLibrariesSection(lines: string[], indent: string, libs: string[]): void {
    lines.push(`${indent}<section name="libraries">`);

    for (const lib of stableUnique(libs)) {
        lines.push(`${indent}${indent}<library${renderAttrs([['value', lib]])}/>`);
    }

    lines.push(`${indent}</section>`);
}

// --------------------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------------------

function bool01(v: boolean | undefined): string {
    return v ? '1' : '0';
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

function sortProjectAttrs(attrs: Record<string, string>): Array<[string, string]> {
    // Preserve common root attribute ordering to keep diffs minimal.
    return sortStableStringAttrs(attrs, ['xmlns', 'version', 'creator']);
}

function compareVersionFieldId(a: string, b: string): number {
    const an = parseInt(String(a).replace(/\D+/g, ''), 10);
    const bn = parseInt(String(b).replace(/\D+/g, ''), 10);

    if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return an - bn;
    if (a === b) return 0;
    return a < b ? -1 : 1;
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

function renderAttrs(attrs: Array<[string, string]>): string {
    let out = '';
    for (const [k, v] of attrs) {
        // Always include the attribute (even if empty) to preserve semantics where possible.
        out += ` ${k}="${escapeXmlAttr(v ?? '')}"`;
    }
    return out;
}

function sortStableStringAttrs(obj: Record<string, string>, fixedOrder: string[] = []): Array<[string, string]> {
    const keys = Object.keys(obj)
        .filter(k => (obj as any)[k] !== undefined)
        .sort((a, b) => compareStableKeys(a, b, fixedOrder));

    return keys.map(k => [k, obj[k] ?? '']);
}

function sortKeyedAttrs(obj: Record<string, string>): Array<[string, string]> {
    const keys = Object.keys(obj).sort(compareAscii);
    return keys.map(k => [k, obj[k] ?? '']);
}

function compareAscii(a: string, b: string): number {
    if (a === b) return 0;
    return a < b ? -1 : 1;
}

function compareStableKeys(a: string, b: string, fixedOrder: string[]): number {
    const ai = fixedOrder.indexOf(a);
    const bi = fixedOrder.indexOf(b);
    if (ai >= 0 || bi >= 0) {
        if (ai < 0) return 1;
        if (bi < 0) return -1;
        if (ai !== bi) return ai - bi;
        return 0;
    }
    return compareAscii(a, b);
}
