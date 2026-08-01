# ADR-0007：uTLS 绕过 CMA 反爬

- 状态：已接受
- 日期：2026-08-01
- 决策者：项目维护者

## 背景

中国气象局（weather.cma.cn）的 API 对 TLS 指纹敏感：标准 Go `net/http` 的 TLS ClientHello 被识别为非浏览器流量，返回 403 或连接重置。这导致 [FetchCMAWeather](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/weather/weather_cma_service.go#L60) 无法用标准客户端抓取。

## 决策

引入 `github.com/refraction-networking/utls` v1.8.2，在 [getCMAHTTPClient](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/weather/weather_cma_service.go#L33-L57) 中自定义 `DialTLSContext`，模拟 Chrome 120 的 TLS 指纹：

```go
utsConn := utls.UClient(conn, &utls.Config{
    ServerName: "weather.cma.cn",
    InsecureSkipVerify: false,
}, utls.HelloChrome_120)
```

仅在 CMA 接口的 http.Client 中启用，其他数据源（墨迹/天气网/NMC）仍用标准 net/http。

## 理由

1. **CMA 是不可替代的数据源**：CMA 提供权威的实时天气与空气质量，墨迹/天气网部分字段依赖 CMA 数据。
2. **uTLS 是 Go 生态成熟方案**：refraction-networking/utls 是 TLS 指纹伪装的事实标准，社区活跃。
3. **影响范围最小**：通过 `DialTLSContext` 只覆盖 TLS 握手层，HTTP 协议层仍用标准 net/http，兼容性好。
4. **sync.Once 单例**：全局复用一个 http.Client，避免每次请求重新构造 uTLS 配置。
5. **仅 CMA 启用**：其他数据源未检测到 TLS 指纹检测，无需引入该依赖到所有请求。

## 备选方案

| 方案 | 放弃原因 |
|---|---|
| 放弃 CMA 数据源 | 损失权威数据，且 CMA 数据用于补齐天气网缺失字段 |
| 用 Chrome headless 抓取 | 引入 Chrome 依赖，体积与启动开销不可接受 |
| 用 Python 子进程抓取 | 违背"纯 Go 实现"目标 |
| 自行实现 TLS 指纹伪装 | 工作量巨大，uTLS 已是成熟方案 |
| HTTP 代理到浏览器扩展 | 部署复杂，单机桌面场景不适用 |

## 后果

**正面**：

- CMA 数据成功抓取，数据完整性提升
- uTLS 配置集中在 [weather_cma_service.go](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/weather/weather_cma_service.go)，其他代码无感知

**负面**：

- **新增 1 个直接依赖 + 若干间接依赖**（如 `golang.org/x/crypto`、`golang.org/x/sys`），go.sum 增大
- **指纹版本需跟进**：若 CMA 升级检测到 Chrome 120 指纹，需更新到 `HelloChrome_131` 等新版本
- **超时配置独立**：uTLS 握手耗时较长，单独配置 `api_timeout_weather_utls`（默认 20s），高于普通天气 API 的 10s
- **潜在合规风险**：伪装 TLS 指纹绕过反爬可能违反 CMA 服务条款，仅限个人使用
- **依赖维护风险**：refraction-networking/utls 是社区项目，若停止维护需迁移

## 相关 ADR

- [ADR-0001](0001-技术栈选型.md)：技术栈（uTLS 是技术栈的一部分）
