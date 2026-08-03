#!/usr/bin/env bash
# KStock 一键发布脚本
#
# 用法:
#   ./build-release.sh v0.1.0                 # 校验 + 本地预检 + 提交 + 打 tag + 推送（触发 CI 发布）
#   ./build-release.sh v0.1.0 --skip-check    # 跳过本地预检（构建留给 CI）
#   ./build-release.sh v0.1.0 --no-push       # 只提交 + 打 tag，不推送
#   ./build-release.sh v0.1.0 --force         # 工作区有改动 / 分支落后时仍继续
#   ./build-release.sh --delete-tag v0.1.0    # 删除本地与远程 tag（独立模式，不触发发布）
#   ./build-release.sh --watch                # 监控最近一次 Release workflow 运行结果
set -euo pipefail

cd "$(dirname "$0")"

VERSION=""
SKIP_CHECK=0
NO_PUSH=0
FORCE=0
WATCH=0
DELETE_TAG=0

for arg in "$@"; do
  case "$arg" in
    --skip-check) SKIP_CHECK=1 ;;
    --no-push) NO_PUSH=1 ;;
    --force) FORCE=1 ;;
    --watch) WATCH=1 ;;
    --delete-tag) DELETE_TAG=1 ;;
    --*)
      echo "未知参数: $arg" >&2
      echo "用法: ./build-release.sh [vX.Y.Z] [--skip-check] [--no-push] [--force] [--watch] [--delete-tag vX.Y.Z]" >&2
      exit 1
      ;;
    *) VERSION="$arg" ;;
  esac
done

# ── --watch 模式：监控最近一次 Release workflow 运行 ─────────────────────────
if [ "$WATCH" = 1 ]; then
  command -v gh >/dev/null || { echo "需要安装 GitHub CLI (gh)" >&2; exit 1; }
  run_id="$(gh run list --workflow=release.yml --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null || true)"
  if [ -z "$run_id" ]; then
    echo "没有找到 release.yml 的运行记录，请先推送 tag 触发发布。" >&2
    exit 1
  fi
  echo "监控 workflow 运行 #$run_id（Ctrl-C 可中断，不影响 CI 执行）…"
  gh run watch "$run_id" --exit-status
  gh run view "$run_id"
  exit $?
fi

# ── 版本解析 ──────────────────────────────────────────────────────────────────
if [ -z "$VERSION" ]; then
  current="$(python3 -c 'import json;print(json.load(open("apps/desktop/src-tauri/tauri.conf.json"))["version"])')"
  VERSION="v$current"
  echo "未指定版本，使用当前版本: $VERSION"
fi

