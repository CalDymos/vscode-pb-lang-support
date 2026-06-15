import test from "node:test";
import assert from "node:assert/strict";

import { applyGadgetDuplicate } from "../src/core/emitter/patch-emitter";
import { parseFormDocument } from "../src/core/parser/form-parser";
import { applyWorkspaceEditToText } from "./helpers/applyWorkspaceEdit";
import { FakeTextDocument } from "./helpers/fakeTextDocument";

function patch(text: string, id: string): string {
  const document = new FakeTextDocument(text);
  const edit = applyGadgetDuplicate(document.asTextDocument(), id);
  assert.ok(edit, "Expected a WorkspaceEdit result.");
  return applyWorkspaceEditToText(text, edit!);
}

test("duplicates a simple enum gadget below the source gadget with the original duplicate naming pattern", () => {
  const text = `; Form Designer for PureBasic - 6.40 LTS\n\nEnumeration FormWindow\n  #FrmMain\nEndEnumeration\n\nEnumeration FormGadget\n  #BtnApply\nEndEnumeration\n\nProcedure OpenFrmMain(x = 0, y = 0, width = 220, height = 140)\n  OpenWindow(#FrmMain, x, y, width, height, \"Main\")\n  ButtonGadget(#BtnApply, 10, 20, 80, 24, \"Apply\")\n  GadgetToolTip(#BtnApply, \"Run\")\nEndProcedure\n`;

  const patched = patch(text, "#BtnApply");
  const parsed = parseFormDocument(patched);

  assert.match(patched, /Enumeration FormGadget\s+  #BtnApply\s+  #BtnApply_1\s+EndEnumeration/s);
  assert.match(patched, /ButtonGadget\(#BtnApply, 10, 20, 80, 24, "Apply"\)\s+  GadgetToolTip\(#BtnApply, "Run"\)\s+  ButtonGadget\(#BtnApply_1, 10, 44, 80, 24, "Apply"\)\s+  GadgetToolTip\(#BtnApply_1, "Run"\)/s);
  const duplicated = parsed.gadgets.find(gadget => gadget.id === "#BtnApply_1");
  assert.equal(duplicated?.y, 44);
  assert.equal(duplicated?.tooltip, "Run");
});

test("duplicates a simple #PB_Any gadget with a new assigned variable", () => {
  const text = `; Form Designer for PureBasic - 6.40 LTS\n\nGlobal BtnApply\n\nProcedure OpenFrmMain(x = 0, y = 0, width = 220, height = 140)\n  OpenWindow(#PB_Any, x, y, width, height, \"Main\")\n  BtnApply = ButtonGadget(#PB_Any, 10, 20, 80, 24, \"Apply\")\nEndProcedure\n`;

  const patched = patch(text, "BtnApply");
  const parsed = parseFormDocument(patched);

  assert.match(patched, /Global BtnApply, BtnApply_1/);
  assert.match(patched, /BtnApply = ButtonGadget\(#PB_Any, 10, 20, 80, 24, "Apply"\)\s+  BtnApply_1 = ButtonGadget\(#PB_Any, 10, 44, 80, 24, "Apply"\)/s);
  const duplicated = parsed.gadgets.find(gadget => gadget.id === "BtnApply_1");
  assert.equal(duplicated?.pbAny, true);
  assert.equal(duplicated?.variable, "BtnApply_1");
});


test("duplicates a gadget with a safe horizontal ResizeGadget line", () => {
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
  ResizeGadget(#BtnApply, 10, 20, FormWindowWidth - 40, 24)
EndProcedure
`;

  const patched = patch(text, "#BtnApply");
  const parsed = parseFormDocument(patched);

  assert.match(patched, /Enumeration FormGadget\s+  #BtnApply\s+  #BtnApply_1\s+EndEnumeration/s);
  assert.match(patched, /ButtonGadget\(#BtnApply, 10, 20, 80, 24, "Apply"\)\s+  ButtonGadget\(#BtnApply_1, 10, 44, 80, 24, "Apply"\)/s);
  assert.match(patched, /ResizeGadget\(#BtnApply, 10, 20, FormWindowWidth - 40, 24\)\s+  ResizeGadget\(#BtnApply_1, 10, 44, FormWindowWidth - 40, 24\)/s);

  const duplicated = parsed.gadgets.find(gadget => gadget.id === "#BtnApply_1");
  assert.equal(duplicated?.resizeYRaw, "44");
  assert.equal(duplicated?.resizeWRaw, "FormWindowWidth - 40");
});

test("keeps Duplicate blocked for ResizeGadget lines with vertical formulas", () => {
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
  ResizeGadget(#BtnApply, 10, FormWindowHeight - 80, 80, 24)
EndProcedure
`;

  const document = new FakeTextDocument(text);
  assert.equal(applyGadgetDuplicate(document.asTextDocument(), "#BtnApply"), undefined);
});

test("duplicates a structural host as an empty host block without recursive children", () => {
  const text = `; Form Designer for PureBasic - 6.40 LTS\n\nEnumeration FormWindow\n  #FrmMain\nEndEnumeration\n\nEnumeration FormGadget\n  #Container_0\n  #BtnChild\nEndEnumeration\n\nProcedure OpenFrmMain(x = 0, y = 0, width = 220, height = 180)\n  OpenWindow(#FrmMain, x, y, width, height, \"Main\")\n  ContainerGadget(#Container_0, 10, 10, 140, 80)\n    ButtonGadget(#BtnChild, 10, 20, 80, 24, \"Child\")\n  CloseGadgetList()\nEndProcedure\n`;

  const patched = patch(text, "#Container_0");
  const parsed = parseFormDocument(patched);

  assert.match(patched, /Enumeration FormGadget\s+  #Container_0\s+  #BtnChild\s+  #Container_1\s+EndEnumeration/s);
  assert.match(patched, /ContainerGadget\(#Container_0, 10, 10, 140, 80\)\s+    ButtonGadget\(#BtnChild, 10, 20, 80, 24, "Child"\)\s+  CloseGadgetList\(\)\s+  ContainerGadget\(#Container_1, 10, 90, 140, 80\)\s+  CloseGadgetList\(\)/s);
  assert.equal(parsed.gadgets.some(gadget => gadget.id === "#BtnChild_1"), false);
  const duplicated = parsed.gadgets.find(gadget => gadget.id === "#Container_1");
  assert.equal(duplicated?.y, 90);
});

test("duplicates a PanelGadget host with items but without recursive tab children", () => {
  const text = `; Form Designer for PureBasic - 6.40 LTS\n\nEnumeration FormWindow\n  #FrmMain\nEndEnumeration\n\nEnumeration FormGadget\n  #Panel_0\n  #TxtTab1\nEndEnumeration\n\nProcedure OpenFrmMain(x = 0, y = 0, width = 240, height = 190)\n  OpenWindow(#FrmMain, x, y, width, height, \"Main\")\n  PanelGadget(#Panel_0, 10, 10, 180, 90)\n    AddGadgetItem(#Panel_0, -1, \"Tab 1\")\n    TextGadget(#TxtTab1, 8, 8, 80, 20, \"Child\")\n    AddGadgetItem(#Panel_0, -1, \"Tab 2\")\n  CloseGadgetList()\nEndProcedure\n`;

  const patched = patch(text, "#Panel_0");
  const parsed = parseFormDocument(patched);

  assert.match(patched, /Enumeration FormGadget\s+  #Panel_0\s+  #TxtTab1\s+  #Panel_1\s+EndEnumeration/s);
  assert.match(patched, /PanelGadget\(#Panel_1, 10, 100, 180, 90\)\s+    AddGadgetItem\(#Panel_1, -1, "Tab 1"\)\s+    AddGadgetItem\(#Panel_1, -1, "Tab 2"\)\s+  CloseGadgetList\(\)/s);
  assert.equal(parsed.gadgets.some(gadget => gadget.id === "#TxtTab1_1"), false);
  const duplicated = parsed.gadgets.find(gadget => gadget.id === "#Panel_1");
  assert.equal(duplicated?.items?.length, 2);
});

test("does not duplicate splitter-bound gadgets", () => {
  const text = `; Form Designer for PureBasic - 6.40 LTS\n\nEnumeration FormWindow\n  #FrmMain\nEndEnumeration\n\nEnumeration FormGadget\n  #BtnLeft\n  #BtnRight\n  #SplitMain\nEndEnumeration\n\nProcedure OpenFrmMain(x = 0, y = 0, width = 260, height = 160)\n  OpenWindow(#FrmMain, x, y, width, height, \"Main\")\n  ButtonGadget(#BtnLeft, 10, 10, 80, 24, \"Left\")\n  ButtonGadget(#BtnRight, 100, 10, 80, 24, \"Right\")\n  SplitterGadget(#SplitMain, 10, 50, 180, 80, #BtnLeft, #BtnRight)\nEndProcedure\n`;

  const document = new FakeTextDocument(text);
  assert.equal(applyGadgetDuplicate(document.asTextDocument(), "#BtnLeft"), undefined);
  assert.equal(applyGadgetDuplicate(document.asTextDocument(), "#SplitMain"), undefined);
});
