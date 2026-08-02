# Report Library Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将报告库改为与主工作台一致的顶部状态栏和紧凑单列报告列表。

**Architecture:** 保留 `ReportLibrary` 现有状态、API 请求与按日期分组逻辑，只重排组件语义结构并调整专属 CSS。页面使用独立顶部栏和居中内容容器，报告条目从大卡片改为横向列表项；预览与删除流程不变。

**Tech Stack:** React、TypeScript、Lucide React、CSS。

---

## 文件边界

- Modify: `apps/desktop/src/components/ReportLibrary.tsx`：重排顶部栏、搜索工具栏和报告条目信息结构。
- Modify: `apps/desktop/src/styles.css`：实现工作台式顶部栏、居中内容区、紧凑列表和窄屏状态。
- Modify: `docs/开发进度.md`：记录本次报告库视觉协调改造。

### Task 1: 重排报告库页面结构

**Files:**
- Modify: `apps/desktop/src/components/ReportLibrary.tsx`

- [ ] **Step 1: 将页面标题区改为工作台式顶部栏**

使用 `report-library-topbar` 包裹返回按钮、标题/说明、报告数量和刷新按钮。数量移入右侧状态区，删除原工具栏中的重复计数。

- [ ] **Step 2: 增加居中内容容器**

在顶部栏之外增加 `report-library-content`，其中依次放置搜索、错误态、加载/空状态和日期分组，确保所有内容共用同一宽度基线。

- [ ] **Step 3: 将报告条目改为横向信息结构**

每个 `report-library-card` 内使用 `report-card-icon`、`report-card-copy`、`report-card-meta` 和既有 `report-card-actions`。保持以下行为调用不变：

```tsx
onClick={() => void openPreview(report)}
onClick={() => setPendingDelete(report)}
```

### Task 2: 实现协调的工作台式视觉

**Files:**
- Modify: `apps/desktop/src/styles.css`

- [ ] **Step 1: 建立顶部栏和主内容宽度**

顶部栏使用与 `.workspace-topbar` 一致的边框、半透明深绿色背景和模糊效果，并通过左侧安全区避开 macOS 红绿灯。主内容区使用 `width: min(960px, 100%)` 居中。

- [ ] **Step 2: 压缩搜索和日期分组层级**

搜索框占满内容宽度；日期标题使用细分隔线和数量徽标，缩小标题与列表之间的空白。

- [ ] **Step 3: 将报告卡片改为紧凑列表项**

删除固定最小高度，使用横向 grid/flex 布局；元数据使用可换行的紧凑标签，操作区固定在右侧。悬停只增强边框和表面，不改变尺寸。

- [ ] **Step 4: 补齐窄屏布局**

在 `max-width: 700px` 下隐藏顶部说明，允许顶部右侧状态、搜索区域及报告操作换行，并保证长标题截断或换行后不遮挡按钮。

### Task 3: 更新开发进度并提交

**Files:**
- Modify: `docs/开发进度.md`

- [ ] **Step 1: 记录报告库布局调整**

新增阶段记录，说明顶部栏、紧凑列表、响应式布局和功能保持情况。

- [ ] **Step 2: 静态检查变更范围**

只检查 Git 差异和暂存文件范围，不运行 build、test 或浏览器验证。

- [ ] **Step 3: 提交实现**

```bash
git add apps/desktop/src/components/ReportLibrary.tsx apps/desktop/src/styles.css docs/开发进度.md
git commit -m "style: refine report library layout"
```
