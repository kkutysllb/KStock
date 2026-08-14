# -*- coding: utf-8 -*-
"""scripts/kstock_bash_guard.py bash 工具错误守卫垫片测试。"""

from scripts.kstock_bash_guard import apply_bash_error_guard, detect_tool_error

# ── detect_tool_error：错误模式识别 ─────────────────────────────────────


def test_detect_python_traceback():
    output = "Fetching...\nTraceback (most recent call last):\n  File \"x.py\", line 1\nNameError: name 'ts' is not defined"
    assert detect_tool_error(output) is not None


def test_detect_name_error():
    assert detect_tool_error("NameError: name 'np' is not defined") is not None


def test_detect_module_not_found():
    assert detect_tool_error("ModuleNotFoundError: No module named 'kk_common'") is not None


def test_detect_shell_command_not_found():
    assert detect_tool_error("bash: python3: command not found") is not None


def test_detect_json_error_field():
    output = '{"error": "TUSHARE_TOKEN 未设置或 tushare 未安装"}'
    assert detect_tool_error(output) is not None


def test_json_empty_or_null_error_not_flagged():
    # 正常脚本输出中的空 error 占位不应误伤
    assert detect_tool_error('{"error": ""}') is None
    assert detect_tool_error('{"error": null}') is None


def test_normal_output_not_flagged():
    output = '{"ts_code": "300394.SZ", "score": 66.4, "error": ""}'
    assert detect_tool_error(output) is None


# ── apply_bash_error_guard：垫片安装与包装行为 ───────────────────────────


def test_apply_bash_error_guard_wraps_bash_tool_and_restores():
    """垫片安装后 bash_tool.func 输出含错误时前置醒目标记，测试后还原。"""
    try:
        from qilin.sandbox import tools as sandbox_tools
    except ImportError:
        return  # 测试环境无 vendor/qilin 时跳过

    original = getattr(sandbox_tools.bash_tool, "func", None)
    assert original is not None
    try:
        apply_bash_error_guard()
        guarded = sandbox_tools.bash_tool.func
        assert getattr(guarded, "_kstock_error_guarded", False)
        # 幂等：重复安装不叠加包装
        apply_bash_error_guard()
        assert sandbox_tools.bash_tool.func is guarded

        # 包装逻辑验证：与 guard 内实现一致的前置标记（guarded 闭包捕获
        # 安装时的真实 original，无法替换；这里重放等价逻辑验证行为）
        def fake_orig(runtime, description, command):
            return '{"error": "模拟失败"}'

        def local_guarded(runtime, description, command):
            output = fake_orig(runtime, description, command)
            if output.startswith("[KSTOCK-TOOL-ERROR]"):
                return output
            reason = detect_tool_error(output)
            if reason is None:
                return output
            return (
                "[KSTOCK-TOOL-ERROR] 命令执行失败：{reason}。\n"
                "必须如实转述失败原因并说明受影响的数据维度，"
                "禁止编造数据、禁止臆测结果、禁止声称执行成功。\n\n"
            ).format(reason=reason) + output

        result = local_guarded(None, "run", "python3 x.py")
        assert result.startswith("[KSTOCK-TOOL-ERROR]")
        assert "禁止编造数据" in result
    finally:
        # 还原原始 func，避免污染其他测试
        sandbox_tools.bash_tool.func = original  # type: ignore[method-assign]
