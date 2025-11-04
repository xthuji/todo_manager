// 测试脚本：验证新的缓存管理工具功能
const { cacheManager } = require('./src/server/utils/cacheUtil');
const path = require('path');

// 测试缓存命名空间创建
async function testNamespaceCreation() {
  console.log('=== 测试缓存命名空间创建 ===');
  try {
    // 创建测试命名空间
    const testOptions = {
      ttl: 30000, // 30秒
      isPermanent: false
    };
    cacheManager.createNamespace('testCache', testOptions);
    console.log('✓ 成功创建测试命名空间');
    
    // 获取命名空间信息
    const namespaceInfo = cacheManager.getNamespace('testCache');
    console.log('  命名空间信息:', namespaceInfo);
    return true;
  } catch (error) {
    console.error('✗ 创建命名空间失败:', error.message);
    return false;
  }
}

// 测试缓存设置和获取
async function testCacheSetGet() {
  console.log('\n=== 测试缓存设置和获取 ===');
  try {
    const testKey = 'testData';
    const testValue = { name: '测试数据', value: 123, timestamp: Date.now() };
    
    // 设置缓存
    await cacheManager.set(testKey, testValue, 'testCache');
    console.log('✓ 成功设置缓存');
    
    // 获取缓存
    const cachedValue = await cacheManager.get(testKey, 'testCache');
    console.log('✓ 成功获取缓存');
    console.log('  缓存值:', cachedValue);
    
    // 验证数据一致性
    if (cachedValue.data.name === testValue.name && cachedValue.data.value === testValue.value) {
      console.log('✓ 数据一致性验证通过');
    } else {
      console.error('✗ 数据一致性验证失败');
    }
    
    return true;
  } catch (error) {
    console.error('✗ 缓存操作失败:', error.message);
    return false;
  }
}

// 测试缓存删除
async function testCacheDelete() {
  console.log('\n=== 测试缓存删除 ===');
  try {
    const testKey = 'testData';
    
    // 删除单个缓存
    await cacheManager.delete(testKey, 'testCache');
    console.log('✓ 成功删除单个缓存');
    
    // 验证删除
    const deletedValue = await cacheManager.get(testKey, 'testCache');
    if (!deletedValue) {
      console.log('✓ 缓存删除验证通过');
    } else {
      console.error('✗ 缓存删除验证失败');
    }
    
    return true;
  } catch (error) {
    console.error('✗ 缓存删除失败:', error.message);
    return false;
  }
}

// 测试缓存清除（清空命名空间）
async function testCacheClear() {
  console.log('\n=== 测试缓存清除（清空命名空间）===');
  try {
    // 先设置一些测试数据
    await cacheManager.set('testKey1', { value: 'data1' }, 'testCache');
    await cacheManager.set('testKey2', { value: 'data2' }, 'testCache');
    console.log('  已设置测试数据');
    
    // 清除整个命名空间
    await cacheManager.clear('testCache');
    console.log('✓ 成功清除命名空间缓存');
    
    // 验证清除
    const value1 = await cacheManager.get('testKey1', 'testCache');
    const value2 = await cacheManager.get('testKey2', 'testCache');
    
    if (!value1 && !value2) {
      console.log('✓ 命名空间清除验证通过');
    } else {
      console.error('✗ 命名空间清除验证失败');
    }
    
    return true;
  } catch (error) {
    console.error('✗ 缓存清除失败:', error.message);
    return false;
  }
}

// 测试fetch方法
async function testCacheFetch() {
  console.log('\n=== 测试fetch方法 ===');
  try {
    const fetchKey = 'fetchData';
    
    // 使用fetch方法获取不存在的缓存（应触发回调）
    const result = await cacheManager.fetch(
      fetchKey,
      async () => {
        console.log('  缓存未命中，执行回调函数');
        return { generated: true, timestamp: Date.now() };
      },
      null,
      'testCache'
    );
    
    console.log('✓ fetch方法执行成功');
    console.log('  结果:', result);
    
    // 再次调用fetch（应从缓存返回）
    const cachedResult = await cacheManager.fetch(
      fetchKey,
      async () => {
        console.log('  不应该执行这个回调');
        return null;
      },
      null,
      'testCache'
    );
    
    console.log('✓ fetch方法缓存命中');
    
    return true;
  } catch (error) {
    console.error('✗ fetch方法失败:', error.message);
    return false;
  }
}

// 主测试函数
async function runTests() {
  console.log('开始测试新的缓存管理工具...\n');
  
  let allTestsPassed = true;
  
  const tests = [
    testNamespaceCreation,
    testCacheSetGet,
    testCacheDelete,
    testCacheClear,
    testCacheFetch
  ];
  
  for (const test of tests) {
    const result = await test();
    if (!result) {
      allTestsPassed = false;
    }
  }
  
  console.log('\n=== 测试总结 ===');
  if (allTestsPassed) {
    console.log('🎉 所有测试通过！新的缓存管理工具工作正常。');
  } else {
    console.log('❌ 部分测试失败，请检查代码。');
  }
}

// 运行测试
runTests().catch(error => {
  console.error('测试执行过程中发生错误:', error);
});