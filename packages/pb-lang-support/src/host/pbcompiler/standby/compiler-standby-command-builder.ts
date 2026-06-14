/**
 * Command builder for the PureBasic compiler standby protocol.
 *
 * The standby protocol accepts IDE-style compile flags such as DEBUGGER,
 * THREAD and CHECKSYNTAX. These are intentionally different from the public
 * pbcompiler command-line switches used by the existing CLI build runner.
 */

import * as path from 'path';

import type { PbpTarget } from '@caldymos/pb-project-core';
import type { UnifiedContext } from '../../unified-context';
import type { CompilerStandbyCommand } from './compiler-standby-types';

export interface CompilerStandbyCommandBuildOptions {
    platform: NodeJS.Platform;
    sourceFile: string;
    targetFile: string;
    includePath?: string;
    sourceAlias?: string;
    projectDir?: string;
    target?: PbpTarget;
    checkSyntax: boolean;
    createExecutable: boolean;
}

export interface CompilerStandbyCommandBuildResult {
    commands: CompilerStandbyCommand[];
    compileFlags: string[];
    warnings: string[];
}

export interface BuildSyntaxCheckCommandsOptions {
    platform: NodeJS.Platform;
    targetFile: string;
    sourceAlias?: string;
}

export function buildSyntaxCheckStandbyCommands(
    ctx: UnifiedContext,
    opt: BuildSyntaxCheckCommandsOptions,
): CompilerStandbyCommandBuildResult {
    const sourceFile = (ctx.inputFile ?? '').trim();

    return buildCompilerStandbyCommands({
        platform: opt.platform,
        sourceFile,
        targetFile: opt.targetFile,
        includePath: getSourceIncludePath(opt.sourceAlias || sourceFile, ctx.projectDir),
        sourceAlias: opt.sourceAlias,
        projectDir: ctx.projectDir,
        target: ctx.compilerTarget ?? ctx.target,
        checkSyntax: true,
        createExecutable: false,
    });
}

export function buildCompilerStandbyCommands(
    opt: CompilerStandbyCommandBuildOptions,
): CompilerStandbyCommandBuildResult {
    const warnings: string[] = [];
    const commands: CompilerStandbyCommand[] = [];

    const sourceFile = opt.sourceFile.trim();
    const targetFile = opt.targetFile.trim();

    if (!sourceFile) {
        warnings.push('Missing source file for compiler standby command sequence.');
        return { commands: [], compileFlags: [], warnings };
    }
    if (!targetFile) {
        warnings.push('Missing target file for compiler standby command sequence.');
        return { commands: [], compileFlags: [], warnings };
    }

    commands.push({ name: 'SOURCE', args: [sourceFile] });
    commands.push({ name: 'TARGET', args: [targetFile] });

    const includePath = (opt.includePath ?? '').trim();
    if (includePath) {
        commands.push({ name: 'INCLUDEPATH', args: [includePath] });
    }

    const sourceAlias = (opt.sourceAlias ?? '').trim();
    if (sourceAlias && sourceAlias !== sourceFile) {
        commands.push({ name: 'SOURCEALIAS', args: [sourceAlias] });
    }

    if (opt.target) {
        appendTargetFileCommands(commands, opt.target, opt.projectDir, opt.platform, warnings);
        appendTargetConstants(commands, opt.target, opt.createExecutable, opt.platform);
    }

    const compileFlags = buildCompilerStandbyCompileFlags(opt.target, {
        platform: opt.platform,
        checkSyntax: opt.checkSyntax,
        warnings,
    });

    commands.push({ name: 'COMPILE', args: compileFlags });

    return { commands, compileFlags, warnings };
}

export interface CompilerStandbyFlagBuildOptions {
    platform: NodeJS.Platform;
    checkSyntax: boolean;
    warnings: string[];
}

export function buildCompilerStandbyCompileFlags(
    target: PbpTarget | undefined,
    opt: CompilerStandbyFlagBuildOptions,
): string[] {
    const flags: string[] = ['PROGRESS', 'WARNINGS'];

    if (target) {
        appendTargetOptionFlags(flags, target, opt.platform, opt.warnings);
        appendExecutableFormatFlags(flags, target);
        appendDebuggerAndPurifierFlags(flags, target, opt.warnings);
        appendCpuFlags(flags, target);
    }

    if (opt.checkSyntax) {
        flags.push('CHECKSYNTAX');
    }

    return flags;
}

