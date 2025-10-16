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
}

// 简单的日志工具实现
const logger = {
    logInfo: function(message) {
        console.info('INFO:', message);
    },
    logWarn: function(message) {
        console.warn('WARN:', message);
    },
    logError: function(message, error) {
        console.error('ERROR:', message, error || '');
    }
};

// 统一获取Solar和Lunar对象引用
const Solar = window.Solar || null;
const Lunar = window.Lunar || null;

// 检查lunar.js是否正确加载
if (!Solar) {
    console.warn('lunar.js未正确加载，某些农历功能可能无法使用');
}

// 默认节日配置
const DEFAULT_HOLIDAY_CONFIG = {
    holidayTypes: {
        CHINESE_COMMON: 'chinese_common',
        CHINESE_TRADITIONAL: 'chinese_traditional',
        FOREIGN: 'foreign',
        SOLAR_TERMS: 'solar_terms',
        CUSTOM: 'custom'
    },
    holidayStyles: {
        chinese_common: 'bg-red-600 text-white px-1 rounded text-xs',
        chinese_traditional: 'bg-red-700 text-white px-1 rounded text-xs',
        foreign: 'bg-purple-600 text-white px-1 rounded text-xs',
        solar_terms: 'bg-blue-600 text-white px-1 rounded text-xs',
        custom: 'bg-green-600 text-white px-1 rounded text-xs'
    },
    // 使用festivals数组存储所有节日信息 - 重要：请确保此字段始终保留
    festivals: []
};


// 中文月份名称
const chineseMonths = ['', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
// 中文日期名称
const chineseDays = ['', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
                    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
                    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];


// 节日配置
let holidayConfig = { ...DEFAULT_HOLIDAY_CONFIG };

// 节日类型和样式常量
const FESTIVAL_TYPES = DEFAULT_HOLIDAY_CONFIG.holidayTypes;
const FESTIVAL_STYLES = DEFAULT_HOLIDAY_CONFIG.holidayStyles;

// 将功能挂载到window.lunarUtils对象上
window.lunarUtils = window.lunarUtils || {};

// Getter and setter for holidayConfig
window.lunarUtils.getHolidayConfig = function() {
    return holidayConfig;
};

window.lunarUtils.setHolidayConfig = function(config) {
    holidayConfig = { ...config };
};

window.lunarUtils.updateHolidayConfig = function(updates) {
    holidayConfig = { ...holidayConfig, ...updates };
};

// 加载节日配置文件
window.lunarUtils.loadHolidayConfig = async function() {
    try {
        const response = await fetch('/data/config/festival_config.json');
        if (response.ok) {
            const config = await response.json();
            // 合并配置，确保必要的结构存在
            holidayConfig = {
                ...DEFAULT_HOLIDAY_CONFIG, // 保留默认配置的基本结构
                ...config                  // 覆盖自定义配置
            };
            
            logger.logInfo('节日配置文件加载成功');
        } else {
            logger.logWarn('节日配置文件加载失败，使用默认配置');
        }
    } catch (error) {
        logger.logError('加载节日配置文件时出错:', error);
        // 使用本地默认配置作为后备
        holidayConfig = { ...DEFAULT_HOLIDAY_CONFIG };
    }
    return holidayConfig;
};

// 预加载节日配置
window.lunarUtils.loadHolidayConfig();

// 保存节日配置到服务器
window.lunarUtils.saveHolidayConfig = async function() {
    try {
        const response = await fetch('/api/festival/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(holidayConfig)
        });
        
        if (response.ok) {
            logger.logInfo('节日配置保存成功');
            return { success: true };
        } else {
            const errorData = await response.json();
            logger.logError('节日配置保存失败:', errorData.message);
            return { success: false, message: errorData.message };
        }
    } catch (error) {
        logger.logError('保存节日配置时出错:', error);
        return { success: false, message: error.message };
    }
};

// 自定义节日映射表（基于配置文件动态生成）
let CUSTOM_FESTIVALS = {};

// 从配置文件生成节日映射表
window.lunarUtils.generateCustomFestivals = function() {
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
                case 'week_based':
                    // 基于星期的节日
                    // 这里仅存储配置，实际计算在调用时进行
                    if (!festivals.weekBased) {
                        festivals.weekBased = [];
                    }
                    festivals.weekBased.push(festival);
                    break;
                default:
                    // 未知类型
                    break;
            }
        });
    }
    
    CUSTOM_FESTIVALS = festivals;
    return festivals;
};

