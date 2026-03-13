import type { Position, Range, TextLine } from "vscode";
import { Position as VscodePosition, Range as VscodeRange } from "vscode";

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

    // EOF insert: line >= lineCount → return text.length
    if (position.line >= starts.length) {
      return this.text.length;
    }

    const line = Math.max(0, position.line);
    const lineStart = starts[line];

    // clamp character to the line's own length, not text.length
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