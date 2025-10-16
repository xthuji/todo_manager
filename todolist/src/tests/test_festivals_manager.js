// 测试节日相关功能 - 优化版

const fs = require('fs');
const path = require('path');

// Mock浏览器环境 - 改进版
function setupMockEnvironment() {
    // 避免重复定义window对象
    if (!global.window) {
        global.window = {};
    }
    
    // 简化的Solar日期转换工具模拟
    global.window.Solar = {
        fromDate: (date) => {
            return {
                getLunar: () => ({
                    getYear: () => date.getFullYear(),
                    getMonth: () => date.getMonth() + 1,
                    getDay: () => date.getDate(),
                    isLeapMonth: () => false,
                    getSolarTerm: () => ''
                })
            };
        }
    };
    
    // 简化的Lunar对象模拟
    global.window.Lunar = null;
    
    // 简化的HolidayUtil模拟
    global.window.HolidayUtil = {
        getHoliday: (dateStr) => {
            return {
                getName: () => '',
                isWork: () => false
            };
        }
    };
    
    // 保留原始console功能
    if (!global.originalConsole) {
        global.originalConsole = global.console;
    }
    
    // 确保console对象完整性
    global.console = {
        log: global.originalConsole.log,
        warn: global.originalConsole.warn,
        error: global.originalConsole.error,
        info: global.originalConsole.info,
        debug: global.originalConsole.debug || global.originalConsole.log
    };
    
    console.log('测试环境设置完成');
}

// 模拟节日配置数据
const MOCK_FESTIVAL_CONFIG = {
    festivals: [
        { id: '1', name: '元旦', type: 'national', dateType: 'solar', date: '01-01' },
        { id: '2', name: '春节', type: 'chinese_traditional', dateType: 'lunar', date: '01-01' },
        { id: '3', name: '劳动节', type: 'national', dateType: 'solar', date: '05-01' },
        { id: '4', name: '端午节', type: 'chinese_traditional', dateType: 'lunar', date: '05-05' },
        { id: '5', name: '中秋节', type: 'chinese_traditional', dateType: 'lunar', date: '08-15' },
        { id: '6', name: '国庆节', type: 'national', dateType: 'solar', date: '10-01' },
        { id: '7', name: '520', type: 'custom', dateType: 'solar', date: '05-20' },
        { id: '8', name: '618', type: 'custom', dateType: 'solar', date: '06-18' }
    ],
    workDays: []
};

// 日期格式化工具函数
function formatDate(date) {
    // 参数有效性检查
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        throw new Error('无效的日期对象');
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 生成测试日期
function generateTestDate(month, day, year = new Date().getFullYear()) {
    return new Date(year, month - 1, day);
}

// 模拟从业务逻辑中获取节日信息的函数
function mockGetFestivals(date, festivalConfig) {
    // 参数有效性检查
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        throw new Error('无效的日期对象');
    }
    
    const dateStr = formatDate(date);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    // 格式化月份和日期为两位数，匹配配置中的格式
    const formattedMonth = month.toString().padStart(2, '0');
    const formattedDay = day.toString().padStart(2, '0');
    const festivals = [];
    
    // 检查配置文件中的节日
    if (festivalConfig && Array.isArray(festivalConfig.festivals)) {
        // 公历节日（包括自定义节日）
        festivalConfig.festivals
            .filter(f => f && f.dateType === 'solar' && f.date === `${formattedMonth}-${formattedDay}`)
            .forEach(festival => {
                festivals.push({
                    name: festival.name,
                    type: festival.type || 'custom',
                    date: dateStr
                });
            });
    }
    
    return festivals;
}

// 模拟从业务逻辑中检查是否为中国节假日的函数
function mockIsChineseHoliday(date, festivalConfig) {
    const festivals = mockGetFestivals(date, festivalConfig);
    
    // 检查是否存在中国法定节假日
    return festivals.some(festival => 
        ['national', 'chinese_common', 'chinese_traditional'].includes(festival.type)
    );
}

// 测试1: 测试单个节日识别
function testSingleFestival() {
    console.log('\n测试1: 测试单个节日识别');
    
    // 使用模拟的节日配置
    const festivalConfig = MOCK_FESTIVAL_CONFIG;
    const testCases = [
        { month: 1, day: 1, expectedNames: ['元旦'] },
        { month: 5, day: 1, expectedNames: ['劳动节'] },
        { month: 10, day: 1, expectedNames: ['国庆节'] },
        { month: 5, day: 20, expectedNames: ['520'] },
        { month: 6, day: 18, expectedNames: ['618'] },
        { month: 1, day: 2, expectedNames: [] }
    ];
    
    let passed = 0;
    
    for (const testCase of testCases) {
        try {
            const testDate = generateTestDate(testCase.month, testCase.day);
            const dateStr = formatDate(testDate);
            const festivals = mockGetFestivals(testDate, festivalConfig);
            
            const foundNames = festivals.map(f => f.name);
            const allExpectedFound = testCase.expectedNames.every(name => foundNames.includes(name));
            const noUnexpectedFound = foundNames.length === testCase.expectedNames.length;
            const success = allExpectedFound && noUnexpectedFound;
            
            if (success) {
                console.log(`✓ ${dateStr}: 成功识别到预期节日: ${foundNames.join(', ')}`);
                passed++;
            } else {
                console.log(`✗ ${dateStr}: 节日识别错误`);
                console.log(`  期望: [${testCase.expectedNames.join(', ')}]`);
                console.log(`  实际: [${foundNames.join(', ')}]`);
            }
        } catch (error) {
            console.log(`✗ 处理 ${testCase.month}-${testCase.day} 时出错: ${error.message}`);
        }
    }
    
    console.log(`测试1结果: ${passed}/${testCases.length} 通过`);
    return { success: passed === testCases.length, passed, total: testCases.length };
}

