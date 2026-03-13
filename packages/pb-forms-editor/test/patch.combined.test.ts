import test from "node:test";
import assert from "node:assert/strict";

import { parseFormDocument } from "../src/core/parser/formParser";
import {
  applyMenuEntryDelete,
  applyMenuEntryInsert,
  applyMenuEntryUpdate,
  applyStatusBarFieldDelete,
  applyStatusBarFieldInsert,
  applyStatusBarFieldUpdate,
  applyToolBarEntryDelete,
  applyToolBarEntryInsert,
  applyToolBarEntryUpdate,
  type MenuEntryArgs,
  type StatusBarFieldArgs,
  type ToolBarEntryArgs,
} from "../src/core/emitter/patchEmitter";
import { MENU_ENTRY_KIND, TOOLBAR_ENTRY_KIND } from "../src/core/model";
import { loadFixture } from "./helpers/loadFixture";
import { FakeTextDocument } from "./helpers/fakeTextDocument";
import { applyWorkspaceEditToText } from "./helpers/applyWorkspaceEdit";

// NOTE: TextDocument is imported as a type only — it is used as the parameter
// type of editFactory so that patch emitter functions (which expect vscode.TextDocument)
// are accepted without additional casts at each call site.
import type { TextDocument } from "vscode";

function patchAndReparse(
  text: string,
  editFactory: (document: TextDocument) =>
    | ReturnType<typeof applyMenuEntryInsert>
    | ReturnType<typeof applyMenuEntryUpdate>
    | ReturnType<typeof applyMenuEntryDelete>
    | ReturnType<typeof applyToolBarEntryInsert>
    | ReturnType<typeof applyToolBarEntryUpdate>
    | ReturnType<typeof applyToolBarEntryDelete>
    | ReturnType<typeof applyStatusBarFieldInsert>
    | ReturnType<typeof applyStatusBarFieldUpdate>
    | ReturnType<typeof applyStatusBarFieldDelete>
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

function parseFixture() {
  const text = loadFixture("fixtures/roundtrip/14-combined-regression.pbf");
  const parsed = parseFormDocument(text);
  const menu = parsed.menus.find((m) => m.id === "#MenuMain");
  const toolBar = parsed.toolbars.find((tb) => tb.id === "#TbMain");
  const statusBar = parsed.statusbars.find((sb) => sb.id === "#SbMain");

  assert.ok(menu, "Expected #MenuMain menu.");
  assert.ok(toolBar, "Expected #TbMain toolbar.");
  assert.ok(statusBar, "Expected #SbMain statusbar.");

  return { text, parsed, menu: menu!, toolBar: toolBar!, statusBar: statusBar! };
}

test("roundtrips menu entry insert", () => {
  const { text } = parseFixture();
  const args: MenuEntryArgs = {
    kind: MENU_ENTRY_KIND.MenuItem,
    idRaw: "#MnuSave",
    textRaw: '"Save"',
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyMenuEntryInsert(document, "#MenuMain", args)
  );

  const menu = parsed.menus.find((m) => m.id === "#MenuMain");
  assert.ok(menu, "Expected menu after insert.");
  assert.equal(menu!.entries.length, 4);
  assert.equal(menu!.entries[3]?.kind, MENU_ENTRY_KIND.MenuItem);
  assert.equal(menu!.entries[3]?.idRaw, "#MnuSave");
  assert.equal(menu!.entries[3]?.text, "Save");
  assert.match(patchedText, /MenuItem\(#MnuSave, "Save"\)/);
});

test("roundtrips menu entry update", () => {
  const { text, menu } = parseFixture();
  const sourceLine = menu.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem)?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for existing menu item.");

  const args: MenuEntryArgs = {
    kind: MENU_ENTRY_KIND.MenuItem,
    idRaw: "#MnuOpen",
    textRaw: '"Open File"',
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyMenuEntryUpdate(document, "#MenuMain", sourceLine!, args)
  );

  const updatedMenu = parsed.menus.find((m) => m.id === "#MenuMain");
  const updatedItem = updatedMenu?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem);
  assert.ok(updatedItem, "Expected updated menu item.");
  assert.equal(updatedItem?.text, "Open File");
  assert.match(patchedText, /MenuItem\(#MnuOpen, "Open File"\)/);
});

test("roundtrips menu entry delete", () => {
  const { text, menu } = parseFixture();
  const target = menu.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem);
  const sourceLine = target?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for existing menu item.");

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyMenuEntryDelete(document, "#MenuMain", sourceLine!, MENU_ENTRY_KIND.MenuItem)
  );

  const updatedMenu = parsed.menus.find((m) => m.id === "#MenuMain");
  assert.ok(updatedMenu, "Expected menu after delete.");
  assert.equal(updatedMenu!.entries.length, 2);
  assert.equal(updatedMenu!.entries.some((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem), false);
  assert.doesNotMatch(patchedText, /MenuItem\(#MnuOpen, "Open"\)/);
});

test("roundtrips toolbar entry insert", () => {
  const { text } = parseFixture();
  const args: ToolBarEntryArgs = {
    kind: TOOLBAR_ENTRY_KIND.ToolBarButton,
    idRaw: "#TbSync",
    iconRaw: "0",
    textRaw: '"Sync"',
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyToolBarEntryInsert(document, "#TbMain", args)
  );

  const toolBar = parsed.toolbars.find((tb) => tb.id === "#TbMain");
  assert.ok(toolBar, "Expected toolbar after insert.");
  assert.equal(toolBar!.entries.length, 3);
  assert.equal(toolBar!.entries[2]?.kind, TOOLBAR_ENTRY_KIND.ToolBarButton);
  assert.equal(toolBar!.entries[2]?.idRaw, "#TbSync");
  assert.equal(toolBar!.entries[2]?.text, "Sync");
  assert.match(patchedText, /ToolBarButton\(#TbSync, 0, "Sync"\)/);
});

test("roundtrips toolbar entry update", () => {
  const { text, toolBar } = parseFixture();
  const sourceLine = toolBar.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarToolTip)?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for existing toolbar tooltip.");

  const args: ToolBarEntryArgs = {
    kind: TOOLBAR_ENTRY_KIND.ToolBarToolTip,
    idRaw: "#TbRefresh",
    textRaw: '"Refresh all data"',
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyToolBarEntryUpdate(document, "#TbMain", sourceLine!, args)
  );

  const updatedToolBar = parsed.toolbars.find((tb) => tb.id === "#TbMain");
  const updatedTip = updatedToolBar?.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarToolTip);
  assert.ok(updatedTip, "Expected updated toolbar tooltip.");
  assert.equal(updatedTip?.text, "Refresh all data");
  assert.match(patchedText, /ToolBarToolTip\(#TbRefresh, "Refresh all data"\)/);
});

test("roundtrips toolbar entry delete", () => {
  const { text, toolBar } = parseFixture();
  const target = toolBar.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarButton);
  const sourceLine = target?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for existing toolbar button.");

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyToolBarEntryDelete(document, "#TbMain", sourceLine!, TOOLBAR_ENTRY_KIND.ToolBarButton)
  );

  const updatedToolBar = parsed.toolbars.find((tb) => tb.id === "#TbMain");
  assert.ok(updatedToolBar, "Expected toolbar after delete.");
  assert.equal(updatedToolBar!.entries.length, 1);
  assert.equal(updatedToolBar!.entries.some((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarButton), false);
  assert.doesNotMatch(patchedText, /ToolBarButton\(#TbRefresh, 0, "Refresh"\)/);
});

test("roundtrips statusbar field insert", () => {
  const { text } = parseFixture();
  const args: StatusBarFieldArgs = {
    widthRaw: "240",
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyStatusBarFieldInsert(document, "#SbMain", args)
  );

  const statusBar = parsed.statusbars.find((sb) => sb.id === "#SbMain");
  assert.ok(statusBar, "Expected statusbar after insert.");
  assert.equal(statusBar!.fields.length, 2);
  assert.equal(statusBar!.fields[1]?.widthRaw, "240");
  assert.match(patchedText, /AddStatusBarField\(240\)/);
});

test("roundtrips statusbar field update", () => {
  const { text, statusBar } = parseFixture();
  const sourceLine = statusBar.fields[0]?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for statusbar field.");

  const args: StatusBarFieldArgs = {
    widthRaw: "180",
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyStatusBarFieldUpdate(document, "#SbMain", sourceLine!, args)
  );

  const updatedStatusBar = parsed.statusbars.find((sb) => sb.id === "#SbMain");
  assert.ok(updatedStatusBar, "Expected statusbar after update.");
  assert.equal(updatedStatusBar!.fields.length, 1);
  assert.equal(updatedStatusBar!.fields[0]?.widthRaw, "180");
  assert.match(patchedText, /AddStatusBarField\(180\)/);
});

test("roundtrips statusbar field delete", () => {
  const { text, statusBar } = parseFixture();
  const sourceLine = statusBar.fields[0]?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for statusbar field.");

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyStatusBarFieldDelete(document, "#SbMain", sourceLine!)
  );

  const updatedStatusBar = parsed.statusbars.find((sb) => sb.id === "#SbMain");
  assert.ok(updatedStatusBar, "Expected statusbar after delete.");
  assert.equal(updatedStatusBar!.fields.length, 0);
  assert.doesNotMatch(patchedText, /AddStatusBarField\(120\)/);
});
