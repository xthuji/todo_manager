#!/bin/bash
#
# TodoManager - Build Script for Go (macOS, Linux, and Windows)
# 用途：构建和打包桌面应用（使用 webview_go）
#
# Usage:
#   ./build.sh              # Build for current platform
#   ./build.sh --macos      # Build for macOS only
#   ./build.sh --linux      # Build for Linux only
#   ./build.sh --windows    # Build for Windows only
#   ./build.sh --dmg        # Build DMG without interactive prompt (for CI)
#   ./build.sh --clean      # Clean build artifacts
#   ./build.sh --verbose    # Show detailed output
#

# 获取当前脚本所在目录（必须在使用前定义）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# 切换到脚本所在目录，确保程序能正确找到相对路径的配置文件
cd "$SCRIPT_DIR" || exit 1

# 配置
readonly PROJECT_NAME="TodoManager"
readonly APP_BUNDLE_ID="com.xthuji.todoManager"
# 读取版本信息
readonly VERSION=$(grep -E '^VERSION = ' "${SCRIPT_DIR}/version.txt" | cut -d ' ' -f 3)
readonly BUILD_DIR="${SCRIPT_DIR}/build"
readonly DIST_DIR="${SCRIPT_DIR}/dist"

# 平台检测
PLATFORM="$(uname)"

# 状态变量
VERBOSE=false
BUILD_DMG=false
BUILD_MACOS=false BUILD_LINUX=false BUILD_WINDOWS=false CLEAN_ONLY=false

# 保留的文件和目录模式（清理后保留的打包文件）
readonly RESERVE_FILE_ARRAY=(-macos.dmg -windows.zip -linux.tar.gz)
readonly RESERVE_DIR_ARRAY=(".app")

# 日志函数
log() { echo "[INFO] $1"; }
success() { echo "[OK] $1"; }
error() { echo "[ERROR] $1" >&2; }
verbose_log() { [[ "$VERBOSE" == true ]] && echo "[DEBUG] $1"; }

# 清理构建目录
clean() {
    log "清理构建目录..."
    rm -rf "${BUILD_DIR}" "${DIST_DIR}"
    rm -f "${SCRIPT_DIR}/${PROJECT_NAME}.spec"
    log "清理完成"
}

# 检查依赖
check_deps() {
    # 检查Go
    command -v go >/dev/null || { error "Go is required"; exit 1; }
    verbose_log "Go version: $(go version)"
}

# 安装Go依赖
install_deps() {
    log "安装Go依赖..."
    cd "${SCRIPT_DIR}" || exit 1
    go mod tidy || { error "go mod tidy失败"; exit 1; }
    success "依赖安装完成"
}

# 构建函数
go_build() {
    local platform="$1"
    log "构建 ${platform} 版本..."

    cd "${SCRIPT_DIR}" || exit 1

    local output_name="${PROJECT_NAME}"
    # -s: 去除符号表, -w: 去除DWARF调试信息
    local ldflags="-s -w -X main.Version=${VERSION}"

    # 设置交叉编译环境变量
    case "$platform" in
        "macOS")
            export GOOS=darwin
            output_name="${PROJECT_NAME}"
            ;;
        "Linux")
            export GOOS=linux
            export GOARCH=amd64
            output_name="${PROJECT_NAME}"
            ;;
        "Windows")
            export GOOS=windows
            export GOARCH=amd64
            output_name="${PROJECT_NAME}.exe"
            ;;
    esac

    # macOS 构建 universal 二进制（amd64 + arm64 通过 lipo 合并）
    if [[ "$platform" == "macOS" ]]; then
        local arch_bins=()
        for arch in amd64 arm64; do
            export GOARCH="${arch}"
            # webview_go 依赖 cgo；在非本机架构（如 arm64 主机上编译 amd64）时，
            # Go 会默认禁用 cgo 导致 "build constraints exclude all Go files"，需显式开启
            export CGO_ENABLED=1
            verbose_log "GOOS=${GOOS} GOARCH=${arch} CGO_ENABLED=1"
            go build -ldflags "${ldflags}" -o "${DIST_DIR}/${PROJECT_NAME}-${arch}" ./app/cmd/desktop || {
                error "${platform} (${arch}) 版本构建失败"
                exit 1
            }
            unset GOARCH CGO_ENABLED
            arch_bins+=("${DIST_DIR}/${PROJECT_NAME}-${arch}")
        done

        lipo -create -output "${DIST_DIR}/${output_name}" "${arch_bins[@]}" || {
            error "lipo 合并 universal 二进制失败"
            exit 1
        }
        rm -f "${arch_bins[@]}"
    else
        verbose_log "GOOS=${GOOS} GOARCH=${GOARCH}"
        verbose_log "执行: go build -ldflags '${ldflags}' -o ${DIST_DIR}/${output_name} ./app/cmd/desktop"

        # 执行构建，编译app/cmd/desktop目录中的文件
        go build -ldflags "${ldflags}" -o "${DIST_DIR}/${output_name}" ./app/cmd/desktop || {
            error "${platform} 版本构建失败"
            exit 1
        }

        # 恢复GOOS/GOARCH
        unset GOOS GOARCH
    fi

    if [[ -f "${DIST_DIR}/${output_name}" ]]; then
        chmod +x "${DIST_DIR}/${output_name}"
        success "${platform} 版本构建成功: ${DIST_DIR}/${output_name}"
        lipo -info "${DIST_DIR}/${output_name}" 2>/dev/null || true
        ls -lh "${DIST_DIR}/${output_name}"
    else
        error "未找到构建产物"
        exit 1
    fi
}

