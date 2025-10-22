// 天气预报模块 - 简化版
// 常量定义
const WEATHER_API = {
    AREA_CODES: '/api/fetch-weather-area-codes',
    IP_API: '/api/weather-ip-location',
    WEATHER_INFO: '/api/weather-info',
};

// 数据缓存对象
const dataCache = {
    fullAreaData: null,
    loading: false,
    provinceMap: {}, // 用于快速查找省份ID
    cityMap: {},     // 用于快速查找城市ID
    districtMap: {}  // 用于快速查找区县ID和天气代码
};

// 页面加载完成后执行
function initWeatherPage() {
    console.log('页面初始化开始');
    
    // 更新当前日期和时间
    updateCurrentDateTime();
    
    // 初始化省份选择框
    initProvinceSelect();
    
    // 添加事件监听
    addEventListeners();
    
    // 尝试通过IP定位城市
    console.log('开始IP定位');
    locateCityByIp();
}

// 更新当前日期和时间
function updateCurrentDateTime() {
    const now = new Date();
    const dateStr = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日';
    const dateElement = document.getElementById('current-date');
    if (dateElement) {
        dateElement.textContent = dateStr;
    }
}

// 初始化省份选择框
function initProvinceSelect() {
    const provinceSelect = document.getElementById('province-select');
    if (provinceSelect) {
        // 清空已有的选项，只保留默认提示
        provinceSelect.innerHTML = '<option value="">请选择省份</option>';
        
        // 从API加载完整的省份列表
        loadAreaCodes();
    }
}

// 从API加载省市县数据
async function loadAreaCodes() {
    console.log('开始加载省市县数据');
    
    if (dataCache.loading) {
        console.log('数据正在加载中');
        return;
    }
    
    if (dataCache.fullAreaData) {
        console.log('数据已加载，直接返回');
        return Promise.resolve();
    }
    
    dataCache.loading = true;
    
    try {
        const response = await fetch(WEATHER_API.AREA_CODES);
        
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('获取到的省市县数据');
        
        // 验证数据格式是否正确
        if (!result || !Array.isArray(result.data) || result.data.length === 0) {
            console.error('API返回的数据格式不正确');
            throw new Error('API返回的数据格式不正确');
        }
        
        // 获取真实的区域数据（从data字段中提取）
        const areaData = result.data;
        
        // 存储完整数据
        dataCache.fullAreaData = areaData;
        
        // 构建查找映射，用于快速定位
        buildAreaMaps(areaData);
        
        // 渲染省份选择框
        renderProvinceSelect(areaData);
        
        // 尝试匹配已有的定位结果（检查多个缓存位置）
        let location = null;
        const currentLocation = sessionStorage.getItem('currentLocation');
        const cachedLocation = sessionStorage.getItem('cachedLocation');
        
        if (currentLocation) {
            location = JSON.parse(currentLocation);
            console.log('使用currentLocation匹配:', location);
        } else if (cachedLocation) {
            location = JSON.parse(cachedLocation);
            console.log('使用cachedLocation匹配:', location);
        }
        
        if (location && location.province && location.city && location.district) {
            // 延迟匹配，确保DOM元素已完全渲染
            setTimeout(() => {
                matchLocationSelect(location.province, location.city, location.district);
            }, 300);
        }
        
    } catch (error) {
        console.error('加载省市县数据失败:', error);
        // 移除mock数据，严格使用真实数据
        const weatherDataElement = document.getElementById('weather-data');
        if (weatherDataElement) {
            weatherDataElement.innerHTML += '<div class="text-center text-red-500 mt-2">数据加载失败，请刷新页面重试</div>';
        }
    } finally {
        dataCache.loading = false;
    }
}

// 构建区域查找映射
function buildAreaMaps(areaData) {
    // 清空现有的映射
    dataCache.provinceMap = {};
    dataCache.cityMap = {};
    dataCache.districtMap = {};
    dataCache.mojiCodeMap = {}; // 新增：用于存储墨迹天气编码
    
    console.log('开始构建区域映射，数据:', areaData);
    
    // 遍历并构建映射（适配children嵌套结构）
    if (areaData && Array.isArray(areaData)) {
        areaData.forEach(province => {
            if (!province || !province.name || !province.code) return;
            
            // 省份映射，处理可能的"省"后缀
            const provinceName = province.name.replace(/省$/, '');
            dataCache.provinceMap[provinceName] = province.code;
            
            // 城市映射
            if (province.children && Array.isArray(province.children)) {
                province.children.forEach(city => {
                    if (!city || !city.name || !city.code) return;
                    
                    // 处理可能的"市"后缀
                    const cityName = city.name.replace(/市$/, '');
                    dataCache.cityMap[provinceName + '_' + cityName] = city.code;
                    
                    // 区县映射
                    if (city.children && Array.isArray(city.children)) {
                        city.children.forEach(district => {
                            if (!district || !district.name || !district.code) return;
                            
                            // 处理可能的"区"、"县"后缀
                            const districtName = district.name.replace(/[区县]$/, '');
                            const mapKey = provinceName + '_' + cityName + '_' + districtName;
                            dataCache.districtMap[mapKey] = district.code;
                            
                            // 存储墨迹天气编码映射
                            if (district.mojiCode && province.mojiCode) {
                                // 构建完整的墨迹天气编码：省级编码/区县级编码
                                const fullMojiCode = `${province.mojiCode}/${district.mojiCode}`;
                                dataCache.mojiCodeMap[district.code] = fullMojiCode;
                                // console.log(`存储墨迹天气编码映射: ${district.code} -> ${fullMojiCode}`);
                            }
                        });
                    }
                });
            }
        });
    }
    
    console.log('区域映射构建完成，省份数量:', Object.keys(dataCache.provinceMap).length);
    console.log('墨迹天气编码映射数量:', Object.keys(dataCache.mojiCodeMap).length);
}

// 渲染省份选择框
function renderProvinceSelect(areaData) {
    const provinceSelect = document.getElementById('province-select');
    if (!provinceSelect || !areaData || !Array.isArray(areaData)) {
        return;
    }
    
    // 清空现有选项（保留默认提示）
    provinceSelect.innerHTML = '<option value="">请选择省份</option>';
    
    // 添加省份选项
    areaData.forEach(province => {
        if (province && province.name && province.code) {
            const option = document.createElement('option');
            option.value = province.code;
            option.textContent = province.name;
            provinceSelect.appendChild(option);
        }
    });
    
    console.log('省份选择框渲染完成，添加了', areaData.length, '个省份选项');
}

// 添加事件监听
function addEventListeners() {
    // 重新定位按钮
    const relocateBtn = document.getElementById('relocate-btn');
    if (relocateBtn) {
        relocateBtn.addEventListener('click', () => {
            console.log('重新定位按钮点击');
            locateCityByIp();
        });
    }
    
    // 省市区选择框事件 - 使用防抖和避免重复绑定
    const provinceSelect = document.getElementById('province-select');
    const citySelect = document.getElementById('city-select');
    const districtSelect = document.getElementById('district-select');
    
    // 移除可能存在的旧监听器，避免重复绑定
    if (provinceSelect) {
        // 先移除所有事件监听器
        const newProvinceSelect = provinceSelect.cloneNode(true);
        provinceSelect.parentNode.replaceChild(newProvinceSelect, provinceSelect);
        // 添加新的监听器
        newProvinceSelect.addEventListener('change', handleProvinceChange);
    }
    
    if (citySelect) {
        const newCitySelect = citySelect.cloneNode(true);
        citySelect.parentNode.replaceChild(newCitySelect, citySelect);
        newCitySelect.addEventListener('change', handleCityChange);
    }
    
    if (districtSelect) {
        const newDistrictSelect = districtSelect.cloneNode(true);
        districtSelect.parentNode.replaceChild(newDistrictSelect, districtSelect);
        newDistrictSelect.addEventListener('change', handleDistrictChange);
    }
}

