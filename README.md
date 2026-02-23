# PureBasic for VS Code Language Suite (Monorepo)

[![suite](https://img.shields.io/github/v/tag/CalDymos/vscode-pb-lang-suite?sort=semver&filter=suite-v*&label=suite)](https://github.com/CalDymos/vscode-pb-lang-suite/tags)
[![pb-lang-support](https://img.shields.io/github/v/tag/CalDymos/vscode-pb-lang-suite?sort=semver&filter=pb-lang-support-v*&label=pb-lang-support)](https://github.com/CalDymos/vscode-pb-lang-suite/tags)
[![pb-forms-editor](https://img.shields.io/github/v/tag/CalDymos/vscode-pb-lang-suite?sort=semver&filter=pb-forms-editor-v*&label=pb-forms-editor)](https://github.com/CalDymos/vscode-pb-lang-suite/tags)

This repository contains multiple VS Code extensions related to PureBasic.

## Packages

- [packages/pb-lang-support](packages/pb-lang-support)  
  PureBasic language support (syntax highlighting, snippets, basic tooling).

- [packages/pb-forms-editor](packages/pb-forms-editor)  
  PureBasic Forms editor (custom editor for `.pbf` files).

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
npm run c:l
npm run c:f
```

### Build VSIX locally

This creates `pb-lang-support.vsix` and `pb-forms-editor.vsix` in the repository root.

```bash
npm run vsix
```

### Run (Debug)

Open this repo in VS Code and use the provided launch configurations.

## Versioning & Tags

This repo uses annotated version tags:

- suite: `suite-vX.Y.Z`
- pb-lang-support: `pb-lang-support-vX.Y.Z`
- pb-forms-editor: `pb-forms-editor-vX.Y.Z`

Create and push tags from `main`:

```bash
npm run t:all
# or: npm run t:suite / npm run t:lang / npm run t:forms
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
│   ├── pb-lang-support/  (VS Code Extension: purbasic langue support)
│   ├── pb-project-core/  (npm lib: shared lib for pbp handling)
│   └── pb-project-files/ (VS Code Extension: future Purebasic Project File Management / UI)
├── test/
├── README.md
├── LICENSE
├── .gitignore
└── .vscodeignore
```

## License

See `LICENSE`.
