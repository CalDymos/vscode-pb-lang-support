import * as vscode from "vscode";
import { scanCalls } from "../parser/callScanner";
import { splitParams } from "../parser/tokenizer";
import { ScanRange, MENU_ENTRY_KIND, TOOLBAR_ENTRY_KIND, MenuEntryKind, ToolBarEntryKind } from "../model";

type PbCall = ReturnType<typeof scanCalls>[number];

/**
 * Escape special characters in regular expressions
 */
function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stableKey(assignedVar: string | undefined, params: string[]): string | undefined {
  if (params.length < 1) return undefined;

  const first = params[0].trim();
  if (first === "#PB_Any") {
    return assignedVar ?? "#PB_Any";
  }

  return first;
}

function normalizeProcParamName(raw: string): string {
  let name = raw.trim();
  name = name.replace(/^\*+/, "");
  const dot = name.indexOf(".");
  if (dot >= 0) name = name.slice(0, dot);
  return name.toLowerCase();
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

function scanDocumentCalls(document: vscode.TextDocument, scanRange?: ScanRange): PbCall[] {
  return scanCalls(document.getText(), scanRange);
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

export interface MenuEntryArgs {
  kind: MenuEntryKind;
  idRaw?: string;
  textRaw?: string;
}

export interface ToolBarEntryArgs {
  kind: ToolBarEntryKind;
  idRaw?: string;
  iconRaw?: string;
  textRaw?: string;
}

export interface StatusBarFieldArgs {
  widthRaw: string;
}

function isCreateBoundary(nameLower: string): boolean {
  return (
    nameLower === "createmenu" ||
    nameLower === "createtoolbar" ||
    nameLower === "createstatusbar" ||
    nameLower === "openwindow"
  );
}

function findNearestCreateAbove(
  calls: PbCall[],
  line: number,
  createNameLower: string
) {
  let best: (typeof calls)[number] | undefined;
  for (const c of calls) {
    if (c.name.toLowerCase() !== createNameLower) continue;
    if (c.range.line <= line) best = c;
    else break;
  }
  return best;
}

function buildMenuEntryLine(args: MenuEntryArgs): string {
  switch (args.kind) {
    case MENU_ENTRY_KIND.MenuTitle:
      return `MenuTitle(${(args.textRaw ?? "\"\"").trim()})`;
    case MENU_ENTRY_KIND.MenuItem:
      return `MenuItem(${(args.idRaw ?? "0").trim()}, ${(args.textRaw ?? "\"\"").trim()})`;
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

function buildToolBarEntryLine(args: ToolBarEntryArgs): string {
  switch (args.kind) {
    case TOOLBAR_ENTRY_KIND.ToolBarStandardButton:
      return `ToolBarStandardButton(${(args.idRaw ?? "0").trim()}, ${(args.iconRaw ?? "0").trim()})`;
    case TOOLBAR_ENTRY_KIND.ToolBarButton: {
      const id = (args.idRaw ?? "0").trim();
      const icon = (args.iconRaw ?? "0").trim();
      const text = (args.textRaw ?? "\"\"").trim();
      return `ToolBarButton(${id}, ${icon}, ${text})`;
    }
    case TOOLBAR_ENTRY_KIND.ToolBarSeparator:
      return "ToolBarSeparator()";
    case TOOLBAR_ENTRY_KIND.ToolBarToolTip:
      return `ToolBarToolTip(${(args.idRaw ?? "0").trim()}, ${(args.textRaw ?? "\"\"").trim()})`;
    default:
      return "";
  }
}


// -----------------------------------------------------------------------------
// Helpers for window id / pbAny patching
// -----------------------------------------------------------------------------

type LineBlock = { startLine: number; endLine: number };

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

function ensureGlobalLine(edit: vscode.WorkspaceEdit, document: vscode.TextDocument, varName: string) {
  const re = new RegExp(`^\\s*Global\\s+${escapeRegExp(varName)}\\b`);
  for (let i = 0; i < document.lineCount; i++) {
    if (re.test(document.lineAt(i).text)) return;
  }

  let insertLine = 0;
  let lastGlobal = -1;
  let anchor = -1;
  for (let i = 0; i < document.lineCount; i++) {
    const t = document.lineAt(i).text;
    if (/^\s*Global\b/i.test(t)) lastGlobal = i;
    if (anchor < 0 && (/^\s*Enumeration\b/i.test(t) || /^\s*Procedure\b/i.test(t))) {
      anchor = i;
    }
  }
  if (lastGlobal >= 0) insertLine = lastGlobal + 1;
  else if (anchor >= 0) insertLine = anchor;
  else insertLine = document.lineCount;

  const line = `Global ${varName}\n`;
  edit.insert(document.uri, new vscode.Position(insertLine, 0), line);
}

function removeGlobalLine(edit: vscode.WorkspaceEdit, document: vscode.TextDocument, varName: string) {
  const re = new RegExp(`^\\s*Global\\s+${escapeRegExp(varName)}\\b`);
  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i);
    if (re.test(line.text)) {
      edit.delete(document.uri, line.rangeIncludingLineBreak);
    }
  }
}

function ensureWindowEnumeration(edit: vscode.WorkspaceEdit, document: vscode.TextDocument, enumSymbol: string, enumValueRaw: string | undefined) {
  const block = findNamedEnumerationBlock(document, "FormWindow");
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

  // Insert a new Enumeration FormWindow block before Enumeration FormGadget or Procedure.
  let anchor = -1;
  for (let i = 0; i < document.lineCount; i++) {
    const t = document.lineAt(i).text;
    if (/^\s*Enumeration\s+FormGadget\b/i.test(t) || /^\s*Procedure\b/i.test(t)) {
      anchor = i;
      break;
    }
  }
  if (anchor < 0) anchor = document.lineCount;

  const entry = enumValueRaw && enumValueRaw.trim().length
    ? `  ${enumSymbol}=${enumValueRaw.trim()}`
    : `  ${enumSymbol}`;

  const blockText = `Enumeration FormWindow\n${entry}\nEndEnumeration\n\n`;
  edit.insert(document.uri, new vscode.Position(anchor, 0), blockText);
}

function findProcedureBlock(document: vscode.TextDocument, line: number): LineBlock | undefined {
  let startLine: number | undefined;
  for (let i = line; i >= 0; i--) {
    const t = document.lineAt(i).text;
    if (/^\s*EndProcedure\b/i.test(t)) break;
    if (/^\s*Procedure\b/i.test(t)) {
      startLine = i;
      break;
    }
  }
  if (startLine === undefined) return undefined;
  for (let i = line; i < document.lineCount; i++) {
    const t = document.lineAt(i).text;
    if (/^\s*EndProcedure\b/i.test(t)) {
      return { startLine, endLine: i };
    }
  }
  return undefined;
}

function parseProcedureName(line: string): { name: string; nameStart: number; nameEnd: number } | undefined {
  // Matches: Procedure xxx(...), Procedure.i xxx(...), Procedure.s xxx(...)
  const m = /^\s*Procedure(?:\.\w+)?\s+([A-Za-z_]\w*)\s*\(/.exec(line);
  if (!m) return undefined;

  const name = m[1];
  const idx = line.indexOf(name);
  if (idx < 0) return undefined;

  return { name, nameStart: idx, nameEnd: idx + name.length };
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
  const procCalls = calls.filter(c => c.name === oldProcName);
  for (const c of procCalls) {
    // Replace only the name token, keep args/assignment/indent
    const indent = c.indent ?? getLineIndent(document, c.range.line);
    const rebuiltCall = `${newProcName}(${c.args})`;
    const updatedLine = c.assignedVar ? `${indent}${c.assignedVar} = ${rebuiltCall}` : `${indent}${rebuiltCall}`;

    edit.replace(
      document.uri,
      new vscode.Range(document.positionAt(c.range.lineStart), document.positionAt(c.range.end)),
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

  for (const c of calls) {
    if (c.name !== oldName) continue;

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
  const calls = scanDocumentCalls(document, scanRange);
  const call = findCallByStableKey(calls, gadgetKey);

  if (!call) return undefined;

  const params = splitParams(call.args);
  if (params.length < 3) return undefined;

  params[1] = String(Math.trunc(x));
  params[2] = String(Math.trunc(y));

  return replaceCallArgsEdit(document, call, params);
}

export function applyRectPatch(
  document: vscode.TextDocument,
  gadgetKey: string,
  x: number,
  y: number,
  w: number,
  h: number,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);
  const call = findCallByStableKey(calls, gadgetKey);

  if (!call) return undefined;

  const params = splitParams(call.args);
  if (params.length < 5) return undefined;

  params[1] = String(Math.trunc(x));
  params[2] = String(Math.trunc(y));
  params[3] = String(Math.trunc(w));
  params[4] = String(Math.trunc(h));

  return replaceCallArgsEdit(document, call, params);
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

  const isFirstParamPbAny = (openParams[0] ?? "").trim() === "#PB_Any";

  const edit = new vscode.WorkspaceEdit();

  // Locate the surrounding procedure block (used for consistent global/enum placement + optional id replacements).
  const proc = findProcedureBlock(document, openWin.range.line);

  if (toPbAny) {
    // 1) Remove Enumeration FormWindow block.
    const enumBlock = findNamedEnumerationBlock(document, "FormWindow");
    if (enumBlock) {
      edit.delete(
        document.uri,
        new vscode.Range(
          new vscode.Position(enumBlock.startLine, 0),
          document.lineAt(enumBlock.endLine).rangeIncludingLineBreak.end
        )
      );
    }

    // 2) Ensure Global variable exists.
    ensureGlobalLine(edit, document, variableName);

    // 3) Rewrite OpenWindow line to "Var = OpenWindow(#PB_Any, ...)".
    openParams[0] = "#PB_Any";
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
  const block = findNamedEnumerationBlock(document, "FormWindow");
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

export function applyWindowVariableNamePatch(
  document: vscode.TextDocument,
  variableName: string,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const newVar = variableName.trim();
  if (!newVar.length) return undefined;

  const calls = scanDocumentCalls(document, scanRange);

  const openWin = calls.find(c => c.name === "OpenWindow");
  if (!openWin) return undefined;

  const params = splitParams(openWin.args);
  if (params.length < 1) return undefined;

  const first = (params[0] ?? "").trim();
  const edit = new vscode.WorkspaceEdit();

  const proc = findProcedureBlock(document, openWin.range.line);

  // ---------------------------------------------------------------------------
  // PB_Any mode:  <oldVar> = OpenWindow(#PB_Any, ...)
  // ---------------------------------------------------------------------------
  if (first === "#PB_Any") {
    const oldVar = (openWin.assignedVar ?? "").trim();
    if (!oldVar.length) {
      return undefined;
    }

    // Procedure rename: Open<oldVar> -> Open<newVar>
    const oldProcName = toOpenProcName(oldVar);
    const newProcName = toOpenProcName(newVar);

    // 1) Rename Global line
    if (oldVar !== newVar) {
      removeGlobalLine(edit, document, oldVar);
      ensureGlobalLine(edit, document, newVar);
    } else {
      ensureGlobalLine(edit, document, newVar);
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

    // 4) Patch "Procedure OpenX(...)" (and calls) if possible
    if (oldProcName && newProcName) {
      patchProcedureNameInBlock(edit, document, proc, oldProcName, newProcName);
      patchProcedureCallsBestEffort(edit, document, calls, oldProcName, newProcName, scanRange);
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
  const block = findNamedEnumerationBlock(document, "FormWindow");
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

  const calls = scanDocumentCalls(document, scanRange);

  const call = findGadgetEntryCallAtLine(calls, "addgadgetitem", gadgetKey, sourceLine);
  if (!call) return undefined;

  const edit = new vscode.WorkspaceEdit();
  edit.delete(document.uri, document.lineAt(sourceLine).rangeIncludingLineBreak);
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
  return edit;
}

// -----------------------------------------------------------------------------
// Menu / ToolBar / StatusBar emitters
// -----------------------------------------------------------------------------

const MENU_ENTRY_NAMES = new Set(["menutitle", "menuitem", "menubar", "opensubmenu", "closesubmenu"]);
const TOOLBAR_ENTRY_NAMES = new Set([
  "toolbarstandardbutton",
  "toolbarbutton",
  "toolbarseparator",
  "toolbartooltip"
]);
const STATUSBAR_FIELD_NAMES = new Set(["addstatusbarfield"]);

function findCreateCallById(calls: PbCall[], createNameLower: string, id: string): PbCall | undefined {
  return calls.find(c => c.name.toLowerCase() === createNameLower && firstParamOfCall(c.args) === id);
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
  edit.insert(document.uri, insertPos, line);
  return edit;
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

export function applyMenuEntryInsert(
  document: vscode.TextDocument,
  menuId: string,
  args: MenuEntryArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);
  return applySectionEntryInsert(
    document,
    calls,
    "createmenu",
    menuId,
    MENU_ENTRY_NAMES,
    indent => `${indent}${buildMenuEntryLine(args)}`
  );
}

export function applyMenuEntryUpdate(
  document: vscode.TextDocument,
  menuId: string,
  sourceLine: number,
  args: MenuEntryArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);
  return applySectionEntryUpdate(
    document,
    calls,
    "createmenu",
    menuId,
    sourceLine,
    args.kind.toLowerCase(),
    buildMenuEntryLine(args)
  );
}

export function applyMenuEntryDelete(
  document: vscode.TextDocument,
  menuId: string,
  sourceLine: number,
  kind: MenuEntryKind,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);
  return applySectionEntryDelete(
    document,
    calls,
    "createmenu",
    menuId,
    sourceLine,
    kind.toLowerCase()
  );
}

export function applyToolBarEntryInsert(
  document: vscode.TextDocument,
  toolBarId: string,
  args: ToolBarEntryArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);
  return applySectionEntryInsert(
    document,
    calls,
    "createtoolbar",
    toolBarId,
    TOOLBAR_ENTRY_NAMES,
    indent => `${indent}${buildToolBarEntryLine(args)}`
  );
}


export function applyToolBarEntryUpdate(
  document: vscode.TextDocument,
  toolBarId: string,
  sourceLine: number,
  args: ToolBarEntryArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);
  return applySectionEntryUpdate(
    document,
    calls,
    "createtoolbar",
    toolBarId,
    sourceLine,
    args.kind.toLowerCase(),
    buildToolBarEntryLine(args)
  );
}

export function applyToolBarEntryDelete(
  document: vscode.TextDocument,
  toolBarId: string,
  sourceLine: number,
  kind: ToolBarEntryKind,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);
  return applySectionEntryDelete(
    document,
    calls,
    "createtoolbar",
    toolBarId,
    sourceLine,
    kind.toLowerCase()
  );
}

export function applyStatusBarFieldInsert(
  document: vscode.TextDocument,
  statusBarId: string,
  args: StatusBarFieldArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);
  return applySectionEntryInsert(
    document,
    calls,
    "createstatusbar",
    statusBarId,
    STATUSBAR_FIELD_NAMES,
    indent => `${indent}AddStatusBarField(${args.widthRaw.trim()})`
  );
}

export function applyStatusBarFieldUpdate(
  document: vscode.TextDocument,
  statusBarId: string,
  sourceLine: number,
  args: StatusBarFieldArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);
  return applySectionEntryUpdate(
    document,
    calls,
    "createstatusbar",
    statusBarId,
    sourceLine,
    "addstatusbarfield",
    `AddStatusBarField(${args.widthRaw.trim()})`
  );
}

export function applyStatusBarFieldDelete(
  document: vscode.TextDocument,
  statusBarId: string,
  sourceLine: number,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const calls = scanDocumentCalls(document, scanRange);
  return applySectionEntryDelete(
    document,
    calls,
    "createstatusbar",
    statusBarId,
    sourceLine,
    "addstatusbarfield"
  );
}
