const path = require("path");

const CACHE_DIR = path.join(__dirname, '../../../data/cache');
const MOCK_DIR = path.join(__dirname, '../../../data/mock');

// 是否mock接口数据
const USE_MOCK = false;
// 是否使用接口缓存数据
const USE_CACHE = true;
// 是否打印接口结果数据
const PRINT_API_DATA = false;
// 是否打印数据日志
const PRINT_DATA_LOG = false;

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
    WEATHER_HEADERS
};

