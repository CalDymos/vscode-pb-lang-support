import { MenuEntryMovePlacement } from "../../shared/menu";
import * as vscode from "vscode";
import { scanCalls } from "../parser/call-scanner";
import { parseFormDocument } from "../parser/form-parser";
import { parseGlobalVarNames } from "../parser/global-scanner";
import { normalizePbImageValue } from "../parser/pb-image-value";
import { parsePbStringLiteral } from "../parser/pb-string";
import {
  findFirstProcedureLine,
  findProcedureBlock as findProcedureBlockInLines,
  findProcedureBlockByName as findProcedureBlockByNameInLines,
  type ProcedureLineBlock,
} from "../parser/procedure-scanner";
import { asNumber, normalizeProcParamName, quotePbString, splitParams } from "../parser/tokenizer";
import { buildInsertedGadgetIdentity, canHostInsertedGadgets, isInsertableGadgetKind, shouldInsertGadgetAsPbAny, type InsertableGadgetKind } from "../gadget/insert";
import { buildOriginalGadgetDeletePlan, collectRequestedGadgetDeleteIds } from "../gadget/delete";
import { ENUM_NAMES, FormFont, FormImage, FormMenu, FormMenuEntry, FormStatusBarField, FormToolBar, FormToolBarEntry, FormWindow, Gadget, ScanRange, MENU_ENTRY_KIND, TOOLBAR_ENTRY_KIND, MenuEntryKind, PB_ANY, ToolBarEntryKind, GADGET_KIND } from "../model";

type PbCall = ReturnType<typeof scanCalls>[number];

const PB_CALL = {
  createImageMenu: "createimagemenu",
  createMenu: "createmenu",
  createStatusBar: "createstatusbar",
  createToolBar: "createtoolbar",
  openWindow: "openwindow",
} as const;

/**
 * Escape special characters in regular expressions
 */
function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stableKey(assignedVar: string | undefined, params: string[]): string | undefined {
  if (params.length < 1) return undefined;

  const first = params[0].trim();
  if (first === PB_ANY) {
    return assignedVar ?? PB_ANY;
  }

  return first;
}


function tryPatchProcedureDefaults(
  document: vscode.TextDocument,
  fromLine: number,
  updates: Record<string, string>
): vscode.WorkspaceEdit | undefined {
  for (let i = Math.min(fromLine, document.lineCount - 1); i >= 0; i--) {
    const lineText = document.lineAt(i).text;

    if (/^\s*EndProcedure\b/i.test(lineText)) break;

    const m = /^(\s*Procedure(?:\.\w+)?\s+[\w:]+\s*)\((.*)\)\s*$/i.exec(lineText);
    if (!m) continue;

    const prefix = m[1];
    const rawArgs = m[2];
    const parts = splitParams(rawArgs);
    if (parts.length === 0) return undefined;

    let changed = false;
    const rebuiltParts = parts.map(p => {
      const eq = p.indexOf("=");
      if (eq < 0) return p;

      const left = p.slice(0, eq).trim();
      const right = p.slice(eq + 1).trim();
      const key = normalizeProcParamName(left);

      const newVal = updates[key];
      if (newVal === undefined) return p;
      if (right === newVal) return p;

      changed = true;
      return `${left} = ${newVal}`;
    });

    if (!changed) return undefined;

    const rebuiltLine = `${prefix}(${rebuiltParts.join(", ")})`;
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, document.lineAt(i).range, rebuiltLine);
    return edit;
  }

  return undefined;
}

function getLineIndent(document: vscode.TextDocument, line: number): string {
  if (line < 0 || line >= document.lineCount) return "";
  const text = document.lineAt(line).text;
  const m = /^\s*/.exec(text);
  return m?.[0] ?? "";
}

function isBlankLine(document: vscode.TextDocument, line: number): boolean {
  if (line < 0 || line >= document.lineCount) return false;
  return document.lineAt(line).text.trim() === "";
}

function getDocumentEol(document: vscode.TextDocument): string {
  return document.getText().includes("\r\n") ? "\r\n" : "\n";
}

function skipBlankLines(document: vscode.TextDocument, line: number): number {
  let nextLine = line;
  while (nextLine < document.lineCount && isBlankLine(document, nextLine)) {
    nextLine += 1;
  }
  return nextLine;
}

function scanDocumentCalls(document: vscode.TextDocument, scanRange?: ScanRange): PbCall[] {
  return scanCalls(document.getText(), scanRange);
}

type WorkspaceEditOperation = {
  kind: "replace" | "insert" | "delete";
  uri: vscode.Uri;
  range?: vscode.Range;
  position?: vscode.Position;
  newText?: string;
};

type WorkspaceTextEditLike = {
  range?: vscode.Range;
  newText?: string;
};

function buildWorkspaceEditOperations(source: vscode.WorkspaceEdit): WorkspaceEditOperation[] | undefined {
  const sourceWithOps = source as vscode.WorkspaceEdit & {
    entries?: () => Array<[unknown, unknown[]]>;
    getOperations?: () => WorkspaceEditOperation[];
  };

  if (typeof sourceWithOps.getOperations === "function") {
    return sourceWithOps.getOperations();
  }

  if (typeof sourceWithOps.entries === "function") {
    const replayOperations: WorkspaceEditOperation[] = [];

    for (const [uri, textEdits] of sourceWithOps.entries()) {
      for (const textEdit of textEdits as WorkspaceTextEditLike[]) {
        const range = textEdit?.range;
        if (!range) continue;

        const newText = textEdit.newText ?? "";
        if (range.start.line === range.end.line && range.start.character === range.end.character) {
          if (newText.length > 0) {
            replayOperations.push({
              kind: "insert",
              uri: uri as vscode.Uri,
              position: range.start,
              newText,
            });
          }
          continue;
        }

        replayOperations.push({
          kind: newText.length > 0 ? "replace" : "delete",
          uri: uri as vscode.Uri,
          range,
          newText,
        });
      }
    }

    return replayOperations;
  }

  return undefined;
}

function appendWorkspaceEdit(target: vscode.WorkspaceEdit, source: vscode.WorkspaceEdit | undefined): void {
  if (!source) return;

  const operations = buildWorkspaceEditOperations(source);
  if (!operations) {
    throw new Error("Unsupported WorkspaceEdit shape: no replayable operations or entries available.");
  }
  if (!operations.length) {
    return;
  }

  for (const operation of operations) {
    if (operation.kind === "replace" && operation.range) {
      target.replace(operation.uri, operation.range, operation.newText ?? "");
    }
    else if (operation.kind === "insert" && operation.position) {
      target.insert(operation.uri, operation.position, operation.newText ?? "");
    }
    else if (operation.kind === "delete" && operation.range) {
      target.delete(operation.uri, operation.range);
    }
  }
}

function collectWorkspaceEditTouchedLines(source: vscode.WorkspaceEdit | undefined): ReadonlySet<number> {
  const touched = new Set<number>();
  if (!source) return touched;

  const operations = buildWorkspaceEditOperations(source);
  if (!operations) {
    throw new Error("Unsupported WorkspaceEdit shape: no replayable operations or entries available.");
  }

  for (const operation of operations) {
    if (operation.position) {
      touched.add(operation.position.line);
      continue;
    }

    const range = operation.range;
    if (!range) continue;

    const endLine = range.end.character === 0
      ? Math.max(range.start.line, range.end.line - 1)
      : range.end.line;

    for (let line = range.start.line; line <= endLine; line++) {
      touched.add(line);
    }
  }

  return touched;
}

function findCallByStableKey(
  calls: PbCall[],
  key: string,
  namePredicate?: (name: string) => boolean
) {
  return calls.find(c => {
    if (namePredicate && !namePredicate(c.name)) return false;
    const params = splitParams(c.args);
    const k = stableKey(c.assignedVar, params);
    return k === key;
  });
}

function findCallsByName(calls: PbCall[], nameLower: string) {
  return calls.filter(c => c.name.toLowerCase() === nameLower);
}

function firstParamOfCall(callArgs: string): string {
  const params = splitParams(callArgs);
  return (params[0] ?? "").trim();
}

function buildAddGadgetItemArgs(gadgetKey: string, args: GadgetItemArgs): string {
  const out: string[] = [];
  out.push(gadgetKey);
  out.push(args.posRaw);
  out.push(args.textRaw);

  // The original Form Designer ignores AddGadgetItem image arguments on load
  // and does not emit them. The port preserves existing item image arguments
  // for roundtrip/editing until an explicit compatibility decision changes it.
  if (args.imageRaw !== undefined || args.flagsRaw !== undefined) {
    out.push((args.imageRaw ?? "0").trim().length ? args.imageRaw! : "0");
  }

  if (args.flagsRaw !== undefined) {
    out.push(args.flagsRaw);
  }

  return out.join(", ");
}

function buildAddGadgetColumnArgs(gadgetKey: string, args: GadgetColumnArgs): string {
  const out: string[] = [];
  out.push(gadgetKey);
  out.push(args.colRaw);
  out.push(args.titleRaw);
  out.push(args.widthRaw);
  return out.join(", ");
}

function replaceCallLinePreserveSuffix(
  document: vscode.TextDocument,
  call: { name: string; args: string; range: { line: number; lineStart: number; end: number } },
  rebuiltLine: string
): vscode.WorkspaceEdit {
  const line = call.range.line;
  const lineText = document.lineAt(line).text;
  const endInLine = Math.max(0, call.range.end - call.range.lineStart);
  const suffix = lineText.slice(endInLine);

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, document.lineAt(line).range, rebuiltLine + suffix);
  return edit;
}

export interface GadgetItemArgs {
  posRaw: string;
  textRaw: string;
  imageRaw?: string;
  flagsRaw?: string;
}

export interface GadgetColumnArgs {
  colRaw: string;
  titleRaw: string;
  widthRaw: string;
}

export interface WindowPropertyArgs {
  hiddenRaw?: string;
  disabledRaw?: string;
  colorRaw?: string;
}

export interface WindowOpenArgs {
  xRaw?: string;
  yRaw?: string;
  wRaw?: string;
  hRaw?: string;
  captionRaw?: string;
  flagsExpr?: string;
  parentRaw?: string;
}

export interface WindowEventArgs {
  eventFileRaw?: string;
}

export interface WindowEventProcBlock {
  selectLine: number;
  endLine: number;
  defaultLine?: number;
  procLine?: number;
  hasCaseBranches: boolean;
}

export interface EventCaseBranch {
  caseLine: number;
  caseRaw: string;
  procLine?: number;
  boundaryLine: number;
}


export interface MenuEntryArgs {
  kind: MenuEntryKind;
  idRaw?: string;
  textRaw?: string;
  shortcut?: string;
  iconRaw?: string;
}

export interface MenuEntryInsertOptions {
  parentSourceLine?: number;
}


export interface MenuEntryMoveOptions {
  targetSourceLine: number;
  placement: MenuEntryMovePlacement;
}

export interface TopLevelEntryMoveOptions {
  targetSourceLine: number;
  placement: typeof MenuEntryMovePlacement.Before | typeof MenuEntryMovePlacement.After;
}

export interface ToolBarEntryArgs {
  kind: ToolBarEntryKind;
  idRaw?: string;
  iconRaw?: string;
  textRaw?: string;
  tooltip?: string;
  toggle?: boolean;
}

export interface StatusBarFieldArgs {
  widthRaw: string;
  textRaw?: string;
  imageRaw?: string;
  flagsRaw?: string;
  progressBar?: boolean;
  progressRaw?: string;
}

export interface FontArgs {
  idRaw: string;
  nameRaw: string;
  sizeRaw: string;
  flagsRaw?: string;
  assignedVar?: string;
}

export interface ImageArgs {
  inline: boolean;
  idRaw: string;
  imageRaw: string;
  assignedVar?: string;
  /** When true: convert enum image (firstParam=#Img_...) to #PB_Any variable
   *  mode, move entry to end of list, and re-index all image IDs. */
  pbAny?: boolean;
}

export interface GadgetPropertyArgs {
  hiddenRaw?: string;
  disabledRaw?: string;
  tooltipRaw?: string;
  stateRaw?: string;
  frontColorRaw?: string;
  backColorRaw?: string;
  gadgetFontRaw?: string;
}

export interface GadgetOpenArgs {
  textRaw?: string;
  imageRaw?: string;
  minRaw?: string;
  maxRaw?: string;
  gadget1Raw?: string;
  gadget2Raw?: string;
  flagsExpr?: string;
}

export interface CustomGadgetCodeArgs {
  customInitRaw?: string;
  customCreateRaw?: string;
}

function isCreateBoundary(nameLower: string): boolean {
  return (
    nameLower === PB_CALL.createMenu ||
    nameLower === PB_CALL.createImageMenu ||
    nameLower === PB_CALL.createToolBar ||
    nameLower === PB_CALL.createStatusBar ||
    nameLower === PB_CALL.openWindow
  );
}

function getCreateNameVariants(createNameLower: string): readonly string[] {
  if (createNameLower === PB_CALL.createMenu) {
    return [PB_CALL.createMenu, PB_CALL.createImageMenu];
  }
  return [createNameLower];
}

function matchesCreateCallName(callNameLower: string, createNameLower: string): boolean {
  return getCreateNameVariants(createNameLower).includes(callNameLower);
}

function findNearestCreateAbove(
  calls: PbCall[],
  line: number,
  createNameLower: string
) {
  let best: (typeof calls)[number] | undefined;
  for (const c of calls) {
    if (!matchesCreateCallName(c.name.toLowerCase(), createNameLower)) continue;
    if (c.range.line <= line) best = c;
    else break;
  }
  return best;
}

function normalizeMenuTextForShortcut(textRaw: string): string {
  const raw = textRaw.trim();
  const tabConcat = /^(.*)\+\s*Chr\(\s*9\s*\)\s*\+\s*(.*)$/i.exec(raw);
  if (tabConcat) {
    const literal = parsePbStringLiteral(tabConcat[1]);
    if (literal !== undefined) {
      return quotePbString(literal);
    }
  }

  const literal = parsePbStringLiteral(raw);
  if (literal !== undefined) {
    // A plain string literal has no embedded shortcut in PBF format;
    // shortcuts are always expressed as "..." + Chr(9) + "..." (handled above).
    return quotePbString(literal);
  }

  return raw;
}

function appendMenuShortcut(textRaw: string, shortcut: string | undefined): string {
  if (shortcut === undefined || shortcut.length === 0) return textRaw;
  const baseText = normalizeMenuTextForShortcut(textRaw);
  return `${baseText} + Chr(9) + ${quotePbString(shortcut)}`;
}

function buildMenuEntryLine(args: MenuEntryArgs): string {
  switch (args.kind) {
    case MENU_ENTRY_KIND.MenuTitle:
      return `MenuTitle(${(args.textRaw ?? "\"\"").trim()})`;
    case MENU_ENTRY_KIND.MenuItem: {
      const id = args.idRaw?.trim() || "0";
      const text = appendMenuShortcut(args.textRaw ?? "\"\"", args.shortcut);
      const icon = args.iconRaw;
      return icon ? `MenuItem(${id}, ${text}, ${icon})` : `MenuItem(${id}, ${text})`;
    }
    case MENU_ENTRY_KIND.MenuBar:
      return "MenuBar()";
    case MENU_ENTRY_KIND.OpenSubMenu:
      return `OpenSubMenu(${(args.textRaw ?? "\"\"").trim()})`;
    case MENU_ENTRY_KIND.CloseSubMenu:
      return "CloseSubMenu()";
    default:
      return "";
  }
}

function cloneMenuEntry(entry: FormMenuEntry): FormMenuEntry {
  return { ...entry };
}

function cloneToolBarEntry(entry: FormToolBarEntry): FormToolBarEntry {
  return { ...entry };
}

function getGadgetGlobalVars(gadgets: Gadget[]): string[] {
  return gadgets
    .filter(gadget => gadget.pbAny)
    .map(gadget => gadget.id?.trim() ?? "")
    .filter(id => id.length > 0 && !id.startsWith("#"));
}

function getGadgetEnumSymbols(gadgets: Gadget[]): string[] {
  return gadgets
    .filter(gadget => !gadget.pbAny)
    .map(gadget => gadget.firstParam.trim())
    .filter(id => id.length > 0 && id.startsWith("#"));
}

function buildGadgetGlobalBlock(gadgets: Gadget[]): string {
  const globals = getGadgetGlobalVars(gadgets);
  if (!globals.length) return "";
  return `Global ${globals.join(", ")}

`;
}

function buildGadgetEnumBlock(gadgets: Gadget[]): string {
  const symbols = getGadgetEnumSymbols(gadgets);
  if (!symbols.length) return "";
  return `Enumeration FormGadget
${symbols.map(symbol => `  ${symbol}`).join("\n")}
EndEnumeration

`;
}

function collectMenuEnumSymbols(menus: FormMenu[], toolbars: FormToolBar[] = []): string[] {
  const seen = new Set<string>();
  const symbols: string[] = [];

  for (const menu of menus) {
    for (const entry of menu.entries) {
      const idRaw = entry.idRaw?.trim();
      if (!idRaw?.startsWith("#") || seen.has(idRaw)) continue;
      seen.add(idRaw);
      symbols.push(idRaw);
    }
  }

  for (const toolBar of toolbars) {
    for (const entry of toolBar.entries) {
      if (!isToolBarButtonKind(entry.kind)) continue;
      const idRaw = entry.idRaw?.trim();
      if (!idRaw?.startsWith("#") || seen.has(idRaw)) continue;
      seen.add(idRaw);
      symbols.push(idRaw);
    }
  }

  return symbols;
}

function buildMenuEnumBlock(symbols: string[], eol = "\n"): string {
  if (!symbols.length) return "";
  return `Enumeration ${ENUM_NAMES.menus}${eol}${symbols.map(symbol => `  ${symbol}`).join(eol)}${eol}EndEnumeration${eol}${eol}`;
}

function isNamedEnumerationLine(text: string, enumName: string): boolean {
  return new RegExp(`^Enumeration\\s+${enumName}\\b`, "i").test(text.trim());
}

function findTopLevelEnumInsertLine(
  document: vscode.TextDocument,
  preferredEnumNames: readonly string[],
  boundaryEnumNames: readonly string[]
): number {
  let lastBlock: LineBlock | undefined;

  for (const enumName of preferredEnumNames) {
    const block = findNamedEnumerationBlock(document, enumName);
    if (block && (!lastBlock || block.endLine > lastBlock.endLine)) {
      lastBlock = block;
    }
  }

  if (lastBlock) {
    return skipBlankLines(document, lastBlock.endLine + 1);
  }

  for (let i = 0; i < document.lineCount; i++) {
    const text = document.lineAt(i).text;
    const trimmed = text.trim();
    if (boundaryEnumNames.some(enumName => isNamedEnumerationLine(trimmed, enumName))
      || isCustomGadgetInitMarkerLine(text)
      || isImageDecoderLine(text)
      || /^LoadImage\s*\(/i.test(trimmed)
      || /^CatchImage\s*\(/i.test(trimmed)
      || /^LoadFont\s*\(/i.test(trimmed)
      || isTopLevelHeadBoundaryLine(text)) {
      return i;
    }
  }

  return document.lineCount;
}

function findMenuEnumInsertLine(document: vscode.TextDocument): number {
  return findTopLevelEnumInsertLine(
    document,
    [ENUM_NAMES.windows, ENUM_NAMES.gadgets],
    [ENUM_NAMES.images, ENUM_NAMES.fonts]
  );
}

function applyMenuEnumPatch(
  edit: vscode.WorkspaceEdit,
  document: vscode.TextDocument,
  calls: PbCall[],
  symbols: string[]
): void {
  const menuEnumBlock = findNamedEnumerationBlock(document, ENUM_NAMES.menus);
  applyOptionalBlockPatch(
    edit,
    document,
    menuEnumBlock ? expandBlockWithTrailingBlank(document, menuEnumBlock) : undefined,
    findMenuEnumInsertLine(document),
    buildMenuEnumBlock(symbols, getDocumentEol(document))
  );
}

function buildMenuCreateLine(document: vscode.TextDocument, call: PbCall, hasIcons: boolean): string {
  const indent = getLineIndent(document, call.range.line);
  const createName = hasIcons ? "CreateImageMenu" : "CreateMenu";
  return `${indent}${createName}(${call.args})`;
}

function applyMenuCreateModePatch(
  edit: vscode.WorkspaceEdit,
  document: vscode.TextDocument,
  calls: PbCall[],
  menuId: string,
  hasIcons: boolean
): void {
  const create = findCreateCallById(calls, PB_CALL.createMenu, menuId);
  if (!create) return;

  const expectedName = hasIcons ? PB_CALL.createImageMenu : PB_CALL.createMenu;
  if (create.name.toLowerCase() === expectedName) return;

  appendWorkspaceEdit(edit, replaceCallLinePreserveSuffix(document, create, buildMenuCreateLine(document, create, hasIcons)));
}

const TOP_LEVEL_TOOLBAR_SECTION_NAMES = new Set<string>([
  PB_CALL.createToolBar,
  TOOLBAR_ENTRY_KIND.ToolBarButton.toLowerCase(),
  TOOLBAR_ENTRY_KIND.ToolBarImageButton.toLowerCase(),
  TOOLBAR_ENTRY_KIND.ToolBarSeparator.toLowerCase(),
  TOOLBAR_ENTRY_KIND.ToolBarToolTip.toLowerCase(),
  TOOLBAR_ENTRY_KIND.ToolBarStandardButton.toLowerCase(),
]);

const TOP_LEVEL_STATUSBAR_SECTION_NAMES = new Set<string>([
  PB_CALL.createStatusBar,
  "addstatusbarfield",
  "statusbartext",
  "statusbarimage",
  "statusbarprogress",
]);

const TOP_LEVEL_MENU_SECTION_NAMES = new Set<string>([
  PB_CALL.createMenu,
  PB_CALL.createImageMenu,
  MENU_ENTRY_KIND.MenuTitle.toLowerCase(),
  MENU_ENTRY_KIND.MenuItem.toLowerCase(),
  MENU_ENTRY_KIND.MenuBar.toLowerCase(),
  MENU_ENTRY_KIND.OpenSubMenu.toLowerCase(),
  MENU_ENTRY_KIND.CloseSubMenu.toLowerCase(),
]);

type TopLevelCreateSectionKind = "toolbar" | "statusbar" | "menu";

function getTopLevelSectionOrder(nameLower: string): number | undefined {
  if (TOP_LEVEL_TOOLBAR_SECTION_NAMES.has(nameLower)) return 0;
  if (TOP_LEVEL_STATUSBAR_SECTION_NAMES.has(nameLower)) return 1;
  if (TOP_LEVEL_MENU_SECTION_NAMES.has(nameLower)) return 2;
  return undefined;
}

function getTopLevelCreateSectionOrder(kind: TopLevelCreateSectionKind): number {
  switch (kind) {
    case "toolbar": return 0;
    case "statusbar": return 1;
    case "menu": return 2;
  }
}

function isWindowOpenPostambleCall(nameLower: string): boolean {
  return nameLower === "hidewindow"
    || nameLower === "disablewindow"
    || nameLower === "setwindowcolor"
    || nameLower === "addkeyboardshortcut";
}

function getWindowReferenceExpression(window: FormWindow): string {
  if (window.pbAny) return window.variable?.trim() || window.id;
  return window.firstParam?.trim() || window.id;
}

function getNextNumericTopLevelId(existingIds: Iterable<string>): string {
  const used = new Set<string>();
  for (const id of existingIds) {
    const normalized = id.trim();
    if (normalized.length) used.add(normalized);
  }

  for (let i = 0; i < 10000; i += 1) {
    const candidate = String(i);
    if (!used.has(candidate)) return candidate;
  }

  return String(used.size);
}

function findTopLevelCreateInsertAnchor(
  document: vscode.TextDocument,
  calls: PbCall[],
  openCall: PbCall,
  proc: LineBlock,
  kind: TopLevelCreateSectionKind
): GadgetInsertAnchor {
  const targetOrder = getTopLevelCreateSectionOrder(kind);
  let insertAfterLine = openCall.range.line;

  for (const call of calls) {
    if (call.range.line <= openCall.range.line) continue;
    if (call.range.line > proc.endLine) break;

    const nameLower = call.name.toLowerCase();
    const sectionOrder = getTopLevelSectionOrder(nameLower);
    if (typeof sectionOrder === "number") {
      if (sectionOrder > targetOrder) {
        return { insertLine: call.range.line, indent: getLineIndent(document, call.range.line) };
      }
      insertAfterLine = call.range.line;
      continue;
    }

    if (isGadgetSectionCallName(nameLower)) {
      return { insertLine: call.range.line, indent: getLineIndent(document, call.range.line) };
    }

    if (isWindowOpenPostambleCall(nameLower)) {
      insertAfterLine = call.range.line;
    }
  }

  return { insertLine: insertAfterLine + 1, indent: getLineIndent(document, insertAfterLine) };
}

function buildTopLevelCreateSectionText(lines: string[], indent: string, eol: string): string {
  return lines.map(line => `${indent}${line}`).join(eol) + eol;
}

function findWindowTopLevelCreateContext(
  document: vscode.TextDocument,
  calls: PbCall[],
  kind: TopLevelCreateSectionKind
): { parsed: ReturnType<typeof parseFormDocument>; anchor: GadgetInsertAnchor; windowRef: string } | undefined {
  const parsed = parseFormDocument(document.getText());
  const window = parsed.window;
  if (!window) return undefined;

  const openCall = findCallByStableKey(calls, window.id, name => name === "OpenWindow");
  if (!openCall) return undefined;

  const proc = findProcedureBlock(document, openCall.range.line);
  if (!proc) return undefined;

  return {
    parsed,
    anchor: findTopLevelCreateInsertAnchor(document, calls, openCall, proc, kind),
    windowRef: getWindowReferenceExpression(window),
  };
}

function buildToolBarImageButtonLine(args: ToolBarEntryArgs): string {
  const id = args.idRaw?.trim() || "0";
  const icon = args.iconRaw ?? "0";
  const toggle = args.toggle ? ", #PB_ToolBar_Toggle" : "";
  return `ToolBarImageButton(${id}, ${icon}${toggle})`;
}

function buildToolBarToolTipLine(toolBarId: string | undefined, args: ToolBarEntryArgs): string {
  const id = args.idRaw?.trim() || "0";
  const text = args.textRaw ?? "\"\"";
  return toolBarId ? `ToolBarToolTip(${toolBarId.trim()}, ${id}, ${text})` : `ToolBarToolTip(${id}, ${text})`;
}

function buildToolBarEntryLines(args: ToolBarEntryArgs, toolBarId?: string): string[] {
  switch (args.kind) {
    case TOOLBAR_ENTRY_KIND.ToolBarButton: {
      const lines = [buildToolBarImageButtonLine({ ...args, kind: TOOLBAR_ENTRY_KIND.ToolBarImageButton, toggle: false })];
      const text = args.textRaw;
      if (text?.length) {
        lines.push(buildToolBarToolTipLine(toolBarId, {
          kind: TOOLBAR_ENTRY_KIND.ToolBarToolTip,
          idRaw: args.idRaw,
          textRaw: text,
        }));
      }
      return lines;
    }
    case TOOLBAR_ENTRY_KIND.ToolBarImageButton:
      return [buildToolBarImageButtonLine(args)];
    case TOOLBAR_ENTRY_KIND.ToolBarSeparator:
      return ["ToolBarSeparator()"];
    case TOOLBAR_ENTRY_KIND.ToolBarToolTip:
      return [buildToolBarToolTipLine(toolBarId, args)];
    default:
      return [];
  }
}

function buildToolBarEntryText(args: ToolBarEntryArgs, toolBarId: string | undefined, indent = ""): string {
  return buildToolBarEntryLines(args, toolBarId)
    .map(line => `${indent}${line}`)
    .join("\n");
}

function buildToolBarEntryLine(args: ToolBarEntryArgs, toolBarId?: string): string {
  return buildToolBarEntryText(args, toolBarId);
}

function isToolBarButtonKind(kind: ToolBarEntryKind): boolean {
  return kind === TOOLBAR_ENTRY_KIND.ToolBarButton
    || kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton;
}

function isToolBarEntryCallNameForKind(callName: string, kind: ToolBarEntryKind): boolean {
  const normalizedCallName = callName.toLowerCase();
  if (normalizedCallName === kind.toLowerCase()) return true;
  return kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton && normalizedCallName === TOOLBAR_ENTRY_KIND.ToolBarStandardButton.toLowerCase();
}

function getToolBarEntryIdFromCall(call: PbCall): string | undefined {
  const params = splitParams(call.args);
  return params[0]?.trim();
}

function findToolBarToolTipCall(
  calls: PbCall[],
  toolBarId: string,
  entryIdRaw: string | undefined
): PbCall | undefined {
  const normalizedEntryId = entryIdRaw?.trim();
  if (!normalizedEntryId?.length) return undefined;

  return calls.find(call => {
    if (call.name.toLowerCase() !== TOOLBAR_ENTRY_KIND.ToolBarToolTip.toLowerCase()) return false;
    if (!isLineInCreateSection(calls, call.range.line, PB_CALL.createToolBar, toolBarId)) return false;

    const parts = splitParams(call.args);
    const buttonIdRaw = (parts.length >= 3 ? parts[1] : parts[0])?.trim() ?? "";
    return buttonIdRaw === normalizedEntryId;
  });
}

// -----------------------------------------------------------------------------
// Helpers for window id / pbAny patching
// -----------------------------------------------------------------------------

type LineBlock = ProcedureLineBlock;

function findNamedEnumerationBlock(document: vscode.TextDocument, enumName: string): LineBlock | undefined {
  const startRe = new RegExp(`^\\s*Enumeration\\s+${enumName}\\b`, "i");
  let startLine: number | undefined;

  for (let i = 0; i < document.lineCount; i++) {
    const t = document.lineAt(i).text;
    if (startLine === undefined) {
      if (startRe.test(t)) startLine = i;
      continue;
    }
    if (/^\s*EndEnumeration\b/i.test(t)) {
      return { startLine, endLine: i };
    }
  }
  return undefined;
}

function findWindowGlobalInsertLine(document: vscode.TextDocument): number {
  let firstGlobal = document.lineCount;
  let firstAnchor = document.lineCount;

  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i).text;
    if (firstGlobal === document.lineCount && /^\s*Global\b/i.test(line)) {
      firstGlobal = i;
    }
    if (firstAnchor === document.lineCount && isTopLevelGlobalAnchorLine(line)) {
      firstAnchor = i;
    }
  }

  return firstGlobal !== document.lineCount ? firstGlobal : firstAnchor;
}

function ensureWindowGlobalLine(edit: vscode.WorkspaceEdit, document: vscode.TextDocument, varName: string) {
  const re = new RegExp("^\\s*Global\\s+" + escapeRegExp(varName) + "(?:\\s|$)");
  for (let i = 0; i < document.lineCount; i++) {
    if (re.test(document.lineAt(i).text)) return;
  }

  const insertLine = findWindowGlobalInsertLine(document);
  const block = `Global ${varName}\n\n`;
  edit.insert(document.uri, new vscode.Position(insertLine, 0), block);
}

function removeGlobalLine(edit: vscode.WorkspaceEdit, document: vscode.TextDocument, varName: string) {
  const re = new RegExp("^\\s*Global\\s+" + escapeRegExp(varName) + "(?:\\s|$)");
  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i);
    if (!re.test(line.text)) continue;

    let end = line.rangeIncludingLineBreak.end;
    if (i + 1 < document.lineCount && document.lineAt(i + 1).text.trim() === "") {
      end = document.lineAt(i + 1).rangeIncludingLineBreak.end;
    }

    edit.delete(document.uri, new vscode.Range(line.range.start, end));
  }
}

function findWindowEnumInsertLine(document: vscode.TextDocument): number {
  return findTopLevelEnumInsertLine(
    document,
    [],
    [ENUM_NAMES.gadgets, ENUM_NAMES.menus, ENUM_NAMES.images, ENUM_NAMES.fonts]
  );
}

