#!/bin/bash
#
# TodoManager - Build Script for macOS, Linux, and Windows
#
# Usage:
#   ./build_app.sh              # Build for current platform
#   ./build_app.sh --macos      # Build for macOS only
#   ./build_app.sh --linux      # Build for Linux only
#   ./build_app.sh --windows    # Build for Windows only
#   ./build_app.sh --clean      # Clean build artifacts
#   ./build_app.sh --verbose    # Show detailed output
#

# 引入公共配置读取脚本
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/config_utils.sh"

# 配置
readonly PROJECT_NAME="TodoManager"
readonly APP_BUNDLE_ID="com.xthuji.todoManager"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# 读取版本信息
readonly VERSION=$(grep -E '^VERSION = ' "${SCRIPT_DIR}/version.txt" | cut -d ' ' -f 3)
readonly BUILD_DIR="${SCRIPT_DIR}/build"
readonly DIST_DIR="${SCRIPT_DIR}/dist"
# 保留的文件和目录模式
readonly RESERVE_FILE_ARRAY=(-macos.dmg -windows.zip -linux.tar.gz)
readonly RESERVE_DIR_ARRAY=(".app")

# 读取配置
PYTHON_PATH=$(read_python_executable)
PIP_PATH=$(read_pip_path)
PYINSTALLER_PATH=$(read_pyinstaller_path)

# 平台检测
PLATFORM="$(uname)"

# 状态变量
VERBOSE=false
BUILD_MACOS=false BUILD_LINUX=false BUILD_WINDOWS=false CLEAN_ONLY=false

# 排除模块列表 - 只排除真正不需要的模块
readonly EXCLUDE_MODULES=(
    # 测试相关
    "test" "tkinter.test" "unittest" "doctest"
    # 调试和分析工具
    "trace" "profile" "pstats" "tabnanny" "pyclbr" "compileall"
    # 模块工具
    "pickletools" "modulefinder" "runpy" "lib2to3"
    # 数据库（项目使用文件存储）
    "sqlite3"
    # 并发（项目使用线程）
    "multiprocessing"
    # 包管理
    "distutils" "setuptools" "pkg_resources"
    # 工具
    "timeit" "optparse"
    # 终端相关
    "tty" "pty" "termios" "readline" "nis" "grp" "pwd" "spwd" "crypt"
    # 自定义模块
    "usercustomize" "sitecustomize"
    # GUI框架（项目使用webview）
    "tkinter" "PyQt5" "gi" "matplotlib" "numpy" "scipy" "pandas"
    # 额外排除模块
    "curses" "dbm"
    "xmlrpc" "httplib2"
    "ftplib" "poplib" "imaplib" "smtplib"
    "telnetlib"
    "PIL" "Pillow" "opencv" "tensorflow" "torch"
    "sqlalchemy" "django" "flask_sqlalchemy"
)

# 日志函数
log() { echo "[INFO] $1"; }
success() { echo "[OK] $1"; }
error() { echo "[ERROR] $1" >&2; }

# 清理函数
clean() {
    rm -rf "${BUILD_DIR}" "${DIST_DIR}" "${SCRIPT_DIR}/${PROJECT_NAME}.spec"
    find "${SCRIPT_DIR}" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find "${SCRIPT_DIR}" -type f -name "*.pyc" -delete 2>/dev/null || true
}

# 检查依赖
check_deps() {
    command -v "$PYTHON_PATH" >/dev/null || { error "Python 3.9+ required"; exit 1; }
    $PYTHON_PATH -m pip show -q pyinstaller 2>/dev/null || $PYTHON_PATH -m pip install -q pyinstaller
}

