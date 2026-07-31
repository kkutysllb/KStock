"""KStock 模型配置写入层单元测试。

用 tmp_path 隔离运行时目录与 secrets.env，不触碰真实用户数据空间。
"""
import os
from pathlib import Path

import pytest

from scripts.kstock_models import (
    env_name_for_model,
    load_runtime_models,
    remove_secret,
    save_runtime_models,
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
