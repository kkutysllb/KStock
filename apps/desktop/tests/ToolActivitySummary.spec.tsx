import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToolActivitySummary } from "../src/components/ToolActivitySummary";
import type { ToolCall } from "../src/lib/sessionStore";

const call = (patch: Partial<ToolCall>): ToolCall => ({
  ...patch,
  id: patch.id ?? crypto.randomUUID(),
  name: patch.name ?? "read_file",
  args: patch.args ?? { path: "/tmp/report.md" },
  status: patch.status ?? "done",
  result: patch.result ?? "参数值",
});

describe("ToolActivitySummary", () => {
  it("默认保持折叠，状态变化不自动切换用户手动展开状态", () => {
    const { rerender } = render(
      <ToolActivitySummary
        calls={[
          call({ id: "1", name: "read_file", status: "running", startedAt: 1_000 }),
          call({ id: "2", name: "bash", status: "running", startedAt: 2_000 }),
        ]}
      />
    );

    const summary = screen.getByRole("button", { name: /处理中/ });
    expect(summary).toBeVisible();
    expect(summary).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("工具调用 read_file")).not.toBeInTheDocument();
    expect(screen.getByTestId("tool-activity-divider")).toBeVisible();

    fireEvent.click(summary);
    expect(summary).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByLabelText(/工具调用/)).toHaveLength(2);

    rerender(
      <ToolActivitySummary
        calls={[
          call({ id: "1", name: "read_file", result: "读取完成", startedAt: 1_000, endedAt: 6_000 }),
          call({ id: "2", name: "bash", result: "脚本完成", startedAt: 2_000, endedAt: 8_000 }),
        ]}
      />
    );
    expect(summary).toHaveAttribute("aria-expanded", "true");

    expect(screen.getByLabelText("工具调用 read_file")).toBeVisible();
    fireEvent.click(screen.getAllByRole("button", { name: "read_file" })[0]);
    expect(screen.getByRole("button", { name: /参数 path/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("/tmp/report.md")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /参数 path/ }));
    expect(screen.getByText("/tmp/report.md")).toBeVisible();
  });

  it("单条工具调用不再显示文字状态标签", () => {
    render(<ToolActivitySummary calls={[call({ status: "running" })]} />);

    expect(screen.queryByText("调用中")).not.toBeInTheDocument();
    expect(screen.queryByText("准备中")).not.toBeInTheDocument();
    expect(screen.queryByText("已完成")).not.toBeInTheDocument();
  });

  it("完成状态默认收起，用户仍可按需查看工具记录", () => {
    render(
      <ToolActivitySummary
        calls={[
          call({ id: "1", name: "read_file", result: "读取完成", startedAt: 1_000, endedAt: 6_000 }),
          call({ id: "2", name: "bash", result: "脚本完成", startedAt: 2_000, endedAt: 8_000 }),
          call({ id: "3", name: "read_file", result: "最终结果", startedAt: 7_000, endedAt: 9_500 }),
        ]}
      />
    );

    const summary = screen.getByRole("button", { name: /已完成 9s/ });
    expect(summary).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("读取完成")).not.toBeInTheDocument();

    fireEvent.click(summary);

    expect(screen.getAllByLabelText("工具调用 read_file")).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "read_file" })[0]);
    expect(screen.getByRole("button", { name: /执行结果/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("读取完成")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /执行结果/ }));
    expect(screen.getByText("读取完成")).toBeVisible();
  });

  it("空调用不渲染摘要", () => {
    const { container } = render(<ToolActivitySummary calls={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