if ! [[ "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "错误: 版本号格式应为 vX.Y.Z，收到: $VERSION" >&2
  exit 1
fi
RAW_VERSION="${VERSION#v}"

# ── --delete-tag 模式：删除本地与远程 tag（独立模式，不触发发布）───────────────
if [ "$DELETE_TAG" = 1 ]; then
  echo "==> 删除 tag $VERSION（本地 + 远程）"
  if git tag -d "$VERSION" >/dev/null 2>&1; then
    echo "   本地 tag 已删除: $VERSION"
  else
    echo "   （本地 tag 不存在或删除失败）: $VERSION"
  fi
  if git push origin --delete "refs/tags/$VERSION" >/dev/null 2>&1; then
    echo "   远程 tag 已删除: origin/$VERSION"
  else
    echo "   （远程 tag 不存在或删除失败，请检查网络/权限）: origin/$VERSION"
  fi
  echo "==> 完成。如需重新发布，直接重新执行 ./build-release.sh $VERSION"
  exit 0
fi

# ── git 状态校验 ─────────────────────────────────────────────────────────────
if [ -n "$(git status --porcelain)" ]; then
  if [ "$FORCE" = 1 ]; then
    echo "警告: 工作区有未提交改动（--force），将一并提交。"
  else
    echo "错误: 工作区有未提交改动，请先提交或使用 --force 一并提交。" >&2
    echo "未提交文件:" >&2
    git status --short >&2
    exit 1
  fi
fi

branch="$(git branch --show-current)"
if [ "$branch" != "main" ]; then
  echo "错误: 发布必须在 main 分支，当前分支: $branch" >&2
  exit 1
fi

if [ "$NO_PUSH" = 0 ]; then
  git fetch origin >/dev/null 2>&1 || echo "警告: git fetch 失败，跳过远端同步校验。"
  behind="$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)"
  if [ "$behind" != "0" ]; then
    if [ "$FORCE" = 1 ]; then
      echo "警告: 本地落后 origin/main $behind 个提交（--force），继续。"
    else
      echo "错误: 本地落后 origin/main $behind 个提交，请先 git pull。" >&2
      exit 1
    fi
  fi
fi

# ── 同步版本号到各清单文件 ───────────────────────────────────────────────────
echo "==> 同步版本号 $VERSION 到 package.json / tauri.conf.json / Cargo.toml / pyproject.toml"
python3 - "$RAW_VERSION" <<'PY'
import json
import re
import sys

version = sys.argv[1]
json_files = [
    "package.json",
    "apps/desktop/package.json",
    "apps/desktop/src-tauri/tauri.conf.json",
]
for path in json_files:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    data["version"] = version
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

toml_files = [
    "apps/desktop/src-tauri/Cargo.toml",
    "pyproject.toml",
]
for path in toml_files:
    with open(path, encoding="utf-8") as f:
        text = f.read()
    text = re.sub(
        r'^version = "[^"]*"',
        f'version = "{version}"',
        text,
        count=1,
        flags=re.MULTILINE,
    )
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
PY
git diff --stat

# ── 本地预检（可跳过）─────────────────────────────────────────────────────────
if [ "$SKIP_CHECK" = 0 ]; then
  echo "==> 本地预检: check-ci.sh（测试 + 类型检查 + cargo check）"
  bash scripts/check-ci.sh
  echo "==> 本地预检: build-desktop.sh（本机构建，产物不签名）"
  bash scripts/build-desktop.sh
else
  echo "==> 已跳过本地预检（--skip-check）"
fi

# ── 生成发布说明（自上一 tag 以来的提交）─────────────────────────────────────
notes_file="$(mktemp)"
trap 'rm -f "$notes_file"' EXIT
prev_tag="$(git describe --tags --abbrev=0 2>/dev/null || true)"
if [ -n "$prev_tag" ] && [ "$prev_tag" != "$VERSION" ]; then
  git log --oneline --no-merges "$prev_tag"..HEAD > "$notes_file"
else
  git log --oneline --no-merges -20 > "$notes_file"
fi
echo "==> 发布说明（${prev_tag:-（无历史 tag）} → $VERSION）:"
cat "$notes_file"

# ── 提交 + 打 tag + 推送 ──────────────────────────────────────────────────────
echo "==> 提交版本号变更"
git add -A
git commit -m "chore: release $VERSION" -m "$(cat "$notes_file")"

echo "==> 打 tag $VERSION"
git tag -a "$VERSION" -m "KStock $VERSION" -m "$(cat "$notes_file")"

if [ "$NO_PUSH" = 1 ]; then
  echo "==> 已跳过推送（--no-push）。推送命令:"
  echo "    git push origin main && git push origin $VERSION"
  exit 0
fi

echo "==> 推送 main 与 $VERSION（将触发 GitHub Actions Release 工作流）"
git push origin main
git push origin "$VERSION"

# ── 输出 CI 入口 ──────────────────────────────────────────────────────────────
if command -v gh >/dev/null 2>&1; then
  run_url="$(gh run list --workflow=release.yml --limit 1 --json url --jq '.[0].url' 2>/dev/null || true)"
  if [ -n "$run_url" ]; then
    echo ""
    echo "==> Release workflow 已触发: $run_url"
    echo "    可执行 ./build-release.sh --watch 等待构建完成，"
    echo "    构建完成后安装包将自动上传到 GitHub Release:"
    echo "    https://github.com/kkutysllb/KStock/releases/tag/$VERSION"
  fi
fi
echo "==> 完成。"
