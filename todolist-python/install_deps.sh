#!/bin/bash

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 配置文件路径（使用Python项目自己的配置文件）
CONFIG_FILE="$SCRIPT_DIR/data/config/app_config.json"

# 读取配置文件中的Python路径
if [ -f "$CONFIG_FILE" ]; then
  PYTHON_EXECUTABLE=$(jq -r '.python.executable_path' "$CONFIG_FILE")
  # 替换波浪号为绝对路径
  PYTHON_EXECUTABLE=$(echo "$PYTHON_EXECUTABLE" | sed "s#^~#$HOME#")
  PIP_PATH="$(dirname "$PYTHON_EXECUTABLE")/pip3"
  echo "从配置文件读取Python路径: $PYTHON_EXECUTABLE"
  echo "从配置文件读取pip路径: $PIP_PATH"
else
  # 默认Python路径
  PYTHON_EXECUTABLE="$HOME/miniconda3/envs/python39/bin/python3"
  PIP_PATH="$HOME/miniconda3/envs/python39/bin/pip3"
  echo "配置文件不存在，使用默认Python路径: $PYTHON_EXECUTABLE"
  echo "配置文件不存在，使用默认pip路径: $PIP_PATH"
fi

echo "📦 待办事项管理系统依赖安装脚本"
echo "==============================="

# 检查Python和pip是否存在
if [ ! -f "$PYTHON_EXECUTABLE" ] || [ ! -f "$PIP_PATH" ]; then
    [ ! -f "$PYTHON_EXECUTABLE" ] && echo "❌ 未找到指定的Python路径: $PYTHON_EXECUTABLE"
    [ ! -f "$PIP_PATH" ] && echo "❌ 未找到指定的pip路径: $PIP_PATH"
    exit 1
fi

echo "✅ Python 3 已找到"
echo "✅ pip 3 已找到"

# 检查并安装依赖
if [ -f "requirements.txt" ]; then
    echo "🔍 检查项目依赖..."
    
    # 直接使用pip安装，让pip自动处理依赖检查
    echo "📦 安装项目依赖..."
    "$PIP_PATH" install -r requirements.txt
    
    if [ $? -eq 0 ]; then
        echo "✅ 依赖安装成功"
    else
        echo "❌ 依赖安装失败"
        exit 1
    fi
else
    echo "⚠️  未找到requirements.txt文件，跳过依赖检查"
fi

echo "🎉 依赖安装脚本执行完成"
