#!/usr/bin/env bash
# 构建自包含 gateway 分发目录（PyInstaller onedir）。
#
# 产物: dist/kstock-gateway/（可执行文件 + 全部 Python 依赖 + 技能包 + 配置模板）
# 该目录作为 Tauri 桌面端的内置后端随安装包分发（见 tauri.conf.json bundle.resources）。
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> PyInstaller 构建 gateway（dist/kstock-gateway/）"
uv run pyinstaller scripts/kstock-gateway.spec --noconfirm --clean

echo "==> 产物大小:"
du -sh dist/kstock-gateway
ls -lh dist/kstock-gateway/kstock-gateway*
