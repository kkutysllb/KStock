"""Middleware to enforce per-run token budget limits.
Tracks cumulative token usage (input, output, total) across model calls within
a single agent run and enforces configurable soft-warning and hard-stop
thresholds.
Detection strategy:
  1. After each model response, sum the `usage_metadata` of all `AIMessage`s
     in the current thread history. This automatically captures tokens from
     subagents because `TokenUsageMiddleware` retroactively adds them to the
     history.
  2. If the highest fraction (input, output, or total) >= warn_threshold,
     queue a warning.
  3. If the highest fraction >= hard_stop_threshold, strip tool_calls.
Warning injection uses the deferred pattern:
  - after_model queues the warning (does NOT mutate state).
  - wrap_model_call injects it as a HumanMessage at the next model call.
This preserves AIMessage(tool_calls) → ToolMessage pairing.

Budget auto-extension (clear-and-recount):
  When the cumulative usage hits the hard-stop threshold, the middleware may
  instead reset its per-run counters (re-marking the current message history as
  seen, i.e. the budget restarts from zero) and let the run continue — the
  mirror of ``max_turn_extensions`` for ``recursion_limit``. Three safety
  valves gate the extension (count ceiling / no progress / repeated identical
  tool calls), so healthy long tasks are let through while dead loops are still
  capped by the legacy hard stop. Configure with ``max_budget_extensions``
  (0 = disable extension entirely, legacy hard-stop behaviour).

Stop-reason surfacing (#3875 Phase 2):
  The hard stop does NOT raise — it strips tool_calls so the agent loop
  terminates naturally and produces a final answer. To let the caller (e.g.
  the subagent executor) distinguish a budget-capped completion from a clean
  one, the run that triggered the hard stop is recorded in ``_stop_reason``
  and exposed via :meth:`consume_stop_reason`. That dict is intentionally NOT
  cleared by ``after_agent``/``_clear_run_state`` so the executor can read it
  after the run returns; the bounded dict prevents unbounded growth on
  abandoned runs, and each subagent run builds a fresh middleware instance so
  there is no cross-run contamination.
"""

from __future__ import annotations

import logging
import threading
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, override

from langchain.agents import AgentState
from langchain.agents.middleware import AgentMiddleware
from langchain.agents.middleware.types import ModelCallResult, ModelRequest, ModelResponse
from langchain_core.messages import AIMessage, HumanMessage
from langgraph.runtime import Runtime

from qilin.agents.middlewares._bounded_dict import BoundedDict
from qilin.config.token_budget_config import TokenBudgetConfig

logger = logging.getLogger(__name__)

_BUDGET_WARNING_MSG = (
    "[TOKEN BUDGET WARNING] You have used {used:,} of your {budget:,} {reason} token budget ({percent:.0f}%). Wrap up your current work and produce a final answer. Avoid starting new tool calls unless absolutely necessary."
)
_BUDGET_EXCEEDED_MSG = "[TOKEN BUDGET EXCEEDED] The {reason} token usage ({used:,}) has exceeded the safety limit ({budget:,}). Producing final answer with results collected so far."


@dataclass
class TokenUsage:
    input: int = 0
    output: int = 0
    total: int = 0


