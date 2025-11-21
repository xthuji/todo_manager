/**
 * 节日信息管理模块
 * 针对页面：节日管理页面
 * 业务功能模块：
 *  1. 管理节日配置数据 - 加载、展示、编辑和保存各种类型的节日信息
 *  2. 支持自定义节日 - 允许用户添加、编辑和删除自定义节日
 *  3. 节日类型管理 - 处理常用节日、传统节日、节气、国外节日和自定义节日等多种类型
 *  4. 日期类型支持 - 支持公历、农历和星期三种日期计算方式
 *  5. 更新节假日缓存数据 - 与holiday_manager配合确保节假日数据的准确性
 * 使用场景：
 *  1. 系统管理员配置和维护节日信息
 *  2. 用户查看和管理个人自定义节日
 *  3. 系统初始化时加载节日配置数据
 *  4. 日历视图需要准确的节假日显示时
 * 与其他模块配合：
 *  - 依赖lunar_utils.js进行农历转换和节日类型判断
 *  - 配合holiday_manager.js更新节假日缓存数据
 *  - 为calendar_view.js提供完整的节日信息支持
 */

// 引入API配置模块
import { buildApiUrl } from '../config/api.js';

// 引入公共节日工具模块
import './common/lunar_utils.js';

// 引入节假日管理模块
import './common/holiday_manager.js';
    
// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', async function() {

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
    window.openHolidayModal = openHolidayModal;
    window.closeHolidayModal = closeHolidayModal;
    
    // 初始化事件监听器
    const viewHolidayBtn = document.getElementById('btn-view-holiday-info');
    if (viewHolidayBtn) {
        viewHolidayBtn.addEventListener('click', openHolidayModal);
    }
});

// 查看节假日信息相关函数
async function openHolidayModal() {
    const modal = document.getElementById('holiday-modal');
    if (modal) {
        modal.classList.remove('hidden');
        await loadHolidayData();
        
        // 添加点击浮层外部关闭浮层的功能
        // 使用setTimeout确保modal已经显示
        setTimeout(() => {
            document.addEventListener('click', handleOutsideClick);
        }, 10);
        
        // 获取内部内容div并添加点击事件阻止冒泡
        const modalContent = modal.querySelector('div.bg-white');
        if (modalContent) {
            modalContent.addEventListener('click', function(e) {
                e.stopPropagation(); // 阻止事件冒泡，防止点击内部内容关闭浮层
            });
        }
    }
}

// 处理点击浮层外部关闭浮层的函数
function handleOutsideClick(event) {
    const modal = document.getElementById('holiday-modal');
    
    // 直接判断点击目标是否为modal本身（即半透明背景层）且浮层是可见的
    if (modal && !modal.classList.contains('hidden') && event.target === modal) {
        closeHolidayModal();
    }
}

function closeHolidayModal() {
    const modal = document.getElementById('holiday-modal');
    if (modal) {
        modal.classList.add('hidden');
        
        // 移除点击事件监听器，避免重复绑定
        document.removeEventListener('click', handleOutsideClick);
    }
}

