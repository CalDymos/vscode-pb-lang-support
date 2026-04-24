import test from "node:test";
import assert from "node:assert/strict";

import { parseFormDocument } from "../src/core/parser/form-parser";
import {
  applyCustomGadgetCodeUpdate,
  applyGadgetOpenArgsUpdate,
  applyMovePatch,
  applyRectPatch
} from "../src/core/emitter/patch-emitter";
import { GADGET_KIND } from "../src/core/model";
import { FakeTextDocument } from "./helpers/fakeTextDocument";
import { stripBomAndToLf } from "./helpers/testUtils";
import { applyWorkspaceEditToText } from "./helpers/applyWorkspaceEdit";
import { loadFixture } from "./helpers/loadFixture";

const CUSTOM_GADGET_FIXTURE = loadFixture("fixtures/roundtrip/66-custom-gadget-marker-pair-basic.pbf");

test("parses original custom gadget marker pairs into a CustomGadget model entry", () => {
  const doc = parseFormDocument(CUSTOM_GADGET_FIXTURE);
  assert.equal(doc.gadgets.length, 1);

  const gadget = doc.gadgets[0];
  assert.ok(gadget);
  assert.equal(gadget?.kind, GADGET_KIND.CustomGadget);
  assert.equal(gadget?.id, "#Fancy");
  assert.equal(gadget?.firstParam, "#Fancy");
  assert.equal(gadget?.customSelectName, "FancyWidget");
  assert.equal(gadget?.customInitRaw, "InitFancyWidget()");
  assert.equal(gadget?.customCreateRaw, "FancyWidget(%id%, %x%, %y%, %w%, %h%, %txt%, %hwnd%)");
  assert.equal(gadget?.textRaw, '"Caption"');
  assert.equal(gadget?.text, "Caption");
  assert.equal(gadget?.x, 10);
  assert.equal(gadget?.y, 20);
  assert.equal(gadget?.w, 130);
  assert.equal(gadget?.h, 24);
});

