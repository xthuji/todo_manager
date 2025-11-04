const {WEATHER_HEADERS} = require("../../utils/constants");

const fetch = require('node-fetch');

// 格式化NMC数据为统一格式
function extractNmcWeatherData(nmcData) {
    if (!(nmcData && nmcData.code === 0 && nmcData.data)) {
        return {};
    }
    const weatherData = {
        liveWeather: {},    // 实况天气
        dailyWeather: [],   // 近几天预报
    };
    if (nmcData.data.predict?.detail && Array.isArray(nmcData.data.predict.detail)) {
        weatherData.dailyWeather = nmcData.data.predict.detail.map(item => ({
            date: item.date?.trim().replaceAll('-','') || '',
            weather: (item.day?.weather?.info || '').replace('9999', ''),
            tempMin: (item.night?.weather?.temperature || '').replace('9999', ''),
            tempMax: (item.day?.weather?.temperature || '').replace('9999', ''),
            wind: `${item.day?.wind?.direct || ''} ${item.day?.wind?.power || ''}`.replaceAll('9999', '').trim(), // 风向风力
        }));
    }
    weatherData.liveWeather = {
        time: nmcData.data.real?.publish_time?.trim().split(' ')[1] || '', // 从publish_time获取时间，只保留HH:MM格式
        weather: nmcData.data.real?.weather?.info || '',
        temperature: nmcData.data.real?.weather?.temperature || '',
        tempMax: weatherData.dailyWeather?.[0]?.tempMax || '',
        tempMin: weatherData.dailyWeather?.[0]?.tempMin || '',
        wind: `${nmcData.data.real?.wind?.direct || ''} ${nmcData.data.real?.wind?.power || ''}`, // 风向风力
        humidity: nmcData.data.real?.weather?.humidity || '', // 湿度
        airQuality: `${nmcData.data.air?.aqi} ${nmcData.data.air?.text || ''}`, // 空气质量
        sunrise: nmcData.data.real?.sunriseSunset?.sunrise?.trim().split(' ')[1] || '', // 日出
        sunset: nmcData.data.real?.sunriseSunset?.sunset?.trim().split(' ')[1] || '', // 日落
    };
    return weatherData;
}

// 获取中央气象台天气数据
async function fetchNmcWeather(nmcApiCode){
    if (!nmcApiCode) {
        return { error: { message: '参数nmcApiCode为空，无法获取中央气象台天气数据' } };
    }
    try {
        // 仅使用指定的URL接口，使用当前时间戳
        const nmcWeatherUrl = `https://www.nmc.cn/rest/weather?stationid=${nmcApiCode}&_=${Date.now()}`;
        console.log(`开始获取中央气象台天气数据，正在访问: ${nmcWeatherUrl}`);
        const weatherResponse = await fetch(nmcWeatherUrl, { method: 'GET', headers: WEATHER_HEADERS, timeout: 5000 });

        if (!weatherResponse.ok) {
            throw new Error(`HTTP响应状态码: ${weatherResponse.status}`);
        }

        const nmcData = await weatherResponse.json();
        const nmcWeatherData = extractNmcWeatherData(nmcData);
        console.log('成功提取中央气象台天气数据');
        return nmcWeatherData;
    } catch (error) {
        console.error('获取中央气象台天气数据失败:', error);
        return { error: { message: error.message || '获取中央气象台天气数据失败' } };
    }
}

module.exports = {
    fetchNmcWeather
};