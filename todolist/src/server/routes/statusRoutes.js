const express = require('express');
const router = express.Router();

// API端点：检查服务状态
router.get('/check-status', (req, res) => {
  res.status(200).json({ success: true, message: '服务正在运行' });
});

// API端点：关闭服务器
router.post('/shutdown', (req, res) => {
  console.log('收到关闭服务器请求');
  
  // 设置响应头以确保响应能够被正确处理
  res.setHeader('Connection', 'close');
  // 发送响应后再关闭服务器，给客户端足够的时间接收响应
  res.status(200).json({ success: true, message: '服务器将在1秒后关闭' });
  
  // 确保响应已发送
  res.on('finish', () => {
    console.log('响应已发送，准备关闭服务器...');
    
    // 延迟1秒后关闭服务器，确保所有请求都能完成处理
    setTimeout(() => {
      console.log('正在关闭服务器...');
      
      // 优雅地关闭服务器，确保所有连接都被正确关闭
      server.close((err) => {
        if (err) {
          console.error('服务器关闭过程中发生错误:', err);
          // 如果优雅关闭失败，强制退出
          process.exit(1);
        } else {
          console.log('服务器已成功关闭');
          process.exit(0);
        }
      });
      
      // 设置最大超时时间，确保服务器能够在特定时间内关闭
      setTimeout(() => {
        console.error('服务器关闭超时，强制退出');
        process.exit(1);
      }, 5000); // 5秒超时
    }, 1000);
  });
});

// 这个函数将在server.js中被调用，用于注入server实例
const setServerInstance = (serverInstance) => {
  global.server = serverInstance;
};

module.exports = { router, setServerInstance };