import * as vscode from 'vscode';
import { PBF_BUILTINS } from './builtins';

export class PbfCompletionProvider implements vscode.CompletionItemProvider {

  private readonly items: vscode.CompletionItem[] = PBF_BUILTINS.map(b => {
    const item = new vscode.CompletionItem(b.label, vscode.CompletionItemKind.Function);
    item.insertText = new vscode.SnippetString(b.snippet);
    item.documentation = new vscode.MarkdownString(
      `\`\`\`\n${b.signature}\n\`\`\`\n\n${b.description}`
    );
    return item;
  });

  provideCompletionItems(): vscode.CompletionItem[] {
    return this.items;
  }
}