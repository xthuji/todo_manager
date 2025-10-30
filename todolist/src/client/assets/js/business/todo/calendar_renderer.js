// 日历渲染模块
// 针对页面：日历视图页面
// 业务功能模块：
// 1. 渲染日历视图，包括年月选择、日期单元格生成
// 2. 根据日期类型（工作日、周末、节假日、补班日）设置不同样式
// 3. 显示每日任务，支持连续任务的特殊展示
// 4. 根据任务状态和优先级设置不同样式
// 5. 提供任务点击编辑功能
// 6. 支持任务颜色分配和行位置管理
import { calculateTaskDisplayStatus } from './task_parser.js';
import { getHolidayData, getDateType } from '../common/holiday_manager.js';
import { editTask } from './task_operations.js';
// 引入lunar_utils.js工具
import '../common/lunar_utils.js';

// 渲染日历
export async function renderCalendar(date, tasks = []) {
    console.log('renderCalendar:', date);
    // 确保节假日数据已加载
    const holidayData = await getHolidayData();
    
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // 重置任务行映射，避免月份切换时出现非预期的空行
    if (!window.weeklyTaskRowsMap) {
        window.weeklyTaskRowsMap = new Map();
    } else {
        window.weeklyTaskRowsMap.clear();
    }
    
    // 更新月份显示 - 改为可修改的形式
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const calendarMonthElement = document.getElementById('calendar-month');
    
    // 创建可编辑的年月显示
    calendarMonthElement.innerHTML = `
        <select id="year-select" class="bg-transparent border-0 text-lg font-semibold focus:ring-1 focus:ring-blue-500">
            ${Array.from({length: 5}, (_, i) => year - 2 + i).map(y => 
                `<option value="${y}" ${y === year ? 'selected' : ''}>${y}年</option>`
            ).join('')}
        </select>
        <select id="month-select" class="bg-transparent border-0 text-lg font-semibold focus:ring-1 focus:ring-blue-500">
            ${monthNames.map((name, idx) => 
                `<option value="${idx}" ${idx === month ? 'selected' : ''}>${name}</option>`
            ).join('')}
        </select>
    `;
    
    // 添加年月选择的事件监听
    document.getElementById('year-select').addEventListener('change', (e) => {
        const newYear = parseInt(e.target.value);
        const newDate = new Date(newYear, month, 1);
        renderCalendar(newDate, tasks);
    });
    
    document.getElementById('month-select').addEventListener('change', (e) => {
        const newMonth = parseInt(e.target.value);
        const newDate = new Date(year, newMonth, 1);
        renderCalendar(newDate, tasks);
    });
    
    // 清空日历
    const calendarGrid = document.getElementById('calendar-grid');
    calendarGrid.innerHTML = '';
    
    // 获取当月第一天和最后一天
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // 获取当月第一天是星期几
    const firstDayIndex = firstDay.getDay();
    
    // 调整第一天的位置
    let adjustedFirstDayIndex = firstDayIndex;
    if (firstDayIndex === 0) {
        adjustedFirstDayIndex = 7;
    }
    
    // 获取当月天数
    const daysInMonth = lastDay.getDate();
    
    // 添加上月剩余天数
    const prevDaysToShow = Math.min(adjustedFirstDayIndex - 1, 7);
    if (prevDaysToShow > 0 && daysInMonth > 0) {
        for (let i = prevDaysToShow; i > 0; i--) {
            const prevDay = new Date(year, month, -i + 1);
            const dayElement = document.createElement('div');
            dayElement.classList.add('calendar-day', 'text-gray-400', 'bg-calendar-other_month');
            
            // 添加日期头部
            const dateHeader = document.createElement('div');
            dateHeader.classList.add('text-sm', 'font-medium', 'mb-1');
            
            // 创建日期内容容器
            const dateContentContainer = document.createElement('div');
            dateContentContainer.classList.add('flex', 'items-center', 'justify-between', 'w-full');
            
            // 创建日期数字元素
            const dateNumberElement = document.createElement('span');
            dateNumberElement.textContent = prevDay.getDate();
            
            // 创建左侧容器（包含日期数字和农历）
            const leftContentContainer = document.createElement('div');
            leftContentContainer.classList.add('flex', 'items-center');
            leftContentContainer.appendChild(dateNumberElement);
            
            // 获取农历日期和节日信息
            let lunarDate = '';
            let festivalInfo = '';
            
            try {
                // 使用lunar_utils.js中的方法获取农历日期
                if (window.lunarUtils && typeof window.lunarUtils.getLunarDateText === 'function') {
                    lunarDate = window.lunarUtils.getLunarDateText(prevDay);
                }
                
                // 获取节日信息（参考calendar_view.js的实现）
                const festivals = await getFestivalsForDate(prevDay);
                if (festivals && festivals.length > 0) {
                    // 显示全部节日
                    for (const festival of festivals) {
                        // 获取节日样式
                        let festivalStyle = 'bg-festival-custom'; // 默认样式
                        if (window.lunarUtils && typeof window.lunarUtils.getFestivalStyleClass === 'function') {
                            festivalStyle = window.lunarUtils.getFestivalStyleClass(festival.type);
                        }
                        
                        // 添加festival-tag类确保一致的样式
                        festivalInfo = `${festivalInfo}<span class="${festivalStyle} festival-tag">${festival.name}</span>`;
                    }
                }
            } catch (error) {
                console.warn('获取农历或节日信息失败:', error);
            }
            
            // 添加农历日期（如果有）到左侧容器
            if (lunarDate) {
                const lunarElement = document.createElement('span');
                lunarElement.classList.add('text-xs', 'ml-1', 'text-gray-500');
                lunarElement.textContent = lunarDate;
                leftContentContainer.appendChild(lunarElement);
            }
            
            // 将左侧容器添加到主容器
            dateContentContainer.appendChild(leftContentContainer);
            
            // 添加节日信息（如果有）到最右侧
            if (festivalInfo) {
                const festivalElement = document.createElement('span');
                festivalElement.classList.add('text-xs', 'ml-auto');
                festivalElement.innerHTML = festivalInfo;
                dateContentContainer.appendChild(festivalElement);
            }
            
            dateHeader.appendChild(dateContentContainer);
            dayElement.appendChild(dateHeader);
            
            calendarGrid.appendChild(dayElement);
        }
    }
    
    // 添加当月天数
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 处理每天的任务
    for (let day = 1; day <= daysInMonth; day++) {
        const currentDay = new Date(year, month, day);
        
        // 格式化日期为YYYY-MM-DD格式，用于匹配
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // 创建日期单元格元素
        const dayElement = document.createElement('div');
        dayElement.classList.add('calendar-day');
        // 添加data-date属性，用于跳转到指定日期
        dayElement.setAttribute('data-date', dateString);
        
        // 检查是否是周末
        const isWeekend = currentDay.getDay() === 0 || currentDay.getDay() === 6;
        
        // 检查是否是节假日或工作日
        let dateType = 'weekday'; // 默认工作日
        try {
            const tempDateType = getDateType(currentDay);
            if (tempDateType) {
                dateType = tempDateType;
            }
        } catch (e) {
            console.warn('获取日期类型失败:', e);
        }
        
        // 按优先级设置背景色：节假日>补班>周六日
        if (dateType === 'holiday') {
            dayElement.classList.add('bg-calendar-holiday');
        } else if (dateType === 'workday') {
            dayElement.classList.add('bg-calendar-workday');
        } else if (isWeekend) {
            dayElement.classList.add('bg-calendar-weekend');
        }
        
        // 添加日期号
        const dateHeader = document.createElement('div');
        dateHeader.classList.add('text-sm', 'font-medium', 'mb-1');
        
        // 创建日期内容容器
        const dateContentContainer = document.createElement('div');
        dateContentContainer.classList.add('flex', 'items-center', 'justify-between', 'w-full');
        
        // 创建日期数字元素
        const dateNumberElement = document.createElement('span');
        dateNumberElement.textContent = day;
        
        // 检查是否是今天
        const isToday = currentDay.getTime() === today.getTime();
        
        // 如果是今天，添加蓝色圆形背景和白色文字
        if (isToday) {
            dayElement.classList.add('calendar-day-today', 'bg-blue-100');
            dateNumberElement.classList.add('w-6', 'h-6', 'flex', 'items-center', 'justify-center', 'bg-blue-500', 'text-white', 'rounded-full', 'text-xs', 'font-bold');
        }
        
        // 创建左侧容器（包含日期数字和农历）
        const leftContentContainer = document.createElement('div');
        leftContentContainer.classList.add('flex', 'items-center');
        leftContentContainer.appendChild(dateNumberElement);
        
        // 获取农历日期和节日信息
        let lunarDate = '';
        let festivalInfo = '';
        
        try {
            // 使用lunar_utils.js中的方法获取农历日期
            if (window.lunarUtils && typeof window.lunarUtils.getLunarDateText === 'function') {
                lunarDate = window.lunarUtils.getLunarDateText(currentDay);
                // console.log('currentDay:', currentDay, 'lunarDate:', lunarDate);
            }
            
            // 获取节日信息（参考calendar_view.js的实现）
            const festivals = await getFestivalsForDate(currentDay);
            if (festivals && festivals.length > 0) {
                // 显示全部节日
                for (const festival of festivals) {
                    // 获取节日样式
                    let festivalStyle = 'bg-festival-custom'; // 默认样式
                    if (window.lunarUtils && typeof window.lunarUtils.getFestivalStyleClass === 'function') {
                        festivalStyle = window.lunarUtils.getFestivalStyleClass(festival.type);
                    }
                    
                    // 添加统一的节日标签样式，包含festival-tag类和通用样式
                    festivalInfo = `${festivalInfo}<span class="${festivalStyle} festival-tag text-xs px-1 py-0.5 rounded text-white whitespace-nowrap">${festival.name}</span>`;
                }
                console.log('currentDay:', currentDay, 'festivalInfo:', festivalInfo);
            }
        } catch (error) {
            console.warn('获取农历或节日信息失败:', error);
        }
        
        // 添加农历日期（如果有）到左侧容器
        if (lunarDate) {
            const lunarElement = document.createElement('span');
            lunarElement.classList.add('text-xs', 'ml-1', 'text-gray-500');
            lunarElement.textContent = lunarDate;
            leftContentContainer.appendChild(lunarElement);
        }
        
        // 将左侧容器添加到主容器
        dateContentContainer.appendChild(leftContentContainer);
        
        // 添加节日信息（如果有）到最右侧
        if (festivalInfo) {
            const festivalElement = document.createElement('span');
            festivalElement.classList.add('text-xs', 'ml-auto');
            festivalElement.innerHTML = festivalInfo;
            dateContentContainer.appendChild(festivalElement);
        }
        
        dateHeader.appendChild(dateContentContainer);

        dayElement.classList.add('text-gray-800');
        
        dayElement.appendChild(dateHeader);
        
        // 查找当天的任务
        let dayTasks = [];
        
        // 找出所有包含当前日期的连续任务
        tasks.forEach(task => {
            // 普通任务，只检查截止日期
            if (!task.startDate || task.startDate === task.dueDate) {
                if (task.dueDate && task.dueDate === dateString) {
                    dayTasks.push(task);
                }
            } else {
                // 连续任务，检查当前日期是否在任务的开始日期和截止日期之间
                const taskStartDate = new Date(task.startDate);
                const taskDueDate = new Date(task.dueDate);
                
                // 确保日期格式一致
                taskStartDate.setHours(0, 0, 0, 0);
                taskDueDate.setHours(0, 0, 0, 0);
                currentDay.setHours(0, 0, 0, 0);
                
                // 如果当前日期在任务的开始和截止日期之间
                if (currentDay >= taskStartDate && currentDay <= taskDueDate) {
                    // 复制任务对象，避免修改原始数据
                    const taskCopy = { ...task };
                    // 标记为连续任务
                    taskCopy.isContinuous = true;
                    // 计算任务在连续时间中的位置
                    taskCopy.startOfTask = taskStartDate;
                    taskCopy.endOfTask = taskDueDate;
                    dayTasks.push(taskCopy);
                }
            }
        });
        
        // 特殊处理：如果是节假日，显示在当前节假日的任务
        if (dateType === 'holiday') {
            dayTasks = dayTasks.filter(task => {
                // 检查任务是否在当前节假日当天
                // 1. 对于有起止日期的任务，检查当前日期是否在任务时间范围内或起止日期与当前日期相同
                if (task.startDate && task.dueDate) {
                    const taskStart = new Date(task.startDate);
                    const taskEnd = new Date(task.dueDate);
                    taskStart.setHours(0, 0, 0, 0);
                    taskEnd.setHours(0, 0, 0, 0);
                    currentDay.setHours(0, 0, 0, 0);
                    
                    return (currentDay >= taskStart && currentDay <= taskEnd) || 
                           (taskStart.toDateString() === currentDay.toDateString()) ||
                           (taskEnd.toDateString() === currentDay.toDateString());
                }
                // 2. 对于只有截止日期的任务，检查截止日期是否与当前日期相同
                else if (task.dueDate) {
                    return new Date(task.dueDate).toDateString() === currentDay.toDateString();
                }
                // 3. 其他情况不显示
                return false;
            });
        }
        
        // 根据日期类型和任务类型过滤任务：
        // 1. 工作日和补班日显示所有任务
        // 2. 对于假日/周末：
        //    a. 如果任务的起止日期都在假日/周末范围内，显示该任务
        //    b. 否则（跨度较大的普通工作任务）不在假日/周末显示
        if (dateType === 'holiday' || dateType === 'weekend') {
            dayTasks = dayTasks.filter(task => {
                // 检查任务是否是假日/周末专属任务
                if (task.startDate && task.dueDate) {
                    const taskStart = new Date(task.startDate);
                    const taskEnd = new Date(task.dueDate);
                    taskStart.setHours(0, 0, 0, 0);
                    taskEnd.setHours(0, 0, 0, 0);
                    currentDay.setHours(0, 0, 0, 0);
                    
                    // 检查任务的起止日期是否都在假日/周末
                    let isHolidayOrWeekendTask = true;
                    const tempDate = new Date(taskStart);
                    
                    while (tempDate <= taskEnd) {
                        const tempDateType = getDateType(tempDate);
                        // 如果任务期间包含工作日或补班日，则不是假日/周末专属任务
                        if (tempDateType === 'weekday' || tempDateType === 'workday') {
                            isHolidayOrWeekendTask = false;
                            break;
                        }
                        tempDate.setDate(tempDate.getDate() + 1);
                    }
                    
                    // 对于假日/周末专属任务，只要当前日期在任务期间内就显示
                    // 对于普通工作任务，只在工作日和补班日显示（这里会被过滤掉）
                    return isHolidayOrWeekendTask && currentDay >= taskStart && currentDay <= taskEnd;
                }
                // 对于只有截止日期的任务，检查截止日期是否与当前日期相同且是假日/周末专属
                else if (task.dueDate) {
                    const dueDate = new Date(task.dueDate);
                    const dueDateType = getDateType(dueDate);
                    return dueDate.toDateString() === currentDay.toDateString() && 
                           (dueDateType === 'holiday' || dueDateType === 'weekend');
                }
                return false;
            });
        }
        
        // 添加任务卡片
        if (dayTasks.length > 0) {
            // 创建网格布局容器，支持多行多列显示，高度自适应任务数量
            const tasksContainer = document.createElement('div');
            tasksContainer.classList.add('mt-1', 'space-y-1', 'min-h-[100px]', 'overflow-visible');
            
            // 计算当前日期所在的周数
            const weekOfYear = Math.ceil(((currentDay - new Date(currentDay.getFullYear(), 0, 1)) / 86400000 + new Date(currentDay.getFullYear(), 0, 1).getDay() + 1) / 7);
            
            // 获取任务背景色类的函数
            const getTaskBackgroundClass = (taskId) => {
                // 确保当前周的任务颜色映射存在
                if (!window.weeklyTaskColorsMap) {
                    window.weeklyTaskColorsMap = new Map();
                }
                
                if (!window.weeklyTaskColorsMap.has(weekOfMonth)) {
                    window.weeklyTaskColorsMap.set(weekOfMonth, new Map());
                }
                
                const weekTaskColors = window.weeklyTaskColorsMap.get(weekOfMonth);
                
                // 如果任务已经有分配的颜色，直接返回
                if (weekTaskColors.has(taskId)) {
                    const colorIndex = weekTaskColors.get(taskId);
                    return `bg-task-color-${colorIndex + 1}`;
                }
                
                // 收集当前周已使用的颜色索引
                const usedColorIndices = Array.from(weekTaskColors.values());
                
                // 从HTML的tailwind.config中获取任务颜色数量（10种颜色）
                const totalColors = 10;
                
                // 尝试找到未使用的颜色索引
                let colorIndex = 0;
                for (let i = 0; i < totalColors; i++) {
                    if (!usedColorIndices.includes(i)) {
                        colorIndex = i;
                        break;
                    }
                }
                
                // 如果所有颜色都被使用了，就使用任务ID的哈希值来选择一个稳定的颜色
                if (usedColorIndices.includes(colorIndex)) {
                    const strId = taskId.toString();
                    let hash = 0;
                    for (let i = 0; i < strId.length; i++) {
                        hash = strId.charCodeAt(i) + ((hash << 5) - hash);
                    }
                    colorIndex = Math.abs(hash % totalColors);
                }
                
                // 保存分配的颜色索引
                weekTaskColors.set(taskId, colorIndex);
                
                return `bg-task-color-${colorIndex + 1}`;
            };
            
            // 计算当前日期所在的月份中的周数（1-6）
            const currentDate = new Date(dateString);
            // 获取当月第一天是星期几（0-6，0是周日）
            const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
            // 调整为周一作为每周的第一天（将0表示的周日转换为7）
            const adjustedFirstDayOfMonth = firstDayOfMonth === 0 ? 7 : firstDayOfMonth;
            // 获取当前日期是星期几
            const currentDayOfWeek = currentDate.getDay();
            const adjustedCurrentDayOfWeek = currentDayOfWeek === 0 ? 7 : currentDayOfWeek;
            // 计算当前日期所在的周数（周一作为每周第一天）
            const weekOfMonth = Math.ceil((currentDate.getDate() - (adjustedCurrentDayOfWeek - 1) + (adjustedFirstDayOfMonth - 1)) / 7);
            
            // 全局存储每周任务行位置映射
            if (!window.weeklyTaskRowsMap) {
                window.weeklyTaskRowsMap = new Map();
            }
            
            // 检查当前日期是否是周一（getDay()返回1表示周一）
            const isMonday = currentDate.getDay() === 1;
            
            // 确保当前周的映射存在
            // 对于周一，即使映射已存在也重新创建，确保每周一重新计算任务行位置
            if (!window.weeklyTaskRowsMap.has(weekOfMonth) || isMonday) {
                window.weeklyTaskRowsMap.set(weekOfMonth, new Map());
            }
            
            // 获取当前周的任务行位置映射
            const weekTaskRows = window.weeklyTaskRowsMap.get(weekOfMonth);
            
            // 为每个任务分配行位置，确保相同任务在一周内每天保持相同位置
        const taskRows = new Map();
        
        dayTasks.forEach(task => {
            // 如果是新任务的第一天或者任务不在当前周的映射中
            if ((task.isContinuous && task.startDate === dateString) || !weekTaskRows.has(task.id)) {
                // 找出当前周已经使用的所有行索引
                const usedRows = Array.from(weekTaskRows.values());
                const maxUsedRow = usedRows.length > 0 ? Math.max(...usedRows) : -1;
                
                // 尝试为任务找到上方的空位
                let assignedRowIndex = maxUsedRow + 1; // 默认使用新行
                
                // 如果是任务的第一天，优先寻找符合条件的空行位置
                if (task.isContinuous && task.startDate === dateString) {
                    // 检查前一天的日期
                    const prevDate = new Date(dateString);
                    prevDate.setDate(prevDate.getDate() - 1);
                    const prevDateString = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;
                    
                    // 遍历所有可能的行索引，从顶部开始
                    for (let i = 0; i <= maxUsedRow + 1; i++) {
                        // 检查条件1：当前行在当前日期是否可用
                        if (!usedRows.includes(i)) {
                            // 检查条件2：前一天的相同位置是否为空占位
                            // 由于我们无法直接获取前一天的数据，我们假设weekTaskRows中包含了前一天的空占位信息
                            const hasPrevDayEmptyPlaceholder = Array.from(weekTaskRows.entries()).some(([taskId, rowIndex]) => 
                                typeof taskId === 'string' && taskId.startsWith(`empty-${prevDateString}`) && rowIndex === i
                            );
                            
                            // 检查条件3：本周后面几天是否有相同行位置还没结束的任务
                            let hasOverlappingTask = false;
                            
                            // 检查当前周内是否有相同行位置的其他任务
                            for (const [existingTaskId, existingRowIndex] of weekTaskRows.entries()) {
                                // 跳过空白占位任务
                                if (typeof existingTaskId === 'string' && existingTaskId.startsWith('empty-')) continue;
                                
                                // 如果找到相同行位置的任务
                                if (existingRowIndex === i) {
                                    hasOverlappingTask = true;
                                    break;
                                }
                            }
                            
                            // 如果满足所有条件，分配这个行位置
                            if (hasPrevDayEmptyPlaceholder && !hasOverlappingTask) {
                                assignedRowIndex = i;
                                break;
                            }
                        }
                    }
                } else {
                    // 遍历所有可能的行索引，从顶部开始
                    for (let i = 0; i <= maxUsedRow + 1; i++) {
                        // 检查当前行是否为空
                        if (!usedRows.includes(i)) {
                            assignedRowIndex = i;
                            break;
                        }
                    }
                }
                
                // 为任务分配行位置
                weekTaskRows.set(task.id, assignedRowIndex);
            }
            
            // 获取任务在当前周的行索引
            const taskRowIndex = weekTaskRows.get(task.id);
            
            // 将任务添加到对应的行
            if (!taskRows.has(taskRowIndex)) {
                taskRows.set(taskRowIndex, []);
            }
            taskRows.get(taskRowIndex).push(task);
        });
            
            // 检查当前日期的任务行，确保所有应该显示的任务都有占位
            const maxRowIndex = Math.max(...Array.from(taskRows.keys()), 0);
            for (let i = 0; i <= maxRowIndex; i++) {
                if (!taskRows.has(i)) {
                    // 创建空白占位任务
                    const emptyPlaceholder = {
                        id: `empty-${dateString}-${i}`,
                        isEmpty: true
                    };
                    taskRows.set(i, [emptyPlaceholder]);
                }
            };
            
            // 转换为数组并按行索引排序
            const taskRowsArray = Array.from(taskRows.entries());
            taskRowsArray.sort((a, b) => a[0] - b[0]);
            
            // 为每个任务行创建行
            taskRowsArray.forEach(([rowIndex, rowTasks]) => {
                // 处理空白占位任务
                if (rowTasks.length === 1 && rowTasks[0].isEmpty) {
                    const emptyPlaceholder = document.createElement('div');
                    emptyPlaceholder.classList.add('flex-1', 'h-[30px]', 'border', 'border-dashed', 'border-gray-100', 'rounded-lg');
                    tasksContainer.appendChild(emptyPlaceholder);
                    return;
                }
                
                // 如果一行只有一个任务，直接显示
                if (rowTasks.length === 1) {
                    const task = rowTasks[0];
                    const taskCard = document.createElement('div');
                    taskCard.classList.add('flex-1', 'h-[30px]');
                    
                    // 根据任务状态获取颜色类 - 传入整个task对象以便使用预计算的displayStatus
                    const statusColorClass = getTaskStatusColorClass(task);
                    
                    // 获取任务背景色类
                    const backgroundClass = getTaskBackgroundClass(task.id);
                    
                    // 添加基础样式和状态边框 - 使用与状态对应的彩色边框
                    taskCard.classList.add('p-1', 'text-xs', 'rounded-lg', 'border-2', 'shadow-sm', 'truncate', 'cursor-pointer', 'hover:opacity-90', 'transition-opacity', 'flex', 'items-center', backgroundClass);
                    
                    // 根据状态添加对应的彩色边框类（与图例一致）
                    taskCard.classList.add(`border-status-${statusColorClass}`);
                    
                    // 如果是连续任务，添加特殊样式以区分
                    if (task.isContinuous) {
                        // 获取任务的起始日期和结束日期
                        const startDate = new Date(task.startDate);
                        const endDate = new Date(task.dueDate);
                        const currentTaskDate = new Date(dateString);
                        
                        // 计算当前日期是任务的第几天
                        const dayOfTask = Math.floor((currentTaskDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
                        
                        // 添加连续任务的特殊样式
                        taskCard.classList.add('continuous-task-item');
                        
                        // 根据日期位置添加不同的样式（开始、中间、结束）
                        if (dayOfTask === 1) {
                            taskCard.classList.add('task-item-first');
                        } else if (dayOfTask === Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1) {
                            taskCard.classList.add('task-item-last');
                        } else {
                            taskCard.classList.add('task-item-middle');
                        }
                    }
                    
                    // 根据优先级设置颜色
                        let priorityColorClass = '';
                        if (task.priority === 'A') priorityColorClass = 'bg-priority-A';
                        else if (task.priority === 'B') priorityColorClass = 'bg-priority-B';
                        else if (task.priority === 'C') priorityColorClass = 'bg-priority-C';
                        else if (task.priority === 'D') priorityColorClass = 'bg-priority-D';
                        else if (task.priority === 'E') priorityColorClass = 'bg-priority-E';
                        else priorityColorClass = 'bg-priority-none';
                        
                        // 为连续任务添加额外的标识，显示任务在连续时间中的位置
                        let continuousTaskIndicator = '';
                        if (task.isContinuous) {
                            const startDate = new Date(task.startDate);
                            const endDate = new Date(task.dueDate);
                            const currentTaskDate = new Date(dateString);
                            
                            // 计算当前日期是任务的第几天（自然日）
                            const dayOfTask = Math.floor((currentTaskDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
                            const totalDaysOfTask = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
                            
                            // 计算工作日进度（根据当前日期）
                            if (task.startDate && task.dueDate) {
                                const start = new Date(task.startDate);
                                const end = new Date(task.dueDate);
                                
                                // 计算总工作日天数（只统计工作日和补班天数）
                                let totalWorkDays = 0;
                                let completedWorkDaysForCurrentDate = 0;
                                
                                // 遍历任务期间的每一天
                                const tempDate = new Date(start);
                                while (tempDate <= end) {
                                    // 获取日期类型
                                    const dateType = getDateType(tempDate);
                                    
                                    // 只统计工作日和补班天数，排除周末和普通节假日
                                    // 特殊情况：如果是专门为节假日创建的任务，也计入工作日
                                    const isWorkDay = dateType === 'weekday' || dateType === 'workday';
                                    const isHolidaySpecialTask = dateType === 'holiday' && start.toDateString() === tempDate.toDateString() && end.toDateString() === tempDate.toDateString();
                                    
                                    if (isWorkDay || isHolidaySpecialTask) {
                                        totalWorkDays++;
                                        
                                        // 检查是否在当前日期之前或当天（基于日历上的日期）
                                        if (tempDate <= currentTaskDate) {
                                            completedWorkDaysForCurrentDate++;
                                        }
                                    }
                                    
                                    // 移动到下一天
                                    tempDate.setDate(tempDate.getDate() + 1);
                                }
                                
                                completedWorkDaysForCurrentDate = Math.min(completedWorkDaysForCurrentDate, totalWorkDays);
                                
                                // 生成工作日进度显示
                                if (totalWorkDays > 1) {
                                    continuousTaskIndicator = `<span class="text-[8px] text-gray-500 ml-1">(${completedWorkDaysForCurrentDate}/${totalWorkDays})</span>`;
                                }
                            }
                        }
                    
                    // 添加任务标题和进度（工作日进度）
                        taskCard.innerHTML = `
                            <div class="flex items-center w-full h-full">
                                ${task.priority && task.priority !== 'none' ? `
                                    <span class="w-4 h-4 rounded-full ${priorityColorClass} text-white text-[10px] font-bold flex items-center justify-center mr-1 flex-shrink-0">${task.priority}</span>
                                ` : ''}
                                <span class="text-[10px] font-bold text-gray-500 mr-1 flex-shrink-0">#${task.id}</span>
                                <span class="text-gray-700 truncate flex-1" title="${task.title || '无标题任务'}">${task.title || '无标题任务'}</span>
                                ${continuousTaskIndicator}
                            </div>
                        `;
                    
                    // 添加点击事件编辑任务
                    taskCard.addEventListener('click', () => {
                        editTask(task.id);
                    });
                    
                    tasksContainer.appendChild(taskCard);
                } else {
                    // 如果一行有多个任务，并排显示
                    const rowContainer = document.createElement('div');
                    rowContainer.classList.add('flex', 'gap-1', 'h-[30px]');
                    
                    rowTasks.forEach(task => {
                        const taskCard = document.createElement('div');
                    taskCard.classList.add('flex-1', 'min-w-[60px]', 'h-[30px]');
                        
                        // 根据任务状态获取颜色类 - 传入整个task对象以便使用预计算的displayStatus
                        const statusColorClass = getTaskStatusColorClass(task);
                        
                        // 获取任务背景色类
                        const backgroundClass = getTaskBackgroundClass(task.id);
                        
                        // 添加基础样式和状态边框 - 使用与状态对应的彩色边框
                        taskCard.classList.add('p-1', 'text-xs', 'rounded', 'border-2', 'shadow-sm', 'truncate', 'cursor-pointer', 'hover:opacity-90', 'transition-opacity', 'flex', 'items-center', backgroundClass);
                        
                        // 根据状态添加对应的彩色边框类（与图例一致）
                        taskCard.classList.add(`border-status-${statusColorClass}`);
                        
                        // 如果是连续任务，添加特殊样式以区分
                        if (task.isContinuous) {
                            // 获取任务的起始日期和结束日期
                            const startDate = new Date(task.startDate);
                            const endDate = new Date(task.dueDate);
                            const currentTaskDate = new Date(dateString);
                            
                            // 计算当前日期是任务的第几天
                            const dayOfTask = Math.floor((currentTaskDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
                            
                            // 添加连续任务的特殊样式
                            taskCard.classList.add('continuous-task-item');
                            
                            // 根据日期位置添加不同的样式（开始、中间、结束）
                            if (dayOfTask === 1) {
                                taskCard.classList.add('task-item-first');
                            } else if (dayOfTask === Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1) {
                                taskCard.classList.add('task-item-last');
                            } else {
                                taskCard.classList.add('task-item-middle');
                            }
                        }
                        
                        // 根据优先级设置颜色
                        let priorityColorClass = '';
                        if (task.priority === 'A') priorityColorClass = 'bg-priority-A';
                        else if (task.priority === 'B') priorityColorClass = 'bg-priority-B';
                        else if (task.priority === 'C') priorityColorClass = 'bg-priority-C';
                        else if (task.priority === 'D') priorityColorClass = 'bg-priority-D';
                        else if (task.priority === 'E') priorityColorClass = 'bg-priority-E';
                        else priorityColorClass = 'bg-priority-none';
                        
                        // 计算任务进度（排除节假日）
                        if (task.startDate && task.dueDate) {
                            const start = new Date(task.startDate);
                            const end = new Date(task.dueDate);
                            const todayTemp = new Date();
                            
                            // 计算总工作日天数（排除节假日）
                            let totalWorkDays = 0;
                            let currentWorkDays = 0;
                            
                            // 遍历任务期间的每一天
                            const tempDate = new Date(start);
                            while (tempDate <= end) {
                                // 获取日期类型
                                const dateType = getDateType(tempDate);
                                
                                // 如果不是节假日或周末，计算为工作日
                                const isWorkDay = dateType !== 'holiday' && tempDate.getDay() !== 0 && tempDate.getDay() !== 6;
                                
                                // 特殊情况：如果是专门为节假日创建的任务（起止时间在节假日范围内），也计入工作日
                                const isHolidaySpecialTask = dateType === 'holiday' && start.toDateString() === tempDate.toDateString() && end.toDateString() === tempDate.toDateString();
                                
                                if (isWorkDay || isHolidaySpecialTask) {
                                    totalWorkDays++;
                                    
                                    // 检查是否已经过去
                                    if (tempDate <= todayTemp) {
                                        currentWorkDays++;
                                    }
                                }
                                
                                // 移动到下一天
                                tempDate.setDate(tempDate.getDate() + 1);
                            }
                            
                            currentWorkDays = Math.min(currentWorkDays, totalWorkDays);
                        }
                        
                        // 为连续任务添加额外的标识，显示任务在连续时间中的位置
                        let continuousTaskIndicator = '';
                        if (task.isContinuous) {
                            const startDate = new Date(task.startDate);
                            const endDate = new Date(task.dueDate);
                            const currentTaskDate = new Date(dateString);
                            
                            const dayOfTask = Math.floor((currentTaskDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
                            const totalDaysOfTask = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
                            
                            continuousTaskIndicator = `<span class="text-[8px] text-gray-500 ml-1">(${dayOfTask}/${totalDaysOfTask})</span>`;
                        }
                        
                        // 添加任务标题（简化版本以适应并排显示）
                        taskCard.innerHTML = `
                            <div class="flex items-center w-full h-full">
                                ${task.priority && task.priority !== 'none' ? `
                                    <span class="w-4 h-4 rounded-full ${priorityColorClass} text-white text-[10px] font-bold flex items-center justify-center mr-1 flex-shrink-0">${task.priority}</span>
                                ` : ''}
                                <span class="text-[10px] font-bold text-gray-500 mr-1 flex-shrink-0">#${task.id + 1}</span>
                                <span class="text-gray-700 truncate flex-1" title="${task.title || '无标题任务'}">${task.title || '无标题任务'}</span>
                                ${continuousTaskIndicator}
                            </div>
                        `;
                        
                        // 添加点击事件编辑任务
                        taskCard.addEventListener('click', () => {
                            editTask(task.id);
                        });
                        
                        rowContainer.appendChild(taskCard);
                    });
                    
                    tasksContainer.appendChild(rowContainer);
                }
            });
            
            // 如果任务过多，显示更多按钮
            if (dayTasks.length > 10) { // 增加限制以支持更多任务
                const moreIndicator = document.createElement('div');
                moreIndicator.classList.add('text-xs', 'text-gray-500', 'text-center');
                moreIndicator.textContent = `还有 ${dayTasks.length - 10} 个任务`;
                tasksContainer.appendChild(moreIndicator);
            }
            
            dayElement.appendChild(tasksContainer);
        }
        
        calendarGrid.appendChild(dayElement);
    }
    
    // 添加下月天数
    let currentTotalDays = prevDaysToShow + daysInMonth;
    let remainingDays = 7 - (currentTotalDays % 7);
    if (remainingDays === 7) remainingDays = 0;
    remainingDays = Math.min(remainingDays, 7);
    
    if (remainingDays > 0 && daysInMonth > 0) {
        for (let i = 1; i <= remainingDays; i++) {
            const nextDay = new Date(year, month + 1, i);
            const dayElement = document.createElement('div');
            dayElement.classList.add('calendar-day', 'text-gray-400', 'bg-calendar-other_month');
            
            // 添加日期头部
            const dateHeader = document.createElement('div');
            dateHeader.classList.add('text-sm', 'font-medium', 'mb-1');
            
            // 创建日期内容容器
            const dateContentContainer = document.createElement('div');
            dateContentContainer.classList.add('flex', 'items-center', 'justify-between', 'w-full');
            
            // 创建日期数字元素
            const dateNumberElement = document.createElement('span');
            dateNumberElement.textContent = i;
            
            // 创建左侧容器（包含日期数字和农历）
            const leftContentContainer = document.createElement('div');
            leftContentContainer.classList.add('flex', 'items-center');
            leftContentContainer.appendChild(dateNumberElement);
            
            // 获取农历日期和节日信息
            let lunarDate = '';
            let festivalInfo = '';
            
            try {
                // 使用lunar_utils.js中的方法获取农历日期
                if (window.lunarUtils && typeof window.lunarUtils.getLunarDateText === 'function') {
                    lunarDate = window.lunarUtils.getLunarDateText(nextDay);
                }
                
                // 使用lunar_utils.js中的方法获取节日信息
                if (window.lunarUtils && typeof window.lunarUtils.getFestivals === 'function') {
                    const festivals = await window.lunarUtils.getFestivals(nextDay);
                    if (festivals && festivals.length > 0) {
                        // 显示全部节日
                        for (const festival of festivals) {
                            // 获取节日样式
                            const festivalStyle = window.lunarUtils.getFestivalStyleClass(festival.type);
                            festivalInfo = `${festivalInfo}<span class="${festivalStyle}">${festival.name}</span>`;
                        }
                    }
                }
            } catch (error) {
                console.warn('获取农历或节日信息失败:', error);
            }
            
            // 添加农历日期（如果有）到左侧容器
            if (lunarDate) {
                const lunarElement = document.createElement('span');
                lunarElement.classList.add('text-xs', 'ml-1', 'text-gray-500');
                lunarElement.textContent = lunarDate;
                leftContentContainer.appendChild(lunarElement);
            }
            
            // 将左侧容器添加到主容器
            dateContentContainer.appendChild(leftContentContainer);
            
            // 添加节日信息（如果有）到最右侧
            if (festivalInfo) {
                const festivalElement = document.createElement('span');
                festivalElement.classList.add('text-xs', 'ml-auto');
                festivalElement.innerHTML = festivalInfo;
                dateContentContainer.appendChild(festivalElement);
            }
            
            dateHeader.appendChild(dateContentContainer);
            dayElement.appendChild(dateHeader);
            
            calendarGrid.appendChild(dayElement);
        }
    }
}

// 获取任务的状态颜色类
// 优先级: 逾期未完成, 逾期未开始, 即将到期, 进行中, 未开始, 已完成
export function getTaskStatusColorClass(status, dueDate) {
    // 如果status是对象（整个任务对象），使用增强版的calculateTaskDisplayStatus函数计算状态
    if (typeof status === 'object') {
        // 调用增强版的calculateTaskDisplayStatus函数获取正确的状态
        return calculateTaskDisplayStatus(status);
    }
    
    // 保持原有逻辑以确保向后兼容性
    // 1. 已完成任务优先级最高
    if (status === 'completed') {
        return 'completed';
    }
    
    // 2. 检查是否有截止日期
    if (!dueDate) {
        // 无截止日期任务，根据状态返回
        return status === 'inprogress' ? 'inprogress' : 'pending';
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    
    // 计算日期差异，使用Math.floor确保准确判断逾期
    const diffDays = Math.floor((due - today) / (1000 * 60 * 60 * 24));
    
    // 3. 逾期任务判断
    if (diffDays < 0) {
        // 逾期未完成 > 逾期未开始
        return status === 'inprogress' ? 'overdue_inprogress' : 'overdue_pending';
    }
    // 4. 即将到期任务：当距离结束时间小于等于2天时标记为即将到期
    else if (diffDays <= 2) {
        return 'upcoming';
    }
    // 5. 正常时间范围内任务
    else {
        // 进行中 > 未开始
        return status === 'inprogress' ? 'inprogress' : 'pending';
    }
}

// 获取指定日期的节日信息（参考calendar_view.js实现）
/**
 * 获取指定日期的节日信息 - 统一使用公共节日工具模块
 * @param {string|Date} dateStr 日期字符串或Date对象
 * @returns {Array} 节日数组
 */
function getFestivalsForDate(dateStr) {
    // 检查festival_utils是否已加载
    if (window.lunarUtils && typeof window.lunarUtils.getFestivals === 'function') {
        try {
            // 将日期字符串转换为Date对象（如果需要）
            const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
            return window.lunarUtils.getFestivals(date);
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

// 从配置文件加载节日信息
function loadFestivalsFromConfig(dateStr) {
    if (!dateStr || !window.calendarConfig || !window.calendarConfig.festivals) {
        return [];
    }
    
    try {
        const date = new Date(dateStr);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const key = `${month}-${day}`;
        
        const festivals = [];
        
        // 检查公历节日
        if (window.calendarConfig.festivals.gregorian && window.calendarConfig.festivals.gregorian[key]) {
            const festivalName = window.calendarConfig.festivals.gregorian[key];
            festivals.push({
                name: festivalName,
                type: 'festival-gregorian'
            });
        }
        
        return festivals;
    } catch (error) {
        console.error('从配置加载节日信息失败:', error);
        return [];
    }
}