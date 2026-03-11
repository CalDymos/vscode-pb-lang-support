import * as vscode from 'vscode';
import type { PbpProject, PbpTarget } from '@caldymos/pb-project-core';

export type ProjectScope = 'internal' | 'external';

export interface PbProjectContext {
    project?: PbpProject;
    target?: PbpTarget;
}

export interface PbProjectContextPayload {
    /**
     * True if the user has explicitly selected "No Project".
     * Consumer can then fall back to an internal fallback, for example.
     * All other fields are undefined if this flag is set.
     */
    noProject?: boolean;

    /** Absolute path to the .pbp file */
    projectFile?: string;
    /** Absolute path to the project directory */
    projectDir?: string;
    /** Project display name (from .pbp config) */
    projectName?: string;

    /** Target name as stored in the .pbp */
    targetName?: string;

    /** Project-related code files (.pb/.pbi) derived from the .pbp (absolute paths) */
    projectFiles?: string[];

    /** Full parsed project model (may be large). */
    project?: PbpProject;

    /** Active target model (derived from project + targetName). */
    target?: PbpTarget;
}

export interface PbProjectSettingsPayload {
    projectFile: string;
    xml: string;
    project: PbpProject | null;
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
    readonly version: 3;

    getActiveContext(): PbProjectContext;
    getActiveContextPayload(): PbProjectContextPayload;

    /**
     * Returns the project that contains a file, if known.
     * Falls back to "best matching" project root containment if the file is not explicitly listed in the .pbp.
     */
    getProjectForFile(fileUri: vscode.Uri): PbpProject | undefined;

    /** Read a .pbp file (raw XML + parsed model). */
    readProjectFile(projectFileUri: vscode.Uri): Promise<PbProjectSettingsPayload>;

    /** Write a .pbp file by serializing a project model with the core writer. */
    writeProjectFileModel(projectFileUri: vscode.Uri, project: PbpProject): Promise<void>;

    /** Write a .pbp file using raw XML. */
    writeProjectFileXml(projectFileUri: vscode.Uri, xml: string): Promise<void>;

    refresh(): Promise<void>;
    pickActiveProject(): Promise<void>;
    pickActiveTarget(): Promise<void>;

    readonly onDidChangeActiveContext: vscode.Event<PbProjectContextPayload>;
}
