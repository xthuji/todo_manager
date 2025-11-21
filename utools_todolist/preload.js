// 增强版preload.js - 修复自动启动问题
const { spawn } = require('child_process');
const net = require('net');
const fs = require('fs');
const path = require('path');

// 确保在uTools环境中存在window对象
if (typeof window === 'undefined') {
    global.window = {
        addEventListener: () => {},
        postMessage: (message) => {
            console.log('📨 postMessage:', message);
            // 尝试发送到uTools主进程
            if (typeof utools !== 'undefined' && utools.sendToMain) {
                utools.sendToMain(message);
            }
        }
    };
}

// 全局变量存储服务器进程
let serverProcess = null;
let isStarting = false;
let startupTimeout = null;

// 检查端口是否可用
function checkPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(port, () => {
            server.close(() => resolve(true));
        });
        server.on('error', () => resolve(false));
    });
}

// 获取Node.js可执行文件路径
function getNodePath() {
    const possiblePaths = [
        '/usr/local/bin/node',
        '/usr/bin/node',
        '/opt/homebrew/bin/node',
        process.execPath,
        '/usr/local/Cellar/node/*/bin/node'
    ];
    
    for (const nodePath of possiblePaths) {
        if (fs.existsSync(nodePath)) {
            return nodePath;
        }
    }
    
    // 如果都找不到，使用当前进程的node路径
    return process.execPath;
}

// 启动后端服务器
function startBackendServer() {
    return new Promise((resolve, reject) => {
        if (isStarting) {
            console.log('⏳ 服务器正在启动中，请稍候...');
            return resolve(false);
        }
        
        isStarting = true;
        const serverPath = path.join(__dirname, 'server.js');
        const nodePath = getNodePath();
        
        console.log(`🚀 启动后端服务器: ${serverPath}`);
        console.log(`📦 使用Node.js路径: ${nodePath}`);
        
        // 启动服务器进程
        serverProcess = spawn(nodePath, [serverPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: __dirname,
            detached: false
        });
        
        let startupCompleted = false;
        const startupTimeout = setTimeout(() => {
            if (!startupCompleted) {
                console.log('⏰ 服务器启动超时');
                isStarting = false;
                if (serverProcess) {
                    serverProcess.kill('SIGTERM');
                    serverProcess = null;
                }
                resolve(false);
            }
        }, 15000); // 15秒超时
        
        // 监听服务器输出
        serverProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log(`📤 服务器输出: ${output.trim()}`);
            
            if (output.includes('服务器运行在') || output.includes('Server running')) {
                if (!startupCompleted) {
                    startupCompleted = true;
                    clearTimeout(startupTimeout);
                    isStarting = false;
                    console.log('✅ 后端服务器启动成功');
                    resolve(true);
                }
            }
        });
        
        serverProcess.stderr.on('data', (data) => {
            const error = data.toString();
            console.log(`📤 服务器错误: ${error.trim()}`);
        });
        
        serverProcess.on('error', (error) => {
            console.log('❌ 服务器进程错误:', error.message);
            clearTimeout(startupTimeout);
            isStarting = false;
            serverProcess = null;
            resolve(false);
        });
        
        serverProcess.on('exit', (code, signal) => {
            console.log(`🔚 服务器进程退出，代码: ${code}, 信号: ${signal}`);
            if (!startupCompleted) {
                clearTimeout(startupTimeout);
                isStarting = false;
                serverProcess = null;
                resolve(false);
            }
        });
    });
}

