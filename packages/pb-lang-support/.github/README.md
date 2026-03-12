# PureBasic Language Services for VSCode

[![pb-lang-support](https://img.shields.io/github/v/tag/CalDymos/vscode-pb-lang-suite?sort=semver&filter=lang-v*&label=lang)](https://github.com/CalDymos/vscode-pb-lang-suite/tags)

`pb-lang-support` is a Visual Studio Code extension that provides comprehensive PureBasic language support via a TextMate grammar, a Language Server, host-side build/run integration, and a Debug Adapter.

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
- Built-in PureBasic function dataset shared by completion, hover, and signature help

### Navigation & Refactoring 🧭

- Go to Definition: `F12`
- Find References: `Shift+F12`
- Rename Symbol: `F2`

### Diagnostics 🛡️

- Live Diagnostics
- Code Actions (quick fixes/refactorings)
- Missing include file diagnostics
- `IncludeBinary` / `DataSection` validation

### PureBasic 🟦

- Modules: `Module::Function`
- Structures: member access via `\`
- Constants: `#CONSTANT`
- Arrays / Lists / Maps IntelliSense
- Structure member completion, including chained access and `With` blocks
- Type completion after `.` for suffixes, built-in types, structures, and interfaces
- Native OS API IntelliSense via `Compilers/APIFunctionListing.txt`
- Windows-only minimal API fallback suggestions when no listing is configured

### Compiler / Build / Run Integration (Toolchain) 🐞

- Build Active Target command
- Run Active Target command
- Build & Run Active Target command
- Standalone fallback resolution when no `.pbp` context is available
- Configurable run mode (`spawn` or `terminal`)
- VS Code debugger integration for PureBasic
  - Breakpoints
  - Step Over / Step Into / Step Out
  - Variable inspection
  - Call stack navigation

## Related Extensions

`pb-lang-support` works standalone. For an expanded PureBasic workflow, you can optionally install:

- **PureBasic Project Files**  
  [![pb-project-files](https://img.shields.io/github/v/tag/CalDymos/vscode-pb-lang-suite?sort=semver&filter=pbp-v*&label=pbp)](https://github.com/CalDymos/vscode-pb-lang-suite/tags)  
  Adds workspace-level `.pbp` project discovery, active target selection, and project context.  
  [**View in Marketplace**](https://marketplace.visualstudio.com/items?itemName=CalDymos.pb-project-files)  
  [**View Repo**](https://github.com/CalDymos/vscode-pb-lang-suite/tree/main/packages/pb-project-files)

- **PureBasic Forms Editor**  
  [![pb-forms-editor](https://img.shields.io/github/v/tag/CalDymos/vscode-pb-lang-suite?sort=semver&filter=forms-v*&label=forms)](https://github.com/CalDymos/vscode-pb-lang-suite/tags)  
  Visual designer and tooling for PureBasic Forms (`.pbf`). `pb-lang-support` contributes the text-mode language registration and grammar for `.pbf`.  
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
  "purebasic.build.compiler": "pbcompiler",
  "purebasic.build.fallbackSource": "launchJson",
  "purebasic.run.mode": "spawn"
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

### Fallback Build Context

When `pb-project-files` is not installed or no `.pbp` project is active, host-side toolchain commands resolve their context from one of four sources, configured via `purebasic.build.fallbackSource`:

- `sourceMetadata` - PureBasic IDE metadata block at the end of the current file
- `launchJson` - `.vscode/launch.json`
- `fileCfg` - `<filename>.pb.cfg` next to the current source file
- `projectCfg` - `project.cfg`, searched upward from the current source directory

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
│   │   ├── pbcompiler/                # Build/run helpers for pbcompiler and executables
│   │   └── utils/                     # Host-side metadata and utility helpers
│   ├── server/                        # Language server implementation
│   │   ├── config/                    # Server-side configuration management
│   │   ├── indexer/                   # Cross-file indexing helpers
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
- **Fallback Resolver**: Resolves build/run context without `.pbp` project support
- **Toolchain Commands**: Coordinates build, run, and build-and-run commands
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
