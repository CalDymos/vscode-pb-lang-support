# Changelog

## 0.25.0

### Added

- **Create menu, toolbar, and statusbar from scratch**: When a form has no menu, toolbar, or statusbar yet, a *Create...* action is now available in the properties panel to insert a new section with a default starter entry.
- **Toolbar entry drag-to-reorder**: Toolbar entries can now be reordered by dragging them in the canvas preview. Image button tooltips stay linked to their button throughout the move.
- **Statusbar field drag-to-reorder**: Statusbar fields can now be reordered by dragging. Field order in the source file is updated automatically.
- **Automatic ResizeGadget scaffolding**: When the first resize lock is set on a gadget, the editor generates the required resize procedure, its `Declare` line, and a `#PB_Event_SizeWindow` hook automatically. When the last lock is removed, all generated scaffolding is cleaned up.
- **PureBasic 6.40 support**: The editor now recognises PureBasic 6.40 as the current supported form designer version.
- **Automatic CreateMenu / CreateImageMenu switching**: Menu sections automatically switch between `CreateMenu` and `CreateImageMenu` when icons are assigned to or removed from entries — no manual edit needed.

### Fixed

- Menu titles with variable-based captions no longer lose their caption expression when a keyboard shortcut is added.
- Statusbar field decoration order now always matches the original Form Designer output format.
- Statusbar progress values are now saved in the same format as the original Form Designer.

---

## 0.24.0

### Added

- **Gadget duplicate**: A *Duplicate* action in the canvas right-click menu inserts a copy of the selected gadget immediately below it. Container gadgets are duplicated as empty hosts; `PanelGadget` hosts keep their tabs but not their child gadgets.
- **Gadget copy / paste**: *Copy* and *Paste* actions in the canvas right-click menu let you copy a gadget or a container subtree to a new position. Panel subtrees are copied with renamed child gadgets.
- **Extended canvas right-click menu**: The gadget context menu now matches the original PureBasic Form Designer with *Delete Gadget*, *Cut*, *Copy*, *Paste*, *Duplicate*, *Edit Items...*, *Edit Columns...*, *Align Left*, *Align Top*, *Align Width*, and *Align Height*. Actions not yet implemented are shown greyed out with an explanation.
- **Automatic image cleanup**: Replacing or deleting an image reference now automatically removes the `LoadImage` / `CatchImage` entry from the source file when nothing else references it.

### Fixed

- The *Select Parent* dialog no longer lists a SplitterGadget's own child gadgets as valid reparent targets.
- Deleting a gadget that has an assigned image now correctly accounts for that reference before checking whether the image entry can be removed.

---

## 0.23.0

### Added

- **Gadget Constants section**: The gadget inspector now shows a *Constants* section with a checkbox for each known flag of the selected gadget kind (e.g. `#PB_Button_Default`, `#PB_String_Password`, `#PB_Panel_TabBar`). Flags are rebuilt in the correct PureBasic order; any unrecognised custom flags are preserved.
- **Color pickers for FrontColor / BackColor**: The gadget front and back color fields now show a color swatch picker with a *Remove* button, matching the window color picker introduced in 0.17.0.
- **Disabled gadget overlay**: Disabled gadgets now show a translucent overlay in the canvas preview so their state is immediately visible.

### Changed

- The *Delete Gadget* button has been moved to a new *Actions* section at the top of the gadget properties panel.
- Window resizing in the canvas is now restricted to the right and bottom edges only, matching the original PureBasic Form Designer behavior.

### Fixed

- Hidden gadgets are no longer drawn in the canvas preview, matching PureBasic IDE behavior. Gadgets hidden via a variable expression remain visible to avoid false hiding.
- A hidden gadget that is selected still shows its selection frame and resize handles.
- Changing one gadget or window flag (Hidden, Disabled, or Checked) no longer accidentally clears other properties.
- The window selection outline now aligns correctly with the window border on macOS and Windows 7 skins.
- Source file edits on Windows (CRLF line endings) no longer shift to the wrong position after a structural change.
- Deleting a container that contains both a SplitterGadget and its child gadgets now correctly removes all of them.
- Gadget delete now works correctly in all VS Code host environments.

---

## 0.22.0

### Added

