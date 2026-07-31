# 前端模型配置打通 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 打通桌面端模型配置读写闭环——前端能读取/增删改引擎的模型配置并即时生效，消息输入框可选用当前会话模型。

**Architecture:** 引擎 `GET /api/models` 只读、无写入端点，但配置文件 mtime 变化后引擎自动热重载。KStock 自建独立写入层（`scripts/kstock_models.py` FastAPI 路由）改写 `qilin.runtime.yaml` 的 models 段与 `secrets.env`（API key 明文存此，yaml 只存 `$ENV` 引用）。前端新增 `modelsClient.ts` 对接，`ModelSettings` 从展示桩改为 CRUD，输入框加模型选择器。

**Tech Stack:** Python 3 (FastAPI + PyYAML + pytest) · TypeScript + React + Vite + vitest · 配套 `docs/开发进度.md` 统计交付物

**Spec:** `docs/superpowers/specs/2026-07-31-model-config-design.md`

---

## 文件结构

**后端（Python）**
- 新建 `scripts/kstock_models.py` — KStock 模型配置写入层（FastAPI 路由 + runtime.yaml/secrets.env/prefs.json 读写工具）。职责：CRUD 端点、环境变量命名、原子替换、备份、偏好读写
- 新建 `tests/test_kstock_models.py` — 后端 pytest 覆盖（测试统一放仓库根 `tests/`，与前端 `apps/desktop/tests` 并列）
- 新建 `tests/__init__.py` + `tests/conftest.py` — 使 `tests` 成为可导入包，conftest 把仓库根加入 sys.path 以便 `from scripts.kstock_models import ...`
- 修改 `pyproject.toml` — 配置 `[tool.pytest.ini_options] testpaths = ["tests"]`，让 `uv run pytest` 默认从 tests 目录收集
- 修改 `scripts/run_gateway.py` — 在 `create_app()` 里 `app.include_router(kstock_models.router)`

**前端（TypeScript/React）**
- 新建 `apps/desktop/src/lib/modelsClient.ts` — 镜像 authClient 模式的模型配置 API 客户端 + 类型
- 修改 `apps/desktop/src/pages/Home.tsx` — `ModelSettings` 重构为 CRUD、输入框加模型选择器、`handleSend` 携带 model
- 修改 `apps/desktop/src/lib/sessionStore.ts` — `appendMessageToSession` 支持 model 元数据
- 修改 `apps/desktop/src/styles.css` — 模型列表/编辑面板/选择器样式
- 修改 `apps/desktop/tests/App.spec.tsx` — mock modelsClient + 新增模型配置测试

**文档**
- 修改 `docs/配置说明.md` — 新增「模型配置」章节
- 修改 `docs/运行说明.md` — 首次运行流程补「配置模型」
- 新建 `docs/开发进度.md` — 统计所有已交付功能

---

## Task 1: 后端写入层骨架与工具函数

**Files:**
- Create: `scripts/kstock_models.py`
- Create: `tests/test_kstock_models.py`
- Create: `tests/__init__.py`（空文件，使 tests 成为包）
- Create: `tests/conftest.py`（把仓库根加入 sys.path）
- Modify: `pyproject.toml`（配置 testpaths）

- [ ] **Step 1: 配置 pytest testpaths + conftest**

修改 `pyproject.toml`，在末尾追加：

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
```

创建 `tests/__init__.py`（空文件）。

创建 `tests/conftest.py`：

```python
"""pytest 全局配置。

仓库根未被作为 Python 包安装（pyproject package=false），这里把仓库根
加入 sys.path，让测试可以用 ``from scripts.kstock_models import ...``
直接导入 scripts 目录下的模块。
"""
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))
```

- [ ] **Step 2: 写第一个失败测试——环境变量命名规则**

创建 `tests/test_kstock_models.py`：

```python
"""KStock 模型配置写入层单元测试。

用 tmp_path 隔离运行时目录与 secrets.env，不触碰真实用户数据空间。
"""
from pathlib import Path

import pytest

# run_gateway.py 在仓库根，scripts 目录需要可导入
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.kstock_models import env_name_for_model, load_runtime_models, save_runtime_models


def test_env_name_for_model_basic():
    """name 转大写、非字母数字转下划线，固定前后缀。"""
    assert env_name_for_model("deepseek-v4") == "KSTOCK_MODEL_DEEPSEEK_V4_KEY"
    assert env_name_for_model("glm.5.2") == "KSTOCK_MODEL_GLM_5_2_KEY"
    assert env_name_for_model("Qwen3-Coder") == "KSTOCK_MODEL_QWEN3_CODER_KEY"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /Users/libing/kk_Projects/KStock && uv run pytest tests/test_kstock_models.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.kstock_models'`

- [ ] **Step 3: 创建 kstock_models.py 的工具函数部分**

创建 `scripts/kstock_models.py`：

```python
"""KStock 模型配置写入层。

引擎 vendor/qilin 的 GET /api/models 只读、无写入端点，但配置文件 mtime
变化后 get_app_config() 自动热重载。本模块提供 KStock 自有的 CRUD 端点，
改写 qilin.runtime.yaml 的 models 段，并把 API key 明文写到独立的
secrets.env（runtime.yaml 只存 $ENV 引用），二者都落在用户数据空间。

默认模型是前端偏好（引擎 AppConfig 无 default_model 字段），存到独立的
prefs.json，与 runtime.yaml 解耦。
"""
from __future__ import annotations

import json
import os
import re
import shutil
import tempfile
from pathlib import Path
from typing import Any

import yaml
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v1/kstock", tags=["kstock-models"])


def _data_root() -> Path:
    """返回当前 KStock 用户数据根目录（由 run_gateway.py 注入环境变量）。"""
    return Path(os.environ["KSTOCK_APP_DATA_DIR"])


def _runtime_config_path() -> Path:
    return Path(os.environ["QILIN_CONFIG_PATH"])


def _secrets_env_path() -> Path:
    return _data_root() / "config" / "secrets.env"


def _prefs_path() -> Path:
    return _data_root() / "config" / "prefs.json"


def _backups_dir() -> Path:
    d = _data_root() / "backups"
    d.mkdir(parents=True, exist_ok=True)
    return d


def env_name_for_model(name: str) -> str:
    """模型 name → 环境变量名 KSTOCK_MODEL_<UPPER_NAME>_KEY。

    非字母数字字符转下划线，再去掉首尾下划线，最后加固定前后缀。
    """
    upper = re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_").upper()
    if not upper:
        raise ValueError(f"模型 name 无法转为合法环境变量名: {name!r}")
    return f"KSTOCK_MODEL_{upper}_KEY"
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /Users/libing/kk_Projects/KStock && uv run pytest tests/test_kstock_models.py -v`
Expected: PASS（1 passed）

- [ ] **Step 5: commit**

```bash
git add scripts/kstock_models.py tests/ pyproject.toml
git commit -m "feat(kstock_models): 模型配置写入层骨架与环境变量命名规则"
```

---

## Task 2: runtime.yaml 读写与原子替换

**Files:**
- Modify: `scripts/kstock_models.py`
- Test: `tests/test_kstock_models.py`

- [ ] **Step 1: 追加失败测试——读写与原子替换**

在 `tests/test_kstock_models.py` 末尾追加：

