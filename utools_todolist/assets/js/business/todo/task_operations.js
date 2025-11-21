/**
 * 任务操作模块
 * 针对页面：任务列表视图页面、任务编辑模态框、删除确认模态框
 * 业务功能模块：
 * 1. 处理任务的新建、编辑、删除操作
 * 2. 管理任务状态切换（完成/进行中/未开始）
 * 3. 提供返回列表视图功能
 * 4. 实现任务跳转日历功能
 * 5. 初始化和管理删除确认模态框
 * 6. 提供日期格式化相关工具函数
 * 使用场景：
 * - 用户在任务列表中执行任务的增删改查操作
 * - 用户在日历视图中需要查看或编辑任务详情
 * - 任务状态变更时需要同步更新任务列表和日历视图
 * - 需要弹出模态框进行任务编辑或删除确认
 * 与其他模块配合：
 * - 依赖task_parser.js进行任务数据的保存和状态计算
 * - 依赖calendar_renderer.js和task_list_renderer.js进行视图更新
 * - 依赖todo_manager.js获取当前任务列表和文件信息
 */
import { tasks, goToDate, getCurrentFileName, currentDate } from '../todo_manager.js';
import { saveTasksToFile, calculateTaskDisplayStatus } from './task_parser.js';
import { renderCalendar } from './calendar_renderer.js';
import { renderTaskList } from './task_list_renderer.js';

