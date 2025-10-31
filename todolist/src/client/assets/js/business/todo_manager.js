// 主逻辑模块 - 导入导出问题已修复
import { loadTasksFromFile, saveTasksToFile, calculateTaskDisplayStatus } from './todo/task_parser.js';
import { getHolidayData, holidayDataTimestamp } from './common/holiday_manager.js';
import { renderCalendar } from './todo/calendar_renderer.js';
import { renderTaskList, performFiltering, initProjectAndContextFilters, setAllFiltersToDefault } from './todo/task_list_renderer.js';

// 全局变量
export let tasks = []; // 任务数据
export let currentDate = new Date(); // 当前日期
const defaultFileName = 'todo.txt'; // 默认文件名


// 启动脚本相关常量
const SCRIPT_DIRECTORY = '~/script/todo'; // 脚本目录
const START_SCRIPT_NAME = 'start.sh'; // 启动脚本文件名
const FULL_START_COMMAND = `sh ${SCRIPT_DIRECTORY}/${START_SCRIPT_NAME}`; // 完整启动命令

// 获取当前选择的文件名
export function getCurrentFileName() {
    const fileDropdown = document.getElementById('todo-file-select');
    return fileDropdown ? fileDropdown.value : defaultFileName;
}

// 跳转到指定日期
export function goToDate(date) {
    currentDate = new Date(date);
    renderCalendar(currentDate, tasks);
}

// 初始化节日数据
async function initFestivals() {
    try {
        // 使用lunar_utils.js中封装的loadHolidayConfig函数获取节日数据
        const config = await window.lunarUtils.loadHolidayConfig();
    } catch (error) {
        console.error('加载节日配置时出错:', error);
    }
}

// 初始化函数
export async function init() {
    try {
        // 1. 初始化节假日数据
        await getHolidayData();
        
        // 2. 初始化节日数据
        await initFestivals();
        
        // 2. 更新文件下拉框
        await updateFileDropdown();
        
        // 3. 确保始终有模拟数据显示
        // 生成当前日期和未来几天的日期
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const dayAfterTomorrow = new Date(today);
        dayAfterTomorrow.setDate(today.getDate() + 2);
        
        // 格式化日期为YYYY-MM-DD
        function formatDate(date) {
            return date.toISOString().split('T')[0];
        }
        
        // 获取当前选择的文件名
        const currentFileName = getCurrentFileName();
        
        // 尝试加载文件，如果文件不存在或为空，则使用模拟数据
        try {
            tasks = await loadTasksFromFile(currentFileName);
        } catch (error) {
            console.error('加载任务文件失败:', error);
        }
        
        // 4. 渲染日历
        await renderCalendar(currentDate, tasks);
        
        // 5. 渲染任务列表
        renderTaskList(tasks);
        
        // 6. 添加事件监听器
        addEventListeners();
    } catch (error) {
        console.error('初始化失败:', error);
        // 显示错误信息
        const errorElement = document.createElement('div');
        errorElement.classList.add('fixed', 'top-4', 'right-4', 'bg-red-500', 'text-white', 'p-4', 'rounded-lg', 'shadow-lg');
        errorElement.textContent = `初始化失败: ${error.message}`;
        document.body.appendChild(errorElement);
        
        // 3秒后自动关闭错误提示
        setTimeout(() => {
            errorElement.classList.add('opacity-0', 'transition-opacity', 'duration-500');
            setTimeout(() => {
                document.body.removeChild(errorElement);
            }, 500);
        }, 3000);
    }
}

// 更新文件下拉框
async function updateFileDropdown() {
    try {
        const response = await fetch('/api/file/scan');
        const data = await response.json();
        
        if (data.success) {
            const fileDropdown = document.getElementById('todo-file-select');
            if (fileDropdown) {
                fileDropdown.innerHTML = '';
                
                // 添加所有扫描到的文件
                data.files.forEach(file => {
                    if (file.exists) {
                        const option = document.createElement('option');
                        option.value = file.name;
                        option.textContent = file.name;
                        fileDropdown.appendChild(option);
                    }
                });
                
                // 如果有默认文件，选中它
                if (data.defaultFile) {
                    fileDropdown.value = data.defaultFile;
                }
            }
        } else {
            console.error('更新文件下拉框失败:', data.message);
        }
    } catch (error) {
        console.error('获取文件列表失败:', error);
        
        // 失败时，至少添加默认文件
        const fileDropdown = document.getElementById('todo-file-select');
        if (fileDropdown) {
            fileDropdown.innerHTML = '';
            const option = document.createElement('option');
            option.value = defaultFileName;
            option.textContent = defaultFileName;
            fileDropdown.appendChild(option);
        }
    }
}

