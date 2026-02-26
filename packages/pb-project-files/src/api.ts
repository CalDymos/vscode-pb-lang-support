import * as vscode from 'vscode';
import type { PbpProject, PbpTarget } from '@caldymos/pb-project-core';

export type ProjectScope = 'internal' | 'external';

export interface PbProjectContext {
    project?: PbpProject;
    target?: PbpTarget;
}

export interface PbProjectContextPayload {
    /** Absolute path to the .pbp file */
    projectFile?: string;
    /** Absolute path to the project directory */
    projectDir?: string;
    /** Project display name (from .pbp config) */
    projectName?: string;

    /** Target name as stored in the .pbp */
    targetName?: string;

    /** Include search directories derived from the .pbp (absolute paths) */
    includeDirs?: string[];

    /** Project-related code files (.pb/.pbi) derived from the .pbp (absolute paths) */
    projectFiles?: string[];
}

export interface PbFileProjectPayload {
    /** Document URI (LSP) */
    documentUri: string;
    /** Project file URI (LSP) */
    projectFileUri?: string;
    /** Internal/external classification relative to the project root */
    scope?: ProjectScope;
}

export interface PbProjectFilesApi {
    readonly version: 1;

    getActiveContext(): PbProjectContext;
    getActiveContextPayload(): PbProjectContextPayload;

    /**
     * Returns the project that contains a file, if known.
     * Falls back to "best matching" project root containment if the file is not explicitly listed in the .pbp.
     */
    getProjectForFile(fileUri: vscode.Uri): PbpProject | undefined;

    refresh(): Promise<void>;
    pickActiveProject(): Promise<void>;
    pickActiveTarget(): Promise<void>;

    readonly onDidChangeActiveContext: vscode.Event<PbProjectContextPayload>;
}
