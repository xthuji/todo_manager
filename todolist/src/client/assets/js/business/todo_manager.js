/**
 * 任务管理系统主逻辑模块
 * 针对页面：任务管理页面 (todo页面)
 * 业务功能模块：
 *  1. 任务数据管理 - 加载、保存和维护任务数据
 *  2. 文件管理 - 支持多任务文件的切换和管理
 *  3. 日历与任务集成 - 将任务与日历视图关联展示
 *  4. 初始化协调 - 协调各模块的初始化流程
 *  5. 用户交互处理 - 处理用户操作事件和界面交互
 *  6. 通知系统 - 提供操作反馈和状态提示
 * 使用场景：
 *  1. 用户首次访问任务管理页面时的初始化流程
 *  2. 用户切换任务文件或加载不同任务列表
 *  3. 用户查看日历视图中的任务分布
 *  4. 用户添加、编辑或删除任务
 *  5. 系统需要显示操作状态或错误提示
 * 模块化设计：
 *  - 作为核心协调模块，集成多个专用子模块
 *  - 通过export暴露关键函数供其他模块调用
 *  - 统一管理全局任务状态和当前日期
 */
// 导入各功能模块

import { loadTasksFromFile, saveTasksToFile, calculateTaskDisplayStatus, convertTasksToTodoTxtFormat, parseTodoTxtFormat } from './todo/task_parser.js';
import { getHolidayData, holidayDataTimestamp } from './common/holiday_manager.js';
import { renderCalendar } from './todo/calendar_renderer.js';
import { renderTaskList, performFiltering, initProjectAndContextFilters, setAllFiltersToDefault, filterTasks } from './todo/task_list_renderer.js';

// 全局变量
export let tasks = []; // 任务数据
export let currentDate = new Date(); // 当前日期
const defaultFileName = 'todo.txt'; // 默认文件名

// 临时存储导入的任务数据，用于模态框确认后保存
let importedTasksForNewFile = null;


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

// 清理旧的筛选参数缓存
function clearOldFilterCache() {
    // 移除可能存在的旧筛选参数缓存
    if (localStorage.getItem('taskFilters')) {
        localStorage.removeItem('taskFilters');
        console.log('已清理旧的筛选参数缓存');
    }
}

// 初始化函数
export async function init() {
    try {
        // 1. 清理旧的筛选参数缓存
        clearOldFilterCache();
        
        // 2. 初始化节假日数据
        await getHolidayData();
        
        // 3. 初始化节日数据
        await initFestivals();
        
        // 4. 更新文件下拉框
        await updateFileDropdown();
        
        // 5. 确保始终有模拟数据显示
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
        
        // 6. 渲染日历
        const filteredTasks = filterTasks(tasks);
        await renderCalendar(currentDate, filteredTasks);
        
        // 7. 渲染任务列表
        renderTaskList(tasks);
        
        // 8. 初始化时设置默认筛选参数（仅在页面首次加载时执行一次）
        // 等待DOM完全加载后再设置筛选参数
        setTimeout(async () => {
            const { setAllFiltersToDefault } = await import('./todo/task_list_renderer.js');
            setAllFiltersToDefault();
        }, 100);
        
        // 9. 添加事件监听器
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
        console.log('开始扫描文件列表...');
        const response = await fetch('/api/file/scan');
        
        if (!response.ok) {
            console.error('文件扫描API返回错误状态:', response.status);
            throw new Error(`文件扫描失败: ${response.status}`);
        }
        
        const responseData = await response.json();
        console.log('文件扫描API返回数据:', responseData);
        
        // 兼容两种格式：{data, timestamp} 和直接返回数据
        let data;
        if (responseData.data) {
            // 标准格式 {data, timestamp}
            data = responseData.data;
        } else {
            // 直接返回的数据格式
            data = responseData;
        }
        
        if (data && (data.files || data.success)) {
            const fileDropdown = document.getElementById('todo-file-select');
            if (fileDropdown) {
                fileDropdown.innerHTML = '';
                
                // 添加所有扫描到的文件
                if (data.files && Array.isArray(data.files)) {
                    data.files.forEach(file => {
                        if (file && file.exists) {
                            const option = document.createElement('option');
                            option.value = file.name;
                            option.textContent = file.name;
                            fileDropdown.appendChild(option);
                        }
                    });
                }
                
                // 如果有默认文件，选中它
                if (data.defaultFile) {
                    fileDropdown.value = data.defaultFile;
                }
                
                console.log('文件下拉框更新成功');
            }
        } else {
            console.error('更新文件下拉框失败: 返回数据格式不正确');
            // 失败时，至少添加默认文件
            addDefaultFileToDropdown();
        }
    } catch (error) {
        console.error('获取文件列表失败:', error);
        addDefaultFileToDropdown();
    }
}