- **DPI-aware layout**: On HiDPI displays (e.g. 150 % scaling) the canvas and inspector now show correct logical values. An additional *Unscaled* reference row appears in the inspector when scaling is active. Dragging or resizing a gadget writes the correct value to the source file regardless of display scaling.
- **Resize locks for nested gadgets**: LockLeft, LockRight, LockTop, and LockBottom are now editable for gadgets inside a `ContainerGadget`, `ScrollAreaGadget`, or `PanelGadget`, using the correct anchor formulas for each container type.
- **Toolbar Y coordinate preservation**: Gadget Y coordinates that reference the toolbar height are now preserved correctly when a gadget is moved or inserted.

### Fixed

- Resize lock formulas are now written with the correct unscaled pixel values on HiDPI displays.
- LockLeft and LockRight can now be toggled independently when only one direction has a derivable formula.

---

## 0.21.0

### Added

- **Gadget font rendering**: Gadgets that display text now respect the font assigned via `SetGadgetFont` — including family, size, bold, italic, underline, and strikeout — in the canvas preview.
- **Variable captions shown with brackets**: When a gadget caption is set via a variable rather than a string literal, the preview now renders it as `[variableName]`, matching the original PureBasic Form Designer.
- **OS-accurate icons for remaining gadget kinds**: Combo drop-down arrows, spin buttons, trackbar thumbs, scrollbar arrows, date picker dropdowns, and macOS/Linux title bar buttons now use platform-accurate raster icons in the canvas preview.
- **macOS external menu bar**: On the macOS skin the menu bar is now rendered as a full-width band above the window body, matching real macOS behavior. The window title is centered across the full window width.
- **Selection outline for toolbar and menu bar separators**: Selected separator entries now show a visible selection outline in the canvas.

### Fixed

- Text is now vertically centered correctly in all gadget types at all font sizes.
- Menu flyout shortcut text and footer text are now rendered at full opacity.
- Menu bar entry widths and heights now scale correctly with non-default font sizes.
- macOS FrameGadget caption position now scales correctly with the font size.
- The toolbar separator click area is now exactly as wide as the visible separator line, preventing accidental selection of adjacent entries.
- macOS maximize button icon corrected.
- Windows 7 menu bar gradient now blends with the configured Windows skin colors instead of using hardcoded values.
- Windows frame border colors now use the configured skin system colors.

---

## 0.20.0

### Added

- **#PB_Any toggle for gadgets**: Gadgets can now be switched between a named enum constant and `#PB_Any` directly in the inspector. The editor updates the enum block, adds or removes the `Global` declaration, and rewrites all references in the form procedure. Renaming the variable or enum symbol propagates everywhere automatically.
- **#PB_Any toggle for images**: Image entries assigned to gadgets, menu entries, toolbar entries, and statusbar fields can be switched between a named enum ID and a `#PB_Any` variable in the inspector.

### Fixed

- The menu bar is now drawn on top of gadgets in the canvas preview instead of behind them.
- Windows system colors for the canvas preview are now loaded in the background and no longer delay editor startup.
- Procedure name suggestions in the inspector are now collected in the background and no longer block the extension host; suggestions update automatically when source files change.

---

## 0.19.0

### Added

- **Native preview chrome for all gadget kinds**: Every gadget in the canvas preview now renders with a platform-accurate appearance instead of a generic label box:
  - *Text gadgets*: `StringGadget` and `IPAddressGadget` with a native input border; `TextGadget` respects alignment and border flags; `HyperLinkGadget` shows underlined link styling.
  - *Buttons*: `ButtonGadget` with Windows 7 gradient, Windows 8 flat, or macOS/Linux rounded style depending on the active skin.
  - *Lists*: `TreeGadget`, `ListViewGadget`, `EditorGadget`, and `ScintillaGadget` with a native client area showing actual gadget items.
  - *Explorer gadgets*: `ListIconGadget` and `ExplorerListGadget` with native column headers and rows; `ExplorerTreeGadget` with tree chrome.
  - *Input gadgets*: `ComboBoxGadget` / `ExplorerComboGadget` with a drop-down arrow; `SpinGadget` with up/down buttons; `ProgressBarGadget` with a filled track.
  - *Frame and bars*: `FrameGadget` with OS-specific frame styles; `TrackBarGadget` with thumb, track, and tick marks; `ScrollBarGadget` with arrow buttons and thumb.
  - *Checkables*: `CheckBoxGadget` and `OptionGadget` from OS assets; `DateGadget` and `CalendarGadget` with OS chrome.
  - *Canvas/Web*: `CanvasGadget` and `OpenGLGadget` with a framed surface; `WebGadget` / `WebViewGadget` with a browser-style area.
  - *Image gadgets*: `ImageGadget` and `ButtonImageGadget` show the assigned image when available.
  - *Panel, ScrollArea, Splitter*: reworked with per-platform chrome.