```python
def test_load_runtime_models_empty(tmp_path, monkeypatch):
    """runtime.yaml 无 models 段时返回空列表。"""
    _setup_data_root(tmp_path, monkeypatch, models_yaml="models: []\n")
    assert load_runtime_models() == []


def test_load_runtime_models_returns_list(tmp_path, monkeypatch):
    """正确解析 models 段为 dict 列表。"""
    yaml_text = (
        "models:\n"
        "  - name: deepseek\n"
        "    use: qilin.models.patched_deepseek:PatchedChatDeepSeek\n"
        "    model: deepseek-v4\n"
        "    api_key: $KSTOCK_MODEL_DEEPSEEK_KEY\n"
    )
    _setup_data_root(tmp_path, monkeypatch, models_yaml=yaml_text)
    models = load_runtime_models()
    assert len(models) == 1
    assert models[0]["name"] == "deepseek"
    assert models[0]["api_key"] == "$KSTOCK_MODEL_DEEPSEEK_KEY"


def test_save_runtime_models_atomic_and_backup(tmp_path, monkeypatch):
    """save 后 runtime.yaml 含新模型，生成备份，原 mtime 不等于新 mtime。"""
    _setup_data_root(tmp_path, monkeypatch, models_yaml="models: []\n")
    config_path = _runtime_config_path_under(tmp_path)
    old_mtime = config_path.stat().st_mtime

    new_models = [
        {"name": "glm", "use": "x:Y", "model": "glm-5", "api_key": "$KSTOCK_MODEL_GLM_KEY"}
    ]
    save_runtime_models(new_models)

    reloaded = load_runtime_models()
    assert reloaded == new_models
    assert config_path.stat().st_mtime != old_mtime
    backups = list((tmp_path / "backups").glob("qilin.runtime.yaml.*"))
    assert len(backups) == 1


# ── 测试辅助 ─────────────────────────────────────────────────────────
def _runtime_config_path_under(data_root: Path) -> Path:
    return data_root / "config" / "qilin.runtime.yaml"


def _setup_data_root(data_root: Path, monkeypatch, models_yaml: str) -> Path:
    """在 tmp_path 下建立完整数据空间，注入环境变量，写初始 runtime.yaml。"""
    config_dir = data_root / "config"
    config_dir.mkdir(parents=True, exist_ok=True)
    runtime_cfg = config_dir / "qilin.runtime.yaml"
    runtime_cfg.write_text(models_yaml, encoding="utf-8")
    monkeypatch.setenv("KSTOCK_APP_DATA_DIR", str(data_root))
    monkeypatch.setenv("QILIN_CONFIG_PATH", str(runtime_cfg))
    return data_root
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /Users/libing/kk_Projects/KStock && uv run pytest tests/test_kstock_models.py -v`
Expected: FAIL with `ImportError: cannot import name 'load_runtime_models'`

- [ ] **Step 3: 实现 load/save 工具函数**

在 `scripts/kstock_models.py` 的 `env_name_for_model` 之后追加：

```python
def load_runtime_config() -> dict[str, Any]:
    """读 runtime.yaml 为 dict；文件不存在时返回空 dict。"""
    path = _runtime_config_path()
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def load_runtime_models() -> list[dict[str, Any]]:
    """读 runtime.yaml 的 models 段；无则返回空列表。"""
    cfg = load_runtime_config()
    models = cfg.get("models")
    if not isinstance(models, list):
        return []
    return [m for m in models if isinstance(m, dict)]


def _atomic_write_yaml(path: Path, data: dict[str, Any]) -> None:
    """备份原文件后，用临时文件 + os.replace 原子替换。"""
    if path.exists():
        backup_name = f"{path.name}.{int(path.stat().st_mtime * 1000)}.bak"
        shutil.copy2(path, _backups_dir() / backup_name)
    path.parent.mkdir(parents=True, exist_ok=True)
    directory = str(path.parent)
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            yaml.safe_dump(data, fh, allow_unicode=True, sort_keys=False)
        os.replace(tmp, path)
    except Exception:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


def save_runtime_models(models: list[dict[str, Any]]) -> None:
    """更新 runtime.yaml 的 models 段（保留其他段），原子替换。"""
    cfg = load_runtime_config()
    cfg["models"] = models
    _atomic_write_yaml(_runtime_config_path(), cfg)
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /Users/libing/kk_Projects/KStock && uv run pytest tests/test_kstock_models.py -v`
Expected: PASS（4 passed）

- [ ] **Step 5: commit**

```bash
git add scripts/kstock_models.py tests/test_kstock_models.py
git commit -m "feat(kstock_models): runtime.yaml 原子读写与备份"
```

---

## Task 3: secrets.env 读写

**Files:**
- Modify: `scripts/kstock_models.py`
- Test: `tests/test_kstock_models.py`

- [ ] **Step 1: 追加失败测试——secrets.env 增删改与权限**

在 `tests/test_kstock_models.py` 末尾追加：

```python
def test_upsert_secret_creates_file_with_600(tmp_path, monkeypatch):
    """首次写入创建 secrets.env，权限 600（Windows 跳过权限断言）。"""
    _setup_data_root(tmp_path, monkeypatch, models_yaml="models: []\n")
    upsert_secret("KSTOCK_MODEL_X_KEY", "sk-abc")
    env_file = tmp_path / "config" / "secrets.env"
    assert env_file.exists()
    text = env_file.read_text(encoding="utf-8")
    assert 'KSTOCK_MODEL_X_KEY="sk-abc"' in text
    if os.name != "nt":
        assert oct(env_file.stat().st_mode)[-3:] == "600"


def test_upsert_secret_updates_existing(tmp_path, monkeypatch):
    """同 key 二次写入覆盖旧值，不产生重复行。"""
    _setup_data_root(tmp_path, monkeypatch, models_yaml="models: []\n")
    upsert_secret("KSTOCK_MODEL_X_KEY", "old")
    upsert_secret("KSTOCK_MODEL_X_KEY", "new")
    text = (tmp_path / "config" / "secrets.env").read_text(encoding="utf-8")
    assert 'KSTOCK_MODEL_X_KEY="new"' in text
    assert text.count("KSTOCK_MODEL_X_KEY=") == 1


def test_remove_secret(tmp_path, monkeypatch):
    """删除 key 后该行消失，保留其他 key。"""
    _setup_data_root(tmp_path, monkeypatch, models_yaml="models: []\n")
    upsert_secret("KSTOCK_MODEL_A_KEY", "1")
    upsert_secret("KSTOCK_MODEL_B_KEY", "2")
    remove_secret("KSTOCK_MODEL_A_KEY")
    text = (tmp_path / "config" / "secrets.env").read_text(encoding="utf-8")
    assert "KSTOCK_MODEL_A_KEY" not in text
    assert 'KSTOCK_MODEL_B_KEY="2"' in text


import os  # 顶部已有 import，此行确保模块级可见（如已在顶部 import 可省略）
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /Users/libing/kk_Projects/KStock && uv run pytest tests/test_kstock_models.py -v`
Expected: FAIL with `ImportError: cannot import name 'upsert_secret'`

- [ ] **Step 3: 实现 secrets.env 工具函数**

在 `scripts/kstock_models.py` 的 `save_runtime_models` 之后追加：

```python
def _load_secrets_lines() -> list[str]:
    path = _secrets_env_path()
    if not path.exists():
        return []
    return path.read_text(encoding="utf-8").splitlines()


def _write_secrets_lines(lines: list[str]) -> None:
    path = _secrets_env_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    is_new = not path.exists()
    fd, tmp = tempfile.mkstemp(prefix=".secrets.env.", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write("\n".join(lines))
            if lines:
                fh.write("\n")
        os.replace(tmp, path)
    except Exception:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise
    # 仅 Unix 有意义：文件创建即收紧权限
    if is_new and os.name != "nt":
        os.chmod(path, 0o600)


def upsert_secret(key: str, value: str) -> None:
    """写入或覆盖一个 KEY="value" 行；保持其他行不变。"""
    lines = _load_secrets_lines()
    target = f'{key}='
    found = False
    for i, line in enumerate(lines):
        if line.startswith(target):
            lines[i] = f'{key}="{value}"'
            found = True
            break
    if not found:
        lines.append(f'{key}="{value}"')
    _write_secrets_lines(lines)


def remove_secret(key: str) -> None:
    """删除指定 KEY= 行；文件不存在或无此 key 时无副作用。"""
    lines = _load_secrets_lines()
    target = f'{key}='
    filtered = [line for line in lines if not line.startswith(target)]
    if len(filtered) == len(lines):
        return
    _write_secrets_lines(filtered)
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /Users/libing/kk_Projects/KStock && uv run pytest tests/test_kstock_models.py -v`
Expected: PASS（7 passed）

- [ ] **Step 5: commit**

```bash
git add scripts/kstock_models.py tests/test_kstock_models.py
git commit -m "feat(kstock_models): secrets.env 读写与 600 权限"
```

---

## Task 4: 偏好文件 prefs.json 与 CRUD Pydantic 模型

**Files:**
- Modify: `scripts/kstock_models.py`
- Test: `tests/test_kstock_models.py`

- [ ] **Step 1: 追加失败测试——偏好读写与 Pydantic 校验**

