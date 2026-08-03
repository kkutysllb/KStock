#!/usr/bin/env bash
set -euo pipefail

# 完整发布产物链路：单测 → 自包含 gateway（PyInstaller，内置全部 Python
# 依赖 + 技能包）→ Tauri 桌面端（resources 内置 gateway + updater 签名）。
bash scripts/check-ci.sh
bash scripts/build-gateway-bundle.sh
bash scripts/build-desktop.sh
