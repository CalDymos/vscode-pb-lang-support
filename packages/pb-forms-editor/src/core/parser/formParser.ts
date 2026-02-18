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
  Gadget,
  GadgetColumn,
  GadgetItem,
  GadgetKind,
  ScanRange
} from "../model";
import { splitParams, unquoteString, asNumber } from "./tokenizer";
import { scanCalls } from "./callScanner";

const GADGET_KINDS: Record<string, GadgetKind> = {
  ButtonGadget: "ButtonGadget",
  ButtonImageGadget: "ButtonImageGadget",
  StringGadget: "StringGadget",
  TextGadget: "TextGadget",
  CheckBoxGadget: "CheckBoxGadget",
  OptionGadget: "OptionGadget",
  FrameGadget: "FrameGadget",
  ComboBoxGadget: "ComboBoxGadget",
  ListViewGadget: "ListViewGadget",
  ListIconGadget: "ListIconGadget",
  TreeGadget: "TreeGadget",
  EditorGadget: "EditorGadget",
  SpinGadget: "SpinGadget",
  TrackBarGadget: "TrackBarGadget",
  ProgressBarGadget: "ProgressBarGadget",
  ImageGadget: "ImageGadget",
  HyperLinkGadget: "HyperLinkGadget",
  CalendarGadget: "CalendarGadget",
  DateGadget: "DateGadget",
  ContainerGadget: "ContainerGadget",
  PanelGadget: "PanelGadget",
  ScrollAreaGadget: "ScrollAreaGadget",
  SplitterGadget: "SplitterGadget",
  WebViewGadget: "WebViewGadget",
  WebGadget: "WebGadget",
  OpenGLGadget: "OpenGLGadget",
  CanvasGadget: "CanvasGadget",
  ExplorerTreeGadget: "ExplorerTreeGadget",
  ExplorerListGadget: "ExplorerListGadget",
  ExplorerComboGadget: "ExplorerComboGadget",
  IPAddressGadget: "IPAddressGadget",
  ScrollBarGadget: "ScrollBarGadget",
  ScintillaGadget: "ScintillaGadget"
};

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
    if (g.kind === "ContainerGadget" || g.kind === "PanelGadget" || g.kind === "ScrollAreaGadget") {
      parentStack.push({
        id: g.id,
        kind: g.kind,
        currentPanelItem: g.kind === "PanelGadget" ? panelCurrentItem.get(g.id) : undefined
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
      if (ctx.kind === "PanelGadget" && ctx.id === panelId) {
        ctx.currentPanelItem = itemIndex;
        break;
      }
    }
  };

  const calls = scanCalls(text, scanRange);
  for (const c of calls) {
    // -----------------------------------------------------------------------------
    // Menu / ToolBar / StatusBar parsing (independent from gadget list nesting)
    // -----------------------------------------------------------------------------

    if (c.name === "CreateMenu") {
      const p = splitParams(c.args);
      const id = (p[0] ?? "").trim();
      if (id.length) {
        curMenu = { id, entries: [], source: c.range };
        doc.menus.push(curMenu);
        menuLevel = 0;
      } else {
        curMenu = undefined;
        menuLevel = 0;
      }
      curToolBar = undefined;
      curStatusBar = undefined;
    }

    if (c.name === "MenuTitle" && curMenu) {
      const p = splitParams(c.args);
      const textRaw = p[0]?.trim();
      const e: FormMenuEntry = { kind: "MenuTitle", level: menuLevel, textRaw, text: unquoteString(textRaw ?? ""), source: c.range };
      curMenu.entries.push(e);
    }

    if (c.name === "MenuItem" && curMenu) {
      const p = splitParams(c.args);
      const idRaw = p[0]?.trim();
      const textRaw = p[1]?.trim();
      const e: FormMenuEntry = { kind: "MenuItem", level: menuLevel, idRaw, textRaw, text: unquoteString(textRaw ?? ""), source: c.range };
      curMenu.entries.push(e);
    }

    if (c.name === "MenuBar" && curMenu) {
      curMenu.entries.push({ kind: "MenuBar", level: menuLevel, source: c.range });
    }

    if (c.name === "OpenSubMenu" && curMenu) {
      const p = splitParams(c.args);
      const textRaw = p[0]?.trim();
      curMenu.entries.push({ kind: "OpenSubMenu", level: menuLevel, textRaw, text: unquoteString(textRaw ?? ""), source: c.range });
      menuLevel++;
    }

    if (c.name === "CloseSubMenu" && curMenu) {
      menuLevel = Math.max(0, menuLevel - 1);
      curMenu.entries.push({ kind: "CloseSubMenu", level: menuLevel, source: c.range });
    }

    if (c.name === "CreateToolBar") {
      const p = splitParams(c.args);
      const id = (p[0] ?? "").trim();
      if (id.length) {
        curToolBar = { id, entries: [], source: c.range };
        doc.toolbars.push(curToolBar);
      } else {
        curToolBar = undefined;
      }
      curMenu = undefined;
      menuLevel = 0;
      curStatusBar = undefined;
    }

    if (c.name === "ToolBarStandardButton" && curToolBar) {
      const p = splitParams(c.args);
      const e: FormToolBarEntry = { kind: "ToolBarStandardButton", idRaw: p[0]?.trim(), iconRaw: p[1]?.trim(), source: c.range };
      curToolBar.entries.push(e);
    }

    if (c.name === "ToolBarButton" && curToolBar) {
      const p = splitParams(c.args);
      const e: FormToolBarEntry = { kind: "ToolBarButton", idRaw: p[0]?.trim(), iconRaw: p[1]?.trim(), textRaw: p[2]?.trim(), text: unquoteString(p[2] ?? ""), source: c.range };
      curToolBar.entries.push(e);
    }

    if (c.name === "ToolBarSeparator" && curToolBar) {
      curToolBar.entries.push({ kind: "ToolBarSeparator", source: c.range });
    }

    if (c.name === "ToolBarToolTip" && curToolBar) {
      const p = splitParams(c.args);
      const e: FormToolBarEntry = { kind: "ToolBarToolTip", idRaw: p[0]?.trim(), textRaw: p[1]?.trim(), text: unquoteString(p[1] ?? ""), source: c.range };
      curToolBar.entries.push(e);
    }

    if (c.name === "CreateStatusBar") {
      const p = splitParams(c.args);
      const id = (p[0] ?? "").trim();
      if (id.length) {
        curStatusBar = { id, fields: [], source: c.range };
        doc.statusbars.push(curStatusBar);
      } else {
        curStatusBar = undefined;
      }
      curMenu = undefined;
      menuLevel = 0;
      curToolBar = undefined;
    }

    if (c.name === "AddStatusBarField" && curStatusBar) {
      const p = splitParams(c.args);
      const widthRaw = p[0]?.trim();
      if (widthRaw && widthRaw.length) {
        const field: FormStatusBarField = { widthRaw, source: c.range };
        curStatusBar.fields.push(field);
      }
    }

    if (c.name === "CloseGadgetList") {
      if (parentStack.length > 0) parentStack.pop();
      continue;
    }

    if (c.name === "OpenGadgetList") {
      const p = splitParams(c.args);
      const target = (p[0] ?? "").trim();
      const g = gadgetById.get(target);
      if (g) {
        parentStack.push({
          id: g.id,
          kind: g.kind,
          currentPanelItem: g.kind === "PanelGadget" ? panelCurrentItem.get(g.id) : undefined
        });
      }
      continue;
    }

    if (c.name === "AddGadgetItem") {
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

          const posNum = asNumber(posRaw);
          if (typeof posNum === "number" && posNum >= 0) item.index = posNum;
          else item.index = beforeLen; // append / unknown

          if (!g.items) g.items = [];
          g.items.push(item);

          if (g.kind === "PanelGadget") {
            setPanelItem(g.id, item.index);
          }
        }
      }
      continue;
    }

    if (c.name === "AddGadgetColumn") {
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

          const colNum = asNumber(colRaw);
          if (typeof colNum === "number" && colNum >= 0) col.index = colNum;
          else col.index = beforeLen;

          if (!g.columns) g.columns = [];
          g.columns.push(col);
        }
      }
      continue;
    }

    if (c.name === "OpenWindow") {
      const win = parseOpenWindow(c.assignedVar, c.args);
      if (win) {
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

    const kind = GADGET_KINDS[c.name];
    if (!kind) continue;

    const gadget = parseGadgetCall(kind, c.assignedVar, c.args, c.range);
    if (gadget) {
      const parent = parentStack[parentStack.length - 1];
      if (parent) {
        gadget.parentId = parent.id;
        if (parent.kind === "PanelGadget" && typeof parent.currentPanelItem === "number") {
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
    windows: parseEnumerationBlock(slice, "FormWindow"),
    gadgets: parseEnumerationBlock(slice, "FormGadget")
  };
}

function parseEnumerationBlock(slice: string, enumName: string): string[] {
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

function parseOpenWindow(assignedVar: string | undefined, args: string) {
  const p = splitParams(args);
  // OpenWindow(id, x, y, w, h, "title", flags)
  if (p.length < 6) return undefined;

  const firstParam = (p[0] ?? "").trim();
  const pbAny = firstParam === "#PB_Any";
  const id = pbAny ? (assignedVar ?? "#PB_Any") : firstParam;

  const x = asNumber(p[1] ?? "0") ?? 0;
  const y = asNumber(p[2] ?? "0") ?? 0;
  const w = asNumber(p[3] ?? "0") ?? 0;
  const h = asNumber(p[4] ?? "0") ?? 0;

  const title = unquoteString(p[5] ?? "");
  const flagsExpr = p[6]?.trim();

  return { id, pbAny, assignedVar, firstParam, x, y, w, h, title, flagsExpr };
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

  return { id, kind, pbAny, assignedVar, firstParam, x, y, w, h, text, flagsExpr, source: range };
}
