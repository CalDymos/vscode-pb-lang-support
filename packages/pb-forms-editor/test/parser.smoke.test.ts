import test from "node:test";
import assert from "node:assert/strict";

import { parseFormDocument } from "../src/core/parser/formParser";
import { GADGET_KIND, MENU_ENTRY_KIND, TOOLBAR_ENTRY_KIND } from "../src/core/model";
import { loadFixture } from "./helpers/loadFixture";

test("parses fixtures/smoke/01-window-basic.pbf", () => {
  const text = loadFixture("fixtures/smoke/01-window-basic.pbf");
  const doc = parseFormDocument(text);

  assert.ok(doc.window, "Expected a parsed window.");
  assert.equal(doc.window?.id, "#FrmMain");
  assert.equal(doc.window?.variable, "FrmMain");
  assert.equal(doc.window?.pbAny, false);
  assert.equal(doc.window?.w, 220);
  assert.equal(doc.window?.h, 140);
  assert.equal(doc.gadgets.length, 0);
  assert.ok(doc.meta.enums);
  assert.deepEqual(doc.meta.enums?.windows, ["#FrmMain"]);
  assert.deepEqual(doc.meta.enums?.gadgets, []);
});

test("parses fixtures/smoke/03-gadgets-basic.pbf", () => {
  const text = loadFixture("fixtures/smoke/03-gadgets-basic.pbf");
  const doc = parseFormDocument(text);

  assert.ok(doc.window, "Expected a parsed window.");
  assert.equal(doc.window?.id, "#FrmGadgets");
  assert.equal(doc.window?.variable, "FrmGadgets");
  assert.equal(doc.window?.pbAny, false);
  assert.equal(doc.gadgets.length, 3);

  const textGadget = doc.gadgets.find((g) => g.kind === GADGET_KIND.TextGadget);
  assert.ok(textGadget, "Expected one TextGadget.");
  assert.equal(textGadget?.id, "#LblName");

  const buttonGadget = doc.gadgets.find((g) => g.kind === GADGET_KIND.ButtonGadget);
  assert.ok(buttonGadget, "Expected one ButtonGadget.");
  assert.equal(buttonGadget?.id, "#BtnOk");

  const pbAnyGadgets = doc.gadgets.filter((g) => g.pbAny);
  assert.equal(pbAnyGadgets.length, 1);
  assert.equal(pbAnyGadgets[0]?.kind, GADGET_KIND.StringGadget);
  assert.equal(pbAnyGadgets[0]?.id, "gInput");
  assert.equal(pbAnyGadgets[0]?.variable, "gInput");
});



test("parses fixtures/smoke/08-menu-basic.pbf", () => {
  const text = loadFixture("fixtures/smoke/08-menu-basic.pbf");
  const doc = parseFormDocument(text);

  assert.equal(doc.menus.length, 1);
  const menu = doc.menus[0];
  assert.ok(menu, "Expected a parsed menu.");
  assert.equal(menu?.id, "#MenuMain");
  assert.equal(menu?.entries.length, 6);

  const openItem = menu?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem && entry.idRaw === "#MenuOpen");
  assert.ok(openItem, "Expected a menu item with icon and shortcut.");
  assert.equal(openItem?.text, "Open");
  assert.equal(openItem?.shortcut, "Ctrl+O");
  assert.equal(openItem?.iconRaw, "ImageID(#ImgOpen)");
  assert.equal(openItem?.iconId, "#ImgOpen");

  const recentItem = menu?.entries.find((entry) => entry.kind === MENU_ENTRY_KIND.MenuItem && entry.idRaw === "#MenuRecent1");
  assert.ok(recentItem, "Expected submenu item.");
  assert.equal(recentItem?.level, 1);
  assert.equal(recentItem?.text, "Last file");
});

