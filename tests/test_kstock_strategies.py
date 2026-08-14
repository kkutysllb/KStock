"""策略工作区（scripts/kstock_strategies）单元测试。

覆盖：版本链与乐观并发、回测运行记录与对比口径、REST API 全流程、
agent 工具的 JSON 契约。用 tmp_path 隔离，不触碰真实用户数据空间。
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from scripts.kstock_strategies import StrategyStore, router

USER = "u-test"

CODE_V1 = "class SignalEngine:\n    def generate(self, data_map):\n        return {}\n"
CODE_V2 = CODE_V1 + "# v2: 加趋势过滤\n"
RULES = {"commission": 0.00025, "enforce_a_share_rules": True, "slippage": 0.001}
METRICS = {"total_return_pct": 23.3, "sharpe_ratio": 0.79, "max_drawdown_pct": -33.05}


@pytest.fixture()
def store(tmp_path: Path) -> StrategyStore:
    return StrategyStore(tmp_path)


def _mk_strategy(store: StrategyStore, versions: int = 2) -> dict:
    strategy = store.create_strategy(USER, "双均线动量", "短期均线上穿长期均线代表动量转强")
    for i in range(1, versions + 1):
        store.save_version(
            USER, strategy["strategy_id"],
            code=CODE_V1 if i == 1 else CODE_V2,
            params={"short": 5 if i == 1 else 10, "long": 20 if i == 1 else 30},
            change_note=f"v{i}" if i > 1 else "初始版本",
        )
    return strategy


# ── 存储层 ──────────────────────────────────────────────────────────


def test_version_chain_and_files(store: StrategyStore, tmp_path: Path):
    strategy = _mk_strategy(store)
    sid = strategy["strategy_id"]

    assert store.get_strategy(USER, sid)["current_version"] == 2
    v1_dir = tmp_path / "product" / "strategies" / USER / sid / "versions" / "v001"
    assert (v1_dir / "signal_engine.py").read_text(encoding="utf-8") == CODE_V1
    assert json.loads((v1_dir / "params.json").read_text(encoding="utf-8")) == {"short": 5, "long": 20}

    versions = store.list_versions(USER, sid)
    assert [v["version"] for v in versions] == [1, 2]
    assert versions[0]["parent_version"] in (None, 0)  # v1 无父版本
    assert versions[1]["parent_version"] == 1

    latest = store.get_version(USER, sid, 2)
    assert latest["code"] == CODE_V2
    assert latest["params"]["short"] == 10


def test_optimistic_version_conflict(store: StrategyStore):
    strategy = _mk_strategy(store, versions=1)
    sid = strategy["strategy_id"]
    # 基于过期版本提交 → 冲突
    with pytest.raises(ValueError, match="版本冲突"):
        store.save_version(USER, sid, code=CODE_V2, params={}, parent_version=0)
    # 未指定 parent → 默认基于当前版本
    result = store.save_version(USER, sid, code=CODE_V2, params={}, change_note="默认父版本")
    assert result["version"] == 2


def test_record_run_and_compare(store: StrategyStore):
    strategy = _mk_strategy(store)
    sid = strategy["strategy_id"]
    run1 = store.record_run(USER, sid, version=1, data_start="20220101", data_end="20241231",
                            rules=RULES, metrics=METRICS,
                            equity=[{"date": "2022-01-04", "equity": 1000000}],
                            trades=[{"date": "2022-01-05", "action": "buy"}])
    run2 = store.record_run(USER, sid, version=2, data_start="20220101", data_end="20241231",
                            rules=RULES, metrics={**METRICS, "total_return_pct": 31.2})

    runs = store.list_runs(USER, sid)
    assert {r["run_id"] for r in runs} == {run1["run_id"], run2["run_id"]}
    by_id = {r["run_id"]: r for r in runs}
    assert by_id[run1["run_id"]]["metrics"]["sharpe_ratio"] == 0.79
    assert by_id[run1["run_id"]]["equity_path"] is not None

    compare = store.compare_runs(USER, sid, [run1["run_id"], run2["run_id"]])
    assert compare["comparable"] is True
    assert {r["version"] for r in compare["runs"]} == {1, 2}

    # 规则不一致 → comparable False + 提示
    run3 = store.record_run(USER, sid, version=2, data_start="20220101", data_end="20241231",
                            rules={**RULES, "slippage": 0.0}, metrics=METRICS)
    compare2 = store.compare_runs(USER, sid, [run1["run_id"], run3["run_id"]])
    assert compare2["comparable"] is False
    assert compare2["notes"]

    # 版本越界
    with pytest.raises(ValueError, match="版本越界"):
        store.record_run(USER, sid, version=99, rules={}, metrics={})


def test_strategy_status_and_latest_run(store: StrategyStore):
    strategy = _mk_strategy(store)
    sid = strategy["strategy_id"]
    store.record_run(USER, sid, version=2, rules=RULES, metrics=METRICS)
    store.update_strategy(USER, sid, status="paused")

    items = store.list_strategies(USER)
    assert items[0]["status"] == "paused"
    assert items[0]["latest_run"]["metrics"]["sharpe_ratio"] == 0.79

    with pytest.raises(ValueError, match="状态"):
        store.update_strategy(USER, sid, status="bogus")


# ── REST API ────────────────────────────────────────────────────────


@pytest.fixture()
def client(tmp_path: Path, monkeypatch) -> TestClient:
    app = FastAPI()
    app.include_router(router)
    app.state.kstock_strategy_store = StrategyStore(tmp_path)
    import scripts.kstock_strategies as mod

    monkeypatch.setattr(mod, "get_effective_user_id", lambda: USER)
    return TestClient(app)


def test_api_full_flow(client: TestClient):
    created = client.post("/api/v1/kstock/strategies", json={"name": "RSI 反转", "hypothesis": "超卖回归"})
    assert created.status_code == 201
    sid = created.json()["strategy_id"]

    saved = client.post(
        f"/api/v1/kstock/strategies/{sid}/versions",
        json={"code": CODE_V1, "params": {"period": 14}, "change_note": "v1"},
    )
    assert saved.status_code == 201
    assert saved.json()["version"] == 1

    # 重复保存（parent 过期）→ 409
    conflict = client.post(
        f"/api/v1/kstock/strategies/{sid}/versions",
        json={"code": CODE_V2, "params": {}, "parent_version": 0},
    )
    assert conflict.status_code == 409

    run = client.post(
        f"/api/v1/kstock/strategies/{sid}/runs",
        json={"version": 1, "data_start": "20230101", "data_end": "20241231",
              "rules": RULES, "metrics": METRICS},
    )
    assert run.status_code == 201
    run_id = run.json()["run_id"]

    listing = client.get("/api/v1/kstock/strategies")
    assert listing.json()[0]["strategy_id"] == sid
    assert listing.json()[0]["latest_run"]["run_id"] == run_id

    versions = client.get(f"/api/v1/kstock/strategies/{sid}/versions")
    assert versions.json()[0]["params"] == {"period": 14}

    compare = client.get(f"/api/v1/kstock/strategies/{sid}/compare?runs={run_id},{run_id}")
    assert compare.status_code == 200
    assert compare.json()["comparable"] is True

    missing = client.get("/api/v1/kstock/strategies/stg_none")
    assert missing.status_code == 404


# ── agent 工具 ──────────────────────────────────────────────────────


def test_strategy_tools_roundtrip(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("KSTOCK_APP_DATA_DIR", str(tmp_path))
    import scripts.kstock_tools.strategy_store_tool as tool_mod
    import scripts.kstock_strategies as mod

    monkeypatch.setattr(mod, "get_effective_user_id", lambda: USER)
    # 工具内部 from ... import get_effective_user_id，patch 源模块即可

    created = json.loads(tool_mod.strategy_create_tool._run(json.dumps({"name": "MACD", "hypothesis": "动量延续"})))
    assert "strategy_id" in created
    sid = created["strategy_id"]

    saved = json.loads(tool_mod.strategy_save_version_tool._run(json.dumps({
        "strategy_id": sid, "code": CODE_V1, "params": {"fast": 12},
        "change_note": "初始", "parent_version": 0,
    })))
    assert saved["version"] == 1

    latest = json.loads(tool_mod.strategy_get_latest_tool._run(json.dumps({"strategy_id": sid})))
    assert latest["code"] == CODE_V1
    assert latest["params"] == {"fast": 12}
    assert latest["current_version"] == 1

    recorded = json.loads(tool_mod.strategy_record_backtest_tool._run(json.dumps({
        "strategy_id": sid, "version": 1, "rules": RULES, "metrics": METRICS,
    })))
    assert recorded["run_id"].startswith("srun_")

    listing = json.loads(tool_mod.strategy_list_tool._run(""))
    assert listing["strategies"][0]["strategy_id"] == sid

    # 错误路径：坏 JSON / 缺字段 → {"error": ...}
    err = json.loads(tool_mod.strategy_save_version_tool._run("not-json"))
    assert "error" in err
    err2 = json.loads(tool_mod.strategy_get_latest_tool._run(json.dumps({"strategy_id": "stg_missing"})))
    assert "error" in err2
