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
};

// Backwards compatible:
// - init may come without settings
type ExtensionToWebviewMessage =
  | { type: "init"; model: Model; settings?: DesignerSettings }
  | { type: "settings"; settings: DesignerSettings }
  | { type: "error"; message: string };

type WebviewToExtensionMessage =
  | { type: "ready" }
  | { type: "moveGadget"; id: string; x: number; y: number }
  | { type: "setGadgetRect"; id: string; x: number; y: number; w: number; h: number }
  | { type: "setWindowRect"; id: string; x: number; y: number; w: number; h: number }
  | { type: "insertGadgetItem"; id: string; posRaw: string; textRaw: string; imageRaw?: string; flagsRaw?: string }
  | { type: "updateGadgetItem"; id: string; sourceLine: number; posRaw: string; textRaw: string; imageRaw?: string; flagsRaw?: string }
  | { type: "deleteGadgetItem"; id: string; sourceLine: number }
  | { type: "insertGadgetColumn"; id: string; colRaw: string; titleRaw: string; widthRaw: string }
  | { type: "updateGadgetColumn"; id: string; sourceLine: number; colRaw: string; titleRaw: string; widthRaw: string }
  | { type: "deleteGadgetColumn"; id: string; sourceLine: number };

declare const acquireVsCodeApi: () => { postMessage: (msg: WebviewToExtensionMessage) => void };

const vscode = acquireVsCodeApi();

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

  canvasBackground: ""
};

type Handle = "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se";

const HANDLE_SIZE = 6;
const HANDLE_HIT = 10;

const MIN_GADGET_W = 8;
const MIN_GADGET_H = 8;

// Keep this permissive; PB allows small windows, but avoid 0/negative sizes.
const MIN_WIN_W = 40;
const MIN_WIN_H = 40;

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
  document.documentElement.style.setProperty(
    "--pbfd-canvas-bg",
    bg.length ? bg : "var(--vscode-editor-background)"
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
    if (selection) {
      if (selection.kind === "gadget") {
        const selId = selection.id;
        if (!model.gadgets.some(g => g.id === selId)) selection = null;

      } else if (selection.kind === "window") {
        if (!model.window) selection = null;

      } else if (selection.kind === "menu") {
        const selId = selection.id;
        const menus = model.menus ?? [];
        if (!menus.some(m => m.id === selId)) selection = null;

      } else if (selection.kind === "toolbar") {
        const selId = selection.id;
        const toolbars = model.toolbars ?? [];
        if (!toolbars.some(t => t.id === selId)) selection = null;

      } else if (selection.kind === "statusbar") {
        const selId = selection.id;
        const statusbars = model.statusbars ?? [];
        if (!statusbars.some(sb => sb.id === selId)) selection = null;
      }
    }

    render();
    renderParentSelector();
    renderList();
    renderProps();
    renderDiagnostics();
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
  const r = clampRect(g.x, g.y, g.w, g.h, MIN_GADGET_W, MIN_GADGET_H);
  g.x = r.x;
  g.y = r.y;
  g.w = r.w;
  g.h = r.h;

  vscode.postMessage({ type: "setGadgetRect", id: g.id, x: g.x, y: g.y, w: g.w, h: g.h });
}

