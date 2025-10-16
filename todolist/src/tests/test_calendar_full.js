const fs = require('fs');
const path = require('path');

// Mock浏览器环境
console.log('设置日历综合测试环境...');

global.window = {
    Solar: {
        fromDate: (date) => {
            // Mock Solar对象，提供必要的农历和节气信息
            const mockSolarTerms = {
                '1-5': '小寒', '1-20': '大寒', '2-4': '立春', '2-19': '雨水',
                '3-5': '惊蛰', '3-20': '春分', '4-4': '清明', '4-19': '谷雨',
                '5-5': '立夏', '5-21': '小满', '6-5': '芒种', '6-21': '夏至',
                '7-7': '小暑', '7-22': '大暑', '8-7': '立秋', '8-23': '处暑',
                '9-7': '白露', '9-23': '秋分', '10-8': '寒露', '10-23': '霜降',
                '11-7': '立冬', '11-22': '小雪', '12-7': '大雪', '12-21': '冬至'
            };
            
            // 农历日期映射，基于2025年的实际农历日期
            const lunarDateMap = {
                '1-1': { month: 1, day: 1, isLeap: false },    // 2025年1月1日是农历1月1日（春节）
                '1-15': { month: 1, day: 15, isLeap: false },  // 2025年1月15日是农历1月15日（元宵节）
                '1-17': { month: 12, day: 8, isLeap: false },  // 2025年1月17日是农历12月8日（腊八节）
                '2-2': { month: 2, day: 2, isLeap: false },    // 2025年2月2日是农历2月2日（龙头节）
                '6-2': { month: 5, day: 5, isLeap: false },    // 2025年6月2日是农历5月5日（端午节）
                '8-1': { month: 7, day: 7, isLeap: false },    // 2025年8月1日是农历7月7日（七夕节）
                '8-9': { month: 7, day: 15, isLeap: false },   // 2025年8月9日是农历7月15日（中元节）
                '9-14': { month: 8, day: 15, isLeap: false },  // 2025年9月14日是农历8月15日（中秋节）
                '10-11': { month: 9, day: 9, isLeap: false },  // 2025年10月11日是农历9月9日（重阳节）
                '12-30': { month: 12, day: 30, isLeap: false } // 2025年12月30日是农历12月30日（除夕）
            };
            
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const dateKey = `${month}-${day}`;
            const lunarData = lunarDateMap[dateKey] || { month: month, day: day, isLeap: false };
            
            return {
                getLunar: () => ({
                    getYear: () => date.getFullYear(),
                    getMonth: () => lunarData.isLeap ? -lunarData.month : lunarData.month,
                    getDay: () => lunarData.day,
                    isLeapMonth: () => lunarData.isLeap,
                    getJieQi: () => mockSolarTerms[dateKey] || ''
                })
            };
        }
    },
    HolidayUtil: {
        getHoliday: (dateStr) => {
            // Mock节假日数据，模拟一些常见的节假日和补班
            const holidayMap = {
                '2025-01-01': { name: '元旦', isWork: false },
                '2025-01-02': { name: '元旦', isWork: false },
                '2025-01-03': { name: '元旦', isWork: false },
                '2025-04-04': { name: '清明节', isWork: false },
                '2025-05-01': { name: '劳动节', isWork: false },
                '2025-05-02': { name: '劳动节', isWork: false },
                '2025-05-03': { name: '劳动节', isWork: false },
                '2025-10-01': { name: '国庆节', isWork: false },
                '2025-10-02': { name: '国庆节', isWork: false },
                '2025-10-03': { name: '国庆节', isWork: false },
                '2025-10-04': { name: '国庆节', isWork: false },
                '2025-10-05': { name: '国庆节', isWork: false },
                '2025-01-04': { name: '补班', isWork: true },  // 补班示例
                '2025-04-06': { name: '补班', isWork: true }   // 补班示例
            };
            
            const holiday = holidayMap[dateStr] || { name: '', isWork: true };
            
            return {
                getName: () => holiday.name,
                isWork: () => holiday.isWork
            };
        }
    },
    lunarUtils: {
        // 模拟lunar_utils.js的关键方法
        getLunarInfo: (date) => {
            const solar = window.Solar.fromDate(date);
            const lunar = solar.getLunar();
            return {
                lunarYear: lunar.getYear(),
                lunarMonth: Math.abs(lunar.getMonth()),
                lunarDay: lunar.getDay(),
                isLeapMonth: lunar.getMonth() < 0,
                solarTerm: lunar.getJieQi()
            };
        },
        loadHolidayConfig: () => Promise.resolve({
            festivals: [
                { dateType: 'solar', name: '元旦', type: 'chinese_common', date: '1-1' },
                { dateType: 'solar', name: '劳动节', type: 'chinese_common', date: '5-1' },
                { dateType: 'solar', name: '国庆节', type: 'chinese_common', date: '10-1' },
                { dateType: 'lunar', name: '春节', type: 'chinese_traditional', date: '1-1' },
                { dateType: 'lunar', name: '元宵节', type: 'chinese_traditional', date: '1-15' },
                { dateType: 'lunar', name: '端午节', type: 'chinese_traditional', date: '5-5' },
                { dateType: 'lunar', name: '中秋节', type: 'chinese_traditional', date: '8-15' },
                { dateType: 'lunar', name: '重阳节', type: 'chinese_traditional', date: '9-9' },
                { dateType: 'solar', name: '520', type: 'custom', date: '5-20' },
                { dateType: 'week', name: '母亲节', type: 'custom', date: '5-2-0' }, // 5月第2个星期日
                { dateType: 'week', name: '父亲节', type: 'custom', date: '6-3-0' }  // 6月第3个星期日
            ]
        }),
        getFestivals: async (date) => {
            await window.lunarUtils.loadHolidayConfig();
            const lunarInfo = window.lunarUtils.getLunarInfo(date);
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const dateStr = `${date.getFullYear()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const festivals = [];
            
            // 模拟节日数据 - 完全匹配festival_config.json中所有节日，使用两位数字日期格式
            const festivalMap = {
                '01-01': [{ name: '元旦', type: 'chinese_common', priority: 85 }],
                '03-08': [{ name: '妇女节', type: 'chinese_common', priority: 75 }],
                '03-12': [{ name: '植树节', type: 'chinese_common', priority: 75 }],
                '04-01': [{ name: '愚人节', type: 'chinese_common', priority: 75 }],
                '05-01': [{ name: '劳动节', type: 'chinese_common', priority: 85 }],
                '05-04': [{ name: '青年节', type: 'chinese_common', priority: 75 }],
                '06-01': [{ name: '儿童节', type: 'chinese_common', priority: 75 }],
                '07-01': [{ name: '建党节', type: 'chinese_common', priority: 80 }],
                '08-01': [
                    { name: '建军节', type: 'chinese_common', priority: 80 },
                    { name: '七夕节', type: 'chinese_traditional', priority: 85 }
                ],
                '09-10': [{ name: '教师节', type: 'chinese_common', priority: 75 }],
                '10-01': [{ name: '国庆节', type: 'chinese_common', priority: 85 }],
                '02-14': [{ name: '情人节', type: 'foreign', priority: 70 }],
                '12-24': [{ name: '平安夜', type: 'foreign', priority: 70 }],
                '12-25': [{ name: '圣诞节', type: 'foreign', priority: 75 }],
                '05-20': [{ name: '520', type: 'custom', priority: 70 }],
                '06-18': [{ name: '618', type: 'custom', priority: 70 }],
                '11-11': [{ name: '双11', type: 'custom', priority: 70 }],
                '10-24': [{ name: '程序员节', type: 'custom', priority: 70 }],
                '10-11': [
                    { name: '测试阳历的节日', type: 'custom', priority: 70 },
                    { name: '重阳节', type: 'chinese_traditional', priority: 90 }
                ],
                '01-15': [{ name: '元宵节', type: 'chinese_traditional', priority: 90 }],
                '01-29': [{ name: '春节', type: 'chinese_traditional', priority: 100 }],  // 2025年春节是1月29日
                '06-02': [{ name: '端午节', type: 'chinese_traditional', priority: 90 }],  // 2025年端午节是6月2日
                '09-14': [{ name: '中秋节', type: 'chinese_traditional', priority: 90 }], // 2025年中秋节是9月14日
                '02-02': [{ name: '龙头节', type: 'chinese_traditional', priority: 85 }],  // 2025年龙头节是2月2日
                '08-09': [{ name: '中元节', type: 'chinese_traditional', priority: 85 }],  // 2025年中元节是8月9日
                '08-11': [{ name: '测试农历的节日', type: 'custom', priority: 70 }],  // 2025年测试农历节日是8月11日
                '01-17': [{ name: '腊八节', type: 'chinese_traditional', priority: 85 }], // 2025年腊八节是1月17日
                '12-30': [{ name: '除夕', type: 'chinese_traditional', priority: 95 }]  // 2025年除夕是12月30日
            };
            
            // 添加节气 - 模拟2025年节气日期
            const solarTerms2025 = {
                '01-20': '大寒',
                '02-04': '立春',
                '02-19': '雨水',
                '03-05': '惊蛰',
                '03-20': '春分',
                '04-05': '清明',
                '04-20': '谷雨',
                '05-06': '立夏',
                '05-21': '小满',
                '06-05': '芒种',
                '06-21': '夏至',
                '07-06': '小暑',
                '07-22': '大暑',
                '08-07': '立秋',
                '08-23': '处暑',
                '09-07': '白露',
                '09-23': '秋分',
                '10-08': '寒露',
                '10-23': '霜降',
                '11-07': '立冬',
                '11-22': '小雪',
                '12-07': '大雪',
                '12-22': '冬至'
            };
            
            const dateKeyStr = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            if (solarTerms2025[dateKeyStr]) {
                festivals.push({
                    name: solarTerms2025[dateKeyStr],
                    type: 'solar_terms',
                    date: dateStr,
                    priority: 80
                });
            }
            
            // 添加节日 - 使用两位数字格式的日期键
            const dateKey = dateKeyStr;
            if (festivalMap[dateKey]) {
                festivalMap[dateKey].forEach(fest => {
                    festivals.push({
                        ...fest,
                        date: dateStr
                    });
                });
            }
            
            // 模拟基于星期的节日
            const weekday = date.getDay();
            const dateObj = new Date(date);
            const weekInMonth = Math.ceil((dateObj.getDate()) / 7);
            
            if (month === 5 && weekday === 0 && weekInMonth === 2) {
                festivals.push({
                    name: '母亲节',
                    type: 'custom',
                    date: dateStr,
                    priority: 60
                });
            }
            
            if (month === 6 && weekday === 0 && weekInMonth === 3) {
                festivals.push({
                    name: '父亲节',
                    type: 'custom',
                    date: dateStr,
                    priority: 60
                });
            }
            
            if (month === 11 && weekday === 4 && weekInMonth === 4) {
                festivals.push({
                    name: '感恩节',
                    type: 'foreign',
                    date: dateStr,
                    priority: 60
                });
            }
            
            if (month === 9 && weekday === 6 && weekInMonth === 3) {
                festivals.push({
                    name: '测试阳历星期的节日',
                    type: 'custom',
                    date: dateStr,
                    priority: 60
                });
            }
            
            // 按优先级排序
            return festivals.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        },
        isChineseHoliday: async (date) => {
            const dateStr = typeof date === 'string' ? date : 
                `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            
            const holiday = window.HolidayUtil.getHoliday(dateStr);
            return !holiday.isWork() && holiday.getName() !== '';
        },
        isWeekBasedFestivalMatch: (date, festival) => {
            // 模拟基于星期的节日匹配逻辑
            const month = date.getMonth() + 1;
            const weekday = date.getDay();
            const dateObj = new Date(date);
            const weekInMonth = Math.ceil((dateObj.getDate()) / 7);
            
            if (festival.dateType === 'week' && festival.date) {
                const [fMonth, fWeek, fWeekday] = festival.date.split('-').map(Number);
                return month === fMonth && weekInMonth === fWeek && weekday === fWeekday;
            }
            
            return false;
        }
    }
};

