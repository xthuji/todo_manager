/**
 * 任务解析与保存模块
 * 针对页面：任务列表视图页面、任务编辑模态框
 * 业务功能模块：
 * 1. 解析todo.txt格式文本为任务对象数组
 * 2. 将任务对象数组转换为todo.txt格式文本
 * 3. 从服务器文件加载任务数据
 * 4. 保存任务数据到服务器文件
 * 5. 计算任务显示状态（逾期、即将到期等）
 * 6. 提供日期生成与格式化工具函数
 * 使用场景：
 * - 初始化任务列表时加载并解析任务数据
 * - 任务保存时将内存中的任务对象转换为文本格式
 * - 任务状态更新时重新计算显示状态
 * - 支持模拟数据，用于测试和开发环境
 * 负责将任务文件解析为任务列表对象，以及将任务列表对象保存回文件
 */

import { buildApiUrl } from "../../config/api.js";

// 生成当前日期和未来几天的日期
const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);
const dayAfterTomorrow = new Date(today);
dayAfterTomorrow.setDate(today.getDate() + 2);
const yesterday = new Date(today);
yesterday.setDate(today.getDate() - 1);
const lastWeek = new Date(today);
lastWeek.setDate(today.getDate() - 7);
const nextWeek = new Date(today);
nextWeek.setDate(today.getDate() + 7);
const nextMonth = new Date(today);
nextMonth.setDate(today.getDate() + 30);

// 格式化日期为YYYY-MM-DD
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

// 为了测试和开发，始终提供有效的模拟数据作为备选方案
const mockTaskSwitch = false;
const mockTasks = [
    { id: 1, title: '重要紧急任务', priority: 'A', status: 'pending', dueDate: formatDate(tomorrow), startDate: formatDate(today), project: '项目1', context: 'doing', note: '' },
    { id: 2, title: '重要不紧急任务', priority: 'B', status: 'pending', dueDate: formatDate(dayAfterTomorrow), startDate: null, project: '项目2', context: 'planning', note: '' },
    { id: 3, title: '已完成的任务', priority: 'A', status: 'completed', dueDate: formatDate(yesterday), startDate: null, project: '项目1', context: 'done', note: '' },
    { id: 4, title: '今天的任务', priority: 'C', status: 'pending', dueDate: formatDate(today), startDate: formatDate(yesterday), project: '个人', context: 'today', note: '今天需要完成的任务' },
    { id: 5, title: '上周的任务', priority: 'C', status: 'pending', dueDate: formatDate(lastWeek), startDate: null, project: '个人', context: 'today', note: '需要回顾的任务' },
    { id: 6, title: '上周的任务2', priority: 'C', status: 'inprogress', dueDate: formatDate(lastWeek), startDate: null, project: '个人', context: 'today', note: '需要回顾的任务' },
    { id: 7, title: '下周的任务', priority: 'C', status: 'pending', dueDate: formatDate(nextWeek), startDate: null, project: '个人', context: 'planning', note: '需要回顾的任务' },
    { id: 8, title: '下月的任务', priority: 'C', status: 'pending', dueDate: formatDate(nextMonth), startDate: formatDate(nextMonth), project: '个人', context: 'planning', note: '需要回顾的任务' },
    { id: 9, title: '本月测试的任务', priority: 'C', status: 'pending', dueDate: formatDate(nextMonth), startDate: formatDate(yesterday), project: '个人', context: 'planning', note: '需要回顾的任务' }
];


