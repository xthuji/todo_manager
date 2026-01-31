import requests
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor

# 结果路径
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AREA_CODES_FILE_PATH = os.path.join(BASE_DIR, 'data', 'weather', 'cma_weather_area_codes.json')
PROVINCES_FILE_PATH = os.path.join(BASE_DIR, 'data', 'weather', 'cma_china_provinces.json')

# 发送HTTP请求并处理响应
def send_request(url):
    headers = {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise Exception(f"请求失败: {str(e)}")

# 读取省份数据
def read_provinces_data():
    print('开始读取省份数据...')
    try:
        with open(PROVINCES_FILE_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        raise Exception(f"读取省份数据失败: {str(e)}")

# 抓取指定省份的地区编码数据
def fetch_areas_by_province(province):
    print(f"正在抓取省份 {province['name']} 的地区数据...")
    url = f"https://weather.cma.cn/api/dict/province/{province['code']}"
    
    try:
        response_data = send_request(url)
        
        # 检查响应是否成功
        if response_data.get('code') != 0 or not response_data.get('data'):
            print(f"获取 {province['name']} 的数据失败，响应状态: {response_data.get('code', '未知')}")
            return None
        
        # 提取地区信息
        areas = []
        
        # 处理字符串格式的数据
        if isinstance(response_data['data'], str):
            print(f"{province['name']} 数据格式: 字符串")
            
            # 特殊处理香港特别行政区
            if '香港' in province['name']:
                print('特殊处理香港特别行政区数据')
                print(f"香港原始数据: {response_data['data']}")
                
                # 香港数据可能没有|分隔符，直接检查格式
                if '香港天文台' in response_data['data']:
                    # 香港数据格式: 编码,名称
                    parts = response_data['data'].split(',')
                    if len(parts) >= 2:
                        code = parts[0].strip()
                        name = ','.join(parts[1:]).strip()  # 处理名称中可能包含逗号的情况
                        print(f"香港提取: 编码={code}, 名称={name}")
                        if code and name:
                            areas.append({
                                'name': name,
                                'code': code
                            })
            else:
                # 先用 | 符号分割成地区条目列表
                area_entries = response_data['data'].split('|')
                
                print(f"{province['name']} 原始数据样本: {response_data['data'][:100]}...")
                print(f"{province['name']} 分割后条目数: {len(area_entries)}")
                
                for entry in area_entries:
                    # 跳过空条目
                    if not entry.strip():
                        continue
                    
                    # 用 , 符号分割取地区编码和名称
                    # 格式应该是：编码,名称
                    parts = entry.split(',')
                    
                    if len(parts) >= 2:
                        code = parts[0].strip()
                        # 处理名称中可能包含逗号的情况
                        name = ','.join(parts[1:]).strip()
                        
                        if code and name:
                            # 检查编码是否为有效格式
                            if code.isalnum():
                                areas.append({
                                    'name': name,
                                    'code': code
                                })
                                # 减少日志输出，只显示部分
                                if len(areas) <= 3 or len(areas) % 10 == 0:
                                    print(f"{province['name']} 添加地区: {name} ({code})")
                            else:
                                print(f"{province['name']} 跳过无效编码: {code} (地区: {name})")
                    elif len(parts) == 1:
                        # 处理可能只有名称没有编码的情况
                        name = parts[0].strip()
                        if name and len(name) > 1:
                            print(f"{province['name']} 发现无编码地区: {name}")
                    else:
                        print(f"{province['name']} 跳过格式异常的条目: {entry}")
        else:
            print(f"{province['name']} 数据格式未知: {type(response_data['data'])}")
            # 尝试显示数据预览
            try:
                preview = json.dumps(response_data['data'])[:100]
                print(f"{province['name']} 数据预览: {preview}...")
            except Exception as e:
                print(f"{province['name']} 无法显示数据预览")
        
        # 记录提取的地区数量
        print(f"{province['name']} 提取到 {len(areas)} 个地区")
        
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
