/**
 * 节日计算公共工具模块
 * 功能说明：提供节日计算、日期转换等基础功能（仅处理节日信息，不包含法定节假日判断）
 * 不包含任何页面DOM操作，专注于核心计算逻辑
 */

// 全局节日工具对象
window.festivalUtils = window.festivalUtils || {};

// 节日样式配置常量 - 与页面样式保持一致
const FESTIVAL_STYLES = {
  'chinese_common': 'bg-red-500 text-white px-1 rounded text-xs',
  'chinese_traditional': 'bg-red-400 text-white px-1 rounded text-xs',
  'solar_terms': 'bg-green-500 text-white px-1 rounded text-xs',
  'foreign': 'bg-purple-500 text-white px-1 rounded text-xs',
  'custom': 'bg-blue-500 text-white px-1 rounded text-xs'
};

// 中文月份名称
const chineseMonths = ['', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];

// 中文日期名称
const chineseDays = ['', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十', 
                     '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
                     '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];

/**
 * 获取指定日期的农历信息和节气
 * @param {Date|String} date 日期对象或日期字符串
 * @returns {Object} 农历信息对象
 */
window.festivalUtils.getLunarInfo = function(date) {
  try {
    const targetDate = date instanceof Date ? date : new Date(date);
    if (isNaN(targetDate.getTime())) {
      console.warn('无效的日期参数');
      return null;
    }

    // 使用Solar和Lunar对象获取农历信息
    if (window.Solar && window.Lunar) {
      try {
        const solar = window.Solar.fromDate(targetDate);
        const lunar = solar.getLunar();
        
        if (lunar) {
          return {
            lunarMonth: lunar.getMonth(),
            lunarDay: lunar.getDay(),
            isLeapMonth: lunar.getMonth() < 0,
            solarTerm: lunar.getJieQi(),
            year: lunar.getYear(),
            month: lunar.getMonth(),
            day: lunar.getDay()
          };
        }
      } catch (error) {
        console.warn('使用Solar对象获取农历信息失败:', error);
      }
    }
    return null;
  } catch (error) {
    console.error('获取农历信息失败:', error);
    return null;
  }
};

/**
 * 获取节日类型对应的样式类
 * @param {string} type 节日类型
 * @returns {string} 样式类名
 */
window.festivalUtils.getFestivalTypeClass = function(type) {
  // 返回统一的节日样式类，区分常用节日和传统节日以实现颜色区分
  switch (type) {
    case 'chinese_common':
      return 'bg-festival-common'; // 常用节日 - 红色
    case 'chinese_traditional':
      return 'bg-festival-traditional'; // 传统节日 - 浅红色
    case 'foreign':
      return 'bg-festival-foreign'; // 国外节日
    case 'solar_terms':
      return 'bg-festival-terms'; // 节气
    case 'custom':
      return 'bg-festival-custom'; // 自定义节日
    default:
      return 'bg-festival-custom'; // 默认使用自定义节日样式
  }
};

/**
 * 获取节日类型名称
 * @param {string} type 节日类型
 * @returns {string} 节日类型中文名称
 */
window.festivalUtils.getFestivalTypeName = function(type) {
  switch (type) {
    case 'chinese_common':
      return '常用节日';
    case 'foreign':
      return '国外节日';
    case 'solar_terms':
      return '节气';
    case 'chinese_traditional':
      return '传统节日';
    case 'custom':
      return '自定义节日';
    default:
      return '未知类型';
  }
};

/**
 * 获取指定日期的所有节日
 * @param {Date|String} date 日期对象或日期字符串
 * @returns {Promise<Array>} 节日数组
 */
window.festivalUtils.getFestivals = async function(date) {
  try {
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
    if (window.lunarUtils && typeof window.lunarUtils.generateCustomFestivals === 'function') {
      try {
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
      } catch (error) {
        console.warn('获取自定义节日失败:', error);
      }
    }
    
    // 去重和按优先级排序
    return window.festivalUtils.deduplicateAndSortFestivals(festivals);
  } catch (error) {
    console.error('获取节日列表失败:', error);
    return [];
  }
};

/**
 * 检查日期是否匹配节日
 * @param {Date|String} date 日期对象或日期字符串
 * @param {Object} festival 节日配置
 * @returns {Boolean} 是否匹配
 */
window.festivalUtils.isFestivalDate = function(date, festival) {
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
        try {
          const solar = window.Solar.fromDate(targetDate);
          const lunar = solar.getLunar();
          
          if (lunar) {
            const lunarMonth = lunar.getMonth();
            const lunarDay = lunar.getDay();
            const isLeapMonth = lunarMonth < 0;
            
            // 解析节日配置中的农历日期
            const match = festival.date.match(/^(\d+)-(\d+)(-leap)?$/);
            if (match) {
              const targetMonth = parseInt(match[1]);
              const targetDay = parseInt(match[2]);
              const targetLeapMonth = !!match[3];
              
              return Math.abs(lunarMonth) === targetMonth && 
                     lunarDay === targetDay && 
                     isLeapMonth === targetLeapMonth;
            }
          }
        } catch (error) {
          console.warn('检查农历节日日期失败:', error);
        }
      }
    } else if (festival.dateType === 'week') {
      // 基于星期的节日
      return window.festivalUtils.isWeekBasedFestivalDate(targetDate, festival);
    }
    
    return false;
  } catch (error) {
    console.error('检查日期是否匹配节日失败:', error);
    return false;
  }
};

