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
  echo "qilin-pnpm: 未找到 $PNPM_CJS，正在安装 pnpm@11.7.0 ..." >&2
  npm i --prefix "$REPO_ROOT/.tools/pnpm11" pnpm@11.7.0 >&2
fi

cd "$REPO_ROOT/vendor/qilin"
exec node "$PNPM_CJS" "$@"
