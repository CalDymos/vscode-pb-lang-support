import * as vscode from 'vscode';
import type { PbProjectFilesApi } from './api';
import { PbpEditorProvider } from './editors/pbp-editor';
import { ProjectService } from './services/project-service';

let projectService: ProjectService | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<PbProjectFilesApi> {
    projectService = new ProjectService(context);
    context.subscriptions.push(projectService);
    context.subscriptions.push(PbpEditorProvider.register(context));

    context.subscriptions.push(
        vscode.commands.registerCommand('pbProjectFiles.refresh', async () => {
            await projectService?.refresh();
        }),
        vscode.commands.registerCommand('pbProjectFiles.projectMenu', async () => {
            await projectService?.showProjectMenu();
        }),
        vscode.commands.registerCommand('pbProjectFiles.pickProject', async () => {
            await projectService?.pickActiveProject();
        }),
        vscode.commands.registerCommand('pbProjectFiles.pickTarget', async () => {
            await projectService?.pickActiveTarget();
        }),
        vscode.commands.registerCommand('pbProjectFiles.newProject', async () => {
            await projectService?.createNewProject();
        }),
        vscode.commands.registerCommand('pbProjectFiles.openActiveProject', async () => {
            await projectService?.openActiveProject();
        }),
        vscode.commands.registerCommand('pbProjectFiles.revealActiveProjectDirectory', async () => {
            await projectService?.revealActiveProjectDirectory();
        }),
        vscode.commands.registerCommand('pbProjectFiles.openActiveProjectAndRevealDirectory', async () => {
            await projectService?.openActiveProjectAndRevealDirectory();
        })
    );

    await projectService.initialize();

    return projectService.getApi();
}

export function deactivate(): void {
    projectService?.dispose();
    projectService = undefined;
}
