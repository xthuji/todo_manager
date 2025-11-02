const fs = require('fs');
const path = require('path');

// 文件路径
const BASE_DIR = path.join(__dirname, '../../../');
const stepByStepMergePath = path.join(BASE_DIR, 'data/weather/merged_tianqi_moji_nmc_cma_area_codes.json');
const oneTimeMergePath = path.join(BASE_DIR, 'data/weather/merged_weather_area_codes.json');

function readJsonFile(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`读取文件 ${filePath} 失败:`, error.message);
        return null;
    }
}

function countTotalLines(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return data.split('\n').length;
    } catch (error) {
        console.error(`计算文件行数失败:`, error.message);
        return 0;
    }
}

function countAreaCodes(data) {
    let totalCount = 0;
    let validCodesByType = {
        mojiCode: 0,
        nmcCode: 0,
        cmaCode: 0
    };
    
    function traverseAreas(areas) {
        if (!Array.isArray(areas)) return;
        
        areas.forEach(area => {
            totalCount++;
            
            // 统计有效编码
            if (area.mojiCode && area.mojiCode !== null && area.mojiCode !== undefined) {
                validCodesByType.mojiCode++;
            }
            if (area.nmcCode && area.nmcCode !== null && area.nmcCode !== undefined) {
                validCodesByType.nmcCode++;
            }
            if (area.cmaCode && area.cmaCode !== null && area.cmaCode !== undefined) {
                validCodesByType.cmaCode++;
            }
            
            // 递归遍历子区域
            if (area.children && Array.isArray(area.children)) {
                traverseAreas(area.children);
            }
        });
    }
    
    // 开始遍历
    if (data && data.data && Array.isArray(data.data)) {
        traverseAreas(data.data);
    }
    
    return {
        totalCount,
        validCodesByType
    };
}

function compareFiles() {
    console.log('开始分析合并结果文件...');
    
    // 读取文件
    const stepByStepData = readJsonFile(stepByStepMergePath);
    const oneTimeData = readJsonFile(oneTimeMergePath);
    
    if (!stepByStepData || !oneTimeData) {
        console.error('无法读取文件数据，分析终止。');
        return;
    }
    
    // 计算文件行数
    const stepByStepLines = countTotalLines(stepByStepMergePath);
    const oneTimeLines = countTotalLines(oneTimeMergePath);
    
    // 统计地区数据
    const stepByStepStats = countAreaCodes(stepByStepData);
    const oneTimeStats = countAreaCodes(oneTimeData);
    
    // 生成分析报告
    console.log('\n===== 文件大小分析 =====');
    console.log(`分次合并文件行数: ${stepByStepLines}`);
    console.log(`一次性合并文件行数: ${oneTimeLines}`);
    console.log(`行数差异: ${stepByStepLines - oneTimeLines} (分次合并 - 一次性合并)`);
    
    console.log('\n===== 地区数量分析 =====');
    console.log(`分次合并地区总数: ${stepByStepStats.totalCount}`);
    console.log(`一次性合并地区总数: ${oneTimeStats.totalCount}`);
    console.log(`地区数量差异: ${stepByStepStats.totalCount - oneTimeStats.totalCount} (分次合并 - 一次性合并)`);
    
    console.log('\n===== 有效编码统计 =====');
    console.log('分次合并有效编码:');
    console.log(`  mojiCode: ${stepByStepStats.validCodesByType.mojiCode}`);
    console.log(`  nmcCode: ${stepByStepStats.validCodesByType.nmcCode}`);
    console.log(`  cmaCode: ${stepByStepStats.validCodesByType.cmaCode}`);
    
    console.log('\n一次性合并有效编码:');
    console.log(`  mojiCode: ${oneTimeStats.validCodesByType.mojiCode}`);
    console.log(`  nmcCode: ${oneTimeStats.validCodesByType.nmcCode}`);
    console.log(`  cmaCode: ${oneTimeStats.validCodesByType.cmaCode}`);
    
    console.log('\n编码差异 (一次性合并 - 分次合并):');
    console.log(`  mojiCode: ${oneTimeStats.validCodesByType.mojiCode - stepByStepStats.validCodesByType.mojiCode}`);
    console.log(`  nmcCode: ${oneTimeStats.validCodesByType.nmcCode - stepByStepStats.validCodesByType.nmcCode}`);
    console.log(`  cmaCode: ${oneTimeStats.validCodesByType.cmaCode - stepByStepStats.validCodesByType.cmaCode}`);
    
    // 详细分析cmaCode差异
    const cmaDiff = oneTimeStats.validCodesByType.cmaCode - stepByStepStats.validCodesByType.cmaCode;
    if (cmaDiff > 0) {
        console.log(`\n验证结果: 一次性合并确实在cmaCode方面增加了 ${cmaDiff} 个有效数据。`);
        console.log('这解释了为什么虽然分次合并文件行数更多，但一次性合并匹配到了更多有效的数据。');
    } else if (cmaDiff < 0) {
        console.log(`\n验证结果: 分次合并在cmaCode方面有 ${Math.abs(cmaDiff)} 个更多的有效数据。`);
    } else {
        console.log('\n验证结果: 两种合并方式在cmaCode有效数据数量上相同。');
    }
    
    // 分析可能的原因
    console.log('\n===== 可能的原因分析 =====');
    console.log('1. 文件行数多并不一定代表有效数据多，可能包含更多的空白行或冗余数据');
    console.log('2. JSON格式的差异（如缩进、空格使用）会影响文件行数但不影响实际数据');
    console.log('3. 一次性合并可能采用了更高效的数据处理方式，保留了更多有效的编码信息');
    console.log('4. 分次合并可能在中间步骤中丢失了某些编码信息');
}

// 执行分析
compareFiles();