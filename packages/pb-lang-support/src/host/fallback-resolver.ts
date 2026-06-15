/**
 * pb-lang-support – FallbackResolver
 *
 * Provides build context when no .pbp project is active.
 * Configurable via purebasic.build.fallbackSource.
 */
import * as vscode from 'vscode';
import * as path   from 'path';
import { parse } from 'jsonc-parser';
import type { PbpTarget } from '@caldymos/pb-project-core';
import {
    extractExecutable,
    extractUseMainFile,
    isMetadataDebuggerEnabled,
    metadataToFallbackTarget,
    parseCfgFile,
    parseProjectCfg,
    splitPbFile,
    type PbFileMetadata,
} from './utils/pb-metadata';
import { readHostSettings, SETTINGS_SECTION } from './config/settings';

export type FallbackSource =
    | 'sourceMetadata'   // PureBasic IDE comments at end of file
    | 'launchJson'       // .vscode/launch.json
    | 'fileCfg'          // <filename>.pb.cfg next to source file
    | 'projectCfg';      // project.cfg – walk up directory tree

export interface FallbackBuildContext {
    source:       FallbackSource;
    projectFiles: string[];
    /** Source file that should be passed to the compiler. This can be a resolved MainFile. */
    inputFile?: string;
    /** Original source file used when a temporary source is introduced later. */
    sourceAlias?: string;
    /** Compilation working directory. */
    workingDir?: string;
    /** Path to output file (compiler output), if available. */
    outputFile?:  string;
    /** PureBasic IDE MainFile resolved from metadata, if active. */
    mainFile?: string;
    /** Target-like compiler options extracted from PureBasic IDE metadata. */
    compilerTarget?: PbpTarget;
    /** Non-fatal fallback resolution warnings. */
    warnings?: string[];
}

interface FallbackMetadataReadResult {
    metadata: PbFileMetadata;
    baseDir: string;
}

// ---------------------------------------------------------------------------

export class FallbackResolver {

    public async resolve(documentUri: vscode.Uri): Promise<FallbackBuildContext | null> {
        const src = this.configuredSource();
        switch (src) {
            case 'sourceMetadata': return this.fromSourceMetadata(documentUri);
            case 'launchJson':     return this.fromLaunchJson(documentUri);
            case 'fileCfg':        return this.fromFileCfg(documentUri);
            case 'projectCfg':     return this.fromProjectCfg(documentUri);
        }
    }

    // -----------------------------------------------------------------------
    // sourceMetadata
    // PureBasic IDE writes build parameters as comments at end of file:
    //   ; Executable = output\MyApp.exe
    //   ; UseMainFile = main.pb
    // -----------------------------------------------------------------------
    private async fromSourceMetadata(uri: vscode.Uri): Promise<FallbackBuildContext | null> {
        const active = await this.readSourceMetadata(uri.fsPath);
        if (!active) return null;

        return this.fromMetadata(uri, 'sourceMetadata', active, (filePath) => this.readSourceMetadata(filePath));
    }

    // -----------------------------------------------------------------------
    // launchJson  (.vscode/launch.json)
    // Reads the contributed purebasic debug configuration schema fields:
    //  "program": "${file}",  "output": ""
    // -----------------------------------------------------------------------
    private async fromLaunchJson(uri: vscode.Uri): Promise<FallbackBuildContext | null> {
        const wsFolder = vscode.workspace.getWorkspaceFolder(uri)
            ?? vscode.workspace.workspaceFolders?.[0];
        if (!wsFolder) return null;

        const launchUri = vscode.Uri.joinPath(wsFolder.uri, '.vscode', 'launch.json');
        try {
            const bytes = await vscode.workspace.fs.readFile(launchUri);
            // launch.json may contain comments (jsonc)
            const text = Buffer.from(bytes).toString('utf8');
            const json = parse(text) as { configurations?: unknown[] };
            const cfgs  = json.configurations ?? [];

            // Only use a purebasic-typed configuration – never fall back to an unrelated entry.
            const cfg = cfgs.find((c: any) => c.type === SETTINGS_SECTION) as any | undefined;
            if (!cfg) return null;

            const base = wsFolder.uri.fsPath;
            const warnings: string[] = [];
            const program = typeof cfg.program === 'string' && cfg.program.trim()
                ? await this.resolveLaunchProgram(base, uri.fsPath, cfg.program.trim(), warnings)
                : uri.fsPath;
            const outputFile = typeof cfg.output === 'string' && cfg.output.trim()
                ? this.expandLaunchPath(base, uri.fsPath, cfg.output.trim())
                : undefined;

            return {
                source: 'launchJson',
                projectFiles: [],
                inputFile: program,
                workingDir: path.dirname(program),
                outputFile,
                warnings,
            };
        } catch {
            return null;
        }
    }

    // -----------------------------------------------------------------------
    // fileCfg  (<file>.pb.cfg)
    // -----------------------------------------------------------------------
    private async fromFileCfg(uri: vscode.Uri): Promise<FallbackBuildContext | null> {
        const active = await this.readFileCfgMetadata(uri.fsPath);
        if (!active) return null;

        return this.fromMetadata(uri, 'fileCfg', active, (filePath) => this.readFileCfgMetadata(filePath));
    }

