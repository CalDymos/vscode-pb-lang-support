# PureBasic Project Files (pb-project-files)

[![pb-project-files](https://img.shields.io/github/v/tag/CalDymos/vscode-pb-lang-suite?sort=semver&filter=pbp-v*&label=pbp)](https://github.com/CalDymos/vscode-pb-lang-suite/tags)

Workspace project/target management for PureBasic **.pbp** projects.

This extension is designed as an **optional companion** for [**PureBasic Language Services (pb-lang-support)**](https://marketplace.visualstudio.com/items?itemName=CalDymos.pb-lang-support)  .
If installed, it provides project context (active project/target, include directories, project file lists) to pb-lang-support via LSP notifications.

## Features

- Discover **.pbp** projects in the current workspace
- Cache parsed projects (via **@caldymos/pb-project-core**)
- Track **active project / active target** (auto-sync from active editor, QuickPick)
- Provide a **Status Bar project menu** with direct actions for project and target management
- Show **compact tail paths** for project entries in the Status Bar menu instead of full absolute paths
- Maintain a **file → project** map (including best-match fallback by project root)
- Show active project/target in the **Status Bar**
- Open **.pbp** files in a dedicated **webview-based project editor**
- Create new **.pbp** projects from the project picker
- Optionally use a **template .pbp** when creating new projects
- Register **.pbp** files as language **`purebasic-project`** with a dedicated file icon
- Customize the **Raw XML** view colors in the project editor

## Commands

- **PureBasic: Project Menu** (`pbProjectFiles.projectMenu`)
- **PureBasic: Select Active Project** (`pbProjectFiles.pickProject`)
- **PureBasic: Select Active Target** (`pbProjectFiles.pickTarget`)
- **PureBasic: Refresh Projects** (`pbProjectFiles.refresh`)
- **PureBasic: New PureBasic Project** (`pbProjectFiles.newProject`)
- **PureBasic: Open Active PureBasic Project** (`pbProjectFiles.openActiveProject`)
- **PureBasic: Reveal Active PureBasic Project Directory** (`pbProjectFiles.revealActiveProjectDirectory`)
- **PureBasic: Open Active PureBasic Project and Reveal Directory** (`pbProjectFiles.openActiveProjectAndRevealDirectory`)

## Custom Editor

Opening a **.pbp** file in VS Code will automatically use the built-in **PureBasic Project Editor** (viewType: `pbProjectFiles.pbpEditor`).
It provides a visual interface for managing project files, build targets, and project options — closely replicating the experience of the original PureBasic IDE.

Clicking the Status Bar item opens a project menu with:

- **New Project…** to create a new `.pbp` file
- **Open Active Project and Reveal Directory** to open the active `.pbp` in the project editor and reveal its directory in the VS Code Explorer
- **Reveal Active Project Directory** to jump to the active project directory in the VS Code Explorer
- **No Project** to explicitly disable project context for the current workspace
- **Select Project/Target …** target entries grouped by project when multiple `.pbp` files exist, with a dedicated section header separating the target list from the other menu actions

The classic project and target pickers remain available through the command palette.

When creating a new project, the editor can either:

- start from a minimal default project, or
- copy targets, libraries, and compiler options from a configured template file

## Configuration

| Setting | Type | Default | Description |
|---|---|---|---|
| `purebasicProjectEditor.newProject.templateFile` | `string` | `""` | Absolute path to a `.pbp` file used as template when creating a new project. The template's targets, libraries, and compiler options are copied; name and data section are reset. Leave empty to start with a minimal default project. |
| `purebasicProjectEditor.inactiveTabForeground` | `string` | `""` | Foreground color for inactive tabs in the project editor. Accepts any valid hex color value. Falls back to the VS Code theme default when empty. |
| `purebasicProjectEditor.xmlTagColor` | `string` | `""` | Color for XML tag names in the Raw XML view. |
| `purebasicProjectEditor.xmlAttributeColor` | `string` | `""` | Color for XML attribute names in the Raw XML view. |
| `purebasicProjectEditor.xmlValueColor` | `string` | `""` | Color for XML attribute values in the Raw XML view. |
| `purebasicProjectEditor.xmlBracketColor` | `string` | `""` | Color for XML brackets and punctuation in the Raw XML view. |
| `purebasicProjectEditor.xmlCommentColor` | `string` | `""` | Color for XML comments in the Raw XML view. |
| `purebasicProjectEditor.xmlProcInstColor` | `string` | `""` | Color for XML processing instructions in the Raw XML view. |

## Extension API

`pb-project-files` exposes a versioned public API (`version: 3`) that other extensions can consume to access project context at runtime.

**Acquiring the API:**

```ts
const ext = vscode.extensions.getExtension<PbProjectFilesApi>('CalDymos.pb-project-files');
const api = await ext?.activate();
```

**Available methods:**

| Method | Description |
|---|---|
| `getActiveContext()` | Returns the active `PbpProject` and `PbpTarget` objects |
| `getActiveContextPayload()` | Returns a serializable payload with project file, project directory, project name, target name, derived project source/include files, and the parsed project/target models |
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
- `.pbp` files are registered as their own VS Code language identifier: **`purebasic-project`**.
