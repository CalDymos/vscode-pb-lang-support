import {
  FormDocument,
  FormEnumerations,
  FormIssue,
  FormMenu,
  FormMenuEntry,
  FormMeta,
  FormStatusBar,
  FormStatusBarField,
  FormToolBar,
  FormToolBarEntry,
  FormWindow,
  Gadget,
  GadgetColumn,
  GadgetItem,
  GadgetKind,
  ScanRange,
  TOOLBAR_ENTRY_KIND,
  MENU_ENTRY_KIND,
  GADGET_KIND_SET,
  GADGET_KIND,
  ENUM_NAMES
} from "../model";

import { splitParams, unquoteString, asNumber } from "./tokenizer";
import { PbCall, scanCalls } from "./callScanner";

function asGadgetKind(s: string): GadgetKind | undefined {
  return GADGET_KIND_SET.has(s as GadgetKind) ? (s as GadgetKind) : undefined;
}

function resolveNonNegativeIndex(raw: string, fallback: number): number {
  const n = asNumber(raw);
  return typeof n === "number" && n >= 0 ? n : fallback;
}

export function parseFormDocument(text: string): FormDocument {
  const issues: FormIssue[] = [];

  const header = parseFormHeader(text);
  if (!header) {
    issues.push({
      severity: "warning",
      message: "Missing Form Designer header ('; Form Designer for PureBasic - x.xx').",
      line: 0
    });
  } else if (!header.hasStrictSyntaxWarning) {
    issues.push({
      severity: "info",
      message: "Strict syntax warning line not found. The PureBasic IDE usually writes it as the second header comment.",
      line: header.line
    });
  }

  const scanRange = detectFormScanRange(text, header?.line);

  const enums = parseFormEnumerations(text, scanRange);
  const winEnumValues = parseEnumerationValueMap(text, scanRange, ENUM_NAMES.windows);

  const meta: FormMeta = {
    header: header ?? undefined,
    scanRange,
    issues,
    enums
  };

  const doc: FormDocument = { window: undefined, gadgets: [], menus: [], toolbars: [], statusbars: [], meta };

  const gadgetById = new Map<string, Gadget>();
  const panelCurrentItem = new Map<string, number>();

  type ParentCtx = { id: string; kind: GadgetKind; currentPanelItem?: number };
  const parentStack: ParentCtx[] = [];

  let curMenu: FormMenu | undefined;
  let menuLevel = 0;
  let curToolBar: FormToolBar | undefined;
  let curStatusBar: FormStatusBar | undefined;


  const pushImplicitParent = (g: Gadget) => {
    if (g.kind === GADGET_KIND.ContainerGadget || g.kind === GADGET_KIND.PanelGadget || g.kind === GADGET_KIND.ScrollAreaGadget) {
      parentStack.push({
        id: g.id,
        kind: g.kind,
        currentPanelItem: g.kind === GADGET_KIND.PanelGadget ? panelCurrentItem.get(g.id) : undefined
      });
    }
  };

  const setPanelItem = (panelId: string, itemIndex: number | undefined) => {
    if (typeof itemIndex === "number" && Number.isFinite(itemIndex)) {
      panelCurrentItem.set(panelId, itemIndex);
    }
    // Update the nearest matching PanelGadget context on the stack.
    for (let i = parentStack.length - 1; i >= 0; i--) {
      const ctx = parentStack[i];
      if (ctx.kind === GADGET_KIND.PanelGadget && ctx.id === panelId) {
        ctx.currentPanelItem = itemIndex;
        break;
      }
    }
  };

  const lines = text.split(/\r?\n/);

  const setMenuContext = (menu: FormMenu | undefined) => {
    curMenu = menu;
    menuLevel = 0;
    curToolBar = undefined;
    curStatusBar = undefined;
  };

  const setToolBarContext = (toolBar: FormToolBar | undefined) => {
    curToolBar = toolBar;
    curMenu = undefined;
    menuLevel = 0;
    curStatusBar = undefined;
  };

  const setStatusBarContext = (statusBar: FormStatusBar | undefined) => {
    curStatusBar = statusBar;
    curMenu = undefined;
    menuLevel = 0;
    curToolBar = undefined;
  };

  const addMenuEntry = (entry: FormMenuEntry) => {
    if (curMenu) curMenu.entries.push(entry);
  };

  const addToolBarEntry = (entry: FormToolBarEntry) => {
    if (curToolBar) curToolBar.entries.push(entry);
  };

  const addStatusBarField = (field: FormStatusBarField) => {
    if (curStatusBar) curStatusBar.fields.push(field);
  };

  const calls: PbCall[] = scanCalls(text, scanRange);
  for (const c of calls) {
    // -----------------------------------------------------------------------------
    // Menu / ToolBar / StatusBar parsing (independent from gadget list nesting)
    // -----------------------------------------------------------------------------
    switch (c.name) {
      case "CreateMenu": {
        const p = splitParams(c.args);
        const id = (p[0] ?? "").trim();
        if (id.length) {
          const menu: FormMenu = { id, entries: [], source: c.range };
          doc.menus.push(menu);
          setMenuContext(menu);
        } else {
          setMenuContext(undefined);
        }
        break;
      }

      case MENU_ENTRY_KIND.MenuTitle: {
        if (!curMenu) break;
        const p = splitParams(c.args);
        const textRaw = p[0]?.trim();
        addMenuEntry({ kind: MENU_ENTRY_KIND.MenuTitle, level: menuLevel, textRaw, text: unquoteString(textRaw ?? ""), source: c.range });
        break;
      }

      case MENU_ENTRY_KIND.MenuItem: {
        if (!curMenu) break;
        const p = splitParams(c.args);
        const idRaw = p[0]?.trim();
        const textRaw = p[1]?.trim();
        addMenuEntry({ kind: MENU_ENTRY_KIND.MenuItem, level: menuLevel, idRaw, textRaw, text: unquoteString(textRaw ?? ""), source: c.range });
        break;
      }

      case MENU_ENTRY_KIND.MenuBar: {
        if (!curMenu) break;
        addMenuEntry({ kind: MENU_ENTRY_KIND.MenuBar, level: menuLevel, source: c.range });
        break;
      }

      case MENU_ENTRY_KIND.OpenSubMenu: {
        if (!curMenu) break;
        const p = splitParams(c.args);
        const textRaw = p[0]?.trim();
        addMenuEntry({ kind: MENU_ENTRY_KIND.OpenSubMenu, level: menuLevel, textRaw, text: unquoteString(textRaw ?? ""), source: c.range });
        menuLevel++;
        break;
      }

      case MENU_ENTRY_KIND.CloseSubMenu: {
        if (!curMenu) break;
        menuLevel = Math.max(0, menuLevel - 1);
        addMenuEntry({ kind: MENU_ENTRY_KIND.CloseSubMenu, level: menuLevel, source: c.range });
        break;
      }

      case "CreateToolBar": {
        const p = splitParams(c.args);
        const id = (p[0] ?? "").trim();
        if (id.length) {
          const toolBar: FormToolBar = { id, entries: [], source: c.range };
          doc.toolbars.push(toolBar);
          setToolBarContext(toolBar);
        } else {
          setToolBarContext(undefined);
        }
        break;
      }

      case TOOLBAR_ENTRY_KIND.ToolBarStandardButton: {
        if (!curToolBar) break;
        const p = splitParams(c.args);
        addToolBarEntry({ kind: TOOLBAR_ENTRY_KIND.ToolBarStandardButton, idRaw: p[0]?.trim(), iconRaw: p[1]?.trim(), source: c.range });
        break;
      }

      case TOOLBAR_ENTRY_KIND.ToolBarButton: {
        if (!curToolBar) break;
        const p = splitParams(c.args);
        addToolBarEntry({
          kind: TOOLBAR_ENTRY_KIND.ToolBarButton,
          idRaw: p[0]?.trim(),
          iconRaw: p[1]?.trim(),
          textRaw: p[2]?.trim(),
          text: unquoteString(p[2] ?? ""),
          source: c.range
        });
        break;
      }

      case TOOLBAR_ENTRY_KIND.ToolBarSeparator: {
        if (!curToolBar) break;
        addToolBarEntry({ kind: TOOLBAR_ENTRY_KIND.ToolBarSeparator, source: c.range });
        break;
      }

      case TOOLBAR_ENTRY_KIND.ToolBarToolTip: {
        if (!curToolBar) break;
        const p = splitParams(c.args);
        addToolBarEntry({ kind: TOOLBAR_ENTRY_KIND.ToolBarToolTip, idRaw: p[0]?.trim(), textRaw: p[1]?.trim(), text: unquoteString(p[1] ?? ""), source: c.range });
        break;
      }

      case "CreateStatusBar": {
        const p = splitParams(c.args);
        const id = (p[0] ?? "").trim();
        if (id.length) {
          const statusBar: FormStatusBar = { id, fields: [], source: c.range };
          doc.statusbars.push(statusBar);
          setStatusBarContext(statusBar);
        } else {
          setStatusBarContext(undefined);
        }
        break;
      }

      case "AddStatusBarField": {
        if (!curStatusBar) break;
        const p = splitParams(c.args);
        const widthRaw = p[0]?.trim();
        if (widthRaw && widthRaw.length) {
          addStatusBarField({ widthRaw, source: c.range });
        }
        break;
      }

      // ---------------------------------------------------------------------------
      // Gadget list nesting & related statements
      // ---------------------------------------------------------------------------

      case "CloseGadgetList": {
        if (parentStack.length > 0) parentStack.pop();
        continue;
      }

      case "OpenGadgetList": {
        const p = splitParams(c.args);
        const target = (p[0] ?? "").trim();
        const g = gadgetById.get(target);
        if (g) {
          parentStack.push({
            id: g.id,
            kind: g.kind,
            currentPanelItem: g.kind === GADGET_KIND.PanelGadget ? panelCurrentItem.get(g.id) : undefined
          });
        }
        continue;
      }

      case "AddGadgetItem": {
        const p = splitParams(c.args);
        if (p.length >= 3) {
          const targetId = (p[0] ?? "").trim();
          const g = gadgetById.get(targetId);
          if (g) {
            const beforeLen = g.items?.length ?? 0;
            const posRaw = (p[1] ?? "").trim();
            const textRaw = (p[2] ?? "").trim();
            const item: GadgetItem = {
              posRaw,
              textRaw,
              text: unquoteString(textRaw),
              imageRaw: p[3]?.trim(),
              flagsRaw: p[4]?.trim(),
              source: c.range
            };

            item.index = resolveNonNegativeIndex(posRaw, beforeLen);

            if (!g.items) g.items = [];
            g.items.push(item);

            if (g.kind === GADGET_KIND.PanelGadget) {
              setPanelItem(g.id, item.index);
            }
          }
        }
        continue;
      }

      case "AddGadgetColumn": {
        const p = splitParams(c.args);
        if (p.length >= 4) {
          const targetId = (p[0] ?? "").trim();
          const g = gadgetById.get(targetId);
          if (g) {
            const beforeLen = g.columns?.length ?? 0;
            const colRaw = (p[1] ?? "").trim();
            const titleRaw = (p[2] ?? "").trim();
            const col: GadgetColumn = {
              colRaw,
              titleRaw,
              title: unquoteString(titleRaw),
              widthRaw: p[3]?.trim(),
              source: c.range
            };

            col.index = resolveNonNegativeIndex(colRaw, beforeLen);

            if (!g.columns) g.columns = [];
            g.columns.push(col);
          }
        }
        continue;
      }

      case "OpenWindow": {
        const procDefaults = findProcDefaultsAbove(lines, c.range.line);
        const win = parseOpenWindow(c.assignedVar, c.args, procDefaults);
        if (win) {
          if (!win.pbAny && win.firstParam.startsWith("#")) {
            win.enumValueRaw = winEnumValues[win.firstParam] ?? undefined;
          }
          doc.window = win;

          // Warn when #PB_Any has no stable assignment (strict Form Designer output uses: Var = OpenWindow(#PB_Any, ...))
          if (win.pbAny && !c.assignedVar) {
            issues.push({
              severity: "error",
              message: "Found OpenWindow(#PB_Any, ...) without a stable assignment (expected: Var = OpenWindow(#PB_Any, ...)). Patching may be ambiguous.",
              line: c.range.line
            });
          }
        }
        continue;
      }
    }

    const kind = asGadgetKind(c.name);
    if (!kind) continue;

    const gadget = parseGadgetCall(kind, c.assignedVar, c.args, c.range);
    if (gadget) {
      const parent = parentStack[parentStack.length - 1];
      if (parent) {
        gadget.parentId = parent.id;
        if (parent.kind === GADGET_KIND.PanelGadget && typeof parent.currentPanelItem === "number") {
          gadget.parentItem = parent.currentPanelItem;
        }
      }

      // Warn when #PB_Any has no stable assignment (strict Form Designer output uses: Var = Gadget(#PB_Any, ...))
      if (gadget.pbAny && !c.assignedVar) {
        issues.push({
          severity: "error",
          message: "Found Gadget(#PB_Any, ...) without a stable assignment (expected: Var = Gadget(#PB_Any, ...)). Patching may be ambiguous.",
          line: c.range.line
        });
      }

      doc.gadgets.push(gadget);
      gadgetById.set(gadget.id, gadget);
      pushImplicitParent(gadget);
    }
  }

  return doc;
}

