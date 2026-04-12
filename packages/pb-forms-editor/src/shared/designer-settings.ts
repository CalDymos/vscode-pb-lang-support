export const GRID_MODE_KEY = {
  dots: "dots",
  lines: "lines"
} as const;

export const SNAP_MODE_KEY = {
  live: "live",
  drop: "drop"
} as const;

export const DESIGNER_OS_SKIN_KEY = {
  windows7: "windows7",
  windows8: "windows8",
  linux: "linux",
  macos: "macos"
} as const;

export const WARNING_PRESENCE_MODE_KEY = {
  never: "never",
  always: "always"
} as const;

export const WARNING_VERSION_UPGRADE_MODE_KEY = {
  never: "never",
  ifBackwardCompatibilityIsAffected: "ifBackwardCompatibilityIsAffected",
  always: "always"
} as const;

export type GridMode = typeof GRID_MODE_KEY[keyof typeof GRID_MODE_KEY];
export type SnapMode = typeof SNAP_MODE_KEY[keyof typeof SNAP_MODE_KEY];
export type DesignerOsSkin = typeof DESIGNER_OS_SKIN_KEY[keyof typeof DESIGNER_OS_SKIN_KEY];
export type WarningPresenceMode = typeof WARNING_PRESENCE_MODE_KEY[keyof typeof WARNING_PRESENCE_MODE_KEY];
export type WarningVersionUpgradeMode = typeof WARNING_VERSION_UPGRADE_MODE_KEY[keyof typeof WARNING_VERSION_UPGRADE_MODE_KEY];

/**
 * Designer settings shared between the extension host and the webview.
 * Read via readDesignerSettings() on the extension side;
 * received as part of the init/settings messages on the webview side.
 */
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
  windowPreviewWindowsCaptionlessTopPadding: number;
  windowPreviewWindowsClientSidePadding: number;
  windowPreviewWindowsClientBottomPadding: number;

  canvasBackground: string;
  canvasReadonlyBackground: string;

  newGadgetsUsePbAnyByDefault: boolean;
  newGadgetsUseVariableAsCaption: boolean;
  generateEventProcedure: boolean;
  osSkin: DesignerOsSkin;
  warningUnrecognizedFile: WarningPresenceMode;
  warningVersionUpgrade: WarningVersionUpgradeMode;
  warningVersionDowngrade: WarningPresenceMode;
}
