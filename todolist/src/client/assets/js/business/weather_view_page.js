// 全局变量
// 导入必要的模块
import { 
    fetchWeatherData, 
    extractWeatherDays, 
    formatWeatherDataToHTML, 
    formatTemperatureChart, 
    extractCityInfo,
    getProvinceData,
    getCityData,
    getDistrictData,
    getCityByIp,
    dataCache
} from './weather_view_final.js';

// 全局变量
let currentWeatherCode = '101010001'; // 默认使用北京的天气代码

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', async function() {
    // 更新当前日期和时间
    updateCurrentDateTime();
    
    // 设置月份选择框默认选择当月
    const now = new Date();
    
    // 初始化省份选择框
    await initProvinceSelect();
    
    // 添加事件监听
    addEventListeners();
    
    // 尝试通过IP定位城市
    locateCityByIp();
});

// 初始化省份选择框
async function initProvinceSelect() {
    const provinceSelect = document.getElementById('province-select');
    
    try {
        // 清空选择框
        provinceSelect.innerHTML = '<option value="">请选择省份</option>';
        
        // 获取省份数据
        const provinces = await getProvinceData();
        
        // 填充省份选择框
        for (const province of provinces) {
            const option = document.createElement('option');
            option.value = province.id;
            option.textContent = province.name;
            provinceSelect.appendChild(option);
        }
        
        console.log('省份数据加载完成');
        
        // 如果有缓存的位置信息，尝试匹配省份
        if (dataCache && dataCache.ipLocation && dataCache.ipLocation.province) {
            matchProvinceSelect(dataCache.ipLocation.province);
        }
    } catch (error) {
        console.error('加载省份数据失败:', error);
        
        // 不使用默认省份，显示错误提示
        provinceSelect.innerHTML = '<option value="" disabled>加载省份数据失败，请稍后重试</option>';
    }
}

// 更新当前日期和时间
function updateCurrentDateTime() {
    const now = new Date();
    const dateStr = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日';
    
    document.getElementById('current-date').textContent = dateStr;
}

// 添加事件监听
function addEventListeners() {
    // 重新定位按钮点击事件
    document.getElementById('relocate-btn').addEventListener('click', function() {
        locateCityByIp();
    });
    
    // 省份选择事件
    document.getElementById('province-select').addEventListener('change', async function() {
        const provinceCode = this.value;
        const citySelect = document.getElementById('city-select');
        const districtSelect = document.getElementById('district-select');
        
        // 清空并禁用城市和区县选择框
        citySelect.innerHTML = '<option value="">请选择城市</option>';
        citySelect.disabled = true;
        districtSelect.innerHTML = '<option value="">请选择区县</option>';
        districtSelect.disabled = true;
        
        if (provinceCode) {
            try {
                // 启用城市选择框
                citySelect.disabled = false;
                
                // 获取城市数据
                const cityData = await getCityData(provinceCode);
                
                // 填充城市选择框
                for (const city of cityData) {
                    const option = document.createElement('option');
                    option.value = city.id;
                    option.textContent = city.name;
                    citySelect.appendChild(option);
                }
                
                console.log('城市数据加载完成');
                
                // 如果有缓存的位置信息，尝试匹配城市
                if (dataCache && dataCache.ipLocation && dataCache.ipLocation.city) {
                    const citySelect = document.getElementById('city-select');
                    const districtSelect = document.getElementById('district-select');
                    if (citySelect && citySelect.options) {
                        matchCitySelect(dataCache.ipLocation.city);
                    }
                }
            } catch (error) {
                console.error('加载城市数据失败:', error);
            }
        }
    });
    
    // 城市选择事件
    document.getElementById('city-select').addEventListener('change', async function() {
        const cityCode = this.value;
        const districtSelect = document.getElementById('district-select');
        
        // 清空并禁用区县选择框
        districtSelect.innerHTML = '<option value="">请选择区县</option>';
        districtSelect.disabled = true;
        
        if (cityCode) {
            try {
                // 启用区县选择框
                districtSelect.disabled = false;
                
                // 获取区县数据
                const districtData = await getDistrictData(cityCode);
                
                // 填充区县选择框
                for (const district of districtData) {
                    const option = document.createElement('option');
                    option.value = district.weatherCode;
                    option.textContent = district.name;
                    districtSelect.appendChild(option);
                }
                
                console.log('区县数据加载完成');
            } catch (error) {
                console.error('加载区县数据失败:', error);
            }
        }
    });
    
    // 区县选择事件
    document.getElementById('district-select').addEventListener('change', function() {
        const selectedOption = this.options[this.selectedIndex];
        const weatherCode = this.value; // weatherCode存储在value属性中
        const districtName = selectedOption.text;
        
        if (weatherCode) {
            // 更新当前天气代码
            currentWeatherCode = weatherCode;
            
            // 同步更新页面顶部显示的城市代码
            const provinceSelect = document.getElementById('province-select');
            const citySelect = document.getElementById('city-select');
            const districtSelect = document.getElementById('district-select');
            
            let fullCityName = '';
            // 构建完整的城市名称
            if (provinceSelect.options[provinceSelect.selectedIndex]) {
                fullCityName += provinceSelect.options[provinceSelect.selectedIndex].text;
            }
            if (citySelect.options[citySelect.selectedIndex]) {
                fullCityName += citySelect.options[citySelect.selectedIndex].text;
            }
            if (districtSelect && districtSelect.options[districtSelect.selectedIndex]) {
                fullCityName += districtSelect.options[districtSelect.selectedIndex].text;
            }
            
            // 更新页面顶部的城市信息
            document.getElementById('city-name').textContent = fullCityName || '未知城市';
            document.getElementById('city-code').textContent = '城市代码: ' + weatherCode;
            
            // 加载天气数据
            loadWeatherData();
        }
    });
}

