const { cacheManager } = require('./src/server/utils/cacheUtil');

/**
 * 测试永不过期缓存功能
 */
async function testPermanentCache() {
    console.log('开始测试永不过期缓存功能...');

    try {
        // 测试1: 设置ttl=0的永不过期缓存
        console.log('\n测试1: 设置和获取永不过期缓存');
        const permanentKey = 'permanent:test:key';
        const permanentData = { value: '这是永不过期的数据' };
        
        // 设置永不过期缓存
        cacheManager.set(permanentKey, permanentData, { ttl: 0 });
        console.log('已设置永不过期缓存');
        
        // 获取缓存
        const retrievedData = cacheManager.get(permanentKey, { ttl: 0 });
        console.log('获取到的永不过期缓存:', JSON.stringify(retrievedData, null, 2));
        
        // 验证数据是否一致
        if (retrievedData && JSON.stringify(retrievedData.data) === JSON.stringify(permanentData)) {
            console.log('✓ 永不过期缓存设置和获取成功');
        } else {
            console.error('✗ 永不过期缓存数据不匹配');
        }

        // 测试2: 模拟时间流逝，验证永不过期缓存仍然有效
        console.log('\n测试2: 模拟时间流逝后验证永不过期缓存');
        
        // 模拟等待（实际环境中可以等待更长时间）
        console.log('模拟等待1秒...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 再次获取缓存
        const afterWaitData = cacheManager.get(permanentKey, { ttl: 0 });
        console.log('时间流逝后获取到的永不过期缓存:', JSON.stringify(afterWaitData, null, 2));
        
        if (afterWaitData && afterWaitData.data && !afterWaitData.expired) {
            console.log('✓ 永不过期缓存时间流逝后仍然有效');
        } else {
            console.error('✗ 永不过期缓存时间流逝后无效或标记为过期');
        }

        // 测试3: 对比有过期时间和永不过期的缓存
        console.log('\n测试3: 对比有过期时间和永不过期的缓存');
        
        // 设置一个短期过期的缓存
        const expireKey = 'temporary:test:key';
        const expireData = { value: '这是1秒后过期的数据' };
        cacheManager.set(expireKey, expireData, { ttl: 1000 }); // 1秒后过期
        console.log('已设置短期过期缓存');
        
        // 设置永不过期缓存（再次确认）
        cacheManager.set(permanentKey, permanentData, { ttl: 0 });
        
        // 等待2秒让短期缓存过期
        console.log('等待2秒让短期缓存过期...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 获取两个缓存
        const tempData = cacheManager.get(expireKey, { ttl: 1000 });
        const permData = cacheManager.get(permanentKey, { ttl: 0 });
        
        console.log('短期缓存状态:', tempData ? '存在' : '已过期并删除');
        console.log('永不过期缓存状态:', permData ? '存在' : '已过期并删除');
        
        if (tempData === null && permData !== null) {
            console.log('✓ 对比测试成功: 短期缓存已过期，永不过期缓存仍然有效');
        } else {
            console.error('✗ 对比测试失败: 缓存行为不符合预期');
        }

        // 测试4: 使用fetch方法测试永不过期缓存
        console.log('\n测试4: 使用fetch方法测试永不过期缓存');
        
        let fetchCount = 0;
        const fetchKey = 'fetch:permanent:key';
        
        const fetchResult = await cacheManager.fetch(
            fetchKey, 
            async () => {
                fetchCount++;
                console.log('执行数据获取函数（第', fetchCount, '次）');
                return { value: 'fetch获取的数据' };
            },
            { ttl: 0 }, // 永不过期
            true // 返回原始数据
        );
        
        console.log('第一次fetch结果:', fetchResult);
        
        // 再次调用fetch，应该从缓存获取，不执行函数
        const secondFetchResult = await cacheManager.fetch(
            fetchKey, 
            async () => {
                fetchCount++;
                console.log('执行数据获取函数（第', fetchCount, '次）');
                return { value: '不应该看到这个' };
            },
            { ttl: 0 },
            true
        );
        
        console.log('第二次fetch结果:', secondFetchResult);
        
        if (fetchCount === 1 && JSON.stringify(fetchResult) === JSON.stringify(secondFetchResult)) {
            console.log('✓ fetch方法永不过期缓存测试成功');
        } else {
            console.error('✗ fetch方法永不过期缓存测试失败');
        }

        // 测试5: 使用命名空间测试永不过期缓存
        console.log('\n测试5: 使用命名空间测试永不过期缓存');
        
        // 创建一个默认永不过期的命名空间
        cacheManager.createNamespace('permanentNamespace', { ttl: 0 });
        
        const namespaceKey = 'test:namespace:key';
        const namespaceData = { value: '命名空间中的永不过期数据' };
        
        // 使用命名空间设置缓存
        cacheManager.set(namespaceKey, namespaceData, 'permanentNamespace');
        console.log('已在命名空间中设置永不过期缓存');
        
        // 获取缓存
        const nsData = cacheManager.get(namespaceKey, 'permanentNamespace');
        console.log('从命名空间获取的永不过期缓存:', JSON.stringify(nsData, null, 2));
        
        if (nsData && JSON.stringify(nsData.data) === JSON.stringify(namespaceData)) {
            console.log('✓ 命名空间永不过期缓存测试成功');
        } else {
            console.error('✗ 命名空间永不过期缓存测试失败');
        }

        console.log('\n🎉 所有测试完成！');
        return true;

    } catch (error) {
        console.error('❌ 测试过程中出错:', error);
        return false;
    }
}

// 运行测试
if (require.main === module) {
    testPermanentCache();
}

module.exports = { testPermanentCache };