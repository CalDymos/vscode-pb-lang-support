import test from "node:test";
import assert from "node:assert/strict";

import { getGadgetReparentParentOptions, canOpenGadgetReparentDialog } from "../src/core/gadget/reparent";
import type { FormWindow, Gadget } from "../src/core/model";

const windowModel: FormWindow = {
  id: "#FrmMain",
  variable: "FrmMain",
  pbAny: false,
  firstParam: "#FrmMain",
  x: 0,
  y: 0,
  w: 320,
  h: 220,
};

test("lists window and eligible gadget-list parents for reparenting", () => {
  const gadgets: Gadget[] = [
    { id: "#Container_0", kind: "ContainerGadget", pbAny: false, firstParam: "#Container_0", variable: "Container_0", x: 0, y: 0, w: 100, h: 100 },
    { id: "#Panel_0", kind: "PanelGadget", pbAny: false, firstParam: "#Panel_0", variable: "Panel_0", x: 0, y: 0, w: 100, h: 100, items: [{ posRaw: "-1", textRaw: '"Tab 1"', text: "Tab 1" }, { posRaw: "-1", textRaw: '"Tab 2"', text: "Tab 2" }] },
    { id: "#BtnApply", kind: "ButtonGadget", pbAny: false, firstParam: "#BtnApply", variable: "BtnApply", x: 10, y: 10, w: 80, h: 25 },
  ];

  const options = getGadgetReparentParentOptions(windowModel, gadgets, "#BtnApply");

  assert.deepEqual(
    options.map(option => ({ value: option.value, label: option.label, itemLabels: option.itemLabels })),
    [
      { value: "window", label: "FrmMain", itemLabels: [] },
      { value: "gadget:#Container_0", label: "Container_0", itemLabels: [] },
      { value: "gadget:#Panel_0", label: "Panel_0", itemLabels: ["Tab 1", "Tab 2"] },
    ]
  );
});

test("excludes the selected gadget subtree from reparent target options", () => {
  const gadgets: Gadget[] = [
    { id: "#Container_0", kind: "ContainerGadget", pbAny: false, firstParam: "#Container_0", variable: "Container_0", x: 0, y: 0, w: 100, h: 100 },
    { id: "#InnerPanel", kind: "PanelGadget", pbAny: false, firstParam: "#InnerPanel", variable: "InnerPanel", parentId: "#Container_0", x: 0, y: 0, w: 100, h: 100, items: [{ posRaw: "-1", textRaw: '"Tab"', text: "Tab" }] },
    { id: "#BtnApply", kind: "ButtonGadget", pbAny: false, firstParam: "#BtnApply", variable: "BtnApply", parentId: "#InnerPanel", parentItem: 0, x: 10, y: 10, w: 80, h: 25 },
  ];

  const options = getGadgetReparentParentOptions(windowModel, gadgets, "#Container_0");

  assert.deepEqual(options.map(option => option.value), ["window"]);
});



test("excludes splitter children and their subtrees from reparent target options", () => {
  const gadgets: Gadget[] = [
    { id: "#Container_0", kind: "ContainerGadget", pbAny: false, firstParam: "#Container_0", variable: "Container_0", x: 0, y: 0, w: 100, h: 100 },
    { id: "#InnerPanel", kind: "PanelGadget", pbAny: false, firstParam: "#InnerPanel", variable: "InnerPanel", parentId: "#Container_0", x: 0, y: 0, w: 100, h: 100, items: [{ posRaw: "-1", textRaw: '"Tab"', text: "Tab" }] },
    { id: "#RightContainer", kind: "ContainerGadget", pbAny: false, firstParam: "#RightContainer", variable: "RightContainer", x: 0, y: 0, w: 100, h: 100 },
    { id: "#OtherPanel", kind: "PanelGadget", pbAny: false, firstParam: "#OtherPanel", variable: "OtherPanel", x: 0, y: 0, w: 100, h: 100, items: [{ posRaw: "-1", textRaw: '"Tab"', text: "Tab" }] },
    { id: "#SplitMain", kind: "SplitterGadget", pbAny: false, firstParam: "#SplitMain", variable: "SplitMain", gadget1Id: "#Container_0", gadget2Id: "#RightContainer", x: 0, y: 0, w: 180, h: 100 },
  ];

  const options = getGadgetReparentParentOptions(windowModel, gadgets, "#SplitMain");

  assert.deepEqual(options.map(option => option.value), ["window", "gadget:#OtherPanel"]);
});


test("lists only container-enabled FrameGadget targets for reparenting", () => {
  const gadgets: Gadget[] = [
    { id: "#FramePlain", kind: "FrameGadget", pbAny: false, firstParam: "#FramePlain", variable: "FramePlain", x: 0, y: 0, w: 160, h: 80, textRaw: '"Plain"' },
    { id: "#FrameHost", kind: "FrameGadget", pbAny: false, firstParam: "#FrameHost", variable: "FrameHost", x: 0, y: 0, w: 160, h: 80, textRaw: '"Host"', flagsExpr: "#PB_Frame_Single | #PB_Frame_Container" },
    { id: "#BtnApply", kind: "ButtonGadget", pbAny: false, firstParam: "#BtnApply", variable: "BtnApply", x: 10, y: 10, w: 80, h: 25 },
  ];

  const options = getGadgetReparentParentOptions(windowModel, gadgets, "#BtnApply");

  assert.deepEqual(options.map(option => option.value), ["window", "gadget:#FrameHost"]);
});


test("allows splitter gadgets but still blocks custom gadgets for select-parent", () => {
  assert.equal(canOpenGadgetReparentDialog(undefined), false);
  assert.equal(canOpenGadgetReparentDialog({ kind: "SplitterGadget" }), true);
  assert.equal(canOpenGadgetReparentDialog({ kind: "CustomGadget" }), false);
  assert.equal(canOpenGadgetReparentDialog({ kind: "ButtonGadget" }), true);
});
