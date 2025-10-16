const https = require('https');
const fs = require('fs');
const path = require('path');

// 结果路径
const AREA_CODES_FILE_PATH = path.resolve(__dirname, '../../../../todolist/data/weather/cma_weather_area_codes.json');
const PROVINCES_FILE_PATH = path.resolve(__dirname, '../../../../todolist/data/weather/cma_china_provinces.json');

// 发送HTTP请求并处理响应
function sendRequest(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'zh-CN,zh;q=0.9',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        };
        
        https.get(url, options, (res) => {
            // 设置响应编码为utf8
            res.setEncoding('utf8');
            
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    // 尝试解析JSON响应
                    const jsonData = JSON.parse(data);
                    resolve(jsonData);
                } catch (error) {
                    reject(new Error(`解析JSON失败: ${error.message}`));
                }
            });
        }).on('error', (error) => {
            reject(new Error(`请求失败: ${error.message}`));
        });
    });
}

// 读取省份数据
function readProvincesData() {
    console.log('开始读取省份数据...');
    try {
        const data = fs.readFileSync(PROVINCES_FILE_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        throw new Error(`读取省份数据失败: ${error.message}`);
    }
}

// 抓取指定省份的地区编码数据
async function fetchAreasByProvince(province) {
    console.log(`正在抓取省份 ${province.name} 的地区数据...`);
    const url = `https://weather.cma.cn/api/dict/province/${province.code}`;
    
    try {
        const response = await sendRequest(url);
        
        // 检查响应是否成功
        if (response.code !== 0 || !response.data) {
            console.warn(`获取 ${province.name} 的数据失败，响应状态: ${response.code || '未知'}`);
            return null;
        }
        
        // 提取地区信息
        const areas = [];
        
        // 处理字符串格式的数据
        if (typeof response.data === 'string') {
            console.log(`${province.name} 数据格式: 字符串`);
            
            // 特殊处理香港特别行政区
            if (province.name.includes('香港')) {
                console.log('特殊处理香港特别行政区数据');
                console.log(`香港原始数据: ${response.data}`);
                
                // 香港数据可能没有|分隔符，直接检查格式
                if (response.data.includes('香港天文台')) {
                    // 香港数据格式: 编码,名称
                    const parts = response.data.split(',');
                    if (parts.length >= 2) {
                        const code = parts[0].trim();
                        const name = parts.slice(1).join(',').trim(); // 处理名称中可能包含逗号的情况
                        console.log(`香港提取: 编码=${code}, 名称=${name}`);
                        if (code && name) {
                            areas.push({
                                name: name,
                                code: code
                            });
                        }
                    }
                }
            } else {
                // 先用 | 符号分割成地区条目列表
                const areaEntries = response.data.split('|');
                
                console.log(`${province.name} 原始数据样本: ${response.data.substring(0, 100)}...`);
                console.log(`${province.name} 分割后条目数: ${areaEntries.length}`);
                
                for (const entry of areaEntries) {
                    // 跳过空条目
                    if (!entry.trim()) continue;
                    
                    // 用 , 符号分割取地区编码和名称
                    // 格式应该是：编码,名称
                    const parts = entry.split(',');
                    
                    if (parts.length >= 2) {
                        const code = parts[0].trim();
                        // 处理名称中可能包含逗号的情况
                        const name = parts.slice(1).join(',').trim();
                        
                        if (code && name) {
                            // 检查编码是否为有效格式
                            if (/^[A-Z0-9]+$/.test(code)) {
                                areas.push({
                                    name: name,
                                    code: code
                                });
                                // 减少日志输出，只显示部分
                                if (areas.length <= 3 || areas.length % 10 === 0) {
                                    console.log(`${province.name} 添加地区: ${name} (${code})`);
                                }
                            } else {
                                console.log(`${province.name} 跳过无效编码: ${code} (地区: ${name})`);
                            }
                        }
                    } else if (parts.length === 1) {
                        // 处理可能只有名称没有编码的情况
                        const name = parts[0].trim();
                        if (name && name.length > 1) {
                            console.log(`${province.name} 发现无编码地区: ${name}`);
                        }
                    } else {
                        console.log(`${province.name} 跳过格式异常的条目: ${entry}`);
                    }
                }
            }
        } else {
            console.log(`${province.name} 数据格式未知:`, typeof response.data);
            // 尝试显示数据预览
            try {
                const preview = JSON.stringify(response.data).substring(0, 100);
                console.log(`${province.name} 数据预览: ${preview}...`);
            } catch (e) {
                console.log(`${province.name} 无法显示数据预览`);
            }
        }
        
        // 记录提取的地区数量
        console.log(`${province.name} 提取到 ${areas.length} 个地区`);
        
        // 构建省份数据结构
        const provinceData = {
            name: province.name,
            code: province.code,
            children: areas
        };
        
        console.log(`成功抓取 ${province.name} 的 ${areas.length} 个地区`);
        return provinceData;
    } catch (error) {
        console.error(`抓取 ${province.name} 的地区数据失败:`, error.message);
        return null;
    }
}

// 主函数
async function main() {
    try {
        // 1. 读取所有省份数据
        const provinces = readProvincesData();
        console.log(`成功读取到 ${provinces.length} 个省份`);
        
        // 2. 并行抓取每个省份的地区数据
        const result = {
            timestamp: Date.now(),
            data: []
        };
        
        // 并行处理省份数据抓取
        const provincePromises = provinces.map(async (province) => {
            try {
                // 添加延迟避免请求过于集中，但保持并行性
                const delay = Math.random() * 1000; // 随机延迟0-1000ms
                await new Promise(resolve => setTimeout(resolve, delay));
                
                return await fetchAreasByProvince(province);
            } catch (error) {
                console.error(`处理 ${province.name} 时发生错误:`, error.message);
                return null;
            }
        });
        
        // 等待所有省份数据抓取完成
        const provinceResults = await Promise.all(provincePromises);
        
        // 过滤掉失败的省份数据（null值）
        result.data = provinceResults.filter(data => data !== null && data.children && data.children.length > 0);
        
        // 3. 保存结果
        // 确保目录存在
        const outputDir = path.dirname(AREA_CODES_FILE_PATH);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            console.log(`创建目录: ${outputDir}`);
        }
        
        fs.writeFileSync(AREA_CODES_FILE_PATH, JSON.stringify(result, null, 2));
        console.log(`数据已保存到: ${AREA_CODES_FILE_PATH}`);
        console.log(`总共成功抓取 ${result.data.length} 个省份的地区数据`);
        
        // 统计总地区数量
        const totalAreas = result.data.reduce((sum, province) => sum + province.children.length, 0);
        console.log(`总共抓取到 ${totalAreas} 个地区`);
        
    } catch (error) {
        console.error('抓取过程中发生错误:', error.message);
        process.exit(1);
    }
}

// 执行主函数
main();