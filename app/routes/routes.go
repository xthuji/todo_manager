package routes

import (
	"github.com/gin-gonic/gin"
)

// RegisterRoutes 注册所有路由
func RegisterRoutes(router *gin.Engine) {
	RegisterFileRoutes(router)
	RegisterHolidayRoutes(router)
	RegisterFestivalRoutes(router)
	RegisterStatusRoutes(router)
	RegisterWeatherRoutes(router)
}
