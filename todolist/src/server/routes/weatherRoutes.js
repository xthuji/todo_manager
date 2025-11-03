// 天气数据代理服务示例
// 由于浏览器的同源策略限制，前端无法直接获取不同域名的天气数据
// 此文件提供了一个Node.js + Express服务器端代理的路由模块实现

const express = require('express');

const {getLocation, getAllAreaCodes, getDistrictAreaCodes} = require('../service/locationAreaService.js');
const {getWeatherData} = require("../service/weatherService");

const router = express.Router();

// 获取客户端IP地址
function getClientIp(req) {
    // 优先从X-Forwarded-For头获取（考虑代理），其次使用req.ip
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
           req.ip || 
           'unknown_ip';
}


// 根据IP地址获取位置信息 - 综合多个API获取准确的城市地区信息
// http://ip-api.com/json/?lang=zh-CN
// https://apimobile.meituan.com/locate/v2/ip/loc?rgeo=true&ip=${ipAddress}
// https://weather.cma.cn/api/weather/view
router.get('/ip-location', async (req, res) => {
    try {
        // 获取客户端IP地址
        const clientIp = getClientIp(req);
        console.log('接收到IP位置信息请求，客户端IP:', clientIp);
        let addressData = await getLocation(clientIp);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.status(200).json(addressData);
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
        let areaCodesData = getAllAreaCodes();
        return res.status(200).json(areaCodesData);
    } catch (error) {
        console.error('获取天气区域编码数据时发生错误:', error);
        res.status(500).json({
            success: false,
            message: '获取数据失败',
            error: error.message
        });
    }
});

// 获取天气数据
router.get('/weather-info', async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    console.log('收到今日天气请求，查询参数:', req.query);
    const weatherCode = req.query.weatherCode;
    // const mojiAreaCode = req.query.mojiAreaCode;
    // const nmcAreaCode = req.query.nmcAreaCode;
    // const cmaAreaCode = req.query.cmaAreaCode;

    let districtAreaCode = getDistrictAreaCodes(weatherCode);
    const mojiAreaCode = districtAreaCode.mojiCode;
    const nmcAreaCode = districtAreaCode.nmcCode;
    const cmaAreaCode = districtAreaCode.cmaCode;

    // 验证必要参数
    if (!weatherCode) {
        return res.status(400).json({ error: '缺少weatherCode参数' });
    }

    try {
        let weatherData = await getWeatherData({weatherCode, mojiAreaCode, nmcAreaCode, cmaAreaCode});
        return res.status(200).json(weatherData);
    } catch (error) {
        console.error('获取天气数据失败:', error);
        return res.status(500).json({
            error: '获取天气数据失败',
            message: error.message,
            mojiAreaCode: mojiAreaCode,
            weatherCode: weatherCode
        });
    }
});

// 导出路由
module.exports = router;