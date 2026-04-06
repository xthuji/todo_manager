package tests

import (
	"testing"
	"time"

	"todolist-go/app/utils"
)

// TestCache 测试缓存功能
func TestCache(t *testing.T) {
	t.Log("=== 开始缓存测试 ===")

	cacheUtil := utils.CacheUtilInstance
	testKey := "test_data"

	// 测试1: 写入缓存
	t.Log("测试1: 写入缓存...")
	testValue := map[string]interface{}{
		"name":      "测试数据",
		"timestamp": time.Now().Format("2006-01-02 15:04:05"),
	}
	cacheUtil.SetData(testKey, testValue, utils.CacheOptions{TTL: 10000}) // 10秒
	t.Log("缓存写入完成")

	// 测试2: 读取缓存
	t.Log("测试2: 读取缓存...")
	cachedData := cacheUtil.GetWrappedData(testKey, utils.CacheOptions{TTL: 10000})
	if cachedData == nil {
		t.Error("读取缓存失败")
		return
	}
	t.Logf("读取到的缓存数据: %v", cachedData)

	// 测试3: 验证数据一致性
	t.Log("测试3: 验证数据一致性...")
	if cachedData.Data != nil {
		if data, ok := cachedData.Data.(map[string]interface{}); ok {
			if name, exists := data["name"]; exists && name == testValue["name"] {
				t.Log("✓ 数据一致性验证通过")
			} else {
				t.Error("✗ 数据一致性验证失败")
			}
		} else {
			t.Error("✗ 缓存数据格式错误")
		}
	} else {
		t.Error("✗ 缓存数据为空")
	}

	// 测试4: 使用GetWrappedData方法
	t.Log("测试4: 使用GetWrappedData方法...")
	wrappedData := cacheUtil.GetWrappedData(testKey, utils.CacheOptions{TTL: 10000})
	t.Logf("GetWrappedData结果: %v", wrappedData)

	// 测试5: 清除缓存
	t.Log("测试5: 清除缓存...")
	cacheUtil.Delete(testKey)

	// 验证缓存已清除
	deletedData := cacheUtil.GetWrappedData(testKey, utils.CacheOptions{})
	if deletedData == nil {
		t.Log("✓ 缓存清除验证通过")
	} else {
		t.Error("✗ 缓存清除验证失败")
	}

	t.Log("=== 缓存测试完成 ===")
}
