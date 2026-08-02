# Token Chart Tooltip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除研究上下文面板内重复开关，并为两张 Token SVG 图表增加统一的最近日期悬浮数据提示。

**Architecture:** `WorkspaceShell` 只删除重复按钮，继续由系统状态栏调用既有 `onToggleRightPanel`。`TokenStats` 在前端根据指针横坐标计算最近日期索引，两张图表分别维护悬浮索引，并在 SVG 中绘制参考线/数据点、在图表容器中渲染 HTML 提示框；后端接口与数据类型不变。

**Tech Stack:** React、TypeScript、SVG、CSS。

---

## 文件边界

- Modify: `apps/desktop/src/pages/Home.tsx`：删除浮动面板标题栏中的重复开关。
- Modify: `apps/desktop/src/components/TokenStats.tsx`：增加指针索引计算、悬浮状态和两类提示内容。
- Modify: `apps/desktop/src/styles.css`：增加图表命中层、参考线、数据点和提示框视觉。
- Modify: `docs/开发进度.md`：记录面板入口去重与图表交互。

### Task 1: 删除浮动面板重复开关

**Files:**
- Modify: `apps/desktop/src/pages/Home.tsx`

- [ ] **Step 1: 删除标题栏按钮**

将浮动面板标题栏保留为：

```tsx
<div className="floating-header">
  <strong>研究上下文</strong>
</div>
```

系统状态栏中的 `onClick={onToggleRightPanel}` 和 `PanelRight` 图标保持不变。

### Task 2: 增加图表最近日期悬浮状态

**Files:**
- Modify: `apps/desktop/src/components/TokenStats.tsx`

- [ ] **Step 1: 增加指针索引计算函数**

导入 React `PointerEvent` 类型并实现：

```tsx
function nearestDayIndex(event: PointerEvent<SVGSVGElement>, count: number) {
  if (count <= 1) return 0;
  const bounds = event.currentTarget.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / Math.max(bounds.width, 1)));
  return Math.round(ratio * (count - 1));
}
```

- [ ] **Step 2: 增加两组悬浮索引**

在 `TokenStats` 内维护 `tokenHoverIndex` 和 `activityHoverIndex`，通过各自 SVG 的 `onPointerMove` 更新，`onPointerLeave` 清空。

- [ ] **Step 3: 渲染 Token 图提示**

Token 图提示包含日期、输入、输出和合计；SVG 对应日期显示参考线和输入/输出边界数据点。删除现有浏览器原生 `<title>`。

- [ ] **Step 4: 渲染活跃度图提示**

活跃度图提示包含日期、任务完成次数和 API 调用次数；SVG 按各自量级计算两个数据点纵坐标，并显示同一参考线。

### Task 3: 增加提示视觉与响应式约束

**Files:**
- Modify: `apps/desktop/src/styles.css`

- [ ] **Step 1: 建立图表相对定位容器**

`.token-chart-plot` 使用 `position: relative`，提示框以所选日期的百分比横坐标定位。

- [ ] **Step 2: 定义命中层和数据标记**

透明命中矩形使用十字光标；参考线使用低对比度虚线；四个系列的数据点沿用图例颜色。

- [ ] **Step 3: 定义自定义提示框**

提示框使用深墨绿表面、轻边框、两到三行数值。后半区数据使用 `align-end` 类向左展开，避免超出卡片。

### Task 4: 更新开发进度并提交

**Files:**
- Modify: `docs/开发进度.md`

- [ ] **Step 1: 记录实现范围**

新增阶段记录，明确唯一面板入口、两图悬浮字段和统计口径不变。

- [ ] **Step 2: 静态检查和提交**

只检查 Git 差异与暂存范围，不运行 build、test 或浏览器验证。

```bash
git add apps/desktop/src/pages/Home.tsx apps/desktop/src/components/TokenStats.tsx apps/desktop/src/styles.css docs/开发进度.md
git commit -m "feat: add token chart hover details"
```
