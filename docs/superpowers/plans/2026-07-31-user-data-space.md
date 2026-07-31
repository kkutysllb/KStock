# 用户数据空间组织实施计划

> **给执行者：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务执行。步骤使用复选框 `- [x]` 跟踪。

**目标：** 把 KStock 的正式用户数据从仓库内 `.kstock` 迁移到跨平台应用数据目录，并让 QiLin 的 `QILIN_HOME`、SQLite、用户、线程、上传和产物空间全部走这个目录。

**架构：** Tauri/Rust 负责解析系统 app data 目录并提供给前端或 sidecar；Python sidecar 负责创建数据空间、生成 QiLin 运行时配置、设置用户上下文、维护 KStock 产品索引，并继续复用 QiLin 的原生用户/线程/sandbox 目录。KStock 不重做 QiLin 的运行数据库，只额外维护项目、报告、标签和 UI 状态索引。

**技术栈：** Python 3.12、Pydantic、SQLite 标准库、PyYAML（来自 QiLin 依赖路径）、QiLin embedded client、Tauri 2、Rust、React/TypeScript、pytest、Vitest、Playwright、pnpm、cargo。

**执行状态：** 已完成。正式默认数据目录采用系统 app data；仓库内 `.kstock` 仅作为开发 fallback 或用户显式覆盖。任务 9 中原计划“更新 capability”经本地 schema 校验后调整为不新增不存在的 `core:path:allow-app-data-dir` 权限，改用已注册的 Rust 命令 `sidecar::app_data_dir` 暴露路径，`cargo check` 已验证通过。

---

## 文件边界

- `sidecar/src/kstock_sidecar/data_space.py`：新增。负责跨平台数据目录解析、目录创建、默认用户、运行时配置生成和开发目录迁移。
- `sidecar/src/kstock_sidecar/product_store.py`：新增。负责 `product/kstock.db` 的 KStock 产品索引表。
- `sidecar/src/kstock_sidecar/user_context.py`：新增。负责把 KStock `user_id` 转成 QiLin `CurrentUser` ContextVar。
- `sidecar/src/kstock_sidecar/config.py`：修改。新增 app data、运行时配置、产品库路径字段，保留开发模式 fallback。
- `sidecar/src/kstock_sidecar/qilin_adapter.py`：修改。启动前初始化数据空间，环境变量指向正式目录，健康检查返回真实路径。
- `sidecar/src/kstock_sidecar/server.py`：修改。扩展 JSON 行协议方法：`workspace.init`、`workspace.info`、`thread.create`、`artifact.list`。
- `sidecar/tests/test_data_space.py`：新增。覆盖数据目录、配置生成、迁移保护。
- `sidecar/tests/test_product_store.py`：新增。覆盖项目、线程关联、报告索引。
- `sidecar/tests/test_server_workspace.py`：新增。覆盖新协议分发。
- `sidecar/tests/test_qilin_adapter.py`：修改。更新健康检查断言。
- `apps/desktop/src-tauri/src/sidecar.rs`：修改。新增 `app_data_dir` 命令。
- `apps/desktop/src-tauri/src/main.rs`：修改。注册 `app_data_dir` 命令。
- `apps/desktop/src-tauri/capabilities/default.json`：修改。允许路径能力和新命令调用所需权限。
- `apps/desktop/src/lib/sidecarTypes.ts`：修改。新增 workspace/thread/artifact 类型。
- `apps/desktop/src/lib/sidecarClient.ts`：修改。新增请求构造函数。
- `apps/desktop/tests/App.spec.tsx`：修改。覆盖数据空间状态显示。
- `docs/配置说明.md`、`docs/运行说明.md`：修改。说明正式数据目录和开发 fallback。

## 任务 1：实现 sidecar 数据空间核心

**文件：**
- 创建：`sidecar/src/kstock_sidecar/data_space.py`
- 测试：`sidecar/tests/test_data_space.py`

- [x] **步骤 1：写失败测试**

写入 `sidecar/tests/test_data_space.py`：

```python
from pathlib import Path

from kstock_sidecar.data_space import KStockDataSpace


def test_data_space_creates_expected_directories(tmp_path: Path):
    data_space = KStockDataSpace(app_data_dir=tmp_path)

    info = data_space.ensure()

    assert info.app_data_dir == tmp_path
    assert info.qilin_home == tmp_path / "runtime/qilin"
    assert info.qilin_data_dir == tmp_path / "runtime/qilin/data"
    assert info.product_db_path == tmp_path / "product/kstock.db"
    assert info.runtime_config_path == tmp_path / "config/qilin.runtime.yaml"
    assert (tmp_path / "config").is_dir()
    assert (tmp_path / "runtime/qilin/users" / info.active_user_id).is_dir()
    assert (tmp_path / "product").is_dir()
    assert (tmp_path / "cache").is_dir()
    assert (tmp_path / "logs").is_dir()
    assert (tmp_path / "backups").is_dir()


def test_data_space_writes_stable_local_user(tmp_path: Path):
    data_space = KStockDataSpace(app_data_dir=tmp_path)

    first = data_space.ensure()
    second = data_space.ensure()

    assert first.active_user_id == second.active_user_id
    assert first.active_user_id.startswith("local-")
    assert (tmp_path / "config/kstock.settings.json").is_file()
```

- [x] **步骤 2：运行测试确认失败**

运行：

```bash
python -m pytest sidecar/tests/test_data_space.py -q
```

预期：失败，提示 `No module named 'kstock_sidecar.data_space'`。

- [x] **步骤 3：实现最小数据空间**

创建 `sidecar/src/kstock_sidecar/data_space.py`：