// 获取农历信息
window.lunarUtils.getLunarInfo = function(date) {
    try {
        // 确保日期是Date对象
        const targetDate = date instanceof Date ? date : new Date(date);
        
        if (window.Solar) {
            try {
                const solar = window.Solar.fromDate(targetDate);
                const lunar = solar.getLunar();
                
                // 返回农历信息
                return {
                    lunarYear: lunar.getYear(),
                    lunarMonth: lunar.getMonth(),
                    lunarDay: lunar.getDay(),
                    isLeapMonth: lunar.getMonth() < 0,
                    // 修复: 使用正确的getJieQi方法而不是不存在的getSolarTerm方法
                    solarTerm: lunar.getJieQi()
                };
            } catch (error) {
                logger.logError('获取农历信息失败:', error);
            }
        }
    } catch (error) {
        logger.logError('获取农历信息失败:', error);
    }
    
    // 如果没有lunar.js库，返回空对象
    return {
        lunarYear: 0,
        lunarMonth: 0,
        lunarDay: 0,
        isLeapMonth: false,
        solarTerm: ''
    };
};

/**
 * 根据日期获取节日列表
 * @param {Date} date 日期
 * @returns {Array} 节日列表
 */
window.lunarUtils.getFestivals = async function(date) {
  try {
    // 确保日期是Date对象
    const targetDate = date instanceof Date ? date : new Date(date);
    
    // 格式化日期为YYYY-MM-DD格式
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    // 计算星期相关信息
    const weekday = targetDate.getDay();
    const isWeekend = weekday === 0 || weekday === 6;
    let workStatus = isWeekend ? 'rest' : 'work'; // 默认非周末为工作日
    
    // 初始化节日结果数组
    const festivals = [];
    
    // 确保节日配置已加载 - 关键修复：在使用配置前确保它已加载
    if (!holidayConfig || !holidayConfig.festivals || holidayConfig.festivals.length === 0) {
      await window.lunarUtils.loadHolidayConfig();
    }
    
    // 1. 优先使用lunar.js的HolidayUtil获取节日信息
    if (window.HolidayUtil) {
      try {
        const holiday = window.HolidayUtil.getHoliday(dateStr);
        if (holiday && holiday.getName()) {
          // 我们不直接将HolidayUtil的结果作为节日名称添加，而是通过配置文件获取准确的节日名称
          // 但仍然保留工作状态信息
          if (typeof holiday.isWork === 'function') {
            workStatus = holiday.isWork() ? 'work' : 'rest';
          }
        }
      } catch (error) {
        logger.logError('使用HolidayUtil获取节日失败:', error);
      }
    }
    
    // 2. 使用lunar.js获取农历信息和节气
    if (window.Solar) {
      try {
        const solar = window.Solar.fromDate(targetDate);
        const lunar = solar.getLunar();
        
        // 获取节气 - 修复: 使用正确的getJieQi方法而不是不存在的getSolarTerm方法
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
        
        // 修复农历节日日期格式问题：支持两位数和一位数格式的日期匹配
        const lunarMonthStr = Math.abs(lunarMonth);
        const lunarDayStr = lunarDay;
        const isLeapMonth = lunarMonth < 0;
        
        // 生成多种格式的农历键，以匹配配置文件中的不同格式
        const lunarKeys = [
          `${lunarMonthStr}-${lunarDayStr}${isLeapMonth ? '-leap' : ''}`,
          `${String(lunarMonthStr).padStart(2, '0')}-${String(lunarDayStr).padStart(2, '0')}${isLeapMonth ? '-leap' : ''}`
        ];
        
        // 从配置文件中获取节日
        if (holidayConfig && holidayConfig.festivals) {
          // 处理农历节日 - 修复：支持多种日期格式匹配
          holidayConfig.festivals
            .filter(f => f && f.dateType === 'lunar' && lunarKeys.includes(f.date))
            .forEach(festival => {
              festivals.push({
                name: festival.name,
                type: festival.type || 'chinese_traditional',
                date: dateStr,
                priority: festival.priority || 10
              });
            });
          
          // 处理阳历节日 - 修复：支持多种日期格式匹配
          const solarDateKeys = [
            `${parseInt(month)}-${parseInt(day)}`, // 一位数格式
            `${month}-${day}` // 两位数格式
          ];
          
          holidayConfig.festivals
            .filter(f => f && f.dateType === 'solar' && solarDateKeys.includes(f.date))
            .forEach(festival => {
              festivals.push({
                name: festival.name,
                type: festival.type || 'solar',
                date: dateStr,
                priority: festival.priority || 80
              });
            });
          
          // 处理基于星期的节日
          const weekBasedFestivals = window.lunarUtils.getWeekBasedFestivals(targetDate, holidayConfig);
          festivals.push(...weekBasedFestivals);
        }
      } catch (error) {
        logger.logError('使用Solar获取节日信息失败:', error);
      }
    }
    
    // 3. 添加自定义节日
    const customFestivals = window.lunarUtils.generateCustomFestivals();
    if (customFestivals && customFestivals[dateStr]) {
      customFestivals[dateStr].forEach(festival => {
        festivals.push({
          ...festival,
          type: festival.type || 'custom',
          priority: festival.priority || 90
        });
      });
    }
    
    // 按优先级排序
    return festivals.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  } catch (error) {
    logger.logError('获取节日列表失败:', error);
    return [];
  }
};

