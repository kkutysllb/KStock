"""KStock 常规偏好（general-settings）单元测试。

验证 notify_task_done（任务完成系统通知开关）的默认值与 GET/PUT 往返，
以及 extra="forbid" 下旧客户端缺字段仍可读取（新增字段带默认值）。
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from scripts.kstock_general_settings import (
    DEFAULT_PREFERENCES,
    GeneralPreferences,
    router,
)


def _client_under(tmp_path: Path, monkeypatch) -> TestClient:
    config_dir = tmp_path / "config"
    config_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv("KSTOCK_APP_DATA_DIR", str(tmp_path))
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def test_notify_task_done_defaults_true():
    assert GeneralPreferences().notify_task_done is True
    assert DEFAULT_PREFERENCES.notify_task_done is True


def test_notify_task_done_roundtrip_via_api(tmp_path, monkeypatch):
    client = _client_under(tmp_path, monkeypatch)

    body = client.get("/api/v1/kstock/general-settings").json()
    assert body["preferences"]["notify_task_done"] is True

    updated = client.put(
        "/api/v1/kstock/general-settings",
        json={**body["preferences"], "notify_task_done": False},
    )
    assert updated.status_code == 200
    assert updated.json()["preferences"]["notify_task_done"] is False

    # 重启后（重新 GET）仍读到关闭状态
    again = client.get("/api/v1/kstock/general-settings").json()
    assert again["preferences"]["notify_task_done"] is False


def test_legacy_payload_without_notify_field_still_parses():
    """旧前端（无 notify_task_done 字段）PUT 的负载可解析，字段取默认值。"""
    legacy = GeneralPreferences.model_validate(
        {
            "density": "compact",
            "reduce_motion": False,
            "sidebar_collapsed": False,
            "history_collapsed": False,
            "auto_scroll": True,
            "show_stage": True,
            "show_reasoning": True,
            "show_tool_calls": True,
            "restore_last_session": True,
            "create_session_when_empty": False,
            "send_shortcut": "enter",
            "keep_draft_after_send": False,
            "keep_attachments_after_send": False,
        }
    )
    assert legacy.density == "compact"
    assert legacy.notify_task_done is True
