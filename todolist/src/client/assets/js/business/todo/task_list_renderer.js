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
        const filterElement = $('#' + filterId);
        if (filterElement.length) {
            // 记录默认选中的值
            const defaultSelected = Array.from(filterElement[0].options)
                .filter(option => option.selected)
                .map(option => option.value);
            
            defaultFilterValues[filterId] = defaultSelected;
        }
    });
}

// 确保在页面加载时记录默认值
$(document).ready(recordDefaultFilterValues);

// 渲染任务列表
export async function renderTaskList(tasks) {
    const taskList = $('#task-list');
    taskList.empty();
    
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
    const taskCountElement = $('#task-count');
    if (taskCountElement.length) {
        taskCountElement.text(`共 ${filteredTasks.length} 个任务`);
    }
    
    if (filteredTasks.length === 0) {
        if (tasks.length > 0) {
            const emptyState = $('<div>').addClass('text-center p-8 text-gray-500');
            emptyState.html(`
                <i class="fa fa-filter text-4xl mb-4"></i>
                <p>没有匹配当前筛选条件的任务</p>
                <p class="text-sm mt-2">请尝试调整筛选条件</p>
            `);
            taskList.append(emptyState);
        } else {
            const emptyState = $('<div>').addClass('text-center p-8 text-gray-500');
            emptyState.html(`
                <i class="fa fa-tasks text-4xl mb-4"></i>
                <p>暂无任务</p>
                <p class="text-sm mt-2">点击"添加任务"开始创建您的待办事项</p>
            `);
            taskList.append(emptyState);
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
    
    // 获取任务元素模板
    const taskTemplate = $('#task-item-template');
    const useTemplate = taskTemplate.length > 0;

    sortedTasks.forEach(task => {
        let taskElement;
        
        // 使用模板渲染
        if (useTemplate) {
            taskElement = $(taskTemplate[0].content.cloneNode(true)).first();
        } else {
            // 回退到原来的创建方式
            taskElement = $('<div>').addClass('p-4 border-2 rounded-lg mb-2 hover:bg-gray-50 transition-colors');
        }
        
        // 使用预计算的displayStatus字段作为状态颜色类
        const displayStatus = task.displayStatus || 'pending';
        
        // 添加彩色边框，使用任务状态颜色
        taskElement.attr('class', 'p-4 border-2 border-status-' + displayStatus + ' rounded-lg mb-2 hover:bg-gray-50 transition-colors');

        // 填充任务数据
        const titleElement = taskElement.find('h3');
        if (titleElement.length) {
            titleElement.text(`#${task.id} ${task.title}`);
            if (task.status === 'completed') {
                titleElement.addClass('line-through text-gray-500');
            }
        }

        // 优先级标签
        const priorityElement = taskElement.find('.bg-priority-none');
        if (priorityElement.length) {
            if (task.priority !== 'none') {
                priorityElement.attr('class', 'inline-block px-2 py-1 text-xs font-medium rounded-full bg-priority-' + task.priority + ' text-white');
                priorityElement.text('优先级 ' + task.priority);
            } else {
                priorityElement.hide();
            }
        }

        // 日期标签
        const dateContainer = taskElement.find('.inline-flex.items-center.text-sm.text-gray-600').first();
        if (dateContainer.length) {
            if (task.dueDate) {
                const dateTextElement = dateContainer.find('.date-text');
                const daysCountElement = dateContainer.find('.days-count');
                
                if (dateTextElement.length) {
                    dateTextElement.text(task.startDate && task.startDate !== task.dueDate ? `${formatDate(task.startDate)} - ${formatDate(task.dueDate)}` : formatDate(task.dueDate));
                }
                
                if (daysCountElement.length) {
                    if (task.startDate && task.dueDate) {
                        const startDate = new Date(task.startDate);
                        const dueDate = new Date(task.dueDate);
                        let totalWorkDays = 0;
                        
                        // 检查任务是否是专门针对节假日的
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
                        
                        daysCountElement.attr('class', 'ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded font-bold');
                        daysCountElement.text(totalWorkDays + '天');
                    } else if (task.dueDate) {
                        // 对于单个日期的任务，始终显示天数
                        daysCountElement.attr('class', 'ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded font-bold');
                        daysCountElement.text('1天');
                    }
                }
            } else {
                dateContainer.hide();
            }
        }

        // 项目标签
        const projectContainer = taskElement.find('.inline-flex.items-center.text-sm.text-gray-600').eq(1);
        if (projectContainer.length) {
            const projectTextElement = projectContainer.find('.project-text');
            if (projectTextElement.length) {
                if (task.project) {
                    projectTextElement.text(task.project);
                } else {
                    projectContainer.hide();
                }
            }
        }

        // 上下文标签
        const contextContainer = taskElement.find('.inline-flex.items-center.text-sm.text-gray-600').eq(2);
        if (contextContainer.length) {
            const contextTextElement = contextContainer.find('.context-text');
            if (contextTextElement.length) {
                if (task.context) {
                    contextTextElement.text(task.context);
                } else {
                    contextContainer.hide();
                }
            }
        }

        // 备注
        const noteElement = taskElement.find('p');
        if (noteElement.length) {
            if (task.note) {
                noteElement.text(task.note);
            } else {
                noteElement.hide();
            }
        }

        // 任务状态信息
        const statusElement = taskElement.find('.bg-status-pending');
        if (statusElement.length) {
            statusElement.attr('class', 'inline-block px-2 py-1 text-xs font-medium rounded-full bg-status-' + (displayStatus || 'pending') + ' text-white mb-1');
            statusElement.text(getStatusText(displayStatus));
        }

        // 操作按钮
        const goToCalendarButton = taskElement.find('.go-to-calendar');
        if (goToCalendarButton.length) {
            goToCalendarButton.attr('data-id', task.id);
            goToCalendarButton.attr('data-date', task.dueDate || '');
        }

        const toggleStatusButton = taskElement.find('.toggle-status');
        if (toggleStatusButton.length) {
            toggleStatusButton.attr('data-id', task.id);
            toggleStatusButton.attr('data-status', task.status);
            toggleStatusButton.attr('title', task.status === 'completed' ? '重新开始任务' : '标记为已完成');
            
            const toggleStatusIcon = toggleStatusButton.find('i');
            if (toggleStatusIcon.length) {
                toggleStatusIcon.attr('class', task.status === 'completed' ? 'fa fa-refresh' : 'fa fa-check-circle');
            }
        }

        const editButton = taskElement.find('.edit-task');
        if (editButton.length) {
            editButton.attr('data-id', task.id);
        }

        const deleteButton = taskElement.find('.delete-task');
        if (deleteButton.length) {
            deleteButton.attr('data-id', task.id);
        }

        // 添加事件监听器
        if (editButton.length) {
            editButton.on('click', function() {
                const taskId = parseInt($(this).attr('data-id'));
                editTask(taskId);
            });
        }

        if (deleteButton.length) {
            deleteButton.on('click', function() {
                const taskId = parseInt($(this).attr('data-id'));
                showDeleteConfirmation(taskId);
            });
        }

        if (goToCalendarButton.length) {
            goToCalendarButton.on('click', function() {
                const taskId = parseInt($(this).attr('data-id'));
                const dateString = $(this).attr('data-date');
                goToCalendarForTask(taskId, dateString);
            });
        }

        if (toggleStatusButton.length) {
            toggleStatusButton.on('click', function() {
                const taskId = parseInt($(this).attr('data-id'));
                const currentStatus = $(this).attr('data-status');
                toggleTaskStatus(taskId, currentStatus);
            });
        }

        taskList.append(taskElement);
    });
}

// 初始化项目和上下文筛选下拉框
export function initProjectAndContextFilters() {
    
    // 获取所有唯一的项目并排序
    const projects = [...new Set(tasks.map(task => task.project).filter(project => project))].sort();
    
    // 获取所有唯一的上下文并排序
    const contexts = [...new Set(tasks.map(task => task.context).filter(context => context))].sort();
    
    // 使用新的公共函数初始化项目筛选器
    initDynamicFilterDropdown('project-filter', projects);
    
    // 使用新的公共函数初始化上下文筛选器
    initDynamicFilterDropdown('context-filter', contexts);
}

/**
 * 初始化筛选下拉框的事件监听器
 * @param {string} filterId - 筛选器的ID
 */
function initFilterDropdown(filterId) {
    const filterElement = $('#' + filterId);
    if (filterElement.length && !filterElement.attr('data-event-added')) {
        filterElement.attr('data-event-added', 'true');
        filterElement.on('change', function() {
            handleFilterChange(this.id);
        });
        filterElement.on('click', function(e) {
            // 防止事件冒泡导致失焦
            e.stopPropagation();
            $(this).toggleClass('expanded');
            // 同时切换容器的expanded类以控制箭头旋转
            $(this).parent().toggleClass('expanded');
        });
        filterElement.on('blur', function() {
            // 失焦时折叠下拉框并触发筛选
            $(this).removeClass('expanded');
            // 同时移除容器的expanded类
            $(this).parent().removeClass('expanded');
        });
    }
}

/**
 * 初始化动态筛选下拉框（用于项目和上下文等需要动态生成选项的筛选器）
 * @param {string} filterId - 筛选器的ID
 * @param {Array} values - 要添加的选项值数组
 */
function initDynamicFilterDropdown(filterId, values) {
    const filterElement = $('#' + filterId);
    if (filterElement.length) {
        // 保存当前选中的值
        const selectedValues = Array.from(filterElement[0].selectedOptions).map(option => option.value);
        
        // 清空除了"全部"选项外的所有选项
        const allOption = filterElement.find('option[value="all"]');
        filterElement.empty();
        if (allOption.length) {
            filterElement.append(allOption);
        } else {
            const option = $('<option>').val('all').text('全部').prop('selected', true);
            filterElement.append(option);
        }
        
        // 添加选项
        values.forEach(value => {
            const option = $('<option>').val(value).text(value);
            filterElement.append(option);
        });
        
        // 恢复选中的值
        if (selectedValues.length > 0) {
            selectedValues.forEach(value => {
                const option = filterElement.find(`option[value="${value}"]`);
                if (option.length) {
                    option.prop('selected', true);
                }
            });
        }
        
        // 初始化事件监听器
        initFilterDropdown(filterId);
    }
}

// 添加事件监听器
function addFilterEventListeners() {
    // 添加搜索框事件监听器
    const searchInput = $('#search-input');
    if (searchInput.length && !searchInput.attr('data-event-added')) {
        searchInput.attr('data-event-added', 'true');
        // 移除实时筛选，改为由查询按钮触发
        // searchInput.on('input', () => renderTaskList(tasks));
    }

    // 添加查询按钮事件监听器
    const filterSearchBtn = $('#filter-search-btn');
    if (filterSearchBtn.length && !filterSearchBtn.attr('data-event-added')) {
        filterSearchBtn.attr('data-event-added', 'true');
        filterSearchBtn.on('click', performFiltering);
    }
}

// 确保在DOM加载完成后添加事件监听器
$(document).ready(addFilterEventListeners);

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
        const filterElement = $('#' + filterId);
        if (filterElement.length) {
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
    filterElement.find('option').prop('selected', false);
    
    // 检查是否有记录的默认值
    if (defaultFilterValues[filterId] && defaultFilterValues[filterId].length > 0) {
        // 使用记录的默认值
        defaultFilterValues[filterId].forEach(defaultValue => {
            const option = filterElement.find(`option[value="${defaultValue}"]`);
            if (option.length) {
                option.prop('selected', true);
            }
        });
    } else {
        // 如果没有记录的默认值，则尝试选中"全部"选项
        const allOption = filterElement.find('option[value="all"]');
        if (allOption.length) {
            allOption.prop('selected', true);
        } else {
            // 如果没有"全部"选项，则选中所有选项
            filterElement.find('option').prop('selected', true);
        }
    }
    
    // 触发change事件以更新UI状态
    filterElement.trigger('change');
}

// 筛选任务
export function filterTasks(tasks) {
    try {
        const searchInput = $('#search-input') || { val: () => '' };
        const searchTerm = searchInput.val() || '';
        
        // 获取多选下拉框选中的值，添加空值检查以避免运行时错误
        const getFilterValues = (filterId) => {
            const element = $('#' + filterId);
            if (!element.length) return ['all']; // 元素不存在时返回默认值
            return Array.from(element[0].selectedOptions || []).map(option => option.value);
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