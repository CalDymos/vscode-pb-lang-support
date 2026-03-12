# PureBasic Forms Editor for VSCode

[![pb-forms-editor](https://img.shields.io/github/v/tag/CalDymos/vscode-pb-lang-suite?sort=semver&filter=forms-v*&label=forms)](https://github.com/CalDymos/vscode-pb-lang-suite/tags)

A Visual Studio Code extension that provides a lightweight editor workflow for PureBasic **Form Designer** blocks, including a custom webview designer, text/designer switching, and safe patching of form definitions.

## Features

### Form Designer Workflow 🧩

- Opens `.pbf` files in a dedicated **PureBasic Form Designer** custom editor
- Includes commands to switch between **designer mode** and **text mode**:
  - `Open Form as Text`
  - `Open in Form Designer`
- Prevents duplicate editor tabs when switching modes by closing the opposite tab type automatically
- Uses the `purebasic-form` language for `.pbf` text mode when available through **pb-lang-support**

### Form Designer Parsing 🧩

- Recognizes PureBasic Form Designer headers (e.g. `; Form Designer for PureBasic - x.xx`)
- Scopes parsing to the Form Designer block (from the header up to `; IDE Options`, if present)
- Supports Form Designer style assignments, e.g.  
  `Button_0 = ButtonGadget(#PB_Any, ...)`  
  `Window_0 = OpenWindow(#PB_Any, ...)`
- Detects Form Designer metadata such as header version, strict-syntax warning markers, and scan range

### Visual Editing & Patching 🧷

- Drag and resize gadgets directly in the designer canvas
- Patches gadget and window coordinates back into the `.pbf` source
- Supports safe patching for:
  - form window geometry
  - gadget geometry
  - gadget items (`AddGadgetItem`)
  - gadget columns (`AddGadgetColumn`)
  - menu entries
  - toolbar entries
  - status bar fields
- Preserves left-side assignments (if present)
- Supports multi-line call patching

### Stable Patching Model

- Stable gadget key selection for reliable patching:
  - If the first parameter is `#PB_Any`, the assigned variable name (left side) is used as key
  - Otherwise the first parameter is used (e.g. `#Button_0`)
- Stable window handling for both `#PB_Any` and enumeration-based `OpenWindow(...)` forms
- Supports `Enumeration FormWindow` / `Enumeration FormGadget` parsing and window enum updates
- Resolves `OpenWindow(...)` procedure default parameters for `x`, `y`, `width`, and `height` when present

> ⚠️ Still in development

## Related Extensions

- **PureBasic Language Support** – Syntax highlighting, snippets, and language tooling  
  [![pb-lang-support](https://img.shields.io/github/v/tag/CalDymos/vscode-pb-lang-suite?sort=semver&filter=lang-v*&label=lang)](https://github.com/CalDymos/vscode-pb-lang-suite/tags)  
  **Repo:** [PureBasic Language Service Extension](https://github.com/CalDymos/vscode-pb-lang-suite/tree/main/packages/pb-lang-support)

- **PureBasic Project File Support**
  [![pb-project-files](https://img.shields.io/github/v/tag/CalDymos/vscode-pb-lang-suite?sort=semver&filter=pbp-v*&label=pbp)](https://github.com/CalDymos/vscode-pb-lang-suite/tags)  
  **Repo:** [PureBasic Project File Support Extension](https://github.com/CalDymos/vscode-pb-lang-suite/tree/main/packages/pb-project-files)
  
## Installation

### Development Version

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm -w packages/pb-forms-editor run compile` to compile TypeScript
4. Press **F5** in VSCode to start debugging (launch config: *Run pb-forms-editor*)

### Release Version

Install **pb-forms-editor** from the VSCode Extension Marketplace.

For `.pbf` text-mode syntax highlighting, install **pb-lang-support** as well. The package already declares it as an `extensionDependency`.

## Configuration

You can configure the Forms Editor via:

- VSCode Settings (**Ctrl+,**)
- Search for **"PureBasic Forms"** / **"Forms Designer"**

### Grid & Snapping

```json
{
  "purebasicFormsDesigner.showGrid": true,
  "purebasicFormsDesigner.gridMode": "dots",
  "purebasicFormsDesigner.gridSize": 10,
  "purebasicFormsDesigner.gridOpacity": 0.14,
  "purebasicFormsDesigner.snapToGrid": false,
  "purebasicFormsDesigner.snapMode": "drop"
}
```

**Settings**

- `purebasicFormsDesigner.showGrid` *(boolean)*: Show or hide the canvas grid.
- `purebasicFormsDesigner.gridMode` *(string: `"dots"` | `"lines"`)*: Grid rendering style.
- `purebasicFormsDesigner.gridSize` *(number, 2..100)*: Grid spacing.
- `purebasicFormsDesigner.gridOpacity` *(number, 0.02..0.5)*: Grid opacity.
- `purebasicFormsDesigner.snapToGrid` *(boolean)*: Snap controls and windows to the grid.
- `purebasicFormsDesigner.snapMode` *(string: `"live"` | `"drop"`)*: Apply snapping while dragging (`live`) or only after releasing the mouse (`drop`).

### Canvas Appearance

```json
{
  "purebasicFormsDesigner.canvasBackground": "",
  "purebasicFormsDesigner.canvasReadonlyBackground": "",
  "purebasicFormsDesigner.windowFillOpacity": 0.05,
  "purebasicFormsDesigner.outsideDimOpacity": 0.12,
  "purebasicFormsDesigner.titleBarHeight": 26
}
```

**Settings**

- `purebasicFormsDesigner.canvasBackground` *(string)*: Optional CSS color for the designer background. Empty uses the theme editor background.
- `purebasicFormsDesigner.canvasReadonlyBackground` *(string)*: Optional CSS color for the designer background when the form is read-only. Empty uses the theme editor background.
- `purebasicFormsDesigner.windowFillOpacity` *(number, 0..0.25)*: Fill opacity for window areas.
- `purebasicFormsDesigner.outsideDimOpacity` *(number, 0..0.35)*: Dimming opacity outside the window bounds.
- `purebasicFormsDesigner.titleBarHeight` *(number, 0..60)*: Title bar height used by the renderer.

### Version Check (Optional)

```json
{
  "purebasicFormsDesigner.expectedPbVersion": ""
}
```

- `purebasicFormsDesigner.expectedPbVersion` *(string)*: If set, the extension warns when the `.pbf` header PureBasic version differs from the expected value.

## Usage

1. Open a `.pbf` file that contains a PureBasic Form Designer block
2. The file opens in the custom designer by default
3. Use the property and structure panes to inspect supported form elements
4. Drag or resize gadgets and windows in the canvas
5. Use **Open Form as Text** to reopen the same file in text mode
6. Use **Open in Form Designer** to switch back to the visual editor

## Notes

- Parsing and patching are limited to the Form Designer block (header → `; IDE Options`, if present).
- The extension expects a registered `purebasic-form` language for text-mode highlighting.
- Patching preserves the original assignment expression on the left side when possible.
- Unsupported or ambiguous constructs are surfaced as structured diagnostics inside the designer model.

## Development

### Project Structure (Package)

```text
packages/pb-forms-editor/
├── icons
│   ├── application_view_form.png
│   └── application_view_text.png
├── samples
├── .vscodeignore
├── package.json
├── src/
├── out/
├── README.md
├── tsconfig.json
├── LICENSE
├── icon.png
└── ...
```

### Build and Test

- `npm -w packages/pb-forms-editor run compile`: Compile TypeScript
- `F5`: Start extension debugging (Extension Development Host)

## License

MIT License

---

**PureBasic** is a registered trademark of Fantaisie Software. This extension is not affiliated with or endorsed by Fantaisie Software.
