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
    version: 3;

    /** set if "No Project" is selected */
    noProject?: boolean;

    projectFileUri?: string;
    projectDir?: string;
    projectName?: string;

    targetName?: string;

    projectFiles?: { fsPath: string; scan: boolean }[];

    /** Full parsed project model forwarded from pb-project-files. null = explicitly cleared. */
    project?: PbpProject | null;
    /** Active target model forwarded from pb-project-files. null = explicitly cleared. */
    target?: PbpTarget | null;
}

export interface FileProjectLspPayload {
    version: 3;

    documentUri: string;
    projectFileUri?: string;
    scope?: 'internal' | 'external';
}

export interface ProjectContext {
    projectFileUri: string;
    projectDir?: string;
    projectName?: string;

    targetName?: string;

    /** Absolute FS paths of all project files (from .pbp via pb-project-files). */
    projectFiles: Set<string>;
    /** file:// URIs of all project files – derived from projectFiles for fast lookup. */
    projectFileUris: Set<string>;

    /** Subset of projectFiles where scan === true. */
    scanFiles: Set<string>;
    /** file:// URIs of scan-enabled project files. */
    scanFileUris: Set<string>;

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

    private static readonly FALLBACK_KEY = '__fallback__';

    public setActiveContext(payload: ProjectContextLspPayload): void {
        if (!payload || payload.version !== 3) return;

    if (payload.noProject === true) {
        this.activeProjectFileUri = ProjectManager.FALLBACK_KEY;
        // Clear stale per-file project mappings so they cannot override fallback context.
        this.fileToProject.clear();
        this.fileScope.clear();
        const ctx = this.getOrCreateProject(ProjectManager.FALLBACK_KEY);
        const entries = payload.projectFiles?.filter(e => Boolean(e?.fsPath)) ?? [];
        ctx.projectFiles    = new Set(entries.map(e => e.fsPath));
        ctx.projectFileUris = new Set(entries.map(e => URI.file(e.fsPath).toString()));
        ctx.scanFiles       = new Set(entries.filter(e => e.scan).map(e => e.fsPath));
        ctx.scanFileUris    = new Set(entries.filter(e => e.scan).map(e => URI.file(e.fsPath).toString()));
        ctx.lastModified = Date.now();
        return;
    }

        this.activeProjectFileUri = payload.projectFileUri;
        this.activeTargetName = payload.targetName;

        if (!payload.projectFileUri) return;

        const ctx = this.getOrCreateProject(payload.projectFileUri);
        ctx.projectDir = payload.projectDir;
        ctx.projectName = payload.projectName;
        ctx.targetName = payload.targetName;

        if (Array.isArray(payload.projectFiles)) {
            const entries = payload.projectFiles.filter(e => Boolean(e?.fsPath));
            ctx.projectFiles    = new Set(entries.map(e => e.fsPath));
            ctx.projectFileUris = new Set(entries.map(e => URI.file(e.fsPath).toString()));
            ctx.scanFiles       = new Set(entries.filter(e => e.scan).map(e => e.fsPath));
            ctx.scanFileUris    = new Set(entries.filter(e => e.scan).map(e => URI.file(e.fsPath).toString()));
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
        if (!payload || payload.version !== 3) return;

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
     * Returns only scan-enabled project files for the project associated with the given document.
     * Use this for symbol indexing and LSP search operations.
     */
    public getProjectFilesForDocument(documentUri: string): string[] {
        const projectKey = this.getProjectKeyForDocument(documentUri);
        const ctx = projectKey ? this.projects.get(projectKey) : undefined;
        return ctx ? Array.from(ctx.scanFiles) : [];
    }

    /**
     * Returns all project files (regardless of scan flag) for the project associated
     * with the given document.
     */
    public getAllProjectFilesForDocument(documentUri: string): string[] {
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
            projectFiles: new Set(),
            projectFileUris: new Set(),
            scanFiles: new Set(),
            scanFileUris: new Set(),
            lastModified: Date.now(),
        };

        this.projects.set(projectFileUri, ctx);
        return ctx;
    }

}