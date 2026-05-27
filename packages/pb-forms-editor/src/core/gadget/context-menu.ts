import { canInspectGadgetColumns, canInspectGadgetItems } from "./inspector";

export type GadgetContextMenuLike = {
  id: string;
  kind?: string;
};

export type GadgetCanvasContextMenuUnsupportedOriginalActionKind =
  | "cutGadget"
  | "copyGadget"
  | "pasteGadget"
  | "duplicateGadget"
  | "alignGadgetLeft"
  | "alignGadgetTop"
  | "alignGadgetWidth"
  | "alignGadgetHeight";

export type GadgetCanvasContextMenuAction =
  | {
      kind: "deleteGadget";
      label: "Delete Gadget…";
      title: string;
      enabled: boolean;
      gadgetId: string;
      confirmLabel: "Delete Gadget";
      message: string;
    }
  | {
      kind: "editGadgetItems";
      label: "Edit Items…";
      title: string;
      enabled: true;
      gadgetId: string;
    }
  | {
      kind: "editGadgetColumns";
      label: "Edit Columns…";
      title: string;
      enabled: true;
      gadgetId: string;
    }
  | {
      kind: GadgetCanvasContextMenuUnsupportedOriginalActionKind;
      label: string;
      title: string;
      enabled: false;
      gadgetId: string;
    };

function buildUnsupportedOriginalActions(gadgetId: string): GadgetCanvasContextMenuAction[] {
  const title = "This original Form Designer popup command is visible, but its patch path is not implemented yet.";
  return [
    { kind: "cutGadget", label: "Cut", title, enabled: false, gadgetId },
    { kind: "copyGadget", label: "Copy", title, enabled: false, gadgetId },
    { kind: "pasteGadget", label: "Paste", title, enabled: false, gadgetId },
    { kind: "duplicateGadget", label: "Duplicate", title, enabled: false, gadgetId },
    { kind: "alignGadgetLeft", label: "Align Left", title, enabled: false, gadgetId },
    { kind: "alignGadgetTop", label: "Align Top", title, enabled: false, gadgetId },
    { kind: "alignGadgetWidth", label: "Align Width", title, enabled: false, gadgetId },
    { kind: "alignGadgetHeight", label: "Align Height", title, enabled: false, gadgetId },
  ];
}

export function resolveGadgetCanvasContextMenuActions(args: {
  gadget: GadgetContextMenuLike;
  deleteBlockedReason?: string;
}): GadgetCanvasContextMenuAction[] {
  const { gadget } = args;
  const actions: GadgetCanvasContextMenuAction[] = [
    {
      kind: "deleteGadget",
      label: "Delete Gadget…",
      title: args.deleteBlockedReason ?? "Delete the currently selected gadget.",
      enabled: !args.deleteBlockedReason,
      gadgetId: gadget.id,
      confirmLabel: "Delete Gadget",
      message: `Delete gadget '${gadget.id}'?`
    }
  ];

  actions.push(...buildUnsupportedOriginalActions(gadget.id));

  if (canInspectGadgetItems(gadget.kind)) {
    actions.push({
      kind: "editGadgetItems",
      label: "Edit Items…",
      title: "Open the item editor for the currently selected gadget.",
      enabled: true,
      gadgetId: gadget.id
    });
  }

  if (canInspectGadgetColumns(gadget.kind)) {
    actions.push({
      kind: "editGadgetColumns",
      label: "Edit Columns…",
      title: "Open the column editor for the currently selected gadget.",
      enabled: true,
      gadgetId: gadget.id
    });
  }

  return actions;
}
