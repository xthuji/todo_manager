# TodoManager

[![Go](https://img.shields.io/badge/Go-1.25+-00ADD8?logo=go&logoColor=white)](https://go.dev/dl/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/xthuji/todo_manager?label=release)](https://github.com/xthuji/todo_manager/releases)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey)](https://github.com/xthuji/todo_manager/releases)

> **本项目由 AI 辅助编程开发** —— Go 后端、前端页面与 JS、天气数据抓取解析、单元测试、架构文档均由 AI 协作生成，人工负责方案设计、代码评审与功能验证。详见 [AI 协作说明](#ai-协作说明)。

TodoManager 是一个**本地运行、零部署依赖**的跨平台桌面待办事项管理应用，基于 Go + [webview_go](https://github.com/webview/webview_go)。以 `todo.txt` 纯文本文件为数据中心，集成任务管理、日历视图、节假日/节日管理、多源天气查询与定时通知。

## 特性一览

- **任务管理** — 遵循 [todo.txt](http://todotxt.org/) 格式（优先级 / `due:` / `+项目` / `@上下文`），增删改查、完成归档
- **多文件管理** — 多个 todo 文件切换、导入导出，文件即数据
- **日历视图** — 公历 + 农历（节气/干支）+ 法定节假日「休/班」+ 自定义节日，整月同屏
- **多源天气** — 并发抓取 CMA / 中央气象台 / 墨迹天气 / 天气网四源，**字段级互补合并**，单源失效不阻塞
- **定时通知** — cron 表达式触发的天气播报，支持 macOS Messages 短信与微信公众号推送
- **跨平台** — macOS universal (amd64 + arm64) / Linux amd64 / Windows amd64
- **零构建前端** — 原生 HTML/CSS/JS，无需 npm，改完刷新即生效

## 技术栈

| 层 | 选型 |
|---|---|
| 桌面框架 | [webview_go](https://github.com/webview/webview_go)（原生窗口 + 内嵌浏览器） |
| 后端 | Go 1.25 · [Gin](https://github.com/gin-gonic/gin) 1.9 |
| 前端 | 原生 HTML / CSS / JavaScript（无框架、零构建） |
| 天气抓取 | [goquery](https://github.com/PuerkitoBio/goquery) · [uTLS](https://github.com/refraction-networking/utls) |
| 数据 | `todo.txt` 纯文本 + JSON 配置 + 两级缓存（内存 / 文件），**无数据库** |
| 日志 | `log/slog` 结构化日志 |
| CI/CD | GitHub Actions，tag 触发三平台自动构建发布 |

## 快速开始

### 下载

前往 [Releases](https://github.com/xthuji/todo_manager/releases) 下载对应平台产物：

| 平台 | 文件 | 安装与运行条件 |
|---|---|---|
| macOS | `TodoManager_v*_macos.dmg` | universal 包（amd64 + arm64），需 **macOS 12 Monterey 及以上**；拖入 Applications |
| Linux | `TodoManager_v*_linux_amd64.tar.gz` | 解压后运行 `TodoManager`；需预装 `libwebkit2gtk-4.1-0` 与 `libgtk-3-0` |
| Windows | `TodoManager_v*_windows_amd64.zip` | 解压后运行 `TodoManager.exe`；需系统已装 **WebView2 Runtime**（Win 10 1803+ 默认自带） |

> macOS 产物**未做 Apple 开发者签名与公证**（仅 ad-hoc 签名），首次打开若被 Gatekeeper 拦截提示“已损坏”，请**右键应用选“打开”**确认一次。

### 环境要求

| 平台 | 要求 |
|---|---|
| 通用 | Go 1.25+（国内建议 `go env -w GOPROXY=https://goproxy.cn,direct`） |
| macOS | Xcode Command Line Tools（`xcode-select --install`） |
| Linux | 无（`./scripts/run_tools.sh build` 会自动 apt 安装 GTK3/WebKit2GTK 开发包并处理 pkg-config 别名；手动安装为 `sudo apt install pkg-config libgtk-3-dev libwebkit2gtk-4.1-dev`） |
| Windows | Go + Git Bash（CGO 环境） |

### 从源码运行

```bash
git clone https://github.com/xthuji/todo_manager.git
cd todo_manager

# 最轻量：纯 HTTP 服务端（不需要 webview，用浏览器访问）
go run ./app/cmd/server
# → http://127.0.0.1:3030

# 桌面应用（交互菜单）
./scripts/run_tools.sh

# 指定命令
./scripts/run_tools.sh build    # 构建 + 打包发布产物到 dist/
./scripts/run_tools.sh run      # 构建并前台运行桌面 App
./scripts/run_tools.sh test     # 运行单元测试（go test -race）
./scripts/run_tools.sh clean    # 清理构建产物
```

## 项目结构

```
├── app/
│   ├── cmd/desktop/      桌面入口：起 Gin 服务 → 开 webview 窗口
│   ├── cmd/server/       纯 HTTP 入口（无 GUI）
│   ├── routes/           路由注册 + handler（file/weather/holiday/festival/status）
│   ├── services/         天气聚合、IP 定位、通知发送、定时调度
│   │   └── weather/      四个数据源各自的抓取与解析
│   ├── utils/            配置、缓存、日志、常量
│   └── core.go           App 单例 + 路由装配 + 静态文件 + CORS
├── static/
│   ├── pages/            index.html 外壳 + 四个业务页面（iframe 装载）
│   └── js/business/      按页面组织的业务 JS
├── data/
│   ├── config/           app_config / notify_config / festival_config
│   ├── weather/          各源区域编码映射表
│   ├── mock/             Mock 模式静态数据
│   ├── todo.txt          默认任务文件
│   └── logs|cache/       运行时生成（已 gitignore）
├── docs/
│   ├── ARCHITECTURE.md   架构文档入口
│   └── architecture/     按页面维度组织的技术文档 + 上手指南
├── tests/                Go 单元测试
├── scripts/              run_tools.sh / release.sh / git_commit_release.sh
└── .github/workflows/    release.yml（tag 触发三平台构建）
```

## 配置

所有配置位于 `data/config/`，**无需任何环境变量**；文件缺失时程序会自动创建目录并回落到默认值。

| 文件 | 说明 |
|---|---|
| `app_config.json` | 服务端口（默认 3030）、各源 API 超时、默认城市、Mock / 缓存开关、日志开关 |
| `notify_config.json` | 通知城市、cron 表达式、手机号 / 微信 AppId・AppSecret・OpenId |
| `festival_config.json` | 自定义节日列表（公历 / 农历） |

> ⚠️ `notify_config.json` 一旦被填入手机号或微信密钥，即属**个人凭据**。程序只读取该固定文件名，因此它**不在 `.gitignore` 范围内**——开源 / 共享仓库前请先将其恢复为空模板（字段值置 `""`、`notifyEnabled` 置 `false`），真实凭据只留在本地。

**Mock 模式**：把 `features.mock.enabled` 设为 `true`，天气与定位接口将返回 `data/mock/` 中的静态数据，可完全离线开发。

## 架构概览

```
用户 ←→ webview_go 窗口 ←→ Gin HTTP (127.0.0.1:3030) ←→ 业务服务
                                                              ↓
                                                         外部 API
                                                    (天气 / 节假日 / 微信)
```

桌面应用启动时在本地 `127.0.0.1:3030` 拉起 Gin 服务，webview 加载本地页面与之交互。后端负责文件读写、外部 API 抓取、缓存与通知；数据以 `map[string]interface{}` 前后端透传，无 ORM、无实体类。

详细文档：

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 文档索引与架构速览
- [docs/architecture/01-overview.md](docs/architecture/01-overview.md) — 系统上下文、页面地图、技术栈与选型理由
- [docs/architecture/06-onboarding.md](docs/architecture/06-onboarding.md) — 新人上手指南
- [docs/architecture/08-faq.md](docs/architecture/08-faq.md) — 常见问题排查

## 发布

```bash
# 1. 更新版本号
echo "1.0.3" > version.txt

# 2. 提交 + 推送 + 打 tag（一条龙，交互式）
./scripts/git_commit_release.sh

# 或分步：只提交推送不发布
./scripts/git_commit_release.sh -m "docs: 更新 README" --no-release -y

# 3. 或单独触发发布（读 version.txt 打 tag 并推送）
./scripts/release.sh --dry-run   # 预览
./scripts/release.sh             # 执行
```

推送 `v*` tag 后，GitHub Actions 在 macOS / Linux / Windows 三个 runner 上并行构建，macOS 侧编译双架构后用 `lipo` 合并为 universal 二进制，产物自动上传至 GitHub Release。

## 隐私与数据

- **本地优先**：任务数据只存于本机 `data/todo.txt`，应用不含任何遥测、统计或账号系统
- **对外请求**：仅在查询天气 / 定位 / 节假日时访问公开接口，桌面服务本身只监听 `127.0.0.1`，不对外暴露端口
- **IP 定位**：调用公开气象站点接口获取省市级别位置，可在页面手动选择地区替代
- **通知凭据**：手机号、微信 AppId / AppSecret / OpenId 仅存于本地配置文件，代码中不含任何默认凭据

## AI 协作说明

本项目采用 **AI 辅助编程**（AI-assisted coding）方式开发，AI 参与范围包括：

| 环节 | AI 参与内容 |
|---|---|
| Go 后端 | 路由 / service / 缓存 / 日志实现，四源抓取与字段级合并逻辑 |
| 前端 | 页面结构、业务 JS 模块、农历与日历渲染算法 |
| 测试 | 单元测试用例与测试脚本 |
| 文档 | `docs/architecture/` 全部技术文档、README、本说明 |
| 工程化 | 构建与发布脚本、GitHub Actions 工作流 |

人工职责：需求界定与技术选型决策、代码评审、跨平台真机验证、安全与合规把关。

需要说明的是：AI 生成内容可能存在**与代码实际不符的文档描述**或**未覆盖的边界情况**。因此项目约定「文档与代码同仓库、发现不符以代码为准」，若你在使用中发现任何描述与实现不一致，欢迎提 Issue 指出。

## 免责与合规

- 天气数据抓取自公开站点页面，**仅供个人学习与技术研究使用**；请自行遵守各数据源的服务条款与 `robots.txt`，商用请改接官方授权 API
- 法定节假日数据来自第三方开源镜像，实际放假安排以**国务院官方公告**为准
- macOS 短信通知依赖本机 Messages.app（`osascript`），仅 macOS 可用；微信推送需自行申请公众号并配置密钥
- 本项目按 **MIT** 协议开源，不含任何明示或默示的担保

## License

[MIT License](LICENSE)

---

*Made with AI assistance · 如果这个项目对你有帮助，欢迎 Star 与 PR*
