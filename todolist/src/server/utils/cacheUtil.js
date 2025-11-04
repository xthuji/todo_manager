const fs = require('fs');
const path = require('path');

// 内存缓存对象
const memoryCache = {
    // 存储缓存项的Map
    _cache: new Map(),
    // 最大缓存数量
    _maxSize: 50,
    
    // 添加或更新缓存项，同时维护LRU顺序
    set(key, value) {
        // 如果已存在，先删除（将在后续重新添加到Map末尾）
        if (this._cache.has(key)) {
            this._cache.delete(key);
        }
        
        // 如果达到最大容量，删除最早的项（Map的迭代顺序是插入顺序）
        if (this._cache.size >= this._maxSize) {
            const oldestKey = this._cache.keys().next().value;
            this._cache.delete(oldestKey);
        }
        
        // 将新项添加到Map（会自动放在末尾，表示最近使用）
        this._cache.set(key, value);
    },
    
    // 获取缓存项，并更新LRU顺序
    get(key) {
        const value = this._cache.get(key);
        if (value !== undefined) {
            // 更新访问顺序，先删除再重新添加
            this._cache.delete(key);
            this._cache.set(key, value);
        }
        return value;
    },
    
    // 检查是否存在缓存项
    has(key) {
        return this._cache.has(key);
    }
};

/**
 * 通用缓存处理函数，根据参数决定执行读取或写入操作
 * 现在支持内存缓存和文件缓存两级缓存
 * @param {string} cacheKey - 缓存的唯一标识符（如IP地址）
 * @param {Object|null} data - 要缓存的数据，如果为null则执行读取操作
 * @param {Object} options - 配置项
 * @param {string} options.cacheDir - 缓存目录路径
 * @param {string} options.cachePrefix - 缓存文件前缀
 * @param {number} options.ttl - 缓存过期时间（毫秒）
 * @param {string} options.extension - 缓存文件扩展名
 * @param {boolean} options.useMemoryCache - 是否使用内存缓存，默认为true
 * @returns {Object|null} 读取模式下返回缓存的数据，写入模式下返回null
 */
function handleCache(cacheKey, data = null, options = {}) {
    // 默认使用内存缓存
    const useMemoryCache = options.useMemoryCache !== false;
    // 生成内存缓存键
    const memoryCacheKey = `${options.cachePrefix || ''}${cacheKey}`;
    
    try {
        // 写入模式
        if (data !== null) {
            // 构建缓存数据
            const cacheData = {
                timestamp: Date.now(),
                data: data
            };
            
            // 内存缓存写入
            if (useMemoryCache) {
                memoryCache.set(memoryCacheKey, cacheData);
            }
            
            // 文件缓存写入
            if (options.cacheDir && options.extension) {
                const safeCacheKey = cacheKey.replace(/\./g, '_');
                const cacheFile = path.join(
                    options.cacheDir,
                    `${options.cachePrefix || ''}${safeCacheKey}.${options.extension}`
                );
                
                // 确保缓存目录存在
                if (!fs.existsSync(options.cacheDir)) {
                    fs.mkdirSync(options.cacheDir, { recursive: true });
                }
                
                fs.writeFileSync(cacheFile, JSON.stringify(cacheData), 'utf8');
            }
            
            return null;
        }
        
        // 读取模式
        // 1. 优先从内存缓存读取
        if (useMemoryCache && memoryCache.has(memoryCacheKey)) {
            const cachedData = memoryCache.get(memoryCacheKey);
            // 检查缓存是否有效
            if (Date.now() - cachedData.timestamp < options.ttl) {
                return cachedData;
            }
        }
        
        // 2. 如果内存缓存不存在或已过期，尝试从文件缓存读取
        if (options.cacheDir && options.extension) {
            const safeCacheKey = cacheKey.replace(/\./g, '_');
            const cacheFile = path.join(
                options.cacheDir,
                `${options.cachePrefix || ''}${safeCacheKey}.${options.extension}`
            );
            
            if (fs.existsSync(cacheFile)) {
                const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
                // 检查缓存是否有效
                if (Date.now() - cachedData.timestamp < options.ttl) {
                    // 同步到内存缓存
                    if (useMemoryCache) {
                        memoryCache.set(memoryCacheKey, cachedData);
                    }
                    return cachedData;
                }
            }
        }
    } catch (error) {
        console.error(`缓存${data !== null ? '写入' : '读取'}失败:`, error);
    }
    return null;
}

module.exports = {
    handleCache
};