```python
from __future__ import annotations

import hashlib
import json
import platform
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class DataSpaceInfo:
    app_data_dir: Path
    active_user_id: str
    qilin_home: Path
    qilin_data_dir: Path
    runtime_config_path: Path
    product_db_path: Path
    skill_root: Path
    is_development_fallback: bool


class KStockDataSpace:
    def __init__(
        self,
        app_data_dir: Path,
        *,
        skill_root: Path | None = None,
        repo_root: Path | None = None,
        development_fallback: bool = False,
    ) -> None:
        self.app_data_dir = app_data_dir.resolve()
        self.skill_root = (skill_root or Path("vendor/skills")).resolve()
        self.repo_root = (repo_root or Path.cwd()).resolve()
        self.development_fallback = development_fallback

    def ensure(self) -> DataSpaceInfo:
        config_dir = self.app_data_dir / "config"
        qilin_home = self.app_data_dir / "runtime/qilin"
        qilin_data_dir = qilin_home / "data"
        product_dir = self.app_data_dir / "product"

        for directory in [
            config_dir,
            qilin_data_dir,
            qilin_home / "users",
            product_dir,
            product_dir / "exports",
            product_dir / "report-index",
            self.app_data_dir / "cache/market-data",
            self.app_data_dir / "cache/skill-scan",
            self.app_data_dir / "cache/thumbnails",
            self.app_data_dir / "logs",
            self.app_data_dir / "backups",
        ]:
            directory.mkdir(parents=True, exist_ok=True)

        active_user_id = self._load_or_create_user_id(config_dir / "kstock.settings.json")
        (qilin_home / "users" / active_user_id).mkdir(parents=True, exist_ok=True)

        info = DataSpaceInfo(
            app_data_dir=self.app_data_dir,
            active_user_id=active_user_id,
            qilin_home=qilin_home,
            qilin_data_dir=qilin_data_dir,
            runtime_config_path=config_dir / "qilin.runtime.yaml",
            product_db_path=product_dir / "kstock.db",
            skill_root=self.skill_root,
            is_development_fallback=self.development_fallback,
        )
        self.write_runtime_config(info)
        return info

    def _load_or_create_user_id(self, settings_path: Path) -> str:
        if settings_path.is_file():
            data = json.loads(settings_path.read_text(encoding="utf-8"))
            active_user_id = str(data.get("activeUserId", "")).strip()
            if active_user_id:
                return active_user_id

        seed = f"{platform.node()}:{self.app_data_dir}".encode("utf-8")
        digest = hashlib.sha256(seed).hexdigest()[:12]
        active_user_id = f"local-{digest}"
        settings_path.write_text(
            json.dumps({"activeUserId": active_user_id, "schemaVersion": 1}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return active_user_id

    def write_runtime_config(self, info: DataSpaceInfo) -> None:
        content = f"""# KStock 生成的 QiLin 运行时配置。不要手动写入 vendor 或上游仓库。
config_version: 31
log_level: info

token_usage:
  enabled: true

token_budget:
  enabled: false
  max_tokens: 200000
  max_input_tokens: null
  max_output_tokens: null
  warn_threshold: 0.8
  hard_stop_threshold: 1.0

max_recursion_limit: 1000

models: []

database:
  backend: sqlite
  sqlite_dir: "{info.qilin_data_dir.as_posix()}"

run_events:
  backend: db

skills:
  root: "{info.skill_root.as_posix()}"

sandbox:
  use: qilin.sandbox.local:LocalSandboxProvider
  allow_host_bash: false

memory:
  enabled: false
"""
        info.runtime_config_path.write_text(content, encoding="utf-8")

    def as_dict(self, info: DataSpaceInfo) -> dict[str, object]:
        return {
            "appDataDir": str(info.app_data_dir),
            "activeUserId": info.active_user_id,
            "qilinHome": str(info.qilin_home),
            "qilinDataDir": str(info.qilin_data_dir),
            "runtimeConfigPath": str(info.runtime_config_path),
            "productDbPath": str(info.product_db_path),
            "skillRoot": str(info.skill_root),
            "developmentFallback": info.is_development_fallback,
        }
```

- [x] **步骤 4：运行测试确认通过**

运行：

```bash
python -m pytest sidecar/tests/test_data_space.py -q
```

预期：2 个测试通过。

- [x] **步骤 5：提交**

```bash
git add sidecar/src/kstock_sidecar/data_space.py sidecar/tests/test_data_space.py
git commit -m "feat: 添加 KStock 用户数据空间"
```

## 任务 2：扩展 SidecarConfig 并接入运行时配置

**文件：**
- 修改：`sidecar/src/kstock_sidecar/config.py`
- 修改：`sidecar/src/kstock_sidecar/qilin_adapter.py`
- 修改：`sidecar/tests/test_qilin_adapter.py`

- [x] **步骤 1：写失败测试**

在 `sidecar/tests/test_qilin_adapter.py` 增加：

```python
from pathlib import Path

from kstock_sidecar.config import SidecarConfig
from kstock_sidecar.qilin_adapter import QiLinAdapter


def test_health_uses_runtime_data_space(tmp_path: Path):
    config = SidecarConfig(app_data_dir=tmp_path)
    adapter = QiLinAdapter(client_factory=lambda: object(), config=config)

    result = adapter.health()

    assert result["status"] == "ok"
    assert result["dataSpace"]["appDataDir"] == str(tmp_path.resolve())
    assert result["dataSpace"]["qilinHome"].endswith("runtime/qilin")
    assert result["dataSpace"]["runtimeConfigPath"].endswith("config/qilin.runtime.yaml")
    assert Path(result["dataSpace"]["runtimeConfigPath"]).is_file()
```

- [x] **步骤 2：运行测试确认失败**

运行：

```bash
python -m pytest sidecar/tests/test_qilin_adapter.py::test_health_uses_runtime_data_space -q
```

预期：失败，提示 `SidecarConfig` 不支持 `app_data_dir` 或健康结果没有 `dataSpace`。

- [x] **步骤 3：修改配置模型**

把 `sidecar/src/kstock_sidecar/config.py` 改成：

