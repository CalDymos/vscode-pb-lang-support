import { parsePbWindowReference } from "../parser/pb-window-reference";
import type { PreviewOsSkin, PreviewPlatform } from "../utils/form-settings-runtime";

export const WINDOW_KNOWN_FLAGS = [
  "#PB_Window_SystemMenu",
  "#PB_Window_MinimizeGadget",
  "#PB_Window_MaximizeGadget",
  "#PB_Window_SizeGadget",
  "#PB_Window_Invisible",
  "#PB_Window_TitleBar",
  "#PB_Window_Tool",
  "#PB_Window_BorderLess",
  "#PB_Window_ScreenCentered",
  "#PB_Window_WindowCentered",
  "#PB_Window_Maximize",
  "#PB_Window_Minimize",
  "#PB_Window_NoGadgets",
  "#PB_Window_NoActivate",
] as const;

export const WINDOW_POSITION_IGNORE_LITERAL = "#PB_Ignore";

const WINDOW_KNOWN_FLAG_SET = new Set<string>(WINDOW_KNOWN_FLAGS);
const WINDOW_TITLEBAR_PREVIEW_FLAGS = new Set<string>([
  "#PB_Window_SystemMenu",
  "#PB_Window_TitleBar",
]);

const WINDOW_TITLEBAR_MINIMIZE_PREVIEW_FLAG = "#PB_Window_MinimizeGadget";
const WINDOW_TITLEBAR_MAXIMIZE_PREVIEW_FLAG = "#PB_Window_MaximizeGadget";

export type WindowPreviewTitleButtons = {
  showClose: boolean;
  showMinimize: boolean;
  showMaximize: boolean;
};

export type WindowPreviewPlatformSkin = PreviewPlatform;
export type WindowPreviewOsSkin = PreviewOsSkin;
export type WindowPreviewTitleButtonKind = "minimize" | "maximize" | "close";
export type WindowPreviewTitleButtonSlot = {
  kind: WindowPreviewTitleButtonKind;
  enabled: boolean;
};
export type WindowPreviewTitleButtonLayout = {
  buttonSide: "left" | "right";
  titleAlignment: "left" | "center";
  slots: WindowPreviewTitleButtonSlot[];
};

export type WindowPreviewTitleBarDecoration = {
  backgroundStyle: "default" | "macos-compact" | "macos-toolbar" | "linux-dark";
  buttonStyle: "default" | "macos-circles" | "linux-glyphs";
  showFrameBorder: boolean;
  showBottomSeparator: boolean;
  showExtraBottomSeparator: boolean;
  drawShadowedTitle: boolean;
  useLightForeground: boolean;
};

export type WindowPreviewTitleBarMetrics = {
  buttonInsetX: number;
  buttonOffsetY: number;
  buttonGap: number;
  titleOffsetY: number;
  iconInsetX: number;
  iconOffsetY: number;
};

export type WindowPreviewTitleButtonSize = {
  width: number;
  height: number;
};

export type WindowPreviewTitleButtonAssetKind = "macClose" | "macMinimize" | "macMaximize" | "macDisabled" | "linuxClose" | "linuxMinimize" | "linuxMaximize";

export type WindowPreviewTitleIconSize = {
  width: number;
  height: number;
};

export type WindowPreviewToolBarDecoration = {
  backgroundStyle: "windows-light" | "macos-gradient" | "linux-light";
  showFrameBorder: boolean;
  showBottomSeparator: boolean;
  useDarkBottomSeparator: boolean;
  separatorColorStyle: "toolbar-dark" | "none";
  showUnselectedEntryFrame: boolean;
  selectedOutlineColorStyle: "black";
  itemInsetX: number;
  itemInsetY: number;
};

export type WindowPreviewStatusBarDecoration = {
  backgroundStyle: "macos-gradient" | "transparent";
  showRoundedBackground: boolean;
  showTopSeparator: boolean;
  topSeparatorStyle: "macos-dark" | "light";
  showFieldSeparators: boolean;
  textColorStyle: "black";
  selectedOutlineColorStyle: "black";
  fieldInsetX: number;
  fieldInsetY: number;
  widthAdjustment: number;
};

export type WindowPreviewStatusBarProgressDecoration = {
  trackShape: "rect" | "rounded";
  trackRadius: number;
  trackInsetX: number;
  trackInsetY: number;
  trackColorStyle: "default" | "windows8";
  fillColorStyle: "default" | "windows8";
  borderColorStyle: "default" | "windows8";
};

