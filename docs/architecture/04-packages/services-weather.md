# 包：app/services/weather（天气数据源适配器）

> 生成时间：2026-08-01 ｜ 代码版本：master@d6f93a4

## 1. 定位与边界

`weather` 子包封装 4 个外部天气数据源的抓取与解析细节，对上层 `services` 提供统一的 `Fetch*` 函数。**不负责缓存与聚合**——缓存由 `services.weather_service.go` 编排，聚合由 `BuildWeatherData` 完成。

## 2. 目录结构

```
app/services/weather/
├── weather_cma_service.go      # 中国气象局（uTLS）
├── weather_moji_service.go     # 墨迹天气（HTML 解析）
├── weather_nmc_service.go      # 中央气象台
└── weather_tianqi_service.go   # 天气网 weather.com.cn（含 40 天日历）
```

## 3. 核心功能列表

| 文件 | 函数 | 数据源 | 协议 |
|---|---|---|---|
| weather_cma_service.go | `FetchCMAWeather(cmaAreaCode)` | weather.cma.cn/api/now/{code} | HTTPS + uTLS |
| weather_moji_service.go | `FetchMojiWeather(mojiAreaCode)` | tianqi.moji.com/weather/china/{path} | HTTPS + HTML 解析 |
| weather_nmc_service.go | `FetchNMCWeather(nmcApiCode)` | www.nmc.cn | HTTPS JSON |
| weather_tianqi_service.go | `FetchTodayWeather(code)` 等 4 个 | weather.com.cn | HTTPS JSON/HTML |

## 4. 关键类型与职责

### weather_cma_service.go

| 标识符 | 说明 |
|---|---|
| [getCMAHTTPClient](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/weather/weather_cma_service.go#L33) | sync.Once 初始化的 uTLS http.Client（Chrome 120 指纹） |
| [FetchCMAWeather](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/weather/weather_cma_service.go#L60) | 抓取并解析 CMA 实时天气 |

**uTLS 设计**：CMA 接口对 TLS 指纹敏感，标准 `net/http` 会被拒。`DialTLSContext` 中先用 `net.Dialer` 建立 TCP，再用 `utls.UClient` 包装为 Chrome 120 指纹的 TLS 连接。

### weather_moji_service.go

| 标识符 | 说明 |
|---|---|
| [FetchMojiWeather](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/weather/weather_moji_service.go#L25) | 抓取墨迹天气页面 |
| [ExtractMojiWeatherData](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/weather/weather_moji_service.go#L58) | 用 goquery 解析 HTML |

**解析要点**：

- 今日实时天气：从 `.wea_info .wea_weather` 等选择器提取温度/天气/风力/湿度/空气质量/提示
- 天气日历：从 `#calendar_grid > ul > li` 提取当月每日天气，组装为 `{date, weather, tempMin, tempMax, wind}`

### weather_nmc_service.go

| 标识符 | 说明 |
|---|---|
| [FetchNMCWeather](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/weather/weather_nmc_service.go#L48) | 抓取中央气象台 |
| [nmcGet](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/weather/weather_nmc_service.go#L24) | 嵌套 map 安全取值 |
| [nmcStr](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/weather/weather_nmc_service.go#L40) | 字符串取值，过滤 "9999" 占位符 |

### weather_tianqi_service.go

| 标识符 | 说明 |
|---|---|
| [GetCalendarWeatherByCode](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/weather/weather_tianqi_service.go#L42) | 40 天天气代码映射（0=晴，1=多云...） |
| `FetchTodayWeather` | 今日实时天气 |
| `FetchTodayDetailWeather` | 今日详细（逐小时 + 生活助手） |
| `FetchRecentDaysWeather` | 近几日天气 |
| `FetchCalendarAndHistoryWeather` | 日历天气 + 历史天气 |

## 5. 对外 API

| 函数 | 入参 | 返回 |
|---|---|---|
| `FetchCMAWeather(cmaAreaCode string)` | CMA 区县编码 | `map[string]interface{}` |
| `FetchMojiWeather(mojiAreaCode string)` | 墨迹路径（如 `zhejiang/hangzhou/330108`） | `interface{}` |
| `FetchNMCWeather(nmcApiCode string)` | NMC API 编码 | `interface{}` |
| `FetchTodayWeather(code string)` | 天气网 9 位编码 | `map[string]interface{}` |
| `FetchTodayDetailWeather(code string)` | 同上 | `map[string]interface{}` |
| `FetchRecentDaysWeather(code string)` | 同上 | `interface{}` |
| `FetchCalendarAndHistoryWeather(code string)` | 同上 | `interface{}` |
| `GetCalendarWeatherByCode(code1, code2 string)` | 两个天气代码 | `string` |

## 6. 依赖关系

- **import**：`app/utils`、`net/http`、`io/ioutil`、`encoding/json`、`regexp`、`strconv`、`strings`、`time`、`fmt`、`sync`、`context`、`net`
- 第三方：`github.com/PuerkitoBio/goquery`（moji）、`github.com/refraction-networking/utls`（cma）
- **被 import**：`app/services`（仅 weather_service.go）

## 7. 并发模型

仅 `getCMAHTTPClient` 使用 `sync.Once` 保证全局唯一 http.Client。所有 `Fetch*` 函数本身是同步阻塞调用，由上层 `QueryWeatherData` 在 goroutine 中并行调度。

## 8. 错误处理

- 所有 `Fetch*` 失败返回 `map[string]interface{}{"error": ...}` 而非 Go error，便于上层统一收集。
- HTTP 非 200 转为 `{"error": "HTTP响应状态码: %d"}`。
- HTML 解析失败：返回部分填充的 `weatherData`（含空 `liveWeather`），不中断。

## 9. 平台适配

无平台特定代码；uTLS 在所有平台一致工作。

## 10. 配置项

| 配置项 | 默认值 | 用于 |
|---|---|---|
| `app.server.api_timeout_weather` | 10s | moji/nmc/tianqi 的 http.Client.Timeout |
| `app.server.api_timeout_weather_utls` | 20s | cma 的 http.Client.Timeout |

## 11. 反爬应对策略

| 数据源 | 反爬手段 | 应对 |
|---|---|---|
| CMA | TLS 指纹检测 | uTLS 模拟 Chrome 120 |
| 墨迹 | User-Agent 检测 | 自定义 UA + 标准请求头 |
| 天气网 | Referer 检测 | 设置 `Referer: https://www.weather.com.cn/` |
| NMC | Referer 检测 | 设置 `Referer: https://www.nmc.cn/` |

## 12. 数据返回结构约定

各 `Fetch*` 返回的 `map[string]interface{}` 字段约定（用于 `BuildWeatherData` 合并）：

| 字段 | 含义 | 提供者 |
|---|---|---|
| `liveWeather` | 今日实时（time/weather/temperature/tempMin/tempMax/wind/humidity/airQuality/tips） | moji/tianqi/nmc |
| `hourlyWeather` | 逐小时预报数组 | tianqi |
| `lifeHelper` | 生活助手数组 | tianqi |
| `dailyWeather` | 近几日数组 | nmc |
| `calendarWeather` | 日历数组（date/weather/tempMin/tempMax/wind） | moji/tianqi |
| `error` | 错误信息（失败时） | 所有 |
