const fs = require('fs');
const path = require('path');
const { USE_CACHE } = require('./constants');

/**
 * 增强的内存缓存类
 * 支持LRU淘汰策略和缓存统计
 */
class MemoryCache {
    constructor(options = {}) {
        this._cache = new Map();
        this._maxSize = options.maxSize || 100; // 默认最大缓存100个项
        this._stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0
        };
        this._defaultTTL = options.defaultTTL || 3600000; // 默认1小时
    }

    /**
     * 获取缓存项
     * @param {string} key - 缓存键
     * @param {boolean} returnRawData - 是否只返回原始数据，默认为false（返回包装数据）
     * @returns {Object|null} 包装后的缓存数据或原始数据
     */
    get(key, returnRawData = false) {
        if (!this._cache.has(key)) {
            this._stats.misses++;
            return null;
        }

        const cachedItem = this._cache.get(key);
        
        // 检查是否过期
        if (cachedItem.expireAt && Date.now() > cachedItem.expireAt) {
            this._cache.delete(key);
            this._stats.misses++;
            return null;
        }

        // 更新LRU顺序
        this._cache.delete(key);
        this._cache.set(key, cachedItem);
        this._stats.hits++;
        
        // 根据参数决定返回原始数据还是包装数据
        if (returnRawData) {
            return cachedItem.data;
        }
        // 默认返回包装后的数据 {data, timestamp}
        return {
            data: cachedItem.data,
            timestamp: cachedItem.timestamp
        };
    }

    /**
     * 设置缓存项
     * @param {string} key - 缓存键
     * @param {*} data - 要缓存的数据
     * @param {number} ttl - 过期时间（毫秒）
     */
    set(key, data, ttl = this._defaultTTL) {
        // 维护LRU顺序
        if (this._cache.has(key)) {
            this._cache.delete(key);
        }

        // 检查是否需要淘汰旧项
        if (this._cache.size >= this._maxSize) {
            const oldestKey = this._cache.keys().next().value;
            this._cache.delete(oldestKey);
        }

        const cacheItem = {
            data, // 直接保存数据，get方法会返回这个data字段
            timestamp: Date.now(),
            expireAt: ttl ? Date.now() + ttl : null
        };

        this._cache.set(key, cacheItem);
        this._stats.sets++;
    }

    /**
     * 删除缓存项
     * @param {string} key - 缓存键
     */
    delete(key) {
        if (this._cache.has(key)) {
            this._cache.delete(key);
            this._stats.deletes++;
        }
    }

    /**
     * 检查是否存在缓存项
     * @param {string} key - 缓存键
     * @returns {boolean}
     */
    has(key) {
        return this._cache.has(key);
    }

    /**
     * 清除所有缓存
     */
    clear() {
        this._cache.clear();
        // 重置统计但保留历史数据
        this._stats.clears = (this._stats.clears || 0) + 1;
    }

    /**
     * 获取缓存统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            size: this._cache.size,
            maxSize: this._maxSize,
            ...this._stats,
            hitRate: this._stats.hits + this._stats.misses > 0 
                ? Math.round((this._stats.hits / (this._stats.hits + this._stats.misses)) * 100) 
                : 0
        };
    }
}

// 创建全局内存缓存实例
const memoryCache = new MemoryCache();

/**
 * 文件缓存操作类
 */
class FileCache {
    /**
     * 从文件读取缓存
     * @param {string} cacheKey - 缓存键
     * @param {Object} options - 配置选项
     * @param {boolean} returnRawData - 是否只返回原始数据，默认为false（返回包装数据）
     * @returns {Object|null} 包装后的缓存数据或原始数据
     */
    static read(cacheKey, options, returnRawData = false) {
        if (!options.cacheDir || !options.extension) {
            return null;
        }

        try {
            const safeCacheKey = cacheKey.replace(/[^a-zA-Z0-9_-]/g, '_');
            const cacheFile = path.join(
                options.cacheDir,
                `${options.cachePrefix || ''}${safeCacheKey}.${options.extension}`
            );

            if (fs.existsSync(cacheFile)) {
                const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
                
                // 检查是否过期
                if (options.ttl && cachedData.timestamp && Date.now() - cachedData.timestamp >= options.ttl) {
                    // 可选：自动删除过期文件
                    if (options.autoDeleteExpired) {
                        fs.unlinkSync(cacheFile);
                    }
                    return null;
                }
                
                // 根据参数决定返回原始数据还是包装数据
                if (returnRawData) {
                    return cachedData.data;
                }
                // 默认返回包装后的数据 {data, timestamp}
                return {
                    data: cachedData.data,
                    timestamp: cachedData.timestamp
                };
            }
        } catch (error) {
            console.error('读取文件缓存失败:', error);
        }
        return null;
    }

