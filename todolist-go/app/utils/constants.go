package utils

// 目录常量
var (
	BASE_DIR    string
	CACHE_DIR   string
	MOCK_DIR    string
	DATA_DIR    string
	WEATHER_DIR string
)

// 默认位置信息
var DefaultLocation = map[string]interface{}{
	"province": "浙江", "city": "杭州", "district": "杭州", "code": "101210101",
}

// 配置开关 - 这些值会在初始化时从配置文件中读取
var (
	USE_MOCK       bool  = false
	USE_CACHE      bool  = true // 默认启用缓存
	PRINT_API_DATA bool  = false
	PRINT_DATA_LOG bool  = false
)

// InitConstants 初始化常量 - 需要在config_util初始化后调用
func InitConstants() {
	BASE_DIR = ConfigUtilInstance.GetProjectRoot()
	CACHE_DIR = ConfigUtilInstance.GetCacheDir()
	MOCK_DIR = ConfigUtilInstance.GetMockDir()
	DATA_DIR = ConfigUtilInstance.GetDataDir()
	WEATHER_DIR = ConfigUtilInstance.GetWeatherDir()
	// 从配置文件中读取配置项（使用安全的类型检查）
	if v, ok := ConfigUtilInstance.GetConfigValue("app", "features.mock.enabled", false).(bool); ok {
		USE_MOCK = v
	}
	if v, ok := ConfigUtilInstance.GetConfigValue("app", "features.cache.enabled", true).(bool); ok {
		USE_CACHE = v
	}
	if v, ok := ConfigUtilInstance.GetConfigValue("app", "logs.print_api_data", false).(bool); ok {
		PRINT_API_DATA = v
	}
	if v, ok := ConfigUtilInstance.GetConfigValue("app", "logs.print_data_log", false).(bool); ok {
		PRINT_DATA_LOG = v
	}
	// 从配置文件中读取默认位置信息
	if loc, ok := ConfigUtilInstance.GetConfigValue("app", "features.default_location", nil).(map[string]interface{}); ok {
		DefaultLocation = loc
	}
}

// GetDefaultLocation 获取默认位置信息
func GetDefaultLocation() map[string]interface{} {
	return DefaultLocation
}
