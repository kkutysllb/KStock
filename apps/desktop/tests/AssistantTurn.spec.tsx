import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantTurn } from "../src/components/AssistantTurn";
import type { ChatMessage, ToolCall } from "../src/lib/sessionStore";

/** 构造带 ask_clarification（form 模式）的 assistant turn。 */
function makeClarifyTurn(inputMode: "choice_with_other" | "form" | "free_text"): ChatMessage {
  const toolCall: ToolCall = {
    id: "call-clarify-1",
    name: "ask_clarification",
    args: { question: "请确认分析周期" },
    status: "done",
    result: "🤔 请确认分析周期",
    artifact: {
      human_input: {
        kind: "human_input_request",
        source: "ask_clarification",
        request_id: "clarification:call-clarify-1",
        clarification_type: "ambiguous_requirement",
        question: "请确认分析周期",
        input_mode: inputMode,
        options:
          inputMode === "choice_with_other"
            ? [{ id: "opt-1", label: "2026-W31", value: "2026-W31" }]
            : undefined,
        fields:
          inputMode === "form"
            ? [
                {
                  name: "period",
                  label: "分析周期",
                  type: "select",
                  required: true,
                  options: ["2026-W31", "自定义"],
                },
              ]
            : undefined,
      },
    },
  };
  return {
    id: "turn-1",
    role: "assistant",
    createdAt: "2026-08-02T07:00:00Z",
    text: "🤔 请确认分析周期\n\n  1. 分析周期 (required)",
    toolCalls: [toolCall],
    status: "done",
  };
}

describe("AssistantTurn 澄清渲染", () => {
  let onClarifyPick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onClarifyPick = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("form 模式渲染 ClarificationCard（非 fallback 文本）", () => {
    render(<AssistantTurn msg={makeClarifyTurn("form")} onClarifyPick={onClarifyPick} />);
    // 渲染卡片 question 与表单字段
    expect(screen.getByText("请确认分析周期")).toBeTruthy();
    expect(screen.getByText("分析周期")).toBeTruthy();
    expect(screen.getByRole("button", { name: /回复并确认/ })).toBeTruthy();
    // fallback 编号列表文本被隐藏
    expect(screen.queryByText(/请确认分析周期\n\n  1\./)).toBeNull();
  });

  it("free_text 模式渲染 ClarificationCard 输入框", () => {
    render(<AssistantTurn msg={makeClarifyTurn("free_text")} onClarifyPick={onClarifyPick} />);
    expect(screen.getByLabelText("回复内容")).toBeTruthy();
    expect(screen.getByRole("button", { name: /回复并确认/ })).toBeTruthy();
  });

  it("choice_with_other 渲染选项卡片", () => {
    render(<AssistantTurn msg={makeClarifyTurn("choice_with_other")} onClarifyPick={onClarifyPick} />);
    expect(screen.getByText("2026-W31")).toBeTruthy();
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  });

  it("点回复并确认 → onClarifyPick 收到文本 + 澄清问题", () => {
    render(<AssistantTurn msg={makeClarifyTurn("form")} onClarifyPick={onClarifyPick} />);
    fireEvent.change(screen.getByLabelText("period"), { target: { value: "2026-W31" } });
    fireEvent.click(screen.getByRole("button", { name: /回复并确认/ }));
    expect(onClarifyPick).toHaveBeenCalledWith("分析周期: 2026-W31", "请确认分析周期");
  });

  it("非澄清 turn 不渲染卡片", () => {
    const msg: ChatMessage = {
      id: "turn-2",
      role: "assistant",
      createdAt: "2026-08-02T07:00:00Z",
      text: "正常回复",
      status: "done",
    };
    render(<AssistantTurn msg={msg} onClarifyPick={onClarifyPick} />);
    expect(screen.queryByRole("button", { name: /回复并确认/ })).toBeNull();
    expect(screen.getByText("正常回复")).toBeTruthy();
  });

  it("流式正文末尾展示迷你 K 线流动，完成后隐藏", () => {
    const msg: ChatMessage = {
      id: "turn-streaming",
      role: "assistant",
      createdAt: "2026-08-02T07:00:00Z",
      text: "正在查询新闻",
      status: "streaming",
    };
    const { container, rerender } = render(<AssistantTurn msg={msg} />);

    expect(container.querySelector(".streaming-candles")).toBeTruthy();
    expect(container.querySelectorAll(".streaming-candles .candle").length).toBe(4);

    rerender(<AssistantTurn msg={{ ...msg, status: "done" }} />);
    expect(container.querySelector(".streaming-candles")).toBeNull();
  });

  it("完成后在总状态的分割线下展示正文，而不默认展示工具卡片", () => {
    const message: ChatMessage = {
      id: "assistant-1",
      role: "assistant",
      createdAt: "2026-08-02T12:00:00.000Z",
      status: "done",
      text: "正文回复",
      toolCalls: [
        {
          id: "tool-1",
          name: "read_file",
          args: { path: "/tmp/report.md" },
          status: "done",
          result: "读取完成",
          startedAt: 1_000,
          endedAt: 3_000,
        },
      ],
    };
    const { container } = render(
      <AssistantTurn msg={message} showReasoning={false} />
    );

    const summary = screen.getByRole("button", { name: /已完成 2s/ });
    const divider = screen.getByTestId("tool-activity-divider");
    const text = screen.getByText("正文回复");

    expect(summary.compareDocumentPosition(divider)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(divider.compareDocumentPosition(text)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(container.querySelector(".tool-card")).toBeNull();
    expect(screen.queryByLabelText("研究阶段")).not.toBeInTheDocument();
  });

  it("subagent 步骤里的执行结果默认折叠，避免工具回填内容铺满主界面", () => {
    const message: ChatMessage = {
      id: "assistant-subagent",
      role: "assistant",
      createdAt: "2026-08-02T12:00:00.000Z",
      status: "done",
      subagents: [
        {
          taskId: "task-1",
          description: "运行市场联动技能",
          status: "completed",
          steps: [
            {
              index: 1,
              text: "## 执行结果\n\n### 1. SKILL.md 前 120 行已阅读\n\nPython path configuration",
            },
          ],
        },
      ],
    };

    render(<AssistantTurn msg={message} showReasoning={false} />);

    const toggle = screen.getByRole("button", { name: /1 条执行记录/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/Python path configuration/)).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(screen.getByText(/Python path configuration/)).toBeVisible();
  });
});
