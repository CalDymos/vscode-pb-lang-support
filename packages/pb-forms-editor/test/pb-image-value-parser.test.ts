import test from "node:test";
import assert from "node:assert/strict";

import { normalizePbImageValue } from "../src/core/parser/pb-image-value";

test("normalizes quoted LoadImage paths through the shared PB string parser", () => {
  assert.equal(normalizePbImageValue('"logo.png"', false), "logo.png");
  assert.equal(normalizePbImageValue('~"icons/""main"".png"', false), 'icons/"main".png');
});

test("keeps non-literal LoadImage expressions unchanged", () => {
  assert.equal(normalizePbImageValue('ImagePath$ + "logo.png"', false), 'ImagePath$ + "logo.png"');
});

test("normalizes CatchImage labels by stripping the leading marker", () => {
  assert.equal(normalizePbImageValue('?ImgInlineLogo', true), 'ImgInlineLogo');
  assert.equal(normalizePbImageValue(' ??  ImgInlineLogo  ', true), 'ImgInlineLogo');
});