```python
from __future__ import annotations

import os
from pathlib import Path

from pydantic import BaseModel, Field

REPO_ROOT = Path(__file__).resolve().parents[3]


def default_app_data_dir() -> Path:
    env_dir = os.getenv("KSTOCK_APP_DATA_DIR")
    if env_dir:
        return Path(env_dir)
    return REPO_ROOT / ".kstock"


class SidecarConfig(BaseModel):
    app_name: str = "KStock"
    app_data_dir: Path = Field(default_factory=default_app_data_dir)
    skill_root: Path = Field(default_factory=lambda: REPO_ROOT / "vendor/skills")
    qilin_repo_path: Path = Field(default_factory=lambda: REPO_ROOT / "vendor/qilin")
    repo_root: Path = Field(default=REPO_ROOT)
    log_level: str = "info"

    @property
    def development_fallback(self) -> bool:
        return self.app_data_dir.resolve() == (REPO_ROOT / ".kstock").resolve()
```

- [x] **步骤 4：修改 QiLinAdapter 环境初始化**

在 `sidecar/src/kstock_sidecar/qilin_adapter.py` 中使用 `KStockDataSpace`：

```python
from .data_space import DataSpaceInfo, KStockDataSpace
```

把 `__init__` 增加缓存：

```python
self._data_space_info: DataSpaceInfo | None = None
```

新增方法：

```python
def _ensure_data_space(self) -> DataSpaceInfo:
    if self._data_space_info is None:
        data_space = KStockDataSpace(
            app_data_dir=self._config.app_data_dir,
            skill_root=self._config.skill_root,
            repo_root=self._config.repo_root,
            development_fallback=self._config.development_fallback,
        )
        self._data_space_info = data_space.ensure()
    return self._data_space_info
```

修改 `_ensure_qilin_environment`：

```python
def _ensure_qilin_environment(self) -> Path:
    info = self._ensure_data_space()
    qilin_repo_path = self._config.qilin_repo_path.resolve()
    if str(qilin_repo_path) not in sys.path:
        sys.path.insert(0, str(qilin_repo_path))
    os.environ["QILIN_PROJECT_ROOT"] = str(self._config.repo_root.resolve())
    os.environ["QILIN_CONFIG_PATH"] = str(info.runtime_config_path.resolve())
    os.environ["QILIN_HOME"] = str(info.qilin_home.resolve())
    os.environ["QILIN_SKILLS_PATH"] = str(info.skill_root.resolve())
    os.environ["KSTOCK_APP_DATA_DIR"] = str(info.app_data_dir.resolve())
    return qilin_repo_path
```

修改 `health()` 返回：

```python
info = self._ensure_data_space()
data_space = KStockDataSpace(info.app_data_dir, skill_root=info.skill_root).as_dict(info)
```

并在 ok/unavailable 两个分支都加入：

```python
"config": str(info.runtime_config_path.resolve()),
"dataSpace": data_space,
```

- [x] **步骤 5：运行测试**

运行：

```bash
python -m pytest sidecar/tests/test_qilin_adapter.py -q
```

预期：所有测试通过；旧测试中 `config` 断言需要从 `config/qilin.config.yaml` 更新为 `config/qilin.runtime.yaml`。

- [x] **步骤 6：提交**

```bash
git add sidecar/src/kstock_sidecar/config.py sidecar/src/kstock_sidecar/qilin_adapter.py sidecar/tests/test_qilin_adapter.py
git commit -m "feat: 让 QiLin 使用 KStock 数据空间"
```

## 任务 3：实现 KStock 产品索引数据库

**文件：**
- 创建：`sidecar/src/kstock_sidecar/product_store.py`
- 创建：`sidecar/tests/test_product_store.py`

- [x] **步骤 1：写失败测试**

写入 `sidecar/tests/test_product_store.py`：

```python
from pathlib import Path

from kstock_sidecar.product_store import ProductStore


def test_product_store_creates_project_and_thread_link(tmp_path: Path):
    store = ProductStore(tmp_path / "kstock.db")
    store.ensure_schema()

    project = store.create_project("新能源行业跟踪")
    store.link_thread(project["id"], "thread_001", title="宁德时代财报分析")

    projects = store.list_projects()
    threads = store.list_project_threads(project["id"])

    assert projects[0]["name"] == "新能源行业跟踪"
    assert threads[0]["thread_id"] == "thread_001"
    assert threads[0]["title"] == "宁德时代财报分析"


def test_product_store_upserts_report_asset(tmp_path: Path):
    store = ProductStore(tmp_path / "kstock.db")
    store.ensure_schema()

    report = store.upsert_report_asset(
        thread_id="thread_001",
        filename="report.md",
        virtual_path="/mnt/user-data/outputs/report.md",
        host_path=str(tmp_path / "report.md"),
        mime_type="text/markdown",
        title="研究报告",
    )

    reports = store.list_report_assets("thread_001")

    assert report["filename"] == "report.md"
    assert reports[0]["virtual_path"] == "/mnt/user-data/outputs/report.md"
```

- [x] **步骤 2：运行测试确认失败**

```bash
python -m pytest sidecar/tests/test_product_store.py -q
```

预期：失败，提示 `No module named 'kstock_sidecar.product_store'`。

- [x] **步骤 3：实现 SQLite 产品索引**

创建 `sidecar/src/kstock_sidecar/product_store.py`：

