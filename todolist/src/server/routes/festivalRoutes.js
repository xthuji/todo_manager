const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = require('express').Router();
const { cacheManager } = require('../utils/cacheUtil');

// 配置路径
const FESTIVAL_CONFIG_PATH = path.join(__dirname, '../../../data/config/festival_config.json');

// 初始化节日配置缓存
// 缓存1小时
const CACHE_OPTIONS = {
  ttl: 3600000,
  isPermanent: false
};

try {
  cacheManager.createNamespace('festivalConfig', CACHE_OPTIONS);
} catch (error) {
  console.error('初始化节日配置缓存失败:', error.message);
}

/**
 * 从缓存获取配置数据
 * @returns {Promise<Object|null>} 配置数据或null
 */
const CACHE_KEY = 'config';
async function getConfigFromCache() {
  try {
    return await cacheManager.get(CACHE_KEY, 'festivalConfig', { returnRawData: true });
  } catch (error) {
    console.error('从缓存获取节日配置失败:', error.message);
    return null;
  }
}

/**
 * 将配置数据保存到缓存
 * @param {Object} data 配置数据
 */
async function saveConfigToCache(data) {
  try {
    await cacheManager.set(CACHE_KEY, data, 'festivalConfig', { returnRawData: true });
    return true;
  } catch (error) {
    console.error('保存节日配置到缓存失败:', error.message);
    return false;
  }
}

/**
 * 清除配置缓存
 */
async function clearConfigCache() {
  try {
    await cacheManager.clear('festivalConfig');
    return true;
  } catch (error) {
    console.error('清除节日配置缓存失败:', error.message);
    return false;
  }
}

/**
 * 获取节日配置接口
 * 优先从缓存获取，如果缓存不存在或已过期则从文件读取并更新缓存
 */
router.get('/config', async (req, res) => {
  try {
    // 尝试从缓存获取配置
    const cachedConfig = await getConfigFromCache();
    if (cachedConfig) {
      return res.json({
        data: cachedConfig,
        timestamp: Date.now(),
        error: null
      });
    }

    // 缓存未命中，从文件读取
    try {
      await fs.access(FESTIVAL_CONFIG_PATH);
      const configContent = await fs.readFile(FESTIVAL_CONFIG_PATH, 'utf8');
      const configData = JSON.parse(configContent);
      
      // 更新缓存
      await saveConfigToCache(configData);
      
      console.log('从文件读取并缓存节日配置');
      res.json({ data: configData, timestamp: Date.now() });
    } catch (error) {
      // 文件不存在或读取失败
      console.error('读取节日配置文件失败:', error);
      res.status(404).json({ data: null, timestamp: Date.now(), error: { message: '节日配置文件不存在或无法读取' } });
    }
  } catch (error) {
    console.error('获取节日配置失败:', error);
    res.status(500).json({ data: null, timestamp: Date.now(), error: { message: '获取节日配置失败: ' + error.message } });
  }
});

/**
 * 保存节日配置接口
 * 保存配置后清除缓存，确保下次读取时获取最新数据
 */
router.post('/save', async (req, res) => {
  try {
    const configData = req.body;
    
    // 验证配置数据的基本结构
    if (!configData || typeof configData !== 'object') {
      return res.status(400).json({ data: null, timestamp: Date.now(), error: { message: '配置数据格式无效' } });
    }
    
    // 确保必要的字段存在
    if (!Array.isArray(configData.festivals)) {
      return res.status(400).json({ data: null, timestamp: Date.now(), error: { message: 'festivals字段必须是数组' } });
    }
    
    // 写入配置文件
    try {
      // 确保目录存在
      const configDir = path.dirname(CONFIG_PATH);
      try {
        await fs.access(configDir);
      } catch (error) {
        await fs.mkdir(configDir, { recursive: true });
      }
      
      await fs.writeFile(CONFIG_PATH, JSON.stringify(configData, null, 2), 'utf8');
      
      // 清除缓存，确保下次读取时获取最新数据
      await clearConfigCache();
      
      console.log('节日配置文件保存成功，缓存已清除');
      res.json({ data: { success: true, message: '节日配置保存成功' }, timestamp: Date.now() });
    } catch (error) {
      console.error('写入节日配置文件失败:', error);
      res.status(500).json({ data: null, timestamp: Date.now(), error: { message: '写入配置文件失败: ' + error.message } });
    }
  } catch (error) {
    console.error('保存节日配置失败:', error);
    res.status(500).json({ data: null, timestamp: Date.now(), error: { message: '保存节日配置失败: ' + error.message } });
  }
});

module.exports = router;