export type WindowPreviewMenuBarDecoration = {
  backgroundStyle: "macos-gradient" | "windows7-layered" | "windows8-light" | "linux-light";
  showTopSeparator: boolean;
  topSeparatorStyle: "macos-dark" | "none";
  bottomSeparatorStyle: "macos-dark" | "windows7-triple" | "windows8-light" | "linux-light";
  itemInsetX: number;
  itemInsetY: number;
  itemSpacing: number;
  useSelectedOutline: boolean;
  textColorStyle: "black";
  outlineColorStyle: "black";
};

export type WindowPreviewMenuFlyoutDecoration = {
  backgroundStyle: "white";
  borderStyle: "light";
  separatorStyle: "light";
  useSelectedOutline: boolean;
  showEntryHoverFill: boolean;
  textColorStyle: "black";
  outlineColorStyle: "black";
};

export type WindowPreviewAddIconMetrics = {
  width: number;
  height: number;
};

export type WindowPreviewMenuSubmenuIconMetrics = {
  width: number;
  height: number;
  offsetRight: number;
  offsetY: number;
};

export type WindowPreviewMenuRootEntryRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type WindowPreviewBodyDecoration = {
  backgroundStyle: "default" | "linux-light" | "macos-light" | "windows7-frame" | "windows8-frame";
  useRoundedTopFill: boolean;
  roundedTopRadius: number;
  showClientBorder: boolean;
  clientBorderStyle: "none" | "linux-dark" | "windows7-inner" | "windows8-inner";
  showBodyOutline: boolean;
  bodyOutlineStyle: "none" | "macos-light";
};

export type WindowPreviewFrameDecoration = {
  borderStyle: "default" | "macos-rounded" | "windows7-rounded" | "none";
  borderRadius: number;
  strokeColorStyle: "focus" | "macos-dark" | "windows7-dark" | "windows8-blue";
  strokeAlpha: number;
};

export type WindowPreviewFrameStrokeRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export const WINDOW_PREVIEW_PAGE_PADDING = 10;

export type WindowPreviewCanvasOrigin = {
  x: number;
  y: number;
};

export function getWindowPreviewCanvasOrigin(windowX: number, windowY: number): WindowPreviewCanvasOrigin {
  return {
    x: WINDOW_PREVIEW_PAGE_PADDING + Math.trunc(windowX),
    y: WINDOW_PREVIEW_PAGE_PADDING + Math.trunc(windowY),
  };
}

function splitFlags(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split('|')
    .map(part => part.trim())
    .filter(Boolean);
}

function isIntegerLiteral(raw: string): boolean {
  return /^-?\d+$/.test(raw);
}

export function parseWindowCustomFlagsInput(raw: string | undefined): string[] {
  const out: string[] = [];
  for (const flag of splitFlags(raw)) {
    if (WINDOW_KNOWN_FLAG_SET.has(flag)) continue;
    if (out.includes(flag)) continue;
    out.push(flag);
  }
  return out;
}

export function buildWindowFlagsExpr(enabledKnownFlags: readonly string[], customFlagsRaw?: string): string | undefined {
  const orderedKnown = WINDOW_KNOWN_FLAGS.filter(flag => enabledKnownFlags.includes(flag));
  const custom = parseWindowCustomFlagsInput(customFlagsRaw);
  const parts = [...orderedKnown, ...custom];
  return parts.length ? parts.join(' | ') : undefined;
}

export function getWindowPositionInspectorValue(raw: string | undefined, value: number): string {
  const trimmed = (raw ?? "").trim();
  if (trimmed === WINDOW_POSITION_IGNORE_LITERAL || value === -65535) {
    return WINDOW_POSITION_IGNORE_LITERAL;
  }

  if (isIntegerLiteral(trimmed)) {
    return trimmed;
  }

  return String(Math.trunc(value));
}

export type ParsedWindowVariableNameInput =
  | { ok: true; value: string }
  | { ok: false; fallbackValue: string };

export function getWindowVariableInspectorValue(currentValue: string | undefined): string {
  return currentValue ?? '';
}

export type ParsedWindowParentInput = {
  raw: string;
  storedValue: string | undefined;
};

export type WindowBaseRowsFieldConfig = {
  visible: boolean;
  valueEditable: boolean;
  title: string;
};

export type WindowParentFieldConfig = {
  visible: boolean;
  valueEditable: boolean;
  rawExpressionToggleAvailable: boolean;
  title: string;
  rawExpressionTitle: string;
};

export type WindowEnumValueFieldConfig = {
  visible: boolean;
  valueEditable: boolean;
  originalStoragePolicy: "split-explicit-id-from-variable-cell";
  title: string;
};

export type WindowColorFieldConfig = {
  visible: boolean;
  valueEditablePolicy: "color-picker-with-remove";
  rawDisplayEditable: boolean;
  rawExpressionPolicy: "preserve-readonly";
  pickerRawFormat: "RGB_LITERAL";
  title: string;
};

export type WindowGenerateEventProcFieldConfig = {
  visible: boolean;
  valueEditable: boolean;
  title: string;
};