function ensureWindowEnumeration(edit: vscode.WorkspaceEdit, document: vscode.TextDocument, enumSymbol: string, enumValueRaw: string | undefined) {
  const block = findNamedEnumerationBlock(document, ENUM_NAMES.windows);
  if (block) {
    // Ensure the entry exists; if it exists, optionally update.
    const current = applyWindowEnumValuePatch(document, enumSymbol, enumValueRaw);
    if (current) {
      // Merge edits by replaying them into the passed edit (WorkspaceEdit has no merge API).
      // We'll just insert a replace into the same edit by re-running minimal logic here.
      for (let i = block.startLine + 1; i <= block.endLine - 1; i++) {
        const line = document.lineAt(i).text;
        const noComment = (line.split(";")[0] ?? "").trim();
        const m = /^(#\w+)\b/.exec(noComment);
        if (!m || m[1] !== enumSymbol) continue;
        const indent = getLineIndent(document, i);
        const newLine = enumValueRaw && enumValueRaw.trim().length
          ? `${indent}${enumSymbol}=${enumValueRaw.trim()}`
          : `${indent}${enumSymbol}`;
        edit.replace(document.uri, document.lineAt(i).range, newLine);
        return;
      }

      const insertLine = block.endLine;
      const indent = "  ";
      const newLine = enumValueRaw && enumValueRaw.trim().length
        ? `${indent}${enumSymbol}=${enumValueRaw.trim()}\n`
        : `${indent}${enumSymbol}\n`;
      edit.insert(document.uri, new vscode.Position(insertLine, 0), newLine);
      return;
    }
    return;
  }

  const anchor = findWindowEnumInsertLine(document);

  const entry = enumValueRaw && enumValueRaw.trim().length
    ? `  ${enumSymbol}=${enumValueRaw.trim()}`
    : `  ${enumSymbol}`;

  const blockText = `Enumeration FormWindow\n${entry}\nEndEnumeration\n\n`;
  edit.insert(document.uri, new vscode.Position(anchor, 0), blockText);
}

function getDocumentLines(document: vscode.TextDocument): string[] {
  const lines: string[] = [];

  for (let i = 0; i < document.lineCount; i++) {
    lines.push(document.lineAt(i).text);
  }

  return lines;
}

function findProcedureBlock(document: vscode.TextDocument, line: number) {
  return findProcedureBlockInLines(getDocumentLines(document), line);
}

function findProcedureBlockByName(document: vscode.TextDocument, procName: string) {
  return findProcedureBlockByNameInLines(getDocumentLines(document), procName);
}

function resolveWindowEventProcedureBlock(
  document: vscode.TextDocument,
  window: FormWindow,
  openCallLine: number
 ): { openProc: LineBlock; eventProc: LineBlock } | undefined {
  const openProc = findProcedureBlock(document, openCallLine);
  if (!openProc) return undefined;

  const eventProcName = `${window.variable}_Events`;
  const separateProc = findProcedureBlockByName(document, eventProcName);
  if (separateProc) {
    return { openProc, eventProc: separateProc };
  }

  return undefined;
}

function resolveWindowEventBootstrapContext(
  document: vscode.TextDocument,
  window: FormWindow,
  openCallLine: number
): { openProc: LineBlock; eventProc?: LineBlock } | undefined {
  const openProc = findProcedureBlock(document, openCallLine);
  if (!openProc) return undefined;

  const eventProcName = `${window.variable}_Events`;
  const eventProc = findProcedureBlockByName(document, eventProcName);
  return { openProc, eventProc };
}

function hasUnsupportedInlineWindowEventBlocks(document: vscode.TextDocument, openProc: LineBlock): boolean {
  return Boolean(findWindowEventMenuBlock(document, openProc) || findWindowEventGadgetBlock(document, openProc));
}

function replaceWordInRange(
  edit: vscode.WorkspaceEdit,
  document: vscode.TextDocument,
  fromLine: number,
  toLine: number,
  oldWord: string,
  newWord: string
) {
  const wordRe = new RegExp(`\\b${escapeRegExp(oldWord)}\\b`, "g");
  for (let i = fromLine; i <= toLine; i++) {
    const line = document.lineAt(i).text;
    if (!wordRe.test(line)) continue;
    const updated = line.replace(wordRe, newWord);
    edit.replace(document.uri, document.lineAt(i).range, updated);
  }
}

function toOpenProcName(windowName: string): string | undefined {
  const base = windowName.trim().replace(/^#/, "");
  if (!base.length) return undefined;

  // PureBasic identifiers: keep it conservative
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(base)) return undefined;

  return `Open${base}`;
}

function patchProcedureNameInBlock(
  edit: vscode.WorkspaceEdit,
  document: vscode.TextDocument,
  proc: { startLine: number; endLine: number } | undefined,
  oldProcName: string,
  newProcName: string
) {
  if (!proc) return;
  if (oldProcName === newProcName) return;

  const headerLine = document.lineAt(proc.startLine);
  const m = /^(\s*Procedure\s+)([A-Za-z_][A-Za-z0-9_]*)(\s*\()/.exec(headerLine.text);
  if (!m) return;

  if (m[2] !== oldProcName) return;

  const rebuilt = `${m[1]}${newProcName}${m[3]}`;
  edit.replace(document.uri, headerLine.range, headerLine.text.replace(/^(\s*Procedure\s+)([A-Za-z_][A-Za-z0-9_]*)(\s*\()/, rebuilt));
}

function patchProcedureCallsBestEffort(
  edit: vscode.WorkspaceEdit,
  document: vscode.TextDocument,
  calls: PbCall[],
  oldProcName: string,
  newProcName: string,
  scanRange?: ScanRange
) {
  if (oldProcName === newProcName) return;

  // Prefer callScanner data when available; fallback would be raw regex, but we avoid that here.
  const procedureHeaderRe = new RegExp(`^\\s*Procedure(?:\\.\\w+)?\\s+${escapeRegExp(oldProcName)}\\s*\\(`, "i");
  const procCalls = calls.filter(c => c.name === oldProcName);
  for (const c of procCalls) {
    if (procedureHeaderRe.test(document.lineAt(c.range.line).text)) continue;

    // Replace only the name token (or the full assignment line), keep any leading control-flow code intact.
    const indent = c.indent ?? getLineIndent(document, c.range.line);
    const rebuiltCall = `${newProcName}(${c.args})`;
    const updatedLine = c.assignedVar ? `${indent}${c.assignedVar} = ${rebuiltCall}` : rebuiltCall;
    const replaceStart = c.assignedVar ? c.range.lineStart : c.range.start;

    edit.replace(
      document.uri,
      new vscode.Range(document.positionAt(replaceStart), document.positionAt(c.range.end)),
      updatedLine
    );
  }
}

function replaceTokenGlobal(
  edit: vscode.WorkspaceEdit,
  document: vscode.TextDocument,
  oldToken: string,
  newToken: string
) {
  if (oldToken === newToken) return;

  // Word boundary replacement, keeps things like OpenOldEx intact.
  const re = new RegExp(`\\b${escapeRegExp(oldToken)}\\b`, "g");

  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i);
    if (!re.test(line.text)) continue;

    const updated = line.text.replace(re, newToken);
    if (updated !== line.text) {
      edit.replace(document.uri, line.range, updated);
    }
  }
}

function windowBaseFromSymbol(sym: string): string {
  return sym.trim().replace(/^#/, "");
}

function buildOpenProcName(base: string): string {
  return `Open${base}`;
}

function buildEventsProcName(base: string): string {
  return `${base}_Events`;
}

function buildResizeProcName(base: string): string {
  return `ResizeGadgets${base}`;
}

function renameProcedureHeaderGlobal(
  edit: vscode.WorkspaceEdit,
  document: vscode.TextDocument,
  oldProc: string,
  newProc: string
) {
  if (oldProc === newProc) return;

  const re = new RegExp(`^(\\s*Procedure(?:\\.\\w+)?\\s+)${escapeRegExp(oldProc)}(\\s*\\()`, "i");

  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i);
    if (!re.test(line.text)) continue;

    const updated = line.text.replace(re, `$1${newProc}$2`);
    edit.replace(document.uri, line.range, updated);
  }
}

function renameCallsGlobalByScanner(
  edit: vscode.WorkspaceEdit,
  document: vscode.TextDocument,
  calls: PbCall[],
  oldName: string,
  newName: string
) {
  if (oldName === newName) return;

  const procedureHeaderRe = new RegExp(`^\\s*Procedure(?:\\.\\w+)?\\s+${escapeRegExp(oldName)}\\s*\\(`, "i");

  for (const c of calls) {
    if (c.name !== oldName) continue;
    if (procedureHeaderRe.test(document.lineAt(c.range.line).text)) continue;

    const rebuilt = `${newName}(${c.args})`;
    const indent = c.indent ?? getLineIndent(document, c.range.line);
    const updated = c.assignedVar ? `${indent}${c.assignedVar} = ${rebuilt}` : `${indent}${rebuilt}`;

    const replaceStart = c.assignedVar ? c.range.lineStart : c.range.start;

    edit.replace(
      document.uri,
      new vscode.Range(document.positionAt(replaceStart), document.positionAt(c.range.end)),
      updated
    );
  }
}

function replaceEnumSymbolGlobal(
  edit: vscode.WorkspaceEdit,
  document: vscode.TextDocument,
  oldEnum: string,
  newEnum: string
) {
  if (oldEnum === newEnum) return;

  // Replace '#Old' as a token (avoid '#OldX'); allow punctuation after it.
  const re = new RegExp(`(^|[^A-Za-z0-9_])${escapeRegExp(oldEnum)}(?![A-Za-z0-9_])`, "g");

  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i);
    if (!re.test(line.text)) continue;

    const updated = line.text.replace(re, `$1${newEnum}`);
    if (updated !== line.text) {
      edit.replace(document.uri, line.range, updated);
    }
  }
}

function replaceCallArgsEdit(
  document: vscode.TextDocument,
  call: PbCall,
  params: string[]
): vscode.WorkspaceEdit {
  const rebuilt = `${call.name}(${params.join(", ")})`;
  const updated = call.assignedVar ? `${call.indent ?? ""}${call.assignedVar} = ${rebuilt}` : rebuilt;
  const replaceStart = call.assignedVar ? call.range.lineStart : call.range.start;

  const edit = new vscode.WorkspaceEdit();
  edit.replace(
    document.uri,
    new vscode.Range(document.positionAt(replaceStart), document.positionAt(call.range.end)),
    updated
  );
  return edit;
}

export function applyMovePatch(
  document: vscode.TextDocument,
  gadgetKey: string,
  x: number,
  y: number,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const parsed = parseFormDocument(document.getText());
  const customGadget = parsed.gadgets.find(entry => entry.id === gadgetKey && entry.kind === GADGET_KIND.CustomGadget);
  if (customGadget) {
    const nextGadget: Gadget = { ...customGadget, x: Math.trunc(x), y: Math.trunc(y) };
    return applyCustomGadgetCreationLineEdit(document, nextGadget, parsed.window);
  }

  const calls = scanDocumentCalls(document, scanRange);
  const call = findCallByStableKey(calls, gadgetKey);

  if (!call) return undefined;

  const params = splitParams(call.args);
  if (params.length < 3) return undefined;

  params[1] = String(Math.trunc(x));
  params[2] = String(Math.trunc(y));

  const edit = replaceCallArgsEdit(document, call, params);
  applyGadgetHeadPatch(edit, document);
  return edit;
}

export function applyRectPatch(
  document: vscode.TextDocument,
  gadgetKey: string,
  x: number,
  y: number,
  w: number,
  h: number,
  scanRange?: ScanRange,
  rawArgs?: { yRaw?: string }
): vscode.WorkspaceEdit | undefined {
  const parsed = parseFormDocument(document.getText());
  const customGadget = parsed.gadgets.find(entry => entry.id === gadgetKey && entry.kind === GADGET_KIND.CustomGadget);
  if (customGadget) {
    const nextGadget: Gadget = {
      ...customGadget,
      x: Math.trunc(x),
      y: Math.trunc(y),
      w: Math.trunc(w),
      h: Math.trunc(h)
    };
    return applyCustomGadgetCreationLineEdit(document, nextGadget, parsed.window);
  }

  const calls = scanDocumentCalls(document, scanRange);
  const call = findCallByStableKey(calls, gadgetKey);

  if (!call) return undefined;

  const params = splitParams(call.args);
  if (params.length < 5) return undefined;

  params[1] = String(Math.trunc(x));
  params[2] = rawArgs?.yRaw?.trim() || String(Math.trunc(y));
  params[3] = String(Math.trunc(w));
  params[4] = String(Math.trunc(h));

  const edit = replaceCallArgsEdit(document, call, params);
  applyGadgetHeadPatch(edit, document);
  return edit;
}

export type GadgetResizeRawArgs = {
  xRaw: string;
  yRaw: string;
  wRaw: string;
  hRaw: string;
};

export function applyResizeGadgetDelete(
  document: vscode.TextDocument,
  gadgetKey: string,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);
  const call = findCallByStableKey(calls, gadgetKey, name => name === "ResizeGadget");
  if (!call) return undefined;

  const edit = new vscode.WorkspaceEdit();
  edit.delete(document.uri, document.lineAt(call.range.line).rangeIncludingLineBreak);
  return edit;
}

export function applyResizeGadgetRawUpdate(
  document: vscode.TextDocument,
  gadgetKey: string,
  args: GadgetResizeRawArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);
  const call = findCallByStableKey(calls, gadgetKey, name => name === "ResizeGadget");
  if (!call) return undefined;

  const params = splitParams(call.args);
  if (params.length < 5) return undefined;

  const xRaw = normalizeOptionalRaw(args.xRaw);
  const yRaw = normalizeOptionalRaw(args.yRaw);
  const wRaw = normalizeOptionalRaw(args.wRaw);
  const hRaw = normalizeOptionalRaw(args.hRaw);
  if (!xRaw || !yRaw || !wRaw || !hRaw) return undefined;

  params[1] = xRaw;
  params[2] = yRaw;
  params[3] = wRaw;
  params[4] = hRaw;

  return replaceCallArgsEdit(document, call, params);
}

function findResizeDeclareLine(document: vscode.TextDocument, procName: string): number | undefined {
  const re = new RegExp(`^\\s*Declare\\s+${escapeRegExp(procName)}\\s*\\(\\s*\\)\\s*$`, "i");
  for (let i = 0; i < document.lineCount; i++) {
    if (re.test(document.lineAt(i).text)) return i;
  }
  return undefined;
}

function findResizeDeclareInsertLine(document: vscode.TextDocument): number {
  for (let i = 0; i < document.lineCount; i++) {
    const trimmed = document.lineAt(i).text.trim();
    if (/^Declare\b/i.test(trimmed) || /^XIncludeFile\b/i.test(trimmed) || /^Procedure(?:\.\w+)?\b/i.test(trimmed)) {
      return i;
    }
  }
  return document.lineCount;
}

function buildResizeGadgetCallLine(gadget: Gadget, args: GadgetResizeRawArgs): string | undefined {
  const firstParam = gadget.pbAny ? gadget.id?.trim() : gadget.firstParam?.trim();
  const xRaw = normalizeOptionalRaw(args.xRaw);
  const yRaw = normalizeOptionalRaw(args.yRaw);
  const wRaw = normalizeOptionalRaw(args.wRaw);
  const hRaw = normalizeOptionalRaw(args.hRaw);
  if (!firstParam || !xRaw || !yRaw || !wRaw || !hRaw) return undefined;
  return `  ResizeGadget(${firstParam}, ${xRaw}, ${yRaw}, ${wRaw}, ${hRaw})`;
}

function buildResizeProcedureBlock(procName: string, windowRef: string, resizeLine: string): string {
  return `Procedure ${procName}()
  Protected FormWindowWidth, FormWindowHeight
  FormWindowWidth = WindowWidth(${windowRef})
  FormWindowHeight = WindowHeight(${windowRef})
${resizeLine}
EndProcedure

`;
}

function ensureResizeProcedureDeclare(
  edit: vscode.WorkspaceEdit,
  document: vscode.TextDocument,
  procName: string
): void {
  if (findResizeDeclareLine(document, procName) !== undefined) return;

  const insertLine = findResizeDeclareInsertLine(document);
  const nextTrimmed = insertLine < document.lineCount ? document.lineAt(insertLine).text.trim() : "";
  const suffix = /^Procedure(?:\.\w+)?\b/i.test(nextTrimmed) ? "\n\n" : "\n";
  edit.insert(document.uri, new vscode.Position(insertLine, 0), `Declare ${procName}()${suffix}`);
}

function ensureResizeProcedureBlock(
  edit: vscode.WorkspaceEdit,
  document: vscode.TextDocument,
  calls: PbCall[],
  window: FormWindow,
  gadget: Gadget,
  args: GadgetResizeRawArgs,
  procName: string
): void {
  const resizeLine = buildResizeGadgetCallLine(gadget, args);
  if (!resizeLine) return;

  const existingProc = findProcedureBlockByName(document, procName);
  if (existingProc) {
    const existingResizeCalls = calls.filter(c => c.name === "ResizeGadget" && c.range.line >= existingProc.startLine && c.range.line <= existingProc.endLine);
    const insertLine = existingResizeCalls.length
      ? existingResizeCalls[existingResizeCalls.length - 1].range.line + 1
      : existingProc.endLine;
    edit.insert(document.uri, new vscode.Position(insertLine, 0), `${resizeLine}\n`);
    return;
  }

  const windowRef = window.pbAny ? (window.id?.trim() ?? "") : window.firstParam.trim();
  if (!windowRef) return;

  const openCall = findCallByStableKey(calls, window.id, name => name === "OpenWindow");
  if (!openCall) return;
  const openProc = findProcedureBlock(document, openCall.range.line);
  if (!openProc) return;

  const insertLine = skipBlankLines(document, openProc.endLine + 1);
  edit.insert(document.uri, new vscode.Position(insertLine, 0), `\n${buildResizeProcedureBlock(procName, windowRef, resizeLine)}`);
}

function ensureResizeEventCase(
  edit: vscode.WorkspaceEdit,
  document: vscode.TextDocument,
  window: FormWindow,
  calls: PbCall[],
  procName: string
): void {
  const openCall = findCallByStableKey(calls, window.id, name => name === "OpenWindow");
  if (!openCall) return;

  const context = resolveWindowEventProcedureBlock(document, window, openCall.range.line);
  if (!context) return;

  const block = findWindowEventSelectBlock(document, context.eventProc);
  // Match the original Form Designer output: ResizeGadgets...() is generated independently,
  // but the SizeWindow hook is emitted only when a window event Select block already exists.
  if (!block) return;

  const procCall = `${procName}()`;
  const sizeBranch = findEventCaseBranch(document, { startLine: block.selectLine, endLine: block.endLine }, caseRaw => caseRaw.trim().toLowerCase() === "#pb_event_sizewindow");
  if (sizeBranch?.procLine !== undefined) {
    appendWorkspaceEdit(edit, replaceEventProcLine(document, sizeBranch.procLine, procCall));
    return;
  }
  if (sizeBranch) {
    appendWorkspaceEdit(edit, insertEventProcLineAfterCase(document, sizeBranch.caseLine, procCall));
    return;
  }

  let insertLine = block.endLine;
  let firstCaseLine: number | undefined;
  for (let i = block.selectLine + 1; i < block.endLine; i++) {
    const line = document.lineAt(i).text.split(";")[0]?.trim() ?? "";
    if (/^Case\b/i.test(line)) {
      firstCaseLine = i;
      break;
    }
  }
  if (typeof firstCaseLine === "number") {
    insertLine = firstCaseLine;
  }

  appendWorkspaceEdit(edit, insertEventCaseBranch(document, insertLine, block.selectLine, "#PB_Event_SizeWindow", procCall));
}

function cleanupResizeScaffoldingIfEmpty(
  edit: vscode.WorkspaceEdit,
  document: vscode.TextDocument,
  window: FormWindow,
  calls: PbCall[],
  removedCallLine: number,
  procName: string
): void {
  const remainingResizeCalls = calls.filter(c => c.name === "ResizeGadget" && c.range.line !== removedCallLine);
  if (remainingResizeCalls.length > 0) return;

  const declareLine = findResizeDeclareLine(document, procName);
  if (declareLine !== undefined) {
    const deleteStart = declareLine > 0 && isBlankLine(document, declareLine - 1) && declareLine + 1 < document.lineCount && isBlankLine(document, declareLine + 1)
      ? declareLine - 1
      : declareLine;
    edit.delete(
      document.uri,
      new vscode.Range(
        new vscode.Position(deleteStart, 0),
        document.lineAt(declareLine).rangeIncludingLineBreak.end
      )
    );
  }

  const procBlock = findProcedureBlockByName(document, procName);
  if (procBlock) {
    const deleteStart = procBlock.startLine > 0 && isBlankLine(document, procBlock.startLine - 1)
      ? procBlock.startLine - 1
      : procBlock.startLine;
    edit.delete(
      document.uri,
      new vscode.Range(
        new vscode.Position(deleteStart, 0),
        new vscode.Position(procBlock.endLine + 1, 0)
      )
    );
  }

  const openCall = findCallByStableKey(calls, window.id, name => name === "OpenWindow");
  if (!openCall) return;

  const context = resolveWindowEventProcedureBlock(document, window, openCall.range.line);
  if (!context) return;

  const block = findWindowEventSelectBlock(document, context.eventProc);
  if (!block) return;

  const sizeBranch = findEventCaseBranch(document, { startLine: block.selectLine, endLine: block.endLine }, caseRaw => caseRaw.trim().toLowerCase() === "#pb_event_sizewindow");
  if (sizeBranch) {
    appendWorkspaceEdit(edit, deleteEventCaseBranch(document, sizeBranch));
  }
}

export function applyResizeGadgetMutation(
  document: vscode.TextDocument,
  gadgetKey: string,
  args: GadgetResizeRawArgs & { deleteResize?: boolean },
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const parsed = parseFormDocument(document.getText());
  const gadget = parsed.gadgets.find(entry => entry.id === gadgetKey);
  const window = parsed.window;
  if (!gadget || !window?.variable) return undefined;

  const procName = buildResizeProcName(window.variable);
  const calls = scanDocumentCalls(document, scanRange);
  const existingCall = findCallByStableKey(calls, gadgetKey, name => name === "ResizeGadget");

  if (args.deleteResize) {
    if (!existingCall) return undefined;
    const remainingResizeCalls = calls.filter(c => c.name === "ResizeGadget" && c.range.line !== existingCall.range.line);
    const edit = remainingResizeCalls.length > 0
      ? applyResizeGadgetDelete(document, gadgetKey, scanRange)
      : new vscode.WorkspaceEdit();
    if (!edit) return undefined;
    if (remainingResizeCalls.length > 0) {
      return edit;
    }
    cleanupResizeScaffoldingIfEmpty(edit, document, window, calls, existingCall.range.line, procName);
    return edit;
  }

  if (existingCall) {
    return applyResizeGadgetRawUpdate(document, gadgetKey, args, scanRange);
  }

  const resizeLine = buildResizeGadgetCallLine(gadget, args);
  if (!resizeLine) return undefined;

  const edit = new vscode.WorkspaceEdit();
  ensureResizeProcedureDeclare(edit, document, procName);
  ensureResizeProcedureBlock(edit, document, calls, window, gadget, args, procName);
  ensureResizeEventCase(edit, document, window, calls, procName);
  return edit;
}

export function applyWindowRectPatch(
  document: vscode.TextDocument,
  windowKey: string,
  x: number,
  y: number,
  w: number,
  h: number,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);
  const call = findCallByStableKey(calls, windowKey, name => name === "OpenWindow");

  if (!call) return undefined;

  const params = splitParams(call.args);
  if (params.length < 5) return undefined;

  // PureBasic Form Designer pattern:
  //   Procedure OpenX(x=..., y=..., width=..., height=...)
  //     OpenWindow(..., x, y, width, height, ...)
  // In this case, patch the procedure defaults instead of hardcoding literals into OpenWindow().
  const p1 = (params[1] ?? "").trim().toLowerCase();
  const p2 = (params[2] ?? "").trim().toLowerCase();
  const p3 = (params[3] ?? "").trim().toLowerCase();
  const p4 = (params[4] ?? "").trim().toLowerCase();
  const usesProcDefaults = p1 === "x" && p2 === "y" && p3 === "width" && p4 === "height";
  if (usesProcDefaults) {
    const procEdit = tryPatchProcedureDefaults(document, call.range.line, {
      x: String(Math.trunc(x)),
      y: String(Math.trunc(y)),
      width: String(Math.trunc(w)),
      height: String(Math.trunc(h))
    });
    if (procEdit) return procEdit;
  }

  params[1] = String(Math.trunc(x));
  params[2] = String(Math.trunc(y));
  params[3] = String(Math.trunc(w));
  params[4] = String(Math.trunc(h));

  return replaceCallArgsEdit(document, call, params);
}


export function applyWindowOpenArgsUpdate(
  document: vscode.TextDocument,
  windowKey: string,
  args: WindowOpenArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);
  const call = findCallByStableKey(calls, windowKey, name => name === "OpenWindow");

  if (!call) return undefined;

  const params = splitParams(call.args);
  if (params.length < 6) return undefined;

  const hasLayoutUpdate = args.xRaw !== undefined || args.yRaw !== undefined || args.wRaw !== undefined || args.hRaw !== undefined;
  if (hasLayoutUpdate) {
    const xRaw = normalizeOptionalRaw(args.xRaw);
    const yRaw = normalizeOptionalRaw(args.yRaw);
    const wRaw = normalizeOptionalRaw(args.wRaw);
    const hRaw = normalizeOptionalRaw(args.hRaw);

    const p1 = (params[1] ?? "").trim().toLowerCase();
    const p2 = (params[2] ?? "").trim().toLowerCase();
    const p3 = (params[3] ?? "").trim().toLowerCase();
    const p4 = (params[4] ?? "").trim().toLowerCase();
    const usesProcDefaults = p1 === "x" && p2 === "y" && p3 === "width" && p4 === "height";

    if (usesProcDefaults) {
      const procUpdates: Record<string, string> = {};
      if (args.xRaw !== undefined) {
        if (!xRaw) return undefined;
        procUpdates.x = xRaw;
      }
      if (args.yRaw !== undefined) {
        if (!yRaw) return undefined;
        procUpdates.y = yRaw;
      }
      if (args.wRaw !== undefined) {
        if (!wRaw) return undefined;
        procUpdates.width = wRaw;
      }
      if (args.hRaw !== undefined) {
        if (!hRaw) return undefined;
        procUpdates.height = hRaw;
      }
      return Object.keys(procUpdates).length ? tryPatchProcedureDefaults(document, call.range.line, procUpdates) : undefined;
    }

    if (args.xRaw !== undefined) {
      if (!xRaw) return undefined;
      params[1] = xRaw;
    }
    if (args.yRaw !== undefined) {
      if (!yRaw) return undefined;
      params[2] = yRaw;
    }
    if (args.wRaw !== undefined) {
      if (!wRaw) return undefined;
      params[3] = wRaw;
    }
    if (args.hRaw !== undefined) {
      if (!hRaw) return undefined;
      params[4] = hRaw;
    }

    return replaceCallArgsEdit(document, call, params);
  }

  const captionRaw = normalizeOptionalRaw(args.captionRaw) ?? (params[5]?.trim().length ? params[5].trim() : '""');
  const parentRaw = normalizeOptionalRaw(args.parentRaw);
  let flagsExpr = normalizeOptionalRaw(args.flagsExpr);

  if (parentRaw && !flagsExpr) {
    flagsExpr = "0";
  }

  params[5] = captionRaw;
  params[6] = flagsExpr ?? "";
  params[7] = parentRaw ?? "";

  while (params.length > 6 && !(params[params.length - 1]?.trim().length)) {
    params.pop();
  }

  return replaceCallArgsEdit(document, call, params);
}

type GadgetCtorLayout = {
  minParamCount: number;
  textIndex?: number;
  imageIndex?: number;
  minIndex?: number;
  maxIndex?: number;
  gadget1Index?: number;
  gadget2Index?: number;
  flagsIndex?: number;
};

function getGadgetCtorLayout(name: string): GadgetCtorLayout | undefined {
  switch (name) {
    case GADGET_KIND.ButtonGadget:
    case GADGET_KIND.CheckBoxGadget:
    case GADGET_KIND.ExplorerComboGadget:
    case GADGET_KIND.ExplorerListGadget:
    case GADGET_KIND.ExplorerTreeGadget:
    case GADGET_KIND.FrameGadget:
    case GADGET_KIND.StringGadget:
    case GADGET_KIND.TextGadget:
    case GADGET_KIND.WebGadget:
      return { minParamCount: 6, textIndex: 5, flagsIndex: 6 };

    case GADGET_KIND.ButtonImageGadget:
    case GADGET_KIND.ImageGadget:
      return { minParamCount: 6, imageIndex: 5, flagsIndex: 6 };

    case GADGET_KIND.CalendarGadget:
      return { minParamCount: 6, flagsIndex: 6 };

    case GADGET_KIND.CanvasGadget:
    case GADGET_KIND.ComboBoxGadget:
    case GADGET_KIND.ContainerGadget:
    case GADGET_KIND.EditorGadget:
    case GADGET_KIND.ListViewGadget:
    case GADGET_KIND.OpenGLGadget:
    case GADGET_KIND.TreeGadget:
    case GADGET_KIND.WebViewGadget:
      return { minParamCount: 5, flagsIndex: 5 };

    case GADGET_KIND.DateGadget:
    case GADGET_KIND.HyperLinkGadget:
    case GADGET_KIND.ListIconGadget:
      return { minParamCount: 7, textIndex: 5, flagsIndex: 7 };

    case GADGET_KIND.ProgressBarGadget:
    case GADGET_KIND.SpinGadget:
    case GADGET_KIND.TrackBarGadget:
      return { minParamCount: 7, minIndex: 5, maxIndex: 6, flagsIndex: 7 };

    case GADGET_KIND.ScrollBarGadget:
    case GADGET_KIND.ScrollAreaGadget:
      return { minParamCount: 8, minIndex: 5, maxIndex: 6, flagsIndex: 8 };

    case GADGET_KIND.SplitterGadget:
      return { minParamCount: 7, gadget1Index: 5, gadget2Index: 6, flagsIndex: 7 };

    case GADGET_KIND.OptionGadget:
      return { minParamCount: 6, textIndex: 5 };

    default:
      return undefined;
  }
}

type GadgetInsertExtraArgs = {
  gadget1Id?: string;
  gadget2Id?: string;
};

type GadgetInsertDefaults = {
  pbAny?: boolean;
};

type GadgetInsertArgs = {
  kind: InsertableGadgetKind;
  x: number;
  y: number;
  yRaw?: string;
  parentId?: string;
  parentItem?: number;
};

type GadgetInsertAnchor = {
  insertLine: number;
  indent: string;
};

function buildGadgetListParentIds(gadgets: readonly Gadget[]): Set<string> {
  const ids = new Set<string>();
  for (const gadget of gadgets) {
    if (canHostInsertedGadgets(gadget)) ids.add(gadget.id);
  }
  return ids;
}

function isImplicitGadgetListStarterCall(call: PbCall, gadgetListParentIds: ReadonlySet<string>): boolean {
  if (!/gadget$/i.test(call.name)) return false;
  const key = stableKey(call.assignedVar, splitParams(call.args));
  return !!(key && gadgetListParentIds.has(key));
}

function isGadgetSectionCallName(nameLower: string): boolean {
  return /gadget$/i.test(nameLower)
    || nameLower === "closegadgetlist"
    || nameLower === "opengadgetlist"
    || nameLower === "addgadgetitem"
    || nameLower === "addgadgetcolumn"
    || nameLower === "resizegadget"
    || GADGET_PROPERTY_NAMES.has(nameLower);
}

function buildInsertedGadgetStub(kind: InsertableGadgetKind, identity: ReturnType<typeof buildInsertedGadgetIdentity>): Gadget {
  return {
    id: identity.id,
    kind,
    pbAny: identity.pbAny,
    variable: identity.variable,
    firstParam: identity.firstParam,
    parentId: undefined,
    parentItem: undefined,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  };
}

