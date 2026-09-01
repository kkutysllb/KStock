"""因子工作区（scripts/kstock_factors）单元测试。

与 test_kstock_strategies.py 同构：覆盖版本链与乐观并发、检验运行记录
与对比口径、REST API 全流程、agent 工具的 JSON 契约。用 tmp_path 隔离，
不触碰真实用户数据空间。
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from scripts.kstock_factors import FactorStore, router

USER = "u-test"

CODE_V1 = (
    "import pandas as pd\n"
    "\n"
    "def factor_panel(close: pd.DataFrame) -> pd.DataFrame:\n"
    "    return -close.pct_change(20)\n"
)
CODE_V2 = CODE_V1 + "# v2: 加 5 日平滑降低换手\n"
CONFIG = {"n_groups": 5, "period": 20, "neutralize": "申万一", "winsorize": "2.5/97.5"}
METRICS = {"ic_mean": 0.042, "ir": 0.61, "ic_positive_pct": 58.3, "long_short_spread_pct": 12.7}
IC_SERIES = [{"date": "2022-01-04", "ic": 0.031}, {"date": "2022-01-05", "ic": 0.052}]
LAYERS = {"group_stats": [{"group": "group_1", "final_nav": 1.05}, {"group": "group_5", "final_nav": 1.18}]}


@pytest.fixture()
def store(tmp_path: Path) -> FactorStore:
    return FactorStore(tmp_path)


def _mk_factor(store: FactorStore, versions: int = 2) -> dict:
    factor = store.create_factor(USER, "20日反转", "A股短期反转效应显著", category="momentum")
    for i in range(1, versions + 1):
        store.save_version(
            USER, factor["factor_id"],
            code=CODE_V1 if i == 1 else CODE_V2,
            params={"window": 20 if i == 1 else 20, "smooth": 0 if i == 1 else 5},
            change_note=f"v{i}" if i > 1 else "初始版本",
        )
    return factor


# ── 存储层 ──────────────────────────────────────────────────────────


def test_version_chain_and_files(store: FactorStore, tmp_path: Path):
    factor = _mk_factor(store)
    fid = factor["factor_id"]

    assert factor["category"] == "momentum"
    assert store.get_factor(USER, fid)["current_version"] == 2
    v1_dir = tmp_path / "product" / "factors" / USER / fid / "versions" / "v001"
    assert (v1_dir / "factor.py").read_text(encoding="utf-8") == CODE_V1
    assert json.loads((v1_dir / "params.json").read_text(encoding="utf-8")) == {"window": 20, "smooth": 0}

    versions = store.list_versions(USER, fid)
    assert [v["version"] for v in versions] == [1, 2]
    assert versions[0]["parent_version"] in (None, 0)  # v1 无父版本
    assert versions[1]["parent_version"] == 1

    latest = store.get_version(USER, fid, 2)
    assert latest["code"] == CODE_V2
    assert latest["params"]["smooth"] == 5


def test_optimistic_version_conflict(store: FactorStore):
    factor = _mk_factor(store, versions=1)
    fid = factor["factor_id"]
    # 基于过期版本提交 → 冲突
    with pytest.raises(ValueError, match="版本冲突"):
        store.save_version(USER, fid, code=CODE_V2, params={}, parent_version=0)
    # 未指定 parent → 默认基于当前版本
    result = store.save_version(USER, fid, code=CODE_V2, params={}, change_note="默认父版本")
    assert result["version"] == 2


def test_record_run_and_compare(store: FactorStore):
    factor = _mk_factor(store)
    fid = factor["factor_id"]
    run1 = store.record_run(USER, fid, version=1, universe="hs300+zz500",
                            data_start="20220101", data_end="20241231",
                            config=CONFIG, metrics=METRICS,
                            ic_series=IC_SERIES, layers=LAYERS)
    run2 = store.record_run(USER, fid, version=2, universe="hs300+zz500",
                            data_start="20220101", data_end="20241231",
                            config=CONFIG, metrics={**METRICS, "ic_mean": 0.051})

    runs = store.list_runs(USER, fid)
    assert {r["run_id"] for r in runs} == {run1["run_id"], run2["run_id"]}
    by_id = {r["run_id"]: r for r in runs}
    assert by_id[run1["run_id"]]["metrics"]["ir"] == 0.61
    assert by_id[run1["run_id"]]["ic_series_path"] is not None
    assert by_id[run1["run_id"]]["layers_path"] is not None

    ic = store.get_run_ic_series(USER, fid, run1["run_id"])
    assert ic["ic_series"] == IC_SERIES
    assert ic["version"] == 1

    compare = store.compare_runs(USER, fid, [run1["run_id"], run2["run_id"]])
    assert compare["comparable"] is True
    assert {r["version"] for r in compare["runs"]} == {1, 2}

    # 检验配置不一致 → comparable False + 提示
    run3 = store.record_run(USER, fid, version=2, universe="hs300+zz500",
                            data_start="20220101", data_end="20241231",
                            config={**CONFIG, "n_groups": 10}, metrics=METRICS)
    compare2 = store.compare_runs(USER, fid, [run1["run_id"], run3["run_id"]])
    assert compare2["comparable"] is False
    assert compare2["notes"]

    # 股票池不一致同样破坏口径
    run4 = store.record_run(USER, fid, version=2, universe="zz1000",
                            data_start="20220101", data_end="20241231",
                            config=CONFIG, metrics=METRICS)
    compare3 = store.compare_runs(USER, fid, [run1["run_id"], run4["run_id"]])
    assert compare3["comparable"] is False

    # 版本越界
    with pytest.raises(ValueError, match="版本越界"):
        store.record_run(USER, fid, version=99, config={}, metrics={})


def test_factor_status_category_and_latest_run(store: FactorStore):
    factor = _mk_factor(store)
    fid = factor["factor_id"]
    store.record_run(USER, fid, version=2, universe="hs300", config=CONFIG, metrics=METRICS)
    store.update_factor(USER, fid, status="adopted")

    items = store.list_factors(USER)
    assert items[0]["status"] == "adopted"
    assert items[0]["latest_run"]["metrics"]["ic_mean"] == 0.042

    with pytest.raises(ValueError, match="状态"):
        store.update_factor(USER, fid, status="bogus")

    # 状态词表：因子库比策略库多 adopted（已采用）
    store.update_factor(USER, fid, status="rejected")
    assert store.get_factor(USER, fid)["status"] == "rejected"

    with pytest.raises(ValueError, match="因子名称"):
        store.update_factor(USER, fid, name="  ")


# ── REST API ────────────────────────────────────────────────────────


@pytest.fixture()
def client(tmp_path: Path, monkeypatch) -> TestClient:
    app = FastAPI()
    app.include_router(router)
    app.state.kstock_factor_store = FactorStore(tmp_path)
    import scripts.kstock_factors as mod

    monkeypatch.setattr(mod, "get_effective_user_id", lambda: USER)
    return TestClient(app)


def test_api_full_flow(client: TestClient):
    created = client.post("/api/v1/kstock/factors", json={"name": "20日反转", "hypothesis": "超跌反弹", "category": "momentum"})
    assert created.status_code == 201
    fid = created.json()["factor_id"]

    saved = client.post(
        f"/api/v1/kstock/factors/{fid}/versions",
        json={"code": CODE_V1, "params": {"window": 20}, "change_note": "v1"},
    )
    assert saved.status_code == 201
    assert saved.json()["version"] == 1

    # 重复保存（parent 过期）→ 409
    conflict = client.post(
        f"/api/v1/kstock/factors/{fid}/versions",
        json={"code": CODE_V2, "params": {}, "parent_version": 0},
    )
    assert conflict.status_code == 409

    run = client.post(
        f"/api/v1/kstock/factors/{fid}/runs",
        json={"version": 1, "universe": "hs300", "data_start": "20230101", "data_end": "20241231",
              "config": CONFIG, "metrics": METRICS, "ic_series": IC_SERIES},
    )
    assert run.status_code == 201
    run_id = run.json()["run_id"]

    listing = client.get("/api/v1/kstock/factors")
    assert listing.json()[0]["factor_id"] == fid
    assert listing.json()[0]["latest_run"]["run_id"] == run_id

    versions = client.get(f"/api/v1/kstock/factors/{fid}/versions")
    assert versions.json()[0]["params"] == {"window": 20}

    ic = client.get(f"/api/v1/kstock/factors/{fid}/runs/{run_id}/ic_series")
    assert ic.status_code == 200
    assert ic.json()["ic_series"] == IC_SERIES

    compare = client.get(f"/api/v1/kstock/factors/{fid}/compare?runs={run_id},{run_id}")
    assert compare.status_code == 200
    assert compare.json()["comparable"] is True

    patch = client.patch(f"/api/v1/kstock/factors/{fid}", json={"status": "adopted"})
    assert patch.status_code == 200
    assert patch.json()["status"] == "adopted"

    missing = client.get("/api/v1/kstock/factors/fac_none")
    assert missing.status_code == 404

    bad_run = client.post(
        f"/api/v1/kstock/factors/{fid}/runs",
        json={"version": 99, "config": {}, "metrics": {}},
    )
    assert bad_run.status_code == 422


# ── agent 工具 ──────────────────────────────────────────────────────


def test_factor_tools_roundtrip(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("KSTOCK_APP_DATA_DIR", str(tmp_path))
    import scripts.kstock_tools.factor_store_tool as tool_mod
    import scripts.kstock_factors as mod

    monkeypatch.setattr(mod, "get_effective_user_id", lambda: USER)
    # 工具内部 from ... import get_effective_user_id，patch 源模块即可

    created = json.loads(tool_mod.factor_create_tool._run(json.dumps({
        "name": "低波动", "hypothesis": "低波动异象", "category": "low_vol",
    })))
    assert "factor_id" in created
    assert created["category"] == "low_vol"
    fid = created["factor_id"]

    saved = json.loads(tool_mod.factor_save_version_tool._run(json.dumps({
        "factor_id": fid, "code": CODE_V1, "params": {"window": 252},
        "change_note": "初始", "parent_version": 0,
    })))
    assert saved["version"] == 1

    latest = json.loads(tool_mod.factor_get_latest_tool._run(json.dumps({"factor_id": fid})))
    assert latest["code"] == CODE_V1
    assert latest["params"] == {"window": 252}
    assert latest["current_version"] == 1

    recorded = json.loads(tool_mod.factor_record_run_tool._run(json.dumps({
        "factor_id": fid, "version": 1, "universe": "hs300+zz500",
        "data_start": "20220101", "data_end": "20241231",
        "config": CONFIG, "metrics": METRICS, "ic_series": IC_SERIES, "layers": LAYERS,
    })))
    assert recorded["run_id"].startswith("frun_")

    listing = json.loads(tool_mod.factor_list_tool._run(""))
    assert listing["factors"][0]["factor_id"] == fid
    assert listing["factors"][0]["latest_run"]["metrics"]["ic_mean"] == 0.042

    # 错误路径：坏 JSON / 缺字段 / 缺密钥环境外字段 → {"error": ...}
    err = json.loads(tool_mod.factor_save_version_tool._run("not-json"))
    assert "error" in err
    err2 = json.loads(tool_mod.factor_get_latest_tool._run(json.dumps({"factor_id": "fac_missing"})))
    assert "error" in err2
    err3 = json.loads(tool_mod.factor_create_tool._run(json.dumps({"name": ""})))
    assert "error" in err3