// 通过IP定位城市
async function locateCityByIp() {
    try {
        // 显示定位中状态
        const cityNameElement = document.getElementById('city-name');
        const cityCodeElement = document.getElementById('city-code');
        const originalCityName = cityNameElement.textContent;
        const originalCityCode = cityCodeElement.textContent;
        
        cityNameElement.textContent = '正在定位...';
        cityCodeElement.textContent = '城市代码: ...';
        
        // 调用IP定位函数
        const locationResult = await getCityByIp();
        
        if (locationResult.success) {
            console.log('IP定位成功:', locationResult);
            
            // 更新当前天气代码，不使用默认值
            currentWeatherCode = locationResult.weatherCode;
            
            // 更新城市显示
            updateCityDisplay(locationResult);
            
            // 尝试匹配省市区下拉框
            try {
                matchLocationSelect(locationResult);
            } catch (matchError) {
                console.warn('匹配省市区下拉框失败:', matchError);
            }
            
            // 加载天气数据
            loadWeatherData();
        } else {
            console.warn('IP定位失败，无法获取天气数据');
            // 直接提示失败，不使用默认城市
            document.getElementById('city-name').textContent = '定位失败';
            document.getElementById('city-code').textContent = '城市代码: ...';
            alert('定位失败，无法获取天气数据');
            return;
        }
    } catch (error) {
        console.error('IP定位过程中发生错误:', error);
        
        // 恢复原始显示
        document.getElementById('city-name').textContent = '定位失败';
        document.getElementById('city-code').textContent = '城市代码: ...';
        alert('定位过程中发生错误: ' + (error.message || '未知错误'));
    }
}

// 更新城市显示
function updateCityDisplay(locationResult) {
    const cityNameElement = document.getElementById('city-name');
    const cityCodeElement = document.getElementById('city-code');
    
    if (cityNameElement && locationResult) {
        // 构建完整的城市名称
        let fullCityName = '';
        if (locationResult.province && locationResult.city && locationResult.district) {
            fullCityName = `${locationResult.province}${locationResult.city}${locationResult.district}`;
        } else if (locationResult.city && locationResult.district) {
            fullCityName = `${locationResult.city}${locationResult.district}`;
        } else if (locationResult.city) {
            fullCityName = locationResult.city;
        } else {
            fullCityName = locationResult.name || '未知城市';
        }
        
        cityNameElement.textContent = fullCityName;
    }
    
    // 更新城市代码显示
    if (cityCodeElement && currentWeatherCode) {
        cityCodeElement.textContent = `城市代码: ${currentWeatherCode}`;
    }
}

// 匹配省市区选择框
function matchLocationSelect(province, city, district) {
    // 匹配省份
    matchProvinceSelect(province);
    
    // 匹配城市
    matchCitySelect(city);
    
    // 匹配区县
    matchDistrictSelect(district);
}

// 匹配省份选择框
function matchProvinceSelect(provinceName) {
    if (!provinceName) return;
    
    for (let i = 0; i < provinceSelect.options.length; i++) {
        if (provinceSelect.options[i].text === provinceName) {
            provinceSelect.selectedIndex = i;
            // 触发省份选择事件以加载城市列表
            const event = new Event('change');
            provinceSelect.dispatchEvent(event);
            break;
        }
    }
}

// 匹配城市选择框
function matchCitySelect(cityName) {
    if (!cityName) return;
    
    // 处理直辖市特殊情况
    const municipalities = ['北京', '上海', '天津', '重庆'];
    if (municipalities.includes(cityName)) {
        // 直辖市在省份下拉框中
        matchProvinceSelect(cityName);
        // 等待城市列表加载完成后再匹配
        setTimeout(() => {
            for (let i = 0; i < citySelect.options.length; i++) {
                if (citySelect.options[i].text === cityName) {
                    citySelect.selectedIndex = i;
                    // 触发城市选择事件以加载区县列表
                    const event = new Event('change');
                    citySelect.dispatchEvent(event);
                    break;
                }
            }
        }, 100);
    } else {
        for (let i = 0; i < citySelect.options.length; i++) {
            if (citySelect.options[i].text === cityName) {
                citySelect.selectedIndex = i;
                // 触发城市选择事件以加载区县列表
                const event = new Event('change');
                citySelect.dispatchEvent(event);
                break;
            }
        }
    }
}

