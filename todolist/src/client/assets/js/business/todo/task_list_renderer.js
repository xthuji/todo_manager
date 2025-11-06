/**
 * 任务列表渲染模块
 * 针对页面：任务列表视图页面
 * 业务功能模块：
 * 1. 渲染任务列表，支持任务排序和筛选
 * 2. 处理任务元素的创建与样式设置
 * 3. 初始化并管理项目、上下文、状态等筛选器
 * 4. 提供任务搜索功能
 * 5. 实现任务状态、优先级等多维度筛选逻辑
 * 使用场景：
 * - 页面首次加载时渲染初始任务列表
 * - 任务数据更新后（添加、编辑、删除）重新渲染列表
 * - 用户调整筛选条件或搜索关键词时更新列表显示
 * - 用户切换任务状态或优先级时更新任务样式
 * 与其他模块配合：
 * - 依赖task_parser.js计算任务的显示状态
 * - 依赖task_operations.js处理任务的编辑、删除等操作
 * - 依赖todo_manager.js获取任务数据和管理筛选状态
 * - 依赖holiday_manager.js判断任务日期类型
 */
import { renderCalendar } from './calendar_renderer.js';
import { calculateTaskDisplayStatus } from './task_parser.js';
import { tasks, handleFilterChange, saveCurrentFilters, currentDate } from '../todo_manager.js';
import { getDateType } from '../common/holiday_manager.js';
import { editTask, showDeleteConfirmation, goToCalendarForTask, toggleTaskStatus, initDeleteModal, formatDate } from './task_operations.js';



// 跟踪是否已初始化删除模态框
let deleteModalInitialized = false;

// 存储每个筛选器的默认选中值
const defaultFilterValues = {};

// 在页面加载时记录默认值
function recordDefaultFilterValues() {
    const filterIds = ['priority-filter', 'status-filter', 'date-filter', 'project-filter', 'context-filter'];
    
    filterIds.forEach(filterId => {
        const filterElement = document.getElementById(filterId);
        if (filterElement) {
            // 记录默认选中的值
            const defaultSelected = Array.from(filterElement.options)
                .filter(option => option.selected)
                .map(option => option.value);
            
            defaultFilterValues[filterId] = defaultSelected;
        }
    });
}

// 确保在页面加载时记录默认值
document.addEventListener('DOMContentLoaded', recordDefaultFilterValues);

