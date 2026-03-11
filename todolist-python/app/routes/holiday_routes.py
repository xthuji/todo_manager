from flask import Blueprint, jsonify, request
import os
import time
from app.utils.cache_util import CacheUtil
from app.utils.config_util import config_util

# 创建蓝图
bp = Blueprint('holiday_routes', __name__)

# 初始化缓存工具
cache_util = CacheUtil()

# 数据目录配置
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
        raise e

# 清除节假日缓存
def clear_holiday_cache():
    try:
        cache_util.delete(CACHE_KEY)
        print('[节假日服务] 缓存已清除')
        return True
    except Exception as error:
        print(f'[节假日服务] 缓存清除失败或缓存不存在: {error}')
        return False

# 获取节假日数据
def get_holiday_data(api_url=DEFAULT_HOLIDAY_API_URL):
    try:
        # 使用get_wrapped_data获取缓存，并提供load_data_fn选项用于缓存未命中时的数据加载
        def load_data_fn():
            print('[节假日服务] 缓存未命中或需要更新，从API获取数据')
            return fetch_holiday_data(api_url)
        
        wrapped_data = cache_util.get_wrapped_data(CACHE_KEY, {
            "allow_expired": True,  # 允许使用过期缓存作为兜底
            "sourceFile": os.path.join(CACHE_DIR, 'holiday_cache.json'),
            "ttl": TTL,
            "load_data_fn": load_data_fn
        })
        
        # 处理缓存结果
        if not wrapped_data:
            # 如果没有获取到缓存数据，抛出错误
            raise Exception('无法获取节假日数据')

        holiday_data = wrapped_data.get('data')
        # 检查是否使用了过期缓存
        if wrapped_data.get('expired'):
            print('[节假日服务] 使用过期缓存数据')

        # 返回标准格式的响应
        return {
            "data": holiday_data,
            "timestamp": wrapped_data.get('timestamp'),
            "apiUrl": api_url,
            "expireAt": not wrapped_data.get('expired') and (wrapped_data.get('timestamp') + TTL) or time.time() * 1000
        }
    except Exception as e:
        print(f"[节假日服务] 获取数据失败: {e}")
        raise e

# 管理节假日缓存接口
@bp.route('/cache', methods=['GET'])
def manage_holiday_cache():
    try:
        # 获取节假日数据（内部已处理缓存和兜底逻辑）
        holiday_data = get_holiday_data()
        
        # 返回标准格式的数据
        return jsonify(holiday_data)
    except Exception as e:
        # 最后的兜底方案
        return jsonify({
            "data": None,
            "timestamp": time.time() * 1000,
            "error": {
                "message": "获取节假日数据失败",
                "details": str(e)
            }
        }), 500

# 刷新节假日缓存接口
@bp.route('/refresh-cache', methods=['POST'])
def refresh_holiday_cache():
    try:
        # 获取请求参数
        api_url = request.json.get('apiUrl') if request.json else None
        final_api_url = api_url and api_url.strip() or DEFAULT_HOLIDAY_API_URL
        
        # 清除现有缓存
        clear_holiday_cache()
        
        # 从API获取并保存新数据
        cache_data = get_holiday_data(final_api_url)
        
        # 返回成功响应
        return jsonify({
            **cache_data,
            "success": True,
            "message": "节假日缓存刷新成功",
        })
    except Exception as e:
        print(f"[节假日服务] 刷新缓存失败: {e}")
        
        return jsonify({
            "success": False,
            "message": "刷新节假日缓存失败",
            "error": str(e)
        }), 500