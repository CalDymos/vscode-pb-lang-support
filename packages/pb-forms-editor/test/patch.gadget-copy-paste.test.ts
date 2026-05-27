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

test("does not paste splitter-bound or structural gadgets in the first copy paste patch scope", () => {
  const text = `; Form Designer for PureBasic - 6.40 LTS\n\nEnumeration FormWindow\n  #FrmMain\nEndEnumeration\n\nEnumeration FormGadget\n  #Container_0\n  #BtnChild\nEndEnumeration\n\nProcedure OpenFrmMain(x = 0, y = 0, width = 220, height = 140)\n  OpenWindow(#FrmMain, x, y, width, height, "Main")\n  ContainerGadget(#Container_0, 10, 10, 140, 80)\n    ButtonGadget(#BtnChild, 10, 20, 80, 24, "Child")\n  CloseGadgetList()\nEndProcedure\n`;

  const document = new FakeTextDocument(text);
  assert.equal(applyGadgetCopyPaste(document.asTextDocument(), "#Container_0"), undefined);
});
