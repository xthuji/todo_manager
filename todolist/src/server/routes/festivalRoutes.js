const router = require('express').Router();
const {cacheUtil} = require('../utils/cacheUtil');
const {configManager} = require('../utils/configManager');

// 缓存配置
const CACHE_KEY = 'festival_config';

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
 * 使用cacheUtil.getWrappedData配合configManager获取配置
 */
router.get('/config', async (req, res) => {
    try {
        const config = await configManager.getConfig('festival');
        
        if (config) {
            console.log('获取节日配置成功');
            return res.json({
                data: config,
                timestamp: Date.now(),
                error: null
            });
        }

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

        await configManager.saveConfig('festival', configData);
        await clearConfigCache();

        console.log('节日配置文件保存成功，缓存已清除');
        res.json({data: {success: true, message: '节日配置保存成功'}, timestamp: Date.now()});
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
