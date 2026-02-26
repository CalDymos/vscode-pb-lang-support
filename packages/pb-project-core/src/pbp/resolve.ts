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
    const executable = target.executable?.fsPath ?? '';

    // Target.directory is usually a relative directory inside the project.
    const workingDir = resolveProjectPath(project.projectDir, target.directory ?? '');

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

export function resolveProjectPath(projectDir: string, rawPath: string): string {
    const p = normalizeRawProjectPath(rawPath);
    if (!p || !projectDir) return '';

    const projectRoot = path.resolve(projectDir);
    const candidate = isAbsoluteCrossPlatform(p)
        ? path.normalize(path.resolve(p))
        : path.normalize(path.resolve(projectRoot, p));

    // Reject paths that escape the project root (including absolute external paths).
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
