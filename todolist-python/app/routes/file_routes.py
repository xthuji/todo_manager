from flask import Blueprint, request, jsonify
import os
import time
from app.utils.cache_util import CacheUtil
from app.utils.config_util import config_util

# 创建蓝图
bp = Blueprint('file_routes', __name__)

# 初始化缓存工具
cache_util = CacheUtil()

# 数据目录配置
DATA_DIR = config_util.get_data_dir()

# 缓存配置
FILE_OPTIONS = {
    "allow_expired": False,  # 允许使用过期缓存作为兜底
    "ttl": 300000  # 5分钟缓存
}

# 扫描文件系统
def scan_files():
    # 读取data目录中的所有todo*.txt文件
    try:
        files = os.listdir(DATA_DIR)
        todo_files = [file for file in files if file.startswith('todo') and file.endswith('.txt')]

        # 获取每个文件的信息（包括修改时间）
        file_infos = []
        for file in todo_files:
            try:
                file_path = os.path.join(DATA_DIR, file)
                stats = os.stat(file_path)
                file_infos.append({
                    "name": file,
                    "exists": True,
                    "mtime": int(stats.st_mtime * 1000)  # 修改时间戳（毫秒），转换为整数
                })
            except Exception:
                file_infos.append({
                    "name": file,
                    "exists": False
                })

        # 按修改时间降序排序（最新的文件在前）
        sorted_files = sorted(file_infos, key=lambda x: (x.get("mtime", 0) if x.get("exists", False) else 0), reverse=True)

        # 如果有文件，默认选择最新的文件
        default_file = sorted_files[0]["name"] if sorted_files else "todo.txt"
        return {"success": True, "files": sorted_files, "defaultFile": default_file}
    except Exception as e:
        return {'success': False, 'error': str(e)}

# 扫描文件接口

@bp.route('/scan', methods=['GET'])
def scan():
    try:
        # 尝试从缓存获取
        cached_data = cache_util.get_wrapped_data('file_list', FILE_OPTIONS)
        if cached_data is not None:
            # 确保返回的结构与Node.js服务器一致
            return jsonify(cached_data)
        
        # 缓存不存在或已过期，从数据源加载
        data = scan_files()
        # 构建响应数据，files字段保持为数组，与Node.js服务器一致
        response_data = {
            "success": data.get("success", True),
            "files": data.get("files", []),
            "defaultFile": data.get("defaultFile", "todo.txt")
        }
        # 设置缓存
        cache_util.set_data('file_list', response_data, FILE_OPTIONS)
        # 再次从缓存获取，确保返回的结构与Node.js服务器一致
        cached_data = cache_util.get_wrapped_data('file_list', FILE_OPTIONS)
        return jsonify(cached_data)
    except Exception as e:
        return jsonify({"error": {"message": f"扫描文件失败: {str(e)}"}}), 500

# 读取文件
def read_file(filename):
    file_path = os.path.join(DATA_DIR, filename)

    # 检查文件是否存在，如果不存在则创建空文件
    try:
        if not os.path.exists(file_path):
            with open(file_path, 'w', encoding='utf8') as f:
                f.write('')

        with open(file_path, 'r', encoding='utf8') as f:
            content = f.read()
        print(f"读取文件 {filename}")
        return {"success": True, "content": content}
    except Exception as e:
        return {"success": False, "error": str(e)}

# 读取文件内容接口

@bp.route('/read/<filename>', methods=['GET'])
def read(filename):
    try:
        # 安全检查：确保请求的是符合命名规则的文件
        if not filename.startswith('todo') or not filename.endswith('.txt'):
            return jsonify({"success": False, "message": "不允许访问此文件"}), 403

        # 尝试从缓存获取
        cached_data = cache_util.get_wrapped_data(f"file_read_{filename}", FILE_OPTIONS)
        if cached_data is not None:
            # 确保返回的结构与Node.js服务器一致
            return jsonify(cached_data)
        
        # 缓存不存在或已过期，从数据源加载
        data = read_file(filename)
        # 构建响应数据
        response_data = {
            "success": data.get("success", True),
            "content": data.get("content", "")
        }
        # 设置缓存
        cache_util.set_data(f"file_read_{filename}", response_data, FILE_OPTIONS)
        # 再次从缓存获取，确保返回的结构与Node.js服务器一致
        cached_data = cache_util.get_wrapped_data(f"file_read_{filename}", FILE_OPTIONS)
        return jsonify(cached_data)
    except Exception as e:
        return jsonify({"error": {"message": f"读取文件失败: {str(e)}"}}), 500

# 清除文件相关缓存
def clear_file_cache(specific_file=None):
    try:
        if specific_file:
            # 清除特定文件的读取缓存
            cache_util.delete(f'file_read_{specific_file}')
        # 总是清除文件列表缓存
        cache_util.delete('file_list')
    except Exception as e:
        print(f'清除文件缓存失败: {str(e)}')

# 写入文件内容接口
@bp.route('/write/<filename>', methods=['POST'])
def write(filename):
    try:
        # 安全检查：确保请求的是符合命名规则的文件
        if not filename.startswith('todo') or not filename.endswith('.txt'):
            return jsonify({"success": False, "message": "不允许访问此文件"}), 403

        content = request.json.get('content', '')
        file_path = os.path.join(DATA_DIR, filename)
        
        with open(file_path, 'w', encoding='utf8') as f:
            f.write(content)

        # 清除相关缓存，确保下次读取时获取最新数据
        clear_file_cache(filename)
        print(f"文件 {filename} 保存成功，相关缓存已清除")

        return jsonify({"success": True, "message": "文件保存成功"})
    except Exception as e:
        return jsonify({"success": False, "message": "写入文件失败", "error": str(e)}), 500
