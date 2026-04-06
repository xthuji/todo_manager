package main

import (
	"log"
	"todolist-go/app"
)

// StartServer 启动服务器
func StartServer() error {
	// 获取全局应用实例
	appInstance := app.GetApp()
	
	// 启动服务器
	log.Println("启动待办事项管理系统服务端...")
	return appInstance.StartServer()
}

// main 函数，用于纯HTTP服务端模式
func main() {
	// 启动服务器
	if err := StartServer(); err != nil {
		log.Fatalf("服务器启动失败: %v", err)
	}
}