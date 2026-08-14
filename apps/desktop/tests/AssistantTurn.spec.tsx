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

  it("timeline 存在时正文与工具调用按执行顺序交错渲染", () => {
    const message: ChatMessage = {
      id: "assistant-interleaved",
      role: "assistant",
      createdAt: "2026-08-02T12:00:00.000Z",
      status: "done",
      text: "开头中间",
      textSegments: ["开头", "中间"],
      timeline: [
        { kind: "text", index: 0 },
        { kind: "tool", toolCallId: "tool-1" },
        { kind: "text", index: 1 },
        { kind: "tool", toolCallId: "tool-2" },
      ],
      toolCalls: [
        { id: "tool-1", name: "read_file", args: { path: "/a" }, status: "done" },
        { id: "tool-2", name: "write_file", args: { path: "/b" }, status: "done" },
      ],
    };

    const { container } = render(<AssistantTurn msg={message} showReasoning={false} />);

    expect(container.querySelector(".turn-timeline")).toBeTruthy();
    // 所有工具都在时间线内：不再出现堆积的工具活动摘要
    expect(container.querySelector(".tool-activity-summary")).toBeNull();

    const textBlocks = container.querySelectorAll(".turn-timeline .turn-text");
    expect(textBlocks).toHaveLength(2);
    expect(textBlocks[0].textContent).toContain("开头");
    expect(textBlocks[1].textContent).toContain("中间");

    const toolCards = container.querySelectorAll(".turn-timeline .tool-card");
    expect(toolCards).toHaveLength(2);

    // 子元素顺序：text → tool → text → tool（交错而非堆积）
    const order = Array.from(container.querySelectorAll(".turn-timeline > *")).map((el) =>
      el.classList.contains("turn-text") ? "text" : "tool"
    );
    expect(order).toEqual(["text", "tool", "text", "tool"]);
  });

  it("流式时蜡烛只在最后一个正文分段上显示", () => {
    const message: ChatMessage = {
      id: "assistant-interleaved-streaming",
      role: "assistant",
      createdAt: "2026-08-02T12:00:00.000Z",
      status: "streaming",
      text: "前置后",
      textSegments: ["前置", "后"],
      timeline: [
        { kind: "text", index: 0 },
        { kind: "tool", toolCallId: "tool-1" },
        { kind: "text", index: 1 },
      ],
      toolCalls: [{ id: "tool-1", name: "read_file", args: {}, status: "running" }],
    };

    const { container } = render(<AssistantTurn msg={message} />);

    // 正文分段内只有最后一个有蜡烛（工具卡上的执行动画不算正文蜡烛）
    const textBlocks = container.querySelectorAll(".turn-timeline .turn-text");
    expect(container.querySelectorAll(".turn-timeline .turn-text .streaming-candles")).toHaveLength(1);
    expect(textBlocks[0].querySelector(".streaming-candles")).toBeNull();
    expect(textBlocks[1].querySelector(".streaming-candles")).toBeTruthy();
  });

  it("流式时时间线以运行中工具结尾则不显示正文蜡烛（工具卡自带蜡烛动画）", () => {
    const message: ChatMessage = {
      id: "assistant-interleaved-tool-tail",
      role: "assistant",
      createdAt: "2026-08-02T12:00:00.000Z",
      status: "streaming",
      text: "前置",
      textSegments: ["前置"],
      timeline: [
        { kind: "text", index: 0 },
        { kind: "tool", toolCallId: "tool-1" },
      ],
      toolCalls: [{ id: "tool-1", name: "read_file", args: {}, status: "running" }],
    };

    const { container } = render(<AssistantTurn msg={message} />);

    // 正文分段上没有蜡烛（执行动画移到运行中的工具卡上）
    const textBlocks = container.querySelectorAll(".turn-timeline .turn-text");
    expect(textBlocks[0].querySelector(".streaming-candles")).toBeNull();
    // 运行中的工具卡用 K 线蜡烛动画表示执行进度
    expect(container.querySelector(".tool-card.status-running .streaming-candles")).toBeTruthy();
  });

  it("澄清卡渲染在 ask_clarification 工具的执行位置", () => {
    const base = makeClarifyTurn("form");
    const message: ChatMessage = {
      ...base,
      textSegments: ["前置说明"],
      timeline: [
        { kind: "text", index: 0 },
        { kind: "tool", toolCallId: "call-clarify-1" },
      ],
    };

    const { container } = render(<AssistantTurn msg={message} onClarifyPick={onClarifyPick} />);

    expect(container.querySelector(".turn-timeline")).toBeTruthy();
    expect(screen.getByText("请确认分析周期")).toBeTruthy();
    expect(screen.getByRole("button", { name: /回复并确认/ })).toBeTruthy();
    // 交互澄清激活：fallback 正文分段全部隐藏
    expect(container.querySelectorAll(".turn-timeline .turn-text")).toHaveLength(0);
  });

  it("无 timeline 的旧消息回退旧布局（工具汇总 + 全文）", () => {
    const message: ChatMessage = {
      id: "assistant-legacy",
      role: "assistant",
      createdAt: "2026-08-02T12:00:00.000Z",
      status: "done",
      text: "旧布局正文",
      toolCalls: [
        { id: "tool-1", name: "read_file", args: { path: "/a" }, status: "done" },
      ],
    };

    const { container } = render(<AssistantTurn msg={message} showReasoning={false} />);

    expect(container.querySelector(".turn-timeline")).toBeNull();
    expect(container.querySelector(".tool-activity-summary")).toBeTruthy();
    expect(screen.getByText("旧布局正文")).toBeTruthy();
  });
});
