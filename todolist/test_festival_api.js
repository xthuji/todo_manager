// 测试节日API返回格式
const http = require('http');

function testFestivalApi() {
    console.log('开始测试节日配置API...');
    
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/festival/config',
        method: 'GET'
    };

    const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            try {
                const response = JSON.parse(data);
        console.log('API返回数据结构分析:');
        console.log('- 顶层字段:', Object.keys(response));
        
        // 深度检查是否有嵌套的data字段
        if (response.data && response.data.data) {
            console.log('✗ 发现嵌套的data字段！数据结构错误');
            console.log('- 嵌套数据的timestamp:', response.data.timestamp);
        } else if (response.hasOwnProperty('data') && response.hasOwnProperty('timestamp')) {
            console.log('✓ API返回格式正确，包含data和timestamp字段');
            console.log('- data字段类型:', typeof response.data);
            
            if (typeof response.data === 'object' && response.data) {
                console.log('- data内部字段:', Object.keys(response.data));
                
                if (response.data.festivals) {
                    console.log('- festivals字段类型:', Array.isArray(response.data.festivals) ? '数组' : typeof response.data.festivals);
                    if (Array.isArray(response.data.festivals)) {
                        console.log(`✓ 节日数据存在，共${response.data.festivals.length}个节日`);
                        console.log('测试成功！');
                    } else {
                        console.log('! festivals字段不是数组');
                    }
                } else {
                    console.log('! 缺少festivals字段');
                }
            } else {
                console.log('! data字段不是有效的对象');
            }
        } else {
            console.log('✗ API返回格式错误，缺少必要的data或timestamp字段');
        }
            } catch (error) {
                console.error('解析返回数据失败:', error);
            }
        });
    });

    req.on('error', (error) => {
        console.error('请求失败:', error.message);
    });

    req.end();
}

testFestivalApi();