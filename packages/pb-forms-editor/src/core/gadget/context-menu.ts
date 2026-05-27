import { canHostInsertedGadgets } from "./insert";
import { canInspectGadgetColumns, canInspectGadgetItems } from "./inspector";
import { GADGET_KIND } from "../model";

export type GadgetContextMenuLike = {
  id: string;
  kind?: string;
  flagsExpr?: string;
  splitterId?: string;
  resizeSource?: unknown;
  resizeYRaw?: string;
  resizeHRaw?: string;
};

export type GadgetCanvasContextMenuUnsupportedOriginalActionKind =
  | "cutGadget"
  | "copyGadget"
  | "pasteGadget"
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
      kind: "duplicateGadget";
      label: "Duplicate";
      title: string;
      enabled: boolean;
      gadgetId: string;
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

function isIntegerLiteral(raw: string | undefined): boolean {
  return typeof raw === "string" && /^-?\d+$/.test(raw.trim());
}

function canDuplicatePersistedResizeLineFromContextMenu(gadget: GadgetContextMenuLike): boolean {
  if (!gadget.resizeSource) return true;

  return isIntegerLiteral(gadget.resizeYRaw) && isIntegerLiteral(gadget.resizeHRaw);
}

export function canDuplicateGadgetFromContextMenu(gadget: GadgetContextMenuLike): boolean {
  return typeof gadget.kind === "string"
    && gadget.kind !== GADGET_KIND.CustomGadget
    && gadget.kind !== GADGET_KIND.SplitterGadget
    && !gadget.splitterId
    && canDuplicatePersistedResizeLineFromContextMenu(gadget)
    && !canHostInsertedGadgets({ kind: gadget.kind, flagsExpr: gadget.flagsExpr });
}

function buildUnsupportedOriginalActions(gadgetId: string): GadgetCanvasContextMenuAction[] {
  const title = "This original Form Designer popup command is visible, but its patch path is not implemented yet.";
  return [
    { kind: "cutGadget", label: "Cut", title, enabled: false, gadgetId },
    { kind: "copyGadget", label: "Copy", title, enabled: false, gadgetId },
    { kind: "pasteGadget", label: "Paste", title, enabled: false, gadgetId },
    { kind: "alignGadgetLeft", label: "Align Left", title, enabled: false, gadgetId },
    { kind: "alignGadgetTop", label: "Align Top", title, enabled: false, gadgetId },
    { kind: "alignGadgetWidth", label: "Align Width", title, enabled: false, gadgetId },
    { kind: "alignGadgetHeight", label: "Align Height", title, enabled: false, gadgetId },
  ];
}

function buildDuplicateAction(gadget: GadgetContextMenuLike): GadgetCanvasContextMenuAction {
  const enabled = canDuplicateGadgetFromContextMenu(gadget);
  return {
    kind: "duplicateGadget",
    label: "Duplicate",
    title: enabled
      ? "Duplicate the currently selected gadget."
      : "This original Form Designer popup command is visible, but its patch path is not implemented for this gadget structure yet.",
    enabled,
    gadgetId: gadget.id
  };
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
  actions.push(buildDuplicateAction(gadget));

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
