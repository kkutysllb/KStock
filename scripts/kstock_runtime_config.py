"""KStock 运行时配置读写层。

引擎 vendor/qilin 的 config 是 mtime 热重载的（``get_app_config()`` 监测
``qilin.runtime.yaml`` 修改），但只读。本模块提供 KStock 自有的读写端点，
改写 runtime.yaml 的 ``memory`` / ``summarization`` / ``title`` / ``database``
四个段，保留其他段（models / sandbox / skills / ...）不变。

写入前用引擎对应的 pydantic Config 类做 ``Config(**payload)`` 校验，避免
无效配置热重载后让引擎崩溃。敏感值（postgres_url / memory backend model
api_key）若是 ``$ENV`` 引用则原样保留；明文则转为 ``$ENV_NAME`` 写入
``secrets.env``（复用 ``kstock_models.upsert_secret``）。
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ValidationError

from scripts.kstock_models import (
    _atomic_write_yaml,
    _runtime_config_path,
    load_runtime_config,
    upsert_secret,
)

router = APIRouter(prefix="/api/v1/kstock", tags=["kstock-runtime-config"])

# 段名 → 引擎 pydantic Config 类（懒 import，避免 import 时拉起整个引擎）
_SECTION_MODELS: dict[str, str] = {
    "memory": "qilin.config.memory_config:MemoryConfig",
    "summarization": "qilin.config.summarization_config:SummarizationConfig",
    "title": "qilin.config.title_config:TitleConfig",
    "database": "qilin.config.database_config:DatabaseConfig",
    "sandbox": "qilin.config.sandbox_config:SandboxConfig",
    "token_usage": "qilin.config.token_usage_config:TokenUsageConfig",
    "token_budget": "qilin.config.token_budget_config:TokenBudgetConfig",
    # 权限与护栏
    "guardrails": "qilin.config.guardrails_config:GuardrailsConfig",
    "authorization": "qilin.config.authorization_config:AuthorizationConfig",
    "input_polish": "qilin.config.input_polish_config:InputPolishConfig",
    "loop_detection": "qilin.config.loop_detection_config:LoopDetectionConfig",
    "safety_finish_reason": "qilin.config.safety_finish_reason_config:SafetyFinishReasonConfig",
    # 搜索与来源
    "tool_search": "qilin.config.tool_search_config:ToolSearchConfig",
    # 智能体
    "subagents": "qilin.config.subagents_config:SubagentsAppConfig",
}

# 段缺失时的兜底默认值（仅对含必填字段的 section 需要，如 sandbox.use）。
# GET 端点读不到段时用这些值补齐必填字段，再让 pydantic 回填其余默认值。
_SECTION_FALLBACK: dict[str, dict[str, Any]] = {
    "sandbox": {"use": "qilin.sandbox.local:LocalSandboxProvider"},
}

# 顶层标量字段（挂在 yaml 根级，不在任何 section 内）。
# key → (python 类型, 引擎默认值, pydantic 约束 kwargs)
_TOP_LEVEL_FIELDS: dict[str, dict[str, Any]] = {
    "max_recursion_limit": {"type": int, "default": 1000, "ge": 1},
}

# 写入时从明文转 $ENV 引用的敏感字段路径（section → list of (nested keys, env factory)）
# 只处理桌面端会暴露给用户编辑的少数敏感字段。
_SENSITIVE_FIELDS: dict[str, list[tuple[list[str], str]]] = {
    "database": [
        (["postgres_url"], "KSTOCK_DATABASE_URL"),
    ],
    "memory": [
        (["backend_config", "model", "api_key"], "KSTOCK_MEMORY_MODEL_KEY"),
    ],
}


def _resolve_model(dotted: str) -> type[BaseModel]:
    """``"qilin.config.title_config:TitleConfig"`` → class。"""
    module_path, _, class_name = dotted.partition(":")
    import importlib

    module = importlib.import_module(module_path)
    return getattr(module, class_name)  # type: ignore[no-any-return]


def _validate_section(section: str, payload: dict[str, Any]) -> dict[str, Any]:
    """用引擎 pydantic 类校验 payload，返回 model_dump（含默认值回填）。

    校验失败抛 HTTPException(400)，detail 含字段级错误明细（方便前端定位）。
    """
    model_cls = _resolve_model(_SECTION_MODELS[section])
    try:
        instance = model_cls(**payload)
    except ValidationError as exc:
        errors = []
        for err in exc.errors():
            loc = ".".join(str(p) for p in err["loc"])
            errors.append({"field": loc or "(root)", "message": err["msg"], "type": err["type"]})
        raise HTTPException(
            status_code=400,
            detail={"code": "validation_failed", "message": f"{section} 配置校验失败", "errors": errors},
        ) from exc
    # exclude_none=False：让 None 显式写回 yaml（如 model_name: null 是合法配置）
    dumped = instance.model_dump()
    return _sanitize_for_yaml(dumped)


def _sanitize_for_yaml(value: Any) -> Any:
    """pydantic model_dump 递归转 dict/list，保留 None。"""
    if isinstance(value, dict):
        return {k: _sanitize_for_yaml(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize_for_yaml(v) for v in value]
    return value


def _extract_secret_refs(section: str, payload: dict[str, Any]) -> tuple[dict[str, Any], dict[str, str]]:
    """把明文敏感值抽出，payload 中的对应位置替换为 ``$ENV_NAME``。

    返回 (sanitized_payload, env_writes)。env_writes 是 env_name → value，
    由调用方写入 secrets.env。
    """
    sanitized = _sanitize_for_yaml(payload)
    env_writes: dict[str, str] = {}
    for keys, env_name in _SENSITIVE_FIELDS.get(section, []):
        node: Any = sanitized
        for k in keys[:-1]:
            if not isinstance(node, dict) or k not in node:
                node = None
                break
            node = node[k]
        if not isinstance(node, dict) or not keys:
            continue
        last_key = keys[-1]
        raw = node.get(last_key) if isinstance(node, dict) else None
        if not isinstance(raw, str) or not raw:
            continue
        if raw.startswith("$"):
            # 已经是 $ENV 引用，原样保留
            continue
        env_writes[env_name] = raw
        node[last_key] = f"${env_name}"
    return sanitized, env_writes


# ── 路由 ───────────────────────────────────────────────────────────────


class RuntimeConfigResponse(BaseModel):
    """所有配置段 + 顶层字段的合并响应。"""

    memory: dict[str, Any]
    summarization: dict[str, Any]
    title: dict[str, Any]
    database: dict[str, Any]
    sandbox: dict[str, Any]
    token_usage: dict[str, Any]
    token_budget: dict[str, Any]
    # 权限与护栏
    guardrails: dict[str, Any]
    authorization: dict[str, Any]
    input_polish: dict[str, Any]
    loop_detection: dict[str, Any]
    safety_finish_reason: dict[str, Any]
    # 搜索与来源
    tool_search: dict[str, Any]
    # 智能体
    subagents: dict[str, Any]
    # 顶层标量字段
    max_recursion_limit: int


class SectionUpdateResponse(BaseModel):
    section: str
    value: dict[str, Any]


@router.get("/runtime-config", response_model=RuntimeConfigResponse)
def get_runtime_config_endpoint() -> RuntimeConfigResponse:
    """读取 runtime.yaml 的所有配置段 + 顶层字段。

    段缺失时返回该段的 pydantic 默认值（含必填字段的 section 用兜底值补齐，
    保证前端总能拿到完整结构）。读的是文件内容，不是引擎单例——避免热重载
    时序导致的读写不一致。
    """
    cfg = load_runtime_config()
    result: dict[str, Any] = {}
    for section, dotted in _SECTION_MODELS.items():
        raw = cfg.get(section)
        if isinstance(raw, dict):
            result[section] = raw
        else:
            # 段缺失：用兜底默认值补齐必填字段（如 sandbox.use），再让 pydantic 回填
            model_cls = _resolve_model(dotted)
            fallback = _SECTION_FALLBACK.get(section, {})
            try:
                result[section] = model_cls().model_dump()
            except Exception:
                result[section] = model_cls(**fallback).model_dump()
    # 顶层标量字段：缺失时返回引擎默认值
    for field_name, spec in _TOP_LEVEL_FIELDS.items():
        raw = cfg.get(field_name)
        result[field_name] = raw if isinstance(raw, spec["type"]) else spec["default"]
    return RuntimeConfigResponse(**result)


@router.put("/runtime-config/{section}", response_model=SectionUpdateResponse)
def update_runtime_config_section_endpoint(section: str, payload: dict[str, Any]) -> SectionUpdateResponse:
    """更新 runtime.yaml 的单个配置段或顶层字段。

    - **标准 section**（memory / database / sandbox / ...）：body 为段 dict，
      pydantic 校验后原子写入 yaml。
    - **顶层字段**（max_recursion_limit）：body 为 ``{field: value}``，校验类型
      和约束后写到 yaml 根级。

    无效值返回 400 + 字段明细。
    """
    # ── 顶层标量字段分支 ──
    if section in _TOP_LEVEL_FIELDS:
        spec = _TOP_LEVEL_FIELDS[section]
        raw = payload.get(section)
        errors: list[dict[str, str]] = []
        if not isinstance(raw, spec["type"]):
            errors.append({
                "field": section,
                "message": f"{section} 必须是 {spec['type'].__name__}",
                "type": "type_error",
            })
        else:
            for op, limit in {k: v for k, v in spec.items() if k in ("ge", "le", "gt", "lt")}.items():
                if op == "ge" and raw < limit or op == "gt" and raw <= limit \
                        or op == "le" and raw > limit or op == "lt" and raw >= limit:
                    errors.append({
                        "field": section,
                        "message": f"{section} 不满足约束 {op} {limit}",
                        "type": "value_error",
                    })
        if errors:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "validation_failed",
                    "message": f"{section} 配置校验失败",
                    "errors": errors,
                },
            )
        cfg = load_runtime_config()
        cfg[section] = raw
        _atomic_write_yaml(_runtime_config_path(), cfg)
        return SectionUpdateResponse(section=section, value={section: raw})

    # ── 标准 section 分支 ──
    if section not in _SECTION_MODELS:
        raise HTTPException(
            status_code=400,
            detail=f"未知配置段 '{section}'，支持: {sorted(_SECTION_MODELS.keys())}",
        )

    validated = _validate_section(section, payload)
    sanitized, env_writes = _extract_secret_refs(section, validated)

    cfg = load_runtime_config()
    cfg[section] = sanitized
    _atomic_write_yaml(_runtime_config_path(), cfg)

    for env_name, value in env_writes.items():
        upsert_secret(env_name, value)

    return SectionUpdateResponse(section=section, value=sanitized)
