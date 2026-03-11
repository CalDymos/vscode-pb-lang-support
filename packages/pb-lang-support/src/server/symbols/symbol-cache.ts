/**
 * Enhanced symbol cache
 * Supports intelligent cache invalidation, layered caching, and memory optimization
 */

import { PureBasicSymbol, SymbolKind } from './types';
import { generateHash } from '../utils/hash-utils';

interface CacheEntry {
    symbols: PureBasicSymbol[];
    hash: string;
    lastAccess: number;
    accessCount: number;
    priority: number; // 1-5, 5 is the highest priority
}

class EnhancedSymbolCache {
    private cache = new Map<string, CacheEntry>();
    private readonly maxCacheSize = 1000;
    private readonly maxEntriesPerDocument = 500;
    private accessTimes: Array<{ uri: string; time: number }> = [];

    /**
     * Intelligently set document symbols
     * @param uri Document URI
     * @param symbols Symbol array
     * @param contentHash Document content hash, used for intelligent cache invalidation
     */
    setSymbols(uri: string, symbols: PureBasicSymbol[], contentHash?: string): void {
        // Limit the number of symbols for a single document
        if (symbols.length > this.maxEntriesPerDocument) {
            symbols = this.prioritizeSymbols(symbols);
        }

        const existing = this.cache.get(uri);
        const hash = contentHash || generateHash(JSON.stringify(symbols));

        // If the hash is the same, only update the access time
        if (existing && existing.hash === hash) {
            existing.lastAccess = Date.now();
            existing.accessCount++;
            return;
        }

        // Calculate document priority
        const priority = this.calculateDocumentPriority(uri, symbols);

        const entry: CacheEntry = {
            symbols,
            hash,
            lastAccess: Date.now(),
            accessCount: existing ? existing.accessCount + 1 : 1,
            priority
        };

        this.cache.set(uri, entry);
        this.recordAccess(uri);
        this.enforceCacheSizeLimit();
    }

    /**
     * Get document symbols with hash validation support.
     * Returns the cached symbol array (which may be empty) on a hit,
     * or null when the entry does not exist or the hash has changed.
     */
    getSymbols(uri: string, expectedHash?: string): PureBasicSymbol[] | null {
        const entry = this.cache.get(uri);
        if (!entry) {
            return null;
        }

        // Hash validation
        if (expectedHash && entry.hash !== expectedHash) {
            this.cache.delete(uri);
            return null;
        }

        // Update access information
        entry.lastAccess = Date.now();
        entry.accessCount++;
        this.recordAccess(uri);

        return entry.symbols;
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): {
        totalDocuments: number;
        totalSymbols: number;
        averageSymbolsPerDocument: number;
        memoryUsage: string;
        oldestAccess: number | null;
        mostAccessed: Array<{ uri: string; count: number }>;
    } {
        const totalDocuments = this.cache.size;
        let totalSymbols = 0;
        let mostAccessed: Array<{ uri: string; count: number }> = [];
        let oldestAccess = Date.now();

        for (const [uri, entry] of this.cache.entries()) {
            totalSymbols += entry.symbols.length;

            if (entry.accessCount > (mostAccessed[0]?.count || 0)) {
                mostAccessed = [{ uri, count: entry.accessCount }];
            } else if (entry.accessCount === mostAccessed[0]?.count) {
                mostAccessed.push({ uri, count: entry.accessCount });
            }

            if (entry.lastAccess < oldestAccess) {
                oldestAccess = entry.lastAccess;
            }
        }

        const averageSymbolsPerDocument = totalDocuments > 0 ? totalSymbols / totalDocuments : 0;
        const memoryUsage = this.estimateMemoryUsage();

        return {
            totalDocuments,
            totalSymbols,
            averageSymbolsPerDocument: Math.round(averageSymbolsPerDocument * 100) / 100,
            memoryUsage,
            oldestAccess: oldestAccess === Date.now() ? null : oldestAccess,
            mostAccessed: mostAccessed.slice(0, 5)
        };
    }

    /**
     * Find symbols (enhanced version)
     */
    findSymbol(name: string, uri?: string, kind?: SymbolKind): PureBasicSymbol[] {
        const results: PureBasicSymbol[] = [];
        const searchName = name.toLowerCase();

        const searchInSymbols = (symbols: PureBasicSymbol[]) => {
            for (const symbol of symbols) {
                if (symbol.name.toLowerCase().includes(searchName)) {
                    if (!kind || symbol.kind === kind) {
                        results.push(symbol);
                    }
                }
            }
        };

        if (uri) {
            const entry = this.cache.get(uri);
            if (entry) {
                searchInSymbols(entry.symbols);
            }
        } else {
            // Search sorted by priority
            const sortedEntries = Array.from(this.cache.entries())
                .sort((a, b) => b[1].priority - a[1].priority);

            for (const [, entry] of sortedEntries) {
                searchInSymbols(entry.symbols);
            }
        }

        return results;
    }