function parseFormEnumerations(text: string, scanRange: ScanRange): FormEnumerations {
  const slice = text.slice(scanRange.start, scanRange.end);
  return {
    windows: parseEnumerationBlock(slice, ENUM_NAMES.windows),
    gadgets: parseEnumerationBlock(slice, ENUM_NAMES.gadgets)
  };
}

function getEnumerationBodyLines(slice: string, enumName: string): string[] {
  const out: string[] = [];
  const lines = slice.split(/\r?\n/);
  let inEnum = false;
  const startRe = new RegExp(`^\\s*Enumeration\\s+${enumName}\\b`, "i");

  for (const line of lines) {
    if (!inEnum) {
      if (startRe.test(line)) inEnum = true;
      continue;
    }
    if (/^\s*EndEnumeration\b/i.test(line)) break;
    out.push(line);
  }
  return out;
}

function parseEnumerationValueMap(text: string, scanRange: ScanRange, enumName: string): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  const slice = text.slice(scanRange.start, scanRange.end);
  const lines = getEnumerationBodyLines(slice, enumName);
  for (const line of lines) {
    const noComment = line.split(";")[0] ?? "";
    const m = /^\s*(#\w+)\b\s*(?:=\s*(.+?))?\s*$/.exec(noComment);
    if (!m) continue;
    const name = m[1];
    const valueRaw = m[2]?.trim();
    out[name] = valueRaw && valueRaw.length ? valueRaw : undefined;
  }

  return out;
}

