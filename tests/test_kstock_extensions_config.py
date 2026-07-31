"""KStock MCP 扩展配置 CRUD 端点测试。

用 tmp_path 隔离 extensions_config.json + runtime.yaml，不触碰真实用户数据。
"""
import json
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from scripts.kstock_extensions_config import router


# ── 测试辅助 ─────────────────────────────────────────────────────────


def _setup_data_root(data_root: Path, monkeypatch, json_text: str | None = None) -> Path:
    config_dir = data_root / "config"
    config_dir.mkdir(parents=True, exist_ok=True)
    ext_cfg = config_dir / "extensions_config.json"
    if json_text is not None:
        ext_cfg.write_text(json_text, encoding="utf-8")
    # runtime.yaml 也要存在（环境变量指向它）
    runtime_cfg = config_dir / "qilin.runtime.yaml"
    runtime_cfg.write_text("", encoding="utf-8")
    monkeypatch.setenv("KSTOCK_APP_DATA_DIR", str(data_root))
    monkeypatch.setenv("QILIN_CONFIG_PATH", str(runtime_cfg))
    monkeypatch.setenv("QILIN_EXTENSIONS_CONFIG_PATH", str(ext_cfg))
    return data_root


def _client_under(tmp_path, monkeypatch, json_text: str | None = None) -> TestClient:
    _setup_data_root(tmp_path, monkeypatch, json_text)
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def _read_json(data_root: Path) -> dict:
    path = data_root / "config" / "extensions_config.json"
    return json.loads(path.read_text(encoding="utf-8"))


# ── GET ─────────────────────────────────────────────────────────────


def test_get_returns_empty_when_no_file(tmp_path, monkeypatch):
    """extensions_config.json 不存在时返回空结构。"""
    client = _client_under(tmp_path, monkeypatch, json_text=None)
    resp = client.get("/api/v1/kstock/extensions")
    assert resp.status_code == 200
    body = resp.json()
    assert body["middlewares"] == []
    assert body["mcpServers"] == {}
    assert body["skills"] == {}


def test_get_returns_existing_config(tmp_path, monkeypatch):
    """已有配置时返回文件内容。"""
    json_text = json.dumps({
        "middlewares": ["qilin.agents.middlewares.foo:FooMiddleware"],
        "mcpServers": {
            "test-server": {
                "type": "stdio",
                "command": "echo",
                "args": ["hello"],
                "enabled": True,
            }
        },
        "skills": {},
    })
    client = _client_under(tmp_path, monkeypatch, json_text=json_text)
    resp = client.get("/api/v1/kstock/extensions")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["middlewares"]) == 1
    assert "test-server" in body["mcpServers"]


# ── POST create ─────────────────────────────────────────────────────


