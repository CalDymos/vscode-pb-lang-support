import { GADGET_KIND } from "../model";

export interface DeletePlanGadgetLike {
  id: string;
  parentId?: string;
  kind?: string;
  gadget1Id?: string;
  gadget2Id?: string;
  splitterId?: string;
}

export interface OriginalDeletePlan {
  requestedIds: Set<string>;
  deletedIds: Set<string>;
  skippedIds: Set<string>;
}

export interface GadgetKeyboardDeleteRequest {
  key: string;
  editableTarget: boolean;
  hasBlockingDialog: boolean;
  hasPendingInsertGadget: boolean;
  selectionKind?: string;
}

export function shouldOpenGadgetKeyboardDeleteDialog(request: GadgetKeyboardDeleteRequest): boolean {
  return (request.key === "Delete" || request.key === "Backspace")
    && !request.editableTarget
    && !request.hasBlockingDialog
    && !request.hasPendingInsertGadget
    && request.selectionKind === "gadget";
}

export function collectRequestedGadgetDeleteIds<T extends DeletePlanGadgetLike>(gadgets: readonly T[], rootId: string): Set<string> {
  const requested = new Set<string>();

  const visit = (gadgetId: string): void => {
    if (requested.has(gadgetId)) return;
    requested.add(gadgetId);

    for (const gadget of gadgets) {
      if (gadget.parentId === gadgetId) {
        visit(gadget.id);
      }
    }
  };

  visit(rootId);
  return requested;
}

export function buildOriginalGadgetDeletePlan<T extends DeletePlanGadgetLike>(gadgets: readonly T[], rootId: string): OriginalDeletePlan {
  const requestedIds = collectRequestedGadgetDeleteIds(gadgets, rootId);
  const deletedIds = new Set<string>();
  const skippedIds = new Set<string>();
  const splitterOwners = new Map<string, string>();

  for (const gadget of gadgets) {
    if (gadget.splitterId) {
      splitterOwners.set(gadget.id, gadget.splitterId);
    }
  }

  const orderedRequested = gadgets.filter(gadget => requestedIds.has(gadget.id));
  const requestedSplitterIds = new Set(
    orderedRequested
      .filter(gadget => gadget.kind === GADGET_KIND.SplitterGadget)
      .map(gadget => gadget.id)
  );

  for (const gadget of orderedRequested) {
    const ownerId = splitterOwners.get(gadget.id);
    if (ownerId && !requestedSplitterIds.has(ownerId)) {
      skippedIds.add(gadget.id);
      continue;
    }

    deletedIds.add(gadget.id);
  }

  return {
    requestedIds,
    deletedIds,
    skippedIds,
  };
}
