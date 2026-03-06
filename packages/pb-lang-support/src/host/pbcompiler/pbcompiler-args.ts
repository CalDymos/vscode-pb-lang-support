/**
 * PureBasic pbcompiler argument mapping.
 *
 * Converts a normalized UnifiedContext (ideally backed by a .pbp target) into
 * a deterministic argv array for `pbcompiler`.
 */

import * as path from 'path';

import type { PbpTarget } from '@caldymos/pb-project-core';
import type { UnifiedContext } from '../unified-context';

export interface PbCompilerArgBuildResult {
    args: string[];
    /** If present, this is the expected output file path after compilation. */
    outputFile?: string;
    warnings: string[];
}

export interface PbCompilerArgBuildOptions {
    platform: NodeJS.Platform;
    /**
     * Build purpose:
     *  - build: create the target output (no debug-specific enforcement)
     *  - debug: enforce debugger + linenumbering and allow overriding output
     */
    purpose: 'build' | 'debug';
    outputOverride?: string;
}

export function buildPbCompilerArgs(ctx: UnifiedContext, opt: PbCompilerArgBuildOptions): PbCompilerArgBuildResult {
    const warnings: string[] = [];

    const inputFile = (ctx.inputFile ?? '').trim();
    if (!inputFile) {
        return { args: [], warnings: ['Missing inputFile (no active file or missing target inputFile).'] };
    }

    const target = ctx.target;
    const isWin = opt.platform === 'win32';
    const isLinux = opt.platform === 'linux';
    const isMac = opt.platform === 'darwin';

    const args: string[] = [inputFile];

    // ---------------------------------------------------------------------
    // Build output
    // ---------------------------------------------------------------------
    const requestedOutput = (opt.outputOverride ?? ctx.outputFile ?? '').trim();
    if (opt.purpose === 'debug' && !requestedOutput) {
        warnings.push('Debug build requires outputOverride (missing output path).');
    }

    // format.exe handling (best-effort, only when target exists)
    const formatExe = normalizeFormatExe(target);
    const isDllFormat = formatExe === 'dll';

    let outputIsConsumedByFormatSwitch = false;

    if (isDllFormat) {
        if (!requestedOutput) {
            warnings.push('Target format is DLL/shared object, but outputFile is empty.');
        } else if (isWin) {
            // Windows DLL: /DLL + --output
            args.push('/DLL');
        } else if (isLinux) {
            // Linux: --sharedobject "filename"
            args.push('--sharedobject', requestedOutput);
            outputIsConsumedByFormatSwitch = true;
        } else if (isMac) {
            // macOS: --dylib "filename"
            args.push('--dylib', requestedOutput);
            outputIsConsumedByFormatSwitch = true;
        } else {
            warnings.push(`DLL format is not supported on platform: ${opt.platform}`);
        }
    } else if (formatExe === 'console') {
        args.push('--console');
    }

    if (requestedOutput && !outputIsConsumedByFormatSwitch) {
        args.push('--output', requestedOutput);
    }

    // ---------------------------------------------------------------------
    // Compiler options (.pbp target optionsAttrs)
    // ---------------------------------------------------------------------
    if (target) {
        applyTargetOptions(args, target, opt, warnings);
        applyTargetFormatCpu(args, target, opt.platform, warnings);
        applySubsystem(args, target);
        applyConstants(args, target);
        applyPurifier(args, target, opt, warnings);
        applyIcon(args, target, opt.platform, warnings);
        applyWindowsExtras(args, target, opt.platform, warnings);
        applyWindowsResourcesAndLinker(args, target, ctx.projectDir, opt.platform, warnings);
    }

    // Debug-purpose enforcement
    if (opt.purpose === 'debug') {
        ensureArg(args, '--debugger');
        ensureArg(args, '--linenumbering');
        if (!requestedOutput) {
            warnings.push('Debug build requires outputOverride/outputFile (missing output path).');
        }
    }

    return {
        args,
        outputFile: requestedOutput || undefined,
        warnings,
    };
}

function normalizeFormatExe(t?: PbpTarget): string {
    const v = (t?.format?.exe ?? '').trim().toLowerCase();
    return v;
}

function applyTargetOptions(args: string[], t: PbpTarget, opt: PbCompilerArgBuildOptions, warnings: string[]): void {
    const o = t.options ?? {};

    if (o.debug) args.push('--debugger');
    if (o.optimizer) args.push('--optimizer');
    if (o.thread) args.push('--thread');
    if (o.onerror) args.push('--linenumbering');

    // Linux: Wayland support (PureBasic 6.20+)
    if (opt.platform === 'linux' && o.wayland) {
        args.push('--wayland');
    }

    // The following options have no documented cross-platform pbcompiler switches.
    // Keep them as warnings so users understand why the build may differ.
    if (o.asm) {
        warnings.push('Target option "asm" is set, but pbcompiler has no switch for it (backend selection is binary-based).');
    }
}

