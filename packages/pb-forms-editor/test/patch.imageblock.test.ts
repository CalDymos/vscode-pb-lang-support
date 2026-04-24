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