```python
from __future__ import annotations

import sqlite3
import time
import uuid
from pathlib import Path
from typing import Any


class ProductStore:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path

    def _connect(self) -> sqlite3.Connection:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def ensure_schema(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS projects (
                  id TEXT PRIMARY KEY,
                  name TEXT NOT NULL,
                  created_at REAL NOT NULL,
                  updated_at REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS project_threads (
                  project_id TEXT NOT NULL,
                  thread_id TEXT NOT NULL,
                  title TEXT,
                  created_at REAL NOT NULL,
                  updated_at REAL NOT NULL,
                  PRIMARY KEY (project_id, thread_id)
                );
                CREATE TABLE IF NOT EXISTS report_assets (
                  id TEXT PRIMARY KEY,
                  thread_id TEXT NOT NULL,
                  project_id TEXT,
                  title TEXT,
                  filename TEXT NOT NULL,
                  virtual_path TEXT NOT NULL,
                  host_path TEXT NOT NULL,
                  mime_type TEXT,
                  created_at REAL NOT NULL,
                  last_opened_at REAL
                );
                CREATE TABLE IF NOT EXISTS task_tags (
                  thread_id TEXT NOT NULL,
                  tag TEXT NOT NULL,
                  created_at REAL NOT NULL,
                  PRIMARY KEY (thread_id, tag)
                );
                CREATE TABLE IF NOT EXISTS recent_items (
                  item_type TEXT NOT NULL,
                  item_id TEXT NOT NULL,
                  opened_at REAL NOT NULL,
                  PRIMARY KEY (item_type, item_id)
                );
                CREATE TABLE IF NOT EXISTS ui_state (
                  key TEXT PRIMARY KEY,
                  value_json TEXT NOT NULL,
                  updated_at REAL NOT NULL
                );
                """
            )

    @staticmethod
    def _row(row: sqlite3.Row) -> dict[str, Any]:
        return dict(row)

    def create_project(self, name: str) -> dict[str, Any]:
        now = time.time()
        project_id = f"project_{uuid.uuid4().hex[:12]}"
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (project_id, name, now, now),
            )
        return {"id": project_id, "name": name, "created_at": now, "updated_at": now}

    def list_projects(self) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute("SELECT * FROM projects ORDER BY updated_at DESC").fetchall()
        return [self._row(row) for row in rows]

    def link_thread(self, project_id: str, thread_id: str, *, title: str | None = None) -> None:
        now = time.time()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO project_threads (project_id, thread_id, title, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(project_id, thread_id) DO UPDATE SET title=excluded.title, updated_at=excluded.updated_at
                """,
                (project_id, thread_id, title, now, now),
            )

    def list_project_threads(self, project_id: str) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM project_threads WHERE project_id = ? ORDER BY updated_at DESC",
                (project_id,),
            ).fetchall()
        return [self._row(row) for row in rows]

    def upsert_report_asset(
        self,
        *,
        thread_id: str,
        filename: str,
        virtual_path: str,
        host_path: str,
        mime_type: str | None,
        title: str | None = None,
        project_id: str | None = None,
    ) -> dict[str, Any]:
        now = time.time()
        report_id = f"report_{uuid.uuid4().hex[:12]}"
        with self._connect() as conn:
            existing = conn.execute(
                "SELECT id, created_at FROM report_assets WHERE thread_id = ? AND virtual_path = ?",
                (thread_id, virtual_path),
            ).fetchone()
            if existing:
                report_id = existing["id"]
                created_at = existing["created_at"]
            else:
                created_at = now
            conn.execute(
                """
                INSERT INTO report_assets (
                  id, thread_id, project_id, title, filename, virtual_path, host_path, mime_type, created_at, last_opened_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  project_id=excluded.project_id,
                  title=excluded.title,
                  filename=excluded.filename,
                  host_path=excluded.host_path,
                  mime_type=excluded.mime_type
                """,
                (report_id, thread_id, project_id, title, filename, virtual_path, host_path, mime_type, created_at, None),
            )
        return {
            "id": report_id,
            "thread_id": thread_id,
            "project_id": project_id,
            "title": title,
            "filename": filename,
            "virtual_path": virtual_path,
            "host_path": host_path,
            "mime_type": mime_type,
            "created_at": created_at,
            "last_opened_at": None,
        }

    def list_report_assets(self, thread_id: str) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM report_assets WHERE thread_id = ? ORDER BY created_at DESC",
                (thread_id,),
            ).fetchall()
        return [self._row(row) for row in rows]
```

- [x] **步骤 4：运行测试确认通过**

```bash
python -m pytest sidecar/tests/test_product_store.py -q
```

预期：2 个测试通过。

- [x] **步骤 5：提交**

```bash
git add sidecar/src/kstock_sidecar/product_store.py sidecar/tests/test_product_store.py
git commit -m "feat: 添加 KStock 产品索引库"
```

## 任务 4：实现 QiLin 用户上下文包装器

**文件：**
- 创建：`sidecar/src/kstock_sidecar/user_context.py`
- 创建：`sidecar/tests/test_user_context.py`

- [x] **步骤 1：写失败测试**

写入 `sidecar/tests/test_user_context.py`：

```python
from kstock_sidecar.user_context import kstock_user_context


def test_kstock_user_context_sets_qilin_current_user():
    with kstock_user_context("local-test-user"):
        from qilin.runtime.user_context import get_effective_user_id

        assert get_effective_user_id() == "local-test-user"
```

- [x] **步骤 2：运行测试确认失败**

```bash
python -m pytest sidecar/tests/test_user_context.py -q
```

预期：失败，提示 `No module named 'kstock_sidecar.user_context'`。

- [x] **步骤 3：实现上下文包装器**

创建 `sidecar/src/kstock_sidecar/user_context.py`：

```python
from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from typing import Iterator


@dataclass(frozen=True)
class KStockCurrentUser:
    id: str


@contextmanager
def kstock_user_context(user_id: str) -> Iterator[None]:
    from qilin.runtime.user_context import reset_current_user, set_current_user

    token = set_current_user(KStockCurrentUser(id=user_id))
    try:
        yield
    finally:
        reset_current_user(token)
```

- [x] **步骤 4：运行测试确认通过**

```bash
python -m pytest sidecar/tests/test_user_context.py -q
```

预期：1 个测试通过。

- [x] **步骤 5：提交**

