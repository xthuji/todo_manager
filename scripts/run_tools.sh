#!/usr/bin/env bash
# =============================================================================
# TodoManager - 构建与运行工具 (跨平台: macOS / Linux / Windows Git Bash)
# =============================================================================
# 命令:
#   1|b,build     构建桌面应用 (自动适配当前平台)
#   2|r,run       构建并前台运行桌面 App (Ctrl+C 关闭)
#   3|s,server    构建并前台运行纯 HTTP 服务端 (无 GUI)
#   4|d,dev       开发模式: go run 服务端 + 浏览器访问
#   5|t,test      运行 Go 单元测试
#   6|c,clean     清理构建产物
#   0|q|exit        退出
# =============================================================================
# 薄入口：公共实现全部在 run_tools_master.sh（跨项目逐字节一致，禁止单项目
# 私改），项目差异全部写在本文件的「常量与命令表」与「项目专属实现」内联区；
# 全部构建/打包/测试逻辑集中在这里，CI workflow 只做 runner 引导与产物上传
#（规范 4.2）。
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# ============================================================
# 公共模块：母版实现（与其余桌面应用逐字节一致，请勿在此修改）
# 先于常量区加载：母版只定义函数不执行业务，差异常量声明在下一区
# ============================================================
source "$SCRIPT_DIR/run_tools_master.sh"
# ============================================================
# 项目差异区 · 常量与命令表（脚本唯一需要按项目调整的部分）
# ============================================================

# --- 项目标识 ---
APP_NAME="TodoManager"                    # 可执行文件 / Wails outputfilename
BUNDLE_NAME=""              # .app bundle 名（留空同 APP_NAME）
RELEASE_PREFIX=""        # release/ 产物命名前缀（留空同 APP_NAME）
APP_DISPLAY_NAME="TodoManager"
PROJECT_BUNDLE_ID="com.xthuji.todomanager"
export PROJECT_BUNDLE_ID

# --- 目录与产物 ---
BUILD_DIR="$PROJECT_DIR/build"
FRONTEND_DIR="$PROJECT_DIR/static"
# 产物目录：默认 <frontend_dir>/dist；Vite outDir 指到别处（如 easy_diff 直写 embed
# 目录 frontend/dist）时必须按项目覆盖，否则母版 ensure_frontend 会误判为未构建
FRONTEND_DIST="$FRONTEND_DIR/dist"
WAILS_CMD=""
VERSION=""

# --- 构建策略 ---
IS_WAILS=0                     # 0=纯 Go 桌面（自行覆盖 build_impl / get_app_bundle）
PLATFORM_SCOPE="all"        # darwin=仅面向 macOS 产物
MACOS_MIN_VERSION="12.0"
MACOS_UNIVERSAL_DEFAULT=1     # 1=恒产 universal；0=本地单架构 + 环境变量开关
UNIVERSAL_ENV_VAR=""     # 例：EASYDIFF_UNIVERSAL
WAILS_BUILD_CLEAN=0
WAILS_PIN_VERSION=""                    # 留空=对齐 go.mod 的 wails 版本（真源）
NEEDS_CGO=1                   # 1=Windows 构建需要 MinGW-w64
ADHOC_SIGN=1                      # 1=macOS 构建后 ad-hoc 签名
GO_BUILD_LDFLAGS="-s -w"
VERSION_LD_VAR="main.Version"        # 版本注入的 Go 变量（ldflags -X）
LDFLAGS_EXTRA=""
GOTOOLCHAIN_VER=""

# --- 资源与配置 ---
CONFIG_SRC=""
CONFIG_DEST_DIR=""
ICON_SRC="$PROJECT_DIR/icons/icon.icns"

# --- 菜单与分发 ---
DEFAULT_CMD="run"
FALLBACK_CMD=""
SRC_FIND_EXPR=( -name '*.go' -o -path '*/static/*' -o -name 'VERSION' -o -name 'go.mod' )             # needs_build 的源文件匹配表达式
TEST_PKGS=( ./... )
CLEAN_EXTRA=(  )
DEV_CMD=( go run ./app/cmd/server )                    # 留空=母版默认 wails dev

# --- 命令表：序号|别名(逗号分隔)|说明|处理函数（菜单/帮助/分发唯一真源）---
commands=(
  "1|b,build|构建桌面应用 (自动适配当前平台)|cmd_build"
  "2|r,run|构建并前台运行桌面 App (Ctrl+C 关闭)|cmd_run"
  "3|s,server|构建并前台运行纯 HTTP 服务端 (无 GUI)|cmd_server"
  "4|d,dev|开发模式: go run 服务端 + 浏览器访问|cmd_dev"
  "5|t,test|运行 Go 单元测试|cmd_test"
  "6|c,clean|清理构建产物|cmd_clean"
)

