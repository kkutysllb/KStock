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


# ── Skills 启停管理 ┄───────────────────────────────────────────────────
#
# 与 MCP servers 不同：skills 不是用户自由的 CRUD，而是 vendor/skills 下预置的
# 技能包（股票类 / 通用类）。用户只能启用/禁用某个 skill，不能新增/删除。
# extensions_config.json 的 ``skills`` 字段是 dict[name, {enabled: bool}]，
# 不在里面的 skill 默认 enabled=true（引擎默认行为）。


def _skills_root() -> Path:
    """解析 vendor/skills 目录绝对路径。

    模板里是相对路径 ``vendor/skills``，需结合仓库根解析。
    """
    repo_root = Path(__file__).resolve().parent.parent
    skills_root = repo_root / "vendor" / "skills"
    return skills_root


# 技能目录布局：vendor/skills/public/<name>/SKILL.md
# 引擎 SkillCategory 只认 public/custom/integrations/legacy，预置技能全部
# 放 public（只读）。``group``（stock/common）保留为前端展示用的分类标签，
# 从 approved-skills.json 的 ``kind`` 字段读取。
_SKILLS_PUBLIC_DIR = "public"


def _load_skill_kind_map() -> dict[str, str]:
    """从 approved-skills.json 读 name→kind 映射（stock / common）。

    用于给前端提供 ``group`` 分类标签。失败时返回空 dict（group 回退
    为 "public"，不影响加载）。
    """
    manifest_path = _skills_root() / "approved-skills.json"
    if not manifest_path.exists():
        return {}
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        return {entry["name"]: entry.get("kind", "public") for entry in manifest.get("skills", [])}
    except (json.JSONDecodeError, KeyError):
        return {}


def _parse_skill_frontmatter(skill_md_path: Path) -> dict[str, str]:
    """从 SKILL.md 提取 YAML frontmatter 的 name / description / version / category。

    frontmatter 格式：
        ---
        name: xxx
        description: xxx
        version: x.y.z
        category: finance
        ---

    返回的 dict 仅含上述字段，解析失败返回空 dict。
    """
    try:
        text = skill_md_path.read_text(encoding="utf-8")
    except (FileNotFoundError, OSError):
        return {}
    # 仅取首个 --- ... --- 之间的内容
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}
    frontmatter_lines: list[str] = []
    for line in lines[1:]:
        if line.strip() == "---":
            break
        frontmatter_lines.append(line)
    else:
        # 未闭合的 frontmatter
        return {}
    try:
        import yaml

        meta = yaml.safe_load("\n".join(frontmatter_lines)) or {}
    except Exception:
        return {}
    if not isinstance(meta, dict):
        return {}
    # 只提取我们关心的字段
    return {k: str(meta[k]) for k in ("name", "description", "version", "category") if k in meta}


def _scan_available_skills() -> list[dict[str, str]]:
    """扫描 vendor/skills/public/*/SKILL.md，返回所有预置技能的元信息。

    每项包含：name（目录名 + frontmatter name）、path、title、description、
    version、category、group（stock / common，来自 approved-skills.json 的
    kind 字段；缺失时回退 "public"）。
    """
    root = _skills_root()
    if not root.exists():
        return []
    public_dir = root / _SKILLS_PUBLIC_DIR
    if not public_dir.is_dir():
        return []
    kind_map = _load_skill_kind_map()
    results: list[dict[str, str]] = []
    for skill_dir in sorted(public_dir.iterdir()):
        if not skill_dir.is_dir():
            continue
        skill_md = skill_dir / "SKILL.md"
        if not skill_md.exists():
            continue
        meta = _parse_skill_frontmatter(skill_md)
        # name 优先用 frontmatter 的，其次目录名
        skill_name = meta.get("name") or skill_dir.name
        results.append({
            "name": skill_name,
            "dir_name": skill_dir.name,
            "group": kind_map.get(skill_name, _SKILLS_PUBLIC_DIR),
            "path": str(skill_dir.relative_to(root)),
            "title": meta.get("name", skill_dir.name),
            "description": meta.get("description", ""),
            "version": meta.get("version", ""),
            "category": meta.get("category", ""),
        })
    return results


class SkillInfo(BaseModel):
    """单个预置技能的展示信息 + 启用状态。"""
    name: str = Field(description="技能唯一名（frontmatter.name）")
    dir_name: str = Field(description="目录名")
    group: str = Field(description="stock / common / public（展示分类标签）")
    path: str = Field(description="相对 vendor/skills 的路径")
    title: str = Field(description="展示标题")
    description: str = Field(default="", description="一句话描述")
    version: str = Field(default="")
    category: str = Field(default="")
    enabled: bool = Field(default=True, description="当前是否启用")


class AvailableSkillsResponse(BaseModel):
    skills: list[SkillInfo] = Field(default_factory=list)


class SkillStatePayload(BaseModel):
    enabled: bool


class SkillActionResponse(BaseModel):
    name: str
    enabled: bool
    action: str  # enabled / disabled / deleted


@router.get("/available-skills", response_model=AvailableSkillsResponse)
def list_available_skills() -> AvailableSkillsResponse:
    """扫描 vendor/skills 预置技能，合并 extensions_config.json 里的启用状态。

    未在 extensions_config.json.skills 中显式记录的技能默认 enabled=true。
    """
    data = _read_extensions_json()
    stored_skills = data.get("skills", {}) or {}
    skills: list[SkillInfo] = []
    for raw in _scan_available_skills():
        stored = stored_skills.get(raw["name"], None)
        # 显式 stored 存在时用其 enabled，否则默认启用
        enabled = stored.get("enabled", True) if isinstance(stored, dict) else True
        skills.append(SkillInfo(**raw, enabled=bool(enabled)))
    return AvailableSkillsResponse(skills=skills)


@router.put("/skills/{name}", response_model=SkillActionResponse)
def set_skill_enabled(name: str, payload: SkillStatePayload) -> SkillActionResponse:
    """启用/禁用某个预置技能。

    payload.enabled=true 时 upsert 到 skills dict（enabled=true）。
    payload.enabled=false 时 upsert 为 enabled=false。
    技能不存在（不在 vendor/skills）返回 404。
    """
    # 验证 name 是预置技能之一（防止写入无效 key）
    valid_names = {s["name"] for s in _scan_available_skills()}
    if name not in valid_names:
        raise HTTPException(
            status_code=404,
            detail=f"技能 '{name}' 不在预置技能列表中。",
        )
    with _write_lock:
        data = _read_extensions_json()
        skills = data.get("skills", {}) or {}
        skills[name] = {"enabled": payload.enabled}
        data["skills"] = skills
        _atomic_write_json(_extensions_config_path(), data)

    return SkillActionResponse(
        name=name,
        enabled=payload.enabled,
        action="enabled" if payload.enabled else "disabled",
    )


@router.delete("/skills/{name}", response_model=SkillActionResponse)
def delete_skill_state(name: str) -> SkillActionResponse:
    """从 extensions_config.json 的 skills dict 移除某项（恢复默认启用状态）。

    不存在返回 404。删除后该技能回到默认 enabled=true。
    """
    with _write_lock:
        data = _read_extensions_json()
        skills = data.get("skills", {}) or {}
        if name not in skills:
            raise HTTPException(
                status_code=404,
                detail=f"技能 '{name}' 状态记录不存在。",
            )
        del skills[name]
        data["skills"] = skills
        _atomic_write_json(_extensions_config_path(), data)

    return SkillActionResponse(name=name, enabled=True, action="deleted")
