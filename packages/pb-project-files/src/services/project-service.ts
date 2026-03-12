import * as vscode from 'vscode';
import * as path from 'path';

import {
    parsePbpProjectText,
    pickTarget,
    getProjectSourceFiles,
    getProjectIncludeFiles,
    writePbpProjectText,
    type PbpProject,
    type PbpTarget,
} from '@caldymos/pb-project-core';

import type { PbFileProjectPayload, PbProjectContext, PbProjectContextPayload, PbProjectFilesApi, PbProjectSettingsPayload, ProjectScope } from '../api';
import { readProjectEditorSettings, SETTINGS_SECTION } from '../config/settings';
import {
        PBP_EDITOR_VIEW_TYPE, 
        DEFAULT_PBP_GLOB,
        DEFAULT_EXCLUDE_GLOB,
        WSKEY_ACTIVE_PROJECT,
        WSKEY_ACTIVE_TARGET,
        NO_PROJECT_SENTINEL,
        NEW_PROJECT_SENTINEL,
        PB_SOURCE_EXTENSIONS,
        PB_PROJECT_EXTENSION,
} from '../utils/constants'

import { hasAnyExtension, toDialogExtensions } from '../utils/file-utils';


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
    const proj = ctx.noProject         ? '$(circle-slash) No Project'
        : ctx.projectFile              ? path.basename(ctx.projectFile)
        : '…';
    const tgt = ctx.targetName ? `  [${ctx.targetName}]` : '';
    return `PB: ${proj}${tgt}`;
}

export class ProjectService implements vscode.Disposable {
    private readonly projects = new Map<string, PbpProject>();

    /** Maps normalized absolute fsPath -> normalized .pbp fsPath */
    private readonly fileToProject = new Map<string, string>();

    /** Cached per project (keyed by normalized .pbp fsPath) */
    private readonly projectMeta = new Map<string, { projectFiles: string[] }>();

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
            version: 3,
            getActiveContext: () => this.getActiveContext(),
            getActiveContextPayload: () => this.getActiveContextPayload(),
            getProjectForFile: (fileUri: vscode.Uri) => this.getProjectForFile(fileUri),