function applyTargetFormatCpu(args: string[], t: PbpTarget, platform: NodeJS.Platform, warnings: string[]): void {
    const cpuRaw = (t.format?.cpu ?? '').trim();
    if (!cpuRaw) return;
    const cpu = Number(cpuRaw);
    if (!Number.isFinite(cpu)) return;

    // 0 = All CPU (no switch)
    if (cpu === 0) return;

    const isWin = platform === 'win32';
    const isLinux = platform === 'linux';

    // macOS CPU switches are not documented in pbcompiler CLI reference.
    if (!isWin && !isLinux) {
        warnings.push(`CPU optimization is not applied on platform: ${platform}`);
        return;
    }

    if (cpu === 1) {
        args.push(isWin ? '/DYNAMICCPU' : '--dynamiccpu');
        return;
    }

    const map: Record<number, { win: string; linux: string }> = {
        2: { win: '/MMX', linux: '-mmx' },
        3: { win: '/3DNOW', linux: '-3dnow' },
        4: { win: '/SSE', linux: '-sse' },
        5: { win: '/SSE2', linux: '-sse2' },
    };

    const entry = map[cpu];
    if (!entry) return;

    args.push(isWin ? entry.win : entry.linux);
}

function applySubsystem(args: string[], t: PbpTarget): void {
    const subsystem = (t.subsystem ?? '').trim();
    if (!subsystem) return;
    args.push('--subsystem', subsystem);
}

function applyConstants(args: string[], t: PbpTarget): void {
    if (!Array.isArray(t.constants) || t.constants.length === 0) return;

    for (const c of t.constants) {
        if (!c.enabled) continue;
        const v = (c.value ?? '').trim();
        if (!v) continue;
        args.push('--constant', v);
    }
}

function applyPurifier(args: string[], t: PbpTarget, opt: PbCompilerArgBuildOptions, warnings: string[]): void {
    if (!t.purifier?.enabled) return;

    args.push('--purifier');

    // The pbcompiler doc requires debugger for purifier to have effect.
    const hasDebugger = args.includes('--debugger');
    if (!hasDebugger && opt.purpose !== 'debug') {
        warnings.push('Purifier is enabled but debugger is not enabled; pbcompiler will ignore purifier.');
    }
}

function applyIcon(args: string[], t: PbpTarget, platform: NodeJS.Platform, warnings: string[]): void {
    if (!t.icon?.enabled) return;
    const iconPath = (t.icon.fsPath ?? '').trim();
    if (!iconPath) return;

    if (platform === 'win32') {
        args.push('/ICON', iconPath);
        return;
    }
    if (platform === 'darwin') {
        args.push('--icon', iconPath);
        return;
    }

    warnings.push('Icon is enabled but not supported on this platform by pbcompiler CLI.');
}

function applyWindowsExtras(args: string[], t: PbpTarget, platform: NodeJS.Platform, warnings: string[]): void {
    if (platform !== 'win32') return;

    const o = t.options ?? {};
    if (o.xpskin) args.push('/XP');
    if (o.admin) args.push('/ADMINISTRATOR');
    if (o.user) args.push('/USER');
    if (o.dpiaware) args.push('/DPIAWARE');
    if (o.dllprotection) args.push('/DLLPROTECTION');
    if (o.shareducrt) args.push('/UCRT');

    if (o.admin && o.user) {
        warnings.push('Both "admin" and "user" are enabled; these are mutually exclusive in PureBasic compiler options.');
    }
}

function applyWindowsResourcesAndLinker(
    args: string[],
    t: PbpTarget,
    projectDir: string | undefined,
    platform: NodeJS.Platform,
    warnings: string[],
): void {
    if (platform !== 'win32') return;

    if (Array.isArray(t.resources) && t.resources.length > 0) {
        const firstRaw = String(t.resources[0] ?? '').trim();
        const first = firstRaw && projectDir && !path.isAbsolute(firstRaw)
            ? path.resolve(projectDir, firstRaw)
            : firstRaw;
        if (first) args.push('/RESOURCE', first);
        if (t.resources.length > 1) {
            warnings.push('Multiple resources are configured; pbcompiler CLI supports only one /RESOURCE file. Using the first entry.');
        }
    }

    const linker = t.linker?.fsPath?.trim();
    if (linker) {
        args.push('/LINKER', linker);
    }
}

function ensureArg(args: string[], flag: string): void {
    if (!args.includes(flag)) args.push(flag);
}