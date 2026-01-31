import os
from app.utils.config_util import config_util

# 目录路径
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE_DIR = os.path.join(BASE_DIR, 'data', 'cache')
MOCK_DIR = os.path.join(BASE_DIR, 'data', 'mock')
DATA_DIR = os.path.join(BASE_DIR, 'data')

# 从配置文件中读取配置项
USE_MOCK = config_util.get_config_value('app', 'features.mock.enabled', False)
USE_CACHE = config_util.get_config_value('app', 'features.cache.enabled', True)
PRINT_API_DATA = config_util.get_config_value('app', 'logs.printApiData', False)
PRINT_DATA_LOG = config_util.get_config_value('app', 'logs.printDataLog', False)

# 设置通用请求头
WEATHER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2'
}
