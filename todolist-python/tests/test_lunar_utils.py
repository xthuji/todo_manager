import json
import os
import re
import time

# 模拟农历和节日管理核心功能
class LunarUtils:
    # 农历月份和日期的中文表示
    chinese_months = ['', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月']
    chinese_days = ['', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
                   '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
                   '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十']
    
    # 格式化日期
    def format_date(self, date):
        year = date.tm_year
        month = str(date.tm_mon).zfill(2)
        day = str(date.tm_mday).zfill(2)
        return f"{year}-{month}-{day}"
    
    # 获取农历日期文本（模拟）
    def get_lunar_date_text(self, date_str):
        import time
        date = time.strptime(date_str, "%Y-%m-%d")
        month = date.tm_mon
        day = date.tm_mday
        
        # 简化模拟，实际应使用农历库计算
        return {
            'lunarMonth': self.chinese_months[month] if month < len(self.chinese_months) else '未知月',
            'lunarDay': self.chinese_days[day] if day < len(self.chinese_days) else '未知日',
            'fullText': f"{self.chinese_months[month] if month < len(self.chinese_months) else '未知月'} {self.chinese_days[day] if day < len(self.chinese_days) else '未知日'}"
        }
    
    # 计算给定月份中的第N个特定星期几的日期
    def _get_nth_weekday_of_month(self, year, month, week_num, day_of_week):
        import datetime
        # 创建月份的第一天
        first_day = datetime.date(year, month, 1)
        # 获取第一天是星期几（0是星期一，6是星期日）
        first_day_of_week = first_day.weekday()
        
        # 计算第一个目标星期几的日期
        days_to_add = day_of_week - first_day_of_week
        if days_to_add < 0:
            days_to_add += 7
        
        # 计算第N个目标星期几的日期
        target_date = first_day + datetime.timedelta(days=days_to_add + (week_num - 1) * 7)
        
        return target_date
    
    # 获取节日信息（同步版本）
    def get_festivals_sync(self, date_str):
        import time
        date = time.strptime(date_str, "%Y-%m-%d")
        year = date.tm_year
        month = date.tm_mon
        day = date.tm_mday
        festivals = []
        
        # 模拟节日数据
        festivals_map = {
            '01-01': [{'name': '元旦', 'type': 'chinese_common'}],
            '02-14': [{'name': '情人节', 'type': 'foreign'}],
            '05-01': [{'name': '劳动节', 'type': 'chinese_common'}],
            '05-20': [{'name': '520', 'type': 'custom'}],
            '10-01': [{'name': '国庆节', 'type': 'chinese_common'}],
            '12-25': [{'name': '圣诞节', 'type': 'foreign'}]
        }
        
        # 处理阳历节日
        date_key = f"{str(month).zfill(2)}-{str(day).zfill(2)}"
        if date_key in festivals_map:
            for festival in festivals_map[date_key]:
                festivals.append({
                    'name': festival['name'],
                    'type': festival['type'],
                    'date': date_str,
                    'priority': 10
                })
        
        # 处理基于星期的节日
        # 例如：9月第3个星期五
        if month == 9:
            target_date = self._get_nth_weekday_of_month(year, month, 3, 4)  # 4是星期五
            if target_date.day == day:
                festivals.append({
                    'name': '阳历星期B',
                    'type': 'custom',
                    'date': date_str,
                    'priority': 70
                })
        
        return festivals
    
    # 获取节日样式类
    def get_festival_style_class(self, type):
        holiday_styles_class = {
            'chinese_common': 'bg-festival-common',
            'chinese_traditional': 'bg-festival-traditional',
            'foreign': 'bg-festival-foreign',
            'solar_terms': 'bg-festival-terms',
            'custom': 'bg-festival-custom'
        }
        return holiday_styles_class.get(type, 'bg-festival-custom')
    
    # 获取节日类型名称
    def get_festival_type_name(self, type):
        names = {
            'chinese_common': '常用节日',
            'chinese_traditional': '传统节日',
            'foreign': '国外节日',
            'solar_terms': '节气',
            'custom': '自定义节日'
        }
        return names.get(type, '未知类型')
    
    # 检查是否为中国节假日
    def is_chinese_holiday(self, date_str):
        festivals = self.get_festivals_sync(date_str)
        return any(festival['type'] in ['chinese_common', 'chinese_traditional'] for festival in festivals)
    
    # 获取日期的完整信息（公历、农历、节日）
    def get_date_full_info(self, date_str):
        import time
        date = time.strptime(date_str, "%Y-%m-%d")
        lunar_info = self.get_lunar_date_text(date_str)
        festivals = self.get_festivals_sync(date_str)
        is_holiday = self.is_chinese_holiday(date_str)
        
        return {
            'date': date_str,
            'solarYear': date.tm_year,
            'solarMonth': date.tm_mon,
            'solarDay': date.tm_mday,
            'lunarMonth': lunar_info['lunarMonth'],
            'lunarDay': lunar_info['lunarDay'],
            'festivals': festivals,
            'isHoliday': is_holiday,
            'festivalCount': len(festivals)
        }

# 创建实例
lunar_utils = LunarUtils()

# 测试函数
def run_tests():
    passed_tests = 0
    total_tests = 0
    
    print('=== 开始农历和节日管理核心功能测试 ===\n')
    
    # 测试1: 日期格式化
    total_tests += 1
    try:
        print('测试1: 日期格式化')
        import time
        date = time.localtime(time.mktime(time.strptime('2024-01-15', '%Y-%m-%d')))
        formatted_date = lunar_utils.format_date(date)
        
        if formatted_date == '2024-01-15':
            print(f'  ✅ 通过: 日期格式化正确: {formatted_date}')
            passed_tests += 1
        else:
            raise Exception(f'日期格式化错误，期望"2024-01-15"，实际"{formatted_date}"')
    except Exception as e:
        print(f'  ❌ 失败: {e}')
    
    # 测试2: 获取农历日期文本
    total_tests += 1
    try:
        print('\n测试2: 获取农历日期文本')
        lunar_info = lunar_utils.get_lunar_date_text('2024-01-15')
        
        if lunar_info and lunar_info['lunarMonth'] and lunar_info['lunarDay']:
            print('  ✅ 通过: 农历信息获取成功')
            print(f'  ✅ 通过: 农历月份: {lunar_info["lunarMonth"]}')
            print(f'  ✅ 通过: 农历日期: {lunar_info["lunarDay"]}')
            passed_tests += 1
        else:
            raise Exception('农历信息获取失败')
    except Exception as e:
        print(f'  ❌ 失败: {e}')
    
    # 测试3: 获取节日信息（元旦）
    total_tests += 1
    try:
        print('\n测试3: 获取节日信息（元旦）')
        festivals = lunar_utils.get_festivals_sync('2024-01-01')
        
        if festivals and festivals[0]['name'] == '元旦' and festivals[0]['type'] == 'chinese_common':
            print('  ✅ 通过: 成功获取元旦节日信息')
            print(f'  ✅ 通过: 节日类型正确: {festivals[0]["type"]}')
            passed_tests += 1
        else:
            raise Exception('元旦节日信息获取失败')
    except Exception as e:
        print(f'  ❌ 失败: {e}')
    
    # 测试4: 获取节日信息（自定义节日）
    total_tests += 1
    try:
        print('\n测试4: 获取节日信息（自定义节日）')
        festivals = lunar_utils.get_festivals_sync('2024-05-20')
        
        if festivals and festivals[0]['name'] == '520' and festivals[0]['type'] == 'custom':
            print('  ✅ 通过: 成功获取520节日信息')
            print(f'  ✅ 通过: 自定义节日类型正确: {festivals[0]["type"]}')
            passed_tests += 1
        else:
            raise Exception('520节日信息获取失败')
    except Exception as e:
        print(f'  ❌ 失败: {e}')
    
    # 测试5: 获取节日样式类
    total_tests += 1
    try:
        print('\n测试5: 获取节日样式类')
        common_class = lunar_utils.get_festival_style_class('chinese_common')
        traditional_class = lunar_utils.get_festival_style_class('chinese_traditional')
        unknown_class = lunar_utils.get_festival_style_class('unknown_type')
        
        if common_class == 'bg-festival-common' and \
           traditional_class == 'bg-festival-traditional' and\
           unknown_class == 'bg-festival-custom':
            print(f'  ✅ 通过: 常用节日样式类正确: {common_class}')
            print(f'  ✅ 通过: 传统节日样式类正确: {traditional_class}')
            print(f'  ✅ 通过: 未知类型默认样式类正确: {unknown_class}')
            passed_tests += 1
        else:
            raise Exception('节日样式类获取失败')
    except Exception as e:
        print(f'  ❌ 失败: {e}')
    
    # 测试6: 获取节日类型名称
    total_tests += 1
    try:
        print('\n测试6: 获取节日类型名称')
        common_name = lunar_utils.get_festival_type_name('chinese_common')
        foreign_name = lunar_utils.get_festival_type_name('foreign')
        
        if common_name == '常用节日' and foreign_name == '国外节日':
            print(f'  ✅ 通过: 常用节日名称正确: {common_name}')
            print(f'  ✅ 通过: 国外节日名称正确: {foreign_name}')
            passed_tests += 1
        else:
            raise Exception('节日类型名称获取失败')
    except Exception as e:
        print(f'  ❌ 失败: {e}')
    
    # 测试7: 检查是否为中国节假日
    total_tests += 1
    try:
        print('\n测试7: 检查是否为中国节假日')
        is_holiday1 = lunar_utils.is_chinese_holiday('2024-01-01')  # 元旦
        is_holiday2 = lunar_utils.is_chinese_holiday('2024-05-20')  # 520（非节假日）
        
        if is_holiday1 and not is_holiday2:
            print('  ✅ 通过: 元旦正确识别为节假日')
            print('  ✅ 通过: 520正确识别为非节假日')
            passed_tests += 1
        else:
            raise Exception('节假日判断失败')
    except Exception as e:
        print(f'  ❌ 失败: {e}')
    
    # 测试8: 获取日期完整信息
    total_tests += 1
    try:
        print('\n测试8: 获取日期完整信息')
        date_info = lunar_utils.get_date_full_info('2024-01-01')
        
        if date_info and \
           date_info['date'] == '2024-01-01' and \
           date_info['isHoliday'] and \
           date_info['festivalCount'] > 0:
            print('  ✅ 通过: 日期完整信息获取成功')
            print(f'  ✅ 通过: 节假日标记正确: {date_info["isHoliday"]}')
            print(f'  ✅ 通过: 节日数量正确: {date_info["festivalCount"]}')
            passed_tests += 1
        else:
            raise Exception('日期完整信息获取失败')
    except Exception as e:
        print(f'  ❌ 失败: {e}')
    
    # 输出测试结果
    print('\n=== 测试结果汇总 ===')
    print(f'通过测试: {passed_tests}/{total_tests}')
    
    if passed_tests == total_tests:
        print('🎉 所有农历和节日管理核心功能测试通过!')
        return True
    else:
        print('❌ 测试未全部通过，请检查错误信息。')
        return False

# 运行测试
if __name__ == '__main__':
    success = run_tests()
    exit(0 if success else 1)
