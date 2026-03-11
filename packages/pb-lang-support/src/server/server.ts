/**
 * PureBasic Language Server
 * Language Server implementation with a modular architecture
 */

import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    CompletionItem,
    TextDocumentPositionParams,
    TextDocumentSyncKind,
    InitializeResult,
    DocumentSymbolParams,
    HoverParams,
    Hover,
    DefinitionParams,
    Location,
    ReferenceParams,
    PrepareRenameParams,
    RenameParams,
    WorkspaceEdit,
    DocumentFormattingParams,
    DocumentRangeFormattingParams,
    TextEdit
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';

// Import configuration
import { serverCapabilities } from './config/capabilities';
import { defaultSettings, globalSettings, PureBasicSettings, SETTINGS_SECTION } from './config/settings';

// Import validator
import { initValidator } from './validation/validator';
import { runDiagnostics } from './validation/diagnostics-runner';

// Import code completion provider
import { initCompletionProvider, handleCompletion, handleCompletionResolve } from './providers/completion-provider';

// Import definition and reference providers
import { handleDefinition } from './providers/definition-provider';
import { handleReferences } from './providers/reference-provider';

// Import signature help provider
import { handleSignatureHelp } from './providers/signature-provider';

// Import hover and document symbol providers
import { handleHover } from './providers/hover-provider';
import { handleDocumentSymbol } from './providers/document-symbol-provider';

// Import rename providers
import { handlePrepareRename, handleRename } from './providers/rename-provider';

// Import formatting providers
import { handleDocumentFormatting, handleDocumentRangeFormatting } from './providers/formatting-provider';

// Import symbol management
import { optimizedSymbolParser } from './symbols/optimized-symbol-parser';
import { setWorkspaceRoots, getWorkspaceRootForUri } from './indexer/workspace-index';
import { symbolCache } from './symbols/symbol-cache';
import { SymbolInformation, SymbolKind as LSPSymbolKind, WorkspaceSymbolParams } from 'vscode-languageserver/node';
import { SymbolKind as PBSymbolKind, PureBasicSymbol } from './symbols/types';

// Import utility functions
import { debounce } from './utils/debounce-utils';
import { generateHash } from './utils/hash-utils';

// Import Api function listing
import { ApiFunctionListing } from './utils/api-function-listing';

// Import error handling
import { initializeErrorHandler } from './utils/error-handler';

// Import project manager
import { ProjectManager } from './managers/project-manager';

// Import for Wire up LSP logging
import { initFileCache }        from './utils/file-cache';
import { initModuleResolver }   from './utils/module-resolver';

// Create connection
const connection = createConnection(ProposedFeatures.all);


function safeStringify(value: unknown): string {
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function safeErrorSummary(err: unknown): { type: string; name?: string; message: string; code?: string } {
    if (err instanceof Error) {
        return { type: 'Error', name: err.name, message: err.message };
    }

    if (err && typeof err === 'object') {
        const anyErr = err as { name?: unknown; message?: unknown; code?: unknown };
        const name = typeof anyErr.name === 'string' ? anyErr.name : undefined;
        const message = typeof anyErr.message === 'string' ? anyErr.message : safeStringify(err);
        const code = typeof anyErr.code === 'string' ? anyErr.code : undefined;
        return { type: 'object', name, message, code };
    }

    return { type: typeof err, message: String(err) };
}

function logLspError(message: string, err: unknown, meta: Record<string, unknown> = {}): void {
    const entry = {
        level: 'error',
        message,
        ...meta,
        error: safeErrorSummary(err),
    };
    connection.console.error(safeStringify(entry));
}

// Initialize error handler
const errorHandler = initializeErrorHandler(connection);

// Wire up LSP logging for modules without direct connection access
const lspErrorLog = (msg: string, err?: unknown) =>
    logLspError(msg, err ?? new Error('unknown'));

initFileCache(lspErrorLog);
initModuleResolver(lspErrorLog);
initValidator(lspErrorLog);
initCompletionProvider(lspErrorLog);

// Create document manager
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

// Document settings cache
const documentSettings: Map<string, Thenable<PureBasicSettings>> = new Map();
const documentHashes: Map<string, string> = new Map();

// Document cache for defining jumps and reference lookups
const documentCache: Map<string, TextDocument> = new Map();

// API Function Listing (loaded lazily when the path is known from settings)
const apiFunctionListing = new ApiFunctionListing();

// Project manager for handling .pbp project files
let projectManager: ProjectManager;

connection.onInitialize((params: InitializeParams) => {
    const capabilities = params.capabilities;

    // Check client capabilities
    hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
    );
    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );
    hasDiagnosticRelatedInformationCapability = !!(
        capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation
    );

    // Initialize the Project Manager
    projectManager = new ProjectManager(connection);

    // Bridge notifications from the VS Code extension host (pb-project-files)
    connection.onNotification('purebasic/projectContext', payload => {
        try {
            projectManager.setActiveContext(payload);
        } catch (err) {
            logLspError('Failed to apply projectContext payload', err, { notification: 'purebasic/projectContext' });
        }
    });

    connection.onNotification('purebasic/fileProject', payload => {
        try {
            projectManager.setFileProjectMapping(payload);
        } catch (err) {
            logLspError('Failed to apply fileProject payload', err, { notification: 'purebasic/fileProject' });
        }
    });

    const result: InitializeResult = {
        capabilities: serverCapabilities
    };

    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }

    return result;
});