// 渲染任务列表
export async function renderTaskList(tasks) {
    const taskList = document.getElementById('task-list');
    taskList.innerHTML = '';
    
    // 初始化项目和上下文筛选下拉框
        initProjectAndContextFilters();
    
    // 初始化删除确认模态框 - 确保只初始化一次
    if (!deleteModalInitialized) {
        initDeleteModal();
        deleteModalInitialized = true;
    }
    
    // 注意：不再在此处调用loadSavedFilters()，避免每次渲染都重置筛选参数
    
    // 为所有任务重新计算displayStatus
    const tasksWithUpdatedStatus = tasks.map(task => ({
        ...task,
        displayStatus: calculateTaskDisplayStatus(task)
    }));
    
    const filteredTasks = filterTasks(tasksWithUpdatedStatus);
    
    // 更新任务统计数量
    const taskCountElement = document.getElementById('task-count');
    if (taskCountElement) {
        taskCountElement.textContent = `共 ${filteredTasks.length} 个任务`;
    }
    
    if (filteredTasks.length === 0) {
        if (tasks.length > 0) {
            const emptyState = document.createElement('div');
            emptyState.classList.add('text-center', 'p-8', 'text-gray-500');
            emptyState.innerHTML = `
                <i class="fa fa-filter text-4xl mb-4"></i>
                <p>没有匹配当前筛选条件的任务</p>
                <p class="text-sm mt-2">请尝试调整筛选条件</p>
            `;
            taskList.appendChild(emptyState);
        } else {
            const emptyState = document.createElement('div');
            emptyState.classList.add('text-center', 'p-8', 'text-gray-500');
            emptyState.innerHTML = `
                <i class="fa fa-tasks text-4xl mb-4"></i>
                <p>暂无任务</p>
                <p class="text-sm mt-2">点击"添加任务"开始创建您的待办事项</p>
            `;
            taskList.appendChild(emptyState);
        }
        return;
    }
    
    // 定义状态优先级映射，数值越小优先级越高
    // 优先级: 逾期未完成>逾期未开始>即将到期>进行中>未开始>已完成
    const statusPriority = {
        'overdue_inprogress': 1, // 逾期未完成
        'overdue_pending': 2, // 逾期未开始 最高优先级
        'upcoming': 3, // 即将到期
        'inprogress': 4, // 进行中
        'pending': 5, // 未开始
        'completed': 6  // 已完成 最低优先级
    };
    
    // 定义优先级映射
    const priorityOrder = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'none': 6 };
    
    const sortedTasks = [...filteredTasks].sort((a, b) => {
        // 1. 首先根据预计算的displayStatus进行排序
        const statusA = a.displayStatus || 'pending';
        const statusB = b.displayStatus || 'pending';
        
        if (statusPriority[statusA] !== statusPriority[statusB]) {
            return statusPriority[statusA] - statusPriority[statusB];
        }
        
        // 2. 相同状态下，按优先级排序
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        
        // 3. 相同状态和优先级下，按上下文排序（空值排在最后）
        if (a.context && b.context) {
            return a.context.localeCompare(b.context);
        }
        if (a.context) return -1;
        if (b.context) return 1;
        
        // 4. 相同状态、优先级和上下文下，按项目排序（空值排在最后）
        if (a.project && b.project) {
            return a.project.localeCompare(b.project);
        }
        if (a.project) return -1;
        if (b.project) return 1;
        
        // 5. 相同状态、优先级、上下文和项目下，按任务名称排序
        if (a.title && b.title) {
            return a.title.localeCompare(b.title);
        }
        if (a.title) return -1;
        if (b.title) return 1;
        
        // 6. 最后按任务序号排序
        return a.id - b.id;
    });
    
    sortedTasks.forEach(task => {
        const taskElement = document.createElement('div');
        
        // 使用预计算的displayStatus字段作为状态颜色类
        const displayStatus = task.displayStatus || 'pending';
        
        // 添加彩色边框，使用任务状态颜色
        taskElement.classList.add('p-4', 'border-2', `border-status-${displayStatus}`, 'rounded-lg', 'mb-2', 'hover:bg-gray-50', 'transition-colors');

        taskElement.innerHTML = `
            <div class="flex items-start justify-between">
                <div class="flex items-start flex-1">
                    <div class="flex-1 min-w-0">
                        <h3 class="text-lg font-medium ${task.status === 'completed' ? 'line-through text-gray-500' : ''}">
                            #${task.id} ${task.title}
                        </h3>
                        <div class="mt-2 flex items-center flex-wrap gap-2">
                            ${task.priority !== 'none' ? `
                                <span class="inline-block px-2 py-1 text-xs font-medium rounded-full bg-priority-${task.priority} text-white">
                                    优先级 ${task.priority}
                                </span>
                            ` : ''}
                            ${task.dueDate ? `
                                <span class="inline-flex items-center text-sm text-gray-600">
                                    <i class="fa fa-calendar-o mr-1"></i>
                                    ${task.startDate && task.startDate !== task.dueDate ? `${formatDate(task.startDate)} - ${formatDate(task.dueDate)}` : formatDate(task.dueDate)}
                                    ${(() => {
                                        if (task.startDate && task.dueDate) {
                                            const startDate = new Date(task.startDate);
                                            const dueDate = new Date(task.dueDate);
                                            let totalWorkDays = 0;
                                            
                                            // 检查任务是否是专门针对节假日的
                                            // 方法：检查任务期间是否所有日期都是节假日或周末
                                            let isHolidaySpecialTask = true;
                                            const checkDate = new Date(startDate);
                                            while (checkDate <= dueDate) {
                                                const dateType = getDateType(checkDate);
                                                if (dateType !== 'holiday' && dateType !== 'weekend') {
                                                    isHolidaySpecialTask = false;
                                                    break;
                                                }
                                                checkDate.setDate(checkDate.getDate() + 1);
                                            }
                                            
                                            // 计算工作天数
                                            const tempDate = new Date(startDate);
                                            while (tempDate <= dueDate) {
                                                if (isHolidaySpecialTask) {
                                                    // 如果是专门针对节假日的任务，所有日期都计入工作天数
                                                    totalWorkDays++;
                                                } else {
                                                    // 否则，只统计工作日和补班天数
                                                   

                                                    const dateType = getDateType(tempDate);
                                                    if (dateType === 'weekday' || dateType === 'workday') {
                                                        totalWorkDays++;
                                                    }
                                                }
                                                tempDate.setDate(tempDate.getDate() + 1);
                                            }
                                            
                                            return `<span class="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded font-bold">${totalWorkDays}天</span>`;
                                        } else if (task.dueDate) {
                                            // 对于单个日期的任务，始终显示天数
                                            return '<span class="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded font-bold">1天</span>';
                                        }
                                        return '';
                                    })()}
                                </span>
                            ` : ''}
                            ${task.project ? `
                                <span class="inline-flex items-center text-sm text-gray-600">
                                    <i class="fa fa-folder-o mr-1"></i>
                                    ${task.project}
                                </span>
                            ` : ''}
                            ${task.context ? `
                                <span class="inline-flex items-center text-sm text-gray-600">
                                    <i class="fa fa-tags mr-1"></i>
                                    ${task.context}
                                </span>
                            ` : ''}
                        </div>
                        ${task.note ? `
                            <p class="mt-2 text-gray-600 text-sm">${task.note}</p>
                        ` : ''}
                    </div>
                </div>
                <div class="flex-shrink-0 ml-4 space-y-1">
                    <!-- 操作按钮左侧添加任务状态信息，使用状态颜色作为背景色 -->
                    <span class="inline-block px-2 py-1 text-xs font-medium rounded-full bg-status-${displayStatus || 'pending'} text-white mb-1">
                        ${getStatusText(displayStatus)}
                    </span>
                    <!-- 添加新的操作按钮：跳转到日历中对应的任务 -->
                    <button class="go-to-calendar p-2 text-gray-500 hover:text-purple-500" data-id="${task.id}" data-date="${task.dueDate || ''}" title="查看日历">
                        <i class="fa fa-calendar"></i>
                    </button>
                    <!-- 添加新的操作按钮：设置任务状态为已完成或重新开始 -->
                    <button class="toggle-status p-2 text-gray-500 hover:text-green-500" data-id="${task.id}" data-status="${task.status}" title="${task.status === 'completed' ? '重新开始任务' : '标记为已完成'}">
                        ${task.status === 'completed' ? '<i class="fa fa-refresh"></i>' : '<i class="fa fa-check-circle"></i>'}
                    </button>
                    <button class="edit-task p-2 text-gray-500 hover:text-blue-500" data-id="${task.id}" title="编辑任务">
                        <i class="fa fa-pencil"></i>
                    </button>
                    <button class="delete-task p-2 text-gray-500 hover:text-red-500" data-id="${task.id}" title="删除任务">
                        <i class="fa fa-trash"></i>
                    </button>
                </div>
            </div>
        `;

        // 添加事件监听器 - 必须在设置innerHTML之后添加
        const editButton = taskElement.querySelector('.edit-task');
        if (editButton) {
            editButton.addEventListener('click', function() {
                const taskId = parseInt(this.getAttribute('data-id'));
                editTask(taskId);
            });
        }

        const deleteButton = taskElement.querySelector('.delete-task');
        if (deleteButton) {
            deleteButton.addEventListener('click', function() {
                const taskId = parseInt(this.getAttribute('data-id'));
                showDeleteConfirmation(taskId);
            });
        }

        const goToCalendarButton = taskElement.querySelector('.go-to-calendar');
        if (goToCalendarButton) {
            goToCalendarButton.addEventListener('click', function() {
                const taskId = parseInt(this.getAttribute('data-id'));
                const dateString = this.getAttribute('data-date');
                goToCalendarForTask(taskId, dateString);
            });
        }

        const toggleStatusButton = taskElement.querySelector('.toggle-status');
        if (toggleStatusButton) {
            toggleStatusButton.addEventListener('click', function() {
                const taskId = parseInt(this.getAttribute('data-id'));
                const currentStatus = this.getAttribute('data-status');
                toggleTaskStatus(taskId, currentStatus);
            });
        }

        taskList.appendChild(taskElement);
    });
}

