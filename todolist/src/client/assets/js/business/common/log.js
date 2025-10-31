
// 日志序号计数器
let logCounter = 0;
// 生成带序号的日志函数 - 只输出错误和警告信息
export function logStep(message) {
    console.log(`[${++logCounter}] ${message}`);
}