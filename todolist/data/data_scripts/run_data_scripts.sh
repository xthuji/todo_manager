#!/bin/bash

# 数据脚本执行工具
# 用于初始化或刷新天气数据编码

# 脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# 项目根目录
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../" && pwd)"
# Node.js 路径
NODE_PATH=$(which node || which nodejs || echo "node")

# 输出彩色文本的函数
print_green() {
    echo -e "\033[32m$1\033[0m"
}

print_blue() {
    echo -e "\033[34m$1\033[0m"
}

print_red() {
    echo -e "\033[31m$1\033[0m"
}

print_yellow() {
    echo -e "\033[33m$1\033[0m"
}

# 检查Node.js是否可用
check_node() {
    if ! command -v "${NODE_PATH}" &> /dev/null; then
        print_red "错误: 未找到Node.js，请先安装Node.js"
        exit 1
    fi
    print_green "✓ Node.js 已找到"
}

# 执行单个脚本的函数
execute_script() {
    local script_name="$1"
    local script_path="${SCRIPT_DIR}/${script_name}"
    
    print_blue "正在执行: ${script_name}"
    
    if [ -f "${script_path}" ]; then
        "${NODE_PATH}" "${script_path}"
        if [ $? -eq 0 ]; then
            print_green "✓ ${script_name} 执行成功"
        else
            print_red "✗ ${script_name} 执行失败"
            return 1
        fi
    else
        print_red "✗ ${script_name} 文件不存在"
        return 1
    fi
    
    echo
}

# 主函数
main() {
    print_yellow "===================================="
    print_yellow "     天气数据编码初始化工具     "
    print_yellow "===================================="
    
    # 检查Node.js
    check_node
    
    echo
    print_blue "开始执行数据脚本..."
    echo
    
    # 1. 首先执行数据转换脚本
    execute_script "convert_tianqi_city_to_area_codes.js"
    if [ $? -ne 0 ]; then
        print_red "数据转换失败，退出执行"
        exit 1
    fi
    
    # 2. 并行执行三个数据源抓取脚本
    print_blue "开始并行执行数据源抓取脚本..."
    
    # 创建临时文件来存储并行执行的结果
    TEMP_DIR=$(mktemp -d)
    RESULT_FILE1="${TEMP_DIR}/result1.txt"
    RESULT_FILE2="${TEMP_DIR}/result2.txt"
    RESULT_FILE3="${TEMP_DIR}/result3.txt"
    
    # 并行执行脚本
    execute_script "fetch_cma_area_codes.js" > "${RESULT_FILE1}" 2>&1 &
    PID1=$!
    
    execute_script "fetch_moji_area_codes.js" > "${RESULT_FILE2}" 2>&1 &
    PID2=$!
    
    execute_script "fetch_nmc_area_codes.js" > "${RESULT_FILE3}" 2>&1 &
    PID3=$!
    
    # 等待所有并行任务完成
    wait ${PID1}
    wait ${PID2}
    wait ${PID3}
    
    # 输出执行结果
    print_green "中国气象局数据抓取结果:"
    cat "${RESULT_FILE1}"
    echo
    
    print_green "墨迹天气数据抓取结果:"
    cat "${RESULT_FILE2}"
    echo
    
    print_green "中央气象台数据抓取结果:"
    cat "${RESULT_FILE3}"
    echo
    
    # 清理临时文件
    rm -rf "${TEMP_DIR}"
    
    # 3. 最后执行数据合并脚本
    execute_script "merge_all_weather_codes.js"
    if [ $? -ne 0 ]; then
        print_red "数据合并失败，退出执行"
        exit 1
    fi
    
    print_green "===================================="
    print_green "     数据脚本执行完成！     "
    print_green "===================================="
    print_green "数据已保存到: ${PROJECT_ROOT}/todolist/data/weather/"
}

# 执行主函数
main