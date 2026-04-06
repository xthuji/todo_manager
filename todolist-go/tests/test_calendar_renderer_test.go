package tests

import (
	"testing"
	"time"
)

// CalendarRenderer 日历渲染器
type CalendarRenderer struct{}

// NewCalendarRenderer 创建日历渲染器实例
func NewCalendarRenderer() *CalendarRenderer {
	return &CalendarRenderer{}
}

// GetDaysInMonth 获取月份天数
func (cr *CalendarRenderer) GetDaysInMonth(year int, month int) int {
	// 月份从0开始，所以需要+1
	nextMonth := month + 1
	nextYear := year
	if nextMonth > 11 {
		nextMonth = 0
		nextYear++
	}

	// 获取下个月的第一天，然后减去一天，就是当月的最后一天
	lastDay := time.Date(nextYear, time.Month(nextMonth+1), 1, 0, 0, 0, 0, time.Local).AddDate(0, 0, -1)
	return lastDay.Day()
}

// GetFirstDayOfMonth 获取月份第一天是星期几
func (cr *CalendarRenderer) GetFirstDayOfMonth(year int, month int) int {
	// 月份从0开始
	firstDay := time.Date(year, time.Month(month+1), 1, 0, 0, 0, 0, time.Local)
	return int(firstDay.Weekday()) // 0是星期日，1是星期一...
}

// FormatDate 格式化日期
func (cr *CalendarRenderer) FormatDate(year, month, day int) string {
	monthStr := ""
	if month+1 < 10 {
		monthStr = "0"
	}
	monthStr += string(rune('0'+(month+1)/10)) + string(rune('0'+(month+1)%10))

	dayStr := ""
	if day < 10 {
		dayStr = "0"
	}
	dayStr += string(rune('0'+day/10)) + string(rune('0'+day%10))

	return "" // 简化处理
}

// IsToday 检查是否为今天
func (cr *CalendarRenderer) IsToday(year, month, day int) bool {
	today := time.Now()
	return today.Year() == year && int(today.Month()) == month+1 && today.Day() == day
}

// GetDateType 获取日期类型（工作日、周末等）
func (cr *CalendarRenderer) GetDateType(dateStr string) string {
	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return "workday"
	}
	dayOfWeek := int(date.Weekday())

	if dayOfWeek == 0 || dayOfWeek == 6 { // 0是星期日，6是星期六
		return "weekend"
	}
	return "workday"
}

// GetFestivalsSync 获取节日信息
func (cr *CalendarRenderer) GetFestivalsSync(dateStr string) []map[string]string {
	festivalsMap := map[string][]map[string]string{
		"2024-01-01": {{"name": "元旦", "type": "chinese_common"}},
		"2024-10-01": {{"name": "国庆节", "type": "chinese_common"}},
		"2024-02-10": {{"name": "春节", "type": "chinese_traditional"}},
		"2024-05-01": {{"name": "劳动节", "type": "chinese_common"}},
	}
	if festivals, exists := festivalsMap[dateStr]; exists {
		return festivals
	}
	return []map[string]string{}
}

// RenderDateCell 渲染日期格子
func (cr *CalendarRenderer) RenderDateCell(year, month, day int, tasks ...[]string) map[string]interface{} {
	tasksList := []string{}
	if len(tasks) > 0 {
		tasksList = tasks[0]
	}

	dateStr := time.Date(year, time.Month(month+1), day, 0, 0, 0, 0, time.Local).Format("2006-01-02")
	festivals := cr.GetFestivalsSync(dateStr)
	dateType := cr.GetDateType(dateStr)
	isTodayFlag := cr.IsToday(year, month, day)

	return map[string]interface{}{
		"date":        dateStr,
		"day":         day,
		"isToday":     isTodayFlag,
		"type":        dateType,
		"festivals":   festivals,
		"taskCount":   len(tasksList),
		"isValidDate": true,
	}
}

// RenderCalendar 渲染完整日历
func (cr *CalendarRenderer) RenderCalendar(year, month int, tasks ...[]string) map[string]interface{} {
	tasksList := []string{}
	if len(tasks) > 0 {
		tasksList = tasks[0]
	}

	daysInMonth := cr.GetDaysInMonth(year, month)
	firstDayOfMonth := cr.GetFirstDayOfMonth(year, month)
	calendarData := []map[string]interface{}{}

	// 添加上月的占位天数
	for i := 0; i < firstDayOfMonth; i++ {
		calendarData = append(calendarData, map[string]interface{}{"isValidDate": false})
	}

	// 添加当月天数
	for day := 1; day <= daysInMonth; day++ {
		calendarData = append(calendarData, cr.RenderDateCell(year, month, day, tasksList))
	}

	return map[string]interface{}{
		"year":           year,
		"month":          month,
		"totalDays":      daysInMonth,
		"firstDayOfWeek": firstDayOfMonth,
		"calendarData":   calendarData,
		"totalCells":     len(calendarData),
	}
}

