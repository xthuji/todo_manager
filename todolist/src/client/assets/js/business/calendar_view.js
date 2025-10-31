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
        const config = await window.lunarUtils.loadHolidayConfig();
        window.allFestivals = config.festivals || [];
        window.calendarConfig.festivals = window.allFestivals;

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
        try {
            await window.holidayManager.getHolidayData(true);
            return;
        } catch (error) {
            console.warn('使用holidayManager加载节假日数据失败:', error);
        }

        // 初始化空的节假日和补班数据结构
        window.calendarConfig.holidays = {};
        window.calendarConfig.workdays = new Set();
    } catch (error) {
        console.error('加载节假日数据时出错:', error);
    }
}

// 初始化日历
async function initCalendar() {
    try {
        // 1. 初始化节假日数据
        try {
            await window.holidayManager.getHolidayData(true); // 传入true表示初始化调用
        } catch (error) {
            console.warn('初始化节假日数据失败:', error);
        }

        // 2. 初始化月份导航按钮
        const prevMonthBtn = document.getElementById('prev-month');
        const nextMonthBtn = document.getElementById('next-month');
        const todayBtn = document.getElementById('btn-today');
        
        // 检查按钮是否存在
        if (!prevMonthBtn || !nextMonthBtn || !todayBtn) {
            console.error('日历导航按钮不存在');
            return;
        }
        
        // 先移除旧的事件监听器
        prevMonthBtn.onclick = null;
        nextMonthBtn.onclick = null;
        todayBtn.onclick = null;
        
        // 直接设置onclick属性，确保事件处理的一致性和可靠性
        prevMonthBtn.onclick = goToPrevMonth;
        nextMonthBtn.onclick = goToNextMonth;
        todayBtn.onclick = goToToday;
        
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

// 通用的月份切换函数 - 抽象公共逻辑，支持向前和向后翻页
function changeMonth(direction, buttonId) {
    // 立即禁用按钮，防止重复点击
    const button = document.getElementById(buttonId);
    if (button) {
        button.disabled = true;
    }
    
    // 获取当前状态
    const currentYear = window.calendarConfig.currentYear;
    const currentMonth = window.calendarConfig.currentMonth;
    
    console.log(`切换${direction === -1 ? '到上个月' : '到下个月'}前:`, currentYear, currentMonth);
    
    try {
        // 直接计算新的月份和年份，避免依赖当前配置
        let newMonth = currentMonth + direction;
        let newYear = currentYear;
        
        // 处理月份边界情况
        if (newMonth < 0) {
            newMonth = 11;
            newYear--;
        } else if (newMonth > 11) {
            newMonth = 0;
            newYear++;
        }
        
        // 立即更新全局配置
        window.calendarConfig.currentYear = newYear;
        window.calendarConfig.currentMonth = newMonth;
        
        console.log('计算并更新后的新月份:', newYear, newMonth);
        
        // 获取选择器并强制更新，不依赖之前的值
        const yearSelector = document.getElementById('year-selector');
        const monthSelector = document.getElementById('month-selector');
        
        if (yearSelector) {
            // 确保选项存在，如果不存在则添加
            if (!yearSelector.querySelector(`option[value="${newYear}"]`)) {
                const option = document.createElement('option');
                option.value = newYear;
                option.textContent = `${newYear}年`;
                yearSelector.appendChild(option);
            }
            yearSelector.value = newYear;
        }
        
        if (monthSelector) {
            monthSelector.value = newMonth;
        }
        
        // 强制重新渲染日历
        console.log('强制重新渲染日历...');
        
        // 确保在下一个渲染周期执行，避免UI阻塞
        setTimeout(() => {
            renderCalendar();
            
            // 渲染完成后重新启用按钮
            if (button) {
                button.disabled = false;
            }
        }, 0);
    } catch (error) {
        console.error(`切换${direction === -1 ? '到上个月' : '到下个月'}时出错:`, error);
        // 出错时也需要重新启用按钮
        if (button) {
            button.disabled = false;
        }
    }
}

// 切换到上个月 - 调用通用函数
function goToPrevMonth() {
    changeMonth(-1, 'prev-month');
}

// 切换到下个月 - 调用通用函数
function goToNextMonth() {
    changeMonth(1, 'next-month');
}

// 切换到今天
function goToToday() {
    // 添加调试日志
    console.log('切换到今天前:', window.calendarConfig.currentYear, window.calendarConfig.currentMonth);
    
    const today = new Date();
    window.calendarConfig.currentYear = today.getFullYear();
    window.calendarConfig.currentMonth = today.getMonth();
    window.calendarConfig.currentDay = today.getDate();
    
    // 立即更新选择器，确保状态同步
    const yearSelector = document.getElementById('year-selector');
    const monthSelector = document.getElementById('month-selector');
    if (yearSelector && monthSelector) {
        yearSelector.value = window.calendarConfig.currentYear;
        monthSelector.value = window.calendarConfig.currentMonth;
    }
    
    console.log('切换到今天后:', window.calendarConfig.currentYear, window.calendarConfig.currentMonth);
    renderCalendar();
}

// 渲染日历
function renderCalendar() {
    try {
        console.log('开始渲染日历:', window.calendarConfig.currentYear, window.calendarConfig.currentMonth);
        
        // 缓存DOM引用以提高性能
        const calendarGrid = document.getElementById('calendar-grid');
        
        if (!calendarGrid) {
            console.error('日历容器不存在');
            return;
        }
        
        // 确保选择器值与配置同步（这是关键步骤）
        const yearSelector = document.getElementById('year-selector');
        const monthSelector = document.getElementById('month-selector');
        if (yearSelector && monthSelector) {
            // 强制设置选择器的值，确保状态完全同步
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
    const isHolidayDate = window.holidayManager.getDateType(date) === 'holiday';
    const isWorkdayDate = window.holidayManager.getDateType(date) === 'workday';
    
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
    
    // 基础类名设置
    if (isCurrentMonth) {
        dayNumber.className = 'calendar-day-number';
    } else {
        dayNumber.className = 'calendar-day-number calendar-day-number-other_month';
    }
    
    // 直接使用内联样式设置文字颜色，确保优先级
    if (isHolidayDate || (isWeekend && !isWorkdayDate)) {
        // 法定节假日或周末放假的日期文字设置为红色
        dayNumber.style.color = '#dc2626'; // 红色
    } else {
        // 补班日和普通工作日的日期文字设置为黑色
        dayNumber.style.color = '#111827'; // 深黑色
    }
    
    // 如果是今天的日期，添加特殊标记
    if (isToday) {
        // 添加边框高亮效果
        dayNumber.className += ' border-2 border-blue-500 w-6 h-6 inline-flex items-center justify-center rounded-full';
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

        // 使用同步版本的节日获取函数
        let festivalsForDay = window.lunarUtils.getFestivalsSync(date);

        // 添加节日标记，每个节日占一行
        if (festivalsForDay && festivalsForDay.length > 0) {
            festivalsForDay.forEach(festival => {
                const festivalTag = document.createElement('div');
                // 使用统一的节日标签样式，避免重复定义样式类
                festivalTag.className = `festival-tag ${window.lunarUtils.getFestivalTypeClass(festival.type)} w-full text-center`;
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

// 农历日期转换 - 使用lunar_utils.js和lunar.js中的方法
function getLunarDate(year, month, day) {
    // 创建日期对象
    const date = new Date(year, month - 1, day);

    // 优先使用lunar_utils.js中的方法
    try {
        const lunarDateText = window.lunarUtils.getLunarDateText(date);
        if (lunarDateText) {
            return lunarDateText;
        }
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