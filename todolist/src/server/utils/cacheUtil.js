const fs = require('fs');
const path = require('path');
const { USE_CACHE, CACHE_DIR } = require('./constants');

/**
 * 简化的内存缓存类
 */
class MemoryCache {
  constructor(options = {}) {
    this._cache = new Map();
    this._maxSize = options.maxSize || 1000; // 默认最大缓存1000个项
    this._defaultTTL = options.defaultTTL || 3600000; // 默认1小时
    this._stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
  }

  /**
   * 获取缓存项
   * @param {string} key - 缓存键
   * @param {Object} options - 获取选项
   * @returns {Object|null} 缓存数据或null
   */
  get(key, options = {}) {
    const { returnRawData = false, allowExpired = false } = options;
    
    if (!this._cache.has(key)) {
      this._stats.misses++;
      return null;
    }

    const cachedItem = this._cache.get(key);
    const now = Date.now();
    
    // 检查是否过期
    const isExpired = cachedItem.expireAt !== null && now > cachedItem.expireAt;
    
    // 如果过期且不允许使用过期数据，删除缓存并返回null
    if (isExpired && !allowExpired) {
      this._cache.delete(key);
      this._stats.misses++;
      return null;
    }

    // 更新LRU顺序
    this._cache.delete(key);
    this._cache.set(key, cachedItem);
    
    // 更新统计信息
    if (!isExpired) {
      this._stats.hits++;
    }

    // 根据选项返回原始数据或包装数据
    if (returnRawData) {
      return cachedItem.data;
    }
    
    const result = {
      data: cachedItem.data,
      timestamp: cachedItem.timestamp
    };
    
    if (isExpired) {
      result.expired = true;
    }
    
    return result;
  }

  /**
   * 设置缓存项
   * @param {string} key - 缓存键
   * @param {*} data - 缓存数据
   * @param {number} ttl - 过期时间（毫秒），0表示永不过期
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
      data,
      timestamp: Date.now(),
      expireAt: ttl === 0 ? null : Date.now() + ttl
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
   * 清除所有缓存
   */
  clear() {
    this._cache.clear();
  }

  /**
   * 按前缀清除内存缓存
   * @param {string} prefix 缓存键前缀
   */
  async clearByPrefix(prefix) {
    for (const key of this._cache.keys()) {
      if (key.startsWith(prefix)) {
        this._cache.delete(key);
      }
    }
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      size: this._cache.size,
      maxSize: this._maxSize,
      hits: this._stats.hits,
      misses: this._stats.misses,
      sets: this._stats.sets,
      deletes: this._stats.deletes,
      hitRate: (this._stats.hits + this._stats.misses) > 0
        ? Math.round((this._stats.hits / (this._stats.hits + this._stats.misses)) * 100)
        : 0
    };
  }
}

/**
 * 文件缓存工具类
 */
class FileCache {
  /**
   * 从文件读取缓存
   * @param {string} key - 缓存键
   * @param {Object} options - 文件缓存选项
   * @returns {Object|null} 缓存数据或null
   */
  static read(key, options) {
    if (!options.cacheDir || !options.extension) {
      return null;
    }

    try {
      const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
      const cacheFile = path.join(
        options.cacheDir,
        `${options.cachePrefix || ''}${safeKey}.${options.extension}`
      );

      if (fs.existsSync(cacheFile)) {
        const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        
        // 检查是否过期（ttl为0表示永不过期）
        if (options.ttl !== 0 && cachedData.timestamp && 
            Date.now() - cachedData.timestamp > options.ttl) {
          // 如果过期且设置了自动删除，则删除过期文件
          if (options.autoDeleteExpired) {
            fs.unlinkSync(cacheFile);
          }
          return null;
        }
        
        return cachedData;
      }
    } catch (error) {
      console.error(`FileCache read error for key '${key}':`, error);
    }
    return null;
  }

  /**
   * 写入缓存到文件
   * @param {string} key - 缓存键
   * @param {*} data - 缓存数据
   * @param {Object} options - 文件缓存选项
   */
  static write(key, data, options) {
    if (!options.cacheDir || !options.extension) {
      return;
    }

    try {
      // 确保缓存目录存在
      if (!fs.existsSync(options.cacheDir)) {
        fs.mkdirSync(options.cacheDir, { recursive: true });
      }

      const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
      const cacheFile = path.join(
        options.cacheDir,
        `${options.cachePrefix || ''}${safeKey}.${options.extension}`
      );

      const cacheItem = {
        data,
        timestamp: Date.now(),
        isPermanent: options.ttl === 0
      };

      fs.writeFileSync(cacheFile, JSON.stringify(cacheItem), 'utf8');
    } catch (error) {
      console.error(`FileCache write error for key '${key}':`, error);
    }
  }

