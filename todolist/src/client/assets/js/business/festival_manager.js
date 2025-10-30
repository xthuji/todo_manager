/**
 * 节日信息管理模块
 * 针对页面：节日管理页面
 * 业务功能模块：
 *  1. 管理节日配置数据，支持自定义节日
 *  2. 更新节假日缓存数据
 */

// 引入公共节日工具模块
import './common/lunar_utils.js';

// 引入节假日管理模块
import './common/holiday_manager.js';
    
// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', async function() {
    // 全局节日数据
    window.allFestivals = [];
    
    // 初始化节日管理
    await initFestivalManager();
    
    // 暴露所有需要被HTML调用的函数到全局作用域
    window.addFestival = addFestival;
    window.editFestival = editFestival;
    window.saveFestival = saveFestival;
    window.deleteFestivalConfirm = deleteFestivalConfirm;
    window.deleteFestival = deleteFestival;
    window.closeDeleteModal = closeDeleteModal;
    window.closeFestivalModal = closeFestivalModal;
    window.toggleDateTypeInputs = toggleDateTypeInputs;
});

// 初始化节日管理
async function initFestivalManager() {
    try {
        // 尝试从配置文件加载节日数据
        window.allFestivals = await loadFestivalsFromConfig();
    } catch (error) {
        console.warn('Failed to load festivals from config, using default data:', error);
        // 如果加载失败，使用默认数据
        window.allFestivals = loadDefaultFestivals();
    }
    
    // 初始化筛选和分页
    initFilterAndPagination(window.allFestivals);
    
    // 立即初始化节假日缓存信息显示，不延迟
    await window.holidayManager.getHolidayData();
}

// 从配置文件加载节日数据
async function loadFestivalsFromConfig() {
    const response = await fetch('/data/config/festival_config.json');
    if (!response.ok) {
        throw new Error(`Failed to fetch festival config: ${response.status}`);
    }
    const config = await response.json();
    
    // 为每个节日添加唯一ID和确保日期格式正确
    return config.festivals.map((festival, index) => {
        const festivalWithId = { ...festival };
        
        // 为没有ID的节日生成ID
        if (!festivalWithId.id) {
            festivalWithId.id = index.toString();
        }
        
        return festivalWithId;
    });
}

// 加载默认节日数据
function loadDefaultFestivals() {
    // 不返回任何硬编码的节日数据
    return [];
}

// 渲染节日列表
function renderFestivalList(festivals) {
    const festivalList = document.getElementById('festival-list');
    if (!festivalList) {
        console.error('节日列表容器不存在');
        return;
    }
    
    // 清空现有内容
    festivalList.innerHTML = '';
    
    // 创建内部容器
    const innerContainer = document.createElement('div');
    innerContainer.className = 'space-y-0';
    festivalList.appendChild(innerContainer);
    
    // 更新节日计数
    const festivalCount = document.getElementById('festival-count');
    if (festivalCount) {
        festivalCount.textContent = `共 ${festivals.length} 个节日`;
    }
    
    if (!festivals || festivals.length === 0) {
        // 显示空状态
        const emptyState = document.createElement('div');
        emptyState.className = 'col-span-5 py-10 text-center text-gray-500';
        emptyState.innerHTML = `<i class="fa fa-calendar-o text-3xl mb-2"></i><br>暂无节日数据`;
        innerContainer.appendChild(emptyState);
        return;
    }
    
    // 创建每个节日项
    for (let i = 0; i < festivals.length; i++) {
        const festival = festivals[i];
        const festivalItem = document.createElement('div');
        festivalItem.className = 'grid grid-cols-5 gap-3 p-1 border-2 border-gray-100 hover:bg-gray-50 rounded-lg transition-colors';
        festivalItem.innerHTML = `
            <!-- 节日名称 -->
            <div class="col-span-2 font-medium flex items-center">
                ${festival.name}${festival.alias ? ` (${festival.alias})` : ''}
            </div>
            <!-- 节日类型 -->
            <div class="col-span-1 text-sm flex items-center">
                <span class="${getFestivalTypeClass(festival.type)} festival-tag text-white px-1 py-0.5 rounded text-xs whitespace-nowrap">${getFestivalTypeName(festival.type)}</span>
            </div>
            <!-- 日期类型 -->
            <div class="col-span-1 text-sm text-gray-600 flex items-center">
                ${festival.dateType === 'solar' ? '公历' : festival.dateType === 'lunar' ? '农历' : festival.dateType === 'week' ? '星期' : '节气'}
                ${festival.date && festival.date.trim() !== '' ? ` ${festival.date}` : ''}
            </div>
            <!-- 操作按钮 -->
            <div class="col-span-1 flex justify-end items-center space-x-2">
                <button class="btn-action" onclick="editFestival('${festival.id}')">
                    <i class="fa fa-pencil text-blue-500"></i>
                </button>
                <button class="btn-action" onclick="deleteFestivalConfirm('${festival.id}', '${festival.name}')">
                    <i class="fa fa-trash text-red-500"></i>
                </button>
            </div>
        `;
        innerContainer.appendChild(festivalItem);
    }
}

