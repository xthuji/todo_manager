// 公共节日工具模块已在HTML中直接引入

import "./weather/location_handler.js";

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
        window.WeatherModule.initFestivals();
        console.log('节日数据初始化完成');
        // 然后初始化天气页面
        window.WeatherModule.initLocation();
    } catch (error) {
        console.error('初始化时出错:', error);
        // 即使节日数据初始化失败，也要继续初始化天气页面地址相关信息
        window.WeatherModule.initLocation();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAll);
} else {
    // 页面已经加载完成，直接初始化
    initializeAll();
}
