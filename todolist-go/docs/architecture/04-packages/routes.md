# 包：app/routes（HTTP 路由层）

> 生成时间：2026-08-01 ｜ 代码版本：master@d6f93a4

## 1. 定位与边界

`routes` 是 HTTP 适配层，负责端点定义、请求参数解析、响应序列化、缓存编排。它将外部 HTTP 请求转换为对 `services` 与 `utils` 的调用。**不包含复杂业务规则**（除节假日抓取直接在此层实现外）。

## 2. 目录结构

```
app/routes/
├── routes.go            # 统一注册入口
├── file_routes.go       # 任务文件 CRUD
├── holiday_routes.go    # 节假日抓取与缓存
├── festival_routes.go   # 节日配置读写
├── status_routes.go     # 健康检查与优雅关闭
└── weather_routes.go    # 天气查询（IP/区域编码/天气数据）
```

## 3. 核心功能列表

- 注册所有 API 路由组（5 组）
- 任务文件扫描/读取/写入（含缓存）
- 节假日数据抓取与缓存（100 天 TTL）
- 节日配置读取与保存（含字段校验）
- 服务健康检查与自触发关闭
- 天气查询的参数组装与转发

## 4. 关键类型与职责

### [RegisterRoutes](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/routes/routes.go#L8)

统一注册入口，按顺序调用 5 个子注册函数。

### file_routes.go

| 标识符 | 说明 |
|---|---|
| [RegisterFileRoutes](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/routes/file_routes.go#L18) | 注册 `/api/file` 组 |
| [scanFilesLogic](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/routes/file_routes.go#L26) | 扫描 `data/` 下 `todo*.txt`，按 mtime 降序 |
| [validateFilename](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/routes/file_routes.go#L88) | 文件名白名单校验（`todo*` + `.txt`） |
| [clearFileCache](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/routes/file_routes.go#L93) | 失效单文件 + 文件列表缓存 |

### holiday_routes.go

| 标识符 | 说明 |
|---|---|
| [fetchHolidayData](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/routes/holiday_routes.go#L37) | 从 shuyz.com 抓取节假日 JSON（10s 超时） |
| [getHolidayData](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/routes/holiday_routes.go#L69) | 通过 CacheUtil + LoadDataFn 编排缓存与回源 |

### festival_routes.go

| 标识符 | 说明 |
|---|---|
| [getFestivalConfig](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/routes/festival_routes.go#L19) | 读取 `festival` 配置 |
| [saveFestivalConfig](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/routes/festival_routes.go#L34) | 校验 `festivals` 字段后保存，清缓存 |

### status_routes.go

| 标识符 | 说明 |
|---|---|
| [checkStatus](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/routes/status_routes.go#L20) | 返回 `{success:true}` |
| [shutdown](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/routes/status_routes.go#L27) | 1 秒后向自己发 SIGINT |

### weather_routes.go

| 标识符 | 说明 |
|---|---|
| [getClientIP](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/routes/weather_routes.go#L21) | 解析 X-Forwarded-For 或 ClientIP |
| [getIPLocation](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/routes/weather_routes.go#L33) | 转发至 `services.GetLocation` |
| [getWeatherAreaCodes](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/routes/weather_routes.go#L41) | 转发至 `services.GetAllAreaCodes` |
| [getWeatherInfo](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/routes/weather_routes.go#L54) | 组装参数后转发至 `services.GetWeatherData` |

## 5. 对外 API

仅 `RegisterRoutes(router *gin.Engine)` 一个导出函数。

## 6. 依赖关系

- **import**：`app/services`、`app/utils`、`github.com/gin-gonic/gin`、`net/http`、`os`、`path/filepath`、`sort`、`strings`、`encoding/json`、`io/ioutil`、`time`、`syscall`
- **被 import**：`app`

## 7. 并发模型

无自身并发；`shutdown` 用 goroutine 延迟 1 秒发信号，避免响应未发送就退出。

## 8. 错误处理

- 文件名非法返回 403；JSON 解析失败返回 400；文件写入失败返回 500。
- 节假日抓取失败返回 500，但 `AllowExpired=true` 时优先返回过期缓存。
- 响应格式不统一：`{success, message}` / `{data, timestamp, error}` / `{data, timestamp, expired, permanent}` 混用。

## 9. 平台适配

`shutdown` 使用 `syscall.SIGINT`，在 Linux/macOS 通用；Windows 下 SIGINT 也可被 `signal.Notify` 捕获，行为一致。

## 10. 配置项

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `fileOptions.TTL` | 300000ms | 文件列表与文件内容缓存 |
| `holidayTTL` | 100天 | 节假日缓存 |
| `defaultHolidayAPIURL` | shuyz.com | 节假日 API 地址 |

## 11. 缓存策略细节

| 端点 | 缓存 key | 写入时机 | 失效时机 |
|---|---|---|---|
| `GET /api/file/scan` | `file_list` | 首次扫描后 | `writeFile` 调用 `clearFileCache` |
| `GET /api/file/read/:filename` | `file_read_<name>` | 首次读取后 | `writeFile` 调用 `clearFileCache` |
| `GET /api/holiday/cache` | `holiday_cache` | LoadDataFn 回源后 | `POST /refresh-cache` |
| `GET /api/festival/config` | `festival_config` | - | `POST /save` 主动 Delete |
| `GET /api/weather/*` | 各自 key | 见 services 包 | forceRefresh=true 时绕过 |
