from flask import Blueprint, jsonify, request
import os
import time
import requests
from app.utils.cache_util import CacheUtil
from app.utils.config_util import config_util
from app.utils.logger_util import logger

bp = Blueprint('holiday_routes', __name__)
cache_util = CacheUtil()
CACHE_DIR = config_util.get_cache_dir()

DEFAULT_HOLIDAY_API_URL = 'https://www.shuyz.com/githubfiles/china-holiday-calender/master/holidayAPI.json'
CACHE_KEY = 'holiday_cache'
TTL = 100 * 24 * 3600 * 1000  # 100天

HOLIDAY_OPTIONS = {
    "allow_expired": True,
    "sourceFile": os.path.join(CACHE_DIR, 'holiday_cache.json'),
    "ttl": TTL,
}

def _fetch_holiday_data(api_url=DEFAULT_HOLIDAY_API_URL):
    """从API获取节假日数据"""
    logger.info(f"[节假日服务] 从API获取数据: {api_url}")
    response = requests.get(api_url, timeout=10, headers={'Content-Type': 'application/json'})
    response.raise_for_status()
    
    data = response.json()
    if not data or not isinstance(data, dict):
        raise Exception('获取到的节假日数据格式错误')
    
    years = data.get('Years', {})
    if not years:
        years = {k: v for k, v in data.items() if k.isdigit()}
    
    logger.info(f"[节假日服务] 成功获取数据，包含{len(years)}个年份")
    return data

def _get_holiday_data(api_url=DEFAULT_HOLIDAY_API_URL):
    """获取节假日数据（带缓存）"""
    def load_data_fn():
        logger.info('[节假日服务] 缓存未命中或需要更新，从API获取数据')
        return _fetch_holiday_data(api_url)
    
    wrapped_data = cache_util.get_wrapped_data(CACHE_KEY, {
        "allow_expired": True,
        "sourceFile": os.path.join(CACHE_DIR, 'holiday_cache.json'),
        "ttl": TTL,
        "load_data_fn": load_data_fn
    })
    
    if not wrapped_data:
        raise Exception('无法获取节假日数据')
    
    if wrapped_data.get('expired'):
        logger.warning('[节假日服务] 使用过期缓存数据')
    
    return {
        "data": wrapped_data.get('data'),
        "timestamp": wrapped_data.get('timestamp'),
        "apiUrl": api_url,
        "expireAt": wrapped_data.get('timestamp') + TTL if not wrapped_data.get('expired') else time.time() * 1000
    }

@bp.route('/cache', methods=['GET'])
def manage_holiday_cache():
    try:
        return jsonify(_get_holiday_data())
    except Exception as e:
        logger.error(f"[节假日服务] 获取数据失败: {e}")
        return jsonify({
            "data": None,
            "timestamp": time.time() * 1000,
            "error": {"message": "获取节假日数据失败", "details": str(e)}
        }), 500

@bp.route('/refresh-cache', methods=['POST'])
def refresh_holiday_cache():
    try:
        api_url = (request.json.get('apiUrl') or '').strip() if request.json else ''
        final_api_url = api_url or DEFAULT_HOLIDAY_API_URL
        
        cache_util.delete(CACHE_KEY)
        logger.info('[节假日服务] 缓存已清除')
        
        cache_data = _get_holiday_data(final_api_url)
        return jsonify({
            **cache_data,
            "success": True,
            "message": "节假日缓存刷新成功",
        })
    except Exception as e:
        logger.error(f"[节假日服务] 刷新缓存失败: {e}")
        return jsonify({
            "success": False,
            "message": "刷新节假日缓存失败",
            "error": str(e)
        }), 500