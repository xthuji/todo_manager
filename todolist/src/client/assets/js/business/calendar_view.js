// 日历视图业务逻辑模块
// 针对页面：日历视图页面
// 业务功能模块：
// 1. 节日数据管理
// 2. 日历初始化与导航
// 3. 日期和节日判断
// 4. 日历渲染
// 5. 日期元素创建与样式设置

// 引入节假日管理模块
import './common/holiday_manager.js';
// 引入lunar_utils.js工具
import './common/lunar_utils.js';

// 全局节日数据
window.allFestivals = [];

// 全局日历配置
window.calendarConfig = {
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth(),
    currentDay: new Date().getDate(),
    festivals: []
};

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
        if (window.lunarUtils && typeof window.lunarUtils.loadHolidayConfig === 'function') {
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
        } else {
            console.warn('lunarUtils不可用，尝试直接获取配置文件');
        }
        
        // 加载法定节假日数据
        await loadHolidayData();
    } catch (error) {
        console.error('加载节日配置时出错:', error);
        // 如果加载失败，使用空数组
        window.allFestivals = [];
        window.calendarConfig.festivals = [];
    }
}

// 加载法定节假日和补班数据
async function loadHolidayData() {
    try {
        if (window.holidayManager && typeof window.holidayManager.getHolidayData === 'function') {
            try {
                await window.holidayManager.getHolidayData(true);
                return;
            } catch (error) {
                console.warn('使用holidayManager加载节假日数据失败:', error);
            }
        }
        
        // 初始化空的节假日和补班数据结构
        window.calendarConfig.holidays = {};
        window.calendarConfig.workdays = new Set();
    } catch (error) {
        console.error('加载节假日数据时出错:', error);
    }
}

// 检查日期是否匹配节日
function isFestivalDate(date, festival) {
    // 优先使用公共节日工具模块
    if (window.festivalUtils && typeof window.festivalUtils.isFestivalDate === 'function') {
        try {
            return window.festivalUtils.isFestivalDate(date, festival);
        } catch (error) {
            console.warn('使用festivalUtils判断节日日期失败:', error);
        }
    }
    
    if (!date || !festival) {
        return false;
    }
    
    // 使用lunarUtils中的方法来判断日期是否匹配节日
    if (window.lunarUtils && typeof window.lunarUtils.isFestivalDate === 'function') {
        try {
            return window.lunarUtils.isFestivalDate(date, festival);
        } catch (error) {
            console.warn('使用lunarUtils判断节日日期失败:', error);
        }
    }
    
    // 降级处理：简单的公历节日判断
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    if (festival.dateType === 'solar') {
        const festivalMonth = parseInt(festival.date.split('-')[0]);
        const festivalDay = parseInt(festival.date.split('-')[1]);
        return month === festivalMonth && day === festivalDay;
    }
    
    return false;
}

// 获取指定日期的所有节日
/**
 * 获取指定日期的节日信息 - 统一使用公共节日工具模块
 * @param {Date} date 日期对象
 * @returns {Array} 节日数组
 */
function getFestivalsForDate(date) {
    // 检查festival_utils是否已加载
    if (window.festivalUtils && typeof window.festivalUtils.getFestivalsForDate === 'function') {
        try {
            return window.festivalUtils.getFestivalsForDate(date);
        } catch (error) {
            console.warn('调用公共节日工具失败:', error);
        }
    } else {
        // 如果festival_utils未加载，动态加载它
        console.warn('festival_utils未加载，正在动态加载...');
        
        // 创建script标签加载festival_utils.js
        const script = document.createElement('script');
        script.src = '/src/client/assets/js/business/common/festival_utils.js';
        script.onload = function() {
            console.log('festival_utils加载成功');
        };
        script.onerror = function() {
            console.error('festival_utils加载失败');
        };
        document.head.appendChild(script);
    }
    
    // 暂时返回空数组，等待工具加载后会自动使用正确实现
    return [];
}

