const fs = require('fs');

// 文件路径
const mergedFilePath = '/Users/huji/work/MyProject/code_mine/gitee/node_app/todolist/data/weather/merged_weather_area_codes.json';
const mojiFilePath = '/Users/huji/work/MyProject/code_mine/gitee/node_app/todolist/data/weather/moji_weather_area_codes.json';
const outputFilePath = '/Users/huji/work/MyProject/code_mine/gitee/node_app/todolist/data/weather/merged_weather_area_codes_updated.json';

console.log('开始读取文件...');

// 读取并解析JSON文件
const mergedData = JSON.parse(fs.readFileSync(mergedFilePath, 'utf8'));
const mojiData = JSON.parse(fs.readFileSync(mojiFilePath, 'utf8'));

console.log('文件读取完成，开始构建mojiCode映射...');

// 存储所有moji数据项，方便后续查找
const allMojiItems = [];

// 收集所有moji数据项
function collectMojiItems(items, parentName = '', province = '') {
    items.forEach(item => {
        // 保存完整信息，包括父级名称（用于构建完整路径）
        allMojiItems.push({
            ...item,
            parentName,
            provinceCode: province ? province : item.code,
            fullPath: parentName ? `${parentName}-${item.name}` : item.name
        });
        
        // 递归收集子项
        if (item.children && Array.isArray(item.children)) {
            collectMojiItems(item.children, item.name, province ? province : item.code);
        }
    });
}

// 收集所有moji数据
collectMojiItems(mojiData.data);

console.log(`收集完成，共收集 ${allMojiItems.length} 个地区项`);

// 统计信息
let totalProcessed = 0;
let nullMojiCodeFound = 0;
let updatedCount = 0;
let matchDetails = [];

// 移除地区名称后缀的函数
function removeRegionSuffix(name) {
    // 移除常见的行政区划后缀
    return name.replace(/[市区县旗盟特区]$|自治区$/, '');
}

// 添加可能的后缀进行尝试匹配
function tryWithSuffixes(name, callback) {
    const suffixes = ['', '区', '县', '市', '旗', '口', '镇', '盟', '特区', '自治区', '自治县'];
    
    for (const suffix of suffixes) {
        const testName = name + suffix;
        const result = callback(testName);
        if (result) {
            return { result, suffix };
        }
    }
    
    return { result: null, suffix: null };
}

// 模糊匹配函数
function fuzzyMatch(targetName, mojiItem) {
    const cleanTargetName = removeRegionSuffix(targetName);
    const cleanMojiName = removeRegionSuffix(mojiItem.name);
    
    // 完全匹配
    if (cleanTargetName === cleanMojiName || 
        targetName === mojiItem.name ||
        cleanTargetName === mojiItem.name ||
        targetName === cleanMojiName) {
        return true;
    }
    
    // 部分匹配（目标名称是moji名称的一部分，或者反之）
    if (cleanMojiName.includes(cleanTargetName) || 
        cleanTargetName.includes(cleanMojiName)) {
        return true;
    }
    
    // 所有字符都被包含
    if (cleanTargetName.split('').every(char => cleanMojiName.includes(char))) {
        return true;
    }
    
    return false;
}

