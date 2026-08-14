# -*- coding: utf-8 -*-
"""scripts/patch_vendor_skills.py 技能补丁器测试。

覆盖 ts/np import bug 的修复正确性与幂等性，以及对临时 vendor 目录的
整包应用（不直接改真实 vendor，避免污染工作区）。
"""

from pathlib import Path

from scripts.patch_vendor_skills import (
    _BACKTEST_CLI_FIXES,
    _BACKTEST_ENGINE_FIXES,
    _fix_backtest_a_share,
    _fix_backtest_cli,
    _fix_np_bug,
    _fix_pandas3_ffill,
    _fix_pywencai_hint,
    _fix_scipy_soft_bs_model,
    _fix_scipy_soft_tas,
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


VALUATION_MODELS_BUGGY = """#!/usr/bin/env python3
import os

        df = self.pro.income(
            fields="ts_code,end_date,report_type,revenue,total_cogs,"
                   "sell_exp,admin_exp,rd_exp,oper_profit,total_profit,"
                   "n_income,n_income_attr_p,income_tax,ebit"
        )
        df2 = self.pro.balancesheet(
            fields="ts_code,end_date,report_type,"
                   "total_assets,total_liab,total_hldr_eqy_exc_min_int,"
                   "money_cap,total_current_assets,total_current_liab,"
                   "st_borr,lt_borr,bonds_payable,"
                   "goodwill,fix_asset_total,cip,inventory,"
                   "accounts_receiv,total_share"
        )
        df3 = self.pro.cashflow(
            fields="ts_code,end_date,report_type,"
                   "n_cashflow_act,c_pay_goods_for_sv,"
                   "c_fr_sale_sg,stot_invest_act,stot_fin_act,"
                   "c_pay_dist_dpcp_int_exp"
        )
        df4 = self.pro.fina_indicator(
            fields="ts_code,end_date,grossprofit_margin,netprofit_margin,"
                   "roe,roa,debt_to_assets,eps,dtowequity"
        )
        bonds = self._v(bal, "bonds_payable")
        op = self._v(inc, "oper_profit")
        capex = abs(self._v(cf, "stot_invest_act"))  # 近似
        df5 = self.pro.daily_basic(
            ts_code=ts_code,
            end_date=end_date,
            limit=fetch_n,
            fields='ts_code,trade_date,turnover_rate,turnover_rate_f,pe,pe_ttm,pb,total_mv,float_mv'
        )
"""

VALUATION_MODELS_FIXED_MARKERS = (
    "operate_profit", "total_cur_assets", "total_cur_liab", "bond_payable",
    "fix_assets_total", "inventories", "c_paid_goods_s", "debt_to_eqt",
    "c_pay_acq_const_fiolta", "circ_mv",
)

VALUATION_MODELS_REMOVED_MARKERS = (
    "oper_profit", "total_current_assets", "total_current_liab",
    "bonds_payable", "fix_asset_total", "dtowequity",
    "c_pay_goods_for_sv", "inventory", "stot_invest_act", "stot_fin_act",
    "float_mv",
)


def test_fix_ts_field_bug_repairs_valuation_models_field_names():
    fixed = _fix_ts_field_bug(VALUATION_MODELS_BUGGY)
    assert fixed is not None
    for marker in VALUATION_MODELS_FIXED_MARKERS:
        assert marker in fixed, f"缺少 {marker}"
    for marker in VALUATION_MODELS_REMOVED_MARKERS:
        assert marker not in fixed, f"残留 {marker}"


def test_fix_ts_field_bug_repairs_upstream_excite_new_order():
    """上游新结构：excite_income,excite_tax,end_date,ann_date（end_date 居中，
    头部已有 end_date，须整段删除避免重复列）。"""
    buggy = (
        'fields="ts_code,end_date,report_type,revenue,total_cogs,"\n'
        '                   "excite_income,excite_tax,end_date,ann_date"\n'
    )
    fixed = _fix_ts_field_bug(buggy)
    assert fixed is not None
    assert "excite_income" not in fixed
    assert "excite_tax" not in fixed
    assert 'ann_date"' in fixed
    assert "end_date,ann_date" not in fixed
    assert fixed.count("end_date") == 1


def test_fix_ts_field_bug_valuation_models_idempotent_after_fix():
    fixed = _fix_ts_field_bug(VALUATION_MODELS_BUGGY)
    assert _fix_ts_field_bug(fixed) is None


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


BS_MODEL_BUGGY = """import numpy as np
from scipy.stats import norm
from scipy.optimize import brentq
from typing import Literal


def bs_price(S, K, T, r, sigma, option_type, q=0.0):
    d1 = (np.log(S / K) + (r - q + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    price = S * np.exp(-q * T) * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)
    return float(price)


def bs_greeks(S, K, T, r, sigma, option_type, q=0.0):
    n_prime_d1 = norm.pdf(d1)
    return n_prime_d1


def bs_iv(S, K, T, r, market_price, option_type, q=0.0):
    try:
        return float(brentq(
            lambda v: bs_price(S, K, T, r, v, option_type, q) - market_price,
            1e-4, 10.0, xtol=1e-6, maxiter=200,
        ))
    except ValueError:
        return np.nan
"""


def test_fix_scipy_soft_bs_model_repairs_hard_import():
    fixed = _fix_scipy_soft_bs_model(BS_MODEL_BUGGY)
    assert fixed is not None
    assert "_HAS_SCIPY" in fixed
    assert "_norm_cdf(" in fixed and "norm.cdf(" not in fixed
    assert "_norm_pdf(" in fixed and "norm.pdf(" not in fixed
    assert "_brentq(" in fixed and "float(brentq(" not in fixed
    assert "from scipy.stats import norm\n" not in fixed
    assert "import math\n" in fixed


def test_fix_scipy_soft_bs_model_numeric_fallback():
    """降级路径数值正确性：A&S CDF 近似 + 二分法求根。"""
    import builtins

    fixed = _fix_scipy_soft_bs_model(BS_MODEL_BUGGY)
    # 强制屏蔽 scipy，确保执行到纯 Python 降级分支（与 runtime 环境一致）
    real_import = builtins.__import__

    def _no_scipy(name, *args, **kwargs):
        if name == "scipy" or name.startswith("scipy."):
            raise ImportError("scipy disabled for test")
        return real_import(name, *args, **kwargs)

    builtins.__import__ = _no_scipy
    try:
        ns: dict = {}
        exec(compile(fixed, "bs_model", "exec"), ns)
    finally:
        builtins.__import__ = real_import
    assert ns["_HAS_SCIPY"] is False
    cdf = ns["_norm_cdf"]
    assert abs(cdf(0.0) - 0.5) < 1e-7
    assert abs(cdf(1.96) - 0.975) < 1e-4
    assert abs(cdf(-1.96) - 0.025) < 1e-4
    pdf = ns["_norm_pdf"]
    assert abs(pdf(0.0) - 0.3989422804014327) < 1e-12
    root = ns["_brentq"](lambda v: v * v - 2.0, 1.0, 2.0, xtol=1e-9, maxiter=200)
    assert abs(root - 2 ** 0.5) < 1e-6


def test_fix_scipy_soft_bs_model_idempotent():
    fixed = _fix_scipy_soft_bs_model(BS_MODEL_BUGGY)
    assert _fix_scipy_soft_bs_model(fixed) is None


def test_fix_scipy_soft_tas_repairs_function_level_import():
    buggy = (
        "    # 检测局部高低点\n"
        "    from scipy.signal import argrelextrema\n"
        "    try:\n"
        "        price_max_idx = argrelextrema(recent_close, np.greater, order=5)[0]\n"
        "    except Exception:\n"
        "        return create_single_signal(k1=k1, k2=k2, k3=k3, v1=\"其他\")\n"
    )
    fixed = _fix_scipy_soft_tas(buggy)
    assert fixed is not None
    assert "try:\n        from scipy.signal import argrelextrema\n" in fixed
    assert "argrelextrema = None" in fixed
    assert "except Exception:\n        return create_single_signal" in fixed
    assert _fix_scipy_soft_tas(fixed) is None


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
        [
            f"{rel}/analyze_financial_deep.py",
            f"{rel}/analyze_stock_valuation.py",
            # 行情缓存模块：规范源码拷贝（对稀疏 tmp vendor 也会创建）
            "public/common/src/kk_common/market_data_cache.py",
        ]
    )
    assert "if get_finance_data_gateway and token:" in ts_target.read_text(encoding="utf-8")
    assert "import numpy as np" in np_target.read_text(encoding="utf-8")

    # 幂等：第二次应用无改动
    assert apply_skill_patches(vendor_root=tmp_path) == []


