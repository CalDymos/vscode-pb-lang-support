import test from "node:test";
import assert from "node:assert/strict";

import { parseFormDocument } from "../src/core/parser/form-parser";
import { applyGadgetDelete, applyGadgetEventProcUpdate, applyGadgetInsert, applyGadgetItemUpdate, applyGadgetOpenArgsUpdate, applyGadgetPbAnyToggle, applyGadgetPropertyUpdate, applyGadgetReparent, applyMenuEntryEventUpdate, applyMovePatch, applyRectPatch, applyResizeGadgetDelete, applyResizeGadgetMutation, applyResizeGadgetRawUpdate, applyToolBarEntryEventUpdate, applyWindowEventProcUpdate, applyWindowEventUpdate, applyWindowGenerateEventLoopUpdate, applyWindowOpenArgsUpdate, applyWindowPbAnyToggle, applyWindowPropertyUpdate, applyWindowRectPatch, applyWindowVariableNamePatch } from "../src/core/emitter/patch-emitter";
import { loadFixture } from "./helpers/loadFixture";
import { FakeTextDocument } from "./helpers/fakeTextDocument";
import { stripBomAndToLf } from "./helpers/testUtils";
import { applyWorkspaceEditToText } from "./helpers/applyWorkspaceEdit";

// NOTE: TextDocument is imported as a type only — it is used as the parameter
// type of editFactory so that patch emitter functions (which expect vscode.TextDocument)
// are accepted without additional casts at each call site.
import { WorkspaceEdit } from "vscode";
import type { TextDocument } from "vscode";

// NOTE: editFactory receives a vscode.TextDocument, not a FakeTextDocument directly.
// The VSCode Language Server resolves @types/vscode regardless of tsconfig.test.json,
// so passing FakeTextDocument where TextDocument is expected causes TS2345.
// The cast is done once via document.asTextDocument() — do NOT change the parameter
// type back to FakeTextDocument, and do NOT inline the cast at each test call site.
function patchAndReparse(text: string, editFactory: (document: TextDocument) => ReturnType<typeof applyRectPatch>) {
  const document = new FakeTextDocument(text);
  const edit = editFactory(document.asTextDocument());
  assert.ok(edit, "Expected a WorkspaceEdit result.");
  const patchedText = applyWorkspaceEditToText(text, edit!);
  return {
    patchedText,
    parsed: parseFormDocument(patchedText),
  };
}

