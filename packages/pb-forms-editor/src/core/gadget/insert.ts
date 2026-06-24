import { hasPbFlag } from "../toplevel/preview";
import { GADGET_KIND, PB_ANY, type Gadget, type GadgetKind } from "../model";

export const PBFD_INSERTABLE_GADGET_KINDS = [
  GADGET_KIND.ButtonGadget,
  GADGET_KIND.ButtonImageGadget,
  GADGET_KIND.StringGadget,
  GADGET_KIND.TextGadget,
  GADGET_KIND.CheckBoxGadget,
  GADGET_KIND.OptionGadget,
  GADGET_KIND.FrameGadget,
  GADGET_KIND.ComboBoxGadget,
  GADGET_KIND.ListViewGadget,
  GADGET_KIND.ListIconGadget,
  GADGET_KIND.TreeGadget,
  GADGET_KIND.EditorGadget,
  GADGET_KIND.SpinGadget,
  GADGET_KIND.TrackBarGadget,
  GADGET_KIND.ProgressBarGadget,
  GADGET_KIND.ImageGadget,
  GADGET_KIND.HyperLinkGadget,
  GADGET_KIND.CalendarGadget,
  GADGET_KIND.DateGadget,
  GADGET_KIND.ContainerGadget,
  GADGET_KIND.PanelGadget,
  GADGET_KIND.ScrollAreaGadget,
  GADGET_KIND.SplitterGadget,
  GADGET_KIND.WebViewGadget,
  GADGET_KIND.WebGadget,
  GADGET_KIND.OpenGLGadget,
  GADGET_KIND.CanvasGadget,
  GADGET_KIND.ExplorerTreeGadget,
  GADGET_KIND.ExplorerListGadget,
  GADGET_KIND.ExplorerComboGadget,
  GADGET_KIND.IPAddressGadget,
  GADGET_KIND.ScrollBarGadget,
  GADGET_KIND.ScintillaGadget,
] as const satisfies readonly GadgetKind[];

export type InsertableGadgetKind = typeof PBFD_INSERTABLE_GADGET_KINDS[number];

export type GadgetDrawInsertPoint = {
  x: number;
  y: number;
  parentId?: string;
  parentItem?: number;
};

export type GadgetDrawInsertRect = {
  x: number;
  y: number;
  w: number;
  h: number;
  parentId?: string;
  parentItem?: number;
};

function hasSameDrawInsertParent(a: GadgetDrawInsertPoint, b: GadgetDrawInsertPoint): boolean {
  return a.parentId === b.parentId && a.parentItem === b.parentItem;
}

export function buildGadgetDrawInsertRect(
  start: GadgetDrawInsertPoint,
  end: GadgetDrawInsertPoint
): GadgetDrawInsertRect | undefined {
  if (!hasSameDrawInsertParent(start, end)) return undefined;

  const x1 = Math.trunc(start.x);
  const y1 = Math.trunc(start.y);
  const x2 = Math.trunc(end.x);
  const y2 = Math.trunc(end.y);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);
  if (w <= 0 || h <= 0) return undefined;

  const rect: GadgetDrawInsertRect = {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w,
    h,
  };
  if (start.parentId !== undefined) rect.parentId = start.parentId;
  if (start.parentItem !== undefined) rect.parentItem = start.parentItem;
  return rect;
}

type GadgetIdentityLike = Pick<Gadget, "id" | "pbAny" | "variable" | "firstParam">;

