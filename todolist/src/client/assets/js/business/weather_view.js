// 公共节日工具模块已在HTML中直接引入

// 日志序号计数器
let logCounter = 0;
// 生成带序号的日志函数 - 只输出错误和警告信息
function logStep(message) {
    console.log(`[${logCounter++}] ${message}`);
}

// 更新当前日期和时间
function updateCurrentDateTime() {
    const now = new Date();
    const dateStr = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日';
    const dateElement = document.getElementById('current-date');
    if (dateElement) {
        dateElement.textContent = dateStr;
    }
}


// 页面加载完成后执行
function initWeatherPage() {
    logStep('页面初始化开始');

    // 更新当前日期和时间
    updateCurrentDateTime();

    // 添加事件监听
    window.addEventListeners4Weather();

    // 尝试通过IP定位城市（按照新的流程，这是第一步）
    logStep('开始IP定位');
    locateCityByIp();
}

async function initializeAll() {
    try {
        // 先初始化节日数据
        await window.initFestivals4Weather();
        console.log('节日数据初始化完成');
        // 然后初始化天气页面
        initWeatherPage();
    } catch (error) {
        console.error('初始化时出错:', error);
        // 即使节日数据初始化失败，也要继续初始化天气页面
        initWeatherPage();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAll);
} else {
    // 页面已经加载完成，直接初始化
    initializeAll();
}
