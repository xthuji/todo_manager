import json
import os
import re
import time

# 基础目录
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 文件路径
tianqiAreaCodesPath = os.path.join(BASE_DIR, 'data', 'weather', 'tianqi_area_codes.json')
mojiWeatherAreaCodesPath = os.path.join(BASE_DIR, 'data', 'weather', 'moji_weather_area_codes.json')
nmcWeatherAreaCodesPath = os.path.join(BASE_DIR, 'data', 'weather', 'nmc_weather_area_codes.json')
cmaWeatherAreaCodesPath = os.path.join(BASE_DIR, 'data', 'weather', 'cma_weather_area_codes.json')
outputFilePath = os.path.join(BASE_DIR, 'data', 'weather', 'merged_weather_area_codes.json')
logFilePath = os.path.join(BASE_DIR, 'logs', 'weather_codes_merge_log.txt')

# 确保logs目录存在
def ensure_logs_dir():
    logsDir = os.path.dirname(logFilePath)
    if not os.path.exists(logsDir):
        os.makedirs(logsDir, exist_ok=True)

# 辅助函数：移除地区名称后缀
def remove_region_suffix(name):
    return re.sub(r'[市区县旗盟特区]$|自治区$', '', name)

# 辅助函数：移除括号中的内容
def remove_brackets_content(name):
    return re.sub(r'\([^)]*\)', '', name).strip()

# 辅助函数：清洗省份名称
def clean_province_name(province_name):
    # 移除省份常见后缀
    cleaned = re.sub(r'[省市区]$|自治区$|特别行政区$', '', province_name)
    return cleaned.strip()

# 辅助函数：尝试添加后缀进行匹配
def try_with_suffixes(name, callback):
    suffixes = ['', '区', '县', '市', '旗', '口', '镇', '盟', '特区', '特别行政区', '自治区', '自治县']
    
    for suffix in suffixes:
        test_name = name + suffix
        result = callback(test_name)
        if result:
            return {'result': result, 'suffix': suffix}
    
    return {'result': None, 'suffix': None}

# 计算字符串相似度
def calculate_similarity(str1, str2):
    s1 = remove_region_suffix(remove_brackets_content(str1))
    s2 = remove_region_suffix(remove_brackets_content(str2))
    
    # 完全匹配
    if s1 == s2:
        return 1
    
    # 部分包含
    if s1 in s2 or s2 in s1:
        return 0.9
    
    # 计算交集字符比例
    set1 = set(s1)
    set2 = set(s2)
    intersection = set1.intersection(set2)
    similarity = len(intersection) / max(len(set1), len(set2)) if max(len(set1), len(set2)) > 0 else 0
    
    return similarity

# 辅助函数：模糊匹配
def fuzzy_match(target_name, item):
    clean_target_name = remove_region_suffix(remove_brackets_content(target_name))
    clean_item_name = remove_region_suffix(item['name'])
    
    # 完全匹配
    if (clean_target_name == clean_item_name or 
        target_name == item['name'] or
        clean_target_name == item['name'] or
        target_name == clean_item_name or
        remove_brackets_content(target_name) == item['name'] or
        target_name == remove_brackets_content(item['name'])):
        return True
    
    # 字符相似度匹配
    similarity = calculate_similarity(target_name, item['name'])
    required_similarity = 0.9 if len(clean_target_name) <= 2 else 0.8
    if similarity >= required_similarity:
        return True
    
    return False