// 省份选择变化处理 - 优化数据联动渲染
function handleProvinceChange() {
    console.log('省份选择变化');
    const provinceSelect = document.getElementById('province-select');
    const citySelect = document.getElementById('city-select');
    const districtSelect = document.getElementById('district-select');
    
    // 健壮性检查
    if (!provinceSelect || !citySelect || !districtSelect) {
        console.error('无法找到省市区选择框元素');
        return;
    }
    
    if (!dataCache.fullAreaData) {
        console.warn('省市县数据尚未加载完成');
        return;
    }
    
    // 重置城市和区县选择框
    citySelect.innerHTML = '<option value="">请选择城市</option>';
    citySelect.disabled = false;
    districtSelect.innerHTML = '<option value="">请选择区县</option>';
    districtSelect.disabled = true;
    
    const selectedProvinceCode = provinceSelect.value;
    if (!selectedProvinceCode) {
        console.log('未选择省份');
        return;
    }
    
    // 根据选中的省份加载对应的城市列表
    const selectedProvince = dataCache.fullAreaData.find(p => p.code === selectedProvinceCode);
    if (selectedProvince && selectedProvince.children && Array.isArray(selectedProvince.children)) {
        // 创建文档片段以减少DOM操作
        const fragment = document.createDocumentFragment();
        
        selectedProvince.children.forEach(city => {
            if (city && city.name && city.code) {
                const option = document.createElement('option');
                option.value = city.code;
                option.textContent = city.name;
                fragment.appendChild(option);
            }
        });
        
        // 一次性添加所有城市选项
        citySelect.appendChild(fragment);
        console.log('城市选择框渲染完成，省份:', selectedProvince.name, '城市数量:', selectedProvince.children.length);
    } else {
        console.warn('未找到对应省份的城市数据或数据格式不正确');
    }
}

// 城市选择变化处理 - 优化数据联动渲染
function handleCityChange() {
    console.log('城市选择变化');
    const provinceSelect = document.getElementById('province-select');
    const citySelect = document.getElementById('city-select');
    const districtSelect = document.getElementById('district-select');
    
    // 健壮性检查
    if (!provinceSelect || !citySelect || !districtSelect) {
        console.error('无法找到省市区选择框元素');
        return;
    }
    
    if (!dataCache.fullAreaData) {
        console.warn('省市县数据尚未加载完成');
        return;
    }
    
    // 重置区县选择框
    districtSelect.innerHTML = '<option value="">请选择区县</option>';
    districtSelect.disabled = false;
    
    const selectedProvinceCode = provinceSelect.value;
    const selectedCityCode = citySelect.value;
    
    if (!selectedProvinceCode || !selectedCityCode) {
        console.log('未选择省份或城市');
        return;
    }
    
    // 根据选中的省份和城市加载对应的区县列表
    const selectedProvince = dataCache.fullAreaData.find(p => p.code === selectedProvinceCode);
    if (selectedProvince && selectedProvince.children && Array.isArray(selectedProvince.children)) {
        const selectedCity = selectedProvince.children.find(c => c.code === selectedCityCode);
        if (selectedCity && selectedCity.children && Array.isArray(selectedCity.children)) {
            // 创建文档片段以减少DOM操作
            const fragment = document.createDocumentFragment();
            
            selectedCity.children.forEach(district => {
                if (district && district.name && district.code) {
                    const option = document.createElement('option');
                    option.value = district.code;
                    option.textContent = district.name;
                    fragment.appendChild(option);
                }
            });
            
            // 一次性添加所有区县选项
            districtSelect.appendChild(fragment);
            console.log('区县选择框渲染完成，城市:', selectedCity.name, '区县数量:', selectedCity.children.length);
        } else {
            console.warn('未找到对应城市的区县数据或数据格式不正确');
        }
    }
}

// 区县选择变化处理 - 优化数据联动渲染和错误处理
function handleDistrictChange() {
    console.log('区县选择变化（用户手动选择）');
    const districtSelect = document.getElementById('district-select');
    const provinceSelect = document.getElementById('province-select');
    const citySelect = document.getElementById('city-select');
    
    // 健壮性检查
    if (!districtSelect) {
        console.error('无法找到区县选择框元素');
        return;
    }
    
    const selectedDistrictCode = districtSelect.value;
    if (!selectedDistrictCode) {
        console.log('未选择区县');
        return;
    }
    
    // 更新城市显示（包含最新选择的区县信息）- 只有手动选择时才更新
    if (provinceSelect && citySelect) {
        const provinceName = provinceSelect.options[provinceSelect.selectedIndex]?.text || '';
        const cityName = citySelect.options[citySelect.selectedIndex]?.text || '';
        const districtName = districtSelect.options[districtSelect.selectedIndex]?.text || '';
        
        let fullLocationName = '';
        if (provinceName && cityName && districtName) {
            // 构建完整的位置名称，避免重复
            fullLocationName = provinceName;
            if (cityName && cityName !== provinceName && !cityName.includes(provinceName)) {
                fullLocationName += cityName;
            }
            fullLocationName += districtName;
        }
        
        // 手动选择时，更新城市显示
        console.log('手动选择省市县，更新城市显示:', fullLocationName);
        updateCityDisplay({
            name: fullLocationName || '未知位置',
            code: selectedDistrictCode
        });
        
        // 清除IP定位标识，确保下次使用手动选择的地址
        dataCache.lastLocationSource = 'manual';
    }
    
    // 获取对应的墨迹天气编码
    const mojiAreaCode = dataCache.mojiCodeMap[selectedDistrictCode];
    console.log(`选择的区县代码: ${selectedDistrictCode}, 对应的墨迹天气编码: ${mojiAreaCode || '未找到'}`);
    
    // 加载天气数据，同时传递两种编码
    loadWeatherData(selectedDistrictCode, mojiAreaCode);
}

// 通过IP定位城市
async function locateCityByIp() {
    console.log('IP定位开始');
    updateCityDisplay({ name: '正在定位...', code: '...' });
    
    try {
        // 检查sessionStorage缓存
        const cachedLocation = sessionStorage.getItem('cachedLocation');
        const cachedTime = sessionStorage.getItem('cachedLocationTime');
        const now = Date.now();
        
        // 如果有缓存且在5分钟内
        if (cachedLocation && cachedTime && (now - parseInt(cachedTime)) < 5 * 60 * 1000) {
            console.log('使用缓存的位置信息');
            const location = JSON.parse(cachedLocation);
            updateLocationUI(location);
            return;
        }
        
        // 调用真实API获取位置信息
        console.log('获取新的位置信息');
        const response = await fetch(WEATHER_API.IP_API);
        
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
        }
        
        const locationData = await response.json();
        console.log('从API获取的位置信息:', locationData);
        
        // 确保获取到的基本位置数据格式正确
        // 只检查必要的位置字段，weatherCode可以后续补充
        if (!locationData.province || !locationData.city || !locationData.district) {
            throw new Error('获取的位置数据格式不正确');
        }
        
        // 添加空的weatherCode字段以兼容现有代码
        locationData.weatherCode = '';
        
        // 存储到缓存
        sessionStorage.setItem('cachedLocation', JSON.stringify(locationData));
        sessionStorage.setItem('cachedLocationTime', now.toString());
        
        // 更新UI
        updateLocationUI(locationData);
        
    } catch (error) {
        console.error('定位失败:', error);
        // 显示错误信息而不是使用默认数据
        updateCityDisplay({ 
            name: '定位失败，请检查网络连接', 
            code: '错误' 
        });
    }
}

// 更新位置UI
function updateLocationUI(location) {
    console.log('更新位置UI:', location);
    
    // 确保location对象包含必要字段
    if (!location || !location.province || !location.city || !location.district) {
        console.error('位置数据不完整:', location);
        updateCityDisplay({ 
            name: '定位数据错误', 
            code: '数据缺失' 
        });
        return;
    }
    
    // 构建完整的城市名称，避免重复（如北京北京）
    let fullCityName = location.province;
    if (location.city && location.city !== location.province && !location.city.includes(location.province)) {
        fullCityName += location.city;
    }
    if (location.district) {
        fullCityName += location.district;
    }
    
    // 存储定位结果到sessionStorage，以便省市县数据加载后能自动匹配
    sessionStorage.setItem('currentLocation', JSON.stringify(location));
    
    // 先更新城市显示，使用临时代码
    updateCityDisplay({
        name: fullCityName,
        code: location.weatherCode || '加载中...'
    });
    
    // 标记这是IP定位的结果
    dataCache.lastLocationSource = 'ip';
    
    // 确保省市县数据已加载
    if (!dataCache.fullAreaData) {
        console.log('省市县数据尚未加载，等待加载完成后再匹配');
        loadAreaCodes().then(() => {
            setTimeout(() => {
                matchLocationSelect(location.province, location.city, location.district, true); // 传递isIpLocation=true
            }, 500);
        });
    } else {
        // 直接匹配省市区选择框，传递isIpLocation=true
        matchLocationSelect(location.province, location.city, location.district, true);
    }
    
    // 加载天气数据（即使没有weatherCode也尝试加载）
    if (location.weatherCode) {
        loadWeatherData(location.weatherCode);
    }
}

// 更新城市显示
function updateCityDisplay(locationInfo) {
    const cityNameElement = document.getElementById('city-name');
    const cityCodeElement = document.getElementById('city-code');
    const currentTempElement = document.getElementById('current-temp');
    const currentWeaElement = document.getElementById('current-wea');
    
    if (cityNameElement) cityNameElement.textContent = locationInfo.name;
    if (cityCodeElement) cityCodeElement.textContent = '城市代码: ' + locationInfo.code;
    if (currentTempElement && !locationInfo.name.includes('定位')) currentTempElement.textContent = '--°';
    if (currentWeaElement && !locationInfo.name.includes('定位')) currentWeaElement.textContent = '--';
}

