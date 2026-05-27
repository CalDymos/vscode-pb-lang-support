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

test("does not duplicate splitter-bound or structural gadgets in the first Duplicate patch scope", () => {
  const text = `; Form Designer for PureBasic - 6.40 LTS\n\nEnumeration FormWindow\n  #FrmMain\nEndEnumeration\n\nEnumeration FormGadget\n  #Container_0\n  #BtnChild\nEndEnumeration\n\nProcedure OpenFrmMain(x = 0, y = 0, width = 220, height = 140)\n  OpenWindow(#FrmMain, x, y, width, height, \"Main\")\n  ContainerGadget(#Container_0, 10, 10, 140, 80)\n    ButtonGadget(#BtnChild, 10, 20, 80, 24, \"Child\")\n  CloseGadgetList()\nEndProcedure\n`;

  const document = new FakeTextDocument(text);
  assert.equal(applyGadgetDuplicate(document.asTextDocument(), "#Container_0"), undefined);
});
