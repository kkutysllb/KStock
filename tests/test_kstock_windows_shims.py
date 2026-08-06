"""Windows sandbox 兼容垫片单元测试。

覆盖：
- ``windows_cwd_prefix_shim`` 跳过 ``cd ... &&`` 注入的纯函数行为
- ``apply_windows_bash_cwd_prefix_shim`` monkeypatch 幂等性 + 非 Windows no-op
"""

from __future__ import annotations

import sys
from typing import Any

import pytest

from scripts.kstock_windows_shims import (
    apply_windows_bash_cwd_prefix_shim,
    windows_cwd_prefix_shim,
)


class TestWindowsCwdPrefixShim:
    """``windows_cwd_prefix_shim`` 纯函数契约。"""

    def test_returns_command_unchanged(self) -> None:
        """垫片原样返回 command，不注入任何前缀。"""
        cmd = "python3 -m market_linkage_engine daily 20260805"
        assert windows_cwd_prefix_shim(cmd, None) == cmd

    def test_ignores_thread_data_workspace(self) -> None:
        """有 workspace_path 也不注入 cd 前缀（Windows 跳过）。"""
        cmd = "ls"
        thread_data: dict[str, Any] = {"workspace_path": "C:\\Users\\test\\workspace"}
        # 不抛异常，原样返回
        assert windows_cwd_prefix_shim(cmd, thread_data) == "ls"

    def test_empty_command(self) -> None:
        """空命令原样返回。"""
        assert windows_cwd_prefix_shim("", None) == ""

    def test_idempotent_on_already_prefixed(self) -> None:
        """若上游已修复（命令已含 cd 前缀），垫片不剥离——只做 no-op。"""
        cmd = "cd /workspace && python3 script.py"
        assert windows_cwd_prefix_shim(cmd, None) == cmd


class TestApplyWindowsBashCwdPrefixShim:
    """``apply_windows_bash_cwd_prefix_shim`` monkeypatch 行为。"""

    def test_unix_is_noop(self) -> None:
        """非 Windows 平台完全 no-op，不修改 sandbox.tools 模块。"""
        if sys.platform == "win32":
            pytest.skip("仅在非 Windows 平台验证 no-op 契约")
        from qilin.sandbox import tools as sandbox_tools

        orig = sandbox_tools._apply_cwd_prefix
        apply_windows_bash_cwd_prefix_shim()
        # Unix 上函数不应被替换
        assert sandbox_tools._apply_cwd_prefix is orig

    def test_windows_replaces_module_function(self) -> None:
        """Windows 上模块属性被替换为 shim（monkeypatch 生效）。"""
        if sys.platform != "win32":
            pytest.skip("仅在 Windows 平台验证 monkeypatch 生效")
        from qilin.sandbox import tools as sandbox_tools

        apply_windows_bash_cwd_prefix_shim()
        # 模块属性被替换为我们的 shim
        assert sandbox_tools._apply_cwd_prefix is windows_cwd_prefix_shim

    def test_idempotent_multiple_calls(self) -> None:
        """多次调用安全，不会重复 patch 或报错。"""
        if sys.platform != "win32":
            pytest.skip("仅在 Windows 平台验证幂等性")
        apply_windows_bash_cwd_prefix_shim()
        apply_windows_bash_cwd_prefix_shim()
        apply_windows_bash_cwd_prefix_shim()
        from qilin.sandbox import tools as sandbox_tools

        assert sandbox_tools._apply_cwd_prefix is windows_cwd_prefix_shim
