import { isCompilerStandbyResponseComplete, serializeCompilerStandbyCommand, splitCompilerStandbyOutput } from '../../../../src/host/pbcompiler/standby/compiler-standby-protocol';
import { parseCompilerStandbyLines } from '../../../../src/host/pbcompiler/standby/compiler-standby-parser';

describe('compiler standby parser', () => {
    test('parses a successful response with progress lines', () => {
        const result = parseCompilerStandbyLines([
            'PROGRESS\tLINES\t42',
            'PROGRESS\tINCLUDES\tlib/math.pbi',
            'SUCCESS',
        ]);

        expect(result.terminal).toEqual({ kind: 'success', rawLine: 'SUCCESS' });
        expect(result.events).toHaveLength(2);
        expect(result.events[0]).toMatchObject({ kind: 'progress', progressKind: 'LINES', fields: ['42'] });
        expect(result.events[1]).toMatchObject({ kind: 'progress', progressKind: 'INCLUDES', fields: ['lib/math.pbi'] });
        expect(result.warnings).toHaveLength(0);
    });

    test('parses a warning block terminated by OUTPUT COMPLETE', () => {
        const result = parseCompilerStandbyLines([
            'WARNING\t12',
            'MESSAGE\tVariable is not used.',
            'OUTPUT\tCOMPLETE',
            'SUCCESS',
        ]);

        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toMatchObject({
            kind: 'warning',
            location: { line: 12 },
            message: 'Variable is not used.',
        });
        expect(result.terminal).toEqual({ kind: 'success', rawLine: 'SUCCESS' });
    });

    test('uses INCLUDEFILE as warning location when present', () => {
        const result = parseCompilerStandbyLines([
            'WARNING\t4',
            'MESSAGE\tDeprecated function.',
            'INCLUDEFILE\tincludes/api.pbi\t18',
            'OUTPUT\tCOMPLETE',
            'SUCCESS',
        ]);

        expect(result.warnings[0]).toMatchObject({
            location: { file: 'includes/api.pbi', line: 18 },
            message: 'Deprecated function.',
        });
    });

    test('parses a syntax error in the main source file', () => {
        const result = parseCompilerStandbyLines([
            'ERROR\tSYNTAX\t9',
            'MESSAGE\tEndIf expected.',
            'OUTPUT\tCOMPLETE',
        ]);

        expect(result.terminal).toMatchObject({
            kind: 'syntaxError',
            line: 9,
            message: 'EndIf expected.',
        });
    });

    test('parses a syntax error in an include file', () => {
        const result = parseCompilerStandbyLines([
            'ERROR\tSYNTAX\t27',
            'MESSAGE\tSyntax error.',
            'INCLUDEFILE\tincludes/ui.pbi\t3',
            'OUTPUT\tCOMPLETE',
        ]);

        expect(result.terminal).toMatchObject({
            kind: 'syntaxError',
            line: 27,
            includeLocation: { file: 'includes/ui.pbi', line: 3 },
            message: 'Syntax error.',
        });
    });

    test('parses macro information inside a syntax error block', () => {
        const result = parseCompilerStandbyLines([
            'ERROR\tSYNTAX\t14',
            'MESSAGE\tSyntax error in macro expansion.',
            'MACRO\t2\t3',
            'MacroLine1()',
            'MacroLine2()',
            'MacroLine3()',
            'MACRO\tCOMPLETE',
            'OUTPUT\tCOMPLETE',
        ]);

        expect(result.terminal).toMatchObject({
            kind: 'syntaxError',
            line: 14,
            message: 'Syntax error in macro expansion.',
            macro: {
                line: 2,
                expectedLineCount: 3,
                lines: ['MacroLine1()', 'MacroLine2()', 'MacroLine3()'],
            },
        });
    });

    test('parses non-syntax compiler error blocks', () => {
        const result = parseCompilerStandbyLines([
            'ERROR\tLINKER',
            'cannot find library foo',
            'ld returned 1 exit status',
            'OUTPUT\tCOMPLETE',
        ]);

        expect(result.terminal).toMatchObject({
            kind: 'compilerError',
            errorType: 'LINKER',
            message: 'cannot find library foo\nld returned 1 exit status',
            details: ['cannot find library foo', 'ld returned 1 exit status'],
        });
    });

    test('keeps unknown lines as events', () => {
        const result = parseCompilerStandbyLines(['UNEXPECTED\tVALUE']);

        expect(result.events).toEqual([{ kind: 'unknown', rawLine: 'UNEXPECTED\tVALUE' }]);
        expect(result.terminal).toBeUndefined();
    });
});

describe('compiler standby protocol helpers', () => {
    test('serializes a command without trailing newline', () => {
        expect(serializeCompilerStandbyCommand({ name: 'SOURCE', args: ['main.pb'] })).toBe('SOURCE\tmain.pb');
        expect(serializeCompilerStandbyCommand({ name: 'END' })).toBe('END');
    });

    test('splits compiler output into logical lines', () => {
        expect(splitCompilerStandbyOutput('PROGRESS\tLINES\t1\r\nSUCCESS\r\n')).toEqual([
            'PROGRESS\tLINES\t1',
            'SUCCESS',
        ]);
    });
});


describe('compiler standby response completion', () => {
    test('does not treat a warning block as terminal before success', () => {
        expect(isCompilerStandbyResponseComplete([
            'WARNING\t12',
            'MESSAGE\tVariable is not used.',
            'OUTPUT\tCOMPLETE',
        ])).toBe(false);
    });

    test('treats success and completed errors as terminal', () => {
        expect(isCompilerStandbyResponseComplete(['SUCCESS'])).toBe(true);
        expect(isCompilerStandbyResponseComplete([
            'ERROR\tSYNTAX\t9',
            'MESSAGE\tEndIf expected.',
            'OUTPUT\tCOMPLETE',
        ])).toBe(true);
    });
});
