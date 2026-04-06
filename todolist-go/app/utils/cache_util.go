package utils

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"time"
)

// MemoryCacheItem 内存缓存项
type MemoryCacheItem struct {
	Data      interface{} `json:"data"`
	Timestamp int64       `json:"timestamp"`
	TTL       int64       `json:"ttl"`
	Permanent bool        `json:"permanent"`
}

// CacheOptions 缓存选项
type CacheOptions struct {
	AllowExpired bool                        `json:"allowExpired"`
	SourceFile   string                      `json:"source_file"`
	Permanent    bool                        `json:"permanent"`
	LoadDataFn   func() (interface{}, error) `json:"-"`   // 自定义加载函数
	TTL          int64                       `json:"ttl"` // 缓存过期时间(毫秒)
}

// CachedData 缓存数据结构(返回给调用方)
type CachedData struct {
	Data      interface{} `json:"data"`
	Timestamp int64       `json:"timestamp"`
	Expired   bool        `json:"expired"`
	Permanent bool        `json:"permanent"`
}

// CacheUtil 缓存管理工具
type CacheUtil struct {
	memoryCache   map[string]*MemoryCacheItem
	cacheDir      string
	defaultTTL    int64 // 默认过期时间(毫秒), 0表示永不过期
	fileExtension string
}

// NewCacheUtil 创建缓存管理工具实例
func NewCacheUtil() *CacheUtil {
	// 确保ConfigUtilInstance已初始化
	if ConfigUtilInstance == nil {
		ConfigUtilInstance = NewConfigUtil()
	}

	cacheDir := ConfigUtilInstance.GetCacheDir()

	// 确保缓存目录存在
	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		LoggerInstance.Error("创建缓存目录失败: %v", err)
	}

	return &CacheUtil{
		memoryCache:   make(map[string]*MemoryCacheItem),
		cacheDir:      cacheDir,
		defaultTTL:    3600000, // 默认1小时
		fileExtension: "json",
	}
}

// log 统一日志方法
func (c *CacheUtil) log(level string, message string, meta map[string]interface{}) {
	switch level {
	case "error":
		if err, ok := meta["error"]; ok {
			LoggerInstance.Error("%s: %v", message, err)
		} else {
			LoggerInstance.Error("%s", message)
		}
	case "warn":
		LoggerInstance.Warning("%s", message)
	case "debug":
		LoggerInstance.Debug("%s", message)
	default:
		LoggerInstance.Info("%s", message)
	}
}

// CreateCacheItem 创建缓存项
func (c *CacheUtil) CreateCacheItem(data interface{}, options CacheOptions, timestamp ...int64) *MemoryCacheItem {
	ttl := options.TTL
	if ttl == 0 {
		ttl = c.defaultTTL
	}
	ts := time.Now().UnixMilli()
	if len(timestamp) > 0 {
		ts = timestamp[0]
	}
	return &MemoryCacheItem{Data: data, Timestamp: ts, TTL: ttl, Permanent: options.Permanent}
}

// saveCacheItem 保存缓存项(同步方法)
func (c *CacheUtil) saveCacheItem(key string, cacheItem *MemoryCacheItem) bool {
	c.memoryCache[key] = cacheItem
	if !cacheItem.Permanent {
		filePath := c.getFilePath(key)
		if err := os.MkdirAll(filepath.Dir(filePath), 0755); err != nil {
			c.log("error", fmt.Sprintf("创建缓存目录失败: %s", filepath.Dir(filePath)), map[string]interface{}{"error": err})
			return false
		}
		data, _ := json.MarshalIndent(cacheItem, "", "  ")
		if err := os.WriteFile(filePath, data, 0644); err != nil {
			c.log("error", fmt.Sprintf("写入缓存文件失败: %s", key), map[string]interface{}{"error": err})
			return false
		}
	}
	return true
}

// getSafeKey 生成安全的缓存键名
func (c *CacheUtil) getSafeKey(key string) string {
	reg := regexp.MustCompile(`[^a-zA-Z0-9_-]`)
	return reg.ReplaceAllString(key, "_")
}

// GenerateFileCacheKey 生成文件缓存键
func (c *CacheUtil) GenerateFileCacheKey(filename string) string {
	return fmt.Sprintf("file_read_%s", regexp.MustCompile(`\.`).ReplaceAllString(filename, "_"))
}

// getFilePath 获取缓存文件路径
func (c *CacheUtil) getFilePath(key string) string {
	return filepath.Join(c.cacheDir, fmt.Sprintf("%s.%s", c.getSafeKey(key), c.fileExtension))
}