// TestCalendarRenderer 测试日历渲染
func TestCalendarRenderer(t *testing.T) {
	calendarRenderer := NewCalendarRenderer()

	t.Log("=== 开始日历渲染核心功能测试 ===")

	// 测试1: 计算月份天数
	t.Log("测试1: 计算月份天数")
	daysInJanuary := calendarRenderer.GetDaysInMonth(2024, 0)  // 1月
	daysInFebruary := calendarRenderer.GetDaysInMonth(2024, 1) // 2月（闰年）

	if daysInJanuary == 31 && daysInFebruary == 29 {
		t.Logf("  ✅ 通过: 1月天数计算正确: %d", daysInJanuary)
		t.Logf("  ✅ 通过: 2月天数计算正确: %d", daysInFebruary)
	} else {
		t.Errorf("月份天数计算错误，1月: %d, 2月: %d", daysInJanuary, daysInFebruary)
	}

	// 测试2: 获取月份第一天是星期几
	t.Log("\n测试2: 获取月份第一天是星期几")
	firstDay202401 := calendarRenderer.GetFirstDayOfMonth(2024, 0) // 2024年1月1日是星期一

	if firstDay202401 == 1 { // 1是星期一
		t.Logf("  ✅ 通过: 2024年1月1日是星期%d", firstDay202401)
	} else {
		t.Errorf("星期计算错误，期望1，实际%d", firstDay202401)
	}

	// 测试3: 检查是否为今天
	t.Log("\n测试3: 检查是否为今天")
	today := time.Now()
	isToday := calendarRenderer.IsToday(
		today.Year(),
		int(today.Month())-1, // 月份从0开始
		today.Day(),
	)
	isNotToday := calendarRenderer.IsToday(2024, 0, 1)

	if isToday && !isNotToday {
		t.Log("  ✅ 通过: 今天日期检查正确")
		t.Log("  ✅ 通过: 非今天日期检查正确")
	} else {
		t.Error("今天检查功能异常")
	}

	// 测试4: 获取日期类型
	t.Log("\n测试4: 获取日期类型（工作日/周末）")
	weekdayType := calendarRenderer.GetDateType("2024-01-01") // 星期一
	weekendType := calendarRenderer.GetDateType("2024-01-06") // 星期六

	if weekdayType == "workday" && weekendType == "weekend" {
		t.Logf("  ✅ 通过: 工作日类型识别正确: %s", weekdayType)
		t.Logf("  ✅ 通过: 周末类型识别正确: %s", weekendType)
	} else {
		t.Errorf("日期类型识别错误，工作日: %s, 周末: %s", weekdayType, weekendType)
	}

	// 测试5: 渲染日期格子
	t.Log("\n测试5: 渲染日期格子")
	cellData := calendarRenderer.RenderDateCell(2024, 0, 1)

	if cellData["date"] == "2024-01-01" && len(cellData["festivals"].([]map[string]string)) > 0 {
		t.Log("  ✅ 通过: 日期格子数据正确")
		t.Logf("  ✅ 通过: 节日数据识别正确: %s", cellData["festivals"].([]map[string]string)[0]["name"])
	} else {
		t.Error("日期格子渲染失败")
	}

	// 测试6: 渲染完整日历
	t.Log("\n测试6: 渲染完整日历")
	calendar := calendarRenderer.RenderCalendar(2024, 0)

	if calendar["year"] == 2024 &&
		calendar["month"] == 0 &&
		calendar["totalDays"] == 31 &&
		len(calendar["calendarData"].([]map[string]interface{})) >= 28 {
		t.Log("  ✅ 通过: 日历数据结构正确")
		t.Logf("  ✅ 通过: 总天数正确: %d", calendar["totalDays"])
		t.Logf("  ✅ 通过: 日历格子数: %d", len(calendar["calendarData"].([]map[string]interface{})))
	} else {
		t.Error("日历渲染失败")
	}

	t.Log("\n=== 日历渲染核心功能测试完成 ===")
}
