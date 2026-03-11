/**
 * PureBasic: Run Active Target
 *
 * Host-side command that runs the active target executable (if available) or
 * runs the fallback executable.
 *
 * Run mode is controlled by `purebasic.run.mode`:
 *   "spawn"    – child_process.spawn, shell:false, output streamed to OutputChannel (default)
 *   "terminal" – VS Code terminal, args are argv-safe re-quoted for the target shell
 */

import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { FallbackResolver } from '../fallback-resolver';
import { resolveUnifiedContext, type PbProjectFilesApi } from '../unified-context';
import { readHostSettings } from '../config/settings';

export interface RunActiveTargetDeps {
    projectFilesApi?: PbProjectFilesApi;
    outputChannel: vscode.OutputChannel;
}

export async function runActiveTarget(deps: RunActiveTargetDeps): Promise<boolean> {
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

    const executablePath = (uctx.executable ?? '').trim() || (uctx.outputFile ?? '').trim();
    if (!executablePath) {
        void vscode.window.showErrorMessage('No executable configured for the active target.');
        return false;
    }

    const runCwd = (uctx.workingDir ?? '').trim() || path.dirname(executablePath);

    try {
        await fs.promises.access(executablePath);
    } catch {
        const hint = uctx.mode === 'pbp'
            ? 'Build the active target first (PureBasic: Build Active Target).'
            : 'Provide an executable in the selected fallback source.';
        void vscode.window.showErrorMessage(`Executable not found: ${executablePath}. ${hint}`);
        return false;
    }

    const commandLine = uctx.mode === 'pbp'
        ? String(uctx.target?.commandLine ?? '').trim()
        : '';

    const args = commandLine ? parseArgv(commandLine) : [];
    const cfg = readHostSettings();

    deps.outputChannel.clear();
    deps.outputChannel.show(true);
    deps.outputChannel.appendLine('--- Run ---');
    deps.outputChannel.appendLine(`cwd:  ${runCwd}`);
    deps.outputChannel.appendLine(`mode: ${cfg.run.mode}`);
    deps.outputChannel.appendLine(`cmd:  ${executablePath}${args.length ? ' ' + args.join(' ') : ''}`);

    if (cfg.run.mode === 'terminal') {
        return runInTerminal({ executablePath, args, runCwd, uctx });
    }

    return runInSpawn({ executablePath, args, runCwd, outputChannel: deps.outputChannel });
}

// ---------------------------------------------------------------------------
// spawn strategy
// ---------------------------------------------------------------------------

interface SpawnOpts {
    executablePath: string;
    args: string[];
    runCwd: string;
    outputChannel: vscode.OutputChannel;
}

async function runInSpawn(opts: SpawnOpts): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        const proc = cp.spawn(opts.executablePath, opts.args, {
            cwd: opts.runCwd,
            shell: false,
        });

        proc.stdout?.on('data', (chunk: Buffer) => {
            opts.outputChannel.appendLine(chunk.toString().trimEnd());
        });

        proc.stderr?.on('data', (chunk: Buffer) => {
            opts.outputChannel.appendLine(chunk.toString().trimEnd());
        });

        proc.on('error', (err: NodeJS.ErrnoException) => {
            opts.outputChannel.appendLine(`error: ${err.message}`);
            resolve(false);
        });

        proc.on('close', (code) => {
            opts.outputChannel.appendLine(`--- Exit: ${code ?? -1} ---`);
            resolve(code === 0);
        });
    });
}

// ---------------------------------------------------------------------------
// terminal strategy
// ---------------------------------------------------------------------------

interface TerminalOpts {
    executablePath: string;
    args: string[];
    runCwd: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    uctx: any;
}

function runInTerminal(opts: TerminalOpts): boolean {
    const { executablePath, args, runCwd, uctx } = opts;

    // Use the user's configured default shell so quoting strategy matches.
    const shellExe = vscode.env.shell || '';
    const shellKind = detectShellKind(shellExe);

    const quotedArgs = args.map(a => shellQuoteArg(a, shellKind));
    const quotedExe  = shellQuoteArg(executablePath, shellKind);
    const cmd        = quotedArgs.length
        ? `${quotedExe} ${quotedArgs.join(' ')}`
        : quotedExe;

    const termName = uctx.mode === 'pbp'
        ? `PureBasic Run (${uctx.targetName ?? 'active'})`
        : `PureBasic Run (${uctx.fallbackSource ?? 'fallback'})`;

    const terminal = vscode.window.createTerminal({ name: termName, cwd: runCwd, shellPath: shellExe || undefined });
    terminal.show(true);
    terminal.sendText(cmd, true);

    return true;
}

// ---------------------------------------------------------------------------
// shared helpers
// ---------------------------------------------------------------------------

/**
 * Split a command-line string into an argv array,
 * respecting single- and double-quoted segments.
 */
function parseArgv(commandLine: string): string[] {
    const args: string[] = [];
    let current = '';
    let inSingle = false;
    let inDouble = false;

    for (let i = 0; i < commandLine.length; i++) {
        const ch = commandLine[i];
        if (ch === "'" && !inDouble) {
            inSingle = !inSingle;
        } else if (ch === '"' && !inSingle) {
            inDouble = !inDouble;
        } else if (ch === ' ' && !inSingle && !inDouble) {
            if (current) { args.push(current); current = ''; }
        } else {
            current += ch;
        }
    }
    if (current) { args.push(current); }
    return args;
}

type ShellKind = 'powershell' | 'cmd' | 'posix';

/**
 * Derive the shell kind from the shell executable path.
 * Used to select the correct argument quoting strategy.
 */
function detectShellKind(shellExe: string): ShellKind {
    const name = path.basename(shellExe).toLowerCase();
    if (name === 'pwsh.exe' || name === 'powershell.exe' || name === 'pwsh') {
        return 'powershell';
    }
    if (name === 'cmd.exe') {
        return 'cmd';
    }
    return 'posix';
}

/**
 * Quote a single argument for the given shell.
 * Used only in the terminal strategy to safely re-quote
 * argv tokens before handing them to sendText().
 */
function shellQuoteArg(arg: string, shell: ShellKind): string {
    switch (shell) {
        case 'powershell': {
            // Escape embedded double-quotes by doubling, then wrap.
            const escaped = arg.replace(/"/g, '""');
            return `"${escaped}"`;
        }
        case 'cmd': {
            // cmd.exe: escape double-quotes with backslash, wrap in double-quotes.
            const escaped = arg.replace(/"/g, '\\"');
            return `"${escaped}"`;
        }
        default: {
            // POSIX (bash/zsh): wrap in single-quotes, escape inner ' as '\''
            const escaped = arg.replace(/'/g, "'\\''");
            return `'${escaped}'`;
        }
    }
}