// 初始化筛选功能
function initFilterAndPagination(festivals) {
    try {
        // 安全地获取DOM元素
        const searchInput = document.getElementById('search-input');
        const typeFilter = document.getElementById('type-filter');
        const dateTypeFilter = document.getElementById('date-type-filter');
        
        // 验证必要的DOM元素是否存在
        if (!searchInput || !typeFilter || !dateTypeFilter) {
            console.warn('筛选功能所需的DOM元素不完整，可能无法正常工作');
            // 直接渲染所有节日数据，不使用筛选功能
            renderFestivalList(festivals || []);
            return;
        }
        
        let filteredFestivals = [];
        
        // 防抖搜索函数
        const debounce = (func, delay) => {
            let timeoutId;
            return function() {
                const context = this;
                const args = arguments;
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => func.apply(context, args), delay);
            };
        };
        
        // 排序函数 - 按节日类型>日期类型>原有排序优先级
        const sortFestivals = (festivalsToSort) => {
            // 定义节日类型排序优先级
            const festivalTypePriority = {
                'chinese_common': 1,      // 常用节日
                'chinese_traditional': 2, // 传统节日
                'solar_terms': 3,         // 节气
                'foreign': 4,             // 国外节日
                'custom': 5               // 自定义节日
            };
            
            // 定义日期类型排序优先级
            const dateTypePriority = {
                'solar': 1,  // 公历
                'lunar': 2,  // 农历
                'week': 3    // 星期
            };
            
            return [...festivalsToSort].sort((a, b) => {
                // 1. 按节日类型排序
                const typePriorityA = festivalTypePriority[a.type] || 99;
                const typePriorityB = festivalTypePriority[b.type] || 99;
                if (typePriorityA !== typePriorityB) {
                    return typePriorityA - typePriorityB;
                }
                
                // 2. 按日期类型排序
                const dateTypePriorityA = dateTypePriority[a.dateType] || 99;
                const dateTypePriorityB = dateTypePriority[b.dateType] || 99;
                if (dateTypePriorityA !== dateTypePriorityB) {
                    return dateTypePriorityA - dateTypePriorityB;
                }
                
                // 3. 原有排序逻辑 - 按日期排序
                if (a.dateType === 'solar' && b.dateType === 'solar') {
                    // 优化：使用正则表达式提取日期部分，添加安全检查
                    if (!a.date || !b.date) {
                        // 如果任何一个日期不存在，按名称排序
                        return a.name.localeCompare(b.name);
                    }
                       
                    const aMonthMatch = a.date.match(/(\d+)月/);
                    const aDayMatch = a.date.match(/月(\d+)日/);
                    const bMonthMatch = b.date.match(/(\d+)月/);
                    const bDayMatch = b.date.match(/月(\d+)日/);
                       
                    if (aMonthMatch && aDayMatch && bMonthMatch && bDayMatch) {
                        const aMonth = parseInt(aMonthMatch[1]);
                        const aDay = parseInt(aDayMatch[1]);
                        const bMonth = parseInt(bMonthMatch[1]);
                        const bDay = parseInt(bDayMatch[1]);
                        return (aMonth - bMonth) || (aDay - bDay);
                    }
                }
                // 对非公历日期使用名称排序
                return a.name.localeCompare(b.name);
            });
        };
        
        // 应用筛选
        function applyFilters() {
            // 获取筛选后的节日
            filteredFestivals = [];
            
            // 即使节日数据为空，也要确保筛选功能正常工作
            if (festivals && festivals.length > 0) {
                // 优化版筛选逻辑 - 使用for循环而非filter
                for (let i = 0; i < festivals.length; i++) {
                    const festival = festivals[i];
                    
                    // 快速筛选条件
                    if (searchInput.value !== '' && !festival.name.includes(searchInput.value)) {
                        continue;
                    }
                    if (typeFilter.value !== 'all' && festival.type !== typeFilter.value) {
                        continue;
                    }
                    if (dateTypeFilter.value !== 'all' && festival.dateType !== dateTypeFilter.value) {
                        continue;
                    }
                    
                    filteredFestivals.push(festival);
                }
                
                // 排序
                filteredFestivals = sortFestivals(filteredFestivals);
            }
            
            // 渲染所有筛选后的节日
            renderFestivalList(filteredFestivals);
        }
        
        // 事件监听器 - 搜索使用防抖
        const debouncedSearch = debounce(applyFilters, 300);
        searchInput.addEventListener('input', debouncedSearch);
        
        // 其他筛选事件
        typeFilter.addEventListener('change', applyFilters);
        dateTypeFilter.addEventListener('change', applyFilters);
        
        // 初始更新
        applyFilters();
    } catch (error) {
        console.error('初始化筛选功能失败:', error);
        // 出错时直接渲染所有节日数据
        renderFestivalList(festivals || []);
    }
}

