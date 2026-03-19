from flask import Blueprint, jsonify, request
import time
from app.utils.cache_util import CacheUtil
from app.utils.config_util import config_util
from app.utils.logger_util import logger

# 创建蓝图
bp = Blueprint('festival_routes', __name__)

# 初始化缓存工具
cache_util = CacheUtil()

# 缓存配置
CACHE_KEY = 'festival_config'

# 清除配置缓存
def clear_config_cache():
    try:
        cache_util.delete(CACHE_KEY)
        return True
    except Exception as error:
        logger.error(f'清除节日配置缓存失败: {error}')
        return False

# 获取节日配置接口
@bp.route('/config', methods=['GET'])
def get_festival_config():
    try:
        config = config_util.get_config('festival')
        
        if config:
            logger.info('获取节日配置成功')
            return jsonify({
                "data": config,
                "timestamp": time.time() * 1000,
                "error": None
            })

        logger.warning('节日配置文件不存在或无法读取')
        return jsonify({
            "data": None,
            "timestamp": time.time() * 1000,
            "error": {"message": "节日配置文件不存在或无法读取"}
        }), 404
    except Exception as error:
        logger.error(f'获取节日配置失败: {error}')
        return jsonify({
            "data": None,
            "timestamp": time.time() * 1000,
            "error": {"message": f"获取节日配置失败: {error}"}
        }), 500

# 保存节日配置接口
@bp.route('/save', methods=['POST'])
def save_festival_config():
    try:
        config_data = request.json

        # 验证配置数据的基本结构
        if not config_data or not isinstance(config_data, dict):
            return jsonify({"data": None, "timestamp": time.time() * 1000, "error": {"message": "配置数据格式无效"}}), 400

        # 确保必要的字段存在
        if not isinstance(config_data.get('festivals'), list):
            return jsonify({
                "data": None,
                "timestamp": time.time() * 1000,
                "error": {"message": "festivals字段必须是数组"}
            }), 400

        config_util.save_config('festival', config_data)
        clear_config_cache()

        logger.info('节日配置文件保存成功，缓存已清除')
        return jsonify({"data": {"success": True, "message": "节日配置保存成功"}, "timestamp": time.time() * 1000})
    except Exception as error:
        logger.error(f'保存节日配置失败: {error}')
        return jsonify({
            "data": None,
            "timestamp": time.time() * 1000,
            "error": {"message": f"保存节日配置失败: {error}"}
        }), 500
