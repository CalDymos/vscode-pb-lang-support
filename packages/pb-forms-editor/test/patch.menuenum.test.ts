import test from "node:test";
import assert from "node:assert/strict";
import type { TextDocument } from "vscode";

import { parseFormDocument } from "../src/core/parser/form-parser";
import { MENU_ENTRY_KIND } from "../src/core/model";
import {
  applyImageInsert,
  applyMenuEntryDelete,
  applyMenuEntryInsert,
  applyMenuEntryUpdate,
  type MenuEntryArgs,
} from "../src/core/emitter/patch-emitter";
import { FakeTextDocument } from "./helpers/fakeTextDocument";
import { applyWorkspaceEditToText } from "./helpers/applyWorkspaceEdit";
import { loadFixture } from "./helpers/loadFixture";
import { stripBomAndToLf } from "./helpers/testUtils";

function patchAndReparse(
  text: string,
  editFactory: (document: TextDocument) =>
    | ReturnType<typeof applyMenuEntryInsert>
    | ReturnType<typeof applyMenuEntryUpdate>
    | ReturnType<typeof applyMenuEntryDelete>
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

function patchTwiceAndReparse(
  text: string,
  firstEditFactory: (document: TextDocument) => ReturnType<typeof applyImageInsert>,
  secondEditFactory: (document: TextDocument) => ReturnType<typeof applyMenuEntryInsert>
) {
  const firstDocument = new FakeTextDocument(text);
  const firstEdit = firstEditFactory(firstDocument.asTextDocument());
  assert.ok(firstEdit, "Expected first WorkspaceEdit result.");
  const firstPatchedText = applyWorkspaceEditToText(text, firstEdit!);

  const secondDocument = new FakeTextDocument(firstPatchedText);
  const secondEdit = secondEditFactory(secondDocument.asTextDocument());
  assert.ok(secondEdit, "Expected second WorkspaceEdit result.");
  const patchedText = applyWorkspaceEditToText(firstPatchedText, secondEdit!);

  return {
    patchedText,
    parsed: parseFormDocument(patchedText),
  };
}

test("inserts FormMenu before custom gadget initialisation when missing", () => {
  const text = loadFixture("fixtures/roundtrip/43-menuenum-custom-gadget-base.pbf");

  const args: MenuEntryArgs = {
    kind: MENU_ENTRY_KIND.MenuItem,
    idRaw: "#MenuSave",
    textRaw: '"Save"',
  };

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyMenuEntryInsert(document, "0", args)
  );

  assert.match(
    patchedText,
    /Enumeration FormGadget\r?\n  #Editor\r?\nEndEnumeration\r?\n\r?\nEnumeration FormMenu\r?\n  #MenuSave\r?\nEndEnumeration\r?\n\r?\n; 0 Custom gadget initialisation/
  );
  assert.equal(parsed.menus[0]?.entries.some((entry) => entry.idRaw === "#MenuSave"), true);
});

test("removes an empty FormMenu block when deleting the last menu symbol", () => {
  const text = loadFixture("fixtures/roundtrip/45-menuenum-basic-single-symbol.pbf");

  const parsed = parseFormDocument(text);
  const target = parsed.menus[0]?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem && entry.idRaw === "#MenuSave");
  const sourceLine = target?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for menu item.");

  const { patchedText } = patchAndReparse(text, (document) =>
    applyMenuEntryDelete(document, "0", sourceLine!, MENU_ENTRY_KIND.MenuItem)
  );

  assert.doesNotMatch(patchedText, /Enumeration FormMenu/);
  assert.doesNotMatch(patchedText, /#MenuSave/);
});

