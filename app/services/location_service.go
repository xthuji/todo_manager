package services

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"

	"todolist-go/app/utils"
)

// 全局变量
var areaCodesMap map[string]interface{}
var areaCodesMapOnce sync.Once

// 天气网请求头
var tianqiHeaders = map[string]string{
	"User-Agent":                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:152.0) Gecko/20100101 Firefox/152.0",
	"Accept":                    "*/*",
	"Accept-Language":           "en-US,zh-CN;q=0.9,en;q=0.8",
	"Accept-Encoding":           "gzip, deflate, br, zstd",
	"Connection":                "keep-alive",
	"Referer":                   "https://www.weather.com.cn/",
}

// FindDistrictInfo 递归查找区县信息
func FindDistrictInfo(areaData []interface{}, provinceName, districtName string) map[string]interface{} {
	var result map[string]interface{}

	var search func(data []interface{}, prov, city string)
	search = func(data []interface{}, prov, city string) {
		if result != nil || data == nil {
			return
		}
		for _, item := range data {
			it, _ := item.(map[string]interface{})
			if it == nil {
				continue
			}
			if it["code"] != nil && it["name"] == districtName && prov == provinceName {
				result = map[string]interface{}{
					"code": fmt.Sprintf("%v", it["code"]), "province": prov,
					"city": city, "district": fmt.Sprintf("%v", it["name"]),
				}
				return
			}
			if children, ok := it["children"].([]interface{}); ok {
				if prov == "" {
					search(children, fmt.Sprintf("%v", it["name"]), "")
				} else if city == "" {
					search(children, prov, fmt.Sprintf("%v", it["name"]))
				} else {
					search(children, prov, city)
				}
			}
			if result != nil {
				return
			}
		}
	}
	search(areaData, "", "")
	return result
}

// locGet 简单HTTP GET请求
func locGet(url string) map[string]interface{} {
	client := &http.Client{Timeout: utils.ConfigUtilInstance.GetLocationAPITimeoutDuration()}
	resp, err := client.Get(url)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil
	}
	body, _ := ioutil.ReadAll(resp.Body)
	var data map[string]interface{}
	json.Unmarshal(body, &data)
	return data
}

// GetLocation1 从气象局天气接口获取位置信息
func GetLocation1() map[string]interface{} {
	data := locGet("https://weather.cma.cn/api/weather/view")
	if data == nil {
		return nil
	}

	districtName := ""
	if loc, ok := data["data"].(map[string]interface{}); ok {
		if l, ok := loc["location"].(map[string]interface{}); ok {
			districtName, _ = l["name"].(string)
			if districtName != "" {
				districtName = regexp.MustCompile(`[区县]$`).ReplaceAllString(districtName, "")
			}
		}
	}

	province := "未知省份"
	if loc, ok := data["data"].(map[string]interface{}); ok {
		if l, ok := loc["location"].(map[string]interface{}); ok {
			if path, ok := l["path"].(string); ok {
				parts := strings.Split(path, ",")
				if len(parts) > 1 {
					province = strings.ReplaceAll(strings.TrimSpace(parts[1]), "省", "")
				}
			}
		}
	}

	return map[string]interface{}{"province": province, "city": "未知城市", "district": districtName}
}

// GetLocation2 从天气网API获取位置信息
func GetLocation2() map[string]interface{} {
	url := fmt.Sprintf("https://wgeo.weather.com.cn/ip/?_=%d", time.Now().UnixMilli())
	req, _ := http.NewRequest("GET", url, nil)
	for k, v := range tianqiHeaders {
		req.Header.Set(k, v)
	}

	client := &http.Client{Timeout: utils.ConfigUtilInstance.GetLocationAPITimeoutDuration()}
	resp, err := client.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil
	}

	body, _ := ioutil.ReadAll(resp.Body)

	addrMatch := regexp.MustCompile(`addr="([^"]+)"`).FindStringSubmatch(string(body))

	if len(addrMatch) < 2 {
		return nil
	}

	addr := addrMatch[1]
	parts := strings.Split(addr, ",")

	province, city, district := "未知省份", "未知城市", ""
	if len(parts) >= 1 {
		province = regexp.MustCompile(`[省市]$`).ReplaceAllString(strings.TrimSpace(parts[0]), "")
	}
	if len(parts) >= 2 {
		city = regexp.MustCompile(`[市]$`).ReplaceAllString(strings.TrimSpace(parts[1]), "")
	}
	if len(parts) >= 3 {
		district = regexp.MustCompile(`[区县]$`).ReplaceAllString(strings.TrimSpace(parts[2]), "")
	}

	return map[string]interface{}{"province": province, "city": city, "district": district}
}

