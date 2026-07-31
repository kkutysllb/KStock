"""KStock 运行时配置读写层 —— sandbox / runtime 段 + 顶层字段测试。

验证 _SECTION_MODELS 扩展（sandbox / token_usage / token_budget）和
_TOP_LEVEL_FIELDS（max_recursion_limit）的 GET/PUT 语义。
"""
import os
from pathlib import Path

import yaml
from fastapi import FastAPI
from fastapi.testclient import TestClient

from scripts.kstock_runtime_config import router


# ── 测试辅助（与 test_kstock_runtime_config.py 一致的模式）────────────


def _setup_data_root(data_root: Path, monkeypatch, yaml_text: str = "") -> Path:
    config_dir = data_root / "config"
    config_dir.mkdir(parents=True, exist_ok=True)
    runtime_cfg = config_dir / "qilin.runtime.yaml"
    runtime_cfg.write_text(yaml_text, encoding="utf-8")
    monkeypatch.setenv("KSTOCK_APP_DATA_DIR", str(data_root))
    monkeypatch.setenv("QILIN_CONFIG_PATH", str(runtime_cfg))
    return data_root


def _client_under(tmp_path, monkeypatch, yaml_text: str = "") -> TestClient:
    _setup_data_root(tmp_path, monkeypatch, yaml_text)
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def _read_yaml(data_root: Path) -> dict:
    cfg_path = data_root / "config" / "qilin.runtime.yaml"
    return yaml.safe_load(cfg_path.read_text(encoding="utf-8")) or {}


# ── GET: 段缺失时返回默认值 ─────────────────────────────────────────


def test_get_returns_sandbox_defaults_when_missing(tmp_path, monkeypatch):
    """sandbox 段缺失时返回兜底默认值（use=LocalSandboxProvider）+ pydantic 默认。"""
    client = _client_under(tmp_path, monkeypatch, yaml_text="")
    resp = client.get("/api/v1/kstock/runtime-config")
    assert resp.status_code == 200
    sandbox = resp.json()["sandbox"]
    assert sandbox["use"] == "qilin.sandbox.local:LocalSandboxProvider"
    assert sandbox["allow_host_bash"] is False
    assert sandbox["bash_command_timeout"] == 600


def test_get_returns_token_usage_budget_defaults_when_missing(tmp_path, monkeypatch):
    """token_usage / token_budget 段缺失时返回 pydantic 默认值。"""
    client = _client_under(tmp_path, monkeypatch, yaml_text="")
    resp = client.get("/api/v1/kstock/runtime-config")
    body = resp.json()
    assert body["token_usage"]["enabled"] is True
    assert body["token_budget"]["enabled"] is False
    assert body["token_budget"]["max_tokens"] == 200000


def test_get_returns_max_recursion_limit_default_when_missing(tmp_path, monkeypatch):
    """max_recursion_limit 缺失时返回引擎默认值 1000。"""
    client = _client_under(tmp_path, monkeypatch, yaml_text="")
    resp = client.get("/api/v1/kstock/runtime-config")
    assert resp.json()["max_recursion_limit"] == 1000


def test_get_reads_existing_sandbox_and_top_level(tmp_path, monkeypatch):
    """yaml 已有 sandbox / max_recursion_limit 时返回文件值。"""
    yaml_text = (
        "sandbox:\n"
        "  use: qilin.sandbox.aio:AioSandboxProvider\n"
        "  allow_host_bash: true\n"
        "  bash_command_timeout: 120\n"
        "max_recursion_limit: 500\n"
    )
    client = _client_under(tmp_path, monkeypatch, yaml_text=yaml_text)
    resp = client.get("/api/v1/kstock/runtime-config")
    body = resp.json()
    assert body["sandbox"]["use"] == "qilin.sandbox.aio:AioSandboxProvider"
    assert body["sandbox"]["allow_host_bash"] is True
    assert body["max_recursion_limit"] == 500


# ── PUT: 标准段写入 ──────────────────────────────────────────────────


