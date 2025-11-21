/**
 * 浏览器环境初始化脚本
 * 用于在浏览器环境中初始化应用
 */

import { buildApiUrl } from './config/api.js';

// 检查服务器状态
async function checkServerStatus() {
    try {
        const response = await fetch(buildApiUrl('/api/status/check-status'), {
            method: 'GET',
            timeout: 3000
        });
        return response.status === 200;
    } catch (error) {
        console.log('服务器状态检查失败:', error.message);
        return false;
    }
}

// 初始化应用
async function initializeApp() {
    console.log('正在初始化应用...');
    
    // 检查服务器是否运行
    const serverRunning = await checkServerStatus();
    
    if (serverRunning) {
        console.log('服务器已运行，应用初始化完成');
    } else {
        console.warn('服务器未运行，某些功能可能不可用');
        // 在浏览器环境中，我们无法启动Node.js服务器
        // 显示用户提示
        showServerNotRunningWarning();
    }
}

// 显示服务器未运行警告
function showServerNotRunningWarning() {
    const warning = document.createElement('div');
    warning.className = 'fixed top-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded shadow-lg z-50';
    warning.innerHTML = `
        <div class="flex items-center">
            <div class="flex-shrink-0">
                <i class="fa fa-exclamation-triangle"></i>
            </div>
            <div class="ml-3">
                <p class="text-sm">
                    服务器未运行，请在uTools环境中启动插件或手动运行服务器
                </p>
            </div>
            <div class="ml-auto pl-3">
                <div class="-mx-1.5 -my-1.5">
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                            class="inline-flex bg-yellow-100 rounded-md p-1.5 hover:bg-yellow-200 transition-colors">
                        <i class="fa fa-times text-yellow-500"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(warning);
    
    // 5秒后自动隐藏
    setTimeout(() => {
        if (warning.parentElement) {
            warning.remove();
        }
    }, 5000);
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}