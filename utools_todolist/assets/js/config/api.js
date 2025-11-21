/**
 * API配置文件
 * 使用统一的配置管理器管理API基地址
 */

// 检测是否在uTools环境中运行
const isUToolsEnvironment = typeof utools !== 'undefined';

// 导入配置管理器
import configManager from './config_manager.js';

// 获取服务器主机和端口
const getServerHost = () => {
    return configManager.getHost();
};

const getServerPort = () => {
    return configManager.getPort();
};

// 获取API基础URL
const getBaseUrl = () => {
    return configManager.getBaseURL();
};

// API配置
export const API_CONFIG = {
    // uTools环境下的API配置
    utools: {
        baseURL: getBaseUrl(),
        timeout: configManager.getApiTimeout()
    },
    // 开发环境下的API配置
    development: {
        baseURL: getBaseUrl(),
        timeout: configManager.getApiTimeout()
    },
    // 生产环境下的API配置
    production: {
        baseURL: getBaseUrl(),
        timeout: configManager.getApiTimeout()
    }
};

// 导出配置加载相关的函数，便于其他模块使用
export { getServerHost, getServerPort, getBaseUrl };

// 获取当前环境的API配置
export function getApiConfig() {
    if (isUToolsEnvironment) {
        return API_CONFIG.utools;
    }
    
    // 根据hostname判断环境
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return API_CONFIG.development;
    } else {
        return API_CONFIG.production;
    }
}

// 构建完整的API URL
export function buildApiUrl(path) {
    // 参数校验
    if (!path || typeof path !== 'string') {
        console.error('buildApiUrl: path参数必须是有效的字符串');
        return getApiConfig().baseURL; // 返回基础URL作为兜底
    }
    
    const config = getApiConfig();
    const baseURL = config.baseURL;
    const trimmedPath = path.trim();
    
    // 处理已包含完整URL的情况
    if (trimmedPath.startsWith('http://') || trimmedPath.startsWith('https://')) {
        return trimmedPath;
    }
    
    // 确保path以/开头
    const apiPath = trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`;
    
    // 确保baseURL不以/结尾
    const cleanBaseURL = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
    
    return `${cleanBaseURL}${apiPath}`;
}

// 导出当前配置
export const currentApiConfig = getApiConfig();