#!/usr/bin/env bash
# =============================================================================
# TodoManager - 构建与运行工具 (跨平台: macOS / Linux / Windows Git Bash)
# =============================================================================
# 命令:
#   1|b|build      构建桌面应用 (自动适配当前平台)
#   2|r|run        构建并前台运行桌面 App (Ctrl+C 关闭)
#   3|s|server     构建并前台运行纯 HTTP 服务端 (无 GUI)
#   4|t|test       运行 Go 单元测试
#   5|c|clean      清理构建产物
#   0|q|exit       退出
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# --- 项目常量 ---
APP_NAME="TodoManager"
APP_BUNDLE_ID="com.xthuji.todomanager"
BUILD_DIR="$PROJECT_DIR/build"
DIST_DIR="$PROJECT_DIR/dist"
VERSION=""

# --- 平台检测 ---
HOST_OS=""
HOST_ARCH=""
EXT=""

detect_platform() {
  local os
  os="$(uname -s 2>/dev/null || echo "unknown")"
  case "$os" in
    Darwin*)  HOST_OS="darwin"  ;;
    Linux*)   HOST_OS="linux"   ;;
    MINGW*|MSYS*|CYGWIN*) HOST_OS="windows" ;;
    *)        HOST_OS="unknown" ;;
  esac

  local arch
  arch="$(uname -m 2>/dev/null || echo "unknown")"
  case "$arch" in
    x86_64|amd64)   HOST_ARCH="amd64" ;;
    arm64|aarch64)  HOST_ARCH="arm64" ;;
    *)              HOST_ARCH="amd64" ;;
  esac

  if [ "$HOST_OS" = "windows" ]; then
    EXT=".exe"
  else
    EXT=""
  fi
}

detect_platform

# --- 彩色输出 ---
BLUE='\033[0;34m'; GREEN='\033[0;32m'; RED='\033[0;31m'
YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'
log_info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[OK]${NC} $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ============================================================
# 依赖检查与构建依赖准备
# ============================================================
check_go() {
  command -v go &>/dev/null || log_error "Go 未安装 (https://go.dev/dl)"
}

# 非 root 且有 sudo 时才用 sudo（CI runner 上是免密 sudo）
SUDO=""
if [ "$(id -u 2>/dev/null || echo 0)" != "0" ] && command -v sudo &>/dev/null; then
  SUDO="sudo"
fi

APT_INDEX_REFRESHED=0
apt_refresh_once() {
  [ "${APT_INDEX_REFRESHED:-0}" = "1" ] && return 0
  if ! command -v apt-get &>/dev/null; then
    log_warn "当前系统未检测到 apt-get，跳过自动依赖安装。请确保已手动安装: pkg-config libgtk-3-dev libwebkit2gtk-4.1-dev"
    return 1
  fi
  APT_INDEX_REFRESHED=1
  log_info "刷新 apt 索引 ..."
  $SUDO apt-get update -qq || log_warn "apt-get update 未完全成功，继续尝试安装"
  return 0
}

apt_has() {
  apt_refresh_once || return 1
  apt-cache show "$1" >/dev/null 2>&1
}

apt_install() {
  apt_refresh_once || return 1
  log_info "安装构建依赖: $*"
  # shellcheck disable=SC2086
  $SUDO apt-get install -y --no-install-recommends "$@" || log_error "apt-get install 失败: $*"
}

