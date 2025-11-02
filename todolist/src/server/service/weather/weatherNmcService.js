import {WEATHER_HEADERS} from "../../utils/constants";

const fetch = require('node-fetch');
const cheerio = require('cheerio');

function extractNmcWeatherData(nmcData) {
    // 格式化NMC数据为统一格式
    if (nmcData && nmcData.code === 0 && nmcData.data) {
        const weatherData = {
            liveWeather: {},    // 实况天气
            dailyWeather: [],   // 近几天预报
        };
        if (nmcData.data.predict?.detail && Array.isArray(nmcData.data.predict.detail)) {
            weatherData.dailyWeather = nmcData.data.predict.detail.map(item => ({
                date: item.date || '',
                weather: item.day?.weather?.info || '',
                tempMin: item.night?.weather?.temperature || '',
                tempMax: item.day?.weather?.temperature || '',
                wind:  `${item.day?.wind?.direct || ''} ${item.day?.wind?.power || ''}`, // 风向风力
            }));
        }
        weatherData.liveWeather = {
            time: nmcData.data.publish_time.trim().split(' ')[1] || '', // 从publish_time获取时间，只保留HH:MM格式
            weather: nmcData.data.real?.weather?.info || '',
            temperature: nmcData.data.real?.weather?.temperature || '',
            tempMax: weatherData.dailyWeather?.[0]?.tempMax || '',
            tempMin: weatherData.dailyWeather?.[0]?.tempMin || '',
            wind: `${nmcData.data.real?.wind?.direct || ''} ${nmcData.data.real?.wind?.power || ''}`, // 风向风力
            humidity: nmcData.data.real?.weather?.humidity || '', // 湿度
            airQuality: `${nmcData.data.air?.aqi} ${nmcData.data.air?.text || ''}`, // 空气质量
            sunrise: nmcData.data.real?.sunriseSunset?.sunrise ||  '', // 日出
            sunset: nmcData.data.real?.sunriseSunset?.sunset ||  '', // 日落
        };
        return weatherData;
    }
    return null;
}

// 获取中央气象台天气数据
export async function fetchNmcWeather(nmcAreaCode){
    if (!nmcAreaCode) {
        return null;
    }
    try {
        // 仅使用指定的URL接口，使用当前时间戳
        const nmcWeatherUrl = `https://www.nmc.cn/rest/weather?stationid=${nmcAreaCode}&_=${timestamp}`;
        console.log(`开始获取中央气象台天气数据，正在访问: ${nmcWeatherUrl}`);

        const weatherResponse = await fetch(nmcWeatherUrl, { method: 'GET', headers: WEATHER_HEADERS, timeout: 5000 });

        if (!weatherResponse.ok) {
            throw new Error(`HTTP响应状态码: ${weatherResponse.status}`);
        }

        const nmcData = await weatherResponse.json();
        console.log('成功获取中央气象台天气数据');

        const nmcWeatherData = extractNmcWeatherData(nmcData);
        console.log('成功提取中央气象台天气数据');
        return nmcWeatherData;
    } catch (error) {
        console.error('获取中央气象台天气数据失败:', error.message);
        return null;
    }
}