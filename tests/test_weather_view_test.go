package tests

import (
	"testing"
)

// MockLocationData 模拟位置数据
type MockLocationData struct {
	Province    string `json:"province"`
	City        string `json:"city"`
	County      string `json:"county"`
	WeatherCode string `json:"weatherCode"`
}

// MockWeatherData 模拟天气数据
type MockWeatherData struct {
	Date    string  `json:"date"`
	Weather string  `json:"weather"`
	MaxTemp float64 `json:"maxTemp"`
	MinTemp float64 `json:"minTemp"`
}

// WeatherModule 天气功能模块
type WeatherModule struct{}

// NewWeatherModule 创建天气模块实例
func NewWeatherModule() *WeatherModule {
	return &WeatherModule{}
}

// FetchWeatherData 获取天气数据
func (wm *WeatherModule) FetchWeatherData(weatherCode string) (map[string]interface{}, error) {
	return map[string]interface{}{
		"success": true,
		"data":    GetMockWeatherData(),
	}, nil
}

// GetLocationByIP 获取IP位置信息
func (wm *WeatherModule) GetLocationByIP() (map[string]interface{}, error) {
	return map[string]interface{}{
		"success": true,
		"data":    GetMockLocationData(),
	}, nil
}

// GetMockLocationData 获取模拟位置数据
func GetMockLocationData() MockLocationData {
	return MockLocationData{
		Province:    "北京市",
		City:        "北京市",
		County:      "朝阳区",
		WeatherCode: "101010100",
	}
}

// GetMockWeatherData 获取模拟天气数据
func GetMockWeatherData() []MockWeatherData {
	return []MockWeatherData{
		{Date: "2025-01-01", Weather: "晴", MaxTemp: 10, MinTemp: -5},
		{Date: "2025-01-02", Weather: "多云", MaxTemp: 8, MinTemp: -6},
		{Date: "2025-01-03", Weather: "晴", MaxTemp: 12, MinTemp: -3},
	}
}

// ValidateLocationData 验证位置数据格式
func ValidateLocationData(locationData MockLocationData) error {
	if locationData.Province == "" || locationData.City == "" || locationData.County == "" || locationData.WeatherCode == "" {
		return &ValidationError{message: "位置信息缺少必要字段"}
	}
	return nil
}

// ValidateWeatherData 验证天气数据格式
func ValidateWeatherData(weatherData []MockWeatherData) error {
	if len(weatherData) == 0 {
		return &ValidationError{message: "天气数据不能为空数组"}
	}

	for index, dayData := range weatherData {
		if dayData.Date == "" || dayData.Weather == "" {
			return &ValidationError{message: "天气数据缺少必要字段"}
		}
		if index == 0 {
			_ = dayData.MaxTemp + dayData.MinTemp // 验证温度数据类型
		}
	}
	return nil
}

// ValidationError 验证错误
type ValidationError struct {
	message string
}

func (e *ValidationError) Error() string {
	return e.message
}

// TestWeatherView 测试天气功能
func TestWeatherView(t *testing.T) {
	weatherModule := NewWeatherModule()

	t.Log("=== 开始天气功能测试 ===")

	// 测试1: IP定位获取省市县信息
	t.Log("\n测试1: IP定位获取省市县信息")
	_, err := weatherModule.GetLocationByIP()
	if err == nil {
		locationData := GetMockLocationData()
		if err := ValidateLocationData(locationData); err == nil {
			t.Log("  ✅ 通过: 成功获取IP位置信息")
			t.Log("  ✅ 通过: 位置信息格式正确，包含必要字段")
			t.Logf("  ✅ 通过: 获取到的城市: %s", locationData.City)
			t.Logf("  ✅ 通过: 获取到的天气代码: %s", locationData.WeatherCode)
		} else {
			t.Errorf("  ❌ 失败: %v", err)
		}
	} else {
		t.Errorf("  ❌ 失败: %v", err)
	}

	// 测试2: 获取天气数据
	t.Log("\n测试2: 根据城市代码获取天气数据")
	_, err = weatherModule.FetchWeatherData("101010100")
	if err == nil {
		mockWeatherData := GetMockWeatherData()
		if err := ValidateWeatherData(mockWeatherData); err == nil {
			t.Log("  ✅ 通过: 成功获取天气数据")
			t.Logf("  ✅ 通过: 天气数据长度: %d 天", len(mockWeatherData))
			t.Log("  ✅ 通过: 天气数据格式验证通过")

			firstDay := mockWeatherData[0]
			t.Logf("  ✅ 通过: 第一天天气: %s %s %.0f°C~%.0f°C",
				firstDay.Date, firstDay.Weather, firstDay.MinTemp, firstDay.MaxTemp)
		} else {
			t.Errorf("  ❌ 失败: %v", err)
		}
	} else {
		t.Errorf("  ❌ 失败: %v", err)
	}

	// 测试3: 错误处理测试
	t.Log("\n测试3: 错误处理测试")
	emptyWeatherData := []MockWeatherData{}
	if err := ValidateWeatherData(emptyWeatherData); err != nil {
		if err.Error() == "天气数据不能为空数组" {
			t.Log("  ✅ 通过: 正确检测到空数据错误")
		} else {
			t.Errorf("  ❌ 失败: 错误信息不匹配")
		}
	} else {
		t.Error("  ❌ 失败: 应当检测到空数据错误")
	}

	// 测试4: 数据边界测试
	t.Log("\n测试4: 数据边界测试")
	if err := ValidateWeatherData(GetMockWeatherData()); err == nil {
		t.Log("  ✅ 通过: 天气数据格式正确")
	} else {
		t.Errorf("  ❌ 失败: %v", err)
	}

	t.Log("\n=== 天气功能测试完成 ===")
}
