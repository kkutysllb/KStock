"""KStock 模型配置写入层。

引擎 vendor/qilin 的 GET /api/models 只读、无写入端点，但配置文件 mtime
变化后 get_app_config() 自动热重载。本模块提供 KStock 自有的 CRUD 端点，
改写 qilin.runtime.yaml 的 models 段，并把 API key 明文写到独立的
secrets.env（runtime.yaml 只存 $ENV 引用），二者都落在用户数据空间。

默认模型是前端偏好（引擎 AppConfig 无 default_model 字段），存到独立的
prefs.json，与 runtime.yaml 解耦。
"""
from __future__ import annotations

import json
import os
import re
import shutil
import tempfile
from pathlib import Path
from typing import Any

import yaml
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

router = APIRouter(prefix="/api/v1/kstock", tags=["kstock-models"])


def _data_root() -> Path:
    """返回当前 KStock 用户数据根目录（由 run_gateway.py 注入环境变量）。"""
    return Path(os.environ["KSTOCK_APP_DATA_DIR"])


def _runtime_config_path() -> Path:
    return Path(os.environ["QILIN_CONFIG_PATH"])


def _secrets_env_path() -> Path:
    return _data_root() / "config" / "secrets.env"


def _prefs_path() -> Path:
    return _data_root() / "config" / "prefs.json"


def _backups_dir() -> Path:
    d = _data_root() / "backups"
    d.mkdir(parents=True, exist_ok=True)
    return d


def env_name_for_model(name: str) -> str:
    """模型 name → 环境变量名 KSTOCK_MODEL_<UPPER_NAME>_KEY。

    非字母数字字符转下划线，再去掉首尾下划线，最后加固定前后缀。
    """
    upper = re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_").upper()
    if not upper:
        raise ValueError(f"模型 name 无法转为合法环境变量名: {name!r}")
    return f"KSTOCK_MODEL_{upper}_KEY"


def load_runtime_config() -> dict[str, Any]:
    """读 runtime.yaml 为 dict；文件不存在时返回空 dict。"""
    path = _runtime_config_path()
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def load_runtime_models() -> list[dict[str, Any]]:
    """读 runtime.yaml 的 models 段；无则返回空列表。"""
    cfg = load_runtime_config()
    models = cfg.get("models")
    if not isinstance(models, list):
        return []
    return [m for m in models if isinstance(m, dict)]


def _atomic_write_yaml(path: Path, data: dict[str, Any]) -> None:
    """备份原文件后，用临时文件 + os.replace 原子替换。"""
    if path.exists():
        backup_name = f"{path.name}.{int(path.stat().st_mtime * 1000)}.bak"
        shutil.copy2(path, _backups_dir() / backup_name)
    path.parent.mkdir(parents=True, exist_ok=True)
    directory = str(path.parent)
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            yaml.safe_dump(data, fh, allow_unicode=True, sort_keys=False)
        os.replace(tmp, path)
    except Exception:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


def save_runtime_models(models: list[dict[str, Any]]) -> None:
    """更新 runtime.yaml 的 models 段（保留其他段），原子替换。"""
    cfg = load_runtime_config()
    cfg["models"] = models
    _atomic_write_yaml(_runtime_config_path(), cfg)


# ── secrets.env 读写 ────────────────────────────────────────────────
def _load_secrets_lines() -> list[str]:
    path = _secrets_env_path()
    if not path.exists():
        return []
    return path.read_text(encoding="utf-8").splitlines()


