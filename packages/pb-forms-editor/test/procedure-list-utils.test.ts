import test from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import {
  extractProcedureNamesFromText,
  findFirstProcedureLine,
  findProcedureBlock,
  findProcedureBlockByName,
  parseProcedureHeaderLine
} from "../src/core/parser/procedure-scanner";
import { parseGlobalVarNames } from "../src/core/parser/global-scanner";
import {
  resolveFixedProcedureSourcePaths,
  resolveProcedureEventFilePath,
  sortUniqueProcedureNames
} from "../src/core/procedures/list";

test('extractProcedureNamesFromText returns real procedures and skips macros/comments', () => {
  const names = extractProcedureNamesFromText(`
; Procedure CommentedOut()
Macro Dummy()
  Procedure MacroProc()
EndMacro
Procedure.s HandleFrmMain(Event, Window)
Procedure HandleApply()
ProcedureDLL HandleDll()
ProcedureC HandleC(EventType)
`);

  assert.deepEqual(names, ['HandleFrmMain', 'HandleApply', 'HandleDll', 'HandleC']);
});

test('parseProcedureHeaderLine extracts the procedure name and source range from supported headers', () => {
  const header = '  ProcedureDLL.s HandleDll(arg)';
  const parsed = parseProcedureHeaderLine(header);

  assert.deepEqual(parsed, {
    name: 'HandleDll',
    nameStart: header.indexOf('HandleDll'),
    nameEnd: header.indexOf('HandleDll') + 'HandleDll'.length
  });
});

test('sortUniqueProcedureNames deduplicates case-insensitively and sorts alphabetically', () => {
  const names = sortUniqueProcedureNames(['HandleZ', 'handlea', 'HandleA', 'HandleM']);
  assert.deepEqual(names, ['handlea', 'HandleM', 'HandleZ']);
});

test('resolveProcedureEventFilePath resolves relative event files against the form document directory', () => {
  const documentPath = path.normalize('/workspace/forms/sample.pbf');
  const eventPath = resolveProcedureEventFilePath(documentPath, 'events/form-events.pbi');
  const expected = path.resolve(path.dirname(documentPath), 'events/form-events.pbi');

  assert.equal(eventPath, expected);
});

test('resolveFixedProcedureSourcePaths returns only the document and optional event file for form documents', () => {
  const documentPath = path.normalize('/workspace/forms/sample.pbf');
  const paths = resolveFixedProcedureSourcePaths(documentPath, 'events/form-events.pbi');
  const expected = [path.resolve(path.dirname(documentPath), 'events/form-events.pbi')].sort();

  assert.deepEqual(paths, expected);
});

test('resolveFixedProcedureSourcePaths returns the PB document itself plus the optional event file', () => {
  const documentPath = path.normalize('/workspace/forms/sample.pb');
  const paths = resolveFixedProcedureSourcePaths(documentPath, 'events/form-events.pbi');
  const expected = [
    path.normalize(documentPath),
    path.resolve(path.dirname(documentPath), 'events/form-events.pbi')
  ].sort();

  assert.deepEqual(paths, expected);
});


test('findProcedureBlock and related helpers resolve supported procedure ranges from plain lines', () => {
  const lines = [
    'Global foo',
    'ProcedureDLL.s HandleDll(arg)',
    '  Debug arg',
    'EndProcedure',
    '',
    'Procedure HandlePlain()',
    'EndProcedure'
  ];

  assert.equal(findFirstProcedureLine(lines), 1);
  assert.deepEqual(findProcedureBlock(lines, 2), { startLine: 1, endLine: 3 });
  assert.deepEqual(findProcedureBlockByName(lines, 'HandlePlain'), { startLine: 5, endLine: 6 });
});


test('parseGlobalVarNames returns trimmed Global declarations and ignores other lines', () => {
  assert.deepEqual(parseGlobalVarNames('Global foo,   bar.baz , qux$'), ['foo', 'bar.baz', 'qux$']);
  assert.deepEqual(parseGlobalVarNames('  Define foo'), []);
});
