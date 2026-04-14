import test from "node:test";
import assert from "node:assert/strict";
import type { TextDocument } from "vscode";

import { parseFormDocument } from "../src/core/parser/form-parser";
import {
  applyImageDelete,
  applyImageInsert,
  applyImageUpdate,
  type ImageArgs,
} from "../src/core/emitter/patch-emitter";
import { FakeTextDocument } from "./helpers/fakeTextDocument";
import { applyWorkspaceEditToText } from "./helpers/applyWorkspaceEdit";

function patchAndReparse(
  text: string,
  editFactory: (document: TextDocument) =>
    | ReturnType<typeof applyImageInsert>
    | ReturnType<typeof applyImageUpdate>
    | ReturnType<typeof applyImageDelete>
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

test("inserts the first image block before the font block and injects the required decoder", () => {
  const text = `; Form Designer for PureBasic - 6.30

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormFont
  #Font_FrmMain_0
EndEnumeration

LoadFont(#Font_FrmMain_0,"Arial", 10)

Procedure OpenFrmMain(x = 0, y = 0, width = 220, height = 140)
  OpenWindow(#FrmMain, x, y, width, height, "Images")
EndProcedure
`;

  const args: ImageArgs = {
    inline: false,
    idRaw: "#ImgMainLogo",
    imageRaw: '"logo.png"',
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) => applyImageInsert(document, args));

  const image = parsed.images.find((entry) => entry.id === "#ImgMainLogo");
  assert.ok(image, "Expected inserted image entry.");
  assert.equal(image?.image, "logo.png");
  assert.match(
    patchedText,
    /UsePNGImageDecoder\(\)\r?\n\r?\nLoadImage\(#ImgMainLogo, "logo\.png"\)\r?\n\r?\nEnumeration FormFont/s
  );
  assert.doesNotMatch(
    patchedText,
    /Procedure OpenFrmMain[\s\S]*UsePNGImageDecoder\(\)/s
  );
});

test("removes the decoder together with the last remaining image in the block", () => {
  const text = `; Form Designer for PureBasic - 6.30

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormImage
  #ImgMainLogo
EndEnumeration

UsePNGImageDecoder()

LoadImage(#ImgMainLogo,"logo.png")

Procedure OpenFrmMain(x = 0, y = 0, width = 220, height = 140)
  OpenWindow(#FrmMain, x, y, width, height, "Images")
EndProcedure
`;

  const parsed = parseFormDocument(text);
  const sourceLine = parsed.images.find((entry) => entry.id === "#ImgMainLogo")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected image source line.");

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) => applyImageDelete(document, sourceLine!));

  assert.equal(updated.images.length, 0);
  assert.doesNotMatch(patchedText, /UsePNGImageDecoder\(\)/);
  assert.doesNotMatch(patchedText, /LoadImage\(#ImgMainLogo, "logo\.png"\)/);
  assert.match(patchedText, /Procedure OpenFrmMain\(/);
});

test("updates image metadata through the shared image-value parser for escaped literals", () => {
  const text = `; Form Designer for PureBasic - 6.30

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormImage
  #ImgMainLogo
EndEnumeration

UsePNGImageDecoder()

LoadImage(#ImgMainLogo,"logo.png")

Procedure OpenFrmMain(x = 0, y = 0, width = 220, height = 140)
  OpenWindow(#FrmMain, x, y, width, height, "Images")
EndProcedure
`;

  const parsed = parseFormDocument(text);
  const sourceLine = parsed.images.find((entry) => entry.id === "#ImgMainLogo")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected image source line.");

  const args: ImageArgs = {
    inline: false,
    idRaw: "#ImgMainLogo",
    imageRaw: '~"icons/""main"".png"',
  };

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) => applyImageUpdate(document, sourceLine!, args));

  const image = updated.images.find((entry) => entry.id === "#ImgMainLogo");
  assert.ok(image, "Expected updated image entry.");
  assert.equal(image?.image, 'icons/"main".png');
  assert.match(patchedText, /LoadImage\(#ImgMainLogo, ~"icons\/""main""\.png"\)/);
});

test("rebuilds the decoder lines when the image file type changes", () => {
  const text = `; Form Designer for PureBasic - 6.30

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormImage
  #ImgMainLogo
EndEnumeration

UsePNGImageDecoder()

LoadImage(#ImgMainLogo,"logo.png")

Procedure OpenFrmMain(x = 0, y = 0, width = 220, height = 140)
  OpenWindow(#FrmMain, x, y, width, height, "Images")
EndProcedure
`;

  const parsed = parseFormDocument(text);
  const sourceLine = parsed.images.find((entry) => entry.id === "#ImgMainLogo")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected image source line.");

  const args: ImageArgs = {
    inline: false,
    idRaw: "#ImgMainLogo",
    imageRaw: '"logo.jpg"',
  };

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) => applyImageUpdate(document, sourceLine!, args));

  const image = updated.images.find((entry) => entry.id === "#ImgMainLogo");
  assert.ok(image, "Expected updated image entry.");
  assert.equal(image?.image, "logo.jpg");
  assert.match(patchedText, /UseJPEGImageDecoder\(\)/);
  assert.doesNotMatch(patchedText, /UsePNGImageDecoder\(\)/);
  assert.match(patchedText, /LoadImage\(#ImgMainLogo, "logo\.jpg"\)/);
});


test("creates an Enumeration FormImage block when inserting the first enum image", () => {
  const text = `; Form Designer for PureBasic - 6.30

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormMenu
  #MenuMain
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 220, height = 140)
  OpenWindow(#FrmMain, x, y, width, height, "Images")
EndProcedure
`;

  const args: ImageArgs = {
    inline: false,
    idRaw: "#ImgMainLogo",
    imageRaw: '"logo.png"',
  };

  const { patchedText } = patchAndReparse(text, (document) => applyImageInsert(document, args));
  const normalized = toLf(patchedText);

  assert.ok(normalized.includes(
    [
      'Enumeration FormMenu',
      '  #MenuMain',
      'EndEnumeration',
      '',
      'Enumeration FormImage',
      '  #ImgMainLogo',
      'EndEnumeration',
      '',
      'UsePNGImageDecoder()',
      '',
      'LoadImage(#ImgMainLogo, "logo.png")',
    ].join("\n")
  ));
  assert.doesNotMatch(patchedText, /^Global\s+/m);
});

test("creates a Global image variable block when inserting the first pbAny image", () => {
  const text = `; Form Designer for PureBasic - 6.30

Enumeration FormWindow
  #FrmMain
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 220, height = 140)
  OpenWindow(#FrmMain, x, y, width, height, "Images")
EndProcedure
`;

  const args: ImageArgs = {
    inline: false,
    idRaw: "#PB_Any",
    assignedVar: "ImgMainLogo",
    imageRaw: '"logo.png"',
  };

  const { patchedText } = patchAndReparse(text, (document) => applyImageInsert(document, args));
  const normalized = toLf(patchedText);

  assert.ok(normalized.includes(['Global ImgMainLogo', '', 'Enumeration FormWindow'].join("\n")));
  assert.match(patchedText, /ImgMainLogo = LoadImage\(#PB_Any, "logo\.png"\)/);
  assert.doesNotMatch(patchedText, /Enumeration FormImage/);
});

test("moves image declarations from FormImage to Global when toggling the last enum image to pbAny", () => {
  const text = `; Form Designer for PureBasic - 6.30

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormImage
  #ImgMainLogo
EndEnumeration

UsePNGImageDecoder()

LoadImage(#ImgMainLogo,"logo.png")

Procedure OpenFrmMain(x = 0, y = 0, width = 220, height = 140)
  OpenWindow(#FrmMain, x, y, width, height, "Images")
EndProcedure
`;

  const parsed = parseFormDocument(text);
  const sourceLine = parsed.images.find((entry) => entry.id === "#ImgMainLogo")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected image source line.");

  const { patchedText } = patchAndReparse(text, (document) => applyImageUpdate(document, sourceLine!, {
    inline: false,
    idRaw: "#PB_Any",
    assignedVar: "ImgMainLogo",
    imageRaw: '"logo.png"',
  }));
  const normalized = toLf(patchedText);

  assert.ok(normalized.includes(['Global ImgMainLogo', '', 'Enumeration FormWindow'].join("\n")));
  assert.ok(!normalized.includes(['Enumeration FormImage', '  #ImgMainLogo', 'EndEnumeration'].join("\n")));
  assert.match(patchedText, /ImgMainLogo = LoadImage\(#PB_Any, "logo\.png"\)/);
});

test("moves image declarations from Global to FormImage when toggling the last pbAny image to enum mode", () => {
  const text = `; Form Designer for PureBasic - 6.30

Global ImgMainLogo

Enumeration FormWindow
  #FrmMain
EndEnumeration

UsePNGImageDecoder()

ImgMainLogo = LoadImage(#PB_Any,"logo.png")

Procedure OpenFrmMain(x = 0, y = 0, width = 220, height = 140)
  OpenWindow(#FrmMain, x, y, width, height, "Images")
EndProcedure
`;

  const parsed = parseFormDocument(text);
  const sourceLine = parsed.images.find((entry) => entry.id === "ImgMainLogo")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected image source line.");

  const { patchedText } = patchAndReparse(text, (document) => applyImageUpdate(document, sourceLine!, {
    inline: false,
    idRaw: "#ImgMainLogo",
    imageRaw: '"logo.png"',
  }));
  const normalized = toLf(patchedText);

  assert.ok(!/^Global ImgMainLogo$/m.test(patchedText));
  assert.ok(normalized.includes([
    'Enumeration FormWindow',
    '  #FrmMain',
    'EndEnumeration',
    '',
    'Enumeration FormImage',
    '  #ImgMainLogo',
    'EndEnumeration',
  ].join("\n")));
  assert.match(patchedText, /LoadImage\(#ImgMainLogo, "logo\.png"\)/);
});

test("inserts an enum image block before Declare and XIncludeFile boundaries", () => {
  const text = `; Form Designer for PureBasic - 6.30

Enumeration FormWindow
  #FrmMain
EndEnumeration

Declare ResizeGadgetsFrmMain()
XIncludeFile "events/form-main.pbi"
Procedure OpenFrmMain(x = 0, y = 0, width = 220, height = 140)
  OpenWindow(#FrmMain, x, y, width, height, "Images")
EndProcedure
`;

  const args: ImageArgs = {
    inline: false,
    idRaw: "#ImgMainLogo",
    imageRaw: '"logo.png"',
  };

  const { patchedText } = patchAndReparse(text, (document) => applyImageInsert(document, args));
  const normalized = toLf(patchedText);

  assert.ok(normalized.includes([
    'Enumeration FormImage',
    '  #ImgMainLogo',
    'EndEnumeration',
    '',
    'UsePNGImageDecoder()',
    '',
    'LoadImage(#ImgMainLogo, "logo.png")',
    '',
    'Declare ResizeGadgetsFrmMain()',
    'XIncludeFile "events/form-main.pbi"',
  ].join("\n")));
});


test("inserts an Enumeration FormImage block before custom gadget initialisation", () => {
  const text = `; Form Designer for PureBasic - 6.30

; 0 Custom gadget initialisation (do Not remove this line)
InitScintillaBridge()

XIncludeFile "events/form-main.pbi"
Procedure OpenFrmMain(x = 0, y = 0, width = 220, height = 140)
  OpenWindow(#PB_Any, x, y, width, height, "Images")
EndProcedure
`;

  const args: ImageArgs = {
    inline: false,
    idRaw: "#ImgMainLogo",
    imageRaw: '"logo.png"',
  };

  const { patchedText } = patchAndReparse(text, (document) => applyImageInsert(document, args));
  const normalized = toLf(patchedText);

  assert.ok(normalized.includes([
    'Enumeration FormImage',
    '  #ImgMainLogo',
    'EndEnumeration',
    '',
    '; 0 Custom gadget initialisation (do Not remove this line)',
    'InitScintillaBridge()',
  ].join("\n")));
  assert.ok(normalized.includes([
    'UsePNGImageDecoder()',
    '',
    'LoadImage(#ImgMainLogo, "logo.png")',
    '',
    'XIncludeFile "events/form-main.pbi"',
  ].join("\n")));
});


test("moves FormImage before custom gadget initialisation when toggling the last pbAny image to enum mode", () => {
  const text = `; Form Designer for PureBasic - 6.30

Global ImgMainLogo

; 0 Custom gadget initialisation (do Not remove this line)
InitScintillaBridge()

ImgMainLogo = LoadImage(#PB_Any, "logo.png")

XIncludeFile "events/form-main.pbi"
Procedure OpenFrmMain(x = 0, y = 0, width = 220, height = 140)
  OpenWindow(#PB_Any, x, y, width, height, "Images")
EndProcedure
`;

  const sourceLine = text.split(/\r?\n/).findIndex((line) => line.includes('ImgMainLogo = LoadImage(#PB_Any, "logo.png")'));
  assert.notEqual(sourceLine, -1, 'Expected pbAny image line.');

  const { patchedText } = patchAndReparse(text, (document) => applyImageUpdate(document, sourceLine, {
    inline: false,
    idRaw: '#ImgMainLogo',
    imageRaw: '"logo.png"',
  }));
  const normalized = toLf(patchedText);

  assert.ok(normalized.includes([
    'Enumeration FormImage',
    '  #ImgMainLogo',
    'EndEnumeration',
    '',
    '; 0 Custom gadget initialisation (do Not remove this line)',
    'InitScintillaBridge()',
  ].join("\n")));
  assert.doesNotMatch(patchedText, /^Global\s+ImgMainLogo\s*$/m);
  assert.match(patchedText, /LoadImage\(#ImgMainLogo, "logo\.png"\)/);
});


test("inserts a pbAny image Global block before custom gadget initialisation", () => {
  const text = `; Form Designer for PureBasic - 6.30

; 0 Custom gadget initialisation (do Not remove this line)
InitScintillaBridge()

XIncludeFile "events/form-main.pbi"
Procedure OpenFrmMain(x = 0, y = 0, width = 220, height = 140)
  win = OpenWindow(#PB_Any, x, y, width, height, "Images")
EndProcedure
`;

  const args: ImageArgs = {
    inline: false,
    idRaw: "#PB_Any",
    assignedVar: "ImgMainLogo",
    imageRaw: '"logo.png"',
  };

  const { patchedText } = patchAndReparse(text, (document) => applyImageInsert(document, args));
  const normalized = toLf(patchedText);

  assert.ok(normalized.includes([
    'Global ImgMainLogo',
    '',
    '; 0 Custom gadget initialisation (do Not remove this line)',
    'InitScintillaBridge()',
  ].join("\n")));
  assert.ok(normalized.includes([
    'ImgMainLogo = LoadImage(#PB_Any, "logo.png")',
    '',
    'XIncludeFile "events/form-main.pbi"',
  ].join("\n")));
});

test("inserts a pbAny image Global block before Declare and XIncludeFile boundaries", () => {
  const text = `; Form Designer for PureBasic - 6.30

Enumeration FormWindow
  #FrmMain
EndEnumeration

Declare ResizeGadgetsFrmMain()
XIncludeFile "events/form-main.pbi"
Procedure OpenFrmMain(x = 0, y = 0, width = 220, height = 140)
  OpenWindow(#FrmMain, x, y, width, height, "Images")
EndProcedure
`;

  const args: ImageArgs = {
    inline: false,
    idRaw: "#PB_Any",
    assignedVar: "ImgMainLogo",
    imageRaw: '"logo.png"',
  };

  const { patchedText } = patchAndReparse(text, (document) => applyImageInsert(document, args));
  const normalized = toLf(patchedText);

  assert.ok(normalized.includes([
    'Global ImgMainLogo',
    '',
    'Enumeration FormWindow',
  ].join("\n")));
  assert.ok(normalized.includes([
    'ImgMainLogo = LoadImage(#PB_Any, "logo.png")',
    '',
    'Declare ResizeGadgetsFrmMain()',
    'XIncludeFile "events/form-main.pbi"',
  ].join("\n")));
});

test("keeps a single blank line before FormFont when updating an existing image block", () => {
  const text = `; Form Designer for PureBasic - 6.30

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormImage
  #ImgMainLogo
EndEnumeration

UsePNGImageDecoder()

LoadImage(#ImgMainLogo,"logo.png")

Enumeration FormFont
  #Font_FrmMain_0
EndEnumeration

LoadFont(#Font_FrmMain_0,"Arial", 10)

Procedure OpenFrmMain(x = 0, y = 0, width = 220, height = 140)
  OpenWindow(#FrmMain, x, y, width, height, "Images")
EndProcedure
`;

  const parsed = parseFormDocument(text);
  const sourceLine = parsed.images.find((entry) => entry.id === "#ImgMainLogo")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected image source line.");

  const { patchedText } = patchAndReparse(text, (document) => applyImageUpdate(document, sourceLine!, {
    inline: false,
    idRaw: "#ImgMainLogo",
    imageRaw: '"logo.jpg"',
  }));

  const normalized = toLf(patchedText);
  assert.ok(normalized.includes([
    'LoadImage(#ImgMainLogo, "logo.jpg")',
    '',
    'Enumeration FormFont',
  ].join("\n")));
  assert.ok(!normalized.includes([
    'LoadImage(#ImgMainLogo, "logo.jpg")',
    '',
    '',
    'Enumeration FormFont',
  ].join("\n")));
});

test("keeps a single blank line before FormFont when deleting the last image block", () => {
  const text = `; Form Designer for PureBasic - 6.30

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormImage
  #ImgMainLogo
EndEnumeration

UsePNGImageDecoder()

LoadImage(#ImgMainLogo,"logo.png")

Enumeration FormFont
  #Font_FrmMain_0
EndEnumeration

LoadFont(#Font_FrmMain_0,"Arial", 10)

Procedure OpenFrmMain(x = 0, y = 0, width = 220, height = 140)
  OpenWindow(#FrmMain, x, y, width, height, "Images")
EndProcedure
`;

  const parsed = parseFormDocument(text);
  const sourceLine = parsed.images.find((entry) => entry.id === "#ImgMainLogo")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected image source line.");

  const { patchedText } = patchAndReparse(text, (document) => applyImageDelete(document, sourceLine!));

  const normalized = toLf(patchedText);
  assert.ok(normalized.includes([
    'EndEnumeration',
    '',
    'Enumeration FormFont',
  ].join("\n")));
  assert.ok(!normalized.includes([
    'EndEnumeration',
    '',
    '',
    'Enumeration FormFont',
  ].join("\n")));
});