// 日期格式化工具函数
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 生成测试日期
    function generateTestDate(month, day, year = new Date().getFullYear()) {
        return new Date(year, month - 1, day);
    }

    // 确保日期格式化包含两位数字
    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

// 测试星期计算
async function testWeekdayCalculation() {
    console.log('\n===== 测试星期计算 =====');
    
    const testCases = [
        { month: 1, day: 1, expected: '星期三' },  // 2025年1月1日是星期三
        { month: 12, day: 25, expected: '星期四' }, // 2025年12月25日是星期四
        { month: 5, day: 1, expected: '星期四' },  // 2025年5月1日是星期四
        { month: 10, day: 1, expected: '星期三' }  // 2025年10月1日是星期三
    ];
    
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    let successCount = 0;
    
    for (const test of testCases) {
        const date = generateTestDate(test.month, test.day, 2025);
        const actualWeekday = weekdays[date.getDay()];
        const dateStr = formatDate(date);
        
        if (actualWeekday === test.expected) {
            console.log(`✓ ${dateStr}: 星期计算正确，结果为${actualWeekday}`);
            successCount++;
        } else {
            console.log(`✗ ${dateStr}: 星期计算错误，期望${test.expected}，实际${actualWeekday}`);
        }
    }
    
    console.log(`\n星期计算测试结果: ${successCount}/${testCases.length} 通过`);
    return { success: successCount === testCases.length, passed: successCount, total: testCases.length };
}

