import type { PbpTarget } from '@caldymos/pb-project-core';
import type { UnifiedContext } from '../../../../src/host/unified-context';
import {
    buildCompilerStandbyCommands,
    buildCompilerStandbyCompileFlags,
    buildSyntaxCheckStandbyCommands,
} from '../../../../src/host/pbcompiler/standby/compiler-standby-command-builder';
import { serializeCompilerStandbyCommand } from '../../../../src/host/pbcompiler/standby/compiler-standby-protocol';
import { PassThrough } from 'stream';
import { EventEmitter } from 'events';
import type * as cp from 'child_process';
import {
    CompilerStandbySession,
    detectPureBasicHome,
    formatCompilerStandbyCommandForLog,
} from '../../../../src/host/pbcompiler/standby/compiler-standby-session';

function makeTarget(partial: Partial<PbpTarget> = {}): PbpTarget {
    return {
        name: 'Default',
        enabled: true,
        isDefault: true,
        inputFile: { rawPath: 'main.pb', fsPath: '/project/main.pb' },
        outputFile: { rawPath: 'build/app.exe', fsPath: '/project/build/app.exe' },
        executable: { rawPath: 'build/app.exe', fsPath: '/project/build/app.exe' },
        directory: '',
        options: {},
        constants: [],
        ...partial,
    };
}

