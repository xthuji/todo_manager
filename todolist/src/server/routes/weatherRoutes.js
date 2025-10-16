// 天气数据代理服务示例
// 由于浏览器的同源策略限制，前端无法直接获取不同域名的天气数据
// 此文件提供了一个Node.js + Express服务器端代理的路由模块实现

const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const router = express.Router();

// 全局缓存对象用于无缓存版本的错误处理
let globalWeatherCache = {
    data: null,
    timestamp: 0,
    expiry: 60 * 60 * 1000 // 缓存1小时
};

/**
 * 在实际环境中，你还需要：
 * 1. 添加错误处理和日志记录
 * 2. 添加请求频率限制以防止被中国天气网屏蔽
 * 3. 添加数据缓存机制以提高性能
 * 4. 配置HTTPS
 * 5. 限制访问来源为你的前端域名
 */

/**
 * 智能提取天气信息函数 - 支持不同的页面结构
 */
function extractWeatherData(htmlContent) {
    const $ = cheerio.load(htmlContent);
    
    // 检查是否存在.left-div（40天预报页面的特征）
    const leftDiv = $('.left-div');
    if (leftDiv.length > 0) {
        console.log('检测到40天预报页面结构，提取详细天气数据');
        
        // 查找实际包含天气数据的元素
        // 1. 检查是否存在包含日期和天气信息的结构
        const weatherSections = leftDiv.find('h2:has(span.nowday)');
        
        if (weatherSections.length > 0) {
            console.log(`找到${weatherSections.length}个日期区域，提取详细信息`);
            
            // 创建一个新容器来存放提取的数据
            const extractedData = $('<div class="weather-40d-container"></div>');
            
            // 提取40天的天气数据
            weatherSections.each((index, element) => {
                if (index < 40) { // 最多提取40天
                    const section = $(element).closest('div');
                    if (section.length) {
                        extractedData.append(section.clone());
                    }
                }
            });
            
            return extractedData.html();
        }
        
        // 备用方案：提取整个left-div内容
        return leftDiv.html();
    }
    
    // 检查是否存在#7d容器（7天预报页面的特征）
    const sevenDayContainer = $('#7d');
    if (sevenDayContainer.length > 0) {
        console.log('检测到7天预报页面结构，提取#7d容器内容');
        return sevenDayContainer.html();
    }
    
    // 检查是否存在.t.clearfix（7天预报页面的另一个特征）
    const tClearfix = $('.t.clearfix');
    if (tClearfix.length > 0) {
        console.log('检测到.t.clearfix容器，提取其内容');
        return tClearfix.parent().html(); // 返回父容器以包含完整结构
    }
    
    // 如果都没找到，返回完整HTML作为备用
    console.error('未能识别页面结构，返回完整HTML');
    return htmlContent;
}

// 天气数据代理接口 - 无缓存版本
router.get('/weather-proxy', async (req, res) => {
    try {
        console.log('接收到天气数据请求');
        
        // 获取前端传入的weatherCode参数，不设置默认值
        const weatherCode = req.query.weatherCode;
        if (!weatherCode) {
            return res.status(400).json({ error: '缺少weatherCode参数' });
        }
        console.log('请求的城市天气代码:', weatherCode);
        
        // 设置请求头，模拟浏览器请求
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
            'Referer': 'https://www.weather.com.cn/',
        };
        
        console.log('准备请求中国天气网数据');
        
        // 根据weatherCode参数请求对应的天气预报页面
        const response = await fetch(`https://www.weather.com.cn/weather40d/${weatherCode}.shtml`, {
            method: 'GET',
            headers: headers
        });
        
        console.log('中国天气网请求完成，状态码:', response.status);
        
        // 检查请求是否成功
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // 获取页面内容
        const htmlContent = await response.text();
        console.log('获取到页面内容，长度:', htmlContent.length);
        
        // 使用智能提取函数解析HTML并提取天气内容
        const weatherContainer = extractWeatherData(htmlContent);
        console.log('提取的天气信息内容长度:', weatherContainer ? weatherContainer.length : 0);
        
        // 返回提取的天气数据
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(weatherContainer);
        
    } catch (error) {
        console.error('获取天气数据失败:', error);
        res.status(500).json({
            error: '获取天气数据失败',
            details: error.message
        });
    }
});

// 天气数据代理接口 - 带缓存版本
// 为每个城市单独缓存数据
const cityWeatherCache = {};
const CACHE_EXPIRY = 60 * 60 * 1000; // 缓存1小时

router.get('/weather-proxy-cached', async (req, res) => {
    try {
        // 获取前端传入的weatherCode参数，不设置默认值
        const weatherCode = req.query.weatherCode;
        if (!weatherCode) {
            return res.status(400).json({ error: '缺少weatherCode参数' });
        }
        console.log('请求的城市天气代码:', weatherCode);
        
        const now = Date.now();
        
        // 检查该城市的缓存是否有效
        if (cityWeatherCache[weatherCode] && now - cityWeatherCache[weatherCode].timestamp < CACHE_EXPIRY) {
            console.log(`使用缓存的${weatherCode}天气数据`);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(cityWeatherCache[weatherCode].data);
            return;
        }
        
        // 缓存失效，重新获取数据
        console.log(`缓存失效，重新获取${weatherCode}天气数据`);
        
        // 设置请求头，模拟浏览器请求
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
            'Referer': 'https://www.weather.com.cn/',
        };
        
        // 根据weatherCode参数请求对应的天气预报页面
        const response = await fetch(`https://www.weather.com.cn/weather40d/${weatherCode}.shtml`, {
            method: 'GET',
            headers: headers
        });
        
        // 检查请求是否成功
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // 获取页面内容
        const htmlContent = await response.text();
        
        // 使用智能提取函数解析HTML并提取天气内容
        const weatherContainer = extractWeatherData(htmlContent);
        
        // 更新该城市的缓存
        cityWeatherCache[weatherCode] = {
            data: weatherContainer,
            timestamp: now
        };
        
        // 返回提取的天气数据
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(weatherContainer);
        
    } catch (error) {
        console.error('获取天气数据失败:', error);
        
        // 不使用过期缓存数据
        res.status(500).json({
            error: '获取天气数据失败',
            details: error.message
        });
    }
});

