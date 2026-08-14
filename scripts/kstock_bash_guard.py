# -*- coding: utf-8 -*-
"""bash 工具错误守卫垫片：脚本执行失败时向 LLM 醒目反馈，抑制幻觉。

背景
----
qilin 的 bash_tool 原样透传子进程 stdout/stderr，两类情况会让 LLM 忽略
错误继续幻觉数据：

1. **脚本崩溃**（Traceback / NameError / ModuleNotFoundError）：stderr 混在
   大段输出尾部，LLM 总结时可能视而不见，继续按臆测写结论；
2. **脚本吞错**（返回 JSON ``{"error": ...}`` 且退出码 0，如
   analyze_financial_deep 的 "TUSHARE_TOKEN 未设置" 误导错误）：输出看上
   去像成功结果，LLM 直接采信并编造后续数据（2026-08-14 天孚通信尽调
   「估值面/资金面因 import bug 失败」即此类）。

方案
----
monkeypatch ``qilin.sandbox.tools.bash_tool.func``——StructuredTool 的同步
函数，是引擎同步/异步两条执行路径的最终落点（coroutine 经
``_tool_sync_func`` 取同一 func）。执行后检测输出中的错误模式，命中时在
输出前置醒目结构化标记与「禁止编造数据」强制指令。与
``kstock_windows_shims`` 同类垫片模式：vendor 只读、幂等、上游修复后可移除。

注意：bash 工具自身的 ``Error: ...`` 返回（工具级异常）已对 LLM 可见，
不在检测范围；仅检测「成功返回但输出内容错误」的场景。
"""

from __future__ import annotations

import re
from typing import Any

# ── 错误模式 ──────────────────────────────────────────────────────────────
_PY_ERROR_PATTERNS = (
    re.compile(r"Traceback \(most recent call last\)"),
    re.compile(r"\bNameError:"),
    re.compile(r"\bModuleNotFoundError:"),
    re.compile(r"\bImportError:"),
    re.compile(r"\bSyntaxError:"),
    re.compile(r"\bAttributeError:"),
    re.compile(r"\bTypeError:"),
    re.compile(r"\bKeyError:"),
)
_SHELL_ERROR_PATTERNS = (
    re.compile(r"command not found"),
    re.compile(r"No such file or directory"),
)
# JSON 错误协议：`{"error": "<非空消息>"}`（脚本吞错返回，退出码 0）。
# 排除 `"error": ""` / `"error": null` 等正常占位，避免误伤。
_JSON_ERROR_PATTERN = re.compile(r'"error"\s*:\s*"[^"\s][^"]*"')

_ERROR_MARKER = "[KSTOCK-TOOL-ERROR]"

_ERROR_PREFIX_TEMPLATE = (
    "[KSTOCK-TOOL-ERROR] 命令执行失败：{reason}。\n"
    "必须如实转述失败原因并说明受影响的数据维度，"
    "禁止编造数据、禁止臆测结果、禁止声称执行成功。\n\n"
)


def detect_tool_error(output: str) -> str | None:
    """检测 bash 输出中的错误模式，返回错误类别说明；无错误返回 None。"""
    if not isinstance(output, str):
        return None
    for pattern in _PY_ERROR_PATTERNS:
        if pattern.search(output):
            return "Python 脚本报错（Traceback/NameError/ImportError 等）"
    for pattern in _SHELL_ERROR_PATTERNS:
        if pattern.search(output):
            return "shell 命令错误（命令不存在或路径不存在）"
    if _JSON_ERROR_PATTERN.search(output):
        return "脚本返回错误 JSON（error 字段非空）"
    return None


def apply_bash_error_guard() -> None:
    """包装 bash_tool.func，输出含错误时前置醒目标记。

    幂等：已包装（``_kstock_error_guarded`` 标记）时直接返回。
    sandbox.tools 未 import 时静默返回（与 windows shim 同样在
    ``_apply_vendor_*_shim`` 后重试）。
    """
    try:
        from qilin.sandbox import tools as sandbox_tools
    except ImportError:
        return

    tool = getattr(sandbox_tools, "bash_tool", None)
    if tool is None:
        return
    original = getattr(tool, "func", None)
    if original is None or getattr(original, "_kstock_error_guarded", False):
        return

    def guarded_bash(runtime: Any, description: str, command: str) -> str:
        output = original(runtime, description, command)
        if not isinstance(output, str) or output.startswith(_ERROR_MARKER):
            return output
        reason = detect_tool_error(output)
        if reason is None:
            return output
        return _ERROR_PREFIX_TEMPLATE.format(reason=reason) + output

    guarded_bash._kstock_error_guarded = True  # type: ignore[attr-defined]
    guarded_bash._kstock_orig = original  # type: ignore[attr-defined]
    # StructuredTool.func 可直接赋值（langchain_core BaseModel 默认可变），
    # 同步与异步（coroutine → _tool_sync_func → func）路径全部生效。
    tool.func = guarded_bash  # type: ignore[method-assign]
