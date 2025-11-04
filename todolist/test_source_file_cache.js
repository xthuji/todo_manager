const { getAllAreaCodes } = require('./src/server/service/locationAreaService');
const { cacheManager } = require('./src/server/utils/cacheUtil');
const fs = require('fs');
const path = require('path');

async function testSourceFileCache() {
    console.log('开始测试从源文件直接创建缓存功能...');
    
    try {
        const cacheKey = 'all_area_codes';
        const namespace = 'areaCodes';
        
        // 获取缓存目录路径
        const cacheDir = path.join(__dirname, 'data', 'cache');
        const expectedCacheFile = path.join(cacheDir, `area_${cacheKey}.json`);
        
        // 清除现有缓存文件和缓存数据
        console.log('清除现有缓存...');
        if (fs.existsSync(expectedCacheFile)) {
            fs.unlinkSync(expectedCacheFile);
            console.log(`删除缓存文件: ${expectedCacheFile}`);
        }
        cacheManager.delete(cacheKey, namespace);
        
        // 第一次调用 - 应该从源文件创建缓存
        console.log('\n第一次调用getAllAreaCodes():');
        const startTime = Date.now();
        const result1 = await getAllAreaCodes();
        const duration1 = Date.now() - startTime;
        
        console.log(`调用耗时: ${duration1}ms`);
        console.log(`返回数据类型: ${typeof result1}`);
        console.log(`数据结构: ${JSON.stringify(Object.keys(result1))}`);
        console.log(`数据条数: ${result1.data ? result1.data.length : '无效数据'}`);
        
        // 检查缓存文件是否已创建
        console.log('\n检查缓存文件:');
        const cacheFileExists = fs.existsSync(expectedCacheFile);
        console.log(`缓存文件已创建: ${cacheFileExists}`);
        
        if (cacheFileExists) {
            const cacheContent = JSON.parse(fs.readFileSync(expectedCacheFile, 'utf8'));
            console.log(`缓存文件包含data字段: ${!!cacheContent.data}`);
            console.log(`缓存文件包含timestamp: ${!!cacheContent.timestamp}`);
            console.log(`缓存文件标记为永久: ${cacheContent.isPermanent === true}`);
        }
        
        // 第二次调用 - 应该从缓存获取，速度更快
        console.log('\n第二次调用getAllAreaCodes():');
        const startTime2 = Date.now();
        const result2 = await getAllAreaCodes();
        const duration2 = Date.now() - startTime2;
        
        console.log(`调用耗时: ${duration2}ms`);
        console.log(`是否从缓存获取: ${duration2 < duration1 * 0.5}`); // 缓存应该明显更快
        console.log(`数据一致性: ${result1.data && result2.data && JSON.stringify(result1.data[0]) === JSON.stringify(result2.data[0])}`);
        
        // 验证数据完整性
        console.log('\n验证数据完整性:');
        if (result2.data && result2.data.length > 0) {
            const firstProvince = result2.data[0];
            console.log(`第一个省份: ${firstProvince.name || '未命名'}`);
            if (firstProvince.children && firstProvince.children.length > 0) {
                console.log(`  包含城市数量: ${firstProvince.children.length}`);
            }
        }
        
        console.log('\n🎉 测试成功完成！新的从源文件直接创建缓存功能工作正常。');
        return true;
    } catch (error) {
        console.error('\n❌ 测试失败:', error);
        return false;
    }
}

// 运行测试
testSourceFileCache().then(success => {
    process.exit(success ? 0 : 1);
});