function parseEnumerationBlock(slice: string, enumName: string): string[] {
  const out: string[] = [];
  const lines = getEnumerationBodyLines(slice, enumName);
  for (const line of lines) {
    const m = /^\s*(#\w+)\b/.exec(line);
    if (m) out.push(m[1]);
  }

  return out;
}

function parseFormHeader(text: string): { version?: string; line: number; hasStrictSyntaxWarning: boolean } | null {
  const headerRe = /^;\s*Form\s+Designer\s+for\s+PureBasic\s*-\s*([0-9]+(?:\.[0-9]+)*)\s*$/im;
  const m = headerRe.exec(text);
  if (!m || m.index === undefined) return null;

  const line = indexToLine(text, m.index);
  const version = m[1];

  // The next line in PureBasic output is typically the strict syntax warning.
  const lines = text.split(/\r?\n/);
  const nextLine = lines[line + 1] ?? "";
  const hasStrictSyntaxWarning = /strict\s+syntax/i.test(nextLine) && /Form\s+Designer/i.test(nextLine);

  return { version, line, hasStrictSyntaxWarning };
}

function detectFormScanRange(text: string, headerLine: number | undefined): ScanRange {
  let start = 0;
  if (typeof headerLine === "number" && headerLine >= 0) {
    start = lineToIndex(text, headerLine);
  }

  const ideOptionsRe = /^;\s*IDE\s+Options\b.*$/im;
  const m = ideOptionsRe.exec(text);
  const end = m?.index ?? text.length;

  return { start, end };
}

function indexToLine(text: string, idx: number): number {
  let line = 0;
  for (let i = 0; i < idx && i < text.length; i++) {
    if (text[i] === "\n") line++;
  }
  return line;
}

function lineToIndex(text: string, targetLine: number): number {
  let line = 0;
  let i = 0;
  if (targetLine <= 0) return 0;
  while (i < text.length) {
    if (text[i] === "\n") {
      line++;
      if (line === targetLine) return i + 1;
    }
    i++;
  }
  return text.length;
}

function parseProcDefaultsFromHeader(line: string): Record<string, string> | undefined {
  const m = /^\s*Procedure(?:\.\w+)?\s+[\w:]+\s*\((.*)\)\s*$/i.exec(line);
  if (!m) return undefined;

  const raw = m[1];
  const parts = splitParams(raw);
  const out: Record<string, string> = {};

  const normalizeParamName = (nameRaw: string) => {
    let name = nameRaw.trim();

    // Strip pointer marker and optional type suffix: x.i, *ptr, etc.
    name = name.replace(/^\*+/, "");
    const dot = name.indexOf(".");
    if (dot >= 0) name = name.slice(0, dot);

    return name.toLowerCase();
  };

  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;

    let name = part.slice(0, eq).trim();
    const def = part.slice(eq + 1).trim();
    if (!name.length || !def.length) continue;

    out[normalizeParamName(name)] = def;
  }

  return Object.keys(out).length ? out : undefined;
}