  /**
   * 删除文件缓存
   * @param {string} key - 缓存键
   * @param {Object} options - 文件缓存选项
   */
  static delete(key, options) {
    if (!options.cacheDir || !options.extension) {
      return;
    }

    try {
      const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
      const cacheFile = path.join(
        options.cacheDir,
        `${options.cachePrefix || ''}${safeKey}.${options.extension}`
      );

      if (fs.existsSync(cacheFile)) {
        fs.unlinkSync(cacheFile);
      }
    } catch (error) {
      console.error(`FileCache delete error for key '${key}':`, error);
    }
  }

  /**
   * 从源文件创建缓存
   * @param {string} sourceFilePath - 源文件路径
   * @param {string} cacheKey - 缓存键
   * @param {Object} options - 缓存选项
   * @returns {Object|null} 创建的缓存数据或null
   */
  static createFromSource(sourceFilePath, cacheKey, options) {
    try {
      // 检查源文件是否存在
      if (!fs.existsSync(sourceFilePath)) {
        console.error(`Source file not found: ${sourceFilePath}`);
        return null;
      }

      // 读取源文件内容
      const content = fs.readFileSync(sourceFilePath, 'utf8');
      const data = JSON.parse(content);
      
      // 写入缓存
      FileCache.write(cacheKey, data.data || data, options);
      
      return {
        data: data.data || data,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`FileCache createFromSource error:`, error);
      return null;
    }
  }
}

/**
 * 缓存管理器 - 提供简洁的缓存API
 */
class CacheManager {
  constructor(options = {}) {
    this.defaultOptions = {
      cacheDir: CACHE_DIR,
      cachePrefix: '',
      ttl: 3600000, // 默认1小时
      extension: 'json',
      useMemoryCache: true,
      useFileCache: false,
      autoDeleteExpired: true,
      ...options
    };
    
    this.namespaces = new Map();
    this.memoryCache = new MemoryCache();
  }

  /**
   * 创建缓存命名空间
   * @param {string} name - 命名空间名称
   * @param {Object} options - 命名空间特定的选项
   */
  createNamespace(name, options = {}) {
    this.namespaces.set(name, {
      ...this.defaultOptions,
      ...options
    });
  }

  /**
   * 获取命名空间选项
   * @param {string} name - 命名空间名称
   * @returns {Object} 命名空间选项
   */
  getNamespace(name) {
    return this.namespaces.get(name) || this.defaultOptions;
  }

  /**
   * 解析缓存选项
   * @param {Object|string} optionsOrNamespace - 选项对象或命名空间名称
   * @returns {Object} 解析后的选项
   */
  _resolveOptions(optionsOrNamespace) {
    if (typeof optionsOrNamespace === 'string') {
      return this.getNamespace(optionsOrNamespace);
    }
    return {
      ...this.defaultOptions,
      ...optionsOrNamespace
    };
  }

  /**
   * 生成完整的缓存键
   * @param {string} key - 原始键
   * @param {Object} options - 缓存选项
   * @returns {string} 完整的缓存键
   */
  _getFullKey(key, options) {
    return `${options.cachePrefix || ''}${key}`;
  }

  /**
   * 获取缓存数据
   * @param {string} key - 缓存键
   * @param {Object|string} optionsOrNamespace - 选项或命名空间
   * @param {Object} options - 获取选项
   * @returns {Object|null} 缓存数据或null
   */
  get(key, optionsOrNamespace = null, options = {}) {
    if (!USE_CACHE) return null;

    const cacheOptions = this._resolveOptions(optionsOrNamespace);
    const fullKey = this._getFullKey(key, cacheOptions);
    
    // 优先从内存缓存获取
    if (cacheOptions.useMemoryCache) {
      const memoryData = this.memoryCache.get(fullKey, options);
      if (memoryData !== null) {
        return memoryData;
      }
    }

    // 从文件缓存获取
    if (cacheOptions.useFileCache) {
      const fileData = FileCache.read(key, cacheOptions);
      if (fileData !== null) {
        // 同步到内存缓存
        if (cacheOptions.useMemoryCache) {
          this.memoryCache.set(fullKey, fileData.data, cacheOptions.ttl);
        }
        
        // 根据选项返回原始数据或包装数据
        if (options.returnRawData) {
          return fileData.data;
        }
        
        const result = {
          data: fileData.data,
          timestamp: fileData.timestamp
        };
        
        if (fileData.isPermanent !== true && 
            cacheOptions.ttl > 0 && 
            Date.now() - fileData.timestamp > cacheOptions.ttl) {
          result.expired = true;
        }
        
        return result;
      }
      
      // 如果提供了源文件路径，尝试从源文件创建缓存
      if (options.sourceFilePath) {
        const createdCache = FileCache.createFromSource(
          options.sourceFilePath,
          key,
          cacheOptions
        );
        
        if (createdCache !== null) {
          // 同步到内存缓存
          if (cacheOptions.useMemoryCache) {
            this.memoryCache.set(fullKey, createdCache.data, cacheOptions.ttl);
          }
          
          return options.returnRawData ? createdCache.data : createdCache;
        }
      }
    }

    return null;
  }