async function loadHolidayData() {
    const tbody = document.getElementById('holiday-list-body');
    if (!tbody) {
        console.error('节假日列表表格体不存在');
        return;
    }
    
    tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">加载中...</td></tr>';

    try {
        // 主动调用getHolidayData获取最新的节假日数据
        const holidayData = await window.holidayManager?.getHolidayData();
        let allHolidays = [];

        if (holidayData && holidayData.Years) {
            // 处理Years嵌套结构
            const years = holidayData.Years;
            for (const year in years) {
                if (Array.isArray(years[year])) {
                    years[year].forEach(holiday => {
                        allHolidays.push({
                            ...holiday,
                            Year: year
                        });
                    });
                }
            }
        } else if (!holidayData) {
            tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">未找到节假日缓存数据，请先刷新节假日缓存</td></tr>';
            return;
        } else {
            console.warn('未知的节假日数据格式:', holidayData);
            tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">节假日数据格式未知，请检查数据来源</td></tr>';
            return;
        }

        // 按开始日期倒序排序（时间更大的放在前面）
        allHolidays.sort((a, b) => {
            const dateA = a.StartDate ? new Date(a.StartDate) : new Date(0);
            const dateB = b.StartDate ? new Date(b.StartDate) : new Date(0);
            return dateB - dateA;
        });

        // 生成表格内容
        if (allHolidays.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">暂无节假日数据</td></tr>';
            return;
        }

        let html = '';
        allHolidays.forEach(holiday => {
            const compDaysHtml = holiday.CompDays && Array.isArray(holiday.CompDays) && holiday.CompDays.length > 0 
                ? holiday.CompDays.join('<br>') 
                : '-';
            
            html += `
                <tr class="hover:bg-gray-50">
                    <td class="w-[20%] px-6 py-4 text-sm font-medium text-gray-900 truncate">${holiday.Name || holiday.name || '-'}</td>
                    <td class="w-[15%] px-6 py-4 text-sm text-gray-500 truncate">${holiday.StartDate || '-'}</td>
                    <td class="w-[15%] px-6 py-4 text-sm text-gray-500 truncate">${holiday.EndDate || '-'}</td>
                    <td class="w-[10%] px-6 py-4 text-sm text-gray-500 truncate">${holiday.Duration || '-'}</td>
                    <td class="w-[25%] px-6 py-4 text-sm text-gray-500">${compDaysHtml}</td>
                    <td class="w-[15%] px-6 py-4 text-sm text-gray-500 truncate">${holiday.Year || (holiday.StartDate ? new Date(holiday.StartDate).getFullYear() : '-')}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    } catch (error) {
        console.error('解析节假日数据失败:', error);
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">解析节假日数据失败: ${error.message}</td></tr>`;
    }
}

// 初始化节日管理
async function initFestivalManager() {
    try {
        // 尝试从配置文件加载节日数据
        await window.lunarUtils.loadHolidayConfig();
    } catch (error) {
        console.warn('Failed to load festivals from config, using default data:', error);
    }
    
    // 初始化筛选和分页
    initFilterAndPagination(window.calendarConfig.festivals);
    
    // 立即初始化节假日缓存信息显示，不延迟
    await window.holidayManager.getHolidayData();
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
                <span class="${window.lunarUtils.getFestivalTypeClass(festival.type)} festival-tag text-white px-1 py-0.5 rounded text-xs whitespace-nowrap">${window.lunarUtils.getFestivalTypeName(festival.type)}</span>
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
    const festival = window.calendarConfig.festivals.find(f => f.id === festivalId);
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
        // 对于节气类型，我们不需要存储具体日期
        // 日期会在显示时由lunarUtils动态计算
        date = '';
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
        const index = window.calendarConfig.festivals.findIndex(f => f.id === id);
        if (index !== -1) {
            window.calendarConfig.festivals[index] = festivalData;
        }
    } else {
        // 新增节日
        window.calendarConfig.festivals.push(festivalData);
    }
    
    // 保存到服务器
    saveFestivalsToServer();
    
    // 更新本地显示
    initFilterAndPagination(window.calendarConfig.festivals);
    
    // 关闭模态框
    document.getElementById('festival-modal').classList.add('hidden');
}

// 保存节日数据到服务器
async function saveFestivalsToServer() {
    try {
        // 准备要保存的数据，移除ID字段
        const dataToSave = {
            festivals: window.calendarConfig.festivals.map(({ id, ...rest }) => rest)
        };
        
        // 调用服务器API保存数据到festival_config.json配置文件
        const response = await fetch(buildApiUrl('/api/festival/save'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dataToSave)
        });
        
        // 获取响应数据
        const responseData = await response.json();
        
        // 检查是否有错误
        if (responseData.error) {
            throw new Error(responseData.error.message || '保存失败');
        }
        
        if (!response.ok) {
            throw new Error(`保存失败: ${response.status} ${response.statusText}`);
        }
        
        // 从响应中提取数据（只处理服务端返回的固定{data, timestamp}格式）
        const result = responseData.data;
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
    window.calendarConfig.festivals = window.calendarConfig.festivals.filter(f => f.id !== festivalId);
    
    // 保存到服务器
    saveFestivalsToServer();
    
    // 更新本地显示
    initFilterAndPagination(window.calendarConfig.festivals);
    
    // 关闭删除确认模态框
    document.getElementById('delete-modal').classList.add('hidden');
}

// 关闭删除确认模态框
function closeDeleteModal() {
    document.getElementById('delete-modal').classList.add('hidden');
}

// 刷新节假日缓存
window.refreshHolidayCache = async function() {
    try {
        const apiUrl = document.getElementById('holiday-api-url').value;
        if (!apiUrl) {
            alert('请输入有效的API地址');
            return;
        }

        await window.holidayManager.refreshHolidayCache(apiUrl);
    } catch (error) {
        console.error('刷新节假日缓存失败:', error);
        alert(`刷新失败: ${error.message}`);
    }
};