// 初始化项目和上下文筛选下拉框
export function initProjectAndContextFilters() {
    
    // 获取所有唯一的项目
    const projects = [...new Set(tasks.map(task => task.project).filter(project => project))];
    const projectFilter = document.getElementById('project-filter');
    if (projectFilter) {
        // 保存当前选中的值
        const selectedProjects = Array.from(projectFilter.selectedOptions).map(option => option.value);
        
        // 清空除了"全部"选项外的所有选项
        const allOption = projectFilter.querySelector('option[value="all"]');
        projectFilter.innerHTML = '';
        if (allOption) {
            projectFilter.appendChild(allOption);
        } else {
            const option = document.createElement('option');
            option.value = 'all';
            option.textContent = '全部';
            option.selected = true;
            projectFilter.appendChild(option);
        }
        
        // 添加项目选项
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project;
            option.textContent = project;
            projectFilter.appendChild(option);
        });
        
        // 恢复选中的值
        if (selectedProjects.length > 0) {
            selectedProjects.forEach(value => {
                const option = projectFilter.querySelector(`option[value="${value}"]`);
                if (option) {
                    option.selected = true;
                }
            });
        }
        
        // 添加事件监听器
        if (!projectFilter.hasAttribute('data-event-added')) {
            projectFilter.setAttribute('data-event-added', 'true');
            projectFilter.addEventListener('change', function() {
                handleFilterChange(this.id);
            });
            projectFilter.addEventListener('click', function(e) {
                // 防止事件冒泡导致失焦
                e.stopPropagation();
                this.classList.toggle('expanded');
                // 同时切换容器的expanded类以控制箭头旋转
                this.parentElement.classList.toggle('expanded');
            });
            projectFilter.addEventListener('blur', function() {
                // 失焦时折叠下拉框并触发筛选
                this.classList.remove('expanded');
                // 同时移除容器的expanded类
                this.parentElement.classList.remove('expanded');
            });
        }
    }
    
    // 获取所有唯一的上下文
    const contexts = [...new Set(tasks.map(task => task.context).filter(context => context))];
    const contextFilter = document.getElementById('context-filter');
    if (contextFilter) {
        // 保存当前选中的值
        const selectedContexts = Array.from(contextFilter.selectedOptions).map(option => option.value);
        
        // 清空除了"全部"选项外的所有选项
        const allOption = contextFilter.querySelector('option[value="all"]');
        contextFilter.innerHTML = '';
        if (allOption) {
            contextFilter.appendChild(allOption);
        } else {
            const option = document.createElement('option');
            option.value = 'all';
            option.textContent = '全部';
            option.selected = true;
            contextFilter.appendChild(option);
        }
        
        // 添加上下文选项
        contexts.forEach(context => {
            const option = document.createElement('option');
            option.value = context;
            option.textContent = context;
            contextFilter.appendChild(option);
        });
        
        // 恢复选中的值
        if (selectedContexts.length > 0) {
            selectedContexts.forEach(value => {
                const option = contextFilter.querySelector(`option[value="${value}"]`);
                if (option) {
                    option.selected = true;
                }
            });
        }
        
        // 添加事件监听器
    if (!contextFilter.hasAttribute('data-event-added')) {
        contextFilter.setAttribute('data-event-added', 'true');
        contextFilter.addEventListener('change', function() {
            handleFilterChange(this.id);
        });
        contextFilter.addEventListener('click', function(e) {
            // 防止事件冒泡导致失焦
            e.stopPropagation();
            this.classList.toggle('expanded');
            // 同时切换容器的expanded类以控制箭头旋转
            this.parentElement.classList.toggle('expanded');
        });
        contextFilter.addEventListener('blur', function() {
            // 失焦时折叠下拉框并触发筛选
            this.classList.remove('expanded');
            // 同时移除容器的expanded类
            this.parentElement.classList.remove('expanded');
        });
    }
    }
    
    // 添加状态筛选器事件监听器
    const statusFilter = document.getElementById('status-filter');
    if (statusFilter && !statusFilter.hasAttribute('data-event-added')) {
        statusFilter.setAttribute('data-event-added', 'true');
        statusFilter.addEventListener('change', function() {
            handleFilterChange(this.id);
        });
        statusFilter.addEventListener('click', function(e) {
            // 防止事件冒泡导致失焦
            e.stopPropagation();
            this.classList.toggle('expanded');
            // 同时切换容器的expanded类以控制箭头旋转
            this.parentElement.classList.toggle('expanded');
        });
        statusFilter.addEventListener('blur', function() {
            // 失焦时折叠下拉框并触发筛选
            this.classList.remove('expanded');
            // 同时移除容器的expanded类
            this.parentElement.classList.remove('expanded');
        });
    }
    
    // 添加时间筛选器事件监听器
    const dateFilter = document.getElementById('date-filter');
    if (dateFilter && !dateFilter.hasAttribute('data-event-added')) {
        dateFilter.setAttribute('data-event-added', 'true');
        dateFilter.addEventListener('change', function() {
            handleFilterChange(this.id);
        });
        dateFilter.addEventListener('click', function(e) {
            // 防止事件冒泡导致失焦
            e.stopPropagation();
            this.classList.toggle('expanded');
            // 同时切换容器的expanded类以控制箭头旋转
            this.parentElement.classList.toggle('expanded');
        });
        dateFilter.addEventListener('blur', function() {
            // 失焦时折叠下拉框并触发筛选
            this.classList.remove('expanded');
            // 同时移除容器的expanded类
            this.parentElement.classList.remove('expanded');
        });
    }
    
    // 添加优先级筛选器事件监听器
    const priorityFilter = document.getElementById('priority-filter');
    if (priorityFilter && !priorityFilter.hasAttribute('data-event-added')) {
        priorityFilter.setAttribute('data-event-added', 'true');
        priorityFilter.addEventListener('change', function() {
            handleFilterChange(this.id);
        });
        priorityFilter.addEventListener('click', function(e) {
            // 防止事件冒泡导致失焦
            e.stopPropagation();
            this.classList.toggle('expanded');
            // 同时切换容器的expanded类以控制箭头旋转
            this.parentElement.classList.toggle('expanded');
        });
        priorityFilter.addEventListener('blur', function() {
            // 失焦时折叠下拉框并触发筛选
            this.classList.remove('expanded');
            // 同时移除容器的expanded类
            this.parentElement.classList.remove('expanded');
        });
    }
    
    // 添加搜索框事件监听器
    const searchInput = document.getElementById('search-input');
    if (searchInput && !searchInput.hasAttribute('data-event-added')) {
        searchInput.setAttribute('data-event-added', 'true');
        // 移除实时筛选，改为由查询按钮触发
        // searchInput.addEventListener('input', () => renderTaskList(tasks));
    }

    // 添加查询按钮事件监听器
    const filterSearchBtn = document.getElementById('filter-search-btn');
    if (filterSearchBtn && !filterSearchBtn.hasAttribute('data-event-added')) {
        filterSearchBtn.setAttribute('data-event-added', 'true');
        filterSearchBtn.addEventListener('click', performFiltering);
    }
}