connection.onInitialized(async () => {
    if (hasConfigurationCapability) {
        // Registration Configuration Change Notification
        connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(async _event => {
            try {
                const folders = await connection.workspace.getWorkspaceFolders();
                const uris = (folders || []).map(f => f.uri);
                setWorkspaceRoots(uris);
            } catch (error) {
                connection.console.error('Failed to update workspace folders');
                logLspError(`Failed to update workspace folders`, error); // secure internal log
            }
        });
        // Initialize workspace root
        connection.workspace.getWorkspaceFolders().then(folders => {
            const uris = (folders || []).map(f => f.uri);
            setWorkspaceRoots(uris);
        }).catch(error => {
            connection.console.error('Failed to update workspace folders');
            logLspError(`Failed to update workspace folders`, error); // secure internal log
        });
    }

    // Initial load of the API function listing (non-hot path).
    await loadGlobalSettings();
    apiFunctionListing.load(globalSettings.apiFunctionListingPath ?? '');
});

// Custom Request: Clear Symbol Cache (to be used with the client command `purebasic.clearSymbolCache`)
connection.onRequest('purebasic/clearSymbolCache', () => {
    try {
        symbolCache.clearAll();
        connection.console.log('PureBasic: symbol cache cleared by client request');
        return true;
    } catch (err) {
        logLspError('Failed to clear symbol cache', err, { request: 'purebasic/clearSymbolCache' });
        return false;
    }
});

// Configuration Change Management
connection.onDidChangeConfiguration(change => {
    if (hasConfigurationCapability) {
        // Clear cached document settings
        documentSettings.clear();
        // Fetch fresh from client
        loadGlobalSettings()
            // Reload the API listing whenever configuration changes (non-hot path).
            .then(() => apiFunctionListing.load(globalSettings.apiFunctionListingPath ?? ''))
            .catch(err => logLspError('Failed to load global settings', err));
    } else {
        // Fallback: settings pushed via change.settings
        const s = change.settings.purebasic ?? defaultSettings;
        globalSettings.maxNumberOfProblems    = s.maxNumberOfProblems    ?? defaultSettings.maxNumberOfProblems;
        globalSettings.enableValidation       = s.enableValidation       ?? defaultSettings.enableValidation;
        globalSettings.enableCompletion       = s.enableCompletion       ?? defaultSettings.enableCompletion;
        globalSettings.validationDelay        = s.validationDelay        ?? defaultSettings.validationDelay;
        globalSettings.formatting             = s.formatting             ?? defaultSettings.formatting;
        globalSettings.completion             = s.completion             ?? defaultSettings.completion;
        globalSettings.linting                = s.linting                ?? defaultSettings.linting;
        globalSettings.symbols                = s.symbols                ?? defaultSettings.symbols;
        globalSettings.apiFunctionListingPath = s.apiFunctionListingPath ?? defaultSettings.apiFunctionListingPath;
        apiFunctionListing.load(globalSettings.apiFunctionListingPath ?? '');
    }
    // Re-validate all open documents
    documents.all().forEach(safeValidateTextDocument);
});

