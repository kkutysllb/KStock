import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "../src/components/ConfirmDialog";

describe("ConfirmDialog", () => {
  let onConfirm: ReturnType<typeof vi.fn>;
  let onCancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onConfirm = vi.fn();
    onCancel = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("open=false 时不渲染", () => {
    render(
      <ConfirmDialog
        open={false}
        title="删除"
        description="不可恢复"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("open=true 渲染标题、描述与按钮", () => {
    render(
      <ConfirmDialog
        open={true}
        title="删除「任务A」"
        description="将同步删除后端数据"
        confirmText="确认删除"
        cancelText="取消"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText(/删除「任务A」/)).toBeTruthy();
    expect(screen.getByText(/将同步删除后端数据/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "确认删除" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "取消" })).toBeTruthy();
  });

  it("点确认按钮触发 onConfirm", () => {
    render(
      <ConfirmDialog
        open={true}
        title="t"
        description="d"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "确认" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("点取消按钮触发 onCancel", () => {
    render(
      <ConfirmDialog
        open={true}
        title="t"
        description="d"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("按 Esc 触发 onCancel", () => {
    render(
      <ConfirmDialog
        open={true}
        title="t"
        description="d"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("按 Enter 触发 onConfirm", () => {
    render(
      <ConfirmDialog
        open={true}
        title="t"
        description="d"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("点遮罩（overlay 自身）触发 onCancel", () => {
    const { container } = render(
      <ConfirmDialog
        open={true}
        title="t"
        description="d"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    const overlay = container.querySelector(".confirm-overlay") as HTMLElement;
    // 模拟点击 overlay 本身（target === currentTarget）
    fireEvent.click(overlay);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