# 创建 macOS .app 包
create_macos_app_bundle() {
    log "创建 macOS .app 包..."

    local app_bundle="${DIST_DIR}/${PROJECT_NAME}.app"
    local contents_dir="${app_bundle}/Contents"
    local macos_dir="${contents_dir}/MacOS"
    local resources_dir="${contents_dir}/Resources"

    # 清理并创建目录结构
    rm -rf "${app_bundle}"
    mkdir -p "${macos_dir}" "${resources_dir}"

    # 复制可执行文件
    if [[ -f "${DIST_DIR}/${PROJECT_NAME}" ]]; then
        cp "${DIST_DIR}/${PROJECT_NAME}" "${macos_dir}/${PROJECT_NAME}"
        chmod +x "${macos_dir}/${PROJECT_NAME}"
    else
        error "未找到可执行文件"
        exit 1
    fi

    # 复制图标文件
    if [[ -f "${SCRIPT_DIR}/icons/icon.icns" ]]; then
        cp "${SCRIPT_DIR}/icons/icon.icns" "${resources_dir}/icon.icns"
    fi

    # 复制 static 和 data 目录到 Resources
    if [[ -d "${SCRIPT_DIR}/static" ]]; then
        cp -r "${SCRIPT_DIR}/static" "${resources_dir}/static"
    fi

    if [[ -d "${SCRIPT_DIR}/data" ]]; then
        # 排除 cache 和 mock 目录
        mkdir -p "${resources_dir}/data"
        cp -r "${SCRIPT_DIR}/data/config" "${resources_dir}/data/" 2>/dev/null || true
        cp -r "${SCRIPT_DIR}/data/weather" "${resources_dir}/data/" 2>/dev/null || true
        cp "${SCRIPT_DIR}/data/todo.txt" "${resources_dir}/data/" 2>/dev/null || true
        cp "${SCRIPT_DIR}/data/todo.test.txt" "${resources_dir}/data/" 2>/dev/null || true
    fi

    # 创建 Info.plist
    cat > "${contents_dir}/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>${PROJECT_NAME}</string>
    <key>CFBundleDisplayName</key>
    <string>${PROJECT_NAME}</string>
    <key>CFBundleIdentifier</key>
    <string>${APP_BUNDLE_ID}</string>
    <key>CFBundleShortVersionString</key>
    <string>${VERSION}</string>
    <key>CFBundleVersion</key>
    <string>${VERSION}</string>
    <key>CFBundleExecutable</key>
    <string>${PROJECT_NAME}</string>
    <key>CFBundleIconFile</key>
    <string>icon</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleSignature</key>
    <string>????</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

    log ".app 包创建成功: ${app_bundle}"
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

    # 创建 Applications 快捷方式
    ln -s /Applications "${DIST_DIR}/dmg_temp/Applications"

    hdiutil create -volname "${PROJECT_NAME}" \
        -srcfolder "${DIST_DIR}/dmg_temp" \
        -ov -format UDZO \
        "${DIST_DIR}/${PROJECT_NAME}-${VERSION}-macos.dmg" || {
        error "DMG创建失败"
        exit 1
    }

    # 清理临时目录
    rm -rf "${DIST_DIR}/dmg_temp"
    success "DMG创建成功: ${DIST_DIR}/${PROJECT_NAME}-${VERSION}-macos.dmg"
}

