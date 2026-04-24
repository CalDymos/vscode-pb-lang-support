import type { TopLevelSelectedImageInspectorTarget } from "./selection";

export interface TopLevelSelectedImageInspectorConfig {
  currentImageEditable: boolean;
  currentImageTitle: string;
  currentImageHint?: string;
  changeImageButtonLabel: string;
  changeImageButtonTitle: string;
  showExpertActions: boolean;
  showClearAction: boolean;
  showImageJumpAction: boolean;
}

export function getTopLevelSelectedImageInspectorConfig(target: TopLevelSelectedImageInspectorTarget): TopLevelSelectedImageInspectorConfig {
  switch (target) {
    case "menuEntry":
      return {
        currentImageEditable: true,
        currentImageTitle: "Edit the image path directly or use Select to choose a file for this menu entry.",
        //currentImageHint: "Direct text editing is not available here. Use Select to choose a file and assign it to this menu entry.",
        changeImageButtonLabel: "Select",
        changeImageButtonTitle: "Choose a file for this menu entry.",
        showExpertActions: false,
        showClearAction: false,
        showImageJumpAction: false,
      };
    case "toolBarEntry":
      return {
        currentImageEditable: true,
        currentImageTitle: "Edit the image path directly or use Select to choose a file for this toolbar button.",
        changeImageButtonLabel: "Select",
        changeImageButtonTitle: "Choose a file for this toolbar button.",
        showExpertActions: false,
        showClearAction: false,
        showImageJumpAction: false,
      };
    case "statusBarField":
      return {
        currentImageEditable: true,
        currentImageTitle: "Edit or rebind the image used by this status bar field.",
        changeImageButtonLabel: "Select",
        changeImageButtonTitle: "Choose a file for this statusbar field.",
        showExpertActions: false,
        showClearAction: false,
        showImageJumpAction: false,
      };
  }
}
