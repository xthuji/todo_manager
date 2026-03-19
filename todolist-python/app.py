#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import threading
import time
import socket
import platform
import webbrowser
import webview
from typing import Optional
from app.app import app as flask_app
from app.utils.logger_util import logger

class TodoApp:
    def __init__(self):
        # 从配置文件读取端口，若失败默认使用 3001
        self.port = self._get_config_port()
        self.url = f"http://127.0.0.1:{self.port}"
        self.splash_window: Optional[webview.Window] = None

    def _get_config_port(self) -> int:
        """读取 app_config.json 中的端口配置"""
        config_path = os.path.join(os.path.dirname(__file__), "data", "config", "app_config.json")
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                import json
                config = json.load(f)
                return config.get('server', {}).get('ports', {}).get('python', 3001)
        except Exception:
            return 3001

    def _wait_for_server(self, timeout=15):
        """原生 Socket 检查，确保 Flask 真正启动"""
        start_time = time.time()
        time.sleep(1.5)
        while time.time() - start_time < timeout:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex(('127.0.0.1', self.port)) == 0:
                    return True
            time.sleep(0.5)
        return False

    def _run_flask(self):
        """后台静默运行 Flask"""
        flask_app.run(host='127.0.0.1', port=self.port, debug=False, use_reloader=False)

    def init_and_switch(self):
        """核心调度：启动后端 -> 监测状态 -> 切换主窗"""
        # 启动后端线程
        threading.Thread(target=self._run_flask, daemon=True).start()

        # 等待服务响应
        if self._wait_for_server():
            # 创建正式主窗口
            webview.create_window(
                "TodoManager", 
                url=self.url, 
                width=1000, height=800, 
                min_size=(800, 600)
            )
            # 销毁启动动画
            self.splash_window.destroy()
        else:
            self.splash_window.evaluate_js("document.querySelector('.msg').innerText = '启动超时，请重试';")

    def _check_system_compatibility(self, system: str, version: str = None):
        """检查系统兼容性"""
        if system == 'Darwin':  # macOS
            version_parts = version.split('.')
            # 确保版本号至少有两个部分
            if len(version_parts) >= 2:
                major = int(version_parts[0])
                minor = int(version_parts[1])
                # 检查是否是 macOS 10.15 或更早版本，这些版本的 WebKit 可能与 pywebview 不兼容
                if major == 10 and minor <= 15:
                    return False
        return True

    def run(self):
        # 检查系统兼容性
        system = platform.system()
        version = platform.mac_ver()[0]
        if not self._check_system_compatibility(system, version):
            logger.info(f"检测到 webview 不兼容的系统版本 {system}-{version}，使用系统默认浏览器打开应用...")
            # 启动后端线程
            threading.Thread(target=self._run_flask, daemon=True).start()
            # 等待服务响应
            if self._wait_for_server():
                webbrowser.open(self.url)
                return
        
        # 现代化的 Splash HTML 样式
        splash_html = """
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /><title>启动中</title><style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background-color:#f0f4f8;font-family:"Segoe UI",Tahoma,Geneva,Verdana,sans-serif;}.logo{font-size:2.5rem;font-weight:bold;color:#3b82f6;margin-bottom:2rem;}.loading{display:flex;flex-direction:column;align-items:center;}.spinner{width:50px;height:50px;border:5px solid #e2e8f0;border-top:5px solid #3b82f6;border-radius:50%;animation:spin 1s linear infinite;margin-bottom:1rem;}@keyframes spin{0%{transform:rotate( 0deg );}100%{transform:rotate( 360deg );}}.message{color:#4b5563;font-size:1.1rem;}.status{color:#6b7280;font-size:0.9rem;margin-top:0.5rem;}</style></head>
        <body><div class="logo">TodoManager</div><div class="loading"><div class="spinner"></div><div class="message">正在启动服务...</div></div></body>
        </html>
        """
        
        # 创建启动窗口
        self.splash_window = webview.create_window(
            'Loading', html=splash_html, 
            width=420, height=320, 
            frameless=True, on_top=True
        )

        # 启动主循环并执行初始化回调
        webview.start(self.init_and_switch, debug=False)

if __name__ == "__main__":
    TodoApp().run()