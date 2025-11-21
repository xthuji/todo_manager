/**
 * 配置管理器 - 统一的配置读取和管理工具
 * 支持Node.js和浏览器环境
 */

// 默认配置
const DEFAULT_CONFIG = {
  server: {
    port: 3000,
    host: '127.0.0.1'
  },
  api: {
    baseURL: 'http://127.0.0.1:3000',
    timeout: 10000
  }
};

// 缓存配置对象
let cachedConfig = null;

/**
 * 获取配置文件的绝对路径
 * @returns {string|null} 配置文件路径或null（浏览器环境）
 */
function getConfigFilePath() {
  if (typeof __dirname !== 'undefined') {
    // Node.js环境 - 使用相对路径解析
    const path = require('path');
    // 从utils目录向上两级找到data/config目录
    return path.join(__dirname, '../../data/config/config.json');
  }
  return null;
}

/**
 * 加载并解析配置文件
 * @returns {Object} 配置对象
 */
function loadConfig() {
  // 如果已有缓存配置，直接返回
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    let config = { ...DEFAULT_CONFIG };
    let isLoaded = false;

    // Node.js环境 - 尝试从文件系统读取
    if (typeof require !== 'undefined' && typeof __dirname !== 'undefined') {
      const fs = require('fs');
      const configPath = getConfigFilePath();
      
      if (configPath && fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8');
        config = { ...config, ...JSON.parse(configData) };
        console.log(`✅ 成功加载配置文件: ${configPath}`);
        isLoaded = true;
      } else {
        console.log(`⚠️  配置文件不存在，使用默认配置: ${configPath}`);
      }
    }
    
    // 浏览器环境 - 尝试从localStorage读取
    if (typeof localStorage !== 'undefined') {
      try {
        const storedConfig = localStorage.getItem('app_config');
        if (storedConfig) {
          config = { ...config, ...JSON.parse(storedConfig) };
          console.log('✅ 从localStorage加载配置成功');
          isLoaded = true;
        }
      } catch (e) {
        console.warn('⚠️ 无法从localStorage读取配置:', e);
      }
    }

    // 确保baseURL是正确的，基于host和port
    if (!config.api.baseURL || config.api.baseURL === DEFAULT_CONFIG.api.baseURL) {
      config.api.baseURL = `http://${config.server.host || DEFAULT_CONFIG.server.host}:${config.server.port || DEFAULT_CONFIG.server.port}`;
    }

    // 缓存配置
    cachedConfig = config;
    
    // 如果成功加载了配置，并且在浏览器环境，保存到localStorage
    if (isLoaded && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('app_config', JSON.stringify(config));
      } catch (e) {
        console.warn('⚠️ 无法保存配置到localStorage:', e);
      }
    }

    return config;
  } catch (error) {
    console.error('❌ 加载配置失败:', error);
    // 返回默认配置
    cachedConfig = DEFAULT_CONFIG;
    return DEFAULT_CONFIG;
  }
}

/**
 * 获取完整配置对象
 * @returns {Object} 完整配置
 */
exports.getConfig = function() {
  return loadConfig();
};

/**
 * 获取服务器配置
 * @returns {Object} 服务器配置
 */
exports.getServerConfig = function() {
  const config = loadConfig();
  return config.server || DEFAULT_CONFIG.server;
};

/**
 * 获取API配置
 * @returns {Object} API配置
 */
exports.getApiConfig = function() {
  const config = loadConfig();
  return config.api || DEFAULT_CONFIG.api;
};

/**
 * 获取服务器端口
 * @returns {number} 端口号
 */
exports.getPort = function() {
  const serverConfig = exports.getServerConfig();
  return serverConfig.port || DEFAULT_CONFIG.server.port;
};

/**
 * 获取服务器主机
 * @returns {string} 主机名
 */
exports.getHost = function() {
  const serverConfig = exports.getServerConfig();
  return serverConfig.host || DEFAULT_CONFIG.server.host;
};

/**
 * 获取API基础URL
 * @returns {string} API基础URL
 */
exports.getBaseURL = function() {
  const apiConfig = exports.getApiConfig();
  return apiConfig.baseURL || `http://${exports.getHost()}:${exports.getPort()}`;
};

/**
 * 获取API超时时间
 * @returns {number} 超时时间（毫秒）
 */
exports.getApiTimeout = function() {
  const apiConfig = exports.getApiConfig();
  return apiConfig.timeout || DEFAULT_CONFIG.api.timeout;
};

/**
 * 重新加载配置
 * @returns {Object} 重新加载后的配置
 */
exports.reloadConfig = function() {
  cachedConfig = null;
  return loadConfig();
};

/**
 * 更新配置并保存（仅浏览器环境有效）
 * @param {Object} newConfig 新的配置对象
 * @returns {boolean} 是否更新成功
 */
exports.updateConfig = function(newConfig) {
  try {
    if (typeof localStorage !== 'undefined' && newConfig && typeof newConfig === 'object') {
      const currentConfig = loadConfig();
      const updatedConfig = { ...currentConfig, ...newConfig };
      localStorage.setItem('app_config', JSON.stringify(updatedConfig));
      cachedConfig = updatedConfig;
      return true;
    }
  } catch (error) {
    console.error('❌ 更新配置失败:', error);
  }
  return false;
};

// 为浏览器环境提供ES模块导出方式
if (typeof module !== 'undefined' && module.exports) {
  // Node.js环境 - 使用CommonJS导出
  module.exports = exports;
} else {
  // 浏览器环境 - 挂载到全局对象
  window.configManager = exports;
}