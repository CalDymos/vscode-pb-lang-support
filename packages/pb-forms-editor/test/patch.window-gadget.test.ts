import test from "node:test";
import assert from "node:assert/strict";

import { parseFormDocument } from "../src/core/parser/formParser";
import { applyMovePatch, applyRectPatch, applyWindowRectPatch } from "../src/core/emitter/patchEmitter";
import { loadFixture } from "./helpers/loadFixture";
import { FakeTextDocument } from "./helpers/fakeTextDocument";
import { applyWorkspaceEditToText } from "./helpers/applyWorkspaceEdit";

import type { TextDocument } from "vscode";

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