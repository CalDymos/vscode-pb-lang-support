import * as vscode from "vscode";
import { PureBasicFormDesignerProvider } from "./formsDesignerProvider";

const CMD_OPEN_AS_TEXT = "purebasic.formDesigner.openAsText";
const CMD_OPEN_IN_DESIGNER = "purebasic.formDesigner.openInDesigner";

function getTextTabsForUri(uri: vscode.Uri): vscode.Tab[] {
  const target = uri.toString();

  return vscode.window.tabGroups.all
    .flatMap(group => group.tabs)
    .filter((tab): tab is vscode.Tab => tab.input instanceof vscode.TabInputText && tab.input.uri.toString() === target);
}

function getDesignerTabsForUri(uri: vscode.Uri): vscode.Tab[] {
  const target = uri.toString();

  return vscode.window.tabGroups.all
    .flatMap(group => group.tabs)
    .filter((tab): tab is vscode.Tab => {
      return tab.input instanceof vscode.TabInputCustom
        && tab.input.uri.toString() === target
        && tab.input.viewType === PureBasicFormDesignerProvider.viewType;
    });
}

async function closeTabs(tabs: readonly vscode.Tab[]): Promise<void> {
  if (!tabs.length) {
    return;
  }

  await vscode.window.tabGroups.close(tabs);
}

async function resolvePbfLanguageId(): Promise<string | undefined> {
  const languages = new Set(await vscode.languages.getLanguages());

  if (languages.has("purebasic-form")) {
    return "purebasic-form";   
  }

  return undefined;
}

async function applyPbfTextLanguage(doc: vscode.TextDocument): Promise<vscode.TextDocument> {
  const languageId = await resolvePbfLanguageId();
  if (!languageId || doc.languageId === languageId) {
    return doc;
  }

  return vscode.languages.setTextDocumentLanguage(doc, languageId);
}

export function activate(context: vscode.ExtensionContext) {
  const provider = new PureBasicFormDesignerProvider(context);

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      PureBasicFormDesignerProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(CMD_OPEN_AS_TEXT, async (uri?: vscode.Uri) => {
      const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (!targetUri) {
        return;
      }

      const viewColumn = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.Active;

      try {
        await vscode.commands.executeCommand("workbench.action.reopenTextEditor", targetUri);
      } catch {
        // Keep explicit text open fallback below.
      }

      let doc = await vscode.workspace.openTextDocument(targetUri);
      doc = await applyPbfTextLanguage(doc);
      await vscode.window.showTextDocument(doc, { viewColumn, preview: false });
      await closeTabs(getDesignerTabsForUri(targetUri));
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(CMD_OPEN_IN_DESIGNER, async (uri?: vscode.Uri) => {
      const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (!targetUri) {
        return;
      }

      const viewColumn = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.Active;
      await vscode.commands.executeCommand(
        "vscode.openWith",
        targetUri,
        PureBasicFormDesignerProvider.viewType,
        viewColumn
      );

      await closeTabs(getTextTabsForUri(targetUri));
    })
  );
}

export function deactivate() {}
