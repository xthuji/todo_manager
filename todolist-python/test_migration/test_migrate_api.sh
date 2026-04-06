#!/bin/bash

# API 接口对比测试脚本
# 功能：自动化 启动 -> 比较配置 -> 运行测试 -> 清理环境
# 用途：测试 Python 迁移后，后端接口是否功能正常

# --- 配置与常量 ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 项目目录名
BASE_PROJECT_NAME="todolist"  # 基准项目目录名
MIGRATE_PROJECT_NAME="todolist-python"  # 迁移项目目录名

# 项目显示名称
BASE_PROJECT_DISPLAY_NAME="Node.js"  # 基准项目显示名称
MIGRATE_PROJECT_DISPLAY_NAME="Python"  # 迁移项目显示名称

# 项目目录路径
MIGRATE_PROJECT_DIR="$(dirname "$SCRIPT_DIR")"  # 迁移项目目录
BASE_PROJECT_DIR="$(dirname "$MIGRATE_PROJECT_DIR")/$BASE_PROJECT_NAME"  # 基准项目目录

# 配置文件路径
CONFIG_FILE="$MIGRATE_PROJECT_DIR/data/config/app_config.json"

# 默认端口
BASE_PORT=3000  # 基准项目端口
MIGRATE_PORT=3001  # 迁移项目端口

# 项目元数据
# 格式：名字 | 目录 | 端口|PID 文件 | 日志文件
PROJECTS=(
    "基准项目($BASE_PROJECT_DISPLAY_NAME)|$BASE_PROJECT_DIR|$BASE_PORT|$SCRIPT_DIR/base.pid|$SCRIPT_DIR/base.log"
    "迁移项目($MIGRATE_PROJECT_DISPLAY_NAME)|$MIGRATE_PROJECT_DIR|$MIGRATE_PORT|$SCRIPT_DIR/migrate.pid|$SCRIPT_DIR/migrate.log"
)

# 测试结果文件
TEST_RESULT_FILE="$SCRIPT_DIR/api_comparison_result.json"

# --- 辅助工具函数 ---
log() { echo -e "[\033[1;34mINFO\033[0m] $1"; }
warn() { echo -e "[\033[1;33mWARN\033[0m] $1"; }
err() { echo -e "[\033[1;31mERROR\033[0m] $1"; }
success() { echo -e "[\033[1;32mOK\033[0m] $1"; }

# --- 通用函数 ---



