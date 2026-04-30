import test from "node:test";
import assert from "node:assert/strict";
import type { TextDocument } from "vscode";

import {
  applyGadgetOpenArgsUpdate,
  applyStatusBarFieldUpdate,
  applyToolBarEntryUpdate,
} from "../src/core/emitter/patch-emitter";
import { GADGET_KIND, TOOLBAR_ENTRY_KIND } from "../src/core/model";
import { parseFormDocument } from "../src/core/parser/form-parser";
import { applyWorkspaceEditToText } from "./helpers/applyWorkspaceEdit";
import { FakeTextDocument } from "./helpers/fakeTextDocument";

function patchAndReparse(
  text: string,
  editFactory: (document: TextDocument) =>
    | ReturnType<typeof applyGadgetOpenArgsUpdate>
    | ReturnType<typeof applyToolBarEntryUpdate>
    | ReturnType<typeof applyStatusBarFieldUpdate>
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

function buildReferenceFixture(): string {
  return `; Form Designer for PureBasic - 6.40

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #BtnImage
  #ImgPreview
EndEnumeration

Enumeration FormImage
  #Img_FrmMain_0
  #Img_FrmMain_1
EndEnumeration

Enumeration FormMenu
  #TbSave
EndEnumeration

LoadImage(#Img_FrmMain_0,"old.png")
LoadImage(#Img_FrmMain_1,"new.png")

Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 200)
  OpenWindow(#FrmMain, x, y, width, height, "Images")
  ButtonImageGadget(#BtnImage, 10, 10, 80, 24, ImageID(#Img_FrmMain_0))
  ImageGadget(#ImgPreview, 10, 40, 64, 64, ImageID(#Img_FrmMain_0))
  CreateToolBar(0, WindowID(#FrmMain))
  ToolBarImageButton(#TbSave, ImageID(#Img_FrmMain_0))
  CreateStatusBar(0, WindowID(#FrmMain))
  AddStatusBarField(100)
  StatusBarImage(0, 0, ImageID(#Img_FrmMain_0))
EndProcedure
`;
}

test("patches ButtonImageGadget and ImageGadget image references directly", () => {
  const text = buildReferenceFixture();

  const { parsed: afterButton, patchedText: buttonText } = patchAndReparse(text, (document) =>
    applyGadgetOpenArgsUpdate(document, "#BtnImage", { imageRaw: "ImageID(#Img_FrmMain_1)" })
  );
  const button = afterButton.gadgets.find((entry) => entry.id === "#BtnImage");

  assert.equal(button?.kind, GADGET_KIND.ButtonImageGadget);
  assert.equal(button?.imageId, "#Img_FrmMain_1");
  assert.match(buttonText, /ButtonImageGadget\(#BtnImage, 10, 10, 80, 24, ImageID\(#Img_FrmMain_1\)\)/);
  assert.match(buttonText, /LoadImage\(#Img_FrmMain_1,"new\.png"\)/);

  const { parsed: afterImage, patchedText: imageText } = patchAndReparse(buttonText, (document) =>
    applyGadgetOpenArgsUpdate(document, "#ImgPreview", { imageRaw: "ImageID(#Img_FrmMain_1)" })
  );
  const imageGadget = afterImage.gadgets.find((entry) => entry.id === "#ImgPreview");

  assert.equal(imageGadget?.kind, GADGET_KIND.ImageGadget);
  assert.equal(imageGadget?.imageId, "#Img_FrmMain_1");
  assert.match(imageText, /ImageGadget\(#ImgPreview, 10, 40, 64, 64, ImageID\(#Img_FrmMain_1\)\)/);
});

test("patches toolbar image button icon references directly", () => {
  const text = buildReferenceFixture();
  const parsed = parseFormDocument(text);
  const toolBarEntry = parsed.toolbars[0]?.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton);
  assert.equal(typeof toolBarEntry?.source?.line, "number", "Expected toolbar entry source line.");

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) =>
    applyToolBarEntryUpdate(document, "0", toolBarEntry!.source!.line, {
      kind: TOOLBAR_ENTRY_KIND.ToolBarImageButton,
      idRaw: toolBarEntry!.idRaw,
      iconRaw: "ImageID(#Img_FrmMain_1)",
      toggle: toolBarEntry!.toggle,
    })
  );

  const updatedEntry = updated.toolbars[0]?.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton);
  assert.equal(updatedEntry?.iconId, "#Img_FrmMain_1");
  assert.match(patchedText, /ToolBarImageButton\(#TbSave, ImageID\(#Img_FrmMain_1\)\)/);
});

test("patches statusbar image field references directly", () => {
  const text = buildReferenceFixture();
  const parsed = parseFormDocument(text);
  const field = parsed.statusbars[0]?.fields.find((entry) => entry.imageRaw);
  assert.equal(typeof field?.source?.line, "number", "Expected statusbar image field source line.");

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) =>
    applyStatusBarFieldUpdate(document, "0", field!.source!.line, {
      widthRaw: field!.widthRaw,
      imageRaw: "ImageID(#Img_FrmMain_1)",
    })
  );

  const updatedField = updated.statusbars[0]?.fields.find((entry) => entry.imageRaw);
  assert.equal(updatedField?.imageId, "#Img_FrmMain_1");
  assert.match(patchedText, /StatusBarImage\(0, 0, ImageID\(#Img_FrmMain_1\)\)/);
});
