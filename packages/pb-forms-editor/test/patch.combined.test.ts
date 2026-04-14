import test from "node:test";
import assert from "node:assert/strict";

import { parseFormDocument } from "../src/core/parser/form-parser";
import {
  applyGadgetOpenArgsUpdate,
  applyGadgetPropertyUpdate,
  applyImageDelete,
  applyImageInsert,
  applyImageUpdate,
  applyMenuDelete,
  applyMenuEntryDelete,
  applyMenuEntryInsert,
  applyMenuEntryMove,
  applyMenuEntryUpdate,
  applyRectPatch,
  applyStatusBarDelete,
  applyStatusBarFieldDelete,
  applyStatusBarFieldInsert,
  applyStatusBarFieldUpdate,
  applyToolBarDelete,
  applyToolBarEntryDelete,
  applyToolBarEntryInsert,
  applyToolBarEntryTooltipSet,
  applyToolBarEntryUpdate,
  type GadgetPropertyArgs,
  type ImageArgs,
  type MenuEntryArgs,
  type StatusBarFieldArgs,
  type ToolBarEntryArgs,
} from "../src/core/emitter/patch-emitter";
import { MENU_ENTRY_KIND, TOOLBAR_ENTRY_KIND } from "../src/core/model";
import { loadFixture } from "./helpers/loadFixture";
import { FakeTextDocument } from "./helpers/fakeTextDocument";
import { applyWorkspaceEditToText } from "./helpers/applyWorkspaceEdit";

// NOTE: TextDocument is imported as a type only — it is used as the parameter
// type of editFactory so that patch emitter functions (which expect vscode.TextDocument)
// are accepted without additional casts at each call site.
import type { TextDocument } from "vscode";
import { MenuEntryMovePlacement } from "../src/shared/menu";

const DEFAULT_SECTION_ID = "0";
const menuId = DEFAULT_SECTION_ID;
const toolBarId = DEFAULT_SECTION_ID;
const statusBarId = DEFAULT_SECTION_ID;

