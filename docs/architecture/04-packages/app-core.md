# 包：app（应用装配）

> 生成时间：2026-08-01 ｜ 代码版本：master@d6f93a4

## 1. 定位与边界

`app` 包是**应用装配层**，负责创建 Gin 引擎、注册路由与静态文件、启动 HTTP 服务与定时通知任务。它**不包含业务逻辑**，业务逻辑下沉到 `routes` 与 `services`。

## 2. 目录结构

```
app/
├── core.go                 # App 结构体与装配
├── cmd/                    # 可执行入口（独立 main 包）
├── routes/                 # HTTP 路由层
├── services/               # 业务服务层
└── utils/                  # 工具层
```

## 3. 核心功能列表

- 创建全局 `App` 实例（懒加载单例）
- 配置 CORS 中间件
- 注册 API 路由组（file/holiday/festival/status/weather）
- 注册页面路由（`/`、`/pages/:filename`、兼容路径）
- 注册静态文件路由（`/static`、`/assets`、`/src/client/assets`）
- 启动 HTTP 服务（`StartServer`）
- 启动天气通知定时器（goroutine）
- 提供 `Shutdown` 方法（未在桌面入口调用）

## 4. 关键类型与职责

### [App](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/core.go#L18)

应用核心结构体，持有 Gin 引擎、静态目录、端口。

```go
type App struct {
    Router    *gin.Engine
    StaticDir string
    Port      int
}
```

### [NewApp](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/core.go#L25)

构造函数，从配置读取端口（`app.server.ports.go`，默认 3002），定位 `static/` 目录。

### [Setup](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/core.go#L45)

应用配置入口，按顺序：CORS → API 路由 → 页面路由 → 静态文件。

### [GetApp](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/core.go#L171)

全局懒加载单例工厂。首次调用时执行 `InitConstants()` + `NewApp()` + `Setup()`。

### [StartServer](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/core.go#L140)

启动 HTTP 服务入口。先 `go services.StartWeatherNotifyTimer()`，再 `Router.Run(:port)`。

## 5. 对外 API

| 标识符 | 类型 | 说明 |
|---|---|---|
| `App` | struct | 应用实例 |
| `NewApp()` | func | 构造 |
| `(*App).Setup()` | method | 注册中间件与路由 |
| `(*App).StartServer()` | method | 启动 HTTP（阻塞） |
| `(*App).GetServer()` | method | 返回 `*http.Server` |
| `(*App).Shutdown()` | method | 关闭服务器 |
| `GetApp()` | func | 全局单例工厂 |

## 6. 依赖关系

- **import**：`app/routes`、`app/services`、`app/utils`、`github.com/gin-gonic/gin`、`net/http`、`os`、`path/filepath`、`strings`
- **被 import**：`app/cmd/desktop`、`app/cmd/server`

## 7. 并发模型

- `appInstance` 全局变量未加锁，[GetApp](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/core.go#L171) 的懒加载**非 goroutine 安全**。当前调用时机均在主 goroutine 启动早期，未触发问题，但理论上有竞态。
- `StartServer` 在 goroutine 中启动定时通知任务。

## 8. 错误处理

- `Setup` 中静态目录不存在仅 warn 不 panic。
- `StartServer` 直接返回 `Router.Run` 的错误。
- `Shutdown` 中 `server.Shutdown(nil)` 传入 nil context，是已知问题（应传 `context.Background()`）。

## 9. 平台适配

无平台特定代码。

## 10. 配置项

| 配置 key | 默认值 | 说明 |
|---|---|---|
| `app.server.ports.go` | 3002 | HTTP 端口 |
