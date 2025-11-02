const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_DIR = path.join(__dirname, '../../../');
// 文件路径
const incrementalMergeResultPath = path.join(BASE_DIR, 'data/weather/merged_tianqi_moji_nmc_cma_area_codes.json');
const oneTimeMergeResultPath = path.join(BASE_DIR, 'data/weather/merged_weather_area_codes.json');
// 使用当前目录作为报告输出目录，确保可写
const reportFilePath = path.join(BASE_DIR, 'logs/merge_methods_comparison_report.txt');

console.log(`报告将保存至: ${reportFilePath}`);

// 确保logs目录存在
function ensureLogsDir() {
    const logsDir = path.dirname(reportFilePath);
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }
}

// 读取JSON文件
function readJsonFile(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        console.error(`读取文件失败: ${filePath}`, error.message);
        return null;
    }
}

// 构建URL验证函数
function buildWeatherUrls(area, provinceCode) {
    const urls = {};
    
    // 为每个编码类型生成URL，并记录构建状态
    urls.moji = area.mojiCode ? `https://tianqi.moji.com/weather/china/${area.mojiCode}` : null;
    urls.nmc = area.nmcCode ? `https://www.nmc.cn/publish/forecast/${area.nmcCode}.html` : null;
    urls.cma = area.cmaCode ? `https://weather.cma.cn/web/weather/${area.cmaCode}.html` : null;
    
    // 添加调试信息
    urls.debug = {
        hasMojiCode: !!area.mojiCode,
        hasNmcCode: !!area.nmcCode,
        hasCmaCode: !!area.cmaCode
    };
    
    return urls;
}

// 验证URL是否有效（改进版本：检查HTTP状态码并分析页面内容）
async function validateWeatherUrl(url, areaName = '', codeType = '') {
    return new Promise((resolve) => {
        let timeoutId;
        
        const request = https.get(url, { timeout: 10000 }, (res) => {
            clearTimeout(timeoutId);
            
            // 首先检查状态码
            if (![200, 301, 302].includes(res.statusCode)) {
                console.log(`URL验证失败 - 状态码: ${res.statusCode}, URL: ${url}`);
                resolve(false);
                return;
            }
            
            let responseData = '';
            
            // 收集响应数据
            res.on('data', (chunk) => {
                responseData += chunk;
                // 限制最大数据量以避免内存问题
                if (responseData.length > 500000) { // 500KB
                    request.abort();
                }
            });
            
            // 响应完成后分析内容
            res.on('end', () => {
                // 根据不同的网站类型使用不同的验证规则
                const isValid = analyzeContent(responseData, url, areaName, codeType);
                console.log(`URL验证结果 - URL: ${url}, 有效: ${isValid}`);
                resolve(isValid);
            });
        });
        
        // 设置超时处理
        timeoutId = setTimeout(() => {
            console.log(`URL验证超时 - URL: ${url}`);
            request.abort();
            resolve(false);
        }, 10000);
        
        // 处理请求错误
        request.on('error', (error) => {
            clearTimeout(timeoutId);
            console.log(`URL验证错误 - URL: ${url}, 错误: ${error.message}`);
            resolve(false);
        });
    });
}

