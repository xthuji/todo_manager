# 常见问题

> 生成时间：2026-08-01 ｜ 代码版本：master@d6f93a4

## 1. 启动相关

### Q1：端口 3002 被占用怎么办？

A：[test_app.sh](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/test_app.sh) 会自动检测并用 `lsof` 释放端口。若手动启动，可执行：

```bash
lsof -i :3002 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

或修改 [data/config/app_config.json](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/data/config/app_config.json) 的 `server.ports.go` 字段，**但 [app/cmd/desktop/app.go](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/cmd/desktop/app.go#L38) 中端口硬编码为 3002**，需同步修改（已知技术债）。

### Q2：启动桌面应用后窗口空白？

A：可能原因：

1. **HTTP 服务未启动**：查看终端日志是否有"HTTP Server listening on 127.0.0.1:3002"
2. **waitForServer 超时**：5 秒内 HTTP 服务未就绪，桌面入口会 `return` 但进程不退出；查看日志是否有"后端服务启动超时"
3. **静态目录找不到**：日志会 warn"静态文件目录不存在"，检查 `static/pages/index.html` 是否存在
4. **webview 系统库缺失**：Linux 需安装 `webkit2gtk-4.0`，Windows 需 WebView2 Runtime

### Q3：日志在哪里？

A：`data/logs/app.log`，同时输出到 stdout。详见 [logger_util.go](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/utils/logger_util.go#L38)。

### Q4：为什么 .app 双击启动后能找到 static/ 和 data/？

A：[getProjectRoot](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/utils/config_util.go#L53) 检测可执行文件路径，若包含 `.app/Contents/MacOS`，返回 `Contents/Resources` 目录。[build.sh](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/build.sh#L121) 在打包时将 `static/` 与 `data/` 复制到该目录。

## 2. 天气相关

### Q5：天气数据总是返回过期缓存？

A：[WeatherOptions](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/weather_service.go#L21-L24) 设置了 `AllowExpired: true`，作为兜底。即使所有数据源都失败，也会返回上次的缓存数据。

刷新方法：请求时加 `?forceRefresh=true`，例如：

```bash
curl "http://127.0.0.1:3002/api/weather/weather-info?weatherCode=101210101&forceRefresh=true"
```

### Q6：CMA 数据总是失败怎么办？

A：CMA 接口使用 uTLS 绕过 TLS 指纹检测（见 [ADR-0007](05-adr/0007-uTLS-绕过-CMA-反爬.md)）。可能原因：

1. **uTLS 指纹版本过期**：CMA 升级检测后需更新 `utls.HelloChrome_120` 到新版本
2. **网络问题**：CMA 服务自身故障
3. **超时**：调整 `app_config.json` 的 `server.api_timeout_weather_utls`（默认 20s）

诊断方法：开启 `PRINT_API_DATA=true` 查看完整错误响应。

### Q7：天气数据不完整（某些字段为空）？

A：[BuildWeatherData](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/weather_service.go#L78) 的完整性门控要求 8 项数据全部非空才缓存。若某源失败，本次结果不会缓存，下次请求会重新抓取。临时方案：开启 `USE_MOCK=true` 用 [data/mock/mock_weather_info.json](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/data/mock/mock_weather_info.json) 调试前端。

### Q8：墨迹天气返回的 HTML 解析不到数据？

A：墨迹天气页面结构变更会导致 [ExtractMojiWeatherData](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/weather/weather_moji_service.go#L58) 的 goquery 选择器失效。需用浏览器查看新结构，更新选择器（如 `.wea_info .wea_weather em`）。

## 3. 通知相关

### Q9：定时天气通知不工作？

A：**这是已知功能差距**。[StartWeatherNotifyTimer](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/auto_weather_notify_service.go#L222) 仅在启动时执行一次即时通知（若 `startupNotifyEnabled=true`），**未实现真正的 cron 调度**——`cronExpression` 仅用于日志展示。

临时方案：

- 设置 `startupNotifyEnabled=true`，每次启动应用时收到一次通知
- 或用系统 crontab 调用 `curl POST /api/...`（但目前无对应 API 触发通知）

### Q10：短信通知失败？

A：[SendSMSMessage](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/services/notify_service.go#L123) 通过 macOS `osascript` 调用 Messages.app，限制：

1. **仅 macOS 可用**：Linux/Windows 无 `osascript`
2. **Messages.app 需登录 iCloud 账号**
3. **接收方需在 Messages 联系人中**或为有效的手机号/邮箱
4. **首次发送需用户在 Messages.app 中确认权限**

### Q11：微信通知失败，errcode 不为 0？

A：常见 errcode：

| errcode | 含义 | 解决 |
|---|---|---|
| 40001 | access_token 无效 | 等待缓存过期自动刷新，或重启应用 |
| 45015 | 用户 48 小时内未与公众号交互 | 用户先发送任意消息给公众号 |
| 48002 | 公众号无客服消息权限 | 检查公众号类型（订阅号无此权限，需服务号） |

### Q12：`wechatAppSecret` 泄露风险？

A：[notify_config.json](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/data/config/notify_config.json) 明文存储 AppSecret。建议：

1. 不要将此文件提交到公开仓库
2. 分发 .app 时确保该文件不包含真实凭据
3. `.gitignore` 中可考虑忽略 `data/config/notify_config.json`

## 4. 缓存相关

### Q13：缓存文件在哪里？

A：`data/cache/<safe_key>.json`。safe_key 由 [getSafeKey](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/utils/cache_util.go#L117) 将非 `[a-zA-Z0-9_-]` 字符替换为 `_` 生成。

### Q14：如何手动清空所有缓存？

A：删除 `data/cache/` 目录下所有 `.json` 文件：

```bash
rm -f data/cache/*.json
```

重启应用后内存缓存也会清空。

### Q15：禁用缓存后性能下降明显？

A：禁用缓存（`features.cache.enabled=false`）后每次请求都会调用外部 API，天气查询会变慢（~10s）。建议仅在调试时禁用，生产环境保持启用。

## 5. 构建相关

### Q16：macOS 构建报错"cgo: C compiler not found"？

A：安装 Xcode Command Line Tools：

```bash
xcode-select --install
```

[app_darwin.go](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/cmd/desktop/app_darwin.go) 用 cgo 调用 Cocoa，必须有 clang。

### Q17：Linux 构建报错"webview.h not found"？

A：安装 WebKitGTK 开发库：

```bash
# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.0-dev

# Fedora
sudo dnf install webkit2gtk3-devel
```

### Q18：Windows 构建报错？

A：Windows 桌面构建需 WebView2 Runtime。可从 [Microsoft 官网](https://developer.microsoft.com/microsoft-edge/webview2/) 下载。同时需安装 MinGW-w64 或 MSYS2。

### Q19：构建产物体积太大？

A：[build.sh](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/build.sh#L77) 已用 `-ldflags "-s -w"` 去除符号表与 DWARF 调试信息。若仍想减小：

- 不打包 `data/mock/`（仅调试用）
- 压缩 `static/` 中的 JS/CSS（目前未压缩）
- 用 UPX 压缩可执行文件（`upx --best dist/TodoManager`）

### Q20：交叉编译到 Windows 但没装 Windows 环境？

A：[build.sh](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/build.sh#L92-L95) 用 `GOOS=windows GOARCH=amd64` 交叉编译，**但 webview_go 在 Windows 下需要 CGO 与 WebView2 头文件**，纯交叉编译可能失败。建议在 Windows 机器上构建，或用 GitHub Actions 的 Windows runner。

## 6. 其他

### Q21：项目与 Python 版什么关系？

A：Todolist-Go 由 Python + Webview 版本迁移而来，代码注释中多处保留 `对应 Python ...` 字样。API 路径与响应结构与 Python 版完全对齐，前端静态资源可零改动复用。[app_config.json](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/data/config/app_config.json) 仍保留 `node`/`python` 端口配置，用于多语言版本共存调试。

### Q22：如何调试 webview 中的前端？

A：[webview.New(true)](file:///Users/huji/work/MyProject/code_mine/gitee/todo_manager/todolist-go/app/cmd/desktop/app.go#L94) 第二个参数 `true` 启用调试模式，macOS 下可右键"检查元素"。也可直接用浏览器访问 http://127.0.0.1:3002 调试。

### Q23：测试跑不过怎么办？

A：

1. 检查 `data/` 目录是否完整（部分测试依赖 `data/weather/merged_weather_area_codes.json`）
2. 用 `go test -v ./tests/...` 查看详细输出
3. 用 `go test -race ./tests/...` 检测竞态
4. 测试日志在 `logs/<test_file>_test.log`

### Q24：如何贡献代码？

A：

1. 阅读本文档与 [07-dev-guide.md](07-dev-guide.md)
2. 遵循现有代码风格（中文注释、map 返回、错误携带 `"error"` key）
3. 新增功能必须补测试
4. 提交前跑 `./tests/run_tests.sh` 确保通过
5. 涉及架构变更需更新 [docs/architecture/](.)
