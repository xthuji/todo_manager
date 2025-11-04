const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const fs = require('fs');
const router = express.Router();
const { cacheManager } = require('../utils/cacheUtil');

// 配置常量
const CONFIG = {
  DEFAULT_HOLIDAY_API_URL: 'https://www.shuyz.com/githubfiles/china-holiday-calender/master/holidayAPI.json',
  HOLIDAY_CACHE_DAYS: 100,
  CACHE_KEY: 'holiday_cache',
  CACHE_DIR: path.join(__dirname, '../../../data/cache'),
  API_TIMEOUT: 10000
};

// 计算缓存TTL
const TTL = CONFIG.HOLIDAY_CACHE_DAYS * 24 * 60 * 60 * 1000;

// 缓存配置选项
const CACHE_OPTIONS = {
  cacheDir: CONFIG.CACHE_DIR,
  cachePrefix: '',
  extension: 'json',
  ttl: TTL,
  useFileCache: true,
  useMemoryCache: true
};

// 初始化缓存命名空间
function initCache() {
  try {
    cacheManager.createNamespace('holiday', CACHE_OPTIONS);
    // 仅在调试模式下输出详细配置
    // console.log('节假日缓存命名空间配置:', cacheManager.getNamespaceOptions('holiday'));
  } catch (error) {
    console.error('初始化缓存命名空间失败:', error.message);
  }
}

/**
 * 从API获取节假日数据
 * @param {string} apiUrl - API地址
 * @returns {Promise<Object>} 节假日数据
 * @throws {Error} 当获取数据失败时抛出错误
 */
async function fetchHolidayData(apiUrl) {
  try {
    console.log(`[节假日服务] 从API获取数据: ${apiUrl}`);
    const response = await fetch(apiUrl, {
      timeout: CONFIG.API_TIMEOUT,
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`API响应错误: ${response.status}`);
    }
    
    const data = await response.json();
    
    // 验证数据质量
    if (!data || typeof data !== 'object') {
      throw new Error('获取到的节假日数据格式错误');
    }
    
    // 记录数据基本信息（减少冗余日志）
    const years = data.Years && typeof data.Years === 'object' 
      ? Object.keys(data.Years).filter(key => !isNaN(parseInt(key)))
      : Object.keys(data).filter(key => !isNaN(parseInt(key)));
    
    console.log(`[节假日服务] 成功获取数据，包含${years.length}个年份`);
    return data;
  } catch (error) {
    console.error(`[节假日服务] API获取数据失败: ${error.message}`);
    throw error;
  }
}

/**
 * 清除节假日缓存
 * @returns {boolean} 是否成功清除缓存
 */
async function clearHolidayCache() {
  try {
    await cacheManager.delete(CONFIG.CACHE_KEY);
    console.log('[节假日服务] 缓存已清除');
    return true;
  } catch (error) {
    console.warn('[节假日服务] 缓存清除失败或缓存不存在:', error.message);
    return false;
  }
}

/**
 * 获取节假日数据（优先缓存，缓存未命中时从API获取）
 * @param {string} [apiUrl] - 可选的API地址，默认使用配置的地址
 * @returns {Promise<Object>} 包含data、timestamp、expireAt、apiUrl的节假日数据对象
 */
async function getHolidayData(apiUrl = CONFIG.DEFAULT_HOLIDAY_API_URL) {
  try {
    // 使用cacheManager的fetch方法，设置allowExpired=true以支持过期缓存作为兜底
    const result = await cacheManager.fetch(
      CONFIG.CACHE_KEY,
      async () => {
        // 缓存未命中或过期，从API获取数据
        console.log('[节假日服务] 缓存未命中或需要更新，从API获取数据');
        const holidayData = await fetchHolidayData(apiUrl);
        return holidayData;
      },
      CACHE_OPTIONS,
      true, // returnRawData=true，获取原始数据
      true  // allowExpired=true，允许使用过期缓存作为兜底
    );
    
    const currentTime = Date.now();
    
    // 构建统一的响应格式
    return {
      data: result,
      timestamp: currentTime,
      expireAt: currentTime + TTL,
      apiUrl
    };
  } catch (error) {
    console.error(`[节假日服务] 获取数据失败: ${error.message}`);
    throw error;
  }
}



// 初始化缓存
initCache();

/**
 * API端点：获取节假日缓存
 * 返回格式：{data, timestamp, expireAt, apiUrl} 或 失败时使用过期缓存
 */
router.get('/cache', async (req, res) => {
  try {
    // 获取节假日数据（内部已处理缓存和兜底逻辑）
    const holidayData = await getHolidayData();
    
    // 返回标准格式的数据
    res.json(holidayData);
  } catch (error) {
    // 最后的兜底方案
    res.status(500).json({
      data: null,
      timestamp: Date.now(),
      error: {
        message: '获取节假日数据失败',
        details: error.message
      }
    });
  }
});

/**
 * API端点：刷新节假日缓存
 * 返回格式：{success, message, data, timestamp}
 */
router.post('/refresh-cache', async (req, res) => {
  try {
    // 获取请求参数
    const { apiUrl } = req.body || {};
    const finalApiUrl = apiUrl && apiUrl.trim() ? apiUrl.trim() : CONFIG.DEFAULT_HOLIDAY_API_URL;
    
    // 清除现有缓存
    await clearHolidayCache();
    
    // 从API获取并保存新数据
    const cacheData = await getHolidayData(finalApiUrl);
    
    // 返回成功响应
    res.json({
      success: true,
      message: '节假日缓存刷新成功',
      data: cacheData.data,
      timestamp: cacheData.timestamp
    });
  } catch (error) {
    console.error(`[节假日服务] 刷新缓存失败: ${error.message}`);
    
    res.status(500).json({
      success: false,
      message: '刷新节假日缓存失败',
      error: error.message
    });
  }
});

module.exports = router;