// 天气数据代理服务示例
// 由于浏览器的同源策略限制，前端无法直接获取不同域名的天气数据
// 此文件提供了一个Node.js + Express服务器端代理的路由模块实现
const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const USE_MOCK = false;
const USE_CACHE = true;
const CACHE_DIR = path.join(__dirname, '../../../data/cache');
const MOCK_DIR = path.join(__dirname, '../../../data/mock');
// tianqi_weather_area_codes.json 数据源： https://j.i8tq.com/weather2020/search/city.js
// moji_weather_area_codes.json 数据源： https://m.moji.com/weather/china/beijing
// merged_tianqi_moji_area_codes        天气地区编码缓存文件路径(合并了天气网和墨迹天气的地区代码)
// merged_tianqi_moji_nmc_area_codes    天气地区编码缓存文件路径(合并了天气网,墨迹天气和中央气象台的地区代码)
// merged_weather_area_codes            天气地区编码缓存文件路径(合并了天气网,墨迹天气和,央气象台和中国气象局的地区代码)
const AREA_CODES_FILE = path.join(__dirname, '../../../data/weather/merged_weather_area_codes.json');
let mockWeatherData;
let mockIpAreaData;
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
    if (!USE_CACHE) {
        return null;
    }
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

// 接口级别响应缓存处理函数
/**
 * 接口级别响应缓存处理函数，用于缓存整个API的响应结果
 * @param {string} clientIp - 客户端IP地址
 * @param {Object|null} responseData - 要缓存的响应数据，如果为null则执行读取操作
 * @returns {Object|null} 读取模式下返回缓存的响应数据，写入模式下返回null
 */
