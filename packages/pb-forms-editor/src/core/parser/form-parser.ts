import {
  FormDocument,
  FormFont,
  FormImage,
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
  SourceRange,
  TOOLBAR_ENTRY_KIND,
  MENU_ENTRY_KIND,
  GADGET_KIND_SET,
  GADGET_KIND,
  ENUM_NAMES,
  PBFD_WINDOW_KNOWN_FLAGS,
  PB_ANY
} from "../model";

import { canHostInsertedGadgets } from "../gadget/insert";
import { inferGadgetCtorLocks, usesHeightLayoutReference, usesWidthLayoutReference } from "../gadget/layout";
import { parseDesignerLayoutRaw } from "./layout-raw";
import { parsePbColorLiteral } from "./pb-color";
import { parsePbStringLiteral } from "./pb-string";
import { parsePbImageReference } from "./pb-image-reference";
import { parsePbFontReference } from "./pb-font-reference";
import { parsePbWindowReference } from "./pb-window-reference";
import { asNumber, normalizeProcParamName, splitParams, unquoteString } from "./tokenizer";
import { PbCall, scanCalls } from "./call-scanner";

const KNOWN_WINDOW_FLAGS = new Set<string>(PBFD_WINDOW_KNOWN_FLAGS);

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
  const gadgetEnumValues = parseEnumerationValueMap(text, scanRange, ENUM_NAMES.gadgets);

  const meta: FormMeta = {
    header: header ?? undefined,
    scanRange,
    issues,
    enums
  };

  const doc: FormDocument = { window: undefined, fonts: [], images: [], gadgets: [], menus: [], toolbars: [], statusbars: [], meta };

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
    if (canHostInsertedGadgets(g)) {
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
  const lineStarts = buildLineStartOffsets(text);
  const customGadgetInitByIndex = parseCustomGadgetInitMap(lines, lineStarts);

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

  const addFont = (font: FormFont) => {
    doc.fonts.push(font);
  };

  const addImage = (image: FormImage) => {
    doc.images.push(image);
  };

  const findStatusBarByReference = (rawId: string | undefined): FormStatusBar | undefined => {
    const ref = rawId?.trim();
    if (ref && ref.length) {
      const statusBar = doc.statusbars.find((entry) => entry.id === ref);
      if (statusBar) return statusBar;
    }
    return curStatusBar;
  };

  const updateStatusBarField = (statusBar: FormStatusBar | undefined, indexRaw: string | undefined, apply: (field: FormStatusBarField) => void) => {
    if (!statusBar) return;
    const index = asNumber(indexRaw ?? "");
    if (typeof index !== "number" || index < 0 || index >= statusBar.fields.length) return;
    const field = statusBar.fields[index];
    if (!field) return;
    apply(field);
  };

  const applyToolBarTooltip = (toolBar: FormToolBar | undefined, buttonIdRaw: string | undefined, tooltip: string | undefined) => {
    if (!toolBar || !buttonIdRaw || !tooltip) return;
    for (let i = toolBar.entries.length - 1; i >= 0; i--) {
      const entry = toolBar.entries[i];
      if (entry.kind === TOOLBAR_ENTRY_KIND.ToolBarToolTip) continue;
      if (!entry.idRaw || entry.idRaw !== buttonIdRaw) continue;
      entry.tooltip = tooltip;
      break;
    }
  };

  const calls: PbCall[] = scanCalls(text, scanRange);
  for (const c of calls) {
    // -----------------------------------------------------------------------------
    // Menu / ToolBar / StatusBar parsing (independent from gadget list nesting)
    // -----------------------------------------------------------------------------
    switch (c.name) {
      case "LoadImage": {
        const image = parseFormImage(false, c.assignedVar, c.args, c.range);
        if (image) addImage(image);
        break;
      }

      case "CatchImage": {
        const image = parseFormImage(true, c.assignedVar, c.args, c.range);
        if (image) addImage(image);
        break;
      }

      case "CreateMenu":
      case "CreateImageMenu": {
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
        addMenuEntry({ kind: MENU_ENTRY_KIND.MenuTitle, level: 0, textRaw, text: unquoteString(textRaw ?? ""), source: c.range });
        menuLevel = 1;
        break;
      }

      case MENU_ENTRY_KIND.MenuItem: {
        if (!curMenu) break;
        const p = splitParams(c.args);
        const idRaw = p[0]?.trim();
        const textRaw = p[1]?.trim();
        const parsedText = parseMenuItemText(textRaw);
        const parsedIcon = parsePbImageReference(p[2]);
        addMenuEntry({
          kind: MENU_ENTRY_KIND.MenuItem,
          level: menuLevel,
          idRaw,
          textRaw,
          text: parsedText.text,
          shortcut: parsedText.shortcut,
          iconRaw: parsedIcon.imageRaw,
          iconId: parsedIcon.imageId,
          source: c.range
        });
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

      case "CreateToolBar":
      case "CreateToolbar": {
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

      case TOOLBAR_ENTRY_KIND.ToolBarImageButton: {
        if (!curToolBar) break;
        const p = splitParams(c.args);
        const parsedIcon = parsePbImageReference(p[1]);
        addToolBarEntry({
          kind: TOOLBAR_ENTRY_KIND.ToolBarImageButton,
          idRaw: p[0]?.trim(),
          iconRaw: parsedIcon.imageRaw,
          iconId: parsedIcon.imageId,
          toggle: (p[2]?.trim() ?? "") === "#PB_ToolBar_Toggle",
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
        const buttonIdRaw = (p.length >= 3 ? p[1] : p[0])?.trim();
        const textRaw = (p.length >= 3 ? p[2] : p[1])?.trim();
        const text = unquoteString(textRaw ?? "");
        addToolBarEntry({ kind: TOOLBAR_ENTRY_KIND.ToolBarToolTip, idRaw: buttonIdRaw, textRaw, text, source: c.range });
        applyToolBarTooltip(curToolBar, buttonIdRaw, text ?? undefined);
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

      case "StatusBarText": {
        const p = splitParams(c.args);
        const statusBar = findStatusBarByReference(p[0]);
        updateStatusBarField(statusBar, p[1], (field) => {
          field.textRaw = p[2]?.trim() || undefined;
          field.text = unquoteString(p[2] ?? "") ?? field.textRaw;
          field.flagsRaw = p[3]?.trim() || undefined;
        });
        break;
      }

      case "StatusBarProgress": {
        const p = splitParams(c.args);
        const statusBar = findStatusBarByReference(p[0]);
        updateStatusBarField(statusBar, p[1], (field) => {
          field.progressBar = true;
          field.progressRaw = p[2]?.trim() || undefined;
          field.flagsRaw = p[3]?.trim() || undefined;
        });
        break;
      }

      case "StatusBarImage": {
        const p = splitParams(c.args);
        const statusBar = findStatusBarByReference(p[0]);
        updateStatusBarField(statusBar, p[1], (field) => {
          const parsedImage = parsePbImageReference(p[2]);
          field.imageRaw = parsedImage.imageRaw;
          field.imageId = parsedImage.imageId;
          field.flagsRaw = p[3]?.trim() || undefined;
        });
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
            const parsedImage = parsePbImageReference(p[3]);
            const item: GadgetItem = {
              posRaw,
              textRaw,
              text: unquoteString(textRaw),
              imageRaw: parsedImage.imageRaw,
              imageId: parsedImage.imageId,
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
          const color = parsePbColorLiteral(colorRaw)?.previewColor;

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
        const font = parseFormFont(c.assignedVar, c.args, c.range);
        if (font) {
          addFont(font);
          if (typeof font.name === "string" && typeof font.size === "number") {
            fontById.set(font.id, {
              name: font.name,
              size: font.size,
              flagsRaw: font.flagsRaw
            });
          }
        }
        continue;
      }

      case "SetGadgetFont": {
        const p = splitParams(c.args);
        const g = findGadgetByReference(gadgetById, p[0]);
        if (p.length >= 2 && g) {
          const { fontRaw, fontId } = parsePbFontReference(p[1]);
          g.gadgetFontRaw = fontRaw;
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

      case "ResizeGadget": {
        const p = splitParams(c.args);
        const g = findGadgetByReference(gadgetById, p[0]);
        if (p.length >= 5 && g) {
          const xRaw = (p[1] ?? "").trim();
          const yRaw = (p[2] ?? "").trim();
          const widthRaw = (p[3] ?? "").trim();
          const heightRaw = (p[4] ?? "").trim();

          g.resizeXRaw = xRaw || undefined;
          g.resizeYRaw = yRaw || undefined;
          g.resizeWRaw = widthRaw || undefined;
          g.resizeHRaw = heightRaw || undefined;
          g.resizeSource = c.range;

          if (usesWidthLayoutReference(xRaw)) {
            g.lockLeft = false;
            g.lockRight = true;
          }
          if (usesHeightLayoutReference(yRaw)) {
            g.lockTop = false;
            g.lockBottom = true;
          }
          if (usesWidthLayoutReference(widthRaw)) {
            g.lockLeft = true;
            g.lockRight = true;
          }
          if (usesHeightLayoutReference(heightRaw)) {
            g.lockTop = true;
            g.lockBottom = true;
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

          const color = parsePbColorLiteral(colorRaw)?.previewColor;
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
              message: `Found OpenWindow(${PB_ANY}, ...) without a stable assignment (expected: Var = OpenWindow(${PB_ANY}, ...)). Patching may be ambiguous.`,
              line: c.range.line
            });
          }
        }
        continue;
      }
    }

    const customGadget = parseCustomGadgetCreationCall(c, lines, lineStarts, customGadgetInitByIndex);
    if (customGadget) {
      const parent = parentStack[parentStack.length - 1];
      if (parent) {
        customGadget.parentId = parent.id;
        if (parent.kind === GADGET_KIND.PanelGadget && typeof parent.currentPanelItem === "number") {
          customGadget.parentItem = parent.currentPanelItem;
        }
      }

      doc.gadgets.push(customGadget);
      gadgetById.set(customGadget.id, customGadget);
      pushImplicitParent(customGadget);
      continue;
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
          message: `Found Gadget(${PB_ANY}, ...) without a stable assignment (expected: Var = Gadget(${PB_ANY}, ...)). Patching may be ambiguous.`,
          line: c.range.line
        });
      }

      if (!gadget.pbAny && gadget.firstParam.startsWith("#")) {
        gadget.enumValueRaw = gadgetEnumValues[gadget.firstParam] ?? undefined;
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

  applyEventMetadata(lines, doc);

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

  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;

    let name = part.slice(0, eq).trim();
    const def = part.slice(eq + 1).trim();
    if (!name.length || !def.length) continue;

    out[normalizeProcParamName(name)] = def;
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

function applyEventMetadata(lines: string[], doc: FormDocument): void {
  let inEventGadgetSelect = false;
  let eventGadgetDepth = 0;
  let pendingWindowDefaultProc = false;
  let pendingGadgetCaseRaw: string | undefined;

  let inEventMenuSelect = false;
  let eventMenuDepth = 0;
  let pendingMenuCaseRaw: string | undefined;

  for (const rawLine of lines) {
    const line = rawLine.split(";")[0]?.trim() ?? "";
    if (!line.length) continue;

    if (/^Select\s+EventMenu\s*\(\s*\)\s*$/i.test(line)) {
      if (doc.window) {
        doc.window.generateEventLoop = true;
        doc.window.hasEventMenuBlock = true;
      }
      inEventMenuSelect = true;
      eventMenuDepth = 1;
      pendingMenuCaseRaw = undefined;
      continue;
    }

    if (/^Select\s+EventGadget\s*\(\s*\)\s*$/i.test(line)) {
      if (doc.window) {
        doc.window.generateEventLoop = true;
        doc.window.hasEventGadgetBlock = true;
      }
      inEventGadgetSelect = true;
      eventGadgetDepth = 1;
      pendingWindowDefaultProc = false;
      pendingGadgetCaseRaw = undefined;
      continue;
    }

    if (inEventMenuSelect) {
      if (/^Select\b/i.test(line)) {
        eventMenuDepth++;
        continue;
      }

      if (/^EndSelect\b/i.test(line)) {
        eventMenuDepth--;
        if (eventMenuDepth <= 0) {
          inEventMenuSelect = false;
          pendingMenuCaseRaw = undefined;
        }
        continue;
      }

      if (eventMenuDepth !== 1) continue;

      const caseMatch = /^Case\b(.+)$/.exec(line);
      if (caseMatch) {
        pendingMenuCaseRaw = caseMatch[1]?.trim() || undefined;
        continue;
      }

      if (pendingMenuCaseRaw) {
        const procMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(line);
        if (procMatch) {
          assignMenuOrToolBarEvent(doc, pendingMenuCaseRaw, procMatch[1]);
          pendingMenuCaseRaw = undefined;
        }
      }

      continue;
    }

    if (!inEventGadgetSelect) continue;

    if (/^Select\b/i.test(line)) {
      eventGadgetDepth++;
      continue;
    }

    if (/^EndSelect\b/i.test(line)) {
      eventGadgetDepth--;
      if (eventGadgetDepth <= 0) {
        inEventGadgetSelect = false;
        pendingWindowDefaultProc = false;
        pendingGadgetCaseRaw = undefined;
      }
      continue;
    }

    if (eventGadgetDepth !== 1) continue;

    const caseMatch = /^Case\b(.+)$/.exec(line);
    if (caseMatch) {
      pendingWindowDefaultProc = false;
      pendingGadgetCaseRaw = caseMatch[1]?.trim() || undefined;
      if (doc.window) doc.window.hasEventGadgetCaseBranches = true;
      continue;
    }

    if (/^Default\b/i.test(line)) {
      pendingWindowDefaultProc = true;
      pendingGadgetCaseRaw = undefined;
      continue;
    }

    const procMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(line);
    if (!procMatch) continue;

    if (pendingWindowDefaultProc) {
      if (doc.window) doc.window.eventProc = procMatch[1];
      pendingWindowDefaultProc = false;
      continue;
    }

    if (pendingGadgetCaseRaw) {
      assignGadgetEvent(doc, pendingGadgetCaseRaw, procMatch[1]);
      pendingGadgetCaseRaw = undefined;
    }
  }

  let inWindowEventSelect = false;
  let windowEventDepth = 0;
  let pendingWindowEventProc = false;

  for (const rawLine of lines) {
    const line = rawLine.split(";")[0]?.trim() ?? "";
    if (!line.length) continue;

    if (/^Select\s+event\b/i.test(line)) {
      inWindowEventSelect = true;
      windowEventDepth = 1;
      pendingWindowEventProc = false;
      continue;
    }

    if (!inWindowEventSelect) continue;

    if (/^Select\b/i.test(line)) {
      windowEventDepth++;
      continue;
    }

    if (/^EndSelect\b/i.test(line)) {
      windowEventDepth--;
      if (windowEventDepth <= 0) {
        inWindowEventSelect = false;
        pendingWindowEventProc = false;
      }
      continue;
    }

    if (windowEventDepth !== 1) continue;

    if (/^Default\b/i.test(line)) {
      pendingWindowEventProc = true;
      continue;
    }

    if (!pendingWindowEventProc) continue;

    const procMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(line);
    if (!procMatch) continue;

    if (doc.window) doc.window.eventProc = procMatch[1];
    pendingWindowEventProc = false;
  }
}

function assignGadgetEvent(doc: FormDocument, rawCase: string, proc: string): void {
  const caseRaw = rawCase.trim();
  const caseNoHash = caseRaw.replace(/^#/, "");

  for (const gadget of doc.gadgets) {
    if (gadget.id === caseRaw || gadget.variable === caseRaw || gadget.variable === caseNoHash || gadget.id === "#" + caseNoHash) {
      gadget.eventProc = proc;
      break;
    }
  }
}

function assignMenuOrToolBarEvent(doc: FormDocument, rawCase: string, proc: string): void {
  const caseRaw = rawCase.trim();

  for (const menu of doc.menus) {
    for (const entry of menu.entries) {
      if (entry.idRaw === caseRaw) {
        entry.event = proc;
      }
    }
  }

  for (const toolBar of doc.toolbars) {
    for (const entry of toolBar.entries) {
      if (entry.idRaw === caseRaw) {
        entry.event = proc;
      }
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

  const parsed = parsePbWindowReference(parentRaw);
  if (parsed) {
    return parsed.normalizedInner;
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

function parseMenuItemText(textRaw: string | undefined): { text?: string; shortcut?: string } {
  const raw = textRaw?.trim();
  if (!raw) return {};

  const literal = parsePbStringLiteral(raw);
  if (literal !== undefined) {
    // parsePbStringLiteral() returns undefined for "..." + Chr(9) + "..." expressions,
    // so the literal branch is only reached for plain captions without a shortcut.
    // Any '"' in `literal` is unescaped caption content, never a shortcut delimiter.
    return { text: literal.length ? literal : undefined };
  }

    const expr = parseMenuItemTextExpression(raw);
    if (expr) return expr;

    return { text: undefined, shortcut: undefined };
  }

function parseMenuItemTextExpression(raw: string): { text?: string; shortcut?: string } | undefined {
  const parts = splitConcatenation(raw);
  if (parts.length < 3) return undefined;

  const tabIndex = parts.findIndex((part) => /^Chr\(\s*9\s*\)$/i.test(part));
  if (tabIndex <= 0 || tabIndex === parts.length - 1) return undefined;

  const text = parseConcatenatedStringParts(parts.slice(0, tabIndex));
  const shortcut = parseConcatenatedStringParts(parts.slice(tabIndex + 1));
  if (text === undefined || shortcut === undefined) return undefined;

  return {
    text: text.length ? text : undefined,
    shortcut: shortcut.length ? shortcut : undefined
  };
}

function parseConcatenatedStringParts(parts: string[]): string | undefined {
  let out = '';
  for (const part of parts) {
    const literal = parsePbStringLiteral(part);
    if (literal === undefined) return undefined;
    out += literal;
  }
  return out;
}

function splitConcatenation(raw: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let inStr = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) {
      if (ch === '"' && raw[i + 1] === '"') {
        i++;
        continue;
      }
      if (ch === '"') inStr = false;
      continue;
    }

    if (ch === '"') {
      inStr = true;
      continue;
    }

    if (ch === '(') {
      depth++;
      continue;
    }

    if (ch === ')') {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (ch === '+' && depth === 0) {
      const part = raw.slice(start, i).trim();
      if (part.length) parts.push(part);
      start = i + 1;
    }
  }

  const tail = raw.slice(start).trim();
  if (tail.length) parts.push(tail);
  return parts;
}

function normalizeImageValue(raw: string | undefined, inline: boolean): string | undefined {
  const valueRaw = raw?.trim();
  if (!valueRaw) return undefined;

  if (inline) {
    const label = valueRaw.replace(/^\?+/, "").trim();
    return label.length ? label : undefined;
  }

  return unquoteString(valueRaw) ?? (valueRaw.length ? valueRaw : undefined);
}

function parseFormFont(assignedVar: string | undefined, args: string, source?: FormFont["source"]): FormFont | undefined {
  const p = splitParams(args);
  if (p.length < 3) return undefined;

  const firstParam = (p[0] ?? "").trim();
  const pbAny = firstParam === PB_ANY;
  const id = pbAny ? (assignedVar ?? PB_ANY) : firstParam;
  const nameRaw = (p[1] ?? "").trim();
  const sizeRaw = (p[2] ?? "").trim();
  if (!nameRaw.length || !sizeRaw.length) return undefined;

  const name = unquoteString(nameRaw) ?? undefined;
  const size = asNumber(sizeRaw);

  return {
    id,
    pbAny,
    variable: pbAny ? (assignedVar ?? undefined) : firstParam.replace(/^#/, ""),
    firstParam,
    nameRaw,
    name,
    sizeRaw,
    size: typeof size === "number" ? size : undefined,
    flagsRaw: p[3]?.trim() || undefined,
    source
  };
}

function parseFormImage(inline: boolean, assignedVar: string | undefined, args: string, source?: FormImage["source"]): FormImage | undefined {
  const p = splitParams(args);
  if (p.length < 2) return undefined;

  const firstParam = (p[0] ?? "").trim();
  const pbAny = firstParam === PB_ANY;
  const id = pbAny ? (assignedVar ?? PB_ANY) : firstParam;
  const imageRaw = (p[1] ?? "").trim();
  if (!imageRaw.length) return undefined;

  return {
    id,
    pbAny,
    variable: pbAny ? (assignedVar ?? undefined) : firstParam.replace(/^#/, ""),
    firstParam,
    imageRaw,
    image: normalizeImageValue(imageRaw, inline),
    inline,
    source
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

const CUSTOM_GADGET_INIT_MARKER_RE = /^\s*;\s*(\d+)\s+Custom gadget initialisation \(do Not remove this line\)\s*$/i;
const CUSTOM_GADGET_CREATE_MARKER_RE = /^\s*;\s*(\d+)\s+Custom gadget creation \(do not remove this line\)\s*(.*?)\s*$/i;

type CustomGadgetInitEntry = {
  index: number;
  markerLine: number;
  codeRaw?: string;
  codeLine?: number;
  markerSource?: SourceRange;
  codeSource?: SourceRange;
};

function buildLineStartOffsets(text: string): number[] {
  const offsets: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

function buildLineSourceRange(lines: string[], lineStarts: number[], line: number): SourceRange | undefined {
  if (line < 0 || line >= lines.length) return undefined;
  const lineStart = lineStarts[line] ?? 0;
  const text = lines[line] ?? "";
  return {
    start: lineStart,
    end: lineStart + text.length,
    line,
    lineStart
  };
}

function parseCustomGadgetInitMap(lines: string[], lineStarts: number[]): Map<number, CustomGadgetInitEntry> {
  const out = new Map<number, CustomGadgetInitEntry>();
  for (let i = 0; i < lines.length; i++) {
    const match = CUSTOM_GADGET_INIT_MARKER_RE.exec(lines[i] ?? "");
    if (!match) continue;
    const index = Number(match[1]);
    const codeLine = i + 1 < lines.length ? i + 1 : undefined;
    out.set(index, {
      index,
      markerLine: i,
      codeRaw: codeLine !== undefined ? (lines[codeLine] ?? "").trim() || undefined : undefined,
      codeLine,
      markerSource: buildLineSourceRange(lines, lineStarts, i),
      codeSource: codeLine !== undefined ? buildLineSourceRange(lines, lineStarts, codeLine) : undefined
    });
  }
  return out;
}

function parseCustomGadgetNumericValue(raw: string | undefined): number | undefined {
  const trimmed = raw?.trim();
  if (!trimmed?.length) return undefined;

  const direct = asNumber(trimmed);
  if (typeof direct === "number") return direct;

  const tail = /(-?\d+)\s*$/.exec(trimmed);
  if (tail) return Number(tail[1]);

  return undefined;
}

function parseCustomGadgetCreationCall(
  call: PbCall,
  lines: string[],
  lineStarts: number[],
  initByIndex: ReadonlyMap<number, CustomGadgetInitEntry>
): Gadget | undefined {
  const markerLine = call.range.line - 1;
  if (markerLine < 0 || markerLine >= lines.length) return undefined;

  const markerMatch = CUSTOM_GADGET_CREATE_MARKER_RE.exec(lines[markerLine] ?? "");
  if (!markerMatch) return undefined;

  const templateRaw = markerMatch[2]?.trim() || undefined;
  if (!templateRaw?.length) return undefined;

  const params = splitParams(call.args);
  const equalsPos = templateRaw.indexOf("=");
  const placeholders = ["id", "x", "y", "w", "h", "txt", "hwnd"]
    .map(token => ({ token, pos: templateRaw.indexOf(`%${token}%`) }))
    .filter(entry => entry.pos >= 0)
    .sort((a, b) => a.pos - b.pos);

  const resolved = new Map<string, string>();
  let paramIndex = 0;
  for (const entry of placeholders) {
    if (equalsPos >= 0 && entry.pos < equalsPos) {
      const assigned = call.assignedVar?.trim();
      if (assigned?.length) resolved.set(entry.token, assigned);
      continue;
    }

    const raw = params[paramIndex]?.trim();
    if (raw?.length) resolved.set(entry.token, raw);
    paramIndex += 1;
  }

  const idRaw = resolved.get("id")?.trim();
  if (!idRaw?.length) return undefined;

  const pbAny = !idRaw.startsWith("#");
  const firstParam = pbAny ? PB_ANY : idRaw;
  const textRaw = resolved.get("txt")?.trim() || undefined;
  const literalText = unquoteString(textRaw ?? "");
  const initIndex = Number(markerMatch[1]);
  const initEntry = initByIndex.get(initIndex);

  return {
    id: idRaw,
    kind: GADGET_KIND.CustomGadget,
    pbAny,
    variable: pbAny ? idRaw : idRaw.replace(/^#/, ""),
    firstParam,
    x: parseCustomGadgetNumericValue(resolved.get("x")) ?? 0,
    y: parseCustomGadgetNumericValue(resolved.get("y")) ?? 0,
    w: parseCustomGadgetNumericValue(resolved.get("w")) ?? 0,
    h: parseCustomGadgetNumericValue(resolved.get("h")) ?? 0,
    textRaw,
    text: literalText ?? (textRaw?.length ? textRaw : undefined),
    textVariable: literalText === undefined && !!textRaw?.length,
    customSelectName: call.name,
    customInitRaw: initEntry?.codeRaw,
    customCreateRaw: templateRaw,
    customInitSource: initEntry?.codeSource,
    customCreateMarkerSource: buildLineSourceRange(lines, lineStarts, markerLine),
    source: call.range
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
      const parsedImage = parsePbImageReference(params[5]);
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
  const pbAny = firstParam === PB_ANY;
  const id = pbAny ? (assignedVar ?? PB_ANY) : firstParam;

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
    xRaw,
    yRaw,
    wRaw,
    hRaw,
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
  const pbAny = firstParam === PB_ANY;
  const id = pbAny ? (assignedVar ?? PB_ANY) : firstParam;

  const xRaw = (p[1] ?? "").trim();
  const yRaw = (p[2] ?? "").trim();
  const wRaw = (p[3] ?? "").trim();
  const hRaw = (p[4] ?? "").trim();

  const x = parseDesignerLayoutRaw(xRaw, "x") ?? asNumber(xRaw) ?? 0;
  const y = parseDesignerLayoutRaw(yRaw, "y") ?? asNumber(yRaw) ?? 0;
  const w = parseDesignerLayoutRaw(wRaw, "w") ?? asNumber(wRaw) ?? 0;
  const h = parseDesignerLayoutRaw(hRaw, "h") ?? asNumber(hRaw) ?? 0;

  const ctor = parseGadgetConstructorDetails(kind, p);
  const literalText = unquoteString(ctor.textRaw ?? "");
  const text = literalText ?? (ctor.textRaw?.length ? ctor.textRaw : undefined);
  const textVariable = literalText === undefined && !!ctor.textRaw?.length;

  const ctorLocks = inferGadgetCtorLocks({ xRaw, yRaw, wRaw, hRaw });

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
    xRaw,
    yRaw,
    wRaw,
    hRaw,
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
    lockLeft: ctorLocks.lockLeft,
    lockRight: ctorLocks.lockRight,
    lockTop: ctorLocks.lockTop,
    lockBottom: ctorLocks.lockBottom,
    source: range
  };
}