/**
 * 检查日期是否匹配节日
 * @param {Date} date 日期
 * @param {Object} festival 节日配置
 * @returns {Boolean} 是否匹配
 */
window.lunarUtils.isFestivalDate = function(date, festival) {
  try {
    if (!date || !festival) {
      return false;
    }
    
    const targetDate = date instanceof Date ? date : new Date(date);
    if (isNaN(targetDate.getTime())) {
      return false;
    }
    
    // 根据节日类型进行不同的判断
    if (festival.dateType === 'solar') {
      // 公历节日
      const [month, day] = festival.date.split('-');
      if (month && day) {
        return targetDate.getMonth() + 1 === parseInt(month) && 
               targetDate.getDate() === parseInt(day);
      }
    } else if (festival.dateType === 'lunar') {
      // 农历节日
      if (window.Solar) {
        const solar = window.Solar.fromDate(targetDate);
        const lunar = solar.getLunar();
        
        const lunarMonth = Math.abs(lunar.getMonth());
        const lunarDay = lunar.getDay();
        const isLeapMonth = lunar.getMonth() < 0;
        
        // 支持多种格式的日期匹配
        const festivalDateParts = festival.date.split('-');
        const isFestivalLeapMonth = festivalDateParts.length > 2 && festivalDateParts[2] === 'leap';
        
        return lunarMonth === parseInt(festivalDateParts[0]) && 
               lunarDay === parseInt(festivalDateParts[1]) && 
               isLeapMonth === isFestivalLeapMonth;
      }
    } else if (festival.dateType === 'week') {
      // 基于星期的节日
      return window.lunarUtils.isWeekBasedFestivalMatch(targetDate, festival);
    }
    
    return false;
  } catch (error) {
    logger.logError('判断节日日期失败:', error);
    return false;
  }
};

/**
 * 检查是否为中国节假日
 * @param {Date|String} date 日期
 * @returns {Boolean} 是否为节假日
 */
window.lunarUtils.isChineseHoliday = async function(date) {
  try {
    const festivals = await window.lunarUtils.getFestivals(date);
    
    // 检查是否存在中国法定节假日
    return festivals.some(festival => 
      ['chinese_common', 'lunar', 'solar'].includes(festival.type) && 
      !festival.isWork
    );
  } catch (error) {
    logger.logError('检查是否为节假日失败:', error);
    return false;
  }
};

/**
 * 检查是否为中国节假日（同步版本）
 * @param {String} dateStr 日期字符串，格式为YYYY-MM-DD
 * @returns {Boolean} 是否为节假日
 */