            readProjectFile: (projectFileUri: vscode.Uri) => this.readProjectFile(projectFileUri),
            writeProjectFileModel: (projectFileUri: vscode.Uri, project: PbpProject) => this.writeProjectFileModel(projectFileUri, project),
            writeProjectFileXml: (projectFileUri: vscode.Uri, xml: string) => this.writeProjectFileXml(projectFileUri, xml),
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
        this.activeProjectFile = persistedProject === NO_PROJECT_SENTINEL
            ? NO_PROJECT_SENTINEL
            : persistedProject ? normalizeFsPath(persistedProject) : undefined;
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
        if (this.activeProjectFile === NO_PROJECT_SENTINEL) {
            return { noProject: true };
        }
        const proj = this.activeProjectFile ? this.projects.get(this.activeProjectFile) : undefined;
        const meta = this.activeProjectFile ? this.projectMeta.get(this.activeProjectFile) : undefined;
        const target = proj ? this.getActiveTarget(proj) : undefined;
        return {
            projectFile: proj?.projectFile ?? this.activeProjectFile,
            projectDir: proj?.projectDir,
            projectName: proj?.config?.name,
            targetName: this.activeTargetName,
            projectFiles: meta?.projectFiles ?? [],
            project: proj,
            target,
        };
    }

    public getProjectForFile(fileUri: vscode.Uri): PbpProject | undefined {
        // In "No Project" mode, no file belongs to a project.
        if (this.activeProjectFile === NO_PROJECT_SENTINEL) return undefined;

        const fsPath = normalizeFsPath(fileUri.fsPath);

        // If the file is a .pbp, it is its own project key.
        if (fsPath.toLowerCase().endsWith(PB_PROJECT_EXTENSION)) {
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

        /* Preserve the previously active project if it still exists.
           If it was removed, fall back to the first available project.
           If the user explicitly selected "No Project", keep that choice
           across refreshes using the NO_PROJECT_SENTINEL.
        */
        const isNoProject = this.activeProjectFile === NO_PROJECT_SENTINEL;
        if (!isNoProject) {
            // Active project no longer exists → reset selection
            if (this.activeProjectFile && !this.projects.has(this.activeProjectFile)) {
                this.activeProjectFile = undefined;
                this.activeTargetName  = undefined;
            }

            // No active project → select the first available one
            if (!this.activeProjectFile) {
                const first = this.projects.keys().next();
                if (!first.done) {
                    this.activeProjectFile = first.value;
                    const proj = this.projects.get(first.value);
                    this.activeTargetName  = proj ? this.getActiveTarget(proj)?.name : undefined;
                }
            }
        }        

        await this.persistActiveState();

        this.updateStatusBar();
        this.emitActiveContextChanged();
    }

    public async pickActiveProject(): Promise<void> {

        const newProjectItem = {
            label:       '$(plus) New Project\u2026',
            description: 'Create a new PureBasic project file',
            projectFile: NEW_PROJECT_SENTINEL,
        };
        const noProjectItem = {
            label:       '$(circle-slash) No Project',
            description: 'Deactivate project context \u2013 use local fallback',
            projectFile: NO_PROJECT_SENTINEL,
        };
        const items = [newProjectItem, noProjectItem, ...[...this.projects.values()].map(p => ({
            label: p.config?.name?.trim() ? p.config.name : path.basename(p.projectFile),
            description: p.projectFile,
            projectFile: normalizeFsPath(p.projectFile),
        }))];

        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select active PureBasic project',
            matchOnDescription: true,
        });
        if (!picked) return;

        if (picked.projectFile === NEW_PROJECT_SENTINEL) {
            await this.createNewProject();
        } else if (picked.projectFile === NO_PROJECT_SENTINEL) {
            await this.setNoProject();
        } else {
            await this.setActiveProject(picked.projectFile);
        }
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

    public async createNewProject(): Promise<void> {
        // 1 – Pick save location
        const defaultUri = vscode.workspace.workspaceFolders?.[0]?.uri;
        let saveUri = await vscode.window.showSaveDialog({
            defaultUri,
            filters: { 'PureBasic Project': toDialogExtensions([PB_PROJECT_EXTENSION]) },
            saveLabel: 'Create Project',
            title: 'Create new PureBasic project',
        });
        if (!saveUri) return;

        // Ensure the chosen path always ends with .pbp so the glob watcher
        // (DEFAULT_PBP_GLOB = '**/*.pbp') picks it up reliably.
        if (!saveUri.fsPath.toLowerCase().endsWith(PB_PROJECT_EXTENSION)) {
            saveUri = vscode.Uri.file(saveUri.fsPath + PB_PROJECT_EXTENSION);
        }

        // 2 – Project name (default: filename without extension)
        const defaultName = path.parse(saveUri.fsPath).name;
        const projectName = await vscode.window.showInputBox({
            prompt: 'Project name',
            value: defaultName,
            validateInput: v => v.trim() ? undefined : 'Name must not be empty',
        });
        if (projectName === undefined) return;

        // 3 – Build project model (from template or minimal fallback)
        const projectDir = path.dirname(saveUri.fsPath);
        const baseModel = await this.loadProjectTemplate(saveUri.fsPath, projectDir);

        // Override identity fields regardless of template or fallback origin
        baseModel.config.name = projectName.trim();
        baseModel.projectFile = saveUri.fsPath;
        baseModel.projectDir  = projectDir;
        // Clear fields that must not carry over from a template:
        // - data: session-specific (last-open, explorer state, ...)
        // - files: rawPaths are relative to the template dir and would be
        //          broken/wrong in the new project's directory
        baseModel.data  = {};
        baseModel.files = [];

        // 4 – Serialize and write to disk
        const xml = writePbpProjectText(baseModel);
        await vscode.workspace.fs.writeFile(saveUri, Buffer.from(xml, 'utf8'));

        // 5 – The FileSystemWatcher will pick up the new file automatically.
        //     Parse and register it immediately so setActiveProject works in the
        //     same tick (watcher event may arrive slightly later on some systems).
        const parsed = await this.tryParseProject(saveUri);
        if (parsed) {
            const key = normalizeFsPath(parsed.projectFile);
            this.projects.set(key, parsed);
            this.projectMeta.set(key, this.computeProjectMeta(parsed));
            this.rebuildFileToProjectMap();
        }

        // 6 – Activate and open in editor
        await this.setActiveProject(saveUri.fsPath);
        await vscode.commands.executeCommand('vscode.openWith', saveUri, PBP_EDITOR_VIEW_TYPE);
    }

    /**
     * Tries to load and clone the user-configured template .pbp.
     * On any failure (not configured, file missing, parse error) emits a
     * warning and returns a minimal in-memory project model as fallback.
     */
    private async loadProjectTemplate(
        targetFsPath: string,
        targetDir: string,
    ): Promise<PbpProject> {
        const templatePath = readProjectEditorSettings().newProjectTemplateFile.trim();

        if (templatePath) {
            try {
                const templateUri = vscode.Uri.file(templatePath);
                const bytes = await vscode.workspace.fs.readFile(templateUri);
                const xml   = Buffer.from(bytes).toString('utf8');
                // Deep-clone via JSON round-trip so we never mutate the cache
                const parsed = parsePbpProjectText(xml, templateUri.fsPath);
                if (!parsed) {
                    throw new Error('Invalid template');
                }
                return JSON.parse(JSON.stringify(parsed)) as PbpProject;
            } catch {
                const openSettings = 'Open Settings';
                void vscode.window.showWarningMessage(
                    `New project template not found or invalid: "${templatePath}". Falling back to empty project.`,
                    openSettings,
                ).then(choice => {
                    if (choice === openSettings) {
                        void vscode.commands.executeCommand(
                            'workbench.action.openSettings',
                            `${SETTINGS_SECTION}.newProject.templateFile`,
                        );
                    }
                });
            }
        }

        // Minimal fallback model
        const defaultTarget: PbpTarget = {
            name: 'Default',
            enabled: true,
            isDefault: true,
            inputFile:  { rawPath: '', fsPath: '' },
            outputFile: { rawPath: '', fsPath: '' },
            executable: { rawPath: '', fsPath: '' },
            directory: '',
            options: {},
            constants: [],
        };
        return {
            projectFile: targetFsPath,
            projectDir:  targetDir,
            config: {
                name:       '',
                comment:    '',
                closefiles: false,
                openmode:   1,
            },
            data:      {},
            files:     [],
            libraries: [],
            targets:   [defaultTarget],
            meta: {
                presentSections: { config: true, targets: true },
                sectionOrder:    ['config', 'targets'],
            },
        };
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

    private async setNoProject(): Promise<void> {
        this.activeProjectFile = NO_PROJECT_SENTINEL;
        this.activeTargetName  = undefined;
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

    private computeProjectMeta(project: PbpProject): { projectFiles: string[] } {

        const src = (getProjectSourceFiles(project) ?? [])
            .filter((p): p is string => typeof p === 'string' && p.trim().length > 0);
        const inc = (getProjectIncludeFiles(project) ?? [])
            .filter((p): p is string => typeof p === 'string' && p.trim().length > 0);

        const projectFiles = [...new Set([...src, ...inc])]
            .filter((p) => hasAnyExtension(p, PB_SOURCE_EXTENSIONS))
            .map((p) => path.resolve(p));

        return { projectFiles };
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
        if (this.activeProjectFile === NO_PROJECT_SENTINEL) return;

        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const uri = editor.document.uri;
        if (uri.scheme !== 'file') return;

        // If the file is the project file itself.
        if (uri.fsPath.toLowerCase().endsWith(PB_PROJECT_EXTENSION)) {
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

    public async readProjectFile(projectFileUri: vscode.Uri): Promise<PbProjectSettingsPayload> {
        const bytes = await vscode.workspace.fs.readFile(projectFileUri);
        const xml = Buffer.from(bytes).toString('utf8');
        const project = parsePbpProjectText(xml, projectFileUri.fsPath);
        return { projectFile: projectFileUri.fsPath, xml, project };
    }

    public async writeProjectFileModel(projectFileUri: vscode.Uri, project: PbpProject): Promise<void> {
        const xml = writePbpProjectText(project);
        await this.writeProjectFileXml(projectFileUri, xml);
    }

    public async writeProjectFileXml(projectFileUri: vscode.Uri, xml: string): Promise<void> {
        await vscode.workspace.fs.writeFile(projectFileUri, Buffer.from(xml, 'utf8'));
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