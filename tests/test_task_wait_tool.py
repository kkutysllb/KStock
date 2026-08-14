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


def test_done_pattern_requires_log_file(runtime: FakeRuntime):
    result = _invoke(runtime, done_pattern="X")
    assert "error" in result
