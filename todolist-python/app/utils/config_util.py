#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
配置管理模块

提供统一的配置管理功能，集中存储和管理项目的配置信息。
"""

import os
import json
from .logger_util import logger


class ConfigUtil:
    """
    配置管理工具类
    """
    
    def __init__(self):
        """
        初始化配置管理工具
        """
        # 项目根目录
        self.project_root = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        # 数据目录 - 使用Python项目自己的目录
        self.data_dir = os.path.join(self.project_root, 'data')
        # 缓存目录
        self.cache_dir = os.path.join(self.data_dir, 'cache')
        # 配置目录
        self.config_dir = os.path.join(self.data_dir, 'config')
        # 天气数据目录
        self.weather_dir = os.path.join(self.data_dir, 'weather')
        # 模拟数据目录 - 使用Python项目自己的mock目录
        self.mock_dir = os.path.join(self.data_dir, 'mock')
        
        # 配置定义，类似于Node项目中的CONFIG_DEFINITIONS
        self.config_definitions = {
            'app': {
                'file': 'app_config.json'
            },
            'notify': {
                'file': 'notify_config.json'
            },
            'festival': {
                'file': 'festival_config.json'
            }
        }
        
        # 确保所有目录存在
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(self.cache_dir, exist_ok=True)
        os.makedirs(self.config_dir, exist_ok=True)
        os.makedirs(self.weather_dir, exist_ok=True)
        os.makedirs(self.mock_dir, exist_ok=True)
    
    def get_project_root(self):
        """
        获取项目根目录
        
        Returns:
            项目根目录路径
        """
        return self.project_root
    
    def get_data_dir(self):
        """
        获取数据目录
        
        Returns:
            数据目录路径
        """
        return self.data_dir
    
    def get_cache_dir(self):
        """
        获取缓存目录
        
        Returns:
            缓存目录路径
        """
        return self.cache_dir
    
    def get_config_dir(self):
        """
        获取配置目录
        
        Returns:
            配置目录路径
        """
        return self.config_dir
    
    def get_weather_dir(self):
        """
        获取天气数据目录
        
        Returns:
            天气数据目录路径
        """
        return self.weather_dir
    
    def get_mock_dir(self):
        """
        获取模拟数据目录
        
        Returns:
            模拟数据目录路径
        """
        return self.mock_dir
    
    def _get_config_path(self, config_name):
        """
        根据配置名称获取配置文件的路径
        
        Args:
            config_name: 配置名称
        
        Returns:
            配置文件路径
        
        Raises:
            ValueError: 如果配置名称不存在
        """
        definition = self.config_definitions.get(config_name)
        if not definition:
            raise ValueError(f"Unknown config: {config_name}")
        return os.path.join(self.config_dir, definition['file'])
    
    def _read_config_file(self, config_path):
        """
        读取配置文件
        
        Args:
            config_path: 配置文件路径
        
        Returns:
            配置数据
        """
        try:
            if os.path.exists(config_path):
                with open(config_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            logger.warning(f"Config file not found: {config_path}")
            return {}
        except Exception as e:
            logger.error(f"读取配置文件失败: {str(e)}")
            return {}
    
    def get_config(self, config_name, default=None):
        """
        从配置文件中读取配置
        
        Args:
            config_name: 配置文件名称（不含扩展名）
            default: 默认值
        
        Returns:
            配置数据
        """
        try:
            config_path = self._get_config_path(config_name)
            config = self._read_config_file(config_path)
            return config or default
        except Exception as e:
            logger.error(f"获取配置失败: {str(e)}")
            return default
    
    def get_config_sync(self, config_name, default=None):
        """
        同步从配置文件中读取配置
        
        Args:
            config_name: 配置文件名称（不含扩展名）
            default: 默认值
        
        Returns:
            配置数据
        """
        return self.get_config(config_name, default)
    
    def save_config(self, config_name, config_data):
        """
        保存配置到配置文件
        
        Args:
            config_name: 配置文件名称（不含扩展名）
            config_data: 配置数据
        
        Returns:
            是否保存成功
        """
        try:
            config_path = self._get_config_path(config_name)
            
            # 确保配置目录存在
            config_dir = os.path.dirname(config_path)
            os.makedirs(config_dir, exist_ok=True)
            
            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(config_data, f, ensure_ascii=False, indent=2)
            
            logger.info(f"Config saved successfully: {config_name}")
            return True
        except Exception as e:
            logger.error(f"保存配置文件失败: {str(e)}")
            return False
    
    def get_config_value(self, config_name, key_path, default=None):
        """
        根据键路径获取配置值
        
        Args:
            config_name: 配置文件名称（不含扩展名）
            key_path: 键路径，如 'server.ports.python'
            default: 默认值
        
        Returns:
            配置值
        """
        try:
            config = self.get_config_sync(config_name)
            keys = key_path.split('.')
            value = config
            
            for key in keys:
                if value is None:
                    return default
                value = value.get(key)
            
            return value if value is not None else default
        except Exception as e:
            logger.error(f"获取配置值失败: {str(e)}")
            return default
    
    def get_available_configs(self):
        """
        获取所有可用的配置名称
        
        Returns:
            配置名称列表
        """
        return list(self.config_definitions.keys())
    
    def register_config(self, config_name, definition):
        """
        注册新的配置
        
        Args:
            config_name: 配置名称
            definition: 配置定义，包含 'file' 键
        
        Raises:
            ValueError: 如果配置名称已存在或定义不完整
        """
        if config_name in self.config_definitions:
            raise ValueError(f"Config {config_name} already registered")
        
        if 'file' not in definition:
            raise ValueError('Config definition must include file')
        
        self.config_definitions[config_name] = {
            'file': definition['file']
        }


# 创建全局配置工具实例
config_util = ConfigUtil()
