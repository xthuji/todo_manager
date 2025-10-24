// 天气数据代理服务示例
// 由于浏览器的同源策略限制，前端无法直接获取不同域名的天气数据
// 此文件提供了一个Node.js + Express服务器端代理的路由模块实现
const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const BASE_DIR = path.join(__dirname, '../../../');
const CACHE_DIR = path.join(BASE_DIR, 'cache');
// tianqi_weather_area_codes.json 数据源： https://j.i8tq.com/weather2020/search/city.js 
// moji_weather_area_codes.json 数据源： https://m.moji.com/weather/china/beijing
// 天气地区编码缓存文件路径(合并了天气网和墨迹天气的地区代码)
const AREA_CODES_FILE = path.join(BASE_DIR, 'data/weather/merged_tianqi_moji_area_codes.json');
let areaCodesData;
if (fs.existsSync(AREA_CODES_FILE)) {
    const areaCodesContent = fs.readFileSync(AREA_CODES_FILE, 'utf-8');
    areaCodesData = JSON.parse(areaCodesContent);
}
// 通用缓存处理函数
/**
 * 通用缓存处理函数，根据参数决定执行读取或写入操作
 * @param {string} cacheKey - 缓存的唯一标识符（如IP地址）
 * @param {Object|null} data - 要缓存的数据，如果为null则执行读取操作
 * @param {Object} options - 配置项
 * @param {string} options.cacheDir - 缓存目录路径
 * @param {string} options.cachePrefix - 缓存文件前缀
 * @param {number} options.ttl - 缓存过期时间（毫秒）
 * @param {string} options.extension - 缓存文件扩展名
 * @returns {Object|null} 读取模式下返回缓存的数据，写入模式下返回null
 */
function handleCache(cacheKey, data = null, options = {}) {
    try {
        // 清理缓存键，避免文件系统特殊字符问题
        const safeCacheKey = cacheKey.replace(/\./g, '_');
        const cacheFile = path.join(
            options.cacheDir,
            `${options.cachePrefix}${safeCacheKey}.${options.extension}`
        );
        
        // 确保缓存目录存在
        if (!fs.existsSync(options.cacheDir)) {
            fs.mkdirSync(options.cacheDir, { recursive: true });
        }
        
        // 写入模式
        if (data !== null) {
            fs.writeFileSync(cacheFile, JSON.stringify({
                timestamp: Date.now(),
                data: data
            }), 'utf8');
            return null;
        }
        
        // 读取模式
        if (fs.existsSync(cacheFile)) {
            const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            // 检查缓存是否有效
            if (Date.now() - cachedData.timestamp < options.ttl) {
                return cachedData.data;
            }
        }
    } catch (error) {
        console.error(`缓存${data !== null ? '写入' : '读取'}失败:`, error);
    }
    return null;
}

// IP位置信息缓存入口函数
/**
 * IP位置信息缓存处理函数，封装handleCache并提供默认配置
 * @param {string} ipAddress - IP地址作为缓存键
 * @param {Object|null} locationData - 要缓存的位置数据，如果为null则执行读取操作
 * @returns {Object|null} 读取模式下返回缓存的位置数据，写入模式下返回null
 */
function cacheIpLocation(ipAddress, locationData = null) {
    const defaultOptions = {
        cachePrefix: 'ip_',
        ttl: 5 * 60 * 60 * 1000, // 5小时缓存
        cacheDir: CACHE_DIR,
        extension: 'json'
    };
    
    if (locationData !== null) {
        console.log('缓存IP位置信息:', ipAddress);
    }
    
    return handleCache(ipAddress, locationData, defaultOptions);
}

// 接口级别响应缓存处理函数
/**
 * 接口级别响应缓存处理函数，用于缓存整个API的响应结果
 * @param {string} endpoint - 接口名称
 * @param {string} clientIp - 客户端IP地址
 * @param {Object|null} responseData - 要缓存的响应数据，如果为null则执行读取操作
 * @returns {Object|null} 读取模式下返回缓存的响应数据，写入模式下返回null
 */
function cacheApiResponse(endpoint, clientIp, responseData = null) {
    const cacheKey = `${endpoint}_${clientIp}`.replaceAll(':', "_");
    const defaultOptions = {
        cachePrefix: 'api_',
        ttl: 15 * 60 * 1000, // 15分钟缓存
        cacheDir: CACHE_DIR,
        extension: 'json'
    };
    
    if (responseData !== null) {
        console.log('缓存接口响应:', cacheKey);
    }
    
    return handleCache(cacheKey, responseData, defaultOptions);
}

