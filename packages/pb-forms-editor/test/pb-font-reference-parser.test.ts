import test from "node:test";
import assert from "node:assert/strict";

import { parsePbFontReference } from "../src/core/parser/pb-font-reference";

test("parses FontID wrappers into trimmed raw and id values", () => {
  assert.deepEqual(parsePbFontReference('  FontID(  #FontBody  )  '), {
    fontRaw: 'FontID(  #FontBody  )',
    fontId: '#FontBody'
  });
});

test("keeps plain font references as direct ids", () => {
  assert.deepEqual(parsePbFontReference('fontBody'), {
    fontRaw: 'fontBody',
    fontId: 'fontBody'
  });
  assert.deepEqual(parsePbFontReference(undefined), {});
});
