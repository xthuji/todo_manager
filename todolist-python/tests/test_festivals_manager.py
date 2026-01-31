import time
import datetime

# 模拟节日配置数据
MOCK_FESTIVAL_CONFIG = {
    'festivals': [
        {'id': '1', 'name': '元旦', 'type': 'national', 'dateType': 'solar', 'date': '01-01'},
        {'id': '2', 'name': '春节', 'type': 'chinese_traditional', 'dateType': 'lunar', 'date': '01-01'},
        {'id': '3', 'name': '劳动节', 'type': 'national', 'dateType': 'solar', 'date': '05-01'},
        {'id': '4', 'name': '端午节', 'type': 'chinese_traditional', 'dateType': 'lunar', 'date': '05-05'},
        {'id': '5', 'name': '中秋节', 'type': 'chinese_traditional', 'dateType': 'lunar', 'date': '08-15'},
        {'id': '6', 'name': '国庆节', 'type': 'national', 'dateType': 'solar', 'date': '10-01'},
        {'id': '7', 'name': '520', 'type': 'custom', 'dateType': 'solar', 'date': '05-20'},
        {'id': '8', 'name': '618', 'type': 'custom', 'dateType': 'solar', 'date': '06-18'}
    ],
    'workDays': []
}

# 日期格式化工具函数
def format_date(date):
    # 参数有效性检查
    if not isinstance(date, datetime.date):
        raise ValueError('无效的日期对象')
    
    year = date.year
    month = str(date.month).zfill(2)
    day = str(date.day).zfill(2)
    return f"{year}-{month}-{day}"

# 生成测试日期
def generate_test_date(month, day, year=None):
    if year is None:
        year = datetime.datetime.now().year
    return datetime.date(year, month, day)

# 模拟从业务逻辑中获取节日信息的函数
def mock_get_festivals(date, festival_config):
    # 参数有效性检查
    if not isinstance(date, datetime.date):
        raise ValueError('无效的日期对象')
    
    date_str = format_date(date)
    month = date.month
    day = date.day
    # 格式化月份和日期为两位数，匹配配置中的格式
    formatted_month = str(month).zfill(2)
    formatted_day = str(day).zfill(2)
    festivals = []
    
    # 检查配置文件中的节日
    if festival_config and 'festivals' in festival_config:
        # 公历节日（包括自定义节日）
        for festival in festival_config['festivals']:
            if festival and festival['dateType'] == 'solar' and festival['date'] == f"{formatted_month}-{formatted_day}":
                festivals.append({
                    'name': festival['name'],
                    'type': festival.get('type', 'custom'),
                    'date': date_str
                })
    
    return festivals

# 模拟从业务逻辑中检查是否为中国节假日的函数
def mock_is_chinese_holiday(date, festival_config):
    festivals = mock_get_festivals(date, festival_config)
    
    # 检查是否存在中国法定节假日
    return any(festival['type'] in ['national', 'chinese_common', 'chinese_traditional'] for festival in festivals)

# 测试1: 测试单个节日识别
def test_single_festival():
    print('\n测试1: 测试单个节日识别')
    
    # 使用模拟的节日配置
    festival_config = MOCK_FESTIVAL_CONFIG
    test_cases = [
        {'month': 1, 'day': 1, 'expected_names': ['元旦']},
        {'month': 5, 'day': 1, 'expected_names': ['劳动节']},
        {'month': 10, 'day': 1, 'expected_names': ['国庆节']},
        {'month': 5, 'day': 20, 'expected_names': ['520']},
        {'month': 6, 'day': 18, 'expected_names': ['618']},
        {'month': 1, 'day': 2, 'expected_names': []}
    ]
    
    passed = 0
    
    for test_case in test_cases:
        try:
            test_date = generate_test_date(test_case['month'], test_case['day'])
            date_str = format_date(test_date)
            festivals = mock_get_festivals(test_date, festival_config)
            
            found_names = [f['name'] for f in festivals]
            all_expected_found = all(name in found_names for name in test_case['expected_names'])
            no_unexpected_found = len(found_names) == len(test_case['expected_names'])
            success = all_expected_found and no_unexpected_found
            
            if success:
                print(f'✓ {date_str}: 成功识别到预期节日: {", ".join(found_names)}')
                passed += 1
            else:
                print(f'✗ {date_str}: 节日识别错误')
                print(f'  期望: [{", ".join(test_case["expected_names"])}]')
                print(f'  实际: [{", ".join(found_names)}]')
        except Exception as e:
            print(f'✗ 处理 {test_case["month"]}-{test_case["day"]} 时出错: {e}')
    
    print(f'测试1结果: {passed}/{len(test_cases)} 通过')
    return {'success': passed == len(test_cases), 'passed': passed, 'total': len(test_cases)}