```bash
git add sidecar/src/kstock_sidecar/user_context.py sidecar/tests/test_user_context.py
git commit -m "feat: 添加 QiLin 用户上下文桥接"
```

## 任务 5：扩展 workspace 协议

**文件：**
- 修改：`sidecar/src/kstock_sidecar/server.py`
- 修改：`sidecar/src/kstock_sidecar/qilin_adapter.py`
- 创建：`sidecar/tests/test_server_workspace.py`

- [x] **步骤 1：写失败测试**

写入 `sidecar/tests/test_server_workspace.py`：

```python
from pathlib import Path

from kstock_sidecar.config import SidecarConfig
from kstock_sidecar.protocol import Request
from kstock_sidecar.qilin_adapter import QiLinAdapter
from kstock_sidecar.server import dispatch_request


def test_workspace_init_returns_data_space(tmp_path: Path):
    adapter = QiLinAdapter(client_factory=lambda: object(), config=SidecarConfig(app_data_dir=tmp_path))

    response = dispatch_request(Request(id="1", method="workspace.init", params={}), adapter=adapter)

    assert response.ok is True
    assert response.result["activeUserId"].startswith("local-")
    assert response.result["qilinHome"].endswith("runtime/qilin")


def test_workspace_info_returns_same_user(tmp_path: Path):
    adapter = QiLinAdapter(client_factory=lambda: object(), config=SidecarConfig(app_data_dir=tmp_path))

    first = dispatch_request(Request(id="1", method="workspace.init", params={}), adapter=adapter)
    second = dispatch_request(Request(id="2", method="workspace.info", params={}), adapter=adapter)

    assert second.ok is True
    assert second.result["activeUserId"] == first.result["activeUserId"]
```

- [x] **步骤 2：运行测试确认失败**

```bash
python -m pytest sidecar/tests/test_server_workspace.py -q
```

预期：失败，提示 `不支持的方法：workspace.init`。

- [x] **步骤 3：在 QiLinAdapter 增加 workspace 方法**

在 `sidecar/src/kstock_sidecar/qilin_adapter.py` 增加：

```python
def workspace_info(self) -> dict[str, object]:
    info = self._ensure_data_space()
    return KStockDataSpace(info.app_data_dir, skill_root=info.skill_root).as_dict(info)
```

- [x] **步骤 4：在 server 分发新方法**

修改 `sidecar/src/kstock_sidecar/server.py`：

```python
def dispatch_request(request: Request, adapter: QiLinAdapter | None = None) -> Response:
    adapter = adapter or QiLinAdapter()
    if request.method == "health":
        return Response(id=request.id, ok=True, result=adapter.health())
    if request.method in {"workspace.init", "workspace.info"}:
        return Response(id=request.id, ok=True, result=adapter.workspace_info())
    return Response(
        id=request.id,
        ok=False,
        error=f"不支持的方法：{request.method}",
    )
```

- [x] **步骤 5：运行测试确认通过**

```bash
python -m pytest sidecar/tests/test_server_workspace.py sidecar/tests/test_server_smoke.py -q
```

预期：全部通过。

- [x] **步骤 6：提交**

```bash
git add sidecar/src/kstock_sidecar/server.py sidecar/src/kstock_sidecar/qilin_adapter.py sidecar/tests/test_server_workspace.py
git commit -m "feat: 添加 workspace sidecar 协议"
```

## 任务 6：实现线程创建、列表和目录初始化

**文件：**
- 修改：`sidecar/src/kstock_sidecar/qilin_adapter.py`
- 修改：`sidecar/src/kstock_sidecar/server.py`
- 修改：`sidecar/tests/test_server_workspace.py`

- [x] **步骤 1：写失败测试**

在 `sidecar/tests/test_server_workspace.py` 增加：

```python
def test_thread_create_makes_qilin_thread_dirs(tmp_path: Path):
    adapter = QiLinAdapter(client_factory=lambda: object(), config=SidecarConfig(app_data_dir=tmp_path))

    response = dispatch_request(
        Request(id="1", method="thread.create", params={"title": "财报分析"}),
        adapter=adapter,
    )

    assert response.ok is True
    user_id = response.result["userId"]
    thread_id = response.result["threadId"]
    assert response.result["title"] == "财报分析"
    assert (tmp_path / "runtime/qilin/users" / user_id / "threads" / thread_id / "user-data/workspace").is_dir()
    assert (tmp_path / "runtime/qilin/users" / user_id / "threads" / thread_id / "user-data/uploads").is_dir()
    assert (tmp_path / "runtime/qilin/users" / user_id / "threads" / thread_id / "user-data/outputs").is_dir()
```

- [x] **步骤 2：运行测试确认失败**

```bash
python -m pytest sidecar/tests/test_server_workspace.py::test_thread_create_makes_qilin_thread_dirs -q
```

预期：失败，提示 `不支持的方法：thread.create`。

- [x] **步骤 3：实现 adapter 线程创建**

在 `sidecar/src/kstock_sidecar/qilin_adapter.py` 增加：

```python
import uuid
from datetime import UTC, datetime
```

增加方法：

```python
def create_thread(self, *, title: str | None = None, project_id: str | None = None) -> dict[str, object]:
    self._ensure_qilin_environment()
    info = self._ensure_data_space()
    thread_id = f"thread_{uuid.uuid4().hex[:16]}"
    from qilin.config.paths import get_paths

    get_paths().ensure_thread_dirs(thread_id, user_id=info.active_user_id)
    if project_id:
        from .product_store import ProductStore

        store = ProductStore(info.product_db_path)
        store.ensure_schema()
        store.link_thread(project_id, thread_id, title=title)

    return {
        "threadId": thread_id,
        "userId": info.active_user_id,
        "title": title,
        "createdAt": datetime.now(UTC).isoformat(),
        "paths": {
            "workspace": f"/mnt/user-data/workspace",
            "uploads": f"/mnt/user-data/uploads",
            "outputs": f"/mnt/user-data/outputs",
            "hostThreadDir": str(get_paths().thread_dir(thread_id, user_id=info.active_user_id)),
        },
    }
```