test("parses fixtures/smoke/09-toolbar-basic.pbf", () => {
  const text = loadFixture("fixtures/smoke/09-toolbar-basic.pbf");
  const doc = parseFormDocument(text);

  assert.equal(doc.toolbars.length, 1);
  const toolBar = doc.toolbars[0];
  assert.ok(toolBar, "Expected a parsed toolbar.");
  assert.equal(toolBar?.id, "#TbMain");

  const imageButton = toolBar?.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton);
  assert.ok(imageButton, "Expected a toolbar image button.");
  assert.equal(imageButton?.idRaw, "#TbSave");
  assert.equal(imageButton?.iconRaw, "ImageID(#ImgSave)");
  assert.equal(imageButton?.iconId, "#ImgSave");
  assert.equal(imageButton?.toggle, true);
  assert.equal(imageButton?.tooltip, "Save current form");

  const tipEntry = toolBar?.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarToolTip);
  assert.ok(tipEntry, "Expected a toolbar tooltip entry.");
  assert.equal(tipEntry?.idRaw, "#TbSave");
  assert.equal(tipEntry?.text, "Save current form");
});

test("parses fixtures/smoke/10-statusbar-basic.pbf", () => {
  const text = loadFixture("fixtures/smoke/10-statusbar-basic.pbf");
  const doc = parseFormDocument(text);

  assert.equal(doc.statusbars.length, 1);
  const statusBar = doc.statusbars[0];
  assert.ok(statusBar, "Expected a parsed status bar.");
  assert.equal(statusBar?.id, "#SbMain");
  assert.equal(statusBar?.fields.length, 3);

  const textField = statusBar?.fields[0];
  assert.equal(textField?.widthRaw, "120");
  assert.equal(textField?.textRaw, '"Ready"');
  assert.equal(textField?.text, "Ready");
  assert.equal(textField?.flagsRaw, "#PB_StatusBar_Center");

  const progressField = statusBar?.fields[1];
  assert.equal(progressField?.progressBar, true);
  assert.equal(progressField?.flagsRaw, "#PB_StatusBar_Raised");

  const imageField = statusBar?.fields[2];
  assert.equal(imageField?.widthRaw, "#PB_Ignore");
  assert.equal(imageField?.imageRaw, "ImageID(#ImgState)");
  assert.equal(imageField?.imageId, "#ImgState");
  assert.equal(imageField?.flagsRaw, "#PB_StatusBar_BorderLess");
});


test("parses fixtures/smoke/05-container-panel.pbf", () => {
  const text = loadFixture("fixtures/smoke/05-container-panel.pbf");
  const doc = parseFormDocument(text);

  const panel = doc.gadgets.find((g) => g.id === "#PnlMain");
  const txtTab0 = doc.gadgets.find((g) => g.id === "#TxtTab0");
  const strTab1 = doc.gadgets.find((g) => g.id === "#StrTab1");
  const btnTab2 = doc.gadgets.find((g) => g.id === "#BtnTab2");

  assert.ok(panel, "Expected #PnlMain gadget.");
  assert.equal(panel?.kind, GADGET_KIND.PanelGadget);
  assert.equal(panel?.items?.length, 3);
  assert.equal(panel?.items?.[0]?.text, "General");
  assert.equal(panel?.items?.[1]?.text, "Advanced");
  assert.equal(panel?.items?.[2]?.text, "Third");

  assert.ok(txtTab0, "Expected #TxtTab0 gadget.");
  assert.equal(txtTab0?.parentId, "#PnlMain");
  assert.equal(txtTab0?.parentItem, 0);

  assert.ok(strTab1, "Expected #StrTab1 gadget.");
  assert.equal(strTab1?.parentId, "#PnlMain");
  assert.equal(strTab1?.parentItem, 1);

  assert.ok(btnTab2, "Expected #BtnTab2 gadget.");
  assert.equal(btnTab2?.parentId, "#PnlMain");
  assert.equal(btnTab2?.parentItem, 2);
});


