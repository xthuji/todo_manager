# 包：app/services（业务服务层）

> 生成时间：2026-08-01 ｜ 代码版本：master@d6f93a4

## 1. 定位与边界

`services` 是业务规则与外部 API 调用的承载层。它向上为 `routes` 提供业务函数，向下调用 `weather` 子包与 `utils`。**不感知 HTTP 协议**（无 `*gin.Context`），返回 `map[string]interface{}`。

## 2. 目录结构

```
app/services/
├── location_service.go              # IP 定位与区县编码
├── weather_service.go               # 多源天气聚合
├── notify_service.go                # 短信与微信通知
├── auto_weather_notify_service.go   # 定时通知编排
└── weather/                         # 4 个天气数据源适配器（子包）
```

## 3. 核心功能列表

- IP 定位（CMA + 天气网双源并行）
- 区县编码匹配（递归查找 + sync.Once 缓存）
- 多源天气数据并行抓取与聚合
- 天气文本组织（含图标映射与详情链接）
- 天气通知定时编排
- 短信通知（macOS Messages.app）
- 微信客服消息通知（含 access_token 缓存）

## 4. 关键类型与职责

### location_service.go

| 标识符 | 类型 | 说明 |
|---|---|---|
| [FindDistrictInfo](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/location_service.go#L32) | func | 递归查找区县信息，返回标准省市县 |
| [GetLocation1](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/location_service.go#L88) | func | 从 CMA 获取位置 |
| [GetLocation2](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/location_service.go#L120) | func | 从天气网获取位置 |
| [GetCurrLocation](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/location_service.go#L171) | func | 双源并行 + 选择 + 补全 |
| [GetLocation](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/location_service.go#L234) | func | 带缓存与 Mock 的入口 |
| [GetAllAreaCodes](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/location_service.go#L271) | func | 从文件读区县编码主数据 |
| [GetDistrictAreaCodes](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/location_service.go#L314) | func | 单区县的多源编码映射（sync.Once） |

### weather_service.go

| 标识符 | 类型 | 说明 |
|---|---|---|
| [CacheWeatherInfo](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/weather_service.go#L27) | func | 天气缓存读/写双工函数 |
| [BuildWeatherData](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/weather_service.go#L78) | func | 7 源数据合并 |
| [QueryWeatherData](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/weather_service.go#L326) | func | 7 goroutine 并行抓取 |
| [GetWeatherData](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/weather_service.go#L453) | func | 含 Mock 与缓存编排的入口 |

### notify_service.go

| 标识符 | 类型 | 说明 |
|---|---|---|
| [GetNotifyConfig](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/notify_service.go#L21) | func | 懒加载通知配置 |
| [SendMessage](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/notify_service.go#L59) | func | 按 notifyTypes 分发 |
| [SendSMSMessage](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/notify_service.go#L123) | func | macOS Messages.app（osascript） |
| [GetWechatAccessToken](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/notify_service.go#L163) | func | 含缓存与续期 |
| [SendWechatMessage](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/notify_service.go#L224) | func | 调用微信客服消息 API |

### auto_weather_notify_service.go

| 标识符 | 类型 | 说明 |
|---|---|---|
| [AutoWeatherNotify](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/auto_weather_notify_service.go#L13) | struct | 通知编排器 |
| [autoWeatherNotify](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/auto_weather_notify_service.go#L21) | var | 全局单例 |
| [OrganizeWeatherText](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/auto_weather_notify_service.go#L73) | method | 组织通知文本 |
| [ValidateWeatherData](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/auto_weather_notify_service.go#L131) | method | 数据校验 |
| [SendWeatherNotifyOnTimer](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/auto_weather_notify_service.go#L155) | method | 通知任务主流程 |
| [StartWeatherNotifyTimer](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/auto_weather_notify_service.go#L222) | func | 启动入口（含即时通知） |

## 5. 对外 API

见上方 4 个表格的导出标识符。

## 6. 依赖关系

- **import**：`app/services/weather`、`app/utils`、`github.com/PuerkitoBio/goquery`（仅 notify 用 osascript）、`net/http`、`os/exec`、`encoding/json`、`regexp`、`sync`、`time`、`bytes`、`io/ioutil`、`strings`、`strconv`、`fmt`、`sort`、`os`
- **被 import**：`app/routes`、`app`（core.go 启动定时器）

## 7. 并发模型

### 7.1 天气查询的 fan-out（[QueryWeatherData](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/weather_service.go#L326-L433)）

7 个 goroutine + 7 个 buffered channel（容量 1）：

```go
mojiCh := make(chan interface{}, 1)
// ... 6 个其他 channel
go func() { mojiCh <- weather.FetchMojiWeather(mojiAreaCode) }()
// ... 6 个其他 goroutine
mojiData := <-mojiCh
// ... 顺序接收
```

要点：

- 每个 channel 容量 1，goroutine 写入后立即退出，无阻塞。
- 主 goroutine 顺序接收（非 `select`），等待所有完成。
- 失败的源返回 `{"error": ...}` 而非 nil，由 [checkWeatherError](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/weather_service.go#L436) 收集。

### 7.2 位置定位的 WaitGroup（[GetCurrLocation](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/location_service.go#L171-L177)）

```go
var wg sync.WaitGroup
wg.Add(2)
go func() { defer wg.Done(); loc1 = GetLocation1() }()
go func() { defer wg.Done(); loc2 = GetLocation2() }()
wg.Wait()
```

### 7.3 区县编码的 sync.Once（[GetDistrictAreaCodes](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/location_service.go#L315)）

首次调用解析 `merged_weather_area_codes.json` 构建查找表，后续直接查 map。

### 7.4 通知任务的 IsSending 防重入

[SendWeatherNotifyOnTimer](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/auto_weather_notify_service.go#L155-L161) 用 `a.IsSending` 布尔标志防止并发执行，但**非原子操作**，严格并发场景下不安全。

## 8. 错误处理

- 多源天气失败：收集为字符串切片，warn 日志，不中断。
- 数据校验失败：调用 `SendErrorNotify` 发送错误警报。
- 微信 API 错误：解析 errcode/errmsg 返回 `{success:false, message}`。
- 短信发送失败：捕获 `cmd.CombinedOutput` 错误。
- 类型断言静默忽略：`m, _ := x.(map[string]interface{})` 模式普遍。

## 9. 平台适配

- `SendSMSMessage` 仅 macOS 可用（依赖 `osascript` + Messages.app）。
- 其他函数跨平台。

## 10. 配置项

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `app.server.api_timeout_location` | 10s | 位置 API 超时 |
| `app.server.api_timeout_weather` | 10s | 天气 API 超时 |
| `app.server.api_timeout_weather_utls` | 20s | CMA uTLS 超时 |
| `notify.weather.weatherCode` | - | 通知用区县编码 |
| `notify.weather.notifyTypes` | - | 通知渠道数组 |
| `notify.weather.cronExpression` | `0 8 * * *` | 定时表达式（未实际调度） |
| `notify.weather.startupNotifyEnabled` | false | 启动时即时通知 |
| `notify.weather.wechatAppId/Secret` | - | 微信公众号凭据 |

## 11. 已知功能差距

> ⚠️ `StartWeatherNotifyTimer` **未实现真正的 cron 调度**。它仅在启动时执行一次即时通知（若 `startupNotifyEnabled=true`），`cronExpression` 仅用于日志展示。若需真正的定时执行，需引入 cron 库（如 `github.com/robfig/cron`）或用 `time.Ticker` 实现。详见 [08-faq.md](08-faq.md)。
