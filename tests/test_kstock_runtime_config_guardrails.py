"""KStock 运行时配置读写层 —— 权限与护栏 + 搜索与来源段测试。

验证 _SECTION_MODELS 扩展（guardrails / authorization / input_polish /
loop_detection / safety_finish_reason / tool_search）的 GET/PUT 语义。
"""
from pathlib import Path

import yaml
from fastapi import FastAPI
from fastapi.testclient import TestClient

from scripts.kstock_runtime_config import router


# ── 测试辅助 ─────────────────────────────────────────────────────────


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


# ── GET 默认值 ──────────────────────────────────────────────────────


def test_get_returns_guardrails_defaults(tmp_path, monkeypatch):
    """guardrails 段缺失时返回 pydantic 默认值（enabled=False, fail_closed=True）。"""
    client = _client_under(tmp_path, monkeypatch, yaml_text="")
    resp = client.get("/api/v1/kstock/runtime-config")
    assert resp.status_code == 200
    guardrails = resp.json()["guardrails"]
    assert guardrails["enabled"] is False
    assert guardrails["fail_closed"] is True
    assert guardrails["passport"] is None
    assert guardrails["provider"] is None


def test_get_returns_authorization_defaults(tmp_path, monkeypatch):
    """authorization 段缺失时返回默认值（enabled=False, default_role='user'）。"""
    client = _client_under(tmp_path, monkeypatch, yaml_text="")
    resp = client.get("/api/v1/kstock/runtime-config")
    authz = resp.json()["authorization"]
    assert authz["enabled"] is False
    assert authz["fail_closed"] is True
    assert authz["default_role"] == "user"
    assert authz["provider"] is None


def test_get_returns_loop_detection_defaults(tmp_path, monkeypatch):
    """loop_detection 段缺失时返回默认值（enabled=True, warn=3, hard=5）。"""
    client = _client_under(tmp_path, monkeypatch, yaml_text="")
    resp = client.get("/api/v1/kstock/runtime-config")
    ld = resp.json()["loop_detection"]
    assert ld["enabled"] is True
    assert ld["warn_threshold"] == 3
    assert ld["hard_limit"] == 5
    assert ld["window_size"] == 20


def test_get_returns_input_polish_defaults(tmp_path, monkeypatch):
    """input_polish 段缺失时返回默认值（enabled=True, max_chars=4000）。"""
    client = _client_under(tmp_path, monkeypatch, yaml_text="")
    resp = client.get("/api/v1/kstock/runtime-config")
    ip = resp.json()["input_polish"]
    assert ip["enabled"] is True
    assert ip["max_chars"] == 4000
    assert ip["model_name"] is None


def test_get_returns_safety_finish_reason_defaults(tmp_path, monkeypatch):
    """safety_finish_reason 段缺失时返回默认值（enabled=True, detectors=None）。"""
    client = _client_under(tmp_path, monkeypatch, yaml_text="")
    resp = client.get("/api/v1/kstock/runtime-config")
    sf = resp.json()["safety_finish_reason"]
    assert sf["enabled"] is True
    assert sf["detectors"] is None


def test_get_returns_tool_search_defaults(tmp_path, monkeypatch):
    """tool_search 段缺失时返回默认值（enabled=False, auto_promote_top_k=3）。"""
    client = _client_under(tmp_path, monkeypatch, yaml_text="")
    resp = client.get("/api/v1/kstock/runtime-config")
    ts = resp.json()["tool_search"]
    assert ts["enabled"] is False
    assert ts["auto_promote_top_k"] == 3


# ── PUT 写入 ────────────────────────────────────────────────────────


def test_put_guardrails_writes_yaml(tmp_path, monkeypatch):
    """PUT guardrails 段后 yaml 含完整配置。"""
    client = _client_under(tmp_path, monkeypatch, yaml_text="")
    resp = client.put(
        "/api/v1/kstock/runtime-config/guardrails",
        json={"enabled": True, "fail_closed": False, "passport": "/tmp/passport.json"},
    )
    assert resp.status_code == 200
    cfg = _read_yaml(tmp_path)
    assert cfg["guardrails"]["enabled"] is True
    assert cfg["guardrails"]["fail_closed"] is False
    assert cfg["guardrails"]["passport"] == "/tmp/passport.json"


def test_put_authorization_writes_yaml(tmp_path, monkeypatch):
    """PUT authorization 段后 yaml 含完整配置。"""
    client = _client_under(tmp_path, monkeypatch, yaml_text="")
    resp = client.put(
        "/api/v1/kstock/runtime-config/authorization",
        json={"enabled": True, "fail_closed": True, "default_role": "admin"},
    )
    assert resp.status_code == 200
    cfg = _read_yaml(tmp_path)
    assert cfg["authorization"]["enabled"] is True
    assert cfg["authorization"]["default_role"] == "admin"


