/**
 * PureBasic Project Context Manager
 *
 * This manager intentionally does NOT perform workspace-wide discovery or .pbp parsing.
 * It consumes project/target information from the extension host (pb-project-files) via
 * LSP notifications and provides a lightweight per-project symbol aggregation.
 */

import { Connection } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

export interface ProjectContextLspPayload {
    version: 1;

    projectFileUri?: string;
    projectDir?: string;
    projectName?: string;

    targetName?: string;

    includeDirs?: string[];
    projectFiles?: string[];
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
    projectFiles: Set<string>;

    globalSymbols: Map<string, any>;
    fileSymbols: Map<string, Set<string>>;

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
        if (!payload || payload.version !== 1) return;

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
    public onDocumentOpen(document: TextDocument): void {
        this.updateProjectSymbols(document);
    }

    public onDocumentChange(document: TextDocument): void {
        this.updateProjectSymbols(document);
    }

    public onDocumentClose(document: TextDocument): void {
        const projectKey = this.getProjectKeyForDocument(document.uri);

        // Keep the maps bounded to currently open documents.
        this.fileToProject.delete(document.uri);
        this.fileScope.delete(document.uri);
        if (!projectKey) return;

        const ctx = this.projects.get(projectKey);
        if (!ctx) return;

        this.removeDocumentSymbols(ctx, document.uri);
        ctx.lastModified = Date.now();
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
     * Lookup a symbol in the project that contains the given document.
     */
    public findSymbolDefinition(symbolName: string, documentUri: string): any | null {
        const projectKey = this.getProjectKeyForDocument(documentUri);
        if (!projectKey) return null;

        const ctx = this.projects.get(projectKey);
        if (!ctx) return null;

        return ctx.globalSymbols.get(symbolName) || null;
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
            globalSymbols: new Map(),
            fileSymbols: new Map(),
            lastModified: Date.now(),
        };

        this.projects.set(projectFileUri, ctx);
        return ctx;
    }

    private updateProjectSymbols(document: TextDocument): void {
        // Do not attempt to parse .pbp XML as PureBasic source.
        if (document.uri.toLowerCase().endsWith('.pbp')) {
            return;
        }

        const projectKey = this.getProjectKeyForDocument(document.uri);
        if (!projectKey) return;

        const ctx = this.getOrCreateProject(projectKey);

        // Replace symbols from this document.
        this.removeDocumentSymbols(ctx, document.uri);

        const symbols = this.extractSymbols(document);
        const names = new Set<string>();

        for (const sym of symbols) {
            names.add(sym.name);
            ctx.globalSymbols.set(sym.name, sym);
        }

        ctx.fileSymbols.set(document.uri, names);
        ctx.lastModified = Date.now();
    }

    private removeDocumentSymbols(ctx: ProjectContext, documentUri: string): void {
        const names = ctx.fileSymbols.get(documentUri);
        if (!names) return;

        for (const name of names) {
            const existing = ctx.globalSymbols.get(name);
            if (existing && existing.file === documentUri) {
                ctx.globalSymbols.delete(name);
            }
        }

        ctx.fileSymbols.delete(documentUri);
    }

    private extractSymbols(document: TextDocument): Array<{ name: string; type: string; file: string; line: number; definition: string } > {
        const content = document.getText();
        const lines = content.split('\n');
        const out: Array<{ name: string; type: string; file: string; line: number; definition: string } > = [];

        for (let i = 0; i < lines.length; i++) {
            const raw = lines[i];
            const line = raw.trim();

            // Procedure definitions
            const procMatch = line.match(/^(?:Procedure(?:\.\w+)?)\s+(\w+)\s*\(/i);
            if (procMatch) {
                out.push({
                    name: procMatch[1],
                    type: 'procedure',
                    file: document.uri,
                    line: i,
                    definition: raw,
                });
                continue;
            }

            // Macro definitions
            const macroMatch = line.match(/^Macro\s+(\w+)\b/i);
            if (macroMatch) {
                out.push({
                    name: macroMatch[1],
                    type: 'macro',
                    file: document.uri,
                    line: i,
                    definition: raw,
                });
                continue;
            }

            // Constants: #NAME = ...
            const constMatch = line.match(/^#\s*([a-zA-Z_][a-zA-Z0-9_]*\$?)\s*=/);
            if (constMatch) {
                out.push({
                    name: constMatch[1],
                    type: 'constant',
                    file: document.uri,
                    line: i,
                    definition: raw,
                });
                continue;
            }

            // Structures
            const structMatch = line.match(/^Structure\s+(\w+)\b/i);
            if (structMatch) {
                out.push({
                    name: structMatch[1],
                    type: 'structure',
                    file: document.uri,
                    line: i,
                    definition: raw,
                });
                continue;
            }

            // Globals
            const globalMatch = line.match(/^(?:Global|Define)\s+(\w+)\b/i);
            if (globalMatch) {
                out.push({
                    name: globalMatch[1],
                    type: 'variable',
                    file: document.uri,
                    line: i,
                    definition: raw,
                });
            }
        }

        return out;
    }
}
