# 新人上手指南

> 生成时间：2026-08-01 ｜ 代码版本：master@d6f93a4

本指南帮助新成员在 30 分钟内完成环境搭建、启动应用并跑通第一个改动。

## 1. 前置准备

| 项 | 要求 | 验证命令 |
|---|---|---|
| Go | 1.25.0+（[go.mod](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/go.mod) 指定） | `go version` |
| Git | 任意版本 | `git --version` |
| macOS | 13+（桌面应用目标平台） | `sw_vers` |
| Xcode CLT | 必需（cgo + Cocoa） | `xcode-select -p` |
| WebKit 系统库 | 仅 Linux 构建桌面应用时需要 | `pkg-config --exists webkit2gtk-4.0 && echo OK` |

> 提示：若仅参与后端开发（不构建桌面应用），可只装 Go，用 `app/cmd/server` 入口调试，无需 webview 系统库。

## 2. 拉取与导入

```bash
git clone <项目地址>
cd todo_manager/todolist-go

# 安装依赖
go mod tidy
```

若 GOPROXY 未配置，建议：

```bash
go env -w GOPROXY=https://goproxy.cn,direct
go env -w GOSUMDB=sum.golang.google.cn
```

## 3. 配置本地环境

项目所需配置文件已在仓库内（[data/config/](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/data/config)），无需额外配置即可启动。

可选项：

- 修改 [data/config/app_config.json](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/data/config/app_config.json) 调整端口或超时
- 启用 Mock：将 `features.mock.enabled` 设为 `true`，天气与位置将使用 [data/mock/](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/data/mock) 中的数据，避免调用外部 API
- 关闭缓存：将 `features.cache.enabled` 设为 `false`，便于调试

## 4. 启动服务

### 方式 A：纯 HTTP 服务（推荐后端开发）

```bash
go run ./app/cmd/server
# 或
go build -o /tmp/TodoManagerServer ./app/cmd/server && /tmp/TodoManagerServer
```

访问 http://127.0.0.1:3002 验证。

### 方式 B：桌面应用（推荐体验完整功能）

```bash
./test_app.sh
```

[test_app.sh](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/test_app.sh) 会：检查 Go → 安装依赖 → 清理旧产物 → 编译 `./app/cmd/desktop` → 释放 3002 端口 → 启动窗口。

### 方式 C：IDE 调试

在 IntelliJ IDEA / VS Code 中配置 Go Run/Debug：

- Package: `todolist-go/app/cmd/desktop`（桌面）或 `todolist-go/app/cmd/server`（服务端）
- Working directory: 项目根
- 程序参数：无

## 5. 验证启动成功

| 检查项 | 方法 |
|---|---|
| HTTP 服务 | `curl http://127.0.0.1:3002/api/check-status` 应返回 `{"success":true,...}` |
| 日志 | 查看 `data/logs/app.log`，应有"启动服务器"与"静态文件目录存在" |
| 桌面窗口 | 应弹出标题为"TodoManager"的 1000×800 窗口，加载首页 |
| 定时通知 | 若 `notify_config.json` 的 `startupNotifyEnabled=true`，日志会打印通知结果 |

## 6. 第一个任务：新增一个 API 接口

以新增"获取任务统计"接口为例，走完从路由到测试的完整流程。

### Step 1：新增路由

在 [app/routes/file_routes.go](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/routes/file_routes.go) 的 `RegisterFileRoutes` 中添加：

```go
fileGroup.GET("/stats", getFileStats)
```

### Step 2：实现 handler

在同一文件添加：

```go
func getFileStats(c *gin.Context) {
    data := scanFilesLogic()
    files, _ := data["files"].([]map[string]interface{})
    c.JSON(http.StatusOK, map[string]interface{}{
        "success": true,
        "count":   len(files),
        "files":   files,
    })
}
```

### Step 3：验证

```bash
go build ./...
go run ./app/cmd/server
curl http://127.0.0.1:3002/api/file/stats
```

### Step 4：（可选）补测试

在 [tests/](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/tests) 下新建 `test_file_stats_test.go`，参考已有测试风格编写。

### Step 5：跑测试

```bash
./tests/run_tests.sh
# 或直接
go test ./tests/... -v
```

成功后会生成 `tests/.test_success` 标志文件。

## 7. 推荐学习路径

按以下顺序阅读文档与源码，建立全局认知：

1. **[01-overview.md](01-overview.md)**：项目定位与技术栈
2. **[03-business-architecture.md](03-business-architecture.md)**：业务域与核心流程（看时序图）
3. **源码**：[app/core.go](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/core.go)（装配）→ [app/routes/](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/routes)（任选一个路由文件）→ [app/services/weather_service.go](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/weather_service.go)（最复杂的服务）
4. **[02-tech-architecture.md](02-tech-architecture.md)**：横切关注点（缓存/并发/日志）
5. **[04-packages/utils.md](04-packages/utils.md)**：基础设施
6. **[05-adr/](05-adr/)**：理解关键决策的"为什么"
7. **[07-dev-guide.md](07-dev-guide.md)**：开发规范与构建部署