// 匹配省市区选择框 - 优化数据联动渲染和异步处理
function matchLocationSelect(province, city, district, isIpLocation = false) {
    console.log('匹配位置选择框:', province, city, district, '是否IP定位:', isIpLocation);
    
    const provinceSelect = document.getElementById('province-select');
    const citySelect = document.getElementById('city-select');
    const districtSelect = document.getElementById('district-select');
    
    // 健壮性检查
    if (!provinceSelect || !citySelect || !districtSelect || !province || !city) {
        console.error('缺少必要参数或元素:', { hasElements: !!(provinceSelect && citySelect && districtSelect), hasLocation: !!(province && city) });
        return;
    }
    
    // 预处理位置名称，移除可能的后缀
    const cleanProvince = province.replace(/省$/, '').trim();
    const cleanCity = city.replace(/市$/, '').trim();
    const cleanDistrict = district ? district.replace(/[区县]$/, '').trim() : null;
    
    console.log('清理后的位置名称:', cleanProvince, cleanCity, cleanDistrict);
    
    // 确保省市区选择框重置
    citySelect.innerHTML = '<option value="">请选择城市</option>';
    citySelect.disabled = false;
    districtSelect.innerHTML = '<option value="">请选择区县</option>';
    districtSelect.disabled = true;
    
    // 如果数据还没加载完成，等待加载后再匹配
    if (!dataCache.fullAreaData && !dataCache.loading) {
        console.log('数据尚未加载，重新尝试加载');
        loadAreaCodes().then(() => {
            // 数据加载完成后重新匹配
            setTimeout(() => {
                matchLocationSelect(province, city, district);
            }, 100);
        });
        return;
    }
    
    // 如果正在加载中，延迟再试
    if (dataCache.loading) {
        console.log('数据正在加载中，稍后再匹配');
        setTimeout(() => {
            matchLocationSelect(province, city, district);
        }, 300);
        return;
    }
    
    // 1. 查找并选择对应的省份
    let selectedProvinceCode = null;
    
    // 优化的省份查找算法
    if (cleanProvince && dataCache.fullAreaData && Array.isArray(dataCache.fullAreaData)) {
        // 优先使用精确匹配
        selectedProvinceCode = dataCache.provinceMap[cleanProvince];
        
        // 如果映射表中找不到，遍历原始数据查找（支持模糊匹配）
        if (!selectedProvinceCode) {
            for (const p of dataCache.fullAreaData) {
                if (p && p.name && p.code) {
                    const pName = p.name.replace(/省$/, '').trim();
                    // 支持多种匹配方式：精确匹配、包含关系
                    if (pName === cleanProvince || p.name.includes(cleanProvince) || cleanProvince.includes(pName)) {
                        selectedProvinceCode = p.code;
                        console.log('通过遍历找到省份:', p.name, selectedProvinceCode);
                        break;
                    }
                }
            }
        } else {
            console.log('通过映射表找到省份:', cleanProvince, selectedProvinceCode);
        }
    }
    
    // 如果未找到匹配的省份，选择代码最小的省份
    if (!selectedProvinceCode && dataCache.fullAreaData && Array.isArray(dataCache.fullAreaData) && dataCache.fullAreaData.length > 0) {
        // 按代码排序，选择最小的省份
        const sortedProvinces = [...dataCache.fullAreaData].sort((a, b) => {
            if (!a || !b || !a.code || !b.code) return 0;
            return parseInt(a.code) - parseInt(b.code);
        });
        if (sortedProvinces[0] && sortedProvinces[0].code) {
            selectedProvinceCode = sortedProvinces[0].code;
            console.log('未找到匹配省份，选择代码最小的省份:', sortedProvinces[0].name, selectedProvinceCode);
        }
    }
    
    // 设置省份选择
    if (selectedProvinceCode) {
        console.log('设置省份选择:', selectedProvinceCode);
        provinceSelect.value = selectedProvinceCode;
        
        // 直接调用处理函数，避免多层事件触发
        handleProvinceChange();
        
        // 使用Promise链管理异步流程，避免多层嵌套setTimeout
        new Promise(resolve => setTimeout(resolve, 100)) // 等待城市列表加载
            .then(() => {
                if (cleanProvince && cleanCity) {
                    // 2. 查找并选择对应的城市
                    return findAndSelectCity(selectedProvinceCode, cleanProvince, cleanCity);
                }
                return Promise.resolve(null);
            })
            .then(selectedCityCode => {
                if (selectedCityCode && cleanProvince && cleanCity && cleanDistrict) {
                    // 3. 查找并选择对应的区县
                    return findAndSelectDistrict(selectedProvinceCode, selectedCityCode, cleanProvince, cleanCity, cleanDistrict);
                }
                return Promise.resolve(null);
            })
            .then(selectedDistrictCode => {
                if (selectedDistrictCode) {
                    console.log('省市区选择匹配成功，区县代码:', selectedDistrictCode);
                } else if (isIpLocation) {
                    // IP定位时，如果匹配失败，保持使用IP定位的地址显示
                    console.log('IP定位地址匹配失败，保持使用IP定位地址显示');
                    // 从sessionStorage获取IP定位的地址并保持显示
                    const cachedLocation = sessionStorage.getItem('currentLocation');
                    if (cachedLocation) {
                        const location = JSON.parse(cachedLocation);
                        let fullCityName = location.province;
                        if (location.city && location.city !== location.province && !location.city.includes(location.province)) {
                            fullCityName += location.city;
                        }
                        if (location.district) {
                            fullCityName += location.district;
                        }
                        updateCityDisplay({
                            name: fullCityName,
                            code: location.weatherCode || '未找到'
                        });
                    }
                }
            })
            .catch(error => {
                console.error('匹配省市区选择框出错:', error);
            });
    } else {
        console.log('未找到匹配的省份，且无法选择默认省份:', cleanProvince);
    }
    
    console.log('位置选择框匹配流程开始执行');
}

// 查找并选择城市 - 提取为独立函数，便于管理
function findAndSelectCity(provinceCode, cleanProvince, cleanCity) {
    return new Promise(resolve => {
        const citySelect = document.getElementById('city-select');
        if (!citySelect || !dataCache.fullAreaData || !Array.isArray(dataCache.fullAreaData)) {
            resolve(null);
            return;
        }
        
        // 优化的城市查找算法
        let selectedCityCode = null;
        
        // 优先使用映射表
        const mapKey = cleanProvince + '_' + cleanCity;
        if (dataCache.cityMap[mapKey]) {
            selectedCityCode = dataCache.cityMap[mapKey];
            console.log('通过映射表找到城市:', cleanCity, selectedCityCode);
        } else {
            // 遍历原始数据查找
            for (const p of dataCache.fullAreaData) {
                if (p && p.code === provinceCode && p.children && Array.isArray(p.children)) {
                    for (const c of p.children) {
                        if (c && c.name && c.code) {
                            const cName = c.name.replace(/市$/, '').trim();
                            // 支持多种匹配方式
                            if (cName === cleanCity || c.name.includes(cleanCity) || cleanCity.includes(cName)) {
                                selectedCityCode = c.code;
                                console.log('通过遍历找到城市:', c.name, selectedCityCode);
                                break;
                            }
                        }
                    }
                    if (selectedCityCode) break;
                }
            }
        }
        
        // 如果未找到匹配的城市，选择当前省份下代码最小的城市
        if (!selectedCityCode && dataCache.fullAreaData && Array.isArray(dataCache.fullAreaData)) {
            for (const p of dataCache.fullAreaData) {
                if (p && p.code === provinceCode && p.children && Array.isArray(p.children) && p.children.length > 0) {
                    // 按代码排序，选择最小的
                    const sortedCities = [...p.children].sort((a, b) => {
                        if (!a || !b || !a.code || !b.code) return 0;
                        return parseInt(a.code) - parseInt(b.code);
                    });
                    if (sortedCities[0] && sortedCities[0].code) {
                        selectedCityCode = sortedCities[0].code;
                        console.log('未找到匹配城市，选择代码最小的城市:', sortedCities[0].name, selectedCityCode);
                        break;
                    }
                }
            }
        }
        
        // 设置城市选择
        if (selectedCityCode) {
            citySelect.value = selectedCityCode;
            handleCityChange(); // 直接调用处理函数
            
            // 等待区县列表加载
            setTimeout(() => resolve(selectedCityCode), 100);
        } else {
            console.log('未找到匹配的城市，且无法选择默认城市:', cleanCity);
            resolve(null);
        }
    });
}