    // -----------------------------------------------------------------------
    // projectCfg  (project.cfg – walk up directory tree to workspace root)
    // -----------------------------------------------------------------------
    private async fromProjectCfg(uri: vscode.Uri): Promise<FallbackBuildContext | null> {
        const active = await this.readProjectCfgMetadata(uri.fsPath);
        if (!active) return null;

        return this.fromMetadata(uri, 'projectCfg', active, (filePath) => this.readProjectCfgMetadata(filePath));
    }

    // -----------------------------------------------------------------------

    private async fromMetadata(
        uri: vscode.Uri,
        source: FallbackSource,
        active: FallbackMetadataReadResult,
        readMainMetadata: (filePath: string) => Promise<FallbackMetadataReadResult | null>,
    ): Promise<FallbackBuildContext> {
        const activeFile = uri.fsPath;
        const activeBaseDir = path.dirname(activeFile);
        const mainFile = extractUseMainFile(active.metadata, activeBaseDir);
        const inputFile = mainFile ?? activeFile;
        const warnings: string[] = [];

        let targetMetadata = active.metadata;
        let targetBaseDir = active.baseDir;

        if (mainFile) {
            const mainMetadata = await readMainMetadata(mainFile);
            if (mainMetadata) {
                targetMetadata = mainMetadata.metadata;
                targetBaseDir = mainMetadata.baseDir;
            } else {
                warnings.push(`MainFile metadata could not be read; using active file metadata for compiler options: ${mainFile}`);
                targetBaseDir = path.dirname(mainFile);
            }
        }

        const compilerTarget = metadataToFallbackTarget(targetMetadata, inputFile, targetBaseDir, {
            debuggerEnabled: mainFile ? isMetadataDebuggerEnabled(active.metadata) : undefined,
        });
        const outputFile = compilerTarget.outputFile.fsPath || extractExecutable(targetMetadata, targetBaseDir);

        return {
            source,
            projectFiles: [],
            inputFile,
            workingDir: path.dirname(inputFile),
            outputFile,
            mainFile,
            compilerTarget,
            warnings,
        };
    }

    private async readSourceMetadata(filePath: string): Promise<FallbackMetadataReadResult | null> {
        try {
            const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
            const { metadata } = splitPbFile(Buffer.from(bytes).toString('utf8'));
            if (!metadata) return null;

            return { metadata, baseDir: path.dirname(filePath) };
        } catch {
            return null;
        }
    }

    private async readFileCfgMetadata(filePath: string): Promise<FallbackMetadataReadResult | null> {
        const cfgPath = `${filePath}.cfg`;
        try {
            const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(cfgPath));
            const metadata = parseCfgFile(Buffer.from(bytes).toString('utf8'));
            if (!metadata) return null;

            return { metadata, baseDir: path.dirname(filePath) };
        } catch {
            return null;
        }
    }

    private async readProjectCfgMetadata(filePath: string): Promise<FallbackMetadataReadResult | null> {
        const wsFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
        const stopAt = wsFolder?.uri.fsPath ?? path.parse(filePath).root;
        const fileName = path.basename(filePath);

        let dir = path.dirname(filePath);
        while (true) {
            const cfgPath = path.join(dir, 'project.cfg');
            try {
                const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(cfgPath));
                const metadata = parseProjectCfg(Buffer.from(bytes).toString('utf8'), fileName);
                if (metadata) {
                    return { metadata, baseDir: dir };
                }
            } catch {
                // File not present; continue with the next parent directory.
            }

            if (dir === stopAt || dir === path.dirname(dir)) break;
            dir = path.dirname(dir);
        }
        return null;
    }

    private configuredSource(): FallbackSource {
        return readHostSettings().build.fallbackSource;
    }

    private async resolveLaunchProgram(
        base: string,
        activeFile: string,
        value: string,
        warnings: string[],
    ): Promise<string> {
        const program = this.expandLaunchPath(base, activeFile, value);
        if (await this.isExistingFile(program)) {
            return program;
        }

        warnings.push(`launch.json program does not point to an existing file; using active file instead: ${value}`);
        return activeFile;
    }

    private expandLaunchPath(base: string, activeFile: string, value: string): string {
        const expanded = value
            .replace(/\$\{file\}/g, activeFile)
            .replace(/\$\{workspaceFolder\}/g, base);
        return this.abs(base, this.unwrapLaunchPath(expanded));
    }

    private unwrapLaunchPath(value: string): string {
        let normalized = value.trim();

        if (normalized.startsWith('^')) {
            normalized = normalized.slice(1).trimStart();
        }

        if (normalized.length >= 2 && normalized.startsWith('"') && normalized.endsWith('"')) {
            normalized = normalized.slice(1, -1);
        }

        return normalized;
    }

    private async isExistingFile(filePath: string): Promise<boolean> {
        try {
            const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
            return (stat.type & vscode.FileType.Directory) === 0;
        } catch {
            return false;
        }
    }

    private abs(base: string, p: string): string {
        const resolved = path.isAbsolute(p) ? p : path.resolve(base, p);
        return path.normalize(resolved);
    }
}
