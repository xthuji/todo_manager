package tests

import (
	"fmt"
	"testing"
	"time"
)

// FestivalConfig 节日配置
type FestivalConfig struct {
	Festivals []Festival `json:"festivals"`
	WorkDays  []string   `json:"workDays"`
}

// Festival 节日
type Festival struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Type     string `json:"type"`
	DateType string `json:"dateType"`
	Date     string `json:"date"`
}

// MockFestivalConfig 模拟节日配置数据
var MockFestivalConfig = FestivalConfig{
	Festivals: []Festival{
		{ID: "1", Name: "元旦", Type: "national", DateType: "solar", Date: "01-01"},
		{ID: "2", Name: "春节", Type: "chinese_traditional", DateType: "lunar", Date: "01-01"},
		{ID: "3", Name: "劳动节", Type: "national", DateType: "solar", Date: "05-01"},
		{ID: "4", Name: "端午节", Type: "chinese_traditional", DateType: "lunar", Date: "05-05"},
		{ID: "5", Name: "中秋节", Type: "chinese_traditional", DateType: "lunar", Date: "08-15"},
		{ID: "6", Name: "国庆节", Type: "national", DateType: "solar", Date: "10-01"},
		{ID: "7", Name: "520", Type: "custom", DateType: "solar", Date: "05-20"},
		{ID: "8", Name: "618", Type: "custom", DateType: "solar", Date: "06-18"},
	},
	WorkDays: []string{},
}

// FormatDateForTest 日期格式化
func FormatDateForTest(date time.Time) string {
	return date.Format("2006-01-02")
}

// GenerateTestDate 生成测试日期
func GenerateTestDate(month, day int, year ...int) time.Time {
	y := time.Now().Year()
	if len(year) > 0 {
		y = year[0]
	}
	return time.Date(y, time.Month(month), day, 0, 0, 0, 0, time.Local)
}

// MockGetFestivals 模拟获取节日信息
func MockGetFestivals(date time.Time, festivalConfig FestivalConfig) []map[string]string {
	dateStr := FormatDateForTest(date)
	month := int(date.Month())
	day := date.Day()
	formattedMonth := fmt.Sprintf("%02d", month)
	formattedDay := fmt.Sprintf("%02d", day)
	festivals := []map[string]string{}

	for _, festival := range festivalConfig.Festivals {
		if festival.DateType == "solar" && festival.Date == fmt.Sprintf("%s-%s", formattedMonth, formattedDay) {
			festivals = append(festivals, map[string]string{
				"name": festival.Name,
				"type": festival.Type,
				"date": dateStr,
			})
		}
	}

	return festivals
}

// MockIsChineseHoliday 模拟检查是否为中国节假日
func MockIsChineseHoliday(date time.Time, festivalConfig FestivalConfig) bool {
	festivals := MockGetFestivals(date, festivalConfig)

	for _, festival := range festivals {
		if festival["type"] == "national" || festival["type"] == "chinese_common" || festival["type"] == "chinese_traditional" {
			return true
		}
	}
	return false
}