- [x] **步骤 4：分发 `thread.create`**

修改 `sidecar/src/kstock_sidecar/server.py`：

```python
if request.method == "thread.create":
    return Response(
        id=request.id,
        ok=True,
        result=adapter.create_thread(
            title=request.params.get("title") if isinstance(request.params.get("title"), str) else None,
            project_id=request.params.get("projectId") if isinstance(request.params.get("projectId"), str) else None,
        ),
    )
```

- [x] **步骤 5：运行测试确认通过**

```bash
python -m pytest sidecar/tests/test_server_workspace.py -q
```

预期：全部通过。

- [x] **步骤 6：提交**

```bash
git add sidecar/src/kstock_sidecar/qilin_adapter.py sidecar/src/kstock_sidecar/server.py sidecar/tests/test_server_workspace.py
git commit -m "feat: 添加线程数据空间初始化"
```

## 任务 7：实现 artifact 扫描并回填报告索引

**文件：**
- 修改：`sidecar/src/kstock_sidecar/qilin_adapter.py`
- 修改：`sidecar/src/kstock_sidecar/server.py`
- 修改：`sidecar/tests/test_server_workspace.py`

- [x] **步骤 1：写失败测试**

在 `sidecar/tests/test_server_workspace.py` 增加：

```python
def test_artifact_list_indexes_outputs(tmp_path: Path):
    adapter = QiLinAdapter(client_factory=lambda: object(), config=SidecarConfig(app_data_dir=tmp_path))
    created = dispatch_request(Request(id="1", method="thread.create", params={}), adapter=adapter)
    thread_id = created.result["threadId"]
    user_id = created.result["userId"]
    output_dir = tmp_path / "runtime/qilin/users" / user_id / "threads" / thread_id / "user-data/outputs"
    (output_dir / "report.md").write_text("# 报告", encoding="utf-8")

    response = dispatch_request(Request(id="2", method="artifact.list", params={"threadId": thread_id}), adapter=adapter)

    assert response.ok is True
    assert response.result["count"] == 1
    assert response.result["artifacts"][0]["filename"] == "report.md"
    assert response.result["artifacts"][0]["virtualPath"] == "/mnt/user-data/outputs/report.md"
```

- [x] **步骤 2：运行测试确认失败**

```bash
python -m pytest sidecar/tests/test_server_workspace.py::test_artifact_list_indexes_outputs -q
```

预期：失败，提示 `不支持的方法：artifact.list`。

- [x] **步骤 3：实现 artifact 扫描**

在 `sidecar/src/kstock_sidecar/qilin_adapter.py` 增加：

```python
import mimetypes
```

增加方法：

```python
def list_artifacts(self, thread_id: str, *, project_id: str | None = None) -> dict[str, object]:
    self._ensure_qilin_environment()
    info = self._ensure_data_space()
    from qilin.config.paths import get_paths
    from .product_store import ProductStore

    outputs_dir = get_paths().sandbox_outputs_dir(thread_id, user_id=info.active_user_id)
    outputs_dir.mkdir(parents=True, exist_ok=True)
    store = ProductStore(info.product_db_path)
    store.ensure_schema()

    artifacts = []
    for path in sorted(outputs_dir.iterdir()):
        if not path.is_file():
            continue
        mime_type, _ = mimetypes.guess_type(path.name)
        virtual_path = f"/mnt/user-data/outputs/{path.name}"
        report = store.upsert_report_asset(
            thread_id=thread_id,
            project_id=project_id,
            title=path.stem,
            filename=path.name,
            virtual_path=virtual_path,
            host_path=str(path),
            mime_type=mime_type or "application/octet-stream",
        )
        artifacts.append(
            {
                "id": report["id"],
                "filename": path.name,
                "virtualPath": virtual_path,
                "hostPath": str(path),
                "mimeType": mime_type or "application/octet-stream",
                "size": path.stat().st_size,
            }
        )
    return {"threadId": thread_id, "count": len(artifacts), "artifacts": artifacts}
```

- [x] **步骤 4：分发 `artifact.list`**

修改 `sidecar/src/kstock_sidecar/server.py`：

```python
if request.method == "artifact.list":
    thread_id = request.params.get("threadId")
    if not isinstance(thread_id, str) or not thread_id:
        return Response(id=request.id, ok=False, error="缺少 threadId")
    project_id = request.params.get("projectId")
    return Response(
        id=request.id,
        ok=True,
        result=adapter.list_artifacts(
            thread_id,
            project_id=project_id if isinstance(project_id, str) else None,
        ),
    )
```

- [x] **步骤 5：运行测试确认通过**

```bash
python -m pytest sidecar/tests/test_server_workspace.py sidecar/tests/test_product_store.py -q
```

预期：全部通过。

- [x] **步骤 6：提交**

```bash
git add sidecar/src/kstock_sidecar/qilin_adapter.py sidecar/src/kstock_sidecar/server.py sidecar/tests/test_server_workspace.py
git commit -m "feat: 添加报告产物索引"
```

## 任务 8：添加开发目录迁移保护

**文件：**
- 修改：`sidecar/src/kstock_sidecar/data_space.py`
- 修改：`sidecar/tests/test_data_space.py`

- [x] **步骤 1：写失败测试**

在 `sidecar/tests/test_data_space.py` 增加：

