import test from "node:test";
import assert from "node:assert/strict";
import { resolveGadgetCanvasContextMenuActions } from "../src/core/gadget/context-menu";

const ORIGINAL_UNIMPLEMENTED_POPUP_KINDS = [
  "cutGadget",
  "copyGadget",
  "pasteGadget",
  "duplicateGadget",
  "alignGadgetLeft",
  "alignGadgetTop",
  "alignGadgetWidth",
  "alignGadgetHeight",
];

test("gadget context menu exposes original clipboard, duplicate and align entries as blocked commands", () => {
  const actions = resolveGadgetCanvasContextMenuActions({
    gadget: { id: "#Button_0", kind: "ButtonGadget" }
  });

  assert.deepEqual(actions.map(action => action.kind), ["deleteGadget", ...ORIGINAL_UNIMPLEMENTED_POPUP_KINDS]);
  const deleteAction = actions[0]!;
  if (deleteAction.kind !== "deleteGadget") throw new Error(`Unexpected action kind: ${deleteAction.kind}`);
  assert.equal(deleteAction.label, "Delete Gadget…");
  assert.equal(deleteAction.enabled, true);
  assert.equal(deleteAction.confirmLabel, "Delete Gadget");

  for (const action of actions.slice(1)) {
    assert.equal(action.enabled, false);
    assert.match(action.title, /not implemented yet/i);
  }
});

test("gadget context menu exposes Edit Items for original item-capable gadgets", () => {
  for (const kind of ["PanelGadget", "TreeGadget", "ListViewGadget", "ComboBoxGadget", "EditorGadget"]) {
    const actions = resolveGadgetCanvasContextMenuActions({
      gadget: { id: `#${kind}_0`, kind }
    });

    assert.deepEqual(actions.map(action => action.kind), [
      "deleteGadget",
      ...ORIGINAL_UNIMPLEMENTED_POPUP_KINDS,
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
