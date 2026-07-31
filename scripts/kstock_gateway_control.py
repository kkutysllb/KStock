"""KStock gateway 进程控制端点。

提供 gateway 自身的生命周期管理端点（当前仅重启）。gateway 是独立 uvicorn
进程，无法自己重启自己——重启依赖 ``scripts/run_gateway.py`` 的 supervisor
模式：

- supervisor 父进程启动并监控子进程（真正的 uvicorn server）
- 子进程以 ``RESTART_EXIT_CODE`` 退出时，supervisor 自动重启子进程
- ``/restart`` 端点触发子进程以该退出码退出

若 gateway 不是由 supervisor 启动（如 pytest 直接导入、或手动 ``uvicorn``
模块加载），``/restart`` 返回 503，提示用户手动重启 gateway 进程。
"""
from __future__ import annotations

import os
import threading
import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# 子进程以此退出码告诉 supervisor「请重启我」。
# 选 42：避开 0=成功、1=通用错误、2=shell 误用等常见退出码，语义清晰。
RESTART_EXIT_CODE = 42

# supervisor 启动子进程时注入此环境变量，值为 supervisor 的 PID。
# /restart 端点据此判断当前进程是否受 supervisor 管理。
SUPERVISOR_PID_ENV = "KSTOCK_SUPERVISOR_PID"

router = APIRouter(prefix="/api/v1/kstock", tags=["kstock-gateway-control"])


class RestartResponse(BaseModel):
    """重启请求的响应。"""

    message: str
    supervised: bool


@router.post("/restart", response_model=RestartResponse)
def restart_gateway() -> RestartResponse:
    """请求 gateway 重启。

    若当前进程由 supervisor 管理（``KSTOCK_SUPERVISOR_PID`` 已设置），则在
    后台守护线程延迟 0.5s 后以 ``RESTART_EXIT_CODE`` 退出——让 HTTP 响应先
    返回给前端；supervisor 检测到退出码后自动重启干净的子进程，使配置变更
    （如数据库后端切换、secrets 更新）完全生效。

    若无 supervisor（pytest / 直接 uvicorn 加载），返回 503，提示手动重启。
    """
    supervised = bool(os.environ.get(SUPERVISOR_PID_ENV))

    if not supervised:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "no_supervisor",
                "message": "当前 gateway 未在 supervisor 模式下运行，无法自动重启。请手动重启 gateway 进程。",
            },
        )

    def _exit_with_restart_code() -> None:
        # 等响应发完再退出：uvicorn 异步发响应，0.5s 足够前端收到。
        time.sleep(0.5)
        # os._exit 绕过 atexit / finally / buffer flush，立即终止进程，
        # 把控制权交还给 supervisor 的 proc.wait()。
        os._exit(RESTART_EXIT_CODE)

    threading.Thread(target=_exit_with_restart_code, daemon=True).start()
    return RestartResponse(
        message="重启请求已收到，gateway 将在约 1 秒后重启。",
        supervised=True,
    )
