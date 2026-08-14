"""回测引擎 A股交易规则回归测试。

被测对象：vendor/skills/public/strategy-research/scripts/analysis/backtest_engine.py
（本地增强：T+1、涨跌停、停牌顺延、整手、最低佣金、印花税、过户费、滑点）。
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ENGINE_DIR = (
    Path(__file__).resolve().parents[1]
    / "vendor/skills/public/strategy-research/scripts/analysis"
)
sys.path.insert(0, str(ENGINE_DIR))

from backtest_engine import (  # noqa: E402
    _board_limit_ratio,
    _limit_prices,
    run_backtest,
)


def make_df(closes, volumes=None):
    dates = pd.bdate_range("2024-01-01", periods=len(closes))
    closes = np.asarray(closes, dtype=float)
    volumes_arr = volumes if volumes is not None else np.full(len(closes), 1e6)
    return pd.DataFrame(
        {
            "open": closes,
            "high": closes * 1.01,
            "low": closes * 0.99,
            "close": closes,
            "volume": volumes_arr,
        },
        index=dates,
    )


def make_signals(values):
    return pd.Series(values, index=pd.bdate_range("2024-01-01", periods=len(values)))


CODE = "600000.SH"


# ── 涨跌停价与板块幅度 ────────────────────────────────────────────────


def test_limit_prices_round_to_cent():
    # 10 元 10%：11.00 / 9.00
    assert _limit_prices(10.0, "600000.SH", {}) == (11.0, 9.0)
    # 9.87 元 10%：round(10.857)=10.86 / round(8.883)=8.88
    assert _limit_prices(9.87, "600000.SH", {}) == (10.86, 8.88)


def test_board_limit_ratio_by_code_prefix():
    assert _board_limit_ratio("600519.SH") == 0.10
    assert _board_limit_ratio("000001.SZ") == 0.10
    assert _board_limit_ratio("300750.SZ") == 0.20
    assert _board_limit_ratio("688981.SH") == 0.20
    assert _board_limit_ratio("832000.BJ") == 0.30


def test_limit_ratio_override_for_st():
    assert _limit_prices(10.0, "600000.SH", {"600000.SH": 0.05}) == (10.5, 9.5)


# ── 交易规则行为 ─────────────────────────────────────────────────────


def test_buy_deferred_when_close_at_limit_up():
    """信号日收盘涨停（10 → 11 = +10%）不可成交，顺延到下一交易日。"""
    df = make_df([10.0, 11.0, 11.5, 12.0])  # d1 恰好涨停
    signals = make_signals([0.0, 1.0, 1.0, 1.0])
    result = run_backtest({CODE: df}, {CODE: signals})

    buys = [t for t in result["trades"] if t["action"] == "buy"]
    assert len(buys) == 1
    assert buys[0]["date"] == str(df.index[2].date())  # d2 成交，非 d1
    blocked = [r for r in result["rebalance_records"] if r.get("blocked")]
    assert len(blocked) == 1
    assert blocked[0]["blocked"] == "limit_up"
    assert result["a_share_rules"]["blocked_rebalances"] == 1


def test_sell_deferred_when_close_at_limit_down():
    """持仓日收盘跌停（10 → 9 = -10%）卖出被阻，顺延到下一交易日。"""
    df = make_df([10.0, 10.0, 9.0, 9.2])  # d2 恰好跌停
    signals = make_signals([0.0, 1.0, 0.0, 0.0])
    result = run_backtest({CODE: df}, {CODE: signals})

    closes = [t for t in result["trades"] if t["action"] == "close"]
    assert len(closes) == 1
    assert closes[0]["date"] == str(df.index[3].date())  # d3 成交，非 d2
    blocked = [r for r in result["rebalance_records"] if r.get("blocked")]
    assert blocked[0]["blocked"] == "limit_down"


def test_zero_volume_day_defers_signal():
    """零成交量（停牌）当日信号顺延。"""
    df = make_df([10.0, 10.0, 10.0, 10.5], volumes=[1e6, 1e6, 0.0, 1e6])
    signals = make_signals([0.0, 0.0, 1.0, 1.0])
    result = run_backtest({CODE: df}, {CODE: signals})

    buys = [t for t in result["trades"] if t["action"] == "buy"]
    assert len(buys) == 1
    assert buys[0]["date"] == str(df.index[3].date())
    blocked = [r for r in result["rebalance_records"] if r.get("blocked")]
    assert blocked[0]["blocked"] == "suspended_zero_volume"


def test_quantity_is_whole_lots():
    """A股规则下买入数量必须为 100 股整数倍。"""
    df = make_df([10.0, 10.0, 10.0])
    signals = make_signals([0.0, 1.0, 1.0])
    result = run_backtest({CODE: df}, {CODE: signals}, initial_cash=9999)

    buys = [t for t in result["trades"] if t["action"] == "buy"]
    assert len(buys) == 1
    # 资金 9999 / 10 元 = 999.9 股 → 9 手 = 900 股
    assert buys[0]["quantity"] == 900


def test_insufficient_for_one_lot_defers():
    """资金不足一手时不产生碎股成交，调仓顺延。"""
    df = make_df([10.0, 10.0, 10.0, 5.0])
    signals = make_signals([0.0, 0.0, 1.0, 1.0])
    # 资金 800 / 10 元 = 80 股 < 1 手；d3 价格 5 元 → 160 股可成交
    result = run_backtest({CODE: df}, {CODE: signals}, initial_cash=800)

    buys = [t for t in result["trades"] if t["action"] == "buy"]
    assert len(buys) == 1
    assert buys[0]["date"] == str(df.index[3].date())
    blocked = [r for r in result["rebalance_records"] if r.get("blocked")]
    assert blocked[0]["blocked"] == "insufficient_for_one_lot"


def test_fees_min_commission_stamp_duty_and_transfer():
    """佣金最低 5 元、卖出印花税 0.05%、过户费双边万0.1。"""
    df = make_df([10.0, 10.0, 10.0, 10.0])
    signals = make_signals([0.0, 1.0, 1.0, 0.0])
    result = run_backtest(
        {CODE: df}, {CODE: signals},
        initial_cash=10_000,
        commission=0.0001,  # 万1：名义 1 万 → 1 元，触发最低佣金 5 元
    )

    # 买入：max(10000*0.0001, 5) + 10000*0.00001 = 5.1
    # 卖出：5 + 10000*0.00001 + 10000*0.0005 = 10.1
    assert result["metrics"]["total_commission"] == pytest.approx(15.2, abs=0.02)


def test_slippage_adjusts_execution_price():
    """滑点 1%：买入价上浮、卖出价下浮。"""
    df = make_df([10.0, 10.0, 10.0, 10.0])
    signals = make_signals([0.0, 1.0, 1.0, 0.0])
    result = run_backtest({CODE: df}, {CODE: signals}, slippage=0.01)

    buy = next(t for t in result["trades"] if t["action"] == "buy")
    close = next(t for t in result["trades"] if t["action"] == "close")
    assert buy["price"] == pytest.approx(10.1, abs=1e-6)
    assert close["price"] == pytest.approx(9.9, abs=1e-6)


def test_simplified_mode_keeps_legacy_semantics():
    """enforce_a_share_rules=False 回到简化语义：碎股、仅单边佣金率。"""
    df = make_df([10.0, 10.0, 10.0, 10.0])
    signals = make_signals([0.0, 1.0, 1.0, 0.0])
    result = run_backtest(
        {CODE: df}, {CODE: signals},
        initial_cash=9999,
        commission=0.001,
        enforce_a_share_rules=False,
    )

    buy = next(t for t in result["trades"] if t["action"] == "buy")
    # 999.9 股碎股保留（旧引擎行为）
    assert buy["quantity"] == pytest.approx(999.9, abs=1e-6)
    # 佣金 = 9999 * 0.001（买） + 999.9*10*0.001（卖）≈ 10.998
    assert result["metrics"]["total_commission"] == pytest.approx(
        9999 * 0.001 + 9999 * 0.001, abs=0.1
    )
    assert result["a_share_rules"]["enabled"] is False
    assert not [r for r in result["rebalance_records"] if r.get("blocked")]


def test_result_echoes_rule_config():
    df = make_df([10.0, 10.0, 10.0])
    signals = make_signals([0.0, 1.0, 1.0])
    result = run_backtest({CODE: df}, {CODE: signals}, slippage=0.002)

    echo = result["a_share_rules"]
    assert echo["enabled"] is True
    assert echo["t_plus_1"] is True
    assert echo["lot_size"] == 100
    assert echo["slippage"] == 0.002
    assert echo["stamp_duty_sell"] == 0.0005


# ── 资金分配语义（活跃信号数等分）────────────────────────────────────


def test_sparse_topk_portfolio_fully_invested():
    """top-K 稀疏组合：500 只池选少数标的时按活跃数等分（修复前只投 2%）。"""
    codes = ["60000{}.SH".format(i) for i in range(1, 6)]
    df = make_df([10.0, 10.0, 10.0, 10.0])
    data_map = {c: df for c in codes}
    signals = {}
    for i, code in enumerate(codes):
        signals[code] = make_signals([0.0, 1.0 if i < 2 else 0.0, 1.0 if i < 2 else 0.0, 1.0 if i < 2 else 0.0])

    result = run_backtest(data_map, signals, initial_cash=1_000_000)

    buys = [t for t in result["trades"] if t["action"] == "buy"]
    assert {b["code"] for b in buys} == set(codes[:2])
    # 每只分配 权益/活跃数(2) = 50 万 → 10 元价 → 50000 股（整手）
    for b in buys:
        assert b["quantity"] == 50000


def test_dense_signals_keep_legacy_allocation():
    """全部同向的密集信号：active==len(codes)，与旧 len(codes) 语义一致。"""
    codes = ["60000{}.SH".format(i) for i in range(1, 6)]
    df = make_df([10.0, 10.0, 10.0, 10.0])
    data_map = {c: df for c in codes}
    signals = {c: make_signals([0.0, 1.0, 1.0, 1.0]) for c in codes}

    result = run_backtest(data_map, signals, initial_cash=1_000_000)

    buys = [t for t in result["trades"] if t["action"] == "buy"]
    assert len(buys) == 5
    for b in buys:
        # 每只 权益/5 = 20 万 → 20000 股
        assert b["quantity"] == 20000
