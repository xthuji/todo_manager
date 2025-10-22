// 天气相关功能测试文件
console.log('开始运行天气功能测试...');

// 设置环境变量和全局配置
const API_BASE_URL = 'http://localhost:3000/api'; // 假设服务运行在3000端口

// 导入node-fetch用于实际请求
const fetch = require('node-fetch');
global.fetch = fetch;

// 全局配置
const WEATHER_API = {
    WEATHER_DATA: `${API_BASE_URL}//weather-info`,
    IP_LOCATION: `${API_BASE_URL}/weather-ip-location`,
};

// 测试用的固定城市代码
const TEST_WEATHER_CODE = '101010100'; // 北京

// 导入天气功能模块
const weatherModule = {
    // 获取天气数据（使用真实API，直接返回JSON）
    async fetchWeatherData(weatherCode) {
        try {
            const response = await fetch(`${WEATHER_API.WEATHER_DATA}?weatherCode=${weatherCode}`);
            if (!response.ok) {
                throw new Error(`获取天气数据失败: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('获取天气数据错误:', error);
            throw error;
        }
    },
    
    // 获取IP位置信息
    async getLocationByIP() {
        try {
            const response = await fetch(WEATHER_API.IP_LOCATION);
            if (!response.ok) {
                throw new Error(`获取IP位置信息失败: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('获取IP位置信息错误:', error);
            throw error;
        }
    },
    
};

// 验证天气数据格式的辅助函数
const validateWeatherData = (weatherData) => {
    if (!Array.isArray(weatherData)) {
        throw new Error('天气数据必须是数组格式');
    }
    
    if (weatherData.length === 0) {
        throw new Error('天气数据不能为空数组');
    }
    
    // 验证每条天气数据的必要字段
    weatherData.forEach((dayData, index) => {
        const requiredFields = ['date', 'weather', 'maxTemp', 'minTemp'];
        for (const field of requiredFields) {
            if (!(field in dayData)) {
                throw new Error(`第${index + 1}条天气数据缺少必要字段: ${field}`);
            }
        }
        
        // 验证温度数据类型
        if (typeof dayData.maxTemp !== 'number' || typeof dayData.minTemp !== 'number') {
            throw new Error(`第${index + 1}条天气数据温度格式错误`);
        }
    });
    
    return true;
};


// 测试用例
const runTests = async () => {
    let passedTests = 0;
    let totalTests = 0;
    
    console.log('=== 开始天气功能测试 ===\n');
    
    // 测试1: IP定位获取省市县信息
    totalTests++;
    try {
        console.log('\n测试1: IP定位获取省市县信息');
        const locationData = await weatherModule.getLocationByIP();
        validateLocationData(locationData);
        console.log('  ✅ 通过: 成功获取IP位置信息');
        console.log('  ✅ 通过: 位置信息格式正确，包含必要字段');
        passedTests++;
    } catch (error) {
        console.error(`  ❌ 失败: ${error.message}`);
    }
    
    // 测试5: 获取40天天气数据
    totalTests++;
    try {
        console.log('\n测试5: 根据城市代码抓取40天天气数据');
        const weatherData = await weatherModule.fetchWeatherData(TEST_WEATHER_CODE);
        
        // 验证响应格式
        if (!weatherData.success || !weatherData.data) {
            throw new Error('天气数据响应格式错误');
        }
        
        console.log('  ✅ 通过: 成功获取40天天气数据');
        console.log('  ✅ 通过: 响应格式正确');
        console.log(`  ✅ 通过: 天气数据长度: ${weatherData.data.length} 天`);
        
        // 验证天气数据格式
        validateWeatherData(weatherData.data);
        console.log('  ✅ 通过: 天气数据格式验证通过');
        
        passedTests++;
    } catch (error) {
        console.error(`  ❌ 失败: ${error.message}`);
    }
    
    // 输出测试结果
    console.log('\n=== 测试结果汇总 ===');
    console.log(`通过测试: ${passedTests}/${totalTests}`);
    
    if (passedTests === totalTests) {
        console.log('🎉 所有测试通过!');
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