def test_put_sandbox_writes_yaml(tmp_path, monkeypatch):
    """PUT sandbox 段后 yaml 含完整配置。"""
    client = _client_under(tmp_path, monkeypatch, yaml_text="")
    resp = client.put("/api/v1/kstock/runtime-config/sandbox", json={
        "use": "qilin.sandbox.local:LocalSandboxProvider",
        "allow_host_bash": True,
        "bash_command_timeout": 300,
    })
    assert resp.status_code == 200
    assert resp.json()["value"]["bash_command_timeout"] == 300

    cfg = _read_yaml(tmp_path)
    assert cfg["sandbox"]["allow_host_bash"] is True
    assert cfg["sandbox"]["bash_command_timeout"] == 300


def test_put_sandbox_preserves_other_sections(tmp_path, monkeypatch):
    """写 sandbox 不影响 database 等其他段。"""
    yaml_text = (
        "database:\n"
        "  backend: sqlite\n"
        "  sqlite_dir: /tmp/data\n"
        "sandbox:\n"
        "  use: qilin.sandbox.local:LocalSandboxProvider\n"
    )
    client = _client_under(tmp_path, monkeypatch, yaml_text=yaml_text)
    client.put("/api/v1/kstock/runtime-config/sandbox", json={
        "use": "qilin.sandbox.local:LocalSandboxProvider",
        "allow_host_bash": False,
    })
    cfg = _read_yaml(tmp_path)
    # database 段原样保留
    assert cfg["database"]["backend"] == "sqlite"
    assert cfg["database"]["sqlite_dir"] == "/tmp/data"


def test_put_token_budget_validation(tmp_path, monkeypatch):
    """max_tokens < 1000 时 pydantic 校验返回 400。"""
    client = _client_under(tmp_path, monkeypatch, yaml_text="")
    resp = client.put("/api/v1/kstock/runtime-config/token_budget", json={
        "enabled": True,
        "max_tokens": 100,  # < 1000, violates ge=1000
    })
    assert resp.status_code == 400
    detail = resp.json()["detail"]
    assert detail["code"] == "validation_failed"
    assert any("max_tokens" in e["field"] for e in detail["errors"])


# ── PUT: 顶层字段 ───────────────────────────────────────────────────


def test_put_max_recursion_limit_writes_top_level(tmp_path, monkeypatch):
    """PUT max_recursion_limit 写到 yaml 根级（不在 section 内）。"""
    yaml_text = "sandbox:\n  use: qilin.sandbox.local:LocalSandboxProvider\n"
    client = _client_under(tmp_path, monkeypatch, yaml_text=yaml_text)
    resp = client.put("/api/v1/kstock/runtime-config/max_recursion_limit", json={
        "max_recursion_limit": 2000,
    })
    assert resp.status_code == 200
    assert resp.json()["value"]["max_recursion_limit"] == 2000

    cfg = _read_yaml(tmp_path)
    # 写在根级，不是嵌套
    assert cfg["max_recursion_limit"] == 2000
    # sandbox 段不受影响
    assert cfg["sandbox"]["use"] == "qilin.sandbox.local:LocalSandboxProvider"


def test_put_max_recursion_limit_validation(tmp_path, monkeypatch):
    """非整数或 < 1 时返回 400 + 字段明细。"""
    client = _client_under(tmp_path, monkeypatch, yaml_text="")

    # 类型错误
    resp = client.put("/api/v1/kstock/runtime-config/max_recursion_limit", json={
        "max_recursion_limit": "not-a-number",
    })
    assert resp.status_code == 400
    assert resp.json()["detail"]["code"] == "validation_failed"

    # 约束错误：< 1
    resp = client.put("/api/v1/kstock/runtime-config/max_recursion_limit", json={
        "max_recursion_limit": 0,
    })
    assert resp.status_code == 400
    detail = resp.json()["detail"]
    assert detail["code"] == "validation_failed"
    assert any(e["field"] == "max_recursion_limit" for e in detail["errors"])


def test_response_includes_all_new_fields(tmp_path, monkeypatch):
    """GET 响应含 sandbox / token_usage / token_budget / max_recursion_limit。"""
    client = _client_under(tmp_path, monkeypatch, yaml_text="")
    body = client.get("/api/v1/kstock/runtime-config").json()
    expected_keys = {
        "memory", "summarization", "title", "database",
        "sandbox", "token_usage", "token_budget", "max_recursion_limit",
    }
    assert expected_keys.issubset(body.keys())
