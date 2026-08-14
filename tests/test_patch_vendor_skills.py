# -*- coding: utf-8 -*-
"""scripts/patch_vendor_skills.py 技能补丁器测试。

覆盖 ts/np import bug 的修复正确性与幂等性，以及对临时 vendor 目录的
整包应用（不直接改真实 vendor，避免污染工作区）。
"""

from pathlib import Path

from scripts.patch_vendor_skills import _fix_np_bug, _fix_ts_bug, apply_skill_patches

TS_BUGGY = """#!/usr/bin/env python3
import os

try:
    from kk_common import get_finance_data_gateway
except ImportError:
    ts = None


class Fetcher:
    def _init_tushare(self):
        token = os.getenv("TUSHARE_TOKEN")
        if ts and token:
            self.pro = get_finance_data_gateway()
"""

TS_FIXED = """#!/usr/bin/env python3
import os

try:
    from kk_common import get_finance_data_gateway
except ImportError:  # KStock patch: kk_common 由 common 技能提供，失败时置 None
    get_finance_data_gateway = None


class Fetcher:
    def _init_tushare(self):
        token = os.getenv("TUSHARE_TOKEN")
        if get_finance_data_gateway and token:
            self.pro = get_finance_data_gateway()
"""

NP_BUGGY = """#!/usr/bin/env python3
import argparse
import json
import os


def percentile(vals):
    return np.percentile(vals, 25)
"""

NP_FIXED = """#!/usr/bin/env python3
import numpy as np  # KStock patch: 修复上游遗漏的 numpy 导入
import argparse
import json
import os


def percentile(vals):
    return np.percentile(vals, 25)
"""


def test_fix_ts_bug_repairs_fallback_and_use():
    assert _fix_ts_bug(TS_BUGGY) == TS_FIXED


def test_fix_ts_bug_idempotent_after_fix():
    assert _fix_ts_bug(TS_FIXED) is None


def test_fix_ts_bug_noop_when_no_bug():
    text = "import os\n\nprint('hello')\n"
    assert _fix_ts_bug(text) is None


def test_fix_np_bug_inserts_numpy_import():
    assert _fix_np_bug(NP_BUGGY) == NP_FIXED


def test_fix_np_bug_idempotent_after_fix():
    assert _fix_np_bug(NP_FIXED) is None


def test_fix_np_bug_noop_without_anchor():
    text = "import json\nprint('hi')\n"
    assert _fix_np_bug(text) is None


def test_apply_skill_patches_against_tmp_vendor(tmp_path):
    """对临时 vendor 目录应用整包补丁：修复 + 幂等重放。"""
    rel = "public/stock-analysis/scripts/analysis-engine"
    (tmp_path / rel).mkdir(parents=True)
    ts_target = tmp_path / rel / "analyze_financial_deep.py"
    np_target = tmp_path / rel / "analyze_stock_valuation.py"
    ts_target.write_text(TS_BUGGY, encoding="utf-8")
    np_target.write_text(NP_BUGGY, encoding="utf-8")

    changed = apply_skill_patches(vendor_root=tmp_path)

    assert sorted(changed) == sorted(
        [f"{rel}/analyze_financial_deep.py", f"{rel}/analyze_stock_valuation.py"]
    )
    assert "if get_finance_data_gateway and token:" in ts_target.read_text(encoding="utf-8")
    assert "import numpy as np" in np_target.read_text(encoding="utf-8")

    # 幂等：第二次应用无改动
    assert apply_skill_patches(vendor_root=tmp_path) == []


def test_apply_skill_patches_repaired_vendor_scripts_are_syntactically_valid():
    """真实 vendor 中 5 个目标脚本补丁后必须保持语法有效。"""
    import py_compile

    vendor_root = Path(__file__).resolve().parent.parent / "vendor" / "skills"
    changed = apply_skill_patches(vendor_root=vendor_root)
    # 无论本次是否有改动（可能已修复），补丁后都应语法有效
    targets = (
        "public/stock-analysis/scripts/analysis-engine/analyze_financial_deep.py",
        "public/stock-analysis/scripts/analysis-engine/analyze_valuation_models.py",
        "public/stock-analysis/scripts/analysis-engine/analyze_social_media.py",
        "public/stock-analysis/scripts/analysis-engine/analyze_stock_valuation.py",
        "public/stock-analysis/scripts/analysis-engine/analyze_stock_margin.py",
    )
    for rel in targets:
        py_compile.compile(str(vendor_root / rel), doraise=True)
    # 幂等
    assert apply_skill_patches(vendor_root=vendor_root) == []