function buildInsertedGadgetBlock(
  args: GadgetInsertArgs,
  identity: ReturnType<typeof buildInsertedGadgetIdentity>,
  indent: string,
  extraArgs?: GadgetInsertExtraArgs
): string | undefined {
  const x = String(Math.trunc(args.x));
  const y = args.yRaw?.trim() || String(Math.trunc(args.y));
  const w = "100";
  const h = "25";
  const idRaw = identity.idRaw;
  const prefix = identity.assignedVar ? `${indent}${identity.assignedVar} = ` : indent;
  const callbackRaw = `@Callback_${identity.name}()`;

  switch (args.kind) {
    case GADGET_KIND.ButtonGadget:
      return `${prefix}ButtonGadget(${idRaw}, ${x}, ${y}, ${w}, ${h}, "")
`;
    case GADGET_KIND.ButtonImageGadget:
      return `${prefix}ButtonImageGadget(${idRaw}, ${x}, ${y}, ${w}, ${h}, 0)
`;
    case GADGET_KIND.StringGadget:
      return `${prefix}StringGadget(${idRaw}, ${x}, ${y}, ${w}, ${h}, "")
`;
    case GADGET_KIND.TextGadget:
      return `${prefix}TextGadget(${idRaw}, ${x}, ${y}, ${w}, ${h}, "")
`;
    case GADGET_KIND.CheckBoxGadget:
      return `${prefix}CheckBoxGadget(${idRaw}, ${x}, ${y}, ${w}, ${h}, "")
`;
    case GADGET_KIND.OptionGadget:
      return `${prefix}OptionGadget(${idRaw}, ${x}, ${y}, ${w}, ${h}, "")
`;
    case GADGET_KIND.FrameGadget:
      return `${prefix}FrameGadget(${idRaw}, ${x}, ${y}, ${w}, ${h}, "")
`;
    case GADGET_KIND.ComboBoxGadget:
      return `${prefix}ComboBoxGadget(${idRaw}, ${x}, ${y}, ${w}, ${h})
`;
    case GADGET_KIND.ListViewGadget:
      return `${prefix}ListViewGadget(${idRaw}, ${x}, ${y}, ${w}, ${h})
`;
    case GADGET_KIND.ListIconGadget:
      return `${prefix}ListIconGadget(${idRaw}, ${x}, ${y}, ${w}, ${h}, "Column 1", 100)
`;
    case GADGET_KIND.TreeGadget:
      return `${prefix}TreeGadget(${idRaw}, ${x}, ${y}, ${w}, ${h})
`;
    case GADGET_KIND.EditorGadget:
      return `${prefix}EditorGadget(${idRaw}, ${x}, ${y}, ${w}, ${h})
`;
    case GADGET_KIND.SpinGadget:
      return `${prefix}SpinGadget(${idRaw}, ${x}, ${y}, ${w}, ${h}, 0, 0)
`;
    case GADGET_KIND.TrackBarGadget:
      return `${prefix}TrackBarGadget(${idRaw}, ${x}, ${y}, ${w}, ${h}, 0, 0)
`;
    case GADGET_KIND.ProgressBarGadget:
      return `${prefix}ProgressBarGadget(${idRaw}, ${x}, ${y}, ${w}, ${h}, 0, 0)
`;
    case GADGET_KIND.ImageGadget:
      return `${prefix}ImageGadget(${idRaw}, ${x}, ${y}, ${w}, ${h}, 0)
`;
    case GADGET_KIND.HyperLinkGadget:
      return `${prefix}HyperLinkGadget(${idRaw}, ${x}, ${y}, ${w}, ${h}, "", 0)
`;
    case GADGET_KIND.CalendarGadget:
      return `${prefix}CalendarGadget(${idRaw}, ${x}, ${y}, ${w}, ${h}, 0)
`;
    case GADGET_KIND.DateGadget:
      return `${prefix}DateGadget(${idRaw}, ${x}, ${y}, ${w}, ${h}, "", 0)
`;
    case GADGET_KIND.ContainerGadget:
      return `${prefix}ContainerGadget(${idRaw}, ${x}, ${y}, ${w}, ${h})
${indent}CloseGadgetList()
`;
    case GADGET_KIND.PanelGadget:
      return `${prefix}PanelGadget(${idRaw}, ${x}, ${y}, ${w}, ${h})
${indent}AddGadgetItem(${identity.id}, -1, "Tab 1")
${indent}CloseGadgetList()
`;
    case GADGET_KIND.ScrollAreaGadget:
      return `${prefix}ScrollAreaGadget(${idRaw}, ${x}, ${y}, ${w}, ${h}, 300, 225, 1)
${indent}CloseGadgetList()
`;
    case GADGET_KIND.SplitterGadget: {
      const gadget1Raw = extraArgs?.gadget1Id?.trim();
      const gadget2Raw = extraArgs?.gadget2Id?.trim();
      if (!gadget1Raw || !gadget2Raw || gadget1Raw === gadget2Raw) return undefined;
      return `${prefix}SplitterGadget(${idRaw}, ${x}, ${y}, ${w}, ${h}, ${gadget1Raw}, ${gadget2Raw})
${indent}SetGadgetState(${identity.id}, 12)
`;
    }
    case GADGET_KIND.WebViewGadget:
      return `${prefix}WebViewGadget(${idRaw}, ${x}, ${y}, ${w}, ${h})
`;
    case GADGET_KIND.WebGadget:
      return `${prefix}WebGadget(${idRaw}, ${x}, ${y}, ${w}, ${h}, "")
`;
    case GADGET_KIND.OpenGLGadget:
      return `${prefix}OpenGLGadget(${idRaw}, ${x}, ${y}, ${w}, ${h})
`;
    case GADGET_KIND.CanvasGadget:
      return `${prefix}CanvasGadget(${idRaw}, ${x}, ${y}, ${w}, ${h})
`;
    case GADGET_KIND.ExplorerTreeGadget:
      return `${prefix}ExplorerTreeGadget(${idRaw}, ${x}, ${y}, ${w}, ${h}, "")
`;
    case GADGET_KIND.ExplorerListGadget:
      return `${prefix}ExplorerListGadget(${idRaw}, ${x}, ${y}, ${w}, ${h}, "")
`;
    case GADGET_KIND.ExplorerComboGadget:
      return `${prefix}ExplorerComboGadget(${idRaw}, ${x}, ${y}, ${w}, ${h}, "")
`;
    case GADGET_KIND.IPAddressGadget:
      return `${prefix}IPAddressGadget(${idRaw}, ${x}, ${y}, ${w}, ${h})
`;
    case GADGET_KIND.ScrollBarGadget:
      return `${prefix}ScrollBarGadget(${idRaw}, ${x}, ${y}, ${w}, ${h}, 0, 0, 0)
`;
    case GADGET_KIND.ScintillaGadget:
      return `${prefix}ScintillaGadget(${idRaw}, ${x}, ${y}, ${w}, ${h}, ${callbackRaw})
`;
  }
}

function applyGadgetHeadPatchForGadgets(
  edit: vscode.WorkspaceEdit,
  document: vscode.TextDocument,
  gadgets: Gadget[]
): void {
  const gadgetGlobalBlock = findGadgetGlobalBlock(document, gadgets);
  applyOptionalBlockPatch(
    edit,
    document,
    gadgetGlobalBlock,
    findGadgetGlobalInsertLine(document),
    buildGadgetGlobalBlock(gadgets)
  );

  const gadgetEnumBlock = findNamedEnumerationBlock(document, ENUM_NAMES.gadgets);
  applyOptionalBlockPatch(
    edit,
    document,
    gadgetEnumBlock ? expandBlockWithTrailingBlank(document, gadgetEnumBlock) : undefined,
    findGadgetEnumInsertLine(document),
    buildGadgetEnumBlock(gadgets)
  );
}

function findTopLevelGadgetInsertAnchor(
  document: vscode.TextDocument,
  calls: PbCall[],
  openCall: PbCall,
  proc: LineBlock
): GadgetInsertAnchor {
  const relevant = calls.filter(call => call.range.line >= openCall.range.line && call.range.line <= proc.endLine)
    .filter(call => isGadgetSectionCallName(call.name.toLowerCase()));
  const baseLine = relevant.length ? relevant[relevant.length - 1].range.line : openCall.range.line;
  return {
    insertLine: baseLine + 1,
    indent: getLineIndent(document, baseLine),
  };
}

function findChildSectionInsertAnchor(
  document: vscode.TextDocument,
  calls: PbCall[],
  proc: LineBlock,
  parent: Gadget,
  gadgetListParentIds: ReadonlySet<string>,
  parentItem?: number
): GadgetInsertAnchor | undefined {
  const parentId = parent.id;
  const parentCreate = findCallByStableKey(calls, parentId, name => /gadget$/i.test(name));
  if (!parentCreate) return undefined;

  if (parent.kind === GADGET_KIND.PanelGadget) {
    const targetItem = typeof parentItem === "number" ? parentItem : 0;
    let depth = 1;
    let panelItemIndex = -1;
    for (const call of calls) {
      if (call.range.line <= parentCreate.range.line) continue;
      if (call.range.line > proc.endLine) break;
      const nameLower = call.name.toLowerCase();
      if (nameLower === "closegadgetlist") {
        depth -= 1;
        if (depth === 0) {
          return { insertLine: call.range.line, indent: getLineIndent(document, call.range.line) };
        }
        continue;
      }
      if (depth === 1 && nameLower === "addgadgetitem" && firstParamOfCall(call.args) === parentId) {
        panelItemIndex += 1;
        if (panelItemIndex > targetItem) {
          return { insertLine: call.range.line, indent: getLineIndent(document, call.range.line) };
        }
      }
      if (isImplicitGadgetListStarterCall(call, gadgetListParentIds)) {
        depth += 1;
      }
    }
    return undefined;
  }

  if (canHostInsertedGadgets(parent)) {
    let depth = 1;
    for (const call of calls) {
      if (call.range.line <= parentCreate.range.line) continue;
      if (call.range.line > proc.endLine) break;
      const nameLower = call.name.toLowerCase();
      if (nameLower === "closegadgetlist") {
        depth -= 1;
        if (depth === 0) {
          return { insertLine: call.range.line, indent: getLineIndent(document, call.range.line) };
        }
        continue;
      }
      if (isImplicitGadgetListStarterCall(call, gadgetListParentIds)) {
        depth += 1;
      }
    }
  }

  return undefined;
}


function stripPureBasicHash(value: string | undefined): string {
  return (value ?? "").trim().replace(/^#/, "");
}

function getDuplicateVariablePrefix(name: string): string {
  const clean = stripPureBasicHash(name);
  if (!clean.includes("_")) return `${clean}_`;
  return clean.slice(0, clean.lastIndexOf("_") + 1);
}

function buildDuplicatedGadgetIdentity(gadget: Gadget, gadgets: readonly Gadget[]): ReturnType<typeof buildInsertedGadgetIdentity> {
  const existing = new Set<string>();
  for (const entry of gadgets) {
    for (const candidate of [entry.variable, entry.firstParam, entry.id]) {
      const clean = stripPureBasicHash(candidate);
      if (clean.length) existing.add(clean);
    }
  }

  const sourceName = gadget.variable || gadget.firstParam || gadget.id;
  const prefix = getDuplicateVariablePrefix(sourceName);
  let nextIndex = 1;
  while (existing.has(`${prefix}${nextIndex}`)) {
    nextIndex += 1;
  }

  const name = `${prefix}${nextIndex}`;
  if (gadget.pbAny) {
    return {
      name,
      id: name,
      idRaw: PB_ANY,
      firstParam: PB_ANY,
      variable: name,
      assignedVar: name,
      pbAny: true,
    };
  }

  const enumId = `#${name}`;
  return {
    name,
    id: enumId,
    idRaw: enumId,
    firstParam: enumId,
    variable: name,
    pbAny: false,
  };
}

function canPatchSimpleGadgetDuplicate(gadget: Gadget): boolean {
  return isInsertableGadgetKind(gadget.kind)
    && gadget.kind !== GADGET_KIND.SplitterGadget
    && !gadget.splitterId
    && !gadget.resizeSource
    && !canHostInsertedGadgets(gadget);
}

function buildDuplicatedCallLine(
  document: vscode.TextDocument,
  call: PbCall,
  sourceGadget: Gadget,
  identity: ReturnType<typeof buildInsertedGadgetIdentity>,
  isCreateCall: boolean
): string | undefined {
  const params = splitParams(call.args);
  if (!params.length) return undefined;

  const indent = getLineIndent(document, call.range.line);
  if (isCreateCall) {
    if (params.length < 5) return undefined;
    params[0] = identity.idRaw;
    params[1] = String(Math.trunc(sourceGadget.x));
    params[2] = String(Math.trunc(sourceGadget.y + sourceGadget.h));
    params[3] = String(Math.trunc(sourceGadget.w));
    params[4] = String(Math.trunc(sourceGadget.h));
    const prefix = identity.assignedVar ? `${indent}${identity.assignedVar} = ` : indent;
    return `${prefix}${call.name}(${params.join(", ")})`;
  }

  params[0] = identity.id;
  return `${indent}${call.name}(${params.join(", ")})`;
}

export function applyGadgetDuplicate(
  document: vscode.TextDocument,
  gadgetKey: string,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const parsed = parseFormDocument(document.getText());
  const sourceGadget = parsed.gadgets.find(entry => entry.id === gadgetKey);
  if (!sourceGadget || !canPatchSimpleGadgetDuplicate(sourceGadget)) return undefined;

  const calls = scanDocumentCalls(document, scanRange);
  const createCall = findCallByStableKey(calls, gadgetKey, name => /gadget$/i.test(name));
  if (!createCall) return undefined;

  const proc = findProcedureBlock(document, createCall.range.line);
  if (!proc) return undefined;

  const identity = buildDuplicatedGadgetIdentity(sourceGadget, parsed.gadgets);
  const relatedCalls = calls
    .filter(call => call.range.line >= proc.startLine && call.range.line <= proc.endLine)
    .filter(call => {
      if (call.range.line === createCall.range.line) return true;
      const nameLower = call.name.toLowerCase();
      if (nameLower !== "addgadgetitem"
        && nameLower !== "addgadgetcolumn"
        && !GADGET_PROPERTY_NAMES.has(nameLower)) {
        return false;
      }
      return firstParamOfCall(call.args) === sourceGadget.id;
    })
    .sort((a, b) => a.range.line - b.range.line);

  const duplicatedLines: string[] = [];
  for (const call of relatedCalls) {
    const line = buildDuplicatedCallLine(document, call, sourceGadget, identity, call.range.line === createCall.range.line);
    if (!line) return undefined;
    duplicatedLines.push(line);
  }
  if (!duplicatedLines.length) return undefined;

  const insertLine = Math.max(...relatedCalls.map(call => call.range.line)) + 1;
  const edit = new vscode.WorkspaceEdit();
  edit.insert(document.uri, new vscode.Position(insertLine, 0), `${duplicatedLines.join("\n")}\n`);
  applyGadgetHeadPatchForGadgets(edit, document, [...parsed.gadgets, buildInsertedGadgetStub(sourceGadget.kind as InsertableGadgetKind, identity)]);
  return edit;
}

export function applyGadgetInsert(
  document: vscode.TextDocument,
  kind: string,
  x: number,
  y: number,
  parentId?: string,
  parentItem?: number,
  scanRange?: ScanRange,
  extraArgs?: GadgetInsertExtraArgs,
  insertDefaults?: GadgetInsertDefaults,
  yRaw?: string,
): vscode.WorkspaceEdit | undefined {
  if (!isInsertableGadgetKind(kind)) return undefined;

  const parsed = parseFormDocument(document.getText());
  const windowKey = parsed.window?.id;
  if (!windowKey) return undefined;

  const calls = scanDocumentCalls(document, scanRange);
  const openCall = findCallByStableKey(calls, windowKey, name => name === "OpenWindow");
  if (!openCall) return undefined;

  const proc = findProcedureBlock(document, openCall.range.line);
  if (!proc) return undefined;

  let splitterSourceGadget1: Gadget | undefined;
  let splitterSourceGadget2: Gadget | undefined;
  let splitterSourceParentId: string | undefined;
  let splitterSourceParentItem: number | undefined;

  if (kind === GADGET_KIND.SplitterGadget) {
    const gadget1 = parsed.gadgets.find(entry => entry.id === extraArgs?.gadget1Id);
    const gadget2 = parsed.gadgets.find(entry => entry.id === extraArgs?.gadget2Id);
    if (!gadget1 || !gadget2 || gadget1.id === gadget2.id) return undefined;
    if (gadget1.splitterId || gadget2.splitterId) return undefined;
    const sourceParentId = gadget1.parentId;
    const sourceParentItem = gadget1.parentItem;
    if (sourceParentId !== gadget2.parentId || sourceParentItem !== gadget2.parentItem) return undefined;
    splitterSourceGadget1 = gadget1;
    splitterSourceGadget2 = gadget2;
    splitterSourceParentId = sourceParentId;
    splitterSourceParentItem = sourceParentItem;
  }

  const pbAny = shouldInsertGadgetAsPbAny(parsed.gadgets, insertDefaults?.pbAny);
  const identity = buildInsertedGadgetIdentity(kind, parsed.gadgets, pbAny);
  const gadgetListParentIds = buildGadgetListParentIds(parsed.gadgets);
  const anchor = parentId
    ? (() => {
        const parent = parsed.gadgets.find(entry => entry.id === parentId);
        if (!parent || !canHostInsertedGadgets(parent)) return undefined;
        return findChildSectionInsertAnchor(document, calls, proc, parent, gadgetListParentIds, parentItem);
      })()
    : findTopLevelGadgetInsertAnchor(document, calls, openCall, proc);
  if (!anchor) return undefined;

  const block = buildInsertedGadgetBlock({ kind, x, y, yRaw, parentId, parentItem }, identity, anchor.indent, extraArgs);
  if (!block) return undefined;
  const edit = new vscode.WorkspaceEdit();
  const anchorPos = new vscode.Position(Math.min(document.lineCount, anchor.insertLine), 0);

  if (kind === GADGET_KIND.SplitterGadget && splitterSourceGadget1 && splitterSourceGadget2) {
    const targetParentId = parentId ?? undefined;
    const targetParentItem = parentItem ?? undefined;
    const needsReparentMove = targetParentId !== splitterSourceParentId || targetParentItem !== splitterSourceParentItem;

    if (needsReparentMove) {
      const gadgetListParentIds = buildGadgetListParentIds(parsed.gadgets);
      const movedBlocks: string[] = [];
      const deletedLines = new Set<number>();

      for (const rootId of [splitterSourceGadget1.id, splitterSourceGadget2.id]) {
        const movedIds = collectRequestedGadgetDeleteIds(parsed.gadgets, rootId);
        const lineNumbers = collectMovedGadgetLineNumbers(calls, movedIds, gadgetListParentIds);
        if (!lineNumbers.size) return undefined;
        movedBlocks.push(buildLineBlock(document, lineNumbers));
        for (const line of lineNumbers) {
          deletedLines.add(line);
        }
      }

      edit.insert(document.uri, anchorPos, `${movedBlocks.join("")}${block}`);
      for (const line of [...deletedLines].sort((a, b) => b - a)) {
        edit.delete(document.uri, document.lineAt(line).rangeIncludingLineBreak);
      }
    }
    else {
      edit.insert(document.uri, anchorPos, block);
    }
  }
  else {
    edit.insert(document.uri, anchorPos, block);
  }

  applyGadgetHeadPatchForGadgets(edit, document, [...parsed.gadgets, buildInsertedGadgetStub(kind, identity)]);
  return edit;
}

function collectDeletedContainerCloseLines(
  calls: PbCall[],
  deletedIds: ReadonlySet<string>,
  gadgetListParentIds: ReadonlySet<string>
): Set<number> {
  const lines = new Set<number>();
  const stack: string[] = [];

  for (const call of calls) {
    const nameLower = call.name.toLowerCase();

    if (nameLower === "opengadgetlist") {
      const targetId = firstParamOfCall(call.args);
      if (targetId.length) stack.push(targetId);
      continue;
    }

    if (isImplicitGadgetListStarterCall(call, gadgetListParentIds)) {
      const key = stableKey(call.assignedVar, splitParams(call.args));
      if (key) stack.push(key);
      continue;
    }

    if (nameLower === "closegadgetlist") {
      const targetId = stack.pop();
      if (targetId && deletedIds.has(targetId)) {
        lines.add(call.range.line);
      }
    }
  }

  return lines;
}

function collectDeletedGadgetLineNumbers(
  calls: PbCall[],
  deletedIds: ReadonlySet<string>,
  gadgetListParentIds: ReadonlySet<string>
): Set<number> {
  const lines = new Set<number>();

  for (const call of calls) {
    const nameLower = call.name.toLowerCase();
    let targetId: string | undefined;

    if (/gadget$/i.test(call.name)) {
      targetId = stableKey(call.assignedVar, splitParams(call.args));
    }
    else if (
      nameLower === "addgadgetitem"
      || nameLower === "addgadgetcolumn"
      || nameLower === "resizegadget"
      || nameLower === "opengadgetlist"
      || GADGET_PROPERTY_NAMES.has(nameLower)
    ) {
      targetId = firstParamOfCall(call.args);
    }

    if (targetId && deletedIds.has(targetId)) {
      lines.add(call.range.line);
    }
  }

  for (const line of collectDeletedContainerCloseLines(calls, deletedIds, gadgetListParentIds)) {
    lines.add(line);
  }

  return lines;
}

function collectOriginalGadgetDeleteIdsForRoots(gadgets: readonly Gadget[], rootIds: Iterable<string>): Set<string> {
  const requestedIds = new Set<string>();

  for (const rootId of rootIds) {
    for (const requestedId of collectRequestedGadgetDeleteIds(gadgets, rootId)) {
      requestedIds.add(requestedId);
    }
  }

  const requestedSplitterIds = new Set(
    gadgets
      .filter(gadget => requestedIds.has(gadget.id) && gadget.kind === GADGET_KIND.SplitterGadget)
      .map(gadget => gadget.id)
  );

  const splitterOwners = new Map<string, string>();
  for (const gadget of gadgets) {
    if (gadget.splitterId) {
      splitterOwners.set(gadget.id, gadget.splitterId);
    }
  }

  const deletedIds = new Set<string>();
  for (const gadget of gadgets) {
    if (!requestedIds.has(gadget.id)) continue;

    const ownerId = splitterOwners.get(gadget.id);
    if (ownerId && !requestedSplitterIds.has(ownerId)) continue;

    deletedIds.add(gadget.id);
  }

  return deletedIds;
}

function collectDeletedCustomGadgetLineNumbers(
  document: vscode.TextDocument,
  deletedGadgets: readonly Gadget[]
): Set<number> {
  const lines = new Set<number>();

  for (const gadget of deletedGadgets) {
    if (gadget.kind !== GADGET_KIND.CustomGadget) continue;

    if (typeof gadget.source?.line === "number") {
      lines.add(gadget.source.line);
    }

    if (typeof gadget.customCreateMarkerSource?.line === "number") {
      lines.add(gadget.customCreateMarkerSource.line);
    }

    if (typeof gadget.customInitSource?.line === "number") {
      lines.add(gadget.customInitSource.line);

      const markerLine = gadget.customInitSource.line - 1;
      if (markerLine >= 0 && isCustomGadgetInitMarkerLine(document.lineAt(markerLine).text)) {
        lines.add(markerLine);
      }
    }
  }

  return lines;
}

function collectMovedGadgetLineNumbers(
  calls: PbCall[],
  movedIds: ReadonlySet<string>,
  gadgetListParentIds: ReadonlySet<string>
): Set<number> {
  const lines = new Set<number>();

  for (const call of calls) {
    const nameLower = call.name.toLowerCase();
    let targetId: string | undefined;

    if (/gadget$/i.test(call.name)) {
      targetId = stableKey(call.assignedVar, splitParams(call.args));
    }
    else if (
      nameLower === "addgadgetitem"
      || nameLower === "addgadgetcolumn"
      || nameLower === "opengadgetlist"
      || nameLower === "resizegadget"
      || GADGET_PROPERTY_NAMES.has(nameLower)
    ) {
      targetId = firstParamOfCall(call.args);
    }

    if (targetId && movedIds.has(targetId)) {
      lines.add(call.range.line);
    }
  }

  for (const line of collectDeletedContainerCloseLines(calls, movedIds, gadgetListParentIds)) {
    lines.add(line);
  }

  return lines;
}

function buildLineBlock(document: vscode.TextDocument, lineNumbers: ReadonlySet<number>): string {
  const text = document.getText();
  return [...lineNumbers]
    .sort((a, b) => a - b)
    .map(line => {
      const lineInfo = document.lineAt(line);
      const start = document.offsetAt(lineInfo.range.start);
      const end = document.offsetAt(lineInfo.rangeIncludingLineBreak.end);
      return text.slice(start, end);
    })
    .join("");
}

function buildUpdatedCallText(call: PbCall, params: string[]): string {
  const rebuilt = `${call.name}(${params.join(", ")})`;
  return call.assignedVar ? `${call.indent ?? ""}${call.assignedVar} = ${rebuilt}` : `${call.indent ?? ""}${rebuilt}`;
}

function buildLineBlockWithReplacements(
  document: vscode.TextDocument,
  lineNumbers: ReadonlySet<number>,
  replacements: ReadonlyMap<number, string>
): string {
  const text = document.getText();
  return [...lineNumbers]
    .sort((a, b) => a - b)
    .map(line => {
      const replacement = replacements.get(line);
      if (replacement !== undefined) {
        const lineInfo = document.lineAt(line);
        const hasBreak = lineInfo.rangeIncludingLineBreak.end.character !== lineInfo.range.end.character
          || lineInfo.rangeIncludingLineBreak.end.line !== lineInfo.range.end.line;
        return hasBreak ? `${replacement}\n` : replacement;
      }

      const lineInfo = document.lineAt(line);
      const start = document.offsetAt(lineInfo.range.start);
      const end = document.offsetAt(lineInfo.rangeIncludingLineBreak.end);
      return text.slice(start, end);
    })
    .join("");
}

function buildReparentedRootGadgetLine(call: PbCall): string | undefined {
  const params = splitParams(call.args);
  if (params.length < 3) return undefined;
  params[1] = "0";
  params[2] = "0";
  return buildUpdatedCallText(call, params);
}

function findGadgetByRawReference(gadgets: readonly Gadget[], rawRef: string | undefined): Gadget | undefined {
  const ref = normalizeOptionalRaw(rawRef);
  if (!ref) return undefined;

  const normalizedRef = ref.startsWith("#") ? ref.slice(1) : ref;
  return gadgets.find(gadget =>
    gadget.id === ref
    || gadget.id === normalizedRef
    || gadget.id === `#${normalizedRef}`
    || gadget.variable === normalizedRef
  );
}

function hasSameSourceParent(left: Gadget, right: Gadget): boolean {
  return (left.parentId ?? undefined) === (right.parentId ?? undefined)
    && (left.parentItem ?? undefined) === (right.parentItem ?? undefined);
}

function shouldMoveSplitterChildBeforeOwner(splitter: Gadget, child: Gadget, splitterLine: number): boolean {
  if (!hasSameSourceParent(splitter, child)) return true;
  return typeof child.source?.line === "number" && child.source.line > splitterLine;
}

function appendSplitterLinkStructureEdit(
  edit: vscode.WorkspaceEdit,
  document: vscode.TextDocument,
  parsed: ReturnType<typeof parseFormDocument>,
  calls: PbCall[],
  splitter: Gadget,
  splitterCall: PbCall,
  gadget1Raw: string | undefined,
  gadget2Raw: string | undefined
): boolean {
  const gadget1 = findGadgetByRawReference(parsed.gadgets, gadget1Raw);
  const gadget2 = findGadgetByRawReference(parsed.gadgets, gadget2Raw);
  if (!gadget1 || !gadget2 || gadget1.id === gadget2.id) return false;

  const childPairs: [Gadget, Gadget][] = [[gadget1, gadget2], [gadget2, gadget1]];
  const moveRoots: Gadget[] = [];
  for (const [child, otherChild] of childPairs) {
    if (child.id === splitter.id) return false;
    if (child.splitterId && child.splitterId !== splitter.id) return false;

    const childSubtreeIds = collectRequestedGadgetDeleteIds(parsed.gadgets, child.id);
    if (childSubtreeIds.has(splitter.id) || childSubtreeIds.has(otherChild.id)) return false;

    if (shouldMoveSplitterChildBeforeOwner(splitter, child, splitterCall.range.line)
      && !moveRoots.some(entry => entry.id === child.id)) {
      moveRoots.push(child);
    }
  }

  if (!moveRoots.length) return true;

  const gadgetListParentIds = buildGadgetListParentIds(parsed.gadgets);
  const movedBlocks: string[] = [];
  const deletedLines = new Set<number>();

  for (const child of moveRoots) {
    const movedIds = collectRequestedGadgetDeleteIds(parsed.gadgets, child.id);
    const movedLines = collectMovedGadgetLineNumbers(calls, movedIds, gadgetListParentIds);
    if (!movedLines.size || movedLines.has(splitterCall.range.line)) return false;

    movedBlocks.push(buildLineBlock(document, movedLines));
    for (const line of movedLines) {
      deletedLines.add(line);
    }
  }

  edit.insert(document.uri, new vscode.Position(splitterCall.range.line, 0), movedBlocks.join(""));
  for (const line of [...deletedLines].sort((a, b) => b - a)) {
    edit.delete(document.uri, document.lineAt(line).rangeIncludingLineBreak);
  }

  return true;
}

export function applyGadgetReparent(
  document: vscode.TextDocument,
  gadgetKey: string,
  parentId?: string,
  parentItem?: number,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const parsed = parseFormDocument(document.getText());
  const target = parsed.gadgets.find(gadget => gadget.id === gadgetKey);
  if (!target?.source) return undefined;
  if (target.kind === GADGET_KIND.CustomGadget) return undefined;

  const nextParentId = parentId ?? undefined;
  const nextParentItem = typeof parentItem === "number" ? Math.trunc(parentItem) : undefined;
  const currentParentId = target.parentId ?? undefined;
  const currentParentItem = typeof target.parentItem === "number" ? target.parentItem : undefined;

  if (currentParentId === nextParentId && currentParentItem === nextParentItem) {
    return undefined;
  }

  const windowKey = parsed.window?.id;
  if (!windowKey) return undefined;

  const calls = scanDocumentCalls(document, scanRange);
  const openCall = findCallByStableKey(calls, windowKey, name => name === "OpenWindow");
  if (!openCall) return undefined;

  const proc = findProcedureBlock(document, openCall.range.line);
  if (!proc) return undefined;

  const gadgetListParentIds = buildGadgetListParentIds(parsed.gadgets);
  const requestedIds = collectRequestedGadgetDeleteIds(parsed.gadgets, gadgetKey);
  const movedRootIds = [target.id];

  let splitterGadget1: Gadget | undefined;
  let splitterGadget2: Gadget | undefined;
  if (target.kind === GADGET_KIND.SplitterGadget) {
    splitterGadget1 = target.gadget1Id ? parsed.gadgets.find(gadget => gadget.id === target.gadget1Id) : undefined;
    splitterGadget2 = target.gadget2Id ? parsed.gadgets.find(gadget => gadget.id === target.gadget2Id) : undefined;
    if (!splitterGadget1 || !splitterGadget2) return undefined;
    movedRootIds.unshift(splitterGadget1.id, splitterGadget2.id);
  }

  const blockedTargetIds = new Set<string>(requestedIds);
  for (const rootId of movedRootIds) {
    for (const movedId of collectRequestedGadgetDeleteIds(parsed.gadgets, rootId)) {
      blockedTargetIds.add(movedId);
    }
  }

  if (nextParentId && blockedTargetIds.has(nextParentId)) {
    return undefined;
  }

  const anchor = nextParentId
    ? (() => {
        const parent = parsed.gadgets.find(entry => entry.id === nextParentId);
        if (!parent || !canHostInsertedGadgets(parent)) return undefined;
        return findChildSectionInsertAnchor(document, calls, proc, parent, gadgetListParentIds, nextParentItem);
      })()
    : findTopLevelGadgetInsertAnchor(document, calls, openCall, proc);
  if (!anchor) return undefined;

  const rootCall = findCallByStableKey(calls, gadgetKey, name => /gadget$/i.test(name));
  if (!rootCall) return undefined;

  const updatedRootLine = buildReparentedRootGadgetLine(rootCall);
  if (!updatedRootLine) return undefined;

  const anchorPos = new vscode.Position(Math.min(document.lineCount, anchor.insertLine), 0);
  const edit = new vscode.WorkspaceEdit();
  const movedBlocks: string[] = [];
  const deletedLines = new Set<number>();

  if (target.kind === GADGET_KIND.SplitterGadget) {
    for (const gadget of [splitterGadget1!, splitterGadget2!]) {
      const movedIds = collectRequestedGadgetDeleteIds(parsed.gadgets, gadget.id);
      const movedLines = collectMovedGadgetLineNumbers(calls, movedIds, gadgetListParentIds);
      if (!movedLines.size) return undefined;
      movedBlocks.push(buildLineBlock(document, movedLines));
      for (const line of movedLines) {
        deletedLines.add(line);
      }
    }
  }

  const movedLines = collectMovedGadgetLineNumbers(calls, requestedIds, gadgetListParentIds);
  if (!movedLines.size) return undefined;
  movedBlocks.push(buildLineBlockWithReplacements(
    document,
    movedLines,
    new Map([[rootCall.range.line, updatedRootLine]])
  ));
  for (const line of movedLines) {
    deletedLines.add(line);
  }

  edit.insert(document.uri, anchorPos, movedBlocks.join(""));
  for (const line of [...deletedLines].sort((a, b) => b - a)) {
    edit.delete(document.uri, document.lineAt(line).rangeIncludingLineBreak);
  }

  return edit;
}

export function applyGadgetDelete(
  document: vscode.TextDocument,
  gadgetKey: string,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const parsed = parseFormDocument(document.getText());
  const target = parsed.gadgets.find(gadget => gadget.id === gadgetKey);
  if (!target?.source) return undefined;

  const deletePlan = buildOriginalGadgetDeletePlan(parsed.gadgets, gadgetKey);
  const deletedGadgets = parsed.gadgets.filter(gadget => deletePlan.deletedIds.has(gadget.id));
  if (!deletedGadgets.length) return undefined;

  const calls = scanDocumentCalls(document, scanRange);
  const gadgetListParentIds = buildGadgetListParentIds(parsed.gadgets);
  const lineNumbers = collectDeletedGadgetLineNumbers(calls, deletePlan.deletedIds, gadgetListParentIds);
  for (const line of collectDeletedCustomGadgetLineNumbers(document, deletedGadgets)) {
    lineNumbers.add(line);
  }
  if (!lineNumbers.size) return undefined;

  const edit = new vscode.WorkspaceEdit();
  for (const line of [...lineNumbers].sort((a, b) => b - a)) {
    edit.delete(document.uri, document.lineAt(line).rangeIncludingLineBreak);
  }

  for (const gadget of deletedGadgets) {
    if (!gadget.eventProc) continue;
    appendWorkspaceEdit(edit, applyGadgetEventProcUpdate(document, gadget.id, undefined, scanRange));
  }

  const remainingGadgets = parsed.gadgets.filter(gadget => !deletePlan.deletedIds.has(gadget.id));
  applyGadgetHeadPatchForGadgets(edit, document, remainingGadgets);
  return edit;
}

export function applyGadgetDeleteWithImageCleanup(
  document: vscode.TextDocument,
  gadgetKey: string,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const parsed = parseFormDocument(document.getText());
  const target = parsed.gadgets.find(gadget => gadget.id === gadgetKey);
  if (!target?.source) return undefined;

  const deletePlan = buildOriginalGadgetDeletePlan(parsed.gadgets, gadgetKey);
  const cleanupSourceLines = new Set<number>();

  for (const image of parsed.images) {
    if (typeof image.source?.line !== "number") continue;
    if (isImageUsedOnlyByDeletedGadgets(parsed, image.id, deletePlan.deletedIds)) {
      cleanupSourceLines.add(image.source.line);
    }
  }

  if (!cleanupSourceLines.size) {
    return applyGadgetDelete(document, gadgetKey, scanRange);
  }

  let pendingRenames: ImageRename[] = [];

  return applyImageMutation(
    document,
    images => {
      const nextImages = images.filter(image => !cleanupSourceLines.has(image.source?.line ?? -1));
      if (nextImages.length === images.length) return false;

      images.splice(0, images.length, ...nextImages);
      pendingRenames = reindexImages(images, getWindowImageBaseName(parsed));
      return true;
    },
    scanRange,
    edit => {
      const deleteEdit = applyGadgetDelete(document, gadgetKey, scanRange);
      if (!deleteEdit) return false;

      const skipLines = collectWorkspaceEditTouchedLines(deleteEdit);
      applyImageIdRenames(edit, document, pendingRenames, skipLines);
      appendWorkspaceEdit(edit, deleteEdit);
      return true;
    }
  );
}

function isImageUsedOnlyByDeletedGadgets(
  parsed: ReturnType<typeof parseFormDocument>,
  imageId: string,
  deletedIds: ReadonlySet<string>
): boolean {
  let foundDeletedUsage = false;

  for (const gadget of parsed.gadgets) {
    const hasImageUsage = gadget.imageId === imageId || gadget.items?.some(item => item.imageId === imageId);
    if (!hasImageUsage) continue;

    if (!deletedIds.has(gadget.id)) {
      return false;
    }

    foundDeletedUsage = true;
  }

  if (parsed.menus.some(menu => menu.entries.some(entry => entry.iconId === imageId))) {
    return false;
  }

  if (parsed.toolbars.some(toolBar => toolBar.entries.some(entry => entry.iconId === imageId))) {
    return false;
  }

  if (parsed.statusbars.some(statusBar => statusBar.fields.some(field => field.imageId === imageId))) {
    return false;
  }

  return foundDeletedUsage;
}

function buildCustomGadgetIdRaw(gadget: Gadget): string {
  if (gadget.pbAny) {
    return gadget.variable?.trim() || gadget.id;
  }
  return gadget.firstParam?.trim() || gadget.id;
}

function buildCustomGadgetTextReplacement(gadget: Gadget): string {
  const textRaw = normalizeOptionalRaw(gadget.textRaw);
  if (textRaw) return textRaw;
  if (typeof gadget.text === "string") return quotePbString(gadget.text);
  return '""';
}

function buildCustomGadgetWindowHandle(window: FormWindow | undefined, mode: 'hWnd' | 'WndID'): string | undefined {
  if (!window) return undefined;

  const windowRef = window.pbAny
    ? window.variable?.trim() || window.id?.trim()
    : window.firstParam?.trim() || window.id?.trim();
  if (!windowRef) return undefined;

  return mode === 'hWnd'
    ? `WindowID(${windowRef})`
    : `${windowRef}`;
}

function buildCustomGadgetCreationLine(
  gadget: Gadget,
  indent: string,
  window: FormWindow | undefined
): string | undefined {
  const templateRaw = normalizeOptionalGridString(gadget.customCreateRaw);
  if (!templateRaw) return undefined;

  const idRaw = buildCustomGadgetIdRaw(gadget);
  const hwndRaw = buildCustomGadgetWindowHandle(window, 'hWnd') ?? '0';
  const hwndIdRaw = buildCustomGadgetWindowHandle(window, 'WndID') ?? '0';
  const replacements: Record<string, string> = {
    "%id%": idRaw,
    "%x%": String(Math.trunc(gadget.x)),
    "%y%": String(Math.trunc(gadget.y)),
    "%w%": String(Math.trunc(gadget.w)),
    "%h%": String(Math.trunc(gadget.h)),
    "%txt%": buildCustomGadgetTextReplacement(gadget),
    "%hwnd%": hwndRaw,
    "%wndid%": hwndIdRaw,
  };

  let line = templateRaw;
  for (const [token, value] of Object.entries(replacements)) {
    line = line.split(token).join(value);
  }

  return `${indent}${line}`;
}

function applyCustomGadgetCreationLineEdit(
  document: vscode.TextDocument,
  gadget: Gadget,
  window: FormWindow | undefined
): vscode.WorkspaceEdit | undefined {
  if (!gadget.source) return undefined;

  const line = gadget.source.line;
  if (line < 0 || line >= document.lineCount) return undefined;

  const rebuilt = buildCustomGadgetCreationLine(gadget, getLineIndent(document, line), window);
  if (!rebuilt) return undefined;

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, document.lineAt(line).range, rebuilt);
  return edit;
}