- **Images resolved in chrome previews**: Menu flyout entries, toolbar image buttons, and statusbar image fields now display the assigned image instead of a placeholder. A fallback icon is shown when no image is assigned.

### Fixed

- Separators are no longer invisible on light or dark VS Code themes (toolbar, statusbar, menu bar, flyout borders).
- Windows 8 menu bar separator color now matches the configured Windows skin.

---

## 0.18.0

### Added

- **Platform-accurate window chrome**: The canvas preview now renders the window frame, title bar, menu bar, toolbar, statusbar, and menu flyouts with OS-specific styling for Windows 7, Windows 8, macOS, and Linux:
  - *Title bar*: Per-skin button layout — macOS circles on the left, Linux glyphs on the right, Windows 7/8 min/max/close on the right with accurate gradients and colors.
  - *Window frame*: macOS rounded grey border; Linux frameless; Windows 7/8 accurate gradient frame.
  - *Toolbar, Statusbar, Menu bar, Menu flyouts*: Per-skin background colors, separator styles, and progress bar appearances.
- **Windows system colors**: On Windows the extension reads system UI colors from the registry so the preview gradients, borders, and text use the user's actual Windows theme colors.
- **Raster preview assets**: Title bar buttons, the window icon, the add-entry (`+`) icon, and the submenu arrow are now rendered from embedded raster images.
- **Canvas page padding**: The window preview now has a small margin from the canvas edge so the window border is never clipped.
- **Selection outlines**: Toolbar, statusbar, menu bar, and flyout selection outlines now use the correct system text color.

### Fixed

- The title bar is now hidden for borderless or tool windows that do not have the `#PB_Window_SystemMenu` / `#PB_Window_TitleBar` flag.
- Title text is now positioned correctly when a window icon is shown.
- Title bar buttons are now positioned correctly on Windows skins.

---

## 0.17.0

### Added

- **Designer settings**: New settings control gadget insertion and canvas behavior:
  - *New gadgets use #PB_Any by default* — choose between `#PB_Any` or an enum constant for newly inserted gadgets.
  - *New gadgets use variable as caption* — inserted gadgets write their caption as a variable reference instead of a string literal.
  - *Generate event procedure* — controls whether an event procedure is generated on insert.
  - *OS Skin* — choose the preview skin (Windows / Linux / macOS) independently of the host OS.
  - *Warning modes* for unrecognized form files and version mismatches.
- **Color picker for window background color**: The window Color property now shows a color swatch picker with a *Remove* button.
- **Editable image assignment for statusbar and toolbar**: The image field in the statusbar field and toolbar entry inspector is now directly editable — type an existing image ID to rebind, or a file path to auto-create a new `LoadImage` entry.
- **Workspace-aware procedure suggestions**: SelectProc autocomplete now scans all `.pb` / `.pbi` files in the workspace and refreshes automatically when files change.

### Fixed

- Inspector fields no longer strip surrounding whitespace from variable names, procedure names, shortcuts, and IDs.
- Window Hidden and Disabled checkboxes now reflect the parsed value correctly.
- Window variable name no longer clears accidentally when submitting an empty value.
- Window SelectProc is now always editable — the event loop block is created on demand if missing.
- Changing one gadget event binding no longer clears the other binding.
- Partial statusbar field updates (e.g. image only) no longer overwrite unrelated sibling fields.
- Status bar progress bar preview now renders with a correct filled track.
- Menu flyout entries that extend beyond the window boundary are now selectable.
- Selecting a gadget in the hierarchy list now scrolls the canvas to reveal it through ancestor panel tabs.
- The *Add Close* button for submenus is now disabled when there is no unmatched open submenu.
- Inserting a child into a plain `MenuItem` now automatically promotes it to a submenu.

---

## 0.16.0

### Added