/**
 * 检查是否是基于星期的节日日期
 * @param {Date} date 日期对象
 * @param {Object} festival 节日配置
 * @returns {Boolean} 是否匹配
 */
window.festivalUtils.isWeekBasedFestivalDate = function(date, festival) {
  try {
    if (!date || !festival || !festival.dateType || festival.dateType !== 'week') {
      return false;
    }
    
    const targetDate = date instanceof Date ? date : new Date(date);
    if (isNaN(targetDate.getTime())) {
      return false;
    }
    
    // 解析基于星期的节日配置
    // 格式例如：'5-2' 表示5月第2个星期
    const match = festival.date.match(/^(\d+)-(\d+)$/);
    if (match) {
      const targetMonth = parseInt(match[1]);
      const targetWeek = parseInt(match[2]);
      
      // 检查月份是否匹配
      if (targetDate.getMonth() + 1 !== targetMonth) {
        return false;
      }
      
      // 计算这个月的第几个星期几
      const dayOfWeek = targetDate.getDay();
      const firstDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const firstDayOfWeek = firstDay.getDay();
      
      // 计算当前日期是第几周
      const weekNumber = Math.ceil((targetDate.getDate() + firstDayOfWeek) / 7);
      
      return weekNumber === targetWeek;
    }
    
    return false;
  } catch (error) {
    console.error('检查基于星期的节日日期失败:', error);
    return false;
  }
};

/**
 * 节日去重和排序
 * @param {Array} festivals 节日数组
 * @returns {Array} 去重并排序后的节日数组
 */
