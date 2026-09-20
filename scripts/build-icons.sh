#!/usr/bin/env bash
# 生成全部应用图标与托盘图标资产（唯一入口）。
#
# 单一真源：docs/design/icon-refresh/ 下的设计源 SVG。改图标 = 改设计源脚本 →
# 跑本脚本 → 全平台资产（icns / ico / icons/ / 托盘模板图）一次重出。
#
# 依赖：rsvg-convert（brew install librsvg）、Python 3 + Pillow、
#       macOS 上额外需要 iconutil（系统自带，用于 .icns）。
set -euo pipefail
cd "$(dirname "$0")/.."

DESIGN=docs/design/icon-refresh
PY=scripts/python.sh

echo "== 1/2 生成设计源 SVG（逐方向渲染脚本）"
$PY "$DESIGN/generate.py" > /dev/null
$PY "$DESIGN/generate_seal.py" > /dev/null
$PY "$DESIGN/generate_zhuan.py" > /dev/null

echo "== 2/2 按逐尺寸形制出生产资产（含验收断言）"
$PY "$DESIGN/build_assets.py"

echo
echo "产物：apps/desktop/build/{icon.icns,icon.ico,tray.ico,icon.png,icons/,trayTemplate.png,trayTemplate@2x.png,tray-16/20/24/32.png}"
