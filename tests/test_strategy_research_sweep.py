"""策略研究进阶工具测试：参数网格扫描 + walk-forward 滚动验证。"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

ENGINE_DIR = (
    Path(__file__).resolve().parents[1]
    / "vendor/skills/public/strategy-research/scripts/analysis"
)
sys.path.insert(0, str(ENGINE_DIR))

from param_sweep import run_param_sweep  # noqa: E402
from walk_forward import run_walk_forward  # noqa: E402


def demo_map(days: int = 160, seed: int = 7) -> dict:
    rng = np.random.default_rng(seed)
    dates = pd.bdate_range("2024-01-01", periods=days)
    close = 100.0 * (1 + rng.normal(0.0005, 0.012, days)).cumprod()
    frame = pd.DataFrame(
        {
            "open": close,
            "high": close * 1.01,
            "low": close * 0.99,
            "close": close,
            "volume": rng.uniform(1e6, 5e6, days),
        },
        index=dates,
    )
    return {"600000.SH": frame}


def test_param_sweep_grid_and_best():
    sweep = run_param_sweep(
        "dual_ma",
        {"short_window": [3, 5], "long_window": [10, 20]},
        demo_map(),
        backtest_kwargs={"initial_cash": 500_000},
    )
    assert sweep["sweep"]["combinations"] == 4
    assert sweep["sweep"]["succeeded"] + sweep["sweep"]["failed"] == 4
    assert len(sweep["results"]) == 4
    # 降序排列
    sharpes = [row["sharpe_ratio"] for row in sweep["results"]]
    assert sharpes == sorted(sharpes, reverse=True)
    assert sweep["best"] is sweep["results"][0]
    # A 股规则默认开启
    assert all(row["rules_enabled"] for row in sweep["results"])


def test_param_sweep_empty_grid_single_baseline():
    sweep = run_param_sweep("dual_ma", {}, demo_map())
    assert sweep["sweep"]["combinations"] == 1
    assert len(sweep["results"]) == 1


def test_walk_forward_windows_and_oos():
    result = run_walk_forward(
        "dual_ma",
        {"short_window": [3, 5], "long_window": [10, 20]},
        demo_map(),
        train_bars=60,
        test_bars=20,
    )
    wf = result["walk_forward"]
    # 160 根：训练 60 + 测试滚动 20 → (160-60)/20 = 5 个窗口
    assert wf["windows"] == 5
    assert wf["evaluated"] == 5
    assert 0 <= wf["win_windows"] <= 5
    assert len(wf["param_stability"]) >= 1
    # 每个窗口都有选参（网格非空）
    assert all(w.get("params") for w in result["windows"])


def test_walk_forward_rejects_insufficient_data():
    import pytest

    with pytest.raises(ValueError, match="数据不足"):
        run_walk_forward("dual_ma", None, demo_map(days=50), train_bars=60, test_bars=20)


def test_walk_forward_without_grid_runs_default_params():
    result = run_walk_forward("dual_ma", None, demo_map(), train_bars=60, test_bars=25)
    wf = result["walk_forward"]
    assert wf["windows"] == 4
    assert wf["param_stability"] == []
