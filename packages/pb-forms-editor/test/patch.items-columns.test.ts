import test from "node:test";
import assert from "node:assert/strict";

import { parseFormDocument } from "../src/core/parser/formParser";
import {
  applyGadgetColumnDelete,
  applyGadgetColumnInsert,
  applyGadgetColumnUpdate,
  applyGadgetItemDelete,
  applyGadgetItemInsert,
  applyGadgetItemUpdate,
  type GadgetColumnArgs,
  type GadgetItemArgs,
} from "../src/core/emitter/patchEmitter";
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
    | ReturnType<typeof applyGadgetItemInsert>
    | ReturnType<typeof applyGadgetItemUpdate>
    | ReturnType<typeof applyGadgetItemDelete>
    | ReturnType<typeof applyGadgetColumnInsert>
    | ReturnType<typeof applyGadgetColumnUpdate>
    | ReturnType<typeof applyGadgetColumnDelete>
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
  const text = loadFixture("fixtures/roundtrip/04-gadget-items-columns.pbf");
  const parsed = parseFormDocument(text);
  const list = parsed.gadgets.find((g) => g.id === "#ListUsers");

  assert.ok(list, "Expected #ListUsers gadget.");
  assert.ok(list?.items, "Expected parsed gadget items.");
  assert.ok(list?.columns, "Expected parsed gadget columns.");

  return { text, parsed, list: list! };
}

test("roundtrips gadget item insert", () => {
  const { text } = parseFixture();
  const args: GadgetItemArgs = {
    posRaw: "-1",
    textRaw: '"Cara"',
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyGadgetItemInsert(document, "#ListUsers", args)
  );

  const list = parsed.gadgets.find((g) => g.id === "#ListUsers");
  assert.ok(list?.items, "Expected items after insert.");
  assert.equal(list!.items!.length, 3);
  assert.equal(list!.items![2]?.text, "Cara");
  assert.match(patchedText, /AddGadgetItem\(#ListUsers, -1, "Cara"\)/);
});

test("roundtrips gadget item update", () => {
  const { text, list } = parseFixture();
  const sourceLine = list.items?.[1]?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for second item.");

  const args: GadgetItemArgs = {
    posRaw: "-1",
    textRaw: '"Bobby"',
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyGadgetItemUpdate(document, "#ListUsers", sourceLine!, args)
  );

  const updatedList = parsed.gadgets.find((g) => g.id === "#ListUsers");
  assert.ok(updatedList?.items, "Expected items after update.");
  assert.equal(updatedList!.items!.length, 2);
  assert.equal(updatedList!.items![1]?.text, "Bobby");
  assert.match(patchedText, /AddGadgetItem\(#ListUsers, -1, "Bobby"\)/);
});

test("roundtrips gadget item delete", () => {
  const { text, list } = parseFixture();
  const sourceLine = list.items?.[0]?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for first item.");

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyGadgetItemDelete(document, "#ListUsers", sourceLine!)
  );

  const updatedList = parsed.gadgets.find((g) => g.id === "#ListUsers");
  assert.ok(updatedList?.items, "Expected items after delete.");
  assert.equal(updatedList!.items!.length, 1);
  assert.equal(updatedList!.items![0]?.text, "Bob");
  assert.doesNotMatch(patchedText, /AddGadgetItem\(#ListUsers, -1, "Alice"\)/);
});

test("roundtrips gadget column insert", () => {
  const { text } = parseFixture();
  const args: GadgetColumnArgs = {
    colRaw: "2",
    titleRaw: '"Status"',
    widthRaw: "80",
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyGadgetColumnInsert(document, "#ListUsers", args)
  );

  const list = parsed.gadgets.find((g) => g.id === "#ListUsers");
  assert.ok(list?.columns, "Expected columns after insert.");
  assert.equal(list!.columns!.length, 2);
  assert.equal(list!.columns![1]?.title, "Status");
  assert.match(patchedText, /AddGadgetColumn\(#ListUsers, 2, "Status", 80\)/);
});

test("roundtrips gadget column update", () => {
  const { text, list } = parseFixture();
  const sourceLine = list.columns?.[0]?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for first column.");

  const args: GadgetColumnArgs = {
    colRaw: "1",
    titleRaw: '"Department"',
    widthRaw: "140",
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyGadgetColumnUpdate(document, "#ListUsers", sourceLine!, args)
  );

  const updatedList = parsed.gadgets.find((g) => g.id === "#ListUsers");
  assert.ok(updatedList?.columns, "Expected columns after update.");
  assert.equal(updatedList!.columns!.length, 1);
  assert.equal(updatedList!.columns![0]?.title, "Department");
  assert.equal(updatedList!.columns![0]?.widthRaw, "140");
  assert.match(patchedText, /AddGadgetColumn\(#ListUsers, 1, "Department", 140\)/);
});

test("roundtrips gadget column delete", () => {
  const { text, list } = parseFixture();
  const sourceLine = list.columns?.[0]?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected source line for first column.");

  const { parsed, patchedText } = patchAndReparse(text, (document) =>
    applyGadgetColumnDelete(document, "#ListUsers", sourceLine!)
  );

  const updatedList = parsed.gadgets.find((g) => g.id === "#ListUsers");
  assert.equal(updatedList?.columns?.length ?? 0, 0);
  assert.doesNotMatch(patchedText, /AddGadgetColumn\(#ListUsers, 1, "Role", 100\)/);
});