// 处理筛选器变化
export function handleFilterChange(filterId) {
    const filterElement = document.getElementById(filterId);
    
    // 获取所有选中的值
    const selectedValues = Array.from(filterElement.selectedOptions).map(option => option.value);
    
    // 检查是否选中了"全部"选项
    const hasSelectedAll = selectedValues.includes('all');
    
    if (hasSelectedAll) {
        // 如果选中了"全部"选项，取消其他所有选择
        if (selectedValues.length > 1) {
            filterElement.value = ['all'];
        }
    } else if (selectedValues.length === 0) {
        // 当没有选择任何选项时，自动选择"全部"选项
        filterElement.value = ['all'];
    }
}

// 保存当前筛选值
export function saveCurrentFilters() {
    // 辅助函数：安全地获取筛选器值
    const getFilterValues = (filterId) => {
        const element = document.getElementById(filterId);
        if (!element || !element.selectedOptions) {
            return ['all']; // 默认返回全部选项
        }
        return Array.from(element.selectedOptions).map(option => option.value);
    };
    
    const filters = {
        priority: getFilterValues('priority-filter'),
        status: getFilterValues('status-filter'),
        date: getFilterValues('date-filter'),
        project: getFilterValues('project-filter'),
        context: getFilterValues('context-filter')
    };
    localStorage.setItem('taskFilters', JSON.stringify(filters));
}

// 添加事件监听器
function addEventListeners() {
    // 添加任务按钮
    document.getElementById('btn-add-task')?.addEventListener('click', openAddTaskModal);
    
    // 扫描文件按钮
    document.getElementById('btn-scan-files')?.addEventListener('click', scanAndUpdateFiles);
    
    // 文件下拉框
    document.getElementById('todo-file-select')?.addEventListener('change', async () => {
        const fileDropdown = document.getElementById('todo-file-select');
        const loadedTasks = await loadTasksFromFile(fileDropdown.value);
        tasks = loadedTasks;
        await renderCalendar(currentDate, tasks);
        renderTaskList(tasks);
        // 切换文件后更新显示
        updateCurrentTodoFileDisplay();
    });
    
    // 保存任务表单
    document.getElementById('task-form')?.addEventListener('submit', saveTask);
    
    // 取消任务按钮
    document.getElementById('cancel-task')?.addEventListener('click', closeTaskModal);
    
    // 下一月按钮
    document.getElementById('next-month')?.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar(currentDate, tasks);
    });
    
    // 上一月按钮
    document.getElementById('prev-month')?.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar(currentDate, tasks);
    });
    
    // 今天按钮
    document.getElementById('btn-today')?.addEventListener('click', () => {
        currentDate = new Date();
        performFiltering(); // 使用performFiltering确保应用筛选条件
    });
    
    // 加载文件按钮
    document.getElementById('btn-load-file')?.addEventListener('click', async () => {
        const fileDropdown = document.getElementById('todo-file-select');
        const loadedTasks = await loadTasksFromFile(fileDropdown.value);
        tasks = loadedTasks;
        
        // 重新初始化项目和上下文筛选下拉框
        initProjectAndContextFilters();
        
        // 重置所有筛选参数为默认勾选值
        setAllFiltersToDefault();
        
        // 给足够的时间让所有setTimeout执行完毕
        setTimeout(async () => {
            // 重新渲染日历和任务列表
            await renderCalendar(currentDate, tasks);
            renderTaskList(tasks);
            
            // 加载后更新显示
            updateCurrentTodoFileDisplay();
            
            // 执行筛选操作，确保筛选项参数正确应用
            performFiltering();
        }, 200); // 比setTimeout中的100ms稍长
    });
    
    // 折叠浮层详情按钮
    document.getElementById('toggle-detail-panel')?.addEventListener('click', toggleDetailPanel);
    
    // 初始化显示当前任务文件名和节假日缓存时间
    updateCurrentTodoFileDisplay();
    updateCurrentHolidayCacheDisplay();
}

