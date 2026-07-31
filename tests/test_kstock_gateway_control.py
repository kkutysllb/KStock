"""KStock gateway 进程控制端点单元测试。

用 FastAPI TestClient 测试 ``/api/v1/kstock/restart`` 的两种路径：

- 无 supervisor（``KSTOCK_SUPERVISOR_PID`` 未设置）→ 503，提示手动重启
- 有 supervisor → 200，后台线程以 ``RESTART_EXIT_CODE`` 退出（mock ``os._exit``
  避免测试进程真的终止）
"""
import os
import time

from fastapi import FastAPI
from fastapi.testclient import TestClient

from scripts.kstock_gateway_control import (
    RESTART_EXIT_CODE,
    SUPERVISOR_PID_ENV,
    router,
)


def _client() -> TestClient:
    """构造只挂载 control router 的最小 FastAPI app。"""
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


# ── POST /api/v1/kstock/restart ─────────────────────────────────────


def test_restart_without_supervisor_returns_503(monkeypatch):
    """无 KSTOCK_SUPERVISOR_PID 时返回 503，detail.code = no_supervisor。"""
    monkeypatch.delenv(SUPERVISOR_PID_ENV, raising=False)
    client = _client()
    resp = client.post("/api/v1/kstock/restart")
    assert resp.status_code == 503
    detail = resp.json()["detail"]
    assert detail["code"] == "no_supervisor"
    assert "手动重启" in detail["message"]


def test_restart_with_supervisor_schedules_exit(monkeypatch):
    """有 KSTOCK_SUPERVISOR_PID 时返回 200 + supervised=True，且后台线程以 RESTART_EXIT_CODE 退出。

    mock ``os._exit`` 避免测试进程真的终止；记录退出码验证重启信号正确传递给 supervisor。
    """
    monkeypatch.setenv(SUPERVISOR_PID_ENV, "99999")
    exit_codes: list[int] = []
    monkeypatch.setattr(os, "_exit", lambda code: exit_codes.append(code))

    client = _client()
    resp = client.post("/api/v1/kstock/restart")

    assert resp.status_code == 200
    body = resp.json()
    assert body["supervised"] is True
    assert "重启" in body["message"]

    # 后台守护线程延迟 0.5s 调 os._exit；轮询等待执行完成（最多 0.8s）。
    for _ in range(80):
        if exit_codes:
            break
        time.sleep(0.01)
    assert exit_codes == [RESTART_EXIT_CODE]


def test_restart_endpoint_registered_in_openapi(monkeypatch):
    """路由注册到 OpenAPI schema，便于前端发现与联调。"""
    monkeypatch.delenv(SUPERVISOR_PID_ENV, raising=False)
    client = _client()
    schema = client.get("/openapi.json").json()
    assert "/api/v1/kstock/restart" in schema["paths"]
    post = schema["paths"]["/api/v1/kstock/restart"]["post"]
    assert post["operationId"] == "restart_gateway_api_v1_kstock_restart_post"
