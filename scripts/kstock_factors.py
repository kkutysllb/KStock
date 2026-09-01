"""因子研究工作区：因子身份 / 版本链 / 检验运行的持久化与索引。

与「策略工作区」（scripts/kstock_strategies.py）同构的活资产管理，
域模型换成因子研究语义（见 lead_soul「因子研究场景」）：
- 因子是**活资产**（持续迭代的计算代码+参数），因子逻辑假设写在
  hypothesis 字段，类别 category 对齐 factor-research 六因子 + custom；
- 版本**不可变**：每次修改生成新版本快照（因子计算代码整文件 + 参数 JSON +
  变更说明），版本号单调递增；保存时校验 parent_version 防并发覆盖；
- 检验运行锁定可复现四元组：因子版本 × 股票池 × 数据区间 × 检验配置
  （分层数 / 调仓周期 / 中性化 / 缩尾等，对齐 factor-research cli.py analyze
  的输入口径），不同口径的 IC/IR 跨版本对比没有意义；
- 存储：索引进 product/kstock.db（产品索引层，与策略库同库不同表），
  文件落 product/factors/{factor_id}/；沙箱内经 /mnt/factors 只读
  挂载供 agent 阅读当前版本（读写必须走因子库工具保证版本纪律）。
"""

from __future__ import annotations

import hashlib
import json
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from qilin.runtime.user_context import get_effective_user_id

router = APIRouter(prefix="/api/v1/kstock", tags=["kstock-factors"])

# 容量上限：防止 agent 把超大 payload 灌进 sqlite / 磁盘（与策略库同量级）。
_MAX_CODE_BYTES = 512 * 1024
_MAX_PARAMS_BYTES = 64 * 1024
_MAX_METRICS_BYTES = 64 * 1024
_MAX_CONFIG_BYTES = 16 * 1024
_MAX_IC_SERIES_BYTES = 2 * 1024 * 1024
_MAX_LAYERS_BYTES = 4 * 1024 * 1024

