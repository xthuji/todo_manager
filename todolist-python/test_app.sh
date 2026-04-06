#!/bin/bash

# 获取当前脚本所在目录（必须在使用前定义）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# 切换到脚本所在目录，确保程序能正确找到相对路径的配置文件
cd "$SCRIPT_DIR" || exit 1
# 引入公共配置读取脚本
source "$SCRIPT_DIR/config_utils.sh"

# 读取配置
# PYTHON_PATH=$(read_python_executable)
# PYTHON_PATH="$HOME/miniconda3/envs/python39/bin/python3"
PYTHON_PATH=$(jq -r '.python_path' "${HOME}/common_config.json" | sed "s#~#$HOME#g")

echo "从配置文件读取Python路径: $PYTHON_PATH"

# 运行 App
echo "正在启动测试 App..."
$PYTHON_PATH "$SCRIPT_DIR/app.py"

