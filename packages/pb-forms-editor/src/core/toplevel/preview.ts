import { parsePbStringLiteral } from "../parser/pb-string";
import { quotePbString } from "../parser/tokenizer";
import type { DesignerTopLevelContainerSelection, DesignerTopLevelEntrySelection } from "./selection";
import { parseStatusBarWidth } from "../statusbar/preview";
import { MenuEntryMovePlacement } from "../../shared/menu";
import type { FormToolBarEntry } from "../model";

export type SourceLineLike = {
  line: number;
};

export type MenuEntryLike = {
  kind: string;
  level?: number;
  idRaw?: string;
  textRaw?: string;
  text?: string;
  shortcut?: string;
  iconRaw?: string;
  source?: SourceLineLike;
};

export type MenuModelLike = {
  id?: string;
  entries?: MenuEntryLike[];
};

export type ToolBarEntryLike = {
  kind: string;
  idRaw?: string;
  iconRaw?: string;
  iconId?: string;
  toggle?: boolean;
};

export type ToolBarModelLike = {
  entries?: ToolBarEntryLike[];
};

export type StatusBarFieldLike = {
  widthRaw: string;
  textRaw?: string;
  text?: string;
  flagsRaw?: string;
  progressBar?: boolean;
  progressRaw?: string;
  imageRaw?: string;
  imageId?: string;
};

export type StatusBarModelLike = {
  fields?: StatusBarFieldLike[];
};

export type PreviewRectLike = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PreviewEntryRectLike = PreviewRectLike & {
  ownerId: string;
  index: number;
};

export type PreviewMenuFooterRectLike = PreviewRectLike & {
  menuId: string;
  parentIndex: number;
};

export type PreviewMenuAddRectLike = PreviewRectLike & {
  menuId: string;
};

export type PreviewToolBarAddRectLike = PreviewRectLike & {
  toolBarId: string;
};

export type PreviewStatusBarAddRectLike = PreviewRectLike & {
  statusBarId: string;
};

export type TopLevelChromeHitLike =
  | { selection: DesignerTopLevelContainerSelection; rect: PreviewRectLike }
  | { selection: DesignerTopLevelEntrySelection; rect: PreviewEntryRectLike };


export type MenuEntryMoveTargetLike = {
  targetSourceLine: number;
  placement: MenuEntryMovePlacement;
  indicatorRect: PreviewRectLike;
  indicatorOrientation: "horizontal" | "vertical";
};

export type VisibleMenuEntryLike = {
  index: number;
  entry: MenuEntryLike;
  rect: PreviewEntryRectLike;
};

export type ToolBarPreviewInsertAction = "button" | "toggle" | "separator";
export type StatusBarPreviewInsertAction = "image" | "label" | "progress";

export type Windows7MenuBarPalette = {
  topFill: string;
  bottomFill: string;
  separatorUpper: string;
  separatorMiddle: string;
  separatorLower: string;
};

const ORIGINAL_WINDOWS7_MENU_BAR_PALETTE: Windows7MenuBarPalette = {
  topFill: "rgb(245, 245, 245)",
  bottomFill: "rgb(218, 224, 241)",
  separatorUpper: "rgb(182, 188, 204)",
  separatorMiddle: "rgb(240, 240, 240)",
  separatorLower: "rgb(160, 160, 160)",
};

type PreviewRgbColor = {
  r: number;
  g: number;
  b: number;
};

