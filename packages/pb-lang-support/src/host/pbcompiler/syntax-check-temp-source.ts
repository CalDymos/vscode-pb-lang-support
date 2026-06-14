/**
 * Temporary source handling for PureBasic syntax checks.
 *
 * The PureBasic IDE compiles a temporary PB_EditorOutput.pb file and maps
 * compiler diagnostics back to the original file with SOURCEALIAS. This module
 * mirrors that behavior for the compiler SOURCE file and prefers open VS Code
 * document text so dirty editor buffers are checked without forcing a save.
 */

import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import type { UnifiedContext } from '../unified-context';

export interface SyntaxCheckTempSourceResult {
    context: UnifiedContext;
    tempFile?: string;
    cleanup: () => Promise<void>;
    warnings: string[];
}

interface TempSourcePayload {
    data: Uint8Array;
    source: 'openDocument' | 'workspaceFile';
}

const TEMP_SOURCE_FILE_NAME = 'PB_EditorOutput.pb';

/**
 * Creates an IDE-like temporary compiler source for the resolved SOURCE file.
 */
export async function prepareSyntaxCheckTempSource(
    context: UnifiedContext,
): Promise<SyntaxCheckTempSourceResult> {
    const inputFile = (context.inputFile ?? '').trim();
    if (!inputFile) {
        return emptyTempSourceResult(context, ['Temporary source was not created because the input file is missing.']);
    }

    const payload = await readTempSourcePayload(inputFile);
    if (!payload) {
        return emptyTempSourceResult(context, [`Temporary source could not be created; using original source file: ${inputFile}`]);
    }

    const tempDir = makeTempSourceDirectory(inputFile);
    const tempFile = path.join(tempDir, TEMP_SOURCE_FILE_NAME);

    try {
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(tempDir));
        await vscode.workspace.fs.writeFile(vscode.Uri.file(tempFile), payload.data);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return emptyTempSourceResult(context, [`Temporary source could not be written; using original source file: ${message}`]);
    }

    const tempContext: UnifiedContext = {
        ...context,
        inputFile: tempFile,
        sourceAlias: inputFile,
    };

    const warnings = payload.source === 'openDocument'
        ? [`Temporary source created from open editor buffer: ${tempFile}`]
        : [`Temporary source created from saved source file: ${tempFile}`];

    return {
        context: tempContext,
        tempFile,
        warnings,
        cleanup: async () => {
            await deleteTempSourceDirectory(tempDir);
        },
    };
}

async function readTempSourcePayload(inputFile: string): Promise<TempSourcePayload | null> {
    const openDocument = findOpenFileDocument(inputFile);
    if (openDocument) {
        return {
            data: Buffer.from(openDocument.getText(), 'utf8'),
            source: 'openDocument',
        };
    }

    try {
        const data = await vscode.workspace.fs.readFile(vscode.Uri.file(inputFile));
        return { data, source: 'workspaceFile' };
    } catch {
        return null;
    }
}

function findOpenFileDocument(filePath: string): vscode.TextDocument | undefined {
    const normalized = normalizeFilePath(filePath);
    return vscode.workspace.textDocuments.find((document) => (
        document.uri.scheme === 'file'
        && normalizeFilePath(document.uri.fsPath) === normalized
    ));
}

function makeTempSourceDirectory(inputFile: string): string {
    const digest = crypto
        .createHash('sha1')
        .update(`${inputFile}\0${Date.now()}\0${process.hrtime.bigint()}`)
        .digest('hex')
        .slice(0, 16);

    return path.join(os.tmpdir(), 'vscode-pb-lang-support', `syntax-check-${digest}`);
}

async function deleteTempSourceDirectory(tempDir: string): Promise<void> {
    try {
        await vscode.workspace.fs.delete(vscode.Uri.file(tempDir), { recursive: true, useTrash: false });
    } catch {
        // Temporary cleanup failures should not hide the compiler result.
    }
}

function emptyTempSourceResult(context: UnifiedContext, warnings: string[]): SyntaxCheckTempSourceResult {
    return {
        context,
        warnings,
        cleanup: async () => undefined,
    };
}

function normalizeFilePath(filePath: string): string {
    const normalized = path.resolve(filePath);
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}
