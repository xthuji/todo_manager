// 天气数据代理服务示例
// 由于浏览器的同源策略限制，前端无法直接获取不同域名的天气数据
// 此文件提供了一个Node.js + Express服务器端代理的路由模块实现
const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const Stream = require('stream');

const router = express.Router();

// tianqi_weather_area_codes.json 数据源：https://j.i8tq.com/weather2020/search/city.js 
// 天气地区编码缓存文件路径(合并了天气网和墨迹天气的地区代码)
const AREA_CODES_FILE = path.join(__dirname, '../../../data/weather/merged_weather_area_codes.json');


// 缓存相关辅助函数
function getLocationFromCache(ipAddress) {
    try {
        const cacheDir = path.join(__dirname, '../../cache');
        const cacheFile = path.join(cacheDir, `ip_location_${ipAddress.replace(/\./g, '_')}.json`);
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }
        if (fs.existsSync(cacheFile)) {
            const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            // 1小时缓存
            if (Date.now() - cachedData.timestamp < 60 * 60 * 1000) {
                return cachedData.data;
            }
        }
    } catch (error) {
        console.error('读取位置缓存失败:', error);
    }
    return null;
}

function cacheLocationResult(ipAddress, locationData) {
    try {
        const cacheDir = path.join(__dirname, '../../cache');
        const cacheFile = path.join(cacheDir, `ip_location_${ipAddress.replace(/\./g, '_')}.json`);
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }
        fs.writeFileSync(cacheFile, JSON.stringify({
            timestamp: Date.now(),
            data: locationData
        }), 'utf8');
    } catch (error) {
        console.error('写入位置缓存失败:', error);
    }
}

// 根据IP地址获取位置信息 - 综合多个API获取准确的城市地区信息
router.get('/weather-ip-location', async (req, res) => {
    try {
        console.log('接收到IP位置信息请求');
        
        let ipLocationData = null;
        let weatherLocationData = null;
        let combinedData = {};
        
        // 1. 调用ip-api获取基础位置信息
        console.log('正在调用ip-api获取位置信息...');
        const ipApiUrl = 'http://ip-api.com/json/?lang=zh-CN';
        
        const ipApiResponse = await fetch(ipApiUrl, {
            timeout: 5000 // 设置5秒超时
        });
        
        if (!ipApiResponse.ok) {
            throw new Error(`ip-api响应状态码: ${ipApiResponse.status}`);
        }
        
        ipLocationData = await ipApiResponse.json();
        console.log('成功获取ip-api位置数据');
        
        // 验证是否成功获取到经纬度信息
        if (ipLocationData && typeof ipLocationData.lat === 'number' && typeof ipLocationData.lon === 'number') {
            console.log(`从ip-api获取到的经纬度：纬度=${ipLocationData.lat}, 经度=${ipLocationData.lon}`);
        } else {
            console.warn('从ip-api未能获取到有效的经纬度信息');
        }
        
        // 2. 使用从ip-api获取的IP地址调用美团地理位置服务获取省市区县信息
        if (ipLocationData && ipLocationData.query) {
            const ipAddress = ipLocationData.query;
            
            // 先尝试从缓存中获取
            const cachedLocation = getLocationFromCache(ipAddress);
            if (cachedLocation) {
                weatherLocationData = cachedLocation;
            } else {
                console.log('正在调用美团地理位置服务获取详细地区信息...');
                // 从ip-api获取的IP地址，传递给美团API
                const meituanUrl = `https://apimobile.meituan.com/locate/v2/ip/loc?rgeo=true&ip=${ipAddress}`;
                console.log(`使用从ip-api获取的IP地址构建美团API请求: ${meituanUrl}`);
                
                const meituanResponse = await fetch(meituanUrl, {
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'application/json'
                    }
                });
                
                if (!meituanResponse.ok) {
                    throw new Error(`美团地理位置服务响应状态码: ${meituanResponse.status}`);
                }
                
                weatherLocationData = await meituanResponse.json();
                console.log('成功获取美团地理位置服务数据');
                
                // 记录获取到的地区信息
                if (weatherLocationData && weatherLocationData.data && weatherLocationData.data.rgeo) {
                    const { country, province, city, district } = weatherLocationData.data.rgeo;
                    console.log(`从美团获取到的地区信息: ${country}, ${province}, ${city}, ${district}`);
                    
                    // 将结果存入缓存
                    cacheLocationResult(ipAddress, weatherLocationData);
                }
            }
        }
        
        // 3. 综合两个API的数据，只返回省市区县信息
        const simpleAddressData = {
            province: weatherLocationData && weatherLocationData.data && weatherLocationData.data.rgeo && weatherLocationData.data.rgeo.province 
                ? weatherLocationData.data.rgeo.province.replace('省', '') 
                : '未知省份',
            city: weatherLocationData && weatherLocationData.data && weatherLocationData.data.rgeo && weatherLocationData.data.rgeo.city 
                ? weatherLocationData.data.rgeo.city.replace('市', '') 
                : '未知城市',
            district: weatherLocationData && weatherLocationData.data && weatherLocationData.data.rgeo && weatherLocationData.data.rgeo.district 
                ? weatherLocationData.data.rgeo.district.replace(/[区县]$/, '') 
                : '未知区县'
        };
        
        console.log('返回简化的位置数据:', simpleAddressData);
        
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json(simpleAddressData);
    } catch (error) {
        console.error('获取和处理位置信息时发生错误:', error);
        // 异常时直接返回错误信息，由客户端自行处理
        res.status(500).json({
            success: false,
            message: '获取位置信息失败',
            error: error.message
        });
    }
});

