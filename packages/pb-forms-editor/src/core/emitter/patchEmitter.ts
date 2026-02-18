import * as vscode from "vscode";
import { scanCalls } from "../parser/callScanner";
import { splitParams } from "../parser/tokenizer";
import { ScanRange } from "../model";

function stableKey(assignedVar: string | undefined, params: string[]): string | undefined {
  if (params.length < 1) return undefined;

  const first = params[0].trim();
  if (first === "#PB_Any") {
    return assignedVar ?? "#PB_Any";
  }

  return first;
}

function getLineIndent(document: vscode.TextDocument, line: number): string {
  if (line < 0 || line >= document.lineCount) return "";
  const text = document.lineAt(line).text;
  const m = /^\s*/.exec(text);
  return m?.[0] ?? "";
}

function findCallByStableKey(
  calls: ReturnType<typeof scanCalls>,
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

function findCallsByName(calls: ReturnType<typeof scanCalls>, nameLower: string) {
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

export type MenuEntryKind = "MenuTitle" | "MenuItem" | "MenuBar" | "OpenSubMenu" | "CloseSubMenu";

export interface MenuEntryArgs {
  kind: MenuEntryKind;
  idRaw?: string;
  textRaw?: string;
}

export type ToolBarEntryKind = "ToolBarStandardButton" | "ToolBarButton" | "ToolBarSeparator" | "ToolBarToolTip";

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
  calls: ReturnType<typeof scanCalls>,
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
    case "MenuTitle":
      return `MenuTitle(${(args.textRaw ?? "\"\"").trim()})`;
    case "MenuItem":
      return `MenuItem(${(args.idRaw ?? "0").trim()}, ${(args.textRaw ?? "\"\"").trim()})`;
    case "MenuBar":
      return "MenuBar()";
    case "OpenSubMenu":
      return `OpenSubMenu(${(args.textRaw ?? "\"\"").trim()})`;
    case "CloseSubMenu":
      return "CloseSubMenu()";
    default:
      return "";
  }
}

function buildToolBarEntryLine(args: ToolBarEntryArgs): string {
  switch (args.kind) {
    case "ToolBarStandardButton":
      return `ToolBarStandardButton(${(args.idRaw ?? "0").trim()}, ${(args.iconRaw ?? "0").trim()})`;
    case "ToolBarButton": {
      const id = (args.idRaw ?? "0").trim();
      const icon = (args.iconRaw ?? "0").trim();
      const text = (args.textRaw ?? "\"\"").trim();
      return `ToolBarButton(${id}, ${icon}, ${text})`;
    }
    case "ToolBarSeparator":
      return "ToolBarSeparator()";
    case "ToolBarToolTip":
      return `ToolBarToolTip(${(args.idRaw ?? "0").trim()}, ${(args.textRaw ?? "\"\"").trim()})`;
    default:
      return "";
  }
}

