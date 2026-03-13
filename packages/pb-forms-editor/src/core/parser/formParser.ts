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

const KNOWN_WINDOW_FLAGS = new Set([
  "#PB_Window_SystemMenu",
  "#PB_Window_MinimizeGadget",
  "#PB_Window_MaximizeGadget",
  "#PB_Window_SizeGadget",
  "#PB_Window_Invisible",
  "#PB_Window_TitleBar",
  "#PB_Window_Tool",
  "#PB_Window_BorderLess",
  "#PB_Window_ScreenCentered",
  "#PB_Window_WindowCentered",
  "#PB_Window_Maximize",
  "#PB_Window_Minimize",
  "#PB_Window_NoGadgets",
  "#PB_Window_NoActivate",
]);

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
  const fontById = new Map<string, { name: string; size: number; flagsRaw?: string }>();

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


      case "HideGadget": {
        const p = splitParams(c.args);
        const g = findGadgetByReference(gadgetById, p[0]);
        if (p.length >= 2 && g) {
          const hiddenRaw = (p[1] ?? "").trim();
          g.hiddenRaw = hiddenRaw || undefined;

          const hidden = asNumber(hiddenRaw);
          if (typeof hidden === "number") {
            g.hidden = hidden !== 0;
          }
        }
        continue;
      }

      case "DisableGadget": {
        const p = splitParams(c.args);
        const g = findGadgetByReference(gadgetById, p[0]);
        if (p.length >= 2 && g) {
          const disabledRaw = (p[1] ?? "").trim();
          g.disabledRaw = disabledRaw || undefined;

          const disabled = asNumber(disabledRaw);
          if (typeof disabled === "number") {
            g.disabled = disabled !== 0;
          }
        }
        continue;
      }

      case "GadgetToolTip": {
        const p = splitParams(c.args);
        const g = findGadgetByReference(gadgetById, p[0]);
        if (p.length >= 2 && g) {
          const tooltipRaw = (p[1] ?? "").trim();
          const literalTooltip = unquoteString(tooltipRaw);
          g.tooltipRaw = tooltipRaw || undefined;
          g.tooltip = literalTooltip ?? (tooltipRaw.length ? tooltipRaw : undefined);
          g.tooltipVariable = literalTooltip === undefined && tooltipRaw.length > 0;
        }
        continue;
      }

      case "SetGadgetColor": {
        const p = splitParams(c.args);
        const g = findGadgetByReference(gadgetById, p[0]);
        if (p.length >= 3 && g) {
          const colorType = (p[1] ?? "").trim();
          const colorRaw = (p[2] ?? "").trim();
          const color = parsePbColor(colorRaw);

          if (colorType === "#PB_Gadget_BackColor") {
            g.backColorRaw = colorRaw || undefined;
            if (typeof color === "number") g.backColor = color;
          } else if (colorType === "#PB_Gadget_FrontColor") {
            g.frontColorRaw = colorRaw || undefined;
            if (typeof color === "number") g.frontColor = color;
          }
        }
        continue;
      }

      case "LoadFont": {
        const p = splitParams(c.args);
        if (p.length >= 3) {
          const id = (p[0] ?? "").trim();
          const nameRaw = (p[1] ?? "").trim();
          const sizeRaw = (p[2] ?? "").trim();
          const name = unquoteString(nameRaw);
          const size = asNumber(sizeRaw);

          if (id.length && typeof name === "string" && typeof size === "number") {
            fontById.set(id, {
              name,
              size,
              flagsRaw: p[3]?.trim() || undefined
            });
          }
        }
        continue;
      }

      case "SetGadgetFont": {
        const p = splitParams(c.args);
        const g = findGadgetByReference(gadgetById, p[0]);
        if (p.length >= 2 && g) {
          const fontExpr = (p[1] ?? "").trim();
          const m = /^FontID\((.+)\)$/i.exec(fontExpr);
          const fontId = m?.[1]?.trim();
          const font = fontId ? fontById.get(fontId) : undefined;
          if (font) {
            g.gadgetFont = font.name;
            g.gadgetFontSize = font.size;
            g.gadgetFontFlagsRaw = font.flagsRaw;
          }
        }
        continue;
      }

      case "SetGadgetState": {
        const p = splitParams(c.args);
        const g = findGadgetByReference(gadgetById, p[0]);
        if (p.length >= 2 && g) {
          const stateRaw = (p[1] ?? "").trim();
          g.stateRaw = stateRaw || undefined;

          if (/^#PB_CheckBox_Checked$/i.test(stateRaw)) {
            g.state = 1;
          } else {
            const state = asNumber(stateRaw);
            if (typeof state === "number") {
              g.state = state;
            }
          }
        }
        continue;
      }

      case "HideWindow": {
        const p = splitParams(c.args);
        if (p.length >= 2 && windowMatchesReference(doc.window, p[0])) {
          const hiddenRaw = (p[1] ?? "").trim();
          doc.window.hiddenRaw = hiddenRaw || undefined;

          const hidden = asNumber(hiddenRaw);
          if (typeof hidden === "number") {
            doc.window.hidden = hidden !== 0;
          }
        }
        continue;
      }

      case "DisableWindow": {
        const p = splitParams(c.args);
        if (p.length >= 2 && windowMatchesReference(doc.window, p[0])) {
          const disabledRaw = (p[1] ?? "").trim();
          doc.window.disabledRaw = disabledRaw || undefined;

          const disabled = asNumber(disabledRaw);
          if (typeof disabled === "number") {
            doc.window.disabled = disabled !== 0;
          }
        }
        continue;
      }

      case "SetWindowColor": {
        const p = splitParams(c.args);
        if (p.length >= 2 && windowMatchesReference(doc.window, p[0])) {
          const colorRaw = (p[1] ?? "").trim();
          doc.window.colorRaw = colorRaw || undefined;

          const color = parsePbColor(colorRaw);
          if (typeof color === "number") {
            doc.window.color = color;
          }
        }
        continue;
      }

      case "OpenWindow": {
        const procDefaults = findProcDefaultsAbove(lines, c.range.line);
        const eventFile = findEventFileAbove(lines, c.range.line);
        const win = parseOpenWindow(c.assignedVar, c.args, procDefaults, c.range, eventFile);
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

      if (gadget.kind === GADGET_KIND.SplitterGadget) {
        const gadget1 = findGadgetByReference(gadgetById, gadget.gadget1Raw ?? gadget.gadget1Id);
        if (gadget1) {
          gadget.gadget1Id = gadget1.id;
          gadget1.splitterId = gadget.id;
        }

        const gadget2 = findGadgetByReference(gadgetById, gadget.gadget2Raw ?? gadget.gadget2Id);
        if (gadget2) {
          gadget.gadget2Id = gadget2.id;
          gadget2.splitterId = gadget.id;
        }
      }

      doc.gadgets.push(gadget);
      gadgetById.set(gadget.id, gadget);
      pushImplicitParent(gadget);
    }
  }

  if (doc.window) {
    applyWindowEventMetadata(lines, doc.window);
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

function findEventFileAbove(lines: string[], fromLine: number): string | undefined {
  for (let i = Math.min(fromLine, lines.length - 1); i >= 0; i--) {
    const line = lines[i] ?? "";
    const includeMatch = /^\s*XIncludeFile\s+(~?"(?:""|[^"])*")/i.exec(line);
    if (!includeMatch) continue;

    return unquoteString(includeMatch[1]);
  }

  return undefined;
}

