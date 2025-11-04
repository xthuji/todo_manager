const {WEATHER_HEADERS} = require("../../utils/constants");

const fetch = require('node-fetch');
const cheerio = require('cheerio');

// 提取今日天气数据
function extractTodayWeatherData(html) {
    const $ = cheerio.load(html);
    const weatherData = {
        liveWeather: {},    // 实况天气
        hourlyWeather: [], // 逐小时预报
        lifeHelper: []      // 生活助手
    };

    // 从js脚本中获取 实时天气 和 逐小时预报
    const scriptContent = $('.L_weather > script:nth-child(3)').html();
    if (scriptContent) {
        // 使用正则表达式提取对象定义
        const matchForecast1h = scriptContent.match(/var forecast_1h\s?=\s?(\[.*?\]);/s);
        const matchForecastDefault = scriptContent.match(/var forecast_default\s?=\s?(\{.*?\});/s);
    
        if (matchForecastDefault) {
            const forecastDefault = JSON.parse(matchForecastDefault[1]);
            weatherData.liveWeather = {
                time: forecastDefault.time,
                weather: forecastDefault.weather,
                temperature: forecastDefault.temp,
                tempMax: forecastDefault.maxTemp,
                tempMin: forecastDefault.minTemp,
                wind: forecastDefault.wind, // 风向风力
                humidity: forecastDefault.humidity,
            };
        }
        if (matchForecast1h) {
            const forecast1h = JSON.parse(matchForecast1h[1]);
            weatherData.hourlyWeather = forecast1h.map(item => ({
                hour: item.time,
                weather: item.weather,
                temperature: item.temp,
                wind: `${item.windD} ${item.windL}`, // 风向风力
            }));
        }
    }
    // 从页面中获取 生活助手 数据
    const lifeTitleContent = $('div.weather_shzs_1d > ul > li');
    const lifeValueContent = $('div.weather_shzs_1d > div.lv > dl');
    lifeTitleContent.each((i, el) => {
        const value = $(lifeValueContent[i])
        weatherData.lifeHelper.push({
            title: $(el).find('h2').text().trim(),
            value: value.find('em').text().trim(),
            desc: value.find('dd').text().trim(),
        });
    });
    return weatherData;
}

// 获取今日天气数据
async function fetchTodayWeather(weatherCode){
    try {
        // 访问天气页面
        const todayWeatherUrl = `https://forecast.weather.com.cn/town/weather1dn/${weatherCode}.shtml`;
        console.log(`开始获取今日天气数据，正在访问: ${todayWeatherUrl}`);

        const weatherResponse = await fetch(todayWeatherUrl, { method: 'GET', headers: WEATHER_HEADERS, timeout: 5000 });

        if (!weatherResponse.ok) {
            throw new Error(`HTTP响应状态码: ${weatherResponse.status}`);
        }

        // 获取页面HTML内容
        const weatherContent = await weatherResponse.text();
        // 提取天气数据
        const weatherData = extractTodayWeatherData(weatherContent);
        console.log('成功提取今日天气数据');
        return weatherData;
    } catch (error) {
        console.error('获取今日天气数据失败:', error);
        return { error: { message: error.message || '获取天气数据失败' } };
    }
}

module.exports = {
    fetchTodayWeather,
    fetchRecentDaysWeather,
    fetchTodayDetailWeather,
    fetchCalendarAndHistoryWeather
};

// 提取今日天气补充数据的函数
function extractTodayDetailWeatherData(html) {
    let weatherData = {};

    // 使用正则表达式提取对象定义
    const matchContent = html.match(/var dataSK\s?=\s?(\{.*?\});?/s);
    if (matchContent) {
        const detailWeather = JSON.parse(matchContent[1]);
        weatherData = {
            time: detailWeather.time, // 数据时间，与 liveWeather 的数据做合并时，比较时间来决定保留哪一边的数据
            weather: detailWeather.weather,
            temperature: detailWeather.temp,
            // tempMin: detailWeather.temp,
            // tempMax: detailWeather.temp,
            wind: `${detailWeather.WD} ${detailWeather.WS}`, // 风向风力
            humidity: detailWeather.sd, // 湿度
            airQuality: detailWeather.aqi_pm25, // 空气质量
            visibility: detailWeather.njd, // 能见度
            limit: detailWeather.limitnumber, // 限行
        };
    }
    return weatherData;
}

