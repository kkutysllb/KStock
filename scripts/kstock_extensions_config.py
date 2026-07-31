"""KStock MCP 扩展配置 CRUD 端点。

读写 ``<data_root>/config/extensions_config.json``（与 runtime.yaml 同目录）。
该文件是 QiLin 引擎 extensions 配置的真源，包含 MCP servers / skills / middlewares。

与 ``kstock_runtime_config.py`` 的区别：
  - runtime.yaml 用 YAML，段 dict 结构，走 pydantic section 校验
  - extensions_config.json 用 JSON，mcpServers 是嵌套 dict，走独立 CRUD

原子写入：tmp 文件 + os.replace（跨平台原子 rename）。
线程安全：模块级 threading.Lock 串行化所有写操作。
"""
from __future__ import annotations

import json
import os
import tempfile
import threading
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v1/kstock/extensions", tags=["kstock-extensions"])

_write_lock = threading.Lock()


# ── 路径解析 ─────────────────────────────────────────────────────────


def _data_root() -> Path:
    return Path(os.environ["KSTOCK_APP_DATA_DIR"])


def _extensions_config_path() -> Path:
    return _data_root() / "config" / "extensions_config.json"


# ── JSON 读写 ───────────────────────────────────────────────────────


def _read_extensions_json() -> dict[str, Any]:
    """读取 extensions_config.json，不存在时返回空结构。"""
    path = _extensions_config_path()
    if not path.exists():
        return {"middlewares": [], "mcpServers": {}, "skills": {}}
    try:
        with path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"extensions_config.json 解析失败: {exc}",
        ) from exc
    if not isinstance(data, dict):
        raise HTTPException(
            status_code=500,
            detail="extensions_config.json 根必须是 JSON 对象",
        )
    # 确保必要 key 存在
    data.setdefault("middlewares", [])
    data.setdefault("mcpServers", {})
    data.setdefault("skills", {})
    return data


def _atomic_write_json(path: Path, data: dict[str, Any]) -> None:
    """原子写入 JSON：tmp 文件 + os.replace。"""
    directory = str(path.parent)
    os.makedirs(directory, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".ext_cfg_", suffix=".json", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
            fh.write("\n")
        os.replace(tmp, str(path))
    except Exception:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


# ── pydantic 校验 ───────────────────────────────────────────────────


def _validate_mcp_server(payload: dict[str, Any]) -> dict[str, Any]:
    """用引擎 McpServerConfig 校验 server payload，返回序列化 dict。"""
    from qilin.config.extensions_config import McpServerConfig

    try:
        instance = McpServerConfig(**payload)
    except Exception as exc:
        # pydantic ValidationError 包含 errors()
        errors = []
        if hasattr(exc, "errors"):
            for err in exc.errors():
                loc = ".".join(str(p) for p in err["loc"])
                errors.append({"field": loc or "(root)", "message": err["msg"], "type": err["type"]})
        else:
            errors.append({"field": "(root)", "message": str(exc), "type": "value_error"})
        raise HTTPException(
            status_code=400,
            detail={
                "code": "validation_failed",
                "message": "MCP server 配置校验失败",
                "errors": errors,
            },
        ) from exc
    # model_dump with by_alias to match JSON file shape
    return instance.model_dump(by_alias=True, exclude_none=False)


# ── 响应模型 ────────────────────────────────────────────────────────


class ExtensionsResponse(BaseModel):
    """extensions_config.json 的完整内容。"""
    middlewares: list[str] = Field(default_factory=list)
    mcpServers: dict[str, Any] = Field(default_factory=dict)
    skills: dict[str, Any] = Field(default_factory=dict)


class McpServerPayload(BaseModel):
    """新建/更新 MCP server 的 payload。"""
    enabled: bool = True
    type: str = "stdio"
    command: str | None = None
    args: list[str] = Field(default_factory=list)
    env: dict[str, str] = Field(default_factory=dict)
    url: str | None = None
    headers: dict[str, str] = Field(default_factory=dict)
    description: str = ""
    tool_call_timeout: float | None = None


class McpServerActionResponse(BaseModel):
    name: str
    action: str
    server: dict[str, Any] | None = None


# ── 路由 ───────────────────────────────────────────────────────────


@router.get("", response_model=ExtensionsResponse)
def get_extensions() -> ExtensionsResponse:
    """读取 extensions_config.json 全量内容。"""
    data = _read_extensions_json()
    return ExtensionsResponse(
        middlewares=data.get("middlewares", []),
        mcpServers=data.get("mcpServers", {}),
        skills=data.get("skills", {}),
    )


@router.post("/mcp-servers/{name}", response_model=McpServerActionResponse)
def create_mcp_server(name: str, payload: McpServerPayload) -> McpServerActionResponse:
    """新建一个 MCP server。重名返回 409。"""
    validated = _validate_mcp_server(payload.model_dump(exclude_none=False))

    with _write_lock:
        data = _read_extensions_json()
        servers = data.get("mcpServers", {})
        if name in servers:
            raise HTTPException(
                status_code=409,
                detail=f"MCP server '{name}' 已存在。更新请用 PUT。",
            )
        servers[name] = validated
        data["mcpServers"] = servers
        _atomic_write_json(_extensions_config_path(), data)

    return McpServerActionResponse(name=name, action="created", server=validated)


@router.put("/mcp-servers/{name}", response_model=McpServerActionResponse)
def update_mcp_server(name: str, payload: McpServerPayload) -> McpServerActionResponse:
    """更新一个已存在的 MCP server。不存在返回 404。"""
    validated = _validate_mcp_server(payload.model_dump(exclude_none=False))

    with _write_lock:
        data = _read_extensions_json()
        servers = data.get("mcpServers", {})
        if name not in servers:
            raise HTTPException(
                status_code=404,
                detail=f"MCP server '{name}' 不存在。新建请用 POST。",
            )
        servers[name] = validated
        data["mcpServers"] = servers
        _atomic_write_json(_extensions_config_path(), data)

    return McpServerActionResponse(name=name, action="updated", server=validated)


@router.delete("/mcp-servers/{name}", response_model=McpServerActionResponse)
def delete_mcp_server(name: str) -> McpServerActionResponse:
    """删除一个 MCP server。不存在返回 404。"""
    with _write_lock:
        data = _read_extensions_json()
        servers = data.get("mcpServers", {})
        if name not in servers:
            raise HTTPException(
                status_code=404,
                detail=f"MCP server '{name}' 不存在。",
            )
        del servers[name]
        data["mcpServers"] = servers
        _atomic_write_json(_extensions_config_path(), data)

    return McpServerActionResponse(name=name, action="deleted", server=None)
