#!/bin/bash

# 获取脚本所在目录的绝对路径
TEST_DIR="$(dirname "$0")"
PROJECT_DIR="$(dirname "$0")/.."

# 日志目录
LOGS_DIR="$PROJECT_DIR/logs"

# 确保日志目录存在
mkdir -p "$LOGS_DIR"

# 清除之前的测试标志
rm -f "$TEST_DIR/.test_success"

# 执行所有Go测试文件
function run_all_tests() {
    echo "\n===================="
    echo "开始运行所有测试文件..."
    echo "===================="

    # 查找所有Go测试文件
    test_files=($TEST_DIR/*_test.go)

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

        # 使用go test运行测试
        if go test -v -cover "$test_file" 2>&1 | tee "$LOGS_DIR/${filename%.go}_test.log"; then
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
