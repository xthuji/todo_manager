// 天气数据代理服务示例
// 由于浏览器的同源策略限制，前端无法直接获取不同域名的天气数据
// 此文件提供了一个Node.js + Express服务器端代理的路由模块实现
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const {MOCK_DIR, USE_CACHE, USE_MOCK,PRINT_API_DATA,PRINT_DATA_LOG} = require('../utils/constants.js');
const { cacheUtil } = require('../utils/cacheUtil');
const {fetchMojiWeather} = require("./weather/weatherMojiService");
const {fetchTodayWeather, fetchRecentDaysWeather, fetchTodayDetailWeather, fetchCalendarAndHistoryWeather} = require("./weather/weatherTianqiService");
const {fetchNmcWeather} = require("./weather/weatherNmcService");
const {fetchCmaWeather} = require("./weather/weatherCmaService");

let WEATHER_OPTIONS = {
    allowExpired: true, // 允许使用过期缓存作为兜底
    ttl: 3600 * 1000, // 缓存1小时
};
let mockWeatherData;

/**
 * 天气信息缓存处理函数
 * @param {Object} areaCodeInfo - 天气代码参数
 * @param {Object|null} weatherData - 要缓存的天气数据，如果为null则执行读取操作
 * @returns {Object|null} 读取模式下返回缓存的天气数据，写入模式下返回null
 */
function cacheWeatherInfo(areaCodeInfo = null, weatherData = null) {
    if (!USE_CACHE) {
        return null;
    }

    const cacheKey = `${(areaCodeInfo.weatherCode)}_${areaCodeInfo.mojiAreaCode || 'default'}`.replaceAll('/', '_');
    const fullCacheKey = `weather_${cacheKey}`;

    if (weatherData !== null) {
        console.log('缓存天气信息:', cacheKey);
        try {
            cacheUtil.setData(fullCacheKey, weatherData, WEATHER_OPTIONS);
        } catch (error) {
            console.error('缓存天气数据失败:', error.message);
        }
        return null;
    } else {
        try {
            return cacheUtil.getWrappedData(fullCacheKey);
        } catch (error) {
            console.error('获取缓存天气数据失败:', error.message);
            return null;
        }
    }
}