function setRequiredCtorParam(params: string[], index: number | undefined, raw: string | undefined): void {
  if (index === undefined || raw === undefined) return;
  const normalized = normalizeOptionalRaw(raw);
  if (!normalized) return;
  while (params.length <= index) params.push("");
  params[index] = normalized;
}

function setOptionalCtorParam(params: string[], index: number | undefined, raw: string | undefined): void {
  if (index === undefined) return;
  while (params.length <= index) params.push("");
  params[index] = normalizeOptionalRaw(raw) ?? "";
}

export function applyGadgetOpenArgsUpdate(
  document: vscode.TextDocument,
  gadgetKey: string,
  args: GadgetOpenArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const parsed = parseFormDocument(document.getText());
  const customGadget = parsed.gadgets.find(entry => entry.id === gadgetKey && entry.kind === GADGET_KIND.CustomGadget);
  if (customGadget) {
    const nextGadget: Gadget = { ...customGadget };
    if (args.textRaw !== undefined) {
      const nextTextRaw = normalizeOptionalRaw(args.textRaw) ?? '""';
      const literalText = parsePbStringLiteral(nextTextRaw);
      nextGadget.textRaw = nextTextRaw;
      nextGadget.text = literalText ?? nextTextRaw;
      nextGadget.textVariable = literalText === undefined && nextTextRaw.length > 0;
    }
    return applyCustomGadgetCreationLineEdit(document, nextGadget, parsed.window);
  }

  const calls = scanDocumentCalls(document, scanRange);
  const call = findCallByStableKey(calls, gadgetKey, name => /gadget$/i.test(name));

  if (!call) return undefined;

  const layout = getGadgetCtorLayout(call.name);
  if (!layout) return undefined;

  const params = splitParams(call.args);
  if (params.length < 5) return undefined;

  setRequiredCtorParam(params, layout.textIndex, args.textRaw);
  setRequiredCtorParam(params, layout.imageIndex, args.imageRaw);
  setRequiredCtorParam(params, layout.minIndex, args.minRaw);
  setRequiredCtorParam(params, layout.maxIndex, args.maxRaw);
  setRequiredCtorParam(params, layout.gadget1Index, args.gadget1Raw);
  setRequiredCtorParam(params, layout.gadget2Index, args.gadget2Raw);
  if (args.flagsExpr !== undefined) {
    setOptionalCtorParam(params, layout.flagsIndex, args.flagsExpr);
  }

  while (params.length > layout.minParamCount && !(params[params.length - 1]?.trim().length)) {
    params.pop();
  }

  const edit = replaceCallArgsEdit(document, call, params);

  if (call.name === GADGET_KIND.SplitterGadget
    && (args.gadget1Raw !== undefined || args.gadget2Raw !== undefined)) {
    const splitter = parsed.gadgets.find(entry => entry.id === gadgetKey);
    if (!splitter) return undefined;

    const structureOk = appendSplitterLinkStructureEdit(
      edit,
      document,
      parsed,
      calls,
      splitter,
      call,
      params[layout.gadget1Index ?? 5],
      params[layout.gadget2Index ?? 6]
    );
    if (!structureOk) return undefined;
  }

  applyGadgetHeadPatch(edit, document);
  return edit;
}

export function applyCustomGadgetCodeUpdate(
  document: vscode.TextDocument,
  gadgetKey: string,
  args: CustomGadgetCodeArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const parsed = parseFormDocument(document.getText());
  const gadget = parsed.gadgets.find(entry => entry.id === gadgetKey && entry.kind === GADGET_KIND.CustomGadget);
  if (!gadget) return undefined;

  const nextGadget: Gadget = { ...gadget };
  if (args.customInitRaw !== undefined) {
    nextGadget.customInitRaw = normalizeOptionalGridString(args.customInitRaw);
  }
  if (args.customCreateRaw !== undefined) {
    nextGadget.customCreateRaw = normalizeOptionalGridString(args.customCreateRaw);
  }

  const edit = new vscode.WorkspaceEdit();
  let changed = false;

  if (args.customInitRaw !== undefined) {
    if (gadget.customInitSource) {
      const markerLine = gadget.customInitSource.line - 1;
      const hasMarker = markerLine >= 0 && /^\s*;\s*\d+\s+Custom gadget initialisation \(do Not remove this line\)\s*$/i.test(document.lineAt(markerLine).text);
      if (!nextGadget.customInitRaw) {
        if (hasMarker) {
          edit.delete(document.uri, document.lineAt(markerLine).rangeIncludingLineBreak);
        }
        edit.delete(document.uri, document.lineAt(gadget.customInitSource.line).rangeIncludingLineBreak);
        changed = true;
      } else {
        const indent = getLineIndent(document, gadget.customInitSource.line);
        edit.replace(document.uri, document.lineAt(gadget.customInitSource.line).range, `${indent}${nextGadget.customInitRaw}`);
        changed = true;
      }
    } else if (nextGadget.customInitRaw) {
      return undefined;
    }
  }

  if (args.customCreateRaw !== undefined) {
    if (!gadget.customCreateMarkerSource || !gadget.source || !nextGadget.customCreateRaw) {
      return undefined;
    }

    const markerLine = gadget.customCreateMarkerSource.line;
    const markerText = document.lineAt(markerLine).text;
    const markerMatch = /^(\s*);\s*(\d+)\s+Custom gadget creation \(do not remove this line\)\s*(.*)$/i.exec(markerText);
    if (!markerMatch) return undefined;

    const markerIndent = markerMatch[1] ?? "";
    const markerIndex = markerMatch[2];
    edit.replace(
      document.uri,
      document.lineAt(markerLine).range,
      `${markerIndent}; ${markerIndex} Custom gadget creation (do not remove this line) ${nextGadget.customCreateRaw}`
    );

    const rebuiltLine = buildCustomGadgetCreationLine(nextGadget, getLineIndent(document, gadget.source.line), parsed.window);
    if (!rebuiltLine) return undefined;
    edit.replace(document.uri, document.lineAt(gadget.source.line).range, rebuiltLine);
    changed = true;
  }

  return changed ? edit : undefined;
}

export function applyWindowPbAnyToggle(
  document: vscode.TextDocument,
  windowKey: string,
  toPbAny: boolean,
  variableName: string,
  enumSymbol: string,
  enumValueRaw: string | undefined,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);

  const openWin = calls.find(c => {
    if (c.name !== "OpenWindow") return false;
    const params = splitParams(c.args);
    return stableKey(c.assignedVar, params) === windowKey;
  });
  if (!openWin) return undefined;

  const openParams = splitParams(openWin.args);
  if (openParams.length < 6) return undefined;

  const isFirstParamPbAny = (openParams[0] ?? "").trim() === PB_ANY;

  const edit = new vscode.WorkspaceEdit();

  // Locate the surrounding procedure block (used for consistent global/enum placement + optional id replacements).
  const proc = findProcedureBlock(document, openWin.range.line);

  if (toPbAny) {
    // 1) Remove Enumeration FormWindow block.
    const enumBlock = findNamedEnumerationBlock(document, ENUM_NAMES.windows);
    if (enumBlock) {
      const expandedBlock = expandBlockWithTrailingBlank(document, enumBlock);
      edit.delete(
        document.uri,
        new vscode.Range(
          new vscode.Position(expandedBlock.startLine, 0),
          document.lineAt(expandedBlock.endLine).rangeIncludingLineBreak.end
        )
      );
    }

    // 2) Ensure Global variable exists.
    ensureWindowGlobalLine(edit, document, variableName);

    // 3) Rewrite OpenWindow line to "Var = OpenWindow(#PB_Any, ...)".
    openParams[0] = PB_ANY;
    const rebuilt = `OpenWindow(${openParams.join(", ")})`;
    const indent = openWin.indent ?? getLineIndent(document, openWin.range.line);
    const updated = `${indent}${variableName} = ${rebuilt}`;
    edit.replace(
      document.uri,
      new vscode.Range(document.positionAt(openWin.range.lineStart), document.positionAt(openWin.range.end)),
      updated
    );

    // 4) Best-effort: replace enumSymbol usage in first-call-arg within the procedure to variableName.
    if (proc) {
      const inProc = calls.filter(c => c.range.line >= proc.startLine && c.range.line <= proc.endLine);
      for (const c of inProc) {
        if (c.name === "OpenWindow") continue;
        const p = splitParams(c.args);
        if (!p.length) continue;
        if ((p[0] ?? "").trim() !== enumSymbol) continue;
        p[0] = variableName;
        const rebuiltCall = `${c.name}(${p.join(", ")})`;
        const indent = c.indent ?? getLineIndent(document, c.range.line);
        const updatedLine = c.assignedVar ? `${indent}${c.assignedVar} = ${rebuiltCall}` : `${indent}${rebuiltCall}`;
        edit.replace(
          document.uri,
          new vscode.Range(document.positionAt(c.range.lineStart), document.positionAt(c.range.end)),
          updatedLine
        );
      }
    }

    return edit;
  }

  // toPbAny == false
  // 1) Remove Global variable.
  removeGlobalLine(edit, document, variableName);

  // 2) Ensure Enumeration FormWindow block exists and has enumSymbol.
  ensureWindowEnumeration(edit, document, enumSymbol, enumValueRaw);

  // 3) Rewrite OpenWindow line to "OpenWindow(#Dlg, ...)" without assignment.
  openParams[0] = enumSymbol;
  const rebuilt = `OpenWindow(${openParams.join(", ")})`;
  const indent = openWin.indent ?? getLineIndent(document, openWin.range.line);
  const updated = `${indent}${rebuilt}`;
  edit.replace(
    document.uri,
    new vscode.Range(document.positionAt(openWin.range.lineStart), document.positionAt(openWin.range.end)),
    updated
  );

  // 4) Best-effort: replace variableName usage in first-call-arg within the procedure to enumSymbol.
  if (proc) {
    const inProc = calls.filter(c => c.range.line >= proc.startLine && c.range.line <= proc.endLine);
    for (const c of inProc) {
      if (c.name === "OpenWindow") continue;
      const p = splitParams(c.args);
      if (!p.length) continue;
      if ((p[0] ?? "").trim() !== variableName) continue;
      p[0] = enumSymbol;
      const rebuiltCall = `${c.name}(${p.join(", ")})`;
      const indent = c.indent ?? getLineIndent(document, c.range.line);
      const updatedLine = c.assignedVar ? `${indent}${c.assignedVar} = ${rebuiltCall}` : `${indent}${rebuiltCall}`;
      edit.replace(
        document.uri,
        new vscode.Range(document.positionAt(c.range.lineStart), document.positionAt(c.range.end)),
        updatedLine
      );
    }
  }

  return edit;
}

export function applyWindowEnumValuePatch(
  document: vscode.TextDocument,
  enumSymbol: string,
  enumValueRaw: string | undefined,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const block = findNamedEnumerationBlock(document, ENUM_NAMES.windows);
  if (!block) return undefined;

  const edit = new vscode.WorkspaceEdit();
  // Find the enum entry inside the block.
  for (let i = block.startLine + 1; i <= block.endLine - 1; i++) {
    const line = document.lineAt(i).text;
    const noComment = (line.split(";")[0] ?? "").trim();
    if (!noComment.length) continue;
    const m = /^(#\w+)\b/.exec(noComment);
    if (!m) continue;
    if (m[1] !== enumSymbol) continue;

    const indent = getLineIndent(document, i);
    const newLine = enumValueRaw && enumValueRaw.trim().length
      ? `${indent}${enumSymbol}=${enumValueRaw.trim()}`
      : `${indent}${enumSymbol}`;

    edit.replace(document.uri, document.lineAt(i).range, newLine);
    return edit;
  }

  // If not found, insert it before EndEnumeration.
  const insertLine = block.endLine;
  const indent = "  ";
  const newLine = enumValueRaw && enumValueRaw.trim().length
    ? `${indent}${enumSymbol}=${enumValueRaw.trim()}\n`
    : `${indent}${enumSymbol}\n`;

  edit.insert(document.uri, new vscode.Position(insertLine, 0), newLine);
  return edit;
}

// -----------------------------------------------------------------------------
// Helpers for gadget id / pbAny patching
// -----------------------------------------------------------------------------

/**
 * Removes a single symbol entry from the Enumeration FormGadget block.
 * If the block would become empty, the whole block is deleted.
 */
function removeGadgetEnumEntry(
  edit: vscode.WorkspaceEdit,
  document: vscode.TextDocument,
  block: LineBlock,
  enumSymbol: string
): void {
  let entryLine: number | undefined;
  let entryCount = 0;

  for (let i = block.startLine + 1; i <= block.endLine - 1; i++) {
    const noComment = (document.lineAt(i).text.split(";")[0] ?? "").trim();
    if (!noComment.length) continue;
    const m = /^(#\w+)\b/.exec(noComment);
    if (!m) continue;
    entryCount++;
    if (m[1] === enumSymbol) entryLine = i;
  }

  if (entryLine === undefined) return;

  if (entryCount <= 1) {
    // Block becomes empty: remove the whole block including trailing blank line.
    const expanded = expandBlockWithTrailingBlank(document, block);
    edit.delete(
      document.uri,
      new vscode.Range(
        new vscode.Position(expanded.startLine, 0),
        document.lineAt(expanded.endLine).rangeIncludingLineBreak.end
      )
    );
    return;
  }

  // Just delete the specific entry line.
  edit.delete(
    document.uri,
    new vscode.Range(
      new vscode.Position(entryLine, 0),
      document.lineAt(entryLine).rangeIncludingLineBreak.end
    )
  );
}

/**
 * Ensures the Enumeration FormGadget block contains enumSymbol.
 * Creates the block if absent; updates an existing entry if present.
 */
function ensureGadgetEnumeration(
  edit: vscode.WorkspaceEdit,
  document: vscode.TextDocument,
  enumSymbol: string,
  enumValueRaw: string | undefined
): void {
  const block = findNamedEnumerationBlock(document, ENUM_NAMES.gadgets);
  if (block) {
    for (let i = block.startLine + 1; i <= block.endLine - 1; i++) {
      const noComment = (document.lineAt(i).text.split(";")[0] ?? "").trim();
      if (!noComment.length) continue;
      const m = /^(#\w+)\b/.exec(noComment);
      if (!m || m[1] !== enumSymbol) continue;
      const indent = getLineIndent(document, i);
      const newLine = enumValueRaw && enumValueRaw.trim().length
        ? `${indent}${enumSymbol}=${enumValueRaw.trim()}`
        : `${indent}${enumSymbol}`;
      edit.replace(document.uri, document.lineAt(i).range, newLine);
      return;
    }
    // Symbol not yet in block — insert before EndEnumeration.
    const newLine = enumValueRaw && enumValueRaw.trim().length
      ? `  ${enumSymbol}=${enumValueRaw.trim()}\n`
      : `  ${enumSymbol}\n`;
    edit.insert(document.uri, new vscode.Position(block.endLine, 0), newLine);
    return;
  }

  // Block does not exist — create it.
  const anchor = findGadgetEnumInsertLine(document);
  const entry = enumValueRaw && enumValueRaw.trim().length
    ? `  ${enumSymbol}=${enumValueRaw.trim()}`
    : `  ${enumSymbol}`;
  const blockText = `Enumeration ${ENUM_NAMES.gadgets}\n${entry}\nEndEnumeration\n\n`;
  edit.insert(document.uri, new vscode.Position(anchor, 0), blockText);
}

export function applyGadgetPbAnyToggle(
  document: vscode.TextDocument,
  gadgetId: string,
  toPbAny: boolean,
  variableName: string,
  enumSymbol: string,
  enumValueRaw: string | undefined,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);

  const gadgetCall = findCallByStableKey(calls, gadgetId, name => /gadget$/i.test(name));
  if (!gadgetCall) return undefined;

  const params = splitParams(gadgetCall.args);
  if (params.length < 5) return undefined;

  const edit = new vscode.WorkspaceEdit();
  const proc = findProcedureBlock(document, gadgetCall.range.line);

  if (toPbAny) {
    // 1) Remove the symbol from Enumeration FormGadget (entry only, not whole block).
    const enumBlock = findNamedEnumerationBlock(document, ENUM_NAMES.gadgets);
    if (enumBlock) {
      removeGadgetEnumEntry(edit, document, enumBlock, enumSymbol);
    }

    // 2) Ensure Global variable declaration exists.
    ensureWindowGlobalLine(edit, document, variableName);

    // 3) Rewrite constructor: "Var = KindGadget(#PB_Any, x, y, w, h, ...)".
    params[0] = PB_ANY;
    const rebuilt = `${gadgetCall.name}(${params.join(", ")})`;
    const indent = gadgetCall.indent ?? getLineIndent(document, gadgetCall.range.line);
    const updated = `${indent}${variableName} = ${rebuilt}`;
    edit.replace(
      document.uri,
      new vscode.Range(document.positionAt(gadgetCall.range.lineStart), document.positionAt(gadgetCall.range.end)),
      updated
    );

    // 4) Best-effort: replace enumSymbol with variableName in p[0] of all
    //    other calls inside the same procedure scope.
    if (proc) {
      for (const c of calls) {
        if (c.range.line < proc.startLine || c.range.line > proc.endLine) continue;
        if (c === gadgetCall) continue;
        const p = splitParams(c.args);
        if (!p.length) continue;
        if ((p[0] ?? "").trim() !== enumSymbol) continue;
        p[0] = variableName;
        const rebuiltCall = `${c.name}(${p.join(", ")})`;
        const lineIndent = c.indent ?? getLineIndent(document, c.range.line);
        const updatedLine = c.assignedVar
          ? `${lineIndent}${c.assignedVar} = ${rebuiltCall}`
          : `${lineIndent}${rebuiltCall}`;
        edit.replace(
          document.uri,
          new vscode.Range(document.positionAt(c.range.lineStart), document.positionAt(c.range.end)),
          updatedLine
        );
      }
    }

    return edit;
  }

  // toPbAny === false
  // 1) Remove the Global variable declaration.
  removeGlobalLine(edit, document, variableName);

  // 2) Ensure Enumeration FormGadget block contains enumSymbol.
  ensureGadgetEnumeration(edit, document, enumSymbol, enumValueRaw);

  // 3) Rewrite constructor: "KindGadget(#Symbol, x, y, w, h, ...)" without assignment.
  params[0] = enumSymbol;
  const rebuilt = `${gadgetCall.name}(${params.join(", ")})`;
  const indent = gadgetCall.indent ?? getLineIndent(document, gadgetCall.range.line);
  const updated = `${indent}${rebuilt}`;
  edit.replace(
    document.uri,
    new vscode.Range(document.positionAt(gadgetCall.range.lineStart), document.positionAt(gadgetCall.range.end)),
    updated
  );

  // 4) Best-effort: replace variableName with enumSymbol in p[0] of all
  //    other calls inside the same procedure scope.
  if (proc) {
    for (const c of calls) {
      if (c.range.line < proc.startLine || c.range.line > proc.endLine) continue;
      if (c === gadgetCall) continue;
      const p = splitParams(c.args);
      if (!p.length) continue;
      if ((p[0] ?? "").trim() !== variableName) continue;
      p[0] = enumSymbol;
      const rebuiltCall = `${c.name}(${p.join(", ")})`;
      const lineIndent = c.indent ?? getLineIndent(document, c.range.line);
      const updatedLine = c.assignedVar
        ? `${lineIndent}${c.assignedVar} = ${rebuiltCall}`
        : `${lineIndent}${rebuiltCall}`;
      edit.replace(
        document.uri,
        new vscode.Range(document.positionAt(c.range.lineStart), document.positionAt(c.range.end)),
        updatedLine
      );
    }
  }

  return edit;
}

export function applyGadgetEnumValuePatch(
  document: vscode.TextDocument,
  enumSymbol: string,
  enumValueRaw: string | undefined,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const block = findNamedEnumerationBlock(document, ENUM_NAMES.gadgets);
  if (!block) return undefined;

  const edit = new vscode.WorkspaceEdit();
  for (let i = block.startLine + 1; i <= block.endLine - 1; i++) {
    const noComment = (document.lineAt(i).text.split(";")[0] ?? "").trim();
    if (!noComment.length) continue;
    const m = /^(#\w+)\b/.exec(noComment);
    if (!m) continue;
    if (m[1] !== enumSymbol) continue;

    const indent = getLineIndent(document, i);
    const newLine = enumValueRaw && enumValueRaw.trim().length
      ? `${indent}${enumSymbol}=${enumValueRaw.trim()}`
      : `${indent}${enumSymbol}`;
    edit.replace(document.uri, document.lineAt(i).range, newLine);
    return edit;
  }

  // Not found — insert before EndEnumeration.
  const newLine = enumValueRaw && enumValueRaw.trim().length
    ? `  ${enumSymbol}=${enumValueRaw.trim()}\n`
    : `  ${enumSymbol}\n`;
  edit.insert(document.uri, new vscode.Position(block.endLine, 0), newLine);
  return edit;
}

export function applyGadgetVariableNamePatch(
  document: vscode.TextDocument,
  gadgetId: string,
  variableName: string,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  if (!variableName.length) return undefined;

  const calls = scanDocumentCalls(document, scanRange);
  const gadgetCall = findCallByStableKey(calls, gadgetId, name => /gadget$/i.test(name));
  if (!gadgetCall) return undefined;

  const params = splitParams(gadgetCall.args);
  if (params.length < 1) return undefined;

  const first = (params[0] ?? "").trim();
  const edit = new vscode.WorkspaceEdit();
  const proc = findProcedureBlock(document, gadgetCall.range.line);

  // -------------------------------------------------------------------------
  // PB_Any mode: oldVar = KindGadget(#PB_Any, ...)
  // -------------------------------------------------------------------------
  if (first === PB_ANY) {
    const oldVar = (gadgetCall.assignedVar ?? "").trim();
    if (!oldVar.length) return undefined;

    // 1) Rename Global line.
    if (oldVar !== variableName) {
      removeGlobalLine(edit, document, oldVar);
      ensureWindowGlobalLine(edit, document, variableName);
    } else {
      ensureWindowGlobalLine(edit, document, variableName);
    }

    // 2) Rewrite constructor assignment line.
    const indent = gadgetCall.indent ?? getLineIndent(document, gadgetCall.range.line);
    const rebuilt = `${gadgetCall.name}(${params.join(", ")})`;
    edit.replace(
      document.uri,
      new vscode.Range(document.positionAt(gadgetCall.range.lineStart), document.positionAt(gadgetCall.range.end)),
      `${indent}${variableName} = ${rebuilt}`
    );

    // 3) Best-effort: rewrite p[0] usages oldVar -> variableName in procedure scope.
    if (proc && oldVar !== variableName) {
      for (const c of calls) {
        if (c.range.line < proc.startLine || c.range.line > proc.endLine) continue;
        if (c === gadgetCall) continue;
        const p = splitParams(c.args);
        if (!p.length || (p[0] ?? "").trim() !== oldVar) continue;
        p[0] = variableName;
        const rebuiltCall = `${c.name}(${p.join(", ")})`;
        const li = c.indent ?? getLineIndent(document, c.range.line);
        const updatedLine = c.assignedVar ? `${li}${c.assignedVar} = ${rebuiltCall}` : `${li}${rebuiltCall}`;
        edit.replace(
          document.uri,
          new vscode.Range(document.positionAt(c.range.lineStart), document.positionAt(c.range.end)),
          updatedLine
        );
      }
    }

    return edit;
  }

  // -------------------------------------------------------------------------
  // Enum mode: KindGadget(#OldSym, ...)
  // -------------------------------------------------------------------------
  const oldEnum = first; // e.g. "#Btn_0"
  const newEnum = variableName.startsWith("#") ? variableName : `#${variableName}`;
  if (oldEnum === newEnum) return undefined;

  // 1) Rename entry in Enumeration FormGadget block.
  const block = findNamedEnumerationBlock(document, ENUM_NAMES.gadgets);
  if (block) {
    for (let i = block.startLine + 1; i <= block.endLine - 1; i++) {
      const re = new RegExp(`^(\\s*)${escapeRegExp(oldEnum)}(\\b.*)$`);
      const m = re.exec(document.lineAt(i).text);
      if (!m) continue;
      edit.replace(document.uri, document.lineAt(i).range, `${m[1]}${newEnum}${m[2]}`);
      break;
    }
  }

  // 2) Rewrite constructor first param.
  params[0] = newEnum;
  const indent = gadgetCall.indent ?? getLineIndent(document, gadgetCall.range.line);
  const rebuilt = `${gadgetCall.name}(${params.join(", ")})`;
  edit.replace(
    document.uri,
    new vscode.Range(document.positionAt(gadgetCall.range.lineStart), document.positionAt(gadgetCall.range.end)),
    `${indent}${rebuilt}`
  );

  // 3) Best-effort: rewrite p[0] usages oldEnum -> newEnum in procedure scope.
  if (proc) {
    for (const c of calls) {
      if (c.range.line < proc.startLine || c.range.line > proc.endLine) continue;
      if (c === gadgetCall) continue;
      const p = splitParams(c.args);
      if (!p.length || (p[0] ?? "").trim() !== oldEnum) continue;
      p[0] = newEnum;
      const rebuiltCall = `${c.name}(${p.join(", ")})`;
      const li = c.indent ?? getLineIndent(document, c.range.line);
      const updatedLine = c.assignedVar ? `${li}${c.assignedVar} = ${rebuiltCall}` : `${li}${rebuiltCall}`;
      edit.replace(
        document.uri,
        new vscode.Range(document.positionAt(c.range.lineStart), document.positionAt(c.range.end)),
        updatedLine
      );
    }
  }

  return edit;
}

export function applyWindowVariableNamePatch(
  document: vscode.TextDocument,
  variableName: string,
  windowKey?: string,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const newVar = variableName;
  if (!newVar.length) return undefined;

  const calls = scanDocumentCalls(document, scanRange);

  const openWindowCalls = calls.filter(c => c.name.toLowerCase() === PB_CALL.openWindow);
  const openWin = windowKey
    ? openWindowCalls.find(c => stableKey(c.assignedVar, splitParams(c.args)) === windowKey)
    : openWindowCalls[0];
  if (!openWin) return undefined;

  const params = splitParams(openWin.args);
  if (params.length < 1) return undefined;

  const first = (params[0] ?? "").trim();
  const edit = new vscode.WorkspaceEdit();

  const proc = findProcedureBlock(document, openWin.range.line);

  // ---------------------------------------------------------------------------
  // PB_Any mode:  <oldVar> = OpenWindow(#PB_Any, ...)
  // ---------------------------------------------------------------------------
  if (first === PB_ANY) {
    const oldVar = (openWin.assignedVar ?? "").trim();
    if (!oldVar.length) {
      return undefined;
    }

    // 1) Rename Global line
    if (oldVar !== newVar) {
      removeGlobalLine(edit, document, oldVar);
      ensureWindowGlobalLine(edit, document, newVar);
    } else {
      ensureWindowGlobalLine(edit, document, newVar);
    }

    // 2) Rewrite OpenWindow assignment line
    const indent = openWin.indent ?? getLineIndent(document, openWin.range.line);
    const rebuilt = `OpenWindow(${params.join(", ")})`;
    const updated = `${indent}${newVar} = ${rebuilt}`;
    edit.replace(
      document.uri,
      new vscode.Range(document.positionAt(openWin.range.lineStart), document.positionAt(openWin.range.end)),
      updated
    );

    // 3) Best-effort: rewrite first-call-arg within the same procedure: oldVar -> newVar
    if (proc && oldVar !== newVar) {
      const inProc = calls.filter(c => c.range.line >= proc.startLine && c.range.line <= proc.endLine);
      for (const c of inProc) {
        if (c.name === "OpenWindow") continue;
        const p = splitParams(c.args);
        if (!p.length) continue;
        if ((p[0] ?? "").trim() !== oldVar) continue;

        p[0] = newVar;
        const rebuiltCall = `${c.name}(${p.join(", ")})`;
        const i2 = c.indent ?? getLineIndent(document, c.range.line);
        const updatedLine = c.assignedVar ? `${i2}${c.assignedVar} = ${rebuiltCall}` : `${i2}${rebuiltCall}`;

        edit.replace(
          document.uri,
          new vscode.Range(document.positionAt(c.range.lineStart), document.positionAt(c.range.end)),
          updatedLine
        );
      }
    }

    // --- rename derived procedure names + call-sites globally ---
    if (oldVar !== newVar) {
      const oldBase = oldVar;
      const newBase = newVar;

      const oldOpen = buildOpenProcName(oldBase);
      const newOpen = buildOpenProcName(newBase);

      const oldEvents = buildEventsProcName(oldBase);
      const newEvents = buildEventsProcName(newBase);

      const oldResize = buildResizeProcName(oldBase);
      const newResize = buildResizeProcName(newBase);

      // Procedure headers
      renameProcedureHeaderGlobal(edit, document, oldOpen, newOpen);
      renameProcedureHeaderGlobal(edit, document, oldEvents, newEvents);
      renameProcedureHeaderGlobal(edit, document, oldResize, newResize);

      // Calls (outside Open-procedure too)
      renameCallsGlobalByScanner(edit, document, calls, oldOpen, newOpen);
      renameCallsGlobalByScanner(edit, document, calls, oldEvents, newEvents);
      renameCallsGlobalByScanner(edit, document, calls, oldResize, newResize);

      // Best-effort: if someone references '#Dlg' even in PB_Any mode
      replaceEnumSymbolGlobal(edit, document, `#${oldBase}`, `#${newBase}`);
    }  

    return edit;
  }

  // ---------------------------------------------------------------------------
  // Enum mode: OpenWindow(#Dlg, ...)  -> rename #Dlg to #NewVar
  // ---------------------------------------------------------------------------
  const oldEnum = first; // e.g. "#Dlg"
  const newEnum = newVar.startsWith("#") ? newVar : `#${newVar}`;

  const oldProcName = toOpenProcName(oldEnum);
  const newProcName = toOpenProcName(newEnum);

  // 1) Patch Enumeration FormWindow entry name if present
  const block = findNamedEnumerationBlock(document, ENUM_NAMES.windows);
  if (block) {
    for (let i = block.startLine + 1; i <= block.endLine - 1; i++) {
      const lineText = document.lineAt(i).text;
      const re = new RegExp(`^(\\s*)${escapeRegExp(oldEnum)}(\\b.*)$`);
      const m = re.exec(lineText);
      if (!m) continue;

      const rebuiltLine = `${m[1]}${newEnum}${m[2]}`;
      edit.replace(document.uri, document.lineAt(i).range, rebuiltLine);
      break;
    }
  }

  // 2) Rewrite OpenWindow first param
  params[0] = newEnum;
  const indent = openWin.indent ?? getLineIndent(document, openWin.range.line);
  const rebuilt = `OpenWindow(${params.join(", ")})`;
  edit.replace(
    document.uri,
    new vscode.Range(document.positionAt(openWin.range.lineStart), document.positionAt(openWin.range.end)),
    `${indent}${rebuilt}`
  );

  // 3) Best-effort: rewrite first-call-arg within the same procedure: oldEnum -> newEnum
  if (proc && oldEnum !== newEnum) {
    const inProc = calls.filter(c => c.range.line >= proc.startLine && c.range.line <= proc.endLine);
    for (const c of inProc) {
      if (c.name === "OpenWindow") continue;
      const p = splitParams(c.args);
      if (!p.length) continue;
      if ((p[0] ?? "").trim() !== oldEnum) continue;

      p[0] = newEnum;
      const rebuiltCall = `${c.name}(${p.join(", ")})`;
      const i2 = c.indent ?? getLineIndent(document, c.range.line);
      const updatedLine = c.assignedVar ? `${i2}${c.assignedVar} = ${rebuiltCall}` : `${i2}${rebuiltCall}`;

      edit.replace(
        document.uri,
        new vscode.Range(document.positionAt(c.range.lineStart), document.positionAt(c.range.end)),
        updatedLine
      );
    }
  }

  // 4) Patch "Procedure OpenX(...)" (and calls) if possible
  if (oldProcName && newProcName) {
    patchProcedureNameInBlock(edit, document, proc, oldProcName, newProcName);
    patchProcedureCallsBestEffort(edit, document, calls, oldProcName, newProcName, scanRange);
  }

  return edit;
}

function findInsertAfterLineForGadgetEntry(
  document: vscode.TextDocument,
  calls: PbCall[],
  gadgetKey: string,
  entryNameLower: string
): { insertAfterLine: number; indent: string } | undefined {
  const own = findCallsByName(calls, entryNameLower).filter(c => firstParamOfCall(c.args) === gadgetKey);

  let insertAfterLine: number | undefined;
  if (own.length > 0) {
    insertAfterLine = own[own.length - 1].range.line;
  } else {
    const all = findCallsByName(calls, entryNameLower);
    if (all.length > 0) {
      insertAfterLine = all[all.length - 1].range.line;
    } else {
      const createCall = findCallByStableKey(calls, gadgetKey, n => /gadget$/i.test(n));
      if (!createCall) return undefined;
      insertAfterLine = createCall.range.line;
    }
  }

  const indent = getLineIndent(document, insertAfterLine);
  return { insertAfterLine, indent };
}

function findGadgetEntryCallAtLine(
  calls: PbCall[],
  entryNameLower: string,
  gadgetKey: string,
  sourceLine: number
): PbCall | undefined {
  return calls.find(
    c => c.name.toLowerCase() === entryNameLower && c.range.line === sourceLine && firstParamOfCall(c.args) === gadgetKey
  );
}

export function applyGadgetItemInsert(
  document: vscode.TextDocument,
  gadgetKey: string,
  args: GadgetItemArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);

  const insert = findInsertAfterLineForGadgetEntry(document, calls, gadgetKey, "addgadgetitem");
  if (!insert) return undefined;

  const insertPos = new vscode.Position(Math.min(document.lineCount, insert.insertAfterLine + 1), 0);
  const line = `${insert.indent}AddGadgetItem(${buildAddGadgetItemArgs(gadgetKey, args)})\n`;

  const edit = new vscode.WorkspaceEdit();
  edit.insert(document.uri, insertPos, line);
  return edit;
}

export function applyGadgetItemUpdate(
  document: vscode.TextDocument,
  gadgetKey: string,
  sourceLine: number,
  args: GadgetItemArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  if (sourceLine < 0 || sourceLine >= document.lineCount) return undefined;

  const calls = scanDocumentCalls(document, scanRange);

  const call = findGadgetEntryCallAtLine(calls, "addgadgetitem", gadgetKey, sourceLine);
  if (!call) return undefined;

  const indent = getLineIndent(document, sourceLine);
  const rebuilt = `${indent}AddGadgetItem(${buildAddGadgetItemArgs(gadgetKey, args)})`;
  return replaceCallLinePreserveSuffix(document, call, rebuilt);
}

export function applyGadgetItemDelete(
  document: vscode.TextDocument,
  gadgetKey: string,
  sourceLine: number,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  if (sourceLine < 0 || sourceLine >= document.lineCount) return undefined;

  const parsed = parseFormDocument(document.getText());
  const gadget = parsed.gadgets.find(entry => entry.id === gadgetKey);
  const calls = scanDocumentCalls(document, scanRange);

  const call = findGadgetEntryCallAtLine(calls, "addgadgetitem", gadgetKey, sourceLine);
  if (!call) return undefined;

  const edit = new vscode.WorkspaceEdit();
  const deletedIds = new Set<string>();

  if (gadget?.kind === GADGET_KIND.PanelGadget) {
    const itemIndex = gadget.items?.findIndex(item => item.source?.line === sourceLine) ?? -1;
    const item = itemIndex >= 0 ? gadget.items?.[itemIndex] : undefined;
    const panelItem = typeof item?.index === "number" ? item.index : itemIndex;

    if (panelItem >= 0) {
      const tabRootIds = parsed.gadgets
        .filter(entry => entry.parentId === gadgetKey && entry.parentItem === panelItem)
        .map(entry => entry.id);

      for (const deletedId of collectOriginalGadgetDeleteIdsForRoots(parsed.gadgets, tabRootIds)) {
        deletedIds.add(deletedId);
      }
    }
  }

  const gadgetListParentIds = buildGadgetListParentIds(parsed.gadgets);
  const deletedGadgets = parsed.gadgets.filter(entry => deletedIds.has(entry.id));
  const lineNumbers = collectDeletedGadgetLineNumbers(calls, deletedIds, gadgetListParentIds);

  for (const line of collectDeletedCustomGadgetLineNumbers(document, deletedGadgets)) {
    lineNumbers.add(line);
  }
  lineNumbers.add(sourceLine);

  for (const line of [...lineNumbers].sort((a, b) => b - a)) {
    edit.delete(document.uri, document.lineAt(line).rangeIncludingLineBreak);
  }

  for (const deletedGadget of deletedGadgets) {
    if (!deletedGadget.eventProc) continue;
    appendWorkspaceEdit(edit, applyGadgetEventProcUpdate(document, deletedGadget.id, undefined, scanRange));
  }

  const remainingGadgets = deletedIds.size
    ? parsed.gadgets.filter(entry => !deletedIds.has(entry.id))
    : parsed.gadgets;
  applyGadgetHeadPatchForGadgets(edit, document, remainingGadgets);
  return edit;
}



type PanelItemLineBlock = {
  index: number;
  startLine: number;
  endLine: number;
};

function findPanelItemLineBlocks(
  document: vscode.TextDocument,
  calls: PbCall[],
  panel: Gadget,
  gadgetListParentIds: ReadonlySet<string>
): PanelItemLineBlock[] {
  const panelCreate = findCallByStableKey(calls, panel.id, name => /gadget$/i.test(name));
  if (!panelCreate) return [];

  const proc = findProcedureBlock(document, panelCreate.range.line);
  if (!proc) return [];

  const blocks: PanelItemLineBlock[] = [];
  let depth = 1;
  let currentStart: number | undefined;
  let currentIndex = -1;

  for (const call of calls) {
    if (call.range.line <= panelCreate.range.line) continue;
    if (call.range.line > proc.endLine) break;

    const nameLower = call.name.toLowerCase();

    if (nameLower === "closegadgetlist") {
      depth -= 1;
      if (depth === 0) {
        if (currentStart !== undefined) {
          blocks.push({ index: currentIndex, startLine: currentStart, endLine: call.range.line - 1 });
        }
        break;
      }
      continue;
    }

    if (depth === 1 && nameLower === "addgadgetitem" && firstParamOfCall(call.args) === panel.id) {
      if (currentStart !== undefined) {
        blocks.push({ index: currentIndex, startLine: currentStart, endLine: call.range.line - 1 });
      }
      currentIndex += 1;
      currentStart = call.range.line;
      continue;
    }

    if (isImplicitGadgetListStarterCall(call, gadgetListParentIds)) {
      depth += 1;
    }
  }

  return blocks.filter(block => block.startLine <= block.endLine && block.endLine < document.lineCount);
}

function getDocumentLineBlockText(document: vscode.TextDocument, block: PanelItemLineBlock): string {
  const text = document.getText();
  const start = document.offsetAt(new vscode.Position(block.startLine, 0));
  const endLine = document.lineAt(block.endLine);
  const end = document.offsetAt(endLine.rangeIncludingLineBreak.end);
  return text.slice(start, end);
}

export function applyPanelGadgetItemMove(
  document: vscode.TextDocument,
  gadgetKey: string,
  sourceLine: number,
  direction: "up" | "down",
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  if (sourceLine < 0 || sourceLine >= document.lineCount) return undefined;

  const parsed = parseFormDocument(document.getText());
  const panel = parsed.gadgets.find(entry => entry.id === gadgetKey);
  if (panel?.kind !== GADGET_KIND.PanelGadget) return undefined;

  const calls = scanDocumentCalls(document, scanRange);
  const gadgetListParentIds = buildGadgetListParentIds(parsed.gadgets);
  const blocks = findPanelItemLineBlocks(document, calls, panel, gadgetListParentIds);
  const sourceIndex = blocks.findIndex(block => block.startLine === sourceLine);
  if (sourceIndex < 0) return undefined;

  const targetIndex = direction === "up" ? sourceIndex - 1 : sourceIndex + 1;
  if (targetIndex < 0 || targetIndex >= blocks.length) return undefined;

  const firstIndex = Math.min(sourceIndex, targetIndex);
  const secondIndex = Math.max(sourceIndex, targetIndex);
  const first = blocks[firstIndex];
  const second = blocks[secondIndex];
  if (first.endLine + 1 !== second.startLine) return undefined;

  const firstText = getDocumentLineBlockText(document, first);
  const secondText = getDocumentLineBlockText(document, second);
  const start = new vscode.Position(first.startLine, 0);
  const end = document.lineAt(second.endLine).rangeIncludingLineBreak.end;

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, new vscode.Range(start, end), `${secondText}${firstText}`);
  return edit;
}

export function applyGadgetColumnInsert(
  document: vscode.TextDocument,
  gadgetKey: string,
  args: GadgetColumnArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);

  const insert = findInsertAfterLineForGadgetEntry(document, calls, gadgetKey, "addgadgetcolumn");
  if (!insert) return undefined;

  const insertPos = new vscode.Position(Math.min(document.lineCount, insert.insertAfterLine + 1), 0);
  const line = `${insert.indent}AddGadgetColumn(${buildAddGadgetColumnArgs(gadgetKey, args)})\n`;

  const edit = new vscode.WorkspaceEdit();
  edit.insert(document.uri, insertPos, line);
  return edit;
}

