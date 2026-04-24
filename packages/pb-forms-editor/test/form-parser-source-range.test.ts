import test from "node:test";
import assert from "node:assert/strict";

import { parseFormDocument } from "../src/core/parser/form-parser";
import { GADGET_KIND } from "../src/core/model";
import { loadFixture } from "./helpers/loadFixture";

const CUSTOM_GADGET_FIXTURE = loadFixture("fixtures/roundtrip/66-custom-gadget-marker-pair-basic.pbf");

function buildCustomGadgetFixture(eol: string): string {
  if (eol === "\n") {
    return CUSTOM_GADGET_FIXTURE;
  }

  return CUSTOM_GADGET_FIXTURE.replace(/\r?\n/g, eol);
}

function parseSingleCustomGadget(text: string) {
  const doc = parseFormDocument(text);
  assert.equal(doc.gadgets.length, 1);

  const gadget = doc.gadgets[0];
  assert.ok(gadget);
  assert.equal(gadget?.kind, GADGET_KIND.CustomGadget);
  assert.ok(gadget?.customInitSource);
  assert.ok(gadget?.customCreateMarkerSource);
  assert.ok(gadget?.source);

  return gadget!;
}

test("keeps custom gadget SourceRange.lineStart byte-accurate for LF documents", () => {
  const text = buildCustomGadgetFixture("\n");
  const gadget = parseSingleCustomGadget(text);

  assert.equal(gadget.customInitSource?.lineStart, text.indexOf("InitFancyWidget()"));
  assert.equal(
    gadget.customCreateMarkerSource?.lineStart,
    text.indexOf("  ; 0 Custom gadget creation (do not remove this line) FancyWidget(%id%, %x%, %y%, %w%, %h%, %txt%, %hwnd%)")
  );
  assert.equal(gadget.source?.lineStart, text.indexOf('  FancyWidget(#Fancy, 10, 20, 130, 24, "Caption", WindowID(#Form))'));
});

test("keeps custom gadget SourceRange.lineStart byte-accurate for CRLF documents", () => {
  const text = buildCustomGadgetFixture("\r\n");
  const gadget = parseSingleCustomGadget(text);

  assert.equal(gadget.customInitSource?.lineStart, text.indexOf("InitFancyWidget()"));
  assert.equal(
    gadget.customCreateMarkerSource?.lineStart,
    text.indexOf("  ; 0 Custom gadget creation (do not remove this line) FancyWidget(%id%, %x%, %y%, %w%, %h%, %txt%, %hwnd%)")
  );
  assert.equal(gadget.source?.lineStart, text.indexOf('  FancyWidget(#Fancy, 10, 20, 130, 24, "Caption", WindowID(#Form))'));
});

test("keeps successive CRLF line starts stable across the original custom gadget create marker pair", () => {
  const text = buildCustomGadgetFixture("\r\n");
  const gadget = parseSingleCustomGadget(text);
  const markerStart = text.indexOf(
    "  ; 0 Custom gadget creation (do not remove this line) FancyWidget(%id%, %x%, %y%, %w%, %h%, %txt%, %hwnd%)"
  );
  const callStart = text.indexOf('  FancyWidget(#Fancy, 10, 20, 130, 24, "Caption", WindowID(#Form))');

  assert.equal(gadget.customCreateMarkerSource?.lineStart, markerStart);
  assert.equal(gadget.source?.lineStart, callStart);
  assert.equal(
    callStart - markerStart,
    "  ; 0 Custom gadget creation (do not remove this line) FancyWidget(%id%, %x%, %y%, %w%, %h%, %txt%, %hwnd%)\r\n".length
  );
});