test("roundtrips window rect changes via procedure defaults", () => {
  const text = loadFixture("fixtures/smoke/01-window-basic.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyWindowRectPatch(document, "#FrmMain", 5, 6, 300, 200)
  );

  assert.match(patchedText, /Procedure OpenFrmMain\(x = 5, y = 6, width = 300, height = 200\)/);
  assert.match(patchedText, /OpenWindow\(#FrmMain, x, y, width, height, "Window Basic"\)/);
  assert.equal(parsed.window?.x, 5);
  assert.equal(parsed.window?.y, 6);
  assert.equal(parsed.window?.w, 300);
  assert.equal(parsed.window?.h, 200);
});


test("patches window X/Y raw values through procedure defaults for #PB_Ignore parity", () => {
  const text = loadFixture("fixtures/smoke/01-window-basic.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyWindowOpenArgsUpdate(document, "#FrmMain", {
      xRaw: "#PB_Ignore",
      yRaw: "24"
    })
  );

  assert.match(patchedText, /Procedure OpenFrmMain\(x = #PB_Ignore, y = 24, width = 220, height = 140\)/);
  assert.match(patchedText, /OpenWindow\(#FrmMain, x, y, width, height, "Window Basic"\)/);
  assert.equal(parsed.window?.xRaw, "#PB_Ignore");
  assert.equal(parsed.window?.yRaw, "24");
  assert.equal(parsed.window?.x, 0);
  assert.equal(parsed.window?.y, 24);
});

test("roundtrips existing ResizeGadget raw expressions without touching constructor geometry", () => {
  const text = loadFixture("fixtures/roundtrip/49-windowgadget-resize-existing-basic.pbf");

  const document = new FakeTextDocument(text);
  const edit = applyResizeGadgetRawUpdate(document.asTextDocument(), "#BtnStretch", {
    xRaw: "10",
    yRaw: "ToolBarHeight(0) + 18",
    wRaw: "FormWindowWidth - 60",
    hRaw: "FormWindowHeight - 140"
  });

  assert.ok(edit, "Expected a WorkspaceEdit result.");
  const patchedText = applyWorkspaceEditToText(text, edit!);
  const parsed = parseFormDocument(patchedText);
  const gadget = parsed.gadgets.find((g) => g.id === "#BtnStretch");

  assert.match(patchedText, /ResizeGadget\(#BtnStretch, 10, ToolBarHeight\(0\) \+ 18, FormWindowWidth - 60, FormWindowHeight - 140\)/);
  assert.match(patchedText, /ButtonGadget\(#BtnStretch, 10, 50, 80, 24, "Stretch"\)/);
  assert.equal(gadget?.resizeYRaw, "ToolBarHeight(0) + 18");
  assert.equal(gadget?.resizeWRaw, "FormWindowWidth - 60");
  assert.equal(gadget?.resizeHRaw, "FormWindowHeight - 140");
  assert.equal(gadget?.y, 50);
  assert.equal(gadget?.w, 80);
});

test("creates missing resize scaffolding when lock editing needs a new ResizeGadget line", () => {
  const text = loadFixture("fixtures/roundtrip/50-windowgadget-resize-create-with-events.pbf");

  const document = new FakeTextDocument(text);
  const edit = applyResizeGadgetMutation(document.asTextDocument(), "#BtnApply", {
    xRaw: "FormWindowWidth - 310",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24"
  });

  assert.ok(edit, "Expected a WorkspaceEdit result.");
  const patchedText = applyWorkspaceEditToText(text, edit!);
  const parsed = parseFormDocument(patchedText);
  const gadget = parsed.gadgets.find((g) => g.id === "#BtnApply");

  assert.match(patchedText, /Declare ResizeGadgetsFrmMain\(\)/);
  assert.match(patchedText, /Procedure ResizeGadgetsFrmMain\(\)\s+  Protected FormWindowWidth, FormWindowHeight\s+  FormWindowWidth = WindowWidth\(#FrmMain\)\s+  FormWindowHeight = WindowHeight\(#FrmMain\)\s+  ResizeGadget\(#BtnApply, FormWindowWidth - 310, 20, 80, 24\)\s+EndProcedure/s);
  assert.match(patchedText, /Select event\s+    Case #PB_Event_SizeWindow\s+      ResizeGadgetsFrmMain\(\)\s+    Case #PB_Event_CloseWindow/s);
  assert.equal(gadget?.resizeXRaw, "FormWindowWidth - 310");
  assert.equal(gadget?.lockLeft, false);
  assert.equal(gadget?.lockRight, true);
});


test("adds resize procedure scaffolding without a sizewindow hook when no event procedure exists", () => {
  const text = loadFixture("fixtures/roundtrip/51-windowgadget-resize-create-no-events.pbf");

  const document = new FakeTextDocument(text);
  const edit = applyResizeGadgetMutation(document.asTextDocument(), "#BtnApply", {
    xRaw: "FormWindowWidth - 310",
    yRaw: "20",
    wRaw: "80",
    hRaw: "24"
  });

  assert.ok(edit, "Expected a WorkspaceEdit result.");
  const patchedText = applyWorkspaceEditToText(text, edit!);
  const parsed = parseFormDocument(patchedText);
  const gadget = parsed.gadgets.find((g) => g.id === "#BtnApply");

  assert.match(patchedText, /Declare ResizeGadgetsFrmMain\(\)/);
  assert.match(patchedText, /Procedure ResizeGadgetsFrmMain\(\)\s+  Protected FormWindowWidth, FormWindowHeight\s+  FormWindowWidth = WindowWidth\(#FrmMain\)\s+  FormWindowHeight = WindowHeight\(#FrmMain\)\s+  ResizeGadget\(#BtnApply, FormWindowWidth - 310, 20, 80, 24\)\s+EndProcedure/s);
  assert.doesNotMatch(patchedText, /Case #PB_Event_SizeWindow/);
  assert.equal(gadget?.resizeXRaw, "FormWindowWidth - 310");
  assert.equal(gadget?.lockLeft, false);
  assert.equal(gadget?.lockRight, true);
});



test("removes now-empty resize scaffolding when the last ResizeGadget line is deleted", () => {
  const text = loadFixture("fixtures/roundtrip/52-windowgadget-resize-delete-last-scaffolding.pbf");

  const document = new FakeTextDocument(text);
  const edit = applyResizeGadgetMutation(document.asTextDocument(), "#BtnApply", {
    xRaw: "",
    yRaw: "",
    wRaw: "",
    hRaw: "",
    deleteResize: true
  });

  assert.ok(edit, "Expected a WorkspaceEdit result.");
  const patchedText = applyWorkspaceEditToText(text, edit!);

  assert.doesNotMatch(patchedText, /Declare ResizeGadgetsFrmMain\(\)/);
  assert.doesNotMatch(patchedText, /Procedure ResizeGadgetsFrmMain\(/);
  assert.doesNotMatch(patchedText, /Case #PB_Event_SizeWindow/);
  assert.equal(
    patchedText,
    [
      "\uFEFF; Form Designer for PureBasic - 6.40",
      "; Warning: this file uses a strict syntax, if you edit it, make sure to respect the Form Designer limitation or it won't be opened again.",
      "",
      ";",
      "; This code is automatically generated by the Form Designer.",
      "; Manual modification is possible to adjust existing commands, but anything else will be dropped when the code is compiled.",
      "; Event procedures need to be put in another source file.",
      ";",
      "",
      "Enumeration FormWindow",
      "  #FrmMain",
      "EndEnumeration",
      "",
      "Enumeration FormGadget",
      "  #BtnApply",
      "EndEnumeration",
      "",
      "",
      "Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 220)",
      "  OpenWindow(#FrmMain, x, y, width, height, \"Main\")",
      "  ButtonGadget(#BtnApply, 10, 20, 80, 24, \"Apply\")",
      "EndProcedure",
      "",
      "Procedure FrmMain_Events(event)",
      "  Select event",
      "    Case #PB_Event_CloseWindow",
      "      ProcedureReturn #False",
      "",
      "    Case #PB_Event_Menu",
      "      Select EventMenu()",
      "      EndSelect",
      "",
      "    Case #PB_Event_Gadget",
      "      Select EventGadget()",
      "      EndSelect",
      "  EndSelect",
      "  ProcedureReturn #True",
      "EndProcedure",
      "",
      ""
    ].join("\r\n")
  );
});

test("inserts a new top-level gadget with original defaults", () => {
  const text = `; Form Designer for PureBasic - 6.40
Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 220)
  OpenWindow(#FrmMain, x, y, width, height, "Main")
EndProcedure
`;

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyGadgetInsert(document, "ButtonGadget", 12, 34)
  );

  assert.match(patchedText, /Enumeration FormGadget\s+  #Button_0\s+EndEnumeration/s);
  assert.match(patchedText, /ButtonGadget\(#Button_0, 12, 34, 100, 25, ""\)/);
  const gadget = parsed.gadgets.find((g) => g.id === "#Button_0");
  assert.ok(gadget, "Expected inserted button gadget.");
  assert.equal(gadget?.kind, "ButtonGadget");
  assert.equal(gadget?.x, 12);
  assert.equal(gadget?.y, 34);
  assert.equal(gadget?.w, 100);
  assert.equal(gadget?.h, 25);
});


test("preserves original top-level Windows toolbar Y expressions when patching gadget rects", () => {
  const text = `; Form Designer for PureBasic - 6.40
Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 220)
  OpenWindow(#FrmMain, x, y, width, height, "Main")
  CreateToolBar(0, WindowID(#FrmMain))
  ButtonGadget(#BtnApply, 10, ToolBarHeight(0) + 10, 80, 24, "Apply")
EndProcedure
`;

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyRectPatch(document, "#BtnApply", 10, 15, 90, 28, undefined, { yRaw: "ToolBarHeight(0) + 15" })
  );

  assert.match(patchedText, /ButtonGadget\(#BtnApply, 10, ToolBarHeight\(0\) \+ 15, 90, 28, "Apply"\)/);
  const gadget = parsed.gadgets.find((g) => g.id === "#BtnApply");
  assert.equal(gadget?.yRaw, "ToolBarHeight(0) + 15");
  assert.equal(gadget?.y, 15);
});

test("inserts a new top-level Windows toolbar gadget with the original toolbar Y padding expression", () => {
  const text = `; Form Designer for PureBasic - 6.40
Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 220)
  OpenWindow(#FrmMain, x, y, width, height, "Main")
  CreateToolBar(0, WindowID(#FrmMain))
EndProcedure
`;

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyGadgetInsert(document, "ButtonGadget", 12, 10, undefined, undefined, undefined, undefined, undefined, "ToolBarHeight(0) + 10")
  );

  assert.match(patchedText, /ButtonGadget\(#Button_0, 12, ToolBarHeight\(0\) \+ 10, 100, 25, ""\)/);
  const gadget = parsed.gadgets.find((g) => g.id === "#Button_0");
  assert.equal(gadget?.yRaw, "ToolBarHeight(0) + 10");
  assert.equal(gadget?.y, 10);
});

test("inserts a new panel child into the active panel item", () => {
  const text = `; Form Designer for PureBasic - 6.40
Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #Panel_0
  #Text_0
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 220)
  OpenWindow(#FrmMain, x, y, width, height, "Main")
  PanelGadget(#Panel_0, 10, 10, 200, 120)
  AddGadgetItem(#Panel_0, -1, "Tab 1")
  TextGadget(#Text_0, 8, 8, 80, 20, "Inside")
  AddGadgetItem(#Panel_0, -1, "Tab 2")
  CloseGadgetList()
EndProcedure
`;

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyGadgetInsert(document, "StringGadget", 22, 44, "#Panel_0", 0)
  );

  assert.match(patchedText, /StringGadget\(#String_0, 22, 44, 100, 25, ""\)[\s\S]*AddGadgetItem\(#Panel_0, -1, "Tab 2"\)/);
  const gadget = parsed.gadgets.find((g) => g.id === "#String_0");
  assert.ok(gadget, "Expected inserted panel child gadget.");
  assert.equal(gadget?.parentId, "#Panel_0");
  assert.equal(gadget?.parentItem, 0);
  assert.equal(gadget?.x, 22);
  assert.equal(gadget?.y, 44);
});

test("inserts a new child gadget into a frame gadget with #PB_Frame_Container", () => {
  const text = `; Form Designer for PureBasic - 6.40
Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #Frame3D_0
  #Text_0
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 220)
  OpenWindow(#FrmMain, x, y, width, height, "Main")
  FrameGadget(#Frame3D_0, 10, 10, 200, 120, "", #PB_Frame_Container)
  TextGadget(#Text_0, 8, 8, 80, 20, "Inside")
  CloseGadgetList()
EndProcedure
`;

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyGadgetInsert(document, "ButtonGadget", 22, 44, "#Frame3D_0")
  );

  assert.match(patchedText, /ButtonGadget\(#Button_0, 22, 44, 100, 25, ""\)[\s\S]*CloseGadgetList\(\)/);
  const gadget = parsed.gadgets.find((g) => g.id === "#Button_0");
  assert.ok(gadget, "Expected inserted frame-container child gadget.");
  assert.equal(gadget?.parentId, "#Frame3D_0");
  assert.equal(gadget?.x, 22);
  assert.equal(gadget?.y, 44);
});

test("inserts a new splitter gadget for two existing top-level siblings", () => {
  const text = `; Form Designer for PureBasic - 6.40
Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #TxtLeft
  #TxtRight
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 220)
  OpenWindow(#FrmMain, x, y, width, height, "Main")
  StringGadget(#TxtLeft, 10, 40, 120, 25, "Left")
  StringGadget(#TxtRight, 140, 40, 120, 25, "Right")
EndProcedure
`;

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyGadgetInsert(document, "SplitterGadget", 10, 80, undefined, undefined, undefined, {
      gadget1Id: "#TxtLeft",
      gadget2Id: "#TxtRight",
    })
  );

  assert.match(patchedText, /SplitterGadget\(#Splitter_0, 10, 80, 100, 25, #TxtLeft, #TxtRight\)/);
  assert.match(patchedText, /SetGadgetState\(#Splitter_0, 12\)/);
  const gadget = parsed.gadgets.find((g) => g.id === "#Splitter_0");
  assert.ok(gadget, "Expected inserted splitter gadget.");
  assert.equal(gadget?.gadget1Id, "#TxtLeft");
  assert.equal(gadget?.gadget2Id, "#TxtRight");
  assert.equal(gadget?.stateRaw, "12");
});

test("rejects splitter insertion when the selected gadgets do not share the same source parent", () => {
  const text = `; Form Designer for PureBasic - 6.40
Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #Panel_0
  #TxtInside
  #TxtRoot
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 220)
  OpenWindow(#FrmMain, x, y, width, height, "Main")
  PanelGadget(#Panel_0, 10, 10, 200, 120)
  AddGadgetItem(#Panel_0, -1, "Tab 1")
  StringGadget(#TxtInside, 8, 8, 80, 20, "Inside")
  CloseGadgetList()
  StringGadget(#TxtRoot, 10, 150, 80, 20, "Root")
EndProcedure
`;

  const document = new FakeTextDocument(text).asTextDocument();
  const edit = applyGadgetInsert(document, "SplitterGadget", 10, 80, "#Panel_0", 0, undefined, {
    gadget1Id: "#TxtInside",
    gadget2Id: "#TxtRoot",
  });

  assert.equal(edit, undefined);
});

test("reparents selected gadgets when inserting a splitter into a different target parent", () => {
  const text = `; Form Designer for PureBasic - 6.40
Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #Container_0
  #TxtLeft
  #TxtRight
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 220)
  OpenWindow(#FrmMain, x, y, width, height, "Main")
  ContainerGadget(#Container_0, 10, 10, 200, 120)
  CloseGadgetList()
  StringGadget(#TxtLeft, 10, 150, 80, 20, "Left")
  StringGadget(#TxtRight, 100, 150, 80, 20, "Right")
EndProcedure
`;

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyGadgetInsert(document, "SplitterGadget", 12, 18, "#Container_0", undefined, undefined, {
      gadget1Id: "#TxtLeft",
      gadget2Id: "#TxtRight",
    })
  );

  assert.match(patchedText, /ContainerGadget\(#Container_0, 10, 10, 200, 120\)[\s\S]*StringGadget\(#TxtLeft, 10, 150, 80, 20, "Left"\)[\s\S]*StringGadget\(#TxtRight, 100, 150, 80, 20, "Right"\)[\s\S]*SplitterGadget\(#Splitter_0, 12, 18, 100, 25, #TxtLeft, #TxtRight\)[\s\S]*SetGadgetState\(#Splitter_0, 12\)[\s\S]*CloseGadgetList\(\)/);

  const left = parsed.gadgets.find((g) => g.id === "#TxtLeft");
  const right = parsed.gadgets.find((g) => g.id === "#TxtRight");
  const splitter = parsed.gadgets.find((g) => g.id === "#Splitter_0");

  assert.equal(left?.parentId, "#Container_0");
  assert.equal(right?.parentId, "#Container_0");
  assert.equal(splitter?.parentId, "#Container_0");
  assert.equal(splitter?.gadget1Id, "#TxtLeft");
  assert.equal(splitter?.gadget2Id, "#TxtRight");
  assert.equal(left?.splitterId, "#Splitter_0");
  assert.equal(right?.splitterId, "#Splitter_0");
});

test("reparents a normal gadget into a container and resets its origin", () => {
  const text = `; Form Designer for PureBasic - 6.40
Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #Container_0
  #BtnApply
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 220)
  OpenWindow(#FrmMain, x, y, width, height, "Main")
  ContainerGadget(#Container_0, 10, 10, 200, 120)
  CloseGadgetList()
  ButtonGadget(#BtnApply, 24, 36, 90, 25, "Apply")
EndProcedure
`;

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyGadgetReparent(document, "#BtnApply", "#Container_0")
  );

  assert.match(patchedText, /ContainerGadget\(#Container_0, 10, 10, 200, 120\)[\s\S]*ButtonGadget\(#BtnApply, 0, 0, 90, 25, "Apply"\)[\s\S]*CloseGadgetList\(\)/);
  const gadget = parsed.gadgets.find((g) => g.id === "#BtnApply");
  assert.equal(gadget?.parentId, "#Container_0");
  assert.equal(gadget?.x, 0);
  assert.equal(gadget?.y, 0);
});

test("reparents a gadget subtree into a panel tab", () => {
  const text = `; Form Designer for PureBasic - 6.40
Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #Panel_0
  #Container_0
  #TxtInner
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 220)
  OpenWindow(#FrmMain, x, y, width, height, "Main")
  PanelGadget(#Panel_0, 10, 10, 200, 120)
  AddGadgetItem(#Panel_0, -1, "Tab 1")
  AddGadgetItem(#Panel_0, -1, "Tab 2")
  CloseGadgetList()
  ContainerGadget(#Container_0, 12, 16, 120, 80)
    TextGadget(#TxtInner, 6, 6, 80, 20, "Inner")
  CloseGadgetList()
EndProcedure
`;

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyGadgetReparent(document, "#Container_0", "#Panel_0", 1)
  );

  assert.match(patchedText, /AddGadgetItem\(#Panel_0, -1, "Tab 1"\)[\s\S]*AddGadgetItem\(#Panel_0, -1, "Tab 2"\)[\s\S]*ContainerGadget\(#Container_0, 0, 0, 120, 80\)[\s\S]*TextGadget\(#TxtInner, 6, 6, 80, 20, "Inner"\)[\s\S]*CloseGadgetList\(\)/);
  const container = parsed.gadgets.find((g) => g.id === "#Container_0");
  const inner = parsed.gadgets.find((g) => g.id === "#TxtInner");
  assert.equal(container?.parentId, "#Panel_0");
  assert.equal(container?.parentItem, 1);
  assert.equal(container?.x, 0);
  assert.equal(container?.y, 0);
  assert.equal(inner?.parentId, "#Container_0");
});

test("reparents a splitter together with its referenced gadgets", () => {
  const text = `; Form Designer for PureBasic - 6.40
Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #Container_0
  #TxtLeft
  #TxtRight
  #SplitMain
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 360, height = 240)
  OpenWindow(#FrmMain, x, y, width, height, "Main")
  ContainerGadget(#Container_0, 10, 10, 220, 120)
  CloseGadgetList()
  StringGadget(#TxtLeft, 16, 20, 90, 25, "Left")
  StringGadget(#TxtRight, 112, 20, 90, 25, "Right")
  SplitterGadget(#SplitMain, 16, 56, 200, 100, #TxtLeft, #TxtRight)
  SetGadgetState(#SplitMain, 80)
EndProcedure
`;

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyGadgetReparent(document, "#SplitMain", "#Container_0")
  );

  assert.match(patchedText, /ContainerGadget\(#Container_0, 10, 10, 220, 120\)[\s\S]*StringGadget\(#TxtLeft, 16, 20, 90, 25, "Left"\)[\s\S]*StringGadget\(#TxtRight, 112, 20, 90, 25, "Right"\)[\s\S]*SplitterGadget\(#SplitMain, 0, 0, 200, 100, #TxtLeft, #TxtRight\)[\s\S]*SetGadgetState\(#SplitMain, 80\)[\s\S]*CloseGadgetList\(\)/);
  const left = parsed.gadgets.find((g) => g.id === "#TxtLeft");
  const right = parsed.gadgets.find((g) => g.id === "#TxtRight");
  const splitter = parsed.gadgets.find((g) => g.id === "#SplitMain");
  assert.equal(left?.parentId, "#Container_0");
  assert.equal(right?.parentId, "#Container_0");
  assert.equal(splitter?.parentId, "#Container_0");
  assert.equal(splitter?.x, 0);
  assert.equal(splitter?.y, 0);
  assert.equal(left?.splitterId, "#SplitMain");
  assert.equal(right?.splitterId, "#SplitMain");
});



test("reparents a splitter and moves its SetGadgetState before the new parent closes", () => {
  const text = `; Form Designer for PureBasic - 6.40
Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #Panel_0
  #TxtLeft
  #TxtRight
  #SplitMain
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 360, height = 260)
  OpenWindow(#FrmMain, x, y, width, height, "Main")
  PanelGadget(#Panel_0, 10, 10, 220, 140)
  AddGadgetItem(#Panel_0, -1, "Tab 1")
  CloseGadgetList()
  StringGadget(#TxtLeft, 16, 20, 90, 25, "Left")
  StringGadget(#TxtRight, 112, 20, 90, 25, "Right")
  SplitterGadget(#SplitMain, 16, 56, 200, 100, #TxtLeft, #TxtRight)
  SetGadgetState(#SplitMain, 80)
EndProcedure
`;

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyGadgetReparent(document, "#SplitMain", "#Panel_0", 0)
  );

  assert.match(patchedText, /AddGadgetItem\(#Panel_0, -1, "Tab 1"\)[\s\S]*StringGadget\(#TxtLeft, 16, 20, 90, 25, "Left"\)[\s\S]*StringGadget\(#TxtRight, 112, 20, 90, 25, "Right"\)[\s\S]*SplitterGadget\(#SplitMain, 0, 0, 200, 100, #TxtLeft, #TxtRight\)[\s\S]*SetGadgetState\(#SplitMain, 80\)[\s\S]*CloseGadgetList\(\)/);
  const splitter = parsed.gadgets.find((g) => g.id === "#SplitMain");
  assert.equal(splitter?.parentId, "#Panel_0");
  assert.equal(splitter?.parentItem, 0);
  assert.equal(splitter?.stateRaw, '80');
});
test("rejects reparenting into the selected gadget subtree", () => {
  const text = `; Form Designer for PureBasic - 6.40
Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #Container_0
  #InnerPanel
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 220)
  OpenWindow(#FrmMain, x, y, width, height, "Main")
  ContainerGadget(#Container_0, 10, 10, 200, 120)
    PanelGadget(#InnerPanel, 6, 6, 120, 80)
    AddGadgetItem(#InnerPanel, -1, "Tab 1")
    CloseGadgetList()
  CloseGadgetList()
EndProcedure
`;

  const document = new FakeTextDocument(text).asTextDocument();
  const edit = applyGadgetReparent(document, "#Container_0", "#InnerPanel", 0);

  assert.equal(edit, undefined);
});

test("deletes a top-level gadget together with its managed lines and event binding", () => {
  const text = `; Form Designer for PureBasic - 6.40
Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #BtnApply
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 220)
  OpenWindow(#FrmMain, x, y, width, height, "Main")
  ButtonGadget(#BtnApply, 10, 20, 90, 25, "Apply")
  GadgetToolTip(#BtnApply, "Run")
  ResizeGadget(#BtnApply, 10, 20, #PB_Ignore, #PB_Ignore)
EndProcedure

Procedure FrmMain_Events(event)
  Select event
    Case #PB_Event_Gadget
      Select EventGadget()
        Case #BtnApply
          HandleApply(EventType())
      EndSelect
  EndSelect
EndProcedure
`;

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyGadgetDelete(document, "#BtnApply")
  );

  assert.doesNotMatch(patchedText, /#BtnApply/);
  assert.doesNotMatch(patchedText, /ButtonGadget\(#BtnApply/);
  assert.doesNotMatch(patchedText, /GadgetToolTip\(#BtnApply/);
  assert.doesNotMatch(patchedText, /ResizeGadget\(#BtnApply/);
  assert.doesNotMatch(patchedText, /Case #BtnApply/);
  assert.equal(parsed.gadgets.find((g) => g.id === "#BtnApply"), undefined);
});

test("merges secondary gadget delete edits when WorkspaceEdit only exposes entries()", () => {
  const text = `; Form Designer for PureBasic - 6.40
Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #BtnApply
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 220)
  OpenWindow(#FrmMain, x, y, width, height, "Main")
  ButtonGadget(#BtnApply, 10, 20, 90, 25, "Apply")
  GadgetToolTip(#BtnApply, "Run")
EndProcedure

Procedure FrmMain_Events(event)
  Select event
    Case #PB_Event_Gadget
      Select EventGadget()
        Case #BtnApply
          HandleApply(EventType())
      EndSelect
  EndSelect
EndProcedure
`;

  const workspaceEditPrototype = WorkspaceEdit.prototype as WorkspaceEdit & {
    getOperations?: () => Array<unknown>;
  };
  const originalGetOperations = workspaceEditPrototype.getOperations;

  try {
    delete workspaceEditPrototype.getOperations;

    const document = new FakeTextDocument(text);
    const edit = applyGadgetDelete(document.asTextDocument(), "#BtnApply");
    assert.ok(edit, "Expected a WorkspaceEdit result.");

    workspaceEditPrototype.getOperations = originalGetOperations;

    const patchedText = applyWorkspaceEditToText(text, edit!);
    const parsed = parseFormDocument(patchedText);

    assert.doesNotMatch(patchedText, /ButtonGadget\(#BtnApply/);
    assert.doesNotMatch(patchedText, /Case #BtnApply/);
    assert.equal(parsed.gadgets.find((g) => g.id === "#BtnApply"), undefined);
  }
  finally {
    workspaceEditPrototype.getOperations = originalGetOperations;
  }
});

test("deletes a panel gadget recursively with all child gadgets and tab items", () => {
  const text = loadFixture("fixtures/smoke/05-container-panel.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyGadgetDelete(document, "#PnlMain")
  );

  assert.doesNotMatch(patchedText, /#PnlMain/);
  assert.doesNotMatch(patchedText, /#TxtTab0/);
  assert.doesNotMatch(patchedText, /#StrTab1/);
  assert.doesNotMatch(patchedText, /#BtnTab2/);
  assert.doesNotMatch(patchedText, /AddGadgetItem\(#PnlMain/);
  assert.doesNotMatch(patchedText, /CloseGadgetList\(\)/);
  assert.equal(parsed.gadgets.length, 0);
});

test("deletes a frame gadget with #PB_Frame_Container recursively including CloseGadgetList", () => {
  const text = `; Form Designer for PureBasic - 6.40
Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #Frame3D_0
  #Text_0
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 220)
  OpenWindow(#FrmMain, x, y, width, height, "Main")
  FrameGadget(#Frame3D_0, 10, 10, 200, 120, "", #PB_Frame_Container)
  TextGadget(#Text_0, 8, 8, 80, 20, "Inside")
  CloseGadgetList()
EndProcedure
`;

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyGadgetDelete(document, "#Frame3D_0")
  );

  assert.doesNotMatch(patchedText, /#Frame3D_0/);
  assert.doesNotMatch(patchedText, /#Text_0/);
  assert.doesNotMatch(patchedText, /CloseGadgetList\(\)/);
  assert.equal(parsed.gadgets.length, 0);
});

test("deletes a custom gadget including the original marker pair", () => {
  const text = `; Form Designer for PureBasic - 6.40
Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #Fancy
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 220)
  OpenWindow(#FrmMain, x, y, width, height, "Main")
  ; 0 Custom gadget initialisation (do Not remove this line)
  InitFancyWidget()
  ; 0 Custom gadget creation (do not remove this line) FancyWidget(%id%, %x%, %y%, %w%, %h%, %txt%)
  FancyWidget(#Fancy, 10, 20, 90, 24, "Fancy")
  GadgetToolTip(#Fancy, "Run")
EndProcedure
`;

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyGadgetDelete(document, "#Fancy")
  );

  assert.doesNotMatch(patchedText, /#Fancy/);
  assert.doesNotMatch(patchedText, /Custom gadget initialisation/);
  assert.doesNotMatch(patchedText, /InitFancyWidget\(\)/);
  assert.doesNotMatch(patchedText, /Custom gadget creation/);
  assert.doesNotMatch(patchedText, /FancyWidget\(/);
  assert.doesNotMatch(patchedText, /GadgetToolTip\(#Fancy/);
  assert.equal(parsed.gadgets.length, 0);
});

test("deletes a container recursively when it contains a custom gadget", () => {
  const text = `; Form Designer for PureBasic - 6.40
Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #Container_0
  #Fancy
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 220)
  OpenWindow(#FrmMain, x, y, width, height, "Main")
  ContainerGadget(#Container_0, 10, 10, 200, 120)
  ; 0 Custom gadget initialisation (do Not remove this line)
  InitFancyWidget()
  ; 0 Custom gadget creation (do not remove this line) FancyWidget(%id%, %x%, %y%, %w%, %h%, %txt%)
  FancyWidget(#Fancy, 8, 8, 90, 24, "Fancy")
  CloseGadgetList()
EndProcedure
`;

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyGadgetDelete(document, "#Container_0")
  );

  assert.doesNotMatch(patchedText, /#Container_0/);
  assert.doesNotMatch(patchedText, /#Fancy/);
  assert.doesNotMatch(patchedText, /Custom gadget initialisation/);
  assert.doesNotMatch(patchedText, /InitFancyWidget\(\)/);
  assert.doesNotMatch(patchedText, /Custom gadget creation/);
  assert.doesNotMatch(patchedText, /FancyWidget\(/);
  assert.doesNotMatch(patchedText, /CloseGadgetList\(\)/);
  assert.equal(parsed.gadgets.length, 0);
});

test("deletes a splitter gadget and keeps its referenced gadgets", () => {
  const text = loadFixture("fixtures/smoke/07-container-splitter.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyGadgetDelete(document, "#SplitMain")
  );

  assert.doesNotMatch(patchedText, /#SplitMain/);
  assert.doesNotMatch(patchedText, /SplitterGadget\(#SplitMain/);
  assert.doesNotMatch(patchedText, /SetGadgetState\(#SplitMain/);

  const left = parsed.gadgets.find((g) => g.id === "#TxtLeft");
  const right = parsed.gadgets.find((g) => g.id === "#TxtRight");
  assert.ok(left);
  assert.ok(right);
  assert.equal(left?.splitterId, undefined);
  assert.equal(right?.splitterId, undefined);
  assert.equal(parsed.gadgets.find((g) => g.id === "#SplitMain"), undefined);
});

test("keeps a splitter child gadget when the original delete logic would no-op", () => {
  const text = loadFixture("fixtures/smoke/07-container-splitter.pbf");
  const document = new FakeTextDocument(text);
  const edit = applyGadgetDelete(document.asTextDocument(), "#TxtLeft");
  assert.equal(edit, undefined);
});

test("deletes descendants of a splitter child container but keeps the container itself", () => {
  const text = `; Form Designer for PureBasic - 6.40
Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #LeftPane
  #InnerText
  #RightPane
  #SplitMain
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 220)
  OpenWindow(#FrmMain, x, y, width, height, "Main")
  ContainerGadget(#LeftPane, 10, 40, 120, 100)
  TextGadget(#InnerText, 8, 8, 80, 20, "Inside")
  CloseGadgetList()
  ContainerGadget(#RightPane, 150, 40, 120, 100)
  CloseGadgetList()
  SplitterGadget(#SplitMain, 10, 40, 260, 100, #LeftPane, #RightPane)
  SetGadgetState(#SplitMain, 120)
EndProcedure
`;

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyGadgetDelete(document, "#LeftPane")
  );

  assert.match(patchedText, /ContainerGadget\(#LeftPane, 10, 40, 120, 100\)/);
  assert.doesNotMatch(patchedText, /#InnerText/);
  assert.match(patchedText, /SplitterGadget\(#SplitMain, 10, 40, 260, 100, #LeftPane, #RightPane\)/);

  const leftPane = parsed.gadgets.find((g) => g.id === "#LeftPane");
  const innerText = parsed.gadgets.find((g) => g.id === "#InnerText");
  const splitter = parsed.gadgets.find((g) => g.id === "#SplitMain");

  assert.ok(leftPane);
  assert.equal(leftPane?.splitterId, "#SplitMain");
  assert.equal(innerText, undefined);
  assert.ok(splitter);
  assert.equal(splitter?.gadget1Id, "#LeftPane");
});

test("deletes splitter-owned child gadgets when deleting their parent container subtree", () => {
  const text = `; Form Designer for PureBasic - 6.40
Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #Container_0
  #LeftPane
  #InnerLeft
  #RightPane
  #SplitMain
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 340, height = 240)
  OpenWindow(#FrmMain, x, y, width, height, "Main")
  ContainerGadget(#Container_0, 10, 30, 300, 150)
  ContainerGadget(#LeftPane, 8, 8, 110, 110)
  TextGadget(#InnerLeft, 6, 6, 80, 20, "Left")
  CloseGadgetList()
  ContainerGadget(#RightPane, 126, 8, 110, 110)
  CloseGadgetList()
  SplitterGadget(#SplitMain, 8, 8, 228, 110, #LeftPane, #RightPane)
  SetGadgetState(#SplitMain, 114)
  CloseGadgetList()
EndProcedure
`;

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyGadgetDelete(document, "#Container_0")
  );

  assert.doesNotMatch(patchedText, /#Container_0/);
  assert.doesNotMatch(patchedText, /#LeftPane/);
  assert.doesNotMatch(patchedText, /#InnerLeft/);
  assert.doesNotMatch(patchedText, /#RightPane/);
  assert.doesNotMatch(patchedText, /#SplitMain/);
  assert.doesNotMatch(patchedText, /CloseGadgetList\(\)/);
  assert.equal(parsed.gadgets.length, 0);
});

test("roundtrips normal gadget rect changes", () => {
  const text = loadFixture("fixtures/smoke/03-gadgets-basic.pbf");

  const { parsed } = patchAndReparse(text, (document) =>
    applyRectPatch(document, "#BtnOk", 40, 90, 110, 30)
  );

  const button = parsed.gadgets.find((g) => g.id === "#BtnOk");
  assert.ok(button, "Expected patched button gadget.");
  assert.equal(button?.x, 40);
  assert.equal(button?.y, 90);
  assert.equal(button?.w, 110);
  assert.equal(button?.h, 30);
});

test("roundtrips #PB_Any gadget move changes via assigned variable", () => {
  const text = loadFixture("fixtures/smoke/03-gadgets-basic.pbf");

  const { parsed } = patchAndReparse(text, (document) =>
    applyMovePatch(document, "gInput", 25, 44)
  );

  const input = parsed.gadgets.find((g) => g.id === "gInput");
  assert.ok(input, "Expected patched #PB_Any gadget.");
  assert.equal(input?.pbAny, true);
  assert.equal(input?.variable, "gInput");
  assert.equal(input?.x, 25);
  assert.equal(input?.y, 44);
});


test("roundtrips window property update inserting managed lines", () => {
  const text = loadFixture("fixtures/smoke/01-window-basic.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyWindowPropertyUpdate(document, "#FrmMain", {
      hiddenRaw: "1",
      disabledRaw: "0",
      colorRaw: "RGB(17, 34, 51)",
    })
  );

  assert.match(patchedText, /HideWindow\(#FrmMain, 1\)/);
  assert.match(patchedText, /DisableWindow\(#FrmMain, 0\)/);
  assert.match(patchedText, /SetWindowColor\(#FrmMain, RGB\(17, 34, 51\)\)/);
  assert.equal(parsed.window?.hidden, true);
  assert.equal(parsed.window?.disabled, false);
  assert.equal(parsed.window?.color, 0x332211);
});

test("roundtrips window property update removing managed lines", () => {
  const text = `; Form Designer for PureBasic - 6.20
;
; EnableExplicit
;
;   Warning: This file is generated by the Form Designer.
;            Manual changes will be lost after recompilation!

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 220, height = 140)
  OpenWindow(#FrmMain, x, y, width, height, "Window Basic")
  HideWindow(#FrmMain, 1)
  DisableWindow(#FrmMain, 1)
  SetWindowColor(#FrmMain, $112233)
EndProcedure
`;

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyWindowPropertyUpdate(document, "#FrmMain", {
      hiddenRaw: undefined,
      disabledRaw: undefined,
      colorRaw: undefined,
    })
  );

  assert.doesNotMatch(patchedText, /HideWindow\(#FrmMain,/);
  assert.doesNotMatch(patchedText, /DisableWindow\(#FrmMain,/);
  assert.doesNotMatch(patchedText, /SetWindowColor\(#FrmMain,/);
  assert.equal(parsed.window?.hidden, undefined);
  assert.equal(parsed.window?.disabled, undefined);
  assert.equal(parsed.window?.color, undefined);
});

test("roundtrips window property update for #PB_Any windows via assigned variable", () => {
  const text = `; Form Designer for PureBasic - 6.20
;
; EnableExplicit
;
;   Warning: This file is generated by the Form Designer.
;            Manual changes will be lost after recompilation!

Enumeration FormWindow
EndEnumeration

Enumeration FormGadget
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 220, height = 140)
  win = OpenWindow(#PB_Any, x, y, width, height, "Window Basic")
EndProcedure
`;

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyWindowPropertyUpdate(document, "win", {
      hiddenRaw: "0",
      colorRaw: "$123456",
    })
  );

  assert.match(patchedText, /HideWindow\(win, 0\)/);
  assert.match(patchedText, /SetWindowColor\(win, \$123456\)/);
  assert.equal(parsed.window?.id, "win");
  assert.equal(parsed.window?.pbAny, true);
  assert.equal(parsed.window?.hidden, false);
  assert.equal(parsed.window?.color, 0x123456);
});


test("roundtrips window OpenWindow arg updates for caption, flags and parent", () => {
  const text = loadFixture("fixtures/smoke/01-window-basic.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyWindowOpenArgsUpdate(document, "#FrmMain", {
      captionRaw: '"Window Advanced"',
      flagsExpr: "#PB_Window_SystemMenu|#PB_Window_SizeGadget",
      parentRaw: "WindowID(#FrmParent)",
    })
  );

  assert.match(
    patchedText,
    /OpenWindow\(#FrmMain, x, y, width, height, "Window Advanced", #PB_Window_SystemMenu\|#PB_Window_SizeGadget, WindowID\(#FrmParent\)\)/
  );
  assert.equal(parsed.window?.caption, "Window Advanced");
  assert.equal(parsed.window?.title, "Window Advanced");
  assert.deepEqual(parsed.window?.knownFlags, ["#PB_Window_SystemMenu", "#PB_Window_SizeGadget"]);
  assert.equal(parsed.window?.parent, "#FrmParent");
});

test("roundtrips window OpenWindow arg updates for #PB_Any windows and clears optional params", () => {
  const text = `; Form Designer for PureBasic - 6.20
;
; EnableExplicit
;
;   Warning: This file is generated by the Form Designer.
;            Manual changes will be lost after recompilation!

Enumeration FormWindow
EndEnumeration

Enumeration FormGadget
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 220, height = 140)
  win = OpenWindow(#PB_Any, x, y, width, height, "Window Basic", #PB_Window_SystemMenu, WindowID(#FrmParent))
EndProcedure
`;

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyWindowOpenArgsUpdate(document, "win", {
      captionRaw: "Title$",
    })
  );

  assert.match(patchedText, /win = OpenWindow\(#PB_Any, x, y, width, height, Title\$\)/);
  assert.doesNotMatch(patchedText, /#PB_Window_SystemMenu/);
  assert.doesNotMatch(patchedText, /WindowID\(#FrmParent\)/);
  assert.equal(parsed.window?.id, "win");
  assert.equal(parsed.window?.pbAny, true);
  assert.equal(parsed.window?.caption, "Title$");
  assert.equal(parsed.window?.captionVariable, true);
  assert.equal(parsed.window?.flagsExpr, undefined);
  assert.equal(parsed.window?.parent, undefined);
});


test("roundtrips window OpenWindow arg updates for raw parent expressions without WindowID wrapping", () => {
  const text = loadFixture("fixtures/smoke/01-window-basic.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyWindowOpenArgsUpdate(document, "#FrmMain", {
      parentRaw: "ParentWindowHandle()",
    })
  );

  assert.match(
    patchedText,
    /OpenWindow\(#FrmMain, x, y, width, height, "Window Basic", 0, ParentWindowHandle\(\)\)/
  );
  assert.doesNotMatch(patchedText, /WindowID\(ParentWindowHandle\(\)\)/);
  assert.equal(parsed.window?.parentRaw, "ParentWindowHandle()");
  assert.equal(parsed.window?.parent, "=ParentWindowHandle()");
});


test("roundtrips gadget constructor arg updates for text and flags", () => {
  const text = loadFixture("fixtures/smoke/03-gadgets-basic.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyGadgetOpenArgsUpdate(document, "gInput", {
      textRaw: 'Value$',
      flagsExpr: '#PB_String_ReadOnly',
    })
  );

  assert.match(patchedText, /gInput = StringGadget\(#PB_Any, 10, 36, 220, 24, Value\$, #PB_String_ReadOnly\)/);
  const input = parsed.gadgets.find((g) => g.id === "gInput");
  assert.ok(input, "Expected patched #PB_Any string gadget.");
  assert.equal(input?.pbAny, true);
  assert.equal(input?.textRaw, 'Value$');
  assert.equal(input?.text, 'Value$');
  assert.equal(input?.textVariable, true);
  assert.equal(input?.flagsExpr, '#PB_String_ReadOnly');
});

test("roundtrips gadget constructor arg updates for range, image and cleared flags", () => {
  const text = `; Form Designer for PureBasic - 6.20
;
; EnableExplicit
;
;   Warning: This file is generated by the Form Designer.
;            Manual changes will be lost after recompilation!

Enumeration FormWindow
  #FrmCtor
EndEnumeration

Enumeration FormGadget
  #PrgMain
  #ImgPreview
  #BtnSave
EndEnumeration

Procedure OpenFrmCtor(x = 0, y = 0, width = 320, height = 180)
  OpenWindow(#FrmCtor, x, y, width, height, "Ctor")
  ProgressBarGadget(#PrgMain, 10, 10, 160, 20, 0, 100, #PB_ProgressBar_Smooth)
  ImageGadget(#ImgPreview, 10, 40, 32, 32, ImageID(#ImgOpen), #PB_Image_Border)
  ButtonImageGadget(#BtnSave, 60, 40, 80, 24, ImageID(#ImgOpen), #PB_Button_Toggle)
EndProcedure
`;

  const first = patchAndReparse(text, (document) =>
    applyGadgetOpenArgsUpdate(document, "#PrgMain", {
      minRaw: '5',
      maxRaw: '95',
      flagsExpr: '#PB_ProgressBar_Vertical',
    })
  );

  assert.match(first.patchedText, /ProgressBarGadget\(#PrgMain, 10, 10, 160, 20, 5, 95, #PB_ProgressBar_Vertical\)/);
  const progress = first.parsed.gadgets.find((g) => g.id === '#PrgMain');
  assert.ok(progress, 'Expected patched progress gadget.');
  assert.equal(progress?.min, 5);
  assert.equal(progress?.max, 95);
  assert.equal(progress?.flagsExpr, '#PB_ProgressBar_Vertical');

  const second = patchAndReparse(first.patchedText, (document) =>
    applyGadgetOpenArgsUpdate(document, "#ImgPreview", {
      imageRaw: 'ImageID(#ImgAlt)',
      flagsExpr: '',
    })
  );

  assert.match(second.patchedText, /ImageGadget\(#ImgPreview, 10, 40, 32, 32, ImageID\(#ImgAlt\)\)/);
  assert.doesNotMatch(second.patchedText, /#PB_Image_Border/);
  const image = second.parsed.gadgets.find((g) => g.id === '#ImgPreview');
  assert.ok(image, 'Expected patched image gadget.');
  assert.equal(image?.imageId, '#ImgAlt');
  assert.equal(image?.flagsExpr, undefined);

  const third = patchAndReparse(second.patchedText, (document) =>
    applyGadgetOpenArgsUpdate(document, "#BtnSave", {
      imageRaw: "0",
      flagsExpr: "#PB_Button_Default",
    })
  );

  assert.match(third.patchedText, /ButtonImageGadget\(#BtnSave, 60, 40, 80, 24, 0, #PB_Button_Default\)/);
  const button = third.parsed.gadgets.find((g) => g.id === "#BtnSave");
  assert.ok(button, "Expected patched button image gadget.");
  assert.equal(button?.imageRaw, "0");
  assert.equal(button?.imageId, "0");
  assert.equal(button?.flagsExpr, "#PB_Button_Default");
});

test("roundtrips gadget constructor arg updates for splitter references and flags", () => {
  const text = loadFixture("fixtures/smoke/07-container-splitter.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyGadgetOpenArgsUpdate(document, "#SplitMain", {
      gadget1Raw: "#TxtRight",
      gadget2Raw: "#TxtLeft",
      flagsExpr: "#PB_Splitter_Separator",
    })
  );

  assert.match(
    patchedText,
    /SplitterGadget\(#SplitMain, 10, 40, 250, 120, #TxtRight, #TxtLeft, #PB_Splitter_Separator\)/
  );

  const splitter = parsed.gadgets.find((g) => g.id === "#SplitMain");
  assert.ok(splitter, "Expected patched splitter gadget.");
  assert.equal(splitter?.gadget1Id, "#TxtRight");
  assert.equal(splitter?.gadget2Id, "#TxtLeft");
  assert.equal(splitter?.flagsExpr, "#PB_Splitter_Separator");

  const left = parsed.gadgets.find((g) => g.id === "#TxtLeft");
  const right = parsed.gadgets.find((g) => g.id === "#TxtRight");
  assert.equal(left?.splitterId, "#SplitMain");
  assert.equal(right?.splitterId, "#SplitMain");
});



test("roundtrips window event include insertion", () => {
  const text = loadFixture("fixtures/smoke/01-window-basic.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyWindowEventUpdate(document, "#FrmMain", {
      eventFileRaw: '"events/form-main.pbi"',
    })
  );

  assert.match(patchedText, /XIncludeFile "events\/form-main\.pbi"(?:\r?\n)+Procedure OpenFrmMain/);
  assert.equal(parsed.window?.eventFile, "events/form-main.pbi");
  assert.equal(parsed.window?.eventProc, undefined);
  assert.equal(parsed.window?.generateEventLoop, undefined);
});


test("roundtrips window event proc update inside separate _Events(event) procedure", () => {
  const text = loadFixture("fixtures/smoke/13-events-and-parent-window.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyWindowEventProcUpdate(document, "#FrmEventsParent", "HandleFrmEventsParentUpdated")
  );

  assert.match(patchedText, /Default\s+HandleFrmEventsParentUpdated\(event, #FrmEventsParent\)/s);
  assert.equal(parsed.window?.eventProc, "HandleFrmEventsParentUpdated");
  assert.equal(parsed.window?.generateEventLoop, true);
});

test("roundtrips window event proc removal without leaving an empty Default branch behind", () => {
  const text = loadFixture("fixtures/smoke/13-events-and-parent-window.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyWindowEventProcUpdate(document, "#FrmEventsParent", undefined)
  );

  assert.doesNotMatch(patchedText, /Default\s*$/m);
  assert.doesNotMatch(patchedText, /Default\s+HandleFrmEventsParent\(event, #FrmEventsParent\)/s);
  assert.equal(parsed.window?.eventProc, undefined);
  assert.equal(parsed.window?.generateEventLoop, true);
});

test("roundtrips window generateEventLoop insertion via separate _Events(event) procedure", () => {
  const text = loadFixture("fixtures/smoke/01-window-basic.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyWindowGenerateEventLoopUpdate(document, "#FrmMain", true)
  );

  assert.match(patchedText, /Procedure FrmMain_Events\(event\)\s+  Select event\s+    Case #PB_Event_CloseWindow\s+      ProcedureReturn #False\s+\s+    Case #PB_Event_Menu\s+      Select EventMenu\(\)\s+      EndSelect\s+\s+    Case #PB_Event_Gadget\s+      Select EventGadget\(\)\s+      EndSelect\s+  EndSelect\s+  ProcedureReturn #True\s+EndProcedure/s);
  assert.equal(parsed.window?.generateEventLoop, true);
  assert.equal(parsed.window?.eventProc, undefined);
});

test("roundtrips window generateEventLoop removal for a separate _Events(event) procedure without cases", () => {
  const text = loadFixture("fixtures/smoke/13-events-and-parent-window.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyWindowGenerateEventLoopUpdate(document, "#FrmEventsParent", false)
  );

  assert.doesNotMatch(patchedText, /Select EventGadget\(\)/);
  assert.equal(parsed.window?.generateEventLoop, undefined);
  assert.equal(parsed.window?.eventProc, undefined);
});


test("roundtrips combined window event bootstrap updates from a plain window fixture", () => {
  const text = loadFixture("fixtures/smoke/01-window-basic.pbf");

  let patchedText = text;

  let document = new FakeTextDocument(patchedText);
  let edit = applyWindowEventUpdate(document.asTextDocument(), "#FrmMain", {
    eventFileRaw: '"events/form-main.pbi"',
  });
  assert.ok(edit, "Expected event include edit.");
  patchedText = applyWorkspaceEditToText(patchedText, edit!);

  document = new FakeTextDocument(patchedText);
  edit = applyWindowGenerateEventLoopUpdate(document.asTextDocument(), "#FrmMain", true);
  assert.ok(edit, "Expected generateEventLoop edit.");
  patchedText = applyWorkspaceEditToText(patchedText, edit!);

  document = new FakeTextDocument(patchedText);
  edit = applyWindowEventProcUpdate(document.asTextDocument(), "#FrmMain", "HandleFrmMain");
  assert.ok(edit, "Expected window event proc edit.");
  patchedText = applyWorkspaceEditToText(patchedText, edit!);

  const parsed = parseFormDocument(patchedText);

  assert.match(patchedText, /XIncludeFile "events\/form-main\.pbi"(?:\r?\n)+Procedure OpenFrmMain/);
  assert.match(patchedText, /Procedure FrmMain_Events\(event\)\s+Select event/s);
  assert.match(patchedText, /Case #PB_Event_Gadget\s+Select EventGadget\(\)\s+EndSelect\s+Default\s+HandleFrmMain\(event, #FrmMain\)/s);
  assert.equal(parsed.window?.eventFile, "events/form-main.pbi");
  assert.equal(parsed.window?.generateEventLoop, true);
  assert.equal(parsed.window?.eventProc, "HandleFrmMain");
  assert.equal(parsed.window?.hasEventGadgetBlock, true);
  assert.equal(parsed.window?.hasEventGadgetCaseBranches, undefined);
});


test("roundtrips gadget event proc update inside existing EventGadget block", () => {
  const text = loadFixture("fixtures/smoke/15-object-event-bindings.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyGadgetEventProcUpdate(document, "#BtnApply", "HandleApplyUpdated")
  );

  assert.match(patchedText, /Case #BtnApply\s+HandleApplyUpdated\s*\(EventType\(\)\)/s);
  const button = parsed.gadgets.find((g) => g.id === "#BtnApply");
  assert.equal(button?.eventProc, "HandleApplyUpdated");
});

test("roundtrips gadget event proc removal by deleting the Case branch", () => {
  const text = loadFixture("fixtures/smoke/15-object-event-bindings.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyGadgetEventProcUpdate(document, "#BtnApply", undefined)
  );

  assert.doesNotMatch(patchedText, /Case #BtnApply/);
  assert.equal(parsed.gadgets.find((g) => g.id === "#BtnApply")?.eventProc, undefined);
  assert.equal(parsed.window?.generateEventLoop, true);
});

test("preserves the exact gadget event proc grid string without trimming", () => {
  const text = loadFixture("fixtures/smoke/15-object-event-bindings.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyGadgetEventProcUpdate(document, "#BtnApply", "  HandleApplyUpdated  ")
  );

  assert.match(patchedText, /Case #BtnApply\s+HandleApplyUpdated\s*\(EventType\(\)\)/s);
  assert.equal(parsed.gadgets.find((g) => g.id === "#BtnApply")?.eventProc, "HandleApplyUpdated");
});


test("roundtrips menu entry event update inside existing EventMenu block", () => {
  const text = loadFixture("fixtures/smoke/15-object-event-bindings.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyMenuEntryEventUpdate(document, "#MenuOpen", "HandleMenuOpenUpdated")
  );

  assert.match(patchedText, /Case #MenuOpen\s+HandleMenuOpenUpdated\(EventMenu\(\)\)/s);
  const menuItem = parsed.menus[0]?.entries.find((entry) => entry.idRaw === "#MenuOpen");
  assert.equal(menuItem?.event, "HandleMenuOpenUpdated");
});

test("roundtrips menu entry event removal by deleting the Case branch", () => {
  const text = loadFixture("fixtures/smoke/15-object-event-bindings.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyMenuEntryEventUpdate(document, "#MenuOpen", undefined)
  );

  assert.doesNotMatch(patchedText, /Case #MenuOpen/);
  const menuItem = parsed.menus[0]?.entries.find((entry) => entry.idRaw === "#MenuOpen");
  assert.equal(menuItem?.event, undefined);
  assert.equal(parsed.window?.generateEventLoop, true);
});



test("roundtrips toolbar entry event update inside existing EventMenu block", () => {
  const text = loadFixture("fixtures/smoke/15-object-event-bindings.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyToolBarEntryEventUpdate(document, "#TbRefresh", "HandleToolbarRefreshUpdated")
  );

  assert.match(patchedText, /Case #TbRefresh\s+HandleToolbarRefreshUpdated\(EventMenu\(\)\)/s);
  const toolBarButton = parsed.toolbars[0]?.entries.find((entry) => entry.idRaw === "#TbRefresh");
  assert.equal(toolBarButton?.event, "HandleToolbarRefreshUpdated");
});

test("roundtrips toolbar entry event removal without touching menu events", () => {
  const text = loadFixture("fixtures/smoke/15-object-event-bindings.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyToolBarEntryEventUpdate(document, "#TbRefresh", undefined)
  );

  assert.doesNotMatch(patchedText, /Case #TbRefresh/);
  assert.match(patchedText, /Case #MenuOpen\s+HandleMenuOpen\(EventMenu\(\)\)/s);
  const toolBarButton = parsed.toolbars[0]?.entries.find((entry) => entry.idRaw === "#TbRefresh");
  assert.equal(toolBarButton?.event, undefined);
  const menuItem = parsed.menus[0]?.entries.find((entry) => entry.idRaw === "#MenuOpen");
  assert.equal(menuItem?.event, "HandleMenuOpen");
  assert.equal(parsed.window?.generateEventLoop, true);
});

test("roundtrips combined object event binding updates in fixture 15", () => {
  const text = loadFixture("fixtures/smoke/15-object-event-bindings.pbf");

  let patchedText = text;

  let document = new FakeTextDocument(patchedText);
  let edit = applyGadgetEventProcUpdate(document.asTextDocument(), "#BtnApply", "HandleApplyUpdated");
  assert.ok(edit, "Expected gadget event update edit.");
  patchedText = applyWorkspaceEditToText(patchedText, edit!);

  document = new FakeTextDocument(patchedText);
  edit = applyMenuEntryEventUpdate(document.asTextDocument(), "#MenuOpen", "HandleMenuOpenUpdated");
  assert.ok(edit, "Expected menu event update edit.");
  patchedText = applyWorkspaceEditToText(patchedText, edit!);

  document = new FakeTextDocument(patchedText);
  edit = applyToolBarEntryEventUpdate(document.asTextDocument(), "#TbRefresh", "HandleToolbarRefreshUpdated");
  assert.ok(edit, "Expected toolbar event update edit.");
  patchedText = applyWorkspaceEditToText(patchedText, edit!);

  const parsed = parseFormDocument(patchedText);
  const button = parsed.gadgets.find((g) => g.id === "#BtnApply");
  const menuItem = parsed.menus[0]?.entries.find((entry) => entry.idRaw === "#MenuOpen");
  const toolBarButton = parsed.toolbars[0]?.entries.find((entry) => entry.idRaw === "#TbRefresh");

  assert.match(patchedText, /Case #MenuOpen\s+HandleMenuOpenUpdated\(EventMenu\(\)\)\s+Case #TbRefresh\s+HandleToolbarRefreshUpdated\(EventMenu\(\)\)/s);
  assert.match(patchedText, /Case #BtnApply\s+HandleApplyUpdated\s*\(EventType\(\)\)/s);
  assert.equal(button?.eventProc, "HandleApplyUpdated");
  assert.equal(menuItem?.event, "HandleMenuOpenUpdated");
  assert.equal(toolBarButton?.event, "HandleToolbarRefreshUpdated");
  assert.equal(parsed.window?.generateEventLoop, true);
});

test("roundtrips combined panel container updates in fixture 05", () => {
  const text = loadFixture("fixtures/smoke/05-container-panel.pbf");
  const initial = parseFormDocument(text);
  const panel = initial.gadgets.find((g) => g.id === "#PnlMain");
  const secondTabLine = panel?.items?.[1]?.source?.line;

  assert.equal(typeof secondTabLine, "number", "Expected source line for second panel item.");

  let patchedText = text;

  let document = new FakeTextDocument(patchedText);
  let edit = applyGadgetItemUpdate(document.asTextDocument(), "#PnlMain", secondTabLine!, {
    posRaw: "-1",
    textRaw: '"Settings"',
  });
  assert.ok(edit, "Expected panel item update edit.");
  patchedText = applyWorkspaceEditToText(patchedText, edit!);

  document = new FakeTextDocument(patchedText);
  edit = applyGadgetOpenArgsUpdate(document.asTextDocument(), "#StrTab1", {
    textRaw: '"SettingsValue"',
    flagsExpr: "#PB_String_ReadOnly",
  });
  assert.ok(edit, "Expected nested gadget arg update edit.");
  patchedText = applyWorkspaceEditToText(patchedText, edit!);

  document = new FakeTextDocument(patchedText);
  edit = applyRectPatch(document.asTextDocument(), "#StrTab1", 22, 24, 140, 28);
  assert.ok(edit, "Expected nested gadget rect edit.");
  patchedText = applyWorkspaceEditToText(patchedText, edit!);

  const parsed = parseFormDocument(patchedText);
  const updatedPanel = parsed.gadgets.find((g) => g.id === "#PnlMain");
  const updatedInput = parsed.gadgets.find((g) => g.id === "#StrTab1");

  assert.match(patchedText, /AddGadgetItem\(#PnlMain, -1, "Settings"\)/);
  assert.match(patchedText, /StringGadget\(#StrTab1, 22, 24, 140, 28, "SettingsValue", #PB_String_ReadOnly\)/);
  assert.equal(updatedPanel?.items?.[1]?.text, "Settings");
  assert.equal(updatedInput?.parentId, "#PnlMain");
  assert.equal(updatedInput?.parentItem, 1);
  assert.equal(updatedInput?.x, 22);
  assert.equal(updatedInput?.y, 24);
  assert.equal(updatedInput?.w, 140);
  assert.equal(updatedInput?.h, 28);
  assert.equal(updatedInput?.text, "SettingsValue");
  assert.equal(updatedInput?.flagsExpr, "#PB_String_ReadOnly");
});


test("roundtrips combined scrollarea container updates in fixture 06", () => {
  const text = loadFixture("fixtures/smoke/06-container-scrollarea.pbf");

  let patchedText = text;

  let document = new FakeTextDocument(patchedText);
  let edit = applyGadgetOpenArgsUpdate(document.asTextDocument(), "#ScrMain", {
    minRaw: "640",
    maxRaw: "360",
    flagsExpr: "#PB_ScrollArea_BorderLess",
  });
  assert.ok(edit, "Expected scrollarea arg update edit.");
  patchedText = applyWorkspaceEditToText(patchedText, edit!);

  document = new FakeTextDocument(patchedText);
  edit = applyGadgetOpenArgsUpdate(document.asTextDocument(), "#TxtInner", {
    textRaw: '"InnerUpdated"',
  });
  assert.ok(edit, "Expected scrollarea child arg update edit.");
  patchedText = applyWorkspaceEditToText(patchedText, edit!);

  document = new FakeTextDocument(patchedText);
  edit = applyRectPatch(document.asTextDocument(), "#TxtInner", 42, 58, 144, 24);
  assert.ok(edit, "Expected scrollarea child rect update edit.");
  patchedText = applyWorkspaceEditToText(patchedText, edit!);

  const parsed = parseFormDocument(patchedText);
  const scroll = parsed.gadgets.find((g) => g.id === "#ScrMain");
  const inner = parsed.gadgets.find((g) => g.id === "#TxtInner");

  assert.match(patchedText, /ScrollAreaGadget\(#ScrMain, 10, 10, 220, 120, 640, 360, 1, #PB_ScrollArea_BorderLess\)/);
  assert.match(patchedText, /TextGadget\(#TxtInner, 42, 58, 144, 24, "InnerUpdated"\)/);
  assert.equal(scroll?.minRaw, "640");
  assert.equal(scroll?.min, 640);
  assert.equal(scroll?.maxRaw, "360");
  assert.equal(scroll?.max, 360);
  assert.equal(scroll?.flagsExpr, "#PB_ScrollArea_BorderLess");
  assert.equal(inner?.parentId, "#ScrMain");
  assert.equal(inner?.x, 42);
  assert.equal(inner?.y, 58);
  assert.equal(inner?.w, 144);
  assert.equal(inner?.h, 24);
  assert.equal(inner?.text, "InnerUpdated");
});


test("re-inserts Enumeration FormWindow before FormImage when toggling a pbAny window back to enum mode", () => {
  const text = loadFixture("fixtures/roundtrip/54-windowgadget-window-enum-before-image-block.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyWindowPbAnyToggle(document, "win", false, "win", "#FrmMain", undefined)
  );

  const normalized = stripBomAndToLf(patchedText);
  assert.ok(normalized.includes([
    'Enumeration FormWindow',
    '  #FrmMain',
    'EndEnumeration',
    '',
    'Enumeration FormImage',
  ].join("\n")));
  assert.match(patchedText, /OpenWindow\(#FrmMain, x, y, width, height, "Window Basic"\)/);
  assert.equal(parsed.window?.id, '#FrmMain');
  assert.equal(parsed.window?.pbAny, false);
});

test("re-inserts Enumeration FormWindow before an existing FormFont block", () => {
  const text = loadFixture("fixtures/roundtrip/55-windowgadget-window-enum-before-font-block.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyWindowPbAnyToggle(document, "win", false, "win", "#FrmMain", undefined)
  );

  const normalized = stripBomAndToLf(patchedText);
  assert.ok(normalized.includes([
    'Enumeration FormWindow',
    '  #FrmMain',
    'EndEnumeration',
    '',
    'Enumeration FormFont',
  ].join("\n")));
  assert.match(patchedText, /OpenWindow\(#FrmMain, x, y, width, height, "Window Basic"\)/);
  assert.equal(parsed.window?.id, '#FrmMain');
  assert.equal(parsed.window?.pbAny, false);
});

test("re-inserts Enumeration FormWindow before image decoder lines when no enum anchor exists yet", () => {
  const text = loadFixture("fixtures/roundtrip/56-windowgadget-window-enum-before-image-decoder.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyWindowPbAnyToggle(document, "win", false, "win", "#FrmMain", undefined)
  );

  const normalized = stripBomAndToLf(patchedText);
  assert.ok(normalized.includes([
    'Enumeration FormWindow',
    '  #FrmMain',
    'EndEnumeration',
    '',
    'Enumeration FormImage',
  ].join("\n")));
  assert.match(patchedText, /OpenWindow\(#FrmMain, x, y, width, height, "Window Basic"\)/);
  assert.equal(parsed.window?.id, '#FrmMain');
  assert.equal(parsed.window?.pbAny, false);
});



test("inserts a missing pbAny window Global before existing gadget and image globals", () => {
  const text = loadFixture("fixtures/roundtrip/59-windowgadget-window-global-before-gadget-image-globals.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyWindowVariableNamePatch(document, "winMain")
  );

  const normalized = stripBomAndToLf(patchedText);
  assert.ok(normalized.includes([
    'Global winMain',
    '',
    'Global gadgetMain',
    '',
    'Global Img_winMain_0',
  ].join("\n")));
  assert.match(patchedText, /winMain = OpenWindow\(#PB_Any, x, y, width, height, "Window Basic"\)/);
  assert.doesNotMatch(patchedText, /Enumeration FormWindow/);
  assert.equal(parsed.window?.id, 'winMain');
  assert.equal(parsed.window?.pbAny, true);
});


test("inserts a missing pbAny window Global before custom gadget initialisation", () => {
  const text = loadFixture("fixtures/roundtrip/60-windowgadget-window-global-before-custom-init.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyWindowVariableNamePatch(document, "winMain")
  );

  const normalized = stripBomAndToLf(patchedText);
  assert.ok(normalized.includes([
    'Global winMain',
    '',
    '; 0 Custom gadget initialisation (do Not remove this line)',
    'InitMyCustomGadget()',
  ].join("\n")));
  assert.doesNotMatch(patchedText, /XIncludeFile/);
  assert.match(patchedText, /winMain = OpenWindow\(#PB_Any, x, y, width, height, "Window Basic"\)/);
  assert.equal(parsed.window?.id, 'winMain');
  assert.equal(parsed.window?.pbAny, true);
});


test("preserves leading and trailing spaces when patching a window variable name", () => {
  const text = `; Form Designer for PureBasic - 6.40

Enumeration FormWindow
  #Window_0
EndEnumeration

Procedure OpenWindow_0(x = 0, y = 0, width = 220, height = 140)
  If OpenWindow(#Window_0, x, y, width, height, "Window Basic")
  EndIf
EndProcedure
`;

  const { patchedText } = patchAndReparse(text, (document) =>
    applyWindowVariableNamePatch(document, '  winMain  ')
  );

  assert.match(patchedText, /OpenWindow\(#  winMain  , x, y, width, height, "Window Basic"\)/);
});

test("patches the selected pbAny window variable name by window key", () => {
  const text = loadFixture("fixtures/roundtrip/61-windowgadget-window-rename-selected-pbany.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyWindowVariableNamePatch(document, "Window_1", "Window_0")
  );

  assert.match(patchedText, /^Global Window_1$/m);
  assert.doesNotMatch(patchedText, /^Global Window_0$/m);
  assert.doesNotMatch(patchedText, /^Global HelperWin$/m);
  assert.match(patchedText, /Window_1 = OpenWindow\(#PB_Any, x, y, width, height, "Window Basic"\)/);
  assert.match(patchedText, /Procedure OpenWindow_1\(/);
  assert.match(patchedText, /Procedure Window_1_Events\(/);
  assert.match(patchedText, /Case #PB_Event_Menu\s+Select EventMenu\(\)\s+EndSelect/s);
  assert.match(patchedText, /Case #PB_Event_Gadget\s+Select EventGadget\(\)\s+EndSelect/s);
  assert.equal(parsed.window?.id, "Window_1");
  assert.equal(parsed.window?.variable, "Window_1");
});


test("removes the trailing blank line of the last window Global when toggling back to enum mode", () => {
  const text = loadFixture("fixtures/roundtrip/62-windowgadget-window-enum-remove-last-global-before-image-block.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyWindowPbAnyToggle(document, "winMain", false, "winMain", "#FrmMain", undefined)
  );

  const normalized = stripBomAndToLf(patchedText);
  assert.ok(normalized.includes([
    'Enumeration FormWindow',
    '  #FrmMain',
    'EndEnumeration',
    '',
    'Enumeration FormGadget',
  ].join("\n")));
  assert.doesNotMatch(patchedText, /^Global winMain$/m);
  assert.doesNotMatch(normalized, /Global winMain\n\n\nEnumeration FormGadget/);
  assert.match(normalized, /ImageGadget\(#Image_0, 41, 30, 49, 45, ImageID\(#Img_winMain_0\)\)/);
  assert.equal(parsed.window?.id, '#FrmMain');
  assert.equal(parsed.window?.pbAny, false);
});




test("preserves Enumeration FormGadget before custom gadget initialisation when patching an enum gadget", () => {
  const text = loadFixture("fixtures/roundtrip/63-windowgadget-gadget-enum-before-custom-init.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyRectPatch(document, "#BtnOk", 20, 24, 90, 28)
  );

  const normalized = stripBomAndToLf(patchedText);
  assert.ok(normalized.includes([
    'Enumeration FormGadget',
    '  #BtnOk',
    '  #Custom',
    'EndEnumeration',
    '',
    '; 1 Custom gadget initialisation (do Not remove this line)',
  ].join("\n")));
  assert.ok(normalized.includes([
    '; 1 Custom gadget initialisation (do Not remove this line)',
    'InitMyCustomGadget()',
  ].join("\n")));
  assert.doesNotMatch(patchedText, /ProcedureDLL/);
  assert.doesNotMatch(patchedText, /XIncludeFile/);

  const button = parsed.gadgets.find((g) => g.id === '#BtnOk');
  assert.ok(button, 'Expected patched enum gadget.');
  assert.equal(button?.x, 20);
  assert.equal(button?.y, 24);
  assert.equal(button?.w, 90);
  assert.equal(button?.h, 28);
});

test("re-inserts Enumeration FormGadget before FormMenu when patching an enum gadget", () => {
  const text = loadFixture("fixtures/roundtrip/64-windowgadget-gadget-enum-before-menu-block.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyRectPatch(document, "#BtnOk", 20, 24, 90, 28)
  );

  const normalized = stripBomAndToLf(patchedText);
  assert.match(normalized, /Enumeration FormWindow\n  #FrmMain\nEndEnumeration\n\nEnumeration FormGadget[\s\S]*?  #BtnOk\n[\s\S]*?EndEnumeration\n\nEnumeration FormMenu/);
  assert.match(normalized, /^Global CustomGadget$/m);
  assert.doesNotMatch(normalized, /^Global BtnOk(?:,|$)/m);
  assert.match(patchedText, /ButtonGadget\(#BtnOk, 20, 24, 90, 28, "OK"\)/);

  const button = parsed.gadgets.find((g) => g.id === "#BtnOk");
  assert.ok(button, "Expected patched enum gadget.");
  assert.equal(button?.pbAny, false);
  assert.equal(button?.x, 20);
  assert.equal(button?.y, 24);
  assert.equal(button?.w, 90);
  assert.equal(button?.h, 28);
});

test("inserts a missing pbAny gadget Global between window and image globals", () => {
  const text = loadFixture("fixtures/roundtrip/65-windowgadget-gadget-global-between-window-image-globals.pbf");

  const { patchedText, parsed } = patchAndReparse(text, (document) =>
    applyGadgetOpenArgsUpdate(document, "gInput", { textRaw: 'Value$' })
  );

  const normalized = stripBomAndToLf(patchedText);
  assert.ok(normalized.includes([
    'Global winMain',
    '',
    'Global gInput',
  ].join("\n")));
  assert.doesNotMatch(normalized, /^Global imgMain$/m);
  assert.match(patchedText, /gInput = StringGadget\(#PB_Any, 10, 36, 220, 24, Value\$\)/);
  assert.match(patchedText, /ImageGadget\(#PB_Any, 10, 70, 32, 32, 0\)/);
  const input = parsed.gadgets.find((g) => g.id === "gInput");
  assert.ok(input, "Expected patched pbAny gadget.");
  assert.equal(input?.pbAny, true);
  assert.equal(input?.textRaw, 'Value$');
});


test("roundtrips combined splitter container updates in fixture 07", () => {
  const text = loadFixture("fixtures/smoke/07-container-splitter.pbf");

  let patchedText = text;

  let document = new FakeTextDocument(patchedText);
  let edit = applyGadgetOpenArgsUpdate(document.asTextDocument(), "#SplitMain", {
    gadget1Raw: "#TxtRight",
    gadget2Raw: "#TxtLeft",
    flagsExpr: "#PB_Splitter_Separator",
  });
  assert.ok(edit, "Expected splitter arg update edit.");
  patchedText = applyWorkspaceEditToText(patchedText, edit!);

  document = new FakeTextDocument(patchedText);
  edit = applyRectPatch(document.asTextDocument(), "#SplitMain", 16, 46, 240, 110);
  assert.ok(edit, "Expected splitter rect update edit.");
  patchedText = applyWorkspaceEditToText(patchedText, edit!);

  document = new FakeTextDocument(patchedText);
  edit = applyGadgetPropertyUpdate(document.asTextDocument(), "#SplitMain", {
    stateRaw: "80",
  });
  assert.ok(edit, "Expected splitter state update edit.");
  patchedText = applyWorkspaceEditToText(patchedText, edit!);

  const parsed = parseFormDocument(patchedText);
  const splitter = parsed.gadgets.find((g) => g.id === "#SplitMain");
  const left = parsed.gadgets.find((g) => g.id === "#TxtLeft");
  const right = parsed.gadgets.find((g) => g.id === "#TxtRight");

  assert.match(patchedText, /SplitterGadget\(#SplitMain, 16, 46, 240, 110, #TxtRight, #TxtLeft, #PB_Splitter_Separator\)/);
  assert.match(patchedText, /SetGadgetState\(#SplitMain, 80\)/);
  assert.equal(splitter?.x, 16);
  assert.equal(splitter?.y, 46);
  assert.equal(splitter?.w, 240);
  assert.equal(splitter?.h, 110);
  assert.equal(splitter?.gadget1Id, "#TxtRight");
  assert.equal(splitter?.gadget2Id, "#TxtLeft");
  assert.equal(splitter?.flagsExpr, "#PB_Splitter_Separator");
  assert.equal(splitter?.stateRaw, "80");
  assert.equal(splitter?.state, 80);
  assert.equal(left?.splitterId, "#SplitMain");
  assert.equal(right?.splitterId, "#SplitMain");
});


test("deletes an existing ResizeGadget line when lock editing no longer requires it", () => {
  const text = loadFixture("fixtures/roundtrip/53-windowgadget-resize-delete-line-basic.pbf");

  const document = new FakeTextDocument(text);
  const edit = applyResizeGadgetDelete(document.asTextDocument(), "#BtnStretch");
  assert.ok(edit, "Expected a WorkspaceEdit result.");
  const patchedText = applyWorkspaceEditToText(text, edit!);

  assert.doesNotMatch(patchedText, /ResizeGadget\(#BtnStretch/);
  assert.match(patchedText, /ButtonGadget\(#BtnStretch, 10, 50, 80, 24, "Stretch"\)/);
});




test('trims surrounding whitespace for menu SelectProc updates', () => {
  const text = loadFixture("fixtures/smoke/15-object-event-bindings.pbf");

  const document = new FakeTextDocument(text);
  const edit = applyMenuEntryEventUpdate(document.asTextDocument(), '#MenuOpen', '  HandleMenuOpenUpdated  ');
  assert.ok(edit, 'Expected menu event proc edit.');

  const patchedText = applyWorkspaceEditToText(text, edit!);
  assert.match(patchedText, /Case #MenuOpen\s+HandleMenuOpenUpdated\(EventMenu\(\)\)/s);
});

test('trims surrounding whitespace for toolbar SelectProc updates', () => {
  const text = loadFixture("fixtures/smoke/15-object-event-bindings.pbf");

  const document = new FakeTextDocument(text);
  const edit = applyToolBarEntryEventUpdate(document.asTextDocument(), '#TbRefresh', '  HandleToolbarRefreshUpdated  ');
  assert.ok(edit, 'Expected toolbar event proc edit.');

  const patchedText = applyWorkspaceEditToText(text, edit!);
  assert.match(patchedText, /Case #TbRefresh\s+HandleToolbarRefreshUpdated\(EventMenu\(\)\)/s);
});

