/**
 * PureBasic: Syntax Check
 *
 * Host-side command that checks the active .pbp target through the PureBasic
 * compiler standby protocol. When no .pbp project is active, the command uses
 * the current file-backed PureBasic document as fallback input.
 */

import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import { FallbackResolver } from '../fallback-resolver';
import { resolveUnifiedContext, type PbProjectFilesApi, type UnifiedContext } from '../unified-context';
import { LANGUAGE_ID } from '../../shared/constants';

import { resolvePbCompilerPath } from './compiler-path';
import { prepareSyntaxCheckTempSource } from './syntax-check-temp-source';
import { buildSyntaxCheckStandbyCommands } from './standby/compiler-standby-command-builder';
import { buildCompilerStandbyDiagnostics, type CompilerStandbyDiagnostic } from './standby/compiler-standby-diagnostics';
import { CompilerStandbySession, type CompilerStandbyRunResult } from './standby/compiler-standby-session';
import type {
    CompilerStandbyCompilerError,
    CompilerStandbySyntaxError,
    CompilerStandbyWarning,
} from './standby/compiler-standby-types';

export interface SyntaxCheckActiveTargetDeps {
    projectFilesApi?: PbProjectFilesApi;
    outputChannel: vscode.OutputChannel;
    diagnosticCollection: vscode.DiagnosticCollection;
}

interface SyntaxCheckResolvedInput {
    context: UnifiedContext;
    compileCwd: string;
    targetFile: string;
    sourceAlias?: string;
    title: string;
}

/**
 * Runs the PureBasic compiler syntax check for the active project target or
 * the current standalone source file.
 */
export async function syntaxCheckActiveTarget(deps: SyntaxCheckActiveTargetDeps): Promise<boolean> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.scheme !== 'file') {
        void vscode.window.showWarningMessage('No file-backed editor is active.');
        return false;
    }

    deps.diagnosticCollection.clear();

    const fallbackResolver = new FallbackResolver();
    const context = await resolveUnifiedContext({
        api: deps.projectFilesApi,
        fallbackResolver,
        activeDocument: editor.document,
    });

    if (!context) {
        void vscode.window.showWarningMessage('No active PureBasic file found.');
        return false;
    }

    if (context.mode === 'fallback' && editor.document.languageId !== LANGUAGE_ID) {
        void vscode.window.showWarningMessage('Syntax Check requires an active PureBasic (.pb / .pbi) file.');
        return false;
    }

    const tempSource = await prepareSyntaxCheckTempSource(context);

    try {
        const resolved = resolveSyntaxCheckInput(tempSource.context);
        if (!resolved) {
            void vscode.window.showErrorMessage('Syntax Check failed: missing source file or working directory.');
            return false;
        }

        const compiler = await resolvePbCompilerPath();
        if (!compiler) {
            void vscode.window.showErrorMessage('PureBasic compiler not found. Configure purebasic.build.compiler or add pbcompiler to PATH.');
            return false;
        }

        const commandBuild = buildSyntaxCheckStandbyCommands(resolved.context, {
            platform: process.platform,
            targetFile: resolved.targetFile,
            sourceAlias: resolved.sourceAlias,
        });

        if (commandBuild.commands.length === 0) {
            void vscode.window.showErrorMessage(commandBuild.warnings[0] ?? 'Failed to build compiler standby commands.');
            return false;
        }

        deps.outputChannel.clear();
        deps.outputChannel.show(true);
        writeSyntaxCheckHeader(deps.outputChannel, resolved, compiler, [
            ...(context.fallbackWarnings ?? []),
            ...tempSource.warnings,
            ...commandBuild.warnings,
        ]);

        const runResult = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: resolved.title, cancellable: false },
            async () => {
                const session = new CompilerStandbySession({
                    compiler,
                    cwd: resolved.compileCwd,
                    platform: process.platform,
                    outputChannel: deps.outputChannel,
                });

                try {
                    return await session.run(commandBuild.commands);
                } finally {
                    await session.dispose();
                }
            },
        );

        const diagnostics = buildCompilerStandbyDiagnostics(runResult.parseResult, {
            sourceFile: resolved.context.inputFile ?? '',
            sourceAlias: resolved.sourceAlias,
            projectDir: resolved.context.projectDir,
        });
        applySyntaxCheckDiagnostics(deps.diagnosticCollection, diagnostics);

        const success = writeSyntaxCheckResult(deps.outputChannel, runResult);
        if (success) {
            if (diagnostics.some((diagnostic) => diagnostic.severity === 'warning')) {
                void vscode.window.showInformationMessage('PureBasic syntax check succeeded with warnings.');
            } else {
                void vscode.window.showInformationMessage('PureBasic syntax check succeeded.');
            }
        } else {
            await revealFirstSyntaxCheckError(diagnostics, deps.outputChannel);
            void vscode.window.showErrorMessage('PureBasic syntax check failed. See Output: PureBasic (Syntax Check) for details.');
        }
        return success;
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        deps.diagnosticCollection.clear();
        deps.outputChannel.appendLine('');
        deps.outputChannel.appendLine(`Syntax check failed: ${msg}`);
        void vscode.window.showErrorMessage(`Syntax check failed: ${msg}`);
        return false;
    } finally {
        await tempSource.cleanup();
    }
}

