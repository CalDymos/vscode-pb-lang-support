/**
 * pb-lang-support – Unified host-side project/build context
 *
 * This module is the single decision point for:
 *  - using pb-project-files (.pbp) context when available,
 *  - falling back to non-.pbp sources when no project is active or the helper extension is missing.
 *
 * It returns a normalized view that can be consumed by:
 *  - LSP bridge payload creation,
 *  - host-side pbcompiler build commands,
 *  - debugger configuration (launch.json) generation.
 */

import * as path from 'path';
import * as vscode from 'vscode';

import type { PbpProject, PbpTarget, ResolvedBuildEntry } from '@caldymos/pb-project-core';
import { resolveBuildEntry } from '@caldymos/pb-project-core';

import type { FallbackSource } from './fallback-resolver';
import { FallbackResolver } from './fallback-resolver';

// ---------------------------------------------------------------------------
// pb-project-files API (v3)
// Mirrors PbProjectFilesApi from pb-project-files/src/api.ts.
// Only the subset used by pb-lang-support is declared here.
// ---------------------------------------------------------------------------

export interface PbProjectContextPayload {
    noProject?: boolean;
    projectFile?: string;
    projectDir?: string;
    projectName?: string;
    targetName?: string;
    projectFiles?: string[];
    project?: PbpProject;
    target?: PbpTarget;
}

export interface PbpProjectMinimal {
    projectFile: string;
    projectDir: string;
}

export interface PbProjectFilesApi {
    readonly version: 3;
    getActiveContextPayload(): PbProjectContextPayload;
    getProjectForFile(fileUri: vscode.Uri): PbpProjectMinimal | undefined;
    readonly onDidChangeActiveContext: vscode.Event<PbProjectContextPayload>;
}

// ---------------------------------------------------------------------------

export type UnifiedContextMode = 'pbp' | 'fallback';

export interface UnifiedContext {
    /** Where the context originates from. */
    mode: UnifiedContextMode;

    /** True if user selected "No Project" (pb-project-files) or pb-project-files is unavailable. */
    noProject: boolean;

    // --- Project identity (only when mode === 'pbp')
    projectFile?: string;
    projectFileUri?: string;
    projectDir?: string;
    projectName?: string;
    targetName?: string;

    // --- Language server scanning
    projectFiles: string[];

    // --- Normalized build/run information
    workingDir?: string; // run-cwd (from target.directory via resolveBuildEntry)
    inputFile?: string;
    outputFile?: string;
    executable?: string;

    // --- Detailed models (optional, for bridge/debug tooling)
    project?: PbpProject;
    target?: PbpTarget;
    resolvedBuild?: ResolvedBuildEntry;

    // --- Fallback diagnostics
    fallbackSource?: FallbackSource;
}

export interface ResolveUnifiedContextParams {
    api?: PbProjectFilesApi;
    fallbackResolver: FallbackResolver;
    activeDocument?: vscode.TextDocument;
}

/**
 * Resolves the active context from pb-project-files if available; otherwise falls back.
 *
 * If no file-backed active document is available in fallback mode, null is returned.
 */
export async function resolveUnifiedContext(params: ResolveUnifiedContextParams): Promise<UnifiedContext | null> {
    const doc = params.activeDocument?.uri.scheme === 'file' ? params.activeDocument : undefined;

    // Prefer .pbp context (pb-project-files) when available and not explicitly disabled.
    if (params.api) {
        const payload = params.api.getActiveContextPayload();

        if (!payload.noProject) {
            const projectFiles = Array.isArray(payload.projectFiles) ? payload.projectFiles : [];
            const project = payload.project;
            const target = payload.target;

            const resolvedBuild = (project && target)
                ? resolveBuildEntry(project, target)
                : undefined;

            // If target info is missing, fall back to the active editor for the input file.
            const inputFile = resolvedBuild?.inputFile || doc?.uri.fsPath;
            const workingDir = resolvedBuild?.workingDir
                || (inputFile ? path.dirname(inputFile) : payload.projectDir);

            return {
                mode: 'pbp',
                noProject: false,
                projectFile: payload.projectFile,
                projectFileUri: payload.projectFile ? vscode.Uri.file(payload.projectFile).toString() : undefined,
                projectDir: payload.projectDir,
                projectName: payload.projectName,
                targetName: payload.targetName,
                projectFiles,
                workingDir,
                inputFile,
                outputFile: resolvedBuild?.outputFile || target?.outputFile?.fsPath,
                executable: resolvedBuild?.executable || target?.executable?.fsPath || target?.outputFile?.fsPath,
                project,
                target,
                resolvedBuild,
            };
        }
        // payload.noProject: explicit "No Project" selection → use fallback
    }

    // Fallback mode requires an active file document.
    if (!doc) return null;

    const fb = await params.fallbackResolver.resolve(doc.uri);
    const inputFile = doc.uri.fsPath;
    const workingDir = path.dirname(inputFile);

    return {
        mode: 'fallback',
        noProject: true,
        projectFiles: fb?.projectFiles ?? [],
        workingDir,
        inputFile,
        outputFile: fb?.outputFile,
        executable: fb?.outputFile,
        fallbackSource: fb?.source,
    };
}