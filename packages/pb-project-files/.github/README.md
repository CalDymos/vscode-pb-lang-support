# PureBasic Project Files (pb-project-files)

[![pb-project-files](https://img.shields.io/github/v/tag/CalDymos/vscode-pb-lang-suite?sort=semver&filter=pbp-v*&label=pbp)](https://github.com/CalDymos/vscode-pb-lang-suite/tags)

Workspace project/target management for PureBasic **.pbp** projects.

This extension is designed as an **optional companion** for [**PureBasic Language Services (pb-lang-support)**](https://marketplace.visualstudio.com/items?itemName=CalDymos.pb-lang-support)  .
If installed, it provides project context (active project/target, include directories, project file lists) to pb-lang-support via LSP notifications.

## Features

- Discover **.pbp** projects in the current workspace
- Cache parsed projects (via **@caldymos/pb-project-core**)
- Track **active project / active target** (auto-sync from active editor, QuickPick)
- Maintain a **file → project** map (including best-match fallback by project root)
- Show active project/target in the **Status Bar**
- Open **.pbp** files in a dedicated **webview-based project editor**

## Commands

- **PureBasic: Select Active Project** (`pbProjectFiles.pickProject`)
- **PureBasic: Select Active Target** (`pbProjectFiles.pickTarget`)
- **PureBasic: Refresh Projects** (`pbProjectFiles.refresh`)

## Custom Editor

Opening a **.pbp** file in VS Code will automatically use the built-in **PureBasic Project Editor** (viewType: `pbProjectFiles.pbpEditor`).
It provides a visual interface for managing project files, build targets, and project options — closely replicating the experience of the original PureBasic IDE.

## Configuration

| Setting | Type | Default | Description |
|---|---|---|---|
| `purebasicProjectEditor.inactiveTabForeground` | `string` | `""` | Foreground color for inactive tabs in the project editor. Accepts any valid CSS color value. Falls back to the VS Code theme default when empty. |

## Extension API

`pb-project-files` exposes a versioned public API (`version: 2`) that other extensions can consume to access project context at runtime.

**Acquiring the API:**

```ts
const ext = vscode.extensions.getExtension<PbProjectFilesApi>('CalDymos.pb-project-files');
const api = await ext?.activate();
```

**Available methods:**

| Method | Description |
|---|---|
| `getActiveContext()` | Returns the active `PbpProject` and `PbpTarget` objects |
| `getActiveContextPayload()` | Returns a serializable payload with paths, include dirs, and source files |
| `getProjectForFile(uri)` | Returns the project that contains a given file (with best-match fallback) |
| `readProjectFile(uri)` | Reads a `.pbp` file — returns raw XML and the parsed project model |
| `writeProjectFileModel(uri, project)` | Serializes and writes a `PbpProject` model to a `.pbp` file |
| `writeProjectFileXml(uri, xml)` | Writes raw XML directly to a `.pbp` file |
| `refresh()` | Rescans the workspace for `.pbp` files |
| `pickActiveProject()` | Opens the project QuickPick UI |
| `pickActiveTarget()` | Opens the target QuickPick UI |
| `onDidChangeActiveContext` | Event fired whenever the active project or target changes |

## Notes

- This extension works standalone, but its main benefit is improved project-aware behavior in [**PureBasic Language Services (pb-lang-support)**](https://marketplace.visualstudio.com/items?itemName=CalDymos.pb-lang-support).
- If pb-lang-support is not installed, the extension still provides project file infos.
