const { getAllAreaCodes } = require('./src/server/service/locationAreaService');
const { cacheManager } = require('./src/server/utils/cacheUtil');

async function testAreaCodesCache() {
    console.log('开始测试省市县编码数据缓存功能...');
    
    try {
        // 先清除可能存在的缓存，确保测试的准确性
        console.log('清除现有缓存...');
        cacheManager.delete('all_area_codes', 'areaCodes');
        
        // 第一次调用 - 应该从文件加载并设置缓存
        console.log('\n第一次调用getAllAreaCodes():');
        const result1 = await getAllAreaCodes();
        console.log(`返回数据类型: ${typeof result1}`);
        console.log(`数据结构: ${JSON.stringify(Object.keys(result1))}`);
        console.log(`数据条数: ${result1.data ? result1.data.length : '无效数据'}`);
        
        // 检查缓存是否已设置
        console.log('\n检查缓存状态:');
        const cachedData = cacheManager.get('all_area_codes', 'areaCodes');
        console.log(`缓存数据是否存在: ${cachedData !== null}`);
        if (cachedData) {
            console.log(`缓存数据包含timestamp: ${!!cachedData.timestamp}`);
            console.log(`缓存数据包含data: ${!!cachedData.data}`);
        }
        
        // 第二次调用 - 应该从缓存获取
        console.log('\n第二次调用getAllAreaCodes():');
        const result2 = await getAllAreaCodes();
        console.log(`是否从缓存获取: ${result1.timestamp === result2.timestamp}`);
        
        // 验证数据完整性
        console.log('\n验证数据完整性:');
        if (result2.data && result2.data.length > 0) {
            const firstProvince = result2.data[0];
            console.log(`第一个省份: ${firstProvince.name || '未命名'}`);
            if (firstProvince.children && firstProvince.children.length > 0) {
                console.log(`  包含城市数量: ${firstProvince.children.length}`);
            }
        }
        
        // 验证命名空间配置
        console.log('\n验证命名空间配置:');
        const namespaceOptions = cacheManager.getNamespaceOptions('areaCodes');
        console.log(`命名空间存在: ${!!namespaceOptions}`);
        if (namespaceOptions) {
            console.log(`TTL设置: ${namespaceOptions.ttl}`);
            console.log(`是否使用文件缓存: ${namespaceOptions.useFileCache}`);
        }
        
        console.log('\n🎉 测试成功完成！');
        return true;
    } catch (error) {
        console.error('\n❌ 测试失败:', error);
        return false;
    }
}

// 运行测试
testAreaCodesCache().then(success => {
    process.exit(success ? 0 : 1);
});