# PureBasic Project Files (pb-project-files)

[![pb-project-files](https://img.shields.io/github/v/tag/CalDymos/vscode-pb-lang-suite?sort=semver&filter=pbp-v*&label=pbp)](https://github.com/CalDymos/vscode-pb-lang-suite/tags)

Workspace project/target management for PureBasic **.pbp** projects.

This extension is designed as an **optional companion** for **PureBasic Language Services (pb-lang-support)**.
If installed, it provides project context (active project/target, include directories, project file lists) to pb-lang-support via LSP notifications.

## Features

- Discover **.pbp** projects in the current workspace
- Cache parsed projects (via **@caldymos/pb-project-core**)
- Track **active project / active target** (auto-sync from active editor, QuickPick)
- Maintain a **file → project** map (including best-match fallback by project root)
- Show active project/target in the **Status Bar**

## Commands

- **PureBasic: Select Active Project** (`pbProjectFiles.pickProject`)
- **PureBasic: Select Active Target** (`pbProjectFiles.pickTarget`)
- **PureBasic: Refresh Projects** (`pbProjectFiles.refresh`)

## Notes

- This extension works standalone, but its main benefit is improved project-aware behavior in **pb-lang-support**.
- If pb-lang-support is not installed, the extension still provides project/target selection and Status Bar display.
