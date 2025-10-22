# 待办事项管理系统
![项目logo](favicon.png)

一个功能完善的待办事项管理系统，支持日历视图、任务管理、文件导入导出等功能。

## 功能特性

- 📅 日历视图展示任务
- ✅ 任务的添加、编辑、删除和完成状态切换
- 🔍 多维度筛选（状态、优先级、日期）
- 📁 文件导入导出功能
- 🔄 扫描本地目录文件
- 📅 节假日显示功能

## 快速开始

### 方式一：使用提供的启动脚本（推荐）

```bash
cd ~/script/todo
./start.sh
```

### 方式二：手动安装依赖并启动

1. 确保已安装pnpm
   ```bash
   npm install -g pnpm
   ```

2. 安装依赖
   ```bash
   pnpm install
   ```

3. 启动应用
   ```bash
   pnpm start
   ```

4. 开发模式启动（支持热重载）
   ```bash
   pnpm run dev
   ```

## 访问应用

启动后，通过浏览器访问以下地址：
- 使用Node.js服务器： [http://localhost:3000](http://localhost:3000)

## AI智能编码规则

项目已配置AI智能编码规则，请参考以下文档了解详情：
- [AI_CODING_RULES_README.md](AI_CODING_RULES_README.md) - 详细的编码规则说明
- [ai_coding_rules.json](ai_coding_rules.json) - 规则配置文件

开发人员和AI工具在生成代码时请严格遵循这些规则。

## 技术栈

- 前端：HTML, CSS, JavaScript
- 后端：Node.js + Express
- 包管理器：pnpm

## 第三方工具来源

以下是项目中使用的第三方工具、CSS和字体等资源的来源链接：

### JavaScript 工具
- **Tailwind CSS** - 用于快速构建现代化界面的实用优先CSS框架
  来源：[https://tailwindcss.com/](https://tailwindcss.com/)
  本地路径：`src/client/assets/js/third_party/tailwindcss.js`

- **lunar.js** - 农历日期计算库
  来源：[https://github.com/6tail/lunar-javascript](https://github.com/6tail/lunar-javascript)
  本地路径：`src/client/assets/js/third_party/lunar.js`

### CSS 框架和图标
- **Font Awesome** - 图标字体库
  来源：[https://fontawesome.com/](https://fontawesome.com/)
  本地路径：`src/client/assets/css/font-awesome.min.css`
  字体文件：`src/client/assets/fonts/fontawesome-webfont.woff2`

### 依赖包
项目使用的主要依赖包（在package.json中定义）：
- **express**: ^4.18.2 - Web应用框架
- **autoprefixer**: ^10.4.21 - 自动添加CSS前缀
- **esbuild**: ^0.25.10 - JavaScript打包工具
- **nodemon**: ^3.0.1 - 开发时自动重启Node.js应用
- **postcss**: ^8.5.6 - CSS处理工具
- **tailwindcss**: ^4.1.13 - CSS框架
## 数据存储
- 任务数据直接保存在服务器文件中，不再使用localStorage
- 节假日数据通过API获取并缓存在服务器端，有效期为100天
- 支持导入和导出todo.txt格式的任务文件

## 模块结构
项目采用模块化设计，主要包含以下几个核心模块：

### 1. todo_manager.js (主模块)
- 负责整体UI渲染和事件处理
- 整合其他模块的功能

### 2. task_parser.js (任务解析模块)
- 解析todo.txt格式文本为任务对象
- 将任务对象转换为todo.txt格式文本
- 处理文件的加载和保存逻辑
- 提供解析错误提示功能

### 3. holiday_manager.js (节假日管理模块)
- 获取和缓存节假日数据
- 提供工作日和节假日检查功能
- 管理缓存刷新逻辑

## 注意事项

1. 项目使用pnpm作为包管理器，确保已安装pnpm或使用提供的start.sh脚本自动安装
2. 节假日数据会缓存到服务器文件中，如需刷新缓存，请点击"刷新节假日缓存"按钮
2. 扫描文件功能可以自动检测并加载同目录下的todo文件
3. 任务数据直接保存到服务器端的todo.txt文件中，无需额外备份