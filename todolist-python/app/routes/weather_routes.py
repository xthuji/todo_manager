from flask import Blueprint, jsonify, request, Response
import os
import json
import time
from app.utils.cache_util import CacheUtil
from app.utils.config_util import config_util
from app.services.location_service import get_location, get_curr_location, get_all_area_codes, get_district_area_codes
from app.services.weather_service import get_weather_data

# 创建蓝图
bp = Blueprint('weather_routes', __name__)

# 初始化缓存工具
cache_util = CacheUtil()

# 数据目录配置
DATA_DIR = config_util.get_data_dir()
WEATHER_DIR = config_util.get_weather_dir()

# 缓存配置
WEATHER_OPTIONS = {
    "allow_expired": True,  # 允许使用过期缓存作为兜底
    "ttl": 3600000  # 1小时缓存
}


# 获取客户端IP地址
def get_client_ip(req):
    """
    获取客户端IP地址
    
    Args:
        req: Flask请求对象
    
    Returns:
        IP地址
    """
    # 优先从X-Forwarded-For头获取（考虑代理），其次使用req.remote_addr
    return req.headers.get('X-Forwarded-For', '').split(',')[0].strip() or req.remote_addr or 'unknown_ip'


# 获取IP位置信息接口
@bp.route('/ip-location', methods=['GET'])
def get_ip_location():
    try:
        # 获取客户端IP地址
        client_ip = get_client_ip(request)
        # 获取forceRefresh参数
        force_refresh = request.args.get('forceRefresh') == 'true'
        print(f'接收到IP位置信息请求，客户端IP: {client_ip}，是否强制刷新: {force_refresh}')
        
        # 获取位置信息
        location_result = get_location(client_ip, force_refresh)
        
        # 直接返回与Node.js项目相同的数据结构
        return jsonify(location_result)
    except Exception as e:
        return jsonify({"success": False, "message": "获取位置信息失败", "error": str(e)}), 500


# 获取天气区域编码接口
@bp.route('/weather-area-codes', methods=['GET'])
def get_weather_area_codes():
    try:
        # 调用get_all_area_codes函数获取缓存的天气区域编码数据
        area_codes_data = get_all_area_codes()
        if area_codes_data:
            print('使用缓存的天气区域编码数据')
            return jsonify(area_codes_data)
        
        # 如果获取失败，返回默认的空数据结构
        print('地区编码数据文件不存在或无法读取')
        return jsonify({
            "data": [],
            "timestamp": int(time.time() * 1000),
            "expired": True,
            "permanent": True
        })
    except Exception as e:
        print(f'get_weather_area_codes: error = {e}')
        return jsonify({"success": False, "message": "获取数据失败", "error": str(e)}), 500


# 获取天气区域编码映射
area_codes_map = None

# 获取District对应的各种天气区域编码数据
def get_district_area_codes(area_code):
    global area_codes_map
    if not area_codes_map:
        area_codes_map = {}
        # 读取merged_weather_area_codes.json文件
        merged_file = os.path.join(DATA_DIR, "weather", "merged_weather_area_codes.json")
        if os.path.exists(merged_file):
            try:
                with open(merged_file, "r", encoding="utf8") as f:
                    data = json.load(f)
                    # 递归遍历所有地区数据
                    def traverse_areas(areas):
                        if not isinstance(areas, list):
                            return
                        for item in areas:
                            if "children" in item and isinstance(item["children"], list):
                                # 省份或城市节点
                                province_moji_code = item.get("mojiCode")
                                province_nmc_code = item.get("nmcCode")
                                # 处理子节点
                                for child in item["children"]:
                                    if "children" in child and isinstance(child["children"], list):
                                        # 城市节点，处理区县节点
                                        for leaf in child["children"]:
                                            if "code" in leaf:
                                                # 构建mojiAreaCode，格式为：省份/mojiCode
                                                moji_area_code = None
                                                if province_moji_code and leaf.get("mojiCode"):
                                                    moji_area_code = f"{province_moji_code}/{leaf.get('mojiCode')}"
                                                elif leaf.get("mojiCode"):
                                                    moji_area_code = leaf.get("mojiCode")
                                                
                                                # 构建nmcAreaCode，格式与Node.js项目一致
                                                nmc_area_code = None
                                                if province_nmc_code and leaf.get("nmcNameCode"):
                                                    nmc_area_code = f"{province_nmc_code}/{leaf.get('nmcNameCode')}"
                                                
                                                area_codes_map[leaf["code"]] = {
                                                    "mojiAreaCode": moji_area_code,
                                                    "nmcApiCode": leaf.get("nmcCode"),
                                                    "nmcAreaCode": nmc_area_code,
                                                    "cmaAreaCode": leaf.get("cmaCode"),
                                                    "areaName": leaf.get("name")
                                                }
                                    elif "code" in child:
                                        # 直接添加子节点到映射
                                        area_codes_map[child["code"]] = {
                                            "mojiAreaCode": child.get("mojiCode"),
                                            "nmcApiCode": child.get("nmcCode"),
                                            "nmcAreaCode": child.get("nmcCode"),
                                            "cmaAreaCode": child.get("cmaCode"),
                                            "areaName": child.get("name")
                                        }
                            elif "code" in item:
                                # 直接添加叶子节点到映射
                                area_codes_map[item["code"]] = {
                                    "mojiAreaCode": item.get("mojiCode"),
                                    "nmcApiCode": item.get("nmcCode"),
                                    "nmcAreaCode": item.get("nmcCode"),
                                    "cmaAreaCode": item.get("cmaCode"),
                                    "areaName": item.get("name")
                                }
                    # 开始遍历
                    if isinstance(data, dict) and "data" in data:
                        traverse_areas(data["data"])
                    else:
                        traverse_areas(data)
            except Exception as e:
                print(f'读取地区编码数据失败: {e}')
    
    return area_codes_map.get(area_code, {})

# 获取天气数据接口
@bp.route('/weather-info', methods=['GET'])
async def get_weather_info():
    try:
        # 获取查询参数
        weather_code = request.args.get('weatherCode')
        
        print(f'收到今日天气请求，查询参数: {request.args}')
        
        # 验证必要参数
        if not weather_code:
            return jsonify({"error": "缺少weatherCode参数"}), 400
        
        # 获取额外的区域代码
        district_area_code = get_district_area_codes(weather_code)
        
        # 构建天气参数
        weather_params = {"weatherCode": weather_code, **district_area_code}
        
        # 获取天气数据
        weather_data = await get_weather_data(weather_params)
        
        # 直接返回与Node.js项目相同的数据结构
        return jsonify(weather_data)
    except Exception as e:
        return jsonify({"error": "获取天气数据失败", "message": str(e)}), 500

