/**
 * 农历和节日配置管理模块，主要用于获取 农历日期/二十四节气/节日名称(包括常用/传统/国外/自定义节日)
 * 针对页面：日历视图页面 (calendar_view.html等)
 * 业务功能模块：
 * 1. 管理农历信息和节日配置
 * 2. 获取公历日期对应的农历信息
 * 3. 生成节日映射表，支持公历、农历和基于星期的节日
 * 4. 提供节日信息的加载、保存和更新功能
 * 5. 生成包含公历/农历日期的HTML显示结构
 * 6. 提供节日样式和类型管理
 * 
 * 使用场景：
 * - 在日历视图中显示农历日期和节气信息
 * - 为日历视图提供各类节日数据（传统节日、节气、国外节日等）
 * - 支持节日的样式管理和显示优先级排序
 * - 与holiday_manager.js配合，为calendar_view.js提供完整的日历渲染数据
 * - 处理节日去重和优先级排序，确保日历显示正确的节日信息
 */

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

    if (!window.calendarConfig) {
        window.calendarConfig = {
            currentYear: new Date().getFullYear(),
            currentMonth: new Date().getMonth(),
            festivals: [], holidays: {}, workdays: new Set()
        };
    }
    let allFestivals = [];
    try {
        const res = await fetch('/data/config/festival_config.json');
        if (res.ok) {
            const config = await res.json();
            // 为每个节日添加唯一ID和确保日期格式正确
            allFestivals = config.festivals.map((festival, index) => {
                const festivalWithId = { ...festival };

                // 为没有ID的节日生成ID
                if (!festivalWithId.id) {
                    festivalWithId.id = index.toString();
                }

                return festivalWithId;
            });
            holidayConfig = { ...config, ...DEFAULT_HOLIDAY_CONFIG };
        }
    } catch (e) {
        console.warn('节日配置加载失败，使用默认配置');
    }
    holidayConfig.festivals = allFestivals;
    window.calendarConfig.festivals = allFestivals;
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

async function getFestivals(date, limit = 0) {
    await loadHolidayConfig();
    return getFestivalsSync(date, limit);
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
}

/**
 * 检查日期是否匹配基于星期的节日配置
 * 完全独立实现，不依赖lunar.js
 * @param {Date} date - 要检查的日期
 * @param {Object} festival - 节日配置对象
 * @returns {boolean} 是否匹配
 */
function isMatchingWeekBasedFestival(date, festival) {
    if (!festival || !festival.date || festival.dateType !== 'week') {
        return false;
    }
    
    try {
        // 解析日期格式 "月-第几个星期-星期几"
        const [monthStr, weekNumStr, dayOfWeekStr] = festival.date.split('-');
        
        if (!monthStr || !weekNumStr || !dayOfWeekStr) {
            return false;
        }
        
        const month = parseInt(monthStr, 10);
        const weekNum = parseInt(weekNumStr, 10);
        const dayOfWeek = parseInt(dayOfWeekStr, 10);
        
        if (isNaN(month) || isNaN(weekNum) || isNaN(dayOfWeek)) {
            return false;
        }
        
        // 检查月份是否匹配
        if (date.getMonth() + 1 !== month) {
            return false;
        }
        
        // 获取当前日期的星期几
        const currentWeek = date.getDay();
        
        // 检查星期几是否匹配
        if (currentWeek !== dayOfWeek) {
            return false;
        }
        
        // 获取年份和日期
        const year = date.getFullYear();
        const currentDay = date.getDate();
        
        // 计算当前日期在当月的第几周
        const weeks = Math.ceil(currentDay / 7);
        
        // 获取当月的总天数
        const daysInMonth = new Date(year, month, 0).getDate();
        
        // 处理最后一个星期几（weekNum为0）的特殊情况
        if (weekNum === 0) {
            // 检查是否是当月最后一个该星期几
            // 如果当前日期加7天超过当月天数，则为最后一个该星期几
            return currentDay + 7 > daysInMonth;
        } else {
            // 常规情况：检查是否为第N个特定星期几
            return weeks === weekNum;
        }
    } catch (error) {
        console.warn(`处理星期类型节日时出错: ${error.message}`);
        return false;
    }
}

/**
 * 同步版本的节日获取函数
 * 使用当前已加载的配置数据，不进行异步加载操作
 */
function getFestivalsSync(date, limit = 0) {
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

    // 1. 使用lunar.js获取农历信息和节气
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

    // 2. 添加自定义节日 - 农历/阳历类型
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

    // 3. 添加自定义节日 - 星期类型
    // 注意：星期类型节日不适合在generateCustomFestivals中预处理，因为它们依赖于具体日期计算
    if (window.calendarConfig && window.calendarConfig.festivals) {
        window.calendarConfig.festivals
            .filter(f => f && f.dateType === 'week' && isMatchingWeekBasedFestival(targetDate, f))
            .forEach(festival => {
                festivals.push({
                    name: festival.name,
                    type: festival.type || 'custom',
                    date: dateStr,
                    priority: festival.priority || 70
                });
            });
    }

    // 去重和按优先级排序
    const festivalsList = deduplicateAndSortFestivals(festivals);
    if (limit > 0) {
        return festivalsList.slice(0, limit);
    } else {
        return festivalsList;
    }
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

// === 对外 API ===
window.lunarUtils = {
    // 配置管理
    loadHolidayConfig,

    // 核心功能
    getLunarDateText,
    getFestivals,
    getFestivalsSync, // 添加同步版本的节日获取函数

    // 显示相关
    getFestivalStyleClass,
    getFestivalTypeClass: getFestivalStyleClass,
    getFestivalTypeName,
};
