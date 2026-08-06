"""Windows 子进程无窗口补丁单元测试。

覆盖：
- ``merge_creationflags_no_window`` 纯函数跨平台契约
- ``apply_subprocess_no_window_patch`` monkeypatch 幂等性 + 非 Windows no-op
"""

from __future__ import annotations

import subprocess

from scripts.kstock_subprocess_patch import (
    CREATE_NO_WINDOW,
    apply_subprocess_no_window_patch,
    merge_creationflags_no_window,
)


class TestMergeCreationflagsNoWindow:
    """纯函数 ``merge_creationflags_no_window`` 的跨平台契约。"""

    def test_windows_zero_flags_gets_no_window(self) -> None:
        """Windows 上未设任何 flag 时注入 CREATE_NO_WINDOW。"""
        assert merge_creationflags_no_window(0, "win32") == CREATE_NO_WINDOW

    def test_windows_existing_flags_preserved_and_merged(self) -> None:
        """Windows 上已有 creationflags 时 OR 合并，不覆盖。"""
        existing = 0x00000001  # 例如 CREATE_NEW_PROCESS_GROUP
        result = merge_creationflags_no_window(existing, "win32")
        assert result == existing | CREATE_NO_WINDOW
        # 原 flag 仍保留
        assert result & existing

    def test_windows_already_has_no_window_is_idempotent(self) -> None:
        """已含 CREATE_NO_WINDOW 时幂等（不重复加）。"""
        result = merge_creationflags_no_window(CREATE_NO_WINDOW, "win32")
        assert result == CREATE_NO_WINDOW

    def test_darwin_is_noop(self) -> None:
        """macOS 上原样返回（creationflags 在 Unix 不被识别）。"""
        assert merge_creationflags_no_window(0, "darwin") == 0
        assert merge_creationflags_no_window(CREATE_NO_WINDOW, "darwin") == CREATE_NO_WINDOW

    def test_linux_is_noop(self) -> None:
        """Linux 上原样返回。"""
        assert merge_creationflags_no_window(0, "linux") == 0

    def test_none_flags_treated_as_zero(self) -> None:
        """传入 None（默认 kwargs.get 返回 None）时按 0 处理。"""
        # 纯函数签名要求 int，但 monkeypatch 内部用 `or 0` 兜底，验证等价语义
        assert merge_creationflags_no_window(int(None or 0), "win32") == CREATE_NO_WINDOW


class TestApplySubprocessNoWindowPatch:
    """``apply_subprocess_no_window_patch`` 的 monkeypatch 行为。"""

    def test_constant_value_matches_windows_winbase(self) -> None:
        """CREATE_NO_WINDOW 常量值与 Windows SDK 一致（0x08000000）。"""
        assert CREATE_NO_WINDOW == 0x08000000
        # Python 3.7+ subprocess 模块的标准常量也应一致（仅 Windows 有定义）
        python_const = getattr(subprocess, "CREATE_NO_WINDOW", CREATE_NO_WINDOW)
        assert python_const == CREATE_NO_WINDOW

    def test_idempotent_marker_set_after_patch(self) -> None:
        """patch 后 Popen.__init__ 带 ``_kstock_no_window_patched`` 标记。

        因测试在 Unix 上跑，``apply_subprocess_no_window_patch`` 会提前 return
        （非 win32 no-op），标记不会被设置——验证这一点。
        """
        import sys

        if sys.platform == "win32":
            apply_subprocess_no_window_patch()
            first_init = subprocess.Popen.__init__
            apply_subprocess_no_window_patch()  # 第二次调用应幂等
            second_init = subprocess.Popen.__init__
            # 第二次调用不替换 __init__（识别标记后提前返回）
            assert first_init is second_init
            assert getattr(second_init, "_kstock_no_window_patched", False) is True
        else:
            # Unix 上 no-op，标记不应被设置
            apply_subprocess_no_window_patch()
            assert getattr(
                subprocess.Popen.__init__, "_kstock_no_window_patched", False
            ) is False
