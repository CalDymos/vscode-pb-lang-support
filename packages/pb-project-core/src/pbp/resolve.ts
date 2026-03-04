/*
 * @caldymos/pb-project-core
 *
 * PureBasic Project (.pbp) resolve helpers.
 */

import * as path from 'path';

import type { PbpProject, PbpTarget } from './model';

export type ProjectPathKind = 'internal' | 'external';

export interface ResolvedBuildEntry {
    projectFile: string;
    projectDir: string;
    targetName: string;
    workingDir: string;
    inputFile: string;
    outputFile: string;
    executable: string;
    inputKind: ProjectPathKind;
    outputKind: ProjectPathKind;
    executableKind: ProjectPathKind;
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

export function classifyProjectPath(projectDir: string, fsPath: string): ProjectPathKind {
    if (!projectDir || !fsPath) return 'external';

    const rel = path.relative(projectDir, fsPath);
    if (!rel) return 'internal';

    // If rel starts with '..' or is absolute, it is outside.
    if (rel === '..' || rel.startsWith('..' + path.sep)) return 'external';
    if (path.isAbsolute(rel)) return 'external';

    return 'internal';
}

export function resolveBuildEntry(project: PbpProject, target: PbpTarget): ResolvedBuildEntry {
    const inputFile = target.inputFile?.fsPath ?? '';
    const outputFile = target.outputFile?.fsPath ?? '';
    const executable = (target.executable?.fsPath ?? '') || outputFile;

    // Target output/working directory may be outside of the project root.
    const workingDir = resolveTargetPath(project.projectDir, target.directory ?? '');

    return {
        projectFile: project.projectFile,
        projectDir: project.projectDir,
        targetName: target.name,
        workingDir: workingDir || project.projectDir,
        inputFile,
        outputFile,
        executable,
        inputKind: classifyProjectPath(project.projectDir, inputFile),
        outputKind: classifyProjectPath(project.projectDir, outputFile),
        executableKind: classifyProjectPath(project.projectDir, executable),
    };
}

/** Removes a leading "./" or ".\" (including repeated slashes, e.g. ".//") from a path-like string. */
function stripLeadingDotSlash(rawPath: string): string {
    return rawPath.replace(/^\.[\\/]+/, '');
}

/**
 * Resolves a project path but allows paths outside of the project root.
 *
 * This is required for target-related values such as output file,
 * executable, working directory, icon path, or linker option file.
 */
export function resolveTargetPath(projectDir: string, rawPath: string): string {
    let p = rawPath.trim();
    if (!p || !projectDir) return '';

    // Strip leading ./ or .\\
    p = stripLeadingDotSlash(p);

    // Windows absolute path: normalize with win32 on any platform.
    if (looksLikeWindowsAbs(p)) {
        return path.win32.normalize(p);
    }

    // POSIX absolute
    if (p.startsWith('/')) {
        return path.posix.normalize(p);
    }

    // Relative: resolve based on the style of projectDir.
    const isWinProject = looksLikeWindowsAbs(projectDir) || projectDir.includes('\\');
    if (isWinProject) {
        const rp = p.replace(/[\\/]+/g, '\\');
        return path.win32.normalize(path.win32.resolve(projectDir, rp));
    }

    const rp = p.replace(/[\\/]+/g, path.sep);
    return path.normalize(path.resolve(projectDir, rp));
}

export function resolveProjectPath(projectDir: string, rawPath: string): string {
    const p = normalizeRawProjectPath(rawPath);
    if (!p || !projectDir) return '';

    // Absolute paths are stored as-is by PureBasic IDE for files outside the project root.
    // Return them directly without root-containment check.
    // Use platform-specific normalizers to avoid mis-resolving Windows/UNC paths on non-Windows.
    if (looksLikeWindowsAbs(p)) {
        return path.win32.normalize(p);
    }
    if (p.startsWith('/')) {
        return path.posix.normalize(p);
    }

    const projectRoot = path.resolve(projectDir);
    const candidate = path.normalize(path.resolve(projectRoot, p));

    // Reject relative paths that escape the project root via '..'.
    const relBase = path.sep === '\\' ? projectRoot.toLowerCase() : projectRoot;
    const relTarget = path.sep === '\\' ? candidate.toLowerCase() : candidate;
    const rel = path.relative(relBase, relTarget);

    if (!rel) {
        return candidate;
    }

    if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) {
        return '';
    }

    return candidate;
}

function normalizeRawProjectPath(rawPath: string): string {
    let p = rawPath.trim();
    if (!p) return '';

    // Strip leading ./ or .\\
    p = stripLeadingDotSlash(p);

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

function looksLikeWindowsAbs(p: string): boolean {
    if (p.startsWith('\\\\')) return true;
    return /^[a-zA-Z]:[\\/]/.test(p);
}