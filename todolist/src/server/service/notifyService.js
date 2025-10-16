// 短信发送服务
// 提供天气信息文本组织和Mac Message.app短信发送功能

const { exec } = require('child_process');
const util = require('util');
const fetch = require('node-fetch');
const { configManager } = require('../utils/configManager');

const execPromise = util.promisify(exec);

function getNotifyConfig() {
    return configManager.getConfigSync('notify');
}

async function loadNotifyConfig() {
    return configManager.getConfig('notify');
}
/**
 * 发送通知
 * @param {string} targetUserInfo - 手机号码(iCloud邮箱)/微信OpenID
 * @param {string} message - 通知消息内容
 * @returns {Promise<Object>} - 发送结果
 */
async function sendMessage(type, targetUserInfo, message) {
    console.log(`准备发送 ${type} 通知到 ${targetUserInfo.phoneNumber}/${targetUserInfo.wechatOpenId}, 内容: \n${message}`);
    let statusList = [], messageList = [];
    const config = configManager.getConfigSync('notify');
    if (config?.weather?.notifyTypes?.includes('sms')) {
        const smsResult = await sendSmsMessage(targetUserInfo.phoneNumber, message);
        statusList.push(smsResult.success);
        if (!smsResult.success) {
            messageList.push(`短信通知发送失败: ${smsResult.message || '未知错误'}`);
        }
    } else {
        messageList.push('短信通知未启用，跳过发送');
    }
    if (config?.weather?.notifyTypes?.includes('wechat')) {
        const wechatResult = await sendWechatMessage(targetUserInfo.wechatOpenId, message);
        statusList.push(wechatResult.success);
        if (!wechatResult.success) {
            messageList.push(`微信通知发送失败: ${wechatResult.message || '未知错误'}`);
        }
    } else {
        messageList.push('微信通知未启用，跳过发送');
    }
    return { success: statusList.every(item => item), message: messageList.join('\n') || `${type}通知已发送` };
}
/**
 * 通过Mac的Message.app发送短信
 * @param {string} phoneNumber - 手机号码或iCloud邮箱
 * @param {string} message - 通知消息内容
 * @returns {Promise<Object>} - 发送结果
 */
async function sendSmsMessage(phoneNumber, message) {
    // 验证手机号码或邮箱格式（支持手机号和iCloud邮箱）
    const phoneRegex = /^(\+?\d{1,4})?[\s-]?\d{10,15}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!phoneNumber || !phoneRegex.test(phoneNumber) && !emailRegex.test(phoneNumber)) {
        return { success: false, message: '无效的手机号码或邮箱格式' };
    }
    
    // 对消息内容进行转义，确保AppleScript能正确处理
    const escapedMessage = message
        .replace(/"/g, '\\"')
        .replace(/\\n/g, '\\\n');
    
    // 构建AppleScript命令
    const applescript = `
        tell application "Messages"
            set targetService to 1st service whose service type = iMessage
            set targetBuddy to buddy "${phoneNumber}" of targetService
            send "${escapedMessage}" to targetBuddy
        end tell
    `;
    
    try {
        // 执行AppleScript命令
        const { stdout, stderr } = await execPromise(`osascript -e '${applescript}'`);
        if (stderr) {
            console.error('发送短信时产生警告:', stderr);
        }
        
        console.log('短信发送成功!');
        return {
            phoneNumber,
            messageLength: message.length,
            success: true,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('发送短信失败:', error);
        return {
            phoneNumber,
            success: false,
            message: error.message || '短信发送失败',
            timestamp: new Date().toISOString()
        };
    }
}

// 微信公众号access_token缓存
let wechatAccessToken = null;
let accessTokenExpireTime = 0;
/**
 * 获取微信公众号access_token
 * @returns {Promise<string|null>} - access_token或null
 */
async function getWechatAccessToken() {
    try {
        const now = Date.now();
        if (wechatAccessToken && accessTokenExpireTime > now + 600000) {
            console.log('使用缓存的微信公众号access_token');
            return wechatAccessToken;
        }
        
        const notifyConfig = configManager.getConfigSync('notify');
        const { wechatAppId, wechatAppSecret } = notifyConfig?.weather || {};
        if (!wechatAppId || !wechatAppSecret) {
            console.error('微信公众号配置不完整，缺少appId或appSecret');
            return null;
        }
        
        const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${wechatAppId}&secret=${wechatAppSecret}`;
        console.log(`正在请求微信公众号access_token，appId: ${wechatAppId}`);
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.access_token) {
            wechatAccessToken = data.access_token;
            accessTokenExpireTime = now + (data.expires_in * 1000);
            console.log(`微信公众号access_token获取成功，有效期至: ${new Date(accessTokenExpireTime).toLocaleString()}`);
            return wechatAccessToken;
        } else {
            console.error('获取微信公众号access_token失败:', data);
            return null;
        }
    } catch (error) {
        console.error('获取微信公众号access_token时发生错误:', error);
        return null;
    }
}

/**
 * 发送微信消息
 * @param {string} wechatOpenId - 微信用户OpenID
 * @param {string} message - 通知消息内容
 * @returns {Promise<Object>} - 发送结果
 */
async function sendWechatMessage(wechatOpenId, message) {
    try {
        // 验证OpenID格式
        const wechatOpenIdRegex = /^[a-zA-Z0-9-]+$/;
        if (!wechatOpenId || !wechatOpenIdRegex.test(wechatOpenId)) {
            return { success: false, message: '无效的微信OpenID格式' };
        }
        
        // 获取access_token
        const accessToken = await getWechatAccessToken();
        if (!accessToken) {
            return { success: false, message: '获取微信access_token失败' };
        }
        
        // 调用微信客服消息API
        const url = `https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=${accessToken}`;
        console.log(`准备发送微信消息到用户: ${wechatOpenId}`);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                touser: wechatOpenId,
                msgtype: 'text',
                text: { content: message }
            })
        });
        
        const data = await response.json();
        
        if (data.errcode === 0) {
            console.log(`微信消息发送成功，用户: ${wechatOpenId}`);
            return {
                wechatOpenId,
                messageLength: message.length,
                success: true,
                timestamp: new Date().toISOString()
            };
        } else {
            console.error(`发送微信消息失败: errcode=${data.errcode}, errmsg=${data.errmsg}`);
            return {
                wechatOpenId,
                success: false,
                message: `微信API错误: ${data.errmsg || '未知错误'}`,
                errcode: data.errcode,
                timestamp: new Date().toISOString()
            };
        }
    } catch (error) {
        console.error(`发送微信消息时发生异常: ${error.message}`);
        return {
            wechatOpenId,
            success: false,
            message: error.message || '发送失败',
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = {
    sendMessage,
    loadNotifyConfig,
    getNotifyConfig
};