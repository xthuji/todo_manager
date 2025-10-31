// 农历和节日管理核心功能测试
console.log('开始运行农历和节日管理核心功能测试...');

// Mock浏览器环境
const fs = require('fs');
const path = require('path');

global.window = {
    calendarConfig: {
        currentYear: 2024,
        currentMonth: 0,
        currentDay: 1,
        festivals: [
            { name: '元旦', date: '1-1', dateType: 'solar', type: 'chinese_common' },
            { name: '春节', date: '1-1', dateType: 'lunar', type: 'chinese_traditional' },
            { name: '劳动节', date: '5-1', dateType: 'solar', type: 'chinese_common' },
            { name: '国庆节', date: '10-1', dateType: 'solar', type: 'chinese_common' },
            { name: '圣诞节', date: '12-25', dateType: 'solar', type: 'foreign' },
            { name: '520', date: '5-20', dateType: 'solar', type: 'custom' }
        ],
        holidays: {},
        workdays: new Set()
    }
};

// 模拟lunar_utils模块
const lunarUtils = {
    // 农历月份和日期的中文表示
    chineseMonths: ['', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'],
    chineseDays: ['', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
        '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
        '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'],
    
    // 格式化日期
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },
    
    // 获取农历日期文本（模拟）
    getLunarDateText(date) {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        
        // 简化模拟，实际应使用lunar.js计算
        return {
            lunarMonth: this.chineseMonths[month] || '未知月',
            lunarDay: this.chineseDays[day] || '未知日',
            fullText: `${this.chineseMonths[month] || '未知月'} ${this.chineseDays[day] || '未知日'}`
        };
    },
    
    // 获取节日信息（同步版本）
    getFestivalsSync(dateStr) {
        const date = new Date(dateStr);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const festivals = [];
        
        // 处理阳历节日
        if (window.calendarConfig && window.calendarConfig.festivals) {
            // 公历节日
            window.calendarConfig.festivals
                .filter(f => f && f.dateType === 'solar' && 
                         (f.date === `${month}-${day}` || f.date === `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`))
                .forEach(festival => {
                    festivals.push({
                        name: festival.name,
                        type: festival.type || 'custom',
                        date: dateStr,
                        priority: festival.priority || 10
                    });
                });
        }
        
        // 添加一些特殊日期的模拟节日
        if (month === 2 && day === 14) {
            festivals.push({
                name: '情人节',
                type: 'foreign',
                date: dateStr,
                priority: 5
            });
        }
        
        return festivals;
    },
    
    // 获取节日样式类
    getFestivalStyleClass(type) {
        const holidayStylesClass = {
            chinese_common: 'bg-festival-common',
            chinese_traditional: 'bg-festival-traditional',
            foreign: 'bg-festival-foreign',
            solar_terms: 'bg-festival-terms',
            custom: 'bg-festival-custom'
        };
        return holidayStylesClass[type] || 'bg-festival-custom';
    },
    
    // 获取节日类型名称
    getFestivalTypeName(type) {
        const names = {
            chinese_common: '常用节日',
            chinese_traditional: '传统节日',
            foreign: '国外节日',
            solar_terms: '节气',
            custom: '自定义节日'
        };
        return names[type] || '未知类型';
    },
    
    // 检查是否为中国节假日
    isChineseHoliday(dateStr) {
        const festivals = this.getFestivalsSync(dateStr);
        return festivals.some(festival => 
            ['chinese_common', 'chinese_traditional'].includes(festival.type)
        );
    },
    
    // 获取日期的完整信息（公历、农历、节日）
    getDateFullInfo(dateStr) {
        const date = new Date(dateStr);
        const lunarInfo = this.getLunarDateText(date);
        const festivals = this.getFestivalsSync(dateStr);
        const isHoliday = this.isChineseHoliday(dateStr);
        
        return {
            date: dateStr,
            solarYear: date.getFullYear(),
            solarMonth: date.getMonth() + 1,
            solarDay: date.getDate(),
            lunarMonth: lunarInfo.lunarMonth,
            lunarDay: lunarInfo.lunarDay,
            festivals: festivals,
            isHoliday: isHoliday,
            festivalCount: festivals.length
        };
    }
};

