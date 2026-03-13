import test from "node:test";
import assert from "node:assert/strict";

import { parseFormDocument } from "../src/core/parser/formParser";
import {
  applyGadgetPropertyUpdate,
  applyImageDelete,
  applyImageInsert,
  applyImageUpdate,
  applyMenuEntryDelete,
  applyMenuEntryInsert,
  applyMenuEntryUpdate,
  applyStatusBarFieldDelete,
  applyStatusBarFieldInsert,
  applyStatusBarFieldUpdate,
  applyToolBarEntryDelete,
  applyToolBarEntryInsert,
  applyToolBarEntryUpdate,
  type GadgetPropertyArgs,
  type ImageArgs,
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

function parseStatusFixture() {
  const text = loadFixture("fixtures/smoke/10-statusbar-basic.pbf");
  const parsed = parseFormDocument(text);
  const statusBar = parsed.statusbars.find((sb) => sb.id === "#SbMain");

  assert.ok(statusBar, "Expected #SbMain statusbar in statusbar fixture.");
  return { text, parsed, statusBar: statusBar! };
}


function parseImageFixture() {
  const text = loadFixture("fixtures/smoke/11-images-crossrefs.pbf");
  const parsed = parseFormDocument(text);

  return { text, parsed };
}

function parseGadgetFixture() {
  const text = loadFixture("fixtures/smoke/12-visibility-colors-fonts.pbf");
  const parsed = parseFormDocument(text);

  return { text, parsed };
}


test("roundtrips menu entry insert with shortcut and icon", () => {
  const { text } = parseFixture();
  const args: MenuEntryArgs = {
    kind: MENU_ENTRY_KIND.MenuItem,
    idRaw: "#MnuSave",
    textRaw: '"Save"',
    shortcut: "Ctrl+S",
    iconRaw: "ImageID(#ImgSave)",
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
  assert.equal(menu!.entries[3]?.shortcut, "Ctrl+S");
  assert.equal(menu!.entries[3]?.iconId, "#ImgSave");
  assert.match(patchedText, /MenuItem\(#MnuSave, "Save""Ctrl\+S", ImageID\(#ImgSave\)\)/);
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

test("roundtrips toolbar image button insert", () => {
  const { text } = parseFixture();
  const args: ToolBarEntryArgs = {
    kind: TOOLBAR_ENTRY_KIND.ToolBarImageButton,
    idRaw: "#TbSync",
    iconRaw: "ImageID(#ImgSync)",
    toggle: true,
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyToolBarEntryInsert(document, "#TbMain", args)
  );

  const toolBar = parsed.toolbars.find((tb) => tb.id === "#TbMain");
  assert.ok(toolBar, "Expected toolbar after insert.");
  assert.equal(toolBar!.entries.length, 3);
  assert.equal(toolBar!.entries[2]?.kind, TOOLBAR_ENTRY_KIND.ToolBarImageButton);
  assert.equal(toolBar!.entries[2]?.idRaw, "#TbSync");
  assert.equal(toolBar!.entries[2]?.iconId, "#ImgSync");
  assert.equal(toolBar!.entries[2]?.toggle, true);
  assert.match(patchedText, /ToolBarImageButton\(#TbSync, ImageID\(#ImgSync\), #PB_ToolBar_Toggle\)/);
});

test("roundtrips toolbar tooltip update", () => {
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
  assert.match(patchedText, /ToolBarToolTip\(#TbMain, #TbRefresh, "Refresh all data"\)/);
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

test("roundtrips statusbar field insert with text decoration", () => {
  const { text } = parseFixture();
  const args: StatusBarFieldArgs = {
    widthRaw: "240",
    textRaw: '"State"',
    flagsRaw: "#PB_StatusBar_Center",
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyStatusBarFieldInsert(document, "#SbMain", args)
  );

  const statusBar = parsed.statusbars.find((sb) => sb.id === "#SbMain");
  assert.ok(statusBar, "Expected statusbar after insert.");
  assert.equal(statusBar!.fields.length, 2);
  assert.equal(statusBar!.fields[1]?.widthRaw, "240");
  assert.equal(statusBar!.fields[1]?.text, "State");
  assert.equal(statusBar!.fields[1]?.flagsRaw, "#PB_StatusBar_Center");
  assert.match(patchedText, /AddStatusBarField\(240\)/);
  assert.match(patchedText, /StatusBarText\(#SbMain, 1, "State", #PB_StatusBar_Center\)/);
});

test("roundtrips statusbar field update while preserving later field decorations", () => {
  const { text, statusBar } = parseStatusFixture();
  const sourceLine = statusBar.fields[0]?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for statusbar field.");

  const args: StatusBarFieldArgs = {
    widthRaw: "180",
    textRaw: '"Ready now"',
    flagsRaw: "#PB_StatusBar_Right",
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyStatusBarFieldUpdate(document, "#SbMain", sourceLine!, args)
  );

  const updatedStatusBar = parsed.statusbars.find((sb) => sb.id === "#SbMain");
  assert.ok(updatedStatusBar, "Expected statusbar after update.");
  assert.equal(updatedStatusBar!.fields.length, 3);
  assert.equal(updatedStatusBar!.fields[0]?.widthRaw, "180");
  assert.equal(updatedStatusBar!.fields[0]?.text, "Ready now");
  assert.equal(updatedStatusBar!.fields[0]?.flagsRaw, "#PB_StatusBar_Right");
  assert.equal(updatedStatusBar!.fields[1]?.progressBar, true);
  assert.equal(updatedStatusBar!.fields[1]?.progressRaw, "35");
  assert.equal(updatedStatusBar!.fields[2]?.imageId, "#ImgState");
  assert.match(patchedText, /StatusBarProgress\(#SbMain, 1, 35, #PB_StatusBar_Raised\)/);
  assert.match(patchedText, /StatusBarImage\(#SbMain, 2, ImageID\(#ImgState\), #PB_StatusBar_BorderLess\)/);
});

test("roundtrips statusbar field delete reindexes later decoration lines", () => {
  const { text, statusBar } = parseStatusFixture();
  const sourceLine = statusBar.fields[0]?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for statusbar field.");

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyStatusBarFieldDelete(document, "#SbMain", sourceLine!)
  );

  const updatedStatusBar = parsed.statusbars.find((sb) => sb.id === "#SbMain");
  assert.ok(updatedStatusBar, "Expected statusbar after delete.");
  assert.equal(updatedStatusBar!.fields.length, 2);
  assert.equal(updatedStatusBar!.fields[0]?.progressBar, true);
  assert.equal(updatedStatusBar!.fields[0]?.progressRaw, "35");
  assert.equal(updatedStatusBar!.fields[1]?.imageId, "#ImgState");
  assert.doesNotMatch(patchedText, /StatusBarText\(#SbMain, 0, "Ready", #PB_StatusBar_Center\)/);
  assert.match(patchedText, /StatusBarProgress\(#SbMain, 0, 35, #PB_StatusBar_Raised\)/);
  assert.match(patchedText, /StatusBarImage\(#SbMain, 1, ImageID\(#ImgState\), #PB_StatusBar_BorderLess\)/);
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
  const { text, parsed } = parseImageFixture();
  const sourceLine = parsed.images.find((image) => image.id === "imgSave")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for pbAny image.");

  const args: ImageArgs = {
    inline: true,
    idRaw: "#PB_Any",
    assignedVar: "imgSave",
    imageRaw: "?ImgSaveData",
  };

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) =>
    applyImageUpdate(document, sourceLine!, args)
  );

  const updatedImage = updated.images.find((image) => image.id === "imgSave");
  assert.ok(updatedImage, "Expected updated pbAny image entry.");
  assert.equal(updatedImage?.inline, true);
  assert.equal(updatedImage?.imageRaw, "?ImgSaveData");
  assert.equal(updatedImage?.image, "ImgSaveData");
  assert.match(patchedText, /imgSave = CatchImage\(#PB_Any, \?ImgSaveData\)/);
});

test("roundtrips image delete", () => {
  const { text, parsed } = parseImageFixture();
  const sourceLine = parsed.images.find((image) => image.id === "#ImgState")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for inline image.");

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) =>
    applyImageDelete(document, sourceLine!)
  );

  assert.equal(updated.images.some((image) => image.id === "#ImgState"), false);
  assert.doesNotMatch(patchedText, /CatchImage\(#ImgState, \?ImgState\)/);
});

test("roundtrips gadget property update for visibility tooltip colors", () => {
  const { text } = parseGadgetFixture();
  const args: GadgetPropertyArgs = {
    hiddenRaw: "0",
    disabledRaw: "1",
    tooltipRaw: '"Name field"',
    backColorRaw: "$445566",
    frontColorRaw: "RGB(1, 2, 3)",
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
  assert.match(patchedText, /HideGadget\(#TxtName, 0\)/);
  assert.match(patchedText, /DisableGadget\(#TxtName, 1\)/);
  assert.match(patchedText, /GadgetToolTip\(#TxtName, "Name field"\)/);
  assert.match(patchedText, /SetGadgetColor\(#TxtName, #PB_Gadget_BackColor, \$445566\)/);
  assert.match(patchedText, /SetGadgetColor\(#TxtName, #PB_Gadget_FrontColor, RGB\(1, 2, 3\)\)/);
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
  assert.doesNotMatch(patchedText, /SetGadgetState\(#ChkActive, #PB_CheckBox_Checked\)/);
});

test("roundtrips gadget property update removing managed property lines", () => {
  const { text } = parseGadgetFixture();
  const args: GadgetPropertyArgs = {};

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
  assert.match(patchedText, /SetGadgetFont\(#TxtName, FontID\(0\)\)/);
});