// 检查日期是否是法定节假日
function isHoliday(date) {
    try {
        if (window.holidayManager && typeof window.holidayManager.getDateType === 'function') {
            return window.holidayManager.getDateType(date) === 'holiday';
        }
        
        // 降级处理：使用lunarUtils中的isHoliday方法
        if (window.lunarUtils && typeof window.lunarUtils.isHoliday === 'function') {
            return window.lunarUtils.isHoliday(date);
        }
        
        console.warn('没有可用的节假日判断方法');
        return false;
    } catch (error) {
        console.warn('检查节假日失败:', error);
        return false;
    }
}

// 检查日期是否是补班日
function isWorkday(date) {
    try {
        if (window.holidayManager && typeof window.holidayManager.getDateType === 'function') {
            return window.holidayManager.getDateType(date) === 'workday';
        }
        
        // 降级处理：使用lunarUtils中的isWorkday方法
        if (window.lunarUtils && typeof window.lunarUtils.isWorkday === 'function') {
            return window.lunarUtils.isWorkday(date);
        }
        
        console.warn('没有可用的补班日判断方法');
        return false;
    } catch (error) {
        console.warn('检查补班日失败:', error);
        return false;
    }
}

// 初始化日历
async function initCalendar() {
    try {
        // 1. 初始化节假日数据
        if (window.holidayManager && typeof window.holidayManager.getHolidayData === 'function') {
            try {
                await window.holidayManager.getHolidayData(true); // 传入true表示初始化调用
            } catch (error) {
                console.warn('初始化节假日数据失败:', error);
            }
        } else {
            console.warn('holidayManager.getHolidayData 方法不可用，使用本地数据');
        }
        
        // 2. 初始化月份导航按钮
        document.getElementById('prev-month').addEventListener('click', goToPrevMonth);
        document.getElementById('next-month').addEventListener('click', goToNextMonth);
        document.getElementById('btn-today').addEventListener('click', goToToday);
        
        // 3. 初始化年份选择器
        const yearSelector = document.getElementById('year-selector');
        const monthSelector = document.getElementById('month-selector');
        
        if (yearSelector && monthSelector) {
            // 生成年份选项（当前年份前后5年）
            const currentYear = new Date().getFullYear();
            for (let year = currentYear - 5; year <= currentYear + 5; year++) {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = `${year}年`;
                yearSelector.appendChild(option);
            }
            
            // 设置当前年月
            yearSelector.value = window.calendarConfig.currentYear;
            monthSelector.value = window.calendarConfig.currentMonth;
            
            // 添加事件监听
            yearSelector.addEventListener('change', function() {
                window.calendarConfig.currentYear = parseInt(this.value);
                renderCalendar();
            });
            
            monthSelector.addEventListener('change', function() {
                window.calendarConfig.currentMonth = parseInt(this.value);
                renderCalendar();
            });
        }
        
        // 4. 渲染日历
        renderCalendar();
    } catch (error) {
        console.error('初始化日历失败:', error);
    }
}

// 切换到上个月
function goToPrevMonth() {
    window.calendarConfig.currentMonth--;
    if (window.calendarConfig.currentMonth < 0) {
        window.calendarConfig.currentMonth = 11;
        window.calendarConfig.currentYear--;
    }
    renderCalendar();
}

// 切换到下个月
function goToNextMonth() {
    window.calendarConfig.currentMonth++;
    if (window.calendarConfig.currentMonth > 11) {
        window.calendarConfig.currentMonth = 0;
        window.calendarConfig.currentYear++;
    }
    renderCalendar();
}

// 切换到今天
function goToToday() {
    const today = new Date();
    window.calendarConfig.currentYear = today.getFullYear();
    window.calendarConfig.currentMonth = today.getMonth();
    window.calendarConfig.currentDay = today.getDate();
    renderCalendar();
}

