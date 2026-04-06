#!/bin/bash

# 加载环境变量。为了保证使用 supervisor 服务启动时，不会因环境变量的问题导致无法正常启动
source $HOME/.bash_profile

# 设置脚本在出错时退出
export NODE_ENV=development

# 检查是否已安装pnpm
echo "检查pnpm环境..."
if command -v pnpm &> /dev/null
then
    echo "pnpm已安装，版本: $(pnpm --version)"
else
    echo "警告: 未安装pnpm，正在尝试使用npm安装..."
    npm install -g pnpm
    if [ $? -ne 0 ]
    then
        echo "错误: pnpm安装失败，请手动安装pnpm。"
        exit 1
    fi
fi

# 进入脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

echo "当前目录: $SCRIPT_DIR"

# 检查并安装依赖
echo "检查项目依赖..."
if [ -d "node_modules" ]; then
    echo "node_modules目录已存在，跳过安装。"
else
    echo "正在安装依赖..."
    pnpm install
    if [ $? -ne 0 ];
    then
        echo "依赖安装失败，请检查网络或package.json文件。"
        exit 1
    fi
    echo "依赖安装成功！"
fi

# 读取配置文件中的端口号
PORT=$(jq -r '.server.ports.node' "$SCRIPT_DIR/data/config/app_config.json")
if [ "$PORT" == "null" ]; then
    echo "使用默认端口号: $PORT"
    PORT=3000
fi

function openUrlInBrowser(){
    sleep 2 && open http://localhost:$PORT/
}

# 检查服务端口是否被占用
echo "检查服务端口 $PORT 是否被占用..."
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
# case "$TERM_PROGRAM" in
#     "Apple_Terminal"|"iTerm.app"|"Alacritty"|"Hyper"|"WezTerm")
#         # 属于常见终端 App，启动服务并自动打开浏览器
#         openUrlInBrowser & pnpm start
#         ;;
#     *)
#         # 其他环境（如 VS Code 内置终端、CI、SSH 等）仅启动服务
#         echo "当前环境 $TERM_PROGRAM 不是常见终端 App，跳过打开浏览器。"
#         pnpm start
#         ;;
# esac
pnpm start