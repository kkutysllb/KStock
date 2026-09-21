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
6. **tushare 软导入**（tushare_client）：``import tushare as ts`` 是模块级
   硬导入，CI/网关环境（uv sync 只装 pyproject 依赖，无 tushare）下
   ``import kk_common.tushare_client`` 即崩，拖垮依赖它的数据网关与测试。
   修复：软导入 + ``_TUSHARE_AVAILABLE`` 标志，TushareClient 实例化时
   才抛明确的 ImportError（沙箱运行时装了 tushare，行为不变）。
7. **preset 随行技能目录发布**（vendor/skills/public → 各角色
   preset/skills/，按 skills.manifest.json 子集）：技能随 preset 分发（cordis preset 模式，
   skill-filesystem 行以 baseUrl 指向 preset 自身 skills/ 子目录）。技能
   路径解析由 skill 工具加载结果内建（"Base directory for this skill" +
   相对路径按基目录解析），上游 SKILL.md 文本不做路径改写。
8. **KStock 自有技能 ensure**（kstock/skills/ → vendor/skills/public/）：
   html-report（自研渲染器）、market-linkage（市场联动场景编排手册）、
   sandbox-path-guide（2.0 工作区路径纪律整体重写版，替换上游 1.x 虚拟
   路径版）。源码在 kstock/skills 下不受上游同步影响，每次补丁执行时
   与 vendor 比对并按需覆盖；ensure 后一并发布进 preset 随行目录。

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