export type WindowGenerateEventProcEditState = {
  valueEditable: boolean;
  title: string;
};

export type WindowBooleanFieldConfig = {
  visible: boolean;
  checkedValue: "1";
  uncheckedValue: "";
  zeroLinePolicy: "remove-managed-line";
  title: string;
};

export type WindowSelectProcFieldConfig = {
  visible: boolean;
  valueEditable: boolean;
  preservesGridString: boolean;
  title: string;
  placeholder: string;
};

export type WindowConstantsFieldConfig = {
  visible: boolean;
  knownFlags: readonly string[];
  customFlagsEditable: boolean;
  customFlagsKnownFlagPolicy: "drop-known-flags";
  customFlagsDuplicatePolicy: "drop-duplicates";
  customFlagsSeparator: " | ";
  title: string;
};

export function getWindowBaseRowsFieldConfig(): WindowBaseRowsFieldConfig {
  return {
    visible: true,
    valueEditable: true,
    title: "Original FD_InitBasicPropGridRows() window rows are always visible for windows.",
  };
}

export function getWindowParentFieldConfig(): WindowParentFieldConfig {
  return {
    visible: true,
    valueEditable: true,
    rawExpressionToggleAvailable: true,
    title: "Enter the parent window expression. Disable the checkbox to emit WindowID(...); enable it to write the expression raw.",
    rawExpressionTitle: "When enabled, the parent is written directly as the last OpenWindow(...) argument. When disabled, the editor emits WindowID(...), matching the original default path.",
  };
}

export function getWindowEnumValueFieldConfig(pbAny: boolean): WindowEnumValueFieldConfig {
  return {
    visible: !pbAny,
    valueEditable: true,
    originalStoragePolicy: "split-explicit-id-from-variable-cell",
    title: "Edits the explicit numeric ID that the original inspector stores in the Variable row as Name=ID.",
  };
}

export function getWindowColorFieldConfig(): WindowColorFieldConfig {
  return {
    visible: true,
    valueEditablePolicy: "color-picker-with-remove",
    rawDisplayEditable: false,
    rawExpressionPolicy: "preserve-readonly",
    pickerRawFormat: "RGB_LITERAL",
    title: "Use the color picker to choose a window color, or Remove to clear it.",
  };
}

export function getWindowGenerateEventProcFieldConfig(): WindowGenerateEventProcFieldConfig {
  return {
    visible: true,
    valueEditable: true,
    title: "Controls whether the generated window event procedure is emitted for this window.",
  };
}

export function getWindowGenerateEventProcEditState(
  generateEventLoop: boolean,
  hasEventMenuBlock: boolean,
  hasEventGadgetCaseBranches: boolean
): WindowGenerateEventProcEditState {
  if (generateEventLoop && hasEventMenuBlock) {
    return {
      valueEditable: false,
      title: "Cannot disable while a parsed Select EventMenu() block exists. Remove menu/toolbar event bindings first.",
    };
  }

  if (generateEventLoop && hasEventGadgetCaseBranches) {
    return {
      valueEditable: false,
      title: "Cannot disable while Select EventGadget() contains Case branches.",
    };
  }

  return {
    valueEditable: true,
    title: "Controls whether the generated window event procedure is emitted for this window.",
  };
}

export function getWindowHiddenFieldConfig(): WindowBooleanFieldConfig {
  return {
    visible: true,
    checkedValue: "1",
    uncheckedValue: "",
    zeroLinePolicy: "remove-managed-line",
    title: "HideWindow(...) is emitted only when checked; unchecked removes the managed line.",
  };
}

export function getWindowDisabledFieldConfig(): WindowBooleanFieldConfig {
  return {
    visible: true,
    checkedValue: "1",
    uncheckedValue: "",
    zeroLinePolicy: "remove-managed-line",
    title: "DisableWindow(...) is emitted only when checked; unchecked removes the managed line.",
  };
}

export function getWindowSelectProcFieldConfig(): WindowSelectProcFieldConfig {
  return {
    visible: true,
    valueEditable: true,
    preservesGridString: true,
    title: "Choose an existing procedure or type a procedure name.",
    placeholder: "Type or pick a procedure",
  };
}

export function getWindowConstantsFieldConfig(): WindowConstantsFieldConfig {
  return {
    visible: true,
    knownFlags: WINDOW_KNOWN_FLAGS,
    customFlagsEditable: true,
    customFlagsKnownFlagPolicy: "drop-known-flags",
    customFlagsDuplicatePolicy: "drop-duplicates",
    customFlagsSeparator: " | ",
    title: "Window flags are written through the OpenWindow(...) flags argument in original declaration order.",
  };
}