    /**
     * Enhanced detailed symbol lookup
     */
    findSymbolDetailed(name: string, kind?: SymbolKind): Array<{ uri: string; symbol: PureBasicSymbol }> {
        const out: Array<{ uri: string; symbol: PureBasicSymbol }> = [];
        const searchName = name.toLowerCase();

        for (const [uri, entry] of this.cache.entries()) {
            for (const sym of entry.symbols) {
                if (sym.name.toLowerCase().includes(searchName)) {
                    if (!kind || sym.kind === kind) {
                        out.push({ uri, symbol: sym });
                    }
                }
            }
        }

        // Sort by access priority
        return out.sort((a, b) => {
            const entryA = this.cache.get(a.uri);
            const entryB = this.cache.get(b.uri);
            if (!entryA || !entryB) return 0;
            return entryB.priority - entryA.priority;
        });
    }

    /**
     * Exact-match symbol lookup (case-insensitive equality, not substring).
     * Use this for definition resolution where a substring hit would be wrong.
     */
    findSymbolExactDetailed(name: string, kind?: SymbolKind): Array<{ uri: string; symbol: PureBasicSymbol }> {
        const out: Array<{ uri: string; symbol: PureBasicSymbol }> = [];
        const searchName = name.toLowerCase();

        for (const [uri, entry] of this.cache.entries()) {
            for (const sym of entry.symbols) {
                if (sym.name.toLowerCase() === searchName) {
                    if (!kind || sym.kind === kind) {
                        out.push({ uri, symbol: sym });
                    }
                }
            }
        }

        return out.sort((a, b) => {
            const entryA = this.cache.get(a.uri);
            const entryB = this.cache.get(b.uri);
            if (!entryA || !entryB) return 0;
            return entryB.priority - entryA.priority;
        });
    }

    /**
     * Clear symbols for multiple documents in batch
     */
    clearMultipleSymbols(uris: string[]): void {
        for (const uri of uris) {
            this.cache.delete(uri);
        }
    }

    /**
     * Clear low-priority cache entries
     */
    clearLowPriorityDocuments(): void {
        const entries = Array.from(this.cache.entries())
            .sort((a, b) => a[1].priority - b[1].priority);

        const toRemove = entries.slice(0, Math.floor(entries.length * 0.3));
        for (const [uri] of toRemove) {
            this.cache.delete(uri);
        }
    }

    private calculateDocumentPriority(uri: string, symbols: PureBasicSymbol[]): number {
        let priority = 1; // Base priority

        // Increase priority based on symbol types
        const hasProcedures = symbols.some(s => s.kind === SymbolKind.Procedure);
        const hasModules = symbols.some(s => s.kind === SymbolKind.Module);
        const hasStructures = symbols.some(s => s.kind === SymbolKind.Structure);

        if (hasProcedures) priority += 1;
        if (hasModules) priority += 1;
        if (hasStructures) priority += 1;

        // Increase priority based on file path (for example, main file)
        if (uri.includes('main') || uri.includes('index')) {
            priority += 1;
        }

        return Math.min(priority, 5);
    }

    private prioritizeSymbols(symbols: PureBasicSymbol[]): PureBasicSymbol[] {
        // Priority order: procedure > module > structure > constant > variable
        const kindPriority: Record<SymbolKind, number> = {
            [SymbolKind.Procedure]: 5,
            [SymbolKind.Function]: 5,
            [SymbolKind.Module]: 4,
            [SymbolKind.Structure]: 3,
            [SymbolKind.Interface]: 3,
            [SymbolKind.Enumeration]: 3,
            [SymbolKind.Constant]: 2,
            [SymbolKind.Variable]: 1,
            [SymbolKind.Keyword]: 1,
            [SymbolKind.Operator]: 1,
            [SymbolKind.Parameter]: 1
        };

        return symbols
            .sort((a, b) => (kindPriority[b.kind] || 1) - (kindPriority[a.kind] || 1))
            .slice(0, this.maxEntriesPerDocument);
    }

    private recordAccess(uri: string): void {
        this.accessTimes.push({ uri, time: Date.now() });

        // Retain the latest 1000 access records - perform a one-time trim to avoid multiple shift() operations
        const overflow = this.accessTimes.length - 1000;
        if (overflow > 0) {
            this.accessTimes.splice(0, overflow);
        }
    }

    private enforceCacheSizeLimit(): void {
        if (this.cache.size <= this.maxCacheSize) {
            return;
        }

        // LRU strategy: remove the least recently used documents
        const entries = Array.from(this.cache.entries())
            .sort((a, b) => a[1].lastAccess - b[1].lastAccess);

        const toRemove = entries.slice(0, this.cache.size - this.maxCacheSize);
        for (const [uri] of toRemove) {
            this.cache.delete(uri);
        }
    }

    private estimateMemoryUsage(): string {
        let totalSize = 0;
        for (const entry of this.cache.values()) {
            totalSize += JSON.stringify(entry).length;
        }

        if (totalSize < 1024) {
            return `${totalSize} B`;
        } else if (totalSize < 1024 * 1024) {
            return `${Math.round(totalSize / 1024 * 100) / 100} KB`;
        } else {
            return `${Math.round(totalSize / (1024 * 1024) * 100) / 100} MB`;
        }
    }

    /**
     * Clear symbols for a document
     */
    clearSymbols(uri: string): void {
        this.cache.delete(uri);
    }

    /**
     * Clear all symbols
     */
    clearAll(): void {
        this.cache.clear();
        this.accessTimes = [];
    }
}

export const symbolCache = new EnhancedSymbolCache();