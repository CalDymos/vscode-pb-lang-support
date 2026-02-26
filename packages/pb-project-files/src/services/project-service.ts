import * as vscode from 'vscode';
import * as path from 'path';

import {
    parsePbpProjectText,
    pickTarget,
    getProjectIncludeDirectories,
    getProjectSourceFiles,
    getProjectIncludeFiles,
    type PbpProject,
    type PbpTarget,
} from '@caldymos/pb-project-core';

import type { PbFileProjectPayload, PbProjectContext, PbProjectContextPayload, PbProjectFilesApi, ProjectScope } from '../api';

const DEFAULT_PBP_GLOB = '**/*.pbp';
const DEFAULT_EXCLUDE_GLOB = '**/{node_modules,.git}/**';

const WSKEY_ACTIVE_PROJECT = 'pbProjectFiles.activeProjectFile';
const WSKEY_ACTIVE_TARGET = 'pbProjectFiles.activeTargetName';

function normalizeFsPath(fsPath: string): string {
    const p = path.normalize(fsPath);
    return process.platform === 'win32' ? p.toLowerCase() : p;
}

function formatInternalError(err: unknown): string {
    if (err instanceof Error) {
        return err.message;
    }
    return String(err);
}

function classifyScope(projectDir: string, filePath: string): ProjectScope {
    const proj = normalizeFsPath(projectDir);
    const file = normalizeFsPath(filePath);
    if (!proj) return 'external';
    const rel = path.relative(proj, file);
    return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? 'internal' : 'external';
}

function formatStatusBarText(ctx: PbProjectContextPayload): string {
    const proj = ctx.projectFile ? path.basename(ctx.projectFile) : 'No Project';
    const tgt = ctx.targetName ? `  [${ctx.targetName}]` : '';
    return `PB: ${proj}${tgt}`;
}

export class ProjectService implements vscode.Disposable {
    private readonly projects = new Map<string, PbpProject>();

    /** Maps normalized absolute fsPath -> normalized .pbp fsPath */
    private readonly fileToProject = new Map<string, string>();

    /** Cached per project (keyed by normalized .pbp fsPath) */
    private readonly projectMeta = new Map<string, { includeDirs: string[]; projectFiles: string[] }>();

    private activeProjectFile?: string;
    private activeTargetName?: string;

    private readonly onDidChangeActiveContextEmitter = new vscode.EventEmitter<PbProjectContextPayload>();
    public readonly onDidChangeActiveContext = this.onDidChangeActiveContextEmitter.event;

    private readonly statusBar: vscode.StatusBarItem;
    private readonly disposables: vscode.Disposable[] = [];

    private pbpWatcher?: vscode.FileSystemWatcher;

    public constructor(private readonly context: vscode.ExtensionContext) {
        this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBar.command = 'pbProjectFiles.pickProject';
        this.statusBar.tooltip = 'Select active PureBasic project/target';
        this.statusBar.show();
        this.disposables.push(this.statusBar);

        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(() => {
                void this.syncActiveContextFromEditor();
            })
        );

