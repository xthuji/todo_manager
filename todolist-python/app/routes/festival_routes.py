from flask import Blueprint, jsonify, request
import os
import json
import time
from app.utils.cache_util import CacheUtil
from app.utils.config_util import config_util

# 创建蓝图
bp = Blueprint('festival_routes', __name__)

# 初始化缓存工具
cache_util = CacheUtil()

# 数据目录配置
DATA_DIR = config_util.get_data_dir()
CONFIG_DIR = config_util.get_config_dir()

# 缓存配置
FESTIVAL_CONFIG_PATH = os.path.join(CONFIG_DIR, 'festival_config.json')
CACHE_KEY = 'festival_config'
FESTIVAL_OPTIONS = {
    "allow_expired": False,  # 允许使用过期缓存作为兜底
    "ttl": 3600000  # 1小时缓存
}

# 获取节日数据
def get_festival_data():
    try:
        # 从配置文件中读取节日数据
        festival_config_path = os.path.join(CONFIG_DIR, 'festival_config.json')
        if os.path.exists(festival_config_path):
            with open(festival_config_path, 'r', encoding='utf-8') as f:
                festival_data = json.load(f)
            return {"success": True, "festivals": festival_data.get("festivals", [])}
        else:
            # 配置文件不存在，返回空数据
            return {"success": True, "festivals": []}
    except Exception as e:
        return {"success": False, "error": str(e)}

# 获取节日数据接口

@bp.route('/data', methods=['GET'])

def get_festivals():
    try:
        # 尝试从缓存获取
        cached_data = cache_util.get("festival_data", FESTIVAL_OPTIONS)
        if cached_data is not None:
            return jsonify({
                "data": cached_data,
                "timestamp": time.time() * 1000
            })
        
        # 缓存不存在或已过期，从数据源加载
        data = get_festival_data()
        # 设置缓存
        cache_util.set("festival_data", data, FESTIVAL_OPTIONS.get("ttl", 300000))
        return jsonify({
            "data": data,
            "timestamp": time.time() * 1000
        })
    except Exception as e:
        return jsonify({"error": {"message": f"获取节日数据失败: {str(e)}"}}), 500

# 获取节日配置接口
@bp.route('/config', methods=['GET'])
def get_festival_config():
    try:
        print(f"FESTIVAL_CONFIG_PATH: {FESTIVAL_CONFIG_PATH}")
        print(f"File exists: {os.path.exists(FESTIVAL_CONFIG_PATH)}")
        
        # 先清除缓存，确保从文件重新读取
        cache_util.delete(CACHE_KEY)
        print("Cache deleted")

        # 从文件加载
        if os.path.exists(FESTIVAL_CONFIG_PATH):
            print("Reading file...")
            with open(FESTIVAL_CONFIG_PATH, 'r', encoding='utf-8') as f:
                festival_data = json.load(f)
            print(f"File read successfully: {festival_data}")
            # 设置缓存
            cache_util.set(CACHE_KEY, festival_data, 3600000)
            print("Cache set successfully")
            return jsonify({
                "data": festival_data,
                "timestamp": time.time() * 1000,
                "error": None
            })
        else:
            # 配置文件不存在，返回空数据
            empty_data = {"festivals": []}
            print("File not found, returning empty festival data")
            return jsonify({
                "data": empty_data,
                "timestamp": time.time() * 1000,
                "error": None
            })
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({
            "data": None,
            "timestamp": time.time() * 1000,
            "error": {"message": f"获取节日配置失败: {str(e)}"}
        }), 500

# 保存节日配置接口
@bp.route('/save', methods=['POST'])
def save_festival_config():
    try:
        config_data = request.json

        # 验证配置数据的基本结构
        if not isinstance(config_data, dict):
            return jsonify({
                "data": None,
                "timestamp": time.time() * 1000,
                "error": {"message": "无效的配置数据格式"}
            }), 400

        # 保存配置到文件
        with open(FESTIVAL_CONFIG_PATH, 'w', encoding='utf-8') as f:
            json.dump(config_data, f, ensure_ascii=False, indent=2)

        # 清除缓存，确保下次读取时获取最新数据
        cache_util.delete(CACHE_KEY)

        # 重新加载配置以返回最新数据
        if os.path.exists(FESTIVAL_CONFIG_PATH):
            with open(FESTIVAL_CONFIG_PATH, 'r', encoding='utf-8') as f:
                festival_data = json.load(f)
            return jsonify({
                "data": festival_data,
                "timestamp": time.time() * 1000,
                "error": None
            })
        else:
            return jsonify({
                "data": config_data,
                "timestamp": time.time() * 1000,
                "error": None
            })
    except Exception as e:
        return jsonify({
            "data": None,
            "timestamp": time.time() * 1000,
            "error": {"message": f"保存节日配置失败: {str(e)}"}
        }), 500
