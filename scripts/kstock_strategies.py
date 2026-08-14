"""策略研究工作区：策略身份 / 版本链 / 回测运行的持久化与索引。

设计要点（见「策略工作区」方案）：
- 策略是**活资产**（持续迭代的代码+参数），与一次性交付物的报告库分离；
  归档报告仍走报告库，回测运行记录通过 ``backtest_runs`` 与策略版本关联。
- 版本**不可变**：每次修改生成新版本快照（代码整文件 + 参数 JSON +
  变更说明），版本号单调递增；保存时校验 ``parent_version`` 防并发覆盖。
- 回测运行锁定可复现三元组：``策略版本 × 数据区间 × 交易规则配置``
  （佣金/印花税/滑点/T+1/涨跌停等，对齐 backtest_engine 的 A 股规则参数），
  不锁规则配置的跨版本对比没有意义。
- 存储：索引进 ``product/kstock.db``（设计文档的产品索引层，与引擎
  qilin.db 分库），文件落 ``product/strategies/{strategy_id}/``；
  沙箱内经 ``/mnt/strategies`` 只读挂载供 agent 阅读当前版本。
"""

from __future__ import annotations

import hashlib
import json
import re
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from qilin.runtime.user_context import get_effective_user_id

router = APIRouter(prefix="/api/v1/kstock", tags=["kstock-strategies"])

_SAFE_ID = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")