describe('compiler standby command builder', () => {
    test('builds the minimal syntax check command sequence', () => {
        const result = buildCompilerStandbyCommands({
            platform: 'linux',
            sourceFile: '/project/main.pb',
            targetFile: '/tmp/pb-syntax-check',
            includePath: '/project',
            checkSyntax: true,
            createExecutable: false,
        });

        expect(result.warnings).toEqual([]);
        expect(result.commands.map(serializeCompilerStandbyCommand)).toEqual([
            'SOURCE\t/project/main.pb',
            'TARGET\t/tmp/pb-syntax-check',
            'INCLUDEPATH\t/project',
            'COMPILE\tPROGRESS\tWARNINGS\tCHECKSYNTAX',
        ]);
    });

    test('adds source alias only when it differs from the source file', () => {
        const result = buildCompilerStandbyCommands({
            platform: 'win32',
            sourceFile: 'C:\\Temp\\PB_EditorOutput.pb',
            targetFile: 'C:\\Temp\\PB_CompilerOutput.exe',
            includePath: 'C:\\Project',
            sourceAlias: 'C:\\Project\\main.pb',
            checkSyntax: true,
            createExecutable: false,
        });

        expect(result.commands.map(serializeCompilerStandbyCommand)).toContain('SOURCEALIAS\tC:\\Project\\main.pb');
    });

    test('maps project target options to IDE-style compile flags', () => {
        const target = makeTarget({
            options: {
                thread: true,
                optimizer: true,
                onerror: true,
                debug: true,
                xpskin: true,
                admin: true,
                user: true,
                dpiaware: true,
                dllprotection: true,
                shareducrt: true,
            },
            purifier: { enabled: true },
            format: { exe: 'console', cpu: '5' },
        });

        const warnings: string[] = [];
        const flags = buildCompilerStandbyCompileFlags(target, {
            platform: 'win32',
            checkSyntax: true,
            warnings,
        });

        expect(flags).toEqual([
            'PROGRESS',
            'WARNINGS',
            'THREAD',
            'OPTIMIZER',
            'ONERROR',
            'DPIAWARE',
            'XPSKIN',
            'DLLPROTECTION',
            'SHAREDUCRT',
            'ADMINISTRATOR',
            'CONSOLE',
            'DEBUGGER',
            'PURIFIER',
            'SSE2',
            'CHECKSYNTAX',
        ]);
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain('admin');
    });

    test('emits target file commands and constants', () => {
        const target = makeTarget({
            linker: { rawPath: 'linker.txt', fsPath: '/project/linker.txt' },
            resources: ['res/app.rc', 'res/other.rc'],
            icon: { enabled: true, rawPath: 'app.ico', fsPath: '/project/app.ico' },
            exeConstant: { enabled: true },
            compileCount: { enabled: true, value: 12 },
            buildCount: { enabled: true, value: 3 },
            constants: [
                { enabled: true, value: '#APP_NAME = "Demo"' },
                { enabled: false, value: '#DISABLED = 1' },
            ],
        });

        const result = buildCompilerStandbyCommands({
            platform: 'win32',
            sourceFile: '/project/main.pb',
            targetFile: '/tmp/check.exe',
            includePath: '/project',
            projectDir: '/project',
            target,
            checkSyntax: true,
            createExecutable: false,
        });

        expect(result.commands.map(serializeCompilerStandbyCommand)).toEqual([
            'SOURCE\t/project/main.pb',
            'TARGET\t/tmp/check.exe',
            'INCLUDEPATH\t/project',
            'LINKER\t/project/linker.txt',
            'RESOURCE\t/project/res/app.rc',
            'ICON\t/project/app.ico',
            'CONSTANT\tPB_Editor_CreateExecutable=0',
            'CONSTANT\tPB_Editor_CompileCount=12',
            'CONSTANT\tPB_Editor_BuildCount=3',
            'CONSTANT\tAPP_NAME=Demo',
            'COMPILE\tPROGRESS\tWARNINGS\tCHECKSYNTAX',
        ]);
        expect(result.warnings).toEqual(['Multiple resources are configured; compiler standby RESOURCE uses the first entry.']);
    });

    test('expands dollar-prefixed constant values like the PureBasic IDE', () => {
        const previousValue = process.env.PB_LANG_SUPPORT_TEST_SECRET;
        const previousUnknownValue = process.env.PB_LANG_SUPPORT_UNKNOWN_SECRET;
        process.env.PB_LANG_SUPPORT_TEST_SECRET = 'super-secret-value';
        delete process.env.PB_LANG_SUPPORT_UNKNOWN_SECRET;

        try {
            const target = makeTarget({
                constants: [
                    { enabled: true, value: '#API_TOKEN = "$PB_LANG_SUPPORT_TEST_SECRET"' },
                    { enabled: true, value: '#UNKNOWN_VALUE = "prefix-$PB_LANG_SUPPORT_UNKNOWN_SECRET-suffix"' },
                ],
            });

            const result = buildCompilerStandbyCommands({
                platform: 'linux',
                sourceFile: '/project/main.pb',
                targetFile: '/tmp/check',
                target,
                checkSyntax: true,
                createExecutable: false,
            });

            const serialized = result.commands.map(serializeCompilerStandbyCommand);
            expect(serialized).toContain('CONSTANT\tAPI_TOKEN=super-secret-value');
            expect(serialized).toContain('CONSTANT\tUNKNOWN_VALUE=prefix--suffix');
        } finally {
            if (previousValue === undefined) {
                delete process.env.PB_LANG_SUPPORT_TEST_SECRET;
            } else {
                process.env.PB_LANG_SUPPORT_TEST_SECRET = previousValue;
            }

            if (previousUnknownValue === undefined) {
                delete process.env.PB_LANG_SUPPORT_UNKNOWN_SECRET;
            } else {
                process.env.PB_LANG_SUPPORT_UNKNOWN_SECRET = previousUnknownValue;
            }
        }
    });

    test('uses source alias directory as include path for temporary syntax check source', () => {
        const ctx: UnifiedContext = {
            mode: 'fallback',
            noProject: true,
            projectFiles: [],
            inputFile: '/tmp/vscode-pb-lang-support/syntax-check/PB_EditorOutput.pb',
            sourceAlias: '/project/main.pb',
            projectDir: '/project',
        };

        const result = buildSyntaxCheckStandbyCommands(ctx, {
            platform: 'linux',
            targetFile: '/tmp/check',
            sourceAlias: ctx.sourceAlias,
        });

        expect(result.commands.map(serializeCompilerStandbyCommand)).toEqual([
            'SOURCE\t/tmp/vscode-pb-lang-support/syntax-check/PB_EditorOutput.pb',
            'TARGET\t/tmp/check',
            'INCLUDEPATH\t/project',
            'SOURCEALIAS\t/project/main.pb',
            'COMPILE\tPROGRESS\tWARNINGS\tCHECKSYNTAX',
        ]);
    });

    test('builds syntax check commands from unified context', () => {
        const ctx: UnifiedContext = {
            mode: 'pbp',
            noProject: false,
            projectFiles: [],
            inputFile: '/project/main.pb',
            projectDir: '/project',
            target: makeTarget({ options: { debug: true } }),
        };

        const result = buildSyntaxCheckStandbyCommands(ctx, {
            platform: 'linux',
            targetFile: '/tmp/check',
        });

        expect(result.commands.map(serializeCompilerStandbyCommand)).toEqual([
            'SOURCE\t/project/main.pb',
            'TARGET\t/tmp/check',
            'INCLUDEPATH\t/project',
            'COMPILE\tPROGRESS\tWARNINGS\tDEBUGGER\tCHECKSYNTAX',
        ]);
    });

    test('redacts sensitive command arguments in standby command logs', () => {
        expect(formatCompilerStandbyCommandForLog({ name: 'CONSTANT', args: ['API_TOKEN=super-secret-value'] })).toBe(
            'CONSTANT <redacted>',
        );
        expect(formatCompilerStandbyCommandForLog({ name: 'SOURCE', args: ['/project/main.pb'] })).toBe('SOURCE <redacted>');
        expect(formatCompilerStandbyCommandForLog({ name: 'TARGET', args: ['/tmp/check.exe'] })).toBe('TARGET <redacted>');
        expect(formatCompilerStandbyCommandForLog({ name: 'COMPILE', args: ['PROGRESS', 'WARNINGS', 'CHECKSYNTAX'] })).toBe(
            'COMPILE PROGRESS WARNINGS CHECKSYNTAX',
        );
    });

    test('detects PureBasic home from compiler path', () => {
        expect(detectPureBasicHome('/opt/purebasic/compilers/pbcompiler')).toBe('/opt/purebasic');
        expect(detectPureBasicHome('/Applications/PureBasic.app/Contents/Resources/compilers/pbcompiler')).toBe('/Applications/PureBasic.app/Contents/Resources');
        expect(detectPureBasicHome('pbcompiler')).toBeUndefined();
    });
});


