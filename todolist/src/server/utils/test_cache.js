// 正确导入CacheUtil类
const { CacheUtil } = require('./cacheUtil');
const fs = require('fs');
const path = require('path');

// 创建测试目录
const testDir = path.join(__dirname, 'test_cache');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir);
}

const cacheTest = async () => {
  console.log('开始测试缓存工具...');
  
  // 创建缓存实例
  const cache = new CacheUtil(testDir, { defaultTTL: 1000 });
  
  // 测试1: 测试同步函数
  console.log('\n测试1: 测试同步函数');
  try {
    // 设置缓存
    const key = 'test_sync_key';
    const data = { test: 'data', timestamp: Date.now() };
    await cache.setData(key, data, { ttl: 5000 });
    
    // 同步获取
    const wrappedData = cache.getWrappedData(key);
    console.log('同步获取结果:', wrappedData ? wrappedData.data : null);
    
    const simpleData = cache.getData(key);
    console.log('同步获取简单数据:', simpleData);
  } catch (error) {
    console.error('同步函数测试失败:', error);
  }
  
  // 测试2: 测试异步函数调用同步函数
  console.log('\n测试2: 测试异步函数调用同步函数');
  try {
    const key = 'test_async_key';
    const data = { async: 'test', time: Date.now() };
    await cache.setData(key, data);
    
    const wrappedAsyncData = await cache.getWrappedDataAsync(key);
    console.log('异步获取包装数据:', wrappedAsyncData ? wrappedAsyncData.data : null);
    
    const simpleAsyncData = await cache.getDataAsync(key);
    console.log('异步获取简单数据:', simpleAsyncData);
  } catch (error) {
    console.error('异步函数测试失败:', error);
  }
  
  // 测试3: 测试源文件加载
  console.log('\n测试3: 测试源文件加载');
  try {
    const sourceFilePath = path.join(testDir, 'source_test.json');
    const sourceData = {
      data: { source: 'test data', number: 123 },
      timestamp: Date.now(),
      ttl: 10000
    };
    fs.writeFileSync(sourceFilePath, JSON.stringify(sourceData));
    
    const sourceKey = 'test_source_key';
    const sourceResult = await cache.getWrappedDataAsync(sourceKey, { sourceFile: sourceFilePath });
    console.log('从源文件加载结果:', sourceResult ? sourceResult.data : null);
  } catch (error) {
    console.error('源文件加载测试失败:', error);
  }
  
  // 测试4: 测试默认缓存文件加载
  console.log('\n测试4: 测试默认缓存文件加载');
  try {
    // 设置后应该有默认缓存文件
    const defaultKey = 'test_default_key';
    const defaultData = { default: 'data' };
    await cache.setData(defaultKey, defaultData);
    
    // 清除内存缓存
    cache.memoryCache.clear();
    
    // 从默认文件加载
    const defaultResult = await cache.getWrappedDataAsync(defaultKey);
    console.log('从默认缓存文件加载结果:', defaultResult ? defaultResult.data : null);
  } catch (error) {
    console.error('默认缓存文件加载测试失败:', error);
  }
  
  console.log('\n测试完成!');
};

cacheTest().catch(err => {
  console.error('测试过程中出现错误:', err);
  process.exit(1);
});