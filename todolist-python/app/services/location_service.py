#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
位置服务模块

提供IP地址到地理位置的转换功能，与Node.js项目中的locationAreaService.js功能对应。
"""

import os
import json
import time
import re
import requests
import asyncio
from app.utils.cache_util import cache_util
from app.utils.config_util import config_util
from app.utils.constants import USE_MOCK, USE_CACHE, MOCK_DIR, DATA_DIR, PRINT_API_DATA, PRINT_DATA_LOG

# 数据目录配置
WEATHER_DIR = config_util.get_weather_dir()

# 缓存配置
LOCATION_OPTIONS = {
    "allowExpired": True,  # 允许使用过期缓存作为兜底
    "ttl": 3600000  # 1小时缓存
}

# 全局变量
area_codes_map = None

default_location_info = {
    'province': '浙江',
    'city': '杭州',
    'district': '杭州',
    'code': '101210101'
}

def find_district_info(area_data, province_name, district_name):
    """
    递归查找区县信息，确定完整的省市县信息
    
    Args:
        area_data: 地区数据
        province_name: 省份名称
        district_name: 区县名称
    
    Returns:
        区县信息
    """
    result = None
    
    # 递归搜索函数
    def search_recursive(data, current_province, current_city, province_item):
        nonlocal result
        if not data or not isinstance(data, list):
            return
        
        for item in data:
            # 检查是否为叶子节点（区县）
            if item.get('code') and item.get('name') == district_name and current_province == province_name:
                result = {
                    'code': item.get('code'),
                    'province': current_province,
                    'city': current_city,
                    'district': item.get('name')
                }
                return
            
            # 如果有children，继续递归搜索
            if item.get('children') and isinstance(item.get('children'), list):
                if current_province is None:
                    # 第一级：省份
                    search_recursive(item.get('children'), item.get('name'), None, item)
                elif current_city is None:
                    # 第二级：城市
                    search_recursive(item.get('children'), current_province, item.get('name'), province_item)
                else:
                    # 第三级：区县
                    search_recursive(item.get('children'), current_province, current_city, province_item)
            
            if result:
                break
    
    search_recursive(area_data, None, None, None)
    return result


def get_location1():
    """
    从气象局天气接口获取位置信息
    
    Returns:
        位置信息
    """
    try:
        cma_url = 'https://weather.cma.cn/api/weather/view'
        print(f'开始调用气象局天气接口获取位置信息，正在访问: {cma_url}')
        
        response = requests.get(cma_url, timeout=10)
        
        if response.status_code != 200:
            raise Exception(f'气象局天气接口响应状态码: {response.status_code}')
        
        weather_location_data = response.json()
        print('成功获取气象局天气接口数据')
        
        # 位置数据 - 使用正则表达式替换，确保与Node.js一致
        district_name = weather_location_data.get('data', {}).get('location', {}).get('name', '')
        if district_name:
            # 使用正则表达式移除末尾的"区"或"县"
            district_name = re.sub(r'[区县]$', '', district_name)
        
        # 安全获取省份信息
        province = '未知省份'
        path = weather_location_data.get('data', {}).get('location', {}).get('path', '')
        if path:
            path_parts = path.split(',')
            if len(path_parts) > 1:
                province = path_parts[1].replace('省', '').strip()
        
        return {
            'province': province,
            'city': '未知城市',
            'district': district_name if district_name else '未知区县'
        }
    except Exception as e:
        print(f'气象局天气接口获取和处理位置信息时发生错误: {e}')
        return None


def get_location2():
    """
    从ip-api和美团API获取位置信息
    
    Returns:
        位置信息
    """
    try:
        # 1. 调用ip-api获取基础位置信息
        ip_api_url = 'http://ip-api.com/json/?lang=zh-CN'
        print(f'开始调用ip-api获取位置信息，正在访问: {ip_api_url}')
        
        ip_api_response = requests.get(ip_api_url, timeout=5)
        
        if ip_api_response.status_code != 200:
            raise Exception(f'ip-api响应状态码: {ip_api_response.status_code}')
        
        ip_location_data = ip_api_response.json()
        print('成功获取ip-api位置数据')
        
        # 2. 使用从ip-api获取的IP地址调用美团API获取省市区县信息
        weather_location_data = None
        if ip_location_data and ip_location_data.get('query'):
            ip_address = ip_location_data.get('query')
            # 从ip-api获取的IP地址，传递给美团API
            meituan_url = f'https://apimobile.meituan.com/locate/v2/ip/loc?rgeo=true&ip={ip_address}'
            print(f'开始根据IP调用美团API获取位置信息，正在访问: {meituan_url}')
            
            meituan_response = requests.get(meituan_url, timeout=5, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json'
            })
            
            if meituan_response.status_code != 200:
                raise Exception(f'美团地理位置服务响应状态码: {meituan_response.status_code}')
            
            weather_location_data = meituan_response.json()
            print('成功获取美团地理位置服务数据')
        
        # 3. 综合两个API的数据，只返回省市区县信息
        # 使用正则表达式替换，确保与Node.js一致
        district_name = None
        if weather_location_data and weather_location_data.get('data') and weather_location_data.get('data').get('rgeo') and weather_location_data.get('data').get('rgeo').get('district'):
            district_name = weather_location_data.get('data').get('rgeo').get('district')
            # 使用正则表达式移除末尾的"区"或"县"
            district_name = re.sub(r'[区县]$', '', district_name)
        
        return {
            'province': weather_location_data.get('data').get('rgeo').get('province').replace('省', '') if (weather_location_data and weather_location_data.get('data') and weather_location_data.get('data').get('rgeo') and weather_location_data.get('data').get('rgeo').get('province')) else '未知省份',
            'city': weather_location_data.get('data').get('rgeo').get('city').replace('市', '') if (weather_location_data and weather_location_data.get('data') and weather_location_data.get('data').get('rgeo') and weather_location_data.get('data').get('rgeo').get('city')) else '未知城市',
            'district': district_name if district_name else '未知区县'
        }
    except Exception as e:
        print(f'ip-api&美团位置接口获取和处理位置信息时发生错误: {e}')
        return None


def get_curr_location(force_refresh):
    """
    根据IP地址获取位置信息 - 综合多个API获取准确的城市地区信息
    
    Args:
        force_refresh: 是否强制刷新
    
    Returns:
        位置信息
    """
    print('正在调用接口获取位置信息...')
    
    # 尝试从多个API获取位置信息
    import concurrent.futures
    
    # 并行请求多个位置API
    address_data1 = None
    address_data2 = None
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        # 提交任务
        future1 = executor.submit(get_location1)
        future2 = executor.submit(get_location2)
        
        # 获取结果
        try:
            address_data1 = future1.result(timeout=10)
        except Exception as e:
            print(f'获取位置信息1失败: {e}')
        
        try:
            address_data2 = future2.result(timeout=10)
        except Exception as e:
            print(f'获取位置信息2失败: {e}')
    
    # 根据force_refresh参数决定使用哪个API的数据
    if force_refresh:
        # 强制刷新时，优先使用第一个API的数据
        address_data = address_data1 if address_data1 else address_data2
    else:
        # 否则优先使用第二个API的数据，与Node.js版本保持一致
        address_data = address_data2 if address_data2 else address_data1
    
    if PRINT_DATA_LOG:
        print(f'接口获取位置信息结果1: {json.dumps(address_data1)}')
        print(f'接口获取位置信息结果2: {json.dumps(address_data2)}')
    
    # 如果所有API都失败，使用默认数据
    if not address_data:
        print('所有位置API都失败，使用默认数据')
        address_data = default_location_info
    else:
        if PRINT_DATA_LOG:
            print(f'使用真实API获取的位置数据: {json.dumps(address_data)}')
    
    # 读取地区编码数据，用于查找完整的省市县信息
    all_area_codes = get_all_area_codes()
    if all_area_codes and isinstance(all_area_codes, dict) and 'data' in all_area_codes and address_data.get('province') != '未知省份' and address_data.get('district') != '未知区县':
        # 使用辅助函数查找完整的省市县信息
        district_info = find_district_info(all_area_codes.get('data'), address_data.get('province'), address_data.get('district'))
        if district_info:
            address_data['province'] = district_info.get('province') or address_data.get('province')
            address_data['city'] = district_info.get('city') or address_data.get('city')
            address_data['district'] = district_info.get('district') or address_data.get('district')
            address_data['code'] = district_info.get('code')
    
    if PRINT_DATA_LOG:
        print(f'返回完整的位置数据: {json.dumps(address_data)}')
    return address_data


def get_location(client_ip, force_refresh=False):
    """
    根据IP地址获取位置信息
    
    Args:
        client_ip: IP地址
        force_refresh: 是否强制刷新
    
    Returns:
        位置信息
    """
    try:
        print(f'USE_MOCK: {USE_MOCK}')
        if USE_MOCK:
            # 使用mock数据，确保与Node.js项目一致
            print('使用mock位置数据，确保与Node.js项目一致')
            mock_file_path = os.path.join(MOCK_DIR, 'mock_ip_area.json')
            mock_data = cache_util.get_wrapped_data('mock_ip_area', {
                'source_file': mock_file_path,
                'permanent': True,
                'ttl': 0,
            })
            if mock_data:
                print(f'mock位置数据: {mock_data}')
                return mock_data
            
            # 如果mock数据获取失败，使用默认位置数据
            print('mock位置数据获取失败，使用默认位置数据')
            return {
                "data": default_location_info,
                "timestamp": int(time.time() * 1000),
                "expired": False,
                "permanent": False
            }
        
        # 如果强制刷新，则直接获取新数据，不使用缓存
        if force_refresh:
            print('强制刷新位置信息，跳过缓存')
            new_data = get_curr_location(force_refresh)
            # 更新缓存，但仍使用forceRefresh参数标记此次请求
            cache_util.set_data(f'ip_{client_ip}', new_data, {'ttl': 3600000})
            # 不能直接返回 new_data ，需要返回包装之后的缓存对象
            return cache_util.get_wrapped_data(f'ip_{client_ip}', {
                'allowExpired': True,
                'ttl': 3600000,
                'loadDataFn': lambda: new_data
            })
        
        # 使用缓存工具获取位置信息，与Node.js项目一致
        return cache_util.get_wrapped_data(f'ip_{client_ip}', {
            'allowExpired': True,
            'ttl': 3600000,
            'loadDataFn': lambda: get_curr_location(force_refresh)
        })
    except Exception as e:
        print(f'获取位置信息失败: {e}')
        return {
            'data': None,
            'timestamp': int(time.time() * 1000)
        }


def get_all_area_codes():
    """
    获取所有省市县编码数据
    
    Returns:
        包含data和timestamp的响应对象
    """
    try:
        # 尝试从合并后的文件获取
        merged_file = os.path.join(WEATHER_DIR, 'merged_weather_area_codes.json')
        result = cache_util.get_wrapped_data('merged_weather_area_codes', {
            'source_file': merged_file,
            'permanent': True,
            'ttl': 0,
        })
        if result:
            return result
        # 如果文件不存在或读取失败
        print('地区编码数据文件不存在或无法读取')
        return {
            'data': [],
            'timestamp': int(time.time() * 1000),
            'expired': True,
            'permanent': True
        }
    except Exception as e:
        print(f'获取省市县编码数据失败: {e}')
        return {
            'data': [],
            'timestamp': int(time.time() * 1000),
            'expired': True,
            'permanent': True
        }

def get_district_area_codes(area_code):
    """
    获取区县对应的各种天气区域编码数据
    
    Args:
        area_code: 地区编码
    
    Returns:
        区县对应的各种天气区域编码数据
    """
    global area_codes_map
    if not area_codes_map:
        area_codes_map = {}
        # 遍历 allAreaCodes 数据，查找叶子节点的数据，将数据中的code作为Map的key，将数据对象作为Map的value
        all_area_codes = get_all_area_codes()
        if all_area_codes and isinstance(all_area_codes, dict) and 'data' in all_area_codes:
            for item in all_area_codes.get('data'):
                if item.get('children') and isinstance(item.get('children'), list):
                    # 递归处理子节点
                    for child in item.get('children'):
                        if child.get('children') and isinstance(child.get('children'), list):
                            # 递归处理子节点的子节点
                            for leaf in child.get('children'):
                                area_codes_map[leaf.get('code')] = {
                                    'mojiAreaCode': f"{item.get('mojiCode')}/{leaf.get('mojiCode')}" if leaf.get('mojiCode') else None,
                                    'nmcApiCode': leaf.get('nmcCode'),
                                    'nmcAreaCode': f"{item.get('nmcCode')}/{leaf.get('nmcNameCode')}" if leaf.get('nmcNameCode') else None,
                                    'cmaAreaCode': leaf.get('cmaCode'),
                                    'areaName': leaf.get('name')
                                }
                        else:
                            # 直接添加子节点到Map
                            area_codes_map[child.get('code')] = {
                                'mojiAreaCode': child.get('mojiCode'),
                                'nmcAreaCode': child.get('nmcCode'),
                                'cmaAreaCode': child.get('cmaCode'),
                                'areaName': child.get('name')
                            }
                else:
                    # 直接添加叶子节点到Map
                    area_codes_map[item.get('code')] = {
                        'mojiAreaCode': item.get('mojiCode'),
                        'nmcAreaCode': item.get('nmcCode'),
                        'cmaAreaCode': item.get('cmaCode'),
                        'areaName': item.get('name')
                    }
    return area_codes_map.get(area_code)
