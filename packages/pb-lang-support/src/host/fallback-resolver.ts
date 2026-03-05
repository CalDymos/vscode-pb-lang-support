/**
 * pb-lang-support – FallbackResolver
 *
 * Provides build context when no .pbp project is active.
 * Configurable via purebasic.build.fallbackSource.
 */
import * as vscode from 'vscode';
import * as path   from 'path';
import { splitPbFile, parseCfgFile, parseProjectCfg, extractExecutable } from './utils/pb-metadata';

export type FallbackSource =
    | 'sourceMetadata'   // PureBasic IDE comments at end of file
    | 'launchJson'       // .vscode/launch.json
    | 'fileCfg'          // <filename>.pb.cfg next to source file
    | 'projectCfg';      // project.cfg – walk up directory tree

export interface FallbackBuildContext {
    source:       FallbackSource;
    projectFiles: string[];
    /** Path to output file (compiler output), if available. */
    outputFile?:  string;
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
    // -----------------------------------------------------------------------
    private async fromSourceMetadata(uri: vscode.Uri): Promise<FallbackBuildContext | null> {
        try {
            const bytes = await vscode.workspace.fs.readFile(uri);
            const { metadata } = splitPbFile(Buffer.from(bytes).toString('utf8'));
            if (!metadata) return null;

            const base = path.dirname(uri.fsPath);
            return {
                source:       'sourceMetadata',
                projectFiles: [],
                outputFile:   extractExecutable(metadata, base),
            };
        } catch { return null; }
    }

    // -----------------------------------------------------------------------
    // launchJson  (.vscode/launch.json)
    // Expects optional fields in the purebasic configuration:
    //  "projectFiles": [],  "executable": ""
    // -----------------------------------------------------------------------
    private async fromLaunchJson(uri: vscode.Uri): Promise<FallbackBuildContext | null> {
        const wsFolder = vscode.workspace.getWorkspaceFolder(uri)
            ?? vscode.workspace.workspaceFolders?.[0];
        if (!wsFolder) return null;

        const launchUri = vscode.Uri.joinPath(wsFolder.uri, '.vscode', 'launch.json');
        try {
            const bytes = await vscode.workspace.fs.readFile(launchUri);
            // launch.json may contain comments (jsonc)
            const text = Buffer.from(bytes).toString('utf8').replace(/\/\/[^\n]*/g, '');
            const json = JSON.parse(text) as { configurations?: unknown[] };
            const cfgs  = json.configurations ?? [];

            // Prefer first purebasic configuration
            const cfg = (cfgs.find((c: any) => c.type === 'purebasic') ?? cfgs[0]) as any;
            if (!cfg) return null;

            const base = wsFolder.uri.fsPath;
            const projectFiles = ((cfg.projectFiles ?? []) as string[]).map(f => this.abs(base, f));
            const outputFile   = cfg.executable ? this.abs(base, cfg.executable as string) : undefined;

            return { source: 'launchJson', projectFiles, outputFile };
        } catch {
            return null;
        }
    }

    // -----------------------------------------------------------------------
    // fileCfg  (<file>.pb.cfg)
    // -----------------------------------------------------------------------
    private async fromFileCfg(uri: vscode.Uri): Promise<FallbackBuildContext | null> {
        const cfgPath = uri.fsPath + '.cfg';
        try {
            const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(cfgPath));
            const meta  = parseCfgFile(Buffer.from(bytes).toString('utf8'));
            if (!meta) return null;

            const base = path.dirname(uri.fsPath);
            return {
                source:       'fileCfg',
                projectFiles: [],
                outputFile:   extractExecutable(meta, base),
            };
        } catch { return null; }
    }

    // -----------------------------------------------------------------------
    // projectCfg  (project.cfg – walk up directory tree to workspace root)
    // -----------------------------------------------------------------------
    private async fromProjectCfg(uri: vscode.Uri): Promise<FallbackBuildContext | null> {
        const wsFolder = vscode.workspace.getWorkspaceFolder(uri);
        const stopAt   = wsFolder?.uri.fsPath ?? path.parse(uri.fsPath).root;
        const fileName = path.basename(uri.fsPath);  // z.B. "test.pb"

        let dir = path.dirname(uri.fsPath);
        while (true) {
            const cfgPath = path.join(dir, 'project.cfg');
            try {
                const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(cfgPath));
                const meta  = parseProjectCfg(Buffer.from(bytes).toString('utf8'), fileName);
                if (meta) {
                    return {
                        source:       'projectCfg',
                        projectFiles: [],
                        outputFile:   extractExecutable(meta, dir),
                    };
                }
            } catch { /* Datei nicht vorhanden – nächste Ebene */ }

            if (dir === stopAt || dir === path.dirname(dir)) break;
            dir = path.dirname(dir);
        }
        return null;
    }

    // -----------------------------------------------------------------------

    private configuredSource(): FallbackSource {
        const val   = vscode.workspace.getConfiguration('purebasic.build')
            .get<string>('fallbackSource', 'launchJson');
        const valid: FallbackSource[] =
            ['sourceMetadata', 'launchJson', 'fileCfg', 'projectCfg'];
        return valid.includes(val as FallbackSource) ? (val as FallbackSource) : 'launchJson';
    }

    private abs(base: string, p: string): string {
        return path.isAbsolute(p) ? p : path.resolve(base, p);
    }
}