test("parses fixtures/smoke/06-container-scrollarea.pbf", () => {
  const text = loadFixture("fixtures/smoke/06-container-scrollarea.pbf");
  const doc = parseFormDocument(text);

  const scroll = doc.gadgets.find((g) => g.id === "#ScrMain");
  const inner = doc.gadgets.find((g) => g.id === "#TxtInner");

  assert.ok(scroll, "Expected #ScrMain gadget.");
  assert.equal(scroll?.kind, GADGET_KIND.ScrollAreaGadget);
  assert.equal(scroll?.minRaw, "480");
  assert.equal(scroll?.min, 480);
  assert.equal(scroll?.maxRaw, "320");
  assert.equal(scroll?.max, 320);
  assert.equal(scroll?.flagsExpr, "#PB_ScrollArea_Flat");

  assert.ok(inner, "Expected #TxtInner gadget.");
  assert.equal(inner?.parentId, "#ScrMain");
  assert.equal(inner?.parentItem, undefined);
});
test("parses fixtures/smoke/07-container-splitter.pbf", () => {
  const text = loadFixture("fixtures/smoke/07-container-splitter.pbf");
  const doc = parseFormDocument(text);

  const left = doc.gadgets.find((g) => g.id === "#TxtLeft");
  const right = doc.gadgets.find((g) => g.id === "#TxtRight");
  const split = doc.gadgets.find((g) => g.id === "#SplitMain");

  assert.ok(left, "Expected #TxtLeft gadget.");
  assert.ok(right, "Expected #TxtRight gadget.");
  assert.ok(split, "Expected #SplitMain gadget.");

  assert.equal(split?.kind, GADGET_KIND.SplitterGadget);
  assert.equal(split?.gadget1Raw, "#TxtLeft");
  assert.equal(split?.gadget1Id, "#TxtLeft");
  assert.equal(split?.gadget2Raw, "#TxtRight");
  assert.equal(split?.gadget2Id, "#TxtRight");
  assert.equal(split?.flagsExpr, "#PB_Splitter_Vertical");

  assert.equal(left?.splitterId, "#SplitMain");
  assert.equal(right?.splitterId, "#SplitMain");
  assert.equal(right?.textVariable, true);
});

test("parses samples/sample.pbf as a real-world smoke case", () => {
  const text = loadFixture("samples/sample.pbf");
  const doc = parseFormDocument(text);

  assert.ok(doc.window, "Expected a parsed window.");
  assert.ok(doc.window?.id.length, "Expected a non-empty window id.");
  assert.ok(doc.gadgets.length > 0, "Expected at least one parsed gadget.");
});


test("parses OpenWindow caption literals and keeps title as compatibility alias", () => {
  const text = `; Form Designer for PureBasic - 6.20
;
; EnableExplicit
;
;   Warning: This file is generated by the Form Designer.
;            Manual changes will be lost after recompilation!

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
EndEnumeration

Procedure OpenFrmMain(x = 0, y = 0, width = 220, height = 140)
  OpenWindow(#FrmMain, x, y, width, height, "Window Basic")
EndProcedure
`;

  const doc = parseFormDocument(text);
  assert.ok(doc.window, "Expected a parsed window.");
  assert.equal(doc.window?.caption, "Window Basic");
  assert.equal(doc.window?.captionVariable, false);
  assert.equal(doc.window?.title, "Window Basic");
  assert.equal(doc.window?.source?.line, 15);
});

test("parses OpenWindow caption variables and normalizes parent references", () => {
  const text = `; Form Designer for PureBasic - 6.20
;
; EnableExplicit
;
;   Warning: This file is generated by the Form Designer.
;            Manual changes will be lost after recompilation!

Enumeration FormWindow
  #FrmParent
  #FrmChild
EndEnumeration

Enumeration FormGadget
EndEnumeration

Procedure OpenFrmChild(x = 0, y = 0, width = 220, height = 140)
  OpenWindow(#FrmParent, 0, 0, 100, 100, "Parent")
  OpenWindow(#FrmChild, x, y, width, height, Title$, #PB_Window_SystemMenu, WindowID(#FrmParent))
EndProcedure
`;

  const doc = parseFormDocument(text);
  assert.ok(doc.window, "Expected a parsed window.");
  assert.equal(doc.window?.id, "#FrmChild");
  assert.equal(doc.window?.caption, "Title$");
  assert.equal(doc.window?.captionVariable, true);
  assert.equal(doc.window?.title, "Title$");
  assert.equal(doc.window?.parent, "#FrmParent");
});

test("normalizes non-WindowID OpenWindow parent references with leading equals", () => {
  const text = `; Form Designer for PureBasic - 6.20
;
; EnableExplicit
;
;   Warning: This file is generated by the Form Designer.
;            Manual changes will be lost after recompilation!

Enumeration FormWindow
  #FrmChild
EndEnumeration

Enumeration FormGadget
EndEnumeration

Procedure OpenFrmChild()
  OpenWindow(#FrmChild, 0, 0, 100, 100, "Child", 0, ParentWindow)
EndProcedure
`;

  const doc = parseFormDocument(text);
  assert.ok(doc.window, "Expected a parsed window.");
  assert.equal(doc.window?.parent, "=ParentWindow");
});


