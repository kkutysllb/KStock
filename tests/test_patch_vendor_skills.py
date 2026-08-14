# -*- coding: utf-8 -*-
"""scripts/patch_vendor_skills.py 技能补丁器测试。

覆盖 ts/np import bug 的修复正确性与幂等性，以及对临时 vendor 目录的
整包应用（不直接改真实 vendor，避免污染工作区）。
"""

from pathlib import Path

from scripts.patch_vendor_skills import (
    _fix_np_bug,
    _fix_pandas3_ffill,
    _fix_pywencai_hint,
    _fix_ts_bug,
    _fix_ts_field_bug,
    apply_skill_patches,
)

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


TS_FIELD_BUGGY = """#!/usr/bin/env python3
import os

        df = self.pro.income(
            ts_code=ts_code, start_date=start_date,
            fields="ts_code,end_date,report_type,revenue,total_cogs,"
                   "sell_exp,admin_exp,rd_exp,oper_profit,total_profit,"
                   "n_income,n_income_attr_p,minority_plr,"
                   "excite_income,excite_tax,ann_date"
        )
        df2 = self.pro.balancesheet(
            ts_code=ts_code, start_date=start_date,
            fields="ts_code,end_date,report_type,"
                   "money_cap,accounts_receiv,inventory,goodwill,"
                   "cip,fix_asset_total,total_current_assets,total_current_liab,"
                   "st_borr,lt_borr,bonds_payable,"
                   "undistr_profit,cap_rese,surplus_rese"
        )
        df3 = self.pro.cashflow(
            fields="ts_code,end_date,report_type,"
                   "n_cashflow_act,n_cashflow_inv_act,n_cashflow_fnc_act,"
                   "c_fr_sale_sg,c_pay goods_for_sv"
        )
        df4 = self.pro.fina_indicator(
            fields="ts_code,end_date,"
                   "grossprofit_margin,netprofit_margin,roe,roa,dtowequity,"
                   "debt_to_assets,netprofit_yoy,ocf_to_or,"
                   "inv_turn,ar_turn,ocf_to_debt,"
                   "eqy_to_debt,bps,ebit_of_gr,bps,cfps"
        )
        bonds = self._val(latest, "bonds_payable")
        merged = balance[["end_date", "inventory"]]
        ratio = merged["inventory"] / merged["revenue"]
        fix = self._val(latest, "fix_asset_total")
        op = self._v(row, "oper_profit")
        cff = self._v(latest, "n_cashflow_fnc_act")
"""

TS_FIELD_FIXED_MARKERS = (
    "operate_profit", "minority_gain", "ann_date",
    "inventories", "fix_assets_total", "total_cur_assets", "total_cur_liab",
    "bond_payable", "undistr_porfit", "n_cash_flows_fnc_act",
    "c_paid_goods_s", "debt_to_eqt", "eqt_to_debt",
)

TS_FIELD_REMOVED_MARKERS = (
    "oper_profit", "minority_plr", "excite_income", "excite_tax",
    "inventory", "fix_asset_total", "total_current_assets",
    "total_current_liab", "bonds_payable", "undistr_profit",
    "n_cashflow_fnc_act", "c_pay goods_for_sv", "dtowequity", "eqy_to_debt",
    "bps,ebit_of_gr,bps",
)


def test_fix_ts_field_bug_repairs_official_field_names():
    fixed = _fix_ts_field_bug(TS_FIELD_BUGGY)
    assert fixed is not None
    for marker in TS_FIELD_FIXED_MARKERS:
        assert marker in fixed, f"缺少 {marker}"
    for marker in TS_FIELD_REMOVED_MARKERS:
        assert marker not in fixed, f"残留 {marker}"


def test_fix_ts_field_bug_idempotent_after_fix():
    fixed = _fix_ts_field_bug(TS_FIELD_BUGGY)
    assert _fix_ts_field_bug(fixed) is None


def test_fix_ts_field_bug_noop_when_no_bug():
    text = "import os\nprint('hi')\n"
    assert _fix_ts_field_bug(text) is None


PANDAS3_BUGGY = """        'history': {
            'pe': df['pe'].where(df['pe'] > 0).fillna(method='ffill').tolist(),
            'pb': df['pb'].where(df['pb'] > 0).fillna(method='ffill').tolist(),
        },
"""

PANDAS3_FIXED = """        'history': {
            'pe': df['pe'].where(df['pe'] > 0).ffill().tolist(),
            'pb': df['pb'].where(df['pb'] > 0).ffill().tolist(),
        },
"""


def test_fix_pandas3_ffill_repairs_without_double_dot():
    fixed = _fix_pandas3_ffill(PANDAS3_BUGGY)
    assert fixed == PANDAS3_FIXED
    assert "..ffill" not in fixed


def test_fix_pandas3_ffill_idempotent_after_fix():
    assert _fix_pandas3_ffill(PANDAS3_FIXED) is None


def test_fix_pandas3_ffill_noop_when_no_bug():
    text = "df['pe'].ffill().tolist()\n"
    assert _fix_pandas3_ffill(text) is None


PYWENCAI_HINT_BUGGY = """        try:
            import pywencai
            self.pywencai = pywencai
        except ImportError:
            self.pywencai = None
            self.available = False
            print("  ⚠️ pywencai 未安装，请执行: pip install pywencai", file=sys.stderr)
"""

PYWENCAI_HINT_FIXED = """        try:
            import pywencai
            self.pywencai = pywencai
        except ImportError:
            self.pywencai = None
            self.available = False
"""


def test_fix_pywencai_hint_removes_misleading_install_hint():
    fixed = _fix_pywencai_hint(PYWENCAI_HINT_BUGGY)
    assert fixed == PYWENCAI_HINT_FIXED


def test_fix_pywencai_hint_idempotent_after_fix():
    assert _fix_pywencai_hint(PYWENCAI_HINT_FIXED) is None


def test_fix_pywencai_hint_noop_when_no_hint():
    text = "import pywencai\nprint('hi')\n"
    assert _fix_pywencai_hint(text) is None


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
