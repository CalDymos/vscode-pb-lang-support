import test from "node:test";
import assert from "node:assert/strict";

import { applyGadgetCopyPaste } from "../src/core/emitter/patch-emitter";
import { parseFormDocument } from "../src/core/parser/form-parser";
import { applyWorkspaceEditToText } from "./helpers/applyWorkspaceEdit";
import { FakeTextDocument } from "./helpers/fakeTextDocument";

function patch(text: string, id: string): string {
  const document = new FakeTextDocument(text);
  const edit = applyGadgetCopyPaste(document.asTextDocument(), id);
  assert.ok(edit, "Expected a WorkspaceEdit result.");
  return applyWorkspaceEditToText(text, edit!);
}

test("pastes a copied simple enum gadget at the original position with the original copy naming pattern", () => {
  const text = `; Form Designer for PureBasic - 6.40 LTS\n\nEnumeration FormWindow\n  #FrmMain\nEndEnumeration\n\nEnumeration FormGadget\n  #BtnApply\nEndEnumeration\n\nProcedure OpenFrmMain(x = 0, y = 0, width = 220, height = 140)\n  OpenWindow(#FrmMain, x, y, width, height, "Main")\n  ButtonGadget(#BtnApply, 10, 20, 80, 24, "Apply")\n  GadgetToolTip(#BtnApply, "Run")\nEndProcedure\n`;

  const patched = patch(text, "#BtnApply");
  const parsed = parseFormDocument(patched);

  assert.match(patched, /Enumeration FormGadget\s+  #BtnApply\s+  #BtnApply_Copy1\s+EndEnumeration/s);
  assert.match(patched, /ButtonGadget\(#BtnApply, 10, 20, 80, 24, "Apply"\)\s+  GadgetToolTip\(#BtnApply, "Run"\)\s+  ButtonGadget\(#BtnApply_Copy1, 10, 20, 80, 24, "Apply"\)\s+  GadgetToolTip\(#BtnApply_Copy1, "Run"\)/s);
  const pasted = parsed.gadgets.find(gadget => gadget.id === "#BtnApply_Copy1");
  assert.equal(pasted?.y, 20);
  assert.equal(pasted?.tooltip, "Run");
});

test("pastes a copied #PB_Any gadget with a new assigned copy variable", () => {
  const text = `; Form Designer for PureBasic - 6.40 LTS\n\nGlobal BtnApply\n\nProcedure OpenFrmMain(x = 0, y = 0, width = 220, height = 140)\n  OpenWindow(#PB_Any, x, y, width, height, "Main")\n  BtnApply = ButtonGadget(#PB_Any, 10, 20, 80, 24, "Apply")\nEndProcedure\n`;

  const patched = patch(text, "BtnApply");
  const parsed = parseFormDocument(patched);

  assert.match(patched, /Global BtnApply, BtnApply_Copy1/);
  assert.match(patched, /BtnApply = ButtonGadget\(#PB_Any, 10, 20, 80, 24, "Apply"\)\s+  BtnApply_Copy1 = ButtonGadget\(#PB_Any, 10, 20, 80, 24, "Apply"\)/s);
  const pasted = parsed.gadgets.find(gadget => gadget.id === "BtnApply_Copy1");
  assert.equal(pasted?.pbAny, true);
  assert.equal(pasted?.variable, "BtnApply_Copy1");
});

test("pastes a copied gadget with ResizeGadget formulas unchanged except for the target id", () => {
  const text = `; Form Designer for PureBasic - 6.40 LTS

Declare ResizeGadgetsFrmMain()

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #BtnApply
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 220, height = 140)
  OpenWindow(#FrmMain, x, y, width, height, "Main")
  ButtonGadget(#BtnApply, 10, 20, 80, 24, "Apply")
EndProcedure

Procedure ResizeGadgetsFrmMain()
  Protected FormWindowWidth, FormWindowHeight
  FormWindowWidth = WindowWidth(#FrmMain)
  FormWindowHeight = WindowHeight(#FrmMain)
  ResizeGadget(#BtnApply, 10, FormWindowHeight - 80, FormWindowWidth - 40, 24)
EndProcedure
`;

  const patched = patch(text, "#BtnApply");

  assert.match(patched, /ButtonGadget\(#BtnApply, 10, 20, 80, 24, "Apply"\)\s+  ButtonGadget\(#BtnApply_Copy1, 10, 20, 80, 24, "Apply"\)/s);
  assert.match(patched, /ResizeGadget\(#BtnApply, 10, FormWindowHeight - 80, FormWindowWidth - 40, 24\)\s+  ResizeGadget\(#BtnApply_Copy1, 10, FormWindowHeight - 80, FormWindowWidth - 40, 24\)/s);
});

test("does not paste splitter-bound gadgets in the first copy paste patch scope", () => {
  const text = `; Form Designer for PureBasic - 6.40 LTS\n\nEnumeration FormWindow\n  #FrmMain\nEndEnumeration\n\nEnumeration FormGadget\n  #BtnLeft\n  #BtnRight\n  #SplitMain\nEndEnumeration\n\nProcedure OpenFrmMain(x = 0, y = 0, width = 220, height = 140)\n  OpenWindow(#FrmMain, x, y, width, height, "Main")\n  ButtonGadget(#BtnLeft, 10, 20, 70, 24, "Left")\n  ButtonGadget(#BtnRight, 90, 20, 70, 24, "Right")\n  SplitterGadget(#SplitMain, 10, 50, 150, 50, #BtnLeft, #BtnRight)\nEndProcedure\n`;

  const document = new FakeTextDocument(text);
  assert.equal(applyGadgetCopyPaste(document.asTextDocument(), "#SplitMain"), undefined);
});

test("pastes a copied container subtree with renamed descendants", () => {
  const text = `; Form Designer for PureBasic - 6.40 LTS

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #Container_0
  #BtnChild
  #StringChild
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 260, height = 180)
  OpenWindow(#FrmMain, x, y, width, height, "Main")
  ContainerGadget(#Container_0, 10, 10, 160, 100)
    ButtonGadget(#BtnChild, 10, 12, 80, 24, "Child")
    StringGadget(#StringChild, 10, 44, 100, 24, "Value")
    GadgetToolTip(#StringChild, "Input")
  CloseGadgetList()
EndProcedure
`;

  const patched = patch(text, "#Container_0");
  const parsed = parseFormDocument(patched);

  assert.match(patched, /Enumeration FormGadget\s+  #Container_0\s+  #BtnChild\s+  #StringChild\s+  #Container_0_Copy1\s+  #BtnChild_Copy1\s+  #StringChild_Copy1\s+EndEnumeration/s);
  assert.match(patched, /ContainerGadget\(#Container_0, 10, 10, 160, 100\)[\s\S]*CloseGadgetList\(\)\s+  ContainerGadget\(#Container_0_Copy1, 10, 10, 160, 100\)\s+    ButtonGadget\(#BtnChild_Copy1, 10, 12, 80, 24, "Child"\)\s+    StringGadget\(#StringChild_Copy1, 10, 44, 100, 24, "Value"\)\s+    GadgetToolTip\(#StringChild_Copy1, "Input"\)\s+  CloseGadgetList\(\)/s);

  const copiedContainer = parsed.gadgets.find(gadget => gadget.id === "#Container_0_Copy1");
  const copiedButton = parsed.gadgets.find(gadget => gadget.id === "#BtnChild_Copy1");
  const copiedString = parsed.gadgets.find(gadget => gadget.id === "#StringChild_Copy1");
  assert.equal(copiedButton?.parentId, copiedContainer?.id);
  assert.equal(copiedString?.parentId, copiedContainer?.id);
  assert.equal(copiedString?.tooltip, "Input");
});

test("pastes a copied panel subtree with tabs and renamed children", () => {
  const text = `; Form Designer for PureBasic - 6.40 LTS

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #Panel_0
  #BtnFirst
  #BtnSecond
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 280, height = 200)
  OpenWindow(#FrmMain, x, y, width, height, "Main")
  PanelGadget(#Panel_0, 10, 10, 180, 120)
    AddGadgetItem(#Panel_0, -1, "First")
    ButtonGadget(#BtnFirst, 10, 12, 80, 24, "First")
    AddGadgetItem(#Panel_0, -1, "Second")
    ButtonGadget(#BtnSecond, 12, 16, 90, 24, "Second")
  CloseGadgetList()
EndProcedure
`;

  const patched = patch(text, "#Panel_0");
  const parsed = parseFormDocument(patched);

  assert.match(patched, /Enumeration FormGadget\s+  #Panel_0\s+  #BtnFirst\s+  #BtnSecond\s+  #Panel_0_Copy1\s+  #BtnFirst_Copy1\s+  #BtnSecond_Copy1\s+EndEnumeration/s);
  assert.match(patched, /PanelGadget\(#Panel_0_Copy1, 10, 10, 180, 120\)\s+    AddGadgetItem\(#Panel_0_Copy1, -1, "First"\)\s+    ButtonGadget\(#BtnFirst_Copy1, 10, 12, 80, 24, "First"\)\s+    AddGadgetItem\(#Panel_0_Copy1, -1, "Second"\)\s+    ButtonGadget\(#BtnSecond_Copy1, 12, 16, 90, 24, "Second"\)\s+  CloseGadgetList\(\)/s);

  const copiedPanel = parsed.gadgets.find(gadget => gadget.id === "#Panel_0_Copy1");
  const copiedFirst = parsed.gadgets.find(gadget => gadget.id === "#BtnFirst_Copy1");
  const copiedSecond = parsed.gadgets.find(gadget => gadget.id === "#BtnSecond_Copy1");
  assert.equal(copiedFirst?.parentId, copiedPanel?.id);
  assert.equal(copiedSecond?.parentId, copiedPanel?.id);
  assert.equal(copiedFirst?.parentItem, 0);
  assert.equal(copiedSecond?.parentItem, 1);
});

test("keeps structural copy paste blocked for splitter subtrees", () => {
  const splitterText = `; Form Designer for PureBasic - 6.40 LTS

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #Container_0
  #BtnLeft
  #BtnRight
  #SplitMain
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 260, height = 180)
  OpenWindow(#FrmMain, x, y, width, height, "Main")
  ContainerGadget(#Container_0, 10, 10, 180, 120)
    ButtonGadget(#BtnLeft, 10, 12, 70, 24, "Left")
    ButtonGadget(#BtnRight, 90, 12, 70, 24, "Right")
    SplitterGadget(#SplitMain, 10, 44, 150, 50, #BtnLeft, #BtnRight)
  CloseGadgetList()
EndProcedure
`;
  assert.equal(applyGadgetCopyPaste(new FakeTextDocument(splitterText).asTextDocument(), "#Container_0"), undefined);
});

test("pastes supported structural roots beyond plain ContainerGadget", () => {
  const scrollText = `; Form Designer for PureBasic - 6.40 LTS

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #ScrMain
  #BtnScroll
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 260, height = 180)
  OpenWindow(#FrmMain, x, y, width, height, "Main")
  ScrollAreaGadget(#ScrMain, 10, 10, 160, 100, 320, 240, 1)
    ButtonGadget(#BtnScroll, 10, 12, 80, 24, "Scroll")
  CloseGadgetList()
EndProcedure
`;
  const patchedScroll = patch(scrollText, "#ScrMain");
  assert.match(patchedScroll, /ScrollAreaGadget\(#ScrMain_Copy1, 10, 10, 160, 100, 320, 240, 1\)\s+    ButtonGadget\(#BtnScroll_Copy1, 10, 12, 80, 24, "Scroll"\)\s+  CloseGadgetList\(\)/s);

  const frameText = `; Form Designer for PureBasic - 6.40 LTS

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #FrameHost
  #BtnFrame
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 260, height = 180)
  OpenWindow(#FrmMain, x, y, width, height, "Main")
  FrameGadget(#FrameHost, 10, 10, 160, 100, "Group", #PB_Frame_Container)
    ButtonGadget(#BtnFrame, 10, 12, 80, 24, "Frame")
  CloseGadgetList()
EndProcedure
`;
  const patchedFrame = patch(frameText, "#FrameHost");
  assert.match(patchedFrame, /FrameGadget\(#FrameHost_Copy1, 10, 10, 160, 100, "Group", #PB_Frame_Container\)\s+    ButtonGadget\(#BtnFrame_Copy1, 10, 12, 80, 24, "Frame"\)\s+  CloseGadgetList\(\)/s);
});
