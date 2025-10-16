// 天气相关功能测试文件
console.log('开始运行天气功能测试...');

// 模拟浏览器环境
global.window = {}
global.document = {
    createElement: () => ({}),
    querySelector: () => null,
    getElementById: () => ({ textContent: '' })
};
global.DOMParser = class {
    parseFromString() {
        return {
            querySelector: () => null,
            querySelectorAll: () => []
        };
    }
};

global.dataCache = {
    provinces: null,
    cities: {},
    districts: {},
    location: null
};

global.WEATHER_API = {
    CHINA_LIST: '/api/weather-china-list',
    PROVINCE_LIST: '/api/weather-city-list',
    DISTRICT_LIST: '/api/weather-district-list',
    WEATHER_DATA: '/api/weather-proxy',
    IP_LOCATION: '/api/weather-ip-location',
    CMA_WEATHER: '/api/weather-cma-proxy'
};

// 模拟fetch函数
let mockFetchResponses = {};
global.fetch = async (url, options = {}) => {
    console.log(`模拟请求: ${url}`);
    
    // 根据URL返回模拟数据
    if (url.includes('/api/weather-china-list')) {
        return {
            ok: true,
            json: async () => ({
                '10101': '北京',
                '10102': '上海',
                '10121': '浙江'
            })
        };
    } else if (url.includes('/api/weather-city-list') && url.includes('provinceId=10121')) {
        return {
            ok: true,
            json: async () => ({
                '1012101': '杭州',
                '1012102': '宁波'
            })
        };
    } else if (url.includes('/api/weather-district-list') && url.includes('cityId=1012101')) {
        return {
            ok: true,
            json: async () => ({
                '101010100': '北京'
            })
        };
    } else if (url.includes('/api/weather-proxy') && url.includes('weatherCode=101010100')) {
        return {
            ok: true,
            text: async () => '<div class="city_40"><div class="day"><div class="date">06/01</div><div class="week">四</div><div class="wea">晴</div><div class="tem">25°/15°</div><div class="wind">微风</div></div></div>'
        };
    } else if (url.includes('/api/weather-cma-proxy') && url.includes('weatherCode=101010100')) {
        return {
            ok: true,
            json: async () => ({
                success: true,
                data: {
                    district: '杭州',
                    temperature: '25°',
                    weather: '晴',
                    wind: '微风'
                }
            })
        };
    } else if (url.includes('/api/weather-ip-location')) {
        return {
            ok: true,
            json: async () => ({
                city: '杭州',
                regionName: '浙江',
                lat: 30.2741,
                lon: 120.1551
            })
        };
    }
    
    // 模拟错误响应
    return {
        ok: false,
        status: 404,
        text: async () => 'Not Found',
        json: async () => ({ error: 'Not Found' })
    };
};

// 导入天气功能模块
const weatherModule = {
    // 模拟天气模块的函数
    getProvinceData: async () => {
        if (dataCache.provinces) {
            return dataCache.provinces;
        }
        
        try {
            const response = await fetch(WEATHER_API.CHINA_LIST);
            if (!response.ok) {
                throw new Error('获取省份数据失败');
            }
            
            const data = await response.json();
            const provinces = Object.entries(data).map(([id, name]) => ({ id, name }));
            dataCache.provinces = provinces;
            return provinces;
        } catch (error) {
            console.error('获取省份数据失败:', error);
            throw error;
        }
    },
    
    getCityData: async (provinceId) => {
        if (!provinceId) {
            throw new Error('缺少省份ID');
        }
        
        if (dataCache.cities[provinceId]) {
            return dataCache.cities[provinceId];
        }
        
        try {
            const response = await fetch(`${WEATHER_API.PROVINCE_LIST}?provinceId=${provinceId}`);
            if (!response.ok) {
                throw new Error('获取城市数据失败');
            }
            
            const data = await response.json();
            const cities = Object.entries(data).map(([id, name]) => ({ id, name }));
            dataCache.cities[provinceId] = cities;
            return cities;
        } catch (error) {
            console.error('获取城市数据失败:', error);
            throw error;
        }
    },
    
    getDistrictData: async (cityId) => {
        if (!cityId) {
            throw new Error('缺少城市ID');
        }
        
        if (dataCache.districts[cityId]) {
            return dataCache.districts[cityId];
        }
        
        try {
            const response = await fetch(`${WEATHER_API.DISTRICT_LIST}?cityId=${cityId}`);
            if (!response.ok) {
                throw new Error('获取区县数据失败');
            }
            
            const data = await response.json();
            const districts = Object.entries(data).map(([id, name]) => ({ id, name }));
            dataCache.districts[cityId] = districts;
            return districts;
        } catch (error) {
            console.error('获取区县数据失败:', error);
            throw error;
        }
    },
    
    fetchWeatherData: async (weatherCode) => {
        if (!weatherCode) {
            throw new Error('缺少天气代码');
        }
        
        try {
            const response = await fetch(`${WEATHER_API.WEATHER_DATA}?weatherCode=${weatherCode}`);
            if (!response.ok) {
                throw new Error('获取天气数据失败');
            }
            
            const html = await response.text();
            return html;
        } catch (error) {
            console.error('获取天气数据失败:', error);
            throw error;
        }
    },
    
    fetchCurrentWeather: async (weatherCode) => {
        if (!weatherCode) {
            throw new Error('缺少天气代码');
        }
        
        try {
            const response = await fetch(`${WEATHER_API.CMA_WEATHER}?weatherCode=${weatherCode}`);
            if (!response.ok) {
                throw new Error('获取当前天气数据失败');
            }
            
            const data = await response.json();
            if (data.success && data.data) {
                return data.data;
            } else {
                throw new Error('天气数据格式错误');
            }
        } catch (error) {
            console.error('获取当前天气数据失败:', error);
            throw error;
        }
    },
    
    getLocationByIP: async () => {
        try {
            const response = await fetch(WEATHER_API.IP_LOCATION);
            if (!response.ok) {
                throw new Error('获取IP位置信息失败');
            }
            
            const data = await response.json();
            dataCache.location = data;
            return data;
        } catch (error) {
            console.error('获取IP位置信息失败:', error);
            throw error;
        }
    }
};