// 查找并选择区县 - 提取为独立函数，便于管理
function findAndSelectDistrict(provinceCode, cityCode, cleanProvince, cleanCity, cleanDistrict) {
    return new Promise(resolve => {
        const districtSelect = document.getElementById('district-select');
        if (!districtSelect || !dataCache.fullAreaData || !Array.isArray(dataCache.fullAreaData)) {
            resolve(null);
            return;
        }
        
        // 优化的区县查找算法
        let selectedDistrictCode = null;
        
        // 优先使用映射表
        const mapKey = cleanProvince + '_' + cleanCity + '_' + cleanDistrict;
        if (dataCache.districtMap[mapKey]) {
            selectedDistrictCode = dataCache.districtMap[mapKey];
            console.log('通过映射表找到区县:', cleanDistrict, selectedDistrictCode);
        } else {
            // 遍历原始数据查找
            for (const p of dataCache.fullAreaData) {
                if (p && p.code === provinceCode && p.children && Array.isArray(p.children)) {
                    for (const c of p.children) {
                        if (c && c.code === cityCode && c.children && Array.isArray(c.children)) {
                            for (const d of c.children) {
                                if (d && d.name && d.code) {
                                    const dName = d.name.replace(/[区县]$/, '').trim();
                                    // 支持多种匹配方式
                                    if (dName === cleanDistrict || d.name.includes(cleanDistrict) || cleanDistrict.includes(dName)) {
                                        selectedDistrictCode = d.code;
                                        console.log('通过遍历找到区县:', d.name, selectedDistrictCode);
                                        break;
                                    }
                                }
                            }
                            if (selectedDistrictCode) break;
                        }
                        if (selectedDistrictCode) break;
                    }
                    if (selectedDistrictCode) break;
                }
            }
        }
        
        // 如果未找到匹配的区县，选择当前城市下代码最小的区县
        if (!selectedDistrictCode && dataCache.fullAreaData && Array.isArray(dataCache.fullAreaData)) {
            for (const p of dataCache.fullAreaData) {
                if (p && p.code === provinceCode && p.children && Array.isArray(p.children)) {
                    for (const c of p.children) {
                        if (c && c.code === cityCode && c.children && Array.isArray(c.children) && c.children.length > 0) {
                            // 按代码排序，选择最小的
                            const sortedDistricts = [...c.children].sort((a, b) => {
                                if (!a || !b || !a.code || !b.code) return 0;
                                return parseInt(a.code) - parseInt(b.code);
                            });
                            if (sortedDistricts[0] && sortedDistricts[0].code) {
                                selectedDistrictCode = sortedDistricts[0].code;
                                console.log('未找到匹配区县，选择代码最小的区县:', sortedDistricts[0].name, selectedDistrictCode);
                                break;
                            }
                        }
                        if (selectedDistrictCode) break;
                    }
                    if (selectedDistrictCode) break;
                }
            }
        }
        
        // 设置区县选择
        if (selectedDistrictCode) {
            districtSelect.value = selectedDistrictCode;
            
            // 获取对应的墨迹天气编码
            const mojiAreaCode = dataCache.mojiCodeMap[selectedDistrictCode];
            console.log(`找到的区县代码: ${selectedDistrictCode}, 对应的墨迹天气编码: ${mojiAreaCode || '未找到'}`);
            
            // 加载天气数据，同时传递两种编码
            loadWeatherData(selectedDistrictCode, mojiAreaCode);
            
            // 更新城市代码显示
            const cityCodeElement = document.getElementById('city-code');
            if (cityCodeElement) {
                cityCodeElement.textContent = '城市代码: ' + selectedDistrictCode;
            }
            
            resolve(selectedDistrictCode);
        } else {
            console.log('未找到匹配的区县，且无法选择默认区县:', cleanDistrict);
            resolve(null);
        }
    });
}

// 加载天气数据
function loadWeatherData(weatherCode, mojiAreaCode, retryCount = 0) {
    console.log('加载天气数据，代码:', weatherCode, '墨迹编码:', mojiAreaCode, '重试次数:', retryCount);
    
    if (!weatherCode) {
        console.error('缺少必要的天气代码参数');
        showWeatherError('缺少必要的天气代码参数');
        return;
    }
    
    // 显示加载状态
    showLoading(true);
    
    // 构建请求URL，同时包含两种编码
    let url = `${WEATHER_API.WEATHER_INFO}?weatherCode=${encodeURIComponent(weatherCode)}`;
    if (mojiAreaCode) {
        url += `&mojiAreaCode=${encodeURIComponent(mojiAreaCode)}`;
    }
    
    console.log('发送天气数据请求:', url);
    
    // 发送请求
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP错误，状态码: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('成功获取天气数据:', data);
            
            // 处理天气数据并更新UI
            // 支持不同的数据格式：直接使用data参数或者data.data
            let weatherData = null;
            
            // 检查是否有error字段
            if (data && data.error) {
                console.error('API返回错误:', data.error);
                showWeatherError(data.error.message || '获取天气数据失败');
                return;
            }
            
            // 尝试不同的数据结构
            if (data && (data.todayWeather || data.calendarWeather || data.hourlyForecast)) {
                weatherData = data;
            } else if (data && data.data) {
                weatherData = data.data;
            } else if (data && data.todayWeatherData) {
                // 适配新的数据格式：todayWeatherData
                weatherData = {
                    todayWeather: data.todayWeatherData,
                    calendarWeather: data.mojiWeatherData ? data.mojiWeatherData.calendarWeather : null,
                    hourlyForecast: data.todayWeatherData ? data.todayWeatherData.hourlyWeather : null
                };
            } else if (data && data.mojiWeatherData) {
                // 适配新的数据格式：mojiWeatherData
                weatherData = data.mojiWeatherData;
            }
            
            // 验证数据有效性
            if (weatherData && (weatherData.todayWeather || weatherData.calendarWeather || weatherData.hourlyForecast)) {
                updateWeatherDisplay(weatherData);
            } else {
                console.error('返回的数据格式不符合预期或为空:', data);
                
                // 尝试重试机制，最多重试2次
                if (retryCount < 2) {
                    console.log(`尝试重新获取天气数据，当前重试次数: ${retryCount + 1}`);
                    setTimeout(() => {
                        loadWeatherData(weatherCode, mojiAreaCode, retryCount + 1);
                    }, 1000);
                } else {
                    showWeatherError('获取天气数据失败，请稍后重试');
                }
            }
        })
        .catch(error => {
            console.error('天气数据请求异常:', error);
            
            // 区分网络错误和服务器错误
            let errorMessage = '天气数据请求异常，请检查网络连接';
            if (error.message && error.message.includes('HTTP错误')) {
                errorMessage = `服务器错误，请稍后重试`;
            }
            
            // 尝试重试机制，最多重试2次
            if (retryCount < 2) {
                console.log(`因错误尝试重新获取天气数据，当前重试次数: ${retryCount + 1}`);
                setTimeout(() => {
                    loadWeatherData(weatherCode, mojiAreaCode, retryCount + 1);
                }, 1000);
            } else {
                showWeatherError(errorMessage);
            }
        })
        .finally(() => {
            // 隐藏加载状态
            showLoading(false);
        });
}

// 显示加载状态
function showLoading(isLoading) {
    const loadingElement = document.getElementById('weather-loading');
    const weatherContent = document.getElementById('weather-content');
    
    if (loadingElement) {
        loadingElement.style.display = isLoading ? 'block' : 'none';
    }
    if (weatherContent) {
        weatherContent.style.display = isLoading ? 'none' : 'block';
    }
}

// 显示天气错误信息
function showWeatherError(message) {
    const errorElement = document.getElementById('weather-error');
    const weatherContent = document.getElementById('weather-content');
    const weatherLoading = document.getElementById('weather-loading');
    
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
    
    if (weatherContent) {
        weatherContent.style.display = 'none';
    }
    
    if (weatherLoading) {
        weatherLoading.style.display = 'none';
    }
    
    console.error('天气数据显示错误:', message);
}

