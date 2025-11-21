// uTools插件预加载脚本
// 用于在uTools环境中提供API适配并启动后端服务器

const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

// 确保在Node.js环境中存在window对象
if (typeof window === 'undefined') {
    global.window = {};
}

let serverProcess = null;
let startupRetries = 0;
const MAX_RETRIES = 3;

// 检查端口是否被占用
function checkPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        
        server.listen(port, '127.0.0.1', () => {
            server.once('close', () => {
                resolve(true);
            });
            server.close();
        });
        
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.log(`端口${port}被占用`);
                resolve(false);
            } else {
                console.log(`端口检查错误:`, error.message);
                resolve(false);
            }
        });
    });
}

// 检查服务器是否已启动
function checkServerRunning() {
    return new Promise((resolve) => {
        const http = require('http');
        const req = http.request({
            hostname: '127.0.0.1',
            port: 3000,
            path: '/api/status/check-status',
            method: 'GET',
            timeout: 3000
        }, (res) => {
            resolve(res.statusCode === 200);
        });
        
        req.on('error', () => {
            resolve(false);
        });
        
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });
        
        req.end();
    });
}

// 获取Node.js可执行文件路径
function getNodeExecutablePath() {
    const { execSync } = require('child_process');
    
    try {
        // 尝试从多个常见位置获取Node.js路径
        const possiblePaths = [
            '/usr/local/bin/node',
            '/usr/bin/node',
            '/opt/homebrew/bin/node',
            process.execPath, // 当前Node.js进程的路径
        ];
        
        // 首先尝试使用当前进程的Node.js路径
        if (process.execPath && require('fs').existsSync(process.execPath)) {
            return process.execPath;
        }
        
        // 尝试通过which命令查找
        try {
            const whichResult = execSync('which node', { encoding: 'utf8' }).trim();
            if (whichResult && require('fs').existsSync(whichResult)) {
                return whichResult;
            }
        } catch (e) {
            console.log('which命令失败，尝试其他方法');
        }
        
        // 遍历可能的路径
        for (const nodePath of possiblePaths) {
            if (require('fs').existsSync(nodePath)) {
                return nodePath;
            }
        }
        
        // 如果都找不到，返回'node'作为最后的尝试
        return 'node';
    } catch (error) {
        console.error('获取Node.js路径失败:', error);
        return 'node';
    }
}