async function loadGlobalSettings(): Promise<void> {
    try {
        const config = await connection.workspace.getConfiguration('purebasic');
        globalSettings.maxNumberOfProblems  = config?.maxNumberOfProblems  ?? defaultSettings.maxNumberOfProblems;
        globalSettings.enableValidation     = config?.enableValidation     ?? defaultSettings.enableValidation;
        globalSettings.enableCompletion     = config?.enableCompletion     ?? defaultSettings.enableCompletion;
        globalSettings.validationDelay      = config?.validationDelay      ?? defaultSettings.validationDelay;
        globalSettings.formatting           = config?.formatting           ?? defaultSettings.formatting;
        globalSettings.completion           = config?.completion           ?? defaultSettings.completion;
        globalSettings.linting              = config?.linting              ?? defaultSettings.linting;
        globalSettings.symbols              = config?.symbols              ?? defaultSettings.symbols;
        globalSettings.apiFunctionListingPath = config?.apiFunctionListingPath ?? defaultSettings.apiFunctionListingPath;
    } catch (err) {
        logLspError('Failed to load global settings', err);
    }
}

function getDocumentSettings(resource: string): Thenable<PureBasicSettings> {
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }

    let result = documentSettings.get(resource);
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: resource,
            section: SETTINGS_SECTION
        }).then(config => {
            // Ensure a complete settings object is returned, filling missing properties with defaults
            return {
                maxNumberOfProblems: config?.maxNumberOfProblems ?? defaultSettings.maxNumberOfProblems,
                enableValidation: config?.enableValidation ?? defaultSettings.enableValidation,
                enableCompletion: config?.enableCompletion ?? defaultSettings.enableCompletion,
                validationDelay: config?.validationDelay ?? defaultSettings.validationDelay,
                formatting: config?.formatting ?? defaultSettings.formatting,
                completion: config?.completion ?? defaultSettings.completion,
                linting: config?.linting ?? defaultSettings.linting,
                symbols: config?.symbols ?? defaultSettings.symbols,
                apiFunctionListingPath: config?.apiFunctionListingPath ?? defaultSettings.apiFunctionListingPath
            };
        });
        documentSettings.set(resource, result);
    }
    return result;
}

// Document change handling
documents.onDidClose(e => {
    documentSettings.delete(e.document.uri);
    documentHashes.delete(e.document.uri);
    documentCache.delete(e.document.uri);
    optimizedSymbolParser.invalidate(e.document.uri);
    // Notify project manager
    projectManager.onDocumentClose(e.document);
});

documents.onDidOpen(e => {
    documentCache.set(e.document.uri, e.document);
    // Notify project manager
    projectManager.onDocumentOpen(e.document);
});

documents.onDidChangeContent(change => {
    documentCache.set(change.document.uri, change.document);
    // Notify project manager
    projectManager.onDocumentChange(change.document);
    debouncedValidateTextDocument(change.document);
});

// Debounced validation function
const debouncedValidateTextDocument = debounce((textDocument: TextDocument) => {
    safeValidateTextDocument(textDocument);
}, 500);

const safeValidateTextDocument = (textDocument: TextDocument): Promise<void> => {
    return errorHandler.handleAsync('text-document-validation', async () => {
    const settings = await getDocumentSettings(textDocument.uri);

    if (!settings || !settings.enableValidation) {
        return;
    }

    const text = textDocument.getText();
    const newHash = generateHash(text);
    const oldHash = documentHashes.get(textDocument.uri);

    // Skip validation if content hasn't changed
    if (oldHash === newHash) {
        return;
    }

    documentHashes.set(textDocument.uri, newHash);

    // Parse symbols
    await optimizedSymbolParser.parseDocumentSymbols(textDocument.uri, text);

    // Run all validators and send results
    const workspaceRoot = getWorkspaceRootForUri(textDocument.uri);
    const diagnostics = runDiagnostics(textDocument, settings, workspaceRoot);
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
    });
};

// Completion handling
connection.onCompletion(async (params: TextDocumentPositionParams): Promise<CompletionItem[] | null> => {
    return errorHandler.handleAsync('completion-handler', async () => {
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            return null;
        }

        const settings = await getDocumentSettings(params.textDocument.uri);
        if (!settings.enableCompletion) {
            return null;
        }

        const completionResult = handleCompletion(params, document, documentCache, apiFunctionListing);
        return completionResult.items;
    }, { fallbackValue: null });
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    return handleCompletionResolve(item);
});

// Document symbol handling
connection.onDocumentSymbol((params: DocumentSymbolParams) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return [];
    }

    try {
        return handleDocumentSymbol(params, document);
    } catch (error) {
        logLspError('Document symbol error', error, { uri: params.textDocument.uri });
        return [];
    }
});

