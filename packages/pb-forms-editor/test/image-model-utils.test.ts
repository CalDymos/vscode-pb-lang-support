import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCreatedFormImageReference,
  buildFormImageEditorDraft,
  buildFormImageLineLabel,
  canChooseFileForFormImageEntry,
  canRelativizeFormImageEntry,
  canToggleFormImagePbAny,
  collectFormImageUsages,
  countFormImageUsages,
  findFormImageEntryById,
  FORM_IMAGE_CALL,
  getDefaultFormImageReferenceSelection,
  getFormImageCallName,
  getFormImageReferenceHint,
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


test("builds original ImageID references for created image entries", () => {
  assert.deepEqual(buildCreatedFormImageReference("#ImgLogo"), {
    imageId: "#ImgLogo",
    imageRaw: "ImageID(#ImgLogo)",
  });
  assert.deepEqual(buildCreatedFormImageReference("#PB_Any", "imgLogo"), {
    imageId: "imgLogo",
    imageRaw: "ImageID(imgLogo)",
  });
  assert.equal(buildCreatedFormImageReference("#PB_Any"), undefined);
});

test("resolves default image reference selections from the central image list", () => {
  const images: FormImage[] = [
    { id: "#ImgFirst", pbAny: false, firstParam: "#ImgFirst", imageRaw: '"first.png"', inline: false },
    { id: "imgDynamic", pbAny: true, variable: "imgDynamic", firstParam: "#PB_Any", imageRaw: '"dynamic.png"', inline: false },
  ];

  assert.equal(findFormImageEntryById(images, "#ImgFirst")?.id, "#ImgFirst");
  assert.equal(getDefaultFormImageReferenceSelection(images, "imgDynamic"), "imgDynamic");
  assert.equal(getDefaultFormImageReferenceSelection(images, "#Missing"), "#ImgFirst");
  assert.equal(getDefaultFormImageReferenceSelection([], "#Missing"), "");
});

test("reports missing image references with scope-specific hints", () => {
  const images: FormImage[] = [
    { id: "#ImgOpen", pbAny: false, firstParam: "#ImgOpen", imageRaw: '"open.png"', inline: false },
  ];

  assert.equal(getFormImageReferenceHint(images, undefined, "menu"), "This entry has no parsed image reference.");
  assert.equal(getFormImageReferenceHint(images, undefined, "statusbar"), "This field has no parsed image reference.");
  assert.equal(getFormImageReferenceHint(images, "#Missing", "toolbar"), "Referenced image '#Missing' is not loaded in this form.");
  assert.equal(getFormImageReferenceHint(images, "#ImgOpen", "gadget"), "");
});

test("collects image usages across gadget, menu, toolbar and statusbar reference fields", () => {
  const document = {
    gadgets: [
      {
        id: "#ImgPreview",
        kind: "ImageGadget" as const,
        pbAny: false,
        firstParam: "#ImgPreview",
        x: 0,
        y: 0,
        w: 32,
        h: 32,
        imageRaw: "ImageID(#ImgOpen)",
        imageId: "#ImgOpen",
        items: [{ posRaw: "-1", textRaw: '"Node"', imageRaw: "ImageID(#ImgOpen)", imageId: "#ImgOpen" }]
      }
    ],
    menus: [{ id: "0", entries: [{ kind: "MenuItem" as const, idRaw: "#MnuOpen", iconRaw: "ImageID(#ImgOpen)", iconId: "#ImgOpen" }] }],
    toolbars: [{ id: "0", entries: [{ kind: "ToolBarImageButton" as const, idRaw: "#TbOpen", iconRaw: "ImageID(#ImgOpen)", iconId: "#ImgOpen" }] }],
    statusbars: [{ id: "0", fields: [{ widthRaw: "120", imageRaw: "ImageID(#ImgOpen)", imageId: "#ImgOpen" }] }],
  };

  const usages = collectFormImageUsages(document, "#ImgOpen");
  assert.equal(countFormImageUsages(document, "#ImgOpen"), 5);
  assert.deepEqual(usages.map(usage => usage.select.kind), [
    "gadget",
    "gadget",
    "menuEntry",
    "toolBarEntry",
    "statusBarField",
  ]);
});
