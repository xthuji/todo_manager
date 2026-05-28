package weather

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"todolist-go/app/utils"

	"github.com/PuerkitoBio/goquery"
)

// 天气网请求头
var tianqiHeaders = map[string]string{
	"User-Agent":                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	"Accept":                    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
	"Accept-Language":           "zh-CN,zh;q=0.9,en;q=0.8",
	"Connection":                "keep-alive",
	"Upgrade-Insecure-Requests": "1",
}

// 40天天气预报中的天气代码映射
var calendarWeatherMap = map[int]string{
	0: "晴", 1: "多云", 2: "阴", 3: "阵雨", 4: "雷阵雨", 5: "雷阵雨伴有冰雹",
	6: "雨夹雪", 7: "小雨", 8: "中雨", 9: "大雨",
	10: "暴雨", 11: "大暴雨", 12: "特大暴雨", 13: "阵雪", 14: "小雪",
	15: "中雪", 16: "大雪", 17: "暴雪", 18: "雾", 19: "冻雨",
	20: "沙尘暴", 21: "小到中雨", 22: "中到大雨", 23: "大到暴雨",
	24: "暴雨到大暴雨", 25: "大暴雨到特大暴雨", 26: "小到中雪",
	27: "中到大雪", 28: "大到暴雪", 29: "浮尘", 30: "扬沙",
	31: "强沙尘暴", 53: "霾", 99: "无", 32: "浓雾", 49: "强浓雾",
	54: "中度霾", 55: "重度霾", 56: "严重霾", 57: "大雾", 58: "特强浓雾",
	301: "雨", 302: "雪",
}

// GetCalendarWeatherByCode 根据天气代码获取天气状况
func GetCalendarWeatherByCode(code1, code2 string) string {
	if code1 == "" && code2 == "" {
		return ""
	}
	weather1, weather2 := "", ""
	if code1 != "" {
		if code, err := strconv.Atoi(code1); err == nil {
			if w, exists := calendarWeatherMap[code]; exists {
				weather1 = w
			}
		}
	}
	if code2 != "" {
		if code, err := strconv.Atoi(code2); err == nil {
			if w, exists := calendarWeatherMap[code]; exists {
				weather2 = w
			}
		}
	}
	if weather1 != "" && weather2 != "" {
		return fmt.Sprintf("%s转%s", weather1, weather2)
	}
	if weather1 != "" {
		return weather1
	}
	return weather2
}

// makeError 创建错误响应
func makeError(message string) map[string]interface{} {
	return map[string]interface{}{"error": map[string]interface{}{"message": message}}
}

// httpGet 简化HTTP请求
func httpGet(url string, headers map[string]string) (string, error) {
	client := &http.Client{Timeout: utils.ConfigUtilInstance.GetWeatherAPITimeoutDuration()}
	req, _ := http.NewRequest("GET", url, nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("HTTP响应状态码: %d", resp.StatusCode)
	}
	body, _ := ioutil.ReadAll(resp.Body)
	return string(body), nil
}

