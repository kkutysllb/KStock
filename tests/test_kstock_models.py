"""KStock 模型配置写入层单元测试。

用 tmp_path 隔离运行时目录与 secrets.env，不触碰真实用户数据空间。
"""
import os
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from scripts.kstock_models import (
    ModelWritePayload,
    env_name_for_model,
    get_default_model,
    load_runtime_models,
    remove_secret,
    router,
    save_runtime_models,
    set_default_model,
    upsert_secret,
)


def test_env_name_for_model_basic():
    """name 转大写、非字母数字转下划线，固定前后缀。"""
    assert env_name_for_model("deepseek-v4") == "KSTOCK_MODEL_DEEPSEEK_V4_KEY"
    assert env_name_for_model("glm.5.2") == "KSTOCK_MODEL_GLM_5_2_KEY"
    assert env_name_for_model("Qwen3-Coder") == "KSTOCK_MODEL_QWEN3_CODER_KEY"


def test_env_name_for_model_empty_raises():
    """纯符号/空字符串无法生成合法环境变量名时抛 ValueError。"""
    with pytest.raises(ValueError):
        env_name_for_model("")
    with pytest.raises(ValueError):
        env_name_for_model("---")
    with pytest.raises(ValueError):
        env_name_for_model("...")


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


# ── secrets.env 读写 ────────────────────────────────────────────────
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


# ── prefs.json 偏好与 Pydantic 负载 ────────────────────────────────
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


def test_model_write_payload_strips_api_key():
    """api_key 为空字符串时视为未提供（不修改）。"""
    payload = ModelWritePayload(
        name="x",
        use="p:Q",
        model="m",
        api_key="",
    )
    assert payload.api_key is None


def test_model_write_payload_requires_name():
    """缺少必填字段 name 时抛校验异常。"""
    with pytest.raises(Exception):
        ModelWritePayload(use="p:Q", model="m")


# ── CRUD 端点（TestClient）─────────────────────────────────────────
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


def test_delete_default_model_clears_default(tmp_path, monkeypatch):
    """删除的恰是当前默认模型时，联动清除 prefs.json 悬空引用。"""
    client = _client_under(tmp_path, monkeypatch)
    client.post("/api/v1/kstock/models", json={
        "name": "a", "use": "p:Q", "model": "m", "api_key": "sk-x"
    })
    client.put("/api/v1/kstock/default-model", json={"default_model": "a"})
    assert client.get("/api/v1/kstock/default-model").json() == {"default_model": "a"}
    # 删除默认模型 → default_model 应回退为 None（不悬空）
    client.delete("/api/v1/kstock/models/a")
    assert client.get("/api/v1/kstock/default-model").json() == {"default_model": None}


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