// 从日历天气数据中提取今天的天气信息
function updateTodayWeatherFromCalendar(calendarWeather) {
    if (!calendarWeather || !Array.isArray(calendarWeather)) {
        console.error('日历天气数据无效');
        return null;
    }
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD格式
    
    // 查找今天的天气数据
    const todayData = calendarWeather.find(day => {
        return day && day.date && day.date.split(' ')[0] === todayStr;
    });
    
    if (!todayData) {
        console.error('未找到今天的天气数据');
        return null;
    }
    
    // 创建完整的todayWeather对象，包含所有需要的信息
    const todayWeather = {
        temperature: todayData.realTemp || todayData.temp || todayData.historicalTemp,
        weatherCondition: todayData.weather || todayData.weatherCondition,
        windDirection: todayData.windDirection || todayData.wind,
        windForce: todayData.windForce,
        humidity: todayData.humidity,
        airQuality: todayData.airQuality || todayData.aqi,
        maxTemp: todayData.maxTemp || todayData.highTemp,
        minTemp: todayData.minTemp || todayData.lowTemp,
        // 添加新需要的字段
        visibility: todayData.visibility || todayData.visibilityInfo || '--',
        limit: todayData.limit || todayData.limitInfo || todayData.restriction || '--',
        tips: todayData.tips || todayData.weatherTips || todayData.suggestion || '暂无提示',
        time: todayData.time || todayData.updateTime || '--:--'
    };
    
    // 更新今天天气显示
    updateTodayWeather(todayWeather);
    return todayWeather;
}