export function applyGadgetColumnUpdate(
  document: vscode.TextDocument,
  gadgetKey: string,
  sourceLine: number,
  args: GadgetColumnArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  if (sourceLine < 0 || sourceLine >= document.lineCount) return undefined;

  const calls = scanDocumentCalls(document, scanRange);

  const call = findGadgetEntryCallAtLine(calls, "addgadgetcolumn", gadgetKey, sourceLine);
  if (!call) return undefined;

  const indent = getLineIndent(document, sourceLine);
  const rebuilt = `${indent}AddGadgetColumn(${buildAddGadgetColumnArgs(gadgetKey, args)})`;
  return replaceCallLinePreserveSuffix(document, call, rebuilt);
}

export function applyGadgetColumnDelete(
  document: vscode.TextDocument,
  gadgetKey: string,
  sourceLine: number,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  if (sourceLine < 0 || sourceLine >= document.lineCount) return undefined;

  const calls = scanDocumentCalls(document, scanRange);

  const call = findGadgetEntryCallAtLine(calls, "addgadgetcolumn", gadgetKey, sourceLine);
  if (!call) return undefined;

  const edit = new vscode.WorkspaceEdit();
  edit.delete(document.uri, document.lineAt(sourceLine).rangeIncludingLineBreak);
  applyGadgetHeadPatch(edit, document);
  return edit;
}

// -----------------------------------------------------------------------------
// Menu / ToolBar / StatusBar emitters
// -----------------------------------------------------------------------------

const MENU_ENTRY_NAMES = new Set(["menutitle", "menuitem", "menubar", "opensubmenu", "closesubmenu"]);
const TOOLBAR_ENTRY_NAMES = new Set([
  "toolbarstandardbutton",
  "toolbarbutton",
  "toolbarimagebutton",
  "toolbarseparator",
  "toolbartooltip"
]);
const STATUSBAR_FIELD_NAMES = new Set(["addstatusbarfield", "statusbartext", "statusbarprogress", "statusbarimage"]);
const IMAGE_ENTRY_NAMES = new Set(["loadimage", "catchimage"]);
const WINDOW_PROPERTY_NAMES = new Set(["hidewindow", "disablewindow", "setwindowcolor"]);
const GADGET_PROPERTY_NAMES = new Set(["hidegadget", "disablegadget", "gadgettooltip", "setgadgetstate", "setgadgetcolor", "setgadgetfont"]);

function cloneGadgetForProperties(gadget: Gadget): Gadget {
  return {
    ...gadget,
    items: gadget.items ? [...gadget.items] : undefined,
    columns: gadget.columns ? [...gadget.columns] : undefined,
  };
}

function normalizeOptionalRaw(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  return trimmed && trimmed.length ? trimmed : undefined;
}

function normalizeOptionalGridString(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  return raw.length ? raw : undefined;
}

function cloneWindowForProperties(window: FormWindow): FormWindow {
  return { ...window };
}

function findWindowEventIncludeLine(document: vscode.TextDocument, procedureStartLine: number): number | undefined {
  for (let i = Math.min(procedureStartLine - 1, document.lineCount - 1); i >= 0; i--) {
    const line = document.lineAt(i).text;

    if (/^\s*Procedure\b/i.test(line) || /^\s*EndProcedure\b/i.test(line)) {
      break;
    }

    if (/^\s*XIncludeFile\s+(~?"(?:""|[^"])*")/i.test(line)) {
      return i;
    }
  }

  return undefined;
}

