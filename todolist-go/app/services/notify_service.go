package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os/exec"
	"regexp"
	"strings"
	"time"

	"todolist-go/app/utils"
)

// 全局配置数据
var notifyConfig map[string]interface{}

// GetNotifyConfig 获取通知配置
func GetNotifyConfig() map[string]interface{} {
	if notifyConfig != nil {
		return notifyConfig
	}
	LoadNotifyConfig()
	return notifyConfig
}

// LoadNotifyConfig 加载通知配置
func LoadNotifyConfig() map[string]interface{} {
	if notifyConfig != nil {
		return notifyConfig
	}

	configFile := utils.ConfigUtilInstance.GetConfigDir() + "/notify_config.json"
	utils.LoggerInstance.Info("[Config] 尝试加载通知配置", "config_file", configFile)

	if _, err := exec.Command("test", "-f", configFile).CombinedOutput(); err != nil {
		utils.LoggerInstance.Warn("[Config] 配置文件不存在", "config_file", configFile)
		return nil
	}

	data, err := ioutil.ReadFile(configFile)
	if err != nil {
		utils.LoggerInstance.Error("[Config] 读取配置文件失败", "error", err)
		return nil
	}

	if err := json.Unmarshal(data, &notifyConfig); err != nil {
		utils.LoggerInstance.Error("[Config] 解析配置文件失败", "error", err)
		return nil
	}

	utils.LoggerInstance.Info("[Config] 加载通知配置成功")
	return notifyConfig
}

// SendMessage 发送通知
func SendMessage(typeName string, targetUserInfo map[string]interface{}, message string) map[string]interface{} {
	utils.LoggerInstance.Info("准备发送通知",
		"type", typeName,
		"phone_number", getStr2(targetUserInfo, "phoneNumber", "unknown"),
		"wechat_open_id", getStr2(targetUserInfo, "wechatOpenId", "unknown"),
		"content", message)

	statusList := []bool{}
	messageList := []string{}

	if notifyConfig == nil {
		LoadNotifyConfig()
	}

	config, _ := notifyConfig[typeName].(map[string]interface{})
	notifyTypes, _ := config["notifyTypes"].([]interface{})

	containsSMS, containsWechat := false, false
	for _, t := range notifyTypes {
		if t == "sms" {
			containsSMS = true
		}
		if t == "wechat" {
			containsWechat = true
		}
	}

	if containsSMS {
		smsResult := SendSMSMessage(getStr2(targetUserInfo, "phoneNumber", ""), message)
		statusList = append(statusList, smsResult["success"] == true)
		if smsResult["success"] != true {
			messageList = append(messageList, fmt.Sprintf("短信通知发送失败: %s", smsResult["message"]))
		}
	} else {
		messageList = append(messageList, "短信通知未启用，跳过发送")
	}

	if containsWechat {
		wechatResult := SendWechatMessage(getStr2(targetUserInfo, "wechatOpenId", ""), message)
		statusList = append(statusList, wechatResult["success"] == true)
		if wechatResult["success"] != true {
			messageList = append(messageList, fmt.Sprintf("微信通知发送失败: %s", wechatResult["message"]))
		}
	} else {
		messageList = append(messageList, "微信通知未启用，跳过发送")
	}

	success := true
	for _, s := range statusList {
		if !s {
			success = false
			break
		}
	}

	messageStr := strings.Join(messageList, "\n")
	if messageStr == "" {
		messageStr = fmt.Sprintf("%s通知已发送", typeName)
	}

	return map[string]interface{}{"success": success, "message": messageStr}
}

// SendSMSMessage 通过Mac的Message.app发送短信
func SendSMSMessage(phoneNumber, message string) map[string]interface{} {
	phoneRegex := `^(\+?\d{1,4})?[\s-]?\d{10,15}$`
	emailRegex := `^[^\s@]+@[^\s@]+\.[^\s@]+$`
	ts := time.Now().Format("2006-01-02T15:04:05")

	if phoneNumber == "" {
		return map[string]interface{}{"phoneNumber": phoneNumber, "success": false, "message": "手机号码或邮箱为空", "timestamp": ts}
	}

	if matched, _ := regexp.MatchString(phoneRegex, phoneNumber); !matched {
		if matched, _ := regexp.MatchString(emailRegex, phoneNumber); !matched {
			return map[string]interface{}{"phoneNumber": phoneNumber, "success": false, "message": "无效的手机号码或邮箱格式", "timestamp": ts}
		}
	}

	escapedMessage := strings.ReplaceAll(strings.ReplaceAll(message, "\"", "\\\""), "\n", "\\\n")
	applescript := fmt.Sprintf(`
    tell application "Messages"
        set targetService to 1st service whose service type = iMessage
        set targetBuddy to buddy "%s" of targetService
        send "%s" to targetBuddy
    end tell
    `, phoneNumber, escapedMessage)

	cmd := exec.Command("osascript", "-e", applescript)
	output, err := cmd.CombinedOutput()
	if err != nil {
		utils.LoggerInstance.Error("发送短信失败", "error", err, "output", output)
		return map[string]interface{}{"phoneNumber": phoneNumber, "success": false, "message": fmt.Sprintf("短信发送失败: %v", err), "timestamp": ts}
	}

	if len(output) > 0 {
		utils.LoggerInstance.Warn("发送短信时产生警告", "output", output)
	}

	utils.LoggerInstance.Info("短信发送成功!")
	return map[string]interface{}{"phoneNumber": phoneNumber, "messageLength": len(message), "success": true, "timestamp": ts}
}

