from flask import Blueprint, jsonify, request
import time
from app.utils.cache_util import CacheUtil
from app.utils.config_util import config_util
from app.utils.logger_util import logger

bp = Blueprint('festival_routes', __name__)
cache_util = CacheUtil()
CACHE_KEY = 'festival_config'

def _make_response(data, error=None, status=200):
    """构建统一格式的响应"""
    return jsonify({
        "data": data,
        "timestamp": time.time() * 1000,
        "error": error
    }), status

@bp.route('/config', methods=['GET'])
def get_festival_config():
    try:
        config = config_util.get_config('festival')
        if config:
            logger.info('获取节日配置成功')
            return _make_response(config)
        
        logger.warning('节日配置文件不存在或无法读取')
        return _make_response(
            None, 
            {"message": "节日配置文件不存在或无法读取"}, 
            404
        )
    except Exception as error:
        logger.error(f'获取节日配置失败: {error}')
        return _make_response(None, {"message": f"获取节日配置失败: {error}"}, 500)

@bp.route('/save', methods=['POST'])
def save_festival_config():
    try:
        config_data = request.json
        if not config_data or not isinstance(config_data, dict):
            return _make_response(None, {"message": "配置数据格式无效"}, 400)
        
        if not isinstance(config_data.get('festivals'), list):
            return _make_response(None, {"message": "festivals字段必须是数组"}, 400)
        
        config_util.save_config('festival', config_data)
        cache_util.delete(CACHE_KEY)
        
        logger.info('节日配置文件保存成功，缓存已清除')
        return _make_response({"success": True, "message": "节日配置保存成功"})
    except Exception as error:
        logger.error(f'保存节日配置失败: {error}')
        return _make_response(None, {"message": f"保存节日配置失败: {error}"}, 500)
