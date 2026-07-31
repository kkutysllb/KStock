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
from pydantic import BaseModel, Field

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
