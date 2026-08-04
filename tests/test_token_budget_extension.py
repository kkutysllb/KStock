"""TokenBudgetMiddleware 预算清零续跑（max_budget_extensions）单元测试。

覆盖：
- 预算耗尽自动清零重计续跑（不清零 run、不剥离 tool_calls、不置 stop_reason）
- 续跑后计数器从 0 重新累计、80% 警告可重新触发
- 三重安全阀（次数封顶 / 零进展 / 重复动作）任一命中即拒绝续跑并硬停
- max_budget_extensions=0 完全禁用续跑（保持旧硬停行为）
"""
from typing import Any

from langchain_core.messages import AIMessage

from qilin.agents.middlewares.token_budget_middleware import TokenBudgetMiddleware
from qilin.config.token_budget_config import TokenBudgetConfig


# ── 测试辅助 ─────────────────────────────────────────────────────────

class _FakeRuntime:
    """最小 Runtime 替身：中间件只读 runtime.context 取 run_id。"""

    def __init__(self, run_id: str = "test-run-1") -> None:
        self.context = {"run_id": run_id}


def _ai_msg(
    msg_id: str,
    input_tokens: int,
    output_tokens: int = 5000,
    *,
    tool_calls: list[dict[str, Any]] | None = None,
    finish_reason: str | None = None,
) -> AIMessage:
    kwargs: dict[str, Any] = {
        "content": "",
        "id": msg_id,
        "usage_metadata": {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens,
        },
    }
    if tool_calls is not None:
        kwargs["tool_calls"] = tool_calls
    if finish_reason is not None:
        kwargs["response_metadata"] = {"finish_reason": finish_reason}
    return AIMessage(**kwargs)


def _state(*messages: AIMessage) -> dict[str, Any]:
    return {"messages": list(messages)}


_BUDGET = 200000


def _make(config: TokenBudgetConfig | None = None) -> tuple[TokenBudgetMiddleware, _FakeRuntime]:
    cfg = config or TokenBudgetConfig(
        enabled=True,
        max_tokens=_BUDGET,
        warn_threshold=0.8,
        hard_stop_threshold=1.0,
        max_budget_extensions=2,
    )
    return TokenBudgetMiddleware(cfg), _FakeRuntime()


# ── 续跑清零重计 ─────────────────────────────────────────────────────

def test_cache_read_tokens_not_counted_toward_budget():
    """预算统计扣除缓存读取：input 28 万（缓存命中 21 万）只计 7 万新增。"""
    mw, rt = _make()

    msg = AIMessage(
        content="",
        id="m1",
        usage_metadata={
            "input_tokens": 280000,
            "output_tokens": 19000,
            "total_tokens": 299000,
            "input_token_details": {"cache_read": 210000},
        },
    )
    assert mw.after_model(_state(msg), rt) is None, "缓存命中高的输入不应触发超限"
    usage = mw._cumulative_usage["test-run-1"]
    assert usage.input == 70000, f"应只计新增 7 万输入，实际 {usage.input}"
    assert usage.total == 89000
    assert mw.consume_stop_reason("test-run-1") is None


def test_budget_exhausted_auto_extends_without_hard_stop():
    """预算耗尽触发续跑：不清零 run、不剥离 tool_calls、不置 stop_reason。"""
    mw, rt = _make()

    # 第一轮：9 万输入，未达 80% 警告线
    assert mw.after_model(_state(_ai_msg("m1", 90000)), rt) is None

    # 第二轮：追加 20 万输入的消息，累计超限 → 应续跑而非硬停
    tool_call = {"name": "bash", "args": {"cmd": "ls"}, "id": "call_1", "type": "tool_call"}
    update = mw.after_model(_state(_ai_msg("m1", 90000), _ai_msg("m2", _BUDGET, tool_calls=[tool_call])), rt)
    assert update is None, "超限应自动续跑，不返回硬停 update"
    assert mw.consume_stop_reason("test-run-1") is None, "续跑不应置 stop_reason"
    assert mw._extensions_used["test-run-1"] == 1
    # 预算已清零：第三轮新消息从 0 重新累计
    assert mw.after_model(_state(_ai_msg("m1", 90000), _ai_msg("m2", _BUDGET), _ai_msg("m3", 60000, 4000)), rt) is None
    usage = mw._cumulative_usage["test-run-1"]
    assert usage.total == 64000, f"续跑后应从 0 累计，实际 {usage.total}"


def test_extension_resets_warning_flag():
    """续跑清零后，新一轮预算的 80% 警告可重新触发。"""
    mw, rt = _make()

    # 第一轮 17 万输入 = 85% → 触发警告入队
    mw.after_model(_state(_ai_msg("m1", 170000)), rt)
    assert "test-run-1" in mw._pending_warnings, "85% 应触发警告"

    # 第二轮超限 → 续跑清零
    mw.after_model(_state(_ai_msg("m1", 170000), _ai_msg("m2", _BUDGET)), rt)
    assert mw._warned.get("test-run-1") is None, "续跑后 warned 应重置"

    # 第三轮再次 85% → 警告重新入队
    mw.after_model(_state(_ai_msg("m1", 170000), _ai_msg("m2", _BUDGET), _ai_msg("m3", 170000)), rt)
    assert "test-run-1" in mw._pending_warnings, "新一轮预算应能再次触发警告"


