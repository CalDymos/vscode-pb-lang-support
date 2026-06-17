# PureBasic Forms Editor for VSCode

[![pb-forms-editor](https://img.shields.io/github/v/tag/CalDymos/vscode-pb-lang-suite?sort=semver&filter=forms-v*&label=forms)](https://github.com/CalDymos/vscode-pb-lang-suite/tags)
![WIP](https://img.shields.io/badge/status-work%20in%20progress-orange)

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
- Supports PureBasic Form Designer 6.40 syntax (`CreateImageMenu`, `CreateToolbar` lowercase b, `Chr(9)` shortcut concatenation)

### Visual Editing & Patching 🧷

- Drag and resize gadgets directly in the designer canvas
- Patches gadget and window coordinates back into the `.pbf` source
- Supports safe patching for:
  - form window geometry and all window properties
  - gadget geometry, constructor arguments, and all managed properties
  - gadget items (`AddGadgetItem`) and columns (`AddGadgetColumn`)
  - menu entries, toolbar entries, and status bar fields
  - `ResizeGadget` expressions (LockLeft / LockRight / LockTop / LockBottom)
  - event bindings (gadget, menu, toolbar, window event loop)
  - image references (`LoadImage`, `CatchImage`, PB 6.40 image blocks)
  - font entries (`LoadFont`, `FormFont` enum block)
- Preserves left-side assignments (if present)
- Supports multi-line call patching

### Toolbox & Gadget Insertion 🧰

- Scrollable toolbox tree organized into categories (*Common Controls*, *Containers*, *Menus & Toolbars*) with original PureBasic IDE icons
- Click a toolbox item to enter placement mode; click the canvas to place the gadget at the exact position
- Snap-to-grid respected during placement; nested containers (`PanelGadget`, `ScrollAreaGadget`, `ContainerGadget`, `FrameGadget` with `#PB_Frame_Container`) are automatically targeted
- Double-click a toolbox item to insert at a default position immediately
- Delete a gadget (with all children, property lines, event bindings, and enum/global entries) in one atomic edit
- Reparent a gadget and its children into a different container or panel tab
- Canvas right-click context menu for gadgets, menu entries, toolbar entries, and statusbar fields
- `SplitterGadget` insert opens a two-child picker; mismatched parents are reparented automatically

### Platform-Accurate Preview Chrome 🎨

- Canvas renders a fully platform-accurate window frame, title bar, menu bar, toolbar, statusbar, and menu flyouts for **Windows 7**, **Windows 8**, **macOS**, and **Linux** — selectable via the `osSkin` setting independently of the host OS
- On Windows, the extension reads UI colors from the registry (`HKCU\Control Panel\Colors`) and combines them with CSS Level 4 system color keywords for accurate gradient, border, text, and selection-outline colors
- Per-skin title bar metrics: button layout, sizes, insets, and title baseline offsets (macOS: circles on the left; Linux: glyphs on the right; Windows 7/8: min/max/close on the right with correct sizing)
- Raster preview assets for title bar buttons, window title icon, `+` add-button icon, and submenu arrow indicator; vector fallbacks are used when assets are unavailable
- All gadget kinds render with native-accurate, skin-specific chrome:
  - *Text gadgets*: `StringGadget` and `IPAddressGadget` with native text-field border; `TextGadget` respects alignment and border flags; `HyperLinkGadget` with underlined link styling
  - *Buttons*: `ButtonGadget` renders with a Windows 7 two-tone gradient, Windows 8 flat style, or macOS/Linux rounded chrome
  - *Lists*: `TreeGadget`, `ListViewGadget`, `EditorGadget`, `ScintillaGadget` with native client area and actual gadget items
  - *Explorer gadgets*: `ListIconGadget` and `ExplorerListGadget` with native column headers and rows; `ExplorerTreeGadget` with tree list chrome
  - *Input gadgets*: `ComboBoxGadget` and `ExplorerComboGadget` with drop-down arrow; `SpinGadget` with up/down buttons; `ProgressBarGadget` with filled track (vertical orientation and Windows color variants)
  - *Frame and bars*: `FrameGadget` with OS-specific single, double, flat, and captioned frame styles; `TrackBarGadget` with native thumb, track, and tick marks; `ScrollBarGadget` with arrow buttons, thumb, and OS-specific track styling
  - *Checkables*: `CheckBoxGadget` and `OptionGadget` from raster assets with checkmark/dot fallback; `DateGadget` and `CalendarGadget` with OS-specific chrome and date icon
  - *Canvas/Web gadgets*: `CanvasGadget` and `OpenGLGadget` with framed native surface; `WebGadget` and `WebViewGadget` with browser-style client area
  - *Container and image gadgets*: `ContainerGadget` and `CustomGadget` with dedicated chrome; `ImageGadget` and `ButtonImageGadget` show the resolved assigned image when available
  - *Panel, ScrollArea, and Splitter*: original-style per-platform chrome (tabs, scrollbar arrows/thumbs, separator fill)
- Resolved images shown in menu flyout entries, toolbar `ToolBarImageButton` entries, and statusbar image fields; a small fallback icon is shown when no image is assigned
- Configurable canvas padding so the window border is never clipped at the canvas edge
- Resize grip rendered in the bottom-right corner of the window preview

### Inspector & Structural Editing ✏️

- **Window inspector**: Caption (with *Caption is variable* toggle), known flag checkboxes plus *Custom Flags*, Hidden/Disabled, Parent, Color (native color-swatch picker with *Remove* button), X/Y with `#PB_Ignore` support, Width/Height, Constants, and Event sections
- **Gadget inspector**: Caption and tooltip (with *is variable* toggle), colors (front/back), font, range fields (min/max with kind-specific labels), checked state for `CheckBoxGadget` / `OptionGadget`, LockLeft/Right/Top/Bottom (editable), `#PB_Any` checkbox and Variable field, CustomGadget-specific fields (SelectGadget, InitCode, CreateCode, Help)
- **Gadget `#PB_Any` toggle**: Switching a gadget from an enum constant to `#PB_Any` rewrites the `Enumeration FormGadget` block, inserts a `Global` declaration, rewrites the constructor call, and propagates the change to all usages in the procedure scope — and vice versa
- **Image `#PB_Any` toggle**: Available in the statusbar field, toolbar entry, menu entry, and gadget image inspector; switching between a named enum ID and a `#PB_Any` variable updates all `ImageID(...)` references in the form
- **Editable CurrentImage**: Typing an existing image ID in the statusbar field or toolbar entry inspector rebinds the field and optionally removes the orphaned old entry; typing a file path auto-creates a new `LoadImage` entry
- **SelectProc autocomplete**: All SelectProc fields use an editable combo with suggestions from procedure names found in the `.pbf` document and its event-file sibling; refreshes automatically when workspace files change
- **Info panel**: Context-aware one-line selection summary and hint above the properties panel
- **Resizable properties panel**: Draggable vertical divider between canvas and properties panel (300–900 px)
- All formerly prompt-based dialogs are now inline panels — no browser pop-ups

### Stable Patching Model

- Stable gadget key selection for reliable patching:
  - If the first parameter is `#PB_Any`, the assigned variable name (left side) is used as key
  - Otherwise the first parameter is used (e.g. `#Button_0`)
- Stable window handling for both `#PB_Any` and enumeration-based `OpenWindow(...)` forms
- Can work with `Enumeration FormWindow` / `Enumeration FormGadget` blocks inside the Form Designer section

## Verified Support Matrix

The matrix below is based on the currently verified parser, patcher, preview-geometry and regression tests in this repository.  
**Verified** means there is a tested code path in the current suite. **Partial** means a working path exists, but parity or UX is still incomplete. **Not yet** means no verified end-to-end support is documented yet.

| Area | Status | Verified scope / current limitation |
| --- | --- | --- |
| Form Designer block detection and metadata | Verified | Detects the Form Designer header, limits parsing to the designer block, and keeps header/version scan metadata. |
| Window and gadget parsing / patching | Verified | Covers window geometry, `OpenWindow(...)` args, managed window lines, gadget geometry, gadget constructor args, `#PB_Any` / enum keys, and managed gadget properties such as tooltip, colors, hidden / disabled, state, resize locks, and `#PB_Any` toggle. |
| Gadget items and columns | Verified | `AddGadgetItem(...)` and `AddGadgetColumn(...)` insert / update / delete roundtrips are covered by dedicated tests. |
| Images and image references | Verified | Covers `LoadImage(...)`, `CatchImage(...)`, PB 6.40 image blocks, decoder management, enum / `#PB_Any` image ids, cross references from gadgets, menus, toolbars and status bars, and the image `#PB_Any` toggle updating all `ImageID(...)` references. |
| Menus, toolbars and status bars | Verified | Insert / update / delete / move patch flows are covered, including submenu blocks, toolbar tooltips, status bar decorations and combined top-level chrome roundtrips. |
| Fonts | Verified | `LoadFont` parsing, insert, update, and delete; `FormFont` enum block kept in sync automatically. |
| Event bindings | Verified | Covers window include / default handler / `generateEventLoop`, plus gadget, menu and toolbar event proc patching in real fixtures. |
| Container patching | Verified | Combined real-fixture patch / reparse flows are covered for `PanelGadget`, `ScrollAreaGadget` and `SplitterGadget`. |
| Toolbox and gadget insert / delete / reparent | Verified | Insert from toolbox with canvas click, delete with atomic cleanup, reparent into nested containers, SplitterGadget two-child picker. |
| Gadget `#PB_Any` / enum toggle | Verified | Full roundtrip: enum ↔ `#PB_Any` switch rewrites enum block, `Global` declaration, constructor, and all in-procedure usages. |
| Top-level preview chrome geometry and hit zones | Verified | Window frame, title bar, menu bar, toolbar, statusbar, resize button, preview scrollbars and top-level menu / toolbar / statusbar reordering are covered by dedicated geometry and regression tests; documented Webview UX deviations are intentional. |
| Platform-accurate window chrome | Verified | Windows 7, Windows 8, macOS, and Linux skins are implemented for title bar, frame, toolbar, statusbar, menu bar, flyouts and top-level hit zones; Windows system colors are read from the registry where available. |
| Native gadget chrome | Partial | All gadget kinds render with skin-specific chrome; image gadgets show resolved images. Remaining container / panel / scrollarea / splitter and fine rendering details are tracked separately. |
| Structural menu editing in the preview | Partial | Visible submenu flyouts, subtree move, structural delete and generated `OpenSubMenu(...)` / `CloseSubMenu()` insertion are implemented and tested. Custom footer entry kinds remain blocked until additional original evidence exists. |
| Preview-only local UI state | Partial | Active panel tabs are retained / synchronized by tested Webview state helpers; ScrollArea offsets are runtime-local Webview state and reset on model refresh. No `.pbf` source persistence is currently documented or verified for these UI-only values. |
| Undo / Redo | Not yet | No verified undo/redo support is implemented yet; the planned scope remains. |
| Performance validation on large forms | Not yet | Dedicated performance and stress validation for large forms and deeply nested containers is still open. |
| Full original Form Designer parity | Partial | The extension has broad tested coverage for implemented parser / patch / preview paths, but the migration remains ongoing. Release-candidate parity review is tracked separately. |

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
  "purebasicFormsDesigner.gridSize": 5,
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
  "purebasicFormsDesigner.titleBarHeight": 29,
  "purebasicFormsDesigner.windowPreviewWindowsCaptionlessTopPadding": 8,
  "purebasicFormsDesigner.windowPreviewWindowsClientSidePadding": 8,
  "purebasicFormsDesigner.windowPreviewWindowsClientBottomPadding": 8
}
```

- `purebasicFormsDesigner.canvasBackground` *(string)*: Optional CSS color for the designer background. Empty uses the current editor background.
- `purebasicFormsDesigner.canvasReadonlyBackground` *(string)*: Optional CSS color for the designer background in read-only mode. Empty uses the current editor background.
- `purebasicFormsDesigner.windowFillOpacity` *(number, 0..0.25)*: Fill opacity for the form window area.
- `purebasicFormsDesigner.outsideDimOpacity` *(number, 0..0.35)*: Dimming opacity outside the window bounds.
- `purebasicFormsDesigner.titleBarHeight` *(number, 0..60)*: Title bar height rendered at the top of the form window (Windows skin only; other skins derive this from per-skin metrics).
- `purebasicFormsDesigner.windowPreviewWindowsCaptionlessTopPadding` *(number, 0..60)*: Top padding area height for captionless windows on the Windows skin.
- `purebasicFormsDesigner.windowPreviewWindowsClientSidePadding` *(number, 0..60)*: Left/right client frame strip width on the Windows skin.
- `purebasicFormsDesigner.windowPreviewWindowsClientBottomPadding` *(number, 0..60)*: Bottom frame strip height on the Windows skin.

### OS Skin

```json
{
  "purebasicFormsDesigner.osSkin": "windows7"
}
```

- `purebasicFormsDesigner.osSkin` *(string: `"windows7"` | `"windows8"` | `"linux"` | `"macos"`)*: Platform skin used for the canvas preview, independent of the host OS.

### Gadget Insertion Behavior

```json
{
  "purebasicFormsDesigner.newGadgetsUsePbAnyByDefault": true,
  "purebasicFormsDesigner.newGadgetsUseVariableAsCaption": false,
  "purebasicFormsDesigner.generateEventProcedure": true
}
```

- `purebasicFormsDesigner.newGadgetsUsePbAnyByDefault` *(boolean)*: Whether newly inserted gadgets use `#PB_Any` or an enum constant.
- `purebasicFormsDesigner.newGadgetsUseVariableAsCaption` *(boolean)*: When enabled, newly inserted gadgets write their caption as a variable reference instead of a string literal.
- `purebasicFormsDesigner.generateEventProcedure` *(boolean)*: Whether an event procedure is generated automatically on gadget insert.

### Version Check & Compatibility Warnings

```json
{
  "purebasicFormsDesigner.expectedPbVersion": "",
  "purebasicFormsDesigner.warningUnrecognizedFile": "always",
  "purebasicFormsDesigner.warningVersionUpgrade": "ifBackwardCompatibilityIsAffected",
  "purebasicFormsDesigner.warningVersionDowngrade": "always"
}
```

- `purebasicFormsDesigner.expectedPbVersion` *(string)*: If set, the extension warns when the `.pbf` Form Designer header version differs from this expected PureBasic version.
- `purebasicFormsDesigner.warningUnrecognizedFile` *(string: `"never"` | `"always"`)*: Show a warning when a `.pbf` file does not contain a recognized Form Designer header.
- `purebasicFormsDesigner.warningVersionUpgrade` *(string: `"never"` | `"ifBackwardCompatibilityIsAffected"` | `"always"`)*: Show a warning when the form file version is newer than the expected version.
- `purebasicFormsDesigner.warningVersionDowngrade` *(string: `"never"` | `"always"`)*: Show a warning when the form file version is older than the expected version.

## Usage

1. Open a `.pbf` file
2. The file opens in the **PureBasic Form Designer** custom editor
3. Select gadgets, menus, toolbars, or status bar sections in the designer UI
4. Drag or resize supported elements as needed
5. Use the **toolbox** to insert new gadgets — click the canvas to place, or double-click a toolbox item for a default position
6. Use **Open Form as Text** when you want to inspect or edit the generated `.pbf` text directly
7. Use **Open in Form Designer** to switch back to the visual editor

## Notes

- Parsing and patching are limited to the Form Designer block (header → `; IDE Options`, if present).
- The text-mode language switch depends on a registered `purebasic-form` language provider.
- Patching preserves the original assignment expression on the left side when possible.
- The extension emits structured diagnostics in the designer when parsing finds issues in the form block.
- Windows system color integration requires the extension to be running on Windows; on other platforms the preview falls back to skin-defined constants.

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

- `npm -w packages/pb-forms-editor run compile`: Compile and bundle via webpack (development mode)
- `npm -w packages/pb-forms-editor run compile:webview`: Type-check the webview TypeScript
- `npm -w packages/pb-forms-editor run test`: Run the full test suite
- `F5`: Start extension debugging (Extension Development Host)

## License

MIT License

---

**PureBasic** is a registered trademark of Fantaisie Software. This extension is not affiliated with or endorsed by Fantaisie Software.
