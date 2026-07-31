import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RuntimeConfigCard, type FieldDef } from "../src/components/RuntimeConfigCard";

// ── 固定字段集（覆盖各类型）─────────────────────────────────────────

const fields: FieldDef[] = [
  { key: "enabled", label: "启用", type: "boolean" },
  {
    key: "mode", label: "模式", type: "select",
    options: [
      { value: "middleware", label: "中间件" },
      { value: "tool", label: "工具" },
    ],
  },
  { key: "timeout", label: "超时", type: "number", min: 1, max: 300, step: 1 },
  { key: "model", label: "模型", type: "nullable-string" },
  { key: "tools", label: "工具列表", type: "string-list" },
  { key: "trigger", label: "触发阈值", type: "context-size" },
];

const initialValue = {
  enabled: false,
  mode: "middleware",
  timeout: 30,
  model: null,
  tools: ["read_file"],
  trigger: { type: "tokens", value: 32000 },
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── 渲染与初始状态 ──────────────────────────────────────────────────

describe("RuntimeConfigCard 渲染", () => {
  it("渲染所有字段 label 与初始值", () => {
    render(
      <RuntimeConfigCard
        title="测试配置"
        fields={fields}
        initialValue={initialValue}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByText("测试配置")).toBeInTheDocument();
    fields.forEach((f) => {
      expect(screen.getByText(f.label)).toBeInTheDocument();
    });
    // select 初始值
    expect((screen.getByDisplayValue("中间件") as HTMLSelectElement).value).toBe("middleware");
    // number 初始值
    expect((screen.getByDisplayValue("30") as HTMLInputElement).value).toBe("30");
  });

  it("初始 draft 与 initialValue 相同时，保存按钮禁用（dirty=false）", () => {
    render(
      <RuntimeConfigCard title="t" fields={fields} initialValue={initialValue} onSave={vi.fn()} />
    );
    const saveBtns = screen.getAllByRole("button").filter((b) => b.textContent?.includes("保存"));
    expect(saveBtns[0]).toBeDisabled();
  });
});

// ── dirty 检测 ──────────────────────────────────────────────────────

describe("RuntimeConfigCard dirty 检测", () => {
  it("修改 boolean 字段后保存按钮启用", () => {
    render(
      <RuntimeConfigCard title="t" fields={fields} initialValue={initialValue} onSave={vi.fn()} />
    );
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    const saveBtns = screen.getAllByRole("button").filter((b) => b.textContent?.includes("保存"));
    expect(saveBtns[0]).not.toBeDisabled();
  });

  it("修改 select 字段后 dirty=true", () => {
    render(
      <RuntimeConfigCard title="t" fields={fields} initialValue={initialValue} onSave={vi.fn()} />
    );
    const select = screen.getByDisplayValue("中间件") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "tool" } });
    expect(select.value).toBe("tool");
    const saveBtns = screen.getAllByRole("button").filter((b) => b.textContent?.includes("保存"));
    expect(saveBtns[0]).not.toBeDisabled();
  });

  it("修改 number 字段后 dirty=true", () => {
    render(
      <RuntimeConfigCard title="t" fields={fields} initialValue={initialValue} onSave={vi.fn()} />
    );
    const inputs = screen.getAllByRole("spinbutton");
    // timeout 是第一个 number（trigger 的 value 是 context-size 内的 number，也在列表中）
    const timeoutInput = inputs.find((i) => (i as HTMLInputElement).value === "30") as HTMLInputElement;
    fireEvent.change(timeoutInput, { target: { value: "60" } });
    expect(timeoutInput.value).toBe("60");
    const saveBtns = screen.getAllByRole("button").filter((b) => b.textContent?.includes("保存"));
    expect(saveBtns[0]).not.toBeDisabled();
  });
});

// ── 保存与错误回显 ──────────────────────────────────────────────────