def test_put_input_polish_writes_yaml(tmp_path, monkeypatch):
    """PUT input_polish 段后 yaml 含完整配置。"""
    client = _client_under(tmp_path, monkeypatch, yaml_text="")
    resp = client.put(
        "/api/v1/kstock/runtime-config/input_polish",
        json={"enabled": False, "max_chars": 8000, "model_name": "gpt-4o-mini"},
    )
    assert resp.status_code == 200
    cfg = _read_yaml(tmp_path)
    assert cfg["input_polish"]["enabled"] is False
    assert cfg["input_polish"]["max_chars"] == 8000
    assert cfg["input_polish"]["model_name"] == "gpt-4o-mini"


def test_put_loop_detection_writes_yaml(tmp_path, monkeypatch):
    """PUT loop_detection 段后 yaml 含完整配置。"""
    client = _client_under(tmp_path, monkeypatch, yaml_text="")
    resp = client.put(
        "/api/v1/kstock/runtime-config/loop_detection",
        json={"enabled": True, "warn_threshold": 5, "hard_limit": 10, "window_size": 30},
    )
    assert resp.status_code == 200
    cfg = _read_yaml(tmp_path)
    assert cfg["loop_detection"]["warn_threshold"] == 5
    assert cfg["loop_detection"]["hard_limit"] == 10
    assert cfg["loop_detection"]["window_size"] == 30


def test_put_safety_finish_reason_writes_yaml(tmp_path, monkeypatch):
    """PUT safety_finish_reason 段后 yaml 含完整配置。"""
    client = _client_under(tmp_path, monkeypatch, yaml_text="")
    resp = client.put(
        "/api/v1/kstock/runtime-config/safety_finish_reason",
        json={"enabled": False},
    )
    assert resp.status_code == 200
    cfg = _read_yaml(tmp_path)
    assert cfg["safety_finish_reason"]["enabled"] is False


def test_put_tool_search_writes_yaml(tmp_path, monkeypatch):
    """PUT tool_search 段后 yaml 含完整配置。"""
    client = _client_under(tmp_path, monkeypatch, yaml_text="")
    resp = client.put(
        "/api/v1/kstock/runtime-config/tool_search",
        json={"enabled": True, "auto_promote_top_k": 5},
    )
    assert resp.status_code == 200
    cfg = _read_yaml(tmp_path)
    assert cfg["tool_search"]["enabled"] is True
    assert cfg["tool_search"]["auto_promote_top_k"] == 5


# ── pydantic 校验 ───────────────────────────────────────────────────


def test_put_loop_detection_validation(tmp_path, monkeypatch):
    """loop_detection: hard_limit < warn_threshold 返回 400。"""
    client = _client_under(tmp_path, monkeypatch, yaml_text="")
    resp = client.put(
        "/api/v1/kstock/runtime-config/loop_detection",
        json={"warn_threshold": 10, "hard_limit": 5},  # hard < warn
    )
    assert resp.status_code == 400
    detail = resp.json()["detail"]
    assert detail["code"] == "validation_failed"


def test_put_tool_search_auto_promote_clamped(tmp_path, monkeypatch):
    """tool_search: auto_promote_top_k 被 pydantic field_validator 钳制到 [1,5]。"""
    client = _client_under(tmp_path, monkeypatch, yaml_text="")
    # yfinance 不相关的测试——这里验证 tool_search 的 field_validator
    resp = client.put(
        "/api/v1/kstock/runtime-config/tool_search",
        json={"enabled": True, "auto_promote_top_k": 10},  # 超出 max=5
    )
    assert resp.status_code == 200
    cfg = _read_yaml(tmp_path)
    # clamp_auto_promote_top_k 会把 10 钳到 5
    assert cfg["tool_search"]["auto_promote_top_k"] == 5


def test_put_guardrails_preserves_other_sections(tmp_path, monkeypatch):
    """写 guardrails 不影响 database 等其他段。"""
    yaml_text = (
        "database:\n"
        "  backend: sqlite\n"
        "  sqlite_dir: /tmp/data\n"
    )
    client = _client_under(tmp_path, monkeypatch, yaml_text=yaml_text)
    resp = client.put(
        "/api/v1/kstock/runtime-config/guardrails",
        json={"enabled": True},
    )
    assert resp.status_code == 200
    cfg = _read_yaml(tmp_path)
    # guardrails 已更新
    assert cfg["guardrails"]["enabled"] is True
    # database 未受影响
    assert cfg["database"]["backend"] == "sqlite"
    assert cfg["database"]["sqlite_dir"] == "/tmp/data"