# 清理所有环境
clean_env() {
    local name dir port pid_file log_file
    for p in "${PROJECTS[@]}"; do
        IFS='|' read -r name dir port pid_file log_file <<< "$p"
        
        # 清理缓存
        if [[ -d "$dir/data/cache" ]]; then
            rm -rf "$dir/data/cache"/*
            log "清理 $name 缓存"
        fi
        
        # 清理旧文件
        rm -f "$pid_file" "$log_file"
    done
    # 清理测试结果文件
    rm -f "$TEST_RESULT_FILE"
}

# 对比配置文件
compare_configs() {
    local migrate_cfg="$MIGRATE_PROJECT_DIR/data/config"
    local base_cfg="$BASE_PROJECT_DIR/data/config"

    log "正在对比配置文件..."
    if [[ ! -d "$migrate_cfg" || ! -d "$base_cfg" ]]; then
        warn "配置目录不完整，跳过对比"; return
    fi

    # 使用 diff -r 快速对比目录差异
    if diff -qr "$migrate_cfg" "$base_cfg" > /dev/null; then
        success "所有配置文件完全一致"
    else
        warn "配置文件存在差异:"
        diff -r -u "$migrate_cfg" "$base_cfg" | sed 's/^/  /'
    fi
}

# 启动项目
start_project() {
    local name="$1"
    local dir="$2"
    local port="$3"
    local pid_file="$4"
    local log_file="$5"
    
    log "启动 $name (Port: $port)..."
    pushd "$dir" > /dev/null
    
    # 基准项目：使用默认端口启动
    chmod +x start.sh
    ./start.sh > "$log_file" 2>&1 &
    
    echo $! > "$pid_file"
    popd > /dev/null
}

# 停止项目
stop_project() {
    local name="$1"
    local pid_file="$2"
    
    if [[ -f "$pid_file" ]]; then
        local pid=$(cat "$pid_file")
        log "停止 $name (PID: $pid)..."
        kill -15 "$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null
        rm -f "$pid_file"
    fi
}

# 管理服务器
manage_servers() {
    local action=$1 # start 或 stop
    
    for p in "${PROJECTS[@]}"; do
        IFS='|' read -r name dir port pid_file log_file <<< "$p"
        
        if [[ "$action" == "start" ]]; then
            start_project "$name" "$dir" "$port" "$pid_file" "$log_file"
        else
            stop_project "$name" "$pid_file"
        fi
    done
    
    [[ "$action" == "start" ]] && sleep 5
}

# 检查项目健康状态
check_project_health() {
    local name="$1"
    local port="$2"
    
    log "检查 $name 健康状态 (Port: $port)..."
    
    # 重试 3 次，每次间隔 1 秒
    local retry=3
    while [[ $retry -gt 0 ]]; do
        if curl -s "http://localhost:$port/api/check-status" > /dev/null 2>&1; then
            success "$name 服务器在线"
            return 0
        else
            retry=$((retry - 1))
            if [[ $retry -gt 0 ]]; then
                sleep 1
            else
                err "$name 服务器响应异常"
                return 1
            fi
        fi
    done
}

# 检查所有服务器健康状态
check_health() {
    local all_healthy=true
    
    for p in "${PROJECTS[@]}"; do
        IFS='|' read -r name dir port pid_file log_file <<< "$p"
        if ! check_project_health "$name" "$port"; then
            all_healthy=false
        fi
    done
    
    if [[ "$all_healthy" == true ]]; then
        log "所有服务器在线"
        return 0
    else
        return 1
    fi
}

# 恢复基准项目启动端口
restore_base_port() {
    log "恢复基准项目配置（无需修改）"
}

# --- 执行流程 ---

echo "=========================================="
echo "   迁移 API 接口对比测试"
echo "=========================================="
echo ""


# 检查基准项目目录是否存在
if [[ ! -d "$BASE_PROJECT_DIR" ]]; then
    err "基准项目（$BASE_PROJECT_DISPLAY_NAME）目录不存在：$BASE_PROJECT_DIR"
    err "请确保 $BASE_PROJECT_NAME 目录与 $MIGRATE_PROJECT_NAME 目录在同一层级"
    exit 1
fi

# 捕获退出信号，确保清理
trap "manage_servers 'stop'; restore_base_port" EXIT INT TERM

compare_configs
clean_env
manage_servers "start"

if check_health; then
    echo ""
    log "开始执行 API 接口对比测试..."
    echo ""
    
    # 运行 Python 测试脚本
    if [[ -f "$SCRIPT_DIR/test_api_comparison.py" ]]; then
        python3 "$SCRIPT_DIR/test_api_comparison.py" \
            --base-port "$BASE_PORT" \
            --migrate-port "$MIGRATE_PORT" \
            --base-name "$BASE_PROJECT_DISPLAY_NAME" \
            --migrate-name "$MIGRATE_PROJECT_DISPLAY_NAME" \
            --output-dir "$SCRIPT_DIR"
        TEST_EXIT_CODE=$?
    else
        err "测试脚本不存在：$SCRIPT_DIR/test_api_comparison.py"
        TEST_EXIT_CODE=1
    fi
else
    echo ""
    err "测试中止：环境检查未通过"
    TEST_EXIT_CODE=1
fi

manage_servers "stop"
restore_base_port

# 整理收尾
if [[ $TEST_EXIT_CODE -eq 0 ]]; then
    rm -f "$SCRIPT_DIR"/*.log "$SCRIPT_DIR"/*.pid
    echo ""
    success "测试完成，日志文件已清理"
fi

echo ""
echo "=========================================="
log "流程结束 (退出码：$TEST_EXIT_CODE)"

exit $TEST_EXIT_CODE
