#!/usr/bin/env bash
set -euo pipefail

# 完整发布产物链路（2.0，运行时闭包形态）：CI 检查 → 闭包构建（staging 三件套：
# kstock-runtime.tar.gz + plugins + presets，deploy 物化 + ABI 冒烟 + 预签）→
# Electron 桌面端（extraResources 内置闭包 + updater）。
# electron-builder 自动生成 latest-mac.yml / latest.yml / latest-linux.yml，
# 无需手动构造 updater 元数据。
#
# 发布门（fail-closed）：macOS 必须携带 APPLE_SIGNING_IDENTITY（公证硬要求）。
# 本地开发闭包（无身份、不公证）直接跑 scripts/build-runtime-bundle.sh，不经此门。
if [ "$(uname -s)" = "Darwin" ] && [ -z "${APPLE_SIGNING_IDENTITY:-}" ]; then
  echo "ERROR: 发布构建必须提供 APPLE_SIGNING_IDENTITY（公证硬要求）。" >&2
  echo "本地开发闭包请直接跑 scripts/build-runtime-bundle.sh（无身份可跑）。" >&2
  exit 1
fi

bash scripts/check-ci.sh
bash scripts/build-runtime-bundle.sh
scripts/python.sh scripts/verify_package_resources.py
bash scripts/build-desktop.sh
