"""选股工作区（scripts/kstock_selections）单元测试。

与 test_kstock_strategies.py / test_kstock_factors.py 同构：覆盖要求版本链
与乐观并发、运行归档与对比口径、报告/命中清单读取、REST API 全流程、
agent 工具的 JSON 契约。用 tmp_path 隔离，不触碰真实用户数据空间。
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from scripts.kstock_selections import SelectionStore, router

USER = "u-test"

CRITERIA_V1 = {"strategies": ["高股息"], "market_cap": "large", "pool": "hs300", "top_n": 10, "summary": "高股息 大市值 沪深300 TopN 10"}
CRITERIA_V2 = {"strategies": ["高股息", "价值投资"], "market_cap": "large", "pool": "hs300", "top_n": 10, "summary": "高股息+价值 双策略 大市值 沪深300 TopN 10"}
RULES = {"scripts": ["run_high_dividend.py"], "market_cap": "large", "top_n": 10}
METRICS = {"hit_count": 23, "strategy_count": 1, "consensus_count": 0, "top_n": 10}
PICKS = [
    {"code": "600036.SH", "name": "招商银行", "score": 82.5, "strategies": ["高股息"], "rank": 1},
    {"code": "601088.SH", "name": "中国神华", "score": 80.1, "strategies": ["高股息"], "rank": 2},
]
REPORT = "# 高股息组合选股报告\n\n## TopN 清单\n\n| 代码 | 名称 | 评分 |\n|---|---|---|\n"


@pytest.fixture()
def store(tmp_path: Path) -> SelectionStore:
    return SelectionStore(tmp_path)


def _mk_selection(store: SelectionStore, versions: int = 2) -> dict:
    selection = store.create_selection(USER, "高股息组合", "高股息 + 大市值 + 沪深300", params=CRITERIA_V1)
    if versions >= 2:
        store.save_version(
            USER, selection["selection_id"],
            criteria_json=CRITERIA_V2,
            change_note="加入价值投资策略共振",
        )
    return selection


# ── 存储层 ──────────────────────────────────────────────────────────


def test_create_lands_v1_and_version_chain(store: SelectionStore, tmp_path: Path):
    selection = _mk_selection(store)
    sid = selection["selection_id"]

    # create 返回的是落 v1 时的快照；后续 save_version 已推进版本，重读最新状态。
    fresh = store.get_selection(USER, sid)
    assert fresh["status"] == "watching"
    assert fresh["current_version"] == 2  # create 落 v1 + 变更落 v2
    v1_dir = tmp_path / "product" / "selections" / USER / sid / "versions" / "v001"
    assert json.loads((v1_dir / "criteria.json").read_text(encoding="utf-8")) == CRITERIA_V1

    versions = store.list_versions(USER, sid)
    assert [v["version"] for v in versions] == [1, 2]
    assert versions[1]["criteria"]["strategies"] == ["高股息", "价值投资"]
    # criteria_json.summary 回写方案口径摘要
    assert "双策略" in store.get_selection(USER, sid)["criteria"]


def test_optimistic_version_conflict(store: SelectionStore):
    selection = _mk_selection(store, versions=1)
    sid = selection["selection_id"]
    # 基于过期版本提交 → 冲突
    with pytest.raises(ValueError, match="版本冲突"):
        store.save_version(USER, sid, criteria_json=CRITERIA_V2, parent_version=0)
    # 未指定 parent → 默认基于当前版本
    result = store.save_version(USER, sid, criteria_json=CRITERIA_V2, change_note="默认父版本")
    assert result["version"] == 2


def test_record_run_report_picks_and_compare(store: SelectionStore):
    selection = _mk_selection(store)
    sid = selection["selection_id"]
    run1 = store.record_run(USER, sid, version=1, trade_date="20240927", universe="沪深300",
                            rules=RULES, metrics=METRICS, report=REPORT, picks=PICKS)
    run2 = store.record_run(USER, sid, version=2, trade_date="20240930", universe="沪深300",
                            rules=RULES, metrics={**METRICS, "consensus_count": 5}, report=REPORT, picks=PICKS)

    runs = store.list_runs(USER, sid)
    assert {r["run_id"] for r in runs} == {run1["run_id"], run2["run_id"]}
    assert runs[0]["run_id"] == run2["run_id"]  # created_at DESC

    report = store.get_run_report(USER, sid, run1["run_id"])
    assert report["report"].startswith("# 高股息组合选股报告")
    assert report["trade_date"] == "20240927"

    picks = store.get_run_picks(USER, sid, run1["run_id"])
    assert picks["picks"][0]["code"] == "600036.SH"

    # 跨基准日（trade_date 不同）但同口径 → comparable True（时间序列跟踪语义）
    compare = store.compare_runs(USER, sid, [run1["run_id"], run2["run_id"]])
    assert compare["comparable"] is True

    # 执行口径不一致 → comparable False + 提示
    run3 = store.record_run(USER, sid, version=2, trade_date="20240930", universe="沪深300",
                            rules={**RULES, "top_n": 20}, metrics=METRICS)
    compare2 = store.compare_runs(USER, sid, [run1["run_id"], run3["run_id"]])
    assert compare2["comparable"] is False
    assert compare2["notes"]

    # 版本越界 / 未存报告
    with pytest.raises(ValueError, match="版本越界"):
        store.record_run(USER, sid, version=99, rules={}, metrics={})
    run4 = store.record_run(USER, sid, version=1, rules=RULES, metrics=METRICS)
    with pytest.raises(ValueError, match="未存报告"):
        store.get_run_report(USER, sid, run4["run_id"])
    with pytest.raises(ValueError, match="未存命中清单"):
        store.get_run_picks(USER, sid, run4["run_id"])


def test_selection_status_and_latest_run(store: SelectionStore):
    selection = _mk_selection(store)
    sid = selection["selection_id"]
    store.record_run(USER, sid, version=1, trade_date="20240930", universe="沪深300",
                     rules=RULES, metrics=METRICS, report=REPORT)
    store.update_selection(USER, sid, status="archived")

    items = store.list_selections(USER)
    assert items[0]["status"] == "archived"
    assert items[0]["latest_run"]["metrics"]["hit_count"] == 23
    assert items[0]["latest_run"]["trade_date"] == "20240930"

    with pytest.raises(ValueError, match="状态"):
        store.update_selection(USER, sid, status="bogus")

    with pytest.raises(ValueError, match="名称"):
        store.update_selection(USER, sid, name="  ")


# ── REST API ────────────────────────────────────────────────────────


@pytest.fixture()
def client(tmp_path: Path, monkeypatch) -> TestClient:
    app = FastAPI()
    app.include_router(router)
    app.state.kstock_selection_store = SelectionStore(tmp_path)
    import scripts.kstock_selections as mod

    monkeypatch.setattr(mod, "get_effective_user_id", lambda: USER)
    return TestClient(app)


def test_api_full_flow(client: TestClient):
    created = client.post("/api/v1/kstock/selections", json={
        "name": "双低转债", "criteria": "双低策略", "params": {"strategies": ["双低"]},
    })
    assert created.status_code == 201
    sid = created.json()["selection_id"]
    assert created.json()["current_version"] == 1  # create 落 v1

    saved = client.post(
        f"/api/v1/kstock/selections/{sid}/versions",
        json={"criteria_json": CRITERIA_V1, "change_note": "v1 调整"},
    )
    assert saved.status_code == 201
    assert saved.json()["version"] == 2

    # 重复保存（parent 过期）→ 409
    conflict = client.post(
        f"/api/v1/kstock/selections/{sid}/versions",
        json={"criteria_json": CRITERIA_V2, "parent_version": 0},
    )
    assert conflict.status_code == 409

    run = client.post(
        f"/api/v1/kstock/selections/{sid}/runs",
        json={"version": 1, "trade_date": "20240930", "universe": "沪深300",
              "rules": RULES, "metrics": METRICS, "report": REPORT, "picks": PICKS},
    )
    assert run.status_code == 201
    run_id = run.json()["run_id"]

    listing = client.get("/api/v1/kstock/selections")
    assert listing.json()[0]["selection_id"] == sid
    assert listing.json()[0]["latest_run"]["run_id"] == run_id

    report = client.get(f"/api/v1/kstock/selections/{sid}/runs/{run_id}/report")
    assert report.status_code == 200
    assert "选股报告" in report.json()["report"]

    picks = client.get(f"/api/v1/kstock/selections/{sid}/runs/{run_id}/picks")
    assert picks.status_code == 200
    assert picks.json()["picks"][0]["code"] == "600036.SH"

    compare = client.get(f"/api/v1/kstock/selections/{sid}/compare?runs={run_id},{run_id}")
    assert compare.status_code == 200
    assert compare.json()["comparable"] is True

    patch = client.patch(f"/api/v1/kstock/selections/{sid}", json={"status": "watching"})
    assert patch.status_code == 200

    missing = client.get("/api/v1/kstock/selections/sel_none")
    assert missing.status_code == 404

    bad_run = client.post(
        f"/api/v1/kstock/selections/{sid}/runs",
        json={"version": 99, "rules": {}, "metrics": {}},
    )
    assert bad_run.status_code == 422


# ── agent 工具 ──────────────────────────────────────────────────────


def test_selection_tools_roundtrip(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("KSTOCK_APP_DATA_DIR", str(tmp_path))
    import scripts.kstock_tools.selection_store_tool as tool_mod
    import scripts.kstock_selections as mod

    monkeypatch.setattr(mod, "get_effective_user_id", lambda: USER)
    # 工具内部 from ... import get_effective_user_id，patch 源模块即可

    created = json.loads(tool_mod.selection_create_tool._run(json.dumps({
        "name": "高股息组合", "criteria": "高股息 + 大市值", "params": CRITERIA_V1,
    })))
    assert "selection_id" in created
    sid = created["selection_id"]

    latest = json.loads(tool_mod.selection_get_latest_tool._run(json.dumps({"selection_id": sid})))
    assert latest["current_version"] == 1
    assert latest["structured"]["strategies"] == ["高股息"]

    saved = json.loads(tool_mod.selection_save_version_tool._run(json.dumps({
        "selection_id": sid, "criteria_json": CRITERIA_V2,
        "change_note": "加入价值投资", "parent_version": 1,
    })))
    assert saved["version"] == 2

    recorded = json.loads(tool_mod.selection_record_run_tool._run(json.dumps({
        "selection_id": sid, "version": 2, "trade_date": "20240930", "universe": "沪深300",
        "rules": RULES, "metrics": METRICS, "report": REPORT, "picks": PICKS,
    })))
    assert recorded["run_id"].startswith("xrun_")

    listing = json.loads(tool_mod.selection_list_tool._run(""))
    assert listing["selections"][0]["selection_id"] == sid
    assert listing["selections"][0]["latest_run"]["metrics"]["hit_count"] == 23

    # 错误路径：坏 JSON / 缺字段 → {"error": ...}
    err = json.loads(tool_mod.selection_save_version_tool._run("not-json"))
    assert "error" in err
    err2 = json.loads(tool_mod.selection_get_latest_tool._run(json.dumps({"selection_id": "sel_missing"})))
    assert "error" in err2
    err3 = json.loads(tool_mod.selection_record_run_tool._run(json.dumps({"version": 1})))
    assert "error" in err3
