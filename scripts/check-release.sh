#!/usr/bin/env bash
set -euo pipefail

# 完整发布产物链路（2.0，运行时闭包形态）：CI 检查 → 闭包构建（staging 三件套：
# kstock-runtime.tar.gz + plugins + presets，deploy 物化 + ABI 冒烟 + 预签）→
# Electron 桌面端（extraResources 内置闭包 + updater）。
# electron-builder 自动生成 latest-mac.yml / latest.yml / latest-linux.yml，
# 无需手动构造 updater 元数据。
#
# 发布门（fail-closed）：macOS 必须凭据齐备——签名身份 + 公证三件套。
# electron-builder 26 对 notarize:true 生成不了选项时会**跳过公证并继续出包**
# （红路径实测：`skipped macOS notarization — \`notarize\` options were unable
# to be generated`，exit 0），所以缺凭据必须在门前拦住，不能指望 builder。
# 本地开发闭包（无身份）直接跑 scripts/build-runtime-bundle.sh；未签名本地包
# 用 KSTOCK_UNSIGNED_BUILD=1 bash scripts/build-desktop.sh。
if [ "$(uname -s)" = "Darwin" ]; then
  missing=""
  for var in APPLE_SIGNING_IDENTITY APPLE_ID APPLE_APP_SPECIFIC_PASSWORD APPLE_TEAM_ID; do
    [ -n "${!var:-}" ] || missing="$missing $var"
  done
  if [ -n "$missing" ]; then
    echo "ERROR: 发布构建缺少凭据：${missing}（公证硬要求）。" >&2
    exit 1
  fi
fi

bash scripts/check-ci.sh
bash scripts/build-runtime-bundle.sh
scripts/python.sh scripts/verify_package_resources.py
bash scripts/build-desktop.sh
# 产物层门禁电池（V1–V7）：与 CI 收集产物前调用的是同一文件。
bash scripts/verify-desktop-artifacts.sh apps/desktop/release
