const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '../../../');
// 读取源文件
const tianqiCityPath = path.join(BASE_DIR, 'todolist/data/weather/tianqi_city.json');
const outputPath = path.join(BASE_DIR, 'todolist/data/weather/tianqi_area_codes.json');

try {
    console.log('正在读取源文件...');
    // 读取源文件内容
    const tianqiCityData = JSON.parse(fs.readFileSync(tianqiCityPath, 'utf8'));
    
    // 创建结果对象
    const result = {
        timestamp: Date.now(),
        data: []
    };
    
    console.log('开始转换数据结构...');
    
    // 转换省级数据
    Object.keys(tianqiCityData).forEach(provinceName => {
        const provinceObj = tianqiCityData[provinceName];
        
        // 创建省级节点（不设置code，因为只有叶子节点需要设置）
        const provinceNode = {
            name: provinceName,
            children: []
        };
        
        // 转换市级数据
        Object.keys(provinceObj).forEach(cityName => {
            const cityObj = provinceObj[cityName];
            
            // 创建市级节点（不设置code）
            const cityNode = {
                name: cityName,
                children: []
            };
            
            // 转换区县级数据（叶子节点，需要设置code）
            Object.keys(cityObj).forEach(districtName => {
                const districtInfo = cityObj[districtName];
                
                // 创建区县级节点（叶子节点，设置code）
                const districtNode = {
                    name: districtName,
                    code: districtInfo.AREAID
                };
                
                cityNode.children.push(districtNode);
            });
            
            // 只有当城市有区县时才添加
            if (cityNode.children.length > 0) {
                provinceNode.children.push(cityNode);
            }
        });
        
        // 只有当省份有城市时才添加
        if (provinceNode.children.length > 0) {
            result.data.push(provinceNode);
        }
    });
    
    console.log('数据转换完成，正在写入文件...');
    
    // 写入结果到新文件
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
    
    console.log(`转换成功！新文件已保存至：${outputPath}`);
    console.log(`转换数据统计：`);
    console.log(`- 省份数量：${result.data.length}`);
    
    // 统计城市和区县数量
    let cityCount = 0;
    let districtCount = 0;
    
    result.data.forEach(province => {
        cityCount += province.children.length;
        province.children.forEach(city => {
            districtCount += city.children.length;
        });
    });
    
    console.log(`- 城市数量：${cityCount}`);
    console.log(`- 区县数量：${districtCount}`);
    
} catch (error) {
    console.error('转换过程中发生错误：', error.message);
    process.exit(1);
}