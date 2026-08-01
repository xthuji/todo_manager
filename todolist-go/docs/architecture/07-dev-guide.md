# 开发维护手册

> 生成时间：2026-08-01 ｜ 代码版本：master@d6f93a4

## 1. 代码规范

### 1.1 包命名

- 包名小写、单词、无下划线：`routes`、`services`、`weather`、`utils`
- 避免无意义包名：`common`、`util`、`helpers`（项目历史遗留 `utils`，新增时避免）
- 包名与目录名一致

### 1.2 文件命名

- 小写蛇形：`config_util.go`、`weather_cma_service.go`
- 平台后缀：`_darwin.go`（必须配合 `//go:build darwin`）
- 测试文件：`_test.go` 后缀

### 1.3 接口设计

- 接口定义在消费方（Go 惯例）
- 小接口组合优于胖接口
- 项目当前接口使用较少，多为具体类型直接依赖（如 `*gin.Engine`、`*CacheUtil`）

### 1.4 错误处理

> 当前项目采用轻量风格（见 [ADR-0006](05-adr/0006-错误处理策略选型.md)）。新代码建议：

- 外部 API 调用层用 `(T, error)` 标准返回
- `fmt.Errorf` 用 `%w` 包裹错误，保留错误链
- 业务层维持 `map[string]interface{}` 风格，与现有代码一致
- 类型断言用 `v, ok := x.(T)` 形式，避免静默忽略
- handler 中按 `400/403/500` 语义选择状态码

### 1.5 并发规范

- **全局 map 必须加锁**（[ADR-0005](05-adr/0005-缓存并发安全权衡.md) 待落实）：新增全局 map 必须用 `sync.RWMutex` 或 `sync.Map`
- goroutine 必须有明确退出路径，避免泄漏
- channel 优先用 buffered（容量 ≥ 1）防止 goroutine 阻塞
- 业务链路建议传 `context.Context`，至少在 HTTP handler 入口用 `c.Request.Context()`

### 1.6 导出标识符

- 首字母大写决定可见性
- 导出函数/方法必须有注释，以标识符名开头（Go doc 惯例）
- 全局单例变量用 `Instance` 后缀：`ConfigUtilInstance`、`CacheUtilInstance`、`LoggerInstance`

### 1.7 注释规范

- 中文注释（与项目风格一致）
- 函数注释以标识符名开头：`// GetLocation 根据IP地址获取位置信息`
- 平台特定代码用 build tag 注释：`//go:build darwin`
- 与 Python 版对照的注释保留：`// 对应 Python ...`（迁移痕迹，便于溯源）

## 2. 新增功能流程

### 2.1 新增 HTTP 接口

