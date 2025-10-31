// 引入Express模块
const express = require('express');
const path = require('path');
const app = express();
const port = 3001;

// 导入路由模块
const fileRoutes = require('./routes/fileRoutes');
const holidayRoutes = require('./routes/holidayRoutes');
const festivalRoutes = require('./routes/festivalRoutes');
const { router: statusRoutes, setServerInstance } = require('./routes/statusRoutes');
const weatherProxyRoutes = require('./routes/weatherRoutes');

// 中间件
app.use(express.json());

// 设置静态文件目录
express.static.mime.define({
  'application/javascript': ['js'],
  'text/css': ['css'],
  'text/html': ['html']
});

// 添加正确的静态文件目录映射
app.use('/assets', express.static(path.join(__dirname, '../client/assets')));
app.use(express.static(path.join(__dirname, '../../')));

// 特殊处理，支持直接访问pages目录下的HTML文件
app.get('/:filename.html', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../client/pages', `${filename}.html`);
  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).send('File not found');
    }
  });
});

// 处理根路径请求，返回index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/pages/index.html'));
});

// 使用路由模块
app.use('/api/file', fileRoutes);
app.use('/api/holiday', holidayRoutes);
app.use('/api/festival', festivalRoutes);
app.use('/api', statusRoutes);
app.use('/api/weather', weatherProxyRoutes);

// 启动服务器
const server = app.listen(port, () => {
  console.log(`待办事项管理系统已启动，访问 http://localhost:${port}`);
});

// 注入服务器实例到状态路由模块
setServerInstance(server);