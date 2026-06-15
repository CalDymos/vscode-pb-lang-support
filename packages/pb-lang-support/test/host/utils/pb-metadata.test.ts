import * as path from 'path';
import {
    extractUseMainFile,
    getMetadataString,
    metadataEntries,
    metadataToFallbackTarget,
    parseCfgFile,
    splitPbFile,
} from '../../../src/host/utils/pb-metadata';

const actualPath = jest.requireActual<typeof import('path')>('path');

beforeEach(() => {
    (path.resolve as jest.Mock).mockImplementation(actualPath.resolve);
    (path.normalize as jest.Mock | undefined)?.mockImplementation?.(actualPath.normalize);
    (path.isAbsolute as jest.Mock).mockImplementation(actualPath.isAbsolute);
    (path.dirname as jest.Mock).mockImplementation(actualPath.dirname);
    (path.basename as jest.Mock).mockImplementation(actualPath.basename);
    (path.extname as jest.Mock).mockImplementation(actualPath.extname);
});

describe('PureBasic IDE metadata helpers', () => {
    test('parses UseMainFile and resolves it relative to the active source', () => {
        const split = splitPbFile([
            'Debug "child"',
            '',
            '; IDE Options = PureBasic 6.30 (Windows - x64)',
            '; UseMainFile = ..\\main.pb',
        ].join('\n'));

        expect(split.metadata).not.toBeNull();
        expect(extractUseMainFile(split.metadata!, 'C:\\Project\\src')).toBe(actualPath.normalize('C:\\Project\\main.pb'));
    });

    test('preserves duplicate Constant and AddResource entries', () => {
        const metadata = parseCfgFile([
            'IDE Options = PureBasic 6.30 (Windows - x64)',
            'Constant = #APP_NAME = "Demo"',
            'Constant = #APP_MODE = 1',
            'AddResource = res/app.rc',
            'AddResource = res/extra.rc',
        ].join('\n'));

        expect(metadata).not.toBeNull();
        expect(metadataEntries(metadata!, 'Constant').map((entry) => entry.value)).toEqual([
            '#APP_NAME = "Demo"',
            '#APP_MODE = 1',
        ]);
        expect(metadataEntries(metadata!, 'AddResource').map((entry) => entry.value)).toEqual([
            'res/app.rc',
            'res/extra.rc',
        ]);
    });

    test('maps IDE metadata to target-like compiler options', () => {
        const metadata = parseCfgFile([
            'IDE Options = PureBasic 6.30 (Windows - x64)',
            'ExecutableFormat = Console',
            'Executable = build/app.exe',
            'EnableThread',
            'EnableOnError',
            'DPIAware',
            'DisableDebugger',
            'UseIcon = app.ico',
            'CPU = 5',
            'SubSystem = gtk3',
            'LinkerOptions = linker.txt',
            'EnablePurifier = Local, Global',
            'EnableExeConstant',
            'EnableCompileCount = 7',
            'EnableBuildCount = 2',
            'Constant = #APP_NAME = "Demo"',
            'AddResource = res/app.rc',
        ].join('\n'));

        expect(metadata).not.toBeNull();

        const target = metadataToFallbackTarget(metadata!, '/project/main.pb', '/project');

        expect(target.outputFile.fsPath).toBe(actualPath.normalize('/project/build/app.exe'));
        expect(target.options).toMatchObject({
            debug: false,
            thread: true,
            onerror: true,
            dpiaware: true,
        });
        expect(target.format).toEqual({ exe: 'console', cpu: '5' });
        expect(target.icon?.fsPath).toBe(actualPath.normalize('/project/app.ico'));
        expect(target.linker?.fsPath).toBe(actualPath.normalize('/project/linker.txt'));
        expect(target.purifier).toMatchObject({ enabled: true, granularity: 'Local, Global' });
        expect(target.exeConstant?.enabled).toBe(true);
        expect(target.compileCount).toEqual({ enabled: true, value: 7 });
        expect(target.buildCount).toEqual({ enabled: true, value: 2 });
        expect(target.constants).toEqual([{ enabled: true, value: '#APP_NAME = "Demo"' }]);
        expect(target.resources).toEqual([actualPath.normalize('/project/res/app.rc')]);
    });

    test('allows active-file debugger state to override MainFile metadata', () => {
        const metadata = parseCfgFile([
            'IDE Options = PureBasic 6.30 (Windows - x64)',
            'DisableDebugger',
        ].join('\n'));

        expect(metadata).not.toBeNull();
        expect(getMetadataString(metadata!, 'DisableDebugger')).toBeUndefined();

        const target = metadataToFallbackTarget(metadata!, '/project/main.pb', '/project', {
            debuggerEnabled: true,
        });

        expect(target.options.debug).toBe(true);
    });
});
