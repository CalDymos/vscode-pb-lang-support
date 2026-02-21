type SourceRange = { line: number };

type GadgetItem = {
  index?: number;
  posRaw: string;
  textRaw?: string;
  text?: string;
  imageRaw?: string;
  flagsRaw?: string;
  source?: SourceRange;
};

type GadgetColumn = {
  index?: number;
  colRaw: string;
  titleRaw?: string;
  title?: string;
  widthRaw?: string;
  source?: SourceRange;
};

type Gadget = {
  id: string;
  kind: string;
  parentId?: string;
  parentItem?: number;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  items?: GadgetItem[];
  columns?: GadgetColumn[];
};

type WindowModel = {
  id: string;
  pbAny: boolean;
  variable?: string;
  enumValueRaw?: string;
  firstParam: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
};

type MenuEntry = {
  kind: string;
  level?: number;
  idRaw?: string;
  textRaw?: string;
  text?: string;
  iconRaw?: string;
  widthRaw?: string;
  source?: SourceRange;
};

type MenuModel = {
  id: string;
  entries: MenuEntry[];
};

type ToolbarModel = {
  id: string;
  entries: MenuEntry[];
};

type StatusbarField = {
  widthRaw: string;
  source?: SourceRange;
};

type StatusbarModel = {
  id: string;
  fields: StatusbarField[];
};

type Model = {
  window?: WindowModel;
  gadgets: Gadget[];
  menus?: MenuModel[];
  toolbars?: ToolbarModel[];
  statusbars?: StatusbarModel[];
  meta?: {
    header?: { version?: string; line: number; hasStrictSyntaxWarning: boolean };
    issues?: Array<{ severity: "error" | "warning" | "info"; message: string; line?: number }>;
  };
};

type GridMode = "dots" | "lines";
type SnapMode = "live" | "drop";

type DesignerSettings = {
  showGrid: boolean;
  gridMode: GridMode;
  gridSize: number;
  gridOpacity: number;

  snapToGrid: boolean;
  snapMode: SnapMode;

  windowFillOpacity: number;
  outsideDimOpacity: number;
  titleBarHeight: number;

  canvasBackground: string;
  canvasReadonlyBackground: string;
};

const EXT_TO_WEBVIEW_MSG_TYPE = {
  init: "init",
  settings: "settings",
  error: "error"
} as const;

const WEBVIEW_TO_EXT_MSG_TYPE = {
  ready: "ready",

  moveGadget: "moveGadget",
  setGadgetRect: "setGadgetRect",
  setWindowRect: "setWindowRect",
  toggleWindowPbAny: "toggleWindowPbAny",
  setWindowEnumValue: "setWindowEnumValue",
  setWindowVariableName: "setWindowVariableName",

  insertGadgetItem: "insertGadgetItem",
  updateGadgetItem: "updateGadgetItem",
  deleteGadgetItem: "deleteGadgetItem",

  insertGadgetColumn: "insertGadgetColumn",
  updateGadgetColumn: "updateGadgetColumn",
  deleteGadgetColumn: "deleteGadgetColumn",

  insertMenuEntry: "insertMenuEntry",
  updateMenuEntry: "updateMenuEntry",
  deleteMenuEntry: "deleteMenuEntry",

  insertToolBarEntry: "insertToolBarEntry",
  updateToolBarEntry: "updateToolBarEntry",
  deleteToolBarEntry: "deleteToolBarEntry",

  insertStatusBarField: "insertStatusBarField",
  updateStatusBarField: "updateStatusBarField",
  deleteStatusBarField: "deleteStatusBarField"
} as const;

// Backwards compatible:
// - init may come without settings
type ExtensionToWebviewMessage =
  | { type: typeof EXT_TO_WEBVIEW_MSG_TYPE.init; model: Model; settings?: DesignerSettings }
  | { type: typeof EXT_TO_WEBVIEW_MSG_TYPE.settings; settings: DesignerSettings }
  | { type: typeof EXT_TO_WEBVIEW_MSG_TYPE.error; message: string };

type WebviewToExtensionMessage =
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.ready }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.moveGadget; id: string; x: number; y: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setGadgetRect; id: string; x: number; y: number; w: number; h: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setWindowRect; id: string; x: number; y: number; w: number; h: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.toggleWindowPbAny; windowKey: string; toPbAny: boolean; variableName: string; enumSymbol: string; enumValueRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setWindowEnumValue; enumSymbol: string; enumValueRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.setWindowVariableName; variableName?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.insertGadgetItem; id: string; posRaw: string; textRaw: string; imageRaw?: string; flagsRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.updateGadgetItem; id: string; sourceLine: number; posRaw: string; textRaw: string; imageRaw?: string; flagsRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.deleteGadgetItem; id: string; sourceLine: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.insertGadgetColumn; id: string; colRaw: string; titleRaw: string; widthRaw: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.updateGadgetColumn; id: string; sourceLine: number; colRaw: string; titleRaw: string; widthRaw: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.deleteGadgetColumn; id: string; sourceLine: number }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.insertMenuEntry; menuId: string; kind: string; idRaw?: string; textRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.updateMenuEntry; menuId: string; sourceLine: number; kind: string; idRaw?: string; textRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.deleteMenuEntry; menuId: string; sourceLine: number; kind: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.insertToolBarEntry; toolBarId: string; kind: string; idRaw?: string; iconRaw?: string; textRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.updateToolBarEntry; toolBarId: string; sourceLine: number; kind: string; idRaw?: string; iconRaw?: string; textRaw?: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.deleteToolBarEntry; toolBarId: string; sourceLine: number; kind: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.insertStatusBarField; statusBarId: string; widthRaw: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.updateStatusBarField; statusBarId: string; sourceLine: number; widthRaw: string }
  | { type: typeof WEBVIEW_TO_EXT_MSG_TYPE.deleteStatusBarField; statusBarId: string; sourceLine: number };

declare const acquireVsCodeApi: () => { postMessage: (msg: WebviewToExtensionMessage) => void };

const vscode = acquireVsCodeApi();

function post(msg: WebviewToExtensionMessage) {
  vscode.postMessage(msg);
}


const canvas = document.getElementById("designer") as HTMLCanvasElement;
const propsEl = document.getElementById("props") as HTMLDivElement;
const listEl = document.getElementById("list") as HTMLDivElement;
const parentSelEl = document.getElementById("parentSel") as HTMLSelectElement;
const errEl = document.getElementById("err") as HTMLDivElement;
const diagEl = document.getElementById("diag") as HTMLDivElement;

let model: Model = { gadgets: [] };

type DesignerSelection =
  | { kind: "gadget"; id: string }
  | { kind: "window" }
  | { kind: "menu"; id: string }
  | { kind: "toolbar"; id: string }
  | { kind: "statusbar"; id: string }
  | null;
let selection: DesignerSelection = null;

const expanded = new Map<string, boolean>();

let settings: DesignerSettings = {
  showGrid: true,
  gridMode: "dots",
  gridSize: 10,
  gridOpacity: 0.14,

  snapToGrid: false,
  snapMode: "drop",

  windowFillOpacity: 0.05,
  outsideDimOpacity: 0.12,
  titleBarHeight: 26,

  canvasBackground: "",
  canvasReadonlyBackground: ""
};

type PbfdSymbols = {
  menuEntryKinds: readonly string[];
  toolBarEntryKinds: readonly string[];
  containerGadgetKinds: readonly string[];
  enumNames?: { windows: string; gadgets: string };
};

interface Window {
  __PBFD_SYMBOLS__?: PbfdSymbols;
}