// 抓取省市县三级地址的天气区域编码数据
router.get('/fetch-weather-area-codes', async (req, res) => {
    try {
        if (fs.existsSync(AREA_CODES_FILE)) {
            const fileContent = fs.readFileSync(AREA_CODES_FILE, 'utf-8');
            let cachedData = JSON.parse(fileContent);
            
            return res.status(200).json({
                        timestamp: cachedData.timestamp,
                        data: cachedData.data
                    });
        } else {
            throw new Error(`文件不存在，无法返回数据`);
        }
    } catch (error) {
        console.error('获取天气区域编码数据时发生错误:', error);
        res.status(500).json({
            success: false,
            message: '获取数据失败',
            error: error.message
        });
    }
});


// 提取天气数据
function extractMojiWeatherData(html) {
    const $ = cheerio.load(html);
    const weatherData = {
        liveWeather: {},     // 实况天气
        calendarWeather: []  // 天气日历
    };

    // 1. 提取今日实时天气
    const tempRange = $('.forecast .days:nth-child(2) > li:nth-child(3)').text().replaceAll('°', '').trim() || '';
    weatherData.liveWeather = {
        time: $('.wea_info .wea_weather .info_uptime').text().replace('今天', '').replace('更新', '').trim() || '', // 更新时间
        weather: $('.forecast .days:nth-child(2) > li:nth-child(2) b').text().trim() || '', // 天气状况
        temperature: $('.wea_info .wea_weather em').text().replace('°', '').trim() || '',  // 实时温度
        tempMin: tempRange.split('/')[0].trim() || '', // 最低温
        tempMax: tempRange.split('/')[1].trim() || '', // 最高温
        wind: $('.wea_info .wea_about em').text().trim() || '',        // 风向风力
        humidity: $('.wea_info .wea_about span').text().replace('湿度：', '').replace('湿度', '').trim() || '', // 湿度
        airQuality: $('.wea_info .wea_alert em').text().trim() || '', // 空气质量
        tips: $('.wea_info .wea_tips em').text().trim() || '', // 天气提示
    };

    // 2. 提取天气日历
    const calendarEls = $('.calendar #calendar_grid ul li.item');
    const yearMonthStr = `${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
    calendarEls.each((i, el) => {
        if ($(el).find('em').text().trim() === '') {
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
                tempMin: forecastDefault.mimTemp,
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
                weather: el.w1, wind: el.wd1, 
                historyTempMin: el.hmin, historyTempMax: el.hmax, // 历史均值
                realTempMin: el.minobs, realTempMax: el.maxobs, // 实际天气
                tempMin: el.min, tempMax: el.max, // 预报天气
            };
        });
    }
    return weatherData;
}


// 获取天气数据（实时处理 - 并行方式）
router.get('/weather-info', async (req, res) => {
    console.log('收到今日天气请求，查询参数:', req.query);
    const mojiAreaCode = req.query.mojiAreaCode;
    const weatherCode = req.query.weatherCode;
    if (!weatherCode) {
        return res.status(400).json({ error: '缺少mojiAreaCode/weatherCode参数' });
    }

    try {
        // 创建并行请求的Promise数组
        const promises = [];
        const timestamp = Date.now();
        
        // 设置通用请求头
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2'
        };
        
        // 1. 墨迹天气数据获取Promise
        if (mojiAreaCode) {
            const fetchMojiWeather = async () => {
                try {
                    const weatherUrl = `https://tianqi.moji.com/weather/china/${mojiAreaCode}`;
                    console.log(`开始获取墨迹天气数据，正在访问: ${weatherUrl}`);
                    const weatherResponse = await fetch(weatherUrl, { headers: headers, timeout: 5000 });
            
                    if (!weatherResponse.ok) {
                        throw new Error(`HTTP响应状态码: ${weatherResponse.status}`);
                    }
                    const weatherHtml = await weatherResponse.text();
                    const mojiWeatherData = extractMojiWeatherData(weatherHtml);
                    console.log('成功提取墨迹天气数据');
                    return mojiWeatherData;
                } catch (error) {
                    console.error('获取墨迹天气数据失败:', error.message);
                    return { error: error.message || '获取墨迹天气数据失败' };
                }
            };
            promises.push(fetchMojiWeather());
        } else {
            promises.push(Promise.resolve(null));
        }
        
        // 2.1 今日天气数据获取Promise
        const fetchTodayWeather = async () => {
            try {
                // 访问天气页面
                const todayWeatherUrl = `https://forecast.weather.com.cn/town/weather1dn/${weatherCode}.shtml`;
                console.log(`开始获取今日天气数据，正在访问: ${todayWeatherUrl}`);
                
                const weatherResponse = await fetch(todayWeatherUrl, { method: 'GET', headers: headers, timeout: 5000 });
                
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
                console.error('获取今日天气数据失败:', error.message);
                return { error: error.message || '获取天气数据失败' };
            }
        };
        promises.push(fetchTodayWeather());
        
        // 2.2 今日天气补充数据获取Promise
        const fetchTodayDetailWeather = async () => {
            try {
                // 访问天气页面
                const todayWeatherUrl = `https://d1.weather.com.cn/sk_2d/${weatherCode}.html?_=${timestamp}`;
                console.log(`开始获取今日天气补充数据，正在访问: ${todayWeatherUrl}`);
                
                const weatherResponse = await fetch(todayWeatherUrl, { method: 'GET', headers: { ... headers, 'Referer': 'https://www.weather.com.cn/'}, timeout: 5000 });
                
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
                console.error('获取今日天气补充数据失败:', error.message);
                return { error: error.message || '获取天气数据失败' };
            }
        };
        promises.push(fetchTodayDetailWeather());
        
        // 3. 天气历史数据获取Promise
        const fetchCalendarAndHistoryWeather = async () => {
            try {
                // 访问天气历史页面
                const year = new Date().getFullYear();
                // 日期格式化为 202510 yyyyMM 的形式
                const yearMonth = `${year}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
                const historyWeatherUrl = `https://d1.weather.com.cn/calendarFromMon/${year}/${weatherCode}_${yearMonth}.html?_=${timestamp}`;
                console.log(`开始获取天气历史数据，正在访问: ${historyWeatherUrl}`);
                
                const weatherResponse = await fetch(historyWeatherUrl, { method: 'GET', headers: { ... headers, 'Referer': 'https://www.weather.com.cn/'}, timeout: 5000 });
                
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
                console.error('获取天气历史数据失败:', error.message);
                return { error: error.message || '获取天气历史数据失败' };
            }
        };
        promises.push(fetchCalendarAndHistoryWeather());
        
        // 并行执行所有请求
        const [mojiWeatherData, todayWeatherData, todayDetailWeatherData, calendarAndHistoryWeatherData] = await Promise.all(promises);
        
        // 构建响应数据 - 返回所有提取到的天气信息
        // 合并 mojiWeatherData?.liveWeather， todayWeatherData?.liveWeather， todayDetailWeatherData 数据，字段缺失的进行补全（取并集）
        const todayWeather = { ...todayDetailWeatherData, ...mojiWeatherData?.liveWeather, ...todayWeatherData?.liveWeather };
        // 如果相同字段都有值时，根据数据源的时间字段，取时间更晚的那个数据源的值
        const todayWeatherList = [mojiWeatherData?.liveWeather, todayWeatherData?.liveWeather, todayDetailWeatherData].sort((a, b) => (b.time || 0) - (a.time || 0));
        // 遍历 todayWeather 的各个字段
        for (const key in todayWeather) {
            // 如果字段在 todayWeatherList 中都有值，且时间更晚的数据源的值不为空，则取该值
            let list = todayWeatherList.filter(item => item?.[key] !== undefined && item?.[key] !== '');
            if (list.length > 0 && todayWeatherList[0][key] !== undefined && todayWeatherList[0][key] !== '') {
                todayWeather[key] = todayWeatherList[0][key];
            }
        }
        todayWeather.hourlyWeather = todayWeatherData?.hourlyWeather || [];
        
        // 合并 mojiWeatherData?.calendarWeather， calendarAndHistoryWeatherData 数据，补全 calendarAndHistoryWeatherData 中 今天之前的实时天气数据
        const calendarWeather = calendarAndHistoryWeatherData || [];
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
                        if (mojiItem) {
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
            timestamp: timestamp,
            mojiAreaCode: mojiAreaCode,
            weatherCode: weatherCode,
            todayWeather:todayWeather,
            calendarWeather:calendarWeather,
            // mojiWeatherData: mojiWeatherData, 
            // todayWeatherData: todayWeatherData, 
            // todayDetailWeatherData: todayDetailWeatherData, 
            // calendarAndHistoryWeatherData: calendarAndHistoryWeatherData
        };
        console.log('天气数据提取完成');

        // 返回数据
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        // 从 cache中取模拟数据，方便调试页面
        const mockWeatherData = fs.readFileSync(path.join(__dirname, '../../cache/mock_weather_info.json'), 'utf-8');
        res.json(JSON.parse(mockWeatherData));
        // res.json(weatherData);

    } catch (error) {
        console.error('获取天气数据失败:', error);

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.status(500).json({
            error: '获取天气数据失败',
            message: error.message,
            mojiAreaCode: mojiAreaCode,
            weatherCode: weatherCode
        });
    }
});

// 导出路由
module.exports = router;