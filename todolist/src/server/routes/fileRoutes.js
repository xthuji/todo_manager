const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();
const { cacheManager } = require('../utils/cacheUtil');

// 数据目录配置
const DATA_DIR = path.join(__dirname, '../../../data');

// 创建文件缓存命名空间
cacheManager.createNamespace('fileCache', {
  cacheDir: path.join(__dirname, '../../../data/cache'),
  cachePrefix: 'file_',
  ttl: 300000, // 5分钟缓存
  extension: 'json',
  useMemoryCache: true,
  useFileCache: true
});

/**
 * 从缓存获取数据
 * @param {string} cacheKey 缓存键
 * @returns {Object|null} 缓存数据或null
 */
function getFromCache(cacheKey) {
  try {
    return cacheManager.get(cacheKey, 'fileCache');
  } catch (error) {
    console.error('从缓存读取失败:', error);
    return null;
  }
}

/**
 * 将数据保存到缓存
 * @param {string} cacheKey 缓存键
 * @param {Object} data 要缓存的数据
 */
function saveToCache(cacheKey, data) {
  try {
    cacheManager.set(cacheKey, data, 'fileCache');
  } catch (error) {
    console.error('保存到缓存失败:', error);
  }
}

/**
 * 清除文件相关缓存
 * @param {string} [specificFile] 特定文件名，不传则清除所有文件缓存
 */
function clearFileCache(specificFile = null) {
  try {
    if (specificFile) {
      // 清除特定文件的读取缓存
      cacheManager.delete(`read_${specificFile}`, 'fileCache');
    }
    // 总是清除文件列表缓存
    cacheManager.delete('file_list', 'fileCache');
  } catch (error) {
    console.error('清除文件缓存失败:', error);
  }
}

/**
 * 扫描文件接口
 * 优先从缓存获取文件列表，缓存不存在或已过期时扫描文件系统并更新缓存
 */
router.get('/scan', async (req, res) => {
  try {
    // 1. 尝试从缓存获取文件列表
    const cachedFiles = getFromCache('file_list');
    if (cachedFiles) {
      console.log('从缓存返回文件列表');
      return res.json({ data: cachedFiles, timestamp: Date.now() });
    }

    // 2. 缓存不存在，扫描文件系统
    // 读取data目录中的所有todo*.txt文件
    const files = await fs.readdir(DATA_DIR);
    const todoFiles = files.filter(file => file.startsWith('todo') && file.endsWith('.txt'));
    
    // 获取每个文件的信息（包括修改时间）
    const fileInfoPromises = todoFiles.map(async file => {
      try {
        const stats = await fs.stat(path.join(DATA_DIR, file));
        return {
          name: file,
          exists: true,
          mtime: stats.mtime.getTime() // 修改时间戳
        };
      } catch (error) {
        return {
          name: file,
          exists: false
        };
      }
    });
    
    const fileInfos = await Promise.all(fileInfoPromises);
    
    // 按修改时间降序排序（最新的文件在前）
    const sortedFiles = fileInfos.sort((a, b) => {
      if (!a.exists || !a.mtime) return 1;
      if (!b.exists || !b.mtime) return -1;
      return b.mtime - a.mtime;
    });
    
    // 如果有文件，默认选择最新的文件
    const defaultFile = sortedFiles.length > 0 && sortedFiles[0].exists ? sortedFiles[0].name : 'todo.txt';
    
    const responseData = {
      success: true,
      files: sortedFiles,
      defaultFile: defaultFile
    };
    
    // 更新缓存
    saveToCache('file_list', responseData);
    console.log('扫描文件并更新缓存');
    
    res.json({ data: responseData, timestamp: Date.now() });
  } catch (error) {
    console.error('扫描文件失败:', error);
    res.status(500).json({ error: { message: '扫描文件失败: ' + error.message } });
  }
});

/**
 * 读取文件内容接口
 * 优先从缓存获取文件内容，缓存不存在或已过期时从文件系统读取并更新缓存
 */
router.get('/read/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    
    // 安全检查：确保请求的是符合命名规则的文件
    if (!filename.startsWith('todo') || !filename.endsWith('.txt')) {
      return res.status(403).json({ success: false, message: '不允许访问此文件' });
    }
    
    // 1. 尝试从缓存获取文件内容
    const cacheKey = `read_${filename}`;
    const cachedContent = getFromCache(cacheKey);
    if (cachedContent) {
      console.log(`从缓存返回文件 ${filename} 的内容`);
      return res.json({ data: cachedContent, timestamp: Date.now() });
    }
    
    // 2. 缓存不存在，从文件系统读取
    const filePath = path.join(DATA_DIR, filename);
    
    // 检查文件是否存在，如果不存在则创建空文件
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, '', 'utf8');
    }
    
    const content = await fs.readFile(filePath, 'utf8');
    const responseData = { success: true, content: content };
    
    // 更新缓存
    saveToCache(cacheKey, responseData);
    console.log(`读取文件 ${filename} 并更新缓存`);
    
    res.json({ data: responseData, timestamp: Date.now() });
  } catch (error) {
      console.error('读取文件失败:', error);
      res.status(500).json({ error: { message: '读取文件失败: ' + error.message } });
    }
});

/**
 * 写入文件内容接口
 * 写入文件后清除相关缓存，确保数据一致性
 */
router.post('/write/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const content = req.body.content || '';
    
    // 安全检查：确保请求的是符合命名规则的文件
    if (!filename.startsWith('todo') || !filename.endsWith('.txt')) {
      return res.status(403).json({ success: false, message: '不允许访问此文件' });
    }
    
    const filePath = path.join(DATA_DIR, filename);
    await fs.writeFile(filePath, content, 'utf8');
    
    // 清除相关缓存，确保下次读取时获取最新数据
    clearFileCache(filename);
    console.log(`文件 ${filename} 保存成功，相关缓存已清除`);
    
    res.json({ success: true, message: '文件保存成功' });
  } catch (error) {
    console.error('写入文件失败:', error);
    res.status(500).json({ success: false, message: '写入文件失败', error: error.message });
  }
});

module.exports = router;