# PureBasic Language Services for VSCode

[![pb-lang-support](https://img.shields.io/github/v/tag/CalDymos/vscode-pb-lang-suite?sort=semver&filter=lang-v*&label=lang)](https://github.com/CalDymos/vscode-pb-lang-suite/tags)

**PureBasic Language Services** is a Visual Studio Code extension that provides PureBasic language support,
including `IntelliSense`, `Debugging`, and `Code Navigation`. It supports PureBasic source files (`.pb`, `.pbi`) and also provides text-mode language support for PureBasic Forms files (`.pbf`). (For project management and form creation, see [Related Extensions](#related-extensions))

> Developer/Contributor docs (build, architecture, API reference): see [.github/README.md](https://github.com/CalDymos/vscode-pb-lang-suite/blob/main/packages/pb-lang-support/.github/README.md) in the repository.

## Features

> Keyboard shortcuts follow VS Code defaults.

### Editor 🧩

- Syntax Highlighting
- Syntax highlighting for PureBasic Forms text mode (`.pbf`)
- Code Folding (procedures/loops/conditionals)
- Bracket & Quote Matching
- Format Document: `Shift+Alt+F`

### IntelliSense ⚡

- Completion: `Ctrl+Space`
- Signature Help (type `(` / hover)
- Hover Documentation & Type Info
- Outline: `Ctrl+Shift+O`
- Built-in PureBasic functions in completion, hover, and signature help

### Navigation & Refactoring 🧭

- Go to Definition: `F12`
- Find References: `Shift+F12`
- Rename Symbol: `F2`

### Diagnostics 🛡️

- Live Diagnostics
- Code Actions (quick fixes/refactorings)
- Missing include file diagnostics
- `IncludeBinary` diagnostics for invalid usage outside a `DataSection`

### PureBasic 🟦

- Modules: `Module::Function`
- Structures: member access via `\`
- Constants: `#CONSTANT`
- Arrays / Lists / Maps IntelliSense
- Structure member completion, including chained access and `With` blocks
- Type completion after `.` for type suffixes, built-in types, structures, and interfaces
- Native OS API IntelliSense (via PureBasic `APIFunctionListing.txt`)
  - Loads OS-specific API functions from your PureBasic installation (`Compilers/APIFunctionListing.txt`)
  - Provides Completion + Signature Help (including inline comments, if present in the listing)
  - Windows-only minimal fallback suggestions if the listing is not configured/available
- Common PB subsystems: Graphics/Game, Network, Database, Threading

### Compiler / Build / Run Integration (Toolchain) 🐞

- Build Active Target command
- Run Active Target command
- Build & Run Active Target command
- Standalone fallback build context when no `.pbp` project is active
  - PureBasic IDE metadata in the source file
  - `.vscode/launch.json`
  - `<filename>.pb.cfg`
  - `project.cfg`
- Run mode selection for executable launch
  - `spawn` for output-channel based execution
  - `terminal` for interactive console programs
- Breakpoints: Set breakpoints in your PureBasic code
- Step Debugging: Step Over, Step Into, Step Out
- Variable Inspection: View local and global variables
- Call Stack: Navigate through the call stack

## Related Extensions

`pb-lang-support` works standalone. For an expanded PureBasic workflow, you can optionally install:

- **PureBasic Project Files**  
  [![pb-project-files](https://img.shields.io/github/v/tag/CalDymos/vscode-pb-lang-suite?sort=semver&filter=pbp-v*&label=pbp)](https://github.com/CalDymos/vscode-pb-lang-suite/tags)  
  Adds workspace-level `.pbp` project discovery, active target selection, and project context.  
  [**View in Marketplace**](https://marketplace.visualstudio.com/items?itemName=CalDymos.pb-project-files)  
  [**View Repo**](https://github.com/CalDymos/vscode-pb-lang-suite/tree/main/packages/pb-project-files)

- **PureBasic Forms Editor**  
  [![pb-forms-editor](https://img.shields.io/github/v/tag/CalDymos/vscode-pb-lang-suite?sort=semver&filter=forms-v*&label=forms)](https://github.com/CalDymos/vscode-pb-lang-suite/tags)  
  Visual designer and tooling for PureBasic Forms (`.pbf`). `pb-lang-support` adds the text-mode language support for these files.  
  [**View in Marketplace**](https://marketplace.visualstudio.com/items?itemName=CalDymos.pb-forms-editor)  
  [**View Repo**](https://github.com/CalDymos/vscode-pb-lang-suite/tree/main/packages/pb-forms-editor)

## Installation

Search for [PureBasic Language Services](https://marketplace.visualstudio.com/items?itemName=CalDymos.pb-lang-support) in the VSCode Extension Marketplace and install

## Configuration

The extension provides some configuration options. Access these via:

- VSCode Settings (`Ctrl`+`,`)
- Search for "PureBasic" to see all available options

### Common Settings

```json
{
  "purebasic.apiFunctionListingPath": "C:/PureBasic/Compilers/APIFunctionListing.txt",
  "purebasic.build.compiler": "pbcompiler",
  "purebasic.build.fallbackSource": "launchJson",
  "purebasic.run.mode": "spawn"
}
```

## Usage

### Writing Code

1. Open any `.pb` or `.pbi` file
2. Start typing to see auto-completion suggestions
3. Hover over functions to see documentation
4. Press `F12` to jump to definitions

### Editing Forms as Text

1. Open any `.pbf` file in text mode
2. Edit the form source with PureBasic syntax highlighting
3. Use the same editor tooling for navigation, formatting, and symbol-based features where applicable

### Quick Debug Setup

1. Open your `.pb` file in VSCode
2. Press `F5` or go to Run → Start Debugging
3. The debugger will automatically compile and run your program

### Quick Build / Run Setup

1. Open a PureBasic source file
2. Run `PureBasic: Build Active Target`, `PureBasic: Run Active Target`, or `PureBasic: Build & Run Active Target`
3. With `pb-project-files`, the active `.pbp` target is used automatically
4. Without `pb-project-files`, the extension uses the configured fallback source

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `F5` | Start Debugging |
| `F10` | Step Over |
| `F11` | Step Into |
| `Shift+F11` | Step Out |
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
- `PureBasic: Build Active Target` — Compile the active target or fallback source
- `PureBasic: Run Active Target` — Run the resolved executable
- `PureBasic: Build & Run Active Target` — Build and then run the resolved executable

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
