#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
中国气象局天气服务模块

提供从中国气象局API获取天气数据的功能，与Node.js项目中的weatherCmaService.js功能对应。
"""

import requests


# 天气请求头
WEATHER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Connection": "keep-alive"
}


def extract_cma_weather_data(cma_data):
    """
    格式化CMA数据为统一格式
    
    Args:
        cma_data: 中国气象局返回的原始数据
    
    Returns:
        格式化后的天气数据
    """
    if not (cma_data and cma_data.get('code') == 0 and cma_data.get('data')):
        return {}
    
    data = cma_data.get('data')
    now = data.get('now', {})
    
    return {
        "time": data.get('lastUpdate', '').strip().split(' ')[1] if data.get('lastUpdate') else '',  # 从lastUpdate获取时间，只保留HH:MM格式
        "temperature": now.get('temperature', ''),
        "wind": f"{now.get('windDirection', '')} {now.get('windScale', '')}",  # 风向风力
        "humidity": now.get('humidity', '')  # 湿度
    }


def fetch_cma_weather(cma_area_code):
    """
    获取中国气象局天气数据
    
    Args:
        cma_area_code: 中国气象局区域编码
    
    Returns:
        天气数据或错误信息
    """
    if not cma_area_code:
        return {"error": {"message": "参数cma_area_code为空，无法获取中国气象局天气数据"}}
    
    try:
        # 仅使用指定的URL接口
        cma_weather_url = f"https://weather.cma.cn/api/now/{cma_area_code}"
        print(f"开始获取中国气象局天气数据，正在访问: {cma_weather_url}")
        
        response = requests.get(cma_weather_url, headers=WEATHER_HEADERS, timeout=5)
        
        if not response.status_code == 200:
            raise Exception(f"HTTP响应状态码: {response.status_code}")
        
        cma_data = response.json()
        cma_weather_data = extract_cma_weather_data(cma_data)
        print("成功提取中国气象局天气数据")
        
        return cma_weather_data
    except Exception as e:
        print(f"获取中国气象局天气数据失败: {e}")
        return {"error": {"message": str(e) or "获取中国气象局天气数据失败"}}
