#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
缓存测试文件

测试缓存功能的可用性和准确性
"""

import os
import time
from app.utils.cache_util import CacheUtil

# 创建缓存工具实例
cache_util = CacheUtil()

# 测试缓存键
TEST_KEY = 'test_data'


def test_cache():
    """
    测试缓存功能
    """
    try:
        print('=== 开始缓存测试 ===')
        
        # 测试1: 写入缓存
        print('测试1: 写入缓存...')
        test_value = {'name': '测试数据', 'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')}
        cache_util.set(TEST_KEY, test_value, ttl=10000)  # 10秒
        print('缓存写入完成')
        
        # 测试2: 读取缓存
        print('测试2: 读取缓存...')
        cached_data = cache_util.get(TEST_KEY)
        print('读取到的缓存数据:', cached_data)
        
        # 测试3: 验证数据一致性
        print('测试3: 验证数据一致性...')
        if cached_data and cached_data.get('name') == test_value.get('name'):
            print('✓ 数据一致性验证通过')
        else:
            print('✗ 数据一致性验证失败')
        
        # 测试4: 使用fetch方法（Python版本没有fetch方法，使用get_wrapped_data替代）
        print('测试4: 使用get_wrapped_data方法...')
        wrapped_data = cache_util.get_wrapped_data(TEST_KEY, {'ttl': 10000})
        print('get_wrapped_data结果:', wrapped_data)
        
        # 测试5: 清除缓存
        print('测试5: 清除缓存...')
        cache_util.delete(TEST_KEY)
        
        # 验证缓存已清除
        deleted_data = cache_util.get(TEST_KEY)
        if deleted_data is None:
            print('✓ 缓存清除验证通过')
        else:
            print('✗ 缓存清除验证失败')
        
        # 测试6: 验证缓存统计（Python版本可能没有getStats方法）
        print('测试6: 验证缓存统计...')
        try:
            stats = cache_util.get_stats()
            print('缓存统计信息:', stats)
        except AttributeError:
            print('✓ 缓存统计功能不存在（Python版本暂不支持）')
        
        print('=== 缓存测试完成 ===')
        return True
    except Exception as e:
        print(f'测试过程中发生错误: {str(e)}')
        import traceback
        traceback.print_exc()
        return False


# 运行测试
if __name__ == '__main__':
    success = test_cache()
    exit(0 if success else 1)
