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
3. **Tushare 字段名错误**（analyze_financial_deep / analyze_valuation_models，ts bug
   修复后的第 2 层）：请求的字段名与官方接口不符（inventory→inventories、
   fix_asset_total→fix_assets_total、total_current_assets→total_cur_assets、
   total_current_liab→total_cur_liab、bonds_payable→bond_payable、
   undistr_profit→undistr_porfit、oper_profit→operate_profit、
   minority_plr→minority_gain、n_cashflow_fnc_act→n_cash_flows_fnc_act、
   c_pay goods_for_sv→c_paid_goods_s（financial_deep 带空格）、
   c_pay_goods_for_sv→c_paid_goods_s（valuation_models 下划线拼写）、
   dtowequity→debt_to_eqt、eqy_to_debt→eqt_to_debt），无效字段被官方静默
   忽略 → 返回 DataFrame 缺列 → financial_deep 数据层 KeyError，
   valuation_models 因 _v() 容错返回 0 导致估值全 0（更隐蔽）；同时修复
   fields 重复字段（end_date×2、bps×2，pandas 3.0 抛 duplicate keys）与
   移除官方无此字段的 excite_income/excite_tax（含上游新结构
   excite_income,excite_tax,end_date,ann_date 与 deduct_income 两行写法）。
4. **pandas 3.0 兼容**（analyze_stock_valuation）：``fillna(method='ffill')``
   在 pandas 3.0 已移除（2.1 弃用），抛
   ``TypeError: NDFrame.fillna() got an unexpected keyword argument 'method'``。
   修复：改用 ``.ffill()``。
5. **pywencai 误导提示**（analyze_industry）：``__init__`` 在 pywencai
   缺失时打印 "请 pip install pywencai"，误导 Agent 去安装依赖而放弃
   网关 CLI 主路径。修复：删除该提示（主数据源为问财网关 CLI，纯标准库）。

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

# ── Tushare 字段名修复补丁（financial_deep / valuation_models）────────────
# 上游脚本 fields 中的字段名与官方接口不符，无效字段被官方静默忽略，
# 返回 DataFrame 缺列 → KeyError 或（_v 容错）静默全 0。同时修 fields
# 重复（pandas 3.0 duplicate keys）与空格/下划线拼写。幂等检测：已含
# 官方字段名则跳过。
_TS_FIELD_FIX_SCRIPTS = (
    "public/stock-analysis/scripts/analysis-engine/analyze_financial_deep.py",
    "public/stock-analysis/scripts/analysis-engine/analyze_valuation_models.py",
)

# (旧片段, 新片段) 精确替换对，覆盖 fields 定义与全部列名使用点
_TS_FIELD_REPLACEMENTS = (
    # income fields
    ("rd_exp,oper_profit,total_profit,", "rd_exp,operate_profit,total_profit,"),
    ("n_income,n_income_attr_p,minority_plr,", "n_income,n_income_attr_p,minority_gain,"),
    ("excite_income,excite_tax,ann_date", "ann_date"),
    # balancesheet fields
    ("money_cap,accounts_receiv,inventory,goodwill,", "money_cap,accounts_receiv,inventories,goodwill,"),
    ("cip,fix_asset_total,total_current_assets,total_current_liab,",
     "cip,fix_assets_total,total_cur_assets,total_cur_liab,"),
    ("st_borr,lt_borr,bonds_payable,", "st_borr,lt_borr,bond_payable,"),
    # valuation_models 变体：money_cap 开头的独立行（与 cip 行分开）
    ("money_cap,total_current_assets,total_current_liab,",
     "money_cap,total_cur_assets,total_cur_liab,"),
    ("undistr_profit,cap_rese,surplus_rese", "undistr_porfit,cap_rese,surplus_rese"),
    # 上游新结构：excite 后跟 end_date，直接删为 ann_date（头部已有 end_date，
    # 保留会造成 end_date 重复 → pandas 3.0 duplicate keys）
    ("excite_income,excite_tax,end_date,ann_date", "ann_date"),
    # cashflow fields
    ("n_cashflow_act,n_cashflow_inv_act,n_cashflow_fnc_act,",
     "n_cashflow_act,n_cashflow_inv_act,n_cash_flows_fnc_act,"),
    ("c_fr_sale_sg,c_pay goods_for_sv", "c_fr_sale_sg,c_paid_goods_s"),
    # fina_indicator fields
    ("grossprofit_margin,netprofit_margin,roe,roa,dtowequity,",
     "grossprofit_margin,netprofit_margin,roe,roa,debt_to_eqt,"),
    ("bps,ebit_of_gr,bps,cfps", "bps,ebit_of_gr,cfps"),
    ("eqy_to_debt,bps,ebit_of_gr,cfps", "eqt_to_debt,bps,ebit_of_gr,cfps"),
    # deduct_income 查询（官方无 excite_income/excite_tax 字段）
    ('report_type,n_income_attr_p,"\n                       "excite_income,excite_tax"',
     'report_type,n_income_attr_p"'),
    # valuation_models 特有字段顺序（与 financial_deep 不同）与下划线拼写
    ("goodwill,fix_asset_total,cip,inventory,",
     "goodwill,fix_assets_total,cip,inventories,"),
    ("c_pay_goods_for_sv", "c_paid_goods_s"),
    ("roe,roa,debt_to_assets,eps,dtowequity",
     "roe,roa,debt_to_assets,eps,debt_to_eqt"),
    # 使用点列名
    ('self._val(latest, "bonds_payable")', 'self._val(latest, "bond_payable")'),
    ('self._v(bal, "bonds_payable")', 'self._v(bal, "bond_payable")'),
    ('self._v(inc, "oper_profit")', 'self._v(inc, "operate_profit")'),
    ('balance[["end_date", "inventory"]]', 'balance[["end_date", "inventories"]]'),
    ('merged["inventory"]', 'merged["inventories"]'),
    ('self._val(latest, "fix_asset_total")', 'self._val(latest, "fix_assets_total")'),
    ('"oper_profit", "total_cogs"]].tail(4)', '"operate_profit", "total_cogs"]].tail(4)'),
    ('self._v(row, "oper_profit")', 'self._v(row, "operate_profit")'),
    ('self._v(latest, "n_cashflow_fnc_act")', 'self._v(latest, "n_cash_flows_fnc_act")'),
)

