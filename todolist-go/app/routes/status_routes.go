package routes

import (
	"net/http"
	"os"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
)

// RegisterStatusRoutes 注册状态相关路由
func RegisterStatusRoutes(router *gin.Engine) {
	statusGroup := router.Group("/api")
	statusGroup.GET("/check-status", checkStatus)
	statusGroup.POST("/shutdown", shutdown)
}

// checkStatus 健康检查接口
func checkStatus(c *gin.Context) {
	c.JSON(http.StatusOK, map[string]interface{}{
		"success": true, "message": "服务正在运行",
	})
}

// shutdown 关闭服务器接口
func shutdown(c *gin.Context) {
	c.JSON(http.StatusOK, map[string]interface{}{
		"success": true, "message": "服务器将在1秒后关闭",
	})
	go func() {
		time.Sleep(1 * time.Second)
		if p, err := os.FindProcess(os.Getpid()); err == nil {
			p.Signal(syscall.SIGINT)
		}
	}()
}