// 获取今日天气补充数据
async function fetchTodayDetailWeather(weatherCode){
    try {
        // 访问天气页面
        const todayWeatherUrl = `https://d1.weather.com.cn/sk_2d/${weatherCode}.html?_=${Date.now()}`;
        console.log(`开始获取今日天气补充数据，正在访问: ${todayWeatherUrl}`);

        const weatherResponse = await fetch(todayWeatherUrl, { method: 'GET', headers: { ... WEATHER_HEADERS, 'Referer': 'https://www.weather.com.cn/'}, timeout: 5000 });

        if (!weatherResponse.ok) {
            throw new Error(`HTTP响应状态码: ${weatherResponse.status}`);
        }

        // 获取页面HTML内容
        const weatherContent = await weatherResponse.text();
        // 提取天气数据
        const weatherData = extractTodayDetailWeatherData(weatherContent);
        console.log('成功提取今日天气补充数据');
        return weatherData;
    } catch (error) {
        console.error('获取今日天气补充数据失败:', error);
        return { error: { message: error.message || '获取天气数据失败' } };
    }
}

// 提取近几日天气补充数据的函数
function extractRecentDaysWeatherData(html) {
    const $ = cheerio.load(html);
    const weatherData = [];

    // 定位到7天预报的ul列表
    const forecastItems = $('#7d ul li');
    forecastItems.each((i, el) => {
        const $li = $(el);

        // 改用今天日期连续加一天的方式获取日期
        const today = new Date();
        const date = new Date(today);
        date.setDate(today.getDate() + i); // i 为当前遍历的索引
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const dateStr = `${year}${month}${day}`;

        // 将计算得到的 day 与页面中 li 元素里的日期数值比对，仅保留匹配项
        const pageDateStr = $li.find('h1').text().trim().replace(/[^\d]/g, '');
        if (!pageDateStr || (pageDateStr !== day && day !== pageDateStr.padStart(2, '0'))) return;

        // 提取天气描述
        const weather = $li.find('.wea').text().trim();

        // 提取温度范围
        const tempMax = $li.find('.tem span').text().trim().replace('℃', '');     // 最高温
        const tempMin = $li.find('.tem i').text().trim().replace('℃', '');        // 最低温

        // 提取风向风力
        const windDir = $li.find('.win em span:first-child').attr('title').trim();      // 风向
        const windSpeed = $li.find('.win i').text().trim();      // 风力
        const wind = `${windDir} ${windSpeed}`;

        weatherData.push({ date:dateStr, weather, tempMin, tempMax, wind });
    });

    return weatherData;
}

// 获取近几日天气数据
async function fetchRecentDaysWeather(weatherCode){
    try {
        const daysWeatherUrl = `https://www.weather.com.cn/weather/${weatherCode}.shtml`;
        console.log(`开始获取近几日天气数据，正在访问: ${daysWeatherUrl}`);

        const weatherResponse = await fetch(daysWeatherUrl, { method: 'GET', headers: WEATHER_HEADERS, timeout: 5000 });

        if (!weatherResponse.ok) {
            throw new Error(`HTTP响应状态码: ${weatherResponse.status}`);
        }

        // 获取页面HTML内容
        const weatherContent = await weatherResponse.text();
        // 提取近几日天气数据
        const weatherData = extractRecentDaysWeatherData(weatherContent);
        console.log('成功提取近几日天气数据');
        return weatherData;
    } catch (error) {
        console.error('获取近几日天气数据失败:', error);
        return { error: { message: error.message || '获取近几日天气数据失败' } };
    }
}


