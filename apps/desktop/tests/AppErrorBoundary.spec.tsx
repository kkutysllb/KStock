import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "../src/components/AppErrorBoundary";

function BrokenChild(): never {
  throw new Error("历史任务渲染失败");
}

describe("AppErrorBoundary", () => {
  it("子组件渲染异常时显示可见错误页，避免桌面端纯黑屏", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reload = vi.fn();

    render(
      <AppErrorBoundary onReload={reload}>
        <BrokenChild />
      </AppErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByText("界面渲染失败")).toBeVisible();
    expect(screen.getByText(/历史任务渲染失败/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
    expect(reload).toHaveBeenCalledTimes(1);

    consoleError.mockRestore();
  });
});