# ============================================================
# 项目专属实现（覆盖母版默认 / 追加项目专属命令）
# 内联区位于常量表之后、main "$@" 之前：顶层可安全展开差异常量
# ============================================================
# 纯 Go 桌面应用（非 Wails）：手工搭 .app bundle + 双架构 lipo + ad-hoc 签名，
# 因此覆盖母版的 build_impl / get_app_bundle / get_build_binary / package_platform。
# .app 属 build/ 下中间产物，release/ 只留最终归档（DMG / tar.gz / zip）。
get_app_bundle() {
  echo "$BUILD_DIR/desktop/${APP_NAME}.app"
}

get_build_binary() {
  if [ "$HOST_OS" = "darwin" ]; then
    echo "$BUILD_DIR/desktop/${APP_NAME}"
  else
    echo "$BUILD_DIR/desktop/${APP_NAME}${EXT}"
  fi
}

get_server_binary() {
  echo "$BUILD_DIR/server/${APP_NAME}-server${EXT}"
}

get_run_binary() {
  if [ "$HOST_OS" = "darwin" ]; then
    echo "$(get_app_bundle)/Contents/MacOS/${APP_NAME}"
  else
    echo "$(get_build_binary)"
  fi
}

build_impl() {
  local ldflags="$1"
  mkdir -p "$BUILD_DIR/desktop"

  if [ "$HOST_OS" = "darwin" ]; then
    build_macos_universal "$ldflags"
  else
    local goos="linux"
    [ "$HOST_OS" = "windows" ] && goos="windows"
    log_info "构建桌面应用 ($goos/$HOST_ARCH, CGO=1)..."
    run env GOOS="$goos" GOARCH="$HOST_ARCH" CGO_ENABLED=1 \
      go build -ldflags "$ldflags" -o "$(get_build_binary)" ./app/cmd/desktop
    log_success "二进制 → $(get_build_binary)"
  fi
}

# macOS 双架构分别编译后 lipo 合并（Go 交叉编译带 CGO 必须逐架构指定 clang -arch）
build_macos_universal() {
  local ldflags="$1"
  local arch_bins=() arch
  for arch in amd64 arm64; do
    local cgo_arch="x86_64"
    [ "$arch" = "arm64" ] && cgo_arch="arm64"
    log_info "  GOOS=darwin GOARCH=$arch (clang -arch $cgo_arch, min=$MACOS_MIN_VERSION)"
    run env GOOS=darwin GOARCH="$arch" CGO_ENABLED=1 \
      CC="clang -arch $cgo_arch" CXX="clang++ -arch $cgo_arch" \
      CGO_CFLAGS="-arch $cgo_arch -mmacosx-version-min=$MACOS_MIN_VERSION" \
      CGO_CXXFLAGS="-arch $cgo_arch -mmacosx-version-min=$MACOS_MIN_VERSION" \
      CGO_LDFLAGS="-arch $cgo_arch -mmacosx-version-min=$MACOS_MIN_VERSION" \
      go build -ldflags "$ldflags" -o "$BUILD_DIR/desktop/${APP_NAME}-$arch" ./app/cmd/desktop
    arch_bins+=("$BUILD_DIR/desktop/${APP_NAME}-$arch")
  done
  if $DRY_RUN; then return 0; fi
  lipo -create -output "$(get_build_binary)" "${arch_bins[@]}" || log_error "lipo 合并失败"
  rm -f "${arch_bins[@]}"
  lipo -info "$(get_build_binary)" || true
  log_success "universal 二进制 → $(get_build_binary)"
  make_app_bundle "$ldflags"
}

# 手工搭 .app bundle：可执行文件 + 图标 + static/ + data 只读子集 + Info.plist
make_app_bundle() {
  local version; version=$(get_version)
  local app_bundle; app_bundle=$(get_app_bundle)
  local contents="$app_bundle/Contents"
  local macos_bin="$contents/MacOS/${APP_NAME}"
  local resources="$contents/Resources"

  rm -rf "$app_bundle"
  mkdir -p "$(dirname "$macos_bin")" "$resources"
  cp "$(get_build_binary)" "$macos_bin"
  chmod +x "$macos_bin"

  [ -f "$PROJECT_DIR/icons/icon.icns" ] && cp "$PROJECT_DIR/icons/icon.icns" "$resources/icon.icns"
  [ -d "$PROJECT_DIR/static" ] && cp -R "$PROJECT_DIR/static" "$resources/"
  if [ -d "$PROJECT_DIR/data" ]; then
    mkdir -p "$resources/data"
    local sub
    for sub in config weather; do
      [ -d "$PROJECT_DIR/data/$sub" ] && cp -R "$PROJECT_DIR/data/$sub" "$resources/data/"
    done
    [ -f "$PROJECT_DIR/data/todo.txt" ] && cp "$PROJECT_DIR/data/todo.txt" "$resources/data/"
    [ -f "$PROJECT_DIR/data/todo.test.txt" ] && cp "$PROJECT_DIR/data/todo.test.txt" "$resources/data/"
  fi

  cat > "$contents/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key><string>${APP_NAME}</string>
    <key>CFBundleDisplayName</key><string>${APP_NAME}</string>
    <key>CFBundleIdentifier</key><string>${PROJECT_BUNDLE_ID}</string>
    <key>CFBundleShortVersionString</key><string>${version}</string>
    <key>CFBundleVersion</key><string>${version}</string>
    <key>CFBundleExecutable</key><string>${APP_NAME}</string>
    <key>CFBundleIconFile</key><string>icon</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleSignature</key><string>????</string>
    <key>LSMinimumSystemVersion</key><string>${MACOS_MIN_VERSION}</string>
    <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST
  log_success "App bundle → $app_bundle"
}

