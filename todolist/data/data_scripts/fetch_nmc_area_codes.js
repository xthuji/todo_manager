const https = require('https');
const fs = require('fs');
const path = require('path');

// 结果路径
const AREA_CODES_FILE_PATH = path.resolve(__dirname, '../weather/nmc_weather_area_codes.json');

// 获取时间戳
function getTimestamp() {
    return Date.now();
}

// 发送HTTP请求并正确处理编码
function sendRequest(url) {
    return new Promise((resolve, reject) => {
        const options = {
            url: url,
            headers: {
                'Accept': 'application/json',
                'Accept-Language': 'zh-CN,zh;q=0.9'
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
                    // 处理可能的编码问题
                    const cleanData = cleanEncoding(data);
                    const parsedData = JSON.parse(cleanData);
                    resolve(parsedData);
                } catch (error) {
                    reject(new Error(`解析响应失败: ${error.message}`));
                }
            });
        }).on('error', (error) => {
            reject(new Error(`请求失败: ${error.message}`));
        });
    });
}

// 清理编码问题，处理乱码
function cleanEncoding(text) {
    // 替换常见的乱码字符
    return text
        .replace(/\ufffd/g, '') // 移除Unicode替换字符
        .replace(/香港特别行[^区]+区/g, '香港特别行政区') // 修复香港特别行政区的乱码
        .replace(/澳门特别行[^区]+区/g, '澳门特别行政区') // 修复澳门特别行政区的乱码
        .replace(/台湾省/g, '台湾省'); // 确保台湾省名称正确
}

// 抓取所有省份的编码数据
async function fetchProvinces() {
    console.log('开始抓取省份编码数据...');
    const url = `https://www.nmc.cn/rest/province/all?_=${getTimestamp()}`;
    const provinces = await sendRequest(url);
    
    // 提取每个省份的编码（截取code的最后三个字符）
    return provinces.map(prov => ({
        name: prov.name,
        code: prov.code.slice(-3) // 只取最后的编码
    }));
}

// 抓取指定省份的地区编码数据
async function fetchCitiesByProvince(provinceCode) {
    console.log(`正在抓取省份编码 ${provinceCode} 的地区数据...`);
    const url = `https://www.nmc.cn/rest/province/${provinceCode}?_=${getTimestamp()}`;
    return await sendRequest(url);
}

// 主函数
async function main() {
    try {
        // 1. 抓取所有省份
        const provinces = await fetchProvinces();
        console.log(`成功抓取到 ${provinces.length} 个省份`);
        
        // 2. 并行抓取每个省份的地区数据
        const result = {
            timestamp: Date.now(),
            data: []
        };
        
        // 并行处理省份数据抓取
        const provincePromises = provinces.map(async (province) => {
            try {
                // 添加延迟避免请求过于集中，但保持并行性
                const delay = Math.random() * 500; // 随机延迟0-500ms
                await new Promise(resolve => setTimeout(resolve, delay));
                
                const cities = await fetchCitiesByProvince(province.code);
                
                // 构建数据结构
                const provinceData = {
                    name: cleanEncoding(province.name),
                    code: province.code,
                    children: cities.map(city => ({
                        name: cleanEncoding(city.city || '未知城市'),
                        code: city.code,
                        nameCode: city.url.split('/').pop().replace('.html', ''),
                    }))
                };
                
                console.log(`成功抓取 ${province.name} 的 ${cities.length} 个地区`);
                return provinceData;
            } catch (error) {
                console.error(`抓取 ${province.name} 的地区数据失败:`, error.message);
                return null; // 返回null以便后续过滤
            }
        });
        
        // 等待所有省份数据抓取完成
        const provinceResults = await Promise.all(provincePromises);
        
        // 过滤掉失败的省份数据（null值）
        result.data = provinceResults.filter(data => data !== null);
        
        // 3. 保存结果到新目录
        // 确保目录存在
        const outputDir = path.dirname(AREA_CODES_FILE_PATH);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            console.log(`创建目录: ${outputDir}`);
        }
        
        fs.writeFileSync(AREA_CODES_FILE_PATH, JSON.stringify(result, null, 2));
        console.log(`数据已保存到: ${AREA_CODES_FILE_PATH}`);
        console.log(`总共成功抓取 ${result.data.length} 个省份的地区数据`);
        
    } catch (error) {
        console.error('抓取过程中发生错误:', error.message);
        process.exit(1);
    }
}

// 执行主函数
main();