def test_create_mcp_server_stdio(tmp_path, monkeypatch):
    """POST 创建 stdio server 后 json 含该条目。"""
    client = _client_under(tmp_path, monkeypatch, json_text=None)
    resp = client.post(
        "/api/v1/kstock/extensions/mcp-servers/my-server",
        json={
            "enabled": True,
            "type": "stdio",
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-filesystem"],
            "env": {"ROOT": "/tmp"},
            "description": "Filesystem MCP server",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["action"] == "created"
    cfg = _read_json(tmp_path)
    assert "my-server" in cfg["mcpServers"]
    server = cfg["mcpServers"]["my-server"]
    assert server["command"] == "npx"
    assert server["args"] == ["-y", "@modelcontextprotocol/server-filesystem"]
    assert server["env"] == {"ROOT": "/tmp"}


def test_create_mcp_server_http(tmp_path, monkeypatch):
    """POST 创建 http server（url + headers）。"""
    client = _client_under(tmp_path, monkeypatch, json_text=None)
    resp = client.post(
        "/api/v1/kstock/extensions/mcp-servers/remote-api",
        json={
            "enabled": True,
            "type": "http",
            "url": "https://api.example.com/mcp",
            "headers": {"Authorization": "Bearer token123"},
            "description": "Remote HTTP MCP server",
        },
    )
    assert resp.status_code == 200
    cfg = _read_json(tmp_path)
    server = cfg["mcpServers"]["remote-api"]
    assert server["url"] == "https://api.example.com/mcp"
    assert server["headers"]["Authorization"] == "Bearer token123"


def test_create_duplicate_returns_409(tmp_path, monkeypatch):
    """重名 server 返回 409。"""
    json_text = json.dumps({
        "middlewares": [],
        "mcpServers": {"existing": {"type": "stdio", "command": "echo"}},
        "skills": {},
    })
    client = _client_under(tmp_path, monkeypatch, json_text=json_text)
    resp = client.post(
        "/api/v1/kstock/extensions/mcp-servers/existing",
        json={"type": "stdio", "command": "cat"},
    )
    assert resp.status_code == 409


# ── PUT update ──────────────────────────────────────────────────────


def test_update_mcp_server(tmp_path, monkeypatch):
    """PUT 更新现有 server 的 command/args。"""
    json_text = json.dumps({
        "middlewares": [],
        "mcpServers": {"my-server": {"type": "stdio", "command": "old-cmd", "args": []}},
        "skills": {},
    })
    client = _client_under(tmp_path, monkeypatch, json_text=json_text)
    resp = client.put(
        "/api/v1/kstock/extensions/mcp-servers/my-server",
        json={"type": "stdio", "command": "new-cmd", "args": ["--verbose"]},
    )
    assert resp.status_code == 200
    assert resp.json()["action"] == "updated"
    cfg = _read_json(tmp_path)
    server = cfg["mcpServers"]["my-server"]
    assert server["command"] == "new-cmd"
    assert server["args"] == ["--verbose"]


def test_update_nonexistent_returns_404(tmp_path, monkeypatch):
    """更新不存在 server 返回 404。"""
    client = _client_under(tmp_path, monkeypatch, json_text=None)
    resp = client.put(
        "/api/v1/kstock/extensions/mcp-servers/nonexistent",
        json={"type": "stdio", "command": "echo"},
    )
    assert resp.status_code == 404


# ── DELETE ──────────────────────────────────────────────────────────


def test_delete_mcp_server(tmp_path, monkeypatch):
    """DELETE 后 json 不含该条目。"""
    json_text = json.dumps({
        "middlewares": [],
        "mcpServers": {
            "to-delete": {"type": "stdio", "command": "echo"},
            "keep": {"type": "stdio", "command": "cat"},
        },
        "skills": {},
    })
    client = _client_under(tmp_path, monkeypatch, json_text=json_text)
    resp = client.delete("/api/v1/kstock/extensions/mcp-servers/to-delete")
    assert resp.status_code == 200
    assert resp.json()["action"] == "deleted"
    cfg = _read_json(tmp_path)
    assert "to-delete" not in cfg["mcpServers"]
    assert "keep" in cfg["mcpServers"]


def test_delete_nonexistent_returns_404(tmp_path, monkeypatch):
    """删除不存在 server 返回 404。"""
    client = _client_under(tmp_path, monkeypatch, json_text=None)
    resp = client.delete("/api/v1/kstock/extensions/mcp-servers/nonexistent")
    assert resp.status_code == 404


# ── 隔离性 ──────────────────────────────────────────────────────────


def test_extensions_independent_from_runtime_yaml(tmp_path, monkeypatch):
    """写 extensions 不影响 runtime.yaml 段。"""
    # 初始 runtime.yaml 含 database 段
    config_dir = tmp_path / "config"
    config_dir.mkdir(parents=True, exist_ok=True)
    runtime_cfg = config_dir / "qilin.runtime.yaml"
    runtime_cfg.write_text("database:\n  backend: sqlite\n", encoding="utf-8")
    ext_cfg = config_dir / "extensions_config.json"
    ext_cfg.write_text(json.dumps({"middlewares": [], "mcpServers": {}, "skills": {}}), encoding="utf-8")
    monkeypatch.setenv("KSTOCK_APP_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("QILIN_CONFIG_PATH", str(runtime_cfg))
    monkeypatch.setenv("QILIN_EXTENSIONS_CONFIG_PATH", str(ext_cfg))

    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    # 写一个 MCP server
    client.post(
        "/api/v1/kstock/extensions/mcp-servers/test",
        json={"type": "stdio", "command": "echo"},
    )

    # runtime.yaml 不受影响
    import yaml
    rt = yaml.safe_load(runtime_cfg.read_text(encoding="utf-8"))
    assert rt["database"]["backend"] == "sqlite"
