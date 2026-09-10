package routes

import (
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/gin-gonic/gin"
	"todolist-go/app/utils"
)

// FileOptions 缓存配置
var fileOptions = utils.CacheOptions{AllowExpired: false, TTL: 300000}

// RegisterFileRoutes 注册文件相关路由
func RegisterFileRoutes(router *gin.Engine) {
	fileGroup := router.Group("/api/file")
	fileGroup.GET("/scan", scanFiles)
	fileGroup.GET("/read/:filename", readFile)
	fileGroup.POST("/write/:filename", writeFile)
}

// scanFilesLogic 扫描文件系统
func scanFilesLogic() map[string]interface{} {
	dataDir := utils.ConfigUtilInstance.GetDataDir()
	files, err := os.ReadDir(dataDir)
	if err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}

	var todoFiles []map[string]interface{}
	for _, file := range files {
		if !file.IsDir() && strings.HasPrefix(file.Name(), "todo") && strings.HasSuffix(file.Name(), ".txt") {
			fileData := map[string]interface{}{"name": file.Name(), "exists": true}
			if info, err := file.Info(); err == nil {
				fileData["mtime"] = info.ModTime().UnixMilli()
			}
			todoFiles = append(todoFiles, fileData)
		}
	}

	sort.Slice(todoFiles, func(i, j int) bool {
		mi, _ := todoFiles[i]["mtime"].(int64)
		mj, _ := todoFiles[j]["mtime"].(int64)
		return mi > mj
	})

	defaultFile := "todo.txt"
	if len(todoFiles) > 0 {
		defaultFile, _ = todoFiles[0]["name"].(string)
	}
	return map[string]interface{}{"success": true, "files": todoFiles, "defaultFile": defaultFile}
}

// scan 扫描文件接口
func scanFiles(c *gin.Context) {
	cachedData := utils.CacheUtilInstance.GetWrappedData("file_list", fileOptions)
	if cachedData != nil {
		c.JSON(http.StatusOK, cachedData)
		return
	}

	data := scanFilesLogic()
	responseData := map[string]interface{}{
		"success": data["success"], "files": data["files"], "defaultFile": data["defaultFile"],
	}
	utils.CacheUtilInstance.SetData("file_list", responseData, fileOptions)
	cachedData = utils.CacheUtilInstance.GetWrappedData("file_list", fileOptions)
	c.JSON(http.StatusOK, cachedData)
}

// readFileLogic 读取文件
func readFileLogic(filename string) map[string]interface{} {
	filePath := filepath.Join(utils.ConfigUtilInstance.GetDataDir(), filename)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		os.WriteFile(filePath, []byte{}, 0644)
	}
	content, err := os.ReadFile(filePath)
	if err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}
	return map[string]interface{}{"success": true, "content": string(content)}
}

// validateFilename 验证文件名
func validateFilename(filename string) bool {
	return strings.HasPrefix(filename, "todo") && strings.HasSuffix(filename, ".txt")
}

// clearFileCache 清除文件缓存
func clearFileCache(specificFile string) {
	if specificFile != "" {
		utils.CacheUtilInstance.Delete(utils.CacheUtilInstance.GenerateFileCacheKey(specificFile))
	}
	utils.CacheUtilInstance.Delete("file_list")
}

// read 读取文件内容接口
func readFile(c *gin.Context) {
	filename := c.Param("filename")
	if !validateFilename(filename) {
		c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "message": "不允许访问此文件"})
		return
	}

	cacheKey := utils.CacheUtilInstance.GenerateFileCacheKey(filename)
	cachedData := utils.CacheUtilInstance.GetWrappedData(cacheKey, fileOptions)
	if cachedData != nil {
		c.JSON(http.StatusOK, cachedData)
		return
	}

	data := readFileLogic(filename)
	responseData := map[string]interface{}{"success": data["success"], "content": data["content"]}
	utils.CacheUtilInstance.SetData(cacheKey, responseData, fileOptions)
	cachedData = utils.CacheUtilInstance.GetWrappedData(cacheKey, fileOptions)
	c.JSON(http.StatusOK, cachedData)
}

// write 写入文件内容接口
func writeFile(c *gin.Context) {
	filename := c.Param("filename")
	if !validateFilename(filename) {
		c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "message": "不允许访问此文件"})
		return
	}

	var req struct{ Content string `json:"content"` }
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "message": "请求数据格式错误"})
		return
	}

	filePath := filepath.Join(utils.ConfigUtilInstance.GetDataDir(), filename)
	if err := os.WriteFile(filePath, []byte(req.Content), 0644); err != nil {
		c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "写入文件失败", "error": err.Error()})
		return
	}

	clearFileCache(filename)
	c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "文件保存成功"})
}
