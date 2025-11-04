/**
 * 法定节假日信息管理模块，主要用于判断日期是否为法定节假日，是否需要放假或补班
 * 针对页面：日历视图页面 (calendar_view.html等)
 * 业务功能模块：
 * 1. 获取、缓存和管理法定节假日数据
 * 2. 判断日期类型（工作日、周末、节假日、补班日）
 * 3. 提供数据格式转换，支持日历显示
 * 4. 管理节假日数据缓存，支持缓存刷新和更新
 * 5. 将节假日数据暴露到window对象供全局访问
 * 
 * 使用场景：
 * - 在日历视图中显示法定节假日和工作日信息
 * - 为日历单元格提供日期类型判断（是否为节假日、补班日等）
 * - 支持节假日数据的缓存管理和过期提醒
 * - 与lunar_utils.js配合，为calendar_view.js提供完整的日历数据支持
 */

// 全局变量
let holidayData = null; // 节假日数据
// 内部转换后的数据格式，用于日历显示
let holidayDataForCalendar = null;
let holidayDataTimestamp = null; // 节假日数据时间戳

// 绑定到window对象，以便在HTML页面中直接使用
window.holidayManager = window.holidayManager || {};
function resetHolidayData() {
    holidayData = null;
    holidayDataForCalendar = null;
    holidayDataTimestamp = null;
}


// 已经通过window.holidayManager暴露的方法
/**
 * 获取节假日数据
 * @param {boolean} isInitial - 是否是初始化调用
 * @returns {Promise<Object|null>} 节假日数据
 */
// 获取节假日数据
async function getHolidayData(apiUrl = null) {
    try {
        // 构建请求URL，添加apiUrl参数
        const requestUrl = new URL('/api/holiday/cache', window.location.origin);
        if (typeof apiUrl === 'string' && apiUrl.trim()) {
            requestUrl.searchParams.append('apiUrl', apiUrl.trim());
        }
        
        // 仅从服务器接口获取节假日数据
        const response = await fetch(requestUrl);
        if (response.ok) {
            const cacheData = await response.json();
            
            // 处理标准的{data, timestamp}格式
            if (cacheData && cacheData.data && typeof cacheData.data === 'object') {
                holidayData = cacheData.data;
                holidayDataTimestamp = cacheData.timestamp;
                
                // 记录缓存是否过期
                window.holidayManager._cacheExpired = !!cacheData.isExpired;
                window.holidayManager._expiredTime = cacheData.expiredTime;
                
                // 转换数据格式为日历显示所需格式
                holidayDataForCalendar = convertHolidayDataToCalendarFormat(holidayData);
                
                // 更新缓存信息显示
                updateHolidayCacheInfo();
                
                // 如果缓存过期，提示用户
                if (cacheData.isExpired) {
                    console.warn('节假日缓存已过期，建议手动刷新');
                }
            } else {
                // 当没有数据或数据格式不符合标准时，重置为null
                resetHolidayData();
                console.log('未获取到有效的节假日数据，将当作没有节假日处理');
            }
        } else {
            // 请求失败，重置数据
            resetHolidayData();
            console.warn('获取节假日数据失败，服务器返回状态码:', response.status);
        }
        
        return holidayData;
    } catch (error) {
        // 发生异常，重置数据
        resetHolidayData();
        console.error('获取节假日数据时发生异常:', error);
        return holidayData;
    }
}

/**
 * 更新节假日缓存信息显示
 */
function updateHolidayCacheInfo() {
    const cacheInfoElement = document.getElementById('holiday-cache-info');
    if (cacheInfoElement && holidayDataTimestamp) {
        const cacheDate = new Date(holidayDataTimestamp);
        const formattedDate = cacheDate.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // 检查缓存是否过期
        if (window.holidayManager._cacheExpired) {
            // 计算过期时间
            let expiredInfo = '';
            if (window.holidayManager._expiredTime) {
                const expiredDate = new Date(window.holidayManager._expiredTime);
                const expiredFormatted = expiredDate.toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                expiredInfo = `于${expiredFormatted}过期`;
            }
            
            // 显示过期提示
            cacheInfoElement.setHTMLUnsafe(`<i class="fa fa-exclamation-triangle text-yellow-500 mr-2"></i>节假日缓存已过期 ${expiredInfo}，建议手动刷新`);
        } else {
            // 显示正常缓存信息
            cacheInfoElement.setHTMLUnsafe(`<i class="fa fa-info-circle text-blue-500 mr-2"></i>节假日缓存更新于 ${formattedDate}`);
        }
    }
}

/**
/**
 * 将holiday_cache.json格式的数据转换为日历显示所需的格式
 * @param {Object} rawData - 原始节假日数据
 * @returns {Object} 转换后的节假日数据
 */