function postWindowRect() {
  if (!model.window) return;

  const r = clampRect(model.window.x, model.window.y, model.window.w, model.window.h, MIN_WIN_W, MIN_WIN_H);
  model.window.x = r.x;
  model.window.y = r.y;
  model.window.w = r.w;
  model.window.h = r.h;

  vscode.postMessage({ type: "setWindowRect", id: model.window.id, x: r.x, y: r.y, w: r.w, h: r.h });
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

    render();
    renderList();
    renderProps();
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

    render();
    renderList();
    renderProps();
    return;
  }

  selection = null;
  drag = null;
  canvas.style.cursor = "default";

  render();
  renderList();
  renderProps();
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
    if (selection?.kind === "gadget") {
      const selId = selection.id;
      const sel = model.gadgets.find(it => it.id === selId);
      if (sel) {
        const gh = hitHandleGadget(sel, mx, my);
        if (gh) {
          canvas.style.cursor = getHandleCursor(gh);
          return;
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

      if (settings.snapToGrid && settings.snapMode === "live") {
        const gs = settings.gridSize;
        nx = snapValue(nx, gs);
        ny = snapValue(ny, gs);
      }

      g.x = nx;
      g.y = ny;
      canvas.style.cursor = "move";
    } else {
      const r0 = applyResize(d.startX, d.startY, d.startW, d.startH, dx, dy, d.handle, MIN_GADGET_W, MIN_GADGET_H);

      let nx = r0.x;
      let ny = r0.y;
      let nw = r0.w;
      let nh = r0.h;

      if (settings.snapToGrid && settings.snapMode === "live") {
        const gs = settings.gridSize;
        nx = snapValue(nx, gs);
        ny = snapValue(ny, gs);
        nw = snapValue(nw, gs);
        nh = snapValue(nh, gs);

        const r1 = clampRect(nx, ny, nw, nh, MIN_GADGET_W, MIN_GADGET_H);
        nx = r1.x;
        ny = r1.y;
        nw = r1.w;
        nh = r1.h;
      }

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

    if (settings.snapToGrid && settings.snapMode === "live") {
      const gs = settings.gridSize;
      nx = snapValue(nx, gs);
      ny = snapValue(ny, gs);
    }

    model.window.x = nx;
    model.window.y = ny;

    canvas.style.cursor = "move";
  } else {
    const r0 = applyResize(d.startX, d.startY, d.startW, d.startH, dx, dy, d.handle, MIN_WIN_W, MIN_WIN_H);

    let nx = r0.x;
    let ny = r0.y;
    let nw = r0.w;
    let nh = r0.h;

    if (settings.snapToGrid && settings.snapMode === "live") {
      const gs = settings.gridSize;
      nx = snapValue(nx, gs);
      ny = snapValue(ny, gs);
      nw = snapValue(nw, gs);
      nh = snapValue(nh, gs);

      const r1 = clampRect(nx, ny, nw, nh, MIN_WIN_W, MIN_WIN_H);
      nx = r1.x;
      ny = r1.y;
      nw = r1.w;
      nh = r1.h;
    }

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
      if (settings.snapToGrid && settings.snapMode === "drop") {
        const gs = settings.gridSize;
        g.x = snapValue(g.x, gs);
        g.y = snapValue(g.y, gs);
        g.w = snapValue(g.w, gs);
        g.h = snapValue(g.h, gs);

        const r = clampRect(g.x, g.y, g.w, g.h, MIN_GADGET_W, MIN_GADGET_H);
        g.x = r.x;
        g.y = r.y;
        g.w = r.w;
        g.h = r.h;
      }

      postGadgetRect(g);
    }
  } else {
    if (model.window) {
      if (settings.snapToGrid && settings.snapMode === "drop") {
        const gs = settings.gridSize;
        model.window.x = snapValue(model.window.x, gs);
        model.window.y = snapValue(model.window.y, gs);
        model.window.w = snapValue(model.window.w, gs);
        model.window.h = snapValue(model.window.h, gs);

        const r = clampRect(model.window.x, model.window.y, model.window.w, model.window.h, MIN_WIN_W, MIN_WIN_H);
        model.window.x = r.x;
        model.window.y = r.y;
        model.window.w = r.w;
        model.window.h = r.h;
      }

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

    if (selection?.kind === "gadget" && g.id === selection.id) {
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
    if (!selection) return false;
    if (n.kind === "window") return selection.kind === "window";
    if (n.kind === "gadget") return selection.kind === "gadget" && selection.id === n.id;
    if (n.kind === "menu") return selection.kind === "menu" && selection.id === n.id;
    if (n.kind === "toolbar") return selection.kind === "toolbar" && selection.id === n.id;
    if (n.kind === "statusbar") return selection.kind === "statusbar" && selection.id === n.id;
    return false;
  };

  const containerKinds = new Set(["ContainerGadget", "PanelGadget", "ScrollAreaGadget"]);

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
      const defaultExpanded = n.kind === "window" || (n.kind === "gadget" && containerKinds.has(gadgetMap.get(n.id)?.kind ?? ""));
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
      renderList();
      renderParentSelector();
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
      renderList();
      renderParentSelector();
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

  const containerKinds = new Set(["ContainerGadget", "PanelGadget", "ScrollAreaGadget"]);

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
    .filter(g => containerKinds.has(g.kind))
    .sort((a, b) => depthOf(a.id) - depthOf(b.id));

  for (const g of containers) {
    const depth = depthOf(g.id);
    const pad = " ".repeat(depth * 2);
    opts.push({ value: `gadget:${g.id}`, label: `${pad}${g.kind}  ${g.id}` });
  }

  const computeCurrent = (): string => {
    if (!selection) return opts[0]?.value ?? "window";
    if (selection.kind === "window") return "window";
    if (selection && selection.kind === "gadget") {
      const selId = selection.id;
      const g = model.gadgets.find(x => x.id === selId);
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
    render();
    renderList();
    renderParentSelector();
    renderProps();
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

  if (!selection) {
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

  if (selection.kind === "window") {
    if (!model.window) {
      propsEl.innerHTML = "<div class='muted'>No window</div>";
      return;
    }

    propsEl.appendChild(row("Id", readonlyInput(model.window.id)));
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

  if (selection.kind === "menu") {
    const selId = selection.id;
    const m = (model.menus ?? []).find(x => x.id === selId);
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
      box.appendChild(miniRow(line));
    }
    propsEl.appendChild(section("Structure"));
    propsEl.appendChild(box);
    return;
  }

  if (selection.kind === "toolbar") {
    const selId = selection.id;
    const t = (model.toolbars ?? []).find(x => x.id === selId);
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
      box.appendChild(miniRow(line));
    }
    propsEl.appendChild(section("Structure"));
    propsEl.appendChild(box);
    return;
  }

  if (selection.kind === "statusbar") {
    const selId = selection.id;
    const sb = (model.statusbars ?? []).find(x => x.id === selId);
    if (!sb) {
      propsEl.innerHTML = "<div class='muted'>StatusBar not found</div>";
      return;
    }

    propsEl.appendChild(row("Id", readonlyInput(sb.id)));
    propsEl.appendChild(row("Fields", readonlyInput(String(sb.fields?.length ?? 0))));
    const box = miniList();
    (sb.fields ?? []).forEach((f, idx) => {
      box.appendChild(miniRow(`Field ${idx}  width:${f.widthRaw}`));
    });
    propsEl.appendChild(section("Fields"));
    propsEl.appendChild(box);
    return;
  }

  if (selection.kind !== "gadget") {
    propsEl.innerHTML = "<div class='muted'>No selection</div>";
    return;
  }

  const selId = selection.id;
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
      renderList();
      renderParentSelector();
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