const INSERT_PREFIX_BY_KIND: Record<InsertableGadgetKind, string> = {
  [GADGET_KIND.ButtonGadget]: "Button_",
  [GADGET_KIND.ButtonImageGadget]: "ButtonImage_",
  [GADGET_KIND.StringGadget]: "String_",
  [GADGET_KIND.TextGadget]: "Text_",
  [GADGET_KIND.CheckBoxGadget]: "Checkbox_",
  [GADGET_KIND.OptionGadget]: "Option_",
  [GADGET_KIND.FrameGadget]: "Frame3D_",
  [GADGET_KIND.ComboBoxGadget]: "Combo_",
  [GADGET_KIND.ListViewGadget]: "ListView_",
  [GADGET_KIND.ListIconGadget]: "ListIcon_",
  [GADGET_KIND.TreeGadget]: "Tree_",
  [GADGET_KIND.EditorGadget]: "Editor_",
  [GADGET_KIND.SpinGadget]: "Spin_",
  [GADGET_KIND.TrackBarGadget]: "TrackBar_",
  [GADGET_KIND.ProgressBarGadget]: "ProgressBar_",
  [GADGET_KIND.ImageGadget]: "Image_",
  [GADGET_KIND.HyperLinkGadget]: "Hyperlink_",
  [GADGET_KIND.CalendarGadget]: "Calendar_",
  [GADGET_KIND.DateGadget]: "Date_",
  [GADGET_KIND.ContainerGadget]: "Container_",
  [GADGET_KIND.PanelGadget]: "Panel_",
  [GADGET_KIND.ScrollAreaGadget]: "ScrollArea_",
  [GADGET_KIND.SplitterGadget]: "Splitter_",
  [GADGET_KIND.WebViewGadget]: "WebView_",
  [GADGET_KIND.WebGadget]: "WebView_",
  [GADGET_KIND.OpenGLGadget]: "OpenGL_",
  [GADGET_KIND.CanvasGadget]: "Canvas_",
  [GADGET_KIND.ExplorerTreeGadget]: "ExplorerTree_",
  [GADGET_KIND.ExplorerListGadget]: "ExplorerList_",
  [GADGET_KIND.ExplorerComboGadget]: "ExplorerCombo_",
  [GADGET_KIND.IPAddressGadget]: "IP_",
  [GADGET_KIND.ScrollBarGadget]: "Scrollbar_",
  [GADGET_KIND.ScintillaGadget]: "Scintilla_",
};

const INSERT_LABEL_BY_KIND: Record<InsertableGadgetKind, string> = {
  [GADGET_KIND.ButtonGadget]: "Button",
  [GADGET_KIND.ButtonImageGadget]: "ButtonImage",
  [GADGET_KIND.StringGadget]: "String",
  [GADGET_KIND.TextGadget]: "Text",
  [GADGET_KIND.CheckBoxGadget]: "CheckBox",
  [GADGET_KIND.OptionGadget]: "Option",
  [GADGET_KIND.FrameGadget]: "Frame",
  [GADGET_KIND.ComboBoxGadget]: "ComboBox",
  [GADGET_KIND.ListViewGadget]: "ListView",
  [GADGET_KIND.ListIconGadget]: "ListIcon",
  [GADGET_KIND.TreeGadget]: "Tree",
  [GADGET_KIND.EditorGadget]: "Editor",
  [GADGET_KIND.SpinGadget]: "Spin",
  [GADGET_KIND.TrackBarGadget]: "TrackBar",
  [GADGET_KIND.ProgressBarGadget]: "ProgressBar",
  [GADGET_KIND.ImageGadget]: "Image",
  [GADGET_KIND.HyperLinkGadget]: "HyperLink",
  [GADGET_KIND.CalendarGadget]: "Calendar",
  [GADGET_KIND.DateGadget]: "Date",
  [GADGET_KIND.ContainerGadget]: "Container",
  [GADGET_KIND.PanelGadget]: "Panel",
  [GADGET_KIND.ScrollAreaGadget]: "ScrollArea",
  [GADGET_KIND.SplitterGadget]: "Splitter",
  [GADGET_KIND.WebViewGadget]: "WebView",
  [GADGET_KIND.WebGadget]: "Web",
  [GADGET_KIND.OpenGLGadget]: "OpenGL",
  [GADGET_KIND.CanvasGadget]: "Canvas",
  [GADGET_KIND.ExplorerTreeGadget]: "ExplorerTree",
  [GADGET_KIND.ExplorerListGadget]: "ExplorerList",
  [GADGET_KIND.ExplorerComboGadget]: "ExplorerCombo",
  [GADGET_KIND.IPAddressGadget]: "IPAddress",
  [GADGET_KIND.ScrollBarGadget]: "ScrollBar",
  [GADGET_KIND.ScintillaGadget]: "Scintilla",
};

export type InsertedGadgetIdentity = {
  name: string;
  id: string;
  idRaw: string;
  firstParam: string;
  variable?: string;
  assignedVar?: string;
  pbAny: boolean;
};

export function isInsertableGadgetKind(kind: string): kind is InsertableGadgetKind {
  return (PBFD_INSERTABLE_GADGET_KINDS as readonly string[]).includes(kind);
}