- **Toolbox panel**: The gadget kind selector has been replaced with a scrollable toolbox organized into categories (*Common Controls*, *Containers*, *Menus & Toolbars*) with icons matching the original PureBasic IDE. Single-click enters placement mode; double-click inserts at a default position.
- **Canvas placement**: After selecting a kind in the toolbox, click anywhere on the canvas to place the gadget. The target container is detected automatically; press Escape to cancel.
- **Gadget delete**: A *Delete Gadget* button (and canvas right-click option) removes the gadget together with all its children, property calls, and event bindings in one step.
- **Gadget reparent**: A *Change Parent* button moves the gadget and its children into a different container or panel tab.
- **SplitterGadget insert**: Selecting SplitterGadget opens a picker for the two child gadgets; children are reparented automatically if needed.
- **Canvas right-click menu for top-level elements**: Right-clicking a menu entry, toolbar entry, or statusbar field shows a context menu with delete and insert actions.
- **FrameGadget as container**: `FrameGadget` with `#PB_Frame_Container` is now a valid insert and delete host.

### Fixed

- Property calls (`SetGadgetState`, `HideGadget`, etc.) are now moved along with the gadget when reparenting.
- Deleting a container that holds a `CustomGadget` now also removes all associated custom gadget marker lines.
- Splitter child gadgets belonging to a surviving splitter are correctly skipped when deleting a partial subtree.

---

## 0.15.0

### Added

- **Window title bar in canvas preview**: The canvas now renders the title bar with close, maximize, and minimize buttons (based on `#PB_Window_SystemMenu`, `#PB_Window_MinimizeGadget`, `#PB_Window_MaximizeGadget` flags) and correct title text clipping.
- **Resize lock editing**: LockLeft, LockRight, LockTop, and LockBottom checkboxes in the gadget inspector are now editable — toggling them writes the correct anchor or stretch formula to `ResizeGadget`.
- **Resize grip**: A resize grip is shown in the bottom-right corner of the window preview.
- **Improved Windows skin chrome**: Client-side frame strips, bottom frame strip, and a captionless padding area are now rendered correctly for the Windows skin.

### Fixed

- The title bar is no longer shown for borderless or tool windows.
- Status bar progress bar track dimensions and fill width corrected.

---

## 0.14.0

### Added

- **Window inspector overhaul**: All window properties are now editable in the properties panel: caption, flags, hidden/disabled state, parent window, background color, position, size, and event settings.
- **Gadget inspector — caption and tooltip**: Caption and tooltip fields are now editable with a *is variable* toggle. The caption label adapts to the gadget kind (e.g. *Mask* for DateGadget).
- **Gadget inspector — colors and font**: Front color, back color, and font assignment are now shown and editable in the properties panel.
- **Gadget inspector — range fields**: Min and Max values are editable for ProgressBar, ScrollBar, Spin, TrackBar, and ScrollArea gadgets (shown as *Inner Width/Height* for ScrollArea).
- **Gadget inspector — checked state**: A *Checked* checkbox is shown for `CheckBoxGadget` and `OptionGadget`.
- **Gadget inspector — resize lock display**: LockLeft, LockRight, LockTop, and LockBottom flags from `ResizeGadget` are shown as read-only checkboxes (editable from 0.15.0).
- **CustomGadget inspector**: SelectGadget, InitCode, CreateCode, and Help fields are shown for `CustomGadget` entries.
- **SelectProc autocomplete**: All SelectProc fields now offer autocomplete suggestions from procedure names found in the form file and its event file.
- **Info panel**: A summary line above the properties panel describes the current selection and shows a contextual hint.
- **Resizable properties panel**: The split between canvas and properties panel can be adjusted by dragging the divider.

---

## 0.13.0

### Fixed

- Menu entry captions containing embedded quotes are now displayed correctly in the preview instead of being truncated.
- Menu entry shortcuts are no longer split off incorrectly when the caption contains an embedded quote.
- Failed source file edits now surface an error and stop instead of silently continuing with a partial result.

---

## 0.12.0

### Added

- **Inline editors**: All pop-up dialogs have been replaced with inline panels in the properties section:
  - Menu entries: edit constant, name, shortcut, and image inline.
  - Toolbar entries: edit tooltip, toggle flag, and image inline.
  - Statusbar fields: edit width, text, progress bar, flags, and image inline.
  - Gadget items and columns: inline editor with save/cancel.
  - Image assignment and delete actions show inline confirmation panels.
