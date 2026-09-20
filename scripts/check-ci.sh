#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# CI 检查（2.0：QiLin 3.x 引擎插件形态）。
# 引擎与量化数据面都是 TypeScript 插件；Python 面只剩技能包与打包资源契约校验。

# KStock 插件包可构建（tsdown 产物：宿主 lib/index.js + 客户端 lib/client.cjs）。
# quant-ui 是源码型共享包（被四个量化库界面包内联），不单独构建。
for pkg in accounts client-brand web quant quant-strategies quant-factors quant-selections quant-reports; do
  pnpm -C "kstock/$pkg" exec tsdown > /dev/null
done
# 类型检查：quant（宿主全量）、quant-ui（共享件）、四个量化库界面包。
pnpm -C kstock/quant exec tsc --noEmit -p tsconfig.json
pnpm -C kstock/accounts exec tsc --noEmit -p tsconfig.json
for pkg in quant-ui quant-strategies quant-factors quant-selections quant-reports; do
  pnpm -C "kstock/$pkg" exec tsc --noEmit -p tsconfig.json
done
# quant 存储层单测（node:test + tsx）。
pnpm -C kstock/quant test
# accounts 包 1.x 账户迁移单测（bcrypt 兼容 / 按需导入 / 登录迁移分支）。
pnpm -C kstock/accounts test

# Electron 壳：主进程打包 + 类型检查。
pnpm -C apps/desktop build:electron-main
pnpm -C apps/desktop exec tsc -p electron/tsconfig.json --noEmit

# 打包资源契约（源形态）：插件清单 / bundle patch / 技能接线 / 壳模块 / 无遗留模块。
# python 经解析器调用（Windows Store 桩问题，见 scripts/python.sh）。
scripts/python.sh scripts/verify_package_resources.py --source-only
scripts/python.sh scripts/verify_skill_pack.py

# 图标资产契约（纯标准库层，CI 无需 Pillow/rsvg）：文件齐全 + 逐档像素尺寸 +
# icns 含 1024 / ico 七档 / 托盘模板图源仅纯黑 + 256 档字标非空。
# 本机若装了 Pillow / rsvg-convert，同一命令会额外跑像素级校验与「设计源→资产」
# 重渲染漂移校验（能发现「改了设计源却忘了重出资产」）。
scripts/python.sh docs/design/icon-refresh/build_assets.py --check

# 引擎单文件冒烟（产物存在时）：--help 快速失败验证可执行完整性。
# 完整启动冒烟由发布流水线的引擎束构建 + 桌面打包覆盖。
if [ -f dist-exe/kstock-engine ]; then
  dist-exe/kstock-engine --help > /dev/null
fi
