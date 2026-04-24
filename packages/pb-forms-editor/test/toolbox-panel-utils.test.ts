import test from "node:test";
import assert from "node:assert/strict";

import { canImmediateInsertFromToolbox, getDefaultToolboxPanelKind, getImmediateToolboxInsertPosition, getToolboxPanelCategories } from "../src/core/toolbox/panel";

test("toolbox panel categories follow the verified original group order", () => {
  const categories = getToolboxPanelCategories();
  assert.deepEqual(
    categories.map(category => category.title),
    ["Common Controls", "Containers", "Menus & Toolbars"]
  );
});

test("toolbox panel keeps the verified gadget order within the containers group", () => {
  const containers = getToolboxPanelCategories().find(category => category.title === "Containers");
  assert.ok(containers);
  if (!containers) {
    throw new Error("Containers toolbox category is missing.");
  }
  assert.deepEqual(
    containers.items.map(item => item.label),
    ["Container", "Frame", "Panel", "ScrollArea", "Splitter"]
  );
});

test("default toolbox panel kind stays on the first selectable common control", () => {
  assert.equal(getDefaultToolboxPanelKind(), "ButtonGadget");
});

test("toolbox panel keeps the verified vd icon bindings for representative entries", () => {
  const categories = getToolboxPanelCategories();
  const commonControls = categories.find(category => category.title === "Common Controls");
  const containers = categories.find(category => category.title === "Containers");
  const menusAndToolbars = categories.find(category => category.title === "Menus & Toolbars");

  assert.equal(commonControls?.items.find(item => item.label === "Button")?.iconAsset, "vd_buttongadget.png");
  assert.equal(commonControls?.items.find(item => item.label === "WebView")?.iconAsset, "vd_webgadget.png");
  assert.equal(containers?.items.find(item => item.label === "Frame")?.iconAsset, "vd_frame3dgadget.png");
  assert.equal(menusAndToolbars?.items.find(item => item.label === "ToolBar")?.iconAsset, "vd_toolbar.png");
  assert.equal(menusAndToolbars?.items.find(item => item.label === "StatusBar")?.iconAsset, "vd_status.png");
});


test("toolbox immediate insert keeps the verified original splitter exception and default position", () => {
  assert.equal(canImmediateInsertFromToolbox("ButtonGadget"), true);
  assert.equal(canImmediateInsertFromToolbox("SplitterGadget"), false);
  assert.deepEqual(getImmediateToolboxInsertPosition(), { x: 10, y: 10 });
});