在 `tests/test_kstock_models.py` 末尾追加：

```python
from scripts.kstock_models import (
    ModelWritePayload,
    get_default_model,
    set_default_model,
)


def test_default_model_roundtrip(tmp_path, monkeypatch):
    """未设置时返回 None；设置后返回 name。"""
    _setup_data_root(tmp_path, monkeypatch, models_yaml="models: []\n")
    assert get_default_model() is None
    set_default_model("deepseek")
    assert get_default_model() == "deepseek"


def test_default_model_overwrite(tmp_path, monkeypatch):
    _setup_data_root(tmp_path, monkeypatch, models_yaml="models: []\n")
    set_default_model("a")
    set_default_model("b")
    assert get_default_model() == "b"


def test_model_write_payload_strips_api_key(tmp_path, monkeypatch):
    """api_key 为空字符串时视为未提供（不修改）。"""
    payload = ModelWritePayload(
        name="x",
        use="p:Q",
        model="m",
        api_key="",
    )
    assert payload.api_key is None


def test_model_write_payload_requires_name():
    import pytest as _pytest
    with _pytest.raises(Exception):
        ModelWritePayload(use="p:Q", model="m")
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /Users/libing/kk_Projects/KStock && uv run pytest tests/test_kstock_models.py -v`
Expected: FAIL with `ImportError: cannot import name 'ModelWritePayload'`

- [ ] **Step 3: 实现 Pydantic 模型与偏好读写**

在 `scripts/kstock_models.py` 的 `remove_secret` 之后追加：

```python
# ── Pydantic 请求/响应模型 ─────────────────────────────────────────────

class ModelWritePayload(BaseModel):
    """前端提交的模型写入负载。api_key 留空表示不修改。"""
    name: str = Field(..., min_length=1)
    display_name: str | None = None
    description: str | None = None
    use: str = Field(..., min_length=1)           # provider class path
    model: str = Field(..., min_length=1)         # 模型标识
    api_base: str | None = None                   # endpoint（OpenAI 系）
    api_key: str | None = None                    # 明文；None=不改，非空=写入
    supports_thinking: bool = False
    supports_vision: bool = False
    supports_reasoning_effort: bool = False

    @classmethod
    def normalize_api_key(cls, value: str | None) -> str | None:
        return value if value else None


class ModelItem(BaseModel):
    """返回给前端的模型条目。api_key_env 是 $ENV 引用，非明文。"""
    name: str
    display_name: str | None = None
    description: str | None = None
    use: str
    model: str
    api_base: str | None = None
    api_key_env: str | None = None
    supports_thinking: bool = False
    supports_vision: bool = False
    supports_reasoning_effort: bool = False


# ── 偏好（prefs.json，引擎无关）──────────────────────────────────────

def _load_prefs() -> dict[str, Any]:
    path = _prefs_path()
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8")) or {}
    except json.JSONDecodeError:
        return {}


def _save_prefs(prefs: dict[str, Any]) -> None:
    path = _prefs_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".prefs.", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(prefs, fh, ensure_ascii=False, indent=2)
        os.replace(tmp, path)
    except Exception:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


def get_default_model() -> str | None:
    return _load_prefs().get("default_model")


def set_default_model(name: str | None) -> None:
    prefs = _load_prefs()
    if name is None:
        prefs.pop("default_model", None)
    else:
        prefs["default_model"] = name
    _save_prefs(prefs)
```

同时，修正 `ModelWritePayload.normalize_api_key`——它需要作为 pydantic validator 生效。改为字段 validator：

把上面 `ModelWritePayload` 里的 `normalize_api_key` 方法替换为：

```python
from pydantic import field_validator

class ModelWritePayload(BaseModel):
    # ...（字段同上，去掉 normalize_api_key 方法）
    @field_validator("api_key", mode="before")
    @classmethod
    def _blank_to_none(cls, v):
        return v if v else None
```

（确保 `field_validator` 已从 `pydantic` import）

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /Users/libing/kk_Projects/KStock && uv run pytest tests/test_kstock_models.py -v`
Expected: PASS（11 passed）

- [ ] **Step 5: commit**

```bash
git add scripts/kstock_models.py tests/test_kstock_models.py
git commit -m "feat(kstock_models): Pydantic 负载与 prefs.json 偏好读写"
```

---

## Task 5: CRUD 端点实现

**Files:**
- Modify: `scripts/kstock_models.py`
- Test: `tests/test_kstock_models.py`

- [ ] **Step 1: 追加失败测试——CRUD 端点（用 TestClient）**

在 `tests/test_kstock_models.py` 末尾追加：

```python
from fastapi import FastAPI
from fastapi.testclient import TestClient

from scripts.kstock_models import router


def _client_under(tmp_path, monkeypatch, models_yaml="models: []\n") -> TestClient:
    _setup_data_root(tmp_path, monkeypatch, models_yaml=models_yaml)
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def test_list_models_empty(tmp_path, monkeypatch):
    client = _client_under(tmp_path, monkeypatch)
    resp = client.get("/api/v1/kstock/models")
    assert resp.status_code == 200
    assert resp.json() == {"models": [], "default_model": None}


def test_create_model_writes_yaml_and_secret(tmp_path, monkeypatch):
    client = _client_under(tmp_path, monkeypatch)
    resp = client.post("/api/v1/kstock/models", json={
        "name": "deepseek",
        "use": "qilin.models.patched_deepseek:PatchedChatDeepSeek",
        "model": "deepseek-v4",
        "api_base": "https://api.deepseek.com",
        "api_key": "sk-real",
        "supports_thinking": True,
    })
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "deepseek"
    assert body["api_key_env"] == "$KSTOCK_MODEL_DEEPSEEK_KEY"
    # 明文没出现在 yaml
    yaml_text = _runtime_config_path_under(tmp_path).read_text(encoding="utf-8")
    assert "sk-real" not in yaml_text
    assert "$KSTOCK_MODEL_DEEPSEEK_KEY" in yaml_text
    # 明文出现在 secrets.env
    env_text = (tmp_path / "config" / "secrets.env").read_text(encoding="utf-8")
    assert 'KSTOCK_MODEL_DEEPSEEK_KEY="sk-real"' in env_text


def test_create_model_duplicate_409(tmp_path, monkeypatch):
    client = _client_under(tmp_path, monkeypatch)
    payload = {"name": "a", "use": "p:Q", "model": "m"}
    client.post("/api/v1/kstock/models", json=payload)
    resp = client.post("/api/v1/kstock/models", json=payload)
    assert resp.status_code == 409


def test_update_model_keeps_empty_api_key_unchanged(tmp_path, monkeypatch):
    client = _client_under(tmp_path, monkeypatch)
    client.post("/api/v1/kstock/models", json={
        "name": "a", "use": "p:Q", "model": "m", "api_key": "sk-old"
    })
    resp = client.put("/api/v1/kstock/models/a", json={
        "name": "a", "use": "p:Q", "model": "m2", "api_key": ""
    })
    assert resp.status_code == 200
    env_text = (tmp_path / "config" / "secrets.env").read_text(encoding="utf-8")
    assert 'KSTOCK_MODEL_A_KEY="sk-old"' in env_text


def test_delete_model_removes_yaml_and_secret(tmp_path, monkeypatch):
    client = _client_under(tmp_path, monkeypatch)
    client.post("/api/v1/kstock/models", json={
        "name": "a", "use": "p:Q", "model": "m", "api_key": "sk-x"
    })
    resp = client.delete("/api/v1/kstock/models/a")
    assert resp.status_code == 204
    assert client.get("/api/v1/kstock/models").json()["models"] == []
    assert "KSTOCK_MODEL_A_KEY" not in (tmp_path / "config" / "secrets.env").read_text(encoding="utf-8")


def test_default_model_endpoints(tmp_path, monkeypatch):
    client = _client_under(tmp_path, monkeypatch)
    assert client.get("/api/v1/kstock/default-model").json() == {"default_model": None}
    resp = client.put("/api/v1/kstock/default-model", json={"default_model": "a"})
    assert resp.status_code == 200
    assert resp.json() == {"default_model": "a"}
    assert client.get("/api/v1/kstock/default-model").json() == {"default_model": "a"}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /Users/libing/kk_Projects/KStock && uv run pytest tests/test_kstock_models.py -v`
Expected: FAIL（端点未实现，路由 404 / AttributeError）

- [ ] **Step 3: 实现 CRUD 端点**

在 `scripts/kstock_models.py` 末尾（`set_default_model` 之后）追加：

```python
# ── 内部转换 ─────────────────────────────────────────────────────────

