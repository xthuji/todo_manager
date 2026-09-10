#!/bin/bash
#
# TodoManager - Server Start Script
# 用途：启动纯HTTP服务端进程（不使用Wails桌面框架）
#

# 获取当前脚本所在目录（必须在使用前定义）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# 切换到脚本所在目录，确保程序能正确找到相对路径的配置文件
cd "$SCRIPT_DIR" || exit 1
# 引入公共配置读取脚本
source "$SCRIPT_DIR/config_utils.sh"

# 读取配置
PORT=$(read_config "server.ports.go" "3002")

echo "使用端口号: $PORT"
echo "🚀 待办事项管理系统 - 服务端启动脚本"
echo "============================================="

# 检查可执行文件是否存在，不存在则编译
EXEC_FILE="$SCRIPT_DIR/todolist-server"
build_type=""
if [ ! -f "$EXEC_FILE" ]; then
    echo "⚠️  未找到可执行文件，尝试编译..."
    build_type="y"
else
    read -p "是否需要重新编译？（y/n 默认y）：" -n 1 -t 3 build_type
    echo ""
fi
if [[ "$build_type" != "n" ]]; then
    # 编译app/cmd/server/server.go文件
    go build -o $EXEC_FILE app/cmd/server/server.go 2>&1
    if [ $? -ne 0 ]; then
        echo "❌ 编译失败，请先安装Go并运行 go mod tidy"
        exit 1
    fi
    echo "✅ 编译成功"
fi

# 检查服务是否已经在运行
if lsof -i :$PORT > /dev/null 2>&1; then
    echo "⚠️  服务端口 $PORT 已被占用，正在关闭占用进程..."
    # 关闭占用端口的进程
    lsof -i :$PORT | grep LISTEN | awk '{print $2}' | xargs kill -9 > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ 成功关闭占用端口的进程"
    else
        echo "❌ 关闭占用端口的进程失败，请手动关闭"
        exit 1
    fi
    sleep 1
fi


# 启动应用
echo "🚀 启动待办事项管理系统服务端..."
echo "访问地址: http://localhost:$PORT"
echo "按 Ctrl+C 停止服务"
echo ""

# 设置GIN_MODE为release模式，减少日志输出
export GIN_MODE=release

# 启动Go应用（纯HTTP服务器模式）
"$EXEC_FILE"

# 启动完成后删除可执行文件
rm -f "$EXEC_FILE"
echo "✅ 应用已关闭，可执行文件已删除"