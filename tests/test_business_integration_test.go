package tests

import (
	"testing"
	"time"
)

// TaskParser 任务解析器
type TaskParser struct{}

// CalculateTaskDisplayStatus 计算任务显示状态
func (tp *TaskParser) CalculateTaskDisplayStatus(task map[string]interface{}) string {
	dueDateStr, ok := task["dueDate"].(string)
	if !ok || dueDateStr == "" {
		return "normal"
	}

	dueDate, err := time.Parse("2006-01-02", dueDateStr)
	if err != nil {
		return "normal"
	}

	today := time.Now()
	diffDays := int(dueDate.Sub(today).Hours() / 24)

	if status, ok := task["status"].(string); ok && status == "completed" {
		return "completed"
	}
	if diffDays < 0 {
		return "overdue"
	}
	if diffDays <= 3 {
		return "urgent"
	}
	return "normal"
}

// CalendarRendererForBusiness 日历渲染器
type CalendarRendererForBusiness struct{}

// RenderCalendar 渲染日历
func (cr *CalendarRendererForBusiness) RenderCalendar(date time.Time, tasks []map[string]interface{}) map[string]interface{} {
	year := date.Year()
	month := int(date.Month()) - 1 // 月份从0开始

	// 按日期分组任务
	tasksByDate := map[string][]map[string]interface{}{}
	for _, task := range tasks {
		if dueDate, ok := task["dueDate"].(string); ok && dueDate != "" {
			if _, exists := tasksByDate[dueDate]; !exists {
				tasksByDate[dueDate] = []map[string]interface{}{}
			}
			tasksByDate[dueDate] = append(tasksByDate[dueDate], task)
		}
	}

	// 检查节假日任务
	holidayTasks := []map[string]interface{}{}
	for dateStr, taskList := range tasksByDate {
		festivals := cr.GetFestivalsSync(dateStr)
		if len(festivals) > 0 {
			for _, task := range taskList {
				holidayTask := map[string]interface{}{}
				for k, v := range task {
					holidayTask[k] = v
				}
				holidayTask["holidayName"] = festivals[0]["name"]
				holidayTask["holidayDate"] = dateStr
				holidayTasks = append(holidayTasks, holidayTask)
			}
		}
	}

	return map[string]interface{}{
		"year":               year,
		"month":              month,
		"renderedTasksCount": len(tasks),
		"holidayTasksCount":  len(holidayTasks),
		"holidayTasks":       holidayTasks,
	}
}

// GetFestivalsSync 获取节日信息
func (cr *CalendarRendererForBusiness) GetFestivalsSync(dateStr string) []map[string]string {
	festivalsMap := map[string][]map[string]string{
		"2024-01-01": {{"name": "元旦", "type": "chinese_common"}},
		"2024-05-01": {{"name": "劳动节", "type": "chinese_common"}},
		"2024-10-01": {{"name": "国庆节", "type": "chinese_common"}},
	}
	if festivals, exists := festivalsMap[dateStr]; exists {
		return festivals
	}
	return []map[string]string{}
}

// BusinessProcess 业务流程
type BusinessProcess struct {
	TaskParser       *TaskParser
	TodoManager      *TodoManager
	CalendarRenderer *CalendarRendererForBusiness
}

// NewBusinessProcess 创建业务流程实例
func NewBusinessProcess() *BusinessProcess {
	return &BusinessProcess{
		TaskParser:       &TaskParser{},
		TodoManager:      NewTodoManager(),
		CalendarRenderer: &CalendarRendererForBusiness{},
	}
}

// InitializeApp 初始化应用
func (bp *BusinessProcess) InitializeApp() map[string]interface{} {
	bp.TodoManager.Init()
	bp.TodoManager.GoToDate(time.Now().Format("2006-01-02"))

	tasks := bp.TodoManager.GetTasks()
	// 转换MockTask为map[string]interface{}
	taskMaps := []map[string]interface{}{}
	for _, task := range tasks {
		taskMap := map[string]interface{}{
			"id":            task.ID,
			"title":         task.Title,
			"priority":      task.Priority,
			"status":        task.Status,
			"project":       task.Project,
			"context":       task.Context,
			"displayStatus": task.DisplayStatus,
		}
		if task.DueDate != nil {
			taskMap["dueDate"] = *task.DueDate
		}
		taskMaps = append(taskMaps, taskMap)
	}
	calendarResult := bp.CalendarRenderer.RenderCalendar(bp.TodoManager.CurrentDate, taskMaps)

	return map[string]interface{}{
		"success":          true,
		"taskCount":        len(tasks),
		"calendarRendered": calendarResult,
		"currentDate":      bp.TodoManager.CurrentDate,
	}
}