// NOTE: editFactory receives a vscode.TextDocument, not a FakeTextDocument directly.
// The VSCode Language Server resolves @types/vscode regardless of tsconfig.test.json,
// so passing FakeTextDocument where TextDocument is expected causes TS2345.
// The cast is done once via document.asTextDocument() — do NOT change the parameter
// type back to FakeTextDocument, and do NOT inline the cast at each test call site.
function patchAndReparse(
  text: string,
  editFactory: (document: TextDocument) =>
    | ReturnType<typeof applyGadgetPropertyUpdate>
    | ReturnType<typeof applyImageInsert>
    | ReturnType<typeof applyImageUpdate>
    | ReturnType<typeof applyImageDelete>
    | ReturnType<typeof applyMenuEntryInsert>
    | ReturnType<typeof applyMenuEntryMove>
    | ReturnType<typeof applyMenuEntryUpdate>
    | ReturnType<typeof applyMenuDelete>
    | ReturnType<typeof applyMenuEntryDelete>
    | ReturnType<typeof applyToolBarDelete>
    | ReturnType<typeof applyToolBarEntryInsert>
    | ReturnType<typeof applyToolBarEntryTooltipSet>
    | ReturnType<typeof applyToolBarEntryUpdate>
    | ReturnType<typeof applyToolBarEntryDelete>
    | ReturnType<typeof applyStatusBarDelete>
    | ReturnType<typeof applyStatusBarDelete>
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

function patchTwiceAndReparse(
  text: string,
  firstEditFactory: (document: TextDocument) =>
    | ReturnType<typeof applyGadgetOpenArgsUpdate>
    | ReturnType<typeof applyGadgetPropertyUpdate>
    | ReturnType<typeof applyImageInsert>
    | ReturnType<typeof applyImageUpdate>
    | ReturnType<typeof applyImageDelete>
    | ReturnType<typeof applyMenuEntryInsert>
    | ReturnType<typeof applyMenuEntryMove>
    | ReturnType<typeof applyMenuEntryUpdate>
    | ReturnType<typeof applyMenuDelete>
    | ReturnType<typeof applyMenuEntryDelete>
    | ReturnType<typeof applyToolBarDelete>
    | ReturnType<typeof applyToolBarEntryInsert>
    | ReturnType<typeof applyToolBarEntryTooltipSet>
    | ReturnType<typeof applyToolBarEntryUpdate>
    | ReturnType<typeof applyToolBarEntryDelete>
    | ReturnType<typeof applyStatusBarDelete>
    | ReturnType<typeof applyStatusBarFieldInsert>
    | ReturnType<typeof applyStatusBarFieldUpdate>
    | ReturnType<typeof applyStatusBarFieldDelete>,
  secondEditFactory: (document: TextDocument) =>
    | ReturnType<typeof applyGadgetOpenArgsUpdate>
    | ReturnType<typeof applyGadgetPropertyUpdate>
    | ReturnType<typeof applyImageInsert>
    | ReturnType<typeof applyImageUpdate>
    | ReturnType<typeof applyImageDelete>
    | ReturnType<typeof applyMenuEntryInsert>
    | ReturnType<typeof applyMenuEntryMove>
    | ReturnType<typeof applyMenuEntryUpdate>
    | ReturnType<typeof applyMenuDelete>
    | ReturnType<typeof applyMenuEntryDelete>
    | ReturnType<typeof applyToolBarDelete>
    | ReturnType<typeof applyToolBarEntryInsert>
    | ReturnType<typeof applyToolBarEntryTooltipSet>
    | ReturnType<typeof applyToolBarEntryUpdate>
    | ReturnType<typeof applyToolBarEntryDelete>
    | ReturnType<typeof applyStatusBarDelete>
    | ReturnType<typeof applyStatusBarFieldInsert>
    | ReturnType<typeof applyStatusBarFieldUpdate>
    | ReturnType<typeof applyStatusBarFieldDelete>
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

function patchThriceAndReparse(
  text: string,
  firstEditFactory: (document: TextDocument) =>
    | ReturnType<typeof applyGadgetOpenArgsUpdate>
    | ReturnType<typeof applyGadgetPropertyUpdate>
    | ReturnType<typeof applyImageInsert>
    | ReturnType<typeof applyImageUpdate>
    | ReturnType<typeof applyImageDelete>
    | ReturnType<typeof applyMenuEntryInsert>
    | ReturnType<typeof applyMenuEntryMove>
    | ReturnType<typeof applyMenuEntryUpdate>
    | ReturnType<typeof applyMenuEntryDelete>
    | ReturnType<typeof applyRectPatch>
    | ReturnType<typeof applyToolBarEntryInsert>
    | ReturnType<typeof applyToolBarEntryUpdate>
    | ReturnType<typeof applyToolBarEntryDelete>
    | ReturnType<typeof applyStatusBarFieldInsert>
    | ReturnType<typeof applyStatusBarFieldUpdate>
    | ReturnType<typeof applyStatusBarFieldDelete>,
  secondEditFactory: (document: TextDocument) =>
    | ReturnType<typeof applyGadgetOpenArgsUpdate>
    | ReturnType<typeof applyGadgetPropertyUpdate>
    | ReturnType<typeof applyImageInsert>
    | ReturnType<typeof applyImageUpdate>
    | ReturnType<typeof applyImageDelete>
    | ReturnType<typeof applyMenuEntryInsert>
    | ReturnType<typeof applyMenuEntryMove>
    | ReturnType<typeof applyMenuEntryUpdate>
    | ReturnType<typeof applyMenuEntryDelete>
    | ReturnType<typeof applyRectPatch>
    | ReturnType<typeof applyToolBarEntryInsert>
    | ReturnType<typeof applyToolBarEntryUpdate>
    | ReturnType<typeof applyToolBarEntryDelete>
    | ReturnType<typeof applyStatusBarFieldInsert>
    | ReturnType<typeof applyStatusBarFieldUpdate>
    | ReturnType<typeof applyStatusBarFieldDelete>,
  thirdEditFactory: (document: TextDocument) =>
    | ReturnType<typeof applyGadgetOpenArgsUpdate>
    | ReturnType<typeof applyGadgetPropertyUpdate>
    | ReturnType<typeof applyImageInsert>
    | ReturnType<typeof applyImageUpdate>
    | ReturnType<typeof applyImageDelete>
    | ReturnType<typeof applyMenuEntryInsert>
    | ReturnType<typeof applyMenuEntryMove>
    | ReturnType<typeof applyMenuEntryUpdate>
    | ReturnType<typeof applyMenuEntryDelete>
    | ReturnType<typeof applyRectPatch>
    | ReturnType<typeof applyToolBarEntryInsert>
    | ReturnType<typeof applyToolBarEntryUpdate>
    | ReturnType<typeof applyToolBarEntryDelete>
    | ReturnType<typeof applyStatusBarDelete>
    | ReturnType<typeof applyStatusBarFieldInsert>
    | ReturnType<typeof applyStatusBarFieldUpdate>
    | ReturnType<typeof applyStatusBarFieldDelete>
) {
  const firstDocument = new FakeTextDocument(text);
  const firstEdit = firstEditFactory(firstDocument.asTextDocument());
  assert.ok(firstEdit, "Expected first WorkspaceEdit result.");
  const firstPatchedText = applyWorkspaceEditToText(text, firstEdit!);

  const secondDocument = new FakeTextDocument(firstPatchedText);
  const secondEdit = secondEditFactory(secondDocument.asTextDocument());
  assert.ok(secondEdit, "Expected second WorkspaceEdit result.");
  const secondPatchedText = applyWorkspaceEditToText(firstPatchedText, secondEdit!);

  const thirdDocument = new FakeTextDocument(secondPatchedText);
  const thirdEdit = thirdEditFactory(thirdDocument.asTextDocument());
  assert.ok(thirdEdit, "Expected third WorkspaceEdit result.");
  const patchedText = applyWorkspaceEditToText(secondPatchedText, thirdEdit!);

  return {
    patchedText,
    parsed: parseFormDocument(patchedText),
  };
}

function parseFixture() {
  const text = loadFixture("fixtures/roundtrip/14-combined-regression.pbf");
  const parsed = parseFormDocument(text);
  const menu = parsed.menus[0];
  const toolBar = parsed.toolbars[0];
  const statusBar = parsed.statusbars[0];

  assert.ok(menu, "Expected menu section.");
  assert.ok(toolBar, "Expected toolbar section.");
  assert.ok(statusBar, "Expected statusbar section.");

  return { text, parsed, menu: menu!, toolBar: toolBar!, statusBar: statusBar!, menuId: menu!.id, toolBarId: toolBar!.id, statusBarId: statusBar!.id };
}

function parseStatusFixture() {
  const text = loadFixture("fixtures/smoke/10-statusbar-basic.pbf");
  const parsed = parseFormDocument(text);
  const statusBar = parsed.statusbars[0];

  assert.ok(statusBar, "Expected statusbar in statusbar fixture.");
  return { text, parsed, statusBar: statusBar!, statusBarId: statusBar!.id };
}


function parseImageFixture() {
  const text = loadFixture("fixtures/smoke/11-images-crossrefs.pbf");
  const parsed = parseFormDocument(text);
  const menu = parsed.menus[0];
  const toolBar = parsed.toolbars[0];
  const statusBar = parsed.statusbars[0];

  return {
    text,
    parsed,
    menuId: menu?.id ?? "0",
    toolBarId: toolBar?.id ?? "0",
    statusBarId: statusBar?.id ?? "0",
  };
}

function parseGadgetFixture() {
  const text = loadFixture("fixtures/smoke/12-visibility-colors-fonts.pbf");
  const parsed = parseFormDocument(text);

  return { text, parsed };
}


test("roundtrips menu entry insert with shortcut and icon", () => {
  const { text, menuId, toolBarId, statusBarId } = parseFixture();
  const args: MenuEntryArgs = {
    kind: MENU_ENTRY_KIND.MenuItem,
    idRaw: "#MnuSave",
    textRaw: '"Save"',
    shortcut: "Ctrl+S",
    iconRaw: "ImageID(#ImgSave)",
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyMenuEntryInsert(document, menuId, args)
  );

  const menu = parsed.menus.find((m) => m.id === menuId);
  assert.ok(menu, "Expected menu after insert.");
  assert.equal(menu!.entries.length, 4);
  assert.equal(menu!.entries[3]?.kind, MENU_ENTRY_KIND.MenuItem);
  assert.equal(menu!.entries[3]?.idRaw, "#MnuSave");
  assert.equal(menu!.entries[3]?.text, "Save");
  assert.equal(menu!.entries[3]?.shortcut, "Ctrl+S");
  assert.equal(menu!.entries[3]?.iconId, "#ImgSave");
  assert.match(patchedText, /MenuItem\(#MnuSave, "Save" \+ Chr\(9\) \+ "Ctrl\+S", ImageID\(#ImgSave\)\)/);
});

test("roundtrips root menu title insert", () => {
  const text = loadFixture("fixtures/smoke/08-menu-basic.pbf");
  const args: MenuEntryArgs = {
    kind: MENU_ENTRY_KIND.MenuTitle,
    textRaw: '"View"',
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyMenuEntryInsert(document, menuId, args)
  );

  const menu = parsed.menus.find((m) => m.id === menuId);
  assert.ok(menu, "Expected menu after root title insert.");
  assert.equal(menu!.entries.at(-1)?.kind, MENU_ENTRY_KIND.MenuTitle);
  assert.equal(menu!.entries.at(-1)?.text, "View");
  assert.match(patchedText, /MenuTitle\("View"\)\r?\nEndProcedure/);
});

test("roundtrips nested menu entry insert into submenu footer", () => {
  const text = loadFixture("fixtures/smoke/08-menu-basic.pbf");
  const parsed = parseFormDocument(text);
  const menu = parsed.menus.find((m) => m.id === menuId);
  const openSubMenu = menu?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.OpenSubMenu);
  const parentSourceLine = openSubMenu?.source?.line;

  assert.ok(menu, "Expected menu.");
  assert.equal(typeof parentSourceLine, "number", "Expected source line for OpenSubMenu entry.");

  const args: MenuEntryArgs = {
    kind: MENU_ENTRY_KIND.MenuItem,
    idRaw: "#MenuRecent2",
    textRaw: '"Pinned file"',
  };

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) =>
    applyMenuEntryInsert(document, menuId, args, undefined, { parentSourceLine: parentSourceLine! })
  );

  const updatedMenu = updated.menus.find((m) => m.id === menuId);
  assert.ok(updatedMenu, "Expected menu after submenu insert.");

  const closeIndex = updatedMenu!.entries.findIndex((entry) => entry.kind === MENU_ENTRY_KIND.CloseSubMenu);
  const insertedIndex = updatedMenu!.entries.findIndex((entry) => entry.idRaw === "#MenuRecent2");
  assert.ok(insertedIndex >= 0, "Expected inserted submenu entry.");
  assert.ok(closeIndex > insertedIndex, "Expected inserted submenu entry before CloseSubMenu.");
  assert.equal(updatedMenu!.entries[insertedIndex]?.level, 2);
  assert.match(patchedText, /MenuItem\(#MenuRecent2, "Pinned file"\)\r?\n\s*CloseSubMenu\(\)/);
});

test("roundtrips menu entry insert into leaf menu item footer by promoting parent into submenu", () => {
  const text = loadFixture("fixtures/smoke/08-menu-basic.pbf");
  const parsed = parseFormDocument(text);
  const menu = parsed.menus.find((m) => m.id === menuId);
  const leafItem = menu?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem && entry.idRaw === "#MenuRecent1");
  const parentSourceLine = leafItem?.source?.line;

  assert.ok(menu, "Expected menu.");
  assert.equal(typeof parentSourceLine, "number", "Expected source line for leaf MenuItem entry.");

  const args: MenuEntryArgs = {
    kind: MENU_ENTRY_KIND.MenuItem,
    idRaw: "#MenuRecent2",
    textRaw: '"Pinned file"',
  };

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) =>
    applyMenuEntryInsert(document, menuId, args, undefined, { parentSourceLine: parentSourceLine! })
  );

  const updatedMenu = updated.menus.find((m) => m.id === menuId);
  assert.ok(updatedMenu, "Expected menu after promoted submenu insert.");

  const promotedIndex = updatedMenu!.entries.findIndex((entry) => entry.kind === MENU_ENTRY_KIND.OpenSubMenu && entry.text === "Last file");
  const insertedIndex = updatedMenu!.entries.findIndex((entry) => entry.idRaw === "#MenuRecent2");
  const closeIndex = updatedMenu!.entries.findIndex((entry, index) => index > promotedIndex && entry.kind === MENU_ENTRY_KIND.CloseSubMenu);

  assert.ok(promotedIndex >= 0, "Expected leaf MenuItem to become OpenSubMenu.");
  assert.ok(insertedIndex > promotedIndex, "Expected inserted child after promoted OpenSubMenu.");
  assert.ok(closeIndex > insertedIndex, "Expected inserted child before promoted CloseSubMenu.");
  assert.equal(updatedMenu!.entries[promotedIndex]?.level, 2);
  assert.equal(updatedMenu!.entries[insertedIndex]?.level, 3);
  assert.equal(updatedMenu!.entries.some((entry) => entry.idRaw === "#MenuRecent1"), false);
  assert.match(patchedText, /OpenSubMenu\("Last file"\)\r?\n\s*MenuItem\(#MenuRecent2, "Pinned file"\)\r?\n\s*CloseSubMenu\(\)/);
  assert.match(patchedText, /Enumeration FormMenu[\s\S]*#MenuOpen[\s\S]*#MenuRecent2[\s\S]*EndEnumeration/);
  assert.doesNotMatch(patchedText, /#MenuRecent1/);
});

test("roundtrips menu entry insert into empty submenu footer", () => {
  const text = [
    '; Form Designer for PureBasic - 6.30',
    'Enumeration FormMenu',
    '  #MenuOpen',
    'EndEnumeration',
    '',
    'Procedure OpenFrmMain()',
    '  CreateMenu(0, WindowID(#FrmMain))',
    '  MenuTitle("File")',
    '  OpenSubMenu("Recent")',
    '  CloseSubMenu()',
    'EndProcedure',
    '',
  ].join("\n");

  const parsed = parseFormDocument(text);
  const menu = parsed.menus.find((m) => m.id === menuId);
  const emptySubMenu = menu?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.OpenSubMenu);
  const parentSourceLine = emptySubMenu?.source?.line;

  assert.ok(menu, "Expected menu.");
  assert.equal(typeof parentSourceLine, "number", "Expected source line for empty OpenSubMenu entry.");

  const args: MenuEntryArgs = {
    kind: MENU_ENTRY_KIND.MenuItem,
    idRaw: "#MenuRecent1",
    textRaw: '"Last file"',
  };

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) =>
    applyMenuEntryInsert(document, menuId, args, undefined, { parentSourceLine: parentSourceLine! })
  );

  const updatedMenu = updated.menus.find((m) => m.id === menuId);
  assert.ok(updatedMenu, "Expected menu after empty submenu insert.");

  const openIndex = updatedMenu!.entries.findIndex((entry) => entry.kind === MENU_ENTRY_KIND.OpenSubMenu && entry.text === "Recent");
  const insertedIndex = updatedMenu!.entries.findIndex((entry) => entry.idRaw === "#MenuRecent1");
  const closeIndex = updatedMenu!.entries.findIndex((entry) => entry.kind === MENU_ENTRY_KIND.CloseSubMenu);

  assert.ok(openIndex >= 0, "Expected existing empty submenu entry.");
  assert.ok(insertedIndex > openIndex, "Expected inserted child after OpenSubMenu.");
  assert.ok(closeIndex > insertedIndex, "Expected inserted child before CloseSubMenu.");
  assert.equal(updatedMenu!.entries[insertedIndex]?.level, 2);
  assert.match(patchedText, /OpenSubMenu\("Recent"\)\r?\n\s*MenuItem\(#MenuRecent1, "Last file"\)\r?\n\s*CloseSubMenu\(\)/);
});

test("roundtrips menu entry insert into empty submenu footer with placeholder comment before close", () => {
  const text = [
    '; Form Designer for PureBasic - 6.30',
    'Enumeration FormMenu',
    '  #MenuOpen',
    'EndEnumeration',
    '',
    'Procedure OpenFrmMain()',
    '  CreateImageMenu(0, WindowID(#FrmMain))',
    '  MenuTitle("File")',
    '  OpenSubMenu("Recent")',
    '  ; placeholder for future entries',
    '  CloseSubMenu()',
    'EndProcedure',
    '',
  ].join("\n");

  const parsed = parseFormDocument(text);
  const menu = parsed.menus.find((m) => m.id === menuId);
  const emptySubMenu = menu?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.OpenSubMenu && entry.text === "Recent");
  const parentSourceLine = emptySubMenu?.source?.line;

  assert.ok(menu, "Expected CreateImageMenu section.");
  assert.equal(typeof parentSourceLine, "number", "Expected source line for empty OpenSubMenu entry.");

  const args: MenuEntryArgs = {
    kind: MENU_ENTRY_KIND.MenuItem,
    idRaw: "#MenuRecent2",
    textRaw: '"Pinned file"',
  };

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) =>
    applyMenuEntryInsert(document, menuId, args, undefined, { parentSourceLine: parentSourceLine! })
  );

  const updatedMenu = updated.menus.find((m) => m.id === menuId);
  assert.ok(updatedMenu, "Expected menu after commented empty submenu insert.");
  assert.match(
    patchedText,
    /OpenSubMenu\("Recent"\)\r?\n\s*; placeholder for future entries\r?\n\s*MenuItem\(#MenuRecent2, "Pinned file"\)\r?\n\s*CloseSubMenu\(\)/
  );
});

test("roundtrips submenu insert with generated closing line", () => {
  const text = loadFixture("fixtures/smoke/08-menu-basic.pbf");
  const args: MenuEntryArgs = {
    kind: MENU_ENTRY_KIND.OpenSubMenu,
    textRaw: '"Tools"',
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyMenuEntryInsert(document, menuId, args)
  );

  const menu = parsed.menus.find((m) => m.id === menuId);
  assert.ok(menu, "Expected menu after submenu insert.");
  assert.equal(menu!.entries.at(-2)?.kind, MENU_ENTRY_KIND.OpenSubMenu);
  assert.equal(menu!.entries.at(-2)?.text, "Tools");
  assert.equal(menu!.entries.at(-1)?.kind, MENU_ENTRY_KIND.CloseSubMenu);
  assert.match(patchedText, /OpenSubMenu\("Tools"\)\r?\n\s*CloseSubMenu\(\)/);
});

test("roundtrips menu entry update", () => {
  const { text, menu, menuId } = parseFixture();
  const sourceLine = menu.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem)?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for existing menu item.");

  const args: MenuEntryArgs = {
    kind: MENU_ENTRY_KIND.MenuItem,
    idRaw: "#MnuOpen",
    textRaw: '"Open File"',
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyMenuEntryUpdate(document, menuId, sourceLine!, args)
  );

  const updatedMenu = parsed.menus.find((m) => m.id === menuId);
  const updatedItem = updatedMenu?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem);
  assert.ok(updatedItem, "Expected updated menu item.");
  assert.equal(updatedItem?.text, "Open File");
  assert.match(patchedText, /MenuItem\(#MnuOpen, "Open File"\)/);
});


test("preserves surrounding whitespace for menu shortcut updates", () => {
  const { text, menu, menuId } = parseFixture();
  const openItem = menu.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem);
  assert.ok(openItem?.source?.line !== undefined, "Expected source line for existing menu item.");

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyMenuEntryUpdate(document, menuId, openItem!.source!.line, {
      kind: MENU_ENTRY_KIND.MenuItem,
      idRaw: openItem!.idRaw,
      textRaw: openItem!.textRaw,
      shortcut: "  Ctrl+Shift+O  ",
      iconRaw: openItem!.iconRaw,
    })
  );

  const updatedItem = parsed.menus.find((m) => m.id === menuId)?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem);
  assert.equal(updatedItem?.shortcut, "  Ctrl+Shift+O  ");
  assert.match(patchedText, /MenuItem\(#MnuOpen, "Open" \+ Chr\(9\) \+ "  Ctrl\+Shift\+O  ", ImageID\(#Img_FrmMain_0\)\)/);
});

