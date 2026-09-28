#!/usr/bin/env bash
# 为已有 KStock 实例补登记内置插件（profile 解析清单自愈）。
#
# 背景：profile 的解析清单（$QILIN_HOME/profiles/<name>/package.json 的
# dependencies + node_modules 符号链接）在该 profile 首次创建时从
# kstock/web/cordis.patch.yml 的 insert 行一次性生成。产品更新新增插件后，
# 已存在的 profile 不会自动补登记——新插件行会以 failed to import 出现。
# 本脚本按当前 cordis.patch.yml 名单幂等补齐：缺的依赖与符号链接补上，
# 已登记的原样保留；并给 `qilin.profile.bundles` 幂等补上引擎 3.0.5 内置的
# 动效技能库层（dsh-animations，对齐 ensureKstockProfile 的迁移口径）。
#
# 用法：scripts/register-profile-plugins.sh [QILIN_HOME] [PROFILE_NAME]
#   QILIN_HOME   默认 ~/.kstock/qilin-home（桌面端）；隔离实例传对应 home
#   PROFILE_NAME 默认 kstock
set -euo pipefail
cd "$(dirname "$0")/.."

QILIN_HOME="${1:-$HOME/.kstock/qilin-home}"
PROFILE="${2:-kstock}"
PROFILE_DIR="$QILIN_HOME/profiles/$PROFILE"
PATCH_FILE="kstock/web/cordis.patch.yml"

[ -f "$PROFILE_DIR/package.json" ] || { echo "!! profile 不存在：$PROFILE_DIR" >&2; exit 1; }
[ -f "$PATCH_FILE" ] || { echo "!! 找不到 $PATCH_FILE" >&2; exit 1; }

# 从产品名单提取 insert 行的 (id, name)：id 行的下一行是 name。
ROW_IDS="$(awk '/^    - id: /{gsub(/^    - id: |[[:space:]]$/, ""); print}' "$PATCH_FILE")"
REPO_ROOT="$(pwd)"

python3 - "$PROFILE_DIR" "$REPO_ROOT" $ROW_IDS <<'EOF'
import json, os, sys

profile_dir, repo_root, *row_ids = sys.argv[1:]
manifest_path = os.path.join(profile_dir, 'package.json')
manifest = json.load(open(manifest_path))
deps = manifest.get('dependencies', {})
missing, changed = [], False

# ── 1. 插件依赖与符号链接 ────────────────────────────────────────────
for row_id in row_ids:
    # 行 id → 包目录：kstock/<dir>/package.json 的 name 与行 name 一致；
    # 名单行 id 与目录名同构（kstock-<name> ↔ <name>），直接按目录名核对。
    dir_name = row_id.removeprefix('kstock-')
    pkg_file = os.path.join(repo_root, 'kstock', dir_name, 'package.json')
    if not os.path.isfile(pkg_file):
        continue
    name = json.load(open(pkg_file)).get('name')
    if name is None:
        continue
    link = 'link:' + os.path.join(repo_root, 'kstock', dir_name)
    link_target = os.path.join(profile_dir, 'node_modules', name)
    if deps.get(name) == link and os.path.islink(link_target):
        continue
    deps[name] = link
    changed = True
    if os.path.islink(link_target) or os.path.exists(link_target):
        os.remove(link_target)
    os.makedirs(os.path.dirname(link_target), exist_ok=True)
    os.symlink(link.removeprefix('link:'), link_target)
    missing.append(name)
manifest['dependencies'] = deps

# ── 2. bundle 叠层：补上引擎内置的动效技能库（QiLin 3.0.5 起的产品层）──
ANIMATIONS = 'dsh-animations'
profile = manifest.setdefault('qilin', {}).setdefault('profile', {})
bundles = list(profile.get('bundles', []))
if not bundles:
    bundles = ['@qilin/base', '@qilin/web-app', ANIMATIONS, '@kstock/web']
    changed = True
elif ANIMATIONS not in bundles:
    anchor = bundles.index('@qilin/web-app') if '@qilin/web-app' in bundles else len(bundles)
    bundles.insert(anchor + 1, ANIMATIONS)
    changed = True
profile['bundles'] = bundles

if changed:
    json.dump(manifest, open(manifest_path, 'w'), indent=2)
print('已补登记：' + ('、'.join(missing) if missing else '（无缺失）'))
print('bundle 叠层：' + '、'.join(bundles))
EOF
