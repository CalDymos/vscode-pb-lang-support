import * as fs from 'fs';

type LogFn = (message: string, err?: unknown) => void;

/** No-op until initFileCache() is called. */
let internalLog: LogFn = () => { /* uninitialized */ };

/**
 * Must be called once during server startup to wire up LSP logging.
 * Until called, errors are silently swallowed.
 */
export function initFileCache(logFn: LogFn): void {
    internalLog = logFn;
}

type CacheEntry = {
    mtimeMs: number;
    content: string;
    lastAccess: number;
};

const MAX_CACHE_SIZE = 100;
const fileCache = new Map<string, CacheEntry>();

/**
 * Removes the least recently used entry if the cache is at capacity.
 */
function evictOldestIfNeeded(): void {
    if (fileCache.size < MAX_CACHE_SIZE) {
        return;
    }

    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of fileCache.entries()) {
        if (entry.lastAccess < oldestTime) {
            oldestTime = entry.lastAccess;
            oldestKey = key;
        }
    }

    if (oldestKey) {
        fileCache.delete(oldestKey);
    }
}

export type FileCacheResult = {
    content: string;
    mtimeMs: number;
};

/**
 * Reads a file with mtime-based caching.
 * Returns `{ content, mtimeMs }` or `null` when the file cannot be read.
 *
 * Callers that only need to detect changes can compare `mtimeMs` without
 * re-hashing the content.
 */
export function readFileCachedWithMtime(filePath: string): FileCacheResult | null {
    try {
        const stat = fs.statSync(filePath);
        const mtimeMs = stat.mtimeMs;
        const cached = fileCache.get(filePath);
        const now = Date.now();

        if (cached && cached.mtimeMs === mtimeMs) {
            cached.lastAccess = now;
            return { content: cached.content, mtimeMs };
        }

        // Only evict when adding a new entry;
        // overwriting a stale entry keeps size constant.
        if (!cached) {
            evictOldestIfNeeded();
        }

        const content = fs.readFileSync(filePath, 'utf8');
        fileCache.set(filePath, { mtimeMs, content, lastAccess: now });
        return { content, mtimeMs };
    } catch (err) {
        internalLog('[file-cache] Failed to read file', err);
        return null;
    }
}

export function readFileCached(filePath: string): string | null {
    return readFileCachedWithMtime(filePath)?.content ?? null;
}

export function clearFileCache(): void {
    fileCache.clear();
}

export function getFileCacheSize(): number {
    return fileCache.size;
}