function resolveSyntaxCheckInput(context: UnifiedContext): SyntaxCheckResolvedInput | null {
    const inputFile = (context.inputFile ?? '').trim();
    if (!inputFile) return null;

    const compileCwd = (context.projectDir ?? '').trim() || (context.workingDir ?? '').trim() || path.dirname(inputFile);
    if (!compileCwd) return null;

    const targetFile = makeSyntaxCheckTargetFile(inputFile);
    const title = context.mode === 'pbp'
        ? `PureBasic: Syntax Check (${context.targetName ?? 'active target'})`
        : `PureBasic: Syntax Check (${context.fallbackSource ?? 'fallback'})`;

    return { context, compileCwd, targetFile, sourceAlias: context.sourceAlias, title };
}

function makeSyntaxCheckTargetFile(sourceFile: string): string {
    const baseName = path.basename(sourceFile, path.extname(sourceFile)).replace(/[^a-zA-Z0-9_-]/g, '_') || 'source';
    const digest = crypto.createHash('sha1').update(`${sourceFile}\0${Date.now()}\0${process.hrtime.bigint()}`).digest('hex').slice(0, 10);
    const suffix = process.platform === 'win32' ? '.exe' : '';
    return path.join(os.tmpdir(), `pb_syntax_check_${baseName}_${digest}${suffix}`);
}

function writeSyntaxCheckHeader(
    outputChannel: vscode.OutputChannel,
    resolved: SyntaxCheckResolvedInput,
    compiler: string,
    warnings: readonly string[],
): void {
    const context = resolved.context;
    outputChannel.appendLine('--- Syntax Check ---');
    outputChannel.appendLine(`mode:       ${context.mode}`);
    if (context.mode === 'pbp') {
        outputChannel.appendLine(`project:    ${context.projectFile ?? '(unknown)'}`);
        outputChannel.appendLine(`target:     ${context.targetName ?? '(active)'}`);
    } else {
        outputChannel.appendLine(`fallback:   ${context.fallbackSource ?? '(default)'}`);
        if (context.fallbackMainFile) {
            outputChannel.appendLine(`main file:  ${context.fallbackMainFile}`);
        }
    }
    outputChannel.appendLine(`compiler:   ${compiler}`);
    outputChannel.appendLine(`cwd:        ${resolved.compileCwd}`);
    outputChannel.appendLine(`source:     ${context.inputFile ?? '(missing)'}`);
    if (resolved.sourceAlias) {
        outputChannel.appendLine(`alias:      ${resolved.sourceAlias}`);
    }
    outputChannel.appendLine(`target:     ${resolved.targetFile}`);

    if (warnings.length > 0) {
        outputChannel.appendLine('');
        outputChannel.appendLine('Command warnings:');
        for (const warning of warnings) {
            outputChannel.appendLine(`- ${warning}`);
        }
    }

    outputChannel.appendLine('');
}

function writeSyntaxCheckResult(outputChannel: vscode.OutputChannel, result: CompilerStandbyRunResult): boolean {
    outputChannel.appendLine('');
    outputChannel.appendLine('--- Parsed Result ---');
    writeWarnings(outputChannel, result.parseResult.warnings);

    const terminal = result.parseResult.terminal;
    if (!terminal) {
        outputChannel.appendLine('No terminal compiler response was received.');
        return false;
    }

    switch (terminal.kind) {
        case 'success':
            outputChannel.appendLine('Result: success');
            return true;
        case 'syntaxError':
            writeSyntaxError(outputChannel, terminal);
            return false;
        case 'compilerError':
            writeCompilerError(outputChannel, terminal);
            return false;
        default:
            return assertNever(terminal);
    }
}

