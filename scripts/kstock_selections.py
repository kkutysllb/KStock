"""选股工作区：选股方案身份 / 要求版本链 / 选股运行与报告的持久化与索引。

与「策略工作区」（scripts/kstock_strategies.py）、「因子工作区」
（scripts/kstock_factors.py）同构的活资产管理，域模型换成选股语义
（见 lead_soul「选股策略扫描场景」）：
- 选股方案是**活资产**：用户的不同选股要求（策略组合 / 市值 / 股票池 /
  TopN / 排序）以 criteria（自然语言）+ criteria_json（结构化口径）固化；
- 要求版本**不可变**：每次调整选股要求生成新版本快照（结构化口径 +
  参数 + 变更说明），版本号单调递增；保存时校验 parent_version 防并发覆盖；
- 选股运行归档**报告**：每次执行锁定「要求版本 × 选股基准日 × 股票池 ×
  执行口径」，报告全文（命中清单 / 共振股 / TopN / 风险提示）与命中清单
  JSON 一并入库；跨基准日运行 = 对同一方案的时间序列跟踪；
- 存储：索引进 product/kstock.db（产品索引层，与策略库/因子库同库不同表），
  文件落 product/selections/{selection_id}/；沙箱内经 /mnt/selections 只读
  挂载供 agent 阅读当前要求（读写必须走选股库工具保证版本纪律）。
"""

from __future__ import annotations

import json
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from qilin.runtime.user_context import get_effective_user_id

router = APIRouter(prefix="/api/v1/kstock", tags=["kstock-selections"])

# 容量上限：防止 agent 把超大 payload 灌进 sqlite / 磁盘（与策略/因子库同量级）。
_MAX_CRITERIA_BYTES = 64 * 1024
_MAX_PARAMS_BYTES = 64 * 1024
_MAX_METRICS_BYTES = 64 * 1024
_MAX_RULES_BYTES = 16 * 1024
_MAX_REPORT_BYTES = 2 * 1024 * 1024
_MAX_PICKS_BYTES = 4 * 1024 * 1024

