# uTools任务和节日管理系统插件

一个功能强大的uTools平台插件，集成了任务管理、节日管理、日历视图和天气查询功能，为用户提供高效的个人管理解决方案。

## ✨ 功能特性

### 📝 **任务管理器**
- ✅ 创建、编辑、删除待办任务
- 🏷️ 任务分类和优先级设置
- 📊 任务进度跟踪和统计
- 💾 本地数据持久化存储

### 🎉 **节日管理**
- 🏮 传统节日信息查询
- 🌅 二十四节气显示
- 📅 节假日工作日判断
- 🎯 自定义节日提醒

### 📅 **日历视图**
- 📆 直观的月历界面
- 📍 任务和节日标记显示
- 🔄 快速日期导航
- 🎨 美观的界面设计

### 🌤️ **天气查询**
- 🌡️ 实时天气信息
- 🌈 多日天气预报
- 📍 支持多地区查询
- ⚡ 智能缓存机制

### 🔧 **uTools集成**
- 🚀 完美集成uTools生态
- 🔍 智能关键词搜索
- 🎯 快捷命令支持
- 🎨 统一UI设计风格

## 🚀 快速开始

### 环境要求
- Node.js >= 14.0.0
- uTools >= 3.0.0

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/yourusername/utools_todolist.git
cd utools_todolist
```

2. **安装依赖**
```bash
npm install
```

3. **启动开发服务器**
```bash
npm run dev
```

4. **启动生产服务器**
```bash
npm start
```

### uTools插件安装

1. 确保已安装 [uTools](https://u.tools/)
2. 将项目文件夹复制到uTools插件目录
3. 重启uTools或重新加载插件
4. 使用关键词搜索功能：
   - `todo`、`任务`、`待办` - 打开任务管理
   - `festival`、`节日`、`节假日` - 打开节日管理
   - `calendar`、`日历`、`cal` - 打开日历视图
   - `weather`、`天气`、`气温` - 打开天气查询

## 📁 项目结构

```
utools_todolist/
├── 📄 plugin.json          # uTools插件配置文件
├── 📄 index.html           # 主入口页面
├── 📄 preload.js           # uTools API预加载脚本
├── 📄 server.js            # Express服务器入口
├── 📄 package.json         # Node.js项目配置
├── 📄 package-lock.json    # 依赖锁定文件
├── 📄 README.md            # 项目说明文档
│
├── 📁 assets/              # 静态资源目录
│   ├── 📁 css/            # 样式文件
│   │   ├── font-awesome.min.css
│   │   └── styles.css
│   ├── 📁 js/             # JavaScript文件
│   │   ├── 📁 business/   # 业务逻辑
│   │   │   ├── 📁 todo/    # 任务管理相关
│   │   │   ├── 📁 weather/ # 天气相关
│   │   │   ├── calendar_view.js
│   │   │   └── festival_manager.js
│   │   └── 📁 third_party/ # 第三方库
│   │       ├── chart.js
│   │       ├── lunar.js
│   │       └── tailwindcss.js
│   ├── 📁 img/            # 图片资源
│   └── 📁 fonts/          # 字体文件
│
├── 📁 pages/              # 页面文件目录
│   ├── 📄 index.html      # 子页面主入口
│   ├── 📄 todo_manager.html      # 任务管理页面
│   ├── 📄 festival_manager.html  # 节日管理页面
│   ├── 📄 calendar_view.html     # 日历视图页面
│   └── 📄 weather_view.html      # 天气查询页面
│
├── 📁 server/             # 服务端代码
│   ├── 📄 server.js       # 服务器主文件
│   ├── 📁 routes/         # API路由
│   │   ├── fileRoutes.js
│   │   ├── holidayRoutes.js
│   │   ├── festivalRoutes.js
│   │   ├── weatherRoutes.js
│   │   └── statusRoutes.js
│   ├── 📁 service/        # 业务服务
│   │   ├── festivalService.js
│   │   └── weatherService.js
│   └── 📁 utils/          # 工具函数
│       ├── fileUtils.js
│       └── logger.js
│
└── 📁 data/               # 数据文件目录
    ├── 📁 cache/          # 缓存数据
    ├── 📁 config/         # 配置文件
    ├── 📁 mock/           # 模拟数据
    ├── 📄 todo.txt        # 任务数据文件
    ├── 📄 todo.test.txt   # 测试任务数据
    └── 📁 weather/        # 天气数据缓存
