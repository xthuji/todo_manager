#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
通知服务模块

提供天气信息文本组织和通知发送功能，与Node.js项目中的notifyService.js功能对应。
"""

import os
import json
import time
import subprocess
from app.utils.config_util import config_util
from app.utils.cache_util import cache_util
from app.utils.constants import USE_CACHE

# 全局配置数据
notify_config = None


async def get_notify_config():
    """
    获取通知配置
    
    Returns:
        通知配置
    """
    global notify_config
    if notify_config:
        return notify_config
    
    # 如果配置不存在，尝试加载
    await load_notify_config()
    return notify_config


async def load_notify_config():
    """
    加载通知配置
    
    Returns:
        通知配置
    """
    global notify_config
    if notify_config:
        return notify_config
    
    try:
        # 构建配置文件路径
        config_dir = os.path.join(config_util.get_data_dir(), "config")
        config_file = os.path.join(config_dir, "notify_config.json")
        
        print(f"[Config] 尝试加载通知配置: {config_file}")
        
        if not os.path.exists(config_file):
            print(f"[Config] 配置文件不存在: {config_file}")
            return None
        
        with open(config_file, "r", encoding="utf8") as f:
            notify_config = json.load(f)
        
        print("[Config] 加载通知配置成功")
        return notify_config
    except Exception as e:
        print(f"[Config] 加载失败: {e}")
        return None


async def send_message(type_, target_user_info, message):
    """
    发送通知
    
    Args:
        type_: 通知类型
        target_user_info: 目标用户信息
        message: 通知消息内容
    
    Returns:
        发送结果
    """
    print(f"准备发送 {type_} 通知到 {target_user_info.get('phoneNumber', 'unknown')}/{target_user_info.get('wechatOpenId', 'unknown')}, 内容: \n{message}")
    
    status_list = []
    message_list = []
    
    # 加载配置
    if not notify_config:
        await load_notify_config()
    
    config = notify_config.get(type_) if notify_config else None
    
    # 检查短信通知是否启用
    if config and 'sms' in config.get('notifyTypes', []):
        sms_result = await send_sms_message(target_user_info.get('phoneNumber'), message)
        status_list.append(sms_result.get('success', False))
        if not sms_result.get('success'):
            message_list.append(f"短信通知发送失败: {sms_result.get('message', '未知错误')}")
    else:
        message_list.append('短信通知未启用，跳过发送')
    
    # 检查微信通知是否启用
    if config and 'wechat' in config.get('notifyTypes', []):
        wechat_result = await send_wechat_message(target_user_info.get('wechatOpenId'), message)
        status_list.append(wechat_result.get('success', False))
        if not wechat_result.get('success'):
            message_list.append(f"微信通知发送失败: {wechat_result.get('message', '未知错误')}")
    else:
        message_list.append('微信通知未启用，跳过发送')
    
    return {
        "success": all(status_list),
        "message": '\n'.join(message_list) or f"{type_}通知已发送"
    }


async def send_sms_message(phone_number, message):
    """
    通过Mac的Message.app发送短信
    
    Args:
        phone_number: 手机号码或iCloud邮箱
        message: 通知消息内容
    
    Returns:
        发送结果
    """
    import re
    
    # 验证手机号码或邮箱格式
    phone_regex = r'^(\+?\d{1,4})?[\s-]?\d{10,15}$'
    email_regex = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    
    if not phone_number:
        return {"success": False, "message": "手机号码或邮箱为空"}
    
    if not (re.match(phone_regex, phone_number) or re.match(email_regex, phone_number)):
        return {"success": False, "message": "无效的手机号码或邮箱格式"}
    
    # 对消息内容进行转义
    escaped_message = message.replace('"', '\\"').replace('\n', '\\\n')
    
    # 构建AppleScript命令
    applescript = f'''
    tell application "Messages"
        set targetService to 1st service whose service type = iMessage
        set targetBuddy to buddy "{phone_number}" of targetService
        send "{escaped_message}" to targetBuddy
    end tell
    '''
    
    try:
        # 执行AppleScript命令
        result = subprocess.run(
            ['osascript', '-e', applescript],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.stderr:
            print(f"发送短信时产生警告: {result.stderr}")
        
        print("短信发送成功!")
        return {
            "phoneNumber": phone_number,
            "messageLength": len(message),
            "success": True,
            "timestamp": time.strftime('%Y-%m-%dT%H:%M:%S')
        }
    except Exception as e:
        print(f"发送短信失败: {e}")
        return {
            "phoneNumber": phone_number,
            "success": False,
            "message": str(e) or "短信发送失败",
            "timestamp": time.strftime('%Y-%m-%dT%H:%M:%S')
        }


async def get_wechat_access_token():
    """
    获取微信公众号access_token
    
    Returns:
        access_token或None
    """
    try:
        # 尝试从缓存获取
        if USE_CACHE:
            cached_data = cache_util.get_data('wechat_access_token', {})
            if cached_data and cached_data.get('access_token') and cached_data.get('expire_time'):
                now = time.time() * 1000  # 转换为毫秒
                if cached_data['expire_time'] > now + 600000:  # 预留10分钟过期时间
                    print('使用缓存的微信公众号access_token')
                    return cached_data['access_token']
        
        # 加载配置
        if not notify_config:
            await load_notify_config()
        
        weather_config = notify_config.get('weather') if notify_config else None
        wechat_app_id = weather_config.get('wechatAppId') if weather_config else None
        wechat_app_secret = weather_config.get('wechatAppSecret') if weather_config else None
        
        if not wechat_app_id or not wechat_app_secret:
            print('微信公众号配置不完整，缺少appId或appSecret')
            return None
        
        # 调用微信API获取access_token
        import requests
        url = f"https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid={wechat_app_id}&secret={wechat_app_secret}"
        print(f"正在请求微信公众号access_token，appId: {wechat_app_id}")
        
        response = requests.get(url, timeout=10)
        data = response.json()
        
        if 'access_token' in data:
            access_token = data['access_token']
            # 设置过期时间（微信返回的是秒，转换为毫秒）
            now = time.time() * 1000  # 转换为毫秒
            expire_time = now + (data.get('expires_in', 7200) * 1000)
            print(f"微信公众号access_token获取成功，有效期至: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(expire_time / 1000))}")
            
            # 缓存access_token
            if USE_CACHE:
                cache_util.set_data('wechat_access_token', {
                    'access_token': access_token,
                    'expire_time': expire_time
                }, {
                    'ttl': data.get('expires_in', 7200) * 1000
                })
            
            return access_token
        else:
            print(f"获取微信公众号access_token失败: {data}")
            return None
    except Exception as e:
        print(f"获取微信公众号access_token时发生错误: {e}")
        return None


async def send_wechat_message(wechat_open_id, message):
    """
    发送微信消息
    
    Args:
        wechat_open_id: 微信用户OpenID
        message: 通知消息内容
    
    Returns:
        发送结果
    """
    import re
    
    try:
        # 验证OpenID格式
        wechat_open_id_regex = r'^[a-zA-Z0-9-]+$'
        if not wechat_open_id or not re.match(wechat_open_id_regex, wechat_open_id):
            return {"success": False, "message": "无效的微信OpenID格式"}
        
        # 获取access_token
        access_token = await get_wechat_access_token()
        if not access_token:
            return {"success": False, "message": "获取微信access_token失败"}
        
        # 调用微信客服消息API
        import requests
        url = f"https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token={access_token}"
        print(f"准备发送微信消息到用户: {wechat_open_id}")
        
        response = requests.post(
            url,
            headers={"Content-Type": "application/json"},
            json={
                "touser": wechat_open_id,
                "msgtype": "text",
                "text": {"content": message}
            },
            timeout=10
        )
        
        data = response.json()
        
        if data.get('errcode') == 0:
            print(f"微信消息发送成功，用户: {wechat_open_id}")
            return {
                "wechatOpenId": wechat_open_id,
                "messageLength": len(message),
                "success": True,
                "timestamp": time.strftime('%Y-%m-%dT%H:%M:%S')
            }
        else:
            print(f"发送微信消息失败: errcode={data.get('errcode')}, errmsg={data.get('errmsg')}")
            return {
                "wechatOpenId": wechat_open_id,
                "success": False,
                "message": f"微信API错误: {data.get('errmsg', '未知错误')}",
                "errcode": data.get('errcode'),
                "timestamp": time.strftime('%Y-%m-%dT%H:%M:%S')
            }
    except Exception as e:
        print(f"发送微信消息时发生异常: {e}")
        return {
            "wechatOpenId": wechat_open_id,
            "success": False,
            "message": str(e) or "发送失败",
            "timestamp": time.strftime('%Y-%m-%dT%H:%M:%S')
        }
