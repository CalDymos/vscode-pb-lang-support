import * as vscode from "vscode";

const GRID_MODE_KEY = {
  dots: "dots",
  lines: "lines"
} as const;

const SNAP_MODE_KEY = {
  live: "live",
  drop: "drop"
} as const;

export type GridMode = typeof GRID_MODE_KEY[keyof typeof GRID_MODE_KEY];
export type SnapMode = typeof SNAP_MODE_KEY[keyof typeof SNAP_MODE_KEY];

export interface DesignerSettings {
  showGrid: boolean;
  gridMode: GridMode;
  gridSize: number;
  gridOpacity: number;

  snapToGrid: boolean;
  snapMode: SnapMode;

  windowFillOpacity: number;
  outsideDimOpacity: number;
  titleBarHeight: number;

  canvasBackground: string;
  canvasReadonlyBackground: string;
}

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

  canvasBackground: "canvasBackground",
  canvasReadonlyBackground: "canvasReadonlyBackground"
} as const;



export function readDesignerSettings(): DesignerSettings {
  const cfg = vscode.workspace.getConfiguration(SETTINGS_SECTION);

  return {
    showGrid: cfg.get<boolean>(SETTING_KEYS.showGrid, true),
    gridMode: cfg.get<GridMode>(SETTING_KEYS.gridMode, GRID_MODE_KEY.dots),
    gridSize: clamp(cfg.get<number>(SETTING_KEYS.gridSize, 10), 2, 100),
    gridOpacity: clamp(cfg.get<number>(SETTING_KEYS.gridOpacity, 0.14), 0.02, 0.5),

    snapToGrid: cfg.get<boolean>(SETTING_KEYS.snapToGrid, false),
    snapMode: cfg.get<SnapMode>(SETTING_KEYS.snapMode, SNAP_MODE_KEY.drop),

    windowFillOpacity: clamp(cfg.get<number>(SETTING_KEYS.windowFillOpacity, 0.05), 0, 0.25),
    outsideDimOpacity: clamp(cfg.get<number>(SETTING_KEYS.outsideDimOpacity, 0.12), 0, 0.35),
    titleBarHeight: clamp(cfg.get<number>(SETTING_KEYS.titleBarHeight, 26), 0, 60),

    canvasBackground: cfg.get<string>(SETTING_KEYS.canvasBackground, ""),
    canvasReadonlyBackground: cfg.get<string>(SETTING_KEYS.canvasReadonlyBackground, "")
  };
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}
