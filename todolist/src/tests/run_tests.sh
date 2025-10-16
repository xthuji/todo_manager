#!/bin/bash

# 检查Node.js是否安装
if ! command -v node &> /dev/null
then
    echo "错误：未找到Node.js，请先安装Node.js"
    exit 1
fi

# 设置测试目录和日志目录
TEST_DIR="$(dirname "$0")"
PROJECT_DIR="$(dirname "$(dirname "$TEST_DIR")")"
LOGS_DIR="$PROJECT_DIR/logs"

# 确保日志目录存在
mkdir -p "$LOGS_DIR"

# 清除之前的测试标志
rm -f "$TEST_DIR/.test_success"

# 执行节日测试（合并了节假日、农历和节日配置测试）
function run_festival_test() {
    echo "\n===================="
    echo "开始运行节日测试..."
    echo "===================="
    if node "$TEST_DIR/test_festivals.js" 2>&1 | tee "$LOGS_DIR/festival_test.log";
    then
        echo "节日测试通过！"
        return 0
    else
        echo "节日测试出现问题，但测试已完成。"
        return 1
    fi
}

# 运行测试
run_festival_test
festival_test_result=$?

# 生成测试报告
echo "\n===================="
echo "测试结果汇总"
echo "===================="

# 检查测试结果
if [ $festival_test_result -eq 0 ]; then
    echo "✅ 节日测试通过！"
    touch "$TEST_DIR/.test_success"
    exit 0
else
    echo "❌ 节日测试失败！"
    exit 1
fi

# 显示最近5个月的测试结果摘要
echo "\n最近5个月的节日计算和农历信息计算测试结果："
echo "测试概览："
if [ $holiday_test_result -eq 0 ];
then
    echo "- 节假日计算：成功"
else
    echo "- 节假日计算：部分功能可能受限"
fi

if [ $lunar_test_result -eq 0 ];
then
    echo "- 农历信息计算：成功"
else
    echo "- 农历信息计算：部分功能可能受限"
fi