"""后台长任务等待工具：单次调用、服务端阻塞等待，替代 sleep/tail 轮询。

背景：超过 bash 工具 600 秒超时的命令（如 500 只×2 年全样本回测）必须
nohup 后台化；此后 agent 若用 sleep+tail 轮询，会撞上循环检测
（相同参数调用 5 次硬停）或耗尽轮次。本工具把「等待完成」收敛为一次
工具调用：网关进程内按间隔检查完成条件，直到完成或超时，返回日志尾部。

推荐后台命令收尾方式（在启动后台任务的 bash 命令里）：
    nohup python3 portfolio_runner.py > runner.log 2>&1 && echo done > runner.done &
然后调用本工具传 log_file=runner.log 与 done_file=runner.done。
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any, Annotated, Optional

from langchain.tools import tool

from qilin.sandbox.tools import resolve_and_validate_user_data_path
from qilin.tools.types import Runtime

_MAX_TIMEOUT_SECONDS = 2 * 60 * 60  # 单次等待上限 2 小时
_DEFAULT_TIMEOUT_SECONDS = 30 * 60
_MIN_POLL_SECONDS = 2
_TAIL_LINES = 40


def _error(message: str) -> str:
    return json.dumps({"error": message}, ensure_ascii=False)


def _thread_data(runtime: Any) -> dict[str, Any]:
    state = getattr(runtime, "state", None)
    if isinstance(state, dict) and isinstance(state.get("thread_data"), dict):
        return state["thread_data"]
    return {}


def _resolve_user_data_path(runtime: Any, container_path: str) -> Path:
    thread_data = dict(_thread_data(runtime))
    if "workspace_path" not in thread_data and thread_data.get("outputs_path"):
        outputs = Path(str(thread_data["outputs_path"])).resolve()
        thread_data["workspace_path"] = str(outputs.parent / "workspace")
    return Path(resolve_and_validate_user_data_path(container_path, thread_data)).resolve()


def _tail(path: Path, lines: int = _TAIL_LINES) -> str:
    try:
        content = path.read_text(encoding="utf-8", errors="replace")
        return "\n".join(content.splitlines()[-lines:])
    except OSError:
        return ""


def _pid_alive_win(pid: int) -> bool:
    """Windows 进程存活探测：OpenProcess + GetExitCodeProcess。

    Windows 上 os.kill(pid, 0) 不可靠：对刚退出的进程可能返回 None
    （OpenProcess 对已终止但句柄仍被引用的 PID 仍会成功），无法区分
    存活与已退出。改为标准做法：PROCESS_QUERY_LIMITED_INFORMATION
    打开进程，GetExitCodeProcess 返回 STILL_ACTIVE(259) 才算存活。
    """
    import ctypes

    kernel32 = ctypes.windll.kernel32
    process = kernel32.OpenProcess(0x1000, False, pid)  # QUERY_LIMITED_INFORMATION
    if not process:
        return False  # 进程不存在或无权查询，视为已退出
    try:
        exit_code = ctypes.c_ulong()
        if not kernel32.GetExitCodeProcess(process, ctypes.byref(exit_code)):
            return True  # 查询失败（进程将退出）保守视为存活
        return exit_code.value == 259  # STILL_ACTIVE
    finally:
        kernel32.CloseHandle(process)


def _pid_alive(pid: int) -> bool:
    if os.name == "nt":
        return _pid_alive_win(pid)
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True  # 进程存在但属主不同，视为存活


@tool("wait_for_background_task", parse_docstring=True)
def wait_for_background_task_tool(
    runtime: Runtime,
    done_file: Optional[str] = None,
    log_file: Optional[str] = None,
    done_pattern: Optional[str] = None,
    pid: Optional[int] = None,
    timeout_seconds: int = _DEFAULT_TIMEOUT_SECONDS,
    poll_interval_seconds: int = 5,
) -> str:
    """等待后台长任务完成（单次调用阻塞等待，替代 sleep/tail 轮询）。

    适用场景：nohup 后台化的回测/批处理等长命令（超过 bash 工具 600 秒
    超时的都必须后台化）。启动后台任务时建议以
    ``nohup <命令> > runner.log 2>&1 && echo done > runner.done &`` 收尾，
    然后调用本工具传 log_file 与 done_file。完成条件为所传条件的交集：
    done_file 存在、log_file 中出现 done_pattern、pid 退出（三者中传了
    的都要满足）。等待期间不消耗轮次，也不会触发循环检测。

    Args:
        done_file: 完成标记文件（/mnt/user-data/... 容器路径），存在即完成。
        log_file: 日志文件（/mnt/user-data/... 容器路径），用于判定 done_pattern 与返回尾部。
        done_pattern: log_file 中出现该字符串即视为完成（如 "BACKTEST_DONE"）。
        pid: 后台进程 PID（宿主进程号），退出即完成。注意：孤儿进程可能
            变僵尸导致误判存活，务必优先使用 done_file / done_pattern。
        timeout_seconds: 最长等待秒数（默认 1800，上限 7200）。
        poll_interval_seconds: 检查间隔秒数（默认 5，最小 2）。
    """
    try:
        if done_file is None and done_pattern is None and pid is None:
            return _error("至少提供 done_file / done_pattern / pid 中的一个完成条件")
        if done_pattern is not None and log_file is None:
            return _error("done_pattern 需要同时提供 log_file")

        timeout_seconds = max(1, min(int(timeout_seconds), _MAX_TIMEOUT_SECONDS))
        poll_interval_seconds = max(_MIN_POLL_SECONDS, int(poll_interval_seconds))

        done_path = _resolve_user_data_path(runtime, done_file) if done_file else None
        log_path = _resolve_user_data_path(runtime, log_file) if log_file else None

        started = time.monotonic()
        while True:
            conditions: list[bool] = []
            if done_path is not None:
                conditions.append(done_path.exists())
            if log_path is not None and done_pattern is not None:
                conditions.append(done_pattern in _tail(log_path, lines=400))
            if pid is not None:
                conditions.append(not _pid_alive(int(pid)))
            if conditions and all(conditions):
                elapsed = int(time.monotonic() - started)
                return json.dumps(
                    {
                        "done": True,
                        "elapsed_seconds": elapsed,
                        "log_tail": _tail(log_path) if log_path else "",
                    },
                    ensure_ascii=False,
                )
            if time.monotonic() - started >= timeout_seconds:
                return json.dumps(
                    {
                        "done": False,
                        "timeout": True,
                        "elapsed_seconds": int(time.monotonic() - started),
                        "log_tail": _tail(log_path) if log_path else "",
                        "hint": "任务仍在运行：可用更长的 timeout_seconds 再次调用本工具续等（一次续等调用不影响循环检测）。",
                    },
                    ensure_ascii=False,
                )
            time.sleep(poll_interval_seconds)
    except Exception as exc:  # noqa: BLE001 工具层统一兜底
        return _error(f"等待后台任务失败：{exc}")
