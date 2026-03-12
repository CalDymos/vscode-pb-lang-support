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
- Detects Form Designer metadata such as header version and scan range

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
- Can work with `Enumeration FormWindow` / `Enumeration FormGadget` blocks inside the Form Designer section

> ⚠️ Still in development

## Related Extensions

- **PureBasic Language Support** – Syntax highlighting, snippets, and language tooling  
  [![pb-lang-support](https://img.shields.io/github/v/tag/CalDymos/vscode-pb-lang-suite?sort=semver&filter=lang-v*&label=lang)](https://github.com/CalDymos/vscode-pb-lang-suite/tags)  
  [**View in Marketplace**](https://marketplace.visualstudio.com/items?itemName=CalDymos.pb-lang-support)  
  [**View Repo**](https://github.com/CalDymos/vscode-pb-lang-suite/tree/main/packages/pb-lang-support)
  
- **PureBasic Project Files**  
  [![pb-project-files](https://img.shields.io/github/v/tag/CalDymos/vscode-pb-lang-suite?sort=semver&filter=pbp-v*&label=pbp)](https://github.com/CalDymos/vscode-pb-lang-suite/tags)  
  Adds workspace-level `.pbp` project discovery, active target selection, and project context.  
  [**View in Marketplace**](https://marketplace.visualstudio.com/items?itemName=CalDymos.pb-project-files)  
  [**View Repo**](https://github.com/CalDymos/vscode-pb-lang-suite/tree/main/packages/pb-project-files)
  
## Installation

Install **pb-forms-editor** from the VSCode Extension Marketplace.

For the best `.pbf` text-mode experience, also install **pb-lang-support**.

## Configuration

You can configure the Forms Editor via:

- VSCode Settings (`Ctrl`+`,`)
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

- `purebasicFormsDesigner.showGrid` *(boolean)*: Show or hide the canvas grid.
- `purebasicFormsDesigner.gridMode` *(string: `"dots"` | `"lines"`)*: Grid rendering mode.
- `purebasicFormsDesigner.gridSize` *(number, 2..100)*: Grid cell size in pixels.
- `purebasicFormsDesigner.gridOpacity` *(number, 0.02..0.5)*: Grid opacity inside the form window.
- `purebasicFormsDesigner.snapToGrid` *(boolean)*: Snap gadgets and windows to the grid.
- `purebasicFormsDesigner.snapMode` *(string: `"live"` | `"drop"`)*: Apply snapping while dragging or only when the drag ends.

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

- `purebasicFormsDesigner.canvasBackground` *(string)*: Optional CSS color for the designer background. Empty uses the current editor background.
- `purebasicFormsDesigner.canvasReadonlyBackground` *(string)*: Optional CSS color for the designer background in read-only mode. Empty uses the current editor background.
- `purebasicFormsDesigner.windowFillOpacity` *(number, 0..0.25)*: Fill opacity for the form window area.
- `purebasicFormsDesigner.outsideDimOpacity` *(number, 0..0.35)*: Dimming opacity outside the window bounds.
- `purebasicFormsDesigner.titleBarHeight` *(number, 0..60)*: Title bar height rendered at the top of the form window.

### Version Check (Optional)

```json
{
  "purebasicFormsDesigner.expectedPbVersion": ""
}
```

- `purebasicFormsDesigner.expectedPbVersion` *(string)*: If set, the extension warns when the `.pbf` Form Designer header version differs from the expected PureBasic version.

## Usage

1. Open a `.pbf` file
2. The file opens in the **PureBasic Form Designer** custom editor
3. Select gadgets, menus, toolbars, or status bar sections in the designer UI
4. Drag or resize supported elements as needed
5. Use **Open Form as Text** when you want to inspect or edit the generated `.pbf` text directly
6. Use **Open in Form Designer** to switch back to the visual editor

## Notes

- Parsing and patching are limited to the Form Designer block (header → `; IDE Options`, if present).
- The text-mode language switch depends on a registered `purebasic-form` language provider.
- Patching preserves the original assignment expression on the left side when possible.
- The extension emits structured diagnostics in the designer when parsing finds issues in the form block.

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
