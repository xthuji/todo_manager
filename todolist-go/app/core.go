package app

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"todolist-go/app/routes"
	"todolist-go/app/services"
	"todolist-go/app/utils"
)

// App Flask应用结构体 (对应Python的Flask app)
type App struct {
	Router    *gin.Engine
	StaticDir string
	Port      int
}

// NewApp 创建新的应用实例
func NewApp() *App {
	// 获取配置 (读取Go项目端口)
	port := 3002
	if configValue := utils.ConfigUtilInstance.GetConfigValue("app", "server.ports.go", 3002); configValue != nil {
		if p, ok := configValue.(float64); ok {
			port = int(p)
		}
	}

	// 静态文件目录
	staticDir := filepath.Join(utils.ConfigUtilInstance.GetProjectRoot(), "static")

	return &App{
		Router:    gin.Default(),
		StaticDir: staticDir,
		Port:      port,
	}
}

// Setup 配置应用
func (a *App) Setup() {
	// 打印静态文件目录路径（调试用）
	utils.LoggerInstance.Info("静态文件目录: %s", a.StaticDir)
	if _, err := os.Stat(a.StaticDir); os.IsNotExist(err) {
		utils.LoggerInstance.Warning("静态文件目录不存在: %s", a.StaticDir)
	} else {
		utils.LoggerInstance.Info("静态文件目录存在")
	}

	// 配置CORS
	a.Router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Origin, Content-Type, Accept")
		c.Writer.Header().Set("Access-Control-Expose-Headers", "Content-Length")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// 注册路由
	routes.RegisterRoutes(a.Router)

	// 页面路由（必须在静态文件路由之前注册）
	a.Router.GET("/", a.serveIndex)
	a.Router.GET("/pages/:filename", a.servePage)
	a.Router.GET("/:filename", a.servePageWithExt)

	// 为了兼容前端页面的请求路径，添加src/client/pages路由
	a.Router.GET("/src/client/pages/:filename", a.serveClientPage)

	// 静态文件处理
	a.Router.Static("/static", a.StaticDir)

	// 为了兼容前端页面的请求路径，添加assets路由
	a.Router.Static("/assets", a.StaticDir)

	// 为了兼容前端页面的请求路径，添加src/client/assets路由
	a.Router.Static("/src/client/assets", a.StaticDir)

	// 设置服务器实例到status_routes
	// 注意: Go的gin.Engine不能直接shutdown,需要通过http.Server来控制
}

// serveIndex 首页路由
func (a *App) serveIndex(c *gin.Context) {
	indexFile := filepath.Join(a.StaticDir, "pages", "index.html")
	// 检查文件是否存在
	if _, err := os.Stat(indexFile); os.IsNotExist(err) {
		c.String(http.StatusNotFound, "Index file not found: %s", indexFile)
		return
	}
	c.File(indexFile)
}

// servePage 页面路由（不带扩展名）
func (a *App) servePage(c *gin.Context) {
	filename := c.Param("filename")
	pageFile := filepath.Join(a.StaticDir, "pages", fmt.Sprintf("%s.html", filename))
	// 检查文件是否存在
	if _, err := os.Stat(pageFile); os.IsNotExist(err) {
		c.String(http.StatusNotFound, "Page not found: %s", pageFile)
		return
	}
	c.File(pageFile)
}

// servePageWithExt 页面路由（带扩展名，如 .html）
func (a *App) servePageWithExt(c *gin.Context) {
	filename := c.Param("filename")
	// 如果文件名不包含扩展名，自动添加.html
	pageFile := filepath.Join(a.StaticDir, "pages", filename)
	if !strings.HasSuffix(filename, ".html") {
		pageFile = filepath.Join(a.StaticDir, "pages", fmt.Sprintf("%s.html", filename))
	}
	// 检查文件是否存在
	if _, err := os.Stat(pageFile); os.IsNotExist(err) {
		c.String(http.StatusNotFound, "Page not found: %s", pageFile)
		return
	}
	c.File(pageFile)
}

// serveClientPage 客户端页面路由
func (a *App) serveClientPage(c *gin.Context) {
	filename := c.Param("filename")
	c.File(filepath.Join(a.StaticDir, "pages", fmt.Sprintf("%s.html", filename)))
}

// StartServer 启动服务器
func (a *App) StartServer() error {
	utils.LoggerInstance.Info("启动Python服务器, 端口: %d", a.Port)

	// 启动天气通知定时器
	go services.StartWeatherNotifyTimer()

	// 启动HTTP服务器
	return a.Router.Run(fmt.Sprintf(":%d", a.Port))
}

// GetServer 获取HTTP服务器实例(用于shutdown)
func (a *App) GetServer() *http.Server {
	return &http.Server{
		Addr:    fmt.Sprintf(":%d", a.Port),
		Handler: a.Router,
	}
}

// Shutdown 关闭服务器
func (a *App) Shutdown() {
	utils.LoggerInstance.Info("正在关闭服务器...")
	server := a.GetServer()
	if err := server.Shutdown(nil); err != nil {
		utils.LoggerInstance.Error("关闭服务器失败: %v", err)
	}
}

// 全局应用实例
var appInstance *App

// GetApp 获取全局应用实例
func GetApp() *App {
	if appInstance == nil {
		// 初始化常量（确保在ConfigUtilInstance初始化后调用）
		utils.InitConstants()
		appInstance = NewApp()
		appInstance.Setup()
	}
	return appInstance
}
