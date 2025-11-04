const fs = require('fs');
const path = require('path');
const { USE_CACHE, CACHE_DIR } = require('./constants');

/**
 * 两级缓存工具类
 * 提供内存缓存和文件缓存两级缓存功能
 */
class CacheUtil {
  /**
   * 构造函数
   * @param {Object} options 配置选项
   * @param {string} options.cacheDir 缓存文件目录
   * @param {number} options.defaultTTL 默认过期时间（毫秒），0表示永不过期
   * @param {string} options.fileExtension 缓存文件扩展名
   */
  constructor(options = {}) {
    this.memoryCache = new Map();
    this.cacheDir = options.cacheDir || CACHE_DIR;
    this.defaultTTL = options.defaultTTL || 3600000; // 默认1小时
    this.fileExtension = options.fileExtension || 'json';
    
    // 确保缓存目录存在
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * 生成安全的缓存键名
   * @param {string} key 原始键名
   * @returns {string} 安全的键名
   */
  _getSafeKey(key) {
    return key.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  /**
   * 获取缓存文件路径
   * @param {string} key 缓存键
   * @returns {string} 文件路径
   */
  _getFilePath(key) {
    const safeKey = this._getSafeKey(key);
    return path.join(this.cacheDir, `${safeKey}.${this.fileExtension}`);
  }

  /**
   * 获取缓存数据（返回原始数据）
   * @param {string} key 缓存键
   * @param {Object} options 选项
   * @param {boolean} options.allowExpired 是否允许使用过期缓存
   * @param {string} options.sourceFile 可选的源文件路径，用于永久缓存
   * @returns {*} 缓存的原始数据，如果不存在或已过期且不允许使用过期数据则返回null
   */
  getData(key, options = {}) {
    const wrappedData = this.getWrappedData(key, options);
    return wrappedData ? wrappedData.data : null;
  }

  /**
   * 获取缓存数据（返回包装后的数据 {data, timestamp}）
   * @param {string} key 缓存键
   * @param {Object} options 选项
   * @param {boolean} options.allowExpired 是否允许使用过期缓存
   * @param {string} options.sourceFile 可选的源文件路径，用于永久缓存
   * @returns {Object|null} 包装后的缓存数据 {data, timestamp}，如果不存在或已过期且不允许使用过期数据则返回null
   */
  getWrappedData(key, options = {}) {
    if (!USE_CACHE) return null;
    
    const { allowExpired = false, sourceFile = null } = options;
    const now = Date.now();
    
    // 1. 尝试从内存缓存获取
    const memoryItem = this.memoryCache.get(key);
    if (memoryItem) {
      // 检查是否过期
      const isExpired = memoryItem.ttl !== 0 && now > memoryItem.timestamp + memoryItem.ttl;
      
      if (!isExpired || allowExpired) {
        return {
          data: memoryItem.data,
          timestamp: memoryItem.timestamp,
          expired: isExpired
        };
      }
    }
    
    // 2. 尝试从文件缓存获取
    try {
      const filePath = this._getFilePath(key);
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const fileItem = JSON.parse(fileContent);
        
        // 检查是否过期
        const isExpired = fileItem.ttl !== 0 && now > fileItem.timestamp + fileItem.ttl;
        
        if (!isExpired || allowExpired) {
          // 同步到内存缓存
          this.memoryCache.set(key, {
            data: fileItem.data,
            timestamp: fileItem.timestamp,
            ttl: fileItem.ttl
          });
          
          return {
            data: fileItem.data,
            timestamp: fileItem.timestamp,
            expired: isExpired
          };
        }
      }
    } catch (error) {
      console.error(`Error reading cache file for key '${key}':`, error);
    }
    
    // 3. 尝试从源文件获取（用于永久缓存）
    if (sourceFile && fs.existsSync(sourceFile)) {
      try {
        const sourceContent = fs.readFileSync(sourceFile, 'utf8');
        const sourceData = JSON.parse(sourceContent);
        
        // 源文件作为永久缓存
        const dataToCache = sourceData.data || sourceData; // 支持直接数据或 {data, ...} 格式
        
        // 写入内存缓存和文件缓存
        this.setData(key, dataToCache, { ttl: 0 });
        
        return {
          data: dataToCache,
          timestamp: now,
          expired: false
        };
      } catch (error) {
        console.error(`Error reading source file '${sourceFile}':`, error);
      }
    }
    
    return null;
  }

  /**
   * 设置缓存数据
   * @param {string} key 缓存键
   * @param {*} data 要缓存的原始数据
   * @param {Object} options 选项
   * @param {number} options.ttl 过期时间（毫秒），0表示永不过期
   * @returns {boolean} 是否设置成功
   */
  setData(key, data, options = {}) {
    if (!USE_CACHE) return false;
    
    const { ttl = this.defaultTTL } = options;
    const timestamp = Date.now();
    const cacheItem = {
      data,
      timestamp,
      ttl
    };
    
    try {
      // 1. 写入内存缓存
      this.memoryCache.set(key, cacheItem);
      
      // 2. 写入文件缓存
      const filePath = this._getFilePath(key);
      fs.writeFileSync(filePath, JSON.stringify(cacheItem), 'utf8');
      
      return true;
    } catch (error) {
      console.error(`Error setting cache for key '${key}':`, error);
      return false;
    }
  }

  /**
   * 删除缓存
   * @param {string} key 缓存键
   * @returns {boolean} 是否删除成功
   */
  delete(key) {
    try {
      // 1. 从内存缓存删除
      this.memoryCache.delete(key);
      
      // 2. 从文件缓存删除
      const filePath = this._getFilePath(key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      return true;
    } catch (error) {
      console.error(`Error deleting cache for key '${key}':`, error);
      return false;
    }
  }

  /**
   * 清空所有缓存
   */
  clear() {
    try {
      // 1. 清空内存缓存
      this.memoryCache.clear();
      
      // 2. 清空文件缓存
      const files = fs.readdirSync(this.cacheDir);
      files
        .filter(file => file.endsWith(`.${this.fileExtension}`))
        .forEach(file => {
          try {
            fs.unlinkSync(path.join(this.cacheDir, file));
          } catch (error) {
            console.error(`Error deleting cache file '${file}':`, error);
          }
        });
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * 检查缓存是否存在且未过期
   * @param {string} key 缓存键
   * @returns {boolean} 是否存在且未过期
   */
  has(key) {
    const wrappedData = this.getWrappedData(key, { allowExpired: false });
    return wrappedData !== null && !wrappedData.expired;
  }

  /**
   * 获取或创建缓存（如果缓存不存在则使用提供的函数创建）
   * @param {string} key 缓存键
   * @param {Function} createFn 创建缓存数据的函数
   * @param {Object} options 选项
   * @param {number} options.ttl 过期时间（毫秒）
   * @param {boolean} options.allowExpired 是否允许使用过期缓存
   * @returns {Promise<*>} 缓存的原始数据
   */
  async getOrCreate(key, createFn, options = {}) {
    // 尝试获取现有缓存
    const wrappedData = this.getWrappedData(key, {
      allowExpired: options.allowExpired !== false
    });
    
    if (wrappedData && !wrappedData.expired) {
      return wrappedData.data;
    }
    
    try {
      // 缓存不存在或已过期，创建新数据
      const newData = await createFn();
      
      // 保存到缓存
      if (newData !== null && newData !== undefined) {
        this.setData(key, newData, {
          ttl: options.ttl !== undefined ? options.ttl : this.defaultTTL
        });
      }
      
      return newData;
    } catch (error) {
      // 如果允许使用过期缓存，且存在过期缓存，则返回过期缓存
      if (options.allowExpired !== false && wrappedData) {
        console.log(`Failed to create new cache data, using expired cache for key: ${key}`);
        return wrappedData.data;
      }
      
      throw error;
    }
  }

  /**
   * 从源文件创建永久缓存
   * @param {string} key 缓存键
   * @param {string} sourceFilePath 源文件路径
   * @returns {boolean} 是否创建成功
   */
  createFromSource(key, sourceFilePath) {
    if (!fs.existsSync(sourceFilePath)) {
      console.error(`Source file not found: ${sourceFilePath}`);
      return false;
    }
    
    try {
      const content = fs.readFileSync(sourceFilePath, 'utf8');
      const data = JSON.parse(content);
      
      // 支持直接数据或 {data, ...} 格式
      const dataToCache = data.data || data;
      
      // 创建永久缓存
      return this.setData(key, dataToCache, { ttl: 0 });
    } catch (error) {
      console.error(`Error creating cache from source file '${sourceFilePath}':`, error);
      return false;
    }
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计信息
   */
  getStats() {
    return {
      memoryCacheSize: this.memoryCache.size,
      fileCacheSize: this._getFileCacheSize()
    };
  }

  /**
   * 获取文件缓存数量
   * @private
   * @returns {number} 文件缓存数量
   */
  _getFileCacheSize() {
    try {
      const files = fs.readdirSync(this.cacheDir);
      return files.filter(file => file.endsWith(`.${this.fileExtension}`)).length;
    } catch (error) {
      console.error('Error getting file cache size:', error);
      return 0;
    }
  }
}

// 创建并导出默认缓存工具实例
const cacheUtil = new CacheUtil();

module.exports = {
  CacheUtil,
  cacheUtil
};
