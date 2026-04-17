import * as vscode from 'vscode';
import { PBF_BUILTINS_MAP } from './builtins';

export class PbfHoverProvider implements vscode.HoverProvider {

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.Hover | undefined {
    const range = document.getWordRangeAtPosition(position);
    if (!range) return undefined;

    const word = document.getText(range);
    const builtin = PBF_BUILTINS_MAP.get(word);
    if (!builtin) return undefined;

    const content = new vscode.MarkdownString();
    content.appendCodeblock(builtin.signature, 'purebasic');
    content.appendMarkdown(`\n${builtin.description}`);

    return new vscode.Hover(content, range);
  }
}