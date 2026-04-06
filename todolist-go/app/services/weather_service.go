package services

import (
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"todolist-go/app/services/weather"
	"todolist-go/app/utils"
)

// 缓存配置
const (
	WeatherCacheTTL = 3600000 // 1小时缓存
)

// 天气选项
var WeatherOptions = utils.CacheOptions{
	AllowExpired: true,       // 允许使用过期缓存作为兜底
	TTL:          WeatherCacheTTL,
}

// CacheWeatherInfo 天气信息缓存处理函数
func CacheWeatherInfo(areaCodeInfo map[string]interface{}, weatherData interface{}) interface{} {
	if !utils.USE_CACHE || areaCodeInfo == nil {
		return nil
	}

	weatherCode, ok1 := areaCodeInfo["weatherCode"].(string)
	mojiAreaCode, ok2 := areaCodeInfo["mojiAreaCode"].(string)
	if !ok1 {
		return nil
	}
	if !ok2 {
		mojiAreaCode = "default"
	}

	cacheKey := fmt.Sprintf("%s_%s", weatherCode, mojiAreaCode)
	fullCacheKey := "weather_" + cacheKey

	if weatherData != nil {
		utils.CacheUtilInstance.SetData(fullCacheKey, weatherData, WeatherOptions)
		return nil
	}
	return utils.CacheUtilInstance.GetWrappedData(fullCacheKey, WeatherOptions)
}

// mergeMaps 合并map，后面的覆盖前面的
func mergeMaps(target map[string]interface{}, sources ...map[string]interface{}) {
	for _, src := range sources {
		for k, v := range src {
			target[k] = v
		}
	}
}

// getTimeValue 获取时间值
func getTimeValue(item map[string]interface{}) int {
	if timeVal, ok := item["time"]; ok {
		switch v := timeVal.(type) {
		case string:
			if val, err := strconv.Atoi(v); err == nil {
				return val
			}
		case float64:
			return int(v)
		case int:
			return v
		}
	}
	return 0
}