def _write_secrets_lines(lines: list[str]) -> None:
    path = _secrets_env_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    is_new = not path.exists()
    fd, tmp = tempfile.mkstemp(prefix=".secrets.env.", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write("\n".join(lines))
            if lines:
                fh.write("\n")
        os.replace(tmp, path)
    except Exception:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise
    # 仅 Unix 有意义：文件创建即收紧权限
    if is_new and os.name != "nt":
        os.chmod(path, 0o600)


def upsert_secret(key: str, value: str) -> None:
    """写入或覆盖一个 KEY="value" 行；保持其他行不变。"""
    lines = _load_secrets_lines()
    target = f'{key}='
    found = False
    for i, line in enumerate(lines):
        if line.startswith(target):
            lines[i] = f'{key}="{value}"'
            found = True
            break
    if not found:
        lines.append(f'{key}="{value}"')
    _write_secrets_lines(lines)


def remove_secret(key: str) -> None:
    """删除指定 KEY= 行；文件不存在或无此 key 时无副作用。"""
    lines = _load_secrets_lines()
    target = f'{key}='
    filtered = [line for line in lines if not line.startswith(target)]
    if len(filtered) == len(lines):
        return
    _write_secrets_lines(filtered)


# ── Pydantic 请求/响应模型 ─────────────────────────────────────────────
class ModelWritePayload(BaseModel):
    """前端提交的模型写入负载。api_key 留空表示不修改。"""
    name: str = Field(..., min_length=1)
    display_name: str | None = None
    description: str | None = None
    use: str = Field(..., min_length=1)           # provider class path
    model: str = Field(..., min_length=1)         # 模型标识
    api_base: str | None = None                   # endpoint（OpenAI 系）
    api_key: str | None = None                    # 明文；None=不改，非空=写入
    supports_thinking: bool = False
    supports_vision: bool = False
    supports_reasoning_effort: bool = False

    @field_validator("api_key", mode="before")
    @classmethod
    def _blank_to_none(cls, v: str | None) -> str | None:
        """空字符串视为未提供（不修改现有 key）。"""
        return v if v else None


class ModelItem(BaseModel):
    """返回给前端的模型条目。api_key_env 是 $ENV 引用，非明文。"""
    name: str
    display_name: str | None = None
    description: str | None = None
    use: str
    model: str
    api_base: str | None = None
    api_key_env: str | None = None
    supports_thinking: bool = False
    supports_vision: bool = False
    supports_reasoning_effort: bool = False


# ── 偏好（prefs.json，引擎无关）──────────────────────────────────────
def _load_prefs() -> dict[str, Any]:
    path = _prefs_path()
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8")) or {}
    except json.JSONDecodeError:
        return {}


def _save_prefs(prefs: dict[str, Any]) -> None:
    path = _prefs_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".prefs.", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(prefs, fh, ensure_ascii=False, indent=2)
        os.replace(tmp, path)
    except Exception:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


def get_default_model() -> str | None:
    return _load_prefs().get("default_model")


def set_default_model(name: str | None) -> None:
    prefs = _load_prefs()
    if name is None:
        prefs.pop("default_model", None)
    else:
        prefs["default_model"] = name
    _save_prefs(prefs)


# ── 内部转换 ─────────────────────────────────────────────────────────
def _model_to_item(raw: dict[str, Any]) -> ModelItem:
    """runtime.yaml 里的一行 → 返回给前端的 ModelItem（api_key 转 env 引用）。"""
    return ModelItem(
        name=raw["name"],
        display_name=raw.get("display_name"),
        description=raw.get("description"),
        use=raw["use"],
        model=raw["model"],
        api_base=raw.get("api_base"),
        api_key_env=raw.get("api_key"),
        supports_thinking=bool(raw.get("supports_thinking", False)),
        supports_vision=bool(raw.get("supports_vision", False)),
        supports_reasoning_effort=bool(raw.get("supports_reasoning_effort", False)),
    )


def _payload_to_raw(payload: ModelWritePayload) -> dict[str, Any]:
    """前端负载 → runtime.yaml 行；api_key 转为 $ENV 引用。"""
    env_var = env_name_for_model(payload.name)
    raw: dict[str, Any] = {
        "name": payload.name,
        "use": payload.use,
        "model": payload.model,
        "api_key": f"${env_var}",
    }
    if payload.display_name is not None:
        raw["display_name"] = payload.display_name
    if payload.description is not None:
        raw["description"] = payload.description
    if payload.api_base:
        raw["api_base"] = payload.api_base
    if payload.supports_thinking:
        raw["supports_thinking"] = True
    if payload.supports_vision:
        raw["supports_vision"] = True
    if payload.supports_reasoning_effort:
        raw["supports_reasoning_effort"] = True
    return raw


# ── 路由 ───────────────────────────────────────────────────────────────
@router.get("/models")
def list_models_endpoint() -> dict[str, Any]:
    items = [_model_to_item(r).model_dump() for r in load_runtime_models()]
    return {"models": items, "default_model": get_default_model()}


@router.post("/models", status_code=201)
def create_model_endpoint(payload: ModelWritePayload) -> ModelItem:
    models = load_runtime_models()
    if any(m.get("name") == payload.name for m in models):
        raise HTTPException(status_code=409, detail=f"模型 '{payload.name}' 已存在")
    raw = _payload_to_raw(payload)
    models.append(raw)
    save_runtime_models(models)
    if payload.api_key:
        upsert_secret(env_name_for_model(payload.name), payload.api_key)
    return _model_to_item(raw)


@router.put("/models/{name}")
def update_model_endpoint(name: str, payload: ModelWritePayload) -> ModelItem:
    if payload.name != name:
        raise HTTPException(status_code=400, detail="name 不可变更")
    models = load_runtime_models()
    idx = next((i for i, m in enumerate(models) if m.get("name") == name), None)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"模型 '{name}' 不存在")
    raw = _payload_to_raw(payload)
    models[idx] = raw
    save_runtime_models(models)
    if payload.api_key:
        upsert_secret(env_name_for_model(payload.name), payload.api_key)
    return _model_to_item(raw)


@router.delete("/models/{name}", status_code=204)
def delete_model_endpoint(name: str) -> None:
    models = load_runtime_models()
    filtered = [m for m in models if m.get("name") != name]
    if len(filtered) == len(models):
        raise HTTPException(status_code=404, detail=f"模型 '{name}' 不存在")
    save_runtime_models(filtered)
    # secrets.env 删对应 key（name 无法生成合法环境变量名时无副作用）
    try:
        remove_secret(env_name_for_model(name))
    except ValueError:
        pass


class DefaultModelPayload(BaseModel):
    default_model: str | None = None


@router.get("/default-model")
def get_default_model_endpoint() -> dict[str, Any]:
    return {"default_model": get_default_model()}


@router.put("/default-model")
def set_default_model_endpoint(payload: DefaultModelPayload) -> dict[str, Any]:
    set_default_model(payload.default_model)
    return {"default_model": get_default_model()}
