/**
 * Language Server capabilities configuration
 */

import {
    TextDocumentSyncKind,
    CompletionOptions,
    ServerCapabilities
} from 'vscode-languageserver/node';

/**
 * Server capabilities configuration
 */
export const serverCapabilities: ServerCapabilities = {
    textDocumentSync: TextDocumentSyncKind.Incremental,
    completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['.', '(', '#', ':', '\\']
    },
    definitionProvider: true,
    referencesProvider: true,
    documentHighlightProvider: true,
    documentSymbolProvider: true,
    workspaceSymbolProvider: true,
    hoverProvider: true,
    signatureHelpProvider: {
        triggerCharacters: ['(', ',']
    },
    renameProvider: {
        prepareProvider: true
    },
    documentFormattingProvider: true,
    documentRangeFormattingProvider: true
};