test("parses HideWindow, DisableWindow and SetWindowColor for enum windows", () => {
  const text = `; Form Designer for PureBasic - 6.20
;
; EnableExplicit
;
;   Warning: This file is generated by the Form Designer.
;            Manual changes will be lost after recompilation!

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
EndEnumeration

Procedure OpenFrmMain()
  OpenWindow(#FrmMain, 0, 0, 100, 100, "Main")
  HideWindow(#FrmMain, 1)
  DisableWindow(#FrmMain, 1)
  SetWindowColor(#FrmMain, RGB(17, 34, 51))
EndProcedure
`;

  const doc = parseFormDocument(text);
  assert.ok(doc.window, "Expected a parsed window.");
  assert.equal(doc.window?.hidden, true);
  assert.equal(doc.window?.disabled, true);
  assert.equal(doc.window?.color, 0x332211);
});

test("parses HideWindow, DisableWindow and SetWindowColor for #PB_Any windows assigned to a variable", () => {
  const text = `; Form Designer for PureBasic - 6.20
;
; EnableExplicit
;
;   Warning: This file is generated by the Form Designer.
;            Manual changes will be lost after recompilation!

Enumeration FormWindow
EndEnumeration

Enumeration FormGadget
EndEnumeration

Procedure OpenFrmMain()
  win = OpenWindow(#PB_Any, 0, 0, 100, 100, "Main")
  HideWindow(win, 0)
  DisableWindow(win, 1)
  SetWindowColor(win, $112233)
EndProcedure
`;

  const doc = parseFormDocument(text);
  assert.ok(doc.window, "Expected a parsed window.");
  assert.equal(doc.window?.id, "win");
  assert.equal(doc.window?.hidden, false);
  assert.equal(doc.window?.disabled, true);
  assert.equal(doc.window?.color, 0x112233);
});

test("parses fixtures/smoke/13-events-and-parent-window.pbf", () => {
  const text = loadFixture("fixtures/smoke/13-events-and-parent-window.pbf");
  const doc = parseFormDocument(text);

  assert.ok(doc.window, "Expected a parsed window.");
  assert.equal(doc.window?.id, "#FrmEventsParent");
  assert.equal(doc.window?.caption, "Events Parent");
  assert.equal(doc.window?.parent, "#ParentWin");
  assert.equal(doc.window?.eventFile, "events/form-events.pbi");
  assert.equal(doc.window?.generateEventLoop, true);
  assert.equal(doc.window?.eventProc, "HandleFrmEventsParent");
  assert.deepEqual(doc.window?.knownFlags, ["#PB_Window_SystemMenu", "#PB_Window_SizeGadget"]);
  assert.deepEqual(doc.window?.customFlags, ["#PB_Window_CustomTag"]);
});

test("deduplicates known and custom window flags separately", () => {
  const text = `; Form Designer for PureBasic - 6.20
;
; EnableExplicit
;
;   Warning: This file is generated by the Form Designer.
;            Manual changes will be lost after recompilation!

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
EndEnumeration

Procedure OpenFrmMain()
  OpenWindow(#FrmMain, 0, 0, 100, 100, "Main", #PB_Window_SystemMenu | #PB_Window_CustomAlpha | #PB_Window_CustomAlpha | #PB_Window_SizeGadget | #PB_Window_SystemMenu | #PB_Window_CustomBeta)
EndProcedure
`;

  const doc = parseFormDocument(text);
  assert.ok(doc.window, "Expected a parsed window.");
  assert.deepEqual(doc.window?.knownFlags, ["#PB_Window_SystemMenu", "#PB_Window_SizeGadget"]);
  assert.deepEqual(doc.window?.customFlags, ["#PB_Window_CustomAlpha", "#PB_Window_CustomBeta"]);
});


