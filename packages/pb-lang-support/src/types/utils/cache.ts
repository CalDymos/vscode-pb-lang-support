/**
 * Cache utility type definitions
 */

import { CancellationToken, Disposable } from './generics';

/** Cache entry */
export interface CacheEntry<T> {
    /** Cached value */
    value: T;
    /** Creation time */
    createdAt: number;
    /** Last access time */
    lastAccessed: number;
    /** Access count */
    accessCount: number;
    /** Expiration time */
    expiresAt?: number;
    /** Size (bytes) */
    size?: number;
    /** Metadata */
    metadata?: Record<string, unknown>;
}

/** Cache options */
export interface CacheOptions<K, V> {
    /** Maximum number of entries */
    maxSize?: number;
    /** TTL (milliseconds) */
    ttl?: number;
    /** Whether to enable LRU eviction */
    enableLRU?: boolean;
    /** Whether to enable TTL eviction */
    enableTTL?: boolean;
    /** Key serialization function */
    keySerializer?: (key: K) => string;
    /** Value serialization function */
    valueSerializer?: (value: V) => string;
    /** Value deserialization function */
    valueDeserializer?: (serialized: string) => V;
    /** Size calculation function */
    sizeCalculator?: (value: V) => number;
    /** Eviction callback */
    onEvict?: (key: K, entry: CacheEntry<V>) => void;
    /** Cleanup interval (milliseconds) */
    cleanupInterval?: number;
}

/** Cache statistics */
export interface CacheStats {
    /** Hit count */
    hits: number;
    /** Miss count */
    misses: number;
    /** Hit rate */
    hitRate: number;
    /** Total entries */
    totalEntries: number;
    /** Total size (bytes) */
    totalSize: number;
    /** Expired entries */
    expiredEntries: number;
    /** Evicted entries */
    evictedEntries: number;
    /** Average access time */
    averageAccessTime: number;
    /** Creation time */
    createdAt: number;
}

/** Cache interface */
export interface Cache<K, V> {
    /** Get value */
    get(key: K): V | undefined;
    /** Set value */
    set(key: K, value: V, options?: CacheSetOptions<V>): void;
    /** Check if exists */
    has(key: K): boolean;
    /** Delete value */
    delete(key: K): boolean;
    /** Clear cache */
    clear(): void;
    /** Get all keys */
    keys(): K[];
    /** Get all values */
    values(): V[];
    /** Get all entries */
    entries(): Array<[K, CacheEntry<V>]>;
    /** Cache size */
    readonly size: number;
    /** Get statistics */
    getStats(): CacheStats;
    /** Start cleanup of expired entries */
    startCleanup(): void;
    /** Stop cleanup of expired entries */
    stopCleanup(): void;
}

/** Cache set options */
export interface CacheSetOptions<V> {
    /** TTL（毫秒） */
    ttl?: number;
    /** 大小（字节） */
    size?: number;
    /** 元数据 */
    metadata?: Record<string, unknown>;
}

/** 内存缓存接口 */
export interface MemoryCache<K, V> extends Cache<K, V> {
    /** 获取内存使用情况 */
    getMemoryUsage(): CacheMemoryUsage;
    /** 压缩缓存 */
    compress(): Promise<void>;
    /** 解压缓存 */
    decompress(): Promise<void>;
}

/** 缓存内存使用情况 */
export interface CacheMemoryUsage {
    /** 总内存使用（字节） */
    total: number;
    /** 缓存值使用（字节） */
    values: number;
    /** 缓存键使用（字节） */
    keys: number;
    /** 元数据使用（字节） */
    metadata: number;
    /** 其他开销（字节） */
    overhead: number;
}

/** 分布式缓存接口 */
export interface DistributedCache<K, V> extends Cache<K, V> {
    /** 设置值到多个节点 */
    setMulti(keyValues: Array<[K, V]>): Promise<void>;
    /** 获取多个值 */
    getMulti(keys: K[]): Promise<Array<[K, V | undefined]>>;
    /** 删除多个值 */
    deleteMulti(keys: K[]): Promise<number>;
    /** 获取集群状态 */
    getClusterStatus(): Promise<CacheClusterStatus>;
}

/** 缓存集群状态 */
export interface CacheClusterStatus {
    /** 节点数量 */
    nodeCount: number;
    /** 在线节点数量 */
    onlineNodes: number;
    /** 总内存使用 */
    totalMemory: number;
    /** 可用内存 */
    availableMemory: number;
    /** 节点列表 */
    nodes: CacheNodeStatus[];
}

/** 缓存节点状态 */
export interface CacheNodeStatus {
    /** 节点ID */
    id: string;
    /** 节点地址 */
    address: string;
    /** 是否在线 */
    isOnline: boolean;
    /** 内存使用 */
    memoryUsage: CacheMemoryUsage;
    /** 最后心跳时间 */
    lastHeartbeat: number;
}

