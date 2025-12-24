// 自动天气通知服务
const cron = require('node-cron');
const weatherService = require('./weatherService');
const notifyService = require('./notifyService');
const locationAreaService = require('./locationAreaService');

/**
 * 自动天气通知服务
 */
class AutoWeatherNotify {
  constructor() {
    this.isSending = false;
    this.cronJob = null;
    this.DEFAULT_CRON = '0 0 * * *';
    this.TIMEZONE = 'Asia/Shanghai';

    // 天气图标映射表
    this.WEATHER_ICONS = [
      { keywords: ['暴雨', '大雨', '中雨', '小雨', '阵雨', '雨'], icon: '🌧️' },
      { keywords: ['雷阵雨', '雷'], icon: '⚡' },
      { keywords: ['雾', '霾'], icon: '🌫️' },
      { keywords: ['多云', '晴间多云'], icon: '⛅' },
      { keywords: ['晴'], icon: '☀️' },
      { keywords: ['阴'], icon: '☁️' },
      { keywords: ['雪'], icon: '❄️' },
      { keywords: ['云'], icon: '☁️' },
    ];
  }

  /**
   * 启动定时器
   */
  async startWeatherNotifyTimer() {
    console.log('正在初始化天气通知定时器...');
    this.stopWeatherNotifyTimer();
    
    const notifyConfig = await notifyService.loadNotifyConfig();
    const config = notifyConfig?.weather;
    if (!config?.notifyEnabled) {
      console.log('天气通知功能未启用');
      return;
    }

    if (!config.weatherCode || !config.phoneNumber) {
      console.error('配置缺失: weatherCode 或 phoneNumber');
      return;
    }

    if (config.timerEnabled) {
      const cronExpression = cron.validate(config.cronExpression) 
        ? config.cronExpression 
        : this.DEFAULT_CRON;
  
      this.cronJob = cron.schedule(
        cronExpression,
        () => this.sendWeatherNotifyOnTimer().catch(console.error),
        { scheduled: true, timezone: this.TIMEZONE }
      );
  
      console.log(`定时器已启动 [${cronExpression}]，时区: ${this.TIMEZONE}`);
    }

    if (config.startupNotifyEnabled) {
      console.log('执行启动时即时通知...');
      this.sendWeatherNotifyOnTimer();
    }
  }

  /**
   * 停止定时器
   */
  stopWeatherNotifyTimer() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('定时器已停止');
    }
  }

  /**
   * 获取天气图标
   */
  getWeatherIcon(weather = '') {
    const match = this.WEATHER_ICONS.find(item => 
      item.keywords.some(key => weather.includes(key))
    );
    return match ? match.icon : '⛅';
  }

  /**
   * 格式化日期与星期
   * @param {Date|string} input 
   */
  formatDateTime(input, weekOnly) {
    let date = input instanceof Date ? input : new Date();
    if (typeof input === 'string' && input.length === 8) {
      // 处理 20251225 这种格式
      date = new Date(`${input.slice(0, 4)}-${input.slice(4, 6)}-${input.slice(6, 8)}`);
    }
    const formatConfig = weekOnly ? { weekday: 'short' } : {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
      weekday: 'short'
    }
    const formatter = new Intl.DateTimeFormat('zh-CN', formatConfig);
    
    // 返回格式: 2025/12/25 周四 17:30
    return formatter.format(date).replace(/\//g, '-');
  }

  /**
   * 组织天气文本
   */
  organizeWeatherText(weatherData) {
    const { todayWeather, recentDaysWeather, areaName, weatherCode, mojiAreaCode, nmcAreaCode, cmaAreaCode } = weatherData;
    const dateStr = this.formatDateTime(new Date());
    
    let lines = [
      `📍 ${areaName || '未知地区'} 天气 📅 ${dateStr}`,
      '',
      `${this.getWeatherIcon(todayWeather.weather)} ${todayWeather.weather || '未知'}，🌡️ 温度：${todayWeather.tempMin ?? '--'}~${todayWeather.tempMax ?? '--'}°C`,
      `💧 湿度：${todayWeather.humidity ?? '--'}`,
      `🍃 空气质量：${todayWeather.airQuality ?? '--'}`,
      `༄ 风力风向：${todayWeather.wind ?? '--'}`,
    ];

    if (recentDaysWeather?.length > 1) {
      lines.push('\n未来天气预告：');
      recentDaysWeather.slice(1).forEach((day, i) => {
        const weekDay = this.formatDateTime(day.date, true);
        lines.push(`${i + 1}天后(${weekDay})：${this.getWeatherIcon(day.weather)}${day.weather || '--'}，🌡️${day.tempMin}~${day.tempMax}°C，༄${day.wind || '--'}`);
      });
    }

    lines.push('\n🔗 详情查阅：');
    if (weatherCode) lines.push(`· [天气网](https://forecast.weather.com.cn/town/weather1dn/${weatherCode}.shtml)`);
    if (mojiAreaCode) lines.push(`· [墨迹天气](https://tianqi.moji.com/weather/china/${mojiAreaCode})`);
    if (nmcAreaCode) lines.push(`· [中央气象台](https://www.nmc.cn/publish/forecast/${nmcAreaCode}.html)`);
    if (cmaAreaCode) lines.push(`· [中国气象局](https://weather.cma.cn/web/weather/${cmaAreaCode}.html)`);

    lines.push('\n祝您生活愉快！');
    return lines.join('\n');
  }

  /**
   * 执行通知任务
   */
  async sendWeatherNotifyOnTimer() {
    console.log(`天气通知任务启动...`);
    if (this.isSending) return;
    this.isSending = true;

    const notifyConfig = await notifyService.getNotifyConfig();
    const config = notifyConfig?.weather
    const weatherCode = config.weatherCode;
    try {
      console.log(`[Task] 正在获取 [${weatherCode}] 的天气数据...`);

      const districtAreaCode = locationAreaService.getDistrictAreaCodes(weatherCode);
      const weatherResult = await weatherService.getWeatherData({ weatherCode, ...districtAreaCode });
      
      const weatherData = weatherResult?.data;
      const validation = this.validateWeatherData(weatherData);

      if (!validation.isValid) {
        throw new Error(`数据校验失败: ${validation.errors.join(', ')}`);
      }

      const weatherText = this.organizeWeatherText(weatherData);
      const result = await notifyService.sendMessage('weather', config, weatherText);

      const text = result.success ? `天气通知发送成功`
        : `天气通知发送失败: ${result.message || '未知错误'}`;
      console.log(text);
    } catch (error) {
      console.error(`[Error] 任务失败: ${error.message}`);
      await this.sendErrorNotify(config, error.message);
    } finally {
      this.isSending = false;
    }
  }

  /**
   * 简单的校验逻辑
   */
  validateWeatherData(data) {
    const errors = [];
    if (!data?.todayWeather) errors.push('缺少今日天气');
    if (!data?.areaName && !data?.weatherCode) errors.push('缺少区域标识');
    return { isValid: errors.length === 0, errors };
  }

  /**
   * 发送错误警报
   */
  async sendErrorNotify(targetUserInfo, message) {
    if (!targetUserInfo) return;
    try {
      const errorText = `❌ 天气服务异常\n时间: ${this.formatDateTime(new Date())}\n原因: ${message}`;
      await notifyService.sendMessage('weather', targetUserInfo, errorText);
    } catch (e) {
      console.error('警报通知发送失败:', e.message);
    }
  }
}

module.exports = new AutoWeatherNotify();