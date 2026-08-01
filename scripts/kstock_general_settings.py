"""KStock 用户级桌面常规设置。

桌面偏好属于 KStock 产品层，不写入 QiLin runtime.yaml。每个登录用户在
``product/preferences`` 下拥有独立 JSON 文件，写入采用临时文件 + 原子替换。
"""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
import threading
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from qilin.runtime.user_context import get_effective_user_id


router = APIRouter(prefix="/api/v1/kstock", tags=["kstock-general-settings"])
_write_lock = threading.Lock()


class GeneralPreferences(BaseModel):
    """可由桌面端立即应用的常规偏好。"""

    model_config = ConfigDict(extra="forbid")

    density: Literal["comfortable", "compact"] = "comfortable"
    reduce_motion: bool = False
    sidebar_collapsed: bool = False
    history_collapsed: bool = False
    auto_scroll: bool = True
    show_stage: bool = True
    show_reasoning: bool = True
    show_tool_calls: bool = True
    restore_last_session: bool = True
    create_session_when_empty: bool = False
    send_shortcut: Literal["enter", "mod_enter"] = "mod_enter"
    keep_draft_after_send: bool = False
    keep_attachments_after_send: bool = False


class GeneralSettingsResponse(BaseModel):
    preferences: GeneralPreferences


DEFAULT_PREFERENCES = GeneralPreferences()


def _data_root() -> Path:
    return Path(os.environ["KSTOCK_APP_DATA_DIR"])


def _preferences_path(user_id: str | None = None) -> Path:
    identity = user_id or get_effective_user_id()
    digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:32]
    return _data_root() / "product" / "preferences" / f"{digest}.json"


def _read_preferences(user_id: str) -> GeneralPreferences:
    path = _preferences_path(user_id)
    if not path.exists():
        return DEFAULT_PREFERENCES.model_copy(deep=True)
    try:
        with path.open("r", encoding="utf-8") as fh:
            payload = json.load(fh)
        preferences = payload.get("preferences") if isinstance(payload, dict) else None
        if not isinstance(preferences, dict):
            raise ValueError("preferences must be an object")
        return GeneralPreferences.model_validate(preferences)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(status_code=500, detail="常规设置文件损坏，请联系管理员处理") from exc


def _atomic_write(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".general_settings_", suffix=".json", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2)
            fh.write("\n")
        os.replace(temporary, path)
    except Exception:
        if os.path.exists(temporary):
            os.remove(temporary)
        raise


@router.get("/general-settings", response_model=GeneralSettingsResponse)
def get_general_settings() -> GeneralSettingsResponse:
    user_id = get_effective_user_id()
    return GeneralSettingsResponse(preferences=_read_preferences(user_id))


@router.put("/general-settings", response_model=GeneralSettingsResponse)
def update_general_settings(preferences: GeneralPreferences) -> GeneralSettingsResponse:
    user_id = get_effective_user_id()
    path = _preferences_path(user_id)
    payload = {
        "version": 1,
        "user_id": user_id,
        "preferences": preferences.model_dump(),
    }
    with _write_lock:
        _atomic_write(path, payload)
    return GeneralSettingsResponse(preferences=preferences)