function appendTargetFileCommands(
    commands: CompilerStandbyCommand[],
    target: PbpTarget,
    projectDir: string | undefined,
    platform: NodeJS.Platform,
    warnings: string[],
): void {
    const linker = (target.linker?.fsPath ?? '').trim();
    if (linker) {
        commands.push({ name: 'LINKER', args: [linker] });
    }

    if (platform === 'win32' && Array.isArray(target.resources) && target.resources.length > 0) {
        const resourceFile = resolveOptionalProjectFile(projectDir, String(target.resources[0] ?? '').trim());
        if (resourceFile) {
            commands.push({ name: 'RESOURCE', args: [resourceFile] });
        }
        if (target.resources.length > 1) {
            warnings.push('Multiple resources are configured; compiler standby RESOURCE uses the first entry.');
        }
    }

    if ((platform === 'win32' || platform === 'darwin') && target.icon?.enabled) {
        const iconFile = (target.icon.fsPath ?? '').trim();
        if (iconFile) {
            commands.push({ name: 'ICON', args: [iconFile] });
        }
    }
}

function appendTargetConstants(
    commands: CompilerStandbyCommand[],
    target: PbpTarget,
    createExecutable: boolean,
    platform: NodeJS.Platform,
): void {
    if (target.exeConstant?.enabled) {
        commands.push({
            name: 'CONSTANT',
            args: [`PB_Editor_CreateExecutable=${createExecutable ? '1' : '0'}`],
        });
    }

    if (target.compileCount?.enabled) {
        commands.push({
            name: 'CONSTANT',
            args: [`PB_Editor_CompileCount=${target.compileCount.value ?? 0}`],
        });
    }

    if (target.buildCount?.enabled) {
        commands.push({
            name: 'CONSTANT',
            args: [`PB_Editor_BuildCount=${target.buildCount.value ?? 0}`],
        });
    }

    if (platform === 'win32' && target.versionInfo?.enabled) {
        appendVersionInfoConstants(commands, target);
    }

    if (!Array.isArray(target.constants)) return;

    for (const constant of target.constants) {
        if (!constant.enabled) continue;

        const normalized = normalizePureBasicConstantDefinition(constant.value);
        if (!normalized) continue;

        commands.push({ name: 'CONSTANT', args: [normalized] });
    }
}

function appendVersionInfoConstants(commands: CompilerStandbyCommand[], target: PbpTarget): void {
    const fieldNames: Record<string, string> = {
        field0: 'PB_Editor_FileVersionNumeric',
        field1: 'PB_Editor_ProductVersionNumeric',
        field2: 'PB_Editor_CompanyName',
        field3: 'PB_Editor_ProductName',
        field4: 'PB_Editor_ProductVersion',
        field5: 'PB_Editor_FileVersion',
        field6: 'PB_Editor_FileDescription',
        field7: 'PB_Editor_InternalName',
        field8: 'PB_Editor_OriginalFilename',
        field9: 'PB_Editor_LegalCopyright',
        field10: 'PB_Editor_LegalTrademarks',
        field11: 'PB_Editor_PrivateBuild',
        field12: 'PB_Editor_SpecialBuild',
        field13: 'PB_Editor_Email',
        field14: 'PB_Editor_Website',
    };

    for (const field of target.versionInfo?.fields ?? []) {
        const constantName = fieldNames[field.id];
        if (!constantName) continue;

        const value = replaceVersionInfoPlaceholders(field.value, target, new Date());
        commands.push({ name: 'CONSTANT', args: [`${constantName}=${value}`] });
    }
}

function appendTargetOptionFlags(
    flags: string[],
    target: PbpTarget,
    platform: NodeJS.Platform,
    warnings: string[],
): void {
    const options = target.options ?? {};

    if (options.thread) flags.push('THREAD');
    if (options.optimizer) flags.push('OPTIMIZER');
    if (options.onerror) flags.push('ONERROR');

    if ((platform === 'win32' || platform === 'darwin') && options.dpiaware) {
        flags.push('DPIAWARE');
    }

    if (platform === 'win32') {
        if (options.xpskin) flags.push('XPSKIN');
        if (options.dllprotection) flags.push('DLLPROTECTION');
        if (options.shareducrt) flags.push('SHAREDUCRT');

        if (options.admin) {
            flags.push('ADMINISTRATOR');
        } else if (options.user) {
            flags.push('USER');
        }

        if (options.admin && options.user) {
            warnings.push('Both "admin" and "user" are enabled; ADMINISTRATOR takes precedence like the PureBasic IDE target model.');
        }
    }

    if (platform === 'linux' && options.wayland) {
        flags.push('WAYLAND');
    }

    if (options.asm) {
        warnings.push('Target option "asm" is set, but no compiler standby flag is emitted for backend selection.');
    }
}