if (!window.__PBFD_SYMBOLS__) {
  throw new Error("__PBFD_SYMBOLS__ is not defined");
}

const PBFD_SYMBOLS: PbfdSymbols = window.__PBFD_SYMBOLS__;

function menuEntryKindHint(): string {
  return `Entry kind (${PBFD_SYMBOLS.menuEntryKinds.join("/")})`;
}

function toolBarEntryKindHint(): string {
  return `Entry kind (${PBFD_SYMBOLS.toolBarEntryKinds.join("/")})`;
}

function toPbString(v: string): string {
  const esc = (v ?? "").replace(/"/g, '""');
  return `"${esc}"`;
}

type Handle = "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se";

const HANDLE_SIZE = 6;
const HANDLE_HIT = 10;

const MIN_GADGET_W = 8;
const MIN_GADGET_H = 8;

// Keep this permissive; PB allows small windows, but avoid 0/negative sizes.
const MIN_WIN_W = 40;
const MIN_WIN_H = 40;

const CONTAINER_KINDS = new Set(PBFD_SYMBOLS.containerGadgetKinds);

type RectLike = { x: number; y: number; w: number; h: number };

function renderListAndParentSelector() {
  renderList();
  renderParentSelector();
}

function renderSelectionUiWithParentSelector() {
  render();
  renderList();
  renderParentSelector();
  renderProps();
}

function renderSelectionUiWithoutParentSelector() {
  render();
  renderList();
  renderProps();
}

function renderAfterInit() {
  render();
  renderParentSelector();
  renderList();
  renderProps();
  renderDiagnostics();
}

function sanitizeSelectionAfterModelUpdate() {
  const sel = selection;
  if (sel && sel.kind === "gadget") {
    const selId = sel.id;
    if (!model.gadgets.some(g => g.id === selId)) {
      selection = null;
    }
    return;
  }

  if (sel && sel.kind === "window") {
    if (!model.window) selection = null;
    return;
  }

  if (sel && sel.kind === "menu") {
    const menus = model.menus ?? [];
    if (!menus.some(m => m.id === sel.id)) selection = null;
    return;
  }

  if (sel && sel.kind === "toolbar") {
    const toolbars = model.toolbars ?? [];
    if (!toolbars.some(t => t.id === sel.id)) selection = null;
    return;
  }

  if (sel && sel.kind === "statusbar") {
    const statusbars = model.statusbars ?? [];
    if (!statusbars.some(sb => sb.id === sel.id)) selection = null;
    return;
  }
}

function normalizeRectInPlace(r: RectLike, minW: number, minH: number) {
  const c = clampRect(r.x, r.y, r.w, r.h, minW, minH);
  r.x = c.x;
  r.y = c.y;
  r.w = c.w;
  r.h = c.h;
}

function shouldSnapLive(): boolean {
  return settings.snapToGrid && settings.snapMode === "live";
}

function shouldSnapDrop(): boolean {
  return settings.snapToGrid && settings.snapMode === "drop";
}

function applyLiveSnapPoint(x: number, y: number): { x: number; y: number } {
  if (!shouldSnapLive()) return { x, y };
  const gs = settings.gridSize;
  return { x: snapValue(x, gs), y: snapValue(y, gs) };
}

function applyLiveSnapRect(
  x: number,
  y: number,
  w: number,
  h: number,
  minW: number,
  minH: number
): { x: number; y: number; w: number; h: number } {
  if (!shouldSnapLive()) return { x, y, w, h };
  const gs = settings.gridSize;
  const nx = snapValue(x, gs);
  const ny = snapValue(y, gs);
  const nw = snapValue(w, gs);
  const nh = snapValue(h, gs);
  return clampRect(nx, ny, nw, nh, minW, minH);
}

function applyDropSnapRectInPlace(r: RectLike, minW: number, minH: number) {
  if (!shouldSnapDrop()) return;

  const gs = settings.gridSize;
  r.x = snapValue(r.x, gs);
  r.y = snapValue(r.y, gs);
  r.w = snapValue(r.w, gs);
  r.h = snapValue(r.h, gs);

  const c = clampRect(r.x, r.y, r.w, r.h, minW, minH);
  r.x = c.x;
  r.y = c.y;
  r.w = c.w;
  r.h = c.h;
}

type DragState =
  | { target: "gadget"; mode: "move"; id: string; startMx: number; startMy: number; startX: number; startY: number }
  | {
      target: "gadget";
      mode: "resize";
      id: string;
      handle: Handle;
      startMx: number;
      startMy: number;
      startX: number;
      startY: number;
      startW: number;
      startH: number;
    }
  | { target: "window"; mode: "move"; startMx: number; startMy: number; startX: number; startY: number }
  | {
      target: "window";
      mode: "resize";
      handle: Handle;
      startMx: number;
      startMy: number;
      startX: number;
      startY: number;
      startW: number;
      startH: number;
    };

let drag: DragState | null = null;

function applySettings(s: DesignerSettings) {
  settings = s;

  const bg = (settings.canvasBackground ?? "").trim();
  const bgReadonly = (settings.canvasReadonlyBackground ?? "").trim();
  document.documentElement.style.setProperty(
    "--pbfd-canvas-bg",
    bg.length ? bg : "var(--vscode-editor-background)"
  );

  document.documentElement.style.setProperty(
    "--pbfd-readonly-bg",
    bgReadonly.length ? bgReadonly : "var(--vscode-readonly-input-background)"
  );

  render();
  renderProps();
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render();
}

window.addEventListener("resize", resizeCanvas);

window.addEventListener("message", (ev: MessageEvent<ExtensionToWebviewMessage>) => {
  const msg = ev.data;

  if (msg.type === "init") {
    errEl.textContent = "";
    model = msg.model;

    if (msg.settings) {
      applySettings(msg.settings);
    }
    // Validate selection after model refresh
    sanitizeSelectionAfterModelUpdate();

    renderAfterInit();
    return;
  }

  if (msg.type === "settings") {
    applySettings(msg.settings);
    return;
  }

  if (msg.type === "error") {
    errEl.textContent = msg.message;
  }
});

function renderDiagnostics() {
  const issues = model.meta?.issues ?? [];
  const header = model.meta?.header;

  if ((!issues || issues.length === 0) && !header?.version) {
    diagEl.style.display = "none";
    diagEl.innerHTML = "";
    return;
  }

  const rows: string[] = [];
  if (header?.version) {
    rows.push(
      `<div class="row"><div class="sev info">ℹ</div><div class="msg">PureBasic header version: <b>${escapeHtml(
        header.version
      )}</b></div></div>`
    );
  }

  for (const it of issues) {
    const sev = it.severity;
    const icon = sev === "error" ? "⛔" : sev === "warning" ? "⚠" : "ℹ";
    const line = typeof it.line === "number" ? ` (line ${it.line + 1})` : "";
    rows.push(
      `<div class="row"><div class="sev ${sev === "warning" ? "warn" : sev === "error" ? "err" : "info"}">${icon}</div><div class="msg">${escapeHtml(
        it.message
      )}${escapeHtml(line)}</div></div>`
    );
  }

  diagEl.innerHTML = rows.join("\n");
  diagEl.style.display = "block";
}

function escapeHtml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getWinRect(): { x: number; y: number; w: number; h: number; title: string; id: string; tbH: number } | null {
  const rect = canvas.getBoundingClientRect();
  if (!model.window) return null;

  const x = asInt(model.window.x ?? 0);
  const y = asInt(model.window.y ?? 0);
  const w = clampPos(model.window.w ?? rect.width);
  const h = clampPos(model.window.h ?? rect.height);

  return {
    x,
    y,
    w,
    h,
    title: model.window.title ?? "",
    id: model.window.id,
    tbH: Math.max(0, asInt(settings.titleBarHeight))
  };
}

function hitWindow(mx: number, my: number): boolean {
  const wr = getWinRect();
  if (!wr) return false;
  return mx >= wr.x && mx <= wr.x + wr.w && my >= wr.y && my <= wr.y + wr.h;
}

function toLocal(mx: number, my: number): { lx: number; ly: number } {
  const wr = getWinRect();
  const ox = wr?.x ?? 0;
  const oy = wr?.y ?? 0;
  return { lx: mx - ox, ly: my - oy };
}

function toGlobal(lx: number, ly: number): { gx: number; gy: number } {
  const wr = getWinRect();
  const ox = wr?.x ?? 0;
  const oy = wr?.y ?? 0;
  return { gx: lx + ox, gy: ly + oy };
}

function hitTestGadget(mx: number, my: number): Gadget | null {
  if (!hitWindow(mx, my)) return null;

  const { lx, ly } = toLocal(mx, my);
  for (let i = model.gadgets.length - 1; i >= 0; i--) {
    const g = model.gadgets[i];
    if (lx >= g.x && lx <= g.x + g.w && ly >= g.y && ly <= g.y + g.h) return g;
  }
  return null;
}

function handlePointsLocal(x: number, y: number, w: number, h: number): Array<[Handle, number, number]> {
  return [
    ["nw", x, y],
    ["n", x + w / 2, y],
    ["ne", x + w, y],
    ["w", x, y + h / 2],
    ["e", x + w, y + h / 2],
    ["sw", x, y + h],
    ["s", x + w / 2, y + h],
    ["se", x + w, y + h]
  ];
}

function hitHandlePoints(points: Array<[Handle, number, number]>, mx: number, my: number): Handle | null {
  const half = HANDLE_HIT / 2;
  for (const [h, px, py] of points) {
    if (mx >= px - half && mx <= px + half && my >= py - half && my <= py + half) {
      return h;
    }
  }
  return null;
}

function hitHandleGadget(g: Gadget, mx: number, my: number): Handle | null {
  const { gx: ox, gy: oy } = toGlobal(0, 0);
  const pts = handlePointsLocal(g.x + ox, g.y + oy, g.w, g.h);
  return hitHandlePoints(pts, mx, my);
}

function hitHandleWindow(mx: number, my: number): Handle | null {
  const wr = getWinRect();
  if (!wr) return null;

  // Handles are around the outer window rect
  const pts = handlePointsLocal(wr.x, wr.y, wr.w, wr.h);
  return hitHandlePoints(pts, mx, my);
}

function isInTitleBar(mx: number, my: number): boolean {
  const wr = getWinRect();
  if (!wr) return false;
  const tbH = wr.tbH;
  if (tbH <= 0) return false;

  return mx >= wr.x && mx <= wr.x + wr.w && my >= wr.y && my <= wr.y + tbH;
}

function getHandleCursor(h: Handle): string {
  switch (h) {
    case "nw":
    case "se":
      return "nwse-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    case "n":
    case "s":
      return "ns-resize";
    case "w":
    case "e":
      return "ew-resize";
  }
}

function clampRect(
  x: number,
  y: number,
  w: number,
  h: number,
  minW: number,
  minH: number
): { x: number; y: number; w: number; h: number } {
  let nx = asInt(x);
  let ny = asInt(y);
  let nw = asInt(w);
  let nh = asInt(h);

  if (nw < minW) nw = minW;
  if (nh < minH) nh = minH;

  return { x: nx, y: ny, w: nw, h: nh };
}

function applyResize(
  x: number,
  y: number,
  w: number,
  h: number,
  dx: number,
  dy: number,
  handle: Handle,
  minW: number,
  minH: number
): { x: number; y: number; w: number; h: number } {
  let nx = x;
  let ny = y;
  let nw = w;
  let nh = h;

  const west = handle === "nw" || handle === "w" || handle === "sw";
  const east = handle === "ne" || handle === "e" || handle === "se";
  const north = handle === "nw" || handle === "n" || handle === "ne";
  const south = handle === "sw" || handle === "s" || handle === "se";

  if (east) nw = w + dx;
  if (south) nh = h + dy;

  if (west) {
    nx = x + dx;
    nw = w - dx;
  }

  if (north) {
    ny = y + dy;
    nh = h - dy;
  }

  if (nw < minW) {
    if (west) nx = x + (w - minW);
    nw = minW;
  }

  if (nh < minH) {
    if (north) ny = y + (h - minH);
    nh = minH;
  }

  return clampRect(nx, ny, nw, nh, minW, minH);
}

function snapValue(v: number, gridSize: number): number {
  if (gridSize <= 1) return Math.trunc(v);
  return Math.round(v / gridSize) * gridSize;
}

function postGadgetRect(g: Gadget) {
  normalizeRectInPlace(g, MIN_GADGET_W, MIN_GADGET_H);
  vscode.postMessage({ type: "setGadgetRect", id: g.id, x: g.x, y: g.y, w: g.w, h: g.h });
}

function postWindowRect() {
  if (!model.window) return;

  normalizeRectInPlace(model.window, MIN_WIN_W, MIN_WIN_H);
  vscode.postMessage({
    type: "setWindowRect",
    id: model.window.id,
    x: model.window.x,
    y: model.window.y,
    w: model.window.w,
    h: model.window.h
  });
}

canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  const g = hitTestGadget(mx, my);
  if (g) {
    selection = { kind: "gadget", id: g.id };

    const h = hitHandleGadget(g, mx, my);
    if (h) {
      drag = {
        target: "gadget",
        mode: "resize",
        id: g.id,
        handle: h,
        startMx: mx,
        startMy: my,
        startX: g.x,
        startY: g.y,
        startW: g.w,
        startH: g.h
      };
      canvas.style.cursor = getHandleCursor(h);
    } else {
      drag = {
        target: "gadget",
        mode: "move",
        id: g.id,
        startMx: mx,
        startMy: my,
        startX: g.x,
        startY: g.y
      };
      canvas.style.cursor = "move";
    }

    renderSelectionUiWithoutParentSelector();
    return;
  }

  // Window interaction (no gadget hit)
  const wr = getWinRect();
  if (wr && hitWindow(mx, my)) {
    selection = { kind: "window" };

    const wh = hitHandleWindow(mx, my);
    if (wh) {
      drag = {
        target: "window",
        mode: "resize",
        handle: wh,
        startMx: mx,
        startMy: my,
        startX: wr.x,
        startY: wr.y,
        startW: wr.w,
        startH: wr.h
      };
      canvas.style.cursor = getHandleCursor(wh);
    } else if (isInTitleBar(mx, my)) {
      drag = {
        target: "window",
        mode: "move",
        startMx: mx,
        startMy: my,
        startX: wr.x,
        startY: wr.y
      };
      canvas.style.cursor = "move";
    } else {
      drag = null;
      canvas.style.cursor = "default";
    }

    renderSelectionUiWithoutParentSelector();
    return;
  }

  selection = null;
  drag = null;
  canvas.style.cursor = "default";

  renderSelectionUiWithoutParentSelector();
});

