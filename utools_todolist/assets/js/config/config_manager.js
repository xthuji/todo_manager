/**
 * 配置管理器 - 客户端版本
 * 统一的配置读取和管理工具
 */

// 缓存相关常量
const CACHE_KEYS = {
  PLUGIN_FEATURES: 'plugin_features_cache',
  PLUGIN_FEATURES_TIMESTAMP: 'plugin_features_timestamp'
};

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24小时缓存

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
 * 加载并解析配置
 * @returns {Object} 配置对象
 */
function loadConfig() {
  // 如果已有缓存配置，直接返回
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    let config = { ...DEFAULT_CONFIG };
    
    // 尝试从localStorage读取配置
    if (typeof localStorage !== 'undefined') {
      try {
        // 优先读取serverPort（可能由系统设置）
        const serverPort = localStorage.getItem('serverPort');
        if (serverPort && !isNaN(parseInt(serverPort))) {
          config.server.port = parseInt(serverPort);
          config.api.baseURL = `http://${config.server.host}:${config.server.port}`;
          console.log('✅ 从localStorage加载serverPort成功');
        }
        
        // 读取完整配置
        const storedConfig = localStorage.getItem('app_config');
        if (storedConfig) {
          config = { ...config, ...JSON.parse(storedConfig) };
          console.log('✅ 从localStorage加载配置成功');
        }
      } catch (e) {
        console.warn('⚠️ 无法从localStorage读取配置:', e);
      }
    }

    // 确保baseURL是正确的
    if (!config.api.baseURL || config.api.baseURL === DEFAULT_CONFIG.api.baseURL) {
      config.api.baseURL = `http://${config.server.host}:${config.server.port}`;
    }

    // 缓存配置
    cachedConfig = config;
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
function getConfig() {
  return loadConfig();
}

/**
 * 获取服务器配置
 * @returns {Object} 服务器配置
 */
function getServerConfig() {
  const config = loadConfig();
  return config.server || DEFAULT_CONFIG.server;
}

/**
 * 获取API配置
 * @returns {Object} API配置
 */
function getApiConfig() {
  const config = loadConfig();
  return config.api || DEFAULT_CONFIG.api;
}

/**
 * 获取服务器端口
 * @returns {number} 端口号
 */
function getPort() {
  // 优先从localStorage获取serverPort
  if (typeof localStorage !== 'undefined') {
    const serverPort = localStorage.getItem('serverPort');
    if (serverPort && !isNaN(parseInt(serverPort))) {
      return parseInt(serverPort);
    }
  }
  const serverConfig = getServerConfig();
  return serverConfig.port || DEFAULT_CONFIG.server.port;
}

/**
 * 获取服务器主机
 * @returns {string} 主机名
 */
function getHost() {
  const serverConfig = getServerConfig();
  return serverConfig.host || DEFAULT_CONFIG.server.host;
}

/**
 * 获取API基础URL
 * @returns {string} API基础URL
 */
function getBaseURL() {
  // 动态构建URL，确保使用最新的端口配置
  const host = getHost();
  const port = getPort();
  return `http://${host}:${port}`;
}

/**
 * 获取API超时时间
 * @returns {number} 超时时间（毫秒）
 */
function getApiTimeout() {
  const apiConfig = getApiConfig();
  return apiConfig.timeout || DEFAULT_CONFIG.api.timeout;
}

/**
 * 重新加载配置
 * @returns {Object} 重新加载后的配置
 */
function reloadConfig() {
  cachedConfig = null;
  return loadConfig();
}

/**
 * 更新配置并保存
 * @param {Object} newConfig 新的配置对象
 * @returns {boolean} 是否更新成功
 */
function updateConfig(newConfig) {
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
}

/**
 * 更新服务器端口
 * @param {number} port 新端口号
 */
function updateServerPort(port) {
  if (typeof localStorage !== 'undefined' && port && !isNaN(parseInt(port))) {
    localStorage.setItem('serverPort', port.toString());
    // 清除缓存，下次获取时会使用新端口
    cachedConfig = null;
    console.log(`✅ 服务器端口已更新为: ${port}`);
  }
}

/**
 * 从缓存获取plugin.json的features配置
 * @returns {Object|null} 缓存的配置数据或null
 */
function getPluginFeaturesFromCache() {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  
  try {
    const timestamp = localStorage.getItem(CACHE_KEYS.PLUGIN_FEATURES_TIMESTAMP);
    const cachedData = localStorage.getItem(CACHE_KEYS.PLUGIN_FEATURES);
    
    // 检查缓存是否存在且未过期
    if (timestamp && cachedData) {
      const cacheTime = parseInt(timestamp);
      const currentTime = new Date().getTime();
      
      // 24小时内的缓存视为有效
      if (currentTime - cacheTime < CACHE_DURATION) {
        console.log('✅ 从缓存加载plugin.json配置成功');
        return JSON.parse(cachedData);
      } else {
        console.log('⚠️ 缓存已过期，需要重新加载plugin.json配置');
      }
    }
  } catch (error) {
    console.error('❌ 读取缓存配置失败:', error);
  }
  
  return null;
}

/**
 * 将plugin.json的features配置保存到缓存
 * @param {Object} features 配置数据
 */
function savePluginFeaturesToCache(features) {
  if (typeof localStorage === 'undefined') {
    return;
  }
  
  try {
    const currentTime = new Date().getTime();
    localStorage.setItem(CACHE_KEYS.PLUGIN_FEATURES, JSON.stringify(features));
    localStorage.setItem(CACHE_KEYS.PLUGIN_FEATURES_TIMESTAMP, currentTime.toString());
    console.log('✅ 配置已保存到缓存');
  } catch (error) {
    console.error('❌ 保存配置到缓存失败:', error);
  }
}

/**
 * 获取plugin.json配置中的features信息
 * 优先从缓存获取，缓存不存在或过期时从文件读取
 * @returns {Promise<Array>} features配置数组
 */
async function getPluginFeatures() {
  // 尝试从缓存获取
  const cachedFeatures = getPluginFeaturesFromCache();
  if (cachedFeatures) {
    return cachedFeatures;
  }
  
  // 缓存不存在或过期，从文件读取
  try {
    console.log('📁 正在加载plugin.json配置...');
    const response = await fetch('./plugin.json');
    
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    
    const data = await response.json();
    const features = data.features || [];
    
    // 保存到缓存
    savePluginFeaturesToCache(features);
    
    console.log('✅ 成功加载plugin.json配置，共获取到', features.length, '个功能配置');
    return features;
  } catch (error) {
    console.error('❌ 加载plugin.json配置失败:', error);
    // 返回空数组作为备用
    return [];
  }
}

/**
 * 强制刷新plugin.json的features配置缓存
 * @returns {Promise<Array>} 刷新后的features配置数组
 */
async function refreshPluginFeaturesCache() {
  // 清除缓存
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(CACHE_KEYS.PLUGIN_FEATURES);
      localStorage.removeItem(CACHE_KEYS.PLUGIN_FEATURES_TIMESTAMP);
      console.log('✅ 缓存已清除');
    } catch (error) {
      console.error('❌ 清除缓存失败:', error);
    }
  }
  
  // 重新加载并返回最新配置
  return getPluginFeatures();
}

// 导出配置管理器
const configManager = {
  getConfig,
  getServerConfig,
  getApiConfig,
  getPort,
  getHost,
  getBaseURL,
  getApiTimeout,
  reloadConfig,
  updateConfig,
  updateServerPort,
  getPluginFeatures,
  refreshPluginFeaturesCache
};

// 根据环境导出
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  // Node.js环境（如构建过程）
  module.exports = configManager;
} else if (typeof define === 'function' && define.amd) {
  // AMD模块
  define([], function() {
    return configManager;
  });
} else {
  // 浏览器全局对象
  window.configManager = configManager;
}

export default configManager;