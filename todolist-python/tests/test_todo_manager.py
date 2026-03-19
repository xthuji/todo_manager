import time
import datetime
from app.utils.logger_util import logger

# 模拟任务数据
mock_tasks = [
    {
        'id': 1,
        'title': '测试任务1',
        'priority': 'high',
        'status': 'pending',
        'dueDate': '2024-01-15',
        'project': 'project1',
        'context': 'home'
    },
    {
        'id': 2,
        'title': '测试任务2',
        'priority': 'medium',
        'status': 'completed',
        'dueDate': None,
        'project': 'project2',
        'context': 'work'
    }
]

# 模拟任务管理模块
class TodoManager:
    def __init__(self):
        self.tasks = []
        self.current_date = datetime.datetime.now()
    
    # 初始化模拟
    async def init(self):
        self.tasks = mock_tasks.copy()
        return True
    
    # 添加任务模拟
    async def add_task(self, task_data):
        new_task = {
            'id': len(self.tasks) + 1,
            **task_data,
            'displayStatus': 'normal'
        }
        self.tasks.append(new_task)
        return new_task
    
    # 更新任务模拟
    async def update_task(self, task_id, updates):
        task_index = next((i for i, t in enumerate(self.tasks) if t['id'] == task_id), -1)
        if task_index == -1:
            raise ValueError('任务不存在')
        self.tasks[task_index] = {**self.tasks[task_index], **updates}
        return self.tasks[task_index]
    
    # 删除任务模拟
    async def delete_task(self, task_id):
        initial_length = len(self.tasks)
        self.tasks = [t for t in self.tasks if t['id'] != task_id]
        return len(self.tasks) < initial_length
    
    # 跳转到指定日期
    def go_to_date(self, date_str):
        self.current_date = datetime.datetime.strptime(date_str, '%Y-%m-%d')
        return self.current_date
    
    # 获取当前任务列表
    def get_tasks(self):
        return self.tasks.copy()

# 创建实例
todo_manager = TodoManager()

# 测试函数
async def run_tests():
    passed_tests = 0
    total_tests = 0
    
    logger.info('=== 开始任务管理核心功能测试 ===')
    
    # 测试1: 初始化功能
    total_tests += 1
    try:
        logger.info('测试1: 初始化任务管理器')
        await todo_manager.init()
        tasks = todo_manager.get_tasks()
        if len(tasks) == len(mock_tasks):
            logger.info('  ✅ 通过: 初始化成功，任务数量正确')
            passed_tests += 1
        else:
            raise ValueError(f'初始化失败，期望{len(mock_tasks)}个任务，实际{len(tasks)}个')
    except Exception as e:
        logger.error(f'  ❌ 失败: {e}')
    
    # 测试2: 添加任务功能
    total_tests += 1
    try:
        logger.info('\n测试2: 添加新任务')
        new_task = await todo_manager.add_task({
            'title': '新添加的测试任务',
            'priority': 'low',
            'status': 'pending',
            'dueDate': '2024-01-20',
            'project': 'test',
            'context': 'test'
        })
        
        if new_task and new_task['id'] and len(todo_manager.get_tasks()) == 3:
            logger.info('  ✅ 通过: 成功添加新任务')
            logger.info(f'  ✅ 通过: 新任务ID: {new_task["id"]}')
            passed_tests += 1
        else:
            raise ValueError('添加任务失败')
    except Exception as e:
        logger.error(f'  ❌ 失败: {e}')
    
    # 测试3: 更新任务功能
    total_tests += 1
    try:
        logger.info('\n测试3: 更新任务状态')
        updated_task = await todo_manager.update_task(1, {
            'status': 'completed',
            'title': '更新后的测试任务1'
        })
        
        if updated_task['status'] == 'completed' and updated_task['title'] == '更新后的测试任务1':
            logger.info('  ✅ 通过: 成功更新任务状态和标题')
            passed_tests += 1
        else:
            raise ValueError('更新任务失败')
    except Exception as e:
        logger.error(f'  ❌ 失败: {e}')
    
    # 测试4: 删除任务功能
    total_tests += 1
    try:
        logger.info('\n测试4: 删除任务')
        result = await todo_manager.delete_task(2)
        tasks = todo_manager.get_tasks()
        
        if result and len(tasks) == 2:
            logger.info('  ✅ 通过: 成功删除任务')
            logger.info(f'  ✅ 通过: 删除后任务数量: {len(tasks)}')
            passed_tests += 1
        else:
            raise ValueError('删除任务失败')
    except Exception as e:
        logger.error(f'  ❌ 失败: {e}')
    
    # 测试5: 跳转到指定日期功能
    total_tests += 1
    try:
        logger.info('\n测试5: 跳转到指定日期')
        target_date = '2024-02-01'
        result_date = todo_manager.go_to_date(target_date)
        formatted_result = result_date.strftime('%Y-%m-%d')
        
        if formatted_result == target_date:
            logger.info(f'  ✅ 通过: 成功跳转到指定日期 {target_date}')
            passed_tests += 1
        else:
            raise ValueError(f'跳转日期失败，期望{target_date}，实际{formatted_result}')
    except Exception as e:
        logger.error(f'  ❌ 失败: {e}')
    
    # 测试6: 任务列表过滤测试（按状态）
    total_tests += 1
    try:
        logger.info('\n测试6: 任务列表过滤（按状态）')
        tasks = todo_manager.get_tasks()
        completed_tasks = [t for t in tasks if t['status'] == 'completed']
        
        if len(completed_tasks) == 1:
            logger.info(f'  ✅ 通过: 成功过滤出{len(completed_tasks)}个已完成任务')
            passed_tests += 1
        else:
            raise ValueError(f'过滤任务失败，期望1个已完成任务，实际{len(completed_tasks)}个')
    except Exception as e:
        logger.error(f'  ❌ 失败: {e}')
    
    # 测试7: 任务列表过滤测试（按优先级）
    total_tests += 1
    try:
        logger.info('\n测试7: 任务列表过滤（按优先级）')
        tasks = todo_manager.get_tasks()
        high_priority_tasks = [t for t in tasks if t['priority'] == 'high']
        
        if len(high_priority_tasks) == 1:
            logger.info(f'  ✅ 通过: 成功过滤出{len(high_priority_tasks)}个高优先级任务')
            passed_tests += 1
        else:
            raise ValueError(f'过滤任务失败，期望1个高优先级任务，实际{len(high_priority_tasks)}个')
    except Exception as e:
        logger.error(f'  ❌ 失败: {e}')
    
    # 输出测试结果
    logger.info('\n=== 测试结果汇总 ===')
    logger.info(f'通过测试: {passed_tests}/{total_tests}')
    
    if passed_tests == total_tests:
        logger.info('🎉 所有任务管理核心功能测试通过!')
        return True
    else:
        logger.error('❌ 测试未全部通过，请检查错误信息。')
        return False

# 运行测试
if __name__ == '__main__':
    import asyncio
    success = asyncio.run(run_tests())
    exit(0 if success else 1)