// 辅助函数：递归查找区县信息，确定完整的省市县信息
// 提取天气数据
// 提取今日天气数据
// 提取今日天气补充数据的函数
// 提取近几日天气补充数据的函数
// 提取历史天气数据的函数
// 获取天气数据（实时处理 - 并行方式）
// https://tianqi.moji.com/weather/china/zhejiang/xiaoshan-district
// https://forecast.weather.com.cn/town/weather1dn/101210102.shtml
// https://www.weather.com.cn/weather1d/101210102.shtml
// https://www.weather.com.cn/weather1dn/101210102.shtml
// https://www.weather.com.cn/weather40d/101210102.shtml
// https://www.weather.com.cn/weather40dn/101210102.shtml
function buildWeatherData(mojiWeatherData, todayWeatherData, todayDetailWeatherData, cmaWeatherData, nmcWeatherData, recentDaysWeatherData, calendarAndHistoryWeatherData, weatherAreaCodeParams) {
    // 今日天气信息。优先取更新时间更晚的那个数据
    const todayWeatherList = [mojiWeatherData?.liveWeather, todayWeatherData?.liveWeather, todayDetailWeatherData, cmaWeatherData, nmcWeatherData?.liveWeather]
        .filter(item => item && item?.time)
        .sort((a, b) => (b.time || 0) - (a.time || 0));
    // 合并 mojiWeatherData?.liveWeather， todayWeatherData?.liveWeather， todayDetailWeatherData 数据，字段缺失的进行补全（取并集）
    // const todayWeather = { ...todayDetailWeatherData, ...mojiWeatherData?.liveWeather, ...todayWeatherData?.liveWeather };
    const todayWeather = {...todayWeatherList[0], ...todayDetailWeatherData, ...mojiWeatherData?.liveWeather, ...todayWeatherData?.liveWeather, ...cmaWeatherData, ...nmcWeatherData?.liveWeather};
    // 遍历 todayWeather 的各个字段。 如果相同字段都有值时，根据数据源的时间字段，取时间更晚的那个数据源的值
    for (const key in todayWeather) {
        // 如果字段在 todayWeatherList 中都有值，且时间更晚的数据源的值不为空，则取该值
        let list = todayWeatherList.filter(item => item?.[key] !== undefined && item?.[key] !== '');
        if (list.length > 0 && todayWeatherList[0][key] !== undefined && todayWeatherList[0][key] !== '') {
            todayWeather[key] = todayWeatherList[0][key];
        }
    }
    todayWeather.hourlyWeather = todayWeatherData?.hourlyWeather || [];
    todayWeather.lifeHelper = todayWeatherData?.lifeHelper || [];

    const recentDaysWeather = recentDaysWeatherData || nmcWeatherData?.dailyWeather || [];

    // 合并 mojiWeatherData?.calendarWeather， calendarAndHistoryWeatherData 数据，补全 calendarAndHistoryWeatherData 中 今天之前的实时天气数据
    let calendarWeather = calendarAndHistoryWeatherData || [];
    if (mojiWeatherData?.calendarWeather) {
        if (!calendarWeather) {
            calendarWeather = mojiWeatherData?.calendarWeather;
        } else {
            // mojiWeatherData?.calendarWeather 转换成 date 为key 的map形式
            const mojiWeatherMap = mojiWeatherData?.calendarWeather?.reduce((acc, item) => {
                acc[item.date] = item;
                return acc;
            }, {});

            const todayStr = `${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}`;
            calendarWeather.forEach(item => {
                if (item.date < todayStr) {
                    const mojiItem = mojiWeatherMap[item.date];
                    if (mojiItem && mojiItem.weather) {
                        item.weather = mojiItem.weather;
                        item.tempMin = mojiItem.tempMin;
                        item.tempMax = mojiItem.tempMax;
                        item.wind = mojiItem.wind;
                    }
                }
            });
        }
    }

    const weatherData = {
        ...weatherAreaCodeParams,
        todayWeather: todayWeather, recentDaysWeather: recentDaysWeather, calendarWeather: calendarWeather,
    };
    console.log('天气数据提取完成');

    if (PRINT_DATA_LOG) {
        console.log('墨迹天气数据:', JSON.stringify(mojiWeatherData));
        console.log('今日天气数据:', JSON.stringify(todayWeatherData));
        console.log('今日天气补充数据:', JSON.stringify(todayDetailWeatherData));
        console.log('近几日天气数据:', JSON.stringify(recentDaysWeatherData));
        console.log('天气历史数据:', JSON.stringify(calendarAndHistoryWeatherData));
        console.log('CMA(中国气象局)天气数据:', JSON.stringify(cmaWeatherData));
        console.log('NMC(中央气象台)天气数据:', JSON.stringify(nmcWeatherData));
    }
    if (PRINT_API_DATA) {
        weatherData.apiData = {mojiWeatherData, todayWeatherData, todayDetailWeatherData, cmaWeatherData, nmcWeatherData, recentDaysWeatherData, calendarAndHistoryWeatherData};
    }
    
    // 检查是否所有必要的API结果都有数据，只有在所有数据都有效时才缓存。如果没有提供mojiAreaCode，则跳过mojiWeatherData的检查
    const hasMoji = !weatherAreaCodeParams.mojiAreaCode || Object.keys(mojiWeatherData || {}).length;
    const hasToday = Object.keys(todayWeatherData || {}).length;
    const hasTodayLiveWeather = todayWeatherData?.liveWeather && Object.keys(todayWeatherData.liveWeather).length;
    const hasTodayHourlyWeather = todayWeatherData?.hourlyWeather && todayWeatherData.hourlyWeather?.length;
    const hasTodayLifeHelper = todayWeatherData?.lifeHelper && todayWeatherData.lifeHelper?.length;
    const hasDetail = Object.keys(todayDetailWeatherData || {}).length;
    const hasRecentDays = recentDaysWeatherData && recentDaysWeatherData?.length;
    const hasCalendar = calendarAndHistoryWeatherData && calendarAndHistoryWeatherData?.length;

    if (hasMoji && hasToday && hasTodayLiveWeather && hasTodayHourlyWeather && hasTodayLifeHelper && hasDetail && hasRecentDays && hasCalendar) {
        console.log('所有API结果数据完整，缓存天气数据');
        cacheWeatherInfo(weatherAreaCodeParams, weatherData);
    }
    return weatherData;
}

