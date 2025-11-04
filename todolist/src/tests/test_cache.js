const { handleCache } = require('../server/utils/cacheUtil');
const fs = require('fs');
const path = require('path');

// 测试函数
async function testCache() {
    console.log('开始测试缓存工具...');
    const cacheFilePrefix = 'test_'
    
    // 基本配置 - 只使用内存缓存进行测试
    const options = {
        cacheDir: null, // 暂时不使用文件缓存
        cachePrefix: cacheFilePrefix,
        ttl: 3600000, // 1小时
        extension: 'json',
        useMemoryCache: true
    };
    
    // 清除可能存在的测试缓存文件（仅删除带 test_ 前缀的文件）
    try {
        const cacheDir = path.join(__dirname, '../../data/cache');
        if (fs.existsSync(cacheDir)) {
            const files = fs.readdirSync(cacheDir);
            files.forEach(file => {
                if (file.startsWith(cacheFilePrefix)) {
                    fs.unlinkSync(path.join(cacheDir, file));
                }
            });
        }
    } catch (e) {
        // 忽略错误
    }
    
    // 测试1: 写入和读取单个缓存项
    console.log('\n测试1: 写入和读取单个缓存项');
    const testData = { name: '测试数据', value: 123 };
    handleCache('test_key_1', testData, options);
    const result1 = handleCache('test_key_1', null, options);
    console.log('读取结果:', result1?.data);
    console.log('是否成功读取:', result1 && JSON.stringify(result1.data) === JSON.stringify(testData));
    
    // 测试2: 测试LRU功能 - 添加超过50个键，验证最早的键被淘汰
    console.log('\n测试2: 测试LRU淘汰机制');
    // 先添加50个键，填满缓存
    for (let i = 0; i < 50; i++) {
        handleCache(`test_key_${i}`, { index: i }, options);
    }
    
    // 验证所有50个键都存在
    console.log('验证初始50个键都存在:');
    let allExist = true;
    for (let i = 0; i < 50; i++) {
        const exists = handleCache(`test_key_${i}`, null, options) !== null;
        if (!exists) {
            console.log(`  错误: test_key_${i} 不存在`);
            allExist = false;
        }
    }
    console.log('  结果:', allExist ? '所有键都存在' : '有键不存在');
    
    // 添加5个新键，应该淘汰最早的5个
    console.log('\n添加5个新键，应该淘汰最早的5个:');
    for (let i = 50; i < 55; i++) {
        handleCache(`test_key_${i}`, { index: i }, options);
    }
    
    // 检查最早的5个键是否已被淘汰
    console.log('检查最早的5个键是否已被淘汰:');
    let evictionCount = 0;
    for (let i = 0; i < 10; i++) {
        const exists = handleCache(`test_key_${i}`, null, options) !== null;
        console.log(`  test_key_${i} 是否存在:`, exists);
        if (!exists) {
            evictionCount++;
        }
    }
    console.log('淘汰的键数量:', evictionCount);
    console.log('预期结果: 最早的5个键应该被淘汰');
    
    // 测试3: 测试更新已存在的键，验证其位置被刷新
    console.log('\n测试3: 测试更新已存在的键');
    // 访问 test_key_45，将其移到最近使用位置
    handleCache('test_key_45', null, options);
    // 添加5个新键，应该淘汰除了test_key_45以外的最早的键
    console.log('添加5个新键，test_key_45应该保留:');
    for (let i = 55; i < 60; i++) {
        handleCache(`test_key_${i}`, { index: i }, options);
    }
    
    // 检查 test_key_45 是否仍然存在
    const result45 = handleCache('test_key_45', null, options);
    console.log('test_key_45 是否存在:', result45 !== null);
    if (result45) {
        console.log('test_key_45 数据:', result45.data);
    }
    
    console.log('\n测试完成!');
}

// 运行测试
testCache().catch(console.error);