// wrapLoc 包装位置数据
func wrapLoc(data map[string]interface{}) map[string]interface{} {
	return map[string]interface{}{
		"data": data, "timestamp": time.Now().UnixMilli(),
		"expired": false, "permanent": false,
	}
}

// GetCurrLocation 根据IP地址获取位置信息
func GetCurrLocation(forceRefresh bool) map[string]interface{} {
	var loc1, loc2 map[string]interface{}
	var wg sync.WaitGroup
	wg.Add(2)
	go func() { defer wg.Done(); loc1 = GetLocation1() }()
	go func() { defer wg.Done(); loc2 = GetLocation2() }()
	wg.Wait()

	addressData := loc2
	if forceRefresh {
		if loc1 != nil {
			addressData = loc1
			utils.LoggerInstance.Info("使用气象局天气接口获取位置信息")
		} else {
			addressData = loc2
			utils.LoggerInstance.Info("使用天气网接口获取位置信息")
		}
	} else {
		if loc2 == nil  {
			addressData = loc1
			utils.LoggerInstance.Info("使用气象局天气接口获取位置信息")
		} else {
			addressData = loc2
			utils.LoggerInstance.Info("使用天气网接口获取位置信息")
		}
	}

	if addressData == nil {
		addressData = utils.GetDefaultLocation()
		utils.LoggerInstance.Info("使用默认位置信息")
	} else {
		utils.LoggerInstance.Info("位置信息", "province", addressData["province"], "city", addressData["city"], "district", addressData["district"])
	}

	// 查找完整的省市县信息
	allAreaCodes := GetAllAreaCodes()
	if allAreaCodes != nil {
		if data, ok := allAreaCodes["data"].([]interface{}); ok {
			prov, _ := addressData["province"].(string)
			district, _ := addressData["district"].(string)
			if prov != "未知省份" && district != "未知区县" {
				if districtInfo := FindDistrictInfo(data, prov, district); districtInfo != nil {
					if v, ok := districtInfo["province"].(string); ok && v != "" {
						addressData["province"] = v
					}
					if v, ok := districtInfo["city"].(string); ok && v != "" {
						addressData["city"] = v
					}
					if v, ok := districtInfo["district"].(string); ok && v != "" {
						addressData["district"] = v
					}
					if v, ok := districtInfo["code"].(string); ok && v != "" {
						addressData["code"] = v
					}
				}
			}
		}
	}

	return addressData
}

// GetLocation 根据IP地址获取位置信息
func GetLocation(clientIP string, forceRefresh bool) map[string]interface{} {
	if utils.USE_MOCK {
		mockData := utils.CacheUtilInstance.GetWrappedData("mock_ip_area", utils.CacheOptions{
			SourceFile: utils.MOCK_DIR + "/mock_ip_area.json",
			Permanent:  true, TTL: 0,
		})
		if mockData != nil && mockData.Data != nil {
			if m, ok := mockData.Data.(map[string]interface{}); ok {
				return m
			}
		}
		return wrapLoc(utils.GetDefaultLocation())
	}

	cacheKey := "ip_" + clientIP
	if forceRefresh {
		newData := GetCurrLocation(forceRefresh)
		utils.CacheUtilInstance.SetData(cacheKey, newData, utils.CacheOptions{TTL: 3600000})
	}

	cachedData := utils.CacheUtilInstance.GetWrappedData(cacheKey, utils.CacheOptions{
		AllowExpired: true, TTL: 3600000,
	})

	if cachedData == nil {
		newData := GetCurrLocation(forceRefresh)
		utils.CacheUtilInstance.SetData(cacheKey, newData, utils.CacheOptions{TTL: 3600000})
		return wrapLoc(newData)
	}

	return map[string]interface{}{
		"data": cachedData.Data, "timestamp": cachedData.Timestamp,
		"expired": cachedData.Expired, "permanent": cachedData.Permanent,
	}
}

