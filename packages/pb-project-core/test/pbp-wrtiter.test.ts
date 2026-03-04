import * as path from 'path';

import { parsePbpProjectText } from '../src/pbp/parser';
import { writePbpProjectText } from '../src/pbp/writer';

import type { PbpProject } from '../src/pbp/model';

// meta is optional but included so the type matches writePbpProjectText's parameter exactly.
type WritableProject = Pick<PbpProject, 'config' | 'data' | 'files' | 'targets' | 'libraries' | 'meta'>;

function normalizeNl(s: string): string {
    return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

// --------------------------------------------------------------------------------------
// Test fixtures
// --------------------------------------------------------------------------------------

function makeProjectVariantA(): WritableProject {
    return {
        config: {
            name: 'My Project',
            comment: 'Hello & <World> "quotes" \'apos\'',
            closefiles: true,
            openmode: 1,
        },
        data: {
            explorer: { view: 'tree', pattern: 3 },
            log: { show: true },
            lastopen: { date: '2026-03-02', user: 'me', host: 'devbox' },
        },
        files: [
            {
                rawPath: 'src/main.pb',
                fsPath: '', // not used by writer
                config: { load: true, scan: false, panel: true, warn: false },
            },
            {
                rawPath: 'include/util.pbi',
                fsPath: '',
            },
        ],
        targets: [
            {
                name: 'Default',
                enabled: true,
                isDefault: true,
                directory: 'build',
                inputFile: { rawPath: 'src/main.pb', fsPath: '' },
                outputFile: { rawPath: 'bin/out.exe', fsPath: '' },
                executable: { rawPath: 'bin/out.exe', fsPath: '' },
                // Intentionally unsorted keys to validate deterministic attribute ordering.
                // Note: false-valued options are NOT written to XML (writer only serializes truthy
                // values when no optionsAttrs are present), so they will be absent after roundtrip.
                options: { optimize: false, debugger: true, unicode: true },
                compilerVersion: '6.20',
                commandLine: '-D TEST=1',
                subsystem: 'console',
                purifier: { enabled: true, granularity: '2' },
                format: { key2: 'b', key1: 'a' }, // intentionally unsorted
                icon: { enabled: true, rawPath: 'assets/app.ico', fsPath: '' },
                constants: [
                    { enabled: true, value: 'FOO=1' },
                    { enabled: false, value: 'BAR="x"' },
                    { enabled: false, value: '' },
                ],
            },
        ],
        libraries: ['User32.lib', 'Kernel32.lib', 'User32.lib'],
    };
}

function makeProjectVariantB(): WritableProject {
    // Same semantic content as A, but different insertion order for objects.
    const options: Record<string, boolean> = {};
    options['unicode'] = true;
    options['debugger'] = true;
    options['optimize'] = false;

    const format: Record<string, string> = {};
    format['key1'] = 'a';
    format['key2'] = 'b';

    return {
        config: {
            closefiles: true,
            openmode: 1,
            name: 'My Project',
            comment: 'Hello & <World> "quotes" \'apos\'',
        },
        data: {
            lastopen: { host: 'devbox', user: 'me', date: '2026-03-02' },
            log: { show: true },
            explorer: { pattern: 3, view: 'tree' },
        },
        files: [
            {
                rawPath: 'src/main.pb',
                fsPath: '',
                config: { warn: false, panel: true, scan: false, load: true }, // different insertion order
            },
            {
                rawPath: 'include/util.pbi',
                fsPath: '',
            },
        ],
        targets: [
            {
                name: 'Default',
                enabled: true,
                isDefault: true,
                directory: 'build',
                inputFile: { rawPath: 'src/main.pb', fsPath: '' },
                outputFile: { rawPath: 'bin/out.exe', fsPath: '' },
                executable: { rawPath: 'bin/out.exe', fsPath: '' },
                options,
                compilerVersion: '6.20',
                commandLine: '-D TEST=1',
                subsystem: 'console',
                purifier: { enabled: true, granularity: '2' },
                format,
                icon: { enabled: true, rawPath: 'assets/app.ico', fsPath: '' },
                constants: [
                    { enabled: true, value: 'FOO=1' },
                    { enabled: false, value: 'BAR="x"' },
                    { enabled: false, value: '' },
                ],
            },
        ],
        libraries: ['User32.lib', 'Kernel32.lib', 'User32.lib'],
    };
}

// --------------------------------------------------------------------------------------
// Writer tests (model object → XML → parse)
// --------------------------------------------------------------------------------------

describe('PBP writer', () => {
    test('roundtrip: write -> parse reproduces expected structure', () => {
        const projectFile = path.resolve('tmp', 'demo', 'project.pbp');
        const projectDir  = path.dirname(projectFile);

        const input = makeProjectVariantA();
        const xml   = writePbpProjectText(input, { newline: '\n' });

        const parsed = parsePbpProjectText(xml, projectFile);
        expect(parsed).not.toBeNull();
        if (!parsed) return;

        // Config
        expect(parsed.config.name).toBe(input.config.name);
        expect(parsed.config.comment).toBe(input.config.comment);
        expect(parsed.config.closefiles).toBe(true);
        expect(parsed.config.openmode).toBe(1);

        // Data
        expect(parsed.data.explorer?.view).toBe('tree');
        expect(parsed.data.explorer?.pattern).toBe(3);
        expect(parsed.data.log?.show).toBe(true);
        expect(parsed.data.lastopen?.date).toBe('2026-03-02');
        expect(parsed.data.lastopen?.user).toBe('me');
        expect(parsed.data.lastopen?.host).toBe('devbox');

        // Files
        expect(parsed.files.map(f => f.rawPath)).toEqual(['src/main.pb', 'include/util.pbi']);
        // toMatchObject: parser adds attrs field from the serialized <config .../> attributes.
        expect(parsed.files[0].config).toMatchObject({ load: true, scan: false, panel: true, warn: false });
        expect(parsed.files[1].config).toBeUndefined();

        // Path resolution stays inside projectDir
        expect(parsed.files[0].fsPath).toBe(path.resolve(projectDir, 'src/main.pb'));
        expect(parsed.files[1].fsPath).toBe(path.resolve(projectDir, 'include/util.pbi'));

        // Libraries (dedup, keep order)
        expect(parsed.libraries).toEqual(['User32.lib', 'Kernel32.lib']);

        // Targets
        expect(parsed.targets).toHaveLength(1);
        const t = parsed.targets[0];

        expect(t.name).toBe('Default');
        expect(t.enabled).toBe(true);
        expect(t.isDefault).toBe(true);
        expect(t.directory).toBe('build');

        expect(t.inputFile.rawPath).toBe('src/main.pb');
        expect(t.outputFile.rawPath).toBe('bin/out.exe');
        expect(t.executable.rawPath).toBe('bin/out.exe');

        expect(t.compilerVersion).toBe('6.20');
        expect(t.commandLine).toBe('-D TEST=1');
        expect(t.subsystem).toBe('console');

        // toMatchObject: parser adds attrs field from the serialized <purifier .../> attributes.
        expect(t.purifier).toMatchObject({ enabled: true, granularity: '2' });

        // Writer only serializes truthy options when no optionsAttrs are present,
        // so optimize: false is not written and is absent after roundtrip.
        expect(t.options).toEqual({ debugger: true, unicode: true });

        expect(t.format).toEqual({ key1: 'a', key2: 'b' });

        expect(t.icon).toBeDefined();
        expect(t.icon?.enabled).toBe(true);
        expect(t.icon?.rawPath).toBe('assets/app.ico');

        expect(t.constants).toEqual([
            { enabled: true, value: 'FOO=1' },
            { enabled: false, value: 'BAR="x"' },
            { enabled: false, value: '' },
        ]);
    });

    test('deterministic output: equivalent objects produce identical XML', () => {
        const xmlA = writePbpProjectText(makeProjectVariantA(), { newline: '\n' });
        const xmlB = writePbpProjectText(makeProjectVariantB(), { newline: '\n' });
        expect(xmlA).toBe(xmlB);
    });

    test('deterministic output: repeated writes are identical', () => {
        const p    = makeProjectVariantA();
        const xml1 = writePbpProjectText(p, { newline: '\n' });
        const xml2 = writePbpProjectText(p, { newline: '\n' });
        expect(xml1).toBe(xml2);
    });
});

// --------------------------------------------------------------------------------------
// Parser / writer roundtrip tests (XML → parse → write → parse)
// --------------------------------------------------------------------------------------

describe('PBP parser/writer roundtrip', () => {
    test('parses and writes compiler options / compile-run (TestProject)', () => {
        const xml = normalizeNl(`<?xml version="1.0" encoding="UTF-8"?>

<project xmlns="http://www.purebasic.com/namespace" version="1.0" creator="PureBasic 6.30 (Windows - x86)">
  <section name="config">
    <options closefiles="1" openmode="0" name="New Test Project"/>
    <comment>This is a Test File for Project Parsing</comment>
  </section>
  <section name="data">
    <explorer view="D:\\Documents\\PureBasic\\Projects\\" pattern="0"/>
    <log show="1"/>
    <lastopen date="2026-03-03 08:37" user="CalDymos" host="RT"/>
  </section>
  <section name="files">
    <file name="test_basic.pb">
      <config load="0" scan="1" panel="1" warn="1" lastopen="0" sortindex="999" panelstate="+"/>
      <fingerprint md5="2e2bac725f2717a204c84689834ec931"/>
    </file>
  </section>
  <section name="targets">
    <target name="default" enabled="1" default="1">
      <inputfile value="test_basic.pb"/>
      <outputfile value="c:\\out\\output.exe"/>
      <compiler version="PureBasic 6.30 (Windows - x86)"/>
      <commandline value="-d -z -u"/>
      <directory value="d:\\runexec\\"/>
      <options asm="1" thread="1" xpskin="1" user="1" dpiaware="1" dllprotection="1" shareducrt="1" onerror="1" debug="1" optimizer="1"/>
      <purifier enable="1"/>
      <temporaryexe value="source"/>
      <subsystem value="subSytemName"/>
      <linker value="c:\\optfiles\\optionfile.txt"/>
      <icon enable="1">c:\\icon\\favicon.ico</icon>
      <format exe="console" cpu="0"/>
      <debugger custom="1" type="ide"/>
      <warnings custom="1" type="ignore"/>
      <compilecount enable="1" value="0"/>
      <buildcount enable="1" value="0"/>
      <execonstant enable="1"/>
    </target>
  </section>
</project>
`);

        const projectFile = '/tmp/TestProject.pbp';
        const proj = parsePbpProjectText(xml, projectFile);
        expect(proj).not.toBeNull();
        if (!proj) return;

        expect(proj.meta?.projectAttrs?.xmlns).toBe('http://www.purebasic.com/namespace');
        expect(proj.config.name).toBe('New Test Project');
        expect(proj.config.closefiles).toBe(true);
        expect(proj.config.openmode).toBe(0);

        expect(proj.targets).toHaveLength(1);
        const t = proj.targets[0];

        expect(t.directory).toBe('d:\\runexec\\');
        expect(t.outputFile.rawPath).toBe('c:\\out\\output.exe');
        expect(t.outputFile.fsPath).toBe(path.win32.normalize('c:\\out\\output.exe'));
        expect(t.compilerVersion).toBe('PureBasic 6.30 (Windows - x86)');
        expect(t.commandLine).toBe('-d -z -u');
        expect(t.temporaryExe).toBe('source');
        expect(t.linker?.fsPath).toBe(path.win32.normalize('c:\\optfiles\\optionfile.txt'));
        expect(t.icon?.fsPath).toBe(path.win32.normalize('c:\\icon\\favicon.ico'));
        expect(t.debugger?.type).toBe('ide');
        expect(t.warnings?.type).toBe('ignore');
        expect(t.compileCount?.enabled).toBe(true);
        expect(t.buildCount?.enabled).toBe(true);
        expect(t.exeConstant?.enabled).toBe(true);

        const out = writePbpProjectText(proj);
        expect(out).toContain('<project xmlns="http://www.purebasic.com/namespace" version="1.0" creator="PureBasic 6.30 (Windows - x86)">');
        expect(out).toContain('<directory value="d:\\runexec\\"/>');
        expect(out).toContain('<linker value="c:\\optfiles\\optionfile.txt"/>');

        const proj2 = parsePbpProjectText(out, projectFile);
        expect(proj2).not.toBeNull();
        if (!proj2) return;

        const t2 = proj2.targets[0];
        expect(t2.directory).toBe('d:\\runexec\\');
        expect(t2.outputFile.rawPath).toBe('c:\\out\\output.exe');
        expect(t2.outputFile.fsPath).toBe(path.win32.normalize('c:\\out\\output.exe'));
        expect(t2.warnings?.type).toBe('ignore');
    });

    test('preserves versioninfo / resources / watchlist and omits absent sections', () => {
        const xml = normalizeNl(`<?xml version="1.0" encoding="UTF-8"?>

<project xmlns="http://www.purebasic.com/namespace" version="1.0" creator="PureBasic 6.30 (Windows - x86)">
  <section name="config">
    <options closefiles="1" openmode="0" name="TestProject1"/>
  </section>
  <section name="targets">
    <target name="Standard-Ziel" enabled="1" default="1">
      <inputfile value="main.pb"/>
      <outputfile value="..\\build\\TestProject1.exe"/>
      <compiler version="PureBasic 6.30 (Windows - x86)"/>
      <executable value="..\\build\\TestProject1.exe"/>
      <options onerror="1" debug="1" optimizer="1"/>
      <purifier enable="0" granularity="1,1,1,1"/>
      <temporaryexe value="source"/>
      <warnings custom="1" type="display"/>
      <compilecount enable="1" value="2907"/>
      <buildcount enable="1" value="140"/>
      <versioninfo enable="1">
        <field0 value="0,7,%COMPILECOUNT,%BUILDCOUNT"/>
        <field5 value="0.7.%COMPILECOUNT - %mm/%dd/%yyyy"/>
        <field16 value="VFT_APP"/>
      </versioninfo>
      <resources>
        <resource value="resources\\windows\\manifest\\resource.rc"/>
      </resources>
      <watchlist>GL::bSearchDlgOpen</watchlist>
    </target>
  </section>
</project>
`);

        const projectFile = '/tmp/TestProject1.pbp';
        const proj = parsePbpProjectText(xml, projectFile);
        expect(proj).not.toBeNull();
        if (!proj) return;

        // Config: comment element is absent → meta.hasComment is false.
        expect(proj.config.meta?.hasComment).toBe(false);
        // Parser only sets true for present sections; absent sections are not in the map.
        expect(proj.meta?.presentSections?.libraries).toBeFalsy();

        const t = proj.targets[0];
        // directory is stored in meta.targetAttrs only when it was a <target> attribute; here it is absent.
        expect(t.meta?.targetAttrs?.directory).toBeUndefined();
        expect(t.versionInfo?.enabled).toBe(true);
        expect(t.versionInfo?.fields).toHaveLength(3);
        expect(t.resources?.[0]).toBe('resources\\windows\\manifest\\resource.rc');
        expect(t.watchList).toBe('GL::bSearchDlgOpen');

        const out = writePbpProjectText(proj);
        expect(out).toContain('<project xmlns="http://www.purebasic.com/namespace" version="1.0" creator="PureBasic 6.30 (Windows - x86)">');
        expect(out).not.toContain('<section name="libraries">');
        expect(out).not.toContain('<comment>');
        expect(out).not.toContain('directory=""');

        const proj2 = parsePbpProjectText(out, projectFile);
        expect(proj2).not.toBeNull();
        if (!proj2) return;

        const t2 = proj2.targets[0];
        expect(t2.versionInfo?.fields.find(f => f.id === 'field0')?.value).toBe('0,7,%COMPILECOUNT,%BUILDCOUNT');
        expect(t2.resources?.[0]).toBe('resources\\windows\\manifest\\resource.rc');
        expect(t2.watchList).toBe('GL::bSearchDlgOpen');
    });
});