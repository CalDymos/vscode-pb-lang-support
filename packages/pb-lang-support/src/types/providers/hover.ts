/**
 * Hover provider related type definitions
 */

import { TextDocument, Position, Range, Hover, MarkedString } from 'vscode-languageserver';
import { CancellationToken } from '../utils/generics';
import { Result, AsyncResult } from '../utils/generics';
import { PureBasicSymbol } from '../core/symbol';

/** Hover context */
export interface HoverContext {
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
    /** Whether inside a string */
    inString: boolean;
    /** Whether inside a comment */
    inComment: boolean;
    /** Scope */
    scope?: HoverScope;
}

/** Hover scope */
export interface HoverScope {
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

/** Extended hover information */
export interface ExtendedHover extends Hover {
    /** Symbol information */
    symbol?: PureBasicSymbol;
    /** Source */
    source?: HoverSource;
    /** Confidence */
    confidence?: number;
    /** Related symbols */
    relatedSymbols?: PureBasicSymbol[];
    /** Examples */
    examples?: HoverExample[];
    /** Links */
    links?: HoverLink[];
    /** Actions */
    actions?: HoverAction[];
}

/** Hover source */
export enum HoverSource {
    /** Local symbol */
    LocalSymbol = 'local-symbol',
    /** Global symbol */
    GlobalSymbol = 'global-symbol',
    /** System API */
    SystemAPI = 'system-api',
    /** Library function */
    LibraryFunction = 'library-function',
    /** Keyword */
    Keyword = 'keyword',
    /** Constant */
    Constant = 'constant',
    /** Type */
    Type = 'type',
    /** Comment */
    Comment = 'comment',
    /** String */
    String = 'string',
    /** Error */
    Error = 'error',
    /** Warning */
    Warning = 'warning',
    /** Cached */
    Cached = 'cached'
}

/** Hover example */
export interface HoverExample {
    /** Description */
    description: string;
    /** Code */
    code: string;
    /** Language */
    language?: string;
    /** Output */
    output?: string;
    /** Notes */
    notes?: string[];
}

/** Hover link */
export interface HoverLink {
    /** Title */
    title: string;
    /** URL */
    url: string;
    /** Description */
    description?: string;
    /** Icon */
    icon?: string;
}

/** Hover action */
export interface HoverAction {
    /** Title */
    title: string;
    /** Command */
    command: string;
    /** Arguments */
    arguments?: any[];
    /** Icon */
    icon?: string;
    /** When */
    when?: string;
}

/** Hover content */
export interface HoverContent {
    /** Main content */
    main: HoverContentPart[];
    /** Details */
    details?: HoverContentPart[];
    /** Metadata */
    metadata?: HoverMetadata;
}

/** Hover content part */
export interface HoverContentPart {
    /** Content type */
    type: 'text' | 'code' | 'table' | 'list' | 'image' | 'link';
    /** Content */
    content: string | TableContent | ListContent | ImageContent | LinkContent;
    /** Style */
    style?: HoverContentStyle;
    /** Language */
    language?: string;
}

/** Table content */
export interface TableContent {
    /** Headers */
    headers: string[];
    /** Rows */
    rows: string[][];
    /** Style */
    style?: TableStyle;
}

/** Table style */
export interface TableStyle {
    /** Border */
    border?: boolean;
    /** Alignment */
    alignment?: 'left' | 'center' | 'right';
    /** Color */
    color?: string;
    /** Background color */
    backgroundColor?: string;
}

/** List content */
export interface ListContent {
    /** Items */
    items: string[];
    /** Type */
    type: 'ordered' | 'unordered' | 'task';
    /** Style */
    style?: ListStyle;
}

/** List style */
export interface ListStyle {
    /** Marker */
    marker?: string;
    /** Color */
    color?: string;
    /** Indentation */
    indent?: number;
}

/** Image content */
export interface ImageContent {
    /** URL */
    url: string;
    /** Alternative text */
    altText: string;
    /** Width */
    width?: number;
    /** Height */
    height?: number;
    /** Title */
    title?: string;
}

/** Link content */
export interface LinkContent {
    /** Text */
    text: string;
    /** URL */
    url: string;
    /** Title */
    title?: string;
    /** Target */
    target?: '_blank' | '_self' | '_parent' | '_top';
}

/** Hover content style */
export interface HoverContentStyle {
    /** Bold */
    bold?: boolean;
    /** Italic */
    italic?: boolean;
    /** Underline */
    underline?: boolean;
    /** Code style */
    code?: boolean;
    /** Color */
    color?: string;
    /** Background color */
    backgroundColor?: string;
    /** Font size */
    fontSize?: number;
    /** Font family */
    fontFamily?: string;
    /** Alignment */
    alignment?: 'left' | 'center' | 'right';
}

/** Hover metadata */
export interface HoverMetadata {
    /** Source */
    source: HoverSource;
    /** Created at */
    createdAt: number;
    /** Expiration time */
    expiresAt?: number;
    /** Version */
    version?: string;
    /** Tags */
    tags: string[];
    /** Confidence */
    confidence: number;
    /** Symbol information */
    symbol?: PureBasicSymbol;
}

/** Hover provider */
export interface HoverProvider {
    /** Provider name */
    name: string;
    /** Provide hover information */
    provideHover(
        document: TextDocument,
        position: Position,
        context: HoverContext,
        token: CancellationToken
    ): AsyncResult<ExtendedHover, Error>;
    /** Whether the given document is supported */
    supports(document: TextDocument): boolean;
    /** Get priority */
    getPriority?(context: HoverContext): number;
    /** Reset state */
    reset?(): void;
}

/** Hover resolver */
export interface HoverResolver {
    /** Resolver name */
    name: string;
    /** Resolver type */
    type: HoverType;
    /** Resolve hover information */
    resolve(
        document: TextDocument,
        position: Position,
        context: HoverContext,
        token: CancellationToken
    ): AsyncResult<ExtendedHover, Error>;
    /** Whether the given position is supported */
    supports(context: HoverContext): boolean;
    /** Get priority */
    getPriority(): number;
}

/** Hover type */
export enum HoverType {
    /** Symbol hover */
    Symbol = 'symbol',
    /** Keyword hover */
    Keyword = 'keyword',
    /** Constant hover */
    Constant = 'constant',
    /** Type hover */
    Type = 'type',
    /** Function hover */
    Function = 'function',
    /** Variable hover */
    Variable = 'variable',
    /** Parameter hover */
    Parameter = 'parameter',
    /** Structure hover */
    Structure = 'structure',
    /** Enum hover */
    Enum = 'enum',
    /** Comment hover */
    Comment = 'comment',
    /** String hover */
    String = 'string',
    /** Error hover */
    Error = 'error',
    /** Warning hover */
    Warning = 'warning',
    /** Custom hover */
    Custom = 'custom'
}

/** Hover configuration */
export interface HoverConfig {
    /** Whether enabled */
    enabled: boolean;
    /** Enable cache */
    enableCache: boolean;
    /** Cache size */
    cacheSize: number;
    /** Cache expiration time (milliseconds) */
    cacheTTL: number;
    /** Enable parallel resolution */
    enableParallel: boolean;
    /** Maximum parallel count */
    maxParallel: number;
    /** Timeout (milliseconds) */
    timeout: number;
    /** Content format */
    contentFormat: 'plaintext' | 'markdown';
    /** Maximum content length */
    maxContentLength: number;
    /** Provider configuration */
    providers: HoverProviderConfig[];
}

/** Hover provider configuration */
export interface HoverProviderConfig {
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

/** Hover statistics */
export interface HoverStats {
    /** Total requests */
    totalRequests: number;
    /** Successful requests */
    successfulRequests: number;
    /** Failed requests */
    failedRequests: number;
    /** Average response time */
    averageResponseTime: number;
    /** Cache hit rate */
    cacheHitRate: number;
    /** Statistics by provider */
    byProvider: Record<string, HoverProviderStats>;
    /** Statistics by type */
    byType: Record<string, number>;
}

/** Hover provider statistics */
export interface HoverProviderStats {
    /** Provider name */
    name: string;
    /** Request count */
    requests: number;
    /** Successful count */
    successful: number;
    /** Failed count */
    failed: number;
    /** Average time */
    averageTime: number;
    /** Cache hit rate */
    cacheHitRate: number;
}

/** Hover cache item */
export interface HoverCacheItem {
    /** Key */
    key: string;
    /** Hover information */
    hover: ExtendedHover;
    /** Context */
    context: HoverContext;
    /** Expiration time */
    expiresAt: number;
    /** Created at */
    createdAt: number;
    /** Usage count */
    useCount: number;
    /** Last used time */
    lastUsed: number;
}