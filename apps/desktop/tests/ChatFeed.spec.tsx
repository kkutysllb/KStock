import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatFeed } from "../src/components/ChatFeed";
import type { ChatMessage } from "../src/lib/sessionStore";

const messages: ChatMessage[] = [
  {
    id: "human-1",
    role: "user",
    createdAt: "2026-08-05T00:00:00.000Z",
    content: "第一个问题"
  },
  {
    id: "assistant-1",
    role: "assistant",
    createdAt: "2026-08-05T00:00:01.000Z",
    text: "第一个回答",
    status: "done",
    engineMessageIds: ["ai-1"]
  },
  {
    id: "human-2",
    role: "user",
    createdAt: "2026-08-05T00:00:02.000Z",
    content: "第二个问题"
  },
  {
    id: "assistant-2",
    role: "assistant",
    createdAt: "2026-08-05T00:00:03.000Z",
    text: "第二个回答",
    status: "done",
    engineMessageIds: ["ai-2"]
  }
];

describe("ChatFeed user message editing", () => {
  it("把可编辑状态传给对应用户消息，其他消息保持复制可用", () => {
    render(
      <ChatFeed
        messages={messages}
        editableUserMessageIds={new Set(["human-1"])}
        editDisabled={false}
        onEditResend={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByTestId("user-human-1")).toHaveAttribute("data-editable", "true");
    expect(screen.getByTestId("user-human-2")).toHaveAttribute("data-editable", "false");
    const editButtons = screen.getAllByRole("button", { name: "编辑消息" });
    expect(editButtons[0]).toBeEnabled();
    expect(editButtons[1]).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "复制消息" })).toHaveLength(2);
  });
});
