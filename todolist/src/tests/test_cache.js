const { cacheManager } = require('../server/utils/cacheUtil');
const fs = require('fs');
const path = require('path');

// 创建测试命名空间
cacheManager.createNamespace('test', {
  cacheDir: path.join(__dirname, '../../data/cache'),
  cachePrefix: 'test_',
  ttl: 10000, // 10秒
  extension: 'json',
  useMemoryCache: true,
  useFileCache: true
});

/**
 * 测试缓存功能
 */
async function testCache() {
  try {
    const testKey = 'test_data';
    const testValue = { name: '测试数据', timestamp: new Date().toISOString() };
    
    console.log('=== 开始缓存测试 ===');
    
    // 测试1: 写入缓存
    console.log('测试1: 写入缓存...');
    cacheManager.set(testKey, testValue, 'test');
    console.log('缓存写入完成');
    
    // 测试2: 读取缓存
    console.log('测试2: 读取缓存...');
    const cachedData = cacheManager.get(testKey, 'test');
    console.log('读取到的缓存数据:', cachedData);
    
    // 测试3: 验证数据一致性
    console.log('测试3: 验证数据一致性...');
    if (cachedData && cachedData.name === testValue.name) {
      console.log('✓ 数据一致性验证通过');
    } else {
      console.error('✗ 数据一致性验证失败');
    }
    
    // 测试4: 使用fetch方法
    console.log('测试4: 使用fetch方法...');
    const fetchResult = await cacheManager.fetch(testKey, async () => {
      console.log('缓存未命中，执行回调');
      return testValue;
    }, 'test');
    console.log('fetch结果:', fetchResult);
    
    // 测试5: 清除缓存
    console.log('测试5: 清除缓存...');
    cacheManager.delete(testKey, 'test');
    
    // 验证缓存已清除
    const deletedData = cacheManager.get(testKey, 'test');
    if (deletedData === null) {
      console.log('✓ 缓存清除验证通过');
    } else {
      console.error('✗ 缓存清除验证失败');
    }
    
    // 测试6: 验证缓存统计
    console.log('测试6: 验证缓存统计...');
    console.log('缓存统计信息:', cacheManager.getStats());
    
    console.log('=== 缓存测试完成 ===');
  } catch (error) {
    console.error('测试过程中发生错误:', error);
  }
}

// 运行测试
testCache().catch(console.error);