        // Keep project discovery in sync for multi-root workspaces.
        this.disposables.push(
            vscode.workspace.onDidChangeWorkspaceFolders(() => {
                void this.refresh();
            })
        );
    }

    public getApi(): PbProjectFilesApi {
        return {
            version: 1,
            getActiveContext: () => this.getActiveContext(),
            getActiveContextPayload: () => this.getActiveContextPayload(),
            getProjectForFile: (fileUri: vscode.Uri) => this.getProjectForFile(fileUri),
            refresh: () => this.refresh(),
            pickActiveProject: () => this.pickActiveProject(),
            pickActiveTarget: () => this.pickActiveTarget(),
            onDidChangeActiveContext: this.onDidChangeActiveContext,
        };
    }

    public async initialize(): Promise<void> {
        // Restore persisted state first.
        const persistedProject = this.context.workspaceState.get<string>(WSKEY_ACTIVE_PROJECT);
        const persistedTarget = this.context.workspaceState.get<string>(WSKEY_ACTIVE_TARGET);
        this.activeProjectFile = persistedProject ? normalizeFsPath(persistedProject) : undefined;
        this.activeTargetName = persistedTarget ?? undefined;

        await this.refresh();
        await this.syncActiveContextFromEditor();
        this.installWatchers();
        this.updateStatusBar();
        this.emitActiveContextChanged();
    }

    public dispose(): void {
        for (const d of this.disposables.splice(0)) d.dispose();
        this.pbpWatcher?.dispose();
        this.onDidChangeActiveContextEmitter.dispose();
    }

    public getActiveContext(): PbProjectContext {
        const project = this.activeProjectFile ? this.projects.get(this.activeProjectFile) : undefined;
        const target = project ? this.getActiveTarget(project) : undefined;
        return { project, target };
    }

    public getActiveContextPayload(): PbProjectContextPayload {
        const proj = this.activeProjectFile ? this.projects.get(this.activeProjectFile) : undefined;
        const meta = this.activeProjectFile ? this.projectMeta.get(this.activeProjectFile) : undefined;
        return {
            projectFile: proj?.projectFile ?? this.activeProjectFile,
            projectDir: proj?.projectDir,
            projectName: proj?.config?.name,
            targetName: this.activeTargetName,
            includeDirs: meta?.includeDirs ?? [],
            projectFiles: meta?.projectFiles ?? [],
        };
    }

    public getProjectForFile(fileUri: vscode.Uri): PbpProject | undefined {
        const fsPath = normalizeFsPath(fileUri.fsPath);

        // If the file is a .pbp, it is its own project key.
        if (fsPath.toLowerCase().endsWith('.pbp')) {
            return this.projects.get(fsPath);
        }

        const projFile = this.fileToProject.get(fsPath);
        if (projFile) return this.projects.get(projFile);

        // Fallback: best matching project root containment
        const best = this.findBestProjectByRoot(fsPath);
        if (best) {
            // Cache the result for faster subsequent lookups.
            this.fileToProject.set(fsPath, best);
            return this.projects.get(best);
        }

        return undefined;
    }

    public async refresh(): Promise<void> {
        const pbpUris = await vscode.workspace.findFiles(DEFAULT_PBP_GLOB, DEFAULT_EXCLUDE_GLOB);

        this.projects.clear();
        this.fileToProject.clear();
        this.projectMeta.clear();

        for (const uri of pbpUris) {
            const parsed = await this.tryParseProject(uri);
            if (!parsed) continue;
            const key = normalizeFsPath(parsed.projectFile);
            this.projects.set(key, parsed);
            this.projectMeta.set(key, this.computeProjectMeta(parsed));
        }

        this.rebuildFileToProjectMap();

        // Keep the previously active project if it still exists; otherwise pick first.
        if (this.activeProjectFile && !this.projects.has(this.activeProjectFile)) {
            this.activeProjectFile = undefined;
            this.activeTargetName = undefined;
        }

        if (!this.activeProjectFile) {
            const first = this.projects.keys().next();
            if (!first.done) {
                this.activeProjectFile = first.value;
                const proj = this.projects.get(first.value);
                this.activeTargetName = proj ? this.getActiveTarget(proj)?.name : undefined;
            }
        }

        await this.persistActiveState();

        this.updateStatusBar();
        this.emitActiveContextChanged();
    }

    public async pickActiveProject(): Promise<void> {
        const items = [...this.projects.values()].map(p => ({
            label: p.config?.name?.trim() ? p.config.name : path.basename(p.projectFile),
            description: p.projectFile,
            projectFile: normalizeFsPath(p.projectFile),
        }));

        if (items.length === 0) {
            void vscode.window.showInformationMessage('No .pbp projects found in the workspace.');
            return;
        }

        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select active PureBasic project',
            matchOnDescription: true,
        });
        if (!picked) return;

        await this.setActiveProject(picked.projectFile);
    }

    public async pickActiveTarget(): Promise<void> {
        const proj = this.activeProjectFile ? this.projects.get(this.activeProjectFile) : undefined;
        if (!proj) {
            void vscode.window.showInformationMessage('No active project.');
            return;
        }

        const targets = proj.targets ?? [];
        if (targets.length === 0) {
            void vscode.window.showInformationMessage('Active project has no targets.');
            return;
        }

        const items = targets.map(t => ({
            label: t.name,
            description: `${t.enabled ? 'enabled' : 'disabled'}${t.isDefault ? ', default' : ''}`,
            targetName: t.name,
        }));

        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select active PureBasic target',
            matchOnDescription: true,
        });
        if (!picked) return;

        this.activeTargetName = picked.targetName;
        await this.persistActiveState();
        this.updateStatusBar();
        this.emitActiveContextChanged();
    }

    private async setActiveProject(projectFile: string): Promise<void> {
        const key = normalizeFsPath(projectFile);
        const proj = this.projects.get(key);
        if (!proj) return;

        this.activeProjectFile = key;
        // Keep a previously selected target if still present; otherwise pick default.
        const t = this.getActiveTarget(proj);
        this.activeTargetName = t?.name;

        await this.persistActiveState();
        this.updateStatusBar();
        this.emitActiveContextChanged();
    }

    private async persistActiveState(): Promise<void> {
        await this.context.workspaceState.update(WSKEY_ACTIVE_PROJECT, this.activeProjectFile);
        await this.context.workspaceState.update(WSKEY_ACTIVE_TARGET, this.activeTargetName);
    }

    private getActiveTarget(project: PbpProject): PbpTarget | undefined {
        if (this.activeTargetName) {
            const byName = (project.targets ?? []).find(t => t.name === this.activeTargetName);
            if (byName) return byName;
        }

        const t = pickTarget(project);
        return t ?? project.targets?.[0];
    }

    private computeProjectMeta(project: PbpProject): { includeDirs: string[]; projectFiles: string[] } {
        const includeDirs = [...new Set((getProjectIncludeDirectories(project) ?? []).filter(Boolean))];

        const src = (getProjectSourceFiles(project) ?? []).filter(Boolean);
        const inc = (getProjectIncludeFiles(project) ?? []).filter(Boolean);
        const projectFiles = [...new Set([...src, ...inc])]
            .filter(p => p.toLowerCase().endsWith('.pb') || p.toLowerCase().endsWith('.pbi'))
            .map(p => path.resolve(p));

        return { includeDirs, projectFiles };
    }

    private rebuildFileToProjectMap(): void {
        this.fileToProject.clear(); // Clear before rebuilding to remove stale entries.
        
        for (const proj of this.projects.values()) {
            const projKey = normalizeFsPath(proj.projectFile);

            // Project file itself.
            this.fileToProject.set(projKey, projKey);

            for (const f of proj.files ?? []) {
                if (!f?.fsPath) continue;
                this.fileToProject.set(normalizeFsPath(f.fsPath), projKey);
            }

            // Also map all derived project files (even if not in proj.files).
            const meta = this.projectMeta.get(projKey);
            for (const filePath of meta?.projectFiles ?? []) {
                this.fileToProject.set(normalizeFsPath(filePath), projKey);
            }
        }
    }

    private findBestProjectByRoot(fileFsPath: string): string | undefined {
        let bestKey: string | undefined;
        let bestLen = -1;

        for (const [projKey, proj] of this.projects) {
            const projDir = proj.projectDir;
            if (!projDir) continue;
            const scope = classifyScope(projDir, fileFsPath);
            if (scope !== 'internal') continue;
            const len = normalizeFsPath(projDir).length;
            if (len > bestLen) {
                bestLen = len;
                bestKey = projKey;
            }
        }

        return bestKey;
    }

    private async syncActiveContextFromEditor(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const uri = editor.document.uri;
        if (uri.scheme !== 'file') return;

        // If the file is the project file itself.
        if (uri.fsPath.toLowerCase().endsWith('.pbp')) {
            await this.setActiveProject(uri.fsPath);
            return;
        }

        // If the file is known to be part of a project.
        const proj = this.getProjectForFile(uri);
        if (proj) {
            await this.setActiveProject(proj.projectFile);
        }
    }

    private installWatchers(): void {
        if (this.pbpWatcher) return;

        this.pbpWatcher = vscode.workspace.createFileSystemWatcher(DEFAULT_PBP_GLOB);
        this.disposables.push(this.pbpWatcher);

        this.pbpWatcher.onDidCreate(uri => void this.onPbpFileChanged(uri), this, this.disposables);
        this.pbpWatcher.onDidChange(uri => void this.onPbpFileChanged(uri), this, this.disposables);
        this.pbpWatcher.onDidDelete(uri => this.onPbpFileDeleted(uri), this, this.disposables);
    }

    private async onPbpFileChanged(uri: vscode.Uri): Promise<void> {
        const parsed = await this.tryParseProject(uri);
        const key = normalizeFsPath(uri.fsPath);

        if (!parsed) {
            // Keep an old cached project if parsing fails, but still refresh mapping.
            this.rebuildFileToProjectMap();
            this.updateStatusBar();
            return;
        }

        this.projects.set(key, parsed);
        this.projectMeta.set(key, this.computeProjectMeta(parsed));
        this.rebuildFileToProjectMap();

        if (this.activeProjectFile === key) {
            this.activeTargetName = this.getActiveTarget(parsed)?.name;
            await this.persistActiveState();
        }

        this.updateStatusBar();
        this.emitActiveContextChanged();
    }

    private onPbpFileDeleted(uri: vscode.Uri): void {
        const key = normalizeFsPath(uri.fsPath);
        this.projects.delete(key);
        this.projectMeta.delete(key);
        this.rebuildFileToProjectMap();

        if (this.activeProjectFile === key) {
            this.activeProjectFile = undefined;
            this.activeTargetName = undefined;
            void this.persistActiveState();
        }

        this.updateStatusBar();
        this.emitActiveContextChanged();
    }

    private async tryParseProject(uri: vscode.Uri): Promise<PbpProject | null> {
        try {
            const bytes = await vscode.workspace.fs.readFile(uri);
            const content = Buffer.from(bytes).toString('utf8');
            return parsePbpProjectText(content, uri.fsPath);
        } catch (err) {
            console.warn(
                `[pb-project-files] Failed to parse project: ${path.basename(uri.fsPath)} (${formatInternalError(err)})`
            );
            return null;
        }
    }

    private updateStatusBar(): void {
        const payload = this.getActiveContextPayload();
        this.statusBar.text = formatStatusBarText(payload);
    }

    private emitActiveContextChanged(): void {
        this.onDidChangeActiveContextEmitter.fire(this.getActiveContextPayload());
    }

    /**
     * Helper used by external consumers that want file->project mapping payload.
     */
    public buildFileProjectPayload(document: vscode.TextDocument): PbFileProjectPayload {
        const proj = this.getProjectForFile(document.uri);
        const projectFileUri = proj ? vscode.Uri.file(proj.projectFile).toString() : undefined;
        const scope = proj?.projectDir ? classifyScope(proj.projectDir, document.uri.fsPath) : undefined;
        return {
            documentUri: document.uri.toString(),
            projectFileUri,
            scope,
        };
    }
}