function findWindowEventGadgetBlock(document: vscode.TextDocument, proc: LineBlock): WindowEventProcBlock | undefined {
  let selectLine: number | undefined;

  for (let i = proc.startLine; i <= proc.endLine; i++) {
    const line = document.lineAt(i).text.split(";")[0]?.trim() ?? "";
    if (/^Select\s+EventGadget\s*\(\s*\)\s*$/i.test(line)) {
      selectLine = i;
      break;
    }
  }

  if (selectLine === undefined) return undefined;

  let depth = 0;
  let defaultLine: number | undefined;
  let procLine: number | undefined;
  let pendingDefaultProc = false;
  let hasCaseBranches = false;

  for (let i = selectLine; i <= proc.endLine; i++) {
    const line = document.lineAt(i).text.split(";")[0]?.trim() ?? "";
    if (!line.length) continue;

    if (/^Select\b/i.test(line)) {
      depth++;
      continue;
    }

    if (/^EndSelect\b/i.test(line)) {
      depth--;
      if (depth <= 0) {
        return { selectLine, endLine: i, defaultLine, procLine, hasCaseBranches };
      }
      continue;
    }

    if (depth !== 1) continue;

    if (/^Case\b/i.test(line)) {
      hasCaseBranches = true;
      pendingDefaultProc = false;
      continue;
    }

    if (/^Default\b/i.test(line)) {
      defaultLine = i;
      pendingDefaultProc = true;
      continue;
    }

    if (!pendingDefaultProc) continue;

    if (/^[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(line)) {
      procLine = i;
      pendingDefaultProc = false;
    }
  }

  return undefined;
}

function findEventCaseBranch(
  document: vscode.TextDocument,
  block: LineBlock,
  matchesCase: (caseRaw: string) => boolean
): EventCaseBranch | undefined {
  let depth = 0;
  let current: EventCaseBranch | undefined;

  const finalizeCurrent = (boundaryLine: number): EventCaseBranch | undefined => {
    if (!current) return undefined;
    current.boundaryLine = boundaryLine;
    const result = matchesCase(current.caseRaw) ? current : undefined;
    current = undefined;
    return result;
  };

  for (let i = block.startLine; i <= block.endLine; i++) {
    const line = document.lineAt(i).text.split(";")[0]?.trim() ?? "";
    if (!line.length) continue;

    if (/^Select\b/i.test(line)) {
      depth++;
      continue;
    }

    if (/^EndSelect\b/i.test(line)) {
      if (depth === 1) {
        const branch = finalizeCurrent(i);
        if (branch) return branch;
      }

      depth--;
      if (depth <= 0) break;
      continue;
    }

    if (depth !== 1) continue;

    if (/^Default\b/i.test(line)) {
      const branch = finalizeCurrent(i);
      if (branch) return branch;
      continue;
    }

    const caseMatch = /^Case\b(.+)$/.exec(line);
    if (caseMatch) {
      const branch = finalizeCurrent(i);
      if (branch) return branch;

      current = {
        caseLine: i,
        caseRaw: caseMatch[1]?.trim() ?? "",
        boundaryLine: block.endLine,
      };
      continue;
    }

    if (!current || current.procLine !== undefined) continue;

    if (/^[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(line)) {
      current.procLine = i;
    }
  }

  return undefined;
}

function insertEventCaseBranch(
  document: vscode.TextDocument,
  insertLine: number,
  selectLine: number,
  caseRaw: string,
  procCall: string
): vscode.WorkspaceEdit {
  const selectIndent = getLineIndent(document, selectLine);
  const caseIndent = `${selectIndent}  `;
  const procIndent = `${caseIndent}  `;
  const edit = new vscode.WorkspaceEdit();
  edit.insert(document.uri, new vscode.Position(insertLine, 0), `${caseIndent}Case ${caseRaw}
${procIndent}${procCall}
`);
  return edit;
}

function replaceEventProcLine(
  document: vscode.TextDocument,
  procLine: number,
  procCall: string
): vscode.WorkspaceEdit {
  const indent = getLineIndent(document, procLine);
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, document.lineAt(procLine).range, `${indent}${procCall}`);
  return edit;
}

function insertEventProcLineAfterCase(
  document: vscode.TextDocument,
  caseLine: number,
  procCall: string
): vscode.WorkspaceEdit {
  const procIndent = `${getLineIndent(document, caseLine)}  `;
  const edit = new vscode.WorkspaceEdit();
  edit.insert(document.uri, new vscode.Position(caseLine + 1, 0), `${procIndent}${procCall}
`);
  return edit;
}

function deleteEventCaseBranch(
  document: vscode.TextDocument,
  branch: EventCaseBranch
): vscode.WorkspaceEdit {
  const edit = new vscode.WorkspaceEdit();
  edit.delete(
    document.uri,
    new vscode.Range(
      new vscode.Position(branch.caseLine, 0),
      new vscode.Position(branch.boundaryLine, 0)
    )
  );
  return edit;
}

function findWindowEventMenuBlock(document: vscode.TextDocument, proc: LineBlock): LineBlock | undefined {
  let selectLine: number | undefined;

  for (let i = proc.startLine; i <= proc.endLine; i++) {
    const line = document.lineAt(i).text.split(";")[0]?.trim() ?? "";
    if (/^Select\s+EventMenu\s*\(\s*\)\s*$/i.test(line)) {
      selectLine = i;
      break;
    }
  }

  if (selectLine === undefined) return undefined;

  let depth = 0;

  for (let i = selectLine; i <= proc.endLine; i++) {
    const line = document.lineAt(i).text.split(";")[0]?.trim() ?? "";
    if (!line.length) continue;

    if (/^Select\b/i.test(line)) {
      depth++;
      continue;
    }

    if (/^EndSelect\b/i.test(line)) {
      depth--;
      if (depth <= 0) {
        return { startLine: selectLine, endLine: i };
      }
    }
  }

  return undefined;
}

function findWindowEventSelectBlock(document: vscode.TextDocument, proc: LineBlock): WindowEventProcBlock | undefined {
  let selectLine: number | undefined;

  for (let i = proc.startLine; i <= proc.endLine; i++) {
    const line = document.lineAt(i).text.split(";")[0]?.trim() ?? "";
    if (/^Select\s+event\b/i.test(line)) {
      selectLine = i;
      break;
    }
  }

  if (selectLine === undefined) return undefined;

  let depth = 0;
  let defaultLine: number | undefined;
  let procLine: number | undefined;
  let pendingDefaultProc = false;
  let hasCaseBranches = false;

  for (let i = selectLine; i <= proc.endLine; i++) {
    const line = document.lineAt(i).text.split(";")[0]?.trim() ?? "";
    if (!line.length) continue;

    if (/^Select\b/i.test(line)) {
      depth++;
      continue;
    }

    if (/^EndSelect\b/i.test(line)) {
      depth--;
      if (depth <= 0) {
        return { selectLine, endLine: i, defaultLine, procLine, hasCaseBranches };
      }
      continue;
    }

    if (depth !== 1) continue;

    if (/^Case\b/i.test(line)) {
      hasCaseBranches = true;
      pendingDefaultProc = false;
      continue;
    }

    if (/^Default\b/i.test(line)) {
      defaultLine = i;
      pendingDefaultProc = true;
      continue;
    }

    if (!pendingDefaultProc) continue;

    if (/^[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(line)) {
      procLine = i;
      pendingDefaultProc = false;
    }
  }

  return undefined;
}

function findWindowDefaultHandlerBlock(document: vscode.TextDocument, proc: LineBlock): WindowEventProcBlock | undefined {
  return findWindowEventSelectBlock(document, proc);
}

function blockHasCaseBranches(document: vscode.TextDocument, block: LineBlock): boolean {
  let depth = 0;

  for (let i = block.startLine; i <= block.endLine; i++) {
    const line = document.lineAt(i).text.split(";")[0]?.trim() ?? "";
    if (!line.length) continue;

    if (/^Select\b/i.test(line)) {
      depth++;
      continue;
    }

    if (/^EndSelect\b/i.test(line)) {
      depth--;
      if (depth <= 0) break;
      continue;
    }

    if (depth === 1 && /^Case\b/i.test(line)) {
      return true;
    }
  }

  return false;
}

function buildWindowEventProcCall(window: FormWindow, procName: string): string {
  return `${procName}(event, ${window.id})`;
}

function buildGadgetEventProcCall(procName: string): string {
  return `${procName}(EventType())`;
}

function buildMenuEventProcCall(procName: string): string {
  return `${procName}(EventMenu())`;
}

type EventBinding = {
  caseRaw: string;
  procName: string;
};

function collectMenuEventBindings(
  parsed: ReturnType<typeof parseFormDocument>,
  override?: { entryIdRaw: string; eventProc?: string }
): EventBinding[] {
  const bindings: EventBinding[] = [];

  const pushEntry = (entryIdRaw: string | undefined, eventProc: string | undefined) => {
    if (!entryIdRaw) return;
    const rawProc = override && override.entryIdRaw === entryIdRaw ? override.eventProc : eventProc;
    const normalizedProc = normalizeOptionalRaw(rawProc);
    if (!normalizedProc) return;
    bindings.push({ caseRaw: entryIdRaw, procName: normalizedProc });
  };

  for (const entry of parsed.menus.flatMap(menu => menu.entries)) {
    pushEntry(entry.idRaw, entry.event);
  }

  for (const entry of parsed.toolbars.flatMap(toolBar => toolBar.entries)) {
    pushEntry(entry.idRaw, entry.event);
  }

  return bindings;
}

function collectGadgetEventBindings(
  parsed: ReturnType<typeof parseFormDocument>,
  override?: { gadgetKey: string; eventProc?: string }
): EventBinding[] {
  const bindings: EventBinding[] = [];

  for (const gadget of parsed.gadgets) {
    const rawProc = override && override.gadgetKey === gadget.id ? override.eventProc : gadget.eventProc;
    const normalizedProc = normalizeOptionalGridString(rawProc);
    if (!normalizedProc) continue;
    bindings.push({ caseRaw: gadget.id, procName: normalizedProc });
  }

  return bindings;
}

function buildSeparateWindowEventsProcedure(
  document: vscode.TextDocument,
  window: FormWindow,
  options: {
    windowEventProc?: string;
    gadgetBindings?: EventBinding[];
    menuBindings?: EventBinding[];
    includeSizeWindow?: boolean;
  }
): string {
  const base = window.variable ?? windowBaseFromSymbol(window.id);
  const eventProcName = buildEventsProcName(base);
  const resizeProcName = buildResizeProcName(base);
  const includeSizeWindow = options.includeSizeWindow ?? !!findProcedureBlockByName(document, resizeProcName);
  const menuBindings = options.menuBindings ?? [];
  const gadgetBindings = options.gadgetBindings ?? [];
  const windowEventProc = normalizeOptionalGridString(options.windowEventProc);
  const lines: string[] = [
    `Procedure ${eventProcName}(event)`,
    `  Select event`,
  ];

  if (includeSizeWindow) {
    lines.push(
      `    Case #PB_Event_SizeWindow`,
      `      ${resizeProcName}()`
    );
  }

  lines.push(
    `    Case #PB_Event_CloseWindow`,
    `      ProcedureReturn #False`,
    ``,
    `    Case #PB_Event_Menu`,
    `      Select EventMenu()`
  );

  for (const binding of menuBindings) {
    lines.push(
      `        Case ${binding.caseRaw}`,
      `          ${buildMenuEventProcCall(binding.procName)}`
    );
  }

  lines.push(
    `      EndSelect`,
    ``,
    `    Case #PB_Event_Gadget`,
    `      Select EventGadget()`
  );

  for (const binding of gadgetBindings) {
    lines.push(
      `        Case ${binding.caseRaw}`,
      `          ${buildGadgetEventProcCall(binding.procName)}`
    );
  }

  lines.push(`      EndSelect`);

  if (windowEventProc) {
    lines.push(
      `    Default`,
      `      ${buildWindowEventProcCall(window, windowEventProc)}`
    );
  }

  lines.push(
    `  EndSelect`,
    `  ProcedureReturn #True`,
    `EndProcedure`,
    ``
  );

  return `${lines.join("\n")}\n`;
}

function insertSeparateWindowEventsProcedure(
  edit: vscode.WorkspaceEdit,
  document: vscode.TextDocument,
  openProc: LineBlock,
  procedureText: string
): void {
  let insertLine = openProc.endLine + 1;
  let hasBlankSeparator = false;

  while (insertLine < document.lineCount && document.lineAt(insertLine).text.trim() === "") {
    hasBlankSeparator = true;
    insertLine++;
  }

  const text = hasBlankSeparator ? procedureText : `

${procedureText}`;
  edit.insert(document.uri, new vscode.Position(insertLine, 0), text);
}


export function applyWindowEventUpdate(
  document: vscode.TextDocument,
  windowKey: string,
  args: WindowEventArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const parsed = parseFormDocument(document.getText());
  const window = parsed.window;
  if (!window || window.id !== windowKey) return undefined;

  const calls = scanDocumentCalls(document, scanRange);
  const openCall = findCallByStableKey(calls, windowKey, name => name === "OpenWindow");
  if (!openCall) return undefined;

  const proc = findProcedureBlock(document, openCall.range.line);
  if (!proc) return undefined;

  const includeLine = findWindowEventIncludeLine(document, proc.startLine);
  const eventFileRaw = normalizeOptionalRaw(args.eventFileRaw);
  const edit = new vscode.WorkspaceEdit();

  if (includeLine !== undefined) {
    if (!eventFileRaw) {
      edit.delete(document.uri, document.lineAt(includeLine).rangeIncludingLineBreak);
      return edit;
    }

    const indent = getLineIndent(document, includeLine);
    edit.replace(document.uri, document.lineAt(includeLine).range, `${indent}XIncludeFile ${eventFileRaw}`);
    return edit;
  }

  if (!eventFileRaw) return undefined;

  edit.insert(document.uri, new vscode.Position(proc.startLine, 0), `XIncludeFile ${eventFileRaw}\n`);
  return edit;
}

export function applyWindowGenerateEventLoopUpdate(
  document: vscode.TextDocument,
  windowKey: string,
  enabled: boolean,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const parsed = parseFormDocument(document.getText());
  const window = parsed.window;
  if (!window || window.id !== windowKey) return undefined;

  const calls = scanDocumentCalls(document, scanRange);
  const openCall = findCallByStableKey(calls, windowKey, name => name === "OpenWindow");
  if (!openCall) return undefined;

  const context = resolveWindowEventBootstrapContext(document, window, openCall.range.line);
  if (!context) return undefined;

  if (!enabled) {
    if (!context.eventProc) return undefined;

    const eventGadgetBlock = findWindowEventGadgetBlock(document, context.eventProc);
    const eventMenuBlock = findWindowEventMenuBlock(document, context.eventProc);
    if (!eventGadgetBlock && !eventMenuBlock) return undefined;

    const menuHasCases = eventMenuBlock ? blockHasCaseBranches(document, eventMenuBlock) : false;
    const gadgetHasCases = eventGadgetBlock?.hasCaseBranches ?? false;
    if (menuHasCases || gadgetHasCases) return undefined;

    const edit = new vscode.WorkspaceEdit();
    edit.delete(
      document.uri,
      new vscode.Range(
        new vscode.Position(context.eventProc.startLine, 0),
        new vscode.Position(context.eventProc.endLine + 1, 0)
      )
    );
    return edit;
  }

  if (context.eventProc) {
    const eventGadgetBlock = findWindowEventGadgetBlock(document, context.eventProc);
    const eventMenuBlock = findWindowEventMenuBlock(document, context.eventProc);
    if (eventGadgetBlock || eventMenuBlock) return undefined;
  }

  const edit = new vscode.WorkspaceEdit();
  if (!context.eventProc) {
    if (hasUnsupportedInlineWindowEventBlocks(document, context.openProc)) return undefined;
    const procedureText = buildSeparateWindowEventsProcedure(document, window, {
      windowEventProc: parsed.window?.eventProc,
      menuBindings: collectMenuEventBindings(parsed),
      gadgetBindings: collectGadgetEventBindings(parsed),
    });
    insertSeparateWindowEventsProcedure(edit, document, context.openProc, procedureText);
    return edit;
  }

  const procedureText = buildSeparateWindowEventsProcedure(document, window, {
    windowEventProc: parsed.window?.eventProc,
    menuBindings: collectMenuEventBindings(parsed),
    gadgetBindings: collectGadgetEventBindings(parsed),
  });
  edit.replace(
    document.uri,
    new vscode.Range(
      new vscode.Position(context.eventProc.startLine, 0),
      new vscode.Position(context.eventProc.endLine + 1, 0)
    ),
    procedureText
  );
  return edit;
}

export function applyWindowEventProcUpdate(
  document: vscode.TextDocument,
  windowKey: string,
  eventProc: string | undefined,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const parsed = parseFormDocument(document.getText());
  const window = parsed.window;
  if (!window || window.id !== windowKey) return undefined;

  const calls = scanDocumentCalls(document, scanRange);
  const openCall = findCallByStableKey(calls, windowKey, name => name === "OpenWindow");
  if (!openCall) return undefined;

  const context = resolveWindowEventBootstrapContext(document, window, openCall.range.line);
  if (!context) return undefined;

  const normalizedEventProc = normalizeOptionalGridString(eventProc);
  if (!context.eventProc) {
    if (!normalizedEventProc) return undefined;
    if (hasUnsupportedInlineWindowEventBlocks(document, context.openProc)) return undefined;

    const edit = new vscode.WorkspaceEdit();
    const procedureText = buildSeparateWindowEventsProcedure(document, window, {
      windowEventProc: normalizedEventProc,
      menuBindings: collectMenuEventBindings(parsed),
      gadgetBindings: collectGadgetEventBindings(parsed),
    });
    insertSeparateWindowEventsProcedure(edit, document, context.openProc, procedureText);
    return edit;
  }

  const block = findWindowDefaultHandlerBlock(document, context.eventProc);
  if (!block) return undefined;

  const procCall = normalizedEventProc
    ? buildWindowEventProcCall(window, normalizedEventProc)
    : undefined;
  const edit = new vscode.WorkspaceEdit();

  if (block.procLine !== undefined) {
    if (!procCall) {
      if (block.defaultLine !== undefined) {
        edit.delete(document.uri, document.lineAt(block.defaultLine).rangeIncludingLineBreak);
      }
      edit.delete(document.uri, document.lineAt(block.procLine).rangeIncludingLineBreak);
      return edit;
    }

    return replaceEventProcLine(document, block.procLine, procCall);
  }

  if (!procCall) return undefined;

  if (block.defaultLine !== undefined) {
    const indent = `${getLineIndent(document, block.defaultLine)}  `;
    edit.insert(document.uri, new vscode.Position(block.defaultLine + 1, 0), `${indent}${procCall}
`);
    return edit;
  }

  const selectIndent = getLineIndent(document, block.selectLine);
  const defaultIndent = `${selectIndent}  `;
  const procIndent = `${defaultIndent}  `;
  edit.insert(
    document.uri,
    new vscode.Position(block.endLine, 0),
    `${defaultIndent}Default
${procIndent}${procCall}
`
  );
  return edit;
}

export function applyGadgetEventProcUpdate(
  document: vscode.TextDocument,
  gadgetKey: string,
  eventProc: string | undefined,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const parsed = parseFormDocument(document.getText());
  const gadget = parsed.gadgets.find((entry) => entry.id === gadgetKey);
  if (!gadget) return undefined;
  const window = parsed.window;
  if (!window) return undefined;

  const calls = scanDocumentCalls(document, scanRange);
  const openCall = findCallByStableKey(calls, window.id, (name) => name === "OpenWindow");
  if (!openCall) return undefined;

  const context = resolveWindowEventBootstrapContext(document, window, openCall.range.line);
  if (!context) return undefined;

  const normalizedEventProc = normalizeOptionalGridString(eventProc);
  if (!context.eventProc) {
    if (!normalizedEventProc) return undefined;
    if (hasUnsupportedInlineWindowEventBlocks(document, context.openProc)) return undefined;

    const edit = new vscode.WorkspaceEdit();
    const procedureText = buildSeparateWindowEventsProcedure(document, window, {
      windowEventProc: parsed.window?.eventProc,
      menuBindings: collectMenuEventBindings(parsed),
      gadgetBindings: collectGadgetEventBindings(parsed, { gadgetKey, eventProc: normalizedEventProc }),
    });
    insertSeparateWindowEventsProcedure(edit, document, context.openProc, procedureText);
    return edit;
  }

  const block = findWindowEventGadgetBlock(document, context.eventProc);
  if (!block) return undefined;

  const caseRaw = gadget.id;
  const branch = findEventCaseBranch(document, { startLine: block.selectLine, endLine: block.endLine }, (raw) => raw === caseRaw);
  const procCall = normalizedEventProc
    ? buildGadgetEventProcCall(normalizedEventProc)
    : undefined;

  if (branch) {
    if (!procCall) {
      return deleteEventCaseBranch(document, branch);
    }

    if (branch.procLine !== undefined) {
      return replaceEventProcLine(document, branch.procLine, procCall);
    }

    return insertEventProcLineAfterCase(document, branch.caseLine, procCall);
  }

  if (!procCall) return undefined;

  const insertLine = block.defaultLine ?? block.endLine;
  return insertEventCaseBranch(document, insertLine, block.selectLine, caseRaw, procCall);
}

export function applyMenuEntryEventUpdate(
  document: vscode.TextDocument,
  entryIdRaw: string,
  eventProc: string | undefined,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const parsed = parseFormDocument(document.getText());
  const menuEntry = parsed.menus.flatMap((menu) => menu.entries).find((entry) => entry.idRaw === entryIdRaw);
  if (!menuEntry) return undefined;
  const window = parsed.window;
  if (!window) return undefined;

  const calls = scanDocumentCalls(document, scanRange);
  const openCall = findCallByStableKey(calls, window.id, (name) => name === "OpenWindow");
  if (!openCall) return undefined;

  const context = resolveWindowEventBootstrapContext(document, window, openCall.range.line);
  if (!context) return undefined;

  const normalizedEventProc = normalizeOptionalRaw(eventProc);
  if (!context.eventProc) {
    if (!normalizedEventProc) return undefined;
    if (hasUnsupportedInlineWindowEventBlocks(document, context.openProc)) return undefined;

    const edit = new vscode.WorkspaceEdit();
    const procedureText = buildSeparateWindowEventsProcedure(document, window, {
      windowEventProc: parsed.window?.eventProc,
      menuBindings: collectMenuEventBindings(parsed, { entryIdRaw, eventProc: normalizedEventProc }),
      gadgetBindings: collectGadgetEventBindings(parsed),
    });
    insertSeparateWindowEventsProcedure(edit, document, context.openProc, procedureText);
    return edit;
  }

  const block = findWindowEventMenuBlock(document, context.eventProc);
  if (!block) return undefined;

  const branch = findEventCaseBranch(document, block, (raw) => raw === entryIdRaw);
  const procCall = normalizedEventProc
    ? buildMenuEventProcCall(normalizedEventProc)
    : undefined;

  if (branch) {
    if (!procCall) {
      return deleteEventCaseBranch(document, branch);
    }

    if (branch.procLine !== undefined) {
      return replaceEventProcLine(document, branch.procLine, procCall);
    }

    return insertEventProcLineAfterCase(document, branch.caseLine, procCall);
  }

  if (!procCall) return undefined;

  return insertEventCaseBranch(document, block.endLine, block.startLine, entryIdRaw, procCall);
}

export function applyToolBarEntryEventUpdate(
  document: vscode.TextDocument,
  entryIdRaw: string,
  eventProc: string | undefined,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const parsed = parseFormDocument(document.getText());
  const toolBarEntry = parsed.toolbars.flatMap((toolBar) => toolBar.entries).find((entry) => entry.idRaw === entryIdRaw);
  if (!toolBarEntry) return undefined;
  const window = parsed.window;
  if (!window) return undefined;

  const calls = scanDocumentCalls(document, scanRange);
  const openCall = findCallByStableKey(calls, window.id, (name) => name === "OpenWindow");
  if (!openCall) return undefined;

  const context = resolveWindowEventBootstrapContext(document, window, openCall.range.line);
  if (!context) return undefined;

  const normalizedEventProc = normalizeOptionalRaw(eventProc);
  if (!context.eventProc) {
    if (!normalizedEventProc) return undefined;
    if (hasUnsupportedInlineWindowEventBlocks(document, context.openProc)) return undefined;

    const edit = new vscode.WorkspaceEdit();
    const procedureText = buildSeparateWindowEventsProcedure(document, window, {
      windowEventProc: parsed.window?.eventProc,
      menuBindings: collectMenuEventBindings(parsed, { entryIdRaw, eventProc: normalizedEventProc }),
      gadgetBindings: collectGadgetEventBindings(parsed),
    });
    insertSeparateWindowEventsProcedure(edit, document, context.openProc, procedureText);
    return edit;
  }

  const block = findWindowEventMenuBlock(document, context.eventProc);
  if (!block) return undefined;

  const branch = findEventCaseBranch(document, block, (raw) => raw === entryIdRaw);
  const procCall = normalizedEventProc
    ? buildMenuEventProcCall(normalizedEventProc)
    : undefined;

  if (branch) {
    if (!procCall) {
      return deleteEventCaseBranch(document, branch);
    }

    if (branch.procLine !== undefined) {
      return replaceEventProcLine(document, branch.procLine, procCall);
    }

    return insertEventProcLineAfterCase(document, branch.caseLine, procCall);
  }

  if (!procCall) return undefined;

  return insertEventCaseBranch(document, block.endLine, block.startLine, entryIdRaw, procCall);
}

function buildWindowPropertyLines(windowKey: string, window: FormWindow, indent: string): string {
  const lines: string[] = [];

  const hiddenRaw = normalizeOptionalRaw(window.hiddenRaw);
  if (hiddenRaw) {
    lines.push(`${indent}HideWindow(${windowKey}, ${hiddenRaw})`);
  }

  const disabledRaw = normalizeOptionalRaw(window.disabledRaw);
  if (disabledRaw) {
    lines.push(`${indent}DisableWindow(${windowKey}, ${disabledRaw})`);
  }

  const colorRaw = normalizeOptionalRaw(window.colorRaw);
  if (colorRaw) {
    lines.push(`${indent}SetWindowColor(${windowKey}, ${colorRaw})`);
  }

  return lines.length ? `${lines.join("\n")}\n` : "";
}

function applyWindowPropertyMutation(
  document: vscode.TextDocument,
  windowKey: string,
  mutate: (window: FormWindow) => boolean,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const parsed = parseFormDocument(document.getText());
  const window = parsed.window;
  if (!window || window.id !== windowKey) return undefined;

  const nextWindow = cloneWindowForProperties(window);
  if (!mutate(nextWindow)) return undefined;

  const calls = scanDocumentCalls(document, scanRange);
  const openCall = findCallByStableKey(calls, windowKey, name => name === "OpenWindow");
  if (!openCall) return undefined;

  const proc = findProcedureBlock(document, openCall.range.line);
  const propertyCalls = calls.filter(call => {
    const nameLower = call.name.toLowerCase();
    if (!WINDOW_PROPERTY_NAMES.has(nameLower)) return false;
    if (firstParamOfCall(call.args) !== windowKey) return false;
    if (!proc) return true;
    return call.range.line >= proc.startLine && call.range.line <= proc.endLine;
  }).sort((a, b) => a.range.line - b.range.line);

  const anchorLine = propertyCalls.length ? propertyCalls[0].range.line : openCall.range.line + 1;
  const indentSourceLine = propertyCalls.length ? propertyCalls[0].range.line : openCall.range.line;
  const indent = getLineIndent(document, indentSourceLine);
  const rebuilt = buildWindowPropertyLines(windowKey, nextWindow, indent);

  const edit = new vscode.WorkspaceEdit();

  for (const call of propertyCalls) {
    edit.delete(document.uri, document.lineAt(call.range.line).rangeIncludingLineBreak);
  }

  if (rebuilt) {
    edit.insert(document.uri, new vscode.Position(Math.min(document.lineCount, anchorLine), 0), rebuilt);
  }

  return propertyCalls.length || rebuilt ? edit : undefined;
}

export function applyWindowPropertyUpdate(
  document: vscode.TextDocument,
  windowKey: string,
  args: WindowPropertyArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  return applyWindowPropertyMutation(
    document,
    windowKey,
    window => {
      const has = (k: keyof WindowPropertyArgs) => Object.prototype.hasOwnProperty.call(args, k);
      if (has("hiddenRaw"))   { window.hiddenRaw   = normalizeOptionalRaw(args.hiddenRaw); }
      if (has("disabledRaw")) { window.disabledRaw = normalizeOptionalRaw(args.disabledRaw); }
      if (has("colorRaw"))    { window.colorRaw    = normalizeOptionalRaw(args.colorRaw); }
      return true;
    },
    scanRange
  );
}

function buildGadgetPropertyLines(gadgetKey: string, gadget: Gadget, indent: string): string {
  const lines: string[] = [];

  const hiddenRaw = normalizeOptionalRaw(gadget.hiddenRaw);
  if (hiddenRaw) {
    lines.push(`${indent}HideGadget(${gadgetKey}, ${hiddenRaw})`);
  }

  const disabledRaw = normalizeOptionalRaw(gadget.disabledRaw);
  if (disabledRaw) {
    lines.push(`${indent}DisableGadget(${gadgetKey}, ${disabledRaw})`);
  }

  const tooltipRaw = normalizeOptionalRaw(gadget.tooltipRaw);
  if (tooltipRaw) {
    lines.push(`${indent}GadgetToolTip(${gadgetKey}, ${tooltipRaw})`);
  }

  const backColorRaw = normalizeOptionalRaw(gadget.backColorRaw);
  if (backColorRaw) {
    lines.push(`${indent}SetGadgetColor(${gadgetKey}, #PB_Gadget_BackColor, ${backColorRaw})`);
  }

  const frontColorRaw = normalizeOptionalRaw(gadget.frontColorRaw);
  if (frontColorRaw) {
    lines.push(`${indent}SetGadgetColor(${gadgetKey}, #PB_Gadget_FrontColor, ${frontColorRaw})`);
  }

  const gadgetFontRaw = normalizeOptionalRaw(gadget.gadgetFontRaw);
  if (gadgetFontRaw) {
    lines.push(`${indent}SetGadgetFont(${gadgetKey}, ${gadgetFontRaw})`);
  }

  const stateRaw = normalizeOptionalRaw(gadget.stateRaw);
  if (stateRaw) {
    lines.push(`${indent}SetGadgetState(${gadgetKey}, ${stateRaw})`);
  }

  return lines.length ? `${lines.join("\n")}\n` : "";
}

function applyGadgetPropertyMutation(
  document: vscode.TextDocument,
  gadgetKey: string,
  mutate: (gadget: Gadget) => boolean,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const parsed = parseFormDocument(document.getText());
  const gadget = parsed.gadgets.find(entry => entry.id === gadgetKey);
  if (!gadget) return undefined;

  const nextGadget = cloneGadgetForProperties(gadget);
  if (!mutate(nextGadget)) return undefined;

  const calls = scanDocumentCalls(document, scanRange);
  const createCall = findCallByStableKey(calls, gadgetKey, name => /gadget$/i.test(name));
  const createLine = createCall?.range.line ?? gadget.source?.line;
  if (createLine === undefined) return undefined;

  const proc = findProcedureBlock(document, createLine);
  const propertyCalls = calls.filter(call => {
    const nameLower = call.name.toLowerCase();
    if (!GADGET_PROPERTY_NAMES.has(nameLower)) return false;
    if (firstParamOfCall(call.args) !== gadgetKey) return false;
    if (!proc) return true;
    return call.range.line >= proc.startLine && call.range.line <= proc.endLine;
  }).sort((a, b) => a.range.line - b.range.line);

  const anchorLine = propertyCalls.length ? propertyCalls[0].range.line : createLine + 1;
  const indentSourceLine = propertyCalls.length ? propertyCalls[0].range.line : createLine;
  const indent = getLineIndent(document, indentSourceLine);
  const rebuilt = buildGadgetPropertyLines(gadgetKey, nextGadget, indent);

  const edit = new vscode.WorkspaceEdit();

  for (const call of propertyCalls) {
    edit.delete(document.uri, document.lineAt(call.range.line).rangeIncludingLineBreak);
  }

  if (rebuilt) {
    edit.insert(document.uri, new vscode.Position(Math.min(document.lineCount, anchorLine), 0), rebuilt);
  }

  return propertyCalls.length || rebuilt ? edit : undefined;
}

export function applyGadgetPropertyUpdate(
  document: vscode.TextDocument,
  gadgetKey: string,
  args: GadgetPropertyArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  return applyGadgetPropertyMutation(
    document,
    gadgetKey,
    gadget => {
      const has = (k: keyof GadgetPropertyArgs) => Object.prototype.hasOwnProperty.call(args, k);
      if (has("hiddenRaw"))     { gadget.hiddenRaw     = normalizeOptionalRaw(args.hiddenRaw); }
      if (has("disabledRaw"))   { gadget.disabledRaw   = normalizeOptionalRaw(args.disabledRaw); }
      if (has("tooltipRaw"))    { gadget.tooltipRaw    = normalizeOptionalRaw(args.tooltipRaw); }
      if (has("stateRaw"))      { gadget.stateRaw      = normalizeOptionalRaw(args.stateRaw); }
      if (has("frontColorRaw")) { gadget.frontColorRaw = normalizeOptionalRaw(args.frontColorRaw); }
      if (has("backColorRaw"))  { gadget.backColorRaw  = normalizeOptionalRaw(args.backColorRaw); }
      if (has("gadgetFontRaw")) { gadget.gadgetFontRaw = normalizeOptionalRaw(args.gadgetFontRaw); }
      return true;
    },
    scanRange
  );
}

function buildImageLine(args: ImageArgs): string {
  const procName = args.inline ? "CatchImage" : "LoadImage";
  const idRaw = args.idRaw.trim();
  const imageRaw = args.imageRaw.trim();

  if (idRaw === PB_ANY) {
    const assignedVar = args.assignedVar?.trim();
    if (assignedVar) {
      return `${assignedVar} = ${procName}(${PB_ANY},${imageRaw})`;
    }
  }

  return `${procName}(${idRaw},${imageRaw})`;
}

function buildFontLine(args: FontArgs): string {
  const idRaw = args.idRaw.trim();
  const nameRaw = args.nameRaw.trim();
  const sizeRaw = args.sizeRaw.trim();
  const flagsRaw = normalizeOptionalRaw(args.flagsRaw);

  if (idRaw === PB_ANY) {
    const assignedVar = args.assignedVar?.trim();
    if (assignedVar) {
      return `${assignedVar} = LoadFont(${PB_ANY}, ${nameRaw}, ${sizeRaw}${flagsRaw ? `, ${flagsRaw}` : ""})`;
    }
  }

  return `LoadFont(${idRaw}, ${nameRaw}, ${sizeRaw}${flagsRaw ? `, ${flagsRaw}` : ""})`;
}

function cloneFormFont(font: FormFont): FormFont {
  return {
    id: font.id,
    pbAny: font.pbAny,
    variable: font.variable,
    firstParam: font.firstParam,
    nameRaw: font.nameRaw,
    name: font.name,
    sizeRaw: font.sizeRaw,
    size: font.size,
    flagsRaw: font.flagsRaw,
    source: font.source,
  };
}

function mapFontArgsToFont(args: FontArgs): FormFont {
  const firstParam = args.idRaw.trim();
  const pbAny = firstParam === PB_ANY;
  const assignedVar = args.assignedVar?.trim();
  const nameRaw = args.nameRaw.trim();
  const sizeRaw = args.sizeRaw.trim();
  const name = parsePbStringLiteral(nameRaw) ?? undefined;
  const size = asNumber(sizeRaw);

  return {
    id: pbAny ? (assignedVar || PB_ANY) : firstParam,
    pbAny,
    variable: pbAny ? (assignedVar || undefined) : firstParam.replace(/^#/, ""),
    firstParam,
    nameRaw,
    name,
    sizeRaw,
    size: typeof size === "number" ? size : undefined,
    flagsRaw: normalizeOptionalRaw(args.flagsRaw),
  };
}

function cloneFormImage(image: FormImage): FormImage {
  return {
    id: image.id,
    pbAny: image.pbAny,
    variable: image.variable,
    firstParam: image.firstParam,
    imageRaw: image.imageRaw,
    image: image.image,
    inline: image.inline,
    source: image.source,
  };
}

function mapImageArgsToImage(args: ImageArgs): FormImage {
  const firstParam = args.idRaw.trim();
  const pbAny = firstParam === PB_ANY;
  const assignedVar = args.assignedVar?.trim();
  const imageRaw = args.imageRaw.trim();
  const normalized = normalizePbImageValue(imageRaw, args.inline);

  return {
    id: pbAny ? (assignedVar || PB_ANY) : firstParam,
    pbAny,
    variable: pbAny ? (assignedVar || undefined) : firstParam.replace(/^#/, ""),
    firstParam,
    imageRaw,
    image: normalized,
    inline: args.inline,
  };
}

function isTopLevelHeadBoundaryLine(text: string): boolean {
  const trimmed = text.trim();
  return /^Declare\b/i.test(trimmed)
    || /^XIncludeFile\b/i.test(trimmed)
    || /^ProcedureDLL\b/i.test(trimmed)
    || /^Procedure(?:\.\w+)?\b/i.test(trimmed)
    || /^\s*;\s*IDE Options\b/i.test(text);
}

function isCustomGadgetInitMarkerLine(text: string): boolean {
  return /^\s*;\s*\d+\s+Custom gadget initialisation \(do Not remove this line\)\s*$/i.test(text);
}

function isTopLevelImageOrFontBoundaryLine(text: string): boolean {
  const trimmed = text.trim();
  return isImageDecoderLine(text)
    || /^LoadImage\s*\(/i.test(trimmed)
    || /^CatchImage\s*\(/i.test(trimmed)
    || new RegExp(`^Enumeration\\s+${ENUM_NAMES.fonts}\\b`, "i").test(trimmed)
    || /^LoadFont\s*\(/i.test(trimmed)
    || isTopLevelHeadBoundaryLine(text);
}

function findCustomGadgetInitMarkerLine(document: vscode.TextDocument, startLine = 0): number | undefined {
  for (let i = Math.max(0, startLine); i < document.lineCount; i++) {
    if (isCustomGadgetInitMarkerLine(document.lineAt(i).text)) {
      return i;
    }
  }

  return undefined;
}

function findCustomGadgetInitBoundaryLine(document: vscode.TextDocument, startLine = 0): number | undefined {
  let seenMarker = false;

  for (let i = Math.max(0, startLine); i < document.lineCount; i++) {
    const text = document.lineAt(i).text;
    if (!seenMarker) {
      if (isCustomGadgetInitMarkerLine(text)) {
        seenMarker = true;
      }
      continue;
    }

    if (isTopLevelImageOrFontBoundaryLine(text)) {
      return i;
    }
  }

  return seenMarker ? document.lineCount : undefined;
}

function isTopLevelGlobalAnchorLine(text: string): boolean {
  const trimmed = text.trim();
  return /^Enumeration\b/i.test(trimmed)
    || isCustomGadgetInitMarkerLine(text)
    || isImageDecoderLine(text)
    || /^LoadImage\s*\(/i.test(trimmed)
    || /^CatchImage\s*\(/i.test(trimmed)
    || /^LoadFont\s*\(/i.test(trimmed)
    || isTopLevelHeadBoundaryLine(text);
}

function findFontLoadCalls(calls: PbCall[], document: vscode.TextDocument): PbCall[] {
  const firstProcedureLine = findFirstProcedureLine(getDocumentLines(document));
  return calls.filter(call => call.name === "LoadFont" && call.range.line < firstProcedureLine);
}

function getFontGlobalVars(fonts: FormFont[]): string[] {
  return fonts
    .filter(font => font.pbAny)
    .map(font => font.id?.trim() ?? "")
    .filter(id => id.length > 0 && !id.startsWith("#"));
}

function getFontEnumSymbols(fonts: FormFont[]): string[] {
  return fonts
    .filter(font => !font.pbAny)
    .map(font => font.firstParam.trim())
    .filter(id => id.length > 0 && id.startsWith("#"));
}

function buildFontGlobalBlock(fonts: FormFont[]): string {
  const globals = getFontGlobalVars(fonts);
  if (!globals.length) return "";
  return `Global ${globals.join(", ")}

`;
}

function buildFontEnumBlock(fonts: FormFont[]): string {
  const symbols = getFontEnumSymbols(fonts);
  if (!symbols.length) return "";
  return `Enumeration ${ENUM_NAMES.fonts}
${symbols.map(symbol => `  ${symbol}`).join("\n")}
EndEnumeration

`;
}

function findFontGlobalBlock(document: vscode.TextDocument, fonts: FormFont[]): LineBlock | undefined {
  const fontGlobalNames = new Set(getFontGlobalVars(fonts));
  if (!fontGlobalNames.size) return undefined;

  let topAnchor = document.lineCount;
  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i).text;
    if (isTopLevelGlobalAnchorLine(line)) {
      topAnchor = i;
      break;
    }
  }

  for (let i = 0; i < topAnchor; i++) {
    const vars = parseGlobalVarNames(document.lineAt(i).text);
    if (!vars.length) continue;
    if (!vars.some(name => fontGlobalNames.has(name))) continue;
    return expandBlockWithTrailingBlank(document, { startLine: i, endLine: i });
  }

  return undefined;
}

function findFontGlobalInsertLine(document: vscode.TextDocument): number {
  return findImageGlobalInsertLine(document);
}

function findFontBlockInsertLine(document: vscode.TextDocument, calls: PbCall[]): number {
  const fontLoadCalls = findFontLoadCalls(calls, document);
  if (fontLoadCalls.length) return fontLoadCalls[0].range.line;

  const decoderLines: number[] = [];
  for (let i = 0; i < document.lineCount; i++) {
    if (isImageDecoderLine(document.lineAt(i).text)) decoderLines.push(i);
  }

  const imageCalls = calls.filter(c => IMAGE_ENTRY_NAMES.has(c.name.toLowerCase()));
  if (imageCalls.length || decoderLines.length) {
    const lastLine = Math.max(
      imageCalls.length ? imageCalls[imageCalls.length - 1].range.line : -1,
      decoderLines.length ? decoderLines[decoderLines.length - 1] : -1
    );
    return skipBlankLines(document, lastLine + 1);
  }

  const preferredEnums = [ENUM_NAMES.windows, ENUM_NAMES.gadgets, ENUM_NAMES.menus, ENUM_NAMES.images];
  let lastBlock: LineBlock | undefined;
  for (const enumName of preferredEnums) {
    const block = findNamedEnumerationBlock(document, enumName);
    if (block && (!lastBlock || block.endLine > lastBlock.endLine)) lastBlock = block;
  }

  if (lastBlock) {
    const insertLine = skipBlankLines(document, lastBlock.endLine + 1);
    const customInitBoundary = findCustomGadgetInitBoundaryLine(document, insertLine);
    if (customInitBoundary !== undefined) return customInitBoundary;
    return insertLine;
  }

  const customInitBoundary = findCustomGadgetInitBoundaryLine(document);
  if (customInitBoundary !== undefined) return customInitBoundary;

  return findImageBlockInsertLine(document, calls);
}

function buildFontLoadBlock(fonts: FormFont[], indent: string): string {
  if (!fonts.length) return "";

  const lines = fonts.map(font => `${indent}${buildFontLine({
    idRaw: font.firstParam,
    nameRaw: font.nameRaw,
    sizeRaw: font.sizeRaw,
    flagsRaw: font.flagsRaw,
    assignedVar: font.pbAny ? font.id : undefined,
  })}`);

  return `${lines.join("\n")}\n\n`;
}

function applyFontMutation(
  document: vscode.TextDocument,
  mutate: (fonts: FormFont[]) => boolean,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const parsed = parseFormDocument(document.getText());
  const nextFonts = parsed.fonts.map(cloneFormFont);
  if (!mutate(nextFonts)) return undefined;

  const calls = scanDocumentCalls(document, scanRange);
  const fontLoadCalls = findFontLoadCalls(calls, document);
  const anchorLine = fontLoadCalls.length ? fontLoadCalls[0].range.line : findFontBlockInsertLine(document, calls);
  const indent = document.lineCount ? getLineIndent(document, Math.min(anchorLine, Math.max(0, document.lineCount - 1))) : "";
  const rebuiltLoadBlock = buildFontLoadBlock(nextFonts, indent);

  const edit = new vscode.WorkspaceEdit();

  const fontGlobalBlock = findFontGlobalBlock(document, parsed.fonts);
  applyOptionalBlockPatch(edit, document, fontGlobalBlock, findFontGlobalInsertLine(document), "");

  const fontEnumBlock = findNamedEnumerationBlock(document, ENUM_NAMES.fonts);
  const fontEnumInsertLine = findFontBlockInsertLine(document, calls);
  const combineFreshEnumAndLoadInsert = !fontLoadCalls.length && !fontEnumBlock && !!buildFontEnumBlock(nextFonts);

  if (!combineFreshEnumAndLoadInsert) {
    applyOptionalBlockPatch(
      edit,
      document,
      fontEnumBlock ? expandBlockWithTrailingBlank(document, fontEnumBlock) : undefined,
      fontEnumInsertLine,
      buildFontEnumBlock(nextFonts)
    );
  }

  if (fontLoadCalls.length) {
    const firstLine = fontLoadCalls[0].range.line;
    const lastLine = fontLoadCalls[fontLoadCalls.length - 1].range.line;
    edit.replace(
      document.uri,
      new vscode.Range(new vscode.Position(firstLine, 0), getHeadBlockReplaceEnd(document, lastLine)),
      rebuiltLoadBlock
    );
    return edit;
  }

  if (!rebuiltLoadBlock) {
    const hasStructuralFontBlock = !!fontGlobalBlock || !!fontEnumBlock || !!buildFontEnumBlock(nextFonts);
    return hasStructuralFontBlock ? edit : undefined;
  }

  if (combineFreshEnumAndLoadInsert) {
    edit.insert(document.uri, new vscode.Position(fontEnumInsertLine, 0), `${buildFontEnumBlock(nextFonts)}${rebuiltLoadBlock}`);
    return edit;
  }

  edit.insert(document.uri, new vscode.Position(fontEnumInsertLine, 0), rebuiltLoadBlock);
  return edit;
}

const IMAGE_DECODER_ORDER = [
  { name: "UseJPEGImageDecoder", extensions: ["jpg", "jpeg"] },
  { name: "UseJPEG2000ImageDecoder", extensions: ["jp2", "jpeg2000"] },
  { name: "UsePNGImageDecoder", extensions: ["png"] },
  { name: "UseTGAImageDecoder", extensions: ["tga"] },
  { name: "UseTIFFImageDecoder", extensions: ["tif", "tiff"] },
  { name: "UseGIFImageDecoder", extensions: ["gif"] },
] as const;

const LEGACY_IMAGE_DECODER_LINES = new Set([
  "UseJTAImageDecoder()",
]);

function getRequiredImageDecoders(images: FormImage[]): string[] {
  const result: string[] = [];

  for (const decoder of IMAGE_DECODER_ORDER) {
    const hasMatch = images.some(image => {
      if (image.inline) return false;
      const extension = getExternalImageExtension(image);
      return extension ? (decoder.extensions as readonly string[]).includes(extension) : false;
    });
    if (hasMatch) {
      result.push(decoder.name);
    }
  }

  return result;
}

function getExternalImageExtension(image: FormImage): string | undefined {
  const value = (image.image?.trim().length ? image.image : parsePbStringLiteral(image.imageRaw))?.trim();
  if (!value) return undefined;

  const pathEnd = value.split(/[?#]/, 1)[0]?.trim();
  const match = /\.([a-z0-9]+)$/i.exec(pathEnd);
  return match?.[1]?.toLowerCase();
}

function isImageDecoderLine(text: string): boolean {
  const trimmed = text.trim();
  return IMAGE_DECODER_ORDER.some(decoder => trimmed === `${decoder.name}()`)
    || LEGACY_IMAGE_DECODER_LINES.has(trimmed);
}

function findImageBlockInsertLine(document: vscode.TextDocument, calls: PbCall[]): number {
  for (let i = 0; i < document.lineCount; i++) {
    const text = document.lineAt(i).text.trim();
    if (new RegExp(`^Enumeration\\s+${ENUM_NAMES.fonts}\\b`, "i").test(text)) return i;
    if (/^LoadFont\s*\(/i.test(text)) return i;
    if (isTopLevelHeadBoundaryLine(document.lineAt(i).text)) return i;
  }

  return document.lineCount;
}

function getImageGlobalVars(images: FormImage[]): string[] {
  return images
    .filter(image => image.pbAny)
    .map(image => image.id?.trim() ?? "")
    .filter(id => id.length > 0 && !id.startsWith("#"));
}

function getImageEnumSymbols(images: FormImage[]): string[] {
  return images
    .filter(image => !image.pbAny)
    .map(image => image.firstParam.trim())
    .filter(id => id.length > 0 && id.startsWith("#"));
}

function buildImageGlobalBlock(images: FormImage[], eol = "\n"): string {
  const globals = getImageGlobalVars(images);
  if (!globals.length) return "";
  return `Global ${globals.join(", ")}${eol}${eol}`;
}

function buildImageEnumBlock(images: FormImage[], eol = "\n"): string {
  const symbols = getImageEnumSymbols(images);
  if (!symbols.length) return "";
  return `Enumeration ${ENUM_NAMES.images}${eol}${symbols.map(symbol => `  ${symbol}`).join(eol)}${eol}EndEnumeration${eol}${eol}`;
}

function expandBlockWithTrailingBlank(document: vscode.TextDocument, block: LineBlock): LineBlock {
  let endLine = block.endLine;
  if (endLine + 1 < document.lineCount && document.lineAt(endLine + 1).text.trim() === "") {
    endLine += 1;
  }
  return { startLine: block.startLine, endLine };
}

function findGadgetGlobalBlock(document: vscode.TextDocument, gadgets: Gadget[]): LineBlock | undefined {
  const gadgetGlobalNames = new Set(getGadgetGlobalVars(gadgets));
  if (!gadgetGlobalNames.size) return undefined;

  let topAnchor = document.lineCount;
  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i).text;
    if (isTopLevelGlobalAnchorLine(line)) {
      topAnchor = i;
      break;
    }
  }

  for (let i = 0; i < topAnchor; i++) {
    const vars = parseGlobalVarNames(document.lineAt(i).text);
    if (!vars.length) continue;
    if (!vars.some(name => gadgetGlobalNames.has(name))) continue;
    return expandBlockWithTrailingBlank(document, { startLine: i, endLine: i });
  }

  return undefined;
}

function findGadgetGlobalInsertLine(document: vscode.TextDocument): number {
  const parsed = parseFormDocument(document.getText());
  const windowGlobalNames = new Set(
    parsed.window?.pbAny && parsed.window.id && !parsed.window.id.startsWith("#")
      ? [parsed.window.id]
      : []
  );

  let firstGlobal = document.lineCount;
  let firstAnchor = document.lineCount;

  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i).text;
    if (firstGlobal === document.lineCount && /^\s*Global\b/i.test(line)) {
      firstGlobal = i;
    }
    if (firstAnchor === document.lineCount && isTopLevelGlobalAnchorLine(line)) {
      firstAnchor = i;
    }

    const vars = parseGlobalVarNames(line);
    if (!vars.length) continue;
    if (!vars.some(name => windowGlobalNames.has(name))) continue;

    const block = expandBlockWithTrailingBlank(document, { startLine: i, endLine: i });
    return block.endLine + 1;
  }

  return firstGlobal !== document.lineCount ? firstGlobal : firstAnchor;
}

function findGadgetEnumInsertLine(document: vscode.TextDocument): number {
  const windowEnumBlock = findNamedEnumerationBlock(document, ENUM_NAMES.windows);
  if (windowEnumBlock) {
    return skipBlankLines(document, windowEnumBlock.endLine + 1);
  }

  for (let i = 0; i < document.lineCount; i++) {
    const text = document.lineAt(i).text;
    const trimmed = text.trim();
    if (new RegExp(`^Enumeration\\s+${ENUM_NAMES.menus}\\b`, "i").test(trimmed)
      || new RegExp(`^Enumeration\\s+${ENUM_NAMES.images}\\b`, "i").test(trimmed)
      || new RegExp(`^Enumeration\\s+${ENUM_NAMES.fonts}\\b`, "i").test(trimmed)
      || isCustomGadgetInitMarkerLine(text)
      || isImageDecoderLine(text)
      || /^LoadImage\s*\(/i.test(trimmed)
      || /^CatchImage\s*\(/i.test(trimmed)
      || /^LoadFont\s*\(/i.test(trimmed)
      || isTopLevelHeadBoundaryLine(text)) {
      return i;
    }
  }

  return document.lineCount;
}

function applyGadgetHeadPatch(edit: vscode.WorkspaceEdit, document: vscode.TextDocument): void {
  const parsed = parseFormDocument(document.getText());
  applyGadgetHeadPatchForGadgets(edit, document, parsed.gadgets);
}

function findImageGlobalBlock(document: vscode.TextDocument, images: FormImage[]): LineBlock | undefined {
  const imageGlobalNames = new Set(getImageGlobalVars(images));
  if (!imageGlobalNames.size) return undefined;

  let topAnchor = document.lineCount;
  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i).text;
    if (isTopLevelGlobalAnchorLine(line)) {
      topAnchor = i;
      break;
    }
  }

  for (let i = 0; i < topAnchor; i++) {
    const vars = parseGlobalVarNames(document.lineAt(i).text);
    if (!vars.length) continue;
    if (!vars.some(name => imageGlobalNames.has(name))) continue;
    return expandBlockWithTrailingBlank(document, { startLine: i, endLine: i });
  }

  return undefined;
}

function findImageGlobalInsertLine(document: vscode.TextDocument): number {
  let lastGlobal = -1;
  let firstAnchor = document.lineCount;

  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i).text;
    if (/^\s*Global\b/i.test(line)) lastGlobal = i;
    if (firstAnchor === document.lineCount && isTopLevelGlobalAnchorLine(line)) {
      firstAnchor = i;
    }
  }

  if (lastGlobal >= 0) {
    return lastGlobal + 1;
  }

  return firstAnchor;
}


function applyFreshImageGlobalInsert(
  edit: vscode.WorkspaceEdit,
  document: vscode.TextDocument,
  insertLine: number,
  rebuiltGlobalBlock: string
): void {
  if (!rebuiltGlobalBlock.length) return;

  let hasGlobalAbove = false;
  for (let i = 0; i < insertLine; i++) {
    if (/^\s*Global\b/i.test(document.lineAt(i).text)) {
      hasGlobalAbove = true;
      break;
    }
  }

  if (!hasGlobalAbove) {
    edit.insert(document.uri, new vscode.Position(insertLine, 0), rebuiltGlobalBlock);
    return;
  }

  let blankRunEnd = insertLine;
  while (blankRunEnd < document.lineCount && document.lineAt(blankRunEnd).text.trim() === "") {
    blankRunEnd += 1;
  }

  const insertText = `\n${rebuiltGlobalBlock}`;
  if (insertLine < blankRunEnd) {
    edit.replace(
      document.uri,
      new vscode.Range(new vscode.Position(insertLine, 0), new vscode.Position(blankRunEnd, 0)),
      insertText
    );
    return;
  }

  edit.insert(document.uri, new vscode.Position(insertLine, 0), insertText);
}

function findImageEnumInsertLine(document: vscode.TextDocument, calls: PbCall[]): number {
  const preferredEnums = [ENUM_NAMES.windows, ENUM_NAMES.gadgets, ENUM_NAMES.menus];
  let lastBlock: LineBlock | undefined;

  for (const enumName of preferredEnums) {
    const block = findNamedEnumerationBlock(document, enumName);
    if (block && (!lastBlock || block.endLine > lastBlock.endLine)) {
      lastBlock = block;
    }
  }

  if (lastBlock) {
    let insertLine = lastBlock.endLine + 1;
    while (insertLine < document.lineCount && document.lineAt(insertLine).text.trim() === "") {
      insertLine += 1;
    }
    return insertLine;
  }

  const customInitMarker = findCustomGadgetInitMarkerLine(document);
  if (customInitMarker !== undefined) return customInitMarker;

  return findImageBlockInsertLine(document, calls);
}

function applyOptionalBlockPatch(
  edit: vscode.WorkspaceEdit,
  document: vscode.TextDocument,
  block: LineBlock | undefined,
  insertLine: number,
  rebuilt: string
): void {
  if (block) {
    const range = new vscode.Range(
      new vscode.Position(block.startLine, 0),
      document.lineAt(block.endLine).rangeIncludingLineBreak.end
    );
    if (rebuilt.length) {
      edit.replace(document.uri, range, rebuilt);
    } else {
      edit.delete(document.uri, range);
    }
    return;
  }

  if (rebuilt.length) {
    edit.insert(document.uri, new vscode.Position(insertLine, 0), rebuilt);
  }
}

function getHeadBlockReplaceEnd(document: vscode.TextDocument, lastLine: number): vscode.Position {
  const trailingBlankLine = lastLine + 1;
  if (trailingBlankLine < document.lineCount && document.lineAt(trailingBlankLine).text.trim() === "") {
    return document.lineAt(trailingBlankLine).rangeIncludingLineBreak.end;
  }

  return document.lineAt(lastLine).rangeIncludingLineBreak.end;
}

function buildImageBlock(images: FormImage[], indent: string, eol = "\n"): string {
  if (!images.length) return "";

  const decoderLines = getRequiredImageDecoders(images).map(name => `${indent}${name}()`);
  const imageLines = images.map(image => `${indent}${buildImageLine({
    inline: image.inline,
    idRaw: image.firstParam,
    imageRaw: image.imageRaw,
    assignedVar: image.pbAny ? image.id : undefined,
  })}`);

  const parts: string[] = [];
  if (decoderLines.length) {
    parts.push(...decoderLines, "");
  }
  parts.push(...imageLines, "");
  return `${parts.join(eol)}${eol}`;
}

function findImageInsertLine(document: vscode.TextDocument, calls: PbCall[]): number {
  let insertAfterLine = -1;

  for (const call of calls) {
    const nameLower = call.name.toLowerCase();
    if (IMAGE_ENTRY_NAMES.has(nameLower)) {
      insertAfterLine = call.range.line;
    }
  }

  if (insertAfterLine >= 0) return insertAfterLine;
  return findImageBlockInsertLine(document, calls) - 1;
}

// ---------------------------------------------------------------------------
// Image re-indexing helpers (mirrors codeviewer.pb FD_SelectCode logic)
// ---------------------------------------------------------------------------

interface ImageRename {
  /** The old image id as it appears in ImageID(...) references. */
  oldId: string;
  /** The new image id that replaces it. */
  newId: string;
}

/**
 * Re-numbers every image in `images` by its position in the array —
 * exactly as FD_SelectCode does via ListIndex(FormWindows()\FormImg()).
 *
 * Enum images  (pbAny=false): id/firstParam → "#Img_<windowVar>_<i>"
 * Global images (pbAny=true):  id/variable  → "Img_<windowVar>_<i>",
 *                               firstParam  → "#PB_Any"
 *
 * Returns the list of old→new renames for ImageID(...) body patching.
 * Mutates `images` in place.
 */
function reindexImages(images: FormImage[], windowVar: string): ImageRename[] {
  const renames: ImageRename[] = [];
  images.forEach((image, idx) => {
    const oldId = image.id;
    if (image.pbAny) {
      const newId = `Img_${windowVar}_${idx}`;
      if (oldId !== newId) {
        renames.push({ oldId, newId });
      }
      image.id = newId;
      image.variable = newId;
      image.firstParam = PB_ANY;
    } else {
      const newId = `#Img_${windowVar}_${idx}`;
      if (oldId !== newId) {
        renames.push({ oldId, newId });
      }
      image.id = newId;
      image.firstParam = newId;
      image.variable = `Img_${windowVar}_${idx}`;
    }
  });
  return renames;
}

function getImageIdFromReference(raw: string): string | undefined {
  const match = /^\s*ImageID\s*\(([^)]+)\)\s*$/i.exec(raw);
  const imageId = match?.[1]?.trim();
  return imageId?.length ? imageId : undefined;
}

function remapImageReference(raw: string, renames: ImageRename[]): string {
  const imageId = getImageIdFromReference(raw);
  if (!imageId) return raw;
  const newId = renames.find(rename => rename.oldId === imageId)?.newId;
  return newId ? `ImageID(${newId})` : raw;
}

/**
 * Applies ImageID(oldId) → ImageID(newId) substitutions across the
 * whole document. Only lines containing the `ImageID(` pattern are
 * touched, so the substitution never overlaps with the image-block
 * replacement (which uses LoadImage/CatchImage, not ImageID).
 */
function applyImageIdRenames(
  edit: vscode.WorkspaceEdit,
  document: vscode.TextDocument,
  renames: ImageRename[],
  skipLines: ReadonlySet<number> = new Set()
): void {
  if (!renames.length) return;
  const renameMap = new Map(renames.map(r => [r.oldId, r.newId]));
  for (let i = 0; i < document.lineCount; i++) {
    if (skipLines.has(i)) continue;
    const line = document.lineAt(i).text;
    if (!/ImageID\s*\(/i.test(line)) continue;
    const updated = line.replace(/\bImageID\s*\(([^)]+)\)/gi, (match, inner) => {
      const newId = renameMap.get(inner.trim());
      return newId !== undefined ? `ImageID(${newId})` : match;
    });
    if (updated !== line) {
      edit.replace(document.uri, document.lineAt(i).range, updated);
    }
  }
}

function formImageHasParsedReference(parsed: ReturnType<typeof parseFormDocument>, imageId: string): boolean {
  return parsed.gadgets.some(gadget => gadget.imageId === imageId || gadget.items?.some(item => item.imageId === imageId))
    || parsed.menus.some(menu => menu.entries.some(entry => entry.iconId === imageId))
    || parsed.toolbars.some(toolBar => toolBar.entries.some(entry => entry.iconId === imageId))
    || parsed.statusbars.some(statusBar => statusBar.fields.some(field => field.imageId === imageId));
}

function getWindowImageBaseName(parsed: ReturnType<typeof parseFormDocument>): string {
  return parsed.window?.variable
    ?? parsed.window?.id?.replace(/^#/, "")
    ?? ENUM_NAMES.windows;
}

function applyImageMutation(
  document: vscode.TextDocument,
  mutate: (images: FormImage[]) => boolean,
  scanRange?: ScanRange,
  afterBuild?: (edit: vscode.WorkspaceEdit, nextImages: FormImage[]) => boolean | void
): vscode.WorkspaceEdit | undefined {
  const parsed = parseFormDocument(document.getText());
  const nextImages = parsed.images.map(cloneFormImage);
  if (!mutate(nextImages)) return undefined;

  const calls = scanDocumentCalls(document, scanRange);
  const imageCalls = calls.filter(c => IMAGE_ENTRY_NAMES.has(c.name.toLowerCase()));
  const decoderLines: number[] = [];
  for (let i = 0; i < document.lineCount; i++) {
    if (isImageDecoderLine(document.lineAt(i).text)) {
      decoderLines.push(i);
    }
  }

  const anchorLine = imageCalls.length
    ? imageCalls[0].range.line
    : (decoderLines.length ? decoderLines[0] : findImageBlockInsertLine(document, calls));
  const indent = document.lineCount ? getLineIndent(document, Math.min(anchorLine, document.lineCount - 1)) : "";
  const eol = getDocumentEol(document);
  const rebuilt = buildImageBlock(nextImages, indent, eol);

  const edit = new vscode.WorkspaceEdit();

  const imageGlobalBlock = findImageGlobalBlock(document, parsed.images);
  const rebuiltGlobalBlock = buildImageGlobalBlock(nextImages, eol);
  const imageGlobalInsertLine = findImageGlobalInsertLine(document);
  if (imageGlobalBlock) {
    applyOptionalBlockPatch(
      edit,
      document,
      imageGlobalBlock,
      imageGlobalInsertLine,
      rebuiltGlobalBlock
    );
  } else {
    applyFreshImageGlobalInsert(edit, document, imageGlobalInsertLine, rebuiltGlobalBlock);
  }

  const imageEnumBlock = findNamedEnumerationBlock(document, ENUM_NAMES.images);
  const rebuiltEnumBlock = buildImageEnumBlock(nextImages, eol);
  const imageBlockInsertLine = findImageBlockInsertLine(document, calls);
  const imageEnumInsertLine = findImageEnumInsertLine(document, calls);
  const combineFreshEnumAndImageInsert = !imageCalls.length
    && !decoderLines.length
    && !imageEnumBlock
    && !!rebuiltEnumBlock
    && imageEnumInsertLine === imageBlockInsertLine;

  if (!combineFreshEnumAndImageInsert) {
    applyOptionalBlockPatch(
      edit,
      document,
      imageEnumBlock ? expandBlockWithTrailingBlank(document, imageEnumBlock) : undefined,
      imageEnumInsertLine,
      rebuiltEnumBlock
    );
  }

  if (imageCalls.length || decoderLines.length) {
    const firstLine = Math.min(
      imageCalls.length ? imageCalls[0].range.line : Number.MAX_SAFE_INTEGER,
      decoderLines.length ? decoderLines[0] : Number.MAX_SAFE_INTEGER
    );
    const lastLine = Math.max(
      imageCalls.length ? imageCalls[imageCalls.length - 1].range.line : -1,
      decoderLines.length ? decoderLines[decoderLines.length - 1] : -1
    );
    edit.replace(
      document.uri,
      new vscode.Range(new vscode.Position(firstLine, 0), getHeadBlockReplaceEnd(document, lastLine)),
      rebuilt
    );
    if (afterBuild?.(edit, nextImages) === false) return undefined;
    return edit;
  }

  if (!rebuilt) return undefined;

  if (combineFreshEnumAndImageInsert) {
    edit.insert(document.uri, new vscode.Position(imageEnumInsertLine, 0), `${rebuiltEnumBlock}${rebuilt}`);
    if (afterBuild?.(edit, nextImages) === false) return undefined;
    return edit;
  }

  edit.insert(document.uri, new vscode.Position(imageBlockInsertLine, 0), rebuilt);
  if (afterBuild?.(edit, nextImages) === false) return undefined;
  return edit;
}

function findCreateCallById(calls: PbCall[], createNameLower: string, id: string): PbCall | undefined {
  return calls.find(c => matchesCreateCallName(c.name.toLowerCase(), createNameLower) && firstParamOfCall(c.args) === id);
}

function findSectionEndIndex(calls: PbCall[], startIdx: number): number {
  for (let i = startIdx + 1; i < calls.length; i++) {
    if (isCreateBoundary(calls[i].name.toLowerCase())) {
      return i;
    }
  }
  return calls.length;
}

function findLastEntryLineInSection(
  calls: PbCall[],
  startIdx: number,
  endIdx: number,
  entryNamesLower: Set<string>
): number {
  let insertAfterLine = calls[startIdx].range.line;
  for (let i = startIdx + 1; i < endIdx; i++) {
    if (entryNamesLower.has(calls[i].name.toLowerCase())) {
      insertAfterLine = calls[i].range.line;
    }
  }
  return insertAfterLine;
}

function isLineInCreateSection(calls: PbCall[], line: number, createNameLower: string, expectedId: string): boolean {
  const create = findNearestCreateAbove(calls, line, createNameLower);
  return !!create && firstParamOfCall(create.args) === expectedId;
}

function applySectionEntryInsert(
  document: vscode.TextDocument,
  calls: PbCall[],
  createNameLower: string,
  sectionId: string,
  entryNamesLower: Set<string>,
  buildLine: (indent: string) => string
 ): vscode.WorkspaceEdit | undefined {
  const create = findCreateCallById(calls, createNameLower, sectionId);
  if (!create) return undefined;

  const startIdx = calls.indexOf(create);
  const endIdx = findSectionEndIndex(calls, startIdx);
  const insertAfterLine = findLastEntryLineInSection(calls, startIdx, endIdx, entryNamesLower);

  const indent = getLineIndent(document, insertAfterLine);
  const line = `${buildLine(indent)}\n`;
  const insertPos = new vscode.Position(Math.min(document.lineCount, insertAfterLine + 1), 0);

  const edit = new vscode.WorkspaceEdit();
  edit.insert(document.uri, insertPos, `${buildLine(indent)}${getDocumentEol(document)}`);
  return edit;
}

function findAnchoredMenuEntryInsert(
  document: vscode.TextDocument,
  calls: PbCall[],
  menuId: string,
  parentSourceLine: number
): { insertLine: number; indent: string } | undefined {
  const create = findCreateCallById(calls, PB_CALL.createMenu, menuId);
  if (!create) return undefined;

  const parsed = parseFormDocument(document.getText());
  const menu = parsed.menus.find(entry => entry.id === menuId);
  if (!menu) return undefined;

  const parentIndex = menu.entries.findIndex(entry => entry.source?.line === parentSourceLine);
  if (parentIndex < 0) return undefined;

  const parentEntry = menu.entries[parentIndex];
  if (parentEntry.kind !== MENU_ENTRY_KIND.MenuTitle && parentEntry.kind !== MENU_ENTRY_KIND.OpenSubMenu) {
    return undefined;
  }

  const parentLevel = Math.max(0, parentEntry.level ?? 0);
  let insertLine: number | undefined;
  let insertBoundaryEntry: (typeof menu.entries)[number] | undefined;

  for (let i = parentIndex + 1; i < menu.entries.length; i++) {
    const entry = menu.entries[i];
    const level = Math.max(0, entry.level ?? 0);
    if (level <= parentLevel) {
      insertLine = entry.source?.line;
      insertBoundaryEntry = entry;
      break;
    }
  }

  if (typeof insertLine !== "number") {
    const startIdx = calls.indexOf(create);
    const endIdx = findSectionEndIndex(calls, startIdx);
    const insertAfterLine = findLastEntryLineInSection(calls, startIdx, endIdx, MENU_ENTRY_NAMES);
    return {
      insertLine: Math.min(document.lineCount, insertAfterLine + 1),
      indent: getLineIndent(document, insertAfterLine)
    };
  }

  if (
    parentEntry.kind === MENU_ENTRY_KIND.OpenSubMenu
    && insertBoundaryEntry?.kind === MENU_ENTRY_KIND.CloseSubMenu
    && Math.max(0, insertBoundaryEntry.level ?? 0) === parentLevel
  ) {
    const parentLine = parentEntry.source?.line;
    if (typeof parentLine === "number" && isLineInCreateSection(calls, parentLine, PB_CALL.createMenu, menuId)) {
      return { insertLine, indent: getLineIndent(document, insertLine) };
    }
  }

  if (!isLineInCreateSection(calls, insertLine, PB_CALL.createMenu, menuId)) return undefined;
  return { insertLine, indent: getLineIndent(document, insertLine) };
}

function buildPromotedSubMenuTextRaw(entry: FormMenuEntry): string {
  if (typeof entry.text === "string") {
    return quotePbString(entry.text);
  }

  const raw = entry.textRaw?.trim();
  if (!raw?.length) return '""';
  return normalizeMenuTextForShortcut(raw);
}

function applyMenuEntryInsertIntoLeafMenuItem(
  document: vscode.TextDocument,
  calls: PbCall[],
  menuId: string,
  parentEntry: FormMenuEntry,
  args: MenuEntryArgs
): vscode.WorkspaceEdit | undefined {
  const sourceLine = parentEntry.source?.line;
  if (typeof sourceLine !== "number") return undefined;
  if (!isLineInCreateSection(calls, sourceLine, PB_CALL.createMenu, menuId)) return undefined;

  const indent = getLineIndent(document, sourceLine);
  const replacement = [
    `${indent}${buildMenuEntryLine({ kind: MENU_ENTRY_KIND.OpenSubMenu, textRaw: buildPromotedSubMenuTextRaw(parentEntry) })}`,
    `${indent}${buildMenuEntryLine(args)}`,
    `${indent}CloseSubMenu()`
  ].join("\n");

  const edit = new vscode.WorkspaceEdit();
  edit.replace(
    document.uri,
    new vscode.Range(document.lineAt(sourceLine).range.start, document.lineAt(sourceLine).rangeIncludingLineBreak.end),
    `${replacement}\n`
  );

  const parsed = parseFormDocument(document.getText());
  const symbols = collectMenuEnumSymbols(parsed.menus, parsed.toolbars)
    .filter(symbol => symbol !== parentEntry.idRaw?.trim());

  const nextId = args.idRaw?.trim();
  if (nextId?.startsWith("#") && !symbols.includes(nextId)) {
    symbols.push(nextId);
  }

  applyMenuEnumPatch(edit, document, calls, symbols);
  return edit;
}

function findMenuEntryBlockRange(
  document: vscode.TextDocument,
  calls: PbCall[],
  menuId: string,
  sourceLine: number,
  entryNameLower: string
): { startLine: number; endLine: number } | undefined {
  if (sourceLine < 0 || sourceLine >= document.lineCount) return undefined;
  if (!isLineInCreateSection(calls, sourceLine, PB_CALL.createMenu, menuId)) return undefined;

  const parsed = parseFormDocument(document.getText());
  const menu = parsed.menus.find(entry => entry.id === menuId);
  if (!menu) return undefined;

  const entryIndex = menu.entries.findIndex(entry => {
    const entryLine = entry.source?.line;
    return entryLine === sourceLine && entry.kind.toLowerCase() === entryNameLower;
  });
  if (entryIndex < 0) return undefined;

  const entry = menu.entries[entryIndex];
  const startLine = entry.source?.line;
  if (typeof startLine !== "number") return undefined;

  if (entry.kind !== MENU_ENTRY_KIND.MenuTitle && entry.kind !== MENU_ENTRY_KIND.OpenSubMenu) {
    return { startLine, endLine: startLine };
  }

  if (entry.kind === MENU_ENTRY_KIND.OpenSubMenu) {
    const targetLevel = Math.max(0, entry.level ?? 0);
    for (let i = entryIndex + 1; i < menu.entries.length; i++) {
      const nextEntry = menu.entries[i];
      if (nextEntry.kind !== MENU_ENTRY_KIND.CloseSubMenu) continue;
      if (Math.max(0, nextEntry.level ?? 0) !== targetLevel) continue;

      const endLine = nextEntry.source?.line;
      if (typeof endLine === "number") {
        return { startLine, endLine };
      }
      break;
    }
  }

  const targetLevel = Math.max(0, entry.level ?? 0);
  let endLine = startLine;

  for (let i = entryIndex + 1; i < menu.entries.length; i++) {
    const nextEntry = menu.entries[i];
    const nextLine = nextEntry.source?.line;
    if (typeof nextLine !== "number") continue;

    const nextLevel = Math.max(0, nextEntry.level ?? 0);
    if (nextLevel <= targetLevel && nextEntry.kind !== MENU_ENTRY_KIND.CloseSubMenu) {
      break;
    }

    endLine = nextLine;
  }

  return { startLine, endLine };
}

function applySectionEntryUpdate(
  document: vscode.TextDocument,
  calls: PbCall[],
  createNameLower: string,
  sectionId: string,
  sourceLine: number,
  entryNameLower: string,
  rebuiltWithoutIndent: string
): vscode.WorkspaceEdit | undefined {
  if (sourceLine < 0 || sourceLine >= document.lineCount) return undefined;

  const call = calls.find(c => c.range.line === sourceLine && c.name.toLowerCase() === entryNameLower);
  if (!call) return undefined;

  if (!isLineInCreateSection(calls, sourceLine, createNameLower, sectionId)) return undefined;

  const indent = getLineIndent(document, sourceLine);
  const rebuilt = `${indent}${rebuiltWithoutIndent}`;
  return replaceCallLinePreserveSuffix(document, call, rebuilt);
}

function applySectionEntryDelete(
  document: vscode.TextDocument,
  calls: PbCall[],
  createNameLower: string,
  sectionId: string,
  sourceLine: number,
  entryNameLower: string
): vscode.WorkspaceEdit | undefined {
  if (sourceLine < 0 || sourceLine >= document.lineCount) return undefined;

  const call = calls.find(c => c.range.line === sourceLine && c.name.toLowerCase() === entryNameLower);
  if (!call) return undefined;

  if (!isLineInCreateSection(calls, sourceLine, createNameLower, sectionId)) return undefined;

  const edit = new vscode.WorkspaceEdit();
  edit.delete(document.uri, document.lineAt(sourceLine).rangeIncludingLineBreak);
  return edit;
}

function applySectionDelete(
  document: vscode.TextDocument,
  calls: PbCall[],
  createNameLower: string,
  sectionId: string
): vscode.WorkspaceEdit | undefined {
  const create = findCreateCallById(calls, createNameLower, sectionId);
  if (!create) return undefined;

  const startIdx = calls.indexOf(create);
  const endIdx = findSectionEndIndex(calls, startIdx);
  const endLine = endIdx > startIdx + 1
    ? calls[endIdx - 1].range.line
    : create.range.line;

  const edit = new vscode.WorkspaceEdit();
  edit.delete(
    document.uri,
    new vscode.Range(
      new vscode.Position(create.range.line, 0),
      document.lineAt(endLine).rangeIncludingLineBreak.end
    )
  );
  return edit;
}

function mapStatusBarArgsToField(args: StatusBarFieldArgs): FormStatusBarField {
  return {
    widthRaw: args.widthRaw,
    textRaw: args.textRaw,
    imageRaw: args.imageRaw,
    flagsRaw: args.flagsRaw,
    progressBar: args.progressBar,
    progressRaw: args.progressRaw,
  };
}

function mergeStatusBarFieldArgs(field: FormStatusBarField, args: StatusBarFieldArgs): FormStatusBarField {
  const next: FormStatusBarField = {
    ...field,
    widthRaw: args.widthRaw,
  };

  if (args.textRaw !== undefined) next.textRaw = args.textRaw;
  if (args.imageRaw !== undefined) next.imageRaw = args.imageRaw;
  if (args.flagsRaw !== undefined) next.flagsRaw = args.flagsRaw;
  if (args.progressBar !== undefined) next.progressBar = args.progressBar;
  if (args.progressRaw !== undefined) next.progressRaw = args.progressRaw;

  return next;
}

function buildStatusBarDecorationLine(statusBarId: string, field: FormStatusBarField, index: number): string | undefined {
  const flags = field.flagsRaw?.trim();
  const flagsSuffix = flags ? `, ${flags}` : "";

  const text = field.textRaw?.trim();
  if (text) {
    return `StatusBarText(${statusBarId}, ${index}, ${text}${flagsSuffix})`;
  }

  const image = field.imageRaw?.trim();
  if (image) {
    return `StatusBarImage(${statusBarId}, ${index}, ${image}${flagsSuffix})`;
  }

  if (field.progressBar) {
    const progress = field.progressRaw?.trim() || "0";
    return `StatusBarProgress(${statusBarId}, ${index}, ${progress}${flagsSuffix})`;
  }

  return undefined;
}

function buildStatusBarSectionText(statusBarId: string, fields: FormStatusBarField[], indent: string): string {
  const lines: string[] = [];

  fields.forEach((field, index) => {
    lines.push(`${indent}AddStatusBarField(${field.widthRaw.trim()})`);

    const decoration = buildStatusBarDecorationLine(statusBarId, field, index);
    if (decoration) {
      lines.push(`${indent}${decoration}`);
    }
  });

  return lines.length ? `${lines.join("\n")}\n` : "";
}

function cloneStatusBarField(field: FormStatusBarField): FormStatusBarField {
  return {
    widthRaw: field.widthRaw,
    textRaw: field.textRaw,
    text: field.text,
    imageRaw: field.imageRaw,
    imageId: field.imageId,
    flagsRaw: field.flagsRaw,
    progressBar: field.progressBar,
    progressRaw: field.progressRaw,
    source: field.source,
  };
}

function applyStatusBarFieldMutation(
  document: vscode.TextDocument,
  statusBarId: string,
  mutate: (fields: FormStatusBarField[]) => boolean,
  scanRange?: ScanRange,
  imageRenames: ImageRename[] = []
): vscode.WorkspaceEdit | undefined {
  const parsed = parseFormDocument(document.getText());
  const statusBar = parsed.statusbars.find(sb => sb.id === statusBarId);
  if (!statusBar) return undefined;

  const nextFields = statusBar.fields.map(cloneStatusBarField);
  if (!mutate(nextFields)) return undefined;

  if (imageRenames.length) {
    for (const field of nextFields) {
      if (!field.imageRaw) continue;
      const nextImageRaw = remapImageReference(field.imageRaw, imageRenames);
      field.imageRaw = nextImageRaw;
      field.imageId = getImageIdFromReference(nextImageRaw);
    }
  }

  const calls = scanDocumentCalls(document, scanRange);
  const create = findCreateCallById(calls, PB_CALL.createStatusBar, statusBarId);
  if (!create) return undefined;

  const startIdx = calls.indexOf(create);
  const endIdx = findSectionEndIndex(calls, startIdx);
  const endLineExclusive = endIdx < calls.length ? calls[endIdx].range.line : Number.POSITIVE_INFINITY;
  const statusCalls = calls.filter(c => c.range.line > create.range.line && c.range.line < endLineExclusive && STATUSBAR_FIELD_NAMES.has(c.name.toLowerCase()));

  const indentLine = statusCalls.length ? statusCalls[0].range.line : create.range.line;
  const indent = getLineIndent(document, indentLine);
  const rebuilt = buildStatusBarSectionText(statusBarId, nextFields, indent);

  const edit = new vscode.WorkspaceEdit();

  if (statusCalls.length) {
    const firstLine = statusCalls[0].range.line;
    const lastLine = statusCalls[statusCalls.length - 1].range.line;
    edit.replace(
      document.uri,
      new vscode.Range(new vscode.Position(firstLine, 0), getHeadBlockReplaceEnd(document, lastLine)),
      rebuilt
    );
    return edit;
  }

  if (!rebuilt) return undefined;

  edit.insert(document.uri, new vscode.Position(Math.min(document.lineCount, create.range.line + 1), 0), rebuilt);
  return edit;
}

function collectStatusBarFieldMutationLines(
  document: vscode.TextDocument,
  statusBarId: string,
  scanRange?: ScanRange
): ReadonlySet<number> {
  const calls = scanDocumentCalls(document, scanRange);
  const create = findCreateCallById(calls, PB_CALL.createStatusBar, statusBarId);
  if (!create) return new Set();

  const startIdx = calls.indexOf(create);
  const endIdx = findSectionEndIndex(calls, startIdx);
  const endLineExclusive = endIdx < calls.length ? calls[endIdx].range.line : Number.POSITIVE_INFINITY;
  const statusCalls = calls.filter(c => c.range.line > create.range.line && c.range.line < endLineExclusive && STATUSBAR_FIELD_NAMES.has(c.name.toLowerCase()));
  if (!statusCalls.length) return new Set();

  const firstLine = statusCalls[0].range.line;
  const lastLine = statusCalls[statusCalls.length - 1].range.line;
  const lines = new Set<number>();
  for (let line = firstLine; line <= lastLine; line += 1) {
    lines.add(line);
  }
  return lines;
}

export function applyMenuCreate(
  document: vscode.TextDocument,
  args: MenuEntryArgs = { kind: MENU_ENTRY_KIND.MenuTitle, textRaw: '"MenuTitle"' },
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);
  const ctx = findWindowTopLevelCreateContext(document, calls, "menu");
  if (!ctx) return undefined;

  const menuId = getNextNumericTopLevelId(ctx.parsed.menus.map(entry => entry.id));
  if (findCreateCallById(calls, PB_CALL.createMenu, menuId)) return undefined;

  const lines = [
    `CreateMenu(${menuId}, WindowID(${ctx.windowRef}))`,
    buildMenuEntryLine(args),
  ];

  const edit = new vscode.WorkspaceEdit();
  edit.insert(
    document.uri,
    new vscode.Position(Math.min(document.lineCount, ctx.anchor.insertLine), 0),
    buildTopLevelCreateSectionText(lines, ctx.anchor.indent, getDocumentEol(document))
  );
  return edit;
}

export function applyToolBarCreate(
  document: vscode.TextDocument,
  args: ToolBarEntryArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);
  const ctx = findWindowTopLevelCreateContext(document, calls, "toolbar");
  if (!ctx) return undefined;

  const toolBarId = getNextNumericTopLevelId(ctx.parsed.toolbars.map(entry => entry.id));
  if (findCreateCallById(calls, PB_CALL.createToolBar, toolBarId)) return undefined;

  const lines = [
    `CreateToolBar(${toolBarId}, WindowID(${ctx.windowRef}))`,
    ...buildToolBarEntryLines(args, toolBarId),
  ];

  const edit = new vscode.WorkspaceEdit();
  edit.insert(
    document.uri,
    new vscode.Position(Math.min(document.lineCount, ctx.anchor.insertLine), 0),
    buildTopLevelCreateSectionText(lines, ctx.anchor.indent, getDocumentEol(document))
  );

  const idRaw = args.idRaw?.trim();
  if (idRaw?.startsWith("#")) {
    const nextToolBars: FormToolBar[] = [
      ...ctx.parsed.toolbars,
      { id: toolBarId, entries: [{ kind: args.kind, idRaw: args.idRaw, iconRaw: args.iconRaw, textRaw: args.textRaw, toggle: args.toggle }] },
    ];
    applyMenuEnumPatch(edit, document, calls, collectMenuEnumSymbols(ctx.parsed.menus, nextToolBars));
  }

  return edit;
}

export function applyStatusBarCreate(
  document: vscode.TextDocument,
  args: StatusBarFieldArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);
  const ctx = findWindowTopLevelCreateContext(document, calls, "statusbar");
  if (!ctx) return undefined;

  const statusBarId = getNextNumericTopLevelId(ctx.parsed.statusbars.map(entry => entry.id));
  if (findCreateCallById(calls, PB_CALL.createStatusBar, statusBarId)) return undefined;

  const field = mapStatusBarArgsToField(args);
  const lines = [
    `CreateStatusBar(${statusBarId}, WindowID(${ctx.windowRef}))`,
    `AddStatusBarField(${field.widthRaw})`,
  ];
  const decoration = buildStatusBarDecorationLine(statusBarId, field, 0);
  if (decoration) lines.push(decoration);

  const edit = new vscode.WorkspaceEdit();
  edit.insert(
    document.uri,
    new vscode.Position(Math.min(document.lineCount, ctx.anchor.insertLine), 0),
    buildTopLevelCreateSectionText(lines, ctx.anchor.indent, getDocumentEol(document))
  );
  return edit;
}

export function applyMenuEntryInsert(
  document: vscode.TextDocument,
  menuId: string,
  args: MenuEntryArgs,
  scanRange?: ScanRange,
  insertOptions?: MenuEntryInsertOptions
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);
  const insertText = args.kind === MENU_ENTRY_KIND.OpenSubMenu
    ? (indent: string) => `${indent}${buildMenuEntryLine(args)}\n${indent}CloseSubMenu()`
    : (indent: string) => `${indent}${buildMenuEntryLine(args)}`;

  let edit: vscode.WorkspaceEdit | undefined;
  let menuEnumPatched = false;

  if (typeof insertOptions?.parentSourceLine === "number") {
    const parsed = parseFormDocument(document.getText());
    const menu = parsed.menus.find(entry => entry.id === menuId);
    const parentEntry = menu?.entries.find(entry => entry.source?.line === insertOptions.parentSourceLine);

    if (parentEntry?.kind === MENU_ENTRY_KIND.MenuItem) {
      edit = applyMenuEntryInsertIntoLeafMenuItem(document, calls, menuId, parentEntry, args);
      menuEnumPatched = Boolean(edit);
    } else {
      const anchored = findAnchoredMenuEntryInsert(document, calls, menuId, insertOptions.parentSourceLine);
      if (!anchored) return undefined;

      edit = new vscode.WorkspaceEdit();
      edit.insert(document.uri, new vscode.Position(Math.min(document.lineCount, anchored.insertLine), 0), `${insertText(anchored.indent)}\n`);
    }
  } else {
    if (args.kind === MENU_ENTRY_KIND.CloseSubMenu) {
      const parsed = parseFormDocument(document.getText());
      const menu = parsed.menus.find(entry => entry.id === menuId);
      let openBalance = 0;
      for (const entry of menu?.entries ?? []) {
        if (entry.kind === MENU_ENTRY_KIND.OpenSubMenu) {
          openBalance += 1;
          continue;
        }
        if (entry.kind === MENU_ENTRY_KIND.CloseSubMenu) {
          openBalance = Math.max(0, openBalance - 1);
        }
      }
      if (openBalance <= 0) return undefined;
    }

    edit = applySectionEntryInsert(
      document,
      calls,
      PB_CALL.createMenu,
      menuId,
      MENU_ENTRY_NAMES,
      insertText
    );
  }

  if (!edit) return undefined;

  const idRaw = args.idRaw?.trim();
  const parsed = parseFormDocument(document.getText());
  const menu = parsed.menus.find(entry => entry.id === menuId);
  if (!menuEnumPatched && idRaw?.startsWith("#")) {
    const symbols = collectMenuEnumSymbols(parsed.menus, parsed.toolbars);
    if (!symbols.includes(idRaw)) symbols.push(idRaw);
    applyMenuEnumPatch(edit, document, calls, symbols);
  }

  const hasIcons = menu?.entries.some(entry => !!entry.iconRaw?.trim()) || !!args.iconRaw?.trim();
  applyMenuCreateModePatch(edit, document, calls, menuId, hasIcons);

  return edit;
}

export function applyMenuEntryUpdate(
  document: vscode.TextDocument,
  menuId: string,
  sourceLine: number,
  args: MenuEntryArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);
  const edit = applySectionEntryUpdate(
    document,
    calls,
    PB_CALL.createMenu,
    menuId,
    sourceLine,
    args.kind.toLowerCase(),
    buildMenuEntryLine(args)
  );
  if (!edit) return undefined;

  const parsed = parseFormDocument(document.getText());
  const menus = parsed.menus.map(menu => ({ ...menu, entries: menu.entries.map(cloneMenuEntry) }));
  const menu = menus.find(entry => entry.id === menuId);
  const target = menu?.entries.find(entry => entry.source?.line === sourceLine && entry.kind.toLowerCase() === args.kind.toLowerCase());
  if (target) {
    target.idRaw = args.idRaw;
    target.iconRaw = args.iconRaw;
  }
  applyMenuEnumPatch(edit, document, calls, collectMenuEnumSymbols(menus, parsed.toolbars));
  const nextMenu = menus.find(entry => entry.id === menuId);
  const hasIcons = !!nextMenu?.entries.some(entry => !!entry.iconRaw?.trim());
  applyMenuCreateModePatch(edit, document, calls, menuId, hasIcons);
  return edit;
}

export function applyMenuEntryDelete(
  document: vscode.TextDocument,
  menuId: string,
  sourceLine: number,
  kind: MenuEntryKind,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);
  const deleteRange = findMenuEntryBlockRange(document, calls, menuId, sourceLine, kind.toLowerCase());
  if (!deleteRange) return undefined;

  const edit = new vscode.WorkspaceEdit();
  edit.delete(
    document.uri,
    new vscode.Range(
      new vscode.Position(deleteRange.startLine, 0),
      document.lineAt(deleteRange.endLine).rangeIncludingLineBreak.end
    )
  );

  const parsed = parseFormDocument(document.getText());
  const menus = parsed.menus.map(menu => ({ ...menu, entries: menu.entries.map(cloneMenuEntry) }));
  const menu = menus.find(entry => entry.id === menuId);
  if (menu) {
    const targetIndex = menu.entries.findIndex(entry => entry.source?.line === sourceLine && entry.kind.toLowerCase() === kind.toLowerCase());
    if (targetIndex >= 0) menu.entries.splice(targetIndex, 1);
  }
  applyMenuEnumPatch(edit, document, calls, collectMenuEnumSymbols(menus, parsed.toolbars));
  const hasIcons = !!menu?.entries.some(entry => !!entry.iconRaw?.trim());
  applyMenuCreateModePatch(edit, document, calls, menuId, hasIcons);
  return edit;
}