window.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  if (!drag) {
    // Window handles have priority
    const wh = hitHandleWindow(mx, my);
    if (wh) {
      canvas.style.cursor = getHandleCursor(wh);
      return;
    }

    if (isInTitleBar(mx, my)) {
      canvas.style.cursor = "move";
      return;
    }

    // Gadget handle only when selected (like typical designers)
    {
      const sel = selection;
      if (sel && sel.kind === "gadget") {
        const selId = sel.id;
        const gSel = model.gadgets.find(it => it.id === selId);
        if (gSel) {
          const gh = hitHandleGadget(gSel, mx, my);
          if (gh) {
            canvas.style.cursor = getHandleCursor(gh);
            return;
          }
        }
      }
    }

    const g = hitTestGadget(mx, my);
    canvas.style.cursor = g ? "move" : "default";
    return;
  }

  const d = drag;
  const dx = mx - d.startMx;
  const dy = my - d.startMy;

  if (d.target === "gadget") {
    const g = model.gadgets.find(it => it.id === d.id);
    if (!g) return;

    if (d.mode === "move") {
      let nx = asInt(d.startX + dx);
      let ny = asInt(d.startY + dy);

      const p = applyLiveSnapPoint(nx, ny);
      nx = p.x;
      ny = p.y;

      g.x = nx;
      g.y = ny;
      canvas.style.cursor = "move";
    } else {
      const r0 = applyResize(d.startX, d.startY, d.startW, d.startH, dx, dy, d.handle, MIN_GADGET_W, MIN_GADGET_H);

      let nx = r0.x;
      let ny = r0.y;
      let nw = r0.w;
      let nh = r0.h;
      const r1 = applyLiveSnapRect(nx, ny, nw, nh, MIN_GADGET_W, MIN_GADGET_H);
      nx = r1.x;
      ny = r1.y;
      nw = r1.w;
      nh = r1.h;

      g.x = nx;
      g.y = ny;
      g.w = nw;
      g.h = nh;

      canvas.style.cursor = getHandleCursor(d.handle);
    }

    render();
    renderProps();
    return;
  }

  // Window dragging
  if (!model.window) return;

  if (d.mode === "move") {
    let nx = asInt(d.startX + dx);
    let ny = asInt(d.startY + dy);

    const p = applyLiveSnapPoint(nx, ny);
    nx = p.x;
    ny = p.y;

    model.window.x = nx;
    model.window.y = ny;

    canvas.style.cursor = "move";
  } else {
    const r0 = applyResize(d.startX, d.startY, d.startW, d.startH, dx, dy, d.handle, MIN_WIN_W, MIN_WIN_H);

    let nx = r0.x;
    let ny = r0.y;
    let nw = r0.w;
    let nh = r0.h;
    const r1 = applyLiveSnapRect(nx, ny, nw, nh, MIN_WIN_W, MIN_WIN_H);
    nx = r1.x;
    ny = r1.y;
    nw = r1.w;
    nh = r1.h;

    model.window.x = nx;
    model.window.y = ny;
    model.window.w = nw;
    model.window.h = nh;

    canvas.style.cursor = getHandleCursor(d.handle);
  }

  render();
  renderProps();
});

