"""KStock 运行时配置读写层单元测试。

用 tmp_path 隔离 runtime.yaml 与 secrets.env，不触碰真实用户数据空间。
"""
import os
from pathlib import Path

import pytest
import yaml
from fastapi import FastAPI
from fastapi.testclient import TestClient

from scripts.kstock_runtime_config import router


# ── 测试辅助 ─────────────────────────────────────────────────────────
def _runtime_config_path_under(data_root: Path) -> Path:
    return data_root / "config" / "qilin.runtime.yaml"


def _setup_data_root(data_root: Path, monkeypatch, yaml_text: str = "") -> Path:
    """在 tmp_path 下建立完整数据空间，注入环境变量，写初始 runtime.yaml。"""
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


# ── GET /runtime-config ─────────────────────────────────────────────

def test_get_runtime_config_returns_defaults_when_empty(tmp_path, monkeypatch):
    """runtime.yaml 为空时，各段返回各自 pydantic 默认值。"""
    client = _client_under(tmp_path, monkeypatch, yaml_text="")
    resp = client.get("/api/v1/kstock/runtime-config")
    assert resp.status_code == 200
    body = resp.json()
    assert set(body.keys()) == {
        "memory", "summarization", "title", "database",
        "sandbox", "token_usage", "token_budget",
        "guardrails", "authorization", "input_polish",
        "loop_detection", "safety_finish_reason",
        "tool_search", "subagents", "uploads", "max_recursion_limit",
    }
    # title 默认 enabled=True, max_words=6
    assert body["title"]["enabled"] is True
    assert body["title"]["max_words"] == 6
    # database 默认 backend="memory"
    assert body["database"]["backend"] == "memory"


def test_get_runtime_config_reads_existing_yaml(tmp_path, monkeypatch):
    """runtime.yaml 已有配置时返回文件内容（而非 pydantic 默认值）。"""
    yaml_text = (
        "title:\n"
        "  enabled: false\n"
        "  max_words: 12\n"
        "  max_chars: 100\n"
        "database:\n"
        "  backend: sqlite\n"
        "  sqlite_dir: /tmp/data\n"
    )
    client = _client_under(tmp_path, monkeypatch, yaml_text=yaml_text)
    resp = client.get("/api/v1/kstock/runtime-config")
    body = resp.json()
    assert body["title"]["enabled"] is False
    assert body["title"]["max_words"] == 12
    assert body["database"]["backend"] == "sqlite"
    assert body["database"]["sqlite_dir"] == "/tmp/data"


# ── PUT /runtime-config/{section} ───────────────────────────────────

def test_put_title_writes_yaml(tmp_path, monkeypatch):
    """PUT title 段后 yaml 文件更新，models 等其他段保留。"""
    yaml_text = "models:\n  - name: keepme\n    use: p:Q\n    model: m\n"
    client = _client_under(tmp_path, monkeypatch, yaml_text=yaml_text)
    resp = client.put("/api/v1/kstock/runtime-config/title", json={
        "enabled": True,
        "max_words": 8,
        "max_chars": 80,
        "model_name": "gpt-4o-mini",
    })
    assert resp.status_code == 200
    assert resp.json()["section"] == "title"
    # yaml 文件更新
    cfg = yaml.safe_load(_runtime_config_path_under(tmp_path).read_text(encoding="utf-8"))
    assert cfg["title"]["max_words"] == 8
    assert cfg["title"]["model_name"] == "gpt-4o-mini"
    # models 段保留
    assert len(cfg["models"]) == 1
    assert cfg["models"][0]["name"] == "keepme"


def test_put_database_isolates_other_sections(tmp_path, monkeypatch):
    """改 database 不影响 memory/title 段。"""
    yaml_text = (
        "memory:\n"
        "  enabled: true\n"
        "title:\n"
        "  enabled: true\n"
        "  max_words: 5\n"
        "  max_chars: 50\n"
    )
    client = _client_under(tmp_path, monkeypatch, yaml_text=yaml_text)
    resp = client.put("/api/v1/kstock/runtime-config/database", json={
        "backend": "postgres",
        "postgres_url": "$DATABASE_URL",
    })
    assert resp.status_code == 200
    cfg = yaml.safe_load(_runtime_config_path_under(tmp_path).read_text(encoding="utf-8"))
    assert cfg["database"]["backend"] == "postgres"
    # memory/title 保持原样
    assert cfg["memory"]["enabled"] is True
    assert cfg["title"]["max_words"] == 5


def test_put_invalid_section_returns_400(tmp_path, monkeypatch):
    """未知段名返回 400。"""
    client = _client_under(tmp_path, monkeypatch)
    resp = client.put("/api/v1/kstock/runtime-config/nonexistent", json={})
    assert resp.status_code == 400


def test_put_invalid_payload_returns_400_with_field_errors(tmp_path, monkeypatch):
    """payload 违反 pydantic 约束（如 max_words > 20）返回 400 + 字段明细。"""
    client = _client_under(tmp_path, monkeypatch)
    resp = client.put("/api/v1/kstock/runtime-config/title", json={
        "enabled": True,
        "max_words": 999,  # 上限 20
        "max_chars": 60,
    })
    assert resp.status_code == 400
    detail = resp.json()["detail"]
    assert detail["code"] == "validation_failed"
    # 错误明细含字段名
    fields = [e["field"] for e in detail["errors"]]
    assert "max_words" in fields


def test_put_generates_backup(tmp_path, monkeypatch):
    """写入后生成备份文件（原子替换）。"""
    yaml_text = "title:\n  enabled: true\n  max_words: 6\n  max_chars: 60\n"
    client = _client_under(tmp_path, monkeypatch, yaml_text=yaml_text)
    client.put("/api/v1/kstock/runtime-config/title", json={
        "enabled": False, "max_words": 6, "max_chars": 60,
    })
    backups = list((tmp_path / "backups").glob("qilin.runtime.yaml.*"))
    assert len(backups) == 1


