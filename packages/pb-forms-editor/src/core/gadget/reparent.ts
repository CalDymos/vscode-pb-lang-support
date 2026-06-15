import { GADGET_KIND, type FormWindow, type Gadget } from "../model";
import { canHostInsertedGadgets } from "./insert";

type ReparentDialogWindowLike = Pick<FormWindow, "variable" | "id">;
type ReparentDialogGadgetLike = {
  id: string;
  kind: string;
  variable?: string;
  parentId?: string;
  gadget1Id?: string;
  gadget2Id?: string;
  items?: Array<{ text?: string; textRaw?: string }>;
};

export type GadgetReparentParentOption = {
  value: string;
  label: string;
  parentId?: string;
  itemLabels: string[];
};

function getDisplayName(value?: string): string {
  const raw = (value ?? "").trim();
  if (!raw.length) return "";
  return raw.replace(/^#/, "");
}

function getWindowLabel(windowLike: ReparentDialogWindowLike | undefined): string {
  return getDisplayName(windowLike?.variable) || getDisplayName(windowLike?.id) || "Window";
}

function getGadgetLabel(gadget: Pick<ReparentDialogGadgetLike, "variable" | "id">): string {
  return getDisplayName(gadget.variable) || getDisplayName(gadget.id) || "Gadget";
}

function collectDescendantIds(gadgets: readonly ReparentDialogGadgetLike[], rootId: string): Set<string> {
  const descendants = new Set<string>();
  const queue = [rootId];

  while (queue.length) {
    const current = queue.shift()!;
    for (const gadget of gadgets) {
      if (gadget.parentId !== current || descendants.has(gadget.id)) continue;
      descendants.add(gadget.id);
      queue.push(gadget.id);
    }
  }

  return descendants;
}

export function canOpenGadgetReparentDialog(gadget: { kind: string } | undefined): boolean {
  if (!gadget) return false;
  return gadget.kind !== GADGET_KIND.CustomGadget;
}

export function getGadgetReparentParentOptions(
  windowLike: ReparentDialogWindowLike | undefined,
  gadgets: readonly ReparentDialogGadgetLike[],
  gadgetId: string
): GadgetReparentParentOption[] {
  const blockedIds = collectDescendantIds(gadgets, gadgetId);
  blockedIds.add(gadgetId);

  const selectedGadget = gadgets.find(gadget => gadget.id === gadgetId);
  if (selectedGadget?.kind === GADGET_KIND.SplitterGadget) {
    for (const linkedId of [selectedGadget.gadget1Id, selectedGadget.gadget2Id]) {
      if (!linkedId) continue;
      blockedIds.add(linkedId);
      for (const descendantId of collectDescendantIds(gadgets, linkedId)) {
        blockedIds.add(descendantId);
      }
    }
  }

  const options: GadgetReparentParentOption[] = [
    {
      value: "window",
      label: getWindowLabel(windowLike),
      parentId: undefined,
      itemLabels: [],
    }
  ];

  for (const gadget of gadgets) {
    if (blockedIds.has(gadget.id)) continue;
    if (!canHostInsertedGadgets(gadget)) continue;
    options.push({
      value: `gadget:${gadget.id}`,
      label: getGadgetLabel(gadget),
      parentId: gadget.id,
      itemLabels: gadget.kind === GADGET_KIND.PanelGadget
        ? (gadget.items ?? []).map(item => item.text ?? item.textRaw ?? "")
        : [],
    });
  }

  return options;
}
