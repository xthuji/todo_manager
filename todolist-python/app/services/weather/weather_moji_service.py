#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
墨迹天气服务模块

提供从墨迹天气网站获取天气数据的功能，与Node.js项目中的weatherMojiService.js功能对应。
"""

import requests
from bs4 import BeautifulSoup
from datetime import datetime


# 天气请求头
WEATHER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1"
}


def extract_moji_weather_data(html):
    """
    提取墨迹天气数据
    
    Args:
        html: 墨迹天气网站的HTML内容
    
    Returns:
        提取的天气数据
    """
    soup = BeautifulSoup(html, 'html.parser')
    weather_data = {
        "liveWeather": {},     # 实况天气
        "calendarWeather": []  # 天气日历
    }
    
    # 1. 提取今日实时天气
    temp_range = []
    forecast_days = soup.select('.forecast .days:nth-child(2) > li:nth-child(3)')
    if forecast_days:
        temp_range_text = forecast_days[0].text.replace('°', '').strip()
        temp_range = temp_range_text.split('/') if temp_range_text else []
    
    # 获取更新时间
    uptime_elem = soup.select('.wea_info .wea_weather .info_uptime')
    time = uptime_elem[0].text.replace('今天', '').replace('更新', '').strip() if uptime_elem else ''
    
    # 获取天气状况
    weather_elem = soup.select('.wea_weather > b')
    weather = weather_elem[0].text.strip() if weather_elem else ''
    
    # 获取实时温度
    temperature_elem = soup.select('.wea_info .wea_weather em')
    temperature = temperature_elem[0].text.replace('°', '').strip() if temperature_elem else ''
    
    # 获取风向风力
    wind_elem = soup.select('.wea_info .wea_about em')
    wind = wind_elem[0].text.strip() if wind_elem else ''
    
    # 获取湿度
    humidity_elem = soup.select('.wea_info .wea_about span')
    humidity = ''
    if humidity_elem:
        humidity = humidity_elem[0].text.replace('湿度：', '').replace('湿度', '').strip()
    
    # 获取空气质量
    air_quality_elem = soup.select('.wea_info .wea_alert em')
    air_quality = air_quality_elem[0].text.strip() if air_quality_elem else ''
    
    # 获取天气提示
    tips_elem = soup.select('.wea_info .wea_tips em')
    tips = tips_elem[0].text.strip() if tips_elem else ''
    
    weather_data['liveWeather'] = {
        "time": time,
        "weather": weather,
        "temperature": temperature,
        "tempMin": temp_range[0].strip() if len(temp_range) > 0 else '',
        "tempMax": temp_range[1].strip() if len(temp_range) > 1 else '',
        "wind": wind,
        "humidity": humidity,
        "airQuality": air_quality,
        "tips": tips
    }
    
    # 2. 提取天气日历
    calendar_els = soup.select('#calendar_grid > ul > li')
    year_month_str = datetime.now().strftime('%Y%m')
    
    for el in calendar_els:
        day_elem = el.find('em')
        if not day_elem or not day_elem.text.strip():
            continue
        
        temp_range_elem = el.select('p:nth-child(3)')
        temp_range = []
        if temp_range_elem:
            temp_range_text = temp_range_elem[0].text.replace('°', '').strip()
            temp_range = temp_range_text.split('/') if temp_range_text else []
        
        weather_elem = el.select('b img')
        weather = weather_elem[0].get('alt', '').strip() if weather_elem else ''
        
        wind_elem = el.select('p:nth-child(4)')
        wind = wind_elem[0].text.strip() if wind_elem else ''
        
        weather_data['calendarWeather'].append({
            "date": f"{year_month_str}{day_elem.text.strip().zfill(2)}",  # 20251002 格式
            "weather": weather,
            "tempMin": temp_range[0].strip() if len(temp_range) > 0 else '',
            "tempMax": temp_range[1].strip() if len(temp_range) > 1 else '',
            "wind": wind
        })
    
    return weather_data


def fetch_moji_weather(moji_area_code):
    """
    获取墨迹天气数据
    
    Args:
        moji_area_code: 墨迹天气区域编码
    
    Returns:
        天气数据或错误信息
    """
    if not moji_area_code:
        return None
    
    try:
        weather_url = f"https://tianqi.moji.com/weather/china/{moji_area_code}"
        print(f"开始获取墨迹天气数据，正在访问: {weather_url}")
        
        response = requests.get(weather_url, headers=WEATHER_HEADERS, timeout=5)
        
        if not response.status_code == 200:
            raise Exception(f"HTTP响应状态码: {response.status_code}")
        
        # 明确指定编码为utf-8，避免编码问题
        weather_html = response.content.decode('utf-8')
        moji_weather_data = extract_moji_weather_data(weather_html)
        print("成功提取墨迹天气数据")
        
        return moji_weather_data
    except Exception as e:
        print(f"获取墨迹天气数据失败: {e}")
        return {"error": str(e) or "获取墨迹天气数据失败"}
