import test from "node:test";
import assert from "node:assert/strict";
import type { TextDocument } from "vscode";

import { parseFormDocument } from "../src/core/parser/form-parser";
import {
  applyFontDelete,
  applyFontInsert,
  applyFontUpdate,
  type FontArgs,
} from "../src/core/emitter/patch-emitter";
import { FakeTextDocument } from "./helpers/fakeTextDocument";
import { applyWorkspaceEditToText } from "./helpers/applyWorkspaceEdit";
import { loadFixture } from "./helpers/loadFixture";

function patchAndReparse(
  text: string,
  editFactory: (document: TextDocument) =>
    | ReturnType<typeof applyFontInsert>
    | ReturnType<typeof applyFontUpdate>
    | ReturnType<typeof applyFontDelete>
) {
  const document = new FakeTextDocument(text);
  const edit = editFactory(document.asTextDocument());
  assert.ok(edit, "Expected a WorkspaceEdit result.");
  const patchedText = applyWorkspaceEditToText(text, edit!);
  return {
    patchedText,
    parsed: parseFormDocument(patchedText),
  };
}

function toLf(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

test("parses top-level FormFont declarations from the PB 6.30 fixture", () => {
  const text = loadFixture("fixtures/roundtrip/29-fontblock-top-level-parse.pbf");

  const parsed = parseFormDocument(text);
  const font = parsed.fonts.find((entry) => entry.id === "#Font_FrmMain_0");

  assert.ok(font, "Expected parsed top-level font entry.");
  assert.equal(font?.name, "Arial");
  assert.equal(font?.size, 10);
  assert.equal(font?.flagsRaw, "#PB_Font_Bold");
});

test("inserts the first enum font block after the image block and before the procedure", () => {
  const text = loadFixture("fixtures/roundtrip/30-fontblock-before-procedure-after-image.pbf");

  const args: FontArgs = {
    idRaw: "#Font_FrmMain_0",
    nameRaw: '"Arial"',
    sizeRaw: "10",
    flagsRaw: "#PB_Font_Bold",
  };

  const { patchedText, parsed } = patchAndReparse(text, (document) => applyFontInsert(document, args));
  const normalized = toLf(patchedText);
  const font = parsed.fonts.find((entry) => entry.id === "#Font_FrmMain_0");

  assert.ok(font, "Expected inserted font entry.");
  assert.ok(normalized.includes([
    'LoadImage(#ImgMainLogo, "logo.png")',
    '',
    'Enumeration FormFont',
    '  #Font_FrmMain_0',
    'EndEnumeration',
    '',
    'LoadFont(#Font_FrmMain_0, "Arial", 10, #PB_Font_Bold)',
    '',
    'Procedure OpenFrmMain',
  ].join("\n")));
});

test("creates a Global font variable block when inserting the first pbAny font", () => {
  const text = loadFixture("fixtures/roundtrip/31-fontblock-basic-no-fonts.pbf");

  const args: FontArgs = {
    idRaw: "#PB_Any",
    assignedVar: "FontMain",
    nameRaw: '"Arial"',
    sizeRaw: "10",
  };

  const { patchedText } = patchAndReparse(text, (document) => applyFontInsert(document, args));
  const normalized = toLf(patchedText);

  assert.ok(normalized.includes([
    'FontMain = LoadFont(#PB_Any, "Arial", 10)',
    '',
    'Procedure OpenFrmMain',
  ].join("\n")));
  assert.doesNotMatch(patchedText, /Enumeration FormFont/);
});

test("moves font declarations from FormFont to Global when toggling the last enum font to pbAny", () => {
  const text = loadFixture("fixtures/roundtrip/32-fontblock-enum-single.pbf");

  const parsed = parseFormDocument(text);
  const sourceLine = parsed.fonts.find((entry) => entry.id === "#Font_FrmMain_0")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected font source line.");

  const args: FontArgs = {
    idRaw: "#PB_Any",
    assignedVar: "FontMain",
    nameRaw: '"Arial"',
    sizeRaw: "10",
  };

  const { patchedText } = patchAndReparse(text, (document) => applyFontUpdate(document, sourceLine!, args));
  const normalized = toLf(patchedText);

  assert.doesNotMatch(patchedText, /^Global\s+FontMain$/m);
  assert.ok(!normalized.includes(['Enumeration FormFont', '  #Font_FrmMain_0', 'EndEnumeration'].join("\n")));
  assert.match(patchedText, /FontMain = LoadFont\(#PB_Any, "Arial", 10\)/);
});

test("moves font declarations from Global to FormFont when toggling the last pbAny font to enum mode", () => {
  const text = loadFixture("fixtures/roundtrip/33-fontblock-pbany-single.pbf");

  const parsed = parseFormDocument(text);
  const sourceLine = parsed.fonts.find((entry) => entry.id === "FontMain")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected font source line.");

  const args: FontArgs = {
    idRaw: "#Font_FrmMain_0",
    nameRaw: '"Arial"',
    sizeRaw: "10",
    flagsRaw: "#PB_Font_Italic",
  };

  const { patchedText } = patchAndReparse(text, (document) => applyFontUpdate(document, sourceLine!, args));
  const normalized = toLf(patchedText);

  assert.ok(normalized.includes([
    'Enumeration FormFont',
    '  #Font_FrmMain_0',
    'EndEnumeration',
  ].join("\n")));
  assert.doesNotMatch(patchedText, /^Global FontMain$/m);
  assert.match(patchedText, /LoadFont\(#Font_FrmMain_0, "Arial", 10, #PB_Font_Italic\)/);
});

test("inserts an enum font block before Declare and XIncludeFile boundaries", () => {
  const text = loadFixture("fixtures/roundtrip/34-fontblock-boundary-declare-xinclude.pbf");

  const args: FontArgs = {
    idRaw: "#Font_FrmMain_0",
    nameRaw: '"Arial"',
    sizeRaw: "10",
    flagsRaw: "#PB_Font_Bold",
  };

  const { patchedText } = patchAndReparse(text, (document) => applyFontInsert(document, args));
  const normalized = toLf(patchedText);

  assert.ok(normalized.includes([
    'Enumeration FormFont',
    '  #Font_FrmMain_0',
    'EndEnumeration',
    '',
    'LoadFont(#Font_FrmMain_0, "Arial", 10, #PB_Font_Bold)',
    '',
    'Declare ResizeGadgetsFrmMain()',
    'XIncludeFile "events/form-main.pbi"',
  ].join("\n")));
});

test("inserts a pbAny font Global block before Declare and XIncludeFile boundaries", () => {
  const text = loadFixture("fixtures/roundtrip/34-fontblock-boundary-declare-xinclude.pbf");

  const args: FontArgs = {
    idRaw: "#PB_Any",
    assignedVar: "FontMain",
    nameRaw: '"Arial"',
    sizeRaw: "10",
  };

  const { patchedText } = patchAndReparse(text, (document) => applyFontInsert(document, args));
  const normalized = toLf(patchedText);

  assert.doesNotMatch(patchedText, /^Global\s+FontMain$/m);
  assert.ok(normalized.includes([
    'FontMain = LoadFont(#PB_Any, "Arial", 10)',
    '',
    'Declare ResizeGadgetsFrmMain()',
    'XIncludeFile "events/form-main.pbi"',
  ].join("\n")));
});

test("keeps a single blank line before Declare when updating an existing font block", () => {
  const text = loadFixture("fixtures/roundtrip/35-fontblock-before-declare-single-blank-line.pbf");

  const parsed = parseFormDocument(text);
  const sourceLine = parsed.fonts.find((entry) => entry.id === "#Font_FrmMain_0")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected font source line.");

  const { patchedText } = patchAndReparse(text, (document) => applyFontUpdate(document, sourceLine!, {
    idRaw: "#Font_FrmMain_0",
    nameRaw: '"Arial"',
    sizeRaw: "12",
  }));

  const normalized = toLf(patchedText);
  assert.ok(normalized.includes([
    'LoadFont(#Font_FrmMain_0, "Arial", 12)',
    '',
    'Declare ResizeGadgetsFrmMain()',
  ].join("\n")));
  assert.ok(!normalized.includes([
    'LoadFont(#Font_FrmMain_0, "Arial", 12)',
    '',
    '',
    'Declare ResizeGadgetsFrmMain()',
  ].join("\n")));
});

test("keeps a single blank line before Declare when deleting the last font block", () => {
  const text = loadFixture("fixtures/roundtrip/35-fontblock-before-declare-single-blank-line.pbf");

  const parsed = parseFormDocument(text);
  const sourceLine = parsed.fonts.find((entry) => entry.id === "#Font_FrmMain_0")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected font source line.");

  const { patchedText } = patchAndReparse(text, (document) => applyFontDelete(document, sourceLine!));

  const normalized = toLf(patchedText);
  assert.ok(normalized.includes([
    'EndEnumeration',
    '',
    'Declare ResizeGadgetsFrmMain()',
  ].join("\n")));
  assert.ok(!normalized.includes([
    'EndEnumeration',
    '',
    '',
    'Declare ResizeGadgetsFrmMain()',
  ].join("\n")));
});

test("inserts an enum font block after custom gadget initialisation and before Declare", () => {
  const text = loadFixture("fixtures/roundtrip/36-fontblock-custom-gadget-base.pbf");

  const args: FontArgs = {
    idRaw: '#Font_FrmMain_0',
    nameRaw: '"Arial"',
    sizeRaw: '10',
    flagsRaw: '#PB_Font_Bold',
  };

  const document = new FakeTextDocument(text);
  const edit = applyFontInsert(document.asTextDocument(), args);
  assert.ok(edit, 'Expected font insert edit.');

  const patchedText = applyWorkspaceEditToText(text, edit!);
  const normalized = toLf(patchedText);

  assert.ok(normalized.includes([
    '; 0 Custom gadget initialisation (do Not remove this line)',
    'InitScintillaBridge()',
    '',
    'Enumeration FormFont',
    '  #Font_FrmMain_0',
    'EndEnumeration',
    '',
    'LoadFont(#Font_FrmMain_0, "Arial", 10, #PB_Font_Bold)',
    '',
    'Declare ResizeGadgetsFrmMain()',
  ].join("\n")));
});

test("inserts a pbAny font load block after custom gadget initialisation and before Declare", () => {
  const text = loadFixture("fixtures/roundtrip/36-fontblock-custom-gadget-base.pbf");

  const args: FontArgs = {
    idRaw: '#PB_Any',
    assignedVar: 'FontMain',
    nameRaw: '"Arial"',
    sizeRaw: '10',
    flagsRaw: '#PB_Font_Bold',
  };

  const document = new FakeTextDocument(text);
  const edit = applyFontInsert(document.asTextDocument(), args);
  assert.ok(edit, 'Expected font insert edit.');

  const patchedText = applyWorkspaceEditToText(text, edit!);
  const normalized = toLf(patchedText);

  assert.ok(normalized.includes([
    '; 0 Custom gadget initialisation (do Not remove this line)',
    'InitScintillaBridge()',
    '',
    'FontMain = LoadFont(#PB_Any, "Arial", 10, #PB_Font_Bold)',
    '',
    'Declare ResizeGadgetsFrmMain()',
  ].join("\n")));
});

test("inserts an enum font block after custom gadget initialisation even without preceding enums", () => {
  const text = loadFixture("fixtures/roundtrip/37-fontblock-custom-gadget-window-assignment.pbf");

  const args: FontArgs = {
    idRaw: '#Font_FrmMain_0',
    nameRaw: '"Arial"',
    sizeRaw: '10',
    flagsRaw: '#PB_Font_Bold',
  };

  const document = new FakeTextDocument(text);
  const edit = applyFontInsert(document.asTextDocument(), args);
  assert.ok(edit, 'Expected font insert edit.');

  const patchedText = applyWorkspaceEditToText(text, edit!);
  const normalized = toLf(patchedText);

  assert.ok(normalized.includes([
    '; 0 Custom gadget initialisation (do Not remove this line)',
    'InitScintillaBridge()',
    '',
    'Enumeration FormFont',
    '  #Font_FrmMain_0',
    'EndEnumeration',
    '',
    'LoadFont(#Font_FrmMain_0, "Arial", 10, #PB_Font_Bold)',
    '',
    'Declare ResizeGadgetsFrmMain()',
  ].join("\n")));
});

test("inserts a pbAny font load block after custom gadget initialisation even without preceding enums", () => {
  const text = loadFixture("fixtures/roundtrip/37-fontblock-custom-gadget-window-assignment.pbf");

  const args: FontArgs = {
    idRaw: '#PB_Any',
    assignedVar: 'FontMain',
    nameRaw: '"Arial"',
    sizeRaw: '10',
    flagsRaw: '#PB_Font_Bold',
  };

  const document = new FakeTextDocument(text);
  const edit = applyFontInsert(document.asTextDocument(), args);
  assert.ok(edit, 'Expected font insert edit.');

  const patchedText = applyWorkspaceEditToText(text, edit!);
  const normalized = toLf(patchedText);

  assert.ok(normalized.includes([
    '; 0 Custom gadget initialisation (do Not remove this line)',
    'InitScintillaBridge()',
    '',
    'FontMain = LoadFont(#PB_Any, "Arial", 10, #PB_Font_Bold)',
    '',
    'Declare ResizeGadgetsFrmMain()',
  ].join("\n")));
});
