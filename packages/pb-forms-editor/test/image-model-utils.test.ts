import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFormImageEditorDraft,
  buildFormImageLineLabel,
  canChooseFileForFormImageEntry,
  canRelativizeFormImageEntry,
  canToggleFormImagePbAny,
  FORM_IMAGE_CALL,
  getFormImageCallName,
  requiresFormImageAssignedVar,
} from "../src/core/image/model";
import type { FormImage } from "../src/core/model";

test("maps the original inline flag to LoadImage and CatchImage calls", () => {
  assert.equal(getFormImageCallName({ inline: false }), FORM_IMAGE_CALL.LoadImage);
  assert.equal(getFormImageCallName({ inline: true }), FORM_IMAGE_CALL.CatchImage);
});

test("keeps file actions limited to LoadImage entries with literal paths", () => {
  assert.equal(canChooseFileForFormImageEntry({ inline: false }), true);
  assert.equal(canChooseFileForFormImageEntry({ inline: true }), false);
  assert.equal(canRelativizeFormImageEntry({ inline: false, imageRaw: '"icons/open.png"' }), true);
  assert.equal(canRelativizeFormImageEntry({ inline: false, imageRaw: 'ImagePath$ + "open.png"' }), false);
  assert.equal(canRelativizeFormImageEntry({ inline: true, imageRaw: '?ImgOpen' }), false);
});

test("uses the same PB_Any toggle guard as the current image editor", () => {
  assert.equal(canToggleFormImagePbAny({ pbAny: true, variable: "ImgLogo", id: "ImgLogo" }), true);
  assert.equal(canToggleFormImagePbAny({ pbAny: true, variable: "", id: "" }), false);
  assert.equal(canToggleFormImagePbAny({ pbAny: false, firstParam: "#ImgLogo" }), true);
  assert.equal(canToggleFormImagePbAny({ pbAny: false, firstParam: "" }), false);
});

test("builds image editor drafts from the source-backed FormImage model", () => {
  const image: FormImage = {
    id: "#Img_FrmMain_0",
    pbAny: false,
    firstParam: "#Img_FrmMain_0",
    imageRaw: '"logo.png"',
    image: "logo.png",
    inline: false,
    source: { start: 42, end: 76, line: 7, lineStart: 40 },
  };

  assert.deepEqual(buildFormImageEditorDraft(image), {
    sourceLine: 7,
    inline: false,
    idRaw: "#Img_FrmMain_0",
    imageRaw: '"logo.png"',
    assignedVar: "#Img_FrmMain_0",
  });
});

test("builds compact image-list labels without changing the underlying PB call", () => {
  assert.equal(buildFormImageLineLabel({
    id: "ImgLogo",
    pbAny: true,
    variable: "ImgLogo",
    firstParam: "#PB_Any",
    imageRaw: '?ImgLogo',
    image: "ImgLogo",
    inline: true,
  }), "ImgLogo = CatchImage(#PB_Any, ?ImgLogo)");

  assert.equal(requiresFormImageAssignedVar(" #PB_Any "), true);
  assert.equal(requiresFormImageAssignedVar("#ImgLogo"), false);
});