/** 磁盘缓存接口 */
export interface DiskCache<K, V> extends Cache<K, V> {
    /** 持久化到磁盘 */
    persist(): Promise<void>;
    /** 从磁盘加载 */
    load(): Promise<void>;
    /** 获取磁盘使用情况 */
    getDiskUsage(): CacheDiskUsage;
    /** 压缩磁盘缓存 */
    compressDisk(): Promise<void>;
}

/** 缓存磁盘使用情况 */
export interface CacheDiskUsage {
    /** 总磁盘使用（字节） */
    total: number;
    /** 缓存文件数量 */
    fileCount: number;
    /** 平均文件大小 */
    averageFileSize: number;
    /** 磁盘路径 */
    diskPath: string;
}

/** 多级缓存接口 */
export interface MultiLevelCache<K, V> extends Cache<K, V> {
    /** 添加缓存级别 */
    addLevel(level: number, cache: Cache<K, V>): void;
    /** 移除缓存级别 */
    removeLevel(level: number): void;
    /** 获取缓存级别 */
    getLevel(level: number): Cache<K, V> | undefined;
    /** 获取所有级别 */
    getLevels(): Cache<K, V>[];
}

/** 缓存事件 */
export interface CacheEvent<K, V> {
    /** 事件类型 */
    type: CacheEventType;
    /** 键 */
    key: K;
    /** 值 */
    value?: V;
    /** 时间戳 */
    timestamp: number;
}

/** 缓存事件类型 */
export enum CacheEventType {
    /** 设置值 */
    Set = 'set',
    /** 获取值 */
    Get = 'get',
    /** 删除值 */
    Delete = 'delete',
    /** 清空缓存 */
    Clear = 'clear',
    /** 过期 */
    Expire = 'expire',
    /** 淘汰 */
    Evict = 'evict',
    /** 命中 */
    Hit = 'hit',
    /** 未命中 */
    Miss = 'miss'
}

/** 缓存监听器 */
export interface CacheListener<K, V> {
    /** 处理事件 */
    (event: CacheEvent<K, V>): void | Promise<void>;
}

/** 可观察缓存接口 */
export interface ObservableCache<K, V> extends Cache<K, V> {
    /** 添加事件监听器 */
    on(event: CacheEventType, listener: CacheListener<K, V>): Disposable;
    /** 移除事件监听器 */
    off(event: CacheEventType, listener: CacheListener<K, V>): void;
    /** 触发事件 */
    emit(event: CacheEvent<K, V>): void;
}

/** 带取消标记的缓存 */
export interface CacheWithCancellation<K, V> extends Cache<K, V> {
    /** 带取消标记获取值 */
    getWithCancellation(key: K, token: CancellationToken): Promise<V | undefined>;
    /** 带取消标记设置值 */
    setWithCancellation(key: K, value: V, options: CacheSetOptions<V> & { token: CancellationToken }): Promise<boolean>;
}

/** 流式缓存 */
export interface StreamingCache<K, V> extends Cache<K, V> {
    /** 流式获取值 */
    streamGet(key: K): AsyncIterable<V>;
    /** 流式设置值 */
    streamSet(key: K, values: AsyncIterable<V>): Promise<void>;
    /** 流式删除值 */
    streamDelete(keys: AsyncIterable<K>): Promise<number>;
}

/** 缓存工厂 */
export interface CacheFactory {
    /** 创建内存缓存 */
    createMemoryCache<K, V>(options?: CacheOptions<K, V>): MemoryCache<K, V>;
    /** 创建磁盘缓存 */
    createDiskCache<K, V>(path: string, options?: CacheOptions<K, V>): DiskCache<K, V>;
    /** 创建多级缓存 */
    createMultiLevelCache<K, V>(options?: CacheOptions<K, V>): MultiLevelCache<K, V>;
    /** 创建分布式缓存 */
    createDistributedCache<K, V>(config: DistributedCacheConfig): DistributedCache<K, V>;
}

/** 分布式缓存配置 */
export interface DistributedCacheConfig {
    /** 节点列表 */
    nodes: CacheNodeConfig[];
    /** 复制因子 */
    replicationFactor: number;
    /** 一致性哈希环 */
    hashRing?: HashRingConfig;
    /** 连接超时 */
    connectTimeout: number;
    /** 操作超时 */
    operationTimeout: number;
}

/** 缓存节点配置 */
export interface CacheNodeConfig {
    /** 节点ID */
    id: string;
    /** 节点地址 */
    address: string;
    /** 权重 */
    weight: number;
    /** 是否启用 */
    enabled: boolean;
}

/** 哈希环配置 */
export interface HashRingConfig {
    /** 虚拟节点数 */
    virtualNodes: number;
    /** 哈希算法 */
    hashAlgorithm: string;
    /** 一致性级别 */
    consistency: 'strong' | 'eventual';
}