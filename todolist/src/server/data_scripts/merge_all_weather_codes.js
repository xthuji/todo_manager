const fs = require('fs');
const path = require('path');

// 基础目录
const BASE_DIR = path.join(__dirname, '../../../');

// 文件路径
const tianqiAreaCodesPath = path.join(BASE_DIR, 'data/weather/tianqi_area_codes.json');
const mojiWeatherAreaCodesPath = path.join(BASE_DIR, 'data/weather/moji_weather_area_codes.json');
const nmcWeatherAreaCodesPath = path.join(BASE_DIR, 'data/weather/nmc_weather_area_codes.json');
const cmaWeatherAreaCodesPath = path.join(BASE_DIR, 'data/weather/cma_weather_area_codes.json');
const outputFilePath = path.join(BASE_DIR, 'data/weather/merged_weather_area_codes.json');
const logFilePath = path.join(BASE_DIR, 'logs/weather_codes_merge_log.txt');

// 确保logs目录存在
function ensureLogsDir() {
    const logsDir = path.dirname(logFilePath);
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }
}

// 辅助函数：移除地区名称后缀
function removeRegionSuffix(name) {
    return name.replace(/[市区县旗盟特区]$|自治区$/, '');
}

// 辅助函数：移除括号中的内容
function removeBracketsContent(name) {
    return name.replace(/\([^)]*\)/g, '').trim();
}

// 辅助函数：尝试添加后缀进行匹配
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

// 辅助函数：模糊匹配
function fuzzyMatch(targetName, item) {
    const cleanTargetName = removeRegionSuffix(removeBracketsContent(targetName));
    const cleanItemName = removeRegionSuffix(item.name);
    
    // 完全匹配
    if (cleanTargetName === cleanItemName || 
        targetName === item.name ||
        cleanTargetName === item.name ||
        targetName === cleanItemName ||
        removeBracketsContent(targetName) === item.name ||
        targetName === removeBracketsContent(item.name)) {
        return true;
    }
    
    // 部分匹配
    if (cleanItemName.includes(cleanTargetName) || 
        cleanTargetName.includes(cleanItemName)) {
        return true;
    }
    
    // 所有字符都被包含
    if (cleanTargetName.split('').every(char => cleanItemName.includes(char)) || 
        cleanItemName.split('').every(char => cleanTargetName.includes(char))) {
        return true;
    }
    
    return false;
}

// 处理模糊匹配结果
function processFuzzyMatches(targetName, fuzzyMatches, sourceName) {
            if (fuzzyMatches.length === 1) {
                return { 
                    code: fuzzyMatches[0].code, 
                    nameCode: fuzzyMatches[0].nameCode || '', // 添加nameCode
                    method: '模糊匹配' 
                };
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
        
        console.log(`${sourceName} - ${targetName} 模糊匹配到多个结果: ${fuzzyMatches.map(item => item.name).join(', ')}`);
        return { code: fuzzyMatches[0].code, method: '模糊匹配' };
    }
    
    return { code: null, method: null };
}