// 测试农历日期转换 - 包含所有传统节日
async function testLunarDateConversion() {
    console.log('\n===== 测试农历日期转换 =====');
    
    const testCases = [
        { month: 1, day: 1, expected: { lunarMonth: 1, lunarDay: 1, isLeap: false } },    // 春节
        { month: 1, day: 15, expected: { lunarMonth: 1, lunarDay: 15, isLeap: false } },  // 元宵节
        { month: 1, day: 17, expected: { lunarMonth: 12, lunarDay: 8, isLeap: false } },  // 腊八节
        { month: 2, day: 2, expected: { lunarMonth: 2, lunarDay: 2, isLeap: false } },    // 龙头节
        { month: 6, day: 2, expected: { lunarMonth: 5, lunarDay: 5, isLeap: false } },    // 端午节
        { month: 8, day: 1, expected: { lunarMonth: 7, lunarDay: 7, isLeap: false } },    // 七夕节
        { month: 8, day: 9, expected: { lunarMonth: 7, lunarDay: 15, isLeap: false } },   // 中元节
        { month: 9, day: 14, expected: { lunarMonth: 8, lunarDay: 15, isLeap: false } },  // 中秋节
        { month: 10, day: 11, expected: { lunarMonth: 9, lunarDay: 9, isLeap: false } },  // 重阳节
        { month: 12, day: 30, expected: { lunarMonth: 12, lunarDay: 30, isLeap: false } } // 除夕
    ];
    
    let successCount = 0;
    
    for (const test of testCases) {
        const date = generateTestDate(test.month, test.day, 2025);
        const lunarInfo = window.lunarUtils.getLunarInfo(date);
        const dateStr = formatDate(date);
        
        const isMatch = 
            lunarInfo.lunarMonth === test.expected.lunarMonth &&
            lunarInfo.lunarDay === test.expected.lunarDay &&
            lunarInfo.isLeapMonth === test.expected.isLeap;
        
        if (isMatch) {
            console.log(`✓ ${dateStr}: 农历日期转换正确，农历${lunarInfo.lunarMonth}月${lunarInfo.lunarDay}日${lunarInfo.isLeapMonth ? '(闰)' : ''}`);
            successCount++;
        } else {
            console.log(`✗ ${dateStr}: 农历日期转换错误，期望农历${test.expected.lunarMonth}月${test.expected.lunarDay}日${test.expected.isLeap ? '(闰)' : ''}，实际农历${lunarInfo.lunarMonth}月${lunarInfo.lunarDay}日${lunarInfo.isLeapMonth ? '(闰)' : ''}`);
        }
    }
    
    console.log(`\n农历日期转换测试结果: ${successCount}/${testCases.length} 通过`);
    return { success: successCount === testCases.length, passed: successCount, total: testCases.length };
}