window.lunarUtils.isFestivalChineseHoliday = function(dateStr) {
  // 参数验证
  if (!dateStr) {
    try {
      dateStr = new Date().toISOString().split('T')[0];
      logger.logWarn('无效的日期字符串，使用当前日期:', dateStr);
    } catch (e) {
      // 如果获取当前日期也失败，则直接返回false
      return false;
    }
  }
  
  // 简单检查 - 实际项目中应该调用isChineseHoliday
  // 这里是为了避免在某些场景下的异步依赖
  return false;
};

/**
 * 异步更新节日信息到UI
 * @param {String} dateStr 日期字符串
 * @param {Boolean} isRefresh 是否强制刷新
 */
window.lunarUtils.updateFestivalInfo = async function(dateStr, isRefresh = false) {
  try {
    // 异步更新节日信息
    // 实际项目中应该实现具体的更新逻辑
  } catch (e) {
    logger.logWarn('异步更新节日信息失败:', e);
  }
};

/**
 * 启动异步节日信息更新
 * @param {String} dateStr 日期字符串
 */
window.lunarUtils.asyncUpdateFestivalInfo = function(dateStr) {
  try {
    // 启动异步更新
    window.lunarUtils.updateFestivalInfo(dateStr);
  } catch (e) {
    logger.logWarn('启动异步节日信息更新失败:', e);
  }
};

// 从配置文件获取基于星期的节日
window.lunarUtils.getWeekBasedFestivals = function(date, festivalConfig) {
    const festivals = [];
    
    // 检查配置
    if (!festivalConfig || !festivalConfig.festivals) {
        return festivals;
    }
    
    // 处理基于星期的节日
    festivalConfig.festivals
        .filter(f => f.dateType === 'week_based')
        .forEach(festival => {
            // 检查节日是否应该在当前日期显示
            if (window.lunarUtils.isWeekBasedFestivalMatch(date, festival)) {
                festivals.push({
                    name: festival.name,
                    type: festival.type || 'custom',
                    date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
                    priority: festival.priority || 60
                });
            }
        });
    
    return festivals;
};

// 检查基于星期的节日是否匹配
window.lunarUtils.isWeekBasedFestivalMatch = function(date, festivalConfig) {
    // 这里应该实现基于星期的节日匹配逻辑
    // 示例实现（简化版）
    return false;
};

/**
 * 获取节日样式类
 * @param {String} festivalType 节日类型
 * @returns {String} CSS样式类
 */
window.lunarUtils.getFestivalStyleClass = function(festivalType) {
    if (!festivalType || !FESTIVAL_STYLES) {
        return 'bg-gray-600 text-white px-1 rounded text-xs';
    }
    return FESTIVAL_STYLES[festivalType] || 'bg-gray-600 text-white px-1 rounded text-xs';
};

/**
 * 获取农历日期文本
 * @param {Date} date 日期对象
 * @returns {String} 农历日期文本（中文表述）
 */
window.lunarUtils.getLunarDateText = function(date) {
    try {
        if (window.lunarUtils && typeof window.lunarUtils.getLunarInfo === 'function') {
            const lunarInfo = window.lunarUtils.getLunarInfo(date);
            if (lunarInfo && lunarInfo.lunarMonth && lunarInfo.lunarDay) {
                // 检查月份索引是否有效（处理闰月情况，使用绝对值）
                const monthIndex = Math.abs(lunarInfo.lunarMonth);
                const validMonthIndex = monthIndex && monthIndex >= 1 && monthIndex <= 12 ? monthIndex : 1;
                const monthText = lunarInfo.isLeapMonth ? `闰${chineseMonths[validMonthIndex]}` : chineseMonths[validMonthIndex];
                
                // 检查日期索引是否有效
                const dayIndex = lunarInfo.lunarDay;
                const validDayIndex = dayIndex && dayIndex >= 1 && dayIndex <= 30 ? dayIndex : 1;
                return `${monthText}${chineseDays[validDayIndex]}`;
            }
        }
        
        // 如果window.lunarUtils不可用，尝试使用Solar和Lunar对象
        if (window.Solar && window.Lunar) {
            try {
                const solar = window.Solar.fromDate(date);
                const lunar = solar.getLunar();
                if (lunar) {
                    const lunarMonth = Math.abs(lunar.getMonth());
                    const isLeap = lunar.getMonth() < 0;
                    
                    // 检查月份索引是否有效
                    const validMonthIndex = lunarMonth && lunarMonth >= 1 && lunarMonth <= 12 ? lunarMonth : 1;
                    const monthText = isLeap ? `闰${chineseMonths[validMonthIndex]}` : chineseMonths[validMonthIndex];
                    
                    // 检查日期索引是否有效
                    const day = lunar.getDay();
                    const validDayIndex = day && day >= 1 && day <= 30 ? day : 1;
                    return `${monthText}${chineseDays[validDayIndex]}`;
                }
            } catch (error) {
                logger.logError('使用Solar获取农历日期失败:', error);
            }
        }
    } catch (error) {
        logger.logError('获取农历日期文本失败:', error);
    }
    return '';
};

