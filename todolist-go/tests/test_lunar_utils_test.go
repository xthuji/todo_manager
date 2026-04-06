package tests

import (
	"fmt"
	"testing"
	"time"
)

// LunarUtils 农历工具
type LunarUtils struct {
	ChineseMonths []string
	ChineseDays   []string
}

// NewLunarUtils 创建农历工具实例
func NewLunarUtils() *LunarUtils {
	return &LunarUtils{
		ChineseMonths: []string{"", "正月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "冬月", "腊月"},
		ChineseDays: []string{"", "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
			"十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
			"廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"},
	}
}

// FormatDate 格式化日期
func (lu *LunarUtils) FormatDate(date time.Time) string {
	return date.Format("2006-01-02")
}

// GetLunarDateText 获取农历日期文本（模拟）
func (lu *LunarUtils) GetLunarDateText(dateStr string) map[string]string {
	date, _ := time.Parse("2006-01-02", dateStr)
	month := int(date.Month())
	day := date.Day()

	lunarMonth := ""
	if month < len(lu.ChineseMonths) {
		lunarMonth = lu.ChineseMonths[month]
	} else {
		lunarMonth = "未知月"
	}

	lunarDay := ""
	if day < len(lu.ChineseDays) {
		lunarDay = lu.ChineseDays[day]
	} else {
		lunarDay = "未知日"
	}

	return map[string]string{
		"lunarMonth": lunarMonth,
		"lunarDay":   lunarDay,
		"fullText":   fmt.Sprintf("%s %s", lunarMonth, lunarDay),
	}
}

// GetFestivalsSync 获取节日信息
func (lu *LunarUtils) GetFestivalsSync(dateStr string) []map[string]interface{} {
	date, _ := time.Parse("2006-01-02", dateStr)
	month := int(date.Month())
	day := date.Day()
	festivals := []map[string]interface{}{}

	festivalsMap := map[string][]map[string]interface{}{
		"01-01": {{"name": "元旦", "type": "chinese_common"}},
		"02-14": {{"name": "情人节", "type": "foreign"}},
		"05-01": {{"name": "劳动节", "type": "chinese_common"}},
		"05-20": {{"name": "520", "type": "custom"}},
		"10-01": {{"name": "国庆节", "type": "chinese_common"}},
		"12-25": {{"name": "圣诞节", "type": "foreign"}},
	}

	dateKey := fmt.Sprintf("%02d-%02d", month, day)
	if items, exists := festivalsMap[dateKey]; exists {
		for _, festival := range items {
			festivals = append(festivals, map[string]interface{}{
				"name":     festival["name"],
				"type":     festival["type"],
				"date":     dateStr,
				"priority": 10,
			})
		}
	}

	return festivals
}

// GetFestivalStyleClass 获取节日样式类
func (lu *LunarUtils) GetFestivalStyleClass(festivalType string) string {
	holidayStylesClass := map[string]string{
		"chinese_common":      "bg-festival-common",
		"chinese_traditional": "bg-festival-traditional",
		"foreign":             "bg-festival-foreign",
		"solar_terms":         "bg-festival-terms",
		"custom":              "bg-festival-custom",
	}
	if style, exists := holidayStylesClass[festivalType]; exists {
		return style
	}
	return "bg-festival-custom"
}

// GetFestivalTypeName 获取节日类型名称
func (lu *LunarUtils) GetFestivalTypeName(festivalType string) string {
	names := map[string]string{
		"chinese_common":      "常用节日",
		"chinese_traditional": "传统节日",
		"foreign":             "国外节日",
		"solar_terms":         "节气",
		"custom":              "自定义节日",
	}
	if name, exists := names[festivalType]; exists {
		return name
	}
	return "未知类型"
}

// IsChineseHoliday 检查是否为中国节假日
func (lu *LunarUtils) IsChineseHoliday(dateStr string) bool {
	festivals := lu.GetFestivalsSync(dateStr)
	for _, festival := range festivals {
		if festivalType, ok := festival["type"].(string); ok {
			if festivalType == "chinese_common" || festivalType == "chinese_traditional" {
				return true
			}
		}
	}
	return false
}

// GetDateFullInfo 获取日期的完整信息
func (lu *LunarUtils) GetDateFullInfo(dateStr string) map[string]interface{} {
	date, _ := time.Parse("2006-01-02", dateStr)
	lunarInfo := lu.GetLunarDateText(dateStr)
	festivals := lu.GetFestivalsSync(dateStr)
	isHoliday := lu.IsChineseHoliday(dateStr)

	return map[string]interface{}{
		"date":          dateStr,
		"solarYear":     date.Year(),
		"solarMonth":    int(date.Month()),
		"solarDay":      date.Day(),
		"lunarMonth":    lunarInfo["lunarMonth"],
		"lunarDay":      lunarInfo["lunarDay"],
		"festivals":     festivals,
		"isHoliday":     isHoliday,
		"festivalCount": len(festivals),
	}
}

// TestLunarUtils 测试农历工具
func TestLunarUtils(t *testing.T) {
	lunarUtils := NewLunarUtils()

	t.Log("=== 开始农历和节日管理核心功能测试 ===")

	// 测试1: 日期格式化
	t.Log("测试1: 日期格式化")
	date, _ := time.Parse("2006-01-02", "2024-01-15")
	formattedDate := lunarUtils.FormatDate(date)

	if formattedDate == "2024-01-15" {
		t.Logf("  ✅ 通过: 日期格式化正确: %s", formattedDate)
	} else {
		t.Errorf("日期格式化错误，期望2024-01-15，实际%s", formattedDate)
	}

	// 测试2: 获取农历日期文本
	t.Log("\n测试2: 获取农历日期文本")
	lunarInfo := lunarUtils.GetLunarDateText("2024-01-15")

	if lunarInfo["lunarMonth"] != "" && lunarInfo["lunarDay"] != "" {
		t.Logf("  ✅ 通过: 农历月份: %s", lunarInfo["lunarMonth"])
		t.Logf("  ✅ 通过: 农历日期: %s", lunarInfo["lunarDay"])
	} else {
		t.Error("农历信息获取失败")
	}

	// 测试3: 获取节日信息（元旦）
	t.Log("\n测试3: 获取节日信息（元旦）")
	festivals := lunarUtils.GetFestivalsSync("2024-01-01")

	if len(festivals) > 0 && festivals[0]["name"] == "元旦" && festivals[0]["type"] == "chinese_common" {
		t.Logf("  ✅ 通过: 节日类型正确: %s", festivals[0]["type"])
	} else {
		t.Error("元旦节日信息获取失败")
	}

	// 测试4: 获取节日信息（自定义节日）
	t.Log("\n测试4: 获取节日信息（自定义节日）")
	festivals = lunarUtils.GetFestivalsSync("2024-05-20")

	if len(festivals) > 0 && festivals[0]["name"] == "520" && festivals[0]["type"] == "custom" {
		t.Logf("  ✅ 通过: 自定义节日类型正确: %s", festivals[0]["type"])
	} else {
		t.Error("520节日信息获取失败")
	}

	// 测试5: 获取节日样式类
	t.Log("\n测试5: 获取节日样式类")
	commonClass := lunarUtils.GetFestivalStyleClass("chinese_common")
	traditionalClass := lunarUtils.GetFestivalStyleClass("chinese_traditional")
	unknownClass := lunarUtils.GetFestivalStyleClass("unknown_type")

	if commonClass == "bg-festival-common" &&
		traditionalClass == "bg-festival-traditional" &&
		unknownClass == "bg-festival-custom" {
		t.Logf("  ✅ 通过: 常用节日样式类正确: %s", commonClass)
		t.Logf("  ✅ 通过: 传统节日样式类正确: %s", traditionalClass)
		t.Logf("  ✅ 通过: 未知类型默认样式类正确: %s", unknownClass)
	} else {
		t.Error("节日样式类获取失败")
	}

	// 测试6: 获取节日类型名称
	t.Log("\n测试6: 获取节日类型名称")
	commonName := lunarUtils.GetFestivalTypeName("chinese_common")
	foreignName := lunarUtils.GetFestivalTypeName("foreign")

	if commonName == "常用节日" && foreignName == "国外节日" {
		t.Logf("  ✅ 通过: 常用节日名称正确: %s", commonName)
		t.Logf("  ✅ 通过: 国外节日名称正确: %s", foreignName)
	} else {
		t.Error("节日类型名称获取失败")
	}

	// 测试7: 检查是否为中国节假日
	t.Log("\n测试7: 检查是否为中国节假日")
	isHoliday1 := lunarUtils.IsChineseHoliday("2024-01-01")
	isHoliday2 := lunarUtils.IsChineseHoliday("2024-05-20")

	if isHoliday1 && !isHoliday2 {
		t.Log("  ✅ 通过: 元旦正确识别为节假日")
		t.Log("  ✅ 通过: 520正确识别为非节假日")
	} else {
		t.Error("节假日判断失败")
	}

	// 测试8: 获取日期完整信息
	t.Log("\n测试8: 获取日期完整信息")
	dateInfo := lunarUtils.GetDateFullInfo("2024-01-01")

	if dateInfo["date"] == "2024-01-01" &&
		dateInfo["isHoliday"].(bool) &&
		dateInfo["festivalCount"].(int) > 0 {
		t.Logf("  ✅ 通过: 节假日标记正确: %v", dateInfo["isHoliday"])
		t.Logf("  ✅ 通过: 节日数量正确: %d", dateInfo["festivalCount"])
	} else {
		t.Error("日期完整信息获取失败")
	}

	t.Log("\n=== 农历和节日管理核心功能测试完成 ===")
}