function cacheIpLocation(clientIp, responseData = null) {
    const cacheKey = `${clientIp}`.replaceAll(':', "_");
    const defaultOptions = {
        cachePrefix: 'ip_',
        ttl: 300 * 60 * 1000, // 5小时缓存
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
function findDistrictInfo(areaData, provinceName, districtName) {
    let result = null;
    // 递归搜索函数
    function searchRecursive(data, currentProvince, currentCity, provinceItem) {
        if (!data || !Array.isArray(data)) return;

        for (const item of data) {
            // 检查是否为叶子节点（区县）
            if (item.code && item.name === districtName && currentProvince === provinceName) {
                result = {
                    province: currentProvince,
                    city: currentCity,
                    code: item.code,
                    district: item.name,
                    provinceMojiCode: provinceItem.mojiCode,
                    mojiCode: item.mojiCode,
                    provinceNmcCode: provinceItem.nmcCode,
                    nmcCode: item.nmcCode,
                    cmaCode: item.cmaCode,
                };
                return;
            }

            // 如果有children，继续递归搜索
            if (item.children && item.children.length > 0) {
                if (currentProvince === null) {
                    // 第一级：省份
                    searchRecursive(item.children, item.name, null, item);
                } else if (currentCity === null) {
                    // 第二级：城市
                    searchRecursive(item.children, currentProvince, item.name, provinceItem);
                } else {
                    // 第三级：区县
                    searchRecursive(item.children, currentProvince, currentCity, provinceItem);
                }
            }

            if (result) break;
        }
    }

    searchRecursive(areaData, null, null, null);
    return result;
}

async function getLocation1() {
    try {
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
        return {
            province: weatherLocationData.data.location.path
                ? weatherLocationData.data.location.path.split(',')[1].replace('省', '').trim()
                : '未知省份',
            city: '未知城市',
            district: weatherLocationData.data.location.name
                ? weatherLocationData.data.location.name.replace(/[区县]$/, '')
                : '未知区县',
        };
    } catch (error) {
        console.error('气象局天气接口获取和处理位置信息时发生错误:', error);
        return null;
    }
}

async function getLocation2() {
    try {
        // 1. 调用ip-api获取基础位置信息
        console.log('正在调用ip-api获取位置信息...');
        const ipApiUrl = 'http://ip-api.com/json/?lang=zh-CN';
        
        const ipApiResponse = await fetch(ipApiUrl, {
            timeout: 5000 // 设置5秒超时
        });
        
        if (!ipApiResponse.ok) {
            throw new Error(`ip-api响应状态码: ${ipApiResponse.status}`);
        }
        
        let ipLocationData = await ipApiResponse.json();
        console.log('成功获取ip-api位置数据');
        
        // 验证是否成功获取到经纬度信息
        if (ipLocationData && typeof ipLocationData.lat === 'number' && typeof ipLocationData.lon === 'number') {
            console.log(`从ip-api获取到的经纬度：纬度=${ipLocationData.lat}, 经度=${ipLocationData.lon}`);
        } else {
            console.warn('从ip-api未能获取到有效的经纬度信息');
        }
        
        // 2. 使用从ip-api获取的IP地址调用美团地理位置服务获取省市区县信息
        let weatherLocationData = null;
        if (ipLocationData && ipLocationData.query) {
            const ipAddress = ipLocationData.query;
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
        }
        
        // 3. 综合两个API的数据，只返回省市区县信息
        return {
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
    } catch (error) {
        console.error('ip-api&美团位置接口获取和处理位置信息时发生错误:', error);
        return null;
    }
}

// 根据IP地址获取位置信息 - 综合多个API获取准确的城市地区信息
// http://ip-api.com/json/?lang=zh-CN
// https://apimobile.meituan.com/locate/v2/ip/loc?rgeo=true&ip=${ipAddress}
// https://weather.cma.cn/api/weather/view
router.get('/ip-location', async (req, res) => {
    if (USE_MOCK) {
        if (!mockIpAreaData) {
            const mockIpAreaStr = fs.readFileSync(path.join(MOCK_DIR, 'mock_ip_area.json'), 'utf-8');
            mockIpAreaData = JSON.parse(mockIpAreaStr);
        }
        return res.json(mockIpAreaData);
    }
    try {
        // 获取客户端IP地址
        const clientIp = getClientIp(req);
        console.log('接收到IP位置信息请求，客户端IP:', clientIp);
        
        // 尝试从接口级缓存获取结果
        const cachedAddressData = cacheIpLocation(clientIp);
        if (cachedAddressData) {
            console.log('使用接口级缓存的位置信息响应');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.status(200).json({data: cachedAddressData});
        }
        
        console.log('正在调用接口获取位置信息...');
        
        
        // 位置数据
        // 创建并行请求的Promise数组
        const promises = [];
        promises.push(getLocation1(), getLocation2());
        const [addressData1, addressData2] = await Promise.all(promises);
        const addressData = addressData2 || addressData1;
        console.log(`定位数据: ${JSON.stringify(addressData)}. 结果1:${JSON.stringify(addressData1)}, 结果2:${JSON.stringify(addressData2)}`);

        // 读取地区编码数据，用于查找完整的省市县信息
        if (areaCodesData && addressData.province !== '未知省份' && addressData.district !== '未知区县') {
            // 使用辅助函数查找完整的省市县信息
            const districtInfo = findDistrictInfo(areaCodesData.data, addressData.province, addressData.district);
            if (districtInfo) {
                addressData.province = districtInfo.province || addressData.province;
                addressData.city = districtInfo.city || addressData.city;
                addressData.district = districtInfo.district || addressData.district;
                addressData.code = districtInfo.code;
                addressData.provinceMojiCode = districtInfo.provinceMojiCode;
                addressData.districtMojiCode = districtInfo.mojiCode;
                addressData.provinceNmcCode = districtInfo.provinceNmcCode;
                addressData.districtNmcCode = districtInfo.nmcCode;
                addressData.districtCmaCode = districtInfo.cmaCode;
            }
        }
        console.log('返回完整的位置数据:', addressData.toString());
        
        // 将最终响应数据缓存到接口级缓存
        cacheIpLocation(clientIp, addressData);
        
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.status(200).json({data: addressData});
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
            const areaCodesStr = fs.readFileSync(AREA_CODES_FILE, 'utf-8');
            areaCodesData = JSON.parse(areaCodesStr);
            // 省份（第一级）有mojiCode，没有code, 城市（第二级）没有code和mojiCode, 区县（第三级/叶子节点）有code和mojiCode
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


// 获取天气数据（实时处理 - 并行方式）
// https://tianqi.moji.com/weather/china/zhejiang/xiaoshan-district
// https://forecast.weather.com.cn/town/weather1dn/101210102.shtml
// https://www.weather.com.cn/weather1d/101210102.shtml
// https://www.weather.com.cn/weather1dn/101210102.shtml
// https://www.weather.com.cn/weather40d/101210102.shtml
// https://www.weather.com.cn/weather40dn/101210102.shtml
// https://weather.cma.cn/web/weather/58459.html
// https://www.nmc.cn/publish/forecast/AZJ/wdcXE.html
router.get('/weather-info', async (req, res) => {
    if (USE_MOCK) {
        if (!mockWeatherData) {
            const mockWeatherDataStr = fs.readFileSync(path.join(MOCK_DIR, 'mock_weather_info.json'), 'utf-8');
            mockWeatherData = JSON.parse(mockWeatherDataStr)
        }
        return res.json(mockWeatherData);
    }
    console.log('收到今日天气请求，查询参数:', req.query);
    const weatherCode = req.query.weatherCode;
    const mojiAreaCode = req.query.mojiAreaCode;
    const nmcAreaCode = req.query.nmcAreaCode;
    const cmaAreaCode = req.query.cmaAreaCode;

    // 验证必要参数
    if (!weatherCode) {
        return res.status(400).json({ error: '缺少weatherCode参数' });
    }
    
    // 根据新的规则：weatherCode=区县的code，mojiAreaCode=省份的mojiCode/区县的mojiCode
    // 尝试从缓存获取数据
    const cachedWeatherData = cacheWeatherInfo(weatherCode, mojiAreaCode);
    
    if (cachedWeatherData) {
        console.log('使用缓存的天气数据', weatherCode, mojiAreaCode);
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
        
        // 3. 近几日天气数据获取Promise
        const fetchRecentDaysWeather = async () => {
            try {
                const daysWeatherUrl = `https://www.weather.com.cn/weather/${weatherCode}.shtml`;
                console.log(`开始获取近几日天气数据，正在访问: ${daysWeatherUrl}`);
                
                const weatherResponse = await fetch(daysWeatherUrl, { method: 'GET', headers: headers, timeout: 5000 });
                
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
                console.error('获取近几日天气数据失败:', error.message);
                return { error: error.message || '获取近几日天气数据失败' };
            }
        };
        promises.push(fetchRecentDaysWeather());
        
        // 4. 天气历史数据获取Promise
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
        const [mojiWeatherData, todayWeatherData, todayDetailWeatherData, recentDaysWeatherData, calendarAndHistoryWeatherData] = await Promise.all(promises);
        
        // 今日天气信息。优先取更新时间更晚的那个数据
        const todayWeatherList = [mojiWeatherData?.liveWeather, todayWeatherData?.liveWeather, todayDetailWeatherData].sort((a, b) => (b.time || 0) - (a.time || 0));
        // 合并 mojiWeatherData?.liveWeather， todayWeatherData?.liveWeather， todayDetailWeatherData 数据，字段缺失的进行补全（取并集）
        // const todayWeather = { ...todayDetailWeatherData, ...mojiWeatherData?.liveWeather, ...todayWeatherData?.liveWeather };
        const todayWeather = { ...todayWeatherList[0], ...todayDetailWeatherData, ...mojiWeatherData?.liveWeather, ...todayWeatherData?.liveWeather };
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
            todayWeather:todayWeather, recentDaysWeather:recentDaysWeatherData, calendarWeather:calendarWeather,
        };
        console.log('天气数据提取完成');
        // 检查是否所有必要的API结果都有数据，只有在所有数据都有效时才缓存。如果没有提供mojiAreaCode，则跳过mojiWeatherData的检查
        const hasMoji = !mojiAreaCode || Object.keys(mojiWeatherData || {}).length;
        const hasToday = Object.keys(todayWeatherData || {}).length;
        const hasTodayLiveWeather = todayWeatherData?.liveWeather && Object.keys(todayWeatherData.liveWeather).length;
        const hasTodayHourlyWeather = todayWeatherData?.hourlyWeather && todayWeatherData.hourlyWeather?.length;
        const hasTodayLifeHelper = todayWeatherData?.lifeHelper && todayWeatherData.lifeHelper?.length;
        const hasDetail = Object.keys(todayDetailWeatherData || {}).length;
        const hasRecentDays = Object.keys(recentDaysWeatherData || {}).length;
        const hasCalendar = Object.keys(calendarAndHistoryWeatherData || {}).length;

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
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json(weatherData);
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