test("roundtrips menu entry update with preserved shortcut and icon", () => {
  const { text, menu, menuId } = parseFixture();
  const sourceLine = menu.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem)?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for existing menu item.");

  const args: MenuEntryArgs = {
    kind: MENU_ENTRY_KIND.MenuItem,
    idRaw: "#MnuOpen",
    textRaw: '"Open Project"',
    shortcut: "Ctrl+O",
    iconRaw: "ImageID(#ImgOpen)",
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyMenuEntryUpdate(document, menuId, sourceLine!, args)
  );

  const updatedMenu = parsed.menus.find((m) => m.id === menuId);
  const updatedItem = updatedMenu?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem);
  assert.ok(updatedItem, "Expected updated menu item.");
  assert.equal(updatedItem?.text, "Open Project");
  assert.equal(updatedItem?.shortcut, "Ctrl+O");
  assert.equal(updatedItem?.iconId, "#ImgOpen");
  assert.match(patchedText, /MenuItem\(#MnuOpen, "Open Project" \+ Chr\(9\) \+ "Ctrl\+O", ImageID\(#ImgOpen\)\)/);
});


test("patches menu entries inside CreateImageMenu sections", () => {
  const text = [
    'Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 200)',
    '  OpenWindow(#FrmMain, x, y, width, height, "Menu")',
    '  CreateImageMenu(0, WindowID(#FrmMain))',
    '  MenuTitle("File")',
    '  MenuItem(#MenuOpen, "Open" + Chr(9) + "Ctrl+O")',
    'EndProcedure',
    ''
  ].join("\n");

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyMenuEntryInsert(document, '0', {
      kind: MENU_ENTRY_KIND.MenuItem,
      idRaw: '#MenuSave',
      textRaw: '"Save"',
      shortcut: 'Ctrl+S',
    })
  );

  const menu = parsed.menus.find((m) => m.id === '0');
  assert.ok(menu, 'Expected CreateImageMenu section after insert.');
  assert.equal(menu!.entries.at(-1)?.idRaw, '#MenuSave');
  assert.equal(menu!.entries.at(-1)?.shortcut, 'Ctrl+S');
  assert.match(patchedText, /CreateImageMenu\(0, WindowID\(#FrmMain\)\)[\s\S]*MenuItem\(#MenuSave, "Save" \+ Chr\(9\) \+ "Ctrl\+S"\)/);
});

test("roundtrips menu subtree move before sibling entry", () => {
  const text = loadFixture("fixtures/smoke/08-menu-basic.pbf");
  const parsed = parseFormDocument(text);
  const menu = parsed.menus.find((m) => m.id === menuId);
  const subMenu = menu?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.OpenSubMenu && entry.text === "Recent");
  const separator = menu?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuBar);

  assert.ok(menu, "Expected menu.");
  assert.equal(typeof subMenu?.source?.line, "number", "Expected source line for submenu entry.");
  assert.equal(typeof separator?.source?.line, "number", "Expected source line for separator entry.");

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) =>
    applyMenuEntryMove(document, menuId, subMenu!.source!.line, MENU_ENTRY_KIND.OpenSubMenu, {
      targetSourceLine: separator!.source!.line,
      placement: MenuEntryMovePlacement.Before,
    })
  );

  const updatedMenu = updated.menus.find((m) => m.id === menuId);
  assert.ok(updatedMenu, "Expected menu after submenu move.");

  const subMenuIndex = updatedMenu!.entries.findIndex((entry) => entry.kind === MENU_ENTRY_KIND.OpenSubMenu && entry.text === "Recent");
  const separatorIndex = updatedMenu!.entries.findIndex((entry) => entry.kind === MENU_ENTRY_KIND.MenuBar);
  const childIndex = updatedMenu!.entries.findIndex((entry) => entry.idRaw === "#MenuRecent1");
  const closeIndex = updatedMenu!.entries.findIndex((entry) => entry.kind === MENU_ENTRY_KIND.CloseSubMenu);

  assert.ok(subMenuIndex >= 0, "Expected submenu entry after move.");
  assert.ok(separatorIndex > subMenuIndex, "Expected submenu block before separator after move.");
  assert.ok(childIndex > subMenuIndex, "Expected submenu child after submenu entry.");
  assert.ok(closeIndex > childIndex, "Expected CloseSubMenu after submenu child.");
  assert.match(patchedText, /OpenSubMenu\("Recent"\)[\s\S]*MenuItem\(#MenuRecent1, "Last file"\)[\s\S]*CloseSubMenu\(\)[\s\S]*MenuBar\(\)/);
});

test("roundtrips menu entry move into submenu as child block", () => {
  const text = loadFixture("fixtures/smoke/08-menu-basic.pbf");
  const parsed = parseFormDocument(text);
  const menu = parsed.menus.find((m) => m.id === menuId);
  const openItem = menu?.entries.find((entry) => entry.idRaw === "#MenuOpen");
  const subMenu = menu?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.OpenSubMenu && entry.text === "Recent");

  assert.ok(menu, "Expected menu.");
  assert.equal(typeof openItem?.source?.line, "number", "Expected source line for root menu item.");
  assert.equal(typeof subMenu?.source?.line, "number", "Expected source line for submenu entry.");

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) =>
    applyMenuEntryMove(document, menuId, openItem!.source!.line, MENU_ENTRY_KIND.MenuItem, {
      targetSourceLine: subMenu!.source!.line,
      placement: MenuEntryMovePlacement.AppendChild,
    })
  );

  const updatedMenu = updated.menus.find((m) => m.id === menuId);
  assert.ok(updatedMenu, "Expected menu after child move.");

  const movedItem = updatedMenu!.entries.find((entry) => entry.idRaw === "#MenuOpen");
  const closeIndex = updatedMenu!.entries.findIndex((entry) => entry.kind === MENU_ENTRY_KIND.CloseSubMenu);

  assert.ok(movedItem, "Expected moved menu item after patch.");
  assert.equal(movedItem!.level, 2);
  assert.ok((movedItem!.source!.line ?? -1) > (subMenu?.source!.line ?? -1), "Expected moved item inside submenu block.");
  assert.ok((movedItem!.source!.line ?? -1) < (updatedMenu!.entries[closeIndex]?.source?.line ?? Number.MAX_SAFE_INTEGER), "Expected moved item before CloseSubMenu.");
  assert.match(patchedText, /OpenSubMenu\("Recent"\)[\s\S]*MenuItem\(#MenuOpen, "Open" \+ Chr\(9\) \+ "Ctrl\+O", ImageID\(#Img_FrmMain_0\)\)[\s\S]*CloseSubMenu\(\)/);
});

test("roundtrips menu entry delete", () => {
  const { text, menu, menuId } = parseFixture();
  const target = menu.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem);
  const sourceLine = target?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for existing menu item.");

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyMenuEntryDelete(document, menuId, sourceLine!, MENU_ENTRY_KIND.MenuItem)
  );

  const updatedMenu = parsed.menus.find((m) => m.id === menuId);
  assert.ok(updatedMenu, "Expected menu after delete.");
  assert.equal(updatedMenu!.entries.length, 2);
  assert.equal(updatedMenu!.entries.some((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem), false);
  assert.doesNotMatch(patchedText, /MenuItem\(#MnuOpen, "Open"\)/);
});


test("roundtrips submenu delete removes matching CloseSubMenu and descendants", () => {
  const text = loadFixture("fixtures/smoke/08-menu-basic.pbf");
  const parsed = parseFormDocument(text);
  const menu = parsed.menus.find((m) => m.id === menuId);
  const target = menu?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.OpenSubMenu && entry.text === "Recent");
  const sourceLine = target?.source?.line;

  assert.ok(menu, "Expected menu.");
  assert.equal(typeof sourceLine, "number", "Expected source line for existing OpenSubMenu entry.");

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) =>
    applyMenuEntryDelete(document, menuId, sourceLine!, MENU_ENTRY_KIND.OpenSubMenu)
  );

  const updatedMenu = updated.menus.find((m) => m.id === menuId);
  assert.ok(updatedMenu, "Expected menu after submenu delete.");
  assert.equal(updatedMenu!.entries.some((entry) => entry.kind === MENU_ENTRY_KIND.OpenSubMenu), false);
  assert.equal(updatedMenu!.entries.some((entry) => entry.idRaw === "#MenuRecent1"), false);
  assert.equal(updatedMenu!.entries.some((entry) => entry.kind === MENU_ENTRY_KIND.CloseSubMenu), false);
  assert.doesNotMatch(patchedText, /OpenSubMenu\("Recent"\)/);
  assert.doesNotMatch(patchedText, /MenuItem\(#MenuRecent1, "Last file"\)/);
  assert.doesNotMatch(patchedText, /CloseSubMenu\(\)/);
});

test("roundtrips menu title delete removes nested submenu block until next title", () => {
  const text = [
    'Procedure OpenFrmMain()',
    '  CreateMenu(#MenuMain, WindowID(#FrmMain))',
    '  MenuTitle("File")',
    '  MenuItem(#MenuOpen, "Open")',
    '  OpenSubMenu("Recent")',
    '  MenuItem(#MenuRecent1, "Last file")',
    '  CloseSubMenu()',
    '  MenuTitle("Help")',
    '  MenuItem(#MenuAbout, "About")',
    'EndProcedure',
    ''
  ].join("\n");

  const parsed = parseFormDocument(text);
  const menuId = parsed.menus[0]?.id;
  const menu = parsed.menus.find((m) => m.id === menuId);
  const title = menu?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuTitle && entry.text === "File");
  const sourceLine = title?.source?.line;

  assert.ok(menu, "Expected menu for title delete test.");
  assert.equal(typeof sourceLine, "number", "Expected source line for root MenuTitle.");

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) =>
    applyMenuEntryDelete(document, menuId, sourceLine!, MENU_ENTRY_KIND.MenuTitle)
  );

  const updatedMenu = updated.menus.find((m) => m.id === menuId);
  assert.ok(updatedMenu, "Expected menu after title delete.");
  assert.equal(updatedMenu!.entries.length, 2);
  assert.equal(updatedMenu!.entries[0]?.kind, MENU_ENTRY_KIND.MenuTitle);
  assert.equal(updatedMenu!.entries[0]?.text, "Help");
  assert.equal(updatedMenu!.entries[1]?.idRaw, "#MenuAbout");
  assert.doesNotMatch(patchedText, /MenuTitle\("File"\)/);
  assert.doesNotMatch(patchedText, /OpenSubMenu\("Recent"\)/);
  assert.doesNotMatch(patchedText, /CloseSubMenu\(\)/);
  assert.match(patchedText, /MenuTitle\("Help"\)/);
});