ensure_linux_deps() {
  local need=() webkit_alias=0

  command -v pkg-config &>/dev/null        || need+=("pkg-config")
  command -v gcc &>/dev/null               || need+=("build-essential")
  pkg-config --exists gtk+-3.0 2>/dev/null || need+=("libgtk-3-dev")

  if pkg-config --exists webkit2gtk-4.0 2>/dev/null; then
    : # 已可用
  elif pkg-config --exists webkit2gtk-4.1 2>/dev/null; then
    webkit_alias=1
  elif apt_has libwebkit2gtk-4.1-dev; then
    need+=("libwebkit2gtk-4.1-dev"); webkit_alias=1
  elif apt_has libwebkit2gtk-4.0-dev; then
    need+=("libwebkit2gtk-4.0-dev")
  else
    log_warn "未能自动匹配到 libwebkit2gtk 包，请确认开发环境依赖"
  fi

  [ ${#need[@]} -eq 0 ] || apt_install "${need[@]}"

  if [ "$webkit_alias" = "1" ]; then
    local pc_dir
    pc_dir="$(pkg-config --variable=pcfiledir webkit2gtk-4.1 2>/dev/null || true)"
    if [ -n "$pc_dir" ] && [ -f "$pc_dir/webkit2gtk-4.1.pc" ]; then
      if [ ! -f "$pc_dir/webkit2gtk-4.0.pc" ]; then
        log_info "生成 webkit2gtk-4.0.pc 兼容别名 → $pc_dir"
        $SUDO cp "$pc_dir/webkit2gtk-4.1.pc" "$pc_dir/webkit2gtk-4.0.pc" \
          || log_warn "无法写入 .pc 别名，构建可能会因缺失 pkg-config 配置而失败"
      fi
    else
      log_warn "未定位到 webkit2gtk-4.1.pc（pcfiledir=$pc_dir）"
    fi
  fi

  if ! pkg-config --cflags --libs gtk+-3.0 webkit2gtk-4.0 >/dev/null 2>&1; then
    log_error "pkg-config 无法解析 gtk+-3.0/webkit2gtk-4.0：$(pkg-config --errors --exists gtk+-3.0 webkit2gtk-4.0 2>&1 | head -3)"
  fi
  log_success "Linux 构建依赖就绪 (webkit2gtk-4.0 → $(pkg-config --modversion webkit2gtk-4.0))"
}

MINGW_DIRS=(
  /c/msys64/ucrt64/bin
  /c/msys64/mingw64/bin
  /c/tools/mingw64/bin
  /c/mingw64/bin
  /c/TDM-GCC-64/bin
)

locate_mingw() {
  if command -v gcc &>/dev/null; then
    log_info "gcc 已就绪: $(command -v gcc)"
    return 0
  fi
  local d
  for d in "${MINGW_DIRS[@]}"; do
    if [ -x "$d/gcc.exe" ] || [ -x "$d/gcc" ]; then
      export PATH="$d:$PATH"
      gcc --version >/dev/null 2>&1 || { PATH="${PATH#$d:}"; return 1; }
      log_info "将 MinGW-w64 加入 PATH: $d"
      return 0
    fi
  done
  return 1
}

ensure_windows_deps() {
  locate_mingw && return 0
  command -v choco &>/dev/null || log_error "未找到 gcc（CGO 必需）。请安装 MinGW-w64 并保证其在 PATH 中"
  log_info "通过 chocolatey 安装 MinGW-w64 ..."
  choco install mingw -y --no-progress || log_error "choco install mingw 失败"
  locate_mingw || log_error "MinGW-w64 安装后仍找不到 gcc"
  log_success "Windows 构建依赖就绪"
}

ensure_build_deps() {
  case "$HOST_OS" in
    linux)   ensure_linux_deps ;;
    windows) ensure_windows_deps ;;
    darwin)  command -v clang &>/dev/null || log_error "缺少 clang，请安装 Xcode Command Line Tools: xcode-select --install" ;;
  esac
}

# ============================================================
# 版本管理
# ============================================================
get_version() {
  if [ -n "$VERSION" ]; then echo "$VERSION"; return; fi
  if [ -f "$PROJECT_DIR/version.txt" ]; then
    VERSION="$(tr -d '[:space:]\r' < "$PROJECT_DIR/version.txt")"
  else
    VERSION="$(git describe --tags --always --dirty 2>/dev/null || echo "dev")"
  fi
  echo "$VERSION"
}

# ============================================================
# 二进制路径
# ============================================================
get_desktop_binary() {
  if [ "$HOST_OS" = "darwin" ]; then
    echo "$BUILD_DIR/desktop/${APP_NAME}"
  else
    echo "$BUILD_DIR/desktop/${APP_NAME}${EXT}"
  fi
}

get_server_binary() {
  echo "$BUILD_DIR/server/${APP_NAME}-server${EXT}"
}