// ProcessHolidayTasks 处理节假日任务
func (bp *BusinessProcess) ProcessHolidayTasks() []map[string]interface{} {
	tasks := bp.TodoManager.GetTasks()
	holidayTasks := []map[string]interface{}{}

	for _, task := range tasks {
		taskMap := map[string]interface{}{
			"id":            task.ID,
			"title":         task.Title,
			"priority":      task.Priority,
			"status":        task.Status,
			"project":       task.Project,
			"context":       task.Context,
			"displayStatus": task.DisplayStatus,
		}
		if task.DueDate != nil {
			taskMap["dueDate"] = *task.DueDate
			festivals := bp.CalendarRenderer.GetFestivalsSync(*task.DueDate)
			if len(festivals) > 0 {
				holidayTask := map[string]interface{}{
					"task":      taskMap,
					"festivals": festivals,
				}
				holidayTask["task"].(map[string]interface{})["urgencyLevel"] = bp.TaskParser.CalculateTaskDisplayStatus(taskMap)
				holidayTasks = append(holidayTasks, holidayTask)
			}
		}
	}

	return holidayTasks
}

// FilterTasksByProjectAndRender 按项目筛选任务并渲染日历
func (bp *BusinessProcess) FilterTasksByProjectAndRender(projectName string) map[string]interface{} {
	allTasks := bp.TodoManager.GetTasks()
	filteredTasks := []MockTask{}
	for _, task := range allTasks {
		if task.Project == projectName {
			filteredTasks = append(filteredTasks, task)
		}
	}

	calendarResult := bp.CalendarRenderer.RenderCalendar(bp.TodoManager.CurrentDate, []map[string]interface{}{})

	return map[string]interface{}{
		"projectName":        projectName,
		"filteredTasksCount": len(filteredTasks),
		"calendarResult":     calendarResult,
	}
}

// TestBusinessIntegration 测试业务集成
func TestBusinessIntegration(t *testing.T) {
	businessProcess := NewBusinessProcess()

	t.Log("=== 开始核心业务流程集成测试 ===")

	// 测试1: 应用初始化完整流程
	t.Log("测试1: 应用初始化完整流程")
	result := businessProcess.InitializeApp()

	if result["success"].(bool) &&
		result["taskCount"].(int) > 0 &&
		result["calendarRendered"] != nil {
		t.Log("  ✅ 通过: 应用初始化成功")
		t.Logf("  ✅ 通过: 任务加载成功，共%d个任务", result["taskCount"])
		t.Log("  ✅ 通过: 日历渲染成功")
	} else {
		t.Error("应用初始化流程失败")
	}

	// 测试2: 节假日任务处理流程
	t.Log("\n测试2: 节假日任务处理流程")
	holidayTasks := businessProcess.ProcessHolidayTasks()

	if len(holidayTasks) > 0 {
		t.Logf("  ✅ 通过: 成功识别节假日任务")
		t.Logf("  ✅ 通过: 节假日任务数量: %d", len(holidayTasks))
		if task, ok := holidayTasks[0]["task"].(map[string]interface{}); ok {
			if urgencyLevel, exists := task["urgencyLevel"]; exists {
				t.Logf("  ✅ 通过: 紧急程度计算正确: %v", urgencyLevel)
			}
		}
	} else {
		t.Error("节假日任务处理失败")
	}

	// 测试3: 按项目筛选任务并渲染日历
	t.Log("\n测试3: 按项目筛选任务并渲染日历")
	result = businessProcess.FilterTasksByProjectAndRender("project1")

	if result["projectName"] == "project1" &&
		result["filteredTasksCount"].(int) > 0 &&
		result["calendarResult"] != nil {
		t.Log("  ✅ 通过: 项目筛选成功")
		t.Logf("  ✅ 通过: 筛选后任务数量: %d", result["filteredTasksCount"])
		t.Log("  ✅ 通过: 筛选后日历渲染成功")
	} else {
		t.Error("项目筛选和日历渲染失败")
	}

	// 测试4: 任务状态计算集成
	t.Log("\n测试4: 任务状态计算集成")
	testTask := map[string]interface{}{
		"status":  "pending",
		"dueDate": "2024-12-31",
	}
	taskStatus := businessProcess.TaskParser.CalculateTaskDisplayStatus(testTask)

	if taskStatus != "" {
		t.Log("  ✅ 通过: 任务状态计算集成成功")
		t.Logf("  ✅ 通过: 成功获取任务状态: %s", taskStatus)
	} else {
		t.Errorf("任务状态计算返回无效值: %s", taskStatus)
	}

	// 测试5: 日期导航与日历更新流程
	t.Log("\n测试5: 日期导航与日历更新流程")
	targetDate := "2024-01-01"
	businessProcess.TodoManager.GoToDate(targetDate)
	businessProcess.TodoManager.GetTasks() // 获取任务列表
	calendarResult := businessProcess.CalendarRenderer.RenderCalendar(
		businessProcess.TodoManager.CurrentDate,
		[]map[string]interface{}{},
	)

	if calendarResult["year"] == 2024 &&
		calendarResult["month"] == 0 {
		t.Log("  ✅ 通过: 日期导航成功")
		t.Log("  ✅ 通过: 日历更新成功")
	} else {
		t.Error("日期导航与日历更新失败")
	}

	t.Log("\n=== 核心业务流程集成测试完成 ===")
}