function parsePreviewRgbColor(value: string | undefined): PreviewRgbColor | null {
  if (!value) return null;
  const trimmed = value.trim();
  const rgbMatch = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(trimmed);
  if (rgbMatch) {
    return {
      r: Math.max(0, Math.min(255, Number.parseInt(rgbMatch[1] ?? "0", 10))),
      g: Math.max(0, Math.min(255, Number.parseInt(rgbMatch[2] ?? "0", 10))),
      b: Math.max(0, Math.min(255, Number.parseInt(rgbMatch[3] ?? "0", 10))),
    };
  }

  const hexMatch = /^#([0-9a-f]{6})$/i.exec(trimmed);
  if (!hexMatch) return null;

  const hex = hexMatch[1] ?? "000000";
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function formatPreviewRgbColor(color: PreviewRgbColor): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

function mixPreviewRgbColor(colorA: PreviewRgbColor, colorB: PreviewRgbColor, ratio: number): PreviewRgbColor {
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const mixChannel = (a: number, b: number) => Math.round(a + ((b - a) * clampedRatio));
  return {
    r: mixChannel(colorA.r, colorB.r),
    g: mixChannel(colorA.g, colorB.g),
    b: mixChannel(colorA.b, colorB.b),
  };
}

function averagePreviewRgbColor(colorA: PreviewRgbColor, colorB: PreviewRgbColor): PreviewRgbColor {
  return {
    r: Math.round((colorA.r + colorB.r) / 2),
    g: Math.round((colorA.g + colorB.g) / 2),
    b: Math.round((colorA.b + colorB.b) / 2),
  };
}

export function deriveWindows7MenuBarPalette(menuColor?: string, menuBarColor?: string): Windows7MenuBarPalette {
  const originalTopFill = parsePreviewRgbColor(ORIGINAL_WINDOWS7_MENU_BAR_PALETTE.topFill);
  const originalBottomFill = parsePreviewRgbColor(ORIGINAL_WINDOWS7_MENU_BAR_PALETTE.bottomFill);
  const originalSeparatorUpper = parsePreviewRgbColor(ORIGINAL_WINDOWS7_MENU_BAR_PALETTE.separatorUpper);
  const originalSeparatorMiddle = parsePreviewRgbColor(ORIGINAL_WINDOWS7_MENU_BAR_PALETTE.separatorMiddle);
  const originalSeparatorLower = parsePreviewRgbColor(ORIGINAL_WINDOWS7_MENU_BAR_PALETTE.separatorLower);
  const menu = parsePreviewRgbColor(menuColor);
  const menuBar = parsePreviewRgbColor(menuBarColor);

  if (!originalTopFill || !originalBottomFill || !originalSeparatorUpper || !originalSeparatorMiddle || !originalSeparatorLower) {
    return { ...ORIGINAL_WINDOWS7_MENU_BAR_PALETTE };
  }

  if (!menu && !menuBar) {
    return { ...ORIGINAL_WINDOWS7_MENU_BAR_PALETTE };
  }

  const resolvedMenu = menu ?? menuBar ?? originalBottomFill;
  const resolvedMenuBar = menuBar ?? menu ?? originalTopFill;
  const averageBase = averagePreviewRgbColor(resolvedMenu, resolvedMenuBar);

  return {
    topFill: formatPreviewRgbColor(mixPreviewRgbColor(resolvedMenuBar, originalTopFill, 0.75)),
    bottomFill: formatPreviewRgbColor(mixPreviewRgbColor(resolvedMenu, originalBottomFill, 0.75)),
    separatorUpper: formatPreviewRgbColor(mixPreviewRgbColor(averageBase, originalSeparatorUpper, 0.75)),
    separatorMiddle: formatPreviewRgbColor(mixPreviewRgbColor(resolvedMenuBar, originalSeparatorMiddle, 0.75)),
    separatorLower: formatPreviewRgbColor(mixPreviewRgbColor(averageBase, originalSeparatorLower, 0.75)),
  };
}

export function buildOptionalInspectorLiteralRaw(value: string): string {
  return value.length ? quotePbString(value) : "";
}

export function buildOptionalInspectorPlainValue(value: string): string | undefined {
  return value.length ? value : undefined;
}

export function canMoveWindowInCanvas(): boolean {
  return false;
}

export function canResizeWindowTopInCanvas(): boolean {
  return false;
}

export function canResizeWindowLeftInCanvas(): boolean {
  return false;
}

export function canResizeWindowRightInCanvas(): boolean {
  return true;
}

export function canResizeWindowBottomInCanvas(): boolean {
  return true;
}

export function canResizeWindowHandleInCanvas(handle: "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se"): boolean {
  const touchesTop = handle === "nw" || handle === "n" || handle === "ne";
  const touchesLeft = handle === "nw" || handle === "w" || handle === "sw";
  const touchesRight = handle === "ne" || handle === "e" || handle === "se";
  const touchesBottom = handle === "sw" || handle === "s" || handle === "se";

  if (touchesTop && !canResizeWindowTopInCanvas()) return false;
  if (touchesLeft && !canResizeWindowLeftInCanvas()) return false;
  if (touchesRight && !canResizeWindowRightInCanvas()) return false;
  if (touchesBottom && !canResizeWindowBottomInCanvas()) return false;
  return true;
}

export function unquotePbString(raw?: string): string {
  if (!raw) return "";
  return parsePbStringLiteral(raw) ?? raw.trim();
}

export function getMenuEntryLevel(entry: MenuEntryLike | undefined): number {
  return Math.max(0, entry?.level ?? 0);
}

export function getMenuPreviewLabel(entry: MenuEntryLike): string {
  if (entry.kind === "MenuBar" || entry.kind === "CloseSubMenu") return "";
  return (entry.text ?? unquotePbString(entry.textRaw) ?? entry.idRaw ?? entry.kind).trim();
}

export function getDefaultMenuItemInsertArgs(menu: MenuModelLike): { idRaw: string; textRaw: string } {
  let logicalCount = 0;
  for (const entry of menu.entries ?? []) {
    if (entry.kind === "CloseSubMenu") continue;
    logicalCount += 1;
  }

  const nextIndex = logicalCount + 1;
  return {
    idRaw: `#MenuItem_${nextIndex}`,
    textRaw: quotePbString(`MenuItem${nextIndex}`)
  };
}

export function getOpenSubMenuBalance(menu: MenuModelLike): number {
  let balance = 0;
  for (const entry of menu.entries ?? []) {
    if (entry.kind === "OpenSubMenu") {
      balance += 1;
      continue;
    }
    if (entry.kind === "CloseSubMenu") {
      balance = Math.max(0, balance - 1);
    }
  }
  return balance;
}

export function getDirectMenuChildIndices(menu: MenuModelLike, parentIndex: number): number[] {
  const entries = menu.entries ?? [];
  if (parentIndex < 0 || parentIndex >= entries.length) return [];

  const childLevel = getMenuEntryLevel(entries[parentIndex]) + 1;
  const result: number[] = [];
  for (let i = parentIndex + 1; i < entries.length; i++) {
    const entry = entries[i];
    const level = getMenuEntryLevel(entry);
    if (level < childLevel) break;
    if (level !== childLevel) continue;
    if (entry.kind === "CloseSubMenu") continue;
    result.push(i);
  }
  return result;
}

export function getMenuAncestorChain(menu: MenuModelLike, entryIndex: number): number[] {
  const entries = menu.entries ?? [];
  if (entryIndex < 0 || entryIndex >= entries.length) return [];

  const chain = [entryIndex];
  let searchIndex = entryIndex - 1;
  let level = getMenuEntryLevel(entries[entryIndex]);

  while (searchIndex >= 0 && level > 0) {
    let foundIndex = -1;
    for (let i = searchIndex; i >= 0; i--) {
      const candidateLevel = getMenuEntryLevel(entries[i]);
      if (candidateLevel < level) {
        foundIndex = i;
        break;
      }
    }
    if (foundIndex < 0) break;
    chain.push(foundIndex);
    level = getMenuEntryLevel(entries[foundIndex]);
    searchIndex = foundIndex - 1;
  }

  chain.reverse();
  return chain;
}

export function getMenuEntrySourceLine(menu: MenuModelLike, entryIndex: number): number | undefined {
  return menu.entries?.[entryIndex]?.source?.line;
}

export function getMenuEntryBlockEndIndex(entries: MenuEntryLike[], entryIndex: number): number {
  if (entryIndex < 0 || entryIndex >= entries.length) return entryIndex;

  const entryLevel = getMenuEntryLevel(entries[entryIndex]);
  let endIndex = entryIndex;
  for (let i = entryIndex + 1; i < entries.length; i++) {
    if (getMenuEntryLevel(entries[i]) <= entryLevel) {
      break;
    }
    endIndex = i;
  }

  return endIndex;
}

export function getPredictedMenuEntryMoveIndex(
  menu: MenuModelLike,
  sourceEntryIndex: number,
  targetEntryIndex: number,
  placement: MenuEntryMovePlacement
): number | null {
  const entries = menu.entries ?? [];
  if (sourceEntryIndex < 0 || sourceEntryIndex >= entries.length) return null;
  if (targetEntryIndex < 0 || targetEntryIndex >= entries.length) return null;

  const sourceEndIndex = getMenuEntryBlockEndIndex(entries, sourceEntryIndex);
  let insertIndex = placement === MenuEntryMovePlacement.Before
    ? targetEntryIndex
    : getMenuEntryBlockEndIndex(entries, targetEntryIndex) + 1;

  if (insertIndex >= sourceEntryIndex && insertIndex <= sourceEndIndex + 1) {
    return null;
  }

  const blockLength = sourceEndIndex - sourceEntryIndex + 1;
  if (sourceEntryIndex < insertIndex) {
    insertIndex -= blockLength;
  }

  return Math.max(0, insertIndex);
}

export function isBoundToolBarTooltipEntry(toolBar: ToolBarModelLike, entryIndex: number): boolean {
  const entry = toolBar.entries?.[entryIndex];
  if (!entry || entry.kind !== "ToolBarToolTip") return false;
  const entryId = entry.idRaw?.trim();
  if (!entryId) return false;

  for (let i = entryIndex - 1; i >= 0; i--) {
    const candidate = toolBar.entries?.[i];
    if (!candidate || candidate.kind === "ToolBarToolTip") continue;
    if ((candidate.idRaw?.trim() ?? "") === entryId) return true;
  }

  return false;
}

export function shouldShowToolBarStructureEntry(toolBar: ToolBarModelLike, entryIndex: number): boolean {
  const entry = toolBar.entries?.[entryIndex];
  if (!entry) return false;
  if (entry.kind !== "ToolBarToolTip") return true;
  return !isBoundToolBarTooltipEntry(toolBar, entryIndex);
}

export function getVisibleToolBarEntryCount(toolBar: ToolBarModelLike): number {
  let count = 0;
  for (let i = 0; i < (toolBar.entries?.length ?? 0); i++) {
    if (!shouldShowToolBarStructureEntry(toolBar, i)) continue;
    count += 1;
  }
  return count;
}

export function getDefaultToolBarInsertId(toolBar: ToolBarModelLike): string {
  let logicalCount = 0;
  for (const entry of toolBar.entries ?? []) {
    if (entry.kind === "ToolBarToolTip") continue;
    logicalCount += 1;
  }

  return `#Toolbar_${logicalCount}`;
}

export function canEditToolBarTooltip(entry: ToolBarEntryLike): boolean {
  return entry.kind !== "ToolBarSeparator"
    && entry.kind !== "ToolBarToolTip"
    && typeof entry.idRaw === "string"
    && entry.idRaw.trim().length > 0;
}
export function hasToolBarPreviewAssignedImage(entry: ToolBarEntryLike): boolean {
  if ((entry.iconId ?? "").trim().length > 0) {
    return true;
  }

  const iconRaw = (entry.iconRaw ?? "").trim();
  return iconRaw.length > 0 && iconRaw !== "0";
}

export function shouldShowToolBarPreviewUnselectedFrame(entry: ToolBarEntryLike, isSelected: boolean): boolean {
  if (isSelected) {
    return false;
  }

  if (entry.kind === "ToolBarSeparator" || entry.kind === "ToolBarToolTip") {
    return false;
  }

  return !hasToolBarPreviewAssignedImage(entry);
}

export function hasStatusBarPreviewAssignedImage(field: StatusBarFieldLike): boolean {
  if ((field.imageId ?? "").trim().length > 0) {
    return true;
  }

  const imageRaw = (field.imageRaw ?? "").trim();
  return imageRaw.length > 0 && imageRaw !== "0";
}


export interface SelectedMenuEntryInspectorFieldConfig {
  constantEditable: boolean;
  nameEditable: boolean;
  shortcutEditable: boolean;
  imageEditable: boolean;
  separatorChecked: boolean;
  separatorEditable: boolean;
}

export function getSelectedMenuEntryInspectorFieldConfig(
  entry: MenuEntryLike,
  canPatch: boolean
): SelectedMenuEntryInspectorFieldConfig {
  return {
    constantEditable: canPatch && entry.kind === "MenuItem",
    nameEditable: canPatch && (entry.kind === "MenuItem" || entry.kind === "MenuTitle" || entry.kind === "OpenSubMenu"),
    shortcutEditable: canPatch && entry.kind === "MenuItem",
    imageEditable: canPatch && entry.kind === "MenuItem",
    separatorChecked: entry.kind === "MenuBar",
    separatorEditable: false,
  };
}

export interface SelectedToolBarInspectorFieldConfig {
  variableEditable: boolean;
  captionLabel: string;
  captionEditable: boolean;
  imageEditable: boolean;
  toggleChecked: boolean;
  toggleEditable: boolean;
  separatorChecked: boolean;
  separatorEditable: boolean;
  selectProcParticipates: boolean;
  selectProcDisabledTitle: string;
  showTextField: boolean;
  showIconRawField: boolean;
}

export interface SelectedStatusBarInspectorFieldConfig {
  widthEditable: boolean;
  textEditable: boolean;
  currentImageEditable: boolean;
  changeImageEditable: boolean;
  progressBarEditable: boolean;
  flagsEditable: boolean;
  deleteEditable: boolean;
  showProgressValueField: boolean;
}

export interface TopLevelSelectProcEditState {
  canEdit: boolean;
  title: string;
}

export function getTopLevelSelectProcEditState(
  hasEventMenuBlock: boolean,
  idRaw: string | undefined,
  entryLabel: "menu" | "toolbar" = "menu"
): TopLevelSelectProcEditState {
  if (!idRaw || idRaw.trim().length === 0) {
    return {
      canEdit: false,
      title: entryLabel === "menu"
        ? "Only menu entries with a parsed id can be patched safely."
        : "Only toolbar entries with a parsed id can be patched safely."
    };
  }

  return {
    canEdit: true,
    title: hasEventMenuBlock
      ? "Choose an existing procedure or type a procedure name."
      : "Choose an existing procedure or type a procedure name. Writing it back still requires a parsed Select EventMenu() block in the source."
  };
}

export function getSelectedToolBarInspectorFieldConfig(
  entry: ToolBarEntryLike,
  canPatch: boolean
): SelectedToolBarInspectorFieldConfig {
  const isImageButton = entry.kind === "ToolBarImageButton";
  const isSeparator = entry.kind === "ToolBarSeparator";
  const isToolTip = entry.kind === "ToolBarToolTip";

  return {
    variableEditable: canPatch && !isSeparator,
    captionLabel: "Caption",
    captionEditable: canPatch && canEditToolBarTooltip(entry),
    imageEditable: canPatch && isImageButton,
    toggleChecked: Boolean(entry.toggle),
    toggleEditable: canPatch && isImageButton,
    separatorChecked: isSeparator,
    separatorEditable: false,
    selectProcParticipates: !isSeparator && !isToolTip,
    selectProcDisabledTitle: isToolTip
      ? "This entry type does not participate in Select EventMenu() cases."
      : "Toolbar separators are structural entries and do not participate in Select EventMenu() cases.",
    showTextField: false,
    showIconRawField: false,
  };
}

export function getSelectedStatusBarInspectorFieldConfig(canPatch = true): SelectedStatusBarInspectorFieldConfig {
  return {
    widthEditable: canPatch,
    textEditable: canPatch,
    currentImageEditable: canPatch,
    changeImageEditable: canPatch,
    progressBarEditable: canPatch,
    flagsEditable: canPatch,
    deleteEditable: canPatch,
    showProgressValueField: false,
  };
}

export function getToolBarPreviewInsertArgs(
  toolBar: ToolBarModelLike,
  action: ToolBarPreviewInsertAction
): { kind: FormToolBarEntry["kind"]; idRaw?: string; iconRaw?: string; toggle?: boolean } {
  const idRaw = getDefaultToolBarInsertId(toolBar);
  switch (action) {
    case "button":
      return { kind: "ToolBarImageButton", idRaw, iconRaw: "0" };
    case "toggle":
      return { kind: "ToolBarImageButton", idRaw, iconRaw: "0", toggle: true };
    case "separator":
      return { kind: "ToolBarSeparator" };
  }
}

export function getStatusBarPreviewInsertArgs(
  action: StatusBarPreviewInsertAction
): { widthRaw: string; textRaw?: string; imageRaw?: string; flagsRaw?: string; progressBar?: boolean; progressRaw?: string } {
  switch (action) {
    case "image":
      return { widthRaw: "96", imageRaw: "0", flagsRaw: "#PB_StatusBar_Raised" };
    case "label":
      return { widthRaw: "120", textRaw: '"StatusBarField"' };
    case "progress":
      return { widthRaw: "120", progressBar: true, progressRaw: "0" };
  }
}

export function hasPbFlag(flagsExpr: string | undefined, flag: string): boolean {
  if (!flagsExpr) return false;
  const parts = flagsExpr.split("|").map((part) => part.trim());
  return parts.includes(flag);
}

export function getStatusBarFieldWidths(
  statusBar: StatusBarModelLike,
  totalWidth: number,
  minWidth = 18
): number[] {
  let fixedWidth = 0;
  let flexibleCount = 0;
  for (const field of statusBar.fields ?? []) {
    const parsed = parseStatusBarWidth(field.widthRaw);
    if (parsed === null) {
      flexibleCount += 1;
    } else {
      fixedWidth += parsed;
    }
  }

  const remainingWidth = Math.max(0, totalWidth - fixedWidth);
  const flexibleWidth = flexibleCount > 0 ? Math.max(1, Math.floor(remainingWidth / flexibleCount)) : 0;

  return (statusBar.fields ?? []).map((field) => {
    const parsedWidth = parseStatusBarWidth(field.widthRaw);
    return Math.max(minWidth, parsedWidth ?? flexibleWidth);
  });
}

export function getMenuFlyoutPanelRect(
  menu: MenuModelLike,
  parentIndex: number,
  anchorRect: PreviewRectLike,
  measureText: (text: string) => number
): PreviewRectLike | null {
  const childIndices = getDirectMenuChildIndices(menu, parentIndex);

  let innerWidth = 0;
  let height = 20;
  for (const childIndex of childIndices) {
    const entry = menu.entries?.[childIndex];
    if (!entry) continue;
    if (entry.kind === "MenuBar") {
      height += 12;
      continue;
    }

    let textWidth = Math.ceil(measureText(getMenuPreviewLabel(entry)));
    if (entry.shortcut) {
      textWidth += Math.ceil(measureText(entry.shortcut));
    }
    textWidth += 24;
    innerWidth = Math.max(innerWidth, textWidth);
    height += 20;
  }

  const width = Math.max(100, innerWidth + 40);
  return {
    x: anchorRect.x,
    y: anchorRect.y,
    w: width,
    h: Math.max(0, height)
  };
}

export function getMenuFlyoutEntryTextLayout(
  entryRect: PreviewRectLike,
  shortcutWidth = 0
): {
  labelX: number;
  labelY: number;
  shortcutX: number;
  shortcutY: number;
} {
  return {
    labelX: entryRect.x + 24,
    labelY: entryRect.y + 14,
    shortcutX: entryRect.x + entryRect.w - 10 - Math.max(0, Math.ceil(shortcutWidth)),
    shortcutY: entryRect.y + 14,
  };
}

export function getMenuFlyoutFooterTextPosition(
  footerRect: PreviewRectLike
): { x: number; y: number } {
  return {
    x: footerRect.x + 5,
    y: footerRect.y + 14,
  };
}

export function getMenuFlyoutShortcutOpacity(): number {
  return 1;
}

export function getMenuFlyoutFooterOpacity(): number {
  return 1;
}

export function getMenuFlyoutSeparatorPreviewRect(x: number, y: number, width: number): PreviewRectLike {
  return {
    x,
    y,
    w: Math.max(0, width),
    h: 12,
  };
}

export function getMenuFlyoutSeparatorLineY(entryRect: PreviewRectLike): number {
  return entryRect.y + 6;
}

export function getMenuFlyoutAnchorRect(
  menuBarRect: PreviewRectLike,
  parentRect: PreviewRectLike,
  previousPanelRect: PreviewRectLike | null
): PreviewRectLike {
  if (previousPanelRect) {
    return {
      x: previousPanelRect.x + previousPanelRect.w,
      y: parentRect.y,
      w: 0,
      h: 0,
    };
  }

  return {
    x: parentRect.x,
    y: menuBarRect.y + menuBarRect.h,
    w: 0,
    h: 0,
  };
}

export function getToolBarSeparatorPreviewRect(x: number, y: number): PreviewRectLike {
  return {
    x,
    y,
    w: 6,
    h: 16,
  };
}

export function getToolBarSeparatorSelectedOutlineRect(entryRect: PreviewRectLike): PreviewRectLike {
  return {
    x: entryRect.x - 1,
    y: entryRect.y - 1,
    w: 8,
    h: 18,
  };
}


function rectContainsPoint(rect: PreviewRectLike, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export function resolvePreviewRectHit<T extends PreviewRectLike>(
  rect: T | null | undefined,
  x: number,
  y: number
): T | null {
  return rect && rectContainsPoint(rect, x, y) ? rect : null;
}

export function resolvePreviewRectListHit<T extends PreviewRectLike>(
  rects: T[] | undefined,
  x: number,
  y: number
): T | null {
  return rects?.find((rect) => rectContainsPoint(rect, x, y)) ?? null;
}

export function resolveTopLevelChromeHit(args: {
  x: number;
  y: number;
  windowHit: boolean;
  menuId?: string;
  menuRect?: PreviewRectLike | null;
  menuEntryRects?: PreviewEntryRectLike[];
  toolBarId?: string;
  toolBarRect?: PreviewRectLike | null;
  toolBarEntryRects?: PreviewEntryRectLike[];
  statusBarId?: string;
  statusBarRect?: PreviewRectLike | null;
  statusBarFieldRects?: PreviewEntryRectLike[];
}): TopLevelChromeHitLike | null {
  if (args.menuId) {
    const entryHit = resolvePreviewRectListHit(args.menuEntryRects, args.x, args.y);
    if (entryHit) {
      return { selection: { kind: "menuEntry", menuId: entryHit.ownerId, entryIndex: entryHit.index }, rect: entryHit };
    }
  }

  if (!args.windowHit) return null;

  if (args.statusBarId && args.statusBarRect && rectContainsPoint(args.statusBarRect, args.x, args.y)) {
    const fieldHit = resolvePreviewRectListHit(args.statusBarFieldRects, args.x, args.y);
    if (fieldHit) {
      return { selection: { kind: "statusBarField", statusBarId: fieldHit.ownerId, fieldIndex: fieldHit.index }, rect: fieldHit };
    }
    return { selection: { kind: "statusbar", id: args.statusBarId }, rect: args.statusBarRect };
  }

  if (args.menuId && args.menuRect && rectContainsPoint(args.menuRect, args.x, args.y)) {
    return { selection: { kind: "menu", id: args.menuId }, rect: args.menuRect };
  }

  if (args.toolBarId && args.toolBarRect && rectContainsPoint(args.toolBarRect, args.x, args.y)) {
    const entryHit = resolvePreviewRectListHit(args.toolBarEntryRects, args.x, args.y);
    if (entryHit) {
      return { selection: { kind: "toolBarEntry", toolBarId: entryHit.ownerId, entryIndex: entryHit.index }, rect: entryHit };
    }
    return { selection: { kind: "toolbar", id: args.toolBarId }, rect: args.toolBarRect };
  }

  return null;
}


export function getMenuEntryRect(
  entryRects: PreviewEntryRectLike[],
  menuId: string,
  entryIndex: number
): PreviewEntryRectLike | undefined {
  return entryRects.find((entry) => entry.ownerId === menuId && entry.index === entryIndex);
}

export function getMenuFooterRect(
  footerRects: PreviewMenuFooterRectLike[],
  menuId: string,
  parentIndex: number
): PreviewMenuFooterRectLike | undefined {
  return footerRects.find((entry) => entry.menuId === menuId && entry.parentIndex === parentIndex);
}

export function getMenuVisibleEntries(
  menu: MenuModelLike,
  entryRects: PreviewEntryRectLike[]
): VisibleMenuEntryLike[] {
  const result: VisibleMenuEntryLike[] = [];

  for (const [index, entry] of (menu.entries ?? []).entries()) {
    const rect = getMenuEntryRect(entryRects, menu.id ?? "", index);
    if (!rect) continue;
    result.push({ index, entry, rect });
  }

  return result;
}

export function resolveMenuFooterHit(args: {
  x: number;
  y: number;
  windowHit: boolean;
  menuRect?: PreviewRectLike | null;
  footerRects?: PreviewMenuFooterRectLike[];
}): PreviewMenuFooterRectLike | null {
  return resolvePreviewRectListHit(args.footerRects, args.x, args.y);
}

export function getMenuEntryMoveTarget(args: {
  menu: MenuModelLike;
  sourceEntryIndex: number;
  x: number;
  y: number;
  menuBarBottom: number;
  visibleEntries: VisibleMenuEntryLike[];
  footerRects: PreviewMenuFooterRectLike[];
  selectedEntryIndex?: number;
}): MenuEntryMoveTargetLike | null {
  const visibleEntries = args.visibleEntries;
  if (!visibleEntries.length) return null;

  const firstVisibleRoot = visibleEntries.find((item) => getMenuEntryLevel(item.entry) === 0);
  if (
    firstVisibleRoot
    && firstVisibleRoot.index !== args.sourceEntryIndex
    && args.x <= firstVisibleRoot.rect.x
    && args.y >= firstVisibleRoot.rect.y
    && args.y < firstVisibleRoot.rect.y + firstVisibleRoot.rect.h
  ) {
    const targetSourceLine = getMenuEntrySourceLine(args.menu, firstVisibleRoot.index);
    if (typeof targetSourceLine === "number") {
      return {
        targetSourceLine,
        placement: MenuEntryMovePlacement.Before,
        indicatorRect: { x: firstVisibleRoot.rect.x - 1, y: firstVisibleRoot.rect.y, w: 2, h: firstVisibleRoot.rect.h },
        indicatorOrientation: "vertical"
      };
    }
  }

  let previousLevel = 0;
  for (const visibleEntry of visibleEntries) {
    const level = getMenuEntryLevel(visibleEntry.entry);
    const rect = visibleEntry.rect;
    const targetSourceLine = getMenuEntrySourceLine(args.menu, visibleEntry.index);

    if (
      typeof targetSourceLine === "number"
      && visibleEntry.index !== args.sourceEntryIndex
      && level > previousLevel
      && args.y >= rect.y - 1
      && args.y < rect.y + 1
      && args.x > rect.x
      && args.x <= rect.x + rect.w
    ) {
      return {
        targetSourceLine,
        placement: MenuEntryMovePlacement.Before,
        indicatorRect: { x: rect.x, y: rect.y - 1, w: rect.w, h: 2 },
        indicatorOrientation: "horizontal"
      };
    }

    if (
      typeof targetSourceLine === "number"
      && args.x > rect.x
      && args.x <= rect.x + rect.w
      && args.y > rect.y + 1
      && args.y <= rect.y + rect.h
    ) {
      return {
        targetSourceLine,
        placement: MenuEntryMovePlacement.After,
        indicatorRect: level === 0
          ? { x: rect.x + rect.w, y: rect.y, w: 2, h: rect.h }
          : { x: rect.x, y: rect.y + rect.h, w: rect.w, h: 2 },
        indicatorOrientation: level === 0 ? "vertical" : "horizontal"
      };
    }

    if (visibleEntry.entry.kind === "OpenSubMenu") {
      const footerRect = getMenuFooterRect(args.footerRects, args.menu.id ?? "", visibleEntry.index);
      const childIndices = getDirectMenuChildIndices(args.menu, visibleEntry.index);
      const isSelectedEmptyOpenSubmenu = visibleEntry.index === args.selectedEntryIndex;
      if (
        footerRect
        && childIndices.length === 0
        && typeof targetSourceLine === "number"
        && visibleEntry.index !== args.sourceEntryIndex
        && isSelectedEmptyOpenSubmenu
        && args.x > rect.x + rect.w
        && args.y > args.menuBarBottom
      ) {
        return {
          targetSourceLine,
          placement: MenuEntryMovePlacement.AppendChild,
          indicatorRect: { x: rect.x + rect.w, y: rect.y, w: footerRect.w, h: 2 },
          indicatorOrientation: "horizontal"
        };
      }
    }

    previousLevel = level;
  }

  return null;
}