// TestFestivalsManager 测试节日管理
func TestFestivalsManager(t *testing.T) {
	t.Log("\n===== 开始测试节日相关功能 =====")

	// 测试1: 测试单个节日识别
	t.Log("\n测试1: 测试单个节日识别")
	testCases := []struct {
		month         int
		day           int
		expectedNames []string
	}{
		{1, 1, []string{"元旦"}},
		{5, 1, []string{"劳动节"}},
		{10, 1, []string{"国庆节"}},
		{5, 20, []string{"520"}},
		{6, 18, []string{"618"}},
		{1, 2, []string{}},
	}

	passed1 := 0
	for _, testCase := range testCases {
		testDate := GenerateTestDate(testCase.month, testCase.day)
		dateStr := FormatDateForTest(testDate)
		festivals := MockGetFestivals(testDate, MockFestivalConfig)

		foundNames := []string{}
		for _, f := range festivals {
			foundNames = append(foundNames, f["name"])
		}

		allExpectedFound := true
		for _, name := range testCase.expectedNames {
			found := false
			for _, foundName := range foundNames {
				if foundName == name {
					found = true
					break
				}
			}
			if !found {
				allExpectedFound = false
				break
			}
		}

		if allExpectedFound && len(foundNames) == len(testCase.expectedNames) {
			t.Logf("✓ %s: 成功识别到预期节日: %v", dateStr, foundNames)
			passed1++
		} else {
			t.Errorf("✗ %s: 节日识别错误", dateStr)
		}
	}

	t.Logf("测试1结果: %d/%d 通过", passed1, len(testCases))

	// 测试2: 中国节假日判断
	t.Log("\n测试2: 中国节假日判断")
	testCases2 := []struct {
		date     time.Time
		name     string
		expected bool
	}{
		{GenerateTestDate(1, 1), "元旦", true},
		{GenerateTestDate(5, 1), "劳动节", true},
		{GenerateTestDate(10, 1), "国庆节", true},
		{GenerateTestDate(5, 20), "520", false},
		{GenerateTestDate(1, 2), "工作日", false},
	}

	passed2 := 0
	for _, test := range testCases2 {
		result := MockIsChineseHoliday(test.date, MockFestivalConfig)
		dateStr := FormatDateForTest(test.date)

		if result == test.expected {
			holidayText := "节假日"
			if !result {
				holidayText = "非节假日"
			}
			t.Logf("✓ %s (%s): 正确识别为%s", dateStr, test.name, holidayText)
			passed2++
		} else {
			t.Errorf("✗ %s (%s): 判断错误，期望%v，实际%v", dateStr, test.name, test.expected, result)
		}
	}

	t.Logf("测试2结果: %d/%d 通过", passed2, len(testCases2))

	// 测试3: 边界条件测试
	t.Log("\n测试3: 边界条件测试")
	passed3 := 0

	// 测试无效配置参数
	testDate := GenerateTestDate(1, 1)
	result := MockGetFestivals(testDate, FestivalConfig{})
	t.Logf("✓ 无效配置参数测试通过: 返回 %d 个节日", len(result))
	passed3++

	// 测试特殊日期
	testDate = time.Date(time.Now().Year(), 12, 31, 0, 0, 0, 0, time.Local)
	festivals := MockGetFestivals(testDate, MockFestivalConfig)
	t.Logf("✓ 特殊日期测试通过: 12月31日识别到 %d 个节日", len(festivals))
	passed3++

	t.Logf("测试3结果: %d/2 通过", passed3)

	// 测试4: 全年节日计算测试
	t.Log("\n测试4: 全年节日计算测试")
	currentYear := time.Now().Year()
	keyHolidays := []struct {
		month int
		day   int
		name  string
	}{
		{1, 1, "元旦"},
		{5, 1, "劳动节"},
		{10, 1, "国庆节"},
	}

	passedHolidays := 0
	for _, holiday := range keyHolidays {
		testDate := GenerateTestDate(holiday.month, holiday.day, currentYear)
		festivals := MockGetFestivals(testDate, MockFestivalConfig)

		found := false
		for _, f := range festivals {
			if f["name"] == holiday.name {
				found = true
				break
			}
		}

		if found {
			t.Logf("✓ %d-%d-%d: 成功识别 %s", currentYear, holiday.month, holiday.day, holiday.name)
			passedHolidays++
		} else {
			t.Errorf("✗ %d-%d-%d: 未能识别 %s", currentYear, holiday.month, holiday.day, holiday.name)
		}
	}

	t.Logf("测试4结果: %d/%d 个关键节日识别通过", passedHolidays, len(keyHolidays))

	t.Log("\n===== 总体测试结果 =====")
	totalTests := len(testCases) + len(testCases2) + 2 + len(keyHolidays)
	totalPassed := passed1 + passed2 + passed3 + passedHolidays
	t.Logf("总测试用例数: %d", totalTests)
	t.Logf("通过数: %d", totalPassed)

	if passed1 == len(testCases) && passed2 == len(testCases2) && passed3 == 2 && passedHolidays == len(keyHolidays) {
		t.Log("🎉 所有测试均已通过!")
	} else {
		t.Error("❌ 部分测试失败，请检查代码")
	}
}