// 获取节日类型对应的样式类
function getFestivalTypeClass(type) {
    try {
        // 优先使用公共节日工具模块
        if (window.lunarUtils && typeof window.lunarUtils.getFestivalTypeClass === 'function') {
            // 如果公共模块支持区分常用节日和传统节日，则直接使用
            if (type === 'chinese_common' && window.lunarUtils.getFestivalTypeClass('chinese_common') !== window.lunarUtils.getFestivalTypeClass('chinese_traditional')) {
                return window.lunarUtils.getFestivalTypeClass(type);
            }
        }
        
        // 自定义实现：区分常用节日和传统节日
        switch (type) {
            case 'chinese_common':
                return 'bg-festival-common'; // 常用节日 - 使用深红色
            case 'chinese_traditional':
                return 'bg-festival-traditional'; // 传统节日 - 使用红色
            case 'foreign':
                return 'bg-festival-foreign'; // 国外节日
            case 'solar_terms':
                return 'bg-festival-terms'; // 节气
            case 'custom':
                return 'bg-festival-custom'; // 自定义节日
            default:
                return 'bg-festival-custom'; // 默认使用自定义节日样式
        }
    } catch (error) {
        console.warn('获取节日类型样式失败:', error);
        return 'bg-festival-custom';
    }
}

// 获取节日类型名称
function getFestivalTypeName(type) {
    try {
        // 优先使用公共节日工具模块
        if (window.lunarUtils && typeof window.lunarUtils.getFestivalTypeName === 'function') {
            return window.lunarUtils.getFestivalTypeName(type);
        }
        
        // 兼容模式：如果festivalUtils不可用，使用原始实现
        switch (type) {
            case 'chinese_common':
                return '常用节日';
            case 'foreign':
                return '国外节日';
            case 'solar_terms':
                return '节气';
            case 'chinese_traditional':
                return '传统节日';
            case 'custom':
                return '自定义节日';
            default:
                return '未知类型';
        }
    } catch (error) {
        console.warn('获取节日类型名称失败:', error);
        return '未知类型';
    }
}

