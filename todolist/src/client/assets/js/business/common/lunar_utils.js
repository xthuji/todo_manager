// 农历和节日配置管理模块
// 针对页面：日历视图页面
// 业务功能模块：
// 1. 管理农历信息和节日配置
// 2. 获取公历日期对应的农历信息
// 3. 生成节日映射表，支持公历、农历和基于星期的节日
// 4. 提供节日信息的加载、保存和更新功能
// 5. 生成包含公历/农历日期的HTML显示结构

// 确保window对象存在
if (typeof window === 'undefined') {
    console.error('此脚本只能在浏览器环境中运行');
    throw new Error('Browser environment required');
}

// === 配置与常量 ===
const chineseMonths = ['', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
const chineseDays = ['', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];

const DEFAULT_HOLIDAY_CONFIG = {
    holidayTypes: {
        CHINESE_COMMON: 'chinese_common',
        CHINESE_TRADITIONAL: 'chinese_traditional',
        FOREIGN: 'foreign',
        SOLAR_TERMS: 'solar_terms',
        CUSTOM: 'custom'
    },
    holidayStyles: {
        chinese_common: 'bg-red-500 text-white px-1 rounded text-xs',
        chinese_traditional: 'bg-red-400 text-white px-1 rounded text-xs',
        foreign: 'bg-purple-500 text-white px-1 rounded text-xs',
        solar_terms: 'bg-green-500 text-white px-1 rounded text-xs',
        custom: 'bg-blue-500 text-white px-1 rounded text-xs'
    },
    holidayStylesClass: {
        chinese_common: 'bg-festival-common',
        chinese_traditional: 'bg-festival-traditional',
        foreign: 'bg-festival-foreign',
        solar_terms: 'bg-festival-terms',
        custom: 'bg-festival-custom'
    },
    festivals: []
};

let holidayConfig = { ...DEFAULT_HOLIDAY_CONFIG };
let customFestivalsCache = null;
let configLoaded = false;

// === 工具函数 ===
function isValidDate(date) {
    return date instanceof Date && !isNaN(date.getTime());
}

function parseDate(input) {
    return isValidDate(input) ? input : new Date(input);
}

// === 农历信息 ===
function getLunarInfo(date) {
    const targetDate = parseDate(date);
    if (!window.Solar) {
        return { lunarYear: 0, lunarMonth: 0, lunarDay: 0, isLeapMonth: false, solarTerm: '' };
    }
    try {
        const solar = window.Solar.fromDate(targetDate);
        const lunar = solar.getLunar();
        return {
            lunarYear: lunar.getYear(),
            lunarMonth: lunar.getMonth(),
            lunarDay: lunar.getDay(),
            isLeapMonth: lunar.getMonth() < 0,
            solarTerm: lunar.getJieQi()
        };
    } catch (e) {
        console.error('获取农历信息失败:', e);
        return { lunarYear: 0, lunarMonth: 0, lunarDay: 0, isLeapMonth: false, solarTerm: '' };
    }
}

function getLunarDateText(date) {
    const info = getLunarInfo(date);
    if (!info.lunarMonth || !info.lunarDay) return '';

    const monthIdx = Math.abs(info.lunarMonth);
    const dayIdx = info.lunarDay;
    const monthText = info.isLeapMonth ? `闰${chineseMonths[monthIdx]}` : chineseMonths[monthIdx];
    return `${monthText}${chineseDays[dayIdx]}`;
}

// === 节日配置管理 ===
async function loadHolidayConfig() {
    if (configLoaded) return holidayConfig;
    try {
        const res = await fetch('/data/config/festival_config.json');
        if (res.ok) {
            const config = await res.json();
            holidayConfig = { ...DEFAULT_HOLIDAY_CONFIG, ...config };
        }
    } catch (e) {
        console.warn('节日配置加载失败，使用默认配置');
    }
    configLoaded = true;
    return holidayConfig;
}

function generateCustomFestivals() {
    if (customFestivalsCache) return customFestivalsCache;

    const festivals = {};

    // 处理节日配置
    if (holidayConfig.festivals && Array.isArray(holidayConfig.festivals)) {
        holidayConfig.festivals.forEach(festival => {
            // 处理所有类型的节日
            const dateType = festival.dateType || 'solar';

            switch (dateType) {
                case 'solar':
                    // 公历节日
                    if (festival.date) {
                        const [month, day] = festival.date.split('-');
                        if (month && day) {
                            const key = `${month}-${day}`;
                            festivals[key] = {
                                name: festival.name,
                                type: festival.type,
                                isLunar: false,
                                description: festival.description || ''
                            };
                        }
                    }
                    break;
                case 'lunar':
                    // 农历节日
                    if (festival.date) {
                        // 农历日期可能包含闰月标识，例如 "5-1-leap"
                        festivals[festival.date] = {
                            name: festival.name,
                            type: festival.type,
                            isLunar: true,
                            description: festival.description || ''
                        };
                    }
                    break;
                case 'week':
                    // 基于星期的节日
                    // 这里仅存储配置，实际计算在调用时进行
                    if (!festivals.week) {
                        festivals.week = [];
                    }
                    festivals.week.push(festival);
                    break;
                default:
                    // 未知类型
                    break;
            }
        });
    }

    customFestivalsCache = festivals;
    return festivals;
}

// === 节日匹配 ===
function isFestivalDate(date, festival) {
    if (!date || !festival) return false;
    const d = parseDate(date);
    const { dateType, date: fDate } = festival;

    if (dateType === 'solar') {
        const [m, day] = fDate.split('-').map(Number);
        return d.getMonth() + 1 === m && d.getDate() === day;
    }

    if (dateType === 'lunar' && window.Solar) {
        const lunar = getLunarInfo(d);
        const [targetM, targetD, leapFlag] = fDate.split('-');
        const isLeap = leapFlag === 'leap';
        return (
            Math.abs(lunar.lunarMonth) === Number(targetM) &&
            lunar.lunarDay === Number(targetD) &&
            lunar.isLeapMonth === isLeap
        );
    }

    return false;
}

async function getFestivals(date) {
    await loadHolidayConfig();
    return getFestivalsSync(date);
}

function deduplicateAndSortFestivals(festivals) {
    try {
        const uniqueFestivals = [];
        const festivalNames = new Set();

        // 先按优先级排序
        const sortedFestivals = festivals.sort((a, b) => (b.priority || 0) - (a.priority || 0));

        // 去重
        sortedFestivals.forEach(festival => {
            if (festival && festival.name && !festivalNames.has(festival.name)) {
                festivalNames.add(festival.name);
                uniqueFestivals.push(festival);
            }
        });

        return uniqueFestivals;
    } catch (error) {
        console.error('节日去重和排序失败:', error);
        return festivals || [];
    }
};

/**
 * 同步版本的节日获取函数
 * 使用当前已加载的配置数据，不进行异步加载操作
 */
function getFestivalsSync(date) {
    // 确保日期是Date对象
    const targetDate = date instanceof Date ? date : new Date(date);
    if (isNaN(targetDate.getTime())) {
        console.warn('无效的日期参数');
        return [];
    }

    // 格式化日期为YYYY-MM-DD格式
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // 初始化节日结果数组
    const festivals = [];

    // 1. 优先从配置文件中获取节日信息（避免获取法定节假日信息）

    // 2. 使用lunar.js获取农历信息和节气
    if (window.Solar) {
        try {
            const solar = window.Solar.fromDate(targetDate);
            const lunar = solar.getLunar();

            // 获取节气
            const solarTerm = lunar.getJieQi();
            if (solarTerm) {
                festivals.push({
                    name: solarTerm,
                    type: 'solar_terms',
                    date: dateStr,
                    priority: 100
                });
            }

            // 获取农历节日（通过配置文件映射）
            const lunarMonth = lunar.getMonth();
            const lunarDay = lunar.getDay();

            // 支持多种日期格式匹配
            const lunarMonthStr = Math.abs(lunarMonth);
            const lunarDayStr = lunarDay;
            const isLeapMonth = lunarMonth < 0;

            // 生成多种格式的农历键
            const lunarKeys = [
                `${lunarMonthStr}-${lunarDayStr}${isLeapMonth ? '-leap' : ''}`,
                `${String(lunarMonthStr).padStart(2, '0')}-${String(lunarDayStr).padStart(2, '0')}${isLeapMonth ? '-leap' : ''}`
            ];

            // 从配置文件中获取节日
            if (window.calendarConfig && window.calendarConfig.festivals) {
                // 处理农历节日
                window.calendarConfig.festivals
                    .filter(f => f && f.dateType === 'lunar' && lunarKeys.includes(f.date))
                    .forEach(festival => {
                        festivals.push({
                            name: festival.name,
                            type: festival.type || 'chinese_traditional',
                            date: dateStr,
                            priority: festival.priority || 10
                        });
                    });

                // 处理阳历节日
                const solarDateKeys = [
                    `${parseInt(month)}-${parseInt(day)}`,
                    `${month}-${day}`
                ];

                window.calendarConfig.festivals
                    .filter(f => f && f.dateType === 'solar' && solarDateKeys.includes(f.date))
                    .forEach(festival => {
                        festivals.push({
                            name: festival.name,
                            type: festival.type || 'solar',
                            date: dateStr,
                            priority: festival.priority || 80
                        });
                    });
            }
        } catch (error) {
            console.warn('使用Solar获取节日信息失败:', error);
        }
    }

    // 3. 添加自定义节日
    try {
        const customFestivals = generateCustomFestivals();
        if (customFestivals && customFestivals[dateStr]) {
            customFestivals[dateStr].forEach(festival => {
                festivals.push({
                    ...festival,
                    type: festival.type || 'custom',
                    priority: festival.priority || 90
                });
            });
        }
    } catch (error) {
        console.warn('获取自定义节日失败:', error);
    }

    // 去重和按优先级排序
    return deduplicateAndSortFestivals(festivals);
}
/**
 * 同步版本的节日获取函数
 * 使用当前已加载的配置数据，不进行异步加载操作
 */
// function getFestivalsSync(date) {
//     const d = parseDate(date);
//     const year = d.getFullYear();
//     const month = String(d.getMonth() + 1);
//     const day = String(d.getDate());
//     const solarKey1 = `solar_${Number(month)}-${Number(day)}`;
//     const solarKey2 = `solar_${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
//     let dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
//
//     const result = [];
//     const lunarInfo = getLunarInfo(d);
//
//     // 1. 节气
//     if (lunarInfo.solarTerm) {
//         result.push({
//             name: lunarInfo.solarTerm,
//             type: 'solar_terms',
//             date: dateStr,
//             priority: 100
//         });
//     }
//
//     // 2. 自定义节日（含公历/农历）
//     const customMap = generateCustomFestivals();
//
//     // 公历节日
//     if (customMap[solarKey1]) {
//         result.push({ ...customMap[solarKey1], date: dateStr, priority: 80 });
//     }
//     if (customMap[solarKey2] && solarKey2 !== solarKey1) {
//         result.push({ ...customMap[solarKey2], date: dateStr, priority: 80 });
//     }
//
//     // 农历节日
//     if (lunarInfo.lunarMonth) {
//         const lunarM = Math.abs(lunarInfo.lunarMonth);
//         const lunarD = lunarInfo.lunarDay;
//         const baseKey = `lunar_${lunarM}-${lunarD}`;
//         const leapKey = `${baseKey}-leap`;
//
//         if (customMap[leapKey] && lunarInfo.isLeapMonth) {
//             result.push({ ...customMap[leapKey], date: dateStr, priority: 70 });
//         } else if (customMap[baseKey] && !lunarInfo.isLeapMonth) {
//             result.push({ ...customMap[baseKey], date: dateStr, priority: 70 });
//         }
//     }
//
//     // 按优先级排序
//     return result.sort((a, b) => (b.priority || 0) - (a.priority || 0));
// }

async function isChineseHoliday(date) {
    const festivals = await getFestivals(date);
    return festivals.some(f =>
        ['chinese_common', 'chinese_traditional'].includes(f.type)
    );
}

// === 样式与显示 ===
function getFestivalStyleClass(type) {
    return holidayConfig.holidayStylesClass[type] || holidayConfig.holidayStylesClass.custom;
}

function getFestivalTypeName(type) {
    const names = {
        chinese_common: '常用节日',
        chinese_traditional: '传统节日',
        foreign: '国外节日',
        solar_terms: '节气',
        custom: '自定义节日'
    };
    return names[type] || '未知类型';
}

function generateDateDisplayHTML(date) {
    const d = parseDate(date);
    const day = d.getDate();
    const lunarText = getLunarDateText(d);

    let html = `<div class="flex flex-col items-center justify-center w-full h-full">
                <div class="flex items-center justify-center">
                  <span class="font-bold text-gray-800 text-lg">${day}</span>
                </div>`;

    if (lunarText) {
        html += `<div class="text-xs text-gray-500 mt-1">${lunarText}</div>`;
    }

    html += '</div>';

    // 触发异步节日更新（由外部调用）
    return html;
}

// === DOM 更新（仅在需要时调用）===
async function asyncUpdateFestivalInfo(dateStr = null) {
    const selector = dateStr
        ? `[data-date="${dateStr}"]`
        : '.calendar-day[data-date]';
    const elements = document.querySelectorAll(selector);

    for (const el of elements) {
        const ds = dateStr || el.getAttribute('data-date');
        if (!ds) continue;

        const festivals = await getFestivals(ds);
        let container = el.querySelector('.festival-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'festival-container flex flex-wrap justify-center gap-1 mt-1';
            el.appendChild(container);
        }
        container.innerHTML = '';

        festivals.slice(0, 2).forEach(f => {
            const tag = document.createElement('span');
            tag.className = getFestivalStyleClass(f.type);
            tag.textContent = f.name;
            container.appendChild(tag);
        });
    }
}

// === 对外 API ===
window.lunarUtils = {
    // 配置管理
    getHolidayConfig: () => holidayConfig,
    setHolidayConfig: (config) => { holidayConfig = { ...config }; customFestivalsCache = null; },
    updateHolidayConfig: (updates) => { holidayConfig = { ...holidayConfig, ...updates }; customFestivalsCache = null; },
    loadHolidayConfig,
    saveHolidayConfig: async () => {
        try {
            const res = await fetch('/api/festival/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(holidayConfig)
            });
            const ok = res.ok;
            if (!ok) console.error('保存失败');
            return { success: ok };
        } catch (e) {
            console.error('保存节日配置出错:', e);
            return { success: false, message: e.message };
        }
    },

    // 核心功能
    getLunarInfo,
    getLunarDateText,
    getFestivals,
    getFestivalsSync, // 添加同步版本的节日获取函数
    isFestivalDate,
    isChineseHoliday,

    // 显示相关
    getFestivalStyleClass,
    getFestivalTypeClass: getFestivalStyleClass,
    getFestivalTypeName,
    generateDateDisplayHTML,
    asyncUpdateFestivalInfo,
};
