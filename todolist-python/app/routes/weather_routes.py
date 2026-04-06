from flask import Blueprint, jsonify, request
import time
from app.services.location_service import get_location, get_all_area_codes, get_district_area_codes
from app.services.weather_service import get_weather_data
from app.utils.logger_util import logger

bp = Blueprint('weather_routes', __name__)

def _get_client_ip():
    """获取客户端IP地址"""
    return request.headers.get('X-Forwarded-For', '').split(',')[0].strip() or request.remote_addr or 'unknown_ip'

@bp.route('/ip-location', methods=['GET'])
def get_ip_location():
    try:
        client_ip = _get_client_ip()
        force_refresh = request.args.get('forceRefresh') == 'true'
        logger.info(f'接收到IP位置信息请求，客户端IP: {client_ip}，是否强制刷新: {force_refresh}')
        return jsonify(get_location(client_ip, force_refresh))
    except Exception as e:
        return jsonify({"success": False, "message": "获取位置信息失败", "error": str(e)}), 500

@bp.route('/weather-area-codes', methods=['GET'])
def get_weather_area_codes():
    try:
        area_codes_data = get_all_area_codes()
        if area_codes_data:
            logger.info('使用缓存的天气区域编码数据')
            return jsonify(area_codes_data)
        
        logger.warning('地区编码数据文件不存在或无法读取')
        return jsonify({
            "data": [],
            "timestamp": int(time.time() * 1000),
            "expired": True,
            "permanent": True
        })
    except Exception as e:
        logger.error(f'获取天气区域编码失败: {e}')
        return jsonify({"success": False, "message": "获取数据失败", "error": str(e)}), 500

@bp.route('/weather-info', methods=['GET'])
async def get_weather_info():
    try:
        weather_code = request.args.get('weatherCode')
        force_refresh = request.args.get('forceRefresh') == 'true'

        if not weather_code:
            return jsonify({"error": "缺少weatherCode参数"}), 400

        logger.info(f'收到天气请求，查询参数: {request.args}')

        district_area_code = get_district_area_codes(weather_code) or {}
        weather_params = {"weatherCode": weather_code, "forceRefresh": force_refresh, **district_area_code}
        weather_data = await get_weather_data(weather_params)

        return jsonify(weather_data)
    except Exception as e:
        return jsonify({"error": "获取天气数据失败", "message": str(e)}), 500