// 扫描并更新文件
async function scanAndUpdateFiles() {
    try {
        await updateFileDropdown();
        const fileDropdown = document.getElementById('todo-file-select');
        const filename = fileDropdown?.value || defaultFileName;
        const loadedTasks = await loadTasksFromFile(filename);
        tasks = Array.isArray(loadedTasks) ? loadedTasks : [];
        await renderCalendar(currentDate, tasks);
        await renderTaskList(tasks);
        // 扫描后更新当前任务文件名显示
        updateCurrentTodoFileDisplay();
    } catch (error) {
        console.error('扫描文件并加载任务失败:', error);
    }
}

// 打开添加任务模态框
export function openAddTaskModal() {
    const modalTitle = document.getElementById('modal-title');
    const taskId = document.getElementById('task-id');
    const taskForm = document.getElementById('task-form');
    const taskStartDate = document.getElementById('task-start-date');
    const taskDueDate = document.getElementById('task-due-date');
    const taskStatus = document.getElementById('task-status');
    const taskModal = document.getElementById('task-modal');
    
    modalTitle.textContent = '新增任务';
    taskId.value = '';
    taskForm.reset();
    
    const today = new Date().toISOString().split('T')[0];
    taskStartDate.value = today;
    taskDueDate.value = today;
    taskStatus.value = 'pending';
    
    taskModal.classList.remove('hidden');
}

// 关闭任务模态框
function closeTaskModal() {
    document.getElementById('task-modal')?.classList.add('hidden');
}

// 添加ESC快捷键关闭模态框功能
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('task-modal')?.classList.contains('hidden')) {
        closeTaskModal();
    }
});

// 保存任务
async function saveTask(e) {
    e.preventDefault();
    
    const taskId = document.getElementById('task-id').value;
    const title = document.getElementById('task-title').value.trim();
    const priority = document.getElementById('task-priority').value;
    const status = document.getElementById('task-status').value;
    const dueDate = document.getElementById('task-due-date').value;
    const startDate = document.getElementById('task-start-date').value;
    const project = document.getElementById('task-project').value.trim() || null;
    const context = document.getElementById('task-context').value.trim() || null;
    const note = document.getElementById('task-note').value.trim() || '';
    
    if (!title) return;
    
    if (startDate && dueDate && startDate > dueDate) {
        alert('开始日期不能晚于截止日期');
        return;
    }
    
    if (taskId) {
        const index = tasks.findIndex(t => t.id === parseInt(taskId));
        if (index !== -1) {
            const updatedTask = {
                ...tasks[index],
                title,
                priority,
                status,
                dueDate: dueDate || null,
                startDate: startDate || null,
                project,
                context,
                note
            };
            // 更新显示状态
            updatedTask.displayStatus = calculateTaskDisplayStatus(updatedTask);
            tasks[index] = updatedTask;
        }
    } else {
        // 使用行号作为任务ID（从1开始）
        const newId = tasks.length + 1;
        const newTask = {
            id: newId,
            title,
            priority,
            status,
            dueDate: dueDate || null,
            startDate: startDate || null,
            project,
            context,
            note
        };
        // 计算显示状态
        newTask.displayStatus = calculateTaskDisplayStatus(newTask);
        tasks.push(newTask);
    }
    
    await saveTasksToFile(tasks, getCurrentFileName());
    closeTaskModal();
    
    // 强制重新渲染任务列表和日历，确保任务状态更新后UI正确显示
    await renderCalendar(currentDate, tasks);
    
    // 先清空任务列表，然后再重新渲染，确保完全刷新状态显示
    const taskList = document.getElementById('task-list');
    if (taskList) {
        taskList.innerHTML = '';
    }
    await renderTaskList(tasks);
}

// 切换详情面板显示/隐藏
function toggleDetailPanel() {
    const detailPanel = document.getElementById('detail-panel');
    const toggleButton = document.getElementById('toggle-detail-panel');
    const icon = toggleButton.querySelector('i');
    
    if (detailPanel.classList.contains('hidden')) {
        detailPanel.classList.remove('hidden');
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
        toggleButton.textContent = '详情';
        toggleButton.prepend(icon);
    } else {
        detailPanel.classList.add('hidden');
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
        toggleButton.textContent = '详情';
        toggleButton.prepend(icon);
    }
}

// 更新当前任务文件名显示
function updateCurrentTodoFileDisplay() {
    const currentTodoFileElement = document.getElementById('current-todo-file');
    if (currentTodoFileElement) {
        const fileName = getCurrentFileName();
        currentTodoFileElement.textContent = `任务文件: ${fileName}`;
    }
}

