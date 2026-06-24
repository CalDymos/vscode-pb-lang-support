import test from "node:test";
import assert from "node:assert/strict";

import { buildOriginalGadgetDeletePlan, shouldOpenGadgetKeyboardDeleteDialog } from "../src/core/gadget/delete";

test("deletes splitter-owned gadgets when their owning splitter is part of the same delete subtree", () => {
  const gadgets = [
    { id: "#Container_0", kind: "ContainerGadget" },
    { id: "#LeftPane", kind: "ContainerGadget", parentId: "#Container_0", splitterId: "#SplitMain" },
    { id: "#InnerLeft", kind: "TextGadget", parentId: "#LeftPane" },
    { id: "#RightPane", kind: "ContainerGadget", parentId: "#Container_0", splitterId: "#SplitMain" },
    { id: "#SplitMain", kind: "SplitterGadget", parentId: "#Container_0", gadget1Id: "#LeftPane", gadget2Id: "#RightPane" },
  ];

  const plan = buildOriginalGadgetDeletePlan(gadgets, "#Container_0");

  assert.deepEqual([...plan.requestedIds], ["#Container_0", "#LeftPane", "#InnerLeft", "#RightPane", "#SplitMain"]);
  assert.deepEqual([...plan.deletedIds], ["#Container_0", "#LeftPane", "#InnerLeft", "#RightPane", "#SplitMain"]);
  assert.deepEqual([...plan.skippedIds], []);
});

test("keeps splitter-owned gadgets skipped when the owning splitter is not deleted", () => {
  const gadgets = [
    { id: "#LeftPane", kind: "ContainerGadget", splitterId: "#SplitMain" },
    { id: "#InnerLeft", kind: "TextGadget", parentId: "#LeftPane" },
    { id: "#RightPane", kind: "ContainerGadget", splitterId: "#SplitMain" },
    { id: "#SplitMain", kind: "SplitterGadget", gadget1Id: "#LeftPane", gadget2Id: "#RightPane" },
  ];

  const plan = buildOriginalGadgetDeletePlan(gadgets, "#LeftPane");

  assert.deepEqual([...plan.requestedIds], ["#LeftPane", "#InnerLeft"]);
  assert.deepEqual([...plan.deletedIds], ["#InnerLeft"]);
  assert.deepEqual([...plan.skippedIds], ["#LeftPane"]);
});

test("opens selected gadget keyboard delete only for safe Delete or Backspace shortcuts", () => {
  const base = {
    editableTarget: false,
    hasBlockingDialog: false,
    hasPendingInsertGadget: false,
    selectionKind: "gadget",
  };

  assert.equal(shouldOpenGadgetKeyboardDeleteDialog({ ...base, key: "Delete" }), true);
  assert.equal(shouldOpenGadgetKeyboardDeleteDialog({ ...base, key: "Backspace" }), true);
  assert.equal(shouldOpenGadgetKeyboardDeleteDialog({ ...base, key: "Escape" }), false);
  assert.equal(shouldOpenGadgetKeyboardDeleteDialog({ ...base, key: "Delete", editableTarget: true }), false);
  assert.equal(shouldOpenGadgetKeyboardDeleteDialog({ ...base, key: "Delete", hasBlockingDialog: true }), false);
  assert.equal(shouldOpenGadgetKeyboardDeleteDialog({ ...base, key: "Delete", hasPendingInsertGadget: true }), false);
  assert.equal(shouldOpenGadgetKeyboardDeleteDialog({ ...base, key: "Delete", selectionKind: "window" }), false);
});
