package routes

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
	"todolist-go/app/utils"
)

// 缓存配置
const (
	defaultHolidayAPIURL = "https://www.shuyz.com/githubfiles/china-holiday-calender/master/holidayAPI.json"
	holidayCacheKey      = "holiday_cache"
	holidayTTL           = 100 * 24 * 3600 * 1000 // 100天（毫秒）
)

var holidayOptions = utils.CacheOptions{
	AllowExpired: true,
	SourceFile:   filepath.Join(utils.ConfigUtilInstance.GetCacheDir(), "holiday_cache.json"),
	TTL:          holidayTTL,
}

// RegisterHolidayRoutes 注册节假日相关路由
func RegisterHolidayRoutes(router *gin.Engine) {
	holidayGroup := router.Group("/api/holiday")
	holidayGroup.GET("/cache", getHolidayCache)
	holidayGroup.POST("/refresh-cache", refreshHolidayCache)
}

// fetchHolidayData 从API获取节假日数据
func fetchHolidayData(apiURL string) (map[string]interface{}, error) {
	utils.LoggerInstance.Info("[节假日服务] 从API获取数据: %s", apiURL)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(apiURL)
	if err != nil {
		return nil, fmt.Errorf("API请求失败: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API响应错误: %d", resp.StatusCode)
	}

	body, _ := ioutil.ReadAll(resp.Body)
	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, fmt.Errorf("解析API响应失败: %v", err)
	}
	if data == nil {
		return nil, fmt.Errorf("获取到的节假日数据为空")
	}
	utils.LoggerInstance.Info("[节假日服务] 成功获取数据")
	return data, nil
}

// clearHolidayCache 清除节假日缓存
func clearHolidayCache() {
	utils.CacheUtilInstance.Delete(holidayCacheKey)
	utils.LoggerInstance.Info("[节假日服务] 缓存已清除")
}

// getHolidayData 获取节假日数据
func getHolidayData(apiURL string) (map[string]interface{}, error) {
	loadDataFn := func() (interface{}, error) {
		utils.LoggerInstance.Info("[节假日服务] 缓存未命中或需要更新，从API获取数据")
		return fetchHolidayData(apiURL)
	}

	options := utils.CacheOptions{
		AllowExpired: true,
		SourceFile:   holidayOptions.SourceFile,
		TTL:          holidayTTL,
		LoadDataFn:   loadDataFn,
	}

	wrappedData := utils.CacheUtilInstance.GetWrappedData(holidayCacheKey, options)
	if wrappedData == nil {
		return nil, fmt.Errorf("无法获取节假日数据")
	}

	if wrappedData.Expired {
		utils.LoggerInstance.Warning("[节假日服务] 使用过期缓存数据")
	}

	now := time.Now().UnixMilli()
	expireAt := wrappedData.Timestamp + holidayTTL
	if wrappedData.Expired {
		expireAt = now
	}

	return map[string]interface{}{
		"data": wrappedData.Data, "timestamp": wrappedData.Timestamp,
		"apiUrl": apiURL, "expireAt": expireAt,
	}, nil
}

// getHolidayCache 获取节假日缓存接口
func getHolidayCache(c *gin.Context) {
	holidayData, err := getHolidayData(defaultHolidayAPIURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"data": nil, "timestamp": time.Now().UnixMilli(),
			"error": map[string]interface{}{"message": "获取节假日数据失败", "details": err.Error()},
		})
		return
	}
	c.JSON(http.StatusOK, holidayData)
}

// refreshHolidayCache 刷新节假日缓存接口
func refreshHolidayCache(c *gin.Context) {
	var req struct{ ApiURL string `json:"apiUrl"` }
	c.ShouldBindJSON(&req)
	finalAPIURL := req.ApiURL
	if finalAPIURL == "" {
		finalAPIURL = defaultHolidayAPIURL
	}

	clearHolidayCache()
	cacheData, err := getHolidayData(finalAPIURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false, "message": "刷新节假日缓存失败", "error": err.Error(),
		})
		return
	}

	cacheData["success"] = true
	cacheData["message"] = "节假日缓存刷新成功"
	c.JSON(http.StatusOK, cacheData)
}