// 启动后端服务器
async function startBackendServer() {
    if (serverProcess && !serverProcess.killed) {
        console.log('后端服务器已在运行');
        return true;
    }
    
    // 首先检查服务器是否已经在运行
    console.log('检查服务器是否已运行...');
    const isRunning = await checkServerRunning();
    if (isRunning) {
        console.log('服务器已在运行，无需重复启动');
        return true;
    }
    
    // 检查端口是否可用
    console.log('检查端口3000是否可用...');
    const portAvailable = await checkPortAvailable(3000);
    if (!portAvailable) {
        console.log('端口3000已被占用，但服务器未响应');
        console.log('尝试清理占用端口的进程...');
        
        // 尝试获取占用端口的进程信息
        try {
            const { execSync } = require('child_process');
            const pids = execSync('lsof -ti:3000', { encoding: 'utf8' }).trim().split('\n').filter(pid => pid);
            console.log('发现占用端口3000的进程:', pids);
            
            // 只终止不是当前uTools相关的Node.js进程
            for (const pid of pids) {
                try {
                    const cmd = execSync(`ps -p ${pid} -o command=`, { encoding: 'utf8' }).trim();
                    console.log(`进程${pid}: ${cmd}`);
                    
                    // 如果是Node.js进程且不是当前进程，尝试终止
                    if (cmd.includes('node') && !cmd.includes(process.pid.toString())) {
                        console.log(`尝试终止进程${pid}...`);
                        execSync(`kill -9 ${pid}`, { encoding: 'utf8' });
                        console.log(`已终止进程${pid}`);
                    }
                    // 如果是Trae CN Helper等开发工具进程，也尝试终止
                    else if (cmd.includes('Trae') || cmd.includes('trae')) {
                        console.log(`发现开发工具进程${pid}，尝试终止...`);
                        execSync(`kill -9 ${pid}`, { encoding: 'utf8' });
                        console.log(`已终止开发工具进程${pid}`);
                    }
                } catch (e) {
                    console.log(`无法获取进程${pid}信息或终止进程:`, e.message);
                }
            }
            
            // 等待一秒后重新检查端口
            await new Promise(resolve => setTimeout(resolve, 1000));
            const portAvailableAfterCleanup = await checkPortAvailable(3000);
            if (!portAvailableAfterCleanup) {
                console.error('端口3000仍被占用，无法启动服务器');
                return false;
            }
        } catch (error) {
            console.log('无法获取端口占用信息:', error.message);
            console.error('端口3000被占用，无法启动服务器');
            return false;
        }
    }
    
    const serverPath = path.join(__dirname, 'server.js');
    const nodePath = getNodeExecutablePath();
    console.log(`启动后端服务器 (尝试 ${startupRetries + 1}/${MAX_RETRIES}):`, serverPath);
    console.log(`使用Node.js路径:`, nodePath);
    
    return new Promise((resolve, reject) => {
        // 启动Node.js服务器
        serverProcess = spawn(nodePath, [serverPath], {
            cwd: __dirname,
            stdio: ['pipe', 'pipe', 'pipe'],
            detached: true,
            shell: false
        });
        
        let startupCompleted = false;
        let startupTimeout = null;
        
        // 清理函数
        const cleanup = () => {
            if (startupTimeout) {
                clearTimeout(startupTimeout);
                startupTimeout = null;
            }
        };
        
        // 启动超时处理
        startupTimeout = setTimeout(async () => {
            if (!startupCompleted) {
                console.log('服务器启动超时，检查是否已成功启动...');
                const isRunning = await checkServerRunning();
                if (isRunning) {
                    startupCompleted = true;
                    console.log('服务器启动成功（超时后检测）');
                    resolve(true);
                } else {
                    console.error('服务器启动超时');
                    cleanup();
                    if (serverProcess && !serverProcess.killed) {
                        serverProcess.kill('SIGTERM');
                    }
                    serverProcess = null;
                    reject(new Error('服务器启动超时'));
                }
            }
        }, 10000); // 10秒超时
        
        serverProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log('服务器输出:', output);
            
            // 检测启动成功的标志
            if (output.includes('uTools插件服务器运行在') && !startupCompleted) {
                startupCompleted = true;
                cleanup();
                console.log('服务器启动成功');
                resolve(true);
            }
        });
        
        serverProcess.stderr.on('data', (data) => {
            const error = data.toString();
            console.error('服务器错误:', error);
            
            // 检测端口占用错误
            if (error.includes('EADDRINUSE') && !startupCompleted) {
                startupCompleted = true;
                cleanup();
                console.error('端口3000已被占用');
                if (serverProcess && !serverProcess.killed) {
                    serverProcess.kill('SIGTERM');
                }
                serverProcess = null;
                reject(new Error('端口被占用'));
            }
        });
        
        serverProcess.on('close', (code) => {
            console.log(`服务器进程退出，代码: ${code}`);
            if (!startupCompleted) {
                cleanup();
                serverProcess = null;
                if (code !== 0) {
                    reject(new Error(`服务器进程异常退出，代码: ${code}`));
                } else {
                    reject(new Error('服务器进程正常退出但启动未完成'));
                }
            }
        });
        
        serverProcess.on('error', (error) => {
            console.error('启动服务器失败:', error);
            if (!startupCompleted) {
                cleanup();
                serverProcess = null;
                reject(error);
            }
        });
        
        // 分离进程使其独立运行
        if (serverProcess.pid) {
            serverProcess.unref();
        }
    });
}

