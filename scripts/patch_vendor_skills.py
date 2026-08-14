# -*- coding: utf-8 -*-
"""KStock 本地技能补丁器：修复上游同步技能包中的脚本 import bug。

背景
----
``vendor/skills`` 由 ``sync_upstreams.py`` 从 KSkills 仓库全量覆盖（整体
rmtree + copytree），直接改 vendor 会在下次同步时丢失。本模块集中管理
KStock 对上游技能包的全部本地修复：同步完成后自动重放，也可手动执行
``python scripts/patch_vendor_skills.py`` 对当前 vendor 立即生效。

当前补丁（2026-08-14 个股尽调实测发现，三例任务均触发）：

1. **ts import bug**（analyze_financial_deep / analyze_valuation_models /
   analyze_social_media）：``from kk_common import get_finance_data_gateway``
   失败时 fallback 为 ``ts = None``（旧版 ``import tushare as ts`` 时代的
   残留），而 ``_init_tushare`` 用 ``if ts and token:`` 判断——导入成功路径
   ``ts`` 从未定义（NameError 崩溃）；导入失败路径 ``ts=None`` 静默返回
   "TUSHARE_TOKEN 未设置或 tushare 未安装" 的误导错误，LLM 无法区分真实
   原因。修复：fallback 改为 ``get_finance_data_gateway = None``，判断改为
   ``if get_finance_data_gateway and token:``。
2. **np import bug**（analyze_stock_valuation / analyze_stock_margin）：
   脚本使用 ``np.array`` / ``np.percentile`` / ``np.sum`` 但从未
   ``import numpy as np``（NameError 崩溃）。修复：补齐导入。

幂等性：每个补丁应用前检查目标状态，已修复则跳过，可重复执行。
"""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_VENDOR_ROOT = REPO_ROOT / "vendor" / "skills"

# ── ts import bug 补丁 ────────────────────────────────────────────────────
# fallback 块：`except ImportError:\n    ts = None` → 置空 gateway 引用
_TS_FALLBACK_PATTERN = re.compile(
    r"except ImportError:\s*\n\s*ts = None",
)
_TS_FALLBACK_REPLACEMENT = (
    "except ImportError:  # KStock patch: kk_common 由 common 技能提供，失败时置 None\n"
    "    get_finance_data_gateway = None"
)
# 使用点：`if ts and token:` → 判断 gateway 引用（正常路径不再 NameError）
_TS_USE_PATTERN = re.compile(r"if ts and token:")
_TS_USE_REPLACEMENT = "if get_finance_data_gateway and token:"

_TS_BUG_SCRIPTS = (
    "public/stock-analysis/scripts/analysis-engine/analyze_financial_deep.py",
    "public/stock-analysis/scripts/analysis-engine/analyze_valuation_models.py",
    "public/stock-analysis/scripts/analysis-engine/analyze_social_media.py",
)

# ── np import bug 补丁 ────────────────────────────────────────────────────
# 在 `import argparse` 前补齐 numpy 导入（文件头 import 区，幂等检测已含则跳过）
_NP_ANCHOR = "import argparse\n"
_NP_INSERTION = "import numpy as np  # KStock patch: 修复上游遗漏的 numpy 导入\nimport argparse\n"

_NP_BUG_SCRIPTS = (
    "public/stock-analysis/scripts/analysis-engine/analyze_stock_valuation.py",
    "public/stock-analysis/scripts/analysis-engine/analyze_stock_margin.py",
)


def _patch_file(path: Path, name: str, apply_fn) -> bool:
    """对单个文件应用补丁函数，返回是否发生了改动（补丁后与原文不同）。"""
    text = path.read_text(encoding="utf-8")
    patched = apply_fn(text)
    if patched is None or patched == text:
        return False
    path.write_text(patched, encoding="utf-8")
    return True


def _fix_ts_bug(text: str) -> str | None:
    """修复 ts import bug；已修复返回 None（幂等跳过）。"""
    if not _TS_FALLBACK_PATTERN.search(text) and not _TS_USE_PATTERN.search(text):
        return None
    if "if get_finance_data_gateway and token:" in text:
        return None
    text = _TS_FALLBACK_PATTERN.sub(_TS_FALLBACK_REPLACEMENT, text)
    text = _TS_USE_PATTERN.sub(_TS_USE_REPLACEMENT, text)
    return text


def _fix_np_bug(text: str) -> str | None:
    """修复 np import bug；已修复返回 None（幂等跳过）。"""
    if "import numpy as np" in text:
        return None
    if _NP_ANCHOR not in text:
        return None
    return text.replace(_NP_ANCHOR, _NP_INSERTION, 1)


def apply_skill_patches(vendor_root: Path = DEFAULT_VENDOR_ROOT) -> list[str]:
    """应用全部技能补丁，返回本次发生改动的文件列表（相对 vendor_root）。

    vendor/skills 每次上游同步后被整体覆盖，同步脚本须在复制完成后调用本
    函数重放补丁；也可命令行直接执行对当前 vendor 立即生效。
    """
    changed: list[str] = []
    for rel_path in _TS_BUG_SCRIPTS:
        target = vendor_root / rel_path
        if not target.exists():
            continue
        if _patch_file(target, rel_path, _fix_ts_bug):
            changed.append(rel_path)
    for rel_path in _NP_BUG_SCRIPTS:
        target = vendor_root / rel_path
        if not target.exists():
            continue
        if _patch_file(target, rel_path, _fix_np_bug):
            changed.append(rel_path)
    return changed


def main() -> None:
    changed = apply_skill_patches()
    if changed:
        print(f"已应用技能补丁 {len(changed)} 个文件：")
        for rel_path in changed:
            print(f"  - {rel_path}")
    else:
        print("技能补丁均已就绪，无需改动。")


if __name__ == "__main__":
    main()
