#!/usr/bin/env python3
"""重放 KStock 对 vendor/qilin（引擎源码）的本地补丁。

背景：`sync_upstreams.py --sync-qilin` 会把 vendor/qilin **整树删除重建**，
任何直接改在 vendor 源码上的定制都会被冲掉。技能侧已有 patch_vendor_skills.py
做幂等重放；本脚本承担**引擎侧**的同类职责（当前补丁清单见 PATCHES）。

- 幂等：以「补丁标记」判断是否已应用，重复执行无副作用。
- 校验：应用前先断言「旧原文」仍在——上游重构导致锚点失配时显式报错，
  而不是静默跳过（宁可构建失败，也不要悄悄丢定制）。

用法：python3 scripts/patch_vendor_engine.py
被调用方：scripts/build-engine-bundle.sh（步骤 0）、sync_upstreams.py（--sync-qilin 之后）。
"""

from __future__ import annotations

import pathlib

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
VENDOR = REPO_ROOT / "vendor" / "qilin"

SETTINGS_ROOT = "packages/client/ui-settings-general/src/client/SettingsRoot.tsx"

# 旧导入块的公共锚点：上游重构导入分组时只需更新 OLD_IMPORTS/NEW_IMPORTS。
OLD_IMPORTS = """  ConnectionIndicator,
  IconAgentPresetOutline16, IconArchiveOutline20, IconChevronLeftOutline14,
  IconCloseOutline16, IconDataOutline16, IconPersonalizationOutline16,
  IconQuestionOutline14, IconSettingsOutline16,
} from '@qilin/client-ui-primitives'"""

NEW_IMPORTS = """  ConnectionIndicator,
  IconAgentPresetOutline16, IconApiOutline14, IconArchiveOutline20,
  IconChevronLeftOutline14, IconCloseOutline16, IconDatabaseOutline16,
  IconDataOutline16, IconGaugeOutline16, IconPanelLeftOutline16,
  IconPersonalizationOutline16, IconQuestionOutline14, IconSettingsOutline16,
  IconSkillOutline16,
} from '@qilin/client-ui-primitives'"""

OLD_NAVICON = """  if (id === 'about') return <IconQuestionOutline14 className={css.navIcon} size={16} />
  return <IconSettingsOutline16 className={css.navIcon} size={16} />"""

NEW_NAVICON = """  if (id === 'about') return <IconQuestionOutline14 className={css.navIcon} size={16} />
  // KStock：扩展分区图标映射（上游 navIcon 对未知 id 一律回落设置齿轮，见
  // docs/design/icon-refresh/ 与 scripts/patch_vendor_engine.py 的重放记录）。
  if (id === 'mcp') return <IconApiOutline14 className={css.navIcon} size={16} />
  if (id === 'skills') return <IconSkillOutline16 className={css.navIcon} size={16} />
  if (id === 'sidebar-right') return <IconPanelLeftOutline16 className={css.navIcon} size={16} />
  if (id === 'kstock-data-sources') return <IconDatabaseOutline16 className={css.navIcon} size={16} />
  if (id === 'kstock-quant-workspace') return <IconGaugeOutline16 className={css.navIcon} size={16} />
  return <IconSettingsOutline16 className={css.navIcon} size={16} />"""

# (相对路径, 标记, 旧原文, 新原文)——标记出现即视为已应用。
PATCHES: list[tuple[str, str, str, str]] = [
    (SETTINGS_ROOT, "kstock-quant-workspace", OLD_IMPORTS, NEW_IMPORTS),
    (SETTINGS_ROOT, "kstock-quant-workspace", OLD_NAVICON, NEW_NAVICON),
]


def main() -> int:
    applied = skipped = 0
    errors: list[str] = []
    for rel, marker, old, new in PATCHES:
        path = VENDOR / rel
        if not path.exists():
            errors.append(f"目标不存在：vendor/qilin/{rel}")
            continue
        text = path.read_text(encoding="utf-8")
        if marker in text:
            skipped += 1
            continue
        if old not in text:
            errors.append(
                f"vendor/qilin/{rel} 找不到补丁锚点（上游可能重构了该处，"
                f"请更新 patch_vendor_engine.py 的锚点后重放）"
            )
            continue
        path.write_text(text.replace(old, new, 1), encoding="utf-8")
        applied += 1
    print(f"patch_vendor_engine：应用 {applied} 处，跳过（已应用）{skipped} 处")
    for e in errors:
        print(f"✗ {e}", flush=True)
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
