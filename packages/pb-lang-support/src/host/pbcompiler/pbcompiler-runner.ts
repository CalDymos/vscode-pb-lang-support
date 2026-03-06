/**
 * pbcompiler runner for the Extension Host.
 */

import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface PbCompilerRunOptions {
    compiler: string;
    args: string[];
    cwd: string;
    outputChannel?: { appendLine(s: string): void };
}

export interface PbCompilerRunResult {
    exitCode: number;
    stdout: string;
    stderr: string;
}

export async function runPbCompiler(opt: PbCompilerRunOptions): Promise<PbCompilerRunResult> {
    const env = { ...process.env };
    if (!env.PUREBASIC_HOME) {
        const pbHome = detectPureBasicHome(opt.compiler);
        if (pbHome) {
            env.PUREBASIC_HOME = pbHome;
            opt.outputChannel?.appendLine(`PUREBASIC_HOME=${pbHome}`);
        }
    }

    opt.outputChannel?.appendLine(`cwd: ${opt.cwd}`);
    opt.outputChannel?.appendLine(`cmd: ${opt.compiler} ${opt.args.join(' ')}`);

    return await new Promise((resolve, reject) => {
        const proc = cp.spawn(opt.compiler, opt.args, { cwd: opt.cwd, env });

        let stdout = '';
        let stderr = '';

        proc.stdout?.on('data', (chunk: Buffer) => {
            const text = chunk.toString();
            stdout += text;
            opt.outputChannel?.appendLine(text.trimEnd());
        });

        proc.stderr?.on('data', (chunk: Buffer) => {
            const text = chunk.toString();
            stderr += text;
            opt.outputChannel?.appendLine(text.trimEnd());
        });

        proc.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'ENOENT') {
                reject(new Error(`PureBasic compiler not found: "${opt.compiler}"`));
                return;
            }
            reject(err);
        });

        proc.on('close', (code) => {
            resolve({ exitCode: code ?? -1, stdout, stderr });
        });
    });
}

/**
 * Best-effort PUREBASIC_HOME detection:
 *  - macOS .app bundle: /xxx/PureBasic.app/Contents/Resources/compilers/pbcompiler
 *  - others: /xxx/purebasic/compilers/pbcompiler
 */
function detectPureBasicHome(compilerPath: string): string | undefined {
    const normalized = path.normalize(compilerPath);

    const appMatch = normalized.match(/(.+\.app\/Contents\/Resources)/i);
    if (appMatch) {
        return appMatch[1];
    }

    const idx = normalized.toLowerCase().indexOf(path.sep + 'compilers' + path.sep);
    if (idx > 0) {
        return normalized.substring(0, idx);
    }

    const parent = path.dirname(normalized);
    if (parent && parent !== normalized) {
        try {
            if (fs.existsSync(parent)) return parent;
        } catch {
            return undefined;
        }
    }
    return undefined;
}