// GetWechatAccessToken 获取微信公众号access_token
func GetWechatAccessToken() string {
	if utils.USE_CACHE {
		cachedData := utils.CacheUtilInstance.GetData("wechat_access_token", utils.CacheOptions{})
		if cachedData != nil {
			if dataMap, ok := cachedData.(map[string]interface{}); ok {
				accessToken := getStr2(dataMap, "access_token", "")
				expireTime, _ := dataMap["expire_time"].(float64)
				if accessToken != "" && expireTime > float64(time.Now().UnixMilli())+600000 {
					utils.LoggerInstance.Info("使用缓存的微信公众号access_token")
					return accessToken
				}
			}
		}
	}

	if notifyConfig == nil {
		LoadNotifyConfig()
	}

	weatherConfig, _ := notifyConfig["weather"].(map[string]interface{})
	wechatAppID := getStr2(weatherConfig, "wechatAppId", "")
	wechatAppSecret := getStr2(weatherConfig, "wechatAppSecret", "")

	if wechatAppID == "" || wechatAppSecret == "" {
		utils.LoggerInstance.Warn("微信公众号配置不完整，缺少appId或appSecret")
		return ""
	}

	url := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=%s&secret=%s", wechatAppID, wechatAppSecret)
	utils.LoggerInstance.Info("正在请求微信公众号access_token", "app_id", wechatAppID)

	resp, err := http.Get(url)
	if err != nil {
		utils.LoggerInstance.Error("获取微信公众号access_token失败", "error", err)
		return ""
	}
	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)
	var tokenResp map[string]interface{}
	json.Unmarshal(body, &tokenResp)

	if accessToken, ok := tokenResp["access_token"].(string); ok && accessToken != "" {
		now := float64(time.Now().UnixMilli())
		expiresIn, _ := tokenResp["expires_in"].(float64)
		expireTime := now + expiresIn*1000
		utils.LoggerInstance.Info("微信公众号access_token获取成功", "expire_time", time.UnixMilli(int64(expireTime)).Format("2006-01-02 15:04:05"))

		if utils.USE_CACHE {
			utils.CacheUtilInstance.SetData("wechat_access_token", map[string]interface{}{
				"access_token": accessToken, "expire_time": expireTime,
			}, utils.CacheOptions{TTL: int64(expiresIn) * 1000})
		}
		return accessToken
	}

	utils.LoggerInstance.Error("获取微信公众号access_token失败", "response", tokenResp)
	return ""
}

// SendWechatMessage 发送微信消息
func SendWechatMessage(wechatOpenID, message string) map[string]interface{} {
	ts := time.Now().Format("2006-01-02T15:04:05")
	if matched, _ := regexp.MatchString(`^[a-zA-Z0-9-]+$`, wechatOpenID); !matched || wechatOpenID == "" {
		return map[string]interface{}{"wechatOpenId": wechatOpenID, "success": false, "message": "无效的微信OpenID格式", "timestamp": ts}
	}

	accessToken := GetWechatAccessToken()
	if accessToken == "" {
		return map[string]interface{}{"wechatOpenId": wechatOpenID, "success": false, "message": "获取微信access_token失败", "timestamp": ts}
	}

	url := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=%s", accessToken)
	utils.LoggerInstance.Info("准备发送微信消息", "wechat_open_id", wechatOpenID)

	payload := map[string]interface{}{"touser": wechatOpenID, "msgtype": "text", "text": map[string]interface{}{"content": message}}
	jsonData, _ := json.Marshal(payload)

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		utils.LoggerInstance.Error("发送微信消息失败", "error", err)
		return map[string]interface{}{"wechatOpenId": wechatOpenID, "success": false, "message": fmt.Sprintf("发送失败: %v", err), "timestamp": ts}
	}
	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)
	var wechatResp map[string]interface{}
	json.Unmarshal(body, &wechatResp)

	errCode, _ := wechatResp["errcode"].(float64)
	if errCode == 0 {
		utils.LoggerInstance.Info("微信消息发送成功", "wechat_open_id", wechatOpenID)
		return map[string]interface{}{"wechatOpenId": wechatOpenID, "messageLength": len(message), "success": true, "timestamp": ts}
	}

	errMsg := getStr2(wechatResp, "errmsg", "未知错误")
	utils.LoggerInstance.Error("发送微信消息失败", "err_code", int(errCode), "err_msg", errMsg)
	return map[string]interface{}{"wechatOpenId": wechatOpenID, "success": false, "message": fmt.Sprintf("微信API错误: %s", errMsg), "timestamp": ts}
}

// getStr2 从map中安全获取字符串（避免与auto_weather_notify_service中的getStr冲突）
func getStr2(m map[string]interface{}, key string, defaultVal ...string) string {
	if val, ok := m[key].(string); ok {
		return val
	}
	if len(defaultVal) > 0 {
		return defaultVal[0]
	}
	return ""
}
