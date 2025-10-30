/**
 * 天气数据渲染模块 - 优化版
 * 职责划分：
 * 1. WeatherRenderer - 主模块，负责整体协调和配置
 * 2. DataLoader - 天气数据加载和预处理
 * 3. UIRenderer - UI组件渲染
 * 4. ChartManager - 图表绘制和管理
 * 5. FestivalManager - 节日信息处理
 * 6. Utils - 通用工具函数
 */

// 日志工具
const Logger = {
    enabled: true,
    log(step, message) {
        if (this.enabled && typeof console !== 'undefined' && console.log) {
            console.log(`[天气模块] ${step}: ${message}`);
        }
    },
    warn(message) {
        if (this.enabled && typeof console !== 'undefined' && console.warn) {
            console.warn(`[天气模块] 警告: ${message}`);
        }
    },
    error(message) {
        if (this.enabled && typeof console !== 'undefined' && console.error) {
            console.error(`[天气模块] 错误: ${message}`);
        }
    }
};

// 配置管理
const Config = {
    // 图表配置
    chart: {
        minTemp: 0,
        maxTemp: 40,
        tempPadding: 5
    },
    // UI配置
    ui: {
        loadingDelay: 500,
        animationDuration: 300
    },
    // 重试配置
    retry: {
        maxAttempts: 3,
        delay: 1000
    }
};

/**
 * 天气数据加载器
 */
class DataLoader {
    constructor() {
        this.cache = new Map();
        this.retryCount = 0;
    }

    /**
     * 加载天气数据
     * @param {Object} options - 加载选项
     * @returns {Promise<Object>} 天气数据
     */
    async loadWeatherData(options = {}) {
        const { locationCode, callback, errorCallback } = options;
        
        try {
            // 检查缓存
            const cacheKey = `weather_${locationCode}`;
            if (this.cache.has(cacheKey)) {
                const cachedData = this.cache.get(cacheKey);
                if (Date.now() - cachedData.timestamp < 300000) { // 5分钟缓存
                    Logger.log('数据加载', '使用缓存数据');
                    callback && callback(cachedData.data);
                    return cachedData.data;
                }
            }

            // 显示加载状态
            showLoading();

            // 模拟API调用
            // 实际项目中这里应该是真实的API请求
            const data = await new Promise((resolve) => {
                setTimeout(() => {
                    // 模拟数据
                    resolve({ 
                        // 这里应该是真实的API响应格式
                    });
                }, 1000);
            });

            // 缓存数据
            this.cache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });

            // 成功回调
            callback && callback(data);
            return data;
        } catch (error) {
            Logger.error(`加载天气数据失败: ${error}`);
            
            // 重试逻辑
            if (this.retryCount < Config.retry.maxAttempts) {
                this.retryCount++;
                Logger.log('数据加载', `第${this.retryCount}次重试...`);
                
                setTimeout(() => {
                    this.loadWeatherData(options);
                }, Config.retry.delay * this.retryCount);
            } else {
                // 重置重试计数
                this.retryCount = 0;
                
                // 错误处理
                const errorMessage = error.message || '获取天气数据失败，请稍后重试';
                showWeatherError(errorMessage);
                errorCallback && errorCallback(error);
            }
        }
    }

    /**
     * 处理和标准化天气数据
     * @param {Object} rawData - 原始天气数据
     * @returns {Object} 标准化后的天气数据
     */
    processWeatherData(rawData) {
        if (!rawData) return null;

        try {
            const processed = {
                // 标准化数据结构
                todayWeather: this._processTodayWeather(rawData.todayWeather || rawData.today || {}),
                hourlyWeather: this._processHourlyWeather(rawData.hourlyWeather || rawData.hourlyForecast || []),
                recentDaysWeather: this._processRecentDaysWeather(rawData.recentDaysWeather || []),
                calendarWeather: this._processCalendarWeather(rawData.calendarWeather || [])
            };

            return processed;
        } catch (error) {
            Logger.error(`处理天气数据失败: ${error}`);
            return null;
        }
    }

    // 内部辅助方法：处理今日天气数据
    _processTodayWeather(data) {
        return {
            temperature: data.temperature || data.currentTemp || '--',
            weather: data.weather || data.description || '--',
            wind: data.wind || data.windDirection || '--',
            humidity: data.humidity || '--',
            airQuality: data.airQuality || data.aqi || '--',
            updateTime: data.updateTime || new Date().toLocaleTimeString()
        };
    }

    // 内部辅助方法：处理小时天气数据
    _processHourlyWeather(data) {
        return data.map(hour => ({
            hour: hour.hour || (hour.time && hour.time.split(':')[0]) || '',
            time: hour.time || '',
            temperature: hour.temperature || hour.temp || '--',
            weather: hour.weather || '--',
            wind: hour.wind || '--'
        }));
    }

    // 内部辅助方法：处理近日天气数据
    _processRecentDaysWeather(data) {
        return data.map(day => ({
            date: day.date || '',
            weather: day.weather || '--',
            tempMin: day.tempMin || day.minTemp || '--',
            tempMax: day.tempMax || day.maxTemp || '--',
            wind: day.wind || '--'
        }));
    }

    // 内部辅助方法：处理日历天气数据
    _processCalendarWeather(data) {
        return data.map(day => ({
            date: day.date || '',
            weather: day.weather || '--',
            tempMin: day.tempMin || day.minTemp || '--',
            tempMax: day.tempMax || day.maxTemp || '--',
            wind: day.wind || '--',
            historyTempMax: day.historyTempMax || day.historyMax || null,
            historyTempMin: day.historyTempMin || day.historyMin || null,
            realTempMax: day.realTempMax || day.actualMax || null,
            realTempMin: day.realTempMin || day.actualMin || null
        }));
    }
}

