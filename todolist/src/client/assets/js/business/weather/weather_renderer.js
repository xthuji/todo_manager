// 天气数据渲染模块
/**
 * ----------------------------------------------------------------------
 * 内部模块：WeatherModule
 * ----------------------------------------------------------------------
 * 所有的核心逻辑被封装到这里，职责划分更清晰。
 * - DataService: 负责数据处理和规范化。
 * - View: 负责所有 DOM 相关的更新和辅助函数。
 * - Charts: 负责所有 Chart.js 图表绘制。
 * - MainController: 负责协调数据和视图的更新流程。
 */

// 确保 WeatherModule 命名空间存在
if (typeof window.WeatherModule === 'undefined') {
    window.WeatherModule = {};
}

/**
 * 1. 数据服务层 (Service)
 * 负责数据规范化。
 */
window.WeatherModule.DataService = {
    /**
     * 规范化 API 返回的原始数据
     * @param {object} data - 原始 API 响应数据
     * @returns {object|null} - 统一结构的天气数据对象, 或 null (如果数据无效)
     */
    normalize: function(data) {
        let weatherData = null;

        // 检查是否有error字段 (在 loadWeatherData 中已前置处理)

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
            return weatherData;
        }

        logStep(`错误: 规范化失败，数据格式不符合预期: ${JSON.stringify(data).substring(0, 100)}...`);
        return null; // 不符合预期
    }
};

/**
 * 2. 视图渲染层 (View)
 * 负责所有 DOM 更新。
 */