// 筛选任务

// 执行筛选操作，同时更新任务列表和日历
export async function performFiltering() {
    try {
        // 保存当前筛选设置
        saveCurrentFilters();
        
        // 为所有任务重新计算displayStatus
        const tasksWithUpdatedStatus = tasks.map(task => ({
            ...task,
            displayStatus: calculateTaskDisplayStatus(task)
        }));
        
        // 获取筛选后的任务
        const filteredTasks = filterTasks(tasksWithUpdatedStatus);
        
        // 重新渲染任务列表
        renderTaskList(filteredTasks);
        
        // 重新渲染日历，确保日历也显示筛选后的任务，并使用当前选中的日期
        await renderCalendar(currentDate, filteredTasks);
    } catch (error) {
        console.error('执行筛选操作时出错:', error);
    }
}



// 加载保存的筛选值 - 不再使用缓存，直接设置为默认值
export function loadSavedFilters() {
    // 直接设置所有筛选器为默认值，不再从localStorage加载
    setAllFiltersToDefault();
}

// 设置所有筛选器为默认值
// 使用页面初始化时记录的默认值来恢复筛选参数
export function setAllFiltersToDefault() {
    const filterIds = ['priority-filter', 'status-filter', 'date-filter', 'project-filter', 'context-filter'];
    
    filterIds.forEach(filterId => {
        const filterElement = document.getElementById(filterId);
        if (filterElement) {
            // 对于项目和上下文筛选器，需要延迟执行以确保选项已生成
            if (filterId === 'project-filter' || filterId === 'context-filter') {
                setTimeout(() => {
                    resetFilterToDefaultValue(filterElement, filterId);
                }, 100);
            } else {
                resetFilterToDefaultValue(filterElement, filterId);
            }
        }
    });
}

