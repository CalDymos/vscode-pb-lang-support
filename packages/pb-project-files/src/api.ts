import * as vscode from 'vscode';
import type { PbpProject, PbpTarget } from '@caldymos/pb-project-core';

export type ProjectScope = 'internal' | 'external';

export interface PbProjectContext {
    project?: PbpProject;
    target?: PbpTarget;
}

/**
 * Lightweight payload intended for consumers like language services.
 *
 * This payload is deliberately compact and stable.
 * For full project settings (all parsed model data + raw XML), use
 * getProjectSettingsPayload().
 */
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

    /** Optional full parsed project model (can be large). */
    project?: PbpProject;
    /** Optional full parsed target model (can be large). */
    target?: PbpTarget;
}

export interface PbProjectSettingsPayload {
    /** Absolute path to the .pbp file */
    projectFile: string;
    /** Absolute path to the project directory */
    projectDir: string;
    /** Parsed project model */
    project: PbpProject;
    /** Raw .pbp XML text */
    xml: string;
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
    readonly version: 2;

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

    /**
     * Loads a .pbp project file and returns the parsed model + raw XML.
     */
    getProjectSettingsPayload(projectFileUri: vscode.Uri): Promise<PbProjectSettingsPayload | undefined>;

    /**
     * Saves the project file from raw XML.
     */
    saveProjectXml(projectFileUri: vscode.Uri, xml: string): Promise<void>;

    /**
     * Saves the project file from a parsed model using the core writer.
     */
    saveProjectModel(projectFileUri: vscode.Uri, project: Pick<PbpProject, 'meta' | 'config' | 'data' | 'files' | 'targets' | 'libraries'>): Promise<void>;
}