test("preserves raw window expressions alongside normalized values", () => {
  const text = `; Form Designer for PureBasic - 6.20
;
; EnableExplicit
;
;   Warning: This file is generated by the Form Designer.
;            Manual changes will be lost after recompilation!

Enumeration FormWindow
  #FrmParent
  #FrmChild
EndEnumeration

Enumeration FormGadget
EndEnumeration

Procedure OpenFrmChild()
  OpenWindow(#FrmParent, 0, 0, 100, 100, "Parent")
  OpenWindow(#FrmChild, 0, 0, 100, 100, Title$, #PB_Window_SystemMenu, WindowID(#FrmParent))
  HideWindow(#FrmChild, HiddenExpr)
  DisableWindow(#FrmChild, DisabledExpr)
  SetWindowColor(#FrmChild, ColorExpr)
EndProcedure
`;

  const doc = parseFormDocument(text);
  assert.ok(doc.window, "Expected a parsed window.");
  assert.equal(doc.window?.captionRaw, "Title$");
  assert.equal(doc.window?.caption, "Title$");
  assert.equal(doc.window?.captionVariable, true);
  assert.equal(doc.window?.parentRaw, "WindowID(#FrmParent)");
  assert.equal(doc.window?.parent, "#FrmParent");
  assert.equal(doc.window?.hiddenRaw, "HiddenExpr");
  assert.equal(doc.window?.hidden, undefined);
  assert.equal(doc.window?.disabledRaw, "DisabledExpr");
  assert.equal(doc.window?.disabled, undefined);
  assert.equal(doc.window?.colorRaw, "ColorExpr");
  assert.equal(doc.window?.color, undefined);
});


test("parses fixtures/smoke/12-visibility-colors-fonts.pbf", () => {
  const text = loadFixture("fixtures/smoke/12-visibility-colors-fonts.pbf");
  const doc = parseFormDocument(text);

  const txtName = doc.gadgets.find((g) => g.id === "#TxtName");
  const chkActive = doc.gadgets.find((g) => g.id === "#ChkActive");

  assert.ok(txtName, "Expected #TxtName gadget.");
  assert.equal(txtName?.textRaw, "Value$");
  assert.equal(txtName?.text, "Value$");
  assert.equal(txtName?.textVariable, true);
  assert.equal(txtName?.hidden, true);
  assert.equal(txtName?.hiddenRaw, "1");
  assert.equal(txtName?.disabled, false);
  assert.equal(txtName?.disabledRaw, "0");
  assert.equal(txtName?.tooltip, "Tooltip$");
  assert.equal(txtName?.tooltipVariable, true);
  assert.equal(txtName?.backColor, 0x1e140a);
  assert.equal(txtName?.backColorRaw, "RGB(10, 20, 30)");
  assert.equal(txtName?.frontColor, 0x112233);
  assert.equal(txtName?.frontColorRaw, "$112233");
  assert.equal(txtName?.gadgetFontRaw, "FontID(0)");
  assert.equal(txtName?.gadgetFont, "Arial");
  assert.equal(txtName?.gadgetFontSize, 12);
  assert.equal(txtName?.gadgetFontFlagsRaw, "#PB_Font_Bold | #PB_Font_Italic");

  assert.ok(chkActive, "Expected #ChkActive gadget.");
  assert.equal(chkActive?.stateRaw, "#PB_CheckBox_Checked");
  assert.equal(chkActive?.state, 1);
});

test("preserves raw gadget expressions alongside normalized values", () => {
  const text = `; Form Designer for PureBasic - 6.20
;
; EnableExplicit
;
;   Warning: This file is generated by the Form Designer.
;            Manual changes will be lost after recompilation!

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #TxtName
EndEnumeration

Procedure OpenFrmMain()
  OpenWindow(#FrmMain, 0, 0, 100, 100, "Main")
  StringGadget(#TxtName, 10, 10, 80, 20, Value$)
  GadgetToolTip(#TxtName, Tooltip$)
  HideGadget(#TxtName, HiddenExpr)
  DisableGadget(#TxtName, DisabledExpr)
  SetGadgetColor(#TxtName, #PB_Gadget_BackColor, ColorExpr)
  SetGadgetFont(#TxtName, FontID(FontExpr))
  SetGadgetState(#TxtName, StateExpr)
EndProcedure
`;

  const doc = parseFormDocument(text);
  const txtName = doc.gadgets.find((g) => g.id === "#TxtName");

  assert.ok(txtName, "Expected #TxtName gadget.");
  assert.equal(txtName?.textRaw, "Value$");
  assert.equal(txtName?.text, "Value$");
  assert.equal(txtName?.textVariable, true);
  assert.equal(txtName?.tooltipRaw, "Tooltip$");
  assert.equal(txtName?.tooltip, "Tooltip$");
  assert.equal(txtName?.tooltipVariable, true);
  assert.equal(txtName?.hiddenRaw, "HiddenExpr");
  assert.equal(txtName?.hidden, undefined);
  assert.equal(txtName?.disabledRaw, "DisabledExpr");
  assert.equal(txtName?.disabled, undefined);
  assert.equal(txtName?.backColorRaw, "ColorExpr");
  assert.equal(txtName?.backColor, undefined);
  assert.equal(txtName?.gadgetFontRaw, "FontID(FontExpr)");
  assert.equal(txtName?.stateRaw, "StateExpr");
  assert.equal(txtName?.state, undefined);
});