window.addEventListener("mouseup", () => {
  const d = drag;
  if (!d) return;

  if (d.target === "gadget") {
    const g = model.gadgets.find(it => it.id === d.id);
    if (g) {
      applyDropSnapRectInPlace(g, MIN_GADGET_W, MIN_GADGET_H);
      postGadgetRect(g);
    }
  } else {
    if (model.window) {
      applyDropSnapRectInPlace(model.window, MIN_WIN_W, MIN_WIN_H);
      postWindowRect();
    }
  }

  drag = null;
});

function render() {
  const ctx = canvas.getContext("2d")!;
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);

  const fg = getComputedStyle(document.body).color;
  const focus = getCssVar("--vscode-focusBorder") || fg;

  ctx.font = "12px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.lineWidth = 1;

  const wr = getWinRect();
  if (!wr) return;

  const winX = wr.x;
  const winY = wr.y;
  const winW = wr.w;
  const winH = wr.h;
  const winTitle = wr.title;
  const tbH = wr.tbH;

  // Outside dim (PB-like)
  if (settings.outsideDimOpacity > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(settings.outsideDimOpacity, 0, 1);
    ctx.fillStyle = fg;
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.restore();
  }

  // Window fill (so the window area is visually separated)
  if (settings.windowFillOpacity > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(settings.windowFillOpacity, 0, 1);
    ctx.fillStyle = fg;
    ctx.fillRect(winX, winY, winW, winH);
    ctx.restore();
  } else {
    // Ensure window area is not dimmed by outside fill
    ctx.clearRect(winX, winY, winW, winH);
  }

  // Grid only inside window
  if (settings.showGrid) {
    drawGrid(ctx, winX, winY, winW, winH, settings.gridSize, settings.gridOpacity, settings.gridMode, fg);
  }

  // Optional title bar
  if (tbH > 0) {
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = focus;
    ctx.fillRect(winX, winY, winW, tbH);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = focus;
    ctx.strokeRect(winX + 0.5, winY + 0.5, winW - 1, tbH - 1);
    ctx.restore();

    ctx.fillStyle = fg;
    ctx.fillText(winTitle, winX + 8, winY + Math.min(tbH - 8, 18));
  }

  // Window border
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = focus;
  ctx.strokeRect(winX + 0.5, winY + 0.5, winW - 1, winH - 1);
  ctx.restore();

  // Window selection overlay
  if (selection?.kind === "window") {
    ctx.save();
    ctx.strokeStyle = focus;
    ctx.lineWidth = 2;
    ctx.strokeRect(winX + 0.5, winY + 0.5, winW - 1, winH - 1);
    ctx.restore();

    drawHandles(ctx, winX, winY, winW, winH, focus);
  }

  // Gadgets (offset by window origin)
  for (const g of model.gadgets) {
    const gx = winX + g.x;
    const gy = winY + g.y;

    ctx.strokeStyle = fg;
    ctx.fillStyle = fg;
    ctx.lineWidth = 1;

    ctx.strokeRect(gx + 0.5, gy + 0.5, g.w, g.h);
    ctx.fillText(`${g.kind} ${g.id}`, gx + 4, gy + 14);

    const sel = selection;
    if (sel && sel.kind === "gadget" && g.id === sel.id) {
      ctx.save();
      ctx.strokeStyle = focus;
      ctx.lineWidth = 2;
      ctx.strokeRect(gx + 0.5, gy + 0.5, g.w, g.h);
      ctx.restore();

      drawHandles(ctx, gx, gy, g.w, g.h, focus);
    }
  }
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  w: number,
  h: number,
  size: number,
  opacity: number,
  mode: GridMode,
  color: string
) {
  if (size < 2) return;

  ctx.save();
  ctx.globalAlpha = clamp(opacity, 0, 1);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1;

  if (mode === "lines") {
    ctx.beginPath();
    for (let x = 0; x <= w; x += size) {
      ctx.moveTo(ox + x + 0.5, oy);
      ctx.lineTo(ox + x + 0.5, oy + h);
    }
    for (let y = 0; y <= h; y += size) {
      ctx.moveTo(ox, oy + y + 0.5);
      ctx.lineTo(ox + w, oy + y + 0.5);
    }
    ctx.stroke();
  } else {
    const r = 1;
    const maxDots = 350_000;
    let dots = 0;

    for (let y = 0; y <= h; y += size) {
      for (let x = 0; x <= w; x += size) {
        ctx.fillRect(ox + x - r, oy + y - r, r * 2, r * 2);
        dots++;
        if (dots >= maxDots) break;
      }
      if (dots >= maxDots) break;
    }
  }

  ctx.restore();
}

