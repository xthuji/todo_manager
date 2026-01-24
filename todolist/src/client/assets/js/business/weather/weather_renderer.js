/**
 * 天气数据渲染模块
 * 针对页面：天气信息展示页面
 * 业务功能模块：
 * 1. 天气数据获取与规范化处理
 * 2. 天气信息UI渲染（今日天气、预报、小时预报）
 * 3. 天气图表绘制与数据可视化
 * 4. 错误处理与加载状态管理
 * 5. 天气网站链接更新
 * 使用场景：
 * - 页面首次加载时显示当前位置天气
 * - 用户切换位置后重新渲染天气信息
 * - 定时刷新更新最新天气数据
 * - 展示天气相关图表和趋势数据
 * 架构设计：
 * 采用模块化设计，职责划分清晰：
 * - DataService: 负责数据处理和规范化
 * - View: 负责所有DOM相关的更新和辅助函数
 * - Charts: 负责所有Chart.js图表绘制
 * - MainController: 负责协调数据和视图的更新流程
 */

import "../common/holiday_manager.js";
import "../common/lunar_utils.js";
import {logStep} from "../common/base.js";

// 确保 WeatherModule 命名空间存在
if (typeof window.WeatherModule === 'undefined') {
    window.WeatherModule = {};
}

/**
 * 天气图标辅助功能
 */
window.WeatherModule.WeatherIconHelper = {
    /**
     * 根据天气文字获取对应的emoji图标
     * @param {string} weatherText - 天气文字描述
     * @returns {string} 对应的emoji图标
     */
    getWeatherIcon: function(weatherText) {
        if (!weatherText || typeof weatherText !== 'string') {
            return '⛅'; // 默认多云图标
        }
        
        const weather = weatherText.toLowerCase();
        
        // 更精确的天气图标匹配逻辑
        if (weather.includes('暴雨') || weather.includes('大雨')) return '🌧️';
        else if (weather.includes('中雨')) return '🌧️';
        else if (weather.includes('小雨') || weather.includes('阵雨')) return '🌧️';
        else if (weather.includes('雷阵雨') || weather.includes('雷')) return '⚡';
        else if (weather.includes('雾') || weather.includes('霾')) return '🌫️';
        else if (weather.includes('多云') || weather.includes('晴间多云')) return '⛅';
        else if (weather.includes('晴')) return '☀️';
        else if (weather.includes('阴') || weather.includes('阴天')) return '☁️';
        else if (weather.includes('雪')) return '❄️';
        else if (weather.includes('雨')) return '🌧️';
        else if (weather.includes('云')) return '☁️';
        
        return '⛅'; // 默认多云图标
    }
};

