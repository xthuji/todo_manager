# 待办事项管理系统 (Go/Webview版本)

## 项目概述

这是一个基于Go和webview_go的待办事项管理系统桌面应用。系统提供了任务管理、日历视图、节假日管理和天气查询等功能，支持多文件管理和数据缓存。

## 功能特性

- ✅ 任务管理：创建、编辑、删除任务
- ✅ 日历视图：查看任务在日历上的分布
- ✅ 多文件管理：支持多个todo.txt文件的切换和管理
- ✅ 节假日管理：获取和显示节假日信息
- ✅ 天气服务：查询和显示天气信息
- ✅ 缓存机制：减少重复请求，提高系统性能
- ✅ 定时任务：自动天气通知
- ✅ 桌面应用：基于webview_go的跨平台桌面应用

## 安装和运行

### 前提条件

- Go 1.25+

### 安装步骤

1. **克隆项目**
   ```bash
   git clone <项目地址>
   cd todolist-go
   ```

2. **安装依赖**
   ```bash
   go mod tidy
   ```

3. **开发模式运行**
   ```bash
   ./test_app.sh
   ```

4. **生产构建**
   ```bash
   ./build.sh
   ```

## 项目结构

```
todolist-go/
├── app/                  # 应用主目录
│   ├── app.go            # Gin服务器应用实例
│   ├── routes/           # 路由模块
│   │   ├── file_routes.go        # 文件操作路由
│   │   ├── holiday_routes.go     # 节假日路由
│   │   ├── festival_routes.go    # 节日路由
│   │   ├── status_routes.go      # 服务器状态路由
│   │   └── weather_routes.go     # 天气路由
│   ├── services/         # 服务模块
│   │   ├── weather/      # 天气服务
│   │   │   ├── weather_cma_service.go
│   │   │   ├── weather_nmc_service.go
│   │   │   ├── weather_tianqi_service.go
│   │   │   └── weather_moji_service.go
│   │   ├── location_service.go
│   │   ├── notify_service.go
│   │   ├── auto_weather_notify_service.go
│   │   └── weather_service.go
│   └── utils/            # 工具模块
│       ├── cache_util.go
│       ├── config_util.go
│       ├── constants.go
│       └── logger_util.go
├── data/                 # 数据目录
│   ├── cache/            # 缓存目录
│   ├── config/           # 配置目录
│   ├── mock/             # 模拟数据目录
│   ├── weather/          # 天气数据目录
│   └── todo.txt          # 默认任务文件
├── tests/                # 测试目录
├── logs/                 # 日志目录
├── static/               # 静态文件目录
│   ├── css/              # CSS文件
│   ├── js/               # JavaScript文件
│   ├── img/              # 图片文件
│   └── fonts/            # 字体文件
├── app.go                # Webview应用入口
├── app_darwin.go         # macOS特定实现
├── go.mod                # Go模块依赖
├── go.sum                # Go模块校验
├── build.sh              # 构建脚本
├── test_app.sh           # 测试运行脚本
└── README.md             # 说明文档
```

## API接口说明

### 文件操作接口

- **GET /api/file/scan** - 扫描所有todo*.txt文件
- **GET /api/file/read/:filename** - 读取指定文件内容
- **POST /api/file/write/:filename** - 写入文件内容

### 节假日接口

- **GET /api/holiday/cache** - 获取节假日缓存数据
- **POST /api/holiday/refresh-cache** - 刷新节假日缓存

### 节日接口

- **GET /api/festival/config** - 获取节日配置
- **POST /api/festival/save** - 保存节日配置

### 服务器状态接口

- **GET /api/check-status** - 检查服务器状态
- **POST /api/shutdown** - 关闭服务器

### 天气接口

- **GET /api/weather/ip-location** - 根据IP获取位置信息
- **GET /api/weather/weather-area-codes** - 获取天气区域编码
- **GET /api/weather/weather-info** - 获取天气数据

## 配置说明

### 依赖管理

项目依赖在 `go.mod` 文件中定义，包括：

- github.com/webview/webview_go - Webview桌面框架
- github.com/gin-gonic/gin - Web框架
- github.com/gin-contrib/cors - CORS中间件
- github.com/PuerkitoBio/goquery - HTML解析

### 数据目录

- **data/** - 存储任务文件和配置文件
- **data/cache/** - 存储缓存数据
- **data/config/** - 存储配置文件
- **data/mock/** - 存储模拟数据
- **data/weather/** - 存储天气相关数据

## 注意事项

1. **端口冲突**：默认使用3002端口，如果该端口已被占用，`test_app.sh`脚本会自动释放端口。

2. **文件权限**：确保应用有足够的权限读写数据目录。

3. **依赖版本**：项目使用Go modules管理依赖，建议使用`go mod tidy`安装依赖。

4. **缓存管理**：系统会自动管理缓存，但如果需要手动清理缓存，可以删除 `data/cache/` 目录下的文件。

5. **定时任务**：天气通知定时任务默认在每天早上8点执行。

## 开发说明

### 调试模式

使用`./test_app.sh`命令以开发模式运行，支持快速重新编译和测试。

### 代码规范

- 使用Go官方代码规范
- 函数和方法使用注释说明
- 重要的代码块添加文档字符串

### 扩展功能

如果需要扩展系统功能，可以：

1. 在 `app/routes/` 目录下添加新的路由模块
2. 在 `app/services/` 目录下添加新的服务模块
3. 在 `app/utils/` 目录下添加新的工具模块

### 运行测试

```bash
go test ./tests/... -v
```

### 构建桌面应用

```bash
./build.sh
```

## 故障排除

### 常见问题

1. **依赖缺失**：缺少依赖模块
   - 解决方案：运行 `go mod tidy` 安装所有依赖

2. **端口被占用**：
   - 解决方案：修改配置文件中的端口配置

3. **文件权限错误**：
   - 解决方案：确保应用有足够的权限读写数据目录

4. **编译错误**：
   - 解决方案：运行 `go vet ./...` 检查代码问题

### 日志查看

系统运行时的日志会输出到终端，可以通过查看终端输出来排查问题。

## 许可证

MIT License

## 联系方式

如有问题或建议，请联系项目维护者。