test("roundtrips toolbar image button insert", () => {
  const { text, menuId, toolBarId, statusBarId } = parseFixture();
  const args: ToolBarEntryArgs = {
    kind: TOOLBAR_ENTRY_KIND.ToolBarImageButton,
    idRaw: "#TbSync",
    iconRaw: "ImageID(#ImgSync)",
    toggle: true,
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyToolBarEntryInsert(document, toolBarId, args)
  );

  const toolBar = parsed.toolbars.find((tb) => tb.id === toolBarId);
  assert.ok(toolBar, "Expected toolbar after insert.");
  assert.equal(toolBar!.entries.length, 4);
  const inserted = toolBar!.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton && entry.idRaw === "#TbSync");
  assert.equal(inserted?.kind, TOOLBAR_ENTRY_KIND.ToolBarImageButton);
  assert.equal(inserted?.idRaw, "#TbSync");
  assert.equal(inserted?.iconId, "#ImgSync");
  assert.equal(inserted?.toggle, true);
  assert.match(patchedText, /ToolBarImageButton\(#TbSync, ImageID\(#ImgSync\), #PB_ToolBar_Toggle\)/);
});

test("roundtrips toolbar image button insert without image", () => {
  const { text, menuId, toolBarId, statusBarId } = parseFixture();
  const args: ToolBarEntryArgs = {
    kind: TOOLBAR_ENTRY_KIND.ToolBarImageButton,
    idRaw: "#Toolbar_2",
    iconRaw: "0",
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyToolBarEntryInsert(document, toolBarId, args)
  );

  const toolBar = parsed.toolbars.find((tb) => tb.id === toolBarId);
  assert.ok(toolBar, "Expected toolbar after insert.");
  const inserted = toolBar!.entries.at(-1);
  assert.equal(inserted?.kind, TOOLBAR_ENTRY_KIND.ToolBarImageButton);
  assert.equal(inserted?.idRaw, "#Toolbar_2");
  assert.equal(inserted?.iconRaw, "0");
  assert.match(patchedText, /ToolBarImageButton\(#Toolbar_2, 0\)/);
});

test("roundtrips toolbar tooltip update", () => {
  const { text, toolBar, toolBarId } = parseFixture();
  const sourceLine = toolBar.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarToolTip)?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for existing toolbar tooltip.");

  const args: ToolBarEntryArgs = {
    kind: TOOLBAR_ENTRY_KIND.ToolBarToolTip,
    idRaw: "#TbRefresh",
    textRaw: '"Refresh all data"',
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyToolBarEntryUpdate(document, toolBarId, sourceLine!, args)
  );

  const updatedToolBar = parsed.toolbars.find((tb) => tb.id === toolBarId);
  const updatedTip = updatedToolBar?.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarToolTip);
  assert.ok(updatedTip, "Expected updated toolbar tooltip.");
  assert.equal(updatedTip?.text, "Refresh all data");
  assert.match(patchedText, /ToolBarToolTip\(0, #TbRefresh, "Refresh all data"\)/);
});


test("roundtrips toolbar tooltip set via toolbar entry source line", () => {
  const text = loadFixture("fixtures/smoke/09-toolbar-basic.pbf");
  const parsedFixture = parseFormDocument(text);
  const toolBar = parsedFixture.toolbars.find((tb) => tb.id === toolBarId);
  assert.ok(toolBar, "Expected toolbar in toolbar fixture.");

  const sourceLine = toolBar!.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton && entry.idRaw === "#TbSave")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for existing toolbar image button.");

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyToolBarEntryTooltipSet(document, toolBarId, sourceLine!, "#TbSave", '"Save active form"')
  );

  const updatedToolBar = parsed.toolbars.find((tb) => tb.id === toolBarId);
  const updatedButton = updatedToolBar?.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton && entry.idRaw === "#TbSave");
  const updatedTip = updatedToolBar?.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarToolTip);
  assert.ok(updatedButton, "Expected updated toolbar image button.");
  assert.equal(updatedButton?.tooltip, "Save active form");
  assert.ok(updatedTip, "Expected linked toolbar tooltip entry.");
  assert.equal(updatedTip?.text, "Save active form");
  assert.match(patchedText, /ToolBarToolTip\(0, #TbSave, "Save active form"\)/);
});

test("roundtrips toolbar tooltip insert directly after toolbar entry", () => {
  const text = [
    'Procedure OpenFrmMain()',
    '  OpenWindow(#FrmMain, 0, 0, 320, 220, "Toolbar")',
    '  CreateToolBar(#TbMain, WindowID(#FrmMain))',
    '  ToolBarImageButton(#TbSave, ImageID(#ImgSave))',
    '  ToolBarSeparator()',
    'EndProcedure',
    ''
  ].join("\n");

  const parsedFixture = parseFormDocument(text);
  const toolBarId = parsedFixture.toolbars[0]?.id;
  const toolBar = parsedFixture.toolbars.find((tb) => tb.id === toolBarId);
  assert.ok(toolBar, "Expected toolbar.");
  const sourceLine = toolBar!.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton)?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for toolbar button.");

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyToolBarEntryTooltipSet(document, toolBarId, sourceLine!, "#TbSave", '"Save current form"')
  );

  const updatedToolBar = parsed.toolbars.find((tb) => tb.id === toolBarId);
  assert.ok(updatedToolBar, "Expected updated toolbar.");
  assert.equal(updatedToolBar!.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton)?.tooltip, "Save current form");
  assert.match(patchedText, /ToolBarImageButton\(#TbSave, ImageID\(#ImgSave\)\)[\s\S]*ToolBarToolTip\((0|#TbMain), #TbSave, "Save current form"\)[\s\S]*ToolBarSeparator\(\)/);
});

