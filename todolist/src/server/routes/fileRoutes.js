const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

const DATA_DIR = path.join(__dirname, '../../../data');

// API端点：扫描todo文件
router.get('/scan', async (req, res) => {
  try {
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
    
    res.json({
      success: true,
      files: sortedFiles,
      defaultFile: defaultFile
    });
  } catch (error) {
    console.error('扫描文件失败:', error);
    res.status(500).json({ success: false, message: '扫描文件失败', error: error.message });
  }
});

// API端点：读取todo文件内容
router.get('/read/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    
    // 安全检查：确保请求的是符合命名规则的文件
    if (!filename.startsWith('todo') || !filename.endsWith('.txt')) {
      return res.status(403).json({ success: false, message: '不允许访问此文件' });
    }
    
    const filePath = path.join(DATA_DIR, filename);
    
    // 检查文件是否存在，如果不存在则创建空文件
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, '', 'utf8');
    }
    
    const content = await fs.readFile(filePath, 'utf8');
    res.json({ success: true, content: content });
  } catch (error) {
    console.error('读取文件失败:', error);
    res.status(500).json({ success: false, message: '读取文件失败', error: error.message });
  }
});

// API端点：写入todo文件内容
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
    res.json({ success: true, message: '文件保存成功' });
  } catch (error) {
    console.error('写入文件失败:', error);
    res.status(500).json({ success: false, message: '写入文件失败', error: error.message });
  }
});

module.exports = router;