import test from "node:test";
import assert from "node:assert/strict";
import type { TextDocument } from "vscode";

import { MenuEntryMovePlacement } from "../src/shared/menu";
import { parseFormDocument } from "../src/core/parser/form-parser";
import {
  applyStatusBarFieldMove,
  applyToolBarEntryMove,
} from "../src/core/emitter/patch-emitter";
import { TOOLBAR_ENTRY_KIND } from "../src/core/model";
import { FakeTextDocument } from "./helpers/fakeTextDocument";
import { applyWorkspaceEditToText } from "./helpers/applyWorkspaceEdit";
import { loadFixture } from "./helpers/loadFixture";

function patchAndReparse(
  text: string,
  editFactory: (document: TextDocument) => ReturnType<typeof applyToolBarEntryMove> | ReturnType<typeof applyStatusBarFieldMove>
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
const STATUSBAR_FIXTURE = loadFixture("fixtures/smoke/10-statusbar-basic.pbf");

test("moves toolbar image button blocks with their paired tooltip", () => {
  const parsed = parseFormDocument(TOOLBAR_FIXTURE);
  const toolBar = parsed.toolbars[0];
  const tbNew = toolBar?.entries.find(entry => entry.idRaw === "#TbNew");
  const tbSave = toolBar?.entries.find(entry => entry.idRaw === "#TbSave" && entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton);

  assert.equal(typeof tbNew?.source?.line, "number", "Expected #TbNew source line.");
  assert.equal(typeof tbSave?.source?.line, "number", "Expected #TbSave source line.");

  const { parsed: patched, patchedText } = patchAndReparse(TOOLBAR_FIXTURE, document =>
    applyToolBarEntryMove(document, "0", tbSave!.source!.line, TOOLBAR_ENTRY_KIND.ToolBarImageButton, {
      targetSourceLine: tbNew!.source!.line,
      placement: MenuEntryMovePlacement.Before,
    })
  );

  const entries = patched.toolbars[0]?.entries ?? [];
  assert.deepEqual(entries.map(entry => entry.kind), [
    TOOLBAR_ENTRY_KIND.ToolBarImageButton,
    TOOLBAR_ENTRY_KIND.ToolBarToolTip,
    TOOLBAR_ENTRY_KIND.ToolBarImageButton,
    TOOLBAR_ENTRY_KIND.ToolBarSeparator,
  ]);
  assert.equal(entries[0]?.idRaw, "#TbSave");
  assert.equal(entries[1]?.idRaw, "#TbSave");
  assert.equal(entries[1]?.text, "Save current form");
  assert.match(
    patchedText,
    /ToolBarImageButton\(#TbSave,ImageID\(#Img_FrmMain_1\), #PB_ToolBar_Toggle\)\r?\n\s*ToolBarToolTip\(0, #TbSave, "Save current form"\)\r?\n\s*ToolBarImageButton\(#TbNew,ImageID\(#Img_FrmMain_0\), #PB_ToolBar_Toggle\)/
  );
});

test("moves statusbar fields and rewrites decoration indices in list order", () => {
  const parsed = parseFormDocument(STATUSBAR_FIXTURE);
  const statusBar = parsed.statusbars[0];
  const firstField = statusBar?.fields[0];
  const lastField = statusBar?.fields[2];

  assert.equal(typeof firstField?.source?.line, "number", "Expected first statusbar field source line.");
  assert.equal(typeof lastField?.source?.line, "number", "Expected last statusbar field source line.");

  const { parsed: patched, patchedText } = patchAndReparse(STATUSBAR_FIXTURE, document =>
    applyStatusBarFieldMove(document, "0", lastField!.source!.line, {
      targetSourceLine: firstField!.source!.line,
      placement: MenuEntryMovePlacement.Before,
    })
  );

  const fields = patched.statusbars[0]?.fields ?? [];
  assert.equal(fields[0]?.imageId, "#Img_FrmMain_0");
  assert.equal(fields[1]?.text, "Ready");
  assert.equal(fields[2]?.progressBar, true);
  assert.match(patchedText, /AddStatusBarField\(#PB_Ignore\)\r?\n\s*StatusBarImage\(0, 0, ImageID\(#Img_FrmMain_0\), #PB_StatusBar_BorderLess\)/);
  assert.match(patchedText, /AddStatusBarField\(120\)\r?\n\s*StatusBarText\(0, 1, "Ready", #PB_StatusBar_Center\)/);
  assert.match(patchedText, /AddStatusBarField\(90\)\r?\n\s*StatusBarProgress\(0, 2, 0, #PB_StatusBar_Raised\)/);
});
