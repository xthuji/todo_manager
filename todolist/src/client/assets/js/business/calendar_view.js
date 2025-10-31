// 日历视图业务逻辑模块
// 针对页面：日历视图页面
// 业务功能模块：
// 1. 节日数据管理
// 2. 日历初始化与导航
// 3. 日期和节日判断
// 4. 日历渲染
// 5. 日期元素创建与样式设置

// 引入节假日管理模块 (假设其会挂载到 window.holidayManager)
import './common/holiday_manager.js';
// 引入lunar_utils.js工具 (假设其会挂载到 window.lunarUtils)
import './common/lunar_utils.js';

/**
 * [重构]
 * 1. 使用 IIFE (立即执行函数) 创建一个模块 `CalendarView`，避免污染全局命名空间。
 * 2. 所有的全局变量 (window.calendarConfig, window.allFestivals) 都被移入模块内部的 `this.config` 中。
 * 3. 所有的函数都成为模块的方法。
 */
(function() {

    // 模块主体
    const CalendarView = {

        // 缓存 DOM 元素引用
        dom: {
            grid: null,
            prevBtn: null,
            nextBtn: null,
            todayBtn: null,
            yearSelect: null,
            monthSelect: null
        },

        // [重构] 封装所有状态
        config: {
            currentYear: new Date().getFullYear(),
            currentMonth: new Date().getMonth(),
            currentDay: new Date().getDate(),
            festivals: [],
            holidays: {}, // 由 holidayManager 填充
            workdays: new Set() // 由 holidayManager 填充
        },

        /**
         * ----------------------------------------------------------------------
         * 1. 初始化与数据加载 (Initialization & Data Loading)
         * ----------------------------------------------------------------------
         */

        /**
         * [重构] 统一的初始化入口
         * 代替原有的 DOMContentLoaded 逻辑
         */
        init: async function() {
            try {
                // 1. 缓存 DOM 引用
                this.dom.grid = document.getElementById('calendar-grid');
                this.dom.prevBtn = document.getElementById('prev-month');
                this.dom.nextBtn = document.getElementById('next-month');
                this.dom.todayBtn = document.getElementById('btn-today');
                this.dom.yearSelect = document.getElementById('year-selector');
                this.dom.monthSelect = document.getElementById('month-selector');

                if (!this.dom.grid || !this.dom.prevBtn || !this.dom.nextBtn || !this.dom.todayBtn) {
                    console.error('日历核心 DOM 元素缺失');
                    return;
                }

                // 2. [重构] 统一加载所有数据
                await this._loadData();

                // 3. 填充选择器 (必须在加载数据之后，设置状态之前)
                this._populateSelectors();

                // 4. [重构] 统一设置事件处理器
                this._setupEventHandlers();

                // 5. 执行首次渲染
                this.render();

            } catch (error) {
                console.error('日历初始化失败:', error);
            }
        },

        /**
         * [重构] 统一的数据加载方法
         * 合并了原有的 initFestivals 和 loadHolidayData
         */
        _loadData: async function() {
            try {
                // 1. 加载节日配置
                // 假设 lunarUtils 在 window 上
                const config = await window.lunarUtils.loadHolidayConfig();
                this.config.festivals = config.festivals || [];

                // 2. 加载法定节假日数据
                // 假设 holidayManager 在 window 上
                await window.holidayManager.getHolidayData(true);
                // holidayManager 应该会填充 this.config.holidays 和 this.config.workdays
                // (注意：需要 holiday_manager.js 适配，使其能修改 CalendarView.config)
                // *安全降级*: 假设 holidayManager 仍然修改 window.calendarConfig
                // 那么我们需要在加载后同步一次
                if (window.calendarConfig) {
                    this.config.holidays = window.calendarConfig.holidays || {};
                    this.config.workdays = window.calendarConfig.workdays || new Set();
                }

            } catch (error) {
                console.error('加载日历数据时出错:', error);
                this.config.festivals = [];
                this.config.holidays = {};
                this.config.workdays = new Set();
            }
        },

        /**
         * 填充年份和月份选择器
         */
        _populateSelectors: function() {
            if (this.dom.yearSelect && this.dom.monthSelect) {
                // 生成年份选项（当前年份前后5年）
                const currentYear = new Date().getFullYear();
                for (let year = currentYear - 5; year <= currentYear + 5; year++) {
                    const option = document.createElement('option');
                    option.value = year;
                    option.textContent = `${year}年`;
                    this.dom.yearSelect.appendChild(option);
                }
            }
            // 状态同步将在 render() 中完成
        },

        /**
         * [重构] 统一的事件处理器设置
         */
        _setupEventHandlers: function() {
            // 使用 .bind(this) 确保方法内部的 `this` 指向 CalendarView 模块
            this.dom.prevBtn.onclick = this.goToPrevMonth.bind(this);
            this.dom.nextBtn.onclick = this.goToNextMonth.bind(this);
            this.dom.todayBtn.onclick = this.goToToday.bind(this);

            if (this.dom.yearSelect && this.dom.monthSelect) {
                this.dom.yearSelect.addEventListener('change', () => {
                    const year = parseInt(this.dom.yearSelect.value);
                    const month = parseInt(this.dom.monthSelect.value);
                    this._setCalendarMonth(year, month);
                });

                this.dom.monthSelect.addEventListener('change', () => {
                    const year = parseInt(this.dom.yearSelect.value);
                    const month = parseInt(this.dom.monthSelect.value);
                    this._setCalendarMonth(year, month);
                });
            }
        },

        /**
         * ----------------------------------------------------------------------
         * 2. 导航与状态控制 (Navigation & State Control)
         * ----------------------------------------------------------------------
         */

        /**
         * [重构] 通用的日历月份设置函数 (私有)
         * (原 setCalendarMonth)
         */
        _setCalendarMonth: function(year, month, day = null, button = null) {
            if (button) button.disabled = true;

            try {
                // 1. 更新内部状态
                this.config.currentYear = year;
                this.config.currentMonth = month;
                if (day !== null) {
                    this.config.currentDay = day;
                }

                console.log('日历状态更新:', this.config.currentYear, this.config.currentMonth);

                // 2. 强制重新渲染日历
                // [重构] 移除了 setTimeout(..., 0)，因为按钮禁用已提供保护
                // 如果仍需异步，可以保留
                this.render();

            } catch (error) {
                console.error('设置日历月份时出错:', error);
            } finally {
                if (button) button.disabled = false;
            }
        },

        // 切换到上个月 (公共方法)
        goToPrevMonth: function() {
            let newMonth = this.config.currentMonth - 1;
            let newYear = this.config.currentYear;
            if (newMonth < 0) {
                newMonth = 11;
                newYear--;
            }
            this._setCalendarMonth(newYear, newMonth, null, this.dom.prevBtn);
        },

        // 切换到下个月 (公共方法)
        goToNextMonth: function() {
            let newMonth = this.config.currentMonth + 1;
            let newYear = this.config.currentYear;
            if (newMonth > 11) {
                newMonth = 0;
                newYear++;
            }
            this._setCalendarMonth(newYear, newMonth, null, this.dom.nextBtn);
        },

        // 切换到今天 (公共方法)
        goToToday: function() {
            const today = new Date();
            this._setCalendarMonth(today.getFullYear(), today.getMonth(), today.getDate(), this.dom.todayBtn);
        },

        /**
         * ----------------------------------------------------------------------
         * 3. 渲染逻辑 (Rendering)
         * [重构] 分离了 "逻辑" 和 "渲染"
         * ----------------------------------------------------------------------
         */

        /**
         * [重构] 主渲染函数
         * (原 renderCalendar)
         * 职责：编排。调用逻辑函数获取数据，调用渲染函数更新DOM。
         */
        render: function() {
            try {
                console.log('开始渲染日历:', this.config.currentYear, this.config.currentMonth);

                // 1. 同步选择器状态
                this._updateSelectors();

                // 2. [重构] 调用纯逻辑函数获取日历网格数据
                const calendarGridData = this._buildMonthGrid(this.config.currentYear, this.config.currentMonth);

                // 3. 清空日历网格
                this.dom.grid.innerHTML = '';

                // 4. 渲染
                calendarGridData.forEach(week => {
                    week.forEach((dayData, dayIndex) => {
                        if (dayData) {
                            // [重构] 调用 _createDayElement (只负责渲染)
                            const dayElement = this._createDayElement(dayData, dayIndex);
                            this.dom.grid.appendChild(dayElement);
                        } else {
                            // 理论上 _buildMonthGrid 应该填充
                            const emptyDay = document.createElement('div');
                            emptyDay.className = 'calendar-day';
                            this.dom.grid.appendChild(emptyDay);
                        }
                    });
                });

            } catch (error) {
                console.error('渲染日历失败:', error);
            }
        },

        /**
         * 更新选择器的值以匹配当前状态
         */
        _updateSelectors: function() {
            if (this.dom.yearSelect) {
                // 确保选项存在
                if (!this.dom.yearSelect.querySelector(`option[value="${this.config.currentYear}"]`)) {
                    const option = document.createElement('option');
                    option.value = this.config.currentYear;
                    option.textContent = `${this.config.currentYear}年`;
                    this.dom.yearSelect.appendChild(option);
                }
                this.dom.yearSelect.value = this.config.currentYear;
            }
            if (this.dom.monthSelect) {
                this.dom.monthSelect.value = this.config.currentMonth;
            }
        },

        /**
         * ----------------------------------------------------------------------
         * 4. 纯逻辑层 (Logic / ViewModel)
         * [重构] 从渲染函数中剥离的纯计算逻辑
         * ----------------------------------------------------------------------
         */

        /**
         * [重构] 纯逻辑函数：构建日历网格
         * @returns {Array<Array<object>>} 6x7 的 2D 数组，包含 { date, isCurrentMonth }
         */
        _buildMonthGrid: function(year, month) {
            const firstDayOfMonth = new Date(year, month, 1);
            const lastDayOfMonth = new Date(year, month + 1, 0);

            const firstDayOfWeek = firstDayOfMonth.getDay(); // 0=周日, 1=周一
            const daysInMonth = lastDayOfMonth.getDate();

            const calendarData = Array(6).fill().map(() => Array(7).fill(null));

            // 计算上月天数
            let daysFromPrevMonth = (firstDayOfWeek === 0) ? 6 : (firstDayOfWeek - 1); // 0=周一 ... 6=周日
            const lastDayOfPrevMonth = new Date(year, month, 0).getDate();

            // 填充上月
            for (let i = daysFromPrevMonth - 1; i >= 0; i--) {
                const day = lastDayOfPrevMonth - i;
                calendarData[0][daysFromPrevMonth - 1 - i] = {
                    date: new Date(year, month - 1, day),
                    isCurrentMonth: false
                };
            }

            // 填充本月
            let currentWeek = 0;
            let currentDay = daysFromPrevMonth;
            for (let day = 1; day <= daysInMonth; day++) {
                if (currentDay > 6) {
                    currentDay = 0;
                    currentWeek++;
                }
                // 确保不超出 6 周
                if (currentWeek < 6) {
                    calendarData[currentWeek][currentDay] = {
                        date: new Date(year, month, day),
                        isCurrentMonth: true
                    };
                }
                currentDay++;
            }

            // 填充下月
            let nextMonthDay = 1;
            while (currentWeek < 6) {
                while (currentDay < 7) {
                    // 确保不超出 6 周
                    if (currentWeek < 6) {
                        calendarData[currentWeek][currentDay] = {
                            date: new Date(year, month + 1, nextMonthDay),
                            isCurrentMonth: false
                        };
                        nextMonthDay++;
                    }
                    currentDay++;
                }
                currentDay = 0;
                currentWeek++;
            }

            // [优化] 只返回包含数据的行
            return calendarData.filter(week => week.some(day => day !== null));
        },

        /**
         * [重构] 纯逻辑函数：获取日期的所有信息
         * @param {Date} date - 日期对象
         * @param {number} dayIndex - 星期几的索引 (0=周一, 6=周日)
         * @returns {object} - 包含所有日期元数据的对象
         */
        _getDayInfo: function(date, dayIndex) {
            const today = new Date();
            const isToday = date.getFullYear() === today.getFullYear() &&
                date.getMonth() === today.getMonth() &&
                date.getDate() === today.getDate();

            // 0-6 (周一到周日)
            const isWeekend = dayIndex === 5 || dayIndex === 6;

            // 假设 holidayManager 在 window 上
            const dateType = window.holidayManager.getDateType(date);
            const isHoliday = dateType === 'holiday';
            const isWorkday = dateType === 'workday';

            // 假设 lunarUtils 在 window 上
            let lunarDate = '';
            let festivals = [];
            try {
                lunarDate = window.lunarUtils.getLunarDateText(date) || '';
                festivals = window.lunarUtils.getFestivalsSync(date) || [];
            } catch (e) {
                console.error("lunar_utils.js 调用失败:", e);
            }

            return {
                date: date,
                dayNum: date.getDate(),
                isToday: isToday,
                isWeekend: isWeekend,
                isHoliday: isHoliday,
                isWorkday: isWorkday,
                lunarDate: lunarDate,
                festivals: festivals
            };
        },

        /**
         * [重构] 纯逻辑函数：根据信息构建 CSS 类
         * @returns {Array<string>}
         */
        _buildDayClasses: function(dayInfo, isCurrentMonth) {
            let classes = ['calendar-day'];

            if (!isCurrentMonth) {
                classes.push('calendar-day-other_month');
                if (dayInfo.isHoliday) classes.push('calendar-day-holiday');
                else if (dayInfo.isWorkday) classes.push('calendar-day-workday');
            } else if (dayInfo.isHoliday) {
                classes.push('calendar-day-holiday');
            } else if (dayInfo.isWorkday) {
                classes.push('calendar-day-workday');
            } else if (dayInfo.isWeekend) {
                classes.push('calendar-day-weekend');
            } else {
                classes.push('calendar-day-weekday');
            }

            if (dayInfo.isToday) {
                classes.push('calendar-day-today');
            }

            return classes;
        },

        /**
         * ----------------------------------------------------------------------
         * 5. 纯渲染层 (DOM Creation)
         * [重构] 从逻辑中剥离的纯 DOM 创建
         * ----------------------------------------------------------------------
         */

        /**
         * [重构] "哑巴"渲染函数：创建日期元素
         * (原 createDayElement)
         * @param {object} dayData - 来自 _buildMonthGrid 的 { date, isCurrentMonth }
         * @param {number} dayIndex - 星期几的索引 (0-6)
         * @returns {HTMLElement}
         */
        _createDayElement: function(dayData, dayIndex) {

            // 1. [重构] 调用逻辑函数获取所有信息
            const info = this._getDayInfo(dayData.date, dayIndex);

            // 2. [重构] 调用逻辑函数获取 CSS 类
            const dayClasses = this._buildDayClasses(info, dayData.isCurrentMonth);

            // 3. --- 开始纯 DOM 创建 ---
            const dayContainer = document.createElement('div');
            dayContainer.className = dayClasses.join(' ');

            const dayContent = document.createElement('div');
            dayContent.className = 'calendar-day-content';

            const dateContentContainer = document.createElement('div');
            dateContentContainer.className = 'flex items-center mb-0.5';

            const dayNumber = document.createElement('span');
            dayNumber.className = 'calendar-day-number';
            if (!dayData.isCurrentMonth) {
                dayNumber.className += ' calendar-day-number-other_month';
            }

            // [重构] 简化样式逻辑
            if (info.isHoliday || (info.isWeekend && !info.isWorkday)) {
                dayNumber.style.color = '#dc2626'; // 红色
            } else {
                dayNumber.style.color = '#111827'; // 黑色
            }

            if (info.isToday) {
                dayNumber.className += ' border-2 border-blue-500 w-6 h-6 inline-flex items-center justify-center rounded-full';
            }
            dayNumber.textContent = info.dayNum;

            dateContentContainer.appendChild(dayNumber);

            // 农历
            if (info.lunarDate) {
                const lunarElement = document.createElement('span');
                lunarElement.className = 'text-xs text-gray-500 ml-1';
                lunarElement.textContent = info.lunarDate;
                dateContentContainer.appendChild(lunarElement);
            }

            dayContent.appendChild(dateContentContainer);

            // 节日
            const festivalContainer = document.createElement('div');
            festivalContainer.className = 'festival-container flex flex-col items-end gap-0.5 w-full';

            if (info.festivals.length > 0) {
                info.festivals.forEach(festival => {
                    const festivalTag = document.createElement('div');
                    // 假设 lunarUtils 在 window 上
                    festivalTag.className = `festival-tag ${window.lunarUtils.getFestivalTypeClass(festival.type)} w-full text-center`;
                    festivalTag.textContent = festival.name;
                    festivalContainer.appendChild(festivalTag);
                });
            }

            dayContent.appendChild(festivalContainer);
            dayContainer.appendChild(dayContent);

            // 添加点击事件
            dayContainer.addEventListener('click', function() {
                console.log('点击了日期:', info.date);
            });

            return dayContainer;
        }
    };

    // 启动日历
    document.addEventListener('DOMContentLoaded', () => {
        // [重构] 将 CalendarView 挂载到 window，以便其他模块 (如 holidayManager) 可以访问它
        // 这是一个折衷方案，比完全的全局变量要好
        window.CalendarView = CalendarView;
        CalendarView.init();
    });

})();

// [移除]
// 删除了所有旧的全局函数 (initFestivals, loadHolidayData, initCalendar, renderCalendar, createDayElement, getLunarDate, 等)
// 它们的功能已被 CalendarView 模块的方法替代。