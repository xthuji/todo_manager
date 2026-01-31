#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
中央气象台天气服务模块

提供从中央气象台API获取天气数据的功能，与Node.js项目中的weatherNmcService.js功能对应。
"""

import requests
import time
from app.utils.logger_util import logger


# 天气请求头
WEATHER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Connection": "keep-alive",
    "Referer": "https://www.nmc.cn/"
}


def extract_nmc_weather_data(nmc_data):
    """
    格式化NMC数据为统一格式
    
    Args:
        nmc_data: 中央气象台返回的原始数据
    
    Returns:
        格式化后的天气数据
    """
    if not (nmc_data and nmc_data.get('code') == 0 and nmc_data.get('data')):
        return {}
    
    weather_data = {
        "liveWeather": {},    # 实况天气
        "dailyWeather": [],   # 近几天预报
    }
    
    data = nmc_data.get('data')
    
    # 提取近几天预报
    if data.get('predict') and data.get('predict').get('detail') and isinstance(data.get('predict').get('detail'), list):
        weather_data['dailyWeather'] = [
            {
                "date": item.get('date', '').strip().replace('-', '') if item.get('date') else '',
                "weather": (item.get('day', {}).get('weather', {}).get('info', '')).replace('9999', ''),
                "tempMin": (item.get('night', {}).get('weather', {}).get('temperature', '')).replace('9999', ''),
                "tempMax": (item.get('day', {}).get('weather', {}).get('temperature', '')).replace('9999', ''),
                "wind": f"{item.get('day', {}).get('wind', {}).get('direct', '')} {item.get('day', {}).get('wind', {}).get('power', '')}".replace('9999', '').strip()
            }
            for item in data.get('predict').get('detail')
        ]
    
    # 提取实况天气
    real = data.get('real', {})
    publish_time = real.get('publish_time', '')
    time_str = publish_time.strip().split(' ')[1] if publish_time else ''
    
    weather = real.get('weather', {}).get('info', '')
    temperature = real.get('weather', {}).get('temperature', '')
    wind_direct = real.get('wind', {}).get('direct', '')
    wind_power = real.get('wind', {}).get('power', '')
    humidity = real.get('weather', {}).get('humidity', '')
    
    # 获取空气质量
    air_aqi = data.get('air', {}).get('aqi', '')
    air_text = data.get('air', {}).get('text', '')
    air_quality = f"{air_aqi} {air_text}" if air_text else f"{air_aqi}"
    
    # 获取日出日落时间
    sunrise = ''
    sunset = ''
    if real.get('sunriseSunset'):
        sunrise_time = real.get('sunriseSunset').get('sunrise', '')
        sunset_time = real.get('sunriseSunset').get('sunset', '')
        sunrise = sunrise_time.strip().split(' ')[1] if sunrise_time else ''
        sunset = sunset_time.strip().split(' ')[1] if sunset_time else ''
    
    # 获取最高最低温度
    temp_max = ''
    temp_min = ''
    if weather_data['dailyWeather']:
        temp_max = weather_data['dailyWeather'][0].get('tempMax', '')
        temp_min = weather_data['dailyWeather'][0].get('tempMin', '')
    
    weather_data['liveWeather'] = {
        "time": time_str,
        "weather": weather,
        "temperature": temperature,
        "tempMax": temp_max,
        "tempMin": temp_min,
        "wind": f"{wind_direct} {wind_power}",
        "humidity": humidity,
        "airQuality": air_quality,
        "sunrise": sunrise,
        "sunset": sunset
    }
    
    return weather_data


def fetch_nmc_weather(nmc_api_code):
    """
    获取中央气象台天气数据
    
    Args:
        nmc_api_code: 中央气象台API编码
    
    Returns:
        天气数据或错误信息
    """
    if not nmc_api_code:
        return {"error": {"message": "参数nmc_api_code为空，无法获取中央气象台天气数据"}}
    
    try:
        # 仅使用指定的URL接口，使用当前时间戳
        timestamp = int(time.time() * 1000)
        nmc_weather_url = f"https://www.nmc.cn/rest/weather?stationid={nmc_api_code}&_={timestamp}"
        logger.info(f"开始获取中央气象台天气数据，正在访问: {nmc_weather_url}")
        
        response = requests.get(nmc_weather_url, headers=WEATHER_HEADERS, timeout=5)
        
        if not response.status_code == 200:
            raise Exception(f"HTTP响应状态码: {response.status_code}")
        
        nmc_data = response.json()
        nmc_weather_data = extract_nmc_weather_data(nmc_data)
        logger.info("成功提取中央气象台天气数据")
        
        return nmc_weather_data
    except Exception as e:
        logger.error(f"获取中央气象台天气数据失败: {e}")
        return {"error": {"message": str(e) or "获取中央气象台天气数据失败"}}