def test_backtest_a_share_patch_round_trip():
    """回测引擎 A股规则补丁必须能从上游形态精确重建当前 vendor 文件。

    上游同步会整体覆盖 vendor/skills，本测试保证补丁对 (old→new) 与
    当前文件严格一致：逆向还原出上游形态 → 重放补丁 → 必须逐字节还原。
    """
    vendor_root = Path(__file__).resolve().parent.parent / "vendor" / "skills"
    cases = (
        (
            "public/strategy-research/scripts/analysis/backtest_engine.py",
            _BACKTEST_ENGINE_FIXES,
            _fix_backtest_a_share,
        ),
        (
            "public/strategy-research/scripts/cli.py",
            _BACKTEST_CLI_FIXES,
            _fix_backtest_cli,
        ),
    )
    for rel_path, fixes, fix_fn in cases:
        current = (vendor_root / rel_path).read_text(encoding="utf-8")
        # 幂等：已修复文件不再改动
        assert fix_fn(current) is None, f"{rel_path} 补丁不幂等"
        # 逆向还原出上游形态，再应用补丁必须精确重建当前文件
        upstream_like = current
        for old, new in fixes:
            assert new in upstream_like, f"{rel_path} 缺少补丁目标片段"
            upstream_like = upstream_like.replace(new, old, 1)
        assert fix_fn(upstream_like) == current, f"{rel_path} 补丁无法精确重建"


