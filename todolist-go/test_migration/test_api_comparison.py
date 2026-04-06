import http.client
import json
import os
import time
import argparse
from datetime import datetime
import concurrent.futures

# 命令行参数解析
def parse_args():
    parser = argparse.ArgumentParser(description='API 接口对比测试脚本')
    parser.add_argument('--base-port', type=int, default=3001, help='基准项目端口')
    parser.add_argument('--migrate-port', type=int, default=3002, help='迁移项目端口')
    parser.add_argument('--base-name', type=str, default='Python', help='基准项目名称')
    parser.add_argument('--migrate-name', type=str, default='Tauri (Rust)', help='迁移项目名称')
    parser.add_argument('--output-dir', type=str, default=os.path.dirname(__file__), help='测试结果输出目录')
    return parser.parse_args()

# 解析命令行参数
args = parse_args()

# 配置信息
BASE_PORT = args.base_port  # 基准项目端口
MIGRATE_PORT = args.migrate_port  # 迁移项目端口
BASE_URL = f"localhost:{BASE_PORT}"  # 基准项目地址
MIGRATE_URL = f"localhost:{MIGRATE_PORT}"  # 迁移项目地址

# 项目名称
BASE_NAME = args.base_name
MIGRATE_NAME = args.migrate_name

# 测试结果输出文件
TEST_RESULT_FILE = os.path.join(args.output_dir, 'api_comparison_result.json')

# 需要测试的接口列表
# 只测试查询类型的接口，忽略修改本地数据的接口
TEST_INTERFACES = [
    # 节日相关接口
    {
        "name": "获取节日配置",
        "path": "/api/festival/config",
        "method": "GET",
        "body": None
    },
    # 文件相关接口
    {
        "name": "扫描文件",
        "path": "/api/file/scan",
        "method": "GET",
        "body": None
    },
    {
        "name": "读取默认文件",
        "path": "/api/file/read/todo.test.txt",
        "method": "GET",
        "body": None
    },
    # 节假日相关接口
    {
        "name": "获取节假日缓存",
        "path": "/api/holiday/cache",
        "method": "GET",
        "body": None
    },
    # 状态相关接口
    {
        "name": "检查服务状态",
        "path": "/api/check-status",
        "method": "GET",
        "body": None
    },
    # 天气相关接口
    {
        "name": "获取 IP 位置信息",
        "path": "/api/weather/ip-location?forceRefresh=true",
        "method": "GET",
        "body": None
    },
    {
        "name": "获取天气区域编码",
        "path": "/api/weather/weather-area-codes",
        "method": "GET",
        "body": None
    },
    {
        "name": "获取天气数据",
        "path": "/api/weather/weather-info?weatherCode=101010100&forceRefresh=true",
        "method": "GET",
        "body": None
    },
    # 静态页面和资源测试
    {
        "name": "访问首页",
        "path": "/",
        "method": "GET",
        "body": None
    },
    {
        "name": "访问任务管理页面",
        "path": "/todo_manager.html",
        "method": "GET",
        "body": None
    },
    {
        "name": "访问天气页面",
        "path": "/weather_view.html",
        "method": "GET",
        "body": None
    },
    {
        "name": "访问日历页面",
        "path": "/calendar_view.html",
        "method": "GET",
        "body": None
    },
    {
        "name": "访问节假日管理页面",
        "path": "/festival_manager.html",
        "method": "GET",
        "body": None
    },
    {
        "name": "访问静态CSS文件",
        "path": "/assets/css/font-awesome.min.css",
        "method": "GET",
        "body": None
    },
    {
        "name": "访问静态JavaScript文件",
        "path": "/assets/js/third_party/jquery.min.js",
        "method": "GET",
        "body": None
    },
    {
        "name": "访问静态图片",
        "path": "/assets/img/moji.ico",
        "method": "GET",
        "body": None
    }
]

