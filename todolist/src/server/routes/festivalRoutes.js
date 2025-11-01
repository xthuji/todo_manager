const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = require('express').Router();

const CONFIG_PATH = path.join(__dirname, '../../../data/config/festival_config.json');

// API端点：获取节日配置
router.get('/config', async (req, res) => {
  try {
    // 检查文件是否存在
    try {
      await fs.access(CONFIG_PATH);
      const configContent = await fs.readFile(CONFIG_PATH, 'utf8');
      const configData = JSON.parse(configContent);
      res.json(configData);
    } catch (error) {
      // 文件不存在或读取失败
      console.error('读取节日配置文件失败:', error);
      res.status(404).json({ success: false, message: '节日配置文件不存在或无法读取' });
    }
  } catch (error) {
    console.error('获取节日配置失败:', error);
    res.status(500).json({ success: false, message: '获取节日配置失败', error: error.message });
  }
});

// API端点：保存节日配置
router.post('/save', async (req, res) => {
  try {
    const configData = req.body;
    
    // 验证配置数据的基本结构
    if (!configData || typeof configData !== 'object') {
      return res.status(400).json({ success: false, message: '配置数据格式无效' });
    }
    
    // 确保必要的字段存在
    if (!Array.isArray(configData.festivals)) {
      return res.status(400).json({ success: false, message: 'festivals字段必须是数组' });
    }
    
    // 写入配置文件
    try {
      await fs.writeFile(CONFIG_PATH, JSON.stringify(configData, null, 2), 'utf8');
      console.log('节日配置文件保存成功');
      res.json({ success: true, message: '节日配置保存成功' });
    } catch (error) {
      console.error('写入节日配置文件失败:', error);
      res.status(500).json({ success: false, message: '写入配置文件失败', error: error.message });
    }
  } catch (error) {
    console.error('保存节日配置失败:', error);
    res.status(500).json({ success: false, message: '保存节日配置失败', error: error.message });
  }
});

module.exports = router;