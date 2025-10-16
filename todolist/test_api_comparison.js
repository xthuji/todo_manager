const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// 配置信息
const PORT1 = 3000; // Node.js 项目端口
const PORT2 = 3001; // Python 项目端口
const BASE_URL1 = `http://localhost:${PORT1}`; // Node.js 项目地址
const BASE_URL2 = `http://localhost:${PORT2}`; // Python 项目地址

// 测试结果输出文件
const TEST_RESULT_FILE = path.join(__dirname, 'api_comparison_result.json');
const TEST_REPORT_FILE = path.join(__dirname, 'api_comparison_report.md');

// 需要测试的接口列表
// 只测试查询类型的接口，忽略修改本地数据的接口
const TEST_INTERFACES = [
  // 节日相关接口
  {
    name: '获取节日配置',
    path: '/api/festival/config',
    method: 'GET',
    body: null
  },
  // 文件相关接口
  {
    name: '扫描文件',
    path: '/api/file/scan',
    method: 'GET',
    body: null
  },
  {
    name: '读取默认文件',
    path: '/api/file/read/todo.test.txt',
    method: 'GET',
    body: null
  },
  // 节假日相关接口
  {
    name: '获取节假日缓存',
    path: '/api/holiday/cache',
    method: 'GET',
    body: null
  },
  // 状态相关接口
  {
    name: '检查服务状态',
    path: '/api/check-status',
    method: 'GET',
    body: null
  },
  // 天气相关接口
  {
    name: '获取IP位置信息',
    path: '/api/weather/ip-location?forceRefresh=true',
    method: 'GET',
    body: null
  },
  {
    name: '获取天气区域编码',
    path: '/api/weather/weather-area-codes',
    method: 'GET',
    body: null
  },
  {
    name: '获取天气数据',
    path: '/api/weather/weather-info?weatherCode=101010100',
    method: 'GET',
    body: null
  }
];

/**
 * 发起HTTP请求
 * @param {string} url - 请求URL
 * @param {string} method - 请求方法
 * @param {Object} body - 请求体
 * @returns {Promise<Object>} 响应数据
 */
async function makeRequest(url, method, body) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();
    return {
      success: true,
      data,
      status: response.status
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 过滤掉时间戳字段
 * @param {Object} obj - 要过滤的对象
 * @returns {Object} 过滤后的对象
 */
function filterTimestampFields(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  // 时间戳字段列表
  const timestampFields = ['timestamp', 'time', 'updatedAt', 'createdAt', 'expireAt', 'mtime', 'ttl'];
  
  const filteredObj = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      // 忽略时间戳字段
      if (timestampFields.includes(key)) {
        continue;
      }
      // 递归过滤嵌套对象
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        filteredObj[key] = filterTimestampFields(obj[key]);
      } else {
        filteredObj[key] = obj[key];
      }
    }
  }
  return filteredObj;
}

/**
 * 对比两个对象的差异
 * @param {Object} obj1 - 第一个对象
 * @param {Object} obj2 - 第二个对象
 * @returns {Object} 差异对象
 */
function compareObjects(obj1, obj2) {
  // 过滤时间戳字段
  const filteredObj1 = filterTimestampFields(obj1);
  const filteredObj2 = filterTimestampFields(obj2);
  
  const differences = {};

  // 检查obj1中的属性
  if (filteredObj1 && typeof filteredObj1 === 'object') {
    for (const key in filteredObj1) {
      if (filteredObj1.hasOwnProperty(key)) {
        if (!filteredObj2 || !filteredObj2.hasOwnProperty(key)) {
          differences[key] = {
            port1: filteredObj1[key],
            port2: undefined
          };
        } else if (typeof filteredObj1[key] === 'object' && typeof filteredObj2[key] === 'object' && filteredObj1[key] !== null && filteredObj2[key] !== null) {
          const nestedDiff = compareObjects(filteredObj1[key], filteredObj2[key]);
          if (Object.keys(nestedDiff).length > 0) {
            differences[key] = nestedDiff;
          }
        } else if (filteredObj1[key] !== filteredObj2[key]) {
          differences[key] = {
            port1: filteredObj1[key],
            port2: filteredObj2[key]
          };
        }
      }
    }
  }

  // 检查obj2中独有的属性
  if (filteredObj2 && typeof filteredObj2 === 'object') {
    for (const key in filteredObj2) {
      if (filteredObj2.hasOwnProperty(key) && (!filteredObj1 || !filteredObj1.hasOwnProperty(key))) {
        differences[key] = {
          port1: undefined,
          port2: filteredObj2[key]
        };
      }
    }
  }

  return differences;
}

/**
 * 运行单个接口测试
 * @param {Object} testInterface - 测试接口配置
 * @returns {Promise<Object>} 测试结果
 */
