const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// 测试配置
const CONFIG = {
  BASE_URL: 'http://localhost:3000/api/holiday',
  CACHE_DIR: path.join(__dirname, 'data/cache'),
  CACHE_KEY: 'holiday_cache.json',
  TEST_INTERVAL: 1000 // 测试间隔（毫秒）
};

/**
 * 发送HTTP请求的通用函数
 */
async function sendRequest(endpoint, options = {}) {
  const url = `${CONFIG.BASE_URL}${endpoint}`;
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    const data = await response.json();
    return {
      status: response.status,
      data
    };
  } catch (error) {
    console.error(`请求 ${url} 失败:`, error.message);
    return {
      status: 500,
      error: error.message
    };
  }
}

/**
 * 强制缓存过期（通过修改缓存文件的时间戳）
 */
function forceCacheExpiration() {
  try {
    const cacheFile = path.join(CONFIG.CACHE_DIR, CONFIG.CACHE_KEY);
    
    if (fs.existsSync(cacheFile)) {
      // 读取缓存文件
      const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      
      // 修改时间戳为非常早的时间，确保过期
      cachedData.timestamp = Date.now() - 365 * 24 * 60 * 60 * 1000; // 1年前
      
      // 写回文件
      fs.writeFileSync(cacheFile, JSON.stringify(cachedData), 'utf8');
      console.log('✓ 已强制缓存过期');
      return true;
    } else {
      console.log('缓存文件不存在');
      return false;
    }
  } catch (error) {
    console.error('强制缓存过期失败:', error.message);
    return false;
  }
}

/**
 * 测试正常的缓存获取
 */
async function testNormalCache() {
  console.log('\n=== 测试1: 正常缓存获取 ===');
  
  // 首先刷新缓存以确保有有效缓存
  console.log('刷新节假日缓存...');
  const refreshResult = await sendRequest('/refresh-cache', {
    method: 'POST',
    body: JSON.stringify({})
  });
  
  if (refreshResult.status === 200) {
    console.log('✓ 缓存刷新成功');
    
    // 然后获取缓存，应该从缓存中获取
    await new Promise(resolve => setTimeout(resolve, CONFIG.TEST_INTERVAL));
    const cacheResult = await sendRequest('/cache');
    
    console.log('缓存获取结果状态码:', cacheResult.status);
    if (cacheResult.status === 200) {
      console.log('✓ 缓存获取成功');
      console.log('响应格式包含必要字段:', 
        'data' in cacheResult.data && 
        'timestamp' in cacheResult.data && 
        'expireAt' in cacheResult.data);
      
      // 检查数据内容
      const hasYearsData = cacheResult.data.data && 
        (cacheResult.data.data.Years || 
         Object.keys(cacheResult.data.data).some(key => !isNaN(parseInt(key))));
      console.log('数据包含年份信息:', hasYearsData);
      
      return true;
    }
  }
  
  return false;
}

/**
 * 测试过期缓存作为兜底
 */
async function testExpiredCacheFallback() {
  console.log('\n=== 测试2: 过期缓存作为兜底 ===');
  
  // 确保有缓存数据
  let hasCache = fs.existsSync(path.join(CONFIG.CACHE_DIR, CONFIG.CACHE_KEY));
  
  if (!hasCache) {
    console.log('没有现有缓存，先刷新缓存...');
    const refreshResult = await sendRequest('/refresh-cache', {
      method: 'POST',
      body: JSON.stringify({})
    });
    
    if (refreshResult.status !== 200) {
      console.log('无法创建初始缓存，跳过测试');
      return false;
    }
    
    await new Promise(resolve => setTimeout(resolve, CONFIG.TEST_INTERVAL));
  }
  
  // 强制缓存过期
  const expired = forceCacheExpiration();
  if (!expired) {
    console.log('无法强制缓存过期，跳过测试');
    return false;
  }
  
  // 使用无效的API地址来模拟获取新数据失败
  console.log('使用无效API地址测试过期缓存兜底...');
  const fallbackResult = await sendRequest('/refresh-cache', {
    method: 'POST',
    body: JSON.stringify({
      apiUrl: 'http://invalid-api-address-for-testing.com'
    })
  });
  
  console.log('兜底测试结果状态码:', fallbackResult.status);
  
  // 即使刷新失败，直接获取缓存应该返回过期缓存作为兜底
  const cacheResult = await sendRequest('/cache');
  console.log('从缓存获取结果状态码:', cacheResult.status);
  
  if (cacheResult.status === 200) {
    console.log('✓ 成功获取过期缓存作为兜底');
    console.log('响应格式包含必要字段:', 
      'data' in cacheResult.data && 
      'timestamp' in cacheResult.data && 
      'expireAt' in cacheResult.data);
    
    // 检查数据内容
    const hasYearsData = cacheResult.data.data && 
      (cacheResult.data.data.Years || 
       Object.keys(cacheResult.data.data).some(key => !isNaN(parseInt(key))));
    console.log('数据包含年份信息:', hasYearsData);
    
    return true;
  }
  
  return false;
}

/**
 * 运行所有测试
 */
async function runTests() {
  console.log('开始测试节假日缓存功能...');
  
  // 测试1: 正常缓存获取
  const test1Result = await testNormalCache();
  
  // 测试2: 过期缓存作为兜底
  const test2Result = await testExpiredCacheFallback();
  
  console.log('\n=== 测试总结 ===');
  console.log('测试1 - 正常缓存获取:', test1Result ? '✓ 通过' : '✗ 失败');
  console.log('测试2 - 过期缓存兜底:', test2Result ? '✓ 通过' : '✗ 失败');
  
  const allPassed = test1Result && test2Result;
  console.log('\n整体测试结果:', allPassed ? '✓ 全部通过' : '✗ 部分失败');
  
  return allPassed;
}

// 运行测试
runTests().catch(err => {
  console.error('测试过程中发生错误:', err);
});