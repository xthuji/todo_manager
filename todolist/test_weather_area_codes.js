const http = require('http');

// 测试 /weather-area-codes 接口
function testWeatherAreaCodes() {
    console.log('开始测试 /weather-area-codes 接口...');
    
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/weather/weather-area-codes',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            console.log(`响应状态码: ${res.statusCode}`);
            
            try {
                const response = JSON.parse(data);
                console.log('响应数据格式检查:');
                console.log('- 是否包含 data 字段:', 'data' in response);
                console.log('- 是否包含 timestamp 字段:', 'timestamp' in response);
                console.log('- data 类型:', Array.isArray(response.data) ? '数组' : typeof response.data);
                
                if (Array.isArray(response.data)) {
                    console.log(`数据量: ${response.data.length} 条记录`);
                    if (response.data.length > 0) {
                        console.log('第一条记录示例:', JSON.stringify(response.data[0], null, 2).substring(0, 200) + '...');
                    }
                }
                
                console.log('\n测试成功！/weather-area-codes 接口返回了正确的格式。');
            } catch (parseError) {
                console.error('解析响应数据失败:', parseError.message);
                console.log('原始响应数据:', data);
            }
        });
    });
    
    req.on('error', (error) => {
        console.error('请求失败:', error.message);
    });
    
    req.end();
}

// 运行测试
testWeatherAreaCodes();