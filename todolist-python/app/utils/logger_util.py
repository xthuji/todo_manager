#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
日志工具模块
"""

import os
import logging
from logging.handlers import RotatingFileHandler

# 日志目录
LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'logs')

# 确保日志目录存在
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

# 日志文件路径
LOG_FILE = os.path.join(LOG_DIR, 'app.log')

# 创建 logger
logger = logging.getLogger('todo_manager')
logger.setLevel(logging.INFO)

# 创建 formatter
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# 创建 file handler
file_handler = RotatingFileHandler(
    LOG_FILE, 
    maxBytes=1024 * 1024 * 10,  # 10MB
    backupCount=5
)
file_handler.setLevel(logging.INFO)
file_handler.setFormatter(formatter)

# 创建 console handler
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(formatter)

# 添加 handlers
logger.addHandler(file_handler)
logger.addHandler(console_handler)

if __name__ == '__main__':
    # 测试 logger
    logger.info('测试日志输出')
    logger.warning('测试警告输出')
    logger.error('测试错误输出')
