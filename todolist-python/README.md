# 待办事项管理系统 (Python版本)

## 项目概述

这是一个基于Python和Flask的待办事项管理系统，是从Node.js版本迁移而来的。系统提供了任务管理、日历视图、节假日管理和天气查询等功能，支持多文件管理和数据缓存。

## 功能特性

- ✅ 任务管理：创建、编辑、删除任务
- ✅ 日历视图：查看任务在日历上的分布
- ✅ 多文件管理：支持多个todo.txt文件的切换和管理
- ✅ 节假日管理：获取和显示节假日信息
- ✅ 天气服务：查询和显示天气信息
- ✅ 缓存机制：减少重复请求，提高系统性能
- ✅ 定时任务：自动天气通知
- ✅ 响应式设计：适配不同设备屏幕

## 安装和运行

### 前提条件

- Python 3.6+
- pip 3+

### 安装步骤

1. **克隆项目**
   ```bash
   git clone <项目地址>
   cd todolist-python
   ```

2. **安装依赖**
   ```bash
   pip3 install -r requirements.txt
   ```

3. **运行系统**
   ```bash
   bash start.sh
   ```

4. **访问系统**
   打开浏览器，访问 http://localhost:3000

## 项目结构

```
todolist-python/
├── app/                  # 应用主目录
│   ├── routes/           # 路由模块
│   │   ├── file_routes.py        # 文件操作路由
│   │   ├── holiday_routes.py     # 节假日路由
│   │   ├── festival_routes.py    # 节日路由
│   │   ├── status_routes.py      # 服务器状态路由
│   │   └── weather_routes.py     # 天气路由
│   ├── services/         # 服务模块
│   │   └── auto_weather_notify_service.py  # 自动天气通知服务
│   └── utils/            # 工具模块
│       └── cache_util.py         # 缓存工具
├── data/                 # 数据目录
│   ├── cache/            # 缓存目录
│   ├── config/           # 配置目录
│   ├── mock/             # 模拟数据目录
│   ├── weather/          # 天气数据目录
│   └── todo.txt          # 默认任务文件
├── logs/                 # 日志目录
├── static/               # 静态文件目录
│   ├── css/              # CSS文件
│   ├── js/               # JavaScript文件
│   ├── img/              # 图片文件
│   └── fonts/            # 字体文件
├── templates/            # HTML模板目录
├── app.py                # 应用入口文件
├── start.sh              # 启动脚本
├── requirements.txt      # 依赖文件
└── README.md             # 说明文档
```

## API接口说明

### 文件操作接口

- **GET /api/file/scan** - 扫描所有todo*.txt文件
- **GET /api/file/read/:filename** - 读取指定文件内容
- **POST /api/file/write/:filename** - 写入文件内容

### 节假日接口

- **GET /api/holiday/data** - 获取节假日数据

### 节日接口

- **GET /api/festival/data** - 获取节日数据

### 服务器状态接口

- **GET /api/check-status** - 检查服务器状态
- **POST /api/shutdown** - 关闭服务器

### 天气接口

- **GET /api/weather/data/:city_code** - 获取指定城市的天气数据

## 配置说明

### 依赖配置

项目依赖在 `requirements.txt` 文件中定义，包括：

- Flask 2.0.1 - Web框架
- requests 2.26.0 - HTTP请求库
- python-crontab 2.6.0 - 定时任务管理
- pytz 2021.3 - 时区管理
- python-dateutil 2.8.2 - 日期时间处理
- pyyaml 6.0 - YAML配置解析
- schedule 1.2.1 - 定时任务调度

### 数据目录

- **data/** - 存储任务文件和配置文件
- **data/cache/** - 存储缓存数据
- **data/config/** - 存储配置文件
- **data/mock/** - 存储模拟数据
- **data/weather/** - 存储天气相关数据

## 注意事项

1. **端口冲突**：默认使用3000端口，如果该端口已被占用，请修改 `app.py` 文件中的端口配置。

2. **文件权限**：确保应用有足够的权限读写数据目录。

3. **依赖版本**：项目使用了特定版本的依赖，建议使用 `requirements.txt` 文件中指定的版本。

4. **缓存管理**：系统会自动管理缓存，但如果需要手动清理缓存，可以删除 `data/cache/` 目录下的文件。

5. **定时任务**：天气通知定时任务默认在每天早上8点执行，可以在 `auto_weather_notify_service.py` 文件中修改。

## 开发说明

### 调试模式

系统默认以调试模式运行，便于开发和调试。在生产环境中，建议关闭调试模式。

### 代码规范

- 使用PEP 8代码规范
- 函数和方法使用文档字符串说明
- 重要的代码块添加注释

### 扩展功能

如果需要扩展系统功能，可以：

1. 在 `app/routes/` 目录下添加新的路由模块
2. 在 `app/services/` 目录下添加新的服务模块
3. 在 `app/utils/` 目录下添加新的工具模块
4. 在 `templates/` 目录下添加新的HTML模板

## 故障排除

### 常见问题

1. **ModuleNotFoundError**：缺少依赖模块
   - 解决方案：运行 `pip3 install -r requirements.txt` 安装所有依赖

2. **端口被占用**：
   - 解决方案：修改 `app.py` 文件中的端口配置

3. **文件权限错误**：
   - 解决方案：确保应用有足够的权限读写数据目录

4. **缓存错误**：
   - 解决方案：删除 `data/cache/` 目录下的文件，重新运行系统

### 日志查看

系统运行时的日志会输出到终端，可以通过查看终端输出来排查问题。

## 许可证

MIT License

## 联系方式

如有问题或建议，请联系项目维护者。