// GetAllAreaCodes 获取所有省市县编码数据
func GetAllAreaCodes() map[string]interface{} {
	// 尝试从合并后的文件获取
	mergedFile := utils.WEATHER_DIR + "/merged_weather_area_codes.json"

	// 检查文件是否存在
	if _, err := os.Stat(mergedFile); os.IsNotExist(err) {
		utils.LoggerInstance.Warn("地区编码数据文件不存在或无法读取")
		return map[string]interface{}{
			"data":      []interface{}{},
			"timestamp": time.Now().UnixMilli(),
			"expired":   true,
			"permanent": true,
		}
	}

	// 直接使用缓存工具获取，它会返回包含 expired 和 permanent 字段的结果
	result := utils.CacheUtilInstance.GetWrappedData("merged_weather_area_codes", utils.CacheOptions{
		SourceFile: mergedFile,
		Permanent:  true,
		TTL:        0,
	})

	if result != nil {
		// 返回完整的包装数据，包含 expired 和 permanent 字段
		return map[string]interface{}{
			"data":      result.Data,
			"timestamp": result.Timestamp,
			"expired":   result.Expired,
			"permanent": result.Permanent,
		}
	}

	// 如果文件不存在或读取失败
	utils.LoggerInstance.Warn("地区编码数据文件读取失败")
	return map[string]interface{}{
		"data":      []interface{}{},
		"timestamp": time.Now().UnixMilli(),
		"expired":   true,
		"permanent": true,
	}
}

// GetDistrictAreaCodes 获取区县对应的各种天气区域编码数据
func GetDistrictAreaCodes(areaCode string) map[string]interface{} {
	areaCodesMapOnce.Do(func() {
		areaCodesMap = make(map[string]interface{})
		allAreaCodes := GetAllAreaCodes()
		if allAreaCodes == nil {
			return
		}
		data, _ := allAreaCodes["data"].([]interface{})
		for _, item := range data {
			itemMap, _ := item.(map[string]interface{})
			if children, ok := itemMap["children"].([]interface{}); ok {
				for _, child := range children {
					childMap, _ := child.(map[string]interface{})
					if grandchildren, ok := childMap["children"].([]interface{}); ok {
						for _, leaf := range grandchildren {
							leafMap, _ := leaf.(map[string]interface{})
							code := getStr(leafMap, "code")
							if code == "" {
								continue
							}
							mojiCode := getStr(leafMap, "mojiCode")
							nmcCode := getStr(leafMap, "nmcCode")
							nmcNameCode := getStr(leafMap, "nmcNameCode")
							cmaCode := getStr(leafMap, "cmaCode")
							areaCodesMap[code] = map[string]interface{}{
								"mojiAreaCode": fmt.Sprintf("%s/%s", getStr(itemMap, "mojiCode"), mojiCode),
								"nmcApiCode":   nmcCode,
								"nmcAreaCode":  fmt.Sprintf("%s/%s", getStr(itemMap, "nmcCode"), nmcNameCode),
								"cmaAreaCode":  cmaCode,
								"areaName":     getStr(leafMap, "name"),
							}
						}
					} else {
						code := getStr(childMap, "code")
						if code == "" {
							continue
						}
						areaCodesMap[code] = map[string]interface{}{
							"mojiAreaCode": getStr(childMap, "mojiCode"),
							"nmcAreaCode":  getStr(childMap, "nmcCode"),
							"cmaAreaCode":  getStr(childMap, "cmaCode"),
							"areaName":     getStr(childMap, "name"),
						}
					}
				}
			} else {
				code := getStr(itemMap, "code")
				if code == "" {
					continue
				}
				areaCodesMap[code] = map[string]interface{}{
					"mojiAreaCode": getStr(itemMap, "mojiCode"),
					"nmcAreaCode":  getStr(itemMap, "nmcCode"),
					"cmaAreaCode":  getStr(itemMap, "cmaCode"),
					"areaName":     getStr(itemMap, "name"),
				}
			}
		}
	})

	if areaCodeMap, ok := areaCodesMap[areaCode].(map[string]interface{}); ok {
		return areaCodeMap
	}
	return map[string]interface{}{"areaName": ""}
}