// BuildWeatherData 构建天气数据
func BuildWeatherData(
	mojiWeatherData, todayWeatherData, todayDetailWeatherData, cmaWeatherData, nmcWeatherData map[string]interface{},
	recentDaysWeatherData, calendarAndHistoryWeatherData interface{},
	weatherAreaCodeParams map[string]interface{},
) map[string]interface{}{
	// 今日天气信息。优先取更新时间更晚的那个数据
	todayWeatherList := []map[string]interface{}{}
	if m := mojiWeatherData; m != nil {
		if live, ok := m["liveWeather"].(map[string]interface{}); ok {
			todayWeatherList = append(todayWeatherList, live)
		}
	}
	if m := todayWeatherData; m != nil {
		if live, ok := m["liveWeather"].(map[string]interface{}); ok {
			todayWeatherList = append(todayWeatherList, live)
		}
	}
	if todayDetailWeatherData != nil {
		todayWeatherList = append(todayWeatherList, todayDetailWeatherData)
	}
	if cmaWeatherData != nil {
		todayWeatherList = append(todayWeatherList, cmaWeatherData)
	}
	if m := nmcWeatherData; m != nil {
		if live, ok := m["liveWeather"].(map[string]interface{}); ok {
			todayWeatherList = append(todayWeatherList, live)
		}
	}

	// 过滤掉无效数据
	filteredList := make([]map[string]interface{}, 0, len(todayWeatherList))
	for _, item := range todayWeatherList {
		if item != nil && item["time"] != nil {
			filteredList = append(filteredList, item)
		}
	}
	todayWeatherList = filteredList

	// 按时间排序，取更新时间最晚的
	sort.Slice(todayWeatherList, func(i, j int) bool {
		return getTimeValue(todayWeatherList[i]) > getTimeValue(todayWeatherList[j])
	})

	// 合并数据
	todayWeather := make(map[string]interface{})
	if len(todayWeatherList) > 0 {
		mergeMaps(todayWeather, todayWeatherList[0])
	}
	mergeMaps(todayWeather, todayDetailWeatherData)
	if m := mojiWeatherData; m != nil {
		if live, ok := m["liveWeather"].(map[string]interface{}); ok {
			mergeMaps(todayWeather, live)
		}
	}
	if m := todayWeatherData; m != nil {
		if live, ok := m["liveWeather"].(map[string]interface{}); ok {
			mergeMaps(todayWeather, live)
		}
	}
	mergeMaps(todayWeather, cmaWeatherData)
	if m := nmcWeatherData; m != nil {
		if live, ok := m["liveWeather"].(map[string]interface{}); ok {
			mergeMaps(todayWeather, live)
		}
	}

	// 遍历todayWeather的各个字段。如果相同字段都有值时，根据数据源的时间字段，取时间更晚的那个数据源的值
	for key := range todayWeather {
		listWithKey := []map[string]interface{}{}
		for _, item := range todayWeatherList {
			if val, ok := item[key]; ok {
				if val != nil && val != "" {
					listWithKey = append(listWithKey, item)
				}
			}
		}

		if len(listWithKey) > 0 {
			if val, ok := todayWeatherList[0][key]; ok {
				if val != nil && val != "" {
					todayWeather[key] = val
				}
			}
		}
	}

	// 近几日天气
	recentDaysWeather := make([]interface{}, 0)
	if data, ok := recentDaysWeatherData.([]interface{}); ok {
		recentDaysWeather = data
	} else if m, ok := recentDaysWeatherData.(map[string]interface{}); ok {
		if daily, ok := m["dailyWeather"].([]interface{}); ok {
			recentDaysWeather = daily
		}
	}
	if len(recentDaysWeather) == 0 {
		if m := nmcWeatherData; m != nil {
			if daily, ok := m["dailyWeather"].([]interface{}); ok {
				recentDaysWeather = daily
			}
		}
	}

	// 添加逐小时预报和生活助手
	todayWeather["hourlyWeather"] = make([]interface{}, 0)
	todayWeather["lifeHelper"] = make([]interface{}, 0)
	if m := todayWeatherData; m != nil {
		if hourly, ok := m["hourlyWeather"].([]interface{}); ok && len(hourly) > 0 {
			todayWeather["hourlyWeather"] = hourly
		}
		if life, ok := m["lifeHelper"].([]interface{}); ok && len(life) > 0 {
			todayWeather["lifeHelper"] = life
		}
	}

	// 日历天气
	calendarWeather := make([]interface{}, 0)
	if data, ok := calendarAndHistoryWeatherData.([]interface{}); ok {
		calendarWeather = data
	} else if m, ok := calendarAndHistoryWeatherData.(map[string]interface{}); ok {
		if items, ok := m["calendarWeather"].([]interface{}); ok {
			calendarWeather = items
		}
	}

	// 合并墨迹天气日历数据
	if m := mojiWeatherData; m != nil {
		if mojiCalendar, ok := m["calendarWeather"].([]interface{}); ok {
			if len(calendarWeather) == 0 {
				calendarWeather = mojiCalendar
			} else {
				mojiMap := make(map[string]map[string]interface{})
				for _, item := range mojiCalendar {
					if it, ok := item.(map[string]interface{}); ok {
						if date, ok := it["date"].(string); ok {
							mojiMap[date] = it
						}
					}
				}
				todayStr := time.Now().Format("20060102")
				for _, item := range calendarWeather {
					if it, ok := item.(map[string]interface{}); ok {
						if date, ok := it["date"].(string); ok && date < todayStr {
							if mojiItem, ok := mojiMap[date]; ok {
								it["weather"] = strings.TrimSpace(fmt.Sprintf("%v", mojiItem["weather"]))
								it["tempMin"] = mojiItem["tempMin"]
								it["tempMax"] = mojiItem["tempMax"]
								it["wind"] = strings.TrimSpace(fmt.Sprintf("%v", mojiItem["wind"]))
							}
						}
					}
				}
			}
		}
	}

	// 构建完整的天气数据
	weatherData := make(map[string]interface{})
	// 复制weatherAreaCodeParams
	for k, v := range weatherAreaCodeParams {
		weatherData[k] = v
	}

	weatherData["todayWeather"] = todayWeather
	weatherData["recentDaysWeather"] = recentDaysWeather
	weatherData["calendarWeather"] = calendarWeather

	if utils.PRINT_DATA_LOG {
		if mojiWeatherDataJSON, err := json.Marshal(mojiWeatherData); err == nil {
			utils.LoggerInstance.Debug(fmt.Sprintf("墨迹天气数据: %s", mojiWeatherDataJSON))
		}
		if todayWeatherDataJSON, err := json.Marshal(todayWeatherData); err == nil {
			utils.LoggerInstance.Debug(fmt.Sprintf("今日天气数据: %s", todayWeatherDataJSON))
		}
		if todayDetailWeatherDataJSON, err := json.Marshal(todayDetailWeatherData); err == nil {
			utils.LoggerInstance.Debug(fmt.Sprintf("今日天气补充数据: %s", todayDetailWeatherDataJSON))
		}
		if recentDaysWeatherDataJSON, err := json.Marshal(recentDaysWeatherData); err == nil {
			utils.LoggerInstance.Debug(fmt.Sprintf("近几日天气数据: %s", recentDaysWeatherDataJSON))
		}
		if calendarAndHistoryWeatherDataJSON, err := json.Marshal(calendarAndHistoryWeatherData); err == nil {
			utils.LoggerInstance.Debug(fmt.Sprintf("天气历史数据: %s", calendarAndHistoryWeatherDataJSON))
		}
		if cmaWeatherDataJSON, err := json.Marshal(cmaWeatherData); err == nil {
			utils.LoggerInstance.Debug(fmt.Sprintf("CMA(中国气象局)天气数据: %s", cmaWeatherDataJSON))
		}
		if nmcWeatherDataJSON, err := json.Marshal(nmcWeatherData); err == nil {
			utils.LoggerInstance.Debug(fmt.Sprintf("NMC(中央气象台)天气数据: %s", nmcWeatherDataJSON))
		}
	}

	if utils.PRINT_API_DATA {
		apiData := map[string]interface{}{
			"mojiWeatherData":               mojiWeatherData,
			"todayWeatherData":              todayWeatherData,
			"todayDetailWeatherData":        todayDetailWeatherData,
			"cmaWeatherData":                cmaWeatherData,
			"nmcWeatherData":                nmcWeatherData,
			"recentDaysWeatherData":         recentDaysWeatherData,
			"calendarAndHistoryWeatherData": calendarAndHistoryWeatherData,
		}
		weatherData["apiData"] = apiData
	}

	// 检查是否所有必要的API结果都有数据，只有在所有数据都有效时才缓存
	hasMoji := true
	if mojiAreaCode, ok := weatherAreaCodeParams["mojiAreaCode"].(string); ok && mojiAreaCode != "" {
		hasMoji = mojiWeatherData != nil && len(mojiWeatherData) > 0
	}

	hasToday := todayWeatherData != nil && len(todayWeatherData) > 0
	hasTodayLiveWeather := false
	if todayWeatherData != nil {
		if liveWeather, ok := todayWeatherData["liveWeather"].(map[string]interface{}); ok {
			hasTodayLiveWeather = len(liveWeather) > 0
		}
	}

	hasTodayHourlyWeather := false
	if todayWeatherData != nil {
		if hourlyWeather, ok := todayWeatherData["hourlyWeather"].([]interface{}); ok {
			hasTodayHourlyWeather = len(hourlyWeather) > 0
		}
	}

	hasTodayLifeHelper := false
	if todayWeatherData != nil {
		if lifeHelper, ok := todayWeatherData["lifeHelper"].([]interface{}); ok {
			hasTodayLifeHelper = len(lifeHelper) > 0
		}
	}

	hasDetail := todayDetailWeatherData != nil && len(todayDetailWeatherData) > 0
	hasRecentDays := recentDaysWeatherData != nil
	hasCalendar := calendarAndHistoryWeatherData != nil

	// 只有在所有数据都有效时才缓存
	if hasMoji && hasToday && hasTodayLiveWeather && hasTodayHourlyWeather && hasTodayLifeHelper && hasDetail && hasRecentDays && hasCalendar {
		utils.LoggerInstance.Info("所有API结果数据完整，缓存天气数据")
		CacheWeatherInfo(weatherAreaCodeParams, weatherData)
	}

	utils.LoggerInstance.Info("天气数据提取完成")

	return weatherData
}