describe("RuntimeConfigCard 保存", () => {
  it("保存成功调用 onSave 传 draft，并显示 savedHint", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <RuntimeConfigCard
        title="t"
        fields={fields}
        initialValue={initialValue}
        onSave={onSave}
        savedHint="已写入"
      />
    );
    // 修改 enabled
    fireEvent.click(screen.getByRole("checkbox"));
    // 点保存
    const saveBtns = screen.getAllByRole("button").filter((b) => b.textContent?.includes("保存"));
    fireEvent.click(saveBtns[0]);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    const passed = onSave.mock.calls[0][0];
    expect(passed.enabled).toBe(true);
    expect(screen.getByText("已写入")).toBeInTheDocument();
  });

  it("保存失败时回显错误消息", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("后端 500"));
    render(
      <RuntimeConfigCard title="t" fields={fields} initialValue={initialValue} onSave={onSave} />
    );
    fireEvent.click(screen.getByRole("checkbox"));
    const saveBtns = screen.getAllByRole("button").filter((b) => b.textContent?.includes("保存"));
    fireEvent.click(saveBtns[0]);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("后端 500");
    });
  });

  it("保存失败带 fieldErrors 时回填到对应字段", async () => {
    const fieldErr = {
      message: "校验失败",
      status: 400,
      fieldErrors: [{ field: "timeout", message: "必须 ≤ 300" }],
    };
    const onSave = vi.fn().mockRejectedValue(fieldErr);
    render(
      <RuntimeConfigCard title="t" fields={fields} initialValue={initialValue} onSave={onSave} />
    );
    // 修改 timeout 触发 dirty
    const inputs = screen.getAllByRole("spinbutton");
    const timeoutInput = inputs.find((i) => (i as HTMLInputElement).value === "30") as HTMLInputElement;
    fireEvent.change(timeoutInput, { target: { value: "999" } });
    const saveBtns = screen.getAllByRole("button").filter((b) => b.textContent?.includes("保存"));
    fireEvent.click(saveBtns[0]);

    await waitFor(() => {
      expect(screen.getByText("必须 ≤ 300")).toBeInTheDocument();
    });
  });
});

// ── 重置 ────────────────────────────────────────────────────────────

describe("RuntimeConfigCard 重置", () => {
  it("修改后点重置回到初始值，保存按钮再次禁用", () => {
    render(
      <RuntimeConfigCard title="t" fields={fields} initialValue={initialValue} onSave={vi.fn()} />
    );
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    // 点重置
    const resetBtns = screen.getAllByRole("button").filter((b) => b.textContent?.includes("重置"));
    fireEvent.click(resetBtns[0]);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    const saveBtns = screen.getAllByRole("button").filter((b) => b.textContent?.includes("保存"));
    expect(saveBtns[0]).toBeDisabled();
  });
});

// ── context-size 字段 ──────────────────────────────────────────────

describe("RuntimeConfigCard context-size 字段", () => {
  it("修改 trigger type 后 draft 更新", () => {
    render(
      <RuntimeConfigCard title="t" fields={fields} initialValue={initialValue} onSave={vi.fn()} />
    );
    // context-size 字段内有一个 select（type）和一个 number（value）
    // initialValue.trigger = { type: "tokens", value: 32000 }
    const typeSelect = screen.getByDisplayValue("按 token 数") as HTMLSelectElement;
    fireEvent.change(typeSelect, { target: { value: "messages" } });
    // dirty 后保存启用
    const saveBtns = screen.getAllByRole("button").filter((b) => b.textContent?.includes("保存"));
    expect(saveBtns[0]).not.toBeDisabled();
  });
});

// ── 外部 initialValue 变化 ──────────────────────────────────────────

describe("RuntimeConfigCard 外部刷新", () => {
  it("initialValue 变化后 draft 重置为新值", () => {
    const { rerender } = render(
      <RuntimeConfigCard title="t" fields={fields} initialValue={initialValue} onSave={vi.fn()} />
    );
    const next = { ...initialValue, timeout: 120, mode: "tool" };
    rerender(
      <RuntimeConfigCard title="t" fields={fields} initialValue={next} onSave={vi.fn()} />
    );
    // 新 timeout 反映到 input
    const inputs = screen.getAllByRole("spinbutton");
    const timeoutInput = inputs.find((i) => (i as HTMLInputElement).value === "120");
    expect(timeoutInput).toBeTruthy();
    // dirty=false（draft 已重置为新 initialValue）
    const saveBtns = screen.getAllByRole("button").filter((b) => b.textContent?.includes("保存"));
    expect(saveBtns[0]).toBeDisabled();
  });
});
