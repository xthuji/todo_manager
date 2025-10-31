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
import '../common/lunar_utils.js';

// 模块级节假日缓存
let cachedHolidayData = null;

// 工具函数
const utils = {
  formatDate: (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },
  isSameDay: (date1, date2) => {
    return date1.toDateString() === date2.toDateString();
  },
  isWeekend: (date) => [0, 6].includes(date.getDay())
};

// 日期类型处理器
const dateTypeHandler = {
  getTypeInfo: (date) => {
    const isWeekend = utils.isWeekend(date);
    const dateType = getDateType(date);
    
    let displayType = 'weekday';
    if (dateType === 'holiday') displayType = 'holiday';
    else if (dateType === 'workday') displayType = 'workday';
    else if (isWeekend) displayType = 'weekend';
    
    return {
      isWeekend,
      dateType,
      displayType,
      isToday: utils.isSameDay(date, new Date())
    };
  },
  
  getBackgroundColor: (displayType) => {
    const bgMap = {
      'holiday': 'bg-calendar-holiday',
      'workday': 'bg-calendar-workday',
      'weekend': 'bg-calendar-weekend',
      'weekday': 'bg-calendar-weekday'
    };
    return bgMap[displayType] || 'bg-calendar-weekday';
  },
  
  getTextColor: (dateType, isWeekend) => {
    if (dateType === 'holiday' || (isWeekend && dateType !== 'workday')) {
      return '#dc2626'; // 红色
    }
    return '#111827'; // 黑色
  }
};

// 任务过滤器
const taskFilter = {
  getVisibleTasks: (date, tasks, dateType) => {
    const dateString = utils.formatDate(date);
    const visibleTasks = [];
    
    tasks.forEach(task => {
      if (task.startDate && task.startDate !== task.dueDate) {
        // 连续任务
        const taskStart = new Date(task.startDate);
        const taskEnd = new Date(task.dueDate);
        taskStart.setHours(0, 0, 0, 0);
        taskEnd.setHours(0, 0, 0, 0);
        date.setHours(0, 0, 0, 0);
        
        if (date >= taskStart && date <= taskEnd) {
          const taskCopy = { ...task, isContinuous: true };
          visibleTasks.push(taskCopy);
        }
      } else {
        // 单日任务
        if (task.dueDate === dateString) {
          visibleTasks.push(task);
        }
      }
    });
    
    // 根据日期类型过滤任务
    if (dateType === 'holiday' || dateType === 'weekend') {
      return visibleTasks.filter(task => {
        if (task.startDate && task.dueDate) {
          const taskStart = new Date(task.startDate);
          const taskEnd = new Date(task.dueDate);
          let isHolidayTask = true;
          const tempDate = new Date(taskStart);
          
          while (tempDate <= taskEnd) {
            const tempDateType = getDateType(tempDate);
            if (tempDateType === 'weekday' || tempDateType === 'workday') {
              isHolidayTask = false;
              break;
            }
            tempDate.setDate(tempDate.getDate() + 1);
          }
          return isHolidayTask;
        }
        return true;
      });
    }
    
    return visibleTasks;
  }
};

// 任务布局管理器
const taskLayoutManager = {
  assignTaskRows: (tasks, weekOfMonth) => {
    if (!window.weeklyTaskRowsMap) {
      window.weeklyTaskRowsMap = new Map();
    }
    
    if (!window.weeklyTaskRowsMap.has(weekOfMonth)) {
      window.weeklyTaskRowsMap.set(weekOfMonth, new Map());
    }
    
    const weekTaskRows = window.weeklyTaskRowsMap.get(weekOfMonth);
    const taskRows = new Map();
    
    tasks.forEach(task => {
      if (!weekTaskRows.has(task.id)) {
        const usedRows = Array.from(weekTaskRows.values());
        let assignedRowIndex = 0;
        while (usedRows.includes(assignedRowIndex)) assignedRowIndex++;
        weekTaskRows.set(task.id, assignedRowIndex);
      }
      
      const taskRowIndex = weekTaskRows.get(task.id);
      if (!taskRows.has(taskRowIndex)) {
        taskRows.set(taskRowIndex, []);
      }
      taskRows.get(taskRowIndex).push(task);
    });
    
    return taskRows;
  }
};

