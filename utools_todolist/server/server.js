// uTools插件服务器主文件
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// 导入配置管理器
const configManager = require('./utils/configManager');
// 加载配置
const config = configManager.getConfig();

// 创建Express应用
const app = express();
const PORT = process.env.PORT || configManager.getPort();
const HOST = configManager.getHost();

// 导入路由模块 - 修正导入方式
const fileRoutes = require('./routes/fileRoutes');
const holidayRoutes = require('./routes/holidayRoutes');
const festivalRoutes = require('./routes/festivalRoutes');
const statusRoutes = require('./routes/statusRoutes');
const weatherProxyRoutes = require('./routes/weatherRoutes');

// 获取setServerInstance函数
let setServerInstance;
if (statusRoutes.setServerInstance) {
    setServerInstance = statusRoutes.setServerInstance;
} else if (typeof statusRoutes === 'object' && statusRoutes.router && statusRoutes.router.setServerInstance) {
    setServerInstance = statusRoutes.router.setServerInstance;
} else {
    // 定义一个空函数作为兜底
    setServerInstance = function() { console.warn('setServerInstance not available'); };
}

// 中间件 - 合并更灵活的CORS配置
app.use(cors({
  origin: ['http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// 静态资源服务 - 适配当前项目结构
app.use('/assets', express.static(path.join(__dirname, '../assets')));
app.use('/pages', express.static(path.join(__dirname, '../pages')));
app.use(express.static(path.join(__dirname, '../'))); // 服务根目录下的静态文件

// 主页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// 页面路由 - 支持直接访问页面文件（更完善的版本）
app.get(['/:page.html', '/:page'], (req, res) => {
    const pageName = req.params.page.endsWith('.html') ? req.params.page : req.params.page + '.html';
    const pagePath = path.join(__dirname, '../pages', pageName);
    
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

// 注入app实例到路由模块
app.locals.app = app;

// 使用路由模块 - 适配不同的路由导出方式
app.use('/api/file', fileRoutes);
app.use('/api/holiday', holidayRoutes);
app.use('/api/festival', festivalRoutes);
// 适配statusRoutes可能的不同导出格式
if (statusRoutes.router) {
    app.use('/api/status', statusRoutes.router);
} else {
    app.use('/api/status', statusRoutes);
}
app.use('/api/weather', weatherProxyRoutes);

// 启动服务器
const server = app.listen(PORT, HOST, () => {
    console.log(`uTools插件服务器运行在 http://${HOST}:${PORT}`);
    
    // 如果在uTools环境中，通知uTools插件已就绪
    if (typeof utools !== 'undefined') {
        console.log('uTools插件服务器已就绪');
    }
});

// 注入服务器实例到状态路由模块
setServerInstance(server);

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('收到SIGTERM信号，正在关闭服务器...');
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});

// 导出app实例供其他模块使用
module.exports = app;