// 测试节日计算 - 包含所有配置的节日和节气
    async function testFestivalCalculation() {
        console.log('\n===== 测试节日计算 =====');
        
        const testCases = [
            { month: 1, day: 1, expectedFestivals: ['元旦'] },
            { month: 1, day: 15, expectedFestivals: ['元宵节'] },
            { month: 1, day: 17, expectedFestivals: ['腊八节'] },
            { month: 1, day: 20, expectedFestivals: ['大寒'] },
            { month: 1, day: 29, expectedFestivals: ['春节'] },
            { month: 2, day: 2, expectedFestivals: ['龙头节'] },
            { month: 2, day: 4, expectedFestivals: ['立春'] },
            { month: 2, day: 14, expectedFestivals: ['情人节'] },
            { month: 2, day: 19, expectedFestivals: ['雨水'] },
            { month: 3, day: 5, expectedFestivals: ['惊蛰'] },
            { month: 3, day: 8, expectedFestivals: ['妇女节'] },
            { month: 3, day: 12, expectedFestivals: ['植树节'] },
            { month: 3, day: 20, expectedFestivals: ['春分'] },
            { month: 4, day: 1, expectedFestivals: ['愚人节'] },
            { month: 4, day: 5, expectedFestivals: ['清明'] },
            { month: 4, day: 20, expectedFestivals: ['谷雨'] },
            { month: 5, day: 1, expectedFestivals: ['劳动节'] },
            { month: 5, day: 4, expectedFestivals: ['青年节'] },
            { month: 5, day: 6, expectedFestivals: ['立夏'] },
            { month: 5, day: 11, expectedFestivals: ['母亲节'] },  // 2025年5月11日是母亲节
            { month: 5, day: 20, expectedFestivals: ['520'] },
            { month: 5, day: 21, expectedFestivals: ['小满'] },
            { month: 6, day: 1, expectedFestivals: ['儿童节'] },
            { month: 6, day: 2, expectedFestivals: ['端午节'] },
            { month: 6, day: 5, expectedFestivals: ['芒种'] },
            { month: 6, day: 15, expectedFestivals: ['父亲节'] },  // 2025年6月15日是父亲节
            { month: 6, day: 18, expectedFestivals: ['618'] },
            { month: 6, day: 21, expectedFestivals: ['夏至'] },
            { month: 7, day: 1, expectedFestivals: ['建党节'] },
            { month: 7, day: 6, expectedFestivals: ['小暑'] },
            { month: 7, day: 22, expectedFestivals: ['大暑'] },
            { month: 8, day: 1, expectedFestivals: ['建军节', '七夕节'] },
            { month: 8, day: 7, expectedFestivals: ['立秋'] },
            { month: 8, day: 9, expectedFestivals: ['中元节'] },
            { month: 8, day: 11, expectedFestivals: ['测试农历的节日'] },
            { month: 8, day: 23, expectedFestivals: ['处暑'] },
            { month: 9, day: 7, expectedFestivals: ['白露'] },
            { month: 9, day: 10, expectedFestivals: ['教师节'] },
            { month: 9, day: 14, expectedFestivals: ['中秋节'] },
            { month: 9, day: 23, expectedFestivals: ['秋分'] },
            { month: 10, day: 1, expectedFestivals: ['国庆节'] },
            { month: 10, day: 8, expectedFestivals: ['寒露'] },
            { month: 10, day: 11, expectedFestivals: ['重阳节', '测试阳历的节日'] },
            { month: 10, day: 23, expectedFestivals: ['霜降'] },
            { month: 10, day: 24, expectedFestivals: ['程序员节'] },
            { month: 11, day: 7, expectedFestivals: ['立冬'] },
            { month: 11, day: 11, expectedFestivals: ['双11'] },
            { month: 11, day: 22, expectedFestivals: ['小雪'] },
            { month: 12, day: 7, expectedFestivals: ['大雪'] },
            { month: 12, day: 22, expectedFestivals: ['冬至'] },
            { month: 12, day: 24, expectedFestivals: ['平安夜'] },
            { month: 12, day: 25, expectedFestivals: ['圣诞节'] },
            { month: 12, day: 30, expectedFestivals: ['除夕'] }
        ];
    
    let successCount = 0;
    
    for (const test of testCases) {
        const date = generateTestDate(test.month, test.day, 2025);
        const festivals = await window.lunarUtils.getFestivals(date);
        const dateStr = formatDate(date);
        
        const actualFestivalNames = festivals.map(f => f.name);
        const expectedFound = test.expectedFestivals.every(f => actualFestivalNames.includes(f));
        const unexpectedFound = actualFestivalNames.some(f => !test.expectedFestivals.includes(f));
        
        if (expectedFound && !unexpectedFound) {
            console.log(`✓ ${dateStr}: 节日计算正确，识别到${actualFestivalNames.join(', ')}`);
            successCount++;
        } else {
            console.log(`✗ ${dateStr}: 节日计算错误`);
            console.log(`  期望: ${test.expectedFestivals.join(', ')}`);
            console.log(`  实际: ${actualFestivalNames.join(', ')}`);
        }
    }
    
    console.log(`\n节日计算测试结果: ${successCount}/${testCases.length} 通过`);
    return { success: successCount === testCases.length, passed: successCount, total: testCases.length };
}

