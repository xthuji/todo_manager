const fs = require('fs');
const path = require('path');


/**
 * 通用缓存处理函数，根据参数决定执行读取或写入操作
 * @param {string} cacheKey - 缓存的唯一标识符（如IP地址）
 * @param {Object|null} data - 要缓存的数据，如果为null则执行读取操作
 * @param {Object} options - 配置项
 * @param {string} options.cacheDir - 缓存目录路径
 * @param {string} options.cachePrefix - 缓存文件前缀
 * @param {number} options.ttl - 缓存过期时间（毫秒）
 * @param {string} options.extension - 缓存文件扩展名
 * @returns {Object|null} 读取模式下返回缓存的数据，写入模式下返回null
 */
export function handleCache(cacheKey, data = null, options = {}) {
    try {
        // 清理缓存键，避免文件系统特殊字符问题
        const safeCacheKey = cacheKey.replace(/\./g, '_');
        const cacheFile = path.join(
            options.cacheDir,
            `${options.cachePrefix}${safeCacheKey}.${options.extension}`
        );
        
        // 确保缓存目录存在
        if (!fs.existsSync(options.cacheDir)) {
            fs.mkdirSync(options.cacheDir, { recursive: true });
        }
        
        // 写入模式
        if (data !== null) {
            fs.writeFileSync(cacheFile, JSON.stringify({
                timestamp: Date.now(),
                data: data
            }), 'utf8');
            return null;
        }
        
        // 读取模式
        if (fs.existsSync(cacheFile)) {
            const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            // 检查缓存是否有效
            if (Date.now() - cachedData.timestamp < options.ttl) {
                return cachedData.data;
            }
        }
    } catch (error) {
        console.error(`缓存${data !== null ? '写入' : '读取'}失败:`, error);
    }
    return null;
}