function drawHandles(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, stroke: string) {
  const s = HANDLE_SIZE;
  const hs = s / 2;

  const pts: Array<[number, number]> = [
    [x, y],
    [x + w / 2, y],
    [x + w, y],
    [x, y + h / 2],
    [x + w, y + h / 2],
    [x, y + h],
    [x + w / 2, y + h],
    [x + w, y + h],
  ];

  const fill = getCssVar("--vscode-editor-background") || "transparent";

  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;

  for (const [px, py] of pts) {
    const rx = Math.round(px - hs) + 0.5;
    const ry = Math.round(py - hs) + 0.5;
    ctx.fillRect(rx, ry, s, s);
    ctx.strokeRect(rx, ry, s, s);
  }

  ctx.restore();
}

function renderList() {
  listEl.innerHTML = "";

  type Node = {
    kind: "window" | "gadget" | "menu" | "toolbar" | "statusbar" | "menuEntry";
    id: string;
    label: string;
    selectable: boolean;
    children: Node[];
  };

  const keyOf = (n: Node) => `${n.kind}:${n.id}`;

  const isSel = (n: Node): boolean => {
    const sel = selection;
    if (!sel) return false;
    if (n.kind === "window") return sel.kind === "window";
    if (n.kind === "gadget") return sel.kind === "gadget" && sel.id === n.id;
    if (n.kind === "menu") return sel.kind === "menu" && sel.id === n.id;
    if (n.kind === "toolbar") return sel.kind === "toolbar" && sel.id === n.id;
    if (n.kind === "statusbar") return sel.kind === "statusbar" && sel.id === n.id;
    return false;
  };

  const gadgetMap = new Map<string, Gadget>();
  const childrenMap = new Map<string, string[]>();
  for (const g of model.gadgets) {
    gadgetMap.set(g.id, g);
    const p = g.parentId ?? "__root__";
    if (!childrenMap.has(p)) childrenMap.set(p, []);
    childrenMap.get(p)!.push(g.id);
  }

  const gadgetNode = (id: string): Node => {
    const g = gadgetMap.get(id)!;
    const kids = childrenMap.get(id) ?? [];

    const itemsCnt = g.items?.length ?? 0;
    const colsCnt = g.columns?.length ?? 0;
    const tab = typeof g.parentItem === "number" ? `  tab:${g.parentItem}` : "";
    const extra = `${itemsCnt ? `  items:${itemsCnt}` : ""}${colsCnt ? `  cols:${colsCnt}` : ""}${tab}`;

    return {
      kind: "gadget",
      id,
      label: `${g.kind}  ${g.id}${extra}`,
      selectable: true,
      children: kids.map(gadgetNode)
    };
  };

  const menuNodes: Node[] = (model.menus ?? []).map(m => {
    const entries = (m.entries ?? []).map((e, idx) => {
      const prefix = " ".repeat(Math.max(0, (e.level ?? 0)) * 2);
      const text = e.text ?? e.textRaw ?? "";
      const idPart = e.idRaw ? ` ${e.idRaw}` : "";
      return {
        kind: "menuEntry" as const,
        id: `${m.id}:${idx}`,
        label: `${prefix}${e.kind}${idPart}${text ? `  ${text}` : ""}`,
        selectable: false,
        children: []
      };
    });

    return {
      kind: "menu" as const,
      id: m.id,
      label: `Menu  ${m.id}  entries:${m.entries?.length ?? 0}`,
      selectable: true,
      children: entries
    };
  });

  const toolbarNodes: Node[] = (model.toolbars ?? []).map(t => {
    const entries = (t.entries ?? []).map((e, idx) => {
      const text = e.text ?? e.textRaw ?? "";
      const idPart = e.idRaw ? ` ${e.idRaw}` : "";
      return {
        kind: "menuEntry" as const,
        id: `${t.id}:${idx}`,
        label: `${e.kind}${idPart}${text ? `  ${text}` : ""}${e.iconRaw ? `  ${e.iconRaw}` : ""}`,
        selectable: false,
        children: []
      };
    });

    return {
      kind: "toolbar" as const,
      id: t.id,
      label: `ToolBar  ${t.id}  entries:${t.entries?.length ?? 0}`,
      selectable: true,
      children: entries
    };
  });

  const statusbarNodes: Node[] = (model.statusbars ?? []).map(sb => {
    const fields = (sb.fields ?? []).map((f, idx) => ({
      kind: "menuEntry" as const,
      id: `${sb.id}:field:${idx}`,
      label: `Field  ${idx}  width:${f.widthRaw}`,
      selectable: false,
      children: []
    }));

    return {
      kind: "statusbar" as const,
      id: sb.id,
      label: `StatusBar  ${sb.id}  fields:${sb.fields?.length ?? 0}`,
      selectable: true,
      children: fields
    };
  });

  const roots: Node[] = [];
  if (model.window) {
    roots.push({ kind: "window", id: model.window.id, label: `Window  ${model.window.id}`, selectable: true, children: [] });
  }

  const gadgetRoots = (childrenMap.get("__root__") ?? []).map(gadgetNode);
  roots.push(...gadgetRoots);

  // Attach non-visual structures under the window node (if present)
  if (roots.length > 0 && roots[0].kind === "window") {
    const win = roots[0];
    win.children = [...menuNodes, ...toolbarNodes, ...statusbarNodes];
  } else {
    roots.push(...menuNodes, ...toolbarNodes, ...statusbarNodes);
  }

  const ensureExpanded = (n: Node) => {
    const k = keyOf(n);
    if (!expanded.has(k)) {
      // Expand container gadgets and the window by default.
      const defaultExpanded = n.kind === "window" || (n.kind === "gadget" && CONTAINER_KINDS.has(gadgetMap.get(n.id)?.kind ?? ""));
      expanded.set(k, defaultExpanded);
    }
    return expanded.get(k)!;
  };

  const renderNode = (n: Node, depth: number) => {
    const div = document.createElement("div");
    div.className = "treeItem" + (isSel(n) ? " sel" : "");
    div.style.paddingLeft = `${8 + depth * 14}px`;

    const twisty = document.createElement("div");
    twisty.className = "twisty";

    const hasKids = n.children.length > 0;
    const isOpen = hasKids ? ensureExpanded(n) : false;
    twisty.textContent = hasKids ? (isOpen ? "▾" : "▸") : "";

    twisty.onclick = (ev) => {
      ev.stopPropagation();
      if (!hasKids) return;
      expanded.set(keyOf(n), !isOpen);
      renderListAndParentSelector();
    };

    const label = document.createElement("div");
    label.textContent = n.label;

    div.appendChild(twisty);
    div.appendChild(label);

    div.onclick = () => {
      if (!n.selectable) return;
      if (n.kind === "window") selection = { kind: "window" };
      else if (n.kind === "gadget") selection = { kind: "gadget", id: n.id };
      else if (n.kind === "menu") selection = { kind: "menu", id: n.id };
      else if (n.kind === "toolbar") selection = { kind: "toolbar", id: n.id };
      else if (n.kind === "statusbar") selection = { kind: "statusbar", id: n.id };
      render();
      renderListAndParentSelector();
      renderProps();
    };

    listEl.appendChild(div);

    if (hasKids && isOpen) {
      for (const c of n.children) {
        renderNode(c, depth + 1);
      }
    }
  };

  for (const n of roots) {
    renderNode(n, 0);
  }
}

