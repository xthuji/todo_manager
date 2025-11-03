const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const {CACHE_DIR, MOCK_DIR, USE_CACHE, USE_MOCK,PRINT_API_DATA,PRINT_DATA_LOG} = require('../utils/constants.js');
const {handleCache} = require('../utils/cacheUtil.js');


// tianqi_weather_area_codes.json 数据源： https://j.i8tq.com/weather2020/search/city.js
// moji_weather_area_codes.json 数据源： https://m.moji.com/weather/china/beijing
// merged_tianqi_moji_area_codes        天气地区编码缓存文件路径(合并了天气网和墨迹天气的地区代码)
// merged_tianqi_moji_nmc_area_codes    天气地区编码缓存文件路径(合并了天气网,墨迹天气和中央气象台的地区代码)
// merged_weather_area_codes            天气地区编码缓存文件路径(合并了天气网,墨迹天气和,央气象台和中国气象局的地区代码)
const AREA_CODES_FILE = path.join(__dirname, '../../../data/weather/merged_weather_area_codes.json');
let mockIpAreaData;
let areaCodesData;
let areaCodesMap;

// 接口级别响应缓存处理函数
/**
 * 接口级别响应缓存处理函数，用于缓存整个API的响应结果
 * @param {string} clientIp - 客户端IP地址
 * @param {Object|null} responseData - 要缓存的响应数据，如果为null则执行读取操作
 * @returns {Object|null} 读取模式下返回缓存的响应数据，写入模式下返回null
 */
function cacheIpLocation(clientIp, responseData = null) {
    if (!USE_CACHE) {
        return null;
    }
    const cacheKey = `${clientIp}`.replaceAll(':', "_");
    const defaultOptions = {
        cachePrefix: 'ip_',
        ttl: 300 * 60 * 1000, // 5小时缓存
        cacheDir: CACHE_DIR,
        extension: 'json'
    };
    
    if (responseData !== null) {
        console.log('缓存接口响应:', cacheKey);
    }
    
    return handleCache(cacheKey, responseData, defaultOptions);
}

// 辅助函数：递归查找区县信息，确定完整的省市县信息
function findDistrictInfo(areaData, provinceName, districtName) {
    let result = null;
    // 递归搜索函数
    function searchRecursive(data, currentProvince, currentCity, provinceItem) {
        if (!data || !Array.isArray(data)) return;

        for (const item of data) {
            // 检查是否为叶子节点（区县）
            if (item.code && item.name === districtName && currentProvince === provinceName) {
                result = {
                    province: currentProvince,
                    city: currentCity,
                    code: item.code,
                    district: item.name,
                    provinceMojiCode: provinceItem.mojiCode,
                    mojiCode: item.mojiCode,
                    provinceNmcCode: provinceItem.nmcCode,
                    nmcCode: item.nmcCode,
                    cmaCode: item.cmaCode,
                };
                return;
            }

            // 如果有children，继续递归搜索
            if (item.children && item.children.length > 0) {
                if (currentProvince === null) {
                    // 第一级：省份
                    searchRecursive(item.children, item.name, null, item);
                } else if (currentCity === null) {
                    // 第二级：城市
                    searchRecursive(item.children, currentProvince, item.name, provinceItem);
                } else {
                    // 第三级：区县
                    searchRecursive(item.children, currentProvince, currentCity, provinceItem);
                }
            }

            if (result) break;
        }
    }

    searchRecursive(areaData, null, null, null);
    return result;
}

async function getLocation1() {
    try {
        console.log('正在调用气象局天气接口获取天气和位置信息...');
        const weatherLocationApiResponse = await fetch('https://weather.cma.cn/api/weather/view', {
            timeout: 10000 // 设置10秒超时
        });
        
        if (!weatherLocationApiResponse.ok) {
            throw new Error(`气象局天气接口接口响应状态码: ${weatherLocationApiResponse.status}`);
        }
        
        const weatherLocationData = await weatherLocationApiResponse.json();
        console.log('成功获取气象局天气接口数据');
        
        // 位置数据
        return {
            province: weatherLocationData.data.location.path
                ? weatherLocationData.data.location.path.split(',')[1].replace('省', '').trim()
                : '未知省份',
            city: '未知城市',
            district: weatherLocationData.data.location.name
                ? weatherLocationData.data.location.name.replace(/[区县]$/, '')
                : '未知区县',
        };
    } catch (error) {
        console.error('气象局天气接口获取和处理位置信息时发生错误:', error);
        return null;
    }
}

