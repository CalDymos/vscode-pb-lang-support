import test from "node:test";
import assert from "node:assert/strict";

import {
  isEmptyFormImageReference,
  isFormImageIdReference,
  parsePbImageIdReference,
  parsePbImageReference
} from "../src/core/parser/pb-image-reference";

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

test("distinguishes original ImageID references from tolerant raw fallback values", () => {
  assert.deepEqual(parsePbImageIdReference('  ImageID(  #ImgOpen  )  '), {
    imageRaw: 'ImageID(  #ImgOpen  )',
    imageId: '#ImgOpen'
  });

  assert.deepEqual(parsePbImageIdReference('img_open'), {
    imageRaw: 'img_open',
    imageId: undefined
  });

  assert.equal(isFormImageIdReference('ImageID(#ImgOpen)'), true);
  assert.equal(isFormImageIdReference('0'), false);
  assert.equal(isEmptyFormImageReference('0'), true);
  assert.equal(isEmptyFormImageReference('   '), true);
});
