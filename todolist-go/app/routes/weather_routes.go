package routes

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"todolist-go/app/services"
)

// RegisterWeatherRoutes 注册天气相关路由
func RegisterWeatherRoutes(router *gin.Engine) {
	weatherGroup := router.Group("/api/weather")
	weatherGroup.GET("/ip-location", getIPLocation)
	weatherGroup.GET("/weather-area-codes", getWeatherAreaCodes)
	weatherGroup.GET("/weather-info", getWeatherInfo)
}

// getClientIP 获取客户端IP地址
func getClientIP(c *gin.Context) string {
	if xForwardedFor := c.GetHeader("X-Forwarded-For"); xForwardedFor != "" {
		parts := strings.Split(xForwardedFor, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
		return xForwardedFor
	}
	return c.ClientIP()
}

// getIPLocation 获取IP位置信息接口
func getIPLocation(c *gin.Context) {
	clientIP := getClientIP(c)
	forceRefresh := c.Query("forceRefresh") == "true"
	locationResult := services.GetLocation(clientIP, forceRefresh)
	c.JSON(http.StatusOK, locationResult)
}

// getWeatherAreaCodes 获取天气区域编码接口
func getWeatherAreaCodes(c *gin.Context) {
	areaCodesData := services.GetAllAreaCodes()
	if areaCodesData != nil {
		c.JSON(http.StatusOK, areaCodesData)
		return
	}
	c.JSON(http.StatusOK, map[string]interface{}{
		"data": []interface{}{}, "timestamp": time.Now().UnixMilli(),
		"expired": true, "permanent": true,
	})
}

// getWeatherInfo 获取天气数据接口
func getWeatherInfo(c *gin.Context) {
	weatherCode := c.Query("weatherCode")
	forceRefresh := c.Query("forceRefresh") == "true"

	if weatherCode == "" {
		c.JSON(http.StatusBadRequest, map[string]interface{}{"error": "缺少weatherCode参数"})
		return
	}

	districtAreaCode := services.GetDistrictAreaCodes(weatherCode)
	weatherParams := map[string]interface{}{
		"weatherCode": weatherCode, "forceRefresh": forceRefresh,
	}
	for k, v := range districtAreaCode {
		weatherParams[k] = v
	}

	weatherData := services.GetWeatherData(weatherParams)
	c.JSON(http.StatusOK, weatherData)
}