# macOS 只发 DMG；Linux 发 tar.gz；Windows 发 zip（与 CI 产物 glob 对齐）
package_platform() {
  local version; version=$(get_version)
  if [ "$HOST_OS" = "darwin" ]; then
    # 保留 build 下的 .app：后端增量构建依赖它判断产物是否存在，
    # 打包完成后删除会让每次 build 都退化为全量编译
    build_dmg
  else
    local archive
    if [ "$HOST_OS" = "windows" ]; then
      archive="${APP_NAME}_v${version}_windows_${HOST_ARCH}.zip"
    else
      archive="${APP_NAME}_v${version}_linux_${HOST_ARCH}.tar.gz"
    fi
    # dry-run 下不装配归档：下面的 cp/tar/zip 不走 run，真实执行会写 release/
    if $DRY_RUN; then
      log_warn "[dry-run] 装配 ${HOST_OS}/${HOST_ARCH} 归档 → release/${archive}（含 static 与 data/）"
      return 0
    fi
    local stage="$BUILD_DIR/stage"
    rm -rf "$stage"; mkdir -p "$stage/data"
    cp -f "$(get_build_binary)" "$stage/"
    [ -d "$PROJECT_DIR/static" ] && cp -R "$PROJECT_DIR/static" "$stage/"
    local sub
    for sub in config weather; do
      [ -d "$PROJECT_DIR/data/$sub" ] && cp -R "$PROJECT_DIR/data/$sub" "$stage/data/"
    done
    [ -f "$PROJECT_DIR/data/todo.txt" ] && cp "$PROJECT_DIR/data/todo.txt" "$stage/"

    mkdir -p "$PROJECT_DIR/release"
    if [ "$HOST_OS" = "windows" ]; then
      if command -v zip &>/dev/null; then
        (cd "$stage" && zip -rq "$PROJECT_DIR/release/$archive" .) || log_error "zip 打包失败"
      else
        powershell -NoProfile -NonInteractive -Command \
          "Compress-Archive -Path '$(cygpath -w "$stage")\\*' -DestinationPath '$(cygpath -w "$PROJECT_DIR/release/$archive")' -Force" \
          || log_error "Compress-Archive 打包失败"
      fi
    else
      (cd "$stage" && tar -czf "$PROJECT_DIR/release/$archive" .) || log_error "tar 打包失败"
    fi
    rm -rf "$stage"
    log_success "Archive → $PROJECT_DIR/release/$archive"
  fi
}

cmd_server() {
  check_go
  kill_existing
  mkdir -p "$BUILD_DIR/server"

  local version; version=$(get_version)
  local bin; bin=$(get_server_binary)
  log_info "构建 HTTP 服务端 (version=$version)..."
  run go build -ldflags "-s -w -X main.Version=${version}" -o "$bin" ./app/cmd/server
  if $DRY_RUN; then return 0; fi

  export GIN_MODE=release
  log_info "启动服务端: http://localhost:3030"
  log_info "按 Ctrl+C 停止"
  echo ""
  run "$bin"
}

# Windows 下 Git Bash 直接执行 exe 不会等待，需 cmd.exe /c start /wait
cmd_run() {
  if needs_build; then
    cmd_build
  else
    log_success "源文件无变化，跳过构建"
  fi
  kill_existing

  local exe; exe=$(get_run_binary)
  if $DRY_RUN; then
    log_warn "[dry-run] $exe"
    return 0
  fi
  [ -x "$exe" ] || log_error "未找到可运行产物：$exe"
  log_info "启动桌面 App (前台模式)，按 Ctrl+C 关闭"
  if [ "$HOST_OS" = "windows" ]; then
    cmd.exe /c start /wait "" "$(cygpath -w "$exe" 2>/dev/null || echo "$exe")" || "$exe"
  else
    "$exe"
  fi
}

main "$@"
