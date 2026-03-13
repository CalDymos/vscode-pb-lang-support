import type { WorkspaceEdit } from "vscode";
import { Position as VscodePosition, Range as VscodeRange } from "vscode";
import { FakeTextDocument, rangeOffsets } from "./fakeTextDocument";

interface ShimEditOperation {
  kind: "replace" | "insert" | "delete";
  newText?: string;
  position?: { line: number; character: number };
  range?: { start: { line: number; character: number }; end: { line: number; character: number } };
}

export function applyWorkspaceEditToText(originalText: string, edit: WorkspaceEdit): string {
  const document = new FakeTextDocument(originalText);
  const operations = (edit as unknown as { getOperations(): ShimEditOperation[] }).getOperations();

  const normalized = operations.map(op => {
    if (op.kind === "insert") {
      // NOTE: op.position from the vscode shim is a plain object { line, character }.
      // FakeTextDocument.offsetAt() requires a real VscodePosition instance — plain
      // objects are not accepted by the type checker. Do NOT pass op.position directly.
      const pos = document.offsetAt(new VscodePosition(op.position!.line, op.position!.character));
      return { kind: op.kind, start: pos, end: pos, text: op.newText ?? "" };
    }

    // NOTE: Same issue for ranges — both start and end must be real VscodePosition
    // instances, not the plain objects produced by the shim. Wrapping here keeps
    // rangeOffsets() type-safe without changing its signature.
    const shimRange = op.range!;
    const vsRange = new VscodeRange(
      new VscodePosition(shimRange.start.line, shimRange.start.character),
      new VscodePosition(shimRange.end.line, shimRange.end.character)
    );
    const { start, end } = rangeOffsets(document, vsRange);
    return {
      kind: op.kind,
      start,
      end,
      text: op.kind === "replace" ? (op.newText ?? "") : "",
    };
  });

  normalized.sort((a, b) => b.start - a.start || b.end - a.end);

  let text = originalText;
  for (const op of normalized) {
    text = text.slice(0, op.start) + op.text + text.slice(op.end);
  }

  return text;
}