// 根据网站类型分析页面内容，验证是否包含天气信息
function analyzeContent(content, url, areaName = '', codeType = '') {
    // 基本检查：页面应该至少包含一定长度的文本
    if (!content || content.length < 500) {
        return false;
    }
    
    // 转换为小写进行比较
    const lowerContent = content.toLowerCase();
    
    // 检查是否是404或错误页面
    if (lowerContent.includes('404') && lowerContent.includes('not found')) {
        return false;
    }
    
    // 简化的验证规则，更加灵活地检测天气页面特征
    const weatherKeywords = ['weather', 'weather.cma', 'tianqi', 'nmc.cn', 'weather forecast'];
    const tempKeywords = ['temperature', 'temp', '℃', '度', '°c'];
    const generalKeywords = ['city', 'location', 'province', '地区', '城市'];
    
    // 检查网站特定的关键字
    let siteMatch = false;
    for (const keyword of weatherKeywords) {
        if (lowerContent.includes(keyword)) {
            siteMatch = true;
            break;
        }
    }
    
    // 检查温度相关关键字
    let tempMatch = false;
    for (const keyword of tempKeywords) {
        if (lowerContent.includes(keyword)) {
            tempMatch = true;
            break;
        }
    }
    
    // 检查通用地区相关关键字
    let generalMatch = false;
    for (const keyword of generalKeywords) {
        if (lowerContent.includes(keyword)) {
            generalMatch = true;
            break;
        }
    }
    
    // 根据不同网站应用不同的宽松验证规则
    if (url.includes('tianqi.moji.com')) {
        // 墨迹天气验证规则 - 更宽松
        return (siteMatch || lowerContent.includes('墨迹')) && (tempMatch || lowerContent.includes('weather'));
                
    } else if (url.includes('nmc.cn')) {
        // 国家气象中心验证规则 - 更宽松
        return (siteMatch || lowerContent.includes('气象')) && (tempMatch || lowerContent.includes('预报'));
                
    } else if (url.includes('weather.cma.cn')) {
        // 中国气象局验证规则 - 更宽松
        return (siteMatch || lowerContent.includes('气象局')) && generalMatch;
                
    } else {
        // 通用验证规则 - 更宽松
        return siteMatch || (tempMatch && generalMatch);
    }
}

// 比较两个地区的编码差异 - 只返回真正不一致的数据（排除两边都为undefined/null/''的情况）
function compareAreaCodes(area1, area2) {
    const differences = [];
    const codeTypes = ['mojiCode', 'nmcCode', 'cmaCode'];
    
    for (const codeType of codeTypes) {
        const val1 = area1[codeType];
        const val2 = area2[codeType];
        
        // 只有当两个值确实不同时才认为是差异（排除两边都为undefined/null/''的情况）
        if ((val1 === undefined || val1 === null || val1 === '') && 
            (val2 === undefined || val2 === null || val2 === '')) {
            // 两个值都为空，不记录为差异
            continue;
        }
        
        if (val1 !== val2) {
            differences.push({
                type: codeType,
                value1: val1,
                value2: val2
            });
        }
    }
    
    return differences;
}

// 检查地区编码是否符合常见规则
function isValidAreaCode(code, codeType) {
    if (!code || typeof code !== 'string') {
        return false;
    }
    
    // 根据不同编码类型设置规则
    switch (codeType) {
        case 'mojiCode':
            // 墨迹天气通常是地区拼音或拼音组合
            return /^[a-zA-Z0-9\-]+$/.test(code);
        case 'nmcCode':
            // 国家气象中心通常是数字
            return /^[0-9]+$/.test(code);
        case 'cmaCode':
            // 中国气象局通常是数字或字母组合
            return /^[A-Za-z0-9]+$/.test(code);
        default:
            return false;
    }
}

// 递归收集所有地区信息
function collectAreas(data, parentProvince = null, areasMap = {}) {
    if (!data || !Array.isArray(data)) return areasMap;
    
    data.forEach(item => {
        if (item.name && item.children && Array.isArray(item.children)) {
            const province = parentProvince || item.name;
            collectAreas(item.children, province, areasMap);
        } else if (item.name && item.code) {
            // 区县级别
            const key = `${parentProvince || item.name}-${item.name}`;
            areasMap[key] = {
                ...item,
                province: parentProvince || item.name
            };
        }
    });
    
    return areasMap;
}

