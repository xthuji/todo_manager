const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const router = require('express').Router();

// 默认节假日API地址
const DEFAULT_HOLIDAY_API_URL = 'https://www.shuyz.com/githubfiles/china-holiday-calender/master/holidayAPI.json';
// 节假日缓存天数
const HOLIDAY_CACHE_DAYS = 100;
// 节假日缓存文件路径
const CACHE_PATH = path.join(__dirname, '../../../data/cache', 'holiday_cache.json');

/**
 * 从API获取节假日数据
 * @param {string} apiUrl - API地址
 * @returns {Promise<Object>} 节假日数据
 */
async function fetchHolidayData(apiUrl) {
  console.log(`从API获取节假日数据: ${apiUrl}`);
  const response = await fetch(apiUrl, {
    timeout: 10000, // 10秒超时
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`API响应错误: ${response.status}`);
  }
  
  return response.json();
}

/**
 * 构建缓存数据对象
 * @param {Object} data - 节假日数据
 * @param {string} apiUrl - 使用的API地址
 * @returns {Object} 缓存数据对象
 */
function buildCacheData(data, apiUrl) {
  const now = Date.now();
  return {
    data,
    timestamp: now,
    expireAt: now + (HOLIDAY_CACHE_DAYS * 24 * 60 * 60 * 1000),
    apiUrl
  };
}

/**
 * 清除缓存文件
 * @returns {Promise<void>}
 */
async function clearCacheFile() {
  try {
    await fs.access(CACHE_PATH);
    await fs.unlink(CACHE_PATH);
    console.log('节假日缓存已清除');
  } catch (error) {
    // 文件不存在，不需要处理
    console.log('节假日缓存不存在，无需清除');
  }
}

/**
 * 从API获取并保存数据到缓存
 * @param {string} apiUrl - API地址
 * @returns {Promise<Object>} 缓存数据对象
 */
async function fetchAndSaveHolidayData(apiUrl) {
  const holidayData = await fetchHolidayData(apiUrl);
  const cacheData = buildCacheData(holidayData, apiUrl);
  
  await fs.writeFile(CACHE_PATH, JSON.stringify(cacheData), 'utf8');
  console.log('节假日缓存已保存');
  
  return cacheData;
}

// API端点：获取节假日缓存
router.get('/cache', async (req, res) => {
  try {
    const now = Date.now();
    
    // 检查缓存文件是否存在
    try {
      await fs.access(CACHE_PATH);
      const cacheContent = await fs.readFile(CACHE_PATH, 'utf8');
      const cacheData = JSON.parse(cacheContent);
      
      // 检查缓存是否过期
      if (cacheData.expireAt && cacheData.expireAt < now) {
        console.log('节假日缓存已过期，尝试自动刷新');
        
        try {
          // 缓存过期，使用默认API重新获取数据
          const cacheData = await fetchAndSaveHolidayData(DEFAULT_HOLIDAY_API_URL);
          res.json(cacheData);
        } catch (fetchError) {
          // 无法获取新数据，返回旧数据并标记为已过期
          console.error('自动刷新缓存失败，返回过期数据作为兜底:', fetchError);
          res.json({
            ...cacheData,
            expired: true,
            expiredTime: cacheData.expireAt,
            currentTime: now
          });
        }
      } else {
        // 缓存未过期，直接返回
        res.json(cacheData);
      }
    } catch (error) {
      // 缓存文件不存在或读取失败
      res.status(404).json({ success: false, message: '缓存不存在' });
    }
  } catch (error) {
    console.error('获取节假日缓存失败:', error);
    res.status(500).json({ success: false, message: '获取节假日缓存失败', error: error.message });
  }
});

// API端点：刷新节假日缓存（清理、重新获取、保存并返回新数据）
router.post('/refresh-cache', async (req, res) => {
  try {
    const { apiUrl } = req.body;
    
    // 步骤1: 清除现有缓存
    await clearCacheFile();
    
    // 步骤2: 确定使用的API地址
    const finalApiUrl = apiUrl && apiUrl.trim() ? apiUrl.trim() : DEFAULT_HOLIDAY_API_URL;
    
    // 步骤3: 从API获取并保存新数据
    const cacheData = await fetchAndSaveHolidayData(finalApiUrl);
    
    // 步骤4: 返回新数据给客户端
    res.json({
      success: true,
      message: '节假日缓存刷新成功',
      data: cacheData.data,
      timestamp: cacheData.timestamp
    });
    
  } catch (error) {
    console.error('刷新节假日缓存失败:', error);
    res.status(500).json({
      success: false,
      message: '刷新节假日缓存失败',
      error: error.message
    });
  }
});

module.exports = router;