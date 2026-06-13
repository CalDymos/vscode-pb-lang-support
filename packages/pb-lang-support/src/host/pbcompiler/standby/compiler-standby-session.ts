/**
 * Process session for the PureBasic compiler standby protocol.
 *
 * The session starts pbcompiler in standby mode and executes one command
 * sequence at a time. The compiler keeps running between requests until the
 * session is disposed.
 */

import * as cp from 'child_process';
import * as path from 'path';
import { once } from 'events';

import { parseCompilerStandbyLines } from './compiler-standby-parser';
import {
    isCompilerStandbyResponseComplete,
    serializeCompilerStandbyCommand,
    splitCompilerStandbyOutput,
} from './compiler-standby-protocol';
import type { CompilerStandbyCommand, CompilerStandbyParseResult } from './compiler-standby-types';

export interface CompilerStandbyOutputChannel {
    appendLine(value: string): void;
}

export interface CompilerStandbySessionOptions {
    compiler: string;
    cwd: string;
    platform?: NodeJS.Platform;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
    outputChannel?: CompilerStandbyOutputChannel;
    spawn?: CompilerStandbySpawnFunction;
}

export interface CompilerStandbyRunOptions {
    timeoutMs?: number;
}

export interface CompilerStandbyRunResult {
    parseResult: CompilerStandbyParseResult;
    stdout: string;
    stderr: string;
    rawLines: string[];
}

export type CompilerStandbySpawnFunction = (
    command: string,
    args: readonly string[],
    options: cp.SpawnOptionsWithoutStdio,
) => cp.ChildProcessWithoutNullStreams;

const DEFAULT_TIMEOUT_MS = 60_000;

export class CompilerStandbySession {
    private proc: cp.ChildProcessWithoutNullStreams | undefined;
    private stdout = '';
    private stderr = '';
    private stdoutBuffer = '';
    private responseLines: string[] = [];
    private responseResolver: ((result: CompilerStandbyRunResult) => void) | undefined;
    private responseRejecter: ((err: Error) => void) | undefined;
    private running = false;
    private disposed = false;

    constructor(private readonly opt: CompilerStandbySessionOptions) {}

    async start(): Promise<void> {
        if (this.proc) return;
        if (this.disposed) {
            throw new Error('Compiler standby session has already been disposed.');
        }

        const platform = this.opt.platform ?? process.platform;
        const args = [platform === 'win32' ? '/STANDBY' : '--standby'];
        const env = this.buildEnvironment();

        this.opt.outputChannel?.appendLine(`cwd: ${this.opt.cwd}`);
        this.opt.outputChannel?.appendLine(`cmd: ${this.opt.compiler} ${args.join(' ')}`);

        const spawn = this.opt.spawn ?? cp.spawn;
        const proc = spawn(this.opt.compiler, args, {
            cwd: this.opt.cwd,
            env,
            stdio: 'pipe',
        });

        this.proc = proc;
        proc.stdout.setEncoding('utf8');
        proc.stderr.setEncoding('utf8');

        proc.stdout.on('data', (chunk: string | Buffer) => this.handleStdout(String(chunk)));
        proc.stderr.on('data', (chunk: string | Buffer) => this.handleStderr(String(chunk)));
        proc.on('error', (err: NodeJS.ErrnoException) => this.handleProcessError(err));
        proc.on('close', (code: number | null, signal: NodeJS.Signals | null) => this.handleProcessClose(code, signal));
    }