test("patches custom gadget InitCode and CreateCode through the original marker pair", () => {
  const document = new FakeTextDocument(CUSTOM_GADGET_FIXTURE);
  const edit = applyCustomGadgetCodeUpdate(document.asTextDocument(), "#Fancy", {
    customInitRaw: "InitOtherWidget()",
    customCreateRaw: "OtherWidget(%id%, %x%, %y%, %w%, %h%, %txt%)"
  });

  assert.ok(edit);
  const updated = applyWorkspaceEditToText(CUSTOM_GADGET_FIXTURE, edit!);
  assert.match(updated, /InitOtherWidget\(\)/);
  assert.match(updated, /; 0 Custom gadget creation \(do not remove this line\) OtherWidget\(%id%, %x%, %y%, %w%, %h%, %txt%\)/);
  assert.match(updated, /OtherWidget\(#Fancy, 10, 20, 130, 24, "Caption"\)/);
});

test("deletes the original custom gadget init marker pair when InitCode is cleared", () => {
  const document = new FakeTextDocument(CUSTOM_GADGET_FIXTURE);
  const edit = applyCustomGadgetCodeUpdate(document.asTextDocument(), "#Fancy", {
    customInitRaw: ""
  });

  assert.ok(edit);
  const updated = applyWorkspaceEditToText(CUSTOM_GADGET_FIXTURE, edit!);
  assert.doesNotMatch(updated, /Custom gadget initialisation/);
  assert.doesNotMatch(updated, /InitFancyWidget\(\)/);
  assert.match(updated, /Custom gadget creation/);
});

test("patches custom gadget caption changes through the generated creation line", () => {
  const document = new FakeTextDocument(CUSTOM_GADGET_FIXTURE);
  const edit = applyGadgetOpenArgsUpdate(document.asTextDocument(), "#Fancy", {
    textRaw: '"Updated Caption"'
  });

  assert.ok(edit);
  const updated = applyWorkspaceEditToText(CUSTOM_GADGET_FIXTURE, edit!);
  assert.match(updated, /FancyWidget\(#Fancy, 10, 20, 130, 24, "Updated Caption", WindowID\(#Form\)\)/);
  assert.match(updated, /Custom gadget creation \(do not remove this line\) FancyWidget\(%id%, %x%, %y%, %w%, %h%, %txt%, %hwnd%\)/);
});

test("patches custom gadget move and rect edits through the generated creation line", () => {
  const moveDoc = new FakeTextDocument(CUSTOM_GADGET_FIXTURE);
  const moveEdit = applyMovePatch(moveDoc.asTextDocument(), "#Fancy", 14, 28);
  assert.ok(moveEdit);
  const moved = applyWorkspaceEditToText(CUSTOM_GADGET_FIXTURE, moveEdit!);
  assert.match(moved, /FancyWidget\(#Fancy, 14, 28, 130, 24, "Caption", WindowID\(#Form\)\)/);

  const rectDoc = new FakeTextDocument(CUSTOM_GADGET_FIXTURE);
  const rectEdit = applyRectPatch(rectDoc.asTextDocument(), "#Fancy", 8, 18, 140, 30);
  assert.ok(rectEdit);
  const resized = applyWorkspaceEditToText(CUSTOM_GADGET_FIXTURE, rectEdit!);
  assert.match(resized, /FancyWidget\(#Fancy, 8, 18, 140, 30, "Caption", WindowID\(#Form\)\)/);
});


test("preserves exact non-empty InitCode and CreateCode grid strings", () => {
  const document = new FakeTextDocument(CUSTOM_GADGET_FIXTURE);
  const edit = applyCustomGadgetCodeUpdate(document.asTextDocument(), "#Fancy", {
    customInitRaw: "InitOtherWidget()  ",
    customCreateRaw: " OtherWidget(%id%, %x%, %y%, %w%, %h%, %txt%)  "
  });

  assert.ok(edit);
  // NOTE: normalize CRLF → LF so assertions are line-ending agnostic
  const updated = stripBomAndToLf(applyWorkspaceEditToText(CUSTOM_GADGET_FIXTURE, edit!));
  assert.ok(updated.includes("InitOtherWidget()  \n"));
  assert.ok(updated.includes("Custom gadget creation (do not remove this line)  OtherWidget(%id%, %x%, %y%, %w%, %h%, %txt%)  \n"));
  assert.ok(updated.includes('  OtherWidget(#Fancy, 10, 20, 130, 24, "Caption")  \n'));
});

test("uses the parsed OpenWindow target for %hwnd% in pbAny window fixtures", () => {
  const fixture = `; Form Designer for PureBasic - 6.40
; Warning: this file uses a strict syntax, if you edit it, make sure to respect the Form Designer limitation or it won't be opened again.

;
; This code is automatically generated by the Form Designer.
; Manual modification is possible to adjust existing commands, but anything else will be dropped when the code is compiled.
; Event procedures need to be put in another source file.
;

Global winMain
Global FancyGadget

Procedure OpenwinMain(x = 0, y = 0, width = 220, height = 140)
  winMain = OpenWindow(#PB_Any, x, y, width, height, "Custom")
  ; 0 Custom gadget creation (do not remove this line) FancyWidget(%id%, %x%, %y%, %w%, %h%, %txt%, %hwnd%)
  FancyGadget = FancyWidget(#PB_Any, 10, 20, 130, 24, "Caption", WindowID(winMain))
EndProcedure
`;

  const moveDoc = new FakeTextDocument(fixture);
  const moveEdit = applyMovePatch(moveDoc.asTextDocument(), "FancyGadget", 14, 28);
  assert.ok(moveEdit);
  const moved = applyWorkspaceEditToText(fixture, moveEdit!);
  assert.match(moved, /FancyGadget = FancyWidget\(#PB_Any, 14, 28, 130, 24, "Caption", WindowID\(winMain\)\)/);
});

