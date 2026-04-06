#!/bin/bash
#
# TodoManager - Desktop App Launcher (Native Webview Edition)
# 用途：安装依赖 -> 清理缓存 -> 重新编译 -> 启动 App 窗口
#

# 1. 获取脚本所在目录并切换
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

echo "🖥️  待办事项管理系统 - 原生桌面版 (Webview)"
echo "================================================"

# 2. 环境检查
if ! command -v go &> /dev/null; then
    echo "❌ 错误: 未检测到 Go 环境，请先安装 Go"
    exit 1
fi

# 检查可执行文件是否存在，不存在则编译
EXEC_FILE="$SCRIPT_DIR/todolist-app"
build_type=""
if [ ! -f "$EXEC_FILE" ]; then
    echo "⚠️  未找到可执行文件，尝试编译..."
    build_type="y"
else
    read -p "是否需要重新编译？（y/n 默认y）：" -n 1 -t 3 build_type
    echo ""
fi
if [[ "$build_type" != "n" ]]; then
    # 3. 安装/更新依赖 (Webview Go)
    echo "📦 正在检查依赖 (首次运行可能需要几分钟下载 Webview 库)..."
    go get github.com/webview/webview_go
    go mod tidy
    
    # 4. 强制清理旧文件 (关键：防止运行到旧版代码)
    echo "🧹 正在清理旧缓存与二进制文件..."
    go clean -cache 2>/dev/null
    rm -f $EXEC_FILE
    echo "✅ 清理完成"
    
    # 5. 强制重新编译
    echo "🔨 正在编译最新代码..."
    # 使用原生 Webview 库，不需要 Wails 的 build tags，普通 build 即可
    go build -ldflags "-s -w" -o $EXEC_FILE ./app/cmd/desktop
    
    if [ $? -ne 0 ]; then
        echo "❌ 编译失败，请检查上方终端输出的错误信息"
        exit 1
    fi
    echo "✅ 编译成功 (已生成最新版本的 $EXEC_FILE)"
fi

# 6. 清理端口占用 (防止上次异常退出导致端口残留)
PORT=3002
if lsof -i :$PORT > /dev/null 2>&1; then
    echo "⚠️  端口 $PORT 被占用，正在释放..."
    lsof -i :$PORT | grep LISTEN | awk '{print $2}' | xargs kill -9 > /dev/null 2>&1
    sleep 1
    echo "✅ 端口已释放"
fi

# 7. 启动 App 窗口
echo "🚀 启动独立 App 窗口..."
echo "💡 提示: 关闭窗口或按 Ctrl+C 可退出应用"
echo "================================================"
$EXEC_FILE
# 启动完成后删除可执行文件
rm -f "$EXEC_FILE"
echo "✅ 应用已关闭，可执行文件已删除"