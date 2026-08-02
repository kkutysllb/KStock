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
    // "回复并确认" 按钮存在但初始禁用（无选中）
    expect(screen.getByRole("button", { name: /回复并确认/ })).toBeTruthy();
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
    const btn = screen.getByRole("button", { name: /回复并确认/ }) as HTMLButtonElement;
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
    fireEvent.click(screen.getByRole("button", { name: /回复并确认/ }));
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
    fireEvent.click(screen.getByRole("button", { name: /回复并确认/ }));
    expect(onPick).toHaveBeenCalledWith("由我综合判断做全景看板");
  });

  it("其他文本只 trim 首尾空白，不截断中间", () => {
    const payload = makeChoicePayload();
    render(<ClarificationCard payload={payload} onPick={onPick} />);
    const otherInput = screen.getByLabelText("其他补充");
    fireEvent.change(otherInput, { target: { value: "  保留  中间空格  " } });
    fireEvent.click(screen.getByRole("button", { name: /回复并确认/ }));
    expect(onPick).toHaveBeenCalledWith("保留  中间空格");
  });

  it("提交后清空选中态和文本框（防重复提交）", () => {
    const payload = makeChoicePayload();
    render(<ClarificationCard payload={payload} onPick={onPick} />);
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[1]);
    const otherInput = screen.getByLabelText("其他补充") as HTMLInputElement;
    fireEvent.change(otherInput, { target: { value: "补充" } });
    fireEvent.click(screen.getByRole("button", { name: /回复并确认/ }));
    // 提交后 checkbox 全部恢复未选中
    expect(checkboxes[1].getAttribute("aria-checked")).toBe("false");
    expect(otherInput.value).toBe("");
  });

  it("form 模式渲染字段表单：select/text/textarea，必填校验", () => {
    const payload = makeChoicePayload({
      input_mode: "form",
      options: undefined,
      fields: [
        {
          name: "period",
          label: "分析周期",
          type: "select",
          required: true,
          options: ["2026-W31（07-27～07-31）", "自定义日期范围"],
        },
        { name: "custom_range", label: "自定义日期范围", type: "text", required: false, placeholder: "例如：2026-07-27 至 2026-08-02" },
        { name: "note", label: "备注", type: "textarea" },
      ],
    });
    render(<ClarificationCard payload={payload} onPick={onPick} />);
    // 渲染 question 与字段 label（“自定义日期范围”同时是 option 与字段名，允许多处）
    expect(screen.getByText("请选择报告聚焦的分析维度")).toBeTruthy();
    expect(screen.getByText("分析周期")).toBeTruthy();
    expect(screen.getAllByText("自定义日期范围").length).toBeGreaterThan(0);
    // 必填未选时提交按钮禁用
    const btn = screen.getByRole("button", { name: /回复并确认/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    // 选中 select 后启用
    fireEvent.change(screen.getByLabelText("period"), { target: { value: "2026-W31（07-27～07-31）" } });
    expect(btn.disabled).toBe(false);
  });

  it("form 模式提交组装 label: value 文本", () => {
    const payload = makeChoicePayload({
      input_mode: "form",
      options: undefined,
      fields: [
        {
          name: "period",
          label: "分析周期",
          type: "select",
          required: true,
          options: ["2026-W31（07-27～07-31）", "自定义日期范围"],
        },
        { name: "custom_range", label: "自定义日期范围", type: "text", required: false, placeholder: "例如：2026-07-27 至 2026-08-02" },
      ],
    });
    render(<ClarificationCard payload={payload} onPick={onPick} />);
    fireEvent.change(screen.getByLabelText("period"), { target: { value: "自定义日期范围" } });
    fireEvent.change(screen.getByLabelText("custom_range"), { target: { value: "2026-07-27 至 2026-08-02" } });
    fireEvent.click(screen.getByRole("button", { name: /回复并确认/ }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(
      "分析周期: 自定义日期范围\n自定义日期范围: 2026-07-27 至 2026-08-02"
    );
  });

  it("form 模式 select 兼容对象选项，避免历史澄清恢复时 React 崩溃", () => {
    const payload = makeChoicePayload({
      input_mode: "form",
      options: undefined,
      fields: [
        {
          name: "period",
          label: "分析周期",
          type: "select",
          required: true,
          options: [
            { id: "weekly", label: "2026-W31（07-27～07-31）", value: "2026-W31" },
            { id: "custom", label: "自定义日期范围", value: "custom" },
          ] as unknown as string[],
        },
      ],
    });

    render(<ClarificationCard payload={payload} onPick={onPick} />);

    expect(screen.getByRole("option", { name: "2026-W31（07-27～07-31）" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("period"), { target: { value: "custom" } });
    fireEvent.click(screen.getByRole("button", { name: /回复并确认/ }));
    expect(onPick).toHaveBeenCalledWith("分析周期: custom");
  });

  it("form 模式 multi_select 多选 + checkbox 布尔值组装", () => {
    const payload = makeChoicePayload({
      input_mode: "form",
      options: undefined,
      fields: [
        {
          name: "dims",
          label: "分析维度",
          type: "multi_select",
          required: true,
          options: ["主力资金", "北向资金", "两融趋势"],
        },
        { name: "include_news", label: "纳入新闻面", type: "checkbox", placeholder: "纳入新闻面" },
      ],
    });
    render(<ClarificationCard payload={payload} onPick={onPick} />);
    // 多选两个维度
    const boxes = screen.getAllByRole("checkbox");
    fireEvent.click(boxes[0]);
    fireEvent.click(boxes[2]);
    // 勾选 checkbox 字段
    fireEvent.click(screen.getByLabelText("include_news"));
    fireEvent.click(screen.getByRole("button", { name: /回复并确认/ }));
    expect(onPick).toHaveBeenCalledWith("分析维度: 主力资金、两融趋势\n纳入新闻面: 是");
  });

  it("form 模式 multi_select 兼容对象选项并按 value 提交", () => {
    const payload = makeChoicePayload({
      input_mode: "form",
      options: undefined,
      fields: [
        {
          name: "dims",
          label: "分析维度",
          type: "multi_select",
          required: true,
          options: [
            { id: "capital", label: "主力资金", value: "main_capital" },
            { id: "margin", label: "两融趋势", value: "margin_trend" },
          ] as unknown as string[],
        },
      ],
    });

    render(<ClarificationCard payload={payload} onPick={onPick} />);

    const boxes = screen.getAllByRole("checkbox");
    fireEvent.click(boxes[0]);
    fireEvent.click(boxes[1]);
    fireEvent.click(screen.getByRole("button", { name: /回复并确认/ }));
    expect(onPick).toHaveBeenCalledWith("分析维度: main_capital、margin_trend");
  });

  it("free_text 模式渲染输入框并直接提交文本", () => {
    const payload = makeChoicePayload({ input_mode: "free_text", options: undefined });
    render(<ClarificationCard payload={payload} onPick={onPick} />);
    expect(screen.getByText("请选择报告聚焦的分析维度")).toBeTruthy();
    // 空文本时按钮禁用
    const btn = screen.getByRole("button", { name: /回复并确认/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    // 输入后提交
    const input = screen.getByLabelText("回复内容") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "按 2026-W31 完整复核" } });
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(onPick).toHaveBeenCalledWith("按 2026-W31 完整复核");
  });
});
