const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const fs = require('fs');
const router = express.Router();
const { cacheUtil } = require('../utils/cacheUtil');

// 配置常量
const DEFAULT_HOLIDAY_API_URL= 'https://www.shuyz.com/githubfiles/china-holiday-calender/master/holidayAPI.json';
const CACHE_KEY = 'holiday_cache';
const TTL = 100 * 24 * 3600 * 1000; // 缓存有效期100天
const HOLIDAY_OPTIONS = {
  allowExpired: true, // 允许使用过期缓存作为兜底
  sourceFile: path.join(__dirname, '../../../data/cache/holiday_cache.json'),
  ttl: TTL,
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
      timeout: 10000,
      headers: {'Content-Type': 'application/json'}
    });

    if (!response.ok) {
      throw new Error(`API响应错误: ${response.status}`);
    }

    const data = response.json();

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
    cacheUtil.delete(CACHE_KEY);
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
async function getHolidayData(apiUrl = DEFAULT_HOLIDAY_API_URL) {
  try {
    // 创建同步数据加载函数，内部处理异步API调用
    // 使用getWrappedData获取缓存，并提供loadData选项用于缓存未命中时的数据加载
    const wrappedData = cacheUtil.getWrappedData(CACHE_KEY, {
      // ... HOLIDAY_OPTIONS,
      allowExpired: true, // 允许使用过期缓存作为兜底
      sourceFile: path.join(__dirname, '../../../data/cache/holiday_cache.json'),
      ttl: TTL,
      loadData: function () {
        console.log('[节假日服务] 缓存未命中或需要更新，从API获取数据');
        // 返回Promise，让getWrappedData能够识别并异步处理
        return fetchHolidayData(apiUrl);
      }
    });
    
    // 处理缓存结果
    if (!wrappedData) {
      // 如果没有获取到缓存数据（无论是同步还是异步情况），抛出错误。因为loadData已经在getWrappedData中被调用，如果仍然返回null，说明加载失败
      throw new Error('无法获取节假日数据');
    }

    const holidayData = wrappedData.data;
    // 检查是否使用了过期缓存
    if (wrappedData.expired) {
      console.log('[节假日服务] 使用过期缓存数据');
    }

    // 返回标准格式的响应
    return {
      data: holidayData,
      timestamp: wrappedData.timestamp,
      apiUrl: apiUrl,
      expireAt: !wrappedData.expired ? wrappedData.timestamp + TTL : Date.now()
    };
  } catch (error) {
    console.error(`[节假日服务] 获取数据失败: ${error.message}`);
    throw error;
  }
}



// 不需要单独初始化缓存命名空间，直接使用cacheUtil即可

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
    const finalApiUrl = apiUrl && apiUrl.trim() ? apiUrl.trim() : DEFAULT_HOLIDAY_API_URL;
    
    // 清除现有缓存
    await clearHolidayCache();
    
    // 从API获取并保存新数据
    const cacheData = await getHolidayData(finalApiUrl);
    
    // 返回成功响应
    res.json({
      ... cacheData,
      success: true,
      message: '节假日缓存刷新成功',
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