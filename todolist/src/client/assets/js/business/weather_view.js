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
                            dataCache.districtMap[
                                provinceName + '_' + cityName + '_' + districtName
                            ] = district.code;
                        });
                    }
                });
            }
        });
    }
    
    console.log('区域映射构建完成，省份数量:', Object.keys(dataCache.provinceMap).length);
    console.log('省份映射示例:', Object.entries(dataCache.provinceMap).slice(0, 5));
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
            handleDistrictChange(); // 直接调用处理函数
            
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
async function loadWeatherData(weatherCode) {
    console.log('加载天气数据，代码:', weatherCode);
    
    
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
