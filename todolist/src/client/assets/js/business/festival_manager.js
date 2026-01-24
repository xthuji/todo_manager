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

// 引入公共节日工具模块
import './common/lunar_utils.js';

// 引入节假日管理模块
import './common/holiday_manager.js';
    
// 页面加载完成后执行
$(document).ready(async function() {

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
    const viewHolidayBtn = $('#btn-view-holiday-info');
    if (viewHolidayBtn.length) {
        viewHolidayBtn.on('click', openHolidayModal);
    }
});

// 查看节假日信息相关函数
async function openHolidayModal() {
    const modal = $('#holiday-modal');
    if (modal.length) {
        modal.removeClass('hidden');
        await loadHolidayData();
        
        // 添加点击浮层外部关闭浮层的功能
        // 使用setTimeout确保modal已经显示
        setTimeout(() => {
            $(document).on('click', handleOutsideClick);
        }, 10);
        
        // 获取内部内容div并添加点击事件阻止冒泡
        const modalContent = modal.find('div.bg-white');
        if (modalContent.length) {
            modalContent.on('click', function(e) {
                e.stopPropagation(); // 阻止事件冒泡，防止点击内部内容关闭浮层
            });
        }
    }
}

// 处理点击浮层外部关闭浮层的函数
function handleOutsideClick(event) {
    const modal = $('#holiday-modal');
    
    // 直接判断点击目标是否为modal本身（即半透明背景层）且浮层是可见的
    if (modal.length && !modal.hasClass('hidden') && event.target === modal[0]) {
        closeHolidayModal();
    }
}

function closeHolidayModal() {
    const modal = $('#holiday-modal');
    if (modal.length) {
        modal.addClass('hidden');
        
        // 移除点击事件监听器，避免重复绑定
        $(document).off('click', handleOutsideClick);
    }
}

