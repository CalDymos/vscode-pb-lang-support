/**
 * PureBasic Project Context Manager
 *
 * This manager intentionally does NOT perform workspace-wide discovery or .pbp parsing.
 * It consumes project/target information from the extension host (pb-project-files) via
 * LSP notifications and provides a lightweight per-project symbol aggregation.
 */

import { Connection } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import type { PbpProject, PbpTarget } from '@caldymos/pb-project-core';
import { PureBasicSymbol } from '../symbols/types';
import { symbolCache } from '../symbols/symbol-cache';

export interface ProjectContextLspPayload {
    version: 2;

    projectFileUri?: string;
    projectDir?: string;
    projectName?: string;

    targetName?: string;

    includeDirs?: string[];
    projectFiles?: string[];

    /** Full parsed project model forwarded from pb-project-files. null = explicitly cleared. */
    project?: PbpProject | null;
    /** Active target model forwarded from pb-project-files. null = explicitly cleared. */
    target?: PbpTarget | null;
}

export interface FileProjectLspPayload {
    version: 1;

    documentUri: string;
    projectFileUri?: string;
    scope?: 'internal' | 'external';
}

export interface ProjectContext {
    projectFileUri: string;
    projectDir?: string;
    projectName?: string;

    targetName?: string;

    includeDirs: string[];
    /** Absolute FS paths of all project files (from .pbp via pb-project-files). */
    projectFiles: Set<string>;
    /** file:// URIs of all project files – derived from projectFiles for fast lookup. */
    projectFileUris: Set<string>;

    /** Full parsed project model (from pb-project-files, via LSP notification). */
    project?: PbpProject;
    /** Active target model (from pb-project-files, via LSP notification). */
    activeTarget?: PbpTarget;

    lastModified: number;
}

export class ProjectManager {
    private readonly projects = new Map<string, ProjectContext>();
    private readonly fileToProject = new Map<string, string>();
    private readonly fileScope = new Map<string, 'internal' | 'external'>();

    private activeProjectFileUri?: string;
    private activeTargetName?: string;

    public constructor(private readonly connection: Connection) {}

    public setActiveContext(payload: ProjectContextLspPayload): void {
        if (!payload || payload.version !== 2) return;

        this.activeProjectFileUri = payload.projectFileUri;
        this.activeTargetName = payload.targetName;

        if (!payload.projectFileUri) return;

        const ctx = this.getOrCreateProject(payload.projectFileUri);
        ctx.projectDir = payload.projectDir;
        ctx.projectName = payload.projectName;
        ctx.targetName = payload.targetName;

        if (Array.isArray(payload.includeDirs)) {
            ctx.includeDirs = payload.includeDirs.filter(Boolean);
        }

        if (Array.isArray(payload.projectFiles)) {
            ctx.projectFiles = new Set(payload.projectFiles.filter(Boolean));
            ctx.projectFileUris = new Set(
                payload.projectFiles.filter(Boolean).map(p => URI.file(p).toString())
            );
        }

        if (payload.project !== undefined) {
            ctx.project = payload.project ?? undefined;
        }
        if (payload.target !== undefined) {
            ctx.activeTarget = payload.target ?? undefined;
        }

        ctx.lastModified = Date.now();
    }

    public setFileProjectMapping(payload: FileProjectLspPayload): void {
        if (!payload || payload.version !== 1) return;

        if (payload.scope === 'internal' || payload.scope === 'external') {
            this.fileScope.set(payload.documentUri, payload.scope);
        } else {
            this.fileScope.delete(payload.documentUri);
        }

        if (!payload.projectFileUri) {
            this.fileToProject.delete(payload.documentUri);
            return;
        }

        this.fileToProject.set(payload.documentUri, payload.projectFileUri);
        this.getOrCreateProject(payload.projectFileUri).lastModified = Date.now();
    }
    /**
     * No-op: symbol parsing is handled by symbol-manager / symbolCache.
     * Kept for API compatibility with server.ts.
     */
    public onDocumentOpen(_document: TextDocument): void { /* handled by symbolCache */ }

    /**
     * No-op: symbol parsing is handled by symbol-manager / symbolCache.
     * Kept for API compatibility with server.ts.
     */
    public onDocumentChange(_document: TextDocument): void { /* handled by symbolCache */ }

    public onDocumentClose(document: TextDocument): void {
        // Clean up routing maps so memory stays bounded to open documents.
        this.fileToProject.delete(document.uri);
        this.fileScope.delete(document.uri);
    }

    /**
     * Returns include directories for the project associated with the given document.
     */
    public getIncludeDirsForDocument(documentUri: string): string[] {
        const projectKey = this.getProjectKeyForDocument(documentUri);
        const ctx = projectKey ? this.projects.get(projectKey) : undefined;
        return ctx?.includeDirs ?? [];
    }

    /**
     * Returns the project-related file list for the project associated with the given document.
     */
    public getProjectFilesForDocument(documentUri: string): string[] {
        const projectKey = this.getProjectKeyForDocument(documentUri);
        const ctx = projectKey ? this.projects.get(projectKey) : undefined;
        return ctx ? Array.from(ctx.projectFiles) : [];
    }

    /**
     * Returns the full PbpProject model for the project associated with the given document.
     * Available only when pb-project-files is active and has sent the project model.
     */
    public getProjectModel(documentUri: string): PbpProject | undefined {
        const projectKey = this.getProjectKeyForDocument(documentUri);
        const ctx = projectKey ? this.projects.get(projectKey) : undefined;
        return ctx?.project;
    }

    /**
     * Returns the active PbpTarget for the project associated with the given document.
     * Available only when pb-project-files is active and has sent the target model.
     */
    public getActiveTarget(documentUri: string): PbpTarget | undefined {
        const projectKey = this.getProjectKeyForDocument(documentUri);
        const ctx = projectKey ? this.projects.get(projectKey) : undefined;
        return ctx?.activeTarget;
    }

    /**
     * Look up a symbol definition scoped to the project that contains the given document.
     * Delegates to symbolCache (populated by symbol-manager) and filters results to
     * files that belong to the same project.
     */
    public findSymbolDefinition(
        symbolName: string,
        documentUri: string
    ): { uri: string; symbol: PureBasicSymbol } | null {
        const projectKey = this.getProjectKeyForDocument(documentUri);
        if (!projectKey) return null;

        const ctx = this.projects.get(projectKey);
        if (!ctx) return null;

        const results = symbolCache.findSymbolExactDetailed(symbolName);
        if (results.length === 0) return null;

        // If the project has a known file list, prefer hits inside the project.
        if (ctx.projectFileUris.size > 0) {
            const inProject = results.find(r => ctx.projectFileUris.has(r.uri));
            if (inProject) return inProject;
        }

        // Fallback: accept any hit from a file explicitly mapped to this project.
        const mappedHit = results.find(r => this.fileToProject.get(r.uri) === projectKey);
        if (mappedHit) return mappedHit;

        return null;
    }

    private getProjectKeyForDocument(documentUri: string): string | undefined {
        const mapped = this.fileToProject.get(documentUri);
        if (mapped) return mapped;

        if (this.fileScope.get(documentUri) === 'external') {
            return undefined;
        }

        return this.activeProjectFileUri;
    }

    private getOrCreateProject(projectFileUri: string): ProjectContext {
        const existing = this.projects.get(projectFileUri);
        if (existing) return existing;

        const ctx: ProjectContext = {
            projectFileUri,
            includeDirs: [],
            projectFiles: new Set(),
            projectFileUris: new Set(),
            lastModified: Date.now(),
        };

        this.projects.set(projectFileUri, ctx);
        return ctx;
    }

}