/**
 * 节日信息管理器
 */
class FestivalManager {
    constructor() {
        this.isLoaded = false;
        this.festivalsCache = new Map();
    }

    /**
     * 加载节日工具
     * @returns {Promise<boolean>}
     */
    async loadFestivalUtils() {
        if (window.festivalUtils && window.festivalUtils.getFestivalsForDate) {
            this.isLoaded = true;
            return true;
        }

        return new Promise((resolve, reject) => {
            try {
                const script = document.createElement('script');
                script.src = '/src/client/assets/js/business/common/festival_utils.js';
                script.onload = () => {
                    this.isLoaded = true;
                    Logger.log('节日管理', 'festival_utils加载成功');
                    resolve(true);
                };
                script.onerror = (error) => {
                    Logger.error('节日管理', 'festival_utils加载失败');
                    reject(error);
                };
                document.head.appendChild(script);
            } catch (error) {
                Logger.error('节日管理', `加载festival_utils时发生错误: ${error}`);
                reject(error);
            }
        });
    }

    /**
     * 获取指定日期的节日信息
     * @param {Date} date - 日期对象
     * @returns {Array} 节日数组
     */
    getFestivalsForDate(date) {
        if (!date) return [];

        // 检查缓存
        const cacheKey = date.toISOString().split('T')[0];
        if (this.festivalsCache.has(cacheKey)) {
            return this.festivalsCache.get(cacheKey);
        }

        try {
            // 优先使用公共节日工具
            if (window.festivalUtils && typeof window.festivalUtils.getFestivalsForDate === 'function') {
                const festivals = window.festivalUtils.getFestivalsForDate(date);
                this.festivalsCache.set(cacheKey, festivals || []);
                return festivals || [];
            }

            // 降级方案：使用lunar_utils
            if (window.lunarUtils && typeof window.lunarUtils.getFestivals === 'function') {
                const festivals = window.lunarUtils.getFestivals(date);
                this.festivalsCache.set(cacheKey, festivals || []);
                return festivals || [];
            }

            // 配置文件方案
            if (window.calendarConfig && window.calendarConfig.festivals) {
                const festivals = this._loadFestivalsFromConfig(date);
                this.festivalsCache.set(cacheKey, festivals || []);
                return festivals || [];
            }

            // 直接获取节气
            if (window.Solar && typeof window.Solar.fromYmd === 'function') {
                try {
                    const solar = window.Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
                    if (solar && solar.getLunar && solar.getLunar().getSolarTerm) {
                        const solarTerm = solar.getLunar().getSolarTerm();
                        if (solarTerm) {
                            const festivals = [{ name: solarTerm, type: 'solar_term', priority: 70 }];
                            this.festivalsCache.set(cacheKey, festivals);
                            return festivals;
                        }
                    }
                } catch (error) {
                    Logger.warn(`直接获取节气失败: ${error}`);
                }
            }

            return [];
        } catch (error) {
            Logger.error(`获取节日信息失败: ${error}`);
            return [];
        }
    }

    /**
     * 从配置文件加载节日数据
     * @param {Date} date - 日期对象
     * @returns {Array} 节日数组
     */
    _loadFestivalsFromConfig(date) {
        try {
            const festivals = [];
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const monthDay = `${month}-${day}`;

            if (window.calendarConfig && Array.isArray(window.calendarConfig.festivals)) {
                // 公历节日
                const solarFestivals = window.calendarConfig.festivals
                    .filter(f => f && f.dateType === 'solar' && f.date === monthDay)
                    .map(f => ({
                        name: f.name || '',
                        type: f.type || 'custom',
                        priority: f.priority || 50
                    }))
                    .filter(f => f.name);
                festivals.push(...solarFestivals);

                // 农历节日
                if (window.Solar && typeof window.Solar.fromYmd === 'function') {
                    try {
                        const solar = window.Solar.fromYmd(year, date.getMonth() + 1, day);
                        const lunar = solar.getLunar();
                        if (lunar) {
                            const lunarMonth = Math.abs(lunar.getMonth());
                            const lunarDay = lunar.getDay();
                            const isLeapMonth = lunar.getMonth() < 0;
                            const lunarKey = `${String(lunarMonth).padStart(2, '0')}-${String(lunarDay).padStart(2, '0')}${isLeapMonth ? '-leap' : ''}`;

                            const lunarFestivals = window.calendarConfig.festivals
                                .filter(f => f && f.dateType === 'lunar' && f.date === lunarKey)
                                .map(f => ({
                                    name: f.name || '',
                                    type: f.type || 'chinese_traditional',
                                    priority: f.priority || 60
                                }))
                                .filter(f => f.name);
                            festivals.push(...lunarFestivals);
                        }
                    } catch (error) {
                        Logger.warn(`计算农历节日失败: ${error}`);
                    }
                }
            }

            // 去重并排序
            const uniqueFestivals = [];
            const seen = new Set();
            festivals
                .sort((a, b) => (b.priority || 0) - (a.priority || 0))
                .forEach(f => {
                    if (f && f.name && !seen.has(f.name)) {
                        seen.add(f.name);
                        uniqueFestivals.push(f);
                    }
                });

            return uniqueFestivals;
        } catch (error) {
            Logger.error(`从配置加载节日失败: ${error}`);
            return [];
        }
    }

    /**
     * 获取节日类型对应的CSS类
     * @param {string} type - 节日类型
     * @returns {string} CSS类名
     */
    getFestivalTypeClass(type) {
        // 优先使用公共工具
        if (window.festivalUtils && typeof window.festivalUtils.getFestivalTypeClass === 'function') {
            try {
                return window.festivalUtils.getFestivalTypeClass(type);
            } catch (error) {
                Logger.warn(`调用公共节日工具失败: ${error}`);
            }
        }

        // 默认映射
        const typeMap = {
            'chinese_traditional': 'bg-festival-traditional',
            'chinese_common': 'bg-festival-common',
            'international': 'bg-festival-international',
            'holiday': 'bg-festival-holiday',
            'workday': 'bg-festival-workday'
        };

        return typeMap[type] || 'bg-festival-common';
    }
}

