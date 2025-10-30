// 自动定位地址和省市县选框勾选处理模块

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
    mojiCodeMap: {}, // 用于存储墨迹天气编码
    isMatchingLocation: false, // 用于防止重复触发位置匹配
    matchingPromise: null // 存储位置匹配的Promise
};

// 初始化映射对象
function initializeMaps() {
    dataCache.provinceMap = dataCache.provinceMap || {};
    dataCache.cityMap = dataCache.cityMap || {};
    dataCache.districtMap = dataCache.districtMap || {};
    dataCache.mojiCodeMap = dataCache.mojiCodeMap || {};
    dataCache.fullDistrictMap = dataCache.fullDistrictMap || {};
}

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

    // logStep(`准备渲染数据，共有 ${filteredData.length} 个选项`);

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

function selectOptionByValueOrText(selectElement, targetValue, targetText = '') {
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

    logStep(`警告: 未找到匹配选项: ${targetValue || cleanTargetText}`);
    return false;
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
        // logStep('重新定位按钮事件监听器添加完成');
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
        // logStep('省份选择框事件监听器添加完成');
    }

    if (citySelect && !citySelect.hasAttribute('data-event-added')) {
        citySelect.setAttribute('data-event-added', 'true');
        citySelect.addEventListener('change', handleCityChange);
        // logStep('城市选择框事件监听器添加完成');
    }

    if (districtSelect && !districtSelect.hasAttribute('data-event-added')) {
        districtSelect.setAttribute('data-event-added', 'true');
        districtSelect.addEventListener('change', handleDistrictChange);
        // logStep('区县选择框事件监听器添加完成');
    }

    // logStep('所有必要的事件监听器添加完成');
}

// 省份选择变化处理 - 优化数据联动渲染
function handleProvinceChange() {
    // logStep('省份选择变化处理');
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
    // logStep(`当前fullAreaData长度: ${dataCache.fullAreaData ? dataCache.fullAreaData.length : 'null'}`);

    // 先尝试通过name查找，因为省份对象可能没有code属性
    let selectedProvince = dataCache.fullAreaData.find(p => p.name === selectedProvinceCode);
    if (!selectedProvince) {
        logStep(`通过名称未找到省份，尝试通过code查找`);
        // 如果通过name没有找到，尝试通过code查找
        selectedProvince = dataCache.fullAreaData.find(p => p.code === selectedProvinceCode);
    }

    logStep(`找到省份: ${selectedProvince ? selectedProvince.name : '未找到'}`);
    if (selectedProvince) {
        logStep(`省份children状态: ${selectedProvince.children ? '有' : '无'} | 数组: ${Array.isArray(selectedProvince.children) ? '是' : '否'} | 数量: ${Array.isArray(selectedProvince.children) ? selectedProvince.children.length : '未知'}`);
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
        logStep(`未找到对应省份的城市数据或数据格式不正确 | selectedProvince: ${selectedProvince ? '存在' : '不存在'} | children: ${selectedProvince && selectedProvince.children ? '存在' : '不存在'} | children是数组: ${selectedProvince && Array.isArray(selectedProvince.children) ? '是' : '否'}`);
    }
}

// 城市选择变化处理 - 优化数据联动渲染
function handleCityChange() {
    // logStep('城市选择变化');
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
    // logStep('区县选择变化（用户手动选择）');
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

// 获取位置数据 - 统一的位置数据获取函数
async function getLocationData() {
    logStep('发送请求获取位置信息');
    const response = await fetch(WEATHER_API.IP_API, { cache: 'no-store' });

    if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
    }

    const responseData = await response.json();

    // 适配新的数据结构，位置数据在data字段中
    const locationData = responseData.data || {};

    // 确保获取到的基本位置数据格式正确
    if (!locationData.province || !locationData.district) {
        throw new Error('获取的位置数据格式不正确');
    }

    // 如果city为空，设置为空字符串以兼容现有代码
    if (!locationData.city) {
        locationData.city = '';
    }

    return { locationData, weatherAreaCodes: responseData.weatherAreaCodes?.data };
}