    /**
     * 写入缓存到文件
     * @param {string} cacheKey - 缓存键
     * @param {*} data - 要缓存的数据
     * @param {Object} options - 配置选项
     */
    static write(cacheKey, data, options) {
        if (!options.cacheDir || !options.extension) {
            return;
        }

        try {
            // 确保缓存目录存在
            if (!fs.existsSync(options.cacheDir)) {
                fs.mkdirSync(options.cacheDir, { recursive: true });
            }

            const safeCacheKey = cacheKey.replace(/[^a-zA-Z0-9_-]/g, '_');
            const cacheFile = path.join(
                options.cacheDir,
                `${options.cachePrefix || ''}${safeCacheKey}.${options.extension}`
            );

            // 创建带时间戳的缓存项，保持与读取逻辑一致
            const cacheItem = {
                data, // 存储原始数据
                timestamp: Date.now() // 用于过期检查
            };

            fs.writeFileSync(cacheFile, JSON.stringify(cacheItem), 'utf8');
        } catch (error) {
            console.error('写入文件缓存失败:', error);
        }
    }

    /**
     * 删除文件缓存
     * @param {string} cacheKey - 缓存键
     * @param {Object} options - 配置选项
     */
    static delete(cacheKey, options) {
        if (!options.cacheDir || !options.extension) {
            return;
        }

        try {
            const safeCacheKey = cacheKey.replace(/[^a-zA-Z0-9_-]/g, '_');
            const cacheFile = path.join(
                options.cacheDir,
                `${options.cachePrefix || ''}${safeCacheKey}.${options.extension}`
            );

            if (fs.existsSync(cacheFile)) {
                fs.unlinkSync(cacheFile);
            }
        } catch (error) {
            console.error('删除文件缓存失败:', error);
        }
    }
}

/**
 * 缓存管理器类
 * 提供简洁易用的缓存API，支持内存缓存和文件缓存两级存储
 */
class CacheManager {
    /**
     * 构造函数
     * @param {Object} defaultOptions - 默认配置选项
     */
    constructor(defaultOptions = {}) {
        this.defaultOptions = {
            cacheDir: null,
            cachePrefix: '',
            ttl: 3600000, // 默认1小时
            extension: 'json',
            useMemoryCache: true,
            useFileCache: false,
            autoDeleteExpired: true,
            ...defaultOptions
        };
        
        // 缓存命名空间管理
        this.namespaces = new Map();
    }

    /**
     * 创建命名空间特定的配置
     * @param {string} namespace - 命名空间
     * @param {Object} options - 配置选项
     */
    createNamespace(namespace, options = {}) {
        this.namespaces.set(namespace, {
            ...this.defaultOptions,
            ...options
        });
    }

    /**
     * 获取指定命名空间的配置
     * @param {string} namespace - 命名空间
     * @returns {Object} 配置选项
     */
    getNamespaceOptions(namespace) {
        return this.namespaces.get(namespace) || this.defaultOptions;
    }

    /**
     * 获取缓存数据
     * @param {string} key - 缓存键
     * @param {Object|string} optionsOrNamespace - 配置选项或命名空间
     * @param {boolean} returnRawData - 是否只返回原始数据，默认为false（返回包装数据）
     * @returns {*} 包装后的缓存数据或原始数据
     */
    get(key, optionsOrNamespace = null, returnRawData = false) {
        if (!USE_CACHE) return null;

        const options = this._resolveOptions(optionsOrNamespace);
        const fullKey = this._getFullKey(key, options);
        
        // 优先从内存缓存获取
        if (options.useMemoryCache) {
            const cachedData = memoryCache.get(fullKey, returnRawData);
            if (cachedData !== null) {
                return cachedData;
            }
        }

        // 从文件缓存获取
        if (options.useFileCache) {
            const cachedData = FileCache.read(key, options, returnRawData);
            if (cachedData !== null) {
                // 同步到内存缓存时，需要提取原始数据
                const rawData = returnRawData ? cachedData : cachedData.data;
                if (options.useMemoryCache) {
                    memoryCache.set(fullKey, rawData, options.ttl);
                }
                return cachedData;
            }
        }

        return null;
    }

