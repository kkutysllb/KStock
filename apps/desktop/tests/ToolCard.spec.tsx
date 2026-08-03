import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToolCard } from "../src/components/ToolCard";
import type { ToolCall } from "../src/lib/sessionStore";

const toolCall: ToolCall = {
  id: "call-1",
  name: "task",
  status: "done",
  args: {
    prompt: "这是很长的系统提示词内容，默认不能直接暴露在主界面。",
  },
  result: "## 执行结果\n\nstderr 原样输出\nPython path configuration",
};

describe("ToolCard", () => {
  it("工具名为空时显示可读占位，避免只剩图标和箭头", () => {
    render(
      <ToolCard
        call={{
          id: "call-empty-name",
          name: "",
          status: "running",
          args: { prompt: "等待工具名流式回填" },
        }}
      />
    );

    expect(screen.getByLabelText("工具调用 准备工具调用")).toBeVisible();
    expect(screen.getByRole("button", { name: /准备工具调用/ })).toBeVisible();
  });

  it("工具卡片展开后，参数和结果内容仍默认折叠", () => {
    render(<ToolCard call={toolCall} />);

    fireEvent.click(screen.getByRole("button", { name: /task/ }));

    expect(screen.getByRole("button", { name: /参数 prompt/ })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(screen.getByRole("button", { name: /执行结果/ })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(screen.queryByText(/很长的系统提示词内容/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Python path configuration/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /执行结果/ }));
    expect(screen.getByText(/Python path configuration/)).toBeVisible();
  });
});
