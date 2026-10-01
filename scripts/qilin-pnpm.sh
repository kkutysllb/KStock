#!/usr/bin/env bash
# 以仓库固定的 pnpm 版本（vendor/qilin packageManager 字段）执行引擎构建命令。
#
# 为什么不用 corepack / npm exec：vendor/qilin 的构建脚本（scripts/build.ts、
# scripts/build-exe-for-python-sdk.ts）通过 npm_execpath 解析嵌套 pnpm 调用。
# corepack 会把 npm_execpath 指向 corepack 自身入口（嵌套回落到其默认版本，
# 与项目钉定的 11.7.0 冲突）；npm exec 则指向 npm-cli.js（deploy 子命令不存在）。
# 独立安装的 pnpm.cjs 会把 npm_execpath 设为自身，嵌套调用版本始终一致。
#
# 用法：scripts/qilin-pnpm.sh <pnpm args...>
#   例：scripts/qilin-pnpm.sh install --frozen-lockfile
#       scripts/qilin-pnpm.sh run build
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PNPM_CJS="$REPO_ROOT/.tools/pnpm11/node_modules/pnpm/bin/pnpm.cjs"

if [[ ! -f "$PNPM_CJS" ]]; then
  echo "qilin-pnpm: 未找到 ${PNPM_CJS}，正在安装 pnpm@11.7.0 ..." >&2
  npm i --prefix "$REPO_ROOT/.tools/pnpm11" pnpm@11.7.0 >&2
fi

# vendor/qilin 的构建脚本（build-exe-for-python-sdk.ts 的 pnpmInvocation）
# 在 Windows 上强制要求 npm_execpath 指向 pnpm 的 JS 入口（.js/.cjs/.mjs），
# 否则抛「pnpm must expose a JavaScript entrypoint」。pnpm exec 的子进程
# 不总继承该变量，这里显式导出兜底；Git Bash（MSYS）下 env 值不做路径
# 自动转换，/c/... 形态 node.exe 打不开——用 cygpath 转 Windows 原生形。
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    export npm_execpath="$(cygpath -w "$PNPM_CJS")"
    ;;
  *)
    export npm_execpath="$PNPM_CJS"
    ;;
esac

cd "$REPO_ROOT/vendor/qilin"

# pnpm 11 在跑脚本前做 deps 自检（verifyDepsBeforeRun），判定不同步就用
# **上次安装记录的 settings** 重放安装；而我们的 build-engine-bundle 步过
# `pnpm deploy --prod`，工作区状态里 production=true → 自检实际执行
# `pnpm install --production` → devDependencies 被剪掉（tsx/typescript
# 消失），随后的 `tsx scripts/build.ts` 直接「不是内部或外部命令」
# （Windows 实机）。该设置在 pnpm 源码里只读
# `process.env.pnpm_config_verify_deps_before_run`（注意是 pnpm_config_
# 前缀），且 switch 无 default 分支——值置 false 即静默跳过自检。
# 我们的流程总是显式 install，自检只带来这类副作用。
export pnpm_config_verify_deps_before_run=false

# KStock 桌面端版本徽章：引擎客户端构建期把 QILIN_CLIENT_VERSION 烤进
# ui-sidebar 的品牌徽章（补丁 23 提供 KSTOCK_CLIENT_VERSION 覆盖口）。
# 版本事实源是 apps/desktop/package.json（发布时手工升版），此处
# 统一注入「桌面端 vX.Y.Z」，所有引擎构建路径自动随发布版本更新。
if [ -f "$REPO_ROOT/apps/desktop/package.json" ]; then
  # 相对路径 + cd：Windows runner 上 node 不认 Git Bash 的 POSIX 形绝对路径
  # （/d/a/... 直接 require 报 Cannot find module）。
  KSTOCK_DESKTOP_VERSION="$(cd "$REPO_ROOT" && node -p "require('./apps/desktop/package.json').version")"
  export KSTOCK_CLIENT_VERSION="${KSTOCK_CLIENT_VERSION:-桌面端 v$KSTOCK_DESKTOP_VERSION}"
fi

exec node "$PNPM_CJS" "$@"
