#!/usr/bin/env bash
set -euo pipefail

# 完整发布产物链路：单测 → 自包含 gateway（PyInstaller，内置全部 Python
# 依赖 + 技能包）→ Electron 桌面端（extraResources 内置 gateway + updater）。
electron-builder 自动生成 latest-mac.yml / latest.yml / latest-linux.yml，
无需手动构造 updater 元数据。
bash scripts/check-ci.sh
bash scripts/build-gateway-bundle.sh
bash scripts/build-desktop.sh