  /**
   * 设置缓存数据
   * @param {string} key - 缓存键
   * @param {*} data - 缓存数据
   * @param {Object|string} optionsOrNamespace - 选项或命名空间
   */
  set(key, data, optionsOrNamespace = null) {
    if (!USE_CACHE) return;

    const cacheOptions = this._resolveOptions(optionsOrNamespace);
    const fullKey = this._getFullKey(key, cacheOptions);
    
    // 解包数据（如果是已包装的格式）
    const dataToCache = (typeof data === 'object' && data !== null && 
                        'data' in data && 'timestamp' in data) ? data.data : data;

    // 写入内存缓存
    if (cacheOptions.useMemoryCache) {
      this.memoryCache.set(fullKey, dataToCache, cacheOptions.ttl);
    }

    // 写入文件缓存
    if (cacheOptions.useFileCache) {
      FileCache.write(key, dataToCache, cacheOptions);
    }
  }

  /**
   * 删除缓存数据
   * @param {string} key - 缓存键
   * @param {Object|string} optionsOrNamespace - 选项或命名空间
   */
  delete(key, optionsOrNamespace = null) {
    const cacheOptions = this._resolveOptions(optionsOrNamespace);
    const fullKey = this._getFullKey(key, cacheOptions);

    // 删除内存缓存
    if (cacheOptions.useMemoryCache) {
      this.memoryCache.delete(fullKey);
    }

    // 删除文件缓存
    if (cacheOptions.useFileCache) {
      FileCache.delete(key, cacheOptions);
    }
  }
  
  /**
   * 清空整个命名空间的缓存
   * @param {string} namespace 命名空间
   */
  async clear(namespace = 'default') {
    const ns = this.namespaces.get(namespace);
    if (!ns) {
      throw new Error(`命名空间 ${namespace} 不存在`);
    }
    
    // 清空内存缓存中该命名空间的所有缓存
    if (ns.useMemoryCache) {
      const prefix = ns.cachePrefix || '';
      await this.memoryCache.clearByPrefix(prefix);
    }
    
    // 清空文件缓存中该命名空间的所有缓存
    if (ns.useFileCache && ns.cacheDir) {
      try {
        const files = await fs.promises.readdir(ns.cacheDir);
        const prefix = ns.cachePrefix || '';
        const extension = ns.extension || 'json';
        
        const deletePromises = files
          .filter(file => file.startsWith(prefix) && file.endsWith(`.${extension}`))
          .map(file => fs.promises.unlink(path.join(ns.cacheDir, file)));
        
        await Promise.all(deletePromises);
      } catch (error) {
        throw new Error(`清空文件缓存失败: ${error.message}`);
      }
    }
  }

  /**
   * 清除所有缓存
   */
  clearAll() {
    this.memoryCache.clear();
    // 注意：文件缓存不会自动清除，需要手动删除
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return this.memoryCache.getStats();
  }

  /**
   * 获取或设置缓存数据（支持回调函数获取数据）
   * @param {string} key - 缓存键
   * @param {Function} getDataFn - 获取数据的回调函数
   * @param {Object|string} optionsOrNamespace - 选项或命名空间
   * @param {Object} options - 获取选项
   * @returns {Promise<Object>} 缓存数据
   */
  async fetch(key, getDataFn, optionsOrNamespace = null, options = {}) {
    // 尝试从缓存获取
    const cachedData = this.get(key, optionsOrNamespace, {
      ...options,
      allowExpired: options.allowExpired !== false // 默认为true
    });
    
    if (cachedData !== null) {
      // 如果是过期数据且不允许使用过期数据，则继续获取新数据
      if (cachedData.expired && options.allowExpired === false) {
        // 不返回过期数据，继续获取新数据
      } else {
        return cachedData;
      }
    }

    try {
      // 缓存未命中或过期且不允许使用过期数据，执行回调获取数据
      const data = await getDataFn();
      
      // 存入缓存
      if (data !== null && data !== undefined) {
        // 解包数据（如果是已包装的格式）
        const dataToCache = (typeof data === 'object' && data !== null && 
                            'data' in data && 'timestamp' in data) ? data.data : data;
        this.set(key, dataToCache, optionsOrNamespace);
        
        // 返回包装格式的数据
        if (!options.returnRawData) {
          return {
            data: dataToCache,
            timestamp: Date.now()
          };
        }
      }
      
      return data;
    } catch (error) {
      // 获取数据失败时，如果允许使用过期数据，则尝试返回过期缓存
      if (options.allowExpired !== false) {
        const expiredCache = this.get(key, optionsOrNamespace, options, true);
        if (expiredCache !== null) {
          console.log(`Failed to fetch new data, using expired cache for key: ${key}`);
          return expiredCache;
        }
      }
      throw error;
    }
  }
}

// 创建并导出缓存管理器实例
const cacheManager = new CacheManager();

module.exports = {
  cacheManager,
  MemoryCache,
  FileCache
};
