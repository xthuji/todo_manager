from flask import Blueprint, jsonify
import os
import signal
import time
import threading
from app.utils.logger_util import logger

bp = Blueprint('status_routes', __name__)

server_instance = None

def set_server_instance(server):
    global server_instance
    server_instance = server

@bp.route('/check-status', methods=['GET'])
def check_status():
    return jsonify({"success": True, "message": "服务正在运行"})

@bp.route('/shutdown', methods=['POST'])
def shutdown():
    logger.info('收到关闭服务器请求')
    
    def shutdown_server():
        time.sleep(1)
        logger.info('正在关闭服务器...')
        if server_instance:
            server_instance.shutdown()
        else:
            os.kill(os.getpid(), signal.SIGINT)
    
    threading.Thread(target=shutdown_server, daemon=True).start()
    return jsonify({"success": True, "message": "服务器将在1秒后关闭"})