function unwrapWindowIdParent(raw: string): string | undefined {
  return parsePbWindowReference(raw)?.innerRaw;
}

export function getWindowParentInspectorValue(parentRaw: string | undefined, normalizedParent: string | undefined): string {
  if (typeof parentRaw === 'string') {
    const unwrapped = unwrapWindowIdParent(parentRaw);
    if (unwrapped !== undefined) {
      return unwrapped;
    }
    return parentRaw;
  }

  if (!normalizedParent) {
    return '';
  }

  return normalizedParent.startsWith('=') ? normalizedParent.slice(1) : normalizedParent;
}

export function getWindowParentAsRawExpression(parentRaw: string | undefined, normalizedParent: string | undefined): boolean {
  if (typeof parentRaw === 'string') {
    return unwrapWindowIdParent(parentRaw) === undefined && parentRaw.length > 0;
  }

  return Boolean(normalizedParent?.startsWith('='));
}

export function getWindowParentAsRawExpressionWithOverride(
  parentRaw: string | undefined,
  normalizedParent: string | undefined,
  override: boolean | undefined
): boolean {
  if (typeof override === 'boolean') {
    return override;
  }

  return getWindowParentAsRawExpression(parentRaw, normalizedParent);
}

export type ParsedWindowEventProcInput = {
  raw: string;
  storedValue: string | undefined;
};

export function parseWindowParentInspectorInput(raw: string, parentAsRawExpression: boolean): ParsedWindowParentInput {
  if (!raw.length) {
    return {
      raw: '',
      storedValue: undefined,
    };
  }

  return {
    raw: parentAsRawExpression ? raw : `WindowID(${raw})`,
    storedValue: parentAsRawExpression ? `=${raw}` : raw,
  };
}

export function parseWindowEventProcInspectorInput(raw: string): ParsedWindowEventProcInput {
  return {
    raw,
    storedValue: raw.length ? raw : undefined,
  };
}

export function parseWindowVariableNameInspectorInput(raw: string, currentValue: string): ParsedWindowVariableNameInput {
  if (!raw.length) {
    return {
      ok: false,
      fallbackValue: currentValue,
    };
  }

  return {
    ok: true,
    value: raw,
  };
}

export function hasWindowPreviewTitleBar(flagsExpr: string | undefined): boolean {
  for (const flag of splitFlags(flagsExpr)) {
    if (WINDOW_TITLEBAR_PREVIEW_FLAGS.has(flag)) {
      return true;
    }
  }

  return false;
}

export function getWindowPreviewTitleBarHeight(flagsExpr: string | undefined, configuredHeight: number): number {
  if (!hasWindowPreviewTitleBar(flagsExpr)) {
    return 0;
  }

  return Math.max(0, Math.trunc(configuredHeight));
}

function normalizeWindowPreviewPadding(configuredPadding: number): number {
  return Math.max(0, Math.trunc(configuredPadding));
}

export function getWindowPreviewClientSidePadding(
  platformSkin: WindowPreviewPlatformSkin | undefined,
  configuredPadding: number
): number {
  return platformSkin === "windows" ? normalizeWindowPreviewPadding(configuredPadding) : 0;
}

export function getWindowPreviewClientBottomPadding(
  platformSkin: WindowPreviewPlatformSkin | undefined,
  configuredPadding: number
): number {
  return platformSkin === "windows" ? normalizeWindowPreviewPadding(configuredPadding) : 0;
}

export function getWindowPreviewChromeTopPadding(
  platformSkin: WindowPreviewPlatformSkin | undefined,
  flagsExpr: string | undefined,
  configuredTitleBarHeight: number,
  configuredCaptionlessTopPadding: number
): number {
  const titleBarHeight = getWindowPreviewTitleBarHeight(flagsExpr, configuredTitleBarHeight);
  if (titleBarHeight > 0) {
    return titleBarHeight;
  }

  if (platformSkin === "windows") {
    return normalizeWindowPreviewPadding(configuredCaptionlessTopPadding);
  }

  return 0;
}

export function getWindowPreviewTitleButtons(flagsExpr: string | undefined): WindowPreviewTitleButtons {
  if (!hasWindowPreviewTitleBar(flagsExpr)) {
    return {
      showClose: false,
      showMinimize: false,
      showMaximize: false,
    };
  }

  const flags = new Set(splitFlags(flagsExpr));
  return {
    showClose: true,
    showMinimize: flags.has(WINDOW_TITLEBAR_MINIMIZE_PREVIEW_FLAG),
    showMaximize: flags.has(WINDOW_TITLEBAR_MAXIMIZE_PREVIEW_FLAG),
  };
}

