import test from "node:test";
import assert from "node:assert/strict";
import type { TextDocument } from "vscode";

import { parseFormDocument } from "../src/core/parser/form-parser";
import {
  applyImageDelete,
  applyImageInsert,
  applyImageUpdate,
  type ImageArgs,
} from "../src/core/emitter/patch-emitter";
import { FakeTextDocument } from "./helpers/fakeTextDocument";
import { applyWorkspaceEditToText } from "./helpers/applyWorkspaceEdit";
import { loadFixture } from "./helpers/loadFixture";
import { stripBomAndToLf } from "./helpers/testUtils";

function patchAndReparse(
  text: string,
  editFactory: (document: TextDocument) =>
    | ReturnType<typeof applyImageInsert>
    | ReturnType<typeof applyImageUpdate>
    | ReturnType<typeof applyImageDelete>
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

test("inserts the first image block before the font block and injects the required decoder", () => {
  const text = loadFixture("fixtures/roundtrip/19-imageblock-before-font.pbf");

  const args: ImageArgs = {
    inline: false,
    idRaw: "#Img_FrmMain_0",
    imageRaw: '"logo.png"',
  };

  const { parsed, patchedText } = patchAndReparse(text, (document) => applyImageInsert(document, args));

  const image = parsed.images.find((entry) => entry.id === "#Img_FrmMain_0");
  assert.ok(image, "Expected inserted image entry.");
  assert.equal(image?.image, "logo.png");
  assert.match(
    patchedText,
    /UsePNGImageDecoder\(\)\r?\n\r?\nLoadImage\(#Img_FrmMain_0,"logo\.png"\)\r?\n\r?\nEnumeration FormFont/s
  );
  assert.doesNotMatch(
    patchedText,
    /Procedure OpenFrmMain[\s\S]*UsePNGImageDecoder\(\)/s
  );
});

test("uses the valid PB TGA decoder name instead of the original Form Designer typo", () => {
  const text = loadFixture("fixtures/roundtrip/26-imageblock-no-images-basic.pbf");

  const args: ImageArgs = {
    inline: false,
    idRaw: "#Img_FrmMain_0",
    imageRaw: '"logo.tga"',
  };

  const { patchedText } = patchAndReparse(text, document => applyImageInsert(document, args));

  assert.match(patchedText, /UseTGAImageDecoder\(\)/);
  assert.doesNotMatch(patchedText, /UseJTAImageDecoder\(\)/);
});


test("emits valid PB decoders for GIF and JPEG2000 images", () => {
  const baseText = loadFixture("fixtures/roundtrip/26-imageblock-no-images-basic.pbf");

  const { patchedText: gifText } = patchAndReparse(baseText, document => applyImageInsert(document, {
    inline: false,
    idRaw: "#Img_FrmMain_0",
    imageRaw: '"logo.gif"',
  }));

  assert.match(gifText, /UseGIFImageDecoder\(\)/);
  assert.match(gifText, /LoadImage\(#Img_FrmMain_0,"logo\.gif"\)/);

  const { patchedText: jpeg2000Text } = patchAndReparse(baseText, document => applyImageInsert(document, {
    inline: false,
    idRaw: "#Img_FrmMain_0",
    imageRaw: '"logo.jpeg2000"',
  }));

  assert.match(jpeg2000Text, /UseJPEG2000ImageDecoder\(\)/);
  assert.doesNotMatch(jpeg2000Text, /UseJPEGImageDecoder\(\)/);
  assert.match(jpeg2000Text, /LoadImage\(#Img_FrmMain_0,"logo\.jpeg2000"\)/);
});

test("uses the file extension instead of matching decoder names inside parent paths", () => {
  const baseText = loadFixture("fixtures/roundtrip/26-imageblock-no-images-basic.pbf");

  const { patchedText } = patchAndReparse(baseText, document => applyImageInsert(document, {
    inline: false,
    idRaw: "#Img_FrmMain_0",
    imageRaw: '"assets/png-icons/logo.bmp"',
  }));

  assert.ok(!patchedText.includes("UsePNGImageDecoder()"));
  assert.ok(!patchedText.includes("UseGIFImageDecoder()"));
  assert.ok(patchedText.includes('LoadImage(#Img_FrmMain_0,"assets/png-icons/logo.bmp")'));
});

test("replaces the legacy original TGA decoder typo when rebuilding an existing image block", () => {
  const text = [
    "; Form Designer for PureBasic - 6.40",
    "",
    "Enumeration FormWindow",
    "  #FrmMain",
    "EndEnumeration",
    "",
    "Enumeration FormImage",
    "  #Img_FrmMain_0",
    "EndEnumeration",
    "",
    "UseJTAImageDecoder()",
    "",
    'LoadImage(#Img_FrmMain_0,"logo.tga")',
    "",
    "Procedure OpenFrmMain(x = 0, y = 0, width = 220, height = 140)",
    '  OpenWindow(#FrmMain, x, y, width, height, "Images")',
    "EndProcedure",
    "",
  ].join("\n");

  const parsed = parseFormDocument(text);
  const sourceLine = parsed.images.find((entry) => entry.id === "#Img_FrmMain_0")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected image source line.");

  const { patchedText } = patchAndReparse(text, document => applyImageUpdate(document, sourceLine!, {
    inline: false,
    idRaw: "#Img_FrmMain_0",
    imageRaw: '"logo.png"',
  }));

  assert.match(patchedText, /UsePNGImageDecoder\(\)/);
  assert.doesNotMatch(patchedText, /UseJTAImageDecoder\(\)/);
  assert.doesNotMatch(patchedText, /UseTGAImageDecoder\(\)/);
  assert.match(patchedText, /LoadImage\(#Img_FrmMain_0,"logo\.png"\)/);
});

test("removes stale decoder lines when rebuilding with a non-decoder external extension", () => {
  const text = loadFixture("fixtures/roundtrip/20-imageblock-enum-single.pbf");

  const parsed = parseFormDocument(text);
  const sourceLine = parsed.images.find((entry) => entry.id === "#Img_FrmMain_0")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected image source line.");

  const { patchedText } = patchAndReparse(text, document => applyImageUpdate(document, sourceLine!, {
    inline: false,
    idRaw: "#Img_FrmMain_0",
    imageRaw: '"assets/png-icons/logo.bmp"',
  }));

  assert.doesNotMatch(patchedText, /UsePNGImageDecoder\(\)/);
  assert.match(patchedText, /LoadImage\(#Img_FrmMain_0,"assets\/png-icons\/logo\.bmp"\)/);
});

test("emits the TIFF decoder for .tif external image extensions", () => {
  const baseText = loadFixture("fixtures/roundtrip/26-imageblock-no-images-basic.pbf");

  const { patchedText } = patchAndReparse(baseText, document => applyImageInsert(document, {
    inline: false,
    idRaw: "#Img_FrmMain_0",
    imageRaw: '"logo.tif"',
  }));

  assert.match(patchedText, /UseTIFFImageDecoder\(\)/);
  assert.match(patchedText, /LoadImage\(#Img_FrmMain_0,"logo\.tif"\)/);
});

test("removes the decoder together with the last remaining image in the block", () => {
  const text = loadFixture("fixtures/roundtrip/20-imageblock-enum-single.pbf");

  const parsed = parseFormDocument(text);
  const sourceLine = parsed.images.find((entry) => entry.id === "#Img_FrmMain_0")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected image source line.");

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) => applyImageDelete(document, sourceLine!));

  assert.equal(updated.images.length, 0);
  assert.doesNotMatch(patchedText, /UsePNGImageDecoder\(\)/);
  assert.doesNotMatch(patchedText, /LoadImage\(#Img_FrmMain_0,"logo\.png"\)/);
  assert.match(patchedText, /Procedure OpenFrmMain\(/);
});

test("updates image metadata through the shared image-value parser for escaped literals", () => {
  const text = loadFixture("fixtures/roundtrip/20-imageblock-enum-single.pbf");

  const parsed = parseFormDocument(text);
  const sourceLine = parsed.images.find((entry) => entry.id === "#Img_FrmMain_0")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected image source line.");

  const args: ImageArgs = {
    inline: false,
    idRaw: "#Img_FrmMain_0",
    imageRaw: '~"icons/""main"".png"',
  };

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) => applyImageUpdate(document, sourceLine!, args));

  const image = updated.images.find((entry) => entry.id === "#Img_FrmMain_0");
  assert.ok(image, "Expected updated image entry.");
  assert.equal(image?.image, 'icons/"main".png');
  assert.match(patchedText, /LoadImage\(#Img_FrmMain_0,~"icons\/""main""\.png"\)/);
});

test("rebuilds the decoder lines when the image file type changes", () => {
  const text = loadFixture("fixtures/roundtrip/20-imageblock-enum-single.pbf");

  const parsed = parseFormDocument(text);
  const sourceLine = parsed.images.find((entry) => entry.id === "#Img_FrmMain_0")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected image source line.");

  const args: ImageArgs = {
    inline: false,
    idRaw: "#Img_FrmMain_0",
    imageRaw: '"logo.jpg"',
  };

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) => applyImageUpdate(document, sourceLine!, args));

  const image = updated.images.find((entry) => entry.id === "#Img_FrmMain_0");
  assert.ok(image, "Expected updated image entry.");
  assert.equal(image?.image, "logo.jpg");
  assert.match(patchedText, /UseJPEGImageDecoder\(\)/);
  assert.doesNotMatch(patchedText, /UsePNGImageDecoder\(\)/);
  assert.match(patchedText, /LoadImage\(#Img_FrmMain_0,"logo\.jpg"\)/);
});


test("creates an Enumeration FormImage block when inserting the first enum image", () => {
  const text = loadFixture("fixtures/roundtrip/21-imageblock-enum-with-menu.pbf");

  const args: ImageArgs = {
    inline: false,
    idRaw: "#Img_FrmMain_0",
    imageRaw: '"logo.png"',
  };

  const { patchedText } = patchAndReparse(text, (document) => applyImageInsert(document, args));
  const normalized = stripBomAndToLf(patchedText);

  assert.ok(normalized.includes(
    [
      'Enumeration FormMenu',
      '  #MenuItem_2',
      'EndEnumeration',
      '',
      '',
      'Enumeration FormImage',
      '  #Img_FrmMain_0',
      'EndEnumeration',
      '',
      'UsePNGImageDecoder()',
      '',
      'LoadImage(#Img_FrmMain_0,"logo.png")',
    ].join("\n")
  ));
  assert.doesNotMatch(patchedText, /^Global\s+/m);
});

test("creates a Global image variable block when inserting the first pbAny image", () => {
  const text = loadFixture("fixtures/roundtrip/26-imageblock-no-images-basic.pbf");

  const args: ImageArgs = {
    inline: false,
    idRaw: "#PB_Any",
    assignedVar: "ImgMainLogo",
    imageRaw: '"logo.png"',
  };

  const { patchedText } = patchAndReparse(text, (document) => applyImageInsert(document, args));
  const normalized = stripBomAndToLf(patchedText);

  assert.ok(normalized.includes(['Global ImgMainLogo', '', 'Enumeration FormWindow'].join("\n")));
  assert.match(patchedText, /ImgMainLogo = LoadImage\(#PB_Any,"logo\.png"\)/);
  assert.doesNotMatch(patchedText, /Enumeration FormImage/);
});

test("moves image declarations from FormImage to Global when toggling the last enum image to pbAny", () => {
  const text = loadFixture("fixtures/roundtrip/20-imageblock-enum-single.pbf");

  const parsed = parseFormDocument(text);
  const sourceLine = parsed.images.find((entry) => entry.id === "#Img_FrmMain_0")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected image source line.");

  const { patchedText } = patchAndReparse(text, (document) => applyImageUpdate(document, sourceLine!, {
    inline: false,
    idRaw: "#PB_Any",
    assignedVar: "ImgMainLogo",
    imageRaw: '"logo.png"',
  }));
  const normalized = stripBomAndToLf(patchedText);

  assert.ok(normalized.includes(['Global ImgMainLogo', '', 'Enumeration FormWindow'].join("\n")));
  assert.ok(!normalized.includes(['Enumeration FormImage', '  #Img_FrmMain_0', 'EndEnumeration'].join("\n")));
  assert.match(patchedText, /ImgMainLogo = LoadImage\(#PB_Any,"logo\.png"\)/);
});

test("moves image declarations from Global to FormImage when toggling the last pbAny image to enum mode", () => {
  const text = loadFixture("fixtures/roundtrip/22-imageblock-pbany-single.pbf");

  const parsed = parseFormDocument(text);
  const sourceLine = parsed.images.find((entry) => entry.id === "Img_FrmMain_0")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected image source line.");

  const { patchedText } = patchAndReparse(text, (document) => applyImageUpdate(document, sourceLine!, {
    inline: false,
    idRaw: "#Img_FrmMain_0",
    imageRaw: '"logo.png"',
  }));
  const normalized = stripBomAndToLf(patchedText);

  assert.ok(!/^Global Img_FrmMain_0$/m.test(patchedText));
  assert.ok(normalized.includes([
    'Global Image_0',
    '',
    'Enumeration FormWindow',
    '  #FrmMain',
    'EndEnumeration',
    '',
    'Enumeration FormImage',
    '  #Img_FrmMain_0',
    'EndEnumeration',
  ].join("\n")));
  assert.match(patchedText, /LoadImage\(#Img_FrmMain_0,"logo\.png"\)/);
});

test("inserts an enum image block before Declare boundaries", () => {
  const text = loadFixture("fixtures/roundtrip/23-imageblock-boundary-declare.pbf");

  const args: ImageArgs = {
    inline: false,
    idRaw: "#Img_FrmMain_0",
    imageRaw: '"logo.png"',
  };

  const { patchedText } = patchAndReparse(text, (document) => applyImageInsert(document, args));
  const normalized = stripBomAndToLf(patchedText);

  assert.ok(normalized.includes([
    'Enumeration FormImage',
    '  #Img_FrmMain_0',
    'EndEnumeration',
    '',
    'UsePNGImageDecoder()',
    '',
    'LoadImage(#Img_FrmMain_0,"logo.png")',
    '',
    'Declare ResizeGadgetsFrmMain()',
  ].join("\n")));
});


test("inserts an Enumeration FormImage block before custom gadget initialisation", () => {
  const text = loadFixture("fixtures/roundtrip/24-imageblock-custom-gadget-base.pbf");

  const args: ImageArgs = {
    inline: false,
    idRaw: "#Img_FrmMain_0",
    imageRaw: '"logo.png"',
  };

  const { patchedText } = patchAndReparse(text, (document) => applyImageInsert(document, args));
  const normalized = stripBomAndToLf(patchedText);

  assert.ok(normalized.includes([
    'Enumeration FormImage',
    '  #Img_FrmMain_0',
    'EndEnumeration',
    '',
    '; 0 Custom gadget initialisation (do Not remove this line)',
    'InitMyCustomGadget()',
  ].join("\n")));
  assert.ok(normalized.includes([
    'InitMyCustomGadget()',
    '',
    '',
    'UsePNGImageDecoder()',
    '',
    'LoadImage(#Img_FrmMain_0,"logo.png")',
    '',
    'Procedure OpenFrmMain(',
  ].join("\n")));
});


test("moves FormImage before custom gadget initialisation when toggling the last pbAny image to enum mode", () => {
  const text = loadFixture("fixtures/roundtrip/25-imageblock-custom-gadget-pbany-single.pbf");

  const parsed = parseFormDocument(text);
  const sourceLine = parsed.images.find((entry) => entry.id === "Img_FrmMain_0")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected pbAny image line.");

  const { patchedText } = patchAndReparse(text, (document) => applyImageUpdate(document, sourceLine!, {
    inline: false,
    idRaw: '#Img_FrmMain_0',
    imageRaw: '"logo.png"',
  }));
  const normalized = stripBomAndToLf(patchedText);

  assert.ok(normalized.includes([
    'Enumeration FormImage',
    '  #Img_FrmMain_0',
    'EndEnumeration',
    '',
    '; 0 Custom gadget initialisation (do Not remove this line)',
    'InitMyCustomGadget()',
  ].join("\n")));
  assert.doesNotMatch(patchedText, /^Global\s+Img_FrmMain_0\s*$/m);
  assert.match(patchedText, /LoadImage\(#Img_FrmMain_0,"logo\.png"\)/);
});


test("inserts a pbAny image Global block before custom gadget initialisation", () => {
  const text = loadFixture("fixtures/roundtrip/27-imageblock-custom-gadget-window-assignment.pbf");

  const args: ImageArgs = {
    inline: false,
    idRaw: "#PB_Any",
    assignedVar: "ImgMainLogo",
    imageRaw: '"logo.png"',
  };

  const { patchedText } = patchAndReparse(text, (document) => applyImageInsert(document, args));
  const normalized = stripBomAndToLf(patchedText);

  assert.ok(normalized.includes([
    'Global win',
    '',
    'Global Custom_0',
    '',
    'Global ImgMainLogo',
    '',
    '; 0 Custom gadget initialisation (do Not remove this line)',
    'InitMyCustomGadget()',
  ].join("\n")));
  assert.ok(normalized.includes([
    'ImgMainLogo = LoadImage(#PB_Any,"logo.png")',
    '',
    'Procedure Openwin(',
  ].join("\n")));
  assert.doesNotMatch(patchedText, /XIncludeFile\s+"events\/form-main\.pbi"/);
});

test("inserts a pbAny image Global block before Declare boundaries", () => {
  const text = loadFixture("fixtures/roundtrip/23-imageblock-boundary-declare.pbf");

  const args: ImageArgs = {
    inline: false,
    idRaw: "#PB_Any",
    assignedVar: "ImgMainLogo",
    imageRaw: '"logo.png"',
  };

  const { patchedText } = patchAndReparse(text, (document) => applyImageInsert(document, args));
  const normalized = stripBomAndToLf(patchedText);

  assert.ok(normalized.includes([
    'Global ImgMainLogo',
    '',
    'Enumeration FormWindow',
  ].join("\n")));
  assert.ok(normalized.includes([
    'ImgMainLogo = LoadImage(#PB_Any,"logo.png")',
    '',
    'Declare ResizeGadgetsFrmMain()',
  ].join("\n")));
});

test("keeps a single blank line before FormFont when updating an existing image block", () => {
  const text = loadFixture("fixtures/roundtrip/28-imageblock-enum-before-font-single.pbf");

  const parsed = parseFormDocument(text);
  const sourceLine = parsed.images.find((entry) => entry.id === "#Img_FrmMain_0")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected image source line.");

  const { patchedText } = patchAndReparse(text, (document) => applyImageUpdate(document, sourceLine!, {
    inline: false,
    idRaw: "#Img_FrmMain_0",
    imageRaw: '"logo.jpg"',
  }));

  const normalized = stripBomAndToLf(patchedText);
  assert.ok(normalized.includes([
    'LoadImage(#Img_FrmMain_0,"logo.jpg")',
    '',
    'Enumeration FormFont',
  ].join("\n")));
  assert.ok(!normalized.includes([
    'LoadImage(#Img_FrmMain_0,"logo.jpg")',
    '',
    '',
    'Enumeration FormFont',
  ].join("\n")));
});

test("keeps a single blank line before FormFont when deleting the last image block", () => {
  const text = loadFixture("fixtures/roundtrip/28-imageblock-enum-before-font-single.pbf");

  const parsed = parseFormDocument(text);
  const sourceLine = parsed.images.find((entry) => entry.id === "#Img_FrmMain_0")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected image source line.");

  const { patchedText } = patchAndReparse(text, (document) => applyImageDelete(document, sourceLine!));

  const normalized = stripBomAndToLf(patchedText);
  assert.ok(normalized.includes([
    'EndEnumeration',
    '',
    'Enumeration FormFont',
  ].join("\n")));
  assert.ok(!normalized.includes([
    'EndEnumeration',
    '',
    '',
    'Enumeration FormFont',
  ].join("\n")));
});

test("re-indexes remaining image references when deleting an unused earlier image", () => {
  const text = `; Form Designer for PureBasic - 6.40

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #ImgView
EndEnumeration

Enumeration FormMenu
  #MenuSave
  #TbSave
EndEnumeration

Enumeration FormImage
  #Img_FrmMain_0
  #Img_FrmMain_1
EndEnumeration

UsePNGImageDecoder()

LoadImage(#Img_FrmMain_0,"unused.png")
LoadImage(#Img_FrmMain_1,"used.png")

Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 200)
  OpenWindow(#FrmMain, x, y, width, height, "Images")
  ImageGadget(#ImgView, 10, 10, 64, 64, ImageID(#Img_FrmMain_1))
  CreateImageMenu(0, WindowID(#FrmMain))
  MenuItem(#MenuSave, "Save", ImageID(#Img_FrmMain_1))
  CreateToolBar(0, WindowID(#FrmMain))
  ToolBarImageButton(#TbSave, ImageID(#Img_FrmMain_1))
  CreateStatusBar(0, WindowID(#FrmMain))
  AddStatusBarField(100)
  StatusBarImage(0, 0, ImageID(#Img_FrmMain_1))
EndProcedure
`;

  const parsed = parseFormDocument(text);
  const sourceLine = parsed.images.find((entry) => entry.id === "#Img_FrmMain_0")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected unused image source line.");

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) => applyImageDelete(document, sourceLine!));

  assert.equal(updated.images.length, 1);
  assert.equal(updated.images[0]?.id, "#Img_FrmMain_0");
  assert.equal(updated.images[0]?.imageRaw, '"used.png"');
  assert.match(patchedText, /LoadImage\(#Img_FrmMain_0,"used\.png"\)/);
  assert.doesNotMatch(patchedText, /#Img_FrmMain_1/);
  assert.match(patchedText, /ImageGadget\(#ImgView, 10, 10, 64, 64, ImageID\(#Img_FrmMain_0\)\)/);
  assert.match(patchedText, /MenuItem\(#MenuSave, "Save", ImageID\(#Img_FrmMain_0\)\)/);
  assert.match(patchedText, /ToolBarImageButton\(#TbSave, ImageID\(#Img_FrmMain_0\)\)/);
  assert.match(patchedText, /StatusBarImage\(0, 0, ImageID\(#Img_FrmMain_0\)\)/);
});

test("updates existing image references when toggling a pbAny image back to enum mode", () => {
  const text = `; Form Designer for PureBasic - 6.40

Global Img_FrmMain_0

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #BtnImage
  #ImgView
EndEnumeration

Enumeration FormMenu
  #MenuSave
  #TbSave
EndEnumeration

Img_FrmMain_0 = LoadImage(#PB_Any,"used.png")

Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 200)
  OpenWindow(#FrmMain, x, y, width, height, "Images")
  ButtonImageGadget(#BtnImage, 10, 10, 80, 24, ImageID(Img_FrmMain_0))
  ImageGadget(#ImgView, 10, 40, 64, 64, ImageID(Img_FrmMain_0))
  CreateImageMenu(0, WindowID(#FrmMain))
  MenuItem(#MenuSave, "Save", ImageID(Img_FrmMain_0))
  CreateToolBar(0, WindowID(#FrmMain))
  ToolBarImageButton(#TbSave, ImageID(Img_FrmMain_0))
  CreateStatusBar(0, WindowID(#FrmMain))
  AddStatusBarField(100)
  StatusBarImage(0, 0, ImageID(Img_FrmMain_0))
EndProcedure
`;

  const parsed = parseFormDocument(text);
  const sourceLine = parsed.images.find((entry) => entry.id === "Img_FrmMain_0")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected pbAny image source line.");

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) => applyImageUpdate(document, sourceLine!, {
    inline: false,
    idRaw: "#Img_FrmMain_0",
    imageRaw: '"used.png"',
  }));

  assert.equal(updated.images[0]?.id, "#Img_FrmMain_0");
  assert.match(patchedText, /Enumeration FormImage\r?\n  #Img_FrmMain_0\r?\nEndEnumeration/);
  assert.match(patchedText, /LoadImage\(#Img_FrmMain_0,"used\.png"\)/);
  assert.doesNotMatch(patchedText, /^Global Img_FrmMain_0$/m);
  assert.doesNotMatch(patchedText, /ImageID\(Img_FrmMain_0\)/);
  assert.match(patchedText, /ButtonImageGadget\(#BtnImage, 10, 10, 80, 24, ImageID\(#Img_FrmMain_0\)\)/);
  assert.match(patchedText, /ImageGadget\(#ImgView, 10, 40, 64, 64, ImageID\(#Img_FrmMain_0\)\)/);
  assert.match(patchedText, /MenuItem\(#MenuSave, "Save", ImageID\(#Img_FrmMain_0\)\)/);
  assert.match(patchedText, /ToolBarImageButton\(#TbSave, ImageID\(#Img_FrmMain_0\)\)/);
  assert.match(patchedText, /StatusBarImage\(0, 0, ImageID\(#Img_FrmMain_0\)\)/);
});

test("re-indexes image references when toggling an enum image to pbAny mode", () => {
  const text = `; Form Designer for PureBasic - 6.40

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #ImgFirst
  #ImgSecond
EndEnumeration

Enumeration FormMenu
  #MenuFirst
  #MenuSecond
  #TbFirst
  #TbSecond
EndEnumeration

Enumeration FormImage
  #Img_FrmMain_0
  #Img_FrmMain_1
EndEnumeration

UsePNGImageDecoder()

LoadImage(#Img_FrmMain_0,"first.png")
LoadImage(#Img_FrmMain_1,"second.png")

Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 200)
  OpenWindow(#FrmMain, x, y, width, height, "Images")
  ImageGadget(#ImgFirst, 10, 10, 64, 64, ImageID(#Img_FrmMain_0))
  ImageGadget(#ImgSecond, 80, 10, 64, 64, ImageID(#Img_FrmMain_1))
  CreateImageMenu(0, WindowID(#FrmMain))
  MenuItem(#MenuFirst, "First", ImageID(#Img_FrmMain_0))
  MenuItem(#MenuSecond, "Second", ImageID(#Img_FrmMain_1))
  CreateToolBar(0, WindowID(#FrmMain))
  ToolBarImageButton(#TbFirst, ImageID(#Img_FrmMain_0))
  ToolBarImageButton(#TbSecond, ImageID(#Img_FrmMain_1))
  CreateStatusBar(0, WindowID(#FrmMain))
  AddStatusBarField(100)
  StatusBarImage(0, 0, ImageID(#Img_FrmMain_1))
EndProcedure
`;

  const parsed = parseFormDocument(text);
  const sourceLine = parsed.images.find((entry) => entry.id === "#Img_FrmMain_0")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected first enum image source line.");

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) => applyImageUpdate(document, sourceLine!, {
    inline: false,
    idRaw: "#PB_Any",
    assignedVar: "Img_FrmMain_1",
    imageRaw: '"first.png"',
    pbAny: true,
  }));

  assert.equal(updated.images.length, 2);
  assert.equal(updated.images[0]?.id, "#Img_FrmMain_0");
  assert.equal(updated.images[0]?.imageRaw, '"second.png"');
  assert.equal(updated.images[1]?.id, "Img_FrmMain_1");
  assert.equal(updated.images[1]?.pbAny, true);
  assert.match(patchedText, /^Global Img_FrmMain_1$/m);
  assert.match(patchedText, /Enumeration FormImage\r?\n  #Img_FrmMain_0\r?\nEndEnumeration/);
  assert.match(patchedText, /LoadImage\(#Img_FrmMain_0,"second\.png"\)/);
  assert.match(patchedText, /Img_FrmMain_1 = LoadImage\(#PB_Any,"first\.png"\)/);
  assert.match(patchedText, /ImageGadget\(#ImgFirst, 10, 10, 64, 64, ImageID\(Img_FrmMain_1\)\)/);
  assert.match(patchedText, /ImageGadget\(#ImgSecond, 80, 10, 64, 64, ImageID\(#Img_FrmMain_0\)\)/);
  assert.match(patchedText, /MenuItem\(#MenuFirst, "First", ImageID\(Img_FrmMain_1\)\)/);
  assert.match(patchedText, /MenuItem\(#MenuSecond, "Second", ImageID\(#Img_FrmMain_0\)\)/);
  assert.match(patchedText, /ToolBarImageButton\(#TbFirst, ImageID\(Img_FrmMain_1\)\)/);
  assert.match(patchedText, /ToolBarImageButton\(#TbSecond, ImageID\(#Img_FrmMain_0\)\)/);
  assert.match(patchedText, /StatusBarImage\(0, 0, ImageID\(#Img_FrmMain_0\)\)/);
});

test("preserves CatchImage mode when toggling an enum image to pbAny mode", () => {
  const text = `; Form Designer for PureBasic - 6.40

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #ImgView
EndEnumeration

Enumeration FormImage
  #Img_FrmMain_0
EndEnumeration

CatchImage(#Img_FrmMain_0,?Img_FrmMain_0)

Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 200)
  OpenWindow(#FrmMain, x, y, width, height, "Images")
  ImageGadget(#ImgView, 10, 10, 64, 64, ImageID(#Img_FrmMain_0))
EndProcedure

DataSection
  Img_FrmMain_0:
EndDataSection
`;

  const parsed = parseFormDocument(text);
  const sourceLine = parsed.images.find((entry) => entry.id === "#Img_FrmMain_0")?.source?.line;
  assert.equal(typeof sourceLine, "number", "Expected enum image source line.");

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) => applyImageUpdate(document, sourceLine!, {
    inline: true,
    idRaw: "#PB_Any",
    assignedVar: "Img_FrmMain_0",
    imageRaw: "?Img_FrmMain_0",
    pbAny: true,
  }));

  assert.equal(updated.images[0]?.id, "Img_FrmMain_0");
  assert.equal(updated.images[0]?.inline, true);
  assert.equal(updated.images[0]?.image, "Img_FrmMain_0");
  assert.match(patchedText, /^Global Img_FrmMain_0$/m);
  assert.doesNotMatch(patchedText, /LoadImage\(/);
  assert.match(patchedText, /Img_FrmMain_0 = CatchImage\(#PB_Any,\?Img_FrmMain_0\)/);
  assert.match(patchedText, /ImageGadget\(#ImgView, 10, 10, 64, 64, ImageID\(Img_FrmMain_0\)\)/);
});