// 常量定义
const WEATHER_API = {
    WEATHER_INFO: '/api/weather/weather-info',
};

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
        // 统一只接受直接的天气数据对象格式
        // 不再尝试适配多种不同的数据格式
        logStep(`开始规范化天气数据，检查必要字段...`);

        // 处理错误情况 - 支持统一的错误格式 {error: {message: '错误信息'}}
        if (data.error) {
            const errorMessage = data.error.message || data.error || '获取天气数据失败';
            logStep(`错误: 天气数据获取失败: ${errorMessage}`);
            window.WeatherModule.View.showError(errorMessage);
            return null;
        }

        // 检查数据是否存在
        if (!data.data) {
            logStep(`错误: 天气数据为空`);
            window.WeatherModule.View.showError('天气数据为空');
            return null;
        }

        // 直接验证数据是否包含必要的天气信息字段
        if (typeof data.data === 'object') {
            // 验证数据有效性
            const weatherData = data.data;
            if (weatherData.todayWeather || weatherData.calendarWeather || weatherData.recentDaysWeather) {
                logStep(`数据格式验证通过`);
                return weatherData;
            }
        }

        logStep(`错误: 规范化失败，数据格式不符合预期: ${JSON.stringify(data || {}).substring(0, 100)}...`);
        window.WeatherModule.View.showError('获取到的数据格式不正确');
        return null; // 不符合预期的统一格式
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
        const element = $('#' + elementId);
        if (element.length > 0) {
            element.text((value !== undefined && value !== null && value !== '' && value !== '--' && value !== '-')
                ? value + unit
                : '--' + unit);
        }
    },

    /**
     * 显示加载状态
     * @param {boolean} isLoading - 是否显示加载
     */
    showLoading: function(isLoading) {
        const loadingElement = $('#weather-loading');
        const weatherContent = $('#weather-content');

        if (loadingElement.length > 0) {
            loadingElement.css('display', isLoading ? 'block' : 'none');
        }
        if (weatherContent.length > 0) {
            weatherContent.css('display', isLoading ? 'none' : 'block');
        }
    },

    /**
     * 显示天气错误信息
     * @param {string} message - 错误信息
     */
    showError: function(message) {
        const errorElement = $('#weather-error');
        const weatherContent = $('#weather-content');
        const weatherLoading = $('#weather-loading');

        if (errorElement.length > 0) {
            errorElement.text(message);
            errorElement.css('display', 'block');
        }
        if (weatherContent.length > 0) {
            weatherContent.css('display', 'none');
        }
        if (weatherLoading.length > 0) {
            weatherLoading.css('display', 'none');
        }
        logStep(`错误: 天气数据显示错误: ${message}`);
    },

    /**
     * 更新天气网站链接
     * @param {string} weatherData - 天气数据
     */
    updateLinks: function(weatherData) {
        // 从weatherData对象中获取编码信息
        const weatherCode = weatherData.weatherCode || '';
        let mojiAreaCode = weatherData.mojiAreaCode || '';
        let nmcAreaCode = weatherData.nmcAreaCode || '';
        let cmaAreaCode = weatherData.cmaAreaCode || '';
        logStep(`更新天气网站链接: weatherCode=${weatherCode}, mojiAreaCode=${mojiAreaCode}, nmcAreaCode=${nmcAreaCode}, cmaAreaCode=${cmaAreaCode}`);

        const weatherComCnLink = $('#weather-com-cn-link');
        if (weatherComCnLink.length > 0) {
            if (weatherCode) {
                weatherComCnLink.attr('href', `https://forecast.weather.com.cn/town/weather1dn/${weatherCode}.shtml`);
                weatherComCnLink.attr('title', `中国天气网 - ${weatherCode}`);
            } else {
                weatherComCnLink.attr('href', 'https://forecast.weather.com.cn/');
                weatherComCnLink.attr('title', '中国天气网');
            }
        }

        const mojiLink = $('#moji-link');
        if (mojiLink.length > 0) {
            if (mojiAreaCode) {
                mojiLink.attr('href', `https://tianqi.moji.com/weather/china/${mojiAreaCode}`);
                mojiLink.attr('title', `墨迹天气 - ${mojiAreaCode}`);
            } else {
                mojiLink.attr('href', 'https://tianqi.moji.com/');
                mojiLink.attr('title', '墨迹天气');
            }
        }

        const nmcLink = $('#nmc-link');
        if (nmcLink.length > 0) {
            if (nmcAreaCode) {
                nmcLink.attr('href', `https://www.nmc.cn/publish/forecast/${nmcAreaCode}.html`);
                nmcLink.attr('title', `中央气象台 - ${nmcAreaCode}`);
            } else {
                nmcLink.attr('href', 'https://www.nmc.cn/publish/forecast/ABJ/beijing.html');
                nmcLink.attr('title', '中央气象台');
            }
        }

        const cmaLink = $('#cma-link');
        if (cmaLink.length > 0) {
            if (cmaAreaCode) {
                cmaLink.attr('href', `https://weather.cma.cn/web/weather/${cmaAreaCode}.html`);
                cmaLink.attr('title', `中国气象局 - ${cmaAreaCode}`);
            } else {
                cmaLink.attr('href', 'https://weather.cma.cn/');
                cmaLink.attr('title', '中国气象局');
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

        // 注意：内部调用 helpers
        const safeUpdate = this.safeUpdate; // 使用 this.safeUpdate

        const currentWeatherInfo = $('#current-weather-info');
        if (currentWeatherInfo.length > 0) {
            currentWeatherInfo.remove();
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
        
        // 处理日出日落时间显示
        const sunriseSunsetElement = $('#sunrise-sunset');
        if (sunriseSunsetElement.length > 0) {
            if (todayWeather.sunrise && todayWeather.sunset) {
                // 显示日出日落时间
                safeUpdate('sunrise-time', todayWeather.sunrise);
                safeUpdate('sunset-time', todayWeather.sunset);
                sunriseSunsetElement.removeClass('hidden');
            } else {
                // 隐藏日出日落区域
                sunriseSunsetElement.addClass('hidden');
            }
        }

        // ... (动态注入 CSS 的逻辑 - 建议将此 CSS 移至主样式表)
        let extraInfoContainer = $('#weather-extra-info');
        if (extraInfoContainer.length === 0) {
            extraInfoContainer = $('<div>').attr('id', 'weather-extra-info').attr('class', 'weather-extra-info');

            const style = $('<style>').text(`
                .weather-extra-info {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 10px; margin-top: 15px; padding: 15px;
                    background-color: #f8f9fa; border-radius: 8px; font-size: 14px;
                }
                .extra-info-item { display: flex; flex-direction: column; gap: 5px; }
                .extra-info-label { color: #6c757d; font-size: 12px; }
                .extra-info-value { color: #212529; font-weight: 500; }
            `);
            $('head').append(style);

            const todayWeatherSection = $('#today-weather-section');
            if (todayWeatherSection.length > 0) {
                todayWeatherSection.append(extraInfoContainer);
            }
        }
        // ... (innerHTML 更新逻辑)
        extraInfoContainer.html(`
            <div class="extra-info-item"><div class="extra-info-label">更新时间</div><div class="extra-info-value">${time}</div></div>
            <div class="extra-info-item"><div class="extra-info-label">能见度</div><div class="extra-info-value">${(todayWeather.visibility || '--')}</div></div>
            <div class="extra-info-item"><div class="extra-info-label">限行提示</div><div class="extra-info-value">${(todayWeather.limit || '--')}</div></div>
            <div class="extra-info-item"><div class="extra-info-label">今日提示</div><div class="extra-info-value">${(todayWeather.tips || '暂无提示')}</div></div>
        `);

        const weatherIcon = $('#weather-icon');
        if (weatherIcon.length > 0 && (todayWeather.weather || '--')) {
            // 使用公共的getWeatherIcon函数获取emoji图标
            const emojiIcon = WeatherModule.WeatherIconHelper.getWeatherIcon(todayWeather.weather);
            
            // 直接设置innerHTML为emoji图标，移除FontAwesome相关逻辑
            weatherIcon.html(emojiIcon);
            
            // 保留基础样式类
            weatherIcon.attr('class', 'text-6xl mb-2');
        }

        const todayWeatherSection = $('#today-weather-section');
        if (todayWeatherSection.length > 0) {
            todayWeatherSection.css('display', 'block');
        }

        if (todayWeather.lifeHelper) {
            this.updateLifeHelper(todayWeather.lifeHelper); // 调用 this.updateLifeHelper
        }

        const weatherArea = $('#weather-area');
        if (weatherArea.length > 0) {
            // 清除所有背景相关的类名，包括渐变类
            let className = weatherArea.attr('class').replace(/(bg-[\w-]+|from-[\w-]+|to-[\w-]+)/g, '').trim();
            weatherArea.attr('class', className + ' ' + this.getBgColor(todayWeather.weather || '--')); // 调用 this.getBgColor
        }
    },

    /**
     * 更新生活指数信息
     * @param {Array} lifeHelperData - 生活指数数据
     */
    updateLifeHelper: function(lifeHelperData) {
        // ... (原 updateLifeHelper 逻辑)
        const container = $('#life-helper-container');
        if (container.length === 0 || !Array.isArray(lifeHelperData)) {
            return;
        }
        container.empty();
        const lifeHelperIcons = { '紫外线': 'fa-sun-o', '感冒': 'fa-stethoscope', '穿衣': 'fa-shopping-bag', '洗车': 'fa-car', '运动': 'fa-soccer-ball-o', '空气污染扩散': 'fa-plus-circle' };
        const lifeHelperColors = { '优': 'text-green-600', '良': 'text-blue-600', '中等': 'text-yellow-600', '较易发': 'text-orange-600', '适宜': 'text-green-600', '不适宜': 'text-red-600', '较舒适': 'text-blue-600' };

        // 使用模板渲染
        const lifeHelperTemplate = $('#life-helper-item-template');
        const useTemplate = lifeHelperTemplate.length > 0;

        lifeHelperData.forEach(item => {
            let lifeHelperItem;
            if (useTemplate) {
                // 使用模板克隆
                lifeHelperItem = $(lifeHelperTemplate.html());
                lifeHelperItem.css('height', '100%');
                lifeHelperItem.attr('title', item.desc);
                
                // 填充数据
                const iconElement = lifeHelperItem.find('i');
                const titleElement = lifeHelperItem.find('span.text-sm.font-medium');
                const valueElement = lifeHelperItem.find('span.text-sm.font-semibold');
                const descElement = lifeHelperItem.find('div.text-xs.text-gray-500');
                
                const iconClass = lifeHelperIcons[item.title] || 'fa-question-circle';
                const colorClass = lifeHelperColors[item.value] || 'text-gray-600';
                
                if (iconElement.length > 0) iconElement.attr('class', `fa ${iconClass} text-primary w-3 mr-2`);
                if (titleElement.length > 0) titleElement.text(item.title);
                if (valueElement.length > 0) {
                    valueElement.text(item.value);
                    valueElement.attr('class', `text-sm font-semibold ${colorClass}`);
                }
                if (descElement.length > 0) descElement.text(item.desc);
            } else {
                // 回退到原来的创建方式
                lifeHelperItem = $('<div>').attr('class', 'bg-white p-3 rounded-lg shadow-sm flex flex-col justify-between');
                lifeHelperItem.css('height', '100%');
                lifeHelperItem.attr('title', item.desc);
                const iconClass = lifeHelperIcons[item.title] || 'fa-question-circle';
                const colorClass = lifeHelperColors[item.value] || 'text-gray-600';
                lifeHelperItem.html(`
                    <div class="flex items-center justify-between mb-1">
                        <div class="flex items-center">
                            <i class="fa ${iconClass} text-primary w-3 mr-2"></i>
                            <span class="text-sm font-medium text-gray-700">${item.title}</span>
                        </div>
                        <span class="text-sm font-semibold ${colorClass}">${item.value}</span>
                    </div>
                    <div class="text-xs text-gray-500 break-all">${item.desc}</div>
                `);
            }
            container.append(lifeHelperItem);
        });
    },

    /**
     * 更新24小时天气摘要
     * @param {Array} hourlyData - 24小时数据
     */
    updateHourlySummary: function(hourlyData) {
        const container = $('#hourly-weather-summary');
        const hourlyWeatherSection = container.length > 0 ? container.closest('[id$="hourly-weather-section"], .hourly-weather-section') : null;

        if (container.length === 0 || !hourlyData || !Array.isArray(hourlyData) || hourlyData.length === 0) {
            if (hourlyWeatherSection && hourlyWeatherSection.length > 0) hourlyWeatherSection.css('display', 'none');
            else if (container.length > 0) container.css('display', 'none');
            return;
        }

        if (hourlyWeatherSection && hourlyWeatherSection.length > 0) hourlyWeatherSection.css('display', 'block');
        container.css({
            'display': 'flex',
            'overflowX': 'auto',
            'whiteSpace': 'nowrap',
            'scrollbarWidth': 'thin',
            'marginBottom': '0',
            'paddingBottom': '10px',
            'userSelect': 'none'
        });
        container.empty();

        // 滚动同步逻辑
        container.on('scroll', () => {
            const chartContainer = $('#24hour-chart-container');
            if (chartContainer.length > 0) chartContainer.scrollLeft(container.scrollLeft());
        });
        const chartContainer = $('#24hour-chart-container');
        if (chartContainer.length > 0) {
            chartContainer.css({
                'overflowX': 'auto',
                'scrollbarWidth': 'thin'
            });
            chartContainer.on('scroll', () => {
                container.scrollLeft(chartContainer.scrollLeft());
            });
        }

        const currentHour = new Date().getHours();

        // 查找前半部分的当前小时匹配
        let currentHourMatchIndex = -1;
        const halfLength = hourlyData.length / 2;
        
        // 只在前半部分查找当前小时的匹配
        for (let i = 0; i < halfLength; i++) {
            const item = hourlyData[i];
            if (!item) continue;
            
            let hourValue = null;
            if (item.hour !== undefined) hourValue = parseInt(item.hour);
            else if (item.time) {
                const timeStr = String(item.time);
                const hourMatch = timeStr.match(/^(\d{1,2})/);
                if (hourMatch) hourValue = parseInt(hourMatch[1]);
            }
            
            if (hourValue === currentHour) {
                currentHourMatchIndex = i;
                break;
            }
        }
        
        // 如果列表长度大于20且前半部分没有找到当前小时，使用第一个条目
        const useFirstAsCurrent = hourlyData.length > 20 && currentHourMatchIndex === -1;
        
        hourlyData.forEach((hourData, index) => {
            if (!hourData) return;
            
            // 简化的当前小时判断逻辑
            let isCurrentHour = false;
            
            // 如果在前半部分找到了匹配的索引
            if (index === currentHourMatchIndex) {
                isCurrentHour = true;
            }
            // 或者使用第一个条目作为当前小时
            else if (index === 0 && useFirstAsCurrent) {
                isCurrentHour = true;
            }
            // 默认为第一个条目（当没有找到匹配时）
            else if (index === 0 && currentHourMatchIndex === -1) {
                isCurrentHour = true;
            }

            let hourElement;
            // 使用模板渲染
            const hourlyTemplate = $('#hourly-weather-item-template');
            const useTemplate = hourlyTemplate.length > 0;

            if (useTemplate) {
                // 使用模板克隆
                hourElement = $(hourlyTemplate.html());
                const baseClasses = 'inline-flex flex-col items-center justify-center p-1 bg-gray-50 rounded-lg text-center min-w-[70px] max-w-[70px]';
                hourElement.attr('class', isCurrentHour ? `${baseClasses} border-2 border-blue-400 bg-blue-50` : baseClasses);
                
                // 填充数据
                const timeElement = hourElement.find('div.text-xs.font-medium');
                const iconElement = hourElement.find('div.text-xl');
                const conditionElement = hourElement.find('div.text-gray-600');
                const windElement = hourElement.find('div.text-gray-500');
                const tempElement = hourElement.find('div.text-sm.font-medium');
                
                if (timeElement.length > 0) timeElement.text(hourData.hour ? `${hourData.hour}时` : (hourData.time || '').replace(':', '时'));
                
                // 使用公共的getWeatherIcon函数获取emoji图标
                const iconText = WeatherModule.WeatherIconHelper.getWeatherIcon(hourData.weather);
                if (iconElement.length > 0) iconElement.text(iconText);
                
                if (conditionElement.length > 0) conditionElement.text(hourData.weather || '--');
                if (windElement.length > 0) windElement.text((hourData.wind || '--').trim().replace(/[\s<>]+/g, ''));
                if (tempElement.length > 0) tempElement.text(`${hourData.temperature || '--'}°C`);
            } else {
                // 回退到原来的创建方式
                hourElement = $('<div>');
                const baseClasses = 'inline-flex flex-col items-center justify-center p-1 bg-gray-50 rounded-lg text-center min-w-[70px] max-w-[70px]';
                hourElement.attr('class', isCurrentHour ? `${baseClasses} border-2 border-blue-400 bg-blue-50` : baseClasses);

                const time = $('<div>').attr('class', 'text-xs font-medium text-gray-700 mb-1')
                    .text(hourData.hour ? `${hourData.hour}时` : (hourData.time || '').replace(':', '时'));

                const icon = $('<div>').attr('class', 'text-xl my-1 text-center');
                // 使用公共的getWeatherIcon函数获取emoji图标
                const iconText = WeatherModule.WeatherIconHelper.getWeatherIcon(hourData.weather);
                icon.text(iconText);

                const condition = $('<div>').attr('class', 'text-[10px] text-gray-600 mb-1 truncate')
                    .text(hourData.weather || '--');

                const wind = $('<div>').attr('class', 'text-[9px] text-gray-500 mb-1')
                    .text((hourData.wind || '--').trim().replace(/[\s<>]+/g, ''));

                const temp = $('<div>').attr('class', 'text-sm font-medium text-gray-800')
                    .text(`${hourData.temperature}°C`);

                hourElement.append(time)
                    .append(icon)
                    .append(condition)
                    .append(wind)
                    .append(temp);
            }

            hourElement.css('width', '75px'); // 确保宽度

            // 自动滚动逻辑
            setTimeout(() => {
                if (hourElement && isCurrentHour && hourElement[0]) {
                    console.log('自动滚动到当前时段数据');
                    let parent = hourElement.parent();
                    let containerFound = false;
                    while (parent && parent !== $('body') && !containerFound && parent[0]) {
                        const isScrollable = parent[0].scrollWidth > parent[0].clientWidth || parent[0].scrollHeight > parent[0].clientHeight;
                        if (isScrollable) {
                            const rect = hourElement[0].getBoundingClientRect();
                            const parentRect = parent[0].getBoundingClientRect();
                            const scrollX = parent[0].scrollLeft + (rect.left - parentRect.left) - (parent[0].clientWidth / 2) + (rect.width / 2);
                            const maxScroll = parent[0].scrollWidth - parent[0].clientWidth;
                            const safeScrollX = Math.max(0, Math.min(scrollX, maxScroll));
                            parent[0].scrollTo({ left: safeScrollX, behavior: 'smooth' });
                            containerFound = true;
                        }
                        parent = parent.parent();
                    }
                }
            }, 500);

            container.append(hourElement);
        });
    },

    /**
     * 更新天气日历
     * @param {Array} calendarWeather - 日历天气数据
     */
    updateCalendar: function(calendarWeather) {
        // ... (原 updateCalendarWeather 逻辑)
        const calendarContainer = $('#weather-calendar');
        const calendarSection = calendarContainer.length > 0 ? calendarContainer.closest('[id$="calendar-section"], .calendar-section') : null;

        if (calendarContainer.length === 0) {
            logStep('错误: 日历容器元素不存在');
            return;
        }

        if (!calendarWeather || !Array.isArray(calendarWeather) || calendarWeather.length === 0) {
            if (calendarSection && calendarSection.length > 0) calendarSection.css('display', 'none');
            else {
                calendarContainer.html('<div class="no-data-message">暂无日历天气数据</div>');
                calendarContainer.css('display', 'block');
            }
            return;
        }

        if (calendarSection && calendarSection.length > 0) calendarSection.css('display', 'block');
        calendarContainer.css('display', 'block');
        calendarContainer.empty();

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
        const weekHeader = $('<div>').attr('class', 'flex justify-between mb-2').css('width', '100%');
        ['周一', '周二', '周三', '周四', '周五', '周六', '周日'].forEach(day => {
            const dayHeader = $('<div>').attr('class', 'text-center text-sm font-medium text-gray-700 flex-1').text(day);
            weekHeader.append(dayHeader);
        });
        calendarContainer.append(weekHeader);

        const gridContainer = $('<div>').attr('class', 'grid grid-cols-7 gap-1').css('width', '100%');
        calendarContainer.append(gridContainer);

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
            let cell;
            // 使用模板渲染
            const calendarTemplate = $('#weather-calendar-item-template');
            const useTemplate = calendarTemplate.length > 0;

            if (useTemplate) {
                // 使用模板克隆
                cell = $(calendarTemplate.html());
            } else {
                // 回退到原来的创建方式
                cell = $('<div>').attr('class', 'min-h-[100px] p-1 border border-gray-200 rounded');
            }

            const dateOffset = cellIndex - leadingEmptyCells;
            const isCurrentMonth = dateOffset >= 0 && dateOffset < daysInMonth;
            const isWeekend = cellIndex % 7 === 5 || cellIndex % 7 === 6;

            if (!isCurrentMonth) {
                cell.css('backgroundColor', '#f8f8f8');
                // 非本月日期显示为空
                if (useTemplate) {
                    // 清空模板中的所有内容
                    const dateElements = cell.find('div.text-sm, div.text-xl, div.text-xs');
                    dateElements.each(function() {
                        $(this).text('');
                    });
                } else {
                    // 创建一个空的日期元素
                    const emptyDate = $('<div>').attr('class', 'text-sm');
                    cell.append(emptyDate);
                }
            } else {
                const currentDate = new Date(firstDateOfMonth);
                currentDate.setDate(currentDate.getDate() + dateOffset);
                const formattedCurrentDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
                const dayCount = currentDate.getDate();
                const isToday = formattedCurrentDate === todayStr;
                const dayData = dateToDataMap.get(formattedCurrentDate);

                if (isToday) cell.attr('class', 'min-h-[100px] p-1 border-2 border-blue-400 rounded bg-blue-50');
                else if (isWeekend) cell.css('backgroundColor', '#e0f2fe');

                let dateAndFestivalContainer, dateNumber, festivalContainer;
                if (useTemplate) {
                    dateAndFestivalContainer = cell.find('div.flex.items-center');
                    if (dateAndFestivalContainer.length > 0) {
                        dateNumber = dateAndFestivalContainer.find('div.text-sm');
                        festivalContainer = dateAndFestivalContainer.find('div.whitespace-nowrap');
                    } else {
                        // 如果模板中没有找到元素，创建新的元素
                        dateAndFestivalContainer = $('<div>').attr('class', 'flex items-center justify-between w-full');
                        dateNumber = $('<div>').attr('class', 'text-sm');
                        festivalContainer = $('<div>').attr('class', 'whitespace-nowrap');
                        dateAndFestivalContainer.append(dateNumber);
                        dateAndFestivalContainer.append(festivalContainer);
                        cell.append(dateAndFestivalContainer);
                    }
                } else {
                    dateAndFestivalContainer = $('<div>').attr('class', 'flex items-center justify-between w-full');
                    dateNumber = $('<div>').attr('class', 'text-sm');
                    festivalContainer = $('<div>').attr('class', 'whitespace-nowrap');
                    dateAndFestivalContainer.append(dateNumber);
                    dateAndFestivalContainer.append(festivalContainer);
                    cell.append(dateAndFestivalContainer);
                }

                // 根据日期类型设置字体颜色
                // 获取日期类型信息（参考calendar_view.js的逻辑）
                let isHoliday = false;
                let isWorkday = false;
                try {
                    if (window.holidayManager) {
                        const dateType = window.holidayManager.getDateType(currentDate);
                        isHoliday = dateType === 'holiday';
                        isWorkday = dateType === 'workday';
                    }
                } catch (error) { console.error('获取日期类型失败:', error); }
                
                // 设置日期数字样式和颜色
                if (dateNumber.length > 0) {
                    if (isToday) {
                        dateNumber.attr('class', 'text-sm border-2 border-blue-500 rounded-full w-6 h-6 flex items-center justify-center text-blue-600 font-bold');
                    }
                    // 关键逻辑：放假的日期（节假日或非补班周末）设为红色，工作的日期设为黑色
                    if (isHoliday || (isWeekend && !isWorkday)) {
                        dateNumber.css('color', '#dc2626'); // 红色
                    } else {
                        dateNumber.css('color', '#111827'); // 黑色
                    }
                    dateNumber.text(dayCount);
                }

                // ... (节日标记)
                try {
                    if (festivalContainer.length > 0) {
                        festivalContainer.empty();
                        // 假设 lunarUtils 已在全局 window 上
                        if (dayData && dayData.dateObj && window.lunarUtils) {
                            const festivalsForDay = window.lunarUtils.getFestivalsSync(dayData.dateObj, 1);
                            if (festivalsForDay && Array.isArray(festivalsForDay) && festivalsForDay.length > 0) {
                                festivalsForDay.forEach(festival => {
                                    if (festival && festival.name) {
                                        const festivalTag = $('<div>');
                                        let festivalTypeClass = window.lunarUtils.getFestivalTypeClass(festival.type);
                                        festivalTag.attr('class', `festival-tag ${festivalTypeClass}`);
                                        festivalTag.text(festival.name);
                                        festivalContainer.append(festivalTag);
                                    }
                                });
                            }
                        }
                    }
                } catch (error) { console.error('获取节日信息失败:', error); }

                // ... (天气信息)
                if (dayData) {
                    let shortWeather = dayData.weather || '--';
                    if (shortWeather.length > 2 && shortWeather.includes('转')) shortWeather = shortWeather.split('转')[0];
                    
                    let iconElement, weatherElement, windElement, tempRangeElement;
                    if (useTemplate) {
                        // 更精确地选择元素，避免选择到错误的元素
                        iconElement = cell.find('div.text-xl');
                        weatherElement = cell.find('div.text-xs.text-gray-600').eq(0); // 选择第一个天气描述元素
                        windElement = cell.find('div.text-xs.text-gray-600').eq(1); // 选择第二个风力描述元素
                        tempRangeElement = cell.find('div.text-xs:not(.text-gray-600)');
                        
                        // 如果模板中没有找到元素，创建新的元素
                        if (iconElement.length === 0) {
                            iconElement = $('<div>').attr('class', 'text-xl my-1 text-center');
                            cell.append(iconElement);
                        }
                        if (weatherElement.length === 0) {
                            weatherElement = $('<div>').attr('class', 'text-xs text-gray-600 mb-1 text-center truncate');
                            cell.append(weatherElement);
                        }
                        if (windElement === null || windElement.length === 0) {
                            windElement = $('<div>').attr('class', 'text-xs text-gray-600 mb-1 text-center truncate');
                            cell.append(windElement);
                        }
                        if (tempRangeElement.length === 0) {
                            tempRangeElement = $('<div>').attr('class', 'text-xs');
                            cell.append(tempRangeElement);
                        }
                    } else {
                        iconElement = $('<div>').attr('class', 'text-xl my-1 text-center');
                        weatherElement = $('<div>').attr('class', 'text-xs text-gray-600 mb-1 text-center truncate');
                        windElement = $('<div>').attr('class', 'text-xs text-gray-600 mb-1 text-center truncate');
                        tempRangeElement = $('<div>').attr('class', 'text-xs');
                    }
                    
                    // 使用公共的getWeatherIcon函数获取emoji图标
                    const iconText = WeatherModule.WeatherIconHelper.getWeatherIcon(shortWeather);
                    if (iconElement.length > 0) iconElement.text(iconText);
                    
                    if (weatherElement.length > 0) weatherElement.text(shortWeather);
                    
                    if (windElement && windElement.length > 0 && dayData.wind) {
                        windElement.text(dayData.wind || '--');
                    } else if (windElement && windElement.length > 0) {
                        // 如果没有风力数据，清空第二个元素
                        windElement.text('');
                    }
                    
                    const maxTemp = dayData.tempMax || dayData.realTempMax || '--';
                    const minTemp = dayData.tempMin || dayData.realTempMin || '--';
                    
                    if (tempRangeElement.length > 0) {
                        if (useTemplate) {
                            let minTempElement = tempRangeElement.find('span.text-gray-700');
                            let maxTempElement = tempRangeElement.find('span.text-gray-900');
                            
                            // 如果模板中没有找到温度元素，创建新的元素
                            if (minTempElement.length === 0 || maxTempElement.length === 0) {
                                // 清空现有的内容
                                tempRangeElement.empty();
                                
                                // 创建新的温度范围HTML
                                tempRangeElement.html(`<span class="text-gray-700">${minTemp}</span> / <span class="text-gray-900">${maxTemp}°C</span>`);
                            } else {
                                // 使用现有的元素
                                minTempElement.text(minTemp);
                                maxTempElement.text(`${maxTemp}°C`);
                            }
                        } else {
                            tempRangeElement.html(`<span class="text-gray-700">${minTemp}</span> / <span class="text-gray-900">${maxTemp}°C</span>`);
                        }
                    }

                    if (!useTemplate) {
                        if (iconElement.length > 0) cell.append(iconElement);
                        if (weatherElement.length > 0) cell.append(weatherElement);
                        if (windElement && windElement.length > 0 && dayData.wind) {
                            cell.append(windElement);
                        }
                        if (tempRangeElement.length > 0) cell.append(tempRangeElement);
                    }
                } else {
                    if (!useTemplate) {
                        const noData = $('<div>').attr('class', 'text-[10px] text-gray-400 text-center').text('暂无数据');
                        cell.append(noData);
                    }
                }
            }
            gridContainer.append(cell);
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
            let row;
            // 使用模板渲染
            const recentDaysTemplate = document.getElementById('recent-days-weather-item-template');
            const useTemplate = !!recentDaysTemplate;

            if (useTemplate) {
                // 使用模板克隆
                row = recentDaysTemplate.content.cloneNode(true).firstElementChild;
                const isToday = index === 0;
                row.className = 'h-7' + (isToday ? ' bg-blue-50' : '');
            } else {
                // 回退到原来的创建方式
                row = document.createElement('tr');
                const isToday = index === 0;
                row.className = 'h-7' + (isToday ? ' bg-blue-50' : '');
            }

            let dateStr = dayData.date || '';
            if (dateStr.length === 8) {
                dateStr = `${dateStr.substring(4, 6).replace(/^0/, '')}/${dateStr.substring(6, 8).replace(/^0/, '')}`;
            }

            if (useTemplate) {
                // 填充数据
                const dateCell = row.querySelector('td:first-child');
                const weatherCell = row.querySelector('td:nth-child(2)');
                const windCell = row.querySelector('td:nth-child(3)');
                
                if (dateCell) dateCell.textContent = dateStr;
                
                // 使用公共的getWeatherIcon函数获取emoji图标
                const iconText = WeatherModule.WeatherIconHelper.getWeatherIcon(dayData.weather);
                const minTemp = dayData.tempMin || '--';
                const maxTemp = dayData.tempMax || '--';
                const weather = dayData.weather || '';

                const iconElement = weatherCell ? weatherCell.querySelector('div.text-sm') : null;
                const weatherElement = weatherCell ? weatherCell.querySelector('div.text-xs') : null;
                const minTempElement = weatherCell ? weatherCell.querySelector('div.text-blue-500') : null;
                const maxTempElement = weatherCell ? weatherCell.querySelector('div.text-red-500') : null;
                
                if (iconElement) iconElement.textContent = iconText;
                if (weatherElement) weatherElement.textContent = weather;
                if (minTempElement) minTempElement.textContent = minTemp;
                if (maxTempElement) maxTempElement.textContent = `${maxTemp}°C`;
                
                if (weatherCell) weatherCell.title = `${weather} ${minTemp} / ${maxTemp}°C`;
                
                // 将有'转'字的内容换行显示
                const windElement = windCell ? windCell.querySelector('div.text-xs') : null;
                if (windElement) windElement.innerHTML = (dayData.wind || '--').replace(/[\s<>]+/g, '').replace(/转/g, '<br>转');
            } else {
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
                        // 使用公共的getWeatherIcon函数获取emoji图标
                        const iconText = WeatherModule.WeatherIconHelper.getWeatherIcon(cellData.weather);
                        const minTemp = cellData.minTemp || '--';
                        const maxTemp = cellData.maxTemp || '--';
                        const weather = cellData.weather || '';

                        td.innerHTML = `<div class="flex flex-col items-center">
                            <div class="flex items-center space-x-2 mb-1"><div class="text-sm">${iconText}</div><div class="text-sx truncate">${weather}</div></div>
                            <div class="flex items-center space-x-2 text-sx"><div class="text-blue-500">${minTemp}</div><div>/</div><div class="text-red-500">${maxTemp}°C</div></div>
                        </div>`;
                        td.title = `${weather} ${minTemp} / ${maxTemp}°C`;
                    } else if (cellIndex === 2) {
                        // 将有'转'字的内容换行显示
                        td.innerHTML = `<div class="text-xs truncate max-w-[60px]">${cellData.replace(/[\s<>]+/g, '').replace(/转/g, '<br>转')}</div>`;
                        td.classList.add('text-gray-600');
                        td.classList.remove('border-r');
                    }
                    row.appendChild(td);
                });
            }
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
            
            // 获取今天的日期并格式化为YYYYMMDD形式
            const today = new Date();
            const todayStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
            
            // 检查是否是今天
            if (dateStr === todayStr) return '今天';
            
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

            View.updateLinks(weatherData);

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
        // 使用lunar_utils.js中封装的loadHolidayConfig函数获取节日数据
        await window.lunarUtils.loadHolidayConfig();
        // 获取并缓存法定节假日数据
        await window.holidayManager.getHolidayData();
    } catch (error) {
        console.error('加载节日数据时出错:', error);
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
 * @param {number} [retryCount=0] - 重试次数
 */
function loadWeatherData(weatherCode, retryCount = 0) {
    logStep(`加载天气数据，代码: ${weatherCode}, 重试次数: ${retryCount}`);

    if (!weatherCode) {
        logStep('错误: 缺少必要的天气代码参数');
        window.WeatherModule.View.showError('缺少必要的天气代码参数'); // 调用 View 模块
        return;
    }

    // 1. 显示加载
    window.WeatherModule.View.showLoading(true);

    let url = `${WEATHER_API.WEATHER_INFO}?weatherCode=${encodeURIComponent(weatherCode)}`;
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
            if (!data || data.error) {
                const errorMessage = data?.error.message || data?.error || '获取天气数据失败';
                logStep(`错误: API返回错误: ${errorMessage}`);
                window.WeatherModule.View.showError(errorMessage); // 调用 View 模块
                return;
            }

            // 2. 使用 DataService 进行规范化
            let weatherData = window.WeatherModule.DataService.normalize(data);

            if (weatherData) {
                // 3.将地区编码信息添加到weatherData对象中
                weatherData.weatherCode = weatherCode; // 确保weatherCode存在
                // 获取完整的地区编码信息（墨迹天气、中央气象台、中国气象局）
                try {
                    // @TODO 从这里很有可能无法正常获取地区编码信息，需要排查原因
                    const districtCodes = window.WeatherModule?.getDistrictCodes?.(weatherCode);
                    if (districtCodes) {
                        weatherData.mojiAreaCode = districtCodes.mojiCode;
                        weatherData.nmcAreaCode = districtCodes.nmcCode;
                        weatherData.cmaAreaCode = districtCodes.cmaCode;
                        logStep(`已添加完整地区编码信息: mojiCode=${districtCodes.mojiCode}, nmcCode=${districtCodes.nmcCode}, cmaCode=${districtCodes.cmaCode}`);
                    } else {
                        logStep(`警告: 未找到地区编码信息 for weatherCode=${weatherCode}`);
                    }
                } catch (error) {
                    logStep(`错误: 获取地区编码信息时出错: ${error}`);
                }
                // 4. 使用 MainController 进行渲染
                window.WeatherModule.MainController.updateDisplay(weatherData);
            } else {
                // 规范化失败，数据格式无效，触发重试
                logStep(`错误: 返回的数据格式不符合预期或为空: ${JSON.stringify(data)}`);
                if (retryCount < 2) {
                    logStep(`尝试重新获取天气数据，当前重试次数: ${retryCount + 1}`);
                    setTimeout(() => {
                    loadWeatherData(weatherCode, retryCount + 1); // 递归调用全局函数
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
                    loadWeatherData(weatherCode, retryCount + 1); // 递归调用全局函数
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

export {loadWeatherData};