window.WeatherModule.View = {
    /**
     * 安全地更新 DOM 元素的 textContent
     * @param {string} elementId - DOM 元素 ID
     * @param {string|number} value - 要设置的值
     * @param {string} [unit=''] - 可选的单位后缀 (例如 '°C')
     */
    safeUpdate: function(elementId, value, unit = '') {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = (value !== undefined && value !== null && value !== '' && value !== '--' && value !== '-')
                ? value + unit
                : '--' + unit;
        }
    },

    /**
     * 显示加载状态
     * @param {boolean} isLoading - 是否显示加载
     */
    showLoading: function(isLoading) {
        const loadingElement = document.getElementById('weather-loading');
        const weatherContent = document.getElementById('weather-content');

        if (loadingElement) {
            loadingElement.style.display = isLoading ? 'block' : 'none';
        }
        if (weatherContent) {
            weatherContent.style.display = isLoading ? 'none' : 'block';
        }
    },

    /**
     * 显示天气错误信息
     * @param {string} message - 错误信息
     */
    showError: function(message) {
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
    },

    /**
     * 更新天气网站链接
     * @param {string} mojiAreaCode - 墨迹区域代码
     * @param {string} weatherCode - 中国天气网代码
     */
    updateLinks: function(mojiAreaCode, weatherCode) {
        logStep(`更新天气网站链接: mojiAreaCode=${mojiAreaCode}, weatherCode=${weatherCode}`);

        const mojiLink = document.getElementById('moji-link');
        if (mojiLink) {
            if (mojiAreaCode) {
                mojiLink.href = `https://tianqi.moji.com/weather/china/${mojiAreaCode}`;
                mojiLink.title = `墨迹天气 - ${mojiAreaCode}`;
            } else {
                mojiLink.href = 'https://tianqi.moji.com/';
                mojiLink.title = '墨迹天气';
            }
        }

        const weatherComCnLink = document.getElementById('weather-com-cn-link');
        if (weatherComCnLink) {
            if (weatherCode) {
                weatherComCnLink.href = `https://forecast.weather.com.cn/town/weather1dn/${weatherCode}.shtml`;
                weatherComCnLink.title = `中国天气网 - ${weatherCode}`;
            } else {
                weatherComCnLink.href = 'https://forecast.weather.com.cn/';
                weatherComCnLink.title = '中国天气网';
            }
        }
    },

    /**
     * 根据天气状况获取对应的背景色类
     * @param {string} weatherCondition - 天气状况描述
     * @returns {string} - CSS 背景类
     */
    getBgColor: function(weatherCondition) {
        if (!weatherCondition) return 'bg-gray-50';
        const condition = weatherCondition.toLowerCase();
        // ... (原 getWeatherBgColor 逻辑)
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
    },

    /**
     * 更新今天天气面板
     * @param {object} todayWeather - 今日天气数据
     */
    updateToday: function(todayWeather) {
        logStep(`更新今日天气数据...`);
        if (!todayWeather) {
            logStep('错误: todayWeather数据为空');
            return;
        }

        // ... (原 updateTodayWeather 逻辑)
        // 注意：内部调用 helpers
        const safeUpdate = this.safeUpdate; // 使用 this.safeUpdate

        const currentWeatherInfo = document.getElementById('current-weather-info');
        if (currentWeatherInfo && currentWeatherInfo.parentNode) {
            currentWeatherInfo.parentNode.removeChild(currentWeatherInfo);
        }

        const time = todayWeather.time || '--:--';

        safeUpdate('current-temp', todayWeather.temperature || '--', '°C');
        safeUpdate('weather-condition', todayWeather.weather || '--');
        safeUpdate('temp-range', `${(todayWeather.tempMin || '--')} / ${(todayWeather.tempMax || '--')}°C`);
        safeUpdate('humidity-info', todayWeather.humidity || '--');
        safeUpdate('air-quality', todayWeather.airQuality || '--');
        safeUpdate('wind-info', todayWeather.wind || '--');
        safeUpdate('visibility-info', todayWeather.visibility || '--');
        safeUpdate('traffic-restriction', todayWeather.limit || '--');
        safeUpdate('weather-tips', todayWeather.tips || '暂无提示');

        // ... (动态注入 CSS 的逻辑 - 建议将此 CSS 移至主样式表)
        let extraInfoContainer = document.getElementById('weather-extra-info');
        if (!extraInfoContainer) {
            extraInfoContainer = document.createElement('div');
            extraInfoContainer.id = 'weather-extra-info';
            extraInfoContainer.className = 'weather-extra-info';

            const style = document.createElement('style');
            style.textContent = `
                .weather-extra-info {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 10px; margin-top: 15px; padding: 15px;
                    background-color: #f8f9fa; border-radius: 8px; font-size: 14px;
                }
                .extra-info-item { display: flex; flex-direction: column; gap: 5px; }
                .extra-info-label { color: #6c757d; font-size: 12px; }
                .extra-info-value { color: #212529; font-weight: 500; }
            `;
            document.head.appendChild(style);

            const todayWeatherSection = document.getElementById('today-weather-section');
            if (todayWeatherSection) {
                todayWeatherSection.appendChild(extraInfoContainer);
            }
        }
        // ... (innerHTML 更新逻辑)
        extraInfoContainer.innerHTML = `
            <div class="extra-info-item"><div class="extra-info-label">更新时间</div><div class="extra-info-value">${time}</div></div>
            <div class="extra-info-item"><div class="extra-info-label">能见度</div><div class="extra-info-value">${(todayWeather.visibility || '--')}</div></div>
            <div class="extra-info-item"><div class="extra-info-label">限行提示</div><div class="extra-info-value">${(todayWeather.limit || '--')}</div></div>
            <div class="extra-info-item"><div class="extra-info-label">今日提示</div><div class="extra-info-value">${(todayWeather.tips || '暂无提示')}</div></div>
        `;

        // ... (天气图标逻辑)
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

        const todayWeatherSection = document.getElementById('today-weather-section');
        if (todayWeatherSection) {
            todayWeatherSection.style.display = 'block';
        }

        if (todayWeather.lifeHelper) {
            this.updateLifeHelper(todayWeather.lifeHelper); // 调用 this.updateLifeHelper
        }

        const weatherArea = document.querySelector('#weather-area');
        if (weatherArea) {
            weatherArea.className = weatherArea.className.replace(/bg-[\w-]+/g, '').trim();
            weatherArea.className += ' ' + this.getBgColor(todayWeather.weather || '--'); // 调用 this.getBgColor
        }
    },

    /**
     * 更新生活指数信息
     * @param {Array} lifeHelperData - 生活指数数据
     */
    updateLifeHelper: function(lifeHelperData) {
        // ... (原 updateLifeHelper 逻辑)
        const container = document.getElementById('life-helper-container');
        if (!container || !Array.isArray(lifeHelperData)) {
            return;
        }
        container.innerHTML = '';
        const lifeHelperIcons = { '紫外线': 'fa-sun-o', '感冒': 'fa-stethoscope', '穿衣': 'fa-shopping-bag', '洗车': 'fa-car', '运动': 'fa-soccer-ball-o', '空气污染扩散': 'fa-plus-circle' };
        const lifeHelperColors = { '优': 'text-green-600', '良': 'text-blue-600', '中等': 'text-yellow-600', '较易发': 'text-orange-600', '适宜': 'text-green-600', '不适宜': 'text-red-600', '较舒适': 'text-blue-600' };

        lifeHelperData.forEach(item => {
            const lifeHelperItem = document.createElement('div');
            lifeHelperItem.className = 'bg-white p-3 rounded-lg shadow-sm flex flex-col justify-between';
            lifeHelperItem.style.height = '100%';
            lifeHelperItem.title = item.desc;
            const iconClass = lifeHelperIcons[item.title] || 'fa-question-circle';
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
    },

    /**
     * 更新24小时天气摘要
     * @param {Array} hourlyData - 24小时数据
     */
    updateHourlySummary: function(hourlyData) {
        // ... (原 updateHourlyWeatherSummary 逻辑)
        const container = document.getElementById('hourly-weather-summary');
        const hourlyWeatherSection = container ? container.closest('[id$="hourly-weather-section"]') || container.closest('.hourly-weather-section') : null;

        if (!container || !hourlyData || !Array.isArray(hourlyData) || hourlyData.length === 0) {
            if (hourlyWeatherSection) hourlyWeatherSection.style.display = 'none';
            else if (container) container.style.display = 'none';
            return;
        }

        if (hourlyWeatherSection) hourlyWeatherSection.style.display = 'block';
        container.style.display = 'block';
        container.style.display = 'flex';
        container.style.overflowX = 'auto';
        // ... (其余样式设置)
        container.style.whiteSpace = 'nowrap';
        container.style.scrollbarWidth = 'thin';
        container.style.marginBottom = '0';
        container.style.paddingBottom = '10px';
        container.style.userSelect = 'none';
        container.innerHTML = '';

        // ... (滚动同步逻辑)
        container.addEventListener('scroll', () => {
            const chartContainer = document.getElementById('24hour-chart-container');
            if (chartContainer) chartContainer.scrollLeft = container.scrollLeft;
        });
        const chartContainer = document.getElementById('24hour-chart-container');
        if (chartContainer) {
            chartContainer.style.overflowX = 'auto';
            chartContainer.style.scrollbarWidth = 'thin';
            chartContainer.addEventListener('scroll', () => {
                container.scrollLeft = chartContainer.scrollLeft;
            });
        }

        const currentHour = new Date().getHours();

        hourlyData.forEach((hourData, index) => {
            // ... (原 hourlyData 循环逻辑)
            if (!hourData) return;
            let hourValue = null;
            if (hourData.hour !== undefined) hourValue = parseInt(hourData.hour);
            else if (hourData.time) {
                const timeStr = String(hourData.time);
                const hourMatch = timeStr.match(/^(\d{1,2})/);
                if (hourMatch) hourValue = parseInt(hourMatch[1]);
            }
            let isCurrentHour = false;
            if (hourValue !== null) isCurrentHour = hourValue === currentHour;
            else if (index === 0) isCurrentHour = true;

            const hourElement = document.createElement('div');
            const baseClasses = 'inline-flex flex-col items-center justify-center p-1 bg-gray-50 rounded-lg text-center min-w-[70px] max-w-[70px]';
            hourElement.className = isCurrentHour ? `${baseClasses} border-2 border-blue-400 bg-blue-50` : baseClasses;

            // ... (自动滚动逻辑)
            setTimeout(() => {
                if (hourElement && isCurrentHour) {
                    console.log('自动滚动到当前时段数据');
                    let parent = hourElement.parentElement;
                    let containerFound = false;
                    while (parent && parent !== document.body && !containerFound) {
                        const isScrollable = parent.scrollWidth > parent.clientWidth || parent.scrollHeight > parent.clientHeight;
                        if (isScrollable) {
                            const rect = hourElement.getBoundingClientRect();
                            const parentRect = parent.getBoundingClientRect();
                            const scrollX = parent.scrollLeft + (rect.left - parentRect.left) - (parent.clientWidth / 2) + (rect.width / 2);
                            const maxScroll = parent.scrollWidth - parent.clientWidth;
                            const safeScrollX = Math.max(0, Math.min(scrollX, maxScroll));
                            parent.scrollTo({ left: safeScrollX, behavior: 'smooth' });
                            containerFound = true;
                        }
                        parent = parent.parentElement;
                    }
                }
            }, 500);

            hourElement.style.width = '75px'; // 确保宽度

            const time = document.createElement('div');
            time.className = 'text-xs font-medium text-gray-700 mb-1';
            time.textContent = hourData.hour ? `${hourData.hour}时` : (hourData.time || '').replace(':', '时');

            const icon = document.createElement('div');
            icon.className = 'text-xl my-1';
            let iconText = '☀️';
            const weather = hourData.weather || '';
            if (weather.includes('雨')) iconText = '🌧️';
            else if (weather.includes('云')) iconText = '☁️';
            else if (weather.includes('阴')) iconText = '☁️';
            else if (weather.includes('雪')) iconText = '❄️';
            icon.textContent = iconText;

            const condition = document.createElement('div');
            condition.className = 'text-[10px] text-gray-600 mb-1 truncate';
            condition.textContent = weather || '--';

            const wind = document.createElement('div');
            wind.className = 'text-[9px] text-gray-500 mb-1';
            wind.textContent = (hourData.wind || '--').trim().replace(/[\s<>]+/g, '');

            const temp = document.createElement('div');
            temp.className = 'text-sm font-medium text-gray-800';
            temp.textContent = `${hourData.temperature}°C`;

            hourElement.appendChild(time);
            hourElement.appendChild(icon);
            hourElement.appendChild(condition);
            hourElement.appendChild(wind);
            hourElement.appendChild(temp);
            container.appendChild(hourElement);
        });
    },

    /**
     * 更新天气日历
     * @param {Array} calendarWeather - 日历天气数据
     */
    updateCalendar: function(calendarWeather) {
        // ... (原 updateCalendarWeather 逻辑)
        const calendarContainer = document.getElementById('weather-calendar');
        const calendarSection = calendarContainer ? calendarContainer.closest('[id$="calendar-section"]') || calendarContainer.closest('.calendar-section') : null;

        if (!calendarContainer) {
            logStep('错误: 日历容器元素不存在');
            return;
        }

        if (!calendarWeather || !Array.isArray(calendarWeather) || calendarWeather.length === 0) {
            if (calendarSection) calendarSection.style.display = 'none';
            else {
                calendarContainer.innerHTML = '<div class="no-data-message">暂无日历天气数据</div>';
                calendarContainer.style.display = 'block';
            }
            return;
        }

        if (calendarSection) calendarSection.style.display = 'block';
        calendarContainer.style.display = 'block';
        calendarContainer.innerHTML = '';

        // ... (日期格式化辅助函数)
        function formatDate(dateStr) {
            if (!dateStr || typeof dateStr !== 'string') return null;
            try {
                if (dateStr.length === 8 && /^\d{8}$/.test(dateStr)) {
                    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
                }
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) return null;
                return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            } catch (e) { return null; }
        }
        function getTodayFormatted() {
            const today = new Date();
            return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        }

        // ... (星期标题行)
        const weekHeader = document.createElement('div');
        weekHeader.className = 'flex justify-between mb-2';
        weekHeader.style.width = '100%';
        ['周一', '周二', '周三', '周四', '周五', '周六', '周日'].forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'text-center text-sm font-medium text-gray-700 flex-1';
            dayHeader.textContent = day;
            weekHeader.appendChild(dayHeader);
        });
        calendarContainer.appendChild(weekHeader);

        const gridContainer = document.createElement('div');
        gridContainer.className = 'grid grid-cols-7 gap-1';
        gridContainer.style.width = '100%';
        calendarContainer.appendChild(gridContainer);

        // ... (数据处理和排序)
        const processedWeatherData = [];
        const dateToDataMap = new Map();
        calendarWeather.forEach(day => {
            if (!day || !day.date) return;
            const formattedDate = formatDate(day.date);
            if (!formattedDate) return;
            const dateObj = new Date(formattedDate);
            const dayData = { ...day, formattedDate: formattedDate, dateObj: dateObj };
            processedWeatherData.push(dayData);
            dateToDataMap.set(formattedDate, dayData);
        });
        processedWeatherData.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

        // ... (计算月份和填充)
        let displayYear, displayMonth;
        if (processedWeatherData.length > 0) {
            const firstDate = processedWeatherData[0].dateObj;
            displayYear = firstDate.getFullYear();
            displayMonth = firstDate.getMonth();
        } else {
            const now = new Date();
            displayYear = now.getFullYear();
            displayMonth = now.getMonth();
        }

        const firstDateOfMonth = new Date(displayYear, displayMonth, 1);
        const lastDateOfMonth = new Date(displayYear, displayMonth + 1, 0);
        const daysInMonth = lastDateOfMonth.getDate();
        const firstDayWeekIndex = firstDateOfMonth.getDay();
        let leadingEmptyCells = (firstDayWeekIndex === 0) ? 6 : (firstDayWeekIndex - 1);
        const totalCells = Math.ceil((leadingEmptyCells + daysInMonth) / 7) * 7;
        const todayStr = getTodayFormatted();

        // ... (填充日历网格)
        for (let cellIndex = 0; cellIndex < totalCells; cellIndex++) {
            const cell = document.createElement('div');
            cell.className = 'min-h-[100px] p-1 border border-gray-200 rounded';
            const dateOffset = cellIndex - leadingEmptyCells;
            const isCurrentMonth = dateOffset >= 0 && dateOffset < daysInMonth;
            const isWeekend = cellIndex % 7 === 5 || cellIndex % 7 === 6;

            if (!isCurrentMonth) {
                cell.style.backgroundColor = '#f8f8f8';
            } else {
                const currentDate = new Date(firstDateOfMonth);
                currentDate.setDate(currentDate.getDate() + dateOffset);
                const formattedCurrentDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
                const dayCount = currentDate.getDate();
                const isToday = formattedCurrentDate === todayStr;
                const dayData = dateToDataMap.get(formattedCurrentDate);

                if (isToday) cell.className = 'min-h-[100px] p-1 border-2 border-blue-400 rounded bg-blue-50';
                else if (isWeekend) cell.style.backgroundColor = '#e0f2fe';

                const dateAndFestivalContainer = document.createElement('div');
                dateAndFestivalContainer.className = 'flex items-center justify-between w-full';
                const dateNumber = document.createElement('div');
                dateNumber.className = isToday ? 'text-blue-600 font-bold text-sm' : 'text-gray-700 text-sm';
                dateNumber.textContent = dayCount;
                dateAndFestivalContainer.appendChild(dateNumber);
                const festivalContainer = document.createElement('div');
                festivalContainer.className = 'whitespace-nowrap';
                dateAndFestivalContainer.appendChild(festivalContainer);
                cell.appendChild(dateAndFestivalContainer);

                // ... (节日标记)
                try {
                    festivalContainer.innerHTML = '';
                    // 假设 lunarUtils 已在全局 window 上
                    const festivalsForDay = window.lunarUtils.getFestivalsSync(dayData.dateObj, 1);
                    if (festivalsForDay && Array.isArray(festivalsForDay) && festivalsForDay.length > 0) {
                        festivalsForDay.forEach(festival => {
                            if (festival && festival.name) {
                                const festivalTag = document.createElement('div');
                                let festivalTypeClass = window.lunarUtils.getFestivalTypeClass(festival.type);
                                festivalTag.className = `festival-tag ${festivalTypeClass}`;
                                festivalTag.textContent = festival.name;
                                festivalContainer.appendChild(festivalTag);
                            }
                        });
                    }
                } catch (error) { console.error('获取节日信息失败:', error); }

                // ... (天气信息)
                if (dayData) {
                    let shortWeather = dayData.weather || '--';
                    if (shortWeather.length > 2 && shortWeather.includes('转')) shortWeather = shortWeather.split('转')[0];
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

                    const weatherElement = document.createElement('div');
                    weatherElement.className = 'text-xs text-gray-600 mb-1 text-center truncate';
                    weatherElement.textContent = shortWeather;
                    cell.appendChild(weatherElement);

                    if (dayData.wind) {
                        const windElement = document.createElement('div');
                        windElement.className = 'text-xs text-gray-600 mb-1 text-center truncate';
                        windElement.textContent = dayData.wind || '--';
                        cell.appendChild(windElement);
                    }

                    const tempRange = document.createElement('div');
                    tempRange.className = 'text-xs';
                    const maxTemp = dayData.tempMax || dayData.realTempMax || '--';
                    const minTemp = dayData.tempMin || dayData.realTempMin || '--';
                    tempRange.innerHTML = `<span class="text-gray-700">${minTemp}</span> / <span class="text-gray-900">${maxTemp}°C</span>`;
                    cell.appendChild(tempRange);
                } else {
                    const noData = document.createElement('div');
                    noData.className = 'text-[10px] text-gray-400 text-center';
                    noData.textContent = '暂无数据';
                    cell.appendChild(noData);
                }
            }
            gridContainer.appendChild(cell);
        }
    },

    /**
     * 更新近几日天气横向表格
     * @param {Array} recentDaysWeather - 近日天气数据
     */
    updateRecentDays: function(recentDaysWeather) {
        // ... (原 updateRecentDaysWeather 逻辑)
        const container = document.getElementById('recent-days-weather');
        const recentDaysSection = container ? container.closest('[id$="recent-days-section"]') || container.closest('.recent-days-section') : null;

        if (!container) { logStep('错误: 近日天气容器元素不存在'); return; }

        if (!recentDaysWeather || !Array.isArray(recentDaysWeather) || recentDaysWeather.length === 0) {
            if (recentDaysSection) recentDaysSection.style.display = 'none';
            else {
                container.innerHTML = '<div class="no-data-message text-center text-sm text-gray-500 py-2">暂无近日天气数据</div>';
                container.style.display = 'block';
            }
            return;
        }

        if (recentDaysSection) recentDaysSection.style.display = 'block';
        container.style.display = 'block';

        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'relative';

        const tableContainer = document.createElement('div');
        tableContainer.className = 'overflow-x-auto overflow-y-auto h-80 scrollbar-thin';

        // ... (滚动箭头逻辑)
        const downArrow = document.createElement('div');
        downArrow.className = 'absolute right-0 bottom-0 z-10 bg-white/80 p-1 rounded-t-full shadow-sm cursor-pointer transition-opacity duration-300';
        downArrow.innerHTML = '⬇';
        downArrow.style.opacity = '0.7';
        const upArrow = document.createElement('div');
        upArrow.className = 'absolute right-0 top-0 z-10 bg-white/80 p-1 rounded-b-full shadow-sm cursor-pointer transition-opacity duration-300';
        upArrow.innerHTML = '⬆';
        upArrow.style.opacity = '0.7';
        upArrow.style.display = 'none';

        tableContainer.addEventListener('scroll', function() {
            const canScrollDown = tableContainer.scrollHeight > tableContainer.clientHeight && tableContainer.scrollTop < tableContainer.scrollHeight - tableContainer.clientHeight - 1;
            const canScrollUp = tableContainer.scrollTop > 0;
            downArrow.style.display = canScrollDown ? 'block' : 'none';
            upArrow.style.display = canScrollUp ? 'block' : 'none';
        });
        downArrow.addEventListener('click', function() { tableContainer.scrollBy({ top: 100, behavior: 'smooth' }); });
        upArrow.addEventListener('click', function() { tableContainer.scrollBy({ top: -100, behavior: 'smooth' }); });

        tableWrapper.appendChild(downArrow);
        tableWrapper.appendChild(upArrow);

        setTimeout(function() {
            const canScrollDown = tableContainer.scrollHeight > tableContainer.clientHeight;
            downArrow.style.display = canScrollDown ? 'block' : 'none';
        }, 100);

        const table = document.createElement('table');
        table.className = 'min-w-full border-collapse';
        const tbody = document.createElement('tbody');

        // ... (填充表格行)
        recentDaysWeather.forEach((dayData, index) => {
            const row = document.createElement('tr');
            const isToday = index === 0;
            row.className = 'h-7' + (isToday ? ' bg-blue-50' : '');

            let dateStr = dayData.date || '';
            if (dateStr.length === 8) {
                dateStr = `${dateStr.substring(4, 6).replace(/^0/, '')}/${dateStr.substring(6, 8).replace(/^0/, '')}`;
            }

            const dataCells = [
                dateStr,
                { weather: dayData.weather || '--', minTemp: dayData.tempMin || '--', maxTemp: dayData.tempMax || '--' },
                dayData.wind || '--'
            ];

            dataCells.forEach((cellData, cellIndex) => {
                const td = document.createElement('td');
                td.className = 'text-xs font-medium text-center p-0.5 border-b border-gray-200';

                if (cellIndex === 0) {
                    td.textContent = cellData;
                    td.classList.add('text-gray-700', 'font-semibold');
                } else if (cellIndex === 1) {
                    let iconText = '☀️';
                    const weather = cellData.weather || '';
                    const minTemp = cellData.minTemp || '--';
                    const maxTemp = cellData.maxTemp || '--';

                    if (weather.includes('暴雨') || weather.includes('大雨')) iconText = '⛈️';
                    else if (weather.includes('中雨')) iconText = '🌧️';
                    else if (weather.includes('小雨') || weather.includes('阵雨')) iconText = '🌦️';
                    else if (weather.includes('多云') || weather.includes('晴间多云')) iconText = '⛅';
                    else if (weather.includes('阴') || weather.includes('阴天')) iconText = '☁️';
                    else if (weather.includes('雪')) iconText = '❄️';
                    else if (weather.includes('雾') || weather.includes('霾')) iconText = '🌫️';

                    td.innerHTML = `<div class="flex flex-col items-center">
                        <div class="flex items-center space-x-2 mb-1"><div class="text-sm">${iconText}</div><div class="text-sx truncate">${weather}</div></div>
                        <div class="flex items-center space-x-2 text-sx"><div class="text-blue-500">${minTemp}</div><div>/</div><div class="text-red-500">${maxTemp}°C</div></div>
                    </div>`;
                    td.title = `${weather} ${minTemp} / ${maxTemp}°C`;
                } else if (cellIndex === 2) {
                    td.innerHTML = `<div class="text-xs truncate max-w-[60px]">${cellData.replace(/[\s<>]+/g, '')}</div>`;
                    td.classList.add('text-gray-600');
                    td.classList.remove('border-r');
                }
                row.appendChild(td);
            });
            tbody.appendChild(row);
        });

        table.appendChild(tbody);

        const borderedContainer = document.createElement('div');
        borderedContainer.className = 'border border-gray-300 rounded-lg overflow-hidden';
        borderedContainer.appendChild(table);
        tableContainer.appendChild(borderedContainer);

        container.innerHTML = '';
        tableWrapper.appendChild(tableContainer);
        container.appendChild(tableWrapper);

        this.adjustResponsive(); // 调用 this.adjustResponsive
    },

    /**
     * 响应式调整表格显示
     */
    adjustResponsive: function() {
        // ... (原 adjustTableResponsive 逻辑)
        const isMobile = window.innerWidth < 768;
        const table = document.querySelector('#recent-days-weather table');
        if (!table) return;
        const tds = table.querySelectorAll('td');
        if (isMobile) {
            tds.forEach(td => { td.style.fontSize = '12px'; });
        } else {
            tds.forEach(td => { td.style.fontSize = ''; });
        }
    }
};