// 查找匹配的mojiCode
function findMojiCode(targetName, province) {
    // 先根据省份从mojiItem中获取对应的地区列表，再从地区列表中进行筛选
    const provinceItems = allMojiItems.filter(item => item.provinceCode.startsWith(province));
    
    // 1. 尝试精确匹配
    let match = provinceItems.find(item => 
        item.name === targetName || 
        removeRegionSuffix(item.name) === targetName ||
        item.name === removeRegionSuffix(targetName)
    );
    
    if (match) {
        return { code: match.code, method: '精确匹配' };
    }
    
    // 2. 尝试添加后缀匹配
    const withSuffix = tryWithSuffixes(targetName, (testName) => {
        return provinceItems.find(item => 
            item.name === testName || 
            removeRegionSuffix(item.name) === testName
        );
    });
    
    if (withSuffix.result) {
        return { 
            code: withSuffix.result.code, 
            method: `添加${withSuffix.suffix}后缀匹配` 
        };
    }
    
    // 3. 尝试模糊匹配
    const fuzzyMatches = provinceItems.filter(item => fuzzyMatch(targetName, item));
    
    // 如果只有一个模糊匹配结果，使用它
    if (fuzzyMatches.length === 1) {
        console.log(`${targetName} 模糊匹配到唯一结果: ${fuzzyMatches[0].name}`);
        return { code: fuzzyMatches[0].code, method: '模糊匹配' };
    } else if (fuzzyMatches.length > 1) {
        // 对模糊匹配的结果进行排序，优先级：完全匹配的 > 以 自治区/自治县/自治州/特区 结尾且包含字符数量更多的 > 以 盟/旗/口/县/镇/堡/区 结尾且包含字符数量更多的 > 以 景区/公园/度假区/旅游区 结尾且包含字符数量更多的
        fuzzyMatches.sort((a, b) => {
            // 完全匹配优先
            if (fuzzyMatch(targetName, a) && !fuzzyMatch(targetName, b)) return -1;
            if (!fuzzyMatch(targetName, a) && fuzzyMatch(targetName, b)) return 1;
            
            // 以 自治区/自治县/自治州/特区 结尾的优先
            const aEnds = ['自治区', '自治县', '特区'];
            const bEnds = ['自治区', '自治县', '特区'];
            if (aEnds.some(end => a.name.endsWith(end)) && 
                !bEnds.some(end => b.name.endsWith(end))) return -1;
            
            // 以 盟/旗/口/县/镇/堡/区 结尾的优先
            const aEnds2 = ['盟', '旗', '口', '县', '镇', '堡', '区'];
            const bEnds2 = ['盟', '旗', '口', '县', '镇', '堡', '区'];
            if (aEnds2.some(end => a.name.endsWith(end)) && 
                !bEnds2.some(end => b.name.endsWith(end))) return -1;
    
            // 以 景区/公园/度假区/旅游区 结尾的放最后
            const aEnds3 = ['景区', '公园', '度假区', '旅游区'];
            const bEnds3 = ['景区', '公园', '度假区', '旅游区'];
            if (aEnds3.some(end => a.name.endsWith(end)) && 
                !bEnds3.some(end => b.name.endsWith(end))) return 1;
            
            // 字符数量少的优先
            return a.name.length - b.name.length;
        });
        
        console.log(`${targetName} 模糊匹配到多个结果: ${fuzzyMatches.map(item => item.name).join(', ')}`);
        return { code: fuzzyMatches[0].code, method: '模糊匹配' };
    }
    
    return { code: null, method: null };
}

// 递归更新merged_weather_area_codes.json中的mojiCode
function updateMojiCodes(items, province) {
    items.forEach(item => {
        totalProcessed++;
        
        // 检查并更新当前项的mojiCode
        if (item.mojiCode === null) {
            nullMojiCodeFound++;
            
            // 尝试查找匹配的编码
            const { code, method } = findMojiCode(item.name, province);
            
            if (code) {
                item.mojiCode = code;
                updatedCount++;
                
                const detail = {
                    name: item.name,
                    code: code,
                    method: method
                };
                
                matchDetails.push(detail);
                console.log(`更新: ${item.name} -> ${code} (${method})`);
            }
        }
        
        // 递归处理子项
        if (item.children && Array.isArray(item.children)) {
            updateMojiCodes(item.children, province ? province : item.mojiCode);
        }
    });
}

console.log('开始更新mojiCode字段...');

// 更新数据
updateMojiCodes(mergedData.data, null);

// 更新时间戳
mergedData.timestamp = Date.now();

console.log('更新完成，开始写入文件...');

// 写入更新后的数据
fs.writeFileSync(outputFilePath, JSON.stringify(mergedData, null, 2), 'utf8');

// 写入匹配详情日志
const logFilePath = '/Users/huji/work/MyProject/code_mine/gitee/node_app/todolist/data/weather/moji_code_update_log.txt';
const logContent = [
    '=== mojiCode 更新日志 ===',
    `更新时间: ${new Date().toLocaleString()}`,
    `总共处理的地区数量: ${totalProcessed}`,
    `发现mojiCode为null的地区数量: ${nullMojiCodeFound}`,
    `成功更新的地区数量: ${updatedCount}`,
    '',
    '更新详情:',
    matchDetails.map(d => `${d.name} -> ${d.code} (${d.method})`).join('\n'),
    ''
].join('\n');

fs.writeFileSync(logFilePath, logContent, 'utf8');

// 显示统计信息
console.log('========================================');
console.log('更新统计信息:');
console.log(`- 总共处理的地区数量: ${totalProcessed}`);
console.log(`- 发现mojiCode为null的地区数量: ${nullMojiCodeFound}`);
console.log(`- 成功更新的地区数量: ${updatedCount}`);
console.log(`- 更新后的数据已保存至: ${outputFilePath}`);
console.log(`- 更新日志已保存至: ${logFilePath}`);
console.log('========================================');

// 如果需要直接覆盖原文件，可以取消下面这行的注释
// fs.copyFileSync(outputFilePath, mergedFilePath);
// console.log('已覆盖原文件');