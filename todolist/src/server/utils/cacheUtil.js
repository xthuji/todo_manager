const fs = require('fs');
const path = require('path');
const { USE_CACHE, CACHE_DIR } = require('./constants');

/**
 * 提供内存缓存和文件缓存两级缓存功能
 * * 核心设计：
 * - 异步优先：所有文件I/O操作均为异步，返回Promise，避免阻塞事件循环。
 * - 自动刷新：支持loadData函数，在缓存未命中或过期时自动异步加载。
 * - 永久缓存：支持permanent标志，永久数据仅存留于内存中。
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
  }

  // 统一日志方法
  _log(level, message, meta = {}) {
    if (process.env.NODE_ENV === 'production' && level === 'debug') return;

    // 异步优先，移除[同步]/[异步]前缀
    if (level === 'error') {
      console.error(message);
      if (meta.error && process.env.NODE_ENV !== 'production') {
        console.error(meta.error.stack);
      }
    } else if (level === 'warn') {
      console.warn(message);
    } else if (level === 'debug') {
      console.debug(message);
    } else {
      console.log(message);
    }
  }

  // 创建缓存项的通用方法
  _createCacheItem(data, options, timestamp) {
    const { ttl = this.defaultTTL, permanent = false } = options;
    return {
      data,
      timestamp: timestamp || Date.now(),
      ttl,
      permanent
    };
  }

  // 保存缓存项的异步方法（唯一）
  async _saveCacheItem(key, cacheItem) {
    // 更新内存缓存
    this.memoryCache.set(key, cacheItem);

    // 只有非永久数据才写入文件缓存
    if (!cacheItem.permanent) {
      try {
        const filePath = this._getFilePath(key);
        const dir = path.dirname(filePath);
        // 异步按需创建目录
        await fs.promises.mkdir(dir, { recursive: true });
        await fs.promises.writeFile(filePath, JSON.stringify(cacheItem), 'utf8');
        return true;
      } catch (error) {
        this._log('error', `写入缓存文件失败: ${key}`, { error });
        return false;
      }
    }
    return true;
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
   * 同步获取缓存数据（仅数据）
   * 提供更简洁的接口，直接返回缓存的数据内容
   * 
   * @param {string} key 缓存键
   * @param {Object} options 选项 (见 getWrappedDataSync)
   * @returns {*} 缓存的数据，如果不存在则返回null
   * 
   * @example
   * // 基本使用 - 直接获取数据内容
   * const userSettings = cacheUtil.getDataSync('user_settings');
   * if (userSettings) {
   *   console.log('用户设置:', userSettings);
   * }
   * 
   * @usageScenario
   * - 简单的数据读取场景，只需获取数据内容
   * - 在同步代码环境中快速访问缓存
   * - 模块初始化时加载配置数据
   * 
   * @see getWrappedDataSync 获取完整的包装数据（包含过期状态等信息）
   */
  getDataSync(key, options = {}) {
    const wrappedData = this.getWrappedDataSync(key, options);
    return wrappedData ? wrappedData.data : null;
  }

  /**
   * 异步获取缓存数据（仅数据）
   * @param {string} key 缓存键
   * @param {Object} options 选项 (见 getWrappedData)
   * @returns {Promise<*>} 缓存的数据，如果不存在则返回null
   */
  async getData(key, options = {}) {
    const wrappedData = await this.getWrappedData(key, options);
    return wrappedData ? wrappedData.data : null;
  }

  /**
   * 从指定源文件同步加载数据
   * @private
   */
  _loadFromSourceFileSync(key, sourceFile, options, now) {
    try {
      this._log('debug', `尝试从源文件同步加载数据: key=${key}, file=${sourceFile}`);

      // 检查文件是否存在
      let stats;
      try {
        stats = fs.statSync(sourceFile);
      } catch {
        this._log('warn', `源文件不存在: ${sourceFile}`);
        return null;
      }

      const fileContent = fs.readFileSync(sourceFile, 'utf8');

      let fileData;
      try {
        fileData = JSON.parse(fileContent);
      } catch (parseError) {
        this._log('error', `解析源文件JSON失败: ${sourceFile}`, { error: parseError });
        return null;
      }

      let dataToReturn = fileData.data;
      let fileTimestamp = fileData.timestamp;
      let ttl = fileData.ttl;
      if (typeof dataToReturn === 'undefined' || typeof fileTimestamp === 'undefined' || typeof ttl === 'undefined') {
        dataToReturn = fileData;
        fileTimestamp = stats.mtimeMs || now;
        ttl = options.permanent && options.ttl === undefined ? 0 :
            (options.ttl !== undefined ? options.ttl : this.defaultTTL);
        this._log('debug', `检测到非缓存格式数据，进行转换: key=${key}`);
      }

      const isExpired = ttl !== 0 && now > fileTimestamp + ttl;

      if (!isExpired || options.allowExpired) {
        this._log('debug', `成功从源文件同步加载数据: key=${key}, 过期状态=${isExpired}`);

        const cacheItem = this._createCacheItem(dataToReturn, options, fileTimestamp);
        this.memoryCache.set(key, cacheItem);

        return {
          data: dataToReturn,
          timestamp: fileTimestamp,
          expired: isExpired,
          permanent: !!options.permanent
        };
      } else {
        this._log('debug', `数据已过期且不允许使用过期缓存: key=${key}`);
      }
    } catch (error) {
      this._log('error', `从源文件同步加载数据时出错: key=${key}, file=${sourceFile}`, { error });
    }
    return null;
  }

  /**
   * 从指定源文件异步加载数据
   * @private
   */
  async _loadFromSourceFile(key, sourceFile, options, now) {
    // 异步包装同步操作，复用同步实现
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          resolve(this._loadFromSourceFileSync(key, sourceFile, options, now));
        } catch (error) {
          this._log('error', `从源文件加载数据时出错: key=${key}, file=${sourceFile}`, { error });
          resolve(null);
        }
      }, 0);
    });
  }

  /**
   * 从默认缓存文件同步加载数据
   * @private
   */
  _loadFromDefaultCacheSync(key, options, now) {
    try {
      this._log('debug', `尝试从默认缓存文件同步加载数据: key=${key}`);

      const filePath = this._getFilePath(key);

      if (!fs.existsSync(filePath)) {
        this._log('debug', `默认缓存文件不存在: ${filePath}`);
        return null;
      }

      const fileContent = fs.readFileSync(filePath, 'utf8');

      let fileItem;
      try {
        fileItem = JSON.parse(fileContent);
      } catch (parseError) {
        this._log('error', `解析默认缓存文件JSON失败: ${filePath}`, { error: parseError });
        return null;
      }

      let fileData = fileItem.data;
      let fileTimestamp = fileItem.timestamp;
      let ttl = fileItem.ttl;
      const isExpired = ttl !== 0 && now > fileTimestamp + ttl;

      if (!isExpired || options.allowExpired) {
        // 同步到内存缓存
        this.memoryCache.set(key, { data: fileData, timestamp: fileTimestamp, ttl: ttl });

        this._log('debug', `成功从默认缓存文件同步加载数据: key=${key}, 过期状态=${isExpired}`);

        return {
          data: fileData,
          timestamp: fileTimestamp,
          expired: isExpired,
          permanent: !!fileItem.permanent
        };
      } else {
        this._log('debug', `数据已过期且不允许使用过期缓存: key=${key}`);
      }
    } catch (error) {
      this._log('error', `从默认缓存文件同步加载数据时出错: key=${key}`, { error });
    }
    return null;
  }

  /**
   * 从默认缓存文件异步加载数据
   * @private
   */
  async _loadFromDefaultCache(key, options, now) {
    // 异步包装同步操作，复用同步实现
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          resolve(this._loadFromDefaultCacheSync(key, options, now));
        } catch (error) {
          this._log('error', `从默认缓存文件加载数据时出错: key=${key}`, { error });
          resolve(null);
        }
      }, 0);
    });
  }

  /**
   * 从自定义加载函数异步加载数据（支持永久数据）
   * @private
   */
  async _loadFromCustomLoader(key, loadData, options, now, sourceFile) {
    try {
      this._log('debug', `尝试从自定义加载函数加载数据: key=${key}`);

      const data = await loadData();

      if (data === undefined || data === null) {
        this._log('warn', `自定义加载函数返回无效数据: key=${key}, 返回值=${data}`);
        return null;
      }

      this._log('debug', `成功从自定义加载函数获取数据: key=${key}`);

      const setResult = await this.setData(key, data, {
        ttl: options.ttl || this.defaultTTL,
        sourceFile,
        permanent: !!options.permanent
      });

      if (!setResult) {
        this._log('warn', `数据加载成功但缓存设置失败: key=${key}`);
      }

      return {
        data: data,
        timestamp: now,
        expired: false,
        permanent: !!options.permanent
      };
    } catch (error) {
      this._log('error', `从自定义加载函数加载数据时出错: key=${key}`, { error });
      return null;
    }
  }


  /**
   * 同步获取缓存数据（返回包装后的数据 {data, timestamp, expired}）
   * 核心功能：同步获取缓存，如缓存不存在或已过期，仅从文件系统读取
   * 
   * @param {string} key 缓存键
   * @param {Object} options 选项
   * @param {boolean} options.allowExpired 是否允许使用过期缓存
   * @param {string} options.sourceFile 可选的源文件路径，直接将该文件作为缓存文件使用
   * @param {number} options.ttl 可选的缓存过期时间
   * @returns {Object|null} 包装后的缓存数据 {data, timestamp, expired, permanent}
   * 
   * @note 同步版本不支持options.loadData，因为它需要异步操作
   * 
   * @example
   * // 基本使用 - 从内存或文件缓存同步获取数据
   * const wrappedData = cacheUtil.getWrappedDataSync('user_settings');
   * if (wrappedData) {
   *   console.log('数据:', wrappedData.data);
   *   console.log('是否过期:', wrappedData.expired);
   * }
   * 
   * @example
   * // 从指定源文件获取数据
   * const data = cacheUtil.getWrappedDataSync('config_data', {
   *   sourceFile: './config.json'
   * });
   * 
   * @example
   * // 允许使用过期数据
   * const cachedData = cacheUtil.getWrappedDataSync('stale_data', {
   *   allowExpired: true
   * });
   * 
   * @usageScenario
   * - 在需要同步代码环境中使用缓存（如模块初始化时）
   * - 在不支持异步操作的回调函数中使用缓存
   * - 简单的数据读取场景，不需要动态加载数据
   * 
   * @limitation
   * - 不支持options.loadData参数，无法在缓存不存在时动态加载数据
   * - 可能会阻塞事件循环，不推荐在高并发场景下频繁使用
   * - 文件操作失败时会记录错误并返回null
   */
  getWrappedDataSync(key, options = {}) {
    if (!USE_CACHE) return null;

    const { allowExpired = false, sourceFile = null } = options;
    const now = Date.now();

    // 1. 尝试从内存缓存获取（同步）
    const memoryItem = this.memoryCache.get(key);
    if (memoryItem) {
      const isExpired = memoryItem.ttl !== 0 && now > memoryItem.timestamp + memoryItem.ttl;

      if (!isExpired || allowExpired) {
        return {
          data: memoryItem.data,
          timestamp: memoryItem.timestamp,
          expired: isExpired,
          permanent: !!memoryItem.permanent
        };
      }
    }

    // 2. 尝试从文件缓存获取 (同步)
    let fileData;

    if (sourceFile) {
      fileData = this._loadFromSourceFileSync(key, sourceFile, options, now);
    } else {
      fileData = this._loadFromDefaultCacheSync(key, options, now);
    }

    // 3. 同步版本不支持loadData，因为它需要异步操作
    if (options.loadData && typeof options.loadData === 'function') {
      this._log('warn', `同步方法getWrappedDataSync不支持loadData参数，建议使用异步方法getWrappedData`);
    }

    return fileData;
  }

  /**
   * 异步获取缓存数据（返回包装后的数据 {data, timestamp, expired}）
   * 核心功能：异步获取缓存，如缓存不存在或已过期，可通过options.loadData异步加载数据并更新缓存
   * @param {string} key 缓存键
   * @param {Object} options 选项
   * @param {boolean} options.allowExpired 是否允许使用过期缓存
   * @param {string} options.sourceFile 可选的源文件路径，直接将该文件作为缓存文件使用
   * @param {Function} options.loadData 可选的自定义数据加载函数，当缓存不存在或已过期时调用
   * @param {number} options.ttl 可选的缓存过期时间，用于loadData加载的数据
   * @returns {Promise<Object|null>} 包装后的缓存数据 {data, timestamp, expired, permanent}
   */
  async getWrappedData(key, options = {}) {
    if (!USE_CACHE) return null;

    const { allowExpired = false, sourceFile = null } = options;
    const now = Date.now();

    // 1. 尝试从内存缓存获取（同步）
    const memoryItem = this.memoryCache.get(key);
    if (memoryItem) {
      const isExpired = memoryItem.ttl !== 0 && now > memoryItem.timestamp + memoryItem.ttl;

      if (!isExpired || allowExpired) {
        return {
          data: memoryItem.data,
          timestamp: memoryItem.timestamp,
          expired: isExpired,
          permanent: !!memoryItem.permanent
        };
      }
    }

    // 2. 尝试从文件缓存获取 (异步包装同步操作)
    let fileData = await new Promise((resolve) => {
      setTimeout(() => {
        try {
          if (sourceFile) {
            resolve(this._loadFromSourceFileSync(key, sourceFile, options, now));
          } else {
            resolve(this._loadFromDefaultCacheSync(key, options, now));
          }
        } catch (error) {
          this._log('error', `从文件缓存读取时出错: key=${key}`, { error });
          resolve(null);
        }
      }, 0);
    });

    if (fileData) {
      return fileData;
    }

    // 3. 尝试使用自定义数据加载函数 (异步)
    if (options.loadData && typeof options.loadData === 'function') {
      const customData = await this._loadFromCustomLoader(key, options.loadData, options, now, sourceFile);
      if (customData) {
        return customData;
      }
    }

    return null;
  }

  /**
   * 异步设置缓存数据
   * @param {string} key 缓存键
   * @param {*} data 要缓存的原始数据
   * @param {Object} options 选项
   * @param {number} options.ttl 过期时间（毫秒），0表示永不过期
   * @param {boolean} options.permanent 是否为永久数据（用户配置类型的数据）
   * @returns {Promise<boolean>} 是否设置成功
   */
  async setData(key, data, options = {}) {
    if (!USE_CACHE) return false;

    this._log('debug', `开始设置缓存数据: key=${key}`);

    try {
      const cacheItem = this._createCacheItem(data, options);
      return await this._saveCacheItem(key, cacheItem);
    } catch (error) {
      this._log('error', `设置缓存数据时发生错误: key=${key}`, { error });
      return false;
    }
  }

  /**
   * 异步删除缓存
   * @param {string} key 缓存键
   * @returns {Promise<boolean>} 是否删除成功
   */
  async delete(key) {
    try {
      // 1. 从内存缓存删除
      this.memoryCache.delete(key);

      // 2. 从文件缓存删除
      const filePath = this._getFilePath(key);
      await fs.promises.unlink(filePath).catch(err => {
        // 如果文件不存在，忽略错误
        if (err.code !== 'ENOENT') throw err;
      });

      return true;
    } catch (error) {
      this._log('error', `删除缓存失败: key=${key}`, { error });
      return false;
    }
  }

  /**
   * 异步检查缓存是否存在且未过期
   * @param {string} key 缓存键
   * @returns {Promise<boolean>} 是否存在且未过期
   */
  async has(key) {
    const wrappedData = await this.getWrappedData(key, { allowExpired: false });
    return wrappedData !== null && !wrappedData.expired;
  }

}

// 创建并导出默认缓存工具实例
const cacheUtil = new CacheUtil();

module.exports = {
  CacheUtil,
  cacheUtil
};