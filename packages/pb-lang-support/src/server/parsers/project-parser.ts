/**
 * PureBasic Project Parser (server wrapper)
 *
 * NOTE: The actual .pbp parsing logic is centralized in shared lib @caldymos/pb-project-core
 * so it can be reused by the language server and the extension host.
 */

import * as path from 'path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';

import {
    PbpProject,
    parsePbpProjectText,
    pickTarget,
    getProjectIncludeDirectories as getPbpIncludeDirs,
    getProjectIncludeFiles as getPbpIncludeFiles,
    getProjectSourceFiles as getPbpSourceFiles,
    PbpConfig,
} from "@caldymos/pb-project-core";

export interface ProjectFile {
    name: string;
    version: string;
    author: string;
    sourceFiles: string[];
    includeFiles: string[];
    libraries: string[];
    buildSettings: BuildSettings;
    filePath: string;
    directory: string;
}

export interface BuildSettings {
    executable: string;
    target: string;
    enableDebugger: boolean;
    enableUnicode: boolean;
    enableThreads: boolean;
    enableOnError: boolean;
    enablePurifier: boolean;
    enableConstantFolding: boolean;
    enableInlineASM: boolean;
    enableExplicit: boolean;
    enableOptimizer: boolean;
    subsystem: string;
    commandLine: string;
}

export interface ParsedProject {
    project: ProjectFile;
    includedSymbols: Map<string, any>;
    fileDependencies: Map<string, string[]>;
}

/**
 * Parse a .pbp project document.
 */
export function parseProjectFile(document: TextDocument): ParsedProject | null {
    try {
        const pbpUri = URI.parse(document.uri);
        const pbpFsPath = pbpUri.fsPath;

        const pbpProject = parsePbpProjectText(document.getText(), pbpFsPath);
        if (!pbpProject) return null;

        const project = mapToServerProjectFile(document.uri, pbpProject);

        return {
            project,
            includedSymbols: new Map<string, any>(),
            fileDependencies: new Map<string, string[]>(),
        };
    } catch {
        return null;
    }
}


function guessTargetOs(pbp: PbpProject, defaultTargetCompilerVersion?: string, outputPath?: string): string {
    const v = (defaultTargetCompilerVersion ?? '').toLowerCase();

    if (v.includes('windows')) return 'Windows';
    if (v.includes('linux')) return 'Linux';
    if (v.includes('mac')) return 'MacOS';

    const out = (outputPath ?? '').toLowerCase();
    if (out.endsWith('.exe') || out.endsWith('.dll')) return 'Windows';
    if (out.endsWith('.so')) return 'Linux';
    if (out.endsWith('.app') || out.endsWith('.dylib')) return 'MacOS';

    // Fallback to current process platform
    switch (process.platform) {
        case 'win32': return 'Windows';
        case 'darwin': return 'MacOS';
        default: return 'Linux';
    }
}

function mapToServerProjectFile(documentUri: string, pbp: PbpProject): ProjectFile {
    const defaultTarget = pickTarget(pbp);

    const enableDebugger = defaultTarget?.options['debug'] ?? false;
    const enableUnicode = defaultTarget?.options['unicode'] ?? false;
    const enableThreads = defaultTarget?.options['thread'] ?? false;
    const enableOnError = defaultTarget?.options['onerror'] ?? false;

    const name = pbp.config?.name ?? '';

    // The existing server types expect some fields which are not explicit in .pbp.
    // Keep them empty/default for now.
    return {
        name: name,
        version: '1.0.0',
        author: '',
        sourceFiles: getPbpSourceFiles(pbp),
        includeFiles: getPbpIncludeFiles(pbp),
        libraries: pbp.libraries ?? [],
        buildSettings: {
            executable: defaultTarget?.executable.fsPath ?? defaultTarget?.outputFile.fsPath ?? '',
            target: guessTargetOs(pbp, defaultTarget?.compilerVersion, defaultTarget?.outputFile.rawPath ?? defaultTarget?.executable.rawPath),
            enableDebugger,
            enableUnicode,
            enableThreads,
            enableOnError,
            enablePurifier: defaultTarget?.purifier?.enabled ?? defaultTarget?.options['purifier'] ?? false,
            enableConstantFolding:
                defaultTarget?.options['constantfolding'] ??
                defaultTarget?.options['constant_folding'] ??
                defaultTarget?.options['constantfold'] ??
                false,
            enableInlineASM:
                defaultTarget?.options['asm'] ??
                defaultTarget?.options['inlineasm'] ??
                defaultTarget?.options['inlineassembly'] ??
                false,
            enableExplicit:
                defaultTarget?.options['explicit'] ??
                defaultTarget?.options['enableexplicit'] ??
                defaultTarget?.options['enable_explicit'] ??
                false,
            enableOptimizer: defaultTarget?.options['optimizer'] ?? false,
            // Prefer the explicit subsystem (<subsystem value="..."/>) and fall back to the executable format (<format exe="..."/>)
            subsystem: defaultTarget?.subsystem ?? defaultTarget?.format?.['exe'] ?? '',
            commandLine: defaultTarget?.commandLine ?? '',
        },
        filePath: documentUri,
        directory: ensureTrailingSep(pbp.projectDir),
    };
}

function ensureTrailingSep(dirPath: string): string {
    if (!dirPath) return '';
    return dirPath.endsWith(path.sep) ? dirPath : dirPath + path.sep;
}

/**
 * Checks whether a document is a project file.
 */
export function isProjectFile(document: TextDocument): boolean {
    return URI.parse(document.uri).fsPath.toLowerCase().endsWith('.pbp');
}

/**
 * Extract all project-related source/include files (absolute paths).
 */
export function extractProjectFiles(project: ProjectFile): string[] {
    return [...project.sourceFiles, ...project.includeFiles];
}

/**
 * Get all include directories that should be searched for includes.
 */
export function getProjectIncludeDirectories(project: ProjectFile): string[] {
    
    // Rebuild a minimal PbpProject view to reuse the shared include dir logic.
    const pbp: PbpProject = {
        projectFile: '',
        projectDir: project.directory,
        config: {
            name: project.name,
            comment: '',
            closefiles: false,
            openmode: 0,
        },
        data: {},
        files: [
            ...project.sourceFiles.map(p => ({ rawPath: p, fsPath: p })),
            ...project.includeFiles.map(p => ({ rawPath: p, fsPath: p })),
        ],
        libraries: [],
        targets: [],
    };

    return getPbpIncludeDirs(pbp);
}