# PyInstaller 构建函数
pyinstaller_build() {
    local name="$1" icon="$2"
    shift 2
    local extra_args=($@)
    log "构建 ${name} 版本..."

    local args=(--name "${PROJECT_NAME}" --windowed --onedir -y
                --workpath "${BUILD_DIR}"
                --distpath "${DIST_DIR}"
                --upx-dir /usr/local/bin
                --upx-exclude=vcruntime140.dll
                --upx-exclude=msvcp140.dll
                --optimize=2
                --strip
                --noconfirm
                --log-level=ERROR
                --version-file "${SCRIPT_DIR}/version.txt")
    
    # 添加排除模块
    for module in "${EXCLUDE_MODULES[@]}"; do
        args+=(--exclude-module="$module")
    done
    
    # 添加必要的收集
    # 替代 --collect-all，使用 --collect-submodules 来减少不必要的依赖
    args+=(--collect-submodules webview --collect-submodules flask --collect-submodules requests)
    
    # 添加图标
    [[ -n "$icon" ]] && args+=($icon)
    
    # 添加额外参数
    [[ ${#extra_args[@]} -gt 0 ]] && args+=(${extra_args[@]})
    
    # 添加数据和配置文件
    args+=(--add-data "${SCRIPT_DIR}/start.sh:.")
    args+=(--add-data "${SCRIPT_DIR}/config_utils.sh:.")
    # 排除cache和mock目录，只添加其他data目录内容
    args+=(--add-data "${SCRIPT_DIR}/data/config:data/config")
    args+=(--add-data "${SCRIPT_DIR}/data/weather/merged_weather_area_codes.json:data/weather/")
    args+=(--add-data "${SCRIPT_DIR}/data/todo.txt:data/")
    args+=(--add-data "${SCRIPT_DIR}/data/todo.test.txt:data/")
    args+=(--add-data "${SCRIPT_DIR}/static:static")
    # args+=(--add-data "${SCRIPT_DIR}/app:app")
    
    # 添加主脚本
    args+=("${SCRIPT_DIR}/app.py")    
    # 排除所有 .py 源文件，只使用 .pyc 文件
    args+=(--exclude "*.py")
    
    # 添加bundle ID (仅macOS)
    if [[ "$name" == "macOS" ]]; then
        args+=(--osx-bundle-identifier "${APP_BUNDLE_ID}")
    fi

    $PYINSTALLER_PATH "${args[@]}" || { error "${name} 版本构建失败"; exit 1; }
}

# 创建 DMG（macOS）
create_dmg() {
    log "创建 DMG 安装包..."
    
    # 清理并创建 dmg_temp 目录
    rm -rf "${DIST_DIR}/dmg_temp"
    mkdir -p "${DIST_DIR}/dmg_temp"

    if [[ -d "${DIST_DIR}/${PROJECT_NAME}.app" ]]; then
        # 复制 .app 包
        cp -r "${DIST_DIR}/${PROJECT_NAME}.app" "${DIST_DIR}/dmg_temp/"
    else
        error "未找到 .app 包"
        exit 1
    fi

    ln -s /Applications "${DIST_DIR}/dmg_temp/Applications"
    hdiutil create -volname "${PROJECT_NAME}" -srcfolder "${DIST_DIR}/dmg_temp" -ov -format UDZO "${DIST_DIR}/${PROJECT_NAME}-${VERSION}-macos.dmg"
    rm -rf "${DIST_DIR}/dmg_temp"
}

# 创建 tarball（Linux）
create_tarball() {
    log "创建 tarball 压缩包..."
    (cd "${DIST_DIR}" && tar -czf "${PROJECT_NAME}-${VERSION}-linux.tar.gz" "${PROJECT_NAME}")
}

# 创建 zip（Windows）
create_zip() {
    log "创建 ZIP 压缩包..."
    (cd "${DIST_DIR}" && zip -rq "${PROJECT_NAME}-${VERSION}-windows.zip" "${PROJECT_NAME}")
}

# 保留指定文件和目录
keep_artifact() {
    log "清理dist目录，只保留指定文件和目录..."
    
    # 遍历dist目录下的所有第一级文件和目录
    for item in "${DIST_DIR}"/*; do
        if [[ -e "$item" ]]; then
            local basename=$(basename "$item")
            local keep=false
            
            # 检查是否匹配RESERVE_FILE_ARRAY中的模式
            if [[ -f "$item" ]]; then
                for pattern in "${RESERVE_FILE_ARRAY[@]}"; do
                    if [[ "$basename" == *"$pattern" ]]; then
                        keep=true
                        break
                    fi
                done
            
            # 检查是否匹配RESERVE_DIR_ARRAY中的模式
            elif [[ -d "$item" ]]; then
                for pattern in "${RESERVE_DIR_ARRAY[@]}"; do
                    if [[ "$basename" == *"$pattern" ]]; then
                        keep=true
                        break
                    fi
                done
            fi
            
            # 如果不需要保留，则删除
            if [[ "$keep" == false ]]; then
                log "删除不需要的项: $basename"
                rm -rf "$item"
            else
                log "保留项: $basename"
            fi
        fi
    done
}

# 清理.py文件，只保留.pyc文件
clean_py_files() {
    log "清理.py文件，只保留.pyc文件..."
    # 删除所有.py文件
    find "${DIST_DIR}" -type f -name "*.py" -delete 2>/dev/null
    # 确保.pyc文件存在
    find "${DIST_DIR}" -type f -name "*.pyc" | head -5 && log "确认.pyc文件存在"
}

# 最终清理
final_cleanup() {
    # 清理临时文件
    rm -rf "${DIST_DIR}/dmg_temp"
    rm -f "${SCRIPT_DIR}/${PROJECT_NAME}.spec"
    find "${SCRIPT_DIR}" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    
    # 清理构建目录
    rm -rf "${BUILD_DIR}"
    
    # 清理.py文件，只保留.pyc文件
    clean_py_files
    
    # 保留指定的文件和目录
    keep_artifact
}

# 构建 macOS 版本
build_macos() {
    check_deps
    pyinstaller_build "macOS" "--icon ${SCRIPT_DIR}/icons/icon.icns"
    
    # 更新 .app 包中的版本号
    log "更新 .app 包中的版本号..."
    PLIST_FILE="${DIST_DIR}/${PROJECT_NAME}.app/Contents/Info.plist"
    if [[ -f "$PLIST_FILE" ]]; then
        # 使用 plistbuddy 更新或添加版本号
        /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString ${VERSION}" "$PLIST_FILE" || \
        /usr/libexec/PlistBuddy -c "Add :CFBundleShortVersionString string ${VERSION}" "$PLIST_FILE"
        log "版本号已更新为 ${VERSION}"
    else
        error "未找到 Info.plist 文件"
    fi
    
    create_dmg
    final_cleanup
    success "${DIST_DIR}/${PROJECT_NAME}-${VERSION}-macos.dmg"
}

# 构建 Linux 版本
build_linux() {
    check_deps
    pyinstaller_build "Linux" "--icon ${SCRIPT_DIR}/icons/icon_256x256.png"
    create_tarball
    final_cleanup
    success "${DIST_DIR}/${PROJECT_NAME}-${VERSION}-linux.tar.gz"
}

# 构建 Windows 版本
build_windows() {
    check_deps
    pyinstaller_build "Windows" "--icon ${SCRIPT_DIR}/icons/icon.ico"
    create_zip
    final_cleanup
    success "${DIST_DIR}/${PROJECT_NAME}-${VERSION}-windows.zip"
}

# 帮助信息
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Options:
  --macos, -m     构建 macOS 版本
  --linux, -l     构建 Linux 版本
  --windows, -w   构建 Windows 版本
  --clean, -c     仅清理构建产物
  --verbose, -v   显示详细输出
  --help, -h      显示帮助信息

示例:
  $0 -m           # 构建 macOS 版本
  $0 -l -v        # 构建 Linux 版本并显示详细输出
  $0 -c           # 清理构建文件
EOF
}

# 解析命令行参数
if [[ $# -eq 0 ]]; then
    case "$PLATFORM" in
        Darwin)  BUILD_MACOS=true ;;
        Linux)   BUILD_LINUX=true ;;
        *)       BUILD_WINDOWS=true ;;
    esac
fi

while [[ $# -gt 0 ]]; do
    case "$1" in
        --macos|-m) BUILD_MACOS=true; shift ;;
        --linux|-l) BUILD_LINUX=true; shift ;;
        --windows|-w) BUILD_WINDOWS=true; shift ;;
        --clean|-c) CLEAN_ONLY=true; shift ;;
        --verbose|-v) VERBOSE=true; shift ;;
        --help|-h) usage; exit 0 ;;
        *) error "未知选项: $1"; usage; exit 1 ;;
    esac
done

# 主逻辑
if [[ "$CLEAN_ONLY" == true ]]; then 
    clean 
    success "清理完成"
    exit 0
fi

if [[ "$BUILD_MACOS" == false && "$BUILD_LINUX" == false && "$BUILD_WINDOWS" == false ]]; then
    error "未指定平台。使用 -m, -l 或 -w"
    exit 1
fi

# 创建目录
mkdir -p "${BUILD_DIR}" "${DIST_DIR}"

# 清理
clean

# 安装依赖
log "正在安装依赖..."
$PIP_PATH install -r requirements.txt

# 预编译字节码
log "正在预编译字节码..."
$PYTHON_PATH -m compileall -b .

# 构建
if [[ "$BUILD_MACOS" == true ]]; then build_macos; fi
if [[ "$BUILD_LINUX" == true ]]; then build_linux; fi
if [[ "$BUILD_WINDOWS" == true ]]; then build_windows; fi

exit 0