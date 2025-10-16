const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = require('express').Router();

// API端点：获取节假日缓存
router.get('/cache', async (req, res) => {
  try {
    const cachePath = path.join(__dirname, '../../../data', 'holiday_cache.json');
    
    // 检查缓存文件是否存在
    try {
      await fs.access(cachePath);
      const cacheContent = await fs.readFile(cachePath, 'utf8');
      const cacheData = JSON.parse(cacheContent);
      res.json(cacheData);
    } catch (error) {
      // 缓存文件不存在或读取失败
      res.status(404).json({ success: false, message: '缓存不存在' });
    }
  } catch (error) {
    console.error('获取节假日缓存失败:', error);
    res.status(500).json({ success: false, message: '获取节假日缓存失败', error: error.message });
  }
});

// API端点：保存节假日缓存
router.post('/save', async (req, res) => {
  try {
    const cachePath = path.join(__dirname, '../../../data', 'holiday_cache.json');
    const cacheData = req.body;
    
    await fs.writeFile(cachePath, JSON.stringify(cacheData), 'utf8');
    res.json({ success: true, message: '节假日缓存保存成功' });
  } catch (error) {
    console.error('保存节假日缓存失败:', error);
    res.status(500).json({ success: false, message: '保存节假日缓存失败', error: error.message });
  }
});

// API端点：清除节假日缓存
router.post('/clear-cache', async (req, res) => {
  try {
    const cachePath = path.join(__dirname, '../../../data', 'holiday_cache.json');
    
    // 检查缓存文件是否存在，如果存在则删除
    try {
      await fs.access(cachePath);
      await fs.unlink(cachePath);
    } catch (error) {
      // 文件不存在，不需要处理
    }
    
    res.json({ success: true, message: '节假日缓存已清除' });
  } catch (error) {
    console.error('清除节假日缓存失败:', error);
    res.status(500).json({ success: false, message: '清除节假日缓存失败', error: error.message });
  }
});

module.exports = router;