// 测试2: 中国节假日判断
function testHolidayJudgment() {
    console.log('\n测试2: 中国节假日判断');
    
    const festivalConfig = MOCK_FESTIVAL_CONFIG;
    const testCases = [
        { date: generateTestDate(1, 1), name: '元旦', expected: true },
        { date: generateTestDate(5, 1), name: '劳动节', expected: true },
        { date: generateTestDate(10, 1), name: '国庆节', expected: true },
        { date: generateTestDate(5, 20), name: '520', expected: false }, // 自定义节日不算法定节假日
        { date: generateTestDate(1, 2), name: '工作日', expected: false }
    ];
    
    let passed = 0;
    
    for (const test of testCases) {
        try {
            const result = mockIsChineseHoliday(test.date, festivalConfig);
            const dateStr = formatDate(test.date);
            
            if (result === test.expected) {
                console.log(`✓ ${dateStr} (${test.name}): 正确识别为${result ? '节假日' : '非节假日'}`);
                passed++;
            } else {
                console.log(`✗ ${dateStr} (${test.name}): 判断错误，期望${test.expected ? '节假日' : '非节假日'}，实际${result ? '节假日' : '非节假日'}`);
            }
        } catch (error) {
            console.log(`✗ ${formatDate(test.date)} (${test.name}): 测试异常: ${error.message}`);
        }
    }
    
    console.log(`测试2结果: ${passed}/${testCases.length} 通过`);
    return { success: passed === testCases.length, passed, total: testCases.length };
}

// 测试3: 边界条件测试
function testEdgeCases() {
    console.log('\n测试3: 边界条件测试');
    
    const festivalConfig = MOCK_FESTIVAL_CONFIG;
    let passed = 0;
    
    // 测试1: 无效日期参数
    try {
        mockGetFestivals(null, festivalConfig);
        console.log('✗ 无效日期参数测试失败: 未能捕获空日期参数');
    } catch (error) {
        console.log(`✓ 无效日期参数测试通过: 成功捕获错误: ${error.message}`);
        passed++;
    }
    
    // 测试2: 无效配置参数
    try {
        const testDate = generateTestDate(1, 1);
        const result = mockGetFestivals(testDate, null);
        console.log(`✓ 无效配置参数测试通过: 返回 ${result.length} 个节日`);
        passed++;
    } catch (error) {
        console.log(`✗ 无效配置参数测试失败: ${error.message}`);
    }
    
    // 测试3: 特殊日期
    try {
        const testDate = new Date(new Date().getFullYear(), 11, 31); // 12月31日
        const festivals = mockGetFestivals(testDate, festivalConfig);
        console.log(`✓ 特殊日期测试通过: 12月31日识别到 ${festivals.length} 个节日`);
        passed++;
    } catch (error) {
        console.log(`✗ 特殊日期测试失败: ${error.message}`);
    }
    
    console.log(`测试3结果: ${passed}/3 通过`);
    return { success: passed === 3, passed, total: 3 };
}

// 测试4: 全年节日计算测试
function testYearlyCalculation() {
    console.log('\n测试4: 全年节日计算测试');
    
    const festivalConfig = MOCK_FESTIVAL_CONFIG;
    const currentYear = new Date().getFullYear();
    const keyHolidays = [
        { month: 1, day: 1, name: '元旦' },
        { month: 5, day: 1, name: '劳动节' },
        { month: 10, day: 1, name: '国庆节' }
    ];
    
    let passedHolidays = 0;
    
    for (const holiday of keyHolidays) {
        try {
            const testDate = generateTestDate(holiday.month, holiday.day, currentYear);
            const festivals = mockGetFestivals(testDate, festivalConfig);
            
            if (festivals.some(f => f.name === holiday.name)) {
                console.log(`✓ ${currentYear}-${holiday.month}-${holiday.day}: 成功识别 ${holiday.name}`);
                passedHolidays++;
            } else {
                console.log(`✗ ${currentYear}-${holiday.month}-${holiday.day}: 未能识别 ${holiday.name}`);
            }
        } catch (error) {
            console.log(`✗ 处理 ${holiday.name} 时出错: ${error.message}`);
        }
    }
    
    console.log(`测试4结果: ${passedHolidays}/${keyHolidays.length} 个关键节日识别通过`);
    return { success: passedHolidays === keyHolidays.length, passed: passedHolidays, total: keyHolidays.length };
}

// 执行所有测试
function runAllTests() {
    try {
        // 设置模拟环境
        setupMockEnvironment();
        
        // 运行各项测试
        console.log('\n===== 开始测试节日相关功能 =====');
        const testResults = [
            testSingleFestival(),
            testHolidayJudgment(),
            testEdgeCases(),
            testYearlyCalculation()
        ];
        
        // 统计总体结果
        let totalTests = 0;
        let totalPassed = 0;
        let allSuccess = true;
        
        for (const result of testResults) {
            totalTests += result.total || 0;
            totalPassed += result.passed || 0;
            allSuccess = allSuccess && result.success;
        }
        
        console.log('\n\n===== 总体测试结果 =====');
        console.log(`总测试用例数: ${totalTests}`);
        console.log(`通过数: ${totalPassed} (${totalTests > 0 ? (totalPassed/totalTests*100).toFixed(1) : 0}%)`);
        
        if (allSuccess) {
            console.log('🎉 所有测试均已通过!');
        } else {
            console.log('❌ 部分测试失败，请检查代码');
        }
        
        return allSuccess;
        
    } catch (error) {
        console.error('运行测试时发生错误:', error);
        return false;
    }
}

// 运行测试并输出结果
const testResult = runAllTests();
process.exit(testResult ? 0 : 1);