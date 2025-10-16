# AI智能编码规则配置说明

本文档详细说明项目中的AI智能编码规则配置，旨在规范AI生成代码的质量和一致性。

## 规则配置文件

- 配置文件路径：`~/work/MyProject/code_mine/gitee/node_app/todolist/ai_coding_rules.json`
- 包含编码规则、文件结构规范和项目信息

## 核心编码规则

### 1. 服务端端口保护 (SERVER_PORT_PROTECTION)
- **严重性**：高
- **描述**：不要修改服务端的启动端口
- **适用范围**：所有服务端代码
- **目的**：确保服务端始终使用预设的端口配置，避免端口冲突和配置不一致

### 2. 禁止硬编码数据 (NO_HARDCODED_DATA)
- **严重性**：高
- **描述**：服务端业务代码中不要使用降级默认数据或做硬编码特殊处理，所有业务数据都需要严格从指定的业务来源中获取
- **适用范围**：所有服务端代码
- **目的**：确保数据来源的一致性和可维护性，避免数据不一致问题

### 3. 页面访问路径格式 (PAGE_PATH_ROOT_FORMAT)
- **严重性**：中
- **描述**：所有页面的访问路径应该直接使用根路径的形式，比如 http://localhost:3000/weather_view.html，http://localhost:3000/index.html
- **适用范围**：所有客户端页面
- **目的**：统一页面访问方式，简化路径管理

### 4. 新页面测试要求 (NEW_PAGE_TEST_REQUIREMENT)
- **严重性**：中
- **描述**：添加新的页面时，同时创建对应的测试js文件，添加核心功能的测试用例
- **适用范围**：客户端页面和测试文件
- **目的**：确保新功能有基本的测试覆盖，提高代码质量

### 5. 静态文件复用 (STATIC_FILE_REUSE)
- **严重性**：低
- **描述**：页面使用的静态文件参考其他已有页面，优先复用本地已存在的
- **适用范围**：所有客户端页面
- **目的**：减少重复资源，优化加载性能

### 6. 首页集成规范 (INDEX_PAGE_INTEGRATION)
- **严重性**：中
- **描述**：新页面还需要仿照其他业务在index页面中添加侧边栏按钮，使用iframe方式引用页面
- **适用范围**：所有新添加的客户端页面
- **目的**：保持应用界面的一致性，提供统一的导航体验

## 文件结构规范

### 测试文件
- **路径**：`~/work/MyProject/code_mine/gitee/node_app/todolist/src/tests/`
- **文件格式**：所有测试JavaScript文件
- **示例**：`test_weather.js`, `test_calendar_full.js`

### HTML页面文件
- **路径**：`~/work/MyProject/code_mine/gitee/node_app/todolist/src/client/pages/`
- **文件格式**：所有HTML文件
- **示例**：`weather_view.html`, `todo_manager.html`

### 静态资源文件
- **路径**：`~/work/MyProject/code_mine/gitee/node_app/todolist/src/client/assets/`
- **子目录**：
  - `css/` - 样式文件
  - `js/` - JavaScript文件
  - `fonts/` - 字体文件

### 数据和配置文件
- **路径**：`~/work/MyProject/code_mine/gitee/node_app/todolist/data/`
- **文件类型**：JSON、TXT、配置文件等
- **示例**：`weather_area_codes.json`, `todo.txt`, `config/festival_config.json`

### 日志文件
- **路径**：`~/work/MyProject/code_mine/gitee/node_app/todolist/logs/`
- **用途**：存储所有应用程序生成的日志输出
- **注意事项**：确保日志文件有适当的权限设置

## 使用指南

1. **AI工具调用**：所有AI生成的代码应遵循以上规则
2. **代码审查**：开发人员在审查AI生成的代码时，请参考此文档检查是否符合规范
3. **规则更新**：规则需要更新时，请同时修改配置文件和此README文档

## 项目信息

- **项目名称**：todolist
- **项目根路径**：`~/work/MyProject/code_mine/gitee/node_app/todolist/`
- **规则版本**：1.0.0

---

请严格遵守以上规则，以确保代码质量和项目结构的一致性。