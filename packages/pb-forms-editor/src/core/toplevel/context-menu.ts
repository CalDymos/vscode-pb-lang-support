import type { TopLevelCanvasContextMenuSelection } from "./selection";

export type SourceLineLike = {
  line: number;
};

export type MenuEntryLike = {
  kind: string;
  source?: SourceLineLike;
};

export type MenuModelLike = {
  id: string;
  entries?: MenuEntryLike[];
};

export type ToolBarEntryLike = {
  kind: string;
  source?: SourceLineLike;
};

export type ToolBarModelLike = {
  id: string;
  entries?: ToolBarEntryLike[];
};

export type StatusBarFieldLike = {
  source?: SourceLineLike;
};

export type StatusBarModelLike = {
  id: string;
  fields?: StatusBarFieldLike[];
};

export type TopLevelCanvasContextMenuAction =
  | {
      kind: "deleteMenu";
      label: "Delete Menu…";
      title: string;
      enabled: true;
      menuId: string;
      confirmLabel: "Delete Menu";
      message: string;
    }
  | {
      kind: "deleteMenuEntry";
      label: "Delete MenuItem…";
      title: string;
      enabled: boolean;
      menuId: string;
      entryIndex: number;
      entryKind: string;
      sourceLine?: number;
      confirmLabel: "Delete Entry";
      message: string;
    }
  | {
      kind: "deleteToolBar";
      label: "Delete Toolbar…";
      title: string;
      enabled: true;
      toolBarId: string;
      confirmLabel: "Delete Toolbar";
      message: string;
    }
  | {
      kind: "deleteToolBarEntry";
      label: "Delete ToolbarItem…";
      title: string;
      enabled: boolean;
      toolBarId: string;
      entryIndex: number;
      entryKind: string;
      sourceLine?: number;
      confirmLabel: "Delete Entry";
      message: string;
    }
  | {
      kind: "deleteStatusBar";
      label: "Delete StatusBar…";
      title: string;
      enabled: true;
      statusBarId: string;
      confirmLabel: "Delete StatusBar";
      message: string;
    }
  | {
      kind: "deleteStatusBarField";
      label: "Delete StatusBarField…";
      title: string;
      enabled: boolean;
      statusBarId: string;
      fieldIndex: number;
      sourceLine?: number;
      confirmLabel: "Delete Field";
      message: string;
    }
  | {
      kind: "insertToolBarButton";
      label: "Add Button";
      title: string;
      enabled: true;
      toolBarId: string;
    }
  | {
      kind: "insertToolBarToggleButton";
      label: "Add Toggle";
      title: string;
      enabled: true;
      toolBarId: string;
    }
  | {
      kind: "insertToolBarSeparator";
      label: "Add Separator";
      title: string;
      enabled: true;
      toolBarId: string;
    }
  | {
      kind: "insertStatusBarImage";
      label: "Add Image";
      title: string;
      enabled: true;
      statusBarId: string;
    }
  | {
      kind: "insertStatusBarLabel";
      label: "Add Label";
      title: string;
      enabled: true;
      statusBarId: string;
    }
  | {
      kind: "insertStatusBarProgressBar";
      label: "Add ProgressBar";
      title: string;
      enabled: true;
      statusBarId: string;
    };

