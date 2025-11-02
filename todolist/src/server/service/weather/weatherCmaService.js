const {WEATHER_HEADERS} = require("../../utils/constants");
const fetch = require('node-fetch');
const cheerio = require('cheerio');

function extractCmaWeatherData(cmaData) {
    // 格式化CMA数据为统一格式
    if (cmaData && cmaData.code === 200 && cmaData.data) {
        return {
            time: cmaData.data.lastUpdate.trim().split(' ')[1] || '', // 从lastUpdate获取时间，只保留HH:MM格式
            // weather: cmaData.data.now?.weather || '',
            temperature: cmaData.data.now?.temperature || '',
            // tempMax: cmaData.data.now?.temperature || '',
            // tempMin: cmaData.data.now?.temperature || '',
            wind: `${cmaData.data.now?.windDirection || ''} ${cmaData.data.now?.windScale || ''}`, // 风向风力
            humidity: cmaData.data.now?.humidity || '', // 湿度
        };
    }
    return null;
}

// 获取中国气象局天气数据
async function fetchCmaWeather(cmaAreaCode){
    if (!cmaAreaCode) {
        return null;
    }
    try {
        // 仅使用指定的URL接口
        const cmaWeatherUrl = `https://weather.cma.cn/api/now/${cmaAreaCode}`;
        console.log(`开始获取中国气象局天气数据，正在访问: ${cmaWeatherUrl}`);

        const weatherResponse = await fetch(cmaWeatherUrl, { method: 'GET', headers: WEATHER_HEADERS, timeout: 5000 });

        if (!weatherResponse.ok) {
            throw new Error(`HTTP响应状态码: ${weatherResponse.status}`);
        }

        const cmaData = await weatherResponse.json();
        console.log('成功获取中国气象局天气数据');

        const cmaWeatherData = extractCmaWeatherData(cmaData);
        console.log('成功提取中国气象局天气数据');
        return cmaWeatherData;
    } catch (error) {
        console.error('获取中国气象局天气数据失败:', error.message);
        return null;
    }
}

module.exports = {
    fetchCmaWeather
};
