package weather

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	utls "github.com/refraction-networking/utls"
)

// CMA天气请求头
var cmaHeaders = map[string]string{
	"User-Agent":      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	"Accept":          "application/json, text/plain, */*",
	"Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
	"Connection":      "keep-alive",
}

// cmaHTTPClient 全局复用的HTTP客户端（带uTLS支持）
var (
	cmaHTTPClient     *http.Client
	cmaHTTPClientOnce sync.Once
)

// getCMAHTTPClient 获取全局复用的CMA HTTP客户端（带uTLS）
func getCMAHTTPClient() *http.Client {
	cmaHTTPClientOnce.Do(func() {
		transport := &http.Transport{
			ForceAttemptHTTP2:   false,
			MaxIdleConns:        10,
			MaxIdleConnsPerHost: 5,
			IdleConnTimeout:     90 * time.Second,
			DialTLSContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
				dialer := &net.Dialer{Timeout: 10 * time.Second, KeepAlive: 30 * time.Second}
				conn, err := dialer.DialContext(ctx, network, addr)
				if err != nil {
					return nil, err
				}
				utsConn := utls.UClient(conn, &utls.Config{ServerName: "weather.cma.cn", InsecureSkipVerify: false}, utls.HelloChrome_120)
				if err := utsConn.Handshake(); err != nil {
					conn.Close()
					return nil, err
				}
				return utsConn, nil
			},
		}
		cmaHTTPClient = &http.Client{Timeout: 20 * time.Second, Transport: transport}
	})
	return cmaHTTPClient
}

// FetchCMAWeather 获取中国气象局天气数据
func FetchCMAWeather(cmaAreaCode string) map[string]interface{} {
	if cmaAreaCode == "" {
		return map[string]interface{}{"error": map[string]interface{}{"message": "参数cma_area_code为空，无法获取中国气象局天气数据"}}
	}

	cmaWeatherURL := fmt.Sprintf("https://weather.cma.cn/api/now/%s", cmaAreaCode)
	client := getCMAHTTPClient()
	req, _ := http.NewRequest("GET", cmaWeatherURL, nil)
	for k, v := range cmaHeaders {
		req.Header.Set(k, v)
	}

	resp, err := client.Do(req)
	if err != nil {
		return map[string]interface{}{"error": map[string]interface{}{"message": fmt.Sprintf("获取中国气象局天气数据失败: %v", err)}}
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return map[string]interface{}{"error": map[string]interface{}{"message": fmt.Sprintf("HTTP响应状态码: %d", resp.StatusCode)}}
	}

	body, _ := io.ReadAll(resp.Body)
	var cmaData map[string]interface{}
	if err := json.Unmarshal(body, &cmaData); err != nil {
		return map[string]interface{}{"error": map[string]interface{}{"message": fmt.Sprintf("获取中国气象局天气数据失败: %v", err)}}
	}

	return extractCMAWeatherData(cmaData)
}

// extractCMAWeatherData 格式化CMA数据为统一格式
func extractCMAWeatherData(cmaData map[string]interface{}) map[string]interface{} {
	if cmaData == nil {
		return map[string]interface{}{}
	}
	if code, _ := cmaData["code"].(float64); code != 0 {
		return map[string]interface{}{}
	}
	data, ok := cmaData["data"].(map[string]interface{})
	if !ok {
		return map[string]interface{}{}
	}
	now, ok := data["now"].(map[string]interface{})
	if !ok {
		return map[string]interface{}{}
	}

	timeStr := ""
	if lastUpdate, _ := data["lastUpdate"].(string); lastUpdate != "" {
		parts := strings.Split(strings.TrimSpace(lastUpdate), " ")
		if len(parts) > 1 {
			timeStr = parts[1]
		}
	}

	temp := fmt.Sprintf("%v", now["temperature"])
	windDir := fmt.Sprintf("%v", now["windDirection"])
	windScale := fmt.Sprintf("%v", now["windScale"])
	humidity := fmt.Sprintf("%v", now["humidity"])

	return map[string]interface{}{
		"time":        timeStr,
		"temperature": temp,
		"wind":        fmt.Sprintf("%s %s", windDir, windScale),
		"humidity":    humidity,
	}
}
