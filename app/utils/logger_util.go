package utils

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"time"
)

// Logger 日志工具
type Logger struct {
	logDir   string
	logFile  string
	logger   *slog.Logger
	levelVar *slog.LevelVar // 支持运行时动态调整日志级别
}

// GlobalLevel 用于动态调整全局日志级别
var GlobalLevel = new(slog.LevelVar)

// NewLogger 创建日志工具实例
func NewLogger() *Logger {
	if ConfigUtilInstance == nil {
		ConfigUtilInstance = NewConfigUtil()
	}

	logDir := filepath.Join(ConfigUtilInstance.GetDataDir(), "logs")
	if err := os.MkdirAll(logDir, 0755); err != nil {
		fmt.Printf("Error creating log directory: %v\n", err)
		logDir = filepath.Join(os.TempDir(), "TodoManager", "logs")
		_ = os.MkdirAll(logDir, 0755)
	}

	logFile := filepath.Join(logDir, "app.log")
	file, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)

	// 初始化级别，默认 Info
	GlobalLevel.Set(slog.LevelInfo)

	options := &slog.HandlerOptions{
		Level:     GlobalLevel, // 绑定动态级别
		AddSource: true,        // 开启行号定位
	}

	var handler slog.Handler
	if err == nil && file != nil {
		multiWriter := io.MultiWriter(file, os.Stdout)
		handler = slog.NewTextHandler(multiWriter, options)
	} else {
		fmt.Printf("Error opening log file: %v, using stdout\n", err)
		handler = slog.NewTextHandler(os.Stdout, options)
	}

	slogger := slog.New(handler)
	slog.SetDefault(slogger)

	return &Logger{
		logDir:   logDir,
		logFile:  logFile,
		logger:   slogger,
		levelVar: GlobalLevel,
	}
}

// 核心通用打印方法：负责拦截级别、修正调用栈、处理日志
func (l *Logger) log(level slog.Level, msg string, attrs ...slog.Attr) {
	// 性能第一关：级别检查（未开启直接返回，无任何开销）
	if !l.logger.Enabled(context.Background(), level) {
		return
	}

	// 核心优化：获取真正调用日志的 PC（程序计数器），修复封装后的行号错乱问题
	var pc uintptr
	var pcs [1]uintptr
	// skip 3 恰好跳过: runtime.Callers -> l.log -> Info/Error -> 业务调用方
	runtime.Callers(3, pcs[:])
	pc = pcs[0]

	// 创建标准 Record 并通过 Handler 输出
	r := slog.NewRecord(time.Now(), level, msg, pc)
	r.AddAttrs(attrs...)
	_ = l.logger.Handler().Handle(context.Background(), r)
}

// ==================== 方案 A：高性能结构化日志 API (推荐新代码使用) ====================

func (l *Logger) Debug(msg string, args ...any) {
	if l == nil {
		return
	}
	l.log(slog.LevelDebug, msg, argsToAttrs(args)...)
}

func (l *Logger) Info(msg string, args ...any) {
	if l == nil {
		return
	}
	l.log(slog.LevelInfo, msg, argsToAttrs(args)...)
}

func (l *Logger) Warn(msg string, args ...any) {
	if l == nil {
		return
	}
	l.log(slog.LevelWarn, msg, argsToAttrs(args)...)
}

func (l *Logger) Error(msg string, args ...any) {
	if l == nil {
		return
	}
	l.log(slog.LevelError, msg, argsToAttrs(args)...)
}

// 将开散的 key-value 对转换为 slog.Attr，减少逃逸
func argsToAttrs(args []any) []slog.Attr {
	if len(args) == 0 {
		return nil
	}
	attrs := make([]slog.Attr, 0, len(args)/2)
	for i := 0; i < len(args); i += 2 {
		if i+1 < len(args) {
			if k, ok := args[i].(string); ok {
				attrs = append(attrs, slog.Any(k, args[i+1]))
			}
		}
	}
	return attrs
}

// 全局日志工具实例
var LoggerInstance *Logger

func init() {
	LoggerInstance = NewLogger()
}