# 创建 tarball（Linux）
create_tarball() {
    log "创建 tarball 压缩包..."
    if [[ -f "${DIST_DIR}/${PROJECT_NAME}" ]]; then
        (cd "${DIST_DIR}" && tar -czf "${PROJECT_NAME}-${VERSION}-linux.tar.gz" "${PROJECT_NAME}") || {
            error "tarball创建失败"
            exit 1
        }
        success "tarball创建成功: ${DIST_DIR}/${PROJECT_NAME}-${VERSION}-linux.tar.gz"
    else
        error "未找到可执行文件"
        exit 1
    fi
}

# 创建 zip（Windows）
create_zip() {
    log "创建 ZIP 压缩包..."
    if [[ -f "${DIST_DIR}/${PROJECT_NAME}.exe" ]]; then
        (cd "${DIST_DIR}" && zip -rq "${PROJECT_NAME}-${VERSION}-windows.zip" "${PROJECT_NAME}.exe") || {
            error "zip创建失败"
            exit 1
        }
        success "zip创建成功: ${DIST_DIR}/${PROJECT_NAME}-${VERSION}-windows.zip"
    else
        error "未找到可执行文件"
        exit 1
    fi
}

# 保留指定文件和目录（清理dist目录）
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
                verbose_log "删除不需要的项: $basename"
                rm -rf "$item"
            else
                verbose_log "保留项: $basename"
            fi
        fi
    done
}

# 最终清理
final_cleanup() {
    # 清理临时文件
    rm -rf "${DIST_DIR}/dmg_temp"

    # 清理构建目录
    rm -rf "${BUILD_DIR}"

    # 保留指定的文件和目录
    keep_artifact
}

# 构建 macOS 版本
build_macos() {
    check_deps
    go_build "macOS"
    create_macos_app_bundle

    # 选择是否构建 DMG 安装包（--dmg 直接构建；交互终端下询问；CI 非交互跳过）
    if [[ "$BUILD_DMG" == true ]]; then
        log "构建 DMG 安装包"
        create_dmg
    elif [[ "$CLEAN_ONLY" == false && -t 0 ]]; then
        read -p "是否构建 DMG 安装包？（y/n 默认n）：" build_type
        if [[ "$build_type" == "y" ]]; then
            log "构建 DMG 安装包"
            create_dmg
        fi
    fi

    final_cleanup
    success "macOS 版本构建完成"
}

# 构建 Linux 版本
build_linux() {
    check_deps
    go_build "Linux"
    create_tarball
    final_cleanup
    success "Linux 版本构建完成: ${DIST_DIR}/${PROJECT_NAME}-${VERSION}-linux.tar.gz"
}

# 构建 Windows 版本
build_windows() {
    check_deps
    go_build "Windows"
    create_zip
    final_cleanup
    success "Windows 版本构建完成: ${DIST_DIR}/${PROJECT_NAME}-${VERSION}-windows.zip"
}

# 帮助信息
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Options:
  --macos, -m     构建 macOS 版本（universal: amd64 + arm64）
  --linux, -l     构建 Linux 版本
  --windows, -w   构建 Windows 版本
  --dmg, -d       构建 DMG 安装包（跳过交互询问，供 CI 使用）
  --clean, -c     仅清理构建产物
  --verbose, -v   显示详细输出
  --help, -h      显示帮助信息

示例:
  $0 -m           # 构建 macOS 版本
  $0 -l -v        # 构建 Linux 版本并显示详细输出
  $0 -c           # 清理构建文件
  $0 -m -l -w     # 构建所有平台版本
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
        --dmg|-d) BUILD_DMG=true; shift ;;
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

# 安装依赖
install_deps

# 构建
if [[ "$BUILD_MACOS" == true ]]; then build_macos; fi
if [[ "$BUILD_LINUX" == true ]]; then build_linux; fi
if [[ "$BUILD_WINDOWS" == true ]]; then build_windows; fi

exit 0
