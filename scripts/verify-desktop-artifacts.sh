#!/usr/bin/env bash
# 产物层门禁电池（V1–V7，契约见 docs/开发/发布契约.md §2）。
#
# 用法：bash scripts/verify-desktop-artifacts.sh [产物目录]   # 默认 apps/desktop/release
# 本地与 CI 调同一文件（check-release.sh 末尾 + release.yml 收集产物前）。
#
# 断言对象自动识别：macOS 产物找 *.app（resources = Contents/Resources），
# Windows 找 win-unpacked/resources，Linux 找 linux-unpacked/resources。
# 逐项收集失败并指名报错（不是笼统 exit 1）；macOS 专属项在非 Darwin 打印 skip。
set -uo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
DIR="${1:-apps/desktop/release}"
STAGING="$ROOT/staging"
FAIL=0
TMP=""

say()  { printf '%s\n' "$*"; }
ok()   { printf '[OK]   %s\n' "$*"; }
skip() { printf '[skip] %s\n' "$*"; }
bad()  { printf '[FAIL] %s\n' "$*" >&2; FAIL=1; }
die()  { printf '[FAIL] %s\n' "$*" >&2; exit 1; }

cleanup() { [ -n "$TMP" ] && rm -rf "$TMP"; }
trap cleanup EXIT

[ -d "$DIR" ] || die "产物目录不存在：$DIR"

# ── 断言对象识别 ─────────────────────────────────────────────────────
APP="$(find "$DIR" -maxdepth 2 -type d -name '*.app' 2>/dev/null | head -1)"
if [ -n "$APP" ]; then
  PLATFORM="mac"
  RES="$APP/Contents/Resources"
elif [ -d "$DIR/win-unpacked" ]; then
  PLATFORM="win"
  RES="$DIR/win-unpacked/resources"
elif [ -d "$DIR/linux-unpacked" ]; then
  PLATFORM="linux"
  RES="$DIR/linux-unpacked/resources"
else
  die "未找到可断言的包（*.app / win-unpacked / linux-unpacked）：$DIR"
fi
say "断言对象：${RES}（平台 ${PLATFORM}）"

# ── V1 包内运行时闭包在位 ────────────────────────────────────────────
TAR="$RES/kstock-runtime.tar.gz"
if [ -f "$TAR" ]; then
  ok "V1 包内 kstock-runtime.tar.gz 在位"
else
  bad "V1 缺包内运行时闭包：${TAR}（extraResources 契约漂移）"
fi

# ── V2 闭包结构（流式列目录，不整包解压）────────────────────────────
if [ -f "$TAR" ]; then
  LISTING="$(tar -tzf "$TAR" 2>/dev/null || true)"
  if [ -z "$LISTING" ]; then
    bad "V2 闭包 tar 无法列出（空包或损坏）：$TAR"
  else
    v2_ok=1
    for want in "runtime-bootstrap.mjs" "node_modules/dsh-animations/package.json" "node_modules/dsh-animations/skills/manifest.json"; do
      # here-string 而非管道：grep -q 提前收口会让 printf 吃 SIGPIPE，
      # 配 pipefail 变成假红。
      if ! grep -qE "(^|/)${want//\//\\/}$" <<<"$LISTING"; then
        bad "V2 闭包缺 ${want}（引擎启动期硬依赖）"
        v2_ok=0
      fi
    done
    [ "$v2_ok" = 1 ] && ok "V2 闭包结构齐（入口 + dsh-animations 随包）"
  fi
fi

# ── V3 随包对账：staging ↔ 包内 resources 逐目录 ────────────────────
if [ ! -d "$STAGING/plugins" ] || [ ! -d "$STAGING/presets" ]; then
  bad "V3 对账基准缺失：staging/plugins 或 staging/presets（先跑 build-runtime-bundle.sh）"
