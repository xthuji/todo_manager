package routes

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"todolist-go/app/utils"
)

// RegisterFestivalRoutes 注册节日相关路由
func RegisterFestivalRoutes(router *gin.Engine) {
	festivalGroup := router.Group("/api/festival")
	festivalGroup.GET("/config", getFestivalConfig)
	festivalGroup.POST("/save", saveFestivalConfig)
}

// getFestivalConfig 获取节日配置接口
func getFestivalConfig(c *gin.Context) {
	config := utils.ConfigUtilInstance.GetConfig("festival", map[string]interface{}{})
	if len(config) > 0 {
		c.JSON(http.StatusOK, map[string]interface{}{
			"data": config, "timestamp": time.Now().UnixMilli(), "error": nil,
		})
		return
	}
	c.JSON(http.StatusNotFound, map[string]interface{}{
		"data": nil, "timestamp": time.Now().UnixMilli(),
		"error": map[string]interface{}{"message": "节日配置文件不存在或无法读取"},
	})
}

// saveFestivalConfig 保存节日配置接口
func saveFestivalConfig(c *gin.Context) {
	var configData map[string]interface{}
	if err := c.ShouldBindJSON(&configData); err != nil || configData == nil {
		c.JSON(http.StatusBadRequest, map[string]interface{}{
			"data": nil, "timestamp": time.Now().UnixMilli(),
			"error": map[string]interface{}{"message": "配置数据格式无效"},
		})
		return
	}

	// 验证festivals字段
	festivals, hasFestivals := configData["festivals"]
	if !hasFestivals || festivals == nil {
		c.JSON(http.StatusBadRequest, map[string]interface{}{
			"data": nil, "timestamp": time.Now().UnixMilli(),
			"error": map[string]interface{}{"message": "festivals字段必须存在"},
		})
		return
	}
	if _, ok := festivals.([]interface{}); !ok {
		c.JSON(http.StatusBadRequest, map[string]interface{}{
			"data": nil, "timestamp": time.Now().UnixMilli(),
			"error": map[string]interface{}{"message": "festivals字段必须是数组"},
		})
		return
	}

	// 保存配置并清除缓存
	if !utils.ConfigUtilInstance.SaveConfig("festival", configData) {
		c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"data": nil, "timestamp": time.Now().UnixMilli(),
			"error": map[string]interface{}{"message": "保存节日配置失败"},
		})
		return
	}

	utils.CacheUtilInstance.Delete("festival_config")
	c.JSON(http.StatusOK, map[string]interface{}{
		"data": map[string]interface{}{"success": true, "message": "节日配置保存成功"},
		"timestamp": time.Now().UnixMilli(),
	})
}
