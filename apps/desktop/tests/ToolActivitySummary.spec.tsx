import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToolActivitySummary } from "../src/components/ToolActivitySummary";
import type { ToolCall } from "../src/lib/sessionStore";

const call = (patch: Partial<ToolCall>): ToolCall => ({
  id: patch.id ?? crypto.randomUUID(),
  name: patch.name ?? "read_file",
  args: patch.args ?? { path: "/tmp/report.md" },
  status: patch.status ?? "done",
  result: patch.result ?? "参数值",
});

describe("ToolActivitySummary", () => {
  it("默认只显示一行摘要，展开后直接显示单次调用卡片", () => {
    render(
      <ToolActivitySummary
        calls={[
          call({ id: "1", name: "read_file", result: "读取完成" }),
          call({ id: "2", name: "bash", result: "脚本完成" }),
          call({ id: "3", name: "read_file", result: "最终结果" }),
        ]}
      />
    );

    const summary = screen.getByRole("button", { name: /3 次工具调用/ });
    expect(summary).toBeVisible();
    expect(summary).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("读取完成")).not.toBeInTheDocument();

    fireEvent.click(summary);

    expect(summary).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByLabelText("工具调用 read_file")).toHaveLength(2);
    expect(screen.queryByText("2 次调用")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /read_file 已完成/ })[0]);

    expect(screen.getByText("/tmp/report.md")).toBeVisible();
    expect(screen.getByText("读取完成")).toBeVisible();
  });

  it("空调用不渲染摘要", () => {
    const { container } = render(<ToolActivitySummary calls={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