export function calculateTaskDisplayStatus(task) {
    
    // 1. 已完成任务优先级最高
    if (task.status === 'completed') {
        return 'completed';
    }
    
    // 2. 检查是否有截止日期
    if (!task.dueDate) {
        // 无截止日期任务，根据状态返回
        return task.status === 'inprogress' ? 'inprogress' : 'pending';
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 增强：更全面地处理各种日期格式
    let dueDateStr = task.dueDate;
    // 尝试将相对日期转换为绝对日期
    if (typeof dueDateStr === 'string') {
        const lowerDueDate = dueDateStr.toLowerCase();
        // 处理 'yesterday' 相对日期
        if (lowerDueDate === 'yesterday') {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            dueDateStr = yesterday.toISOString().split('T')[0];
        }
        // 处理 'today' 相对日期
        else if (lowerDueDate === 'today') {
            dueDateStr = today.toISOString().split('T')[0];
        }
        // 处理 'tomorrow' 相对日期
        else if (lowerDueDate === 'tomorrow') {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            dueDateStr = tomorrow.toISOString().split('T')[0];
        }
        // 处理其他可能的相对日期格式或不正确的格式
        else if (!dueDateStr.match(/\d{4}-\d{2}-\d{2}/)) {
            // 尝试直接用Date构造函数解析
            const tempDate = new Date(dueDateStr);
            if (!isNaN(tempDate.getTime())) {
                dueDateStr = tempDate.toISOString().split('T')[0];
            } else {
                console.error('无法解析日期:', dueDateStr, '默认使用今天');
                dueDateStr = today.toISOString().split('T')[0];
            }
        }
    }
    
    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);
    
    // 计算日期差异
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // 3. 逾期任务判断 - 增强逻辑
    // 截止日期在今天之前，或今天到期且任务未开始，或任务处于未开始状态且当前日期大于开始时间
    // 处理开始日期逻辑
    let hasStartedAndOverdue = false;
    if (task.startDate && task.status === 'pending') {
        let startDateStr = task.startDate;
        // 处理相对日期
        if (typeof startDateStr === 'string') {
            const lowerStartDate = startDateStr.toLowerCase();
            if (lowerStartDate === 'yesterday') {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                startDateStr = yesterday.toISOString().split('T')[0];
            } else if (lowerStartDate === 'today') {
                startDateStr = today.toISOString().split('T')[0];
            } else if (lowerStartDate === 'tomorrow') {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                startDateStr = tomorrow.toISOString().split('T')[0];
            } else if (!startDateStr.match(/\d{4}-\d{2}-\d{2}/)) {
                const tempDate = new Date(startDateStr);
                if (!isNaN(tempDate.getTime())) {
                    startDateStr = tempDate.toISOString().split('T')[0];
                }
            }
        }
        const startDate = new Date(startDateStr);
        startDate.setHours(0, 0, 0, 0);
        hasStartedAndOverdue = today > startDate;
    }
    
    if (due < today || (due.getTime() === today.getTime() && task.status === 'pending') || hasStartedAndOverdue) {
        return task.status === 'pending' ? 'overdue_pending' : 'overdue_inprogress';
    }
    // 4. 即将到期任务：当距离结束时间小于等于2天且任务处于进行中
    else if (diffDays <= 2 && task.status === 'inprogress') {
        return 'upcoming';
    }
    // 5. 正常时间范围内任务
    else {
        // 进行中 > 未开始
        return task.status === 'inprogress' ? 'inprogress' : 'pending';
    }
}

/**
 * 为任务列表中的每个任务计算并添加显示状态
 * @param {Array} tasks - 任务对象数组
 * @returns {Array} 添加了显示状态的任务数组
 */
export function addDisplayStatusToTasks(tasks) {
    return tasks.map(task => {
        return {
            ...task,
            displayStatus: calculateTaskDisplayStatus(task)
        };
    });
}

/**
 * 解析todo.txt格式的文本内容，符合sleek标准格式
 * @param {string} content - todo.txt文件内容
 * @returns {Array} 解析后的任务对象数组
 */