function convertHolidayDataToCalendarFormat(rawData) {
    const formattedData = {};
    
    if (!rawData?.Years) return formattedData;

    // 处理所有年份的节假日数据
    for (const [year, holidays] of Object.entries(rawData.Years)) {
        for (const holiday of holidays) {
            try {
                // 处理节假日区间
                const startDate = new Date(holiday.StartDate);
                const endDate = new Date(holiday.EndDate);
                
                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    console.warn('无效的日期格式:', holiday.StartDate, holiday.EndDate);
                    continue;
                }
                
                // 标记节假日
                for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                    const dateKey = formatDateKey(d);
                    if (!formattedData[dateKey]) {
                        formattedData[dateKey] = {
                            type: 'holiday',
                            name: holiday.Name
                        };
                    }
                }
                
                // 标记补班日
                if (holiday.CompDays && Array.isArray(holiday.CompDays)) {
                    for (const compDay of holiday.CompDays) {
                        try {
                            const compDate = new Date(compDay);
                            if (isNaN(compDate.getTime())) {
                                console.warn('无效的补班日期格式:', compDay);
                                continue;
                            }
                            const dateKey = formatDateKey(compDate);
                            formattedData[dateKey] = {
                                type: 'workday',
                                name: `${holiday.Name}补班`
                            };
                        } catch (e) {
                            console.warn('处理补班日期时出错:', e, compDay);
                        }
                    }
                }
            } catch (e) {
                console.warn('处理节假日数据时出错:', e, holiday);
            }
        }
    }
    
    return formattedData;
}

// 辅助函数：将日期格式化为YYYYMMDD
function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}


/**
 * 获取日期类型
 * @param {string|Date} date - 日期字符串 (YYYY-MM-DD) 或 Date 对象
 * @returns {'holiday'|'workday'|'weekend'|'weekday'} 日期类型
 */
function getDateType(date) {
    if (!holidayData || !date) return 'weekday';
    
    let dateObj;
    let dateKey;
    
    if (typeof date === 'string') {
        dateObj = new Date(date);
        dateKey = date.replace(/-/g, '');
    } else if (date instanceof Date) {
        dateObj = date;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        dateKey = `${year}${month}${day}`;
    } else {
        return 'weekday';
    }
    
    const dayInfo = holidayDataForCalendar ? holidayDataForCalendar[dateKey] : null;
    const dayOfWeek = dateObj.getDay();
    
    // 优先级: 节假日 > 补班 > 工作日 > 周末
    if (dayInfo) {
        if (dayInfo.type === 'holiday') {
            return 'holiday';
        } else if (dayInfo.type === 'workday') {
            return 'workday';
        }
    }
    
    return (dayOfWeek === 0 || dayOfWeek === 6) ? 'weekend' : 'weekday';
}



/**
 * 刷新节假日缓存
 * @param {string|null} apiUrl - 可选的API地址参数
 * @returns {Promise<void>}
 */
async function refreshHolidayCache(apiUrl = null) {
    try {
        // 显示加载状态
        const cacheInfoElement = document.getElementById('holiday-cache-info');
        if (cacheInfoElement) {
            cacheInfoElement.textContent = '正在刷新缓存...';
        }

        // 调用服务端接口完成缓存刷新
        const response = await fetch('/api/holiday/refresh-cache', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ apiUrl })
        });

        if (!response.ok) {
            throw new Error(`服务器响应错误: ${response.status}`);
        }

        // 获取刷新后的节假日数据
        const responseData = await response.json();
        // 只处理服务端返回的固定{data, timestamp}格式
        
        // 更新本地数据
        holidayData = responseData.data;
        holidayDataTimestamp = responseData.timestamp;
        holidayDataForCalendar = convertHolidayDataToCalendarFormat(holidayData);

        // 更新缓存信息显示
        updateHolidayCacheInfo();

        // 刷新日历和任务列表（需要在主模块中实现）
        // 这里只提供接口，具体实现由调用者负责
    } catch (error) {
        console.error('刷新节假日缓存失败:', error);

        // 显示错误信息
        const cacheInfoElement = document.getElementById('holiday-cache-info');
        if (cacheInfoElement) {
            cacheInfoElement.textContent = '刷新缓存失败，请重试';

            // 3秒后恢复显示
            setTimeout(() => {
                updateHolidayCacheInfo();
            }, 3000);
        }
        throw error;
    }
}

// 将方法绑定到window.holidayManager
window.holidayManager.getHolidayData = getHolidayData;
window.holidayManager.getDateType = getDateType;
window.holidayManager.refreshHolidayCache = refreshHolidayCache;

// 导出函数
export { getDateType };
export { getHolidayData };
export { holidayData };
export { holidayDataTimestamp };