// 更新当前节假日缓存时间显示
function updateCurrentHolidayCacheDisplay() {
    const currentHolidayCacheElement = document.getElementById('current-holiday-cache');
    if (currentHolidayCacheElement && holidayDataTimestamp) {
        const cacheDate = new Date(holidayDataTimestamp);
        const formattedDate = cacheDate.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        currentHolidayCacheElement.textContent = `节假日缓存: ${formattedDate}`;
    }
}



// 检查服务状态
async function checkServerStatus() {
    try {
        // 尝试发送一个简单的请求来检查服务是否可用
        const response = await fetch('/api/check-status', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 1000 // 设置1秒超时
        });
        return response.ok;
    } catch (error) {
        // 如果请求失败，说明服务可能未运行
        return false;
    }
}

// 更新服务器控制按钮的状态
function updateServerControlButton(isRunning) {
    const button = document.getElementById('btn-server-control');
    const icon = document.getElementById('server-control-icon');
    const text = document.getElementById('server-control-text');
    
    if (button && icon && text) {
        if (isRunning) {
            // 服务正在运行，显示关闭按钮样式
            button.className = 'bg-red-500 text-white px-3 py-1.5 rounded hover:bg-red-600 transition-colors text-sm flex items-center h-7';
            icon.className = 'fa fa-power-off mr-1';
            text.textContent = '关闭服务';
        } else {
            // 服务未运行，显示启动按钮样式
            button.className = 'bg-green-500 text-white px-3 py-1.5 rounded hover:bg-green-600 transition-colors text-sm flex items-center h-7';
            icon.className = 'fa fa-play mr-1';
            text.textContent = '启动服务';
        }
    }
}

// 显示通知函数
export function showNotification(message, duration = 3000, preventReload = false) {
    console.debug('显示通知:', { message, duration });
    
    // 创建或复用通知元素
    let notification = document.getElementById('auto-notification') || createNotificationElement();
    
    // 设置消息内容和样式
    notification.textContent = message;
    
    // 显示通知
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    }, 10);
    
    // 设置消失逻辑
    if (preventReload) {
        // 阻止刷新的通知，等待用户点击
        notification.style.cursor = 'pointer';
        notification.addEventListener('click', handleNotificationClose);
    } else {
        // 正常自动消失
        setTimeout(() => handleNotificationClose(), duration);
    }

    return notification;
    
    // 辅助函数：创建通知元素
    function createNotificationElement() {
        const element = document.createElement('div');
        element.id = 'auto-notification';
        element.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background-color: #3b82f6;
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
            font-size: 16px;
            font-weight: 500;
            z-index: 99999;
            opacity: 0;
            transform: translateY(20px);
            transition: opacity 0.3s ease, transform 0.3s ease;
            pointer-events: auto;
            max-width: 350px;
            text-align: center;
        `;
        document.body.appendChild(element);
        return element;
    }
    
    // 辅助函数：处理通知关闭
    function handleNotificationClose() {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(20px)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }
}

// 关闭服务器函数
function shutdownServer() {
    showShutdownModal();
    performServerShutdown();
}

// 实际执行关闭服务器的函数
async function performServerShutdown() {
    try {
        const response = await fetch('/api/shutdown', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            // 服务器确认关闭成功
            setTimeout(() => {
                showNotification('服务已成功关闭。', 3000);
                updateServerControlButton(false);
            }, 1000);
        } else {
            // 关闭失败
            showNotification('关闭服务失败，请稍后再试。', 3000);
        }
    } catch (error) {
        // 服务器关闭后网络请求会失败，这是正常的
        console.debug('服务已关闭 (预期的网络错误):', error.message);
        
        // 显示成功关闭通知
        setTimeout(() => {
            showNotification('服务已成功关闭。', 3000);
            updateServerControlButton(false);
        }, 1000);
    }
}

// 显示关闭服务模态框
function showShutdownModal() {
    const modal = document.getElementById('shutdown-modal');
    const messageElement = document.getElementById('shutdown-message');
    
    if (modal && messageElement) {
        // 设置模态框消息
        messageElement.textContent = `确定要关闭待办事项管理系统吗？\n\n关闭后需要重新运行${START_SCRIPT_NAME}或node server.js来启动服务。`;
        
        // 显示模态框
        modal.classList.remove('hidden');
    }
}

// 隐藏关闭服务模态框
function hideShutdownModal() {
    const modal = document.getElementById('shutdown-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// 使用AppleScript URL方案直接启动服务
function tryDirectLaunch() {
    console.log('尝试直接启动服务...');
    
    // 构建AppleScript命令，打开终端并执行启动脚本
    const applescript = `
tell application "Terminal"
    do script "${FULL_START_COMMAND}"
    delay 2
end tell
tell application "Script Editor" to quit saving no`;
    const encodedScript = encodeURIComponent(applescript);
    const url = `applescript://com.apple.scripteditor?action=new&script=${encodedScript}`;
    
    try {
        window.location.href = url;
        return true;
    } catch (error) {
        console.error('直接启动失败:', error);
        showNotification('无法自动启动服务，请尝试其他启动方式。');
        return false;
    }
}

