#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# CI 检查（2.0：QiLin 3.x 引擎插件形态）。
# 引擎与量化数据面都是 TypeScript 插件；Python 面只剩技能包与打包资源契约校验。
#
# 用法：bash scripts/check-ci.sh [--types-only]
#   --types-only  只跑「插件构建 + 类型检查 + 壳主进程类型检查」段，跳过单测 /
#                 打包资源契约 / 图标资产等重项。scripts/audit.mjs 的 TYPECHECK
#                 门复用它——同一套 tsc 命令只有这一份事实源，审计与 CI 不会漂。
MODE="full"
case "${1:-}" in
  ""|--full) ;;
  --types-only) MODE="types-only" ;;
  *) echo "check-ci: 未知参数 $1（可用：--types-only / --full）" >&2; exit 2 ;;
esac

# ── 类型与构建段（--types-only 也跑）──────────────────────────────────
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

# Electron 壳：主进程打包 + 类型检查。
pnpm -C apps/desktop build:electron-main
pnpm -C apps/desktop exec tsc -p electron/tsconfig.json --noEmit

if [ "$MODE" = "types-only" ]; then
  echo "check-ci: 类型段通过（--types-only）"
  exit 0
fi

# ── 全量段 ────────────────────────────────────────────────────────────
# 脚本可移植性门禁：拦「只在某个 runner 的 shell / locale 下才炸」的写法。
# 立此门的事故：v2.0.0-rc.3 首次把引擎克隆作为 CI 步骤下发，macOS 作业在
# 该步 0.76 秒死（`$REPO（` 在 bash 3.2 + UTF-8 locale 下被解析成变量
# REPO（），而本机 LC_CTYPE=C 永远绿——只有 CI 能发现。详见
# scripts/verify_shell_portability.py 头注释。
scripts/python.sh scripts/verify_shell_portability.py

# quant 存储层单测（node:test + tsx）。
pnpm -C kstock/quant test
# accounts 包 1.x 账户迁移单测（bcrypt 兼容 / 按需导入 / 登录迁移分支）。
pnpm -C kstock/accounts test
# 品牌层桌面窗口几何回归（macOS 双行头部 10px 下移 / 折叠轨避让）。
pnpm -C kstock/client-brand test
# 壳自有静态页底色契约（登录页按钮簇白块事故的回归门：自报前缀 ↔ 路由覆盖）。
pnpm -C apps/desktop test

# 打包资源契约（源形态）：插件清单 / bundle patch / 技能接线 / 壳模块 / 无遗留模块。
# python 经解析器调用（Windows Store 桩问题，见 scripts/python.sh）。
scripts/python.sh scripts/verify_package_resources.py --source-only
scripts/python.sh scripts/verify_skill_pack.py

# 图标资产契约（纯标准库层，CI 无需 Pillow/rsvg）：文件齐全 + 逐档像素尺寸 +
# icns 含 1024 / ico 七档 / 托盘模板图源仅纯黑 + 256 档字标非空。
# 本机若装了 Pillow / rsvg-convert，同一命令会额外跑像素级校验与「设计源→资产」
# 重渲染漂移校验（能发现「改了设计源却忘了重出资产」）。
scripts/python.sh docs/design/icon-refresh/build_assets.py --check

# 闭包形态冒烟（产物存在时）：只做入口在位的结构断言，保持轻量——
# 完整冒烟（Electron node ABI + 入口 --help 起服）由 build-runtime-bundle.sh
# 自带，发布链在 check-release.sh 里跑到它；重门只进发布链（发布契约 RR7）。
if [ -d staging/kstock-runtime ]; then
  [ -f staging/kstock-runtime/runtime-bootstrap.mjs ] || {
    echo "staging/kstock-runtime 缺 runtime-bootstrap.mjs 入口" >&2
    exit 1
  }
fi
