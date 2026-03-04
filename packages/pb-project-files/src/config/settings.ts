import * as vscode from "vscode";

export interface ProjectEditorSettings {
  inactiveTabForeground: string;
}

export const SETTINGS_SECTION = "purebasicProjectEditor";

const SETTING_KEYS = {
  inactiveTabForeground: "inactiveTabForeground",
} as const;

export function readProjectEditorSettings(): ProjectEditorSettings {
  const cfg = vscode.workspace.getConfiguration(SETTINGS_SECTION);
  return {
    inactiveTabForeground: cfg.get<string>(SETTING_KEYS.inactiveTabForeground, ""),
  };
}