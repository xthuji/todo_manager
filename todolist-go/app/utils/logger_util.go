package utils

import (
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
)

// Logger 日志工具（基于slog全局API）
type Logger struct {
	logDir  string
	logFile string
}

// NewLogger 创建日志工具实例
func NewLogger() *Logger {
	// 确保ConfigUtilInstance已初始化
	if ConfigUtilInstance == nil {
		ConfigUtilInstance = NewConfigUtil()
	}

	// 确保日志目录存在
	logDir := filepath.Join(ConfigUtilInstance.GetDataDir(), "logs")
	if err := os.MkdirAll(logDir, 0755); err != nil {
		fmt.Printf("Error creating log directory: %v\n", err)
		logDir = filepath.Join(os.TempDir(), "todolist-go", "logs")
		os.MkdirAll(logDir, 0755)
	}

	logFile := filepath.Join(logDir, "app.log")

	// 打开日志文件
	file, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		fmt.Printf("Error opening log file: %v, using stdout\n", err)
		file = nil
	}

	// 设置slog全局logger
	if file != nil {
		multiWriter := io.MultiWriter(file, os.Stdout)
		handler := slog.NewTextHandler(multiWriter, &slog.HandlerOptions{
			Level: slog.LevelInfo,
		})
		slog.SetDefault(slog.New(handler))
	}

	return &Logger{
		logDir:  logDir,
		logFile: logFile,
	}
}

// Info 记录信息日志
func (l *Logger) Info(format string, v ...interface{}) {
	if l == nil {
		fmt.Printf("INFO: "+format+"\n", v...)
		return
	}
	slog.Info(fmt.Sprintf(format, v...))
}

// Error 记录错误日志
func (l *Logger) Error(format string, v ...interface{}) {
	if l == nil {
		fmt.Printf("ERROR: "+format+"\n", v...)
		return
	}
	slog.Error(fmt.Sprintf(format, v...))
}

// Debug 记录调试日志
func (l *Logger) Debug(format string, v ...interface{}) {
	if l == nil {
		fmt.Printf("DEBUG: "+format+"\n", v...)
		return
	}
	slog.Debug(fmt.Sprintf(format, v...))
}

// Warning 记录警告日志
func (l *Logger) Warning(format string, v ...interface{}) {
	if l == nil {
		fmt.Printf("WARNING: "+format+"\n", v...)
		return
	}
	slog.Warn(fmt.Sprintf(format, v...))
}

// safeWarning 安全的警告日志方法，在 LoggerInstance 为 nil 时使用
func safeWarning(format string, v ...interface{}) {
	if LoggerInstance != nil {
		LoggerInstance.Warning(format, v...)
	} else {
		fmt.Printf("WARNING: "+format+"\n", v...)
	}
}

// safeError 安全的错误日志方法，在 LoggerInstance 为 nil 时使用
func safeError(format string, v ...interface{}) {
	if LoggerInstance != nil {
		LoggerInstance.Error(format, v...)
	} else {
		fmt.Printf("ERROR: "+format+"\n", v...)
	}
}

// 全局日志工具实例
var LoggerInstance *Logger

// init 初始化全局日志工具实例
func init() {
	LoggerInstance = NewLogger()
}
