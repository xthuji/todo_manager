package utils

// 目录常量
var (
	BASE_DIR    string
	CACHE_DIR   string
	MOCK_DIR    string
	DATA_DIR    string
	WEATHER_DIR string
)

// 配置开关 - 这些值会在初始化时从配置文件中读取
var (
	USE_MOCK       bool  = false
	USE_CACHE      bool  = true // 默认启用缓存
	PRINT_API_DATA bool  = false
	PRINT_DATA_LOG bool  = false
)

// WeatherHeaders 天气API请求头
var WeatherHeaders = map[string]string{
	"User-Agent":      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
	"Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
	"Accept-Language": "zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2",
}

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
	if v, ok := ConfigUtilInstance.GetConfigValue("app", "logs.printApiData", false).(bool); ok {
		PRINT_API_DATA = v
	}
	if v, ok := ConfigUtilInstance.GetConfigValue("app", "logs.printDataLog", false).(bool); ok {
		PRINT_DATA_LOG = v
	}
}

// GetWeatherHeader 获取天气请求头
func GetWeatherHeader() map[string]string {
	h := make(map[string]string)
	for k, v := range WeatherHeaders {
		h[k] = v
	}
	return h
}