// 重置单个筛选器到页面初始化时记录的默认值
function resetFilterToDefaultValue(filterElement, filterId) {
    // 取消所有选项的选中状态
    for (let i = 0; i < filterElement.options.length; i++) {
        filterElement.options[i].selected = false;
    }
    
    // 检查是否有记录的默认值
    if (defaultFilterValues[filterId] && defaultFilterValues[filterId].length > 0) {
        // 使用记录的默认值
        defaultFilterValues[filterId].forEach(defaultValue => {
            const option = filterElement.querySelector(`option[value="${defaultValue}"]`);
            if (option) {
                option.selected = true;
            }
        });
    } else {
        // 如果没有记录的默认值，则尝试选中"全部"选项
        const allOption = filterElement.querySelector('option[value="all"]');
        if (allOption) {
            allOption.selected = true;
        } else {
            // 如果没有"全部"选项，则选中所有选项
            for (let i = 0; i < filterElement.options.length; i++) {
                filterElement.options[i].selected = true;
            }
        }
    }
    
    // 触发change事件以更新UI状态
    const event = new Event('change', { bubbles: true });
    filterElement.dispatchEvent(event);
}

// 筛选任务
export function filterTasks(tasks) {
    try {
        const searchInput = document.getElementById('search-input') || { value: '' };
        const searchTerm = searchInput.value || '';
        
        // 获取多选下拉框选中的值，添加空值检查以避免运行时错误
        const getFilterValues = (filterId) => {
            const element = document.getElementById(filterId);
            if (!element) return ['all']; // 元素不存在时返回默认值
            return Array.from(element.selectedOptions || []).map(option => option.value);
        };
        
        const priorityFilter = getFilterValues('priority-filter');
        const statusFilter = getFilterValues('status-filter');
        const projectFilter = getFilterValues('project-filter');
        const contextFilter = getFilterValues('context-filter');
        const dateFilter = getFilterValues('date-filter');
        
        // 检查是否选中了"全部"选项
        const isAllPriority = priorityFilter.includes('all');
        const isAllStatus = statusFilter.includes('all');
        const isAllProject = projectFilter.includes('all');
        const isAllContext = contextFilter.includes('all');
        const isAllDate = dateFilter.includes('all');
        
        return tasks.filter(task => {
            // 优先级筛选
            if (!isAllPriority && !(priorityFilter.includes(task.priority || 'none'))) return false;
            
            // 状态筛选 - 使用预计算的displayStatus
            const taskStatus = task.displayStatus || 'pending';
            
            if (!isAllStatus && !(statusFilter.includes(taskStatus))) return false;
            
            // 日期筛选
            let matchesDate = false;
            if (isAllDate) {
                matchesDate = true;
            } else {
                if (task.dueDate) {
                    const dueDate = new Date(task.dueDate);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    
                    if (dateFilter.includes('today') && isToday(dueDate)) {
                        matchesDate = true;
                    } else if (dateFilter.includes('week') && isWithinWeek(dueDate, today)) {
                        matchesDate = true;
                    } else if (dateFilter.includes('month') && isWithinMonth(dueDate, today)) {
                        matchesDate = true;
                    }
                }
            }
            
            if (!matchesDate) return false;
            
            // 项目筛选
            if (!isAllProject && task.project && !projectFilter.includes(task.project)) return false;
            
            // 上下文筛选
            if (!isAllContext && task.context && !contextFilter.includes(task.context)) return false;
            
            // 搜索筛选
            if (searchTerm) {
                try {
                    // 对任务名称使用正则表达式搜索
                    const titleRegex = new RegExp(searchTerm, 'i');
                    const titleMatches = task.title && titleRegex.test(task.title);
                    
                    // 对备注、项目和上下文使用简单的包含检查
                    const noteMatches = task.note && task.note.toLowerCase().includes(searchTerm.toLowerCase());
                    const projectMatches = task.project && task.project.toLowerCase().includes(searchTerm.toLowerCase());
                    const contextMatches = task.context && task.context.toLowerCase().includes(searchTerm.toLowerCase());
                    
                    if (!(titleMatches || noteMatches || projectMatches || contextMatches)) {
                        return false;
                    }
                } catch (e) {
                    // 如果正则表达式无效，降级为简单的字符串包含检查
                    const searchLower = searchTerm.toLowerCase();
                    const titleMatches = task.title && task.title.toLowerCase().includes(searchLower);
                    const noteMatches = task.note && task.note.toLowerCase().includes(searchLower);
                    const projectMatches = task.project && task.project.toLowerCase().includes(searchLower);
                    const contextMatches = task.context && task.context.toLowerCase().includes(searchLower);
                    
                    if (!(titleMatches || noteMatches || projectMatches || contextMatches)) {
                        return false;
                    }
                }
            }
            
            return true;
        });
    } catch (e) {
        console.error('筛选任务时出错:', e);
        return tasks; // 出错时返回所有任务
    }
}

