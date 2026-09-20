#!/usr/bin/env bash
# 解析并执行 Python：python3 → python → py -3。
#
# 为什么按可执行性探测而非 command -v：Windows 的 python3 常是
# Microsoft Store 的「应用执行别名」桩——存在但一跑就打印安装提示并
# 退出非零（实机踩坑：bundle 构建死在 patch 步骤）。py -3 兜底覆盖
# python.org 安装器默认形态（只装 py launcher，PATH 无 python/python3）。
#
# 用法：scripts/python.sh <script.py> [args...]
set -euo pipefail

for cmd in "python3" "python" "py -3"; do
  # shellcheck disable=SC2086
  if $cmd -c "import sys" >/dev/null 2>&1; then
    exec $cmd "$@"
  fi
done

echo "!! 未找到可用 Python（python3 / python / py -3 均不可执行）。" >&2
echo "!! 请安装 Python 3.9+（python.org 安装器勾选 Add to PATH，或任意含 py launcher 的形态）后重试。" >&2
exit 1