export function resolveTopLevelCanvasContextMenuActions(args: {
  selection: TopLevelCanvasContextMenuSelection;
  menus?: MenuModelLike[];
  toolbars?: ToolBarModelLike[];
  statusbars?: StatusBarModelLike[];
}): TopLevelCanvasContextMenuAction[] | null {
  const { selection } = args;
  switch (selection.kind) {
    case "menu": {
      const menu = args.menus?.find(entry => entry.id === selection.id);
      if (!menu) return null;
      return [{
        kind: "deleteMenu",
        label: "Delete Menu…",
        title: "Delete the current menu.",
        enabled: true,
        menuId: menu.id,
        confirmLabel: "Delete Menu",
        message: `Delete menu '${menu.id}'?`
      }];
    }
    case "menuEntry": {
      const menu = args.menus?.find(entry => entry.id === selection.menuId);
      const item = menu?.entries?.[selection.entryIndex];
      if (!menu || !item) return null;
      const sourceLine = item.source?.line;
      const enabled = typeof sourceLine === "number";
      return [{
        kind: "deleteMenuEntry",
        label: "Delete MenuItem…",
        title: enabled
          ? "Delete the currently selected menu entry."
          : "Only parsed menu entries with a source line can be deleted.",
        enabled,
        menuId: menu.id,
        entryIndex: selection.entryIndex,
        entryKind: item.kind,
        sourceLine,
        confirmLabel: "Delete Entry",
        message: `Delete the selected ${item.kind} entry from menu '${menu.id}'?`
      }];
    }
    case "toolbar": {
      const toolBar = args.toolbars?.find(entry => entry.id === selection.id);
      if (!toolBar) return null;
      return [{
        kind: "deleteToolBar",
        label: "Delete Toolbar…",
        title: "Delete the current toolbar.",
        enabled: true,
        toolBarId: toolBar.id,
        confirmLabel: "Delete Toolbar",
        message: `Delete toolbar '${toolBar.id}'?`
      }];
    }
    case "toolBarEntry": {
      const toolBar = args.toolbars?.find(entry => entry.id === selection.toolBarId);
      const item = toolBar?.entries?.[selection.entryIndex];
      if (!toolBar || !item) return null;
      const sourceLine = item.source?.line;
      const enabled = typeof sourceLine === "number";
      return [{
        kind: "deleteToolBarEntry",
        label: "Delete ToolbarItem…",
        title: enabled
          ? "Delete the currently selected toolbar entry."
          : "Only parsed toolbar entries with a source line can be deleted.",
        enabled,
        toolBarId: toolBar.id,
        entryIndex: selection.entryIndex,
        entryKind: item.kind,
        sourceLine,
        confirmLabel: "Delete Entry",
        message: `Delete the selected ${item.kind} entry from toolbar '${toolBar.id}'?`
      }];
    }
    case "statusbar": {
      const statusBar = args.statusbars?.find(entry => entry.id === selection.id);
      if (!statusBar) return null;
      return [{
        kind: "deleteStatusBar",
        label: "Delete StatusBar…",
        title: "Delete the current statusbar.",
        enabled: true,
        statusBarId: statusBar.id,
        confirmLabel: "Delete StatusBar",
        message: `Delete statusbar '${statusBar.id}'?`
      }];
    }
    case "statusBarField": {
      const statusBar = args.statusbars?.find(entry => entry.id === selection.statusBarId);
      const field = statusBar?.fields?.[selection.fieldIndex];
      if (!statusBar || !field) return null;
      const sourceLine = field.source?.line;
      const enabled = typeof sourceLine === "number";
      return [{
        kind: "deleteStatusBarField",
        label: "Delete StatusBarField…",
        title: enabled
          ? "Delete the currently selected statusbar field."
          : "Only parsed statusbar fields with a source line can be deleted.",
        enabled,
        statusBarId: statusBar.id,
        fieldIndex: selection.fieldIndex,
        sourceLine,
        confirmLabel: "Delete Field",
        message: `Delete field ${selection.fieldIndex} from statusbar '${statusBar.id}'?`
      }];
    }
    case "toolBarAddButton": {
      const toolBar = args.toolbars?.find(entry => entry.id === selection.toolBarId);
      if (!toolBar) return null;
      return [
        {
          kind: "insertToolBarButton",
          label: "Add Button",
          title: "Insert a new toolbar button.",
          enabled: true,
          toolBarId: toolBar.id
        },
        {
          kind: "insertToolBarToggleButton",
          label: "Add Toggle",
          title: "Insert a new toolbar toggle button.",
          enabled: true,
          toolBarId: toolBar.id
        },
        {
          kind: "insertToolBarSeparator",
          label: "Add Separator",
          title: "Insert a new toolbar separator.",
          enabled: true,
          toolBarId: toolBar.id
        }
      ];
    }
    case "statusBarAddButton": {
      const statusBar = args.statusbars?.find(entry => entry.id === selection.statusBarId);
      if (!statusBar) return null;
      return [
        {
          kind: "insertStatusBarImage",
          label: "Add Image",
          title: "Insert a new statusbar image field.",
          enabled: true,
          statusBarId: statusBar.id
        },
        {
          kind: "insertStatusBarLabel",
          label: "Add Label",
          title: "Insert a new statusbar label field.",
          enabled: true,
          statusBarId: statusBar.id
        },
        {
          kind: "insertStatusBarProgressBar",
          label: "Add ProgressBar",
          title: "Insert a new statusbar progress field.",
          enabled: true,
          statusBarId: statusBar.id
        }
      ];
    }
  }
}