# ── Tushare 字段名修复补丁（financial_deep / valuation_models / technical_analyzer）─
# 上游脚本 fields 中的字段名与官方接口不符，无效字段被官方静默忽略，
# 返回 DataFrame 缺列 → KeyError 或（_v 容错）静默全 0。同时修 fields
# 重复（pandas 3.0 duplicate keys）与空格/下划线拼写。幂等检测：已含
# 官方字段名则跳过。
_TS_FIELD_FIX_SCRIPTS = (
    "public/stock-analysis/scripts/analysis-engine/analyze_financial_deep.py",
    "public/stock-analysis/scripts/analysis-engine/analyze_valuation_models.py",
    "public/stock-analysis/scripts/analysis-engine/technical_analyzer.py",
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
    # cashflow：stot_* 全部非官方字段（实测官方为 stot_inflows_inv_act /
    # stot_cash_in_fnc_act / c_pay_acq_const_fiolta）；fields 中 stot_fin_act
    # 无使用点直接删除，stot_invest_act 用于 FCFF 的 capex 近似 → 换官方
    # c_pay_acq_const_fiolta（购建固定/无形/其他长期资产支付的现金）
    ("c_fr_sale_sg,stot_invest_act,stot_fin_act,",
     "c_fr_sale_sg,c_pay_acq_const_fiolta,"),
    ('self._v(cf, "stot_invest_act")', 'self._v(cf, "c_pay_acq_const_fiolta")'),
    # daily_basic：float_mv 非官方字段（官方流通市值为 circ_mv）
    ("total_mv,float_mv'", "total_mv,circ_mv'"),
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

# ── scipy 软依赖补丁（bs_model / tas）──────────────────────────────────────
# runtime 环境（build-gateway-bundle.sh 只装 pandas/tushare/akshare/common）
# 无 scipy：options-payoff 的 bs_model 顶层硬导入（import 即崩），缠论 tas.py
# 函数内硬导入 argrelextrema（运行到背驰检测才崩）。与上游 option_futures_
# analyzer 降级模式一致：A&S 26.2.17 正态 CDF 近似 + 二分法求根。
_SCIPY_SOFT_SCRIPTS = (
    "public/options-payoff/scripts/analysis-engine/bs_model.py",
    "public/stock-analysis/chan_theory_v2/signals/tas.py",
)

_BS_MODEL_IMPORT_OLD = (
    "import numpy as np\n"
    "from scipy.stats import norm\n"
    "from scipy.optimize import brentq\n"
    "from typing import Literal"
)
_BS_MODEL_IMPORT_NEW = (
    "import math\n"
    "import numpy as np\n"
    "from typing import Literal\n"
    "\n"
    "# scipy 软依赖（与 option_futures_analyzer 同模式）：runtime 无 scipy 时\n"
    "# 降级为纯 Python 实现（A&S 26.2.17 正态近似 + 二分法求根）\n"
    "try:\n"
    "    from scipy.stats import norm as _scipy_normal\n"
    "    from scipy.optimize import brentq as _scipy_brentq\n"
    "    _HAS_SCIPY = True\n"
    "except Exception:\n"
    "    _scipy_normal = None\n"
    "    _HAS_SCIPY = False\n"
    "\n"
    "\n"
    "def _norm_cdf(x: float) -> float:\n"
    "    \"\"\"标准正态 CDF；有 scipy 用 scipy，否则 A&S 26.2.17 近似（误差 < 1e-7）。\"\"\"\n"
    "    if _HAS_SCIPY:\n"
    "        return _scipy_normal.cdf(x)\n"
    "    x = float(x)\n"
    "    t = 1.0 / (1.0 + 0.2316419 * abs(x))\n"
    "    d = 0.3989422804014327 * math.exp(-0.5 * x * x)\n"
    "    p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))\n"
    "    return 1.0 - p if x > 0 else p\n"
    "\n"
    "\n"
    "def _norm_pdf(x: float) -> float:\n"
    "    \"\"\"标准正态 PDF。\"\"\"\n"
    "    if _HAS_SCIPY:\n"
    "        return _scipy_normal.pdf(x)\n"
    "    return 0.3989422804014327 * math.exp(-0.5 * x * x)\n"
    "\n"
    "\n"
    "def _brentq(f, a: float, b: float, **kwargs) -> float:\n"
    "    \"\"\"求根；有 scipy 用 brentq，否则二分法（xtol/maxiter 兼容）。\"\"\"\n"
    "    if _HAS_SCIPY:\n"
    "        return _scipy_brentq(f, a, b, **kwargs)\n"
    "    xtol = kwargs.get(\"xtol\", 1e-8)\n"
    "    maxiter = kwargs.get(\"maxiter\", 100)\n"
    "    fa, fb = f(a), f(b)\n"
    "    if fa * fb > 0:\n"
    "        raise ValueError(\"f(a) and f(b) must have opposite signs\")\n"
    "    for _ in range(maxiter):\n"
    "        mid = (a + b) / 2.0\n"
    "        fm = f(mid)\n"
    "        if abs(fm) < xtol or (b - a) / 2.0 < xtol:\n"
    "            return mid\n"
    "        if fa * fm <= 0:\n"
    "            b, fb = mid, fm\n"
    "        else:\n"
    "            a, fa = mid, fm\n"
    "    return (a + b) / 2.0\n"
)

_BS_MODEL_CALL_REPLACEMENTS = (
    ("norm.cdf(", "_norm_cdf("),
    ("norm.pdf(", "_norm_pdf("),
    ("float(brentq(", "float(_brentq("),
)

_TAS_ARGS_REPLACEMENTS = (
    # 用前一行注释锚定，避免 8 空格缩进行包含 4 空格子串导致幂等误判
    ("    # 检测局部高低点\n    from scipy.signal import argrelextrema\n",
     "    # 检测局部高低点\n    try:\n        from scipy.signal import argrelextrema\n    except Exception:\n        argrelextrema = None\n"),
)


# ── 回测引擎 A股交易规则补丁（strategy-research）──────────────────────────
# 上游 backtest_engine 自述「简化回测引擎」：无 T+1/涨跌停/停牌/整手/印花税/
# 最低佣金/滑点建模，回测结果对 A 股不具可信度。本补丁补齐 A 股微观规则，
# 默认启用（enforce_a_share_rules=True），传 False 可回到上游简化语义。
_BACKTEST_ENGINE_PATH = "public/strategy-research/scripts/analysis/backtest_engine.py"
_BACKTEST_CLI_PATH = "public/strategy-research/scripts/cli.py"

_BACKTEST_ENGINE_FIXES = (
    (
        '''  - 调仓记录: 信号变化时的买卖明细（调仓前后持仓对比）
"""

import json
import os
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd


def run_backtest(''',
        '''  - 调仓记录: 信号变化时的买卖明细（调仓前后持仓对比）
  - A股交易规则: T+1、涨跌停（收盘触板不成交）、停牌/零成交量的信号顺延、
    整手(100股)交易、佣金最低5元、卖出印花税、过户费、滑点
"""

import json
import os
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd


def _board_limit_ratio(code: str) -> float:
    """按代码板块推断涨跌停幅度。

    创业板(300/301)与科创板(688/689) 20%，北交所(4/8/92 开头) 30%，其余 10%。
    ST 股票 5% 无法从代码判断，用 limit_ratio_overrides 显式指定。
    """
    pure = str(code).split(".")[0]
    if pure.startswith(("300", "301", "688", "689")):
        return 0.20
    if pure.startswith(("4", "8", "92")):
        return 0.30
    return 0.10


def _limit_prices(prev_close: float, code: str, overrides: Dict[str, float]) -> Tuple[float, float]:
    """按前收盘计算涨停/跌停价（交易所规则：前收盘×(1±幅度)四舍五入到分）。"""
    ratio = overrides.get(code) or _board_limit_ratio(code)
    limit_up = round(prev_close * (1 + ratio), 2)
    limit_down = round(prev_close * (1 - ratio), 2)
    return limit_up, limit_down


def run_backtest(''',
    ),
    (
        '''    initial_cash: float = 1_000_000,
    commission: float = 0.001,
    record_positions: bool = True,
) -> Dict:
    """
    简化回测引擎：根据信号计算策略表现。

    Args:
        data_map: code -> DataFrame (columns: open, high, low, close, volume)
        signals: code -> signal Series (value in [-1.0, 1.0])
        initial_cash: 初始资金
        commission: 单边手续费率
        record_positions: 是否记录每日持仓快照

    Returns:
        dict with metrics, equity curve, trade log, position snapshots, rebalance records
    """''',
        '''    initial_cash: float = 1_000_000,
    commission: float = 0.001,
    record_positions: bool = True,
    enforce_a_share_rules: bool = True,
    stamp_duty: float = 0.0005,
    transfer_fee: float = 0.00001,
    min_commission: float = 5.0,
    slippage: float = 0.0,
    limit_ratio_overrides: Optional[Dict[str, float]] = None,
) -> Dict:
    """
    回测引擎：根据信号计算策略表现。

    Args:
        data_map: code -> DataFrame (columns: open, high, low, close, volume)
        signals: code -> signal Series (value in [-1.0, 1.0])
        initial_cash: 初始资金
        commission: 单边佣金率（万2.5 传 0.00025）
        record_positions: 是否记录每日持仓快照
        enforce_a_share_rules: 是否执行 A 股交易规则
            （T+1、涨跌停、停牌顺延、整手、最低佣金、印花税、过户费）。
            False 时回到简化语义（仅单边佣金率，可负持仓不设限）。
        资金分配：开仓按「当日非零信号数」等分可用权益（|sig| 缩放强度），
            top-K 稀疏组合满仓；全部同向的密集信号与旧 len(codes) 语义一致。
        stamp_duty: 印花税率，仅卖出收取（2023-08-28 起为 0.0005）
        transfer_fee: 过户费率，双边收取（0.00001 = 万0.1）
        min_commission: 单笔最低佣金（元，A股常见为 5 元；0 表示不启用下限）
        slippage: 滑点比例（0.001 = 买入价上浮 0.1%、卖出价下浮 0.1%）
        limit_ratio_overrides: 个股涨跌停幅度覆盖（如 ST 股 {"XXX.XX": 0.05}）

    Returns:
        dict with metrics, equity curve, trade log, position snapshots, rebalance records
    """''',
    ),
    (
        '''    prev_signals = {c: 0.0 for c in codes}
    total_commission = 0.0
''',
        '''    prev_signals = {c: 0.0 for c in codes}
    total_commission = 0.0
    # A股规则状态：last_closes 用于涨跌停基准价；last_buy_date 用于 T+1 判定。
    # 主循环从第二个交易日开始，首日收盘需预载，否则第二日无涨跌停基准。
    last_closes: Dict[str, float] = {}
    last_buy_date: Dict[str, object] = {}
    limit_overrides: Dict[str, float] = limit_ratio_overrides or {}
    for c in codes:
        if not data_map[c].empty:
            first_close = data_map[c].iloc[0].get("close", np.nan)
            if pd.notna(first_close):
                last_closes[c] = float(first_close)

    def _trade_cost(notional: float, is_sell: bool) -> float:
        """按规则计算单笔交易成本；简化模式下仅单边佣金率。"""
        if not enforce_a_share_rules:
            return abs(notional * commission)
        if notional <= 0:
            return 0.0
        cost = notional * commission
        if min_commission > 0:
            cost = max(cost, min_commission)
        cost += notional * transfer_fee
        if is_sell:
            cost += notional * stamp_duty
        return cost
''',
    ),
    (
        '''    for i, dt in enumerate(all_dates[1:], 1):
        daily_pnl = 0.0
        daily_rebalance_actions = []  # 当日调仓动作

        for code in codes:
            if dt not in data_map[code].index:
                continue
            row = data_map[code].loc[dt]
            close = row.get("close", np.nan)
            if pd.isna(close):
                continue

            sig = 0.0
            if code in signals and dt in signals[code].index:
                sig = float(signals[code].loc[dt])

            # 限制信号范围
            sig = max(-1.0, min(1.0, sig))

            # 检测信号变化 → 交易
            prev_sig = prev_signals.get(code, 0.0)
            if sig != prev_sig and i > 0:
                rebalance = {
                    "date": str(dt.date()),
                    "code": code,
                    "signal_before": round(prev_sig, 4),
                    "signal_after": round(sig, 4),
                }

                # 平旧仓位
                if positions[code] != 0:
                    old_qty = positions[code]
                    old_cost = cost_basis[code]
                    close_pnl = old_qty * (close - old_cost)
                    cost = abs(old_qty * close * commission)
                    daily_pnl += close_pnl - cost
                    total_commission += cost
                    trades.append({
                        "date": str(dt.date()),
                        "code": code,
                        "action": "close" if old_qty > 0 else "cover",
                        "price": round(close, 4),
                        "quantity": round(abs(old_qty), 4),
                        "cost_price": round(old_cost, 4),
                        "realized_pnl": round(close_pnl - cost, 2),
                    })
                    rebalance["action_close"] = {
                        "direction": "long" if old_qty > 0 else "short",
                        "quantity": round(abs(old_qty), 4),
                        "price": round(close, 4),
                        "realized_pnl": round(close_pnl - cost, 2),
                    }

                # 开新仓位
                if sig != 0:
                    alloc = equity[-1] * abs(sig) / len(codes)
                    qty = alloc / close * sig
                    cost = abs(alloc * commission)
                    daily_pnl -= cost
                    total_commission += cost
                    positions[code] = qty
                    cost_basis[code] = close
                    trades.append({
                        "date": str(dt.date()),
                        "code": code,
                        "action": "buy" if sig > 0 else "sell",
                        "price": round(close, 4),
                        "quantity": round(abs(qty), 4),
                        "cost_price": round(close, 4),
                        "realized_pnl": 0.0,
                    })
                    rebalance["action_open"] = {
                        "direction": "long" if sig > 0 else "short",
                        "quantity": round(abs(qty), 4),
                        "price": round(close, 4),
                        "signal_strength": round(abs(sig), 4),
                    }
                else:
                    positions[code] = 0.0
                    cost_basis[code] = 0.0
                prev_signals[code] = sig
                rebalance_records.append(rebalance)
''',
        '''    for i, dt in enumerate(all_dates[1:], 1):
        daily_pnl = 0.0
        daily_rebalance_actions = []  # 当日调仓动作
        # 当日活跃信号数：开仓资金按活跃标的等分（修复 top-K 稀疏组合
        # 只用 |sig|/全宇宙 比例资金的问题——500 只池选 10 只旧公式只投
        # 2% 资金）。全部同向的密集信号下 active==len(codes)，与旧语义一致。
        active_count = 0
        for code in codes:
            sig_now = 0.0
            if code in signals and dt in signals[code].index:
                sig_now = float(signals[code].loc[dt])
            if sig_now != 0:
                active_count += 1

        for code in codes:
            if dt not in data_map[code].index:
                continue
            row = data_map[code].loc[dt]
            close = row.get("close", np.nan)
            if pd.isna(close):
                continue

            sig = 0.0
            if code in signals and dt in signals[code].index:
                sig = float(signals[code].loc[dt])

            # 限制信号范围
            sig = max(-1.0, min(1.0, sig))

            # 滑点执行价：买入上浮、卖出下浮（简化模式下即收盘价）
            buy_price = close * (1 + slippage) if enforce_a_share_rules else close
            sell_price = close * (1 - slippage) if enforce_a_share_rules else close

            # 检测信号变化 → 交易
            prev_sig = prev_signals.get(code, 0.0)
            if sig != prev_sig and i > 0:
                rebalance = {
                    "date": str(dt.date()),
                    "code": code,
                    "signal_before": round(prev_sig, 4),
                    "signal_after": round(sig, 4),
                }

                # ── A股可交易性检查：被阻的调仓整体顺延到下一交易日 ──
                blocked = None
                if enforce_a_share_rules:
                    vol = row.get("volume", np.nan)
                    if pd.notna(vol) and float(vol) <= 0:
                        blocked = "suspended_zero_volume"
                    else:
                        ref_close = last_closes.get(code)
                        if ref_close:
                            limit_up, limit_down = _limit_prices(ref_close, code, limit_overrides)
                            at_limit_up = close >= limit_up - 1e-6
                            at_limit_down = close <= limit_down + 1e-6
                            needs_buy = sig > 0 or positions[code] < 0  # 开多或平空
                            needs_sell = sig < 0 or positions[code] > 0  # 开空或平多
                            if needs_buy and at_limit_up:
                                blocked = "limit_up"
                            elif needs_sell and at_limit_down:
                                blocked = "limit_down"
                            elif positions[code] > 0 and last_buy_date.get(code) == dt:
                                blocked = "t_plus_1"

                if blocked is not None:
                    # 不成交、不更新 prev_signals：信号在下一交易日重试。
                    rebalance["blocked"] = blocked
                    rebalance_records.append(rebalance)
                else:
                    # 平旧仓位
                    if positions[code] != 0:
                        old_qty = positions[code]
                        old_cost = cost_basis[code]
                        px = sell_price if old_qty > 0 else buy_price
                        close_pnl = old_qty * (px - old_cost)
                        cost = _trade_cost(abs(old_qty) * px, is_sell=old_qty > 0)
                        daily_pnl += close_pnl - cost
                        total_commission += cost
                        trades.append({
                            "date": str(dt.date()),
                            "code": code,
                            "action": "close" if old_qty > 0 else "cover",
                            "price": round(px, 4),
                            "quantity": round(abs(old_qty), 4),
                            "cost_price": round(old_cost, 4),
                            "realized_pnl": round(close_pnl - cost, 2),
                        })
                        rebalance["action_close"] = {
                            "direction": "long" if old_qty > 0 else "short",
                            "quantity": round(abs(old_qty), 4),
                            "price": round(px, 4),
                            "realized_pnl": round(close_pnl - cost, 2),
                        }
                        if old_qty > 0:
                            last_buy_date.pop(code, None)

                    # 开新仓位
                    open_blocked = False
                    if sig != 0:
                        alloc = equity[-1] * abs(sig) / max(1, active_count)
                        px = buy_price if sig > 0 else sell_price
                        raw_qty = alloc / px
                        qty_abs = None
                        if enforce_a_share_rules:
                            lots = int(raw_qty // 100)
                            # 整手交易：不足一手不成交（开仓顺延到下一交易日重试）
                            qty_abs = lots * 100.0 if lots >= 1 else None
                        else:
                            qty_abs = raw_qty
                        if qty_abs is None:
                            open_blocked = True
                            rebalance["blocked"] = "insufficient_for_one_lot"
                        else:
                            qty = qty_abs if sig > 0 else -qty_abs
                            cost = _trade_cost(qty_abs * px, is_sell=sig < 0)
                            daily_pnl -= cost
                            total_commission += cost
                            positions[code] = qty
                            cost_basis[code] = px
                            if qty > 0:
                                last_buy_date[code] = dt
                            trades.append({
                                "date": str(dt.date()),
                                "code": code,
                                "action": "buy" if sig > 0 else "sell",
                                "price": round(px, 4),
                                "quantity": round(qty_abs, 4),
                                "cost_price": round(px, 4),
                                "realized_pnl": 0.0,
                            })
                            rebalance["action_open"] = {
                                "direction": "long" if sig > 0 else "short",
                                "quantity": round(qty_abs, 4),
                                "price": round(px, 4),
                                "signal_strength": round(abs(sig), 4),
                            }
                    else:
                        positions[code] = 0.0
                        cost_basis[code] = 0.0
                    if not open_blocked:
                        prev_signals[code] = sig
                    rebalance_records.append(rebalance)
''',
    ),
    (
        '''            # 持仓盈亏
            if positions[code] != 0 and (i > 0):
                prev_dt = all_dates[i - 1]
                if prev_dt in data_map[code].index:
                    prev_close = data_map[code].loc[prev_dt].get("close", close)
                    daily_pnl += positions[code] * (close - prev_close)
''',
        '''            # 持仓盈亏（用该标的上一有效收盘：停牌缺口期间损益正确累计）
            if positions[code] != 0 and (i > 0):
                prev_close = last_closes.get(code)
                if prev_close is not None:
                    daily_pnl += positions[code] * (close - prev_close)

            if pd.notna(close):
                last_closes[code] = float(close)
''',
    ),
    (
        '''    # 计算指标
    equity_series = pd.Series(equity, index=equity_dates)
    metrics = _compute_metrics(equity_series, initial_cash, len(trades))
    metrics["total_commission"] = round(total_commission, 2)

    return {
        "metrics": metrics,
''',
        '''    # 计算指标
    equity_series = pd.Series(equity, index=equity_dates)
    metrics = _compute_metrics(equity_series, initial_cash, len(trades))
    metrics["total_commission"] = round(total_commission, 2)

    a_share_rules_summary = {
        "enabled": enforce_a_share_rules,
        "commission_rate": commission,
        "min_commission": min_commission if enforce_a_share_rules else None,
        "stamp_duty_sell": stamp_duty if enforce_a_share_rules else None,
        "transfer_fee": transfer_fee if enforce_a_share_rules else None,
        "slippage": slippage if enforce_a_share_rules else None,
        "lot_size": 100 if enforce_a_share_rules else None,
        "t_plus_1": enforce_a_share_rules,
        "blocked_rebalances": sum(1 for r in rebalance_records if r.get("blocked")),
    }

    return {
        "metrics": metrics,
        "a_share_rules": a_share_rules_summary,
''',
    ),
)


_BACKTEST_CLI_FIXES = (
    (
        '''    p_demo.add_argument("--cash", type=float, default=1_000_000, help="初始资金")
    p_demo.add_argument("--commission", type=float, default=0.001, help="手续费率")
''',
        '''    p_demo.add_argument("--cash", type=float, default=1_000_000, help="初始资金")
    p_demo.add_argument("--commission", type=float, default=0.001, help="手续费率")
    p_demo.add_argument("--slippage", type=float, default=0.0, help="滑点比例（0.001 = 0.1%）")
    p_demo.add_argument("--no-a-share-rules", action="store_true",
                        help="关闭A股交易规则（T+1/涨跌停/整手/最低佣金/印花税，回到简化回测）")
''',
    ),
    (
        '''    result = run_backtest(data_map, signals, initial_cash=args.cash, commission=args.commission)
''',
        '''    result = run_backtest(
        data_map, signals,
        initial_cash=args.cash,
        commission=args.commission,
        slippage=args.slippage,
        enforce_a_share_rules=not args.no_a_share_rules,
    )
''',
    ),
)


def _fix_backtest_a_share(text: str) -> str | None:
    """backtest_engine：补齐 A股交易规则；已修复返回 None（幂等跳过）。

    幂等标记用 _board_limit_ratio（新增的模块级函数）：状态初始化补丁对
    的 old 文本是 new 文本的前缀，不能靠 old 缺席判断是否已应用。
    """
    if "_board_limit_ratio" in text:
        return None
    patched = text
    for old, new in _BACKTEST_ENGINE_FIXES:
        patched = patched.replace(old, new, 1)
    if patched == text:
        return None
    return patched


def _fix_backtest_cli(text: str) -> str | None:
    """cli.py：demo 回测暴露 A股规则开关；已修复返回 None（幂等跳过）。"""
    if "--no-a-share-rules" in text:
        return None
    patched = text
    for old, new in _BACKTEST_CLI_FIXES:
        patched = patched.replace(old, new, 1)
    if patched == text:
        return None
    return patched


# ── tushare 软导入补丁（common/kk_common/tushare_client）────────────────
# 模块级硬导入 tushare：CI/网关环境无 tushare 时 import 即崩。软导入 +
# 实例化时检查，保证无 tushare 环境也能 import 本模块（数据请求才失败）。
_TUSHARE_CLIENT_PATH = "public/common/src/kk_common/tushare_client.py"

_TUSHARE_CLIENT_FIXES = (
    (
        "import pandas as pd\nimport tushare as ts\nfrom dotenv import load_dotenv\n",
        "import pandas as pd\n\n"
        "try:\n"
        "    import tushare as ts\n"
        "    _TUSHARE_AVAILABLE = True\n"
        "except ImportError:  # KStock patch: tushare 非必需依赖，软导入避免 import 即崩\n"
        "    ts = None\n"
        "    _TUSHARE_AVAILABLE = False\n"
        "\n"
        "from dotenv import load_dotenv\n",
    ),
    (
        "        self.token = token or os.getenv('TUSHARE_TOKEN')\n"
        "        if not self.token:\n"
        "            raise ValueError(\"未找到 TUSHARE_TOKEN，请配置环境变量或在 .env 文件中设置\")\n",
        "        if not _TUSHARE_AVAILABLE:\n"
        "            raise ImportError(\"tushare 未安装：无法访问 Tushare 数据（请安装 tushare 或 tushare-data 运行时）\")\n"
        "        self.token = token or os.getenv('TUSHARE_TOKEN')\n"
        "        if not self.token:\n"
        "            raise ValueError(\"未找到 TUSHARE_TOKEN，请配置环境变量或在 .env 文件中设置\")\n",
    ),
)


# ── 行情数据磁盘缓存补丁（common/kk_common）──────────────────────────────
# 每次任务在线重拉同样的历史行情，重复消耗 Tushare 积分。规范源码保存在
# scripts/patches/market_data_cache.py（KStock 自有，同步不覆盖），由补丁
# 脚本拷贝进技能树；FinanceDataGateway.request 织入缓存包装。
_MARKET_DATA_CACHE_MODULE_PATH = "public/common/src/kk_common/market_data_cache.py"
_FINANCE_GATEWAY_PATH = "public/common/src/kk_common/finance_data_gateway.py"

_FINANCE_GATEWAY_FIXES = (
    (
        "from kk_common.tushare_client import TushareClient, get_tushare_client\n",
        "from kk_common import market_data_cache\n"
        "from kk_common.tushare_client import TushareClient, get_tushare_client\n",
    ),
    (
        '''    def request(self, endpoint: str, **kwargs: Any) -> pd.DataFrame:
        return _as_dataframe(self.adapter.request(endpoint, **kwargs))
''',
        '''    def request(self, endpoint: str, **kwargs: Any) -> pd.DataFrame:
        # KStock patch: 白名单接口过本地磁盘缓存（增量合并，跨任务复用），
        # 其余接口直连。详见 kk_common.market_data_cache 模块头注释。
        if market_data_cache.handles(endpoint):
            return market_data_cache.wrap_request(
                endpoint, kwargs,
                lambda p: _as_dataframe(self.adapter.request(endpoint, **p)),
            )
        return _as_dataframe(self.adapter.request(endpoint, **kwargs))
''',
    ),
)


def _fix_tushare_client_soft_import(text: str) -> str | None:
    """tushare_client：模块级硬导入改软导入 + 实例化时检查；已修复返回 None。"""
    if "_TUSHARE_AVAILABLE" in text:
        return None
    patched = text
    for old, new in _TUSHARE_CLIENT_FIXES:
        patched = patched.replace(old, new, 1)
    if patched == text:
        return None
    return patched


def _fix_finance_gateway_cache(text: str) -> str | None:
    """FinanceDataGateway.request 织入磁盘缓存；已修复返回 None（幂等跳过）。"""
    if "market_data_cache.handles" in text:
        return None
    patched = text
    for old, new in _FINANCE_GATEWAY_FIXES:
        patched = patched.replace(old, new, 1)
    if patched == text:
        return None
    return patched


def _ensure_skill_script_from_canonical(vendor_root: Path, rel_path: str) -> bool:
    """把 scripts/patches/<basename> 的规范源码同步到技能树（缺失/漂移时重写）。"""
    canonical = Path(__file__).resolve().parent / "patches" / Path(rel_path).name
    if not canonical.exists():
        return False
    target = vendor_root / rel_path
    content = canonical.read_text(encoding="utf-8")
    if target.exists() and target.read_text(encoding="utf-8") == content:
        return False
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return True


_PARAM_SWEEP_PATH = "public/strategy-research/scripts/analysis/param_sweep.py"
_WALK_FORWARD_PATH = "public/strategy-research/scripts/analysis/walk_forward.py"


def _ensure_market_data_cache_module(vendor_root: Path) -> bool:
    """把规范源码拷贝进技能树（缺失或内容漂移时重写），返回是否发生改动。"""
    canonical = Path(__file__).resolve().parent / "patches" / "market_data_cache.py"
    if not canonical.exists():
        return False
    target = vendor_root / _MARKET_DATA_CACHE_MODULE_PATH
    content = canonical.read_text(encoding="utf-8")
    if target.exists() and target.read_text(encoding="utf-8") == content:
        return False
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return True


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


def _fix_scipy_soft_bs_model(text: str) -> str | None:
    """bs_model：scipy 顶层硬导入改为软导入 + 纯 Python 降级；已修复返回 None。"""
    olds = _BS_MODEL_CALL_REPLACEMENTS + ((_BS_MODEL_IMPORT_OLD, _BS_MODEL_IMPORT_NEW),)
    if all(old not in text for old, _ in olds):
        return None
    patched = text
    for old, new in _BS_MODEL_CALL_REPLACEMENTS:
        patched = patched.replace(old, new)
    patched = patched.replace(_BS_MODEL_IMPORT_OLD, _BS_MODEL_IMPORT_NEW)
    if patched == text:
        return None
    return patched


def _fix_scipy_soft_tas(text: str) -> str | None:
    """tas.py：函数内 argrelextrema 硬导入包 try/except；已修复返回 None。

    降级后 argrelextrema=None，调用抛 TypeError 被既有 except Exception
    分支捕获，背驰信号降级为「无背驰」（与原始异常路径行为一致）。
    """
    if all(old not in text for old, _ in _TAS_ARGS_REPLACEMENTS):
        return None
    patched = text
    for old, new in _TAS_ARGS_REPLACEMENTS:
        patched = patched.replace(old, new)
    if patched == text:
        return None
    return patched


def _fix_pywencai_hint(text: str) -> str | None:
    """移除 pywencai 缺失时的误导安装提示；已修复返回 None（幂等跳过）。"""
    pattern = re.compile(
        r'\n\s*print\("  ⚠️ pywencai 未安装，请执行: pip install pywencai", file=sys\.stderr\)'
    )
    if not pattern.search(text):
        return None
    return pattern.sub("", text)


def _fix_render_html_report_refs(text: str) -> str | None:
    """把旧内置工具 render_html_report 的引用改写为 2.0 html-report 技能流程。"""
    # 已打旧版补丁的文件不含 render_html_report，但残留旧相对路径命令——
    # 以旧路径为第二触发条件，交给 legacy_swaps 升级。
    if 'render_html_report' not in text \
            and "skills/public/html-report/scripts/render_report.py" not in text:
        return None
    replacement = (
        "### 阶段四：报告生成（html-report 技能）\n\n"
        "本技能**不自行手写 HTML**，而是把结论整理为报告 JSON，用 html-report 技能自带的渲染器"
        "（纯标准库）产出单文件自包含看板。流程：\n\n"
        "1. 按报告 JSON 契约（html-report 技能 `references/report-schema.md`）整理数据："
        "标题/摘要/指标卡/分节正文/图表（line / area / bar / scatter / pie / radar）/风险/参考来源，"
        "图表以内嵌 SVG 渲染，**禁止使用远程图片 URL**；"
        "2. 保存为 `reports/report.json`，从工作区根执行"
        "`python3 \"<html-report 基目录>/scripts/render_report.py\" reports/report.json -o reports/<主题名>.html`"
        "（基目录 = html-report 技能加载结果给出的 Base directory；产物分区见 sandbox-path-guide），"
        "stderr 出现告警必须修正数据后重渲；"
        "3. 用 html-report 技能 SKILL.md 中的 curl 模板把 reports/ 下的两份产物归档进报告库"
        "（POST /kstock-api/reports），交付时给出报告标题。"
    )
    # 整段替换「阶段四」小节（从标题到下一个二级标题/参考文档之间）
    pattern = re.compile(
        r"### 阶段四：报告生成（内置 render_html_report 工具）.*?(?=\n## )",
        re.DOTALL,
    )
    if pattern.search(text):
        return pattern.sub("\n" + replacement + "\n", text)
    # 行内引用（如能力清单 description）逐句改写
    inline = re.compile(r"调用内置 render_html_report 工具生成离线 HTML 看板")
    if inline.search(text):
        return inline.sub("用 html-report 技能生成自包含 HTML 看板并归档报告库", text)
    # 旧替换文本升级：产物分区纪律（基目录拼接 + reports/ 落盘）。
    # 旧文本把 1/2/3 步拼成单行段落，这里按子串精确替换，两种拼接形态通吃。
    legacy_swaps = (
        ("渲染器（`skills/public/html-report/scripts/render_report.py`，纯标准库）",
         "渲染器（纯标准库）"),
        ("保存为 `report.json` 后执行",
         "保存为 `reports/report.json` 后从工作区根执行"),
        ("`python skills/public/html-report/scripts/render_report.py report.json -o report.html`，",
         "`python3 \"<html-report 基目录>/scripts/render_report.py\" reports/report.json"
         " -o reports/<主题名>.html`（基目录 = html-report 技能加载结果给出的"
         " Base directory；产物分区见 sandbox-path-guide），"),
        ("curl 模板把 report.html 归档进报告库",
         "curl 模板把 reports/ 下的两份产物归档进报告库"),
    )
    upgraded = text
    for old, new in legacy_swaps:
        upgraded = upgraded.replace(old, new)
    if upgraded != text:
        return upgraded
    return None


_RENDER_REF_SKILLS = (
    "public/industry-analysis/SKILL.md",
    "public/a-stock-screener/SKILL.md",
)

# ── etf-analysis kk_common 同级解析补丁 ───────────────────────────────────
# etf_analyzer.py 裸 `from kk_common import ...`：1.x 沙箱靠 pip 安装 common，
# 2.0 preset 镜像无安装层，从工作区根直跑必然 ModuleNotFoundError（cli.py
# 经 subprocess 调用同样命中）。按脚本自身位置注入同级 common/src
# （<skill>/../common/src），与 market-linkage fetcher 同款机制，cwd 无关。
_ETF_KK_COMMON_SCRIPTS = (
    "public/etf-analysis/scripts/etf_analyzer.py",
)
_ETF_KK_COMMON_ANCHOR = "from kk_common import get_finance_data_gateway"
_ETF_KK_COMMON_INJECTION = '''# KStock patch: kk_common 由同级 common 技能提供（<skill>/../common/src），
# 1.x 沙箱靠 pip 安装；2.0 preset 镜像下无安装层，按脚本自身位置解析注入。
_KK_COMMON_SRC = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "common", "src")
)
if os.path.isdir(_KK_COMMON_SRC) and _KK_COMMON_SRC not in sys.path:
    sys.path.insert(0, _KK_COMMON_SRC)

from kk_common import get_finance_data_gateway'''


def _fix_etf_kk_common(text: str) -> str | None:
    """给 etf_analyzer.py 的 kk_common 导入注入同级解析；已修复返回 None。"""
    if "_KK_COMMON_SRC" in text:
        return None
    if _ETF_KK_COMMON_ANCHOR not in text:
        return None
    return text.replace(_ETF_KK_COMMON_ANCHOR, _ETF_KK_COMMON_INJECTION, 1)


# ── cb-analysis 周度引擎 kk_common 同级解析补丁 ────────────────────────────
# analyze_weekly_cb.py 只把自己所在 scripts/ 与技能根加入 sys.path，而
# kk_common 在同级 common 技能的 src 下（public/common/src）——1.x 沙箱靠
# pip 安装掩盖，2.0 preset 镜像下必然「kk_common 网关不可用」。补上正确
# 的同级解析（analysis-engine → scripts → cb-analysis → public → common/src），
# 与 cb_data.py（上游已正确）保持一致。
_CB_WEEKLY_KK_SCRIPT = "public/cb-analysis/scripts/analysis-engine/analyze_weekly_cb.py"
_CB_WEEKLY_KK_ANCHOR = """_script_dir = os.path.dirname(os.path.abspath(__file__))
_scripts_root = os.path.dirname(_script_dir)
for _p in (_scripts_root, os.path.dirname(_scripts_root)):
    if _p not in sys.path:
        sys.path.insert(0, _p)"""
_CB_WEEKLY_KK_INJECTION = """_script_dir = os.path.dirname(os.path.abspath(__file__))
_scripts_root = os.path.dirname(_script_dir)
for _p in (_scripts_root, os.path.dirname(_scripts_root)):
    if _p not in sys.path:
        sys.path.insert(0, _p)
# KStock patch: kk_common 由同级 common 技能提供（public/common/src）。
_kk_common_src = os.path.normpath(
    os.path.join(_script_dir, "..", "..", "..", "common", "src")
)
if os.path.isdir(_kk_common_src) and _kk_common_src not in sys.path:
    sys.path.insert(0, _kk_common_src)"""


def _fix_cb_weekly_kk_common(text: str) -> str | None:
    """给 analyze_weekly_cb.py 补 kk_common 同级解析；已修复返回 None。"""
    if "_kk_common_src" in text:
        return None
    if _CB_WEEKLY_KK_ANCHOR not in text:
        return None
    return text.replace(_CB_WEEKLY_KK_ANCHOR, _CB_WEEKLY_KK_INJECTION, 1)


# ── stock-analysis 缠论脚本 kk_common 同级解析补丁 ─────────────────────────
# analyze_stock_chan.py / run_chan_stock_selector.py 裸 `from kk_common import
# ...`（chan-theory-expert 角色的核心脚本，2.0 preset 镜像下必炸
# ModuleNotFoundError）。两脚本已把技能根注入 sys.path（chan_theory_v2 由此
# 解析），补上同级 common/src（scripts → stock-analysis → public）。
_CHAN_KK_SCRIPTS = (
    "public/stock-analysis/scripts/analyze_stock_chan.py",
    "public/stock-analysis/scripts/run_chan_stock_selector.py",
)
_CHAN_KK_ANCHOR = "from kk_common import get_finance_data_gateway"
_CHAN_KK_INJECTION = '''# KStock patch: kk_common 由同级 common 技能提供（<skill>/../common/src）。
_kk_common_src = os.path.normpath(
    os.path.join(_script_dir, "..", "..", "common", "src")
)
if os.path.isdir(_kk_common_src) and _kk_common_src not in sys.path:
    sys.path.insert(0, _kk_common_src)

from kk_common import get_finance_data_gateway'''


def _fix_chan_kk_common(text: str) -> str | None:
    """给缠论脚本的 kk_common 导入注入同级解析；已修复返回 None。"""
    if "_kk_common_src" in text:
        return None
    if _CHAN_KK_ANCHOR not in text:
        return None
    return text.replace(_CHAN_KK_ANCHOR, _CHAN_KK_INJECTION, 1)


# ── kk_common 通用同级解析补丁（stock-analysis 引擎群 + 选股适配器）─────────
# 这些脚本的 `from kk_common import get_finance_data_gateway` 是函数级懒导入
# 或 try/except 降级：--help 能过、一取数就 ModuleNotFoundError（懒导入）或
# 诚实报错无数据（降级）。统一在其导入语句前注入自包含的同级解析块
# （别名 import 防止依赖外层名字；缩进随导入点自适应；上跳层数按文件
# 在技能包内的深度计算）。futures-analysis / option-futures-linkage 的内部
# analyzer 有直连取数兜底且实测可用，保守不动。
_KK_GENERIC_ANCHOR = "from kk_common import get_finance_data_gateway"
_KK_GENERIC_FILES = (
    "public/stock-analysis/scripts/analysis-engine/analyze_elliott_wave.py",
    "public/stock-analysis/scripts/analysis-engine/analyze_financial_report.py",
    "public/stock-analysis/scripts/analysis-engine/analyze_harmonic_pattern.py",
    "public/stock-analysis/scripts/analysis-engine/analyze_stock_chips.py",
    "public/stock-analysis/scripts/analysis-engine/analyze_stock_company_info.py",
    "public/stock-analysis/scripts/analysis-engine/analyze_stock_earnings_forecast.py",
    "public/stock-analysis/scripts/analysis-engine/analyze_stock_institute_research.py",
    "public/stock-analysis/scripts/analysis-engine/analyze_stock_margin.py",
    "public/stock-analysis/scripts/analysis-engine/analyze_stock_news.py",
    "public/stock-analysis/scripts/analysis-engine/analyze_stock_shareholder.py",
    "public/stock-analysis/scripts/analysis-engine/analyze_stock_valuation.py",
    "public/stock-analysis/scripts/analysis-engine/analyze_technical.py",
    "public/stock-analysis/scripts/analysis-engine/technical_analyzer.py",
    "public/stock-analysis/scripts/analysis-engine/analyze_financial_deep.py",
    "public/stock-analysis/scripts/analysis-engine/analyze_social_media.py",
    "public/stock-analysis/scripts/analysis-engine/analyze_valuation_models.py",
    "public/a-stock-screener/scripts/data_adapter.py",
)


def _kk_common_levels(rel_path: str) -> int:
    """文件到 public/ 的目录深度（'..' 个数）：public/a/b/c.py → 3。"""
    parts = rel_path.split("/")
    return len(parts) - 2  # 去掉 'public' 与文件名


def _fix_kk_common_generic(text: str, levels: int) -> str | None:
    """在每处 kk_common 导入语句前注入自包含同级解析；已修复返回 None。"""
    if _KK_GENERIC_ANCHOR not in text or "_kstock_kk_common" in text:
        return None
    up = ", ".join(['".."'] * levels)
    pattern = re.compile(r"^(\s*)" + re.escape(_KK_GENERIC_ANCHOR), re.MULTILINE)

    def repl(m: re.Match[str]) -> str:
        indent = m.group(1)
        return (
            f"{indent}import os as _kstock_kk_os, sys as _kstock_kk_sys  # KStock patch: kk_common 同级解析\n"
            f"{indent}_kstock_kk_common = _kstock_kk_os.path.normpath(_kstock_kk_os.path.join("
            f"_kstock_kk_os.path.dirname(_kstock_kk_os.path.abspath(__file__)), {up}, \"common\", \"src\"))\n"
            f"{indent}if _kstock_kk_os.path.isdir(_kstock_kk_common) and _kstock_kk_common not in _kstock_kk_sys.path:\n"
            f"{indent}    _kstock_kk_sys.path.insert(0, _kstock_kk_common)\n"
            f"{indent}{_KK_GENERIC_ANCHOR}"
        )

    return pattern.sub(repl, text)


# ── ENSURE 形态补丁（financial_cli / pe_band_cli）──────────────────────────
# 这两个脚本的 `_ensure_kk_common` 在导入失败时尝试 pip install -e 候选路径
# （含 1.x 硬编码开发机绝对路径）——2.0 沙箱必拒、干净机器路径不存在。
# 在函数定义前注入模块级同级解析，让首个 import 直接命中。
_KK_ENSURE_FILES = (
    "public/financial-statement/scripts/financial_cli.py",
    "public/valuation-model/scripts/pe_band_cli.py",
)
_KK_ENSURE_ANCHOR = "def _ensure_kk_common() -> None:"


def _fix_kk_ensure(text: str, levels: int) -> str | None:
    """给 _ensure_kk_common 前注入模块级同级解析；已修复返回 None。"""
    if _KK_ENSURE_ANCHOR not in text or "_kstock_kk_common" in text:
        return None
    up = ", ".join(['".."'] * levels)
    injection = (
        "# KStock patch: kk_common 由同级 common 技能提供（<skill>/../common/src），\n"
        "# 首个 import 直接命中，免去 pip install -e（2.0 沙箱必拒）。\n"
        f"import os as _kstock_kk_os, sys as _kstock_kk_sys\n"
        f"_kstock_kk_common = _kstock_kk_os.path.normpath(_kstock_kk_os.path.join("
        f"_kstock_kk_os.path.dirname(_kstock_kk_os.path.abspath(__file__)), {up}, \"common\", \"src\"))\n"
        f"if _kstock_kk_os.path.isdir(_kstock_kk_common) and _kstock_kk_common not in _kstock_kk_sys.path:\n"
        f"    _kstock_kk_sys.path.insert(0, _kstock_kk_common)\n"
        "\n"
        "\n"
        f"{_KK_ENSURE_ANCHOR}"
    )
    return text.replace(_KK_ENSURE_ANCHOR, injection, 1)


# ── a-stock-screener data_adapter 补丁 ──────────────────────────────────────
# 该模块 try/except 导入 kk_common 子模块，失败时降级 **Mock 数据模式**——
# 选股器拿模拟数据比诚实报错更危险。在其 try 前注入模块级同级解析。
_KK_DATA_ADAPTER = "public/a-stock-screener/scripts/data_adapter.py"
_KK_DATA_ADAPTER_ANCHOR = "try:\n    from kk_common.iwencai_client import"


def _fix_kk_data_adapter(text: str, levels: int) -> str | None:
    """给 data_adapter 的 kk_common 导入注入同级解析；已修复返回 None。"""
    if _KK_DATA_ADAPTER_ANCHOR not in text or "_kstock_kk_common" in text:
        return None
    up = ", ".join(['".."'] * levels)
    injection = (
        "# KStock patch: kk_common 由同级 common 技能提供（<skill>/../common/src）。\n"
        f"import os as _kstock_kk_os, sys as _kstock_kk_sys\n"
        f"_kstock_kk_common = _kstock_kk_os.path.normpath(_kstock_kk_os.path.join("
        f"_kstock_kk_os.path.dirname(_kstock_kk_os.path.abspath(__file__)), {up}, \"common\", \"src\"))\n"
        f"if _kstock_kk_os.path.isdir(_kstock_kk_common) and _kstock_kk_common not in _kstock_kk_sys.path:\n"
        f"    _kstock_kk_sys.path.insert(0, _kstock_kk_common)\n"
        "\n"
        + _KK_DATA_ADAPTER_ANCHOR
    )
    return text.replace(_KK_DATA_ADAPTER_ANCHOR, injection, 1)


# ── qilin 引擎打包 staging 修复（Windows 传递 workspace 包漏带）───────────
# 实机现象（win-x64 SEA exe 启动即死）：runtime-bootstrap.mjs 的
# import.meta.resolve('@qilin/sandbox-windows-acl/runner') 报
# ERR_MODULE_NOT_FOUND——包不在 pkg 快照里。根因指向 pnpm deploy --legacy
# 在 Windows 上把传递 workspace 依赖（ACL 包经 @qilin/sandbox-local 引入）
# 留在部署源而未落 staging；上游 restoreLegacyHoists 只兜清单**直接**依赖。
# 补丁在 materializeStagedLinks 之后加 repairStagedScope：把部署源
# @qilin/@deepseek-ai 两个 workspace scope 下缺失于 staging 的包补拷进去
# （只限这两个 scope——源 node_modules 还有 @types/@yao-pkg 等 devDep
# scope，全量拷会把开发依赖灌进 exe），再对补拷包的非 scope 运行时依赖
# （如 ACL 的 koffi）做一次清单驱动补拷。锚点失配时静默跳过（上游结构
# 变化需人工重放评估），已含 repairStagedScope 标记则幂等跳过。
_QIILIN_EXE_SCRIPT_REL = "qilin/scripts/build-exe-for-python-sdk.ts"
_REPAIR_MARKER = "repairStagedScope"
_REPAIR_CALL_ANCHOR = "    await this.materializeStagedLinks()"
_REPAIR_METHOD_ANCHOR = "  /** Add the executable entry and pkg assets to the staged manifest. */"
_REPAIR_METHOD = '''  /**
   * KStock patch: repair workspace-scope packages missing from staging.
   *
   * pnpm's legacy deploy on Windows can leave transitive workspace
   * dependencies hoisted at the deploy source instead of the target;
   * `restoreLegacyHoists` only covers the manifest's direct dependencies,
   * so a package like `@qilin/sandbox-windows-acl` (reached through
   * `@qilin/sandbox-local`) can be absent from the packaged payload while
   * the SEA executable still boots into `runtime-bootstrap.mjs` and fails
   * at its first bare import. Copy scope packages that exist at the deploy
   * source but are missing from staging, then top up the non-scoped
   * runtime dependencies of everything that was repaired.
   */
  private async repairStagedScope(): Promise<void> {
    if (this.cli.dryRun) {
      console.log('build-exe-for-python-sdk: [dry-run] repair staged workspace scope packages')
      return
    }
    const sourceNodeModules = resolve(root, DEPLOY_SOURCE_NODE_MODULES)
    const stagedNodeModules = join(this.staging, 'node_modules')
    const scopes = ['@qilin', '@deepseek-ai']
    const repaired: string[] = []
    const copyPackage = async (name: string): Promise<void> => {
      const destination = join(stagedNodeModules, name)
      if (existsSync(join(destination, 'package.json'))) return
      const source = join(sourceNodeModules, name)
      if (!existsSync(join(source, 'package.json'))) return
      const nestedNodeModules = join(source, 'node_modules')
      await mkdir(dirname(destination), { recursive: true })
      await cp(source, destination, {
        recursive: true,
        dereference: true,
        filter: path => path !== nestedNodeModules && !path.startsWith(nestedNodeModules + sep),
      })
      repaired.push(name)
    }
    for (const scope of scopes) {
      const scopeDir = join(sourceNodeModules, scope)
      if (!existsSync(scopeDir)) continue
      for (const entry of await readdir(scopeDir, { withFileTypes: true })) {
        if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
        await copyPackage(`${scope}/${entry.name}`)
      }
    }
    for (const name of [...repaired]) {
      const manifestPath = join(stagedNodeModules, name, 'package.json')
      if (!existsSync(manifestPath)) continue
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
        dependencies?: Record<string, string>
      }
      for (const dependency of Object.keys(manifest.dependencies ?? {})) {
        if (dependency.startsWith('@')) continue
        await copyPackage(dependency)
      }
    }
    if (repaired.length > 0) {
      console.log(`build-exe-for-python-sdk: repaired staged workspace packages: ${repaired.join(', ')}`)
    }
  }

'''


def _fix_qilin_staging_scope(text: str) -> str | None:
    """给 build-exe-for-python-sdk.ts 注入 repairStagedScope；已修/锚点失配返回 None。"""
    if _REPAIR_MARKER in text:
        return None
    if _REPAIR_CALL_ANCHOR not in text or _REPAIR_METHOD_ANCHOR not in text:
        return None
    patched = text.replace(
        _REPAIR_CALL_ANCHOR,
        _REPAIR_CALL_ANCHOR + "\n    await this." + _REPAIR_MARKER + "()",
        1,
    )
    patched = patched.replace(
        _REPAIR_METHOD_ANCHOR,
        _REPAIR_METHOD + _REPAIR_METHOD_ANCHOR,
        1,
    )
    return patched


# ── 补丁 15：install-lefthook 容忍缺 lefthook（production 安装不炸）────────
# 实机（Windows）：`pnpm run build` 前 pnpm 11 的 deps 自检判定不同步，自动
# 跑 `pnpm install --production`；vendor 根 postinstall 静态
# `import lefthook/package.json`（lefthook 是 devDependency，--production 不
# 安装）→ ERR_MODULE_NOT_FOUND → install exit 1 → 连带 build 失败。
# 修法：静态导入改可选动态导入（缺失即 undefined），main() 里的守卫同步改
# 可选链——该场景本就不装 git hooks，静默降级是正确行为。锚点失配静默跳过。
_LEFTHOOK_SCRIPT_REL = "qilin/scripts/install-lefthook.mjs"
_LEFTHOOK_MARKER = "KStock patch: 生产安装"
_LEFTHOOK_IMPORT_ANCHOR = "import lefthookPackage from 'lefthook/package.json' with { type: 'json' }"
_LEFTHOOK_IMPORT_REPLACEMENT = '''let lefthookPackage
try {
  lefthookPackage = (await import('lefthook/package.json', { with: { type: 'json' } })).default
} catch {
  // KStock patch: 生产安装（--production）省略 devDependency lefthook；
  // 该场景不装 git hooks，静默降级而非让整次安装失败。
  lefthookPackage = undefined
}'''
_LEFTHOOK_GUARD_ANCHOR = "  if (typeof lefthookPackage.bin?.lefthook !== 'string') return"
_LEFTHOOK_GUARD_REPLACEMENT = "  if (typeof lefthookPackage?.bin?.lefthook !== 'string') return"


def _fix_qilin_lefthook_optional(text: str) -> str | None:
    """install-lefthook.mjs 的 lefthook 导入改可选；已修/锚点失配返回 None。"""
    if _LEFTHOOK_MARKER in text:
        return None
    if _LEFTHOOK_IMPORT_ANCHOR not in text or _LEFTHOOK_GUARD_ANCHOR not in text:
        return None
    patched = text.replace(_LEFTHOOK_IMPORT_ANCHOR, _LEFTHOOK_IMPORT_REPLACEMENT, 1)
    return patched.replace(_LEFTHOOK_GUARD_ANCHOR, _LEFTHOOK_GUARD_REPLACEMENT, 1)


# ── 补丁 16：kk_common tushare_client 去 set_token 化（沙箱 HOME 写边界）──
# 实测（agent 任务报告）：TushareClient.__init__ 无条件 ts.set_token(token)，
# tushare 官方实现固定写 ~/tk.csv（HOME 根，工作区沙箱写边界之外）→ 被
# 沙箱拒绝，调用侧只能 HOME 重定向规避。修法：删 set_token，改 pro_api
# 显式传 token（官方支持，不读不写 token 文件）——行为等价且零 HOME
# 写入。src 与 build 两份都修；锚点失配静默跳过。
_TUSHARE_SET_TOKEN_RELS = (
    "public/common/src/kk_common/tushare_client.py",
    "public/common/build/lib/kk_common/tushare_client.py",
)
_TUSHARE_TOKEN_MARKER = "KStock patch: pro_api 显式传 token"
_TUSHARE_SET_TOKEN_ANCHOR = """        # 设置 token
        ts.set_token(self.token)

        # 获取 API 对象
        self.pro = ts.pro_api()"""
_TUSHARE_SET_TOKEN_REPLACEMENT = """        # 获取 API 对象（KStock patch: pro_api 显式传 token——set_token 会
        # 固定写 ~/tk.csv 于 HOME 根，工作区沙箱写边界外会被拒）
        self.pro = ts.pro_api(self.token)"""


def _fix_tushare_client_token(text: str) -> str | None:
    """tushare_client 去 set_token 化；已修/锚点失配返回 None。"""
    if _TUSHARE_TOKEN_MARKER in text:
        return None
    if _TUSHARE_SET_TOKEN_ANCHOR not in text:
        return None
    return text.replace(_TUSHARE_SET_TOKEN_ANCHOR, _TUSHARE_SET_TOKEN_REPLACEMENT, 1)




# ── 补丁 17：缠论引擎动力学全套输出（§29-8）────────────────────────
# 面板动力学可视化的数据缺口：① MACD 序列未输出（KLine 模型无 macd_data，
# 引擎只在内部分析背驰时算）——_build_chart_data 内现算 EMA12/26/9 并
# 与 120 根窗口对齐；② 买卖点 markers 已有 label（BUY_1 等枚举）但缺
# 高低级别确认位；③ 中枢只输出 high/low，缺 GG/DD 震荡区间（从
# forming_segs 极值算）与 extend_count/类型/稳定性；④ 分型列表与背驰
# 段详情（两段区间 + MACD 面积对比）完全没输出。四处锚点增强。
_CHAN_SCRIPT_REL = "public/stock-analysis/scripts/analyze_stock_chan.py"
_CHAN_PATCH_MARKER = "KStock patch: 动力学全套输出"
_CHAN_MACD_ANCHOR = """        # 笔数据 — 连接分型端点的折线
        bi_lines = []"""
_CHAN_MACD_REPLACEMENT = """        # KStock patch: 动力学全套输出——MACD 序列现算（EMA12/26/9 基于全量
        # processed K 线递推后切窗口，与 dates/kline 对齐；None 由面板跳过）。
        all_klines = list(klines)
        def _ema_series(values, period):
            out = []
            prev = None
            alpha = 2.0 / (period + 1)
            for v in values:
                prev = v if prev is None else prev * (1 - alpha) + v * alpha
                out.append(prev)
            return out
        closes_all = [k.close for k in all_klines]
        dif_all = [f - s for f, s in zip(_ema_series(closes_all, 12), _ema_series(closes_all, 26))]
        dea_all = _ema_series(dif_all, 9)
        offset = len(all_klines) - len(recent_klines)
        macd_dif = [round(v, 4) for v in dif_all[offset:]]
        macd_dea = [round(v, 4) for v in dea_all[offset:]]
        macd_hist = [round((d - e) * 2, 4) for d, e in zip(dif_all[offset:], dea_all[offset:])]

        # 笔数据 — 连接分型端点的折线
        bi_lines = []"""
_CHAN_ZS_ANCHOR = """            zhongshu_zones.append({
                'start_time': zs.start_time.strftime('%Y-%m-%d %H:%M'),
                'end_time': zs.end_time.strftime('%Y-%m-%d %H:%M'),"""
_CHAN_ZS_REPLACEMENT = """            gg = max((max(b.start_price, b.end_price) for sg in zs.forming_segs for b in sg.bis), default=zs.high)
            dd = min((min(b.start_price, b.end_price) for sg in zs.forming_segs for b in sg.bis), default=zs.low)
            zhongshu_zones.append({
                'start_time': zs.start_time.strftime('%Y-%m-%d %H:%M'),
                'end_time': zs.end_time.strftime('%Y-%m-%d %H:%M'),
                'gg': round(gg, 2),
                'dd': round(dd, 2),
                'extend_count': zs.extend_count,
                'zhongshu_type': str(zs.zhongshu_type),
                'stability': round(zs.stability, 3),"""
_CHAN_MARKER_ANCHOR = """                'label': str(point.point_type),
                'reliability': round(point.reliability, 3),
                'strength': round(point.strength, 3),
            }"""
_CHAN_MARKER_REPLACEMENT = """                'label': point.point_type.name,
                'reliability': round(point.reliability, 3),
                'strength': round(point.strength, 3),
                'confirmed_by_higher': point.confirmed_by_higher_level,
                'confirmed_by_lower': point.confirmed_by_lower_level,
            }"""
_CHAN_RETURN_ANCHOR = """        return {
            'dates': dates,
            'kline': kline_data,
            'volumes': volumes,
            'bi_lines': bi_lines,
            'seg_lines': seg_lines,
            'zhongshu_zones': zhongshu_zones,
            'markers': markers,
        }"""
_CHAN_RETURN_REPLACEMENT = """        # KStock patch: 分型列表（窗口内）与背驰段详情输出。
        window_start = recent_klines[0].timestamp if recent_klines else None
        fenxing_marks = []
        for fx in result.fenxings:
            k = fx.kline
            if k is None:
                continue
            if window_start is not None and k.timestamp < window_start:
                continue
            fenxing_marks.append({
                'time': k.timestamp.strftime('%Y-%m-%d %H:%M'),
                'fenxing_type': 'top' if fx.fenxing_type.value in ('top', 1) or 'top' in str(fx.fenxing_type).lower() else 'bottom',
                'price': round(k.high if 'top' in str(fx.fenxing_type).lower() else k.low, 2),
                'strength': round(fx.strength, 3),
            })
        backchi_details = []
        for bc in result.backchi_analyses:
            # 未完成的段（current/previous_seg 为 None）跳过，防属性访问崩。
            if bc.current_seg is None or bc.previous_seg is None:
                continue
            try:
                valid = bc.is_valid_backchi()
            except Exception:
                valid = False
            backchi_details.append({
                'backchi_type': str(bc.backchi_type),
                'valid': valid,
                'current_start': bc.current_seg.start_time.strftime('%Y-%m-%d %H:%M'),
                'current_end': bc.current_seg.end_time.strftime('%Y-%m-%d %H:%M'),
                'previous_start': bc.previous_seg.start_time.strftime('%Y-%m-%d %H:%M'),
                'previous_end': bc.previous_seg.end_time.strftime('%Y-%m-%d %H:%M'),
                'current_macd_area': round(bc.current_macd_area, 4),
                'previous_macd_area': round(bc.previous_macd_area, 4),
                'macd_divergence': round(bc.macd_divergence, 4),
            })
        return {
            'dates': dates,
            'kline': kline_data,
            'volumes': volumes,
            'bi_lines': bi_lines,
            'seg_lines': seg_lines,
            'zhongshu_zones': zhongshu_zones,
            'markers': markers,
            'macd': {'dif': macd_dif, 'dea': macd_dea, 'hist': macd_hist},
            'fenxings': fenxing_marks,
            'backchis': backchi_details,
        }"""


def _fix_chan_dynamics_output(text: str) -> str | None:
    """缠论引擎 chart_data 动力学全套输出；已修/锚点失配返回 None。"""
    if _CHAN_PATCH_MARKER in text:
        return None
    for anchor, replacement in (
        (_CHAN_MACD_ANCHOR, _CHAN_MACD_REPLACEMENT),
        (_CHAN_ZS_ANCHOR, _CHAN_ZS_REPLACEMENT),
        (_CHAN_MARKER_ANCHOR, _CHAN_MARKER_REPLACEMENT),
        (_CHAN_RETURN_ANCHOR, _CHAN_RETURN_REPLACEMENT),
    ):
        if anchor not in text:
            return None
    patched = text.replace(_CHAN_MACD_ANCHOR, _CHAN_MACD_REPLACEMENT, 1)
    patched = patched.replace(_CHAN_ZS_ANCHOR, _CHAN_ZS_REPLACEMENT, 1)
    patched = patched.replace(_CHAN_MARKER_ANCHOR, _CHAN_MARKER_REPLACEMENT, 1)
    patched = patched.replace(_CHAN_RETURN_ANCHOR, _CHAN_RETURN_REPLACEMENT, 1)
    return patched


# ── KStock 自有技能 ensure（kstock/skills → vendor/skills/public）────────
# 源码在 kstock/skills/<name>（上游同步整体覆盖 vendor 时不受影响），补丁器
# 把它们 ensure 进 vendor 技能目录：html-report（自研渲染器）、market-linkage
# （市场联动场景编排手册）、sandbox-path-guide（2.0 工作区路径纪律整体重写，
# 替换上游 1.x 虚拟路径版）。
_OWNED_SKILLS_SOURCE = REPO_ROOT / "kstock" / "skills"


def _ensure_owned_skills(vendor_root: Path) -> list[str]:
    """把 kstock/skills/<name> ensure 进 vendor/skills/public/<name>，返回改动目录。"""
    import shutil

    changed: list[str] = []
    if not _OWNED_SKILLS_SOURCE.is_dir():
        return changed
    for source in sorted(_OWNED_SKILLS_SOURCE.iterdir()):
        if not source.is_dir():
            continue
        target = vendor_root / "public" / source.name
        source_files = sorted(p.relative_to(source) for p in source.rglob("*") if p.is_file())
        if target.is_dir():
            target_files = sorted(p.relative_to(target) for p in target.rglob("*") if p.is_file())
            if source_files == target_files and all(
                (source / rel).read_bytes() == (target / rel).read_bytes() for rel in source_files
            ):
                continue
            shutil.rmtree(target)
        shutil.copytree(source, target)
        changed.append(f"public/{source.name}")
    return changed


# ── preset 随行技能目录发布（vendor/skills/public → 各角色 preset/skills）─
# 技能随 preset 分发（cordis preset 模式）：每个角色 preset 的 skill-
# filesystem 行以 baseUrl 指向自身 skills/ 子目录。技能路径解析由 skill 工具
# 加载结果内建（"Base directory for this skill: <path>" + 相对路径按基目录
# 解析），上游 SKILL.md 文本不做路径改写；此处按 skills.manifest.json 把
# 最终语料子集发布进各 preset（preset id → 技能目录名列表）。
_PRESETS_ROOT = REPO_ROOT / "kstock" / "presets"
_PRESET_SKILLS_MANIFEST = _PRESETS_ROOT / "skills.manifest.json"


# 发布排除：上游同步残留的构建/字节码产物不进 preset 随行目录
# （build/ 为上游打包残留，__pycache__/*.pyc 为本地运行残留，均非技能内容）。
_PUBLISH_EXCLUDE_DIRS = frozenset({"__pycache__", "build", ".pytest_cache", ".mypy_cache"})
_PUBLISH_EXCLUDE_SUFFIXES = (".pyc", ".pyo")


def _publish_preset_skills(vendor_root: Path) -> bool:
    """按 skills.manifest.json 把技能子集镜像进各 preset 随行 skills/。

    逐文件比对（清单 + 字节），只写差异、删多余，无差异零改动（幂等）；
    构建产物与字节码缓存（见 _PUBLISH_EXCLUDE_*）不参与发布。manifest
    引用的技能在 vendor/skills/public 缺失时抛错（fail loud，防止静默
    裁剪角色技能面）。
    """
    import json
    import shutil

    source_root = vendor_root / "public"
    if not source_root.is_dir():
        return False
    manifest = json.loads(_PRESET_SKILLS_MANIFEST.read_text(encoding="utf-8"))

    def _publishable(path: Path) -> bool:
        rel = path.relative_to(source_root)
        if any(part in _PUBLISH_EXCLUDE_DIRS for part in rel.parts[:-1]):
            return False
        return not rel.suffix in _PUBLISH_EXCLUDE_SUFFIXES

    changed = False
    for preset_id, skill_names in manifest.items():
        if preset_id.startswith("_"):
            continue
        target_root = _PRESETS_ROOT / preset_id / "skills"
        target_root.mkdir(parents=True, exist_ok=True)
        desired: dict[Path, Path] = {}
        for name in skill_names:
            skill_dir = source_root / name
            if not skill_dir.is_dir():
                raise SystemExit(
                    f"preset 技能清单引用了不存在的技能：{preset_id} → {name}"
                    f"（vendor/skills/public 下无此目录）"
                )
            for src in sorted(skill_dir.rglob("*")):
                if src.is_file() and _publishable(src):
                    desired[src.relative_to(source_root)] = src
        existing: dict[Path, Path] = {}
        for dst in sorted(target_root.rglob("*")):
            if dst.is_file():
                existing[dst.relative_to(target_root)] = dst
        for rel in sorted(set(desired) - set(existing)):
            (target_root / rel).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(desired[rel], target_root / rel)
            changed = True
        for rel in sorted(set(desired) & set(existing)):
            if desired[rel].read_bytes() != existing[rel].read_bytes():
                shutil.copy2(desired[rel], existing[rel])
                changed = True
        for rel in sorted(set(existing) - set(desired)):
            existing[rel].unlink()
            changed = True
            # 清掉因此变空的目录（只删空目录，向上至 target_root）。
            parent = existing[rel].parent
            while parent != target_root and next(parent.iterdir(), None) is None:
                parent.rmdir()
                parent = parent.parent
    return changed


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
    for rel_path in _SCIPY_SOFT_SCRIPTS:
        target = vendor_root / rel_path
        if not target.exists():
            continue
        fix_fn = _fix_scipy_soft_bs_model if rel_path.endswith("bs_model.py") else _fix_scipy_soft_tas
        if _patch_file(target, rel_path, fix_fn):
            changed.append(rel_path)
    for rel_path, fix_fn in (
        (_BACKTEST_ENGINE_PATH, _fix_backtest_a_share),
        (_BACKTEST_CLI_PATH, _fix_backtest_cli),
        (_FINANCE_GATEWAY_PATH, _fix_finance_gateway_cache),
        (_TUSHARE_CLIENT_PATH, _fix_tushare_client_soft_import),
    ):
        target = vendor_root / rel_path
        if not target.exists():
            continue
        if _patch_file(target, rel_path, fix_fn):
            changed.append(rel_path)
    if _ensure_market_data_cache_module(vendor_root):
        changed.append(_MARKET_DATA_CACHE_MODULE_PATH)
    for rel_path in (_PARAM_SWEEP_PATH, _WALK_FORWARD_PATH):
        if _ensure_skill_script_from_canonical(vendor_root, rel_path):
            changed.append(rel_path)
    for rel_path in _RENDER_REF_SKILLS:
        target = vendor_root / rel_path
        if not target.exists():
            continue
        if _patch_file(target, rel_path, _fix_render_html_report_refs):
            changed.append(rel_path)
    # etf-analysis kk_common 同级解析（2.0 preset 镜像无 pip 安装层）。
    for rel_path in _ETF_KK_COMMON_SCRIPTS:
        target = vendor_root / rel_path
        if not target.exists():
            continue
        if _patch_file(target, rel_path, _fix_etf_kk_common):
            changed.append(rel_path)
    # cb-analysis 周度引擎 kk_common 同级解析（同因，注入层级算错）。
    target = vendor_root / _CB_WEEKLY_KK_SCRIPT
    if target.exists() and _patch_file(target, _CB_WEEKLY_KK_SCRIPT, _fix_cb_weekly_kk_common):
        changed.append(_CB_WEEKLY_KK_SCRIPT)
    # stock-analysis 缠论脚本 kk_common 同级解析（chan-theory-expert 核心）。
    for rel_path in _CHAN_KK_SCRIPTS:
        target = vendor_root / rel_path
        if not target.exists():
            continue
        if _patch_file(target, rel_path, _fix_chan_kk_common):
            changed.append(rel_path)
    # kk_common 通用同级解析（stock-analysis 引擎群懒导入/降级 + 选股适配器）。
    for rel_path in _KK_GENERIC_FILES:
        target = vendor_root / rel_path
        if not target.exists():
            continue
        levels = _kk_common_levels(rel_path)
        if _patch_file(target, rel_path, lambda t, lv=levels: _fix_kk_common_generic(t, lv)):
            changed.append(rel_path)
    # ENSURE 形态（pip install -e 兜底在 2.0 沙箱必拒）。
    for rel_path in _KK_ENSURE_FILES:
        target = vendor_root / rel_path
        if not target.exists():
            continue
        levels = _kk_common_levels(rel_path)
        if _patch_file(target, rel_path, lambda t, lv=levels: _fix_kk_ensure(t, lv)):
            changed.append(rel_path)
    # a-stock-screener data_adapter（降级 Mock 数据模式，比报错更危险）。
    target = vendor_root / _KK_DATA_ADAPTER
    if target.exists():
        levels = _kk_common_levels(_KK_DATA_ADAPTER)
        if _patch_file(target, _KK_DATA_ADAPTER, lambda t, lv=levels: _fix_kk_data_adapter(t, lv)):
            changed.append(_KK_DATA_ADAPTER)
    # KStock 自有技能 ensure（html-report / market-linkage / sandbox-path-guide…）。
    for rel_path in _ensure_owned_skills(vendor_root):
        changed.append(rel_path)
    # qilin 引擎打包脚本（Windows staging 修复，补丁 14）。
    qilin_script = REPO_ROOT / "vendor" / "qilin" / "scripts" / "build-exe-for-python-sdk.ts"
    if qilin_script.exists():
        if _patch_file(qilin_script, _QIILIN_EXE_SCRIPT_REL, _fix_qilin_staging_scope):
            changed.append(_QIILIN_EXE_SCRIPT_REL)
    # qilin git hooks 安装脚本（production 安装容忍缺 lefthook，补丁 15）。
    lefthook_script = REPO_ROOT / "vendor" / "qilin" / "scripts" / "install-lefthook.mjs"
    if lefthook_script.exists():
        if _patch_file(lefthook_script, _LEFTHOOK_SCRIPT_REL, _fix_qilin_lefthook_optional):
            changed.append(_LEFTHOOK_SCRIPT_REL)
    # kk_common tushare_client 去 set_token 化（沙箱 HOME 写边界，补丁 16）。
    for rel_path in _TUSHARE_SET_TOKEN_RELS:
        target = vendor_root / rel_path
        if not target.exists():
            continue
        if _patch_file(target, rel_path, _fix_tushare_client_token):
            changed.append(rel_path)
    # 缠论引擎动力学全套输出（§29-8，补丁 17）。
    chan_script = vendor_root / _CHAN_SCRIPT_REL
    if chan_script.exists():
        if _patch_file(chan_script, _CHAN_SCRIPT_REL, _fix_chan_dynamics_output):
            changed.append(_CHAN_SCRIPT_REL)
    # preset 随行技能目录发布（技能随 preset 分发，cordis 模式）。
    if _publish_preset_skills(vendor_root):
        changed.append("kstock/presets/*/skills")
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
