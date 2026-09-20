#!/usr/bin/env bash
set -euo pipefail

# 完整发布产物链路（2.0）：CI 检查 → 引擎分发束（上游单文件引擎 + KStock
# 插件包 + 技能目录）→ Electron 桌面端（extraResources 内置引擎 + updater）。
# electron-builder 自动生成 latest-mac.yml / latest.yml / latest-linux.yml，
# 无需手动构造 updater 元数据。
bash scripts/check-ci.sh
bash scripts/build-engine-bundle.sh
scripts/python.sh scripts/verify_package_resources.py
bash scripts/build-desktop.sh