# ── 安全阀：次数封顶 ────────────────────────────────────────────────

def test_extension_ceiling_ends_in_hard_stop():
    """达到 max_budget_extensions 后再次超限 → 恢复旧硬停行为。"""
    mw, rt = _make(TokenBudgetConfig(
        enabled=True,
        max_tokens=_BUDGET,
        max_budget_extensions=1,
    ))

    # 第一轮超限 → 续跑（第 1 次，也是最后一次）
    assert mw.after_model(_state(_ai_msg("m1", _BUDGET)), rt) is None
    assert mw._extensions_used["test-run-1"] == 1

    # 第二轮再次超限 → 次数已封顶 → 硬停
    update = mw.after_model(_state(_ai_msg("m1", _BUDGET), _ai_msg("m2", _BUDGET)), rt)
    assert update is not None, "次数封顶后应硬停"
    assert mw.consume_stop_reason("test-run-1") == "token_capped"


def test_hard_stop_strips_tool_calls_and_returns_update():
    """硬停语义保持：剥离 tool_calls、返回 update、finish_reason 强制 stop。"""
    mw, rt = _make(TokenBudgetConfig(
        enabled=True,
        max_tokens=_BUDGET,
        max_budget_extensions=1,
    ))
    tool_call = {"name": "bash", "args": {"cmd": "ls"}, "id": "call_1", "type": "tool_call"}

    mw.after_model(_state(_ai_msg("m1", _BUDGET)), rt)  # 第 1 次续跑
    last = _ai_msg("m2", _BUDGET, tool_calls=[tool_call], finish_reason="tool_calls")
    update = mw.after_model(_state(_ai_msg("m1", _BUDGET), last), rt)

    assert update is not None
    stopped = update["messages"][0]
    assert isinstance(stopped, AIMessage)
    assert stopped.tool_calls == [], "硬停应剥离 tool_calls"
    assert stopped.response_metadata.get("finish_reason") == "stop"
    assert "[TOKEN BUDGET EXCEEDED]" in stopped.content


def test_extension_disabled_with_zero_keeps_legacy_hard_stop():
    """max_budget_extensions=0 → 完全禁用续跑，保持旧行为（首个超限即硬停）。"""
    mw, rt = _make(TokenBudgetConfig(
        enabled=True,
        max_tokens=_BUDGET,
        max_budget_extensions=0,
    ))
    update = mw.after_model(_state(_ai_msg("m1", _BUDGET)), rt)
    assert update is not None
    assert mw.consume_stop_reason("test-run-1") == "token_capped"


# ── 安全阀：零进展 / 重复动作 ───────────────────────────────────────

def test_no_progress_refuses_extension():
    """续跑后消息数未增加（同一消息 usage 回填增长反复超限）→ 拒绝续跑并硬停。"""
    mw, rt = _make()

    # 第一次超限 → 续跑（baseline = 1 条消息）
    assert mw.after_model(_state(_ai_msg("m1", _BUDGET)), rt) is None

    # 同一消息（id 相同）usage 回填增长，消息数未增加 → 无进展 → 拒绝续跑
    # （新 usage 需足够大：diff 再次把累计推到超限线才会进入硬停判定）
    update = mw.after_model(_state(_ai_msg("m1", _BUDGET + _BUDGET)), rt)
    assert update is not None, "零进展应拒绝续跑"
    assert mw.consume_stop_reason("test-run-1") == "token_capped"


def test_repeated_identical_tool_calls_refuses_extension():
    """最后两条 AI 消息 tool_calls 完全相同（典型死循环）→ 拒绝续跑。"""
    mw, rt = _make()
    tool_call = {"name": "bash", "args": {"cmd": "ls"}, "id": "call_1", "type": "tool_call"}

    # 先让第一条消息入 seen，再让超限的末条消息与它携带相同 tool_calls
    assert mw.after_model(_state(_ai_msg("m1", 10000, tool_calls=[tool_call])), rt) is None
    update = mw.after_model(
        _state(_ai_msg("m1", 10000, tool_calls=[tool_call]), _ai_msg("m2", _BUDGET, tool_calls=[tool_call])),
        rt,
    )
    assert update is not None, "重复动作应拒绝续跑"
    assert mw.consume_stop_reason("test-run-1") == "token_capped"


def test_different_tool_calls_are_allowed_to_extend():
    """动作不同（参数不同）不视为死循环 → 正常续跑。"""
    mw, rt = _make()
    call_a = {"name": "bash", "args": {"cmd": "ls"}, "id": "call_1", "type": "tool_call"}
    call_b = {"name": "bash", "args": {"cmd": "pwd"}, "id": "call_2", "type": "tool_call"}

    assert mw.after_model(_state(_ai_msg("m1", 10000, tool_calls=[call_a])), rt) is None
    update = mw.after_model(
        _state(_ai_msg("m1", 10000, tool_calls=[call_a]), _ai_msg("m2", _BUDGET, tool_calls=[call_b])),
        rt,
    )
    assert update is None, "不同动作应放行续跑"
    assert mw.consume_stop_reason("test-run-1") is None
