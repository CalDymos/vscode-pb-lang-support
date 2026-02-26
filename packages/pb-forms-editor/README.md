# PureBasic Forms Editor for VSCode

[![pb-forms-editor](https://img.shields.io/github/v/tag/CalDymos/vscode-pb-lang-suite?sort=semver&filter=forms-v*&label=forms)](https://github.com/CalDymos/vscode-pb-lang-suite/tags)

A Visual Studio Code extension that provides a lightweight editor workflow for PureBasic **Form Designer** blocks, including safe patching of gadget/window coordinates after drag operations.

## Features

### Form Designer Parsing

- ✅ **Recognizes PureBasic Form Designer headers** (e.g. `; Form Designer for PureBasic - x.xx`)
- ✅ **Scopes parsing to the Form Designer block** (from the header up to `; IDE Options`, if present)
- ✅ **Supports Form Designer style assignments**, for example:
  - `Button_0 = ButtonGadget(#PB_Any, ...)`
  - `Window_0 = OpenWindow(#PB_Any, ...)`

### Stable Patching Model

- ✅ **Stable gadget key selection** for reliable patching:
  - If the first parameter is `#PB_Any`, the assigned variable name (left side) is used as key
  - Otherwise the first parameter is used (e.g. `#Button_0`)
- ✅ **Multi-line call patching**
- ✅ **Preserves left-side assignments** (if present)

> ⚠️ Still in development: currently only **x/y** are patched when dragging.

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

Install **pb-forms-editor** from the VSCode Extension Marketplace (once published).

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

- `purebasicFormsDesigner.showGrid` *(boolean)*: Show/hide the canvas grid.
- `purebasicFormsDesigner.gridMode` *(string: "dots" | "lines")*: Grid rendering style.
- `purebasicFormsDesigner.gridSize` *(number, 2..100)*: Grid spacing.
- `purebasicFormsDesigner.gridOpacity` *(number, 0.02..0.5)*: Grid opacity.
- `purebasicFormsDesigner.snapToGrid` *(boolean)*: Snap controls/windows to the grid.
- `purebasicFormsDesigner.snapMode` *(string: "live" | "drop")*: Apply snapping while dragging (`live`) or only after releasing the mouse (`drop`).

### Canvas Appearance

```json
{
  "purebasicFormsDesigner.canvasBackground": "",
  "purebasicFormsDesigner.windowFillOpacity": 0.05,
  "purebasicFormsDesigner.outsideDimOpacity": 0.12,
  "purebasicFormsDesigner.titleBarHeight": 26
}
```

**Settings**

- `purebasicFormsDesigner.canvasBackground` *(string)*: Canvas background (e.g. CSS color like `"#202020"` or `"rgb(30,30,30)"`). Empty string uses the default.
- `purebasicFormsDesigner.windowFillOpacity` *(number, 0..0.25)*: Fill opacity for window areas.
- `purebasicFormsDesigner.outsideDimOpacity` *(number, 0..0.35)*: Dimming opacity outside the window bounds.
- `purebasicFormsDesigner.titleBarHeight` *(number, 0..60)*: Title bar height used by the renderer.

### Version Check (Optional)

```json
{
  "purebasicFormsDesigner.expectedPbVersion": ""
}
```

- `purebasicFormsDesigner.expectedPbVersion` *(string)*: If set, the extension can warn when the `.pbf` header version differs from the expected PureBasic version.

## Usage

1. Open a `.pbf` file that contains a PureBasic Form Designer block
2. Use the Forms Editor workflow to adjust controls/windows
3. Drag gadgets/windows; the extension patches the corresponding x/y in the Form Designer code

## Notes

- Parsing/patching is limited to the Form Designer block (header → `; IDE Options`, if present).
- Patching preserves the original assignment expression on the left side (if any).

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
