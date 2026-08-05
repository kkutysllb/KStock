#!/usr/bin/env bash
set -euo pipefail

# 构建 KStock 桌面端发布包（Electron + electron-builder）。
#
# 前置条件：../../dist/kstock-gateway 已由 scripts/build-gateway-bundle.sh
# 构建完成（PyInstaller onedir 产物），electron-builder 会将其作为
# extraResources 打进发布包的 resources/gateway 目录。
#
# electron-builder.yml 已按平台指定产物：
#   macOS → dmg + zip
#   Windows → nsis（避免 WiX light.exe 对大包脆弱的问题）
#   Linux → deb（避免 AppImage linuxdeploy 在 CI 上的 FUSE 依赖）

GATEWAY_BUNDLE="$(cd "$(dirname "$0")/.." && pwd)/dist/kstock-gateway"
if [ ! -d "$GATEWAY_BUNDLE" ]; then
  echo "ERROR: gateway bundle 缺失（$GATEWAY_BUNDLE）" >&2
  echo "请先执行 scripts/build-gateway-bundle.sh 构建 PyInstaller 产物。" >&2
  exit 1
fi

# electron-builder 按 --platform 构建当前平台；CI matrix 已按 OS 分配 runner。
# 跨平台构建（如 mac 上打 win 包）需额外 Docker/wine，本次不支持。
cd "$(dirname "$0")/../apps/desktop"
exec pnpm run electron:build
