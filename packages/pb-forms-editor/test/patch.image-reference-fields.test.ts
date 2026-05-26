import test from "node:test";
import assert from "node:assert/strict";
import type { TextDocument, WorkspaceEdit } from "vscode";

import {
  applyGadgetOpenArgsUpdate,
  applyImageCleanupAfterSingleLineReferenceDelete,
  applyImageInsertAndReferenceUpdate,
  applyImageReferenceUpdateWithCleanup,
  applyMenuEntryDelete,
  applyMenuEntryUpdate,
  applyStatusBarFieldDeleteWithImageCleanup,
  applyStatusBarFieldUpdate,
  applyToolBarEntryDelete,
  applyToolBarEntryUpdate,
} from "../src/core/emitter/patch-emitter";
import { GADGET_KIND, MENU_ENTRY_KIND, TOOLBAR_ENTRY_KIND } from "../src/core/model";
import { parseFormDocument } from "../src/core/parser/form-parser";
import { applyWorkspaceEditToText } from "./helpers/applyWorkspaceEdit";
import { FakeTextDocument } from "./helpers/fakeTextDocument";

function patchAndReparse(
  text: string,
  editFactory: (document: TextDocument) => WorkspaceEdit | undefined
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


test("patches menu item icon references directly and upgrades menu creation mode", () => {
  const text = buildReferenceFixture().replace(
    '  CreateToolBar(0, WindowID(#FrmMain))',
    '  CreateMenu(0, WindowID(#FrmMain))\n  MenuTitle("File")\n  MenuItem(#TbSave, "Save")\n  CreateToolBar(0, WindowID(#FrmMain))'
  );
  const parsed = parseFormDocument(text);
  const menuItem = parsed.menus[0]?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem);
  assert.equal(typeof menuItem?.source?.line, "number", "Expected menu item source line.");

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) =>
    applyMenuEntryUpdate(document, "0", menuItem!.source!.line, {
      kind: MENU_ENTRY_KIND.MenuItem,
      idRaw: menuItem!.idRaw,
      textRaw: menuItem!.textRaw,
      iconRaw: "ImageID(#Img_FrmMain_1)",
    })
  );

  const updatedItem = updated.menus[0]?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem);
  assert.equal(updatedItem?.iconId, "#Img_FrmMain_1");
  assert.match(patchedText, /CreateImageMenu\(0, WindowID\(#FrmMain\)\)/);
  assert.doesNotMatch(patchedText, /CreateMenu\(0, WindowID\(#FrmMain\)\)/);
  assert.match(patchedText, /MenuItem\(#TbSave, "Save", ImageID\(#Img_FrmMain_1\)\)/);
  assert.match(patchedText, /LoadImage\(#Img_FrmMain_1,"new\.png"\)/);
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

function buildCreateAssignCleanupFixture(): string {
  return `; Form Designer for PureBasic - 6.40

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormImage
  #Img_FrmMain_0
  #Img_FrmMain_1
EndEnumeration

Enumeration FormMenu
  #TbOpen
EndEnumeration

LoadImage(#Img_FrmMain_0,"old.png")
LoadImage(#Img_FrmMain_1,"shared.png")

Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 200)
  OpenWindow(#FrmMain, x, y, width, height, "Images")
  CreateToolBar(0, WindowID(#FrmMain))
  ToolBarImageButton(#TbOpen, ImageID(#Img_FrmMain_0))
  CreateStatusBar(0, WindowID(#FrmMain))
  AddStatusBarField(100)
  StatusBarImage(0, 0, ImageID(#Img_FrmMain_1))
EndProcedure
`;
}

test("creates and assigns toolbar images with cleanup as one non-overlapping image mutation", () => {
  const text = buildCreateAssignCleanupFixture();
  const parsed = parseFormDocument(text);
  const toolBarEntry = parsed.toolbars[0]?.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton);
  const oldImage = parsed.images.find((entry) => entry.id === "#Img_FrmMain_0");
  assert.equal(typeof toolBarEntry?.source?.line, "number", "Expected toolbar entry source line.");
  assert.equal(typeof oldImage?.source?.line, "number", "Expected old image source line.");

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) =>
    applyImageInsertAndReferenceUpdate(
      document,
      { inline: false, idRaw: "#Img_FrmMain_2", imageRaw: '"new.png"' },
      imageRef => applyToolBarEntryUpdate(document, "0", toolBarEntry!.source!.line, {
        kind: TOOLBAR_ENTRY_KIND.ToolBarImageButton,
        idRaw: toolBarEntry!.idRaw,
        iconRaw: imageRef,
        toggle: toolBarEntry!.toggle,
      }),
      oldImage!.source!.line
    )
  );

  assert.deepEqual(updated.images.map((entry) => entry.id), ["#Img_FrmMain_0", "#Img_FrmMain_1"]);
  assert.equal(updated.images[0]?.imageRaw, '"shared.png"');
  assert.equal(updated.images[1]?.imageRaw, '"new.png"');
  assert.equal(updated.toolbars[0]?.entries[0]?.iconId, "#Img_FrmMain_1");
  assert.equal(updated.statusbars[0]?.fields[0]?.imageId, "#Img_FrmMain_0");
  assert.doesNotMatch(patchedText, /old\.png/);
  assert.match(patchedText, /ToolBarImageButton\(#TbOpen, ImageID\(#Img_FrmMain_1\)\)/);
  assert.match(patchedText, /StatusBarImage\(0, 0, ImageID\(#Img_FrmMain_0\)\)/);
});

test("creates and assigns statusbar images with cleanup as one non-overlapping image mutation", () => {
  const text = buildCreateAssignCleanupFixture();
  const parsed = parseFormDocument(text);
  const statusField = parsed.statusbars[0]?.fields.find((field) => field.imageId === "#Img_FrmMain_1");
  const oldImage = parsed.images.find((entry) => entry.id === "#Img_FrmMain_1");
  assert.equal(typeof statusField?.source?.line, "number", "Expected statusbar image source line.");
  assert.equal(typeof oldImage?.source?.line, "number", "Expected old image source line.");

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) =>
    applyImageInsertAndReferenceUpdate(
      document,
      { inline: false, idRaw: "#Img_FrmMain_2", imageRaw: '"new.png"' },
      imageRef => applyStatusBarFieldUpdate(document, "0", statusField!.source!.line, {
        widthRaw: statusField!.widthRaw,
        imageRaw: imageRef,
      }),
      oldImage!.source!.line
    )
  );

  assert.deepEqual(updated.images.map((entry) => entry.id), ["#Img_FrmMain_0", "#Img_FrmMain_1"]);
  assert.equal(updated.images[0]?.imageRaw, '"old.png"');
  assert.equal(updated.images[1]?.imageRaw, '"new.png"');
  assert.equal(updated.toolbars[0]?.entries[0]?.iconId, "#Img_FrmMain_0");
  assert.equal(updated.statusbars[0]?.fields[0]?.imageId, "#Img_FrmMain_1");
  assert.doesNotMatch(patchedText, /shared\.png/);
  assert.match(patchedText, /ToolBarImageButton\(#TbOpen, ImageID\(#Img_FrmMain_0\)\)/);
  assert.match(patchedText, /StatusBarImage\(0, 0, ImageID\(#Img_FrmMain_1\)\)/);
});



test("rebinds toolbar image references with cleanup as one reindexed image mutation", () => {
  const text = buildCreateAssignCleanupFixture();
  const parsed = parseFormDocument(text);
  const toolBarEntry = parsed.toolbars[0]?.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton);
  const oldImage = parsed.images.find((entry) => entry.id === "#Img_FrmMain_0");
  assert.equal(typeof toolBarEntry?.source?.line, "number", "Expected toolbar entry source line.");
  assert.equal(typeof oldImage?.source?.line, "number", "Expected old image source line.");

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) =>
    applyImageReferenceUpdateWithCleanup(
      document,
      "ImageID(#Img_FrmMain_1)",
      imageRef => applyToolBarEntryUpdate(document, "0", toolBarEntry!.source!.line, {
        kind: TOOLBAR_ENTRY_KIND.ToolBarImageButton,
        idRaw: toolBarEntry!.idRaw,
        iconRaw: imageRef,
        toggle: toolBarEntry!.toggle,
      }),
      oldImage!.source!.line
    )
  );

  assert.deepEqual(updated.images.map((entry) => entry.id), ["#Img_FrmMain_0"]);
  assert.equal(updated.images[0]?.imageRaw, '"shared.png"');
  assert.equal(updated.toolbars[0]?.entries[0]?.iconId, "#Img_FrmMain_0");
  assert.equal(updated.statusbars[0]?.fields[0]?.imageId, "#Img_FrmMain_0");
  assert.doesNotMatch(patchedText, /old\.png/);
  assert.doesNotMatch(patchedText, /ImageID\(#Img_FrmMain_1\)/);
  assert.match(patchedText, /ToolBarImageButton\(#TbOpen, ImageID\(#Img_FrmMain_0\)\)/);
  assert.match(patchedText, /StatusBarImage\(0, 0, ImageID\(#Img_FrmMain_0\)\)/);
});

test("rebinds statusbar image references with cleanup as one reindexed image mutation", () => {
  const text = buildCreateAssignCleanupFixture().replace(
    "ToolBarImageButton(#TbOpen, ImageID(#Img_FrmMain_0))",
    "ToolBarImageButton(#TbOpen, ImageID(#Img_FrmMain_1))"
  ).replace(
    "StatusBarImage(0, 0, ImageID(#Img_FrmMain_1))",
    "StatusBarImage(0, 0, ImageID(#Img_FrmMain_0))"
  );
  const parsed = parseFormDocument(text);
  const statusField = parsed.statusbars[0]?.fields.find((field) => field.imageId === "#Img_FrmMain_0");
  const oldImage = parsed.images.find((entry) => entry.id === "#Img_FrmMain_0");
  assert.equal(typeof statusField?.source?.line, "number", "Expected statusbar image source line.");
  assert.equal(typeof oldImage?.source?.line, "number", "Expected old image source line.");

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) =>
    applyImageReferenceUpdateWithCleanup(
      document,
      "ImageID(#Img_FrmMain_1)",
      imageRef => applyStatusBarFieldUpdate(document, "0", statusField!.source!.line, {
        widthRaw: statusField!.widthRaw,
        imageRaw: imageRef,
      }),
      oldImage!.source!.line
    )
  );

  assert.deepEqual(updated.images.map((entry) => entry.id), ["#Img_FrmMain_0"]);
  assert.equal(updated.images[0]?.imageRaw, '"shared.png"');
  assert.equal(updated.toolbars[0]?.entries[0]?.iconId, "#Img_FrmMain_0");
  assert.equal(updated.statusbars[0]?.fields[0]?.imageId, "#Img_FrmMain_0");
  assert.doesNotMatch(patchedText, /old\.png/);
  assert.doesNotMatch(patchedText, /ImageID\(#Img_FrmMain_1\)/);
  assert.match(patchedText, /ToolBarImageButton\(#TbOpen, ImageID\(#Img_FrmMain_0\)\)/);
  assert.match(patchedText, /StatusBarImage\(0, 0, ImageID\(#Img_FrmMain_0\)\)/);
});

function buildMenuImageCleanupFixture(): string {
  return `; Form Designer for PureBasic - 6.40

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormImage
  #Img_FrmMain_0
  #Img_FrmMain_1
EndEnumeration

Enumeration FormMenu
  #MenuOpen
EndEnumeration

Enumeration FormToolBar
  #TbShared
EndEnumeration

LoadImage(#Img_FrmMain_0,"old.png")
LoadImage(#Img_FrmMain_1,"shared.png")

Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 200)
  OpenWindow(#FrmMain, x, y, width, height, "Images")
  CreateImageMenu(0, WindowID(#FrmMain))
  MenuTitle("File")
  MenuItem(#MenuOpen, "Open", ImageID(#Img_FrmMain_0))
  CreateToolBar(0, WindowID(#FrmMain))
  ToolBarImageButton(#TbShared, ImageID(#Img_FrmMain_1))
  CreateStatusBar(0, WindowID(#FrmMain))
  AddStatusBarField(100)
  StatusBarImage(0, 0, ImageID(#Img_FrmMain_1))
EndProcedure
`;
}

test("creates and assigns menu images with cleanup as one reindexed image mutation", () => {
  const text = buildMenuImageCleanupFixture();
  const parsed = parseFormDocument(text);
  const menuItem = parsed.menus[0]?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem);
  const oldImage = parsed.images.find((entry) => entry.id === "#Img_FrmMain_0");
  assert.equal(typeof menuItem?.source?.line, "number", "Expected menu item source line.");
  assert.equal(typeof oldImage?.source?.line, "number", "Expected old image source line.");

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) =>
    applyImageInsertAndReferenceUpdate(
      document,
      { inline: false, idRaw: "#Img_FrmMain_2", imageRaw: '"new.png"' },
      imageRef => applyMenuEntryUpdate(document, "0", menuItem!.source!.line, {
        kind: MENU_ENTRY_KIND.MenuItem,
        idRaw: menuItem!.idRaw,
        textRaw: menuItem!.textRaw,
        shortcut: menuItem!.shortcut,
        iconRaw: imageRef,
      }),
      oldImage!.source!.line
    )
  );

  const updatedItem = updated.menus[0]?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem);
  assert.deepEqual(updated.images.map((entry) => entry.id), ["#Img_FrmMain_0", "#Img_FrmMain_1"]);
  assert.equal(updated.images[0]?.imageRaw, '"shared.png"');
  assert.equal(updated.images[1]?.imageRaw, '"new.png"');
  assert.equal(updatedItem?.iconId, "#Img_FrmMain_1");
  assert.equal(updated.toolbars[0]?.entries[0]?.iconId, "#Img_FrmMain_0");
  assert.equal(updated.statusbars[0]?.fields[0]?.imageId, "#Img_FrmMain_0");
  assert.doesNotMatch(patchedText, /old\.png/);
  assert.match(patchedText, /CreateImageMenu\(0, WindowID\(#FrmMain\)\)/);
  assert.match(patchedText, /MenuItem\(#MenuOpen, "Open", ImageID\(#Img_FrmMain_1\)\)/);
  assert.match(patchedText, /ToolBarImageButton\(#TbShared, ImageID\(#Img_FrmMain_0\)\)/);
  assert.match(patchedText, /StatusBarImage\(0, 0, ImageID\(#Img_FrmMain_0\)\)/);
});

test("rebinds menu image references with cleanup as one reindexed image mutation", () => {
  const text = buildMenuImageCleanupFixture();
  const parsed = parseFormDocument(text);
  const menuItem = parsed.menus[0]?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem);
  const oldImage = parsed.images.find((entry) => entry.id === "#Img_FrmMain_0");
  assert.equal(typeof menuItem?.source?.line, "number", "Expected menu item source line.");
  assert.equal(typeof oldImage?.source?.line, "number", "Expected old image source line.");

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) =>
    applyImageReferenceUpdateWithCleanup(
      document,
      "ImageID(#Img_FrmMain_1)",
      imageRef => applyMenuEntryUpdate(document, "0", menuItem!.source!.line, {
        kind: MENU_ENTRY_KIND.MenuItem,
        idRaw: menuItem!.idRaw,
        textRaw: menuItem!.textRaw,
        shortcut: menuItem!.shortcut,
        iconRaw: imageRef,
      }),
      oldImage!.source!.line
    )
  );

  const updatedItem = updated.menus[0]?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem);
  assert.deepEqual(updated.images.map((entry) => entry.id), ["#Img_FrmMain_0"]);
  assert.equal(updated.images[0]?.imageRaw, '"shared.png"');
  assert.equal(updatedItem?.iconId, "#Img_FrmMain_0");
  assert.equal(updated.toolbars[0]?.entries[0]?.iconId, "#Img_FrmMain_0");
  assert.equal(updated.statusbars[0]?.fields[0]?.imageId, "#Img_FrmMain_0");
  assert.doesNotMatch(patchedText, /old\.png/);
  assert.doesNotMatch(patchedText, /ImageID\(#Img_FrmMain_1\)/);
  assert.match(patchedText, /CreateImageMenu\(0, WindowID\(#FrmMain\)\)/);
  assert.match(patchedText, /MenuItem\(#MenuOpen, "Open", ImageID\(#Img_FrmMain_0\)\)/);
});

function buildGadgetImageCleanupFixture(): string {
  return `; Form Designer for PureBasic - 6.40

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #BtnImage
EndEnumeration

Enumeration FormImage
  #Img_FrmMain_0
  #Img_FrmMain_1
EndEnumeration

Enumeration FormToolBar
  #TbShared
EndEnumeration

LoadImage(#Img_FrmMain_0,"old.png")
LoadImage(#Img_FrmMain_1,"shared.png")

Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 200)
  OpenWindow(#FrmMain, x, y, width, height, "Images")
  ButtonImageGadget(#BtnImage, 10, 10, 80, 24, ImageID(#Img_FrmMain_0))
  CreateToolBar(0, WindowID(#FrmMain))
  ToolBarImageButton(#TbShared, ImageID(#Img_FrmMain_1))
EndProcedure
`;
}

test("creates and assigns gadget images with cleanup as one reindexed image mutation", () => {
  const text = buildGadgetImageCleanupFixture();
  const parsed = parseFormDocument(text);
  const gadget = parsed.gadgets.find((entry) => entry.id === "#BtnImage");
  const oldImage = parsed.images.find((entry) => entry.id === "#Img_FrmMain_0");
  assert.equal(gadget?.kind, GADGET_KIND.ButtonImageGadget);
  assert.equal(typeof oldImage?.source?.line, "number", "Expected old image source line.");

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) =>
    applyImageInsertAndReferenceUpdate(
      document,
      { inline: false, idRaw: "#Img_FrmMain_2", imageRaw: '"new.png"' },
      imageRef => applyGadgetOpenArgsUpdate(document, "#BtnImage", { imageRaw: imageRef }),
      oldImage!.source!.line
    )
  );

  const updatedGadget = updated.gadgets.find((entry) => entry.id === "#BtnImage");
  assert.deepEqual(updated.images.map((entry) => entry.id), ["#Img_FrmMain_0", "#Img_FrmMain_1"]);
  assert.equal(updated.images[0]?.imageRaw, '"shared.png"');
  assert.equal(updated.images[1]?.imageRaw, '"new.png"');
  assert.equal(updatedGadget?.imageId, "#Img_FrmMain_1");
  assert.equal(updated.toolbars[0]?.entries[0]?.iconId, "#Img_FrmMain_0");
  assert.doesNotMatch(patchedText, /old\.png/);
  assert.match(patchedText, /ButtonImageGadget\(#BtnImage, 10, 10, 80, 24, ImageID\(#Img_FrmMain_1\)\)/);
  assert.match(patchedText, /ToolBarImageButton\(#TbShared, ImageID\(#Img_FrmMain_0\)\)/);
});

test("rebinds gadget image references with cleanup as one reindexed image mutation", () => {
  const text = buildGadgetImageCleanupFixture();
  const parsed = parseFormDocument(text);
  const gadget = parsed.gadgets.find((entry) => entry.id === "#BtnImage");
  const oldImage = parsed.images.find((entry) => entry.id === "#Img_FrmMain_0");
  assert.equal(gadget?.kind, GADGET_KIND.ButtonImageGadget);
  assert.equal(typeof oldImage?.source?.line, "number", "Expected old image source line.");

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) =>
    applyImageReferenceUpdateWithCleanup(
      document,
      "ImageID(#Img_FrmMain_1)",
      imageRef => applyGadgetOpenArgsUpdate(document, "#BtnImage", { imageRaw: imageRef }),
      oldImage!.source!.line
    )
  );

  const updatedGadget = updated.gadgets.find((entry) => entry.id === "#BtnImage");
  assert.deepEqual(updated.images.map((entry) => entry.id), ["#Img_FrmMain_0"]);
  assert.equal(updated.images[0]?.imageRaw, '"shared.png"');
  assert.equal(updatedGadget?.imageId, "#Img_FrmMain_0");
  assert.equal(updated.toolbars[0]?.entries[0]?.iconId, "#Img_FrmMain_0");
  assert.doesNotMatch(patchedText, /old\.png/);
  assert.doesNotMatch(patchedText, /ImageID\(#Img_FrmMain_1\)/);
  assert.match(patchedText, /ButtonImageGadget\(#BtnImage, 10, 10, 80, 24, ImageID\(#Img_FrmMain_0\)\)/);
  assert.match(patchedText, /ToolBarImageButton\(#TbShared, ImageID\(#Img_FrmMain_0\)\)/);
});


function buildStatusBarDeleteCleanupFixture(): string {
  return `; Form Designer for PureBasic - 6.40

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormImage
  #Img_FrmMain_0
  #Img_FrmMain_1
EndEnumeration

Enumeration FormMenu
  #TbShared
EndEnumeration

LoadImage(#Img_FrmMain_0,"old.png")
LoadImage(#Img_FrmMain_1,"shared.png")

Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 200)
  OpenWindow(#FrmMain, x, y, width, height, "Images")
  CreateToolBar(0, WindowID(#FrmMain))
  ToolBarImageButton(#TbShared, ImageID(#Img_FrmMain_1))
  CreateStatusBar(0, WindowID(#FrmMain))
  AddStatusBarField(100)
  StatusBarImage(0, 0, ImageID(#Img_FrmMain_0))
  AddStatusBarField(100)
  StatusBarImage(0, 1, ImageID(#Img_FrmMain_1))
EndProcedure
`;
}

test("deletes statusbar image fields with cleanup as one reindexed image mutation", () => {
  const text = buildStatusBarDeleteCleanupFixture();
  const parsed = parseFormDocument(text);
  const deletedField = parsed.statusbars[0]?.fields.find((entry) => entry.imageId === "#Img_FrmMain_0");
  const oldImage = parsed.images.find((entry) => entry.id === "#Img_FrmMain_0");
  assert.equal(typeof deletedField?.source?.line, "number", "Expected deleted statusbar field source line.");
  assert.equal(typeof oldImage?.source?.line, "number", "Expected old image source line.");

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) =>
    applyStatusBarFieldDeleteWithImageCleanup(
      document,
      "0",
      deletedField!.source!.line,
      oldImage!.source!.line
    )
  );

  assert.deepEqual(updated.images.map((entry) => entry.id), ["#Img_FrmMain_0"]);
  assert.equal(updated.images[0]?.imageRaw, '"shared.png"');
  assert.equal(updated.statusbars[0]?.fields.length, 1);
  assert.equal(updated.statusbars[0]?.fields[0]?.imageId, "#Img_FrmMain_0");
  assert.equal(updated.toolbars[0]?.entries[0]?.iconId, "#Img_FrmMain_0");
  assert.doesNotMatch(patchedText, /old\.png/);
  assert.match(patchedText, /ToolBarImageButton\(#TbShared, ImageID\(#Img_FrmMain_0\)\)/);
  assert.match(patchedText, /StatusBarImage\(0, 0, ImageID\(#Img_FrmMain_0\)\)/);
  assert.doesNotMatch(patchedText, /StatusBarImage\(0, 1,/);
});


function buildSingleLineDeleteCleanupFixture(): string {
  return `; Form Designer for PureBasic - 6.40

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormImage
  #Img_FrmMain_0
  #Img_FrmMain_1
EndEnumeration

Enumeration FormMenu
  #MenuOpen
  #TbShared
EndEnumeration

LoadImage(#Img_FrmMain_0,"old.png")
LoadImage(#Img_FrmMain_1,"shared.png")

Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 200)
  OpenWindow(#FrmMain, x, y, width, height, "Images")
  CreateImageMenu(0, WindowID(#FrmMain))
  MenuTitle("File")
  MenuItem(#MenuOpen, "Open", ImageID(#Img_FrmMain_0))
  CreateToolBar(0, WindowID(#FrmMain))
  ToolBarImageButton(#TbShared, ImageID(#Img_FrmMain_1))
  CreateStatusBar(0, WindowID(#FrmMain))
  AddStatusBarField(100)
  StatusBarImage(0, 0, ImageID(#Img_FrmMain_1))
EndProcedure
`;
}

test("deletes menu entries with cleanup as one reindexed image mutation", () => {
  const text = buildSingleLineDeleteCleanupFixture();
  const parsed = parseFormDocument(text);
  const menuItem = parsed.menus[0]?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem);
  const oldImage = parsed.images.find((entry) => entry.id === "#Img_FrmMain_0");
  assert.equal(typeof menuItem?.source?.line, "number", "Expected deleted menu item source line.");
  assert.equal(typeof oldImage?.source?.line, "number", "Expected old image source line.");

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) =>
    applyImageCleanupAfterSingleLineReferenceDelete(
      document,
      oldImage!.source!.line,
      () => applyMenuEntryDelete(document, "0", menuItem!.source!.line, MENU_ENTRY_KIND.MenuItem)
    )
  );

  assert.deepEqual(updated.images.map((entry) => entry.id), ["#Img_FrmMain_0"]);
  assert.equal(updated.images[0]?.imageRaw, '"shared.png"');
  assert.equal(updated.menus[0]?.entries.some((entry) => entry.idRaw === "#MenuOpen"), false);
  assert.equal(updated.toolbars[0]?.entries[0]?.iconId, "#Img_FrmMain_0");
  assert.equal(updated.statusbars[0]?.fields[0]?.imageId, "#Img_FrmMain_0");
  assert.match(patchedText, /CreateMenu\(0, WindowID\(#FrmMain\)\)/);
  assert.doesNotMatch(patchedText, /CreateImageMenu\(0, WindowID\(#FrmMain\)\)/);
  assert.doesNotMatch(patchedText, /old\.png/);
  assert.doesNotMatch(patchedText, /MenuItem\(#MenuOpen/);
  assert.match(patchedText, /ToolBarImageButton\(#TbShared, ImageID\(#Img_FrmMain_0\)\)/);
  assert.match(patchedText, /StatusBarImage\(0, 0, ImageID\(#Img_FrmMain_0\)\)/);
});

test("deletes toolbar entries with cleanup as one reindexed image mutation", () => {
  const text = buildSingleLineDeleteCleanupFixture().replace(
    "MenuItem(#MenuOpen, \"Open\", ImageID(#Img_FrmMain_0))",
    "MenuItem(#MenuOpen, \"Open\", ImageID(#Img_FrmMain_1))"
  ).replace(
    "ToolBarImageButton(#TbShared, ImageID(#Img_FrmMain_1))",
    "ToolBarImageButton(#TbShared, ImageID(#Img_FrmMain_0))"
  );
  const parsed = parseFormDocument(text);
  const toolBarEntry = parsed.toolbars[0]?.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton);
  const oldImage = parsed.images.find((entry) => entry.id === "#Img_FrmMain_0");
  assert.equal(typeof toolBarEntry?.source?.line, "number", "Expected deleted toolbar entry source line.");
  assert.equal(typeof oldImage?.source?.line, "number", "Expected old image source line.");

  const { parsed: updated, patchedText } = patchAndReparse(text, (document) =>
    applyImageCleanupAfterSingleLineReferenceDelete(
      document,
      oldImage!.source!.line,
      () => applyToolBarEntryDelete(document, "0", toolBarEntry!.source!.line, TOOLBAR_ENTRY_KIND.ToolBarImageButton)
    )
  );

  assert.deepEqual(updated.images.map((entry) => entry.id), ["#Img_FrmMain_0"]);
  assert.equal(updated.images[0]?.imageRaw, '"shared.png"');
  assert.equal(updated.toolbars[0]?.entries.length, 0);
  assert.equal(updated.menus[0]?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem)?.iconId, "#Img_FrmMain_0");
  assert.equal(updated.statusbars[0]?.fields[0]?.imageId, "#Img_FrmMain_0");
  assert.doesNotMatch(patchedText, /old\.png/);
  assert.doesNotMatch(patchedText, /ToolBarImageButton\(#TbShared/);
  assert.match(patchedText, /MenuItem\(#MenuOpen, "Open", ImageID\(#Img_FrmMain_0\)\)/);
  assert.match(patchedText, /StatusBarImage\(0, 0, ImageID\(#Img_FrmMain_0\)\)/);
});