def make_request(host, path, method="GET", body=None):
    """
    发起 HTTP 请求
    :param host: 主机地址，格式为 "host:port"
    :param path: 请求路径，包含查询参数
    :param method: 请求方法
    :param body: 请求体
    :return: 响应数据字典
    """
    start_time = time.time()
    try:
        # 解析主机和端口
        host_port = host.split(":")
        if len(host_port) != 2:
            raise ValueError(f"Invalid host format: {host}")
        host_name = host_port[0]
        port = int(host_port[1])
        
        # 创建连接
        conn = http.client.HTTPConnection(host_name, port, timeout=15)
        
        # 准备请求头
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/html, text/css, application/javascript, image/*'
        }
        
        # 发送请求
        if body:
            body_str = json.dumps(body)
            conn.request(method, path, body_str, headers)
        else:
            conn.request(method, path, headers=headers)
        
        # 获取响应
        response = conn.getresponse()
        status = response.status
        content_type = response.getheader('Content-Type', '')
        
        # 根据内容类型处理响应数据
        if 'image/' in content_type:
            # 图片数据，返回是否成功
            data = response.read()
            conn.close()
            response_time = (time.time() - start_time) * 1000  # 转换为毫秒
            return {
                "success": True,
                "data": f"Image data (length: {len(data)} bytes)",
                "status": status,
                "content_type": content_type,
                "response_time": round(response_time, 2)
            }
        else:
            # 文本数据
            try:
                data = response.read().decode('utf-8')
                conn.close()
                response_time = (time.time() - start_time) * 1000  # 转换为毫秒
                
                # 尝试解析 JSON
                if 'application/json' in content_type:
                    try:
                        json_data = json.loads(data)
                        return {
                            "success": True,
                            "data": json_data,
                            "status": status,
                            "content_type": content_type,
                            "response_time": round(response_time, 2)
                        }
                    except json.JSONDecodeError:
                        # JSON 解析失败但状态码为 200，视为成功（可能是非预期的内容）
                        return {
                            "success": True,
                            "data": data,
                            "status": status,
                            "content_type": content_type,
                            "response_time": round(response_time, 2)
                        }
                else:
                    # 非 JSON 内容，直接返回
                    return {
                        "success": True,
                        "data": data,
                        "status": status,
                        "content_type": content_type,
                        "response_time": round(response_time, 2)
                    }
            except UnicodeDecodeError:
                # 无法解码的内容，返回二进制长度
                data = response.read()
                conn.close()
                response_time = (time.time() - start_time) * 1000  # 转换为毫秒
                return {
                    "success": True,
                    "data": f"Binary data (length: {len(data)} bytes)",
                    "status": status,
                    "content_type": content_type,
                    "response_time": round(response_time, 2)
                }
    except Exception as e:
        response_time = (time.time() - start_time) * 1000  # 转换为毫秒
        return {
            "success": False,
            "error": str(e),
            "response_time": round(response_time, 2)
        }


def filter_timestamp_fields(obj):
    """
    过滤掉时间戳字段
    :param obj: 要过滤的对象
    :return: 过滤后的对象
    """
    if obj is None or not isinstance(obj, (dict, list)):
        return obj
    
    # 时间戳字段列表
    timestamp_fields = ['timestamp', 'updatedAt', 'createdAt', 'expireAt', 'mtime', 'ttl']
    
    if isinstance(obj, dict):
        filtered_obj = {}
        for key, value in obj.items():
            # 忽略时间戳字段
            if key in timestamp_fields:
                continue
            # 递归过滤嵌套对象
            if isinstance(value, (dict, list)):
                filtered_obj[key] = filter_timestamp_fields(value)
            else:
                filtered_obj[key] = value
        return filtered_obj
    elif isinstance(obj, list):
        return [filter_timestamp_fields(item) for item in obj]


def compare_objects(obj1, obj2):
    """
    对比两个对象的差异
    :param obj1: 第一个对象
    :param obj2: 第二个对象
    :return: 差异对象
    """
    # 过滤时间戳字段
    filtered_obj1 = filter_timestamp_fields(obj1)
    filtered_obj2 = filter_timestamp_fields(obj2)
    
    differences = {}
    
    # 检查类型是否相同
    if type(filtered_obj1) != type(filtered_obj2):
        differences["type"] = {
            "service1": str(type(filtered_obj1)),
            "service2": str(type(filtered_obj2))
        }
        return differences
    
    # 检查 obj1 中的属性
    if filtered_obj1 and isinstance(filtered_obj1, dict):
        for key, value1 in filtered_obj1.items():
            if not filtered_obj2 or not isinstance(filtered_obj2, dict) or key not in filtered_obj2:
                differences[key] = {
                    "service1": value1,
                    "service2": None
                }
            elif isinstance(value1, (dict, list)) and isinstance(filtered_obj2[key], (dict, list)):
                nested_diff = compare_objects(value1, filtered_obj2[key])
                if nested_diff:
                    differences[key] = nested_diff
            elif value1 != filtered_obj2[key]:
                differences[key] = {
                    "service1": value1,
                    "service2": filtered_obj2[key]
                }
    
    # 检查 obj2 中独有的属性
    if filtered_obj2 and isinstance(filtered_obj2, dict):
        for key, value2 in filtered_obj2.items():
            if not filtered_obj1 or not isinstance(filtered_obj1, dict) or key not in filtered_obj1:
                differences[key] = {
                    "service1": None,
                    "service2": value2
                }
    
    # 检查列表类型
    elif isinstance(filtered_obj1, list):
        if len(filtered_obj1) != len(filtered_obj2):
            differences["length"] = {
                "service1": len(filtered_obj1),
                "service2": len(filtered_obj2)
            }
        else:
            for i, (item1, item2) in enumerate(zip(filtered_obj1, filtered_obj2)):
                nested_diff = compare_objects(item1, item2)
                if nested_diff:
                    differences[f"item_{i}"] = nested_diff
    
    # 检查基本类型
    elif filtered_obj1 != filtered_obj2:
        differences["value"] = {
            "service1": filtered_obj1,
            "service2": filtered_obj2
        }
    
    return differences


def run_interface_test(test_interface):
    """
    运行单个接口测试
    :param test_interface: 测试接口配置
    :return: 测试结果
    """
    # 从两个服务获取数据
    base_result = make_request(BASE_URL, test_interface['path'], test_interface['method'], test_interface['body'])
    migrate_result = make_request(MIGRATE_URL, test_interface['path'], test_interface['method'], test_interface['body'])
    
    # 对比结果
    differences = {}
    if base_result['success'] and migrate_result['success']:
        differences = compare_objects(base_result['data'], migrate_result['data'])
    elif base_result['success'] != migrate_result['success']:
        # 一个服务请求成功，另一个失败，标记为有差异
        differences = {
            "requestStatus": {
                "baseService": "success" if base_result['success'] else "failed",
                "migrateService": "success" if migrate_result['success'] else "failed"
            }
        }
    
    return {
        "interface": test_interface,
        "baseService": base_result,
        "migrateService": migrate_result,
        "hasDifferences": bool(differences),
        "differences": differences
    }


def generate_test_report(test_results):
    """
    生成测试报告（仅控制台输出）
    :param test_results: 测试结果数组
    """
    total_tests = len(test_results)
    passed_tests = len([r for r in test_results if not r['hasDifferences']])
    failed_tests = total_tests - passed_tests
    
    print('\n=== 测试概览 ===')
    print(f'总计测试：{total_tests}')
    print(f'无差异：{passed_tests}')
    print(f'有差异：{failed_tests}')


def run_api_comparison_test():
    """
    主测试函数
    """
    print('开始 API 接口对比测试...')
    print(f'基准项目: {BASE_NAME} (端口:{BASE_PORT})')
    print(f'迁移项目: {MIGRATE_NAME} (端口:{MIGRATE_PORT})')
    print('------------------------')
    
    # 运行所有接口测试（并行处理）
    print('测试中...')
    test_results = []
    
    # 使用线程池提升并发度
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        # 提交所有测试任务
        future_to_interface = {executor.submit(run_interface_test, test_interface): test_interface for test_interface in TEST_INTERFACES}
        
        # 实时输出测试结果
        for future in concurrent.futures.as_completed(future_to_interface):
            test_interface = future_to_interface[future]
            try:
                result = future.result()
                test_results.append(result)
                # 获取响应时间
                base_time = result["baseService"].get("response_time", 0)
                migrate_time = result["migrateService"].get("response_time", 0)
                print(f'测试完成：{result["interface"]["name"]} {"【❌有差异】" if result["hasDifferences"] else "【✅无差异】"} | 响应时间: {BASE_NAME}={base_time}ms, {MIGRATE_NAME}={migrate_time}ms')
            except Exception as e:
                print(f'测试 {test_interface["name"]} 失败: {e}')
    print('------------------------')
    
    # 保存测试结果
    test_result_data = {
        "testTime": datetime.now().isoformat(),
        "baseService": BASE_NAME,
        "migrateService": MIGRATE_NAME,
        "basePort": BASE_PORT,
        "migratePort": MIGRATE_PORT,
        "totalTests": len(test_results),
        "passedTests": len([r for r in test_results if not r['hasDifferences']]),
        "failedTests": len([r for r in test_results if r['hasDifferences']]),
        "testResults": test_results
    }
    
    with open(TEST_RESULT_FILE, 'w', encoding='utf-8') as f:
        json.dump(test_result_data, f, ensure_ascii=False, indent=2)
    print(f'测试结果已保存：{TEST_RESULT_FILE}')
    
    # 生成测试报告
    generate_test_report(test_results)
    
    print('------------------------')
    print('API 接口对比测试完成!')
    print(f'总计测试：{len(test_results)}')
    print(f'✅无差异：{len([r for r in test_results if not r["hasDifferences"]])}')
    print(f'❌有差异：{len([r for r in test_results if r["hasDifferences"]])}')
    print(f'测试结果已保存：{TEST_RESULT_FILE}')


if __name__ == '__main__':
    run_api_comparison_test()