```python
def test_migration_copies_dev_qilin_only_when_target_empty(tmp_path: Path):
    repo_root = tmp_path / "repo"
    dev_qilin = repo_root / ".kstock/qilin"
    dev_qilin.mkdir(parents=True)
    (dev_qilin / "memory.json").write_text("{}", encoding="utf-8")
    app_data = tmp_path / "app-data"

    data_space = KStockDataSpace(app_data_dir=app_data, repo_root=repo_root)
    data_space.migrate_development_qilin_if_empty()

    assert (app_data / "runtime/qilin/memory.json").is_file()
    assert (app_data / "config/migration-state.json").is_file()


def test_migration_does_not_overwrite_existing_runtime(tmp_path: Path):
    repo_root = tmp_path / "repo"
    dev_qilin = repo_root / ".kstock/qilin"
    dev_qilin.mkdir(parents=True)
    (dev_qilin / "memory.json").write_text('{"old": true}', encoding="utf-8")
    app_data = tmp_path / "app-data"
    existing = app_data / "runtime/qilin"
    existing.mkdir(parents=True)
    (existing / "memory.json").write_text('{"new": true}', encoding="utf-8")

    data_space = KStockDataSpace(app_data_dir=app_data, repo_root=repo_root)
    data_space.migrate_development_qilin_if_empty()

    assert (existing / "memory.json").read_text(encoding="utf-8") == '{"new": true}'
```

- [x] **步骤 2：运行测试确认失败**

```bash
python -m pytest sidecar/tests/test_data_space.py::test_migration_copies_dev_qilin_only_when_target_empty sidecar/tests/test_data_space.py::test_migration_does_not_overwrite_existing_runtime -q
```

预期：失败，提示 `KStockDataSpace` 没有 `migrate_development_qilin_if_empty`。

- [x] **步骤 3：实现迁移保护**

在 `sidecar/src/kstock_sidecar/data_space.py` 增加：

```python
import shutil
```

增加方法：

```python
def migrate_development_qilin_if_empty(self) -> bool:
    source = self.repo_root / ".kstock/qilin"
    target = self.app_data_dir / "runtime/qilin"
    state_path = self.app_data_dir / "config/migration-state.json"
    state_path.parent.mkdir(parents=True, exist_ok=True)

    if state_path.is_file() or not source.is_dir():
        return False
    if target.exists() and any(target.iterdir()):
        state_path.write_text(
            json.dumps({"developmentQilinMigration": "skipped-target-not-empty"}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return False

    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(source, target)
    state_path.write_text(
        json.dumps({"developmentQilinMigration": "copied"}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return True
```

在 `ensure()` 最开始调用：

```python
self.migrate_development_qilin_if_empty()
```

- [x] **步骤 4：运行测试确认通过**

```bash
python -m pytest sidecar/tests/test_data_space.py -q
```

预期：全部通过。

- [x] **步骤 5：提交**

```bash
git add sidecar/src/kstock_sidecar/data_space.py sidecar/tests/test_data_space.py
git commit -m "feat: 添加开发数据迁移保护"
```

## 任务 9：Tauri 暴露 app data 目录

**文件：**
- 修改：`apps/desktop/src-tauri/src/sidecar.rs`
- 修改：`apps/desktop/src-tauri/src/main.rs`
- 修改：`apps/desktop/src-tauri/capabilities/default.json`

- [x] **步骤 1：写 Rust 命令**

修改 `apps/desktop/src-tauri/src/sidecar.rs`：

```rust
use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn sidecar_status() -> String {
  "未连接".to_string()
}

#[tauri::command]
pub fn app_data_dir(app: AppHandle) -> Result<String, String> {
  app
    .path()
    .app_data_dir()
    .map(|path| path.to_string_lossy().to_string())
    .map_err(|error| format!("无法解析应用数据目录：{error}"))
}
```

- [x] **步骤 2：注册命令**

修改 `apps/desktop/src-tauri/src/main.rs`：

```rust
.invoke_handler(tauri::generate_handler![sidecar::sidecar_status, sidecar::app_data_dir])
```

- [x] **步骤 3：更新 capability**

修改 `apps/desktop/src-tauri/capabilities/default.json` 的 `permissions`：

```json
[
  "core:default",
  "core:window:allow-toggle-maximize",
  "core:path:allow-app-data-dir"
]
```

- [x] **步骤 4：运行 Rust 检查**

```bash
cd apps/desktop/src-tauri && cargo check
```

预期：`Finished dev profile`，没有编译错误。

- [x] **步骤 5：提交**

```bash
git add apps/desktop/src-tauri/src/sidecar.rs apps/desktop/src-tauri/src/main.rs apps/desktop/src-tauri/capabilities/default.json
git commit -m "feat: 暴露桌面应用数据目录"
```

## 任务 10：前端增加数据空间类型和请求构造

**文件：**
- 修改：`apps/desktop/src/lib/sidecarTypes.ts`
- 修改：`apps/desktop/src/lib/sidecarClient.ts`
- 修改：`apps/desktop/tests/App.spec.tsx`

- [x] **步骤 1：补充类型**

在 `apps/desktop/src/lib/sidecarTypes.ts` 增加：

```ts
export interface WorkspaceInfo {
  appDataDir: string;
  activeUserId: string;
  qilinHome: string;
  qilinDataDir: string;
  runtimeConfigPath: string;
  productDbPath: string;
  skillRoot: string;
  developmentFallback: boolean;
}

export interface ThreadCreateResult {
  threadId: string;
  userId: string;
  title?: string | null;
  createdAt: string;
  paths: {
    workspace: string;
    uploads: string;
    outputs: string;
    hostThreadDir: string;
  };
}

export interface ArtifactListResult {
  threadId: string;
  count: number;
  artifacts: Array<{
    id: string;
    filename: string;
    virtualPath: string;
    hostPath: string;
    mimeType: string;
    size: number;
  }>;
}
```

- [x] **步骤 2：补充请求构造函数**

在 `apps/desktop/src/lib/sidecarClient.ts` 增加：