async function loadHolidayData() {
    const tbody = $('#holiday-list-body');
    if (!tbody.length) {
        console.error('节假日列表表格体不存在');
        return;
    }
    
    // 使用空状态模板显示加载中
    const emptyTemplate = $('#holiday-empty-template');
    if (emptyTemplate.length) {
        const loadingRow = $(emptyTemplate.html());
        const loadingCell = loadingRow.find('td');
        if (loadingCell.length) {
            loadingCell.text('加载中...');
        }
        tbody.empty();
        tbody.append(loadingRow);
    } else {
        tbody.html('<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">加载中...</td></tr>');
    }

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
            // 使用空状态模板显示错误信息
            if (emptyTemplate.length) {
                const errorRow = $(emptyTemplate.html());
                const errorCell = errorRow.find('td');
                if (errorCell.length) {
                    errorCell.text('未找到节假日缓存数据，请先刷新节假日缓存');
                }
                tbody.empty();
                tbody.append(errorRow);
            } else {
                tbody.html('<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">未找到节假日缓存数据，请先刷新节假日缓存</td></tr>');
            }
            return;
        } else {
            console.warn('未知的节假日数据格式:', holidayData);
            // 使用空状态模板显示错误信息
            if (emptyTemplate.length) {
                const errorRow = $(emptyTemplate.html());
                const errorCell = errorRow.find('td');
                if (errorCell.length) {
                    errorCell.text('节假日数据格式未知，请检查数据来源');
                }
                tbody.empty();
                tbody.append(errorRow);
            } else {
                tbody.html('<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">节假日数据格式未知，请检查数据来源</td></tr>');
            }
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
            // 使用空状态模板显示空数据信息
            if (emptyTemplate.length) {
                const emptyRow = $(emptyTemplate.html());
                const emptyCell = emptyRow.find('td');
                if (emptyCell.length) {
                    emptyCell.text('暂无节假日数据');
                }
                tbody.empty();
                tbody.append(emptyRow);
            } else {
                tbody.html('<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">暂无节假日数据</td></tr>');
            }
            return;
        }

        // 使用节假日项模板
        const holidayTemplate = $('#holiday-item-template');
        if (!holidayTemplate.length) {
            console.error('节假日项模板不存在');
            return;
        }

        tbody.empty();
        allHolidays.forEach(holiday => {
            const holidayItem = $(holidayTemplate.html());
            const cells = holidayItem.find('td');
            
            if (cells.length >= 6) {
                // 填充节日名称
                cells.eq(0).text(holiday.Name || holiday.name || '-');
                
                // 填充开始日期
                cells.eq(1).text(holiday.StartDate || '-');
                
                // 填充结束日期
                cells.eq(2).text(holiday.EndDate || '-');
                
                // 填充持续天数
                cells.eq(3).text(holiday.Duration || '-');
                
                // 填充补班日期
                const compDaysHtml = holiday.CompDays && Array.isArray(holiday.CompDays) && holiday.CompDays.length > 0 
                    ? holiday.CompDays.join('<br>') 
                    : '-';
                cells.eq(4).html(compDaysHtml);
                
                // 填充年份
                cells.eq(5).text(holiday.Year || (holiday.StartDate ? new Date(holiday.StartDate).getFullYear() : '-'));
            }
            
            tbody.append(holidayItem);
        });
    } catch (error) {
        console.error('解析节假日数据失败:', error);
        // 使用空状态模板显示错误信息
        if (emptyTemplate.length) {
            const errorRow = $(emptyTemplate.html());
            const errorCell = errorRow.find('td');
            if (errorCell.length) {
                errorCell.text(`解析节假日数据失败: ${error.message}`);
                errorCell.attr('class', 'px-6 py-4 text-center text-red-500');
            }
            tbody.empty();
            tbody.append(errorRow);
        } else {
            tbody.html(`<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">解析节假日数据失败: ${error.message}</td></tr>`);
        }
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
    const festivalList = $('#festival-list');
    if (!festivalList.length) {
        console.error('节日列表容器不存在');
        return;
    }
    
    // 清空现有内容
    festivalList.empty();
    
    // 创建内部容器
    const innerContainer = $('<div>').addClass('space-y-0');
    festivalList.append(innerContainer);
    
    // 更新节日计数
    const festivalCount = $('#festival-count');
    if (festivalCount.length) {
        festivalCount.text(`共 ${festivals.length} 个节日`);
    }
    
    if (!festivals || festivals.length === 0) {
        // 使用空状态模板
        const emptyTemplate = $('#empty-state-template');
        if (emptyTemplate.length) {
            const emptyState = $(emptyTemplate.html());
            innerContainer.append(emptyState);
        }
        return;
    }
    
    // 使用节日项模板
    const festivalTemplate = $('#festival-item-template');
    if (!festivalTemplate.length) {
        console.error('节日项模板不存在');
        return;
    }
    
    // 创建每个节日项
    for (let i = 0; i < festivals.length; i++) {
        const festival = festivals[i];
        const festivalItem = $(festivalTemplate.html());
        
        // 填充节日名称
        const nameElement = festivalItem.find('.col-span-2');
        if (nameElement.length) {
            let nameText = festival.name;
            if (festival.alias) {
                nameText += ` (${festival.alias})`;
            }
            nameElement.text(nameText);
        }
        
        // 填充节日类型
        const typeElement = festivalItem.find('.col-span-1:nth-child(2)');
        if (typeElement.length) {
            const typeClass = window.lunarUtils.getFestivalTypeClass(festival.type);
            const typeName = window.lunarUtils.getFestivalTypeName(festival.type);
            typeElement.html(`<span class="${typeClass} festival-tag text-white px-1 py-0.5 rounded text-xs whitespace-nowrap">${typeName}</span>`);
        }
        
        // 填充日期类型
        const dateElement = festivalItem.find('.col-span-1:nth-child(3)');
        if (dateElement.length) {
            let dateTypeText = '';
            switch (festival.dateType) {
                case 'solar':
                    dateTypeText = '公历';
                    break;
                case 'lunar':
                    dateTypeText = '农历';
                    break;
                case 'week':
                    dateTypeText = '星期';
                    break;
                default:
                    dateTypeText = '节气';
            }
            if (festival.date && festival.date.trim() !== '') {
                dateTypeText += ` ${festival.date}`;
            }
            dateElement.text(dateTypeText);
        }
        
        // 绑定事件
        const editBtn = festivalItem.find('.edit-btn');
        if (editBtn.length) {
            editBtn.on('click', () => editFestival(festival.id));
        }
        
        const deleteBtn = festivalItem.find('.delete-btn');
        if (deleteBtn.length) {
            deleteBtn.on('click', () => deleteFestivalConfirm(festival.id, festival.name));
        }
        
        innerContainer.append(festivalItem);
    }
}