    /**
     * 设置缓存数据
     * @param {string} key - 缓存键
     * @param {*} data - 要缓存的数据
     * @param {Object|string} optionsOrNamespace - 配置选项或命名空间
     */
    set(key, data, optionsOrNamespace = null) {
        if (!USE_CACHE) return;

        const options = this._resolveOptions(optionsOrNamespace);
        const fullKey = this._getFullKey(key, options);
        
        // 解包数据：如果传入的是已包装格式 {data, timestamp}，则提取原始数据
        const dataToCache = (typeof data === 'object' && data !== null && 'data' in data && 'timestamp' in data) ? data.data : data;

        // 写入内存缓存
        if (options.useMemoryCache) {
            memoryCache.set(fullKey, dataToCache, options.ttl);
        }

        // 写入文件缓存
        if (options.useFileCache) {
            FileCache.write(key, dataToCache, options);
        }
    }

    /**
     * 删除缓存
     * @param {string} key - 缓存键
     * @param {Object|string} optionsOrNamespace - 配置选项或命名空间
     */
    delete(key, optionsOrNamespace = null) {
        const options = this._resolveOptions(optionsOrNamespace);
        const fullKey = this._getFullKey(key, options);

        // 删除内存缓存
        if (options.useMemoryCache) {
            memoryCache.delete(fullKey);
        }

        // 删除文件缓存
        if (options.useFileCache) {
            FileCache.delete(key, options);
        }
    }

    /**
     * 清除所有缓存
     */
    clearAll() {
        memoryCache.clear();
        // 文件缓存需要手动删除或通过其他方法清理
    }

    /**
     * 获取缓存统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        return memoryCache.getStats();
    }

    /**
     * 获取或设置缓存数据的便捷方法，支持函数式缓存
     * @param {string} key - 缓存键
     * @param {Function} getDataFn - 获取数据的函数，如果缓存未命中则执行
     * @param {Object|string} optionsOrNamespace - 配置选项或命名空间
     * @param {boolean} returnRawData - 是否只返回原始数据，默认为false（返回包装数据）
     * @returns {Promise<*>} 包装后的缓存数据或原始数据
     */
    async fetch(key, getDataFn, optionsOrNamespace = null, returnRawData = false) {
        // 尝试从缓存获取
        const cachedData = this.get(key, optionsOrNamespace, returnRawData);
        if (cachedData !== null) {
            return cachedData;
        }

        // 缓存未命中，执行函数获取数据
        const data = await getDataFn();
        
        // 存入缓存
        if (data !== null && data !== undefined) {
            // 存入缓存时需要提取原始数据（如果data已经是包装格式）
            const dataToCache = (typeof data === 'object' && data !== null && 'data' in data && 'timestamp' in data) ? data.data : data;
            this.set(key, dataToCache, optionsOrNamespace);
            
            // 返回时根据参数决定返回格式
            if (!returnRawData && !(typeof data === 'object' && data !== null && 'data' in data && 'timestamp' in data)) {
                // 如果data不是已包装的格式且需要返回包装格式
                return {
                    data: data,
                    timestamp: Date.now()
                };
            }
        }
        
        return data;
    }

    /**
     * 解析配置选项
     * @private
     * @param {Object|string} optionsOrNamespace - 配置选项或命名空间
     * @returns {Object} 合并后的配置选项
     */
    _resolveOptions(optionsOrNamespace) {
        if (typeof optionsOrNamespace === 'string') {
            return this.getNamespaceOptions(optionsOrNamespace);
        }
        return {
            ...this.defaultOptions,
            ...optionsOrNamespace
        };
    }

    /**
     * 生成完整的缓存键
     * @private
     * @param {string} key - 原始键
     * @param {Object} options - 配置选项
     * @returns {string} 完整的缓存键
     */
    _getFullKey(key, options) {
        return `${options.cachePrefix}${key}`;
    }
}

// 创建并导出默认的缓存管理器实例
const cacheManager = new CacheManager();

module.exports = {
    cacheManager,
    MemoryCache,
    FileCache
};
