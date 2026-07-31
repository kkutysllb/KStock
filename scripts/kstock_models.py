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