# ============================================================
# 构建桌面应用
# ============================================================
build_desktop() {
  check_go
  ensure_build_deps
  local version
  version=$(get_version)

  mkdir -p "$BUILD_DIR/desktop" "$DIST_DIR"

  log_info "构建桌面应用 ($HOST_OS/$HOST_ARCH, version=$version)..."

  local ldflags="-s -w -X main.Version=${version}"

  if [ "$HOST_OS" = "darwin" ]; then
    export MACOSX_DEPLOYMENT_TARGET=12.0

    local arch_bins=()
    for arch in amd64 arm64; do
      local cgo_arch="x86_64"
      [ "$arch" = "arm64" ] && cgo_arch="arm64"
      log_info "  GOOS=darwin GOARCH=${arch} (clang -arch ${cgo_arch}, min=12.0)"
      (
        export GOOS=darwin GOARCH="$arch" CGO_ENABLED=1
        export CC="clang -arch ${cgo_arch}"
        export CXX="clang++ -arch ${cgo_arch}"
        export CGO_CFLAGS="-arch ${cgo_arch} -mmacosx-version-min=12.0"
        export CGO_CXXFLAGS="-arch ${cgo_arch} -mmacosx-version-min=12.0"
        export CGO_LDFLAGS="-arch ${cgo_arch} -mmacosx-version-min=12.0"
        go build -ldflags "${ldflags}" -o "$BUILD_DIR/desktop/${APP_NAME}-${arch}" ./app/cmd/desktop
      ) || log_error "macOS (${arch}) 构建失败"
      arch_bins+=("$BUILD_DIR/desktop/${APP_NAME}-${arch}")
    done
    lipo -create -output "$BUILD_DIR/desktop/${APP_NAME}" "${arch_bins[@]}" || log_error "lipo 合并失败"
    rm -f "${arch_bins[@]}"
    lipo -info "$BUILD_DIR/desktop/${APP_NAME}" || true

    if command -v codesign &>/dev/null; then
      codesign --force --sign - --timestamp=none "$BUILD_DIR/desktop/${APP_NAME}" \
        || log_error "universal 二进制 ad-hoc 签名失败"
    fi

    # 创建 .app bundle
    local app_bundle="$DIST_DIR/${APP_NAME}.app"
    local contents="$app_bundle/Contents"
    local macos_bin="$contents/MacOS/${APP_NAME}"
    local resources="$contents/Resources"

    rm -rf "$app_bundle"
    mkdir -p "$(dirname "$macos_bin")" "$resources"
    cp "$BUILD_DIR/desktop/${APP_NAME}" "$macos_bin"
    chmod +x "$macos_bin"

    if [ -f "$PROJECT_DIR/icons/icon.icns" ]; then
      cp "$PROJECT_DIR/icons/icon.icns" "$resources/icon.icns"
    fi

    [ -d "$PROJECT_DIR/static" ] && cp -R "$PROJECT_DIR/static" "$resources/"
    if [ -d "$PROJECT_DIR/data" ]; then
      mkdir -p "$resources/data"
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
    <key>CFBundleIdentifier</key><string>${APP_BUNDLE_ID}</string>
    <key>CFBundleShortVersionString</key><string>${version}</string>
    <key>CFBundleVersion</key><string>${version}</string>
    <key>CFBundleExecutable</key><string>${APP_NAME}</string>
    <key>CFBundleIconFile</key><string>icon</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleSignature</key><string>????</string>
    <key>LSMinimumSystemVersion</key><string>12.0</string>
    <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

    if command -v codesign &>/dev/null; then
      codesign --force --deep --sign - --timestamp=none "$app_bundle" \
        || log_error ".app bundle ad-hoc 签名失败"
      codesign --verify --deep --strict "$app_bundle" || log_warn "codesign --verify 非零退出（仅提示，不阻断）"
    fi

    log_success "App bundle → $app_bundle"
  else
    local goos="linux"
    [ "$HOST_OS" = "windows" ] && goos="windows"

    (
      export GOOS="$goos" GOARCH="$HOST_ARCH" CGO_ENABLED=1
      go build -ldflags "${ldflags}" -o "$BUILD_DIR/desktop/${APP_NAME}${EXT}" ./app/cmd/desktop
    ) || log_error "${HOST_OS} 构建失败"

    log_success "二进制 → $BUILD_DIR/desktop/${APP_NAME}${EXT}"
  fi
}

# ============================================================
# 打包发布产物 (dist/)
# ============================================================
zip_directory() {
  local zip_path="$1" src_dir="$2"

  if command -v zip &>/dev/null; then
    (cd "$src_dir" && zip -rq "$zip_path" .)
    return 0
  fi

  local ps="" cand
  for cand in powershell.exe powershell pwsh.exe pwsh; do
    if command -v "$cand" &>/dev/null; then ps="$cand"; break; fi
  done
  [ -n "$ps" ] || { log_error "未找到 zip 或 powershell，无法打包 zip"; }

  local win_src win_dst
  if command -v cygpath &>/dev/null; then
    win_src="$(cygpath -w "$src_dir")\\*"
    win_dst="$(cygpath -w "$zip_path")"
  else
    win_src="$src_dir\\*"
    win_dst="$zip_path"
  fi

  log_info "zip 不可用，使用 $ps Compress-Archive 打包"
  "$ps" -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command \
    "Compress-Archive -Path '$win_src' -DestinationPath '$win_dst' -Force"
}

