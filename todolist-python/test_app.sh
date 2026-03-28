#!/bin/bash

# 引入公共配置读取脚本
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/config_utils.sh"

# 读取配置
# PYTHON_PATH=$(read_python_executable)
# PYTHON_PATH="$HOME/miniconda3/envs/python39/bin/python3"
PYTHON_PATH=$(jq -r '.python_path' "${HOME}/common_config.json" | sed "s#~#$HOME#g")

echo "从配置文件读取Python路径: $PYTHON_PATH"

# 运行 App
echo "正在启动测试 App..."
$PYTHON_PATH "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/app.py"