test("parses gadget range and image constructor arguments at the original parameter positions", () => {
  const text = `; Form Designer for PureBasic - 6.20
;
; EnableExplicit
;
;   Warning: This file is generated by the Form Designer.
;            Manual changes will be lost after recompilation!

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #PrgMain
  #ScrMain
  #ImgLogo
  #BtnSave
  #CboMain
EndEnumeration

Procedure OpenFrmMain()
  LoadImage(#ImgSource, "logo.png")
  OpenWindow(#FrmMain, 0, 0, 320, 220, "Main")
  ProgressBarGadget(#PrgMain, 10, 10, 180, 20, 5, 95, #PB_ProgressBar_Smooth)
  ScrollBarGadget(#ScrMain, 10, 40, 180, 20, 1, 9, 2, #PB_ScrollBar_Vertical)
  ImageGadget(#ImgLogo, 10, 70, 64, 64, ImageID(#ImgSource), #PB_Image_Border)
  ButtonImageGadget(#BtnSave, 90, 70, 80, 24, ImageID(#ImgSource), #PB_Button_Toggle)
  ComboBoxGadget(#CboMain, 10, 150, 120, 24, #PB_ComboBox_Editable)
EndProcedure
`;

  const doc = parseFormDocument(text);
  const prg = doc.gadgets.find((g) => g.id === "#PrgMain");
  const scr = doc.gadgets.find((g) => g.id === "#ScrMain");
  const img = doc.gadgets.find((g) => g.id === "#ImgLogo");
  const btn = doc.gadgets.find((g) => g.id === "#BtnSave");
  const cbo = doc.gadgets.find((g) => g.id === "#CboMain");

  assert.ok(prg, "Expected a parsed ProgressBarGadget.");
  assert.equal(prg?.minRaw, "5");
  assert.equal(prg?.min, 5);
  assert.equal(prg?.maxRaw, "95");
  assert.equal(prg?.max, 95);
  assert.equal(prg?.flagsExpr, "#PB_ProgressBar_Smooth");
  assert.equal(prg?.textRaw, undefined);

  assert.ok(scr, "Expected a parsed ScrollBarGadget.");
  assert.equal(scr?.min, 1);
  assert.equal(scr?.max, 9);
  assert.equal(scr?.flagsExpr, "#PB_ScrollBar_Vertical");

  assert.ok(img, "Expected a parsed ImageGadget.");
  assert.equal(img?.imageRaw, "ImageID(#ImgSource)");
  assert.equal(img?.imageId, "#ImgSource");
  assert.equal(img?.flagsExpr, "#PB_Image_Border");
  assert.equal(img?.textRaw, undefined);

  assert.ok(btn, "Expected a parsed ButtonImageGadget.");
  assert.equal(btn?.imageId, "#ImgSource");
  assert.equal(btn?.flagsExpr, "#PB_Button_Toggle");

  assert.ok(cbo, "Expected a parsed ComboBoxGadget.");
  assert.equal(cbo?.flagsExpr, "#PB_ComboBox_Editable");
  assert.equal(cbo?.textRaw, undefined);
});

