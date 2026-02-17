# PureBasic Forms Editor v0.4

- Supports PureBasic Form Designer style assignments:
  - `Button_0 = ButtonGadget(#PB_Any, ...)`
  - `Window_0 = OpenWindow(#PB_Any, ...)`
- Uses a stable gadget key for patching:
  - If first param is `#PB_Any`, key is the assigned variable (left side).
  - Else key is the first param (e.g. `#Button_0`).
- Patches multi-line calls and preserves the left-side assignment (if any).

Still in development : It only patches `x/y` on drag.