export function applyMovePatch(
  document: vscode.TextDocument,
  gadgetKey: string,
  x: number,
  y: number,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const text = document.getText();
  const calls = scanCalls(text, scanRange);

  const call = calls.find(c => {
    const params = splitParams(c.args);
    const key = stableKey(c.assignedVar, params);
    return key === gadgetKey;
  });

  if (!call) return undefined;

  const params = splitParams(call.args);
  if (params.length < 3) return undefined;

  params[1] = String(Math.trunc(x));
  params[2] = String(Math.trunc(y));

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

export function applyRectPatch(
  document: vscode.TextDocument,
  gadgetKey: string,
  x: number,
  y: number,
  w: number,
  h: number,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const text = document.getText();
  const calls = scanCalls(text, scanRange);

  const call = calls.find(c => {
    const params = splitParams(c.args);
    const key = stableKey(c.assignedVar, params);
    return key === gadgetKey;
  });

  if (!call) return undefined;

  const params = splitParams(call.args);
  if (params.length < 5) return undefined;

  params[1] = String(Math.trunc(x));
  params[2] = String(Math.trunc(y));
  params[3] = String(Math.trunc(w));
  params[4] = String(Math.trunc(h));

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

export function applyWindowRectPatch(
  document: vscode.TextDocument,
  windowKey: string,
  x: number,
  y: number,
  w: number,
  h: number,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const text = document.getText();
  const calls = scanCalls(text, scanRange);

  const call = calls.find(c => {
    if (c.name !== "OpenWindow") return false;
    const params = splitParams(c.args);
    const key = stableKey(c.assignedVar, params);
    return key === windowKey;
  });

  if (!call) return undefined;

  const params = splitParams(call.args);
  if (params.length < 5) return undefined;

  params[1] = String(Math.trunc(x));
  params[2] = String(Math.trunc(y));
  params[3] = String(Math.trunc(w));
  params[4] = String(Math.trunc(h));

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

export function applyGadgetItemInsert(
  document: vscode.TextDocument,
  gadgetKey: string,
  args: GadgetItemArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const text = document.getText();
  const calls = scanCalls(text, scanRange);

  const own = findCallsByName(calls, "addgadgetitem").filter(c => firstParamOfCall(c.args) === gadgetKey);

  let insertAfterLine: number | undefined;
  let indent = "";

  if (own.length > 0) {
    const last = own[own.length - 1];
    insertAfterLine = last.range.line;
    indent = getLineIndent(document, insertAfterLine);
  } else {
    const all = findCallsByName(calls, "addgadgetitem");
    if (all.length > 0) {
      const last = all[all.length - 1];
      insertAfterLine = last.range.line;
      indent = getLineIndent(document, insertAfterLine);
    } else {
      const createCall = findCallByStableKey(calls, gadgetKey, n => /gadget$/i.test(n));
      if (!createCall) return undefined;
      insertAfterLine = createCall.range.line;
      indent = getLineIndent(document, insertAfterLine);
    }
  }

  const insertPos = new vscode.Position(Math.min(document.lineCount, insertAfterLine + 1), 0);
  const line = `${indent}AddGadgetItem(${buildAddGadgetItemArgs(gadgetKey, args)})\n`;

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

  const text = document.getText();
  const calls = scanCalls(text, scanRange);

  const call = calls.find(c => c.name.toLowerCase() === "addgadgetitem" && c.range.line === sourceLine && firstParamOfCall(c.args) === gadgetKey);
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

  const text = document.getText();
  const calls = scanCalls(text, scanRange);
  const call = calls.find(c => c.name.toLowerCase() === "addgadgetitem" && c.range.line === sourceLine && firstParamOfCall(c.args) === gadgetKey);
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
  const text = document.getText();
  const calls = scanCalls(text, scanRange);

  const own = findCallsByName(calls, "addgadgetcolumn").filter(c => firstParamOfCall(c.args) === gadgetKey);

  let insertAfterLine: number | undefined;
  let indent = "";

  if (own.length > 0) {
    const last = own[own.length - 1];
    insertAfterLine = last.range.line;
    indent = getLineIndent(document, insertAfterLine);
  } else {
    const all = findCallsByName(calls, "addgadgetcolumn");
    if (all.length > 0) {
      const last = all[all.length - 1];
      insertAfterLine = last.range.line;
      indent = getLineIndent(document, insertAfterLine);
    } else {
      const createCall = findCallByStableKey(calls, gadgetKey, n => /gadget$/i.test(n));
      if (!createCall) return undefined;
      insertAfterLine = createCall.range.line;
      indent = getLineIndent(document, insertAfterLine);
    }
  }

  const insertPos = new vscode.Position(Math.min(document.lineCount, insertAfterLine + 1), 0);
  const line = `${indent}AddGadgetColumn(${buildAddGadgetColumnArgs(gadgetKey, args)})\n`;

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

  const text = document.getText();
  const calls = scanCalls(text, scanRange);

  const call = calls.find(c => c.name.toLowerCase() === "addgadgetcolumn" && c.range.line === sourceLine && firstParamOfCall(c.args) === gadgetKey);
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

  const text = document.getText();
  const calls = scanCalls(text, scanRange);

  const call = calls.find(c => c.name.toLowerCase() === "addgadgetcolumn" && c.range.line === sourceLine && firstParamOfCall(c.args) === gadgetKey);
  if (!call) return undefined;

  const edit = new vscode.WorkspaceEdit();
  edit.delete(document.uri, document.lineAt(sourceLine).rangeIncludingLineBreak);
  return edit;
}

// -----------------------------------------------------------------------------
// Menu / ToolBar / StatusBar emitters
// -----------------------------------------------------------------------------

export function applyMenuEntryInsert(
  document: vscode.TextDocument,
  menuId: string,
  args: MenuEntryArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const text = document.getText();
  const calls = scanCalls(text, scanRange);

  const create = calls.find(
    c => c.name.toLowerCase() === "createmenu" && firstParamOfCall(c.args) === menuId
  );
  if (!create) return undefined;

  const startIdx = calls.indexOf(create);
  let endIdx = calls.length;
  for (let i = startIdx + 1; i < calls.length; i++) {
    if (isCreateBoundary(calls[i].name.toLowerCase())) {
      endIdx = i;
      break;
    }
  }

  const entryNames = new Set(["menutitle", "menuitem", "menubar", "opensubmenu", "closesubmenu"]);
  let insertAfterLine = create.range.line;
  for (let i = startIdx + 1; i < endIdx; i++) {
    if (entryNames.has(calls[i].name.toLowerCase())) {
      insertAfterLine = calls[i].range.line;
    }
  }

  const indent = getLineIndent(document, insertAfterLine);
  const line = `${indent}${buildMenuEntryLine(args)}\n`;
  const insertPos = new vscode.Position(Math.min(document.lineCount, insertAfterLine + 1), 0);

  const edit = new vscode.WorkspaceEdit();
  edit.insert(document.uri, insertPos, line);
  return edit;
}

export function applyMenuEntryUpdate(
  document: vscode.TextDocument,
  menuId: string,
  sourceLine: number,
  args: MenuEntryArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  if (sourceLine < 0 || sourceLine >= document.lineCount) return undefined;

  const text = document.getText();
  const calls = scanCalls(text, scanRange);

  const call = calls.find(
    c => c.range.line === sourceLine && c.name.toLowerCase() === args.kind.toLowerCase()
  );
  if (!call) return undefined;

  const create = findNearestCreateAbove(calls, sourceLine, "createmenu");
  if (!create || firstParamOfCall(create.args) !== menuId) return undefined;

  const indent = getLineIndent(document, sourceLine);
  const rebuilt = `${indent}${buildMenuEntryLine(args)}`;
  return replaceCallLinePreserveSuffix(document, call, rebuilt);
}

export function applyMenuEntryDelete(
  document: vscode.TextDocument,
  menuId: string,
  sourceLine: number,
  kind: MenuEntryKind,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  if (sourceLine < 0 || sourceLine >= document.lineCount) return undefined;

  const text = document.getText();
  const calls = scanCalls(text, scanRange);

  const call = calls.find(
    c => c.range.line === sourceLine && c.name.toLowerCase() === kind.toLowerCase()
  );
  if (!call) return undefined;

  const create = findNearestCreateAbove(calls, sourceLine, "createmenu");
  if (!create || firstParamOfCall(create.args) !== menuId) return undefined;

  const edit = new vscode.WorkspaceEdit();
  edit.delete(document.uri, document.lineAt(sourceLine).rangeIncludingLineBreak);
  return edit;
}

export function applyToolBarEntryInsert(
  document: vscode.TextDocument,
  toolBarId: string,
  args: ToolBarEntryArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const text = document.getText();
  const calls = scanCalls(text, scanRange);

  const create = calls.find(
    c => c.name.toLowerCase() === "createtoolbar" && firstParamOfCall(c.args) === toolBarId
  );
  if (!create) return undefined;

  const startIdx = calls.indexOf(create);
  let endIdx = calls.length;
  for (let i = startIdx + 1; i < calls.length; i++) {
    if (isCreateBoundary(calls[i].name.toLowerCase())) {
      endIdx = i;
      break;
    }
  }

  const entryNames = new Set([
    "toolbarstandardbutton",
    "toolbarbutton",
    "toolbarseparator",
    "toolbartooltip"
  ]);
  let insertAfterLine = create.range.line;
  for (let i = startIdx + 1; i < endIdx; i++) {
    if (entryNames.has(calls[i].name.toLowerCase())) {
      insertAfterLine = calls[i].range.line;
    }
  }

  const indent = getLineIndent(document, insertAfterLine);
  const line = `${indent}${buildToolBarEntryLine(args)}\n`;
  const insertPos = new vscode.Position(Math.min(document.lineCount, insertAfterLine + 1), 0);

  const edit = new vscode.WorkspaceEdit();
  edit.insert(document.uri, insertPos, line);
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

  const text = document.getText();
  const calls = scanCalls(text, scanRange);

  const call = calls.find(
    c => c.range.line === sourceLine && c.name.toLowerCase() === args.kind.toLowerCase()
  );
  if (!call) return undefined;

  const create = findNearestCreateAbove(calls, sourceLine, "createtoolbar");
  if (!create || firstParamOfCall(create.args) !== toolBarId) return undefined;

  const indent = getLineIndent(document, sourceLine);
  const rebuilt = `${indent}${buildToolBarEntryLine(args)}`;
  return replaceCallLinePreserveSuffix(document, call, rebuilt);
}

export function applyToolBarEntryDelete(
  document: vscode.TextDocument,
  toolBarId: string,
  sourceLine: number,
  kind: ToolBarEntryKind,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  if (sourceLine < 0 || sourceLine >= document.lineCount) return undefined;

  const text = document.getText();
  const calls = scanCalls(text, scanRange);

  const call = calls.find(
    c => c.range.line === sourceLine && c.name.toLowerCase() === kind.toLowerCase()
  );
  if (!call) return undefined;

  const create = findNearestCreateAbove(calls, sourceLine, "createtoolbar");
  if (!create || firstParamOfCall(create.args) !== toolBarId) return undefined;

  const edit = new vscode.WorkspaceEdit();
  edit.delete(document.uri, document.lineAt(sourceLine).rangeIncludingLineBreak);
  return edit;
}

export function applyStatusBarFieldInsert(
  document: vscode.TextDocument,
  statusBarId: string,
  args: StatusBarFieldArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  const text = document.getText();
  const calls = scanCalls(text, scanRange);

  const create = calls.find(
    c => c.name.toLowerCase() === "createstatusbar" && firstParamOfCall(c.args) === statusBarId
  );
  if (!create) return undefined;

  const startIdx = calls.indexOf(create);
  let endIdx = calls.length;
  for (let i = startIdx + 1; i < calls.length; i++) {
    if (isCreateBoundary(calls[i].name.toLowerCase())) {
      endIdx = i;
      break;
    }
  }

  let insertAfterLine = create.range.line;
  for (let i = startIdx + 1; i < endIdx; i++) {
    if (calls[i].name.toLowerCase() === "addstatusbarfield") {
      insertAfterLine = calls[i].range.line;
    }
  }

  const indent = getLineIndent(document, insertAfterLine);
  const line = `${indent}AddStatusBarField(${args.widthRaw.trim()})\n`;
  const insertPos = new vscode.Position(Math.min(document.lineCount, insertAfterLine + 1), 0);

  const edit = new vscode.WorkspaceEdit();
  edit.insert(document.uri, insertPos, line);
  return edit;
}

export function applyStatusBarFieldUpdate(
  document: vscode.TextDocument,
  statusBarId: string,
  sourceLine: number,
  args: StatusBarFieldArgs,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  if (sourceLine < 0 || sourceLine >= document.lineCount) return undefined;

  const text = document.getText();
  const calls = scanCalls(text, scanRange);

  const call = calls.find(
    c => c.range.line === sourceLine && c.name.toLowerCase() === "addstatusbarfield"
  );
  if (!call) return undefined;

  const create = findNearestCreateAbove(calls, sourceLine, "createstatusbar");
  if (!create || firstParamOfCall(create.args) !== statusBarId) return undefined;

  const indent = getLineIndent(document, sourceLine);
  const rebuilt = `${indent}AddStatusBarField(${args.widthRaw.trim()})`;
  return replaceCallLinePreserveSuffix(document, call, rebuilt);
}

export function applyStatusBarFieldDelete(
  document: vscode.TextDocument,
  statusBarId: string,
  sourceLine: number,
  scanRange?: ScanRange
): vscode.WorkspaceEdit | undefined {
  if (sourceLine < 0 || sourceLine >= document.lineCount) return undefined;

  const text = document.getText();
  const calls = scanCalls(text, scanRange);

  const call = calls.find(
    c => c.range.line === sourceLine && c.name.toLowerCase() === "addstatusbarfield"
  );
  if (!call) return undefined;

  const create = findNearestCreateAbove(calls, sourceLine, "createstatusbar");
  if (!create || firstParamOfCall(create.args) !== statusBarId) return undefined;

  const edit = new vscode.WorkspaceEdit();
  edit.delete(document.uri, document.lineAt(sourceLine).rangeIncludingLineBreak);
  return edit;
}
