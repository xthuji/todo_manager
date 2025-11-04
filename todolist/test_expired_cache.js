const { cacheManager } = require('./src/server/utils/cacheUtil');

// 直接使用导入的缓存管理器实例

async function testExpiredCache() {
    console.log('开始测试过期缓存作为兜底功能...');
    
    // 测试1：基本的过期缓存获取功能
    console.log('\n=== 测试1: 基本的过期缓存获取 ===');
    const testKey = 'test_expired_key';
    const testData = { name: '测试数据', value: 123 };
    
    // 设置短期缓存（2秒过期）
    console.log('设置2秒后过期的缓存...');
    cacheManager.set(testKey, testData, { ttl: 2000 });
    
    // 立即获取（应该返回有效数据）
    const beforeExpire = cacheManager.get(testKey);
    console.log('过期前获取:', beforeExpire);
    
    // 等待3秒让缓存过期
    console.log('等待3秒让缓存过期...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 过期后默认获取（不允许过期缓存）
    const afterExpire = cacheManager.get(testKey);
    console.log('过期后默认获取(allowExpired=false):', afterExpire);
    
    // 过期后允许获取过期缓存
    const expiredCache = cacheManager.get(testKey, null, false, true);
    console.log('过期后允许获取(allowExpired=true):', expiredCache);
    console.log('是否包含过期标记:', expiredCache && expiredCache.expired === true);
    
    // 测试2：测试fetch方法中的兜底功能
    console.log('\n=== 测试2: fetch方法中的兜底功能 ===');
    const testKey2 = 'test_fetch_fallback';
    const fallbackData = { name: '兜底数据', value: 456 };
    
    // 设置过期缓存作为兜底
    console.log('设置2秒后过期的兜底缓存...');
    cacheManager.set(testKey2, fallbackData, { ttl: 2000 });
    
    // 等待3秒让缓存过期
    console.log('等待3秒让缓存过期...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    try {
        // 模拟getDataFn失败的场景，但允许使用过期缓存作为兜底
        console.log('调用fetch方法，模拟getDataFn失败，但允许使用过期缓存作为兜底...');
        const result = await cacheManager.fetch(
            testKey2,
            async () => {
                // 模拟获取新数据失败
                throw new Error('模拟获取新数据失败');
            },
            null,
            false,
            true // 允许使用过期缓存作为兜底
        );
        
        console.log('fetch方法返回的兜底数据:', result);
        console.log('是否为过期的兜底数据:', result && result.expired === true);
    } catch (error) {
        console.error('fetch方法测试失败:', error.message);
    }
    
    // 测试3：测试不允许使用过期缓存时的行为
    console.log('\n=== 测试3: 不允许使用过期缓存时的行为 ===');
    try {
        // 不允许使用过期缓存，应该抛出错误
        console.log('调用fetch方法，模拟getDataFn失败，且不允许使用过期缓存...');
        await cacheManager.fetch(
            testKey2,
            async () => {
                throw new Error('模拟获取新数据失败');
            },
            null,
            false,
            false // 不允许使用过期缓存
        );
    } catch (error) {
        console.log('预期的错误行为:', error.message);
    }
    
    // 测试4：验证统计信息
    console.log('\n=== 测试4: 验证缓存统计信息 ===');
    const stats = cacheManager.getStats();
    console.log('缓存统计信息:', stats);
    console.log('是否包含过期命中统计:', 'expiredHits' in stats);
    
    console.log('\n过期缓存兜底功能测试完成！');
}

// 运行测试
testExpiredCache().catch(err => {
    console.error('测试过程中发生错误:', err);
});