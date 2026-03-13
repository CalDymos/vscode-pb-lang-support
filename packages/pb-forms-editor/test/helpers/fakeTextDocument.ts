import type { Position, Range, TextLine } from "vscode";
import { Position as VscodePosition, Range as VscodeRange } from "vscode";

// NOTE: FakeTextDocument intentionally does NOT implement vscode.TextDocument.
// The VSCode Language Server always resolves @types/vscode regardless of
// tsconfig.test.json "types": [] — so implementing the interface would require
// all 12+ vscode.TextDocument members to satisfy the real type checker.
// Instead we expose only the subset needed by patchEmitter and test helpers,
// and provide asTextDocument() as a single controlled escape hatch.
// Do NOT add "implements TextDocument" here.
export class FakeTextDocument {
  public readonly uri: string;
  private text: string;

  constructor(text: string, uri = "file:///fixture.pbf") {
    this.text = text;
    this.uri = uri;
  }

  public get lineCount(): number {
    return this.getLines().length;
  }

  public getText(): string {
    return this.text;
  }

  public lineAt(line: number): TextLine {
    const lines = this.getLines();
    if (line < 0 || line >= lines.length) {
      throw new RangeError(`Line out of range: ${line}`);
    }

    const lineStarts = this.getLineStarts();
    const startOffset = lineStarts[line];
    const text = lines[line];
    const endOffset = startOffset + text.length;
    const hasLineBreak = line < lines.length - 1 || this.text.endsWith("\n");
    const endWithBreak = hasLineBreak ? endOffset + 1 : endOffset;

    // NOTE: "as TextLine" cast is intentional — we only implement the fields
    // actually used by patchEmitter and test helpers. The real vscode.TextLine
    // has additional members we don't need. Do NOT remove the cast.
    return {
      lineNumber: line,
      text,
      firstNonWhitespaceCharacterIndex: text.search(/\S/),
      isEmptyOrWhitespace: text.trim().length === 0,
      range: new VscodeRange(this.positionAt(startOffset), this.positionAt(endOffset)),
      rangeIncludingLineBreak: new VscodeRange(this.positionAt(startOffset), this.positionAt(endWithBreak)),
    } as TextLine;
  }

  public positionAt(offset: number): Position {
    const safeOffset = Math.max(0, Math.min(offset, this.text.length));
    const starts = this.getLineStarts();

    let line = 0;
    for (let i = 0; i < starts.length; i++) {
      if (starts[i] > safeOffset) break;
      line = i;
    }

    return new VscodePosition(line, safeOffset - starts[line]);
  }

  public offsetAt(position: Position): number {
    const starts = this.getLineStarts();

    // NOTE: EOF insert fix — patch emitters can legitimately produce insert
    // positions at (line == lineCount, character == 0) to append after the
    // last line. The previous implementation clamped line to (starts.length - 1)
    // which mapped EOF inserts to an offset inside the last line instead of
    // text.length. Do NOT revert to Math.min(position.line, starts.length - 1).
    if (position.line >= starts.length) {
      return this.text.length;
    }

    const line = Math.max(0, position.line);
    const lineStart = starts[line];

    // NOTE: character is clamped to the line's own length, not text.length.
    // Clamping against text.length could silently position into the next line.
    const lines = this.getLines();
    const lineLength = lines[line]?.length ?? 0;
    const character = Math.min(position.character, lineLength);

    return lineStart + character;
  }

  private getLines(): string[] {
    return this.text.split("\n");
  }

  private getLineStarts(): number[] {
    const lines = this.getLines();
    const starts: number[] = [];
    let offset = 0;

    for (let i = 0; i < lines.length; i++) {
      starts.push(offset);
      offset += lines[i].length;
      if (i < lines.length - 1 || this.text.endsWith("\n")) {
        offset += 1;
      }
    }

    if (starts.length === 0) {
      starts.push(0);
    }

    return starts;
  }

  // NOTE: This is the single controlled cast point from FakeTextDocument to
  // vscode.TextDocument. All test helpers and patch calls must go through here
  // instead of casting at each call site. Do NOT inline "as unknown as TextDocument"
  // elsewhere — keep the cast in one place so it is easy to audit.
  public asTextDocument(): import("vscode").TextDocument {
    return this as unknown as import("vscode").TextDocument;
  }
}

export function rangeOffsets(document: FakeTextDocument, range: Range): { start: number; end: number } {
  return {
    start: document.offsetAt(range.start),
    end: document.offsetAt(range.end),
  };
}