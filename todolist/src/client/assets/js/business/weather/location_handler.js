/**
 * 天气应用位置处理模块 (重构版)
 * * 包含三个核心对象:
 * 1. LocationDataManager: 负责所有数据的获取、缓存和处理 (模型)
 * 2. LocationSelectUI: 负责所有DOM渲染和UI交互 (视图)
 * 3. LocationController: 负责协调数据和UI，处理业务逻辑 (控制器)
 *
 * 假设全局已定义:
 * - logStep(message)
 * - WEATHER_API (Object)
 * - loadWeatherData(code, mojiCode)
 */

(function (window) {
    'use strict';

    // -------------------------------------------------------------------------
    // 模块一: LocationDataManager (数据管理器)
    // 职责: 负责所有数据的获取、缓存和处理。
    // -------------------------------------------------------------------------
    const LocationDataManager = {
        _logPrefix: '[DataManager]',
        _log: (msg) => logStep(`%c${LocationDataManager._logPrefix} %c${msg}`, 'color: #0000FF;', 'color: unset;'),

        dataCache: {
            fullAreaData: null,
            loading: false,
            loadingPromise: null,
            lastLocationSource: null,
            provinceMap: {},
            cityMap: {},
            districtMap: {},
            fullDistrictMap: {},
            mojiCodeMap: {},
        },

        /**
         * 初始化所有数据映射表
         */
        _initializeMaps: function () {
            this.dataCache.provinceMap = {};
            this.dataCache.cityMap = {};
            this.dataCache.districtMap = {};
            this.dataCache.mojiCodeMap = {};
            this.dataCache.fullDistrictMap = {};
        },

        /**
         * [内部] 从API响应中提取区域数据
         */
        _extractAreaData: function (result) {
            if (result && Array.isArray(result.data) && result.data.length > 0) {
                this._log('使用直接格式的区域数据');
                return result.data;
            } else {
                throw new Error('API返回的数据格式不正确，无法提取省份数据');
            }
        },

        /**
         * [内部] 处理区域代码加载错误
         */
        _handleAreaCodeError: function (error, reject) {
            this._log(`加载省市县数据失败: ${error.message}`);
            // 注意: UI相关的错误处理应移至UIManager或Controller
            reject(error);
        },

        /**
         * [内部] 构建所有区域的查找映射表
         */
        _buildAreaMaps: function (areaData) {
            this._log('开始构建区域查找映射表');
            this._initializeMaps();

            if (!areaData || !Array.isArray(areaData) || areaData.length === 0) {
                this._log('警告: 无效的区域数据，无法构建映射表');
                return;
            }

            try {
                areaData.forEach(province => this._processProvinceData(province));
                this._logBuildStats();
            } catch (error) {
                this._log(`构建区域映射时发生错误: ${error.message || error}`);
            }
        },

        _processProvinceData: function (province) {
            if (!province || typeof province !== 'object' || !province.name) return;

            const provinceName = this._normalizeProvinceName(province.name);
            this.dataCache.provinceMap[provinceName] = province.code || '';

            if (province.children && Array.isArray(province.children)) {
                province.children.forEach(city => this._processCityData(city, provinceName, province));
            }
        },

        _processCityData: function (city, provinceName, province) {
            if (!city || typeof city !== 'object' || !city.name) return;

            const cityName = this._normalizeCityName(city.name);
            this.dataCache.cityMap[provinceName + '_' + cityName] = city.code || '';

            if (city.children && Array.isArray(city.children)) {
                city.children.forEach(district => this._processDistrictData(district, provinceName, cityName, province, city));
            }
        },

        _processDistrictData: function (district, provinceName, cityName, province, city) {
            if (!district || typeof district !== 'object' || !district.name || !district.code) return;

            const districtName = this._normalizeDistrictName(district.name);
            const mapKey = provinceName + '_' + cityName + '_' + districtName;
            this.dataCache.districtMap[mapKey] = district.code;

            // 存储完整区县信息映射
            const districtMapKey = provinceName + '_' + districtName;
            this.dataCache.fullDistrictMap[districtMapKey] = {
                code: district.code,
                mojiCode: district.mojiCode || '',
                provinceMojiCode: province.mojiCode || '',
                cityName: city.name || '',
                districtName: district.name || '',
                fullName: `${province.name || ''}${city.name || ''}${district.name || ''}`
            };

            // 存储墨迹天气编码映射
            if (district.mojiCode) {
                if (province.mojiCode && typeof province.mojiCode === 'string' && typeof district.mojiCode === 'string') {
                    this.dataCache.mojiCodeMap[district.code] = `${province.mojiCode}/${district.mojiCode}`;
                } else {
                    this.dataCache.mojiCodeMap[district.code] = String(district.mojiCode);
                }
            } else if (district.code) {
                this.dataCache.mojiCodeMap[district.code] = this.dataCache.mojiCodeMap[district.code] || '';
            }
            if (district.name) {
                this.dataCache.mojiCodeMap[district.name] = district.code;
            }
        },

        _normalizeProvinceName: (name) => String(name || '').replace(/省$/, '').trim(),
        _normalizeCityName: (name) => String(name || '').replace(/市$/, '').trim(),
        _normalizeDistrictName: (name) => String(name || '').replace(/[区县]$/, '').trim(),

        _logBuildStats: function () {
            const stats = {
                provinceCount: Object.keys(this.dataCache.provinceMap).length,
                cityCount: Object.keys(this.dataCache.cityMap).length,
                districtCount: Object.keys(this.dataCache.districtMap).length,
                mojiCodeCount: Object.keys(this.dataCache.mojiCodeMap).length,
                fullDistrictCount: Object.keys(this.dataCache.fullDistrictMap).length
            };
            this._log(`区域映射构建完成 - 省份: ${stats.provinceCount}, 城市: ${stats.cityCount}, 区县: ${stats.districtCount}, 墨迹编码: ${stats.mojiCodeCount}, 完整区县信息: ${stats.fullDistrictCount}`);
        },

        /**
         * [内部] 实际执行加载省市县数据的函数
         */
        _loadAreaCodesInternal: async function () {
            this._log(`发送请求获取省市县数据: ${WEATHER_API.AREA_CODES}`);
            const response = await fetch(WEATHER_API.AREA_CODES, { cache: 'no-store' });

            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status}`);
            }
            const result = await response.json();
            this._log('成功获取省市县数据');
            return this._extractAreaData(result);
        },

        /**
         * [公共] 获取完整的省市县数据 (带缓存和并发控制)
         */
        getFullAreaData: function () {
            if (this.dataCache.loading) {
                this._log('省市县数据正在加载中，返回现有Promise');
                return this.dataCache.loadingPromise;
            }
            if (this.dataCache.fullAreaData) {
                this._log('省市县数据已加载，直接返回');
                return Promise.resolve(this.dataCache.fullAreaData);
            }

            this.dataCache.loading = true;
            this.dataCache.loadingPromise = new Promise(async (resolve, reject) => {
                try {
                    const areaData = await this._loadAreaCodesInternal();
                    this.dataCache.fullAreaData = areaData;
                    this._buildAreaMaps(areaData);
                    resolve(areaData);
                } catch (error) {
                    this._handleAreaCodeError(error, reject);
                } finally {
                    this.dataCache.loading = false;
                    this.dataCache.loadingPromise = null;
                    this._log('省市县数据加载流程完成');
                }
            });
            return this.dataCache.loadingPromise;
        },

        /**
         * [内部] 实际执行获取IP定位数据的函数
         */
        _getLocationDataInternal: async function () {
            this._log('发送请求获取位置信息');
            const response = await fetch(WEATHER_API.IP_API, { cache: 'no-store' });

            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status}`);
            }

            const responseData = await response.json();
            const locationData = responseData.data || {};

            if (!locationData.province) { // 区县可能没有，但省份必须有
                throw new Error('获取的位置数据格式不正确 (缺少省份)');
            }
            locationData.city = locationData.city || ''; // 确保city存在
            locationData.district = locationData.district || ''; // 确保district存在

            return { locationData, weatherAreaCodes: responseData.weatherAreaCodes?.data };
        },

        /**
         * [公共] 通过IP获取位置数据
         * @param {boolean} forceReloadAreaData - 是否强制重新加载省市县数据
         */
        getIpLocation: async function (forceReloadAreaData = false) {
            this.dataCache.lastLocationSource = 'ip';
            const { locationData, weatherAreaCodes } = await this._getLocationDataInternal();
            this._log(`提取到的位置信息: 省=${locationData.province}, 市=${locationData.city}, 区=${locationData.district}`);

            // 如果IP API返回了最新的区域数据，或者需要强制刷新，或者数据为空
            if (forceReloadAreaData || !this.dataCache.fullAreaData || (weatherAreaCodes && weatherAreaCodes.length > 0)) {
                this._log('IP定位触发省市县数据加载/更新');

                // 如果API带回了数据，直接使用
                if (weatherAreaCodes && weatherAreaCodes.length > 0) {
                    this.dataCache.fullAreaData = weatherAreaCodes;
                    this._buildAreaMaps(weatherAreaCodes);
                } else {
                    // 否则清除缓存，让getFullAreaData重新加载
                    this.dataCache.fullAreaData = null;
                    await this.getFullAreaData();
                }
            }

            return locationData;
        },

        /**
         * [公共] 根据省份Code获取城市列表
         */
        getCitiesByProvinceCode: function (provinceCodeOrName) {
            if (!this.dataCache.fullAreaData) return [];

            const selectedProvince = this.dataCache.fullAreaData.find(p =>
                p.code === provinceCodeOrName || p.name === provinceCodeOrName
            );

            if (selectedProvince && selectedProvince.children && Array.isArray(selectedProvince.children)) {
                return selectedProvince.children;
            }
            this._log(`未找到省份 (${provinceCodeOrName}) 对应的城市数据`);
            return [];
        },

        /**
         * [公共] 根据省份和城市Code获取区县列表
         */
        getDistrictsByCityCode: function (provinceCodeOrName, cityCodeOrName) {
            const cities = this.getCitiesByProvinceCode(provinceCodeOrName);
            if (!cities || cities.length === 0) return [];

            const selectedCity = cities.find(c =>
                c.code === cityCodeOrName || c.name === cityCodeOrName
            );

            if (selectedCity && selectedCity.children && Array.isArray(selectedCity.children)) {
                return selectedCity.children;
            }
            this._log(`未找到城市 (${cityCodeOrName}) 对应的区县数据`);
            return [];
        },

        /**
         * [公共] 获取墨迹天气编码
         */
        getMojiCode: function (districtCode) {
            return this.dataCache.mojiCodeMap[districtCode] || '';
        },

        /**
         * [公共] 在省份下直接查找区县（用于IP定位只有province和district的情况）
         */
        findDistrictInProvince: function(provinceName, districtName) {
            this._log(`在省份 ${provinceName} 下查找区县 ${districtName}`);

            if (!this.dataCache.fullAreaData || !provinceName || !districtName) {
                return null;
            }

            const cleanProvince = this._normalizeProvinceName(provinceName);
            const cleanDistrict = this._normalizeDistrictName(districtName);

            // 1. 快速查找：使用fullDistrictMap
            const mapKey = `${cleanProvince}_${cleanDistrict}`;
            if (this.dataCache.fullDistrictMap && this.dataCache.fullDistrictMap[mapKey]) {
                const districtInfo = this.dataCache.fullDistrictMap[mapKey];
                this._log(`通过映射表快速找到区县: ${districtInfo.districtName}`);
                return districtInfo;
            }

            // 2. 遍历查找：作为备选方案
            for (const province of this.dataCache.fullAreaData) {
                if (!province || !province.name) continue;
                const pName = this._normalizeProvinceName(province.name);

                if (pName === cleanProvince || pName.includes(cleanProvince) || cleanProvince.includes(pName)) {
                    if (province.children && Array.isArray(province.children)) {
                        for (const city of province.children) {
                            if (!city || !city.children || !Array.isArray(city.children)) continue;
                            for (const district of city.children) {
                                if (!district || !district.name) continue;
                                const dName = this._normalizeDistrictName(district.name);

                                if (dName === cleanDistrict || district.name.includes(cleanDistrict) || cleanDistrict.includes(dName)) {
                                    this._log(`通过遍历找到区县: ${district.name}`);
                                    return {
                                        code: district.code,
                                        mojiCode: district.mojiCode || '',
                                        provinceMojiCode: province.mojiCode || '',
                                        cityName: city.name || '',
                                        districtName: district.name || '',
                                        fullName: `${province.name || ''}${city.name || ''}${district.name || ''}`
                                    };
                                }
                            }
                        }
                    }
                }
            }

            this._log(`未能在 ${provinceName} 下找到 ${districtName}`);
            return null;
        }
    };

    // -------------------------------------------------------------------------
    // 模块二: LocationSelectUI (UI管理器)
    // 职责: 负责所有DOM渲染和UI交互。
    // -------------------------------------------------------------------------
    const LocationSelectUI = {
        _logPrefix: '[UIManager]',
        _log: (msg) => logStep(`%c${LocationSelectUI._logPrefix} %c${msg}`, 'color: #008000;', 'color: unset;'),

        elements: {
            provinceSelect: null,
            citySelect: null,
            districtSelect: null,
            relocateBtn: null,
            cityName: null,
            cityCode: null,
            currentTemp: null,
            currentWea: null,
            weatherData: null,
        },

        /**
         * [公共] 初始化，获取所有DOM元素引用
         */
        initializeElements: function () {
            this.elements.provinceSelect = document.getElementById('province-select');
            this.elements.citySelect = document.getElementById('city-select');
            this.elements.districtSelect = document.getElementById('district-select');
            this.elements.relocateBtn = document.getElementById('relocate-btn');
            this.elements.cityName = document.getElementById('city-name');
            this.elements.cityCode = document.getElementById('city-code');
            this.elements.currentTemp = document.getElementById('current-temp');
            this.elements.currentWea = document.getElementById('current-wea');
            this.elements.weatherData = document.getElementById('weather-data');

            // 验证
            if (!this.elements.provinceSelect || !this.elements.citySelect || !this.elements.districtSelect) {
                this._log('错误: 缺少省市区选择框核心元素！');
                return false;
            }
            return true;
        },

        /**
         * [公共] 通用选择框渲染函数
         */
        renderOptions: function (selectElement, data, defaultText = '请选择', valueKey = 'code', textKey = 'name') {
            if (!selectElement) {
                this._log(`错误: 渲染选择框失败，元素不存在`);
                return false;
            }

            selectElement.innerHTML = `<option value="">${defaultText}</option>`;

            if (!data || !Array.isArray(data)) {
                this._log(`警告: 渲染 ${selectElement.id} 时数据无效`);
                return false;
            }

            // 使用文档片段优化性能
            const fragment = document.createDocumentFragment();
            data.forEach(item => {
                if (item && (item[valueKey] || item[textKey])) {
                    const option = document.createElement('option');
                    option.value = item[valueKey] || item[textKey];
                    option.textContent = item[textKey];
                    fragment.appendChild(option);
                }
            });
            selectElement.appendChild(fragment);
            // this._log(`渲染 ${selectElement.id} 完成，共 ${data.length} 个选项`);
            return true;
        },

        /**
         * [公共] 通用选择框选中函数 (通过值或文本)
         */
        selectOption: function (selectElement, targetValue, targetText = '') {
            if (!selectElement) {
                this._log('错误: selectOption 失败，元素不存在');
                return false;
            }

            // 如果 targetValue 存在但 targetText 为空，尝试使用 targetValue 作为 targetText
            const cleanTargetText = (targetText || targetValue || '').replace(/[省市县区]$/, '').trim();

            // 1. 优先通过值 (value) 查找
            if (targetValue) {
                for (let i = 0; i < selectElement.options.length; i++) {
                    if (selectElement.options[i].value === targetValue) {
                        selectElement.selectedIndex = i;
                        return true;
                    }
                }
            }

            // 2. 通过文本 (text) 查找
            if (cleanTargetText) {
                let bestMatchIndex = -1;
                let bestMatchScore = 0; // 匹配优先级: 3=完全相等, 2=包含, 1=被包含

                for (let i = 0; i < selectElement.options.length; i++) {
                    const option = selectElement.options[i];
                    const optionText = (option.text || '').trim();
                    const cleanOptionText = optionText.replace(/[省市县区]$/, '').trim();

                    if (cleanOptionText === cleanTargetText) { // 完全相等
                        bestMatchIndex = i;
                        bestMatchScore = 3;
                        break; // 找到最佳匹配
                    }
                    if (optionText.includes(cleanTargetText) && bestMatchScore < 2) { // 包含
                        bestMatchIndex = i;
                        bestMatchScore = 2;
                    }
                    if (cleanTargetText.includes(cleanOptionText) && bestMatchScore < 1) { // 被包含
                        bestMatchIndex = i;
                        bestMatchScore = 1;
                    }
                }

                if (bestMatchIndex !== -1) {
                    selectElement.selectedIndex = bestMatchIndex;
                    return true;
                }
            }

            this._log(`警告: 在 ${selectElement.id} 中未找到匹配选项: ${targetValue || cleanTargetText}`);
            return false;
        },

        /**
         * [公共] 重置选择框
         */
        resetSelect: function (selectElement, defaultText = '请选择', disabled = true) {
            if (selectElement) {
                selectElement.innerHTML = `<option value="">${defaultText}</option>`;
                selectElement.disabled = disabled;
            }
        },

        /**
         * [公共] 启用选择框
         */
        enableSelect: function(selectElement) {
            if (selectElement) selectElement.disabled = false;
        },

        /**
         * [公共] 禁用选择框
         */
        disableSelect: function(selectElement) {
            if (selectElement) selectElement.disabled = true;
        },

        /**
         * [公共] 更新顶部城市显示
         */
        updateCityDisplay: function (locationInfo) {
            if (!locationInfo || typeof locationInfo !== 'object') {
                this._log('警告: 更新城市显示时缺少必要的位置信息');
                return;
            }

            const name = locationInfo.name || '未知位置';
            const code = locationInfo.code || '';

            if (this.elements.cityName) {
                this.elements.cityName.textContent = name;
            }
            if (this.elements.cityCode) {
                this.elements.cityCode.textContent = code ? `城市代码: ${code}` : '城市代码: 未获取';
            }

            // 重置天气显示
            if (this.elements.currentTemp && !name.includes('正在') && !name.includes('失败')) {
                this.elements.currentTemp.textContent = '--°';
            }
            if (this.elements.currentWea && !name.includes('正在') && !name.includes('失败')) {
                this.elements.currentWea.textContent = '--';
            }

            this._log(`城市显示已更新为: ${name} (代码: ${code})`);
        },

        /**
         * [公共] 切换到手动选择模式
         */
        showManualSelection: function () {
            this._log('切换到用户手动选择流程');
            this.updateCityDisplay({
                name: '请手动选择所在地区',
                code: '手动选择'
            });
            // 确保省份选择框可用
            this.enableSelect(this.elements.provinceSelect);
            this.resetSelect(this.elements.citySelect, '请选择城市', true);
            this.resetSelect(this.elements.districtSelect, '请选择区县', true);
        },

        /**
         * [公共] 显示加载区域数据失败
         */
        showAreaLoadError: function() {
            if (this.elements.weatherData) {
                this.elements.weatherData.innerHTML += '<div class="text-center text-red-500 mt-2">数据加载失败，请刷新页面重试</div>';
            }
        },

        /**
         * [公共] 获取所有选择框的当前选中信息
         */
        getSelectedLocation: function() {
            const { provinceSelect, citySelect, districtSelect } = this.elements;

            const pOpt = provinceSelect.options[provinceSelect.selectedIndex];
            const cOpt = citySelect.options[citySelect.selectedIndex];
            const dOpt = districtSelect.options[districtSelect.selectedIndex];

            return {
                province: { code: pOpt.value, name: pOpt.text },
                city: { code: cOpt.value, name: cOpt.text },
                district: { code: dOpt.value, name: dOpt.text },
            };
        }
    };

    // -------------------------------------------------------------------------
    // 模块三: LocationController (控制器)
    // 职责: 协调Data和UI，处理业务逻辑和事件绑定。
    // -------------------------------------------------------------------------
    const LocationController = {
        _logPrefix: '[Controller]',
        _log: (msg) => logStep(`%c${LocationController._logPrefix} %c${msg}`, 'color: #DAA520;', 'color: unset;'),

        dataManager: LocationDataManager,
        uiManager: LocationSelectUI,
        _isMatchingLocation: false, // 状态锁，防止自动匹配并发执行

        /**
         * [公共] 模块总入口
         */
        initialize: async function () {
            this._log('模块初始化开始...');

            if (!this.uiManager.initializeElements()) {
                this._log('UI元素初始化失败，模块终止');
                return;
            }

            this._bindEvents();

            try {
                // 1. 启动时先加载省市县数据
                this.uiManager.updateCityDisplay({ name: '加载数据中...', code: '...' });
                const areaData = await this.dataManager.getFullAreaData();

                // 2. 渲染省份列表
                this.uiManager.renderOptions(this.uiManager.elements.provinceSelect, areaData, '请选择省份');
                this.uiManager.enableSelect(this.uiManager.elements.provinceSelect);

                // 3. 启动自动IP定位
                await this.startAutoLocate();

            } catch (error) {
                this._log(`初始化或自动定位失败: ${error.message}`);
                this.uiManager.showAreaLoadError();
                this.uiManager.showManualSelection(); // 失败则切换到手动
            }
        },

        /**
         * [内部] 绑定所有DOM事件
         */
        _bindEvents: function () {
            const { provinceSelect, citySelect, districtSelect, relocateBtn } = this.uiManager.elements;

            if (provinceSelect) {
                provinceSelect.addEventListener('change', () => this.onProvinceChange());
            }
            if (citySelect) {
                citySelect.addEventListener('change', () => this.onCityChange());
            }
            if (districtSelect) {
                districtSelect.addEventListener('change', () => this.onDistrictChange(true)); // true表示用户手动选择
            }
            if (relocateBtn) {
                relocateBtn.addEventListener('click', () => this.onRelocateClick());
            }
            this._log('事件监听器绑定完成');
        },

        /**
         * [事件] 重新定位按钮点击
         */
        onRelocateClick: async function () {
            this._log('重新定位按钮点击');
            this.dataManager.dataCache.lastLocationSource = 'ip'; // 标记为IP定位

            this.uiManager.updateCityDisplay({ name: '正在重新定位...', code: '...' });

            try {
                // 快速重新定位，不强制刷新区域数据
                const locationData = await this.dataManager.getIpLocation(false);
                await this.matchLocation(locationData, true);
            } catch (error) {
                this._log(`重新定位失败: ${error.message}`);
                this.uiManager.updateCityDisplay({ name: '定位失败，请重试', code: '定位错误' });
            }
        },

        /**
         * [事件] 省份选择变化
         */
        onProvinceChange: function () {
            this._log('省份选择变化');
            const { provinceSelect, citySelect, districtSelect } = this.uiManager.elements;

            const provinceCode = provinceSelect.value;
            if (!provinceCode) {
                this.uiManager.resetSelect(citySelect, '请选择城市', true);
                this.uiManager.resetSelect(districtSelect, '请选择区县', true);
                return;
            }

            const cities = this.dataManager.getCitiesByProvinceCode(provinceCode);
            this.uiManager.renderOptions(citySelect, cities, '请选择城市');
            this.uiManager.enableSelect(citySelect);
            this.uiManager.resetSelect(districtSelect, '请选择区县', true);
        },

        /**
         * [事件] 城市选择变化
         */
        onCityChange: function () {
            this._log('城市选择变化');
            const { provinceSelect, citySelect, districtSelect } = this.uiManager.elements;

            const provinceCode = provinceSelect.value;
            const cityCode = citySelect.value;

            if (!cityCode) {
                this.uiManager.resetSelect(districtSelect, '请选择区县', true);
                return;
            }

            const districts = this.dataManager.getDistrictsByCityCode(provinceCode, cityCode);
            this.uiManager.renderOptions(districtSelect, districts, '请选择区县');
            this.uiManager.enableSelect(districtSelect);
        },

        /**
         * [事件] 区县选择变化
         * @param {boolean} isManual - 是否为用户手动触发
         */
        onDistrictChange: function (isManual = false) {
            this._log(`区县选择变化 (手动: ${isManual})`);
            const { districtSelect } = this.uiManager.elements;
            const selectedDistrictCode = districtSelect.value;

            if (!selectedDistrictCode) {
                this._log('未选择区县');
                return;
            }

            if (isManual) {
                this.dataManager.dataCache.lastLocationSource = 'manual'; // 标记为手动选择
            }

            const location = this.uiManager.getSelectedLocation();

            // 构建完整的城市名称
            let fullLocationName = location.province.name;
            if (location.city.name && location.city.name !== location.province.name) {
                fullLocationName += location.city.name;
            }
            if (location.district.name && location.district.name !== location.city.name) {
                fullLocationName += location.district.name;
            }

            // 更新顶部显示
            this.uiManager.updateCityDisplay({
                name: fullLocationName,
                code: selectedDistrictCode
            });

            // 获取MojiCode并加载天气
            const mojiAreaCode = this.dataManager.getMojiCode(selectedDistrictCode);
            this._log(`选择的区县代码: ${selectedDistrictCode}, 墨迹编码: ${mojiAreaCode || '未找到'}`);

            // 调用全局天气加载函数
            loadWeatherData(selectedDistrictCode, mojiAreaCode);
        },

        /**
         * [流程] 启动自动定位
         */
        startAutoLocate: async function () {
            this._log('启动自动IP定位流程');
            this.uiManager.updateCityDisplay({ name: '正在定位...', code: '...' });

            // 初始定位，强制加载一次区域数据 (或使用IP API返回的数据)
            const locationData = await this.dataManager.getIpLocation(true);

            // 如果IP API直接返回了weatherCode，优先加载一次天气
            if (locationData.weatherCode) {
                this._log('IP定位已获取weatherCode，优先加载天气数据');
                loadWeatherData(locationData.weatherCode, locationData.mojiAreaCode);
            }

            // 开始匹配下拉框
            await this.matchLocation(locationData, true);
        },

        /**
         * [核心] 匹配位置到下拉框 (重构后的健壮版本)
         * @param {object} locationData - IP定位返回的位置对象
         * @param {boolean} isIpLocation - 标记是否为IP定位
         */
        matchLocation: async function (locationData, isIpLocation = false) {
            if (this._isMatchingLocation) {
                this._log('警告: 位置匹配已在进行中，忽略重复调用');
                return;
            }

            this._isMatchingLocation = true;
            this._log(`开始匹配位置: ${locationData.province}, ${locationData.city}, ${locationData.district}`);

            const { provinceSelect, citySelect, districtSelect } = this.uiManager.elements;
            let { province, city, district } = locationData;

            try {
                // --- 1. 处理IP定位的特殊情况 (如只有省和区) ---
                if (isIpLocation && province && district && !city) {
                    this._log('IP定位缺少城市信息，尝试在省内查找区县');
                    const districtInfo = this.dataManager.findDistrictInProvince(province, district);
                    if (districtInfo && districtInfo.cityName) {
                        this._log(`成功找到城市: ${districtInfo.cityName}，补全信息后继续匹配`);
                        city = districtInfo.cityName; // 补全城市信息
                    } else {
                        this._log('未找到对应城市，匹配中断。将仅显示IP定位结果。');
                        this._handleIpFallback(locationData);
                        this._isMatchingLocation = false;
                        return;
                    }
                }

                // --- 2. 正常匹配流程 (P -> C -> D) ---

                // 步骤 2a: 匹配并选择省份
                if (!this.uiManager.selectOption(provinceSelect, province)) {
                    this._log(`匹配省份失败: ${province}，自动匹配终止。`);
                    throw new Error('Province not found');
                }

                // 步骤 2b: 主动渲染城市列表 (替代dispatchEvent)
                const cities = this.dataManager.getCitiesByProvinceCode(provinceSelect.value);
                this.uiManager.renderOptions(citySelect, cities, '请选择城市');
                this.uiManager.enableSelect(citySelect);

                // 步骤 2c: 匹配并选择城市
                if (!this.uiManager.selectOption(citySelect, city)) {
                    this._log(`匹配城市失败: ${city}，自动匹配终止。`);
                    throw new Error('City not found');
                }

                // 步骤 2d: 主动渲染区县列表 (替代dispatchEvent)
                const districts = this.dataManager.getDistrictsByCityCode(provinceSelect.value, citySelect.value);
                this.uiManager.renderOptions(districtSelect, districts, '请选择区县');
                this.uiManager.enableSelect(districtSelect);

                // 步骤 2e: 匹配并选择区县
                if (!this.uiManager.selectOption(districtSelect, district)) {
                    this._log(`匹配区县失败: ${district}，自动匹配终止。`);
                    throw new Error('District not found');
                }

                // 步骤 2f: 匹配成功，触发天气加载
                this._log('省市区三级匹配成功！');

                // 如果是IP定位，且有更准确的weatherCode，则使用IP的code
                if (isIpLocation && locationData.weatherCode) {
                    this._log(`IP定位提供了Code: ${locationData.weatherCode}，覆盖下拉框选择`);
                    districtSelect.value = locationData.weatherCode;
                }

                this.onDistrictChange(false); // 触发加载 (标记为非手动)

            } catch (error) {
                this._log(`自动匹配过程中断: ${error.message}`);
                // 如果匹配失败 (例如找不到选项)，执行IP定位的兜底策略
                if (isIpLocation) {
                    this._handleIpFallback(locationData);
                } else {
                    // 如果是其他情况失败，显示手动选择
                    this.uiManager.showManualSelection();
                }
            } finally {
                this._isMatchingLocation = false; // 释放锁
            }
        },

        /**
         * [内部] IP定位匹配失败或信息不全时的兜底处理
         */
        _handleIpFallback: function (locationData) {
            this._log('执行IP定位兜底策略 (仅更新UI显示)');
            const { province, city, district, weatherCode } = locationData;

            let fullCityName = province;
            if (city && city !== province && !city.includes(province)) {
                fullCityName += city;
            }
            if (district && !fullCityName.includes(district)) {
                fullCityName += district;
            }

            this.uiManager.updateCityDisplay({
                name: fullCityName,
                code: weatherCode || '自动匹配失败'
            });

            // 即使匹配下拉框失败，如果IP返回了code，也加载天气
            if (weatherCode) {
                loadWeatherData(weatherCode, locationData.mojiAreaCode || '');
            } else {
                // 如果连code都没有，切换到手动
                this.uiManager.showManualSelection();
            }
        }
    };

    // 暴露唯一的全局入口
    window.WeatherLocationModule = {
        initialize: () => LocationController.initialize()
    };

})(window);
