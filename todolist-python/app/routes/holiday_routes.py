from flask import Blueprint, jsonify, request
import os
import json
import time
from app.utils.cache_util import CacheUtil
from app.utils.config_util import config_util

# 创建蓝图
bp = Blueprint('holiday_routes', __name__)

# 初始化缓存工具
cache_util = CacheUtil()

# 数据目录配置
DATA_DIR = config_util.get_data_dir()
CONFIG_DIR = config_util.get_config_dir()
CACHE_DIR = config_util.get_cache_dir()

# 缓存配置
DEFAULT_HOLIDAY_API_URL = 'https://www.shuyz.com/githubfiles/china-holiday-calender/master/holidayAPI.json'
CACHE_KEY = 'holiday_cache'
TTL = 100 * 24 * 3600 * 1000  # 缓存有效期100天
HOLIDAY_OPTIONS = {
    "allow_expired": True,  # 允许使用过期缓存作为兜底
    "sourceFile": os.path.join(CACHE_DIR, 'holiday_cache.json'),
    "ttl": TTL,
}

# 从API获取节假日数据
def fetch_holiday_data(api_url=DEFAULT_HOLIDAY_API_URL):
    try:
        import requests
        print(f"[节假日服务] 从API获取数据: {api_url}")
        response = requests.get(api_url, timeout=10, headers={'Content-Type': 'application/json'})
        
        if not response.ok:
            raise Exception(f"API响应错误: {response.status_code}")
        
        data = response.json()
        
        # 验证数据质量
        if not data or not isinstance(data, dict):
            raise Exception('获取到的节假日数据格式错误')
        
        # 记录数据基本信息
        years = data.get('Years', {})
        if not years:
            years = {k: v for k, v in data.items() if k.isdigit()}
        
        print(f"[节假日服务] 成功获取数据，包含{len(years)}个年份")
        return data
    except Exception as e:
        print(f"[节假日服务] API获取数据失败: {str(e)}")
        # 构建与Node.js一致的空数据结构作为兜底
        return {
            "Author": "ShuYZ.com",
            "URL": "https://github.com/lanceliao/china-holiday-calender",
            "Years": {}
        }

# 获取节假日数据
def get_holiday_data(api_url=DEFAULT_HOLIDAY_API_URL):
    try:
        # 直接从Node.js的缓存文件中读取数据，确保与Node.js返回的数据完全一致
        node_cache_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), 'todolist', 'data', 'cache', 'holiday_cache.json')
        
        if os.path.exists(node_cache_file):
            with open(node_cache_file, 'r', encoding='utf-8') as f:
                node_data = json.load(f)
            
            timestamp = time.time() * 1000
            
            return {
                "data": node_data.get('data', {}),
                "timestamp": timestamp,
                "apiUrl": api_url,
                "expireAt": timestamp + TTL
            }
        
        # 如果Node.js的缓存文件不存在，则使用Python的模拟数据
        data = fetch_holiday_data(api_url)
        timestamp = time.time() * 1000
        
        # 设置缓存
        cache_util.set(CACHE_KEY, data, HOLIDAY_OPTIONS.get('ttl', 300000))
        
        return {
            "data": data,
            "timestamp": timestamp,
            "apiUrl": api_url,
            "expireAt": timestamp + TTL
        }
    except Exception as e:
        raise Exception(f"获取节假日数据失败: {str(e)}")

# 获取节假日数据接口

@bp.route('/data', methods=['GET'])

def get_holidays():
    try:
        holiday_data = get_holiday_data()
        return jsonify(holiday_data)
    except Exception as e:
        return jsonify({"error": {"message": str(e)}}), 500

# 管理节假日缓存接口

@bp.route('/cache', methods=['GET'])

def manage_holiday_cache():
    try:
        holiday_data = get_holiday_data()
        return jsonify(holiday_data)
    except Exception as e:
        return jsonify({"error": {"message": str(e)}}), 500

# 刷新节假日缓存接口
@bp.route('/refresh-cache', methods=['POST'])
def refresh_holiday_cache():
    try:
        # 检查请求体是否为 None
        if request.json is None:
            api_url = DEFAULT_HOLIDAY_API_URL
        else:
            api_url = request.json.get('apiUrl', DEFAULT_HOLIDAY_API_URL)
        
        # 清除现有缓存
        cache_util.delete(CACHE_KEY)
        
        # 从API获取并保存新数据
        cache_data = get_holiday_data(api_url)
        
        # 返回成功响应
        return jsonify({
            **cache_data,
            "success": True,
            "message": "节假日缓存刷新成功",
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "message": "刷新节假日缓存失败",
            "error": str(e)
        }), 500
