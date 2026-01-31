#!/bin/bash

# 获取脚本所在目录的绝对路径
TEST_DIR="$(dirname "$0")"
PROJECT_DIR="$(dirname "$0")/.."

# 配置文件路径（使用Python项目自己的配置文件）
CONFIG_FILE="$PROJECT_DIR/data/config/app_config.json"

# 读取配置文件中的Python路径
if [ -f "$CONFIG_FILE" ]; then
  PYTHON_EXECUTABLE=$(jq -r '.python.executable_path' "$CONFIG_FILE")
  # 替换波浪号为绝对路径
  PYTHON_EXECUTABLE=$(echo "$PYTHON_EXECUTABLE" | sed "s#^~#$HOME#")
  echo "从配置文件读取Python路径: $PYTHON_EXECUTABLE"
else
  # 默认Python路径
  PYTHON_EXECUTABLE="python3"
  echo "配置文件不存在，使用默认Python路径: $PYTHON_EXECUTABLE"
fi

# 检查Python 3是否安装
if ! command -v "$PYTHON_EXECUTABLE" &> /dev/null
 then
    echo "错误：未找到Python 3，请先安装Python 3"
    exit 1
fi

# 设置测试目录和日志目录
TEST_DIR="$(dirname "$0")"
PROJECT_DIR="$(dirname "$0")/.."
LOGS_DIR="$PROJECT_DIR/logs"

# 确保日志目录存在
mkdir -p "$LOGS_DIR"

# 设置 Python 路径，确保能找到 app 模块
export PYTHONPATH="$PROJECT_DIR:$PYTHONPATH"
echo "设置 PYTHONPATH: $PYTHONPATH"

# 清除之前的测试标志
rm -f "$TEST_DIR/.test_success"

# 执行所有Python测试文件
function run_all_tests() {
    echo "\n===================="
    echo "开始运行所有测试文件..."
    echo "===================="
    
    # 查找所有Python测试文件
    test_files=($TEST_DIR/*.py)
    
    if [ ${#test_files[@]} -eq 0 ]; then
        echo "错误：未找到测试文件！"
        return 1
    fi
    
    # 初始化总体测试结果
    overall_result=0
    
    # 遍历并执行每个测试文件
    for test_file in "${test_files[@]}"; do
        filename=$(basename "$test_file")
        echo "\n----- 运行测试: $filename ------"
        
        if "$PYTHON_EXECUTABLE" "$test_file" 2>&1 | tee "$LOGS_DIR/${filename%.py}_test.log"; then
            echo "✅ 测试通过: $filename"
        else
            echo "❌ 测试失败: $filename"
            overall_result=1
        fi
    done
    
    return $overall_result
}

# 运行测试
run_all_tests
test_result=$?

# 生成测试报告
echo "\n===================="
echo "测试结果汇总"
echo "===================="

# 检查测试结果
if [ $test_result -eq 0 ]; then
    echo "✅ 所有测试通过！"
    touch "$TEST_DIR/.test_success"
    exit 0
else
    echo "❌ 部分测试失败！"
    exit 1
fi