package_release() {
  local version
  version=$(get_version)

  mkdir -p "$DIST_DIR"

  if [ "$HOST_OS" = "darwin" ]; then
    local app_bundle="$DIST_DIR/${APP_NAME}.app"
    local dmg="$DIST_DIR/${APP_NAME}_v${version}_macos.dmg"

    [ -d "$app_bundle" ] || { build_desktop; }

    log_info "生成 DMG: $(basename "$dmg") ..."
    local dmg_temp="$DIST_DIR/.dmg_temp"
    rm -rf "$dmg_temp"; mkdir -p "$dmg_temp"
    cp -R "$app_bundle" "$dmg_temp/"
    ln -s /Applications "$dmg_temp/Applications"
    hdiutil create -volname "$APP_NAME" -srcfolder "$dmg_temp" -ov -format UDZO "$dmg" > /dev/null
    rm -rf "$dmg_temp"
    log_success "DMG → $dmg"
  else
    local bin="${APP_NAME}${EXT}"
    local archive
    [ "$HOST_OS" = "windows" ] && archive="${APP_NAME}_v${version}_windows_${HOST_ARCH}.zip" || archive="${APP_NAME}_v${version}_linux_${HOST_ARCH}.tar.gz"

    [ -f "$BUILD_DIR/desktop/$bin" ] || build_desktop

    local stage="$BUILD_DIR/stage"
    rm -rf "$stage"; mkdir -p "$stage/data"
    cp -f "$BUILD_DIR/desktop/$bin" "$stage/"
    [ -d "$PROJECT_DIR/static" ] && cp -R "$PROJECT_DIR/static" "$stage/"
    for sub in config weather; do
      [ -d "$PROJECT_DIR/data/$sub" ] && cp -R "$PROJECT_DIR/data/$sub" "$stage/data/"
    done
    [ -f "$PROJECT_DIR/data/todo.txt" ] && cp "$PROJECT_DIR/data/todo.txt" "$stage/"

    if [ "$HOST_OS" = "windows" ]; then
      zip_directory "$DIST_DIR/$archive" "$stage" || log_error "zip 打包失败"
    else
      (cd "$stage" && tar -czf "$DIST_DIR/$archive" .) || log_error "tar 打包失败"
    fi
    rm -rf "$stage"
    log_success "Archive → $DIST_DIR/$archive"
  fi
}

# ============================================================
# 命令实现
# ============================================================
kill_existing() {
  local pids
  # 修复误杀：精确定位生成的桌面应用/服务端二进制，过滤掉 Bash 脚本自身 PID ($$)
  pids=$(pgrep -f "(${BUILD_DIR}|${DIST_DIR}|/${APP_NAME})" 2>/dev/null | grep -v "^$$$" || true)
  if [ -n "$pids" ]; then
    log_info "停止已有进程: $pids"
    echo "$pids" | xargs kill 2>/dev/null || true
    sleep 1
    pids=$(pgrep -f "(${BUILD_DIR}|${DIST_DIR}|/${APP_NAME})" 2>/dev/null | grep -v "^$$$" || true)
    [ -n "$pids" ] && echo "$pids" | xargs kill -9 2>/dev/null || true
    log_success "旧进程已停止"
  fi

  local port=3030
  if command -v lsof &>/dev/null && lsof -ti:"$port" >/dev/null 2>&1; then
    log_info "释放端口 $port"
    lsof -ti:"$port" | xargs kill -9 2>/dev/null || true
    sleep 1
  elif command -v fuser &>/dev/null && fuser -s "${port}/tcp" 2>/dev/null; then
    log_info "释放端口 $port"
    fuser -k "${port}/tcp" 2>/dev/null || true
    sleep 1
  fi
}

cmd_build() {
  build_desktop
  package_release
  log_success "构建完成 → $DIST_DIR/"
}