# 容量上限：防止 agent 把超大 payload 灌进 sqlite / 磁盘。
_MAX_CODE_BYTES = 512 * 1024
_MAX_PARAMS_BYTES = 64 * 1024
_MAX_METRICS_BYTES = 64 * 1024
_MAX_RULES_BYTES = 16 * 1024
_MAX_EQUITY_BYTES = 2 * 1024 * 1024
_MAX_TRADES_BYTES = 4 * 1024 * 1024


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class StrategyStore:
    """策略 / 版本 / 回测运行的 SQLite 索引 + 文件存储。"""

    def __init__(self, data_root: Path, db_path: Path | None = None):
        self.data_root = Path(data_root).expanduser().resolve()
        self.strategies_root = self.data_root / "product" / "strategies"
        self.db_path = Path(
            db_path or (self.data_root / "product" / "kstock.db")
        )
        self.strategies_root.mkdir(parents=True, exist_ok=True)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    # ── 基础设施 ──────────────────────────────────────────────────────

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS strategies (
                    user_id TEXT NOT NULL,
                    strategy_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    hypothesis TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL DEFAULT 'researching',
                    current_version INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (user_id, strategy_id)
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS strategy_versions (
                    user_id TEXT NOT NULL,
                    strategy_id TEXT NOT NULL,
                    version INTEGER NOT NULL,
                    parent_version INTEGER,
                    code_sha256 TEXT NOT NULL,
                    code_bytes INTEGER NOT NULL,
                    params_json TEXT NOT NULL,
                    change_note TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (user_id, strategy_id, version)
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS backtest_runs (
                    user_id TEXT NOT NULL,
                    run_id TEXT NOT NULL,
                    strategy_id TEXT NOT NULL,
                    version INTEGER NOT NULL,
                    data_start TEXT NOT NULL DEFAULT '',
                    data_end TEXT NOT NULL DEFAULT '',
                    rules_json TEXT NOT NULL,
                    metrics_json TEXT NOT NULL,
                    equity_path TEXT,
                    trades_path TEXT,
                    thread_id TEXT,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (user_id, run_id)
                )
                """
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_strategy_versions ON strategy_versions (user_id, strategy_id, version)"
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_backtest_runs ON backtest_runs (user_id, strategy_id, version, created_at)"
            )

    def _strategy_dir(self, user_id: str, strategy_id: str) -> Path:
        return self.strategies_root / user_id / strategy_id

    # ── 策略身份 ──────────────────────────────────────────────────────

    def create_strategy(self, user_id: str, name: str, hypothesis: str = "") -> dict[str, Any]:
        if not name.strip():
            raise ValueError("策略名称不能为空")
        strategy_id = f"stg_{secrets.token_hex(6)}"
        now = _now()
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO strategies (user_id, strategy_id, name, hypothesis, status, current_version, created_at, updated_at)"
                " VALUES (?, ?, ?, ?, 'researching', 0, ?, ?)",
                (user_id, strategy_id, name.strip(), hypothesis.strip(), now, now),
            )
        return self.get_strategy(user_id, strategy_id)

    def get_strategy(self, user_id: str, strategy_id: str) -> dict[str, Any]:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM strategies WHERE user_id = ? AND strategy_id = ?",
                (user_id, strategy_id),
            ).fetchone()
        if row is None:
            raise KeyError(f"策略不存在：{strategy_id}")
        return dict(row)

    def list_strategies(self, user_id: str) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM strategies WHERE user_id = ? ORDER BY updated_at DESC",
                (user_id,),
            ).fetchall()
        result = []
        for row in rows:
            item = dict(row)
            latest = self._latest_run(connection=None, user_id=user_id, strategy_id=row["strategy_id"])
            item["latest_run"] = latest
            result.append(item)
        return result

    def update_strategy(
        self,
        user_id: str,
        strategy_id: str,
        *,
        name: str | None = None,
        hypothesis: str | None = None,
        status: str | None = None,
    ) -> dict[str, Any]:
        current = self.get_strategy(user_id, strategy_id)
        if status is not None and status not in ("researching", "paused", "rejected"):
            raise ValueError("状态仅支持 researching / paused / rejected")
        updates: dict[str, Any] = {"updated_at": _now()}
        if name is not None:
            if not name.strip():
                raise ValueError("策略名称不能为空")
            updates["name"] = name.strip()
        if hypothesis is not None:
            updates["hypothesis"] = hypothesis.strip()
        if status is not None:
            updates["status"] = status
        sets = ", ".join(f"{key} = ?" for key in updates)
        with self._connect() as connection:
            connection.execute(
                f"UPDATE strategies SET {sets} WHERE user_id = ? AND strategy_id = ?",
                (*updates.values(), user_id, strategy_id),
            )
        _ = current
        return self.get_strategy(user_id, strategy_id)

    # ── 版本链 ────────────────────────────────────────────────────────

    def save_version(
        self,
        user_id: str,
        strategy_id: str,
        *,
        code: str,
        params: dict[str, Any],
        change_note: str = "",
        parent_version: int | None = None,
    ) -> dict[str, Any]:
        """保存新版本快照；parent_version 必须等于当前版本（乐观并发控制）。"""
        strategy = self.get_strategy(user_id, strategy_id)
        current = int(strategy["current_version"])
        if parent_version is None:
            parent_version = current
        if int(parent_version) != current:
            raise ValueError(
                f"版本冲突：策略当前版本为 v{current}，提交基于 v{parent_version}。"
                "请先重新读取最新版本再提交修改。"
            )

        code_bytes = code.encode("utf-8")
        if len(code_bytes) > _MAX_CODE_BYTES:
            raise ValueError(f"策略代码超过 {_MAX_CODE_BYTES // 1024}KB 上限")
        params_text = json.dumps(params, ensure_ascii=False)
        if len(params_text.encode("utf-8")) > _MAX_PARAMS_BYTES:
            raise ValueError(f"参数 JSON 超过 {_MAX_PARAMS_BYTES // 1024}KB 上限")

        version = current + 1
        sha256 = hashlib.sha256(code_bytes).hexdigest()
        version_dir = self._strategy_dir(user_id, strategy_id) / "versions" / f"v{version:03d}"
        version_dir.mkdir(parents=True, exist_ok=True)
        (version_dir / "signal_engine.py").write_bytes(code_bytes)
        (version_dir / "params.json").write_text(params_text, encoding="utf-8")
        (version_dir / "CHANGE.md").write_text(change_note.strip() or "(无变更说明)", encoding="utf-8")

        now = _now()
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO strategy_versions (user_id, strategy_id, version, parent_version, code_sha256, code_bytes, params_json, change_note, created_at)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (user_id, strategy_id, version, current, sha256, len(code_bytes), params_text, change_note.strip(), now),
            )
            connection.execute(
                "UPDATE strategies SET current_version = ?, updated_at = ? WHERE user_id = ? AND strategy_id = ?",
                (version, now, user_id, strategy_id),
            )
        return {
            "strategy_id": strategy_id,
            "version": version,
            "parent_version": current,
            "code_sha256": sha256,
            "created_at": now,
        }

    def list_versions(self, user_id: str, strategy_id: str) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT version, parent_version, code_sha256, code_bytes, params_json, change_note, created_at"
                " FROM strategy_versions WHERE user_id = ? AND strategy_id = ? ORDER BY version",
                (user_id, strategy_id),
            ).fetchall()
        if not rows:
            self.get_strategy(user_id, strategy_id)  # 抛 KeyError：策略不存在
        result = []
        for row in rows:
            item = dict(row)
            item["params"] = json.loads(item.pop("params_json"))
            result.append(item)
        return result

    def get_version(self, user_id: str, strategy_id: str, version: int) -> dict[str, Any]:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM strategy_versions WHERE user_id = ? AND strategy_id = ? AND version = ?",
                (user_id, strategy_id, version),
            ).fetchone()
        if row is None:
            raise KeyError(f"版本不存在：{strategy_id} v{version}")
        item = dict(row)
        item["params"] = json.loads(item.pop("params_json"))
        code_path = self._strategy_dir(user_id, strategy_id) / "versions" / f"v{version:03d}" / "signal_engine.py"
        item["code"] = code_path.read_text(encoding="utf-8")
        item["code_path"] = str(code_path)
        return item

    # ── 回测运行 ──────────────────────────────────────────────────────

    def record_run(
        self,
        user_id: str,
        strategy_id: str,
        *,
        version: int,
        data_start: str = "",
        data_end: str = "",
        rules: dict[str, Any] | None = None,
        metrics: dict[str, Any] | None = None,
        equity: Any | None = None,
        trades: Any | None = None,
        thread_id: str | None = None,
    ) -> dict[str, Any]:
        strategy = self.get_strategy(user_id, strategy_id)
        if int(version) < 1 or int(version) > int(strategy["current_version"]):
            raise ValueError(f"版本越界：v{version}（当前最新 v{strategy['current_version']}）")

        rules_text = json.dumps(rules or {}, ensure_ascii=False)
        metrics_text = json.dumps(metrics or {}, ensure_ascii=False)
        if len(rules_text.encode()) > _MAX_RULES_BYTES:
            raise ValueError("规则配置超过 16KB 上限")
        if len(metrics_text.encode()) > _MAX_METRICS_BYTES:
            raise ValueError("指标超过 64KB 上限")

        run_id = f"srun_{secrets.token_hex(6)}"
        run_dir = self._strategy_dir(user_id, strategy_id) / "runs" / run_id
        run_dir.mkdir(parents=True, exist_ok=True)

        equity_path: str | None = None
        trades_path: str | None = None
        if equity is not None:
            equity_text = json.dumps(equity, ensure_ascii=False)
            if len(equity_text.encode()) > _MAX_EQUITY_BYTES:
                raise ValueError("净值曲线超过 2MB 上限（可降采样后提交）")
            (run_dir / "equity.json").write_text(equity_text, encoding="utf-8")
            equity_path = str((run_dir / "equity.json").relative_to(self.strategies_root))
        if trades is not None:
            trades_text = json.dumps(trades, ensure_ascii=False)
            if len(trades_text.encode()) > _MAX_TRADES_BYTES:
                raise ValueError("交易明细超过 4MB 上限")
            (run_dir / "trades.json").write_text(trades_text, encoding="utf-8")
            trades_path = str((run_dir / "trades.json").relative_to(self.strategies_root))

        now = _now()
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO backtest_runs (user_id, run_id, strategy_id, version, data_start, data_end, rules_json, metrics_json, equity_path, trades_path, thread_id, created_at)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (user_id, run_id, strategy_id, int(version), data_start, data_end, rules_text, metrics_text, equity_path, trades_path, thread_id, now),
            )
            connection.execute(
                "UPDATE strategies SET updated_at = ? WHERE user_id = ? AND strategy_id = ?",
                (now, user_id, strategy_id),
            )
        return {"run_id": run_id, "strategy_id": strategy_id, "version": version, "created_at": now}

    def list_runs(self, user_id: str, strategy_id: str, version: int | None = None) -> list[dict[str, Any]]:
        query = "SELECT * FROM backtest_runs WHERE user_id = ? AND strategy_id = ?"
        args: list[Any] = [user_id, strategy_id]
        if version is not None:
            query += " AND version = ?"
            args.append(version)
        query += " ORDER BY created_at DESC"
        with self._connect() as connection:
            rows = connection.execute(query, args).fetchall()
        result = []
        for row in rows:
            item = dict(row)
            item["rules"] = json.loads(item.pop("rules_json"))
            item["metrics"] = json.loads(item.pop("metrics_json"))
            result.append(item)
        return result

    def _latest_run(self, connection: sqlite3.Connection | None, *, user_id: str, strategy_id: str) -> dict[str, Any] | None:
        def _query(conn: sqlite3.Connection) -> sqlite3.Row | None:
            return conn.execute(
                "SELECT * FROM backtest_runs WHERE user_id = ? AND strategy_id = ? ORDER BY created_at DESC LIMIT 1",
                (user_id, strategy_id),
            ).fetchone()

        row = _query(connection) if connection is not None else None
        if row is None and connection is None:
            with self._connect() as conn:
                row = _query(conn)
        if row is None:
            return None
        item = dict(row)
        item["rules"] = json.loads(item.pop("rules_json"))
        item["metrics"] = json.loads(item.pop("metrics_json"))
        return item

    def compare_runs(self, user_id: str, strategy_id: str, run_ids: list[str]) -> dict[str, Any]:
        """按 run_id 集合对比：对齐指标并标注口径（数据区间/规则）是否一致。"""
        rows: list[dict[str, Any]] = []
        with self._connect() as connection:
            for run_id in run_ids:
                row = connection.execute(
                    "SELECT * FROM backtest_runs WHERE user_id = ? AND strategy_id = ? AND run_id = ?",
                    (user_id, strategy_id, run_id),
                ).fetchone()
                if row is None:
                    raise KeyError(f"回测运行不存在：{run_id}")
                item = dict(row)
                item["rules"] = json.loads(item.pop("rules_json"))
                item["metrics"] = json.loads(item.pop("metrics_json"))
                rows.append(item)
        ranges = {(r["data_start"], r["data_end"]) for r in rows}
        rules_set = {json.dumps(r["rules"], sort_keys=True) for r in rows}
        return {
            "strategy_id": strategy_id,
            "runs": rows,
            "comparable": len(ranges) == 1 and len(rules_set) == 1,
            "notes": [] if len(ranges) == 1 and len(rules_set) == 1 else [
                "所选运行的数据区间或交易规则配置不一致，对比仅供粗略参考；"
                "严格对比应使用相同数据区间与相同规则配置的运行。",
            ],
        }


# ── API 请求/响应模型 ────────────────────────────────────────────────


class StrategyCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    hypothesis: str = Field(default="", max_length=8000)


class StrategyUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    hypothesis: str | None = Field(default=None, max_length=8000)
    status: str | None = None


class StrategyVersionRequest(BaseModel):
    code: str = Field(min_length=1)
    params: dict[str, Any] = Field(default_factory=dict)
    change_note: str = Field(default="", max_length=8000)
    parent_version: int | None = None


class BacktestRunRequest(BaseModel):
    version: int = Field(ge=1)
    data_start: str = Field(default="", max_length=16)
    data_end: str = Field(default="", max_length=16)
    rules: dict[str, Any] = Field(default_factory=dict)
    metrics: dict[str, Any] = Field(default_factory=dict)
    equity: Any | None = None
    trades: Any | None = None
    thread_id: str | None = Field(default=None, max_length=128)


def _store(request) -> StrategyStore:
    store = getattr(request.app.state, "kstock_strategy_store", None)
    if store is None:
        raise HTTPException(status_code=503, detail="策略库未初始化")
    return store


def _user() -> str:
    return str(get_effective_user_id())


@router.get("/strategies")
def list_strategies(request: Request):
    return _store(request).list_strategies(_user())


@router.post("/strategies", status_code=201)
def create_strategy(request: Request, body: StrategyCreateRequest):
    try:
        return _store(request).create_strategy(_user(), body.name, body.hypothesis)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/strategies/{strategy_id}")
def get_strategy(request: Request, strategy_id: str):
    try:
        return _store(request).get_strategy(_user(), strategy_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/strategies/{strategy_id}")
def update_strategy(request: Request, strategy_id: str, body: StrategyUpdateRequest):
    try:
        return _store(request).update_strategy(
            _user(), strategy_id, name=body.name, hypothesis=body.hypothesis, status=body.status
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/strategies/{strategy_id}/versions")
def list_versions(request: Request, strategy_id: str):
    try:
        return _store(request).list_versions(_user(), strategy_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/strategies/{strategy_id}/versions", status_code=201)
def save_version(request: Request, strategy_id: str, body: StrategyVersionRequest):
    try:
        return _store(request).save_version(
            _user(), strategy_id,
            code=body.code, params=body.params,
            change_note=body.change_note, parent_version=body.parent_version,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/strategies/{strategy_id}/versions/{version}")
def get_version(request: Request, strategy_id: str, version: int):
    try:
        return _store(request).get_version(_user(), strategy_id, version)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/strategies/{strategy_id}/runs", status_code=201)
def record_run(request: Request, strategy_id: str, body: BacktestRunRequest):
    try:
        return _store(request).record_run(
            _user(), strategy_id,
            version=body.version, data_start=body.data_start, data_end=body.data_end,
            rules=body.rules, metrics=body.metrics,
            equity=body.equity, trades=body.trades, thread_id=body.thread_id,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/strategies/{strategy_id}/runs")
def list_runs(request: Request, strategy_id: str, version: int | None = None):
    return _store(request).list_runs(_user(), strategy_id, version)


@router.get("/strategies/{strategy_id}/compare")
def compare_runs(request: Request, strategy_id: str, runs: str):
    run_ids = [item.strip() for item in runs.split(",") if item.strip()]
    if len(run_ids) < 2:
        raise HTTPException(status_code=422, detail="对比至少需要 2 个 run_id（逗号分隔）")
    try:
        return _store(request).compare_runs(_user(), strategy_id, run_ids)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
