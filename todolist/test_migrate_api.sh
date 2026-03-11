#!/bin/bash

# API 接口对比测试脚本
# 功能：自动化 启动 -> 比较配置 -> 运行测试 -> 清理环境

# --- 配置与常量 ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_PROJECT_DIR="$SCRIPT_DIR"
PYTHON_PROJECT_DIR="$(dirname "$SCRIPT_DIR")/todolist-python"

CONFIG_FILE="$NODE_PROJECT_DIR/data/config/app_config.json"
# 默认值
PORT_NODE=3000
PORT_PYTHON=3001
PYTHON_EXEC="python3"

# --- 辅助工具函数 ---
log() { echo -e "[\033[1;34mINFO\033[0m] $1"; }
warn() { echo -e "[\033[1;33mWARN\033[0m] $1"; }
err() { echo -e "[\033[1;31mERROR\033[0m] $1"; }

# 加载配置
if [[ -f "$CONFIG_FILE" ]]; then
    PORT_NODE=$(jq -r '.server.ports.node // 3000' "$CONFIG_FILE")
    PORT_PYTHON=$(jq -r '.server.ports.python // 3001' "$CONFIG_FILE")
    PYTHON_EXEC=$(jq -r '.python.executable_path // "python3"' "$CONFIG_FILE" | sed "s#^~#$HOME#")
    log "从配置加载: Node:$PORT_NODE, Python:$PORT_PYTHON, Exec:$PYTHON_EXEC"
else
    warn "配置文件不存在，使用默认参数"
fi

# 定义项目元数据 (简化后续循环处理)
# 格式: 名字|目录|端口|PID文件|日志文件
PROJECTS=(
    "Node.js|$NODE_PROJECT_DIR|$PORT_NODE|$NODE_PROJECT_DIR/server1.pid|$NODE_PROJECT_DIR/server1.log"
    "Python|$PYTHON_PROJECT_DIR|$PORT_PYTHON|$NODE_PROJECT_DIR/server2.pid|$NODE_PROJECT_DIR/server2.log"
)

# --- 核心业务逻辑 ---

clean_env() {
    local name dir port pid_file log_file
    for p in "${PROJECTS[@]}"; do
        IFS='|' read -r name dir port pid_file log_file <<< "$p"
        # 清理缓存
        [[ -d "$dir/data/cache" ]] && rm -rf "$dir/data/cache"/* && log "清理 $name 缓存"
        # 清理旧文件
        rm -f "$pid_file" "$log_file"
    done
}

compare_configs() {
    local node_cfg="$NODE_PROJECT_DIR/data/config"
    local py_cfg="$PYTHON_PROJECT_DIR/data/config"
    
    log "正在对比配置文件..."
    if [[ ! -d "$node_cfg" || ! -d "$py_cfg" ]]; then
        warn "配置目录不完整，跳过对比"; return
    fi

    # 使用 diff -r 快速对比目录差异
    if diff -qr "$node_cfg" "$py_cfg" > /dev/null; then
        log "✅ 所有配置文件完全一致"
    else
        warn "❌ 配置文件存在差异:"
        diff -r -u "$node_cfg" "$py_cfg" | sed 's/^/  /'
    fi
}

manage_servers() {
    local action=$1 # start 或 stop
    for p in "${PROJECTS[@]}"; do
        IFS='|' read -r name dir port pid_file log_file <<< "$p"
        
        if [[ "$action" == "start" ]]; then
            log "启动 $name (Port: $port)..."
            pushd "$dir" > /dev/null
            chmod +x start.sh
            ./start.sh > "$log_file" 2>&1 &
            echo $! > "$pid_file"
            popd > /dev/null
        else
            if [[ -f "$pid_file" ]]; then
                local pid=$(cat "$pid_file")
                log "停止 $name (PID: $pid)..."
                kill -15 "$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null
                rm -f "$pid_file"
            fi
        fi
    done
    [[ "$action" == "start" ]] && sleep 3
}

check_health() {
    for p in "${PROJECTS[@]}"; do
        IFS='|' read -r name dir port pid_file log_file <<< "$p"
        if ! curl -s "http://localhost:$port/api/check-status" > /dev/null; then
            err "$name 服务器响应异常"
            return 1
        fi
    done
    log "所有服务器在线"
    return 0
}

# --- 执行流程 ---

echo "=========================================="
echo "      API 接口对比测试工作流"
echo "=========================================="

clean_env
compare_configs
manage_servers "start"

if check_health; then
    log "开始执行测试脚本..."
    node "$NODE_PROJECT_DIR/test_api_comparison.js"
    TEST_EXIT_CODE=$?
else
    err "测试中止：环境检查未通过"
    TEST_EXIT_CODE=1
fi

manage_servers "stop"

# 整理收尾
[[ $TEST_EXIT_CODE -eq 0 ]] && rm -f "$NODE_PROJECT_DIR"/*.log

echo "=========================================="
log "流程结束 (退出码: $TEST_EXIT_CODE)"
exit $TEST_EXIT_CODE