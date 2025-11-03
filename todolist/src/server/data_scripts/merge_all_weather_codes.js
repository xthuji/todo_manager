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

// 辅助函数：清洗省份名称
function cleanProvinceName(provinceName) {
    // 移除省份常见后缀
    const cleaned = provinceName.replace(/[省市区]$|自治区$|特别行政区$/, '');
    return cleaned.trim();
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

// 计算字符串相似度
function calculateSimilarity(str1, str2) {
    const s1 = removeRegionSuffix(removeBracketsContent(str1));
    const s2 = removeRegionSuffix(removeBracketsContent(str2));
    
    // 完全匹配
    if (s1 === s2) return 1;
    
    // 部分包含
    if (s1.includes(s2) || s2.includes(s1)) return 0.9;
    
    // 计算交集字符比例
    const set1 = new Set(s1);
    const set2 = new Set(s2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const similarity = intersection.size / Math.max(set1.size, set2.size);
    
    return similarity;
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
    
    // 字符相似度匹配
    const similarity = calculateSimilarity(targetName, item.name);
    const requiredSimilarity = cleanTargetName.length <= 2 ? 0.9 : 0.8;
    if (similarity >= requiredSimilarity) {
        return true;
    }
    
    return false;
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
        
        console.log('文件读取完成，开始构建各数据源按省份分类的数据...');
        
        // 按省份分类的数据结构
        const provinceData = {};
        
        // 从天气数据中提取省份信息并清洗
        tianqiData.data.forEach(province => {
            const cleanedProvinceName = cleanProvinceName(province.name);
            provinceData[cleanedProvinceName] = {
                provinceName: province.name,
                cleanedName: cleanedProvinceName,
                districts: []
            };
            
            // 提取区县数据
            if (province.children && Array.isArray(province.children)) {
                province.children.forEach(city => {
                    if (city.children && Array.isArray(city.children)) {
                        city.children.forEach(district => {
                            provinceData[cleanedProvinceName].districts.push(district.name);
                        });
                    }
                });
            }
        });
        
        console.log(`省份数据构建完成，共${Object.keys(provinceData).length}个省份`);
        
        // 为各数据源按省份分类
        function categorizeByProvince(data, sourceName) {
            const categorized = {};
            const uncategorized = [];
            
            // 遍历每个省份的数据
            Object.keys(provinceData).forEach(cleanedProvinceName => {
                categorized[cleanedProvinceName] = [];
            });
            
            // 递归收集并分类数据
            function collectAndCategorize(items, parentName = '', provinceName = null, level = 0) {
                items.forEach(item => {
                    const itemData = {
                        ...item,
                        parentName,
                        level,
                        fullPath: parentName ? `${parentName}-${item.name}` : item.name
                    };
                    
                    if (level === 0) {
                        // 省份级别，尝试匹配到已清洗的省份名称
                        const cleanedItemName = cleanProvinceName(item.name);
                        let matched = false;
                        
                        for (const cleanedProvinceName in categorized) {
                            if (cleanedProvinceName === cleanedItemName || 
                                cleanedProvinceName.includes(cleanedItemName) || 
                                cleanedItemName.includes(cleanedProvinceName)) {
                                categorized[cleanedProvinceName].push(itemData);
                                matched = true;
                                break;
                            }
                        }
                        
                        if (!matched) {
                            uncategorized.push(itemData);
                        }
                    } else if (provinceName) {
                        // 非省份级别，使用已知省份名称分类
                        const cleanedProvinceName = cleanProvinceName(provinceName);
                        if (categorized[cleanedProvinceName]) {
                            categorized[cleanedProvinceName].push(itemData);
                        } else {
                            uncategorized.push(itemData);
                        }
                    } else {
                        // 没有省份信息，暂时放入未分类
                        uncategorized.push(itemData);
                    }
                    
                    // 递归处理子项
                    if (item.children && Array.isArray(item.children)) {
                        const newProvinceName = level === 0 ? item.name : provinceName;
                        collectAndCategorize(item.children, item.name, newProvinceName, level + 1);
                    }
                });
            }
            
            collectAndCategorize(data.data);
            
            console.log(`${sourceName} - 分类完成: ${Object.keys(categorized).filter(p => categorized[p].length > 0).length}个省份有数据，${uncategorized.length}个未分类`);
            return { categorized, uncategorized };
        }
        
        // 分类各数据源
        const { categorized: mojiByProvince } = categorizeByProvince(mojiData, 'Moji');
        const { categorized: nmcByProvince } = categorizeByProvince(nmcData, 'NMC');
        const { categorized: cmaByProvince } = categorizeByProvince(cmaData, 'CMA');
        
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
        
        // 按省份和地区精确匹配
        function findCodeByProvinceAndName(targetName, provinceName, sourceDataByProvince, sourceName) {
            const cleanedProvinceName = cleanProvinceName(provinceName);
            
            // 获取该省份下的所有数据
            const provinceData = sourceDataByProvince[cleanedProvinceName] || [];
            
            if (provinceData.length === 0) {
                return { code: null, nameCode: '', method: null };
            }
            
            // 1. 精确匹配
            let match = provinceData.find(item => {
                // 只匹配区县级别的数据（level >= 2 或 parentName 非空）
                if (item.level < 2 && !item.parentName) return false;
                
                const cleanItemName = removeBracketsContent(item.name);
                const cleanTargetName = removeBracketsContent(targetName);
                
                return item.name === targetName || 
                       cleanItemName === cleanTargetName ||
                       removeRegionSuffix(item.name) === targetName ||
                       removeRegionSuffix(cleanItemName) === cleanTargetName;
            });
            
            if (match) {
                return { 
                    code: match.code, 
                    nameCode: match.nameCode || '', 
                    method: '精确匹配' 
                };
            }
            
            // 2. 尝试添加后缀匹配
            const withSuffix = tryWithSuffixes(targetName, (testName) => {
                return provinceData.find(item => {
                    if (item.level < 2 && !item.parentName) return false;
                    return item.name === testName || 
                           removeRegionSuffix(item.name) === testName;
                });
            });
            
            if (withSuffix.result) {
                return { 
                    code: withSuffix.result.code, 
                    nameCode: withSuffix.result.nameCode || '', 
                    method: `添加${withSuffix.suffix}后缀匹配` 
                };
            }
            
            // 3. 在该省份内进行模糊匹配
            const fuzzyMatches = provinceData.filter(item => {
                if (item.level < 2 && !item.parentName) return false;
                return fuzzyMatch(targetName, item);
            });
            
            if (fuzzyMatches.length === 1) {
                return { 
                    code: fuzzyMatches[0].code, 
                    nameCode: fuzzyMatches[0].nameCode || '', 
                    method: '省份内模糊匹配' 
                };
            } else if (fuzzyMatches.length > 1) {
                // 对模糊匹配结果进行排序
                fuzzyMatches.sort((a, b) => {
                    const similarityA = calculateSimilarity(targetName, a.name);
                    const similarityB = calculateSimilarity(targetName, b.name);
                    return similarityB - similarityA;
                });
                
                // 检查相似度阈值
                const bestSimilarity = calculateSimilarity(targetName, fuzzyMatches[0].name);
                const minRequiredSimilarity = targetName.length <= 2 ? 0.9 : 0.8;
                
                if (bestSimilarity >= minRequiredSimilarity) {
                    console.log(`${sourceName} - 区县(${provinceName}) ${targetName} 模糊匹配到多个结果，选择相似度最高的: ${fuzzyMatches[0].name}`);
                    return { 
                        code: fuzzyMatches[0].code, 
                        nameCode: fuzzyMatches[0].nameCode || '', 
                        method: '省份内模糊匹配(相似度排序)' 
                    };
                }
            }
            
            return { code: null, nameCode: '', method: null };
        }
        
        // 查找省份级别的代码
        function findProvinceCode(provinceName, sourceDataByProvince, sourceName) {
            const cleanedProvinceName = cleanProvinceName(provinceName);
            const provinceData = sourceDataByProvince[cleanedProvinceName] || [];
            
            // 查找省份级别的数据（level === 0 或 parentName === ''）
            const match = provinceData.find(item => 
                (item.level === 0 || !item.parentName) && 
                (cleanProvinceName(item.name) === cleanedProvinceName ||
                 removeBracketsContent(item.name).includes(cleanedProvinceName) ||
                 cleanedProvinceName.includes(removeBracketsContent(item.name)))
            );
            
            if (match) {
                return { 
                    code: match.code, 
                    method: '精确匹配' 
                };
            }
            
            return { code: null, method: null };
        }
        
        // 递归处理数据结构
        function processData(items, level = 0, provinceName = null) {
            items.forEach(item => {
                totalProcessed++;
                
                if (level === 0) { // 省份级别
                    provinceProcessed++;
                    const cleanedProvinceName = cleanProvinceName(item.name);
                    
                    // 查找并设置省份级别的代码
                    const { code: mojiCode, method: mojiMethod } = findProvinceCode(item.name, mojiByProvince, 'Moji');
                    if (mojiCode) {
                        item.mojiCode = mojiCode;
                        provinceMojiCodeFound++;
                        matchDetails.push({ source: 'Moji', name: item.name, level: 'province', code: mojiCode, method: mojiMethod });
                    }
                    
                    const { code: nmcCode, method: nmcMethod } = findProvinceCode(item.name, nmcByProvince, 'NMC');
                    if (nmcCode) {
                        item.nmcCode = nmcCode;
                        provinceNmcCodeFound++;
                        matchDetails.push({ source: 'NMC', name: item.name, level: 'province', code: nmcCode, method: nmcMethod });
                    }
                    
                    const { code: cmaCode, method: cmaMethod } = findProvinceCode(item.name, cmaByProvince, 'CMA');
                    if (cmaCode) {
                        item.cmaCode = cmaCode;
                        provinceCmaCodeFound++;
                        matchDetails.push({ source: 'CMA', name: item.name, level: 'province', code: cmaCode, method: cmaMethod });
                    }
                } else if (level === 1) { // 城市级别 - 跳过
                    // 保留原始城市结构，但不设置代码
                } else if (level === 2) { // 区县级别
                    districtProcessed++;
                    
                    if (!provinceName) {
                        console.warn(`区县 ${item.name} 缺少省份信息，跳过匹配`);
                        return;
                    }
                    
                    // 严格按照省份+地区进行匹配
                    const { code: mojiCode, nameCode: mojiNameCode, method: mojiMethod } = findCodeByProvinceAndName(
                        item.name, provinceName, mojiByProvince, 'Moji'
                    );
                    
                    if (mojiCode) {
                        item.mojiCode = mojiCode;
                        if (mojiNameCode) {
                            item.mojiNameCode = mojiNameCode;
                        }
                        districtMojiCodeFound++;
                        matchDetails.push({ 
                            source: 'Moji', 
                            name: item.name, 
                            level: 'district', 
                            code: mojiCode, 
                            method: mojiMethod, 
                            province: provinceName 
                        });
                    }
                    
                    // 查找NMC代码
                    const { code: nmcCode, nameCode: nmcNameCode, method: nmcMethod } = findCodeByProvinceAndName(
                        item.name, provinceName, nmcByProvince, 'NMC'
                    );
                    
                    if (nmcCode) {
                        item.nmcCode = nmcCode;
                        if (nmcNameCode) {
                            item.nmcNameCode = nmcNameCode;
                        }
                        districtNmcCodeFound++;
                        matchDetails.push({ 
                            source: 'NMC', 
                            name: item.name, 
                            level: 'district', 
                            code: nmcCode, 
                            method: nmcMethod, 
                            province: provinceName 
                        });
                    }
                    
                    // 查找CMA代码
                    const { code: cmaCode, method: cmaMethod } = findCodeByProvinceAndName(
                        item.name, provinceName, cmaByProvince, 'CMA'
                    );
                    
                    if (cmaCode) {
                        item.cmaCode = cmaCode;
                        districtCmaCodeFound++;
                        matchDetails.push({ 
                            source: 'CMA', 
                            name: item.name, 
                            level: 'district', 
                            code: cmaCode, 
                            method: cmaMethod, 
                            province: provinceName 
                        });
                    }
                }
                
                // 递归处理子项
                if (item.children && Array.isArray(item.children)) {
                    processData(item.children, level + 1, level === 0 ? item.name : provinceName);
                }
            });
        }
        
        console.log('开始处理数据结构，严格按照省份+地区进行匹配合并...');
        
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
            '=== 天气编码合并日志（省份+地区严格匹配）===',
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