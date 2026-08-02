# 对话消息展示优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将桌面端助手消息改成“正文优先、工具调用一行摘要、详情按需展开”的安静阅读布局，并移除助手头像占位。

**Architecture:** 保留现有 `ChatMessage.toolCalls` 数据与 `ToolCallGroup`/`ToolCard` 详情组件，新增纯展示层的 `ToolActivitySummary` 负责聚合状态、次数、工具类别和最新结果摘要。`AssistantTurn` 只负责编排摘要、正文和错误区；CSS 负责紧凑布局、稳定截断和长文本层级。

**Tech Stack:** React 18、TypeScript、lucide-react、Vitest、React Testing Library、Vite。

---

### Task 1: 为工具活动聚合定义可测试的纯函数

**Files:**
- Create: `apps/desktop/src/lib/toolActivity.ts`
- Create: `apps/desktop/tests/toolActivity.spec.ts`

- [ ] **Step 1: 写失败测试，覆盖统计、状态和摘要截断**

```ts
import { describe, expect, it } from "vitest";
import { summarizeToolActivity } from "../src/lib/toolActivity";
import type { ToolCall } from "../src/lib/sessionStore";

const call = (patch: Partial<ToolCall>): ToolCall => ({
  id: patch.id ?? crypto.randomUUID(),
  name: patch.name ?? "read_file",
  args: patch.args ?? {},
  status: patch.status ?? "done",
  result: patch.result,
});

describe("summarizeToolActivity", () => {
  it("统计调用总数和工具类别，并取最后一条非空结果", () => {
    expect(summarizeToolActivity([
      call({ name: "read_file", result: "第一条" }),
      call({ name: "bash", result: "第二条" }),
      call({ name: "read_file", result: "最终结果" }),
    ])).toEqual({
      status: "done",
      callCount: 3,
      toolCount: 2,
      latestResult: "最终结果",
    });
  });

  it("running 优先于 error，error 优先于 done", () => {
    expect(summarizeToolActivity([call({ status: "error" }), call({ status: "running" })]).status).toBe("running");
    expect(summarizeToolActivity([call({ status: "error" }), call({ status: "done" })]).status).toBe("error");
  });

  it("没有结果时返回空摘要，超长结果截断为单行", () => {
    expect(summarizeToolActivity([call({ result: "" })]).latestResult).toBe("");
    expect(summarizeToolActivity([call({ result: "x".repeat(120) })]).latestResult).toHaveLength(96);
    expect(summarizeToolActivity([call({ result: "x".repeat(120) })]).latestResult.endsWith("…")).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认纯函数尚不存在**

运行：`pnpm --dir apps/desktop test -- toolActivity.spec.ts`

预期：FAIL，提示 `../src/lib/toolActivity` 不存在。

- [ ] **Step 3: 实现最小聚合函数**

在 `toolActivity.ts` 导出：

```ts
import type { ToolCall } from "./sessionStore";

export type ToolActivityStatus = "running" | "error" | "done";

export interface ToolActivitySummary {
  status: ToolActivityStatus;
  callCount: number;
  toolCount: number;
  latestResult: string;
}