// ExtractTodayWeatherData 提取今日天气数据
func ExtractTodayWeatherData(html string) map[string]interface{} {
	weatherData := map[string]interface{}{
		"liveWeather":   map[string]interface{}{},
		"hourlyWeather": []interface{}{},
		"lifeHelper":    []interface{}{},
	}

	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		utils.LoggerInstance.Error("解析HTML失败: %v", err)
		return weatherData
	}

	// 从js脚本中获取实时天气和逐小时预报
	scriptElem := doc.Find(".L_weather > script:nth-child(3)")
	if scriptElem.Length() > 0 {
		scriptContent := scriptElem.Text()
		if scriptContent != "" {
			reForecast1h := regexp.MustCompile(`var forecast_1h\s?=\s?(\[.*?\]);`)
			reForecastDefault := regexp.MustCompile(`var forecast_default\s?=\s?(\{.*?\});`)

			// 解析forecast_default
			if match := reForecastDefault.FindStringSubmatch(scriptContent); len(match) > 1 {
				var forecastDefault map[string]interface{}
				if err := json.Unmarshal([]byte(match[1]), &forecastDefault); err == nil {
					weatherData["liveWeather"] = map[string]interface{}{
						"time":        getStringVal(forecastDefault, "time"),
						"weather":     getStringVal(forecastDefault, "weather"),
						"temperature": getStringVal(forecastDefault, "temp"),
						"tempMin":     getStringVal(forecastDefault, "minTemp"),
						"tempMax":     getStringVal(forecastDefault, "maxTemp"),
						"wind":        getStringVal(forecastDefault, "wind"),
						"humidity":    getStringVal(forecastDefault, "humidity"),
					}
				}
			}

			// 解析forecast_1h
			if match := reForecast1h.FindStringSubmatch(scriptContent); len(match) > 1 {
				var forecast1h []map[string]interface{}
				if err := json.Unmarshal([]byte(match[1]), &forecast1h); err == nil {
					hourlyList := []interface{}{}
					for _, item := range forecast1h {
						// temperature保留原始类型（int或float64），与Python保持一致
						tempVal := item["temp"]
						if tempVal == nil {
							tempVal = ""
						}
						hourlyList = append(hourlyList, map[string]interface{}{
							"hour":        getStringVal(item, "time"),
							"weather":     getStringVal(item, "weather"),
							"temperature": tempVal,
							"wind":        fmt.Sprintf("%s %s", getStringVal(item, "windD"), getStringVal(item, "windL")),
						})
					}
					weatherData["hourlyWeather"] = hourlyList
				}
			}
		}
	}

	// 从页面中获取生活助手数据
	lifeTitleElem := doc.Find("div.weather_shzs_1d > ul > li")
	lifeValueElem := doc.Find("div.weather_shzs_1d > div.lv > dl")
	for i := 0; i < lifeTitleElem.Length() && i < lifeValueElem.Length(); i++ {
		titleElem := lifeTitleElem.Eq(i)
		valueElem := lifeValueElem.Eq(i)
		title := ""
		if h2 := titleElem.Find("h2"); h2.Length() > 0 {
			title = strings.TrimSpace(h2.Text())
		}
		value := ""
		if em := valueElem.Find("em"); em.Length() > 0 {
			value = strings.TrimSpace(em.Text())
		}
		desc := ""
		if dd := valueElem.Find("dd"); dd.Length() > 0 {
			desc = strings.TrimSpace(dd.Text())
		}
		weatherData["lifeHelper"] = append(weatherData["lifeHelper"].([]interface{}), map[string]interface{}{
			"title": title, "value": value, "desc": desc,
		})
	}

	return weatherData
}

// FetchTodayWeather 获取今日天气数据
func FetchTodayWeather(weatherCode string) interface{} {
	if weatherCode == "" {
		return makeError("参数weather_code为空，无法获取今日天气数据")
	}
	url := fmt.Sprintf("https://forecast.weather.com.cn/town/weather1dn/%s.shtml", weatherCode)
	utils.LoggerInstance.Info("开始获取今日天气数据，正在访问: %s", url)
	content, err := httpGet(url, tianqiHeaders)
	if err != nil {
		utils.LoggerInstance.Error("获取今日天气数据失败: %v", err)
		return makeError(fmt.Sprintf("获取今日天气数据失败: %v", err))
	}
	utils.LoggerInstance.Info("成功提取今日天气数据")
	return ExtractTodayWeatherData(content)
}

// ExtractTodayDetailWeatherData 提取今日天气补充数据
func ExtractTodayDetailWeatherData(html string) map[string]interface{} {
	weatherData := map[string]interface{}{}
	reContent := regexp.MustCompile(`var dataSK\s?=\s?(\{.*?\});?`)
	if match := reContent.FindStringSubmatch(html); len(match) > 1 {
		var detail map[string]interface{}
		if err := json.Unmarshal([]byte(match[1]), &detail); err == nil {
			weatherData = map[string]interface{}{
				"time":        getStringVal(detail, "time"),
				"weather":     getStringVal(detail, "weather"),
				"temperature": getStringVal(detail, "temp"),
				"wind":        fmt.Sprintf("%s %s", getStringVal(detail, "WD"), getStringVal(detail, "WS")),
				"humidity":    getStringVal(detail, "sd"),
				"airQuality":  getStringVal(detail, "aqi_pm25"),
				"visibility":  getStringVal(detail, "njd"),
				"limit":       getStringVal(detail, "limitnumber"),
			}
		}
	}
	return weatherData
}