class FakeCompilerProcess extends EventEmitter {
    readonly stdin = new PassThrough();
    readonly stdout = new PassThrough();
    readonly stderr = new PassThrough();
    killed = false;
    writtenInput = '';

    constructor() {
        super();
        this.stdin.on('data', (chunk: Buffer) => {
            this.writtenInput += chunk.toString('utf8');
        });
    }

    kill(): boolean {
        this.killed = true;
        this.emit('close', null, 'SIGTERM');
        return true;
    }
}

describe('compiler standby session', () => {
    test('starts standby compiler, writes commands and parses success response', async () => {
        const fakeProcess = new FakeCompilerProcess();
        const spawnCalls: Array<{ command: string; args: readonly string[]; cwd?: string }> = [];
        const outputLines: string[] = [];

        const spawn = ((command, args, options) => {
            spawnCalls.push({ command, args, cwd: options.cwd });
            setImmediate(() => fakeProcess.stdout.write('SUCCESS\n'));
            return fakeProcess as unknown as cp.ChildProcessWithoutNullStreams;
        }) satisfies (command: string, args: readonly string[], options: cp.SpawnOptionsWithoutStdio) => cp.ChildProcessWithoutNullStreams;

        const session = new CompilerStandbySession({
            compiler: 'pbcompiler',
            cwd: '/project',
            platform: 'win32',
            spawn,
            outputChannel: { appendLine: (value) => outputLines.push(value) },
        });

        const result = await session.run([
            { name: 'SOURCE', args: ['main.pb'] },
            { name: 'CONSTANT', args: ['API_TOKEN=super-secret-value'] },
            { name: 'COMPILE', args: ['PROGRESS', 'WARNINGS', 'CHECKSYNTAX'] },
        ]);

        expect(spawnCalls).toEqual([{ command: 'pbcompiler', args: ['/STANDBY'], cwd: '/project' }]);
        expect(fakeProcess.writtenInput).toBe(
            'SOURCE\tmain.pb\nCONSTANT\tAPI_TOKEN=super-secret-value\nCOMPILE\tPROGRESS\tWARNINGS\tCHECKSYNTAX\n',
        );
        expect(result.parseResult.terminal).toEqual({ kind: 'success', rawLine: 'SUCCESS' });
        expect(outputLines).toContain('cmd: pbcompiler /STANDBY');
        expect(outputLines).toContain('> SOURCE <redacted>');
        expect(outputLines).toContain('> CONSTANT <redacted>');
        expect(outputLines).toContain('> COMPILE PROGRESS WARNINGS CHECKSYNTAX');
        expect(outputLines.join('\n')).not.toContain('main.pb');
        expect(outputLines.join('\n')).not.toContain('super-secret-value');

        fakeProcess.emit('close', 0, null);
        await session.dispose();
    });

    test('uses unix standby switch on non-Windows platforms', async () => {
        const fakeProcess = new FakeCompilerProcess();
        const spawnCalls: Array<{ args: readonly string[] }> = [];

        const spawn = ((_command, args) => {
            spawnCalls.push({ args });
            setImmediate(() => fakeProcess.stdout.write('ERROR\tSYNTAX\t4\nMESSAGE\tSyntax error.\nOUTPUT\tCOMPLETE\n'));
            return fakeProcess as unknown as cp.ChildProcessWithoutNullStreams;
        }) satisfies (command: string, args: readonly string[], options: cp.SpawnOptionsWithoutStdio) => cp.ChildProcessWithoutNullStreams;

        const session = new CompilerStandbySession({
            compiler: 'pbcompiler',
            cwd: '/project',
            platform: 'linux',
            spawn,
        });

        const result = await session.run([
            { name: 'COMPILE', args: ['CHECKSYNTAX'] },
        ]);

        expect(spawnCalls[0]?.args).toEqual(['--standby']);
        expect(result.parseResult.terminal).toMatchObject({
            kind: 'syntaxError',
            line: 4,
            message: 'Syntax error.',
        });

        fakeProcess.emit('close', 0, null);
        await session.dispose();
    });
});