test("updates FormMenu symbols when renaming the only menu id", () => {
  const text = loadFixture("fixtures/roundtrip/45-menuenum-basic-single-symbol.pbf");

  const parsed = parseFormDocument(text);
  const target = parsed.menus[0]?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem && entry.idRaw === "#MenuSave");
  const sourceLine = target?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for menu item.");

  const args: MenuEntryArgs = {
    kind: MENU_ENTRY_KIND.MenuItem,
    idRaw: "#MenuStore",
    textRaw: '"Save"',
  };

  const { patchedText } = patchAndReparse(text, (document) =>
    applyMenuEntryUpdate(document, "0", sourceLine!, args)
  );

  assert.match(patchedText, /Enumeration FormMenu\r?\n  #MenuStore\r?\nEndEnumeration/);
  assert.doesNotMatch(patchedText, /Enumeration FormMenu\r?\n  #MenuSave/);
  assert.match(patchedText, /MenuItem\(#MenuStore, "Save"\)/);
});

test("inserts the first menu icon block before the image decoder and upgrades CreateMenu to CreateImageMenu", () => {
  const text = loadFixture("fixtures/roundtrip/46-menuenum-before-image-block.pbf");

  const args: MenuEntryArgs = {
    kind: MENU_ENTRY_KIND.MenuItem,
    idRaw: "#MenuSave",
    textRaw: '"Save"',
    iconRaw: "ImageID(Img_FrmMain_0)",
  };

  const { patchedText, parsed } = patchTwiceAndReparse(
    text,
    (document) => applyImageInsert(document, {
      inline: false,
      idRaw: "#PB_Any",
      assignedVar: "Img_FrmMain_0",
      imageRaw: '"FileSave.png"',
    }),
    (document) => applyMenuEntryInsert(document, "0", args)
  );

  const normalized = stripBomAndToLf(patchedText);
  const expected = [
    '; Form Designer for PureBasic - 6.40',
    '; Warning: this file uses a strict syntax, if you edit it, make sure to respect the Form Designer limitation or it won\'t be opened again.',
    '',
    ';',
    '; This code is automatically generated by the Form Designer.',
    '; Manual modification is possible to adjust existing commands, but anything else will be dropped when the code is compiled.',
    '; Event procedures need to be put in another source file.',
    ';',
    '',
    'Global FrmMain',
    '',
    'Global Img_FrmMain_0',
    '',
    'Enumeration FormMenu',
    '  #MenuSave',
    'EndEnumeration',
    '',
    'UsePNGImageDecoder()',
    '',
    'Img_FrmMain_0 = LoadImage(#PB_Any,"FileSave.png")',
    '',
    'Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 200)',
    '  FrmMain = OpenWindow(#PB_Any, x, y, width, height, "Menu")',
    '  CreateImageMenu(0, WindowID(FrmMain))',
    '  MenuTitle("File")',
    '  MenuItem(#MenuSave, "Save", ImageID(Img_FrmMain_0))',
    'EndProcedure',
    '',
    '',
  ].join("\n");
  assert.equal(normalized, expected);
  assert.ok(parsed.menus[0]?.entries.some((entry) => entry.idRaw === "#MenuSave"));
  assert.ok(parsed.images.some((entry) => entry.id === "Img_FrmMain_0"));
});

test("inserts FormMenu before an existing FormFont block when no window or gadget enum is present", () => {
  const text = loadFixture("fixtures/roundtrip/47-menuenum-before-font-block.pbf");

  const args: MenuEntryArgs = {
    kind: MENU_ENTRY_KIND.MenuItem,
    idRaw: "#MenuSave",
    textRaw: '"Save"',
  };

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyMenuEntryInsert(document, "0", args)
  );

  const normalized = stripBomAndToLf(patchedText);
  assert.ok(normalized.includes([
    "Global FrmMain",
    "",
    "Global Editor1",
    "",
    "Enumeration FormMenu",
    "  #MenuSave",
    "EndEnumeration",
    "",
    "Enumeration FormFont",
    "  #Font_FrmMain_0",
    "EndEnumeration",
  ].join("\n")));
  assert.match(patchedText, /MenuItem\(#MenuSave, "Save"\)/);
  assert.ok(parsed.menus[0]?.entries.some((entry) => entry.idRaw === "#MenuSave"));
});

test("inserts FormMenu before image decoder lines when no enum anchor exists yet", () => {
  const text = loadFixture("fixtures/roundtrip/48-menuenum-before-image-decoder.pbf");

  const args: MenuEntryArgs = {
    kind: MENU_ENTRY_KIND.MenuItem,
    idRaw: "#MenuSave",
    textRaw: '"Save"',
  };

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyMenuEntryInsert(document, "0", args)
  );

  const normalized = stripBomAndToLf(patchedText);
  assert.ok(normalized.includes([
    "Global FrmMain",
    "",
    "Global ImgButton",
    "",
    "Global Img_FrmMain_0",
    "",
    "Enumeration FormMenu",
    "  #MenuSave",
    "EndEnumeration",
    "",
    "UsePNGImageDecoder()",
  ].join("\n")));
  assert.match(patchedText, /CreateMenu\(0, WindowID\(FrmMain\)\)/);
  assert.match(patchedText, /MenuItem\(#MenuSave, "Save"\)/);
  assert.ok(parsed.menus[0]?.entries.some((entry) => entry.idRaw === "#MenuSave"));
});

test("downgrades CreateImageMenu to CreateMenu when the last menu icon is removed", () => {
  const text = `; Form Designer for PureBasic - 6.40
Enumeration FormMenu
  #MenuSave
EndEnumeration

Enumeration FormImage
  #ImgSave
EndEnumeration

UsePNGImageDecoder()

LoadImage(#ImgSave,"save.png")

Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 200)
  OpenWindow(#FrmMain, x, y, width, height, "Menu")
  CreateImageMenu(0, WindowID(#FrmMain))
  MenuTitle("File")
  MenuItem(#MenuSave, "Save", ImageID(#ImgSave))
EndProcedure
`;

  const parsed = parseFormDocument(text);
  const target = parsed.menus[0]?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem && entry.idRaw === "#MenuSave");
  const sourceLine = target?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for menu item.");

  const { patchedText, parsed: updated } = patchAndReparse(text, (document) =>
    applyMenuEntryUpdate(document, "0", sourceLine!, {
      kind: MENU_ENTRY_KIND.MenuItem,
      idRaw: "#MenuSave",
      textRaw: '"Save"',
    })
  );

  const updatedTarget = updated.menus[0]?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem && entry.idRaw === "#MenuSave");
  assert.match(patchedText, /CreateMenu\(0, WindowID\(#FrmMain\)\)/);
  assert.doesNotMatch(patchedText, /CreateImageMenu\(/);
  assert.match(patchedText, /MenuItem\(#MenuSave, "Save"\)/);
  assert.equal(updatedTarget?.iconRaw, undefined);
  assert.equal(updatedTarget?.iconId, undefined);
});
