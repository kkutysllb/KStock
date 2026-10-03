#!/usr/bin/env bash
# 引擎克隆引导（KStock 侧的「setup.sh」等价物）。
#
# 形态：vendor/qilin **不是**入库源码快照，而是 QiLin fork 分支（
# upstream.lock.json 的 engine.branch）的 git 克隆；KStock 对引擎的定制是该
# 分支上的提交。本脚本负责「克隆 / 更新 / 落到锁定提交 / 契约校验 / 可选装
# 依赖与构建」这条链路，断言集中在 scripts/verify_engine_contract.py。
#
# 用法：
#   scripts/engine-bootstrap.sh                  # 引导 + 契约校验（默认）
#   scripts/engine-bootstrap.sh --check-only      # 只做契约校验（不联网不改动）
#   scripts/engine-bootstrap.sh --install         # 追加 pnpm install
#   scripts/engine-bootstrap.sh --build           # 追加 pnpm run build
#   scripts/engine-bootstrap.sh --verify-runtime  # 追加 verify-runtime-closure
#   scripts/engine-bootstrap.sh --full            # install + build + verify-runtime
#   scripts/engine-bootstrap.sh --prune           # 删除克隆释放磁盘（约 3.5 GB）
#
# 克隆是可弃的：删掉它不丢任何定制——7 个产品提交固化在 fork 分支与
# upstream/patches/*.patch 里，lock 记录分支与提交口径。需要构建或跑门禁
# （check-ci / check-release / kstock/* 类型检查都读 vendor/qilin 源码）时
# 重新引导即可。
#
# 环境变量：
#   KSTOCK_ENGINE_DIR     引擎克隆目录（默认取 lock 的 engine.clone_dir）
#   KSTOCK_ENGINE_REMOTE  克隆源（默认取 lock 的 engine.repo）
#
# 分支尚未推送时：upstream/patches/ 下存有同一提交序列，可按收尾提示用
#   git am 离线重建（详见 docs/引擎分支工作流.md）。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCK="$ROOT/upstream.lock.json"

DO_FETCH=1
DO_INSTALL=0
DO_BUILD=0
DO_VERIFY=0
DO_PRUNE=0

for arg in "$@"; do
  case "$arg" in
    --check-only) DO_FETCH=0 ;;
    --install) DO_INSTALL=1 ;;
    --build) DO_BUILD=1 ;;
    --verify-runtime) DO_VERIFY=1 ;;
    --full) DO_INSTALL=1; DO_BUILD=1; DO_VERIFY=1 ;;
    --prune) DO_PRUNE=1 ;;
    -h|--help) sed -n '2,31p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "engine-bootstrap: 未知参数 $arg（-h 看用法）" >&2; exit 2 ;;
  esac
done

# 取 lock 里的点分路径（engine.branch / patch_series / …）。
lock_field() {
  "$ROOT/scripts/python.sh" - "$LOCK" "$1" <<'PY'
import json, sys
node = json.load(open(sys.argv[1], encoding="utf-8"))
for part in sys.argv[2].split("."):
    node = node[part]
print(node)
PY
}

BRANCH="$(lock_field engine.branch)"
COMMIT="$(lock_field engine.commit)"
BASE_COMMIT="$(lock_field engine.base_commit)"
BASE_TAG="$(lock_field engine.base_tag)"
CLONE_DIR="$(lock_field engine.clone_dir)"
REPO="${KSTOCK_ENGINE_REMOTE:-$(lock_field engine.repo)}"
PATCH_SERIES="$(lock_field patch_series)"
# patch_bundle 是可选字段（旧 lock 没有）：分支未推送时的逐位重建物。
PATCH_BUNDLE="$("$ROOT/scripts/python.sh" - "$LOCK" <<'PY'
import json, sys
print(json.load(open(sys.argv[1], encoding="utf-8")).get("patch_bundle", ""))
PY
)"
ENGINE_DIR="${KSTOCK_ENGINE_DIR:-$ROOT/$CLONE_DIR}"
export KSTOCK_ENGINE_DIR="$ENGINE_DIR"

log() { printf '==> %s\n' "$*"; }
die() { printf '!! %s\n' "$*" >&2; exit 1; }

offline_hint() {
  cat >&2 <<EOF

离线引导路径（upstream/patches 下已存同一提交序列，无需等分支推送）：
  # ① 逐位重建（推荐；bundle 保留提交对象，HEAD 与 lock.commit 一致）
  git clone --single-branch "$REPO" "$ENGINE_DIR"
  git -C "$ENGINE_DIR" fetch "$ROOT/${PATCH_BUNDLE:-<upstream/patches/*.bundle>}" \\
      "refs/heads/$BRANCH:refs/heads/$BRANCH"
  git -C "$ENGINE_DIR" checkout "$BRANCH"
  # ② 逐条重放（无 bundle 时的兜底；committer 时间不同 ⇒ 提交号会变，
  #    契约断言 2 会红，此时应改为把分支推到 fork）
  git -C "$ENGINE_DIR" checkout "$BASE_COMMIT"
  git -C "$ENGINE_DIR" am "$ROOT/$PATCH_SERIES"
  scripts/engine-bootstrap.sh --check-only
详见 docs/引擎分支工作流.md。
EOF
}

