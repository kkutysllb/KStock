#!/usr/bin/env bash
# 本地打包用：对 dist-exe/ 整棵引擎分发树做 Developer ID 预签。
#
# 为什么需要独立于 build-engine-bundle.sh 的第 5 步：
#   该步只签 dist-exe/ 顶层的 Mach-O（kstock-engine / -rg / -spawn-helper），
#   但 office sidecar（dist-exe/kstock-engine-office/）中含有完整未签名的
#   LibreOfficeDev.app —— 2800+ 文件、近 500 个 Mach-O。electron-builder 对
#   extraResources 不做递归签名（mac.extraResources 无签名语义），因此这些
#   二进制会以"未签名嵌套代码"形态进入 KStock.app，触发 notarytool 的
#   "not signed at all" HARDFAIL。
#
# 本脚本补上这一层：按路径深度深→浅签名整棵树，最后重新封装嵌套 .app。
# 幂等，可重复执行。
#
# 用法:
#   APPLE_SIGNING_IDENTITY="Developer ID Application: Bing Li (DHV5D72JNF)" \
#     bash scripts/local/presign-engine-macos.sh [dist-exe 目录]
set -euo pipefail

cd "$(dirname "$0")/../.."
ROOT="$(pwd)"
OUT_DIR="${1:-$ROOT/dist-exe}"
DEV_ID="${APPLE_SIGNING_IDENTITY:-}"

if [ -z "$DEV_ID" ]; then
  echo "!! 需要 APPLE_SIGNING_IDENTITY（如 'Developer ID Application: Bing Li (DHV5D72JNF)'）" >&2
  exit 1
fi
[ -d "$OUT_DIR" ] || { echo "!! 目录不存在：$OUT_DIR（先跑 scripts/build-engine-bundle.sh）" >&2; exit 1; }

ENTITLEMENTS="$ROOT/scripts/local/entitlements-nested.plist"
[ -f "$ENTITLEMENTS" ] || { echo "!! 缺 entitlements: $ENTITLEMENTS" >&2; exit 1; }

# macOS 签名阶段会打开大量文件句柄（sidecar 树近 3000 文件），
# 默认 ulimit -n 256 会 EMFILE。
if [ "$(ulimit -n)" -lt 10240 ]; then
  ulimit -n 10240 || echo "WARN: 无法提升 ulimit -n" >&2
fi

SIGN_ARGS=(--force --timestamp --options runtime --entitlements "$ENTITLEMENTS" --sign "$DEV_ID")
SIGN_ARGS_PLAIN=(--force --timestamp --options runtime --sign "$DEV_ID")

echo "==> 枚举 Mach-O（$OUT_DIR）"
TMPD="$(mktemp -d)"
trap 'rm -rf "$TMPD"' EXIT
ALL="$TMPD/all.txt"

# 只挑真正的 Mach-O，避免对 .jar/.dat/文本反复调用 codesign（2800+ 文件里
# 只有 215 个是 Mach-O）。用魔术字节枚举：`file` 对 Mach-O 会输出多行且
# 路径可含空格，从 "path: desc" 回解路径不可靠（实测 awk 吃掉路径、sed 漏）。
"$ROOT/scripts/python.sh" "$ROOT/scripts/local/enum_macho.py" "$OUT_DIR" > "$ALL"
TOTAL="$(wc -l < "$ALL" | tr -d ' ')"
echo "    Mach-O 数量：$TOTAL"
[ "$TOTAL" -gt 0 ] || { echo "!! 未发现 Mach-O，检查 $OUT_DIR" >&2; exit 1; }

# 按路径深度分组：depth = 路径分隔符个数（NF on FS=/）。深→浅，
# 保证父 bundle 收尾封资源时子件已签好。
awk -F/ '{print NF"\t"$0}' "$ALL" | sort -rn -k1,1 | cut -f2- > "$TMPD/bydepth.txt"
awk -F/ '{print NF}' "$ALL" | sort -rnu > "$TMPD/depths.txt"

echo "==> 深→浅签名（并行 8）"
SIGNED=0
while IFS= read -r depth; do
  awk -F/ -v d="$depth" 'NF==d' "$TMPD/bydepth.txt" > "$TMPD/level.txt"
  CNT="$(wc -l < "$TMPD/level.txt" | tr -d ' ')"
  echo "    depth=$depth  ($CNT 个)"
  # GNU 与 BSD xargs 通用的写法，逐条并行；个别失败用串行重试兜底并暴露错误。
  if ! tr '\n' '\0' < "$TMPD/level.txt" \
      | xargs -0 -n 1 -P 8 codesign "${SIGN_ARGS[@]}" 2>"$TMPD/err-$depth.log"; then
    echo "    WARN: depth=$depth 并行签名报错，串行重试" >&2
    while IFS= read -r f; do
      codesign "${SIGN_ARGS_PLAIN[@]}" "$f"
      echo "    retry-ok: ${f#"$OUT_DIR"/}"
    done < "$TMPD/level.txt"
  fi
  SIGNED=$((SIGNED + CNT))
done < "$TMPD/depths.txt"
echo "    已签：$SIGNED"

echo "==> 重新封装嵌套 .app bundle（由内到外）"
find "$OUT_DIR" -type d -name "*.app" -print0 \
  | tr '\0' '\n' | awk -F/ '{print NF"\t"$0}' | sort -rn -k1,1 | cut -f2- \
  | while IFS= read -r app; do
      [ -n "$app" ] || continue
      echo "    seal: ${app#"$OUT_DIR"/}"
      codesign "${SIGN_ARGS[@]}" "$app" 2>/dev/null || codesign "${SIGN_ARGS_PLAIN[@]}" "$app"
    done

echo "==> 校验（--verify --strict）"
FAIL=0
while IFS= read -r f; do
  codesign --verify --strict "$f" >/dev/null 2>&1 || { echo "   !! 未通过：$f" >&2; FAIL=1; }
done < "$ALL"
[ "$FAIL" -eq 0 ] && echo "    全部 Mach-O 通过"

echo "==> 顶层签名信息"
for top in "$OUT_DIR"/kstock-engine "$OUT_DIR"/kstock-engine-rg "$OUT_DIR"/kstock-engine-spawn-helper; do
  [ -f "$top" ] || continue
  printf "    %-30s " "$(basename "$top")"
  codesign -dv "$top" 2>&1 | grep -E "^Authority|^TeamIdentifier" | tr '\n' ' '
  echo
done
echo "==> 完成"