window.festivalUtils.deduplicateAndSortFestivals = function(festivals) {
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
 * 获取指定日期的节日信息（同步版本）
 * 用于日历视图中快速获取节日数据
 * @param {Date|String} date 日期对象或日期字符串
 * @returns {Array} 节日数组
 */
window.festivalUtils.getFestivalsForDate = function(date) {
  try {
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
    const monthDay = `${month}-${day}`;
    
    // 初始化节日结果数组
    const festivals = [];
    
    // 1. 基本节日数据（作为兜底）
    const basicFestivals = {
      '01-01': { name: '元旦', type: 'chinese_common', priority: 100 },
      '02-14': { name: '情人节', type: 'foreign', priority: 80 },
      '03-08': { name: '妇女节', type: 'chinese_common', priority: 80 },
      '05-01': { name: '劳动节', type: 'chinese_common', priority: 100 },
      '06-01': { name: '儿童节', type: 'chinese_common', priority: 80 },
      '10-01': { name: '国庆节', type: 'chinese_common', priority: 100 },
      '12-25': { name: '圣诞节', type: 'foreign', priority: 80 }
    };
    
    // 添加基本节日
    if (basicFestivals[monthDay]) {
      festivals.push({
        ...basicFestivals[monthDay],
        date: dateStr
      });
    }
    
    // 2. 尝试从配置文件加载节日
    try {
      if (window.calendarConfig && window.calendarConfig.festivals) {
        // 处理阳历节日
        const solarFestivals = window.calendarConfig.festivals
          .filter(f => f && f.dateType === 'solar' && 
                   (f.date === monthDay || 
                    f.date === `${parseInt(month)}-${parseInt(day)}`))
          .map(festival => ({
            name: festival.name,
            type: festival.type || 'chinese_common',
            date: dateStr,
            priority: festival.priority || 80
          }));
        
        festivals.push(...solarFestivals);
        
        // 处理农历节日
        if (window.Solar && window.Lunar) {
          try {
            const solar = window.Solar.fromDate(targetDate);
            const lunar = solar.getLunar();
            
            if (lunar) {
              const lunarMonth = Math.abs(lunar.getMonth());
              const lunarDay = lunar.getDay();
              const isLeapMonth = lunar.getMonth() < 0;
              
              const lunarDateFormats = [
                `${lunarMonth}-${lunarDay}`,
                `${String(lunarMonth).padStart(2, '0')}-${String(lunarDay).padStart(2, '0')}`,
                `${lunarMonth}-${lunarDay}${isLeapMonth ? '-leap' : ''}`
              ];
              
              const lunarFestivals = window.calendarConfig.festivals
                .filter(f => f && f.dateType === 'lunar' && 
                          lunarDateFormats.includes(f.date))
                .map(festival => ({
                  name: festival.name,
                  type: festival.type || 'chinese_traditional',
                  date: dateStr,
                  priority: festival.priority || 90
                }));
              
              festivals.push(...lunarFestivals);
              
              // 添加节气
              const solarTerm = lunar.getJieQi();
              if (solarTerm) {
                festivals.push({
                  name: solarTerm,
                  type: 'solar_terms',
                  date: dateStr,
                  priority: 95
                });
              }
            }
          } catch (error) {
            console.warn('获取农历节日失败:', error);
          }
        }
      }
    } catch (error) {
      console.warn('从配置加载节日失败:', error);
    }
    
    // 3. 尝试使用lunarUtils（兼容性支持）
    try {
      if (window.lunarUtils && typeof window.lunarUtils.generateCustomFestivals === 'function') {
        const customFestivals = window.lunarUtils.generateCustomFestivals();
        if (customFestivals && customFestivals[dateStr]) {
          customFestivals[dateStr].forEach(festival => {
            festivals.push({
              ...festival,
              type: festival.type || 'custom',
              date: dateStr,
              priority: festival.priority || 70
            });
          });
        }
      }
    } catch (error) {
      console.warn('获取自定义节日失败:', error);
    }
    
    // 去重和排序
    return window.festivalUtils.deduplicateAndSortFestivals(festivals);
  } catch (error) {
    console.error('获取日期节日信息失败:', error);
    // 返回基本节日作为最终兜底
    const month = String((date instanceof Date ? date : new Date(date)).getMonth() + 1).padStart(2, '0');
    const day = String((date instanceof Date ? date : new Date(date)).getDate()).padStart(2, '0');
    const monthDay = `${month}-${day}`;
    
    const basicFestivals = {
      '01-01': { name: '元旦', type: 'chinese_common' },
      '02-14': { name: '情人节', type: 'foreign' },
      '03-08': { name: '妇女节', type: 'chinese_common' },
      '05-01': { name: '劳动节', type: 'chinese_common' },
      '06-01': { name: '儿童节', type: 'chinese_common' },
      '10-01': { name: '国庆节', type: 'chinese_common' },
      '12-25': { name: '圣诞节', type: 'foreign' }
    };
    
    if (basicFestivals[monthDay]) {
      return [basicFestivals[monthDay]];
    }
    
    return [];
  }
};