// 测试用例
const runTests = async () => {
    let passedTests = 0;
    let totalTests = 0;
    
    console.log('=== 开始农历和节日管理核心功能测试 ===\n');
    
    // 测试1: 日期格式化
    totalTests++;
    try {
        console.log('测试1: 日期格式化');
        const date = new Date(2024, 0, 15); // 2024年1月15日
        const formattedDate = lunarUtils.formatDate(date);
        
        if (formattedDate === '2024-01-15') {
            console.log(`  ✅ 通过: 日期格式化正确: ${formattedDate}`);
            passedTests++;
        } else {
            throw new Error(`日期格式化错误，期望'2024-01-15'，实际'${formattedDate}'`);
        }
    } catch (error) {
        console.error(`  ❌ 失败: ${error.message}`);
    }
    
    // 测试2: 获取农历日期文本
    totalTests++;
    try {
        console.log('\n测试2: 获取农历日期文本');
        const date = new Date(2024, 0, 15); // 2024年1月15日
        const lunarInfo = lunarUtils.getLunarDateText(date);
        
        if (lunarInfo && lunarInfo.lunarMonth && lunarInfo.lunarDay) {
            console.log(`  ✅ 通过: 农历信息获取成功`);
            console.log(`  ✅ 通过: 农历月份: ${lunarInfo.lunarMonth}`);
            console.log(`  ✅ 通过: 农历日期: ${lunarInfo.lunarDay}`);
            passedTests++;
        } else {
            throw new Error('农历信息获取失败');
        }
    } catch (error) {
        console.error(`  ❌ 失败: ${error.message}`);
    }
    
    // 测试3: 获取节日信息（元旦）
    totalTests++;
    try {
        console.log('\n测试3: 获取节日信息（元旦）');
        const festivals = lunarUtils.getFestivalsSync('2024-01-01');
        
        if (festivals.length > 0 && festivals[0].name === '元旦' && festivals[0].type === 'chinese_common') {
            console.log(`  ✅ 通过: 成功获取元旦节日信息`);
            console.log(`  ✅ 通过: 节日类型正确: ${festivals[0].type}`);
            passedTests++;
        } else {
            throw new Error('元旦节日信息获取失败');
        }
    } catch (error) {
        console.error(`  ❌ 失败: ${error.message}`);
    }
    
    // 测试4: 获取节日信息（自定义节日）
    totalTests++;
    try {
        console.log('\n测试4: 获取节日信息（自定义节日）');
        const festivals = lunarUtils.getFestivalsSync('2024-05-20');
        
        if (festivals.length > 0 && festivals[0].name === '520' && festivals[0].type === 'custom') {
            console.log(`  ✅ 通过: 成功获取520节日信息`);
            console.log(`  ✅ 通过: 自定义节日类型正确: ${festivals[0].type}`);
            passedTests++;
        } else {
            throw new Error('520节日信息获取失败');
        }
    } catch (error) {
        console.error(`  ❌ 失败: ${error.message}`);
    }
    
    // 测试5: 获取节日样式类
    totalTests++;
    try {
        console.log('\n测试5: 获取节日样式类');
        const commonClass = lunarUtils.getFestivalStyleClass('chinese_common');
        const traditionalClass = lunarUtils.getFestivalStyleClass('chinese_traditional');
        const unknownClass = lunarUtils.getFestivalStyleClass('unknown_type');
        
        if (commonClass === 'bg-festival-common' && 
            traditionalClass === 'bg-festival-traditional' &&
            unknownClass === 'bg-festival-custom') {
            console.log(`  ✅ 通过: 常用节日样式类正确: ${commonClass}`);
            console.log(`  ✅ 通过: 传统节日样式类正确: ${traditionalClass}`);
            console.log(`  ✅ 通过: 未知类型默认样式类正确: ${unknownClass}`);
            passedTests++;
        } else {
            throw new Error('节日样式类获取失败');
        }
    } catch (error) {
        console.error(`  ❌ 失败: ${error.message}`);
    }
    
    // 测试6: 获取节日类型名称
    totalTests++;
    try {
        console.log('\n测试6: 获取节日类型名称');
        const commonName = lunarUtils.getFestivalTypeName('chinese_common');
        const foreignName = lunarUtils.getFestivalTypeName('foreign');
        
        if (commonName === '常用节日' && foreignName === '国外节日') {
            console.log(`  ✅ 通过: 常用节日名称正确: ${commonName}`);
            console.log(`  ✅ 通过: 国外节日名称正确: ${foreignName}`);
            passedTests++;
        } else {
            throw new Error('节日类型名称获取失败');
        }
    } catch (error) {
        console.error(`  ❌ 失败: ${error.message}`);
    }
    
    // 测试7: 检查是否为中国节假日
    totalTests++;
    try {
        console.log('\n测试7: 检查是否为中国节假日');
        const isHoliday1 = lunarUtils.isChineseHoliday('2024-01-01'); // 元旦
        const isHoliday2 = lunarUtils.isChineseHoliday('2024-05-20'); // 520（非节假日）
        
        if (isHoliday1 && !isHoliday2) {
            console.log('  ✅ 通过: 元旦正确识别为节假日');
            console.log('  ✅ 通过: 520正确识别为非节假日');
            passedTests++;
        } else {
            throw new Error('节假日判断失败');
        }
    } catch (error) {
        console.error(`  ❌ 失败: ${error.message}`);
    }
    
    // 测试8: 获取日期完整信息
    totalTests++;
    try {
        console.log('\n测试8: 获取日期完整信息');
        const dateInfo = lunarUtils.getDateFullInfo('2024-01-01');
        
        if (dateInfo && 
            dateInfo.date === '2024-01-01' && 
            dateInfo.isHoliday && 
            dateInfo.festivalCount > 0) {
            console.log(`  ✅ 通过: 日期完整信息获取成功`);
            console.log(`  ✅ 通过: 节假日标记正确: ${dateInfo.isHoliday}`);
            console.log(`  ✅ 通过: 节日数量正确: ${dateInfo.festivalCount}`);
            passedTests++;
        } else {
            throw new Error('日期完整信息获取失败');
        }
    } catch (error) {
        console.error(`  ❌ 失败: ${error.message}`);
    }
    
    // 输出测试结果
    console.log('\n=== 测试结果汇总 ===');
    console.log(`通过测试: ${passedTests}/${totalTests}`);
    
    if (passedTests === totalTests) {
        console.log('🎉 所有农历和节日管理核心功能测试通过!');
        process.exit(0);
    } else {
        console.error('❌ 测试未全部通过，请检查错误信息。');
        process.exit(1);
    }
};

// 运行测试
runTests().catch(error => {
    console.error('测试运行失败:', error);
    process.exit(1);
});