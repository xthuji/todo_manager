#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
服务管理模块

提供统一的服务管理功能，集中管理所有业务服务。
"""

from app.services import location_service, weather_service, auto_weather_notify_service


class ServiceManager:
    """
    服务管理类
    """
    
    def __init__(self):
        """
        初始化服务管理器
        """
        pass
    
    def get_location_service(self):
        """
        获取位置服务实例
        
        Returns:
            位置服务实例
        """
        return location_service
    
    def get_weather_service(self):
        """
        获取天气服务实例
        
        Returns:
            天气服务实例
        """
        return weather_service
    
    def get_auto_weather_notify_service(self):
        """
        获取自动天气通知服务实例
        
        Returns:
            自动天气通知服务实例
        """
        return auto_weather_notify_service


# 创建全局服务管理器实例
service_manager = ServiceManager()