function renderParentSelector() {
  if (!parentSelEl) return;

  const parentMap = new Map<string, string | undefined>();
  for (const g of model.gadgets) parentMap.set(g.id, g.parentId);

  const depthOf = (id: string): number => {
    let depth = 0;
    let cur = parentMap.get(id);
    const seen = new Set<string>();
    while (cur && !seen.has(cur) && depth < 40) {
      seen.add(cur);
      depth++;
      cur = parentMap.get(cur);
    }
    return depth;
  };

  const opts: Array<{ value: string; label: string }> = [];
  if (model.window) {
    opts.push({ value: "window", label: `Window  ${model.window.id}` });
  }

  const containers = model.gadgets
    .filter(g => CONTAINER_KINDS.has(g.kind))
    .sort((a, b) => depthOf(a.id) - depthOf(b.id));

  for (const g of containers) {
    const depth = depthOf(g.id);
    const pad = " ".repeat(depth * 2);
    opts.push({ value: `gadget:${g.id}`, label: `${pad}${g.kind}  ${g.id}` });
  }

  const computeCurrent = (): string => {
    const sel = selection;
    if (!sel) return opts[0]?.value ?? "window";
    if (sel.kind === "window") return "window";
    if (sel.kind === "gadget") {
      const g = model.gadgets.find(x => x.id === sel.id);
      if (g?.parentId) return `gadget:${g.parentId}`;
      return "window";
    }
    return "window";
  };

  const current = computeCurrent();

  parentSelEl.onchange = () => {
    const v = parentSelEl.value;
    if (v === "window") {
      selection = { kind: "window" };
    } else if (v.startsWith("gadget:")) {
      const id = v.slice("gadget:".length);
      selection = { kind: "gadget", id };
    }
    renderSelectionUiWithParentSelector();
  };

  parentSelEl.innerHTML = "";
  for (const o of opts) {
    const opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.label;
    parentSelEl.appendChild(opt);
  }

  if (opts.some(o => o.value === current)) {
    parentSelEl.value = current;
  } else if (opts.length) {
    parentSelEl.value = opts[0].value;
  }
}

