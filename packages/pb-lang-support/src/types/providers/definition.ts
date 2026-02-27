/**
 * Definition provider related type definitions
 */

import { TextDocument, Position, Range, Definition, Location } from 'vscode-languageserver';
import { CancellationToken } from '../utils/generics';
import { Result, AsyncResult } from '../utils/generics';
import { PureBasicSymbol } from '../core/symbol';

/** Definition context */
export interface DefinitionContext {
    /** Document position */
    position: Position;
    /** Document */
    document: TextDocument;
    /** Word */
    word: string;
    /** Line text */
    lineText: string;
    /** Prefix text */
    prefix: string;
    /** Suffix text */
    suffix: string;
    /** Range */
    range: Range;
    /** Whether in string */
    inString: boolean;
    /** Whether in comment */
    inComment: boolean;
    /** Scope */
    scope?: DefinitionScope;
}

/** Definition scope */
export interface DefinitionScope {
    /** Current module */
    module?: string;
    /** Current procedure */
    procedure?: string;
    /** Visible symbols */
    visibleSymbols: PureBasicSymbol[];
    /** Imported symbols */
    importedSymbols: PureBasicSymbol[];
    /** Global symbols */
    globalSymbols: PureBasicSymbol[];
}

/** Extended location definition */
export interface ExtendedLocation extends Location {
    /** Symbol information */
    symbol?: PureBasicSymbol;
    /** Confidence */
    confidence?: number;
    /** Source */
    source?: DefinitionSource;
    /** Related locations */
    relatedLocations?: ExtendedLocation[];
    /** Documentation */
    documentation?: string;
}

/** Definition source */
export enum DefinitionSource {
    /** Local definition */
    Local = 'local',
    /** Global definition */
    Global = 'global',
    /** System definition */
    System = 'system',
    /** Library definition */
    Library = 'library',
    /** External definition */
    External = 'external',
    /** Inferred definition */
    Inferred = 'inferred',
    /** Cached definition */
    Cached = 'cached'
}

/** Definition provider */
export interface DefinitionProvider {
    /** Provider name */
    name: string;
    /** Provide definition */
    provideDefinition(
        document: TextDocument,
        position: Position,
        context: DefinitionContext,
        token: CancellationToken
    ): AsyncResult<ExtendedLocation[], Error>;
    /** Provide type definition */
    provideTypeDefinition?(
        document: TextDocument,
        position: Position,
        context: DefinitionContext,
        token: CancellationToken
    ): AsyncResult<ExtendedLocation[], Error>;
    /** Provide implementation definition */
    provideImplementation?(
        document: TextDocument,
        position: Position,
        context: DefinitionContext,
        token: CancellationToken
    ): AsyncResult<ExtendedLocation[], Error>;
    /** Whether supports given document */
    supports(document: TextDocument): boolean;
    /** Get priority */
    getPriority?(context: DefinitionContext): number;
    /** Reset state */
    reset?(): void;
}

/** Definition resolver */
export interface DefinitionResolver {
    /** Resolver name */
    name: string;
    /** Resolution type */
    type: DefinitionType;
    /** Resolve definition */
    resolve(
        document: TextDocument,
        position: Position,
        context: DefinitionContext,
        token: CancellationToken
    ): AsyncResult<ExtendedLocation[], Error>;
    /** Whether supports given position */
    supports(context: DefinitionContext): boolean;
    /** Get priority */
    getPriority(): number;
}

/** Definition type */
export enum DefinitionType {
    /** Variable */
    Variable = 'variable',
    /** Function */
    Function = 'function',
    /** Procedure */
    Procedure = 'procedure',
    /** Structure */
    Structure = 'structure',
    /** Interface */
    Interface = 'interface',
    /** Class */
    Class = 'class',
    /** Module */
    Module = 'module',
    /** Constant */
    Constant = 'constant',
    /** Type */
    Type = 'type',
    /** Enum */
    Enum = 'enum',
    /** Keyword */
    Keyword = 'keyword',
    /** System API */
    SystemAPI = 'system-api',
    /** Library function */
    LibraryFunction = 'library-function'
}

/** Definition config */
export interface DefinitionConfig {
    /** Whether enabled */
    enabled: boolean;
    /** Maximum results */
    maxResults: number;
    /** Enable cache */
    enableCache: boolean;
    /** Cache size */
    cacheSize: number;
    /** Cache TTL (milliseconds) */
    cacheTTL: number;
    /** Enable parallel resolution */
    enableParallel: boolean;
    /** Maximum parallel */
    maxParallel: number;
    /** Timeout (milliseconds) */
    timeout: number;
    /** Provider configuration */
    providers: DefinitionProviderConfig[];
}

/** Definition provider config */
export interface DefinitionProviderConfig {
    /** Provider name */
    name: string;
    /** Whether enabled */
    enabled: boolean;
    /** Priority */
    priority: number;
    /** Languages */
    languages?: string[];
    /** File patterns */
    filePatterns?: string[];
    /** Scopes */
    scopes?: string[];
    /** Configuration options */
    options?: Record<string, unknown>;
}

/** Definition statistics */
export interface DefinitionStats {
    /** Total requests */
    totalRequests: number;
    /** Successful requests */
    successfulRequests: number;
    /** Failed requests */
    failedRequests: number;
    /** Average response time */
    averageResponseTime: number;
    /** Average results per request */
    averageResultsPerRequest: number;
    /** Cache hit rate */
    cacheHitRate: number;
    /** By provider statistics */
    byProvider: Record<string, DefinitionProviderStats>;
    /** By type statistics */
    byType: Record<string, number>;
}

/** Definition provider statistics */
export interface DefinitionProviderStats {
    /** Provider name */
    name: string;
    /** Requests */
    requests: number;
    /** Successful */
    successful: number;
    /** Failed */
    failed: number;
    /** Average time */
    averageTime: number;
    /** Average results */
    averageResults: number;
    /** Cache hit rate */
    cacheHitRate: number;
}

/** Definition cache item */
export interface DefinitionCacheItem {
    /** Key */
    key: string;
    /** Locations */
    locations: ExtendedLocation[];
    /** Context */
    context: DefinitionContext;
    /** Expires at */
    expiresAt: number;
    /** Created at */
    createdAt: number;
    /** Use count */
    useCount: number;
    /** Last used */
    lastUsed: number;
}