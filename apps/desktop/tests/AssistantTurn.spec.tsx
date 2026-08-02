import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AssistantTurn } from "../src/components/AssistantTurn";
import type { ChatMessage } from "../src/lib/sessionStore";

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

describe("AssistantTurn", () => {
  it("完成后在总状态的分割线下展示正文，而不默认展示工具卡片", () => {
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
});
