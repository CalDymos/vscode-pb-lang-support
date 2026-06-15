/**
 * Selection types for top-level chrome elements (menus, toolbars, status bars).
 *
 * The split into container / entry sub-unions is intentional:
 *   DesignerTopLevelContainerSelection  → hit produces a PreviewRectLike
 *   DesignerTopLevelEntrySelection      → hit produces a PreviewEntryRectLike
 * preview.ts uses these directly so no Extract + string literal list is needed there.
 */

export type TopLevelMenuSelection = {
  kind: "menu";
  id: string;
};

export type TopLevelMenuEntrySelection = {
  kind: "menuEntry";
  menuId: string;
  entryIndex: number;
};

export type TopLevelToolBarSelection = {
  kind: "toolbar";
  id: string;
};

export type TopLevelToolBarEntrySelection = {
  kind: "toolBarEntry";
  toolBarId: string;
  entryIndex: number;
};

export type TopLevelStatusBarSelection = {
  kind: "statusbar";
  id: string;
};

export type TopLevelStatusBarFieldSelection = {
  kind: "statusBarField";
  statusBarId: string;
  fieldIndex: number;
};

/** Full designer selection including container and entry variants. */
export type DesignerTopLevelSelection =
  | TopLevelMenuSelection
  | TopLevelMenuEntrySelection
  | TopLevelToolBarSelection
  | TopLevelToolBarEntrySelection
  | TopLevelStatusBarSelection
  | TopLevelStatusBarFieldSelection;

/** Container-level selection — the bar/menu strip itself, not an individual item. */
export type DesignerTopLevelContainerSelection =
  | TopLevelMenuSelection
  | TopLevelToolBarSelection
  | TopLevelStatusBarSelection;

/** Entry-level selection — an individual item inside a container. */
export type DesignerTopLevelEntrySelection =
  | TopLevelMenuEntrySelection
  | TopLevelToolBarEntrySelection
  | TopLevelStatusBarFieldSelection;

export type TopLevelSelectedImageInspectorTarget = DesignerTopLevelEntrySelection["kind"];

/** Extends DesignerTopLevelSelection with add-button pseudo-selections
 *  used only in context menu hit-testing (never stored as active selection). */
export type TopLevelCanvasContextMenuSelection =
  | DesignerTopLevelSelection
  | {
      kind: "toolBarAddButton";
      toolBarId: string;
    }
  | {
      kind: "statusBarAddButton";
      statusBarId: string;
    };