# 选股方案生命周期：watching 跟踪中 / archived 已归档 / closed 已停用。
_SELECTION_STATUSES = ("watching", "archived", "closed")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class SelectionStore:
    """选股方案 / 要求版本 / 选股运行的 SQLite 索引 + 文件存储。"""

    def __init__(self, data_root: Path, db_path: Path | None = None):
        self.data_root = Path(data_root).expanduser().resolve()
        self.selections_root = self.data_root / "product" / "selections"
        self.db_path = Path(
            db_path or (self.data_root / "product" / "kstock.db")
        )
        self.selections_root.mkdir(parents=True, exist_ok=True)
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
                CREATE TABLE IF NOT EXISTS selections (
                    user_id TEXT NOT NULL,
                    selection_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    criteria TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL DEFAULT 'watching',
                    current_version INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (user_id, selection_id)
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS selection_versions (
                    user_id TEXT NOT NULL,
                    selection_id TEXT NOT NULL,
                    version INTEGER NOT NULL,
                    parent_version INTEGER,
                    criteria_json TEXT NOT NULL,
                    criteria_bytes INTEGER NOT NULL,
                    params_json TEXT NOT NULL,
                    change_note TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (user_id, selection_id, version)
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS selection_runs (
                    user_id TEXT NOT NULL,
                    run_id TEXT NOT NULL,
                    selection_id TEXT NOT NULL,
                    version INTEGER NOT NULL,
                    trade_date TEXT NOT NULL DEFAULT '',
                    universe TEXT NOT NULL DEFAULT '',
                    rules_json TEXT NOT NULL,
                    metrics_json TEXT NOT NULL,
                    report_path TEXT,
                    picks_path TEXT,
                    thread_id TEXT,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (user_id, run_id)
                )
                """
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_selection_versions ON selection_versions (user_id, selection_id, version)"
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_selection_runs ON selection_runs (user_id, selection_id, version, created_at)"
            )

    def _selection_dir(self, user_id: str, selection_id: str) -> Path:
        return self.selections_root / user_id / selection_id

    # ── 选股方案身份 ──────────────────────────────────────────────────

    def create_selection(
        self,
        user_id: str,
        name: str,
        criteria: str = "",
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if not name.strip():
            raise ValueError("选股方案名称不能为空")
        selection_id = f"sel_{secrets.token_hex(6)}"
        now = _now()
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO selections (user_id, selection_id, name, criteria, status, current_version, created_at, updated_at)"
                " VALUES (?, ?, ?, ?, 'watching', 0, ?, ?)",
                (user_id, selection_id, name.strip(), criteria.strip(), now, now),
            )
        # 要求口径直接落 v1（有明确要求时），后续调整走 save_version。
        structured = params or {}
        if criteria.strip() or structured:
            self.save_version(
                user_id, selection_id,
                criteria_json=structured,
                params={},
                change_note="初始选股要求",
                parent_version=0,
            )
        return self.get_selection(user_id, selection_id)

    def get_selection(self, user_id: str, selection_id: str) -> dict[str, Any]:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM selections WHERE user_id = ? AND selection_id = ?",
                (user_id, selection_id),
            ).fetchone()
        if row is None:
            raise KeyError(f"选股方案不存在：{selection_id}")
        return dict(row)

    def list_selections(self, user_id: str) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM selections WHERE user_id = ? ORDER BY updated_at DESC",
                (user_id,),
            ).fetchall()
        result = []
        for row in rows:
            item = dict(row)
            latest = self._latest_run(connection=None, user_id=user_id, selection_id=row["selection_id"])
            item["latest_run"] = latest
            result.append(item)
        return result

    def update_selection(
        self,
        user_id: str,
        selection_id: str,
        *,
        name: str | None = None,
        criteria: str | None = None,
        status: str | None = None,
    ) -> dict[str, Any]:
        current = self.get_selection(user_id, selection_id)
        if status is not None and status not in _SELECTION_STATUSES:
            raise ValueError("状态仅支持 watching / archived / closed")
        updates: dict[str, Any] = {"updated_at": _now()}
        if name is not None:
            if not name.strip():
                raise ValueError("选股方案名称不能为空")
            updates["name"] = name.strip()
        if criteria is not None:
            updates["criteria"] = criteria.strip()
        if status is not None:
            updates["status"] = status
        sets = ", ".join(f"{key} = ?" for key in updates)
        with self._connect() as connection:
            connection.execute(
                f"UPDATE selections SET {sets} WHERE user_id = ? AND selection_id = ?",
                (*updates.values(), user_id, selection_id),
            )
        _ = current
        return self.get_selection(user_id, selection_id)

    # ── 要求版本链 ────────────────────────────────────────────────────

    def save_version(
        self,
        user_id: str,
        selection_id: str,
        *,
        criteria_json: dict[str, Any],
        params: dict[str, Any] | None = None,
        change_note: str = "",
        parent_version: int | None = None,
    ) -> dict[str, Any]:
        """保存新版本要求快照；parent_version 必须等于当前版本（乐观并发控制）。"""
        selection = self.get_selection(user_id, selection_id)
        current = int(selection["current_version"])
        if parent_version is None:
            parent_version = current
        if int(parent_version) != current:
            raise ValueError(
                f"版本冲突：选股方案当前版本为 v{current}，提交基于 v{parent_version}。"
                "请先重新读取最新版本再提交修改。"
            )

        criteria_text = json.dumps(criteria_json or {}, ensure_ascii=False)
        if len(criteria_text.encode("utf-8")) > _MAX_CRITERIA_BYTES:
            raise ValueError(f"选股要求 JSON 超过 {_MAX_CRITERIA_BYTES // 1024}KB 上限")
        params_text = json.dumps(params or {}, ensure_ascii=False)
        if len(params_text.encode("utf-8")) > _MAX_PARAMS_BYTES:
            raise ValueError(f"参数 JSON 超过 {_MAX_PARAMS_BYTES // 1024}KB 上限")

        version = current + 1
        version_dir = self._selection_dir(user_id, selection_id) / "versions" / f"v{version:03d}"
        version_dir.mkdir(parents=True, exist_ok=True)
        (version_dir / "criteria.json").write_text(criteria_text, encoding="utf-8")
        (version_dir / "params.json").write_text(params_text, encoding="utf-8")
        (version_dir / "CHANGE.md").write_text(change_note.strip() or "(无变更说明)", encoding="utf-8")

        now = _now()
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO selection_versions (user_id, selection_id, version, parent_version, criteria_json, criteria_bytes, params_json, change_note, created_at)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (user_id, selection_id, version, current, criteria_text, len(criteria_text.encode("utf-8")), params_text, change_note.strip(), now),
            )
            connection.execute(
                "UPDATE selections SET current_version = ?, updated_at = ? WHERE user_id = ? AND selection_id = ?",
                (version, now, user_id, selection_id),
            )
            if change_note.strip() and current >= 1:
                # 方案自由文本口径同步最新要求摘要（保持列表展示有用）。
                summary = str(criteria_json.get("summary") or "").strip()
                if summary:
                    connection.execute(
                        "UPDATE selections SET criteria = ? WHERE user_id = ? AND selection_id = ?",
                        (summary, user_id, selection_id),
                    )
        return {
            "selection_id": selection_id,
            "version": version,
            "parent_version": current,
            "created_at": now,
        }

    def list_versions(self, user_id: str, selection_id: str) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT version, parent_version, criteria_json, criteria_bytes, params_json, change_note, created_at"
                " FROM selection_versions WHERE user_id = ? AND selection_id = ? ORDER BY version",
                (user_id, selection_id),
            ).fetchall()
        if not rows:
            self.get_selection(user_id, selection_id)  # 抛 KeyError：方案不存在
        result = []
        for row in rows:
            item = dict(row)
            item["criteria"] = json.loads(item.pop("criteria_json"))
            item["params"] = json.loads(item.pop("params_json"))
            result.append(item)
        return result

    def get_version(self, user_id: str, selection_id: str, version: int) -> dict[str, Any]:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM selection_versions WHERE user_id = ? AND selection_id = ? AND version = ?",
                (user_id, selection_id, version),
            ).fetchone()
        if row is None:
            raise KeyError(f"版本不存在：{selection_id} v{version}")
        item = dict(row)
        item["criteria"] = json.loads(item.pop("criteria_json"))
        item["params"] = json.loads(item.pop("params_json"))
        version_dir = self._selection_dir(user_id, selection_id) / "versions" / f"v{version:03d}"
        item["criteria_path"] = str(version_dir / "criteria.json")
        return item

    # ── 选股运行（报告归档） ──────────────────────────────────────────

    def record_run(
        self,
        user_id: str,
        selection_id: str,
        *,
        version: int,
        trade_date: str = "",
        universe: str = "",
        rules: dict[str, Any] | None = None,
        metrics: dict[str, Any] | None = None,
        report: str | None = None,
        picks: Any | None = None,
        thread_id: str | None = None,
    ) -> dict[str, Any]:
        selection = self.get_selection(user_id, selection_id)
        if int(version) < 1 or int(version) > int(selection["current_version"]):
            raise ValueError(f"版本越界：v{version}（当前最新 v{selection['current_version']}）")

        rules_text = json.dumps(rules or {}, ensure_ascii=False)
        metrics_text = json.dumps(metrics or {}, ensure_ascii=False)
        if len(rules_text.encode()) > _MAX_RULES_BYTES:
            raise ValueError("执行口径超过 16KB 上限")
        if len(metrics_text.encode()) > _MAX_METRICS_BYTES:
            raise ValueError("指标超过 64KB 上限")

        run_id = f"xrun_{secrets.token_hex(6)}"
        run_dir = self._selection_dir(user_id, selection_id) / "runs" / run_id
        run_dir.mkdir(parents=True, exist_ok=True)

        report_path: str | None = None
        picks_path: str | None = None
        if report is not None:
            if len(report.encode("utf-8")) > _MAX_REPORT_BYTES:
                raise ValueError("选股报告超过 2MB 上限")
            (run_dir / "report.md").write_text(report, encoding="utf-8")
            report_path = str((run_dir / "report.md").relative_to(self.selections_root))
        if picks is not None:
            picks_text = json.dumps(picks, ensure_ascii=False)
            if len(picks_text.encode()) > _MAX_PICKS_BYTES:
                raise ValueError("命中清单超过 4MB 上限")
            (run_dir / "picks.json").write_text(picks_text, encoding="utf-8")
            picks_path = str((run_dir / "picks.json").relative_to(self.selections_root))

        now = _now()
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO selection_runs (user_id, run_id, selection_id, version, trade_date, universe, rules_json, metrics_json, report_path, picks_path, thread_id, created_at)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (user_id, run_id, selection_id, int(version), trade_date, universe, rules_text, metrics_text, report_path, picks_path, thread_id, now),
            )
            connection.execute(
                "UPDATE selections SET updated_at = ? WHERE user_id = ? AND selection_id = ?",
                (now, user_id, selection_id),
            )
        return {"run_id": run_id, "selection_id": selection_id, "version": version, "created_at": now}

    def list_runs(self, user_id: str, selection_id: str, version: int | None = None) -> list[dict[str, Any]]:
        query = "SELECT * FROM selection_runs WHERE user_id = ? AND selection_id = ?"
        args: list[Any] = [user_id, selection_id]
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

    def _latest_run(self, connection: sqlite3.Connection | None, *, user_id: str, selection_id: str) -> dict[str, Any] | None:
        def _query(conn: sqlite3.Connection) -> sqlite3.Row | None:
            return conn.execute(
                "SELECT * FROM selection_runs WHERE user_id = ? AND selection_id = ? ORDER BY created_at DESC LIMIT 1",
                (user_id, selection_id),
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

    def get_run_report(self, user_id: str, selection_id: str, run_id: str) -> dict[str, Any]:
        """读取某次选股运行的报告全文。"""
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM selection_runs WHERE user_id = ? AND selection_id = ? AND run_id = ?",
                (user_id, selection_id, run_id),
            ).fetchone()
        if row is None:
            raise KeyError(f"选股运行不存在：{run_id}")
        if not row["report_path"]:
            raise ValueError("该运行未存报告（record_run 时未提供 report）")
        report_file = self.selections_root / row["report_path"]
        return {
            "run_id": run_id,
            "version": row["version"],
            "trade_date": row["trade_date"],
            "universe": row["universe"],
            "report": report_file.read_text(encoding="utf-8"),
        }

    def get_run_picks(self, user_id: str, selection_id: str, run_id: str) -> dict[str, Any]:
        """读取某次选股运行的命中清单（对比视图重合分析用）。"""
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM selection_runs WHERE user_id = ? AND selection_id = ? AND run_id = ?",
                (user_id, selection_id, run_id),
            ).fetchone()
        if row is None:
            raise KeyError(f"选股运行不存在：{run_id}")
        if not row["picks_path"]:
            raise ValueError("该运行未存命中清单（record_run 时未提供 picks）")
        picks_file = self.selections_root / row["picks_path"]
        return {
            "run_id": run_id,
            "version": row["version"],
            "trade_date": row["trade_date"],
            "picks": json.loads(picks_file.read_text(encoding="utf-8")),
        }

    def compare_runs(self, user_id: str, selection_id: str, run_ids: list[str]) -> dict[str, Any]:
        """按 run_id 集合对比：对齐指标并标注口径（股票池/执行规则）是否一致。

        跨基准日（trade_date 不同）是选股跟踪的预期语义，不影响 comparable。
        """
        rows: list[dict[str, Any]] = []
        with self._connect() as connection:
            for run_id in run_ids:
                row = connection.execute(
                    "SELECT * FROM selection_runs WHERE user_id = ? AND selection_id = ? AND run_id = ?",
                    (user_id, selection_id, run_id),
                ).fetchone()
                if row is None:
                    raise KeyError(f"选股运行不存在：{run_id}")
                item = dict(row)
                item["rules"] = json.loads(item.pop("rules_json"))
                item["metrics"] = json.loads(item.pop("metrics_json"))
                rows.append(item)
        universes = {r["universe"] for r in rows}
        rules_set = {json.dumps(r["rules"], sort_keys=True) for r in rows}
        comparable = len(universes) == 1 and len(rules_set) == 1
        return {
            "selection_id": selection_id,
            "runs": rows,
            "comparable": comparable,
            "notes": [] if comparable else [
                "所选运行的股票池或执行口径不一致，对比仅供粗略参考；"
                "严格对比应使用相同股票池与相同执行口径的运行"
                "（基准日不同属于同一方案的正常时间序列跟踪）。",
            ],
        }


# ── API 请求/响应模型 ────────────────────────────────────────────────


class SelectionCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    criteria: str = Field(default="", max_length=8000)
    params: dict[str, Any] = Field(default_factory=dict)


class SelectionUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    criteria: str | None = Field(default=None, max_length=8000)
    status: str | None = None


class SelectionVersionRequest(BaseModel):
    criteria_json: dict[str, Any] = Field(default_factory=dict)
    params: dict[str, Any] = Field(default_factory=dict)
    change_note: str = Field(default="", max_length=8000)
    parent_version: int | None = None


class SelectionRunRequest(BaseModel):
    version: int = Field(ge=1)
    trade_date: str = Field(default="", max_length=16)
    universe: str = Field(default="", max_length=120)
    rules: dict[str, Any] = Field(default_factory=dict)
    metrics: dict[str, Any] = Field(default_factory=dict)
    report: str | None = None
    picks: Any | None = None
    thread_id: str | None = Field(default=None, max_length=128)


def _store(request) -> SelectionStore:
    store = getattr(request.app.state, "kstock_selection_store", None)
    if store is None:
        raise HTTPException(status_code=503, detail="选股库未初始化")
    return store


def _user() -> str:
    return str(get_effective_user_id())


@router.get("/selections")
def list_selections(request: Request):
    return _store(request).list_selections(_user())


@router.post("/selections", status_code=201)
def create_selection(request: Request, body: SelectionCreateRequest):
    try:
        return _store(request).create_selection(_user(), body.name, body.criteria, body.params)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/selections/{selection_id}")
def get_selection(request: Request, selection_id: str):
    try:
        return _store(request).get_selection(_user(), selection_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/selections/{selection_id}")
def update_selection(request: Request, selection_id: str, body: SelectionUpdateRequest):
    try:
        return _store(request).update_selection(
            _user(), selection_id, name=body.name, criteria=body.criteria, status=body.status
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/selections/{selection_id}/versions")
def list_versions(request: Request, selection_id: str):
    try:
        return _store(request).list_versions(_user(), selection_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/selections/{selection_id}/versions", status_code=201)
def save_version(request: Request, selection_id: str, body: SelectionVersionRequest):
    try:
        return _store(request).save_version(
            _user(), selection_id,
            criteria_json=body.criteria_json, params=body.params,
            change_note=body.change_note, parent_version=body.parent_version,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/selections/{selection_id}/versions/{version}")
def get_version(request: Request, selection_id: str, version: int):
    try:
        return _store(request).get_version(_user(), selection_id, version)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/selections/{selection_id}/runs", status_code=201)
def record_run(request: Request, selection_id: str, body: SelectionRunRequest):
    try:
        return _store(request).record_run(
            _user(), selection_id,
            version=body.version, trade_date=body.trade_date, universe=body.universe,
            rules=body.rules, metrics=body.metrics,
            report=body.report, picks=body.picks, thread_id=body.thread_id,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/selections/{selection_id}/runs")
def list_runs(request: Request, selection_id: str, version: int | None = None):
    return _store(request).list_runs(_user(), selection_id, version)


@router.get("/selections/{selection_id}/runs/{run_id}/report")
def get_run_report(request: Request, selection_id: str, run_id: str):
    try:
        return _store(request).get_run_report(_user(), selection_id, run_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/selections/{selection_id}/runs/{run_id}/picks")
def get_run_picks(request: Request, selection_id: str, run_id: str):
    try:
        return _store(request).get_run_picks(_user(), selection_id, run_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/selections/{selection_id}/compare")
def compare_runs(request: Request, selection_id: str, runs: str):
    run_ids = [item.strip() for item in runs.split(",") if item.strip()]
    if len(run_ids) < 2:
        raise HTTPException(status_code=422, detail="对比至少需要 2 个 run_id（逗号分隔）")
    try:
        return _store(request).compare_runs(_user(), selection_id, run_ids)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
