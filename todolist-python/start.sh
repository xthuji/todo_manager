#!/bin/bash

# 启动服务脚本

# 引入公共配置读取脚本
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/config_utils.sh"

# 读取配置
PORT=$(read_server_port)
PYTHON_EXECUTABLE=$(read_python_executable)

echo "使用端口号: $PORT"
echo "使用Python路径: $PYTHON_EXECUTABLE"

echo "🚀 待办事项管理系统启动脚本"
echo "============================"

# 检查是否存在Python 3
if ! command -v "$PYTHON_EXECUTABLE" &> /dev/null; then
    echo "❌ 未找到Python 3，请先安装Python 3"
    exit 1
fi

function openUrlInBrowser(){
    sleep 2 && open http://localhost:$PORT/
}

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
fi


# 启动应用
echo "🚀 启动待办事项管理系统..."
echo "访问地址: http://localhost:$PORT"
echo "按 Ctrl+C 停止服务"
echo ""
# 获取当前脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# 设置 Python 路径，确保能找到 app 模块
export PYTHONPATH="$SCRIPT_DIR:$PYTHONPATH"
echo "设置 PYTHONPATH: $PYTHONPATH"
# 判断当前运行环境是否为 macOS 终端类 App（Terminal.app / iTerm.app / Alacritty 等）
case "$TERM_PROGRAM" in
    "Apple_Terminal"|"iTerm.app"|"Alacritty"|"Hyper"|"WezTerm")
        # 属于常见终端 App，启动服务并自动打开浏览器
        openUrlInBrowser & "$PYTHON_EXECUTABLE" "$SCRIPT_DIR/app/app.py"
        ;;
    *)
        # 其他环境（如 VS Code 内置终端、CI、SSH 等）仅启动服务
        echo "当前环境 $TERM_PROGRAM 不是常见终端 App，跳过打开浏览器。"
        "$PYTHON_EXECUTABLE" "$SCRIPT_DIR/app/app.py"
        ;;
esac