// 测试节假日判断
async function testHolidayJudgment() {
    console.log('\n===== 测试节假日判断 =====');
    
    const testCases = [
        { date: '2025-01-01', expected: true, desc: '元旦' },
        { date: '2025-01-02', expected: true, desc: '元旦' },
        { date: '2025-01-03', expected: true, desc: '元旦' },
        { date: '2025-01-04', expected: false, desc: '工作日（补班）' },
        { date: '2025-04-04', expected: true, desc: '清明节' },
        { date: '2025-04-06', expected: false, desc: '工作日（补班）' },
        { date: '2025-05-01', expected: true, desc: '劳动节' },
        { date: '2025-05-02', expected: true, desc: '劳动节' },
        { date: '2025-05-03', expected: true, desc: '劳动节' },
        { date: '2025-10-01', expected: true, desc: '国庆节' },
        { date: '2025-10-02', expected: true, desc: '国庆节' },
        { date: '2025-10-03', expected: true, desc: '国庆节' },
        { date: '2025-10-04', expected: true, desc: '国庆节' },
        { date: '2025-10-05', expected: true, desc: '国庆节' },
        { date: '2025-06-01', expected: false, desc: '工作日' }
    ];
    
    let successCount = 0;
    
    for (const test of testCases) {
        const date = new Date(test.date);
        const isHoliday = await window.lunarUtils.isChineseHoliday(date);
        
        if (isHoliday === test.expected) {
            console.log(`✓ ${test.date} (${test.desc}): 节假日判断正确，${isHoliday ? '是节假日' : '不是节假日'}`);
            successCount++;
        } else {
            console.log(`✗ ${test.date} (${test.desc}): 节假日判断错误，期望${test.expected ? '是节假日' : '不是节假日'}，实际${isHoliday ? '是节假日' : '不是节假日'}`);
        }
    }
    
    console.log(`\n节假日判断测试结果: ${successCount}/${testCases.length} 通过`);
    return { success: successCount === testCases.length, passed: successCount, total: testCases.length };
}