// 任务卡片渲染器
const taskCardRenderer = {
  getTaskColorClass: (taskId, weekOfMonth) => {
    if (!window.weeklyTaskColorsMap) {
      window.weeklyTaskColorsMap = new Map();
    }
    
    if (!window.weeklyTaskColorsMap.has(weekOfMonth)) {
      window.weeklyTaskColorsMap.set(weekOfMonth, new Map());
    }
    
    const weekTaskColors = window.weeklyTaskColorsMap.get(weekOfMonth);
    
    if (weekTaskColors.has(taskId)) {
      const colorIndex = weekTaskColors.get(taskId);
      return `bg-task-color-${colorIndex + 1}`;
    }
    
    const usedColorIndices = Array.from(weekTaskColors.values());
    const totalColors = 10;
    let colorIndex = 0;
    
    for (let i = 0; i < totalColors; i++) {
      if (!usedColorIndices.includes(i)) {
        colorIndex = i;
        break;
      }
    }
    
    if (usedColorIndices.includes(colorIndex)) {
      const strId = taskId.toString();
      let hash = 0;
      for (let i = 0; i < strId.length; i++) {
        hash = strId.charCodeAt(i) + ((hash << 5) - hash);
      }
      colorIndex = Math.abs(hash % totalColors);
    }
    
    weekTaskColors.set(taskId, colorIndex);
    return `bg-task-color-${colorIndex + 1}`;
  },
  
  renderTaskCard: (task, isContinuous, dateString) => {
    const taskCard = document.createElement('div');
    taskCard.classList.add('flex-1', 'h-[30px]', 'p-1', 'text-xs', 'rounded-lg', 
                          'border-2', 'shadow-sm', 'truncate', 'cursor-pointer', 
                          'hover:opacity-90', 'transition-opacity', 'flex', 'items-center');
    
    const statusColorClass = calculateTaskDisplayStatus(task);
    const backgroundClass = taskCardRenderer.getTaskColorClass(task.id, 
      Math.ceil(new Date(dateString).getDate() / 7));
    
    taskCard.classList.add(backgroundClass);
    taskCard.classList.add(`border-status-${statusColorClass}`);
    
    if (isContinuous) {
      taskCard.classList.add('continuous-task-item');
      const startDate = new Date(task.startDate);
      const endDate = new Date(task.dueDate);
      const currentTaskDate = new Date(dateString);
      const dayOfTask = Math.floor((currentTaskDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      const totalDays = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      
      if (dayOfTask === 1) taskCard.classList.add('task-item-first');
      else if (dayOfTask === totalDays) taskCard.classList.add('task-item-last');
      else taskCard.classList.add('task-item-middle');
    }
    
    const priorityColorClass = `bg-priority-${task.priority || 'none'}`;
    let continuousIndicator = '';
    
    if (isContinuous) {
      const startDate = new Date(task.startDate);
      const endDate = new Date(task.dueDate);
      const currentTaskDate = new Date(dateString);
      const dayOfTask = Math.floor((currentTaskDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      const totalDays = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      continuousIndicator = `<span class="text-[8px] text-gray-500 ml-1">(${dayOfTask}/${totalDays})</span>`;
    }
    
    taskCard.innerHTML = `
      <div class="flex items-center w-full h-full">
        ${task.priority && task.priority !== 'none' ? 
          `<span class="w-4 h-4 rounded-full ${priorityColorClass} text-white text-[10px] font-bold flex items-center justify-center mr-1 flex-shrink-0">${task.priority}</span>` : ''}
        <span class="text-[10px] font-bold text-gray-500 mr-1 flex-shrink-0">#${task.id}</span>
        <span class="text-gray-700 truncate flex-1" title="${task.title || '无标题任务'}">${task.title || '无标题任务'}</span>
        ${continuousIndicator}
      </div>
    `;
    
    taskCard.addEventListener('click', () => editTask(task.id));
    return taskCard;
  }
};

// 日期单元格渲染器
const dayCellRenderer = {
  render: async (date, options = {}) => {
      const {isCurrentMonth = true, tasks = [], lunarUtils = null} = options;
      const dateString = utils.formatDate(date);
      const dateInfo = dateTypeHandler.getTypeInfo(date);

      const dayElement = document.createElement('div');
      dayElement.classList.add('calendar-day');
      dayElement.setAttribute('data-date', dateString);

      if (isCurrentMonth) {
          dayElement.classList.add(dateTypeHandler.getBackgroundColor(dateInfo.displayType));
      } else {
          dayElement.classList.add('bg-calendar-other_month');
      }
      
      // 无论是否为当月，只要是今天都添加高亮样式
      if (dateInfo.isToday) {
          dayElement.classList.add('calendar-day-today', 'bg-blue-100');
      }

      // 渲染日期头部
      const dateHeader = document.createElement('div');
      dateHeader.classList.add('text-sm', 'font-medium', 'mb-1');

      const dateContentContainer = document.createElement('div');
      dateContentContainer.classList.add('flex', 'items-center', 'justify-between', 'w-full');

      const dateNumberElement = document.createElement('span');
      dateNumberElement.textContent = date.getDate();

      dateNumberElement.style.color = dateTypeHandler.getTextColor(dateInfo.dateType, dateInfo.isWeekend);
      
      // 无论是否为当月，只要是今天都添加高亮圆圈边框
      if (dateInfo.isToday) {
          dateNumberElement.classList.add('w-6', 'h-6', 'flex', 'items-center', 'justify-center',
              'border-2', 'border-blue-500', 'rounded-full', 'text-xs', 'font-bold');
      }

      const leftContainer = document.createElement('div');
      leftContainer.classList.add('flex', 'items-center');
      leftContainer.appendChild(dateNumberElement);

      // 添加农历和节日信息
      let lunarDate = '';
      let festivalInfo = '';

      if (lunarUtils) {
          try {
              lunarDate = lunarUtils.getLunarDateText(date);
              const festivals = await lunarUtils.getFestivals(date, 1);
              if (festivals && festivals.length > 0) {
                  festivalInfo = festivals.map(festival => {
                      const festivalStyle = lunarUtils.getFestivalStyleClass(festival.type);
                      return `<span class="${festivalStyle} festival-tag text-xs px-1 py-0.5 rounded text-white whitespace-nowrap">${festival.name}</span>`;
                  }).join('');
              }
          } catch (error) {
              console.warn('获取农历或节日信息失败:', error);
          }
      }

      if (lunarDate) {
          const lunarElement = document.createElement('span');
          lunarElement.classList.add('text-xs', 'ml-1', 'text-gray-500');
          lunarElement.textContent = lunarDate;
          leftContainer.appendChild(lunarElement);
      }

      dateContentContainer.appendChild(leftContainer);

      if (festivalInfo) {
          const festivalElement = document.createElement('span');
          festivalElement.classList.add('text-xs', 'ml-auto');
          festivalElement.innerHTML = festivalInfo;
          dateContentContainer.appendChild(festivalElement);
      }

      dateHeader.appendChild(dateContentContainer);
      dayElement.appendChild(dateHeader);

      // 渲染任务
      if (tasks.length > 0) {
          const tasksContainer = document.createElement('div');
          tasksContainer.classList.add('mt-1', 'space-y-1', 'min-h-[100px]', 'overflow-visible');

          const weekOfMonth = Math.ceil(date.getDate() / 7);
          const taskRows = taskLayoutManager.assignTaskRows(tasks, weekOfMonth);
          const taskRowsArray = Array.from(taskRows.entries()).sort((a, b) => a[0] - b[0]);

          taskRowsArray.forEach(([rowIndex, rowTasks]) => {
              if (rowTasks.length === 1 && rowTasks[0].isEmpty) {
                  const emptyPlaceholder = document.createElement('div');
                  emptyPlaceholder.classList.add('flex-1', 'h-[30px]', 'border', 'border-dashed', 'border-gray-100', 'rounded-lg');
                  tasksContainer.appendChild(emptyPlaceholder);
              } else if (rowTasks.length === 1) {
                  const taskElement = taskCardRenderer.renderTaskCard(rowTasks[0], rowTasks[0].isContinuous, dateString);
                  tasksContainer.appendChild(taskElement);
              } else {
                  const rowContainer = document.createElement('div');
                  rowContainer.classList.add('flex', 'gap-1', 'h-[30px]');

                  rowTasks.forEach(task => {
                      const taskElement = taskCardRenderer.renderTaskCard(task, task.isContinuous, dateString);
                      rowContainer.appendChild(taskElement);
                  });

                  tasksContainer.appendChild(rowContainer);
              }
          });

          dayElement.appendChild(tasksContainer);
      }

      return dayElement;
  }
}

// 年月选择器渲染器
const yearMonthSelector = {
  render: (date, onYearChange, onMonthChange) => {
    const calendarMonthElement = document.getElementById('calendar-month');
    const year = date.getFullYear();
    const month = date.getMonth();
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    
    calendarMonthElement.innerHTML = `
      <select id="year-select" class="bg-transparent border-0 text-lg font-semibold focus:ring-1 focus:ring-blue-500">
        ${Array.from({length: 5}, (_, i) => year - 2 + i)
          .map(y => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}年</option>`)
          .join('')}
      </select>
      <select id="month-select" class="bg-transparent border-0 text-lg font-semibold focus:ring-1 focus:ring-blue-500">
        ${monthNames.map((name, idx) => 
          `<option value="${idx}" ${idx === month ? 'selected' : ''}>${name}</option>`
        ).join('')}
      </select>
    `;
    
    document.getElementById('year-select').addEventListener('change', (e) => {
      onYearChange(parseInt(e.target.value));
    });
    
    document.getElementById('month-select').addEventListener('change', (e) => {
      onMonthChange(parseInt(e.target.value));
    });
  }
};

// 主渲染函数
export async function renderCalendar(date, tasks = []) {
  // 加载节假日数据
  if (!cachedHolidayData) {
    cachedHolidayData = await getHolidayData();
  }
  
  // 重置任务行映射
  if (!window.weeklyTaskRowsMap) {
    window.weeklyTaskRowsMap = new Map();
  } else {
    window.weeklyTaskRowsMap.clear();
  }
  
  // 渲染年月选择器
  yearMonthSelector.render(date, 
    (newYear) => renderCalendar(new Date(newYear, date.getMonth(), 1), tasks),
    (newMonth) => renderCalendar(new Date(date.getFullYear(), newMonth, 1), tasks)
  );
  
  // 清空日历
  const calendarGrid = document.getElementById('calendar-grid');
  calendarGrid.innerHTML = '';
  
  // 计算日历日期范围
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstDayIndex = firstDay.getDay() === 0 ? 7 : firstDay.getDay();
  
  // 添加上月日期
  for (let i = firstDayIndex - 1; i > 0; i--) {
    const prevDay = new Date(year, month, -i + 1);
    const dayElement = await dayCellRenderer.render(prevDay, { 
      isCurrentMonth: false, 
      lunarUtils: window.lunarUtils 
    });
    calendarGrid.appendChild(dayElement);
  }
  
  // 添加本月日期
  const daysInMonth = lastDay.getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDay = new Date(year, month, day);
    const dateInfo = dateTypeHandler.getTypeInfo(currentDay);
    const visibleTasks = taskFilter.getVisibleTasks(currentDay, tasks, dateInfo.dateType);
    
    const dayElement = await dayCellRenderer.render(currentDay, { 
      tasks: visibleTasks, 
      lunarUtils: window.lunarUtils 
    });
    
    calendarGrid.appendChild(dayElement);
  }
  
  // 添加下月日期
  const totalRenderedDays = (firstDayIndex - 1) + daysInMonth;
  const remainingDays = (7 - (totalRenderedDays % 7)) % 7;
  
  for (let i = 1; i <= remainingDays; i++) {
    const nextDay = new Date(year, month + 1, i);
    const dayElement = await dayCellRenderer.render(nextDay, { 
      isCurrentMonth: false, 
      lunarUtils: window.lunarUtils 
    });
    calendarGrid.appendChild(dayElement);
  }
}

// 任务状态颜色获取函数
export function getTaskStatusColorClass(status, dueDate) {
  if (typeof status === 'object') {
    return calculateTaskDisplayStatus(status);
  }
  
  if (status === 'completed') return 'completed';
  
  if (!dueDate) {
    return status === 'inprogress' ? 'inprogress' : 'pending';
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  
  const diffDays = Math.floor((due - today) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return status === 'inprogress' ? 'overdue_inprogress' : 'overdue_pending';
  } else if (diffDays <= 2) {
    return 'upcoming';
  } else {
    return status === 'inprogress' ? 'inprogress' : 'pending';
  }
}

