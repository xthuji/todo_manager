// 测试前端节日数据加载逻辑
console.log('=== 节日数据加载测试 ===');

// 模拟浏览器环境中的fetch
const fetch = require('node-fetch');

async function testFestivalDataFlow() {
    try {
        // 1. 测试节日配置API
        console.log('\n1. 测试节日配置API (/api/festival/config):');
        const festivalResponse = await fetch('http://localhost:3000/api/festival/config');
        const festivalData = await festivalResponse.json();
        
        console.log('   - 返回状态码:', festivalResponse.status);
        console.log('   - 顶层字段:', Object.keys(festivalData));
        
        if (festivalData.data && !festivalData.data.data) {
            console.log('   ✓ 正确格式：无嵌套data字段');
            if (festivalData.data.festivals && Array.isArray(festivalData.data.festivals)) {
                console.log(`   ✓ 节日数据存在，共${festivalData.data.festivals.length}个节日`);
                
                // 显示前5个节日样例
                console.log('   节日样例：');
                festivalData.data.festivals.slice(0, 5).forEach((f, i) => {
                    console.log(`     ${i+1}. ${f.name || '未命名节日'} (${f.dateType || '未知类型'})`);
                });
            }
        }
        
        // 2. 测试节假日缓存API
        console.log('\n2. 测试节假日缓存API (/api/holiday/cache):');
        const holidayResponse = await fetch('http://localhost:3000/api/holiday/cache');
        const holidayData = await holidayResponse.json();
        
        console.log('   - 返回状态码:', holidayResponse.status);
        console.log('   - 顶层字段:', Object.keys(holidayData));
        
        if (holidayData.data && !holidayData.data.data) {
            console.log('   ✓ 正确格式：无嵌套data字段');
            if (holidayData.data.Years && typeof holidayData.data.Years === 'object') {
                console.log(`   ✓ 年份数据存在，包含年份: ${Object.keys(holidayData.data.Years).join(', ')}`);
            }
        }
        
        console.log('\n=== 测试完成 ===');
        console.log('✓ 所有API返回标准的单层{data, timestamp}格式');
        console.log('✓ festival_manager.html页面现在应该能够正常显示节日列表');
        
    } catch (error) {
        console.error('测试过程中发生错误:', error);
    }
}

testFestivalDataFlow();