/**
 * 3. 图表绘制层 (Charts)
 * 负责所有 Chart.js 图表绘制。
 */
window.WeatherModule.Charts = {
    /**
     * 绘制24小时天气折线图
     * @param {Array} hourlyData - 24小时数据
     */
    draw24Hour: function(hourlyData) {
        // ... (原 draw24HourChart 逻辑)
        const canvas = document.getElementById('24hour-chart');
        const chartContainer = document.getElementById('24hour-chart-container') || (canvas ? canvas.closest('.chart-container') : null);

        if (!canvas || !hourlyData || !Array.isArray(hourlyData) || hourlyData.length === 0) {
            logStep('错误: 图表容器或数据无效');
            if (chartContainer) chartContainer.style.display = 'none';
            else if (canvas) canvas.style.display = 'none';
            return;
        }

        if (chartContainer) chartContainer.style.display = 'block';
        else if (canvas) canvas.style.display = 'block';

        if (typeof Chart === 'undefined') {
            logStep('错误: Chart.js未加载');
            return;
        }

        if (window._weather24HourChart) {
            window._weather24HourChart.destroy();
        }

        const labels = hourlyData.map(hour => hour.hour ? String(hour.hour) : (hour.time || '').split(':')[0] || '');
        const temperatures = hourlyData.map(hour => hour.temperature !== undefined && hour.temperature !== null ? hour.temperature : null);

        // ... (纵坐标区间计算)
        let minY = 0; let maxY = 40;
        const validTemps = temperatures.filter(temp => temp !== null && !isNaN(temp));
        if (validTemps.length > 0) {
            const actualMin = Math.min(...validTemps);
            const actualMax = Math.max(...validTemps);
            minY = Math.floor(actualMin - 3);
            maxY = Math.ceil(actualMax + 3);
            const range = maxY - minY;
            if (range < 10) {
                const center = (actualMin + actualMax) / 2;
                minY = Math.floor(center - 5);
                maxY = Math.ceil(center + 5);
            }
            if (minY > -5) minY = Math.max(0, minY);
            if (maxY < 45) maxY = Math.min(40, maxY);
        }
        logStep(`24小时图表 纵坐标区间: ${minY}°C - ${maxY}°C`);

        // ... (创建图表)
        window._weather24HourChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '温度 (°C)', data: temperatures,
                    borderColor: '#FFA500', backgroundColor: 'rgba(255, 165, 0, 0.1)',
                    tension: 0.3, fill: true, pointRadius: 4, pointBackgroundColor: '#FFA500'
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: false, min: minY, max: maxY, grid: { color: 'rgba(0, 0, 0, 0.05)' } },
                    x: { grid: { display: false } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: function(tooltipItems) {
                                const label = tooltipItems[0].label;
                                return /^\d+$/.test(label) ? `${label}时` : label;
                            },
                            label: function(context) {
                                const hourData = hourlyData[context.dataIndex];
                                let tooltipContent = `${context.parsed.y || '--'}°C`;
                                if (hourData && hourData.weather) tooltipContent += `\t${hourData.weather.trim()}`;
                                if (hourData) tooltipContent += `\t${hourData.wind.trim().replace(/[\s<>]+/g, '')}`;
                                return tooltipContent;
                            }
                        }
                    }
                }
            }
        });
    },

    /**
     * 绘制气温趋势图表
     * @param {Array} dailyData - 多日天气数据
     */
    drawTrend: function(dailyData) {
        // ... (原 drawWeatherTrendChart 逻辑)
        const canvas = document.getElementById('weather-trend-chart');
        const chartContainer = document.getElementById('weather-trend-chart-container') || (canvas ? canvas.closest('.chart-container') : null);
        const trendSection = chartContainer ? chartContainer.closest('[id$="trend-section"]') || chartContainer.closest('.trend-section') : null;

        if (!canvas || !dailyData || !Array.isArray(dailyData) || dailyData.length === 0) {
            logStep('错误: 图表容器或数据无效');
            if (trendSection) trendSection.style.display = 'none';
            else if (chartContainer) chartContainer.style.display = 'none';
            else if (canvas) canvas.style.display = 'none';
            return;
        }

        if (trendSection) trendSection.style.display = 'block';
        else if (chartContainer) chartContainer.style.display = 'block';
        else if (canvas) canvas.style.display = 'block';

        if (typeof Chart === 'undefined') { logStep('错误: Chart.js未加载'); return; }

        const chartTitle = document.getElementById('weather-trend-title');
        if (chartTitle) chartTitle.textContent = '气温趋势';

        if (window._weatherTrendChart) {
            window._weatherTrendChart.destroy();
        }

        // ... (日期格式化)
        function formatDate(dateStr) {
            if (!dateStr || typeof dateStr !== 'string') return dateStr;
            if (dateStr.length === 8) return `${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
            if (dateStr.includes('-')) {
                const parts = dateStr.split('-');
                if (parts.length === 3) return `${parts[1]}-${parts[2]}`;
            }
            return dateStr;
        }

        // ... (数据准备)
        const labels = dailyData.map(day => day.date ? formatDate(day.date) : '');
        const actualMaxTemps = [], actualMinTemps = [], forecastMaxTemps = [], forecastMinTemps = [], historicalMaxTemps = [], historicalMinTemps = [];
        const allTemps = [];

        dailyData.forEach((item, index) => {
            const historyTempMax = item.historyTempMax || item.historyMax || item.historicalTempMax || item.historicalMax;
            const historyTempMin = item.historyTempMin || item.historyMin || item.historicalTempMin || item.historicalMin;
            const realTempMax = item.realTempMax || item.actualMax || item.realMax;
            const realTempMin = item.realTempMin || item.actualMin || item.realMin;
            const tempMax = item.tempMax || item.maxTemp || item.forecastMax;
            const tempMin = item.tempMin || item.minTemp || item.forecastMin;

            actualMaxTemps.push(realTempMax || null); actualMinTemps.push(realTempMin || null);
            if (realTempMax) allTemps.push(Number(realTempMax)); if (realTempMin) allTemps.push(Number(realTempMin));
            forecastMaxTemps.push(tempMax || null); forecastMinTemps.push(tempMin || null);
            if (tempMax) allTemps.push(Number(tempMax)); if (tempMin) allTemps.push(Number(tempMin));
            historicalMaxTemps.push(historyTempMax || null); historicalMinTemps.push(historyTempMin || null);
            if (historyTempMax) allTemps.push(Number(historyTempMax)); if (historyTempMin) allTemps.push(Number(historyTempMin));
        });

        // ... (纵坐标区间计算)
        let minY = 0; let maxY = 40;
        if (allTemps.length > 0) {
            const actualMin = Math.min(...allTemps.filter(temp => !isNaN(temp)));
            const actualMax = Math.max(...allTemps.filter(temp => !isNaN(temp)));
            minY = Math.floor(actualMin - 5);
            maxY = Math.ceil(actualMax + 5);
            if (minY > -10) minY = Math.max(0, minY);
            if (maxY < 45) maxY = Math.min(40, maxY);
        }
        logStep(`气温趋势图 固定纵坐标区间: ${minY}°C - ${maxY}°C`);

        // ... (创建图表)
        window._weatherTrendChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: '实况高温', data: actualMaxTemps, borderColor: '#FFA502', backgroundColor: 'rgba(255, 71, 87, 0.1)', borderWidth: 3, tension: 0.3, fill: false, pointRadius: 5, pointBackgroundColor: '#FFA502' },
                    { label: '实况低温', data: actualMinTemps, borderColor: '#4AD5F0', backgroundColor: 'rgba(30, 144, 255, 0.1)', borderWidth: 3, tension: 0.3, fill: false, pointRadius: 5, pointBackgroundColor: '#4AD5F0' },
                    { label: '预报高温', data: forecastMaxTemps, borderColor: '#FD5123', backgroundColor: 'rgba(255, 159, 67, 0.1)', borderWidth: 2, tension: 0.3, fill: false, pointRadius: 4, pointBackgroundColor: '#FD5123' },
                    { label: '预报低温', data: forecastMinTemps, borderColor: '#38AFD1', backgroundColor: 'rgba(22, 160, 133, 0.1)', borderWidth: 2, tension: 0.3, fill: false, pointRadius: 4, pointBackgroundColor: '#38AFD1' },
                    { label: '历史高温', data: historicalMaxTemps, borderColor: '#FCA087', backgroundColor: 'rgba(142, 68, 173, 0.1)', borderWidth: 2, borderDash: [5, 5], tension: 0.3, fill: false, pointRadius: 3, pointBackgroundColor: '#FCA087' },
                    { label: '历史低温', data: historicalMinTemps, borderColor: '#7DD0E9', backgroundColor: 'rgba(46, 134, 193, 0.1)', borderWidth: 2, borderDash: [5, 5], tension: 0.3, fill: false, pointRadius: 3, pointBackgroundColor: '#7DD0E9' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    tooltip: { mode: 'index', intersect: false, callbacks: { label: function(context) { return `${context.dataset.label}: ${context.parsed.y || '--'}°C`; } } },
                    legend: { labels: { usePointStyle: true, pointStyle: 'line' } }
                },
                scales: {
                    y: { beginAtZero: false, grid: { color: 'rgba(0, 0, 0, 0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }
};

/**
 * 4. 渲染总控制器
 * 负责协调数据和视图的更新流程。
 */
window.WeatherModule.MainController = {
    /**
     * 更新天气显示 (原 updateWeatherDisplay 逻辑)
     * @param {object} weatherData - 规范化后的天气数据
     */
    updateDisplay: function(weatherData) {
        logStep(`开始更新天气显示...`);
        if (!weatherData) {
            // 使用 View 模块的 showError
            window.WeatherModule.View.showError('获取到的天气数据为空');
            return;
        }
        try {
            // 隐藏错误信息
            const errorElement = document.getElementById('weather-error');
            if (errorElement) errorElement.style.display = 'none';

            // 显示天气面板
            const weatherContent = document.getElementById('weather-content');
            if (weatherContent) weatherContent.style.display = 'block';

            // --- 开始调用 View 和 Charts 模块 ---
            const View = window.WeatherModule.View;
            const Charts = window.WeatherModule.Charts;

            View.updateLinks(weatherData.mojiAreaCode, weatherData.weatherCode);

            const { todayWeather, calendarWeather, hourlyForecast, hourlyWeather, recentDaysWeather } = weatherData;

            let todayData = null;
            if (todayWeather) todayData = JSON.parse(JSON.stringify(todayWeather));

            // 强制更新今日天气
            if (todayData && (todayData.temperature || todayData.weather)) {
                View.updateToday(todayData);
            } else {
                logStep('错误: 没有找到有效的今日天气数据');
                View.showError('无法获取今日天气数据，请稍后重试');
                return;
            }

            // 获取24小时数据
            let hourlyData = null;
            if (hourlyWeather && Array.isArray(hourlyWeather)) hourlyData = hourlyWeather;
            else if (hourlyForecast && Array.isArray(hourlyForecast)) hourlyData = hourlyForecast;
            else if (todayData && todayData.hourlyWeather && Array.isArray(todayData.hourlyWeather)) hourlyData = todayData.hourlyWeather;
            else if (todayData && todayData.hourlyForecast && Array.isArray(todayData.hourlyForecast)) hourlyData = todayData.hourlyForecast;

            // 更新24小时天气摘要
            if (hourlyData) {
                View.updateHourlySummary(hourlyData);
            } else {
                const container = document.getElementById('hourly-weather-summary');
                if (container) container.innerHTML = '<div class="text-center text-gray-500">暂无24小时天气数据</div>';
            }

            // 绘制24小时温度变化图表
            if (hourlyData) {
                Charts.draw24Hour(hourlyData);
            } else {
                if (window._weather24HourChart) window._weather24HourChart.destroy();
                const chartContainer = document.getElementById('24hour-chart-container');
                if (chartContainer) chartContainer.innerHTML = '<div class="text-center text-gray-500 py-10">暂无24小时温度数据</div>';
            }

            // 更新近日天气横向表格
            if (recentDaysWeather) {
                View.updateRecentDays(recentDaysWeather);
            }

            // 更新天气日历
            if (calendarWeather) {
                View.updateCalendar(calendarWeather);
            }

            // 绘制天气趋势图表
            if (calendarWeather) {
                Charts.drawTrend(calendarWeather);
            }

            logStep('天气显示更新完成');
        } catch (error) {
            logStep(`错误: 更新天气显示时出错: ${error}`);
            window.WeatherModule.View.showError('天气数据处理错误，请稍后重试');
        }
    }
};

/**
 * 5. 节日初始化 (已在 window.WeatherModule 上下文中)
 */
window.WeatherModule.initFestivals = async function() {
    // ... (原 initFestivals 逻辑)
    try {
        window.allFestivals = [];
        window.calendarConfig = {
            currentYear: new Date().getFullYear(),
            currentMonth: new Date().getMonth(),
            festivals: [], holidays: {}, workdays: new Set()
        };

        // 假设 lunarUtils 已在全局 window 上
        try {
            const config = await window.lunarUtils.loadHolidayConfig();
            window.allFestivals = config.festivals || [];
            window.calendarConfig.festivals = window.allFestivals;
        } catch (error) {
            console.warn('使用lunarUtils加载节日配置失败，尝试直接获取配置:', error);
            const response = await fetch('/data/config/festival_config.json');
            if (response.ok) {
                const config = await response.json();
                window.allFestivals = config.festivals || [];
                window.calendarConfig.festivals = window.allFestivals;
            }
        }
    } catch (error) {
        console.error('加载节日配置时出错:', error);
        window.allFestivals = [];
        window.calendarConfig.festivals = [];
    }
};

/**
 * ----------------------------------------------------------------------
 * 公共 API 门面 (Facade)
 * ----------------------------------------------------------------------
 * 保留所有原始的全局函数，确保向后兼容。
 * 它们现在只作为调用内部 WeatherModule 逻辑的入口。
 */

/**
 * 加载天气数据 (核心入口)
 * @param {string} weatherCode - 天气代码
 * @param {string} mojiAreaCode - 墨迹区域代码
 * @param {number} [retryCount=0] - 重试次数
 */
function loadWeatherData(weatherCode, mojiAreaCode, retryCount = 0) {
    logStep(`加载天气数据，代码: ${weatherCode}, 墨迹编码: ${mojiAreaCode}, 重试次数: ${retryCount}`);

    if (!weatherCode) {
        logStep('错误: 缺少必要的天气代码参数');
        window.WeatherModule.View.showError('缺少必要的天气代码参数'); // 调用 View 模块
        return;
    }

    // 1. 显示加载
    window.WeatherModule.View.showLoading(true);

    let url = `${WEATHER_API.WEATHER_INFO}?weatherCode=${encodeURIComponent(weatherCode)}`;
    if (mojiAreaCode) {
        url += `&mojiAreaCode=${encodeURIComponent(mojiAreaCode)}`;
    }
    logStep(`发送天气数据请求: ${url}`);

    // 发送请求
    fetch(url, { cache: 'no-store' })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP错误，状态码: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            logStep(`成功获取天气数据: ${JSON.stringify(data).substring(0, 100)}...`);

            // 检查 API 返回的业务错误
            if (data && data.error) {
                logStep(`错误: API返回错误: ${data.error}`);
                window.WeatherModule.View.showError(data.error.message || '获取天气数据失败'); // 调用 View 模块
                return;
            }

            // 2. 使用 DataService 进行规范化
            let weatherData = window.WeatherModule.DataService.normalize(data);

            if (weatherData) {
                // 3. 使用 MainController 进行渲染
                window.WeatherModule.MainController.updateDisplay(weatherData);
            } else {
                // 规范化失败，数据格式无效，触发重试
                logStep(`错误: 返回的数据格式不符合预期或为空: ${JSON.stringify(data)}`);
                if (retryCount < 2) {
                    logStep(`尝试重新获取天气数据，当前重试次数: ${retryCount + 1}`);
                    setTimeout(() => {
                        loadWeatherData(weatherCode, mojiAreaCode, retryCount + 1); // 递归调用全局函数
                    }, 1000);
                } else {
                    window.WeatherModule.View.showError('获取天气数据失败，请稍后重试'); // 调用 View 模块
                }
            }
        })
        .catch(error => {
            logStep(`错误: 天气数据请求异常: ${error}`);
            let errorMessage = '天气数据请求异常，请检查网络连接';
            if (error.message && error.message.includes('HTTP错误')) {
                errorMessage = `服务器错误，请稍后重试`;
            }

            // 尝试重试
            if (retryCount < 2) {
                logStep(`因错误尝试重新获取天气数据，当前重试次数: ${retryCount + 1}`);
                setTimeout(() => {
                    loadWeatherData(weatherCode, mojiAreaCode, retryCount + 1); // 递归调用全局函数
                }, 1000);
            } else {
                window.WeatherModule.View.showError(errorMessage); // 调用 View 模块
            }
        })
        .finally(() => {
            // 4. 隐藏加载
            window.WeatherModule.View.showLoading(false);
        });
}

// --- 其他全局函数门面 ---
function adjustTableResponsive() {
    window.WeatherModule.View.adjustResponsive();
}

// 页面加载完成后初始化响应式调整
window.addEventListener('resize', adjustTableResponsive);
