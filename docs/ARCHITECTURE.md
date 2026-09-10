# 架构说明（入口）

> 本文件是精简入口。**完整文档已迁移到 [docs/architecture/](architecture/README.md)**，并按「App 页面维度」重新组织。

## 从哪里开始

| 想了解 | 去这里 |
|---|---|
| 项目全貌 + App 页面地图 + 页面↔后端映射 | [architecture/01-overview.md](architecture/01-overview.md) |
| 外壳如何装载/切换四个页面 | [architecture/02-pages/00-app-shell.md](architecture/02-pages/00-app-shell.md) |
| 具体业务页面 | [architecture/02-pages/](architecture/02-pages/)（todo / weather / calendar / festival） |
| 启动/路由/配置/缓存/日志/并发/平台适配 | [architecture/04-infrastructure.md](architecture/04-infrastructure.md) |
| 关键选型理由 | [architecture/01-overview.md](architecture/01-overview.md) §6.1 |
| 上手开发 / 规范 / 常见问题 | [architecture/06-onboarding.md](architecture/06-onboarding.md)、[07-dev-guide.md](architecture/07-dev-guide.md)、[08-faq.md](architecture/08-faq.md) |

## 技术选型速览

| 层 | 选型 | 理由 |
|---|---|---|
| 桌面框架 | webview_go | 轻量、零前端构建、原生窗口体验；对比 Wails/Tauri 更简单 |
| 后端 | Gin | Go 生态最成熟的 HTTP 框架 |
| 前端 | 原生 HTML/JS | 复杂度不需要 React/Vue，零构建加速 CI |
| 天气抓取 | goquery + uTLS | 聚合多源天气；uTLS 解决 CMA 反爬 TLS 指纹 |

## 目录结构

```
app/
├── cmd/desktop/      桌面应用入口：启动 Gin 服务 → 创建 webview 窗口
├── cmd/server/       纯 HTTP 入口：仅启动 Gin，无窗口
├── core.go           App 单例 + Gin 路由装配 + 静态文件 + CORS
├── routes/           各业务路由注册 + handler（file/weather/holiday/festival/status）
├── services/
│   ├── weather/      四个天气数据源实现（CMA/NMC/墨迹/天气网）
│   ├── weather_service.go        多源聚合 + 缓存 + 字段级合并
│   ├── location_service.go       IP 定位（离线 + 在线）
│   ├── notify_service.go         通知发送（macOS Messages / 微信）
│   └── auto_weather_notify_service.go  定时天气通知
└── utils/            配置、缓存、日志、常量
static/
├── pages/            index.html 外壳 + todo_manager / weather_view / calendar_view / festival_manager
└── js/business/      按页面 + common 共享模块组织的业务 JS
```

## 核心流程一览

- **启动**：`main(cmd/desktop)` → `GetApp()`（`InitConstants` + `NewApp` + `Setup`）→ `StartServer()`（拉起天气通知定时器 + `Router.Run(:3030)`）→ 轮询就绪后 `webview.Navigate("http://127.0.0.1:3030")`。
- **请求主干**：页面 iframe `fetch` → Gin 路由 → `routes` handler（绑定/校验/组装 JSON）→ `services`（业务）→ `utils`/外部源/文件（含两级缓存）。
- **四页面**：任务管理器（文件读写）、天气查询（四源并发聚合）、日历视图（农历+节假日+节日）、节日管理（节日配置 + 节假日缓存）。各自调用链详见对应页面文档。

> 平台差异、并发模型、错误处理等横切内容，见 [architecture/04-infrastructure.md](architecture/04-infrastructure.md)。
