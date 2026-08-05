import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UserBubble } from "../src/components/UserBubble";
import type { ChatMessage } from "../src/lib/sessionStore";

const userMessage: ChatMessage = {
  id: "user-1",
  role: "user",
  createdAt: "2026-08-05T00:00:00.000Z",
  content: "原消息"
};

describe("UserBubble", () => {
  it("常驻复制和编辑按钮，复制成功后切换反馈", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    render(<UserBubble msg={userMessage} canEdit onEditResend={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "复制消息" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("原消息"));
    expect(screen.getByRole("button", { name: "已复制" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑消息" })).toBeInTheDocument();
  });

  it("编辑后可取消或重新发送", async () => {
    const onEditResend = vi.fn().mockResolvedValue(undefined);
    render(<UserBubble msg={userMessage} canEdit onEditResend={onEditResend} />);

    fireEvent.click(screen.getByRole("button", { name: "编辑消息" }));
    fireEvent.change(screen.getByRole("textbox", { name: "编辑用户消息" }), {
      target: { value: "修改后的消息" }
    });
    fireEvent.click(screen.getByRole("button", { name: "重新发送" }));
    await waitFor(() => expect(onEditResend).toHaveBeenCalledWith("user-1", "修改后的消息"));
    expect(screen.queryByRole("textbox", { name: "编辑用户消息" })).not.toBeInTheDocument();
  });

  it("空文本禁用提交，提交失败保留编辑内容并显示错误", async () => {
    const onEditResend = vi.fn().mockRejectedValue(new Error("分支失败"));
    render(<UserBubble msg={userMessage} canEdit onEditResend={onEditResend} />);

    fireEvent.click(screen.getByRole("button", { name: "编辑消息" }));
    const textbox = screen.getByRole("textbox", { name: "编辑用户消息" });
    fireEvent.change(textbox, { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "重新发送" })).toBeDisabled();
    fireEvent.change(textbox, { target: { value: "保留此文本" } });
    fireEvent.click(screen.getByRole("button", { name: "重新发送" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("分支失败");
    expect(screen.getByRole("textbox", { name: "编辑用户消息" })).toHaveValue("保留此文本");
  });

  it("复制失败不显示成功状态并提供错误反馈", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("clipboard denied")) }
    });
    render(<UserBubble msg={userMessage} canEdit onEditResend={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "复制消息" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("复制失败");
    expect(screen.queryByRole("button", { name: "已复制" })).not.toBeInTheDocument();
  });

  it("不可编辑时保留编辑按钮但禁用提交入口", () => {
    render(<UserBubble msg={userMessage} canEdit={false} onEditResend={vi.fn()} />);
    expect(screen.getByRole("button", { name: "编辑消息" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "复制消息" })).toBeEnabled();
  });
});