// 添加默认文件到下拉框
function addDefaultFileToDropdown() {
    const fileDropdown = document.getElementById('todo-file-select');
    if (fileDropdown) {
        fileDropdown.innerHTML = '';
        const option = document.createElement('option');
        option.value = defaultFileName;
        option.textContent = defaultFileName;
        fileDropdown.appendChild(option);
        console.log('已添加默认文件到下拉框');
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

// 保存当前筛选值 - 不再保存到localStorage，避免使用缓存
export function saveCurrentFilters() {
    // 为了保持接口兼容性，保留函数声明，但不再执行保存操作
    // 筛选参数将不再被缓存，每次页面加载都会使用默认值
    console.log('筛选参数不再保存到缓存');
}

// 添加事件监听器
function addEventListeners() {
    // 定义事件监听器配置
    const eventListeners = [
        // 任务相关
        { id: 'btn-add-task', event: 'click', handler: openAddTaskModal },
        { id: 'task-form', event: 'submit', handler: saveTask },
        { id: 'cancel-task', event: 'click', handler: closeTaskModal },
        
        // 文件相关
        { id: 'btn-scan-files', event: 'click', handler: scanAndUpdateFiles },
        { id: 'todo-file-select', event: 'change', handler: handleTodoFileChange },
        { id: 'btn-load-file', event: 'click', handler: handleLoadFileClick },
        { id: 'btn-new-file', event: 'click', handler: newFile },
        { id: 'btn-export-file', event: 'click', handler: exportFile },
        { id: 'btn-import-file', event: 'click', handler: importFile },
        { id: 'import-file', event: 'change', handler: handleFileImport },
        
        // 新建文件模态框
        { id: 'confirm-new-file', event: 'click', handler: handleNewFileConfirm },
        { id: 'cancel-new-file', event: 'click', handler: closeNewFileModal },
        
        // 日历导航
        { id: 'next-month', event: 'click', handler: handleNextMonthClick },
        { id: 'prev-month', event: 'click', handler: handlePrevMonthClick },
        { id: 'btn-today', event: 'click', handler: handleTodayClick },
        
        // UI相关
        { id: 'toggle-detail-panel', event: 'click', handler: toggleDetailPanel },
        
        // 全局事件
        { id: 'document', event: 'keydown', handler: handleDocumentKeydown },
        
        // 服务器控制相关
        { id: 'btn-server-control', event: 'click', handler: handleServerControlClick },
        { id: 'confirm-shutdown', event: 'click', handler: handleConfirmShutdownClick },
        { id: 'cancel-shutdown', event: 'click', handler: hideShutdownModal },
        { id: 'shutdown-modal', event: 'click', handler: handleShutdownModalClick }
    ];
    
    // 批量注册事件监听器
    eventListeners.forEach(({ id, event, handler }) => {
        const element = id === 'document' ? document : document.getElementById(id);
        if (element) {
            element.addEventListener(event, handler);
        }
    });
    
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

// 处理文档全局键盘事件
function handleDocumentKeydown(e) {
    if (e.key === 'Escape' && !document.getElementById('task-modal')?.classList.contains('hidden')) {
        closeTaskModal();
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

// 新建文件功能
function newFile() {
    // 显示自定义的新建文件模态对话框
    const modal = document.getElementById('new-file-modal');
    const fileNameInput = document.getElementById('new-file-name');
    
    if (modal && fileNameInput) {
        // 设置默认值
        fileNameInput.value = 'todo_new.txt';
        // 显示模态框
        modal.classList.remove('hidden');
        // 自动聚焦输入框
        fileNameInput.focus();
        fileNameInput.select();
    }
}

// 处理新建文件确认
async function handleNewFileConfirm() {
    try {
        const fileNameInput = document.getElementById('new-file-name');
        if (!fileNameInput) return;
        
        const newFileName = fileNameInput.value.trim();
        
        // 检查用户是否取消了输入
        if (!newFileName) {
            closeNewFileModal();
            return;
        }
        
        // 验证文件名格式
        if (!newFileName.endsWith('.txt')) {
            alert('文件名必须以.txt结尾');
            return;
        }
        
        if (!newFileName.startsWith('todo')) {
            alert('文件名必须以"todo"开头');
            return;
        }
        
        if (newFileName.trim() === '.txt') {
            alert('文件名不能为空');
            return;
        }
        
        let success;
        let successMessage;
        
        // 检查是否有导入的任务数据
        if (importedTasksForNewFile) {
            // 使用导入的任务数据创建文件
            success = await saveTasksToFile(importedTasksForNewFile, newFileName);
            successMessage = '文件导入成功';
            
            // 清空导入任务数据
            importedTasksForNewFile = null;
        } else {
            // 创建空的任务数组
            const emptyTasks = [];
            
            // 保存空文件到服务器
            success = await saveTasksToFile(emptyTasks, newFileName);
            successMessage = '文件创建成功';
        }
        
        if (success) {
            // 关闭模态框
            closeNewFileModal();
            
            // 刷新文件列表
            await updateFileDropdown();
            
            // 选择新创建的文件
            const fileDropdown = document.getElementById('todo-file-select');
            if (fileDropdown) {
                fileDropdown.value = newFileName;
            } else {
                console.error('未找到文件下拉框元素');
            }
            
            // 加载新文件
            if (importedTasksForNewFile) {
                tasks = importedTasksForNewFile;
                importedTasksForNewFile = null;
            } else {
                tasks = [];
            }
            
            // 确保所有UI更新操作都正确执行
            try {
                await renderCalendar(currentDate, tasks);
                renderTaskList(tasks);
                updateCurrentTodoFileDisplay();
            } catch (uiError) {
                console.error('更新UI时出错:', uiError);
            }
            
            // 显示成功消息 - 确保showNotification函数存在
            try {
                if (typeof showNotification === 'function') {
                    showNotification(successMessage);
                } else {
                    alert(successMessage);
                }
            } catch (notificationError) {
                console.error('显示通知时出错:', notificationError);
                alert(successMessage);
            }
        } else {
            alert('文件操作失败');
            
            // 清空导入任务数据
            importedTasksForNewFile = null;
        }
    } catch (error) {
        console.error('新建文件失败:', error);
        alert('文件创建失败: ' + error.message);
        
        // 关闭模态框
        closeNewFileModal();
        
        // 清空导入任务数据
        importedTasksForNewFile = null;
        // 确保模态框总是被关闭
        try {
            closeNewFileModal();
        } catch (modalError) {
            console.error('关闭模态框时出错:', modalError);
        }
    }
}

// 关闭新建文件模态框
function closeNewFileModal() {
    const modal = document.getElementById('new-file-modal');
    const modalTitle = modal?.querySelector('h3');
    const modalDescription = modal?.querySelector('p');
    const confirmButton = document.getElementById('confirm-new-file');
    const fileNameInput = document.getElementById('new-file-name');
    
    if (modal) {
        modal.classList.add('hidden');
        
        // 恢复模态框默认状态
        if (modalTitle) modalTitle.textContent = '新建文件';
        if (modalDescription) modalDescription.textContent = '请输入新的任务文件名（必须以"todo"开头并以.txt结尾）';
        if (confirmButton) confirmButton.textContent = '创建';
        if (fileNameInput) fileNameInput.value = 'todo_new.txt';
        
        // 清空导入任务数据（如果有的话）
        importedTasksForNewFile = null;
    }
}

// 导出文件功能
function exportFile() {
    try {
        const currentFileName = getCurrentFileName();
        
        // 将任务转换为todo.txt格式
        const content = convertTasksToTodoTxtFormat(tasks);
        
        // 创建下载链接
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = currentFileName;
        
        // 触发下载
        document.body.appendChild(link);
        link.click();
        
        // 清理
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        // 显示成功消息
        showNotification('文件导出成功');
    } catch (error) {
        console.error('导出文件失败:', error);
        alert('文件导出失败: ' + error.message);
    }
}

// 导入文件功能
function importFile() {
    // 触发文件选择对话框
    document.getElementById('import-file').click();
}

// 处理文件导入
async function handleFileImport(event) {
    try {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        
        // 检查文件类型
        if (!file.name.endsWith('.txt')) {
            alert('请选择.txt格式的文件');
            return;
        }
        
        // 读取文件内容
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target.result;
                
                // 解析文件内容为任务
                const importedTasks = parseTodoTxtFormat(content);
                
                // 提示用户选择是否覆盖当前文件或创建新文件
                const option = confirm('是否要覆盖当前文件？\n\n点击"确定"覆盖当前文件，点击"取消"创建新文件。');
                
                if (option) {
                    // 覆盖当前文件
                    const currentFileName = getCurrentFileName();
                    await saveTasksToFile(importedTasks, currentFileName);
                    
                    // 重新加载文件
                    tasks = await loadTasksFromFile(currentFileName);
                } else {
                    // 创建新文件 - 使用自定义模态框
                    importedTasksForNewFile = importedTasks;
                    const modal = document.getElementById('new-file-modal');
                    const fileNameInput = document.getElementById('new-file-name');
                    const modalTitle = modal.querySelector('h3');
                    const modalDescription = modal.querySelector('p');
                    const confirmButton = document.getElementById('confirm-new-file');
                    
                    if (modal && fileNameInput) {
                        // 修改模态框标题和描述以适配导入场景
                        if (modalTitle) modalTitle.textContent = '导入文件';
                        if (modalDescription) modalDescription.textContent = '请输入新的任务文件名（必须以"todo"开头并以.txt结尾）';
                        if (confirmButton) confirmButton.textContent = '导入';
                        
                        // 设置默认值
                        fileNameInput.value = 'todo_imported.txt';
                        
                        // 显示模态框
                        modal.classList.remove('hidden');
                        
                        // 自动聚焦输入框
                        fileNameInput.focus();
                        fileNameInput.select();
                    }
                    return;
                }
            } catch (error) {
                console.error('导入文件内容失败:', error);
                alert('导入文件内容失败: ' + error.message);
            }
        };
        
        reader.onerror = () => {
            alert('读取文件失败');
        };
        
        reader.readAsText(file, 'utf-8');
        
        // 清空文件输入，以便下次可以选择同一个文件
        event.target.value = '';
    } catch (error) {
        console.error('导入文件失败:', error);
        alert('文件导入失败: ' + error.message);
    }
}



// 关闭任务模态框
function closeTaskModal() {
    document.getElementById('task-modal')?.classList.add('hidden');
}

// 处理文件选择变化
async function handleTodoFileChange() {
    const fileDropdown = document.getElementById('todo-file-select');
    const loadedTasks = await loadTasksFromFile(fileDropdown.value);
    tasks = loadedTasks;
    // 使用筛选后的任务数据渲染日历
    const filteredTasks = filterTasks(tasks);
    await renderCalendar(currentDate, filteredTasks);
    renderTaskList(tasks);
    // 切换文件后更新显示
    updateCurrentTodoFileDisplay();
}

// 处理加载文件点击事件
async function handleLoadFileClick() {
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
}

// 处理下一个月点击事件
function handleNextMonthClick() {
    // 创建新的Date对象而不是修改原对象，避免引用问题
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    // 使用筛选后的任务数据渲染日历
    const filteredTasks = filterTasks(tasks);
    renderCalendar(currentDate, filteredTasks);
}

// 处理上一个月点击事件
function handlePrevMonthClick() {
    // 创建新的Date对象而不是修改原对象，避免引用问题
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    // 使用筛选后的任务数据渲染日历
    const filteredTasks = filterTasks(tasks);
    renderCalendar(currentDate, filteredTasks);
}

// 处理返回今天点击事件
async function handleTodayClick() {
    currentDate = new Date();
    await renderCalendar(currentDate, tasks); // 确保日历显示正确更新到今天
    performFiltering(); // 使用performFiltering确保应用筛选条件
}

// 处理关闭模态框背景点击事件
function handleShutdownModalClick(e) {
    if (e.target === e.currentTarget) {
        hideShutdownModal();
    }
}

// 处理确认关闭服务器点击事件
function handleConfirmShutdownClick() {
    hideShutdownModal();
    performServerShutdown();
}

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
        // 使用Promise.race实现超时控制，因为fetch API不直接支持timeout参数
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('请求超时')), 1000)
        );
        
        // 尝试发送一个简单的请求来检查服务是否可用
        const fetchPromise = fetch('/api/check-status', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (response.ok) {
            const responseData = await response.json();
            // 检查服务端返回的数据格式
            // 兼容两种格式：{data, timestamp} 和 {success, message}
            if (responseData.data) {
                // 标准格式
                return responseData.data.status === 'running';
            } else if (responseData.success) {
                // 简化格式
                return true;
            }
        }
        return false;
    } catch (error) {
        // 如果请求失败，说明服务可能未运行
        console.log('服务状态检查失败:', error.message);
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
            const responseData = await response.json();
            // 只处理服务端返回的固定{data, timestamp}格式
            if (responseData.data && responseData.data.success) {
                // 服务器确认关闭成功
                setTimeout(() => {
                    showNotification('服务已成功关闭。', 3000);
                    updateServerControlButton(false);
                }, 1000);
            } else {
                // 关闭失败
                showNotification('关闭服务失败，请稍后再试。', 3000);
            }
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
        
        // 绑定所有事件监听器，无论服务器是否运行
        addEventListeners();
        
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