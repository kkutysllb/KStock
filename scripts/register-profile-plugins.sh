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

# 从产品名单提取 insert 行的 (id, 包名)：id 行的下一行是 name。
# 注意：不能按 id 推目录——名单里存在不同构的行（kstock-brand ↔ 目录
# client-brand），按下推会找不到 kstock/brand 而**静默跳过**该插件，
# 于是它的链接永远修不回仓库（dev 里静默加载安装版插件的成因之一）。
ROW_PAIRS="$(awk '/^    - id: /{id=$3} /^      name: /{if (id != "") {print id "\t" $2; id=""}}' "$PATCH_FILE")"
REPO_ROOT="$(pwd)"

python3 - "$PROFILE_DIR" "$REPO_ROOT" "$ROW_PAIRS" <<'EOF'
import json, os, sys

# Windows 的 Python 默认按本地编码（GBK）读写文件，而 profile 清单与
# kstock/*/package.json 都是 UTF-8（含中文）——不显式指定会 UnicodeDecodeError，
# 侥幸读通也会把清单写成 GBK 让引擎读成乱码。全部显式 encoding='utf-8'。
profile_dir, repo_root, row_pairs = sys.argv[1:]
manifest_path = os.path.join(profile_dir, 'package.json')
with open(manifest_path, encoding='utf-8') as fp:
    manifest = json.load(fp)
deps = manifest.get('dependencies', {})
missing, changed = [], False

# 包名 → 仓库目录：按 package.json 的 name 反查，与行 id 的写法解耦。
dir_by_name = {}
for entry in sorted(os.listdir(os.path.join(repo_root, 'kstock'))):
    pkg_file = os.path.join(repo_root, 'kstock', entry, 'package.json')
    if not os.path.isfile(pkg_file):
        continue
    with open(pkg_file, encoding='utf-8') as fp:
        pkg_name = json.load(fp).get('name')
    if pkg_name:
        dir_by_name[pkg_name] = entry

# ── 1. 插件依赖与符号链接 ────────────────────────────────────────────
for line in row_pairs.splitlines():
    if not line.strip():
        continue
    row_id, _, raw_name = line.partition('\t')
    name = raw_name.strip().strip("'")
    dir_name = dir_by_name.get(name)
    if dir_name is None:
        continue
    link = 'link:' + os.path.join(repo_root, 'kstock', dir_name)
    link_target = os.path.join(profile_dir, 'node_modules', name)
    # 只看「是不是符号链接」不够：跑过一次安装包后，profile 的链接会被改指
    # resources/engine/plugins（同 profile 被两个实例共用），此时清单里的
    # link: 值仍是仓库路径——只比清单值会在 dev 里静默加载安装版插件。必须比对指向。
    points_to_repo = False
    if os.path.islink(link_target):
        try:
            points_to_repo = os.path.realpath(link_target) == os.path.realpath(
                os.path.join(repo_root, 'kstock', dir_name))
        except OSError:
            points_to_repo = False
    if deps.get(name) == link and points_to_repo:
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
    # ensure_ascii 保持默认（与脚本既有产物一致，避免无谓的整文件 diff）
    with open(manifest_path, 'w', encoding='utf-8') as fp:
        json.dump(manifest, fp, indent=2)
print('已补登记：' + ('、'.join(missing) if missing else '（无缺失）'))
print('bundle 叠层：' + '、'.join(bundles))
EOF
