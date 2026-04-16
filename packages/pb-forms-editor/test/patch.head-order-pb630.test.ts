import test from "node:test";
import assert from "node:assert/strict";
import type { TextDocument } from "vscode";

import { parseFormDocument } from "../src/core/parser/form-parser";
import {
  applyFontInsert,
  applyImageInsert,
  applyMenuEntryInsert,
  type FontArgs,
  type ImageArgs,
  type MenuEntryArgs,
} from "../src/core/emitter/patch-emitter";
import { MENU_ENTRY_KIND } from "../src/core/model";
import { FakeTextDocument } from "./helpers/fakeTextDocument";
import { applyWorkspaceEditToText } from "./helpers/applyWorkspaceEdit";
import { loadFixture } from "./helpers/loadFixture";

function patchOnce(
  text: string,
  editFactory: (document: TextDocument) =>
    | ReturnType<typeof applyMenuEntryInsert>
    | ReturnType<typeof applyImageInsert>
    | ReturnType<typeof applyFontInsert>
) {
  const document = new FakeTextDocument(text);
  const edit = editFactory(document.asTextDocument());
  assert.ok(edit, "Expected a WorkspaceEdit result.");
  return applyWorkspaceEditToText(text, edit!);
}

function toLf(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

test("preserves the PB 6.30 top-level head order across menu, image and font insertions", () => {
  const text = loadFixture("fixtures/roundtrip/67-head-order-combined-base.pbf");

  const menuArgs: MenuEntryArgs = {
    kind: MENU_ENTRY_KIND.MenuItem,
    idRaw: "#MenuSave",
    textRaw: '"Save"',
  };

  const imageArgs: ImageArgs = {
    inline: false,
    idRaw: "#ImgMainLogo",
    imageRaw: '"logo.png"',
  };

  const fontArgs: FontArgs = {
    idRaw: "#FontMain",
    nameRaw: '"Arial"',
    sizeRaw: "10",
    flagsRaw: "#PB_Font_Bold",
  };

  const withMenu = patchOnce(text, (document) => applyMenuEntryInsert(document, "0", menuArgs));
  const withImage = patchOnce(withMenu, (document) => applyImageInsert(document, imageArgs));
  const patchedText = patchOnce(withImage, (document) => applyFontInsert(document, fontArgs));
  const normalized = toLf(patchedText);
  const parsed = parseFormDocument(patchedText);

  const orderedMarkers = [
    'Enumeration FormWindow',
    'Enumeration FormGadget',
    'Enumeration FormMenu',
    'Enumeration FormImage',
    'UsePNGImageDecoder()',
    'LoadImage(#ImgMainLogo, "logo.png")',
    'Enumeration FormFont',
    'LoadFont(#FontMain, "Arial", 10, #PB_Font_Bold)',
    'Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 200)',
    '  CreateMenu(0, WindowID(#FrmMain))',
    '  MenuTitle("File")',
    '  MenuItem(#MenuSave, "Save")',
    '  ScintillaGadget(#Editor, 10, 10, 300, 120, @Callback_Scintilla_0())',
  ];

  let lastIndex = -1;
  for (const marker of orderedMarkers) {
    const index = normalized.indexOf(marker);
    assert.notEqual(index, -1, `Expected marker not found: ${marker}`);
    assert.ok(index > lastIndex, `Expected marker order after previous block: ${marker}`);
    lastIndex = index;
  }

  assert.equal(normalized.includes("InitEditorGadget()"), false);
  assert.equal(normalized.includes("ProcedureDLL EditorCallbackGadget, *scinotify.SCNotification)"), false);

  assert.ok(parsed.menus[0]?.entries.some((entry) => entry.idRaw === "#MenuSave"));
  assert.ok(parsed.images.some((entry) => entry.id === "#ImgMainLogo"));
  assert.ok(parsed.fonts.some((entry) => entry.id === "#FontMain"));
});
