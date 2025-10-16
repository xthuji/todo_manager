
/**
 * 基础工具函数模块
 * 针对页面：全局通用
 * 业务功能模块：
 * 1. 提供带序号的日志记录功能
 * 2. 支持其他模块的通用基础功能扩展
 * 
 * 使用场景：
 * - 在各个业务模块中记录执行步骤和重要操作
 * - 提供调试和开发时的日志追踪能力
 * - 适用于weather_renderer.js等需要记录操作日志的模块
 */

// 日志序号计数器
let logCounter = 0;
// 生成带序号的日志函数 - 只输出错误和警告信息
export function logStep(message) {
    console.log(`[${++logCounter}] ${message}`);
}