else
  v3_ok=1
  for side in plugins presets; do
    src="$STAGING/$side"
    dst="$RES/engine/$side"
    [ -d "$dst" ] || { bad "V3 缺包内 engine/$side/"; v3_ok=0; continue; }
    while IFS= read -r name; do
      [ -e "$dst/$name" ] || { bad "V3 包内缺 engine/$side/${name}（仓库有、包里无）"; v3_ok=0; }
    done < <(ls "$src")
    while IFS= read -r name; do
      [ -e "$src/$name" ] || { bad "V3 包内多出 engine/$side/${name}（包里有、仓库无）"; v3_ok=0; }
    done < <(ls "$dst")
  done
  [ "$v3_ok" = 1 ] && ok "V3 随包对账一致（plugins $(ls "$STAGING/plugins" | wc -l | tr -d ' ') 项 / presets $(ls "$STAGING/presets" | wc -l | tr -d ' ') 项）"
fi

# ── V4 Electron-node 运行时冒烟（真机解释器路径）────────────────────
if [ -f "$TAR" ]; then
  ELECTRON_BIN="$(cd "$ROOT/apps/desktop" && node -p 'require("electron")' 2>/dev/null || true)"
  if [ -z "$ELECTRON_BIN" ] || [ ! -e "$ELECTRON_BIN" ]; then
    bad "V4 未定位到 Electron 二进制（无法做包内闭包冒烟）"
  else
    TMP="$(mktemp -d)"
    if ! tar -xzf "$TAR" -C "$TMP" 2>/dev/null; then
      bad "V4 闭包解压失败：$TAR"
    else
      smoke_ok=1
      if ! ELECTRON_RUN_AS_NODE=1 "$ELECTRON_BIN" "$ROOT/scripts/local/smoke-runtime-closure.cjs" "$TMP" >"$TMP/.abi.log" 2>&1; then
        bad "V4 ABI 冒烟未通过（详见 $TMP/.abi.log 摘要）"
        tail -5 "$TMP/.abi.log" >&2
        smoke_ok=0
      fi
      # 入口须以绝对路径传入：ESM 裸导入按入口文件位置解析闭包 node_modules。
      if ! ELECTRON_RUN_AS_NODE=1 "$ELECTRON_BIN" "$TMP/runtime-bootstrap.mjs" --help >"$TMP/.help.log" 2>&1; then
        bad "V4 包内闭包入口 --help 冒烟未通过"
        tail -5 "$TMP/.help.log" >&2
        smoke_ok=0
      fi
      [ "$smoke_ok" = 1 ] && ok "V4 Electron-node 冒烟过（ABI + 入口 --help）"
    fi
  fi
fi

# ── V5 macOS 签名与公证断言 ─────────────────────────────────────────
if [ "$PLATFORM" != "mac" ]; then
  skip "V5 签名/公证断言（仅 macOS 产物）"
elif [ "$(uname -s)" != "Darwin" ]; then
  skip "V5 签名/公证断言（需 macOS 宿主）"
else
  v5_ok=1
  CS_OUT="$(codesign -dv --verbose=4 "$APP" 2>&1 || true)"
  if printf '%s' "$CS_OUT" | grep -q "Signature=adhoc"; then
    bad "V5 拒收 adhoc 签名：$APP"
    v5_ok=0
  fi
  if ! printf '%s' "$CS_OUT" | grep -qE "^TeamIdentifier="; then
    bad "V5 签名缺 TeamIdentifier：$APP"
    v5_ok=0
  elif printf '%s' "$CS_OUT" | grep -qE "^TeamIdentifier=not set"; then
    bad "V5 TeamIdentifier=not set：$APP"
    v5_ok=0
  fi
  if ! spctl -a -vv "$APP" >/dev/null 2>&1; then
    bad "V5 spctl 评估未通过（未公证或不受信）：$APP"
    v5_ok=0
  fi
  if ! xcrun stapler validate "$APP" >/dev/null 2>&1; then
    bad "V5 公证票据未随包（stapler validate 未通过）：$APP"
    v5_ok=0
  fi
  [ "$v5_ok" = 1 ] && ok "V5 签名与公证齐（非 adhoc + TeamIdentifier + spctl + stapler）"
fi

# ── V6 更新元数据齐全且与资源名一致 ─────────────────────────────────
case "$PLATFORM" in
  mac)   meta_name="latest-mac.yml";   need_exts=("zip" "blockmap") ;;
  win)   meta_name="latest.yml";       need_exts=("exe") ;;
  linux) meta_name="latest-linux.yml"; need_exts=("deb") ;;