// 检查日期是否在未来两天内
function isWithinTwoDays(date, today) {
    const diffTime = Math.abs(date - today);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 2;
}

// 检查日期是否在本周内
function isWithinWeek(date, today) {
    // 获取本周的第一天（周一）
    const firstDayOfWeek = new Date(today);
    const day = today.getDay() || 7; // 让周日变成7
    firstDayOfWeek.setDate(today.getDate() - day + 1);
    firstDayOfWeek.setHours(0, 0, 0, 0);
    
    // 获取本周的最后一天（周日）
    const lastDayOfWeek = new Date(firstDayOfWeek);
    lastDayOfWeek.setDate(lastDayOfWeek.getDate() + 6);
    lastDayOfWeek.setHours(23, 59, 59, 999);
    
    return date >= firstDayOfWeek && date <= lastDayOfWeek;
}

// 检查日期是否在本月内
function isWithinMonth(date, today) {
    return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
}

// 检查日期是否是今天
function isToday(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return date.getTime() === today.getTime();
}

// 获取状态文本
function getStatusText(status) {
    const statusMap = {
        'pending': '未开始',
        'inprogress': '进行中',
        'completed': '已完成',
        'overdue_pending': '逾期未开始',
        'overdue_inprogress': '逾期未完成',
        'upcoming': '即将到期'
    };
    return statusMap[status] || status;
}