// 合并所有天气数据源
async function mergeAllWeatherCodes() {
    try {
        console.log('开始读取数据源文件...');
        
        // 读取并解析JSON文件
        const tianqiData = JSON.parse(fs.readFileSync(tianqiAreaCodesPath, 'utf8'));
        const mojiData = JSON.parse(fs.readFileSync(mojiWeatherAreaCodesPath, 'utf8'));
        const nmcData = JSON.parse(fs.readFileSync(nmcWeatherAreaCodesPath, 'utf8'));
        const cmaData = JSON.parse(fs.readFileSync(cmaWeatherAreaCodesPath, 'utf8'));
        
        console.log('文件读取完成，开始构建各数据源映射...');
        
        // 数据收集和映射构建
        const allMojiItems = [];
        const allNmcItems = [];
        const allCmaItems = [];
        
        // 递归收集数据
        function collectItems(items, allItems, parentName = '', provinceCode = null) {
            items.forEach(item => {
                allItems.push({
                    ...item,
                    parentName,
                    provinceCode: provinceCode || item.code,
                    fullPath: parentName ? `${parentName}-${item.name}` : item.name
                });
                
                if (item.children && Array.isArray(item.children)) {
                    collectItems(item.children, allItems, item.name, provinceCode || item.code);
                }
            });
        }
        
        // 收集各数据源数据
        collectItems(mojiData.data, allMojiItems);
        collectItems(nmcData.data, allNmcItems);
        collectItems(cmaData.data, allCmaItems);
        
        console.log(`数据收集完成 - Moji: ${allMojiItems.length} 项, NMC: ${allNmcItems.length} 项, CMA: ${allCmaItems.length} 项`);
        
        // 统计信息
        let totalProcessed = 0;
        let provinceProcessed = 0;
        let districtProcessed = 0;
        
        let provinceMojiCodeFound = 0;
        let districtMojiCodeFound = 0;
        let provinceNmcCodeFound = 0;
        let districtNmcCodeFound = 0;
        let provinceCmaCodeFound = 0;
        let districtCmaCodeFound = 0;
        
        let matchDetails = [];
        
        // 查找匹配的Moji代码
        function findMojiCode(targetName, province = null) {
            let filteredItems = allMojiItems;
            if (province) {
                const provinceMoji = allMojiItems.find(item => 
                    item.parentName === '' && 
                    (item.name === province || removeRegionSuffix(item.name) === removeRegionSuffix(province))
                );
                
                if (provinceMoji) {
                    filteredItems = allMojiItems.filter(item => 
                        item.provinceCode === provinceMoji.code || 
                        (item.parentName === provinceMoji.name && item.provinceCode === item.code)
                    );
                }
            }
            
            // 1. 精确匹配
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
                    nameCode: withSuffix.result.nameCode || '', // 添加nameCode
                    method: `添加${withSuffix.suffix}后缀匹配` 
                };
            }
            
            // 3. 模糊匹配
            const fuzzyMatches = filteredItems.filter(item => fuzzyMatch(targetName, item));
            return processFuzzyMatches(targetName, fuzzyMatches, 'Moji');
        }
        
        // 查找匹配的NMC代码
        function findNmcCode(targetName, province = null) {
            let filteredItems = allNmcItems;
            if (province) {
                const provinceNmc = allNmcItems.find(item => 
                    item.parentName === '' && 
                    (removeBracketsContent(item.name) === province || 
                     removeRegionSuffix(removeBracketsContent(item.name)) === removeRegionSuffix(province))
                );
                
                if (provinceNmc) {
                    filteredItems = allNmcItems.filter(item => 
                        item.provinceCode === provinceNmc.code
                    );
                }
            }
            
            const cleanTargetName = removeBracketsContent(targetName);
            
            // 1. 精确匹配
            let match = filteredItems.find(item => 
                item.name === targetName || 
                item.name === cleanTargetName ||
                removeRegionSuffix(item.name) === targetName ||
                removeRegionSuffix(item.name) === cleanTargetName
            );
            
            if (match) {
                return { 
                    code: match.code, 
                    nameCode: match.nameCode || '', // 添加nameCode
                    method: '精确匹配' 
                };
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
            
            // 3. 模糊匹配
            const fuzzyMatches = filteredItems.filter(item => fuzzyMatch(targetName, item));
            return processFuzzyMatches(targetName, fuzzyMatches, 'NMC');
        }
        
        // 查找匹配的CMA代码
        function findCmaCode(targetName, province = null) {
            let filteredItems = allCmaItems;
            if (province) {
                const provinceCma = allCmaItems.find(item => 
                    item.parentName === '' && 
                    (item.name === province || removeRegionSuffix(item.name) === removeRegionSuffix(province))
                );
                
                if (provinceCma) {
                    filteredItems = allCmaItems.filter(item => 
                        item.provinceCode === provinceCma.code ||
                        item.parentName === provinceCma.name
                    );
                }
            }
            
            const cleanTargetName = removeBracketsContent(targetName);
            
            // 1. 精确匹配
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
            
            // 3. 模糊匹配
            const fuzzyMatches = filteredItems.filter(item => fuzzyMatch(targetName, item));
            return processFuzzyMatches(targetName, fuzzyMatches, 'CMA');
        }
        
        // 递归处理数据结构
        function processData(items, level = 0, provinceName = null) {
            items.forEach(item => {
                totalProcessed++;
                
                if (level === 0) { // 省份级别
                    provinceProcessed++;
                    
                    // 查找并设置所有代码
                    const { code: mojiCode, method: mojiMethod } = findMojiCode(item.name);
                    if (mojiCode) {
                        item.mojiCode = mojiCode;
                        provinceMojiCodeFound++;
                        matchDetails.push({ source: 'Moji', name: item.name, level: 'province', code: mojiCode, method: mojiMethod });
                    }
                    
                    const { code: nmcCode, method: nmcMethod } = findNmcCode(item.name);
                    if (nmcCode) {
                        item.nmcCode = nmcCode;
                        provinceNmcCodeFound++;
                        matchDetails.push({ source: 'NMC', name: item.name, level: 'province', code: nmcCode, method: nmcMethod });
                    }
                    
                    const { code: cmaCode, method: cmaMethod } = findCmaCode(item.name);
                    if (cmaCode) {
                        item.cmaCode = cmaCode;
                        provinceCmaCodeFound++;
                        matchDetails.push({ source: 'CMA', name: item.name, level: 'province', code: cmaCode, method: cmaMethod });
                    }
                } else if (level === 1) { // 城市级别 - 跳过
                    // 保留原始城市结构，但不设置代码
                } else if (level === 2) { // 区县级别
                    districtProcessed++;
                    
                    // 查找并设置所有代码，使用省份名称进行关联
                    const { code: mojiCode, method: mojiMethod } = findMojiCode(item.name, provinceName);
                    if (mojiCode) {
                        item.mojiCode = mojiCode;
                        districtMojiCodeFound++;
                        matchDetails.push({ source: 'Moji', name: item.name, level: 'district', code: mojiCode, method: mojiMethod, province: provinceName });
                    }
                    
                    const { code: nmcCode, nameCode: nmcNameCode, method: nmcMethod } = findNmcCode(item.name, provinceName);
                    if (nmcCode) {
                        item.nmcCode = nmcCode;
                        districtNmcCodeFound++;
                        matchDetails.push({ source: 'NMC', name: item.name, level: 'district', code: nmcCode, method: nmcMethod, province: provinceName });
                    }
                    // 添加县级地区的nameCode到nmcNameCode字段
                    if (nmcNameCode) {
                        item.nmcNameCode = nmcNameCode;
                    }
                    
                    const { code: cmaCode, method: cmaMethod } = findCmaCode(item.name, provinceName);
                    if (cmaCode) {
                        item.cmaCode = cmaCode;
                        districtCmaCodeFound++;
                        matchDetails.push({ source: 'CMA', name: item.name, level: 'district', code: cmaCode, method: cmaMethod, province: provinceName });
                    }
                }
                
                // 递归处理子项
                if (item.children && Array.isArray(item.children)) {
                    processData(item.children, level + 1, level === 0 ? item.name : provinceName);
                }
            });
        }
        
        console.log('开始处理数据结构，合并所有地区编码...');
        
        // 处理数据
        processData(tianqiData.data);
        
        // 更新时间戳
        tianqiData.timestamp = Date.now();
        
        console.log('数据处理完成，开始写入文件...');
        
        // 写入合并后的数据
        fs.writeFileSync(outputFilePath, JSON.stringify(tianqiData, null, 2), 'utf8');
        
        // 确保logs目录存在
        ensureLogsDir();
        
        // 写入匹配详情日志
        const logContent = [
            '=== 天气编码合并日志 ===',
            `更新时间: ${new Date().toLocaleString()}`,
            `总共处理的地区数量: ${totalProcessed}`,
            `省份数量: ${provinceProcessed}`,
            `区县数量: ${districtProcessed}`,
            '',
            '=== Moji Weather ===',
            `成功匹配省份mojiCode数量: ${provinceMojiCodeFound}`,
            `成功匹配区县mojiCode数量: ${districtMojiCodeFound}`,
            '',
            '=== NMC ===',
            `成功匹配省份nmcCode数量: ${provinceNmcCodeFound}`,
            `成功匹配区县nmcCode数量: ${districtNmcCodeFound}`,
            '',
            '=== CMA ===',
            `成功匹配省份cmaCode数量: ${provinceCmaCodeFound}`,
            `成功匹配区县cmaCode数量: ${districtCmaCodeFound}`,
            '',
            '匹配详情:',
            matchDetails.map(d => {
                const levelInfo = d.level === 'province' ? '省份' : `区县(${d.province})`;
                return `${d.source} - ${levelInfo} ${d.name} -> ${d.code} (${d.method})`;
            }).join('\n'),
            ''
        ].join('\n');
        
        fs.writeFileSync(logFilePath, logContent, 'utf8');
        
        // 显示统计信息
        console.log('========================================');
        console.log('合并统计信息:');
        console.log(`- 总共处理的地区数量: ${totalProcessed}`);
        console.log(`- 省份数量: ${provinceProcessed}`);
        console.log(`- 区县数量: ${districtProcessed}`);
        console.log('----------------------------------------');
        console.log(`- Moji Weather 匹配: 省份 ${provinceMojiCodeFound}/${provinceProcessed}, 区县 ${districtMojiCodeFound}/${districtProcessed}`);
        console.log(`- NMC 匹配: 省份 ${provinceNmcCodeFound}/${provinceProcessed}, 区县 ${districtNmcCodeFound}/${districtProcessed}`);
        console.log(`- CMA 匹配: 省份 ${provinceCmaCodeFound}/${provinceProcessed}, 区县 ${districtCmaCodeFound}/${districtProcessed}`);
        console.log('----------------------------------------');
        console.log(`- 合并后的数据已保存至: ${outputFilePath}`);
        console.log(`- 合并日志已保存至: ${logFilePath}`);
        console.log('========================================');
        
    } catch (error) {
        console.error('合并过程中发生错误：', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// 运行合并函数
mergeAllWeatherCodes();