// 主比较函数
async function compareMergeMethods() {
    ensureLogsDir();
    
    console.log('开始读取合并结果文件...');
    
    // 读取两个合并结果文件
    const incrementalData = readJsonFile(incrementalMergeResultPath);
    const oneTimeData = readJsonFile(oneTimeMergeResultPath);
    
    if (!incrementalData || !oneTimeData) {
        console.error('无法读取合并结果文件，比较终止');
        return;
    }
    
    console.log('文件读取完成，开始收集地区信息...');
    
    // 收集两个文件中的所有地区信息
    const incrementalAreas = collectAreas(incrementalData.data);
    const oneTimeAreas = collectAreas(oneTimeData.data);
    
    console.log(`收集完成 - 分次合并: ${Object.keys(incrementalAreas).length} 个地区, 一次性合并: ${Object.keys(oneTimeAreas).length} 个地区`);
    
    // 统计信息
    const statistics = {
        totalAreasCompared: 0,
        areasWithDifferences: 0,
        differencesByProvince: {},
        differencesByType: {
            mojiCode: 0,
            nmcCode: 0,
            cmaCode: 0
        },
        areasFoundOnlyInIncremental: 0,
        areasFoundOnlyInOneTime: 0,
        improvedMatches: [],
        // 添加不同类型数据编码的有效数据统计
        validCodesByMethod: {
            incremental: {
                mojiCode: 0,
                nmcCode: 0,
                cmaCode: 0,
                total: 0
            },
            oneTime: {
                mojiCode: 0,
                nmcCode: 0,
                cmaCode: 0,
                total: 0
            }
        }
    };
    
    // 详细差异记录
    const detailedDifferences = [];
    
    // 检查分次合并中的地区
    for (const [key, incrementalArea] of Object.entries(incrementalAreas)) {
        statistics.totalAreasCompared++;
        
        if (oneTimeAreas[key]) {
            const oneTimeArea = oneTimeAreas[key];
            
            // 统计增量合并中的有效编码
            for (const codeType of ['mojiCode', 'nmcCode', 'cmaCode']) {
                if (incrementalArea[codeType] && incrementalArea[codeType] !== '' && incrementalArea[codeType] !== null) {
                    statistics.validCodesByMethod.incremental[codeType]++;
                    statistics.validCodesByMethod.incremental.total++;
                }
            }
            
            // 统计一次性合并中的有效编码
            for (const codeType of ['mojiCode', 'nmcCode', 'cmaCode']) {
                if (oneTimeArea[codeType] && oneTimeArea[codeType] !== '' && oneTimeArea[codeType] !== null) {
                    statistics.validCodesByMethod.oneTime[codeType]++;
                    statistics.validCodesByMethod.oneTime.total++;
                }
            }
            
            const differences = compareAreaCodes(incrementalArea, oneTimeArea);
            
            if (differences.length > 0) {
                statistics.areasWithDifferences++;
                
                // 按省份统计
                if (!statistics.differencesByProvince[incrementalArea.province]) {
                    statistics.differencesByProvince[incrementalArea.province] = 0;
                }
                statistics.differencesByProvince[incrementalArea.province]++;
                
                // 记录详细差异
                detailedDifferences.push({
                    area: key,
                    province: incrementalArea.province,
                    differences: differences
                });
                
                // 检查是否有更完善的匹配
                for (const diff of differences) {
                    statistics.differencesByType[diff.type]++;
                    
                    // 一次性合并有值但分次合并没有
                    if ((diff.value1 === undefined || diff.value1 === null || diff.value1 === '') && 
                        (diff.value2 !== undefined && diff.value2 !== null && diff.value2 !== '')) {
                        statistics.improvedMatches.push({
                            area: key,
                            province: incrementalArea.province,
                            codeType: diff.type,
                            newValue: diff.value2,
                            oldValue: diff.value1
                        });
                    }
                }
            }
        } else {
            statistics.areasFoundOnlyInIncremental++;
        }
    }
    
    // 检查仅在一次性合并中存在的地区
    for (const key of Object.keys(oneTimeAreas)) {
        if (!incrementalAreas[key]) {
            statistics.areasFoundOnlyInOneTime++;
        }
    }
    
    // 生成验证URL的任务
    const validationTasks = [];
    for (const match of statistics.improvedMatches) {
        const area = oneTimeAreas[match.area];
        if (area) {
            const province = match.province;
            const urls = buildWeatherUrls(area, province);
            
            if (urls[match.codeType] !== null && urls[match.codeType] !== undefined) {
                validationTasks.push({
                    area: match.area,
                    codeType: match.codeType,
                    url: urls[match.codeType],
                    newValue: match.newValue
                });
            }
        }
    }
    
    // 执行URL验证
    console.log(`开始验证 ${statistics.improvedMatches.length} 个改进的匹配...`);
    const validationResults = [];
    
    // 使用map和Promise.all进行并行验证 - 添加编码规则检查
    const validationPromises = statistics.improvedMatches.map(async (match) => {
        const area = oneTimeAreas[match.area];
        if (area && area[match.codeType]) {
            // 直接构建URL，与报告中使用相同的逻辑
            let specificUrl = null;
            const codeValue = area[match.codeType];
            
            // 检查编码是否符合规则
            const codeValid = isValidAreaCode(codeValue, match.codeType);
            
            switch (match.codeType) {
                case 'mojiCode':
                    specificUrl = `https://tianqi.moji.com/weather/china/${codeValue}`;
                    break;
                case 'nmcCode':
                    specificUrl = `https://www.nmc.cn/publish/forecast/${codeValue}.html`;
                    break;
                case 'cmaCode':
                    specificUrl = `https://weather.cma.cn/web/weather/${codeValue}.html`;
                    break;
            }
            
            if (specificUrl) {
                // 只有当编码不符合规则时才进行URL验证
                // 符合规则的编码被认为是有效的，无需验证
                let isValid = true;
                let error = null;
                
                if (!codeValid) {
                    try {
                        console.log(`验证 ${match.codeType} ${match.area}: ${specificUrl}`);
                        // 实际调用validateWeatherUrl函数进行验证
                        isValid = await validateWeatherUrl(specificUrl);
                    } catch (err) {
                        isValid = false;
                        error = err.message;
                    }
                } else {
                    console.log(`编码规则匹配，跳过URL验证: ${match.codeType} ${match.area}`);
                }
                
                return {
                    area: match.area,
                    codeType: match.codeType,
                    url: specificUrl,
                    newValue: match.newValue,
                    isValid: isValid,
                    codeValid: codeValid,
                    error: error,
                    manualCheck: !codeValid
                };
            } else {
                // URL构建失败的情况
                return {
                    area: match.area,
                    codeType: match.codeType,
                    url: 'URL构建失败',
                    newValue: match.newValue,
                    isValid: false,
                    codeValid: false,
                    error: '无法构建有效的URL'
                };
            }
        }
        return null;
    });
    
    // 等待所有验证完成
    const results = await Promise.all(validationPromises);
    // 过滤掉null结果并添加到validationResults
    results.forEach(result => {
        if (result) {
            validationResults.push(result);
        }
    });
    
    // 生成报告
    console.log('生成比较报告...');
    generateComparisonReport(statistics, detailedDifferences, validationResults, oneTimeAreas);
    
    console.log('比较完成！');
}