# --prune：引擎克隆是可弃的（.git + node_modules + lib 约 3.5 GB）。
# 删掉它不丢任何定制——7 个产品提交固化在 fork 分支、
# upstream/patches/*.bundle（提交对象）与 *.patch（人工审阅序列里）。
if [ "$DO_PRUNE" -eq 1 ]; then
  case "$ENGINE_DIR" in
    ""|"/"|"$ROOT") die "拒绝删除可疑路径：'$ENGINE_DIR'" ;;
  esac
  if [ -e "$ENGINE_DIR" ]; then
    git -C "$ENGINE_DIR" rev-parse --git-dir >/dev/null 2>&1 \
      || die "$ENGINE_DIR 存在但不是 git 仓库，拒绝删除（请人工确认）"
    log "删除引擎克隆释放磁盘：$ENGINE_DIR（$(du -sh "$ENGINE_DIR" 2>/dev/null | cut -f1 || echo '?')）"
    rm -rf "$ENGINE_DIR"
  else
    log "引擎克隆不存在，无需删除：$ENGINE_DIR"
  fi
  log "完成（需要构建或跑门禁时重跑 scripts/engine-bootstrap.sh）"
  exit 0
fi

if [ "$DO_FETCH" -eq 1 ]; then
  if ! git -C "$ENGINE_DIR" rev-parse --git-dir >/dev/null 2>&1; then
    [ -e "$ENGINE_DIR" ] && die "引擎目录已存在但不是 git 仓库：$ENGINE_DIR（先移走或删掉）"
    log "克隆引擎 fork 分支：$REPO（$BRANCH）"
    mkdir -p "$(dirname "$ENGINE_DIR")"
    # 在父目录里用相对目标名克隆：Windows（Git Bash / MSYS）下把 MSYS 形态的
    # 绝对路径交给 git clone 的目标位并不可靠，相对名则两种形态都成立。
    if ! (cd "$(dirname "$ENGINE_DIR")" \
          && git clone --quiet --branch "$BRANCH" --single-branch "$REPO" "$(basename "$ENGINE_DIR")"); then
      # 分支未推送（或离线）：退到「远端默认分支的基线对象 + 仓库内 bundle」。
      # 基线提交 lock.base_commit 通常就在远端默认分支的历史里（fork 的 tag
      # 未必推送，提交一定在），bundle 只需带 7 个提交对象（约 10 KB）。
      rm -rf "$ENGINE_DIR"
      if [ -n "$PATCH_BUNDLE" ] && [ -f "$ROOT/$PATCH_BUNDLE" ]; then
        log "分支 $BRANCH 克隆失败，改用仓库内 bundle 重建：$PATCH_BUNDLE"
        if (cd "$(dirname "$ENGINE_DIR")" \
              && git clone --quiet --single-branch "$REPO" "$(basename "$ENGINE_DIR")") \
           && git -C "$ENGINE_DIR" fetch --quiet "$ROOT/$PATCH_BUNDLE" \
                "refs/heads/$BRANCH:refs/heads/$BRANCH"; then
          log "bundle 重建完成（分支 $BRANCH）"
        else
          rm -rf "$ENGINE_DIR"
          offline_hint
          die "bundle 重建失败：$ROOT/$PATCH_BUNDLE（远端基线对象是否还在默认分支历史里？）"
        fi
      else
        offline_hint
        die "克隆失败：$REPO（分支 $BRANCH 是否已推送？仓库内也无 $PATCH_BUNDLE）"
      fi
    fi
  else
    log "更新引擎克隆（fetch origin $BRANCH）"
    git -C "$ENGINE_DIR" fetch --quiet origin "$BRANCH" \
      || echo "! fetch 失败（离线或分支尚未推送），按本地已有对象继续"
  fi
fi

git -C "$ENGINE_DIR" rev-parse --git-dir >/dev/null 2>&1 \
  || die "引擎克隆缺失且未引导：$ENGINE_DIR（去掉 --check-only 重跑，或按 docs/引擎分支工作流.md 引导）"

CURRENT="$(git -C "$ENGINE_DIR" rev-parse HEAD)"
if [ "$CURRENT" != "$COMMIT" ]; then
  BRANCH_TIP="$(git -C "$ENGINE_DIR" rev-parse --verify --quiet "refs/heads/$BRANCH" || true)"
  if [ "$BRANCH_TIP" = "$COMMIT" ]; then
    log "切到锁定分支 $BRANCH"
    git -C "$ENGINE_DIR" checkout --quiet "$BRANCH"
  elif git -C "$ENGINE_DIR" cat-file -e "${COMMIT}^{commit}" 2>/dev/null; then
    log "检出锁定提交 ${COMMIT:0:12}（detached）"
    git -C "$ENGINE_DIR" checkout --quiet --detach "$COMMIT"
  else
    offline_hint
    die "锁定提交 ${COMMIT:0:12} 不在本地对象库，且 fetch 不到（分支未推送？）"
  fi
fi

log "契约校验（scripts/verify_engine_contract.py）"
"$ROOT/scripts/python.sh" "$ROOT/scripts/verify_engine_contract.py"

if [ "$DO_INSTALL" -eq 1 ]; then
  log "安装引擎依赖（pnpm 11.7.0，frozen lockfile）"
  "$ROOT/scripts/qilin-pnpm.sh" install --frozen-lockfile
fi
if [ "$DO_BUILD" -eq 1 ]; then
  log "构建引擎产物（packages/*/lib）"
  "$ROOT/scripts/qilin-pnpm.sh" run build
fi
if [ "$DO_VERIFY" -eq 1 ]; then
  log "运行时闭包门禁（preset ↔ 依赖清单闭环）"
  "$ROOT/scripts/qilin-pnpm.sh" run verify-runtime-closure
fi

log "完成：$(git -C "$ENGINE_DIR" rev-parse --short HEAD)（$BRANCH）"
