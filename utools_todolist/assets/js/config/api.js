/**
 * API配置文件
 * 用于管理不同环境下的API基地址
 */

// 检测是否在uTools环境中运行
const isUToolsEnvironment = typeof utools !== 'undefined';

// API配置
export const API_CONFIG = {
    // uTools环境下的API配置
    utools: {
        baseURL: 'http://127.0.0.1:3000',
        timeout: 5000
    },
    // 开发环境下的API配置
    development: {
        baseURL: 'http://localhost:3000',
        timeout: 5000
    },
    // 生产环境下的API配置
    production: {
        baseURL: 'http://localhost:3000',
        timeout: 5000
    }
};

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
    const config = getApiConfig();
    const baseURL = config.baseURL;
    
    // 确保path以/开头
    const apiPath = path.startsWith('/') ? path : `/${path}`;
    
    // 确保baseURL不以/结尾
    const cleanBaseURL = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
    
    return `${cleanBaseURL}${apiPath}`;
}

// 导出当前配置
export const currentApiConfig = getApiConfig();