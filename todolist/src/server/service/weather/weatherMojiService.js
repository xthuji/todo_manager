const {WEATHER_HEADERS} = require("../../utils/constants");

const fetch = require('node-fetch');
const cheerio = require('cheerio');

// 提取天气数据
function extractMojiWeatherData(html) {
    const $ = cheerio.load(html);
    const weatherData = {
        liveWeather: {},     // 实况天气
        calendarWeather: []  // 天气日历
    };

    // 1. 提取今日实时天气
    const tempRange = $('.forecast .days:nth-child(2) > li:nth-child(3)')?.text()?.replaceAll('°', '').trim().split('/') || [];
    weatherData.liveWeather = {
        time: $('.wea_info .wea_weather .info_uptime').text().replace('今天', '').replace('更新', '').trim() || '', // 更新时间
        weather: $('.forecast .days:nth-child(2) > li:nth-child(2) b').text().trim() || '', // 天气状况
        temperature: $('.wea_info .wea_weather em').text().replace('°', '').trim() || '',  // 实时温度
        tempMin: tempRange.length>0 ? tempRange[0]?.trim() || '' : '', // 最低温
        tempMax: tempRange.length>1 ? tempRange[1]?.trim() || '' : '', // 最高温
        wind: $('.wea_info .wea_about em').text().trim() || '',        // 风向风力
        humidity: $('.wea_info .wea_about span').text().replace('湿度：', '').replace('湿度', '').trim() || '', // 湿度
        airQuality: $('.wea_info .wea_alert em').text().trim() || '', // 空气质量
        tips: $('.wea_info .wea_tips em').text().trim() || '', // 天气提示
    };

    // 2. 提取天气日历
    const calendarEls = $('.calendar #calendar_grid ul li.item');
    const yearMonthStr = `${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
    calendarEls.each((i, el) => {
        if ($(el).find('em')?.text()?.trim() || '' === '') {
            return;
        }
        const tempRange = $(el).find('p:nth-child(3)').text().replaceAll('°', '').trim() || ''
        weatherData.calendarWeather.push({
            date: `${yearMonthStr}${$(el).find('em').text().trim().padStart(2, '0')}`, // 20251002 格式
            weather: $(el).find('b img').attr('alt')?.trim(),
            tempMin: tempRange.split('/')[0].trim() || '', // 最低温
            tempMax: tempRange.split('/')[1].trim() || '', // 最高温
            wind: $(el).find('p:nth-child(4)').text().trim()
        });
    });

    return weatherData;
}


// 获取墨迹天气数据
async function fetchMojiWeather(mojiAreaCode){
    if (!mojiAreaCode) {
        return null;
    }
    try {
        const weatherUrl = `https://tianqi.moji.com/weather/china/${mojiAreaCode}`;
        console.log(`开始获取墨迹天气数据，正在访问: ${weatherUrl}`);
        const weatherResponse = await fetch(weatherUrl, { headers: WEATHER_HEADERS, timeout: 5000 });

        if (!weatherResponse.ok) {
            throw new Error(`HTTP响应状态码: ${weatherResponse.status}`);
        }

        const weatherHtml = await weatherResponse.text();
        const mojiWeatherData = extractMojiWeatherData(weatherHtml);
        console.log('成功提取墨迹天气数据');
        return mojiWeatherData;
    } catch (error) {
        console.error('获取墨迹天气数据失败:', error);
        return { error: error.message || '获取墨迹天气数据失败' };
    }
}

module.exports = {
    fetchMojiWeather
};
