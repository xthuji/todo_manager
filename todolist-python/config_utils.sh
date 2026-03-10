#!/bin/bash

# 公共配置读取工具脚本

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 配置文件路径
CONFIG_FILE="$SCRIPT_DIR/data/config/app_config.json"

# 从配置文件读取值的函数
# 参数1: 配置键路径（如 "python.executable_path"）
# 参数2: 默认值
read_config() {
  local key_path=$1
  local default_value=$2
  
  if [ -f "$CONFIG_FILE" ]; then
    # 使用 jq 读取配置值，确保路径格式正确
    local jq_path=".${key_path//./.}"
    local value=$(jq -r "$jq_path" "$CONFIG_FILE")
    if [ "$value" != "null" ]; then
      echo "$value"
      return
    fi
  fi
  
  # 返回默认值
  echo "$default_value"
}

# 读取 Python 可执行文件路径
read_python_executable() {
  local python_path=$(read_config "python.executable_path" "~/miniconda3/envs/python39/bin/python3")
  # 替换波浪号为绝对路径
  echo "$(echo $python_path | sed "s#^~#$HOME#")"
}

# 读取服务端口号
read_server_port() {
  local port=$(read_config "server.ports.python" "3001")
  echo "$port"
}

# 读取 pip 路径
read_pip_path() {
  local python_path=$(read_python_executable)
  echo "$(dirname "$python_path")/pip"
}

# 读取 pyinstaller 路径
read_pyinstaller_path() {
  local python_path=$(read_python_executable)
  echo "$(dirname "$python_path")/pyinstaller"
}

# 导出函数供其他脚本使用
export -f read_config
export -f read_python_executable
export -f read_server_port
export -f read_pip_path
export -f read_pyinstaller_path