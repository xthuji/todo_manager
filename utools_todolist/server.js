// uTools插件服务器适配器
// 在uTools环境中提供本地API服务

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// 创建Express应用
const app = express();

// 中间件
app.use(cors());
app.use(express.json());

// 静态资源服务
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/pages', express.static(path.join(__dirname, 'pages')));
app.use(express.static(path.join(__dirname))); // 服务根目录下的静态文件

// API路由 - 适配原有的API结构
const fileRoutes = require('./server/routes/fileRoutes');
const holidayRoutes = require('./server/routes/holidayRoutes');
const festivalRoutes = require('./server/routes/festivalRoutes');
const weatherRoutes = require('./server/routes/weatherRoutes');
const statusRoutes = require('./server/routes/statusRoutes');

// 注入app实例到路由模块
app.locals.app = app;

// 注册API路由
app.use('/api/file', fileRoutes);
app.use('/api/holiday', holidayRoutes);
app.use('/api/festival', festivalRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/status', statusRoutes);

// 主页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 页面路由 - 支持直接访问页面文件
app.get(['/:page.html', '/:page'], (req, res) => {
    const pageName = req.params.page.endsWith('.html') ? req.params.page : req.params.page + '.html';
    const pagePath = path.join(__dirname, 'pages', pageName);
    
    // 检查文件是否存在
    if (fs.existsSync(pagePath)) {
        res.sendFile(pagePath);
    } else {
        res.status(404).send('页面未找到');
    }
});

// uTools插件特定路由
app.get('/utools', (req, res) => {
    res.json({
        status: 'success',
        message: 'uTools插件运行正常',
        version: '1.0.0'
    });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`uTools插件服务器运行在 http://127.0.0.1:${PORT}`);
    
    // 如果在uTools环境中，通知uTools插件已就绪
    if (typeof utools !== 'undefined') {
        console.log('uTools插件服务器已就绪');
    }
});

// 注入server实例到statusRoutes
if (statusRoutes.setServerInstance) {
    statusRoutes.setServerInstance(server);
}

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('收到SIGTERM信号，正在关闭服务器...');
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});

module.exports = app;