// 获取客户端IP地址
function getClientIp(req) {
    // 优先从X-Forwarded-For头获取（考虑代理），其次使用req.ip
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
           req.ip || 
           'unknown_ip';
}

// 天气信息缓存入口函数
/**
 * 天气信息缓存处理函数，封装handleCache并提供默认配置
 * @param {string} weatherCode - 天气代码
 * @param {string|null} mojiAreaCode - 墨迹天气区域代码（可选）
 * @param {Object|null} weatherData - 要缓存的天气数据，如果为null则执行读取操作
 * @returns {Object|null} 读取模式下返回缓存的天气数据，写入模式下返回null
 */
function cacheWeatherInfo(weatherCode, mojiAreaCode = null, weatherData = null) {
    const cacheKey = `${weatherCode}_${mojiAreaCode || 'default'}`.replaceAll('/', '_');
    const defaultOptions = {
        cachePrefix: 'weather_',
        ttl: 10 * 60 * 1000, // 10分钟缓存
        cacheDir: CACHE_DIR,
        extension: 'json'
    };
    
    if (weatherData !== null) {
        console.log('缓存天气信息:', cacheKey);
    }
    
    return handleCache(cacheKey, weatherData, defaultOptions);
}

// 辅助函数：递归查找区县信息，确定完整的省市县信息
function findDistrictInfo(areaData, districtName) {
    let result = null;
    
    // 递归搜索函数
    function searchRecursive(data, currentProvince, currentCity, provinceMojiCode) {
        if (!data || !Array.isArray(data)) return;
        
        for (const item of data) {
            // 检查是否为叶子节点（区县）
            if (item.code && item.name === districtName) {
                result = {
                    province: currentProvince,
                    city: currentCity,
                    district: item.name,
                    code: item.code,
                    mojiCode: item.mojiCode,
                    provinceMojiCode: provinceMojiCode
                };
                return;
            }
            
            // 如果有children，继续递归搜索
            if (item.children && item.children.length > 0) {
                if (currentProvince === null) {
                    // 第一级：省份
                    searchRecursive(item.children, item.name, null, item.mojiCode);
                } else if (currentCity === null) {
                    // 第二级：城市
                    searchRecursive(item.children, currentProvince, item.name, provinceMojiCode);
                } else {
                    // 第三级：区县
                    searchRecursive(item.children, currentProvince, currentCity, provinceMojiCode);
                }
            }
            
            if (result) break;
        }
    }
    
    searchRecursive(areaData, null, null, null);
    return result;
}

