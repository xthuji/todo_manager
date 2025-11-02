// 天气数据代理服务示例
// 由于浏览器的同源策略限制，前端无法直接获取不同域名的天气数据
// 此文件提供了一个Node.js + Express服务器端代理的路由模块实现
import {CACHE_DIR, MOCK_DIR, USE_CACHE, USE_MOCK} from '../utils/constants.js'
import {handleCache} from '../utils/cacheUtil.js'
import {fetchMojiWeather} from "./weather/weatherMojiService";
import {fetchTodayWeather, fetchRecentDaysWeather, fetchTodayDetailWeather, fetchCalendarAndHistoryWeather} from "./weather/weatherTianqiService";
import {fetchNmcWeather} from "./weather/weatherNmcService";
import {fetchCmaWeather} from "./weather/weatherCmaService";

const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

let mockWeatherData;

/**
 * 天气信息缓存处理函数，封装handleCache并提供默认配置
 * @param {string} weatherCode - 天气代码
 * @param {string|null} mojiAreaCode - 墨迹天气区域代码（可选）
 * @param {Object|null} weatherData - 要缓存的天气数据，如果为null则执行读取操作
 * @returns {Object|null} 读取模式下返回缓存的天气数据，写入模式下返回null
 */
function cacheWeatherInfo(weatherCode, mojiAreaCode = null, weatherData = null) {
    if (!USE_CACHE) {
        return null;
    }
    const cacheKey = `${weatherCode}_${mojiAreaCode || 'default'}`.replaceAll('/', '_');
    const defaultOptions = {
        cachePrefix: 'weather_',
        ttl: 120 * 60 * 1000, // 2小时缓存
        cacheDir: CACHE_DIR,
        extension: 'json'
    };
    
    if (weatherData !== null) {
        console.log('缓存天气信息:', cacheKey);
    }
    
    return handleCache(cacheKey, weatherData, defaultOptions);
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
// https://weather.cma.cn/web/weather/58459.html
// https://www.nmc.cn/publish/forecast/AZJ/wdcXE.html
export async function getWeatherData(weatherAreaCodeParams){
    if (USE_MOCK) {
        if (!mockWeatherData) {
            const mockWeatherDataStr = fs.readFileSync(path.join(MOCK_DIR, 'mock_weather_info.json'), 'utf-8');
            mockWeatherData = JSON.parse(mockWeatherDataStr)
        }
        return mockWeatherData;
    }
    console.log('收到今日天气请求，查询参数:', JSON.stringify(weatherAreaCodeParams));
    const weatherCode = weatherAreaCodeParams.weatherCode;
    const mojiAreaCode = weatherAreaCodeParams.mojiAreaCode;
    const nmcAreaCode = weatherAreaCodeParams.nmcAreaCode;
    const cmaAreaCode = weatherAreaCodeParams.cmaAreaCode;

    // 验证必要参数
    if (!weatherCode) {
        throw new Error('缺少weatherCode参数');
    }
    
    // 根据新的规则：weatherCode=区县的code，mojiAreaCode=省份的mojiCode/区县的mojiCode
    // 尝试从缓存获取数据
    const cachedWeatherData = cacheWeatherInfo(weatherCode, mojiAreaCode);
    
    if (cachedWeatherData) {
        console.log('使用缓存的天气数据', weatherCode, mojiAreaCode);
        return cachedWeatherData;
    }

    // 创建并行请求的Promise数组
    const promises = [];
    const timestamp = Date.now();

    // 1. 墨迹天气数据获取Promise
    promises.push(fetchMojiWeather(mojiAreaCode));

    // 2.1 今日天气数据获取Promise
    promises.push(fetchTodayWeather(weatherCode));

    // 2.2 今日天气补充数据获取Promise
    promises.push(fetchTodayDetailWeather(weatherCode));

    // 3. 近几日天气数据获取Promise
    promises.push(fetchRecentDaysWeather(weatherCode));

    // 4. 天气历史数据获取Promise
    promises.push(fetchCalendarAndHistoryWeather(weatherCode));

    // 5. CMA(中国气象局)天气数据获取Promise - 备用数据源
    promises.push(fetchCmaWeather(cmaAreaCode));

    // 6. NMC(中央气象台)天气数据获取Promise - 备用数据源
    promises.push(fetchNmcWeather(nmcAreaCode));

    // 并行执行所有请求
    const [mojiWeatherData, todayWeatherData, todayDetailWeatherData, recentDaysWeatherData, calendarAndHistoryWeatherData, cmaWeatherData, nmcWeatherData] = await Promise.all(promises);

    // 今日天气信息。优先取更新时间更晚的那个数据
    const todayWeatherList = [mojiWeatherData?.liveWeather, todayWeatherData?.liveWeather, todayDetailWeatherData, cmaWeatherData, nmcWeatherData?.liveWeather].sort((a, b) => (b.time || 0) - (a.time || 0));
    // 合并 mojiWeatherData?.liveWeather， todayWeatherData?.liveWeather， todayDetailWeatherData 数据，字段缺失的进行补全（取并集）
    // const todayWeather = { ...todayDetailWeatherData, ...mojiWeatherData?.liveWeather, ...todayWeatherData?.liveWeather };
    const todayWeather = { ...todayWeatherList[0], ...todayDetailWeatherData, ...mojiWeatherData?.liveWeather, ...todayWeatherData?.liveWeather, ...cmaWeatherData, ...nmcWeatherData?.liveWeather };
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
        timestamp: timestamp, weatherCode: weatherCode, mojiAreaCode: mojiAreaCode, nmcAreaCode: nmcAreaCode, cmaAreaCode: cmaAreaCode,
        todayWeather:todayWeather, recentDaysWeather:recentDaysWeather, calendarWeather:calendarWeather,
    };
    console.log('天气数据提取完成');
    // 检查是否所有必要的API结果都有数据，只有在所有数据都有效时才缓存。如果没有提供mojiAreaCode，则跳过mojiWeatherData的检查
    const hasMoji = !mojiAreaCode || Object.keys(mojiWeatherData || {}).length;
    const hasToday = Object.keys(todayWeatherData || {}).length;
    const hasTodayLiveWeather = todayWeatherData?.liveWeather && Object.keys(todayWeatherData.liveWeather).length;
    const hasTodayHourlyWeather = todayWeatherData?.hourlyWeather && todayWeatherData.hourlyWeather?.length;
    const hasTodayLifeHelper = todayWeatherData?.lifeHelper && todayWeatherData.lifeHelper?.length;
    const hasDetail = Object.keys(todayDetailWeatherData || {}).length;
    const hasRecentDays = recentDaysWeatherData && recentDaysWeatherData?.length;
    const hasCalendar = calendarAndHistoryWeatherData && calendarAndHistoryWeatherData?.length;

    if (hasMoji && hasToday && hasTodayLiveWeather && hasTodayHourlyWeather && hasTodayLifeHelper && hasDetail && hasRecentDays&& hasCalendar) {
        console.log('所有API结果数据完整，缓存天气数据');
        cacheWeatherInfo(weatherCode, mojiAreaCode, weatherData);
    } else {
        console.log('部分API结果数据不完整，不缓存天气数据');
        // 日志记录结果数据是否为空 mojiWeatherData, todayWeatherData, todayDetailWeatherData, calendarAndHistoryWeatherData
        if (!hasMoji) { console.log('天气数据为空, mojiWeatherData:', JSON.stringify(mojiWeatherData)); }
        if (!hasToday) { console.log('天气数据为空, todayWeatherData:', JSON.stringify(todayWeatherData)); }
        if (!hasTodayLiveWeather) { console.log('天气数据为空, todayWeatherData.liveWeather:', JSON.stringify(todayWeatherData.liveWeather)); }
        if (!hasTodayHourlyWeather) { console.log('天气数据为空, todayWeatherData.hourlyWeather:', JSON.stringify(todayWeatherData.hourlyWeather)); }
        if (!hasTodayLifeHelper) { console.log('天气数据为空, todayWeatherData.lifeHelper:', JSON.stringify(todayWeatherData.lifeHelper)); }
        if (!hasDetail) { console.log('天气数据为空, todayDetailWeatherData:', JSON.stringify(todayDetailWeatherData)); }
        if (!hasRecentDays) { console.log('天气数据为空, recentDaysWeatherData:', JSON.stringify(recentDaysWeatherData)); }
        if (!hasCalendar) { console.log('天气数据为空, calendarAndHistoryWeatherData:', JSON.stringify(calendarAndHistoryWeatherData)); }
    }
    // 返回数据
    return weatherData;
}