function renderProps() {
  propsEl.innerHTML = "";

  const sel = selection;
  if (!sel) {
    propsEl.innerHTML = "<div class='muted'>No selection</div>";
    return;
  }

  const toPbString = (v: string): string => {
    const esc = (v ?? "").replace(/"/g, '""');
    return `"${esc}"`;
  };

  const section = (title: string) => {
    const h = document.createElement("div");
    h.className = "subHeader";
    h.textContent = title;
    return h;
  };

  const miniList = () => {
    const d = document.createElement("div");
    d.className = "miniList";
    return d;
  };

  const miniRow = (label: string, onEdit?: () => void, onDelete?: () => void) => {
    const r = document.createElement("div");
    r.className = "miniRow";

    const l = document.createElement("div");
    l.textContent = label;

    const b1 = document.createElement("button");
    b1.textContent = "Edit";
    b1.disabled = !onEdit;
    b1.onclick = () => onEdit?.();

    const b2 = document.createElement("button");
    b2.textContent = "Del";
    b2.disabled = !onDelete;
    b2.onclick = () => onDelete?.();

    r.appendChild(l);
    r.appendChild(b1);
    r.appendChild(b2);
    return r;
  };

  if (sel.kind === "window") {
    if (!model.window) {
      propsEl.innerHTML = "<div class='muted'>No window</div>";
      return;
    }

    const variableName = (model.window.variable ?? model.window.firstParam.replace(/^#/, "")).trim() || "Window_0";
    const enumSymbol = variableName ? `#${variableName.trim()}` : "#Window_0";

    propsEl.appendChild(row("Key", readonlyInput(model.window.id)));
    propsEl.appendChild(
      row("#PB_Any", checkboxInput(model.window.pbAny, v => {
        if (!model.window) return;
        vscode.postMessage({
          type: "toggleWindowPbAny",
          windowKey: model.window.id,
          toPbAny: v,
          variableName,
          enumSymbol,
          enumValueRaw: model.window.enumValueRaw
        });
      }))
    );

    propsEl.appendChild(
      row("Variable", textInput(variableName ?? "", v => {
        vscode.postMessage({
          type: "setWindowVariableName",
          variableName: v.trim().length ? v.trim() : undefined
        });
      }))
    );
    if (!model.window.pbAny) {
      propsEl.appendChild(
        row("Enum Value", textInput(model.window.enumValueRaw ?? "", v => {
          vscode.postMessage({
            type: "setWindowEnumValue",
            enumSymbol,
            enumValueRaw: v.trim().length ? v.trim() : undefined
          });
        }))
      );
    }

    propsEl.appendChild(row("Title", readonlyInput(model.window.title ?? "")));
    propsEl.appendChild(
      row("X", numberInput(model.window.x, v => { if (!model.window) return; model.window.x = asInt(v); postWindowRect(); render(); renderProps(); }))
    );
    propsEl.appendChild(
      row("Y", numberInput(model.window.y, v => { if (!model.window) return; model.window.y = asInt(v); postWindowRect(); render(); renderProps(); }))
    );
    propsEl.appendChild(
      row("W", numberInput(model.window.w, v => { if (!model.window) return; model.window.w = asInt(v); postWindowRect(); render(); renderProps(); }))
    );
    propsEl.appendChild(
      row("H", numberInput(model.window.h, v => { if (!model.window) return; model.window.h = asInt(v); postWindowRect(); render(); renderProps(); }))
    );
    return;
  }

  if (sel.kind === "menu") {
    const m = (model.menus ?? []).find(x => x.id === sel.id);
    if (!m) {
      propsEl.innerHTML = "<div class='muted'>Menu not found</div>";
      return;
    }

    propsEl.appendChild(row("Id", readonlyInput(m.id)));
    propsEl.appendChild(row("Entries", readonlyInput(String(m.entries?.length ?? 0))));
    const box = miniList();
    for (const e of m.entries ?? []) {
      const prefix = " ".repeat(Math.max(0, (e.level ?? 0)) * 2);
      const text = e.text ?? e.textRaw ?? "";
      const idPart = e.idRaw ? ` ${e.idRaw}` : "";
      const line = `${prefix}${e.kind}${idPart}${text ? `  ${text}` : ""}`;

      const canPatch = typeof e.source?.line === "number";
      const editFn = canPatch
        ? () => {
            const kind = e.kind;
            if (kind === "MenuItem") {
              const idRaw = prompt("Menu id", e.idRaw ?? "");
              if (idRaw === null) return;
              const txt = prompt("Menu text", e.text ?? "");
              if (txt === null) return;
              vscode.postMessage({
                type: "updateMenuEntry",
                menuId: m.id,
                sourceLine: e.source!.line,
                kind,
                idRaw: idRaw.trim(),
                textRaw: toPbString(txt)
              });
              return;
            }

            if (kind === "MenuTitle" || kind === "OpenSubMenu") {
              const txt = prompt("Title", e.text ?? "");
              if (txt === null) return;
              vscode.postMessage({
                type: "updateMenuEntry",
                menuId: m.id,
                sourceLine: e.source!.line,
                kind,
                textRaw: toPbString(txt)
              });
              return;
            }

            // MenuBar / CloseSubMenu are structural; no edit.
          }
        : undefined;

      const delFn = canPatch
        ? () => {
            if (!confirm("Delete this menu entry?")) return;
            vscode.postMessage({
              type: "deleteMenuEntry",
              menuId: m.id,
              sourceLine: e.source!.line,
              kind: e.kind
            });
          }
        : undefined;

      box.appendChild(miniRow(line, editFn, delFn));
    }
    propsEl.appendChild(section("Structure"));
    propsEl.appendChild(box);

    const addBtn = document.createElement("button");
    addBtn.textContent = "Add Entry";
    addBtn.onclick = () => {
      const kind = prompt(
        menuEntryKindHint(),
        "MenuItem"
      );
      if (kind === null) return;
      const k = kind.trim();
      if (!k.length) return;

      if (k === "MenuItem") {
        const idRaw = prompt("Menu id", "");
        if (idRaw === null) return;
        const txt = prompt("Menu text", "");
        if (txt === null) return;
        vscode.postMessage({ type: "insertMenuEntry", menuId: m.id, kind: k, idRaw: idRaw.trim(), textRaw: toPbString(txt) });
        return;
      }

      if (k === "MenuTitle" || k === "OpenSubMenu") {
        const txt = prompt("Title", "");
        if (txt === null) return;
        vscode.postMessage({ type: "insertMenuEntry", menuId: m.id, kind: k, textRaw: toPbString(txt) });
        return;
      }

      if (k === "MenuBar" || k === "CloseSubMenu") {
        vscode.postMessage({ type: "insertMenuEntry", menuId: m.id, kind: k });
      }
    };

    const actions = document.createElement("div");
    actions.className = "miniActions";
    actions.appendChild(addBtn);
    propsEl.appendChild(actions);
    return;
  }

  if (sel.kind === "toolbar") {
    const t = (model.toolbars ?? []).find(x => x.id === sel.id);
    if (!t) {
      propsEl.innerHTML = "<div class='muted'>ToolBar not found</div>";
      return;
    }

    propsEl.appendChild(row("Id", readonlyInput(t.id)));
    propsEl.appendChild(row("Entries", readonlyInput(String(t.entries?.length ?? 0))));
    const box = miniList();
    for (const e of t.entries ?? []) {
      const text = e.text ?? e.textRaw ?? "";
      const idPart = e.idRaw ? ` ${e.idRaw}` : "";
      const extra = e.iconRaw ? `  ${e.iconRaw}` : "";
      const line = `${e.kind}${idPart}${text ? `  ${text}` : ""}${extra}`;

      const canPatch = typeof e.source?.line === "number";
      const editFn = canPatch
        ? () => {
            const kind = e.kind;
            if (kind === "ToolBarStandardButton") {
              const idRaw = prompt("Button id", e.idRaw ?? "");
              if (idRaw === null) return;
              const iconRaw = prompt("Icon raw", e.iconRaw ?? "0");
              if (iconRaw === null) return;
              vscode.postMessage({
                type: "updateToolBarEntry",
                toolBarId: t.id,
                sourceLine: e.source!.line,
                kind,
                idRaw: idRaw.trim(),
                iconRaw: iconRaw.trim()
              });
              return;
            }

            if (kind === "ToolBarButton") {
              const idRaw = prompt("Button id", e.idRaw ?? "");
              if (idRaw === null) return;
              const iconRaw = prompt("Icon raw", e.iconRaw ?? "0");
              if (iconRaw === null) return;
              const txt = prompt("Text", e.text ?? "");
              if (txt === null) return;
              vscode.postMessage({
                type: "updateToolBarEntry",
                toolBarId: t.id,
                sourceLine: e.source!.line,
                kind,
                idRaw: idRaw.trim(),
                iconRaw: iconRaw.trim(),
                textRaw: toPbString(txt)
              });
              return;
            }

            if (kind === "ToolBarToolTip") {
              const idRaw = prompt("Button id", e.idRaw ?? "");
              if (idRaw === null) return;
              const txt = prompt("Tooltip", e.text ?? "");
              if (txt === null) return;
              vscode.postMessage({
                type: "updateToolBarEntry",
                toolBarId: t.id,
                sourceLine: e.source!.line,
                kind,
                idRaw: idRaw.trim(),
                textRaw: toPbString(txt)
              });
              return;
            }

            // ToolBarSeparator has no editable fields.
          }
        : undefined;

      const delFn = canPatch
        ? () => {
            if (!confirm("Delete this toolbar entry?")) return;
            vscode.postMessage({
              type: "deleteToolBarEntry",
              toolBarId: t.id,
              sourceLine: e.source!.line,
              kind: e.kind
            });
          }
        : undefined;

      box.appendChild(miniRow(line, editFn, delFn));
    }
    propsEl.appendChild(section("Structure"));
    propsEl.appendChild(box);

    const addBtn = document.createElement("button");
    addBtn.textContent = "Add Entry";
    addBtn.onclick = () => {
      const kind = prompt(
        toolBarEntryKindHint(),
        "ToolBarButton"
      );
      if (kind === null) return;
      const k = kind.trim();
      if (!k.length) return;

      if (k === "ToolBarSeparator") {
        vscode.postMessage({ type: "insertToolBarEntry", toolBarId: t.id, kind: k });
        return;
      }

      if (k === "ToolBarStandardButton") {
        const idRaw = prompt("Button id", "");
        if (idRaw === null) return;
        const iconRaw = prompt("Icon raw", "0");
        if (iconRaw === null) return;
        vscode.postMessage({ type: "insertToolBarEntry", toolBarId: t.id, kind: k, idRaw: idRaw.trim(), iconRaw: iconRaw.trim() });
        return;
      }

      if (k === "ToolBarButton") {
        const idRaw = prompt("Button id", "");
        if (idRaw === null) return;
        const iconRaw = prompt("Icon raw", "0");
        if (iconRaw === null) return;
        const txt = prompt("Text", "");
        if (txt === null) return;
        vscode.postMessage({ type: "insertToolBarEntry", toolBarId: t.id, kind: k, idRaw: idRaw.trim(), iconRaw: iconRaw.trim(), textRaw: toPbString(txt) });
        return;
      }

      if (k === "ToolBarToolTip") {
        const idRaw = prompt("Button id", "");
        if (idRaw === null) return;
        const txt = prompt("Tooltip", "");
        if (txt === null) return;
        vscode.postMessage({ type: "insertToolBarEntry", toolBarId: t.id, kind: k, idRaw: idRaw.trim(), textRaw: toPbString(txt) });
      }
    };

    const actions = document.createElement("div");
    actions.className = "miniActions";
    actions.appendChild(addBtn);
    propsEl.appendChild(actions);
    return;
  }

  if (sel.kind === "statusbar") {
    const sb = (model.statusbars ?? []).find(x => x.id === sel.id);
    if (!sb) {
      propsEl.innerHTML = "<div class='muted'>StatusBar not found</div>";
      return;
    }

    propsEl.appendChild(row("Id", readonlyInput(sb.id)));
    propsEl.appendChild(row("Fields", readonlyInput(String(sb.fields?.length ?? 0))));
    const box = miniList();
    (sb.fields ?? []).forEach((f, idx) => {
      const canPatch = typeof f.source?.line === "number";
      const label = `Field ${idx}  width:${f.widthRaw}`;

      const editFn = canPatch
        ? () => {
            const width = prompt("Width raw", f.widthRaw ?? "0");
            if (width === null) return;
            vscode.postMessage({
              type: "updateStatusBarField",
              statusBarId: sb.id,
              sourceLine: f.source!.line,
              widthRaw: width.trim()
            });
          }
        : undefined;

      const delFn = canPatch
        ? () => {
            if (!confirm("Delete this statusbar field?")) return;
            vscode.postMessage({
              type: "deleteStatusBarField",
              statusBarId: sb.id,
              sourceLine: f.source!.line
            });
          }
        : undefined;

      box.appendChild(miniRow(label, editFn, delFn));
    });
    propsEl.appendChild(section("Fields"));
    propsEl.appendChild(box);

    const addBtn = document.createElement("button");
    addBtn.textContent = "Add Field";
    addBtn.onclick = () => {
      const width = prompt("Width raw", "0");
      if (width === null) return;
      vscode.postMessage({ type: "insertStatusBarField", statusBarId: sb.id, widthRaw: width.trim() });
    };

    const actions = document.createElement("div");
    actions.className = "miniActions";
    actions.appendChild(addBtn);
    propsEl.appendChild(actions);
    return;
  }

  if (sel.kind !== "gadget") {
    propsEl.innerHTML = "<div class='muted'>No selection</div>";
    return;
  }

  const selId = sel.id;
  const g = model.gadgets.find(it => it.id === selId);
  if (!g) {
    propsEl.innerHTML = "<div class='muted'>No selection</div>";
    return;
  }

  propsEl.appendChild(row("Id", readonlyInput(g.id)));
  propsEl.appendChild(row("Kind", readonlyInput(g.kind)));
  propsEl.appendChild(row("Parent", readonlyInput((g.parentId ?? "").toString())));
  propsEl.appendChild(row("Tab", readonlyInput(typeof g.parentItem === "number" ? String(g.parentItem) : "")));
  propsEl.appendChild(row("Items", readonlyInput(String(g.items?.length ?? 0))));
  propsEl.appendChild(row("Columns", readonlyInput(String(g.columns?.length ?? 0))));

  if (g.parentId) {
    const btn = document.createElement("button");
    btn.textContent = "Select Parent";
    btn.onclick = () => {
      selection = { kind: "gadget", id: g.parentId! };
      render();
      renderListAndParentSelector();
      renderProps();
    };
    propsEl.appendChild(row("", btn));
  }

  propsEl.appendChild(row("X", numberInput(g.x, v => { g.x = asInt(v); postGadgetRect(g); render(); renderProps(); })));
  propsEl.appendChild(row("Y", numberInput(g.y, v => { g.y = asInt(v); postGadgetRect(g); render(); renderProps(); })));
  propsEl.appendChild(row("W", numberInput(g.w, v => { g.w = asInt(v); postGadgetRect(g); render(); renderProps(); })));
  propsEl.appendChild(row("H", numberInput(g.h, v => { g.h = asInt(v); postGadgetRect(g); render(); renderProps(); })));

  // Items editor (minimal UI)
  propsEl.appendChild(section("Items"));
  const itemsBox = miniList();
  (g.items ?? []).forEach((it, idx) => {
    const label = `${idx}  ${it.text ?? it.textRaw ?? ""}`;
    const canPatch = typeof it.source?.line === "number";

    itemsBox.appendChild(
      miniRow(
        label,
        canPatch
          ? () => {
              const txt = prompt("Item text", it.text ?? "");
              if (txt === null) return;
              const pos = prompt("Position (-1 append)", it.posRaw ?? "-1");
              if (pos === null) return;
              const img = prompt("Image raw (optional)", it.imageRaw ?? "");
              if (img === null) return;
              const flags = prompt("Flags raw (optional)", it.flagsRaw ?? "");
              if (flags === null) return;

              vscode.postMessage({
                type: "updateGadgetItem",
                id: g.id,
                sourceLine: it.source!.line,
                posRaw: pos,
                textRaw: toPbString(txt),
                imageRaw: img.trim().length ? img.trim() : undefined,
                flagsRaw: flags.trim().length ? flags.trim() : undefined
              });
            }
          : undefined,
        canPatch
          ? () => {
              if (!confirm("Delete this item?")) return;
              vscode.postMessage({ type: "deleteGadgetItem", id: g.id, sourceLine: it.source!.line });
            }
          : undefined
      )
    );
  });

  const addItemBtn = document.createElement("button");
  addItemBtn.textContent = "Add Item";
  addItemBtn.onclick = () => {
    const txt = prompt("Item text", "");
    if (txt === null) return;
    const pos = prompt("Position (-1 append)", "-1");
    if (pos === null) return;
    const img = prompt("Image raw (optional)", "");
    if (img === null) return;
    const flags = prompt("Flags raw (optional)", "");
    if (flags === null) return;

    vscode.postMessage({
      type: "insertGadgetItem",
      id: g.id,
      posRaw: pos,
      textRaw: toPbString(txt),
      imageRaw: img.trim().length ? img.trim() : undefined,
      flagsRaw: flags.trim().length ? flags.trim() : undefined
    });
  };

  const itemActions = document.createElement("div");
  itemActions.className = "miniActions";
  itemActions.appendChild(addItemBtn);

  propsEl.appendChild(itemsBox);
  propsEl.appendChild(itemActions);

  // Columns editor (minimal UI)
  propsEl.appendChild(section("Columns"));
  const colsBox = miniList();
  (g.columns ?? []).forEach((c, idx) => {
    const label = `${idx}  ${c.title ?? c.titleRaw ?? ""}  w:${c.widthRaw ?? ""}`;
    const canPatch = typeof c.source?.line === "number";

    colsBox.appendChild(
      miniRow(
        label,
        canPatch
          ? () => {
              const title = prompt("Column title", c.title ?? "");
              if (title === null) return;
              const col = prompt("Column index", c.colRaw ?? String(idx));
              if (col === null) return;
              const width = prompt("Width", c.widthRaw ?? "80");
              if (width === null) return;

              vscode.postMessage({
                type: "updateGadgetColumn",
                id: g.id,
                sourceLine: c.source!.line,
                colRaw: col,
                titleRaw: toPbString(title),
                widthRaw: width
              });
            }
          : undefined,
        canPatch
          ? () => {
              if (!confirm("Delete this column?")) return;
              vscode.postMessage({ type: "deleteGadgetColumn", id: g.id, sourceLine: c.source!.line });
            }
          : undefined
      )
    );
  });

  const addColBtn = document.createElement("button");
  addColBtn.textContent = "Add Column";
  addColBtn.onclick = () => {
    const title = prompt("Column title", "");
    if (title === null) return;
    const col = prompt("Column index", String(g.columns?.length ?? 0));
    if (col === null) return;
    const width = prompt("Width", "80");
    if (width === null) return;

    vscode.postMessage({
      type: "insertGadgetColumn",
      id: g.id,
      colRaw: col,
      titleRaw: toPbString(title),
      widthRaw: width
    });
  };

  const colActions = document.createElement("div");
  colActions.className = "miniActions";
  colActions.appendChild(addColBtn);

  propsEl.appendChild(colsBox);
  propsEl.appendChild(colActions);
}

function row(label: string, input: HTMLElement) {
  const wrap = document.createElement("div");
  wrap.className = "row";
  const l = document.createElement("div");
  l.textContent = label;
  wrap.appendChild(l);
  wrap.appendChild(input);
  return wrap;
}

function readonlyInput(value: string) {
  const i = document.createElement("input");
  i.value = value;
  i.readOnly = true;
  return i;
}

function textInput(value: string, onChange: (v: string) => void) {
  const i = document.createElement("input");
  i.value = value;
  i.onchange = () => onChange(i.value);
  return i;
}

function checkboxInput(value: boolean, onChange: (v: boolean) => void) {
  const i = document.createElement("input");
  i.type = "checkbox";
  i.checked = Boolean(value);
  i.onchange = () => onChange(i.checked);
  return i;
}

function numberInput(value: number, onChange: (v: number) => void) {
  const i = document.createElement("input");
  i.type = "number";
  i.value = String(value);
  i.onchange = () => onChange(Number(i.value));
  return i;
}

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function clampPos(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.max(1, Math.trunc(v));
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function asInt(v: any): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

resizeCanvas();
vscode.postMessage({ type: "ready" });