// 根据IP地址获取位置信息 - 综合多个API获取准确的城市地区信息
// http://ip-api.com/json/?lang=zh-CN
// https://apimobile.meituan.com/locate/v2/ip/loc?rgeo=true&ip=${ipAddress}
// https://weather.cma.cn/api/weather/view
router.get('/ip-location-area', async (req, res) => {
    try {
        // 获取客户端IP地址
        const clientIp = getClientIp(req);
        console.log('接收到IP位置信息请求，客户端IP:', clientIp);
        
        // 尝试从接口级缓存获取结果
        const cachedAddressData = cacheApiResponse('ip-location-area', clientIp);
        if (cachedAddressData) {
            console.log('使用接口级缓存的位置信息响应');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.status(200).json({
                data: cachedAddressData,
                weatherAreaCodes: areaCodesData,
            });
        }
        
        console.log('正在调用气象局天气接口获取天气和位置信息...');
        const weatherLocationApiResponse = await fetch('https://weather.cma.cn/api/weather/view', {
            timeout: 10000 // 设置10秒超时
        });
        
        if (!weatherLocationApiResponse.ok) {
            throw new Error(`气象局天气接口接口响应状态码: ${weatherLocationApiResponse.status}`);
        }
        
        const weatherLocationData = await weatherLocationApiResponse.json();
        console.log('成功获取气象局天气接口数据');
        
        // 位置数据
        const addressData = {
            province: weatherLocationData.data.location.path 
                ? weatherLocationData.data.location.path.split(',')[1].replace('省', '').trim()
                : '未知省份',
            city: '未知城市',
            district: weatherLocationData.data.location.name 
                ? weatherLocationData.data.location.name.replace(/[区县]$/, '') 
                : '未知区县',
        };
        
        // 读取地区编码数据，用于查找完整的省市县信息
        if (areaCodesData && addressData.district !== '未知区县') {
            // 使用辅助函数查找完整的省市县信息
            const districtInfo = findDistrictInfo(areaCodesData.data, addressData.district);
            if (districtInfo) {
                addressData.province = districtInfo.province || addressData.province;
                addressData.city = districtInfo.city || addressData.city;
                addressData.district = districtInfo.district || addressData.district;
                addressData.code = districtInfo.code;
                addressData.provinceMojiCode = districtInfo.provinceMojiCode;
                addressData.districtMojiCode = districtInfo.mojiCode;
            }
        }
        
        console.log('返回完整的位置数据:', addressData);
        
        // 将最终响应数据缓存到接口级缓存
        cacheApiResponse('ip-location-area', clientIp, addressData);
        
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.status(200).json({
                data: addressData,
                weatherAreaCodes: areaCodesData,
            });
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
router.get('/weather-area-codes', async (req, res) => {
    try {
        if (areaCodesData) {
            return res.status(200).json({
                timestamp: areaCodesData.timestamp,
                data: areaCodesData.data
            });
        }
        if (fs.existsSync(AREA_CODES_FILE)) {
            const areaCodesContent = fs.readFileSync(AREA_CODES_FILE, 'utf-8');
            areaCodesData = JSON.parse(areaCodesContent);
            
            // 确保返回的数据格式符合merged_tianqi_moji_area_codes.json的结构要求
            // 省份（第一级）有mojiCode，没有code
            // 城市（第二级）没有code和mojiCode
            // 区县（第三级/叶子节点）有code和mojiCode
            return res.status(200).json({
                timestamp: areaCodesData.timestamp,
                data: areaCodesData.data
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
    
    // 验证必要参数
    if (!weatherCode) {
        return res.status(400).json({ error: '缺少weatherCode参数' });
    }
    
    // 根据新的规则：weatherCode=区县的code，mojiAreaCode=省份的mojiCode/区县的mojiCode
    // 尝试从缓存获取数据
    const cachedWeatherData = cacheWeatherInfo(weatherCode, mojiAreaCode);
    
    if (cachedWeatherData) {
        console.log('使用缓存的天气数据');
        return res.json(cachedWeatherData);
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
        todayWeather.lifeHelper = todayWeatherData?.lifeHelper || [];
        
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
        // 日志记录结果数据是否为空 mojiWeatherData, todayWeatherData, todayDetailWeatherData, calendarAndHistoryWeatherData
        // console.log('mojiWeatherData:', mojiWeatherData ? '有数据' : '无数据');
        // console.log('todayWeatherData:', todayWeatherData ? '有数据' : '无数据');
        // console.log('todayWeatherData.liveWeather:', todayWeatherData?.liveWeather ? '有数据' : '无数据');
        // console.log('todayWeatherData.hourlyWeather:', todayWeatherData?.hourlyWeather ? '有数据' : '无数据');
        // console.log('todayWeatherData.lifeHelper:', todayWeatherData?.lifeHelper ? '有数据' : '无数据');
        // console.log('todayDetailWeatherData:', todayDetailWeatherData ? '有数据' : '无数据');
        // console.log('calendarAndHistoryWeatherData:', calendarAndHistoryWeatherData ? '有数据' : '无数据');
        
        // 检查是否所有必要的API结果都有数据，只有在所有数据都有效时才缓存
        // 定义有效性检查函数
        const isValidData = (data) => {
            return data && !data.error && Object.keys(data).length > 0;
        };
        
        // 检查所有获取到的数据是否都有效
        // 如果没有提供mojiAreaCode，则跳过mojiWeatherData的检查
        const shouldCache = 
            (!mojiAreaCode || isValidData(mojiWeatherData)) && 
            isValidData(todayWeatherData) && 
            isValidData(todayDetailWeatherData) && 
            isValidData(calendarAndHistoryWeatherData);
        
        if (shouldCache) {
            console.log('所有API结果数据完整，缓存天气数据');
            cacheWeatherInfo(weatherCode, mojiAreaCode, weatherData);
        } else {
            console.log('部分API结果数据不完整，不缓存天气数据');
        }
        
        // 返回数据
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json(weatherData);
        // 从 cache中取模拟数据，方便调试页面
        // const mockWeatherData = fs.readFileSync(path.join(CACHE_DIR, 'mock_weather_info.json'), 'utf-8');
        // res.json(JSON.parse(mockWeatherData));
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