export function applyMenuEntryMove(
  document: vscode.TextDocument,
  menuId: string,
  sourceLine: number,
  kind: MenuEntryKind,
  options: MenuEntryMoveOptions,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);
  const blockRange = findMenuEntryBlockRange(document, calls, menuId, sourceLine, kind.toLowerCase());
  if (!blockRange) return undefined;

  const parsed = parseFormDocument(document.getText());
  const menu = parsed.menus.find(entry => entry.id === menuId);
  if (!menu) return undefined;

  let insertLine: number | undefined;

  if (options.placement === MenuEntryMovePlacement.AppendChild) {
    const anchored = findAnchoredMenuEntryInsert(document, calls, menuId, options.targetSourceLine);
    if (!anchored) return undefined;
    insertLine = anchored.insertLine;
  } else {
    const targetEntry = menu.entries.find(entry => entry.source?.line === options.targetSourceLine);
    if (!targetEntry) return undefined;

    const targetRange = findMenuEntryBlockRange(
      document,
      calls,
      menuId,
      options.targetSourceLine,
      targetEntry.kind.toLowerCase()
    );
    if (!targetRange) return undefined;

    insertLine = options.placement === MenuEntryMovePlacement.Before
      ? targetRange.startLine
      : Math.min(document.lineCount, targetRange.endLine + 1);
  }

  if (typeof insertLine !== "number") return undefined;
  if (insertLine >= blockRange.startLine && insertLine <= blockRange.endLine + 1) {
    return undefined;
  }

  const blockTextRange = new vscode.Range(
    new vscode.Position(blockRange.startLine, 0),
    document.lineAt(blockRange.endLine).rangeIncludingLineBreak.end
  );
  let blockText = "";
  for (let line = blockRange.startLine; line <= blockRange.endLine; line++) {
    const textLine = document.lineAt(line);
    blockText += textLine.text;
    if (textLine.rangeIncludingLineBreak.end.line > textLine.range.end.line) {
      blockText += "\n";
    }
  }
  if (insertLine < document.lineCount && !blockText.endsWith("\n") && !blockText.endsWith("\r\n")) {
    blockText += "\n";
  }

  const edit = new vscode.WorkspaceEdit();
  edit.delete(document.uri, blockTextRange);
  edit.insert(document.uri, new vscode.Position(insertLine, 0), blockText);
  return edit;
}

