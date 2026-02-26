import * as vscode from 'vscode';
import type { PbProjectFilesApi } from './api';
import { PbpReadonlyEditorProvider } from './editors/pbp-editor';
import { ProjectService } from './services/project-service';

let projectService: ProjectService | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<PbProjectFilesApi> {
    projectService = new ProjectService(context);
    context.subscriptions.push(projectService);
    context.subscriptions.push(PbpReadonlyEditorProvider.register(context));

    context.subscriptions.push(
        vscode.commands.registerCommand('pbProjectFiles.refresh', async () => {
            await projectService?.refresh();
        }),
        vscode.commands.registerCommand('pbProjectFiles.pickProject', async () => {
            await projectService?.pickActiveProject();
        }),
        vscode.commands.registerCommand('pbProjectFiles.pickTarget', async () => {
            await projectService?.pickActiveTarget();
        })
    );

    await projectService.initialize();

    return projectService.getApi();
}

export function deactivate(): void {
    projectService?.dispose();
    projectService = undefined;
}