```

## 🔌 API接口文档

### 文件管理接口
- `GET /api/file/scan` - 扫描指定目录文件
- `GET /api/file/read/:filename` - 读取文件内容

### 节假日管理接口
- `GET /api/holiday/cache` - 获取节假日缓存数据
- `POST /api/holiday/refresh` - 刷新节假日数据

### 节日管理接口
- `GET /api/festival/config` - 获取节日配置信息
- `POST /api/festival/save` - 保存节日配置

### 天气服务接口
- `GET /api/weather/weather-area-codes` - 获取天气区域代码
- `GET /api/weather/weather-info` - 获取天气信息

### 系统状态接口
- `GET /api/status` - 获取系统运行状态
- `GET /api/status/check-status` - 检查服务状态

## 🛠️ 开发指南

### 技术栈
- **前端**: HTML5 + CSS3 + JavaScript (ES6+)
- **UI框架**: Tailwind CSS
- **图标**: Font Awesome
- **后端**: Node.js + Express
- **HTTP客户端**: Axios
- **HTML解析**: Cheerio
- **跨域**: CORS

### 开发环境设置

1. **安装开发依赖**
```bash
npm install --save-dev nodemon
```

2. **启动开发模式**
```bash
npm run dev
```
服务器将监听 `http://localhost:3000`

3. **热重载**
开发模式下，文件修改会自动重启服务器

### uTools API集成

插件通过 `preload.js` 提供uTools API适配：

```javascript
// 检测运行环境
if (typeof utools !== 'undefined') {
    // uTools环境
    console.log('运行在uTools环境中');
    // 使用uTools API
    utools.db.get('key');
} else {
    // 浏览器环境
    console.log('运行在浏览器环境中');
    // 使用localStorage等Web API
    localStorage.getItem('key');
}
```

### 插件配置

通过修改 `plugin.json` 自定义插件行为：

```json
{
  "features": [
    {
      "code": "todo",
      "explain": "任务管理器",
      "cmds": ["todo", "任务", "待办"],
      "icon": "assets/img/todo-icon.png"
    }
  ],
  "pluginSetting": {
    "height": 600,
    "width": 900,
    "minHeight": 400,
    "minWidth": 600
  }
}
```

### 数据存储

- **任务数据**: 存储在 `data/todo.txt` 文件中
- **配置信息**: 存储在 `data/config/` 目录
- **缓存数据**: 存储在 `data/cache/` 目录
- **天气缓存**: 存储在 `data/weather/` 目录

## 🧪 测试

### 运行测试
```bash
npm test
```

### 测试数据
使用 `data/todo.test.txt` 作为测试数据文件

## 📦 构建和部署

### 生产环境构建
```bash
npm start
```

### uTools插件发布
1. 确保所有功能正常工作
2. 更新 `plugin.json` 中的版本号
3. 压缩项目文件夹
4. 提交到uTools插件市场

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 代码规范
- 使用 ES6+ 语法
- 遵循 JavaScript Standard Style
- 添加适当的注释
- 保持代码简洁清晰

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

- [uTools](https://u.tools/) - 强大的生产力工具平台
- [Express](https://expressjs.com/) - 快速、极简的Web框架
- [Tailwind CSS](https://tailwindcss.com/) - 实用优先的CSS框架
- [Font Awesome](https://fontawesome.com/) - 优秀的图标库

## 📞 联系方式

- 作者: Your Name
- 邮箱: your.email@example.com
- GitHub: https://github.com/yourusername
- 项目主页: https://github.com/yourusername/utools_todolist

## 📋 更新日志

### v1.0.0 (2024-01-01)
- ✨ 初始版本发布
- ✅ 任务管理功能
- 🎉 节日管理功能
- 📅 日历视图功能
- 🌤️ 天气查询功能
- 🔧 uTools集成

---

⭐ 如果这个项目对你有帮助，请给它一个星标！