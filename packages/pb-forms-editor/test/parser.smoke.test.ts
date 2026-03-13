import test from "node:test";
import assert from "node:assert/strict";

import { parseFormDocument } from "../src/core/parser/formParser";
import { GADGET_KIND } from "../src/core/model";
import { loadFixture } from "./helpers/loadFixture";

test("parses fixtures/smoke/01-window-basic.pbf", () => {
  const text = loadFixture("fixtures/smoke/01-window-basic.pbf");
  const doc = parseFormDocument(text);

  assert.ok(doc.window, "Expected a parsed window.");
  assert.equal(doc.window?.id, "#FrmMain");
  assert.equal(doc.window?.variable, "FrmMain");
  assert.equal(doc.window?.pbAny, false);
  assert.equal(doc.window?.w, 220);
  assert.equal(doc.window?.h, 140);
  assert.equal(doc.gadgets.length, 0);
  assert.ok(doc.meta.enums);
  assert.deepEqual(doc.meta.enums?.windows, ["#FrmMain"]);
  assert.deepEqual(doc.meta.enums?.gadgets, []);
});

test("parses fixtures/smoke/03-gadgets-basic.pbf", () => {
  const text = loadFixture("fixtures/smoke/03-gadgets-basic.pbf");
  const doc = parseFormDocument(text);

  assert.ok(doc.window, "Expected a parsed window.");
  assert.equal(doc.window?.id, "#FrmGadgets");
  assert.equal(doc.window?.variable, "FrmGadgets");
  assert.equal(doc.window?.pbAny, false);
  assert.equal(doc.gadgets.length, 3);

  const textGadget = doc.gadgets.find((g) => g.kind === GADGET_KIND.TextGadget);
  assert.ok(textGadget, "Expected one TextGadget.");
  assert.equal(textGadget?.id, "#LblName");

  const buttonGadget = doc.gadgets.find((g) => g.kind === GADGET_KIND.ButtonGadget);
  assert.ok(buttonGadget, "Expected one ButtonGadget.");
  assert.equal(buttonGadget?.id, "#BtnOk");

  const pbAnyGadgets = doc.gadgets.filter((g) => g.pbAny);
  assert.equal(pbAnyGadgets.length, 1);
  assert.equal(pbAnyGadgets[0]?.kind, GADGET_KIND.StringGadget);
  assert.equal(pbAnyGadgets[0]?.id, "gInput");
  assert.equal(pbAnyGadgets[0]?.variable, "gInput");
});

test("parses samples/sample.pbf as a real-world smoke case", () => {
  const text = loadFixture("samples/sample.pbf");
  const doc = parseFormDocument(text);

  assert.ok(doc.window, "Expected a parsed window.");
  assert.ok(doc.window?.id.length, "Expected a non-empty window id.");
  assert.ok(doc.gadgets.length > 0, "Expected at least one parsed gadget.");
});