// 返回列表视图功能
export function backToListView() {
    const tabList = document.getElementById('tab-list');
    const listView = document.getElementById('list-view');
    
    // 优先模拟点击任务列表tab元素，这样会触发原始的点击事件处理逻辑
    if (tabList) {
        // 创建一个鼠标点击事件
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        
        // 触发点击事件
        tabList.dispatchEvent(clickEvent);
        
        // 确保没有默认的焦点轮廓
        tabList.style.outline = 'none';
    }
    
    // 滚动到任务列表视图
    if (listView) {
        listView.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// 编辑任务功能
export function editTask(taskId) {
    const task = tasks.find(t => t.id === Number(taskId));
    if (!task) {
        return;
    }
    
    // 填充表单字段
    document.getElementById('task-id').value = task.id;
    // 设置任务编号显示
    document.getElementById('task-id-display').textContent = `#${task.id}`;
    document.getElementById('task-title').value = task.title || '';
    document.getElementById('task-note').value = task.note || '';
    document.getElementById('task-project').value = task.project || '';
    document.getElementById('task-context').value = task.context || '';
    document.getElementById('task-priority').value = task.priority || 'none';
    document.getElementById('task-status').value = task.status || 'pending';
    
    // 处理截止日期
    const dueDateInput = document.getElementById('task-due-date');
    if (task.dueDate) {
        const formattedDate = formatDateForInput(task.dueDate);
        dueDateInput.value = formattedDate;
    } else {
        dueDateInput.value = '';
    }
    
    // 处理开始日期，确保开始日期为空时输入框显示为空
    const startDateInput = document.getElementById('task-start-date');
    if (task.startDate) {
        const formattedDate = formatDateForInput(task.startDate);
        startDateInput.value = formattedDate;
    } else {
        startDateInput.value = '';
    }
    
    // 显示模态框
    document.getElementById('modal-title').textContent = '编辑任务';
    document.getElementById('task-modal').classList.remove('hidden');
}

// 切换任务完成状态功能
export async function toggleTaskCompletion(taskId) {
    const task = tasks.find(t => t.id === Number(taskId));
    if (!task) {
        return;
    }
    
    // 切换任务状态
    task.status = task.status === 'completed' ? 'inprogress' : 'completed';
    
    // 更新显示状态
    task.displayStatus = calculateTaskDisplayStatus(task);
    
    // 保存更改
    await saveTasksToFile(tasks, getCurrentFileName());
    
    // 重新渲染任务列表
    renderTaskList(tasks);
    
    // 重新渲染日历
    renderCalendar(currentDate, tasks);
}

// 显示删除确认模态框
export function showDeleteConfirmation(taskId) {
    const task = tasks.find(task => task.id === Number(taskId));
    if (!task) {
        return;
    }
    
    // 显示自定义删除确认模态框
    document.getElementById('delete-task-id').value = taskId;
    document.getElementById('delete-task-title').textContent = `您确定要删除任务 "${task.title}" 吗？`;
    document.getElementById('delete-modal').classList.remove('hidden');
}

// 执行删除任务操作
export async function deleteTask(taskId) {
    const taskIndex = tasks.findIndex(t => t.id === Number(taskId));
    if (taskIndex === -1) {
        return;
    }
    
    // 删除任务
    tasks.splice(taskIndex, 1);
    
    // 重新分配ID
    tasks.forEach((task, index) => {
        task.id = index + 1; // 确保ID从1开始
    });
    
    // 保存更改
    await saveTasksToFile(tasks, getCurrentFileName());
    
    // 重新渲染任务列表
    renderTaskList(tasks);
    
    // 重新渲染日历
    renderCalendar(currentDate, tasks);
    
    // 清除隐藏输入框中的任务ID，避免下次使用旧ID
    document.getElementById('delete-task-id').value = '';
    
    // 隐藏模态框
    document.getElementById('delete-modal').classList.add('hidden');
}

// 初始化删除确认模态框事件
export function initDeleteModal() {
    // 添加返回列表按钮事件监听
    document.getElementById('btn-back-to-list')?.addEventListener('click', backToListView);
    // 确认删除
    document.getElementById('confirm-delete')?.addEventListener('click', async function() {
        const taskIdStr = document.getElementById('delete-task-id').value;
        const taskId = parseInt(taskIdStr);
        
        // 验证taskId是否有效
        if (isNaN(taskId) || taskId <= 0) {
            // 隐藏模态框，避免用户看到错误状态
            document.getElementById('delete-modal').classList.add('hidden');
            return;
        }
        
        await deleteTask(taskId);
        // deleteTask函数内部已经处理了保存、渲染和隐藏模态框的操作
    });
    
    // 取消删除
    document.getElementById('cancel-delete')?.addEventListener('click', function() {
        document.getElementById('delete-modal').classList.add('hidden');
        // 清除隐藏输入框中的任务ID，避免下次使用旧值
        document.getElementById('delete-task-id').value = '';
    });
    
    // 关闭删除模态框
    document.getElementById('close-modal')?.addEventListener('click', function() {
        // 获取事件目标
        const target = event.target;
        // 判断是任务编辑模态框还是删除模态框的关闭按钮
        if (target.closest('#delete-modal')) {
            document.getElementById('delete-modal').classList.add('hidden');
            // 清除隐藏输入框中的任务ID，避免下次使用旧值
            document.getElementById('delete-task-id').value = '';
        } else if (target.closest('#task-modal')) {
            document.getElementById('task-modal').classList.add('hidden');
        }
    });
    
    // 取消任务编辑
    document.getElementById('cancel-task')?.addEventListener('click', function() {
        document.getElementById('task-modal').classList.add('hidden');
    });
    
    // 点击非模态框区域关闭任务编辑模态框
    document.getElementById('task-modal')?.addEventListener('click', function(event) {
        if (event.target === this) {
            document.getElementById('task-modal').classList.add('hidden');
        }
    });
    
    // 点击非模态框区域关闭删除模态框
    document.getElementById('delete-modal')?.addEventListener('click', function(event) {
        if (event.target === this) {
            document.getElementById('delete-modal').classList.add('hidden');
            // 清除隐藏输入框中的任务ID，避免下次使用旧值
            document.getElementById('delete-task-id').value = '';
        }
    });
}

// 跳转到日历中对应的任务
export function goToCalendarForTask(taskId, dateString) {
    // 查找完整任务信息
    const task = tasks.find(t => t.id === Number(taskId));
    if (!task) {
        alert('未找到该任务');
        return;
    }
    
    // 根据任务编号直接定位到任务的第一天（优先使用startDate，如果没有则使用dueDate）
    let targetDate;
    if (task.startDate) {
        targetDate = new Date(task.startDate);
    } else if (task.dueDate) {
        targetDate = new Date(task.dueDate);
    } else if (dateString) {
        targetDate = new Date(dateString);
    } else {
        alert('该任务没有设置日期，无法跳转到日历中的具体日期。');
        return;
    }
    
    if (isNaN(targetDate.getTime())) {
        alert('日期无效，无法跳转到日历中的具体日期。');
        return;
    }
    
    // 格式化日期为YYYY-MM-DD格式，确保与日历单元格的data-date属性匹配
    const formattedDate = formatDateForCalendar(targetDate);
    
    // 先模拟点击任务日历tab按钮
    const tabCalendar = document.getElementById('tab-calendar');
    if (tabCalendar) {
        // 创建一个鼠标点击事件
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        
        // 触发点击事件
        tabCalendar.dispatchEvent(clickEvent);
        
        // 确保没有默认的焦点轮廓
        tabCalendar.style.outline = 'none';
    }
    
    // 更新当前日期并重新渲染日历
    goToDate(targetDate);
    
    // 滚动到日历视图 - 使用实际存在的日历容器元素
    const calendarView = document.getElementById('calendar-view');
    if (calendarView) {
        calendarView.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    // 高亮显示对应的日期和任务
    setTimeout(() => {
        // 尝试用格式化后的日期查找日历单元格
        const dateCell = document.querySelector(`[data-date="${formattedDate}"]`);
        if (dateCell) {
            // 移除所有已有的日期高亮
            document.querySelectorAll('.calendar-day-highlight').forEach(el => {
                el.classList.remove('calendar-day-highlight', 'border-2', 'border-blue-500', 'bg-blue-50');
            });
            
            // 清除所有任务的内联样式，防止之前的高亮保留
            document.querySelectorAll('.cursor-pointer.truncate').forEach(el => {
                el.style.border = '';
                const allSpans = el.querySelectorAll('span');
                allSpans.forEach(span => {
                    span.style.fontWeight = '';
                    span.style.color = '';
                    span.style.fontSize = '';
                });
            });
            
            // 添加日期高亮样式
            dateCell.classList.add('calendar-day-highlight', 'border-2', 'border-blue-500', 'bg-blue-50');
            
            // 查找并只高亮显示触发跳转的特定任务（仅在当前日期单元格中）
            const taskElements = dateCell.querySelectorAll('.cursor-pointer.truncate');
            if (taskElements.length > 0) {
                // 查找包含任务ID的任务元素
                let foundMatchingTask = false;
                
                // 尝试多种方式查找任务元素
                taskElements.forEach(taskElement => {
                    // 1. 检查元素内容是否包含任务ID
                    const taskElementContent = taskElement.textContent || '';
                    // 2. 检查元素或其父元素是否有data-id属性
                    const dataId = taskElement.getAttribute('data-id') || taskElement.parentElement.getAttribute('data-id');
                    
                    if (taskElementContent.includes(`#${task.id}`) || dataId === String(task.id)) {
                        foundMatchingTask = true;
                        // 为整个任务元素添加黑色加粗边框
                        taskElement.style.border = '3px solid black';
                        taskElement.style.borderRadius = '4px';
                        
                        // 查找并高亮所有文本元素
                        const allTextElements = taskElement.querySelectorAll('span');
                        allTextElements.forEach(element => {
                            element.style.fontWeight = 'bold';
                            element.style.color = 'black';
                        });
                        
                        // 特别处理标题元素（确保可见性）
                        const titleElement = taskElement.querySelector('.text-gray-700');
                        if (titleElement) {
                            titleElement.style.fontWeight = '900';
                            titleElement.style.color = 'black';
                            titleElement.style.fontSize = '1.1em';
                        }
                    }
                });
                
                if (!foundMatchingTask && taskElements.length > 0) {
                    // 如果没有精确匹配到任务ID，高亮显示当前日期的第一个任务
                    const firstTaskElement = taskElements[0];
                    firstTaskElement.style.border = '3px solid black';
                    firstTaskElement.style.borderRadius = '4px';
                }
            } else {
                // 日期单元格中没有任务元素
            }
        } else {
            // 未找到对应的日期单元格
        }
    }, 800); // 增加延迟时间，确保日历已经完全重新渲染
}

// 设置任务状态为已完成或重新开始
export async function toggleTaskStatus(taskId, currentStatus) {
    const task = tasks.find(t => t.id === Number(taskId));
    if (!task) {
        return;
    }
    
    // 切换任务状态
    if (currentStatus === 'completed') {
        task.status = 'inprogress';
    } else {
        task.status = 'completed';
    }
    
    // 更新显示状态
    task.displayStatus = calculateTaskDisplayStatus(task);
    
    // 保存更改
    await saveTasksToFile(tasks, getCurrentFileName());
    
    // 重新渲染任务列表
    renderTaskList(tasks);
    
    // 重新渲染日历
    renderCalendar(currentDate, tasks);
}

// 格式化日期显示
export function formatDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return '今天';
    } else if (date.toDateString() === tomorrow.toDateString()) {
        return '明天';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return '昨天';
    } else {
        return `${date.getMonth() + 1}月${date.getDate()}日`;
    }
}

// 格式化日期为输入框格式
export function formatDateForInput(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    
    // 检查是否为无效日期
    if (isNaN(date.getTime())) {
        return '';
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

// 格式化日期为YYYY-MM-DD格式，用于日历显示
export function formatDateForCalendar(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}