function appendExecutableFormatFlags(flags: string[], target: PbpTarget): void {
    const formatExe = (target.format?.exe ?? '').trim().toLowerCase();

    if (formatExe === 'dll') {
        flags.push('DLL');
        return;
    }

    if (formatExe === 'console') {
        flags.push('CONSOLE');
    }
}

function appendDebuggerAndPurifierFlags(flags: string[], target: PbpTarget, warnings: string[]): void {
    const hasDebugger = !!target.options?.debug;

    if (hasDebugger) {
        flags.push('DEBUGGER');

        if (target.purifier?.enabled) {
            flags.push('PURIFIER');
        }
        return;
    }

    if (target.purifier?.enabled) {
        warnings.push('Purifier is enabled but debugger is not enabled; the PureBasic compiler requires DEBUGGER for PURIFIER.');
    }
}

function appendCpuFlags(flags: string[], target: PbpTarget): void {
    const cpuRaw = (target.format?.cpu ?? '').trim();
    if (!cpuRaw) return;

    const cpu = Number.parseInt(cpuRaw, 10);
    if (!Number.isFinite(cpu)) return;

    const cpuFlags: Record<number, string> = {
        1: 'DYNAMICCPU',
        2: 'MMX',
        3: '3DNOW',
        4: 'SSE',
        5: 'SSE2',
    };

    const flag = cpuFlags[cpu];
    if (flag) {
        flags.push(flag);
    }
}

function getSourceIncludePath(sourceFile: string, projectDir: string | undefined): string | undefined {
    if (!sourceFile) return projectDir;

    const sourceDir = path.dirname(sourceFile);
    if (sourceDir && sourceDir !== '.') {
        return sourceDir;
    }

    return projectDir;
}

function resolveOptionalProjectFile(projectDir: string | undefined, rawPath: string): string {
    const raw = typeof rawPath === 'string' ? rawPath.trim() : '';
    const baseDir = typeof projectDir === 'string' ? projectDir.trim() : '';

    if (!raw) return '';
    if (!baseDir || isAnyPlatformAbsolutePath(raw)) {
        return raw;
    }

    const separator = getPreferredPathSeparator(baseDir);
    const normalizedBase = baseDir.replace(/[\\/]+$/, '');
    const normalizedRaw = raw.replace(/^[\\/]+/, '').replace(/[\\/]+/g, separator);
    return `${normalizedBase}${separator}${normalizedRaw}`;
}

function normalizePureBasicConstantDefinition(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '';

    const equalIndex = trimmed.indexOf('=');
    if (equalIndex < 0) {
        return trimmed.replace(/^#+/, '').trim();
    }

    const name = trimmed.slice(0, equalIndex).replace(/^#+/, '').trim();
    const rawValue = trimmed.slice(equalIndex + 1).trim();
    const normalizedValue = stripSinglePairOfDoubleQuotes(expandEnvironmentReferences(rawValue));

    if (!name) return '';
    return `${name}=${normalizedValue}`;
}

function expandEnvironmentReferences(value: string): string {
    return value.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_match, name: string) => process.env[name] ?? '');
}

function stripSinglePairOfDoubleQuotes(value: string): string {
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
        return value.slice(1, -1);
    }
    return value;
}

function replaceVersionInfoPlaceholders(value: string, target: PbpTarget, date: Date): string {
    return value
        .replace(/%OS/g, 'Windows')
        .replace(/%SOURCE/g, path.basename(target.inputFile?.fsPath ?? target.inputFile?.rawPath ?? ''))
        .replace(/%EXECUTABLE/g, path.basename(target.executable?.fsPath || target.outputFile?.fsPath || ''))
        .replace(/%COMPILECOUNT/g, String(target.compileCount?.value ?? 0))
        .replace(/%BUILDCOUNT/g, String(target.buildCount?.value ?? 0))
        .replace(/%yyyy/g, String(date.getFullYear()).padStart(4, '0'))
        .replace(/%yy/g, String(date.getFullYear()).slice(-2))
        .replace(/%mm/g, String(date.getMonth() + 1).padStart(2, '0'))
        .replace(/%dd/g, String(date.getDate()).padStart(2, '0'))
        .replace(/%hh/g, String(date.getHours()).padStart(2, '0'))
        .replace(/%ii/g, String(date.getMinutes()).padStart(2, '0'))
        .replace(/%ss/g, String(date.getSeconds()).padStart(2, '0'));
}

function isAnyPlatformAbsolutePath(value: string): boolean {
    return value.startsWith('/') || value.startsWith('\\\\') || /^[a-zA-Z]:[\\/]/.test(value);
}

function getPreferredPathSeparator(value: string): string {
    return value.includes('\\') && !value.includes('/') ? '\\' : '/';
}