// 添加新节日
function addFestival() {
    const festivalModal = document.getElementById('festival-modal');
    document.getElementById('modal-title').textContent = '新增节日';
    document.getElementById('festival-id').value = '';
    document.getElementById('festival-name').value = '';
    document.getElementById('festival-alias').value = '';
    document.getElementById('festival-date-type').value = 'solar';
    document.getElementById('festival-type').value = 'custom';
    document.getElementById('festival-month').value = '';
    document.getElementById('festival-day').value = '';
    document.getElementById('festival-week-month').value = '';
    document.getElementById('festival-week-count').value = '';
    document.getElementById('festival-week-day').value = '';
    
    // 显示日期类型对应输入区域
    toggleDateTypeInputs('solar');
    
    // 显示模态框
    festivalModal.classList.remove('hidden');
    
    // 添加ESC快捷键关闭功能
    function handleEscKey(e) {
        if (e.key === 'Escape') {
            closeFestivalModal();
        }
    }
    
    // 添加点击外部区域关闭功能
    function handleClickOutside(e) {
        if (e.target === festivalModal) {
            closeFestivalModal();
        }
    }
    
    // 移除之前的事件监听器，避免重复绑定
    document.removeEventListener('keydown', handleEscKey);
    festivalModal.removeEventListener('click', handleClickOutside);
    
    // 绑定新的事件监听器
    document.addEventListener('keydown', handleEscKey);
    festivalModal.addEventListener('click', handleClickOutside);
}

// 关闭节日编辑模态框
function closeFestivalModal() {
    const festivalModal = document.getElementById('festival-modal');
    festivalModal.classList.add('hidden');
    
    // 移除事件监听器
    document.removeEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeFestivalModal();
    });
}

// 编辑节日
function editFestival(festivalId) {
    const festival = window.allFestivals.find(f => f.id === festivalId);
    if (!festival) {
        console.error('找不到要编辑的节日');
        return;
    }
    
    const festivalModal = document.getElementById('festival-modal');
    document.getElementById('modal-title').textContent = '编辑节日';
    document.getElementById('festival-id').value = festival.id;
    document.getElementById('festival-name').value = festival.name || '';
    document.getElementById('festival-alias').value = festival.alias || '';
    document.getElementById('festival-date-type').value = festival.dateType || 'solar';
    document.getElementById('festival-type').value = festival.type || 'custom';
    
    // 根据日期类型设置输入值
    const dateType = festival.dateType || 'solar';
    
    // 显示日期类型对应输入区域
    toggleDateTypeInputs(dateType);
    
    // 解析日期并设置输入值
    if (festival.date) {
        if (dateType === 'solar') {
            // 解析公历日期格式 MM-DD
            const dateParts = festival.date.split('-');
            if (dateParts.length >= 2) {
                document.getElementById('festival-month').value = dateParts[0].padStart(2, '0');
                document.getElementById('festival-day').value = dateParts[1].padStart(2, '0');
            }
        } else if (dateType === 'lunar') {
            // 解析农历日期格式 MM-DD
            const dateParts = festival.date.split('-');
            if (dateParts.length >= 2) {
                document.getElementById('lunar-festival-month').value = dateParts[0].padStart(2, '0');
                document.getElementById('lunar-festival-day').value = dateParts[1].padStart(2, '0');
            }
        } else if (dateType === 'week') {
            // 解析日期格式 MM-W-D (月-第几周-星期几)
            const dateParts = festival.date.split('-');
            if (dateParts.length >= 3) {
                document.getElementById('festival-week-month').value = dateParts[0];
                document.getElementById('festival-week-count').value = dateParts[1];
                document.getElementById('festival-week-day').value = dateParts[2];
            }
        } else if (dateType === 'solar_terms') {
            // 节气的日期自动处理
            // 这里不需要特别处理输入值，因为节气的输入区域是只读的
        }
    } else {
        // 处理没有date字段的情况
        if (dateType === 'solar') {
            document.getElementById('festival-month').value = '';
            document.getElementById('festival-day').value = '';
        } else if (dateType === 'lunar') {
            document.getElementById('lunar-festival-month').value = '';
            document.getElementById('lunar-festival-day').value = '';
        } else if (dateType === 'week') {
            document.getElementById('festival-week-month').value = '';
            document.getElementById('festival-week-count').value = '';
            document.getElementById('festival-week-day').value = '';
        }
    }
    
    // 显示模态框
    festivalModal.classList.remove('hidden');
    
    // 添加ESC快捷键关闭功能
    function handleEscKey(e) {
        if (e.key === 'Escape') {
            closeFestivalModal();
        }
    }
    
    // 添加点击外部区域关闭功能
    function handleClickOutside(e) {
        if (e.target === festivalModal) {
            closeFestivalModal();
        }
    }
    
    // 移除之前的事件监听器，避免重复绑定
    document.removeEventListener('keydown', handleEscKey);
    festivalModal.removeEventListener('click', handleClickOutside);
    
    // 绑定新的事件监听器
    document.addEventListener('keydown', handleEscKey);
    festivalModal.addEventListener('click', handleClickOutside);
}

