import requests
import json
import os
import time
import re
from concurrent.futures import ThreadPoolExecutor

# 结果路径
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AREA_CODES_FILE_PATH = os.path.join(BASE_DIR, 'data', 'weather', 'moji_weather_area_codes.json')
PROVINCES_FILE_PATH = os.path.join(BASE_DIR, 'data', 'weather', 'moji_china_provinces.json')

# 发送HTTP请求并正确处理编码
def send_request(url):
    headers = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        # 处理编码
        response.encoding = response.apparent_encoding
        return clean_encoding(response.text)
    except requests.exceptions.RequestException as e:
        raise Exception(f"请求失败: {str(e)}")

# 清理编码问题，处理乱码和HTML实体
def clean_encoding(text):
    # 替换常见的乱码字符
    text = text.replace('\ufffd', '')  # 移除Unicode替换字符
    text = text.replace('&#39;', "'")  # 解码HTML实体单引号
    text = text.replace('&quot;', '"')  # 解码HTML实体双引号
    text = text.replace('&amp;', '&')   # 解码HTML实体&符号
    text = text.replace('&lt;', '<')    # 解码HTML实体<符号
    text = text.replace('&gt;', '>')    # 解码HTML实体>符号
    return text.strip()

# 读取省份数据
def read_provinces_data():
    print('开始读取省份数据...')
    try:
        with open(PROVINCES_FILE_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        raise Exception(f"读取省份数据失败: {str(e)}")

# 从HTML中提取地区编码数据
def extract_area_codes_from_html(html, province_name):
    area_codes = []
    
    # 使用正则表达式提取地区信息
    # 查找形如 <a href="//m.moji.com/weather/china/beijing/beijing-olympic-forest-park">北京奥林匹克公园</a> 的结构
    area_regex = r'<li>\s*<a\s+href="//m\.moji\.com/weather/china/[^/]+/([^"]+)"[^>]*>([^<]+)</a>\s*</li>'
    matches = re.findall(area_regex, html)
    
    for match in matches:
        code = match[0]
        name = clean_encoding(match[1])
        
        if code and name:  # 过滤无效数据
            area_codes.append({
                'name': name,
                'code': code
            })
    
    return area_codes

# 抓取指定省份的地区编码数据
def fetch_areas_by_province(province):
    print(f"正在抓取省份 {province['name']} 的地区数据...")
    url = f"https://m.moji.com/weather/china/{province['code']}"
    
    try:
        html = send_request(url)
        areas = extract_area_codes_from_html(html, province['name'])
        
        # 构建省份数据结构
        province_data = {
            'name': province['name'],
            'code': province['code'],
            'children': areas
        }
        
        print(f"成功抓取 {province['name']} 的 {len(areas)} 个地区")
        return province_data
    except Exception as e:
        print(f"抓取 {province['name']} 的地区数据失败: {str(e)}")
        return None

# 主函数
def main():
    try:
        # 1. 读取所有省份数据
        provinces = read_provinces_data()
        print(f"成功读取到 {len(provinces)} 个省份")
        
        # 2. 并行抓取每个省份的地区数据
        result = {
            'timestamp': int(time.time() * 1000),
            'data': []
        }
        
        # 使用线程池并行处理
        with ThreadPoolExecutor(max_workers=10) as executor:
            # 提交所有任务
            province_results = []
            for province in provinces:
                # 添加延迟避免请求过于集中
                delay = time.random() * 1  # 0-1秒延迟
                time.sleep(delay)
                
                # 提交任务到线程池
                future = executor.submit(fetch_areas_by_province, province)
                province_results.append(future)
            
            # 等待所有任务完成并获取结果
            province_data_list = [future.result() for future in province_results]
        
        # 过滤掉失败的省份数据（None值）
        result['data'] = [data for data in province_data_list if data is not None and data.get('children') and len(data.get('children')) > 0]
        
        # 3. 保存结果
        # 确保目录存在
        output_dir = os.path.dirname(AREA_CODES_FILE_PATH)
        if not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
            print(f"创建目录: {output_dir}")
        
        with open(AREA_CODES_FILE_PATH, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"数据已保存到: {AREA_CODES_FILE_PATH}")
        print(f"总共成功抓取 {len(result['data'])} 个省份的地区数据")
        
        # 统计总地区数量
        total_areas = sum(len(province['children']) for province in result['data'])
        print(f"总共抓取到 {total_areas} 个地区")
        
    except Exception as e:
        print(f"抓取过程中发生错误: {str(e)}")
        exit(1)

# 执行主函数
if __name__ == '__main__':
    main()
