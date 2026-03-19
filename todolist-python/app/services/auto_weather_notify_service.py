#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
自动天气通知服务

提供自动天气通知功能，与Node.js项目中的autoWeatherNotifyService.js功能对应。
"""

import time
import threading
import sys
import os

# 添加用户站点包目录到Python路径
sys.path.insert(0, os.path.expanduser('~/.local/lib/python3.13/site-packages'))
sys.path.insert(0, os.path.expanduser('~/Library/Python/3.13/lib/python/site-packages'))

import schedule
from app.utils.cache_util import cache_util
from app.utils.config_util import config_util
from app.utils.constants import USE_CACHE
from app.services.weather_service import get_weather_data
from app.services.notify_service import load_notify_config, send_message, get_notify_config
from app.services.location_service import get_district_area_codes
from app.utils.logger_util import logger


class AutoWeatherNotify:
    """
    自动天气通知服务
    """
    
    def __init__(self):
        self.is_sending = False
        self.cron_job = None
        self.DEFAULT_CRON = '0 0 * * *'
        self.TIMEZONE = 'Asia/Shanghai'
        
        # 天气图标映射表
        self.WEATHER_ICONS = [
            {"keywords": ["暴雨", "大雨", "中雨", "小雨", "阵雨", "雨"], "icon": "🌧️"},
            {"keywords": ["雷阵雨", "雷"], "icon": "⚡"},
            {"keywords": ["雾", "霾"], "icon": "🌫️"},
            {"keywords": ["多云", "晴间多云"], "icon": "⛅"},
            {"keywords": ["晴"], "icon": "☀️"},
            {"keywords": ["阴"], "icon": "☁️"},
            {"keywords": ["雪"], "icon": "❄️"},
            {"keywords": ["云"], "icon": "☁️"},
        ]
    
    def get_weather_icon(self, weather=""):
        """
        获取天气图标
        
        Args:
            weather: 天气描述
        
        Returns:
            天气图标
        """
        for item in self.WEATHER_ICONS:
            for keyword in item["keywords"]:
                if keyword in weather:
                    return item["icon"]
        return "⛅"
    
    def format_date_time(self, input_date=None, week_only=False):
        """
        格式化日期与星期
        
        Args:
            input_date: 输入日期
            week_only: 是否只返回星期
        
        Returns:
            格式化后的日期字符串
        """
        if input_date:
            if isinstance(input_date, str) and len(input_date) == 8:
                # 处理 20251225 这种格式
                try:
                    year = int(input_date[:4])
                    month = int(input_date[4:6])
                    day = int(input_date[6:8])
                    input_date = time.strptime(f"{year}-{month}-{day}", "%Y-%m-%d")
                except:
                    input_date = None
        
        if not input_date:
            input_date = time.localtime()
        
        if week_only:
            # 只返回星期
            week_days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
            return week_days[input_date.tm_wday]
        else:
            # 返回完整日期和星期
            date_str = time.strftime("%Y-%m-%d", input_date)
            week_days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
            week_str = week_days[input_date.tm_wday]
            time_str = time.strftime("%H:%M", input_date)
            return f"{date_str} {week_str} {time_str}"
    
    def organize_weather_text(self, weather_data):
        """
        组织天气文本
        
        Args:
            weather_data: 天气数据
        
        Returns:
            组织好的天气文本
        """
        today_weather = weather_data.get('todayWeather', {})
        recent_days_weather = weather_data.get('recentDaysWeather', [])
        area_name = weather_data.get('areaName', '未知地区')
        weather_code = weather_data.get('weatherCode')
        moji_area_code = weather_data.get('mojiAreaCode')
        nmc_area_code = weather_data.get('nmcAreaCode')
        cma_area_code = weather_data.get('cmaAreaCode')
        
        date_str = self.format_date_time()
        
        lines = [
            f"📍 {area_name} 天气 📅 {date_str}",
            "",
            f"{self.get_weather_icon(today_weather.get('weather', ''))} {today_weather.get('weather', '未知')}，🌡️ 温度：{today_weather.get('tempMin', '--')}~{today_weather.get('tempMax', '--')}°C",
            f"💧 湿度：{today_weather.get('humidity', '--')}",
            f"🍃 空气质量：{today_weather.get('airQuality', '--')}",
            f"༄ 风力风向：{today_weather.get('wind', '--')}",
        ]
        
        if len(recent_days_weather) > 1:
            lines.append('\n未来天气预告：')
            for i, day in enumerate(recent_days_weather[1:], 1):
                week_day = self.format_date_time(day.get('date'), True)
                lines.append(f"{i}天后({week_day})：{self.get_weather_icon(day.get('weather', ''))}{day.get('weather', '--')}，🌡️{day.get('tempMin', '--')}~{day.get('tempMax', '--')}°C，༄{day.get('wind', '--')}")
        
        lines.append('\n🔗 详情查阅：')
        if weather_code:
            lines.append(f"· [天气网](https://forecast.weather.com.cn/town/weather1dn/{weather_code}.shtml)")
        if moji_area_code:
            lines.append(f"· [墨迹天气](https://tianqi.moji.com/weather/china/{moji_area_code})")
        if nmc_area_code:
            lines.append(f"· [中央气象台](https://www.nmc.cn/publish/forecast/{nmc_area_code}.html)")
        if cma_area_code:
            lines.append(f"· [中国气象局](https://weather.cma.cn/web/weather/{cma_area_code}.html)")
        
        lines.append('\n祝您生活愉快！')
        return '\n'.join(lines)
    
    def validate_weather_data(self, weather_data):
        """
        简单的校验逻辑
        
        Args:
            weather_data: 天气数据
        
        Returns:
            校验结果
        """
        errors = []
        if not weather_data:
            errors.append('天气数据为空')
        elif not weather_data.get('todayWeather'):
            errors.append('缺少今日天气数据')
        elif not weather_data.get('areaName') and not weather_data.get('weatherCode'):
            errors.append('缺少区域标识')
        
        return {
            "isValid": len(errors) == 0,
            "errors": errors
        }
    
    async def send_error_notify(self, target_user_info, message):
        """
        发送错误警报
        
        Args:
            target_user_info: 目标用户信息
            message: 错误消息
        """
        if not target_user_info:
            return
        
        try:
            error_text = f"❌ 天气服务异常\n时间: {self.format_date_time()}\n原因: {message}"
            await send_message('weather', target_user_info, error_text)
        except Exception as e:
            logger.error(f"警报通知发送失败: {e}")
    
    async def send_weather_notify_on_timer(self):
        """
        执行通知任务
        """
        logger.info("天气通知任务启动...")
        if self.is_sending:
            return
        
        self.is_sending = True
        
        try:
            # 获取配置
            notify_config = await get_notify_config()
            if not notify_config:
                notify_config = await load_notify_config()
            
            if not notify_config:
                raise Exception("通知配置未加载")
            
            config = notify_config.get('weather')
            if not config:
                raise Exception("天气通知配置未找到")
            
            weather_code = config.get('weatherCode')
            if not weather_code:
                raise Exception("天气代码未配置")
            
            logger.info(f"[Task] 正在获取 [{weather_code}] 的天气数据...")
            
            # 获取区县级别区域编码
            district_area_code = get_district_area_codes(weather_code)
            
            # 获取天气数据
            weather_result = await get_weather_data({"weatherCode": weather_code, **district_area_code})
            
            weather_data = weather_result.get('data')
            validation = self.validate_weather_data(weather_data)
            
            if not validation.get('isValid'):
                raise Exception(f"数据校验失败: {', '.join(validation.get('errors', []))}")
            
            # 组织天气文本
            weather_text = self.organize_weather_text(weather_data)
            
            # 发送通知
            result = await send_message('weather', config, weather_text)
            
            text = "天气通知发送成功" if result.get('success') else f"天气通知发送失败: {result.get('message', '未知错误')}"
            logger.info(text)
        except Exception as e:
            logger.error(f"[Error] 任务失败: {e}")
            await self.send_error_notify(config, str(e))
        finally:
            self.is_sending = False


# 初始化自动天气通知服务
auto_weather_notify = AutoWeatherNotify()


# 启动天气通知定时器
def start_weather_notify_timer():
    """
    启动天气通知定时器
    使用schedule库来管理定时任务
    """
    logger.info('初始化天气通知定时器...')
    
    # 加载配置
    import asyncio
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    notify_config = loop.run_until_complete(load_notify_config())
    
    # 检查配置
    if notify_config and notify_config.get('weather', {}).get('notifyEnabled'):
        config = notify_config.get('weather')
        
        # 设置定时任务
        if config.get('timerEnabled'):
            # 从配置中获取cron表达式，默认为每天8点
            cron_expression = config.get('cronExpression', '0 8 * * *')
            
            # 解析cron表达式，设置定时任务
            # 这里简化处理，只支持每天固定时间
            try:
                # 尝试解析cron表达式，提取小时和分钟
                parts = cron_expression.split()
                if len(parts) >= 5:
                    minute = parts[0]
                    hour = parts[1]
                    if minute == '0' and hour.isdigit():
                        # 设置每天固定时间
                        schedule.every().day.at(f"{hour}:00").do(run_send_task)
                        logger.info(f"定时器已启动，每天 {hour}:00 发送天气通知")
                    else:
                        # 默认每天8点
                        schedule.every().day.at("08:00").do(run_send_task)
                        logger.info("定时器已启动，每天 08:00 发送天气通知")
                else:
                    # 默认每天8点
                    schedule.every().day.at("08:00").do(run_send_task)
                    logger.info("定时器已启动，每天 08:00 发送天气通知")
            except:
                # 默认每天8点
                schedule.every().day.at("08:00").do(run_send_task)
                logger.info("定时器已启动，每天 08:00 发送天气通知")
        
        # 启动时即时通知
        if config.get('startupNotifyEnabled'):
            logger.info('执行启动时即时通知...')
            run_send_task()
    else:
        logger.info('天气通知功能未启用')
    
    # 启动定时任务线程
    def run_schedule():
        while True:
            schedule.run_pending()
            time.sleep(60)  # 每分钟检查一次
    
    scheduler_thread = threading.Thread(target=run_schedule, daemon=True)
    scheduler_thread.start()
    
    logger.info('天气通知定时器已启动')


def run_send_task():
    """
    运行发送任务
    """
    import asyncio
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(auto_weather_notify.send_weather_notify_on_timer())
    loop.close()
