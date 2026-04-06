package weather

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
	"time"

	"todolist-go/app/utils"

	"github.com/PuerkitoBio/goquery"
)

// 墨迹天气请求头
var mojiHeaders = map[string]string{
	"User-Agent":                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	"Accept":                    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
	"Accept-Language":           "zh-CN,zh;q=0.9,en;q=0.8",
	"Connection":                "keep-alive",
	"Upgrade-Insecure-Requests": "1",
}

// FetchMojiWeather 获取墨迹天气数据
func FetchMojiWeather(mojiAreaCode string) interface{} {
	if mojiAreaCode == "" {
		return nil
	}

	weatherURL := fmt.Sprintf("https://tianqi.moji.com/weather/china/%s", mojiAreaCode)
	utils.LoggerInstance.Info("开始获取墨迹天气数据，正在访问: %s", weatherURL)

	client := &http.Client{Timeout: 5 * time.Second}
	req, _ := http.NewRequest("GET", weatherURL, nil)
	for k, v := range mojiHeaders {
		req.Header.Set(k, v)
	}

	resp, err := client.Do(req)
	if err != nil {
		utils.LoggerInstance.Error("获取墨迹天气数据失败: %v", err)
		return map[string]interface{}{"error": fmt.Sprintf("获取墨迹天气数据失败: %v", err)}
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		errMsg := fmt.Sprintf("HTTP响应状态码: %d", resp.StatusCode)
		utils.LoggerInstance.Error("获取墨迹天气数据失败: %s", errMsg)
		return map[string]interface{}{"error": errMsg}
	}

	body, _ := ioutil.ReadAll(resp.Body)
	utils.LoggerInstance.Info("成功提取墨迹天气数据")
	return ExtractMojiWeatherData(string(body))
}

// ExtractMojiWeatherData 提取墨迹天气数据
func ExtractMojiWeatherData(html string) map[string]interface{} {
	weatherData := map[string]interface{}{
		"liveWeather":     map[string]interface{}{},
		"calendarWeather": []interface{}{},
	}

	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		utils.LoggerInstance.Error("解析墨迹天气HTML失败: %v", err)
		return weatherData
	}

	// 1. 提取今日实时天气
	tempRange := []string{}
	forecastDays := doc.Find(".forecast .days:nth-child(2) > li:nth-child(3)")
	if forecastDays.Length() > 0 {
		text := strings.ReplaceAll(strings.TrimSpace(forecastDays.First().Text()), "°", "")
		if text != "" {
			tempRange = strings.Split(text, "/")
		}
	}

	timeStr := ""
	if elem := doc.Find(".wea_info .wea_weather .info_uptime"); elem.Length() > 0 {
		timeStr = strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(elem.First().Text(), "今天", ""), "更新", ""))
	}

	weather := ""
	if elem := doc.Find(".wea_weather > b"); elem.Length() > 0 {
		weather = strings.TrimSpace(elem.First().Text())
	}

	temperature := ""
	if elem := doc.Find(".wea_info .wea_weather em"); elem.Length() > 0 {
		temperature = strings.ReplaceAll(strings.TrimSpace(elem.First().Text()), "°", "")
	}

	wind := ""
	if elem := doc.Find(".wea_info .wea_about em"); elem.Length() > 0 {
		wind = strings.TrimSpace(elem.First().Text())
	}

	humidity := ""
	if elem := doc.Find(".wea_info .wea_about span"); elem.Length() > 0 {
		humidity = strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(elem.First().Text(), "湿度：", ""), "湿度", ""))
	}

	airQuality := ""
	if elem := doc.Find(".wea_info .wea_alert em"); elem.Length() > 0 {
		airQuality = strings.TrimSpace(elem.First().Text())
	}

	tips := ""
	if elem := doc.Find(".wea_info .wea_tips em"); elem.Length() > 0 {
		tips = strings.TrimSpace(elem.First().Text())
	}

	liveWeather := map[string]interface{}{
		"time": timeStr, "weather": weather, "temperature": temperature,
		"tempMin": "", "tempMax": "", "wind": wind, "humidity": humidity,
		"airQuality": airQuality, "tips": tips,
	}
	if len(tempRange) > 0 {
		liveWeather["tempMin"] = strings.TrimSpace(tempRange[0])
		if len(tempRange) > 1 {
			liveWeather["tempMax"] = strings.TrimSpace(tempRange[1])
		}
	}
	weatherData["liveWeather"] = liveWeather

	// 2. 提取天气日历
	yearMonthStr := time.Now().Format("200601")
	calendarList := []interface{}{}
	doc.Find("#calendar_grid > ul > li").Each(func(i int, el *goquery.Selection) {
		dayElem := el.Find("em")
		if dayStr := strings.TrimSpace(dayElem.Text()); dayStr != "" {
			tempMin, tempMax := "", ""
			if elem := el.Find("p:nth-child(3)"); elem.Length() > 0 {
				text := strings.ReplaceAll(strings.TrimSpace(elem.Text()), "°", "")
				parts := strings.Split(text, "/")
				if len(parts) > 0 {
					tempMin = strings.TrimSpace(parts[0])
				}
				if len(parts) > 1 {
					tempMax = strings.TrimSpace(parts[1])
				}
			}
			weatherStr := ""
			if img := el.Find("b img"); img.Length() > 0 {
				if alt, exists := img.First().Attr("alt"); exists {
					weatherStr = strings.TrimSpace(alt)
				}
			}
			windStr := ""
			if elem := el.Find("p:nth-child(4)"); elem.Length() > 0 {
				windStr = strings.TrimSpace(elem.Text())
			}
			if len(dayStr) == 1 {
				dayStr = "0" + dayStr
			}
			calendarList = append(calendarList, map[string]interface{}{
				"date": fmt.Sprintf("%s%s", yearMonthStr, dayStr),
				"weather": weatherStr, "tempMin": tempMin, "tempMax": tempMax, "wind": windStr,
			})
		}
	})
	weatherData["calendarWeather"] = calendarList

	return weatherData
}
