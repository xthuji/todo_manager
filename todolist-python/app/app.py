from flask import Flask, request, jsonify, send_from_directory
import os
import sys

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.routes import register_routes
from app.services.auto_weather_notify_service import start_weather_notify_timer
from app.routes.status_routes import set_server_instance
from app.utils.config_util import config_util

app = Flask(__name__)

# 配置
app.config['STATIC_DIR'] = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static')
# 设置JSON编码为UTF-8，避免Unicode转义序列
app.config['JSON_AS_ASCII'] = False

# 获取配置
PORT = config_util.get_config_value('app', 'server.ports.python', 3001)

# 注册路由
register_routes(app)

# 静态文件处理
@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory(app.config['STATIC_DIR'], path)

# 为了兼容前端页面的请求路径，添加assets路由
@app.route('/assets/<path:path>')
def send_assets(path):
    return send_from_directory(app.config['STATIC_DIR'], path)

# 为了兼容前端页面的请求路径，添加src/client/assets路由
@app.route('/src/client/assets/<path:path>')
def send_client_assets(path):
    return send_from_directory(app.config['STATIC_DIR'], path)

# 页面路由
@app.route('/')
def index():
    return send_from_directory(os.path.join(app.config['STATIC_DIR'], 'pages'), 'index.html')

@app.route('/<filename>.html')
def serve_page(filename):
    return send_from_directory(os.path.join(app.config['STATIC_DIR'], 'pages'), f'{filename}.html')

# 为了兼容前端页面的请求路径，添加src/client/pages路由
@app.route('/src/client/pages/<filename>.html')
def serve_client_page(filename):
    return send_from_directory(os.path.join(app.config['STATIC_DIR'], 'pages'), f'{filename}.html')

# 启动天气通知定时器
import threading
threading.Thread(target=start_weather_notify_timer, daemon=True).start()

# 启动服务器
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=PORT, debug=True)

