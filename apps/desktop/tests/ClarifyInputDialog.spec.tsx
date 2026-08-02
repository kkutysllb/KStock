import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClarifyInputDialog } from "../src/components/ClarifyInputDialog";

describe("ClarifyInputDialog", () => {
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
      <ClarifyInputDialog
        open={false}
        initialText="财务三表全维度"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    expect(screen.queryByLabelText("回复内容")).toBeNull();
  });

  it("打开时预填 initialText，空文本时确认按钮禁用", () => {
    render(
      <ClarifyInputDialog
        open
        initialText={"财务三表全维度\n重点看海外业务风险"}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    const textarea = screen.getByLabelText("回复内容") as HTMLTextAreaElement;
    expect(textarea.value).toBe("财务三表全维度\n重点看海外业务风险");
    expect(screen.getByRole("button", { name: "确认发送" })).toBeTruthy();
    // 清空后按钮禁用
    fireEvent.change(textarea, { target: { value: "   " } });
    expect(
      (screen.getByRole("button", { name: "确认发送" }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("编辑文本后确认 → onConfirm 收到 trim 后的内容", () => {
    render(
      <ClarifyInputDialog
        open
        initialText="盈利质量专项"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    const textarea = screen.getByLabelText("回复内容") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "  盈利质量专项，附现金流转率  " } });
    fireEvent.click(screen.getByRole("button", { name: "确认发送" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith("盈利质量专项，附现金流转率");
  });

  it("点取消 / Esc → onCancel 且不触发 onConfirm", () => {
    render(
      <ClarifyInputDialog
        open
        initialText="行业格局与竞争"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("⌘/Ctrl+Enter 快捷确认", () => {
    render(
      <ClarifyInputDialog
        open
        initialText="由我综合判断"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    fireEvent.keyDown(window, { key: "Enter", metaKey: true });
    expect(onConfirm).toHaveBeenCalledWith("由我综合判断");
  });
});
