package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	webview_go "github.com/webview/webview_go"
	localapp "todolist-go/app"
)

// 平台特定的退出处理函数
var setupQuitHandler func(window interface{})

// 为非macOS平台提供默认实现
func init() {
	setupQuitHandler = func(window interface{}) {
		// 默认实现：不做任何处理
	}
}

// TodoApp 应用结构体 (对应 Python app.py 的 TodoApp 类)
type TodoApp struct {
	Port        int
	URL         string
	AppInstance *localapp.App
	Server      *http.Server
}

// NewTodoApp 构造函数 (对应 Python __init__)
func NewTodoApp() *TodoApp {
	return &TodoApp{
		Port: 3002,
	}
}

// waitForServer 等待HTTP服务就绪
func (t *TodoApp) waitForServer(timeout int) bool {
	start := time.Now()
	for time.Since(start) < time.Duration(timeout)*time.Second {
		resp, err := http.Get(fmt.Sprintf("http://127.0.0.1:%d/", t.Port))
		if err == nil {
			resp.Body.Close()
			return true
		}
		time.Sleep(300 * time.Millisecond)
	}
	return false
}

// startServer 启动 Gin HTTP 服务
func (t *TodoApp) startServer() {
	// 确保工作目录在可执行文件所在目录，以便正确找到 static/ 和 data/
	exe, err := os.Executable()
	if err == nil {
		os.Chdir(filepath.Dir(exe))
	}

	t.AppInstance = localapp.GetApp()
	t.Server = &http.Server{
		Addr:    fmt.Sprintf("127.0.0.1:%d", t.Port),
		Handler: t.AppInstance.Router, // 复用 Gin 的路由引擎
	}

	go func() {
		log.Printf("HTTP Server listening on %s", t.Server.Addr)
		if err := t.Server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()
}

// Run 运行应用 (对应 Python run 方法)
func (t *TodoApp) Run() {
	t.URL = fmt.Sprintf("http://127.0.0.1:%d/", t.Port)

	// 1. 启动 HTTP 服务
	t.startServer()

	// 2. 等待服务就绪
	if !t.waitForServer(5) {
		log.Println("⚠️ 后端服务启动超时")
		return
	}

	// 3. 创建原生 App 窗口
	// 参数 true 表示开启调试模式（macOS 下支持右键检查元素）
	log.Printf("正在创建原生窗口，加载: %s", t.URL)
	w := webview_go.New(true)
	defer w.Destroy()

	w.SetTitle("TodoManager")
	w.SetSize(1000, 800, webview_go.HintNone)

	// 设置平台特定的退出处理
	window := w.Window()
	if setupQuitHandler != nil {
		setupQuitHandler(window)
	}

	// 加载首页 (由后台运行的 Gin 服务提供)
	w.Navigate(t.URL)

	log.Println("✅ App 窗口已打开")

	// 4. 设置信号处理
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	
	// 5. 运行主循环 (阻塞直到窗口关闭或收到退出信号)
	go func() {
		<-sigChan
		log.Println("收到退出信号，正在关闭应用...")
		w.Terminate()
	}()
	
	w.Run()
}

func main() {
	// 对应 Python: if __name__ == "__main__": TodoApp().run()
	NewTodoApp().Run()
}