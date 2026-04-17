import * as vscode from 'vscode';
import { PBF_BUILTINS_MAP } from './builtins';

export class PbfSignatureHelpProvider implements vscode.SignatureHelpProvider {

  provideSignatureHelp(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.SignatureHelp | undefined {

    // text from line start to cursor
    const linePrefix = document.getText(
      new vscode.Range(position.with(undefined, 0), position)
    );

    // find function name and opening parenthesis
    const match = linePrefix.match(/(\w+)\((?:[^)(]*|\([^)]*\))*$/);
    if (!match) return undefined;

    const builtin = PBF_BUILTINS_MAP.get(match[1]);
    if (!builtin) return undefined;

    // find active parameter based on commas
    const argsText = linePrefix.slice(linePrefix.lastIndexOf('(') + 1);
    const activeParameter = argsText.split(',').length - 1;

    const sig = new vscode.SignatureInformation(
      builtin.signature,
      new vscode.MarkdownString(builtin.description)
    );
    sig.parameters = builtin.parameters.map(p => new vscode.ParameterInformation(p));

    const help = new vscode.SignatureHelp();
    help.signatures = [sig];
    help.activeSignature = 0;
    help.activeParameter = Math.min(activeParameter, sig.parameters.length - 1);

    return help;
  }
}