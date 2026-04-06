package weather

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
	"time"
)

// NMC请求头
var nmcHeaders = map[string]string{
	"User-Agent":      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	"Accept":          "application/json, text/plain, */*",
	"Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
	"Connection":      "keep-alive",
	"Referer":         "https://www.nmc.cn/",
}

// nmcGet 安全获取嵌套map中的值
func nmcGet(data map[string]interface{}, keys ...string) interface{} {
	current := data
	for i, key := range keys {
		if i == len(keys)-1 {
			return current[key]
		}
		if m, ok := current[key].(map[string]interface{}); ok {
			current = m
		} else {
			return nil
		}
	}
	return nil
}

// nmcStr 获取字符串值
func nmcStr(data map[string]interface{}, keys ...string) string {
	if v := nmcGet(data, keys...); v != nil {
		s := fmt.Sprintf("%v", v)
		return strings.ReplaceAll(strings.TrimSpace(s), "9999", "")
	}
	return ""
}

// FetchNMCWeather 获取中央气象台天气数据
func FetchNMCWeather(nmcApiCode string) interface{} {
	if nmcApiCode == "" {
		return map[string]interface{}{"error": map[string]interface{}{"message": "参数nmc_api_code为空，无法获取中央气象台天气数据"}}
	}

	url := fmt.Sprintf("https://www.nmc.cn/rest/weather?stationid=%s&_=%d", nmcApiCode, time.Now().UnixMilli())
	client := &http.Client{Timeout: 5 * time.Second}
	req, _ := http.NewRequest("GET", url, nil)
	for k, v := range nmcHeaders {
		req.Header.Set(k, v)
	}

	resp, err := client.Do(req)
	if err != nil {
		return map[string]interface{}{"error": map[string]interface{}{"message": fmt.Sprintf("获取中央气象台天气数据失败: %v", err)}}
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return map[string]interface{}{"error": map[string]interface{}{"message": fmt.Sprintf("HTTP响应状态码: %d", resp.StatusCode)}}
	}

	body, _ := ioutil.ReadAll(resp.Body)
	var nmcData map[string]interface{}
	if err := json.Unmarshal(body, &nmcData); err != nil {
		return map[string]interface{}{"error": map[string]interface{}{"message": fmt.Sprintf("获取中央气象台天气数据失败: %v", err)}}
	}

	return ExtractNMCWeatherData(nmcData)
}

// ExtractNMCWeatherData 格式化NMC数据为统一格式
func ExtractNMCWeatherData(nmcData map[string]interface{}) map[string]interface{} {
	weatherData := map[string]interface{}{"liveWeather": map[string]interface{}{}, "dailyWeather": []interface{}{}}
	if nmcData == nil {
		return weatherData
	}
	if code, _ := nmcData["code"].(float64); code != 0 {
		return weatherData
	}
	data, _ := nmcData["data"].(map[string]interface{})
	if data == nil {
		return weatherData
	}

	// 提取近几天预报
	dailyList := []interface{}{}
	if detail, ok := nmcGet(data, "predict", "detail").([]interface{}); ok {
		for _, item := range detail {
			it, _ := item.(map[string]interface{})
			if it == nil {
				continue
			}
			date := strings.ReplaceAll(nmcStr(it, "date"), "-", "")
			dailyList = append(dailyList, map[string]interface{}{
				"date":    date,
				"weather": nmcStr(it, "day", "weather", "info"),
				"tempMin": nmcStr(it, "night", "weather", "temperature"),
				"tempMax": nmcStr(it, "day", "weather", "temperature"),
				"wind":    fmt.Sprintf("%s %s", nmcStr(it, "day", "wind", "direct"), nmcStr(it, "day", "wind", "power")),
			})
			if len(dailyList) >= 7 {
				break
			}
		}
	}
	weatherData["dailyWeather"] = dailyList

	// 实况天气
	real := data
	if r, ok := data["real"].(map[string]interface{}); ok {
		real = r
	}

	timeStr := ""
	if pubTime, ok := real["publish_time"].(string); ok {
		parts := strings.Split(strings.TrimSpace(pubTime), " ")
		if len(parts) > 1 {
			timeStr = parts[1]
		}
	}

	sunrise, sunset := "", ""
	if ss, ok := real["sunriseSunset"].(map[string]interface{}); ok {
		if t, ok := ss["sunrise"].(string); ok {
			parts := strings.Split(strings.TrimSpace(t), " ")
			if len(parts) > 1 {
				sunrise = parts[1]
			}
		}
		if t, ok := ss["sunset"].(string); ok {
			parts := strings.Split(strings.TrimSpace(t), " ")
			if len(parts) > 1 {
				sunset = parts[1]
			}
		}
	}

	airQuality := ""
	if air, ok := data["air"].(map[string]interface{}); ok {
		aqi := fmt.Sprintf("%v", air["aqi"])
		text, _ := air["text"].(string)
		if text != "" {
			airQuality = fmt.Sprintf("%s %s", aqi, text)
		} else {
			airQuality = aqi
		}
	}

	tempMax, tempMin := "", ""
	if len(dailyList) > 0 {
		if d, ok := dailyList[0].(map[string]interface{}); ok {
			tempMax = fmt.Sprintf("%v", d["tempMax"])
			tempMin = fmt.Sprintf("%v", d["tempMin"])
		}
	}

	weatherData["liveWeather"] = map[string]interface{}{
		"time":        timeStr,
		"weather":     nmcStr(real, "weather", "info"),
		"temperature": nmcStr(real, "weather", "temperature"),
		"tempMax":     tempMax,
		"tempMin":     tempMin,
		"wind":        fmt.Sprintf("%s %s", nmcStr(real, "wind", "direct"), nmcStr(real, "wind", "power")),
		"humidity":    nmcStr(real, "weather", "humidity"),
		"airQuality":  airQuality,
		"sunrise":     sunrise,
		"sunset":      sunset,
	}
	return weatherData
}