cmd_run() {
  check_go
  kill_existing

  local bin
  bin=$(get_desktop_binary)

  local need=0
  [ ! -f "$bin" ] && need=1 || {
    local newer
    newer=$(find "$PROJECT_DIR" \( -name '*.go' -o -name 'version.txt' \) \
      -not -path '*/build/*' -not -path '*/dist/*' -not -path '*/.git/*' \
      -newer "$bin" -print -quit 2>/dev/null || true)
    [ -n "$newer" ] && need=1
  }

  if [ "$need" -eq 1 ]; then
    log_info "源文件有变更，重新构建..."
    build_desktop
  else
    log_success "源文件无变化，跳过构建"
  fi

  local exe="$bin"
  if [ "$HOST_OS" = "darwin" ]; then
    local app_bin="$DIST_DIR/${APP_NAME}.app/Contents/MacOS/${APP_NAME}"
    [ -f "$app_bin" ] || build_desktop
    exe="$app_bin"
  fi

  log_info "启动桌面 App (前台模式)..."
  log_info "按 Ctrl+C 关闭"
  echo ""

  if [ "$HOST_OS" = "windows" ]; then
    # Windows Git Bash 中以原生方式调起并等待进程
    cmd.exe /c start /wait "" "$(cygpath -w "$exe" 2>/dev/null || echo "$exe")" || "$exe"
  else
    "$exe"
  fi

  local exit_code=$?
  echo ""
  if [ $exit_code -eq 0 ]; then
    log_success "App 已正常退出"
  else
    log_warn "App 退出码: $exit_code"
  fi
}

cmd_server() {
  check_go
  kill_existing
  mkdir -p "$BUILD_DIR/server"

  local version
  version=$(get_version)
  local ldflags="-s -w -X main.Version=${version}"
  local bin="$BUILD_DIR/server/${APP_NAME}-server${EXT}"

  log_info "构建 HTTP 服务端 (version=$version)..."
  go build -ldflags "${ldflags}" -o "$bin" ./app/cmd/server || log_error "服务端构建失败"
  log_success "服务端二进制 → $bin"

  export GIN_MODE=release
  log_info "启动服务端: http://localhost:3030"
  log_info "按 Ctrl+C 停止"
  echo ""
  "$bin"
}

cmd_test() {
  check_go
  log_info "运行 Go 单元测试..."
  go test -race -count=1 ./...
  log_success "全部测试通过"
}

cmd_clean() {
  log_info "清理构建产物..."
  kill_existing
  rm -rf "$BUILD_DIR" "$DIST_DIR"
  find "$PROJECT_DIR" -name '*.test' -delete 2>/dev/null || true
  log_success "清理完成"
}

# ============================================================
# 交互菜单
# ============================================================
commands=(
  "1|b|build |构建桌面应用 + 打包发布产物"
  "2|r|run   |构建并前台运行桌面 App (Ctrl+C 关闭)"
  "3|s|server|构建并前台运行纯 HTTP 服务端"
  "4|t|test  |运行 Go 单元测试"
  "5|c|clean |清理构建产物"
  "0|q|exit  |退出"
)

show_menu() {
  echo ""
  echo "=========================================="
  echo "      TodoManager - 构建工具 ($HOST_OS/$HOST_ARCH)"
  echo "=========================================="
  for c in "${commands[@]}"; do
    IFS='|' read -r num name desc <<< "$c"
    printf "  %s) %-10s %s\n" "$num" "$name" "$desc"
  done
  echo "=========================================="
  echo -n "请输入选择 [0-5] (默认: 1): "
}

show_help() {
  cat <<EOF
TodoManager 构建工具

用法: $0 [命令]

当前平台: $HOST_OS/$HOST_ARCH
版本:     $(get_version 2>/dev/null || echo "unknown")

命令:
  (无参数)   显示交互菜单
  1|build    构建桌面应用 + 打包发布产物
  2|run      构建并前台运行桌面 App (Ctrl+C 关闭)
  3|server   构建并前台运行纯 HTTP 服务端
  4|test     运行 Go 单元测试
  5|clean    清理构建产物
  0|exit     退出

输出:
  构建目录:  $BUILD_DIR/
  发布产物:  $DIST_DIR/

项目路径:
  源码:     $PROJECT_DIR/app/
  静态资源:  $PROJECT_DIR/static/
  数据:     $PROJECT_DIR/data/
  版本文件:  $PROJECT_DIR/version.txt
EOF
}

main() {
  local cmd="${1:-}"

  if [ -z "$cmd" ]; then
    show_menu
    read -r choice
    cmd="${choice:-1}"
  fi

  case "$cmd" in
    1|b|build)      cmd_build ;;
    2|r|run)        cmd_run ;;
    3|s|server)     cmd_server ;;
    4|t|test)       cmd_test ;;
    5|c|clean)      cmd_clean ;;
    0|q|exit|quit)  echo "退出..."; exit 0 ;;
    help|-h|--help) show_help ;;
    *)              echo "未知命令: $cmd"; show_help; exit 1 ;;
  esac
}

main "$@"