#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
路由注册模块

提供统一的路由注册功能，集中管理所有API路由。
"""

from app.routes import file_routes, holiday_routes, festival_routes, status_routes, weather_routes


def register_routes(app):
    """
    注册所有路由
    
    Args:
        app: Flask应用实例
    """
    # 注册文件相关路由
    app.register_blueprint(file_routes.bp, url_prefix='/api/file')
    # 注册节假日相关路由
    app.register_blueprint(holiday_routes.bp, url_prefix='/api/holiday')
    # 注册节日相关路由
    app.register_blueprint(festival_routes.bp, url_prefix='/api/festival')
    # 注册状态相关路由
    app.register_blueprint(status_routes.bp, url_prefix='/api')
    # 注册天气相关路由
    app.register_blueprint(weather_routes.bp, url_prefix='/api/weather')