export function parseTodoTxtFormat(content) {
    if (!content) {
        console.log('没有文本内容，返回空数组');
        return [];
    }
    
    const lines = content.split('\n');
    const tasks = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        if (!trimmedLine) {
            continue; // 跳过空行
        }
        
        // 创建任务对象，确保与todo_manager.js期望的结构完全匹配
        const task = {
            id: i + 1, // 使用行号作为ID（从1开始）
            priority: 'none', // 默认优先级为'none'
            status: 'pending', // 默认状态为'pending'
            dueDate: null,
            startDate: null,
            project: null, // 单个项目
            context: null, // 单个上下文
            title: '',
            note: '',
            raw: trimmedLine
        };
        
        // 检查是否已完成或进行中
        if (trimmedLine.startsWith('x ')) {
            task.status = 'completed'; // 将isCompleted转换为status
            const remainingText = trimmedLine.substring(2).trim();
            
            // 提取完成日期（如果有）
            const dateMatch = remainingText.match(/^\d{4}-\d{2}-\d{2}\s+/);
            if (dateMatch) {
                // 注意：这里的完成日期在todo_manager.js中可能不需要，但我们保留原始信息
                task.completionDate = dateMatch[0].trim();
                task.textForParsing = remainingText.substring(dateMatch[0].length).trim();
            } else {
                task.textForParsing = remainingText;
            }
        } else if (trimmedLine.startsWith('started ')) {
            task.status = 'inprogress'; // 标记为进行中
            task.textForParsing = trimmedLine.substring(8).trim(); // 跳过"started "
        } else {
            task.textForParsing = trimmedLine;
        }
        
        // 提取优先级
        const priorityMatch = task.textForParsing.match(/^\(([A-Z])\)\s+/);
        if (priorityMatch) {
            task.priority = priorityMatch[1];
            task.textForParsing = task.textForParsing.substring(priorityMatch[0].length).trim();
        }
        
        // 提取截止日期
        const dueDateMatch = task.textForParsing.match(/due:(\d{4}-\d{2}-\d{2})/);
        if (dueDateMatch) {
            task.dueDate = dueDateMatch[1];
            task.textForParsing = task.textForParsing.replace(/due:\d{4}-\d{2}-\d{2}\s*/, '').trim();
        }
        
        // 提取开始日期
        const startDateMatch = task.textForParsing.match(/start:(\d{4}-\d{2}-\d{2})/);
        if (startDateMatch) {
            task.startDate = startDateMatch[1];
            task.textForParsing = task.textForParsing.replace(/start:\d{4}-\d{2}-\d{2}\s*/, '').trim();
        }
        
        // 提取项目标签 - 只取第一个项目作为主项目
        const projectMatches = task.textForParsing.match(/\+([\w\u4e00-\u9fa5]+)/);
        if (projectMatches) {
            task.project = projectMatches[1]; // 只取第一个项目
        }
        
        // 提取上下文标签 - 只取第一个上下文
        const contextMatches = task.textForParsing.match(/@([\w\u4e00-\u9fa5]+)/);
        if (contextMatches) {
            task.context = contextMatches[1]; // 只取第一个上下文
        }
        
        // 提取任务标题（移除标签和日期后的剩余部分）
        let title = task.textForParsing.replace(/\+[\w\u4e00-\u9fa5]+\s*/g, '').replace(/@[\w\u4e00-\u9fa5]+\s*/g, '').trim();
        
        // 处理标题中的特殊字符
        // 移除可能的引号包围
        if (title.startsWith('"') && title.endsWith('"')) {
            title = title.substring(1, title.length - 1);
        }
        
        // 处理可能的反斜杠转义字符
        title = title.replace(/\\(["\\])/g, '$1'); // 将" 和\ 转换为" 和\
        
        // 确保标题不为空
        task.title = title || '[无标题任务]';
        
        // note暂时留空，因为原格式中没有明确的note字段
        task.note = '';
        
        tasks.push(task);
    }
    
    return addDisplayStatusToTasks(tasks);
}

/**
 * 将任务对象数组转换为todo.txt格式的文本
 * @param {Array} tasks - 任务对象数组
 * @returns {string} todo.txt格式的文本内容
 */
export function convertTasksToTodoTxtFormat(tasks) {
    let content = '';
    
    // 检查 tasks 是否为 undefined 或 null
    if (!tasks || tasks.length === 0) {
        return content;
    }
    
    tasks.forEach(task => {
        let line = '';
        
        // 添加完成状态
        if (task.status === 'completed') {
            line += 'x ';
        }
        // 添加进行中状态
        else if (task.status === 'inprogress') {
            line += 'started ';
        }
        
        // 添加优先级
        if (task.priority !== 'none') {
            line += `(${task.priority}) `;
        }
        
        // 添加截止日期（如果有）
        if (task.dueDate) {
            line += `due:${task.dueDate} `;
        }
        
        // 添加任务标题
        line += task.title;
        
        // 添加开始日期（如果有）
        if (task.startDate) {
            line += ` start:${task.startDate}`;
        }
        
        // 添加项目标签（如果有）
        if (task.project) {
            line += ` +${task.project}`;
        }
        
        // 添加上下文标签（如果有）
        if (task.context) {
            line += ` @${task.context}`;
        }
        
        content += line.trim() + '\n';
    });
    
    return content.trim();
}

/**
 * 从服务器文件加载任务
 * @param {string} filename - 文件名
 * @returns {Promise<Array>} 解析后的任务数组
 */
export async function loadTasksFromFile(filename = 'todo.txt') {
    try {
        // 确保filename存在
        if (!filename) {
            console.error('文件名不能为空');
            return [];
        }
        
        if (mockTaskSwitch) {
            console.log('任务数量来源: 硬编码的模拟数据');
            return mockTasks;
        }

        const url = buildApiUrl(`/api/file/read/${encodeURIComponent(filename)}`);
        
        try {
            // 首先尝试从服务器加载
            const response = await fetch(url);
            
            // 记录响应状态
            if (!response.ok) {
                console.error(`服务器返回错误状态码: ${response.status}`);
                return [];
            }
            
            console.log('任务数量来源: 服务器加载文件数据');
            try {
                // 尝试解析JSON
                const responseData = await response.json();
                // 只处理服务端返回的固定{data, timestamp}格式
                if (responseData.data) {
                    try {
                        // 尝试解析为JSON
                        const jsonTasks = JSON.parse(responseData.data.content);
                        return addDisplayStatusToTasks(jsonTasks);
                    } catch (e) {
                        // 解析为todo.txt格式（符合sleek标准）
                        const parsedTasks = parseTodoTxtFormat(responseData.data.content);
                        return parsedTasks;
                    }
                } else {
                    console.warn('服务器返回的数据格式不正确或内容为空');
                    return [];
                }
            } catch (jsonError) {
                // JSON解析失败，可能是文件内容不是JSON格式
                console.error('JSON解析失败:', jsonError);
                return [];
            }
        } catch (serverError) {
            console.error(`加载文件${filename}失败，服务器连接问题:`, serverError);
            return [];
        }
    } catch (error) {
        console.error(`加载文件${filename}过程中发生未知错误:`, error);
        return [];
    }
}

/**
 * 保存任务到服务器文件
 * @param {Array} tasks - 任务对象数组
 * @param {string} filename - 文件名
 * @returns {Promise<boolean>} 是否保存成功
 */
export async function saveTasksToFile(tasks, filename = 'todo.txt') {
    try {
        if (mockTaskSwitch) {
            console.log('硬编码的模拟数据保存');
            return true;
        }
        
        // 转换为todo.txt格式
        const content = convertTasksToTodoTxtFormat(tasks);
        
        // 发送到服务器保存
        const response = await fetch(buildApiUrl(`/api/file/write/${encodeURIComponent(filename)}`), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content })
        });
        
        if (response.ok) {
            const responseData = await response.json();
            // 只处理服务端返回的固定{data, timestamp}格式
            return responseData.data && responseData.data.success;
        }
        throw new Error('保存失败，服务器返回非成功状态');
    } catch (error) {
        console.error('保存任务失败:', error);
        alert('保存任务文件失败: ' + error.message);
        return false;
    }
}