# 测试2: 中国节假日判断
def test_holiday_judgment():
    print('\n测试2: 中国节假日判断')
    
    festival_config = MOCK_FESTIVAL_CONFIG
    test_cases = [
        {'date': generate_test_date(1, 1), 'name': '元旦', 'expected': True},
        {'date': generate_test_date(5, 1), 'name': '劳动节', 'expected': True},
        {'date': generate_test_date(10, 1), 'name': '国庆节', 'expected': True},
        {'date': generate_test_date(5, 20), 'name': '520', 'expected': False},  # 自定义节日不算法定节假日
        {'date': generate_test_date(1, 2), 'name': '工作日', 'expected': False}
    ]
    
    passed = 0
    
    for test in test_cases:
        try:
            result = mock_is_chinese_holiday(test['date'], festival_config)
            date_str = format_date(test['date'])
            
            if result == test['expected']:
                print(f'✓ {date_str} ({test["name"]}): 正确识别为{"节假日" if result else "非节假日"}')
                passed += 1
            else:
                print(f'✗ {date_str} ({test["name"]}): 判断错误，期望{"节假日" if test["expected"] else "非节假日"}，实际{"节假日" if result else "非节假日"}')
        except Exception as e:
            print(f'✗ {format_date(test["date"])} ({test["name"]}): 测试异常: {e}')
    
    print(f'测试2结果: {passed}/{len(test_cases)} 通过')
    return {'success': passed == len(test_cases), 'passed': passed, 'total': len(test_cases)}

# 测试3: 边界条件测试
def test_edge_cases():
    print('\n测试3: 边界条件测试')
    
    festival_config = MOCK_FESTIVAL_CONFIG
    passed = 0
    
    # 测试1: 无效日期参数
    try:
        mock_get_festivals(None, festival_config)
        print('✗ 无效日期参数测试失败: 未能捕获空日期参数')
    except Exception as e:
        print(f'✓ 无效日期参数测试通过: 成功捕获错误: {e}')
        passed += 1
    
    # 测试2: 无效配置参数
    try:
        test_date = generate_test_date(1, 1)
        result = mock_get_festivals(test_date, None)
        print(f'✓ 无效配置参数测试通过: 返回 {len(result)} 个节日')
        passed += 1
    except Exception as e:
        print(f'✗ 无效配置参数测试失败: {e}')
    
    # 测试3: 特殊日期
    try:
        test_date = datetime.date(datetime.datetime.now().year, 12, 31)  # 12月31日
        festivals = mock_get_festivals(test_date, festival_config)
        print(f'✓ 特殊日期测试通过: 12月31日识别到 {len(festivals)} 个节日')
        passed += 1
    except Exception as e:
        print(f'✗ 特殊日期测试失败: {e}')
    
    print(f'测试3结果: {passed}/3 通过')
    return {'success': passed == 3, 'passed': passed, 'total': 3}

# 测试4: 全年节日计算测试
def test_yearly_calculation():
    print('\n测试4: 全年节日计算测试')
    
    festival_config = MOCK_FESTIVAL_CONFIG
    current_year = datetime.datetime.now().year
    key_holidays = [
        {'month': 1, 'day': 1, 'name': '元旦'},
        {'month': 5, 'day': 1, 'name': '劳动节'},
        {'month': 10, 'day': 1, 'name': '国庆节'}
    ]
    
    passed_holidays = 0
    
    for holiday in key_holidays:
        try:
            test_date = generate_test_date(holiday['month'], holiday['day'], current_year)
            festivals = mock_get_festivals(test_date, festival_config)
            
            if any(f['name'] == holiday['name'] for f in festivals):
                print(f'✓ {current_year}-{holiday["month"]}-{holiday["day"]}: 成功识别 {holiday["name"]}')
                passed_holidays += 1
            else:
                print(f'✗ {current_year}-{holiday["month"]}-{holiday["day"]}: 未能识别 {holiday["name"]}')
        except Exception as e:
            print(f'✗ 处理 {holiday["name"]} 时出错: {e}')
    
    print(f'测试4结果: {passed_holidays}/{len(key_holidays)} 个关键节日识别通过')
    return {'success': passed_holidays == len(key_holidays), 'passed': passed_holidays, 'total': len(key_holidays)}

# 执行所有测试
def run_all_tests():
    try:
        print('\n===== 开始测试节日相关功能 =====')
        test_results = [
            test_single_festival(),
            test_holiday_judgment(),
            test_edge_cases(),
            test_yearly_calculation()
        ]
        
        # 统计总体结果
        total_tests = 0
        total_passed = 0
        all_success = True
        
        for result in test_results:
            total_tests += result['total']
            total_passed += result['passed']
            all_success = all_success and result['success']
        
        print('\n\n===== 总体测试结果 =====')
        print(f'总测试用例数: {total_tests}')
        print(f'通过数: {total_passed} ({(total_passed/total_tests*100):.1f}%)')
        
        if all_success:
            print('🎉 所有测试均已通过!')
        else:
            print('❌ 部分测试失败，请检查代码')
        
        return all_success
        
    except Exception as e:
        print(f'运行测试时发生错误: {e}')
        import traceback
        traceback.print_exc()
        return False

# 运行测试
if __name__ == '__main__':
    test_result = run_all_tests()
    exit(0 if test_result else 1)