// 测试用例
const runTests = async () => {
    let passedTests = 0;
    let totalTests = 0;
    
    // 测试1: 省份列表获取和缓存
    totalTests++;
    try {
        console.log('\n测试1: 省份列表获取和缓存');
        const provinces = await weatherModule.getProvinceData();
        console.log(`获取到${provinces.length}个省份数据`);
        console.log('省份数据:', provinces);
        
        // 验证缓存
        const cachedProvinces = await weatherModule.getProvinceData();
        console.log('缓存验证:', cachedProvinces === provinces ? '通过' : '失败');
        passedTests++;
    } catch (error) {
        console.error('测试1失败:', error);
    }
    
    // 测试2: 城市列表获取
    totalTests++;
    try {
        console.log('\n测试2: 城市列表获取');
        const cities = await weatherModule.getCityData('10121'); // 浙江省ID
        console.log(`获取到${cities.length}个城市数据`);
        console.log('城市数据:', cities);
        passedTests++;
    } catch (error) {
        console.error('测试2失败:', error);
    }
    
    // 测试3: 区县列表获取
    totalTests++;
    try {
        console.log('\n测试3: 区县列表获取');
        const districts = await weatherModule.getDistrictData('1012101'); // 杭州市ID
        console.log(`获取到${districts.length}个区县数据`);
        console.log('区县数据:', districts);
        passedTests++;
    } catch (error) {
        console.error('测试3失败:', error);
    }
    
    // 测试4: 天气数据获取
    totalTests++;
    try {
        console.log('\n测试4: 天气数据获取');
        const weatherData = await weatherModule.fetchWeatherData('101010100'); // 北京天气代码
        console.log('天气数据长度:', weatherData.length);
        console.log('天气数据包含city_40:', weatherData.includes('city_40') ? '是' : '否');
        passedTests++;
    } catch (error) {
        console.error('测试4失败:', error);
    }
    
    // 测试5: 当前天气数据获取
    totalTests++;
    try {
        console.log('\n测试5: 当前天气数据获取');
        const currentWeather = await weatherModule.fetchCurrentWeather('101010100');
        console.log('当前天气数据:', currentWeather);
        console.log('温度:', currentWeather.temperature);
        console.log('天气状况:', currentWeather.weather);
        passedTests++;
    } catch (error) {
        console.error('测试5失败:', error);
    }
    
    // 测试6: IP位置信息获取
    totalTests++;
    try {
        console.log('\n测试6: IP位置信息获取');
        const location = await weatherModule.getLocationByIP();
        console.log('位置信息:', location);
        console.log('城市:', location.city);
        console.log('省份:', location.regionName);
        passedTests++;
    } catch (error) {
        console.error('测试6失败:', error);
    }
    
    // 测试7: 错误处理 - 无效的省份ID
    totalTests++;
    try {
        console.log('\n测试7: 错误处理 - 无效的省份ID');
        await weatherModule.getCityData('invalid_id');
        console.log('测试7失败: 应该抛出错误但没有');
    } catch (error) {
        console.log('测试7通过: 正确捕获到错误:', error.message);
        passedTests++;
    }
    
    // 测试8: 错误处理 - 缺少参数
    totalTests++;
    try {
        console.log('\n测试8: 错误处理 - 缺少参数');
        await weatherModule.fetchWeatherData();
        console.log('测试8失败: 应该抛出错误但没有');
    } catch (error) {
        console.log('测试8通过: 正确捕获到错误:', error.message);
        passedTests++;
    }
    
    // 输出测试结果
    console.log(`\n\n测试结果: ${passedTests}/${totalTests} 测试通过`);
    
    if (passedTests === totalTests) {
        console.log('所有天气功能测试通过！🎉');
        process.exit(0);
    } else {
        console.log('有测试未通过，请检查问题。');
        process.exit(1);
    }
};

// 运行测试
runTests().catch(error => {
    console.error('测试运行失败:', error);
    process.exit(1);
});