def _model_to_item(raw: dict[str, Any]) -> ModelItem:
    """runtime.yaml 里的一行 → 返回给前端的 ModelItem（api_key 转 env 引用）。"""
    return ModelItem(
        name=raw["name"],
        display_name=raw.get("display_name"),
        description=raw.get("description"),
        use=raw["use"],
        model=raw["model"],
        api_base=raw.get("api_base"),
        api_key_env=raw.get("api_key"),
        supports_thinking=bool(raw.get("supports_thinking", False)),
        supports_vision=bool(raw.get("supports_vision", False)),
        supports_reasoning_effort=bool(raw.get("supports_reasoning_effort", False)),
    )


def _payload_to_raw(payload: ModelWritePayload) -> dict[str, Any]:
    """前端负载 → runtime.yaml 行；api_key 转为 $ENV 引用。"""
    env_var = env_name_for_model(payload.name)
    raw: dict[str, Any] = {
        "name": payload.name,
        "use": payload.use,
        "model": payload.model,
        "api_key": f"${env_var}",
    }
    if payload.display_name is not None:
        raw["display_name"] = payload.display_name
    if payload.description is not None:
        raw["description"] = payload.description
    if payload.api_base:
        raw["api_base"] = payload.api_base
    if payload.supports_thinking:
        raw["supports_thinking"] = True
    if payload.supports_vision:
        raw["supports_vision"] = True
    if payload.supports_reasoning_effort:
        raw["supports_reasoning_effort"] = True
    return raw


# ── 路由 ───────────────────────────────────────────────────────────────

@router.get("/models")
def list_models_endpoint() -> dict[str, Any]:
    return {"models": [m.model_dump() for m in (_model_to_item(r) for r in load_runtime_models())],
            "default_model": get_default_model()}


@router.post("/models", status_code=201)
def create_model_endpoint(payload: ModelWritePayload) -> ModelItem:
    models = load_runtime_models()
    if any(m.get("name") == payload.name for m in models):
        raise HTTPException(status_code=409, detail=f"模型 '{payload.name}' 已存在")
    models.append(_payload_to_raw(payload))
    save_runtime_models(models)
    if payload.api_key:
        upsert_secret(env_name_for_model(payload.name), payload.api_key)
    return _model_to_item(_payload_to_raw(payload))


@router.put("/models/{name}")
def update_model_endpoint(name: str, payload: ModelWritePayload) -> ModelItem:
    if payload.name != name:
        raise HTTPException(status_code=400, detail="name 不可变更")
    models = load_runtime_models()
    idx = next((i for i, m in enumerate(models) if m.get("name") == name), None)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"模型 '{name}' 不存在")
    models[idx] = _payload_to_raw(payload)
    save_runtime_models(models)
    if payload.api_key:
        upsert_secret(env_name_for_model(payload.name), payload.api_key)
    return _model_to_item(models[idx])


@router.delete("/models/{name}", status_code=204)
def delete_model_endpoint(name: str) -> None:
    models = load_runtime_models()
    filtered = [m for m in models if m.get("name") != name]
    if len(filtered) == len(models):
        raise HTTPException(status_code=404, detail=f"模型 '{name}' 不存在")
    save_runtime_models(filtered)
    # secrets.env 删对应 key（找不到无副作用）
    try:
        remove_secret(env_name_for_model(name))
    except ValueError:
        pass


class DefaultModelPayload(BaseModel):
    default_model: str | None = None


@router.get("/default-model")
def get_default_model_endpoint() -> dict[str, Any]:
    return {"default_model": get_default_model()}


@router.put("/default-model")
def set_default_model_endpoint(payload: DefaultModelPayload) -> dict[str, Any]:
    set_default_model(payload.default_model)
    return {"default_model": get_default_model()}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /Users/libing/kk_Projects/KStock && uv run pytest tests/test_kstock_models.py -v`
Expected: PASS（17 passed）

- [ ] **Step 5: commit**

```bash
git add scripts/kstock_models.py tests/test_kstock_models.py
git commit -m "feat(kstock_models): 模型 CRUD 与默认模型偏好端点"
```

---

## Task 6: run_gateway.py 挂载路由

**Files:**
- Modify: `scripts/run_gateway.py`

- [ ] **Step 1: 写一次性验证脚本（手动验证 import 链）**

无需自动化测试——本任务是无逻辑的挂载，用手动 curl 验证。先确认导入无误：

Run: `cd /Users/libing/kk_Projects/KStock && uv run python -c "from scripts.kstock_models import router; print(router.prefix, len(router.routes))"`
Expected: 输出 `/api/v1/kstock 7`

- [ ] **Step 2: 修改 create_app 注入路由**

修改 `scripts/run_gateway.py` 的 `create_app()`，在 `from app.gateway.app import create_app as _create_app` 与 `return _create_app()` 之间插入挂载逻辑：

```python
    from app.gateway.app import create_app as _create_app

    app = _create_app()

    # KStock 自有的模型配置写入层（vendor 引擎只读，本路由提供 CRUD）
    from scripts.kstock_models import router as kstock_models_router

    app.include_router(kstock_models_router)
    return app
```

（替换原来的 `return _create_app()`）

- [ ] **Step 3: 重启 gateway 并 curl 验证端点可达**

Run: `cd /Users/libing/kk_Projects/KStock && uv run python scripts/run_gateway.py &` 然后等 3 秒，再：
```
curl -s http://localhost:18001/api/v1/kstock/models
```
Expected: `{"models":[],"default_model":null}`

- [ ] **Step 4: commit**

```bash
git add scripts/run_gateway.py
git commit -m "feat(gateway): 挂载 KStock 模型配置写入路由"
```

---

## Task 7: 前端 modelsClient.ts

**Files:**
- Create: `apps/desktop/src/lib/modelsClient.ts`

- [ ] **Step 1: 写类型与全部 API 函数**

创建 `apps/desktop/src/lib/modelsClient.ts`：

```typescript
/**
 * KStock 模型配置 API 客户端 —— 对接 KStock 自有的 /api/v1/kstock/models。
 *
 * 与 authClient.ts 共享 GATEWAY_URL、cookie/credentials 策略，但错误码体系
 * 独立（模型配置不涉及认证错误码）。引擎原生 GET /api/models 只读且不返回
 * provider/endpoint/api_key，本客户端对接的 KStock 写入层补齐这些字段。
 */
import { GATEWAY_URL } from "./gatewayUrl";

/** 一条模型配置（对应后端 ModelItem）。api_key_env 是 $ENV 引用而非明文。 */
export interface ModelConfig {
  name: string;
  display_name: string | null;
  description: string | null;
  use: string;
  model: string;
  api_base: string | null;
  api_key_env: string | null;
  supports_thinking: boolean;
  supports_vision: boolean;
  supports_reasoning_effort: boolean;
}

/** 创建/编辑模型时的负载。api_key 留空（或 null）表示不修改。 */
export interface ModelWritePayload {
  name: string;
  display_name?: string | null;
  description?: string | null;
  use: string;
  model: string;
  api_base?: string | null;
  api_key?: string | null;
  supports_thinking?: boolean;
  supports_vision?: boolean;
  supports_reasoning_effort?: boolean;
}

/** listModels 响应。 */
export interface ModelsListResponse {
  models: ModelConfig[];
  default_model: string | null;
}

/** 归一化错误。 */
export interface ModelsApiError {
  message: string;
  status: number;
}

async function modelsFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const csrf = readCsrfToken();
  if (csrf && !headers.has("X-CSRF-Token")) {
    headers.set("X-CSRF-Token", csrf);
  }
  let response: Response;
  try {
    response = await fetch(`${GATEWAY_URL}${path}`, { ...init, headers, credentials: "include" });
  } catch {
    throw { message: "无法连接本地引擎，请确认 gateway 已启动", status: 0 } satisfies ModelsApiError;
  }
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = { detail: text }; }
  }
  if (!response.ok) {
    const detail = (body as { detail?: unknown })?.detail;
    const message = typeof detail === "string" ? detail
      : (detail && typeof detail === "object" && "message" in detail) ? String((detail as { message: unknown }).message)
      : typeof detail === "string" ? detail
      : "操作失败，请稍后重试";
    throw { message, status: response.status } satisfies ModelsApiError;
  }
  return body as T;
}

function readCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// ── API ─────────────────────────────────────────────────────────────

export function listModels(): Promise<ModelsListResponse> {
  return modelsFetch<ModelsListResponse>("/api/v1/kstock/models");
}

export function createModel(payload: ModelWritePayload): Promise<ModelConfig> {
  return modelsFetch<ModelConfig>("/api/v1/kstock/models", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateModel(name: string, payload: ModelWritePayload): Promise<ModelConfig> {
  return modelsFetch<ModelConfig>(`/api/v1/kstock/models/${encodeURIComponent(name)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteModel(name: string): Promise<void> {
  await modelsFetch<void>(`/api/v1/kstock/models/${encodeURIComponent(name)}`, { method: "DELETE" });
}

export function getDefaultModel(): Promise<{ default_model: string | null }> {
  return modelsFetch<{ default_model: string | null }>("/api/v1/kstock/default-model");
}

export function setDefaultModel(name: string | null): Promise<{ default_model: string | null }> {
  return modelsFetch<{ default_model: string | null }>("/api/v1/kstock/default-model", {
    method: "PUT",
    body: JSON.stringify({ default_model: name }),
  });
}

export function isModelsApiError(err: unknown): err is ModelsApiError {
  return typeof err === "object" && err !== null && "message" in err && "status" in err;
}
```

- [ ] **Step 2: 抽取共享 GATEWAY_URL**

`modelsClient.ts` import 自 `./gatewayUrl`，但该模块还不存在。authClient 目前在自身定义了 `GATEWAY_URL`。抽取共享模块避免重复：

创建 `apps/desktop/src/lib/gatewayUrl.ts`：

```typescript
/** gateway 基地址（与 authClient 共享）。打包态可经 VITE_GATEWAY_URL 覆盖。 */
export const GATEWAY_URL: string =
  (import.meta.env.VITE_GATEWAY_URL as string | undefined) ?? "http://localhost:18001";
```

并修改 `authClient.ts`：删除其内部的 `GATEWAY_URL` 定义，改为顶部 `import { GATEWAY_URL } from "./gatewayUrl";`

- [ ] **Step 3: tsc 确认**

Run: `cd /Users/libing/kk_Projects/KStock/apps/desktop && ./node_modules/.bin/tsc --noEmit -p tsconfig.json`
Expected: 无错误

- [ ] **Step 4: commit**

```bash
git add apps/desktop/src/lib/modelsClient.ts apps/desktop/src/lib/gatewayUrl.ts apps/desktop/src/lib/authClient.ts
git commit -m "feat(desktop): modelsClient 与共享 gatewayUrl"
```

---

## Task 8: ModelSettings 组件重构（CRUD UI）

**Files:**
- Modify: `apps/desktop/src/pages/Home.tsx`
- Modify: `apps/desktop/src/styles.css`

- [ ] **Step 1: 重写 ModelSettings 为 CRUD**

在 `apps/desktop/src/pages/Home.tsx`，找到现有 `function ModelSettings() { ... }`（约 line 861-919），整段替换为：

```tsx
function ModelSettings() {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [defaultModel, setDefaultModelState] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addTemplate, setAddTemplate] = useState<typeof MODEL_TEMPLATES[number] | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listModels();
      setModels(data.models);
      setDefaultModelState(data.default_model);
      if (data.models.length > 0 && !selectedName) {
        setSelectedName(data.models[0].name);
      }
    } catch (err) {
      setError(isModelsApiError(err) ? err.message : "加载模型失败");
    } finally {
      setLoading(false);
    }
  }, [selectedName]);

  useEffect(() => {
    reload();
  }, [reload]);

  const selected = models.find((m) => m.name === selectedName) ?? null;

  const handleDelete = async (name: string) => {
    if (!window.confirm(`确认删除模型「${name}」？相关 API key 也会从 secrets.env 移除。`)) return;
    try {
      await deleteModel(name);
      if (selectedName === name) setSelectedName(null);
      await reload();
    } catch (err) {
      setError(isModelsApiError(err) ? err.message : "删除失败");
    }
  };

  const handleSetDefault = async (name: string | null) => {
    try {
      await setDefaultModel(name);
      setDefaultModelState(name);
    } catch (err) {
      setError(isModelsApiError(err) ? err.message : "设置默认模型失败");
    }
  };

  if (loading) {
    return <div className="model-settings"><p className="model-loading">加载模型配置…</p></div>;
  }

  return (
    <div className="model-settings">
      {error && <p className="auth-error" role="alert">{error}</p>}

      <section className="settings-card model-list-card" aria-label="模型列表">
        <div className="model-list-header">
          <strong>已配置模型</strong>
          <button className="pill-control" type="button" onClick={() => { setAddTemplate(null); setAdding(true); }}>+ 添加模型</button>
        </div>
        {models.length === 0 ? (
          <p className="model-empty">尚未配置任何模型。点击「添加模型」，从模板创建或自定义一个。</p>
        ) : (
          <ul className="model-list">
            {models.map((m) => (
              <li
                key={m.name}
                className={m.name === selectedName ? "active" : ""}
                onClick={() => setSelectedName(m.name)}
              >
                <div>
                  <strong>{m.display_name || m.name}</strong>
                  <span>{m.use}</span>
                </div>
                <div className="model-badges">
                  {m.supports_thinking && <em>思考</em>}
                  {m.supports_vision && <em>视觉</em>}
                  {defaultModel === m.name && <em className="default">默认</em>}
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleSetDefault(m.name); }} aria-label="设为默认">设默认</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <ModelEditor
          key={selected.name}
          model={selected}
          onSave={async (payload) => {
            try {
              await updateModel(selected.name, payload);
              await reload();
            } catch (err) {
              setError(isModelsApiError(err) ? err.message : "保存失败");
            }
          }}
          onDelete={() => handleDelete(selected.name)}
        />
      )}

      {adding && (
        <ModelAddDialog
          initialTemplate={addTemplate}
          onPickTemplate={(t) => setAddTemplate(t)}
          onCancel={() => setAdding(false)}
          onSubmit={async (payload) => {
            try {
              await createModel(payload);
              setAdding(false);
              await reload();
            } catch (err) {
              setError(isModelsApiError(err) ? err.message : "添加失败");
            }
          }}
        />
      )}
    </div>
  );
}

/** 单个模型编辑面板。 */
function ModelEditor({ model, onSave, onDelete }: {
  model: ModelConfig;
  onSave: (payload: ModelWritePayload) => Promise<void>;
  onDelete: () => void;
}) {
  const [displayName, setDisplayName] = useState(model.display_name ?? "");
  const [useClass, setUseClass] = useState(model.use);
  const [modelName, setModelName] = useState(model.model);
  const [apiBase, setApiBase] = useState(model.api_base ?? "");
  const [apiKey, setApiKey] = useState("");  // 留空=不修改
  const [thinking, setThinking] = useState(model.supports_thinking);
  const [vision, setVision] = useState(model.supports_vision);
  const [reasoningEffort, setReasoningEffort] = useState(model.supports_reasoning_effort);
  const [saving, setSaving] = useState(false);

  return (
    <section className="settings-card model-editor" aria-label="编辑模型">
      <h3>{model.name}</h3>
      <label><span>display_name</span><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
      <label><span>use（provider class）</span><input value={useClass} onChange={(e) => setUseClass(e.target.value)} /></label>
      <label><span>model</span><input value={modelName} onChange={(e) => setModelName(e.target.value)} /></label>
      <label><span>api_base</span><input value={apiBase} onChange={(e) => setApiBase(e.target.value)} /></label>
      <label><span>api_key{model.api_key_env ? `（已配置 ${model.api_key_env}）` : ""}</span>
        <input type="password" placeholder="留空不修改" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
      </label>
      <div className="capability-row">
        <label className="auth-remember"><input type="checkbox" checked={thinking} onChange={(e) => setThinking(e.target.checked)} /><span>Thinking</span></label>
        <label className="auth-remember"><input type="checkbox" checked={vision} onChange={(e) => setVision(e.target.checked)} /><span>Vision</span></label>
        <label className="auth-remember"><input type="checkbox" checked={reasoningEffort} onChange={(e) => setReasoningEffort(e.target.checked)} /><span>Reasoning Effort</span></label>
      </div>
      <div className="model-editor-actions">
        <button className="hero-primary" type="button" disabled={saving} onClick={async () => {
          setSaving(true);
          try {
            await onSave({
              name: model.name,
              display_name: displayName || null,
              use: useClass,
              model: modelName,
              api_base: apiBase || null,
              api_key: apiKey || null,
              supports_thinking: thinking,
              supports_vision: vision,
              supports_reasoning_effort: reasoningEffort,
            });
          } finally { setSaving(false); }
        }}>{saving ? "保存中…" : "保存"}</button>
        <button className="link-button" type="button" onClick={onDelete}>删除模型</button>
      </div>
    </section>
  );
}

/** 添加模型弹层：先选模板或空白，再填表单。 */
function ModelAddDialog({ initialTemplate, onPickTemplate, onCancel, onSubmit }: {
  initialTemplate: typeof MODEL_TEMPLATES[number] | null;
  onPickTemplate: (t: typeof MODEL_TEMPLATES[number] | null) => void;
  onCancel: () => void;
  onSubmit: (payload: ModelWritePayload) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [useClass, setUseClass] = useState("");
  const [modelName, setModelName] = useState("");
  const [apiBase, setApiBase] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [thinking, setThinking] = useState(false);
  const [vision, setVision] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialTemplate) {
      const baseName = initialTemplate.id;
      setName(baseName);
      setDisplayName(initialTemplate.name);
      setUseClass(initialTemplate.provider);
      setModelName(initialTemplate.model);
      setApiBase(initialTemplate.endpointKey === "native" ? "" : initialTemplate.endpoint);
      setThinking(initialTemplate.thinking);
      setVision(initialTemplate.vision);
    }
  }, [initialTemplate]);

  return (
    <section className="settings-card model-add-dialog" aria-label="添加模型">
      <div className="model-list-header">
        <strong>添加模型</strong>
        <button className="link-button" type="button" onClick={onCancel}>取消</button>
      </div>
      {!initialTemplate && (
        <div className="template-picker">
          <p className="model-empty">从模板快速创建，或直接空白自定义：</p>
          <div className="template-grid">
            {MODEL_TEMPLATES.map((t) => (
              <button key={t.id} type="button" onClick={() => onPickTemplate(t)}>
                <strong>{t.name}</strong><span>{t.provider}</span>
              </button>
            ))}
            <button type="button" onClick={() => onPickTemplate(MODEL_TEMPLATES[0]}>
              <strong>空白自定义</strong><span>手动填写全部字段</span>
            </button>
          </div>
        </div>
      )}
      {initialTemplate && (
        <>
          <label><span>name（唯一标识）</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label><span>display_name</span><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
          <label><span>use（provider class）</span><input value={useClass} onChange={(e) => setUseClass(e.target.value)} /></label>
          <label><span>model</span><input value={modelName} onChange={(e) => setModelName(e.target.value)} /></label>
          <label><span>api_base</span><input value={apiBase} onChange={(e) => setApiBase(e.target.value)} /></label>
          <label><span>api_key（明文，存入 secrets.env）</span><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} /></label>
          <div className="capability-row">
            <label className="auth-remember"><input type="checkbox" checked={thinking} onChange={(e) => setThinking(e.target.checked)} /><span>Thinking</span></label>
            <label className="auth-remember"><input type="checkbox" checked={vision} onChange={(e) => setVision(e.target.checked)} /><span>Vision</span></label>
          </div>
          <button className="hero-primary" type="button" disabled={submitting} onClick={async () => {
            if (!name || !useClass || !modelName) return;
            setSubmitting(true);
            try {
              await onSubmit({
                name, display_name: displayName || null,
                use: useClass, model: modelName,
                api_base: apiBase || null, api_key: apiKey || null,
                supports_thinking: thinking, supports_vision: vision,
              });
            } finally { setSubmitting(false); }
          }}>{submitting ? "提交中…" : "创建"}</button>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 2: 更新 imports**

在 `Home.tsx` 顶部 import 区，补充：

```tsx
import {
  createModel,
  deleteModel,
  isModelsApiError,
  listModels,
  setDefaultModel,
  updateModel,
  type ModelConfig,
  type ModelWritePayload,
} from "../lib/modelsClient";
```

并确保 `useCallback` 已从 `react` import（当前已有 `useState / useEffect`，补 `useCallback`）。

- [ ] **Step 3: 追加 CSS**

在 `apps/desktop/src/styles.css` 末尾追加：

```css
/* 模型配置 CRUD */
.model-settings { display: grid; gap: 16px; }
.model-loading, .model-empty { color: #a9afb8; font-size: 13px; padding: 16px 0; }

.model-list-card { padding: 16px; }
.model-list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.model-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 4px; }
.model-list li { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 8px; cursor: pointer; }
.model-list li:hover { background: rgba(255,255,255,0.04); }
.model-list li.active { background: rgba(99,102,241,0.16); }
.model-list li strong { display: block; font-size: 13px; }
.model-list li span { display: block; font-size: 11px; color: #6b7280; font-family: var(--font-mono, monospace); }
.model-badges { display: flex; gap: 6px; align-items: center; }
.model-badges em { font-style: normal; font-size: 11px; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.06); color: #a9afb8; }
.model-badges em.default { background: rgba(16,185,129,0.18); color: #6ee7b7; }
.model-badges button { font-size: 11px; padding: 2px 8px; }

.model-editor { padding: 16px; display: grid; gap: 12px; }
.model-editor h3 { margin: 0; font-size: 15px; }
.model-editor label { display: grid; gap: 4px; font-size: 12px; color: #a9afb8; }
.model-editor input { font-family: var(--font-mono, monospace); font-size: 13px; }
.model-editor-actions { display: flex; justify-content: space-between; align-items: center; }

.model-add-dialog { padding: 16px; display: grid; gap: 12px; }
.template-picker .template-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.template-picker .template-grid button { display: grid; gap: 2px; padding: 10px; text-align: left; border-radius: 8px; }
```

- [ ] **Step 4: tsc + vitest 确认**

Run: `cd /Users/libing/kk_Projects/KStock/apps/desktop && ./node_modules/.bin/tsc --noEmit -p tsconfig.json && ./node_modules/.bin/vitest run`
Expected: tsc 无错误；vitest 现有 4 个测试通过（modelsClient 被 mock 前，因 ModelSettings 未在测试中渲染，不影响）

- [ ] **Step 5: commit**

```bash
git add apps/desktop/src/pages/Home.tsx apps/desktop/src/styles.css
git commit -m "feat(desktop): ModelSettings 重构为真实 CRUD"
```

---

## Task 9: 输入框模型选择器

**Files:**
- Modify: `apps/desktop/src/pages/Home.tsx`
- Modify: `apps/desktop/src/lib/sessionStore.ts`
- Test: `apps/desktop/tests/App.spec.tsx`

- [ ] **Step 1: 扩展 sessionStore 支持 model 元数据**

修改 `apps/desktop/src/lib/sessionStore.ts` 的 `ChatMessage` 接口，加可选 `model` 字段：

```typescript
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  /** 用户消息关联的模型选择（用于后续对接引擎 run）。 */
  model?: string;
}
```

修改 `createMessage`：

```typescript
function createMessage(role: ChatRole, content: string, model?: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: nowIso(),
    ...(model ? { model } : {}),
  };
}
```

修改 `appendMessageToSession` 签名，透传 model：

```typescript
export function appendMessageToSession(
  session: ChatSession,
  role: ChatRole,
  content: string,
  model?: string,
): ChatSession {
  const nextMessages = [...session.messages, createMessage(role, content, model)];
  const nextTitle = session.messages.length === 0 && role === "user" ? content.slice(0, 18) : session.title;
  return {
    ...session,
    title: nextTitle,
    updatedAt: nowLabel(),
    messages: nextMessages,
  };
}
```

- [ ] **Step 2: 在 WorkspaceShell 加选择器 state 与 UI**

在 `Home.tsx` 的 `WorkspaceShell` 组件（约 line 568）内加 state，并改 `onSend` 签名。先看现有 `WorkspaceShellProps`：

找到 `onSend: () => void;` 改为 `onSend: (model: string) => void;`。

在 `WorkspaceShell` 函数体内（其他 useState 旁）加：

```tsx
const [models, setModels] = useState<ModelConfig[]>([]);
const [activeModel, setActiveModel] = useState<string>("");
const [modelsLoading, setModelsLoading] = useState(true);

// 启动时加载模型列表，确定初始 activeModel
useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      const stored = localStorage.getItem("kstock.activeModel");
      const data = await listModels();
      if (cancelled) return;
      setModels(data.models);
      const initial = stored && data.models.some((m) => m.name === stored)
        ? stored
        : data.default_model && data.models.some((m) => m.name === data.default_model)
          ? data.default_model
          : data.models[0]?.name ?? "";
      setActiveModel(initial);
    } catch {
      // gateway 未就绪：保持空，选择器显示「未配置」
    } finally {
      if (!cancelled) setModelsLoading(false);
    }
  })();
  return () => { cancelled = true; };
}, []);