// 渲染日历
function renderCalendar() {
    try {
        // 缓存DOM引用以提高性能
        const calendarGrid = document.getElementById('calendar-grid');
        
        if (!calendarGrid) {
            console.error('日历容器不存在');
            return;
        }
        
        // 更新选择器
        const yearSelector = document.getElementById('year-selector');
        const monthSelector = document.getElementById('month-selector');
        if (yearSelector && monthSelector) {
            yearSelector.value = window.calendarConfig.currentYear;
            monthSelector.value = window.calendarConfig.currentMonth;
        }
        
        // 清空日历网格
        calendarGrid.innerHTML = '';
        
        // 获取当月第一天
        const firstDayOfMonth = new Date(window.calendarConfig.currentYear, window.calendarConfig.currentMonth, 1);
        
        // 获取当月最后一天
        const lastDayOfMonth = new Date(window.calendarConfig.currentYear, window.calendarConfig.currentMonth + 1, 0);
        
        // 获取当月第一天是星期几（0-6，0是星期日）
        const firstDayOfWeek = firstDayOfMonth.getDay();
        
        // 获取上月最后一天
        const lastDayOfPrevMonth = new Date(window.calendarConfig.currentYear, window.calendarConfig.currentMonth, 0);
        
        // 计算需要显示的日期数量
        const daysInMonth = lastDayOfMonth.getDate();
        
        // 创建一个二维数组来存储日历数据 (最多6周 × 7天)
        const calendarData = Array(6).fill().map(() => Array(7).fill(null));
        
        // 调整星期索引以匹配HTML中的顺序（周一到周日）
        // JavaScript: 0=周日, 1=周一, 2=周二, 3=周三, 4=周四, 5=周五, 6=周六
        // HTML: 0=周一, 1=周二, 2=周三, 3=周四, 4=周五, 5=周六, 6=周日
        
        // 计算需要显示的上月日期数量
        let daysFromPrevMonth;
        if (firstDayOfWeek === 1) { // 如果第一天是周一，不需要显示上月日期
            daysFromPrevMonth = 0;
        } else if (firstDayOfWeek === 0) { // 如果第一天是周日，需要显示6天上月日期
            daysFromPrevMonth = 6;
        } else { // 其他情况
            daysFromPrevMonth = firstDayOfWeek - 1;
        }
        
        // 填充上月的日期
        let prevMonthDay = lastDayOfPrevMonth.getDate();
        for (let i = 0; i < daysFromPrevMonth; i++) {
            const date = new Date(window.calendarConfig.currentYear, window.calendarConfig.currentMonth - 1, prevMonthDay - (daysFromPrevMonth - 1 - i));
            calendarData[0][i] = { date, isCurrentMonth: false };
        }
        
        // 填充当月的日期
        let currentWeekIndex = 0;
        let currentDayIndex = daysFromPrevMonth;
        
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(window.calendarConfig.currentYear, window.calendarConfig.currentMonth, i);
            
            // 计算当前应该放在哪个位置
            if (currentDayIndex > 6) {
                currentWeekIndex++;
                currentDayIndex = 0;
            }
            
            calendarData[currentWeekIndex][currentDayIndex] = { date, isCurrentMonth: true };
            currentDayIndex++;
        }
        
        // 计算需要显示的下月日期数量
        // 只填充到包含本月最后一天的那一周结束，不显示完全由下月日期组成的行
        const lastDayOfWeek = lastDayOfMonth.getDay();
        let daysToNextMonth;
        if (lastDayOfWeek === 0) { // 如果最后一天是周日，需要显示0天下月日期
            daysToNextMonth = 0;
        } else {
            daysToNextMonth = 7 - lastDayOfWeek;
        }
        
        // 填充下月的日期（只填充到包含本月最后一天的那一周结束）
        let nextMonthDay = 1;
        
        // 确保我们只填充到包含本月最后一天的那一周
        const lastWeekIndex = Math.floor((daysFromPrevMonth + daysInMonth - 1) / 7);
        
        if (currentDayIndex > 0) {
            while (currentDayIndex <= 6 && nextMonthDay <= daysToNextMonth) {
                const date = new Date(window.calendarConfig.currentYear, window.calendarConfig.currentMonth + 1, nextMonthDay);
                calendarData[currentWeekIndex][currentDayIndex] = { date, isCurrentMonth: false };
                currentDayIndex++;
                nextMonthDay++;
            }
        }
        
        // 渲染日历
        // 只渲染包含日期的行
        for (let week = 0; week < 6; week++) {
            // 检查这一行是否有日期
            const hasDate = calendarData[week].some(day => day !== null);
            if (!hasDate) break;
            
            for (let day = 0; day < 7; day++) {
                if (calendarData[week][day]) {
                    const { date, isCurrentMonth } = calendarData[week][day];
                    const dayElement = createDayElement(date, isCurrentMonth, day); // 传入day索引用于正确判断周末
                    calendarGrid.appendChild(dayElement);
                } else {
                    // 如果没有日期数据，创建一个空白的日期元素
                    const emptyDay = document.createElement('div');
                    emptyDay.className = 'calendar-day';
                    calendarGrid.appendChild(emptyDay);
                }
            }
        }
    } catch (error) {
        console.error('渲染日历失败:', error);
    }
}

