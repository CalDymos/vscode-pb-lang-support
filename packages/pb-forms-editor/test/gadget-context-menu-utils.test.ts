import test from "node:test";
import assert from "node:assert/strict";
import { resolveGadgetCanvasContextMenuActions } from "../src/core/gadget/context-menu";

const ORIGINAL_STILL_UNIMPLEMENTED_POPUP_KINDS = [
  "cutGadget",
  "alignGadgetLeft",
  "alignGadgetTop",
  "alignGadgetWidth",
  "alignGadgetHeight",
];

const BASE_POPUP_KINDS = [
  "deleteGadget",
  "copyGadget",
  "pasteGadget",
  ...ORIGINAL_STILL_UNIMPLEMENTED_POPUP_KINDS,
  "duplicateGadget",
];

test("gadget context menu exposes the first safe Copy and Paste popup scope", () => {
  const actions = resolveGadgetCanvasContextMenuActions({
    gadget: { id: "#Button_0", kind: "ButtonGadget" }
  });

  assert.deepEqual(actions.map(action => action.kind), BASE_POPUP_KINDS);
  const deleteAction = actions[0]!;
  if (deleteAction.kind !== "deleteGadget") throw new Error(`Unexpected action kind: ${deleteAction.kind}`);
  assert.equal(deleteAction.label, "Delete Gadget…");
  assert.equal(deleteAction.enabled, true);
  assert.equal(deleteAction.confirmLabel, "Delete Gadget");

  const copyAction = actions.find(action => action.kind === "copyGadget");
  const pasteAction = actions.find(action => action.kind === "pasteGadget");
  assert.equal(copyAction?.enabled, true);
  assert.equal(pasteAction?.enabled, false);
  assert.match(pasteAction?.title ?? "", /Copy a supported gadget/i);

  for (const action of actions.filter(action => ORIGINAL_STILL_UNIMPLEMENTED_POPUP_KINDS.includes(action.kind))) {
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
      ...BASE_POPUP_KINDS,
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
    ...BASE_POPUP_KINDS,
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
  assert.equal(actions[1]?.kind, "copyGadget");
  assert.equal(actions[1]?.enabled, true);
  assert.equal(actions[3]?.kind, "cutGadget");
  assert.equal(actions[3]?.enabled, false);
});

test("gadget context menu enables Paste when a safe copied gadget is available", () => {
  const actions = resolveGadgetCanvasContextMenuActions({
    gadget: { id: "#Button_1", kind: "ButtonGadget" },
    copiedGadgetId: "#Button_0",
    canPasteCopiedGadget: true,
  });

  const pasteAction = actions.find(action => action.kind === "pasteGadget");
  if (!pasteAction) throw new Error("Expected Paste to stay visible.");
  assert.equal(pasteAction.enabled, true);
  assert.equal(pasteAction.gadgetId, "#Button_0");
});

test("gadget context menu keeps Copy, Paste and Duplicate blocked for structural gadget kinds outside the first patch scope", () => {
  for (const gadget of [
    { id: "#SplitMain", kind: "SplitterGadget" },
    { id: "#PanelMain", kind: "PanelGadget" },
    { id: "#Child", kind: "ButtonGadget", splitterId: "#SplitMain" },
    { id: "#BottomLocked", kind: "ButtonGadget", resizeSource: { line: 12 }, resizeYRaw: "FormWindowHeight - 80", resizeHRaw: "24" },
  ]) {
    const actions = resolveGadgetCanvasContextMenuActions({ gadget });
    const copyAction = actions.find(action => action.kind === "copyGadget");
    const duplicateAction = actions.find(action => action.kind === "duplicateGadget");
    if (!copyAction || !duplicateAction) throw new Error("Expected Copy and Duplicate to stay visible.");

    if (gadget.id === "#BottomLocked") {
      assert.equal(copyAction.enabled, true);
    } else {
      assert.equal(copyAction.enabled, false);
      assert.match(copyAction.title, /not implemented for this gadget structure yet/i);
    }
    assert.equal(duplicateAction.enabled, false);
    assert.match(duplicateAction.title, /not implemented for this gadget structure yet/i);
  }
});

test("gadget context menu enables Duplicate for safe horizontal ResizeGadget persistence", () => {
  const actions = resolveGadgetCanvasContextMenuActions({
    gadget: {
      id: "#StretchWidth",
      kind: "ButtonGadget",
      resizeSource: { line: 12 },
      resizeYRaw: "20",
      resizeHRaw: "24",
    }
  });

  const duplicateAction = actions.find(action => action.kind === "duplicateGadget");
  if (!duplicateAction) throw new Error("Expected Duplicate to stay visible.");
  assert.equal(duplicateAction.enabled, true);
});