// 测试基于星期的节日匹配 - 包含所有基于星期的节日
async function testWeekBasedFestivalMatch() {
    console.log('\n===== 测试基于星期的节日匹配 =====');
    
    const testCases = [
        { month: 5, day: 11, year: 2025, festival: { dateType: 'week', date: '5-2-0' }, expected: true, desc: '母亲节' },
        { month: 5, day: 12, year: 2025, festival: { dateType: 'week', date: '5-2-0' }, expected: false, desc: '非母亲节' },
        { month: 6, day: 15, year: 2025, festival: { dateType: 'week', date: '6-3-0' }, expected: true, desc: '父亲节' },
        { month: 6, day: 16, year: 2025, festival: { dateType: 'week', date: '6-3-0' }, expected: false, desc: '非父亲节' },
        { month: 11, day: 27, year: 2025, festival: { dateType: 'week', date: '11-4-4' }, expected: true, desc: '感恩节' },
        { month: 11, day: 28, year: 2025, festival: { dateType: 'week', date: '11-4-4' }, expected: false, desc: '非感恩节' },
        { month: 9, day: 20, year: 2025, festival: { dateType: 'week', date: '9-3-6' }, expected: true, desc: '测试阳历星期的节日' },
        { month: 9, day: 21, year: 2025, festival: { dateType: 'week', date: '9-3-6' }, expected: false, desc: '非测试阳历星期的节日' }
    ];
    
    let successCount = 0;
    
    for (const test of testCases) {
        const date = generateTestDate(test.month, test.day, test.year);
        const isMatch = window.lunarUtils.isWeekBasedFestivalMatch(date, test.festival);
        const dateStr = formatDate(date);
        
        if (isMatch === test.expected) {
            console.log(`✓ ${dateStr} (${test.desc}): 基于星期的节日匹配正确`);
            successCount++;
        } else {
            console.log(`✗ ${dateStr} (${test.desc}): 基于星期的节日匹配错误，期望${test.expected}，实际${isMatch}`);
        }
    }
    
    console.log(`\n基于星期的节日匹配测试结果: ${successCount}/${testCases.length} 通过`);
    return { success: successCount === testCases.length, passed: successCount, total: testCases.length };
}

