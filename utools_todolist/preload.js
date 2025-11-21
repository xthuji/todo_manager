// 增强版preload.js - 优化服务启动逻辑
const { spawn, exec } = require('child_process');
const net = require('net');
const fs = require('fs');
const path = require('path');

// 导入配置管理器
const configManager = require('./server/utils/configManager');

// 获取服务器端口
const getServerPort = () => {
    return configManager.getPort();
};

// 获取服务器主机
const getServerHost = () => {
    return configManager.getHost();
};

// 全局变量存储服务器进程
let serverProcess = null;
let isStarting = false;
let startupTimeout = null;
let serverAttempts = 0; // 记录启动尝试次数

// 检查端口是否可用
function checkPortAvailable(port = getServerPort()) {
    return new Promise((resolve) => {
        console.log(`🔍 检查端口 ${port} 是否可用...`);
        const server = net.createServer();
        server.listen(port, () => {
            console.log(`✅ 端口 ${port} 可用`);
            server.close(() => resolve(true));
        });
        server.on('error', (error) => {
            console.log(`❌ 端口 ${port} 不可用: ${error.message}`);
            resolve(false);
        });
    });
}

// 获取Node.js可执行文件路径
function getNodePath() {
    const possiblePaths = [
        '/usr/local/bin/node',
        '/usr/bin/node',
        '/opt/homebrew/bin/node',
        process.execPath
    ];
    
    for (const nodePath of possiblePaths) {
        if (fs.existsSync(nodePath)) {
            console.log(`✅ 找到Node.js路径: ${nodePath}`);
            return nodePath;
        }
    }
    
    // 如果都找不到，使用当前进程的node路径
    console.log(`⚠️ 未找到标准Node.js路径，使用当前进程路径: ${process.execPath}`);
    return process.execPath;
}

// 启动后端服务器
function startBackendServer() {
    return new Promise((resolve) => {
        if (isStarting) {
            return resolve(false);
        }
        
        isStarting = true;
        serverAttempts++;
        const serverPath = path.join(__dirname, 'server', 'server.js');
        const nodePath = getNodePath();
        
        // 检查server.js文件是否存在
        if (!fs.existsSync(serverPath)) {
            console.error(`❌ 服务器文件不存在: ${serverPath}`);
            isStarting = false;
            return resolve(false);
        }
        
        try {
            // 启动服务器进程
            serverProcess = spawn(nodePath, [serverPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: __dirname,
                detached: false
            });
            
            let startupCompleted = false;
            let startupTimer = null;
            
            // 清理函数
            const cleanup = () => {
                clearTimeout(startupTimer);
                if (!startupCompleted) {
                    isStarting = false;
                }
            };
            
            // 设置启动超时
            startupTimer = setTimeout(() => {
                if (!startupCompleted) {
                    console.error('⏰ 服务器启动超时 (10秒)');
                    cleanup();
                    if (serverProcess) {
                        try {
                            serverProcess.kill('SIGTERM');
                            setTimeout(() => {
                                if (serverProcess) {
                                    serverProcess.kill('SIGKILL');
                                    serverProcess = null;
                                }
                            }, 1000);
                        } catch (killError) {
                            console.error('❌ 终止进程时出错:', killError);
                        }
                    }
                    resolve(false);
                }
            }, 10000);
            
            // 监听服务器输出
            serverProcess.stdout.on('data', (data) => {
                const output = data.toString();
                
                // 增加成功标识的判断
                const successIndicators = [
                    '服务器运行在',
                    'Server running',
                    `端口${getServerPort()}`,
                    'Listening on',
                    'Express server started'
                ];
                
                if (successIndicators.some(indicator => output.includes(indicator)) && !startupCompleted) {
                    startupCompleted = true;
                    cleanup();
                    console.log('✅ 后端服务器启动成功');
                    resolve(true);
                }
            });
            
            serverProcess.stderr.on('data', (data) => {
                const error = data.toString();
                // 过滤掉一些可能的非错误输出
                if (!error.includes('deprecation') && error.trim()) {
                    console.error(`❌ 服务器错误: ${error.trim()}`);
                }
            });
            
            serverProcess.on('error', (error) => {
                console.error('❌ 服务器进程启动错误:', error.message);
                cleanup();
                resolve(false);
            });
            
            serverProcess.on('exit', (code, signal) => {
                console.log(`🔚 服务器进程退出，代码: ${code}, 信号: ${signal}`);
                if (!startupCompleted) {
                    cleanup();
                    resolve(false);
                } else {
                    serverProcess = null;
                }
            });
        } catch (err) {
            console.error('❌ 启动服务器时发生异常:', err);
            isStarting = false;
            resolve(false);
        }
    });
}

