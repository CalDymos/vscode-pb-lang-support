import test from "node:test";
import assert from "node:assert/strict";

import {
  getStatusBarCurrentImageEditState,
  resolveStatusBarCurrentImageCreate,
  resolveStatusBarCurrentImageRebind,
  shouldCleanupStatusBarReboundImage
} from "../src/core/statusbar/image-inspector";

test("allows direct CurrentImage edit for unique parsed LoadImage entries", () => {
  const state = getStatusBarCurrentImageEditState({ inline: false, source: { line: 12 } }, 1);
  assert.equal(state.canDirectEdit, true);
  assert.match(state.reason ?? "", /LoadImage/i);
});

test("blocks direct CurrentImage edit for shared image entries", () => {
  const state = getStatusBarCurrentImageEditState({ inline: false, source: { line: 12 } }, 2);
  assert.equal(state.canDirectEdit, false);
  assert.match(state.reason ?? "", /shared/i);
});

test("blocks direct CurrentImage edit for CatchImage entries", () => {
  const state = getStatusBarCurrentImageEditState({ inline: true, source: { line: 12 } }, 1);
  assert.equal(state.canDirectEdit, false);
  assert.match(state.reason ?? "", /CatchImage/i);
});

test("blocks direct CurrentImage edit when no parsed image entry exists", () => {
  const state = getStatusBarCurrentImageEditState(undefined, 0);
  assert.equal(state.canDirectEdit, false);
  assert.match(state.reason ?? "", /assign one first/i);
});

test("rebinds shared CurrentImage to an existing parsed LoadImage path", () => {
  const resolution = resolveStatusBarCurrentImageRebind(
    [
      { id: "#ImgOpen", imageRaw: '"open.png"', image: "open.png", inline: false },
      { id: "#ImgState", imageRaw: "?ImgState", image: "ImgState", inline: true },
    ],
    "open.png",
    "#ImgState"
  );

  assert.equal(resolution.matchedImage?.id, "#ImgOpen");
  assert.equal(resolution.reason, undefined);
});

test("rebinds CatchImage CurrentImage by matching the normalized inline label", () => {
  const resolution = resolveStatusBarCurrentImageRebind(
    [
      { id: "#ImgState", imageRaw: "?ImgState", image: "ImgState", inline: true },
    ],
    "ImgState",
    "#ImgOther"
  );

  assert.equal(resolution.matchedImage?.id, "#ImgState");
});

test("rebinds CatchImage CurrentImage even when the inspector input keeps the leading question mark", () => {
  const resolution = resolveStatusBarCurrentImageRebind(
    [
      { id: "#ImgState", imageRaw: "?ImgState", image: "ImgState", inline: true },
    ],
    "?ImgState",
    "#ImgOther"
  );

  assert.equal(resolution.matchedImage?.id, "#ImgState");
});

test("rejects CurrentImage rebind when multiple parsed image entries match", () => {
  const resolution = resolveStatusBarCurrentImageRebind(
    [
      { id: "#ImgOpenA", imageRaw: '"open.png"', image: "open.png", inline: false },
      { id: "#ImgOpenB", imageRaw: '"open.png"', image: "open.png", inline: false },
    ],
    "open.png",
    "#ImgState"
  );

  assert.equal(resolution.matchedImage, undefined);
  assert.match(resolution.reason ?? "", /multiple/i);
});

test("cleans the previous image entry only for unique rebinding targets", () => {
  assert.equal(shouldCleanupStatusBarReboundImage("#ImgState", 1, 42, "#ImgOpen"), true);
  assert.equal(shouldCleanupStatusBarReboundImage("#ImgState", 2, 42, "#ImgOpen"), false);
  assert.equal(shouldCleanupStatusBarReboundImage("#ImgState", 1, undefined, "#ImgOpen"), false);
  assert.equal(shouldCleanupStatusBarReboundImage("#ImgState", 1, 42, "#ImgState"), false);
});


test("auto-creates a new LoadImage entry for a path-like CurrentImage string", () => {
  const resolution = resolveStatusBarCurrentImageCreate(
    [
      { id: "#Img_FrmImages_0", imageRaw: '"open.png"' },
      { id: "#Img_FrmImages_1", imageRaw: '"save.png"' },
      { id: "#Img_FrmImages_3", imageRaw: '?Img_FrmImages_3', inline: true },
    ],
    "./icons/new.png",
    "#FrmImages"
  );

  assert.equal(resolution.imageIdRaw, "#Img_FrmImages_2");
  assert.equal(resolution.imageRaw, '"./icons/new.png"');
});



test("auto-creates a new LoadImage entry for escaped PB string literals", () => {
  const resolution = resolveStatusBarCurrentImageCreate(
    [],
    ' ~"./icons/""new"".png" ',
    "#FrmImages"
  );

  assert.equal(resolution.imageIdRaw, "#Img_FrmImages_0");
  assert.equal(resolution.imageRaw, '"./icons/""new"".png"');
});

test("rejects ambiguous non-path CurrentImage strings for automatic creation", () => {
  const resolution = resolveStatusBarCurrentImageCreate([], "ImgInlineLabel", "#FrmImages");

  assert.equal(resolution.imageIdRaw, undefined);
  assert.match(resolution.reason ?? "", /Create New/i);
});