// QueryWeatherData 查询天气数据
func QueryWeatherData(weatherAreaCodeParams map[string]interface{}) map[string]interface{} {
	forceRefresh, _ := weatherAreaCodeParams["forceRefresh"].(bool)
	if !forceRefresh {
		if cached := CacheWeatherInfo(weatherAreaCodeParams, nil); cached != nil {
			if data, ok := cached.(map[string]interface{}); ok && len(data) > 0 {
				return map[string]interface{}{"data": cached, "timestamp": time.Now().UnixMilli()}
			}
		}
	}

	// 并行执行所有请求
	mojiCh := make(chan interface{}, 1)
	todayCh := make(chan interface{}, 1)
	todayDetailCh := make(chan interface{}, 1)
	recentDaysCh := make(chan interface{}, 1)
	calendarCh := make(chan interface{}, 1)
	cmaCh := make(chan interface{}, 1)
	nmcCh := make(chan interface{}, 1)

	weatherCode := getStr3(weatherAreaCodeParams, "weatherCode")
	mojiAreaCode := getStr3(weatherAreaCodeParams, "mojiAreaCode")
	cmaAreaCode := getStr3(weatherAreaCodeParams, "cmaAreaCode")
	nmcApiCode := getStr3(weatherAreaCodeParams, "nmcApiCode")

	go func() {
		if mojiAreaCode != "" {
			mojiCh <- weather.FetchMojiWeather(mojiAreaCode)
		} else {
			mojiCh <- map[string]interface{}{}
		}
	}()
	go func() {
		if weatherCode != "" {
			todayCh <- weather.FetchTodayWeather(weatherCode)
		} else {
			todayCh <- map[string]interface{}{}
		}
	}()
	go func() {
		if weatherCode != "" {
			todayDetailCh <- weather.FetchTodayDetailWeather(weatherCode)
		} else {
			todayDetailCh <- map[string]interface{}{}
		}
	}()
	go func() {
		if weatherCode != "" {
			recentDaysCh <- weather.FetchRecentDaysWeather(weatherCode)
		} else {
			recentDaysCh <- map[string]interface{}{}
		}
	}()
	go func() {
		if weatherCode != "" {
			calendarCh <- weather.FetchCalendarAndHistoryWeather(weatherCode)
		} else {
			calendarCh <- map[string]interface{}{}
		}
	}()
	go func() {
		if cmaAreaCode != "" {
			cmaCh <- weather.FetchCMAWeather(cmaAreaCode)
		} else {
			cmaCh <- map[string]interface{}{}
		}
	}()
	go func() {
		if nmcApiCode != "" {
			nmcCh <- weather.FetchNMCWeather(nmcApiCode)
		} else {
			nmcCh <- map[string]interface{}{}
		}
	}()

	// 等待所有请求完成
	mojiData := <-mojiCh
	todayData := <-todayCh
	todayDetailData := <-todayDetailCh
	recentDaysData := <-recentDaysCh
	calendarData := <-calendarCh
	cmaData := <-cmaCh
	nmcData := <-nmcCh

	// 检查错误
	errors := []string{}
	checkWeatherError(&errors, "NMC", nmcData)
	checkWeatherError(&errors, "CMA", cmaData)
	checkWeatherError(&errors, "Tianqi", todayData)
	checkWeatherError(&errors, "Moji", mojiData)
	checkWeatherError(&errors, "RecentDays", recentDaysData)
	checkWeatherError(&errors, "Calendar", calendarData)
	checkWeatherError(&errors, "TodayDetail", todayDetailData)
	if len(errors) > 0 {
		utils.LoggerInstance.Warning("部分天气服务出错: %v", errors)
	}

	// 构建天气数据
	mojiMap, _ := mojiData.(map[string]interface{})
	todayMap, _ := todayData.(map[string]interface{})
	todayDetailMap, _ := todayDetailData.(map[string]interface{})
	cmaMap, _ := cmaData.(map[string]interface{})
	nmcMap, _ := nmcData.(map[string]interface{})

	return map[string]interface{}{
		"data":      BuildWeatherData(mojiMap, todayMap, todayDetailMap, cmaMap, nmcMap, recentDaysData, calendarData, weatherAreaCodeParams),
		"timestamp": time.Now().UnixMilli(),
	}
}

