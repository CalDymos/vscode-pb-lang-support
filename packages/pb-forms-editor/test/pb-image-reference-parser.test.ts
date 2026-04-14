import test from "node:test";
import assert from "node:assert/strict";

import { parsePbImageReference } from "../src/core/parser/pb-image-reference";

test("parses ImageID wrappers into trimmed raw and id values", () => {
  assert.deepEqual(parsePbImageReference('  ImageID(  #ImgOpen  )  '), {
    imageRaw: 'ImageID(  #ImgOpen  )',
    imageId: '#ImgOpen'
  });
});

test("keeps plain image references as direct ids", () => {
  assert.deepEqual(parsePbImageReference('img_open'), {
    imageRaw: 'img_open',
    imageId: 'img_open'
  });
  assert.deepEqual(parsePbImageReference(undefined), {});
});