const handleModelChange = (name: string) => {
  setActiveModel(name);
  localStorage.setItem("kstock.activeModel", name);
};
```

修改底部发送逻辑——找到 `<button className="send-button" ... onClick={onSend}>`，改为：

```tsx
<button
  className="send-button"
  type="button"
  onClick={() => onSend(activeModel)}
  disabled={!activeModel}
  aria-label="发送消息"
>
  <Send size={18} />
</button>
```

并在 `composer-toolbar` 内（"QiLin 已连接" 之后、send-button 之前）插入选择器：

```tsx
{modelsLoading ? (
  <span className="model-picker loading">模型加载中…</span>
) : models.length === 0 ? (
  <span className="model-picker empty">未配置模型（请到设置页添加）</span>
) : (
  <label className="model-picker">
    <Cpu size={15} />
    <select value={activeModel} onChange={(e) => handleModelChange(e.target.value)}>
      {models.map((m) => (
        <option key={m.name} value={m.name}>{m.display_name || m.name}</option>
      ))}
    </select>
  </label>
)}
```

- [ ] **Step 3: 修改 Home 组件的 handleSend 接收 model**

在 `Home` 组件内找到 `const handleSend = () => {`，改为：

```tsx
const handleSend = (model: string) => {
  const input = draft.trim();
  if (!input || !activeSession || !model) {
    return;
  }

  const assistantReply = synthesizeAssistantReply(input);
  setSessions((current) =>
    current.map((session) => {
      if (session.id !== activeSession.id) {
        return session;
      }
      const nextSession = appendMessageToSession(session, "user", input, model);
      const withAssistant = appendMessageToSession(nextSession, "assistant", assistantReply.message);
      return {
        ...withAssistant,
        reportMarkdown: buildReportMarkdown({
          ...withAssistant,
          activeSkills: assistantReply.activeSkills
        }),
        activeSkills: assistantReply.activeSkills
      };
    })
```

并把传递 `onSend={handleSend}` 的地方保持不变（签名已对齐）。

- [ ] **Step 4: 补 CSS**

在 `apps/desktop/src/styles.css` 的 `.composer-toolbar` 规则之后追加：

```css
.model-picker { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #a9afb8; }
.model-picker select { background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: inherit; font-size: 12px; padding: 2px 6px; }
.model-picker.empty { color: #f59e0b; }
.model-picker.loading { opacity: 0.6; }
.send-button:disabled { opacity: 0.4; cursor: not-allowed; }
```

- [ ] **Step 5: 更新测试 mock 与断言**

修改 `apps/desktop/tests/App.spec.tsx`，在 `vi.mock("../src/lib/authClient", ...)` 之后追加 modelsClient mock：

```tsx
vi.mock("../src/lib/modelsClient", () => ({
  listModels: vi.fn().mockResolvedValue({ models: [], default_model: null }),
  createModel: vi.fn(),
  updateModel: vi.fn(),
  deleteModel: vi.fn(),
  getDefaultModel: vi.fn().mockResolvedValue({ default_model: null }),
  setDefaultModel: vi.fn().mockResolvedValue({ default_model: null }),
  isModelsApiError: (e: unknown) =>
    typeof e === "object" && e !== null && "message" in e && "status" in e,
}));
```

现有"已登录启动后直接进入工作台"测试因发送按钮现在依赖 model（mock 返回空列表→按钮禁用），不会触发新逻辑，应仍通过。新增一个模型选择器测试：

```tsx
test("无模型时输入框选择器显示未配置且发送禁用", async () => {
  authMock.tryGetCurrentUser.mockResolvedValueOnce({
    id: "u1", email: "t@k.dev", system_role: "user",
  });
  render(<App />);

  expect(await screen.findByRole("textbox", { name: "消息输入" })).toBeVisible();
  expect(screen.getByText("未配置模型（请到设置页添加）")).toBeVisible();
  expect(screen.getByRole("button", { name: "发送消息" })).toBeDisabled();
});
```

- [ ] **Step 6: tsc + vitest**

Run: `cd /Users/libing/kk_Projects/KStock/apps/desktop && ./node_modules/.bin/tsc --noEmit -p tsconfig.json && ./node_modules/.bin/vitest run`
Expected: tsc 无错误；vitest 全部通过

- [ ] **Step 7: commit**

```bash
git add apps/desktop/src/pages/Home.tsx apps/desktop/src/lib/sessionStore.ts apps/desktop/src/styles.css apps/desktop/tests/App.spec.tsx
git commit -m "feat(desktop): 输入框模型选择器与会话级 model 记录"
```

---

## Task 10: 端到端验证（Playwright）

**Files:** 无（手动验证 + 记录）

- [ ] **Step 1: 启动 gateway 与 vite dev**

Run（两个终端）:
```
cd /Users/libing/kk_Projects/KStock && uv run python scripts/run_gateway.py
cd /Users/libing/kk_Projects/KStock/apps/desktop && pnpm dev
```

- [ ] **Step 2: 浏览器走完整流程**

访问 http://localhost:1420：
1. 登录已有账户进入工作台
2. 输入框选择器显示「未配置模型（请到设置页添加）」，发送按钮禁用
3. 打开设置 → 模型 → 点「+ 添加模型」→ 选 deepseek 模板 → 填 name=deepseek-test / api_key=sk-fake → 创建
4. 列表出现 deepseek-test；点「设默认」
5. 返回工作台 → 选择器出现 deepseek-test；输入消息发送；消息发送成功
6. 刷新页面 → 选择器记忆 deepseek-test（localStorage）
7. 设置页编辑 deepseek-test 改 display_name → 保存 → 列表更新
8. 设置页删除 deepseek-test → 确认 → 列表为空；工作台选择器变回「未配置」

- [ ] **Step 3: 验证 runtime.yaml 与 secrets.env 内容**

Run:
```
cat "$HOME/Library/Application Support/KStock/config/qilin.runtime.yaml" | grep -A8 "models:"
cat "$HOME/Library/Application Support/KStock/config/secrets.env"
```
Expected: runtime.yaml 含 `api_key: $KSTOCK_MODEL_DEEPSEEK_TEST_KEY`（非明文）；secrets.env 含明文（仅删除前）

- [ ] **Step 4: 停 vite（保留 gateway）**

Run: `pkill -f vite`

- [ ] **Step 5: 记录验证结果到 commit message（无代码改动则跳过 commit）**

如端到端发现问题，回到对应 Task 修复。无问题则进入文档。

---

## Task 11: 文档（配置说明 + 运行说明）

**Files:**
- Modify: `docs/配置说明.md`
- Modify: `docs/运行说明.md`

- [ ] **Step 1: 在配置说明.md 末尾追加「模型配置」章节**

先读现有内容确认风格：`docs/配置说明.md`。

在文件末尾追加：

```markdown
## 模型配置

KStock 通过设置页「模型」管理 AI 模型配置，配置写入用户数据空间的两个文件：

- `<数据根>/config/qilin.runtime.yaml` 的 `models:` 段 —— 模型定义（provider、endpoint、能力等）
- `<数据根>/config/secrets.env` —— API key 明文（权限 600），runtime.yaml 只存 `$ENV_VAR` 引用

### 添加模型

1. 设置 → 模型 → 点「+ 添加模型」
2. 从模板快速创建（预填 provider class、endpoint、能力），或选「空白自定义」
3. 填 name（唯一标识）、model（模型标识）、api_key（明文，存入 secrets.env）
4. 创建后即时生效——引擎检测 runtime.yaml mtime 变化自动热重载，无需重启

### 环境变量命名规则

API key 存为环境变量 `KSTOCK_MODEL_<UPPER_NAME>_KEY`，name 转大写、非字母数字转下划线。例如：
- `deepseek-v4` → `KSTOCK_MODEL_DEEPSEEK_V4_KEY`
- `glm.5.2` → `KSTOCK_MODEL_GLM_5_2_KEY`

### 默认模型

「默认模型」是 KStock 前端偏好（引擎 AppConfig 无此字段），存 `<数据根>/config/prefs.json`。输入框模型选择器启动时读它作为初始值，用户可随时切换，切换结果持久化到 localStorage。

### 输入框模型选择器

工作台消息输入框的工具栏有模型下拉，从已配置模型中选用本次会话使用的模型。未配置任何模型时发送按钮禁用。
```

- [ ] **Step 2: 在运行说明.md 的首次运行流程补「配置模型」**

找到首次运行流程章节（参考 docs/首次运行.md 第 4-5 节风格），在「创建账户」之后、「开始使用」之前插入：

```markdown
## 配置模型

首次进入工作台后，输入框模型选择器会显示「未配置模型」。至少添加一个模型才能发起研究：

1. 设置 → 模型 → 「+ 添加模型」
2. 选模板（如 DeepSeek）→ 填 API key → 创建
3. 返回工作台，选择器出现该模型，即可发送消息

详见《配置说明》的「模型配置」章节。
```

- [ ] **Step 3: commit**

```bash
git add docs/配置说明.md docs/运行说明.md
git commit -m "docs: 模型配置说明与首次运行配置步骤"
```

---

## Task 12: 开发进度文档

**Files:**
- Create: `docs/开发进度.md`

- [ ] **Step 1: 创建开发进度.md，统计所有已交付功能**

创建 `docs/开发进度.md`：

```markdown
# 开发进度

> 截至 2026-07-31 的已交付功能清单。按交付阶段组织，标注涉及模块与状态。

## 阶段一：用户数据空间治理（已合并 main，commit a4a994e）

| 功能 | 涉及模块 | 状态 |
|------|----------|------|
| 跨平台用户数据根目录解析（macOS / Windows / Linux） | `scripts/run_gateway.py` | ✅ |
| 运行时配置生成（qilin.runtime.yaml 显式写入 SQLite 绝对路径） | `scripts/run_gateway.py` | ✅ |
| 修复数据库错误落到项目根 .qilin/ 的问题 | `scripts/run_gateway.py` | ✅ |
| 目录结构建立（config / runtime / logs / product / backups） | `scripts/run_gateway.py` | ✅ |
| .gitignore 防御性忽略 .qilin/ / .kstock/ | `.gitignore` | ✅ |

文档：`docs/用户数据空间组织设计.md`

## 阶段二：桌面端认证闭环（已合并 main，commit a6f933b）

| 功能 | 涉及模块 | 状态 |
|------|----------|------|
| 内置 QiLin gateway（uv 管理 .venv，editable vendor/qilin） | `scripts/run_gateway.py`, `pyproject.toml` | ✅ |
| gateway CORS（Vite dev + Tauri 全平台 origin） | `scripts/run_gateway.py` | ✅ |
| same-site cookie（gateway 绑 localhost） | `scripts/run_gateway.py` | ✅ |
| 认证 API 客户端（register/login/logout/me/setup-status/initialize） | `apps/desktop/src/lib/authClient.ts` | ✅ |
| 启动会话探测 + 自动跳转工作台 | `apps/desktop/src/pages/Home.tsx` | ✅ |
| 注册分流（首启 /initialize 创建管理员，否则 /register 普通用户） | `apps/desktop/src/pages/Home.tsx` | ✅ |
| 密码确认字段 + 校验 | `apps/desktop/src/pages/Home.tsx` | ✅ |
| 记住我（7 天会话） | `apps/desktop/src/pages/Home.tsx` | ✅ |
| 未登录点「进入工作台」拦截跳登录 | `apps/desktop/src/pages/Home.tsx` | ✅ |
| 侧边栏显示当前邮箱 + 登出按钮 | `apps/desktop/src/pages/Home.tsx` | ✅ |
| 错误码中文归一映射 | `apps/desktop/src/lib/authClient.ts` | ✅ |
| auth-remember 复选框 CSS 错位修复（特异性） | `apps/desktop/src/styles.css` | ✅ |
| gateway 兼容垫片（vendor extensions_config 缺失符号） | `scripts/run_gateway.py` | ✅ |
| main.rs 修复 mod sidecar 悬空引用 | `apps/desktop/src-tauri/src/main.rs` | ✅ |
| sidecar→gateway 架构迁移（删除旧 sidecar 包） | `sidecar/`（已删）, `scripts/run_gateway.py` | ✅ |

文档：`docs/运行说明.md`, `docs/首次运行.md`

## 阶段三：模型配置打通（分支 feat/model-config）

| 功能 | 涉及模块 | 状态 |
|------|----------|------|
| KStock 模型配置写入层（CRUD 端点 + runtime.yaml/secrets.env/prefs.json） | `scripts/kstock_models.py` | ✅ |
| 环境变量命名规则 KSTOCK_MODEL_<NAME>_KEY | `scripts/kstock_models.py` | ✅ |
| 原子替换 + 备份 + secrets.env 600 权限 | `scripts/kstock_models.py` | ✅ |
| gateway 挂载 KStock 写入路由 | `scripts/run_gateway.py` | ✅ |
| 前端 modelsClient.ts（list/create/update/delete/default） | `apps/desktop/src/lib/modelsClient.ts` | ✅ |
| 共享 GATEWAY_URL 抽取 | `apps/desktop/src/lib/gatewayUrl.ts` | ✅ |
| ModelSettings 重构为 CRUD（列表/编辑/添加弹层） | `apps/desktop/src/pages/Home.tsx` | ✅ |
| 输入框模型选择器 + localStorage 持久化 | `apps/desktop/src/pages/Home.tsx` | ✅ |
| 会话消息 model 元数据记录 | `apps/desktop/src/lib/sessionStore.ts` | ✅ |
| 后端 pytest 覆盖 | `tests/test_kstock_models.py` | ✅ |
| 前端 vitest 覆盖 | `apps/desktop/tests/App.spec.tsx` | ✅ |
| 配置说明 + 首次运行文档更新 | `docs/配置说明.md`, `docs/运行说明.md` | ✅ |

设计：`docs/superpowers/specs/2026-07-31-model-config-design.md`

## 待办（后续功能）

- 真正发起引擎 run 的对接（thread_runs 端点、流式响应）
- API key 的 keychain 集成（当前 secrets.env 已够用）
- 模型连通性测试按钮
- 多用户共享模型配置
```

- [ ] **Step 2: commit**

```bash
git add docs/开发进度.md
git commit -m "docs: 开发进度文档统计所有已交付功能"
```

---

## Self-Review 结果

- **Spec 覆盖**：CRUD（Task 5）、secrets.env（Task 3）、原子替换+备份（Task 2）、模板+空白添加（Task 8）、ModelSettings 重构（Task 8）、输入框选择器+localStorage（Task 9）、默认模型偏好（Task 4/5）、测试（Task 5/9/10）、文档（Task 11/12）——全部覆盖
- **占位符**：无 TBD/TODO，每个步骤含完整代码
- **类型一致性**：`ModelConfig` / `ModelWritePayload` / `env_name_for_model` / `appendMessageToSession` 在各 Task 间签名一致；`onSend` 从 `() => void` 改为 `(model: string) => void` 在 Task 9 全链路对齐
- **Spec 调整记录**：调研发现引擎无 `default_model` 顶层字段，已把 spec 的「读写 runtime.yaml default_model」调整为「读写 prefs.json default_model」，Plan 与调整后的 spec 一致
