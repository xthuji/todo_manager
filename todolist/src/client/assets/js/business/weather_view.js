// 公共节日工具模块已在HTML中直接引入


// 常量定义
const WEATHER_API = {
    AREA_CODES: '/api/weather-area-codes',
    IP_API: '/api/ip-location-area',
    WEATHER_INFO: '/api/weather-info',
};

// 日志序号计数器
let logCounter = 0;
// 生成带序号的日志函数 - 只输出错误和警告信息
function logStep(message) {
    console.log(`[${logCounter++}] ${message}`);
}

// 更新当前日期和时间
function updateCurrentDateTime() {
    const now = new Date();
    const dateStr = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日';
    const dateElement = document.getElementById('current-date');
    if (dateElement) {
        dateElement.textContent = dateStr;
    }
}

async function initializeAll() {
    try {
        // 更新当前日期和时间
        updateCurrentDateTime();

        // 先初始化节日数据
        await window.initFestivals4Weather();
        console.log('节日数据初始化完成');
        // 然后初始化天气页面
        window.WeatherLocationModule.initialize();
    } catch (error) {
        console.error('初始化时出错:', error);
        // 即使节日数据初始化失败，也要继续初始化天气页面
        window.WeatherLocationModule.initialize();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAll);
} else {
    // 页面已经加载完成，直接初始化
    initializeAll();
}
