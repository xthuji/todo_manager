#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
天气服务模块

提供天气数据获取功能，与Node.js项目中的weatherService.js功能对应。
"""

import os
import json
import time
from app.utils.cache_util import cache_util
from app.utils.config_util import config_util
from app.utils.constants import USE_MOCK, USE_CACHE, MOCK_DIR, DATA_DIR, PRINT_API_DATA, PRINT_DATA_LOG
from app.services.weather.weather_moji_service import fetch_moji_weather
from app.services.weather.weather_tianqi_service import fetch_today_weather, fetch_recent_days_weather, fetch_today_detail_weather, fetch_calendar_and_history_weather
from app.services.weather.weather_nmc_service import fetch_nmc_weather
from app.services.weather.weather_cma_service import fetch_cma_weather
from app.utils.logger_util import logger

# 缓存配置
WEATHER_OPTIONS = {
    "allowExpired": True,  # 允许使用过期缓存作为兜底
    "ttl": 3600000  # 1小时缓存
}

# 全局变量
mock_weather_data = None


def cache_weather_info(area_code_info=None, weather_data=None):
    """
    天气信息缓存处理函数
    
    Args:
        area_code_info: 天气代码参数
        weather_data: 要缓存的天气数据，如果为null则执行读取操作
    
    Returns:
        读取模式下返回缓存的天气数据，写入模式下返回None
    """
    if not USE_CACHE:
        return None
    
    if not area_code_info:
        return None
    
    # 构建缓存键
    cache_key = f"{area_code_info.get('weatherCode')}_{area_code_info.get('mojiAreaCode', 'default')}".replace('/', '_')
    full_cache_key = f"weather_{cache_key}"
    
    if weather_data is not None:
        logger.info(f"缓存天气信息: {cache_key}")
        try:
            cache_util.set_data(full_cache_key, weather_data, WEATHER_OPTIONS)
        except Exception as e:
            logger.error(f"缓存天气数据失败: {e}")
        return None
    else:
        try:
            return cache_util.get_wrapped_data(full_cache_key, WEATHER_OPTIONS)
        except Exception as e:
            logger.error(f"获取缓存天气数据失败: {e}")
            return None


def build_weather_data(moji_weather_data, today_weather_data, today_detail_weather_data, cma_weather_data, nmc_weather_data, recent_days_weather_data, calendar_and_history_weather_data, weather_area_code_params):
    """
    构建天气数据
    
    Args:
        moji_weather_data: 墨迹天气数据
        today_weather_data: 今日天气数据
        today_detail_weather_data: 今日天气补充数据
        cma_weather_data: 中国气象局天气数据
        nmc_weather_data: 中央气象台天气数据
        recent_days_weather_data: 近几日天气数据
        calendar_and_history_weather_data: 日历和历史天气数据
        weather_area_code_params: 天气区域代码参数
    
    Returns:
        构建的天气数据
    """
    # 今日天气信息。优先取更新时间更晚的那个数据
    # 与Node.js完全一致的实现
    # 直接构建列表，与Node.js的实现方式一致
    today_weather_list = [
        moji_weather_data.get('liveWeather') if moji_weather_data else None,
        today_weather_data.get('liveWeather') if today_weather_data else None,
        today_detail_weather_data,
        cma_weather_data,
        nmc_weather_data.get('liveWeather') if nmc_weather_data else None
    ]
    # 过滤掉无效数据，与Node.js的实现方式一致
    today_weather_list = [item for item in today_weather_list if item and item.get('time')]
    # 按时间排序，取更新时间最晚的，与Node.js的实现方式一致
    def get_time_value(item):
        time_val = item.get('time', 0)
        if time_val:
            try:
                # 尝试直接转换为整数
                return int(time_val)
            except (ValueError, TypeError):
                # 如果转换失败，返回0
                return 0
        return 0
    
    today_weather_list.sort(key=lambda x: get_time_value(x), reverse=True)
    
    # 合并数据，与Node.js项目保持完全一致的合并顺序
    # 注意：Node.js使用对象扩展语法，Python使用update()方法，两者行为一致（后面的覆盖前面的）
    today_weather = {}
    # 首先合并todayWeatherList[0]，作为基础数据
    if today_weather_list:
        today_weather.update(today_weather_list[0])
    # 然后按照Node.js的顺序：todayDetailWeatherData -> mojiWeatherData?.liveWeather -> todayWeatherData?.liveWeather -> cmaWeatherData -> nmcWeatherData?.liveWeather
    if today_detail_weather_data:
        today_weather.update(today_detail_weather_data)
    if moji_weather_data and moji_weather_data.get('liveWeather'):
        today_weather.update(moji_weather_data.get('liveWeather'))
    if today_weather_data and today_weather_data.get('liveWeather'):
        today_weather.update(today_weather_data.get('liveWeather'))
    if cma_weather_data:
        today_weather.update(cma_weather_data)
    if nmc_weather_data and nmc_weather_data.get('liveWeather'):
        today_weather.update(nmc_weather_data.get('liveWeather'))
    
    # 遍历todayWeather的各个字段。如果相同字段都有值时，根据数据源的时间字段，取时间更晚的那个数据源的值
    # 与Node.js完全一致的实现
    for key in today_weather:
        # 如果字段在todayWeatherList中都有值，且时间更晚的数据源的值不为空，则取该值
        # 注意：Node.js中使用的是 !== undefined && !== ''，Python中对应 is not None and != ''
        list_with_key = [item for item in today_weather_list if item.get(key) is not None and item.get(key) != '']
        if list_with_key and today_weather_list[0].get(key) is not None and today_weather_list[0].get(key) != '':
            today_weather[key] = today_weather_list[0][key]
    
    # 近几日天气
    recent_days_weather = recent_days_weather_data if recent_days_weather_data else (nmc_weather_data.get('dailyWeather', []) if nmc_weather_data else [])
    
    # 添加逐小时预报和生活助手
    today_weather['hourlyWeather'] = today_weather_data.get('hourlyWeather', []) if today_weather_data else []
    today_weather['lifeHelper'] = today_weather_data.get('lifeHelper', []) if today_weather_data else []
    
    # 日历天气
    calendar_weather = calendar_and_history_weather_data if calendar_and_history_weather_data else []
    
    # 合并墨迹天气日历数据
    if moji_weather_data and moji_weather_data.get('calendarWeather'):
        if not calendar_weather:
            calendar_weather = moji_weather_data.get('calendarWeather')
        else:
            # 构建墨迹天气日历数据的映射
            moji_weather_map = {}
            for item in moji_weather_data.get('calendarWeather'):
                moji_weather_map[item.get('date')] = item
            
            # 获取今天的日期字符串
            today_str = time.strftime('%Y%m%d')
            
            # 补全历史数据
            for item in calendar_weather:
                if item.get('date') < today_str:
                    moji_item = moji_weather_map.get(item.get('date'))
                    if moji_item and moji_item.get('weather'):
                        item['weather'] = moji_item.get('weather')
                        item['tempMin'] = moji_item.get('tempMin')
                        item['tempMax'] = moji_item.get('tempMax')
                        item['wind'] = moji_item.get('wind')

    # 构建完整的天气数据
    weather_data = {
        **weather_area_code_params,
        "todayWeather": today_weather,
        "recentDaysWeather": recent_days_weather,
        "calendarWeather": calendar_weather
    }
    
    if PRINT_DATA_LOG:
        logger.debug(f'墨迹天气数据: {json.dumps(moji_weather_data)}')
        logger.debug(f'今日天气数据: {json.dumps(today_weather_data)}')
        logger.debug(f'今日天气补充数据: {json.dumps(today_detail_weather_data)}')
        logger.debug(f'近几日天气数据: {json.dumps(recent_days_weather_data)}')
        logger.debug(f'天气历史数据: {json.dumps(calendar_and_history_weather_data)}')
        logger.debug(f'CMA(中国气象局)天气数据: {json.dumps(cma_weather_data)}')
        logger.debug(f'NMC(中央气象台)天气数据: {json.dumps(nmc_weather_data)}')
    
    if PRINT_API_DATA:
        weather_data['apiData'] = {
            'mojiWeatherData': moji_weather_data,
            'todayWeatherData': today_weather_data,
            'todayDetailWeatherData': today_detail_weather_data,
            'cmaWeatherData': cma_weather_data,
            'nmcWeatherData': nmc_weather_data,
            'recentDaysWeatherData': recent_days_weather_data,
            'calendarAndHistoryWeatherData': calendar_and_history_weather_data
        }
    
    # 检查是否所有必要的API结果都有数据，只有在所有数据都有效时才缓存
    # 与Node.js完全一致的实现
    has_moji = not weather_area_code_params.get('mojiAreaCode') or (moji_weather_data and len(moji_weather_data) > 0)
    has_today = today_weather_data and len(today_weather_data) > 0
    has_today_live_weather = today_weather_data and today_weather_data.get('liveWeather') and len(today_weather_data.get('liveWeather')) > 0
    has_today_hourly_weather = today_weather_data and today_weather_data.get('hourlyWeather') and len(today_weather_data.get('hourlyWeather')) > 0
    has_today_life_helper = today_weather_data and today_weather_data.get('lifeHelper') and len(today_weather_data.get('lifeHelper')) > 0
    has_detail = today_detail_weather_data and len(today_detail_weather_data) > 0
    has_recent_days = recent_days_weather_data and len(recent_days_weather_data) > 0
    has_calendar = calendar_and_history_weather_data and len(calendar_and_history_weather_data) > 0
    
    # 只有在所有数据都有效时才缓存
    if has_moji and has_today and has_today_live_weather and has_today_hourly_weather and has_today_life_helper and has_detail and has_recent_days and has_calendar:
        logger.info('所有API结果数据完整，缓存天气数据')
        cache_weather_info(weather_area_code_params, weather_data)
    
    logger.info("天气数据提取完成")
    
    return weather_data


async def query_weather_data(weather_area_code_params):
    """
    查询天气数据
    
    Args:
        weather_area_code_params: 天气区域代码参数
    
    Returns:
        天气数据
    """
    # 检查是否强制刷新
    force_refresh = weather_area_code_params.get('forceRefresh', False)
    
    # 尝试从缓存获取数据，但如果是强制刷新则跳过缓存
    if not force_refresh:
        cached_weather_data = cache_weather_info(weather_area_code_params)
        if cached_weather_data:
            logger.info("使用缓存的天气数据")
            return cached_weather_data
    else:
        logger.info("强制刷新，跳过缓存")
    
    # 定义要执行的函数
    async def fetch_moji():
        if weather_area_code_params.get('mojiAreaCode'):
            return fetch_moji_weather(weather_area_code_params.get('mojiAreaCode'))
        return {}
    
    async def fetch_today():
        return fetch_today_weather(weather_area_code_params.get('weatherCode'))
    
    async def fetch_today_detail():
        return fetch_today_detail_weather(weather_area_code_params.get('weatherCode'))
    
    async def fetch_recent_days():
        return fetch_recent_days_weather(weather_area_code_params.get('weatherCode'))
    
    async def fetch_calendar_and_history():
        return fetch_calendar_and_history_weather(weather_area_code_params.get('weatherCode'))
    
    async def fetch_cma():
        if weather_area_code_params.get('cmaAreaCode'):
            return fetch_cma_weather(weather_area_code_params.get('cmaAreaCode'))
        return {}
    
    async def fetch_nmc():
        if weather_area_code_params.get('nmcApiCode'):
            return fetch_nmc_weather(weather_area_code_params.get('nmcApiCode'))
        return {}
    
    # 并行执行所有请求
    import asyncio
    try:
        moji_weather_data, today_weather_data, today_detail_weather_data, recent_days_weather_data, calendar_and_history_weather_data, cma_weather_data, nmc_weather_data = await asyncio.gather(
            fetch_moji(),
            fetch_today(),
            fetch_today_detail(),
            fetch_recent_days(),
            fetch_calendar_and_history(),
            fetch_cma(),
            fetch_nmc()
        )
    except Exception as e:
        logger.error(f"获取天气数据失败: {e}")
        return {"error": {"message": str(e) or "获取天气数据失败"}}
    
    # 检查各数据源的错误信息并记录
    errors = []
    if nmc_weather_data and isinstance(nmc_weather_data, dict) and 'error' in nmc_weather_data:
        errors.append(f"NMC: {nmc_weather_data['error']}")
    if cma_weather_data and isinstance(cma_weather_data, dict) and 'error' in cma_weather_data:
        errors.append(f"CMA: {cma_weather_data['error']}")
    if today_weather_data and isinstance(today_weather_data, dict) and 'error' in today_weather_data:
        errors.append(f"Tianqi: {today_weather_data['error']}")
    if moji_weather_data and isinstance(moji_weather_data, dict) and 'error' in moji_weather_data:
        errors.append(f"Moji: {moji_weather_data['error']}")
    if recent_days_weather_data and isinstance(recent_days_weather_data, dict) and 'error' in recent_days_weather_data:
        errors.append(f"RecentDays: {recent_days_weather_data['error']}")
    if calendar_and_history_weather_data and isinstance(calendar_and_history_weather_data, dict) and 'error' in calendar_and_history_weather_data:
        errors.append(f"Calendar: {calendar_and_history_weather_data['error']}")
    if today_detail_weather_data and isinstance(today_detail_weather_data, dict) and 'error' in today_detail_weather_data:
        errors.append(f"TodayDetail: {today_detail_weather_data['error']}")
    
    if errors:
        logger.warning(f"部分天气服务出错，但尝试继续处理数据: {errors}")
    
    # 构建天气数据
    weather_data = build_weather_data(
        moji_weather_data, 
        today_weather_data, 
        today_detail_weather_data, 
        cma_weather_data, 
        nmc_weather_data, 
        recent_days_weather_data, 
        calendar_and_history_weather_data, 
        weather_area_code_params
    )
    
    return {"data": weather_data, "timestamp": int(time.time() * 1000)}


async def get_weather_data(weather_area_code_params):
    """
    获取天气数据
    
    Args:
        weather_area_code_params: 天气区域代码参数
    
    Returns:
        天气数据
    """
    if not weather_area_code_params:
        return {"error": {"message": "参数weather_area_code_params不能为空"}}
    
    logger.info(f'USE_MOCK: {USE_MOCK}')
    # 如果启用了mock数据，直接使用mock数据，与Node.js项目完全一致
    if USE_MOCK:
        mock_file_path = os.path.join(MOCK_DIR, 'mock_weather_info.json')
        try:
            mock_data = cache_util.get_wrapped_data('mock_weather_info', {
                'source_file': mock_file_path,
                'permanent': True,
                'ttl': 0,
            })
            if mock_data:
                logger.info('使用mock天气数据')
                return mock_data
        except Exception as e:
            logger.error(f'读取mock天气数据失败: {e}')
    
    logger.info(f"天气请求参数: {weather_area_code_params}")
    
    try:
        # 直接返回与Node.js项目相同的数据结构
        weather_data = await query_weather_data(weather_area_code_params)
        return weather_data
    except Exception as e:
        logger.error(f"获取天气数据失败: {e}")
        return {"error": {"message": str(e) or "获取天气数据失败"}}
