"""wait_for_background_task 工具测试：长任务单次等待语义。"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

import pytest

from scripts.kstock_tools.task_wait_tool import wait_for_background_task_tool


class FakeRuntime:
    """最小 runtime 替身：thread_data 提供宿主 workspace/outputs 路径。"""

    def __init__(self, workspace: Path):
        self.state = {
            "thread_data": {
                "workspace_path": str(workspace),
                "outputs_path": str(workspace / "outputs"),
            }
        }


@pytest.fixture()
def runtime(tmp_path: Path) -> FakeRuntime:
    work = tmp_path / "workspace"
    work.mkdir()
    return FakeRuntime(work)


def _invoke(runtime: FakeRuntime, **kwargs) -> dict:
    result = wait_for_background_task_tool.func(
        runtime,
        done_file=kwargs.pop("done_file", None),
        log_file=kwargs.pop("log_file", None),
        done_pattern=kwargs.pop("done_pattern", None),
        pid=kwargs.pop("pid", None),
        timeout_seconds=kwargs.pop("timeout_seconds", 30),
        poll_interval_seconds=kwargs.pop("poll_interval_seconds", 1),
    )
    return json.loads(result)


def test_missing_condition_returns_error(runtime: FakeRuntime):
    result = _invoke(runtime)
    assert "error" in result


def test_done_file_already_present_returns_immediately(runtime: FakeRuntime):
    work = Path(runtime.state["thread_data"]["workspace_path"])
    (work / "runner.done").write_text("done", encoding="utf-8")
    started = time.monotonic()
    result = _invoke(
        runtime,
        done_file="/mnt/user-data/workspace/runner.done",
        timeout_seconds=5,
    )
    assert result["done"] is True
    assert time.monotonic() - started < 3


def test_waits_for_background_process_to_write_flag(runtime: FakeRuntime):
    work = Path(runtime.state["thread_data"]["workspace_path"])
    # 后台进程 1.5 秒后写完成标记
    proc = subprocess.Popen(
        [
            sys.executable, "-c",
            "import time, pathlib; time.sleep(1.5); "
            "pathlib.Path('runner.log').write_text('step1\\nBACKTEST_DONE\\n', encoding='utf-8'); "
            "pathlib.Path('runner.done').write_text('done', encoding='utf-8')",
        ],
        cwd=work,
        # 全量套件下其他测试可能污染 PYTHONHOME/PYTHONPATH，导致子进程
        # 启动即 Fatal Python error；用最小干净环境启动。
        env={"PATH": os.environ.get("PATH", "")},
    )
    try:
        result = _invoke(
            runtime,
            log_file="/mnt/user-data/workspace/runner.log",
            done_pattern="BACKTEST_DONE",
            done_file="/mnt/user-data/workspace/runner.done",
            timeout_seconds=15,
            poll_interval_seconds=1,
        )
        assert result["done"] is True
        assert result["elapsed_seconds"] >= 1
        assert "BACKTEST_DONE" in result["log_tail"]
    finally:
        proc.wait(timeout=10)


def test_timeout_returns_pending_with_hint(runtime: FakeRuntime):
    started = time.monotonic()
    result = _invoke(
        runtime,
        done_file="/mnt/user-data/workspace/never.done",
        timeout_seconds=2,
        poll_interval_seconds=1,
    )
    assert result["done"] is False
    assert result["timeout"] is True
    assert "hint" in result
    assert time.monotonic() - started >= 2


def test_pid_exit_completes(runtime: FakeRuntime):
    proc = subprocess.Popen([sys.executable, "-c", "pass"])
    proc.wait(timeout=10)
    result = _invoke(runtime, pid=proc.pid, timeout_seconds=5, poll_interval_seconds=1)
    assert result["done"] is True


def test_pid_alive_win_exited_process(monkeypatch):
    """Windows 分支：OpenProcess 失败或退出码非 STILL_ACTIVE → 已退出。

    Windows 上 os.kill(pid, 0) 对刚退出的进程可能返回 None 而非抛异常
    （OpenProcess 对已终止但句柄仍被引用的 PID 仍会成功），存活探测
    必须用 OpenProcess + GetExitCodeProcess：仅 STILL_ACTIVE(259) 视为存活。
    """
    import sys
    import types

    from scripts.kstock_tools import task_wait_tool

    class FakeCULong:
        def __init__(self, value=0):
            self.value = value

    captured = {}

    def install_fake_ctypes(open_result, exit_code_value, get_exit_ok=True):
        class FakeKernel32:
            def OpenProcess(self, access, inherit, pid):
                captured["open"] = (access, inherit, pid)
                return open_result

            def GetExitCodeProcess(self, handle, buf):
                captured["get_exit"] = handle
                buf.value = exit_code_value
                return get_exit_ok

            def CloseHandle(self, handle):
                captured["close"] = handle

        fake = types.SimpleNamespace(
            windll=types.SimpleNamespace(kernel32=FakeKernel32()),
            c_ulong=FakeCULong,
            byref=lambda x: x,
        )
        monkeypatch.setitem(sys.modules, "ctypes", fake)

    # 进程不存在：OpenProcess 返回 0 → 已退出
    install_fake_ctypes(open_result=0, exit_code_value=0)
    assert task_wait_tool._pid_alive_win(12345) is False
    assert captured["open"] == (0x1000, False, 12345)

    # 进程存活：退出码 STILL_ACTIVE(259)
    install_fake_ctypes(open_result=0xABC, exit_code_value=259)
    assert task_wait_tool._pid_alive_win(12345) is True
    assert captured["close"] == 0xABC

    # 进程已退出：OpenProcess 成功但退出码 0
    install_fake_ctypes(open_result=0xABC, exit_code_value=0)
    assert task_wait_tool._pid_alive_win(12345) is False

    # 查询失败（进程正在退出）：保守视为存活
    install_fake_ctypes(open_result=0xABC, exit_code_value=0, get_exit_ok=False)
    assert task_wait_tool._pid_alive_win(12345) is True


def test_done_pattern_requires_log_file(runtime: FakeRuntime):
    result = _invoke(runtime, done_pattern="X")
    assert "error" in result
