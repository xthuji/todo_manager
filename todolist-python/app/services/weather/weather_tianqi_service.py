#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
天气网天气服务模块

提供从天气网获取天气数据的功能，与Node.js项目中的weatherTianqiService.js功能对应。
"""

import requests
import re
import json
import time
from bs4 import BeautifulSoup
from datetime import datetime, timedelta


# 天气请求头
WEATHER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1"
}


# 40天天气预报中的天气代码映射
calendar_weather_map = {
    0: "晴", 1: "多云", 2: "阴", 3: "阵雨", 4: "雷阵雨", 5: "雷阵雨伴有冰雹",
    6: "雨夹雪", 7: "小雨", 8: "中雨", 9: "大雨", "00": "晴", "01": "多云",
    "02": "阴", "03": "阵雨", "04": "雷阵雨", "05": "雷阵雨伴有冰雹",
    "06": "雨夹雪", "07": "小雨", "08": "中雨", "09": "大雨",
    10: "暴雨", 11: "大暴雨", 12: "特大暴雨", 13: "阵雪", 14: "小雪",
    15: "中雪", 16: "大雪", 17: "暴雪", 18: "雾", 19: "冻雨",
    20: "沙尘暴", 21: "小到中雨", 22: "中到大雨", 23: "大到暴雨",
    24: "暴雨到大暴雨", 25: "大暴雨到特大暴雨", 26: "小到中雪",
    27: "中到大雪", 28: "大到暴雪", 29: "浮尘", 30: "扬沙",
    31: "强沙尘暴", 53: "霾", 99: "无", 32: "浓雾", 49: "强浓雾",
    54: "中度霾", 55: "重度霾", 56: "严重霾", 57: "大雾", 58: "特强浓雾",
    301: "雨", 302: "雪"
}


def get_calendar_weather_by_code(code1, code2):
    """
    根据天气代码获取天气状况
    
    Args:
        code1: 第一个天气代码
        code2: 第二个天气代码
    
    Returns:
        天气状况描述
    """
    if not code1 and not code2:
        return ''
    
    weather1 = ''
    if code1:
        try:
            weather1 = calendar_weather_map.get(int(code1), '')
        except (ValueError, TypeError):
            pass
    
    weather2 = ''
    if code2:
        try:
            weather2 = calendar_weather_map.get(int(code2), '')
        except (ValueError, TypeError):
            pass
    
    if weather1 and weather2:
        return f"{weather1}转{weather2}"
    
    return weather1 or weather2 or ''


def extract_today_weather_data(html):
    """
    提取今日天气数据
    
    Args:
        html: 天气网页面的HTML内容
    
    Returns:
        提取的天气数据
    """
    weather_data = {
        "liveWeather": {},    # 实况天气
        "hourlyWeather": [],  # 逐小时预报
        "lifeHelper": []      # 生活助手
    }
    
    # 从js脚本中获取实时天气和逐小时预报
    soup = BeautifulSoup(html, 'html.parser')
    script_elem = soup.select('.L_weather > script:nth-child(3)')
    
    if script_elem:
        script_content = script_elem[0].string if script_elem[0].string else ''
        if script_content:
            # 使用正则表达式提取对象定义
            match_forecast_1h = re.search(r'var forecast_1h\s?=\s?(\[.*?\]);', script_content, re.DOTALL)
            match_forecast_default = re.search(r'var forecast_default\s?=\s?(\{.*?\});', script_content, re.DOTALL)
            
            if match_forecast_default:
                try:
                    forecast_default = json.loads(match_forecast_default.group(1))
                    weather_data['liveWeather'] = {
                        "time": forecast_default.get('time', ''),
                        "weather": forecast_default.get('weather', ''),
                        "temperature": forecast_default.get('temp', ''),
                        "tempMin": forecast_default.get('minTemp', ''),
                        "tempMax": forecast_default.get('maxTemp', ''),
                        "wind": forecast_default.get('wind', ''),
                        "humidity": forecast_default.get('humidity', '')
                    }
                except Exception as e:
                    print(f"解析forecast_default失败: {e}")
            
            if match_forecast_1h:
                try:
                    forecast_1h = json.loads(match_forecast_1h.group(1))
                    weather_data['hourlyWeather'] = [
                        {
                            "hour": item.get('time', ''),
                            "weather": item.get('weather', ''),
                            "temperature": item.get('temp', ''),
                            "wind": f"{item.get('windD', '')} {item.get('windL', '')}"
                        }
                        for item in forecast_1h
                    ]
                except Exception as e:
                    print(f"解析forecast_1h失败: {e}")
    
    # 从页面中获取生活助手数据
    life_title_elem = soup.select('div.weather_shzs_1d > ul > li')
    life_value_elem = soup.select('div.weather_shzs_1d > div.lv > dl')
    
    for i, title_elem in enumerate(life_title_elem):
        if i < len(life_value_elem):
            value_elem = life_value_elem[i]
            weather_data['lifeHelper'].append({
                "title": title_elem.find('h2').text.strip() if title_elem.find('h2') else '',
                "value": value_elem.find('em').text.strip() if value_elem.find('em') else '',
                "desc": value_elem.find('dd').text.strip() if value_elem.find('dd') else ''
            })
    
    return weather_data


def fetch_today_weather(weather_code):
    """
    获取今日天气数据
    
    Args:
        weather_code: 天气代码
    
    Returns:
        今日天气数据
    """
    if not weather_code:
        return {"error": {"message": "参数weather_code为空，无法获取今日天气数据"}}
    
    try:
        today_weather_url = f"https://forecast.weather.com.cn/town/weather1dn/{weather_code}.shtml"
        print(f"开始获取今日天气数据，正在访问: {today_weather_url}")
        
        response = requests.get(today_weather_url, headers=WEATHER_HEADERS, timeout=5)
        
        if not response.status_code == 200:
            raise Exception(f"HTTP响应状态码: {response.status_code}")
        
        weather_content = response.content.decode('utf-8')
        weather_data = extract_today_weather_data(weather_content)
        print("成功提取今日天气数据")
        
        return weather_data
    except Exception as e:
        print(f"获取今日天气数据失败: {e}")
        return {"error": {"message": str(e) or "获取天气数据失败"}}


def extract_today_detail_weather_data(html):
    """
    提取今日天气补充数据
    
    Args:
        html: 天气网页面的HTML内容
    
    Returns:
        提取的天气数据
    """
    weather_data = {}
    
    # 使用正则表达式提取对象定义
    match_content = re.search(r'var dataSK\s?=\s?(\{.*?\});?', html, re.DOTALL)
    
    if match_content:
        try:
            detail_weather = json.loads(match_content.group(1))
            weather_data = {
                "time": detail_weather.get('time', ''),
                "weather": detail_weather.get('weather', ''),
                "temperature": detail_weather.get('temp', ''),
                "wind": f"{detail_weather.get('WD', '')} {detail_weather.get('WS', '')}",
                "humidity": detail_weather.get('sd', ''),
                "airQuality": detail_weather.get('aqi_pm25', ''),
                "visibility": detail_weather.get('njd', ''),
                "limit": detail_weather.get('limitnumber', '')
            }
        except Exception as e:
            print(f"解析今日天气补充数据失败: {e}")
    
    return weather_data


def fetch_today_detail_weather(weather_code):
    """
    获取今日天气补充数据
    
    Args:
        weather_code: 天气代码
    
    Returns:
        今日天气补充数据
    """
    if not weather_code:
        return {"error": {"message": "参数weather_code为空，无法获取今日天气补充数据"}}
    
    try:
        timestamp = int(time.time() * 1000)
        today_weather_url = f"https://d1.weather.com.cn/sk_2d/{weather_code}.html?_={timestamp}"
        print(f"开始获取今日天气补充数据，正在访问: {today_weather_url}")
        
        headers = WEATHER_HEADERS.copy()
        headers['Referer'] = 'https://www.weather.com.cn/'
        
        response = requests.get(today_weather_url, headers=headers, timeout=5)
        
        if not response.status_code == 200:
            raise Exception(f"HTTP响应状态码: {response.status_code}")
        
        weather_content = response.content.decode('utf-8')
        weather_data = extract_today_detail_weather_data(weather_content)
        print("成功提取今日天气补充数据")
        
        return weather_data
    except Exception as e:
        print(f"获取今日天气补充数据失败: {e}")
        return {"error": {"message": str(e) or "获取天气数据失败"}}


def extract_recent_days_weather_data(html):
    """
    提取近几日天气数据
    
    Args:
        html: 天气网页面的HTML内容
    
    Returns:
        提取的天气数据
    """
    weather_data = []
    
    soup = BeautifulSoup(html, 'html.parser')
    
    # 定位到7天预报的ul列表
    # 使用不同的选择器来避免以数字开头的ID问题
    forecast_items = soup.select('div[id="7d"] ul li')
    
    today = datetime.now()
    
    for i, item in enumerate(forecast_items):
        # 计算日期
        date = today + timedelta(days=i)
        year = date.year
        month = str(date.month).zfill(2)
        day = str(date.day).zfill(2)
        date_str = f"{year}{month}{day}"
        
        # 获取页面中的日期
        page_date_elem = item.find('h1')
        if page_date_elem:
            # 使用正则表达式移除非数字字符
            page_date_str = re.sub(r'\D', '', page_date_elem.text.strip())
        else:
            page_date_str = ''
        
        # 将计算得到的 day 与页面中 li 元素里的日期数值比对，仅保留匹配项
        day_str = str(date.day).zfill(2)
        if not page_date_str or (page_date_str != day_str and day_str != page_date_str.zfill(2)):
            continue
        
        # 提取天气描述
        weather_elem = item.select('.wea')
        weather = weather_elem[0].text.strip() if weather_elem else ''
        
        # 提取温度范围
        temp_max_elem = item.select('.tem span')
        temp_max = temp_max_elem[0].text.strip().replace('℃', '') if temp_max_elem else ''
        
        temp_min_elem = item.select('.tem i')
        temp_min = temp_min_elem[0].text.strip().replace('℃', '') if temp_min_elem else ''
        
        # 提取风向风力
        wind_dir_elem = item.select('.win em span:first-child')
        wind_dir = wind_dir_elem[0].get('title', '').strip() if wind_dir_elem else ''
        
        wind_speed_elem = item.select('.win i')
        wind_speed = wind_speed_elem[0].text.strip() if wind_speed_elem else ''
        
        wind = f"{wind_dir} {wind_speed}"
        
        weather_data.append({
            "date": date_str,
            "weather": weather,
            "tempMin": temp_min,
            "tempMax": temp_max,
            "wind": wind
        })
    
    return weather_data


def fetch_recent_days_weather(weather_code):
    """
    获取近几日天气数据
    
    Args:
        weather_code: 天气代码
    
    Returns:
        近几日天气数据
    """
    if not weather_code:
        return {"error": {"message": "参数weather_code为空，无法获取近几日天气数据"}}
    
    try:
        days_weather_url = f"https://www.weather.com.cn/weather/{weather_code}.shtml"
        print(f"开始获取近几日天气数据，正在访问: {days_weather_url}")
        
        response = requests.get(days_weather_url, headers=WEATHER_HEADERS, timeout=5)
        
        if not response.status_code == 200:
            raise Exception(f"HTTP响应状态码: {response.status_code}")
        
        # 明确指定编码为utf-8，避免编码问题
        weather_content = response.content.decode('utf-8')
        weather_data = extract_recent_days_weather_data(weather_content)
        print("成功提取近几日天气数据")
        
        return weather_data
    except Exception as e:
        print(f"获取近几日天气数据失败: {e}")
        return {"error": {"message": str(e) or "获取近几日天气数据失败"}}


def extract_calendar_and_history_weather_data(html):
    """
    提取日历和历史天气数据
    
    Args:
        html: 天气网页面的HTML内容
    
    Returns:
        提取的天气数据
    """
    weather_data = []
    
    # 使用正则表达式提取对象定义
    match_history = re.search(r'var fc40\s?=\s?(\[.*?\]);?', html, re.DOTALL)
    
    if match_history:
        try:
            fc40 = json.loads(match_history.group(1))
            
            # 获取当前年月
            current_date = datetime.now()
            current_year = current_date.year
            curr_month_str = f"{current_year}{str(current_date.month).zfill(2)}"
            next_month = current_date.month + 1
            next_year = current_year
            if next_month > 12:
                next_month = 1
                next_year += 1
            next_month_str = f"{next_year}{str(next_month).zfill(2)}"
            
            # 过滤出本月的天气数据
            for item in fc40:
                date = item.get('date', '')
                if date > curr_month_str and date < next_month_str:
                    weather_data.append({
                        "date": date,
                        "weather": item.get('w1', '') or get_calendar_weather_by_code(item.get('c1'), item.get('c2')),
                        "wind": item.get('wd1', ''),
                        "historyTempMin": item.get('hmin', ''),
                        "historyTempMax": item.get('hmax', ''),
                        "realTempMin": item.get('minobs', ''),
                        "realTempMax": item.get('maxobs', ''),
                        "tempMin": item.get('min', ''),
                        "tempMax": item.get('max', '')
                    })
        except Exception as e:
            print(f"解析日历和历史天气数据失败: {e}")
    
    return weather_data


def fetch_calendar_and_history_weather(weather_code):
    """
    获取日历和历史天气数据
    
    Args:
        weather_code: 天气代码
    
    Returns:
        日历和历史天气数据
    """
    if not weather_code:
        return {"error": {"message": "参数weather_code为空，无法获取日历和历史天气数据"}}
    
    try:
        # 获取当前年月
        year = datetime.now().year
        year_month = f"{year}{str(datetime.now().month).zfill(2)}"
        
        timestamp = int(time.time() * 1000)
        history_weather_url = f"https://d1.weather.com.cn/calendarFromMon/{year}/{weather_code}_{year_month}.html?_={timestamp}"
        print(f"开始获取天气历史数据，正在访问: {history_weather_url}")
        
        headers = WEATHER_HEADERS.copy()
        headers['Referer'] = 'https://www.weather.com.cn/'
        
        response = requests.get(history_weather_url, headers=headers, timeout=5)
        
        if not response.status_code == 200:
            raise Exception(f"HTTP响应状态码: {response.status_code}")
        
        weather_content = response.content.decode('utf-8')
        weather_data = extract_calendar_and_history_weather_data(weather_content)
        print("成功提取天气历史数据")
        
        return weather_data
    except Exception as e:
        print(f"获取天气历史数据失败: {e}")
        return {"error": {"message": str(e) or "获取天气历史数据失败"}}
