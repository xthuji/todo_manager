package services

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"todolist-go/app/utils"
)

// AutoWeatherNotify 自动天气通知服务
type AutoWeatherNotify struct {
	IsSending bool

	// 天气图标映射表
	WeatherIcons []map[string]interface{}
}

// 初始化自动天气通知服务
var autoWeatherNotify = &AutoWeatherNotify{
	IsSending: false,
	WeatherIcons: []map[string]interface{}{
		{"keywords": []string{"暴雨", "大雨", "中雨", "小雨", "阵雨", "雨"}, "icon": "🌧️"},
		{"keywords": []string{"雷阵雨", "雷"}, "icon": "⚡"},
		{"keywords": []string{"雾", "霾"}, "icon": "🌫️"},
		{"keywords": []string{"多云", "晴间多云"}, "icon": "⛅"},
		{"keywords": []string{"晴"}, "icon": "☀️"},
		{"keywords": []string{"阴"}, "icon": "☁️"},
		{"keywords": []string{"雪"}, "icon": "❄️"},
		{"keywords": []string{"云"}, "icon": "☁️"},
	},
}

// GetWeatherIcon 获取天气图标
func (a *AutoWeatherNotify) GetWeatherIcon(weather string) string {
	for _, item := range a.WeatherIcons {
		keywords, _ := item["keywords"].([]string)
		for _, keyword := range keywords {
			if strings.Contains(weather, keyword) {
				return item["icon"].(string)
			}
		}
	}
	return "⛅"
}

// FormatDateTime 格式化日期与星期
func (a *AutoWeatherNotify) FormatDateTime(inputDate string, weekOnly bool) string {
	var t time.Time
	if inputDate != "" && len(inputDate) == 8 {
		if year, err1 := strconv.Atoi(inputDate[:4]); err1 == nil {
			if month, err2 := strconv.Atoi(inputDate[4:6]); err2 == nil {
				if day, err3 := strconv.Atoi(inputDate[6:8]); err3 == nil {
					t = time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.Local)
				}
			}
		}
	}
	if t.IsZero() {
		t = time.Now()
	}

	weekDays := []string{"周日", "周一", "周二", "周三", "周四", "周五", "周六"}
	weekStr := weekDays[t.Weekday()]
	if weekOnly {
		return weekStr
	}
	return fmt.Sprintf("%s %s %s", t.Format("2006-01-02"), weekStr, t.Format("15:04"))
}

// OrganizeWeatherText 组织天气文本
func (a *AutoWeatherNotify) OrganizeWeatherText(weatherData map[string]interface{}) string {
	todayWeather, _ := weatherData["todayWeather"].(map[string]interface{})
	recentDaysWeather, _ := weatherData["recentDaysWeather"].([]interface{})
	areaName, _ := weatherData["areaName"].(string)
	if areaName == "" {
		areaName = "未知地区"
	}
	weatherCode, _ := weatherData["weatherCode"].(string)
	mojiAreaCode, _ := weatherData["mojiAreaCode"].(string)
	nmcAreaCode, _ := weatherData["nmcAreaCode"].(string)
	cmaAreaCode, _ := weatherData["cmaAreaCode"].(string)

	lines := []string{
		fmt.Sprintf("📍 %s 天气 📅 %s", areaName, a.FormatDateTime("", false)),
		"",
		fmt.Sprintf("%s %s，🌡️ 温度：%s~%s°C",
			a.GetWeatherIcon(getStr(todayWeather, "weather")),
			getStr(todayWeather, "weather", "未知"),
			getStr(todayWeather, "tempMin", "--"),
			getStr(todayWeather, "tempMax", "--")),
		fmt.Sprintf("💧 湿度：%s", getStr(todayWeather, "humidity", "--")),
		fmt.Sprintf("🍃 空气质量：%s", getStr(todayWeather, "airQuality", "--")),
		fmt.Sprintf("༄ 风力风向：%s", getStr(todayWeather, "wind", "--")),
	}

	if len(recentDaysWeather) > 1 {
		lines = append(lines, "\n未来天气预告：")
		for i, day := range recentDaysWeather[1:] {
			dayMap := day.(map[string]interface{})
			date := getStr(dayMap, "date")
			lines = append(lines, fmt.Sprintf("%d天后(%s)：%s%s，🌡️%s~%s°C，༄%s",
				i+1, a.FormatDateTime(date, true),
				a.GetWeatherIcon(getStr(dayMap, "weather")),
				getStr(dayMap, "weather", "--"),
				getStr(dayMap, "tempMin", "--"),
				getStr(dayMap, "tempMax", "--"),
				getStr(dayMap, "wind", "--")))
		}
	}

	lines = append(lines, "\n🔗 详情查阅：")
	if weatherCode != "" {
		lines = append(lines, fmt.Sprintf("· [天气网](https://forecast.weather.com.cn/town/weather1dn/%s.shtml)", weatherCode))
	}
	if mojiAreaCode != "" {
		lines = append(lines, fmt.Sprintf("· [墨迹天气](https://tianqi.moji.com/weather/china/%s)", mojiAreaCode))
	}
	if nmcAreaCode != "" {
		lines = append(lines, fmt.Sprintf("· [中央气象台](https://www.nmc.cn/publish/forecast/%s.html)", nmcAreaCode))
	}
	if cmaAreaCode != "" {
		lines = append(lines, fmt.Sprintf("· [中国气象局](https://weather.cma.cn/web/weather/%s.html)", cmaAreaCode))
	}
	lines = append(lines, "\n祝您生活愉快！")
	return strings.Join(lines, "\n")
}

