from flask import Blueprint, jsonify, request
import os
import signal
import time

# 创建蓝图
bp = Blueprint('status_routes', __name__)

# 服务器实例
server_instance = None

# 设置服务器实例
def set_server_instance(server):
    global server_instance
    server_instance = server

# 检查服务器状态接口

@bp.route('/check-status', methods=['GET'])

def check_status():
    try:
        print("check_status function is called!")
        # 确保返回的结构与Node.js服务器一致
        response = {
            "success": True,
            "message": "服务正在运行"
        }
        print(f"Response: {response}")
        return jsonify(response)
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({"success": False, "message": f"检查服务状态失败: {str(e)}"}), 500

# 关闭服务器接口
@bp.route('/shutdown', methods=['POST'])
def shutdown():
    try:
        # 异步关闭服务器
        def shutdown_server():
            time.sleep(1)
            if server_instance:
                server_instance.shutdown()
            else:
                # 如果没有服务器实例，尝试通过信号关闭
                os.kill(os.getpid(), signal.SIGINT)
        
        import threading
        threading.Thread(target=shutdown_server, daemon=True).start()
        
        return jsonify({
            "data": {
                "success": True,
                "message": "服务器正在关闭"
            },
            "timestamp": time.time() * 1000
        })
    except Exception as e:
        return jsonify({"error": {"message": f"关闭服务器失败: {str(e)}"}}), 500
