const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '../../../');
// 文件路径
const tianqiAreaCodesPath = path.join(BASE_DIR, 'todolist/data/weather/tianqi_area_codes.json');
const mojiWeatherAreaCodesPath = path.join(BASE_DIR, 'todolist/data/weather/moji_weather_area_codes.json');
const outputFilePath = path.join(BASE_DIR, 'todolist/data/weather/merged_tianqi_moji_area_codes.json');
const logFilePath = path.join(BASE_DIR, 'todolist/logs/moji_code_merge_log.txt');

try {
    console.log('开始读取文件...');
    
    // 读取并解析JSON文件
    const tianqiData = JSON.parse(fs.readFileSync(tianqiAreaCodesPath, 'utf8'));
    const mojiData = JSON.parse(fs.readFileSync(mojiWeatherAreaCodesPath, 'utf8'));
    
    console.log('文件读取完成，开始构建mojiCode映射...');
    
    // 存储所有moji数据项，方便后续查找
    const allMojiItems = [];
    
    // 收集所有moji数据项
    function collectMojiItems(items, parentName = '', provinceCode = null) {
        items.forEach(item => {
            // 保存完整信息，包括父级名称（用于构建完整路径）
            allMojiItems.push({
                ...item,
                parentName,
                provinceCode: provinceCode || item.code,
                fullPath: parentName ? `${parentName}-${item.name}` : item.name
            });
            
            // 递归收集子项
            if (item.children && Array.isArray(item.children)) {
                collectMojiItems(item.children, item.name, provinceCode || item.code);
            }
        });
    }
    
    // 收集所有moji数据
    collectMojiItems(mojiData.data);
    
    console.log(`收集完成，共收集 ${allMojiItems.length} 个地区项`);
    
    // 统计信息
    let totalProcessed = 0;
    let provinceProcessed = 0;
    let districtProcessed = 0;
    let provinceMojiCodeFound = 0;
    let districtMojiCodeFound = 0;
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
        if (cleanTargetName.split('').every(char => cleanMojiName.includes(char)) || 
            cleanMojiName.split('').every(char => cleanTargetName.includes(char))) {
            return true;
        }
        
        return false;
    }
    
    // 查找匹配的mojiCode
    function findMojiCode(targetName, province = null) {
        // 先根据省份筛选moji数据（如果提供了省份）
        let filteredItems = allMojiItems;
        if (province) {
            // 尝试找到对应省份的moji数据
            const provinceMoji = allMojiItems.find(item => 
                item.parentName === '' && // 顶级项目（省份）
                (item.name === province || removeRegionSuffix(item.name) === removeRegionSuffix(province))
            );
            
            if (provinceMoji) {
                // 筛选出该省份下的所有地区
                filteredItems = allMojiItems.filter(item => 
                    item.provinceCode === provinceMoji.code || 
                    (item.parentName === provinceMoji.name && item.provinceCode === item.code)
                );
            }
        }
        
        // 1. 尝试精确匹配
        let match = filteredItems.find(item => 
            item.name === targetName || 
            removeRegionSuffix(item.name) === targetName ||
            item.name === removeRegionSuffix(targetName)
        );
        
        if (match) {
            return { code: match.code, method: '精确匹配' };
        }
        
        // 2. 尝试添加后缀匹配
        const withSuffix = tryWithSuffixes(targetName, (testName) => {
            return filteredItems.find(item => 
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
        const fuzzyMatches = filteredItems.filter(item => fuzzyMatch(targetName, item));
        
        // 如果只有一个模糊匹配结果，使用它
        if (fuzzyMatches.length === 1) {
            // console.log(`${targetName} 模糊匹配到唯一结果: ${fuzzyMatches[0].name}`);
            return { code: fuzzyMatches[0].code, method: '模糊匹配' };
        } else if (fuzzyMatches.length > 1) {
            // 对模糊匹配的结果进行排序
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
    
    // 递归处理数据结构
    function processData(items, level = 0, provinceName = null) {
        items.forEach(item => {
            totalProcessed++;
            
            // 根据层级决定是否设置mojiCode
            if (level === 0) { // 省份级别
                provinceProcessed++;
                
                // 查找省份的mojiCode
                const { code, method } = findMojiCode(item.name);
                
                if (code) {
                    item.mojiCode = code;
                    provinceMojiCodeFound++;
                    
                    matchDetails.push({
                        name: item.name,
                        level: 'province',
                        code: code,
                        method: method
                    });
                    
                    // console.log(`省份 ${item.name} -> ${code} (${method})`);
                } else {
                    item.mojiCode = null;
                    console.log(`省份 ${item.name} 未找到匹配的mojiCode`);
                }
                
                // 递归处理子项（城市级别）
                if (item.children && Array.isArray(item.children)) {
                    processData(item.children, 1, item.name);
                }
            } else if (level === 1) { // 城市级别 - 不设置mojiCode
                // 递归处理子项（区县级别）
                if (item.children && Array.isArray(item.children)) {
                    processData(item.children, 2, provinceName);
                }
            } else if (level === 2) { // 区县级别
                districtProcessed++;
                
                // 查找区县的mojiCode，使用省份名称进行关联
                const { code, method } = findMojiCode(item.name, provinceName);
                
                if (code) {
                    item.mojiCode = code;
                    districtMojiCodeFound++;
                    
                    matchDetails.push({
                        name: item.name,
                        level: 'district',
                        code: code,
                        method: method,
                        province: provinceName
                    });
                    
                    // console.log(`区县 ${provinceName} - ${item.name} -> ${code} (${method})`);
                } else {
                    item.mojiCode = null;
                    console.log(`区县 ${provinceName} - ${item.name} 未找到匹配的mojiCode`);
                }
            }
        });
    }
    
    console.log('开始处理数据结构...');
    
    // 处理数据
    processData(tianqiData.data);
    
    // 更新时间戳
    tianqiData.timestamp = Date.now();
    
    console.log('数据处理完成，开始写入文件...');
    
    // 写入合并后的数据
    fs.writeFileSync(outputFilePath, JSON.stringify(tianqiData, null, 2), 'utf8');
    
    // 写入匹配详情日志
    const logContent = [
        '=== mojiCode 合并日志 ===',
        `更新时间: ${new Date().toLocaleString()}`,
        `总共处理的地区数量: ${totalProcessed}`,
        `省份数量: ${provinceProcessed}`,
        `成功匹配省份mojiCode数量: ${provinceMojiCodeFound}`,
        `区县数量: ${districtProcessed}`,
        `成功匹配区县mojiCode数量: ${districtMojiCodeFound}`,
        '',
        '匹配详情:',
        matchDetails.map(d => {
            const levelInfo = d.level === 'province' ? '省份' : `区县(${d.province})`;
            return `${levelInfo} ${d.name} -> ${d.code} (${d.method})`;
        }).join('\n'),
        ''
    ].join('\n');
    
    fs.writeFileSync(logFilePath, logContent, 'utf8');
    
    // 显示统计信息
    console.log('========================================');
    console.log('合并统计信息:');
    console.log(`- 总共处理的地区数量: ${totalProcessed}`);
    console.log(`- 省份数量: ${provinceProcessed}`);
    console.log(`- 成功匹配省份mojiCode数量: ${provinceMojiCodeFound}`);
    console.log(`- 区县数量: ${districtProcessed}`);
    console.log(`- 成功匹配区县mojiCode数量: ${districtMojiCodeFound}`);
    console.log(`- 合并后的数据已保存至: ${outputFilePath}`);
    console.log(`- 合并日志已保存至: ${logFilePath}`);
    console.log('========================================');
    
} catch (error) {
    console.error('合并过程中发生错误：', error.message);
    console.error(error.stack);
    process.exit(1);
}