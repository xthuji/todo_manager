#!/bin/bash

# 启动服务脚本

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 配置文件路径（使用Python项目自己的配置文件）
CONFIG_FILE="$SCRIPT_DIR/data/config/app_config.json"

# 读取配置文件中的端口号
PORT=$(jq -r '.server.ports.python' "$CONFIG_FILE")
PYTHON_EXECUTABLE=$(jq -r '.python.executable_path' "$CONFIG_FILE" | sed "s#^~#$HOME#")
if [ "$PORT" == "null" ]; then
    PORT=3001
    echo "使用默认端口号: $PORT"
fi
if [ "$PYTHON_EXECUTABLE" == "null" ]; then
    PYTHON_EXECUTABLE="$HOME/miniconda3/envs/python39/bin/python3"
    echo "使用默认Python路径: $PYTHON_EXECUTABLE"
fi

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

