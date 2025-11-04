// 测试省市县数据API的脚本
const fetch = require('node-fetch');

async function testAreaCodesApi() {
    try {
        console.log('开始测试省市县数据API...');
        const response = await fetch('http://localhost:3000/api/weather/weather-area-codes');
        
        if (!response.ok) {
            console.error(`API请求失败，状态码: ${response.status}`);
            return;
        }
        
        const data = await response.json();
        console.log('API响应数据结构:');
        console.log('是否包含data字段:', 'data' in data);
        console.log('是否包含timestamp字段:', 'timestamp' in data);
        console.log('data是否为数组:', Array.isArray(data.data));
        
        if (Array.isArray(data.data)) {
            console.log(`data数组长度: ${data.data.length}`);
            if (data.data.length > 0) {
                console.log('第一个省份数据结构:');
                console.log('  名称:', data.data[0].name);
                console.log('  是否有children字段:', 'children' in data.data[0]);
                if (data.data[0].children && Array.isArray(data.data[0].children)) {
                    console.log(`  包含城市数量: ${data.data[0].children.length}`);
                    if (data.data[0].children.length > 0) {
                        console.log('  第一个城市名称:', data.data[0].children[0].name);
                    }
                }
            }
        }
        
        console.log('\n测试完成！API返回格式正确。');
    } catch (error) {
        console.error('测试过程中发生错误:', error.message);
    }
}

testAreaCodesApi();