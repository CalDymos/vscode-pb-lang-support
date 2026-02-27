# PureBasic Language Services for VSCode

[![pb-lang-support](https://img.shields.io/github/v/tag/CalDymos/vscode-pb-lang-suite?sort=semver&filter=lang-v*&label=lang)](https://github.com/CalDymos/vscode-pb-lang-suite/tags)

`pb-lang-support` is a Visual Studio Code extension that provides comprehensive PureBasic language support via a TextMate grammar and a Language Server.

> Developer/Contributor docs (build, architecture, API reference): see `.github/README.md` in the repository.

## Features

> Keyboard shortcuts follow VS Code defaults.

### Editor 🧩

- Syntax Highlighting
- Code Folding (procedures/loops/conditionals)
- Bracket & Quote Matching
- Format Document: `Shift+Alt+F`

### IntelliSense ⚡

- Completion: `Ctrl+Space`
- Signature Help (type `(` / hover)
- Hover Documentation & Type Info
- Outline: `Ctrl+Shift+O`

### Navigation & Refactoring 🧭

- Go to Definition: `F12`
- Find References: `Shift+F12`
- Rename Symbol: `F2`

### Diagnostics 🛡️

- Live Diagnostics
- Code Actions (quick fixes/refactorings)

### PureBasic 🟦

- Modules: `Module::Function`
- Structures: member access via `\`
- Constants: `#CONSTANT`
- Arrays / Lists / Maps IntelliSense
- Windows API + common PB subsystems (Graphics/Game, etc.)

### Compiler / Build / Run Integration (Toolchain) 🐞

upcoming feature is **VS Code debugger integration** for PureBasic:

## Related Extensions

`pb-lang-support` works standalone. For an expanded PureBasic workflow, you can optionally install:

- **PureBasic Project Files**  
  [![pb-project-files](https://img.shields.io/github/v/tag/CalDymos/vscode-pb-lang-suite?sort=semver&filter=pbp-v*&label=pbp)](https://github.com/CalDymos/vscode-pb-lang-suite/tags)  
  Adds workspace-level `.pbp` project discovery, active target selection, and project context.  
  [**View in Marketplace**](https://marketplace.visualstudio.com/items?itemName=CalDymos.pb-project-files)  
  [**View Repo**](https://github.com/CalDymos/vscode-pb-lang-suite/tree/main/packages/pb-project-files)

- **PureBasic Forms Editor**  
  [![pb-forms-editor](https://img.shields.io/github/v/tag/CalDymos/vscode-pb-lang-suite?sort=semver&filter=forms-v*&label=forms)](https://github.com/CalDymos/vscode-pb-lang-suite/tags)  
  Visual designer and tooling for PureBasic Forms (`.pbf`).  
  [**View in Marketplace**](https://marketplace.visualstudio.com/items?itemName=CalDymos.pb-forms-editor)  
  [**View Repo**](https://github.com/CalDymos/vscode-pb-lang-suite/tree/main/packages/pb-forms-editor)

## Installation

Search for [PureBasic Language Services](https://marketplace.visualstudio.com/items?itemName=CalDymos.pb-lang-support) in the VSCode Extension Marketplace and install

## Configuration

The extension provides some configuration options. Access these via:

- VSCode Settings (`Ctrl+,)
- Search for "PureBasic" to see all available options

## Usage

### Writing Code

1. Open any `.pb` or `.pbi` file
2. Start typing to see auto-completion suggestions
3. Hover over functions to see documentation
4. Press `F12` to jump to definitions

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `F12` | Go to Definition |
| `Shift+F12` | Find All References |
| `F2` | Rename Symbol |
| `Ctrl+Space` | Trigger Suggestions |
| `Shift+Alt+F` | Format Document |

## Commands & Shortcuts

### ⌨️ Command Palette (`Ctrl+Shift+P`)

- `PureBasic: Show Diagnostics` — Problems panel
- `PureBasic: Restart Language Server` — Restart LSP
- `PureBasic: Clear Symbol Cache` — Clear symbol cache
- `PureBasic: Format Document` — Format file
- `PureBasic: Find Symbols` — Workspace symbol search

### 🧭 Shortcuts

- `F12` → Definition  
- `Shift+F12` → References  
- `Ctrl+Shift+O` → Symbols in file  
- `Ctrl+Shift+M` → Problems  
- `F2` → Rename  
- `Shift+Alt+F` → Format  
- `Ctrl+Space` → Suggestions  

## License

MIT License

---

**PureBasic** is a registered trademark of Fantaisie Software.  
This extension is not affiliated with or endorsed by Fantaisie Software.
