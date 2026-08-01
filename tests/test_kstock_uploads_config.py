"""KStock 附件上传配置段（uploads）单元测试。

验证 UploadsUserConfig 的默认值、范围校验，以及通过 runtime-config CRUD
端点的读写回 yaml 流程。用 tmp_path 隔离，不触碰真实用户数据空间。
"""
from pathlib import Path

import yaml
from fastapi import FastAPI
from fastapi.testclient import TestClient

from scripts.kstock_runtime_config import router
from scripts.kstock_uploads_config import UploadsUserConfig


# ── 测试辅助（与 test_kstock_runtime_config 同模式）────────────────


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


# ── pydantic 模型直测 ───────────────────────────────────────────────


def test_uploads_defaults_match_engine_constants():
    """默认值与引擎 uploads.py 的 DEFAULT_* 常量一致。"""
    cfg = UploadsUserConfig()
    assert cfg.max_files == 10
    assert cfg.max_file_size == 50 * 1024 * 1024
    assert cfg.max_total_size == 100 * 1024 * 1024


def test_uploads_max_files_range_validation():
    """max_files 超范围（< 1 或 > 100）校验失败。"""
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        UploadsUserConfig(max_files=0)
    with pytest.raises(ValidationError):
        UploadsUserConfig(max_files=101)


def test_uploads_size_must_be_positive():
    """size 字段必须 >= 1（字节）。"""
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        UploadsUserConfig(max_file_size=0)
    with pytest.raises(ValidationError):
        UploadsUserConfig(max_total_size=-1)


# ── runtime-config CRUD 集成 ────────────────────────────────────────


def test_get_runtime_config_includes_uploads_defaults(tmp_path, monkeypatch):
    """GET /runtime-config 返回 uploads 段及其默认值。"""
    client = _client_under(tmp_path, monkeypatch, yaml_text="")
    resp = client.get("/api/v1/kstock/runtime-config")
    assert resp.status_code == 200
    uploads = resp.json()["uploads"]
    assert uploads["max_files"] == 10
    assert uploads["max_file_size"] == 50 * 1024 * 1024
    assert uploads["max_total_size"] == 100 * 1024 * 1024


def test_put_uploads_writes_yaml(tmp_path, monkeypatch):
    """PUT /runtime-config/uploads 写回 yaml 的 uploads 段。"""
    client = _client_under(tmp_path, monkeypatch, yaml_text="")
    resp = client.put(
        "/api/v1/kstock/runtime-config/uploads",
        json={"max_files": 5, "max_file_size": 10485760, "max_total_size": 52428800},
    )
    assert resp.status_code == 200
    # 读回 yaml 确认落盘
    runtime_cfg = tmp_path / "config" / "qilin.runtime.yaml"
    data = yaml.safe_load(runtime_cfg.read_text(encoding="utf-8"))
    assert data["uploads"]["max_files"] == 5
    assert data["uploads"]["max_file_size"] == 10485760
    assert data["uploads"]["max_total_size"] == 52428800


def test_put_uploads_rejects_invalid_range(tmp_path, monkeypatch):
    """PUT 无效值（max_files=0）返回 400 + 字段明细。"""
    client = _client_under(tmp_path, monkeypatch, yaml_text="")
    resp = client.put(
        "/api/v1/kstock/runtime-config/uploads",
        json={"max_files": 0, "max_file_size": 100, "max_total_size": 200},
    )
    assert resp.status_code == 400
    detail = resp.json()["detail"]
    assert detail["code"] == "validation_failed"


def test_get_reads_back_uploaded_values(tmp_path, monkeypatch):
    """PUT 后 GET 读回刚写入的值。"""
    client = _client_under(tmp_path, monkeypatch, yaml_text="")
    client.put(
        "/api/v1/kstock/runtime-config/uploads",
        json={"max_files": 20, "max_file_size": 1024, "max_total_size": 4096},
    )
    resp = client.get("/api/v1/kstock/runtime-config")
    uploads = resp.json()["uploads"]
    assert uploads["max_files"] == 20
    assert uploads["max_file_size"] == 1024
    assert uploads["max_total_size"] == 4096