// 添加对weather.cma.cn的代理接口
router.get('/weather-cma-proxy', async (req, res) => {
    try {
        // 获取前端传入的参数，不设置默认值
        const weatherCode = req.query.weatherCode;
        if (!weatherCode) {
            return res.status(400).json({ error: '缺少weatherCode参数' });
        }
        
        console.log('接收到weather.cma.cn代理请求，天气代码:', weatherCode);
        
        // 设置请求头，模拟浏览器请求
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
            'Referer': 'https://weather.cma.cn/',
            'Content-Type': 'application/json',
        };
        
        // 构建请求URL
        const apiUrl = `https://weather.cma.cn/api/weather/view?stationid=${weatherCode}&_=${Date.now()}`;
        console.log('准备请求weather.cma.cn数据:', apiUrl);
        
        // 发送请求到weather.cma.cn
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: headers
        });
        
        // 检查请求是否成功
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // 解析JSON响应
        const weatherData = await response.json();
        console.log('获取到weather.cma.cn数据，状态:', weatherData.success);
        
        // 处理响应数据，直接使用接口返回的结果，不设置默认值
        const processedData = {
            success: weatherData.success,
            district: weatherData.district,
            temperature: weatherData.temperature || weatherData.data?.temperature,
            weather: weatherData.weather || weatherData.data?.weather,
            wind: weatherData.wind || weatherData.data?.wind,
            humidity: weatherData.humidity || weatherData.data?.humidity,
            airQuality: weatherData.airQuality || weatherData.data?.airQuality,
            originalData: weatherData // 保留原始数据供调试
        };
        
        const result = {
            success: true,
            data: processedData,
            timestamp: Date.now()
        };
        
        // 返回JSON数据
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json(result);
        
    } catch (error) {
        console.error('获取weather.cma.cn数据失败:', error);
        res.status(500).json({
            success: false,
            error: '获取天气数据失败',
            details: error.message
        });
    }
});

// 代理中国天气网省份列表API
router.get('/weather-china-list', async (req, res) => {
    try {
        console.log('接收到省份列表请求');
        
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
            'Referer': 'https://www.weather.com.cn/',
        };
        
        const response = await fetch('https://www.weather.com.cn/data/city3jdata/china.html', {
            method: 'GET',
            headers: headers
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.text();
        // 处理返回的格式，中国天气网返回的是var开头的JavaScript代码
        const jsonData = eval(`(${data.replace('var list=', '')})`);
        
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json(jsonData);
    } catch (error) {
        console.error('获取省份列表失败:', error);
        res.status(500).json({
            error: '获取省份列表失败',
            details: error.message
        });
    }
});

// 代理中国天气网城市列表API
router.get('/weather-city-list', async (req, res) => {
    try {
        const provinceId = req.query.provinceId;
        // 增强验证逻辑，确保provinceId是有效的非空字符串，不是'undefined'
        if (!provinceId || provinceId === 'undefined' || provinceId.trim() === '') {
            console.log('接收到无效的城市列表请求，provinceId无效或缺失');
            return res.status(400).json({ error: '缺少或无效的provinceId参数' });
        }
        
        console.log('接收到城市列表请求，省份ID:', provinceId);
        
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
            'Referer': 'https://www.weather.com.cn/',
        };
        
        const response = await fetch(`https://www.weather.com.cn/data/city3jdata/provshi/${provinceId}.html`, {
            method: 'GET',
            headers: headers
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.text();
        const jsonData = eval(`(${data.replace('var list=', '')})`);
        
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json(jsonData);
    } catch (error) {
        console.error('获取城市列表失败:', error);
        res.status(500).json({
            error: '获取城市列表失败',
            details: error.message
        });
    }
});

// 代理中国天气网区县列表API
router.get('/weather-district-list', async (req, res) => {
    try {
        const cityId = req.query.cityId;
        if (!cityId) {
            return res.status(400).json({ error: '缺少cityId参数' });
        }
        
        console.log('接收到区县列表请求，城市ID:', cityId);
        
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
            'Referer': 'https://www.weather.com.cn/',
        };
        
        const response = await fetch(`https://www.weather.com.cn/data/city3jdata/station/${cityId}.html`, {
            method: 'GET',
            headers: headers
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.text();
        const jsonData = eval(`(${data.replace('var list=', '')})`);
        
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json(jsonData);
    } catch (error) {
        console.error('获取区县列表失败:', error);
        res.status(500).json({
            error: '获取区县列表失败',
            details: error.message
        });
    }
});

// 代理IP-API位置信息
router.get('/weather-ip-location', async (req, res) => {
    try {
        console.log('接收到IP位置信息请求');
        
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
        };
        
        const response = await fetch('http://ip-api.com/json/?lang=zh-CN', {
            method: 'GET',
            headers: headers
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json(data);
    } catch (error) {
        console.error('获取IP位置信息失败:', error);
        res.status(500).json({
            error: '获取IP位置信息失败',
            details: error.message
        });
    }
});

// 导出路由模块
module.exports = router;