#!/usr/bin/env bash
# 从 release/<tag>.md 生成 GitHub Release 正文。
#
# 用法：scripts/publish_release_notes.sh <tag> [output-file]
#
# - 源文件：release/<tag>.md；约定首部写「> 状态：待发布 · Tag：`vX.Y.Z`」，
#   发布时本脚本自动把该行替换为发布日期（Asia/Shanghai）。
# - 相对链接转 GitHub 绝对链接：版本互链 → /releases/tag/，docs/发布说明.md → /blob/main/。
# - 兜底：源文件缺失时回退 tag annotated message（build-release.sh 注入的提交摘要）。
# - 尾部附仓库归档指引 + 与上一版本的 Full Changelog 对比链接。
#
# CI（release.yml publish job）生成后经 softprops/action-gh-release 的 body_path 消费；
# 手动补写历史版本：bash scripts/publish_release_notes.sh v1.1.0 /tmp/notes.md
#   gh release edit v1.1.0 --notes-file /tmp/notes.md
set -euo pipefail

cd "$(dirname "$0")/.."

TAG="${1:?usage: publish_release_notes.sh <tag> [output-file]}"
OUT="${2:-/tmp/kstock-release-notes-${TAG}.md}"
REPO_URL="https://github.com/${GITHUB_REPOSITORY:-kkutysllb/KStock}"
NOTES_SRC="release/${TAG}.md"

if [[ -f "$NOTES_SRC" ]]; then
  sed -E \
    -e "s#]\(\.\./docs/发布说明\.md\)#](${REPO_URL}/blob/main/docs/发布说明.md)#g" \
    -e "s#]\(\./(v[0-9][0-9.]*)\.md\)#](${REPO_URL}/releases/tag/\1)#g" \
    -e "s#^> 状态：待发布.*#> 发布日期：$(TZ=Asia/Shanghai date "+%Y-%m-%d") · Tag：\`${TAG}\`#" \
    "$NOTES_SRC" > "$OUT"
else
  git tag -l --format="%(contents)" "$TAG" > "$OUT"
fi

printf '\n> 📄 完整归档见仓库 [`release/%s.md`](%s/blob/main/release/%s.md)\n' "$TAG" "$REPO_URL" "$TAG" >> "$OUT"

prev="$(git tag --list "v[0-9]*.[0-9]*.[0-9]*" --sort=-creatordate \
  | grep -E "^v[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$" \
  | grep -vx "$TAG" \
  | head -1 || true)"
if [[ -n "$prev" ]]; then
  printf "\n**Full Changelog**: %s/compare/%s...%s\n" "$REPO_URL" "$prev" "$TAG" >> "$OUT"
fi

echo "$OUT"