export function getWindowPreviewTitleButtonSlots(
  osSkin: WindowPreviewOsSkin,
  flagsExpr: string | undefined
): WindowPreviewTitleButtonSlot[] {
  const buttons = getWindowPreviewTitleButtons(flagsExpr);
  if (!buttons.showClose) {
    return [];
  }

  switch (osSkin) {
    case "macos":
      return [
        { kind: "close", enabled: true },
        { kind: "minimize", enabled: buttons.showMinimize },
        { kind: "maximize", enabled: buttons.showMaximize },
      ];
    case "windows7":
      if (buttons.showMinimize && buttons.showMaximize) {
        return [
          { kind: "minimize", enabled: true },
          { kind: "maximize", enabled: true },
          { kind: "close", enabled: true },
        ];
      }

      if (buttons.showMinimize) {
        return [
          { kind: "minimize", enabled: true },
          { kind: "maximize", enabled: false },
          { kind: "close", enabled: true },
        ];
      }

      if (buttons.showMaximize) {
        return [
          { kind: "minimize", enabled: false },
          { kind: "maximize", enabled: true },
          { kind: "close", enabled: true },
        ];
      }

      return [{ kind: "close", enabled: true }];
    case "windows8":
    case "linux": {
      const slots: WindowPreviewTitleButtonSlot[] = [];
      if (buttons.showMinimize) {
        slots.push({ kind: "minimize", enabled: true });
      }
      if (buttons.showMaximize) {
        slots.push({ kind: "maximize", enabled: true });
      }
      slots.push({ kind: "close", enabled: true });
      return slots;
    }
  }
}

export function getWindowPreviewTitleButtonLayout(
  osSkin: WindowPreviewOsSkin,
  flagsExpr: string | undefined
): WindowPreviewTitleButtonLayout {
  switch (osSkin) {
    case "macos":
      return {
        buttonSide: "left",
        titleAlignment: "center",
        slots: getWindowPreviewTitleButtonSlots(osSkin, flagsExpr),
      };
    case "windows7":
      return {
        buttonSide: "right",
        titleAlignment: "left",
        slots: getWindowPreviewTitleButtonSlots(osSkin, flagsExpr),
      };
    case "windows8":
      return {
        buttonSide: "right",
        titleAlignment: "center",
        slots: getWindowPreviewTitleButtonSlots(osSkin, flagsExpr),
      };
    case "linux":
      return {
        buttonSide: "left",
        titleAlignment: "left",
        slots: getWindowPreviewTitleButtonSlots(osSkin, flagsExpr),
      };
  }
}

export function getWindowPreviewTitleBarDecoration(
  osSkin: WindowPreviewOsSkin,
  hasToolBar: boolean
): WindowPreviewTitleBarDecoration {
  if (osSkin === "macos") {
    return {
      backgroundStyle: hasToolBar ? "macos-toolbar" : "macos-compact",
      buttonStyle: "macos-circles",
      showFrameBorder: false,
      showBottomSeparator: true,
      showExtraBottomSeparator: !hasToolBar,
      drawShadowedTitle: true,
      useLightForeground: false,
    };
  }

  if (osSkin === "linux") {
    return {
      backgroundStyle: "linux-dark",
      buttonStyle: "linux-glyphs",
      showFrameBorder: false,
      showBottomSeparator: false,
      showExtraBottomSeparator: false,
      drawShadowedTitle: false,
      useLightForeground: true,
    };
  }

  return {
    backgroundStyle: "default",
    buttonStyle: "default",
    showFrameBorder: true,
    showBottomSeparator: false,
    showExtraBottomSeparator: false,
    drawShadowedTitle: false,
    useLightForeground: false,
  };
}

export function usesWindowPreviewExternalMenuBar(osSkin: WindowPreviewOsSkin): boolean {
  return osSkin === "macos";
}

export function getWindowPreviewTitleTextLayout(args: {
  osSkin: WindowPreviewOsSkin;
  titleAlignment: "left" | "center";
  titleLeft: number;
  titleRight: number;
  windowX: number;
  windowWidth: number;
  titleWidth: number;
}): { clipLeft: number; clipRight: number; titleX: number } {
  if (args.osSkin === "macos") {
    return {
      clipLeft: args.windowX,
      clipRight: args.windowX + args.windowWidth,
      titleX: args.windowX + Math.max(0, (args.windowWidth - args.titleWidth) / 2),
    };
  }

  return {
    clipLeft: args.titleLeft,
    clipRight: args.titleRight,
    titleX: args.titleAlignment === "center"
      ? args.titleLeft + Math.max(0, (args.titleRight - args.titleLeft - args.titleWidth) / 2)
      : args.titleLeft,
  };
}