def test_apply_skill_patches_repaired_vendor_scripts_are_syntactically_valid():
    """真实 vendor 中目标脚本补丁后必须保持语法有效。"""
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
        "public/strategy-research/scripts/analysis/backtest_engine.py",
        "public/strategy-research/scripts/cli.py",
    )
    for rel in targets:
        py_compile.compile(str(vendor_root / rel), doraise=True)
    # 幂等
    assert apply_skill_patches(vendor_root=vendor_root) == []


def test_market_data_cache_module_matches_canonical_copy():
    """scripts/patches 规范源码与技能树拷贝必须逐字节一致。

    修改缓存模块时若只改了一份（上游同步会以规范源码覆盖技能树），
    本测试立即暴露漂移。
    """
    from scripts.patch_vendor_skills import _MARKET_DATA_CACHE_MODULE_PATH

    canonical = (
        Path(__file__).resolve().parent.parent / "scripts" / "patches" / "market_data_cache.py"
    )
    vendor_copy = (
        Path(__file__).resolve().parent.parent / "vendor" / "skills" / _MARKET_DATA_CACHE_MODULE_PATH
    )
    assert canonical.exists()
    assert vendor_copy.exists()
    assert canonical.read_text(encoding="utf-8") == vendor_copy.read_text(encoding="utf-8")


def test_finance_gateway_cache_weave_round_trip():
    """网关缓存织入补丁必须能从上游形态精确重建当前 vendor 文件。"""
    from scripts.patch_vendor_skills import _FINANCE_GATEWAY_FIXES, _fix_finance_gateway_cache

    vendor_root = Path(__file__).resolve().parent.parent / "vendor" / "skills"
    rel = "public/common/src/kk_common/finance_data_gateway.py"
    current = (vendor_root / rel).read_text(encoding="utf-8")
    assert _fix_finance_gateway_cache(current) is None

    upstream_like = current
    for old, new in _FINANCE_GATEWAY_FIXES:
        assert new in upstream_like
        upstream_like = upstream_like.replace(new, old, 1)
    assert _fix_finance_gateway_cache(upstream_like) == current