esac
v6_ok=1
if [ ! -f "$DIR/$meta_name" ]; then
  bad "V6 缺更新元数据 $meta_name"
  v6_ok=0
fi
for ext in "${need_exts[@]}"; do
  if ! find "$DIR" -maxdepth 1 -type f -name "*.$ext" | grep -q .; then
    bad "V6 缺 .$ext 产物（更新所需）"
    v6_ok=0
  fi
done
if [ -f "$DIR/$meta_name" ]; then
  while IFS= read -r url; do
    url="$(printf '%s' "$url" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//; s/["'\'']//g')"
    [ -z "$url" ] && continue
    if [ ! -f "$DIR/$(basename "$url")" ]; then
      bad "V6 $meta_name 引用的 $url 不在产物目录（自动更新将 404）"
      v6_ok=0
    fi
  done < <(grep -E '^[[:space:]]*(url|path):' "$DIR/$meta_name" | sed -E 's/^[[:space:]]*(url|path):[[:space:]]*//')
fi
[ "$v6_ok" = 1 ] && ok "V6 更新元数据齐全且 url/path ∈ 资源名"

# ── V7 app-update.yml 的 publisherName 平台边界 ─────────────────────
AU="$RES/app-update.yml"
if [ ! -f "$AU" ]; then
  bad "V7 缺 ${AU}（updater 元数据未随包）"
elif [ "$PLATFORM" = "mac" ]; then
  cert_cn="$(printf '%s' "${CS_OUT:-$(codesign -dv --verbose=4 "$APP" 2>&1 || true)}" | sed -n 's/^Authority=\(Developer ID Application: [^()]*([A-Z0-9]*)\).*/\1/p' | head -1)"
  pub_cn="$(sed -n 's/^publisherName:[[:space:]]*//p' "$AU" | head -1 | tr -d '"'\''')"
  if [ -z "$pub_cn" ]; then
    bad "V7 macOS 产物 app-update.yml 缺 publisherName"
  elif [ -z "$cert_cn" ]; then
    bad "V7 无法读取本机证书 CN（签名无效？V5 会另有断言）"
  elif [ "$pub_cn" != "$cert_cn" ]; then
    bad "V7 publisherName（${pub_cn}）≠ 本机证书 CN（${cert_cn}）"
  else
    ok "V7 macOS publisherName 与证书 CN 一致"
  fi
else
  if grep -q '^publisherName:' "$AU"; then
    bad "V7 非 macOS 产物的 app-update.yml 不得带 publisherName（mac 证书污染）：$AU"
  else
    ok "V7 非 macOS 产物无 publisherName（平台边界正确）"
  fi
fi

# ── V8 feed 单一来源：app-update.yml 的 owner/repo 与 updater.ts 硬编码一致 ─
if [ -f "$AU" ]; then
  code_owner="$(sed -n "s/.*owner:[[:space:]]*[\"']\([^\"']*\)[\"'].*/\1/p" "$ROOT/apps/desktop/electron/lib/updater.ts" | head -1)"
  code_repo="$(sed -n "s/.*repo:[[:space:]]*[\"']\([^\"']*\)[\"'].*/\1/p" "$ROOT/apps/desktop/electron/lib/updater.ts" | head -1)"
  yml_owner="$(sed -n 's/^owner:[[:space:]]*//p' "$AU" | head -1 | tr -d '"'\''')"
  yml_repo="$(sed -n 's/^repo:[[:space:]]*//p' "$AU" | head -1 | tr -d '"'\''')"
  if [ -z "$code_owner" ] || [ -z "$code_repo" ]; then
    bad "V8 未能从 updater.ts 解析 setFeedURL 的 owner/repo（feed 断言失效）"
  elif [ "$yml_owner" != "$code_owner" ] || [ "$yml_repo" != "$code_repo" ]; then
    bad "V8 feed 双源不一致：app-update.yml($yml_owner/$yml_repo) ≠ updater.ts($code_owner/$code_repo)"
  else
    ok "V8 feed 单一来源一致（$code_owner/${code_repo}）"
  fi
fi

echo
if [ "$FAIL" -ne 0 ]; then
  echo "verify-desktop-artifacts: FAILED（见上方 [FAIL] 条目）" >&2
  exit 1
fi
echo "verify-desktop-artifacts: OK"