// loadFromSourceFile 从源文件同步加载数据
func (c *CacheUtil) loadFromSourceFile(key string, options CacheOptions, now int64) *CachedData {
	sourceFile := options.SourceFile
	if sourceFile == "" {
		return nil
	}

	c.log("debug", fmt.Sprintf("尝试从源文件同步加载数据: key=%s, file=%s", key, sourceFile), nil)

	// 检查文件是否存在
	if _, err := os.Stat(sourceFile); os.IsNotExist(err) {
		c.log("warn", fmt.Sprintf("源文件不存在: %s", sourceFile), nil)
		return nil
	}

	// 读取文件
	data, err := os.ReadFile(sourceFile)
	if err != nil {
		c.log("error", fmt.Sprintf("读取源文件失败: %s", sourceFile), map[string]interface{}{"error": err})
		return nil
	}

	// 解析JSON
	var fileData map[string]interface{}
	if err := json.Unmarshal(data, &fileData); err != nil {
		c.log("error", fmt.Sprintf("解析源文件JSON失败: %s", sourceFile), map[string]interface{}{"error": err})
		return nil
	}

	// 提取数据
	dataToReturn, hasData := fileData["data"]
	fileTimestamp, _ := fileData["timestamp"].(float64)
	ttl, _ := fileData["ttl"].(float64)

	// 处理TTL
	if ttl == 0 {
		if options.Permanent && options.TTL == 0 {
			ttl = 0
		} else if options.TTL > 0 {
			ttl = float64(options.TTL)
		} else {
			ttl = float64(c.defaultTTL)
		}
	}

	// 如果不是缓存格式,使用整个文件数据
	if !hasData || fileTimestamp == 0 {
		dataToReturn = fileData
		if info, err := os.Stat(sourceFile); err == nil {
			fileTimestamp = float64(info.ModTime().UnixMilli())
		} else {
			fileTimestamp = float64(now)
		}
		c.log("debug", fmt.Sprintf("检测到非缓存格式数据,进行转换: key=%s", key), nil)
	}

	// 检查是否过期
	isExpired := ttl != 0 && float64(now) > fileTimestamp+ttl

	if !isExpired || options.AllowExpired {
		c.log("debug", fmt.Sprintf("成功从源文件同步加载数据: key=%s, %s", key, map[bool]string{true: "已过期", false: "未过期"}[isExpired]), nil)
		cacheItem := c.CreateCacheItem(dataToReturn, options, int64(fileTimestamp))
		c.memoryCache[key] = cacheItem
		return &CachedData{Data: dataToReturn, Timestamp: int64(fileTimestamp), Expired: isExpired, Permanent: options.Permanent}
	}
	c.log("debug", fmt.Sprintf("数据已过期且不允许使用过期缓存: key=%s", key), nil)
	return nil
}

// loadFromDefaultCache 从默认缓存文件同步加载数据
func (c *CacheUtil) loadFromDefaultCache(key string, options CacheOptions, now int64) *CachedData {
	c.log("debug", fmt.Sprintf("尝试从默认缓存文件同步加载数据: key=%s", key), nil)

	filePath := c.getFilePath(key)

	// 检查文件是否存在
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.log("debug", fmt.Sprintf("默认缓存文件不存在: %s", filePath), nil)
		return nil
	}

	// 读取文件
	data, err := os.ReadFile(filePath)
	if err != nil {
		c.log("error", fmt.Sprintf("读取默认缓存文件失败: %s", filePath), map[string]interface{}{"error": err})
		return nil
	}

	// 解析JSON
	var fileItem MemoryCacheItem
	if err := json.Unmarshal(data, &fileItem); err != nil {
		c.log("error", fmt.Sprintf("解析默认缓存文件JSON失败: %s", filePath), map[string]interface{}{"error": err})
		return nil
	}

	fileData := fileItem.Data
	fileTimestamp := fileItem.Timestamp
	ttl := fileItem.TTL
	isExpired := ttl != 0 && now > fileTimestamp+ttl

	if !isExpired || options.AllowExpired {
		c.memoryCache[key] = &MemoryCacheItem{Data: fileData, Timestamp: fileTimestamp, TTL: ttl, Permanent: fileItem.Permanent}
		c.log("debug", fmt.Sprintf("成功从默认缓存文件同步加载数据: key=%s, %s", key, map[bool]string{true: "已过期", false: "未过期"}[isExpired]), nil)
		return &CachedData{Data: fileData, Timestamp: fileTimestamp, Expired: isExpired, Permanent: fileItem.Permanent}
	}
	c.log("debug", fmt.Sprintf("数据已过期且不允许使用过期缓存: key=%s", key), nil)
	return nil
}

