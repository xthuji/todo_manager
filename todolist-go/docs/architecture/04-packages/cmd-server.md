# 包：app/cmd/server（纯 HTTP 服务入口）

> 生成时间：2026-08-01 ｜ 代码版本：master@d6f93a4

## 1. 定位与边界

`cmd/server` 是纯 HTTP 服务端的 `main` 包，不启动 webview 窗口。用于无 GUI 环境调试或服务化部署场景。

## 2. 目录结构

```
app/cmd/server/
└── server.go
```

## 3. 核心功能列表

- 调用 `app.GetApp()` 装配应用
- 调用 `StartServer()` 启动 HTTP 服务（含定时通知 goroutine）

## 4. 关键类型与职责

### [StartServer](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/cmd/server/server.go#L9)

包装 `app.GetApp().StartServer()`，便于扩展。

### [main](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/cmd/server/server.go#L20)

入口函数，调用 `StartServer()`，失败则 `log.Fatalf`。

## 5. 对外 API

`main` 包无导出 API。

## 6. 依赖关系

- **import**：`todolist-go/app`、`log`

## 7. 并发模型

无自身并发；并发由 `app.StartServer` 内部启动的定时通知 goroutine 承担。

## 8. 错误处理

`StartServer` 错误直接 `log.Fatalf` 退出进程。

## 9. 平台适配

无平台特定代码，可在所有 Go 支持的平台运行。

## 10. 配置项

无；端口由 `app.GetApp()` 从配置读取。

## 11. 使用方式

```bash
# 直接运行
go run ./app/cmd/server

# 或编译后运行
go build -o TodoManagerServer ./app/cmd/server
./TodoManagerServer
```

> 此入口未在 [build.sh](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/build.sh) 中构建，仅用于开发调试。生产构建始终使用 `./app/cmd/desktop`。
