import * as vscode from "vscode";
import {
  GRID_MODE_KEY,
  SNAP_MODE_KEY,
  DESIGNER_OS_SKIN_KEY,
  WARNING_PRESENCE_MODE_KEY,
  WARNING_VERSION_UPGRADE_MODE_KEY,
  type GridMode,
  type SnapMode,
  type DesignerSettings
} from "../shared/designer-settings";

export const SETTINGS_SECTION = "purebasicFormsDesigner";

const SETTING_KEYS = {
  showGrid: "showGrid",
  gridMode: "gridMode",
  gridSize: "gridSize",
  gridOpacity: "gridOpacity",

  snapToGrid: "snapToGrid",
  snapMode: "snapMode",

  windowFillOpacity: "windowFillOpacity",
  outsideDimOpacity: "outsideDimOpacity",
  titleBarHeight: "titleBarHeight",
  windowPreviewWindowsCaptionlessTopPadding: "windowPreviewWindowsCaptionlessTopPadding",
  windowPreviewWindowsClientSidePadding: "windowPreviewWindowsClientSidePadding",
  windowPreviewWindowsClientBottomPadding: "windowPreviewWindowsClientBottomPadding",

  canvasBackground: "canvasBackground",
  canvasReadonlyBackground: "canvasReadonlyBackground",

  newGadgetsUsePbAnyByDefault: "newGadgetsUsePbAnyByDefault",
  newGadgetsUseVariableAsCaption: "newGadgetsUseVariableAsCaption",
  generateEventProcedure: "generateEventProcedure",
  osSkin: "osSkin",
  warningUnrecognizedFile: "warningUnrecognizedFile",
  warningVersionUpgrade: "warningVersionUpgrade",
  warningVersionDowngrade: "warningVersionDowngrade"
} as const;

export function readDesignerSettings(): DesignerSettings {
  const cfg = vscode.workspace.getConfiguration(SETTINGS_SECTION);

  return {
    showGrid: cfg.get<boolean>(SETTING_KEYS.showGrid, true),
    gridMode: cfg.get<GridMode>(SETTING_KEYS.gridMode, GRID_MODE_KEY.dots),
    gridSize: clamp(cfg.get<number>(SETTING_KEYS.gridSize, 5), 2, 100),
    gridOpacity: clamp(cfg.get<number>(SETTING_KEYS.gridOpacity, 0.14), 0.02, 0.5),

    snapToGrid: cfg.get<boolean>(SETTING_KEYS.snapToGrid, false),
    snapMode: cfg.get<SnapMode>(SETTING_KEYS.snapMode, SNAP_MODE_KEY.drop),

    windowFillOpacity: clamp(cfg.get<number>(SETTING_KEYS.windowFillOpacity, 0.05), 0, 0.25),
    outsideDimOpacity: clamp(cfg.get<number>(SETTING_KEYS.outsideDimOpacity, 0.12), 0, 0.35),
    titleBarHeight: clamp(cfg.get<number>(SETTING_KEYS.titleBarHeight, 26), 0, 60),
    windowPreviewWindowsCaptionlessTopPadding: clamp(cfg.get<number>(SETTING_KEYS.windowPreviewWindowsCaptionlessTopPadding, 8), 0, 60),
    windowPreviewWindowsClientSidePadding: clamp(cfg.get<number>(SETTING_KEYS.windowPreviewWindowsClientSidePadding, 8), 0, 60),
    windowPreviewWindowsClientBottomPadding: clamp(cfg.get<number>(SETTING_KEYS.windowPreviewWindowsClientBottomPadding, 8), 0, 60),

    canvasBackground: cfg.get<string>(SETTING_KEYS.canvasBackground, ""),
    canvasReadonlyBackground: cfg.get<string>(SETTING_KEYS.canvasReadonlyBackground, ""),

    newGadgetsUsePbAnyByDefault: cfg.get<boolean>(SETTING_KEYS.newGadgetsUsePbAnyByDefault, true),
    newGadgetsUseVariableAsCaption: cfg.get<boolean>(SETTING_KEYS.newGadgetsUseVariableAsCaption, false),
    generateEventProcedure: cfg.get<boolean>(SETTING_KEYS.generateEventProcedure, true),
    osSkin: getEnumSetting(cfg, SETTING_KEYS.osSkin, DESIGNER_OS_SKIN_KEY, DESIGNER_OS_SKIN_KEY.windows7),
    warningUnrecognizedFile: getEnumSetting(cfg, SETTING_KEYS.warningUnrecognizedFile, WARNING_PRESENCE_MODE_KEY, WARNING_PRESENCE_MODE_KEY.always),
    warningVersionUpgrade: getEnumSetting(
      cfg,
      SETTING_KEYS.warningVersionUpgrade,
      WARNING_VERSION_UPGRADE_MODE_KEY,
      WARNING_VERSION_UPGRADE_MODE_KEY.ifBackwardCompatibilityIsAffected
    ),
    warningVersionDowngrade: getEnumSetting(cfg, SETTING_KEYS.warningVersionDowngrade, WARNING_PRESENCE_MODE_KEY, WARNING_PRESENCE_MODE_KEY.always)
  };
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function getEnumSetting<T extends string>(
  cfg: vscode.WorkspaceConfiguration,
  key: string,
  valueMap: Record<string, T>,
  fallback: T
): T {
  const rawValue = cfg.get<string>(key, fallback);
  return Object.values(valueMap).includes(rawValue as T) ? (rawValue as T) : fallback;
}
