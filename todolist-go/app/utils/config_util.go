package utils

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// ConfigUtil 配置管理工具
type ConfigUtil struct {
	projectRoot       string
	dataDir           string
	cacheDir          string
	configDir         string
	weatherDir        string
	mockDir           string
	configDefinitions map[string]configDefinition
	configCache       map[string]map[string]interface{}
	configCacheMutex  sync.RWMutex
}

// configDefinition 配置定义
type configDefinition struct {
	File string `json:"file"`
}

// NewConfigUtil 创建配置管理工具实例
func NewConfigUtil() *ConfigUtil {
	projectRoot := getProjectRoot()
	dataDir := filepath.Join(projectRoot, "data")
	dirs := []string{dataDir, filepath.Join(dataDir, "cache"), filepath.Join(dataDir, "config"),
		filepath.Join(dataDir, "weather"), filepath.Join(dataDir, "mock")}
	for _, dir := range dirs {
		os.MkdirAll(dir, 0755)
	}
	return &ConfigUtil{
		projectRoot: projectRoot, dataDir: dataDir,
		cacheDir: filepath.Join(dataDir, "cache"), configDir: filepath.Join(dataDir, "config"),
		weatherDir: filepath.Join(dataDir, "weather"), mockDir: filepath.Join(dataDir, "mock"),
		configDefinitions: map[string]configDefinition{
			"app": {File: "app_config.json"}, "notify": {File: "notify_config.json"},
			"festival": {File: "festival_config.json"},
		},
		configCache: make(map[string]map[string]interface{}),
	}
}

// getProjectRoot 获取项目根目录
func getProjectRoot() string {
	// 首先检查是否在.app包中运行（通过可执行文件路径）
	exe, err := os.Executable()
	if err == nil {
		exeDir := filepath.Dir(exe)

		if strings.Contains(exeDir, ".app/Contents/MacOS") {
			// 在.app包中，返回Resources目录
			// 正确的路径应该是: .app/Contents/Resources
			resourcesDir := filepath.Join(filepath.Dir(exeDir), "Resources")
			if _, err := os.Stat(resourcesDir); err == nil {
				return resourcesDir
			}
		}
	}

	// 非.app包环境，按原逻辑查找
	currentDir, _ := os.Getwd()
	for {
		if _, err := os.Stat(filepath.Join(currentDir, "go.mod")); err == nil {
			return currentDir
		}
		parentDir := filepath.Dir(currentDir)
		if parentDir == currentDir {
			// 到达根目录
			return "."
		}
		currentDir = parentDir
	}
}

// Getter方法
func (c *ConfigUtil) GetProjectRoot() string { return c.projectRoot }
func (c *ConfigUtil) GetDataDir() string     { return c.dataDir }
func (c *ConfigUtil) GetCacheDir() string    { return c.cacheDir }
func (c *ConfigUtil) GetConfigDir() string   { return c.configDir }
func (c *ConfigUtil) GetWeatherDir() string  { return c.weatherDir }
func (c *ConfigUtil) GetMockDir() string     { return c.mockDir }

// getConfigPath 根据配置名称获取配置文件路径
func (c *ConfigUtil) getConfigPath(configName string) (string, error) {
	definition, ok := c.configDefinitions[configName]
	if !ok {
		return "", fmt.Errorf("unknown config: %s", configName)
	}
	return filepath.Join(c.configDir, definition.File), nil
}

// readConfigFile 读取配置文件
func (c *ConfigUtil) readConfigFile(configPath string) (map[string]interface{}, error) {
	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			LoggerInstance.Warn("配置文件不存在", "config_path", configPath)
			return map[string]interface{}{}, nil
		}
		LoggerInstance.Error("读取配置文件失败", "error", err)
		return nil, err
	}

	var config map[string]interface{}
	if err := json.Unmarshal(data, &config); err != nil {
		LoggerInstance.Error("解析配置文件失败", "config_path", configPath, "error", err)
		// 与Python版本保持一致：解析失败时返回空字典，不返回错误
		return map[string]interface{}{}, nil
	}

	return config, nil
}

// GetConfig 从配置文件中读取配置
func (c *ConfigUtil) GetConfig(configName string, defaultConfig map[string]interface{}) map[string]interface{} {
	c.configCacheMutex.RLock()
	if cachedConfig, exists := c.configCache[configName]; exists {
		c.configCacheMutex.RUnlock()
		if len(cachedConfig) == 0 {
			return defaultConfig
		}
		return cachedConfig
	}
	c.configCacheMutex.RUnlock()

	configPath, err := c.getConfigPath(configName)
	if err != nil {
		LoggerInstance.Error("获取配置路径失败", "config_name", configName)
		return defaultConfig
	}
	config, _ := c.readConfigFile(configPath)

	c.configCacheMutex.Lock()
	c.configCache[configName] = config
	c.configCacheMutex.Unlock()

	if len(config) == 0 {
		return defaultConfig
	}
	return config
}

