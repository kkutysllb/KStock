"""Windows 子进程无窗口补丁：抑制 gateway spawn 子进程时的 cmd 黑窗。

背景
----
``kstock-gateway.exe`` 用 PyInstaller 打包，spec 里 ``console=False``（windowed
子系统），gateway 进程本身无控制台。当 gateway(Python) 用 ``subprocess.Popen``
spawn 子进程时（执行任务、技能脚本、sandbox 命令、akshare 等），Windows 会为
新进程创建一个**可见的 console 窗口**（因为没有可继承的 console），用户看到
cmd 一闪而逝，任务执行过程中反复弹窗。

vendor/qilin 与技能脚本里有 25+ 处 ``subprocess.run/Popen`` 调用，全都没设
``creationflags=CREATE_NO_WINDOW``。这些是上游代码，逐个改会被
``scripts/sync_upstreams.py`` 覆盖；且技能包脚本随 PyInstaller 资源走，改了
也不会重新打包。

方案
----
在 gateway 入口（``run_gateway.py``）最早阶段 monkeypatch ``subprocess.Popen``，
Windows 上自动给所有调用注入 ``CREATE_NO_WINDOW`` flag（与调用方已有的
``creationflags`` OR 合并）。全局兜底，覆盖 vendor / 技能 / sandbox / 工具脚本
里全部 subprocess 调用，无需改上游代码。

Unix 下完全 no-op（``creationflags`` 在 Unix 上不被识别，且本身也无窗口概念）。

幂等：重复调用安全（已 patch 时直接返回）。
"""

from __future__ import annotations

import sys

# Windows CREATE_NO_WINDOW flag（winbase.h）：子进程不创建 console 窗口。
# Python 3.7+ subprocess 模块已暴露此常量，但 PyInstaller frozen 环境下
# 显式定义常量值更稳妥（不依赖 import 时序）。
CREATE_NO_WINDOW = 0x08000000


def merge_creationflags_no_window(
    creationflags: int,
    platform_name: str,
) -> int:
    """合并 ``CREATE_NO_WINDOW`` flag（纯函数，便于单元测试）。

    - 非 Windows（``platform_name != "win32"``）原样返回：Unix 不识别
      ``creationflags`` 参数，注入会令 ``Popen`` 抛 ``TypeError``。
    - Windows：将 ``CREATE_NO_WINDOW`` OR 进原 flags，幂等（已含不重复加）。

    >>> merge_creationflags_no_window(0, "win32")
    134217728
    >>> merge_creationflags_no_window(CREATE_NO_WINDOW, "win32")  # 已含，幂等
    134217728
    >>> merge_creationflags_no_window(0x00000001, "win32")  # 与已有 flag OR
    134217729
    >>> merge_creationflags_no_window(0, "darwin")  # 非 Windows no-op
    0
    >>> merge_creationflags_no_window(0, "linux")
    0
    """
    if platform_name != "win32":
        return creationflags
    return int(creationflags or 0) | CREATE_NO_WINDOW


def apply_subprocess_no_window_patch() -> None:
    """Windows 上 monkeypatch ``subprocess.Popen`` 全局注入 ``CREATE_NO_WINDOW``。

    幂等：已 patch 时直接返回（用 ``_kstock_no_window_patched`` 标记识别）。
    Unix 下 no-op（``sys.platform != "win32"`` 提前返回）。

    覆盖范围：所有后续 ``subprocess.Popen / run / call / check_call /
    check_output`` 调用（它们内部都走 ``Popen.__init__``）。
    """
    if sys.platform != "win32":
        return

    import subprocess

    orig_init = subprocess.Popen.__init__
    if getattr(orig_init, "_kstock_no_window_patched", False):
        return

    def _patched_init(self, *args: object, **kwargs: object) -> object:
        existing = int(kwargs.get("creationflags", 0) or 0)  # type: ignore[arg-type]
        kwargs["creationflags"] = merge_creationflags_no_window(existing, "win32")  # type: ignore[index]
        return orig_init(self, *args, **kwargs)  # type: ignore[return-value]

    _patched_init._kstock_no_window_patched = True  # type: ignore[attr-defined]
    subprocess.Popen.__init__ = _patched_init  # type: ignore[assignment]
