import test from "node:test";
import assert from "node:assert/strict";
import type { TextDocument } from "vscode";

import { parseFormDocument } from "../src/core/parser/form-parser";
import {
  applyToolBarEntryDelete,
  applyToolBarEntryInsert,
  applyToolBarEntryUpdate,
  type ToolBarEntryArgs,
} from "../src/core/emitter/patch-emitter";
import { TOOLBAR_ENTRY_KIND } from "../src/core/model";
import { FakeTextDocument } from "./helpers/fakeTextDocument";
import { applyWorkspaceEditToText } from "./helpers/applyWorkspaceEdit";
import { loadFixture } from "./helpers/loadFixture";

function patchAndReparse(
  text: string,
  editFactory: (document: TextDocument) =>
    | ReturnType<typeof applyToolBarEntryInsert>
    | ReturnType<typeof applyToolBarEntryUpdate>
    | ReturnType<typeof applyToolBarEntryDelete>
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

const TOOLBAR_FIXTURE = loadFixture("fixtures/smoke/09-toolbar-basic.pbf");

test("migrates legacy ToolBarButton inserts to the PB 6.30 image-button path", () => {
  const args: ToolBarEntryArgs = {
    kind: TOOLBAR_ENTRY_KIND.ToolBarButton,
    idRaw: "#TbOpen",
    iconRaw: "ImageID(#ImgOpen)",
    textRaw: '"Open file"',
  };

  const { parsed, patchedText } = patchAndReparse(TOOLBAR_FIXTURE, (document) =>
    applyToolBarEntryInsert(document, "0", args)
  );

  const toolBar = parsed.toolbars[0];
  assert.ok(toolBar, "Expected parsed toolbar.");
  const inserted = toolBar.entries.find((entry) => entry.idRaw === "#TbOpen");
  assert.ok(inserted, "Expected migrated toolbar entry.");
  assert.equal(inserted?.kind, TOOLBAR_ENTRY_KIND.ToolBarImageButton);
  assert.equal(inserted?.tooltip, "Open file");
  assert.doesNotMatch(patchedText, /ToolBarButton\(#TbOpen,/);
  assert.match(patchedText, /ToolBarImageButton\(#TbOpen, ImageID\(#ImgOpen\)\)/);
  assert.match(patchedText, /ToolBarToolTip\(0, #TbOpen, "Open file"\)/);
});


test("keeps toolbar image button without assigned image as zero instead of original empty ImageID call", () => {
  const args: ToolBarEntryArgs = {
    kind: TOOLBAR_ENTRY_KIND.ToolBarImageButton,
    idRaw: "#TbNoImage",
  };

  const { patchedText } = patchAndReparse(TOOLBAR_FIXTURE, (document) =>
    applyToolBarEntryInsert(document, "0", args)
  );

  assert.match(patchedText, /ToolBarImageButton\(#TbNoImage, 0\)/);
  assert.doesNotMatch(patchedText, /ToolBarImageButton\(#TbNoImage, ImageID\(\)\)/);
});

test("migrates legacy ToolBarStandardButton updates to ToolBarImageButton", () => {
  const text = `; Form Designer for PureBasic - 6.30

Enumeration FormWindow
  #FrmMain
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 200)
  OpenWindow(#FrmMain, x, y, width, height, "Toolbar", #PB_Window_SystemMenu)
  CreateToolbar(0, WindowID(#FrmMain))
  ToolBarStandardButton(#TbLegacy, ImageID(#ImgLegacy))
EndProcedure
`;

  const sourceLine = text.split(/\r?\n/).findIndex((line) => line.includes("ToolBarStandardButton"));
  assert.notEqual(sourceLine, -1, "Expected legacy toolbar line.");

  const args: ToolBarEntryArgs = {
    kind: TOOLBAR_ENTRY_KIND.ToolBarStandardButton,
    idRaw: "#TbLegacy",
    iconRaw: "ImageID(#ImgLegacyNew)",
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyToolBarEntryUpdate(document, "0", sourceLine, args)
  );

  const toolBar = parsed.toolbars[0];
  assert.ok(toolBar, "Expected parsed toolbar.");
  assert.equal(toolBar.entries[0]?.kind, TOOLBAR_ENTRY_KIND.ToolBarImageButton);
  assert.equal(toolBar.entries[0]?.iconId, "#ImgLegacyNew");
  assert.doesNotMatch(patchedText, /ToolBarStandardButton\(/);
  assert.match(patchedText, /ToolBarImageButton\(#TbLegacy, ImageID\(#ImgLegacyNew\)\)/);
});

test("removes the paired ToolBarToolTip when deleting a toolbar image button", () => {
  const doc = parseFormDocument(TOOLBAR_FIXTURE);
  const toolBar = doc.toolbars[0];
  const imageButton = toolBar?.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton && entry.idRaw === "#TbSave");
  const sourceLine = imageButton?.source?.line;

  assert.equal(typeof sourceLine, "number", "Expected source line for toolbar image button.");

  const { parsed, patchedText } = patchAndReparse(TOOLBAR_FIXTURE, (document) =>
    applyToolBarEntryDelete(document, "0", sourceLine!, TOOLBAR_ENTRY_KIND.ToolBarImageButton)
  );

  const updatedToolBar = parsed.toolbars[0];
  assert.ok(updatedToolBar, "Expected parsed toolbar after delete.");
  assert.equal(updatedToolBar.entries.some((entry) => entry.idRaw === "#TbSave"), false);
  assert.doesNotMatch(patchedText, /ToolBarImageButton\(#TbSave,/);
  assert.doesNotMatch(patchedText, /ToolBarToolTip\(0, #TbSave,/);
});

test("keeps the paired tooltip in sync when renaming a toolbar image button id", () => {
  const doc = parseFormDocument(TOOLBAR_FIXTURE);
  const toolBar = doc.toolbars[0];
  const imageButton = toolBar?.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton && entry.idRaw === "#TbSave");
  const sourceLine = imageButton?.source?.line;

  assert.equal(typeof sourceLine, "number", "Expected source line for toolbar image button.");

  const args: ToolBarEntryArgs = {
    kind: TOOLBAR_ENTRY_KIND.ToolBarImageButton,
    idRaw: "#TbSaveAs",
    iconRaw: "ImageID(#ImgSave)",
    toggle: false,
  };

  const { parsed, patchedText } = patchAndReparse(TOOLBAR_FIXTURE, (document) =>
    applyToolBarEntryUpdate(document, "0", sourceLine!, args)
  );

  const renamed = parsed.toolbars[0]?.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton && entry.idRaw === "#TbSaveAs");
  assert.ok(renamed, "Expected renamed toolbar image button.");
  assert.equal(renamed?.tooltip, "Save current form");
  assert.match(patchedText, /ToolBarImageButton\(#TbSaveAs, ImageID\(#ImgSave\)\)/);
  assert.match(patchedText, /ToolBarToolTip\(0, #TbSaveAs, "Save current form"\)/);
  assert.doesNotMatch(patchedText, /ToolBarToolTip\(0, #TbSave, "Save current form"\)/);
});