function applyWindowEventMetadata(lines: string[], win: FormWindow): void {
  let inEventGadgetSelect = false;
  let eventSelectDepth = 0;
  let pendingWindowDefaultProc = false;

  for (const rawLine of lines) {
    const line = rawLine.split(";")[0]?.trim() ?? "";
    if (!line.length) continue;

    if (/^Select\s+EventMenu\s*\(\s*\)\s*$/i.test(line)) {
      win.generateEventLoop = true;
      continue;
    }

    if (/^Select\s+EventGadget\s*\(\s*\)\s*$/i.test(line)) {
      win.generateEventLoop = true;
      inEventGadgetSelect = true;
      eventSelectDepth = 1;
      pendingWindowDefaultProc = false;
      continue;
    }

    if (!inEventGadgetSelect) continue;

    if (/^Select\b/i.test(line)) {
      eventSelectDepth++;
      continue;
    }

    if (/^EndSelect\b/i.test(line)) {
      eventSelectDepth--;
      if (eventSelectDepth <= 0) {
        inEventGadgetSelect = false;
        pendingWindowDefaultProc = false;
      }
      continue;
    }

    if (/^Default\b/i.test(line)) {
      pendingWindowDefaultProc = true;
      continue;
    }

    if (!pendingWindowDefaultProc) continue;

    if (/^Case\b/i.test(line)) {
      pendingWindowDefaultProc = false;
      continue;
    }

    const procMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(line);
    if (procMatch) {
      win.eventProc = procMatch[1];
      pendingWindowDefaultProc = false;
    }
  }
}