async function getLocation2() {
    try {
        // 1. 调用ip-api获取基础位置信息
        console.log('正在调用ip-api获取位置信息...');
        const ipApiUrl = 'http://ip-api.com/json/?lang=zh-CN';
        
        const ipApiResponse = await fetch(ipApiUrl, {
            timeout: 5000 // 设置5秒超时
        });
        
        if (!ipApiResponse.ok) {
            throw new Error(`ip-api响应状态码: ${ipApiResponse.status}`);
        }
        
        let ipLocationData = await ipApiResponse.json();
        console.log('成功获取ip-api位置数据');
        
        // 验证是否成功获取到经纬度信息
        if (ipLocationData && typeof ipLocationData.lat === 'number' && typeof ipLocationData.lon === 'number') {
            console.log(`从ip-api获取到的经纬度：纬度=${ipLocationData.lat}, 经度=${ipLocationData.lon}`);
        } else {
            console.warn('从ip-api未能获取到有效的经纬度信息');
        }
        
        // 2. 使用从ip-api获取的IP地址调用美团地理位置服务获取省市区县信息
        let weatherLocationData = null;
        if (ipLocationData && ipLocationData.query) {
            const ipAddress = ipLocationData.query;
            console.log('正在调用美团地理位置服务获取详细地区信息...');
            // 从ip-api获取的IP地址，传递给美团API
            const meituanUrl = `https://apimobile.meituan.com/locate/v2/ip/loc?rgeo=true&ip=${ipAddress}`;
            console.log(`使用从ip-api获取的IP地址构建美团API请求: ${meituanUrl}`);

            const meituanResponse = await fetch(meituanUrl, {
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'application/json'
                }
            });

            if (!meituanResponse.ok) {
                throw new Error(`美团地理位置服务响应状态码: ${meituanResponse.status}`);
            }

            weatherLocationData = await meituanResponse.json();
            console.log('成功获取美团地理位置服务数据');
        }
        
        // 3. 综合两个API的数据，只返回省市区县信息
        return {
            province: weatherLocationData && weatherLocationData.data && weatherLocationData.data.rgeo && weatherLocationData.data.rgeo.province
                ? weatherLocationData.data.rgeo.province.replace('省', '')
                : '未知省份',
            city: weatherLocationData && weatherLocationData.data && weatherLocationData.data.rgeo && weatherLocationData.data.rgeo.city
                ? weatherLocationData.data.rgeo.city.replace('市', '')
                : '未知城市',
            district: weatherLocationData && weatherLocationData.data && weatherLocationData.data.rgeo && weatherLocationData.data.rgeo.district
                ? weatherLocationData.data.rgeo.district.replace(/[区县]$/, '')
                : '未知区县'
        };
    } catch (error) {
        console.error('ip-api&美团位置接口获取和处理位置信息时发生错误:', error);
        return null;
    }
}

