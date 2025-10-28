// 天气预报模块 - 简化版
// 常量定义
const WEATHER_API = {
    AREA_CODES: '/api/weather-area-codes',
    IP_API: '/api/ip-location-area',
    WEATHER_INFO: '/api/weather-info',
};

// 通用选择框操作函数
function renderSelectOptions(selectElement, data, defaultText = '请选择', valueKey = 'code', textKey = 'name', filterFn = null) {
    logStep(`开始渲染选择框，默认文本: ${defaultText}`);
    
    // 参数验证
    if (!selectElement) {
        logStep('错误: 选择框元素不存在');
        return false;
    }
    
    if (!data || !Array.isArray(data)) {
        logStep('警告: 数据无效或未加载');
        return false;
    }
    
    // 清空选择框
    selectElement.innerHTML = `<option value="">${defaultText}</option>`;
    
    // 应用过滤函数（如果提供）
    const filteredData = filterFn ? data.filter(filterFn) : data;
    
    logStep(`准备渲染数据，共有 ${filteredData.length} 个选项`);
    
    // 遍历数据，添加到选择框
    filteredData.forEach(item => {
        if (item && (item[valueKey] || item[textKey])) {
            const option = document.createElement('option');
            option.value = item[valueKey] || item[textKey];
            option.textContent = item[textKey];
            selectElement.appendChild(option);
        }
    });
    
    logStep('选择框渲染完成');
    return true;
}

function selectOptionByValueOrText(selectElement, targetValue, targetText = '', attempt = 1, maxAttempts = 2, delay = 300) {
    if (!selectElement) {
        logStep('错误: 选择框元素不存在');
        return false;
    }
    
    // 清理文本（移除后缀）
    const cleanTargetText = targetText ? targetText.replace(/[省市县区]$/, '').trim() : '';
    
    // 优先通过值查找
    if (targetValue) {
        for (let i = 0; i < selectElement.options.length; i++) {
            if (selectElement.options[i].value === targetValue) {
                selectElement.selectedIndex = i;
                return true;
            }
        }
    }
    
    // 通过文本查找（支持多种匹配方式）
    if (cleanTargetText) {
        for (let i = 0; i < selectElement.options.length; i++) {
            const option = selectElement.options[i];
            const optionText = option.text || '';
            const cleanOptionText = optionText.replace(/[省市县区]$/, '').trim();
            
            // 支持多种匹配方式
            if (option.value === targetValue || 
                cleanOptionText === cleanTargetText || 
                optionText.includes(cleanTargetText) || 
                cleanTargetText.includes(cleanOptionText)) {
                selectElement.selectedIndex = i;
                return true;
            }
        }
    }
    
    // 如果未找到且未达到最大尝试次数，重试
    if (attempt < maxAttempts) {
        logStep(`未找到匹配选项，${delay}ms后重试 (${attempt}/${maxAttempts})`);
        setTimeout(() => {
            selectOptionByValueOrText(selectElement, targetValue, targetText, attempt + 1, maxAttempts, delay * 2);
        }, delay);
        return false;
    }
    
    logStep(`警告: 未找到匹配选项: ${targetValue || cleanTargetText}`);
    return false;
}
// 数据缓存对象
const dataCache = {
    fullAreaData: null,
    loading: false,
    loadingPromise: null, // 用于避免并发加载请求
    lastLocationSource: null, // 记录最后一次定位来源
    provinceMap: {}, // 用于快速查找省份ID
    cityMap: {},     // 用于快速查找城市ID
    districtMap: {}, // 用于快速查找区县ID和天气代码
    fullDistrictMap: {}, // 用于快速查找完整区县信息（省份下直接查找区县）
    mojiCodeMap: {} // 用于存储墨迹天气编码
};

// 日志序号计数器
let logCounter = 0;

// 更新天气网站链接
function updateWeatherLinks(mojiAreaCode, weatherCode) {
    logStep(`更新天气网站链接: mojiAreaCode=${mojiAreaCode}, weatherCode=${weatherCode}`);
    
    // 更新墨迹天气链接
    const mojiLink = document.getElementById('moji-link');
    if (mojiLink) {
        if (mojiAreaCode) {
            mojiLink.href = `https://tianqi.moji.com/weather/china/${mojiAreaCode}`;
            mojiLink.title = `墨迹天气 - ${mojiAreaCode}`;
        } else {
            // 使用默认链接
            mojiLink.href = 'https://tianqi.moji.com/';
            mojiLink.title = '墨迹天气';
        }
    }
    
    // 更新中国天气网链接
    const weatherComCnLink = document.getElementById('weather-com-cn-link');
    if (weatherComCnLink) {
        if (weatherCode) {
            weatherComCnLink.href = `https://forecast.weather.com.cn/town/weather1dn/${weatherCode}.shtml`;
            weatherComCnLink.title = `中国天气网 - ${weatherCode}`;
        } else {
            // 使用默认链接
            weatherComCnLink.href = 'https://forecast.weather.com.cn/';
            weatherComCnLink.title = '中国天气网';
        }
    }
}

// 生成带序号的日志函数
function logStep(message) {
    logCounter++;
    console.log(`[${logCounter}] ${message}`);
}

// 页面加载完成后执行
function initWeatherPage() {
    logStep('页面初始化开始');
    
    // 更新当前日期和时间
    updateCurrentDateTime();
    
    // 添加事件监听
    addEventListeners();
    
    // 尝试通过IP定位城市（按照新的流程，这是第一步）
    logStep('开始IP定位');
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
        
        // 只在数据未加载时触发加载，避免重复请求
        if (!dataCache.fullAreaData && !dataCache.loading) {
            logStep('初始化省份选择框：数据未加载，开始加载省市县数据');
            loadAreaCodes();
        } else if (dataCache.fullAreaData) {
            logStep('初始化省份选择框：数据已加载，直接渲染省份选择框');
            // 如果数据已加载，直接渲染省份选择框
            renderProvinceSelect(dataCache.fullAreaData);
        }
    }
}

