import { GADGET_KIND } from "../model";
import type { InsertableGadgetKind } from "../gadget/insert";

export type ToolboxPanelTabId = "toolbox" | "objects";

export interface ToolboxPanelItem {
  key: string;
  label: string;
  iconText: string;
  iconAsset?: string;
  kind?: InsertableGadgetKind;
  enabled: boolean;
}

export interface ToolboxPanelCategory {
  id: string;
  title: string;
  items: readonly ToolboxPanelItem[];
}

function buildIconText(label: string): string {
  const words = label
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);

  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

function item(label: string, kind?: InsertableGadgetKind, enabled = Boolean(kind), iconAsset?: string): ToolboxPanelItem {
  return {
    key: kind ?? label.replace(/\s+/g, "-"),
    label,
    iconText: buildIconText(label),
    iconAsset,
    kind,
    enabled,
  };
}

const TOOLBOX_PANEL_CATEGORIES: readonly ToolboxPanelCategory[] = [
  {
    id: "common-controls",
    title: "Common Controls",
    items: [
      item("Button", GADGET_KIND.ButtonGadget, true, "vd_buttongadget.png"),
      item("ButtonImage", GADGET_KIND.ButtonImageGadget, true, "vd_buttonimagegadget.png"),
      item("Calendar", GADGET_KIND.CalendarGadget, true, "vd_calendargadget.png"),
      item("Canvas", GADGET_KIND.CanvasGadget, true, "vd_canvasgadget.png"),
      item("CheckBox", GADGET_KIND.CheckBoxGadget, true, "vd_checkboxgadget.png"),
      item("ComboBox", GADGET_KIND.ComboBoxGadget, true, "vd_comboboxgadget.png"),
      item("Date", GADGET_KIND.DateGadget, true, "vd_dategadget.png"),
      item("Editor", GADGET_KIND.EditorGadget, true, "vd_editorgadget.png"),
      item("Explorer Combo", GADGET_KIND.ExplorerComboGadget, true, "vd_explorercombogadget.png"),
      item("Explorer List", GADGET_KIND.ExplorerListGadget, true, "vd_explorerlistgadget.png"),
      item("Explorer Tree", GADGET_KIND.ExplorerTreeGadget, true, "vd_explorertreegadget.png"),
      item("HyperLink", GADGET_KIND.HyperLinkGadget, true, "vd_hyperlinkgadget.png"),
      item("Image", GADGET_KIND.ImageGadget, true, "vd_imagegadget.png"),
      item("IP", GADGET_KIND.IPAddressGadget, true, "vd_ipaddressgadget.png"),
      item("ListIcon", GADGET_KIND.ListIconGadget, true, "vd_listicongadget.png"),
      item("ListView", GADGET_KIND.ListViewGadget, true, "vd_listviewgadget.png"),
      item("OpenGL", GADGET_KIND.OpenGLGadget),
      item("Option", GADGET_KIND.OptionGadget, true, "vd_optiongadget.png"),
      item("ProgressBar", GADGET_KIND.ProgressBarGadget, true, "vd_progressbargadget.png"),
      item("Scintilla", GADGET_KIND.ScintillaGadget),
      item("ScrollBar", GADGET_KIND.ScrollBarGadget, true, "vd_scrollbargadget.png"),
      item("Spin", GADGET_KIND.SpinGadget, true, "vd_spingadget.png"),
      item("String", GADGET_KIND.StringGadget, true, "vd_stringgadget.png"),
      item("Text", GADGET_KIND.TextGadget, true, "vd_textgadget.png"),
      item("TrackBar", GADGET_KIND.TrackBarGadget, true, "vd_trackbargadget.png"),
      item("Tree", GADGET_KIND.TreeGadget, true, "vd_treegadget.png"),
      item("Web", GADGET_KIND.WebGadget, true, "vd_webgadget.png"),
      item("WebView", GADGET_KIND.WebViewGadget, true, "vd_webgadget.png"),
    ],
  },
  {
    id: "containers",
    title: "Containers",
    items: [
      item("Container", GADGET_KIND.ContainerGadget, true, "vd_containergadget.png"),
      item("Frame", GADGET_KIND.FrameGadget, true, "vd_frame3dgadget.png"),
      item("Panel", GADGET_KIND.PanelGadget, true, "vd_panelgadget.png"),
      item("ScrollArea", GADGET_KIND.ScrollAreaGadget, true, "vd_scrollareagadget.png"),
      item("Splitter", GADGET_KIND.SplitterGadget, true, "vd_splittergadget.png"),
    ],
  },
  {
    id: "menus-toolbars",
    title: "Menus & Toolbars",
    items: [
      item("ToolBar", undefined, false, "vd_toolbar.png"),
      item("StatusBar", undefined, false, "vd_status.png"),
      item("Menu", undefined, false, "vd_menu.png"),
    ],
  },
] as const;

export function getToolboxPanelCategories(): readonly ToolboxPanelCategory[] {
  return TOOLBOX_PANEL_CATEGORIES;
}

export function canImmediateInsertFromToolbox(kind: InsertableGadgetKind): boolean {
  return kind !== GADGET_KIND.SplitterGadget;
}

export function getImmediateToolboxInsertPosition(): { x: number; y: number } {
  return { x: 10, y: 10 };
}

export function getDefaultToolboxPanelKind(): InsertableGadgetKind {
  const firstSelectable = TOOLBOX_PANEL_CATEGORIES
    .flatMap(category => category.items)
    .find(entry => entry.enabled && entry.kind);

  if (!firstSelectable?.kind) {
    throw new Error("No selectable toolbox item is configured.");
  }

  return firstSelectable.kind;
}