/**
 * 图表管理器
 */
class ChartManager {
    constructor() {
        // 图表实例缓存
        this.charts = {};
    }

    /**
     * 绘制24小时天气折线图
     * @param {Array} hourlyData - 小时天气数据
     */
    draw24HourChart(hourlyData) {
        const canvas = document.getElementById('24hour-chart');
        if (!canvas || !this._isChartJsLoaded()) {
            return;
        }

        // 销毁旧图表
        if (this.charts.hourly) {
            this.charts.hourly.destroy();
        }

        // 准备数据
        const labels = hourlyData.map(hour => hour.hour ? String(hour.hour) : (hour.time || '').split(':')[0] || '');
        const temperatures = hourlyData.map(hour => hour.temperature !== undefined && hour.temperature !== null ? Number(hour.temperature) : null);

        // 计算纵坐标区间
        const { minY, maxY } = this._calculateTemperatureRange(temperatures, 3);

        // 创建图表
        this.charts.hourly = new Chart(canvas, {
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
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    x: { grid: { display: false } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: (tooltipItems) => {
                                const label = tooltipItems[0].label;
                                return /^\d+$/.test(label) ? `${label}时` : label;
                            },
                            label: (context) => {
                                const index = context.dataIndex;
                                const hourData = hourlyData[index];
                                let content = `${context.parsed.y || '--'}°C`;
                                
                                if (hourData && hourData.weather) {
                                    content += `\t${hourData.weather.trim()}`;
                                }
                                if (hourData && hourData.wind) {
                                    content += `\t${hourData.wind.trim().replace(/[\s<>]+/g, '')}`;
                                }
                                
                                return content;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * 绘制天气趋势图表
     * @param {Array} dailyData - 每日天气数据
     */
    drawWeatherTrendChart(dailyData) {
        const canvas = document.getElementById('weather-trend-chart');
        if (!canvas || !this._isChartJsLoaded()) {
            return;
        }

        // 销毁旧图表
        if (this.charts.trend) {
            this.charts.trend.destroy();
        }

        // 准备数据
        const labels = dailyData.map(day => day.date ? this._formatDateForChart(day.date) : '');
        
        // 提取各类温度数据
        const { actualMaxTemps, actualMinTemps, forecastMaxTemps, forecastMinTemps, historicalMaxTemps, historicalMinTemps, allTemps } = this._extractTemperatureData(dailyData);
        
        // 计算温度区间
        const { minY, maxY } = this._calculateTemperatureRange(allTemps, 5);

        // 创建图表
        this.charts.trend = new Chart(canvas, {
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
                        borderColor: '#FD5123',
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
                        borderColor: '#38AFD1',
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
                        borderColor: '#FCA087',
                        backgroundColor: 'rgba(142, 68, 173, 0.1)',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        tension: 0.3,
                        fill: false,
                        pointRadius: 3,
                        pointBackgroundColor: '#FCA087'
                    },
                    {
                        label: '历史低温',
                        data: historicalMinTemps,
                        borderColor: '#7DD0E9',
                        backgroundColor: 'rgba(46, 134, 193, 0.1)',
                        borderWidth: 2,
                        borderDash: [5, 5],
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
                            label: (context) => `${context.dataset.label}: ${context.parsed.y || '--'}°C`
                        }
                    },
                    legend: {
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'line'
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        min: minY,
                        max: maxY,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    /**
     * 检查Chart.js是否已加载
     * @private
     * @returns {boolean}
     */
    _isChartJsLoaded() {
        return typeof Chart !== 'undefined';
    }

    /**
     * 格式化日期用于图表
     * @private
     * @param {string} dateStr - 日期字符串
     * @returns {string} 格式化后的日期
     */
    _formatDateForChart(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') return dateStr;
        
        // 处理YYYYMMDD格式
        if (dateStr.length === 8) {
            return `${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
        }
        
        // 处理YYYY-MM-DD格式
        if (dateStr.includes('-')) {
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                return `${parts[1]}-${parts[2]}`;
            }
        }
        
        return dateStr;
    }

    /**
     * 提取温度数据
     * @private
     * @param {Array} dailyData - 每日天气数据
     * @returns {Object} 各类温度数据
     */
    _extractTemperatureData(dailyData) {
        const actualMaxTemps = [];
        const actualMinTemps = [];
        const forecastMaxTemps = [];
        const forecastMinTemps = [];
        const historicalMaxTemps = [];
        const historicalMinTemps = [];
        const allTemps = [];

        dailyData.forEach(item => {
            // 历史温度
            const historyMax = item.historyTempMax || item.historyMax || item.historicalTempMax || item.historicalMax;
            const historyMin = item.historyTempMin || item.historyMin || item.historicalTempMin || item.historicalMin;
            historicalMaxTemps.push(historyMax ? Number(historyMax) : null);
            historicalMinTemps.push(historyMin ? Number(historyMin) : null);
            if (historyMax) allTemps.push(Number(historyMax));
            if (historyMin) allTemps.push(Number(historyMin));

            // 实际温度
            const realMax = item.realTempMax || item.actualMax || item.realMax;
            const realMin = item.realTempMin || item.actualMin || item.realMin;
            actualMaxTemps.push(realMax ? Number(realMax) : null);
            actualMinTemps.push(realMin ? Number(realMin) : null);
            if (realMax) allTemps.push(Number(realMax));
            if (realMin) allTemps.push(Number(realMin));

            // 预报温度
            const tempMax = item.tempMax || item.maxTemp || item.forecastMax;
            const tempMin = item.tempMin || item.minTemp || item.forecastMin;
            forecastMaxTemps.push(tempMax ? Number(tempMax) : null);
            forecastMinTemps.push(tempMin ? Number(tempMin) : null);
            if (tempMax) allTemps.push(Number(tempMax));
            if (tempMin) allTemps.push(Number(tempMin));
        });

        return { actualMaxTemps, actualMinTemps, forecastMaxTemps, forecastMinTemps, historicalMaxTemps, historicalMinTemps, allTemps };
    }

    /**
     * 计算温度显示区间
     * @private
     * @param {Array} temps - 温度数据
     * @param {number} padding - 边距
     * @returns {Object} {minY, maxY}
     */
    _calculateTemperatureRange(temps, padding = 5) {
        let minY = Config.chart.minTemp;
        let maxY = Config.chart.maxTemp;

        const validTemps = temps.filter(temp => temp !== null && !isNaN(temp));
        if (validTemps.length > 0) {
            const actualMin = Math.min(...validTemps);
            const actualMax = Math.max(...validTemps);

            minY = Math.floor(actualMin - padding);
            maxY = Math.ceil(actualMax + padding);

            // 确保最小值不低于0度（如果数据温度不太低）
            if (minY > -10) {
                minY = Math.max(0, minY);
            }
            // 确保最大值不超过40度（如果数据温度不太高）
            if (maxY < 45) {
                maxY = Math.min(40, maxY);
            }

            // 确保有足够的区间范围
            const range = maxY - minY;
            if (range < 10) {
                const center = (actualMin + actualMax) / 2;
                minY = Math.floor(center - 5);
                maxY = Math.ceil(center + 5);
            }
        }

        return { minY, maxY };
    }
}

/**
 * UI渲染器
 */
class UIRenderer {
    constructor() {
        this.festivalManager = new FestivalManager();
    }

    /**
     * 更新今日天气显示
     * @param {Object} todayData - 今日天气数据
     */
    updateTodayWeather(todayData) {
        if (!todayData) return;

        // 更新温度显示
        const tempElement = document.getElementById('weather-temperature');
        if (tempElement) {
            tempElement.textContent = `${todayData.temperature}°C`;
        }

        // 更新天气状况
        const weatherElement = document.getElementById('weather-condition');
        if (weatherElement) {
            weatherElement.textContent = todayData.weather || '--';
        }

        // 更新风力风向
        const windElement = document.getElementById('weather-wind');
        if (windElement) {
            windElement.textContent = todayData.wind || '--';
        }

        // 更新湿度
        const humidityElement = document.getElementById('weather-humidity');
        if (humidityElement) {
            humidityElement.textContent = todayData.humidity || '--';
        }

        // 更新空气质量
        const airQualityElement = document.getElementById('weather-air-quality');
        if (airQualityElement) {
            airQualityElement.textContent = todayData.airQuality || '--';
        }

        // 更新生活指数
        this.updateLifeHelper(todayData.lifeHelper || {});

        // 更新背景色
        const weatherContainer = document.getElementById('weather-content');
        if (weatherContainer) {
            const bgColor = this.getWeatherBgColor(todayData.weather);
            weatherContainer.style.backgroundColor = bgColor;
        }
    }

    /**
     * 更新生活指数
     * @param {Object} lifeData - 生活指数数据
     */
    updateLifeHelper(lifeData) {
        const container = document.getElementById('life-helper');
        if (!container) return;

        // 清空容器
        container.innerHTML = '';

        // 定义需要显示的生活指数项
        const lifeItems = [
            { key: 'comfort', label: '舒适度', icon: '😊' },
            { key: 'carWash', label: '洗车指数', icon: '🚗' },
            { key: 'dressing', label: '穿衣指数', icon: '👔' },
            { key: 'sport', label: '运动指数', icon: '🏃' },
            { key: 'uv', label: '紫外线', icon: '☀️' }
        ];

        // 创建生活指数项
        lifeItems.forEach(item => {
            const lifeDataItem = lifeData[item.key];
            if (!lifeDataItem) return;

            const itemElement = document.createElement('div');
            itemElement.className = 'life-helper-item';
            
            itemElement.innerHTML = `
                <div class="life-helper-icon">${item.icon}</div>
                <div class="life-helper-label">${item.label}</div>
                <div class="life-helper-value">${lifeDataItem.level || '--'}</div>
                <div class="life-helper-desc">${lifeDataItem.description || ''}</div>
            `;
            
            container.appendChild(itemElement);
        });
    }

    /**
     * 更新24小时天气摘要
     * @param {Array} hourlyData - 小时天气数据
     */
    updateHourlyWeatherSummary(hourlyData) {
        const container = document.getElementById('hourly-weather-summary');
        if (!container) return;

        // 清空容器
        container.innerHTML = '';

        // 只显示每3小时的数据
        const filteredData = hourlyData.filter((_, index) => index % 3 === 0);

        filteredData.forEach(hourData => {
            const hourElement = document.createElement('div');
            hourElement.className = 'hourly-item';
            
            // 时间
            const time = document.createElement('div');
            time.className = 'hourly-time';
            time.textContent = hourData.hour ? `${hourData.hour}时` : (hourData.time || '').replace(':', '时');
            
            // 图标
            const icon = document.createElement('div');
            icon.className = 'hourly-icon';
            icon.textContent = this.getWeatherIcon(hourData.weather);
            
            // 天气状况
            const weather = document.createElement('div');
            weather.className = 'hourly-weather';
            weather.textContent = this.simplifyWeatherText(hourData.weather);
            
            // 温度
            const temp = document.createElement('div');
            temp.className = 'hourly-temp';
            temp.textContent = `${hourData.temperature}°C`;
            
            // 风力
            const wind = document.createElement('div');
            wind.className = 'hourly-wind';
            wind.textContent = this.simplifyWindText(hourData.wind);
            
            // 组装
            hourElement.appendChild(time);
            hourElement.appendChild(icon);
            hourElement.appendChild(weather);
            hourElement.appendChild(temp);
            hourElement.appendChild(wind);
            
            container.appendChild(hourElement);
        });
    }

    /**
     * 更新近日天气表格
     * @param {Array} recentDaysWeather - 近日天气数据
     */
    updateRecentDaysWeather(recentDaysWeather) {
        const container = document.getElementById('recent-days-weather');
        if (!container) return;

        // 创建表格结构
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'relative';
        
        const tableContainer = document.createElement('div');
        tableContainer.className = 'overflow-x-auto overflow-y-auto h-80 scrollbar-thin';
        
        const table = document.createElement('table');
        table.className = 'min-w-full border-collapse';
        
        const tbody = document.createElement('tbody');
        
        // 添加每日数据行
        recentDaysWeather.forEach((dayData, index) => {
            const row = document.createElement('tr');
            row.className = index === 0 ? 'h-7 bg-blue-50' : 'h-7';
            
            // 格式化日期
            let dateStr = dayData.date || '';
            if (dateStr.length === 8) {
                const month = dateStr.substring(4, 6).replace(/^0/, '');
                const day = dateStr.substring(6, 8).replace(/^0/, '');
                dateStr = `${month}/${day}`;
            }
            
            // 日期单元格
            const dateCell = document.createElement('td');
            dateCell.className = 'text-xs font-medium text-center p-0.5 border-b border-gray-200 text-gray-700 font-semibold';
            dateCell.textContent = dateStr;
            
            // 天气和温度合并单元格
            const weatherCell = document.createElement('td');
            weatherCell.className = 'text-xs font-medium text-center p-0.5 border-b border-gray-200';
            const iconText = this.getWeatherIcon(dayData.weather);
            weatherCell.innerHTML = `
                <div class="flex flex-col items-center">
                    <div class="flex items-center space-x-2 mb-1">
                        <div class="text-sm">${iconText}</div>
                        <div class="text-sx truncate">${this.simplifyWeatherText(dayData.weather)}</div>
                    </div>
                    <div class="flex items-center space-x-2 text-sx">
                        <div class="text-blue-500">${dayData.tempMin || '--'}</div>
                        <div>/</div>
                        <div class="text-red-500">${dayData.tempMax || '--'}°C</div>
                    </div>
                </div>
            `;
            
            // 风力单元格
            const windCell = document.createElement('td');
            windCell.className = 'text-xs font-medium text-center p-0.5 border-b border-gray-200 text-gray-600';
            windCell.innerHTML = `<div class="text-xs truncate max-w-[60px]">${this.simplifyWindText(dayData.wind)}</div>`;
            
            // 添加单元格到行
            row.appendChild(dateCell);
            row.appendChild(weatherCell);
            row.appendChild(windCell);
            
            // 添加行到表体
            tbody.appendChild(row);
        });
        
        // 组装表格
        table.appendChild(tbody);
        
        // 添加边框容器
        const borderedContainer = document.createElement('div');
        borderedContainer.className = 'border border-gray-300 rounded-lg overflow-hidden';
        borderedContainer.appendChild(table);
        
        tableContainer.appendChild(borderedContainer);
        tableWrapper.appendChild(tableContainer);
        container.innerHTML = '';
        container.appendChild(tableWrapper);
        
        // 添加滚动箭头
        this._addScrollArrows(tableWrapper, tableContainer);
    }

    /**
     * 更新天气日历
     * @param {Array} calendarWeather - 日历天气数据
     */
    updateCalendarWeather(calendarWeather) {
        const container = document.getElementById('weather-calendar');
        if (!container || !calendarWeather || calendarWeather.length === 0) {
            return;
        }

        // 清空容器
        container.innerHTML = '';
        
        // 创建星期标题
        const weekHeader = document.createElement('div');
        weekHeader.className = 'flex justify-between mb-2';
        const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
        weekDays.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'text-center text-sm font-medium text-gray-700 flex-1';
            dayHeader.textContent = day;
            weekHeader.appendChild(dayHeader);
        });
        container.appendChild(weekHeader);
        
        // 创建网格容器
        const gridContainer = document.createElement('div');
        gridContainer.className = 'grid grid-cols-7 gap-1';
        container.appendChild(gridContainer);
        
        // 处理数据
        const dateToDataMap = new Map();
        calendarWeather.forEach(day => {
            if (day && day.date) {
                const formattedDate = this._formatDate(day.date);
                if (formattedDate) {
                    dateToDataMap.set(formattedDate, day);
                }
            }
        });
        
        // 获取第一个有效日期
        const firstValidDate = this._getFirstValidDate(calendarWeather);
        if (!firstValidDate) return;
        
        // 计算日历参数
        const { displayYear, displayMonth, firstDateOfMonth, lastDateOfMonth, leadingEmptyCells, totalCells } = this._calculateCalendarParams(firstValidDate);
        
        // 填充日历网格
        const todayStr = this._getTodayFormatted();
        for (let i = 0; i < totalCells; i++) {
            const cell = this._createCalendarCell(i, leadingEmptyCells, firstDateOfMonth, dateToDataMap, todayStr);
            gridContainer.appendChild(cell);
        }
    }

    /**
     * 获取天气对应的背景色
     * @param {string} weather - 天气描述
     * @returns {string} 背景色
     */
    getWeatherBgColor(weather) {
        const bgColorMap = {
            '晴': '#e0f7fa',
            '多云': '#e3f2fd',
            '阴': '#f5f5f5',
            '雨': '#f3e5f5',
            '雪': '#e8f5e9'
        };
        
        for (const [key, color] of Object.entries(bgColorMap)) {
            if (weather && weather.includes(key)) {
                return color;
            }
        }
        
        return '#f5f5f5';
    }

    /**
     * 获取天气对应的图标
     * @param {string} weather - 天气描述
     * @returns {string} 图标
     */
    getWeatherIcon(weather) {
        if (!weather) return '☁️';
        
        if (weather.includes('暴雨') || weather.includes('大雨')) return '⛈️';
        if (weather.includes('中雨')) return '🌧️';
        if (weather.includes('小雨') || weather.includes('阵雨')) return '🌦️';
        if (weather.includes('多云') || weather.includes('晴间多云')) return '⛅';
        if (weather.includes('阴') || weather.includes('阴天')) return '☁️';
        if (weather.includes('雪')) return '❄️';
        if (weather.includes('雾') || weather.includes('霾')) return '🌫️';
        if (weather.includes('晴')) return '☀️';
        if (weather.includes('雷')) return '⚡';
        
        return '☁️';
    }

    /**
     * 简化天气描述文本
     * @param {string} text - 原始文本
     * @returns {string} 简化后的文本
     */
    simplifyWeatherText(text) {
        if (!text) return '--';
        
        const keywordMap = {
            '晴': '晴',
            '多云': '多云',
            '阴': '阴',
            '小雨': '小雨',
            '中雨': '中雨',
            '大雨': '大雨',
            '暴雨': '暴雨',
            '阵雨': '阵雨',
            '雷阵雨': '雷阵雨',
            '雪': '雪',
            '雾': '雾',
            '霾': '霾'
        };
        
        for (const [key, value] of Object.entries(keywordMap)) {
            if (text.includes(key)) {
                return value;
            }
        }
        
        return text.length > 2 ? text.substring(0, 2) : text;
    }

    /**
     * 简化风向风力文本
     * @param {string} text - 原始文本
     * @returns {string} 简化后的文本
     */
    simplifyWindText(text) {
        if (!text) return '--';
        
        const directionMap = {
            '东北': 'NE',
            '东南': 'SE',
            '西北': 'NW',
            '西南': 'SW',
            '东': 'E',
            '南': 'S',
            '西': 'W',
            '北': 'N'
        };
        
        let result = text;
        for (const [key, value] of Object.entries(directionMap)) {
            if (text.includes(key)) {
                result = result.replace(key, value);
                break;
            }
        }
        
        return result.length > 8 ? result.substring(0, 8) + '...' : result;
    }

    /**
     * 添加滚动箭头
     * @private
     * @param {HTMLElement} wrapper - 包装器元素
     * @param {HTMLElement} container - 滚动容器
     */
    _addScrollArrows(wrapper, container) {
        // 向下滚动箭头
        const downArrow = document.createElement('div');
        downArrow.className = 'absolute right-0 bottom-0 z-10 bg-white/80 p-1 rounded-t-full shadow-sm cursor-pointer transition-opacity duration-300';
        downArrow.innerHTML = '⬇';
        downArrow.style.opacity = '0.7';
        
        // 向上滚动箭头
        const upArrow = document.createElement('div');
        upArrow.className = 'absolute right-0 top-0 z-10 bg-white/80 p-1 rounded-b-full shadow-sm cursor-pointer transition-opacity duration-300';
        upArrow.innerHTML = '⬆';
        upArrow.style.opacity = '0.7';
        upArrow.style.display = 'none';
        
        // 滚动监听
        container.addEventListener('scroll', () => {
            const canScrollDown = container.scrollHeight > container.clientHeight &&
                container.scrollTop < container.scrollHeight - container.clientHeight - 1;
            const canScrollUp = container.scrollTop > 0;
            
            downArrow.style.display = canScrollDown ? 'block' : 'none';
            upArrow.style.display = canScrollUp ? 'block' : 'none';
        });
        
        // 点击事件
        downArrow.addEventListener('click', () => {
            container.scrollBy({ top: 100, behavior: 'smooth' });
        });
        
        upArrow.addEventListener('click', () => {
            container.scrollBy({ top: -100, behavior: 'smooth' });
        });
        
        // 添加箭头
        wrapper.appendChild(downArrow);
        wrapper.appendChild(upArrow);
    }

    /**
     * 格式化日期
     * @private
     * @param {string} dateStr - 日期字符串
     * @returns {string} 格式化后的日期
     */
    _formatDate(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') return null;
        
        try {
            if (dateStr.length === 8 && /^\d{8}$/.test(dateStr)) {
                return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
            }
            
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

    /**
     * 获取第一个有效日期
     * @private
     * @param {Array} data - 日历数据
     * @returns {Date|null}
     */
    _getFirstValidDate(data) {
        for (const day of data) {
            if (day && day.date) {
                const formatted = this._formatDate(day.date);
                if (formatted) {
                    return new Date(formatted);
                }
            }
        }
        return null;
    }

    /**
     * 计算日历参数
     * @private
     * @param {Date} firstDate - 第一个日期
     * @returns {Object}
     */
    _calculateCalendarParams(firstDate) {
        const displayYear = firstDate.getFullYear();
        const displayMonth = firstDate.getMonth();
        const firstDateOfMonth = new Date(displayYear, displayMonth, 1);
        const lastDateOfMonth = new Date(displayYear, displayMonth + 1, 0);
        
        // 计算前置空白单元格
        const firstDayWeekIndex = firstDateOfMonth.getDay();
        const leadingEmptyCells = firstDayWeekIndex === 0 ? 6 : firstDayWeekIndex - 1;
        
        // 计算总单元格数
        const daysInMonth = lastDateOfMonth.getDate();
        const totalCells = Math.ceil((leadingEmptyCells + daysInMonth) / 7) * 7;
        
        return { displayYear, displayMonth, firstDateOfMonth, lastDateOfMonth, leadingEmptyCells, totalCells };
    }

    /**
     * 获取今天的格式化日期
     * @private
     * @returns {string}
     */
    _getTodayFormatted() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * 创建日历单元格
     * @private
     * @param {number} cellIndex - 单元格索引
     * @param {number} leadingEmptyCells - 前置空白数
     * @param {Date} firstDateOfMonth - 当月第一天
     * @param {Map} dateToDataMap - 日期数据映射
     * @param {string} todayStr - 今天的日期字符串
     * @returns {HTMLElement}
     */
    _createCalendarCell(cellIndex, leadingEmptyCells, firstDateOfMonth, dateToDataMap, todayStr) {
        const cell = document.createElement('div');
        cell.className = 'min-h-[100px] p-1 border border-gray-200 rounded';
        
        const dateOffset = cellIndex - leadingEmptyCells;
        const isCurrentMonth = dateOffset >= 0 && dateOffset < new Date(firstDateOfMonth.getFullYear(), firstDateOfMonth.getMonth() + 1, 0).getDate();
        const isWeekend = cellIndex % 7 === 5 || cellIndex % 7 === 6;
        
        if (!isCurrentMonth) {
            cell.style.backgroundColor = '#f8f8f8';
            return cell;
        }
        
        // 计算当前日期
        const currentDate = new Date(firstDateOfMonth);
        currentDate.setDate(currentDate.getDate() + dateOffset);
        
        const formattedCurrentDate = this._formatDate(currentDate.toISOString());
        const dayCount = currentDate.getDate();
        const isToday = formattedCurrentDate === todayStr;
        
        // 设置样式
        if (isToday) {
            cell.className = 'min-h-[100px] p-1 border-2 border-blue-400 rounded bg-blue-50';
        } else if (isWeekend) {
            cell.style.backgroundColor = '#e0f2fe';
        }
        
        // 创建日期和节日容器
        const dateAndFestivalContainer = document.createElement('div');
        dateAndFestivalContainer.className = 'flex items-center justify-between w-full';
        
        // 日期数字
        const dateNumber = document.createElement('div');
        dateNumber.className = isToday ? 'text-blue-600 font-bold text-sm' : 'text-gray-700 text-sm';
        dateNumber.textContent = dayCount;
        dateAndFestivalContainer.appendChild(dateNumber);
        
        // 节日容器
        const festivalContainer = document.createElement('div');
        festivalContainer.className = 'whitespace-nowrap';
        dateAndFestivalContainer.appendChild(festivalContainer);
        
        cell.appendChild(dateAndFestivalContainer);
        
        // 添加节日信息
        this._addFestivalInfoToCell(festivalContainer, currentDate, formattedCurrentDate);
        
        // 添加天气信息
        this._addWeatherInfoToCell(cell, dateToDataMap.get(formattedCurrentDate));
        
        return cell;
    }

    /**
     * 添加节日信息到单元格
     * @private
     * @param {HTMLElement} container - 容器元素
     * @param {Date} date - 日期对象
     * @param {string} formattedDate - 格式化日期
     */
    _addFestivalInfoToCell(container, date, formattedDate) {
        try {
            const festivalsForDay = this.festivalManager.getFestivalsForDate(date);
            
            if (festivalsForDay && Array.isArray(festivalsForDay) && festivalsForDay.length > 0) {
                festivalsForDay.forEach(festival => {
                    if (festival && festival.name) {
                        const festivalTag = document.createElement('div');
                        festivalTag.className = `festival-tag ${this.festivalManager.getFestivalTypeClass(festival.type)}`;
                        
                        let displayName = festival.name;
                        if (displayName.length > 4) {
                            displayName = displayName.substring(0, 4) + '...';
                        }
                        festivalTag.textContent = displayName;
                        container.appendChild(festivalTag);
                    }
                });
            }
        } catch (error) {
            Logger.error(`获取节日信息失败: ${error}`);
        }
    }

    /**
     * 添加天气信息到单元格
     * @private
     * @param {HTMLElement} cell - 单元格元素
     * @param {Object} dayData - 天气数据
     */
    _addWeatherInfoToCell(cell, dayData) {
        if (!dayData) {
            const noData = document.createElement('div');
            noData.className = 'text-[10px] text-gray-400 text-center';
            noData.textContent = '暂无数据';
            cell.appendChild(noData);
            return;
        }
        
        // 天气图标
        const icon = document.createElement('div');
        icon.className = 'text-xl my-1 text-center';
        icon.textContent = this.getWeatherIcon(dayData.weather);
        cell.appendChild(icon);
        
        // 天气状况
        const weatherElement = document.createElement('div');
        weatherElement.className = 'text-xs text-gray-600 mb-1 text-center truncate';
        weatherElement.textContent = this.simplifyWeatherText(dayData.weather);
        cell.appendChild(weatherElement);
        
        // 风力
        if (dayData.wind) {
            const windElement = document.createElement('div');
            windElement.className = 'text-xs text-gray-600 mb-1 text-center truncate';
            windElement.textContent = this.simplifyWindText(dayData.wind);
            cell.appendChild(windElement);
        }
        
        // 温度范围
        const tempRange = document.createElement('div');
        tempRange.className = 'text-xs';
        const maxTemp = dayData.tempMax || dayData.realTempMax || '--';
        const minTemp = dayData.tempMin || dayData.realTempMin || '--';
        tempRange.innerHTML = `<span class="text-gray-700">${minTemp}</span> / <span class="text-gray-900">${maxTemp}°C</span>`;
        cell.appendChild(tempRange);
    }
}

/**
 * 主天气渲染器类
 */
class WeatherRenderer {
    constructor() {
        this.dataLoader = new DataLoader();
        this.uiRenderer = new UIRenderer();
        this.chartManager = new ChartManager();
        this.festivalManager = new FestivalManager();
    }

    /**
     * 初始化
     */
    async init() {
        try {
            // 初始化节日数据
            await this.festivalManager.loadFestivalUtils();
            
            // 添加响应式调整
            window.addEventListener('resize', this._adjustTableResponsive.bind(this));
            
            Logger.log('初始化', '天气渲染器初始化完成');
        } catch (error) {
            Logger.error(`初始化天气渲染器失败: ${error}`);
        }
    }

    /**
     * 更新天气显示
     * @param {Object} weatherData - 天气数据
     */
    updateWeatherDisplay(weatherData) {
        try {
            Logger.log('更新显示', `开始更新天气显示: ${JSON.stringify(weatherData).substring(0, 80)}...`);
            
            if (!weatherData) {
                this.showWeatherError('获取到的天气数据为空');
                return;
            }
            
            // 隐藏错误信息
            const errorElement = document.getElementById('weather-error');
            if (errorElement) {
                errorElement.style.display = 'none';
            }
            
            // 显示天气内容
            const weatherContent = document.getElementById('weather-content');
            if (weatherContent) {
                weatherContent.style.display = 'block';
            }
            
            // 提取必要数据
            const { todayWeather, calendarWeather, hourlyForecast, hourlyWeather, recentDaysWeather } = weatherData;
            
            // 更新今日天气
            if (todayWeather && (todayWeather.temperature || todayWeather.weather)) {
                this.uiRenderer.updateTodayWeather(todayWeather);
            } else {
                Logger.log('更新显示', '错误: 没有找到有效的今日天气数据');
                this.showWeatherError('无法获取今日天气数据，请稍后重试');
                return;
            }
            
            // 获取24小时数据
            let hourlyData = hourlyWeather || hourlyForecast || 
                           (todayWeather && todayWeather.hourlyWeather) || 
                           (todayWeather && todayWeather.hourlyForecast);
            
            // 更新24小时天气摘要
            if (hourlyData) {
                this.uiRenderer.updateHourlyWeatherSummary(hourlyData);
                this.chartManager.draw24HourChart(hourlyData);
            }
            
            // 更新近日天气表格
            if (recentDaysWeather) {
                this.uiRenderer.updateRecentDaysWeather(recentDaysWeather);
            }
            
            // 更新天气日历和趋势图
            if (calendarWeather) {
                this.uiRenderer.updateCalendarWeather(calendarWeather);
                this.chartManager.drawWeatherTrendChart(calendarWeather);
            }
            
            Logger.log('更新显示', '天气显示更新完成');
        } catch (error) {
            Logger.error(`更新天气显示时出错: ${error}`);
            this.showWeatherError('天气数据处理错误，请稍后重试');
        }
    }

    /**
     * 显示加载状态
     */
    showLoading() {
        const loadingElement = document.getElementById('weather-loading');
        const weatherContent = document.getElementById('weather-content');
        const errorElement = document.getElementById('weather-error');
        
        if (loadingElement) {
            loadingElement.style.display = 'flex';
        }
        if (weatherContent) {
            weatherContent.style.display = 'none';
        }
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }

    /**
     * 隐藏加载状态
     */
    hideLoading() {
        const loadingElement = document.getElementById('weather-loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }

    /**
     * 显示天气错误
     * @param {string} message - 错误信息
     */
    showWeatherError(message) {
        const errorElement = document.getElementById('weather-error');
        const loadingElement = document.getElementById('weather-loading');
        const weatherContent = document.getElementById('weather-content');
        
        if (errorElement) {
            errorElement.textContent = message || '获取天气数据失败';
            errorElement.style.display = 'block';
        }
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        if (weatherContent) {
            weatherContent.style.display = 'none';
        }
    }

    /**
     * 更新天气网站链接
     * @param {string} mojiAreaCode - 墨迹天气区域代码
     * @param {string} weatherCode - 天气代码
     */
    updateWeatherLinks(mojiAreaCode, weatherCode) {
        // 实际项目中根据需要更新相关链接
    }

    /**
     * 响应式调整表格
     * @private
     */
    _adjustTableResponsive() {
        const isMobile = window.innerWidth < 768;
        const table = document.querySelector('#recent-days-weather table');
        
        if (!table) return;
        
        const tds = table.querySelectorAll('td');
        
        tds.forEach(td => {
            td.style.fontSize = isMobile ? '12px' : '';
        });
    }
}

// 导出全局函数
function loadWeatherData(options) {
    const renderer = new WeatherRenderer();
    return renderer.dataLoader.loadWeatherData(options);
}

function updateWeatherDisplay(weatherData) {
    const renderer = new WeatherRenderer();
    renderer.updateWeatherDisplay(weatherData);
}

function showLoading() {
    const renderer = new WeatherRenderer();
    renderer.showLoading();
}

function showWeatherError(message) {
    const renderer = new WeatherRenderer();
    renderer.showWeatherError(message);
}

function initFestivals() {
    const festivalManager = new FestivalManager();
    return festivalManager.loadFestivalUtils();
}

// 注册全局函数
window.loadWeatherData = loadWeatherData;
window.updateWeatherDisplay = updateWeatherDisplay;
window.showLoading = showLoading;
window.showWeatherError = showWeatherError;
window.initFestivals4Weather = initFestivals;

// 初始化
if (typeof document !== 'undefined' && document.readyState === 'complete') {
    const renderer = new WeatherRenderer();
    renderer.init();
} else if (typeof document !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        const renderer = new WeatherRenderer();
        renderer.init();
    });
}