// 带重试的启动函数
async function startBackendServerWithRetry(maxRetries = 3) {
    console.log('🔄 开始启动后端服务器（带重试机制）...');
    
    for (let i = 1; i <= maxRetries; i++) {
        console.log(`📍 启动尝试 ${i}/${maxRetries}`);
        
        // 检查端口是否可用
        const portAvailable = await checkPortAvailable(3000);
        if (!portAvailable) {
            console.log('⚠️ 端口3000被占用，尝试清理...');
            await killPort3000();
            // 等待一秒后重新检查
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        const success = await startBackendServer();
        if (success) {
            console.log('🎉 后端服务器启动成功！');
            
            // 等待服务器完全就绪后再通知前端
            await waitForServerReady();
            
            // 通知前端服务器已就绪
            if (typeof window !== 'undefined' && window.postMessage) {
                window.postMessage({
                    type: 'server-ready',
                    status: 'success',
                    port: 3000
                });
            }
            
            return true;
        }
        
        if (i < maxRetries) {
            console.log(`⏳ 等待 ${i * 2} 秒后重试...`);
            await new Promise(resolve => setTimeout(resolve, i * 2000));
        }
    }
    
    console.log('❌ 所有启动尝试均失败');
    
    // 通知前端服务器启动失败
    if (typeof window !== 'undefined' && window.postMessage) {
        window.postMessage({
            type: 'server-ready',
            status: 'failed',
            error: 'Failed to start backend server after multiple attempts'
        });
    }
    
    return false;
}

// 终止占用端口3000的进程
async function killPort3000() {
    return new Promise((resolve) => {
        const { exec } = require('child_process');
        
        // 查找占用端口3000的进程
        exec('lsof -ti:3000', (error, stdout, stderr) => {
            if (stdout.trim()) {
                const pids = stdout.trim().split('\n');
                console.log(`🔍 发现占用端口3000的进程: ${pids.join(', ')}`);
                
                let killedCount = 0;
                pids.forEach(pid => {
                    // 检查是否是Node.js进程
                    exec(`ps -p ${pid} -o comm=`, (psError, psStdout) => {
                        const isNodeProcess = psStdout.trim().includes('node') || 
                                            psStdout.trim().includes('Trae');
                        
                        if (isNodeProcess) {
                            console.log(`🗑️ 终止进程 ${pid} (${psStdout.trim()})`);
                            exec(`kill -9 ${pid}`, () => {
                                killedCount++;
                                if (killedCount === pids.length) {
                                    setTimeout(resolve, 1000);
                                }
                            });
                        } else {
                            console.log(`⚠️ 跳过非Node.js进程 ${pid} (${psStdout.trim()})`);
                            killedCount++;
                            if (killedCount === pids.length) {
                                setTimeout(resolve, 500);
                            }
                        }
                    });
                });
            } else {
                resolve();
            }
        });
    });
}

// 等待服务器完全就绪
async function waitForServerReady(maxAttempts = 10, interval = 1000) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const isReady = await checkServerRunning();
            if (isReady) {
                console.log('✅ 服务器已完全就绪，可以接受请求');
                return true;
            }
            console.log(`⏳ 等待服务器就绪... (${i + 1}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, interval));
        } catch (error) {
            console.log(`❌ 检查服务器状态失败: ${error.message}`);
        }
    }
    console.log('⚠️ 服务器启动超时，但继续执行');
    return false;
}

// 检查服务器是否已运行
function checkServerRunning() {
    return new Promise((resolve) => {
        const http = require('http');
        const req = http.get('http://127.0.0.1:3000/api/status/check-status', (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(3000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

// uTools环境检测和启动逻辑
if (typeof utools !== 'undefined') {
    console.log('Running in uTools environment');
    
    // 检查服务器是否已运行
    checkServerRunning().then(async (isRunning) => {
        if (!isRunning) {
            console.log('检查服务器是否已运行...');
            // 启动后端服务器
            await startBackendServerWithRetry();
        } else {
            console.log('服务器已在运行');
            // 等待服务器完全就绪后再通知前端
            await waitForServerReady();
            // 通知前端服务器已就绪
            if (typeof window !== 'undefined' && window.postMessage) {
                window.postMessage({
                    type: 'server-ready',
                    status: 'already-running',
                    port: 3000
                });
            }
        }
    });
    
    // 监听插件进入事件
    if (utools.onPluginEnter) {
        utools.onPluginEnter((callback) => {
            console.log('uTools plugin entered');
            // 确保服务器在插件进入时启动
            startBackendServerWithRetry();
        });
    }
    
    // 监听插件退出事件
    if (utools.onPluginOut) {
        utools.onPluginOut(() => {
            console.log('uTools plugin exiting');
            // 关闭服务器进程
            if (serverProcess) {
                serverProcess.kill('SIGTERM');
                serverProcess = null;
            }
        });
    }
} else {
    console.log('Not running in uTools environment');
}

// 浏览器环境适配
if (typeof window !== 'undefined') {
    // 导出API供前端使用
    window.utoolsAPI = {
        checkServerStatus: checkServerRunning,
        startServer: startBackendServerWithRetry
    };
}

// 导出模块
module.exports = {
    startBackendServer,
    startBackendServerWithRetry,
    checkServerRunning,
    killPort3000
};