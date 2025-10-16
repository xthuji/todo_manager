const path = require("path");
const { configManager } = require('./configManager');

const CACHE_DIR = path.join(__dirname, '../../../data/cache');
const MOCK_DIR = path.join(__dirname, '../../../data/mock');
const DATA_DIR = path.join(__dirname, '../../../data');

// 从配置文件中读取配置项
const USE_MOCK = configManager.getConfigValue('app', 'features.mock.enabled', false);
const USE_CACHE = configManager.getConfigValue('app', 'features.cache.enabled', true);
const PRINT_API_DATA = configManager.getConfigValue('app', 'logs.printApiData', false);
const PRINT_DATA_LOG = configManager.getConfigValue('app', 'logs.printDataLog', false);

// 设置通用请求头
const WEATHER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2'
};

module.exports = {
    USE_MOCK,
    USE_CACHE,
    PRINT_API_DATA,
    PRINT_DATA_LOG,
    CACHE_DIR,
    MOCK_DIR,
    DATA_DIR,
    WEATHER_HEADERS
};