# 合并所有天气数据源
def merge_all_weather_codes():
    try:
        print('开始读取数据源文件...')
        
        # 读取并解析JSON文件
        with open(tianqiAreaCodesPath, 'r', encoding='utf-8') as f:
            tianqiData = json.load(f)
        
        with open(mojiWeatherAreaCodesPath, 'r', encoding='utf-8') as f:
            mojiData = json.load(f)
        
        with open(nmcWeatherAreaCodesPath, 'r', encoding='utf-8') as f:
            nmcData = json.load(f)
        
        with open(cmaWeatherAreaCodesPath, 'r', encoding='utf-8') as f:
            cmaData = json.load(f)
        
        print('文件读取完成，开始构建各数据源按省份分类的数据...')
        
        # 按省份分类的数据结构
        provinceData = {}
        
        # 从天气数据中提取省份信息并清洗
        for province in tianqiData['data']:
            cleanedProvinceName = clean_province_name(province['name'])
            provinceData[cleanedProvinceName] = {
                'provinceName': province['name'],
                'cleanedName': cleanedProvinceName,
                'districts': []
            }
            
            # 提取区县数据
            if province.get('children'):
                for city in province['children']:
                    if city.get('children'):
                        for district in city['children']:
                            provinceData[cleanedProvinceName]['districts'].append(district['name'])
        
        print(f"省份数据构建完成，共{len(provinceData)}个省份")
        
        # 为各数据源按省份分类
        def categorize_by_province(data, source_name):
            categorized = {}
            uncategorized = []
            
            # 遍历每个省份的数据
            for cleanedProvinceName in provinceData:
                categorized[cleanedProvinceName] = []
            
            # 递归收集并分类数据
            def collect_and_categorize(items, parent_name='', province_name=None, level=0):
                for item in items:
                    item_data = {
                        **item,
                        'parentName': parent_name,
                        'level': level,
                        'fullPath': f"{parent_name}-{item['name']}" if parent_name else item['name']
                    }
                    
                    if level == 0:
                        # 省份级别，尝试匹配到已清洗的省份名称
                        cleanedItemName = clean_province_name(item['name'])
                        matched = False
                        
                        for cleanedProvinceName in categorized:
                            if (cleanedProvinceName == cleanedItemName or 
                                cleanedProvinceName in cleanedItemName or 
                                cleanedItemName in cleanedProvinceName):
                                categorized[cleanedProvinceName].append(item_data)
                                matched = True
                                break
                        
                        if not matched:
                            uncategorized.append(item_data)
                    elif province_name:
                        # 非省份级别，使用已知省份名称分类
                        cleanedProvinceName = clean_province_name(province_name)
                        if cleanedProvinceName in categorized:
                            categorized[cleanedProvinceName].append(item_data)
                        else:
                            uncategorized.append(item_data)
                    else:
                        # 没有省份信息，暂时放入未分类
                        uncategorized.append(item_data)
                    
                    # 递归处理子项
                    if item.get('children'):
                        new_province_name = item['name'] if level == 0 else province_name
                        collect_and_categorize(item['children'], item['name'], new_province_name, level + 1)
            
            collect_and_categorize(data['data'])
            
            print(f"{source_name} - 分类完成: {len([p for p in categorized if categorized[p]])}个省份有数据，{len(uncategorized)}个未分类")
            return {'categorized': categorized, 'uncategorized': uncategorized}
        
        # 分类各数据源
        moji_by_province = categorize_by_province(mojiData, 'Moji')['categorized']
        nmc_by_province = categorize_by_province(nmcData, 'NMC')['categorized']
        cma_by_province = categorize_by_province(cmaData, 'CMA')['categorized']
        
        # 统计信息
        total_processed = 0
        province_processed = 0
        district_processed = 0
        
        province_moji_code_found = 0
        district_moji_code_found = 0
        province_nmc_code_found = 0
        district_nmc_code_found = 0
        province_cma_code_found = 0
        district_cma_code_found = 0
        
        match_details = []
        
        # 按省份和地区精确匹配
        def find_code_by_province_and_name(target_name, province_name, source_data_by_province, source_name):
            cleaned_province_name = clean_province_name(province_name)
            
            # 获取该省份下的所有数据
            province_data = source_data_by_province.get(cleaned_province_name, [])
            
            if not province_data:
                return {'code': None, 'nameCode': '', 'method': None}
            
            # 1. 精确匹配
            def exact_match(item):
                # 只匹配区县级别的数据（level >= 2 或 parentName 非空）
                if item['level'] < 2 and not item['parentName']:
                    return False
                
                clean_item_name = remove_brackets_content(item['name'])
                clean_target_name = remove_brackets_content(target_name)
                
                return (item['name'] == target_name or 
                       clean_item_name == clean_target_name or
                       remove_region_suffix(item['name']) == target_name or
                       remove_region_suffix(clean_item_name) == clean_target_name)
            
            match = next((item for item in province_data if exact_match(item)), None)
            if match:
                return {
                    'code': match['code'], 
                    'nameCode': match.get('nameCode', ''), 
                    'method': '精确匹配'
                }
            
            # 2. 尝试添加后缀匹配
            def suffix_match(test_name):
                for item in province_data:
                    if item['level'] < 2 and not item['parentName']:
                        continue
                    if item['name'] == test_name or remove_region_suffix(item['name']) == test_name:
                        return item
                return None
            
            with_suffix = try_with_suffixes(target_name, suffix_match)
            if with_suffix['result']:
                return {
                    'code': with_suffix['result']['code'], 
                    'nameCode': with_suffix['result'].get('nameCode', ''), 
                    'method': f'添加{with_suffix["suffix"]}后缀匹配'
                }
            
            # 3. 在该省份内进行模糊匹配
            fuzzy_matches = []
            for item in province_data:
                if item['level'] < 2 and not item['parentName']:
                    continue
                if fuzzy_match(target_name, item):
                    fuzzy_matches.append(item)
            
            if len(fuzzy_matches) == 1:
                return {
                    'code': fuzzy_matches[0]['code'], 
                    'nameCode': fuzzy_matches[0].get('nameCode', ''), 
                    'method': '省份内模糊匹配'
                }
            elif len(fuzzy_matches) > 1:
                # 对模糊匹配结果进行排序
                fuzzy_matches.sort(key=lambda x: calculate_similarity(target_name, x['name']), reverse=True)
                
                # 检查相似度阈值
                best_similarity = calculate_similarity(target_name, fuzzy_matches[0]['name'])
                min_required_similarity = 0.9 if len(target_name) <= 2 else 0.8
                
                if best_similarity >= min_required_similarity:
                    print(f"{source_name} - 区县({province_name}) {target_name} 模糊匹配到多个结果，选择相似度最高的: {fuzzy_matches[0]['name']}")
                    return {
                        'code': fuzzy_matches[0]['code'], 
                        'nameCode': fuzzy_matches[0].get('nameCode', ''), 
                        'method': '省份内模糊匹配(相似度排序)'
                    }
            
            return {'code': None, 'nameCode': '', 'method': None}
        
        # 查找省份级别的代码
        def find_province_code(province_name, source_data_by_province, source_name):
            cleaned_province_name = clean_province_name(province_name)
            province_data = source_data_by_province.get(cleaned_province_name, [])
            
            # 查找省份级别的数据（level === 0 或 parentName === ''）
            def province_match(item):
                if not (item['level'] == 0 or not item['parentName']):
                    return False
                clean_item_name = clean_province_name(item['name'])
                return (clean_item_name == cleaned_province_name or
                        remove_brackets_content(item['name']).find(cleaned_province_name) != -1 or
                        cleaned_province_name.find(remove_brackets_content(item['name'])) != -1)
            
            match = next((item for item in province_data if province_match(item)), None)
            
            if match:
                return {
                    'code': match['code'], 
                    'method': '精确匹配'
                }
            
            return {'code': None, 'method': None}
        
        # 递归处理数据结构
        def process_data(items, level=0, province_name=None):
            nonlocal total_processed, province_processed, district_processed
            nonlocal province_moji_code_found, district_moji_code_found
            nonlocal province_nmc_code_found, district_nmc_code_found
            nonlocal province_cma_code_found, district_cma_code_found
            nonlocal match_details
            
            for item in items:
                total_processed += 1
                
                if level == 0:  # 省份级别
                    province_processed += 1
                    cleaned_province_name = clean_province_name(item['name'])
                    
                    # 查找并设置省份级别的代码
                    moji_result = find_province_code(item['name'], moji_by_province, 'Moji')
                    if moji_result['code']:
                        item['mojiCode'] = moji_result['code']
                        province_moji_code_found += 1
                        match_details.append({'source': 'Moji', 'name': item['name'], 'level': 'province', 'code': moji_result['code'], 'method': moji_result['method']})
                    
                    nmc_result = find_province_code(item['name'], nmc_by_province, 'NMC')
                    if nmc_result['code']:
                        item['nmcCode'] = nmc_result['code']
                        province_nmc_code_found += 1
                        match_details.append({'source': 'NMC', 'name': item['name'], 'level': 'province', 'code': nmc_result['code'], 'method': nmc_result['method']})
                    
                    cma_result = find_province_code(item['name'], cma_by_province, 'CMA')
                    if cma_result['code']:
                        item['cmaCode'] = cma_result['code']
                        province_cma_code_found += 1
                        match_details.append({'source': 'CMA', 'name': item['name'], 'level': 'province', 'code': cma_result['code'], 'method': cma_result['method']})
                elif level == 1:  # 城市级别 - 跳过
                    # 保留原始城市结构，但不设置代码
                    pass
                elif level == 2:  # 区县级别
                    district_processed += 1
                    
                    if not province_name:
                        print(f"区县 {item['name']} 缺少省份信息，跳过匹配")
                        return
                    
                    # 严格按照省份+地区进行匹配
                    moji_result = find_code_by_province_and_name(item['name'], province_name, moji_by_province, 'Moji')
                    if moji_result['code']:
                        item['mojiCode'] = moji_result['code']
                        if moji_result['nameCode']:
                            item['mojiNameCode'] = moji_result['nameCode']
                        district_moji_code_found += 1
                        match_details.append({ 
                            'source': 'Moji', 
                            'name': item['name'], 
                            'level': 'district', 
                            'code': moji_result['code'], 
                            'method': moji_result['method'], 
                            'province': province_name 
                        })
                    
                    # 查找NMC代码
                    nmc_result = find_code_by_province_and_name(item['name'], province_name, nmc_by_province, 'NMC')
                    if nmc_result['code']:
                        item['nmcCode'] = nmc_result['code']
                        if nmc_result['nameCode']:
                            item['nmcNameCode'] = nmc_result['nameCode']
                        district_nmc_code_found += 1
                        match_details.append({ 
                            'source': 'NMC', 
                            'name': item['name'], 
                            'level': 'district', 
                            'code': nmc_result['code'], 
                            'method': nmc_result['method'], 
                            'province': province_name 
                        })
                    
                    # 查找CMA代码
                    cma_result = find_code_by_province_and_name(item['name'], province_name, cma_by_province, 'CMA')
                    if cma_result['code']:
                        item['cmaCode'] = cma_result['code']
                        district_cma_code_found += 1
                        match_details.append({ 
                            'source': 'CMA', 
                            'name': item['name'], 
                            'level': 'district', 
                            'code': cma_result['code'], 
                            'method': cma_result['method'], 
                            'province': province_name 
                        })
                
                # 递归处理子项
                if item.get('children'):
                    process_data(item['children'], level + 1, item['name'] if level == 0 else province_name)
        
        print('开始处理数据结构，严格按照省份+地区进行匹配合并...')
        
        # 处理数据
        process_data(tianqiData['data'])
        
        # 更新时间戳
        tianqiData['timestamp'] = int(time.time() * 1000)
        
        print('数据处理完成，开始写入文件...')
        
        # 确保输出目录存在
        output_dir = os.path.dirname(outputFilePath)
        if not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
        
        # 写入合并后的数据
        with open(outputFilePath, 'w', encoding='utf-8') as f:
            json.dump(tianqiData, f, ensure_ascii=False, indent=2)
        
        # 确保logs目录存在
        ensure_logs_dir()
        
        # 写入匹配详情日志
        log_content = [
            '=== 天气编码合并日志（省份+地区严格匹配）===',
            f'更新时间: {time.strftime("%Y-%m-%d %H:%M:%S")}',
            f'总共处理的地区数量: {total_processed}',
            f'省份数量: {province_processed}',
            f'区县数量: {district_processed}',
            '',
            '=== Moji Weather ===',
            f'成功匹配省份mojiCode数量: {province_moji_code_found}',
            f'成功匹配区县mojiCode数量: {district_moji_code_found}',
            '',
            '=== NMC ===',
            f'成功匹配省份nmcCode数量: {province_nmc_code_found}',
            f'成功匹配区县nmcCode数量: {district_nmc_code_found}',
            '',
            '=== CMA ===',
            f'成功匹配省份cmaCode数量: {province_cma_code_found}',
            f'成功匹配区县cmaCode数量: {district_cma_code_found}',
            '',
            '匹配详情:',
        ]
        
        for detail in match_details:
            level_info = '省份' if detail['level'] == 'province' else f"区县({detail.get('province', '')})"
            log_content.append(f"{detail['source']} - {level_info} {detail['name']} -> {detail['code']} ({detail['method']})")
        
        log_content.append('')
        
        with open(logFilePath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(log_content))
        
        # 显示统计信息
        print('========================================')
        print('合并统计信息:')
        print(f'- 总共处理的地区数量: {total_processed}')
        print(f'- 省份数量: {province_processed}')
        print(f'- 区县数量: {district_processed}')
        print('----------------------------------------')
        print(f'- Moji Weather 匹配: 省份 {province_moji_code_found}/{province_processed}, 区县 {district_moji_code_found}/{district_processed}')
        print(f'- NMC 匹配: 省份 {province_nmc_code_found}/{province_processed}, 区县 {district_nmc_code_found}/{district_processed}')
        print(f'- CMA 匹配: 省份 {province_cma_code_found}/{province_processed}, 区县 {district_cma_code_found}/{district_processed}')
        print('----------------------------------------')
        print(f'- 合并后的数据已保存至: {outputFilePath}')
        print(f'- 合并日志已保存至: {logFilePath}')
        print('========================================')
        
    except Exception as e:
        print(f"合并过程中发生错误：{str(e)}")
        import traceback
        traceback.print_exc()
        exit(1)

# 运行合并函数
if __name__ == '__main__':
    merge_all_weather_codes()