export function getInsertableGadgetKinds(): readonly InsertableGadgetKind[] {
  return PBFD_INSERTABLE_GADGET_KINDS;
}

export function getGadgetInsertPrefix(kind: InsertableGadgetKind): string {
  return INSERT_PREFIX_BY_KIND[kind];
}

export function getGadgetInsertLabel(kind: InsertableGadgetKind): string {
  return INSERT_LABEL_BY_KIND[kind];
}

export function canHostInsertedGadgets(gadget: { kind: string; flagsExpr?: string } | undefined): boolean {
  if (!gadget) return false;
  return gadget.kind === GADGET_KIND.ContainerGadget
    || gadget.kind === GADGET_KIND.PanelGadget
    || gadget.kind === GADGET_KIND.ScrollAreaGadget
    || (gadget.kind === GADGET_KIND.FrameGadget && hasPbFlag(gadget.flagsExpr, "#PB_Frame_Container"));
}

function stripLeadingHash(value: string | undefined): string {
  return (value ?? "").trim().replace(/^#/, "");
}

function collectExistingGadgetNames(gadgets: readonly GadgetIdentityLike[]): Set<string> {
  const names = new Set<string>();
  for (const gadget of gadgets) {
    const candidates = [
      stripLeadingHash(gadget.variable),
      stripLeadingHash(gadget.firstParam),
      stripLeadingHash(gadget.id),
    ];
    for (const candidate of candidates) {
      if (candidate.length) names.add(candidate);
    }
  }
  return names;
}

function getNextNameForPrefix(prefix: string, existingNames: Set<string>): string {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${escapedPrefix}(\\d+)$`);
  let nextIndex = 0;
  for (const name of existingNames) {
    const match = re.exec(name);
    if (!match) continue;
    const value = Number.parseInt(match[1] ?? "", 10);
    if (Number.isFinite(value)) nextIndex = Math.max(nextIndex, value + 1);
  }

  while (existingNames.has(`${prefix}${nextIndex}`)) {
    nextIndex += 1;
  }

  return `${prefix}${nextIndex}`;
}

const INSERTED_GADGET_AMBIGUOUS_EMPTY_TEXT_KINDS: ReadonlySet<InsertableGadgetKind> = new Set([
  GADGET_KIND.ButtonGadget,
  GADGET_KIND.CheckBoxGadget,
  GADGET_KIND.DateGadget,
  GADGET_KIND.ExplorerComboGadget,
  GADGET_KIND.ExplorerListGadget,
  GADGET_KIND.ExplorerTreeGadget,
  GADGET_KIND.FrameGadget,
  GADGET_KIND.HyperLinkGadget,
  GADGET_KIND.OptionGadget,
  GADGET_KIND.StringGadget,
  GADGET_KIND.TextGadget,
  GADGET_KIND.WebGadget
]);

export function shouldInsertGadgetAsPbAny(gadgets: readonly GadgetIdentityLike[], preferPbAnyByDefault?: boolean): boolean {
  if (typeof preferPbAnyByDefault === "boolean") {
    return preferPbAnyByDefault;
  }

  const hasPbAny = gadgets.some(gadget => gadget.pbAny);
  const hasEnum = gadgets.some(gadget => !gadget.pbAny);
  return hasPbAny && !hasEnum;
}

export function insertedGadgetHasAmbiguousEmptyTextDefault(kind: string | undefined): kind is InsertableGadgetKind {
  return typeof kind === "string" && INSERTED_GADGET_AMBIGUOUS_EMPTY_TEXT_KINDS.has(kind as InsertableGadgetKind);
}

export function buildInsertedGadgetIdentity(
  kind: InsertableGadgetKind,
  gadgets: readonly GadgetIdentityLike[],
  pbAny: boolean
): InsertedGadgetIdentity {
  const name = getNextNameForPrefix(getGadgetInsertPrefix(kind), collectExistingGadgetNames(gadgets));
  if (pbAny) {
    return {
      name,
      id: name,
      idRaw: PB_ANY,
      firstParam: PB_ANY,
      variable: name,
      assignedVar: name,
      pbAny: true,
    };
  }

  const enumId = `#${name}`;
  return {
    name,
    id: enumId,
    idRaw: enumId,
    firstParam: enumId,
    variable: name,
    pbAny: false,
  };
}
