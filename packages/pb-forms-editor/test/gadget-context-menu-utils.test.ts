import test from "node:test";
import assert from "node:assert/strict";
import { resolveGadgetCanvasContextMenuActions } from "../src/core/gadget/context-menu";

const ORIGINAL_UNIMPLEMENTED_POPUP_KINDS = [
  "cutGadget",
  "copyGadget",
  "pasteGadget",
  "alignGadgetLeft",
  "alignGadgetTop",
  "alignGadgetWidth",
  "alignGadgetHeight",
];

test("gadget context menu exposes original clipboard and align entries as blocked commands", () => {
  const actions = resolveGadgetCanvasContextMenuActions({
    gadget: { id: "#Button_0", kind: "ButtonGadget" }
  });

  assert.deepEqual(actions.map(action => action.kind), ["deleteGadget", ...ORIGINAL_UNIMPLEMENTED_POPUP_KINDS, "duplicateGadget"]);
  const deleteAction = actions[0]!;
  if (deleteAction.kind !== "deleteGadget") throw new Error(`Unexpected action kind: ${deleteAction.kind}`);
  assert.equal(deleteAction.label, "Delete Gadget…");
  assert.equal(deleteAction.enabled, true);
  assert.equal(deleteAction.confirmLabel, "Delete Gadget");

  for (const action of actions.slice(1, -1)) {
    assert.equal(action.enabled, false);
    assert.match(action.title, /not implemented yet/i);
  }
  const duplicateAction = actions.at(-1)!;
  assert.equal(duplicateAction.kind, "duplicateGadget");
  assert.equal(duplicateAction.enabled, true);
  assert.equal(duplicateAction.label, "Duplicate");
});

test("gadget context menu exposes Edit Items for original item-capable gadgets", () => {
  for (const kind of ["PanelGadget", "TreeGadget", "ListViewGadget", "ComboBoxGadget", "EditorGadget"]) {
    const actions = resolveGadgetCanvasContextMenuActions({
      gadget: { id: `#${kind}_0`, kind }
    });

    assert.deepEqual(actions.map(action => action.kind), [
      "deleteGadget",
      ...ORIGINAL_UNIMPLEMENTED_POPUP_KINDS,
      "duplicateGadget",
      "editGadgetItems"
    ]);
    assert.equal(actions.at(-1)?.label, "Edit Items…");
    assert.equal(actions.at(-1)?.enabled, true);
  }
});

test("listicon gadget context menu exposes Edit Items and Edit Columns", () => {
  const actions = resolveGadgetCanvasContextMenuActions({
    gadget: { id: "#ListIcon_0", kind: "ListIconGadget" }
  });

  assert.deepEqual(actions.map(action => action.kind), [
    "deleteGadget",
    ...ORIGINAL_UNIMPLEMENTED_POPUP_KINDS,
    "duplicateGadget",
    "editGadgetItems",
    "editGadgetColumns"
  ]);
  assert.equal(actions.at(-2)?.label, "Edit Items…");
  assert.equal(actions.at(-1)?.label, "Edit Columns…");
});

test("gadget context menu keeps delete disabled when core delete guard blocks it", () => {
  const actions = resolveGadgetCanvasContextMenuActions({
    gadget: { id: "#SplitterChild_0", kind: "ButtonGadget" },
    deleteBlockedReason: "This gadget is still linked by a splitter."
  });

  const deleteAction = actions[0]!;
  if (deleteAction.kind !== "deleteGadget") throw new Error(`Unexpected action kind: ${deleteAction.kind}`);
  assert.equal(deleteAction.enabled, false);
  assert.equal(deleteAction.title, "This gadget is still linked by a splitter.");
  assert.equal(actions[1]?.kind, "cutGadget");
  assert.equal(actions[1]?.enabled, false);
});


test("gadget context menu keeps Duplicate blocked for structural gadget kinds outside the first duplicate patch scope", () => {
  for (const gadget of [
    { id: "#SplitMain", kind: "SplitterGadget" },
    { id: "#PanelMain", kind: "PanelGadget" },
    { id: "#Child", kind: "ButtonGadget", splitterId: "#SplitMain" },
  ]) {
    const actions = resolveGadgetCanvasContextMenuActions({ gadget });
    const duplicateAction = actions.find(action => action.kind === "duplicateGadget");
    if (!duplicateAction) throw new Error("Expected Duplicate to stay visible.");
    assert.equal(duplicateAction.enabled, false);
    assert.match(duplicateAction.title, /not implemented for this gadget structure yet/i);
  }
});
