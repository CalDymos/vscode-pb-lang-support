# PureBasic VS Code Language Suite (Monorepo)

[![suite](https://img.shields.io/github/v/tag/CalDymos/vscode-pb-lang-suite?sort=semver&filter=suite-v*&label=suite)](https://github.com/CalDymos/vscode-pb-lang-suite/tags)
[![pb-lang-support](https://img.shields.io/github/v/tag/CalDymos/vscode-pb-lang-suite?sort=semver&filter=lang-v*&label=lang)](https://github.com/CalDymos/vscode-pb-lang-suite/tags)
[![pb-project-files](https://img.shields.io/github/v/tag/CalDymos/vscode-pb-lang-suite?sort=semver&filter=pbp-v*&label=pbp)](https://github.com/CalDymos/vscode-pb-lang-suite/tags)
[![pb-forms-editor](https://img.shields.io/github/v/tag/CalDymos/vscode-pb-lang-suite?sort=semver&filter=forms-v*&label=forms)](https://github.com/CalDymos/vscode-pb-lang-suite/tags)

This repository contains multiple VS Code extensions related to PureBasic.

## Packages

- [packages/pb-lang-support](packages/pb-lang-support)  
  PureBasic language support (TextMate grammar + Language Server for `.pb` & `.pbi`).

- [packages/pb-forms-editor](packages/pb-forms-editor)  
  PureBasic Forms editor (custom editor for `.pbf` files).

- [packages/pb-project-files](packages/pb-project-files)  
  Optional companion extension for `.pbp` project discovery, active target selection, and workspace project context.

- [packages/pb-project-core](packages/pb-project-core)  
  Shared library used by the suite for parsing and resolving `.pbp` projects.

> **(Work in progress)**

## Branch Development Strategy

This repository uses a two-branch model:

- `main` is the **default** and **stable/release** branch  
  (tested changes only, version tags are created from here)
- `devel` is the **integration/development** branch  
  (day-to-day development and PR target)

Typical flow:

- feature branch -> PR -> `devel`
- release PR: `devel` -> `main`
- (optional) hotfix: `main` -> `devel` back-merge after the fix

## Development

### Prerequisites

- Node.js (Node 20 recommended)
- npm

### Install

```bash
npm ci
```

### Build (all packages)

```bash
npm run c
```

### Build (single package)

```bash
npm run c:core
npm run c:lang
npm run c:forms
npm run c:pbp
```

### Build VSIX locally

This creates `pb-lang-support.vsix`, `pb-forms-editor.vsix` and `pb-project-files.vsix` in the repository root.

```bash
npm run vsix
```

### Run (Debug)

Open this repo in VS Code and use the provided launch configurations.

If you want to test "Project Mode" (workspace `.pbp` context + active target selection), use the launch config **"Run lang + project-files"**.

## Project Mode (optional)

`pb-lang-support` works standalone.

If you also install **pb-project-files**, it adds a workspace-level PureBasic project context:

- Discovers `.pbp` files in the workspace and keeps a cache.
- Watches `.pbp` changes and updates the cache.
- Tracks an "active project" and "active target" (syncs from the active editor and via QuickPick commands).
- Shows a status bar entry like `PB: MyProject.pbp  [Default]`.

When **both** extensions are installed, `pb-lang-support` can consume this context to scope workspace operations to the active project.

## Versioning & Tags

This repo uses annotated version tags:

- suite: `suite-vX.Y.Z`
- pb-lang-support: `lang-vX.Y.Z`
- pb-forms-editor: `forms-vX.Y.Z`
- pb-project-files: `pbp-vX.Y.Z`

> Note: `scripts/tag-and-push.mjs` only tags suite/forms/lang/pbp.

Create and push tags from `main`:

```bash
npm run t:all
# or: npm run t:suite / npm run t:lang / npm run t:forms / npm run t:pbp
```

## CI / Workflows

See [.github/WORKFLOWS.md](.github/WORKFLOWS.md).

## Repository Structure

```text
├── .github
│   ├── workflows
│   │   ├── build-vsix.yml
│   │   └── pr-check.yml
│   └── WORKFLOWS.md
├── .vscode
│   ├── launch.json
│   └── tasks.json
├── package.json
├── packages/
│   ├── pb-forms-editor/  (VS Code Extension: purebasic Forms Editor)
│   ├── pb-lang-support/  (VS Code Extension: PureBasic language support for .pb/.pbi)
│   ├── pb-project-core/  (npm lib: shared lib for pbp handling)
│   └── pb-project-files/ (VS Code Extension: workspace project/target management for .pbp)
├── test/
├── README.md
├── LICENSE
├── .gitignore
└── .vscodeignore
```

## License

See `LICENSE`.