// 带重试的启动函数
async function startBackendServerWithRetry(maxRetries = 3) {
    serverAttempts = 0;
    
    // 在尝试启动前，首先清理可能存在的残留进程
        await killPortServer();
    
    for (let i = 1; i <= maxRetries; i++) {
        const port = getServerPort();
        // 检查端口是否可用
        const portAvailable = await checkPortAvailable(port);
        if (!portAvailable) {
            console.log(`⚠️ 端口${port}被占用，尝试清理...`);
            await killPortServer();
            // 等待端口完全释放
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // 再次检查端口是否可用
            const secondCheck = await checkPortAvailable();
            if (!secondCheck) {
                console.log(`❌ 端口${getServerPort()}仍被占用，可能需要手动清理`);
                continue;
            }
        }
        
        // 尝试启动服务器
        const success = await startBackendServer();
        if (success) {
            console.log('🎉 后端服务器启动成功！');
            
            // 简化服务器就绪检查
            await waitForServerReady(3, 1000);
            
            // 通知前端服务器已就绪
            if (typeof window !== 'undefined' && window.postMessage) {
                window.postMessage({
                    type: 'server-ready',
                    status: 'success',
                    port: getServerPort()
                });
            }
            
            return true;
        }
        
        if (i < maxRetries) {
            // 指数退避策略
            const waitTime = Math.min(i * 1500, 5000);
            console.log(`⏳ 等待 ${waitTime} 毫秒后重试...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
    
    console.error('❌ 所有启动尝试均失败');
    
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

// 终止占用服务器端口的进程
async function killPortServer() {
    return new Promise((resolve) => {
        // 首先终止已知的serverProcess
        if (serverProcess) {
            try {
                serverProcess.kill('SIGKILL');
                serverProcess = null;
            } catch (err) {
                console.error('❌ 终止当前进程时出错:', err);
            }
        }
        
        const port = getServerPort();
        // 查找占用服务器端口的进程
        exec(`lsof -ti:${port}`, (error, stdout) => {
            if (error || !stdout.trim()) {
                return resolve();
            }
            
            const pids = stdout.trim().split('\n');
            console.log(`🔍 发现占用端口${getServerPort()}的进程: ${pids.join(', ')}`);
            
            let killedCount = 0;
            const totalPids = pids.length;
            
            // 为每个PID设置超时
            const timeoutId = setTimeout(() => {
                resolve();
            }, 5000);
            
            pids.forEach(pid => {
                pid = pid.trim();
                if (!pid) {
                    killedCount++;
                    if (killedCount === totalPids) {
                        clearTimeout(timeoutId);
                        resolve();
                    }
                    return;
                }
                
                try {
                    exec(`kill -9 ${pid}`, () => {
                        killedCount++;
                        if (killedCount === totalPids) {
                            clearTimeout(timeoutId);
                            setTimeout(resolve, 500);
                        }
                    });
                } catch (err) {
                    console.error(`❌ 处理进程 ${pid} 时出错:`, err);
                    killedCount++;
                    if (killedCount === totalPids) {
                        clearTimeout(timeoutId);
                        setTimeout(resolve, 500);
                    }
                }
            });
        });
    });
}

// 等待服务器完全就绪
async function waitForServerReady(maxAttempts = 3, interval = 1000) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            // 尝试访问服务器
            const isReady = await checkServerRunning();
            if (isReady) {
                console.log('✅ 服务器已完全就绪，可以接受请求');
                return true;
            }
            
            // 检查进程是否仍在运行
            if (!serverProcess || serverProcess.killed) {
                console.log('❌ 服务器进程已终止或不存在');
                return false;
            }
            
            await new Promise(resolve => setTimeout(resolve, interval));
        } catch (error) {
            console.log(`⚠️ 检查服务器状态时发生错误: ${error.message}`);
        }
    }
    
    return false;
}

// 检查服务器是否已运行
function checkServerRunning() {
    return new Promise((resolve) => {
        try {
            const http = require('http');
            const host = getServerHost();
            const port = getServerPort();
            
            const req = http.get(`http://${host}:${port}/`, (res) => {
                resolve(true);
                res.resume();
            });
            
            req.on('error', () => {
                resolve(false);
            });
            
            // 设置超时时间
            req.setTimeout(2000, () => {
                req.destroy();
                resolve(false);
            });
        } catch (err) {
            resolve(false);
        }
    });
}