export function summarizeToolActivity(calls: ToolCall[]): ToolActivitySummary {
  const toolNames = new Set(calls.map((call) => call.name));
  const status: ToolActivityStatus = calls.some((call) => call.status === "running")
    ? "running"
    : calls.some((call) => call.status === "error")
      ? "error"
      : "done";
  const result = [...calls].reverse().find((call) => call.result?.trim())?.result?.replace(/\s+/g, " ").trim() ?? "";
  return {
    status,
    callCount: calls.length,
    toolCount: toolNames.size,
    latestResult: result.length > 95 ? `${result.slice(0, 95)}…` : result,
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

运行：`pnpm --dir apps/desktop test -- toolActivity.spec.ts`

预期：3 个测试通过。

- [ ] **Step 5: 提交纯函数与测试**

```bash
git add apps/desktop/src/lib/toolActivity.ts apps/desktop/tests/toolActivity.spec.ts
git commit -m "test: add tool activity summary" 
```

### Task 2: 新增工具活动摘要组件并接入助手消息

**Files:**
- Create: `apps/desktop/src/components/ToolActivitySummary.tsx`
- Modify: `apps/desktop/src/components/AssistantTurn.tsx`
- Modify: `apps/desktop/src/components/ToolCallGroup.tsx`
- Create: `apps/desktop/tests/ToolActivitySummary.spec.tsx`

- [ ] **Step 1: 写组件行为测试**

测试使用真实 `ToolActivitySummary`，构造 3 个工具调用，断言默认只出现一条摘要、显示 `3 次工具调用`，点击摘要后显示现有 `ToolCallGroup` 的工具名称，并可继续展开单次详情。

```tsx
render(<ToolActivitySummary calls={calls} />);
expect(screen.getByRole("button", { name: /3 次工具调用/ })).toBeVisible();
expect(screen.queryByText("参数值")).not.toBeInTheDocument();
fireEvent.click(screen.getByRole("button", { name: /3 次工具调用/ }));
expect(screen.getByText("read_file")).toBeVisible();
```

- [ ] **Step 2: 运行测试确认组件尚不存在**

运行：`pnpm --dir apps/desktop test -- ToolActivitySummary.spec.tsx`

预期：FAIL，提示组件模块不存在。

- [ ] **Step 3: 实现摘要组件**

组件接收 `calls: ToolCall[]`，调用 `summarizeToolActivity`，默认显示状态图标、状态标签、调用总数、工具类别数、`latestResult` 和箭头；展开后复用 `groupToolCalls(calls).map(...)` 渲染 `ToolCallGroup`。摘要按钮的 `aria-expanded` 必须与状态同步；空数组直接返回 `null`。

- [ ] **Step 4: 接入 `AssistantTurn` 并移除头像节点**

删除 `turn-avatar` 节点和不再需要的 `Sparkles` 导入；把当前 `groupToolCalls(...).map(...)` 替换为一个 `ToolActivitySummary`，继续过滤 `ask_clarification`。保留 `showToolCalls` 条件和现有交互式澄清逻辑。

- [ ] **Step 5: 让 `ToolCallGroup` 支持摘要组件的紧凑模式**

保持原有独立使用行为，只补充可选的 `compact?: boolean`：摘要展开后的分组使用紧凑类名，详情数据和单次调用展开行为不变。

- [ ] **Step 6: 运行组件测试确认通过**

运行：`pnpm --dir apps/desktop test -- ToolActivitySummary.spec.tsx`

预期：全部通过，且无 `turn-avatar` 相关渲染节点。

- [ ] **Step 7: 提交组件接入**

```bash
git add apps/desktop/src/components/ToolActivitySummary.tsx apps/desktop/src/components/AssistantTurn.tsx apps/desktop/src/components/ToolCallGroup.tsx apps/desktop/tests/ToolActivitySummary.spec.tsx
git commit -m "feat: simplify assistant tool activity" 
```

### Task 3: 重排消息区样式，保证正文优先和窄窗口稳定

**Files:**
- Modify: `apps/desktop/src/styles.css`

- [ ] **Step 1: 调整助手布局和正文排版**

移除 `.turn-avatar` 的布局依赖，将 `.assistant-turn` 改为单列；将 `.turn-body` 的间距调整为 14px；为 `.turn-text` 及其 markdown 子元素设置段落、标题、列表、引用、代码块和行内代码的层级，正文颜色提高对比度但不放大到标题级。

- [ ] **Step 2: 增加摘要行样式**

新增 `.tool-activity-summary`、`.tool-activity-summary-header`、`.tool-activity-meta`、`.tool-activity-result` 和状态变体。摘要使用弱边框、固定最小高度、`min-width: 0`，结果文本使用 `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`。

- [ ] **Step 3: 约束展开详情层级**

把 `.tool-group` 的背景和边框降为摘要行的次级层级；详情区域继续保留滚动和等宽字体，避免 `pre` 内容撑破消息列。

- [ ] **Step 4: 添加窄窗口断点**

在现有移动端媒体查询中隐藏 `.tool-activity-tool-count` 和 `.tool-activity-result`，保留状态、次数、展开箭头；正文代码块设置横向滚动而不是撑宽页面。

- [ ] **Step 5: 运行类型检查和构建**

运行：`pnpm --dir apps/desktop build`

预期：Vite 构建成功，无 TypeScript 或 CSS 解析错误。

- [ ] **Step 6: 提交样式**

```bash
git add apps/desktop/src/styles.css
git commit -m "style: prioritize assistant message content"
```

### Task 4: 完整回归验证

**Files:**
- Modify: 无

- [ ] **Step 1: 运行桌面端完整测试**

运行：`pnpm --dir apps/desktop test`

预期：现有测试与新增测试全部通过。

- [ ] **Step 2: 运行生产构建**

运行：`pnpm --dir apps/desktop build`

预期：构建成功生成 `apps/desktop/dist`。

- [ ] **Step 3: 检查变更范围和空白错误**

运行：`git diff --check HEAD~3..HEAD` 与 `git status --short`，确认只有消息展示相关文件发生新增或修改，且没有空白错误。

- [ ] **Step 4: 向用户交付验证说明**

明确说明未启动浏览器验收，列出已运行的测试和构建命令，并提醒用户重点检查：工具摘要展开、流式状态、失败状态、长正文换行和窄窗口布局。