test("roundtrips toolbar tooltip clear removes linked tooltip line", () => {
  const text = loadFixture("fixtures/smoke/09-toolbar-basic.pbf");
  const parsedFixture = parseFormDocument(text);
  const toolBar = parsedFixture.toolbars.find((tb) => tb.id === toolBarId);
  assert.ok(toolBar, "Expected toolbar in toolbar fixture.");

  const sourceLine = toolBar!.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton)?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for existing toolbar image button.");

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyToolBarEntryTooltipSet(document, toolBarId, sourceLine!, "#TbSave", undefined)
  );

  const updatedToolBar = parsed.toolbars.find((tb) => tb.id === toolBarId);
  const updatedButton = updatedToolBar?.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton);
  assert.ok(updatedButton, "Expected updated toolbar image button.");
  assert.equal(updatedButton?.tooltip, undefined);
  assert.equal(updatedToolBar?.entries.some((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarToolTip), false);
  assert.doesNotMatch(patchedText, /ToolBarToolTip\(0, #TbSave,/);
});

test("roundtrips toolbar image button update", () => {
  const text = loadFixture("fixtures/smoke/09-toolbar-basic.pbf");
  const parsedFixture = parseFormDocument(text);
  const toolBar = parsedFixture.toolbars.find((tb) => tb.id === toolBarId);
  assert.ok(toolBar, "Expected toolbar in toolbar fixture.");

  const sourceLine = toolBar!.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton)?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for existing toolbar image button.");

  const args: ToolBarEntryArgs = {
    kind: TOOLBAR_ENTRY_KIND.ToolBarImageButton,
    idRaw: "#TbSave",
    iconRaw: "ImageID(#ImgSaveAlt)",
    toggle: false,
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyToolBarEntryUpdate(document, toolBarId, sourceLine!, args)
  );

  const updatedToolBar = parsed.toolbars.find((tb) => tb.id === toolBarId);
  const updatedButton = updatedToolBar?.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton);
  assert.ok(updatedButton, "Expected updated toolbar image button.");
  assert.equal(updatedButton?.idRaw, "#TbSave");
  assert.equal(updatedButton?.iconId, "#ImgSaveAlt");
  assert.equal(updatedButton?.toggle, false);
  assert.match(patchedText, /ToolBarImageButton\(#TbSave, ImageID\(#ImgSaveAlt\)\)/);
});

test("roundtrips toolbar entry delete", () => {
  const { text, toolBar, toolBarId } = parseFixture();
  const target = toolBar.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton && entry.idRaw === "#TbSave");
  const sourceLine = target?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for existing toolbar button.");

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyToolBarEntryDelete(document, toolBarId, sourceLine!, TOOLBAR_ENTRY_KIND.ToolBarImageButton)
  );

  const updatedToolBar = parsed.toolbars.find((tb) => tb.id === toolBarId);
  assert.ok(updatedToolBar, "Expected toolbar after delete.");
  assert.equal(updatedToolBar!.entries.length, 1);
  assert.equal(updatedToolBar!.entries.some((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton && entry.idRaw === "#TbSave"), false);
  assert.equal(updatedToolBar!.entries.some((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarToolTip && entry.idRaw === "#TbSave"), false);
  assert.doesNotMatch(patchedText, /ToolBarImageButton\(#TbSave, ImageID\(#ImgSave\)\)/);
  assert.doesNotMatch(patchedText, /ToolBarToolTip\(0, #TbSave, "Save current form"\)/);
});

test("roundtrips statusbar field insert with text decoration", () => {
  const { text, menuId, toolBarId, statusBarId } = parseFixture();
  const args: StatusBarFieldArgs = {
    widthRaw: "240",
    textRaw: '"State"',
    flagsRaw: "#PB_StatusBar_Center",
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyStatusBarFieldInsert(document, statusBarId, args)
  );

  const statusBar = parsed.statusbars.find((sb) => sb.id === statusBarId);
  assert.ok(statusBar, "Expected statusbar after insert.");
  assert.equal(statusBar!.fields.length, 4);
  assert.equal(statusBar!.fields[3]?.widthRaw, "240");
  assert.equal(statusBar!.fields[3]?.text, "State");
  assert.equal(statusBar!.fields[3]?.flagsRaw, "#PB_StatusBar_Center");
  assert.match(patchedText, /AddStatusBarField\(240\)/);
  assert.match(patchedText, /StatusBarText\(0, 3, "State", #PB_StatusBar_Center\)/);
});

test("roundtrips statusbar image-style field insert without decoration", () => {
  const { text, menuId, toolBarId, statusBarId } = parseFixture();
  const args: StatusBarFieldArgs = {
    widthRaw: "50",
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyStatusBarFieldInsert(document, statusBarId, args)
  );

  const statusBar = parsed.statusbars.find((sb) => sb.id === statusBarId);
  assert.ok(statusBar, "Expected statusbar after insert.");
  assert.equal(statusBar!.fields.length, 4);
  assert.equal(statusBar!.fields[3]?.widthRaw, "50");
  assert.equal(statusBar!.fields[3]?.textRaw, undefined);
  assert.equal(statusBar!.fields[3]?.progressBar, undefined);
  assert.equal(statusBar!.fields[3]?.imageRaw, undefined);
  assert.match(patchedText, /AddStatusBarField\(50\)/);
  assert.doesNotMatch(patchedText, /StatusBar(Image|Text|Progress)\(0, 3,/);
});

test("roundtrips statusbar field insert with progress decoration", () => {
  const { text, menuId, toolBarId, statusBarId } = parseFixture();
  const args: StatusBarFieldArgs = {
    widthRaw: "50",
    progressBar: true,
    progressRaw: "0",
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyStatusBarFieldInsert(document, statusBarId, args)
  );

  const statusBar = parsed.statusbars.find((sb) => sb.id === statusBarId);
  assert.ok(statusBar, "Expected statusbar after insert.");
  assert.equal(statusBar!.fields.length, 4);
  assert.equal(statusBar!.fields[3]?.widthRaw, "50");
  assert.equal(statusBar!.fields[3]?.progressBar, true);
  assert.equal(statusBar!.fields[3]?.progressRaw, "0");
  assert.match(patchedText, /AddStatusBarField\(50\)/);
  assert.match(patchedText, /StatusBarProgress\(0, 3, 0\)/);
});

test("roundtrips statusbar field update while preserving later field decorations", () => {
  const { text, statusBar, statusBarId } = parseStatusFixture();
  const sourceLine = statusBar.fields[0]?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for statusbar field.");

  const args: StatusBarFieldArgs = {
    widthRaw: "180",
    textRaw: '"Ready now"',
    flagsRaw: "#PB_StatusBar_Right",
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyStatusBarFieldUpdate(document, statusBarId, sourceLine!, args)
  );

  const updatedStatusBar = parsed.statusbars.find((sb) => sb.id === statusBarId);
  assert.ok(updatedStatusBar, "Expected statusbar after update.");
  assert.equal(updatedStatusBar!.fields.length, 3);
  assert.equal(updatedStatusBar!.fields[0]?.widthRaw, "180");
  assert.equal(updatedStatusBar!.fields[0]?.text, "Ready now");
  assert.equal(updatedStatusBar!.fields[0]?.flagsRaw, "#PB_StatusBar_Right");
  assert.equal(updatedStatusBar!.fields[1]?.progressBar, true);
  assert.equal(updatedStatusBar!.fields[1]?.progressRaw, "0");
  assert.equal(updatedStatusBar!.fields[2]?.imageId, "#Img_FrmMain_0");
  assert.match(patchedText, /StatusBarProgress\(0, 1, 0, #PB_StatusBar_Raised\)/);
  assert.match(patchedText, /StatusBarImage\(0, 2, ImageID\(#Img_FrmMain_0\), #PB_StatusBar_BorderLess\)/);
});


test("roundtrips statusbar width-only update without clearing image fields", () => {
  const { text, statusBar, statusBarId } = parseStatusFixture();
  const sourceLine = statusBar.fields[2]?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for image statusbar field.");

  const args: StatusBarFieldArgs = {
    widthRaw: "96",
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyStatusBarFieldUpdate(document, statusBarId, sourceLine!, args)
  );

  const updatedStatusBar = parsed.statusbars.find((sb) => sb.id === statusBarId);
  assert.ok(updatedStatusBar, "Expected statusbar after update.");
  assert.equal(updatedStatusBar!.fields[2]?.widthRaw, "96");
  assert.equal(updatedStatusBar!.fields[2]?.imageId, "#Img_FrmMain_0");
  assert.equal(updatedStatusBar!.fields[2]?.flagsRaw, "#PB_StatusBar_BorderLess");
  assert.match(patchedText, /AddStatusBarField\(96\)/);
  assert.match(patchedText, /StatusBarImage\(0, 2, ImageID\(#Img_FrmMain_0\), #PB_StatusBar_BorderLess\)/);
});


test("normalizes rebuilt statusbar sections to per-field Add/Decoration order", () => {
  const { text, statusBar, statusBarId } = parseStatusFixture();
  const sourceLine = statusBar.fields[0]?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for first statusbar field.");

  const { patchedText } = patchAndReparse(text, (document) =>
    applyStatusBarFieldUpdate(document, statusBarId, sourceLine!, {
      widthRaw: "120",
      textRaw: '"Ready"',
      flagsRaw: "#PB_StatusBar_Center",
    })
  );

  assert.match(
    patchedText,
    /CreateStatusBar\(0, WindowID\(#FrmMain\)\)\r?\n\s*AddStatusBarField\(120\)\r?\n\s*StatusBarText\(0, 0, "Ready", #PB_StatusBar_Center\)\r?\n\s*AddStatusBarField\(90\)\r?\n\s*StatusBarProgress\(0, 1, 0, #PB_StatusBar_Raised\)\r?\n\s*AddStatusBarField\(#PB_Ignore\)\r?\n\s*StatusBarImage\(0, 2, ImageID\(#Img_FrmMain_0\), #PB_StatusBar_BorderLess\)/
  );
});


test("core statusbar patcher still preserves explicit progress raw values when used directly", () => {
  const { text, statusBar, statusBarId } = parseStatusFixture();
  const sourceLine = statusBar.fields[1]?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for progress statusbar field.");

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyStatusBarFieldUpdate(document, statusBarId, sourceLine!, {
      widthRaw: "120",
      progressBar: true,
      progressRaw: "75",
      flagsRaw: "#PB_StatusBar_Raised"
    })
  );

  const updatedStatusBar = parsed.statusbars.find((sb) => sb.id === statusBarId);
  assert.ok(updatedStatusBar, "Expected statusbar after update.");
  assert.equal(updatedStatusBar!.fields[1]?.progressBar, true);
  assert.equal(updatedStatusBar!.fields[1]?.progressRaw, "75");
  assert.match(patchedText, /StatusBarProgress\(0, 1, 75, #PB_StatusBar_Raised\)/);
});

test("roundtrips statusbar field switch from progress to label and clears old progress decoration", () => {
  const { text, statusBar, statusBarId } = parseStatusFixture();
  const sourceLine = statusBar.fields[1]?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for progress statusbar field.");

  const args: StatusBarFieldArgs = {
    widthRaw: statusBar.fields[1]!.widthRaw,
    textRaw: '"Done"',
    imageRaw: "",
    flagsRaw: "#PB_StatusBar_Right",
    progressBar: false,
    progressRaw: "",
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyStatusBarFieldUpdate(document, statusBarId, sourceLine!, args)
  );

  const updatedStatusBar = parsed.statusbars.find((sb) => sb.id === statusBarId);
  assert.ok(updatedStatusBar, "Expected statusbar after update.");
  assert.equal(updatedStatusBar!.fields[1]?.text, "Done");
  assert.equal(Boolean(updatedStatusBar!.fields[1]?.progressBar), false);
  assert.equal(updatedStatusBar!.fields[1]?.imageRaw ?? "", "");
  assert.equal(updatedStatusBar!.fields[1]?.flagsRaw, "#PB_StatusBar_Right");
  assert.doesNotMatch(patchedText, /StatusBarProgress\(#SbMain, 1,/);
  assert.match(patchedText, /StatusBarText\(0, 1, "Done", #PB_StatusBar_Right\)/);
});

test("roundtrips statusbar field delete reindexes later decoration lines", () => {
  const { text, statusBar, statusBarId } = parseStatusFixture();
  const sourceLine = statusBar.fields[0]?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for statusbar field.");

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyStatusBarFieldDelete(document, statusBarId, sourceLine!)
  );

  const updatedStatusBar = parsed.statusbars.find((sb) => sb.id === statusBarId);
  assert.ok(updatedStatusBar, "Expected statusbar after delete.");
  assert.equal(updatedStatusBar!.fields.length, 2);
  assert.equal(updatedStatusBar!.fields[0]?.progressBar, true);
  assert.equal(updatedStatusBar!.fields[0]?.progressRaw, "0");
  assert.equal(updatedStatusBar!.fields[1]?.imageId, "#Img_FrmMain_0");
  assert.doesNotMatch(patchedText, /StatusBarText\(0, 0, "Ready", #PB_StatusBar_Center\)/);
  assert.match(patchedText, /StatusBarProgress\(0, 0, 0, #PB_StatusBar_Raised\)/);
  assert.match(patchedText, /StatusBarImage\(0, 1, ImageID\(#Img_FrmMain_0\), #PB_StatusBar_BorderLess\)/);
});


test("roundtrips image insert after existing image block", () => {
  const { text } = parseImageFixture();
  const args: ImageArgs = {
    inline: false,
    idRaw: "#ImgClose",
    imageRaw: '"close.png"',
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyImageInsert(document, args)
  );

  const insertedImage = parsed.images.find((image) => image.id === "#ImgClose");
  assert.ok(insertedImage, "Expected inserted image entry.");
  assert.equal(insertedImage?.inline, false);
  assert.equal(insertedImage?.image, "close.png");
  assert.match(patchedText, /LoadImage\(#ImgClose, "close\.png"\)/);
});

test("roundtrips image update for pbAny catch image", () => {
  const { text, parsed, menuId, toolBarId, statusBarId } = parseImageFixture();
  const sourceLine = parsed.images.find((image) => image.id === "Img_FrmImages_2")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for pbAny image.");

  const args: ImageArgs = {
    inline: true,
    idRaw: "#PB_Any",
    assignedVar: "Img_FrmImages_2",
    imageRaw: "?ImgSaveData",
  };

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) =>
    applyImageUpdate(document, sourceLine!, args)
  );

  const updatedImage = updated.images.find((image) => image.id === "Img_FrmImages_2");
  assert.ok(updatedImage, "Expected updated pbAny image entry.");
  assert.equal(updatedImage?.inline, true);
  assert.equal(updatedImage?.imageRaw, "?ImgSaveData");
  assert.equal(updatedImage?.image, "ImgSaveData");
  assert.match(patchedText, /Img_FrmImages_2 = CatchImage\(#PB_Any, \?ImgSaveData\)/);
});

test("roundtrips image update from load image to catch image without changing raw value", () => {
  const { text, parsed, menuId, toolBarId, statusBarId } = parseImageFixture();
  const sourceLine = parsed.images.find((image) => image.id === "#Img_FrmImages_0")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for load image.");

  const args: ImageArgs = {
    inline: true,
    idRaw: "#Img_FrmImages_0",
    imageRaw: '"open.png"',
  };

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) =>
    applyImageUpdate(document, sourceLine!, args)
  );

  const updatedImage = updated.images.find((image) => image.id === "#Img_FrmImages_0");
  assert.ok(updatedImage, "Expected updated load image entry.");
  assert.equal(updatedImage?.inline, true);
  assert.equal(updatedImage?.firstParam, "#Img_FrmImages_0");
  assert.equal(updatedImage?.imageRaw, '"open.png"');
  assert.match(patchedText, /CatchImage\(#Img_FrmImages_0, "open\.png"\)/);
});

test("roundtrips image update from catch image to load image without changing raw value", () => {
  const { text, parsed, menuId, toolBarId, statusBarId } = parseImageFixture();
  const sourceLine = parsed.images.find((image) => image.id === "#Img_FrmImages_3")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for catch image.");

  const args: ImageArgs = {
    inline: false,
    idRaw: "#Img_FrmImages_3",
    imageRaw: "?Img_FrmImages_3",
  };

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) =>
    applyImageUpdate(document, sourceLine!, args)
  );

  const updatedImage = updated.images.find((image) => image.id === "#Img_FrmImages_3");
  assert.ok(updatedImage, "Expected updated catch image entry.");
  assert.equal(updatedImage?.inline, false);
  assert.equal(updatedImage?.firstParam, "#Img_FrmImages_3");
  assert.equal(updatedImage?.imageRaw, "?Img_FrmImages_3");
  assert.match(patchedText, /LoadImage\(#Img_FrmImages_3, \?Img_FrmImages_3\)/);
});

test("roundtrips image delete", () => {
  const { text, parsed, menuId, toolBarId, statusBarId } = parseImageFixture();
  const sourceLine = parsed.images.find((image) => image.id === "#Img_FrmImages_3")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for inline image.");

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) =>
    applyImageDelete(document, sourceLine!)
  );

  assert.equal(updated.images.some((image) => image.id === "#Img_FrmImages_3"), false);
  assert.doesNotMatch(patchedText, /CatchImage\(#ImgState, \?ImgState\)/);
});

test("roundtrips choose-file gadget workflow with auto-resize patch sequence", () => {
  const { text } = parseImageFixture();

  const { parsed, patchedText } = patchThriceAndReparse(
    text,
    (document) => applyGadgetOpenArgsUpdate(document, "#ImgPreview", { imageRaw: "ImageID(#ImgChosen)" }),
    (document) => applyRectPatch(document, "#ImgPreview", 20, 20, 96, 48),
    (document) => applyImageInsert(document, { inline: false, idRaw: "#ImgChosen", imageRaw: '"chosen.png"' })
  );

  const gadget = parsed.gadgets.find((entry) => entry.id === "#ImgPreview");
  const image = parsed.images.find((entry) => entry.id === "#ImgChosen");

  assert.equal(gadget?.imageRaw, "ImageID(#ImgChosen)");
  assert.equal(gadget?.imageId, "#ImgChosen");
  assert.equal(gadget?.w, 96);
  assert.equal(gadget?.h, 48);
  assert.ok(image, "Expected inserted file-backed image entry.");
  assert.equal(image?.imageRaw, '"chosen.png"');
  assert.match(patchedText, /ImageGadget\(#ImgPreview, 20, 20, 96, 48, ImageID\(#ImgChosen\)\)/);
  assert.match(patchedText, /LoadImage\(#ImgChosen, "chosen\.png"\)/);
});

test("roundtrips choose-file button image gadget workflow with auto-resize patch sequence", () => {
  const { text } = parseImageFixture();

  const { parsed, patchedText } = patchThriceAndReparse(
    text,
    (document) => applyGadgetOpenArgsUpdate(document, "#BtnApply", { imageRaw: "ImageID(#ImgBtnChosen)" }),
    (document) => applyRectPatch(document, "#BtnApply", 52, 10, 128, 36),
    (document) => applyImageInsert(document, { inline: false, idRaw: "#ImgBtnChosen", imageRaw: '"toolbar/apply-selected.png"' })
  );

  const gadget = parsed.gadgets.find((entry) => entry.id === "#BtnApply");
  const image = parsed.images.find((entry) => entry.id === "#ImgBtnChosen");

  assert.equal(gadget?.kind, "ButtonImageGadget");
  assert.equal(gadget?.imageRaw, "ImageID(#ImgBtnChosen)");
  assert.equal(gadget?.imageId, "#ImgBtnChosen");
  assert.equal(gadget?.w, 128);
  assert.equal(gadget?.h, 36);
  assert.ok(image, "Expected inserted file-backed image entry for button image gadget.");
  assert.equal(image?.imageRaw, '"toolbar/apply-selected.png"');
  assert.match(patchedText, /ButtonImageGadget\(#BtnApply, 52, [^,]+, 128, 36, ImageID\(#ImgBtnChosen\)\)/);
  assert.match(patchedText, /LoadImage\(#ImgBtnChosen, "toolbar\/apply-selected\.png"\)/);
});

test("roundtrips create-and-assign workflow for image gadget", () => {
  const { text } = parseImageFixture();

  const { parsed, patchedText } = patchTwiceAndReparse(
    text,
    (document) => applyGadgetOpenArgsUpdate(document, "#ImgPreview", { imageRaw: "ImageID(#ImgNewLogo)" }),
    (document) => applyImageInsert(document, { inline: false, idRaw: "#ImgNewLogo", imageRaw: '"new-logo.png"' })
  );

  const gadget = parsed.gadgets.find((entry) => entry.id === "#ImgPreview");
  const image = parsed.images.find((entry) => entry.id === "#ImgNewLogo");

  assert.equal(gadget?.imageRaw, "ImageID(#ImgNewLogo)");
  assert.equal(gadget?.imageId, "#ImgNewLogo");
  assert.ok(image, "Expected inserted image entry.");
  assert.equal(image?.imageRaw, '"new-logo.png"');
  assert.match(patchedText, /LoadImage\(#ImgNewLogo, "new-logo\.png"\)/);
});

test("roundtrips create-and-assign workflow for menu item", () => {
  const { text, parsed: initial, menuId, toolBarId, statusBarId } = parseImageFixture();
  const menu = initial.menus.find((entry) => entry.id === menuId);
  assert.ok(menu, "Expected menu.");
  const openItem = menu!.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem && entry.idRaw === "#MenuOpen");
  assert.equal(typeof openItem?.source?.line, "number", "Expected menu entry source line.");

  const { parsed, patchedText } = patchTwiceAndReparse(
    text,
    (document) => applyMenuEntryUpdate(document, menuId, openItem!.source!.line, {
      kind: MENU_ENTRY_KIND.MenuItem,
      idRaw: openItem!.idRaw,
      textRaw: openItem!.textRaw,
      shortcut: openItem!.shortcut,
      iconRaw: "ImageID(#ImgMenuNew)",
    }),
    (document) => applyImageInsert(document, { inline: false, idRaw: "#ImgMenuNew", imageRaw: '"menu-new.png"' })
  );

  const updatedMenu = parsed.menus.find((entry) => entry.id === menuId);
  const updatedOpen = updatedMenu?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem && entry.idRaw === "#MenuOpen");
  const image = parsed.images.find((entry) => entry.id === "#ImgMenuNew");

  assert.equal(updatedOpen?.iconRaw, "ImageID(#ImgMenuNew)");
  assert.equal(updatedOpen?.iconId, "#ImgMenuNew");
  assert.ok(image, "Expected inserted menu image entry.");
  assert.match(patchedText, /MenuItem\(#MenuOpen, "Open", ImageID\(#ImgMenuNew\)\)/);
});

test("roundtrips create-and-assign workflow for toolbar image button with pbAny image", () => {
  const { text, parsed: initial, menuId, toolBarId, statusBarId } = parseImageFixture();
  const toolBar = initial.toolbars.find((entry) => entry.id === toolBarId);
  assert.ok(toolBar, "Expected toolbar.");
  const imageButton = toolBar!.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton && entry.idRaw === "#TbSave");
  assert.equal(typeof imageButton?.source?.line, "number", "Expected toolbar entry source line.");

  const { parsed, patchedText } = patchTwiceAndReparse(
    text,
    (document) => applyToolBarEntryUpdate(document, toolBarId, imageButton!.source!.line, {
      kind: TOOLBAR_ENTRY_KIND.ToolBarImageButton,
      idRaw: imageButton!.idRaw,
      iconRaw: "ImageID(imgToolbarNew)",
      toggle: imageButton!.toggle,
    }),
    (document) => applyImageInsert(document, { inline: true, idRaw: "#PB_Any", imageRaw: "?TbImgNew", assignedVar: "imgToolbarNew" })
  );

  const updatedToolBar = parsed.toolbars.find((entry) => entry.id === toolBarId);
  const updatedButton = updatedToolBar?.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton && entry.idRaw === "#TbSave");
  const image = parsed.images.find((entry) => entry.id === "imgToolbarNew");

  assert.equal(updatedButton?.iconRaw, "ImageID(imgToolbarNew)");
  assert.equal(updatedButton?.iconId, "imgToolbarNew");
  assert.ok(image, "Expected inserted pbAny toolbar image entry.");
  assert.match(patchedText, /imgToolbarNew = CatchImage\(#PB_Any, \?TbImgNew\)/);
});

test("roundtrips create-and-assign workflow for statusbar field", () => {
  const { text, parsed: initial, menuId, toolBarId, statusBarId } = parseImageFixture();
  const statusBar = initial.statusbars.find((entry) => entry.id === statusBarId);
  assert.ok(statusBar, "Expected #SbMain statusbar.");
  const imageField = statusBar!.fields.find((field) => field.imageRaw);
  assert.equal(typeof imageField?.source?.line, "number", "Expected statusbar field source line.");

  const { parsed, patchedText } = patchTwiceAndReparse(
    text,
    (document) => applyStatusBarFieldUpdate(document, statusBarId, imageField!.source!.line, {
      widthRaw: imageField!.widthRaw,
      imageRaw: "ImageID(#ImgStatusNew)",
    }),
    (document) => applyImageInsert(document, { inline: false, idRaw: "#ImgStatusNew", imageRaw: '"status-new.png"' })
  );

  const updatedStatusBar = parsed.statusbars.find((entry) => entry.id === statusBarId);
  const updatedField = updatedStatusBar?.fields.find((field) => field.widthRaw === imageField!.widthRaw && field.imageRaw === "ImageID(#ImgStatusNew)");
  const image = parsed.images.find((entry) => entry.id === "#ImgStatusNew");

  assert.ok(updatedField, "Expected updated statusbar image field.");
  assert.equal(updatedField?.imageId, "#ImgStatusNew");
  assert.ok(image, "Expected inserted statusbar image entry.");
  assert.match(patchedText, /StatusBarImage\(0, 0, ImageID\(#ImgStatusNew\)\)/);
});

test("roundtrips gadget property update for visibility tooltip colors", () => {
  const { text } = parseGadgetFixture();
  const args: GadgetPropertyArgs = {
    hiddenRaw: "0",
    disabledRaw: "1",
    tooltipRaw: '"Name field"',
    backColorRaw: "$445566",
    frontColorRaw: "RGB(1, 2, 3)",
    gadgetFontRaw: "FontID(#FontBody)",
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyGadgetPropertyUpdate(document, "#TxtName", args)
  );

  const txtName = parsed.gadgets.find((g) => g.id === "#TxtName");
  assert.ok(txtName, "Expected #TxtName gadget after property update.");
  assert.equal(txtName?.hiddenRaw, "0");
  assert.equal(txtName?.disabledRaw, "1");
  assert.equal(txtName?.tooltip, "Name field");
  assert.equal(txtName?.backColorRaw, "$445566");
  assert.equal(txtName?.frontColorRaw, "RGB(1, 2, 3)");
  assert.equal(txtName?.gadgetFontRaw, "FontID(#FontBody)");
  assert.match(patchedText, /HideGadget\(#TxtName, 0\)/);
  assert.match(patchedText, /DisableGadget\(#TxtName, 1\)/);
  assert.match(patchedText, /GadgetToolTip\(#TxtName, "Name field"\)/);
  assert.match(patchedText, /SetGadgetColor\(#TxtName, #PB_Gadget_BackColor, \$445566\)/);
  assert.match(patchedText, /SetGadgetColor\(#TxtName, #PB_Gadget_FrontColor, RGB\(1, 2, 3\)\)/);
  assert.match(patchedText, /SetGadgetFont\(#TxtName, FontID\(#FontBody\)\)/);
});

test("roundtrips gadget property update for state and removes cleared lines", () => {
  const { text } = parseGadgetFixture();
  const args: GadgetPropertyArgs = {
    stateRaw: "0",
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyGadgetPropertyUpdate(document, "#ChkActive", args)
  );

  const chkActive = parsed.gadgets.find((g) => g.id === "#ChkActive");
  assert.ok(chkActive, "Expected #ChkActive gadget after property update.");
  assert.equal(chkActive?.stateRaw, "0");
  assert.equal(chkActive?.state, 0);
  assert.match(patchedText, /SetGadgetState\(#ChkActive, 0\)/);
  assert.doesNotMatch(patchedText, /SetGadgetState\(#ChkActive, #PB_Checkbox_Checked\)/);
});

test("removes checkbox state lines when the checked property is cleared", () => {
  const { text } = parseGadgetFixture();

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyGadgetPropertyUpdate(document, "#ChkActive", { stateRaw: undefined })
  );

  const chkActive = parsed.gadgets.find((g) => g.id === "#ChkActive");
  assert.ok(chkActive, "Expected #ChkActive gadget after clearing the checked property.");
  assert.equal(chkActive?.stateRaw, undefined);
  assert.equal(chkActive?.state, undefined);
  assert.doesNotMatch(patchedText, /SetGadgetState\(#ChkActive,/);
});


test("roundtrips splitter state update via SetGadgetState", () => {
  const text = loadFixture("fixtures/smoke/07-container-splitter.pbf");

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyGadgetPropertyUpdate(document, "#SplitMain", { stateRaw: "80" })
  );

  const splitter = parsed.gadgets.find((g) => g.id === "#SplitMain");
  assert.ok(splitter, "Expected #SplitMain gadget after state update.");
  assert.equal(splitter?.stateRaw, "80");
  assert.equal(splitter?.state, 80);
  assert.match(patchedText, /SetGadgetState\(#SplitMain, 80\)/);
});

test("roundtrips gadget property update removing managed property lines", () => {
  const { text } = parseGadgetFixture();
  const args: GadgetPropertyArgs = {
    hiddenRaw: undefined,
    disabledRaw: undefined,
    tooltipRaw: undefined,
    frontColorRaw: undefined,
    backColorRaw: undefined,
    gadgetFontRaw: undefined,
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyGadgetPropertyUpdate(document, "#TxtName", args)
  );

  const txtName = parsed.gadgets.find((g) => g.id === "#TxtName");
  assert.ok(txtName, "Expected #TxtName gadget after property removal.");
  assert.equal(txtName?.hiddenRaw, undefined);
  assert.equal(txtName?.disabledRaw, undefined);
  assert.equal(txtName?.tooltipRaw, undefined);
  assert.equal(txtName?.backColorRaw, undefined);
  assert.equal(txtName?.frontColorRaw, undefined);
  assert.doesNotMatch(patchedText, /HideGadget\(#TxtName,/);
  assert.doesNotMatch(patchedText, /DisableGadget\(#TxtName,/);
  assert.doesNotMatch(patchedText, /GadgetToolTip\(#TxtName,/);
  assert.doesNotMatch(patchedText, /SetGadgetColor\(#TxtName, #PB_Gadget_BackColor,/);
  assert.doesNotMatch(patchedText, /SetGadgetColor\(#TxtName, #PB_Gadget_FrontColor,/);
  assert.doesNotMatch(patchedText, /SetGadgetFont\(#TxtName,/);
});


test("roundtrips image pbAny toggle from enum image and updates gadget plus menu references", () => {
  const { text, parsed: initial, menuId, toolBarId, statusBarId } = parseImageFixture();
  const sourceLine = initial.images.find((image) => image.id === "#Img_FrmImages_0")?.source?.line;
  const menu = initial.menus.find((entry) => entry.id === menuId);
  const openItem = menu?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem && entry.idRaw === "#MenuOpen");

  assert.equal(typeof sourceLine, "number", "Expected source line for #Img_FrmImages_0.");
  assert.equal(typeof openItem?.source?.line, "number", "Expected menu item source line.");

  const { parsed, patchedText } = patchThriceAndReparse(
    text,
    (document) => applyGadgetOpenArgsUpdate(document, "#ImgPreview", { imageRaw: "ImageID(ImgOpen)" }),
    (document) => applyMenuEntryUpdate(document, menuId, openItem!.source!.line, {
      kind: MENU_ENTRY_KIND.MenuItem,
      idRaw: openItem!.idRaw,
      textRaw: openItem!.textRaw,
      shortcut: openItem!.shortcut,
      iconRaw: "ImageID(ImgOpen)",
    }),
    (document) => applyImageUpdate(document, sourceLine!, {
      inline: false,
      idRaw: "#PB_Any",
      assignedVar: "ImgOpen",
      imageRaw: '"open.png"',
    })
  );

  const image = parsed.images.find((entry) => entry.id === "ImgOpen");
  const gadget = parsed.gadgets.find((entry) => entry.id === "#ImgPreview");
  const updatedMenu = parsed.menus.find((entry) => entry.id === menuId);
  const updatedOpen = updatedMenu?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem && entry.idRaw === "#MenuOpen");

  assert.ok(image, "Expected pbAny image entry after toggle.");
  assert.equal(image?.pbAny, true);
  assert.equal(image?.firstParam, "#PB_Any");
  assert.equal(image?.variable, "ImgOpen");
  assert.equal(gadget?.imageId, "ImgOpen");
  assert.equal(updatedOpen?.iconId, "ImgOpen");
  assert.match(patchedText, /ImgOpen = LoadImage\(#PB_Any, "open\.png"\)/);
  assert.match(patchedText, /ImageGadget\(#ImgPreview, 10, [^,]+, 32, 32, ImageID\(ImgOpen\)\)/);
  assert.match(patchedText, /MenuItem\(#MenuOpen, "Open", ImageID\(ImgOpen\)\)/);
});

test("roundtrips image pbAny toggle from pbAny image and updates toolbar references", () => {
  const { text, parsed: initial, menuId, toolBarId, statusBarId } = parseImageFixture();
  const sourceLine = initial.images.find((image) => image.id === "Img_FrmImages_2")?.source?.line;
  const toolBar = initial.toolbars.find((entry) => entry.id === toolBarId);
  const saveButton = toolBar?.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton && entry.idRaw === "#TbSave");

  assert.equal(typeof sourceLine, "number", "Expected source line for imgSave.");
  assert.equal(typeof saveButton?.source?.line, "number", "Expected toolbar button source line.");

  const { parsed, patchedText } = patchTwiceAndReparse(
    text,
    (document) => applyToolBarEntryUpdate(document, toolBarId, saveButton!.source!.line, {
      kind: TOOLBAR_ENTRY_KIND.ToolBarImageButton,
      idRaw: saveButton!.idRaw,
      iconRaw: "ImageID(#imgSave)",
      toggle: saveButton!.toggle,
    }),
    (document) => applyImageUpdate(document, sourceLine!, {
      inline: false,
      idRaw: "#imgSave",
      imageRaw: '"save.png"',
    })
  );

  const image = parsed.images.find((entry) => entry.id === "#imgSave");
  const updatedToolBar = parsed.toolbars.find((entry) => entry.id === toolBarId);
  const updatedButton = updatedToolBar?.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton && entry.idRaw === "#TbSave");

  assert.ok(image, "Expected enum image entry after toggle.");
  assert.equal(image?.pbAny, false);
  assert.equal(image?.firstParam, "#imgSave");
  assert.equal(updatedButton?.iconId, "#imgSave");
  assert.match(patchedText, /LoadImage\(#imgSave, "save\.png"\)/);
  assert.match(patchedText, /ToolBarImageButton\(#TbSave, ImageID\(#imgSave\)\)/);
});

test("roundtrips image pbAny toggle updates statusbar references", () => {
  const { text, parsed: initial, menuId, toolBarId, statusBarId } = parseImageFixture();
  const sourceLine = initial.images.find((image) => image.id === "#Img_FrmImages_3")?.source?.line;
  const statusBar = initial.statusbars.find((entry) => entry.id === statusBarId);
  const imageField = statusBar?.fields.find((field) => field.imageId === "#Img_FrmImages_3");

  assert.equal(typeof sourceLine, "number", "Expected source line for #ImgState.");
  assert.equal(typeof imageField?.source?.line, "number", "Expected statusbar field source line.");

  const { parsed, patchedText } = patchTwiceAndReparse(
    text,
    (document) => applyStatusBarFieldUpdate(document, statusBarId, imageField!.source!.line, {
      widthRaw: imageField!.widthRaw,
      imageRaw: "ImageID(ImgState)",
    }),
    (document) => applyImageUpdate(document, sourceLine!, {
      inline: true,
      idRaw: "#PB_Any",
      assignedVar: "ImgState",
      imageRaw: "?ImgState",
    })
  );

  const image = parsed.images.find((entry) => entry.id === "ImgState");
  const updatedStatusBar = parsed.statusbars.find((entry) => entry.id === statusBarId);
  const updatedField = updatedStatusBar?.fields.find((field) => field.imageId === "ImgState");

  assert.ok(image, "Expected pbAny status image entry after toggle.");
  assert.equal(image?.pbAny, true);
  assert.equal(updatedField?.imageId, "ImgState");
  assert.match(patchedText, /ImgState = CatchImage\(#PB_Any, \?ImgState\)/);
  assert.match(patchedText, /StatusBarImage\(0, 0, ImageID\(ImgState\)\)/);
});


test("roundtrips toolbar CurrentImage rebind to an existing parsed image and removes the orphaned image entry", () => {
  const { text, parsed: initial, toolBarId } = parseImageFixture();
  const toolBar = initial.toolbars.find((entry) => entry.id === toolBarId);
  const imageButton = toolBar?.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton && entry.idRaw === "#TbSave");
  const oldImageSourceLine = initial.images.find((image) => image.id === "Img_FrmImages_2")?.source?.line;

  assert.equal(typeof imageButton?.source?.line, "number", "Expected source line for the toolbar image button.");
  assert.equal(typeof oldImageSourceLine, "number", "Expected source line for the old toolbar image entry.");

  const { parsed, patchedText } = patchTwiceAndReparse(
    text,
    (document) => applyToolBarEntryUpdate(document, toolBarId, imageButton!.source!.line, {
      kind: TOOLBAR_ENTRY_KIND.ToolBarImageButton,
      idRaw: imageButton!.idRaw,
      iconRaw: "ImageID(#Img_FrmImages_0)",
      toggle: imageButton!.toggle,
    }),
    (document) => applyImageDelete(document, oldImageSourceLine!)
  );

  const updatedToolBar = parsed.toolbars.find((entry) => entry.id === toolBarId);
  const updatedButton = updatedToolBar?.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton && entry.idRaw === "#TbSave");
  const removedImage = parsed.images.find((entry) => entry.id === "Img_FrmImages_2");

  assert.equal(updatedButton?.iconId, "#Img_FrmImages_0");
  assert.equal(removedImage, undefined);
  assert.match(patchedText, /ToolBarImageButton\(#TbSave,\s*ImageID\(#Img_FrmImages_0\)\)/);
  assert.doesNotMatch(patchedText, /Img_FrmImages_2 = LoadImage\(#PB_Any,\s*"save\.png"\)/);
});


test("roundtrips toolbar CurrentImage auto-create for a new path-like string and removes the orphaned image entry", () => {
  const { text, parsed: initial, toolBarId } = parseImageFixture();
  const toolBar = initial.toolbars.find((entry) => entry.id === toolBarId);
  const imageButton = toolBar?.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton && entry.idRaw === "#TbSave");
  const oldImageSourceLine = initial.images.find((image) => image.id === "Img_FrmImages_2")?.source?.line;

  assert.equal(typeof imageButton?.source?.line, "number", "Expected source line for the toolbar image button.");
  assert.equal(typeof oldImageSourceLine, "number", "Expected source line for the old toolbar image entry.");

  const { parsed, patchedText } = patchThriceAndReparse(
    text,
    (document) => applyToolBarEntryUpdate(document, toolBarId, imageButton!.source!.line, {
      kind: TOOLBAR_ENTRY_KIND.ToolBarImageButton,
      idRaw: imageButton!.idRaw,
      iconRaw: "ImageID(#Img_FrmImages_4)",
      toggle: imageButton!.toggle,
    }),
    (document) => applyImageDelete(document, oldImageSourceLine!),
    (document) => applyImageInsert(document, {
      inline: false,
      idRaw: "#Img_FrmImages_4",
      imageRaw: '"./icons/save-alt.png"',
    })
  );

  const updatedToolBar = parsed.toolbars.find((entry) => entry.id === toolBarId);
  const updatedButton = updatedToolBar?.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton && entry.idRaw === "#TbSave");
  const insertedImage = parsed.images.find((entry) => entry.id === "#Img_FrmImages_4");
  const removedImage = parsed.images.find((entry) => entry.id === "Img_FrmImages_2");

  assert.equal(updatedButton?.iconId, "#Img_FrmImages_4");
  assert.ok(insertedImage, "Expected the new toolbar LoadImage entry to be inserted.");
  assert.equal(insertedImage?.image, "./icons/save-alt.png");
  assert.equal(removedImage, undefined);
  assert.match(patchedText, /LoadImage\(#Img_FrmImages_4,\s*"\.\/icons\/save-alt\.png"\)/);
  assert.match(patchedText, /ToolBarImageButton\(#TbSave,\s*ImageID\(#Img_FrmImages_4\)\)/);
  assert.doesNotMatch(patchedText, /Img_FrmImages_2 = LoadImage\(#PB_Any,\s*"save\.png"\)/);
});


test("roundtrips statusbar CurrentImage rebind to an existing parsed image and removes the orphaned image entry", () => {
  const { text, parsed: initial, statusBarId } = parseImageFixture();
  const statusBar = initial.statusbars.find((entry) => entry.id === statusBarId);
  const imageField = statusBar?.fields.find((field) => field.imageId === "#Img_FrmImages_3");
  const oldImageSourceLine = initial.images.find((image) => image.id === "#Img_FrmImages_3")?.source?.line;

  assert.equal(typeof imageField?.source?.line, "number", "Expected source line for the statusbar image field.");
  assert.equal(typeof oldImageSourceLine, "number", "Expected source line for the old CatchImage entry.");

  const { parsed, patchedText } = patchTwiceAndReparse(
    text,
    (document) => applyStatusBarFieldUpdate(document, statusBarId, imageField!.source!.line, {
      widthRaw: imageField!.widthRaw,
      imageRaw: "ImageID(#Img_FrmImages_0)",
    }),
    (document) => applyImageDelete(document, oldImageSourceLine!)
  );

  const updatedStatusBar = parsed.statusbars.find((entry) => entry.id === statusBarId);
  const updatedField = updatedStatusBar?.fields.find((field) => field.imageId === "#Img_FrmImages_0");
  const removedImage = parsed.images.find((entry) => entry.id === "#Img_FrmImages_3");

  assert.ok(updatedField, "Expected the statusbar field to point at the existing LoadImage entry.");
  assert.equal(removedImage, undefined);
  assert.match(patchedText, /StatusBarImage\(0, 0, ImageID\(#Img_FrmImages_0\)\)/);
  assert.doesNotMatch(patchedText, /CatchImage\(#Img_FrmImages_3,\?Img_FrmImages_3\)/);
});


test("roundtrips statusbar CurrentImage auto-create for a new path-like string and removes the orphaned image entry", () => {
  const { text, parsed: initial, statusBarId } = parseImageFixture();
  const statusBar = initial.statusbars.find((entry) => entry.id === statusBarId);
  const imageField = statusBar?.fields.find((field) => field.imageId === "#Img_FrmImages_3");
  const oldImageSourceLine = initial.images.find((image) => image.id === "#Img_FrmImages_3")?.source?.line;

  assert.equal(typeof imageField?.source?.line, "number", "Expected source line for the statusbar image field.");
  assert.equal(typeof oldImageSourceLine, "number", "Expected source line for the old CatchImage entry.");

  const { parsed, patchedText } = patchThriceAndReparse(
    text,
    (document) => applyStatusBarFieldUpdate(document, statusBarId, imageField!.source!.line, {
      widthRaw: imageField!.widthRaw,
      imageRaw: "ImageID(#Img_FrmImages_2)",
    }),
    (document) => applyImageDelete(document, oldImageSourceLine!),
    (document) => applyImageInsert(document, {
      inline: false,
      idRaw: "#Img_FrmImages_2",
      imageRaw: '"./icons/new.png"',
    })
  );

  const updatedStatusBar = parsed.statusbars.find((entry) => entry.id === statusBarId);
  const updatedField = updatedStatusBar?.fields.find((field) => field.imageId === "#Img_FrmImages_2");
  const insertedImage = parsed.images.find((entry) => entry.id === "#Img_FrmImages_2");
  const removedImage = parsed.images.find((entry) => entry.id === "#Img_FrmImages_3");

  assert.ok(updatedField, "Expected the statusbar field to point at the newly inserted LoadImage entry.");
  assert.ok(insertedImage, "Expected the new LoadImage entry to be inserted.");
  assert.equal(insertedImage?.image, "./icons/new.png");
  assert.equal(removedImage, undefined);
  assert.match(patchedText, /LoadImage\(#Img_FrmImages_2, "\.\/icons\/new\.png"\)/);
  assert.match(patchedText, /StatusBarImage\(0, 0, ImageID\(#Img_FrmImages_2\)\)/);
  assert.doesNotMatch(patchedText, /CatchImage\(#Img_FrmImages_3,\?Img_FrmImages_3\)/);
});

test("roundtrips image pbAny toggle updates button image gadget references", () => {
  const { text, parsed: initial, menuId, toolBarId, statusBarId } = parseImageFixture();
  const sourceLine = initial.images.find((image) => image.id === "#Img_FrmImages_1")?.source?.line;

  assert.equal(typeof sourceLine, "number", "Expected source line for #Img_FrmImages_1.");

  const { parsed, patchedText } = patchTwiceAndReparse(
    text,
    (document) => applyGadgetOpenArgsUpdate(document, "#BtnApply", { imageRaw: "ImageID(ImgRelative)" }),
    (document) => applyImageUpdate(document, sourceLine!, {
      inline: false,
      idRaw: "#PB_Any",
      assignedVar: "ImgRelative",
      imageRaw: '"./icons/apply.png"',
    })
  );

  const image = parsed.images.find((entry) => entry.id === "ImgRelative");
  const gadget = parsed.gadgets.find((entry) => entry.id === "#BtnApply");

  assert.ok(image, "Expected pbAny image entry for button image gadget after toggle.");
  assert.equal(image?.pbAny, true);
  assert.equal(gadget?.kind, "ButtonImageGadget");
  assert.equal(gadget?.imageId, "ImgRelative");
  assert.match(patchedText, /ImgRelative = LoadImage\(#PB_Any, "\.\/icons\/apply\.png"\)/);
  assert.match(patchedText, /ButtonImageGadget\(#BtnApply, 52, [^,]+, 96, 28, ImageID\(ImgRelative\)\)/);
});


test("deletes full menu section", () => {
  const text = loadFixture("fixtures/smoke/08-menu-basic.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyMenuDelete(document, menuId)
  );

  assert.equal(parsed.menus.length, 0);
  assert.doesNotMatch(patchedText, /Create(Image)?Menu\(0,/);
  assert.doesNotMatch(patchedText, /MenuTitle\(/);
  assert.doesNotMatch(patchedText, /OpenSubMenu\(/);
});

test("rejects root close submenu inserts when no submenu is currently open", () => {
  const text = loadFixture("fixtures/smoke/08-menu-basic.pbf");
  const document = new FakeTextDocument(text).asTextDocument();
  const edit = applyMenuEntryInsert(document, menuId, { kind: MENU_ENTRY_KIND.CloseSubMenu });

  assert.equal(edit, undefined);
});

test("deletes full toolbar section", () => {
  const text = loadFixture("fixtures/smoke/09-toolbar-basic.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyToolBarDelete(document, toolBarId)
  );

  assert.equal(parsed.toolbars.length, 0);
  assert.doesNotMatch(patchedText, /CreateTool(bar|Bar)\(0,/);
  assert.doesNotMatch(patchedText, /ToolBar(ImageButton|Separator|ToolTip|Button|StandardButton)\(/);
});

test("deletes full statusbar section", () => {
  const text = loadFixture("fixtures/smoke/10-statusbar-basic.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyStatusBarDelete(document, statusBarId)
  );

  assert.equal(parsed.statusbars.length, 0);
  assert.doesNotMatch(patchedText, /CreateStatusBar\(0,/);
  assert.doesNotMatch(patchedText, /AddStatusBarField\(/);
  assert.doesNotMatch(patchedText, /StatusBar(Text|Image|Progress)\(/);
});


test("roundtrips combined top-level chrome updates in fixture 14", () => {
  const text = loadFixture("fixtures/roundtrip/14-combined-regression.pbf");
  const initial = parseFormDocument(text);
  const menuSourceLine = initial.menus[0]?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem && entry.idRaw === "#MnuOpen")?.source?.line;
  const toolBarSourceLine = initial.toolbars[0]?.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton && entry.idRaw === "#TbSave")?.source?.line;
  const statusFieldSourceLine = initial.statusbars[0]?.fields[2]?.source?.line;

  assert.equal(typeof menuSourceLine, "number", "Expected source line for combined menu entry.");
  assert.equal(typeof toolBarSourceLine, "number", "Expected source line for combined toolbar button.");
  assert.equal(typeof statusFieldSourceLine, "number", "Expected source line for combined statusbar image field.");

  const { parsed, patchedText } = patchThriceAndReparse(
    text,
    (document) => applyMenuEntryUpdate(document, DEFAULT_SECTION_ID, menuSourceLine!, {
      kind: MENU_ENTRY_KIND.MenuItem,
      idRaw: "#MnuOpen",
      textRaw: '"Open Recent"',
      shortcut: "Ctrl+Shift+O",
      iconRaw: "ImageID(#Img_FrmMain_2)",
    }),
    (document) => applyToolBarEntryUpdate(document, DEFAULT_SECTION_ID, toolBarSourceLine!, {
      kind: TOOLBAR_ENTRY_KIND.ToolBarImageButton,
      idRaw: "#TbSave",
      iconRaw: "ImageID(#Img_FrmMain_0)",
    }),
    (document) => applyStatusBarFieldUpdate(document, DEFAULT_SECTION_ID, statusFieldSourceLine!, {
      widthRaw: "140",
      textRaw: "",
      imageRaw: "ImageID(#Img_FrmMain_1)",
      flagsRaw: "#PB_StatusBar_Raised",
      progressBar: false,
      progressRaw: "",
    })
  );

  const menuItem = parsed.menus[0]?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem && entry.idRaw === "#MnuOpen");
  const toolBarButton = parsed.toolbars[0]?.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton && entry.idRaw === "#TbSave");
  const statusField = parsed.statusbars[0]?.fields[2];

  assert.match(patchedText, /MenuItem\(#MnuOpen, "Open Recent" \+ Chr\(9\) \+ "Ctrl\+Shift\+O", ImageID\(#Img_FrmMain_2\)\)/);
  assert.match(patchedText, /ToolBarImageButton\(#TbSave,\s*ImageID\(#Img_FrmMain_0\)\)/);
  assert.match(patchedText, /AddStatusBarField\(140\)\r?\n\s*StatusBarImage\(0, 2, ImageID\(#Img_FrmMain_1\), #PB_StatusBar_Raised\)/);
  assert.equal(menuItem?.text, "Open Recent");
  assert.equal(menuItem?.shortcut, "Ctrl+Shift+O");
  assert.equal(menuItem?.iconId, "#Img_FrmMain_2");
  assert.equal(toolBarButton?.iconId, "#Img_FrmMain_0");
  assert.equal(statusField?.widthRaw, "140");
  assert.equal(statusField?.imageId, "#Img_FrmMain_1");
  assert.equal(statusField?.flagsRaw, "#PB_StatusBar_Raised");
});


test("trims menu constants during selected-entry style updates", () => {
  const text = `; Form Designer for PureBasic - 6.30
Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 220)
  OpenWindow(#FrmMain, x, y, width, height, "Menu")
  CreateMenu(0, WindowID(#FrmMain))
  MenuItem(#MenuOpen, "Open")
EndProcedure
`;

  const { patchedText } = patchAndReparse(text, (document) =>
    applyMenuEntryUpdate(document, menuId, 4, {
      kind: MENU_ENTRY_KIND.MenuItem,
      idRaw: "  #MenuOpenRenamed  ",
      textRaw: '"Open"'
    })
  );

  assert.match(patchedText, /MenuItem\(#MenuOpenRenamed, "Open"\)/);
});

test("trims toolbar variables during selected-entry style updates", () => {
  const text = `; Form Designer for PureBasic - 6.30
Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 220)
  OpenWindow(#FrmMain, x, y, width, height, "Toolbar")
  CreateToolBar(0, WindowID(#FrmMain))
  ToolBarImageButton(#TbOpen, 0)
EndProcedure
`;

  const { patchedText } = patchAndReparse(text, (document) =>
    applyToolBarEntryUpdate(document, toolBarId, 4, {
      kind: TOOLBAR_ENTRY_KIND.ToolBarImageButton,
      idRaw: "  #TbOpenRenamed  ",
      iconRaw: "0"
    })
  );

  assert.match(patchedText, /ToolBarImageButton\(#TbOpenRenamed, 0\)/);
});