function normalizeGadgetReference(raw: string | undefined): string | undefined {
  const refRaw = raw?.trim();
  if (!refRaw) return undefined;
  return refRaw.startsWith("#") ? refRaw.slice(1) : refRaw;
}

function findGadgetByReference(gadgetById: Map<string, Gadget>, rawRef: string | undefined): Gadget | undefined {
  const ref = normalizeGadgetReference(rawRef);
  if (!ref) return undefined;

  return gadgetById.get(ref) ?? gadgetById.get("#" + ref);
}

function normalizeWindowParent(raw: string | undefined): string | undefined {
  const parentRaw = raw?.trim();
  if (!parentRaw) return undefined;

  const windowIdMatch = /^WindowID\((.+)\)$/i.exec(parentRaw);
  if (windowIdMatch) {
    return windowIdMatch[1]?.trim() || undefined;
  }

  return "=" + parentRaw;
}

function normalizeWindowReference(raw: string | undefined): string | undefined {
  const refRaw = raw?.trim();
  if (!refRaw) return undefined;
  return refRaw.startsWith("#") ? refRaw.slice(1) : refRaw;
}

function windowMatchesReference(win: FormWindow | undefined, rawRef: string | undefined): win is FormWindow {
  if (!win) return false;
  const ref = normalizeWindowReference(rawRef);
  if (!ref) return false;

  if (win.variable && win.variable === ref) return true;
  if (win.id.replace(/^#/, "") === ref) return true;
  return false;
}

function parsePbColor(raw: string | undefined): number | undefined {
  const colorRaw = raw?.trim();
  if (!colorRaw) return undefined;

  if (/^\$[0-9a-f]+$/i.test(colorRaw)) {
    const n = Number.parseInt(colorRaw.slice(1), 16);
    return Number.isFinite(n) ? n : undefined;
  }

  const rgbMatch = /^RGB\((.+)\)$/i.exec(colorRaw);
  if (!rgbMatch) return undefined;

  const parts = splitParams(rgbMatch[1] ?? "");
  if (parts.length !== 3) return undefined;

  const r = asNumber(parts[0] ?? "");
  const g = asNumber(parts[1] ?? "");
  const b = asNumber(parts[2] ?? "");
  if ([r, g, b].some((v) => typeof v !== "number")) return undefined;

  return ((b as number) << 16) | ((g as number) << 8) | (r as number);
}

function splitFlagExpr(flagsExpr: string | undefined): string[] {
  const raw = flagsExpr?.trim();
  if (!raw || raw === "0") return [];

  return raw
    .split("|")
    .map((flag) => flag.trim())
    .filter((flag) => flag.length > 0 && flag !== "0");
}

function extractWindowKnownFlags(flagsExpr: string | undefined): string[] | undefined {
  const out: string[] = [];

  for (const flag of splitFlagExpr(flagsExpr)) {
    if (!KNOWN_WINDOW_FLAGS.has(flag)) continue;
    if (!out.includes(flag)) out.push(flag);
  }

  return out.length ? out : undefined;
}

function extractWindowCustomFlags(flagsExpr: string | undefined): string[] | undefined {
  const out: string[] = [];

  for (const flag of splitFlagExpr(flagsExpr)) {
    if (KNOWN_WINDOW_FLAGS.has(flag)) continue;
    if (!out.includes(flag)) out.push(flag);
  }

  return out.length ? out : undefined;
}

function parseImageReference(raw: string | undefined): { imageRaw?: string; imageId?: string } {
  const imageRaw = raw?.trim();
  if (!imageRaw) return {};

  const imageIdMatch = /^ImageID\((.+)\)$/i.exec(imageRaw);
  const imageId = imageIdMatch?.[1]?.trim() || imageRaw;

  return {
    imageRaw,
    imageId: imageId.length ? imageId : undefined
  };
}

function parseNumericRaw(raw: string | undefined): { raw?: string; value?: number } {
  const valueRaw = raw?.trim();
  if (!valueRaw) return {};

  const value = asNumber(valueRaw);
  return {
    raw: valueRaw,
    value: typeof value === "number" ? value : undefined
  };
}

function parseGadgetConstructorDetails(kind: GadgetKind, params: string[]): {
  textRaw?: string;
  imageRaw?: string;
  imageId?: string;
  minRaw?: string;
  min?: number;
  maxRaw?: string;
  max?: number;
  gadget1Raw?: string;
  gadget1Id?: string;
  gadget2Raw?: string;
  gadget2Id?: string;
  flagsExpr?: string;
} {
  let textRaw: string | undefined;
  let flagsExpr: string | undefined;
  let imageRaw: string | undefined;
  let imageId: string | undefined;
  let minRaw: string | undefined;
  let min: number | undefined;
  let maxRaw: string | undefined;
  let max: number | undefined;
  let gadget1Raw: string | undefined;
  let gadget1Id: string | undefined;
  let gadget2Raw: string | undefined;
  let gadget2Id: string | undefined;

  const assignRange = (minIndex: number, maxIndex: number) => {
    const parsedMin = parseNumericRaw(params[minIndex]);
    const parsedMax = parseNumericRaw(params[maxIndex]);
    minRaw = parsedMin.raw;
    min = parsedMin.value;
    maxRaw = parsedMax.raw;
    max = parsedMax.value;
  };

  switch (kind) {
    case GADGET_KIND.ButtonGadget:
    case GADGET_KIND.CheckBoxGadget:
    case GADGET_KIND.ExplorerComboGadget:
    case GADGET_KIND.ExplorerListGadget:
    case GADGET_KIND.ExplorerTreeGadget:
    case GADGET_KIND.FrameGadget:
    case GADGET_KIND.StringGadget:
    case GADGET_KIND.TextGadget:
    case GADGET_KIND.WebGadget:
      textRaw = params[5]?.trim() || undefined;
      flagsExpr = params[6]?.trim() || undefined;
      break;

    case GADGET_KIND.ButtonImageGadget:
    case GADGET_KIND.ImageGadget: {
      const parsedImage = parseImageReference(params[5]);
      imageRaw = parsedImage.imageRaw;
      imageId = parsedImage.imageId;
      flagsExpr = params[6]?.trim() || undefined;
      break;
    }

    case GADGET_KIND.CalendarGadget:
      flagsExpr = params[6]?.trim() || undefined;
      break;

    case GADGET_KIND.CanvasGadget:
    case GADGET_KIND.ComboBoxGadget:
    case GADGET_KIND.ContainerGadget:
    case GADGET_KIND.EditorGadget:
    case GADGET_KIND.ListViewGadget:
    case GADGET_KIND.OpenGLGadget:
    case GADGET_KIND.TreeGadget:
    case GADGET_KIND.WebViewGadget:
      flagsExpr = params[5]?.trim() || undefined;
      break;

    case GADGET_KIND.DateGadget:
      textRaw = params[5]?.trim() || undefined;
      flagsExpr = params[7]?.trim() || undefined;
      break;

    case GADGET_KIND.HyperLinkGadget:
      textRaw = params[5]?.trim() || undefined;
      flagsExpr = params[7]?.trim() || undefined;
      break;

    case GADGET_KIND.ListIconGadget:
      textRaw = params[5]?.trim() || undefined;
      flagsExpr = params[7]?.trim() || undefined;
      break;

    case GADGET_KIND.ProgressBarGadget:
    case GADGET_KIND.SpinGadget:
    case GADGET_KIND.TrackBarGadget:
      assignRange(5, 6);
      flagsExpr = params[7]?.trim() || undefined;
      break;

    case GADGET_KIND.ScrollBarGadget:
    case GADGET_KIND.ScrollAreaGadget:
      assignRange(5, 6);
      flagsExpr = params[8]?.trim() || undefined;
      break;

    case GADGET_KIND.ScintillaGadget:
      textRaw = params[5]?.trim() || undefined;
      break;

    case GADGET_KIND.SplitterGadget:
      gadget1Raw = params[5]?.trim() || undefined;
      gadget1Id = normalizeGadgetReference(gadget1Raw);
      gadget2Raw = params[6]?.trim() || undefined;
      gadget2Id = normalizeGadgetReference(gadget2Raw);
      flagsExpr = params[7]?.trim() || undefined;
      break;

    case GADGET_KIND.OptionGadget:
      textRaw = params[5]?.trim() || undefined;
      break;

    case GADGET_KIND.IPAddressGadget:
    case GADGET_KIND.PanelGadget:
    case GADGET_KIND.Unknown:
      break;

    default:
      textRaw = params[5]?.trim() || undefined;
      flagsExpr = params[6]?.trim() || undefined;
      break;
  }

  return {
    textRaw,
    imageRaw,
    imageId,
    minRaw,
    min,
    maxRaw,
    max,
    gadget1Raw,
    gadget1Id,
    gadget2Raw,
    gadget2Id,
    flagsExpr
  };
}

function parseOpenWindow(assignedVar: string | undefined, args: string, procDefaults?: Record<string, string>, source?: FormWindow["source"], eventFile?: string): FormDocument["window"] {
  const p = splitParams(args);
  // OpenWindow(id, x, y, w, h, caption, flags, parent)
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

  const captionRaw = (p[5] ?? "").trim();
  const literalCaption = unquoteString(captionRaw);
  const caption = literalCaption ?? (captionRaw.length ? captionRaw : undefined);
  const captionVariable = literalCaption === undefined && captionRaw.length > 0;
  const flagsExpr = p[6]?.trim();
  const knownFlags = extractWindowKnownFlags(flagsExpr);
  const parentRaw = p[7]?.trim();
  const parent = normalizeWindowParent(parentRaw);
  const customFlags = extractWindowCustomFlags(flagsExpr);

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
    captionRaw: captionRaw || undefined,
    caption,
    captionVariable,
    title: caption,
    flagsExpr,
    knownFlags,
    parentRaw,
    parent,
    eventFile,
    customFlags,
    source
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

  const ctor = parseGadgetConstructorDetails(kind, p);
  const literalText = unquoteString(ctor.textRaw ?? "");
  const text = literalText ?? (ctor.textRaw?.length ? ctor.textRaw : undefined);
  const textVariable = literalText === undefined && !!ctor.textRaw?.length;

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
    textRaw: ctor.textRaw,
    text,
    textVariable,
    imageRaw: ctor.imageRaw,
    imageId: ctor.imageId,
    minRaw: ctor.minRaw,
    min: ctor.min,
    maxRaw: ctor.maxRaw,
    max: ctor.max,
    gadget1Raw: ctor.gadget1Raw,
    gadget1Id: ctor.gadget1Id,
    gadget2Raw: ctor.gadget2Raw,
    gadget2Id: ctor.gadget2Id,
    flagsExpr: ctor.flagsExpr,
    source: range
  };
}