export function getWindowPreviewTitleBarMetrics(
  osSkin: WindowPreviewOsSkin
): WindowPreviewTitleBarMetrics {
  switch (osSkin) {
    case "macos":
      return {
        buttonInsetX: 9,
        buttonOffsetY: 5,
        buttonGap: 9,
        titleOffsetY: 4,
        iconInsetX: 8,
        iconOffsetY: 8,
      };
    case "linux":
      return {
        buttonInsetX: 11,
        buttonOffsetY: 4,
        buttonGap: 0,
        titleOffsetY: 6,
        iconInsetX: 8,
        iconOffsetY: 8,
      };
    case "windows7":
      return {
        buttonInsetX: 8,
        buttonOffsetY: -1,
        buttonGap: 0,
        titleOffsetY: 8,
        iconInsetX: 8,
        iconOffsetY: 8,
      };
    case "windows8":
      return {
        buttonInsetX: 8,
        buttonOffsetY: 0,
        buttonGap: 0,
        titleOffsetY: 8,
        iconInsetX: 8,
        iconOffsetY: 8,
      };
  }
}

export function getWindowPreviewTitleButtonSize(
  osSkin: WindowPreviewOsSkin,
  kind: WindowPreviewTitleButtonKind,
  fallbackSize: WindowPreviewTitleButtonSize
): WindowPreviewTitleButtonSize {
  if (osSkin === "macos") {
    return {
      width: 12,
      height: 14,
    };
  }

  if (osSkin === "linux") {
    return {
      width: kind === "maximize" ? 17 : 18,
      height: 19,
    };
  }

  if (osSkin === "windows7") {
    return {
      width: kind === "close" ? 47 : (kind === "maximize" ? 26 : 29),
      height: 20,
    };
  }

  if (osSkin === "windows8") {
    return {
      width: kind === "close" ? 45 : (kind === "maximize" ? 27 : 17),
      height: 20,
    };
  }

  return fallbackSize;
}

export function getWindowPreviewTitleButtonAssetKind(
  osSkin: WindowPreviewOsSkin,
  kind: WindowPreviewTitleButtonKind,
  enabled: boolean
): WindowPreviewTitleButtonAssetKind | null {
  if (osSkin === "macos") {
    if (!enabled && kind !== "close") {
      return "macDisabled";
    }

    switch (kind) {
      case "close":
        return "macClose";
      case "minimize":
        return "macMinimize";
      case "maximize":
        return "macMaximize";
    }
  }

  if (osSkin === "linux") {
    if (!enabled) {
      return null;
    }

    switch (kind) {
      case "close":
        return "linuxClose";
      case "minimize":
        return "linuxMinimize";
      case "maximize":
        return "linuxMaximize";
    }
  }

  return null;
}

export function getWindowPreviewTitleIconSize(
  osSkin: WindowPreviewOsSkin,
  fallbackSize: WindowPreviewTitleIconSize
): WindowPreviewTitleIconSize {
  if (osSkin === "windows7" || osSkin === "windows8") {
    return {
      width: 16,
      height: 14,
    };
  }

  return fallbackSize;
}

export function getWindowPreviewToolBarDecoration(
  osSkin: WindowPreviewOsSkin
): WindowPreviewToolBarDecoration {
  switch (osSkin) {
    case "macos":
      return {
        backgroundStyle: "macos-gradient",
        showFrameBorder: false,
        showBottomSeparator: true,
        useDarkBottomSeparator: true,
        separatorColorStyle: "none",
        showUnselectedEntryFrame: false,
        selectedOutlineColorStyle: "black",
        itemInsetX: 7,
        itemInsetY: 3,
      };
    case "linux":
      return {
        backgroundStyle: "linux-light",
        showFrameBorder: false,
        showBottomSeparator: false,
        useDarkBottomSeparator: false,
        separatorColorStyle: "toolbar-dark",
        showUnselectedEntryFrame: false,
        selectedOutlineColorStyle: "black",
        itemInsetX: 13,
        itemInsetY: 3,
      };
    case "windows7":
    case "windows8":
      return {
        backgroundStyle: "windows-light",
        showFrameBorder: false,
        showBottomSeparator: false,
        useDarkBottomSeparator: false,
        separatorColorStyle: "toolbar-dark",
        showUnselectedEntryFrame: false,
        selectedOutlineColorStyle: "black",
        itemInsetX: 5,
        itemInsetY: 3,
      };
  }
}