connection.onHover((params: HoverParams): Thenable<Hover | null> => {
    return errorHandler.handleAsync<Hover | null>(
        'Hover',
        async () => {
            const document = documents.get(params.textDocument.uri);
            if (!document) {
                return null;
            }

            return handleHover(params, document, documentCache, apiFunctionListing);
        },
        { fallbackValue: null }
    );
});

// Definition handling
connection.onDefinition((params: DefinitionParams): Location[] => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return [];
    }

    try {
        return handleDefinition(params, document, documentCache, projectManager);
    } catch (error) {
        logLspError('Definition error', error, { uri: params.textDocument.uri });
        return [];
    }
});

// References handling
connection.onReferences((params: ReferenceParams): Location[] => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return [];
    }

    try {
        return handleReferences(params, document, documentCache, projectManager);
    } catch (error) {
        logLspError('References error', error, { uri: params.textDocument.uri });
        return [];
    }
});

// Document highlight handling
connection.onDocumentHighlight((params: TextDocumentPositionParams) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return [];
    }

    // Return empty array as a basic implementation to avoid errors
    return [];
});

// Workspace symbol handling (fast search based on symbol cache)
connection.onWorkspaceSymbol((params: WorkspaceSymbolParams): SymbolInformation[] => {
    const query = (params.query || '').trim();
    if (!query) return [];
    const results = symbolCache.findSymbolDetailed(query);
    // Remove duplicates and limit the count
    const max = 200;
    const out: SymbolInformation[] = [];
    for (const { uri, symbol: sym } of results) {
        out.push({
            name: sym.name,
            kind: mapSymbolKind(sym.kind),
            location: { uri, range: sym.range }
        });
        if (out.length >= max) break;
    }
    return out;
});

function mapSymbolKind(kind: PBSymbolKind): LSPSymbolKind {
    switch (kind) {
        case PBSymbolKind.Procedure: return LSPSymbolKind.Function;
        case PBSymbolKind.Variable: return LSPSymbolKind.Variable;
        case PBSymbolKind.Constant: return LSPSymbolKind.Constant;
        case PBSymbolKind.Structure: return LSPSymbolKind.Struct;
        case PBSymbolKind.Module: return LSPSymbolKind.Module;
        case PBSymbolKind.Interface: return LSPSymbolKind.Interface;
        case PBSymbolKind.Enumeration: return LSPSymbolKind.Enum;
        default: return LSPSymbolKind.Object;
    }
}

// findUriForSymbol is no longer needed; use the URI provided by symbolCache.findSymbolDetailed

// Signature help handling
connection.onSignatureHelp(async (params: TextDocumentPositionParams) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return null;
    }

    try {
        const settings = await getDocumentSettings(params.textDocument.uri);
        return handleSignatureHelp(params, document, documentCache, apiFunctionListing);

    } catch (error) {
        logLspError('Signature help error', error, { uri: params.textDocument.uri });
        return null;
    }
});

// Prepare rename handling
connection.onPrepareRename((params: PrepareRenameParams) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return null;
    }

    try {
        return handlePrepareRename(params, document, documentCache);
    } catch (error) {
        logLspError('Prepare rename error', error, { uri: params.textDocument.uri });
        return null;
    }
});

// Rename handling
connection.onRenameRequest((params: RenameParams): WorkspaceEdit | null => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return null;
    }

    try {
        return handleRename(params, document, documentCache);
    } catch (error) {
        logLspError('Rename error', error, { uri: params.textDocument.uri });
        return null;
    }
});

// Document formatting handling
connection.onDocumentFormatting((params: DocumentFormattingParams): TextEdit[] => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return [];
    }

    try {
        return handleDocumentFormatting(params, document);
    } catch (error) {
        logLspError('Document formatting error', error, { uri: params.textDocument.uri });
        return [];
    }
});

// Range formatting handling
connection.onDocumentRangeFormatting((params: DocumentRangeFormattingParams): TextEdit[] => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return [];
    }

    try {
        return handleDocumentRangeFormatting(params, document);
    } catch (error) {
        logLspError('Range formatting error', error, { uri: params.textDocument.uri });
        return [];
    }
});

// Diagnostic-related handling is integrated in the validateTextDocument function

// Start documents listening on the connection
documents.listen(connection);

// Listen on the connection
connection.listen();