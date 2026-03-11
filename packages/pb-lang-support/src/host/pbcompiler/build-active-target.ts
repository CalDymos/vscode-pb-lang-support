/**
 * PureBasic: Build Active Target
 *
 * Host-side command that compiles the active .pbp target (if available) or
 * uses the fallback context. It spawns pbcompiler directly.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { FallbackResolver } from '../fallback-resolver';
import { resolveUnifiedContext, type PbProjectFilesApi } from '../unified-context';

import { buildPbCompilerArgs } from './pbcompiler-args';
import { runPbCompiler } from './pbcompiler-runner';
import { CompilerLauncher } from '../../debug/compiler/CompilerLauncher';
import { readHostSettings } from '../config/settings';
import { LANGUAGE_ID } from '../../shared/constants';

export interface BuildActiveTargetDeps {
    projectFilesApi?: PbProjectFilesApi;
    outputChannel: vscode.OutputChannel;
}

export async function buildActiveTarget(deps: BuildActiveTargetDeps): Promise<boolean> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.scheme !== 'file') {
        void vscode.window.showWarningMessage('No file-backed editor is active.');
        return false;
    }

    const fallbackResolver = new FallbackResolver();
    const uctx = await resolveUnifiedContext({
        api: deps.projectFilesApi,
        fallbackResolver,
        activeDocument: editor.document,
    });

    if (!uctx) {
        void vscode.window.showWarningMessage('No active PureBasic file found.');
        return false;
    }


    // In fallback mode the active document is used directly as inputFile.
    // Reject non-PureBasic files so pbcompiler is never fed arbitrary input.
    // (In pbp mode the inputFile comes from the project, so this check is not needed.)
    if (uctx.mode === 'fallback' && editor.document.languageId !== LANGUAGE_ID) {
        void vscode.window.showWarningMessage(
            'Build Active Target requires an active PureBasic (.pb / .pbi) file.');
        return false;
    }

    const compiler = await resolveCompilerPath();
    if (!compiler) {
        void vscode.window.showErrorMessage('PureBasic compiler not found. Configure purebasic.build.compiler or add pbcompiler to PATH.');
        return false;
    }

    // Build (Create executable / Build Target) does not use the target "Current directory".
    // Use projectDir (if available) or the source file directory for deterministic relative path resolution.
    const compileCwd = uctx.projectDir || (uctx.inputFile ? path.dirname(uctx.inputFile) : '');
    if (!compileCwd) {
        void vscode.window.showErrorMessage('Missing compilation working directory.');
        return false;
    }

    const mapped = buildPbCompilerArgs(uctx, {
        platform: process.platform,
        purpose: 'build',
    });

    if (mapped.args.length === 0) {
        void vscode.window.showErrorMessage(mapped.warnings[0] ?? 'Failed to build pbcompiler arguments.');
        return false;
    }

    // For "Build Target" semantics, we require an explicit output path.
    if (!mapped.outputFile) {
        void vscode.window.showErrorMessage(
            'No output file configured. In project mode set the target output file; in fallback mode provide an executable in the selected fallback source.',
        );
        return false;
    }

    deps.outputChannel.clear();
    deps.outputChannel.show(true);

    if (mapped.warnings.length > 0) {
        deps.outputChannel.appendLine('Warnings:');
        for (const w of mapped.warnings) deps.outputChannel.appendLine(`- ${w}`);
        deps.outputChannel.appendLine('');
    }

    const title = uctx.mode === 'pbp'
        ? `PureBasic: Build Target (${uctx.targetName ?? 'active'})`
        : `PureBasic: Build (${uctx.fallbackSource ?? 'fallback'})`;
        
    try {
        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title, cancellable: false },
            async () => {
                deps.outputChannel.appendLine('--- Build ---');

                const result = await runPbCompiler({
                    compiler,
                    args: mapped.args,
                    cwd: compileCwd,
                    outputChannel: deps.outputChannel,
                });

                if (result.exitCode !== 0) {
                    throw new Error(`pbcompiler exited with code ${result.exitCode}`);
                }

                try {
                    await fs.promises.access(mapped.outputFile!);
                } catch {
                    throw new Error(`Build succeeded but output file was not found: ${mapped.outputFile}`);
                }
            },
        );

        void vscode.window.showInformationMessage(`Build succeeded: ${mapped.outputFile}`);
        return true;
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`Build failed: ${msg}`);
        return false;
    }
}

async function resolveCompilerPath(): Promise<string | null> {
    const configured = readHostSettings().build.compiler ?? '';
    if (configured) {
        return configured;
    }

    // Try auto discovery first (PATH + common locations).
    const found = await CompilerLauncher.findCompiler(process.platform);
    if (found) return found;

    // Fallback: rely on PATH (may still work even if auto discovery failed).
    return 'pbcompiler';
}