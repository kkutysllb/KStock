"""Windows 兼容垫片：修正 vendor/qilin sandbox 在 Windows 下的两处上游 bug。

背景
----
``vendor/qilin/qilin/sandbox/tools.py`` 的 ``_apply_cwd_prefix`` 无条件给所有
bash 命令注入 ``cd <workspace> && <command>`` 前缀。但 Windows 下
``local_sandbox.py`` 的 ``execute_command`` 会根据检测到的 shell 用
PowerShell ``-Command`` 或 cmd.exe ``/c`` 执行：

- PowerShell 5.1 不支持 ``&&``（PowerShell 7+ 才支持）→ 解析失败
- cmd.exe 认 ``&&``，但 ``shlex.quote(workspace)`` 产生的 POSIX 引号
  在 cmd.exe 下可能被误解析

上游注释（tools.py 第 1807-1810 行）已意识到 Windows 问题，对
``identity_prefix``（``export X=Y`` 前缀）做了 Windows 跳过，但
``_apply_cwd_prefix`` 漏了同样处理。

方案
----
与 ``kstock_subprocess_patch`` 同样思路：在 gateway 入口最早阶段 monkeypatch
``qilin.sandbox.tools._apply_cwd_prefix``。Windows 上不注入 ``cd ... &&`` 前缀
（workspace 通过 ``subprocess.run(cwd=...)`` 或命令内显式 ``cd`` 处理已经足够，
sandbox.execute_command 的 env 注入独立于 cwd）。Unix 下完全保留原行为。

幂等：重复调用安全。上游修复后通过 sync_upstreams 同步，此垫片的 Windows
分支会被 ``_is_windows`` 跳过（若上游也修复），可随后移除。
"""

from __future__ import annotations

import sys
from typing import Any


def windows_cwd_prefix_shim(command: str, thread_data: Any) -> str:
    """Windows 上跳过 ``cd <workspace> &&`` 前缀注入。

    PowerShell 5.1 不认 ``&&``，cmd.exe 认 ``&&`` 但 shlex POSIX 引号可能误解析。
    workspace 定位由 sandbox.execute_command 的 env/cwd 或命令内显式 cd 处理，
    不依赖此前缀。

    幂等性：若上游已修复（不再注入前缀），此处原样返回 command 无副作用。
    """
    return command


def apply_windows_bash_cwd_prefix_shim() -> None:
    """Windows 上 monkeypatch ``_apply_cwd_prefix`` 跳过 ``cd ... &&`` 注入。

    幂等：已 patch 时直接返回（用 ``_kstock_cwd_prefix_patched`` 标记识别）。
    Unix 下 no-op。
    """
    if sys.platform != "win32":
        return

    try:
        from qilin.sandbox import tools as sandbox_tools
    except ImportError:
        # gateway 启动时 sandbox.tools 可能尚未 import；后续首次 import 时
        # 再调用本函数（run_gateway 在 _apply_vendor_*_shim 后再次调用）。
        return

    orig = getattr(sandbox_tools, "_apply_cwd_prefix", None)
    if orig is None:
        return
    if getattr(orig, "_kstock_cwd_prefix_patched", False):
        return

    # 保留原函数引用便于诊断（未使用，但记录以防未来需要 fallback）。
    windows_cwd_prefix_shim._kstock_orig = orig  # type: ignore[attr-defined]
    windows_cwd_prefix_shim._kstock_cwd_prefix_patched = True  # type: ignore[attr-defined]
    # Python 模块内函数调用走 LOAD_GLOBAL，从模块 __dict__ 查找，
    # monkeypatch 模块属性 = 修改模块 globals，对同模块内调用（tools.py:1806）生效。
    sandbox_tools._apply_cwd_prefix = windows_cwd_prefix_shim  # type: ignore[assignment]
