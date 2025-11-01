const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '../../../');
// 文件路径
const mergedTianqiMojiPath = path.join(BASE_DIR, 'data/weather/merged_tianqi_moji_area_codes.json');
const nmcWeatherAreaCodesPath = path.join(BASE_DIR, 'data/weather/nmc_weather_area_codes.json');
const outputFilePath = path.join(BASE_DIR, 'data/weather/merged_tianqi_moji_nmc_area_codes.json');
const logFilePath = path.join(BASE_DIR, 'logs/nmc_code_merge_log.txt');

try {
    console.log('开始读取文件...');
    
    // 读取并解析JSON文件
    const mergedData = JSON.parse(fs.readFileSync(mergedTianqiMojiPath, 'utf8'));
    const nmcData = JSON.parse(fs.readFileSync(nmcWeatherAreaCodesPath, 'utf8'));
    
    console.log('文件读取完成，开始构建nmcCode映射...');
    
    // 存储所有nmc数据项，方便后续查找
    const allNmcItems = [];
    
    // 收集所有nmc数据项
    function collectNmcItems(items, parentName = '', provinceCode = null) {
        items.forEach(item => {
            // 保存完整信息，包括父级名称（用于构建完整路径）
            allNmcItems.push({
                ...item,
                parentName,
                provinceCode: provinceCode || item.code,
                fullPath: parentName ? `${parentName}-${item.name}` : item.name
            });
            
            // 递归收集子项
            if (item.children && Array.isArray(item.children)) {
                collectNmcItems(item.children, item.name, provinceCode || item.code);
            }
        });
    }
    
    // 收集所有nmc数据
    collectNmcItems(nmcData.data);
    
    console.log(`收集完成，共收集 ${allNmcItems.length} 个地区项`);
    
    // 统计信息
    let totalProcessed = 0;
    let provinceProcessed = 0;
    let districtProcessed = 0;
    let provinceNmcCodeFound = 0;
    let districtNmcCodeFound = 0;
    let matchDetails = [];
    
    // 移除地区名称后缀的函数
    function removeRegionSuffix(name) {
        // 移除常见的行政区划后缀
        return name.replace(/[市区县旗盟特区]$|自治区$/, '');
    }
    
    // 移除括号中的内容
    function removeBracketsContent(name) {
        return name.replace(/\([^)]*\)/g, '').trim();
    }
    
    // 添加可能的后缀进行尝试匹配
    function tryWithSuffixes(name, callback) {
        const suffixes = ['', '区', '县', '市', '旗', '口', '镇', '盟', '特区', '特别行政区', '自治区', '自治县'];
        
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
    function fuzzyMatch(targetName, nmcItem) {
        // 处理目标名称，移除括号内容和后缀
        const cleanTargetName = removeRegionSuffix(removeBracketsContent(targetName));
        // 处理nmc名称，移除后缀
        const cleanNmcName = removeRegionSuffix(nmcItem.name);
        
        // 完全匹配
        if (cleanTargetName === cleanNmcName || 
            targetName === nmcItem.name ||
            cleanTargetName === nmcItem.name ||
            targetName === cleanNmcName ||
            removeBracketsContent(targetName) === nmcItem.name ||
            targetName === removeBracketsContent(nmcItem.name)) {
            return true;
        }
        
        // 部分匹配（目标名称是nmc名称的一部分，或者反之）
        if (cleanNmcName.includes(cleanTargetName) || 
            cleanTargetName.includes(cleanNmcName)) {
            return true;
        }
        
        // 所有字符都被包含
        if (cleanTargetName.split('').every(char => cleanNmcName.includes(char)) || 
            cleanNmcName.split('').every(char => cleanTargetName.includes(char))) {
            return true;
        }
        
        return false;
    }
    
    // 查找匹配的nmcCode
    function findNmcCode(targetName, province = null) {
        // 先根据省份筛选nmc数据（如果提供了省份）
        let filteredItems = allNmcItems;
        if (province) {
            // 尝试找到对应省份的nmc数据
            const provinceNmc = allNmcItems.find(item => 
                item.parentName === '' && // 顶级项目（省份）
                (removeBracketsContent(item.name) === province || 
                 removeRegionSuffix(removeBracketsContent(item.name)) === removeRegionSuffix(province))
            );
            
            if (provinceNmc) {
                // 筛选出该省份下的所有地区
                filteredItems = allNmcItems.filter(item => 
                    item.provinceCode === provinceNmc.code
                );
            }
        }
        
        // 处理目标名称，移除括号内容
        const cleanTargetName = removeBracketsContent(targetName);
        
        // 1. 尝试精确匹配
        let match = filteredItems.find(item => 
            item.name === targetName || 
            item.name === cleanTargetName ||
            removeRegionSuffix(item.name) === targetName ||
            removeRegionSuffix(item.name) === cleanTargetName
        );
        
        if (match) {
            return { code: match.code, method: '精确匹配' };
        }
        
        // 2. 尝试添加后缀匹配
        const withSuffix = tryWithSuffixes(cleanTargetName, (testName) => {
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
            return { code: fuzzyMatches[0].code, method: '模糊匹配' };
        } else if (fuzzyMatches.length > 1) {
            // 对模糊匹配的结果进行排序
            fuzzyMatches.sort((a, b) => {
                // 完全匹配优先
                if (fuzzyMatch(targetName, a) && !fuzzyMatch(targetName, b)) return -1;
                if (!fuzzyMatch(targetName, a) && fuzzyMatch(targetName, b)) return 1;
                
                // 以 自治区/自治县/自治州/特区 结尾的优先
                const aEnds = ['自治区', '自治县', '特区', '特别行政区'];
                const bEnds = ['自治区', '自治县', '特区', '特别行政区'];
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
            
            // 根据层级决定是否设置nmcCode
            if (level === 0) { // 省份级别
                provinceProcessed++;
                
                // 查找省份的nmcCode
                const { code, method } = findNmcCode(item.name);
                
                if (code) {
                    item.nmcCode = code;
                    provinceNmcCodeFound++;
                    
                    matchDetails.push({
                        name: item.name,
                        level: 'province',
                        code: code,
                        method: method
                    });
                    
                    // console.log(`省份 ${item.name} -> ${code} (${method})`);
                } else {
                    item.nmcCode = null;
                    console.log(`省份 ${item.name} 未找到匹配的nmcCode`);
                }
                
                // 递归处理子项（城市级别）
                if (item.children && Array.isArray(item.children)) {
                    processData(item.children, 1, item.name);
                }
            } else if (level === 1) { // 城市级别 - 不设置nmcCode
                // 递归处理子项（区县级别）
                if (item.children && Array.isArray(item.children)) {
                    processData(item.children, 2, provinceName);
                }
            } else if (level === 2) { // 区县级别
                districtProcessed++;
                
                // 查找区县的nmcCode，使用省份名称进行关联
                const { code, method } = findNmcCode(item.name, provinceName);
                
                if (code) {
                    item.nmcCode = code;
                    districtNmcCodeFound++;
                    
                    matchDetails.push({
                        name: item.name,
                        level: 'district',
                        code: code,
                        method: method,
                        province: provinceName
                    });
                    
                    // console.log(`区县 ${provinceName} - ${item.name} -> ${code} (${method})`);
                } else {
                    item.nmcCode = null;
                    console.log(`区县 ${provinceName} - ${item.name} 未找到匹配的nmcCode`);
                }
            }
        });
    }
    
    console.log('开始处理数据结构...');
    
    // 处理数据
    processData(mergedData.data);
    
    // 更新时间戳
    mergedData.timestamp = Date.now();
    
    console.log('数据处理完成，开始写入文件...');
    
    // 写入合并后的数据
    fs.writeFileSync(outputFilePath, JSON.stringify(mergedData, null, 2), 'utf8');
    
    // 写入匹配详情日志
    const logContent = [
        '=== nmcCode 合并日志 ===',
        `更新时间: ${new Date().toLocaleString()}`,
        `总共处理的地区数量: ${totalProcessed}`,
        `省份数量: ${provinceProcessed}`,
        `成功匹配省份nmcCode数量: ${provinceNmcCodeFound}`,
        `区县数量: ${districtProcessed}`,
        `成功匹配区县nmcCode数量: ${districtNmcCodeFound}`,
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
    console.log(`- 成功匹配省份nmcCode数量: ${provinceNmcCodeFound}`);
    console.log(`- 区县数量: ${districtProcessed}`);
    console.log(`- 成功匹配区县nmcCode数量: ${districtNmcCodeFound}`);
    console.log(`- 合并后的数据已保存至: ${outputFilePath}`);
    console.log(`- 合并日志已保存至: ${logFilePath}`);
    console.log('========================================');
    
} catch (error) {
    console.error('合并过程中发生错误：', error.message);
    console.error(error.stack);
    process.exit(1);
}