test("preserves raw gadget range and image expressions when they cannot be normalized", () => {
  const text = `; Form Designer for PureBasic - 6.20
;
; EnableExplicit
;
;   Warning: This file is generated by the Form Designer.
;            Manual changes will be lost after recompilation!

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
  #TrkMain
  #ImgLogo
EndEnumeration

Procedure OpenFrmMain()
  OpenWindow(#FrmMain, 0, 0, 320, 220, "Main")
  TrackBarGadget(#TrkMain, 10, 10, 180, 20, MinValue, MaxValue, #PB_TrackBar_Ticks)
  ImageGadget(#ImgLogo, 10, 40, 64, 64, imgHandle, 0)
EndProcedure
`;

  const doc = parseFormDocument(text);
  const trk = doc.gadgets.find((g) => g.id === "#TrkMain");
  const img = doc.gadgets.find((g) => g.id === "#ImgLogo");

  assert.ok(trk, "Expected a parsed TrackBarGadget.");
  assert.equal(trk?.minRaw, "MinValue");
  assert.equal(trk?.min, undefined);
  assert.equal(trk?.maxRaw, "MaxValue");
  assert.equal(trk?.max, undefined);
  assert.equal(trk?.flagsExpr, "#PB_TrackBar_Ticks");

  assert.ok(img, "Expected a parsed ImageGadget.");
  assert.equal(img?.imageRaw, "imgHandle");
  assert.equal(img?.imageId, "imgHandle");
});


test("parses fixtures/smoke/11-images-crossrefs.pbf", () => {
  const text = loadFixture("fixtures/smoke/11-images-crossrefs.pbf");
  const doc = parseFormDocument(text);

  assert.equal(doc.images.length, 3);

  const openImg = doc.images.find((img) => img.id === "#ImgOpen");
  assert.ok(openImg, "Expected #ImgOpen image.");
  assert.equal(openImg?.inline, false);
  assert.equal(openImg?.imageRaw, '"open.png"');
  assert.equal(openImg?.image, "open.png");

  const saveImg = doc.images.find((img) => img.id === "imgSave");
  assert.ok(saveImg, "Expected pbAny image assignment.");
  assert.equal(saveImg?.pbAny, true);
  assert.equal(saveImg?.variable, "imgSave");
  assert.equal(saveImg?.image, "save.png");

  const stateImg = doc.images.find((img) => img.id === "#ImgState");
  assert.ok(stateImg, "Expected inline image.");
  assert.equal(stateImg?.inline, true);
  assert.equal(stateImg?.imageRaw, "?ImgState");
  assert.equal(stateImg?.image, "ImgState");

  const imageGadget = doc.gadgets.find((g) => g.id === "#ImgPreview");
  assert.ok(imageGadget, "Expected image gadget.");
  assert.equal(imageGadget?.imageId, "#ImgOpen");

  const menuItem = doc.menus[0]?.entries.find((entry) => entry.idRaw === "#MenuOpen");
  assert.equal(menuItem?.iconId, "#ImgOpen");

  const toolBarImage = doc.toolbars[0]?.entries.find((entry) => entry.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton);
  assert.equal(toolBarImage?.iconId, "imgSave");

  const statusField = doc.statusbars[0]?.fields[0];
  assert.equal(statusField?.imageId, "#ImgState");
});


test("parses LoadImage and CatchImage with raw fallback values", () => {
  const text = `; Form Designer for PureBasic - 6.20
;
; EnableExplicit
;
;   Warning: This file is generated by the Form Designer.
;            Manual changes will be lost after recompilation!

Enumeration FormWindow
  #FrmMain
EndEnumeration

Enumeration FormGadget
EndEnumeration

OpenWindow(#FrmMain, 0, 0, 200, 100, "Main")
LoadImage(#ImgExpr, fileExpr$)
imgInline = CatchImage(#PB_Any, ?BinaryBlock)
`;

  const doc = parseFormDocument(text);
  assert.equal(doc.images.length, 2);

  const fileImg = doc.images.find((img) => img.id === "#ImgExpr");
  assert.ok(fileImg, "Expected LoadImage entry.");
  assert.equal(fileImg?.imageRaw, "fileExpr$");
  assert.equal(fileImg?.image, "fileExpr$");

  const inlineImg = doc.images.find((img) => img.id === "imgInline");
  assert.ok(inlineImg, "Expected CatchImage entry.");
  assert.equal(inlineImg?.imageRaw, "?BinaryBlock");
  assert.equal(inlineImg?.image, "BinaryBlock");
});