// 40天天气预报中的天气代码映射。 来源：https://i.tq121.com.cn/j/weather2017/c_40d.js
const calendarWeatherMap = {0:"晴",1:"多云",2:"阴",3:"阵雨",4:"雷阵雨",5:"雷阵雨伴有冰雹",6:"雨夹雪",7:"小雨",8:"中雨",9:"大雨","00":"晴","01":"多云","02":"阴","03":"阵雨","04":"雷阵雨","05":"雷阵雨伴有冰雹","06":"雨夹雪","07":"小雨","08":"中雨","09":"大雨",10:"暴雨",11:"大暴雨",12:"特大暴雨",13:"阵雪",14:"小雪",15:"中雪",16:"大雪",17:"暴雪",18:"雾",19:"冻雨",20:"沙尘暴",21:"小到中雨",22:"中到大雨",23:"大到暴雨",24:"暴雨到大暴雨",25:"大暴雨到特大暴雨",26:"小到中雪",27:"中到大雪",28:"大到暴雪",29:"浮尘",30:"扬沙",31:"强沙尘暴",53:"霾",99:"无",32:"浓雾",49:"强浓雾",54:"中度霾",55:"重度霾",56:"严重霾",57:"大雾",58:"特强浓雾",301:"雨",302:"雪"};
function getCalendarWeatherByCode(code1, code2) {
    if (!code1 && !code2) {
        return '';
    }
    const weather1 = code1 ? calendarWeatherMap[parseInt(code1)] : '';
    const weather2 = code2 ? calendarWeatherMap[parseInt(code2)] : '';
    if (weather1 && weather2) {
        return `${weather1}转${weather2}`;
    }
    return weather1 || weather2 || '';
}
// 提取历史天气数据的函数
function extractCalendarAndHistoryWeatherData(html) {
    let weatherData = [];

    // 使用正则表达式提取对象定义
    const matchHistory = html.match(/var fc40\s?=\s?(\[.*?\]);?/s);
    if (matchHistory) {
        const calendarAndHistoryWeather = JSON.parse(matchHistory[1]);
        // 过滤出本月的天气数据
        // 获取 本月 和 下个月的 日期表示 yyyyMM 格式, 这里允许出现 202500 和 202513 的情况出现，过滤时不影响
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currMonthStr = `${currentYear}${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`; // 月份从0开始，需要+1
        const nextMonthStr = `${currentYear}${(currentDate.getMonth() + 2).toString().padStart(2, '0')}`; // 月份从0开始，需要+1
        // 过滤出本月的天气数据
        weatherData = calendarAndHistoryWeather.filter(item => item.date>currMonthStr && item.date<nextMonthStr).map(el => {
            return {
                date: el.date, // 20251002 格式 
                weather: el.w1 || getCalendarWeatherByCode(el.c1, el.c2), // 天气
                wind: el.wd1, // 风力风向
                historyTempMin: el.hmin, historyTempMax: el.hmax, // 历史均值
                realTempMin: el.minobs, realTempMax: el.maxobs, // 实际天气
                tempMin: el.min, tempMax: el.max, // 预报天气
            };
        });
    }
    return weatherData;
}

// 获取天气历史数据
async function fetchCalendarAndHistoryWeather(weatherCode){
    try {
        // 访问天气历史页面
        const year = new Date().getFullYear();
        // 日期格式化为 202510 yyyyMM 的形式
        const yearMonth = `${year}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
        const historyWeatherUrl = `https://d1.weather.com.cn/calendarFromMon/${year}/${weatherCode}_${yearMonth}.html?_=${Date.now()}`;
        console.log(`开始获取天气历史数据，正在访问: ${historyWeatherUrl}`);

        const weatherResponse = await fetch(historyWeatherUrl, { method: 'GET', headers: { ... WEATHER_HEADERS, 'Referer': 'https://www.weather.com.cn/'}, timeout: 5000 });

        if (!weatherResponse.ok) {
            throw new Error(`HTTP响应状态码: ${weatherResponse.status}`);
        }

        // 获取页面HTML内容
        const weatherContent = await weatherResponse.text();
        // 提取天气历史数据
        const weatherData = extractCalendarAndHistoryWeatherData(weatherContent);
        console.log('成功提取天气历史数据');
        return weatherData;
    } catch (error) {
        console.error('获取天气历史数据失败:', error);
        return { error: { message: error.message || '获取天气历史数据失败' } };
    }
}