// 从API加载省市县数据
async function loadAreaCodes() {
    logStep('开始加载省市县数据');
    
    // 避免重复加载
    if (dataCache.loading) {
        logStep('省市县数据正在加载中，返回现有Promise避免重复请求');
        return dataCache.loadingPromise;
    }
    
    if (dataCache.fullAreaData) {
        logStep('省市县数据已加载，直接返回');
        return Promise.resolve();
    }
    
    // 创建并保存加载Promise，避免并发请求
    dataCache.loading = true;
    dataCache.loadingPromise = new Promise(async (resolve, reject) => {
        try {
            logStep(`发送请求获取省市县数据: ${WEATHER_API.AREA_CODES}`);
            const response = await fetch(WEATHER_API.AREA_CODES, { cache: 'no-store' });
            
            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status}`);
            }
            
            const result = await response.json();
            logStep('成功获取省市县数据');
            
            // 验证数据格式并提取数据，支持多种格式
            const areaData = extractAreaData(result);
            
            // 存储数据并执行后续处理
            dataCache.fullAreaData = areaData;
            buildAreaMaps(areaData);
            renderProvinceSelect(areaData);
            
            resolve(areaData);
        } catch (error) {
            handleAreaCodeError(error);
            reject(error);
        } finally {
            // 清理状态
            dataCache.loading = false;
            dataCache.loadingPromise = null;
            logStep('省市县数据加载流程完成，清理加载状态');
        }
    });
    
    return dataCache.loadingPromise;
}

// 从API响应中提取区域数据
function extractAreaData(result) {
    // 支持多种数据格式
    if (result && Array.isArray(result.data) && result.data.length > 0) {
        logStep('使用直接格式的区域数据');
        return result.data;
    } else if (result && result.weatherAreaCodes && Array.isArray(result.weatherAreaCodes.data) && result.weatherAreaCodes.data.length > 0) {
        logStep('使用mock格式的区域数据');
        return result.weatherAreaCodes.data;
    } else if (Array.isArray(result)) {
        logStep('使用数组格式的区域数据');
        return result;
    } else {
        throw new Error('API返回的数据格式不正确，无法提取省份数据');
    }
}

// 处理区域代码加载错误
function handleAreaCodeError(error) {
    logStep(`加载省市县数据失败: ${error.message}`);
    // 显示错误提示
    const weatherDataElement = document.getElementById('weather-data');
    if (weatherDataElement) {
        weatherDataElement.innerHTML += '<div class="text-center text-red-500 mt-2">数据加载失败，请刷新页面重试</div>';
    }
}

// 构建区域查找映射
function buildAreaMaps(areaData) {
    logStep('开始构建区域查找映射表');
    
    // 初始化映射对象，确保它们始终存在
    initializeMaps();
    
    // 数据有效性验证
    if (!areaData || !Array.isArray(areaData) || areaData.length === 0) {
        logStep('警告: 无效的区域数据，无法构建映射表');
        return;
    }
    
    try {
        // 遍历并构建映射（适配children嵌套结构）
        areaData.forEach(province => {
            processProvinceData(province);
        });
        
        // 记录构建结果统计和时间
        logBuildStats();
        dataCache.areaMapsBuildTime = new Date().getTime();
        
    } catch (error) {
        logStep(`构建区域映射时发生错误: ${error.message || error}`);
        // 错误发生时保留已构建的映射，避免完全失败
    }
}

// 初始化映射对象
function initializeMaps() {
    dataCache.provinceMap = dataCache.provinceMap || {};
    dataCache.cityMap = dataCache.cityMap || {};
    dataCache.districtMap = dataCache.districtMap || {};
    dataCache.mojiCodeMap = dataCache.mojiCodeMap || {};
    dataCache.fullDistrictMap = dataCache.fullDistrictMap || {};
}

// 处理省份数据
function processProvinceData(province) {
    // 跳过无效的省份数据
    if (!province || typeof province !== 'object') {
        logStep('跳过无效的省份数据');
        return;
    }
    
    // 处理可能的"省"后缀
    const provinceName = normalizeProvinceName(province.name);
    if (!provinceName) {
        logStep('跳过缺少名称的省份数据');
        return;
    }
    
    // 省份映射
    dataCache.provinceMap[provinceName] = province.code || '';
    
    // 处理城市数据
    if (province.children && Array.isArray(province.children)) {
        province.children.forEach(city => {
            processCityData(city, provinceName, province);
        });
    }
}

// 处理城市数据
function processCityData(city, provinceName, province) {
    // 跳过无效的城市数据
    if (!city || typeof city !== 'object') {
        return;
    }
    
    // 处理可能的"市"后缀
    const cityName = normalizeCityName(city.name);
    if (!cityName) {
        return;
    }
    
    // 城市映射
    dataCache.cityMap[provinceName + '_' + cityName] = city.code || '';
    
    // 处理区县数据
    if (city.children && Array.isArray(city.children)) {
        city.children.forEach(district => {
            processDistrictData(district, provinceName, cityName, province, city);
        });
    }
}

// 处理区县数据
function processDistrictData(district, provinceName, cityName, province, city) {
    // 跳过无效的区县数据
    if (!district || typeof district !== 'object') {
        return;
    }
    
    // 处理可能的"区"、"县"后缀
    const districtName = normalizeDistrictName(district.name);
    if (!districtName || !district.code) {
        return;
    }
    
    // 构建区县映射键
    const mapKey = provinceName + '_' + cityName + '_' + districtName;
    dataCache.districtMap[mapKey] = district.code;
    
    // 存储完整区县信息映射（用于省份下直接查找区县）
    createFullDistrictMap(provinceName, districtName, district, province, city);
    
    // 存储墨迹天气编码映射
    storeMojiCodeMapping(district, province);
    
    // 反向映射：从名称快速查找编码
    if (district.code) {
        dataCache.mojiCodeMap[district.name] = district.code;
    }
}

// 标准化省份名称
function normalizeProvinceName(name) {
    return String(name || '').replace(/省$/, '').trim();
}

// 标准化城市名称
function normalizeCityName(name) {
    return String(name || '').replace(/市$/, '').trim();
}

// 标准化区县名称
function normalizeDistrictName(name) {
    return String(name || '').replace(/[区县]$/, '').trim();
}

// 创建完整区县信息映射
function createFullDistrictMap(provinceName, districtName, district, province, city) {
    const districtMapKey = provinceName + '_' + districtName;
    dataCache.fullDistrictMap[districtMapKey] = {
        code: district.code,
        mojiCode: district.mojiCode || '',
        provinceMojiCode: province.mojiCode || '',
        cityName: city.name || '',
        districtName: district.name || '',
        fullName: `${province.name || ''}${city.name || ''}${district.name || ''}`
    };
}

// 存储墨迹天气编码映射
function storeMojiCodeMapping(district, province) {
    if (district.mojiCode) {
        // 格式1: 完整编码（省级编码/区县级编码）
        if (province.mojiCode && typeof province.mojiCode === 'string' && typeof district.mojiCode === 'string') {
            const fullMojiCode = `${province.mojiCode}/${district.mojiCode}`;
            dataCache.mojiCodeMap[district.code] = fullMojiCode;
        } 
        // 格式2: 仅区县编码
        else {
            dataCache.mojiCodeMap[district.code] = String(district.mojiCode);
        }
    } 
    // 兼容IP定位的特殊情况
    else if (district.code) {
        // 如果没有墨迹编码但有区县代码，也记录下来
        dataCache.mojiCodeMap[district.code] = dataCache.mojiCodeMap[district.code] || '';
    }
}

// 记录构建结果统计
function logBuildStats() {
    const stats = {
        provinceCount: Object.keys(dataCache.provinceMap).length,
        cityCount: Object.keys(dataCache.cityMap).length,
        districtCount: Object.keys(dataCache.districtMap).length,
        mojiCodeCount: Object.keys(dataCache.mojiCodeMap).length,
        fullDistrictCount: Object.keys(dataCache.fullDistrictMap).length
    };
    
    logStep(`区域映射构建完成 - 省份: ${stats.provinceCount}, 城市: ${stats.cityCount}, 区县: ${stats.districtCount}, 墨迹编码: ${stats.mojiCodeCount}, 完整区县信息: ${stats.fullDistrictCount}`);
}

// 在省份下直接查找区县（用于IP定位只有province和district的情况）
// 渲染省份选择框
function renderProvinceSelect(areaData) {
    const provinceSelect = document.getElementById('province-select');
    return renderSelectOptions(provinceSelect, areaData, '请选择省份', 'code', 'name');
}

// 添加事件监听
function addEventListeners() {
    logStep('开始添加事件监听器');
    
    // 重新定位按钮
    const relocateBtn = document.getElementById('relocate-btn');
    if (relocateBtn) {
        relocateBtn.addEventListener('click', () => {
            logStep('重新定位按钮点击');
            // 修改为不重新加载省市县数据的版本
            // 直接获取定位信息并匹配选择框，不重新渲染选框基础数据
            quickRelocateByIp();
        });
        logStep('重新定位按钮事件监听器添加完成');
    }
    
    // 省市区选择框事件 - 使用更直接的方式添加监听器，避免使用cloneNode
    const provinceSelect = document.getElementById('province-select');
    const citySelect = document.getElementById('city-select');
    const districtSelect = document.getElementById('district-select');
    
    // 为选择框添加事件监听器，避免重复绑定
    if (provinceSelect && !provinceSelect.hasAttribute('data-event-added')) {
        // 使用标志避免重复添加监听器
        provinceSelect.setAttribute('data-event-added', 'true');
        provinceSelect.addEventListener('change', handleProvinceChange);
        logStep('省份选择框事件监听器添加完成');
    }
    
    if (citySelect && !citySelect.hasAttribute('data-event-added')) {
        citySelect.setAttribute('data-event-added', 'true');
        citySelect.addEventListener('change', handleCityChange);
        logStep('城市选择框事件监听器添加完成');
    }
    
    if (districtSelect && !districtSelect.hasAttribute('data-event-added')) {
        districtSelect.setAttribute('data-event-added', 'true');
        districtSelect.addEventListener('change', handleDistrictChange);
        logStep('区县选择框事件监听器添加完成');
    }
    
    logStep('所有必要的事件监听器添加完成');
}

// 省份选择变化处理 - 优化数据联动渲染
function handleProvinceChange() {
    logStep('省份选择变化处理');
    const provinceSelect = document.getElementById('province-select');
    const citySelect = document.getElementById('city-select');
    const districtSelect = document.getElementById('district-select');
    
    // 健壮性检查
    if (!provinceSelect || !citySelect || !districtSelect) {
        logStep('处理失败: 无法找到省市区选择框元素');
        return;
    }
    
    if (!dataCache.fullAreaData) {
        logStep('处理失败: 省市县数据尚未加载完成');
        return;
    }
    
    // 重置城市和区县选择框
    citySelect.innerHTML = '<option value="">请选择城市</option>';
    citySelect.disabled = false;
    districtSelect.innerHTML = '<option value="">请选择区县</option>';
    districtSelect.disabled = true;
    
    const selectedProvinceCode = provinceSelect.value;
    if (!selectedProvinceCode) {
        logStep('未选择省份，结束处理');
        return;
    }
    
    // 根据选中的省份加载对应的城市列表 - 支持code或name匹配
    logStep(`开始查找省份，选中的值: ${selectedProvinceCode}`);
    logStep(`当前fullAreaData长度: ${dataCache.fullAreaData ? dataCache.fullAreaData.length : 'null'}`);
    
    // 先尝试通过name查找，因为省份对象可能没有code属性
    let selectedProvince = dataCache.fullAreaData.find(p => p.name === selectedProvinceCode);
    if (!selectedProvince) {
        logStep(`通过名称未找到省份，尝试通过code查找`);
        // 如果通过name没有找到，尝试通过code查找
        selectedProvince = dataCache.fullAreaData.find(p => p.code === selectedProvinceCode);
    }
    
    logStep(`找到省份: ${selectedProvince ? selectedProvince.name : '未找到'}`);
    if (selectedProvince) {
        logStep(`省份有children: ${selectedProvince.children ? '是' : '否'}`);
        logStep(`children是数组: ${Array.isArray(selectedProvince.children) ? '是' : '否'}`);
        logStep(`children数量: ${Array.isArray(selectedProvince.children) ? selectedProvince.children.length : '未知'}`);
    }
    if (selectedProvince && selectedProvince.children && Array.isArray(selectedProvince.children)) {
        // 使用通用渲染函数渲染城市选择框
        renderSelectOptions(citySelect, selectedProvince.children, '请选择城市', 'code', 'name');
        logStep(`城市选择框渲染完成，省份:${selectedProvince.name}`);
        
        // 检查是否有需要匹配的城市信息，如果有，尝试自动选择城市
        if (dataCache.currentMatchingLocation && dataCache.currentMatchingLocation.cleanCity) {
            const matchingData = dataCache.currentMatchingLocation;
            logStep(`检测到需要匹配的城市: ${matchingData.cleanCity}`);
            
            // 使用更长时间的setTimeout确保DOM完全更新完成
            setTimeout(() => {
                // 先检查城市选择框是否可用且有选项
                if (citySelect && citySelect.disabled === false && citySelect.options.length > 1) {
                    logStep(`开始查找城市选项，当前城市选择框选项数量: ${citySelect.options.length}`);
                    
                    // 使用通用选择函数选择城市
                    const cityFound = selectOptionByValueOrText(citySelect, null, matchingData.cleanCity);
                    if (cityFound) {
                        const selectedOption = citySelect.options[citySelect.selectedIndex];
                        logStep(`找到匹配城市: ${selectedOption.text}，成功自动选择城市并触发变更事件`);
                        // 触发change事件确保视觉上显示为选中状态并触发区县联动
                        const event = new Event('change', { bubbles: true });
                        citySelect.dispatchEvent(event);
                    } else {
                        // 如果未找到城市，添加调试日志
                        logStep(`警告: 未找到匹配的城市选项。cleanCity=${matchingData.cleanCity}，城市选项列表: ${Array.from(citySelect.options).map(opt => opt.text).join(', ')}`);
                    }
                } else {
                    logStep(`警告: 城市选择框不可用或选项不足，disabled=${citySelect?.disabled}，选项数量=${citySelect?.options.length || 0}`);
                    // 尝试重新加载省份数据，可能数据未正确加载
                    setTimeout(() => {
                        handleProvinceChange();
                    }, 100);
                }
            }, 300); // 增加延迟时间到300ms
        }
        
    } else {
        logStep('未找到对应省份的城市数据或数据格式不正确');
        logStep(`selectedProvince: ${selectedProvince ? '存在' : '不存在'}`);
        logStep(`children: ${selectedProvince && selectedProvince.children ? '存在' : '不存在'}`);
        logStep(`children是数组: ${selectedProvince && Array.isArray(selectedProvince.children) ? '是' : '否'}`);
    }
}

// 城市选择变化处理 - 优化数据联动渲染
function handleCityChange() {
    logStep('城市选择变化');
    const provinceSelect = document.getElementById('province-select');
    const citySelect = document.getElementById('city-select');
    const districtSelect = document.getElementById('district-select');
    
    // 健壮性检查
    if (!provinceSelect || !citySelect || !districtSelect) {
        logStep('错误: 无法找到省市区选择框元素');
        return;
    }
    
    if (!dataCache.fullAreaData) {
        logStep('警告: 省市县数据尚未加载完成');
        return;
    }
    
    // 重置区县选择框并启用
    districtSelect.disabled = false;
    
    const selectedProvinceValue = provinceSelect.value;
    const selectedCityValue = citySelect.value;
    
    if (!selectedProvinceValue || !selectedCityValue) {
        logStep('未选择省份或城市');
        return;
    }
    
    logStep(`开始查找省份和城市，选中值: 省份=${selectedProvinceValue}, 城市=${selectedCityValue}, 区域数据长度=${dataCache.fullAreaData.length}`);
    
    // 先按name查找省份，再按code查找
    let selectedProvince = dataCache.fullAreaData.find(p => p.name === selectedProvinceValue);
    if (!selectedProvince) {
        selectedProvince = dataCache.fullAreaData.find(p => p.code === selectedProvinceValue);
    }
    
    logStep(`省份查找结果: ${selectedProvince ? selectedProvince.name : '未找到'}, children属性: ${selectedProvince?.children ? '存在' : '不存在'}`);
    
    if (selectedProvince && selectedProvince.children && Array.isArray(selectedProvince.children)) {
        // 先按name查找城市，再按code查找
        let selectedCity = selectedProvince.children.find(c => c.name === selectedCityValue);
        if (!selectedCity) {
            selectedCity = selectedProvince.children.find(c => c.code === selectedCityValue);
        }
        
        logStep(`城市查找结果: ${selectedCity ? selectedCity.name : '未找到'}, children属性: ${selectedCity?.children ? '存在' : '不存在'}`);
        
        if (selectedCity && selectedCity.children && Array.isArray(selectedCity.children)) {
            logStep('开始渲染区县列表');
            // 创建文档片段以减少DOM操作
            document.createDocumentFragment();
            // 使用通用渲染函数渲染区县选择框
            renderSelectOptions(districtSelect, selectedCity.children, '请选择区县', 'code', 'name');
            logStep(`区县选择框渲染完成，城市: ${selectedCity.name}`);
            
            // 检查是否有需要匹配的区县信息，如果有，尝试自动选择区县
            if (dataCache.currentMatchingLocation && dataCache.currentMatchingLocation.cleanDistrict) {
                const matchingData = dataCache.currentMatchingLocation;
                logStep(`检测到需要匹配的区县: ${matchingData.cleanDistrict}`);
                
                // 使用更长时间的setTimeout确保DOM完全更新完成
                setTimeout(() => {
                    // 先检查区县选择框是否可用且有选项
                    if (districtSelect && districtSelect.disabled === false && districtSelect.options.length > 1) {
                        logStep(`开始查找区县选项，当前区县选择框选项数量: ${districtSelect.options.length}`);
                        
                        // 使用通用选择函数选择区县
                        const districtFound = selectOptionByValueOrText(districtSelect, null, matchingData.cleanDistrict);
                        
                        // 如果未找到区县，添加调试日志
                        if (!districtFound) {
                            logStep(`警告: 未找到匹配的区县选项。cleanDistrict=${matchingData.cleanDistrict}，区县选项列表: ${Array.from(districtSelect.options).map(opt => opt.text).join(', ')}`);
                            
                            // 如果是IP定位，尝试使用备选方案
                            if (matchingData.isIpLocation && matchingData.locationData) {
                                logStep('IP定位场景下未找到区县，尝试直接加载天气数据');
                                // 直接使用IP定位返回的天气代码加载数据
                                if (matchingData.locationData.weatherCode) {
                                    loadWeatherData(matchingData.locationData.weatherCode, matchingData.locationData.mojiAreaCode);
                                }
                            }
                        }
                    } else {
                        logStep(`警告: 区县选择框不可用或选项不足，disabled=${districtSelect?.disabled}，选项数量=${districtSelect?.options.length || 0}`);
                        // 尝试重新加载城市数据
                        setTimeout(() => {
                            handleCityChange();
                        }, 100);
                    }
                }, 300); // 增加延迟时间到300ms
            }
        } else {
            logStep(`警告: 未找到对应城市的区县数据或数据格式不正确，selectedCity=${JSON.stringify(selectedCity)}`);
        }
    } else {
        logStep(`警告: 未找到对应省份的数据或数据格式不正确，selectedProvince=${JSON.stringify(selectedProvince)}`);
    }
}

// 区县选择变化处理 - 优化数据联动渲染和错误处理
function handleDistrictChange() {
    logStep('区县选择变化（用户手动选择）');
    const districtSelect = document.getElementById('district-select');
    const provinceSelect = document.getElementById('province-select');
    const citySelect = document.getElementById('city-select');
    
    // 健壮性检查
    if (!districtSelect) {
        logStep('错误: 无法找到区县选择框元素');
        return;
    }
    
    const selectedDistrictCode = districtSelect.value;
    if (!selectedDistrictCode) {
        logStep('未选择区县');
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
        logStep(`手动选择省市县，更新城市显示: ${fullLocationName}`);
        updateCityDisplay({
            name: fullLocationName || '未知位置',
            code: selectedDistrictCode
        });
        
        // 清除IP定位标识，确保下次使用手动选择的地址
        dataCache.lastLocationSource = 'manual';
    }
    
    // 获取对应的墨迹天气编码
    const mojiAreaCode = dataCache.mojiCodeMap[selectedDistrictCode];
    logStep(`选择的区县代码: ${selectedDistrictCode}, 对应的墨迹天气编码: ${mojiAreaCode || '未找到'}`);
    
    // 加载天气数据，同时传递两种编码
    loadWeatherData(selectedDistrictCode, mojiAreaCode);
}

// 快速IP定位 - 只获取定位信息并匹配选择框，不重新渲染选框基础数据
async function quickRelocateByIp() {
    logStep('快速IP定位开始 - 保留现有选框数据，只进行定位和匹配');
    updateCityDisplay({ name: '正在定位...', code: '...' });
    
    try {
        // 发送请求获取位置信息，不使用缓存
        logStep(`发送请求获取位置信息: ${WEATHER_API.IP_API}`);
        const response = await fetch(WEATHER_API.IP_API, { cache: 'no-store' });
        
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
        }
        
        const responseData = await response.json();
        logStep('成功获取位置信息响应数据');
        
        // 适配新的数据结构，位置数据在data字段中
        const locationData = responseData.data || {};
        logStep(`提取到的位置信息: 省份=${locationData.province}, 城市=${locationData.city}, 区县=${locationData.district}`);
        
        // 确保获取到的基本位置数据格式正确
        if (!locationData.province || !locationData.district) {
            throw new Error('获取的位置数据格式不正确');
        }
        
        // 如果city为空，设置为空字符串以兼容现有代码
        if (!locationData.city) {
            locationData.city = '';
        }
        
        // 标记这是IP定位的结果
        dataCache.lastLocationSource = 'ip';
        
        // 如果有weatherCode，直接尝试加载天气数据
        if (locationData.weatherCode) {
            logStep('IP定位已获取weatherCode，优先加载天气数据');
            loadWeatherData(locationData.weatherCode, locationData.mojiAreaCode);
        }
        
        // 直接调用updateLocationUI进行匹配，使用已有的省市县数据
        logStep('直接使用现有省市县数据进行位置匹配');
        updateLocationUI(locationData);
        
        return locationData;
    } catch (error) {
        logStep(`快速IP定位失败: ${error.message}`);
        // 定位失败，显示错误信息但不重置选框数据
        updateCityDisplay({ 
            name: '定位失败，请重试', 
            code: '定位错误' 
        });
    }
}

// 通过IP定位城市 - 按照新流程实现
async function locateCityByIp() {
    logStep('IP定位开始');
    updateCityDisplay({ name: '正在定位...', code: '...' });
    
    try {
        // 不再使用sessionStorage缓存，每次都获取最新数据
        logStep('直接获取最新位置信息，不使用缓存');
        
        // 无缓存或缓存过期，获取新数据
        logStep('无缓存或缓存已过期，需要获取新位置信息');
        await fetchLocationData();
        
    } catch (error) {
        logStep(`IP定位流程失败: ${error.message}`);
        // 定位失败，切换到用户手动选择流程
        switchToManualSelection();
    }
}

// 获取位置数据并处理
async function fetchLocationData() {
    logStep(`发送请求获取位置信息: ${WEATHER_API.IP_API}`);
    const response = await fetch(WEATHER_API.IP_API, { cache: 'no-store' });
    
    if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
    }
    
    const responseData = await response.json();
    logStep('成功获取位置信息响应数据');
    
    // 适配新的数据结构，位置数据在data字段中
    const locationData = responseData.data || {};
    logStep(`提取到的位置信息: 省份=${locationData.province}, 城市=${locationData.city}, 区县=${locationData.district}`);
    
    // 确保获取到的基本位置数据格式正确
    if (!locationData.province || !locationData.district) {
        throw new Error('获取的位置数据格式不正确');
    }
    
    // 如果city为空，设置为空字符串以兼容现有代码
    if (!locationData.city) {
        locationData.city = '';
    }
    
    // 处理成功情况
    logStep('位置信息数据验证通过，开始处理');
    processLocationSuccess(locationData, responseData.weatherAreaCodes.data);
    
    // 不再存储到sessionStorage缓存
    logStep('不使用sessionStorage缓存位置数据');
}

// 处理位置数据获取成功的情况
function processLocationSuccess(locationData, weatherAreaCodes) {
    logStep('IP定位成功，开始处理定位结果');
    
    // 验证locationData参数的有效性
    if (!locationData || typeof locationData !== 'object') {
        logStep('错误: 无效的位置数据对象');
        switchToManualSelection();
        return;
    }
    
    // 提取并清理必要的位置信息
    const province = locationData.province || '';
    const city = locationData.city || '';
    const district = locationData.district || '';
    const weatherCode = locationData.weatherCode || '';
    const mojiAreaCode = locationData.mojiAreaCode || '';
    
    // 记录详细的IP定位数据
    logStep(`IP定位详细数据 - 省份: ${province}, 城市: ${city}, 区县: ${district}, weatherCode: ${weatherCode}, mojiAreaCode: ${mojiAreaCode}`);
    
    // 基础位置信息验证
    if (!province || (!district && !city)) {
        logStep('警告: IP定位返回的核心位置信息不完整');
        // 即使不完整，也尝试继续处理，可能只有省份信息
    }
    
    // 标记这是IP定位的结果
    dataCache.lastLocationSource = 'ip';
    
    // 如果有weatherCode，直接尝试加载天气数据，提供更快的用户体验
    if (weatherCode) {
        logStep('IP定位已获取weatherCode，优先加载天气数据');
        loadWeatherData(weatherCode, mojiAreaCode);
    }
    
    // 处理省市县数据加载和渲染
    if (weatherAreaCodes && Array.isArray(weatherAreaCodes) && weatherAreaCodes.length > 0) {
        logStep('IP定位接口返回了完整省市县数据，直接使用该数据');
        
        // 直接使用API返回的省市县数据
        dataCache.fullAreaData = weatherAreaCodes;
        
        // 构建查找映射
        logStep('使用IP定位返回的数据构建区域映射');
        try {
            buildAreaMaps(weatherAreaCodes);
        } catch (error) {
            logStep(`构建区域映射失败: ${error.message}`);
            // 继续执行，不因映射构建失败而中断
        }
        
        // 渲染省份选择框
        logStep('使用IP定位返回的数据渲染省份选择框');
        try {
            renderProvinceSelect(weatherAreaCodes);
        } catch (error) {
            logStep(`渲染省份选择框失败: ${error.message}`);
            // 继续执行，不因渲染失败而中断
        }
        
        // 更新UI并匹配选框
        logStep('更新位置UI并匹配定位结果');
        updateLocationUI(locationData);
    } else {
        // 如果IP定位接口未返回完整省市县数据或数据无效，调用loadAreaCodes获取数据
        logStep('IP定位接口未返回有效省市县数据，需要单独加载');
        loadAreaCodes().then(() => {
            logStep('省市县数据加载完成，尝试匹配定位结果');
            // 数据加载完成后更新UI并匹配选框
            updateLocationUI(locationData);
        }).catch(error => {
            logStep(`加载省市县数据失败: ${error.message || error}`);
            // 即使加载区域数据失败，如果有weatherCode也保持天气数据显示
            if (!weatherCode) {
                logStep('无weatherCode且区域数据加载失败，切换到手动选择');
                switchToManualSelection();
            } else {
                logStep('区域数据加载失败但有weatherCode，保持显示天气数据');
            }
        });
    }
    
    return locationData;
}

// 切换到用户手动选择流程
function switchToManualSelection() {
    logStep('切换到用户手动选择流程');
    
    // 初始化省份选择框
    initProvinceSelect();
    
    // 显示提示信息
    updateCityDisplay({ 
        name: '请手动选择所在地区', 
        code: '手动选择' 
    });
    
    // 标记为手动选择模式
    dataCache.lastLocationSource = 'manual';
}

// 更新位置UI - 集中处理位置显示和选框匹配
function updateLocationUI(location) {
    logStep(`开始更新位置UI: 省份=${location?.province}, 城市=${location?.city}, 区县=${location?.district}`);
    
    // 验证location参数的有效性
    if (!location || typeof location !== 'object') {
        logStep('错误: 无效的位置数据对象');
        updateCityDisplay({ 
            name: '定位数据错误', 
            code: '数据无效' 
        });
        return;
    }
    
    // 提取并清理位置信息
    const province = location.province || '';
    const city = location.city || '';
    const district = location.district || '';
    const weatherCode = location.weatherCode || '';
    const mojiAreaCode = location.mojiAreaCode || '';
    
    // 构建完整的城市名称，避免重复（如北京北京）
    let fullCityName = province;
    if (city && city !== province && !city.includes(province)) {
        fullCityName += city;
    }
    if (district && !fullCityName.includes(district)) {
        fullCityName += district;
    }
    
    // 位置信息验证和降级处理
    if (!province) {
        logStep('严重错误: 缺少省份信息');
        updateCityDisplay({ 
            name: '定位失败', 
            code: '缺少省份信息' 
        });
        switchToManualSelection();
        return;
    }
    
    // 更新城市显示
    logStep(`更新城市显示为: ${fullCityName}`);
    updateCityDisplay({
        name: fullCityName,
        code: weatherCode || '加载中...'
    });
    
    // 添加重试机制的匹配函数
    const attemptMatchLocation = (attempt = 1, maxAttempts = 3, delay = 500) => {
        logStep(`尝试匹配位置 (尝试 ${attempt}/${maxAttempts})`);
        
        // 确保DOM元素存在
        const provinceSelect = document.getElementById('province-select');
        if (!provinceSelect || !provinceSelect.options || provinceSelect.options.length <= 1) {
            if (attempt <= maxAttempts) {
                logStep(`选择框尚未完全加载，${delay}ms后重试`);
                setTimeout(() => {
                    attemptMatchLocation(attempt + 1, maxAttempts, delay * 1.5); // 指数退避
                }, delay);
            } else {
                logStep(`已达到最大重试次数，放弃自动匹配`);
                // 显示手动选择提示
                if (!weatherCode) {
                    updateCityDisplay({
                        name: fullCityName + ' (请手动选择确认)',
                        code: '自动匹配失败'
                    });
                }
            }
            return;
        }

        // 执行匹配
        try {
            matchLocationSelect(province, city, district, dataCache.lastLocationSource === 'ip', location);
            logStep('匹配定位结果到选择框成功');
        } catch (error) {
            logStep(`匹配定位结果到选择框失败: ${error.message || error}`);
            // 即使匹配失败，如果有weatherCode也保持天气数据显示
            if (!weatherCode) {
                logStep('匹配失败且无weatherCode，显示手动选择提示');
                updateCityDisplay({
                    name: fullCityName + ' (定位结果仅供参考)',
                    code: weatherCode || '请手动选择确认'
                });
            }
        }
    };

    // 数据已加载时才匹配选框，避免无效操作
    if (dataCache.fullAreaData) {
        // 使用更长的延迟并添加重试机制
        logStep('省市县数据已加载，准备匹配定位结果到选择框');
        setTimeout(() => {
            attemptMatchLocation();
        }, 500);
    } else if (!dataCache.loading) {
        // 数据未加载且不在加载中时才触发加载
        logStep('省市县数据尚未加载，需要先加载数据');
        loadAreaCodes().then(() => {
            // 数据加载完成后再匹配，使用重试机制
            logStep('省市县数据加载完成，准备匹配定位结果');
            setTimeout(() => {
                attemptMatchLocation();
            }, 500);
        }).catch(error => {
            logStep(`加载省市县数据失败: ${error.message || error}`);
            // 即使加载失败，如果有weatherCode也保持天气数据显示
            if (!weatherCode) {
                logStep('无weatherCode且区域数据加载失败，显示手动选择提示');
                updateCityDisplay({ 
                    name: fullCityName + ' (请手动选择确认)', 
                    code: '数据加载失败' 
                });
            }
        });
    } else {
        logStep('省市县数据正在加载中，等待加载完成后自动匹配');
    }
    
    // 记录weatherCode信息
    if (weatherCode) {
        logStep(`${dataCache.lastLocationSource === 'ip' ? 'IP定位' : '位置选择'}获取weatherCode: ${weatherCode}，用于加载天气数据`);
        // 确保天气数据已加载
        if (!dataCache.currentWeatherData || dataCache.currentWeatherData.code !== weatherCode) {
            logStep('天气数据不匹配或未加载，触发加载');
            loadWeatherData(weatherCode, mojiAreaCode);
        }
    }
    
    return fullCityName;
}

// 更新城市显示
function updateCityDisplay(locationInfo) {
    // 验证输入参数
    if (!locationInfo || typeof locationInfo !== 'object' || !locationInfo.name) {
        logStep('警告: 更新城市显示时缺少必要的位置信息');
        return;
    }
    
    // 获取DOM元素
    const cityNameElement = document.getElementById('city-name');
    const cityCodeElement = document.getElementById('city-code');
    const currentTempElement = document.getElementById('current-temp');
    const currentWeaElement = document.getElementById('current-wea');
    
    // 更新城市名称显示
    if (cityNameElement) {
        cityNameElement.textContent = locationInfo.name;
        logStep(`城市名称已更新为: ${locationInfo.name}`);
    } else {
        logStep('警告: 未找到城市名称DOM元素');
    }
    
    // 更新城市代码显示
    if (cityCodeElement) {
        const codeText = locationInfo.code ? `城市代码: ${locationInfo.code}` : '城市代码: 未获取';
        cityCodeElement.textContent = codeText;
        logStep(`城市代码已更新为: ${locationInfo.code || '未获取'}`);
    } else {
        logStep('警告: 未找到城市代码DOM元素');
    }
    
    // 重置温度和天气状况显示，等待实际数据
    if (currentTempElement && !locationInfo.name.includes('定位')) {
        currentTempElement.textContent = '--°';
    }
    if (currentWeaElement && !locationInfo.name.includes('定位')) {
        currentWeaElement.textContent = '--';
    }
}

// 在省份下直接查找区县的函数
function findDistrictInProvince(provinceName, districtName) {
    logStep(`在省份 ${provinceName} 下查找区县 ${districtName}`);
    
    // 输入验证
    if (!validateSearchInputs(provinceName, districtName)) {
        return null;
    }
    
    // 快速查找：使用fullDistrictMap进行O(1)查找
    const quickResult = findDistrictByMap(provinceName, districtName);
    if (quickResult) {
        return quickResult;
    }
    
    // 标准化输入名称
    const cleanProvince = normalizeProvinceName(provinceName);
    const cleanDistrict = normalizeDistrictName(districtName);
    
    // 遍历查找：作为备选方案
    return searchDistrictByTraversal(cleanProvince, cleanDistrict);
}

// 验证搜索输入
function validateSearchInputs(provinceName, districtName) {
    return (
        dataCache.fullAreaData && 
        Array.isArray(dataCache.fullAreaData) && 
        provinceName && 
        districtName
    );
}

// 通过映射表快速查找区县
function findDistrictByMap(provinceName, districtName) {
    const cleanProvince = normalizeProvinceName(provinceName);
    const cleanDistrict = normalizeDistrictName(districtName);
    
    // 尝试使用映射表进行O(1)查找
    const mapKey = `${cleanProvince}_${cleanDistrict}`;
    if (dataCache.fullDistrictMap && dataCache.fullDistrictMap[mapKey]) {
        const districtInfo = dataCache.fullDistrictMap[mapKey];
        logStep(`通过映射表快速找到区县: ${districtInfo.districtName}`);
        return {
            districtName: districtInfo.districtName,
            cityName: districtInfo.cityName,
            provinceName: districtInfo.fullName.replace(districtInfo.cityName, '').replace(districtInfo.districtName, '').trim(),
            code: districtInfo.code,
            mojiCode: districtInfo.mojiCode,
            provinceMojiCode: districtInfo.provinceMojiCode
        };
    }
    
    return null;
}

// 通过遍历查找区县
function searchDistrictByTraversal(cleanProvince, cleanDistrict) {
    // 遍历省份数据
    for (const province of dataCache.fullAreaData) {
        if (!province || !province.name) continue;
        
        const pName = normalizeProvinceName(province.name);
        
        // 匹配省份
        if (isProvinceMatch(pName, cleanProvince)) {
            logStep(`找到匹配省份: ${province.name}`);
            
            // 遍历城市
            if (province.children && Array.isArray(province.children)) {
                for (const city of province.children) {
                    if (!city || !city.children || !Array.isArray(city.children)) continue;
                    
                    // 遍历区县
                    const foundDistrict = findDistrictInCity(city, cleanDistrict, province);
                    if (foundDistrict) {
                        return foundDistrict;
                    }
                }
            }
        }
    }
    
    return null;
}

// 判断省份是否匹配
function isProvinceMatch(pName, cleanProvince) {
    return pName === cleanProvince || 
           pName.includes(cleanProvince) || 
           cleanProvince.includes(pName);
}

// 在城市中查找区县
function findDistrictInCity(city, cleanDistrict, province) {
    for (const district of city.children) {
        if (!district || !district.name) continue;
        
        const dName = normalizeDistrictName(district.name);
        
        // 匹配区县
        if (isDistrictMatch(dName, cleanDistrict, district.name)) {
            logStep(`找到匹配区县: ${district.name}`);
            return {
                districtName: district.name,
                cityName: city.name,
                provinceName: province.name,
                code: district.code,
                mojiCode: district.mojiCode || '',
                provinceMojiCode: province.mojiCode || ''
            };
        }
    }
    
    return null;
}

// 判断区县是否匹配
function isDistrictMatch(dName, cleanDistrict, originalDistrictName) {
    return dName === cleanDistrict || 
           originalDistrictName.includes(cleanDistrict) || 
           cleanDistrict.includes(dName);
}

// 匹配省市区选择框 - 优化数据联动渲染和异步处理
// 验证选择框元素
function validateSelectElements() {
    try {
        const provinceSelect = document.getElementById('province-select');
        const citySelect = document.getElementById('city-select');
        const districtSelect = document.getElementById('district-select');
        
        if (!provinceSelect || !citySelect || !districtSelect) {
            logStep('错误: 缺少必要的选择框元素');
            return null;
        }
        
        return { provinceSelect, citySelect, districtSelect };
    } catch (error) {
        logStep(`验证选择框元素时出错: ${error.message || error}`);
        return null;
    }
}

// 确保区域数据已加载
function ensureAreaDataLoaded() {
    return new Promise((resolve, reject) => {
        try {
            // 添加超时处理
            const timeoutId = setTimeout(() => {
                const error = new Error('加载区域数据超时');
                logStep(error.message);
                reject(error);
            }, 10000); // 10秒超时

            if (!dataCache.fullAreaData && !dataCache.loading) {
                logStep('数据尚未加载，开始加载');
                loadAreaCodes()
                    .then(() => {
                        clearTimeout(timeoutId);
                        setTimeout(() => resolve(true), 100);
                    })
                    .catch(error => {
                        clearTimeout(timeoutId);
                        logStep(`错误: 加载区域数据失败: ${error.message || error}`);
                        reject(error);
                    });
            } else if (dataCache.loading) {
                logStep('数据正在加载中，等待完成');
                // 使用轮询方式等待数据加载完成
                const maxRetries = 30; // 最多重试30次
                let retryCount = 0;
                
                const checkLoaded = () => {
                    if (retryCount >= maxRetries) {
                        clearTimeout(timeoutId);
                        const error = new Error('数据加载等待超时');
                        logStep(error.message);
                        reject(error);
                        return;
                    }
                    
                    if (!dataCache.loading && dataCache.fullAreaData) {
                        clearTimeout(timeoutId);
                        resolve(true);
                    } else {
                        retryCount++;
                        setTimeout(checkLoaded, 300);
                    }
                };
                checkLoaded();
            } else {
                clearTimeout(timeoutId);
                resolve(true);
            }
        } catch (error) {
            logStep(`确保区域数据加载时出错: ${error.message || error}`);
            reject(error);
        }
    });
}

// 清理位置名称
function cleanLocationNames(province, city, district) {
    return {
        cleanProvince: province ? province.replace(/省$/, '').trim() : '',
        cleanCity: city ? city.replace(/市$/, '').trim() : null,
        cleanDistrict: district ? district.replace(/[区县]$/, '').trim() : null
    };
}

// 保存匹配位置信息到缓存
function saveMatchingLocationToCache(province, city, district, isIpLocation, locationData) {
    const { cleanProvince, cleanCity, cleanDistrict } = cleanLocationNames(province, city, district);
    
    dataCache.currentMatchingLocation = {
        province: province,
        city: city,
        district: district,
        cleanProvince,
        cleanCity,
        cleanDistrict,
        isIpLocation: isIpLocation,
        locationData: locationData
    };
    
    if (locationData) {
        dataCache.ipLocationData = locationData;
    }
}

// 处理IP定位场景 - 完整三级数据
function handleIpLocationWithFullData(cleanProvince, cleanCity, cleanDistrict) {
    return new Promise((resolve, reject) => {
        const { provinceSelect, citySelect, districtSelect } = validateSelectElements() || {};
        if (!provinceSelect || !citySelect || !districtSelect) {
            reject(new Error('缺少必要的选择框元素'));
            return;
        }
        
        // 1. 选择省份
        const selectProvince = () => {
            return new Promise((resolve) => {
                for (let i = 0; i < provinceSelect.options.length; i++) {
                    const option = provinceSelect.options[i];
                    if (option.text === cleanProvince || 
                        option.text.includes(cleanProvince) ||
                        option.text.replace(/省$/, '') === cleanProvince) {
                        provinceSelect.selectedIndex = i;
                        provinceSelect.dispatchEvent(new Event('change', { bubbles: true }));
                        handleProvinceChange();
                        logStep(`IP定位: 成功选择省份: ${cleanProvince}`);
                        resolve(true);
                        return;
                    }
                }
                resolve(false);
            });
        };
        
        // 2. 选择城市
        const selectCity = () => {
            return new Promise((resolve) => {
                setTimeout(() => {
                    for (let i = 0; i < citySelect.options.length; i++) {
                        const option = citySelect.options[i];
                        if (option.text === cleanCity || 
                            option.text.includes(cleanCity) ||
                            option.text.replace(/市$/, '') === cleanCity) {
                            citySelect.selectedIndex = i;
                            citySelect.dispatchEvent(new Event('change', { bubbles: true }));
                            handleCityChange();
                            logStep(`IP定位: 成功选择城市: ${cleanCity}`);
                            resolve(true);
                            return;
                        }
                    }
                    resolve(false);
                }, 500);
            });
        };
        
        // 3. 选择区县
        const selectDistrict = () => {
            return new Promise((resolve) => {
                setTimeout(() => {
                    for (let i = 0; i < districtSelect.options.length; i++) {
                        const option = districtSelect.options[i];
                        if (option.text === cleanDistrict || 
                            option.text.includes(cleanDistrict) ||
                            option.text.replace(/[区县]$/, '') === cleanDistrict) {
                            districtSelect.selectedIndex = i;
                            districtSelect.dispatchEvent(new Event('change', { bubbles: true }));
                            logStep(`IP定位: 成功选择区县: ${cleanDistrict}`);
                            resolve(true);
                            return;
                        }
                    }
                    resolve(false);
                }, 800);
            });
        };
        
        // 按顺序执行选择
        setTimeout(() => {
            selectProvince()
                .then(provinceSelected => {
                    if (!provinceSelected) {
                        throw new Error(`未找到匹配的省份: ${cleanProvince}`);
                    }
                    return selectCity();
                })
                .then(citySelected => {
                    if (!citySelected) {
                        throw new Error(`未找到匹配的城市: ${cleanCity}`);
                    }
                    return selectDistrict();
                })
                .then(districtSelected => {
                    if (!districtSelected) {
                        throw new Error(`未找到匹配的区县: ${cleanDistrict}`);
                    }
                    resolve(true);
                })
                .catch(error => {
                    logStep(`IP定位失败: ${error.message}`);
                    reject(error);
                });
        }, 500);
    });
}

// 处理IP定位场景 - 只有省份和区县
function handleIpLocationWithProvinceAndDistrict(province, cleanProvince, cleanDistrict, locationData) {
    const districtInfo = findDistrictInProvince(cleanProvince, cleanDistrict);
    if (!districtInfo || !districtInfo.districtName) {
        // 如果有weatherCode，直接使用
        if (locationData && locationData.weatherCode) {
            loadWeatherData(locationData.weatherCode, locationData.mojiAreaCode);
            updateCityDisplay({
                name: `${province}${cleanDistrict}`,
                code: locationData.weatherCode
            });
        }
        return false;
    }
    
    // 构建完整的城市名称
    let fullCityName = province;
    if (districtInfo.cityName && districtInfo.cityName !== province && !districtInfo.cityName.includes(province)) {
        fullCityName += districtInfo.cityName;
    }
    fullCityName += districtInfo.districtName;
    
    // 更新城市显示
    updateCityDisplay({
        name: fullCityName,
        code: districtInfo.code || locationData.weatherCode || '未找到'
    });
    
    // 优先使用IP定位返回的weatherCode和mojiAreaCode
    let weatherCode = districtInfo.code;
    let mojiAreaCode = '';
    
    if (locationData && locationData.weatherCode) {
        weatherCode = locationData.weatherCode;
        mojiAreaCode = locationData.mojiAreaCode || '';
    } else if (districtInfo.provinceMojiCode && districtInfo.mojiCode) {
        mojiAreaCode = `${districtInfo.provinceMojiCode}/${districtInfo.mojiCode}`;
    }
    
    // 加载天气数据
    loadWeatherData(weatherCode, mojiAreaCode);
    
    // 尝试匹配省份选择框
    findAndSelectProvinceByDistrict(districtInfo, cleanProvince);
    
    return true;
}

// 处理IP定位场景 - 只有省份信息
function handleIpLocationWithProvinceOnly(province, locationData) {
    if (locationData && locationData.weatherCode) {
        loadWeatherData(locationData.weatherCode, locationData.mojiAreaCode);
        updateCityDisplay({
            name: province,
            code: locationData.weatherCode
        });
        return true;
    }
    return false;
}

// 查找省份代码
function findProvinceCode(cleanProvince) {
    if (!cleanProvince || !dataCache.fullAreaData || !Array.isArray(dataCache.fullAreaData)) {
        return null;
    }
    
    // 优先使用映射表
    let selectedProvinceCode = dataCache.provinceMap[cleanProvince];
    
    // 如果映射表中找不到，遍历原始数据查找
    if (!selectedProvinceCode) {
        for (const p of dataCache.fullAreaData) {
            if (p && p.name) {
                const pName = p.name.replace(/省$/, '').trim();
                if (pName === cleanProvince || p.name.includes(cleanProvince) || cleanProvince.includes(pName)) {
                    selectedProvinceCode = p.code || '';
                    break;
                }
            }
        }
    }
    
    return selectedProvinceCode;
}

// 设置选择框值并触发事件
function setSelectValue(selectElement, value) {
    for (let i = 0; i < selectElement.options.length; i++) {
        if (selectElement.options[i].value === value) {
            selectElement.selectedIndex = i;
            selectElement.value = value;
            // 强制触发DOM更新
            selectElement.focus();
            selectElement.blur();
            // 触发change事件
            const event = new Event('change', { bubbles: true });
            selectElement.dispatchEvent(event);
            return true;
        }
    }
    return false;
}

// 主函数：匹配位置选择框
function matchLocationSelect(province, city, district, isIpLocation = false, locationData = null) {
    try {
        logStep(`开始匹配位置选择框: 省份=${province}, 城市=${city}, 区县=${district}, 是否IP定位=${isIpLocation}`);
        
        // 健壮性检查
        if (!province) {
            logStep('匹配失败: 缺少必要的省份参数');
            return;
        }
        
        // 保存匹配位置信息到缓存
        saveMatchingLocationToCache(province, city, district, isIpLocation, locationData);
        
        // 验证选择框元素
        const selectElements = validateSelectElements();
        if (!selectElements) {
            // 即使选择框不存在，IP定位场景下仍尝试加载天气数据
            if (isIpLocation && locationData && locationData.weatherCode) {
                logStep('选择框不存在但有IP定位数据，直接加载天气');
                let fullCityName = locationData.province || '';
                if (locationData.city) fullCityName += locationData.city;
                if (locationData.district) fullCityName += locationData.district;
                updateCityDisplay({
                    name: fullCityName,
                    code: locationData.weatherCode
                });
                loadWeatherData(locationData.weatherCode, locationData.mojiAreaCode);
            }
            return;
        }
        
        const { provinceSelect, citySelect, districtSelect } = selectElements;
        const { cleanProvince, cleanCity, cleanDistrict } = cleanLocationNames(province, city, district);
        
        logStep(`清理后的位置名称: 省份=${cleanProvince}, 城市=${cleanCity || '无'}, 区县=${cleanDistrict || '无'}`);
        
        // 确保省市区选择框重置
        try {
            citySelect.innerHTML = '<option value="">请选择城市</option>';
            citySelect.disabled = false;
            districtSelect.innerHTML = '<option value="">请选择区县</option>';
            districtSelect.disabled = true;
        } catch (domError) {
            logStep(`重置选择框时出错: ${domError.message || domError}`);
        }
        
        // 确保数据已加载
        ensureAreaDataLoaded()
            .then(() => {
                // 处理IP定位场景
                if (isIpLocation) {
                    handleIpLocationMatching(province, cleanProvince, cleanCity, cleanDistrict, locationData);
                    return;
                }
                
                // 常规匹配流程
                processRegularMatching(province, cleanProvince, cleanCity, cleanDistrict, isIpLocation, locationData, provinceSelect, citySelect, districtSelect);
            })
            .catch(error => {
                logStep(`匹配过程中出错: ${error.message || error}`);
                // 错误情况下的兜底策略
                handleMatchingError(province, city, district, isIpLocation, locationData);
            });
    } catch (error) {
        logStep(`matchLocationSelect函数执行出错: ${error.message || error}`);
        // 全局兜底逻辑
        if (isIpLocation && locationData && locationData.weatherCode) {
            handleIpFallback(locationData);
        }
    }
}

// 处理匹配错误时的兜底逻辑
function handleMatchingError(province, city, district, isIpLocation, locationData) {
    logStep('执行匹配错误兜底逻辑');
    
    // IP定位的兜底策略
    if (isIpLocation && locationData && locationData.weatherCode) {
        return handleIpFallback(locationData);
    }
    
    // 常规匹配失败的兜底策略
    // 尝试使用已有的城市代码直接加载天气
    const cachedDistrict = dataCache.selectedDistrict;
    if (cachedDistrict && cachedDistrict.code) {
        logStep('使用缓存的区县代码作为兜底');
        loadWeatherData(cachedDistrict.code, cachedDistrict.mojiCode || '');
        return;
    }
    
    // 尝试选择默认城市（北京）
    try {
        logStep('尝试选择默认城市作为兜底');
        const provinceSelect = document.getElementById('province-select');
        if (provinceSelect) {
            // 尝试选择北京或第一个省份
            let beijingIndex = -1;
            for (let i = 0; i < provinceSelect.options.length; i++) {
                if (provinceSelect.options[i].text.includes('北京') || 
                    provinceSelect.options[i].text.includes('北京市')) {
                    beijingIndex = i;
                    break;
                }
            }
            
            if (beijingIndex >= 0) {
                provinceSelect.selectedIndex = beijingIndex;
                provinceSelect.dispatchEvent(new Event('change', { bubbles: true }));
                handleProvinceChange();
            } else if (provinceSelect.options.length > 1) {
                provinceSelect.selectedIndex = 1; // 选择第一个实际省份
                provinceSelect.dispatchEvent(new Event('change', { bubbles: true }));
                handleProvinceChange();
            }
        }
    } catch (fallbackError) {
        logStep(`兜底策略执行失败: ${fallbackError.message || fallbackError}`);
    }
}

// IP定位失败时的兜底处理
function handleIpFallback(locationData) {
    try {
        logStep('执行IP定位兜底策略');
        let fullCityName = locationData.province || '';
        if (locationData.city && locationData.city !== locationData.province) {
            fullCityName += locationData.city;
        }
        if (locationData.district) {
            fullCityName += locationData.district;
        }
        
        // 更新城市显示并加载天气数据
        updateCityDisplay({
            name: fullCityName,
            code: locationData.weatherCode
        });
        loadWeatherData(locationData.weatherCode, locationData.mojiAreaCode || '');
        
        return true;
    } catch (error) {
        logStep(`IP定位兜底失败: ${error.message || error}`);
        return false;
    }
}

// 处理IP定位匹配
function handleIpLocationMatching(province, cleanProvince, cleanCity, cleanDistrict, locationData) {
    try {
        logStep('处理IP定位场景');
        
        // 情况1：完整的三级数据
        if (cleanProvince && cleanCity && cleanDistrict) {
            handleIpLocationWithFullData(cleanProvince, cleanCity, cleanDistrict)
                .catch((error) => {
                    logStep(`IP定位完整数据匹配失败: ${error.message || error}`);
                    // 如果匹配失败，尝试使用weatherCode直接加载
                    if (locationData && locationData.weatherCode) {
                        loadWeatherData(locationData.weatherCode, locationData.mojiAreaCode);
                        updateCityDisplay({
                            name: `${province}${cleanCity}${cleanDistrict}`,
                            code: locationData.weatherCode
                        });
                    }
                });
        }
        // 情况2：只有省份和区县
        else if (cleanProvince && cleanDistrict && !cleanCity) {
            if (!handleIpLocationWithProvinceAndDistrict(province, cleanProvince, cleanDistrict, locationData)) {
                // 如果处理失败，执行兜底策略
                handleIpFallback(locationData);
            }
        }
        // 情况3：只有省份信息
        else if (cleanProvince && !cleanCity && !cleanDistrict) {
            if (!handleIpLocationWithProvinceOnly(province, locationData)) {
                // 如果处理失败，执行兜底策略
                handleIpFallback(locationData);
            }
        } else {
            logStep('IP定位数据不完整，执行兜底策略');
            handleIpFallback(locationData);
        }
    } catch (error) {
        logStep(`处理IP定位时出错: ${error.message || error}`);
        handleIpFallback(locationData);
    }
}

// 处理常规匹配流程
function processRegularMatching(province, cleanProvince, cleanCity, cleanDistrict, isIpLocation, locationData, provinceSelect, citySelect, districtSelect) {
    // 查找省份代码
    let selectedProvinceCode = findProvinceCode(cleanProvince);
    
    // 如果未找到匹配的省份，选择第一个省份
    if (!selectedProvinceCode && dataCache.fullAreaData && Array.isArray(dataCache.fullAreaData) && dataCache.fullAreaData.length > 0) {
        const firstProvince = dataCache.fullAreaData[0];
        if (firstProvince) {
            selectedProvinceCode = firstProvince.code || '';
            logStep(`未找到匹配省份，选择第一个省份: ${firstProvince.name}, ${selectedProvinceCode}`);
        }
    }
    
    if (!selectedProvinceCode) {
        logStep(`未找到匹配的省份，且无法选择默认省份: ${cleanProvince}`);
        return;
    }
    
    // 设置省份选择
    if (setSelectValue(provinceSelect, selectedProvinceCode)) {
        handleProvinceChange();
        
        // 使用Promise链管理异步流程
        new Promise(resolve => setTimeout(resolve, 300))
            .then(() => {
                if (cleanProvince && cleanCity) {
                    return findAndSelectCity(selectedProvinceCode, cleanProvince, cleanCity);
                }
                return Promise.resolve(null);
            })
            .then(selectedCityCode => {
                if (selectedCityCode && cleanProvince && cleanCity && cleanDistrict) {
                    const districtResult = findAndSelectDistrict(selectedProvinceCode, selectedCityCode, cleanProvince, cleanCity, cleanDistrict);
                    return districtResult.then(selectedDistrictCode => {
                        // 如果是IP定位且有locationData，确保使用IP定位返回的weatherCode
                        if (isIpLocation && locationData && locationData.weatherCode) {
                            dataCache.selectedDistrict = dataCache.selectedDistrict || {};
                            dataCache.selectedDistrict.code = locationData.weatherCode;
                            dataCache.selectedDistrict.mojiCode = locationData.mojiAreaCode || '';
                            return locationData.weatherCode;
                        }
                        return selectedDistrictCode;
                    });
                }
                return Promise.resolve(null);
            })
            .then(selectedDistrictCode => {
                if (selectedDistrictCode) {
                    logStep(`省市区选择匹配成功，区县代码: ${selectedDistrictCode}`);
                    
                    // 确保区县选择框已正确勾选
                    setTimeout(() => {
                        if (districtSelect.value !== selectedDistrictCode) {
                            districtSelect.value = selectedDistrictCode;
                        }
                        
                        // 加载天气数据
                        if (isIpLocation && locationData && locationData.weatherCode) {
                            loadWeatherData(locationData.weatherCode, locationData.mojiAreaCode);
                        } else {
                            const districtInfo = dataCache.selectedDistrict;
                            const mojiAreaCode = districtInfo && districtInfo.mojiCode ? 
                                `${dataCache.selectedProvince?.mojiCode || ''}/${districtInfo.mojiCode}` : '';
                            loadWeatherData(selectedDistrictCode, mojiAreaCode);
                        }
                    }, 100);
                }
            })
            .catch(error => {
                logStep(`错误: 匹配省市区选择框出错: ${error.message || error}`);
            });
    } else {
        logStep(`警告: 省份选择框中未找到代码为 ${selectedProvinceCode} 的选项`);
        // 尝试重新加载区域数据
        dataCache.loading = false;
        dataCache.fullAreaData = null;
        ensureAreaDataLoaded().then(() => {
            setTimeout(() => {
                matchLocationSelect(province, city, district, isIpLocation, locationData);
            }, 200);
        });
    }
}

// 辅助函数：通过区县信息查找并选择省份 - 增强版带重试机制
function findAndSelectProvinceByDistrict(districtInfo, provinceName) {
    try {
        logStep(`【调试】findAndSelectProvinceByDistrict函数开始执行`);
        
        // 使用备选数据
        if (!districtInfo && window._tempDistrictInfo) {
            districtInfo = window._tempDistrictInfo;
        }
        
        // 参数验证
        if (!districtInfo || !provinceName) {
            logStep(`【错误】无效参数: districtInfo=${!!districtInfo}, provinceName=${provinceName}`);
            // 设置默认值作为最后的兜底
            if (!provinceName && districtInfo && districtInfo.provinceName) {
                provinceName = districtInfo.provinceName;
                logStep(`【兜底】使用districtInfo中的provinceName: ${provinceName}`);
            } else {
                logStep(`【兜底】无法获取有效的省份名称，使用默认省份`);
                selectDefaultProvince();
                return;
            }
        }

        let provinceSelect = document.getElementById('province-select');
        if (!provinceSelect) {
            logStep(`【错误】无法获取省份选择框元素`);
            // 延迟重试获取选择框
            setTimeout(() => {
                findAndSelectProvinceByDistrict(districtInfo, provinceName);
            }, 500);
            return;
        }
        
        // 检查选择框是否有选项
        if (!provinceSelect.options || provinceSelect.options.length <= 1) {
            logStep('【警告】省份选择框尚未加载完整或无选项');
            // 尝试重新加载省份数据
            try {
                if (typeof ensureAreaDataLoaded === 'function') {
                    ensureAreaDataLoaded().then(() => {
                        setTimeout(() => {
                            findAndSelectProvinceByDistrict(districtInfo, provinceName);
                        }, 500);
                    }).catch(loadError => {
                        logStep(`【错误】重新加载区域数据失败: ${loadError.message || loadError}`);
                        selectDefaultProvince();
                    });
                } else {
                    selectDefaultProvince();
                }
            } catch (reloadError) {
                logStep(`【错误】尝试重新加载省份数据失败: ${reloadError.message || reloadError}`);
                selectDefaultProvince();
            }
            return;
        }
        
        // 重试函数
        const attemptProvinceSelection = (attempt = 1, maxAttempts = 3, delay = 500) => {
            try {
                let found = false;
                const cleanProvinceName = provinceName.replace(/[省市自治区]$/, '').trim();
                
                // 支持多种匹配方式，使用优先级排序
                let bestMatchIndex = -1;
                let bestMatchScore = 0;
                
                logStep(`【匹配】尝试查找省份: ${cleanProvinceName} (尝试 ${attempt}/${maxAttempts})`);
                
                // 查找对应的省份
                for (let i = 0; i < provinceSelect.options.length; i++) {
                    try {
                        const option = provinceSelect.options[i];
                        const optionText = option.text || '';
                        const optionValue = option.value || '';
                        const optionName = optionText.replace(/[省市自治区]$/, '').trim();
                        
                        // 跳过空值选项
                        if (!optionValue) continue;
                        
                        // 精确匹配最高优先级
                        if (optionName === cleanProvinceName) {
                            bestMatchIndex = i;
                            bestMatchScore = 5;
                            break;
                        }
                        // 完整包含次之
                        else if (optionText.includes(cleanProvinceName)) {
                            if (3 > bestMatchScore) {
                                bestMatchIndex = i;
                                bestMatchScore = 3;
                            }
                        }
                        // 部分包含
                        else if (cleanProvinceName.includes(optionName)) {
                            if (2 > bestMatchScore) {
                                bestMatchIndex = i;
                                bestMatchScore = 2;
                            }
                        }
                        // MojiCode匹配
                        else if (optionValue === districtInfo.provinceMojiCode) {
                            if (4 > bestMatchScore) {
                                bestMatchIndex = i;
                                bestMatchScore = 4;
                            }
                        }
                        // 原始名称包含
                        else if (optionText.includes(provinceName)) {
                            if (1 > bestMatchScore) {
                                bestMatchIndex = i;
                                bestMatchScore = 1;
                            }
                        }
                    } catch (matchError) {
                        logStep(`【警告】匹配选项时出错: ${matchError.message || matchError}`);
                    }
                }
                
                // 执行选中操作
                if (bestMatchIndex !== -1) {
                    try {
                        const option = provinceSelect.options[bestMatchIndex];
                        
                        logStep(`【成功】找到最优省份匹配: ${option.text || '未知'} (匹配分数: ${bestMatchScore})`);
                        
                        // 设置选中状态
                        provinceSelect.selectedIndex = bestMatchIndex;
                        provinceSelect.value = option.value;
                        
                        // 强制刷新UI
                        try {
                            provinceSelect.focus();
                            provinceSelect.blur();
                        } catch (uiError) {
                            logStep(`UI刷新错误: ${uiError.message || uiError}`);
                        }
                        
                        // 触发事件，增加错误处理和备用方案
                        try {
                            provinceSelect.dispatchEvent(new Event('change', { bubbles: true }));
                            // 备用方案：直接调用处理函数
                            if (typeof handleProvinceChange === 'function') {
                                try {
                                    handleProvinceChange();
                                } catch (handlerError) {
                                    logStep(`调用handleProvinceChange函数失败: ${handlerError.message || handlerError}`);
                                }
                            }
                        } catch (eventError) {
                            logStep(`事件触发错误: ${eventError.message || eventError}`);
                            // 备用方案：直接调用处理函数
                            if (typeof handleProvinceChange === 'function') {
                                try {
                                    handleProvinceChange();
                                } catch (handlerError) {
                                    logStep(`调用handleProvinceChange函数失败: ${handlerError.message || handlerError}`);
                                }
                            }
                        }
                        
                        found = true;
                        
                        // 延迟调用城市选择，增加更完善的错误处理
                        setTimeout(() => {
                            try {
                                findAndSelectCityByDistrict(districtInfo, 1);
                            } catch (cityError) {
                                logStep(`城市选择失败: ${cityError.message || cityError}`);
                                // 备用方案：直接触发城市列表刷新
                                try {
                                    const citySelect = document.getElementById('city-select');
                                    if (citySelect) {
                                        citySelect.selectedIndex = 0;
                                        citySelect.dispatchEvent(new Event('change', { bubbles: true }));
                                    }
                                } catch (fallbackError) {
                                    logStep(`备用方案执行失败: ${fallbackError.message || fallbackError}`);
                                }
                            }
                        }, 800); // 增加延迟时间以确保城市数据已加载
                        
                    } catch (selectionError) {
                        logStep(`错误: 设置省份选择状态失败: ${selectionError.message || selectionError}`);
                        found = false;
                    }
                }
                
                // 如果未找到且未达到最大尝试次数，重试
                if (!found && attempt < maxAttempts) {
                    logStep(`未找到省份选项，${delay}ms后重试 (${attempt}/${maxAttempts})`);
                    setTimeout(() => {
                        // 增加延迟并减少最大尝试次数
                        attemptProvinceSelection(attempt + 1, maxAttempts, delay * 1.5);
                    }, delay);
                } else if (!found) {
                    logStep(`【兜底】多次尝试后仍未找到匹配省份，使用默认省份`);
                    selectDefaultProvince();
                }
            } catch (error) {
                logStep(`尝试选择省份时出错: ${error.message || error}`);
                if (attempt < maxAttempts) {
                    // 异常情况下也重试
                    setTimeout(() => {
                        attemptProvinceSelection(attempt + 1, maxAttempts, 1000);
                    }, 1000);
                } else {
                    selectDefaultProvince();
                }
            }
        };
        
        // 开始尝试选择省份
        attemptProvinceSelection();
    } catch (error) {
        logStep(`findAndSelectProvinceByDistrict函数执行出错: ${error.message || error}`);
        // 全局兜底处理
        selectDefaultProvince();
    }
    
    // 辅助函数：选择默认省份
    function selectDefaultProvince() {
        try {
            logStep(`【兜底】执行默认省份选择`);
            const provinceSelect = document.getElementById('province-select');
            if (provinceSelect && provinceSelect.options && provinceSelect.options.length > 1) {
                // 优先选择常用省份（北京、上海等）
                const commonProvinces = ['北京', '上海', '广东', '江苏'];
                let selected = false;
                
                for (let i = 0; i < provinceSelect.options.length; i++) {
                    const option = provinceSelect.options[i];
                    const optionText = option.text || '';
                    
                    if (commonProvinces.some(provin => optionText.includes(provin)) && option.value) {
                        provinceSelect.selectedIndex = i;
                        selected = true;
                        logStep(`【兜底】选择常用省份: ${optionText}`);
                        break;
                    }
                }
                
                // 如果没有找到常用省份，选择第一个非空值选项
                if (!selected) {
                    for (let i = 0; i < provinceSelect.options.length; i++) {
                        if (provinceSelect.options[i].value) {
                            provinceSelect.selectedIndex = i;
                            logStep(`【兜底】选择第一个有效省份: ${provinceSelect.options[i].text || '未知'}`);
                            selected = true;
                            break;
                        }
                    }
                }
                
                // 触发事件
                if (selected) {
                    try {
                        provinceSelect.dispatchEvent(new Event('change', { bubbles: true }));
                        if (typeof handleProvinceChange === 'function') {
                            try {
                                handleProvinceChange();
                            } catch (handlerError) {
                                logStep(`调用handleProvinceChange函数失败: ${handlerError.message || handlerError}`);
                            }
                        }
                    } catch (eventError) {
                        logStep(`触发默认省份选择change事件失败: ${eventError.message || eventError}`);
                    }
                }
            }
        } catch (fallbackError) {
            logStep(`错误: 设置默认省份失败: ${fallbackError.message || fallbackError}`);
        }
    }
}

// 辅助函数：通过区县信息查找并选择城市
function findAndSelectCityByDistrict(districtInfo, attempt = 1) {
    try {
        // 使用备选数据
        if (!districtInfo && window._tempDistrictInfo) {
            districtInfo = window._tempDistrictInfo;
        }
        
        // 参数验证
        if (!districtInfo) {
            logStep('【错误】无效参数: districtInfo不存在');
            return;
        }

        let citySelect = document.getElementById('city-select');
        if (!citySelect) {
            logStep('【错误】无法获取城市选择框元素');
            return;
        }
        
        const maxAttempts = 3; // 增加重试次数
        const delay = 500; // 增加延迟时间
        
        // 安全获取城市名称
        if (!districtInfo.cityName) {
            logStep('【错误】区县信息中缺少cityName');
            return;
        }
        
        const cleanCityName = districtInfo.cityName.replace(/市$/, '').trim();
        
        logStep(`通过区县信息查找城市: ${cleanCityName} (尝试 ${attempt}/${maxAttempts})`);
        
        // 检查选择框是否有选项
        if (!citySelect.options || citySelect.options.length <= 1) {
            logStep('城市选择框尚未加载完整');
            if (attempt < maxAttempts) {
                setTimeout(() => {
                    findAndSelectCityByDistrict(districtInfo, attempt + 1);
                }, delay);
            } else {
                // 兜底逻辑：尝试重新加载城市数据
                logStep('多次尝试后仍未找到城市选项，尝试重新加载城市数据');
                const provinceSelect = document.getElementById('province-select');
                if (provinceSelect && provinceSelect.value) {
                    try {
                        // 尝试手动触发省份change事件以重新加载城市
                        provinceSelect.dispatchEvent(new Event('change', { bubbles: true }));
                        // 再次尝试查找城市
                        setTimeout(() => {
                            findAndSelectCityByDistrict(districtInfo, 1);
                        }, 1000);
                    } catch (reloadError) {
                        logStep(`错误: 重新加载城市数据失败: ${reloadError}`);
                    }
                }
            }
            return;
        }
        
        // 支持多种匹配方式，优先级排序
        let found = false;
        let bestMatchIndex = -1;
        let bestMatchScore = 0;
        
        for (let i = 0; i < citySelect.options.length; i++) {
            try {
                const option = citySelect.options[i];
                const optionText = option.text || '';
                const optionName = optionText.replace(/市$/, '').trim();
                
                // 精确匹配优先
                if (optionName === cleanCityName) {
                    bestMatchIndex = i;
                    bestMatchScore = 3;
                    break;
                }
                // 部分匹配次之
                else if (optionText.includes(cleanCityName) || cleanCityName.includes(optionName)) {
                    bestMatchIndex = i;
                    bestMatchScore = 2;
                }
                // 原始名称匹配
                else if (optionText === districtInfo.cityName) {
                    bestMatchIndex = i;
                    bestMatchScore = 1;
                }
            } catch (matchError) {
                logStep(`警告: 匹配选项时出错: ${matchError}`);
            }
        }
        
        if (bestMatchIndex !== -1) {
            try {
                const option = citySelect.options[bestMatchIndex];
                
                // 设置选中状态
                citySelect.selectedIndex = bestMatchIndex;
                citySelect.value = option.value;
                
                // 强制刷新UI
                try {
                    citySelect.focus();
                    citySelect.blur();
                } catch (uiError) {
                    logStep(`UI刷新错误: ${uiError}`);
                }
                
                // 触发事件，增加错误处理
                try {
                    citySelect.dispatchEvent(new Event('change', { bubbles: true }));
                } catch (eventError) {
                    logStep(`警告: 触发城市选择change事件失败: ${eventError}`);
                    // 备用方案：直接调用处理函数
                    try {
                        if (typeof handleCityChange === 'function') {
                            handleCityChange();
                        }
                    } catch (handlerError) {
                        logStep(`错误: 调用handleCityChange函数失败: ${handlerError}`);
                    }
                }
                
                found = true;
                logStep(`成功找到城市选项: ${option.text || '未知'}并设置选中状态，匹配分数: ${bestMatchScore}`);
                
                // 延迟调用区县选择，增加错误处理
                setTimeout(() => {
                    try {
                        if (districtInfo.code) {
                            findAndSelectDistrictByCode(districtInfo.code, districtInfo);
                        }
                    } catch (districtError) {
                        logStep(`区县选择失败: ${districtError}`);
                    }
                }, 500);
            } catch (selectionError) {
                logStep(`错误: 设置城市选择状态失败: ${selectionError}`);
                found = false;
            }
        }
        
        // 如果未找到且未达到最大尝试次数，重试
        if (!found && attempt < maxAttempts) {
            logStep(`未找到城市选项，${delay}ms后重试`);
            setTimeout(() => {
                findAndSelectCityByDistrict(districtInfo, attempt + 1);
            }, delay);
        } else if (!found) {
            // 最终兜底：选择第一个城市
            logStep(`最终未找到匹配城市，选择第一个城市作为备选`);
            try {
                if (citySelect.options.length > 1) {
                    citySelect.selectedIndex = 1;
                    try {
                        citySelect.dispatchEvent(new Event('change', { bubbles: true }));
                        if (typeof handleCityChange === 'function') {
                            handleCityChange();
                        }
                    } catch (eventError) {
                        logStep(`警告: 触发城市选择change事件失败: ${eventError}`);
                    }
                }
            } catch (fallbackError) {
                logStep(`错误: 设置默认城市失败: ${fallbackError}`);
            }
        }
    } catch (error) {
        logStep(`错误: findAndSelectCityByDistrict函数异常: ${error}`);
        // 全局兜底处理
        try {
            const citySelect = document.getElementById('city-select');
            if (citySelect && citySelect.options.length > 1) {
                citySelect.selectedIndex = 1;
                citySelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
        } catch (fallbackError) {
            logStep(`错误: 全局兜底处理失败: ${fallbackError}`);
        }
    }
}

// 辅助函数：通过区县代码查找并选择区县
function findAndSelectDistrictByCode(districtCode, distInfo, attempt = 1) {
    try {
        const districtSelect = document.getElementById('district-select');
        if (!districtCode || !districtSelect) {
            logStep('警告: 无效的区县代码或选择框元素');
            return;
        }
        
        const maxAttempts = 3; // 增加重试次数
        const delay = 500; // 增加延迟时间
        
        logStep(`通过区县代码查找区县: ${districtCode} (尝试 ${attempt}/${maxAttempts})`);
        
        // 检查选择框是否有选项
        if (!districtSelect.options || districtSelect.options.length <= 1) {
            logStep('区县选择框尚未加载完整');
            if (attempt < maxAttempts) {
                setTimeout(() => {
                    findAndSelectDistrictByCode(districtCode, distInfo, attempt + 1);
                }, delay);
            } else {
                // 兜底逻辑：尝试重新加载区县数据
                logStep('多次尝试后仍未找到区县选项，尝试重新加载区县数据');
                const citySelect = document.getElementById('city-select');
                if (citySelect && citySelect.value) {
                    try {
                        // 尝试手动触发城市change事件以重新加载区县
                        citySelect.dispatchEvent(new Event('change', { bubbles: true }));
                        // 再次尝试查找区县
                        setTimeout(() => {
                            findAndSelectDistrictByCode(districtCode, distInfo, 1);
                        }, 1000);
                    } catch (reloadError) {
                        logStep(`错误: 重新加载区县数据失败: ${reloadError}`);
                        // 选择默认区县
                        selectDefaultDistrict();
                    }
                } else {
                    selectDefaultDistrict();
                }
            }
            return;
        }
        
        // 优先通过代码查找
        let found = false;
        let bestMatchIndex = -1;
        let bestMatchScore = 0;
        
        // 1. 精确代码匹配
        for (let i = 0; i < districtSelect.options.length; i++) {
            try {
                if (districtSelect.options[i].value === districtCode) {
                    bestMatchIndex = i;
                    bestMatchScore = 4;
                    break;
                }
            } catch (matchError) {
                logStep(`警告: 代码匹配选项时出错: ${matchError}`);
            }
        }
        
        // 2. 如果通过代码没有找到，尝试通过名称查找
        if (bestMatchIndex === -1 && distInfo && distInfo.districtName) {
            const cleanDistrictName = distInfo.districtName.replace(/[区县]$/, '').trim();
            
            for (let i = 0; i < districtSelect.options.length; i++) {
                try {
                    const option = districtSelect.options[i];
                    const optionText = option.text || '';
                    const optionName = optionText.replace(/[区县]$/, '').trim();
                    
                    // 精确名称匹配
                    if (optionName === cleanDistrictName) {
                        bestMatchIndex = i;
                        bestMatchScore = 3;
                        break;
                    }
                    // 部分名称匹配
                    else if (optionText.includes(cleanDistrictName) || cleanDistrictName.includes(optionName)) {
                        bestMatchIndex = i;
                        bestMatchScore = 2;
                    }
                    // 原始名称匹配
                    else if (optionText === distInfo.districtName) {
                        bestMatchIndex = i;
                        bestMatchScore = 1;
                    }
                } catch (matchError) {
                    logStep(`警告: 名称匹配选项时出错: ${matchError}`);
                }
            }
        }
        
        // 执行选中操作
        if (bestMatchIndex !== -1) {
            try {
                const option = districtSelect.options[bestMatchIndex];
                
                // 设置选中状态
                districtSelect.selectedIndex = bestMatchIndex;
                districtSelect.value = option.value;
                
                // 强制刷新UI
                try {
                    districtSelect.focus();
                    districtSelect.blur();
                } catch (uiError) {
                    logStep(`UI刷新错误: ${uiError}`);
                }
                
                // 触发事件，增加错误处理
                try {
                    districtSelect.dispatchEvent(new Event('change', { bubbles: true }));
                } catch (eventError) {
                    logStep(`警告: 触发区县选择change事件失败: ${eventError}`);
                    // 备用方案：直接加载天气数据
                    try {
                        const mojiAreaCode = dataCache.mojiCodeMap ? dataCache.mojiCodeMap[option.value] : undefined;
                        if (typeof loadWeatherData === 'function') {
                            loadWeatherData(option.value, mojiAreaCode);
                        }
                    } catch (loadError) {
                        logStep(`错误: 直接加载天气数据失败: ${loadError}`);
                    }
                }
                
                found = true;
                logStep(`${bestMatchScore === 4 ? '通过代码' : '通过名称'}成功找到区县选项: ${option.text || '未知'}并设置选中状态，匹配分数: ${bestMatchScore}`);
            } catch (selectionError) {
                logStep(`错误: 设置区县选择状态失败: ${selectionError}`);
                found = false;
            }
        }
        
        // 重试逻辑
        if (!found && attempt < maxAttempts) {
            logStep(`未找到区县选项，${delay}ms后重试 (${attempt}/${maxAttempts})`);
            setTimeout(() => {
                findAndSelectDistrictByCode(districtCode, distInfo, attempt + 1);
            }, delay);
        } else {
            // 最后确认选择
            if (found) {
                setTimeout(() => {
                    try {
                        if (districtSelect.value !== districtCode) {
                            logStep('重新确认区县选择框的值');
                            for (let i = 0; i < districtSelect.options.length; i++) {
                                if (districtSelect.options[i].value === districtCode) {
                                    districtSelect.selectedIndex = i;
                                    districtSelect.value = districtCode;
                                    break;
                                }
                            }
                        }
                    } catch (confirmError) {
                        logStep(`错误: 确认区县选择失败: ${confirmError}`);
                    }
                }, 200);
            } else {
                // 尝试选择第一个区县作为备选
                selectDefaultDistrict();
            }
        }
    } catch (error) {
        logStep(`错误: findAndSelectDistrictByCode函数异常: ${error}`);
        // 全局兜底处理
        selectDefaultDistrict();
    }
    
    // 辅助函数：选择默认区县
    function selectDefaultDistrict() {
        try {
            const districtSelect = document.getElementById('district-select');
            if (districtSelect && districtSelect.options && districtSelect.options.length > 1) {
                districtSelect.selectedIndex = 1;
                try {
                    districtSelect.dispatchEvent(new Event('change', { bubbles: true }));
                } catch (eventError) {
                    logStep(`警告: 触发默认区县选择change事件失败: ${eventError}`);
                    // 直接加载选中区县的天气数据
                    try {
                        const selectedValue = districtSelect.value;
                        const mojiAreaCode = dataCache.mojiCodeMap ? dataCache.mojiCodeMap[selectedValue] : undefined;
                        if (typeof loadWeatherData === 'function') {
                            loadWeatherData(selectedValue, mojiAreaCode);
                        }
                    } catch (loadError) {
                        logStep(`错误: 加载默认区县天气数据失败: ${loadError}`);
                    }
                }
                logStep('选择第一个区县作为备选');
            }
        } catch (fallbackError) {
            logStep(`错误: 设置默认区县失败: ${fallbackError}`);
        }
    }
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
        let selectedCityOption = null;
        
        // 优先使用映射表
        const mapKey = cleanProvince + '_' + cleanCity;
        if (dataCache.cityMap[mapKey]) {
            selectedCityCode = dataCache.cityMap[mapKey];
            logStep(`通过映射表找到城市: ${cleanCity}, ${selectedCityCode}`);
        } else {
            // 遍历原始数据查找
            for (const p of dataCache.fullAreaData) {
                // 省份可能没有code，使用名称匹配
                if (p && (p.code === provinceCode || (!p.code && p.name && p.name.replace(/省$/, '').trim() === cleanProvince)) && p.children && Array.isArray(p.children)) {
                    for (const c of p.children) {
                        if (c && c.name) {
                            const cName = c.name.replace(/市$/, '').trim();
                            // 支持多种匹配方式
                            if (cName === cleanCity || c.name.includes(cleanCity) || cleanCity.includes(cName)) {
                                selectedCityCode = c.code || '';
                                selectedCityOption = c;
                                logStep(`通过遍历找到城市: ${c.name}, ${selectedCityCode}`);
                                break;
                            }
                        }
                    }
                    if (selectedCityCode) break;
                }
            }
        }
        
        // 如果未找到匹配的城市，选择当前省份下第一个城市
        if (!selectedCityCode && dataCache.fullAreaData && Array.isArray(dataCache.fullAreaData)) {
            for (const p of dataCache.fullAreaData) {
                // 省份可能没有code，使用名称匹配
                if (p && (p.code === provinceCode || (!p.code && p.name && p.name.replace(/省$/, '').trim() === cleanProvince)) && p.children && Array.isArray(p.children) && p.children.length > 0) {
                    const firstCity = p.children[0];
                    if (firstCity) {
                        selectedCityCode = firstCity.code || '';
                        selectedCityOption = firstCity;
                        logStep(`未找到匹配城市，选择第一个城市: ${firstCity.name}, ${selectedCityCode}`);
                        break;
                    }
                }
            }
        }
        
        // 设置城市选择
        if (selectedCityCode) {
            // 确保城市选择框中有对应的选项
            let found = false;
            for (let i = 0; i < citySelect.options.length; i++) {
                if (citySelect.options[i].value === selectedCityCode) {
                    citySelect.value = selectedCityCode;
                    // 触发change事件确保视觉上显示为选中状态并触发联动
                    const event = new Event('change', { bubbles: true });
                    citySelect.dispatchEvent(event);
                    found = true;
                    logStep('城市选择框中找到对应选项并设置选中状态');
                    break;
                }
            }
            
            if (!found && selectedCityOption) {
                // 如果选择框中没有找到，尝试通过名称查找
                const cityName = selectedCityOption.name.replace(/市$/, '');
                for (let i = 0; i < citySelect.options.length; i++) {
                    const optionName = citySelect.options[i].text.replace(/市$/, '');
                    if (optionName === cityName) {
                        citySelect.value = citySelect.options[i].value;
                        // 触发change事件确保视觉上显示为选中状态并触发联动
                        const event = new Event('change', { bubbles: true });
                        citySelect.dispatchEvent(event);
                        selectedCityCode = citySelect.options[i].value; // 更新为实际的选项值
                        found = true;
                        logStep(`通过名称找到城市选项: ${cityName}, ${selectedCityCode}并设置选中状态`);
                        break;
                    }
                }
            }
            
            // 调用处理函数
            handleCityChange();
            
            // 增加延迟时间，确保区县列表完全加载
            setTimeout(() => resolve(selectedCityCode), 200);
        } else {
            logStep(`未找到匹配的城市，且无法选择默认城市: ${cleanCity}`);
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
        let selectedDistrictOption = null;
        
        // 优先使用映射表
        const mapKey = cleanProvince + '_' + cleanCity + '_' + cleanDistrict;
        if (dataCache.districtMap[mapKey]) {
            selectedDistrictCode = dataCache.districtMap[mapKey];
            logStep(`通过映射表找到区县: ${cleanDistrict}, ${selectedDistrictCode}`);
        } else {
            // 遍历原始数据查找
            for (const p of dataCache.fullAreaData) {
                // 省份可能没有code，使用名称匹配
                if (p && (p.code === provinceCode || (!p.code && p.name && p.name.replace(/省$/, '').trim() === cleanProvince)) && p.children && Array.isArray(p.children)) {
                    for (const c of p.children) {
                        // 城市可能没有code，使用名称匹配
                        if (c && (c.code === cityCode || (!c.code && c.name && c.name.replace(/市$/, '').trim() === cleanCity)) && c.children && Array.isArray(c.children)) {
                            for (const d of c.children) {
                                if (d && d.name && d.code) {
                                    const dName = d.name.replace(/[区县]$/, '').trim();
                                    // 支持多种匹配方式
                                    if (dName === cleanDistrict || d.name.includes(cleanDistrict) || cleanDistrict.includes(dName)) {
                                        selectedDistrictCode = d.code;
                                        selectedDistrictOption = d;
                                        logStep(`通过遍历找到区县: ${d.name}, ${selectedDistrictCode}`);
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
        
        // 如果未找到匹配的区县，选择当前城市下第一个区县
        if (!selectedDistrictCode && dataCache.fullAreaData && Array.isArray(dataCache.fullAreaData)) {
            for (const p of dataCache.fullAreaData) {
                // 省份可能没有code，使用名称匹配
                if (p && (p.code === provinceCode || (!p.code && p.name && p.name.replace(/省$/, '').trim() === cleanProvince)) && p.children && Array.isArray(p.children)) {
                    for (const c of p.children) {
                        // 城市可能没有code，使用名称匹配
                        if (c && (c.code === cityCode || (!c.code && c.name && c.name.replace(/市$/, '').trim() === cleanCity)) && c.children && Array.isArray(c.children) && c.children.length > 0) {
                            const firstDistrict = c.children[0];
                            if (firstDistrict && firstDistrict.code) {
                                selectedDistrictCode = firstDistrict.code;
                                selectedDistrictOption = firstDistrict;
                                logStep(`未找到匹配区县，选择第一个区县: ${firstDistrict.name}, ${selectedDistrictCode}`);
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
            // 确保区县选择框中有对应的选项
            let found = false;
            for (let i = 0; i < districtSelect.options.length; i++) {
                if (districtSelect.options[i].value === selectedDistrictCode) {
                    districtSelect.value = selectedDistrictCode;
                    // 触发change事件确保视觉上显示为选中状态并触发联动
                    const event = new Event('change', { bubbles: true });
                    districtSelect.dispatchEvent(event);
                    found = true;
                    logStep('区县选择框中找到对应选项并设置选中状态');
                    break;
                }
            }
            
            if (!found && selectedDistrictOption) {
                // 如果选择框中没有找到，尝试通过名称查找
                const districtName = selectedDistrictOption.name.replace(/[区县]$/, '');
                for (let i = 0; i < districtSelect.options.length; i++) {
                    const optionName = districtSelect.options[i].text.replace(/[区县]$/, '');
                    if (optionName === districtName || districtSelect.options[i].text.includes(districtName) || districtName.includes(optionName)) {
                        districtSelect.value = districtSelect.options[i].value;
                        // 触发change事件确保视觉上显示为选中状态并触发联动
                        const event = new Event('change', { bubbles: true });
                        districtSelect.dispatchEvent(event);
                        selectedDistrictCode = districtSelect.options[i].value; // 更新为实际的选项值
                        found = true;
                        logStep(`通过名称找到区县选项: ${districtName}, ${selectedDistrictCode}并设置选中状态`);
                        break;
                    }
                }
            }
            
            // 获取对应的墨迹天气编码
            const mojiAreaCode = dataCache.mojiCodeMap[selectedDistrictCode];
            logStep(`找到的区县代码: ${selectedDistrictCode}, 对应的墨迹天气编码: ${mojiAreaCode || '未找到'}`);
            
            // 加载天气数据，同时传递两种编码
            loadWeatherData(selectedDistrictCode, mojiAreaCode);
            
            // 更新城市代码显示
            const cityCodeElement = document.getElementById('city-code');
            if (cityCodeElement) {
                cityCodeElement.textContent = '城市代码: ' + selectedDistrictCode;
            }
            
            // 增加确认步骤，确保区县选择框已正确勾选
            setTimeout(() => {
                if (districtSelect.value !== selectedDistrictCode) {
                    logStep('重新确认区县选择框的值');
                    districtSelect.value = selectedDistrictCode;
                    // 触发change事件确保视觉上显示为选中状态并触发联动
                    const event = new Event('change', { bubbles: true });
                    districtSelect.dispatchEvent(event);
                }
                resolve(selectedDistrictCode);
            }, 100);
        } else {
            logStep(`未找到匹配的区县，且无法选择默认区县: ${cleanDistrict}`);
            resolve(null);
        }
    });
}

// 加载天气数据
function loadWeatherData(weatherCode, mojiAreaCode, retryCount = 0) {
    logStep(`加载天气数据，代码: ${weatherCode}, 墨迹编码: ${mojiAreaCode}, 重试次数: ${retryCount}`);
    
    if (!weatherCode) {
        logStep('错误: 缺少必要的天气代码参数');
        showWeatherError('缺少必要的天气代码参数');
        return;
    }
    
    // 显示加载状态
    showLoading(true);
    
    // 构建请求URL，根据新的接口参数规则
    // weatherCode必需为区县code
    // mojiAreaCode可为省份或区县mojiCode
    let url = `${WEATHER_API.WEATHER_INFO}?weatherCode=${encodeURIComponent(weatherCode)}`;
    if (mojiAreaCode) {
        url += `&mojiAreaCode=${encodeURIComponent(mojiAreaCode)}`;
    }
    
    logStep(`发送天气数据请求: ${url}`);
    
    // 发送请求，不使用缓存
    fetch(url, { cache: 'no-store' })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP错误，状态码: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            logStep(`成功获取天气数据: ${JSON.stringify(data).substring(0, 100)}...`);
            
            // 处理天气数据并更新UI
            // 支持不同的数据格式：直接使用data参数或者data.data
            let weatherData = null;
            
            // 检查是否有error字段
            if (data && data.error) {
                logStep(`错误: API返回错误: ${data.error}`);
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
                logStep(`错误: 返回的数据格式不符合预期或为空: ${JSON.stringify(data)}`);
                
                // 尝试重试机制，最多重试2次
                if (retryCount < 2) {
                    logStep(`尝试重新获取天气数据，当前重试次数: ${retryCount + 1}`);
                    setTimeout(() => {
                        loadWeatherData(weatherCode, mojiAreaCode, retryCount + 1);
                    }, 1000);
                } else {
                    showWeatherError('获取天气数据失败，请稍后重试');
                }
            }
        })
        .catch(error => {
            logStep(`错误: 天气数据请求异常: ${error}`);
            
            // 区分网络错误和服务器错误
            let errorMessage = '天气数据请求异常，请检查网络连接';
            if (error.message && error.message.includes('HTTP错误')) {
                errorMessage = `服务器错误，请稍后重试`;
            }
            
            // 尝试重试机制，最多重试2次
            if (retryCount < 2) {
                logStep(`因错误尝试重新获取天气数据，当前重试次数: ${retryCount + 1}`);
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
    
    logStep(`错误: 天气数据显示错误: ${message}`);
}

// 根据天气状况获取对应的背景色类
function getWeatherBgColor(weatherCondition) {
    if (!weatherCondition) return 'bg-gray-50';
    
    const condition = weatherCondition.toLowerCase();
    
    // 根据不同天气状况返回不同的背景色类
    if (condition.includes('晴')) {
        return 'bg-gradient-to-br from-blue-50 to-sky-100';
    } else if (condition.includes('云')) {
        return 'bg-gradient-to-br from-gray-50 to-gray-200';
    } else if (condition.includes('雨')) {
        return 'bg-gradient-to-br from-blue-100 to-indigo-200';
    } else if (condition.includes('雪')) {
        return 'bg-gradient-to-br from-blue-50 to-indigo-100';
    } else if (condition.includes('阴')) {
        return 'bg-gradient-to-br from-gray-100 to-gray-200';
    } else if (condition.includes('雾') || condition.includes('霾')) {
        return 'bg-gradient-to-br from-gray-100 to-gray-300';
    } else if (condition.includes('雷')) {
        return 'bg-gradient-to-br from-indigo-100 to-purple-200';
    } else {
        return 'bg-gray-50'; // 默认背景色
    }
}

// 更新今天天气面板 - 使用原有区域显示完整天气信息
function updateTodayWeather(todayWeather) {
    logStep(`更新今日天气数据: ${JSON.stringify(todayWeather).substring(0, 80)}...`);
    if (!todayWeather) {
        logStep('错误: todayWeather数据为空');
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
    const time = todayWeather.time || '--:--';
    
    // 更新today-weather-section中的元素，包括实时温度
    safeUpdate('current-temp', todayWeather.temperature || '--', '°C');
    safeUpdate('weather-condition', todayWeather.weather || '--');
    safeUpdate('temp-range', `${(todayWeather.tempMin || '--')} / ${(todayWeather.tempMax || '--')}°C`);
    safeUpdate('humidity-info', todayWeather.humidity || '--');
    safeUpdate('air-quality', todayWeather.airQuality || '--');
    safeUpdate('wind-info', todayWeather.wind || '--');
    safeUpdate('visibility-info', todayWeather.visibility || '--');
    safeUpdate('traffic-restriction', todayWeather.limit || '--');
    safeUpdate('weather-tips', todayWeather.tips || '暂无提示');
    

    
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
            <div class="extra-info-value">${(todayWeather.visibility || '--')}</div>
        </div>
        <div class="extra-info-item">
            <div class="extra-info-label">限行提示</div>
            <div class="extra-info-value">${(todayWeather.limit || '--')}</div>
        </div>
        <div class="extra-info-item">
            <div class="extra-info-label">今日提示</div>
            <div class="extra-info-value">${(todayWeather.tips || '暂无提示')}</div>
        </div>
    `;
    
    // 更新天气图标
    const weatherIcon = document.getElementById('weather-icon');
    if (weatherIcon && (todayWeather.weather || '--')) {
        let iconClass = 'default-weather-icon';
        const condition = (todayWeather.weather || '--').toLowerCase();
        
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
    
    // 更新生活指数信息
    if (todayWeather.lifeHelper) {
        updateLifeHelper(todayWeather.lifeHelper);
    }
    
    // 动态设置左侧天气区域的背景色
    const leftWeatherArea = document.querySelector('.grid > div:first-child'); // 找到左侧天气区域
    if (leftWeatherArea) {
        // 移除所有可能的背景色类
        leftWeatherArea.className = leftWeatherArea.className.replace(/bg-[\w-]+/g, '').trim();
        // 添加根据天气状况的背景色类
        leftWeatherArea.className += ' ' + getWeatherBgColor(todayWeather.weather || '--');
    }
}

/**
 * 更新生活指数信息
 * @param {Array} lifeHelperData - 生活指数数据
 */
function updateLifeHelper(lifeHelperData) {
    const container = document.getElementById('life-helper-container');
    if (!container || !Array.isArray(lifeHelperData)) {
        return;
    }
    
    // 清空容器
    container.innerHTML = '';
    
    // 为不同类型的生活指数定义图标
    const lifeHelperIcons = {
        '紫外线': 'fa-sun-o',
        '感冒': 'fa-stethoscope',
        '穿衣': 'fa-shopping-bag',
        '洗车': 'fa-car',
        '运动': 'fa-soccer-ball-o',
        '空气污染扩散': 'fa-plus-circle'
    };
    
    // 为不同级别的生活指数定义颜色
    const lifeHelperColors = {
        '优': 'text-green-600',
        '良': 'text-blue-600',
        '中等': 'text-yellow-600',
        '较易发': 'text-orange-600',
        '适宜': 'text-green-600',
        '不适宜': 'text-red-600',
        '较舒适': 'text-blue-600'
    };
    
    // 渲染每个生活指数项
    lifeHelperData.forEach(item => {
        const lifeHelperItem = document.createElement('div');
        lifeHelperItem.className = 'bg-white p-3 rounded-lg shadow-sm flex flex-col justify-between';
        lifeHelperItem.style.height = '100%';
        lifeHelperItem.title = item.desc;
        
        // 获取对应的图标，默认为问号图标
        const iconClass = lifeHelperIcons[item.title] || 'fa-question-circle';
        
        // 获取对应的颜色类，默认为灰色
        const colorClass = lifeHelperColors[item.value] || 'text-gray-600';
        
        lifeHelperItem.innerHTML = `
            <div class="flex items-center justify-between mb-1">
                <div class="flex items-center">
                    <i class="fa ${iconClass} text-primary w-3 mr-2"></i>
                    <span class="text-sm font-medium text-gray-700">${item.title}</span>
                </div>
                <span class="text-sm font-semibold ${colorClass}">${item.value}</span>
            </div>
            <div class="text-xs text-gray-500 break-all">${item.desc}</div>
        `;
        
        container.appendChild(lifeHelperItem);
    });
}

// 更新24小时天气摘要（天气和风力风向）
function updateHourlyWeatherSummary(hourlyData) {
    const container = document.getElementById('hourly-weather-summary');
    const hourlyWeatherSection = container ? container.closest('[id$="hourly-weather-section"]') || container.closest('.hourly-weather-section') : null;
    
    if (!container || !hourlyData || !Array.isArray(hourlyData) || hourlyData.length === 0) {
        // 隐藏整个24小时天气区域
        if (hourlyWeatherSection) {
            hourlyWeatherSection.style.display = 'none';
        } else if (container) {
            // 如果找不到父区域，则只隐藏当前容器
            container.style.display = 'none';
        }
        return;
    }
    
    // 确保区域可见
    if (hourlyWeatherSection) {
        hourlyWeatherSection.style.display = 'block';
    }
    container.style.display = 'block';
    
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
    // 获取当前小时
    const currentHour = new Date().getHours();
    console.log('当前小时:', currentHour);
    
    hourlyData.forEach((hourData, index) => {
        if (!hourData) return;
        
        console.log(`小时数据 ${index}:`, hourData);
        
        // 简化处理：为当前小时数据添加高亮
        // 获取小时数据中的小时值
        let hourValue = null;
        if (hourData.hour !== undefined) {
            hourValue = parseInt(hourData.hour);
        } else if (hourData.time) {
            const timeStr = String(hourData.time);
            const hourMatch = timeStr.match(/^(\d{1,2})/);
            if (hourMatch) {
                hourValue = parseInt(hourMatch[1]);
            }
        }
        
        // 简单逻辑：高亮当前小时或最接近的小时
        let isCurrentHour = false;
        if (hourValue !== null) {
            // 如果小时完全匹配
            isCurrentHour = hourValue === currentHour;
        } else if (index === 0) {
            // 如果没有小时值，默认高亮第一个
            isCurrentHour = true;
        }
        
        console.log(`小时数据 ${index}, 值: ${hourValue}, 当前小时: ${currentHour}, 是否高亮: ${isCurrentHour}`);
        
        const hourElement = document.createElement('div');
        // 缩小宽度，确保与图表坐标节点一一对应
        const baseClasses = 'inline-flex flex-col items-center justify-center p-1 bg-gray-50 rounded-lg text-center min-w-[70px] max-w-[70px]';
        
        // 应用类名
        if (isCurrentHour) {
            hourElement.className = `${baseClasses} border-2 border-blue-400 bg-blue-50`;
            console.log(`小时 ${index} 已应用当前时段高亮样式`);
        } else {
            hourElement.className = baseClasses;
        }
        
        // 增强的自动滚动功能
        setTimeout(() => {
            if (hourElement && isCurrentHour) { // 只在当前时段时执行滚动
                console.log('自动滚动到当前时段数据');
                
                // 方法2: 找到最近的可滚动容器并滚动 - 作为备选方案
                let parent = hourElement.parentElement;
                let containerFound = false;
                
                while (parent && parent !== document.body && !containerFound) {
                    const isScrollable = parent.scrollWidth > parent.clientWidth || 
                                      parent.scrollHeight > parent.clientHeight;
                    
                    if (isScrollable) {
                        console.log('找到可滚动容器:', parent.tagName);
                        // 计算元素相对于容器的位置
                        const rect = hourElement.getBoundingClientRect();
                        const parentRect = parent.getBoundingClientRect();
                        
                        // 计算滚动偏移，使元素位于容器中心
                        const scrollX = parent.scrollLeft + 
                                      (rect.left - parentRect.left) - 
                                      (parent.clientWidth / 2) + 
                                      (rect.width / 2);
                        
                        // 确保滚动位置有效
                        const maxScroll = parent.scrollWidth - parent.clientWidth;
                        const safeScrollX = Math.max(0, Math.min(scrollX, maxScroll));
                        
                        // 平滑滚动到计算的位置
                        parent.scrollTo({
                            left: safeScrollX,
                            behavior: 'smooth'
                        });
                        containerFound = true;
                    }
                    parent = parent.parentElement;
                }
            }
        }, 500); // 增加延迟，确保所有DOM元素都已渲染完成并添加到页面中
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
        // if (shortWeather.includes('晴')) shortWeather = '晴';
        // else if (shortWeather.includes('多云')) shortWeather = '多云';
        // else if (shortWeather.includes('阴')) shortWeather = '阴';
        // else if (shortWeather.includes('雨')) shortWeather = '雨';
        // else if (shortWeather.includes('雪')) shortWeather = '雪';
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
        temp.textContent = `${hourData.temperature}°C`;
        
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
    const calendarSection = calendarContainer ? calendarContainer.closest('[id$="calendar-section"]') || calendarContainer.closest('.calendar-section') : null;
    
    if (!calendarContainer) {
        logStep('错误: 日历容器元素不存在');
        return;
    }
    
    if (!calendarWeather || !Array.isArray(calendarWeather) || calendarWeather.length === 0) {
        // 隐藏整个日历区域
        if (calendarSection) {
            calendarSection.style.display = 'none';
        } else {
            // 如果找不到父区域，则显示无数据提示
            calendarContainer.innerHTML = '<div class="no-data-message">暂无日历天气数据</div>';
            calendarContainer.style.display = 'block';
        }
        return;
    }
    
    // 确保区域可见
    if (calendarSection) {
        calendarSection.style.display = 'block';
    }
    calendarContainer.style.display = 'block';
    
    // 清空容器
    calendarContainer.innerHTML = '';
    calendarContainer.style.display = 'block';
    
    // 格式化日期函数 - 统一转换为YYYY-MM-DD格式
    function formatDate(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') return null;
        
        try {
            // 处理YYYYMMDD格式
            if (dateStr.length === 8 && /^\d{8}$/.test(dateStr)) {
                const year = dateStr.substring(0, 4);
                const month = dateStr.substring(4, 6);
                const day = dateStr.substring(6, 8);
                return `${year}-${month}-${day}`;
            }
            
            // 尝试直接解析为日期并格式化
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return null;
            
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (e) {
            return null;
        }
    }
    
    // 获取今天的日期（YYYY-MM-DD格式）
    function getTodayFormatted() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
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
    
    // 处理和整理天气数据 - 移除对特定日期的特殊处理
    const processedWeatherData = [];
    const dateToDataMap = new Map(); // 使用日期字符串作为键的映射
    
    // 处理所有天气数据，统一格式并构建映射
    calendarWeather.forEach(day => {
        if (!day || !day.date) return;
        
        const formattedDate = formatDate(day.date);
        if (!formattedDate) return;
        
        // 存储处理后的数据和映射关系
        processedWeatherData.push({
            ...day,
            formattedDate: formattedDate,
            dateObj: new Date(formattedDate)
        });
        
        // 存储到映射中 - 使用格式化后的日期作为唯一键
        dateToDataMap.set(formattedDate, day);
    });
    
    // 按日期排序
    processedWeatherData.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
    
    // 确定要显示的月份 - 从数据中获取第一个有效月份
    let displayYear, displayMonth;
    if (processedWeatherData.length > 0) {
        const firstDate = processedWeatherData[0].dateObj;
        displayYear = firstDate.getFullYear();
        displayMonth = firstDate.getMonth(); // 0-11
    } else {
        // 如果没有数据，使用当前月份
        const now = new Date();
        displayYear = now.getFullYear();
        displayMonth = now.getMonth();
    }
    
    // 计算当月第一天和最后一天
    const firstDateOfMonth = new Date(displayYear, displayMonth, 1);
    const lastDateOfMonth = new Date(displayYear, displayMonth + 1, 0);
    const daysInMonth = lastDateOfMonth.getDate();
    
    // 获取当月第一天是星期几（0=周日，1=周一...）
    const firstDayWeekIndex = firstDateOfMonth.getDay();
    
    // 计算需要填充的前置空白单元格数（以周一为起始）
    let leadingEmptyCells;
    if (firstDayWeekIndex === 0) { // 周日
        leadingEmptyCells = 6; // 前面有6个空白（周一到周六）
    } else { // 周一到周六
        leadingEmptyCells = firstDayWeekIndex - 1; // 前面有相应的空白数
    }
    
    // 计算需要的总行数
    const totalCells = Math.ceil((leadingEmptyCells + daysInMonth) / 7) * 7;
    
    // 获取今天的日期用于高亮
    const todayStr = getTodayFormatted();
    
    // 填充日历网格 - 统一处理所有日期，没有特殊逻辑
    for (let cellIndex = 0; cellIndex < totalCells; cellIndex++) {
        const cell = document.createElement('div');
        cell.className = 'min-h-[100px] p-1 border border-gray-200 rounded';
        
        // 计算当前单元格对应的日期偏移量
        const dateOffset = cellIndex - leadingEmptyCells;
        const isCurrentMonth = dateOffset >= 0 && dateOffset < daysInMonth;
        
        // 判断是否为周末
        const isWeekend = cellIndex % 7 === 5 || cellIndex % 7 === 6;
        
        if (!isCurrentMonth) {
            // 非当月日期，留空
            cell.style.backgroundColor = '#f8f8f8';
        } else {
            // 计算当前日期 - 从当月第一天开始，加上偏移量
            const currentDate = new Date(firstDateOfMonth);
            currentDate.setDate(currentDate.getDate() + dateOffset); // 关键修复：直接使用偏移量设置日期
            
            // 格式化当前日期
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(currentDate.getDate()).padStart(2, '0');
            const formattedCurrentDate = `${year}-${month}-${day}`;
            
            // 获取日期数字
            const dayCount = currentDate.getDate();
            
            // 判断是否为今天
            const isToday = formattedCurrentDate === todayStr;
            
            // 查找对应的天气数据 - 统一使用格式化后的日期查找
            const dayData = dateToDataMap.get(formattedCurrentDate);
            
            // 设置样式
            if (isToday) {
                cell.className = 'min-h-[100px] p-1 border-2 border-blue-400 rounded bg-blue-50';
            } else if (isWeekend) {
                cell.style.backgroundColor = '#e0f2fe'; // 淡蓝色背景
            }
            
            // 日期数字
            const dateNumber = document.createElement('div');
            dateNumber.className = isToday ? 'text-blue-600 font-bold text-sm mb-1' : 'text-gray-700 text-sm mb-1';
            dateNumber.textContent = dayCount;
            cell.appendChild(dateNumber);
            
            if (dayData) {
                // 显示天气信息
                let shortWeather = dayData.weather || '--';
                if (shortWeather.length > 2 && shortWeather.includes('转')) {
                    shortWeather = shortWeather.split('转')[0];
                }
                
                // 天气图标
                const icon = document.createElement('div');
                icon.className = 'text-xl my-1 text-center';
                let iconText = '☁️';
                if (shortWeather.includes('雨')) iconText = '🌧️';
                else if (shortWeather.includes('阴')) iconText = '☁️';
                else if (shortWeather.includes('多云')) iconText = '⛅';
                else if (shortWeather.includes('雪')) iconText = '❄️';
                else if (shortWeather.includes('晴')) iconText = '☀️';
                else if (shortWeather.includes('雷')) iconText = '⚡';
                icon.textContent = iconText;
                cell.appendChild(icon);
                
                // 天气状况
                const weatherElement = document.createElement('div');
                weatherElement.className = 'text-xs text-gray-600 mb-1 text-center truncate';
                weatherElement.textContent = shortWeather;
                cell.appendChild(weatherElement);

                // 风力
                if (dayData.wind) {
                    const windElement = document.createElement('div');
                    windElement.className = 'text-xs text-gray-600 mb-1 text-center truncate';
                    windElement.textContent = dayData.wind || '--';
                    cell.appendChild(windElement);
                }
                
                // 温度范围
                const tempRange = document.createElement('div');
                tempRange.className = 'text-xs';
                const maxTemp = dayData.tempMax || dayData.realTempMax || '--';
                const minTemp = dayData.tempMin || dayData.realTempMin || '--';
                tempRange.innerHTML = `<span class="text-gray-700">${minTemp}</span> / <span class="text-gray-900">${maxTemp}°C</span>`;
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
    const chartContainer = document.getElementById('24hour-chart-container') || (canvas ? canvas.closest('.chart-container') : null);
    
    if (!canvas || !hourlyData || !Array.isArray(hourlyData) || hourlyData.length === 0) {
        logStep('错误: 图表容器或数据无效');
        // 隐藏图表容器
        if (chartContainer) {
            chartContainer.style.display = 'none';
        } else if (canvas) {
            canvas.style.display = 'none';
        }
        return;
    }
    
    // 确保图表容器可见
    if (chartContainer) {
        chartContainer.style.display = 'block';
    } else if (canvas) {
        canvas.style.display = 'block';
    }
    
    // 检查是否已加载Chart.js
    if (typeof Chart === 'undefined') {
        logStep('错误: Chart.js未加载');
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
    
    logStep(`24小时图表纵坐标区间: ${minY}°C - ${maxY}°C`);
    
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
                            // 获取当前数据点的索引
                            const index = context.dataIndex;
                            // 获取对应的小时数据
                            const hourData = hourlyData[index];
                            
                            // 基础温度信息
                            let tooltipContent = `${context.parsed.y || '--'}°C`;
                            
                            // 添加天气状况信息
                            if (hourData && hourData.weather) {
                                tooltipContent += `\t${hourData.weather.trim()}`;
                            }
                            
                            // 添加风力风向信息
                            if (hourData) {
                                tooltipContent += `\t${hourData.wind.trim()}`;
                            }
                            
                            return tooltipContent;
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
    const chartContainer = document.getElementById('weather-trend-chart-container') || (canvas ? canvas.closest('.chart-container') : null);
    const trendSection = chartContainer ? chartContainer.closest('[id$="trend-section"]') || chartContainer.closest('.trend-section') : null;
    
    if (!canvas || !dailyData || !Array.isArray(dailyData) || dailyData.length === 0) {
        logStep('错误: 图表容器或数据无效');
        // 隐藏整个趋势图区域
        if (trendSection) {
            trendSection.style.display = 'none';
        } else if (chartContainer) {
            chartContainer.style.display = 'none';
        } else if (canvas) {
            canvas.style.display = 'none';
        }
        return;
    }
    
    // 确保区域可见
    if (trendSection) {
        trendSection.style.display = 'block';
    } else if (chartContainer) {
        chartContainer.style.display = 'block';
    } else if (canvas) {
        canvas.style.display = 'block';
    }
    
    // 检查是否已加载Chart.js
    if (typeof Chart === 'undefined') {
        logStep('错误: Chart.js未加载');
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
    
    logStep(`固定纵坐标区间: ${minY}°C - ${maxY}°C`);
    
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

// 更新近几日天气横向表格（无表头，优化宽度）
function updateRecentDaysWeather(recentDaysWeather) {
    const container = document.getElementById('recent-days-weather');
    const recentDaysSection = container ? container.closest('[id$="recent-days-section"]') || container.closest('.recent-days-section') : null;
    
    if (!container) {
        logStep('错误: 近日天气容器元素不存在');
        return;
    }
    
    if (!recentDaysWeather || !Array.isArray(recentDaysWeather) || recentDaysWeather.length === 0) {
        // 隐藏整个区域
        if (recentDaysSection) {
            recentDaysSection.style.display = 'none';
        } else {
            container.innerHTML = '<div class="no-data-message text-center text-sm text-gray-500 py-2">暂无近日天气数据</div>';
            container.style.display = 'block';
        }
        return;
    }
    
    // 确保区域可见
    if (recentDaysSection) {
        recentDaysSection.style.display = 'block';
    }
    container.style.display = 'block';
    
    // 创建横向表格容器
    const tableContainer = document.createElement('div');
    tableContainer.className = 'overflow-x-auto scrollbar-thin';
    
    // 创建表格 - 优化宽度
    const table = document.createElement('table');
    table.className = 'min-w-full border-collapse';
    
    // 创建表体 - 直接创建表体，不使用表头
    const tbody = document.createElement('tbody');
    
    // 获取今天的月和日，用于匹配
    const today = new Date();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const currentDay = String(today.getDate()).padStart(2, '0');
    const todayMonthDay = currentMonth + currentDay;
    
    console.log('今日月日:', todayMonthDay);
    
    // 添加每日天气数据行 - 优化宽度
    recentDaysWeather.forEach((dayData, index) => {
        const row = document.createElement('tr');
        
            // 直接高亮第一行作为今日数据
        const isToday = index === 0;
        
        // 强制应用样式和类名
        if (isToday) {
            row.className = 'border-2 border-blue-400 rounded bg-blue-50';
            console.log(`第${index+1}行天气数据已应用今日高亮样式`);
        } else {
            row.className = 'hover:bg-gray-50';
            console.log(`第${index+1}行天气数据为非今日`);
        }
        
        // 格式化日期 - 简化显示
        let dateStr = dayData.date || '';
        if (dateStr.length === 8) {
            const month = dateStr.substring(4, 6).replace(/^0/, '');
            const day = dateStr.substring(6, 8).replace(/^0/, '');
            dateStr = `${month}/${day}`;
        }
        
        // 创建单元格数据
        const dataCells = [
            dateStr,
            dayData.weather || '--',
            `${dayData.tempMin || '--'} / ${dayData.tempMax || '--'}°C`,
            // 简化风向风力显示
            dayData.wind || '--'
        ];
        
        // 添加单元格 - 优化宽度和样式
        dataCells.forEach((cellData, index) => {
            const td = document.createElement('td');
            // 最小化内边距，缩减表格宽度
            td.className = 'px-1 py-1 text-xs text-gray-800 whitespace-nowrap';
            
            // 为天气列添加图标
            if (index === 1) {
                let iconText = '☀️';
                const weather = cellData || '';
                if (weather.includes('雨')) iconText = '🌧️';
                else if (weather.includes('云')) iconText = '☁️';
                else if (weather.includes('阴')) iconText = '☁️';
                else if (weather.includes('雪')) iconText = '❄️';
                // 只显示图标，不显示文字以节省空间，并添加悬停提示
                td.title = weather; // 添加title属性显示详细天气信息
                td.innerHTML = `${iconText}`;
            } else {
                td.textContent = cellData;
            }
            
            row.appendChild(td);
        });
        
        tbody.appendChild(row);
    });
    
    // 组装表格 - 不添加表头
    table.appendChild(tbody);
    tableContainer.appendChild(table);
    
    // 清空容器并添加表格（标题已在HTML中添加）
    container.innerHTML = '';
    container.appendChild(tableContainer);
}

// 更新天气显示
function updateWeatherDisplay(weatherData) {
    logStep(`开始更新天气显示: ${JSON.stringify(weatherData).substring(0, 80)}...`);
    
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
        
        // 更新天气网站链接
        updateWeatherLinks(weatherData.mojiAreaCode, weatherData.weatherCode);
        
        // 提取必要的数据部分
        const { todayWeather, calendarWeather, hourlyForecast, hourlyWeather, recentDaysWeather } = weatherData;
        
        // 增强todayData数据提取逻辑
        let todayData = null;
        if (todayWeather) {
            // 深拷贝以避免修改原始数据
            todayData = JSON.parse(JSON.stringify(todayWeather));
            logStep(`使用todayWeather: ${JSON.stringify(todayData).substring(0, 60)}...`);
        }
        
        // 强制更新今日天气，作为核心数据，如果没有数据则显示错误信息
        if (todayData && (todayData.temperature || todayData.weather)) {
            updateTodayWeather(todayData);
        } else {
            logStep('错误: 没有找到有效的今日天气数据');
            // 今日天气作为核心数据，如果没有数据，显示错误信息
            showWeatherError('无法获取今日天气数据，请稍后重试');
            return; // 不再继续处理其他数据
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
        
        logStep(`使用的24小时数据: ${JSON.stringify(hourlyData).substring(0, 80)}...`);
        
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
                window._weather24HourChart = null;
            }
            const chartContainer = document.getElementById('24hour-chart-container');
            if (chartContainer) {
                chartContainer.innerHTML = '<div class="text-center text-gray-500 py-10">暂无24小时温度数据</div>';
            }
        }
        
        // 更新近日天气横向表格
        if (recentDaysWeather) {
            updateRecentDaysWeather(recentDaysWeather);
        }
        
        // 更新天气日历（整个月的网格形式）
        if (calendarWeather) {
            updateCalendarWeather(calendarWeather);
        }
        
        // 绘制天气趋势图表（确保显示历史温度）
        if (calendarWeather) {
            drawWeatherTrendChart(calendarWeather);
        }
        
        logStep('天气显示更新完成');
    } catch (error) {
        logStep(`错误: 更新天气显示时出错: ${error}`);
        showWeatherError('天气数据处理错误，请稍后重试');
    }
}

// 页面加载完成后初始化
logStep('页面脚本加载完成，准备初始化');
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWeatherPage);
} else {
    // 页面已经加载完成，直接初始化
    initWeatherPage();
}

logStep('脚本执行完毕');