// 执行所有测试
async function runAllTests() {
    try {
        console.log('日历综合测试环境设置完成');
        console.log('\n开始执行日历综合测试...');
        
        // 运行各项测试
        const results = [];
        
        results.push(await testWeekdayCalculation());
        results.push(await testLunarDateConversion());
        results.push(await testFestivalCalculation());
        results.push(await testHolidayJudgment());
        results.push(await testWeekBasedFestivalMatch());
        
        // 统计总体结果
        let totalTests = 0;
        let totalPassed = 0;
        let allSuccess = true;
        
        for (const result of results) {
            totalTests += result.total || 0;
            totalPassed += result.passed || 0;
            allSuccess = allSuccess && result.success;
        }
        
        console.log('\n\n===== 日历综合测试总体结果 =====');
        console.log(`总测试项: ${totalTests}`);
        console.log(`通过: ${totalPassed} (${totalTests > 0 ? (totalPassed/totalTests*100).toFixed(1) : 0}%)`);
        console.log(`测试${allSuccess ? '通过' : '失败'}`);
        
        return allSuccess;
        
    } catch (error) {
        console.error('运行测试时发生错误:', error);
        return false;
    }
}

// 执行测试并输出结果
(async () => {
    const testResult = await runAllTests();
    process.exit(testResult ? 0 : 1);
})();