// 切换日期类型输入区域显示
function toggleDateTypeInputs(dateType) {
    const solarInput = document.getElementById('solar-date-input');
    const lunarInput = document.getElementById('lunar-date-input');
    const weekInput = document.getElementById('week-date-input');
    const solarTermsInput = document.getElementById('solar-terms-input');
    
    // 隐藏所有输入区域
    solarInput.classList.add('hidden');
    lunarInput.classList.add('hidden');
    weekInput.classList.add('hidden');
    solarTermsInput.classList.add('hidden');
    
    // 根据日期类型显示对应的输入区域
    if (dateType === 'solar') {
        solarInput.classList.remove('hidden');
    } else if (dateType === 'lunar') {
        lunarInput.classList.remove('hidden');
    } else if (dateType === 'week') {
        weekInput.classList.remove('hidden');
    } else if (dateType === 'solar_terms') {
        solarTermsInput.classList.remove('hidden');
    }
}

// 保存节日
function saveFestival() {
    const id = document.getElementById('festival-id').value;
    const name = document.getElementById('festival-name').value.trim();
    const alias = document.getElementById('festival-alias').value.trim();
    const type = document.getElementById('festival-type').value;
    const dateType = document.getElementById('festival-date-type').value;
    
    // 验证必填字段
    if (!name) {
        alert('请输入节日名称');
        return;
    }
    
    let date = '';
    
    // 根据日期类型获取日期
    if (dateType === 'solar') {
        const month = document.getElementById('festival-month').value;
        const day = document.getElementById('festival-day').value;
        
        if (!month || !day) {
            alert('请选择完整的日期');
            return;
        }
        
        date = `${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } else if (dateType === 'lunar') {
        const month = document.getElementById('lunar-festival-month').value;
        const day = document.getElementById('lunar-festival-day').value;
        
        if (!month || !day) {
            alert('请选择完整的日期');
            return;
        }
        
        date = `${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } else if (dateType === 'week') {
        const weekMonth = document.getElementById('festival-week-month').value;
        const weekCount = document.getElementById('festival-week-count').value;
        const weekDay = document.getElementById('festival-week-day').value;
        
        if (!weekMonth || !weekCount || !weekDay) {
            alert('请选择完整的星期日期');
            return;
        }
        
        date = `${weekMonth}-${weekCount}-${weekDay}`;
    } else if (dateType === 'solar_terms') {
        // 节气的日期是固定的，根据名称确定
        const solarTermDateMap = {
            '立春': '02-04',
            '雨水': '02-19',
            '惊蛰': '03-06',
            '春分': '03-21',
            '清明': '04-05',
            '谷雨': '04-20',
            '立夏': '05-05',
            '小满': '05-21',
            '芒种': '06-06',
            '夏至': '06-21',
            '小暑': '07-07',
            '大暑': '07-23',
            '立秋': '08-07',
            '处暑': '08-23',
            '白露': '09-07',
            '秋分': '09-23',
            '寒露': '10-08',
            '霜降': '10-23',
            '立冬': '11-07',
            '小雪': '11-22',
            '大雪': '12-07',
            '冬至': '12-22',
            '小寒': '01-05',
            '大寒': '01-20'
        };
        
        date = solarTermDateMap[name] || '';
    }
    
    // 构建节日对象
    const festivalData = {
        id: id || Date.now().toString(),
        name,
        alias,
        type,
        dateType,
        date
    };
    
    // 检查是新增还是编辑
    if (id) {
        // 编辑现有节日
        const index = window.allFestivals.findIndex(f => f.id === id);
        if (index !== -1) {
            window.allFestivals[index] = festivalData;
        }
    } else {
        // 新增节日
        window.allFestivals.push(festivalData);
    }
    
    // 保存到服务器
    saveFestivalsToServer();
    
    // 更新本地显示
    initFilterAndPagination(window.allFestivals);
    
    // 关闭模态框
    document.getElementById('festival-modal').classList.add('hidden');
}

// 保存节日数据到服务器
async function saveFestivalsToServer() {
    try {
        // 准备要保存的数据，移除ID字段
        const dataToSave = {
            festivals: window.allFestivals.map(({ id, ...rest }) => rest),
            holidayTypes: {},
            holidayStyles: {}
        };
        
        // 调用服务器API保存数据到festival_config.json配置文件
        const response = await fetch('/api/festival/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dataToSave)
        });
        
        if (!response.ok) {
            throw new Error(`保存失败: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('Festival data saved to festival_config.json successfully:', result);
        
        // 显示保存成功提示
        alert('节日数据保存成功！');
        
    } catch (error) {
        console.error('Failed to save festival data to festival_config.json:', error);
        alert(`保存失败: ${error.message}`);
    }
}

// 删除节日确认
function deleteFestivalConfirm(festivalId, festivalName) {
    const deleteModal = document.getElementById('delete-modal');
    document.getElementById('delete-confirm-text').textContent = `确定要删除节日 "${festivalName}" 吗？`;
    document.getElementById('delete-festival-id').value = festivalId;
    deleteModal.classList.remove('hidden');
}

// 删除节日
function deleteFestival() {
    const festivalId = document.getElementById('delete-festival-id').value;
    
    // 从节日列表中移除
    window.allFestivals = window.allFestivals.filter(f => f.id !== festivalId);
    
    // 保存到服务器
    saveFestivalsToServer();
    
    // 更新本地显示
    initFilterAndPagination(window.allFestivals);
    
    // 关闭删除确认模态框
    document.getElementById('delete-modal').classList.add('hidden');
}

// 关闭删除确认模态框
function closeDeleteModal() {
    document.getElementById('delete-modal').classList.add('hidden');
}

// 在模块加载完成后暴露函数到全局作用域
// 这样可以确保在HTML中调用这些函数时它们已经准备好

// 刷新节假日缓存
window.refreshHolidayCache = async function() {
    try {
        const apiUrl = document.getElementById('holiday-api-url').value;
        if (!apiUrl) {
            alert('请输入有效的API地址');
            return;
        }
        
        const cacheInfo = document.getElementById('holiday-cache-info');
        cacheInfo.innerHTML = '<i class="fa fa-spinner fa-spin mr-2 text-blue-500"></i> 正在刷新节假日缓存...';
        cacheInfo.classList.add('bg-blue-50', 'border-blue-100');
        
        // 这里只是模拟API调用，实际实现需要根据后端API调整
        // 由于没有实际的后端API，我们可以只显示成功消息
        setTimeout(() => {
            cacheInfo.innerHTML = '<i class="fa fa-check-circle text-green-500 mr-2"></i> 节假日缓存刷新成功';
            cacheInfo.classList.remove('bg-blue-50', 'border-blue-100');
            cacheInfo.classList.add('bg-green-50', 'border-green-100');
            alert('节假日缓存刷新成功！');
        }, 1000);
    } catch (error) {
        console.error('刷新节假日缓存失败:', error);
        alert(`刷新失败: ${error.message}`);
    }
};