// 统一的IP定位函数 - 合并了quickRelocateByIp和locateCityByIp的功能
async function relocateByIp(forceReloadAreaData = false) {
    // 防止重复触发定位
    if (dataCache.loading) {
        logStep('定位正在进行中，取消重复触发');
        return dataCache.loadingPromise;
    }

    updateCityDisplay({ name: '正在定位...', code: '...' });

    dataCache.loading = true;

    try {
        // 获取位置数据
        const { locationData, weatherAreaCodes } = await getLocationData();
        logStep(`提取到的位置信息: 省份=${locationData.province}, 城市=${locationData.city}, 区县=${locationData.district}`);

        // 标记这是IP定位的结果
        dataCache.lastLocationSource = 'ip';

        // 如果有weatherCode，直接尝试加载天气数据
        if (locationData.weatherCode) {
            logStep('IP定位已获取weatherCode，优先加载天气数据');
            loadWeatherData(locationData.weatherCode, locationData.mojiAreaCode);
        }

        // 处理区域数据
        if (forceReloadAreaData || !dataCache.fullAreaData) {
            // 如果需要重新加载或数据不存在，使用processLocationSuccess处理
            await processLocationData(locationData, weatherAreaCodes);
        } else {
            // 否则直接使用现有数据进行匹配
            logStep('使用现有省市县数据进行位置匹配');
            updateLocationUI(locationData);
        }

        return locationData;
    } catch (error) {
        logStep(`IP定位失败: ${error.message}`);

        // 定位失败的处理
        if (forceReloadAreaData) {
            // 初始定位失败，切换到手动选择
            switchToManualSelection();
        } else {
            // 快速重新定位失败，显示错误但保留现有数据
            updateCityDisplay({
                name: '定位失败，请重试',
                code: '定位错误'
            });
        }
    } finally {
        dataCache.loading = false;
    }
}

// 快速IP定位 - 使用统一的定位函数，不重新加载区域数据
async function quickRelocateByIp() {
    logStep('快速IP定位开始 - 保留现有选框数据');
    return relocateByIp(false);
}

// 通过IP定位城市 - 使用统一的定位函数，初始定位时重新加载区域数据
async function locateCityByIp() {
    logStep('初始IP定位开始 - 可能重新加载区域数据');
    return relocateByIp(true);
}

// 处理位置数据和区域数据
async function processLocationData(locationData, weatherAreaCodes) {
    // 验证locationData参数的有效性
    if (!locationData || typeof locationData !== 'object') {
        throw new Error('无效的位置数据');
    }

    // 标记这是IP定位的结果
    dataCache.lastLocationSource = 'ip';

    // 处理省市县数据加载和渲染
    if (weatherAreaCodes && Array.isArray(weatherAreaCodes) && weatherAreaCodes.length > 0) {
        // 直接使用API返回的省市县数据
        dataCache.fullAreaData = weatherAreaCodes;

        // 构建查找映射
        try {
            buildAreaMaps(weatherAreaCodes);
        } catch (error) {
            logStep(`构建区域映射失败: ${error.message}`);
        }

        // 渲染省份选择框
        try {
            renderProvinceSelect(weatherAreaCodes);
        } catch (error) {
            logStep(`渲染省份选择框失败: ${error.message}`);
        }

        // 更新UI并匹配选框
        await updateLocationUI(locationData);
    } else {
        // 如果IP定位接口未返回完整省市县数据或数据无效，调用loadAreaCodes获取数据
        await loadAreaCodes().then(() => {
            // 数据加载完成后更新UI并匹配选框
            updateLocationUI(locationData);
        }).catch(error => {
            logStep(`加载区域数据失败: ${error.message}`);
            // 即使加载区域数据失败，如果有weatherCode也保持天气数据显示
            if (!locationData.weatherCode) {
                throw error;
            }
        });
    }

    return locationData;
}