1. 在 [app/routes/](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/routes) 对应路由文件中：
   - 在 `RegisterXxxRoutes` 添加路由注册
   - 实现 handler 函数（参考 [scanFiles](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/routes/file_routes.go#L58) 模式：缓存 → 逻辑 → 回写缓存）
2. 复杂逻辑下沉到 [app/services/](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services)
3. 公共工具放 [app/utils/](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/utils)

### 2.2 新增天气数据源

1. 在 [app/services/weather/](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/weather) 新建 `weather_xxx_service.go`
2. 实现 `FetchXxxWeather(code string) interface{}`，失败时返回 `map[string]interface{}{"error": ...}`
3. 在 [QueryWeatherData](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/weather_service.go#L326) 添加 channel 与 goroutine
4. 在 [BuildWeatherData](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/weather_service.go#L78) 添加合并逻辑
5. 更新完整性门控条件（[weather_service.go#L315](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/weather_service.go#L315)）
6. 在 [services-weather.md](04-packages/services-weather.md) 更新文档

### 2.3 新增配置项

1. 在对应配置文件（如 [app_config.json](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/data/config/app_config.json)）添加字段
2. 用 `ConfigUtilInstance.GetConfigValue("app", "path.to.key", defaultValue)` 读取
3. 若是全局开关，在 [constants.go](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/utils/constants.go) 的 `InitConstants` 中添加
4. 在 [04-packages/utils.md](04-packages/utils.md) 的配置项表格更新

### 2.4 新增前端页面

1. 在 [static/pages/](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/static/pages) 新建 `.html`
2. 在 [static/js/business/](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/static/js/business) 新建对应 JS（按业务域分子目录）
3. 在 [core.go](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/core.go) 的页面路由中无需手动注册（[servePage](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/core.go#L106) 自动处理 `/pages/:filename`）

## 3. 测试约定

### 3.1 测试位置

所有测试集中在 [tests/](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/tests)，统一 `package tests`。这与 Go 惯例（与源码同目录）不同，是项目历史选择。

| 测试文件 | 覆盖范围 |
|---|---|
| test_cache_test.go | 缓存工具 |
| test_festivals_manager_test.go | 节日管理 |
| test_lunar_utils_test.go | 农历工具 |
| test_todo_manager_test.go | 任务管理 |
| test_business_integration_test.go | 业务集成 |
| test_weather_view_test.go | 天气视图 |
| test_calendar_renderer_test.go | 日历渲染 |

### 3.2 运行测试

```bash
# 全部测试
./tests/run_tests.sh

# 单文件
go test -v -cover ./tests/test_cache_test.go

# 竞态检测（推荐新增测试时启用）
go test -race ./tests/...

# 基准测试
go test -bench=. ./tests/...
```

### 3.3 测试风格

- 表驱动测试（table-driven）优先
- 测试函数命名：`TestXxx_Scenario`
- 使用 `t.Run` 组织子测试
- Mock 数据放 [data/mock/](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/data/mock)

### 3.4 测试标志

[run_tests.sh](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/tests/run_tests.sh) 成功后会创建 `tests/.test_success` 文件，可作为 CI 检测标志。

## 4. 构建与部署

### 4.1 本地构建

```bash
# 当前平台
./build.sh

# 指定平台
./build.sh --macos
./build.sh --linux
./build.sh --windows

# 清理
./build.sh --clean

# 详细输出
./build.sh --verbose --macos
```

### 4.2 交叉编译

[build.sh](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/build.sh) 通过 `GOOS/GOARCH` 环境变量交叉编译，`-ldflags "-s -w"` 去除符号表与调试信息。

| 平台 | 产物 | 打包 |
|---|---|---|
| macOS | `TodoManager`（amd64） | `.app` 包 + 可选 `.dmg` |
| Linux | `TodoManager`（amd64） | `.tar.gz` |
| Windows | `TodoManager.exe`（amd64） | `.zip` |

### 4.3 macOS .app 打包

[create_macos_app_bundle](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/build.sh#L121-L194) 创建标准 .app 结构：

```
TodoManager.app/
└── Contents/
    ├── Info.plist          # 应用元信息
    ├── MacOS/
    │   └── TodoManager     # 可执行文件
    └── Resources/
        ├── icon.icns
        ├── static/         # 前端资源
        └── data/
            ├── config/
            ├── weather/
            └── todo*.txt
```

### 4.4 版本管理

- 版本号在 [version.txt](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/version.txt)，格式 `VERSION = x.y.z`
- [build.sh](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/build.sh#L24) 读取后通过 `-X main.Version` 注入（但 main 包未声明 `Version` 变量，注入无效，待修复）
- 当前版本：1.0.0

### 4.5 发布产物

构建完成后 `dist/` 目录保留：

- `TodoManager-${VERSION}-macos.dmg`
- `TodoManager-${VERSION}-linux.tar.gz`
- `TodoManager-${VERSION}-windows.zip`
- `TodoManager.app/`（macOS）

其他中间文件由 [keep_artifact](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/build.sh#L259) 清理。

## 5. 配置项与环境变量说明

### 5.1 配置文件

| 文件 | 作用 | 修改方式 |
|---|---|---|
| [app_config.json](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/data/config/app_config.json) | 端口/超时/特性开关/默认位置/日志开关 | 手动 |
| [notify_config.json](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/data/config/notify_config.json) | 天气通知配置 | 手动 |
| [festival_config.json](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/data/config/festival_config.json) | 用户自定义节日 | 前端 UI 或手动 |

### 5.2 环境变量

项目不依赖环境变量。可选：

| 变量 | 用途 |
|---|---|
| `GOPROXY` | Go 模块代理 |
| `GOSUMDB` | 校验和数据库 |
| `GOOS`/`GOARCH`/`CGO_ENABLED` | 交叉编译（由 build.sh 设置） |

### 5.3 关键目录

| 目录 | 作用 | 是否提交到 git |
|---|---|---|
| `data/config/` | 配置文件 | 是（含敏感信息需注意） |
| `data/cache/` | 运行期缓存 | 否 |
| `data/logs/` | 日志 | 否 |
| `data/weather/` | 区县编码静态数据 | 是 |
| `data/mock/` | Mock 数据 | 是 |
| `data/todo*.txt` | 任务文件 | 是（示例） |
| `dist/` | 构建产物 | 否 |
| `tests/.test_success` | 测试成功标志 | 否 |

## 6. 已知技术债

1. **缓存并发不安全**：[ADR-0005](05-adr/0005-缓存并发安全权衡.md) 待复审
2. **定时通知未实现 cron 调度**：见 [08-faq.md](08-faq.md)
3. **`Shutdown` 传 nil context**：[core.go#L162](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/core.go#L162)
4. **`-X main.Version` 注入无效**：main 包未声明 `Version` 变量
5. **README 部分内容过期**：如 `gin-contrib/cors` 实际未使用
6. **`NewTodoApp` 硬编码端口 3002**：未读取配置
7. **测试不在源码同目录**：与 Go 惯例不符，跨包测试不便