# 因子生命周期：researching 研究中 / adopted 已采用（纳入组合）/
# paused 暂停观察 / rejected 已证伪否定。
_FACTOR_STATUSES = ("researching", "adopted", "paused", "rejected")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class FactorStore:
    """因子 / 版本 / 检验运行的 SQLite 索引 + 文件存储。"""

    def __init__(self, data_root: Path, db_path: Path | None = None):
        self.data_root = Path(data_root).expanduser().resolve()
        self.factors_root = self.data_root / "product" / "factors"
        self.db_path = Path(
            db_path or (self.data_root / "product" / "kstock.db")
        )
        self.factors_root.mkdir(parents=True, exist_ok=True)
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
                CREATE TABLE IF NOT EXISTS factors (
                    user_id TEXT NOT NULL,
                    factor_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    hypothesis TEXT NOT NULL DEFAULT '',
                    category TEXT NOT NULL DEFAULT 'custom',
                    status TEXT NOT NULL DEFAULT 'researching',
                    current_version INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (user_id, factor_id)
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS factor_versions (
                    user_id TEXT NOT NULL,
                    factor_id TEXT NOT NULL,
                    version INTEGER NOT NULL,
                    parent_version INTEGER,
                    code_sha256 TEXT NOT NULL,
                    code_bytes INTEGER NOT NULL,
                    params_json TEXT NOT NULL,
                    change_note TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (user_id, factor_id, version)
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS factor_runs (
                    user_id TEXT NOT NULL,
                    run_id TEXT NOT NULL,
                    factor_id TEXT NOT NULL,
                    version INTEGER NOT NULL,
                    universe TEXT NOT NULL DEFAULT '',
                    data_start TEXT NOT NULL DEFAULT '',
                    data_end TEXT NOT NULL DEFAULT '',
                    config_json TEXT NOT NULL,
                    metrics_json TEXT NOT NULL,
                    ic_series_path TEXT,
                    layers_path TEXT,
                    thread_id TEXT,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (user_id, run_id)
                )
                """
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_factor_versions ON factor_versions (user_id, factor_id, version)"
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_factor_runs ON factor_runs (user_id, factor_id, version, created_at)"
            )

    def _factor_dir(self, user_id: str, factor_id: str) -> Path:
        return self.factors_root / user_id / factor_id

    # ── 因子身份 ──────────────────────────────────────────────────────

    def create_factor(
        self,
        user_id: str,
        name: str,
        hypothesis: str = "",
        category: str = "custom",
    ) -> dict[str, Any]:
        if not name.strip():
            raise ValueError("因子名称不能为空")
        factor_id = f"fac_{secrets.token_hex(6)}"
        now = _now()
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO factors (user_id, factor_id, name, hypothesis, category, status, current_version, created_at, updated_at)"
                " VALUES (?, ?, ?, ?, ?, 'researching', 0, ?, ?)",
                (user_id, factor_id, name.strip(), hypothesis.strip(), (category.strip() or "custom"), now, now),
            )
        return self.get_factor(user_id, factor_id)

    def get_factor(self, user_id: str, factor_id: str) -> dict[str, Any]:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM factors WHERE user_id = ? AND factor_id = ?",
                (user_id, factor_id),
            ).fetchone()
        if row is None:
            raise KeyError(f"因子不存在：{factor_id}")
        return dict(row)

    def list_factors(self, user_id: str) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM factors WHERE user_id = ? ORDER BY updated_at DESC",
                (user_id,),
            ).fetchall()
        result = []
        for row in rows:
            item = dict(row)
            latest = self._latest_run(connection=None, user_id=user_id, factor_id=row["factor_id"])
            item["latest_run"] = latest
            result.append(item)
        return result

    def update_factor(
        self,
        user_id: str,
        factor_id: str,
        *,
        name: str | None = None,
        hypothesis: str | None = None,
        category: str | None = None,
        status: str | None = None,
    ) -> dict[str, Any]:
        current = self.get_factor(user_id, factor_id)
        if status is not None and status not in _FACTOR_STATUSES:
            raise ValueError("状态仅支持 researching / adopted / paused / rejected")
        updates: dict[str, Any] = {"updated_at": _now()}
        if name is not None:
            if not name.strip():
                raise ValueError("因子名称不能为空")
            updates["name"] = name.strip()
        if hypothesis is not None:
            updates["hypothesis"] = hypothesis.strip()
        if category is not None:
            updates["category"] = category.strip() or "custom"
        if status is not None:
            updates["status"] = status
        sets = ", ".join(f"{key} = ?" for key in updates)
        with self._connect() as connection:
            connection.execute(
                f"UPDATE factors SET {sets} WHERE user_id = ? AND factor_id = ?",
                (*updates.values(), user_id, factor_id),
            )
        _ = current
        return self.get_factor(user_id, factor_id)

    # ── 版本链 ────────────────────────────────────────────────────────

    def save_version(
        self,
        user_id: str,
        factor_id: str,
        *,
        code: str,
        params: dict[str, Any],
        change_note: str = "",
        parent_version: int | None = None,
    ) -> dict[str, Any]:
        """保存新版本快照；parent_version 必须等于当前版本（乐观并发控制）。"""
        factor = self.get_factor(user_id, factor_id)
        current = int(factor["current_version"])
        if parent_version is None:
            parent_version = current
        if int(parent_version) != current:
            raise ValueError(
                f"版本冲突：因子当前版本为 v{current}，提交基于 v{parent_version}。"
                "请先重新读取最新版本再提交修改。"
            )

        code_bytes = code.encode("utf-8")
        if len(code_bytes) > _MAX_CODE_BYTES:
            raise ValueError(f"因子代码超过 {_MAX_CODE_BYTES // 1024}KB 上限")
        params_text = json.dumps(params, ensure_ascii=False)
        if len(params_text.encode("utf-8")) > _MAX_PARAMS_BYTES:
            raise ValueError(f"参数 JSON 超过 {_MAX_PARAMS_BYTES // 1024}KB 上限")

        version = current + 1
        sha256 = hashlib.sha256(code_bytes).hexdigest()
        version_dir = self._factor_dir(user_id, factor_id) / "versions" / f"v{version:03d}"
        version_dir.mkdir(parents=True, exist_ok=True)
        (version_dir / "factor.py").write_bytes(code_bytes)
        (version_dir / "params.json").write_text(params_text, encoding="utf-8")
        (version_dir / "CHANGE.md").write_text(change_note.strip() or "(无变更说明)", encoding="utf-8")

        now = _now()
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO factor_versions (user_id, factor_id, version, parent_version, code_sha256, code_bytes, params_json, change_note, created_at)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (user_id, factor_id, version, current, sha256, len(code_bytes), params_text, change_note.strip(), now),
            )
            connection.execute(
                "UPDATE factors SET current_version = ?, updated_at = ? WHERE user_id = ? AND factor_id = ?",
                (version, now, user_id, factor_id),
            )
        return {
            "factor_id": factor_id,
            "version": version,
            "parent_version": current,
            "code_sha256": sha256,
            "created_at": now,
        }

    def list_versions(self, user_id: str, factor_id: str) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT version, parent_version, code_sha256, code_bytes, params_json, change_note, created_at"
                " FROM factor_versions WHERE user_id = ? AND factor_id = ? ORDER BY version",
                (user_id, factor_id),
            ).fetchall()
        if not rows:
            self.get_factor(user_id, factor_id)  # 抛 KeyError：因子不存在
        result = []
        for row in rows:
            item = dict(row)
            item["params"] = json.loads(item.pop("params_json"))
            result.append(item)
        return result

    def get_version(self, user_id: str, factor_id: str, version: int) -> dict[str, Any]:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM factor_versions WHERE user_id = ? AND factor_id = ? AND version = ?",
                (user_id, factor_id, version),
            ).fetchone()
        if row is None:
            raise KeyError(f"版本不存在：{factor_id} v{version}")
        item = dict(row)
        item["params"] = json.loads(item.pop("params_json"))
        code_path = self._factor_dir(user_id, factor_id) / "versions" / f"v{version:03d}" / "factor.py"
        item["code"] = code_path.read_text(encoding="utf-8")
        item["code_path"] = str(code_path)
        return item

    # ── 检验运行 ──────────────────────────────────────────────────────

    def record_run(
        self,
        user_id: str,
        factor_id: str,
        *,
        version: int,
        universe: str = "",
        data_start: str = "",
        data_end: str = "",
        config: dict[str, Any] | None = None,
        metrics: dict[str, Any] | None = None,
        ic_series: Any | None = None,
        layers: Any | None = None,
        thread_id: str | None = None,
    ) -> dict[str, Any]:
        factor = self.get_factor(user_id, factor_id)
        if int(version) < 1 or int(version) > int(factor["current_version"]):
            raise ValueError(f"版本越界：v{version}（当前最新 v{factor['current_version']}）")

        config_text = json.dumps(config or {}, ensure_ascii=False)
        metrics_text = json.dumps(metrics or {}, ensure_ascii=False)
        if len(config_text.encode()) > _MAX_CONFIG_BYTES:
            raise ValueError("检验配置超过 16KB 上限")
        if len(metrics_text.encode()) > _MAX_METRICS_BYTES:
            raise ValueError("指标超过 64KB 上限")

        run_id = f"frun_{secrets.token_hex(6)}"
        run_dir = self._factor_dir(user_id, factor_id) / "runs" / run_id
        run_dir.mkdir(parents=True, exist_ok=True)

        ic_series_path: str | None = None
        layers_path: str | None = None
        if ic_series is not None:
            ic_text = json.dumps(ic_series, ensure_ascii=False)
            if len(ic_text.encode()) > _MAX_IC_SERIES_BYTES:
                raise ValueError("IC 序列超过 2MB 上限（可降采样后提交）")
            (run_dir / "ic_series.json").write_text(ic_text, encoding="utf-8")
            ic_series_path = str((run_dir / "ic_series.json").relative_to(self.factors_root))
        if layers is not None:
            layers_text = json.dumps(layers, ensure_ascii=False)
            if len(layers_text.encode()) > _MAX_LAYERS_BYTES:
                raise ValueError("分层收益表超过 4MB 上限")
            (run_dir / "layers.json").write_text(layers_text, encoding="utf-8")
            layers_path = str((run_dir / "layers.json").relative_to(self.factors_root))

        now = _now()
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO factor_runs (user_id, run_id, factor_id, version, universe, data_start, data_end, config_json, metrics_json, ic_series_path, layers_path, thread_id, created_at)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (user_id, run_id, factor_id, int(version), universe, data_start, data_end, config_text, metrics_text, ic_series_path, layers_path, thread_id, now),
            )
            connection.execute(
                "UPDATE factors SET updated_at = ? WHERE user_id = ? AND factor_id = ?",
                (now, user_id, factor_id),
            )
        return {"run_id": run_id, "factor_id": factor_id, "version": version, "created_at": now}

    def list_runs(self, user_id: str, factor_id: str, version: int | None = None) -> list[dict[str, Any]]:
        query = "SELECT * FROM factor_runs WHERE user_id = ? AND factor_id = ?"
        args: list[Any] = [user_id, factor_id]
        if version is not None:
            query += " AND version = ?"
            args.append(version)
        query += " ORDER BY created_at DESC"
        with self._connect() as connection:
            rows = connection.execute(query, args).fetchall()
        result = []
        for row in rows:
            item = dict(row)
            item["config"] = json.loads(item.pop("config_json"))
            item["metrics"] = json.loads(item.pop("metrics_json"))
            result.append(item)
        return result

    def _latest_run(self, connection: sqlite3.Connection | None, *, user_id: str, factor_id: str) -> dict[str, Any] | None:
        def _query(conn: sqlite3.Connection) -> sqlite3.Row | None:
            return conn.execute(
                "SELECT * FROM factor_runs WHERE user_id = ? AND factor_id = ? ORDER BY created_at DESC LIMIT 1",
                (user_id, factor_id),
            ).fetchone()

        row = _query(connection) if connection is not None else None
        if row is None and connection is None:
            with self._connect() as conn:
                row = _query(conn)
        if row is None:
            return None
        item = dict(row)
        item["config"] = json.loads(item.pop("config_json"))
        item["metrics"] = json.loads(item.pop("metrics_json"))
        return item

    def get_run_ic_series(self, user_id: str, factor_id: str, run_id: str) -> dict[str, Any]:
        """读取某次检验运行的 IC 序列（对比视图叠加累计 IC 用）。"""
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM factor_runs WHERE user_id = ? AND factor_id = ? AND run_id = ?",
                (user_id, factor_id, run_id),
            ).fetchone()
        if row is None:
            raise KeyError(f"检验运行不存在：{run_id}")
        if not row["ic_series_path"]:
            raise ValueError("该运行未存 IC 序列（record_run 时未提供 ic_series）")
        ic_file = self.factors_root / row["ic_series_path"]
        return {
            "run_id": run_id,
            "version": row["version"],
            "universe": row["universe"],
            "data_start": row["data_start"],
            "data_end": row["data_end"],
            "ic_series": json.loads(ic_file.read_text(encoding="utf-8")),
        }

    def compare_runs(self, user_id: str, factor_id: str, run_ids: list[str]) -> dict[str, Any]:
        """按 run_id 集合对比：对齐指标并标注口径（股票池/区间/检验配置）是否一致。"""
        rows: list[dict[str, Any]] = []
        with self._connect() as connection:
            for run_id in run_ids:
                row = connection.execute(
                    "SELECT * FROM factor_runs WHERE user_id = ? AND factor_id = ? AND run_id = ?",
                    (user_id, factor_id, run_id),
                ).fetchone()
                if row is None:
                    raise KeyError(f"检验运行不存在：{run_id}")
                item = dict(row)
                item["config"] = json.loads(item.pop("config_json"))
                item["metrics"] = json.loads(item.pop("metrics_json"))
                rows.append(item)
        ranges = {(r["universe"], r["data_start"], r["data_end"]) for r in rows}
        config_set = {json.dumps(r["config"], sort_keys=True) for r in rows}
        comparable = len(ranges) == 1 and len(config_set) == 1
        return {
            "factor_id": factor_id,
            "runs": rows,
            "comparable": comparable,
            "notes": [] if comparable else [
                "所选运行的股票池、数据区间或检验配置不一致，对比仅供粗略参考；"
                "严格对比应使用相同股票池、相同区间与相同检验配置的运行。",
            ],
        }


# ── API 请求/响应模型 ────────────────────────────────────────────────


class FactorCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    hypothesis: str = Field(default="", max_length=8000)
    category: str = Field(default="custom", max_length=40)


class FactorUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    hypothesis: str | None = Field(default=None, max_length=8000)
    category: str | None = Field(default=None, max_length=40)
    status: str | None = None


class FactorVersionRequest(BaseModel):
    code: str = Field(min_length=1)
    params: dict[str, Any] = Field(default_factory=dict)
    change_note: str = Field(default="", max_length=8000)
    parent_version: int | None = None


class FactorRunRequest(BaseModel):
    version: int = Field(ge=1)
    universe: str = Field(default="", max_length=120)
    data_start: str = Field(default="", max_length=16)
    data_end: str = Field(default="", max_length=16)
    config: dict[str, Any] = Field(default_factory=dict)
    metrics: dict[str, Any] = Field(default_factory=dict)
    ic_series: Any | None = None
    layers: Any | None = None
    thread_id: str | None = Field(default=None, max_length=128)


def _store(request) -> FactorStore:
    store = getattr(request.app.state, "kstock_factor_store", None)
    if store is None:
        raise HTTPException(status_code=503, detail="因子库未初始化")
    return store


def _user() -> str:
    return str(get_effective_user_id())


@router.get("/factors")
def list_factors(request: Request):
    return _store(request).list_factors(_user())


@router.post("/factors", status_code=201)
def create_factor(request: Request, body: FactorCreateRequest):
    try:
        return _store(request).create_factor(_user(), body.name, body.hypothesis, body.category)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/factors/{factor_id}")
def get_factor(request: Request, factor_id: str):
    try:
        return _store(request).get_factor(_user(), factor_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/factors/{factor_id}")
def update_factor(request: Request, factor_id: str, body: FactorUpdateRequest):
    try:
        return _store(request).update_factor(
            _user(), factor_id,
            name=body.name, hypothesis=body.hypothesis, category=body.category, status=body.status,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/factors/{factor_id}/versions")
def list_versions(request: Request, factor_id: str):
    try:
        return _store(request).list_versions(_user(), factor_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/factors/{factor_id}/versions", status_code=201)
def save_version(request: Request, factor_id: str, body: FactorVersionRequest):
    try:
        return _store(request).save_version(
            _user(), factor_id,
            code=body.code, params=body.params,
            change_note=body.change_note, parent_version=body.parent_version,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/factors/{factor_id}/versions/{version}")
def get_version(request: Request, factor_id: str, version: int):
    try:
        return _store(request).get_version(_user(), factor_id, version)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/factors/{factor_id}/runs", status_code=201)
def record_run(request: Request, factor_id: str, body: FactorRunRequest):
    try:
        return _store(request).record_run(
            _user(), factor_id,
            version=body.version, universe=body.universe,
            data_start=body.data_start, data_end=body.data_end,
            config=body.config, metrics=body.metrics,
            ic_series=body.ic_series, layers=body.layers, thread_id=body.thread_id,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/factors/{factor_id}/runs")
def list_runs(request: Request, factor_id: str, version: int | None = None):
    return _store(request).list_runs(_user(), factor_id, version)


@router.get("/factors/{factor_id}/runs/{run_id}/ic_series")
def get_run_ic_series(request: Request, factor_id: str, run_id: str):
    try:
        return _store(request).get_run_ic_series(_user(), factor_id, run_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/factors/{factor_id}/compare")
def compare_runs(request: Request, factor_id: str, runs: str):
    run_ids = [item.strip() for item in runs.split(",") if item.strip()]
    if len(run_ids) < 2:
        raise HTTPException(status_code=422, detail="对比至少需要 2 个 run_id（逗号分隔）")
    try:
        return _store(request).compare_runs(_user(), factor_id, run_ids)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
