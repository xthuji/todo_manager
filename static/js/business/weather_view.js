/**
 * 天气视图初始化模块
 * 针对页面：天气信息展示页面 (weather_view.html)
 * 业务功能模块：
 *  1. 页面日期更新 - 显示当前日期和时间信息
 *  2. 天气模块初始化协调 - 按正确顺序初始化各天气组件
 *  3. 错误处理与降级策略 - 确保关键功能在部分组件失败时仍能正常工作
 * 使用场景：
 *  1. 用户首次访问天气页面时的初始化流程
 *  2. 页面加载完成后显示当前日期信息
 *  3. 需要协调节日数据和位置信息初始化顺序
 * 模块化设计：
 *  - 作为天气视图的入口模块，负责初始化协调
 *  - 集成location_handler.js处理位置相关功能
 *  - 与window.WeatherModule交互完成模块初始化
 * 执行流程：
 *  1. 更新页面显示的当前日期和时间
 *  2. 尝试初始化节日数据
 *  3. 初始化天气页面位置信息
 *  4. 确保即使节日数据初始化失败，位置信息仍能正常加载
 */

import "./weather/location_handler.js";

// 更新当前日期和时间
function updateCurrentDateTime() {
    const now = new Date();
    const dateStr = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日';
    const dateElement = $('#current-date');
    if (dateElement.length > 0) {
        dateElement.text(dateStr);
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

$(document).ready(initializeAll);