// FetchTodayDetailWeather 获取今日天气补充数据
func FetchTodayDetailWeather(weatherCode string) interface{} {
	if weatherCode == "" {
		return makeError("参数weather_code为空，无法获取今日天气补充数据")
	}
	timestamp := time.Now().UnixMilli()
	url := fmt.Sprintf("https://d1.weather.com.cn/sk_2d/%s.html?_=%d", weatherCode, timestamp)
	utils.LoggerInstance.Info("开始获取今日天气补充数据，正在访问: %s", url)
	headers := make(map[string]string)
	for k, v := range tianqiHeaders {
		headers[k] = v
	}
	headers["Referer"] = "https://www.weather.com.cn/"
	content, err := httpGet(url, headers)
	if err != nil {
		utils.LoggerInstance.Error("获取今日天气补充数据失败: %v", err)
		return makeError(fmt.Sprintf("获取今日天气补充数据失败: %v", err))
	}
	utils.LoggerInstance.Info("成功提取今日天气补充数据")
	return ExtractTodayDetailWeatherData(content)
}

// ExtractRecentDaysWeatherData 提取近几日天气数据
func ExtractRecentDaysWeatherData(html string) []interface{} {
	weatherData := []interface{}{}
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		utils.LoggerInstance.Error("解析HTML失败: %v", err)
		return weatherData
	}

	today := time.Now()
	forecastItems := doc.Find(`div[id="7d"] ul li`)
	for i := 0; i < forecastItems.Length(); i++ {
		date := today.AddDate(0, 0, i)
		dateStr := fmt.Sprintf("%d%02d%02d", date.Year(), date.Month(), date.Day())
		dayStr := fmt.Sprintf("%02d", date.Day())
		item := forecastItems.Eq(i)

		pageDateStr := ""
		if h1 := item.Find("h1"); h1.Length() > 0 {
			re := regexp.MustCompile(`\D`)
			pageDateStr = re.ReplaceAllString(strings.TrimSpace(h1.Text()), "")
		}
		pageDateStrPadded := fmt.Sprintf("%02d", atoiOrZero(pageDateStr))
		if pageDateStr != "" && pageDateStr != fmt.Sprintf("%d", date.Day()) && pageDateStr != dayStr && pageDateStrPadded != dayStr {
			continue
		}

		weather := ""
		if elem := item.Find(".wea"); elem.Length() > 0 {
			weather = strings.TrimSpace(elem.Text())
		}
		tempMax := ""
		if elem := item.Find(".tem span"); elem.Length() > 0 {
			tempMax = strings.ReplaceAll(strings.TrimSpace(elem.Text()), "℃", "")
		}
		tempMin := ""
		if elem := item.Find(".tem i"); elem.Length() > 0 {
			tempMin = strings.ReplaceAll(strings.TrimSpace(elem.Text()), "℃", "")
		}
		windDir := ""
		if elem := item.Find(".win em span:first-child"); elem.Length() > 0 {
			windDir = strings.TrimSpace(elem.AttrOr("title", ""))
		}
		windSpeed := ""
		if elem := item.Find(".win i"); elem.Length() > 0 {
			windSpeed = strings.TrimSpace(elem.Text())
		}

		weatherData = append(weatherData, map[string]interface{}{
			"date": dateStr, "weather": weather, "tempMin": tempMin, "tempMax": tempMax,
			"wind": fmt.Sprintf("%s %s", windDir, windSpeed),
		})
		if len(weatherData) >= 7 {
			break
		}
	}
	return weatherData
}

