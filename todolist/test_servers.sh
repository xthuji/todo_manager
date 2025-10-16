#!/bin/bash

# API 接口对比测试脚本
# 功能：启动服务器 -> 运行测试 -> 停止服务器

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 配置文件路径
CONFIG_FILE="$SCRIPT_DIR/data/config/app_config.json"

# 读取配置文件中的端口号
  if [ -f "$CONFIG_FILE" ]; then
    PORT1=$(jq -r '.server.ports.node' "$CONFIG_FILE")
    PORT2=$(jq -r '.server.ports.python' "$CONFIG_FILE")
    PYTHON_EXECUTABLE=$(jq -r '.python.executable_path' "$CONFIG_FILE")
    # 替换波浪号为绝对路径
    PYTHON_EXECUTABLE=$(echo "$PYTHON_EXECUTABLE" | sed "s#^~#$HOME#")
    echo "从配置文件读取端口号: Node.js=$PORT1, Python=$PORT2"
    echo "从配置文件读取Python路径: $PYTHON_EXECUTABLE"
  else
    # 默认端口号
    PORT1=3000
    PORT2=3001
    PYTHON_EXECUTABLE="python3"
    echo "配置文件不存在，使用默认端口号: Node.js=$PORT1, Python=$PORT2"
    echo "使用默认Python路径: $PYTHON_EXECUTABLE"
  fi

# Node.js 项目目录（绝对路径）
NODE_PROJECT_DIR="$SCRIPT_DIR"
# Python 项目目录（绝对路径）
PYTHON_PROJECT_DIR="$(dirname "$SCRIPT_DIR")/todolist-python"

# 日志文件路径
SERVER1_LOG="$NODE_PROJECT_DIR/server1.log"
SERVER2_LOG="$NODE_PROJECT_DIR/server2.log"

# PID 文件路径
SERVER1_PID_FILE="$NODE_PROJECT_DIR/server1.pid"
SERVER2_PID_FILE="$NODE_PROJECT_DIR/server2.pid"

# 输出测试开始信息
echo "=================================="
echo "    运行 API 接口对比测试"
echo "=================================="
echo "脚本目录: $SCRIPT_DIR"
echo "Node.js 项目目录: $NODE_PROJECT_DIR"
echo "Python 项目目录: $PYTHON_PROJECT_DIR"
echo ""

# 清理之前可能存在的PID文件和日志文件
rm -f "$SERVER1_PID_FILE" "$SERVER2_PID_FILE" "$SERVER1_LOG" "$SERVER2_LOG" 2>/dev/null

# 启动 Node.js 项目服务器
echo "启动 Node.js 项目服务器 (端口: $PORT1)..."
cd "$NODE_PROJECT_DIR" && chmod +x start.sh && ./start.sh > "$SERVER1_LOG" 2>&1 &
SERVER1_PID=$!

# 等待一段时间让服务器启动
sleep 3

# 启动 Python 项目服务器
echo "启动 Python 项目服务器 (端口: $PORT2)..."
cd "$PYTHON_PROJECT_DIR" && chmod +x start.sh && ./start.sh > "$SERVER2_LOG" 2>&1 &
SERVER2_PID=$!

# 等待一段时间让服务器启动
sleep 3

# 保存PID到文件
echo $SERVER1_PID > "$SERVER1_PID_FILE"
echo $SERVER2_PID > "$SERVER2_PID_FILE"

# 检查服务器状态
echo "检查服务器状态..."

# 检查服务器是否启动成功
if curl -s "http://localhost:$PORT1/api/check-status" > /dev/null && curl -s "http://localhost:$PORT2/api/check-status" > /dev/null; then
  echo ""
  echo "服务器启动成功，开始运行测试脚本..."
  echo ""
  
  # 清理项目缓存目录
  echo "清理项目缓存目录..."
  # 清理Node.js项目缓存
  NODE_CACHE_DIR="$NODE_PROJECT_DIR/data/cache"
  if [ -d "$NODE_CACHE_DIR" ]; then
    rm -rf "$NODE_CACHE_DIR"/* 2>/dev/null
    echo "已清理Node.js项目缓存目录"
  fi
  # 清理Python项目缓存
  PYTHON_CACHE_DIR="$PYTHON_PROJECT_DIR/data/cache"
  if [ -d "$PYTHON_CACHE_DIR" ]; then
    rm -rf "$PYTHON_CACHE_DIR"/* 2>/dev/null
    echo "已清理Python项目缓存目录"
  fi
  echo ""
  
  # 运行测试脚本
  cd "$NODE_PROJECT_DIR" && node test_api_comparison.js
  
  echo ""
  echo "测试完成，停止服务器..."
  echo ""
  
  # 停止 Node.js 项目服务器
  if [ -f "$SERVER1_PID_FILE" ]; then
    SERVER1_PID=$(cat "$SERVER1_PID_FILE")
    echo "停止 Node.js 项目服务器 (PID: $SERVER1_PID)..."
    kill -15 $SERVER1_PID 2>/dev/null
    
    # 检查进程是否还在运行
    if ps -p $SERVER1_PID > /dev/null 2>&1; then
      echo "强制停止 Node.js 项目服务器..."
      kill -9 $SERVER1_PID 2>/dev/null
    fi
    
    rm -f "$SERVER1_PID_FILE"
    echo "Node.js 项目服务器已停止"
  fi
  
  # 停止 Python 项目服务器
  if [ -f "$SERVER2_PID_FILE" ]; then
    SERVER2_PID=$(cat "$SERVER2_PID_FILE")
    echo "停止 Python 项目服务器 (PID: $SERVER2_PID)..."
    kill -15 $SERVER2_PID 2>/dev/null
    
    # 检查进程是否还在运行
    if ps -p $SERVER2_PID > /dev/null 2>&1; then
      echo "强制停止 Python 项目服务器..."
      kill -9 $SERVER2_PID 2>/dev/null
    fi
    
    rm -f "$SERVER2_PID_FILE"
    echo "Python 项目服务器已停止"
  fi
  
  # 清理日志文件
  if [ -f "$SERVER1_LOG" ]; then
      rm -f "$SERVER1_LOG"
      echo "清理 Node.js 项目服务器日志"
  fi
  
  if [ -f "$SERVER2_LOG" ]; then
      rm -f "$SERVER2_LOG"
      echo "清理 Python 项目服务器日志"
  fi
  
  echo ""
  echo "测试流程完成！"
echo "=================================="
else
  echo ""
  echo "服务器启动失败，无法运行测试！"
echo "请检查服务器日志获取详细信息。"
echo ""
  
  # 尝试停止可能启动的服务器
  if [ -f "$SERVER1_PID_FILE" ]; then
    SERVER1_PID=$(cat "$SERVER1_PID_FILE")
    kill -15 $SERVER1_PID 2>/dev/null
    kill -9 $SERVER1_PID 2>/dev/null
    rm -f "$SERVER1_PID_FILE"
  fi
  
  if [ -f "$SERVER2_PID_FILE" ]; then
    SERVER2_PID=$(cat "$SERVER2_PID_FILE")
    kill -15 $SERVER2_PID 2>/dev/null
    kill -9 $SERVER2_PID 2>/dev/null
    rm -f "$SERVER2_PID_FILE"
  fi
  
  # 清理日志文件
  rm -f "$SERVER1_LOG" "$SERVER2_LOG" 2>/dev/null
  
  echo "测试流程失败！"
echo "=================================="
fi