// 创建日期元素
function createDayElement(date, isCurrentMonth, dayIndex) {
    const dayContainer = document.createElement('div');
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    
    // 检查是否是今天
    const today = new Date();
    const isToday = year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
    
    // 根据HTML中的位置判断是否是周末（周六是第5列，周日是第6列）
    const isWeekend = dayIndex === 5 || dayIndex === 6;
    
    // 检查是否是法定节假日或补班日
    const isHolidayDate = isHoliday(date);
    const isWorkdayDate = isWorkday(date);
    
    // 设置日期容器的类
    let dayClasses = ['calendar-day'];
    if (!isCurrentMonth) {
        dayClasses.push('calendar-day-other_month');
        // 非本月日期也需要高亮节假日和补班日
        if (isHolidayDate) {
            dayClasses.push('calendar-day-holiday');
        } else if (isWorkdayDate) {
            dayClasses.push('calendar-day-workday');
        }
    } else if (isHolidayDate) {
        // 法定节假日优先于周末高亮
        dayClasses.push('calendar-day-holiday');
    } else if (isWorkdayDate) {
        // 补班日特殊标记
        dayClasses.push('calendar-day-workday');
    } else if (isWeekend) {
        dayClasses.push('calendar-day-weekend');
    } else {
        dayClasses.push('calendar-day-weekday');
    }
    if (isToday) {
        dayClasses.push('calendar-day-today');
    }
    
    dayContainer.className = dayClasses.join(' ');
    
    // 创建日期内容
    const dayContent = document.createElement('div');
    dayContent.className = 'calendar-day-content';
    
    // 创建日期内容容器 - 用于容纳数字日期和农历日期
    const dateContentContainer = document.createElement('div');
    dateContentContainer.className = 'flex items-center mb-0.5';
    dayContent.appendChild(dateContentContainer);
    
    // 创建日期数字
    const dayNumber = document.createElement('span');
    dayNumber.className = isCurrentMonth ? 'calendar-day-number' : 'calendar-day-number calendar-day-number-other_month';
    
    // 如果是今天的日期，添加圆形蓝色高亮样式
    if (isToday) {
        // 重新设置className，确保白色文本样式优先
        dayNumber.className = 'bg-blue-500 text-white font-medium w-6 h-6 flex items-center justify-center rounded-full inline-flex z-10';
    }
    
    dayNumber.textContent = day;
    dateContentContainer.appendChild(dayNumber);
    
    // 添加农历日期 - 无论是否为本月都显示
    const lunarDate = getLunarDate(year, month + 1, day);
    if (lunarDate) {
        const lunarElement = document.createElement('span');
        lunarElement.className = 'text-xs text-gray-500 ml-1';
        lunarElement.textContent = lunarDate;
        dateContentContainer.appendChild(lunarElement);
    }
    
    // 添加节日标记 - 无论是否为本月都显示
    // 为节日信息创建一个容器
    const festivalContainer = document.createElement('div');
    festivalContainer.className = 'festival-container flex flex-col items-end gap-0.5 w-full';
    dayContent.appendChild(festivalContainer);
    
    // 获取节日信息（使用同步函数）
    try {
        // 清空容器
        festivalContainer.innerHTML = '';
        
        // 获取节日数据
        const festivalsForDay = getFestivalsForDate(date);
        
        // 添加节日标记，每个节日占一行
        if (festivalsForDay && festivalsForDay.length > 0) {
            festivalsForDay.forEach(festival => {
                  const festivalTag = document.createElement('div');
                  // 使用统一的节日标签样式，避免重复定义样式类
                  festivalTag.className = `festival-tag ${getFestivalTypeClass(festival.type)} w-full text-center`;
                festivalTag.textContent = festival.name;
                festivalContainer.appendChild(festivalTag);
            });
        }
    } catch (error) {
        console.error('获取节日信息失败:', error);
    }
    
    dayContainer.appendChild(dayContent);
    
    // 添加点击事件
    dayContainer.addEventListener('click', function() {
        console.log('点击了日期:', date);
    });
    
    return dayContainer;
}