// uTools环境检测和启动逻辑 - 核心功能
if (typeof utools !== 'undefined') {
    console.log('🌐 Running in uTools environment');
    
    // 初始化逻辑
    async function initializePlugin() {
        try {
            // 检查服务器是否已运行
            const isRunning = await checkServerRunning();
            
            if (!isRunning) {
                console.log('🚀 服务器未运行，开始启动...');
                // 启动后端服务器
                await startBackendServerWithRetry();
            } else {
                console.log('✅ 服务器已在运行');
                // 通知前端服务器已就绪
                if (typeof window !== 'undefined' && window.postMessage) {
                    window.postMessage({
                        type: 'server-ready',
                        status: 'already-running',
                        port: getServerPort()
                    });
                }
            }
        } catch (error) {
            console.error('❌ 初始化过程中发生错误:', error);
            // 即使出错也通知前端
            if (typeof window !== 'undefined' && window.postMessage) {
                window.postMessage({
                    type: 'server-ready',
                    status: 'error',
                    error: error.message || '初始化失败'
                });
            }
        }
    }
    
    // 启动初始化 - 确保服务端启动
    initializePlugin();
    
    // 监听插件进入事件
    if (utools.onPluginEnter) {
        utools.onPluginEnter(() => {
            console.log('🔄 uTools plugin entered');
            // 确保服务器在插件进入时启动
            initializePlugin();
        });
    }
    
    // 监听插件退出事件
    if (utools.onPluginOut) {
        utools.onPluginOut(() => {
            console.log('👋 uTools plugin exiting');
            
            // 增强的清理函数
            const cleanup = async () => {
                console.log('🔄 开始清理资源...');
                
                // 首先尝试关闭当前插件启动的服务器进程
                if (serverProcess) {
                    try {
                        console.log('🔌 关闭当前插件启动的服务器进程...');
                        serverProcess.kill('SIGKILL');
                        serverProcess = null;
                        console.log('✅ 服务器进程已关闭');
                    } catch (err) {
                        console.error('❌ 关闭服务器进程时出错:', err);
                    }
                }
                
                // 清除超时
                if (startupTimeout) {
                    clearTimeout(startupTimeout);
                }
                
                isStarting = false;
                
                // 额外措施：确保占用服务器端口的所有进程都被终止
                try {
                    console.log('🛡️  额外措施：确保占用服务器端口的所有进程都被终止...');
                    const port = getServerPort();
                    const allTerminated = await killProcessByPort(port);
                    if (allTerminated) {
                        console.log(`✅ 已确保端口 ${port} 上的所有进程都已终止`);
                    } else {
                        console.warn(`⚠️ 可能有部分占用端口 ${port} 的进程未能终止`);
                    }
                } catch (err) {
                    console.error('❌ 终止端口占用进程时出错:', err);
                }
                
                console.log('✅ 清理完成，插件正常退出');
            };
            
            // 执行清理
            cleanup();
        });
    }
} else {
    console.log('🌐 Not running in uTools environment');
    console.log('ℹ️ 在浏览器环境中，服务器需要手动启动');
}

// 浏览器环境适配
if (typeof window !== 'undefined') {
    // 导出API供前端使用
    window.utoolsAPI = {
        checkServerStatus: checkServerRunning,
        startServer: startBackendServerWithRetry
    };
}

// 终止占用指定端口的进程
function killProcessByPort(port = getServerPort()) {
    console.log(`🔍 查找并终止占用端口 ${port} 的进程...`);
    return new Promise((resolve) => {
        // 使用不同的命令来查找并终止进程，兼容不同平台
        const platform = process.platform;
        let cmd = '';
        
        if (platform === 'win32') {
            cmd = `netstat -ano | findstr :${port} | findstr LISTENING`;
        } else {
            // macOS 和 Linux
            cmd = `lsof -i :${port} -t || ps aux | grep node | grep server.js | grep -v grep | awk \'{print $2}\''`;
        }
        
        exec(cmd, (error, stdout) => {
            if (error) {
                console.log(`⚠️ 未找到占用端口 ${port} 的进程`);
                return resolve(true);
            }
            
            const pids = stdout.trim().split('\n').filter(pid => pid !== '');
            if (pids.length === 0) {
                console.log(`⚠️ 未找到占用端口 ${port} 的进程`);
                return resolve(true);
            }
            
            console.log(`📋 找到 ${pids.length} 个占用端口 ${port} 的进程: ${pids.join(', ')}`);
            
            // 终止每个进程
            const killPromises = pids.map(pid => {
                return new Promise((killResolve) => {
                    // 尝试多种终止方式，确保进程被完全关闭
                    const killProcess = (signal = 'SIGTERM') => {
                        return new Promise((signalResolve) => {
                            const killCmd = platform === 'win32' ? 
                                `taskkill /F /PID ${pid}` : 
                                `kill -${signal === 'SIGTERM' ? '15' : '9'} ${pid}`;
                            
                            exec(killCmd, (killError) => {
                                if (killError) {
                                    signalResolve(false);
                                } else {
                                    console.log(`✅ 成功使用 ${signal} 终止进程 ${pid}`);
                                    signalResolve(true);
                                }
                            });
                        });
                    };
                    
                    // 首先尝试温和的SIGTERM，然后再使用强硬的SIGKILL
                    killProcess('SIGTERM')
                        .then((success) => {
                            if (success) {
                                killResolve(true);
                            } else {
                                console.log(`🔄 尝试使用SIGKILL终止进程 ${pid}...`);
                                return killProcess('SIGKILL');
                            }
                        })
                        .then((success) => {
                            if (!success) {
                                console.error(`❌ 终止进程 ${pid} 失败`);
                            }
                            killResolve(success);
                        });
                });
            });
            
            Promise.all(killPromises).then(results => {
                const allSuccess = results.every(result => result);
                if (allSuccess) {
                    console.log(`✅ 所有占用端口 ${port} 的进程已成功终止`);
                } else {
                    console.log(`⚠️ 部分占用端口 ${port} 的进程终止失败`);
                }
                resolve(allSuccess);
            });
        });
    });
}

// 导出模块
module.exports = {
    startBackendServer,
    startBackendServerWithRetry,
    checkServerRunning,
    killProcessByPort
};