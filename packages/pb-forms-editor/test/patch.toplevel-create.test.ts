import test from "node:test";
import assert from "node:assert/strict";
import type { TextDocument, WorkspaceEdit } from "vscode";

import { parseFormDocument } from "../src/core/parser/form-parser";
import {
  applyMenuCreate,
  applyStatusBarCreate,
  applyToolBarCreate,
} from "../src/core/emitter/patch-emitter";
import { TOOLBAR_ENTRY_KIND } from "../src/core/model";
import { FakeTextDocument } from "./helpers/fakeTextDocument";
import { applyWorkspaceEditToText } from "./helpers/applyWorkspaceEdit";

function patch(text: string, editFactory: (document: TextDocument) => WorkspaceEdit | undefined): string {
  const document = new FakeTextDocument(text);
  const edit = editFactory(document.asTextDocument());
  assert.ok(edit, "Expected a WorkspaceEdit result.");
  return applyWorkspaceEditToText(text, edit!);
}

const BASE_FORM = `; Form Designer for PureBasic - 6.40

Enumeration FormWindow
  #FrmMain
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 220)
  OpenWindow(#FrmMain, x, y, width, height, "TopLevel")
EndProcedure
`;

test("creates a menu root with the original default MenuTitle entry", () => {
  const patchedText = patch(BASE_FORM, document => applyMenuCreate(document, { kind: "MenuTitle", textRaw: '"MenuTitle"' }));
  const parsed = parseFormDocument(patchedText);

  assert.equal(parsed.menus.length, 1);
  assert.equal(parsed.menus[0]?.id, "0");
  assert.equal(parsed.menus[0]?.entries[0]?.kind, "MenuTitle");
  assert.equal(parsed.menus[0]?.entries[0]?.text, "MenuTitle");
  assert.match(patchedText, /OpenWindow\(#FrmMain, x, y, width, height, "TopLevel"\)\r?\n\s*CreateMenu\(0, WindowID\(#FrmMain\)\)\r?\n\s*MenuTitle\("MenuTitle"\)/);
});

test("creates a toolbar root with a default image button and FormMenu enum symbol", () => {
  const patchedText = patch(BASE_FORM, document => applyToolBarCreate(document, {
    kind: TOOLBAR_ENTRY_KIND.ToolBarImageButton,
    idRaw: "#Toolbar_0",
    iconRaw: "0",
  }));
  const parsed = parseFormDocument(patchedText);

  assert.equal(parsed.toolbars.length, 1);
  assert.equal(parsed.toolbars[0]?.id, "0");
  assert.equal(parsed.toolbars[0]?.entries[0]?.idRaw, "#Toolbar_0");
  assert.match(patchedText, /Enumeration FormMenu\r?\n\s*#Toolbar_0\r?\nEndEnumeration/);
  assert.match(patchedText, /CreateToolBar\(0, WindowID\(#FrmMain\)\)\r?\n\s*ToolBarImageButton\(#Toolbar_0, 0\)/);
});

test("creates a statusbar root with a default label field", () => {
  const patchedText = patch(BASE_FORM, document => applyStatusBarCreate(document, {
    widthRaw: "50",
    textRaw: '"Label"',
  }));
  const parsed = parseFormDocument(patchedText);

  assert.equal(parsed.statusbars.length, 1);
  assert.equal(parsed.statusbars[0]?.id, "0");
  assert.equal(parsed.statusbars[0]?.fields[0]?.widthRaw, "50");
  assert.equal(parsed.statusbars[0]?.fields[0]?.text, "Label");
  assert.match(patchedText, /CreateStatusBar\(0, WindowID\(#FrmMain\)\)\r?\n\s*AddStatusBarField\(50\)\r?\n\s*StatusBarText\(0, 0, "Label"\)/);
});

test("inserts restored top-level roots before existing gadget creation", () => {
  const text = `; Form Designer for PureBasic - 6.40

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #Button_0
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 320, height = 220)
  OpenWindow(#FrmMain, x, y, width, height, "TopLevel")
  ButtonGadget(#Button_0, 10, 10, 80, 25, "Button")
EndProcedure
`;

  const patchedText = patch(text, document => applyStatusBarCreate(document, {
    widthRaw: "50",
    textRaw: '"Label"',
  }));

  assert.match(patchedText, /OpenWindow\(#FrmMain, x, y, width, height, "TopLevel"\)\r?\n\s*CreateStatusBar\(0, WindowID\(#FrmMain\)\)\r?\n\s*AddStatusBarField\(50\)\r?\n\s*StatusBarText\(0, 0, "Label"\)\r?\n\s*ButtonGadget\(#Button_0/);
});
