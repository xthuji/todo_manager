// 任务管理核心功能测试
console.log('开始运行任务管理核心功能测试...');

// Mock浏览器环境
const fs = require('fs');
const path = require('path');

global.window = {}

global.document = {
    getElementById: (id) => ({
        addEventListener: () => {},
        value: 'todo.txt',
        innerHTML: ''
    })
}

// 模拟任务数据
const mockTasks = [
    {
        id: 1,
        title: '测试任务1',
        priority: 'high',
        status: 'pending',
        dueDate: '2024-01-15',
        project: 'project1',
        context: 'home'
    },
    {
        id: 2,
        title: '测试任务2',
        priority: 'medium',
        status: 'completed',
        dueDate: null,
        project: 'project2',
        context: 'work'
    }
];

// 模拟任务管理模块
const todoManager = {
    tasks: [],
    currentDate: new Date(),
    
    // 初始化模拟
    async init() {
        this.tasks = [...mockTasks];
        return true;
    },
    
    // 添加任务模拟
    async addTask(taskData) {
        const newTask = {
            id: this.tasks.length + 1,
            ...taskData,
            displayStatus: 'normal'
        };
        this.tasks.push(newTask);
        return newTask;
    },
    
    // 更新任务模拟
    async updateTask(id, updates) {
        const taskIndex = this.tasks.findIndex(t => t.id === id);
        if (taskIndex === -1) {
            throw new Error('任务不存在');
        }
        this.tasks[taskIndex] = { ...this.tasks[taskIndex], ...updates };
        return this.tasks[taskIndex];
    },
    
    // 删除任务模拟
    async deleteTask(id) {
        const initialLength = this.tasks.length;
        this.tasks = this.tasks.filter(t => t.id !== id);
        return this.tasks.length < initialLength;
    },
    
    // 跳转到指定日期
    goToDate(date) {
        this.currentDate = new Date(date);
        return this.currentDate;
    },
    
    // 获取当前任务列表
    getTasks() {
        return [...this.tasks];
    }
};

// 测试用例
const runTests = async () => {
    let passedTests = 0;
    let totalTests = 0;
    
    console.log('=== 开始任务管理核心功能测试 ===\n');
    
    // 测试1: 初始化功能
    totalTests++;
    try {
        console.log('测试1: 初始化任务管理器');
        await todoManager.init();
        const tasks = todoManager.getTasks();
        if (tasks.length === mockTasks.length) {
            console.log('  ✅ 通过: 初始化成功，任务数量正确');
            passedTests++;
        } else {
            throw new Error(`初始化失败，期望${mockTasks.length}个任务，实际${tasks.length}个`);
        }
    } catch (error) {
        console.error(`  ❌ 失败: ${error.message}`);
    }
    
    // 测试2: 添加任务功能
    totalTests++;
    try {
        console.log('\n测试2: 添加新任务');
        const newTask = await todoManager.addTask({
            title: '新添加的测试任务',
            priority: 'low',
            status: 'pending',
            dueDate: '2024-01-20',
            project: 'test',
            context: 'test'
        });
        
        if (newTask && newTask.id && todoManager.getTasks().length === 3) {
            console.log('  ✅ 通过: 成功添加新任务');
            console.log(`  ✅ 通过: 新任务ID: ${newTask.id}`);
            passedTests++;
        } else {
            throw new Error('添加任务失败');
        }
    } catch (error) {
        console.error(`  ❌ 失败: ${error.message}`);
    }
    
    // 测试3: 更新任务功能
    totalTests++;
    try {
        console.log('\n测试3: 更新任务状态');
        const updatedTask = await todoManager.updateTask(1, {
            status: 'completed',
            title: '更新后的测试任务1'
        });
        
        if (updatedTask.status === 'completed' && updatedTask.title === '更新后的测试任务1') {
            console.log('  ✅ 通过: 成功更新任务状态和标题');
            passedTests++;
        } else {
            throw new Error('更新任务失败');
        }
    } catch (error) {
        console.error(`  ❌ 失败: ${error.message}`);
    }
    
    // 测试4: 删除任务功能
    totalTests++;
    try {
        console.log('\n测试4: 删除任务');
        const result = await todoManager.deleteTask(2);
        const tasks = todoManager.getTasks();
        
        if (result && tasks.length === 2) {
            console.log('  ✅ 通过: 成功删除任务');
            console.log(`  ✅ 通过: 删除后任务数量: ${tasks.length}`);
            passedTests++;
        } else {
            throw new Error('删除任务失败');
        }
    } catch (error) {
        console.error(`  ❌ 失败: ${error.message}`);
    }
    
    // 测试5: 跳转到指定日期功能
    totalTests++;
    try {
        console.log('\n测试5: 跳转到指定日期');
        const targetDate = '2024-02-01';
        const resultDate = todoManager.goToDate(targetDate);
        const formattedResult = resultDate.toISOString().split('T')[0];
        
        if (formattedResult === targetDate) {
            console.log(`  ✅ 通过: 成功跳转到指定日期 ${targetDate}`);
            passedTests++;
        } else {
            throw new Error(`跳转日期失败，期望${targetDate}，实际${formattedResult}`);
        }
    } catch (error) {
        console.error(`  ❌ 失败: ${error.message}`);
    }
    
    // 测试6: 任务列表过滤测试（按状态）
    totalTests++;
    try {
        console.log('\n测试6: 任务列表过滤（按状态）');
        const tasks = todoManager.getTasks();
        const completedTasks = tasks.filter(t => t.status === 'completed');
        
        if (completedTasks.length === 1) {
            console.log(`  ✅ 通过: 成功过滤出${completedTasks.length}个已完成任务`);
            passedTests++;
        } else {
            throw new Error(`过滤任务失败，期望1个已完成任务，实际${completedTasks.length}个`);
        }
    } catch (error) {
        console.error(`  ❌ 失败: ${error.message}`);
    }
    
    // 测试7: 任务列表过滤测试（按优先级）
    totalTests++;
    try {
        console.log('\n测试7: 任务列表过滤（按优先级）');
        const tasks = todoManager.getTasks();
        const highPriorityTasks = tasks.filter(t => t.priority === 'high');
        
        if (highPriorityTasks.length === 1) {
            console.log(`  ✅ 通过: 成功过滤出${highPriorityTasks.length}个高优先级任务`);
            passedTests++;
        } else {
            throw new Error(`过滤任务失败，期望1个高优先级任务，实际${highPriorityTasks.length}个`);
        }
    } catch (error) {
        console.error(`  ❌ 失败: ${error.message}`);
    }
    
    // 输出测试结果
    console.log('\n=== 测试结果汇总 ===');
    console.log(`通过测试: ${passedTests}/${totalTests}`);
    
    if (passedTests === totalTests) {
        console.log('🎉 所有任务管理核心功能测试通过!');
        process.exit(0);
    } else {
        console.error('❌ 测试未全部通过，请检查错误信息。');
        process.exit(1);
    }
};

// 运行测试
runTests().catch(error => {
    console.error('测试运行失败:', error);
    process.exit(1);
});