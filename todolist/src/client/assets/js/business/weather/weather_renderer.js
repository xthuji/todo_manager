// 天气数据渲染模块

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
    logStep(`更新今日天气数据...`);
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

    // 动态设置左侧天气区域div的背景色
    const weatherArea = document.querySelector('#weather-area'); // 找到左侧天气区域的div
    if (weatherArea) {
        // 移除所有可能的背景色类
        weatherArea.className = weatherArea.className.replace(/bg-[\w-]+/g, '').trim();
        // 添加根据天气状况的背景色类
        weatherArea.className += ' ' + getWeatherBgColor(todayWeather.weather || '--');
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

    hourlyData.forEach((hourData, index) => {
        if (!hourData) return;

        // console.log(`小时数据 ${index}:`, hourData);

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

        // console.log(`小时数据 ${index}, 值: ${hourValue}, 当前小时: ${currentHour}, 是否高亮: ${isCurrentHour}`);

        const hourElement = document.createElement('div');
        // 缩小宽度，确保与图表坐标节点一一对应
        const baseClasses = 'inline-flex flex-col items-center justify-center p-1 bg-gray-50 rounded-lg text-center min-w-[70px] max-w-[70px]';

        // 应用类名
        if (isCurrentHour) {
            hourElement.className = `${baseClasses} border-2 border-blue-400 bg-blue-50`;
        } else {
            hourElement.className = baseClasses;
        }

        // 增强的自动滚动功能
        setTimeout(() => {
            if (hourElement && isCurrentHour) { // 只在当前时段时执行滚动
                console.log('自动滚动到当前时段数据');

                // 找到最近的可滚动容器并滚动 - 作为备选方案
                let parent = hourElement.parentElement;
                let containerFound = false;

                while (parent && parent !== document.body && !containerFound) {
                    const isScrollable = parent.scrollWidth > parent.clientWidth ||
                        parent.scrollHeight > parent.clientHeight;

                    if (isScrollable) {
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
        condition.textContent = weather || '--';

        // 显示完整的风力风向信息
        const wind = document.createElement('div');
        wind.className = 'text-[9px] text-gray-500 mb-1'; // 进一步缩小字体以显示完整信息

        // 处理wind字段（可能是合并的字符串）
        let windInfo = hourData.wind.trim().replace(/[\s<>]+/g, '');

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

// 获取指定日期的节日信息
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

        const dateObj = new Date(formattedDate);

        // 存储处理后的数据和映射关系
        const dayData = { ...day, formattedDate: formattedDate, dateObj: dateObj};
        processedWeatherData.push(dayData);

        // 存储到映射中 - 使用格式化后的日期作为唯一键
        dateToDataMap.set(formattedDate, dayData);
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

            // 创建日期和节日的容器，使用flex布局让它们在同一行
            const dateAndFestivalContainer = document.createElement('div');
            dateAndFestivalContainer.className = 'flex items-center justify-between w-full';

            // 日期数字
            const dateNumber = document.createElement('div');
            dateNumber.className = isToday ? 'text-blue-600 font-bold text-sm' : 'text-gray-700 text-sm';
            dateNumber.textContent = dayCount;
            dateAndFestivalContainer.appendChild(dateNumber);

            // 添加节日标记容器到同一行
            const festivalContainer = document.createElement('div');
            festivalContainer.className = 'whitespace-nowrap';
            dateAndFestivalContainer.appendChild(festivalContainer);

            cell.appendChild(dateAndFestivalContainer);

            // 添加节日标记 - 独立于天气数据，确保始终显示节日信息
            try {
                // 清空容器
                festivalContainer.innerHTML = '';

                // 获取节日数据（使用同步函数）
                const festivalsForDay = window.lunarUtils.getFestivalsSync(dayData.dateObj, 1);

                // 添加节日标记
                if (festivalsForDay && Array.isArray(festivalsForDay) && festivalsForDay.length > 0) {
                    festivalsForDay.forEach(festival => {
                        if (festival && festival.name) {
                            const festivalTag = document.createElement('div');
                            // 使用简化的节日标签样式，确保背景色正确应用
                            let festivalTypeClass = window.lunarUtils.getFestivalTypeClass(festival.type);
                            festivalTag.className = `festival-tag ${festivalTypeClass}`;

                            festivalTag.textContent = festival.name;
                            logStep(`为日期 ${formattedCurrentDate} 添加节日 ${(festival.name)}`);
                            // 将节日标签添加到容器中
                            festivalContainer.appendChild(festivalTag);
                        }
                    });
                }
            } catch (error) {
                console.error('获取节日信息失败:', error);
            }

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

    logStep(`24小时图表 纵坐标区间: ${minY}°C - ${maxY}°C`);

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
                                tooltipContent += `\t${hourData.wind.trim().replace(/[\s<>]+/g, '')}`;
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

    logStep(`气温趋势图 固定纵坐标区间: ${minY}°C - ${maxY}°C`);

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

// 更新近几日天气横向表格（无表头，优化显示样式）
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

    // 创建一个相对定位的容器作为表格和滚动提示的父元素
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'relative';

    // 创建横向表格容器，添加高度限制和垂直滚动
    // 根据右侧24小时天气区域的整体高度调整表格高度
    const tableContainer = document.createElement('div');
    tableContainer.className = 'overflow-x-auto overflow-y-auto h-80 scrollbar-thin';

    // 创建向下滚动提示箭头（悬浮在滚动条区域底部）
    const downArrow = document.createElement('div');
    downArrow.className = 'absolute right-0 bottom-0 z-10 bg-white/80 p-1 rounded-t-full shadow-sm cursor-pointer transition-opacity duration-300';
    downArrow.innerHTML = '⬇';
    downArrow.style.opacity = '0.7';

    // 创建向上滚动提示箭头（悬浮在滚动条区域顶部）
    const upArrow = document.createElement('div');
    upArrow.className = 'absolute right-0 top-0 z-10 bg-white/80 p-1 rounded-b-full shadow-sm cursor-pointer transition-opacity duration-300';
    upArrow.innerHTML = '⬆';
    upArrow.style.opacity = '0.7';
    upArrow.style.display = 'none'; // 初始隐藏

    // 添加滚动监听事件，控制箭头图标的显示/隐藏
    tableContainer.addEventListener('scroll', function() {
        // 检查是否可以向下滚动（是否有内容被遮挡）
        const canScrollDown = tableContainer.scrollHeight > tableContainer.clientHeight &&
            tableContainer.scrollTop < tableContainer.scrollHeight - tableContainer.clientHeight - 1;

        // 检查是否可以向上滚动（是否已经滚动过）
        const canScrollUp = tableContainer.scrollTop > 0;

        // 更新箭头显示状态
        downArrow.style.display = canScrollDown ? 'block' : 'none';
        upArrow.style.display = canScrollUp ? 'block' : 'none';
    });

    // 添加点击事件，点击向下箭头滚动到底部
    downArrow.addEventListener('click', function() {
        tableContainer.scrollBy({ top: 100, behavior: 'smooth' });
    });

    // 添加点击事件，点击向上箭头滚动到顶部
    upArrow.addEventListener('click', function() {
        tableContainer.scrollBy({ top: -100, behavior: 'smooth' });
    });

    // 将箭头添加到包装器中
    tableWrapper.appendChild(downArrow);
    tableWrapper.appendChild(upArrow);

    // 初始检查是否需要显示向下箭头
    setTimeout(function() {
        const canScrollDown = tableContainer.scrollHeight > tableContainer.clientHeight;
        downArrow.style.display = canScrollDown ? 'block' : 'none';
    }, 100);

    // 创建表格 - 移除单元格边框，准备在外部容器添加整体边框
    const table = document.createElement('table');
    table.className = 'min-w-full border-collapse';

    // 创建表体 - 直接创建表体，不使用表头
    const tbody = document.createElement('tbody');

    // 添加每日天气数据行 - 优化显示效果
    recentDaysWeather.forEach((dayData, index) => {
        const row = document.createElement('tr');

        // 直接高亮第一行作为今日数据
        const isToday = index === 0;

        // 设置行样式
        row.className = 'h-7'; // 设置固定行高
        if (isToday) {
            row.className += ' bg-blue-50';
        }

        // 格式化日期 - 简化显示
        let dateStr = dayData.date || '';
        if (dateStr.length === 8) {
            const month = dateStr.substring(4, 6).replace(/^0/, '');
            const day = dateStr.substring(6, 8).replace(/^0/, '');
            dateStr = `${month}/${day}`;
        }

        // 创建单元格数据 - 合并天气和温度信息
        const dataCells = [
            dateStr,
            {
                weather: dayData.weather || '--',
                minTemp: dayData.tempMin || '--',
                maxTemp: dayData.tempMax || '--'
            },
            dayData.wind || '--'
        ];

        // 添加单元格 - 优化样式和显示效果
        dataCells.forEach((cellData, cellIndex) => {
            const td = document.createElement('td');

            // 设置单元格样式 - 移除边框，使用内部间距和底部分隔线
            td.className = 'text-xs font-medium text-center p-0.5 border-b border-gray-200';

            // 根据不同列设置不同的样式和内容
            if (cellIndex === 0) { // 日期列
                td.textContent = cellData;
                td.classList.add('text-gray-700', 'font-semibold');
            } else if (cellIndex === 1) { // 天气和温度合并列
                let iconText = '☀️';
                const weather = cellData.weather || '';
                const minTemp = cellData.minTemp || '--';
                const maxTemp = cellData.maxTemp || '--';

                // 根据天气类型选择更合适的图标
                if (weather.includes('暴雨') || weather.includes('大雨')) iconText = '⛈️';
                else if (weather.includes('中雨')) iconText = '🌧️';
                else if (weather.includes('小雨') || weather.includes('阵雨')) iconText = '🌦️';
                else if (weather.includes('多云') || weather.includes('晴间多云')) iconText = '⛅';
                else if (weather.includes('阴') || weather.includes('阴天')) iconText = '☁️';
                else if (weather.includes('雪')) iconText = '❄️';
                else if (weather.includes('雾') || weather.includes('霾')) iconText = '🌫️';

                // 显示两行：第一行天气图标和文字，第二行最低/最高温度
                td.innerHTML = `<div class="flex flex-col items-center">
                    <!-- 第一行：天气图标和文字 -->
                    <div class="flex items-center space-x-2 mb-1">
                        <div class="text-sm">${iconText}</div>
                        <div class="text-sx truncate">${weather}</div>
                    </div>
                    <!-- 第二行：最低/最高温度 -->
                    <div class="flex items-center space-x-2 text-sx">
                        <div class="text-blue-500">${minTemp}</div>
                        <div>/</div>
                        <div class="text-red-500">${maxTemp}°C</div>
                    </div>
                </div>`;
                td.title = `${weather} ${minTemp} / ${maxTemp}°C`; // 添加title属性显示详细信息
            } else if (cellIndex === 2) { // 风向风力列（最后一列）
                td.innerHTML = `<div class="text-xs truncate max-w-[60px]">${cellData.replace(/[\s<>]+/g, '')}</div>`;
                td.classList.add('text-gray-600');
                td.classList.remove('border-r'); // 移除最后一列的右边框
            }

            row.appendChild(td);
        });

        // 将行添加到表体
        tbody.appendChild(row);
    });

    // 添加表体到表格
    table.appendChild(tbody);

    // 创建带整体边框的表格容器
    const borderedContainer = document.createElement('div');
    borderedContainer.className = 'border border-gray-300 rounded-lg overflow-hidden';
    borderedContainer.appendChild(table);

    // 添加带边框的容器到滚动容器
    tableContainer.appendChild(borderedContainer);

    // 清空容器并添加新的表格到包装器
    container.innerHTML = '';
    // 将表格容器添加到包装器中
    tableWrapper.appendChild(tableContainer);
    // 将包装器添加到主容器
    container.appendChild(tableWrapper);

    // 添加响应式调整，在小屏幕上优化显示
    adjustTableResponsive();
}

// 响应式调整表格显示
function adjustTableResponsive() {
    // 检测屏幕宽度
    const isMobile = window.innerWidth < 768;
    const table = document.querySelector('#recent-days-weather table');

    if (!table) return;

    const tds = table.querySelectorAll('td');

    if (isMobile) {
        // 在移动端减小字体大小
        tds.forEach(td => {
            td.style.fontSize = '12px';
        });
    } else {
        // 在桌面端恢复正常大小
        tds.forEach(td => {
            td.style.fontSize = '';
        });
    }
}

// 页面加载完成后初始化响应式调整
window.addEventListener('resize', adjustTableResponsive);

// 更新天气显示
function updateWeatherDisplay(weatherData) {
    logStep(`开始更新天气显示...`);
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

// 初始化节日数据
async function initFestivals() {
    try {
        // 初始化全局变量
        window.allFestivals = [];
        window.calendarConfig = {
            currentYear: new Date().getFullYear(),
            currentMonth: new Date().getMonth(),
            festivals: [],
            holidays: {},
            workdays: new Set()
        };

        // 使用lunar_utils.js加载节日配置
        try {
            const config = await window.lunarUtils.loadHolidayConfig();
            window.allFestivals = config.festivals || [];
            window.calendarConfig.festivals = window.allFestivals;
        } catch (error) {
            console.warn('使用lunarUtils加载节日配置失败，尝试直接获取配置:', error);
            // 降级方案：直接获取配置文件
            const response = await fetch('/data/config/festival_config.json');
            if (response.ok) {
                const config = await response.json();
                window.allFestivals = config.festivals || [];
                window.calendarConfig.festivals = window.allFestivals;
            }
        }
    } catch (error) {
        console.error('加载节日配置时出错:', error);
        // 如果加载失败，使用空数组
        window.allFestivals = [];
        window.calendarConfig.festivals = [];
    }
}
// 注册全局节日数据初始化函数到window对象
if (!window.WeatherModule) {
    window.WeatherModule = {};
}
window.WeatherModule.initFestivals = () => initFestivals();