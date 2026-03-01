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

export function readFileCached(filePath: string): string | null {
    try {
        const stat = fs.statSync(filePath);
        const mtimeMs = stat.mtimeMs;
        const cached = fileCache.get(filePath);
        const now = Date.now();

        if (cached && cached.mtimeMs === mtimeMs) {
            cached.lastAccess = now;
            return cached.content;
        }

        // Only evict when adding a new entry;
        // overwriting a stale entry keeps size constant
        if (!cached) {
            evictOldestIfNeeded();
        }

        const content = fs.readFileSync(filePath, 'utf8');
        fileCache.set(filePath, { mtimeMs, content, lastAccess: now });
        return content;
    } catch (err) {
        internalLog('[file-cache] Failed to read file', err);
        return null;
    }
}

export function clearFileCache(): void {
    fileCache.clear();
}

export function getFileCacheSize(): number {
    return fileCache.size;
}