// FetchRecentDaysWeather 获取近几日天气数据
func FetchRecentDaysWeather(weatherCode string) interface{} {
	if weatherCode == "" {
		return makeError("参数weather_code为空，无法获取近几日天气数据")
	}
	url := fmt.Sprintf("https://www.weather.com.cn/weather/%s.shtml", weatherCode)
	utils.LoggerInstance.Info("开始获取近几日天气数据，正在访问: %s", url)
	content, err := httpGet(url, tianqiHeaders)
	if err != nil {
		utils.LoggerInstance.Error("获取近几日天气数据失败: %v", err)
		return makeError(fmt.Sprintf("获取近几日天气数据失败: %v", err))
	}
	utils.LoggerInstance.Info("成功提取近几日天气数据")
	return ExtractRecentDaysWeatherData(content)
}

// ExtractCalendarAndHistoryWeatherData 提取日历和历史天气数据
func ExtractCalendarAndHistoryWeatherData(html string) []interface{} {
	weatherData := []interface{}{}
	reHistory := regexp.MustCompile(`var fc40\s?=\s?(\[.*?\]);?`)
	if match := reHistory.FindStringSubmatch(html); len(match) > 1 {
		var fc40 []map[string]interface{}
		if err := json.Unmarshal([]byte(match[1]), &fc40); err == nil {
			currentDate := time.Now()
			currMonthStr := fmt.Sprintf("%d%02d", currentDate.Year(), currentDate.Month())
			nextMonth := int(currentDate.Month()) + 1
			nextYear := currentDate.Year()
			if nextMonth > 12 {
				nextMonth = 1
				nextYear++
			}
			nextMonthStr := fmt.Sprintf("%d%02d", nextYear, nextMonth)

			for _, item := range fc40 {
				date := getStringVal(item, "date")
				if date > currMonthStr && date < nextMonthStr {
					c1 := getStringVal(item, "c1")
					c2 := getStringVal(item, "c2")
					w1 := getStringVal(item, "w1")
					weather := w1
					if weather == "" {
						weather = GetCalendarWeatherByCode(c1, c2)
					}
					weatherData = append(weatherData, map[string]interface{}{
						"date": date, "weather": weather, "wind": getStringVal(item, "wd1"),
						"historyTempMin": getStringVal(item, "hmin"), "historyTempMax": getStringVal(item, "hmax"),
						"realTempMin": getStringVal(item, "minobs"), "realTempMax": getStringVal(item, "maxobs"),
						"tempMin": getStringVal(item, "min"), "tempMax": getStringVal(item, "max"),
					})
				}
			}
		}
	}
	return weatherData
}

// FetchCalendarAndHistoryWeather 获取日历和历史天气数据
func FetchCalendarAndHistoryWeather(weatherCode string) interface{} {
	if weatherCode == "" {
		return makeError("参数weather_code为空，无法获取日历和历史天气数据")
	}
	now := time.Now()
	yearMonth := fmt.Sprintf("%d%02d", now.Year(), now.Month())
	timestamp := now.UnixMilli()
	url := fmt.Sprintf("https://d1.weather.com.cn/calendarFromMon/%d/%s_%s.html?_=%d", now.Year(), weatherCode, yearMonth, timestamp)
	utils.LoggerInstance.Info("开始获取天气历史数据，正在访问: %s", url)
	headers := make(map[string]string)
	for k, v := range tianqiHeaders {
		headers[k] = v
	}
	headers["Referer"] = "https://www.weather.com.cn/"
	content, err := httpGet(url, headers)
	if err != nil {
		utils.LoggerInstance.Error("获取天气历史数据失败: %v", err)
		return makeError(fmt.Sprintf("获取天气历史数据失败: %v", err))
	}
	utils.LoggerInstance.Info("成功提取天气历史数据")
	return ExtractCalendarAndHistoryWeatherData(content)
}

// getStringVal 从map中安全地获取字符串值
func getStringVal(m map[string]interface{}, key string) string {
	if val, exists := m[key]; exists && val != nil {
		switch v := val.(type) {
		case string:
			return strings.TrimSpace(v)
		case float64:
			return fmt.Sprintf("%v", v)
		case int:
			return fmt.Sprintf("%d", v)
		}
	}
	return ""
}

// atoiOrZero 将字符串转换为整数，失败返回0
func atoiOrZero(s string) int {
	var n int
	fmt.Sscanf(s, "%d", &n)
	return n
}