# ── pandas 3.0 兼容补丁（fillna method 移除）──────────────────────────────
_PANDAS3_FFILL_SCRIPTS = (
    "public/stock-analysis/scripts/analysis-engine/analyze_stock_valuation.py",
)

# ── pywencai 误导提示移除补丁（analyze_industry）──────────────────────────
_PYWENCAI_HINT_SCRIPTS = (
    "public/industry-analysis/scripts/analyze_industry.py",
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


def _fix_ts_field_bug(text: str) -> str | None:
    """修复 Tushare 字段名/重复字段 bug；已全部修复返回 None（幂等跳过）。

    幂等检测用「所有替换对均无命中」而非关键字段出现与否——上游可能处于
    部分修复状态（如 valuation_models 曾手工修过部分字段行），宽松检测会
    漏掉残留。
    """
    if all(old not in text for old, _ in _TS_FIELD_REPLACEMENTS):
        return None
    patched = text
    for old, new in _TS_FIELD_REPLACEMENTS:
        patched = patched.replace(old, new)
    if patched == text:
        return None
    return patched


def _fix_pandas3_ffill(text: str) -> str | None:
    """修复 pandas 3.0 fillna(method=...) 兼容；已修复返回 None（幂等跳过）。"""
    if "fillna(method=" not in text:
        return None
    # 替换串不带前导点：原文本 `.fillna(method='ffill')` 前导点保留，
    # 否则会生成 `..ffill()` 双点。
    return text.replace("fillna(method='ffill')", "ffill()")


def _fix_pywencai_hint(text: str) -> str | None:
    """移除 pywencai 缺失时的误导安装提示；已修复返回 None（幂等跳过）。"""
    pattern = re.compile(
        r'\n\s*print\("  ⚠️ pywencai 未安装，请执行: pip install pywencai", file=sys\.stderr\)'
    )
    if not pattern.search(text):
        return None
    return pattern.sub("", text)


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
    for rel_path in _TS_FIELD_FIX_SCRIPTS:
        target = vendor_root / rel_path
        if not target.exists():
            continue
        if _patch_file(target, rel_path, _fix_ts_field_bug):
            changed.append(rel_path)
    for rel_path in _PANDAS3_FFILL_SCRIPTS:
        target = vendor_root / rel_path
        if not target.exists():
            continue
        if _patch_file(target, rel_path, _fix_pandas3_ffill):
            changed.append(rel_path)
    for rel_path in _PYWENCAI_HINT_SCRIPTS:
        target = vendor_root / rel_path
        if not target.exists():
            continue
        if _patch_file(target, rel_path, _fix_pywencai_hint):
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