function writeWarnings(outputChannel: vscode.OutputChannel, warnings: readonly CompilerStandbyWarning[]): void {
    if (warnings.length === 0) {
        outputChannel.appendLine('Warnings: none');
        return;
    }

    outputChannel.appendLine(`Warnings: ${warnings.length}`);
    for (const warning of warnings) {
        const location = formatLocation(warning.location.file, warning.location.line);
        outputChannel.appendLine(`- ${location}${warning.message}`);
    }
}

function writeSyntaxError(outputChannel: vscode.OutputChannel, error: CompilerStandbySyntaxError): void {
    const includeLocation = error.includeLocation
        ? formatLocation(error.includeLocation.file, error.includeLocation.line)
        : '';
    const sourceLocation = formatLocation(undefined, error.line);

    outputChannel.appendLine('Result: syntax error');
    outputChannel.appendLine(`Location: ${includeLocation || sourceLocation || '(unknown)'}`);
    outputChannel.appendLine(`Message:  ${error.message || '(no message)'}`);

    if (error.macro) {
        outputChannel.appendLine('Macro expansion:');
        for (const line of error.macro.lines) {
            outputChannel.appendLine(`  ${line}`);
        }
    }
}

function writeCompilerError(outputChannel: vscode.OutputChannel, error: CompilerStandbyCompilerError): void {
    outputChannel.appendLine(`Result: compiler error (${error.errorType})`);
    outputChannel.appendLine(`Message: ${error.message || '(no message)'}`);
    for (const detail of error.details) {
        outputChannel.appendLine(`Detail:  ${detail}`);
    }
}

function applySyntaxCheckDiagnostics(
    diagnosticCollection: vscode.DiagnosticCollection,
    diagnostics: readonly CompilerStandbyDiagnostic[],
): void {
    diagnosticCollection.clear();

    const byFile = new Map<string, vscode.Diagnostic[]>();
    for (const diagnostic of diagnostics) {
        const uri = vscode.Uri.file(diagnostic.file);
        const key = uri.toString();
        const range = new vscode.Range(
            new vscode.Position(Math.max(0, diagnostic.line), 0),
            new vscode.Position(Math.max(0, diagnostic.line), 0),
        );
        const vscodeDiagnostic = new vscode.Diagnostic(
            range,
            diagnostic.message,
            diagnostic.severity === 'error'
                ? vscode.DiagnosticSeverity.Error
                : vscode.DiagnosticSeverity.Warning,
        );
        vscodeDiagnostic.source = diagnostic.source;

        const fileDiagnostics = byFile.get(key) ?? [];
        fileDiagnostics.push(vscodeDiagnostic);
        byFile.set(key, fileDiagnostics);
    }

    for (const [uriString, fileDiagnostics] of byFile) {
        diagnosticCollection.set(vscode.Uri.parse(uriString), fileDiagnostics);
    }
}

async function revealFirstSyntaxCheckError(
    diagnostics: readonly CompilerStandbyDiagnostic[],
    outputChannel: vscode.OutputChannel,
): Promise<void> {
    const firstError = diagnostics.find((diagnostic) => diagnostic.severity === 'error');
    if (!firstError) return;

    try {
        const uri = vscode.Uri.file(firstError.file);
        const document = await vscode.workspace.openTextDocument(uri);
        const line = clampLine(firstError.line, document.lineCount);
        const lineRange = document.lineAt(line).range;
        const editor = await vscode.window.showTextDocument(document, { preview: false });
        editor.selection = new vscode.Selection(lineRange.start, lineRange.start);
        editor.revealRange(lineRange, vscode.TextEditorRevealType.InCenter);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`Failed to reveal syntax check diagnostic: ${message}`);
    }
}

function clampLine(line: number, lineCount: number): number {
    if (!Number.isFinite(line) || line <= 0) return 0;
    return Math.min(line, Math.max(0, lineCount - 1));
}

function formatLocation(file: string | undefined, line: number | undefined): string {
    const hasFile = !!file;
    const hasLine = typeof line === 'number' && Number.isFinite(line) && line >= 0;

    if (!hasFile && !hasLine) return '';
    if (hasFile && hasLine) return `${file}:${line}: `;
    if (hasFile) return `${file}: `;
    return `line ${line}: `;
}

function assertNever(value: never): never {
    throw new Error(`Unhandled compiler standby terminal result: ${String((value as { kind?: string }).kind)}`);
}