# ── 敏感值处理 ──────────────────────────────────────────────────────

def test_put_database_plaintext_url_converted_to_env(tmp_path, monkeypatch):
    """明文 postgres_url 转为 $ENV 引用，明文写入 secrets.env。"""
    client = _client_under(tmp_path, monkeypatch)
    resp = client.put("/api/v1/kstock/runtime-config/database", json={
        "backend": "postgres",
        "postgres_url": "postgresql://user:secret@host:5432/db",
    })
    assert resp.status_code == 200
    # yaml 里是 $ENV 引用
    cfg = yaml.safe_load(_runtime_config_path_under(tmp_path).read_text(encoding="utf-8"))
    assert cfg["database"]["postgres_url"] == "$KSTOCK_DATABASE_URL"
    # 明文在 secrets.env
    env_text = (tmp_path / "config" / "secrets.env").read_text(encoding="utf-8")
    assert 'KSTOCK_DATABASE_URL="postgresql://user:secret@host:5432/db"' in env_text


def test_put_database_env_ref_preserved(tmp_path, monkeypatch):
    """已是 $ENV 引用的 postgres_url 原样保留，不写 secrets.env。"""
    client = _client_under(tmp_path, monkeypatch)
    client.put("/api/v1/kstock/runtime-config/database", json={
        "backend": "postgres",
        "postgres_url": "$DATABASE_URL",
    })
    cfg = yaml.safe_load(_runtime_config_path_under(tmp_path).read_text(encoding="utf-8"))
    assert cfg["database"]["postgres_url"] == "$DATABASE_URL"
    env_file = tmp_path / "config" / "secrets.env"
    # 不应写 KSTOCK_DATABASE_URL（因为已是 env 引用）
    assert not env_file.exists() or "KSTOCK_DATABASE_URL" not in env_file.read_text(encoding="utf-8")


# ── 往返一致性 ──────────────────────────────────────────────────────

def test_get_after_put_roundtrip(tmp_path, monkeypatch):
    """PUT 后 GET 返回刚写入的值。"""
    client = _client_under(tmp_path, monkeypatch)
    client.put("/api/v1/kstock/runtime-config/summarization", json={
        "enabled": True,
        "trigger": {"type": "messages", "value": 30},
        "keep": {"type": "messages", "value": 15},
    })
    body = client.get("/api/v1/kstock/runtime-config").json()
    assert body["summarization"]["enabled"] is True
    assert body["summarization"]["trigger"]["value"] == 30
    assert body["summarization"]["keep"]["value"] == 15


# ── subagents 段 round-trip ─────────────────────────────────────────


def test_get_subagents_returns_defaults_when_empty(tmp_path, monkeypatch):
    """runtime.yaml 无 subagents 段时 GET 返回引擎默认值。"""
    client = _client_under(tmp_path, monkeypatch)
    body = client.get("/api/v1/kstock/runtime-config").json()
    sub = body["subagents"]
    assert sub["timeout_seconds"] == 1800
    assert sub["max_total_per_run"] == 6
    assert sub["custom_agents"] == {}


def test_put_subagents_global_params_roundtrip(tmp_path, monkeypatch):
    """PUT subagents 全局参数 → GET 返回更新后的值。"""
    client = _client_under(tmp_path, monkeypatch)
    resp = client.put("/api/v1/kstock/runtime-config/subagents", json={
        "timeout_seconds": 3600,
        "max_turns": 80,
        "max_total_per_run": 10,
    })
    assert resp.status_code == 200
    body = client.get("/api/v1/kstock/runtime-config").json()
    sub = body["subagents"]
    assert sub["timeout_seconds"] == 3600
    assert sub["max_turns"] == 80
    assert sub["max_total_per_run"] == 10


def test_put_subagents_with_custom_agents_roundtrip(tmp_path, monkeypatch):
    """PUT subagents 含 custom_agents 嵌套 dict → GET 返回完整角色。"""
    client = _client_under(tmp_path, monkeypatch)
    custom_agent = {
        "description": "测试角色",
        "system_prompt": "你是测试子代理",
        "tools": ["finance_data_search"],
        "skills": ["kk-stock-analysis"],
        "model": "inherit",
        "max_turns": 50,
        "timeout_seconds": 600,
    }
    resp = client.put("/api/v1/kstock/runtime-config/subagents", json={
        "timeout_seconds": 1800,
        "max_total_per_run": 6,
        "custom_agents": {"test-analyst": custom_agent},
    })
    assert resp.status_code == 200
    body = client.get("/api/v1/kstock/runtime-config").json()
    sub = body["subagents"]
    assert "test-analyst" in sub["custom_agents"]
    agent = sub["custom_agents"]["test-analyst"]
    assert agent["system_prompt"] == "你是测试子代理"
    assert agent["tools"] == ["finance_data_search"]
    assert agent["skills"] == ["kk-stock-analysis"]
    assert agent["model"] == "inherit"
    assert agent["max_turns"] == 50


def test_put_subagents_invalid_returns_400(tmp_path, monkeypatch):
    """PUT subagents 非法值（max_total_per_run 超范围）返回 400 + fieldErrors。"""
    client = _client_under(tmp_path, monkeypatch)
    resp = client.put("/api/v1/kstock/runtime-config/subagents", json={
        "max_total_per_run": 999,  # 超过上限 50
    })
    assert resp.status_code == 400
    detail = resp.json()["detail"]
    assert detail["code"] == "validation_failed"
