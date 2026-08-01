import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClarificationCard } from "../src/components/ClarificationCard";
import type { HumanInputPayload } from "../src/lib/sessionStore";

function makeChoicePayload(overrides: Partial<HumanInputPayload> = {}): HumanInputPayload {
  return {
    kind: "human_input_request",
    source: "ask_clarification",
    request_id: "req-1",
    clarification_type: "approach_choice",
    question: "请选择报告聚焦的分析维度",
    input_mode: "choice_with_other",
    options: [
      { id: "option-1", label: "财务三表全维度", value: "财务三表全维度" },
      { id: "option-2", label: "盈利质量专项", value: "盈利质量专项" },
      { id: "option-3", label: "行业格局与竞争", value: "行业格局与竞争" },
    ],
    ...overrides,
  };
}

describe("ClarificationCard", () => {
  let onPick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onPick = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("choice_with_other 渲染 question + 全部选项", () => {
    const payload = makeChoicePayload();
    render(<ClarificationCard payload={payload} onPick={onPick} />);
    expect(screen.getByText("请选择报告聚焦的分析维度")).toBeTruthy();
    expect(screen.getByText("财务三表全维度")).toBeTruthy();
    expect(screen.getByText("盈利质量专项")).toBeTruthy();
    expect(screen.getByText("行业格局与竞争")).toBeTruthy();
    // 选项以 checkbox 角色渲染
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    // "加入输入框" 按钮存在但初始禁用（无选中）
    expect(screen.getByRole("button", { name: /加入输入框/ })).toBeTruthy();
  });

  it("渲染可选 context 副标题", () => {
    const payload = makeChoicePayload({ context: "宁德时代(300750) 核心数据已就绪" });
    render(<ClarificationCard payload={payload} onPick={onPick} />);
    expect(screen.getByText("宁德时代(300750) 核心数据已就绪")).toBeTruthy();
  });

  it("点击选项 toggle 选中/取消", () => {
    const payload = makeChoicePayload();
    render(<ClarificationCard payload={payload} onPick={onPick} />);
    const opt1 = screen.getAllByRole("checkbox")[0];
    // 初始未选中
    expect(opt1.getAttribute("aria-checked")).toBe("false");
    // 点击选中
    fireEvent.click(opt1);
    expect(opt1.getAttribute("aria-checked")).toBe("true");
    // 再次点击取消
    fireEvent.click(opt1);
    expect(opt1.getAttribute("aria-checked")).toBe("false");
  });

  it("无选中时按钮禁用，有选中时启用", () => {
    const payload = makeChoicePayload();
    render(<ClarificationCard payload={payload} onPick={onPick} />);
    const btn = screen.getByRole("button", { name: /加入输入框/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    // 选中一个选项
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(btn.disabled).toBe(false);
  });

  it("选中多个选项 + 其他文本，点击按钮 → onPick 收到换行拼接文本", () => {
    const payload = makeChoicePayload();
    render(<ClarificationCard payload={payload} onPick={onPick} />);
    // 选中第 1、3 个选项
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[2]);
    // 输入其他补充
    const otherInput = screen.getByLabelText("其他补充") as HTMLInputElement;
    fireEvent.change(otherInput, { target: { value: "重点看海外业务风险" } });
    // 点击按钮
    fireEvent.click(screen.getByRole("button", { name: /加入输入框/ }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(
      "财务三表全维度\n行业格局与竞争\n重点看海外业务风险"
    );
  });

  it("仅输入其他文本（无选项选中）也能触发 onPick", () => {
    const payload = makeChoicePayload();
    render(<ClarificationCard payload={payload} onPick={onPick} />);
    const otherInput = screen.getByLabelText("其他补充");
    fireEvent.change(otherInput, { target: { value: "由我综合判断做全景看板" } });
    fireEvent.click(screen.getByRole("button", { name: /加入输入框/ }));
    expect(onPick).toHaveBeenCalledWith("由我综合判断做全景看板");
  });

  it("其他文本只 trim 首尾空白，不截断中间", () => {
    const payload = makeChoicePayload();
    render(<ClarificationCard payload={payload} onPick={onPick} />);
    const otherInput = screen.getByLabelText("其他补充");
    fireEvent.change(otherInput, { target: { value: "  保留  中间空格  " } });
    fireEvent.click(screen.getByRole("button", { name: /加入输入框/ }));
    expect(onPick).toHaveBeenCalledWith("保留  中间空格");
  });

  it("提交后清空选中态和文本框（防重复提交）", () => {
    const payload = makeChoicePayload();
    render(<ClarificationCard payload={payload} onPick={onPick} />);
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[1]);
    const otherInput = screen.getByLabelText("其他补充") as HTMLInputElement;
    fireEvent.change(otherInput, { target: { value: "补充" } });
    fireEvent.click(screen.getByRole("button", { name: /加入输入框/ }));
    // 提交后 checkbox 全部恢复未选中
    expect(checkboxes[1].getAttribute("aria-checked")).toBe("false");
    expect(otherInput.value).toBe("");
  });

  it("form 模式退化为提示，不渲染选项", () => {
    const payload = makeChoicePayload({ input_mode: "form", fields: [{ name: "x" }] });
    render(<ClarificationCard payload={payload} onPick={onPick} />);
    expect(screen.getByText("请选择报告聚焦的分析维度")).toBeTruthy();
    expect(screen.getByText("请在下方输入框直接回复。")).toBeTruthy();
    // 不渲染选项 checkbox / "加入输入框" 按钮
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /加入输入框/ })).toBeNull();
  });

  it("free_text 模式退化为提示", () => {
    const payload = makeChoicePayload({ input_mode: "free_text", options: undefined });
    render(<ClarificationCard payload={payload} onPick={onPick} />);
    expect(screen.getByText("请在下方输入框直接回复。")).toBeTruthy();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});
