package tests

import (
	"fmt"
	"testing"
	"time"

	"todolist-go/app/utils"
)

// MockTask 模拟任务数据
type MockTask struct {
	ID            int     `json:"id"`
	Title         string  `json:"title"`
	Priority      string  `json:"priority"`
	Status        string  `json:"status"`
	DueDate       *string `json:"dueDate"`
	Project       string  `json:"project"`
	Context       string  `json:"context"`
	DisplayStatus string  `json:"displayStatus"`
}

// TodoManager 模拟任务管理模块
type TodoManager struct {
	Tasks       []MockTask
	CurrentDate time.Time
}

// NewTodoManager 创建任务管理器实例
func NewTodoManager() *TodoManager {
	return &TodoManager{
		Tasks:       []MockTask{},
		CurrentDate: time.Now(),
	}
}

// Init 初始化模拟数据
func (tm *TodoManager) Init() {
	dueDate1 := "2024-01-15"
	dueDate3 := "2024-01-01" // 元旦
	var dueDate2 *string // nil

	tm.Tasks = []MockTask{
		{
			ID:       1,
			Title:    "测试任务1",
			Priority: "high",
			Status:   "pending",
			DueDate:  &dueDate1,
			Project:  "project1",
			Context:  "home",
		},
		{
			ID:       2,
			Title:    "测试任务2",
			Priority: "medium",
			Status:   "completed",
			DueDate:  dueDate2,
			Project:  "project2",
			Context:  "work",
		},
		{
			ID:       3,
			Title:    "节假日任务",
			Priority: "high",
			Status:   "pending",
			DueDate:  &dueDate3,
			Project:  "project1",
			Context:  "home",
		},
	}
}

// AddTask 添加任务
func (tm *TodoManager) AddTask(taskData MockTask) MockTask {
	newTask := MockTask{
		ID:            len(tm.Tasks) + 1,
		Title:         taskData.Title,
		Priority:      taskData.Priority,
		Status:        taskData.Status,
		DueDate:       taskData.DueDate,
		Project:       taskData.Project,
		Context:       taskData.Context,
		DisplayStatus: "normal",
	}
	tm.Tasks = append(tm.Tasks, newTask)
	return newTask
}

// UpdateTask 更新任务
func (tm *TodoManager) UpdateTask(taskID int, updates map[string]interface{}) (*MockTask, error) {
	taskIndex := -1
	for i, task := range tm.Tasks {
		if task.ID == taskID {
			taskIndex = i
			break
		}
	}

	if taskIndex == -1 {
		utils.LoggerInstance.Error("任务不存在")
		return nil, fmt.Errorf("任务不存在")
	}

	// 更新任务字段
	if title, ok := updates["title"].(string); ok {
		tm.Tasks[taskIndex].Title = title
	}
	if status, ok := updates["status"].(string); ok {
		tm.Tasks[taskIndex].Status = status
	}

	return &tm.Tasks[taskIndex], nil
}

// DeleteTask 删除任务
func (tm *TodoManager) DeleteTask(taskID int) bool {
	initialLength := len(tm.Tasks)
	filteredTasks := []MockTask{}
	for _, task := range tm.Tasks {
		if task.ID != taskID {
			filteredTasks = append(filteredTasks, task)
		}
	}
	tm.Tasks = filteredTasks
	return len(tm.Tasks) < initialLength
}

// GoToDate 跳转到指定日期
func (tm *TodoManager) GoToDate(dateStr string) (time.Time, error) {
	parsedDate, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return time.Time{}, err
	}
	tm.CurrentDate = parsedDate
	return parsedDate, nil
}

// GetTasks 获取当前任务列表
func (tm *TodoManager) GetTasks() []MockTask {
	return tm.Tasks
}

// TestTodoManager 测试任务管理核心功能
func TestTodoManager(t *testing.T) {
	todoManager := NewTodoManager()

	t.Log("=== 开始任务管理核心功能测试 ===")

	// 测试1: 初始化功能
	t.Log("测试1: 初始化任务管理器")
	todoManager.Init()
	tasks := todoManager.GetTasks()
	if len(tasks) == 3 {
		t.Log("  ✅ 通过: 初始化成功，任务数量正确")
	} else {
		t.Errorf("初始化失败，期望3个任务，实际%d个", len(tasks))
	}

	// 测试2: 添加任务功能
	t.Log("\n测试2: 添加新任务")
	dueDate := "2024-01-20"
	newTask := todoManager.AddTask(MockTask{
		Title:    "新添加的测试任务",
		Priority: "low",
		Status:   "pending",
		DueDate:  &dueDate,
		Project:  "test",
		Context:  "test",
	})

	if newTask.ID > 0 && len(todoManager.GetTasks()) == 4 {
		t.Logf("  ✅ 通过: 成功添加新任务，ID: %d", newTask.ID)
	} else {
		t.Errorf("添加任务失败，期望4个任务，实际%d个", len(todoManager.GetTasks()))
	}

	// 测试3: 更新任务功能
	t.Log("\n测试3: 更新任务状态")
	updatedTask, err := todoManager.UpdateTask(1, map[string]interface{}{
		"status": "completed",
		"title":  "更新后的测试任务1",
	})

	if err == nil && updatedTask.Status == "completed" && updatedTask.Title == "更新后的测试任务1" {
		t.Log("  ✅ 通过: 成功更新任务状态和标题")
	} else {
		t.Errorf("更新任务失败: %v", err)
	}

	// 测试4: 删除任务功能
	t.Log("\n测试4: 删除任务")
	result := todoManager.DeleteTask(2)
	tasks = todoManager.GetTasks()

	if result && len(tasks) == 3 {
		t.Logf("  ✅ 通过: 成功删除任务，删除后任务数量: %d", len(tasks))
	} else {
		t.Error("删除任务失败")
	}

	// 测试5: 跳转到指定日期功能
	t.Log("\n测试5: 跳转到指定日期")
	targetDate := "2024-02-01"
	resultDate, err := todoManager.GoToDate(targetDate)

	if err == nil && resultDate.Format("2006-01-02") == targetDate {
		t.Logf("  ✅ 通过: 成功跳转到指定日期 %s", targetDate)
	} else {
		t.Errorf("跳转日期失败，期望%s，实际%s", targetDate, resultDate.Format("2006-01-02"))
	}

	// 测试6: 任务列表过滤测试（按状态）
	t.Log("\n测试6: 任务列表过滤（按状态）")
	tasks = todoManager.GetTasks()
	completedTasks := []MockTask{}
	for _, task := range tasks {
		if task.Status == "completed" {
			completedTasks = append(completedTasks, task)
		}
	}

	if len(completedTasks) == 1 {
		t.Logf("  ✅ 通过: 成功过滤出%d个已完成任务", len(completedTasks))
	} else {
		t.Errorf("过滤任务失败，期望1个已完成任务，实际%d个", len(completedTasks))
	}

	// 测试7: 任务列表过滤测试（按优先级）
	t.Log("\n测试7: 任务列表过滤（按优先级）")
	tasks = todoManager.GetTasks()
	highPriorityTasks := []MockTask{}
	for _, task := range tasks {
		if task.Priority == "high" {
			highPriorityTasks = append(highPriorityTasks, task)
		}
	}

	if len(highPriorityTasks) == 2 {
		t.Logf("  ✅ 通过: 成功过滤出%d个高优先级任务", len(highPriorityTasks))
	} else {
		t.Errorf("过滤任务失败，期望2个高优先级任务，实际%d个", len(highPriorityTasks))
	}

	t.Log("\n=== 任务管理核心功能测试完成 ===")
}