export function getWindowPreviewStatusBarDecoration(
  osSkin: WindowPreviewOsSkin
): WindowPreviewStatusBarDecoration {
  switch (osSkin) {
    case "macos":
      return {
        backgroundStyle: "macos-gradient",
        showRoundedBackground: true,
        showTopSeparator: true,
        topSeparatorStyle: "macos-dark",
        showFieldSeparators: false,
        textColorStyle: "black",
        selectedOutlineColorStyle: "black",
        fieldInsetX: 7,
        fieldInsetY: 4,
        widthAdjustment: 14,
      };
    case "linux":
      return {
        backgroundStyle: "transparent",
        showRoundedBackground: false,
        showTopSeparator: true,
        topSeparatorStyle: "light",
        showFieldSeparators: true,
        textColorStyle: "black",
        selectedOutlineColorStyle: "black",
        fieldInsetX: 15,
        fieldInsetY: 4,
        widthAdjustment: 14,
      };
    case "windows7":
    case "windows8":
      return {
        backgroundStyle: "transparent",
        showRoundedBackground: false,
        showTopSeparator: true,
        topSeparatorStyle: "light",
        showFieldSeparators: true,
        textColorStyle: "black",
        selectedOutlineColorStyle: "black",
        fieldInsetX: 7,
        fieldInsetY: 4,
        widthAdjustment: 14,
      };
  }
}


export function getWindowPreviewStatusBarProgressDecoration(
  osSkin: WindowPreviewOsSkin
): WindowPreviewStatusBarProgressDecoration {
  if (osSkin === "windows8") {
    return {
      trackShape: "rect",
      trackRadius: 0,
      trackInsetX: 2,
      trackInsetY: 5,
      trackColorStyle: "windows8",
      fillColorStyle: "windows8",
      borderColorStyle: "windows8",
    };
  }

  return {
    trackShape: "rounded",
    trackRadius: 3,
    trackInsetX: 2,
    trackInsetY: 5,
    trackColorStyle: "default",
    fillColorStyle: "default",
    borderColorStyle: "default",
  };
}

export function getWindowPreviewMenuBarDecoration(
  osSkin: WindowPreviewOsSkin
): WindowPreviewMenuBarDecoration {
  switch (osSkin) {
    case "macos":
      return {
        backgroundStyle: "macos-gradient",
        showTopSeparator: true,
        topSeparatorStyle: "macos-dark",
        bottomSeparatorStyle: "macos-dark",
        itemInsetX: 20,
        itemInsetY: 4,
        itemSpacing: 20,
        useSelectedOutline: true,
        textColorStyle: "black",
        outlineColorStyle: "black",
      };
    case "windows7":
      return {
        backgroundStyle: "windows7-layered",
        showTopSeparator: false,
        topSeparatorStyle: "none",
        bottomSeparatorStyle: "windows7-triple",
        itemInsetX: 15,
        itemInsetY: 2,
        itemSpacing: 7,
        useSelectedOutline: true,
        textColorStyle: "black",
        outlineColorStyle: "black",
      };
    case "windows8":
      return {
        backgroundStyle: "windows8-light",
        showTopSeparator: false,
        topSeparatorStyle: "none",
        bottomSeparatorStyle: "windows8-light",
        itemInsetX: 15,
        itemInsetY: 2,
        itemSpacing: 7,
        useSelectedOutline: true,
        textColorStyle: "black",
        outlineColorStyle: "black",
      };
    case "linux":
      return {
        backgroundStyle: "linux-light",
        showTopSeparator: false,
        topSeparatorStyle: "none",
        bottomSeparatorStyle: "linux-light",
        itemInsetX: 15,
        itemInsetY: 2,
        itemSpacing: 7,
        useSelectedOutline: true,
        textColorStyle: "black",
        outlineColorStyle: "black",
      };
  }
}

export function getWindowPreviewMenuFlyoutDecoration(): WindowPreviewMenuFlyoutDecoration {
  return {
    backgroundStyle: "white",
    borderStyle: "light",
    separatorStyle: "light",
    useSelectedOutline: true,
    showEntryHoverFill: false,
    textColorStyle: "black",
    outlineColorStyle: "black",
  };
}

export function getWindowPreviewAddIconMetrics(): WindowPreviewAddIconMetrics {
  return {
    width: 16,
    height: 16,
  };
}

export function getWindowPreviewMenuSubmenuIconMetrics(): WindowPreviewMenuSubmenuIconMetrics {
  return {
    width: 9,
    height: 10,
    offsetRight: 20,
    offsetY: 4,
  };
}

export function getWindowPreviewMenuRootEntryRect(
  x: number,
  y: number,
  textWidth: number,
  menuBarHeight: number,
): WindowPreviewMenuRootEntryRect {
  return {
    x: Math.trunc(x) - 1,
    y: Math.trunc(y) - 1,
    w: Math.max(24, Math.ceil(textWidth) + 6) + 1,
    h: Math.max(0, Math.trunc(menuBarHeight) - 4),
  };
}