export function applyToolBarEntryInsert(
  document: vscode.TextDocument,
  toolBarId: string,
  args: ToolBarEntryArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);
  const edit = applySectionEntryInsert(
    document,
    calls,
    PB_CALL.createToolBar,
    toolBarId,
    TOOLBAR_ENTRY_NAMES,
    indent => buildToolBarEntryText(args, toolBarId, indent)
  );
  if (!edit) return undefined;

  const idRaw = args.idRaw?.trim();
  if (isToolBarButtonKind(args.kind) && idRaw?.startsWith("#")) {
    const parsed = parseFormDocument(document.getText());
    const toolbars = parsed.toolbars.map(toolBar => ({ ...toolBar, entries: toolBar.entries.map(cloneToolBarEntry) }));
    const targetToolBar = toolbars.find(entry => entry.id === toolBarId);
    if (targetToolBar) {
      targetToolBar.entries.push({ kind: args.kind, idRaw: args.idRaw });
    }
    applyMenuEnumPatch(edit, document, calls, collectMenuEnumSymbols(parsed.menus, toolbars));
  }

  return edit;
}


export function applyToolBarEntryUpdate(
  document: vscode.TextDocument,
  toolBarId: string,
  sourceLine: number,
  args: ToolBarEntryArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  if (sourceLine < 0 || sourceLine >= document.lineCount) return undefined;

  const calls = scanDocumentCalls(document, scanRange);
  const call = calls.find(c => c.range.line === sourceLine && isToolBarEntryCallNameForKind(c.name, args.kind));
  if (!call) return undefined;
  if (!isLineInCreateSection(calls, sourceLine, PB_CALL.createToolBar, toolBarId)) return undefined;

  const indent = getLineIndent(document, sourceLine);
  const rebuilt = buildToolBarEntryText(args, toolBarId, indent);
  const lineText = document.lineAt(sourceLine).text;
  const endInLine = Math.max(0, call.range.end - call.range.lineStart);
  const suffix = lineText.slice(endInLine);

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, document.lineAt(sourceLine).range, rebuilt + suffix);

  const previousEntryId = getToolBarEntryIdFromCall(call);
  const nextEntryId = args.idRaw?.trim() || previousEntryId;
  const tipCall = findToolBarToolTipCall(calls, toolBarId, previousEntryId);

  if (tipCall && tipCall.range.line !== sourceLine) {
    if (args.kind === TOOLBAR_ENTRY_KIND.ToolBarButton) {
      edit.delete(document.uri, document.lineAt(tipCall.range.line).rangeIncludingLineBreak);
    } else if (args.kind === TOOLBAR_ENTRY_KIND.ToolBarImageButton && previousEntryId && nextEntryId && previousEntryId !== nextEntryId) {
      const tipParts = splitParams(tipCall.args);
      const textRaw = (tipParts.length >= 3 ? tipParts[2] : tipParts[1])?.trim() ?? '""';
      const rebuiltTipLine = buildToolBarEntryText({
        kind: TOOLBAR_ENTRY_KIND.ToolBarToolTip,
        idRaw: nextEntryId,
        textRaw,
      }, toolBarId, getLineIndent(document, tipCall.range.line));
      edit.replace(document.uri, document.lineAt(tipCall.range.line).range, rebuiltTipLine);
    }
  }

  const parsed = parseFormDocument(document.getText());
  const toolbars = parsed.toolbars.map(toolBar => ({ ...toolBar, entries: toolBar.entries.map(cloneToolBarEntry) }));
  const targetToolBar = toolbars.find(entry => entry.id === toolBarId);
  const target = targetToolBar?.entries.find(entry => entry.source?.line === sourceLine && entry.kind.toLowerCase() === args.kind.toLowerCase());
  if (target && isToolBarButtonKind(target.kind)) {
    target.idRaw = args.idRaw;
  }
  applyMenuEnumPatch(edit, document, calls, collectMenuEnumSymbols(parsed.menus, toolbars));

  return edit;
}

export function applyToolBarEntryDelete(
  document: vscode.TextDocument,
  toolBarId: string,
  sourceLine: number,
  kind: ToolBarEntryKind,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);
  if (sourceLine < 0 || sourceLine >= document.lineCount) return undefined;

  const call = calls.find(c => c.range.line === sourceLine && isToolBarEntryCallNameForKind(c.name, kind));
  if (!call) return undefined;
  if (!isLineInCreateSection(calls, sourceLine, PB_CALL.createToolBar, toolBarId)) return undefined;

  const edit = new vscode.WorkspaceEdit();
  edit.delete(document.uri, document.lineAt(sourceLine).rangeIncludingLineBreak);

  if (isToolBarButtonKind(kind)) {
    const entryId = getToolBarEntryIdFromCall(call);
    const tipCall = findToolBarToolTipCall(calls, toolBarId, entryId);
    if (tipCall && tipCall.range.line !== sourceLine) {
      edit.delete(document.uri, document.lineAt(tipCall.range.line).rangeIncludingLineBreak);
    }
  }

  const parsed = parseFormDocument(document.getText());
  const toolbars = parsed.toolbars.map(toolBar => ({ ...toolBar, entries: toolBar.entries.map(cloneToolBarEntry) }));
  const targetToolBar = toolbars.find(entry => entry.id === toolBarId);
  if (targetToolBar) {
    const targetIndex = targetToolBar.entries.findIndex(entry => entry.source?.line === sourceLine && entry.kind.toLowerCase() === kind.toLowerCase());
    if (targetIndex >= 0) targetToolBar.entries.splice(targetIndex, 1);
  }
  applyMenuEnumPatch(edit, document, calls, collectMenuEnumSymbols(parsed.menus, toolbars));

  return edit;
}

function getDocumentLineTextWithEol(document: vscode.TextDocument, line: number): string {
  const textLine = document.lineAt(line);
  const hasLineBreak = textLine.rangeIncludingLineBreak.end.line > textLine.range.end.line;
  return `${textLine.text}${hasLineBreak ? getDocumentEol(document) : ""}`;
}

function getToolBarMoveBlockLines(
  calls: PbCall[],
  toolBarId: string,
  sourceLine: number,
  kind: ToolBarEntryKind
): number[] | undefined {
  const call = calls.find(c => c.range.line === sourceLine && isToolBarEntryCallNameForKind(c.name, kind));
  if (!call) return undefined;
  if (!isLineInCreateSection(calls, sourceLine, PB_CALL.createToolBar, toolBarId)) return undefined;

  const lines = [sourceLine];
  if (isToolBarButtonKind(kind)) {
    const tipCall = findToolBarToolTipCall(calls, toolBarId, getToolBarEntryIdFromCall(call));
    if (tipCall && tipCall.range.line !== sourceLine) {
      lines.push(tipCall.range.line);
    }
  }

  return [...new Set(lines)].sort((a, b) => a - b);
}

function getToolBarEntryKindFromCallName(callName: string): ToolBarEntryKind | undefined {
  const normalized = callName.toLowerCase();
  if (normalized === TOOLBAR_ENTRY_KIND.ToolBarStandardButton.toLowerCase()) return TOOLBAR_ENTRY_KIND.ToolBarImageButton;
  if (normalized === TOOLBAR_ENTRY_KIND.ToolBarButton.toLowerCase()) return TOOLBAR_ENTRY_KIND.ToolBarButton;
  if (normalized === TOOLBAR_ENTRY_KIND.ToolBarImageButton.toLowerCase()) return TOOLBAR_ENTRY_KIND.ToolBarImageButton;
  if (normalized === TOOLBAR_ENTRY_KIND.ToolBarSeparator.toLowerCase()) return TOOLBAR_ENTRY_KIND.ToolBarSeparator;
  if (normalized === TOOLBAR_ENTRY_KIND.ToolBarToolTip.toLowerCase()) return TOOLBAR_ENTRY_KIND.ToolBarToolTip;
  return undefined;
}

function getToolBarMoveInsertLine(
  calls: PbCall[],
  toolBarId: string,
  targetSourceLine: number,
  placement: TopLevelEntryMoveOptions["placement"]
): number | undefined {
  const targetCall = calls.find(call => call.range.line === targetSourceLine && TOOLBAR_ENTRY_NAMES.has(call.name.toLowerCase()));
  if (!targetCall) return undefined;
  if (!isLineInCreateSection(calls, targetSourceLine, PB_CALL.createToolBar, toolBarId)) return undefined;

  if (placement === MenuEntryMovePlacement.Before) return targetSourceLine;

  let lastTargetLine = targetSourceLine;
  const targetKind = getToolBarEntryKindFromCallName(targetCall.name);
  if (targetKind && isToolBarButtonKind(targetKind)) {
    const tipCall = findToolBarToolTipCall(calls, toolBarId, getToolBarEntryIdFromCall(targetCall));
    if (tipCall && tipCall.range.line > lastTargetLine) {
      lastTargetLine = tipCall.range.line;
    }
  }

  return lastTargetLine + 1;
}

export function applyToolBarEntryMove(
  document: vscode.TextDocument,
  toolBarId: string,
  sourceLine: number,
  kind: ToolBarEntryKind,
  options: TopLevelEntryMoveOptions,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  if (sourceLine < 0 || sourceLine >= document.lineCount) return undefined;
  if (options.targetSourceLine < 0 || options.targetSourceLine >= document.lineCount) return undefined;

  const calls = scanDocumentCalls(document, scanRange);
  const blockLines = getToolBarMoveBlockLines(calls, toolBarId, sourceLine, kind);
  if (!blockLines?.length) return undefined;

  const insertLine = getToolBarMoveInsertLine(calls, toolBarId, options.targetSourceLine, options.placement);
  if (typeof insertLine !== "number") return undefined;

  const minBlockLine = Math.min(...blockLines);
  const maxBlockLine = Math.max(...blockLines);
  if (insertLine >= minBlockLine && insertLine <= maxBlockLine + 1) return undefined;
  if (blockLines.includes(options.targetSourceLine)) return undefined;

  const blockText = blockLines.map(line => getDocumentLineTextWithEol(document, line)).join("");
  if (!blockText.length) return undefined;

  const edit = new vscode.WorkspaceEdit();
  for (const line of blockLines) {
    edit.delete(document.uri, document.lineAt(line).rangeIncludingLineBreak);
  }
  edit.insert(document.uri, new vscode.Position(Math.min(document.lineCount, insertLine), 0), blockText);
  return edit;
}

export function applyToolBarEntryTooltipSet(
  document: vscode.TextDocument,
  toolBarId: string,
  sourceLine: number,
  entryIdRaw: string,
  textRaw: string | undefined,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  if (sourceLine < 0 || sourceLine >= document.lineCount) return undefined;

  const calls = scanDocumentCalls(document, scanRange);
  if (!isLineInCreateSection(calls, sourceLine, PB_CALL.createToolBar, toolBarId)) return undefined;

  const normalizedEntryId = entryIdRaw.trim();
  if (!normalizedEntryId.length) return undefined;

  const tipCall = calls.find(call => {
    if (call.name.toLowerCase() !== TOOLBAR_ENTRY_KIND.ToolBarToolTip.toLowerCase()) return false;
    if (!isLineInCreateSection(calls, call.range.line, PB_CALL.createToolBar, toolBarId)) return false;
    const parts = splitParams(call.args);
    const buttonIdRaw = (parts.length >= 3 ? parts[1] : parts[0])?.trim() ?? "";
    return buttonIdRaw === normalizedEntryId;
  });

  const normalizedText = textRaw?.trim();
  if (!normalizedText?.length) {
    if (!tipCall) return undefined;
    const edit = new vscode.WorkspaceEdit();
    edit.delete(document.uri, document.lineAt(tipCall.range.line).rangeIncludingLineBreak);
    return edit;
  }

  const rebuiltLine = buildToolBarEntryLine({
    kind: TOOLBAR_ENTRY_KIND.ToolBarToolTip,
    idRaw: normalizedEntryId,
    textRaw: normalizedText,
  }, toolBarId);

  if (tipCall) {
    const indent = getLineIndent(document, tipCall.range.line);
    return replaceCallLinePreserveSuffix(document, tipCall, `${indent}${rebuiltLine}`);
  }

  const indent = getLineIndent(document, sourceLine);
  const insertPos = new vscode.Position(Math.min(document.lineCount, sourceLine + 1), 0);
  const edit = new vscode.WorkspaceEdit();
  edit.insert(document.uri, insertPos, `${indent}${rebuiltLine}
`);
  return edit;
}

export function applyMenuDelete(
  document: vscode.TextDocument,
  menuId: string,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);
  return applySectionDelete(document, calls, PB_CALL.createMenu, menuId);
}

export function applyToolBarDelete(
  document: vscode.TextDocument,
  toolBarId: string,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);
  return applySectionDelete(document, calls, PB_CALL.createToolBar, toolBarId);
}

export function applyStatusBarDelete(
  document: vscode.TextDocument,
  statusBarId: string,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);
  return applySectionDelete(document, calls, PB_CALL.createStatusBar, statusBarId);
}

export function applyStatusBarFieldInsert(
  document: vscode.TextDocument,
  statusBarId: string,
  args: StatusBarFieldArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  return applyStatusBarFieldMutation(
    document,
    statusBarId,
    fields => {
      fields.push(mapStatusBarArgsToField(args));
      return true;
    },
    scanRange
  );
}

export function applyStatusBarFieldUpdate(
  document: vscode.TextDocument,
  statusBarId: string,
  sourceLine: number,
  args: StatusBarFieldArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  return applyStatusBarFieldMutation(
    document,
    statusBarId,
    fields => {
      const index = fields.findIndex(field => field.source?.line === sourceLine);
      if (index < 0) return false;
      fields[index] = mergeStatusBarFieldArgs(fields[index], args);
      return true;
    },
    scanRange
  );
}

export function applyStatusBarFieldDelete(
  document: vscode.TextDocument,
  statusBarId: string,
  sourceLine: number,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  return applyStatusBarFieldMutation(
    document,
    statusBarId,
    fields => {
      const index = fields.findIndex(field => field.source?.line === sourceLine);
      if (index < 0) return false;
      fields.splice(index, 1);
      return true;
    },
    scanRange
  );
}

export function applyStatusBarFieldMove(
  document: vscode.TextDocument,
  statusBarId: string,
  sourceLine: number,
  options: TopLevelEntryMoveOptions,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  return applyStatusBarFieldMutation(
    document,
    statusBarId,
    fields => {
      const sourceIndex = fields.findIndex(field => field.source?.line === sourceLine);
      const targetIndex = fields.findIndex(field => field.source?.line === options.targetSourceLine);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return false;

      const [field] = fields.splice(sourceIndex, 1);
      let insertIndex = options.placement === MenuEntryMovePlacement.Before ? targetIndex : targetIndex + 1;
      if (sourceIndex < insertIndex) insertIndex -= 1;
      if (insertIndex === sourceIndex) return false;

      fields.splice(insertIndex, 0, field);
      return true;
    },
    scanRange
  );
}

export function applyStatusBarFieldDeleteWithImageCleanup(
  document: vscode.TextDocument,
  statusBarId: string,
  sourceLine: number,
  cleanupSourceLine: number,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  let pendingRenames: ImageRename[] = [];

  return applyImageMutation(
    document,
    images => {
      const cleanupIndex = images.findIndex(image => image.source?.line === cleanupSourceLine);
      if (cleanupIndex < 0) return false;

      images.splice(cleanupIndex, 1);

      const parsed = parseFormDocument(document.getText());
      pendingRenames = reindexImages(images, getWindowImageBaseName(parsed));
      return true;
    },
    scanRange,
    edit => {
      const statusBarLines = collectStatusBarFieldMutationLines(document, statusBarId, scanRange);
      applyImageIdRenames(edit, document, pendingRenames, statusBarLines);

      const statusEdit = applyStatusBarFieldMutation(
        document,
        statusBarId,
        fields => {
          const index = fields.findIndex(field => field.source?.line === sourceLine);
          if (index < 0) return false;
          fields.splice(index, 1);
          return true;
        },
        scanRange,
        pendingRenames
      );
      if (!statusEdit) return false;
      appendWorkspaceEdit(edit, statusEdit);
      return true;
    }
  );
}

export function applyImageCleanupAfterSingleLineReferenceDelete(
  document: vscode.TextDocument,
  cleanupSourceLine: number,
  buildDeleteEdit: () => vscode.WorkspaceEdit | undefined,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  let pendingRenames: ImageRename[] = [];

  return applyImageMutation(
    document,
    images => {
      const cleanupIndex = images.findIndex(image => image.source?.line === cleanupSourceLine);
      if (cleanupIndex < 0) return false;

      images.splice(cleanupIndex, 1);

      const parsed = parseFormDocument(document.getText());
      pendingRenames = reindexImages(images, getWindowImageBaseName(parsed));
      return true;
    },
    scanRange,
    edit => {
      const deleteEdit = buildDeleteEdit();
      if (!deleteEdit) return false;

      const skipLines = collectWorkspaceEditTouchedLines(deleteEdit);
      applyImageIdRenames(edit, document, pendingRenames, skipLines);
      appendWorkspaceEdit(edit, deleteEdit);
      return true;
    }
  );
}


export function applyFontInsert(
  document: vscode.TextDocument,
  args: FontArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  return applyFontMutation(
    document,
    fonts => {
      fonts.push(mapFontArgsToFont(args));
      return true;
    },
    scanRange
  );
}

export function applyFontUpdate(
  document: vscode.TextDocument,
  sourceLine: number,
  args: FontArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  return applyFontMutation(
    document,
    fonts => {
      const index = fonts.findIndex(font => font.source?.line === sourceLine);
      if (index < 0) return false;
      fonts[index] = {
        ...fonts[index],
        ...mapFontArgsToFont(args),
        source: fonts[index].source,
      };
      return true;
    },
    scanRange
  );
}

export function applyFontDelete(
  document: vscode.TextDocument,
  sourceLine: number,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  return applyFontMutation(
    document,
    fonts => {
      const index = fonts.findIndex(font => font.source?.line === sourceLine);
      if (index < 0) return false;
      fonts.splice(index, 1);
      return true;
    },
    scanRange
  );
}

export function applyImageInsert(
  document: vscode.TextDocument,
  args: ImageArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  return applyImageMutation(
    document,
    images => {
      images.push(mapImageArgsToImage(args));
      return true;
    },
    scanRange
  );
}

export function applyImageInsertAndReferenceUpdate(
  document: vscode.TextDocument,
  args: ImageArgs,
  buildReferenceEdit: (imageRef: string) => vscode.WorkspaceEdit | undefined,
  cleanupSourceLine?: number,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  let insertedImage: FormImage | undefined;
  let pendingRenames: ImageRename[] = [];

  return applyImageMutation(
    document,
    images => {
      if (typeof cleanupSourceLine === "number") {
        const cleanupIndex = images.findIndex(image => image.source?.line === cleanupSourceLine);
        if (cleanupIndex < 0) return false;
        images.splice(cleanupIndex, 1);
      }

      insertedImage = mapImageArgsToImage(args);
      images.push(insertedImage);

      if (typeof cleanupSourceLine === "number") {
        const parsed = parseFormDocument(document.getText());
        pendingRenames = reindexImages(images, getWindowImageBaseName(parsed));
      }

      return true;
    },
    scanRange,
    edit => {
      applyImageIdRenames(edit, document, pendingRenames);
      const imageRef = insertedImage ? buildImageIdReference(insertedImage.id) : undefined;
      if (!imageRef) return false;
      const referenceEdit = buildReferenceEdit(imageRef);
      if (!referenceEdit) return false;
      appendWorkspaceEdit(edit, referenceEdit);
      return true;
    }
  );
}

/**
 * Rebuilds the image block, optionally removes an old image entry, reindexes
 * remaining image IDs, and updates one target ImageID(...) reference to its
 * final ID after reindexing.
 */
export function applyImageReferenceUpdateWithCleanup(
  document: vscode.TextDocument,
  imageRaw: string,
  buildReferenceEdit: (imageRef: string) => vscode.WorkspaceEdit | undefined,
  cleanupSourceLine: number,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const targetImageId = getImageIdFromReference(imageRaw);
  let finalImageRaw = imageRaw;
  let pendingRenames: ImageRename[] = [];

  return applyImageMutation(
    document,
    images => {
      const cleanupIndex = images.findIndex(image => image.source?.line === cleanupSourceLine);
      if (cleanupIndex < 0) return false;

      if (targetImageId) {
        const targetIndex = images.findIndex(image => image.id === targetImageId);
        if (targetIndex < 0 || targetIndex === cleanupIndex) return false;
      }

      images.splice(cleanupIndex, 1);

      const parsed = parseFormDocument(document.getText());
      pendingRenames = reindexImages(images, getWindowImageBaseName(parsed));
      finalImageRaw = remapImageReference(imageRaw, pendingRenames);
      return true;
    },
    scanRange,
    edit => {
      applyImageIdRenames(edit, document, pendingRenames);
      const referenceEdit = buildReferenceEdit(finalImageRaw);
      if (!referenceEdit) return false;
      appendWorkspaceEdit(edit, referenceEdit);
      return true;
    }
  );
}

export function applyImageUpdate(
  document: vscode.TextDocument,
  sourceLine: number,
  args: ImageArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  // Capture renames produced by reindexImages so afterBuild can apply them.
  let pendingRenames: ImageRename[] = [];

  return applyImageMutation(
    document,
    images => {
      const index = images.findIndex(image => image.source?.line === sourceLine);
      if (index < 0) return false;

      if (args.pbAny === true && !images[index].pbAny) {
        // Convert enum image → #PB_Any variable, move to list end, re-index.
        // Mirrors FD_ProcessEventGridStatusbar case 2 → AddImage("") +
        // CleanImageList() + FD_SelectCode re-numbering in codeviewer.pb.
        const parsed2 = parseFormDocument(document.getText());
        const windowVar = getWindowImageBaseName(parsed2);

        const [entry] = images.splice(index, 1);
        const trimmedImageRaw = args.imageRaw.trim();
        entry.pbAny = true;
        entry.firstParam = PB_ANY;
        entry.inline = args.inline;
        entry.imageRaw = trimmedImageRaw;
        entry.image = normalizePbImageValue(trimmedImageRaw, args.inline);
        images.push(entry);

        pendingRenames = reindexImages(images, windowVar);
      } else {
        const oldId = images[index].id;
        const nextImage = {
          ...images[index],
          ...mapImageArgsToImage(args),
          source: images[index].source,
        };
        images[index] = nextImage;
        if (oldId !== nextImage.id) {
          pendingRenames = [{ oldId, newId: nextImage.id }];
        }
      }
      return true;
    },
    scanRange,
    (edit) => applyImageIdRenames(edit, document, pendingRenames)
  );
}

export function applyImageDelete(
  document: vscode.TextDocument,
  sourceLine: number,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  let pendingRenames: ImageRename[] = [];

  return applyImageMutation(
    document,
    images => {
      const parsed = parseFormDocument(document.getText());
      const index = images.findIndex(image => image.source?.line === sourceLine);
      if (index < 0) return false;

      const deletedImageId = images[index].id;
      const canReindexReferences = !formImageHasParsedReference(parsed, deletedImageId);
      images.splice(index, 1);

      if (canReindexReferences) {
        pendingRenames = reindexImages(images, getWindowImageBaseName(parsed));
      }
      return true;
    },
    scanRange,
    (edit) => applyImageIdRenames(edit, document, pendingRenames)
  );
}

// ---------------------------------------------------------------------------
// Image reference synthesis helpers
// ---------------------------------------------------------------------------

/**
 * Builds the PureBasic ImageID(...) expression used to reference an image
 * from a gadget/menu/toolbar/statusbar argument.
 * Returns undefined when the input is empty or when #PB_Any is used without
 * an assigned variable name (because the reference cannot be resolved).
 */
export function buildImageIdReference(idRaw: string, assignedVar?: string): string | undefined {
  const trimmedId = idRaw.trim();
  if (!trimmedId.length) return undefined;

  if (trimmedId.toLowerCase() === "#pb_any") {
    const variableName = assignedVar?.trim();
    return variableName ? `ImageID(${variableName})` : undefined;
  }

  return `ImageID(${trimmedId})`;
}

/**
 * Derives the #PB_Any assigned variable name from a raw first parameter.
 * "#IMG" → "IMG", "imgSave" → "imgSave", "" → undefined.
 */
export function toPbAnyAssignedVar(firstParam: string): string | undefined {
  const trimmed = firstParam.trim();
  if (!trimmed.length) return undefined;
  return trimmed.startsWith("#") ? trimmed.slice(1).trim() || undefined : trimmed;
}

/**
 * Normalises a variable name or enum symbol to a PureBasic enum image ID
 * with a leading "#". Idempotent: "#IMG" → "#IMG", "IMG" → "#IMG".
 */
export function toEnumImageId(variableOrId: string): string | undefined {
  const trimmed = variableOrId.trim();
  if (!trimmed.length) return undefined;
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}