// 处理位置数据获取成功的情况 - 向后兼容，内部使用新的processLocationData
function processLocationSuccess(locationData, weatherAreaCodes) {
    return processLocationData(locationData, weatherAreaCodes)
        .catch(error => {
            logStep(`处理位置数据失败: ${error.message}`);
            switchToManualSelection();
        });
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
async function updateLocationUI(location) {
    // 验证location参数的有效性
    if (!location || typeof location !== 'object') {
        updateCityDisplay({
            name: '定位数据错误',
            code: '数据无效'
        });
        return null;
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
        return null;
    }

    // 更新城市显示
    logStep(`更新城市显示为: ${fullCityName}`);
    updateCityDisplay({
        name: fullCityName,
        code: weatherCode || '加载中...'
    });

    // 使用Promise封装匹配过程，避免重复触发
    if (dataCache.isMatchingLocation) {
        logStep('位置匹配已在进行中，等待完成');
        return dataCache.matchingPromise;
    }

    dataCache.isMatchingLocation = true;

    // 创建匹配Promise
    dataCache.matchingPromise = new Promise(async (resolve) => {
        try {
            // 数据已加载时直接匹配
            if (dataCache.fullAreaData) {
                logStep('省市县数据已加载，准备匹配定位结果到选择框');
                await attemptMatchLocation(province, city, district, location, weatherCode);
            }
            // 数据未加载时先加载再匹配
            else if (!dataCache.loading) {
                logStep('省市县数据尚未加载，需要先加载数据');
                try {
                    await loadAreaCodes();
                    logStep('省市县数据加载完成，准备匹配定位结果');
                    await attemptMatchLocation(province, city, district, location, weatherCode);
                } catch (error) {
                    logStep(`加载省市县数据失败: ${error.message || error}`);
                    // 即使加载失败，如果有weatherCode也保持天气数据显示
                    if (!weatherCode) {
                        updateCityDisplay({
                            name: fullCityName + ' (请手动选择确认)',
                            code: '数据加载失败'
                        });
                    }
                }
            }
            // 数据正在加载中，等待加载完成
            else {
                logStep('省市县数据正在加载中，等待加载完成后自动匹配');
                // 等待加载完成后再尝试匹配
                const loadingPromise = dataCache.loadingPromise;
                if (loadingPromise) {
                    await loadingPromise;
                    if (dataCache.fullAreaData) {
                        await attemptMatchLocation(province, city, district, location, weatherCode);
                    }
                }
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

            resolve(fullCityName);
        } finally {
            // 清理匹配状态
            dataCache.isMatchingLocation = false;
            dataCache.matchingPromise = null;
        }
    });

    return dataCache.matchingPromise;
}

// 使用Promise封装的位置匹配函数
async function attemptMatchLocation(province, city, district, locationData, weatherCode) {
    let attempts = 0;
    const maxAttempts = 3;
    const initialDelay = 500;

    while (attempts < maxAttempts) {
        attempts++;

        // 确保DOM元素存在
        const provinceSelect = document.getElementById('province-select');
        if (!provinceSelect || !provinceSelect.options || provinceSelect.options.length <= 1) {
            if (attempts < maxAttempts) {
                const delay = initialDelay * (Math.pow(1.5, attempts - 1));
                logStep(`选择框尚未完全加载，第${attempts}次尝试失败，${delay}ms后重试`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            } else {
                logStep(`已达到最大重试次数(${maxAttempts})，放弃自动匹配`);
                // 显示手动选择提示
                if (!weatherCode) {
                    updateCityDisplay({
                        name: `${province}${city || ''}${district || ''} (请手动选择确认)`,
                        code: '自动匹配失败'
                    });
                }
                return false;
            }
        }

        // 执行匹配
        try {
            logStep(`执行位置匹配，第${attempts}次尝试`);
            matchLocationSelect(province, city, district, dataCache.lastLocationSource === 'ip', locationData);
            logStep('匹配定位结果到选择框成功');
            return true;
        } catch (error) {
            logStep(`匹配定位结果到选择框失败: ${error.message || error}`);
            if (attempts < maxAttempts) {
                const delay = initialDelay * (Math.pow(1.5, attempts - 1));
                logStep(`第${attempts}次匹配失败，${delay}ms后重试`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                // 最终匹配失败
                logStep(`已达到最大重试次数，匹配失败且无weatherCode，显示手动选择提示`);
                if (!weatherCode) {
                    updateCityDisplay({
                        name: `${province}${city || ''}${district || ''} (定位结果仅供参考)`,
                        code: '请手动选择确认'
                    });
                }
                return false;
            }
        }
    }

    return false;
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
async function handleIpLocationWithFullData(cleanProvince, cleanCity, cleanDistrict) {
    const { provinceSelect, citySelect, districtSelect } = validateSelectElements() || {};
    if (!provinceSelect || !citySelect || !districtSelect) {
        throw new Error('缺少必要的选择框元素');
    }

    // 1. 选择省份
    const provinceSelected = await (async () => {
        for (let i = 0; i < provinceSelect.options.length; i++) {
            const option = provinceSelect.options[i];
            if (option.text === cleanProvince ||
                option.text.includes(cleanProvince) ||
                option.text.replace(/省$/, '') === cleanProvince) {
                provinceSelect.selectedIndex = i;
                provinceSelect.dispatchEvent(new Event('change', { bubbles: true }));
                handleProvinceChange();
                logStep(`IP定位: 成功选择省份: ${cleanProvince}`);
                return true;
            }
        }
        return false;
    })();

    if (!provinceSelected) {
        throw new Error(`未找到匹配的省份: ${cleanProvince}`);
    }

    // 等待城市选择框更新
    await new Promise(resolve => setTimeout(resolve, 500));

    // 2. 选择城市
    const citySelected = await (async () => {
        for (let i = 0; i < citySelect.options.length; i++) {
            const option = citySelect.options[i];
            if (option.text === cleanCity ||
                option.text.includes(cleanCity) ||
                option.text.replace(/市$/, '') === cleanCity) {
                citySelect.selectedIndex = i;
                citySelect.dispatchEvent(new Event('change', { bubbles: true }));
                handleCityChange();
                logStep(`IP定位: 成功选择城市: ${cleanCity}`);
                return true;
            }
        }
        return false;
    })();

    if (!citySelected) {
        throw new Error(`未找到匹配的城市: ${cleanCity}`);
    }

    // 等待区县选择框更新
    await new Promise(resolve => setTimeout(resolve, 800));

    // 3. 选择区县
    const districtSelected = await (async () => {
        for (let i = 0; i < districtSelect.options.length; i++) {
            const option = districtSelect.options[i];
            if (option.text === cleanDistrict ||
                option.text.includes(cleanDistrict) ||
                option.text.replace(/[区县]$/, '') === cleanDistrict) {
                districtSelect.selectedIndex = i;
                districtSelect.dispatchEvent(new Event('change', { bubbles: true }));
                logStep(`IP定位: 成功选择区县: ${cleanDistrict}`);
                return true;
            }
        }
        return false;
    })();

    if (!districtSelected) {
        throw new Error(`未找到匹配的区县: ${cleanDistrict}`);
    }

    return true;
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

// 状态锁，防止matchLocationSelect函数并发执行
let isMatchingLocation = false;

// 辅助函数：查找并选择位置选项
function selectLocationOption(selectElement, optionsList, targetName) {
    if (!selectElement || !optionsList || !targetName) {
        return null;
    }

    // 多种匹配方式，优先级排序
    const matchFunctions = [
        () => findExactMatch(optionsList, 'name', targetName),
        () => findExactMatch(optionsList, 'short_name', targetName),
        () => findSimilarMatch(optionsList, 'name', targetName),
        () => findSimilarMatch(optionsList, 'short_name', targetName)
    ];

    for (const matchFn of matchFunctions) {
        const matchedOption = matchFn();
        if (matchedOption) {
            // 直接设置值，不触发change事件
            if (selectElement.value !== matchedOption.code) {
                selectElement.value = matchedOption.code;
            }
            return matchedOption;
        }
    }

    return null;
}

// 主函数：匹配位置选择框 - 优化版本
async function matchLocationSelect(province, city, district, isIpLocation = false, locationData = null) {
    // 防止并发执行
    if (isMatchingLocation) {
        logStep('警告: 位置匹配正在进行中，忽略重复调用');
        return false;
    }

    try {
        logStep(`开始匹配位置选择框: 省份=${province}, 城市=${city}, 区县=${district}, 是否IP定位=${isIpLocation}`);

        // 设置状态锁
        isMatchingLocation = true;

        // 健壮性检查
        if (!province) {
            logStep('匹配失败: 缺少必要的省份参数');
            return false;
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
            return false;
        }

        const { provinceSelect, citySelect, districtSelect } = selectElements;
        const { cleanProvince, cleanCity, cleanDistrict } = cleanLocationNames(province, city, district);

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
        await ensureAreaDataLoaded();

        // 处理IP定位场景
        if (isIpLocation) {
            return await handleIpLocationMatching(province, cleanProvince, cleanCity, cleanDistrict, locationData);
        }

        // 常规匹配流程
        return await processRegularMatching(province, cleanProvince, cleanCity, cleanDistrict, isIpLocation, locationData, provinceSelect, citySelect, districtSelect);
    } catch (error) {
        logStep(`匹配过程中出错: ${error.message || error}`);
        // 错误情况下的兜底策略
        handleMatchingError(province, city, district, isIpLocation, locationData);
        return false;
    } finally {
        // 确保状态锁总是被释放
        isMatchingLocation = false;
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

// 处理IP定位匹配 - 重构为Promise形式
async function handleIpLocationMatching(province, cleanProvince, cleanCity, cleanDistrict, locationData) {
    try {
        logStep('处理IP定位场景');

        // 情况1：完整的三级数据
        if (cleanProvince && cleanCity && cleanDistrict) {
            try {
                await handleIpLocationWithFullData(cleanProvince, cleanCity, cleanDistrict);
                return true;
            } catch (error) {
                logStep(`IP定位完整数据匹配失败: ${error.message || error}`);
                // 如果匹配失败，尝试使用weatherCode直接加载
                if (locationData && locationData.weatherCode) {
                    loadWeatherData(locationData.weatherCode, locationData.mojiAreaCode);
                    updateCityDisplay({
                        name: `${province}${cleanCity}${cleanDistrict}`,
                        code: locationData.weatherCode
                    });
                    return true;
                }
            }
        }
        // 情况2：只有省份和区县
        else if (cleanProvince && cleanDistrict && !cleanCity) {
            if (handleIpLocationWithProvinceAndDistrict(province, cleanProvince, cleanDistrict, locationData)) {
                return true;
            }
        }
        // 情况3：只有省份信息
        else if (cleanProvince && !cleanCity && !cleanDistrict) {
            if (handleIpLocationWithProvinceOnly(province, locationData)) {
                return true;
            }
        }

        // 执行兜底策略
        logStep('IP定位数据处理失败，执行兜底策略');
        return handleIpFallback(locationData);
    } catch (error) {
        logStep(`处理IP定位时出错: ${error.message || error}`);
        return handleIpFallback(locationData);
    }
}

// 处理常规匹配流程 - 优化版本（无递归，防事件循环）
async function processRegularMatching(province, cleanProvince, cleanCity, cleanDistrict, isIpLocation, locationData, provinceSelect, citySelect, districtSelect) {
    try {
        // 查找省份代码
        let selectedProvinceCode = findProvinceCode(cleanProvince);
        let selectedProvince = null;

        // 如果未找到匹配的省份，选择第一个省份
        if (!selectedProvinceCode && dataCache.fullAreaData && Array.isArray(dataCache.fullAreaData) && dataCache.fullAreaData.length > 0) {
            const firstProvince = dataCache.fullAreaData[0];
            if (firstProvince) {
                selectedProvinceCode = firstProvince.code || '';
                selectedProvince = firstProvince;
                logStep(`未找到匹配省份，选择第一个省份: ${firstProvince.name}, ${selectedProvinceCode}`);
            }
        }

        if (!selectedProvinceCode) {
            logStep(`未找到匹配的省份，且无法选择默认省份: ${cleanProvince}`);
            return false;
        }

        // 直接设置省份选择框的值，不触发事件
        if (provinceSelect.value !== selectedProvinceCode) {
            provinceSelect.value = selectedProvinceCode;
            logStep(`已选择省份: ${selectedProvinceCode}`);
        }

        // 手动填充城市数据，不通过事件处理
        const cities = getCitiesByProvinceCode(selectedProvinceCode);
        if (cities && cities.length > 0) {
            fillSelectOptions(citySelect, cities, '请选择城市');
            citySelect.disabled = false;

            let selectedCityCode = null;
            let selectedCity = null;

            // 查找并选择城市
            if (cleanCity) {
                selectedCity = selectLocationOption(citySelect, cities, cleanCity);
                if (selectedCity) {
                    selectedCityCode = selectedCity.code;
                    logStep(`已选择城市: ${selectedCity.name}, 代码: ${selectedCityCode}`);

                    // 手动填充区县数据
                    const districts = getDistrictsByCityCode(selectedCityCode);
                    if (districts && districts.length > 0) {
                        fillSelectOptions(districtSelect, districts, '请选择区县');
                        districtSelect.disabled = false;

                        let selectedDistrictCode = null;

                        // 查找并选择区县
                        if (cleanDistrict) {
                            const selectedDistrict = selectLocationOption(districtSelect, districts, cleanDistrict);
                            if (selectedDistrict) {
                                selectedDistrictCode = selectedDistrict.code;
                                logStep(`已选择区县: ${selectedDistrict.name}, 代码: ${selectedDistrictCode}`);

                                // 处理IP定位特殊情况
                                if (isIpLocation && locationData && locationData.weatherCode) {
                                    selectedDistrictCode = locationData.weatherCode;
                                    dataCache.selectedDistrict = {
                                        code: locationData.weatherCode,
                                        mojiCode: locationData.mojiAreaCode || ''
                                    };
                                }

                                // 加载天气数据
                                const weatherCode = isIpLocation && locationData && locationData.weatherCode ?
                                    locationData.weatherCode : selectedDistrictCode;
                                const mojiAreaCode = isIpLocation && locationData ?
                                    locationData.mojiAreaCode :
                                    (dataCache.selectedDistrict?.mojiCode || '');

                                try {
                                    await loadWeatherData(weatherCode, mojiAreaCode);
                                    logStep(`天气数据加载完成: ${weatherCode}`);
                                } catch (weatherError) {
                                    logStep(`天气数据加载失败: ${weatherError.message || weatherError}`);
                                }

                                return true;
                            }
                        }
                    }
                }
            }
        } else {
            logStep(`警告: 未找到省份 ${selectedProvinceCode} 的城市数据`);
            // 避免递归，直接返回false
            return false;
        }
    } catch (error) {
        logStep(`处理常规匹配时出错: ${error.message || error}`);
        return false;
    }

    return false;
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

// 注册全局事件监听器函数到window对象
window.addEventListeners4Weather = addEventListeners;
