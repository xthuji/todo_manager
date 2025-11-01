const https = require('https');
const fs = require('fs');
const path = require('path');

// 结果路径
const AREA_CODES_FILE_PATH = path.resolve(__dirname, '../../../../todolist/data/weather/moji_weather_area_codes.json');
const PROVINCES_FILE_PATH = path.resolve(__dirname, '../../../../todolist/data/weather/moji_china_provinces.json');

// 发送HTTP请求并正确处理编码
function sendRequest(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
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
                    // 处理可能的编码问题
                    const cleanData = cleanEncoding(data);
                    resolve(cleanData);
                } catch (error) {
                    reject(new Error(`处理响应失败: ${error.message}`));
                }
            });
        }).on('error', (error) => {
            reject(new Error(`请求失败: ${error.message}`));
        });
    });
}

// 清理编码问题，处理乱码和HTML实体
function cleanEncoding(text) {
    // 替换常见的乱码字符
    return text
        .replace(/\ufffd/g, '') // 移除Unicode替换字符
        .replace(/&#39;/g, "'")  // 解码HTML实体单引号
        .replace(/&quot;/g, '"') // 解码HTML实体双引号
        .replace(/&amp;/g, '&')   // 解码HTML实体&符号
        .replace(/&lt;/g, '<')    // 解码HTML实体<符号
        .replace(/&gt;/g, '>')    // 解码HTML实体>符号
        .trim();
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

// 从HTML中提取地区编码数据
function extractAreaCodesFromHtml(html, provinceName) {
    const areaCodes = [];
    
    // 使用正则表达式提取地区信息
    // 查找形如 <a href="//m.moji.com/weather/china/beijing/beijing-olympic-forest-park">北京奥林匹克公园</a> 的结构
    const areaRegex = /<li>\s*<a\s+href="\/\/m\.moji\.com\/weather\/china\/[^\/]+\/([^"]+)"[^>]*>([^<]+)<\/a>\s*<\/li>/g;
    let match;
    
    while ((match = areaRegex.exec(html)) !== null) {
        const code = match[1];
        const name = cleanEncoding(match[2]);
        
        if (code && name) { // 过滤无效数据
            areaCodes.push({
                name: name,
                code: code
            });
        }
    }
    
    return areaCodes;
}

// 抓取指定省份的地区编码数据
async function fetchAreasByProvince(province) {
    console.log(`正在抓取省份 ${province.name} 的地区数据...`);
    const url = `https://m.moji.com/weather/china/${province.code}`;
    
    try {
        const html = await sendRequest(url);
        const areas = extractAreaCodesFromHtml(html, province.name);
        
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