// 匹配区县选择框
function matchDistrictSelect(districtName) {
    if (!districtName) return;
    
    for (let i = 0; i < districtSelect.options.length; i++) {
        if (districtSelect.options[i].text === districtName) {
            districtSelect.selectedIndex = i;
            // 触发区县选择事件以更新天气
            const event = new Event('change');
            districtSelect.dispatchEvent(event);
            break;
        }
    }
    
    // 如果没有找到匹配的区县，尝试使用当前选中的区县
    if (districtSelect.selectedIndex === 0 && districtSelect.options.length > 1) {
        districtSelect.selectedIndex = 1;
        const event = new Event('change');
        districtSelect.dispatchEvent(event);
    }
}

// 加载天气数据
function loadWeatherData(weatherCode) {
    if (!weatherCode) return;
    
    // 显示加载状态
    currentWeatherElement.innerHTML = '<div class="text-center py-8"><i class="fa fa-spinner fa-spin mr-2"></i>加载中...</div>';
    weatherDetailsElement.innerHTML = '';
    weatherForecastElement.innerHTML = '';
    temperatureChartElement.innerHTML = '';
    
    // 调用weather_view_final.js中的fetchWeatherData函数
    // 这里需要确保该函数已导入
    fetchWeatherData(weatherCode).then(html => {
        if (html) {
            // 解析天气数据
            const weatherDays = extractWeatherDays(html);
            
            // 显示当前天气
            displayCurrentWeather(weatherDays[0]);
            
            // 显示天气预报
            displayWeatherForecast(weatherDays);
            
            // 显示气温趋势图
            const temperatureData = extractTemperatureData(weatherDays);
            const chartHtml = formatTemperatureChart(temperatureData);
            temperatureChartElement.innerHTML = chartHtml;
        } else {
            showError('获取天气数据失败');
        }
    }).catch(error => {
        console.error('加载天气数据失败:', error);
        showError('加载天气数据失败，请稍后重试');
    });
}

// 显示当前天气
function displayCurrentWeather(weatherData) {
    if (!weatherData) {
        currentWeatherElement.innerHTML = '<div class="text-center text-red-500 py-8">暂无当前天气数据</div>';
        return;
    }
    
    // 解析温度范围
    let tempHigh, tempLow;
    if (weatherData.tem && weatherData.tem.includes('/')) {
        const temps = weatherData.tem.split('/');
        tempHigh = temps[0].replace(/[^\d.-]/g, '');
        tempLow = temps[1].replace(/[^\d.-]/g, '');
    }
    
    // 生成天气图标
    const weatherIcon = getWeatherIcon(weatherData.wea);
    
    currentWeatherElement.innerHTML = `
        <div class="flex flex-col items-center justify-center py-6">
            <h3 class="text-4xl font-bold mb-4">${tempHigh || '--'}°</h3>
            <div class="text-xl mb-2">${weatherData.wea}</div>
            <div class="text-gray-500 mb-4">${weatherData.week} ${weatherData.date}</div>
            <div class="flex items-center justify-center space-x-4">
                <div class="flex items-center"><i class="fa fa-tint mr-2 text-blue-500"></i>湿度: 60%</div>
                <div class="flex items-center"><i class="fa fa-location-arrow mr-2 text-gray-500"></i>${weatherData.wind}</div>
            </div>
        </div>
    `;
}

// 显示天气预报
function displayWeatherForecast(weatherDays) {
    if (!weatherDays || weatherDays.length === 0) {
        weatherForecastElement.innerHTML = '<div class="text-center text-red-500 py-8">暂无天气预报数据</div>';
        return;
    }
    
    // 调用weather_view_final.js中的formatWeatherDataToHTML函数
    const forecastHtml = formatWeatherDataToHTML(weatherDays);
    weatherForecastElement.innerHTML = forecastHtml;
}

// 显示错误信息
function showError(message) {
    currentWeatherElement.innerHTML = `<div class="text-center text-red-500 py-8">${message}</div>`;
}

// 生成天气代码（简化版，实际应该从weather_view_final.js获取）
function generateWeatherCode(cityName) {
    const cityCodeMap = {
        '北京': '101010100',
        '上海': '101020100',
        '杭州': '101210101',
        '萧山': '101210102', // 萧山的天气代码
        '宁波': '101210201',
        '温州': '101210301'
    };
    
    return cityCodeMap[cityName] || '101010100'; // 默认北京
}

// 初始化页面
document.addEventListener('DOMContentLoaded', initWeatherPage);