// 获取节日类型样式类 - 统一使用tailwind.config中定义的颜色
function getFestivalTypeClass(type) {
    // 优先使用window.festivalUtils提供的实现，确保样式统一
    if (window.festivalUtils && typeof window.festivalUtils.getFestivalTypeClass === 'function') {
        try {
            return window.festivalUtils.getFestivalTypeClass(type);
        } catch (error) {
            console.warn('调用festivalUtils.getFestivalTypeClass失败，使用默认实现:', error);
        }
    }
    // 区分常用节日和传统节日，返回不同的样式类以实现颜色区分
    switch (type) {
        case 'chinese_common':
            return 'bg-festival-common'; // 常用节日 - 红色
        case 'chinese_traditional':
            return 'bg-festival-traditional'; // 传统节日 - 浅红色
        case 'foreign':
            return 'bg-festival-foreign'; // 国外节日
        case 'solar_terms':
            return 'bg-festival-terms'; // 节气
        case 'custom':
            return 'bg-festival-custom'; // 自定义节日
        default:
            return 'bg-festival-custom'; // 默认使用自定义节日样式
    }
}

// 农历日期转换 - 使用lunar_utils.js和lunar.js中的方法
function getLunarDate(year, month, day) {
    try {
        // 创建日期对象
        const date = new Date(year, month - 1, day);
        
        // 优先使用lunar_utils.js中的方法
        if (window.lunarUtils && typeof window.lunarUtils.getLunarDateText === 'function') {
            try {
                const lunarDateText = window.lunarUtils.getLunarDateText(date);
                if (lunarDateText) {
                    return lunarDateText;
                }
            } catch (error) {
                console.warn('使用lunar_utils.js获取农历日期失败:', error);
            }
        }
        
        // 其次尝试使用lunar.js的Solar和Lunar对象
        if (window.Solar && window.Solar.fromYmd && window.Solar.fromDate) {
            try {
                let solar;
                try {
                    // 尝试直接使用年月日创建
                    solar = window.Solar.fromYmd(year, month, day);
                } catch (err) {
                    // 如果失败，尝试使用Date对象创建
                    solar = window.Solar.fromDate(date);
                }
                
                if (solar && solar.getLunar) {
                    const lunar = solar.getLunar();
                    
                    if (lunar && lunar.getMonth && lunar.getDay) {
                        // 获取农历月份和日期
                        const lunarMonth = Math.abs(lunar.getMonth());
                        const lunarDay = lunar.getDay();
                        const isLeapMonth = lunar.getMonth() < 0;
                        
                        // 农历月份名称
                        const lunarMonths = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
                        
                        // 农历日名称
                        const lunarDays = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
                                          '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
                                          '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];
                        
                        // 处理闰月
                        const monthStr = isLeapMonth ? `闰${lunarMonths[lunarMonth - 1]}` : lunarMonths[lunarMonth - 1];
                        
                        // 确保索引在有效范围内
                        if (lunarMonth >= 1 && lunarMonth <= 12 && lunarDay >= 1 && lunarDay <= 30) {
                            // 普通日期
                            return `${monthStr}月${lunarDays[lunarDay - 1]}`;
                        }
                    }
                }
            } catch (error) {
                console.warn('使用lunar.js计算农历日期失败:', error);
            }
        }
        
        // 如果都失败了，返回空字符串
        return '';
    } catch (error) {
        console.error('获取农历日期失败:', error);
        return '';
    }
}

// 初始化脚本
document.addEventListener('DOMContentLoaded', async () => {
    // 初始化节日数据
    await initFestivals();
    // 初始化日历
    initCalendar();
});