// checkWeatherError 检查天气数据错误
func checkWeatherError(errors *[]string, name string, data interface{}) {
	if m, ok := data.(map[string]interface{}); ok {
		if _, hasError := m["error"]; hasError {
			*errors = append(*errors, fmt.Sprintf("%s: 出错", name))
		}
	}
}

// getStr3 从map中安全获取字符串
func getStr3(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

// GetWeatherData 获取天气数据
func GetWeatherData(weatherAreaCodeParams map[string]interface{}) map[string]interface{} {
	utils.LoggerInstance.Info("GetWeatherData函数被调用")
	if weatherAreaCodeParams == nil {
		utils.LoggerInstance.Error("参数weather_area_code_params不能为空")
		return map[string]interface{}{
			"error": map[string]interface{}{
				"message": "参数weather_area_code_params不能为空",
			},
		}
	}

	utils.LoggerInstance.Info(fmt.Sprintf("USE_MOCK: %v", utils.USE_MOCK))
	// 如果启用了mock数据，直接使用mock数据
	if utils.USE_MOCK {
		mockFilePath := "data/mock/mock_weather_info.json"
		defer func() {
			if r := recover(); r != nil {
				utils.LoggerInstance.Error(fmt.Sprintf("读取mock天气数据失败: %v", r))
			}
		}()
		mockData := utils.CacheUtilInstance.GetWrappedData("mock_weather_info", utils.CacheOptions{
			SourceFile: mockFilePath,
			Permanent:  true,
			TTL:        0,
		})
		if mockData != nil {
			utils.LoggerInstance.Info("使用mock天气数据")
			return mockData.Data.(map[string]interface{})
		}
	}

	utils.LoggerInstance.Info(fmt.Sprintf("天气请求参数: %v", weatherAreaCodeParams))

	// 直接返回与Python项目相同的数据结构
	weatherData := QueryWeatherData(weatherAreaCodeParams)
	utils.LoggerInstance.Info(fmt.Sprintf("天气数据获取结果: %v", weatherData))
	return weatherData
}