/**
 * 生成日期显示HTML（包含农历和节日信息）
 * @param {Date} date 日期对象
 * @returns {String} HTML字符串
 */
window.lunarUtils.generateDateDisplayHTML = function(date) {
    try {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;
        
        // 获取农历日期
        const lunarDateText = window.lunarUtils.getLunarDateText(date);
        
        // 生成基础HTML，包含公历日期和农历日期
        let html = `
            <div class="flex flex-col items-center justify-center w-full h-full">
                <div class="flex items-center justify-center">
                    <span class="font-bold text-gray-800 text-lg">${day}</span>
                </div>
                `;
                
        // 如果有农历日期，添加农历日期显示
        if (lunarDateText) {
            html += `
                <div class="text-xs text-gray-500 mt-1">${lunarDateText}</div>
            `;
        }
        
        html += `
            </div>
        `;
        
        // 异步更新节日信息
        if (typeof window.lunarUtils.asyncUpdateFestivalInfo === 'function') {
            window.lunarUtils.asyncUpdateFestivalInfo(dateString);
        }
        
        return html;
    } catch (error) {
        console.error('生成日期显示HTML失败:', error);
        return `<div>${date.getDate()}</div>`;
    }
};

/**
 * 异步更新节日信息到日期元素
 * @param {String} dateStr 日期字符串，格式为YYYY-MM-DD (可选)
 * 如果不传入参数，则更新所有日历日期元素的节日信息
 */
window.lunarUtils.asyncUpdateFestivalInfo = async function(dateStr) {
    try {
        let dateElements = [];
        
        // 如果没有提供dateStr参数，则更新所有日历日期元素
        if (!dateStr) {
            // 查找所有带有data-date属性的日历日期元素
            dateElements = document.querySelectorAll('.calendar-day[data-date]');
        } else {
            // 查找指定日期的元素
            dateElements = document.querySelectorAll(`[data-date="${dateStr}"]`);
        }
        
        if (dateElements.length === 0) return;
        
        // 为每个日期元素添加节日信息
        for (const element of dateElements) {
            // 获取日期字符串
            const currentDateStr = !dateStr ? element.getAttribute('data-date') : dateStr;
            if (!currentDateStr) continue;
            
            // 获取节日信息
            const festivals = await window.lunarUtils.getFestivals(new Date(currentDateStr));
            
            // 查找或创建节日容器
            let festivalContainer = element.querySelector('.festival-container');
            if (!festivalContainer) {
                festivalContainer = document.createElement('div');
                festivalContainer.className = 'festival-container flex flex-wrap justify-center gap-1 mt-1';
                element.appendChild(festivalContainer);
            }
            
            // 清除现有节日标签
            festivalContainer.innerHTML = '';
            
            // 添加节日标签
            festivals.slice(0, 2).forEach(festival => {
                const festivalTag = document.createElement('span');
                festivalTag.className = window.lunarUtils.getFestivalStyleClass(festival.type);
                festivalTag.textContent = festival.name;
                festivalContainer.appendChild(festivalTag);
            });
        }
    } catch (error) {
        logger.logError('异步更新节日信息失败:', error);
    }
};

// 提供常量访问
window.lunarUtils.FESTIVAL_TYPES = FESTIVAL_TYPES;
window.lunarUtils.FESTIVAL_STYLES = FESTIVAL_STYLES;
window.lunarUtils.DEFAULT_HOLIDAY_CONFIG = DEFAULT_HOLIDAY_CONFIG;
window.lunarUtils.CUSTOM_FESTIVALS = CUSTOM_FESTIVALS;