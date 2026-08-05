# Streaming Gear Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the assistant message's custom streaming flywheel with a gray-white rotating Lucide gear.

**Architecture:** Keep the existing streaming state and inline placement. `AssistantTurn` renders a semantic-neutral `Cog` icon while streaming, and the shared stylesheet owns its fixed dimensions, color, rotation, and reduced-motion behavior.

**Tech Stack:** React, TypeScript, Lucide React, CSS, Vitest, Testing Library

---

## File Map

- Modify `apps/desktop/src/components/AssistantTurn.tsx`: render the Lucide gear for streaming text.
- Modify `apps/desktop/src/styles.css`: replace flywheel drawing rules with restrained gear animation rules.
- Modify `apps/desktop/tests/AssistantTurn.spec.tsx`: lock streaming-only gear visibility.

### Task 1: Replace The Streaming Flywheel

**Files:**
- Modify: `apps/desktop/tests/AssistantTurn.spec.tsx`
- Modify: `apps/desktop/src/components/AssistantTurn.tsx`
- Modify: `apps/desktop/src/styles.css`

- [ ] **Step 1: Write the failing component test**

Replace the existing flywheel test with:

```tsx
it("流式正文末尾展示灰白齿轮，完成后隐藏", () => {
  const msg: ChatMessage = {
    id: "turn-streaming",
    role: "assistant",
    createdAt: "2026-08-02T07:00:00Z",
    text: "正在查询新闻",
    status: "streaming",
  };
  const { container, rerender } = render(<AssistantTurn msg={msg} />);

  expect(container.querySelector("svg.streaming-gear")).toBeTruthy();
  expect(container.querySelector(".streaming-flywheel")).toBeNull();

  rerender(<AssistantTurn msg={{ ...msg, status: "done" }} />);
  expect(container.querySelector("svg.streaming-gear")).toBeNull();
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm -C apps/desktop test -- AssistantTurn.spec.tsx
```

Expected: FAIL because `svg.streaming-gear` is absent and the old flywheel remains.

- [ ] **Step 3: Render the Lucide gear**

Update the import and streaming indicator in `AssistantTurn.tsx`:

```tsx
import { AlertTriangle, Cog } from "lucide-react";
```

```tsx
{streaming && <Cog size={14} className="streaming-gear" aria-hidden="true" />}
```

- [ ] **Step 4: Replace the flywheel CSS**

Delete `.streaming-flywheel`, its pseudo-elements, and `streaming-flywheel-spin`. Add:

```css
/* 流式齿轮：低对比灰白色，提示仍在生成但不抢正文视觉焦点。 */
.streaming-gear {
  display: inline-block;
  width: 14px;
  height: 14px;
  margin-left: 7px;
  vertical-align: -2px;
  color: #c3c7ce;
  filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.14));
  animation: streaming-gear-spin 1.1s linear infinite;
}

@keyframes streaming-gear-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .streaming-gear {
    animation: none;
  }
}
```

- [ ] **Step 5: Run focused and full verification**

Run:

```bash
pnpm -C apps/desktop test -- AssistantTurn.spec.tsx
pnpm -C apps/desktop test
pnpm -C apps/desktop build
git diff --check
```

Expected: focused and full Vitest suites pass, Vite build exits 0, and `git diff --check` reports no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/components/AssistantTurn.tsx \
  apps/desktop/src/styles.css \
  apps/desktop/tests/AssistantTurn.spec.tsx
git commit -m "style: replace streaming flywheel with gear"
```
