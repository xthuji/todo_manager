const fs = require('fs');
const path = require('path');

// 文件路径
const dataDir = path.join(__dirname, 'todolist', 'data', 'weather');
const mojiCodesPath = path.join(dataDir, 'moji_weather_area_codes.json');
const targetFilePath = path.join(dataDir, 'merged_weather_area_codes_fully_fixed.json');
const outputFilePath = path.join(dataDir, 'merged_weather_area_codes_verified.json');

// 读取文件函数
function readJsonFile(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        console.error(`读取文件失败 ${filePath}:`, error.message);
        return null;
    }
}

// 写入文件函数
function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`文件已保存至 ${filePath}`);
    } catch (error) {
        console.error(`写入文件失败 ${filePath}:`, error.message);
    }
}

// 构建省份到合法地区代码的映射
function buildLegitimateCodeMap(mojiCodesData) {
    const legitimateCodeMap = {};
    
    if (!mojiCodesData || !mojiCodesData.data || !Array.isArray(mojiCodesData.data)) {
        console.error('mojiCodes数据格式错误');
        return legitimateCodeMap;
    }
    
    mojiCodesData.data.forEach(province => {
        if (province && province.name && province.children && Array.isArray(province.children)) {
            const provinceName = province.name;
            legitimateCodeMap[provinceName] = new Set();
            
            // 添加省份自身的代码
            if (province.code) {
                legitimateCodeMap[provinceName].add(province.code);
            }
            
            // 添加省份下所有子地区的代码
            province.children.forEach(child => {
                if (child && child.code) {
                    legitimateCodeMap[provinceName].add(child.code);
                }
            });
        }
    });
    
    return legitimateCodeMap;
}

// 验证并修复mojiCode
function verifyAndFixMojiCodes(targetData, legitimateCodeMap) {
    let totalRegions = 0;
    let validMojiCodes = 0;
    let invalidMojiCodes = 0;
    let nullMojiCodes = 0;
    let fixedMojiCodes = 0;
    
    function processRegion(region, parentProvince) {
        if (!region) return;
        
        totalRegions++;
        const currentProvince = parentProvince || region.name;
        
        // 检查mojiCode是否有效
        if (region.mojiCode === null) {
            nullMojiCodes++;
        } else if (region.mojiCode) {
            // 验证mojiCode是否在对应省份的合法代码列表中
            const provinceLegitimateCodes = legitimateCodeMap[currentProvince];
            if (provinceLegitimateCodes && provinceLegitimateCodes.has(region.mojiCode)) {
                validMojiCodes++;
            } else {
                // 非法mojiCode，设置为null
                region.mojiCode = null;
                invalidMojiCodes++;
                fixedMojiCodes++;
                console.log(`修复非法mojiCode: ${currentProvince} - ${region.name}`);
            }
        }
        
        // 递归处理子地区
        if (region.children && Array.isArray(region.children)) {
            region.children.forEach(child => {
                processRegion(child, currentProvince);
            });
        }
    }
    
    // 处理数据结构中的省份数据
    if (targetData && targetData.data && Array.isArray(targetData.data)) {
        targetData.data.forEach(province => {
            processRegion(province);
        });
    }
    
    return {
        totalRegions,
        validMojiCodes,
        invalidMojiCodes,
        nullMojiCodes,
        fixedMojiCodes
    };
}

// 主函数
function main() {
    console.log('开始验证mojiCode合法性...');
    
    // 读取文件
    const mojiCodesData = readJsonFile(mojiCodesPath);
    const targetData = readJsonFile(targetFilePath);
    
    if (!mojiCodesData) {
        console.error('无法读取moji_weather_area_codes.json文件');
        return;
    }
    
    if (!targetData) {
        console.error('无法读取merged_weather_area_codes_fully_fixed.json文件');
        return;
    }
    
    // 构建合法代码映射
    console.log('构建省份到合法地区代码的映射...');
    const legitimateCodeMap = buildLegitimateCodeMap(mojiCodesData);
    console.log(`成功构建${Object.keys(legitimateCodeMap).length}个省份的合法代码映射`);
    
    // 验证并修复mojiCode
    console.log('开始验证并修复mojiCode...');
    const stats = verifyAndFixMojiCodes(targetData, legitimateCodeMap);
    
    // 写入验证后的文件
    writeJsonFile(outputFilePath, targetData);
    
    // 生成统计摘要
    const summary = {
        totalRegions: stats.totalRegions,
        validMojiCodes: stats.validMojiCodes,
        invalidMojiCodes: stats.invalidMojiCodes,
        nullMojiCodes: stats.nullMojiCodes,
        fixedMojiCodes: stats.fixedMojiCodes,
        timestamp: new Date().toISOString()
    };
    
    console.log('\n验证完成！');
    console.log(`- 总地区数: ${summary.totalRegions}`);
    console.log(`- 有效mojiCode: ${summary.validMojiCodes}`);
    console.log(`- 非法mojiCode: ${summary.invalidMojiCodes}`);
    console.log(`- 原null值mojiCode: ${summary.nullMojiCodes}`);
    console.log(`- 修复的mojiCode数量: ${summary.fixedMojiCodes}`);
    
    // 保存摘要
    writeJsonFile(path.join(__dirname, 'moji_code_verification_summary.json'), summary);
}

// 运行脚本
main();