async function runInterfaceTest(testInterface) {
  console.log(`测试接口: ${testInterface.name}`);
  
  // 并行从两个端口获取数据
  const [result1, result2] = await Promise.all([
    makeRequest(
      `${BASE_URL1}${testInterface.path}`,
      testInterface.method,
      testInterface.body
    ),
    makeRequest(
      `${BASE_URL2}${testInterface.path}`,
      testInterface.method,
      testInterface.body
    )
  ]);

  // 对比结果
  let differences = {};
  if (result1.success && result2.success) {
    differences = compareObjects(result1.data, result2.data);
  } else if (result1.success !== result2.success) {
    // 一个端口请求成功，另一个失败，标记为有差异
    differences = {
      requestStatus: {
        port1: result1.success ? 'success' : 'failed',
        port2: result2.success ? 'success' : 'failed'
      }
    };
  }

  return {
    interface: testInterface,
    port1: result1,
    port2: result2,
    hasDifferences: Object.keys(differences).length > 0,
    differences
  };
}

/**
 * 生成测试报告
 * @param {Array} testResults - 测试结果数组
 */
function generateTestReport(testResults) {
  let report = '# API 接口对比测试报告\n\n';
  report += `测试时间: ${new Date().toLocaleString()}\n`;
  report += `测试端口1: ${PORT1}\n`;
  report += `测试端口2: ${PORT2}\n\n`;

  let totalTests = testResults.length;
  let passedTests = testResults.filter(result => !result.hasDifferences).length;
  let failedTests = totalTests - passedTests;

  report += `## 测试概览\n`;
  report += `总计测试: ${totalTests}\n`;
  report += `无差异: ${passedTests}\n`;
  report += `有差异: ${failedTests}\n\n`;

  report += `## 详细测试结果\n\n`;

  testResults.forEach((result, index) => {
    report += `### ${index + 1}. ${result.interface.name}\n`;
    report += `接口路径: ${result.interface.path}\n`;
    report += `请求方法: ${result.interface.method}\n\n`;

    if (!result.port1.success) {
      report += `**端口${PORT1}请求失败**: ${result.port1.error}\n\n`;
    } else if (!result.port2.success) {
      report += `**端口${PORT2}请求失败**: ${result.port2.error}\n\n`;
    } else if (result.hasDifferences) {
      report += `**发现差异**:\n`;
      report += `\`\`\`json\n`;
      report += JSON.stringify(result.differences, null, 2);
      report += `\`\`\`\n\n`;
    } else {
      report += `**结果一致**: 两个端口的响应完全相同\n\n`;
    }
  });

  fs.writeFileSync(TEST_REPORT_FILE, report);
  console.log(`测试报告已生成: ${TEST_REPORT_FILE}`);
}

/**
 * 主测试函数
 */
async function runApiComparisonTest() {
  console.log('开始 API 接口对比测试...');
  console.log(`测试端口1: ${PORT1}`);
  console.log(`测试端口2: ${PORT2}`);
  console.log('------------------------');

  // 并行运行所有接口测试
  console.log('并行测试中...');
  const testResults = await Promise.all(
    TEST_INTERFACES.map(async (testInterface) => {
      console.log(`开始测试: ${testInterface.name}`);
      const result = await runInterfaceTest(testInterface);
      console.log(`测试完成: ${testInterface.name} ${result.hasDifferences ? '【有差异】' : '【无差异】'}`);
      console.log('------------------------');
      return result;
    })
  );

  // 保存测试结果
  const testResultData = {
    testTime: new Date().toISOString(),
    port1: PORT1,
    port2: PORT2,
    totalTests: testResults.length,
    passedTests: testResults.filter(result => !result.hasDifferences).length,
    failedTests: testResults.filter(result => result.hasDifferences).length,
    testResults
  };

  fs.writeFileSync(TEST_RESULT_FILE, JSON.stringify(testResultData, null, 2));
  console.log(`测试结果已保存: ${TEST_RESULT_FILE}`);

  // 生成测试报告
  generateTestReport(testResults);

  console.log('------------------------');
  console.log('API 接口对比测试完成!');
  console.log(`总计测试: ${testResults.length}`);
  console.log(`无差异: ${testResults.filter(result => !result.hasDifferences).length}`);
  console.log(`有差异: ${testResults.filter(result => result.hasDifferences).length}`);
  console.log(`详细报告请查看: ${TEST_REPORT_FILE}`);
}

// 运行测试
if (require.main === module) {
  runApiComparisonTest().catch(error => {
    console.error('测试过程中发生错误:', error);
  });
}

module.exports = {
  runApiComparisonTest,
  TEST_INTERFACES
};
