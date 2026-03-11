import json
import os
import time

# 路径配置
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tianqiCityPath = os.path.join(BASE_DIR, 'weather', 'tianqi_city.json')
outputPath = os.path.join(BASE_DIR, 'weather', 'tianqi_area_codes.json')

try:
    print('正在读取源文件...')
    # 读取源文件内容
    with open(tianqiCityPath, 'r', encoding='utf-8') as f:
        tianqiCityData = json.load(f)
    
    # 创建结果对象
    result = {
        'timestamp': int(time.time() * 1000),
        'data': []
    }
    
    print('开始转换数据结构...')
    
    # 转换省级数据
    for provinceName, provinceObj in tianqiCityData.items():
        # 创建省级节点（不设置code，因为只有叶子节点需要设置）
        provinceNode = {
            'name': provinceName,
            'children': []
        }
        
        # 转换市级数据
        for cityName, cityObj in provinceObj.items():
            # 创建市级节点（不设置code）
            cityNode = {
                'name': cityName,
                'children': []
            }
            
            # 转换区县级数据（叶子节点，需要设置code）
            for districtName, districtInfo in cityObj.items():
                # 创建区县级节点（叶子节点，设置code）
                districtNode = {
                    'name': districtName,
                    'code': districtInfo['AREAID']
                }
                
                cityNode['children'].append(districtNode)
            
            # 只有当城市有区县时才添加
            if cityNode['children']:
                provinceNode['children'].append(cityNode)
        
        # 只有当省份有城市时才添加
        if provinceNode['children']:
            result['data'].append(provinceNode)
    
    print('数据转换完成，正在写入文件...')
    
    # 确保输出目录存在
    outputDir = os.path.dirname(outputPath)
    if not os.path.exists(outputDir):
        os.makedirs(outputDir, exist_ok=True)
    
    # 写入结果到新文件
    with open(outputPath, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"转换成功！新文件已保存至：{outputPath}")
    print(f"转换数据统计：")
    print(f"- 省份数量：{len(result['data'])}")
    
    # 统计城市和区县数量
    cityCount = 0
    districtCount = 0
    
    for province in result['data']:
        cityCount += len(province['children'])
        for city in province['children']:
            districtCount += len(city['children'])
    
    print(f"- 城市数量：{cityCount}")
    print(f"- 区县数量：{districtCount}")
    
except Exception as error:
    print(f"转换过程中发生错误：{str(error)}")
    exit(1)
