import * as path from 'path';

import { parsePbpProjectText } from '../src/pbp/parser';
import { writePbpProjectText } from '../src/pbp/writer';

import type { PbpProject } from '../src/pbp/model';

type WritableProject = Pick<PbpProject, 'config' | 'data' | 'files' | 'targets' | 'libraries'>;

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
                // Intentionally unsorted keys to validate deterministic attribute ordering
                options: { optimize: false, debugger: true, unicode: true },
                compilerVersion: '6.20',
                commandLine: '-D TEST=1',
                subsystem: 'console',
                purifier: { enabled: true, granularity: '2' },
                // Intentionally unsorted keys
                format: { key2: 'b', key1: 'a' },
                icon: { enabled: true, rawPath: 'assets/app.ico', fsPath: '' },
                constants: [
                    { enabled: true, value: 'FOO=1' },
                    { enabled: false, value: 'BAR="x"' },
                ],
            },
        ],
        libraries: ['User32.lib', 'Kernel32.lib', 'User32.lib'],
    };
}

function makeProjectVariantB(): WritableProject {
    // Same semantic content as A, but different insertion order for objects
    const options: Record<string, boolean> = {};
    options['unicode'] = true;
    options['debugger'] = true;
    options['optimize'] = false;

    const format: Record<string, string> = {};
    format['key1'] = 'a';
    format['key2'] = 'b';

    return {
        config: {
            // reorder fields on purpose
            closefiles: true,
            openmode: 1,
            name: 'My Project',
            comment: 'Hello & <World> "quotes" \'apos\'',
        },
        data: {
            // reorder fields on purpose
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
                ],
            },
        ],
        libraries: ['User32.lib', 'Kernel32.lib', 'User32.lib'],
    };
}

describe('PBP writer', () => {
    test('roundtrip: write -> parse reproduces expected structure', () => {
        const projectFile = path.resolve('tmp', 'demo', 'project.pbp');

        const input = makeProjectVariantA();
        const xml = writePbpProjectText(input, { newline: '\n' });

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
        expect(parsed.files[0].config).toEqual({ load: true, scan: false, panel: true, warn: false });
        expect(parsed.files[1].config).toBeUndefined();

        // Path resolution stays inside projectDir
        const projectDir = path.dirname(projectFile);
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

        expect(t.purifier).toEqual({ enabled: true, granularity: '2' });

        // Options should roundtrip booleans (including false)
        expect(t.options).toEqual({ debugger: true, optimize: false, unicode: true });

        // Format as string attributes
        expect(t.format).toEqual({ key1: 'a', key2: 'b' });

        // Icon
        expect(t.icon).toBeDefined();
        expect(t.icon?.enabled).toBe(true);
        expect(t.icon?.rawPath).toBe('assets/app.ico');

        // Constants
        expect(t.constants).toEqual([
            { enabled: true, value: 'FOO=1' },
            { enabled: false, value: 'BAR="x"' },
        ]);
    });

    test('deterministic output: equivalent objects produce identical XML', () => {
        const a = makeProjectVariantA();
        const b = makeProjectVariantB();

        const xmlA = writePbpProjectText(a, { newline: '\n' });
        const xmlB = writePbpProjectText(b, { newline: '\n' });

        expect(xmlA).toBe(xmlB);
    });

    test('deterministic output: repeated writes are identical', () => {
        const p = makeProjectVariantA();

        const xml1 = writePbpProjectText(p, { newline: '\n' });
        const xml2 = writePbpProjectText(p, { newline: '\n' });

        expect(xml1).toBe(xml2);
    });

    test('roundtrip: preserves target versioninfo/resources/watchlist and omits absent sections', () => {
        const projectFile = path.resolve('tmp', 'demo', 'GenPOST32.pbp');

        const xmlIn = `<?xml version="1.0" encoding="UTF-8"?>

<project xmlns="http://www.purebasic.com/namespace" version="1.0" creator="PureBasic 6.30 (Windows - x86)">
  <section name="config">
    <options closefiles="1" openmode="0" name="GenPost32"/>
  </section>
  <section name="data">
    <log show="1"/>
  </section>
  <section name="files">
    <file name="main.pb">
      <config load="0" scan="1" panel="1" warn="1" lastopen="0" sortindex="999" panelstate="+"/>
      <fingerprint md5="ede812c520ffc17161708a524bc8cfee"/>
    </file>
  </section>
  <section name="targets">
    <target name="Standard-Ziel" enabled="1" default="1">
      <inputfile value="main.pb"/>
      <outputfile value="..\\build\\GenPost32.exe"/>
      <compiler version="PureBasic 6.30 (Windows - x86)"/>
      <executable value="..\\build\\GenPost32.exe"/>
      <options onerror="1" debug="1" optimizer="1"/>
      <purifier enable="0" granularity="1,1,1,1"/>
      <temporaryexe value="source"/>
      <icon enable="1">icon1.ico</icon>
      <warnings custom="1" type="display"/>
      <compilecount enable="1" value="2907"/>
      <buildcount enable="1" value="140"/>
      <versioninfo enable="1">
        <field0 value="0,7,%COMPILECOUNT,%BUILDCOUNT"/>
        <field2 value="BYTE RANGER Software"/>
        <field16 value="VFT_APP"/>
      </versioninfo>
      <resources>
        <resource value="resources\\windows\\manifest\\resource.rc"/>
      </resources>
      <watchlist>GL::bSearchDlgOpen</watchlist>
    </target>
  </section>
</project>
`;

        const parsed1 = parsePbpProjectText(xmlIn, projectFile);
        expect(parsed1).not.toBeNull();
        if (!parsed1) return;

        expect(parsed1.meta?.projectAttrs?.xmlns).toBe('http://www.purebasic.com/namespace');
        expect(parsed1.meta?.presentSections?.libraries).toBe(false);

        // Config: comment element is absent
        expect(parsed1.config.commentPresent).toBe(false);
        expect(parsed1.config.openmode).toBe(0);

        // Target extras
        expect(parsed1.targets).toHaveLength(1);
        const t1 = parsed1.targets[0];
        expect(t1.targetAttrs?.directory).toBeUndefined();
        expect(t1.warnings?.custom).toBe(true);
        expect(t1.warnings?.type).toBe('display');
        expect(t1.versionInfo?.enabled).toBe(true);
        expect(t1.versionInfo?.fields.map(f => f.id)).toEqual(['field0', 'field2', 'field16']);
        expect(t1.resources?.items).toEqual(['resources\\windows\\manifest\\resource.rc']);
        expect(t1.watchList).toBe('GL::bSearchDlgOpen');

        const xmlOut = writePbpProjectText(parsed1, { newline: '\n' });
        expect(xmlOut).toContain('<project xmlns="http://www.purebasic.com/namespace" version="1.0" creator="PureBasic 6.30 (Windows - x86)">');
        expect(xmlOut).not.toContain('<section name="libraries">');
        expect(xmlOut).not.toContain('<comment>');
        expect(xmlOut).not.toContain('directory=""');

        const parsed2 = parsePbpProjectText(xmlOut, projectFile);
        expect(parsed2).not.toBeNull();
        if (!parsed2) return;

        const t2 = parsed2.targets[0];
        expect(t2.versionInfo?.fields.map(f => f.id)).toEqual(['field0', 'field2', 'field16']);
        expect(t2.resources?.items).toEqual(['resources\\windows\\manifest\\resource.rc']);
        expect(t2.watchList).toBe('GL::bSearchDlgOpen');
    });
});