// 生成比较报告
function generateComparisonReport(statistics, detailedDifferences, validationResults, oneTimeAreas) {
    const report = [
        '==================================================',
        '分次合并与一次性合并结果比较报告',
        `生成时间: ${new Date().toLocaleString()}`,
        '==================================================',
        '',
        '1. 总体统计信息:',
        `   比较的地区总数: ${statistics.totalAreasCompared}`,
        `   存在差异的地区数: ${statistics.areasWithDifferences}`,
        `   仅在分次合并中存在的地区数: ${statistics.areasFoundOnlyInIncremental}`,
        `   仅在一次性合并中存在的地区数: ${statistics.areasFoundOnlyInOneTime}`,
        '',
        '2. 差异类型统计:',
        `   mojiCode差异: ${statistics.differencesByType.mojiCode}`,
        `   nmcCode差异: ${statistics.differencesByType.nmcCode}`,
        `   cmaCode差异: ${statistics.differencesByType.cmaCode}`,
        '',
        '3. 分省份差异统计:'
    ];
    
    // 添加分省份统计
    const provinces = Object.keys(statistics.differencesByProvince).sort();
    if (provinces.length > 0) {
        provinces.forEach(province => {
            report.push(`   ${province}: ${statistics.differencesByProvince[province]} 个地区`);
        });
    } else {
        report.push('   未发现差异');
    }
    
    // 添加不同类型数据编码的有效数据统计
    report.push('', '4. 不同类型数据编码的有效数据统计:');
    report.push('   分次合并方式有效数据:');
    report.push(`     mojiCode: ${statistics.validCodesByMethod.incremental.mojiCode} 个`);
    report.push(`     nmcCode: ${statistics.validCodesByMethod.incremental.nmcCode} 个`);
    report.push(`     cmaCode: ${statistics.validCodesByMethod.incremental.cmaCode} 个`);
    report.push(`     总计: ${statistics.validCodesByMethod.incremental.total} 个`);
    report.push('');
    report.push('   一次性合并方式有效数据:');
    report.push(`     mojiCode: ${statistics.validCodesByMethod.oneTime.mojiCode} 个`);
    report.push(`     nmcCode: ${statistics.validCodesByMethod.oneTime.nmcCode} 个`);
    report.push(`     cmaCode: ${statistics.validCodesByMethod.oneTime.cmaCode} 个`);
    report.push(`     总计: ${statistics.validCodesByMethod.oneTime.total} 个`);
    report.push('');
    
    // 计算并显示有效数据差异
    const mojiDiff = statistics.validCodesByMethod.oneTime.mojiCode - statistics.validCodesByMethod.incremental.mojiCode;
    const nmcDiff = statistics.validCodesByMethod.oneTime.nmcCode - statistics.validCodesByMethod.incremental.nmcCode;
    const cmaDiff = statistics.validCodesByMethod.oneTime.cmaCode - statistics.validCodesByMethod.incremental.cmaCode;
    const totalDiff = statistics.validCodesByMethod.oneTime.total - statistics.validCodesByMethod.incremental.total;
    
    report.push('   一次性合并相比分次合并的有效数据变化:');
    report.push(`     mojiCode: ${mojiDiff >= 0 ? '+' : ''}${mojiDiff} 个`);
    report.push(`     nmcCode: ${nmcDiff >= 0 ? '+' : ''}${nmcDiff} 个`);
    report.push(`     cmaCode: ${cmaDiff >= 0 ? '+' : ''}${cmaDiff} 个`);
    report.push(`     总计: ${totalDiff >= 0 ? '+' : ''}${totalDiff} 个`);
    
    // 创建验证结果映射，便于快速查找（用于详细差异记录筛选）
    const validationResultsMap = new Map();
    validationResults.forEach(result => {
        validationResultsMap.set(`${result.area}-${result.codeType}`, result);
    });
    
    // 过滤出需要显示的差异（只有URL验证失败的才显示）
    const invalidDifferences = detailedDifferences.filter(diff => {
        return diff.differences.some(d => {
            // 只有当这是一次性合并增加的数据且URL验证失败时才显示
            if ((d.value1 === undefined || d.value1 === null || d.value1 === '') && 
                (d.value2 !== undefined && d.value2 !== null && d.value2 !== '')) {
                const validationResult = validationResultsMap.get(`${diff.area}-${d.type}`);
                // 当验证结果存在且验证失败，或者没有验证结果时显示
                return validationResult ? !validationResult.isValid : true;
            }
            return false;
        });
    });
    
    // 添加详细差异 - 只显示URL验证失败的
    report.push('', '5. 详细差异记录（仅显示URL验证失败的数据）:');
    if (invalidDifferences.length > 0) {
        invalidDifferences.forEach(diff => {
            // 只显示有实际差异的地区
            report.push(`   ${diff.province} - ${diff.area}:`);
            diff.differences.forEach(d => {
                // 只显示真正不一致的数据且URL验证失败
                if ((d.value1 === undefined || d.value1 === null || d.value1 === '') && 
                    (d.value2 !== undefined && d.value2 !== null && d.value2 !== '')) {
                    const validationResult = validationResultsMap.get(`${diff.area}-${d.type}`);
                    if (validationResult ? !validationResult.isValid : true) {
                        report.push(`     ${d.type}: 分次合并="${d.value1 || 'undefined'}", 一次性合并="${d.value2 || 'undefined'}"`);
                    }
                }
            });
        });
    } else {
        report.push('   未发现URL验证失败的详细差异');
    }
    
    // 添加改进匹配验证结果
    report.push('', '6. 一次性合并改进的匹配验证结果:');
    if (statistics.improvedMatches.length > 0) {
        report.push(`   改进匹配总数: ${statistics.improvedMatches.length}`);
        report.push('');
        report.push('   改进匹配详情:');
        
        // 使用已创建的验证结果映射
        
        // 按省份和类型分组显示，但只显示异常数据
        const groupedByProvince = {};
        // 过滤出需要显示的异常数据
        const exceptionsToShow = [];
        
        statistics.improvedMatches.forEach(match => {
            const validationResult = validationResultsMap.get(`${match.area}-${match.codeType}`);
            const area = oneTimeAreas[match.area];
            const codeValue = area ? area[match.codeType] : null;
            
            // 判断是否需要显示：编码不符合规则、URL验证失败、缺少验证结果
            let needsDisplay = false;
            
            if (validationResult) {
                // 编码不符合规则或URL验证失败
                needsDisplay = !validationResult.codeValid || !validationResult.isValid;
            } else {
                // 没有验证结果
                needsDisplay = true;
            }
            
            if (needsDisplay) {
                exceptionsToShow.push(match);
                if (!groupedByProvince[match.province]) {
                    groupedByProvince[match.province] = [];
                }
                groupedByProvince[match.province].push(match);
            }
        });
        
        // 只在有异常数据时显示
        if (Object.keys(groupedByProvince).length > 0) {
            Object.keys(groupedByProvince).sort().forEach(province => {
                report.push(`   ${province}:`);
                groupedByProvince[province].forEach(match => {
                    const areaName = match.area.replace(`${province}-`, '');
                    const area = oneTimeAreas[match.area];
                    const codeValue = area ? area[match.codeType] : null;
                    const validationResult = validationResultsMap.get(`${match.area}-${match.codeType}`);
                    
                    // 只显示异常数据
                    report.push(`     ${areaName} (${match.codeType}): ${match.newValue}`);
                    
                    if (codeValue) {
                        // 直接构建URL
                        let specificUrl = null;
                        
                        switch (match.codeType) {
                            case 'mojiCode':
                                specificUrl = `https://tianqi.moji.com/weather/china/${codeValue}`;
                                break;
                            case 'nmcCode':
                                specificUrl = `https://www.nmc.cn/publish/forecast/${codeValue}.html`;
                                break;
                            case 'cmaCode':
                                specificUrl = `https://weather.cma.cn/web/weather/${codeValue}.html`;
                                break;
                        }
                        
                        if (specificUrl) {
                            if (validationResult) {
                                if (!validationResult.codeValid) {
                                    // 编码不符合规则
                                    report.push(`       ⚠️ 编码格式异常: ${codeValue}`);
                                    report.push(`       ℹ️ URL: ${specificUrl}`);
                                    report.push(`       ℹ️ 建议操作: 请检查此${match.codeType}格式是否正确`);
                                }
                                
                                if (!validationResult.isValid) {
                                    // URL验证失败
                                    const errorMsg = validationResult.error || '验证失败';
                                    report.push(`       ❌ URL验证失败: ${specificUrl}`);
                                    report.push(`       ⚠️ 失败原因: ${errorMsg}`);
                                    report.push(`       ℹ️ 建议操作: 请检查此${match.codeType}是否正确，或考虑使用其他来源的数据`);
                                }
                            } else {
                                // 没有验证结果
                                report.push(`       ⚠️ 未验证URL: ${specificUrl}`);
                                report.push(`       ℹ️ 建议操作: 请手动验证此URL是否可访问`);
                            }
                        } else {
                            // 不支持的编码类型
                            report.push(`       ❌ 不支持的编码类型: ${match.codeType}`);
                            report.push(`       ℹ️ 建议操作: 请检查编码类型是否正确`);
                        }
                    } else {
                        report.push(`       ❌ 无法构建URL: ${match.codeType} 不存在`);
                        report.push(`       ℹ️ 建议操作: 请检查一次性合并数据中是否缺少${match.codeType}`);
                    }
                });
            });
        } else {
            report.push('   所有改进匹配均符合编码规则，无需异常提示');
        }
    } else {
        report.push('   未发现需要验证的改进匹配');
    }
    
    // 添加总结
    report.push('', '7. 总结:');
    if (statistics.areasWithDifferences === 0) {
        report.push('   两种合并方式的结果完全一致。');
    } else {
        report.push(`   在 ${statistics.areasWithDifferences} 个地区发现差异。`);
        
        // 只在存在无效URL时显示验证统计信息
        if (validationResults.length > 0) {
            const invalidCount = validationResults.filter(r => !r.isValid).length;
            const totalCount = validationResults.length;
            
            if (invalidCount > 0) {
                report.push(`   发现 ${invalidCount} 个无效的改进匹配（共 ${totalCount} 个）。`);
            }
        }
    }
    
    // 写入报告文件
    const reportContent = report.join('\n');
    fs.writeFileSync(reportFilePath, reportContent, 'utf8');
    
    // 同时输出到控制台
    console.log('\n' + reportContent);
    console.log(`\n报告已保存至: ${reportFilePath}`);
}

// 运行比较
compareMergeMethods().catch(error => {
    console.error('比较过程中发生错误:', error);
    process.exit(1);
});