// 显示启动指南
function showDetailedGuide() {
    const guideMessage = `待办事项系统启动指南：

📁 方式一：在Finder中双击运行启动脚本
1. 导航到 ${SCRIPT_DIRECTORY} 文件夹
2. 双击 ${START_SCRIPT_NAME} 文件

💻 方式二：手动打开终端
1. 在应用程序的「实用工具」中打开终端
2. 执行命令： ${FULL_START_COMMAND}

服务启动后，访问 http://localhost:3000 即可使用系统！`;
    
    alert(guideMessage);
}

// 页面加载完成后初始化
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', async () => {
        
        // 首先尝试检查服务状态
        let isServerRunning = false;
        try {
            isServerRunning = await checkServerStatus();
        } catch (error) {
            console.log('服务未运行，网络请求失败:', error);
            isServerRunning = false;
        }
        
        // 根据服务状态初始化应用
        if (isServerRunning) {
            // 服务正在运行，初始化完整应用
            init();
        } else {
            // 服务未运行，显示错误信息
            console.log('服务未运行，请先启动服务...');
            const mainContent = document.getElementById('main-content');
            if (mainContent) {
                mainContent.innerHTML = `
                    <div class="text-center p-8 bg-gray-50 rounded-lg">
                        <div class="text-red-500 text-6xl mb-4">❌</div>
                        <h2 class="text-2xl font-bold mb-2">服务未运行</h2>
                        <p class="text-gray-600 mb-6">待办事项管理系统的后端服务当前未启动。</p>
                        <p class="text-gray-500">请点击顶部的"启动服务"按钮或手动运行启动脚本。</p>
                    </div>
                `;
            }
        }
        
        // 更新服务器控制按钮状态
        updateServerControlButton(isServerRunning);
        
        // 添加服务器控制按钮的事件监听器
        const serverControlButton = document.getElementById('btn-server-control');
        if (serverControlButton) {
            serverControlButton.addEventListener('click', handleServerControlClick);
        }
        
        // 添加关闭服务模态框按钮的事件监听器
        const confirmShutdownButton = document.getElementById('confirm-shutdown');
        const cancelShutdownButton = document.getElementById('cancel-shutdown');
        const shutdownModal = document.getElementById('shutdown-modal');
        
        if (confirmShutdownButton) {
            confirmShutdownButton.addEventListener('click', () => {
                hideShutdownModal();
                performServerShutdown();
            });
        }
        
        if (cancelShutdownButton) {
            cancelShutdownButton.addEventListener('click', hideShutdownModal);
        }
        
        // 点击模态框背景关闭模态框
        if (shutdownModal) {
            shutdownModal.addEventListener('click', (e) => {
                if (e.target === shutdownModal) {
                    hideShutdownModal();
                }
            });
        }
    });
}

// 启动服务器函数
async function startServer() {
    // 检查服务是否已经在运行
    if (await checkServerStatus()) {
        showNotification('服务已经在运行中！');
        return;
    }
    
    // 尝试启动服务，如果失败则显示指南
    if (!tryDirectLaunch()) {
        showDetailedGuide();
        return;
    }
    
    // 定期检查服务启动状态（最多检查10次）
    let checkCount = 0;
    const checkInterval = setInterval(async () => {
        checkCount++;
        
        if (await checkServerStatus()) {
            clearInterval(checkInterval);
            showNotification('服务已成功启动！即将刷新页面...', 2000);
            setTimeout(() => location.reload(), 1500);
        } else if (checkCount > 10) {
            clearInterval(checkInterval);
            showNotification('启动服务超时，请检查终端中的运行状态。');
        }
    }, 1000);
}

// 处理服务器控制按钮的点击事件
async function handleServerControlClick() {
    const text = document.getElementById('server-control-text');
    
    if (!text) {
        console.error('未找到服务器控制文本元素');
        return;
    }
    
    // 根据按钮文本执行相应操作
    if (text.textContent === '关闭服务') {
        await shutdownServer();
    } else {
        await startServer();
    }
}