// ValidateWeatherData 验证天气数据
func (a *AutoWeatherNotify) ValidateWeatherData(weatherData map[string]interface{}) map[string]interface{} {
	errors := []string{}
	if weatherData == nil {
		errors = append(errors, "天气数据为空")
	} else if _, ok := weatherData["todayWeather"]; !ok {
		errors = append(errors, "缺少今日天气数据")
	} else if _, ok1 := weatherData["areaName"]; !ok1 {
		if _, ok2 := weatherData["weatherCode"]; !ok2 {
			errors = append(errors, "缺少区域标识")
		}
	}
	return map[string]interface{}{"isValid": len(errors) == 0, "errors": errors}
}

// SendErrorNotify 发送错误警报
func (a *AutoWeatherNotify) SendErrorNotify(targetUserInfo map[string]interface{}, message string) {
	if targetUserInfo == nil {
		return
	}
	errorText := fmt.Sprintf("❌ 天气服务异常\n时间: %s\n原因: %s", a.FormatDateTime("", false), message)
	SendMessage("weather", targetUserInfo, errorText)
}

// SendWeatherNotifyOnTimer 执行通知任务
func (a *AutoWeatherNotify) SendWeatherNotifyOnTimer() {
	utils.LoggerInstance.Info("天气通知任务启动...")
	if a.IsSending {
		return
	}
	a.IsSending = true
	defer func() { a.IsSending = false }()

	notifyConfig := GetNotifyConfig()
	if notifyConfig == nil {
		notifyConfig = LoadNotifyConfig()
	}
	if notifyConfig == nil {
		utils.LoggerInstance.Error("[Error] 通知配置未加载")
		return
	}

	config, _ := notifyConfig["weather"].(map[string]interface{})
	if len(config) == 0 {
		utils.LoggerInstance.Error("[Error] 天气通知配置未找到")
		return
	}

	weatherCode := getStr(config, "weatherCode")
	if weatherCode == "" {
		utils.LoggerInstance.Error("[Error] 天气代码未配置")
		return
	}

	utils.LoggerInstance.Info("[Task] 正在获取天气数据", "weather_code", weatherCode)

	// 获取区县级别区域编码并构建请求参数
	weatherParams := map[string]interface{}{"weatherCode": weatherCode}
	if districtAreaCode := GetDistrictAreaCodes(weatherCode); districtAreaCode != nil {
		for k, v := range districtAreaCode {
			weatherParams[k] = v
		}
	}

	weatherResult := GetWeatherData(weatherParams)
	weatherData, _ := weatherResult["data"].(map[string]interface{})
	validation := a.ValidateWeatherData(weatherData)

	if isValid, _ := validation["isValid"].(bool); !isValid {
		errors, _ := validation["errors"].([]string)
		errorMsg := fmt.Sprintf("数据校验失败: %s", strings.Join(errors, ", "))
		utils.LoggerInstance.Error("[Error] 数据校验失败", "errorMsg", errorMsg)
		a.SendErrorNotify(config, errorMsg)
		return
	}

	weatherText := a.OrganizeWeatherText(weatherData)
	result := SendMessage("weather", config, weatherText)

	if success, _ := result["success"].(bool); success {
		utils.LoggerInstance.Info("天气通知发送成功")
	} else {
		msg := ""
		if m, ok := result["message"].(string); ok {
			msg = m
		}
		utils.LoggerInstance.Error("天气通知发送失败", "message", msg)
		a.SendErrorNotify(config, msg)
	}
}

// StartWeatherNotifyTimer 启动天气通知定时器
func StartWeatherNotifyTimer() {
	utils.LoggerInstance.Info("初始化天气通知定时器...")
	notifyConfig := LoadNotifyConfig()
	if notifyConfig == nil {
		utils.LoggerInstance.Info("天气通知功能未启用")
		return
	}

	weatherConfig, ok := notifyConfig["weather"].(map[string]interface{})
	if !ok {
		utils.LoggerInstance.Info("天气通知功能未启用")
		return
	}

	if notifyEnabled, _ := weatherConfig["notifyEnabled"].(bool); !notifyEnabled {
		utils.LoggerInstance.Info("天气通知功能未启用")
		return
	}

	if timerEnabled, _ := weatherConfig["timerEnabled"].(bool); timerEnabled {
		cronExpression := getStr(weatherConfig, "cronExpression", "0 8 * * *")
		parts := strings.Split(cronExpression, " ")
		if len(parts) >= 5 && parts[0] == "0" {
			if h, err := strconv.Atoi(parts[1]); err == nil {
				utils.LoggerInstance.Info("定时器已启动，每天 %d:00 发送天气通知", h)
			}
		}
	}

	if startupNotifyEnabled, _ := weatherConfig["startupNotifyEnabled"].(bool); startupNotifyEnabled {
		utils.LoggerInstance.Info("执行启动时即时通知...")
		autoWeatherNotify.SendWeatherNotifyOnTimer()
	}

	utils.LoggerInstance.Info("天气通知定时器已启动")
}

// RunSendTask 运行发送任务
func RunSendTask() {
	autoWeatherNotify.SendWeatherNotifyOnTimer()
}

// getStr 从map中安全获取字符串
func getStr(m map[string]interface{}, key string, defaultVal ...string) string {
	if val, ok := m[key].(string); ok {
		return val
	}
	if len(defaultVal) > 0 {
		return defaultVal[0]
	}
	return ""
}
