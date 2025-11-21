const fs = require('fs').promises;
const path = require('path');
const router = require('express').Router();
const {cacheUtil} = require('../utils/cacheUtil');

// 配置路径
const FESTIVAL_CONFIG_PATH = path.join(__dirname, '../../data/config/festival_config.json');

// 缓存配置
const CACHE_KEY = 'festival_config';
let FESTIVAL_OPTIONS = {
    sourceFile: FESTIVAL_CONFIG_PATH,
    ttl: 0
};


/**
 * 清除配置缓存
 * @returns {boolean} 是否清除成功
 */
async function clearConfigCache() {
    try {
        cacheUtil.delete(CACHE_KEY);
        return true;
    } catch (error) {
        console.error('清除节日配置缓存失败:', error.message);
        return false;
    }
}

/**
 * 获取节日配置接口
 * 使用cacheUtil.getWrappedData配合sourceFile参数自动处理缓存和文件读取
 */
router.get('/config', async (req, res) => {
    try {
        // 使用getWrappedData并设置sourceFile参数，自动处理缓存逻辑和文件读取
        const wrappedData = cacheUtil.getWrappedData(CACHE_KEY, FESTIVAL_OPTIONS);

        if (wrappedData) {
            console.log('从缓存获取节日配置');
            return res.json({
                data: wrappedData.data,
                timestamp: wrappedData.timestamp,
                error: null
            });
        }

        // 如果getWrappedData返回null，表示文件不存在或读取失败
        console.error('节日配置文件不存在或无法读取');
        res.status(404).json({
            data: null,
            timestamp: Date.now(),
            error: {message: '节日配置文件不存在或无法读取'}
        });
    } catch (error) {
        console.error('获取节日配置失败:', error);
        res.status(500).json({
            data: null,
            timestamp: Date.now(),
            error: {message: '获取节日配置失败: ' + error.message}
        });
    }
});

/**
 * 保存节日配置接口
 * 保存配置后清除缓存，确保下次读取时获取最新数据
 */
router.post('/save', async (req, res) => {
    try {
        const configData = req.body;

        // 验证配置数据的基本结构
        if (!configData || typeof configData !== 'object') {
            return res.status(400).json({data: null, timestamp: Date.now(), error: {message: '配置数据格式无效'}});
        }

        // 确保必要的字段存在
        if (!Array.isArray(configData.festivals)) {
            return res.status(400).json({
                data: null,
                timestamp: Date.now(),
                error: {message: 'festivals字段必须是数组'}
            });
        }

        // 写入配置文件
        try {
            // 确保目录存在
            const configDir = path.dirname(FESTIVAL_CONFIG_PATH);
            try {
                await fs.access(configDir);
            } catch (error) {
                await fs.mkdir(configDir, {recursive: true});
            }

            await fs.writeFile(FESTIVAL_CONFIG_PATH, JSON.stringify(configData, null, 2), 'utf8');

            // 清除缓存，确保下次读取时获取最新数据
            await clearConfigCache();

            console.log('节日配置文件保存成功，缓存已清除');
            res.json({data: {success: true, message: '节日配置保存成功'}, timestamp: Date.now()});
        } catch (error) {
            console.error('写入节日配置文件失败:', error);
            res.status(500).json({
                data: null,
                timestamp: Date.now(),
                error: {message: '写入配置文件失败: ' + error.message}
            });
        }
    } catch (error) {
        console.error('保存节日配置失败:', error);
        res.status(500).json({
            data: null,
            timestamp: Date.now(),
            error: {message: '保存节日配置失败: ' + error.message}
        });
    }
});

module.exports = router;