// loadFromCustomLoader 从自定义加载函数加载数据
func (c *CacheUtil) loadFromCustomLoader(key string, options CacheOptions) *CachedData {
	c.log("debug", fmt.Sprintf("尝试从自定义加载函数同步加载数据: key=%s", key), nil)
	if options.LoadDataFn == nil {
		c.log("warn", fmt.Sprintf("自定义加载函数为空: key=%s", key), nil)
		return nil
	}
	data, err := options.LoadDataFn()
	if err != nil || data == nil {
		c.log("warn", fmt.Sprintf("自定义加载函数返回无效数据: key=%s, error=%v", key, err), nil)
		return nil
	}
	c.log("debug", fmt.Sprintf("成功从自定义加载函数获取数据: key=%s", key), nil)

	ttl := options.TTL
	if ttl == 0 {
		ttl = c.defaultTTL
	}
	setResult := c.SetData(key, data, CacheOptions{TTL: ttl, SourceFile: options.SourceFile, Permanent: options.Permanent})
	if !setResult {
		c.log("warn", fmt.Sprintf("数据加载成功但缓存设置失败: key=%s", key), nil)
	}
	return &CachedData{Data: data, Timestamp: time.Now().UnixMilli(), Expired: false, Permanent: options.Permanent}
}

// GetData 同步获取缓存数据(仅数据)
func (c *CacheUtil) GetData(key string, options CacheOptions) interface{} {
	wrappedData := c.GetWrappedData(key, options)
	if wrappedData == nil {
		return nil
	}
	return wrappedData.Data
}

// GetWrappedData 同步获取缓存数据(返回包装后的数据)
func (c *CacheUtil) GetWrappedData(key string, options CacheOptions) *CachedData {
	if !USE_CACHE {
		return nil
	}
	now := time.Now().UnixMilli()
	safeKey := c.getSafeKey(key)

	// 1. 尝试从内存缓存获取
	if memoryItem, exists := c.memoryCache[safeKey]; exists {
		isExpired := memoryItem.TTL != 0 && now > memoryItem.Timestamp+memoryItem.TTL
		if !isExpired || options.AllowExpired {
			return &CachedData{Data: memoryItem.Data, Timestamp: memoryItem.Timestamp, Expired: isExpired, Permanent: memoryItem.Permanent}
		}
	}

	// 2. 尝试从文件缓存获取
	var fileData *CachedData
	if options.SourceFile != "" {
		fileData = c.loadFromSourceFile(safeKey, options, now)
	} else {
		fileData = c.loadFromDefaultCache(safeKey, options, now)
	}
	if fileData != nil {
		return fileData
	}

	// 3. 尝试使用自定义数据加载函数
	if options.LoadDataFn != nil {
		if customData := c.loadFromCustomLoader(safeKey, options); customData != nil {
			return customData
		}
	}
	return nil
}

// SetData 同步设置缓存数据
func (c *CacheUtil) SetData(key string, data interface{}, options CacheOptions) bool {
	if !USE_CACHE {
		return false
	}
	safeKey := c.getSafeKey(key)
	c.log("debug", fmt.Sprintf("开始设置缓存数据: key=%s", safeKey), nil)
	return c.saveCacheItem(safeKey, c.CreateCacheItem(data, options))
}

// Delete 同步删除缓存
func (c *CacheUtil) Delete(key string) bool {
	safeKey := c.getSafeKey(key)
	c.log("debug", fmt.Sprintf("开始删除缓存数据: key=%s", safeKey), nil)
	delete(c.memoryCache, safeKey)
	filePath := c.getFilePath(safeKey)
	if _, err := os.Stat(filePath); err == nil {
		if err := os.Remove(filePath); err != nil {
			c.log("error", fmt.Sprintf("删除缓存文件失败: %s", filePath), map[string]interface{}{"error": err})
			return false
		}
	}
	return true
}

// Has 同步检查缓存是否存在且未过期
func (c *CacheUtil) Has(key string) bool {
	wrappedData := c.GetWrappedData(key, CacheOptions{AllowExpired: false})
	return wrappedData != nil && !wrappedData.Expired
}

// Set 同步设置缓存数据(与Python项目兼容的别名方法)
func (c *CacheUtil) Set(key string, data interface{}, ttl int64) bool {
	return c.SetData(key, data, CacheOptions{TTL: ttl})
}

// Get 同步获取缓存数据(与Python项目兼容的别名方法)
func (c *CacheUtil) Get(key string, options CacheOptions) *CachedData {
	return c.GetWrappedData(key, options)
}

// 全局缓存工具实例
var CacheUtilInstance *CacheUtil

// init 初始化全局缓存工具实例
func init() {
	CacheUtilInstance = NewCacheUtil()
}