class TokenBudgetMiddleware(AgentMiddleware[AgentState]):
    """Enforce per-run token budget limits."""

    def __init__(self, config: TokenBudgetConfig) -> None:
        super().__init__()
        self._config = config
        self._lock = threading.Lock()

        # Keyed strictly by run_id (clobber-safe) and bounded (leak-safe)
        self._warned: BoundedDict[str, bool] = BoundedDict(1000)
        self._pending_warnings: BoundedDict[str, list[str]] = BoundedDict(1000)
        self._seen_messages: BoundedDict[str, dict[str, tuple[int, int]]] = BoundedDict(1000)
        self._cumulative_usage: BoundedDict[str, TokenUsage] = BoundedDict(1000)
        # Budget auto-extension bookkeeping (clear-and-recount). ``_extensions_used``
        # counts how many times a run has already been extended; ``_extension_baseline``
        # is the message count at the last extension so a no-progress cycle can be
        # detected on the next over-budget hit.
        self._extensions_used: BoundedDict[str, int] = BoundedDict(1000)
        self._extension_baseline: BoundedDict[str, int] = BoundedDict(1000)
        # Stop reason set when the hard-stop fires. NOT cleared by
        # ``_clear_run_state``/``after_agent`` so the executor can consume it
        # after the run returns; bounded so abandoned runs cannot leak.
        self._stop_reason: BoundedDict[str, str] = BoundedDict(1000)

    @classmethod
    def from_config(cls, config: TokenBudgetConfig) -> TokenBudgetMiddleware:
        return cls(config=config)

    def reset(self) -> None:
        with self._lock:
            self._warned.clear()
            self._pending_warnings.clear()
            self._seen_messages.clear()
            self._cumulative_usage.clear()
            self._extensions_used.clear()
            self._extension_baseline.clear()
            self._stop_reason.clear()

    def consume_stop_reason(self, run_id: str | None) -> str | None:
        """Pop and return the stop reason the hard-stop set for this run.

        Returns ``"token_capped"`` when the budget hard-stop fired during the
        run, otherwise ``None``. The executor calls this after the run returns
        to decide whether a completed subagent was actually budget-capped
        (and should carry ``stop_reason=token_capped`` to the lead). Popping
        keeps the dict from accumulating across runs on a reused instance.
        """
        with self._lock:
            return self._stop_reason.pop(run_id, None)

    @staticmethod
    def _get_run_id(runtime: Runtime) -> str:
        ctx = getattr(runtime, "context", None)
        if isinstance(ctx, dict) and "run_id" in ctx:
            return ctx["run_id"]
        # Fallback to runtime object ID to prevent collisions across embedded client runs
        return str(id(runtime))

    def _clear_run_state(self, run_id: str) -> None:
        with self._lock:
            self._warned.pop(run_id, None)
            self._pending_warnings.pop(run_id, None)
            self._seen_messages.pop(run_id, None)
            self._cumulative_usage.pop(run_id, None)
            self._extensions_used.pop(run_id, None)
            self._extension_baseline.pop(run_id, None)

    @staticmethod
    def _effective_input_tokens(usage: dict[str, Any]) -> int:
        """输入 token 扣除缓存读取部分。

        ``usage_metadata.input_tokens`` 对 OpenAI 兼容 provider 包含 prompt
        cache 命中（``input_token_details.cache_read``），而缓存命中不产生
        计费也不代表新增输入。预算统计应基于新增 token，否则上下文厚重且
        缓存命中高的长任务会因"上下文长度"而非"真实成本"提前误杀。
        无缓存字段（cache_read=0）时行为不变。
        """
        input_tokens = usage.get("input_tokens", 0) or 0
        details = usage.get("input_token_details") or {}
        cache_read = details.get("cache_read", 0) if isinstance(details, dict) else 0
        return max(0, input_tokens - int(cache_read or 0))

    @override
    def before_agent(self, state: AgentState, runtime: Runtime) -> None:
        if not self._config.enabled:
            return

        # Mark all old messages from previous runs as 'seen' so they don't count toward THIS run's budget
        messages = state.get("messages", [])
        if not messages:
            return

        run_id = self._get_run_id(runtime)
        with self._lock:
            seen = self._seen_messages.setdefault(run_id, {})
            self._cumulative_usage.setdefault(run_id, TokenUsage())

            for msg in messages:
                if isinstance(msg, AIMessage) and msg.id and hasattr(msg, "usage_metadata"):
                    usage = msg.usage_metadata or {}
                    input_tokens = self._effective_input_tokens(usage)
                    output_tokens = usage.get("output_tokens", 0)
                    seen[msg.id] = (input_tokens, output_tokens)

    @override
    async def abefore_agent(self, state: AgentState, runtime: Runtime) -> None:
        self.before_agent(state, runtime)

    @override
    def after_agent(self, state: AgentState, runtime: Runtime) -> None:
        if not self._config.enabled:
            return
        self._clear_run_state(self._get_run_id(runtime))

    @override
    async def aafter_agent(self, state: AgentState, runtime: Runtime) -> None:
        self.after_agent(state, runtime)

    @staticmethod
    def _append_text(content: str | list[dict | None] | None, stop_msg: str) -> str | list[dict | str]:
        """Append a stop message to an AIMessage.content field."""
        if content is None:
            return stop_msg
        if isinstance(content, str):
            if content:
                return f"{content}\n\n{stop_msg}"
            return f"\n\n{stop_msg}"
        if isinstance(content, list):
            new_content = list(content)
            new_content.append({"type": "text", "text": f"\n\n{stop_msg}"})
            return new_content
        return f"{content}\n\n{stop_msg}"

    def _build_hard_stop_update(self, msg: AIMessage, stop_msg: str) -> dict[str, Any]:
        """Build the state update dictionary for a hard stop."""
        updated_content = self._append_text(msg.content, stop_msg)
        kwargs = dict(msg.additional_kwargs) if msg.additional_kwargs else {}
        if "tool_calls" in kwargs:
            del kwargs["tool_calls"]
        if "function_call" in kwargs:
            del kwargs["function_call"]

        response_metadata = dict(getattr(msg, "response_metadata", {}) or {})

        if response_metadata.get("finish_reason") == "tool_calls":
            response_metadata["finish_reason"] = "stop"

        stopped_msg = msg.model_copy(update={"content": updated_content, "tool_calls": [], "additional_kwargs": kwargs, "response_metadata": response_metadata})
        return {"messages": [stopped_msg]}

    def _apply(self, state: AgentState, runtime: Runtime) -> dict | None:
        if not self._config.enabled:
            return None

        messages = state.get("messages", [])
        if not messages:
            return None

        last_msg = messages[-1]
        if not isinstance(last_msg, AIMessage):
            return None

        run_id = self._get_run_id(runtime)

        with self._lock:
            seen = self._seen_messages.setdefault(run_id, {})
            usage_accum = self._cumulative_usage.setdefault(run_id, TokenUsage())

            for msg in messages:
                if isinstance(msg, AIMessage) and msg.id and hasattr(msg, "usage_metadata"):
                    usage = msg.usage_metadata or {}

                    input_tokens = self._effective_input_tokens(usage)
                    output_tokens = usage.get("output_tokens", 0)

                    # Check what previously recorded for this exact message
                    prev_input, prev_output = seen.get(msg.id, (0, 0))

                    # Calculate if any new tokens were added (handles retroactive subagent tokens)
                    diff_input = max(0, input_tokens - prev_input)
                    diff_output = max(0, output_tokens - prev_output)

                    if diff_input > 0 or diff_output > 0:
                        usage_accum.input += diff_input
                        usage_accum.output += diff_output
                        usage_accum.total += diff_input + diff_output
                        seen[msg.id] = (input_tokens, output_tokens)

            if usage_accum.total <= 0:
                return None

            fractions = [("total", usage_accum.total, self._config.max_tokens)]
            if self._config.max_input_tokens:
                fractions.append(("input", usage_accum.input, self._config.max_input_tokens))
            if self._config.max_output_tokens:
                fractions.append(("output", usage_accum.output, self._config.max_output_tokens))

            highest_fraction = 0.0
            trigger_reason = ""
            trigger_used = 0
            trigger_budget = 0

            for reason, used, limit in fractions:
                frac = used / limit
                if frac > highest_fraction:
                    highest_fraction = frac
                    trigger_reason = reason
                    trigger_used = used
                    trigger_budget = limit

            if highest_fraction >= self._config.hard_stop_threshold:
                if self._can_extend_budget(run_id, messages):
                    # 预算清零续跑：安全阀放行则不清零 run、不剥离 tool_calls，
                    # 仅重置计数器从 0 重新累计，让健康长任务继续执行。
                    self._extend_budget(run_id, messages)
                    return None
                logger.warning("Token budget hard stop triggered for run %s: %s limit exceeded", run_id, trigger_reason)
                # Record the stop reason so the executor can surface
                # ``stop_reason=token_capped`` to the lead after the run
                # returns (the hard stop itself does not raise). See
                # ``consume_stop_reason``.
                self._stop_reason[run_id] = "token_capped"
                # Also write to runtime.context so the lead worker can read it
                # without needing a reference to this middleware instance (#4176).
                ctx = getattr(runtime, "context", None)
                if isinstance(ctx, dict):
                    ctx["stop_reason"] = "token_capped"
                stop_text = _BUDGET_EXCEEDED_MSG.format(reason=trigger_reason, used=trigger_used, budget=trigger_budget)
                return self._build_hard_stop_update(last_msg, stop_text)

            if highest_fraction >= self._config.warn_threshold and not self._warned.get(run_id, False):
                self._warned[run_id] = True
                percent = highest_fraction * 100
                warn_text = _BUDGET_WARNING_MSG.format(reason=trigger_reason, used=trigger_used, budget=trigger_budget, percent=percent)
                logger.info("Token budget warning triggered for run %s: %s limit at %.1f%%", run_id, trigger_reason, percent)
                # queue warning for wrap_model_call
                warnings = self._pending_warnings.setdefault(run_id, [])
                warnings.append(warn_text)
                return None

            return None

    def _can_extend_budget(self, run_id: str, messages: list[Any]) -> bool:
        """预算自动续跑的判定：健康长任务放行，疑似死循环拒绝。

        三重安全阀（任一命中即拒绝续跑，维持原硬停行为）：
        1. 次数封顶：``max_budget_extensions``（0 = 完全禁用续跑，保持旧行为）；
        2. 零进展：距上次续跑消息数未增加（同一状态反复超限）；
        3. 重复动作：最后两条 AI 消息携带完全相同的 ``tool_calls`` —— 模型在
           同一位置重复同一动作是典型死循环信号（如反复调用同一工具同一参数）。
        """
        if self._config.max_budget_extensions <= 0:
            return False
        if self._extensions_used.get(run_id, 0) >= self._config.max_budget_extensions:
            return False
        baseline = self._extension_baseline.get(run_id)
        if baseline is not None and len(messages) <= baseline:
            return False
        ai_messages = [m for m in messages if isinstance(m, AIMessage)]
        if len(ai_messages) >= 2:
            prev_calls = ai_messages[-2].tool_calls
            last_calls = ai_messages[-1].tool_calls
            if prev_calls and last_calls and prev_calls == last_calls:
                return False
        return True

    def _extend_budget(self, run_id: str, messages: list[Any]) -> None:
        """预算清零重计：把当前消息历史全部标记为已见，累计计数从 0 重新开始。

        与 ``max_turn_extensions`` 的续跑语义对齐：run 本身与模型上下文都不
        中断，仅预算计数器归零，因此健康长任务可以继续推进；真正失控的循环
        由 ``_can_extend_budget`` 的安全阀拦下并落入硬停。
        """
        extensions = self._extensions_used.get(run_id, 0) + 1
        self._extensions_used[run_id] = extensions
        self._extension_baseline[run_id] = len(messages)
        seen: dict[str, tuple[int, int]] = {}
        for msg in messages:
            if isinstance(msg, AIMessage) and msg.id and hasattr(msg, "usage_metadata"):
                usage = msg.usage_metadata or {}
                seen[msg.id] = (self._effective_input_tokens(usage), usage.get("output_tokens", 0))
        self._seen_messages[run_id] = seen
        self._cumulative_usage[run_id] = TokenUsage()
        # 新一轮预算的 80% 警告可重新触发
        self._warned.pop(run_id, None)
        logger.info(
            "Token budget auto-extending #%d for run %s (cumulative usage reset, budget restarts at 0)",
            extensions,
            run_id,
        )

    @override
    def after_model(self, state: AgentState, runtime: Runtime) -> dict | None:
        return self._apply(state, runtime)

    @override
    async def aafter_model(self, state: AgentState, runtime: Runtime) -> dict | None:
        return self._apply(state, runtime)

    def _drain_pending_warnings(self, runtime: Runtime) -> list[str]:
        if not self._config.enabled:
            return []

        run_id = self._get_run_id(runtime)
        with self._lock:
            warnings = self._pending_warnings.pop(run_id, None)
        return warnings or []

    def _inject_warnings(self, request: ModelRequest, warnings: list[str]) -> ModelRequest:
        if not warnings:
            return request

        merged_text = "\n\n".join(warnings)
        warning_msg = HumanMessage(content=merged_text, name="budget_warning")

        messages = getattr(request, "messages", [])
        new_messages = list(messages) + [warning_msg]
        return request.override(messages=new_messages)

    @override
    def wrap_model_call(self, request: ModelRequest, handler: Callable[[ModelRequest], ModelResponse]) -> ModelCallResult:

        warnings = self._drain_pending_warnings(request.runtime)
        request = self._inject_warnings(request, warnings)

        return handler(request)

    @override
    async def awrap_model_call(self, request: ModelRequest, handler: Callable[[ModelRequest], Awaitable[ModelResponse]]) -> ModelCallResult:
        warnings = self._drain_pending_warnings(request.runtime)
        request = self._inject_warnings(request, warnings)
        return await handler(request)
