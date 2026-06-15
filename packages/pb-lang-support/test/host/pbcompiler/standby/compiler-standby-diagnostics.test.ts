import { buildCompilerStandbyDiagnostics } from '../../../../src/host/pbcompiler/standby/compiler-standby-diagnostics';
import { parseCompilerStandbyLines } from '../../../../src/host/pbcompiler/standby/compiler-standby-parser';

describe('compiler standby diagnostics mapper', () => {
    test('maps a main source syntax error to the source file with zero-based line', () => {
        const parseResult = parseCompilerStandbyLines([
            'ERROR\tSYNTAX\t9',
            'MESSAGE\tEndIf expected.',
            'OUTPUT\tCOMPLETE',
        ]);

        const diagnostics = buildCompilerStandbyDiagnostics(parseResult, {
            sourceFile: '/project/main.pb',
        });

        expect(diagnostics).toEqual([
            {
                file: '/project/main.pb',
                line: 8,
                severity: 'error',
                message: 'EndIf expected.',
                source: 'PureBasic compiler',
                rawLines: [
                    'ERROR\tSYNTAX\t9',
                    'MESSAGE\tEndIf expected.',
                    'OUTPUT\tCOMPLETE',
                ],
            },
        ]);
    });

    test('maps a source alias syntax error to the original source file', () => {
        const parseResult = parseCompilerStandbyLines([
            'ERROR\tSYNTAX\t3',
            'MESSAGE\tSyntax error.',
            'OUTPUT\tCOMPLETE',
        ]);

        const diagnostics = buildCompilerStandbyDiagnostics(parseResult, {
            sourceFile: '/tmp/PB_EditorOutput.pb',
            sourceAlias: '/project/main.pb',
        });

        expect(diagnostics[0]).toMatchObject({
            file: '/project/main.pb',
            line: 2,
            severity: 'error',
            message: 'Syntax error.',
        });
    });

    test('maps include-file warning and syntax locations relative to the source directory', () => {
        const parseResult = parseCompilerStandbyLines([
            'WARNING\t4',
            'MESSAGE\tDeprecated function.',
            'INCLUDEFILE\tincludes/api.pbi\t18',
            'OUTPUT\tCOMPLETE',
            'ERROR\tSYNTAX\t27',
            'MESSAGE\tSyntax error.',
            'INCLUDEFILE\tincludes/ui.pbi\t3',
            'OUTPUT\tCOMPLETE',
        ]);

        const diagnostics = buildCompilerStandbyDiagnostics(parseResult, {
            sourceFile: '/project/src/main.pb',
            projectDir: '/project',
        });

        expect(diagnostics).toHaveLength(2);
        expect(diagnostics[0]).toMatchObject({
            file: `/project/src/includes/api.pbi`,
            line: 17,
            severity: 'warning',
            message: 'Deprecated function.',
        });
        expect(diagnostics[1]).toMatchObject({
            file: `/project/src/includes/ui.pbi`,
            line: 2,
            severity: 'error',
            message: 'Syntax error.',
        });
    });

    test('does not create diagnostics for non-syntax compiler errors', () => {
        const parseResult = parseCompilerStandbyLines([
            'ERROR\tLINKER',
            'cannot find library foo',
            'OUTPUT\tCOMPLETE',
        ]);

        const diagnostics = buildCompilerStandbyDiagnostics(parseResult, {
            sourceFile: '/project/main.pb',
        });

        expect(diagnostics).toEqual([]);
    });
});
