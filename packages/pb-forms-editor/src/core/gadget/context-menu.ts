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
      kind: "copyGadget" | "pasteGadget" | "duplicateGadget";
      label: "Copy" | "Paste" | "Duplicate";
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

function canCopyPasteSimpleGadgetFromContextMenu(gadget: GadgetContextMenuLike): boolean {
  return typeof gadget.kind === "string"
    && gadget.kind !== GADGET_KIND.CustomGadget
    && gadget.kind !== GADGET_KIND.SplitterGadget
    && !gadget.splitterId
    && !canHostInsertedGadgets({ kind: gadget.kind, flagsExpr: gadget.flagsExpr });
}

function canCopyPasteFirstScopeStructuralGadgetFromContextMenu(gadget: GadgetContextMenuLike): boolean {
  return !gadget.splitterId
    && (gadget.kind === GADGET_KIND.ContainerGadget
      || gadget.kind === GADGET_KIND.ScrollAreaGadget
      || gadget.kind === GADGET_KIND.PanelGadget
      || (gadget.kind === GADGET_KIND.FrameGadget && canHostInsertedGadgets({ kind: gadget.kind, flagsExpr: gadget.flagsExpr })));
}

export function canCopyPasteGadgetFromContextMenu(gadget: GadgetContextMenuLike): boolean {
  return canCopyPasteSimpleGadgetFromContextMenu(gadget)
    || canCopyPasteFirstScopeStructuralGadgetFromContextMenu(gadget);
}

function canDuplicateStructuralHostGadgetFromContextMenu(gadget: GadgetContextMenuLike): boolean {
  return !gadget.splitterId
    && canHostInsertedGadgets({ kind: gadget.kind ?? "", flagsExpr: gadget.flagsExpr });
}

export function canDuplicateGadgetFromContextMenu(gadget: GadgetContextMenuLike): boolean {
  return (canCopyPasteSimpleGadgetFromContextMenu(gadget)
    || canDuplicateStructuralHostGadgetFromContextMenu(gadget))
    && canDuplicatePersistedResizeLineFromContextMenu(gadget);
}

function buildClipboardOriginalActions(args: {
  gadget: GadgetContextMenuLike;
  copiedGadgetId?: string;
  canPasteCopiedGadget?: boolean;
}): GadgetCanvasContextMenuAction[] {
  const { gadget, copiedGadgetId } = args;
  const copyEnabled = canCopyPasteGadgetFromContextMenu(gadget);
  const pasteEnabled = Boolean(copiedGadgetId && args.canPasteCopiedGadget);
  return [
    {
      kind: "copyGadget",
      label: "Copy",
      title: copyEnabled
        ? "Copy the currently selected gadget for a later Paste command."
        : "This command is not implemented for this gadget structure yet.",
      enabled: copyEnabled,
      gadgetId: gadget.id,
    },
    {
      kind: "pasteGadget",
      label: "Paste",
      title: pasteEnabled
        ? "Paste the copied gadget into the current form."
        : copiedGadgetId
          ? "The copied gadget can no longer be pasted with the current safe patch scope."
          : "Copy a supported gadget before using Paste.",
      enabled: pasteEnabled,
      gadgetId: copiedGadgetId ?? gadget.id,
    },
  ];
}

function buildCutOriginalAction(gadgetId: string): GadgetCanvasContextMenuAction {
  return {
    kind: "cutGadget",
    label: "Cut",
    title: "This command is not implemented yet.",
    enabled: false,
    gadgetId,
  };
}

function buildAlignOriginalActions(gadgetId: string): GadgetCanvasContextMenuAction[] {
  const title = "This command is not implemented yet.";
  return [
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
      : "This command is not implemented for this gadget structure yet.",
    enabled,
    gadgetId: gadget.id
  };
}

export function resolveGadgetCanvasContextMenuActions(args: {
  gadget: GadgetContextMenuLike;
  deleteBlockedReason?: string;
  copiedGadgetId?: string;
  canPasteCopiedGadget?: boolean;
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

  actions.push(buildCutOriginalAction(gadget.id));
  actions.push(...buildClipboardOriginalActions({
    gadget,
    copiedGadgetId: args.copiedGadgetId,
    canPasteCopiedGadget: args.canPasteCopiedGadget,
  }));
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

  actions.push(...buildAlignOriginalActions(gadget.id));

  return actions;
}
