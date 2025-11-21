const fs = require('fs');
const path = require('path');
const { USE_CACHE, CACHE_DIR } = require('./constants');

/**
 * 提供内存缓存和文件缓存两级缓存功能
 * * 核心设计：
 * - 异步优先：所有文件I/O操作均为异步，返回Promise，避免阻塞事件循环。
 * - 自动刷新：支持loadDataFn函数，在缓存未命中或过期时自动异步加载。
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

  // 保存缓存项的同步方法（默认）
  _saveCacheItem(key, cacheItem) {
    // 更新内存缓存
    this.memoryCache.set(key, cacheItem);

    // 只有非永久数据才写入文件缓存
    if (!cacheItem.permanent) {
      try {
        const filePath = this._getFilePath(key);
        const dir = path.dirname(filePath);
        // 同步按需创建目录
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(cacheItem), 'utf8');
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
   * @param {Object} options 选项 (见 getWrappedData)
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
   * @see getWrappedData 获取完整的包装数据（包含过期状态等信息）
   */
  getData(key, options = {}) {
    const wrappedData = this.getWrappedData(key, options);
    return wrappedData ? wrappedData.data : null;
  }

  /**
   * 异步获取缓存数据（仅数据）- 异步版本
   * @param {string} key 缓存键
   * @param {Object} options 选项 (见 getWrappedDataAsync)
   * @returns {Promise<*>} 缓存的数据，如果不存在则返回null
   */
  async getDataAsync(key, options = {}) {
    const wrappedData = await this.getWrappedDataAsync(key, options);
    return wrappedData ? wrappedData.data : null;
  }

  /**
   * 从指定源文件同步加载数据
   * @private
   */
  _loadFromSourceFile(key, options, now) {
    const sourceFile = options.sourceFile;
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
      let ttl = fileData.ttl || options.permanent && options.ttl === undefined ? 0 :
          (options.ttl !== undefined ? options.ttl : this.defaultTTL);
      if (typeof dataToReturn === 'undefined' || typeof fileTimestamp === 'undefined') {
        dataToReturn = fileData;
        fileTimestamp = stats.mtimeMs || now;
        this._log('debug', `检测到非缓存格式数据，进行转换: key=${key}`);
      }

      const isExpired = ttl !== 0 && now > fileTimestamp + ttl;

      if (!isExpired || options.allowExpired) {
        this._log('debug', `成功从源文件同步加载数据: key=${key}, ${isExpired?'已过期':'未过期'}`);

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
   * 从默认缓存文件同步加载数据
   * @private
   */
  _loadFromDefaultCache(key, options, now) {
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

        this._log('debug', `成功从默认缓存文件同步加载数据: key=${key}, ${isExpired?'已过期':'未过期'}`);

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
   * 从自定义加载函数加载数据（同步）
   * @private
   */
  _loadFromCustomLoader(key, options) {
    try {
      this._log('debug', `尝试从自定义加载函数同步加载数据: key=${key}`);

      // 同步执行加载函数
      let data = options.loadDataFn();
      if (data === undefined || data === null) {
        this._log('warn', `自定义加载函数返回无效数据: key=${key}, 返回值=${data}`);
        return null;
      }

      this._log('debug', `成功从自定义加载函数获取数据: key=${key}`);

      // 使用同步方法设置缓存
      const setResult = this.setData(key, data, {
        ttl: options.ttl || this.defaultTTL,
        sourceFile: options.sourceFile,
        permanent: !!options.permanent
      });

      if (!setResult) {
        this._log('warn', `数据加载成功但缓存设置失败: key=${key}`);
      }

      return {
        data: data,
        timestamp: Date.now(),
        expired: false,
        permanent: !!options.permanent
      };
    } catch (error) {
      this._log('error', `从自定义加载函数同步加载数据时出错: key=${key}`, { error });
      return null;
    }
  }

  /**
   * 从自定义加载函数加载数据（异步）
   * @private
   */
  async _loadFromCustomLoaderAsync(key, options) {
    try {
      this._log('debug', `尝试从自定义加载函数异步加载数据: key=${key}`);

      // 异步执行加载函数
      let data = await options.loadDataFn();
      if (data === undefined || data === null) {
        this._log('warn', `自定义加载函数返回无效数据: key=${key}, 返回值=${data}`);
        return null;
      }

      this._log('debug', `成功从自定义加载函数获取数据: key=${key}`);

      // 使用异步方法设置缓存
      const setResult = this.setData(key, data, {
        ttl: options.ttl || this.defaultTTL,
        sourceFile: options.sourceFile,
        permanent: !!options.permanent
      });

      if (!setResult) {
        this._log('warn', `数据加载成功但缓存设置失败: key=${key}`);
      }

      return {
        data: data,
        timestamp: Date.now(),
        expired: false,
        permanent: !!options.permanent
      };
    } catch (error) {
      this._log('error', `从自定义加载函数异步加载数据时出错: key=${key}`, {error});
      return null;
    }
  }

  /**
   * 同步获取缓存数据（返回包装后的数据 {data, timestamp, expired}）- 默认方法
   * 核心功能：同步获取缓存，如缓存不存在或已过期，可通过options.loadDataFn同步加载数据并更新缓存
   * 
   * @param {string} key 缓存键
   * @param {Object} options 选项
   * @param {boolean} options.allowExpired 是否允许使用过期缓存
   * @param {string} options.sourceFile 可选的源文件路径，直接将该文件作为缓存文件使用
   * @param {boolean} options.permanent 可选的是否永久数据，用于sourceFile配置文件只读，不修改原文件
   * @param {Function} options.loadDataFn 可选的自定义数据加载函数，当缓存不存在或已过期时调用（必须是同步函数）
   * @param {number} options.ttl 可选的缓存过期时间，用于loadDataFn加载的数据
   * @returns {Object|null} 包装后的缓存数据 {data, timestamp, expired, permanent}
   * 
   * @example
   * // 基本使用 - 从内存或文件缓存同步获取数据
   * const wrappedData = cacheUtil.getWrappedData('user_settings');
   * if (wrappedData) {
   *   console.log('数据:', wrappedData.data);
   *   console.log('是否过期:', wrappedData.expired);
   * }
   * 
   * @example
   * // 从指定源文件获取数据
   * const data = cacheUtil.getWrappedData('config_data', {
   *   sourceFile: './config.json'
   * });
   * 
   * @example
   * // 允许使用过期数据
   * const cachedData = cacheUtil.getWrappedData('stale_data', {
   *   allowExpired: true
   * });
   * 
   * @example
   * // 使用同步loadDataFn加载数据
   * const data = cacheUtil.getWrappedData('dynamic_data', {
   *   loadDataFn: () => {
   *     // 同步加载数据的逻辑
   *     return { value: '动态加载的数据' };
   *   }
   * });
   * 
   * @usageScenario
   * - 在需要同步代码环境中使用缓存（如模块初始化时）
   * - 在不支持异步操作的回调函数中使用缓存
   * - 需要同步动态加载数据的场景
   * 
   * @limitation
   * - loadDataFn参数必须是同步函数，不支持返回Promise的异步函数
   * - 可能会阻塞事件循环，不推荐在高并发场景下频繁使用
   * - 文件操作失败时会记录错误并返回null
   */
  getWrappedData(key, options = {}) {
    if (!USE_CACHE) return null;
    const now = Date.now();
    const safeKey = this._getSafeKey(key);

    // 1. 尝试从内存缓存获取（同步）
    const memoryItem = this.memoryCache.get(safeKey);
    if (memoryItem) {
      const isExpired = memoryItem.ttl !== 0 && now > memoryItem.timestamp + memoryItem.ttl;

      if (!isExpired || options.allowExpired) {
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

    if (options.sourceFile) {
      fileData = this._loadFromSourceFile(safeKey, options, now);
    } else {
      fileData = this._loadFromDefaultCache(safeKey, options, now);
    }

    if (fileData) {
      return fileData;
    }

    // 3. 尝试使用自定义同步数据加载函数
    if (options.loadDataFn && typeof options.loadDataFn === 'function') {
      const customData = this._loadFromCustomLoader(safeKey, options);
      if (customData) {
        return customData;
      }
    }

    return null;
  }

  /**
   * 异步获取缓存数据（返回包装后的数据 {data, timestamp, expired}）
   * 核心功能：异步获取缓存，如缓存不存在或已过期，可通过options.loadDataFn异步加载数据并更新缓存
   * 
   * @param {string} key 缓存键
   * @param {Object} options 选项
   * @param {boolean} options.allowExpired 是否允许使用过期缓存
   * @param {string} options.sourceFile 可选的源文件路径，直接将该文件作为缓存文件使用
   * @param {boolean} options.permanent 可选的是否永久数据，用于sourceFile配置文件只读，不修改原文件
   * @param {Function} options.loadDataFn 可选的自定义数据加载函数，当缓存不存在或已过期时调用（支持返回Promise的异步函数）
   * @param {number} options.ttl 可选的缓存过期时间，用于loadDataFn加载的数据
   * @returns {Promise<Object|null>} 包装后的缓存数据 {data, timestamp, expired, permanent}
   *
   * @example
   * // 基本使用 - 从内存或文件缓存异步获取数据
   * const wrappedData = await cacheUtil.getWrappedDataAsync('user_settings');
   * if (wrappedData) {
   *   console.log('数据:', wrappedData.data);
   *   console.log('是否过期:', wrappedData.expired);
   * }
   *
   * @example
   * // 从指定源文件获取数据
   * const data = await cacheUtil.getWrappedDataAsync('config_data', {
   *   sourceFile: './config.json'
   * });
   *
   * @example
   * // 允许使用过期数据
   * const cachedData = await cacheUtil.getWrappedDataAsync('stale_data', {
   *   allowExpired: true
   * });
   *
   * @example
   * // 异步使用loadDataFn加载数据
   * const data = await cacheUtil.getWrappedDataAsync('dynamic_data', {
   *   loadDataFn: async () => {
   *     // 异步加载数据的逻辑
   *     return { value: '异步加载的数据' };
   *   }
   * });
   *
   * @usageScenario
   * - 在支持异步操作的环境中使用缓存
   * - 需要通过网络请求等异步操作加载数据的场景
   * - 不希望阻塞事件循环的高并发场景
   * 
   * @limitation
   * - 必须在异步函数中使用await关键字
   * - 文件操作失败时会记录错误并返回null
   */
  async getWrappedDataAsync(key, options = {}) {
    if (!USE_CACHE) return null;
    const now = Date.now();
    const safeKey = this._getSafeKey(key);

    // 1. 尝试从内存缓存获取（同步）
    const memoryItem = this.memoryCache.get(safeKey);
    if (memoryItem) {
      const isExpired = memoryItem.ttl !== 0 && now > memoryItem.timestamp + memoryItem.ttl;

      if (!isExpired || options.allowExpired) {
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

    if (options.sourceFile) {
      fileData = this._loadFromSourceFile(safeKey, options, now);
    } else {
      fileData = this._loadFromDefaultCache(safeKey, options, now);
    }

    if (fileData) {
      return fileData;
    }

    // 3. 尝试使用自定义同步数据加载函数
    if (options.loadDataFn && typeof options.loadDataFn === 'function') {
      const customData = await this._loadFromCustomLoaderAsync(safeKey, options);
      if (customData) {
        return customData;
      }
    }

    return null;
  }

  /**
   * 同步设置缓存数据（默认）
   * @param {string} key 缓存键
   * @param {*} data 要缓存的原始数据
   * @param {Object} options 选项
   * @param {number} options.ttl 过期时间（毫秒），0表示永不过期
   * @param {boolean} options.permanent 是否为永久数据（用户配置类型的数据）
   * @returns {boolean} 是否设置成功
   */
  setData(key, data, options = {}) {
    if (!USE_CACHE) return false;
    const safeKey = this._getSafeKey(key);
    this._log('debug', `开始设置缓存数据: key=${safeKey}`);

    try {
      const cacheItem = this._createCacheItem(data, options);
      return this._saveCacheItem(safeKey, cacheItem);
    } catch (error) {
      this._log('error', `设置缓存数据时发生错误: key=${safeKey}`, { error });
      return false;
    }
  }
  /**
   * 同步删除缓存（默认）
   * @param {string} key 缓存键
   * @returns {boolean} 是否删除成功
   */
  delete(key) {
    const safeKey = this._getSafeKey(key);
    this._log('debug', `开始删除缓存数据: key=${safeKey}`);
    try {
      // 1. 从内存缓存删除
      this.memoryCache.delete(safeKey);

      // 2. 从文件缓存删除
      const filePath = this._getFilePath(safeKey);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return true;
    } catch (error) {
      this._log('error', `删除缓存失败: key=${safeKey}`, { error });
      return false;
    }
  }

  /**
   * 同步检查缓存是否存在且未过期（默认）
   * @param {string} key 缓存键
   * @returns {boolean} 是否存在且未过期
   */
  has(key) {
    const wrappedData = this.getWrappedData(key, { allowExpired: false });
    return wrappedData !== null && !wrappedData.expired;
  }
}

// 创建并导出默认缓存工具实例
const cacheUtil = new CacheUtil();

module.exports = {
  CacheUtil,
  cacheUtil
};