```ts
export function createWorkspaceInfoRequest(): SidecarRequest {
  return {
    id: crypto.randomUUID(),
    method: "workspace.info",
    params: {}
  };
}

export function createThreadCreateRequest(title?: string, projectId?: string): SidecarRequest {
  return {
    id: crypto.randomUUID(),
    method: "thread.create",
    params: {
      ...(title ? { title } : {}),
      ...(projectId ? { projectId } : {})
    }
  };
}

export function createArtifactListRequest(threadId: string, projectId?: string): SidecarRequest {
  return {
    id: crypto.randomUUID(),
    method: "artifact.list",
    params: {
      threadId,
      ...(projectId ? { projectId } : {})
    }
  };
}
```

- [x] **步骤 3：写 Vitest 覆盖请求编码**

在 `apps/desktop/tests/App.spec.tsx` 增加：

```ts
import {
  createArtifactListRequest,
  createThreadCreateRequest,
  createWorkspaceInfoRequest
} from "../src/lib/sidecarClient";

it("构造用户数据空间 sidecar 请求", () => {
  expect(createWorkspaceInfoRequest().method).toBe("workspace.info");
  expect(createThreadCreateRequest("财报分析").params).toEqual({ title: "财报分析" });
  expect(createArtifactListRequest("thread_001").params).toEqual({ threadId: "thread_001" });
});
```

- [x] **步骤 4：运行前端测试**

```bash
pnpm -C apps/desktop test
```

预期：Vitest 全部通过。

- [x] **步骤 5：提交**

```bash
git add apps/desktop/src/lib/sidecarTypes.ts apps/desktop/src/lib/sidecarClient.ts apps/desktop/tests/App.spec.tsx
git commit -m "feat: 添加数据空间前端协议类型"
```

## 任务 11：更新文档

**文件：**
- 修改：`docs/配置说明.md`
- 修改：`docs/运行说明.md`
- 修改：`docs/故障排查.md`

- [x] **步骤 1：更新配置说明**

在 `docs/配置说明.md` 增加：

```markdown
## 用户数据目录

正式桌面端运行时，KStock 把用户数据写入系统应用数据目录：

- macOS：`~/Library/Application Support/KStock`
- Windows：`%APPDATA%\KStock`
- Linux：`~/.local/share/KStock`

开发模式如果没有设置 `KSTOCK_APP_DATA_DIR`，会 fallback 到仓库内 `.kstock`。发布包不得依赖这个目录。

QiLin 的正式运行目录为：

`<KStock 数据目录>/runtime/qilin`

QiLin SQLite 为：

`<KStock 数据目录>/runtime/qilin/data/qilin.db`
```

- [x] **步骤 2：更新运行说明**

在 `docs/运行说明.md` 的本地开发部分增加：

````markdown
如需模拟正式数据目录：

```bash
KSTOCK_APP_DATA_DIR=/tmp/kstock-app-data pnpm -C apps/desktop tauri:dev
```
````

- [x] **步骤 3：更新故障排查**

在 `docs/故障排查.md` 增加：

```markdown
## 用户数据目录异常

如果 sidecar 健康检查返回 `developmentFallback: true`，说明当前没有收到正式应用数据目录，正在使用仓库内 `.kstock`。开发时可以接受；发布包中出现该状态需要检查 Tauri 是否正确传入 `KSTOCK_APP_DATA_DIR`。

如果线程历史或报告丢失，先检查：

- `QILIN_HOME` 是否指向 `<KStock 数据目录>/runtime/qilin`
- `qilin.runtime.yaml` 中 `database.sqlite_dir` 是否为绝对路径
- 当前 `activeUserId` 是否和线程目录 `runtime/qilin/users/{user_id}` 一致
```

- [x] **步骤 4：运行文档相关检查**

```bash
git diff --check
bash scripts/build-sidecar.sh
```

预期：无空白错误，`dist/kstock-sidecar.pyz` 生成。

- [x] **步骤 5：提交**

```bash
git add docs/配置说明.md docs/运行说明.md docs/故障排查.md
git commit -m "docs: 补充用户数据空间运行说明"
```

## 任务 12：全量验证并推送

**文件：**
- 修改：`task_plan.md`
- 修改：`progress.md`

- [x] **步骤 1：运行 sidecar 测试**

```bash
python -m pytest sidecar/tests -q
```

预期：全部通过。

- [x] **步骤 2：运行前端测试**

```bash
pnpm -C apps/desktop test
```

预期：Vitest 全部通过。

- [x] **步骤 3：运行 Rust 检查**

```bash
cd apps/desktop/src-tauri && cargo check
```

预期：`Finished dev profile`。

- [x] **步骤 4：运行 sidecar 打包**

```bash
bash scripts/build-sidecar.sh
python dist/kstock-sidecar.pyz <<'EOF'
{"id":"1","method":"workspace.info","params":{}}
EOF
```

预期：输出 JSON 行，`ok` 为 `true`，`result.qilinHome` 指向 `runtime/qilin`。

- [x] **步骤 5：更新计划文件**

把 `task_plan.md` 阶段 14 标记为已完成，并在 `progress.md` 记录验证命令和结果。

- [x] **步骤 6：最终提交并推送**

```bash
git add task_plan.md progress.md
git commit -m "chore: 完成用户数据空间实施记录"
git status --short --branch
git push origin main
```

预期：工作区干净，`origin/main` 指向最终提交。

## 自检

- 设计文档中的跨平台 app data 根目录：任务 1、2、9 覆盖。
- QiLin `QILIN_HOME` 和 SQLite 绝对路径：任务 1、2 覆盖。
- 默认本地用户和 QiLin ContextVar：任务 1、4 覆盖。
- QiLin 原生线程目录：任务 6 覆盖。
- KStock 产品索引库：任务 3、7 覆盖。
- artifact/report 索引：任务 7 覆盖。
- 开发 `.kstock/qilin` 迁移保护：任务 8 覆盖。
- Tauri 桌面宿主数据目录：任务 9 覆盖。
- 前端协议类型：任务 10 覆盖。
- 文档和发布检查：任务 11、12 覆盖。
