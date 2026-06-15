# PureBasic Language Services for VSCode

[![pb-lang-support](https://img.shields.io/github/v/tag/CalDymos/vscode-pb-lang-suite?sort=semver&filter=lang-v*&label=lang)](https://github.com/CalDymos/vscode-pb-lang-suite/tags)

**PureBasic Language Services** is a Visual Studio Code extension that provides PureBasic language support,
including `IntelliSense`, `Debugging`, and `Code Navigation`. It supports PureBasic source files (`.pb`, `.pbi`) and also provides text-mode language support for PureBasic Forms files (`.pbf`). (For project management and form creation, see [Related Extensions](#related-extensions))

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
- Built-in PureBasic functions in completion, hover, and signature help - updated for PureBasic 6.40.
- Built-In PureBasic constants in completion - updated for PureBasic 6.40.
- PureBasic Forms (`.pbf`): completion, hover and signature help for gadget, window, menu, toolbar and status bar commands.
- PureBasic Residents constants and structures in completion and hover (configure `purebasic.residentsPath` to index them)

### Navigation & Refactoring 🧭

- Go to Definition: `F12`
- Find References: `Shift+F12`
- Rename Symbol: `F2`

### Diagnostics 🛡️

- Live Diagnostics
- Code Actions (quick fixes/refactorings)
- Missing include file diagnostics
- `IncludeBinary` diagnostics for invalid usage outside a `DataSection`
- **PureBasic 6.40 migration diagnostics:**
  - Error when `#PB_String_InPlace` is used with `ReplaceString()` (flag removed in PureBasic 6.40), with migration hint
  - Warning when `Space()` is used as a Win32 API write buffer without a subsequent `PeekS()` length fixup (required since PureBasic 6.40 due to the reworked string manager)
  - Semantic validation can be disabled via `purebasic.linting.enableSemanticValidation: false` for large files where the analysis impacts responsiveness

### PureBasic 🟦

- Modules: `Module::Function`
- Structures: member access via `\`
- Constants: `#CONSTANT`
- String variables with `$` sigil (`myVar$`) — fully supported in completion, hover, go-to-definition and rename
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
- Syntax Check Active Target command
- Standalone fallback build context when no `.pbp` project is active
  - PureBasic IDE metadata in the source file (including `UseMainFile` resolution)
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

1. Clone this repository
2. Run `npm ci` to install dependencies
3. Run `npm run compile` to compile TypeScript
4. Press F5 in VSCode to start debugging

## Configuration

The extension provides some configuration options. Access these via:

- VSCode Settings (`Ctrl`+`,`)
- Search for "PureBasic" to see all available options

### Basic Configuration

```json
{
  "purebasic.maxNumberOfProblems": 100,
  "purebasic.enableValidation": true,
  "purebasic.enableCompletion": true,
  "purebasic.validationDelay": 500
}
```

### Formatting Configuration

```json
{
  "purebasic.formatting.enabled": true,
  "purebasic.formatting.indentSize": 4,
  "purebasic.formatting.tabSize": 4,
  "purebasic.formatting.insertSpaces": true,
  "purebasic.formatting.trimTrailingWhitespace": true,
  "purebasic.formatting.trimFinalNewlines": true
}
```

### Toolchain Configuration

```json
{
  "purebasic.apiFunctionListingPath": "C:/PureBasic/Compilers/APIFunctionListing.txt",
  "purebasic.residentsPath": "C:/PureBasic/Residents",
  "purebasic.build.compiler": "pbcompiler",
  "purebasic.build.fallbackSource": "launchJson",
  "purebasic.run.mode": "spawn",
  "purebasic.linting.enableSemanticValidation": true
}
```

### Performance Configuration

```json
{
  "purebasic.performance.enableIncrementalParsing": true,
  "purebasic.performance.maxFileSize": 1048576,
  "purebasic.symbols.cacheEnabled": true,
  "purebasic.symbols.cacheSize": 1000
}
```

### Completion Configuration

```json
{
  "purebasic.completion.triggerCharacters": [".", "(", "["],
  "purebasic.completion.autoClosingPairs": true,
  "purebasic.completion.suggestOnType": true
}
```

### Linting Configuration

```json
{
  "purebasic.linting.enableSemanticValidation": true,
  "purebasic.linting.checkUnusedVariables": true,
  "purebasic.linting.checkUndefinedSymbols": true,
  "purebasic.linting.enableCodeActions": true
}
```

### Commands

The extension provides several commands accessible via:

- Command Palette (`Ctrl`+`Shift`+`P`)
- Right-click context menu
- Keyboard shortcuts

#### Available Commands

- **PureBasic: Show Diagnostics** - Focus on the Problems panel
- **PureBasic: Restart Language Server** - Restart the language server
- **PureBasic: Clear Symbol Cache** - Clear the symbol cache
- **PureBasic: Format Document** - Format the current document
- **PureBasic: Find Symbols in Workspace** - Search for symbols across the workspace
- **PureBasic: Build Active Target** - Compile the active `.pbp` target or the resolved fallback input
- **PureBasic: Run Active Target** - Run the resolved executable from project or fallback context
- **PureBasic: Build & Run Active Target** - Compile and then run the resolved executable
- **PureBasic: Syntax Check** - Run a compiler syntax check on the active file or `.pbp` target; errors and warnings are shown as editor diagnostics and in the *PureBasic (Syntax Check)* output channel

### Fallback Build Context

When `pb-project-files` is not installed or no `.pbp` project is active, host-side toolchain commands resolve their context from one of four sources, configured via `purebasic.build.fallbackSource`:

- `pbMetadata` - PureBasic IDE metadata block at the end of the current file; `UseMainFile` declarations are followed to resolve the correct main source and compiler options
- `launchJson` - `.vscode/launch.json`; `${file}` and `${workspaceFolder}` variables are expanded and the `program` path is validated
- `pbCfg` - `<filename>.pb.cfg` next to the current source file
- `projectCfg` - `project.cfg`, searched upward from the current source directory to the workspace root

### Testing Features

Use the included test file (`test.pb`) to verify functionality:

```purebasic
; Test basic completion
SkipT  ; Should suggest SkipTest
SkipTest(  ; Should show parameter hint

; Test module completion
WindowUtils::  ; Should show TemplateMatch function

; Test go to definition (F12)
SkipTest  ; Right-click → Go to Definition

; Test find references (Shift+F12)
TemplateMatch  ; Right-click → Find All References

; Test hover information
SkipTest  ; Hover to see function signature

; Test document outline
; Press Ctrl+Shift+O to see document symbols

; Test rename symbol (F2)
SkipTest  ; Right-click → Rename Symbol

; Test code formatting (Shift+Alt+F)
; Format entire document or selected text

; Test enhanced arrays and lists
NewList MyList.s()  ; Should show list-specific completions
AddElement  ; Should suggest AddElement() with List Function type

; Test API functions
MessageBox_  ; Should show Windows API Function
LoadSprite  ; Should show Graphics/Game Function
```

## Example Code

```purebasic
; Simple PureBasic example
Procedure.i AddNumbers(a.i, b.i)
    ProcedureReturn a + b
EndProcedure

If OpenWindow(0, 0, 0, 400, 300, "PureBasic Window", #PB_Window_SystemMenu | #PB_Window_ScreenCentered)
    TextGadget(0, 10, 10, 200, 20, "Hello, PureBasic!")
    
    Repeat
        Event = WaitWindowEvent()
    Until Event = #PB_Event_CloseWindow
    
    CloseWindow(0)
EndIf
```

## Development

### Project Structure

``` text
pb-lang-support/
├── package.json                       # Extension configuration file
├── syntaxes/
│   ├── purebasic.tmLanguage.json      # Main PureBasic TextMate grammar
│   └── purebasic-form.tmLanguage.json # Text-mode grammar for .pbf files
├── language-configuration.json        # Language configuration
├── src/
│   ├── extension.ts                   # Extension entry point
│   ├── host/                          # Host-side project/build/run integration
│   │   ├── config/                    # Shared host settings access
│   │   ├── pbcompiler/                # Build/run/syntax-check helpers for pbcompiler
│   │   │   └── standby/               # Compiler standby protocol (command builder, parser, session, diagnostics)
│   │   └── utils/                     # Host-side metadata and utility helpers
│   ├── pbf/                           # .pbf text-mode IntelliSense providers
│   │   ├── builtins.ts                # Shared built-in data for .pbf providers
│   │   ├── completion-provider.ts
│   │   ├── hover-provider.ts
│   │   └── signature-provider.ts
│   ├── server/                        # Language server implementation
│   │   ├── config/                    # Server-side configuration management
│   │   ├── indexer/                   # Cross-file indexing helpers (including residents index)
│   │   ├── managers/                  # Document/project managers
│   │   ├── parsers/                   # Parser helpers
│   │   ├── providers/                 # Language feature providers
│   │   ├── symbols/                   # Symbol extraction/indexing
│   │   ├── utils/                     # Shared server utilities
│   │   └── validation/                # Diagnostics and validators
│   ├── debug/                         # Debug Adapter Protocol (DAP) implementation
│   │   ├── compiler/                  # Compiler/debug launch helpers
│   │   ├── protocol/                  # Debug protocol handling
│   │   ├── session/                   # Debug session management
│   │   ├── transport/                 # Pipe/FIFO/network/native transports
│   │   └── types/                     # DAP-related types
│   ├── shared/                        # Shared constants used by host/server
│   ├── data/                          # Generated/static datasets
│   └── types/                         # TypeScript type definitions
├── test/                              # Jest tests and debug protocol probes
├── snippets/                          # Code snippets
├── icons/                             # Extension icons
├── docs/                              # Additional design and debugger notes
├── README.md
└── .vscodeignore
```

### Architecture

The extension follows a modular architecture with clear separation of concerns:

#### Language Server

- **Main Server**: Handles LSP protocol communication
- **Configuration**: Manages settings and configuration updates
- **Providers**: Implement individual language features (completion, hover, signature help, rename, references, formatting, symbols)
- **Indexer / Symbols**: Manages cross-file symbol indexing and caching
- **Validation**: Provides syntax and semantic validation

#### Host / Unified Context

- **Project Integration**: Uses `pb-project-files` API v3 when available
- **Fallback Resolver**: Resolves build/run/syntax-check context without `.pbp` project support; reads PureBasic IDE metadata, `.pb.cfg`, and `project.cfg` and follows `UseMainFile` declarations
- **Toolchain Commands**: Coordinates build, run, build-and-run, and syntax check commands
- **Syntax Check**: Runs the compiler in standby mode (`/STANDBY` / `--standby`), sends a tab-separated command sequence, and maps the parsed response (warnings, syntax errors, compiler errors) to editor diagnostics
- **Residents Index**: Scans the configured Residents folder for `.pb` source files at startup and exposes their constants and structures to completion and hover providers
- **Shared Settings**: Centralized host-side access to PureBasic settings

#### Debug Adapter

- **Transport Layer**: Abstracted communication (pipe, FIFO, network, native)
- **Session Manager**: Maps PureBasic debugger protocol state to DAP
- **Compiler / Launch**: Builds the debuggee and starts the adapter transport

### Build and Test

#### Development Commands

- `npm install`: Install dependencies
- `npm run compile`: Compile TypeScript
- `npm run watch`: Watch for file changes and auto-compile
- `npm run test`: Run Jest tests
- `npm run test:watch`: Run tests in watch mode
- `npm run test:coverage`: Run tests with coverage report

#### Build Commands

- `npm run webpack`: Build with webpack (development)
- `npm run webpack:prod`: Build with webpack (production)
- `npm run webpack:watch`: Build with webpack in watch mode

#### Extension Commands

- `F5`: Start extension debugging in VSCode
- `Ctrl+Shift+B`: Build task

### Testing

The extension includes a Jest-based test suite and several debug protocol probes.

#### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Contributing

### Development Setup

1. **Prerequisites**
   - Node.js 20+
   - VSCode with TypeScript extension
   - PureBasic compiler (for build/debug testing)

2. **Setup Development Environment**

   ```bash
   # Clone repository (Monorepo)
   git clone https://github.com/CalDymos/vscode-pb-lang-suite.git
   cd vscode-pb-lang-suite/packages/pb-lang-support

   # Install dependencies
   npm ci

   # Compile TypeScript
   npm run compile

   # Run tests
   npm run test
   ```

3. **Development Workflow**

   ```bash
   # Watch mode for development
   npm run watch

   # Start debugging in VSCode
   # Open project in VSCode and press F5

   # Build extension package
   npm run webpack:prod
   npx vsce package
   ```

### Code Style Guidelines

- **TypeScript**: Strict mode enabled, comprehensive type definitions
- **Naming**: Use PascalCase for types/classes, camelCase for variables/functions
- **Comments**: JSDoc comments for public APIs where helpful
- **Error Handling**: Prefer centralized handling and typed fallbacks in host/server layers
- **Testing**: Add or update tests for user-visible changes

## Acknowledgements

This extension is based on [vscode-pb-lang-support](https://github.com/meimingqi222/vscode-pb-lang-support) by [meimingqi222](https://github.com/meimingqi222), which provided the initial PureBasic TextMate grammar and language support foundation.

It has since been significantly extended with a Language Server, Debug Adapter, build/run toolchain integration, and is now part of the [PureBasic VS Code Language Suite](https://github.com/CalDymos/vscode-pb-lang-suite) monorepo.