// https://weather.cma.cn/web/weather/58459.html
async function queryWeatherData(weatherAreaCodeParams) {
    // 尝试从缓存获取数据，但如果是强制刷新则跳过缓存
    if (!weatherAreaCodeParams.forceRefresh) {
        const cachedWeatherData = cacheWeatherInfo(weatherAreaCodeParams);
        if (cachedWeatherData) {
            console.log('使用缓存的天气数据');
            return cachedWeatherData; // 直接返回缓存工具提供的格式
        }
    } else {
        console.log('强制刷新，跳过缓存');
    }

    // 创建并行请求的Promise数组
    const promises = [];
    // 1. 墨迹天气数据获取Promise
    promises.push(fetchMojiWeather(weatherAreaCodeParams.mojiAreaCode));
    // 2.1 今日天气数据获取Promise
    promises.push(fetchTodayWeather(weatherAreaCodeParams.weatherCode));
    // 2.2 今日天气补充数据获取Promise
    promises.push(fetchTodayDetailWeather(weatherAreaCodeParams.weatherCode));
    // 3. 近几日天气数据获取Promise
    promises.push(fetchRecentDaysWeather(weatherAreaCodeParams.weatherCode));
    // 4. 天气历史数据获取Promise
    promises.push(fetchCalendarAndHistoryWeather(weatherAreaCodeParams.weatherCode));
    // 5. CMA(中国气象局)天气数据获取Promise - 备用数据源
    promises.push(fetchCmaWeather(weatherAreaCodeParams.cmaAreaCode));
    // 6. NMC(中央气象台)天气数据获取Promise - 备用数据源
    promises.push(fetchNmcWeather(weatherAreaCodeParams.nmcApiCode));

    // 并行执行所有请求
    const [mojiWeatherData, todayWeatherData, todayDetailWeatherData, recentDaysWeatherData, calendarAndHistoryWeatherData, cmaWeatherData, nmcWeatherData] = await Promise.all(promises);
    
    // 检查各数据源的错误信息并记录
    const errors = [];
    if (nmcWeatherData?.error) errors.push('NMC: ' + (nmcWeatherData.error.message || nmcWeatherData.error));
    if (cmaWeatherData?.error) errors.push('CMA: ' + (cmaWeatherData.error.message || cmaWeatherData.error));
    if (todayWeatherData?.error) errors.push('Tianqi: ' + (todayWeatherData.error.message || todayWeatherData.error));
    if (mojiWeatherData?.error) errors.push('Moji: ' + (mojiWeatherData.error.message || mojiWeatherData.error));
    if (recentDaysWeatherData?.error) errors.push('RecentDays: ' + (recentDaysWeatherData.error.message || recentDaysWeatherData.error));
    if (calendarAndHistoryWeatherData?.error) errors.push('Calendar: ' + (calendarAndHistoryWeatherData.error.message || calendarAndHistoryWeatherData.error));
    if (todayDetailWeatherData?.error) errors.push('TodayDetail: ' + (todayDetailWeatherData.error.message || todayDetailWeatherData.error));
    
    if (errors.length > 0) {
        console.log('部分天气服务出错，但尝试继续处理数据:', errors);
    }

    let weatherData = buildWeatherData(mojiWeatherData, todayWeatherData, todayDetailWeatherData, cmaWeatherData, nmcWeatherData, recentDaysWeatherData, calendarAndHistoryWeatherData, weatherAreaCodeParams);
    return { data: weatherData, timestamp: Date.now() };
}

// https://www.nmc.cn/publish/forecast/AZJ/wdcXE.html
async function getWeatherData(weatherAreaCodeParams){
    if (!weatherAreaCodeParams) {
        return { error: { message: '参数weatherAreaCodeParams不能为空' } };
    }
    if (USE_MOCK) {
        return cacheUtil.getWrappedData('mock_weather_info', {
            sourceFile: path.join(MOCK_DIR, 'mock_weather_info.json'),
            permanent: true,
            ttl: 0,
        })
    }
    console.log('天气请求参数:', JSON.stringify(weatherAreaCodeParams));

    try {
        return await queryWeatherData(weatherAreaCodeParams);
    } catch (error) {
        console.error('获取天气数据失败:', error);
        return { error: { message: error.message || '获取天气数据失败' } };
    }
}

module.exports = {
    getWeatherData
};