function findProcDefaultsAbove(lines: string[], fromLine: number): Record<string, string> | undefined {
  for (let i = Math.min(fromLine, lines.length - 1); i >= 0; i--) {
    const line = lines[i];
    if (/^\s*EndProcedure\b/i.test(line)) break;
    const defs = parseProcDefaultsFromHeader(line);
    if (defs) return defs;
  }
  return undefined;
}

function resolveProcDefault(raw: string | undefined, name: string, defs?: Record<string, string>): string | undefined {
  if (!raw) return raw;
  const t = raw.trim();
  if (!defs) return t;
  if (t.toLowerCase() === name.toLowerCase()) {
    return defs[name.toLowerCase()] ?? t;
  }
  return t;
}

function parseOpenWindow(assignedVar: string | undefined, args: string, procDefaults?: Record<string, string>): FormDocument["window"] {
  const p = splitParams(args);
  // OpenWindow(id, x, y, w, h, "title", flags)
  if (p.length < 6) return undefined;

  const firstParam = (p[0] ?? "").trim();
  const pbAny = firstParam === "#PB_Any";
  const id = pbAny ? (assignedVar ?? "#PB_Any") : firstParam;

  const xRaw = resolveProcDefault(p[1], "x", procDefaults) ?? "0";
  const yRaw = resolveProcDefault(p[2], "y", procDefaults) ?? "0";
  const wRaw = resolveProcDefault(p[3], "width", procDefaults) ?? "0";
  const hRaw = resolveProcDefault(p[4], "height", procDefaults) ?? "0";

  const x = asNumber(xRaw) ?? 0;
  const y = asNumber(yRaw) ?? 0;
  const w = asNumber(wRaw) ?? 0;
  const h = asNumber(hRaw) ?? 0;

  const title = unquoteString(p[5] ?? "");
  const flagsExpr = p[6]?.trim();

  return {
    id,
    pbAny,
    variable: pbAny ? (assignedVar ?? undefined) : firstParam.replace(/^#/, ""),
    enumValueRaw: undefined,
    firstParam,
    x,
    y,
    w,
    h,
    title,
    flagsExpr
  };
}

function parseGadgetCall(kind: GadgetKind, assignedVar: string | undefined, args: string, range: any): Gadget | undefined {
  const p = splitParams(args);
  if (p.length < 5) return undefined;

  const firstParam = (p[0] ?? "").trim();
  const pbAny = firstParam === "#PB_Any";
  const id = pbAny ? (assignedVar ?? "#PB_Any") : firstParam;

  const x = asNumber(p[1] ?? "") ?? 0;
  const y = asNumber(p[2] ?? "") ?? 0;
  const w = asNumber(p[3] ?? "") ?? 0;
  const h = asNumber(p[4] ?? "") ?? 0;

  const text = unquoteString(p[5] ?? "");
  const flagsExpr = p[6]?.trim();

  return { 
    id, 
    kind, 
    pbAny, 
    variable: pbAny ? (assignedVar ?? undefined) : firstParam.replace(/^#/, ""), 
    firstParam, 
    x, 
    y, 
    w, 
    h, 
    text, 
    flagsExpr, 
    source: range 
  };
}
