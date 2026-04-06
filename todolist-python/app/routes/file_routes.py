from flask import Blueprint, request, jsonify
import os
import time
from app.utils.cache_util import CacheUtil
from app.utils.config_util import config_util
from app.utils.logger_util import logger

bp = Blueprint('file_routes', __name__)
cache_util = CacheUtil()
DATA_DIR = config_util.get_data_dir()

FILE_OPTIONS = {
    "allow_expired": False,
    "ttl": 300000
}

def _scan_files():
    """扫描文件系统"""
    try:
        files = os.listdir(DATA_DIR)
        todo_files = [
            {
                "name": file,
                "exists": True,
                "mtime": int(os.stat(os.path.join(DATA_DIR, file)).st_mtime * 1000)
            }
            for file in files 
            if file.startswith('todo') and file.endswith('.txt')
        ]
        sorted_files = sorted(todo_files, key=lambda x: x.get("mtime", 0), reverse=True)
        return {
            "success": True, 
            "files": sorted_files, 
            "defaultFile": sorted_files[0]["name"] if sorted_files else "todo.txt"
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}

def _read_file(filename):
    """读取文件内容"""
    file_path = os.path.join(DATA_DIR, filename)
    try:
        if not os.path.exists(file_path):
            with open(file_path, 'w', encoding='utf8') as f:
                f.write('')
        with open(file_path, 'r', encoding='utf8') as f:
            content = f.read()
        logger.info(f"读取文件 {filename}")
        return {"success": True, "content": content}
    except Exception as e:
        return {"success": False, "error": str(e)}

def _validate_filename(filename):
    """验证文件名"""
    return filename.startswith('todo') and filename.endswith('.txt')

def _clear_file_cache(specific_file=None):
    """清除文件缓存"""
    try:
        if specific_file:
            cache_util.delete(cache_util.generate_file_cache_key(specific_file))
        cache_util.delete('file_list')
    except Exception as e:
        logger.error(f'清除文件缓存失败: {str(e)}')

@bp.route('/scan', methods=['GET'])
def scan():
    try:
        cached_data = cache_util.get_wrapped_data('file_list', FILE_OPTIONS)
        if cached_data is not None:
            return jsonify(cached_data)
        
        data = _scan_files()
        response_data = {
            "success": data.get("success", True),
            "files": data.get("files", []),
            "defaultFile": data.get("defaultFile", "todo.txt")
        }
        cache_util.set_data('file_list', response_data, FILE_OPTIONS)
        return jsonify(cache_util.get_wrapped_data('file_list', FILE_OPTIONS))
    except Exception as e:
        return jsonify({"error": {"message": f"扫描文件失败: {str(e)}"}}), 500

@bp.route('/read/<filename>', methods=['GET'])
def read(filename):
    try:
        if not _validate_filename(filename):
            return jsonify({"success": False, "message": "不允许访问此文件"}), 403
        
        cache_key = cache_util.generate_file_cache_key(filename)
        cached_data = cache_util.get_wrapped_data(cache_key, FILE_OPTIONS)
        if cached_data is not None:
            return jsonify(cached_data)
        
        data = _read_file(filename)
        response_data = {
            "success": data.get("success", True),
            "content": data.get("content", "")
        }
        cache_util.set_data(cache_key, response_data, FILE_OPTIONS)
        return jsonify(cache_util.get_wrapped_data(cache_key, FILE_OPTIONS))
    except Exception as e:
        return jsonify({"error": {"message": f"读取文件失败: {str(e)}"}}), 500

@bp.route('/write/<filename>', methods=['POST'])
def write(filename):
    try:
        if not _validate_filename(filename):
            return jsonify({"success": False, "message": "不允许访问此文件"}), 403
        
        content = request.json.get('content', '')
        file_path = os.path.join(DATA_DIR, filename)
        
        with open(file_path, 'w', encoding='utf8') as f:
            f.write(content)
        
        _clear_file_cache(filename)
        logger.info(f"文件 {filename} 保存成功，相关缓存已清除")
        return jsonify({"success": True, "message": "文件保存成功"})
    except Exception as e:
        return jsonify({"success": False, "message": "写入文件失败", "error": str(e)}), 500