// 根据IP地址获取位置信息 - 综合多个API获取准确的城市地区信息
// http://ip-api.com/json/?lang=zh-CN
// https://apimobile.meituan.com/locate/v2/ip/loc?rgeo=true&ip=${ipAddress}
// https://weather.cma.cn/api/weather/view
async function getLocation(clientIp) {
    if (USE_MOCK) {
        if (!mockIpAreaData) {
            const mockIpAreaStr = fs.readFileSync(path.join(MOCK_DIR, 'mock_ip_area.json'), 'utf-8');
            mockIpAreaData = JSON.parse(mockIpAreaStr);
        }
        return mockIpAreaData;
    }

    // 尝试从接口级缓存获取结果
    const cachedAddressData = cacheIpLocation(clientIp);
    if (cachedAddressData) {
        console.log('使用接口级缓存的位置信息响应');
        return cachedAddressData;
    }

    console.log('正在调用接口获取位置信息...');

    // 位置数据
    // 创建并行请求的Promise数组
    const promises = [];
    promises.push(getLocation1(), getLocation2());
    const [addressData1, addressData2] = await Promise.all(promises);
    const addressData = {... (addressData2 || addressData1)};
    console.log(`定位数据: ${JSON.stringify(addressData)}`);
    if (PRINT_API_DATA) {
        if (PRINT_DATA_LOG) {
            console.log(`接口获取位置信息结果1: ${JSON.stringify(addressData1)}`);
            console.log(`接口获取位置信息结果2: ${JSON.stringify(addressData2)}`);
        }
        addressData.apiData = {addressData1, addressData2};
    }

    // 读取地区编码数据，用于查找完整的省市县信息
    const allAreaCodes = getAllAreaCodes();
    if (allAreaCodes && addressData.province !== '未知省份' && addressData.district !== '未知区县') {
        // 使用辅助函数查找完整的省市县信息
        const districtInfo = findDistrictInfo(allAreaCodes.data, addressData.province, addressData.district);
        if (districtInfo) {
            addressData.province = districtInfo.province || addressData.province;
            addressData.city = districtInfo.city || addressData.city;
            addressData.district = districtInfo.district || addressData.district;
            addressData.code = districtInfo.code;
            // addressData.provinceMojiCode = districtInfo.provinceMojiCode;
            // addressData.districtMojiCode = districtInfo.mojiCode;
            // addressData.provinceNmcCode = districtInfo.provinceNmcCode;
            // addressData.districtNmcCode = districtInfo.nmcCode;
            // addressData.districtCmaCode = districtInfo.cmaCode;
        }
    }
    console.log('返回完整的位置数据:', addressData.toString());

    // 将最终响应数据缓存到接口级缓存
    cacheIpLocation(clientIp, addressData);

    return {data:addressData, timestamp: Date.now()};
}

// 获取省市县三级地址的天气区域编码数据
function getAllAreaCodes() {
    if (areaCodesData) {
        return areaCodesData;
    }
    if (!fs.existsSync(AREA_CODES_FILE)) {
        throw new Error(`文件不存在，无法返回数据`);
    }

    const areaCodesStr = fs.readFileSync(AREA_CODES_FILE, 'utf-8');
    areaCodesData = JSON.parse(areaCodesStr);
    // 省份（第一级）有mojiCode，没有code, 城市（第二级）没有code和mojiCode, 区县（第三级/叶子节点）有code和mojiCode
    return areaCodesData;
}

// 获取District对应的各种天气区域编码数据
function getDistrictAreaCodes(areaCode) {
    if (!areaCodesMap) {
        areaCodesMap = {};
        // 遍历 allAreaCodes 数据，查找叶子节点的数据，将数据中的code作为Map的key，将数据对象作为Map的value
        getAllAreaCodes().data.forEach(item => {
            if (item.children && item.children.length > 0) {
                // 递归处理子节点
                item.children.forEach(child => {
                    if (child.children && child.children.length > 0) {
                        // 递归处理子节点的子节点
                        child.children.forEach(leaf => {
                            areaCodesMap[leaf.code] = {
                                mojiAreaCode: leaf.mojiCode ? `${item.mojiCode}/${leaf.mojiCode}` : null,
                                nmcApiCode: leaf.nmcCode,
                                nmcAreaCode: leaf.nmcNameCode ? `${item.nmcCode}/${leaf.nmcNameCode}` : null,
                                cmaAreaCode: leaf.cmaCode,
                            };
                        });
                    } else {
                        // 直接添加子节点到Map
                        areaCodesMap[child.code] = {mojiAreaCode: child.mojiCode, nmcAreaCode: child.nmcCode, cmaAreaCode: child.cmaCode,};
                    }
                });
            } else {
                // 直接添加叶子节点到Map
                areaCodesMap[item.code] = {mojiAreaCode: item.mojiCode, nmcAreaCode: item.nmcCode, cmaAreaCode: item.cmaCode,};
            }
        });
    }
    return areaCodesMap[areaCode];
}


module.exports = {
    getLocation,
    getAllAreaCodes,
    getDistrictAreaCodes
};