// 初始化筛选功能
function initFilterAndPagination(festivals) {
    try {
        // 安全地获取DOM元素 (使用jQuery)
        const searchInput = $('#search-input');
        const typeFilter = $('#type-filter');
        const dateTypeFilter = $('#date-type-filter');
        
        // 验证必要的DOM元素是否存在
        if (!searchInput.length || !typeFilter.length || !dateTypeFilter.length) {
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
                    if (searchInput.val() !== '' && !festival.name.includes(searchInput.val())) {
                        continue;
                    }
                    if (typeFilter.val() !== 'all' && festival.type !== typeFilter.val()) {
                        continue;
                    }
                    if (dateTypeFilter.val() !== 'all' && festival.dateType !== dateTypeFilter.val()) {
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
        searchInput.on('input', debouncedSearch);
        
        // 其他筛选事件
        typeFilter.on('change', applyFilters);
        dateTypeFilter.on('change', applyFilters);
        
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
    const festivalModal = $('#festival-modal');
    $('#modal-title').text('新增节日');
    $('#festival-id').val('');
    $('#festival-name').val('');
    $('#festival-alias').val('');
    $('#festival-date-type').val('solar');
    $('#festival-type').val('custom');
    $('#festival-month').val('');
    $('#festival-day').val('');
    $('#festival-week-month').val('');
    $('#festival-week-count').val('');
    $('#festival-week-day').val('');
    
    // 显示日期类型对应输入区域
    toggleDateTypeInputs('solar');
    
    // 显示模态框
    festivalModal.removeClass('hidden');
    
    // 添加ESC快捷键关闭功能
    function handleEscKey(e) {
        if (e.key === 'Escape') {
            closeFestivalModal();
        }
    }
    
    // 添加点击外部区域关闭功能
    function handleClickOutside(e) {
        if (e.target === festivalModal[0]) {
            closeFestivalModal();
        }
    }
    
    // 移除之前的事件监听器，避免重复绑定
    $(document).off('keydown', handleEscKey);
    festivalModal.off('click', handleClickOutside);
    
    // 绑定新的事件监听器
    $(document).on('keydown', handleEscKey);
    festivalModal.on('click', handleClickOutside);
}

// 关闭节日编辑模态框
function closeFestivalModal() {
    const festivalModal = $('#festival-modal');
    festivalModal.addClass('hidden');
    
    // 移除事件监听器
    $(document).off('keydown', function(e) {
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
    
    const festivalModal = $('#festival-modal');
    $('#modal-title').text('编辑节日');
    $('#festival-id').val(festival.id);
    $('#festival-name').val(festival.name || '');
    $('#festival-alias').val(festival.alias || '');
    $('#festival-date-type').val(festival.dateType || 'solar');
    $('#festival-type').val(festival.type || 'custom');
    
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
                $('#festival-month').val(dateParts[0].padStart(2, '0'));
                $('#festival-day').val(dateParts[1].padStart(2, '0'));
            }
        } else if (dateType === 'lunar') {
            // 解析农历日期格式 MM-DD
            const dateParts = festival.date.split('-');
            if (dateParts.length >= 2) {
                $('#lunar-festival-month').val(dateParts[0].padStart(2, '0'));
                $('#lunar-festival-day').val(dateParts[1].padStart(2, '0'));
            }
        } else if (dateType === 'week') {
            // 解析日期格式 MM-W-D (月-第几周-星期几)
            const dateParts = festival.date.split('-');
            if (dateParts.length >= 3) {
                $('#festival-week-month').val(dateParts[0]);
                $('#festival-week-count').val(dateParts[1]);
                $('#festival-week-day').val(dateParts[2]);
            }
        } else if (dateType === 'solar_terms') {
            // 节气的日期自动处理
            // 这里不需要特别处理输入值，因为节气的输入区域是只读的
        }
    } else {
        // 处理没有date字段的情况
        if (dateType === 'solar') {
            $('#festival-month').val('');
            $('#festival-day').val('');
        } else if (dateType === 'lunar') {
            $('#lunar-festival-month').val('');
            $('#lunar-festival-day').val('');
        } else if (dateType === 'week') {
            $('#festival-week-month').val('');
            $('#festival-week-count').val('');
            $('#festival-week-day').val('');
        }
    }
    
    // 显示模态框
    festivalModal.removeClass('hidden');
    
    // 添加ESC快捷键关闭功能
    function handleEscKey(e) {
        if (e.key === 'Escape') {
            closeFestivalModal();
        }
    }
    
    // 添加点击外部区域关闭功能
    function handleClickOutside(e) {
        if (e.target === festivalModal[0]) {
            closeFestivalModal();
        }
    }
    
    // 移除之前的事件监听器，避免重复绑定
    $(document).off('keydown', handleEscKey);
    festivalModal.off('click', handleClickOutside);
    
    // 绑定新的事件监听器
    $(document).on('keydown', handleEscKey);
    festivalModal.on('click', handleClickOutside);
}

// 切换日期类型输入区域显示
function toggleDateTypeInputs(dateType) {
    const solarInput = $('#solar-date-input');
    const lunarInput = $('#lunar-date-input');
    const weekInput = $('#week-date-input');
    const solarTermsInput = $('#solar-terms-input');
    
    // 隐藏所有输入区域
    solarInput.addClass('hidden');
    lunarInput.addClass('hidden');
    weekInput.addClass('hidden');
    solarTermsInput.addClass('hidden');
    
    // 根据日期类型显示对应的输入区域
    if (dateType === 'solar') {
        solarInput.removeClass('hidden');
    } else if (dateType === 'lunar') {
        lunarInput.removeClass('hidden');
    } else if (dateType === 'week') {
        weekInput.removeClass('hidden');
    } else if (dateType === 'solar_terms') {
        solarTermsInput.removeClass('hidden');
    }
}

// 保存节日
function saveFestival() {
    const id = $('#festival-id').val();
    const name = $('#festival-name').val().trim();
    const alias = $('#festival-alias').val().trim();
    const type = $('#festival-type').val();
    const dateType = $('#festival-date-type').val();
    
    // 验证必填字段
    if (!name) {
        alert('请输入节日名称');
        return;
    }
    
    let date = '';
    
    // 根据日期类型获取日期
    if (dateType === 'solar') {
        const month = $('#festival-month').val();
        const day = $('#festival-day').val();
        
        if (!month || !day) {
            alert('请选择完整的日期');
            return;
        }
        
        date = `${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } else if (dateType === 'lunar') {
        const month = $('#lunar-festival-month').val();
        const day = $('#lunar-festival-day').val();
        
        if (!month || !day) {
            alert('请选择完整的日期');
            return;
        }
        
        date = `${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } else if (dateType === 'week') {
        const weekMonth = $('#festival-week-month').val();
        const weekCount = $('#festival-week-count').val();
        const weekDay = $('#festival-week-day').val();
        
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
    $('#festival-modal').addClass('hidden');
}

// 保存节日数据到服务器
async function saveFestivalsToServer() {
    try {
        // 准备要保存的数据，移除ID字段
        const dataToSave = {
            festivals: window.calendarConfig.festivals.map(({ id, ...rest }) => rest)
        };
        
        // 调用服务器API保存数据到festival_config.json配置文件
        const response = await fetch('/api/festival/save', {
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
    const deleteModal = $('#delete-modal');
    $('#delete-confirm-text').text(`确定要删除节日 "${festivalName}" 吗？`);
    $('#delete-festival-id').val(festivalId);
    deleteModal.removeClass('hidden');
}

// 删除节日
function deleteFestival() {
    const festivalId = $('#delete-festival-id').val();
    
    // 从节日列表中移除
    window.calendarConfig.festivals = window.calendarConfig.festivals.filter(f => f.id !== festivalId);
    
    // 保存到服务器
    saveFestivalsToServer();
    
    // 更新本地显示
    initFilterAndPagination(window.calendarConfig.festivals);
    
    // 关闭删除确认模态框
    $('#delete-modal').addClass('hidden');
}

// 关闭删除确认模态框
function closeDeleteModal() {
    $('#delete-modal').addClass('hidden');
}

// 刷新节假日缓存
window.refreshHolidayCache = async function() {
    try {
        const apiUrl = $('#holiday-api-url').val();
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