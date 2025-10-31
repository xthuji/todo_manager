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
const CACHE_PATH = path.join(__dirname, '../../../data', 'holiday_cache.json');

// API端点：获取节假日缓存
router.get('/cache', async (req, res) => {
  try {
    const cachePath = CACHE_PATH;
    const now = Date.now();
    
    // 检查缓存文件是否存在
    try {
      await fs.access(cachePath);
      const cacheContent = await fs.readFile(cachePath, 'utf8');
      const cacheData = JSON.parse(cacheContent);
      
      // 检查缓存是否过期
      if (cacheData.expireAt && cacheData.expireAt < now) {
        console.log('节假日缓存已过期，尝试自动刷新');
        
        try {
          // 缓存过期，使用默认API重新获取数据
          const finalApiUrl = DEFAULT_HOLIDAY_API_URL;
          
          // 从API获取最新数据
          console.log(`从API获取节假日数据: ${finalApiUrl}`);
          const apiResponse = await fetch(finalApiUrl, {
            timeout: 10000, // 10秒超时
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (!apiResponse.ok) {
            throw new Error(`API响应错误: ${apiResponse.status}`);
          }
          
          const holidayData = await apiResponse.json();
          
          // 构建新的缓存数据对象
          const newCacheData = {
            data: holidayData,
            timestamp: now,
            expireAt: now + (HOLIDAY_CACHE_DAYS * 24 * 60 * 60 * 1000),
            apiUrl: finalApiUrl
          };
          
          // 保存到缓存文件
          await fs.writeFile(cachePath, JSON.stringify(newCacheData), 'utf8');
          console.log('节假日缓存已更新');
          
          // 返回新数据
          res.json(newCacheData);
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
    const cachePath = CACHE_PATH;
    const { apiUrl } = req.body;
    
    // 步骤1: 清除现有缓存
    try {
      // 检查文件是否存在并删除
      await fs.access(cachePath);
      await fs.unlink(cachePath);
      console.log('节假日缓存已清除');
    } catch (error) {
      // 文件不存在，不需要处理
      console.log('节假日缓存不存在，无需清除');
    }
    
    // 步骤2: 确定使用的API地址
    const finalApiUrl = apiUrl && apiUrl.trim() ? apiUrl.trim() : DEFAULT_HOLIDAY_API_URL;
    
    // 步骤3: 从API获取最新数据
    console.log(`从API获取节假日数据: ${finalApiUrl}`);
    const apiResponse = await fetch(finalApiUrl, {
      timeout: 10000, // 10秒超时
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!apiResponse.ok) {
      throw new Error(`API响应错误: ${apiResponse.status}`);
    }
    
    const holidayData = await apiResponse.json();
    const now = Date.now();
    
    // 步骤4: 构建缓存数据对象
    const cacheData = {
      data: holidayData,
      timestamp: now,
      expireAt: now + (HOLIDAY_CACHE_DAYS * 24 * 60 * 60 * 1000),
      apiUrl: finalApiUrl
    };
    
    // 步骤5: 保存到缓存文件
    await fs.writeFile(cachePath, JSON.stringify(cacheData), 'utf8');
    console.log('节假日缓存已重新保存');
    
    // 步骤6: 返回新数据给客户端
    res.json({
      success: true,
      message: '节假日缓存刷新成功',
      data: holidayData,
      timestamp: now
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