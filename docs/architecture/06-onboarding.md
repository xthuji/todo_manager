# 新人上手指南

> 生成时间：2026-09-10 ｜ 代码版本：master@40a4f33 ｜ 应用版本：v1.0.2

## 1. 前置准备

| 依赖 | 版本要求 | 安装方式 |
|---|---|---|
| Go | 1.25+ | [go.dev/dl](https://go.dev/dl/)（版本从 go.mod 确认） |
| macOS CLT | 最新 | `xcode-select --install` |
| webkit2gtk 开发包 | Ubuntu 24.04+ 用 4.1，旧版用 4.0 | 可不管：`run_tools.sh` 构建时会自动 apt 补齐并处理 `webkit2gtk-4.0.pc` 别名；手动为 `sudo apt install pkg-config libgtk-3-dev libwebkit2gtk-4.1-dev` |
| Git | 任意 | 系统自带或 brew install git |

**GOPROXY 配置**（国内网络建议）：
```bash
go env -w GOPROXY=https://goproxy.cn,direct
```

## 2. 拉取与导入

```bash
git clone https://github.com/xthuji/todo_manager.git
cd todo_manager

# 下载依赖
go mod download

# 验证依赖完整性
go mod verify
```

**IDE 建议**：GoLand 或 VS Code + Go 插件（gopls 自动配置）。

## 3. 配置本地环境

项目**无需任何环境变量**。配置全部在 `data/config/` 下的 JSON 文件中：

| 文件 | 必须 | 说明 |
|---|---|---|
| `app_config.json` | ✅ | 端口（默认 3030）、超时、开关 |
| `notify_config.json` | ❌ | 定时通知配置（空文件即可） |
| `festival_config.json` | ❌ | 自定义节日 |

如果 `data/config/` 目录不存在或配置文件缺失，`ConfigUtil` 会自动创建目录并返回空配置/默认值。

## 4. 启动服务

### 方式一：纯 HTTP 服务端（推荐开发用，最快）

```bash
# 方式 A：直接 go run
go run ./app/cmd/server

# 方式 B：构建后运行
./scripts/run_tools.sh server
```

然后打开浏览器访问 http://127.0.0.1:3030

### 方式二：桌面应用

```bash
./scripts/run_tools.sh run
```

或者：
```bash
# macOS 专用
./scripts/run_tools.sh build
open dist/TodoManager.app
```

### 方式三：测试 Mock 模式

如果想在离线环境下开发天气功能：

1. 编辑 `data/config/app_config.json`，设置：
```json
{
  "features": {
    "mock": { "enabled": true }
  }
}
```
2. 重启应用，天气接口会返回 `data/mock/mock_weather_info.json` 中的静态数据。

## 5. 验证启动成功

```bash
# 健康检查
curl http://127.0.0.1:3030/api/check-status
# → {"success":true,"message":"服务正在运行"}

# 扫描 todo 文件
curl http://127.0.0.1:3030/api/file/scan
# → {"success":true,"files":[...],"defaultFile":"todo.txt"}

# 天气查询（需要在 Mock 模式或有网络）
curl http://127.0.0.1:3030/api/weather/ip-location
curl "http://127.0.0.1:3030/api/weather/weather-info?weatherCode=101210101"
```

## 6. 第一个任务：新增一个 API 接口

让我们**从零开始**，在天气路由里加一个"健康检查增强接口"——返回各数据源的可用性状态。

### 步骤 1：在 routes 层添加 Handler

在 `app/routes/weather_routes.go` 的 `RegisterWeatherRoutes` 里注册新路由：

```go
func RegisterWeatherRoutes(router *gin.Engine) {
    weatherGroup := router.Group("/api/weather")
    weatherGroup.GET("/ip-location", getIPLocation)
    weatherGroup.GET("/weather-area-codes", getWeatherAreaCodes)
    weatherGroup.GET("/weather-info", getWeatherInfo)
    weatherGroup.GET("/health", weatherHealth)  // ← 新增
}

// 新增的 Handler
func weatherHealth(c *gin.Context) {
    c.JSON(http.StatusOK, map[string]interface{}{
        "success": true,
        "data": map[string]interface{}{
            "cma":   "ok",
            "nmc":   "ok",
            "moji":  "ok",
            "tianqi": "ok",
        },
        "timestamp": time.Now().UnixMilli(),
    })
}
```

### 步骤 2：编译验证

```bash
go build ./app/cmd/server
# 应该无错误
```

### 步骤 3：运行并测试

```bash
./scripts/run_tools.sh server
curl http://127.0.0.1:3030/api/weather/health
```

### 步骤 4：写单元测试

如果你想为这个新功能补测试，在同目录创建 `weather_routes_test.go`：

```go
package routes

import (
    "testing"
    "net/http"
    "net/http/httptest"
    "github.com/gin-gonic/gin"
)

func TestWeatherHealth(t *testing.T) {
    gin.SetMode(gin.TestMode)
    r := gin.New()
    RegisterWeatherRoutes(r)

    req, _ := http.NewRequest("GET", "/api/weather/health", nil)
    w := httptest.NewRecorder()
    r.ServeHTTP(w, req)

    if w.Code != http.StatusOK {
        t.Errorf("Expected 200, got %d", w.Code)
    }
}
```

## 7. 推荐学习路径

```
第 1 周：先建立「页面维度」的整体认知
├── 读 docs/ARCHITECTURE.md（入口）+ docs/architecture/01-overview.md（App 页面地图 + 映射总表）
├── 读 docs/architecture/02-pages/00-app-shell.md（外壳如何装载四个页面）
├── 在本地把服务跑起来
└── 打开浏览器逐一点侧边栏四个页面，对照 Network 面板理解请求-响应

第 2 周：跟着你最关心的业务页深入
├── 读 docs/architecture/02-pages/weather.md（四源聚合，最复杂链路）
├── 读 docs/architecture/02-pages/todo.md（文件读写 + 缓存失效）
├── 读 docs/architecture/04-infrastructure.md（配置/缓存/日志/并发 等地基）
├── 回头对照 docs/architecture/01-overview.md §6.1，理解为什么这么选型
└── 尝试改一下天气合并逻辑（BuildWeatherData），跑 go test

第 3 周：补齐其余页面与工程化
├── 读 02-pages/calendar.md + 02-pages/festival.md（农历/节假日/节日闭环）
├── 了解前端 static/js/business/ 按页面组织的业务代码
├── 完整跑一遍三平台构建（./scripts/run_tools.sh build）
└── 读 docs/architecture/07-dev-guide.md 了解规范
```

## 8. 调试技巧

### 开启详细日志

编辑 `data/config/app_config.json`：
```json
{
  "logs": {
    "print_api_data": true,
    "print_data_log": true
  }
}
```

日志输出在 `data/logs/app.log`。

### HTTP 请求调试

服务跑起来后，直接用浏览器打开 http://127.0.0.1:3030 ，打开 DevTools 查看 Network 面板。桌面应用模式下 webview 支持右键检查元素（`webview_go.New(true)` 开启了调试模式）。

### Mock 模式调试

```json
{
  "features": {
    "mock": { "enabled": true }
  }
}
```

天气接口会返回静态 mock 数据，位置接口返回 `data/mock/mock_ip_area.json`。

### 清理缓存

缓存文件在 `data/cache/` 下，直接删除即可让下次请求重新拉取。

---

*文档生成于 2026-09-10，基于代码版本 master@40a4f33。*
