import * as path from 'path';
import * as vscode from 'vscode';
import { FallbackResolver } from '../../src/host/fallback-resolver';

jest.mock('vscode', () => {
    const nodePath = require('path') as typeof import('path');

    const workspace = {
        getConfiguration: jest.fn(),
        getWorkspaceFolder: jest.fn(),
        workspaceFolders: [] as Array<{ uri: { fsPath: string } }>,
        fs: {
            readFile: jest.fn(),
            stat: jest.fn(),
        },
    };

    const makeUri = (fsPath: string) => ({
        fsPath,
        toString: () => `file://${fsPath}`,
    });

    return {
        FileType: {
            Unknown: 0,
            File: 1,
            Directory: 2,
            SymbolicLink: 64,
        },
        Uri: {
            file: makeUri,
            joinPath: (base: { fsPath: string }, ...segments: string[]) => makeUri(nodePath.join(base.fsPath, ...segments)),
        },
        workspace,
    };
}, { virtual: true });

const actualPath = jest.requireActual<typeof import('path')>('path');

describe('FallbackResolver launch.json fallback', () => {
    let workspaceRoot: string;
    let activeFile: string;
    let targetFile: string;
    let outputFile: string;
    let existingFiles: Set<string>;

    beforeEach(() => {
        (path.resolve as jest.Mock).mockImplementation(actualPath.resolve);
        (path.normalize as jest.Mock | undefined)?.mockImplementation?.(actualPath.normalize);
        (path.isAbsolute as jest.Mock).mockImplementation(actualPath.isAbsolute);
        (path.dirname as jest.Mock).mockImplementation(actualPath.dirname);
        (path.basename as jest.Mock).mockImplementation(actualPath.basename);
        (path.extname as jest.Mock).mockImplementation(actualPath.extname);

        workspaceRoot = actualPath.join(actualPath.parse(process.cwd()).root, 'project');
        activeFile = actualPath.join(workspaceRoot, 'current.pb');
        targetFile = actualPath.join(workspaceRoot, 'src', 'main.pb');
        outputFile = actualPath.join(workspaceRoot, 'build', 'app.exe');
        existingFiles = new Set<string>([activeFile, targetFile]);

        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: (key: string, defaultValue?: unknown) => key === 'build.fallbackSource' ? 'launchJson' : defaultValue,
        });
        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({ uri: vscode.Uri.file(workspaceRoot) });
        (vscode.workspace as any).workspaceFolders = [{ uri: vscode.Uri.file(workspaceRoot) }];
        (vscode.workspace.fs.stat as jest.Mock).mockImplementation(async (uri: { fsPath: string }) => {
            if (!existingFiles.has(uri.fsPath)) {
                throw new Error(`Missing test file: ${uri.fsPath}`);
            }
            return { type: vscode.FileType.File };
        });
    });

    test('unwraps cmd-escaped and quoted program before using it as inputFile', async () => {
        mockLaunchJson(`^"\${workspaceFolder}/src/main.pb"`);

        const result = await new FallbackResolver().resolve(vscode.Uri.file(activeFile));

        expect(result?.inputFile).toBe(targetFile);
        expect(result?.workingDir).toBe(actualPath.dirname(targetFile));
        expect(result?.warnings).toEqual([]);
    });

    test('unwraps quoted program and output values after placeholder expansion', async () => {
        mockLaunchJson(`"\${workspaceFolder}/src/main.pb"`, `"\${workspaceFolder}/build/app.exe"`);

        const result = await new FallbackResolver().resolve(vscode.Uri.file(activeFile));

        expect(result?.inputFile).toBe(targetFile);
        expect(result?.outputFile).toBe(outputFile);
        expect(result?.warnings).toEqual([]);
    });

    test('falls back to active file when launch.json program does not exist', async () => {
        const missingFile = actualPath.join(workspaceRoot, 'missing.pb');
        mockLaunchJson(`"${missingFile}"`);

        const result = await new FallbackResolver().resolve(vscode.Uri.file(activeFile));

        expect(result?.inputFile).toBe(activeFile);
        expect(result?.workingDir).toBe(actualPath.dirname(activeFile));
        expect(result?.warnings).toEqual([
            `launch.json program does not point to an existing file; using active file instead: "${missingFile}"`,
        ]);
    });

    function mockLaunchJson(program: string, output?: string): void {
        const configuration: Record<string, unknown> = {
            type: 'purebasic',
            request: 'launch',
            name: 'Debug PureBasic',
            program,
        };
        if (output) {
            configuration.output = output;
        }

        (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(JSON.stringify({
            configurations: [configuration],
        }), 'utf8'));
    }
});
