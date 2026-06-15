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

## Verified Support Matrix

The matrix below is based on the currently verified parser, patcher, preview-geometry and regression tests in this repository.  
**Verified** means there is a tested code path in the current suite. **Partial** means a working path exists, but parity or UX is still incomplete. **Not yet** means no verified end-to-end support is documented yet.

| Area | Status | Verified scope / current limitation |
| --- | --- | --- |
| Form Designer block detection and metadata | Verified | Detects the Form Designer header, limits parsing to the designer block, and keeps header/version scan metadata. |
| Window and gadget parsing / patching | Verified | Covers window geometry, `OpenWindow(...)` args, managed window lines, gadget geometry, gadget constructor args, `#PB_Any` / enum keys, and managed gadget properties such as tooltip, colors, hidden / disabled and state. |
| Gadget items and columns | Verified | `AddGadgetItem(...)` and `AddGadgetColumn(...)` insert / update / delete roundtrips are covered by dedicated tests. |
| Images and image references | Verified | Covers `LoadImage(...)`, `CatchImage(...)`, PB 6.30 image blocks, decoder management, enum / `#PB_Any` image ids, and cross references from gadgets, menus, toolbars and status bars. |
| Menus, toolbars and status bars | Verified | Insert / update / delete / move patch flows are covered, including submenu blocks, toolbar tooltips, status bar decorations and combined top-level chrome roundtrips. |
| Event bindings | Verified | Covers window include / default handler / `generateEventLoop`, plus gadget, menu and toolbar event proc patching in real fixtures. |
| Container patching | Verified | Combined real-fixture patch / reparse flows are covered for `PanelGadget`, `ScrollAreaGadget` and `SplitterGadget`. |
| Preview chrome geometry and hit zones | Partial | Geometry helpers for menu / toolbar / status bar bands, scroll areas and splitter bars are tested, but full visual parity and remaining rendering details are still in progress. |
| Structural menu editing in the preview | Partial | Visible submenu flyouts, subtree move, structural delete and generated `OpenSubMenu(...)` / `CloseSubMenu()` insertion are implemented. Footer insertion for an empty submenu is still open, and custom footer entry kinds are not yet verified. |
| Inspector / add flows in the webview | Partial | Several edit flows still rely on browser `prompt()` / `confirm()` dialogs and have not yet been replaced by dedicated webview UI. |
| Preview-only local UI state | Partial | Active panel tabs and scroll offsets are currently local webview state and are not written back into the `.pbf` source. |
| Performance validation on large forms | Not yet | Dedicated performance and stress validation for large forms and deeply nested containers is still open. |
| Full original Form Designer parity | Partial | The extension has broad tested coverage for the currently implemented parser / patch / preview paths, but the migration is still ongoing and should not yet be treated as full parity. |

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
pb-forms-editor/
├── .github/
│   └── README.md
├── .vscodeignore
├── CHANGELOG.md
├── fixtures/
│   ├── roundtrip/
│   │   ├── 04-gadget-items-columns.pbf
│   │   ├── 14-combined-regression.pbf
│   │   ├── 17-menu-title-delete-nested-submenu.pbf
│   │   ├── 18-toolbar-tooltip-insert-after-button.pbf
│   │   ├── 19-imageblock-before-font.pbf
│   │   ├── 20-imageblock-enum-single.pbf
│   │   ├── 21-imageblock-enum-with-menu.pbf
│   │   ├── 22-imageblock-pbany-single.pbf
│   │   ├── 23-imageblock-boundary-declare.pbf
│   │   ├── 24-imageblock-custom-gadget-base.pbf
│   │   ├── 25-imageblock-custom-gadget-pbany-single.pbf
│   │   ├── 26-imageblock-no-images-basic.pbf
│   │   ├── 27-imageblock-custom-gadget-window-assignment.pbf
│   │   ├── 28-imageblock-enum-before-font-single.pbf
│   │   ├── 29-fontblock-top-level-parse.pbf
│   │   ├── 30-fontblock-before-procedure-after-image.pbf
│   │   ├── 31-fontblock-basic-no-fonts.pbf
│   │   ├── 32-fontblock-enum-single.pbf
│   │   ├── 33-fontblock-pbany-single.pbf
│   │   ├── 34-fontblock-boundary-declare.pbf
│   │   ├── 35-fontblock-before-declare-single-blank-line.pbf
│   │   ├── 36-fontblock-custom-gadget-base.pbf
│   │   ├── 37-fontblock-custom-gadget-window-assignment.pbf
│   │   ├── 38-toolbar-menuenum-toolbar-only-custom-gadget-base.pbf
│   │   ├── 39-toolbar-menuenum-menu-and-toolbar-base.pbf
│   │   ├── 40-toolbar-menuenum-toolbar-only-last-symbol.pbf
│   │   ├── 41-toolbar-menuenum-shared-id-base.pbf
│   │   ├── 42-toolbar-menuenum-before-image-block.pbf
│   │   ├── 43-menuenum-custom-gadget-base.pbf
│   │   ├── 45-menuenum-basic-single-symbol.pbf
│   │   ├── 46-menuenum-before-image-block.pbf
│   │   ├── 47-menuenum-before-font-block.pbf
│   │   ├── 48-menuenum-before-image-decoder.pbf
│   │   ├── 49-windowgadget-resize-existing-basic.pbf
│   │   ├── 50-windowgadget-resize-create-with-events.pbf
│   │   ├── 51-windowgadget-resize-create-no-events.pbf
│   │   ├── 52-windowgadget-resize-delete-last-scaffolding.pbf
│   │   ├── 53-windowgadget-resize-delete-line-basic.pbf
│   │   ├── 54-windowgadget-window-enum-before-image-block.pbf
│   │   ├── 55-windowgadget-window-enum-before-font-block.pbf
│   │   ├── 56-windowgadget-window-enum-before-image-decoder.pbf
│   │   ├── 59-windowgadget-window-global-before-gadget-image-globals.pbf
│   │   ├── 60-windowgadget-window-global-before-custom-init.pbf
│   │   ├── 61-windowgadget-window-rename-selected-pbany.pbf
│   │   ├── 62-windowgadget-window-enum-remove-last-global-before-image-block.pbf
│   │   ├── 63-windowgadget-gadget-enum-before-custom-init.pbf
│   │   ├── 64-windowgadget-gadget-enum-before-menu-block.pbf
│   │   ├── 65-windowgadget-gadget-global-between-window-image-globals.pbf
│   │   ├── 66-custom-gadget-marker-pair-basic.pbf
│   │   └── 67-head-order-combined-base.pbf
│   └── smoke/
│       ├── 01-window-basic.pbf
│       ├── 03-gadgets-basic.pbf
│       ├── 05-container-panel.pbf
│       ├── 06-container-scrollarea.pbf
│       ├── 07-container-splitter.pbf
│       ├── 08-menu-basic.pbf
│       ├── 09-toolbar-basic.pbf
│       ├── 10-statusbar-basic.pbf
│       ├── 11-images-crossrefs.pbf
│       ├── 12-visibility-colors-fonts.pbf
│       ├── 13-events-and-parent-window.pbf
│       ├── 15-object-event-bindings.pbf
│       ├── 16-string-literals-combined.pbf
│       └── events/
├── icon.png
├── icons/
│   ├── application_view_form.png
│   ├── application_view_text.png
│   ├── ArrowLeft.png
│   ├── ArrowLeft2.png
│   ├── ArrowRight.png
│   ├── ArrowRight2.png
│   ├── CompileAndRun.png
│   ├── CompilerOptions.png
│   ├── CompileToExe.png
│   ├── DebugBreakPoint.png
│   ├── DebugContinue.png
│   ├── DebugCreateReport.png
│   ├── DebugKill.png
│   ├── DebugMemoryViewer.png
│   ├── DebugOnOff.png
│   ├── DebugOutput.png
│   ├── DebugStep.png
│   ├── DebugStepNumber.png
│   ├── DebugStepOut.png
│   ├── DebugStepOver.png
│   ├── DebugStop.png
│   ├── DebugVariables.png
│   ├── DebugWatchList.png
│   ├── DefaultTarget.png
│   ├── DiffHideFiles.png
│   ├── DisabledTarget.png
│   ├── DisplayHelp.png
│   ├── EditAddBookmark.png
│   ├── EditCopy.png
│   ├── EditCut.png
│   ├── EditFind.png
│   ├── EditFindAndReplace.png
│   ├── EditFindInFiles.png
│   ├── EditGoToBookmark.png
│   ├── EditGoToLineNumber.png
│   ├── EditInsertComment.png
│   ├── EditPaste.png
│   ├── EditRedo.png
│   ├── EditRemoveComment.png
│   ├── EditUndo.png
│   ├── FileClose.png
│   ├── FileNew.png
│   ├── FileOpen.png
│   ├── FileOpen1.png
│   ├── FileOpen2.png
│   ├── FilePreferences.png
│   ├── FileSave.png
│   ├── FileSortSources.png
│   ├── Home.png
│   ├── mc_backcolor.png
│   ├── mc_copyclipboard.png
│   ├── mc_enablefolding.png
│   ├── mc_filterclear.png
│   ├── mc_frontcolor.png
│   ├── mc_hidemodulenames.png
│   ├── mc_highlightprocedure.png
│   ├── mc_restorecolor.png
│   ├── mc_scrollprocedure.png
│   ├── mc_switchbuttons.png
│   ├── MultipleFiles.png
│   ├── Refresh.png
│   ├── StartVisualDesigner.png
│   ├── TargetAdd.png
│   ├── TargetEdit.png
│   ├── TargetError.png
│   ├── TargetRemove.png
│   ├── TargetWarning.png
│   ├── Template.png
│   ├── TemplateAdd.png
│   ├── TemplateAddDir.png
│   ├── TemplateDirectory.png
│   ├── TemplateDown.png
│   ├── TemplateEdit.png
│   ├── TemplateRemove.png
│   ├── TemplateRemoveDir.png
│   ├── TemplateUp.png
│   ├── ToolsAsciiTable.png
│   ├── ToolsColorPicker.png
│   ├── ToolsDiff.png
│   ├── ToolsExplorer.png
│   ├── ToolsFileViewer.png
│   ├── ToolsProcedureBrowser.png
│   ├── ToolsStructureViewer.png
│   ├── ToolsVariableViewer.png
│   ├── vd_buttongadget.png
│   ├── vd_buttonimagegadget.png
│   ├── vd_calendargadget.png
│   ├── vd_canvasgadget.png
│   ├── vd_checkboxgadget.png
│   ├── vd_comboboxgadget.png
│   ├── vd_containergadget.png
│   ├── vd_cursor.png
│   ├── vd_dategadget.png
│   ├── vd_editorgadget.png
│   ├── vd_explorercombogadget.png
│   ├── vd_explorerlistgadget.png
│   ├── vd_explorertreegadget.png
│   ├── vd_frame3dgadget.png
│   ├── vd_hyperlinkgadget.png
│   ├── vd_imagegadget.png
│   ├── vd_ipaddressgadget.png
│   ├── vd_listicongadget.png
│   ├── vd_listviewgadget.png
│   ├── vd_menu.png
│   ├── vd_optiongadget.png
│   ├── vd_panelgadget.png
│   ├── vd_progressbargadget.png
│   ├── vd_scrollareagadget.png
│   ├── vd_scrollbargadget.png
│   ├── vd_spingadget.png
│   ├── vd_splittergadget.png
│   ├── vd_status.png
│   ├── vd_stringgadget.png
│   ├── vd_textgadget.png
│   ├── vd_toolbar.png
│   ├── vd_trackbargadget.png
│   ├── vd_treegadget.png
│   ├── vd_webgadget.png
│   └── Vertical.png
├── LICENSE
├── package.json
├── package.nls.de.json
├── package.nls.json
├── README.md
├── samples/
│   ├── .vscode/
│   │   └── settings.json
│   ├── all-gadgets.pbf
│   ├── sample.pbf
│   └── SelectParentTest.pbf
├── src/
│   ├── config/
│   │   └── settings.ts
│   ├── core/
│   │   ├── emitter/
│   │   │   └── patch-emitter.ts
│   │   ├── gadget/
│   │   │   ├── delete.ts
│   │   │   ├── insert.ts
│   │   │   ├── inspector.ts
│   │   │   ├── item-label.ts
│   │   │   ├── layout.ts
│   │   │   └── reparent.ts
│   │   ├── image/
│   │   │   ├── assignment.ts
│   │   │   ├── dimension.ts
│   │   │   └── path.ts
│   │   ├── model.ts
│   │   ├── parser/
│   │   │   ├── call-scanner.ts
│   │   │   ├── form-parser.ts
│   │   │   ├── global-scanner.ts
│   │   │   ├── layout-raw.ts
│   │   │   ├── pb-color.ts
│   │   │   ├── pb-font-reference.ts
│   │   │   ├── pb-image-reference.ts
│   │   │   ├── pb-image-value.ts
│   │   │   ├── pb-string.ts
│   │   │   ├── pb-window-reference.ts
│   │   │   ├── procedure-scanner.ts
│   │   │   └── tokenizer.ts
│   │   ├── preview/
│   │   │   ├── assets.ts
│   │   │   ├── chrome.ts
│   │   │   ├── gadget-font.ts
│   │   │   └── gadget-text.ts
│   │   ├── procedures/
│   │   │   └── list.ts
│   │   ├── statusbar/
│   │   │   ├── image-inspector.ts
│   │   │   ├── inspector.ts
│   │   │   └── preview.ts
│   │   ├── toolbox/
│   │   │   └── panel.ts
│   │   ├── toplevel/
│   │   │   ├── context-menu.ts
│   │   │   ├── image-inspector.ts
│   │   │   ├── preview.ts
│   │   │   └── selection.ts
│   │   ├── utils/
│   │   │   ├── form-settings-runtime.ts
│   │   │   ├── layout-dpi.ts
│   │   │   ├── property-validation.ts
│   │   │   └── webview-state.ts
│   │   └── window/
│   │       ├── color-inspector.ts
│   │       └── inspector.ts
│   ├── extension.ts
│   ├── forms-designer-provider.ts
│   ├── shared/
│   │   ├── designer-settings.ts
│   │   ├── menu.ts
│   │   └── messages.ts
│   └── webview/
│       └── main.ts
├── test/
│   ├── color-inspector-utils.test.ts
│   ├── fixture-originality-audit.test.ts
│   ├── form-parser-source-range.test.ts
│   ├── form-settings-runtime-utils.test.ts
│   ├── gadget-delete-utils.test.ts
│   ├── gadget-insert-utils.test.ts
│   ├── gadget-inspector-utils.test.ts
│   ├── gadget-item-label-utils.test.ts
│   ├── gadget-layout-utils.test.ts
│   ├── gadget-preview-font-utils.test.ts
│   ├── gadget-preview-text-utils.test.ts
│   ├── gadget-reparent-utils.test.ts
│   ├── helpers/
│   │   ├── applyWorkspaceEdit.ts
│   │   ├── fakeTextDocument.ts
│   │   ├── loadFixture.ts
│   │   └── testUtils.ts
│   ├── image-assignment-utils.test.ts
│   ├── image-dimension-utils.test.ts
│   ├── image-path-utils.test.ts
│   ├── layout-dpi-utils.test.ts
│   ├── model-constants.test.ts
│   ├── parser.smoke.test.ts
│   ├── parser.window-event-legacy.test.ts
│   ├── patch.combined.test.ts
│   ├── patch.custom-gadget.test.ts
│   ├── patch.fontblock.test.ts
│   ├── patch.head-order.test.ts
│   ├── patch.imageblock.test.ts
│   ├── patch.items-columns.test.ts
│   ├── patch.menuenum.test.ts
│   ├── patch.toolbar-menuenum.test.ts
│   ├── patch.toolbar.test.ts
│   ├── patch.window-event-file-legacy.test.ts
│   ├── patch.window-gadget.test.ts
│   ├── pb-font-reference-parser.test.ts
│   ├── pb-image-reference-parser.test.ts
│   ├── pb-image-value-parser.test.ts
│   ├── preview-chrome-utils.test.ts
│   ├── procedure-list-utils.test.ts
│   ├── property-validation-utils.test.ts
│   ├── runtime/
│   │   └── vscode/
│   │       └── index.js
│   ├── scripts/
│   │   ├── clean-test-outdir.js
│   │   └── copy-vscode-shim.js
│   ├── statusbar-image-inspector-utils.test.ts
│   ├── statusbar-inspector-utils.test.ts
│   ├── statusbar-preview-utils.test.ts
│   ├── tokenizer-utils.test.ts
│   ├── toolbox-panel-utils.test.ts
│   ├── top-level-context-menu-utils.test.ts
│   ├── top-level-image-inspector-utils.test.ts
│   ├── top-level-preview-utils.test.ts
│   ├── types/
│   │   ├── node/
│   │   │   └── index.d.ts
│   │   ├── node-shims.d.ts
│   │   └── vscode-shim.d.ts
│   ├── webview-state-utils.test.ts
│   └── window-inspector-utils.test.ts
├── tsconfig.json
├── tsconfig.test.json
├── tsconfig.webview.json
└── webpack.config.js
└── ...
```

### Build and Test

- `npm -w packages/pb-forms-editor run compile`: Compile TypeScript
- `F5`: Start extension debugging (Extension Development Host)

## License

MIT License

---

**PureBasic** is a registered trademark of Fantaisie Software. This extension is not affiliated with or endorsed by Fantaisie Software.