export function getWindowPreviewBodyDecoration(
  osSkin: WindowPreviewOsSkin,
  hasTitleBar: boolean
): WindowPreviewBodyDecoration {
  if (osSkin === "macos") {
    return {
      backgroundStyle: "macos-light",
      useRoundedTopFill: false,
      roundedTopRadius: 4,
      showClientBorder: false,
      clientBorderStyle: "none",
      showBodyOutline: true,
      bodyOutlineStyle: "macos-light",
    };
  }

  if (osSkin === "linux") {
    return {
      backgroundStyle: "linux-light",
      useRoundedTopFill: hasTitleBar,
      roundedTopRadius: 6,
      showClientBorder: true,
      clientBorderStyle: "linux-dark",
      showBodyOutline: false,
      bodyOutlineStyle: "none",
    };
  }

  if (osSkin === "windows7") {
    return {
      backgroundStyle: "windows7-frame",
      useRoundedTopFill: false,
      roundedTopRadius: 4,
      showClientBorder: true,
      clientBorderStyle: "windows7-inner",
      showBodyOutline: false,
      bodyOutlineStyle: "none",
    };
  }

  if (osSkin === "windows8") {
    return {
      backgroundStyle: "windows8-frame",
      useRoundedTopFill: false,
      roundedTopRadius: 0,
      showClientBorder: true,
      clientBorderStyle: "windows8-inner",
      showBodyOutline: false,
      bodyOutlineStyle: "none",
    };
  }

  return {
    backgroundStyle: "default",
    useRoundedTopFill: false,
    roundedTopRadius: 0,
    showClientBorder: false,
    clientBorderStyle: "none",
    showBodyOutline: false,
    bodyOutlineStyle: "none",
  };
}

export function getWindowPreviewFrameStrokeRect(
  osSkin: WindowPreviewOsSkin,
  rect: { x: number; y: number; w: number; h: number }
): WindowPreviewFrameStrokeRect {
  const decoration = getWindowPreviewFrameDecoration(osSkin);

  if (decoration.borderStyle === "macos-rounded" || decoration.borderStyle === "windows7-rounded") {
    return {
      x: rect.x - 0.5,
      y: rect.y - 0.5,
      w: rect.w + 1,
      h: rect.h + 1,
    };
  }

  return {
    x: rect.x + 0.5,
    y: rect.y + 0.5,
    w: rect.w - 1,
    h: rect.h - 1,
  };
}

export function getWindowPreviewFrameDecoration(
  osSkin: WindowPreviewOsSkin
): WindowPreviewFrameDecoration {
  if (osSkin === "macos") {
    return {
      borderStyle: "macos-rounded",
      borderRadius: 4,
      strokeColorStyle: "macos-dark",
      strokeAlpha: 1,
    };
  }

  if (osSkin === "linux") {
    return {
      borderStyle: "none",
      borderRadius: 0,
      strokeColorStyle: "focus",
      strokeAlpha: 0,
    };
  }

  if (osSkin === "windows7") {
    return {
      borderStyle: "windows7-rounded",
      borderRadius: 4,
      strokeColorStyle: "windows7-dark",
      strokeAlpha: 1,
    };
  }

  if (osSkin === "windows8") {
    return {
      borderStyle: "default",
      borderRadius: 0,
      strokeColorStyle: "windows8-blue",
      strokeAlpha: 1,
    };
  }

  return {
    borderStyle: "default",
    borderRadius: 0,
    strokeColorStyle: "focus",
    strokeAlpha: 0.35,
  };
}

export function hasWindowPreviewTitleIcon(
  platformSkin: WindowPreviewPlatformSkin | undefined,
  flagsExpr: string | undefined
): boolean {
  return platformSkin === "windows" && hasWindowPreviewTitleBar(flagsExpr);
}

export function hasWindowPreviewResizeGrip(platformSkin: WindowPreviewPlatformSkin | undefined): boolean {
  return platformSkin === "windows" || platformSkin === "linux" || platformSkin === "macos";
}

export function getWindowBooleanInspectorState(raw: string | undefined, value: boolean | undefined): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  const trimmed = (raw ?? '').trim();
  if (!trimmed || trimmed === '0') {
    return false;
  }

  return true;
}

export type ParsedWindowPositionInput =
  | { ok: true; raw: string; previewValue: number; isIgnore: boolean }
  | { ok: false; error: string };

export function parseWindowPositionInspectorInput(raw: string): ParsedWindowPositionInput {
  const trimmed = raw.trim();
  if (trimmed === WINDOW_POSITION_IGNORE_LITERAL) {
    return {
      ok: true,
      raw: WINDOW_POSITION_IGNORE_LITERAL,
      previewValue: 0,
      isIgnore: true,
    };
  }

  if (!isIntegerLiteral(trimmed)) {
    return {
      ok: false,
      error: `Only integer values or ${WINDOW_POSITION_IGNORE_LITERAL} are supported.`
    };
  }

  return {
    ok: true,
    raw: trimmed,
    previewValue: Number(trimmed),
    isIgnore: false,
  };
}