// 更新今天天气面板 - 使用原有区域显示完整天气信息
function updateTodayWeather(todayWeather) {
    console.log('更新今日天气数据:', todayWeather);
    if (!todayWeather) {
        console.error('todayWeather数据为空');
        return;
    }
    
    // 删除需要移除的天气信息元素
    const currentWeatherInfo = document.getElementById('current-weather-info');
    if (currentWeatherInfo && currentWeatherInfo.parentNode) {
        currentWeatherInfo.parentNode.removeChild(currentWeatherInfo);
    }
    
    // 创建一个安全更新DOM的辅助函数
    function safeUpdate(elementId, value, unit = '') {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = (value !== undefined && value !== null && value !== '' && value !== '--' && value !== '-') 
                ? value + unit 
                : '--' + unit;
        }
    }
    
    // 获取所有天气信息
    const currentTemp = todayWeather.temperature || todayWeather.realTemp || todayWeather.temp || todayWeather.currentTemp || '--';
    const weatherCond = todayWeather.weather || todayWeather.weatherCondition || todayWeather.condition || '--';
    const minTemp = todayWeather.tempMin || todayWeather.minTemp || todayWeather.lowTemp || todayWeather.realTempMin || '--';
    const maxTemp = todayWeather.tempMax || todayWeather.maxTemp || todayWeather.highTemp || todayWeather.realTempMax || '--';
    const humidityInfo = todayWeather.humidity || '--';
    const airQuality = todayWeather.airQuality || todayWeather.aqi || '--';
    const windInfo = todayWeather.wind || `${todayWeather.windDirection || ''} ${todayWeather.windForce || ''}`.trim() || '--';
    const visibilityInfo = todayWeather.visibility || '--';
    const limitInfo = todayWeather.limit || '--';
    const tips = todayWeather.tips || '暂无提示';
    const time = todayWeather.time || '--:--';
    
    // 更新today-weather-section中的元素，包括实时温度
    safeUpdate('current-temp', currentTemp, '°C');
    safeUpdate('weather-condition', weatherCond);
    safeUpdate('temp-range', `${minTemp}°C / ${maxTemp}°C`);
    safeUpdate('humidity-info', humidityInfo);
    safeUpdate('air-quality', airQuality);
    safeUpdate('wind-info', windInfo);
    safeUpdate('visibility-info', visibilityInfo);
    safeUpdate('traffic-restriction', limitInfo);
    safeUpdate('weather-tips', tips);
    

    
    // 为额外信息创建容器（如果不存在）
    let extraInfoContainer = document.getElementById('weather-extra-info');
    if (!extraInfoContainer) {
        extraInfoContainer = document.createElement('div');
        extraInfoContainer.id = 'weather-extra-info';
        extraInfoContainer.className = 'weather-extra-info';
        
        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .weather-extra-info {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 10px;
                margin-top: 15px;
                padding: 15px;
                background-color: #f8f9fa;
                border-radius: 8px;
                font-size: 14px;
            }
            .extra-info-item {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }
            .extra-info-label {
                color: #6c757d;
                font-size: 12px;
            }
            .extra-info-value {
                color: #212529;
                font-weight: 500;
            }
        `;
        document.head.appendChild(style);
        
        // 将容器添加到今日天气区域中
        const todayWeatherSection = document.getElementById('today-weather-section');
        if (todayWeatherSection) {
            todayWeatherSection.appendChild(extraInfoContainer);
        }
    }
    
    // 更新额外信息
    extraInfoContainer.innerHTML = `
        <div class="extra-info-item">
            <div class="extra-info-label">更新时间</div>
            <div class="extra-info-value">${time}</div>
        </div>
        <div class="extra-info-item">
            <div class="extra-info-label">能见度</div>
            <div class="extra-info-value">${visibilityInfo}</div>
        </div>
        <div class="extra-info-item">
            <div class="extra-info-label">限行提示</div>
            <div class="extra-info-value">${limitInfo}</div>
        </div>
        <div class="extra-info-item">
            <div class="extra-info-label">今日提示</div>
            <div class="extra-info-value">${tips}</div>
        </div>
    `;
    
    // 更新天气图标
    const weatherIcon = document.getElementById('weather-icon');
    if (weatherIcon && weatherCond) {
        let iconClass = 'default-weather-icon';
        const condition = weatherCond.toLowerCase();
        
        if (condition.includes('晴')) iconClass = 'sunny-icon';
        else if (condition.includes('云')) iconClass = 'cloudy-icon';
        else if (condition.includes('雨')) iconClass = 'rainy-icon';
        else if (condition.includes('雪')) iconClass = 'snowy-icon';
        else if (condition.includes('阴')) iconClass = 'overcast-icon';
        
        weatherIcon.className = iconClass;
    }
    
    // 确保今日天气区域可见
    const todayWeatherSection = document.getElementById('today-weather-section');
    if (todayWeatherSection) {
        todayWeatherSection.style.display = 'block';
    }
}

// 更新24小时天气摘要（天气和风力风向）
function updateHourlyWeatherSummary(hourlyData) {
    const container = document.getElementById('hourly-weather-summary');
    if (!container || !hourlyData || !Array.isArray(hourlyData) || hourlyData.length === 0) {
        if (container) {
            container.innerHTML = '<div class="text-center text-gray-500">暂无24小时天气数据</div>';
        }
        return;
    }
    
    // 设置容器样式，添加水平滚动
    container.style.display = 'flex';
    container.style.overflowX = 'auto';
    container.style.whiteSpace = 'nowrap';
    container.style.scrollbarWidth = 'thin';
    container.style.marginBottom = '0'; // 减小间距以便与图表对齐
    container.style.paddingBottom = '10px';
    container.style.userSelect = 'none'; // 防止选中文本
    container.innerHTML = '';
    
    // 添加滚动同步事件
    container.addEventListener('scroll', () => {
        const chartContainer = document.getElementById('24hour-chart-container');
        if (chartContainer) {
            chartContainer.scrollLeft = container.scrollLeft;
        }
    });
    
    // 获取图表容器并添加反向滚动同步
    const chartContainer = document.getElementById('24hour-chart-container');
    if (chartContainer) {
        chartContainer.style.overflowX = 'auto';
        chartContainer.style.scrollbarWidth = 'thin';
        chartContainer.addEventListener('scroll', () => {
            container.scrollLeft = chartContainer.scrollLeft;
        });
    }
    
    // 添加每小时天气摘要 - 缩小宽度和字体
    hourlyData.forEach((hourData, index) => {
        if (!hourData) return;
        
        const hourElement = document.createElement('div');
        // 缩小宽度，确保与图表坐标节点一一对应
        hourElement.className = 'inline-flex flex-col items-center justify-center p-1 bg-gray-50 rounded-lg text-center min-w-[70px] max-w-[70px]';
        hourElement.style.width = '70px'; // 固定宽度确保精确对齐
        
        const time = document.createElement('div');
        time.className = 'text-xs font-medium text-gray-700 mb-1'; // 缩小字体
        // 优先使用hour字段，如果不存在则使用time
        // 将时间格式改为"20时"形式
        time.textContent = hourData.hour ? `${hourData.hour}时` : (hourData.time || '').replace(':', '时');
        
        const icon = document.createElement('div');
        icon.className = 'text-xl my-1'; // 缩小图标
        // 设置天气图标（这里使用简化的图标表示）
        let iconText = '☀️';
        const weather = hourData.weather || '';
        if (weather.includes('雨')) iconText = '🌧️';
        else if (weather.includes('云')) iconText = '☁️';
        else if (weather.includes('阴')) iconText = '☁️';
        else if (weather.includes('雪')) iconText = '❄️';
        icon.textContent = iconText;
        
        // 简化天气状况显示，只显示主要类型
        const condition = document.createElement('div');
        condition.className = 'text-[10px] text-gray-600 mb-1 truncate'; // 进一步缩小字体
        let shortWeather = weather || '--';
        // 简化天气描述
        if (shortWeather.includes('晴')) shortWeather = '晴';
        else if (shortWeather.includes('多云')) shortWeather = '多云';
        else if (shortWeather.includes('阴')) shortWeather = '阴';
        else if (shortWeather.includes('雨')) shortWeather = '雨';
        else if (shortWeather.includes('雪')) shortWeather = '雪';
        condition.textContent = shortWeather;
        
        // 显示完整的风力风向信息
        const wind = document.createElement('div');
        wind.className = 'text-[9px] text-gray-500 mb-1'; // 进一步缩小字体以显示完整信息
        
        // 处理wind字段（可能是合并的字符串）
        let windInfo = hourData.wind || `${hourData.windDirection || ''} ${hourData.windForce || ''}`.trim();
        
        // 保留完整的风力风向信息，不进行过度简化
        wind.textContent = windInfo || '--';
        
        // 确保容器宽度足够容纳风力信息
        hourElement.style.width = '75px'; // 略微增加宽度
        
        // 添加温度显示，确保与下方图表数据一致
        const temp = document.createElement('div');
        temp.className = 'text-sm font-medium text-gray-800'; // 保持温度字体稍大
        temp.textContent = hourData.temperature ? `${hourData.temperature}°` : '--';
        
        hourElement.appendChild(time);
        hourElement.appendChild(icon);
        hourElement.appendChild(condition);
        hourElement.appendChild(wind);
        hourElement.appendChild(temp);
        
        container.appendChild(hourElement);
    });
}

// 更新天气日历（周一到周日标题 + 当月网格形式）
function updateCalendarWeather(calendarWeather) {
    const calendarContainer = document.getElementById('weather-calendar');
    if (!calendarContainer) {
        console.error('日历容器元素不存在');
        return;
    }
    
    if (!calendarWeather || !Array.isArray(calendarWeather) || calendarWeather.length === 0) {
        calendarContainer.innerHTML = '<div class="no-data-message">暂无日历天气数据</div>';
        calendarContainer.style.display = 'block';
        return;
    }
    
    // 清空容器
    calendarContainer.innerHTML = '';
    calendarContainer.style.display = 'block';
    
    // 格式化日期函数 - 完整保留年月日格式，确保数据匹配
    function formatDate(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') return dateStr;
        // 处理YYYYMMDD格式
        if (dateStr.length === 8) {
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            return `${year}-${month}-${day}`;
        }
        return dateStr;
    }
    
    // 获取今天的日期（YYYY-MM-DD格式）
    function getTodayFormatted() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // 获取星期几索引（0=周日，1=周一...）
    function getWeekDayIndex(dateStr) {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return -1;
        return date.getDay();
    }
    
    // 创建星期标题行（周一到周日）
    const weekHeader = document.createElement('div');
    weekHeader.className = 'flex justify-between mb-2';
    weekHeader.style.width = '100%';
    
    const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    weekDays.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'text-center text-sm font-medium text-gray-700 flex-1';
        dayHeader.textContent = day;
        weekHeader.appendChild(dayHeader);
    });
    calendarContainer.appendChild(weekHeader);
    
    // 创建网格容器
    const gridContainer = document.createElement('div');
    gridContainer.className = 'grid grid-cols-7 gap-1'; // 7列网格
    gridContainer.style.width = '100%';
    calendarContainer.appendChild(gridContainer);
    
    // 按日期对数据进行排序
    const sortedWeather = [...calendarWeather].filter(day => day && day.date).sort((a, b) => {
        const dateA = new Date(formatDate(a.date));
        const dateB = new Date(formatDate(b.date));
        return dateA.getTime() - dateB.getTime();
    });
    
    // 获取当月第一天和最后一天
    let firstDay = null;
    let lastDay = null;
    if (sortedWeather.length > 0) {
        firstDay = new Date(formatDate(sortedWeather[0].date));
        lastDay = new Date(formatDate(sortedWeather[sortedWeather.length - 1].date));
    }
    
    // 获取当月第一天是星期几（转换为周一为0，周日为6的索引）
    let firstDayOfMonth = 0;
    if (firstDay) {
        firstDayOfMonth = firstDay.getDay();
        // 调整索引：周日为6，其他星期减1
        firstDayOfMonth = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
    }
    
    // 计算当月有多少天
    let daysInMonth = 0;
    if (firstDay) {
        daysInMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();
    }
    
    // 查找今天的日期
    const todayStr = getTodayFormatted();
    
    // 创建日期到数据的映射，支持多种格式以解决日期不匹配问题
    const dateToDataMap = new Map();
    sortedWeather.forEach(dayData => {
        if (!dayData || !dayData.date) return;
        
        // 存储原始格式的日期
        dateToDataMap.set(dayData.date, dayData);
        
        // 存储完整格式化后的日期（YYYY-MM-DD）
        const formattedDate = formatDate(dayData.date);
        if (formattedDate !== dayData.date) {
            dateToDataMap.set(formattedDate, dayData);
        }
        
        // 为了兼容性，也存储MM-DD格式
        if (formattedDate.includes('-')) {
            const parts = formattedDate.split('-');
            if (parts.length === 3) {
                const monthDayFormat = `${parts[1]}-${parts[2]}`;
                dateToDataMap.set(monthDayFormat, dayData);
            }
        }
        
        // 针对10月1日特殊处理
        if (formattedDate.includes('10-01')) {
            dateToDataMap.set('2023-10-01', dayData);
        }
    });
    
    // 修正填充日历网格逻辑，确保日期和星期正确匹配
    
    // 计算当月第一天的日期
    const firstDateOfMonth = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1);
    
    // 获取当月第一天是星期几（0=周日，1=周一...）
    const firstDayWeekIndex = firstDateOfMonth.getDay();
    
    // 计算需要填充的前置空白单元格数（以周一为起始，修正日期错位问题）
    let leadingEmptyCells;
    if (firstDayWeekIndex === 0) { // 周日
        leadingEmptyCells = 6; // 前面有6个空白（周一到周六）
    } else { // 周一到周六
        leadingEmptyCells = firstDayWeekIndex - 1; // 前面有相应的空白数
    }
    
    // 计算需要的总行数
    const totalCells = Math.ceil((leadingEmptyCells + daysInMonth) / 7) * 7;
    
    // 填充日历网格
    for (let i = 0; i < totalCells; i++) {
        const cell = document.createElement('div');
        cell.className = 'min-h-[100px] p-1 border border-gray-200 rounded';
        
        // 计算当前单元格对应的日期
        const dayOffset = i - leadingEmptyCells;
        const isCurrentMonth = dayOffset >= 0 && dayOffset < daysInMonth;
        
        // 判断是否为周六或周日（在7列网格中，索引5是周六，索引6是周日）
        const isWeekend = i % 7 === 5 || i % 7 === 6;
        
        if (!isCurrentMonth) {
            // 非当月日期，留空
            cell.style.backgroundColor = '#f8f8f8';
        } else {
            // 当月日期
            const dayCount = dayOffset + 1;
            // 构建完整日期
            const currentDate = new Date(firstDay.getFullYear(), firstDay.getMonth(), dayCount);
            const formattedCurrentDate = currentDate.toISOString().split('T')[0];
            
            // 增强今天日期的判断逻辑，确保正确高亮当前日期（避免22日错误显示为23日）
            const todayDate = new Date(todayStr);
            const isToday = 
                currentDate.getDate() === todayDate.getDate() &&
                currentDate.getMonth() === todayDate.getMonth() &&
                currentDate.getFullYear() === todayDate.getFullYear();
            
            // 从映射中获取当天数据，尝试多种格式匹配以解决日期错位问题
            let dayData = dateToDataMap.get(formattedCurrentDate);
            
            // 如果没找到，尝试其他可能的日期格式
            if (!dayData) {
                // 尝试其他可能的格式
                const altFormats = [
                    formattedCurrentDate.replace(/-/g, ''), // YYYYMMDD格式
                    formattedCurrentDate.substring(5) // MM-DD格式
                ];
                
                for (const altFormat of altFormats) {
                    dayData = dateToDataMap.get(altFormat);
                    if (dayData) break;
                }
            }
            
            // 特别为1号添加额外的匹配逻辑
            if (!dayData && dayCount === 1) {
                // 尝试直接从排序后的数据中查找第一天的数据
                const firstDayData = sortedWeather.find(day => {
                    if (!day || !day.date) return false;
                    const dayDate = new Date(formatDate(day.date));
                    return dayDate.getDate() === 1 && 
                           dayDate.getMonth() === firstDay.getMonth() && 
                           dayDate.getFullYear() === firstDay.getFullYear();
                });
                
                if (firstDayData) {
                    dayData = firstDayData;
                }
            }
            
            // 设置样式，当天高亮
            if (isToday) {
                cell.className = 'min-h-[100px] p-1 border-2 border-blue-400 rounded bg-blue-50';
            } else if (isWeekend) {
                // 周六周日设置淡蓝色背景
                cell.style.backgroundColor = '#e0f2fe'; // 淡蓝色背景
            }
            
            // 日期数字
            const dateNumber = document.createElement('div');
            dateNumber.className = isToday ? 'text-blue-600 font-bold text-sm mb-1' : 'text-gray-700 text-sm mb-1';
            dateNumber.textContent = dayCount;
            cell.appendChild(dateNumber);
            
            if (dayData) {
                // 天气图标
                const icon = document.createElement('div');
                icon.className = 'text-xl my-1 text-center';
                let iconText = '☀️';
                const weather = dayData.weather || dayData.weatherCondition || '';
                if (weather.includes('雨')) iconText = '🌧️';
                else if (weather.includes('云')) iconText = '☁️';
                else if (weather.includes('阴')) iconText = '☁️';
                else if (weather.includes('雪')) iconText = '❄️';
                icon.textContent = iconText;
                cell.appendChild(icon);
                
                // 天气状况（简化）
                const weatherElement = document.createElement('div');
                weatherElement.className = 'text-xs text-gray-600 mb-1 text-center truncate';
                let shortWeather = weather || '--';
                if (shortWeather.length > 2) shortWeather = shortWeather.substring(0, 2);
                weatherElement.textContent = shortWeather;
                cell.appendChild(weatherElement);
                
                // 温度范围
                const tempRange = document.createElement('div');
                tempRange.className = 'text-xs';
                const maxTemp = dayData.tempMax || dayData.maxTemp || dayData.realTempMax || '--';
                const minTemp = dayData.tempMin || dayData.minTemp || dayData.realTempMin || '--';
                tempRange.innerHTML = `<span class="text-gray-800">${maxTemp}°</span> / <span class="text-gray-500">${minTemp}°</span>`;
                cell.appendChild(tempRange);
            } else {
                // 无数据时显示占位符
                const noData = document.createElement('div');
                noData.className = 'text-[10px] text-gray-400 text-center';
                noData.textContent = '暂无数据';
                cell.appendChild(noData);
            }
        }
        
        gridContainer.appendChild(cell);
    }
}

// 绘制24小时天气折线图 - 调整纵坐标区间
function draw24HourChart(hourlyData) {
    const canvas = document.getElementById('24hour-chart');
    if (!canvas || !hourlyData || !Array.isArray(hourlyData) || hourlyData.length === 0) {
        console.error('图表容器或数据无效');
        return;
    }
    
    // 检查是否已加载Chart.js
    if (typeof Chart === 'undefined') {
        console.error('Chart.js未加载');
        return;
    }
    
    // 销毁可能存在的旧图表
    if (window._weather24HourChart) {
        window._weather24HourChart.destroy();
    }
    
    // 准备数据 - 将横坐标时间改为数值形式，不加"时"
    const labels = hourlyData.map(hour => hour.hour ? String(hour.hour) : (hour.time || '').split(':')[0] || '');
    const temperatures = hourlyData.map(hour => hour.temperature !== undefined && hour.temperature !== null ? hour.temperature : null);
    
    // 计算固定的纵坐标区间 - 类似天气趋势图的实现
    let minY = 0;
    let maxY = 40;
    
    const validTemps = temperatures.filter(temp => temp !== null && !isNaN(temp));
    if (validTemps.length > 0) {
        const actualMin = Math.min(...validTemps);
        const actualMax = Math.max(...validTemps);
        
        // 计算区间，留出一些边距
        minY = Math.floor(actualMin - 3); // 向下取整并减去3度作为下限
        maxY = Math.ceil(actualMax + 3);  // 向上取整并加上3度作为上限
        
        // 确保有足够的区间范围，参考天气趋势图的区间大小
        const range = maxY - minY;
        if (range < 10) {
            const center = (actualMin + actualMax) / 2;
            minY = Math.floor(center - 5);
            maxY = Math.ceil(center + 5);
        }
        
        // 确保最小值不低于0度（如果数据温度不太低）
        if (minY > -5) {
            minY = Math.max(0, minY);
        }
        // 确保最大值不超过40度（如果数据温度不太高）
        if (maxY < 45) {
            maxY = Math.min(40, maxY);
        }
    }
    
    console.log(`24小时图表纵坐标区间: ${minY}°C - ${maxY}°C`);
    
    // 创建图表 - 修改折线图颜色为橙色
    window._weather24HourChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '温度 (°C)',
                data: temperatures,
                borderColor: '#FFA500',
                backgroundColor: 'rgba(255, 165, 0, 0.1)',
                tension: 0.3,
                fill: true,
                pointRadius: 4,
                pointBackgroundColor: '#FFA500'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    min: minY,
                    max: maxY,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: function(tooltipItems) {
                            // 让悬浮提示中的时间显示为"20时"格式
                            const label = tooltipItems[0].label;
                            // 如果是纯数字，添加"时"字
                            if (/^\d+$/.test(label)) {
                                return `${label}时`;
                            }
                            return label;
                        },
                        label: function(context) {
                            return `${context.parsed.y || '--'}°C`;
                        }
                    }
                }
            }
        }
    });
}

// 绘制气温趋势图表（固定纵坐标区间）
function drawWeatherTrendChart(dailyData) {
    const canvas = document.getElementById('weather-trend-chart');
    if (!canvas || !dailyData || !Array.isArray(dailyData) || dailyData.length === 0) {
        console.error('图表容器或数据无效');
        return;
    }
    
    // 检查是否已加载Chart.js
    if (typeof Chart === 'undefined') {
        console.error('Chart.js未加载');
        return;
    }
    
    // 更新标题为气温趋势
    const chartTitle = document.getElementById('weather-trend-title');
    if (chartTitle) {
        chartTitle.textContent = '气温趋势';
    }
    
    // 销毁可能存在的旧图表
    if (window._weatherTrendChart) {
        window._weatherTrendChart.destroy();
    }
    
    // 格式化日期函数 - 处理YYYYMMDD格式，只显示月日，不显示年份
    function formatDate(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') return dateStr;
        // 处理YYYYMMDD格式
        if (dateStr.length === 8) {
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            return `${month}-${day}`;
        }
        // 处理已有的YYYY-MM-DD格式，只保留月日部分
        if (dateStr.includes('-')) {
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                return `${parts[1]}-${parts[2]}`;
            }
        }
        return dateStr;
    }
    
    // 准备数据
    const labels = dailyData.map(day => day.date ? formatDate(day.date) : '');
    
    // 区分历史温度、预报温度和实际温度
    const actualMaxTemps = [];
    const actualMinTemps = [];
    const forecastMaxTemps = [];
    const forecastMinTemps = [];
    const historicalMaxTemps = [];
    const historicalMinTemps = [];
    
    // 收集所有温度数据以计算合理的固定区间
    const allTemps = [];
    
    dailyData.forEach((item, index) => {
        // 增强历史温度数据提取逻辑，支持多种可能的字段名
        const historyTempMax = item.historyTempMax || item.historyMax || item.historicalTempMax || item.historicalMax;
        const historyTempMin = item.historyTempMin || item.historyMin || item.historicalTempMin || item.historicalMin;
        
        // 增强实际温度数据提取
        const realTempMax = item.realTempMax || item.actualMax || item.realMax;
        const realTempMin = item.realTempMin || item.actualMin || item.realMin;
        
        // 增强预报温度数据提取
        const tempMax = item.tempMax || item.maxTemp || item.forecastMax;
        const tempMin = item.tempMin || item.minTemp || item.forecastMin;
        
        // 实际温度
        actualMaxTemps.push(realTempMax || null);
        actualMinTemps.push(realTempMin || null);
        if (realTempMax) allTemps.push(Number(realTempMax));
        if (realTempMin) allTemps.push(Number(realTempMin));
        
        // 预报温度
        forecastMaxTemps.push(tempMax || null);
        forecastMinTemps.push(tempMin || null);
        if (tempMax) allTemps.push(Number(tempMax));
        if (tempMin) allTemps.push(Number(tempMin));
        
        // 历史温度
        historicalMaxTemps.push(historyTempMax || null);
        historicalMinTemps.push(historyTempMin || null);
        if (historyTempMax) allTemps.push(Number(historyTempMax));
        if (historyTempMin) allTemps.push(Number(historyTempMin));
    });
    
    // 计算固定的纵坐标区间
    let minY = 0;
    let maxY = 40;
    
    if (allTemps.length > 0) {
        const actualMin = Math.min(...allTemps.filter(temp => !isNaN(temp)));
        const actualMax = Math.max(...allTemps.filter(temp => !isNaN(temp)));
        
        // 计算区间，留出一些边距
        minY = Math.floor(actualMin - 5); // 向下取整并减去5度作为下限
        maxY = Math.ceil(actualMax + 5);  // 向上取整并加上5度作为上限
        
        // 确保最小值不低于0度（如果数据温度不太低）
        if (minY > -10) {
            minY = Math.max(0, minY);
        }
        // 确保最大值不超过40度（如果数据温度不太高）
        if (maxY < 45) {
            maxY = Math.min(40, maxY);
        }
    }
    
    console.log(`固定纵坐标区间: ${minY}°C - ${maxY}°C`);
    
    // 创建图表
    window._weatherTrendChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '实况高温',
                    data: actualMaxTemps,
                    borderColor: '#FFA502',
                    backgroundColor: 'rgba(255, 71, 87, 0.1)',
                    borderWidth: 3,
                    tension: 0.3,
                    fill: false,
                    pointRadius: 5,
                    pointBackgroundColor: '#FFA502'
                },
                {
                    label: '实况低温',
                    data: actualMinTemps,
                    borderColor: '#4AD5F0',
                    backgroundColor: 'rgba(30, 144, 255, 0.1)',
                    borderWidth: 3,
                    tension: 0.3,
                    fill: false,
                    pointRadius: 5,
                    pointBackgroundColor: '#4AD5F0'
                },
                {
                    label: '预报高温',
                    data: forecastMaxTemps,
                    borderColor: '#FD5123', // 橙色，更容易与其他颜色区分
                    backgroundColor: 'rgba(255, 159, 67, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false,
                    pointRadius: 4,
                    pointBackgroundColor: '#FD5123'
                },
                {
                    label: '预报低温',
                    data: forecastMinTemps,
                    borderColor: '#38AFD1', // 青绿色，更容易与其他颜色区分
                    backgroundColor: 'rgba(22, 160, 133, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false,
                    pointRadius: 4,
                    pointBackgroundColor: '#38AFD1'
                },
                {
                    label: '历史高温',
                    data: historicalMaxTemps,
                    borderColor: '#FCA087', // 紫色，更容易与其他颜色区分
                    backgroundColor: 'rgba(142, 68, 173, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5], // 虚线
                    tension: 0.3,
                    fill: false,
                    pointRadius: 3,
                    pointBackgroundColor: '#FCA087'
                },
                {
                    label: '历史低温',
                    data: historicalMinTemps,
                    borderColor: '#7DD0E9', // 深蓝色，更容易与其他颜色区分
                    backgroundColor: 'rgba(46, 134, 193, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5], // 虚线
                    tension: 0.3,
                    fill: false,
                    pointRadius: 3,
                    pointBackgroundColor: '#7DD0E9'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y || '--'}°C`;
                        }
                    }
                },
                legend: {
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'line' // 使用横线代替方块作为图例标记
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// 更新天气显示
function updateWeatherDisplay(weatherData) {
    console.log('开始更新天气显示:', weatherData);
    
    if (!weatherData) {
        showWeatherError('获取到的天气数据为空');
        return;
    }
    
    try {
        // 隐藏错误信息
        const errorElement = document.getElementById('weather-error');
        if (errorElement) {
            errorElement.style.display = 'none';
        }
        
        // 显示天气面板
        const weatherContent = document.getElementById('weather-content');
        if (weatherContent) {
            weatherContent.style.display = 'block';
        }
        
        // 提取必要的数据部分
        const { todayWeather, calendarWeather, hourlyForecast, hourlyWeather } = weatherData;
        
        // 增强todayData数据提取逻辑
        let todayData = null;
        if (todayWeather) {
            // 深拷贝以避免修改原始数据
            todayData = JSON.parse(JSON.stringify(todayWeather));
            console.log('使用todayWeather:', todayData);
        } else if (calendarWeather && calendarWeather.length > 0) {
            // 从calendarWeather中提取今天的数据，增强字段提取
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            
            // 查找今天的数据
            let todayCalendarData = calendarWeather[0]; // 默认使用第一天
            
            // 尝试根据日期查找今天的数据
            for (let i = 0; i < calendarWeather.length; i++) {
                const day = calendarWeather[i];
                if (day && day.date) {
                    let formattedDate = day.date;
                    // 如果是YYYYMMDD格式，转换为YYYY-MM-DD
                    if (typeof day.date === 'string' && day.date.length === 8) {
                        formattedDate = `${day.date.substring(0, 4)}-${day.date.substring(4, 6)}-${day.date.substring(6, 8)}`;
                    }
                    if (formattedDate.startsWith(todayStr)) {
                        todayCalendarData = day;
                        break;
                    }
                }
            }
            
            if (todayCalendarData) {
                todayData = {
                temperature: todayCalendarData.realTemp || todayCalendarData.temperature || todayCalendarData.temp || todayCalendarData.currentTemp || todayCalendarData.realTempMax,
                weather: todayCalendarData.weather || todayCalendarData.weatherCondition || todayCalendarData.condition,
                tempMin: todayCalendarData.realTempMin || todayCalendarData.tempMin || todayCalendarData.minTemp || todayCalendarData.lowTemp || todayCalendarData.historyTempMin,
                tempMax: todayCalendarData.realTempMax || todayCalendarData.tempMax || todayCalendarData.maxTemp || todayCalendarData.highTemp || todayCalendarData.historyTempMax,
                wind: todayCalendarData.wind,
                windDirection: todayCalendarData.windDirection,
                windForce: todayCalendarData.windForce,
                humidity: todayCalendarData.humidity,
                airQuality: todayCalendarData.airQuality || todayCalendarData.aqi,
                // 移除feelsLike字段，体感温度不再显示
                visibility: todayCalendarData.visibility || '10公里',
                limit: todayCalendarData.limit || '不限行',
                tips: todayCalendarData.tips || '今日天气良好，适合外出活动。',
                time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
            };
                console.log('从calendarWeather创建todayData:', todayData);
            }
        }
        
        // 强制更新今日天气，即使数据不完整也显示
        if (todayData) {
            updateTodayWeather(todayData);
        } else {
            console.warn('没有找到有效的今日天气数据，创建默认数据');
            // 创建默认数据以确保UI渲染
            updateTodayWeather({
                temperature: '--',
                weather: '--',
                tempMin: '--',
                tempMax: '--',
                wind: '--',
                humidity: '--',
                airQuality: '--',
                visibility: '--',
                limit: '--',
                tips: '--',
                time: '--:--'
            });
        }
        
        // 更新天气日历（整个月的网格形式）
        if (calendarWeather) {
            updateCalendarWeather(calendarWeather);
        }
        
        // 获取24小时数据 - 增强数据来源逻辑
        let hourlyData = null;
        if (hourlyWeather && Array.isArray(hourlyWeather)) {
            hourlyData = hourlyWeather;
        } else if (hourlyForecast && Array.isArray(hourlyForecast)) {
            hourlyData = hourlyForecast;
        } else if (todayData && todayData.hourlyWeather && Array.isArray(todayData.hourlyWeather)) {
            hourlyData = todayData.hourlyWeather;
        } else if (todayData && todayData.hourlyForecast && Array.isArray(todayData.hourlyForecast)) {
            hourlyData = todayData.hourlyForecast;
        }
        
        console.log('使用的24小时数据:', hourlyData);
        
        // 更新24小时天气摘要（天气和风力风向）
        if (hourlyData) {
            updateHourlyWeatherSummary(hourlyData);
        } else {
            // 没有24小时数据时显示提示
            const container = document.getElementById('hourly-weather-summary');
            if (container) {
                container.innerHTML = '<div class="text-center text-gray-500">暂无24小时天气数据</div>';
            }
        }
        
        // 绘制24小时温度变化图表，确保与上方摘要数据同步
        if (hourlyData) {
            draw24HourChart(hourlyData);
        } else {
            // 没有24小时数据时清空图表
            const canvas = document.getElementById('24hour-chart');
            if (canvas && window._weather24HourChart) {
                window._weather24HourChart.destroy();
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
        
        // 绘制天气趋势图表（确保显示历史温度）
        if (calendarWeather) {
            drawWeatherTrendChart(calendarWeather);
        }
        
        console.log('天气显示更新完成');
    } catch (error) {
        console.error('更新天气显示时出错:', error);
        showWeatherError('天气数据处理错误，请稍后重试');
    }
}

// 页面加载完成后初始化
console.log('页面脚本加载完成，准备初始化');
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWeatherPage);
} else {
    // 页面已经加载完成，直接初始化
    initWeatherPage();
}

console.log('脚本执行完毕');