// 带重试的启动函数
async function startBackendServerWithRetry() {
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            startupRetries = i;
            const success = await startBackendServer();
            if (success) {
                console.log('后端服务器启动成功');
                return true;
            }
        } catch (error) {
            console.error(`启动失败 (尝试 ${i + 1}/${MAX_RETRIES}):`, error.message);
            if (i < MAX_RETRIES - 1) {
                console.log(`等待2秒后重试...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }
    
    console.error('达到最大重试次数，启动失败');
    return false;
}

// 检测是否在uTools环境中运行
if (typeof utools !== 'undefined') {
    console.log('Running in uTools environment');
    
    // 在uTools环境中启动后端服务器
    startBackendServerWithRetry().then(success => {
        if (success) {
            console.log('uTools插件后端服务器启动成功');
            
            // 通知前端服务器已就绪
            setTimeout(() => {
                if (typeof window !== 'undefined' && window.postMessage) {
                    window.postMessage({
                        type: 'server-ready',
                        status: 'success'
                    }, '*');
                }
            }, 1000);
        } else {
            console.error('uTools插件后端服务器启动失败');
            
            // 通知前端启动失败
            setTimeout(() => {
                if (typeof window !== 'undefined' && window.postMessage) {
                    window.postMessage({
                        type: 'server-ready',
                        status: 'failed',
                        error: '后端服务器启动失败'
                    }, '*');
                }
            }, 1000);
        }
    }).catch(error => {
        console.error('uTools插件后端服务器启动异常:', error);
    });
    
    // uTools API适配器
    window.utoolsAPI = {
        // 获取插件数据目录
        getDataPath: function() {
            return utools.getPath('userData');
        },
        
        // 显示通知
        showNotification: function(message, title) {
            utools.showNotification(message || title);
        },
        
        // 打开文件
        openFile: function(filePath) {
            utools.shellOpenPath(filePath);
        },
        
        // 获取当前环境信息
        getEnvironment: function() {
            return {
                platform: utools.getEnv().platform,
                version: utools.getEnv().version
            };
        }
    };
} else {
    console.log('Running in browser environment');
    
    // 浏览器环境适配器
    window.utoolsAPI = {
        getDataPath: function() {
            return './data';
        },
        
        showNotification: function(message, title) {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                new Notification(title || '通知', {
                    body: message,
                    icon: '../assets/img/favicon.png'
                });
            } else {
                console.log('通知:', title, message);
            }
        },
        
        openFile: function(filePath) {
            console.log('打开文件:', filePath);
        },
        
        getEnvironment: function() {
            return {
                platform: navigator.platform,
                version: 'browser'
            };
        }
    };
}

// 导出API供其他脚本使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        utoolsAPI: window.utoolsAPI,
        startBackendServer,
        startBackendServerWithRetry,
        checkServerRunning,
        checkPortAvailable,
        getNodeExecutablePath
    };
}

// uTools插件退出时关闭服务器
if (typeof utools !== 'undefined') {
    // 优雅关闭服务器
    function gracefulShutdown() {
        if (serverProcess && !serverProcess.killed) {
            console.log('正在关闭后端服务器...');
            
            // 首先尝试优雅关闭
            serverProcess.kill('SIGTERM');
            
            // 5秒后强制关闭
            setTimeout(() => {
                if (serverProcess && !serverProcess.killed) {
                    console.log('强制关闭后端服务器...');
                    serverProcess.kill('SIGKILL');
                }
                serverProcess = null;
            }, 5000);
        }
    }
    
    // 监听uTools插件退出事件
    process.on('exit', gracefulShutdown);
    
    // 监听SIGINT信号
    process.on('SIGINT', () => {
        console.log('收到SIGINT信号，正在关闭...');
        gracefulShutdown();
        setTimeout(() => process.exit(0), 6000);
    });
    
    // 监听SIGTERM信号
    process.on('SIGTERM', () => {
        console.log('收到SIGTERM信号，正在关闭...');
        gracefulShutdown();
        setTimeout(() => process.exit(0), 6000);
    });
    
    // 在uTools插件卸载时也要关闭服务器
    if (utools && typeof utools.onPluginRemove === 'function') {
        utools.onPluginRemove(() => {
            console.log('uTools插件即将卸载，关闭后端服务器');
            gracefulShutdown();
        });
    }
}