    async run(commands: readonly CompilerStandbyCommand[], runOpt: CompilerStandbyRunOptions = {}): Promise<CompilerStandbyRunResult> {
        if (this.running) {
            throw new Error('Compiler standby session is already running a command sequence.');
        }
        if (commands.length === 0) {
            throw new Error('Compiler standby command sequence is empty.');
        }

        await this.start();

        const proc = this.requireProcess();
        this.running = true;
        this.stdout = '';
        this.stderr = '';
        this.stdoutBuffer = '';
        this.responseLines = [];

        const timeoutMs = runOpt.timeoutMs ?? this.opt.timeoutMs ?? DEFAULT_TIMEOUT_MS;

        return await new Promise<CompilerStandbyRunResult>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.clearResponseHandlers();
                this.running = false;
                reject(new Error(`PureBasic compiler standby request timed out after ${timeoutMs} ms.`));
            }, timeoutMs);

            this.responseResolver = (result) => {
                clearTimeout(timer);
                this.clearResponseHandlers();
                this.running = false;
                resolve(result);
            };
            this.responseRejecter = (err) => {
                clearTimeout(timer);
                this.clearResponseHandlers();
                this.running = false;
                reject(err);
            };

            try {
                for (const command of commands) {
                    const line = serializeCompilerStandbyCommand(command);
                    this.opt.outputChannel?.appendLine(`> ${line}`);
                    proc.stdin.write(`${line}\n`, 'utf8');
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                this.responseRejecter?.(new Error(`Failed to write compiler standby commands: ${message}`));
            }
        });
    }

    async dispose(): Promise<void> {
        if (this.disposed) return;
        this.disposed = true;

        const proc = this.proc;
        this.proc = undefined;
        this.clearResponseHandlers();

        if (!proc || proc.killed) return;

        try {
            proc.stdin.write('END\n', 'utf8');
            proc.stdin.end();
        } catch {
            proc.kill();
            return;
        }

        const closePromise = once(proc, 'close').then(() => undefined).catch(() => undefined);
        const killPromise = new Promise<void>((resolve) => {
            setTimeout(() => {
                if (!proc.killed) proc.kill();
                resolve();
            }, 1000);
        });

        await Promise.race([closePromise, killPromise]);
    }

    private buildEnvironment(): NodeJS.ProcessEnv {
        const env: NodeJS.ProcessEnv = {
            ...(this.opt.env ?? process.env),
        };

        if (!env.PUREBASIC_HOME) {
            const pbHome = detectPureBasicHome(this.opt.compiler);
            if (pbHome) {
                env.PUREBASIC_HOME = pbHome;
                this.opt.outputChannel?.appendLine(`PUREBASIC_HOME=${pbHome}`);
            }
        }

        return env;
    }

    private requireProcess(): cp.ChildProcessWithoutNullStreams {
        if (!this.proc) {
            throw new Error('Compiler standby process is not running.');
        }
        return this.proc;
    }

    private handleStdout(chunk: string): void {
        this.stdout += chunk;
        this.opt.outputChannel?.appendLine(chunk.trimEnd());

        this.stdoutBuffer += chunk;
        const lines = splitCompilerStandbyOutput(this.stdoutBuffer);

        if (!this.stdoutBuffer.endsWith('\n') && !this.stdoutBuffer.endsWith('\r')) {
            this.stdoutBuffer = lines.pop() ?? '';
        } else {
            this.stdoutBuffer = '';
        }

        for (const line of lines) {
            this.responseLines.push(line);
        }

        this.tryCompleteResponse();
    }

    private handleStderr(chunk: string): void {
        this.stderr += chunk;
        this.opt.outputChannel?.appendLine(chunk.trimEnd());
    }

    private handleProcessError(err: NodeJS.ErrnoException): void {
        if (err.code === 'ENOENT') {
            this.rejectActiveRequest(new Error(`PureBasic compiler not found: "${this.opt.compiler}"`));
            return;
        }
        this.rejectActiveRequest(err);
    }

    private handleProcessClose(code: number | null, signal: NodeJS.Signals | null): void {
        this.proc = undefined;
        const reason = signal ? `signal ${signal}` : `code ${code ?? -1}`;

        if (this.responseResolver && this.responseLines.length > 0 && isCompilerStandbyResponseComplete(this.responseLines)) {
            this.tryCompleteResponse();
            return;
        }

        this.rejectActiveRequest(new Error(`PureBasic compiler standby process closed unexpectedly with ${reason}.`));
    }

    private tryCompleteResponse(): void {
        if (!this.responseResolver) return;
        if (!isCompilerStandbyResponseComplete(this.responseLines)) return;

        const rawLines = [...this.responseLines];
        const parseResult = parseCompilerStandbyLines(rawLines);
        this.responseResolver({
            parseResult,
            stdout: this.stdout,
            stderr: this.stderr,
            rawLines,
        });
    }

    private rejectActiveRequest(err: Error): void {
        this.responseRejecter?.(err);
    }

    private clearResponseHandlers(): void {
        this.responseResolver = undefined;
        this.responseRejecter = undefined;
    }
}

export function detectPureBasicHome(compilerPath: string): string | undefined {
    const normalized = compilerPath.trim();
    if (!normalized || !containsPathSeparator(normalized)) {
        return undefined;
    }

    const appMatch = normalized.match(/(.+\.app[\\/]Contents[\\/]Resources)(?:[\\/].*)?$/i);
    if (appMatch) {
        return appMatch[1];
    }

    const compilerDirMatch = normalized.match(/^(.*)[\\/]compilers[\\/][^\\/]+$/i);
    if (compilerDirMatch?.[1]) {
        return compilerDirMatch[1];
    }

    return undefined;
}

function containsPathSeparator(value: string): boolean {
    return value.includes('/') || value.includes('\\');
}