// GetConfigSync 同步从配置文件中读取配置
func (c *ConfigUtil) GetConfigSync(configName string, defaultConfig map[string]interface{}) map[string]interface{} {
	return c.GetConfig(configName, defaultConfig)
}

// SaveConfig 保存配置到配置文件
func (c *ConfigUtil) SaveConfig(configName string, configData map[string]interface{}) bool {
	configPath, err := c.getConfigPath(configName)
	if err != nil {
		LoggerInstance.Error("获取配置路径失败", "config_name", configName)
		return false
	}
	os.MkdirAll(filepath.Dir(configPath), 0755)
	data, _ := json.MarshalIndent(configData, "", "  ")
	if err := os.WriteFile(configPath, data, 0644); err != nil {
		LoggerInstance.Error("写入配置文件失败", "config_path", configPath)
		return false
	}

	c.configCacheMutex.Lock()
	c.configCache[configName] = configData
	c.configCacheMutex.Unlock()

	LoggerInstance.Info("配置保存成功", "config_name", configName)
	return true
}

// GetConfigValue 根据键路径获取配置值
func (c *ConfigUtil) GetConfigValue(configName string, keyPath string, defaultValue interface{}) interface{} {
	config := c.GetConfigSync(configName, map[string]interface{}{})
	if len(config) == 0 {
		return defaultValue
	}
	var value interface{} = config
	for _, key := range strings.Split(keyPath, ".") {
		if m, ok := value.(map[string]interface{}); ok {
			if v, exists := m[key]; exists {
				value = v
			} else {
				return defaultValue
			}
		} else {
			return defaultValue
		}
	}
	return value
}

// GetAvailableConfigs 获取所有可用的配置名称
func (c *ConfigUtil) GetAvailableConfigs() []string {
	configs := make([]string, 0, len(c.configDefinitions))
	// 按照固定顺序返回，与Python版本保持一致
	for _, configName := range []string{"app", "notify", "festival"} {
		if _, exists := c.configDefinitions[configName]; exists {
			configs = append(configs, configName)
		}
	}
	// 添加其他动态注册的配置
	for config := range c.configDefinitions {
		found := false
		for _, existing := range configs {
			if existing == config {
				found = true
				break
			}
		}
		if !found {
			configs = append(configs, config)
		}
	}
	return configs
}

// RegisterConfig 注册新的配置
func (c *ConfigUtil) RegisterConfig(configName string, definition configDefinition) error {
	if _, exists := c.configDefinitions[configName]; exists {
		return fmt.Errorf("config %s already registered", configName)
	}

	if definition.File == "" {
		return fmt.Errorf("config definition must include file")
	}

	c.configDefinitions[configName] = definition
	return nil
}

// 全局配置工具实例
var ConfigUtilInstance *ConfigUtil

// init 初始化全局配置工具实例
func init() {
	ConfigUtilInstance = NewConfigUtil()
}

// getAPITimeout 获取API超时时间（秒）
func (c *ConfigUtil) getAPITimeout(configKey string, defaultValue int) int {
	if t := c.GetConfigValue("app", configKey, nil); t != nil {
		if tFloat, ok := t.(float64); ok {
			return int(tFloat)
		}
	}
	return defaultValue
}

// GetLocationAPITimeoutDuration 获取位置API超时时间（time.Duration）
func (c *ConfigUtil) GetLocationAPITimeoutDuration() time.Duration {
	return time.Duration(c.getAPITimeout("server.api_timeout_location", 10)) * time.Second
}

// GetWeatherAPITimeoutDuration 获取天气API超时时间（time.Duration）
func (c *ConfigUtil) GetWeatherAPITimeoutDuration() time.Duration {
	return time.Duration(c.getAPITimeout("server.api_timeout_weather", 10)) * time.Second
}

// GetWeatherAPIuTLSTimeoutDuration 获取天气API uTLS超时时间（time.Duration）
func (c *ConfigUtil) GetWeatherAPIuTLSTimeoutDuration() time.Duration {
	return time.Duration(c.getAPITimeout("server.api_timeout_weather_utls", 20)) * time.Second
}