- **Statusbar flag checkboxes**: `#PB_StatusBar_*` alignment and style flags can now be toggled individually via checkboxes.
- **Discrete add buttons**: Add actions for menus, toolbars, and statusbars now offer separate buttons per entry type (*Add Item*, *Add Title*, *Add SubMenu*, *Add Separator*).

### Changed

- Paired `ToolBarToolTip` entries are now hidden from the toolbar structure list and only shown in the selected entry inspector.
- Selecting a menu entry, toolbar entry, or statusbar field now shows only the *Selected Entry / Field* panel instead of the full container list.

---

## 0.11.0

### Added

- **PureBasic 6.30 syntax support**: The editor now correctly handles `CreateImageMenu`, `CreateToolbar`, and `Chr(9)`-concatenated shortcut syntax used by the PB 6.30 form designer.
- **Menu drag-and-drop**: Menu entries can be reordered by dragging in the canvas preview. Entire subtrees move together.
- **Canvas add buttons**: Inline `+` buttons appear in the menu bar, toolbar, and statusbar preview areas for quick insertion.
- **Section delete**: Entire menu, toolbar, or statusbar sections can be deleted from the properties panel.
- **Font management**: `LoadFont` entries are shown in the properties panel and can be inserted, updated, or deleted. The `FormFont` enum block is kept in sync.
- **FormMenu / FormGadget enum management**: The editor keeps `Enumeration FormMenu` and `Enumeration FormGadget` blocks consistent across all insert, rename, and delete operations.

### Fixed

- Toolbar image button entries and their paired tooltip lines are now handled correctly for PB 6.30 format.
- Menu shortcuts now use the PB 6.30 `Chr(9)` format; `CreateImageMenu` is now recognised in all edit operations.
- Statusbar field decoration lines are now emitted in the correct order.
- Image and font blocks are now inserted in the correct position relative to custom gadget initialisation markers.
- Double blank lines no longer appear after block replace operations.

---

## 0.10.0

### Added

- **Event bindings**: Gadget, menu entry, and toolbar entry event procedures can now be viewed and edited in the properties panel.
- **Window event settings**: Event file, event procedure name, and the *Generate Event Loop* toggle are editable in the window properties panel.
- **Image management panel**: `LoadImage` and `CatchImage` entries are shown in a dedicated *Images* section with cross-reference counts.
  - Navigate from any gadget, menu entry, toolbar entry, or statusbar field to its referenced image.
  - Insert, update, and delete images from the panel.
  - Toggle between `LoadImage` and `CatchImage`, and between a named ID and `#PB_Any`.
  - Make image paths relative to the form file.
  - Choose an image file via a file dialog; gadgets can be auto-resized to match the image.
  - Create new image entries with auto-generated IDs and assign them in one step.

---

## 0.9.0

### Added

- **Extended window and gadget model**: Caption, background color, hidden/disabled state, parent reference, event settings, tooltip, font, colors, image references, min/max values, and resize lock flags are now fully parsed and shown in the properties panel.
- **Menu, toolbar, and statusbar detail parsing**: Shortcuts, icon references, toggle flags, tooltip text, and statusbar field decorations are now fully parsed.
- **Canvas chrome for containers**: Panel tabs, ScrollArea scrollbars, Splitter separator bar, FrameGadget and ContainerGadget borders are now rendered in the canvas preview. Nested gadgets are clipped to their parent's bounds.
- **Splitter position editing**: The splitter position can be set via a number input in the properties panel.
- **Menu bar, toolbar, and statusbar canvas preview**: Menu bar, toolbar, and statusbar are now rendered with selection highlighting; the gadget area is offset accordingly.
- **Property write-back**: Changes to window and gadget visibility, disabled state, colors, tooltip, and font are written back to the source file. Gadget constructor arguments (text, image, range, flags, splitter children) are editable and written back to the `OpenGadget` call.
- **Menu, toolbar, and statusbar emitters**: Insert, update, and delete operations for all top-level elements are now fully implemented.

---

## 0.8.2

### Fixed

- Removed `extensionDependencies` to prevent activation failure after installation.

## 0.8.1

### Changed

- updated README.md

## 0.8.0

### Added

- Added pb-lang-support as a dependency for `.pbf` text mode.

### Changed

- `.pbf` text mode now prefers the PureBasic language from pb-lang-support.
- Switching between text and designer mode now closes the other tab to prevent duplicate editors.
